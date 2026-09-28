"use client";
export type MetaConfig = {
  appId: string;
  configId: string;
  version: string;
  coexistence: boolean;
};
type SDK = {
  init: (options: Record<string, unknown>) => void;
  login: (
    callback: (result: { authResponse?: { code?: string } }) => void,
    options: Record<string, unknown>,
  ) => void;
};
declare global {
  interface Window {
    FB?: SDK;
  }
}
let loading: Promise<void> | undefined;
export function loadMetaSDK(config: MetaConfig) {
  if (window.FB) {
    window.FB.init({
      appId: config.appId,
      version: config.version,
      cookie: false,
      xfbml: false,
    });
    return Promise.resolve();
  }
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/pt_PT/sdk.js";
      script.async = true;
      script.id = "nexsell-meta-sdk";
      const timer = setTimeout(() => {
        script.remove();
        loading = undefined;
        reject(
          new Error(
            "Não foi possível abrir a Meta. Verifique a ligação ou bloqueadores do navegador.",
          ),
        );
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        if (!window.FB) {
          loading = undefined;
          reject(new Error("A ligação Meta está indisponível."));
          return;
        }
        window.FB.init({
          appId: config.appId,
          version: config.version,
          cookie: false,
          xfbml: false,
        });
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        loading = undefined;
        reject(new Error("Não foi possível carregar a ligação Meta."));
      };
      document.head.appendChild(script);
    });
  return loading;
}
export function parseSignupMessage(origin: string, value: unknown) {
  if (
    !["https://www.facebook.com", "https://web.facebook.com"].includes(origin)
  )
    return null;
  let event;
  try {
    event = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
  if (
    !event ||
    event.type !== "WA_EMBEDDED_SIGNUP" ||
    typeof event.event !== "string"
  )
    return null;
  return event as {
    event: string;
    data?: { phone_number_id?: string; waba_id?: string };
  };
}
// Chamar directamente a partir do clique: não inserir await antes de FB.login.
export function launchSignup(
  config: MetaConfig,
  mode: "cloud" | "business_app",
  signal: AbortSignal,
) {
  return new Promise<{ code: string; phoneId: string; wabaId: string }>(
    (resolve, reject) => {
      let code = "",
        phoneId = "",
        wabaId = "",
        settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener("message", listener);
        signal.removeEventListener("abort", abort);
      };
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(message));
      };
      const finish = () => {
        if (!settled && code && phoneId && wabaId) {
          settled = true;
          cleanup();
          resolve({ code, phoneId, wabaId });
        }
      };
      const listener = (event: MessageEvent) => {
        const result = parseSignupMessage(event.origin, event.data);
        if (!result) return;
        if (result.event === "CANCEL" || result.event === "ERROR") {
          fail("A ligação não foi concluída. Pode tentar novamente.");
          return;
        }
        if (result.event === "FINISH_ONLY_WABA") {
          fail("Seleccione também um número WhatsApp para concluir.");
          return;
        }
        if (
          ["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"].includes(
            result.event,
          )
        ) {
          phoneId = String(result.data?.phone_number_id ?? "");
          wabaId = String(result.data?.waba_id ?? "");
          finish();
        }
      };
      const abort = () => fail("Ligação cancelada.");
      const timer = setTimeout(
        () => fail("A janela de ligação expirou. Inicie novamente."),
        300000,
      );
      window.addEventListener("message", listener);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      if (!window.FB) {
        fail("A Meta ainda não carregou. Tente novamente.");
        return;
      }
      try {
        window.FB.login(
          (result) => {
            code = result.authResponse?.code ?? "";
            if (!code) fail("A autorização não foi concluída.");
            else finish();
          },
          {
            config_id: config.configId,
            response_type: "code",
            override_default_response_type: true,
            extras: {
              setup: {},
              sessionInfoVersion: "3",
              featureType:
                mode === "business_app"
                  ? "whatsapp_business_app_onboarding"
                  : "",
            },
          },
        );
      } catch {
        fail(
          "O navegador não conseguiu abrir a janela. Permita pop-ups para o NexSell.",
        );
      }
    },
  );
}
