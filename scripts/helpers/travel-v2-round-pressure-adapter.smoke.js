import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { createTravelV2SessionState } from "./travel-v2-state.js";
import { applyTravelV2PressureChanges, TRAVEL_V2_PRESSURE_CHANGE_SOURCES } from "./travel-v2-pressure-engine.js";
import {
  createTravelV2RoundOutcomePressureRequests,
  createTravelV2RoundPressureRequestSummary,
  createTravelV2StationResultPressureRequests,
  getTravelV2RoundOutcomePressureRule,
  normalizeTravelV2RoundOutcomeKey,
  normalizeTravelV2RoundPressureProfile,
  normalizeTravelV2StationResultPressureInput,
  TRAVEL_V2_ROUND_OUTCOME_KEYS,
  TRAVEL_V2_ROUND_PRESSURE_ADAPTER_VERSION
} from "./travel-v2-round-pressure-adapter.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 round pressure adapter smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 round pressure adapter smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function assertArrayEqual(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`Travel v2 round pressure adapter smoke check failed: ${message}. Expected ${expectedText}, got ${actualText}.`);
  }
}

export function runTravelV2RoundPressureAdapterSmokeChecks() {
  assertEqual(TRAVEL_V2_ROUND_PRESSURE_ADAPTER_VERSION, 1, "adapter version should be 1");

  assertEqual(normalizeTravelV2RoundOutcomeKey("criticalRoundSuccess"), TRAVEL_V2_ROUND_OUTCOME_KEYS.CRITICAL_SUCCESS, "critical round success should normalize");
  assertEqual(normalizeTravelV2RoundOutcomeKey("roundSuccess"), TRAVEL_V2_ROUND_OUTCOME_KEYS.SUCCESS, "round success should normalize");
  assertEqual(normalizeTravelV2RoundOutcomeKey("narrowRoundSuccess"), TRAVEL_V2_ROUND_OUTCOME_KEYS.MIXED, "narrow round success should normalize to mixed");
  assertEqual(normalizeTravelV2RoundOutcomeKey("roundFailure"), TRAVEL_V2_ROUND_OUTCOME_KEYS.FAILURE, "round failure should normalize");
  assertEqual(normalizeTravelV2RoundOutcomeKey("criticalRoundFailure"), TRAVEL_V2_ROUND_OUTCOME_KEYS.CRITICAL_FAILURE, "critical round failure should normalize");

  const mixedRule = getTravelV2RoundOutcomePressureRule("mixed");
  assertEqual(mixedRule.primary, 1, "mixed should apply one primary pressure");
  assertEqual(mixedRule.secondary, 0, "mixed should not apply secondary pressure");

  const profile = normalizeTravelV2RoundPressureProfile({
    number: 2,
    primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
    secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
    stationKey: "watchmaster"
  });
  assertEqual(profile.roundNumber, 2, "profile should normalize round number");
  assertEqual(profile.primaryPressureType, ARCFLIGHT_TRAVEL_RESOURCES.HULL, "profile should preserve primary pressure");
  assertEqual(profile.secondaryPressureType, ARCFLIGHT_TRAVEL_RESOURCES.MORALE, "profile should preserve secondary pressure");
  assertEqual(profile.pressureStation, "watchmaster", "profile should preserve pressure station");

  const successRequests = createTravelV2RoundOutcomePressureRequests(profile, "success");
  assertEqual(successRequests.length, 0, "success should create no pressure requests");

  const mixedRequests = createTravelV2RoundOutcomePressureRequests(profile, "mixed");
  assertEqual(mixedRequests.length, 1, "mixed should create one pressure request");
  assertEqual(mixedRequests[0].pressureType, ARCFLIGHT_TRAVEL_RESOURCES.HULL, "mixed should target primary pressure");
  assertEqual(mixedRequests[0].amount, 1, "mixed should request +1 primary pressure");
  assertEqual(mixedRequests[0].source, TRAVEL_V2_PRESSURE_CHANGE_SOURCES.ROUND_OUTCOME, "round request should use round outcome source");

  const failureRequests = createTravelV2RoundOutcomePressureRequests(profile, "failure");
  assertEqual(failureRequests.length, 2, "failure should create primary and secondary pressure requests");
  assertArrayEqual(failureRequests.map((request) => request.pressureType), [ARCFLIGHT_TRAVEL_RESOURCES.HULL, ARCFLIGHT_TRAVEL_RESOURCES.MORALE], "failure should target primary then secondary");
  assertArrayEqual(failureRequests.map((request) => request.amount), [1, 1], "failure should apply +1 primary and +1 secondary");

  const criticalFailureRequests = createTravelV2RoundOutcomePressureRequests(profile, "criticalFailure");
  assertEqual(criticalFailureRequests.length, 2, "critical failure should create two pressure requests");
  assertArrayEqual(criticalFailureRequests.map((request) => request.amount), [2, 1], "critical failure should apply +2 primary and +1 secondary");

  const noDuplicateSecondary = createTravelV2RoundOutcomePressureRequests({
    primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
    secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.STRAIN
  }, "failure");
  assertEqual(noDuplicateSecondary.length, 1, "matching primary and secondary pressure should not duplicate requests");

  const stationInput = normalizeTravelV2StationResultPressureInput({
    stationKey: "navigator",
    degreeOfSuccess: "criticalFailure",
    pressureType: ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
    secondaryPressureType: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
    roundNumber: 3,
    notes: "bad angle"
  });
  assertEqual(stationInput.stationKey, "navigator", "station input should preserve station key");
  assertEqual(stationInput.outcomeKey, TRAVEL_V2_ROUND_OUTCOME_KEYS.CRITICAL_FAILURE, "station input should normalize result degree");
  assertEqual(stationInput.roundNumber, 3, "station input should preserve round number");
  assertEqual(stationInput.note, "bad angle", "station input should preserve notes");

  const stationRequests = createTravelV2StationResultPressureRequests({
    stationKey: "navigator",
    degreeOfSuccess: "criticalFailure",
    pressureType: ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
    secondaryPressureType: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
    roundNumber: 3
  });
  assertEqual(stationRequests.length, 2, "station critical failure should create two pressure requests");
  assertArrayEqual(stationRequests.map((request) => request.pressureType), [ARCFLIGHT_TRAVEL_RESOURCES.STRAIN, ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES], "station requests should target configured pressure types");
  assertArrayEqual(stationRequests.map((request) => request.amount), [2, 1], "station critical failure should apply +2/+1 pressure");
  assertArrayEqual(stationRequests.map((request) => request.stationKey), ["navigator", "navigator"], "station requests should preserve station key");

  const summary = createTravelV2RoundPressureRequestSummary(stationRequests);
  assertEqual(summary.requestCount, 2, "summary should count requests");
  assertSmoke(summary.hasRequests, "summary should mark requests present");
  assertEqual(summary.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.STRAIN], 2, "summary should total Strain pressure");
  assertEqual(summary.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES], 1, "summary should total Supplies pressure");

  const applied = applyTravelV2PressureChanges(createTravelV2SessionState({ round: { number: 3 } }), stationRequests);
  assertEqual(applied.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.STRAIN].value, 2, "adapter requests should apply through pressure engine");
  assertEqual(applied.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES].value, 1, "adapter secondary request should apply through pressure engine");
  assertArrayEqual(applied.session.hazards.pendingDraws.filter((draw) => draw.pressureType === ARCFLIGHT_TRAVEL_RESOURCES.STRAIN).map((draw) => draw.threshold), [2], "adapter application should queue threshold Hazard draws");

  return {
    ok: true,
    checked: [
      "outcome-key-normalization",
      "outcome-pressure-rules",
      "round-pressure-profile",
      "round-outcome-requests",
      "duplicate-secondary-suppression",
      "station-result-input",
      "station-result-requests",
      "request-summary",
      "pressure-engine-application"
    ]
  };
}

export default runTravelV2RoundPressureAdapterSmokeChecks;
