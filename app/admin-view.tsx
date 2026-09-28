"use client";
import { useState } from "react";
import { UserPlus, Search, ArrowUpRight, FileCheck, Check } from "lucide-react";
import {
  Action,
  Heading,
  Modal,
  Field,
  Status,
  EmptyState,
  money,
  date,
} from "../components/nexsell-ui";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { NEXSELL_PLANS } from "./plans";
export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  plan: string;
  accessStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  monthlyAmount: number;
  externalPaymentReference: string;
  createdAt: string;
  activatedAt: string | null;
};
export type BillingPayment = {
  id: string;
  customerId: string | null;
  provider: string;
  reference: string;
  method: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  proofPath?: string;
  transferReference?: string;
  reviewNote?: string;
  promoEndsAt?: string | null;
  landingPageBonus?: boolean;
  paidPlan?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

type PostFn = (body: Record<string, unknown>) => Promise<boolean>;
export function AdminView({
  customers,
  payments,
  post,
  saving,
}: {
  customers: Customer[];
  payments: BillingPayment[];
  post: PostFn;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("under_review"),
    [review, setReview] = useState<BillingPayment | null>(null),
    [change, setChange] = useState<{
      customer: Customer;
      plan?: string;
      status?: string;
    } | null>(null);
  const waiting = payments.filter((p) => p.status === "under_review"),
    visible = payments.filter(
      (p) =>
        filter === "all" ||
        (filter === "bonus" ? p.landingPageBonus : p.status === filter),
    );
  return (
    <>
      <Heading
        eyebrow="Administração da plataforma"
        title="Clientes e subscrições"
        description="Confira transferências, atribua pacotes e acompanhe o acesso."
        action={
          <Action onClick={() => setOpen(true)}>
            <UserPlus size={17} /> Adicionar cliente
          </Action>
        }
      />
      <div className="nx-metrics !grid-cols-3">
        {[
          [
            "Clientes activos",
            customers.filter((c) => c.accessStatus === "active").length,
          ],
          ["Comprovativos por rever", waiting.length],
          [
            "Landing pages atribuídas",
            payments.filter((p) => p.landingPageBonus).length,
          ],
        ].map(([label, value]) => (
          <div key={label} className="nx-metric">
            <p>{label}</p>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <Tabs defaultValue="payments">
        <TabsList variant="line" className="mb-5 gap-5">
          <TabsTrigger value="payments">
            Pagamentos · {waiting.length} por rever
          </TabsTrigger>
          <TabsTrigger value="customers">
            Clientes · {customers.length}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="payments">
          <section className="nx-panel">
            <div className="nx-toolbar">
              <Field label="Estado do pagamento">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="under_review">Em análise</option>
                  <option value="pending">Aguarda comprovativo</option>
                  <option value="rejected">Recusados</option>
                  <option value="paid">Pagos</option>
                  <option value="bonus">Com landing page</option>
                  <option value="all">Todos os pagamentos</option>
                </select>
              </Field>
              <span className="nx-label">
                A aprovação activa o pacote do pedido.
              </span>
            </div>
            {visible.length ? (
              <table className="nx-table nx-table-mobile">
                <thead>
                  <tr>
                    <th>Cliente / pedido</th>
                    <th>Pacote e valor</th>
                    <th>Estado</th>
                    <th>Bónus</th>
                    <th>Acção</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const c = customers.find((c) => c.id === p.customerId);
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{c?.name ?? "Cliente"}</strong>
                          <small>{c?.email}</small>
                          <small className="break-all">{p.reference}</small>
                        </td>
                        <td data-label="Pacote">
                          {p.paidPlan || c?.plan}
                          <small>
                            {money(p.amount)} · {p.method}
                          </small>
                        </td>
                        <td data-label="Estado">
                          <Status value={p.status} />
                        </td>
                        <td data-label="Landing page">
                          {p.landingPageBonus ? (
                            <span className="text-[#7CF1A5]">Atribuída</span>
                          ) : p.status === "paid" ? (
                            "Não elegível"
                          ) : p.promoEndsAt ? (
                            "Verificar data"
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <button
                            className="text-[#A8C5FF]"
                            onClick={() => setReview(p)}
                          >
                            {p.status === "under_review"
                              ? "Analisar"
                              : "Ver detalhe"}{" "}
                            <ArrowUpRight size={14} className="inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState title="Nenhum pagamento neste estado.">
                Os comprovativos enviados pelos clientes aparecem em “Em
                análise”.
              </EmptyState>
            )}
          </section>
        </TabsContent>
        <TabsContent value="customers">
          <section className="nx-panel">
            <div className="nx-toolbar">
              <div className="nx-search">
                <Search size={17} />
                <input
                  className="nx-input"
                  aria-label="Pesquisar clientes"
                  placeholder="Pesquisar nome, empresa ou e-mail"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            {customers.length ? (
              <table className="nx-table nx-table-mobile">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Pacote</th>
                    <th>Acesso</th>
                    <th>Acção</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .filter((c) =>
                      (c.name + c.company + c.email)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                          <small>
                            {c.company} · {c.email}
                          </small>
                        </td>
                        <td data-label="Pacote">
                          <select
                            className="nx-input"
                            aria-label={"Pacote de " + c.name}
                            disabled={saving}
                            value={c.plan}
                            onChange={(e) =>
                              setChange({ customer: c, plan: e.target.value })
                            }
                          >
                            {NEXSELL_PLANS.map((p) => (
                              <option key={p.key}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td data-label="Acesso">
                          <Status value={c.accessStatus} />
                        </td>
                        <td>
                          {c.accessStatus === "pending" ? (
                            <span className="nx-label">Aguarda pagamento</span>
                          ) : (
                            <button
                              onClick={() =>
                                setChange({
                                  customer: c,
                                  status:
                                    c.accessStatus === "active"
                                      ? "suspended"
                                      : "active",
                                })
                              }
                            >
                              {c.accessStatus === "active"
                                ? "Suspender"
                                : "Reactivar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="Ainda não há clientes.">
                Pode adicionar um cliente que tenha pago fora do site.
              </EmptyState>
            )}
          </section>
        </TabsContent>
      </Tabs>
      {open && (
        <CustomerForm
          close={() => setOpen(false)}
          saving={saving}
          post={post}
        />
      )}
      {review && (
        <ReviewDialog
          payment={review}
          customer={customers.find((c) => c.id === review.customerId)}
          close={() => setReview(null)}
          saving={saving}
          post={post}
        />
      )}
      {change && (
        <Modal
          onClose={() => setChange(null)}
          title={change.plan ? "Alterar pacote" : "Alterar acesso"}
          description={change.customer.name + " · " + change.customer.email}
        >
          <p>
            {change.plan
              ? "Mudar de " +
                change.customer.plan +
                " para " +
                change.plan +
                ". Os registos serão preservados; os agentes e recursos acima do novo limite deixam de poder ser utilizados."
              : change.status === "suspended"
                ? "Suspender o acesso desta empresa? Os dados continuam guardados."
                : "Reactivar o acesso sem prolongar a validade da subscrição?"}
          </p>
          <div className="nx-actions justify-end">
            <Action secondary onClick={() => setChange(null)}>
              Cancelar
            </Action>
            <Action
              busy={saving}
              onClick={async () => {
                if (
                  await post(
                    change.plan
                      ? {
                          action: "update_customer_plan",
                          customerId: change.customer.id,
                          plan: change.plan,
                        }
                      : {
                          action: "update_customer_status",
                          customerId: change.customer.id,
                          status: change.status,
                        },
                  )
                )
                  setChange(null);
              }}
            >
              Confirmar alteração
            </Action>
          </div>
        </Modal>
      )}
    </>
  );
}
function ReviewDialog({
  payment: p,
  customer: c,
  close,
  saving,
  post,
}: {
  payment: BillingPayment;
  customer?: Customer;
  close: () => void;
  saving: boolean;
  post: PostFn;
}) {
  const [paidAt, setPaidAt] = useState(""),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState("");
  async function act(approve: boolean) {
    setError("");
    let timestamp: string | undefined;
    if (approve) {
      const value = new Date(paidAt + ":00+02:00");
      if (
        !paidAt ||
        !Number.isFinite(value.getTime()) ||
        value.getTime() > Date.now()
      ) {
        setError("Indique uma data válida da transferência (hora de Maputo).");
        return;
      }
      if (!confirmed) {
        setError("Confirme a entrada do valor antes de aprovar.");
        return;
      }
      timestamp = value.toISOString();
    } else if (note.trim().length < 3) {
      setError("Explique o motivo da recusa ao cliente.");
      return;
    }
    if (
      await post({
        action: "review_payment",
        paymentId: p.id,
        approve,
        paidAt: timestamp,
        note,
      })
    )
      close();
  }
  return (
    <Modal
      onClose={close}
      title={
        p.status === "under_review"
          ? "Analisar comprovativo"
          : "Detalhe do pagamento"
      }
      description={(c?.name ?? "Cliente") + " · " + (c?.email ?? "")}
    >
      <div className="nx-actions justify-between">
        <strong className="text-2xl">{money(p.amount)}</strong>
        <Status value={p.status} />
      </div>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="nx-label">Plano e método</dt>
          <dd>
            {p.paidPlan || c?.plan} · {p.method}
          </dd>
        </div>
        <div>
          <dt className="nx-label">Referência da transferência</dt>
          <dd className="break-all">{p.transferReference || "Por indicar"}</dd>
        </div>
      </dl>
      {p.proofPath && (
        <a
          className="nx-button nx-secondary"
          href={"/api/billing/proof?id=" + encodeURIComponent(p.id)}
          target="_blank"
          rel="noreferrer"
        >
          Abrir comprovativo privado <ArrowUpRight size={17} />
        </a>
      )}
      {p.promoEndsAt && (
        <div className="nx-notice">
          <p>
            O pagamento deve ser anterior a{" "}
            <strong>{date(p.promoEndsAt)}</strong> (Maputo) para esta oferta. A
            data de aprovação não altera o prazo.
          </p>
        </div>
      )}
      {p.landingPageBonus && (
        <p className="nx-success">
          <Check size={18} className="inline mr-2" />
          Landing page atribuída. Contacte o cliente para combinar a criação.
        </p>
      )}
      {p.status === "under_review" ? (
        <>
          <Field label="Data e hora efectiva da transferência (Maputo)">
            <input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </Field>
          <Field label="Nota para o cliente / motivo de recusa">
            <textarea
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explique o que precisa de ser corrigido em caso de recusa."
            />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              Conferi a entrada de {money(p.amount)} na conta, a referência e a
              data da transferência.
            </span>
          </label>
          {error && (
            <p role="alert" className="nx-error">
              {error}
            </p>
          )}
          <div className="nx-actions justify-end">
            <Action secondary busy={saving} onClick={() => act(false)}>
              Recusar com motivo
            </Action>
            <Action busy={saving} onClick={() => act(true)}>
              Aprovar e activar
            </Action>
          </div>
        </>
      ) : (
        <>
          <p className="nx-label">Transferência: {date(p.paidAt)}</p>
          <p className="nx-label">
            Revisto por {p.reviewedBy || "—"} · {date(p.reviewedAt)}
          </p>
          {p.reviewNote && <p>{p.reviewNote}</p>}
        </>
      )}
    </Modal>
  );
}
function CustomerForm({
  close,
  saving,
  post,
}: {
  close: () => void;
  saving: boolean;
  post: PostFn;
}) {
  const [form, setForm] = useState({
      name: "",
      email: "",
      phone: "",
      company: "",
      plan: "Starter",
      paymentMethod: "EMOLA",
      reference: "",
      notes: "",
      paidAt: "",
    }),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState("");
  const plan = NEXSELL_PLANS.find((p) => p.name === form.plan)!;
  return (
    <Modal
      onClose={close}
      title="Adicionar e activar cliente"
      description="Registe um pagamento já conferido. O cliente define a sua própria palavra-passe."
    >
      <form
        className="nx-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const d = new Date(form.paidAt + ":00+02:00");
          if (
            !confirmed ||
            !Number.isFinite(d.getTime()) ||
            d.getTime() > Date.now()
          ) {
            setError("Confirme o recebimento e indique uma data válida.");
            return;
          }
          if (
            await post({
              action: "create_customer",
              ...form,
              amount: plan.monthlyAmount,
              paidAt: d.toISOString(),
            })
          )
            close();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["name", "Nome", "text"],
            ["email", "E-mail de acesso", "email"],
            ["phone", "WhatsApp", "tel"],
            ["company", "Empresa", "text"],
          ].map(([key, label, type]) => (
            <Field key={key} label={label}>
              <input
                required={key !== "company"}
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <Field label="Pacote">
          <select
            value={form.plan}
            onChange={(e) => setForm({ ...form, plan: e.target.value })}
          >
            {NEXSELL_PLANS.map((p) => (
              <option value={p.name} key={p.key}>
                {p.name} — {money(p.monthlyAmount)}/mês
              </option>
            ))}
          </select>
        </Field>
        <Field label="Método">
          <select
            value={form.paymentMethod}
            onChange={(e) =>
              setForm({ ...form, paymentMethod: e.target.value })
            }
          >
            <option value="EMOLA">e-Mola</option>
            <option value="BCI">BCI</option>
            <option>Numerário</option>
            <option>Outro</option>
          </select>
        </Field>
        <Field label="Referência do recebimento">
          <input
            required
            minLength={3}
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />
        </Field>
        <Field label="Data e hora da transferência (Maputo)">
          <input
            required
            type="datetime-local"
            value={form.paidAt}
            onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
          />
        </Field>
        <Field label="Notas internas">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <label className="flex gap-3 text-sm">
          <input
            required
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>Conferi o pagamento de {money(plan.monthlyAmount)}.</span>
        </label>
        <p className="nx-label">
          O cliente deve criar a conta em /login com exactamente este e-mail e
          confirmá-lo. Se já tiver conta, basta entrar. Nenhum e-mail de convite
          será enviado automaticamente.
        </p>
        {error && (
          <p role="alert" className="nx-error">
            {error}
          </p>
        )}
        <Action type="submit" busy={saving}>
          Criar cliente e activar pacote
        </Action>
      </form>
    </Modal>
  );
}
