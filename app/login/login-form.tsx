"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { Action, Brand, Field } from "../../components/nexsell-ui";
type Mode = "login" | "signup" | "forgot" | "reset";
export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const m = q.get("mode");
    if (["signup", "forgot", "reset"].includes(m ?? "")) setMode(m as Mode);
    if (q.has("error"))
      setError(
        "Este link expirou ou já foi utilizado. Peça um novo link de recuperação.",
      );
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);
  function change(m: Mode) {
    setMode(m);
    setError("");
    setNotice("");
    setPassword("");
    setConfirm("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (mode === "reset" && password !== confirm) {
      setError("As palavras-passe não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const db = createSupabaseBrowserClient(),
        origin = process.env.NEXT_PUBLIC_SITE_URL || location.origin;
      const next = new URLSearchParams(location.search).get("plan");
      if (mode === "signup") {
        const { data, error } = await db.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: origin + "/auth/callback",
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice(
            "Verifique o seu e-mail para confirmar a conta. Depois, volte a esta página para entrar. Consulte também o spam.",
          );
          setCooldown(60);
          return;
        }
      } else if (mode === "forgot") {
        const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: origin + "/auth/callback?next=/login?mode=reset",
        });
        if (error) throw error;
        setNotice(
          "Se existir uma conta com este e-mail, receberá as instruções de recuperação. Consulte a caixa de entrada e o spam.",
        );
        setCooldown(60);
        return;
      } else if (mode === "reset") {
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user) throw new Error("recovery_expired");
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        setNotice("Palavra-passe actualizada. Já pode entrar.");
        setMode("login");
        setPassword("");
        return;
      } else {
        const { error } = await db.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      location.href =
        next && ["starter", "growth", "scale"].includes(next)
          ? "/?plan=" + next
          : "/";
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : String(reason),
        m = msg.toLowerCase();
      if (m.includes("rate limit") || m.includes("email rate")) {
        setError(
          "O serviço de e-mail atingiu o limite de envios. Não volte a pedir mensagens agora. Se já confirmou a conta, escolha Entrar e use a palavra-passe. Caso contrário, contacte a equipa para verificar o serviço de e-mail.",
        );
        setCooldown(60);
      } else if (m.includes("invalid login"))
        setError(
          "E-mail ou palavra-passe incorrectos. Verifique o endereço ou recupere o acesso.",
        );
      else if (m.includes("email not confirmed"))
        setError("Confirme primeiro a conta no link enviado por e-mail.");
      else if (m.includes("recovery_expired"))
        setError("A sessão de recuperação expirou. Peça um novo link.");
      else if (m.includes("configured") || m.includes("configurado"))
        setError(
          "O acesso ainda não foi configurado. Contacte a equipa NexSell.",
        );
      else
        setError(
          "Não foi possível concluir. Verifique os dados e tente novamente.",
        );
    } finally {
      setBusy(false);
    }
  }
  const title = {
    login: "Bem-vindo de volta.",
    signup: "Crie o seu espaço de vendas.",
    forgot: "Recuperar o acesso.",
    reset: "Escolha uma nova palavra-passe.",
  }[mode];
  return (
    <main className="nx-auth">
      <aside className="nx-auth-story">
        <Brand />
        <h2>
          A próxima conversa.
          <br />O próximo cliente.
        </h2>
        <p>
          Contactos, agentes e oportunidades organizados num único espaço de
          trabalho.
        </p>
      </aside>
      <section className="nx-auth-form">
        <p className="nx-eyebrow">A sua conta NexSell</p>
        <h1>{title}</h1>
        <p className="nx-description">
          {mode === "login"
            ? "Entre com o e-mail que usou no cadastro."
            : mode === "signup"
              ? "Depois de confirmar o e-mail, escolha o pacote e envie o comprovativo."
              : mode === "forgot"
                ? "Enviaremos um link para definir uma nova palavra-passe."
                : "Use pelo menos 8 caracteres."}
        </p>
        <form onSubmit={submit} className="nx-form">
          {mode === "signup" && (
            <Field label="Nome completo">
              <input
                required
                minLength={2}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}
          {mode !== "reset" && (
            <Field label="E-mail">
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.co.mz"
              />
            </Field>
          )}
          {mode !== "forgot" && (
            <Field label="Palavra-passe">
              <div className="relative">
                <input
                  required
                  type={show ? "text" : "password"}
                  minLength={mode === "login" ? 1 : 8}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 48 }}
                />
                <button
                  type="button"
                  aria-label={
                    show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
                  }
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-3"
                >
                  {show ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </Field>
          )}
          {mode === "reset" && (
            <Field label="Confirmar palavra-passe">
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          )}
          {mode === "login" && (
            <button
              type="button"
              className="text-right text-sm text-[#A8C5FF]"
              onClick={() => change("forgot")}
            >
              Esqueci a palavra-passe
            </button>
          )}
          {error && (
            <p className="nx-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="nx-success" role="status">
              {notice}
            </p>
          )}
          <Action
            type="submit"
            busy={busy}
            disabled={cooldown > 0 && ["signup", "forgot"].includes(mode)}
          >
            {cooldown > 0 && ["signup", "forgot"].includes(mode)
              ? "Aguarde " + cooldown + " s"
              : {
                  login: "Entrar",
                  signup: "Criar conta",
                  forgot: "Enviar link de recuperação",
                  reset: "Guardar palavra-passe",
                }[mode]}
          </Action>
        </form>
        <div className="mt-6 text-center text-sm">
          <button
            className="text-[#A8C5FF]"
            onClick={() => change(mode === "login" ? "signup" : "login")}
          >
            {mode === "login"
              ? "Ainda não tem conta? Criar conta"
              : "Já tem conta? Entrar"}
          </button>
        </div>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-2 text-sm text-[#A0ADBF]"
        >
          <ArrowLeft size={15} /> Voltar ao NexSell
        </a>
      </section>
    </main>
  );
}
