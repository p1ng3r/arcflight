import test from "node:test";
import assert from "node:assert/strict";
import { createDeterministicPendingCheckExecutor, EVENT_TEST_DEGREES } from "../../../scripts/voyage/testing/event-test-executor.js";

const pending = {
  status: "pending",
  mode: "check",
  pendingCheckId: "pending-1",
  sequence: 0,
  finalDc: 18,
  source: { kind: "character", uuid: "Actor.captain" },
  statisticSlugOrAbilityId: "diplomacy",
  secrecy: "public"
};

test("deterministic executor exposes only canonical degrees and normalized result fields", async () => {
  assert.deepEqual(EVENT_TEST_DEGREES, ["critical-failure", "failure", "success", "critical-success"]);
  for (const degree of EVENT_TEST_DEGREES) {
    const result = await createDeterministicPendingCheckExecutor({ degree })(pending);
    assert.equal(result.ok, true);
    assert.equal(result.status, "rolled");
    assert.equal(result.result.degreeOfSuccessSlug, degree);
    assert.equal(result.result.degreeOfSuccess, EVENT_TEST_DEGREES.indexOf(degree));
    assert.equal(result.pendingCheckId, pending.pendingCheckId);
    assert.equal(result.sourceUuid, pending.source.uuid);
    assert.equal(result.statisticSlug, pending.statisticSlugOrAbilityId);
    assert.equal(result.dc, pending.finalDc);
  }
});

test("deterministic executor rejects unsupported degrees and malformed pending checks", async () => {
  assert.equal(createDeterministicPendingCheckExecutor({ degree: 2 }), null);
  assert.equal((await createDeterministicPendingCheckExecutor({ degree: "success" })({ ...pending, finalDc: -1 })).ok, false);
});
