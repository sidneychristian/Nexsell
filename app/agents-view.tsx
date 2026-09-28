/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { uploadPrivateFile } from "../lib/upload-client";

import { Action, Upgrade, Status as NxStatus } from "../components/nexsell-ui";
import { useEffect, useState } from "react";
import {
  Bot,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  Globe2,
  LoaderCircle,
  MessageCircle,
  Package,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

type Agent = {
  planBlocked?: boolean;
  instructions: string;
  handoff_message: string;
  handoff_keywords: string[];
  id: string;
  name: string;
  role: string;
  objective: string;
  tone: string;
  language: string;
  status: string;
  last_tested_at: string | null;
  published_at: string | null;
  updated_at: string;
};
type Resource = {
  error_message?: string;
  id: string;
  name: string;
  resource_type: string;
  status: string;
  source_url: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};
type CatalogItem = {
  id: string;
  name: string;
  item_type: string;
  price: number;
  currency: string;
  description: string;
  image_keys: string[];
  status: string;
  created_at: string;
};
type Approval = {
  id: string;
  agent_id: string;
  reason: string;
  status: string;
  request_payload: Record<string, unknown>;
  created_at: string;
};
type Link = { agent_id: string; resource_id: string; resource_kind: string };
type Limits = {
  agents: number;
  knowledgeResources: number;
  catalogItems: number;
  monthlyAgentMessages: number;
};
type AgentData = {
  agents: Agent[];
  resources: Resource[];
  catalog: CatalogItem[];
  approvals: Approval[];
  links: Link[];
  planKey: string;
  limits: Limits;
  usage: { agentMessages: number };
};
type Tab = "agents" | "knowledge" | "catalog" | "approvals";

const field =
  "w-full rounded-xl border border-[#3A4A60] bg-[#111B2A] px-3.5 py-3 text-sm text-[#F7F9FC] outline-none placeholder:text-[#94A5BC] focus:border-[#86A7DE] focus:ring-4 focus:ring-[#397BFF]/10";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#39E675] px-4 py-2.5 text-sm font-bold text-[#07111F] transition hover:bg-[#6CF29B] disabled:opacity-50";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#3A4A60] bg-[#111B2A] px-4 py-2.5 text-sm font-bold text-[#D2DCEA] transition hover:bg-[#0C1725] disabled:opacity-50";
const money = (value: number) =>
  new Intl.NumberFormat("pt-MZ", {
    style: "currency",
    currency: "MZN",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace("MZN", "MT");

export function AgentsWorkspace({ initialTab }: { initialTab: Tab }) {
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Agent | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [testAgent, setTestAgent] = useState<Agent | null>(null);
  const pending =
    data?.approvals.filter((item) => item.status === "pending").length ?? 0;
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/agents", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error || "Não foi possível carregar esta área.",
        );
      setData(payload);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar esta área.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/agents", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error || "Não foi possível carregar esta área.",
          );
        if (!cancelled) setData(payload);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar esta área.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const post = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Ação não concluída.");
      setData(payload.snapshot ?? payload);
      return payload;
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Ação não concluída.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  };
  if (loading) return <Loading />;
  if (error)
    return (
      <Empty
        icon={CircleAlert}
        title="Configuração necessária"
        text={error}
        action={
          <button onClick={load} className={secondary}>
            Tentar novamente
          </button>
        }
      />
    );
  if (!data) return null;
  const titles = {
    agents: [
      "Agentes",
      "Crie assistentes especializados para vender, atender e acompanhar clientes.",
    ],
    knowledge: [
      "Conhecimento",
      "Organize as informações que os agentes podem consultar nas respostas.",
    ],
    catalog: [
      "Catálogo",
      "Adicione produtos e serviços com preços e informações comerciais.",
    ],
    approvals: [
      "Atendimento humano",
      "Analise as conversas transferidas pelos agentes e assuma o atendimento.",
    ],
  } as const;
  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#7CF1A5]">
            Equipa digital
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-.04em] text-[#F7F9FC]">
            {titles[initialTab][0]}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#A0ADBF]">
            {titles[initialTab][1]}
          </p>
        </div>
        {initialTab === "agents" ? (
          <button
            onClick={() => {
              setEditing(null);
              setAgentOpen(true);
            }}
            disabled={data.agents.length >= data.limits.agents}
            className={primary}
          >
            <Plus size={16} /> Criar agente
          </button>
        ) : initialTab === "knowledge" ? (
          <button
            onClick={() => setResourceOpen(true)}
            disabled={data.resources.length >= data.limits.knowledgeResources}
            className={primary}
          >
            <Plus size={16} /> Criar recurso
          </button>
        ) : initialTab === "catalog" ? (
          <button
            onClick={() => setCatalogOpen(true)}
            disabled={data.catalog.length >= data.limits.catalogItems}
            className={primary}
          >
            <Plus size={16} /> Adicionar item
          </button>
        ) : (
          <span className="rounded-full border border-[#51432B] bg-[#352D1A] px-3 py-2 text-xs font-bold text-[#F6D576]">
            {pending} pendentes
          </span>
        )}
      </div>
      {((initialTab === "agents" && data.agents.length >= data.limits.agents) ||
        (initialTab === "knowledge" &&
          data.resources.length >= data.limits.knowledgeResources) ||
        (initialTab === "catalog" &&
          data.catalog.length >= data.limits.catalogItems)) && (
        <div className="mb-5">
          <Upgrade message="Atingiu a capacidade desta área. Os dados estão guardados. Suba o pacote para adicionar mais." />
        </div>
      )}
      {initialTab === "agents" && (
        <AgentsList
          data={data}
          saving={saving}
          post={post}
          create={() => setAgentOpen(true)}
          test={setTestAgent}
          edit={(agent) => {
            setEditing(agent);
            setAgentOpen(true);
          }}
        />
      )}
      {initialTab === "knowledge" && (
        <KnowledgeList data={data} create={() => setResourceOpen(true)} />
      )}
      {initialTab === "catalog" && (
        <CatalogList data={data} create={() => setCatalogOpen(true)} />
      )}
      {initialTab === "approvals" && (
        <ApprovalsList data={data} saving={saving} post={post} />
      )}
      <AgentBuilder
        key={(editing?.id ?? "new") + String(agentOpen)}
        agent={editing}
        open={agentOpen}
        setOpen={setAgentOpen}
        data={data}
        saving={saving}
        save={post}
      />
      <ResourceDialog
        open={resourceOpen}
        setOpen={setResourceOpen}
        saving={saving}
        save={post}
      />
      <CatalogDialog
        open={catalogOpen}
        setOpen={setCatalogOpen}
        saving={saving}
        save={post}
      />
      <TestDialog
        agent={testAgent}
        close={() => setTestAgent(null)}
        saving={saving}
        post={post}
      />
    </>
  );
}

