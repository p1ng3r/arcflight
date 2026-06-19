import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import {
  prepareTravelEventRunnerV2PreviewPanelState,
  TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION
} from "./travel-event-runner-v2-preview-panel.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 GM preview panel smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 GM preview panel smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function createRunnerEventFixture() {
  return {
    key: "v2-preview-panel-test",
    name: "V2 Preview Panel Test",
    category: "navigation",
    baseDC: 20,
    rounds: [
      {
        roundNumber: 1,
        title: "Preview Panel Round",
        openingVignette: "The GM sees pressure outcomes before committing anything.",
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

export function runTravelEventRunnerV2PreviewPanelSmokeChecks() {
  assertEqual(TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION, 1, "panel version should be 1");

  const emptyPanel = prepareTravelEventRunnerV2PreviewPanelState({});
  assertSmoke(!emptyPanel.available, "empty panel should be unavailable");
  assertEqual(emptyPanel.rows.length, 0, "empty panel should have no rows");

  const appState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: { event: createRunnerEventFixture() } });
  const panel = prepareTravelEventRunnerV2PreviewPanelState(appState);
  assertSmoke(panel.available, "panel should be available for active preview state");
  assertEqual(panel.roundNumber, 1, "panel should carry round number");
  assertEqual(panel.rows.length, 5, "panel should expose all outcome rows");
  assertSmoke(panel.hasPressureChanges, "panel should flag pressure-changing outcomes");
  assertSmoke(panel.footerText.includes("Preview only"), "panel should include read-only footer text");

  const success = panel.rows.find((row) => row.outcomeKey === "success");
  assertSmoke(success, "success row should exist");
  assertEqual(success.tone, "safe", "success row should be safe tone");
  assertSmoke(!success.hasRequests, "success row should have no pressure chips");

  const mixed = panel.rows.find((row) => row.outcomeKey === "mixed");
  assertSmoke(mixed, "mixed row should exist");
  assertEqual(mixed.tone, "warning", "mixed row should be warning tone");
  assertEqual(mixed.pressureChips[0].pressureType, ARCFLIGHT_TRAVEL_RESOURCES.HULL, "mixed row should chip primary pressure");
  assertEqual(mixed.pressureChips[0].displayAmount, "+1", "mixed row should display plus amount");

  const criticalFailure = panel.rows.find((row) => row.outcomeKey === "criticalFailure");
  assertSmoke(criticalFailure, "critical failure row should exist");
  assertEqual(criticalFailure.tone, "severe", "critical failure row should be severe tone");
  assertEqual(criticalFailure.pressureChips.length, 2, "critical failure should expose primary and secondary chips");
  assertEqual(criticalFailure.pressureChips[0].pressureType, ARCFLIGHT_TRAVEL_RESOURCES.HULL, "critical failure first chip should be hull");
  assertEqual(criticalFailure.pressureChips[1].pressureType, ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES, "critical failure second chip should be supplies");

  return {
    ok: true,
    checked: [
      "panel-version",
      "empty-panel-state",
      "active-panel-state",
      "safe-outcome-row",
      "mixed-outcome-chip",
      "critical-failure-chips",
      "read-only-footer"
    ]
  };
}

export default runTravelEventRunnerV2PreviewPanelSmokeChecks;
