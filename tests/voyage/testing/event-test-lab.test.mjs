import test from "node:test";
import assert from "node:assert/strict";

import { createSuiteRegistry, QUICK_CHECK_SUITE_ID } from "../../../scripts/voyage/testing/event-test-suite-registry.js";
import { createTestRunner } from "../../../scripts/voyage/testing/event-test-runner.js";
import { buildStructuralDiff } from "../../../scripts/voyage/testing/event-test-diff.js";
import { createInvariantEngine } from "../../../scripts/voyage/testing/event-test-invariants.js";
import { normalizeTestLabEvents, normalizeTestLabShips } from "../../../scripts/voyage/testing/event-test-lab.js";

const fakeContext = {
  authenticatedUserId: "gm-1",
  activeGmUserId: "gm-1",
  users: [{ id: "gm-1", isGM: true, active: true }],
  game: { user: { id: "gm-1", isGM: true, active: true } },
  eventDefinitions: [{ eventId: "m12-glassback-cinderwake", title: "Glassback Cinderwake" }],
  ships: [{ id: "ship-1", name: "Cinderwake", type: "vehicle", getFlag: () => true }],
  eventTest: {
    listEvents: async () => ({ ok: true, events: [{ eventId: "m12-glassback-cinderwake", title: "Glassback Cinderwake" }] }),
    listShips: async () => ({ ok: true, ships: [{ id: "ship-1", name: "Cinderwake" }] }),
    start: async () => ({ ok: true, sessionId: "test-session-1", revision: 4, status: "started", snapshot: { session: { sessionId: "test-session-1", revision: 4, eventId: "m12-glassback-cinderwake", authorityEpoch: 1, sessionState: "round-introduction", encounterState: { pressureSystems: { "hull-integrity": { pressureSystemId: "hull-integrity", value: 1, capacity: 10 }, "crew-sanity": { pressureSystemId: "crew-sanity", value: 0, capacity: 8 } }, hazards: [], metadata: { testOrigin: { kind: "arcflight-event-test", createdByUserId: "gm-1", createdAt: "2026-08-22T00:00:00.000Z" } } } } } }),
    inspect: async () => ({ ok: true, sessionId: "test-session-1", revision: 4, snapshot: { session: { sessionId: "test-session-1", revision: 4, eventId: "m12-glassback-cinderwake", authorityEpoch: 1, sessionState: "round-introduction", encounterState: { pressureSystems: { "hull-integrity": { pressureSystemId: "hull-integrity", value: 1, capacity: 10 }, "crew-sanity": { pressureSystemId: "crew-sanity", value: 0, capacity: 8 } }, hazards: [], metadata: { testOrigin: { kind: "arcflight-event-test", createdByUserId: "gm-1", createdAt: "2026-08-22T00:00:00.000Z" } } } } } }),
    abandon: async () => ({ ok: true, sessionId: "test-session-1", deleted: true })
  }
};

test("suite registry loads Quick Check and future disabled suites", () => {
  const registry = createSuiteRegistry();
  const quickCheck = registry.find((entry) => entry.id === QUICK_CHECK_SUITE_ID);
  assert.ok(quickCheck);
  assert.equal(quickCheck.enabled, true);
  assert.equal(quickCheck.lane, "ENGINE");
  assert.equal(quickCheck.tests.length > 0, true);
  const future = registry.find((entry) => entry.id === "pressure");
  assert.ok(future);
  assert.equal(future.enabled, false);
});

test("runner creates runId and returns PASS for a successful suite", async () => {
  const registry = createSuiteRegistry();
  const runner = createTestRunner({ registry, context: fakeContext });
  const run = await runner.run({ suiteId: QUICK_CHECK_SUITE_ID, lane: "ENGINE" });
  assert.equal(run.ok, true);
  assert.equal(run.runId.length > 0, true);
  assert.equal(run.summary.status, "PASSED");
  assert.equal(run.summary.passed, run.steps.length);
});

test("diff records changed, added, and removed paths deterministically", () => {
  const diff = buildStructuralDiff({ session: { revision: 4, pressure: { hull: 1 } } }, { session: { revision: 5, pressure: { hull: 1, sanity: 0 } } });
  assert.ok(diff.some((entry) => entry.path === "session.revision" && entry.kind === "changed"));
  assert.ok(diff.some((entry) => entry.path === "session.pressure.sanity" && entry.kind === "added"));
  assert.equal(diff.filter((entry) => entry.kind === "removed").length, 0);
});

test("invariant engine reports PASS and FAIL results", async () => {
  const engine = createInvariantEngine();
  const report = await engine.run([
    { id: "revision-valid", label: "Revision valid", check: () => ({ ok: true, expected: 4, actual: 4 }) },
    { id: "pressure-valid", label: "Pressure valid", check: () => ({ ok: false, expected: "within capacity", actual: "overflow", message: "Pressure overflow" }) }
  ]);
  assert.equal(report.results[0].status, "PASS");
  assert.equal(report.results[1].status, "FAIL");
  assert.equal(report.summary.failed, 1);
});

test("GM access guard rejects non-GM without mutating state", async () => {
  const registry = createSuiteRegistry();
  const runner = createTestRunner({ registry, context: { ...fakeContext, game: { user: { id: "player-1", isGM: false, active: true } }, authenticatedUserId: "player-1" } });
  const run = await runner.run({ suiteId: QUICK_CHECK_SUITE_ID, lane: "ENGINE" });
  assert.equal(run.ok, false);
  assert.equal(run.summary.status, "FAILED");
  assert.equal(run.steps[0].status, "FAIL");
});

test("Test Lab selectors retain canonical identities and remove duplicate discovery rows", () => {
  assert.deepEqual(normalizeTestLabEvents({ ok: true, events: [
    { eventId: "event-1", title: "First" },
    { eventId: "event-1", title: "Duplicate" },
    { eventId: "", title: "Invalid" }
  ] }).map((entry) => [entry.eventId, entry.label]), [["event-1", "First"]]);
  assert.deepEqual(normalizeTestLabShips({ ok: true, ships: [
    { id: "ship-1", name: "Cinderwake" },
    { id: "ship-1", name: "Duplicate" },
    { id: "", name: "Invalid" }
  ] }).map((entry) => [entry.id, entry.label]), [["ship-1", "Cinderwake"]]);
});

test("runner derives normalized diff evidence from step snapshots", async () => {
  const registry = [{ id: QUICK_CHECK_SUITE_ID, lane: "ENGINE", tests: [
    { id: "snapshot", label: "Snapshot", run: async () => ({ ok: true, beforeSnapshot: { revision: 1 }, afterSnapshot: { revision: 2 } }) }
  ] }];
  const run = await createTestRunner({ registry, context: fakeContext }).run({ suiteId: QUICK_CHECK_SUITE_ID });
  assert.deepEqual(run.steps[0].diff, [{ path: "revision", kind: "changed", before: 1, after: 2 }]);
});
