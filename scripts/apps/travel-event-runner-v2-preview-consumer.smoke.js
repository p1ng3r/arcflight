import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  assertEqual(TRAVEL_EVENT_RUNNER_V2_PREVIEW_CONSUMER_VERSION, 4, "consumer version should be 4");

  const emptyState = prepareTravelEventRunnerAppStateWithTravelV2Preview();
  assertSmoke(!emptyState.hasSession, "empty app state should have no session");
  assertSmoke(emptyState.travelV2Preview, "empty app state should expose preview object");
  assertSmoke(emptyState.travelV2PreviewPanel, "empty app state should expose preview panel object");
  assertSmoke(!emptyState.travelV2PreviewPanel.available, "empty preview panel should be unavailable");
  assertEqual(emptyState.compactRoundLabel, "No active round", "empty app state should keep compact label fallback");
  assertEqual(emptyState.guidedBridge.nextRequiredAction.title, "Start Travel Session", "empty guided bridge should require starting a session");
  assertSmoke(!Object.hasOwn(emptyState, "travelV2GmFlowStatus"), "non-GM empty app state should not expose GM flow status");

  const state = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session: { event: createRunnerEventFixture() },
    selectedEventId: "v2-app-preview-test",
    uiState: { currentSessionCollapsed: false, sessionActionsExpanded: true, compactRunner: true }
  });

  assertSmoke(state.hasSession, "app state should preserve active session");
  assertSmoke(state.effectApplication, "app state should include effect application state");
  assertSmoke(state.travelV2Preview.ok, "app state should expose usable v2 preview");
  assertSmoke(state.travelV2PreviewPanel.available, "app state should expose available preview panel");
  assertSmoke(state.travelV2PreviewPanel.roundActionOrderDisplay.hasRows, "app state should expose round action order display rows");
  assertEqual(state.travelV2PreviewPanel.roundActionOrderDisplay.rows[0].stationName, "Navigator", "app state round action order should include station name");
  assertSmoke(!state.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.requested, "reorder comparison should not appear without explicit request");
  assertEqual(state.currentSessionCollapsed, false, "app state should preserve expanded current session UI setting");
  assertEqual(state.sessionActionsExpanded, true, "app state should preserve session actions UI setting");
  assertEqual(state.compactRunner, true, "app state should preserve compact UI setting");
  assertEqual(state.compactRoundLabel, "Round 1", "app state should preserve compact round label behavior");
  assertEqual(state.guidedBridge.nextRequiredAction.title, "Send / Refresh Player HUD", "fresh session should guide GM to refresh player HUD/cards");

  const benefitState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session: {
      event: createRunnerEventFixture(),
      travelV2PendingStationBenefits: [
        { queueKey: "benefit-1", title: "Clear Shot", sourceStation: "navigator", targetStation: "engineer", benefitKind: "dcReduction", magnitude: 2, expires: "afterUse", publicText: "Engineer gets an opening.", playerSafeSummary: "Reduce one Engineer DC.", gmText: "secret", applyPayload: { bad: true } },
        { queueKey: "benefit-2", title: "Spent Opening", sourceStation: "engineer", targetStation: "navigator", status: "expired", publicText: "The opening has passed." }
      ]
    },
    user: { isGM: false }
  });
  assertSmoke(benefitState.travelV2StationBenefitUseReviewPlayerState.rows.length === 2, "app state should expose player-safe station benefit display rows");
  assertSmoke(benefitState.travelV2PreviewPanel.stationBenefitDisplay.hasRows, "preview panel state should expose visible station benefit display rows");
  assertEqual(benefitState.travelV2PreviewPanel.stationBenefitDisplay.rows[0].sourceStationLabel, "Navigator", "app/panel benefit display should include source station label");
  assertEqual(benefitState.travelV2PreviewPanel.stationBenefitDisplay.rows[0].targetStationLabel, "Engineer", "app/panel benefit display should include target station label");
  assertEqual(benefitState.travelV2PreviewPanel.stationBenefitDisplay.rows[1].requestAvailabilityLabel, "Not ready", "disabled station benefit rows should be represented safely");
  assertSmoke(!JSON.stringify(benefitState).includes("gmText") && !JSON.stringify(benefitState).includes("applyPayload"), "non-GM app/panel station benefit state should not leak GM-only fields");
  assertSmoke(!JSON.stringify(benefitState.travelV2PreviewPanel.stationBenefitDisplay).includes("useApplied"), "station benefit display should not expose real use/apply behavior");
  const requestedBenefitState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session: { pendingStationBenefits: [{ queueKey: "benefit-1", title: "Clear Shot", sourceStation: "navigator", targetStation: "engineer", status: "pending", playerSafeSummary: "Reduce one Engineer DC." }] },
    uiState: { travelV2StationBenefitUseReviewSelectedQueueKey: "benefit-1", travelV2StationBenefitUseReviewRequested: true },
    user: { isGM: true }
  });
  assertEqual(requestedBenefitState.travelV2StationBenefitUseReviewPlayerState.selectedCandidate.status, "ready", "ephemeral UI request should prepare a ready review-only station benefit candidate");
  assertEqual(requestedBenefitState.travelV2PreviewPanel.stationBenefitDisplay.reviewRequest.ready, true, "preview panel should expose ready review request feedback");
  assertSmoke(requestedBenefitState.travelV2StationBenefitUseReview.gmReview.reviewRequested === true, "GM review state should be available for GM-like users after request");

  const reorderState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: state.session, uiState: { travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "navigator"] }, user: { isGM: true } });
  assertSmoke(reorderState.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.ready, "GM explicit reorder request should produce ready review-only candidate");
  assertEqual(reorderState.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.proposedRows[0].stationName, "Engineer", "proposed order should be visible after explicit GM request");
  const nonGmReorderState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: state.session, uiState: { travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "navigator"] }, user: { isGM: false } });
  assertSmoke(!nonGmReorderState.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.ready, "non-GM reorder request should be blocked");
  assertEqual(nonGmReorderState.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.proposedRows.length, 0, "non-GM reorder request should redact proposed rows");

  const gmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: state.session, user: { isGM: true } });
  assertSmoke(gmState.travelV2GmFlowStatus, "GM app state includes Travel v2 flow status strip");
  assertSmoke(gmState.travelV2GmFlowStatus.currentRoundLabel.includes("Round 1"), "GM flow status has current round label");
  assertSmoke(gmState.travelV2GmFlowStatus.stationResolutionLabel.includes("Stations:"), "GM flow status has station readiness label");
  assertSmoke(gmState.travelV2GmFlowStatus.finalizationLabel.includes("Finalization:"), "GM flow status has finalization readiness label");
  assertSmoke(gmState.travelV2GmFlowStatus.consequenceLabel.includes("Consequences:"), "GM flow status has consequence readiness label");
  assertSmoke(gmState.travelV2GmFlowStatus.advanceLabel.includes("Advance:"), "GM flow status has advance readiness label");
  assertSmoke(gmState.travelV2GmFlowStatus.nextActionLabel, "GM flow status includes next action label");
  assertSmoke(gmState.travelV2GmFlowStatus.disabledActions.advanceRound, "GM flow status includes blocked advance disabled reason");

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

  const rolledState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session: {
      event: createRunnerEventFixture(),
      roundResults: [{ stationResults: { navigator: "success", engineer: "skipped" } }]
    }
  });
  assertEqual(rolledState.guidedBridge.nextRequiredAction.title, "Round Pressure Ready", "rolled/skipped stations should unlock pressure review");
  const rolledGmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: rolledState.session, user: { isGM: true } });
  assertSmoke(rolledGmState.travelV2GmFlowStatus.nextActionLabel.includes("pressure") || rolledGmState.travelV2GmFlowStatus.nextActionLabel.includes("Finalize"), "GM next action changes once stations are resolved");
  assertSmoke(rolledState.guidedBridge.nextRequiredAction.buttons.some((button) => button.action === "round-apply" && button.label === "Apply Suggested Pressure"), "pressure-ready queue should expose real apply button");
  assertEqual(rolledState.stations.find((station) => station.stationKey === "engineer")?.stationStateLabel, "Skipped / Not Participating", "skipped stations should render a clear station state label");

  const finalizeReadyState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session: {
      event: { ...createRunnerEventFixture(), rounds: [{ ...createRunnerEventFixture().rounds[0], pressureApplication: { roundIndex: 0, roundNumber: 1, outcomeKey: "mixed" } }] },
      roundResults: [{ stationResults: { navigator: "success", engineer: "skipped" } }]
    },
    user: { isGM: true }
  });
  assertSmoke(finalizeReadyState.travelV2GmFlowStatus.blockers.includes("Finalize this round before advancing."), "GM flow status exposes finalization-only advance blocker");
  assertSmoke(finalizeReadyState.travelV2GmFlowStatus.showFinalizeRoundAction === true, "GM flow status exposes visible finalize-round action when blocked only by finalization");
  assertEqual(finalizeReadyState.travelV2GmFlowStatus.finalizeRoundActionLabel, "Finalize Round", "visible finalize-round action has clear label");


  const queueState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    user: { isGM: true },
    session: {
      key: "consumer-queue",
      status: "completed",
      completed: true,
      completedAt: "2026-06-26T00:00:00.000Z",
      event: { rounds: [{ roundNumber: 1 }] },
      travelV2FocusBacklashRecords: { records: [{ id: "f1", roundIndex: 0, stationName: "Engineer", status: "pending", publicRiskText: "The arkengine shudders.", publicBacklashPreviewText: "Review Strain pressure." }] },
      travelV2PendingConsequenceQueue: { version: 1, records: [{ queueKey: "focus-backlash:f1", status: "pending", mutation: "none", selectedConsequence: { id: "consequence-arkengine-whine" } }] },
      travelV2ConsequenceFollowups: { version: 1, records: [{ queueKey: "followup:1", title: "Legacy", summary: "Review later." }, { queueKey: "followup:2", title: "Reviewed", status: "reviewed" }, { queueKey: "followup:3", title: "Deferred", status: "deferred" }, { queueKey: "followup:4", title: "Resolved", status: "resolved" }] }
    }
  });
  assertSmoke(!queueState.travelV2GmFlowStatus?.consequenceLabel.includes("pending") && queueState.travelV2GmFlowStatus?.nextActionLabel === "Travel event completed.", "completed GM flow status suppresses pending consequence blockers");
  assertSmoke(queueState.pendingConsequenceQueue.applyStatusSummary.executableCount === 1, "app state exposes applyStatusSummary executableCount for the batch Apply button");
  assertSmoke(queueState.pendingConsequenceQueue.clearSelectionSummary && Number.isInteger(queueState.pendingConsequenceQueue.clearSelectionSummary.clearableCount), "app state exposes pendingConsequenceQueue.clearSelectionSummary.clearableCount");
  assertSmoke(queueState.pendingConsequenceQueue.singleSuggestionSelectionSummary && Number.isInteger(queueState.pendingConsequenceQueue.singleSuggestionSelectionSummary.eligibleCount), "app state exposes pendingConsequenceQueue.singleSuggestionSelectionSummary.eligibleCount");
  assertSmoke(Array.isArray(queueState.pendingConsequenceQueue.gmItemGroups), "app state exposes pendingConsequenceQueue.gmItemGroups");
  assertSmoke(queueState.pendingConsequenceQueue.gmItemGroups.find((group)=>group.key==="readyToApply")?.count===1, "app state exposes readyToApply count when an executable selected item exists");
  assertSmoke(queueState.consequenceFollowupReview?.hasRecords===true, "app state exposes consequenceFollowupReview.hasRecords");
  assertSmoke(queueState.consequenceFollowupReview.openCount===1 && queueState.consequenceFollowupReview.reviewedCount===1 && queueState.consequenceFollowupReview.deferredCount===1 && queueState.consequenceFollowupReview.resolvedCount===1, "app state exposes follow-up review status counts");
  const needsSelectionState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: true }, session: { key:"consumer-queue-unselected", status:"completed", completed:true, event:{rounds:[{roundNumber:1}]}, travelV2FocusBacklashRecords:{records:[{id:"f2",roundIndex:0,stationName:"Engineer",status:"pending",publicRiskText:"The arkengine shudders."}]} } });
  assertSmoke(needsSelectionState.pendingConsequenceQueue.gmItemGroups.find((group)=>group.key==="needsSelection")?.count===1, "app state exposes needsSelection count when an unselected item exists");
  const nonGmQueueState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
    session: queueState.session,
    user: { isGM: false }
  });
  assertSmoke(nonGmQueueState.isGM === false && !Object.hasOwn(nonGmQueueState, "canManageTravelV2Consequences"), "non-GM app state omits consequence queue management flag");
  const nonGmQueueStateJson = JSON.stringify(nonGmQueueState);
  for (const forbidden of ["gmItemGroups","singleSuggestionSelectionSummary","clearSelectionSummary","applyStatusSummary","consequenceFollowupReview","catalogSuggestions","selectedConsequenceApplyPreview","applyEffectSummary","sourceRecord"]) assertSmoke(!nonGmQueueStateJson.includes(forbidden), `non-GM app state does not expose GM-only queue field ${forbidden}`);
  const playerSafeQueue = JSON.stringify(queueState.pendingConsequenceQueue.playerSafeItems);
  assertSmoke(!playerSafeQueue.includes("gmItemGroups") && !playerSafeQueue.includes("singleSuggestionSelectionSummary") && !playerSafeQueue.includes("clearSelectionSummary") && !playerSafeQueue.includes("canClearSelectedConsequence") && !playerSafeQueue.includes("appliedEffect") && !playerSafeQueue.includes("selectedConsequenceApplyPreview") && !playerSafeQueue.includes("selectedConsequence") && !playerSafeQueue.includes("applyEffectSummary") && !playerSafeQueue.includes("sourceRecord") && !playerSafeQueue.includes("catalogSuggestions") && !playerSafeQueue.includes("Arkengine Whine") && !playerSafeQueue.includes("appliedEffectMutations") && !playerSafeQueue.includes("consequenceFollowupReview") && !playerSafeQueue.includes("travelV2ConsequenceFollowups") && !playerSafeQueue.includes("followupRecord"), "player-safe state does not expose selection summaries or GM-only apply details");
  const runnerSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "travel-event-runner.js"), "utf8");
  assertSmoke(runnerSource.includes("updateTravelV2ConsequenceFollowupStatus"), "runner imports updateTravelV2ConsequenceFollowupStatus");
  assertSmoke(runnerSource.includes("[data-arcflight-travel-v2-followup-note-status]"), "RUNNER_CLICK_SELECTOR includes follow-up note status selector");
  assertSmoke(runnerSource.includes("updateTravelV2ConsequenceFollowupStatus(this.session, followupKey, status)"), "runner handler calls updateTravelV2ConsequenceFollowupStatus");
  assertSmoke(!runnerSource.includes("createJournalEntry") && !runnerSource.includes("socket.emit") && !runnerSource.includes("fromCompendium") && !runnerSource.includes("game.settings.set"), "runner source does not add new journal/socket/compendium/world mutation calls for follow-up note status controls");
  assertSmoke(runnerSource.includes("applyAllExecutableTravelV2SelectedConsequencesToSession"), "runner imports or references the batch selected consequence helper");
  assertSmoke(runnerSource.includes(`[data-action="arcflight-travel-v2-apply-all-selected-consequences"]`), "RUNNER_CLICK_SELECTOR includes the batch selected consequence data-action selector");
  assertSmoke(runnerSource.includes(`target.dataset.action === "arcflight-travel-v2-apply-all-selected-consequences"`), "runner keeps the exact batch selected consequence handler condition");
  assertSmoke(runnerSource.includes("selectAllSingleSuggestionTravelV2PendingConsequences"), "runner imports selectAllSingleSuggestionTravelV2PendingConsequences");
  assertSmoke(runnerSource.includes(`[data-action="arcflight-travel-v2-select-all-single-suggestion-consequences"]`), "RUNNER_CLICK_SELECTOR includes the single-suggestion selection data-action selector");
  const templateSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/apps/travel-event-runner.hbs"), "utf8");
  assertSmoke(templateSource.includes("state.travelV2GmFlowStatus.showFinalizeRoundAction"), "template gates the GM flow finalize-round button from UI state");
  assertSmoke(templateSource.includes("data-arcflight-travel-v2-round-finalize"), "template renders a button wired to the existing finalize round handler");
  assertSmoke(runnerSource.includes(`target.dataset.action === "arcflight-travel-v2-select-all-single-suggestion-consequences"`), "runner keeps the exact single-suggestion selection handler condition");
  assertSmoke(runnerSource.includes("selectAllSingleSuggestionTravelV2PendingConsequences(this.session)"), "runner handler calls selectAllSingleSuggestionTravelV2PendingConsequences(this.session)");
  assertSmoke(runnerSource.includes("clearTravelV2PendingConsequenceSelection"), "runner imports clearTravelV2PendingConsequenceSelection");
  assertSmoke(runnerSource.includes("clearAllTravelV2PendingConsequenceSelections"), "runner imports clearAllTravelV2PendingConsequenceSelections");
  assertSmoke(runnerSource.includes("[data-arcflight-travel-v2-pending-consequence-clear-selection]"), "RUNNER_CLICK_SELECTOR includes per-item clear selection selector");
  assertSmoke(runnerSource.includes(`[data-action="arcflight-travel-v2-clear-all-selected-consequences"]`), "RUNNER_CLICK_SELECTOR includes clear all selected data-action selector");
  assertSmoke(runnerSource.includes("clearTravelV2PendingConsequenceSelection(this.session, queueKey)"), "runner handler calls clearTravelV2PendingConsequenceSelection(this.session, queueKey)");
  assertSmoke(runnerSource.includes("clearAllTravelV2PendingConsequenceSelections(this.session)"), "runner handler calls clearAllTravelV2PendingConsequenceSelections(this.session)");
  assertSmoke(!runnerSource.includes("Actor.create") && !runnerSource.includes("Item.create") && !runnerSource.includes("ChatMessage.create") && !runnerSource.includes("JournalEntry.create") && !runnerSource.includes("Combat.create") && !runnerSource.includes("Scene.create") && !runnerSource.includes("TokenDocument.create") && !runnerSource.includes("game.socket") && !runnerSource.includes("socket.emit") && !runnerSource.includes("fromCompendium") && !runnerSource.includes("game.settings.set"), "runner source does not add new actor/item/chat/journal/combat/scene/token/socket/compendium/world mutation calls for this feature");

  return {
    ok: true,
    checked: [
      "consumer-version",
      "empty-app-state",
      "active-app-state",
      "ui-state-preservation",
      "preview-row-exposure",
      "preview-panel-exposure",
      "station-benefit-display-state",
      "round-action-order-panel-state",
      "preview-only-pressure",
      "guided-empty-start",
      "guided-send-refresh",
      "pressure-ready-after-skipped",
      "gm-flow-status-strip",
      "gm-disabled-action-reasons",
      "gm-visible-finalize-round-action"
    ]
  };
}

export default runTravelEventRunnerV2PreviewConsumerSmokeChecks;
