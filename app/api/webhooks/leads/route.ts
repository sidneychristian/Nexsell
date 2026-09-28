import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../lib/supabase/admin";
import {
  PLAN_ACCESS,
  minimumPlanFor,
  normalizePlanKey,
  planHasFeature,
} from "../../../plans";

const schema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(7).max(30),
  email: z.string().email().optional(),
  company: z.string().max(120).optional(),
  source: z.string().max(50).default("n8n"),
  interest: z.string().max(120).default("Informação"),
  value: z.number().nonnegative().default(0),
  location: z.string().max(80).default("Moçambique"),
  consent: z.boolean(),
  organizationId: z.string().min(5).optional(),
});

export async function POST(request: Request) {
  const supplied = request.headers.get("x-nexsell-secret");
  if (
    !process.env.N8N_INBOUND_SECRET ||
    supplied !== process.env.N8N_INBOUND_SECRET
  )
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  const organizationId =
    parsed.data.organizationId || process.env.NEXSELL_ORGANIZATION_ID;
  if (!organizationId)
    return NextResponse.json(
      { error: "Organização não configurada" },
      { status: 503 },
    );
  const db = createAdminClient();
  const { data: subscription } = await db
    .from("subscriptions")
    .select("plan,status")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (
    !subscription ||
    !["active", "trial"].includes(String(subscription.status))
  )
    return NextResponse.json(
      { error: "A subscrição desta empresa não está ativa." },
      { status: 403 },
    );
  const planKey = normalizePlanKey(String(subscription.plan));
  if (!planHasFeature(planKey, "n8n")) {
    const required = minimumPlanFor("n8n");
    return NextResponse.json(
      {
        error: `A entrada automática de leads requer o plano ${required.name}. Suba o pacote para continuar.`,
        code: "PLAN_UPGRADE_REQUIRED",
      },
      { status: 403 },
    );
  }
  const { count } = await db
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if ((count ?? 0) >= PLAN_ACCESS[planKey].limits.contacts)
    return NextResponse.json(
      {
        error:
          "O limite de contactos do plano foi atingido. Suba o pacote para receber novos leads.",
        code: "PLAN_LIMIT_REACHED",
      },
      { status: 403 },
    );
  const id = `lead_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const { error } = await db.from("leads").insert({
    id,
    organization_id: organizationId,
    name: parsed.data.name,
    company: parsed.data.company || "",
    phone: parsed.data.phone,
    email: parsed.data.email || "",
    source: parsed.data.source,
    interest: parsed.data.interest,
    stage: "novo",
    score: 0,
    temperature: "morno",
    owner: "Sem responsável",
    value: parsed.data.value,
    location: parsed.data.location,
    last_contact_at: null,
    next_action: "Contactar o potencial cliente",
    consent: parsed.data.consent,
    created_at: now,
    updated_at: now,
  });
  if (error)
    return NextResponse.json(
      { error: "Não foi possível guardar o lead." },
      { status: 500 },
    );
  return NextResponse.json({ accepted: true, leadId: id }, { status: 202 });
}
