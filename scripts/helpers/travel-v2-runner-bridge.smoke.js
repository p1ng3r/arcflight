import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { createTravelV2SessionState } from "./travel-v2-state.js";
import { applyTravelV2PressureChanges } from "./travel-v2-pressure-engine.js";
import {
  createTravelV2RunnerRoundPressureProfile,
  getTravelV2RunnerRound,
  previewTravelV2RunnerCurrentRoundOutcomePressure,
  previewTravelV2RunnerRoundOutcomePressure,
  TRAVEL_V2_RUNNER_BRIDGE_VERSION
} from "./travel-v2-runner-bridge.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 runner bridge smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 runner bridge smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function assertArrayEqual(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`Travel v2 runner bridge smoke check failed: ${message}. Expected ${expectedText}, got ${actualText}.`);
  }
}

function createRunnerSessionFixture() {
  return {
    currentRoundIndex: 1,
    event: {
      rounds: [
        {
          number: 1,
          title: "Opening Drift",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
          pressureStation: "navigator"
        },
        {
          number: 2,
          title: "Hull Groans",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
          pressureStation: "engineer"
        }
      ]
    }
  };
}

export function runTravelV2RunnerBridgeSmokeChecks() {
  assertEqual(TRAVEL_V2_RUNNER_BRIDGE_VERSION, 1, "bridge version should be 1");

  const session = createRunnerSessionFixture();
  const firstRound = getTravelV2RunnerRound(session, 0);
  assertSmoke(firstRound.ok, "explicit round lookup should succeed");
  assertEqual(firstRound.roundIndex, 0, "explicit round lookup should preserve index");
  assertEqual(firstRound.round.title, "Opening Drift", "explicit round lookup should return requested round");

  const currentRound = getTravelV2RunnerRound(session);
  assertSmoke(currentRound.ok, "current round lookup should succeed");
  assertEqual(currentRound.roundIndex, 1, "current round lookup should use currentRoundIndex");

  const profile = createTravelV2RunnerRoundPressureProfile(session, 1);
  assertSmoke(profile.ok, "runner round pressure profile should succeed");
  assertEqual(profile.profile.roundNumber, 2, "profile should preserve round number");
  assertEqual(profile.profile.primaryPressureType, ARCFLIGHT_TRAVEL_RESOURCES.HULL, "profile should map primary pressure");
  assertEqual(profile.profile.secondaryPressureType, ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES, "profile should map secondary pressure");
  assertEqual(profile.profile.pressureStation, "engineer", "profile should preserve pressure station");

  const mixedPreview = previewTravelV2RunnerRoundOutcomePressure(session, 0, "mixed");
  assertSmoke(mixedPreview.ok, "mixed preview should succeed");
  assertEqual(mixedPreview.requests.length, 1, "mixed preview should create one request");
  assertEqual(mixedPreview.requests[0].pressureType, ARCFLIGHT_TRAVEL_RESOURCES.STRAIN, "mixed preview should target first round primary pressure");
  assertEqual(mixedPreview.requests[0].amount, 1, "mixed preview should request +1 pressure");

  const failurePreview = previewTravelV2RunnerCurrentRoundOutcomePressure(session, "failure");
  assertSmoke(failurePreview.ok, "current round failure preview should succeed");
  assertEqual(failurePreview.roundIndex, 1, "current preview should use current round index");
  assertArrayEqual(failurePreview.requests.map((request) => request.pressureType), [ARCFLIGHT_TRAVEL_RESOURCES.HULL, ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES], "failure preview should target current round primary and secondary pressure");
  assertArrayEqual(failurePreview.requests.map((request) => request.amount), [1, 1], "failure preview should request +1/+1 pressure");
  assertEqual(failurePreview.summary.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.HULL], 1, "summary should total primary pressure");
  assertEqual(failurePreview.summary.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES], 1, "summary should total secondary pressure");

  const applied = applyTravelV2PressureChanges(createTravelV2SessionState({ round: { number: 2 } }), failurePreview.requests);
  assertEqual(applied.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.HULL].value, 1, "bridge requests should apply through pressure engine primary pressure");
  assertEqual(applied.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES].value, 1, "bridge requests should apply through pressure engine secondary pressure");

  const criticalPreview = previewTravelV2RunnerRoundOutcomePressure(session, 1, "criticalFailure");
  assertSmoke(criticalPreview.ok, "critical failure preview should succeed");
  assertArrayEqual(criticalPreview.requests.map((request) => request.amount), [2, 1], "critical failure preview should request +2/+1 pressure");

  const missingRound = previewTravelV2RunnerRoundOutcomePressure({ event: { rounds: [] } }, 0, "failure");
  assertSmoke(!missingRound.ok, "missing round preview should fail safely");
  assertEqual(missingRound.requests.length, 0, "missing round preview should not create requests");

  return {
    ok: true,
    checked: [
      "runner-round-lookup",
      "current-round-lookup",
      "runner-pressure-profile",
      "mixed-round-preview",
      "failure-current-preview",
      "pressure-engine-application",
      "critical-failure-preview",
      "missing-round-failure"
    ]
  };
}

export default runTravelV2RunnerBridgeSmokeChecks;
