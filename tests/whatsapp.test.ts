import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { validMetaSignature } from "../lib/meta-webhook";
import { parseSignupMessage } from "../lib/meta-signup-client";
import {
  verifySignupAssets,
  finishMetaRegistration,
  signupConfiguration,
} from "../lib/whatsapp-onboarding";
import {
  POST as signup,
  GET as config,
} from "../app/api/connections/whatsapp/signup/route";
import { POST as webhook } from "../app/api/webhooks/meta/route";
import { POST as send } from "../app/api/webhooks/whatsapp-send/route";
test("eventos do browser exigem origem Meta exacta e formato válido", () => {
  const event = {
    type: "WA_EMBEDDED_SIGNUP",
    event: "FINISH",
    data: { phone_number_id: "123456", waba_id: "987654" },
  };
  assert.equal(
    parseSignupMessage(
      "https://www.facebook.com.evil.test",
      JSON.stringify(event),
    ),
    null,
  );
  assert.equal(parseSignupMessage("https://www.facebook.com", "invalid"), null);
  assert.equal(
    parseSignupMessage("https://www.facebook.com", JSON.stringify(event))
      ?.event,
    "FINISH",
  );
});
test("assinatura Meta é validada sobre o corpo original", () => {
  const body = '{"message":"Olá"}',
    secret = "test-key-only";
  const signature =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(validMetaSignature(body, signature, secret), true);
  assert.equal(validMetaSignature(body + " ", signature, secret), false);
  assert.equal(validMetaSignature(body, null, secret), false);
});
test("rotas de ligação e envio recusam chamadas sem autorização", async () => {
  assert.equal((await config()).status, 401);
  assert.equal(
    (
      await signup(
        new Request("https://test/api/connections/whatsapp/signup", {
          method: "POST",
          headers: { origin: "https://other.test" },
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await signup(
        new Request("https://test/api/connections/whatsapp/signup", {
          method: "POST",
          headers: { origin: "https://test" },
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await webhook(
        new Request("https://test/api/webhooks/meta", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await send(
        new Request("https://test/api/webhooks/whatsapp-send", {
          method: "POST",
        }),
      )
    ).status,
    401,
  );
});
test("token, conta, número e modo são confirmados antes de guardar ligação", async () => {
  const before = { ...process.env },
    original = globalThis.fetch;
  Object.assign(process.env, {
    META_APP_ID: "100001",
    META_APP_SECRET: "test-app-secret",
    META_WHATSAPP_CONFIG_ID: "100002",
    META_GRAPH_VERSION: "v23.0",
    META_VERIFY_TOKEN: "test-verify",
    N8N_WEBHOOK_URL: "https://example.test/n8n",
    N8N_OUTBOUND_SECRET: "test-out",
    N8N_INBOUND_SECRET: "test-in",
    CONNECTIONS_ENCRYPTION_KEY: "a".repeat(64),
  });
  let app = "100001",
    number = "222222",
    businessMode: boolean | undefined = true;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname.endsWith("/debug_token"))
      return Response.json({
        data: {
          is_valid: true,
          app_id: app,
          scopes: [
            "whatsapp_business_management",
            "whatsapp_business_messaging",
          ],
          granular_scopes: [
            { scope: "whatsapp_business_management", target_ids: ["111111"] },
          ],
        },
      });
    if (url.pathname.endsWith("/phone_numbers"))
      return Response.json({
        data: [
          {
            id: number,
            is_on_biz_app: businessMode,
            platform_type: "CLOUD_API",
          },
        ],
      });
    if (
      url.pathname.endsWith("/register") ||
      url.pathname.endsWith("/subscribed_apps")
    )
      return Response.json({ success: true });
    throw new Error("Unexpected request");
  };
  try {
    assert.ok(signupConfiguration());
    assert.equal(
      (await verifySignupAssets("test-token", "111111", "222222")).id,
      "222222",
    );
    app = "999999";
    await assert.rejects(verifySignupAssets("test-token", "111111", "222222"));
    app = "100001";
    await assert.rejects(verifySignupAssets("test-token", "333333", "222222"));
    number = "444444";
    await assert.rejects(verifySignupAssets("test-token", "111111", "222222"));
    number = "222222";
    businessMode = undefined;
    await assert.rejects(verifySignupAssets("test-token", "111111", "222222"));
    calls.length = 0;
    await finishMetaRegistration(
      "test-token",
      "111111",
      "222222",
      true,
      "123456",
    );
    assert.equal(
      calls.some((p) => p.endsWith("/register")),
      false,
    );
    await finishMetaRegistration(
      "test-token",
      "111111",
      "222222",
      false,
      "123456",
    );
    assert.equal(
      calls.some((p) => p.endsWith("/register")),
      true,
    );
    delete process.env.META_APP_SECRET;
    assert.equal(signupConfiguration(), null);
  } finally {
    globalThis.fetch = original;
    for (const name of Object.keys(process.env))
      if (!(name in before)) delete process.env[name];
    Object.assign(process.env, before);
  }
});
