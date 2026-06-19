import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  prepareTravelEventRunnerAppStateWithTravelV2Preview,
  TRAVEL_EVENT_RUNNER_V2_PREVIEW_CONSUMER_VERSION
} from "./travel-event-runner-v2-preview-consumer.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 runner app preview consumer smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 runner app preview consumer smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function createRunnerEventFixture() {
  return {
    key: "v2-app-preview-test",
    name: "V2 App Preview Test",
    category: "navigation",
    baseDC: 20,
    rounds: [
      {
        roundNumber: 1,
        title: "App Preview Round",
        openingVignette: "The GM sees a safe preview before applying pressure.",
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

export function runTravelEventRunnerV2PreviewConsumerSmokeChecks() {
  assertEqual(TRAVEL_EVENT_RUNNER_V2_PREVIEW_CONSUMER_VERSION, 2, "consumer version should be 2");

  const emptyState = prepareTravelEventRunnerAppStateWithTravelV2Preview();
  assertSmoke(!emptyState.hasSession, "empty app state should have no session");
  assertSmoke(emptyState.travelV2Preview, "empty app state should expose preview object");
  assertSmoke(emptyState.travelV2PreviewPanel, "empty app state should expose preview panel object");
  assertSmoke(!emptyState.travelV2PreviewPanel.available, "empty preview panel should be unavailable");
  assertEqual(emptyState.compactRoundLabel, "No active round", "empty app state should keep compact label fallback");

  const state = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session: { event: createRunnerEventFixture() },
    selectedEventId: "v2-app-preview-test",
    uiState: { currentSessionCollapsed: false, sessionActionsExpanded: true, compactRunner: true }
  });

  assertSmoke(state.hasSession, "app state should preserve active session");
  assertSmoke(state.effectApplication, "app state should include effect application state");
  assertSmoke(state.travelV2Preview.ok, "app state should expose usable v2 preview");
  assertSmoke(state.travelV2PreviewPanel.available, "app state should expose available preview panel");
  assertEqual(state.currentSessionCollapsed, false, "app state should preserve expanded current session UI setting");
  assertEqual(state.sessionActionsExpanded, true, "app state should preserve session actions UI setting");
  assertEqual(state.compactRunner, true, "app state should preserve compact UI setting");
  assertEqual(state.compactRoundLabel, "Round 1", "app state should preserve compact round label behavior");

  const criticalFailure = state.travelV2Preview.rows.find((row) => row.outcomeKey === "criticalFailure");
  assertSmoke(criticalFailure, "critical failure preview row should exist");
  assertEqual(criticalFailure.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.HULL], 2, "critical failure should preview hull pressure");
  assertEqual(criticalFailure.totalsByPressureType[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES], 1, "critical failure should preview supplies pressure");

  const panelCriticalFailure = state.travelV2PreviewPanel.rows.find((row) => row.outcomeKey === "criticalFailure");
  assertSmoke(panelCriticalFailure, "critical failure panel row should exist");
  assertEqual(panelCriticalFailure.tone, "severe", "panel critical failure row should be severe");
  assertEqual(panelCriticalFailure.pressureChips.length, 2, "panel critical failure row should expose two chips");

  assertEqual(state.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.STRAIN], 0, "app state should not mutate strain pressure");
  assertSmoke(!Object.hasOwn(state.session.pressure, ARCFLIGHT_TRAVEL_RESOURCES.HULL), "hull should remain preview-only in app state");

  return {
    ok: true,
    checked: [
      "consumer-version",
      "empty-app-state",
      "active-app-state",
      "ui-state-preservation",
      "preview-row-exposure",
      "preview-panel-exposure",
      "preview-only-pressure"
    ]
  };
}

export default runTravelEventRunnerV2PreviewConsumerSmokeChecks;
