import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createSuiteRegistry, QUICK_CHECK_SUITE_ID, RESOLUTION_SUITE_IDS } from "../../../scripts/voyage/testing/event-test-suite-registry.js";
import { createTestRunner } from "../../../scripts/voyage/testing/event-test-runner.js";
import { buildStructuralDiff } from "../../../scripts/voyage/testing/event-test-diff.js";
import { createInvariantEngine } from "../../../scripts/voyage/testing/event-test-invariants.js";
import { copyTestLabText, formatTestLabAllResults, formatTestLabFailureBundle, formatTestLabPreparedFixture, formatTestLabRunSummary, formatTestLabStepEvidence, normalizeTestLabEvents, normalizeTestLabShips, resolutionControlAvailability, testLabCopyAvailability } from "../../../scripts/voyage/testing/event-test-lab.js";

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

test("Pass 3 resolution suites are enabled and expose canonical execution controls", () => {
  const registry = createSuiteRegistry();
  const suites = RESOLUTION_SUITE_IDS.map((id) => registry.find((entry) => entry.id === id));
  assert.equal(suites.every((suite) => suite?.enabled === true && suite?.lane === "ENGINE"), true);
  assert.deepEqual(suites.map((suite) => suite.id), RESOLUTION_SUITE_IDS);
  assert.equal(suites.every((suite) => suite.tests[0]?.id === "prepared-fixture" && suite.tests[1]?.id === "start-resolution"), true);
  const planLocked = { session: { sessionState: "plan-locked", phase: "lock-readiness" } };
  const active = { session: { sessionState: "station-resolution", phase: "resolution" }, planning: { committedStationOrder: ["captain"] }, resolution: { pendingChecks: [{ stationId: "captain", status: "pending" }] } };
  assert.equal(resolutionControlAvailability({ retainedSessionId: "fixture-1", steps: [{ afterSnapshot: planLocked }] }, { sessionId: "fixture-1" }).startResolution, true);
  assert.equal(resolutionControlAvailability({ retainedSessionId: "fixture-1", steps: [{ afterSnapshot: active }] }, { sessionId: "fixture-1" }).runCurrentStation, true);
  assert.equal(resolutionControlAvailability({ retainedSessionId: "fixture-1", steps: [{ afterSnapshot: active }] }, { sessionId: "fixture-1" }).runAllStations, true);
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

test("step evidence export includes available fields and omits empty values", () => {
  const step = {
    stepId: "plan-lock",
    label: "Build and lock plan",
    status: "PASS",
    expected: "plan-locked checkpoint",
    actual: "plan-locked",
    errorCode: null,
    errorPath: null,
    errorMessage: null,
    revisionBefore: 9,
    revisionAfter: 10,
    durationMs: 12,
    commandSummary: "Canonical authored plan locked.",
    writes: 5,
    afterSnapshot: { session: { sessionState: "plan-locked" }, planning: { assignments: [{ stationId: "captain", operator: { name: "Aster" } }], selections: { captain: { actionId: "command-opening", approachId: "command-opening-approach" } } } },
    invariantResults: [{ status: "PASS", label: "Exact checkpoint" }],
    diff: [{ kind: "changed", path: "session.revision" }]
  };
  const output = formatTestLabStepEvidence(step);
  assert.match(output, /STEP: Build and lock plan/);
  assert.match(output, /STATUS: PASS/);
  assert.match(output, /REVISION BEFORE: 9/);
  assert.match(output, /MESSAGE: Canonical authored plan locked\./);
  assert.doesNotMatch(output, /ERROR MESSAGE:/);
  assert.match(output, /ASSIGNMENTS:\n- captain — Aster/);
  assert.match(output, /SELECTED ACTIONS:\n- captain — command-opening \/ command-opening-approach/);
  assert.match(output, /INVARIANTS:\n- PASS — Exact checkpoint/);
  assert.match(output, /NORMALIZED DIFF:\n- changed — session\.revision/);
  assert.doesNotMatch(output, /ERROR CODE:/);
  assert.equal(output, formatTestLabStepEvidence(structuredClone(step)));
});

test("failed step evidence retains error labels while empty error fields stay omitted", () => {
  const output = formatTestLabStepEvidence({ label: "Start session", status: "FAIL", errorCode: "m12-active-session-conflict", errorPath: "sessionId", errorMessage: "An active session already exists." });
  assert.match(output, /ERROR CODE: m12-active-session-conflict/);
  assert.match(output, /ERROR PATH: sessionId/);
  assert.match(output, /ERROR MESSAGE: An active session already exists\./);
  assert.doesNotMatch(output, /^MESSAGE:/m);
  assert.doesNotMatch(output, /REVISION BEFORE:/);
});

test("run summary export names the suite and deterministic fixture policy separately", () => {
  const run = { suiteId: "fixture-prep", runId: "run-1", fixture: { profileId: "canonical-first-valid" }, profile: { suiteId: "fixture-prep", eventId: "event-1", shipId: "ship-1" }, summary: { status: "PASSED", passed: 3, failed: 0, skipped: 0, warnings: 0, total: 3 }, retainedSessionId: "session-1", steps: [{ label: "Authority", status: "PASS" }, { label: "Plan Lock", status: "PASS" }] };
  const output = formatTestLabRunSummary(run);
  assert.match(output, /ARCFLIGHT TEST LAB — RUN SUMMARY/);
  assert.match(output, /Suite: fixture-prep/);
  assert.match(output, /Fixture Policy: canonical-first-valid/);
  assert.doesNotMatch(output, /Profile: fixture-prep/);
  assert.match(output, /Status: PASSED/);
  assert.match(output, /Pass: 3/);
  assert.match(output, /Total: 3/);
  assert.match(output, /1\. Authority — PASS/);
  assert.match(output, /2\. Plan Lock — PASS/);
  assert.equal(output, formatTestLabRunSummary(structuredClone(run)));
});

test("prepared fixture export includes checkpoint identity, assignments, selections, and invariants", () => {
  const fixture = { eventId: "event-1", shipName: "Cinderwake", shipId: "ship-1", sessionId: "session-1", roundId: "round-1", sessionState: "plan-locked", phase: "lock-readiness", revision: 10, profileId: "canonical-first-valid", runId: "run-1", testOrigin: { kind: "arcflight-event-test" }, assignments: [{ stationLabel: "CAPTAIN", operatorName: "Aster" }], selections: { captain: { actionId: "command-opening", approachId: "diplomacy" } } };
  const output = formatTestLabPreparedFixture(fixture, { steps: [{ stepId: "fixture-invariants", invariantResults: [{ status: "PASS", label: "Checkpoint" }] }] });
  assert.match(output, /Session: session-1/);
  assert.match(output, /Session State: plan-locked/);
  assert.match(output, /Phase: lock-readiness/);
  assert.match(output, /Fixture Policy: canonical-first-valid/);
  assert.doesNotMatch(output, /Profile:/);
  assert.match(output, /Assignments:\n- CAPTAIN — Aster/);
  assert.match(output, /Selected Actions:\n- captain — command-opening \/ diplomacy/);
  assert.match(output, /Invariant Summary:\n- PASS — Checkpoint/);
});

test("copy actions handle clipboard failure safely and perform no gameplay writes", async () => {
  let warnings = 0;
  let updates = 0;
  const result = await copyTestLabText("diagnostic", {
    navigatorValue: { clipboard: { writeText: async () => { throw new Error("denied"); } } },
    documentValue: {},
    gameValue: { ui: { notifications: { warn: () => { warnings += 1; } } }, update: () => { updates += 1; } }
  });
  assert.equal(result, false);
  assert.equal(warnings, 1);
  assert.equal(updates, 0);
});

test("copy availability disables actions when corresponding Test Lab data is absent", () => {
  assert.deepEqual(testLabCopyAvailability(), { stepEvidence: false, runSummary: false, preparedFixture: false, allResults: false, failureBundle: false });
  assert.deepEqual(testLabCopyAvailability({ run: { steps: [] }, evidence: { stepId: "authority" }, fixture: { sessionId: "session-1" } }), { stepEvidence: true, runSummary: true, preparedFixture: true, allResults: true, failureBundle: false });
  assert.match(formatTestLabAllResults({ suiteId: "quick-check", summary: { status: "IDLE", passed: 0, failed: 0, skipped: 0, warnings: 0, total: 0 }, steps: [] }), /ARCFLIGHT TEST LAB — RUN SUMMARY/);
});

test("combined export propagates informational and fixture-policy labels without ambiguity", () => {
  const run = { suiteId: "fixture-prep", runId: "run-1", fixture: { profileId: "canonical-first-valid" }, profile: { suiteId: "fixture-prep", eventId: "event-1", shipId: "ship-1" }, summary: { status: "PASSED", passed: 1, failed: 0, skipped: 0, warnings: 0, total: 1 }, steps: [{ label: "Plan Lock", status: "PASS", commandSummary: "Plan locked." }] };
  const output = formatTestLabAllResults(run, { profileId: "canonical-first-valid", sessionId: "session-1" }, run.steps[0]);
  assert.match(output, /MESSAGE: Plan locked\./);
  assert.doesNotMatch(output, /ERROR MESSAGE:/);
  assert.match(output, /Suite: fixture-prep/);
  assert.match(output, /Fixture Policy: canonical-first-valid/);
  assert.doesNotMatch(output, /Profile: fixture-prep/);
  assert.equal(output, formatTestLabAllResults(structuredClone(run), { profileId: "canonical-first-valid", sessionId: "session-1" }, structuredClone(run.steps[0])));
});

test("prepared fixture copy control renders in the retained-session action row", () => {
  const template = readFileSync(new URL("../../../templates/voyage/event-test-lab.hbs", import.meta.url), "utf8");
  const availability = testLabCopyAvailability({ fixture: { sessionId: "prepared-session" } });
  assert.equal(availability.preparedFixture, true);
  assert.match(template, /\{\{#if copyAvailability\.preparedFixture\}\}[\s\S]*data-action="copyPreparedFixture"[\s\S]*COPY PREPARED FIXTURE[\s\S]*\{\{\/if\}\}/);
  assert.match(template, /data-action="cleanupRetainedFixture"/);
});

test("Pass 3 failure bundle preserves retained checkpoint and canonical error evidence", () => {
  const step = { stepId: "resolution-run", label: "RUN CURRENT STATION", status: "FAIL", expected: "station resolution", actual: "reaction-required", errorCode: "m11-command-not-allowed", errorPath: "reactionWindow", errorMessage: "An open reaction window must be handled first.", afterSnapshot: { session: { sessionState: "station-resolution", phase: "resolution", revision: 12 } } };
  const run = { ok: false, retainedSessionId: "fixture-1", profile: { sessionId: "fixture-1" }, summary: { failed: 1 }, steps: [step] };
  const output = formatTestLabFailureBundle(run, { sessionId: "fixture-1", sessionState: "station-resolution" }, step);
  assert.match(output, /ARCFLIGHT TEST LAB \u2014 FAILURE BUNDLE/);
  assert.match(output, /Session: fixture-1/);
  assert.match(output, /Error Code: m11-command-not-allowed/);
  assert.match(output, /Error Path: reactionWindow/);
  assert.match(output, /Error Message: An open reaction window must be handled first./);
  assert.equal(output, formatTestLabFailureBundle(structuredClone(run), structuredClone({ sessionId: "fixture-1", sessionState: "station-resolution" }), structuredClone(step)));
});

test("Pass 3 resolution controls are present in the Test Lab template", () => {
  const template = readFileSync(new URL("../../../templates/voyage/event-test-lab.hbs", import.meta.url), "utf8");
  for (const action of ["start-resolution", "run-current-station", "pass-current-reaction", "run-next-station", "run-all-stations"]) assert.match(template, new RegExp(`data-resolution-action="${action}"`));
  assert.match(template, /data-selector="degree-profile"/);
  assert.match(template, /data-selector="reaction-mode"/);
  assert.match(template, /REACTION BEFORE/);
  assert.match(template, /REACTION AFTER/);
});
