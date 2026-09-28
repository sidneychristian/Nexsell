import { NextResponse } from "next/server";
import { validMetaSignature } from "../../../../lib/meta-webhook";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { subscriptionActive } from "../../../../lib/api-error";
export const maxDuration = 60;
export async function GET(request: Request) {
    const q = new URL(request.url).searchParams;
    if (process.env.META_VERIFY_TOKEN &&
        q.get("hub.mode") === "subscribe" &&
        q.get("hub.verify_token") === process.env.META_VERIFY_TOKEN)
        return new Response(q.get("hub.challenge") ?? "", {
            headers: { "Content-Type": "text/plain" },
        });
    return new Response("Verification failed", { status: 403 });
}
export async function POST(request: Request) {
    const raw = await request.text();
    if (raw.length > 2000000)
        return new Response("Payload too large", { status: 413 });
    if (!validMetaSignature(raw, request.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET ?? ""))
        return new Response("Invalid signature", { status: 401 });
    let payload;
    try {
        payload = JSON.parse(raw);
    }
    catch {
        return new Response("Invalid payload", { status: 400 });
    }
    if (payload.object !== "whatsapp_business_account" ||
        !Array.isArray(payload.entry))
        return NextResponse.json({ received: true });
    if (!process.env.N8N_WEBHOOK_URL || !process.env.N8N_OUTBOUND_SECRET)
        return new Response("Receiver unavailable", { status: 503 });
    try {
        const db = createAdminClient();
        for (const entry of payload.entry) {
            for (const change of entry.changes ?? []) {
                const phoneId = change.value?.metadata?.phone_number_id;
                if (!phoneId)
                    continue;
                const { data: link } = await db
                    .from("connection_secrets")
                    .select("organization_id")
                    .eq("phone_number_id", String(phoneId))
                    .eq("waba_id", String(entry.id))
                    .maybeSingle()
                    .throwOnError();
                if (!link)
                    continue;
                const { data: device } = await db.from("whatsapp_device_links").select("organization_id").eq("organization_id", link.organization_id).maybeSingle().throwOnError();
                if (device)
                    continue;
                const { data: s } = await db
                    .from("subscriptions")
                    .select("plan,status,next_billing_at")
                    .eq("organization_id", link.organization_id)
                    .maybeSingle()
                    .throwOnError();
                if (!subscriptionActive(s) || !["Growth", "Scale"].includes(s?.plan))
                    continue;
                const response = await fetch(process.env.N8N_WEBHOOK_URL, {
                    method: "POST",
                    signal: AbortSignal.timeout(15000),
                    headers: {
                        "Content-Type": "application/json",
                        "x-nexsell-secret": process.env.N8N_OUTBOUND_SECRET,
                    },
                    body: JSON.stringify({
                        event: "whatsapp.event",
                        organizationId: link.organization_id,
                        wabaId: String(entry.id),
                        phoneNumberId: String(phoneId),
                        field: change.field,
                        value: change.value,
                    }),
                });
                if (!response.ok)
                    throw new Error("delivery");
            }
        }
        return NextResponse.json({ received: true });
    }
    catch {
        return new Response("Please retry", { status: 503 });
    }
}
