import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentAccess } from "../../../lib/agent-access";
import { encryptConnection } from "../../../lib/connections";
import { apiError } from "../../../lib/api-error";
import { planHasFeature } from "../../plans";
export async function POST(request: Request) {
  try {
    const access = await getAgentAccess();
    if ("error" in access)
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    if (!planHasFeature(access.planKey, "connections"))
      return NextResponse.json(
        { error: "As conexões estão disponíveis a partir do Growth." },
        { status: 403 },
      );
    const { data: member } = await access.db
      .from("memberships")
      .select("role")
      .eq("organization_id", access.organizationId)
      .eq("user_email", access.user.email)
      .single()
      .throwOnError();
    if (member.role !== "owner" && !access.admin)
      return NextResponse.json(
        { error: "Só o proprietário pode configurar conexões." },
        { status: 403 },
      );
    const data = z
      .object({
        token: z.string().min(20).max(4000),
        phoneNumberId: z.string().regex(/^\d{5,40}$/),
      })
      .safeParse(await request.json().catch(() => null));
    if (!data.success)
      return NextResponse.json(
        { error: "Verifique o token e o identificador do número." },
        { status: 400 },
      );
    const encrypted = encryptConnection(data.data);
    const r = await fetch(
      "https://graph.facebook.com/v23.0/" +
        data.data.phoneNumberId +
        "?fields=id,display_phone_number",
      {
        headers: { Authorization: "Bearer " + data.data.token },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!r.ok)
      return NextResponse.json(
        {
          error:
            "A Meta não confirmou o acesso ao número. Verifique as permissões do token.",
        },
        { status: 409 },
      );
    const phone = await r.json();
    if (String(phone.id) !== data.data.phoneNumberId)
      throw new Error("Invalid phone");
    const { data: previous } = await access.db
      .from("connection_secrets")
      .select("waba_id")
      .eq("organization_id", access.organizationId)
      .eq("phone_number_id", data.data.phoneNumberId)
      .maybeSingle()
      .throwOnError();
    await access.db
      .rpc("save_whatsapp_connection", {
        p_org: access.organizationId,
        p_phone: data.data.phoneNumberId,
        p_waba: previous?.waba_id ?? null,
        p_display: phone.display_phone_number ?? "",
        p_encrypted: encrypted,
        p_actor: access.user.email,
      })
      .throwOnError();
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
