import {
  prepareTravelV2EventCompletionReadiness,
  TRAVEL_V2_EVENT_COMPLETION_READINESS_VERSION
} from "./travel-v2-event-completion-readiness.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 event completion readiness smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`Travel v2 event completion readiness smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
}

function snapshot(value) {
  return JSON.stringify(value);
}

function sessionFixture(overrides = {}) {
  return {
    status: "active",
    currentRoundIndex: 0,
    event: {
      rounds: [
        { roundNumber: 1, title: "First" },
        { roundNumber: 2, title: "Final" }
      ]
    },
    ...overrides
  };
}

export function runTravelV2EventCompletionReadinessSmokeChecks() {
  assertEqual(TRAVEL_V2_EVENT_COMPLETION_READINESS_VERSION, 1, "helper version should be 1");
  assertEqual(typeof prepareTravelV2EventCompletionReadiness, "function", "helper should export function");

  const empty = prepareTravelV2EventCompletionReadiness(null);
  assertSmoke(!empty.eventReady && !empty.canCompleteEvent, "null session should not be ready");
  assertSmoke(empty.blockedReasons.includes("No active Travel v2 runner session."), "null session should explain block");

  const completed = prepareTravelV2EventCompletionReadiness(sessionFixture({ status: "completed" }));
  assertSmoke(!completed.eventReady, "completed session should not be ready");
  assertSmoke(completed.blockedReasons.includes("Travel v2 runner session is already completed."), "completed session should explain block");

  const noRounds = prepareTravelV2EventCompletionReadiness(sessionFixture({ event: { rounds: [] } }));
  assertSmoke(!noRounds.eventReady, "no-round event should not be ready");
  assertSmoke(noRounds.blockedReasons.includes("Travel v2 event has no rounds."), "no-round event should explain block");

  const noneFinalized = prepareTravelV2EventCompletionReadiness(sessionFixture());
  assertEqual(noneFinalized.pendingRoundCount, 2, "missing records should leave all rounds pending");

  const someFinalized = prepareTravelV2EventCompletionReadiness(sessionFixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1, effectiveOutcomeKey: "success" }] } }));
  assertSmoke(!someFinalized.eventReady, "some finalized should not be ready");
  assertEqual(someFinalized.pendingRounds[0].roundIndex, 1, "some finalized should list pending final round");
  assertSmoke(someFinalized.blockedReasons.includes("Final Travel v2 round is not finalized."), "unfinalized final round should block");

  const allFinalized = prepareTravelV2EventCompletionReadiness(sessionFixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1 }, { roundIndex: 1, roundNumber: 2, effectiveOutcomeKey: "mixed" }] } }));
  assertSmoke(allFinalized.eventReady && allFinalized.canCompleteEvent, "all finalized rounds should be event-ready");
  assertEqual(allFinalized.finalizedRoundCount, 2, "all finalized rounds should be counted");

  const finalOnlyMissing = prepareTravelV2EventCompletionReadiness(sessionFixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1 }] } }));
  assertSmoke(!finalOnlyMissing.eventReady, "final round not finalized should block readiness");

  const matchedByNumber = prepareTravelV2EventCompletionReadiness(sessionFixture({ travelV2RoundResolutions: { records: [{ roundNumber: 1 }, { roundNumber: 2 }] } }));
  assertSmoke(matchedByNumber.eventReady, "records should match by round number fallback");
  const matchedByIndex = prepareTravelV2EventCompletionReadiness(sessionFixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0 }, { roundIndex: 1 }] } }));
  assertSmoke(matchedByIndex.eventReady, "records should match by round index fallback");

  const mismatched = prepareTravelV2EventCompletionReadiness(sessionFixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 2 }, { roundIndex: 1, roundNumber: 1 }] } }));
  assertSmoke(!mismatched.eventReady, "records with conflicting index/number should not mark ready");

  const source = sessionFixture({ travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1 }, { roundIndex: 1, roundNumber: 2, nested: { safe: true } }] } });
  const before = snapshot(source);
  const state = prepareTravelV2EventCompletionReadiness(source);
  assertEqual(snapshot(source), before, "helper should not mutate input session");
  assertSmoke(state.finalizedRounds[1].finalizationRecord !== source.travelV2RoundResolutions.records[1], "finalization records should be cloned");

  return { ok: true, checked: ["exports", "blocked-states", "pending-rounds", "ready-state", "record-matching", "no-mutation"] };
}

export default runTravelV2EventCompletionReadinessSmokeChecks;
