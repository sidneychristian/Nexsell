import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { subscriptionActive, apiError } from "../../../../lib/api-error";
import { normalizePlanKey, planHasFeature } from "../../../plans";
const schema = z.object({
  eventId: z.string().min(5).max(180),
  organizationId: z.string().min(5),
  leadId: z.string().min(5),
  body: z.string().min(1).max(5000),
  direction: z.enum(["inbound", "outbound"]),
  status: z.enum(["recebido", "enviado", "entregue", "lido", "erro"]),
});
export async function POST(request: Request) {
  if (
    !process.env.N8N_INBOUND_SECRET ||
    request.headers.get("x-nexsell-secret") !== process.env.N8N_INBOUND_SECRET
  )
    return NextResponse.json(
      { error: "Assinatura inválida." },
      { status: 401 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  try {
    const d = parsed.data,
      db = createAdminClient();
    const { data: s } = await db
      .from("subscriptions")
      .select("*")
      .eq("organization_id", d.organizationId)
      .maybeSingle()
      .throwOnError();
    if (
      !subscriptionActive(s) ||
      !planHasFeature(normalizePlanKey(s?.plan), "whatsapp")
    )
      return NextResponse.json(
        { error: "Subscrição incompatível." },
        { status: 403 },
      );
    const id = "wa_" + d.organizationId + "_" + d.eventId;
    await db
      .from("activities")
      .upsert(
        {
          id,
          organization_id: d.organizationId,
          lead_id: d.leadId,
          type: "mensagem",
          channel: "whatsapp",
          direction: d.direction,
          body: d.body,
          status: d.status,
        },
        { onConflict: "id" },
      )
      .throwOnError();
    return NextResponse.json({ accepted: true });
  } catch (error) {
    return apiError(error);
  }
}
