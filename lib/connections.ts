import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
function key() {
  const value = process.env.CONNECTIONS_ENCRYPTION_KEY ?? "";
  if (!/^[a-f\d]{64}$/i.test(value))
    throw new Error("O armazenamento seguro de conexões não foi configurado.");
  return Buffer.from(value, "hex");
}
export function encryptConnection(value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), body]
    .map((v) => v.toString("base64"))
    .join(".");
}
export function decryptConnection(value: string) {
  const [iv, tag, body] = value.split(".").map((v) => Buffer.from(v, "base64")),
    cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(body), cipher.final()]).toString("utf8"),
  ) as { token: string; phoneNumberId: string; registrationPin?: string };
}
export async function whatsappConnection(organizationId: string) {
  const { data } = await createAdminClient()
    .from("connection_secrets")
    .select("encrypted_value")
    .eq("organization_id", organizationId)
    .eq("provider", "whatsapp")
    .maybeSingle()
    .throwOnError();
  if (data) return decryptConnection(data.encrypted_value);
  if (
    process.env.NEXSELL_ORGANIZATION_ID === organizationId &&
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  )
    return {
      token: process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    };
  return null;
}
