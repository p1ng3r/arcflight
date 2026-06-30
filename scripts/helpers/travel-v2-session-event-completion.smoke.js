import { buildTravelV2EventCompletionSummary, completeTravelV2EventOnRunnerSession, TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION } from "./travel-v2-session-event-completion.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 session event completion smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel v2 session event completion smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snapshot(value) { return JSON.stringify(value); }
function sessionFixture(overrides = {}) { return { key: "completion-fixture", status: "active", currentRoundIndex: 0, event: { rounds: [{ roundNumber: 1, title: "One" }, { roundNumber: 2, title: "Two" }] }, ...overrides }; }

export function runTravelV2SessionEventCompletionSmokeChecks() {
  assertEqual(TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION, 1, "helper should export version");
  assertEqual(typeof completeTravelV2EventOnRunnerSession, "function", "helper should export function");
  assertEqual(typeof buildTravelV2EventCompletionSummary, "function", "helper should export summary builder");

  const missing = completeTravelV2EventOnRunnerSession(null);
  assertSmoke(!missing.ok && !missing.completed, "missing session blocks");

  const notReady = sessionFixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1 }] } });
  const notReadyBefore = snapshot(notReady);
  const blocked = completeTravelV2EventOnRunnerSession(notReady, { now: "2026-06-20T00:00:00.000Z" });
  assertSmoke(!blocked.ok && !blocked.completed, "not-ready event blocks");
  assertEqual(snapshot(notReady), notReadyBefore, "blocked event should not mutate input");
  assertSmoke(blocked.blockedReasons.includes("Travel v2 event has pending round finalizations."), "blocked event should explain pending rounds");

  const already = completeTravelV2EventOnRunnerSession(sessionFixture({ status: "completed", completedAt: "2026-06-19T00:00:00.000Z" }));
  assertSmoke(!already.ok && already.blockedReasons.includes("Travel v2 runner session is already completed."), "already completed session blocks");

  const ready = sessionFixture({ roundResults: [{ stationResults: { helm: "success", engineer: "criticalFailure" } }, { stationResults: { scout: "success" } }], travelV2PressureApplications: { records: [{ roundIndex: 0, roundNumber: 1, totalsByPressureType: { hull: 1, strain: 2 } }] }, travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1, effectiveOutcomeKey: "success" }, { roundIndex: 1, roundNumber: 2, effectiveOutcomeKey: "failure" }] }, travelV2PendingConsequenceQueue: { records: [{ queueKey: "q1", status: "applied" }, { queueKey: "q2", status: "dismissed" }] }, travelV2ConsequenceApplicationHistory: { records: [{ queueKey: "q1", mutation: "session-pressure-only", resource: "hull", delta: 1, beforeValue: 1, afterValue: 2 }] } });
  const readyBefore = snapshot(ready);
  const summary = buildTravelV2EventCompletionSummary(ready, { now: "2026-06-20T01:00:00.000Z" });
  assertEqual(summary.eventTitle, "Travel Event", "summary has event title fallback");
  assertEqual(summary.totalRounds, 2, "summary has total rounds");
  assertEqual(summary.completedRoundCount, 2, "summary has completed round count");
  assertEqual(summary.totals.stationsResolved, 3, "summary counts station results");
  assertEqual(summary.totals.criticalFailures, 1, "summary counts critical failures");
  assertEqual(summary.totals.resourceDeltas.hull, 2, "summary aggregates hull pressure and applied consequence deltas");
  assertEqual(summary.totals.consequencesApplied, 1, "summary dedupes applied queue and history records by queue key");
  assertEqual(summary.totals.consequencesDismissed, 1, "summary counts dismissed consequences");
  const completed = completeTravelV2EventOnRunnerSession(ready, { now: "2026-06-20T01:02:03.000Z" });
  assertSmoke(completed.ok && completed.completed, "ready event completes");
  assertSmoke(completed.session !== ready, "successful completion returns cloned session");
  assertEqual(snapshot(ready), readyBefore, "successful completion should not mutate original");
  assertEqual(completed.session.status, "completed", "completed clone has completed status");
  assertEqual(completed.session.completedAt, "2026-06-20T01:02:03.000Z", "completed clone has timestamp");
  assertSmoke(completed.session.travelV2RoundResolutions.records.length === 2, "round finalization records are preserved");
  assertSmoke(completed.session.travelV2EventCompletion.completed, "completion record exists");
  assertSmoke(completed.session.travelV2CompletionSummary && completed.summary, "completion stores final summary");
  assertEqual(completed.session.travelV2EventCompletion.finalizedRoundCount, 2, "completion record has finalized count");
  assertEqual(completed.session.travelV2EventCompletion.eventRoundCount, 2, "completion record has total count");

  const duplicate = completeTravelV2EventOnRunnerSession(completed.session, { now: "2026-06-20T02:00:00.000Z" });
  assertSmoke(!duplicate.ok && !duplicate.completed, "duplicate completion blocks");
  assertEqual(completed.session.travelV2EventCompletion.completedAt, "2026-06-20T01:02:03.000Z", "duplicate completion does not append or replace record");

  return { ok: true, checked: ["exports", "missing-session-blocks", "not-ready-blocks", "already-completed-blocks", "summary-builder", "ready-completes", "clone-and-timestamp", "record-counts", "stored-summary", "original-not-mutated", "duplicate-blocks"] };
}

export default runTravelV2SessionEventCompletionSmokeChecks;
