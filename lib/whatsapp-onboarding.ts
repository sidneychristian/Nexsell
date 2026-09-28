import "server-only";
import { createHmac } from "node:crypto";

export function signupConfiguration() {
  const {
    META_APP_ID: appId,
    META_APP_SECRET: secret,
    META_WHATSAPP_CONFIG_ID: configId,
    META_GRAPH_VERSION: version,
    CONNECTIONS_ENCRYPTION_KEY: key,
    META_VERIFY_TOKEN: verifyToken,
    N8N_WEBHOOK_URL: n8n,
    N8N_OUTBOUND_SECRET: outbound,
    N8N_INBOUND_SECRET: inbound,
  } = process.env;
  if (
    !appId ||
    !/^\d+$/.test(appId) ||
    !secret ||
    !configId ||
    !/^\d+$/.test(configId) ||
    !version ||
    !/^v\d+\.\d+$/.test(version) ||
    !key ||
    !/^[a-f\d]{64}$/i.test(key) ||
    !verifyToken ||
    !n8n ||
    !outbound ||
    !inbound
  )
    return null;
  return {
    appId,
    secret,
    configId,
    version,
    coexistence: process.env.META_WHATSAPP_COEXISTENCE === "true",
  };
}
export async function metaRequest<T>(
  path: string,
  token: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const version = process.env.META_GRAPH_VERSION;
  if (!version || !/^v\d+\.\d+$/.test(version))
    throw new Error("A ligação Meta ainda não foi configurada.");
  const url = new URL("https://graph.facebook.com/" + version + "/" + path);
  if (process.env.META_APP_SECRET)
    url.searchParams.set(
      "appsecret_proof",
      createHmac("sha256", process.env.META_APP_SECRET)
        .update(token)
        .digest("hex"),
    );
  const r = await fetch(url, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await r.json().catch(() => null);
  if (!r.ok || result?.error)
    throw new Error(
      "A Meta não concluiu a ligação. Confirme as permissões e os dados na janela da Meta ou contacte a equipa.",
    );
  return result as T;
}
export async function exchangeSignupCode(code: string) {
  const c = signupConfiguration();
  if (!c) throw new Error("Ligação indisponível.");
  // O endpoint oficial exige GET. Nunca registar este URL nem a resposta em logs.
  const url = new URL(
    "https://graph.facebook.com/" + c.version + "/oauth/access_token",
  );
  url.searchParams.set("client_id", c.appId);
  url.searchParams.set("client_secret", c.secret);
  url.searchParams.set("code", code);
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || typeof result?.access_token !== "string")
    throw new Error(
      "A autorização expirou ou foi recusada. Inicie novamente a ligação.",
    );
  return result.access_token as string;
}
export async function verifySignupAssets(
  token: string,
  wabaId: string,
  phoneId: string,
) {
  const c = signupConfiguration();
  if (!c) throw new Error("Ligação indisponível.");
  const debug = await metaRequest<{
    data: {
      app_id: string;
      is_valid: boolean;
      scopes?: string[];
      granular_scopes?: { scope: string; target_ids?: string[] }[];
    };
  }>(
    "debug_token?input_token=" + encodeURIComponent(token),
    c.appId + "|" + c.secret,
  );
  const d = debug.data;
  if (
    !d?.is_valid ||
    String(d.app_id) !== c.appId ||
    !["whatsapp_business_management", "whatsapp_business_messaging"].every(
      (s) => d.scopes?.includes(s),
    )
  )
    throw new Error(
      "Autorize a gestão da conta e o envio de mensagens para continuar.",
    );
  const target = d.granular_scopes?.find(
    (s) => s.scope === "whatsapp_business_management",
  );
  if (!target?.target_ids?.includes(wabaId))
    throw new Error(
      "A conta seleccionada não pertence à autorização recebida.",
    );
  // Não confiar nos IDs enviados pelo postMessage: confirmar pertença pela API.
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const response = await metaRequest<{
      data: {
        id: string;
        display_phone_number?: string;
        is_on_biz_app?: boolean;
        platform_type?: string;
      }[];
      paging?: { next?: string; cursors?: { after?: string } };
    }>(
      wabaId +
        "/phone_numbers?fields=id,display_phone_number,is_on_biz_app,platform_type&limit=100" +
        (after ? "&after=" + encodeURIComponent(after) : ""),
      token,
    );
    const phone = response.data?.find((p) => String(p.id) === phoneId);
    if (phone) {
      if (
        typeof phone.is_on_biz_app !== "boolean" ||
        (phone.is_on_biz_app && phone.platform_type !== "CLOUD_API")
      )
        throw new Error(
          "A Meta ainda não confirmou o modo de ligação do número. Tente novamente após concluir o processo.",
        );
      return phone;
    }
    after = response.paging?.next ? response.paging.cursors?.after : undefined;
    if (!after) break;
  }
  throw new Error("O número seleccionado não pertence à conta autorizada.");
}
export async function finishMetaRegistration(
  token: string,
  wabaId: string,
  phoneId: string,
  isBusinessApp: boolean,
  pin: string,
) {
  const subscribe = await metaRequest<{ success: boolean }>(
    wabaId + "/subscribed_apps",
    token,
    "POST",
    {},
  );
  if (subscribe.success !== true)
    throw new Error("Não foi possível activar a recepção de mensagens.");
  if (isBusinessApp) return null; // Coexistência não usa /register.
  const registered = await metaRequest<{ success: boolean }>(
    phoneId + "/register",
    token,
    "POST",
    { messaging_product: "whatsapp", pin },
  );
  if (registered.success !== true)
    throw new Error("Falta concluir o registo do número na Meta.");
  return pin;
}
