import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  prepareTravelV2RunnerCurrentRoundPreviewState,
  prepareTravelV2RunnerRoundPreviewState,
  TRAVEL_V2_PREVIEW_STATE_VERSION
} from "./travel-v2-preview-state.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 preview state smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 preview state smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function createRunnerSessionFixture() {
  return {
    currentRoundIndex: 0,
    event: {
      rounds: [
        {
          number: 1,
          title: "Bridge Test",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
          pressureStation: "engineer"
        }
      ]
    }
  };
}

export function runTravelV2PreviewStateSmokeChecks() {
  assertEqual(TRAVEL_V2_PREVIEW_STATE_VERSION, 1, "preview state version should be 1");

  const session = createRunnerSessionFixture();
  const state = prepareTravelV2RunnerCurrentRoundPreviewState(session);
  assertSmoke(state.ok, "current round preview state should succeed");
  assertEqual(state.roundIndex, 0, "current round preview should use current round index");
  assertEqual(state.roundNumber, 1, "current round preview should use current round number");
  assertEqual(state.rows.length, 5, "current round preview should include all supported outcome rows");

  const criticalFailure = state.rows.find((row) => row.outcomeKey === "criticalFailure");
  assertSmoke(criticalFailure, "critical failure row should exist");
  assertEqual(criticalFailure.requestCount, 2, "critical failure row should include primary and secondary requests");
  assertEqual(criticalFailure.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.HULL], 2, "critical failure row should total primary pressure");
  assertEqual(criticalFailure.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES], 1, "critical failure row should total secondary pressure");
  assertSmoke(criticalFailure.summaryText.includes("Hull"), "critical failure summary should humanize pressure names");

  const success = state.rows.find((row) => row.outcomeKey === "success");
  assertSmoke(success, "success row should exist");
  assertEqual(success.requestCount, 0, "success row should not include pressure requests");
  assertEqual(success.summaryText, "No Travel v2 pressure change.", "success row should show no pressure text");

  const explicitState = prepareTravelV2RunnerRoundPreviewState(session, 0);
  assertSmoke(explicitState.ok, "explicit round preview state should succeed");
  assertEqual(explicitState.roundIndex, 0, "explicit round preview should preserve requested index");

  const missingState = prepareTravelV2RunnerCurrentRoundPreviewState({ event: { rounds: [] } });
  assertSmoke(!missingState.ok, "missing current round preview should fail safely");
  assertEqual(missingState.hasPreview, false, "missing current round preview should not claim preview rows are usable");

  return {
    ok: true,
    checked: [
      "preview-state-version",
      "current-round-preview-state",
      "outcome-preview-rows",
      "critical-failure-preview-summary",
      "success-preview-summary",
      "explicit-round-preview-state",
      "missing-round-preview-state"
    ]
  };
}

export default runTravelV2PreviewStateSmokeChecks;
