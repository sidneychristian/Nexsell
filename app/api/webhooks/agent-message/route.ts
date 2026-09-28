export const maxDuration = 120;
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { PLAN_ACCESS, normalizePlanKey, planHasFeature } from "../../../plans";
import { executeAgent } from "../../../../lib/execute-agent";
import { apiError, subscriptionActive } from "../../../../lib/api-error";

const schema = z.object({
  organizationId: z.string().min(5),
  agentId: z.string().min(5),
  message: z.string().min(1).max(3000),
  leadId: z.string().optional(),
  conversationId: z.string().min(1).max(160),
  channel: z.enum(["whatsapp", "instagram", "website"]).default("whatsapp"),
});
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

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
  const db = createAdminClient();
  const { data: subscription } = await db
    .from("subscriptions")
    .select("plan,status,next_billing_at")
    .eq("organization_id", parsed.data.organizationId)
    .maybeSingle();
  const planKey = normalizePlanKey(String(subscription?.plan ?? "starter"));
  if (
    !subscription ||
    !subscriptionActive(subscription) ||
    !planHasFeature(planKey, "ai")
  )
    return NextResponse.json(
      { error: "A subscrição não permite agentes." },
      { status: 403 },
    );
  const { data: agent } = await db
    .from("ai_agents")
    .select("*")
    .eq("id", parsed.data.agentId)
    .eq("organization_id", parsed.data.organizationId)
    .eq("status", "active")
    .maybeSingle();
  if (!agent)
    return NextResponse.json(
      { error: "Agente indisponível." },
      { status: 404 },
    );
  try {
    const { data: previousRuns } = parsed.data.conversationId
      ? await db
          .from("agent_runs")
          .select("input_text,output_text")
          .eq("organization_id", parsed.data.organizationId)
          .eq("agent_id", agent.id)
          .eq("conversation_id", parsed.data.conversationId)
          .order("created_at", { ascending: false })
          .limit(6)
      : { data: [] };
    const history = (previousRuns ?? []).reverse().flatMap((run) => [
      { role: "user" as const, text: String(run.input_text) },
      { role: "assistant" as const, text: String(run.output_text) },
    ]);
    if (parsed.data.conversationId) {
      const { data: pending } = await db
        .from("agent_approvals")
        .select("id")
        .eq("organization_id", parsed.data.organizationId)
        .eq("conversation_id", parsed.data.conversationId)
        .in("status", ["pending", "approved"])
        .limit(1);
      if (pending?.length)
        return NextResponse.json({
          reply: null,
          handedOff: true,
          approvalId: pending[0].id,
        });
    }
    const result = await executeAgent(
      db,
      agent,
      parsed.data.message,
      history,
      parsed.data,
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
