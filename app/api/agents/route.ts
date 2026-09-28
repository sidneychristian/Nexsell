export const maxDuration = 120;
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentAccess } from "../../../lib/agent-access";
import { apiError } from "../../../lib/api-error";
import { executeAgent } from "../../../lib/execute-agent";
import { runAgent } from "../../../lib/agent-runtime";

export const dynamic = "force-dynamic";
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_agent"),
    agentId: z.string().optional(),
    name: z.string().trim().min(2).max(80),
    role: z.string().trim().min(2).max(100),
    objective: z.string().trim().min(10).max(1200),
    tone: z.enum(["profissional", "amigável", "consultivo", "direto"]),
    language: z.enum(["Português", "Português e Inglês", "Inglês"]),
    instructions: z.string().max(5000).default(""),
    handoffMessage: z
      .string()
      .max(500)
      .default("Vou encaminhar a sua conversa para um membro da equipa."),
    handoffKeywords: z
      .array(z.string().trim().min(1).max(60))
      .max(30)
      .default([]),
    knowledgeIds: z.array(z.string()).max(250).default([]),
    catalogIds: z.array(z.string()).max(1000).default([]),
  }),
  z.object({
    action: z.literal("set_agent_status"),
    agentId: z.string().min(1),
    status: z.enum(["active", "paused"]),
  }),
  z.object({
    action: z.literal("create_resource"),
    name: z.string().trim().min(2).max(120),
    resourceType: z.enum(["text", "url", "document"]),
    contentText: z.string().max(50000).default(""),
    sourceUrl: z.string().url().optional().or(z.literal("")),
    storageKey: z.string().max(500).default(""),
    mimeType: z.string().max(120).default(""),
    fileSize: z
      .number()
      .nonnegative()
      .max(10 * 1024 * 1024)
      .default(0),
  }),
  z.object({
    action: z.literal("create_catalog_item"),
    name: z.string().trim().min(2).max(120),
    itemType: z.enum(["Produto", "Serviço"]),
    price: z.number().nonnegative().max(100000000),
    description: z.string().trim().min(2).max(3000),
    imageKeys: z.array(z.string()).max(5).default([]),
  }),
  z.object({
    action: z.literal("resolve_approval"),
    approvalId: z.string().min(1),
    decision: z.enum(["approved", "rejected"]),
    note: z.string().max(1000).default(""),
  }),
  z.object({
    action: z.literal("test_agent"),
    agentId: z.string().min(1),
    message: z.string().trim().min(1).max(3000),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          text: z.string().max(3000),
        }),
      )
      .max(12)
      .default([]),
  }),
]);

async function agentSnapshot(
  access: Extract<
    Awaited<ReturnType<typeof getAgentAccess>>,
    { organizationId: string }
  >,
) {
  const { db, organizationId, limits, planKey } = access;
  const local = new Date(Date.now() + 7200000);
  const monthStart = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 7200000,
  );
  const [agents, resources, catalog, approvals, runs] = await Promise.all([
    db
      .from("ai_agents")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    db
      .from("knowledge_resources")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at")
      .order("id"),
    db
      .from("catalog_items")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at")
      .order("id"),
    db
      .from("agent_approvals")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    db
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .neq("status", "failed")
      .gte("created_at", monthStart.toISOString()),
  ]);
  const agentIds = (agents.data ?? []).map((agent) => agent.id);
  for (const result of [agents, resources, catalog, approvals, runs])
    if (result.error) throw result.error;
  const { data: links } = agentIds.length
    ? await db
        .from("agent_resources")
        .select("agent_id,resource_id,resource_kind")
        .eq("organization_id", organizationId)
        .in("agent_id", agentIds)
        .throwOnError()
    : { data: [] };
  return {
    agents: (agents.data ?? []).map((agent, index) => ({
      ...agent,
      planBlocked: index >= limits.agents,
    })),
    resources: resources.data ?? [],
    catalog: catalog.data ?? [],
    approvals: approvals.data ?? [],
    links: links ?? [],
    planKey,
    limits,
    usage: { agentMessages: runs.count ?? 0 },
  };
}

