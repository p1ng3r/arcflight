import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  prepareTravelEventRunnerStateWithTravelV2Preview,
  TRAVEL_EVENT_RUNNER_V2_PREVIEW_VERSION
} from "./travel-event-runner-v2-preview.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel event runner v2 preview smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel event runner v2 preview smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function createRunnerEventFixture() {
  return {
    key: "v2-preview-test",
    name: "V2 Preview Test",
    category: "navigation",
    baseDC: 20,
    rounds: [
      {
        roundNumber: 1,
        title: "Preview Round",
        openingVignette: "The ship enters a bad angle.",
        activeStations: ["navigator", "engineer"],
        primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
        secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
        pressureStation: "engineer",
        stationPrompts: {
          navigator: { stationKey: "navigator", stationName: "Navigator", playerAction: "Plot the safe route.", suggestedSkills: ["piloting-lore"] },
          engineer: { stationKey: "engineer", stationName: "Engineer", playerAction: "Hold the engine together.", suggestedSkills: ["crafting"] }
        }
      }
    ]
  };
}

export function runTravelEventRunnerV2PreviewSmokeChecks() {
  assertEqual(TRAVEL_EVENT_RUNNER_V2_PREVIEW_VERSION, 1, "preview wrapper version should be 1");

  const state = prepareTravelEventRunnerStateWithTravelV2Preview(null);
  assertSmoke(!state.hasSession, "empty wrapper state should preserve no-session state");
  assertSmoke(state.travelV2Preview, "empty wrapper state should expose travelV2Preview object");
  assertSmoke(!state.travelV2Preview.ok, "empty wrapper preview should fail safely");

  const event = createRunnerEventFixture();
  const sessionState = prepareTravelEventRunnerStateWithTravelV2Preview({ event });
  assertSmoke(sessionState.hasSession, "wrapper should preserve active runner state");
  assertSmoke(sessionState.travelV2Preview.ok, "wrapper should expose usable v2 preview state");
  assertEqual(sessionState.travelV2Preview.roundIndex, 0, "preview should target current round");
  assertEqual(sessionState.travelV2Preview.rows.length, 5, "preview should expose five outcome rows");

  const criticalFailure = sessionState.travelV2Preview.rows.find((row) => row.outcomeKey === "criticalFailure");
  assertSmoke(criticalFailure, "critical failure row should exist");
  assertEqual(criticalFailure.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.HULL], 2, "critical failure row should preview primary pressure");
  assertEqual(criticalFailure.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES], 1, "critical failure row should preview secondary pressure");

  assertEqual(sessionState.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.STRAIN], 0, "strain should stay at zero");
  assertEqual(sessionState.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL], 0, "lifeveil should stay at zero");
  assertEqual(sessionState.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.MORALE], 0, "morale should stay at zero");
  assertSmoke(!Object.hasOwn(sessionState.session.pressure, ARCFLIGHT_TRAVEL_RESOURCES.HULL), "hull should stay preview-only");
  assertSmoke(!Object.hasOwn(sessionState.session.pressure, ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES), "supplies should stay preview-only");

  return {
    ok: true,
    checked: [
      "preview-wrapper-version",
      "empty-state-preview",
      "active-state-preservation",
      "travel-v2-preview-exposure",
      "critical-failure-preview",
      "preview-only-pressure"
    ]
  };
}

export default runTravelEventRunnerV2PreviewSmokeChecks;
