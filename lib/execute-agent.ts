import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAgent } from "./agent-runtime";
export async function executeAgent(
  db: SupabaseClient,
  agent: Parameters<typeof runAgent>[1],
  message: string,
  history: Parameters<typeof runAgent>[3],
  context: { channel: string; leadId?: string; conversationId?: string },
) {
  if (!process.env.OPENAI_API_KEY)
    throw new Error("IA não configurada. Contacte o administrador.");
  const runId = "run_" + crypto.randomUUID();
  await db
    .from("agent_runs")
    .insert({
      id: runId,
      organization_id: agent.organization_id,
      agent_id: agent.id,
      lead_id: context.leadId ?? null,
      conversation_id: context.conversationId ?? "",
      channel: context.channel,
      input_text: message,
      status: "processing",
    })
    .throwOnError();
  try {
    const result = await runAgent(db, agent, message, history);
    if (result.handedOff && context.channel !== "test") {
      await db
        .from("agent_approvals")
        .insert({
          id: "approval_" + crypto.randomUUID(),
          organization_id: agent.organization_id,
          agent_id: agent.id,
          lead_id: context.leadId ?? null,
          conversation_id: context.conversationId ?? "",
          reason: result.reason ?? "Atendimento humano necessário",
          request_payload: { message, channel: context.channel },
          status: "pending",
        })
        .throwOnError();
    }
    await db
      .from("agent_runs")
      .update({
        output_text: result.reply,
        status: "completed",
        handed_off: result.handedOff,
      })
      .eq("id", runId)
      .throwOnError();
    return result;
  } catch (error) {
    await db.from("agent_runs").update({ status: "failed" }).eq("id", runId);
    throw error;
  }
}
