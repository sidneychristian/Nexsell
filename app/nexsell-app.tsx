"use client";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  Users,
  GitBranch,
  MessageCircle,
  Workflow,
  Bot,
  FileText,
  Package,
  ShieldCheck,
  BarChart3,
  Network,
  BriefcaseBusiness,
  Megaphone,
  Menu,
  LogOut,
  LockKeyhole,
  LoaderCircle,
  ArrowRight,
  Plus,
  Search,
  ChevronRight,
  Check,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "../components/ui/sheet";
import {
  Action,
  Brand,
  Heading,
  Status,
  EmptyState,
  Upgrade,
  money,
} from "../components/nexsell-ui";
import { AdminView } from "./admin-view";
import { AgentsWorkspace } from "./agents-view";
import { PublicHome } from "./public-home";
import {
  PLAN_ACCESS,
  VIEW_FEATURES,
  normalizePlanKey,
  planHasFeature,
  minimumPlanFor,
} from "./plans";
import {
  ContactList,
  Pipeline,
  InboxView,
  Automations,
  Revenue,
  Reports,
  Connections,
  Team,
  Campaigns,
  LeadEditor,
  LeadDetail,
} from "./workspace-views";
import type { User, Snapshot, PostFn } from "./workspace-types";
const menu: { id: string; label: string; icon: LucideIcon; group: string }[] = [
  {
    id: "dashboard",
    label: "Visão geral",
    icon: LayoutDashboard,
    group: "Trabalho",
  },
  { id: "leads", label: "Contactos", icon: Users, group: "Trabalho" },
  {
    id: "pipeline",
    label: "Funil comercial",
    icon: GitBranch,
    group: "Trabalho",
  },
  { id: "inbox", label: "Conversas", icon: MessageCircle, group: "Trabalho" },
  { id: "agents", label: "Agentes de IA", icon: Bot, group: "Operação" },
  { id: "knowledge", label: "Conhecimento", icon: FileText, group: "Operação" },
  { id: "catalog", label: "Catálogo", icon: Package, group: "Operação" },
  {
    id: "approvals",
    label: "Atendimento humano",
    icon: ShieldCheck,
    group: "Operação",
  },
  { id: "automations", label: "Automações", icon: Workflow, group: "Operação" },
  {
    id: "proposals",
    label: "Propostas e pagamentos",
    icon: FileText,
    group: "Gestão",
  },
  { id: "campaigns", label: "Campanhas", icon: Megaphone, group: "Gestão" },
  { id: "reports", label: "Relatórios", icon: BarChart3, group: "Gestão" },
  { id: "connections", label: "Conexões", icon: Network, group: "Gestão" },
  {
    id: "team",
    label: "Equipa e subscrição",
    icon: BriefcaseBusiness,
    group: "Gestão",
  },
];
export function NexSellApp({
  user,
  initialView = "dashboard",
}: {
  user: User;
  initialView?: string;
}) {
  const [active, setActive] = useState(initialView),
    [data, setData] = useState<Snapshot | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false),
    [mobile, setMobile] = useState(false),
    [leadOpen, setLeadOpen] = useState(false),
    [leadId, setLeadId] = useState<string | null>(null),
    [saving, setSaving] = useState(false),
    [search, setSearch] = useState("");
  const refresh = useCallback(async () => {
    if (!user) return;
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/nexsell", { cache: "no-store" }),
        j = await r.json();
      if (r.status === 401) {
        location.href = "/login";
        return;
      }
      if (r.status === 403) {
        setDenied(true);
        return;
      }
      if (!r.ok) throw new Error(j.error);
      setData(j);
      setDenied(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar os dados.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    refresh();
    const hash = location.hash.slice(1);
    if (menu.some((m) => m.id === hash) || hash === "admin") setActive(hash);
  }, [refresh]);
  useEffect(() => {
    const changed = () => {
      const h = location.hash.slice(1);
      if (menu.some((m) => m.id === h) || h === "admin") setActive(h);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const post: PostFn = async (body) => {
    setSaving(true);
    try {
      const r = await fetch("/api/nexsell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
      toast.success("Alteração guardada.");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
      return false;
    } finally {
      setSaving(false);
    }
  };
  function go(view: string) {
    setActive(view);
    location.hash = view;
    setMobile(false);
  }
  if (!user) return <PublicHome />;
  if (denied) return <PublicHome signedIn />;
  const plan = normalizePlanKey(data?.subscription?.plan),
    items = data?.isPlatformAdmin
      ? [
          ...menu,
          {
            id: "admin",
            label: "Administração",
            icon: ShieldCheck,
            group: "Gestão",
          },
        ]
      : menu;
  const allowed = (id: string) =>
    !VIEW_FEATURES[id] ||
    data?.isPlatformAdmin ||
    planHasFeature(plan, VIEW_FEATURES[id]!);
  const nav = (
    <nav aria-label="Navegação principal">
      {["Trabalho", "Operação", "Gestão"].map((group) => (
        <div className="nx-nav-group" key={group}>
          <p>{group}</p>
          {items
            .filter((i) => i.group === group)
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className="nx-nav-link"
                  aria-current={active === item.id ? "page" : undefined}
                  onClick={() => go(item.id)}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {!allowed(item.id) && (
                    <LockKeyhole size={13} className="nx-lock" />
                  )}
                </button>
              );
            })}
        </div>
      ))}
    </nav>
  );
  const sidebar = (
    <>
      <Brand />
      <div className="nx-workspace">
        <strong>{data?.organization?.name || "A sua empresa"}</strong>
        <span className="nx-label">Espaço de trabalho</span>
      </div>
      {nav}
      <div className="nx-side-footer">
        <div className="flex items-center justify-between">
          <Status value={data?.subscription?.plan || "A carregar"} />
          <button onClick={() => go("team")} className="text-sm text-[#A8C5FF]">
            Gerir
          </button>
        </div>
        <p className="nx-label mt-3">
          {data?.contactCount ?? data?.leads.length ?? 0} /{" "}
          {data?.planLimits.contacts ?? "—"} contactos
        </p>
      </div>
    </>
  );
  return (
    <div className="nx-shell">
      <a className="nx-skip" href="#conteudo">
        Saltar para o conteúdo
      </a>
      <Toaster richColors position="top-right" />
      <aside className="nx-sidebar">{sidebar}</aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent
          side="left"
          className="w-[min(320px,90vw)] bg-[#0B1522] border-[#29384B] p-5 overflow-y-auto"
        >
          <SheetTitle className="sr-only">Menu NexSell</SheetTitle>
          <SheetDescription className="sr-only">
            Escolha uma área de trabalho.
          </SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>
      <div className="nx-content">
        <header className="nx-topbar">
          <button
            className="nx-mobile-menu"
            aria-label="Abrir menu"
            onClick={() => setMobile(true)}
          >
            <Menu size={23} />
          </button>
          <div className="nx-crumb">
            {data?.organization?.name || "NexSell"}{" "}
            <ChevronRight size={14} className="inline mx-2" />{" "}
            <span className="text-[#F7F9FC]">
              {items.find((i) => i.id === active)?.label}
            </span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button title="Terminar sessão">
              <span className="nx-hide-mobile">{user.displayName}</span>
              <LogOut size={17} />
              <span className="sr-only">Terminar sessão</span>
            </button>
          </form>
        </header>
        <main id="conteudo" className="nx-main" tabIndex={-1}>
          {loading ? (
            <div role="status" className="nx-loading">
              <LoaderCircle className="animate-spin" />A carregar a sua empresa…
            </div>
          ) : error ? (
            <EmptyState
              title="Não foi possível abrir o espaço de trabalho."
              action={<Action onClick={refresh}>Tentar novamente</Action>}
            >
              {error}
            </EmptyState>
          ) : data ? (
            <div className="fade-up" key={active}>
              {data.truncated && (
                <p className="nx-notice mb-6">
                  Esta vista contém apenas parte do histórico. Os valores e a
                  pesquisa referem-se aos registos apresentados; o total de
                  contactos indica a utilização completa do pacote.
                </p>
              )}
              {!allowed(active) ? (
                <>
                  <Heading
                    title={
                      items.find((i) => i.id === active)?.label ||
                      "Funcionalidade"
                    }
                    description={
                      "Disponível a partir do " +
                      minimumPlanFor(VIEW_FEATURES[active]!).name +
                      "."
                    }
                  />
                  <Upgrade
                    message={
                      "O pacote " +
                      data.subscription?.plan +
                      " não inclui esta funcionalidade. Escolha um pacote superior para a utilizar."
                    }
                  />
                </>
              ) : (
                <>
                  {active === "dashboard" && (
                    <Dashboard
                      data={data}
                      go={go}
                      add={() => setLeadOpen(true)}
                    />
                  )}
                  {active === "leads" && (
                    <ContactList
                      data={data}
                      search={search}
                      setSearch={setSearch}
                      add={() => setLeadOpen(true)}
                      select={setLeadId}
                    />
                  )}
                  {active === "pipeline" && (
                    <Pipeline data={data} post={post} saving={saving} />
                  )}
                  {active === "inbox" && (
                    <InboxView data={data} post={post} saving={saving} />
                  )}
                  {["agents", "knowledge", "catalog", "approvals"].includes(
                    active,
                  ) && (
                    <AgentsWorkspace
                      initialTab={
                        active as
                          | "agents"
                          | "knowledge"
                          | "catalog"
                          | "approvals"
                      }
                    />
                  )}
                  {active === "automations" && (
                    <Automations data={data} post={post} saving={saving} />
                  )}
                  {active === "proposals" && (
                    <Revenue data={data} post={post} saving={saving} />
                  )}
                  {active === "reports" && <Reports data={data} />}
                  {active === "campaigns" && (
                    <Campaigns data={data} post={post} saving={saving} />
                  )}
                  {active === "connections" && <Connections data={data} />}
                  {active === "team" && (
                    <Team user={user} data={data} post={post} saving={saving} />
                  )}
                  {active === "admin" &&
                    (data.isPlatformAdmin ? (
                      <AdminView
                        customers={data.customers}
                        payments={data.billingPayments}
                        post={post}
                        saving={saving}
                      />
                    ) : (
                      <EmptyState title="Área reservada">
                        Só o administrador da plataforma pode aceder a esta
                        área.
                      </EmptyState>
                    ))}
                </>
              )}
            </div>
          ) : null}
        </main>
      </div>
      {leadOpen && (
        <LeadEditor
          close={() => setLeadOpen(false)}
          save={async (body) => {
            if (await post(body)) setLeadOpen(false);
          }}
          saving={saving}
        />
      )}{" "}
      {leadId && data?.leads.find((l) => l.id === leadId) && (
        <LeadDetail
          lead={data.leads.find((l) => l.id === leadId)!}
          close={() => setLeadId(null)}
          post={post}
          saving={saving}
        />
      )}
    </div>
  );
}
function Dashboard({
  data,
  go,
  add,
}: {
  data: Snapshot;
  go: (view: string) => void;
  add: () => void;
}) {
  const open = data.leads.filter(
      (l) => !["ganho", "perdido"].includes(l.stage),
    ),
    won = data.leads.filter((l) => l.stage === "ganho"),
    revenue = data.payments
      .filter((p) => p.status === "confirmado")
      .reduce((n, p) => n + Number(p.amount), 0);
  const tasks = data.tasks.filter((t) => t.status === "pendente"),
    opportunities = [...open].sort((a, b) => b.value - a.value).slice(0, 5);
  return (
    <>
      <Heading
        eyebrow={new Intl.DateTimeFormat("pt-MZ", {
          timeZone: "Africa/Maputo",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date())}
        title="O seu dia de vendas."
        description="Veja o que precisa de atenção e escolha o próximo passo."
        action={
          <Action onClick={add}>
            <Plus size={16} /> Novo contacto
          </Action>
        }
      />
      {data.leads.length === 0 && (
        <section className="nx-onboarding">
          <div>
            <p className="nx-eyebrow">Comece por aqui</p>
            <h2>Prepare a primeira conversa.</h2>
            <p>
              Adicione a informação da empresa, configure o agente e traga o
              primeiro contacto.
            </p>
          </div>
          <ol>
            {[
              [
                "knowledge",
                "Conhecimento",
                "Informações que o agente pode usar.",
              ],
              [
                "agents",
                "O primeiro agente",
                "Configure e teste antes de publicar.",
              ],
              ["leads", "Contactos", "Organize a sua primeira oportunidade."],
            ].map(([id, title, text], i) => (
              <li key={id}>
                <button onClick={() => go(id)}>
                  <span className="nx-step !flex-none">0{i + 1}</span>
                  <span>
                    <strong>{title}</strong>
                    <small className="block nx-label">{text}</small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="nx-metrics">
        {[
          [
            "Contactos",
            String(data.contactCount ?? data.leads.length),
            "de " +
              data.planLimits.contacts.toLocaleString("pt-MZ") +
              " no pacote",
          ],
          [
            "Oportunidades abertas",
            money(open.reduce((n, l) => n + Number(l.value), 0)),
            open.length + " negócios no funil",
          ],
          ["Negócios ganhos", String(won.length), "etapa comercial: ganho"],
          [
            "Recebimentos registados",
            money(revenue),
            "pagamentos confirmados no CRM",
          ],
        ].map(([label, value, note]) => (
          <div className="nx-metric" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="nx-grid-two">
        <section className="nx-panel">
          <div className="nx-panel-head">
            <h2>Oportunidades em aberto</h2>
            <button onClick={() => go("pipeline")}>
              Ver funil <ArrowUpRight size={14} className="inline" />
            </button>
          </div>
          {opportunities.length ? (
            opportunities.map((l) => (
              <div className="nx-list-row" key={l.id}>
                <div>
                  <p className="font-semibold">{l.name}</p>
                  <small>{l.company || l.interest}</small>
                </div>
                <span className="text-sm">{money(l.value)}</span>
                <button
                  aria-label={"Ver contacto " + l.name}
                  onClick={() => go("leads")}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            ))
          ) : (
            <EmptyState title="O funil está pronto.">
              As oportunidades aparecem aqui quando adicionar contactos.
            </EmptyState>
          )}
        </section>
        <section className="nx-panel">
          <div className="nx-panel-head">
            <h2>Próximos passos</h2>
            <span className="nx-label">{tasks.length} pendentes</span>
          </div>
          {tasks.length ? (
            tasks.slice(0, 5).map((t) => (
              <div className="nx-list-row" key={t.id}>
                <div>
                  <p>{t.title}</p>
                  <small>
                    {new Date(t.dueAt).toLocaleDateString("pt-MZ", {
                      timeZone: "Africa/Maputo",
                    })}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="Sem tarefas pendentes.">
              Abra um contacto para registar a próxima acção comercial.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
