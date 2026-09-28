import test from "node:test";
import assert from "node:assert/strict";
import { remainingSeconds, formatCountdown } from "../lib/countdown";
import { PLAN_ACCESS, NEXSELL_PLANS } from "../app/plans";
test("temporizador: 24h, transição de segundo e expiração", () => {
  assert.equal(formatCountdown(86400), "24 : 00 : 00");
  assert.equal(formatCountdown(3599), "00 : 59 : 59");
  assert.equal(remainingSeconds(1000, 1001), 0);
  assert.equal(formatCountdown(-2), "00 : 00 : 00");
  assert.equal(remainingSeconds(1000, 1), 1);
});
test("preços e franquias preservados", () => {
  assert.deepEqual(
    NEXSELL_PLANS.map((p) => p.monthlyAmount),
    [2490, 4990, 8990],
  );
  assert.deepEqual(
    Object.values(PLAN_ACCESS).map((p) => p.limits.agents),
    [1, 2, 5],
  );
  assert.deepEqual(
    Object.values(PLAN_ACCESS).map((p) => p.limits.monthlyAgentMessages),
    [500, 1000, 10000],
  );
});
