"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileCheck,
  MessageCircle,
  Workflow,
  Users,
  Copy,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  Action,
  Brand,
  Field,
  Modal,
  Status,
  money,
  date,
} from "../components/nexsell-ui";
import { NEXSELL_PLANS, PLAN_ACCESS, type PlanKey } from "./plans";
import { PromotionBanner } from "./promotion-banner";
import { TRANSFER_DETAILS } from "./payment-details";
type PaymentMethod = "EMOLA" | "BCI";
type PaymentState = {
  reference: string;
  status: string;
  message?: string | null;
  method: PaymentMethod;
  amount: number;
  plan?: string;
  promoEndsAt?: string | null;
  landingPageBonus?: boolean;
};
export function PublicHome({ signedIn = false }: { signedIn?: boolean }) {
  const [selected, setSelected] = useState<PlanKey>("growth"),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [payment, setPayment] = useState<PaymentState | null>(null),
    [checking, setChecking] = useState(signedIn),
    [renew, setRenew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    company: "",
    method: "EMOLA" as PaymentMethod,
  });
  const plan = NEXSELL_PLANS.find((p) => p.key === selected)!;
  async function refresh() {
    try {
      const r = await fetch("/api/billing/status", { cache: "no-store" }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setPayment(j.payment ?? null);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível consultar o pagamento.",
      );
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    if (!signedIn) return;
    const q = new URLSearchParams(location.search).get("plan");
    if (["starter", "growth", "scale"].includes(q ?? "")) {
      setSelected(q as PlanKey);
      setOpen(true);
    }
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [signedIn]);
  function choose(key: PlanKey) {
    if (!signedIn) {
      location.href = "/login?mode=signup&plan=" + key;
      return;
    }
    setSelected(key);
    setOpen(true);
    setError("");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, plan: selected }),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setPayment(j);
      setRenew(false);
      setOpen(false);
      toast.success("Pedido criado. Consulte os dados da transferência.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível criar o pedido.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="nx-public">
      <Toaster richColors />
      <header>
        <Brand />
        <nav>
          {!signedIn && (
            <a className="nx-hide-mobile" href="#planos">
              Pacotes
            </a>
          )}
          {signedIn ? (
            <>
              <a href="/">Área de trabalho</a>
              <form action="/api/auth/logout" method="post">
                <button aria-label="Terminar sessão">
                  <LogOut size={20} />
                </button>
              </form>
            </>
          ) : (
            <a className="nx-button nx-secondary" href="/login">
              Entrar <ArrowUpRight size={16} />
            </a>
          )}
        </nav>
      </header>
      {signedIn ? (
        <section className="py-10">
          <div className="nx-heading">
            <div>
              <p className="nx-eyebrow">Conta e subscrição</p>
              <h1>{payment ? "O seu pagamento." : "Escolha como começar."}</h1>
              <p className="nx-description">
                O acesso é activado depois de a equipa conferir a transferência.
              </p>
            </div>
            <Action secondary onClick={refresh} busy={checking}>
              <RefreshCw size={16} /> Actualizar
            </Action>
          </div>
          {error && (
            <p role="alert" className="nx-error mb-5">
              {error}
            </p>
          )}
          {checking ? (
            <p role="status" className="nx-loading">
              A consultar a subscrição…
            </p>
          ) : payment ? (
            <>
              <PaymentResult payment={payment} onChange={setPayment} />
              {payment.status === "paid" && (
                <Action
                  secondary
                  className="mt-6"
                  onClick={() => setRenew(!renew)}
                >
                  {renew ? "Fechar pacotes" : "Renovar ou mudar de pacote"}{" "}
                  <ArrowRight size={16} />
                </Action>
              )}
            </>
          ) : (
            <p className="nx-notice">
              Ainda não tem um pedido. Escolha um dos pacotes abaixo para ver os
              dados de transferência.
            </p>
          )}
        </section>
      ) : (
        <section className="nx-hero">
          <div>
            <p className="nx-eyebrow">
              Um espaço de vendas. Feito para Moçambique.
            </p>
            <h1>
              As conversas
              <br />
              continuam.
              <br />
              <span>As vendas avançam.</span>
            </h1>
            <p className="nx-description">
              Saiba quem contactar, prepare os seus agentes e acompanhe cada
              oportunidade até ao pagamento.
            </p>
            <a className="nx-button" href="#planos">
              Encontrar o meu pacote <ArrowRight size={17} />
            </a>
            <p className="mt-5 text-sm text-[#A0ADBF]">
              Subscrição em meticais · e-Mola ou BCI
            </p>
          </div>
          <div className="nx-editorial">
            {[
              [
                Users,
                "01",
                "Cada contacto, com contexto.",
                "Organize contactos e próximos passos num funil que toda a equipa compreende.",
              ],
              [
                MessageCircle,
                "02",
                "Agentes que conhecem a empresa.",
                "Defina o comportamento, associe conhecimento e catálogo e teste antes de publicar.",
              ],
              [
                Workflow,
                "03",
                "Uma operação que acompanha as vendas.",
                "Nos pacotes compatíveis, ligue o WhatsApp e os fluxos n8n, com encaminhamento humano.",
              ],
            ].map(([Icon, n, title, desc]) => {
              const I = Icon as typeof Users;
              return (
                <article key={String(n)}>
                  <I size={25} />
                  <div>
                    <span className="nx-step">{String(n)}</span>
                    <h2>{String(title)}</h2>
                    <p>{String(desc)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {(!signedIn || !payment || renew) && (
        <section id="planos" className="scroll-mt-8">
          <PromotionBanner />
          <p className="nx-eyebrow">Capacidade para a sua empresa</p>
          <h2 className="text-3xl tracking-tight">Comece com o que precisa.</h2>
          <p className="nx-description">
            Compare os limites. Mude de pacote quando a operação crescer.
          </p>
          <div className="nx-plans">
            {NEXSELL_PLANS.map((item) => {
              const limit = PLAN_ACCESS[item.key].limits;
              return (
                <article
                  className={"nx-plan " + (item.featured ? "featured" : "")}
                  key={item.key}
                >
                  <h3>{item.name}</h3>
                  <p className="nx-label mt-3">{item.audience}</p>
                  <p className="nx-price">
                    {money(item.monthlyAmount)} <small>/ mês</small>
                  </p>
                  <p className="nx-label">
                    {limit.agents} agente{limit.agents === 1 ? "" : "s"} de IA ·{" "}
                    {limit.monthlyAgentMessages.toLocaleString("pt-MZ")}{" "}
                    respostas/mês
                  </p>
                  <ul>
                    <li>
                      <Check size={16} />
                      {limit.users} utilizadores e{" "}
                      {limit.contacts.toLocaleString("pt-MZ")} contactos
                    </li>
                    <li>
                      <Check size={16} />
                      {limit.knowledgeResources} recursos e {limit.catalogItems}{" "}
                      itens de catálogo
                    </li>
                    <li>
                      <Check size={16} />
                      Até {limit.activeAutomations} automações activas
                    </li>
                    <li>
                      <Check size={16} />
                      CRM, funil e testes de agentes
                    </li>
                    {item.key !== "starter" && (
                      <>
                        <li>
                          <Check size={16} />
                          WhatsApp e fluxos n8n
                        </li>
                        <li>
                          <Check size={16} />
                          Propostas, pagamentos e relatórios
                        </li>
                      </>
                    )}
                    {item.key === "scale" && (
                      <li>
                        <Check size={16} />
                        Campanhas e gestão avançada de equipa
                      </li>
                    )}
                  </ul>
                  <Action
                    secondary={!item.featured}
                    onClick={() => choose(item.key)}
                  >
                    Escolher {item.name}
                    <ArrowRight size={16} />
                  </Action>
                </article>
              );
            })}
          </div>
          <p className="nx-label">
            Os testes e as respostas de agentes partilham a franquia mensal. O
            Starter permite configurar e testar o agente; a ligação ao WhatsApp
            começa no Growth.
          </p>
          <div className="grid gap-8 py-12 md:grid-cols-3">
            {[
              [
                "01",
                "Escolha o pacote",
                "Crie a conta e consulte os dados para pagamento.",
              ],
              [
                "02",
                "Transfira e envie",
                "Indique a referência e anexe o comprovativo no seu pedido.",
              ],
              [
                "03",
                "Aguarde a aprovação",
                "A equipa confirma a entrada do valor e activa a sua subscrição.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <p className="nx-step">{n}</p>
                <h3 className="text-lg mt-3 mb-3">{t}</h3>
                <p className="nx-description">{d}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <footer className="nx-footer">
        <span>NexSell · Next generation sales</span>
        <a href="https://wa.me/258833837871" target="_blank" rel="noreferrer">
          Falar com a equipa <ArrowUpRight className="inline" size={15} />
        </a>
      </footer>
      {open && (
        <Modal
          onClose={() => setOpen(false)}
          title={"Subscrever " + plan.name}
          description={
            money(plan.monthlyAmount) +
            " por mês. O valor será confirmado pela equipa."
          }
        >
          <form className="nx-form" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo">
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
                  autoComplete="organization"
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="O seu WhatsApp">
              <input
                required
                type="tel"
                minLength={9}
                autoComplete="tel"
                placeholder="8X XXX XXXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Método de transferência">
              <select
                value={form.method}
                onChange={(e) =>
                  setForm({ ...form, method: e.target.value as PaymentMethod })
                }
              >
                <option value="EMOLA">e-Mola</option>
                <option value="BCI">Transferência BCI</option>
              </select>
            </Field>
            <p className="nx-label">
              O pedido fica associado ao e-mail da sessão actual. Não envie o
              seu PIN ou palavra-passe.
            </p>
            {error && (
              <p className="nx-error" role="alert">
                {error}
              </p>
            )}
            <Action type="submit" busy={busy}>
              Ver dados para transferir <ArrowRight size={16} />
            </Action>
          </form>
        </Modal>
      )}
    </div>
  );
}
function PaymentResult({
  payment,
  onChange,
}: {
  payment: PaymentState;
  onChange: (p: PaymentState) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [transaction, setTransaction] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const detail = TRANSFER_DETAILS[payment.method] ?? TRANSFER_DETAILS.EMOLA;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("O comprovativo deve ter no máximo 3 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("reference", payment.reference);
      data.set("transaction", transaction.trim());
      const r = await fetch("/api/billing/proof", {
          method: "POST",
          body: data,
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      onChange({ ...payment, status: "under_review", message: null });
      toast.success("Comprovativo enviado. Aguarde a análise.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }
  if (payment.status === "paid")
    return (
      <div className="nx-success">
        <FileCheck size={28} />
        <h2 className="text-2xl mt-4">Pagamento aprovado.</h2>
        <p className="mt-3">
          A transferência foi confirmada. Consulte o estado actual da subscrição
          na área de trabalho.
        </p>
        {payment.landingPageBonus && (
          <p className="mt-3 font-semibold">
            Tem direito à landing page grátis. A criação será combinada com a
            equipa.
          </p>
        )}
        <a className="nx-button mt-5" href="/">
          Abrir o NexSell <ArrowRight size={16} />
        </a>
        <p className="mt-4 text-sm">
          Pode renovar no botão abaixo. Se precisar de ajuda,{" "}
          <a className="underline" href="https://wa.me/258833837871">
            contacte a equipa
          </a>
          .
        </p>
      </div>
    );
  return (
    <div className="grid gap-7 lg:grid-cols-2">
      <section className="nx-proof-detail">
        <div className="nx-actions justify-between">
          <p className="nx-eyebrow">Dados para transferência</p>
          <Status value={payment.status} />
        </div>
        <h2 className="text-3xl mt-3">{money(payment.amount)}</h2>
        <p className="nx-label mt-2">
          {payment.plan ?? "Subscrição NexSell"} · {detail.label}
        </p>
        <dl>
          <div>
            <dt>Beneficiário</dt>
            <dd>{detail.holder}</dd>
          </div>
          {detail.fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <strong>{value}</strong>
                <button
                  aria-label={"Copiar " + label}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(value);
                      toast.success("Copiado.");
                    } catch {
                      toast.error("Seleccione o número para copiar.");
                    }
                  }}
                >
                  <Copy size={16} />
                </button>
              </dd>
            </div>
          ))}
        </dl>
        <p className="nx-label mt-6">
          Confirme o beneficiário no aplicativo antes de transferir.
        </p>
      </section>
      <section>
        <p className="nx-label break-all mb-4">Pedido {payment.reference}</p>
        {payment.promoEndsAt && (
          <div className="nx-notice mb-5">
            <p>
              Landing page: a transferência deve ocorrer antes de{" "}
              <strong>{date(payment.promoEndsAt)}</strong> (Maputo). A equipa
              verifica a data; a aprovação pode ser posterior.
            </p>
          </div>
        )}
        {payment.status === "under_review" ? (
          <div className="nx-panel p-6" role="status">
            <FileCheck className="text-[#39E675]" size={28} />
            <h2 className="mt-4 text-xl">Comprovativo em análise.</h2>
            <p className="nx-description">
              Pode fechar esta página. Ao voltar, verá o estado actualizado. O
              envio do comprovativo não activa a subscrição.
            </p>
          </div>
        ) : ["pending", "rejected"].includes(payment.status) ? (
          <form onSubmit={send} className="nx-form">
            {payment.status === "rejected" && (
              <p role="alert" className="nx-error">
                Motivo da recusa:{" "}
                {payment.message || "Contacte a equipa para esclarecer."} Pode
                enviar um novo comprovativo.
              </p>
            )}
            <Field
              label="Referência da transferência"
              hint="Copie o código da transacção que aparece no recibo."
            >
              <input
                required
                minLength={3}
                maxLength={100}
                value={transaction}
                onChange={(e) => setTransaction(e.target.value)}
              />
            </Field>
            <Field
              label="Comprovativo"
              hint="PDF, JPG ou PNG. Máximo 3 MB. Só a equipa de análise tem acesso."
            >
              <input
                required
                className="nx-upload"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            {error && (
              <p role="alert" className="nx-error">
                {error}
              </p>
            )}
            <Action type="submit" busy={busy}>
              Enviar comprovativo <ArrowRight size={16} />
            </Action>
            <p className="nx-label">
              A aprovação depende da conferência da entrada do valor.
            </p>
          </form>
        ) : (
          <p className="nx-notice">
            Este pedido está encerrado. Contacte a equipa para continuar.
          </p>
        )}
      </section>
    </div>
  );
}