function AgentsList({
  data,
  saving,
  post,
  create,
  test,
  edit,
}: {
  data: AgentData;
  saving: boolean;
  post: (body: Record<string, unknown>) => Promise<any>;
  create: () => void;
  test: (agent: Agent) => void;
  edit: (agent: Agent) => void;
}) {
  const usage = Math.min(
    100,
    Math.round(
      (data.usage.agentMessages /
        Math.max(1, data.limits.monthlyAgentMessages)) *
        100,
    ),
  );
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {data.agents.map((agent) => {
          const links = data.links.filter((link) => link.agent_id === agent.id);
          return (
            <article
              key={agent.id}
              className="rounded-2xl border border-[#29384B] bg-[#111B2A] p-5 shadow-[0_1px_2px_rgba(16,24,40,.04)]"
            >
              <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#123325] text-[#39E675]">
                  <Bot size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-[#F7F9FC]">
                      {agent.name}
                    </h2>
                    <Status
                      status={agent.planBlocked ? "locked" : agent.status}
                    />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#397BFF]">
                    {agent.role}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#A0ADBF]">
                    {agent.objective}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#A0ADBF]">
                    <span>{agent.tone}</span>
                    <span>{agent.language}</span>
                    <span>
                      {
                        links.filter(
                          (link) => link.resource_kind === "knowledge",
                        ).length
                      }{" "}
                      recursos
                    </span>
                    <span>
                      {
                        links.filter((link) => link.resource_kind === "catalog")
                          .length
                      }{" "}
                      itens
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap shrink-0 gap-2">
                  <button onClick={() => edit(agent)} className={secondary}>
                    Editar
                  </button>
                  <button
                    disabled={
                      agent.planBlocked ||
                      saving ||
                      data.usage.agentMessages >=
                        data.limits.monthlyAgentMessages
                    }
                    onClick={() => test(agent)}
                    className={secondary}
                  >
                    <MessageCircle size={15} /> Testar
                  </button>
                  <button
                    disabled={saving || agent.planBlocked}
                    onClick={() =>
                      post({
                        action: "set_agent_status",
                        agentId: agent.id,
                        status: agent.status === "active" ? "paused" : "active",
                      })
                    }
                    className={agent.status === "active" ? secondary : primary}
                  >
                    {agent.status === "active" ? (
                      <>
                        <Pause size={15} /> Pausar
                      </>
                    ) : (
                      <>
                        <Play size={15} /> Publicar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {!data.agents.length && (
          <Empty
            icon={Bot}
            title="Crie o primeiro agente"
            text="Configure função, tom, conhecimento e regras antes de o ligar ao WhatsApp."
            action={
              <button onClick={create} className={primary}>
                <Plus size={16} /> Criar agente
              </button>
            }
          />
        )}
      </div>
      <aside className="space-y-4">
        <UsageCard
          label="Agentes"
          value={data.agents.length}
          limit={data.limits.agents}
        />
        <div className="rounded-2xl border border-[#29384B] bg-[#111B2A] p-5">
          <p className="text-sm font-bold text-[#F7F9FC]">Mensagens este mês</p>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-2xl font-bold">
              {data.usage.agentMessages.toLocaleString("pt-MZ")}
            </p>
            <p className="text-xs text-[#A0ADBF]">
              de {data.limits.monthlyAgentMessages.toLocaleString("pt-MZ")}
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#23344B]">
            <div
              className="h-full rounded-full bg-[#39E675]"
              style={{ width: `${usage}%` }}
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-[#A0ADBF]">
            Testes e respostas reais contam para o limite mensal.
          </p>
        </div>
        <div className="rounded-2xl border border-[#2B5740] bg-[#123325] p-5">
          <ShieldCheck size={19} className="text-[#39E675]" />
          <p className="mt-3 text-sm font-bold text-[#7CF1A5]">
            Controlo humano
          </p>
          <p className="mt-2 text-xs leading-5 text-[#A9CBB7]">
            Configure os casos de transferência. Os pedidos e as respostas
            incertas aparecem em Atendimento humano.
          </p>
        </div>
      </aside>
    </div>
  );
}

function KnowledgeList({
  data,
  create,
}: {
  data: AgentData;
  create: () => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <section className="rounded-2xl border border-[#29384B] bg-[#111B2A]">
      <div className="flex items-center justify-between border-b border-[#29384B] p-5">
        <div className="relative w-full max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A5BC]"
          />
          <input
            className={`${field} pl-10`}
            placeholder="Pesquisar recursos"
            aria-label="Pesquisar recursos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-[#A0ADBF]">
          {data.resources.length}/{data.limits.knowledgeResources}
        </span>
      </div>
      <div className="divide-y divide-[#29384B]">
        {data.resources
          .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
          .map((resource) => (
            <div key={resource.id} className="flex items-center gap-4 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#182638] text-[#B3C0D2]">
                {resource.resource_type === "url" ? (
                  <Globe2 size={18} />
                ) : (
                  <FileText size={18} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#F7F9FC]">
                  {resource.name}
                </p>
                <p className="mt-1 text-xs text-[#A0ADBF]">
                  {resource.resource_type === "document"
                    ? resource.mime_type || "Documento"
                    : resource.resource_type === "url"
                      ? resource.source_url
                      : "Texto interno"}
                </p>
              </div>
              {resource.error_message && (
                <p className="text-sm text-[#FF9AA4] max-w-xs">
                  {resource.error_message}
                </p>
              )}
              <ResourceStatus status={resource.status} />
              <p className="hidden text-xs text-[#94A5BC] sm:block">
                {new Date(resource.created_at).toLocaleDateString("pt-MZ")}
              </p>
            </div>
          ))}
        {!data.resources.length && (
          <Empty
            icon={FileText}
            title="Nenhum recurso adicionado"
            text="Adicione documentos, textos ou páginas para fundamentar as respostas dos agentes."
            action={
              <button onClick={create} className={primary}>
                <Plus size={16} /> Criar recurso
              </button>
            }
          />
        )}
      </div>
    </section>
  );
}

function CatalogList({
  data,
  create,
}: {
  data: AgentData;
  create: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.catalog.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl border border-[#29384B] bg-[#111B2A] p-5"
        >
          <div className="flex items-start justify-between">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#152B49] text-[#397BFF]">
              {item.item_type === "Produto" ? (
                <Package size={20} />
              ) : (
                <Box size={20} />
              )}
            </div>
            <Status status={item.status} />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[.1em] text-[#A0ADBF]">
            {item.item_type}
          </p>
          <h2 className="mt-1 text-base font-bold text-[#F7F9FC]">
            {item.name}
          </h2>
          <p className="mt-3 line-clamp-3 min-h-15 text-sm leading-5 text-[#A0ADBF]">
            {item.description}
          </p>
          <p className="mt-5 text-xl font-bold text-[#F7F9FC]">
            {money(Number(item.price))}
          </p>
        </article>
      ))}
      {!data.catalog.length && (
        <div className="sm:col-span-2 xl:col-span-3">
          <Empty
            icon={Package}
            title="Catálogo vazio"
            text="Adicione produtos e serviços para o agente apresentar preços sem inventar informações."
            action={
              <button onClick={create} className={primary}>
                <Plus size={16} /> Adicionar item
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

function ApprovalsList({
  data,
  saving,
  post,
}: {
  data: AgentData;
  saving: boolean;
  post: (body: Record<string, unknown>) => Promise<any>;
}) {
  return (
    <div className="space-y-3">
      {data.approvals.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl border border-[#29384B] bg-[#111B2A] p-5"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#352D1A] text-[#F6D576]">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[#F7F9FC]">
                  Revisão solicitada
                </p>
                <Status status={item.status} />
              </div>
              <p className="mt-2 text-sm text-[#A0ADBF]">{item.reason}</p>
              <p className="mt-2 text-xs text-[#94A5BC]">
                {new Date(item.created_at).toLocaleString("pt-MZ")}
              </p>
            </div>
            {["pending", "approved"].includes(item.status) && (
              <div className="flex gap-2">
                <button
                  disabled={saving}
                  onClick={() =>
                    post({
                      action: "resolve_approval",
                      approvalId: item.id,
                      decision: "rejected",
                      note: "Encerrado pelo responsável",
                    })
                  }
                  className={secondary}
                >
                  <X size={15} /> Encerrar
                </button>
                <button
                  disabled={saving || item.status === "approved"}
                  onClick={() =>
                    post({
                      action: "resolve_approval",
                      approvalId: item.id,
                      decision: "approved",
                      note: "Atendimento assumido pelo responsável",
                    })
                  }
                  className={primary}
                >
                  <Check size={15} /> Assumir
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
      {!data.approvals.length && (
        <Empty
          icon={ShieldCheck}
          title="Sem pedidos de aprovação"
          text="As conversas transferidas pelos agentes aparecerão aqui para decisão humana."
        />
      )}
    </div>
  );
}

function AgentBuilder({
  open,
  setOpen,
  data,
  saving,
  save,
  agent,
}: {
  agent: Agent | null;
  open: boolean;
  setOpen: (value: boolean) => void;
  data: AgentData;
  saving: boolean;
  save: (body: Record<string, unknown>) => Promise<any>;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: agent?.name ?? "",
    role: agent?.role ?? "Agente de vendas",
    objective:
      agent?.objective ??
      "Qualificar potenciais clientes, apresentar a solução adequada e encaminhar oportunidades prontas para fechar.",
    tone: agent?.tone ?? "consultivo",
    language: agent?.language ?? "Português",
    instructions:
      agent?.instructions ??
      "Faça perguntas curtas. Confirme necessidades antes de recomendar. Nunca pressione o cliente.",
    handoffMessage:
      agent?.handoff_message ??
      "Para garantir a melhor resposta, vou encaminhar a sua conversa para um membro da nossa equipa.",
    keywords:
      agent?.handoff_keywords.join(", ") ??
      "desconto, reclamação, falar com pessoa, cancelar",
  });
  const [knowledgeIds, setKnowledgeIds] = useState<string[]>(
    data.links
      .filter(
        (l) => l.agent_id === agent?.id && l.resource_kind === "knowledge",
      )
      .map((l) => l.resource_id),
  );
  const [catalogIds, setCatalogIds] = useState<string[]>(
    data.links
      .filter((l) => l.agent_id === agent?.id && l.resource_kind === "catalog")
      .map((l) => l.resource_id),
  );
  const finish = async () => {
    const result = await save({
      action: "create_agent",
      agentId: agent?.id,
      ...form,
      handoffKeywords: form.keywords
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      knowledgeIds,
      catalogIds,
    });
    if (result) {
      setOpen(false);
      setStep(1);
      toast.success("Agente guardado em rascunho. Teste antes de publicar.");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-[#29384B] bg-[#111B2A] p-0 text-[#F7F9FC] sm:max-w-3xl">
        <DialogHeader className="border-b border-[#29384B] p-6">
          <DialogTitle className="text-xl">
            {agent ? "Editar agente" : "Criar agente"}
          </DialogTitle>
          <DialogDescription>
            Configure, teste e publique com segurança.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6">
          <div className="grid grid-cols-4 gap-2">
            {["Identidade", "Comportamento", "Recursos", "Revisão"].map(
              (label, index) => (
                <div key={label}>
                  <div
                    className={`h-1 rounded-full ${step >= index + 1 ? "bg-[#39E675]" : "bg-[#29384B]"}`}
                  />
                  <p
                    className={`mt-2 text-xs font-semibold ${step === index + 1 ? "text-[#F7F9FC]" : "text-[#94A5BC]"}`}
                  >
                    {label}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
        <div className="min-h-[390px] p-6">
          {step === 1 && (
            <div className="space-y-5">
              <Field label="Nome do agente">
                <input
                  className={field}
                  placeholder="Ex: Nia Vendas"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Função">
                  <select
                    className={field}
                    value={form.role}
                    onChange={(event) =>
                      setForm({ ...form, role: event.target.value })
                    }
                  >
                    {[
                      "Agente de vendas",
                      "Atendimento ao cliente",
                      "Qualificação de leads",
                      "Marcação de serviços",
                      "Follow-up de propostas",
                      "Recuperação de clientes",
                    ].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Idioma">
                  <select
                    className={field}
                    value={form.language}
                    onChange={(event) =>
                      setForm({ ...form, language: event.target.value })
                    }
                  >
                    <option>Português</option>
                    <option>Português e Inglês</option>
                    <option>Inglês</option>
                  </select>
                </Field>
              </div>
              <Field label="Objetivo">
                <textarea
                  className={`${field} min-h-28 resize-none`}
                  value={form.objective}
                  onChange={(event) =>
                    setForm({ ...form, objective: event.target.value })
                  }
                />
              </Field>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <Field label="Tom da comunicação">
                <select
                  className={field}
                  value={form.tone}
                  onChange={(event) =>
                    setForm({ ...form, tone: event.target.value })
                  }
                >
                  <option value="profissional">Profissional</option>
                  <option value="amigável">Amigável</option>
                  <option value="consultivo">Consultivo</option>
                  <option value="direto">Direto</option>
                </select>
              </Field>
              <Field label="Instruções específicas">
                <textarea
                  className={`${field} min-h-28 resize-none`}
                  value={form.instructions}
                  onChange={(event) =>
                    setForm({ ...form, instructions: event.target.value })
                  }
                />
              </Field>
              <Field label="Transferir para humano quando encontrar">
                <input
                  className={field}
                  value={form.keywords}
                  onChange={(event) =>
                    setForm({ ...form, keywords: event.target.value })
                  }
                />
                <p className="mt-2 text-xs text-[#A0ADBF]">
                  Separe palavras ou situações por vírgulas.
                </p>
              </Field>
              <Field label="Mensagem de transferência">
                <textarea
                  className={`${field} min-h-20 resize-none`}
                  value={form.handoffMessage}
                  onChange={(event) =>
                    setForm({ ...form, handoffMessage: event.target.value })
                  }
                />
              </Field>
            </div>
          )}
          {step === 3 && (
            <div className="grid gap-6 md:grid-cols-2">
              <ResourcePicker
                title="Conhecimento"
                empty="Ainda não há recursos"
                items={data.resources
                  .slice(0, data.limits.knowledgeResources)
                  .filter((r) => r.status === "ready")
                  .map((item) => ({
                    id: item.id,
                    label: item.name,
                    meta: item.status,
                  }))}
                selected={knowledgeIds}
                setSelected={setKnowledgeIds}
              />
              <ResourcePicker
                title="Catálogo"
                empty="Ainda não há itens"
                items={data.catalog
                  .slice(0, data.limits.catalogItems)
                  .map((item) => ({
                    id: item.id,
                    label: item.name,
                    meta: money(Number(item.price)),
                  }))}
                selected={catalogIds}
                setSelected={setCatalogIds}
              />
            </div>
          )}
          {step === 4 && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#29384B] bg-[#0C1725] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#123325] text-[#39E675]">
                    <Bot size={20} />
                  </div>
                  <div>
                    <p className="font-bold">
                      {form.name || "Agente sem nome"}
                    </p>
                    <p className="mt-1 text-xs text-[#A0ADBF]">
                      {form.role} · {form.tone} · {form.language}
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-[#B3C0D2]">
                  {form.objective}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Summary
                  label="Conhecimento"
                  value={`${knowledgeIds.length} recursos`}
                />
                <Summary
                  label="Catálogo"
                  value={`${catalogIds.length} itens`}
                />
                <Summary label="Estado inicial" value="Rascunho" />
              </div>
              <div className="rounded-xl border border-[#2B5740] bg-[#123325] p-4 text-xs leading-5 text-[#A9CBB7]">
                <b className="text-[#7CF1A5]">Publicação segura:</b> depois de
                criar, deverá testar o agente antes de o poder publicar.
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[#29384B] p-6">
          <button
            onClick={() => (step === 1 ? setOpen(false) : setStep(step - 1))}
            className={secondary}
          >
            {step === 1 ? (
              "Cancelar"
            ) : (
              <>
                <ChevronLeft size={15} /> Voltar
              </>
            )}
          </button>
          {step < 4 ? (
            <button
              disabled={
                step === 1 && (!form.name.trim() || form.objective.length < 10)
              }
              onClick={() => setStep(step + 1)}
              className={primary}
            >
              Continuar <ChevronRight size={15} />
            </button>
          ) : (
            <button disabled={saving} onClick={finish} className={primary}>
              {saving ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              Guardar agente
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResourceDialog({
  open,
  setOpen,
  saving,
  save,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  saving: boolean;
  save: (body: Record<string, unknown>) => Promise<any>;
}) {
  const [type, setType] = useState("text");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const submit = async () => {
    let storage: any = {};
    if (type === "document") {
      if (!file) {
        toast.error("Selecione um documento");
        return;
      }
      try {
        storage = await uploadPrivateFile(file);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha no envio");
        return;
      }
    }
    const result = await save({
      action: "create_resource",
      name,
      resourceType: type,
      contentText: type === "text" ? content : "",
      sourceUrl: type === "url" ? url : "",
      storageKey: storage.key || "",
      mimeType: storage.type || "",
      fileSize: storage.size || 0,
    });
    if (result) {
      setOpen(false);
      toast.success("Recurso adicionado");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-[#29384B] bg-[#111B2A] text-[#F7F9FC] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Criar recurso</DialogTitle>
          <DialogDescription>
            Adicione informação confiável para os agentes consultarem.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["text", "Texto", FileText],
            ["url", "Página", Globe2],
            ["document", "Documento", UploadCloud],
          ].map(([key, label, Icon]: any) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className={`rounded-xl border p-3 text-xs font-bold ${type === key ? "border-[#39E675] bg-[#123325] text-[#39E675]" : "border-[#29384B] text-[#A0ADBF]"}`}
            >
              <Icon className="mx-auto mb-2" size={18} />
              {label}
            </button>
          ))}
        </div>
        <Field label="Nome">
          <input
            className={field}
            placeholder="Ex: Políticas de entrega"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {type === "text" && (
          <Field label="Conteúdo">
            <textarea
              className={`${field} min-h-40 resize-none`}
              placeholder="Cole aqui as informações verificadas..."
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </Field>
        )}
        {type === "url" && (
          <Field label="Endereço da página">
            <input
              type="url"
              className={field}
              placeholder="https://empresa.co.mz/faq"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </Field>
        )}
        {type === "document" && (
          <label className="grid min-h-44 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[#3A4A60] bg-[#0C1725] p-6 text-center">
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.pptx,.txt"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <div>
              <UploadCloud className="mx-auto text-[#A0ADBF]" />
              <p className="mt-3 text-sm font-bold">
                {file?.name || "Seleccione um documento"}
              </p>
              <p className="mt-2 text-xs text-[#A0ADBF]">
                PDF, DOCX, PPTX ou TXT até 10 MB
              </p>
            </div>
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => setOpen(false)} className={secondary}>
            Cancelar
          </button>
          <button
            disabled={saving || !name.trim()}
            onClick={submit}
            className={primary}
          >
            {saving ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Plus size={16} />
            )}{" "}
            Adicionar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CatalogDialog({
  open,
  setOpen,
  saving,
  save,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  saving: boolean;
  save: (body: Record<string, unknown>) => Promise<any>;
}) {
  const [form, setForm] = useState({
    name: "",
    itemType: "Produto",
    price: 0,
    description: "",
  });
  const [images, setImages] = useState<File[]>([]);
  const submit = async () => {
    const keys: string[] = [];
    for (const image of images.slice(0, 5)) {
      try {
        keys.push((await uploadPrivateFile(image)).key);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Falha no envio da imagem",
        );
        return;
      }
    }
    const result = await save({
      action: "create_catalog_item",
      ...form,
      price: Number(form.price),
      imageKeys: keys,
    });
    if (result) {
      setOpen(false);
      toast.success("Item adicionado ao catálogo");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-[#29384B] bg-[#111B2A] text-[#F7F9FC] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar ao catálogo</DialogTitle>
          <DialogDescription>
            Os agentes usarão estes dados para apresentar a oferta correta.
          </DialogDescription>
        </DialogHeader>
        <Field label="Nome">
          <input
            className={field}
            placeholder="Ex: Consultoria mensal"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo">
            <select
              className={field}
              value={form.itemType}
              onChange={(event) =>
                setForm({ ...form, itemType: event.target.value })
              }
            >
              <option>Produto</option>
              <option>Serviço</option>
            </select>
          </Field>
          <Field label="Preço (MT)">
            <input
              type="number"
              min="0"
              className={field}
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: Number(event.target.value) })
              }
            />
          </Field>
        </div>
        <Field label="Descrição">
          <textarea
            className={`${field} min-h-32 resize-none`}
            placeholder="Benefícios, condições e informações importantes"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </Field>
        <Field label="Imagens (até 5)">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#3A4A60] bg-[#0C1725] p-4">
            <input
              multiple
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) =>
                setImages(Array.from(event.target.files ?? []).slice(0, 5))
              }
            />
            <Plus size={20} />
            <span className="text-sm text-[#A0ADBF]">
              {images.length
                ? `${images.length} imagens selecionadas`
                : "Selecionar imagens"}
            </span>
          </label>
        </Field>
        <div className="flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className={secondary}>
            Cancelar
          </button>
          <button
            disabled={
              saving || !form.name.trim() || form.description.length < 2
            }
            onClick={submit}
            className={primary}
          >
            {saving ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Plus size={16} />
            )}{" "}
            Adicionar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TestDialog({
  agent,
  close,
  saving,
  post,
}: {
  agent: Agent | null;
  close: () => void;
  saving: boolean;
  post: (body: Record<string, unknown>) => Promise<any>;
}) {
  const [message, setMessage] = useState(
    "Olá, gostaria de saber qual solução recomendam para o meu negócio.",
  );
  const [conversation, setConversation] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const send = async () => {
    if (!agent || !message.trim()) return;
    const input = message;
    setMessage("");
    setConversation((items) => [...items, { role: "user", text: input }]);
    const payload = await post({
      action: "test_agent",
      agentId: agent.id,
      message: input,
      history: conversation.slice(-12),
    });
    if (payload?.result?.reply)
      setConversation((items) => [
        ...items,
        { role: "assistant", text: payload.result.reply },
      ]);
    else setMessage(input);
  };
  return (
    <Dialog open={Boolean(agent)} onOpenChange={(value) => !value && close()}>
      <DialogContent className="border-[#29384B] bg-[#111B2A] p-0 text-[#F7F9FC] sm:max-w-xl">
        <DialogHeader className="border-b border-[#29384B] p-5">
          <DialogTitle>Testar {agent?.name}</DialogTitle>
          <DialogDescription>
            Este teste não envia mensagens a clientes.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[380px] space-y-3 overflow-y-auto bg-[#0C1725] p-5">
          {!conversation.length && (
            <div className="mx-auto mt-20 max-w-xs text-center">
              <Bot className="mx-auto text-[#39E675]" />
              <p className="mt-3 text-sm font-bold">
                Converse como se fosse um cliente
              </p>
              <p className="mt-2 text-xs leading-5 text-[#A0ADBF]">
                Verifique preços, políticas, limites e situações de
                transferência humana.
              </p>
            </div>
          )}
          {conversation.map((item, index) => (
            <div
              key={index}
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === "user" ? "ml-auto bg-[#39E675] text-[#07111F]" : "border border-[#29384B] bg-[#111B2A] text-[#D2DCEA]"}`}
            >
              {item.text}
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-[#29384B] p-4">
          <textarea
            aria-label="Pergunta de teste"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={`${field} min-h-12 resize-none`}
            placeholder="Escreva uma pergunta..."
          />
          <button
            onClick={send}
            aria-label="Enviar pergunta de teste"
            disabled={saving || !message.trim()}
            className={`${primary} self-end px-3.5`}
          >
            {saving ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <Send size={17} />
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResourcePicker({
  title,
  empty,
  items,
  selected,
  setSelected,
}: {
  title: string;
  empty: string;
  items: { id: string; label: string; meta: string }[];
  selected: string[];
  setSelected: (value: string[]) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-bold">{title}</p>
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-[#29384B] p-2">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-3 rounded-xl p-3 hover:bg-[#0C1725]"
          >
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, item.id]
                    : selected.filter((id) => id !== item.id),
                )
              }
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{item.label}</p>
              <p className="mt-1 text-xs text-[#A0ADBF]">{item.meta}</p>
            </div>
          </label>
        ))}
        {!items.length && (
          <p className="p-8 text-center text-xs text-[#94A5BC]">{empty}</p>
        )}
      </div>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-[#D2DCEA]">
        {label}
      </span>
      {children}
    </label>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#29384B] p-4">
      <p className="text-xs uppercase tracking-[.1em] text-[#A0ADBF]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold">{value}</p>
    </div>
  );
}
function Status({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    locked: ["Bloqueado pelo pacote", "bg-[#352D1A] text-[#F6D576]"],
    active: ["Ativo", "border-[#2B5740] bg-[#123325] text-[#7CF1A5]"],
    paused: ["Pausado", "border-[#29384B] bg-[#0C1725] text-[#A0ADBF]"],
    draft: ["Rascunho", "border-[#D9E4F8] bg-[#152B49] text-[#397BFF]"],
    approved: [
      "Em atendimento",
      "border-[#2B5740] bg-[#123325] text-[#7CF1A5]",
    ],
    rejected: ["Encerrado", "border-[#F3CDD2] bg-[#351F2A] text-[#FF9AA4]"],
    pending: ["Pendente", "border-[#51432B] bg-[#352D1A] text-[#F6D576]"],
  };
  const item = map[status] ?? [
    status,
    "border-[#29384B] bg-[#0C1725] text-[#A0ADBF]",
  ];
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-bold ${item[1]}`}
    >
      {item[0]}
    </span>
  );
}
function ResourceStatus({ status }: { status: string }) {
  return status === "ready" ? (
    <Status status="active" />
  ) : status === "error" ? (
    <span className="nx-status is-bad">Erro de processamento</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#51432B] bg-[#352D1A] px-2.5 py-1 text-xs font-bold text-[#F6D576]">
      <LoaderCircle size={11} className="animate-spin" /> A processar
    </span>
  );
}
function UsageCard({
  label,
  value,
  limit,
}: {
  label: string;
  value: number;
  limit: number;
}) {
  return (
    <div className="rounded-2xl border border-[#29384B] bg-[#111B2A] p-5">
      <p className="text-sm font-bold">{label}</p>
      <div className="mt-4 flex items-end justify-between">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-[#A0ADBF]">limite {limit}</p>
      </div>
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[360px] place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#182638] text-[#A0ADBF]">
          <Icon />
        </div>
        <p className="mt-4 text-sm font-bold text-[#F7F9FC]">{title}</p>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#A0ADBF]">
          {text}
        </p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
function Loading() {
  return (
    <div className="grid min-h-[65vh] place-items-center">
      <div className="text-center">
        <LoaderCircle className="mx-auto animate-spin text-[#39E675]" />
        <p className="mt-3 text-sm font-semibold text-[#A0ADBF]">
          A preparar a equipa digital…
        </p>
      </div>
    </div>
  );
}
