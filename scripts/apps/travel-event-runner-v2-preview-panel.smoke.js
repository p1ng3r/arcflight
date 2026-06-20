import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";
import {
  prepareTravelEventRunnerV2PreviewPanelState,
  TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION
} from "./travel-event-runner-v2-preview-panel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PANEL_PATH = path.join(__dirname, "travel-event-runner-v2-preview-panel.js");

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
  assertEqual(TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION, 5, "panel version should be 5");
  const panelSource = fs.readFileSync(PANEL_PATH, "utf8");
  assertSmoke(!panelSource.includes("applyTravelV2PressureToRunnerSession"), "preview panel should not import or execute application helper during state preparation");
  assertSmoke(!panelSource.includes("correctTravelV2PressureApplicationOnRunnerSession"), "preview panel should not import or execute correction helper during state preparation");
  assertSmoke(!panelSource.includes("finalizeTravelV2RoundOnRunnerSession"), "preview panel should not import or execute finalization helper during state preparation");
  assertSmoke(!panelSource.includes("completeTravelV2Event"), "preview panel should not import or execute completion helper during state preparation");

  const emptyPanel = prepareTravelEventRunnerV2PreviewPanelState({});
  assertSmoke(!emptyPanel.available, "empty panel should be unavailable");
  assertEqual(emptyPanel.rows.length, 0, "empty panel should have no rows");

  const appState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: { event: createRunnerEventFixture() } });
  const panel = prepareTravelEventRunnerV2PreviewPanelState(appState);
  assertSmoke(panel.available, "panel should be available for active preview state");
  assertEqual(panel.roundNumber, 1, "panel should carry round number");
  assertEqual(panel.rows.length, 5, "panel should expose all outcome rows");
  assertSmoke(panel.hasPressureChanges, "panel should flag pressure-changing outcomes");
  assertSmoke(panel.footerText.includes("GM-only session-local controls"), "panel should include GM-only footer text");
  assertSmoke(panel.pressureApplication.canApply, "panel should expose application readiness");
  assertSmoke(!panel.travelV2RoundFinalizationState.canFinalize, "panel should block finalization before pressure application");
  assertSmoke(panel.travelV2RoundFinalizationState.finalizeDisabled, "panel should disable finalization before pressure application");
  assertSmoke(panel.travelV2RoundFinalizationState.footerText.includes("no effective pressure application"), "panel should explain blocked finalization");
  assertSmoke(panel.travelV2EventCompletionReadiness, "panel should expose event completion readiness summary");
  assertEqual(panel.travelV2EventCompletionReadiness.eventRoundCount, 1, "readiness should count event rounds");
  assertSmoke(!panel.travelV2EventCompletionReadiness.eventReady, "unfinalized panel should not be event-ready");
  assertSmoke(panel.rows.every((row) => row.canApplyPressure && !row.pressureApplyDisabled), "preview rows should render enabled apply controls before application");
  assertSmoke(panel.rows.every((row) => !row.canCorrectPressure), "preview rows should not render correction controls before application");

  const success = panel.rows.find((row) => row.outcomeKey === "success");
  assertSmoke(success, "success row should exist");
  assertEqual(success.tone, "safe", "success row should be safe tone");
  assertSmoke(!success.hasRequests, "success row should have no pressure chips");
  assertSmoke(success.canApplyPressure, "success row should be actionable before application");
  assertEqual(success.pressureApplyLabel, "Apply Success", "success row should expose apply label");

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

  const appliedPanel = prepareTravelEventRunnerV2PreviewPanelState({
    ...appState,
    session: {
      ...appState.session,
      pressure: {
        [ARCFLIGHT_TRAVEL_RESOURCES.HULL]: { value: 1, crossed: [] },
        [ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES]: { value: 1, crossed: [] }
      },
      travelV2PressureApplications: { records: [{ roundIndex: 0, roundNumber: 1, outcomeKey: "failure", totalsByPressureType: { [ARCFLIGHT_TRAVEL_RESOURCES.HULL]: 1, [ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES]: 1 } }] }
    },
    travelV2PressureApplicationResult: { ok: true, applied: true, selectedOutcomeKey: "failure" }
  });
  assertSmoke(appliedPanel.pressureApplication.alreadyApplied, "panel should flag already-applied rounds");
  assertEqual(appliedPanel.pressureApplication.appliedOutcomeLabel, "Failure", "panel should label applied outcome");
  assertSmoke(appliedPanel.pressureApplication.feedbackText.includes("Failure"), "panel should carry latest success feedback");
  assertSmoke(appliedPanel.rows.every((row) => row.pressureApplyDisabled), "already-applied panel rows should be disabled");
  assertSmoke(appliedPanel.rows.some((row) => row.canCorrectPressure), "already-applied panel should expose correction controls for other outcomes");
  assertSmoke(appliedPanel.travelV2RoundFinalizationState.canFinalize, "applied panel should allow finalization");
  assertEqual(appliedPanel.travelV2RoundFinalizationState.buttonLabel, "Finalize Round", "applied panel should label finalize action");
  assertSmoke(appliedPanel.rows.find((row) => row.outcomeKey === "failure").isEffectiveAppliedOutcome, "applied outcome row should be marked effective");
  assertSmoke(!appliedPanel.rows.find((row) => row.outcomeKey === "failure").canCorrectPressure, "effective applied outcome correction should be disabled");
  const skippedRow = prepareTravelEventRunnerV2PreviewPanelState({
    ...appState,
    travelV2Preview: { ...appState.travelV2Preview, rows: [{ outcomeKey: "skipped", ok: true }] },
    session: {
      ...appState.session,
      travelV2PressureApplications: { records: [{ roundIndex: 0, roundNumber: 1, outcomeKey: "failure", totalsByPressureType: { [ARCFLIGHT_TRAVEL_RESOURCES.HULL]: 1 } }] }
    }
  }).rows[0];
  assertSmoke(!skippedRow.canCorrectPressure, "skipped pseudo-outcome should not expose correction controls");

  const completedPanel = prepareTravelEventRunnerV2PreviewPanelState({
    ...appState,
    session: {
      ...appState.session,
      status: "completed",
      travelV2PressureApplications: { records: [{ roundIndex: 0, roundNumber: 1, outcomeKey: "failure", totalsByPressureType: { [ARCFLIGHT_TRAVEL_RESOURCES.HULL]: 1 } }] }
    },
    isCompleted: true
  });
  const finalizedPanel = prepareTravelEventRunnerV2PreviewPanelState({
    ...appState,
    session: {
      ...appState.session,
      travelV2PressureApplications: { records: [{ roundIndex: 0, roundNumber: 1, outcomeKey: "failure", totalsByPressureType: { [ARCFLIGHT_TRAVEL_RESOURCES.HULL]: 1 } }] },
      travelV2RoundResolutions: { records: [{ roundIndex: 0, roundNumber: 1, effectiveOutcomeKey: "failure" }] }
    },
    travelV2RoundFinalizationResult: { ok: true, finalized: true, roundIndex: 0, roundNumber: 1 }
  });
  assertSmoke(finalizedPanel.travelV2RoundFinalizationState.isFinalized, "finalized panel should flag finalized state");
  assertSmoke(finalizedPanel.travelV2RoundFinalizationState.isEventCompleteReady, "single final round should be event-complete-ready");
  assertEqual(finalizedPanel.travelV2RoundFinalizationState.buttonLabel, "Event Ready", "final round finalized should show event ready label");
  assertSmoke(finalizedPanel.travelV2RoundFinalizationState.readinessText.includes("later step"), "event ready panel should defer event completion");
  assertSmoke(finalizedPanel.travelV2EventCompletionReadiness.eventReady, "finalized panel should expose event completion readiness");
  assertEqual(finalizedPanel.travelV2EventCompletionReadiness.countText, "1 / 1 rounds finalized. 0 rounds pending.", "ready panel should expose readiness counts");
  assertSmoke(finalizedPanel.travelV2RoundFinalizationState.feedbackText.includes("Finalized Travel v2 round 1"), "success finalization feedback should appear");

  assertSmoke(completedPanel.rows.every((row) => row.pressureApplyDisabled), "completed sessions should disable apply controls");
  assertSmoke(completedPanel.rows.every((row) => !row.canCorrectPressure), "completed sessions should not expose correction controls");

  return {
    ok: true,
    checked: [
      "panel-version",
      "no-apply-correction-or-finalization-helper-in-preview-preparation",
      "empty-panel-state",
      "active-panel-state",
      "safe-outcome-row",
      "mixed-outcome-chip",
      "critical-failure-chips",
      "read-only-footer",
      "row-application-controls",
      "pre-application-correction-controls-hidden",
      "already-applied-disabled-state",
      "event-completion-readiness-summary",
      "no-completion-helper-in-preview-preparation"
    ]
  };
}

export default runTravelEventRunnerV2PreviewPanelSmokeChecks;
