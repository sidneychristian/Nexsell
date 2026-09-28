import test from "node:test";
import assert from "node:assert/strict";
import { GET as workspace, POST as mutate } from "../app/api/nexsell/route";
import {
  POST as approveProof,
  GET as readProof,
} from "../app/api/billing/proof/route";
import { POST as checkout } from "../app/api/billing/checkout/route";
import { GET as agents } from "../app/api/agents/route";
import { isPlatformAdmin } from "../lib/auth";
test("pedidos sem sessão não podem ler nem alterar dados privados", async () => {
  assert.equal((await workspace()).status, 401);
  assert.equal(
    (
      await mutate(
        new Request("https://test/api/nexsell", {
          method: "POST",
          body: JSON.stringify({ action: "review_payment", approve: true }),
        }),
      )
    ).status,
    401,
  );
  assert.equal((await agents()).status, 401);
  assert.equal(
    (
      await checkout(
        new Request("https://test/api/billing/checkout", { method: "POST" }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await approveProof(
        new Request("https://test/api/billing/proof", { method: "POST" }),
      )
    ).status,
    401,
  );
  assert.equal(
    (await readProof(new Request("https://test/api/billing/proof?id=other")))
      .status,
    403,
  );
});
test("privilégio administrativo exige allowlist do servidor", () => {
  process.env.NEXSELL_ADMIN_EMAILS = "admin@example.test";
  assert.equal(isPlatformAdmin(" ADMIN@example.test "), true);
  assert.equal(isPlatformAdmin("owner@example.test"), false);
  assert.equal(isPlatformAdmin(""), false);
});
