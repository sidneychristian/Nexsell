import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
export function validMetaSignature(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!secret || !signature || !/^sha256=[a-f\d]{64}$/i.test(signature))
    return false;
  const expected = createHmac("sha256", secret).update(raw).digest(),
    actual = Buffer.from(signature.slice(7), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
