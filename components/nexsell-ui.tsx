"use client";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { ArrowUpRight, LoaderCircle, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
export const money = (amount: number) =>
  new Intl.NumberFormat("pt-MZ", { maximumFractionDigits: 0 }).format(amount) +
  " MT";
export const date = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("pt-MZ", {
        timeZone: "Africa/Maputo",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
export function Brand() {
  return (
    <a href="/" aria-label="NexSell — página inicial" className="nx-brand">
      <span className="nx-mark">
        <Zap size={20} strokeWidth={2.5} />
      </span>
      <span>
        NexSell<span className="nx-brand-period">.</span>
      </span>
    </a>
  );
}
export function Action({
  secondary = false,
  busy = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  secondary?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      disabled={props.disabled || busy}
      className={`nx-button ${secondary ? "nx-secondary" : ""} ${props.className ?? ""}`}
    >
      {busy && <LoaderCircle size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
export function Heading({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="nx-heading">
      <div>
        {eyebrow && <p className="nx-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="nx-description">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="nx-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  open = true,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open?: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className={`nx-modal ${wide ? "sm:max-w-3xl" : ""}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? "Preencha os dados e confirme para guardar."}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
const names: Record<string, string> = {
  active: "Activo",
  trial: "Período de teste",
  suspended: "Suspenso",
  pending: "Pendente",
  under_review: "Em análise",
  paid: "Pago",
  rejected: "Recusado",
  draft: "Rascunho",
  paused: "Pausado",
  ready: "Pronto",
  error: "Erro",
  processing: "A processar",
  approved: "Resolvido",
  ativa: "Activa",
  pausada: "Pausada",
  por_configurar: "Por configurar",
  configurada: "Configurada · por testar",
  verificada: "Verificada",
};
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`nx-status ${["active", "paid", "ready", "approved", "verificada"].includes(value) ? "is-good" : ["error", "rejected", "suspended"].includes(value) ? "is-bad" : ["pending", "under_review", "processing"].includes(value) ? "is-wait" : ""}`}
    >
      {names[value] ?? value}
    </span>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="nx-empty">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Upgrade({
  message = "Esta funcionalidade está disponível num pacote superior.",
}: {
  message?: string;
}) {
  const phone = process.env.NEXT_PUBLIC_SALES_WHATSAPP || "258833837871";
  return (
    <div className="nx-notice">
      <p>{message}</p>
      <a
        href={`https://wa.me/${phone}?text=${encodeURIComponent("Olá, quero subir o meu pacote NexSell.")}`}
        target="_blank"
        rel="noreferrer"
      >
        Subir de pacote <ArrowUpRight size={16} />
      </a>
    </div>
  );
}
