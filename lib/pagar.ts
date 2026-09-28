import { getServerEnv } from "./server-env";

export type PagarMethod = "MPESA" | "EMOLA";
export type PagarStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "CANCELLED"
  | "FAILED"
  | "RECONCILIATION_REQUIRED";

export type PagarPayment = {
  id: string;
  status: PagarStatus;
  reference: string;
  amountMzn?: number;
  method?: PagarMethod;
  safeMessage?: string | null;
  retryAllowed?: boolean;
  receipt?: { number?: string | null; url?: string | null } | null;
};

export class PagarApiError extends Error {
  status: number;
  code?: string;
  safeMessage?: string;
  requestId?: string;
  retryAllowed?: boolean;

  constructor(
    message: string,
    status: number,
    payload: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PagarApiError";
    this.status = status;
    this.code = typeof payload.error === "string" ? payload.error : undefined;
    this.safeMessage =
      typeof payload.safeMessage === "string" ? payload.safeMessage : undefined;
    this.requestId =
      typeof payload.requestId === "string" ? payload.requestId : undefined;
    this.retryAllowed =
      typeof payload.retryAllowed === "boolean"
        ? payload.retryAllowed
        : undefined;
  }
}

function configuration() {
  return {
    baseUrl: (
      getServerEnv("PAGAR_API_BASE_URL") ?? "https://api.pagar.co.mz/api/v1"
    ).replace(/\/$/, ""),
    apiKey: getServerEnv("PAGAR_API_KEY"),
    signingSecret: getServerEnv("PAGAR_SIGNING_SECRET"),
  };
}

export function pagarIsConfigured() {
  const config = configuration();
  return Boolean(config.apiKey && config.signingSecret);
}

function bytesToHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function sha256Hex(value: string) {
  return bytesToHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
}

async function readResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : "Pedido rejeitado pela Pagar.";
    throw new PagarApiError(message, response.status, payload);
  }
  return payload;
}

export async function pagarPost(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey: string,
) {
  const config = configuration();
  if (!config.apiKey || !config.signingSecret)
    throw new PagarApiError("Integração Pagar ainda não configurada.", 503);
  const rawBody = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const url = config.baseUrl + path;
  const canonicalPath = new URL(url).pathname;
  const canonical = [
    timestamp,
    nonce,
    "POST",
    canonicalPath,
    await sha256Hex(rawBody),
  ].join("\n");
  const signature = await hmacHex(config.signingSecret, canonical);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": idempotencyKey,
      "X-Pagar-Timestamp": timestamp,
      "X-Pagar-Nonce": nonce,
      "X-Pagar-Signature": `v1=${signature}`,
    },
    body: rawBody,
  });
  return readResponse(response);
}

export async function pagarGet(path: string) {
  const config = configuration();
  if (!config.apiKey)
    throw new PagarApiError("Integração Pagar ainda não configurada.", 503);
  const response = await fetch(config.baseUrl + path, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
    },
  });
  return readResponse(response);
}

export function extractPagarPayment(
  payload: Record<string, unknown>,
): PagarPayment | null {
  const direct = payload.payment;
  const data = payload.data;
  const nested =
    data && typeof data === "object"
      ? ((data as Record<string, unknown>).payment ?? data)
      : null;
  const candidate = (
    direct && typeof direct === "object" ? direct : nested
  ) as Record<string, unknown> | null;
  if (
    !candidate ||
    typeof candidate.id !== "string" ||
    typeof candidate.reference !== "string"
  )
    return null;
  return candidate as PagarPayment;
}

export function normalizeMozambiquePhone(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("258") && digits.length === 12)
    digits = digits.slice(3);
  return digits;
}

export function mapPagarStatus(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "PAID") return "paid";
  if (normalized === "FAILED") return "failed";
  if (normalized === "CANCELLED") return "cancelled";
  if (normalized === "RECONCILIATION_REQUIRED")
    return "reconciliation_required";
  return "processing";
}

export async function verifyPagarWebhook(
  rawBody: string,
  signatureHeader: string,
) {
  const secret = getServerEnv("PAGAR_WEBHOOK_SECRET");
  if (!secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.trim().split("=")),
  );
  const timestamp = parts.t;
  const received = parts.v1?.toLowerCase();
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    !received ||
    !/^[a-f0-9]{64}$/.test(received)
  )
    return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  if (expected.length !== received.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1)
    mismatch |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  return mismatch === 0;
}
