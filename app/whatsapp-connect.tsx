"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Action, Modal, Field } from "../components/nexsell-ui";
import {
  launchSignup,
  loadMetaSDK,
  type MetaConfig,
} from "../lib/meta-signup-client";
export function MetaWhatsAppConnect({
  close,
  done,
}: {
  close: () => void;
  done: () => void;
}) {
  const [config, setConfig] = useState<MetaConfig | null>(null),
    [session, setSession] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [available, setAvailable] = useState(true),
    [mode, setMode] = useState<"cloud" | "business_app">("cloud"),
    [number, setNumber] = useState(""),
    [phase, setPhase] = useState<"meta" | "save">("meta");
  const controller = useRef<AbortController | null>(null);
  async function prepare() {
    setLoading(true);
    setError("");
    setSession("");
    try {
      const r = await fetch("/api/connections/whatsapp/signup", {
          cache: "no-store",
        }),
        c = await r.json();
      if (!r.ok) throw new Error(c.error);
      setAvailable(c.available);
      if (!c.available) return;
      await loadMetaSDK(c);
      const start = await fetch("/api/connections/whatsapp/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "begin" }),
        }),
        s = await start.json();
      if (!start.ok) throw new Error(s.error);
      setConfig(c);
      setSession(s.sessionId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível preparar a ligação.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    prepare();
    return () => controller.current?.abort();
  }, []);
  function connect() {
    if (!config || !session) return;
    setError("");
    setBusy(true);
    setPhase("meta");
    controller.current = new AbortController();
    launchSignup(config, mode, controller.current.signal)
      .then(async (result) => {
        setPhase("save");
        const r = await fetch("/api/connections/whatsapp/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "complete",
              sessionId: session,
              ...result,
            }),
          }),
          j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setNumber(j.number || "Número autorizado");
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Não foi possível ligar."),
      )
      .finally(() => {
        setBusy(false);
        setSession("");
      });
  }
  return (
    <Modal
      onClose={busy ? () => {} : close}
      title="Ligar o seu WhatsApp"
      description="Autorize a ligação na janela segura da Meta. Não precisa de copiar chaves ou tokens."
    >
      {number ? (
        <div className="nx-success">
          <CheckCircle2 size={28} />
          <h2 className="text-xl mt-4">WhatsApp ligado</h2>
          <p className="mt-2">{number}</p>
          <p className="mt-3">
            O número foi associado à empresa. Configure o agente e confirme com
            a equipa os fluxos de atendimento antes de activar respostas
            automáticas.
          </p>
          <Action className="mt-5" onClick={done}>
            Concluir
          </Action>
        </div>
      ) : (
        <div className="nx-form">
          <ol className="space-y-4 text-sm">
            <li>1. Entre na conta Meta que gere a sua empresa.</li>
            <li>2. Escolha a empresa e o número WhatsApp.</li>
            <li>3. Confirme as permissões e termine os passos apresentados.</li>
          </ol>
          {config?.coexistence && (
            <Field label="Como utiliza este número?">
              <select
                value={mode}
                disabled={busy}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="cloud">Número para a plataforma WhatsApp</option>
                <option value="business_app">
                  Já uso o WhatsApp Business no telemóvel
                </option>
              </select>
            </Field>
          )}
          {mode === "business_app" && (
            <p className="nx-notice">
              A Meta verificará se o seu número pode continuar no aplicativo e
              ligar-se ao NexSell. Siga a confirmação por código ou QR
              apresentada pela Meta.
            </p>
          )}
          {!available && (
            <p className="nx-notice">
              A ligação guiada ainda está a ser preparada pela equipa NexSell.
              Contacte-nos para acompanhar a activação.
            </p>
          )}
          {error && (
            <p className="nx-error" role="alert">
              {error}
            </p>
          )}
          {available &&
            (session ? (
              <Action busy={busy} onClick={connect}>
                <MessageCircle size={18} />
                {busy
                  ? phase === "meta"
                    ? "Conclua na janela da Meta"
                    : "A confirmar ligação"
                  : "Continuar com a Meta"}
                <ArrowUpRight size={16} />
              </Action>
            ) : (
              <Action secondary busy={loading} onClick={prepare}>
                {loading ? "A preparar ligação" : "Preparar nova tentativa"}
              </Action>
            ))}
          {busy && phase === "meta" && (
            <Action secondary onClick={() => controller.current?.abort()}>
              Cancelar ligação
            </Action>
          )}
          {busy && (
            <p className="nx-label" role="status">
              Mantenha esta página aberta. Se a janela não apareceu, permita
              pop-ups neste site.
            </p>
          )}
          <p className="nx-label flex gap-2">
            <ShieldCheck size={18} className="shrink-0" />O NexSell nunca pede a
            sua palavra-passe do Facebook nem o PIN do WhatsApp neste
            formulário.
          </p>
          <a
            className="text-sm text-[#A8C5FF]"
            href="https://wa.me/258833837871"
            target="_blank"
            rel="noreferrer"
          >
            Precisa de ajuda? Fale com a equipa.
          </a>
        </div>
      )}
    </Modal>
  );
}
