import { NextResponse } from "next/server";
import { z } from "zod";
import { randomInt } from "node:crypto";
import { getAgentAccess } from "../../../../../lib/agent-access";
import { planHasFeature } from "../../../../plans";
import { encryptConnection, decryptConnection, } from "../../../../../lib/connections";
import { signupConfiguration, exchangeSignupCode, verifySignupAssets, finishMetaRegistration, } from "../../../../../lib/whatsapp-onboarding";
export const maxDuration = 120;
async function owner() {
    const access = await getAgentAccess();
    if ("error" in access)
        return access;
    if (!planHasFeature(access.planKey, "connections"))
        return {
            error: "A ligação WhatsApp está disponível a partir do Growth.",
            status: 403,
        } as const;
    const { data: m, error } = await access.db
        .from("memberships")
        .select("role")
        .eq("organization_id", access.organizationId)
        .eq("user_email", access.user.email)
        .maybeSingle();
    if (error || !m || m.role !== "owner")
        return {
            error: "Só o proprietário pode ligar o WhatsApp da empresa.",
            status: 403,
        } as const;
    return access;
}
export async function GET() {
    const access = await owner();
    if ("error" in access)
        return NextResponse.json({ error: access.error }, { status: access.status });
    const c = signupConfiguration();
    const { data, error } = await access.db
        .from("connection_secrets")
        .select("display_number,updated_at")
        .eq("organization_id", access.organizationId)
        .eq("provider", "whatsapp")
        .maybeSingle();
    if (error)
        return NextResponse.json({ error: "Não foi possível consultar a ligação." }, { status: 500 });
    return NextResponse.json({
        available: !!c,
        connection: data
            ? { number: data.display_number, lastVerifiedAt: data.updated_at }
            : null,
        ...(c
            ? {
                appId: c.appId,
                configId: c.configId,
                version: c.version,
                coexistence: c.coexistence,
            }
            : {}),
    });
}
const schema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("begin") }),
    z.object({
        action: z.literal("complete"),
        sessionId: z.string().uuid(),
        code: z.string().min(10).max(4096),
        wabaId: z.string().regex(/^\d{5,40}$/),
        phoneId: z.string().regex(/^\d{5,40}$/),
    }),
]);
export async function POST(request: Request) {
    // Além de SameSite, exigir Origin impede submissões externas à sessão.
    if (request.headers.get("origin") !== new URL(request.url).origin)
        return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const access = await owner();
    if ("error" in access)
        return NextResponse.json({ error: access.error }, { status: access.status });
    if (!signupConfiguration())
        return NextResponse.json({
            error: "A equipa ainda está a preparar a ligação WhatsApp. Contacte o suporte.",
        }, { status: 503 });
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success)
        return NextResponse.json({ error: "Dados de autorização incompletos." }, { status: 400 });
    const { db, user, organizationId } = access;
    try {
        const { data: device } = await db.from("whatsapp_device_links").select("organization_id").eq("organization_id", organizationId).maybeSingle().throwOnError();
        if (device)
            return NextResponse.json({ error: "Esta empresa usa dispositivo associado. Peça à equipa a migração para a Meta." }, { status: 409 });
        if (input.data.action === "begin") {
            const { count } = await db
                .from("whatsapp_signup_sessions")
                .select("id", { head: true, count: "exact" })
                .eq("user_id", user.id)
                .gt("created_at", new Date(Date.now() - 600000).toISOString())
                .throwOnError();
            if ((count ?? 0) >= 8)
                return NextResponse.json({ error: "Aguarde alguns minutos antes de tentar novamente." }, { status: 429 });
            const { data } = await db
                .from("whatsapp_signup_sessions")
                .insert({ user_id: user.id, organization_id: organizationId })
                .select("id")
                .single()
                .throwOnError();
            return NextResponse.json({ sessionId: data.id });
        }
        const d = input.data;
        const { data: s } = await db
            .from("whatsapp_signup_sessions")
            .update({ consumed_at: new Date().toISOString() })
            .eq("id", d.sessionId)
            .eq("user_id", user.id)
            .eq("organization_id", organizationId)
            .is("consumed_at", null)
            .gt("expires_at", new Date().toISOString())
            .select("id")
            .maybeSingle()
            .throwOnError();
        if (!s)
            return NextResponse.json({ error: "A sessão expirou ou já foi utilizada. Inicie novamente." }, { status: 409 });
        const token = await exchangeSignupCode(d.code);
        const phone = await verifySignupAssets(token, d.wabaId, d.phoneId);
        await db
            .rpc("claim_whatsapp_number", {
            p_org: organizationId,
            p_phone: d.phoneId,
        })
            .throwOnError();
        // Only the first concurrent attempt chooses the registration PIN.
        await db
            .from("whatsapp_number_claims")
            .update({
            encrypted_registration: encryptConnection({
                phoneNumberId: d.phoneId,
                registrationPin: String(randomInt(100000, 1000000)),
            }),
        })
            .eq("phone_number_id", d.phoneId)
            .eq("organization_id", organizationId)
            .is("encrypted_registration", null)
            .throwOnError();
        const { data: claim } = await db
            .from("whatsapp_number_claims")
            .select("encrypted_registration")
            .eq("phone_number_id", d.phoneId)
            .eq("organization_id", organizationId)
            .single()
            .throwOnError();
        const pin = decryptConnection(claim.encrypted_registration).registrationPin;
        if (!pin || !/^\d{6}$/.test(pin))
            throw new Error("Invalid registration state");
        await finishMetaRegistration(token, d.wabaId, d.phoneId, phone.is_on_biz_app === true, pin);
        await db
            .rpc("save_whatsapp_connection", {
            p_org: organizationId,
            p_phone: d.phoneId,
            p_waba: d.wabaId,
            p_display: phone.display_phone_number ?? "",
            p_encrypted: encryptConnection({
                token,
                phoneNumberId: d.phoneId,
                registrationPin: phone.is_on_biz_app ? undefined : pin,
            }),
            p_actor: user.email,
        })
            .throwOnError();
        return NextResponse.json({
            success: true,
            number: phone.display_phone_number ?? "",
            message: "WhatsApp ligado. A recepção e os agentes dependem dos fluxos activados pela equipa.",
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "";
        const safe = message.startsWith("A Meta") ||
            message.startsWith("A autorização") ||
            message.startsWith("Autorize") ||
            message.startsWith("O número seleccionado") ||
            message.startsWith("A conta seleccionada");
        return NextResponse.json({
            error: safe
                ? message
                : "Não foi possível concluir a ligação. Tente novamente ou contacte a equipa. Nenhum acesso de outra empresa foi alterado.",
        }, { status: 409 });
    }
}
