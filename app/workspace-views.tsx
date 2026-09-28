"use client";
import { WhatsAppConnect } from "./whatsapp-device-connect";
import { useState } from "react";
import {
  Plus,
  Search,
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  Workflow,
  Network,
  FileText,
  Download,
  Check,
  LockKeyhole,
} from "lucide-react";
import {
  Action,
  Heading,
  Field,
  Modal,
  Status,
  EmptyState,
  Upgrade,
  money,
  date,
} from "../components/nexsell-ui";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "../components/ui/sheet";
import { Switch } from "../components/ui/switch";
import {
  PLAN_ACCESS,
  NEXSELL_PLANS,
  normalizePlanKey,
  planHasFeature,
} from "./plans";
import type { Snapshot, Lead, PostFn, User } from "./workspace-types";
type Props = { data: Snapshot; post: PostFn; saving: boolean };
export const stages = [
  { id: "novo", label: "Novo", color: "#397BFF" },
  { id: "contactado", label: "Contactado", color: "#A293DB" },
  { id: "qualificado", label: "Qualificado", color: "#D1AD60" },
  { id: "proposta", label: "Proposta", color: "#6E9CFF" },
  { id: "negociacao", label: "Negociação", color: "#E6BD63" },
  { id: "ganho", label: "Ganho", color: "#39E675" },
  { id: "perdido", label: "Perdido", color: "#8292A7" },
];
function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="nx-search">
      <Search size={17} />
      <input
        className="nx-input"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function ContactList({
  data,
  search,
  setSearch,
  add,
  select,
}: {
  data: Snapshot;
  search: string;
  setSearch: (s: string) => void;
  add: () => void;
  select: (id: string) => void;
}) {
  const [stage, setStage] = useState("all");
  const filtered = data.leads.filter(
    (l) =>
      (l.name + " " + l.company + " " + l.phone + " " + l.email)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (stage === "all" || l.stage === stage),
  );
  return (
    <>
      <Heading
        title="Contactos"
        description="Os seus contactos, com o contexto para continuar a conversa."
        action={
          <Action
            onClick={add}
            disabled={
              (data.contactCount ?? data.leads.length) >=
              data.planLimits.contacts
            }
          >
            <Plus size={16} /> Novo contacto
          </Action>
        }
      />
      {(data.contactCount ?? data.leads.length) >= data.planLimits.contacts && (
        <Upgrade message="A base de contactos atingiu o limite do pacote. Suba de pacote para adicionar mais." />
      )}
      <section className="nx-panel mt-5">
        <div className="nx-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Nome, empresa, telefone ou e-mail"
          />
          <select
            className="nx-input !w-auto"
            aria-label="Filtrar por etapa"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="all">Todas as etapas</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="nx-label">{filtered.length} contactos</span>
        </div>
        {filtered.length ? (
          <table className="nx-table nx-table-mobile">
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Etapa</th>
                <th>Origem</th>
                <th>Valor potencial</th>
                <th>Próxima acção</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td>
                    <button onClick={() => select(l.id)}>{l.name}</button>
                    <small>
                      {l.company} · {l.phone}
                    </small>
                  </td>
                  <td data-label="Etapa">
                    <Status
                      value={
                        stages.find((s) => s.id === l.stage)?.label || l.stage
                      }
                    />
                  </td>
                  <td data-label="Origem">{l.source}</td>
                  <td data-label="Valor">{money(l.value)}</td>
                  <td data-label="Próxima acção">
                    {l.nextAction || "Por definir"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title={
              search || stage !== "all"
                ? "Sem resultados para este filtro."
                : "Adicione o primeiro contacto."
            }
            action={
              <Action secondary onClick={add}>
                <Plus size={16} /> Novo contacto
              </Action>
            }
          >
            Guarde o nome, a origem e o interesse para começar a acompanhar a
            oportunidade.
          </EmptyState>
        )}
      </section>
    </>
  );
}
export function Pipeline({ data, post, saving }: Props) {
  const open = data.leads.filter(
    (l) => !["ganho", "perdido"].includes(l.stage),
  );
  return (
    <>
      <Heading
        title="Funil comercial"
        description="Actualize a etapa de cada negócio sem perder o histórico."
        action={
          <span className="nx-label">
            {money(open.reduce((n, l) => n + l.value, 0))} em aberto
          </span>
        }
      />
      <div className="nx-pipeline">
        {stages.map((stage) => (
          <section className="nx-column" key={stage.id}>
            <header style={{ borderTopColor: stage.color }}>
              <h2>{stage.label}</h2>
              <span className="nx-label">
                {data.leads.filter((l) => l.stage === stage.id).length}
              </span>
            </header>
            {data.leads
              .filter((l) => l.stage === stage.id)
              .map((l) => (
                <article className="nx-deal" key={l.id}>
                  <h3>{l.name}</h3>
                  <p>{l.company || l.interest}</p>
                  <strong>{money(l.value)}</strong>
                  <select
                    className="nx-input"
                    aria-label={"Etapa de " + l.name}
                    disabled={saving}
                    value={l.stage}
                    onChange={(e) =>
                      post({
                        action: "update_stage",
                        leadId: l.id,
                        stage: e.target.value,
                      })
                    }
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            {!data.leads.some((l) => l.stage === stage.id) && (
              <p className="nx-label border border-dashed border-[#29384B] p-5 rounded-md">
                Sem negócios nesta etapa.
              </p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
export function InboxView({ data, post, saving }: Props) {
  const [current, setCurrent] = useState(data.leads[0]?.id || ""),
    [search, setSearch] = useState(""),
    [message, setMessage] = useState("");
  const lead = data.leads.find((l) => l.id === current),
    messages = data.activities
      .filter((a) => a.leadId === current)
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <>
      <Heading
        title="Conversas"
        description="Histórico real do atendimento. As transferências dos agentes aparecem em Atendimento humano."
      />
      <section className="nx-panel nx-inbox">
        <aside className="nx-inbox-list">
          <div className="p-4">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Pesquisar contacto"
            />
          </div>
          {data.leads
            .filter((l) =>
              (l.name + l.phone).toLowerCase().includes(search.toLowerCase()),
            )
            .map((l) => (
              <button
                key={l.id}
                aria-pressed={l.id === current}
                onClick={() => setCurrent(l.id)}
              >
                {l.name}
                <small>{l.phone}</small>
              </button>
            ))}
          {!data.leads.length && (
            <EmptyState title="Sem contactos">
              Adicione um contacto para iniciar o atendimento.
            </EmptyState>
          )}
        </aside>
        <div className="nx-chat">
          {lead ? (
            <>
              <div className="nx-panel-head">
                <div>
                  <h2>{lead.name}</h2>
                  <p className="nx-label mt-1">{lead.phone}</p>
                </div>
                <span className="nx-label">
                  {lead.consent
                    ? "Consentimento registado"
                    : "Sem consentimento"}
                </span>
              </div>
              <div className="nx-chat-messages">
                {messages.length ? (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        "nx-message " +
                        (m.direction === "inbound" ? "inbound" : "outbound")
                      }
                    >
                      {m.body}
                      <small>
                        {date(m.createdAt)} · {m.status}
                      </small>
                    </div>
                  ))
                ) : (
                  <EmptyState title="Ainda não há mensagens registadas.">
                    Nenhuma conversa foi criada automaticamente.
                  </EmptyState>
                )}
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await post({
                      action: "send_message",
                      leadId: lead.id,
                      body: message,
                    })
                  )
                    setMessage("");
                }}
              >
                <textarea
                  className="nx-input"
                  required
                  maxLength={2000}
                  aria-label="Mensagem"
                  placeholder="Escreva a sua mensagem…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Action
                  type="submit"
                  busy={saving}
                  disabled={!lead.consent || !message.trim()}
                >
                  Enviar <ArrowRight size={16} />
                </Action>
              </form>
            </>
          ) : (
            <EmptyState title="Escolha uma conversa.">
              O contexto do contacto aparece aqui.
            </EmptyState>
          )}
        </div>
      </section>
    </>
  );
}
export function Automations({ data, post, saving }: Props) {
  const [open, setOpen] = useState(false);
  const n8n = planHasFeature(normalizePlanKey(data.planKey), "n8n");
  return (
    <>
      <Heading
        title="Automações"
        description="Registe os fluxos e acompanhe o que já foi executado."
        action={
          <Action onClick={() => setOpen(true)}>
            <Plus size={16} /> Registar fluxo
          </Action>
        }
      />
      <section className="nx-panel">
        {data.automations.map((a) => (
          <div className="nx-list-row flex-wrap" key={a.id}>
            <Workflow size={21} className="text-[#8FB1FF]" />
            <div>
              <p className="font-semibold">{a.name}</p>
              <small>
                {a.trigger} · {a.action}
              </small>
              <p className="nx-label mt-2">
                {a.runs} execuções registadas · Última execução:{" "}
                {date(a.lastRunAt)}
              </p>
            </div>
            <div className="nx-actions !flex-none">
              <Switch
                aria-label={"Activar " + a.name}
                checked={a.status === "ativa"}
                disabled={saving}
                onCheckedChange={(value) =>
                  post({
                    action: "toggle_automation",
                    automationId: a.id,
                    status: value ? "ativa" : "pausada",
                  })
                }
              />
              <Status value={a.status} />
              {n8n && (
                <Action
                  secondary
                  busy={saving}
                  onClick={() =>
                    post({ action: "test_n8n", automationId: a.id })
                  }
                >
                  Testar
                </Action>
              )}
            </div>
          </div>
        ))}
        {!data.automations.length && (
          <EmptyState
            title="Ainda não há fluxos."
            action={
              <Action secondary onClick={() => setOpen(true)}>
                Registar o primeiro fluxo
              </Action>
            }
          >
            Descreva o gatilho e a acção. A execução externa depende do fluxo
            correspondente no n8n.
          </EmptyState>
        )}
      </section>
      <div className="nx-notice mt-5">
        <p>
          Até {data.planLimits.activeAutomations} fluxos activos. Registar um
          fluxo não cria um workflow no n8n nem executa mensagens.
        </p>
        <a href="#connections">
          Ver conexões <ArrowUpRight size={16} />
        </a>
      </div>
      {!n8n && (
        <div className="mt-5">
          <Upgrade message="A execução através de n8n está disponível a partir do Growth." />
        </div>
      )}
      {open && (
        <RecordForm
          title="Registar automação"
          close={() => setOpen(false)}
          saving={saving}
          fields={[
            ["name", "Nome do fluxo", "text"],
            ["trigger", "Quando executar", "text"],
            ["description", "O que deve acontecer", "text"],
          ]}
          submit={async (f) => {
            if (
              await post({
                action: "create_automation",
                name: f.name,
                trigger: f.trigger,
                description: f.description,
              })
            )
              setOpen(false);
          }}
        />
      )}
    </>
  );
}
export function Revenue({ data, post, saving }: Props) {
  const [mode, setMode] = useState<"proposal" | "payment" | null>(null);
  return (
    <>
      <Heading
        title="Propostas e pagamentos"
        description="Documente propostas e registe os recebimentos da sua empresa."
        action={
          <Action
            onClick={() => setMode("proposal")}
            disabled={!data.leads.length}
          >
            <Plus size={16} /> Nova proposta
          </Action>
        }
      />
      <div className="nx-grid-two">
        <section className="nx-panel">
          <div className="nx-panel-head">
            <h2>Propostas</h2>
            <span className="nx-label">{data.proposals.length}</span>
          </div>
          {data.proposals.map((p) => (
            <div className="nx-list-row" key={p.id}>
              <FileText size={20} />
              <div>
                <p>{p.title}</p>
                <small>
                  {p.code} · {data.leads.find((l) => l.id === p.leadId)?.name}
                </small>
                <small className="block">Válida até {date(p.dueDate)}</small>
              </div>
              <div className="!flex-none text-right">
                <p>{money(p.amount)}</p>
                <Status value={p.status} />
              </div>
            </div>
          ))}
          {!data.proposals.length && (
            <EmptyState title="Sem propostas.">
              Adicione um contacto e crie a primeira proposta.
            </EmptyState>
          )}
        </section>
        <section className="nx-panel">
          <div className="nx-panel-head">
            <h2>Recebimentos</h2>
            <button onClick={() => setMode("payment")}>Registar</button>
          </div>
          {data.payments.map((p) => (
            <div className="nx-list-row" key={p.id}>
              <div>
                <p>{p.provider}</p>
                <small>
                  {p.reference} · {date(p.createdAt)}
                </small>
              </div>
              <p>{money(p.amount)}</p>
            </div>
          ))}
          {!data.payments.length && (
            <EmptyState title="Sem recebimentos registados.">
              Registe apenas pagamentos que já conferiu na conta da empresa.
            </EmptyState>
          )}
        </section>
      </div>
      {mode && (
        <RevenueForm
          mode={mode}
          data={data}
          close={() => setMode(null)}
          saving={saving}
          post={post}
        />
      )}
    </>
  );
}
function RevenueForm({
  mode,
  data,
  close,
  saving,
  post,
}: { mode: "proposal" | "payment"; close: () => void } & Props) {
  const [leadId, setLeadId] = useState(data.leads[0]?.id || ""),
    [title, setTitle] = useState(""),
    [amount, setAmount] = useState(""),
    [condition, setCondition] = useState(""),
    [provider, setProvider] = useState("e-Mola"),
    [reference, setReference] = useState("");
  return (
    <Modal
      onClose={close}
      title={mode === "proposal" ? "Criar proposta" : "Registar recebimento"}
      description={
        mode === "proposal"
          ? "A proposta será guardada como rascunho."
          : "Este registo não cobra o cliente. Confirme primeiro a entrada do valor."
      }
    >
      <form
        className="nx-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await post(
              mode === "proposal"
                ? {
                    action: "create_proposal",
                    leadId,
                    title,
                    amount: Number(amount),
                    paymentOption: condition,
                  }
                : {
                    action: "record_payment",
                    leadId: leadId || undefined,
                    provider,
                    amount: Number(amount),
                    reference,
                  },
            )
          )
            close();
        }}
      >
        <Field label="Contacto">
          <select
            required={mode === "proposal"}
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
          >
            {mode === "payment" && (
              <option value="">Sem contacto associado</option>
            )}
            {data.leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        {mode === "proposal" ? (
          <>
            <Field label="Título da proposta">
              <input
                required
                minLength={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Condição de pagamento">
              <input
                required
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="Ex.: pagamento integral"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Método">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option>e-Mola</option>
                <option>M-Pesa</option>
                <option>Transferência</option>
              </select>
            </Field>
            <Field label="Referência">
              <input
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          </>
        )}
        <Field label="Valor (MT)">
          <input
            required
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Action type="submit" busy={saving}>
          Guardar {mode === "proposal" ? "proposta" : "recebimento"}
        </Action>
      </form>
    </Modal>
  );
}
export function Reports({ data }: { data: Snapshot }) {
  const [days, setDays] = useState("30");
  const since = Date.now() - Number(days) * 86400000,
    leads = data.leads.filter((l) => Date.parse(l.updatedAt) >= since),
    won = leads.filter((l) => l.stage === "ganho"),
    payments = data.payments.filter(
      (p) => p.status === "confirmado" && Date.parse(p.createdAt) >= since,
    );
  const sum = payments.reduce((n, p) => n + Number(p.amount), 0);
  return (
    <>
      <Heading
        title="Relatórios"
        description="Indicadores calculados a partir dos registos da sua empresa."
        action={
          <Action
            secondary
            onClick={() => {
              const rows = [
                ["Indicador", "Valor"],
                ["Contactos actualizados", String(leads.length)],
                ["Negócios ganhos", String(won.length)],
                ["Recebimentos MT", String(sum)],
              ];
              const blob = new Blob(
                ["\uFEFF" + rows.map((r) => r.join(";")).join("\n")],
                { type: "text/csv;charset=utf-8;" },
              );
              const url = URL.createObjectURL(blob),
                a = document.createElement("a");
              a.href = url;
              a.download = "nexsell-relatorio.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={16} /> Exportar CSV
          </Action>
        }
      />
      <Field label="Período">
        <select
          className="!w-64 mb-6"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </Field>
      <div className="nx-metrics">
        {[
          ["Contactos actualizados", leads.length],
          ["Negócios ganhos", won.length],
          ["Recebimentos", money(sum)],
          [
            "Pagamento médio",
            payments.length ? money(sum / payments.length) : "—",
          ],
        ].map(([label, value]) => (
          <div className="nx-metric" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="nx-panel">
        <div className="nx-panel-head">
          <h2>Distribuição actual do funil</h2>
          <span className="nx-label">Contactos apresentados</span>
        </div>
        {stages.map((s) => {
          const count = data.leads.filter((l) => l.stage === s.id).length;
          return (
            <div className="nx-list-row" key={s.id}>
              <p className="w-28">{s.label}</p>
              <div className="h-2 bg-[#203047] rounded">
                <div
                  className="h-full rounded"
                  style={{
                    width:
                      (data.leads.length
                        ? (count / data.leads.length) * 100
                        : 0) + "%",
                    background: s.color,
                  }}
                />
              </div>
              <p>{count}</p>
            </div>
          );
        })}
      </section>
      <p className="nx-label mt-4">
        “Negócios ganhos” conta os contactos que estão na etapa Ganho e foram
        actualizados no período. Não representa uma taxa histórica de conversão.
        Os recebimentos usam a data do registo.
      </p>
    </>
  );
}
export function Connections({ data }: { data: Snapshot }) {
  const [open, setOpen] = useState(false),
    [verified, setVerified] = useState(false),
    [technical, setTechnical] = useState(false);
  const definitions = [
    [
      "whatsapp",
      "WhatsApp Business",
      "Associe o seu WhatsApp por QR ou código e consulte o estado da ligação.",
    ],
    [
      "n8n",
      "n8n",
      "Fluxos externos que recebem eventos, processam documentos e actualizam o CRM.",
    ],
    [
      "meta",
      "Formulários Meta",
      "Leads encaminhados pelo workflow n8n para a sua empresa.",
    ],
    [
      "ai",
      "Agentes de IA",
      "Respostas baseadas no conhecimento e catálogo que associar ao agente.",
    ],
  ];
  return (
    <>
      <Heading
        title="Conexões"
        description="Veja o que está preparado e o que ainda precisa de configuração."
      />
      <section className="nx-panel">
        {definitions.map(([provider, title, desc]) => {
          const item = data.integrations.find((i) => i.provider === provider);
          return (
            <div className="nx-list-row flex-wrap items-start" key={provider}>
              <Network size={22} className="text-[#8FB1FF]" />
              <div>
                <h2 className="text-base">{title}</h2>
                <p className="nx-description mt-2">{desc}</p>
                <p className="nx-label mt-2">
                  Última verificação: {date(item?.lastSyncAt)}
                </p>
              </div>
              <div className="nx-actions !flex-none">
                <Status
                  value={
                    provider === "whatsapp"
                      ? "Consultar ligação"
                      : (item?.status ?? "por_configurar")
                  }
                />
                {provider === "whatsapp" && data.currentRole === "owner" && (
                  <Action secondary onClick={() => setOpen(true)}>
                    Gerir WhatsApp
                  </Action>
                )}
              </div>
            </div>
          );
        })}
      </section>
      <div className="nx-notice mt-6">
        <p>
          O proprietário pode ligar o número WhatsApp da empresa. A equipa
          configura os fluxos n8n. As chaves nunca são devolvidas ao navegador
          depois de guardadas.
        </p>
        <a href="https://wa.me/258833837871" target="_blank" rel="noreferrer">
          Pedir configuração <ArrowUpRight size={16} />
        </a>
      </div>
      {data.isPlatformAdmin && (
        <button
          className="text-sm text-[#A8C5FF] mt-5"
          onClick={() => setTechnical(true)}
        >
          Configuração técnica assistida
        </button>
      )}
      {technical && (
        <ConnectionForm
          close={() => setTechnical(false)}
          done={() => {
            setTechnical(false);
            setVerified(true);
          }}
        />
      )}
      <section className="nx-panel p-6 mt-6">
        <h2>Pagamento da subscrição</h2>
        <p className="nx-description">
          e-Mola e BCI funcionam por transferência e conferência manual. Não
          exigem uma ligação de gateway.
        </p>
        <a className="text-[#A8C5FF] text-sm mt-4 inline-block" href="/billing">
          Consultar subscrição
        </a>
      </section>
      {open && (
        <WhatsAppConnect
          close={() => setOpen(false)}
          done={() => {
            setVerified(true);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
export function Team({
  user,
  data,
  post,
  saving,
}: { user: NonNullable<User> } & Props) {
  const [open, setOpen] = useState(false),
    plan = NEXSELL_PLANS.find(
      (p) => p.key === normalizePlanKey(data.subscription?.plan),
    )!,
    limit = PLAN_ACCESS[plan.key].limits,
    members = data.members ?? [];
  return (
    <>
      <Heading
        title="Equipa e subscrição"
        description="Acesso da empresa, capacidade do pacote e próximos pagamentos."
        action={
          <a className="nx-button nx-secondary" href="/billing">
            Ver pagamentos <ArrowUpRight size={16} />
          </a>
        }
      />
      <div className="nx-grid-two">
        <section className="nx-panel">
          <div className="nx-panel-head">
            <h2>
              Membros · {members.length}/{limit.users}
            </h2>
            {data.currentRole === "owner" && (
              <button
                disabled={members.length >= limit.users}
                onClick={() => setOpen(true)}
              >
                Adicionar
              </button>
            )}
          </div>
          {members.map((m) => (
            <div className="nx-list-row" key={m.id}>
              <div>
                <p>{m.displayName}</p>
                <small>{m.userEmail}</small>
              </div>
              <Status value={m.role === "owner" ? "Proprietário" : "Membro"} />
            </div>
          ))}
          {!members.length && (
            <div className="nx-list-row">
              <div>
                <p>{user.displayName}</p>
                <small>{user.email}</small>
              </div>
            </div>
          )}
          <p className="nx-label p-6">
            Os membros usam os dados da mesma empresa. Apenas o proprietário
            gere a equipa; só o administrador da plataforma aprova subscrições.
          </p>
        </section>
        <section className="nx-panel p-6">
          <p className="nx-eyebrow">O seu pacote</p>
          <div className="nx-actions justify-between">
            <h2 className="text-3xl">{plan.name}</h2>
            <Status value={data.subscription?.status ?? "pending"} />
          </div>
          <p className="text-2xl my-5">
            {money(plan.monthlyAmount)} <span className="nx-label">/ mês</span>
          </p>
          <p className="nx-label mb-5">
            Válido até: {date(data.subscription?.nextBillingAt)}
          </p>
          <ul className="space-y-3 text-sm">
            {[
              limit.agents + " agentes de IA",
              limit.monthlyAgentMessages + " respostas/mês",
              limit.contacts + " contactos",
              limit.knowledgeResources + " recursos de conhecimento",
              limit.catalogItems + " itens de catálogo",
              limit.activeAutomations + " automações activas",
            ].map((x) => (
              <li key={x} className="flex gap-2">
                <Check size={17} className="text-[#39E675]" />
                {x}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Upgrade message="Precisa de mais capacidade? Peça a alteração do pacote à equipa." />
          </div>
        </section>
      </div>
      {open && (
        <RecordForm
          title="Adicionar membro"
          close={() => setOpen(false)}
          saving={saving}
          fields={[
            ["name", "Nome", "text"],
            ["email", "E-mail de acesso", "email"],
          ]}
          submit={async (f) => {
            if (
              await post({ action: "add_member", name: f.name, email: f.email })
            )
              setOpen(false);
          }}
          description="O membro cria a conta e confirma este mesmo e-mail. Não será enviada uma mensagem automaticamente."
        />
      )}
    </>
  );
}
export function Campaigns({ data, post, saving }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Heading
        title="Campanhas"
        description="Registe os resultados dos canais que utiliza e compare-os no mesmo lugar."
        action={
          <Action onClick={() => setOpen(true)}>
            <Plus size={16} /> Registar campanha
          </Action>
        }
      />
      <section className="nx-panel">
        {data.campaigns.length ? (
          <table className="nx-table nx-table-mobile">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Investimento</th>
                <th>Leads</th>
                <th>Vendas</th>
                <th>Receita</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    <small>{c.channel}</small>
                  </td>
                  <td data-label="Investimento">{money(c.spend)}</td>
                  <td data-label="Leads">{c.leads}</td>
                  <td data-label="Vendas">{c.sales}</td>
                  <td data-label="Receita">{money(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="Sem campanhas registadas.">
            Os números apresentados serão apenas os resultados que registar.
          </EmptyState>
        )}
      </section>
      {open && (
        <RecordForm
          title="Registar resultados de campanha"
          close={() => setOpen(false)}
          saving={saving}
          fields={[
            ["name", "Nome da campanha", "text"],
            ["channel", "Canal", "text"],
            ["spend", "Investimento (MT)", "number"],
            ["leads", "Leads", "number"],
            ["sales", "Vendas", "number"],
            ["revenue", "Receita (MT)", "number"],
          ]}
          submit={async (f) => {
            if (
              await post({
                action: "create_campaign",
                ...f,
                spend: Number(f.spend),
                leads: Number(f.leads),
                sales: Number(f.sales),
                revenue: Number(f.revenue),
              })
            )
              setOpen(false);
          }}
        />
      )}
    </>
  );
}
function RecordForm({
  title,
  description,
  close,
  fields,
  submit,
  saving,
}: {
  title: string;
  description?: string;
  close: () => void;
  fields: string[][];
  submit: (values: Record<string, string>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  return (
    <Modal onClose={close} title={title} description={description}>
      <form
        className="nx-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(form);
        }}
      >
        {fields.map(([key, label, type]) => (
          <Field key={key} label={label}>
            <input
              required
              type={type}
              min={type === "number" ? 0 : undefined}
              value={form[key] ?? ""}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </Field>
        ))}
        <Action type="submit" busy={saving}>
          Guardar
        </Action>
      </form>
    </Modal>
  );
}
export function LeadEditor({
  close,
  save,
  saving,
}: {
  close: () => void;
  save: (body: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    interest: "",
    source: "Website",
    value: 0,
    consent: false,
  });
  return (
    <Modal
      onClose={close}
      title="Novo contacto"
      description="Registe a oportunidade e a autorização de contacto."
    >
      <form
        className="nx-form"
        onSubmit={(e) => {
          e.preventDefault();
          save({ action: "create_lead", ...form });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <input
              required
              minLength={2}
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Empresa">
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </Field>
          <Field label="Telefone">
            <input
              required
              type="tel"
              minLength={7}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Origem">
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              {[
                "Website",
                "WhatsApp",
                "Instagram",
                "Meta Ads",
                "Indicação",
                "Importação",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Valor potencial (MT)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.value}
              onChange={(e) =>
                setForm({ ...form, value: Number(e.target.value) })
              }
            />
          </Field>
        </div>
        <Field label="Interesse">
          <input
            value={form.interest}
            onChange={(e) => setForm({ ...form, interest: e.target.value })}
          />
        </Field>
        <label className="flex gap-3 items-start text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={form.consent}
            onChange={(e) => setForm({ ...form, consent: e.target.checked })}
          />
          <span>
            Este contacto autorizou comunicações comerciais pelo canal indicado.
          </span>
        </label>
        <Action type="submit" busy={saving}>
          Criar contacto
        </Action>
      </form>
    </Modal>
  );
}
export function LeadDetail({
  lead,
  close,
  post,
  saving,
}: {
  lead: Lead;
  close: () => void;
  post: PostFn;
  saving: boolean;
}) {
  const [next, setNext] = useState(lead.nextAction),
    [due, setDue] = useState("");
  return (
    <Sheet open onOpenChange={(v) => !v && close()}>
      <SheetContent className="bg-[#111B2A] border-[#29384B] w-full sm:max-w-md p-7 overflow-y-auto">
        <SheetTitle className="text-2xl mt-6">{lead.name}</SheetTitle>
        <SheetDescription>
          {lead.company || "Contacto comercial"} · {lead.phone}
        </SheetDescription>
        <p className="text-sm">{lead.email}</p>
        <div className="nx-divider" />
        <Field label="Etapa comercial">
          <select
            disabled={saving}
            value={lead.stage}
            onChange={(e) =>
              post({
                action: "update_stage",
                leadId: lead.id,
                stage: e.target.value,
              })
            }
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="nx-label">
          Valor potencial:{" "}
          <strong className="text-[#F7F9FC]">{money(lead.value)}</strong>
        </p>
        <p className="nx-description">
          {lead.interest || "Interesse por definir."}
        </p>
        <Status
          value={lead.consent ? "Consentimento registado" : "Sem consentimento"}
        />
        <form
          className="nx-form mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await post({
              action: "create_task",
              leadId: lead.id,
              title: next,
              dueAt: new Date(due + ":00+02:00").toISOString(),
            });
          }}
        >
          <Field label="Próxima acção">
            <input
              required
              minLength={2}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Data e hora (Maputo)">
            <input
              required
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Field>
          <Action type="submit" busy={saving}>
            Guardar tarefa
          </Action>
        </form>
        <a
          className="nx-button nx-secondary mt-4"
          href="#inbox"
          onClick={close}
        >
          Abrir conversas <MessageCircle size={16} />
        </a>
      </SheetContent>
    </Sheet>
  );
}

function ConnectionForm({
  close,
  done,
}: {
  close: () => void;
  done: () => void;
}) {
  const [token, setToken] = useState(""),
    [phoneNumberId, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      onClose={close}
      title="Ligar WhatsApp Business"
      description="Use as credenciais da API oficial do número desta empresa."
    >
      <form
        className="nx-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, phoneNumberId }),
              }),
              j = await r.json();
            if (!r.ok) throw new Error(j.error);
            setToken("");
            done();
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Não foi possível verificar a ligação.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Identificador do número (Phone number ID)">
          <input
            required
            inputMode="numeric"
            value={phoneNumberId}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Token de acesso da Meta">
          <input
            required
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </Field>
        <p className="nx-label">
          O servidor verifica o acesso ao número na Meta e guarda o token
          cifrado. O teste não envia mensagens. Os webhooks de recepção devem
          ser configurados com a equipa.
        </p>
        {error && (
          <p role="alert" className="nx-error">
            {error}
          </p>
        )}
        <Action type="submit" busy={busy}>
          Verificar e guardar
        </Action>
      </form>
    </Modal>
  );
}