export async function GET() {
  const access = await getAgentAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error, code: "code" in access ? access.code : undefined },
      { status: access.status },
    );
  try {
    return NextResponse.json(await agentSnapshot(access));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os agentes. Execute a migração do Supabase.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const access = await getAgentAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error, code: "code" in access ? access.code : undefined },
      { status: access.status },
    );
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  const { db, organizationId, limits, user } = access;
  const data = parsed.data;
  try {
    if (data.action === "create_agent") {
      if (
        data.knowledgeIds.length > limits.knowledgeResources ||
        data.catalogIds.length > limits.catalogItems
      )
        throw new Error("PLAN_LIMIT_REACHED");
      const { error } = await db.rpc("save_agent", {
        p_org: organizationId,
        p_actor: user.id,
        p_id: data.agentId ?? null,
        p_data: data,
      });
      if (error) throw error;
    } else if (data.action === "set_agent_status") {
      const { data: agent } = await db
        .from("ai_agents")
        .select("*")
        .eq("id", data.agentId)
        .eq("organization_id", organizationId)
        .maybeSingle()
        .throwOnError();
      if (!agent)
        return NextResponse.json(
          { error: "Agente não encontrado." },
          { status: 404 },
        );
      if (data.status === "active") {
        const { data: allowed, error } = await db.rpc("agent_allowed", {
          p_org: organizationId,
          p_agent: data.agentId,
        });
        if (error) throw error;
        if (!allowed) throw new Error("PLAN_LIMIT_REACHED");
      }
      if (data.status === "active" && !agent.last_tested_at)
        return NextResponse.json(
          { error: "Teste o agente pelo menos uma vez antes de o publicar." },
          { status: 409 },
        );
      if (data.status === "active" && !process.env.OPENAI_API_KEY)
        return NextResponse.json(
          {
            error:
              "Adicione OPENAI_API_KEY na Vercel antes de publicar o agente.",
          },
          { status: 409 },
        );
      await db
        .from("ai_agents")
        .update({
          status: data.status,
          updated_at: now(),
          published_at: data.status === "active" ? now() : agent.published_at,
        })
        .eq("id", data.agentId)
        .eq("organization_id", organizationId)
        .throwOnError();
    } else if (data.action === "create_resource") {
      const { count } = await db
        .from("knowledge_resources")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .throwOnError();
      if ((count ?? 0) >= limits.knowledgeResources)
        return NextResponse.json(
          {
            error: `Atingiu o limite de ${limits.knowledgeResources} recursos do plano.`,
            code: "PLAN_LIMIT_REACHED",
          },
          { status: 403 },
        );
      if (data.storageKey && !data.storageKey.startsWith(user.id + "/"))
        return NextResponse.json(
          { error: "Ficheiro inválido." },
          { status: 403 },
        );
      if (data.resourceType === "text" && !data.contentText.trim())
        return NextResponse.json(
          { error: "Introduza o conteúdo do recurso." },
          { status: 400 },
        );
      if (
        data.resourceType === "url" &&
        (!data.sourceUrl || !data.sourceUrl.startsWith("https://"))
      )
        return NextResponse.json(
          { error: "Use um endereço HTTPS público." },
          { status: 400 },
        );
      if (data.resourceType === "document" && !data.storageKey)
        return NextResponse.json(
          { error: "Seleccione um documento." },
          { status: 400 },
        );
      const resourceId = id("resource");
      const createdAt = now();
      const ready =
        data.resourceType === "text" && Boolean(data.contentText.trim());
      await db
        .from("knowledge_resources")
        .insert({
          id: resourceId,
          organization_id: organizationId,
          name: data.name,
          resource_type: data.resourceType,
          content_text: data.contentText,
          source_url: data.sourceUrl || "",
          storage_key: data.storageKey,
          mime_type: data.mimeType,
          file_size: data.fileSize,
          status: ready
            ? "ready"
            : process.env.N8N_WEBHOOK_URL && process.env.N8N_OUTBOUND_SECRET
              ? "processing"
              : "error",
          error_message: ready
            ? ""
            : process.env.N8N_WEBHOOK_URL && process.env.N8N_OUTBOUND_SECRET
              ? ""
              : "Processamento de documentos não configurado. Contacte o administrador.",
          created_by: user.id,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .throwOnError();
      if (
        !ready &&
        process.env.N8N_WEBHOOK_URL &&
        process.env.N8N_OUTBOUND_SECRET
      ) {
        try {
          const response = await fetch(process.env.N8N_WEBHOOK_URL, {
            signal: AbortSignal.timeout(15000),
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-nexsell-secret": process.env.N8N_OUTBOUND_SECRET ?? "",
            },
            body: JSON.stringify({
              event: "knowledge.processing_requested",
              organizationId,
              resourceId,
              resourceType: data.resourceType,
              sourceUrl: data.sourceUrl,
              storageKey: data.storageKey,
              occurredAt: createdAt,
            }),
          });
          if (!response.ok) throw new Error("n8n");
        } catch {
          await db
            .from("knowledge_resources")
            .update({
              status: "error",
              error_message: "Não foi possível iniciar o processamento.",
            })
            .eq("id", resourceId)
            .eq("organization_id", organizationId);
        }
      }
    } else if (data.action === "create_catalog_item") {
      if (data.imageKeys.some((key) => !key.startsWith(user.id + "/")))
        return NextResponse.json(
          { error: "Imagem inválida." },
          { status: 403 },
        );
      const { count } = await db
        .from("catalog_items")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .throwOnError();
      if ((count ?? 0) >= limits.catalogItems)
        return NextResponse.json(
          {
            error: `Atingiu o limite de ${limits.catalogItems} itens do catálogo.`,
            code: "PLAN_LIMIT_REACHED",
          },
          { status: 403 },
        );
      await db
        .from("catalog_items")
        .insert({
          id: id("item"),
          organization_id: organizationId,
          name: data.name,
          item_type: data.itemType,
          price: data.price,
          currency: "MZN",
          description: data.description,
          image_keys: data.imageKeys,
          status: "active",
          created_by: user.id,
          created_at: now(),
          updated_at: now(),
        })
        .throwOnError();
    } else if (data.action === "resolve_approval") {
      await db
        .from("agent_approvals")
        .update({
          status: data.decision,
          resolution_note: data.note,
          resolved_by: user.id,
          resolved_at: now(),
        })
        .eq("id", data.approvalId)
        .eq("organization_id", organizationId)
        .in("status", ["pending", "approved"])
        .throwOnError();
    } else if (data.action === "test_agent") {
      const { data: agent } = await db
        .from("ai_agents")
        .select("*")
        .eq("id", data.agentId)
        .eq("organization_id", organizationId)
        .maybeSingle()
        .throwOnError();
      if (!agent)
        return NextResponse.json(
          { error: "Agente não encontrado." },
          { status: 404 },
        );
      const result = await executeAgent(db, agent, data.message, data.history, {
        channel: "test",
      });
      await db
        .from("ai_agents")
        .update({ last_tested_at: now(), updated_at: now() })
        .eq("id", agent.id)
        .eq("organization_id", organizationId)
        .throwOnError();
      return NextResponse.json({
        result,
        ...result,
        snapshot: await agentSnapshot(access),
      });
    }
    return NextResponse.json(await agentSnapshot(access));
  } catch (error) {
    return apiError(error);
  }
}
