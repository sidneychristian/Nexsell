import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { sendWhatsAppText } from "../../../../lib/whatsapp-send";
import { subscriptionActive } from "../../../../lib/api-error";
const schema = z.object({
    organizationId: z.string().min(5),
    leadId: z.string().min(5),
    body: z.string().trim().min(1).max(2000),
});
export async function POST(request: Request) {
    if (!process.env.N8N_INBOUND_SECRET ||
        request.headers.get("x-nexsell-secret") !== process.env.N8N_INBOUND_SECRET)
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    try {
        const d = parsed.data, db = createAdminClient();
        const { data: s } = await db
            .from("subscriptions")
            .select("plan,status,next_billing_at")
            .eq("organization_id", d.organizationId)
            .maybeSingle()
            .throwOnError();
        if (!subscriptionActive(s) || !["Growth", "Scale"].includes(s?.plan))
            return NextResponse.json({ error: "Subscrição incompatível." }, { status: 403 });
        const { data: lead } = await db
            .from("leads")
            .select("phone,consent")
            .eq("id", d.leadId)
            .eq("organization_id", d.organizationId)
            .maybeSingle()
            .throwOnError();
        if (!lead?.consent)
            return NextResponse.json({ error: "Contacto indisponível ou sem consentimento." }, { status: 403 });
        const messageId = await sendWhatsAppText(d.organizationId, lead.phone, d.body);
        const { error } = await db
            .from("activities")
            .upsert({
            id: "wa_" + d.organizationId + "_" + messageId,
            organization_id: d.organizationId,
            lead_id: d.leadId,
            type: "mensagem",
            channel: "whatsapp",
            direction: "outbound",
            body: d.body,
            status: "enviado",
        });
        // Se o envio foi aceite, não pedir ao n8n para o repetir devido a uma falha de histórico.
        return NextResponse.json({
            accepted: true,
            messageId,
            historySaved: !error,
        });
    }
    catch {
        return NextResponse.json({
            error: "O envio não foi confirmado. Verifique a execução antes de repetir para evitar duplicados.",
        }, { status: 502 });
    }
}
