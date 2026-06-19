import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  prepareTravelV2RoundFinalizationState,
  TRAVEL_V2_ROUND_FINALIZATION_STATE_VERSION
} from "./travel-v2-round-finalization-state.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 round finalization state smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 round finalization state smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
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
          title: "Round Finalization Test 1",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
          pressureStation: "engineer",
          stationSummary: { engineer: { outcomeKey: "mixed" } }
        },
        {
          number: 2,
          title: "Round Finalization Test 2",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.CREW,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
          pressureStation: "pilot"
        }
      ]
    },
    ...overrides
  };
}

export function runTravelV2RoundFinalizationStateSmokeChecks() {
  assertEqual(TRAVEL_V2_ROUND_FINALIZATION_STATE_VERSION, 1, "round finalization state version should be 1");

  const emptyState = prepareTravelV2RoundFinalizationState(null);
  assertSmoke(!emptyState.canFinalize, "empty session should block finalization");
  assertEqual(emptyState.lifecycleState, "previewing", "empty session should be preview-ish");
  assertSmoke(emptyState.blockedReasons.includes("Travel v2 runner session is required."), "empty session should explain missing session");

  const previewSession = createRunnerSessionFixture();
  const previewState = prepareTravelV2RoundFinalizationState(previewSession);
  assertEqual(previewState.lifecycleState, "previewing", "current round without pressure application should be previewing");
  assertSmoke(!previewState.canFinalize, "current round without pressure application should not finalize");
  assertSmoke(previewState.stationSummary.engineer.outcomeKey === "mixed", "station summary should be cloned when available");

  const applicationRecord = { roundIndex: 0, roundNumber: 1, outcomeKey: "mixed", requestCount: 1 };
  const appliedState = prepareTravelV2RoundFinalizationState(createRunnerSessionFixture({
    travelV2PressureApplications: { records: [applicationRecord] }
  }));
  assertEqual(appliedState.lifecycleState, "pressure-applied", "current round with pressure application should be pressure-applied");
  assertSmoke(appliedState.canFinalize, "current round with pressure application should be finalizable");
  assertEqual(appliedState.effectiveOutcomeKey, "mixed", "effective outcome should come from pressure application");

  const correctionRecord = {
    roundIndex: 0,
    roundNumber: 1,
    previousOutcomeKey: "mixed",
    correctedOutcomeKey: "failure",
    correctedApplicationRecord: { roundIndex: 0, roundNumber: 1, outcomeKey: "failure" }
  };
  const correctedState = prepareTravelV2RoundFinalizationState(createRunnerSessionFixture({
    travelV2PressureApplications: { records: [applicationRecord, correctionRecord.correctedApplicationRecord] },
    travelV2PressureCorrections: { records: [correctionRecord] }
  }));
  assertEqual(correctedState.effectiveOutcomeKey, "failure", "corrected pressure should expose corrected effective outcome");
  assertEqual(correctedState.correctionRecord.correctedOutcomeKey, "failure", "matching correction record should be exposed");

  const finalizedState = prepareTravelV2RoundFinalizationState(createRunnerSessionFixture({
    travelV2PressureApplications: { records: [applicationRecord] },
    travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1, outcomeKey: "mixed", createdAt: "2026-06-19T00:00:00.000Z" }] }
  }));
  assertEqual(finalizedState.lifecycleState, "finalized", "existing non-final round finalization should be finalized");
  assertSmoke(!finalizedState.canFinalize, "finalized round should not be finalizable");

  const completedState = prepareTravelV2RoundFinalizationState(createRunnerSessionFixture({
    status: "completed",
    travelV2PressureApplications: { records: [applicationRecord] }
  }));
  assertSmoke(completedState.isCompleted, "completed session should be marked completed");
  assertSmoke(!completedState.canFinalize, "completed session should block finalization");

  const noMutationSession = createRunnerSessionFixture({ travelV2PressureApplications: { records: [applicationRecord] } });
  const before = snapshot(noMutationSession);
  const noMutationState = prepareTravelV2RoundFinalizationState(noMutationSession);
  assertEqual(snapshot(noMutationSession), before, "state preparation should not mutate session");
  assertSmoke(Object.isFrozen(noMutationState), "state object should be frozen as read-only");
  assertSmoke(noMutationState.pressureApplicationRecord !== applicationRecord, "pressure application record should be cloned");

  const roundNumberMatchedState = prepareTravelV2RoundFinalizationState(createRunnerSessionFixture({
    travelV2PressureApplications: { records: [{ roundNumber: 1, outcomeKey: "success" }] },
    travelV2RoundResolutions: { records: [{ roundNumber: 1, outcomeKey: "success" }] }
  }));
  assertEqual(roundNumberMatchedState.finalizationRecord.outcomeKey, "success", "finalization should match by round number fallback");

  const eventCompleteReadyState = prepareTravelV2RoundFinalizationState(createRunnerSessionFixture({
    currentRoundIndex: 1,
    travelV2PressureApplications: { records: [{ roundIndex: 1, roundNumber: 2, outcomeKey: "success" }] },
    travelV2RoundResolutions: { records: [{ roundIndex: 1, roundNumber: 2, outcomeKey: "success" }] }
  }));
  assertEqual(eventCompleteReadyState.lifecycleState, "event-complete-ready", "finalized final round should be event-complete-ready");
  assertSmoke(eventCompleteReadyState.isEventCompleteReady, "event complete ready flag should be true for finalized final round");

  return {
    ok: true,
    checked: [
      "round-finalization-state-version",
      "empty-session-block",
      "previewing-without-pressure-application",
      "pressure-applied-can-finalize",
      "corrected-effective-outcome",
      "existing-finalization-block",
      "completed-session-block",
      "no-session-mutation",
      "round-index-number-matching",
      "event-complete-ready-final-round"
    ]
  };
}

export default runTravelV2RoundFinalizationStateSmokeChecks;
