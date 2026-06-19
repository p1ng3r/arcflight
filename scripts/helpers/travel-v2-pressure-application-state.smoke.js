import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  prepareTravelV2PressureApplicationState,
  TRAVEL_V2_PRESSURE_APPLICATION_STATE_VERSION
} from "./travel-v2-pressure-application-state.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 pressure application state smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 pressure application state smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function snapshot(value) {
  return JSON.stringify(value);
}

function createRunnerSessionFixture(overrides = {}) {
  return {
    status: "active",
    currentRoundIndex: 0,
    event: {
      rounds: [
        {
          number: 1,
          title: "Application State Test",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
          pressureStation: "engineer"
        }
      ]
    },
    ...overrides
  };
}

export function runTravelV2PressureApplicationStateSmokeChecks() {
  assertEqual(TRAVEL_V2_PRESSURE_APPLICATION_STATE_VERSION, 1, "application state version should be 1");

  const emptyState = prepareTravelV2PressureApplicationState(null);
  assertSmoke(!emptyState.canApply, "empty session should block apply");
  assertSmoke(emptyState.blockedReasons.some((reason) => reason.includes("No active")), "empty session should explain missing session");

  const session = createRunnerSessionFixture();
  const mixedState = prepareTravelV2PressureApplicationState(session);
  assertSmoke(mixedState.canApply, "active session with available preview should be able to apply");
  assertEqual(mixedState.selectedOutcomeKey, "mixed", "selected outcome should default to mixed");
  assertEqual(mixedState.selectedRow.outcomeKey, "mixed", "selected row should be mixed");
  assertEqual(mixedState.selectedRow.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.HULL], 1, "mixed row should expose copied pressure totals");

  const completedState = prepareTravelV2PressureApplicationState(createRunnerSessionFixture({ status: "completed" }));
  assertSmoke(!completedState.canApply, "completed session should block apply");
  assertSmoke(completedState.blockedReasons.some((reason) => reason.includes("Completed")), "completed session should explain completion block");

  const applicationRecord = { roundIndex: 0, roundNumber: 1, outcomeKey: "mixed", requestCount: 1 };
  const alreadyAppliedState = prepareTravelV2PressureApplicationState(createRunnerSessionFixture({
    travelV2PressureApplications: { records: [applicationRecord] }
  }));
  assertSmoke(!alreadyAppliedState.canApply, "already-applied round should block apply");
  assertSmoke(alreadyAppliedState.alreadyApplied, "already-applied round should be flagged");
  assertEqual(alreadyAppliedState.applicationRecord.outcomeKey, "mixed", "already-applied round should expose application record");

  const invalidOutcomeState = prepareTravelV2PressureApplicationState(session, { selectedOutcomeKey: "not-a-real-outcome" });
  assertSmoke(!invalidOutcomeState.canApply, "invalid selected outcome should block apply");
  assertEqual(invalidOutcomeState.selectedRow, null, "invalid selected outcome should not expose selected row");

  const before = snapshot(session);
  const noMutationState = prepareTravelV2PressureApplicationState(session, { selectedOutcomeKey: "criticalFailure" });
  assertEqual(snapshot(session), before, "state preparation should not mutate session");
  assertSmoke(noMutationState.selectedRow !== session.event.rounds[0], "state rows should not expose source round objects");
  assertSmoke(Object.isFrozen(noMutationState), "state object should be frozen as read-only");
  assertSmoke(Object.isFrozen(noMutationState.selectedRow.totalsByPressureType), "selected row totals should be frozen as read-only copies");

  return {
    ok: true,
    checked: [
      "application-state-version",
      "empty-session-block",
      "active-session-mixed-can-apply",
      "completed-session-block",
      "already-applied-round-block",
      "invalid-selected-outcome-block",
      "no-session-mutation"
    ]
  };
}

export default runTravelV2PressureApplicationStateSmokeChecks;
