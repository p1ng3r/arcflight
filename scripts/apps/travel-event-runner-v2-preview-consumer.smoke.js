import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  prepareTravelEventRunnerAppStateWithTravelV2Preview,
  TRAVEL_EVENT_RUNNER_V2_PREVIEW_CONSUMER_VERSION
} from "./travel-event-runner-v2-preview-consumer.js";
import { applyTravelV2EventApproachTallyApplicationRecordControlToSession } from "../helpers/travel-v2-session-round-finalization.js";

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
    roundCount: 4,
    availableCoreStations: ["captain", "navigator", "engineer", "veilwarden", "watchmaster"],
    setup: { openingPremise: "A lantern burns inside silver static ahead.", openingVignette: "Static ripples across the bow." },
    stakes: { threatenedResources: ["lifeveil", "morale"], knownDangers: ["Known danger: the static repeats shipboard orders.", "Suspicious tell: the lantern answers too quickly."], broadSuccessReward: "A route clue becomes clear.", broadFailureDanger: "An occult scar may follow the ship." },
    gm: { notes: "GM note stays separate.", hiddenHazards: [{ name: "Voice Thief" }], futureTriggers: ["answered-voice"], internalScoring: { failures: 0 } },
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

export async function runTravelEventRunnerV2PreviewConsumerSmokeChecks() {
  assertEqual(TRAVEL_EVENT_RUNNER_V2_PREVIEW_CONSUMER_VERSION, 4, "consumer version should be 4");

  const emptyState = prepareTravelEventRunnerAppStateWithTravelV2Preview();
  assertSmoke(!emptyState.hasSession, "empty app state should have no session");
  assertSmoke(emptyState.travelV2Preview, "empty app state should expose preview object");
  assertSmoke(emptyState.travelV2PreviewPanel, "empty app state should expose preview panel object");
  assertSmoke(emptyState.travelV2SetupStakes?.hasSession === false, "empty app state should mark setup stakes as non-renderable without a session");
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
  assertSmoke(state.travelV2SetupStakes.ok, "runner render state should include valid setup stakes");
  assertEqual(state.travelV2SetupStakes.playerSafe.eventName, "V2 App Preview Test", "runner setup state should include event name");
  assertSmoke(state.travelV2SetupStakes.playerSafe.openingPremise.includes("lantern"), "runner setup state should include opening premise");
  assertEqual(state.travelV2SetupStakes.playerSafe.roundCount, 4, "runner setup state should include round count");
  assertSmoke(state.travelV2SetupStakes.playerSafe.threatenedResources.includes("lifeveil"), "runner setup state should include threatened resources");
  assertSmoke(state.travelV2SetupStakes.playerSafe.knownDangers.some((entry) => entry.includes("Known danger")), "runner setup state should keep known danger prose");
  assertSmoke(state.travelV2SetupStakes.playerSafe.knownDangers.some((entry) => entry.includes("Suspicious tell")), "runner setup state should keep suspicious tell prose");
  assertSmoke(state.travelV2SetupStakes.playerSafe.broadSuccessReward.includes("route clue"), "runner setup state should include broad success reward");
  assertSmoke(state.travelV2SetupStakes.playerSafe.broadFailureDanger.includes("occult scar"), "runner setup state should include broad failure danger");
  assertSmoke(state.travelV2SetupStakes.playerSafe.availableCoreStations.includes("watchmaster"), "runner setup state should include available core stations");
  assertSmoke(!JSON.stringify(state.travelV2SetupStakes).includes("Voice Thief") && !JSON.stringify(state.travelV2SetupStakes).includes("GM note"), "non-GM setup state should not expose GM-only setup fields");

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


  const riskBidSideEffects = [];
  const riskBidPrior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game };
  globalThis.Actor = { update: () => riskBidSideEffects.push("actor.update"), create: () => riskBidSideEffects.push("Actor.create") };
  globalThis.Item = { create: () => riskBidSideEffects.push("Item.create") };
  globalThis.ChatMessage = { create: () => riskBidSideEffects.push("ChatMessage.create") };
  globalThis.JournalEntry = { create: () => riskBidSideEffects.push("JournalEntry.create") };
  globalThis.game = { socket: { emit: () => riskBidSideEffects.push("socket.emit") }, user: { isGM: false } };
  try {
    const riskBidSession = {
      event: createRunnerEventFixture(),
      currentRoundIndex: 0,
      travelV2RiskBidSelections: {
        records: [
          { selected: true, roundIndex: 0, roundNumber: null, stationKey: "navigator", actionId: "plot-course", tier: "+5", selectedAt: "2026-07-12T00:00:00.000Z", gmOnly: true, secret: "bait", actorUuid: "Actor.bad", targetActorUuid: "Actor.target", userId: "u1", userName: "GM", applyPayload: { bad: true }, auditRecord: { bad: true } },
          { selected: true, roundIndex: null, roundNumber: null, stationKey: "navigator", actionId: "plot-course", tier: 8, selectedAt: "2026-07-12T00:00:01.000Z", secret: "missing round" },
          { selected: true, roundIndex: null, roundNumber: 0, stationKey: "navigator", actionId: "plot-course", tier: 2, selectedAt: "2026-07-12T00:00:02.000Z", secret: "round zero bait" },
          { selected: true, roundIndex: 0, stationKey: "engineer", actionId: "repair", tier: 8, selectedAt: "2026-07-12T00:00:03.000Z", secret: "wrong context" }
        ]
      }
    };
    const riskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: riskBidSession,
      uiState: {
        travelV2RiskBidContext: {
          roundIndex: 0,
          stationKey: "navigator",
          stationName: "Navigator",
          actionId: "plot-course",
          actionName: "Plot Course",
          riskBids: [
            { tier: 2, label: "Skim", text: "Take a small risk.", gmOnly: true },
            { tier: 5, label: "Thread", text: "Take a moderate risk.", secret: "bait" },
            { tier: 5, label: "Duplicate", text: "Drop me." },
            { tier: 3, label: "Invalid", text: "Drop me." },
            { tier: "+8", label: "Blind", text: "Take a big risk." }
          ]
        }
      },
      user: { isGM: false }
    });
    assertSmoke(riskBidState.travelV2RiskBids, "runner app state exposes travelV2RiskBids");
    assertSmoke(riskBidState.riskBids, "runner app state exposes short riskBids alias");
    assertEqual(JSON.stringify(riskBidState.travelV2RiskBids), JSON.stringify(riskBidState.riskBids), "risk bid aliases expose the same player-safe content");
    assertSmoke(riskBidState.travelV2RiskBidResultPreview, "runner app state exposes travelV2RiskBidResultPreview");
    assertSmoke(riskBidState.riskBidResultPreview, "runner app state exposes short riskBidResultPreview alias");
    assertEqual(JSON.stringify(riskBidState.travelV2RiskBidResultPreview), JSON.stringify(riskBidState.riskBidResultPreview), "risk bid result preview aliases expose equivalent player-safe content");
    assertSmoke(!riskBidState.riskBidResultPreview.ok && riskBidState.riskBidResultPreview.blockedReasons.includes("missing-risk-bid-result-band"), "missing result band blocks safely");
    assertEqual(riskBidState.riskBids.options.map((option) => option.tier).join(","), "2,5,8", "runner risk bid state exposes only fixed valid tiers and dedupes duplicates");
    assertSmoke(riskBidState.riskBids.selected === true, "matching session-local risk bid selection is projected");
    assertEqual(riskBidState.riskBids.selectedTier, 5, "matching selection tier is normalized");
    assertEqual(riskBidState.riskBids.selectedDcModifier, 5, "matching selection DC modifier is normalized");
    assertEqual(riskBidState.riskBids.selectedRecord.stationKey, "navigator", "matching selected record uses station context");
    assertEqual(riskBidState.riskBids.selectedRecord.roundNumber, null, "matching selected record preserves null roundNumber instead of coercing to zero");
    assertSmoke(!JSON.stringify(riskBidState.riskBids).includes("engineer"), "non-matching risk bid selection is not projected");
    for (const key of ["version", "selected", "roundIndex", "roundNumber", "stationKey", "actionId", "tier", "dcModifier", "selectedAt"]) assertSmoke(Object.hasOwn(riskBidState.riskBids.selectedRecord, key), `selected risk bid record includes safe key ${key}`);
    for (const key of ["gmOnly", "secret", "actorUuid", "targetActorUuid", "userId", "userName", "applyPayload", "auditRecord"]) assertSmoke(!Object.hasOwn(riskBidState.riskBids.selectedRecord, key), `selected risk bid record excludes unsafe key ${key}`);
    assertSmoke(riskBidState.riskBids.options.length === 3, "template/app state can render risk bid options from state.riskBids");
    const runnerTemplate = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/apps/travel-event-runner.hbs"), "utf8");
    assertSmoke(runnerTemplate.includes("data-arcflight-travel-v2-risk-bid-select") && runnerTemplate.includes('data-risk-bid-tier="{{tier}}"'), "risk bid template exposes select button attributes");
    assertSmoke(!runnerTemplate.includes('data-risk-bid-tier="3"') && !runnerTemplate.includes('data-risk-bid-tier="{{text}}"'), "risk bid template does not hard-code invalid tier select buttons");
    assertSmoke(runnerTemplate.includes("{{#if state.riskBids.selected}}<button") && runnerTemplate.includes("data-arcflight-travel-v2-risk-bid-clear"), "risk bid template gates clear button on selected state");
    assertSmoke(runnerTemplate.includes("Risk Bid Review Queue"), "template contains GM-only risk bid review queue section title");
    assertSmoke(runnerTemplate.includes("data-arcflight-travel-v2-risk-bid-review-queue-persist"), "template contains existing risk bid review queue persist selector");
    assertSmoke(runnerTemplate.includes("state.travelV2RiskBidReviewQueuePersistResult.persisted"), "template displays persisted status from persist result persisted flag");
    assertSmoke(!runnerTemplate.includes("Persisted: {{state.travelV2RiskBidReviewQueuePersistResult.inserted}}"), "template does not label inserted as persisted");
    const riskBidQueueSectionStart = runnerTemplate.lastIndexOf("{{#if state.isGM}}", runnerTemplate.indexOf("Risk Bid Review Queue"));
    const riskBidQueueTemplateSection = runnerTemplate.slice(riskBidQueueSectionStart, runnerTemplate.indexOf("Station Action Lock-In"));
    assertSmoke(riskBidQueueSectionStart >= 0 && riskBidQueueTemplateSection.includes("arcflight-travel-runner-mvp__risk-bid-review-queue"), "risk bid review queue template is GM-gated");
    for (const selector of ["data-arcflight-travel-v2-risk-bid-review-queue-status", "data-arcflight-travel-v2-risk-bid-review-queue-select", "data-arcflight-travel-v2-risk-bid-review-queue-clear-selection", "data-arcflight-travel-v2-risk-bid-review-queue-clear-all-selections"]) assertSmoke(riskBidQueueTemplateSection.includes(selector), `risk bid review queue template includes decision selector ${selector}`);
    for (const label of ["Mark Reviewed", "Dismiss", "Restore Pending", "Select for Apply Review", "Clear Selection"]) assertSmoke(riskBidQueueTemplateSection.includes(label), `risk bid review queue template includes decision label ${label}`);
    assertSmoke(!riskBidQueueTemplateSection.includes("data-arcflight-travel-v2-risk-bid-review-queue-apply"), "risk bid review queue template does not add apply controls");
    assertSmoke(!/(pressure|hazard|consequence|Momentum|scar)[^<]{0,60}(apply|award|spend)/i.test(riskBidQueueTemplateSection), "risk bid review queue template does not add pressure/hazard/consequence/Momentum/scar apply controls");
    for (const forbidden of ["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]) assertSmoke(!riskBidQueueTemplateSection.includes(forbidden), `risk bid review queue template excludes ${forbidden}`);
    assertSmoke(!riskBidState.riskBids.options.some((option) => option.tier === 3), "no select button data can be produced for invalid risk bid tiers");
    const unselectedRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: { ...riskBidSession, travelV2RiskBidSelections: { records: [] } },
      uiState: { travelV2RiskBidContext: { roundIndex: 0, stationKey: "navigator", actionId: "plot-course", riskBids: [{ tier: 2, label: "Skim" }] } },
      user: { isGM: false }
    });
    assertSmoke(unselectedRiskBidState.riskBids.selected === false, "clear button app condition is false without a selection");
    assertSmoke(unselectedRiskBidState.riskBidResultPreview.blockedReasons.includes("missing-selected-risk-bid"), "missing selected risk bid blocks result preview safely");
    const missingResultBandGmRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: { ...riskBidSession, travelV2RiskBidSelections: { records: [{ selected: true, roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", tier: 8, dcModifier: 8 }] } },
      uiState: { travelV2RiskBidContext: { roundIndex: 0, roundNumber: 1, stationKey: "navigator", stationName: "Navigator", actionId: "plot-course", actionName: "Plot Course", riskBids: [{ tier: 8, label: "Blind" }] } },
      user: { isGM: true }
    });
    assertSmoke(!missingResultBandGmRiskBidState.riskBidPendingReview.ok && missingResultBandGmRiskBidState.riskBidPendingReview.blockedReasons.includes("missing-risk-bid-result-band") && missingResultBandGmRiskBidState.riskBidPendingReview.reviewPayloads.length === 0, "missing result band blocks pending review safely");
    const missingSelectedGmRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: { ...riskBidSession, travelV2RiskBidSelections: { records: [] } },
      uiState: { travelV2RiskBidResultBand: "failure", travelV2RiskBidContext: { roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", riskBids: [{ tier: 8, label: "Blind" }] } },
      user: { isGM: true }
    });
    assertSmoke(!missingSelectedGmRiskBidState.riskBidPendingReview.ok && missingSelectedGmRiskBidState.riskBidPendingReview.blockedReasons.includes("missing-selected-risk-bid") && missingSelectedGmRiskBidState.riskBidPendingReview.reviewPayloads.length === 0, "missing selected risk bid blocks pending review safely");
    const failureEightRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: { ...riskBidSession, travelV2RiskBidSelections: { records: [{ selected: true, roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", tier: 8, dcModifier: 8 }] } },
      uiState: { travelV2RiskBidResultBand: "failure", travelV2RiskBidContext: { roundIndex: 0, roundNumber: 1, stationKey: "navigator", stationName: "Navigator", actionId: "plot-course", actionName: "Plot Course", riskBids: [{ tier: 8, label: "Blind" }] } },
      user: { isGM: false }
    });
    assertSmoke(failureEightRiskBidState.riskBidResultPreview.available && failureEightRiskBidState.riskBidResultPreview.ok && failureEightRiskBidState.riskBidResultPreview.hasRiskBidResult, "valid selected risk bid and result band produces an available result preview");
    assertEqual(failureEightRiskBidState.riskBidResultPreview.tier, 8, "valid result preview preserves fixed tier");
    assertEqual(failureEightRiskBidState.riskBidResultPreview.resultBand, "failure", "valid result preview preserves result band");
    assertEqual(failureEightRiskBidState.riskBidResultPreview.dangerLevel, "high", "failure +8 result preview has high danger");
    assertSmoke(Boolean(failureEightRiskBidState.riskBidResultPreview.summary), "valid result preview includes summary");
    assertSmoke(Boolean(failureEightRiskBidState.riskBidResultPreview.playerText), "valid result preview includes player text");
    assertSmoke(failureEightRiskBidState.riskBidResultPreview.candidates.some((candidate) => ["consequenceCandidate", "pressureCandidate", "hazardProgressCandidate", "nextRoundDifficulty"].includes(candidate.type) && candidate.severity === "strong"), "failure +8 preview includes a serious negative candidate");
    assertSmoke(Array.isArray(failureEightRiskBidState.riskBidPendingReview.reviewPayloads) && failureEightRiskBidState.riskBidPendingReview.reviewPayloads.length === 0, "non-GM risk bid pending review does not expose detailed review payloads");
    assertEqual(failureEightRiskBidState.travelV2RiskBidReviewQueuePersistResult, null, "persist result state is not available to non-GM users");
    const failureEightGmRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: { ...riskBidSession, travelV2RiskBidSelections: { records: [{ selected: true, roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", tier: 8, dcModifier: 8 }] } },
      uiState: { travelV2RiskBidResultBand: "failure", travelV2RiskBidContext: { roundIndex: 0, roundNumber: 1, stationKey: "navigator", stationName: "Navigator", actionId: "plot-course", actionName: "Plot Course", riskBids: [{ tier: 8, label: "Blind" }] } },
      user: { isGM: true }
    });
    assertSmoke(failureEightGmRiskBidState.travelV2RiskBidPendingReview, "GM state exposes travelV2RiskBidPendingReview");
    assertSmoke(failureEightGmRiskBidState.riskBidPendingReview, "GM state exposes riskBidPendingReview");
    assertEqual(JSON.stringify(failureEightGmRiskBidState.travelV2RiskBidPendingReview), JSON.stringify(failureEightGmRiskBidState.riskBidPendingReview), "risk bid pending review aliases expose equivalent GM-facing content");
    assertSmoke(failureEightGmRiskBidState.riskBidPendingReview.available && failureEightGmRiskBidState.riskBidPendingReview.ok && failureEightGmRiskBidState.riskBidPendingReview.hasReviewPayloads, "valid selected risk bid and result band produces an available pending review projection");
    assertSmoke(failureEightGmRiskBidState.riskBidPendingReview.queueReady === true && failureEightGmRiskBidState.riskBidPendingReview.inserted === false, "pending review projection is queue-ready but not inserted");
    assertEqual(failureEightGmRiskBidState.riskBidPendingReview.dangerLevel, "high", "failure +8 pending review has high danger");
    assertSmoke(failureEightGmRiskBidState.riskBidPendingReview.reviewPayloads.length > 0, "failure +8 pending review exposes review payloads for GM");
    assertSmoke(failureEightGmRiskBidState.riskBidPendingReview.reviewPayloads.every((payload) => payload.source === "riskBidResult" && payload.queueReady === true), "every risk bid pending review payload is risk bid sourced and queue-ready");
    assertSmoke(failureEightGmRiskBidState.travelV2RiskBidReviewQueue, "GM state exposes travelV2RiskBidReviewQueue");
    assertSmoke(failureEightGmRiskBidState.riskBidReviewQueue, "GM state exposes riskBidReviewQueue");
    assertEqual(JSON.stringify(failureEightGmRiskBidState.travelV2RiskBidReviewQueue), JSON.stringify(failureEightGmRiskBidState.riskBidReviewQueue), "risk bid review queue aliases expose equivalent GM-facing content");
    const failureEightGmPersistResultState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: failureEightGmRiskBidState.session,
      uiState: { travelV2RiskBidReviewQueuePersistResult: { summaryText: "Queued 1 pending risk bid review.", insertedCount: 1, skippedCount: 0, duplicateCount: 0, inserted: true, persisted: true, applied: false } },
      user: { isGM: true }
    });
    assertSmoke(failureEightGmPersistResultState.travelV2RiskBidReviewQueuePersistResult, "persist result state is available to GM users");
    assertEqual(failureEightGmPersistResultState.travelV2RiskBidReviewQueuePersistResult.applied, false, "persist result state remains pending-review only");
    const queuedFailureState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: { ...riskBidSession, travelV2RiskBidReviewQueue: { records: [{ source: "riskBidResult", status: "pending", payloadType: "pressureReview", dangerLevel: "high", stationKey: "navigator", actionId: "plot-course", roundIndex: 0, roundNumber: 1, tier: 8, resultBand: "failure" }] } },
      user: { isGM: true }
    });
    assertEqual(queuedFailureState.riskBidReviewQueue.records.length, 1, "GM queue state exposes session-local records");
    assertEqual(queuedFailureState.riskBidReviewQueue.records[0].status, "pending", "GM queue state preserves pending status");
    const queuedFailurePlayerState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: queuedFailureState.session, user: { isGM: false } });
    assertEqual(queuedFailurePlayerState.riskBidReviewQueue.records.length, 0, "non-GM queue state does not expose detailed records");
    const criticalFailureEightRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: { ...riskBidSession, travelV2RiskBidSelections: { records: [{ selected: true, roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", tier: 8, dcModifier: 8 }] } },
      uiState: { travelV2RiskBidResultBand: "criticalFailure", travelV2RiskBidContext: { roundIndex: 0, roundNumber: 1, stationKey: "navigator", stationName: "Navigator", actionId: "plot-course", actionName: "Plot Course", riskBids: [{ tier: 8, label: "Blind" }] } },
      user: { isGM: false }
    });
    assertEqual(criticalFailureEightRiskBidState.riskBidResultPreview.dangerLevel, "severe", "critical failure +8 result preview has severe danger");
    assertSmoke(criticalFailureEightRiskBidState.riskBidResultPreview.candidates.some((candidate) => candidate.severity === "severe" && candidate.requiresReview === true), "critical failure +8 preview includes severe reviewed candidates");
    const criticalFailureEightGmRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: { ...riskBidSession, travelV2RiskBidSelections: { records: [{ selected: true, roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", tier: 8, dcModifier: 8 }] } },
      uiState: { travelV2RiskBidResultBand: "criticalFailure", travelV2RiskBidContext: { roundIndex: 0, roundNumber: 1, stationKey: "navigator", stationName: "Navigator", actionId: "plot-course", actionName: "Plot Course", riskBids: [{ tier: 8, label: "Blind" }] } },
      user: { isGM: true }
    });
    assertEqual(criticalFailureEightGmRiskBidState.riskBidPendingReview.dangerLevel, "severe", "critical failure +8 pending review has severe danger");
    const criticalPayloadTypes = criticalFailureEightGmRiskBidState.riskBidPendingReview.reviewPayloads.map((payload) => payload.payloadType);
    assertSmoke(criticalPayloadTypes.includes("shipScarReview") || criticalPayloadTypes.includes("severePressureReview"), "critical failure +8 pending review includes ship scar or severe pressure review");
    assertSmoke(criticalPayloadTypes.some((type) => ["additionalHazardReview", "hazardEscalationReview", "consequenceReview"].includes(type)), "critical failure +8 pending review includes an additional serious payload");
    const allowedReviewPayloadKeys = ["adapterVersion", "source", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "requiresReview", "queueReady"];
    for (const payload of criticalFailureEightGmRiskBidState.riskBidPendingReview.reviewPayloads) assertEqual(Object.keys(payload).sort().join(","), allowedReviewPayloadKeys.slice().sort().join(","), "risk bid pending review payload objects expose only safe keys");
    const invalidBandRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: failureEightRiskBidState.session,
      uiState: { travelV2RiskBidResultBand: "freeform", travelV2RiskBidContext: { roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", riskBids: [{ tier: 8, label: "Blind" }] } },
      user: { isGM: true }
    });
    assertSmoke(!invalidBandRiskBidState.riskBidResultPreview.ok && invalidBandRiskBidState.riskBidResultPreview.blockedReasons.includes("invalid-risk-bid-result-band"), "invalid/freeform result bands block safely");
    assertSmoke(!invalidBandRiskBidState.riskBidPendingReview.ok && invalidBandRiskBidState.riskBidPendingReview.reviewPayloads.length === 0, "invalid/freeform result bands block pending review safely");
    const invalidTierRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: { ...riskBidSession, travelV2RiskBidSelections: { records: [{ selected: true, roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", tier: 3, dcModifier: 3 }] } },
      uiState: { travelV2RiskBidResultBand: "failure", travelV2RiskBidContext: { roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", riskBids: [{ tier: 3, label: "Invalid" }] } },
      user: { isGM: true }
    });
    assertSmoke(!invalidTierRiskBidState.riskBidResultPreview.ok && invalidTierRiskBidState.riskBidResultPreview.candidates.length === 0, "invalid/freeform tiers do not produce result candidates");
    assertSmoke(!invalidTierRiskBidState.riskBidPendingReview.ok && invalidTierRiskBidState.riskBidPendingReview.reviewPayloads.length === 0, "invalid/freeform tiers do not produce review payloads");
    const allowedCandidateKeys = ["type", "severity", "tier", "resultBand", "label", "text", "requiresReview"];
    for (const candidate of criticalFailureEightRiskBidState.riskBidResultPreview.candidates) assertEqual(Object.keys(candidate).sort().join(","), allowedCandidateKeys.slice().sort().join(","), "candidate objects expose only safe keys");
    const riskBidResultJson = JSON.stringify(criticalFailureEightRiskBidState.riskBidResultPreview) + JSON.stringify(failureEightRiskBidState.riskBidResultPreview);
    const riskBidPendingReviewJson = JSON.stringify(criticalFailureEightGmRiskBidState.riskBidPendingReview) + JSON.stringify(failureEightGmRiskBidState.riskBidPendingReview) + JSON.stringify(failureEightRiskBidState.riskBidPendingReview);
    const riskBidQueueJson = JSON.stringify(failureEightGmRiskBidState.riskBidReviewQueue) + JSON.stringify(queuedFailureState.riskBidReviewQueue) + JSON.stringify(queuedFailurePlayerState.riskBidReviewQueue);
    const riskBidPersistResultJson = JSON.stringify(failureEightGmPersistResultState.travelV2RiskBidReviewQueuePersistResult) + JSON.stringify(failureEightRiskBidState.travelV2RiskBidReviewQueuePersistResult);
    for (const forbidden of ["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]) {
      assertSmoke(!riskBidResultJson.includes(forbidden), `risk bid result preview excludes ${forbidden}`);
      assertSmoke(!riskBidPendingReviewJson.includes(forbidden), `risk bid pending review excludes ${forbidden}`);
      assertSmoke(!riskBidQueueJson.includes(forbidden), `risk bid review queue excludes ${forbidden}`);
      assertSmoke(!riskBidPersistResultJson.includes(forbidden), `risk bid review queue persist result excludes ${forbidden}`);
    }
    globalThis.foundry ??= { applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (Base) => Base } }, utils: { deepClone: (value) => JSON.parse(JSON.stringify(value)), escapeHTML: (value) => String(value) } };
    const { prepareTravelV2RiskBidSelectRunnerUpdate, prepareTravelV2RiskBidClearRunnerUpdate } = await import("./travel-event-runner.js");
    const selectedOnce = prepareTravelV2RiskBidSelectRunnerUpdate({ event: createRunnerEventFixture(), currentRoundIndex: 0 }, riskBidState.riskBids, 2, { selectedAt: "2026-07-12T00:00:04.000Z" });
    assertSmoke(selectedOnce.result.ok && selectedOnce.nextSession.travelV2RiskBidSelections.records.length === 1, "selecting a risk bid calls selection helper pathway and updates session-local records");
    const selectedTwice = prepareTravelV2RiskBidSelectRunnerUpdate(selectedOnce.nextSession, riskBidState.riskBids, 8, { selectedAt: "2026-07-12T00:00:05.000Z" });
    assertEqual(selectedTwice.nextSession.travelV2RiskBidSelections.records.length, 1, "re-selecting same round/station/action replaces rather than duplicates");
    assertEqual(selectedTwice.nextSession.travelV2RiskBidSelections.records[0].tier, 8, "re-selecting updates the selected risk bid tier");
    const extraSelection = prepareTravelV2RiskBidSelectRunnerUpdate(selectedTwice.nextSession, { ...riskBidState.riskBids, stationKey: "engineer", actionId: "repair" }, 5, { selectedAt: "2026-07-12T00:00:06.000Z" });
    const cleared = prepareTravelV2RiskBidClearRunnerUpdate(extraSelection.nextSession, riskBidState.riskBids);
    assertSmoke(cleared.result.ok && cleared.result.cleared, "clearing calls clear helper pathway");
    assertEqual(cleared.nextSession.travelV2RiskBidSelections.records.length, 1, "clearing removes only matching selection");
    assertEqual(cleared.nextSession.travelV2RiskBidSelections.records[0].stationKey, "engineer", "clearing preserves non-matching selections");
    const riskBidJson = JSON.stringify(riskBidState.riskBids);
    for (const forbidden of ["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actor", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]) {
      assertSmoke(!riskBidJson.includes(forbidden), `runner risk bid state excludes ${forbidden}`);
    }
    const changedFiles = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" }).split("\n").filter(Boolean);
    assertSmoke(changedFiles.includes("templates/apps/travel-event-runner.hbs"), "risk bid review queue UI slice changes the runner template");
    assertSmoke(!changedFiles.some((file) => file.endsWith(".css") && file !== "styles/arcflight.css"), "risk bid review queue UI slice does not touch unrelated style files");
    const noRoundRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({
      session: riskBidSession,
      uiState: {
        travelV2RiskBidContext: {
          roundIndex: null,
          roundNumber: null,
          stationKey: "navigator",
          stationName: "Navigator",
          actionId: "plot-course",
          actionName: "Plot Course",
          riskBids: [{ tier: 2, label: "Skim", text: "Take a small risk." }]
        }
      },
      user: { isGM: false }
    });
    assertSmoke(noRoundRiskBidState.riskBids.hasRiskBids === true, "station/action risk bid context without a valid round still prepares safe options");
    assertSmoke(noRoundRiskBidState.riskBids.blockedReasons.includes("missing-round-context"), "station/action risk bid context without a valid round reports safe blocked reason");
    assertSmoke(noRoundRiskBidState.riskBids.selected === false && noRoundRiskBidState.riskBids.selectedRecord === null, "station/action context without a valid round does not project null-round or round-zero selections");
    assertSmoke(!JSON.stringify(noRoundRiskBidState.riskBids).includes('"roundNumber":0'), "station/action context without a valid round does not fabricate roundNumber zero");
    const missingRiskBidState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: riskBidSession, user: { isGM: false } });
    assertSmoke(missingRiskBidState.riskBids.hasRiskBids === false, "missing station/action context has no risk bids");
    assertSmoke(missingRiskBidState.riskBids.blockedReasons.includes("missing-station-action-context"), "missing station/action context reports safe blocked reason");
    assertSmoke(missingRiskBidState.riskBids.selected === false && missingRiskBidState.riskBids.selectedRecord === null, "missing context does not project selections");
    assertEqual(riskBidSideEffects.length, 0, "runner risk bid state exposure does not call mutation APIs");
  } finally {
    globalThis.Actor = riskBidPrior.Actor;
    globalThis.Item = riskBidPrior.Item;
    globalThis.ChatMessage = riskBidPrior.ChatMessage;
    globalThis.JournalEntry = riskBidPrior.JournalEntry;
    globalThis.game = riskBidPrior.game;
  }

  const reorderState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: state.session, uiState: { travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "navigator"] }, user: { isGM: true } });
  assertSmoke(reorderState.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.ready, "GM explicit reorder request should produce ready review-only candidate");
  assertEqual(reorderState.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.proposedRows[0].stationName, "Engineer", "proposed order should be visible after explicit GM request");
  const nonGmReorderState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: state.session, uiState: { travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "navigator"] }, user: { isGM: false } });
  assertSmoke(!nonGmReorderState.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.ready, "non-GM reorder request should be blocked");
  assertEqual(nonGmReorderState.travelV2PreviewPanel.roundActionOrderDisplay.reorderRequest.proposedRows.length, 0, "non-GM reorder request should redact proposed rows");

  const gmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: { event: createRunnerEventFixture() }, user: { isGM: true } });
  assertSmoke(gmState.travelV2GmFlowStatus, "GM app state includes Travel v2 flow status strip");
  assertSmoke(gmState.travelV2GmFlowStatus.currentRoundLabel.includes("Round 1"), "GM flow status has current round label");
  assertSmoke(gmState.travelV2GmFlowStatus.stationResolutionLabel.includes("Stations:"), "GM flow status has station readiness label");
  assertSmoke(gmState.travelV2GmFlowStatus.finalizationLabel.includes("Finalization:"), "GM flow status has finalization readiness label");
  assertSmoke(gmState.travelV2GmFlowStatus.consequenceLabel.includes("Consequences:"), "GM flow status has consequence readiness label");
  assertSmoke(gmState.travelV2GmFlowStatus.advanceLabel.includes("Advance:"), "GM flow status has advance readiness label");
  assertSmoke(gmState.travelV2GmFlowStatus.nextActionLabel, "GM flow status includes next action label");
  assertSmoke(gmState.travelV2GmFlowStatus.disabledActions.advanceRound, "GM flow status includes blocked advance disabled reason");
  assertSmoke(gmState.travelV2SetupStakes.hasGmFacingNotes, "GM setup state may include separated GM-facing notes");
  assertSmoke(JSON.stringify(gmState.travelV2SetupStakes.gmFacing).includes("Voice Thief"), "GM setup state retains hidden hazards separately");

  const eventApproachControlRecord = {
    id: "travel-v2-event-approach-apply-record:0:eventApproach:2",
    recordType: "eventApproachTallyApplication",
    status: "reviewOnly",
    sourceRoundIndex: 0,
    sourceRoundNumber: 1,
    sourceTallyKey: "eventApproach",
    sourceTallySummary: { tallyKey: "eventApproach", tallyType: "eventApproach", totalContributionValue: 2, contributionCount: 2, positiveContributionCount: 2, contributingStationLabels: ["Captain", "Navigator"], hasContributions: true, roundIndex: 0, roundNumber: 1, playerSafe: true, readOnly: true },
    progressDeltaPreview: 2,
    applied: false,
    reviewOnly: true,
    playerSafe: true,
    readOnly: true
  };
  const eventApproachControlSession = { event: createRunnerEventFixture(), currentRoundIndex: 0, travelV2EventApproachTallyApplicationRecords: { records: [eventApproachControlRecord], playerSafe: true, readOnly: true } };
  const eventApproachGmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: eventApproachControlSession, user: { isGM: true } });
  assertSmoke(eventApproachGmState.travelV2EventApproachTallyApplicationControls.hasRecords, "GM app state includes Event Approach tally application controls");
  assertSmoke(eventApproachGmState.travelV2PreviewPanel.travelV2EventApproachTallyApplicationControls.hasRecords, "GM panel state includes Event Approach tally application controls");
  assertSmoke(eventApproachGmState.travelV2EventApproachTallyApplicationControls.records[0].canApply === true && eventApproachGmState.travelV2EventApproachTallyApplicationControls.records[0].requiresExplicitConfirmation === true, "ready GM Event Approach controls can apply and require explicit confirmation");
  const eventApproachPlayerState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: eventApproachControlSession, user: { isGM: false } });
  assertSmoke(eventApproachPlayerState.travelV2EventApproachTallyApplicationControls.records[0].canApply === false && eventApproachPlayerState.travelV2EventApproachTallyApplicationControls.records[0].readOnly === true, "non-GM Event Approach controls are read-only");
  assertSmoke(eventApproachPlayerState.travelV2PreviewPanel.travelV2EventApproachTallyApplicationControls.records[0].canApply === false && eventApproachPlayerState.travelV2PreviewPanel.travelV2EventApproachTallyApplicationControls.records[0].readOnly === true, "non-GM panel Event Approach controls are read-only");
  const eventApproachPlayerJson = JSON.stringify(eventApproachPlayerState.travelV2EventApproachTallyApplicationControls) + JSON.stringify(eventApproachPlayerState.travelV2PreviewPanel.travelV2EventApproachTallyApplicationControls);
  for (const forbidden of ["confirmationPrompt", "requiresExplicitConfirmation", "auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
    assertSmoke(!eventApproachPlayerJson.includes(forbidden), `non-GM Event Approach controls exclude ${forbidden}`);
  }
  const eventApproachControlApply = applyTravelV2EventApproachTallyApplicationRecordControlToSession(eventApproachControlSession, eventApproachControlRecord.id, { confirmedByGM: true, now: "2026-06-19T00:00:08.000Z" });
  const eventApproachControlReapply = applyTravelV2EventApproachTallyApplicationRecordControlToSession(eventApproachControlApply.session, eventApproachControlRecord.id, { confirmedByGM: true, now: "2026-06-19T00:00:08.000Z" });
  assertSmoke(eventApproachControlApply.ok && eventApproachControlReapply.ok && eventApproachControlReapply.session.travelV2EventApproachTallyApplicationRecords.records.length === 1, "confirmed Event Approach control wrapper apply remains idempotent");
  const invalidRoundSetupState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: { event: { ...createRunnerEventFixture(), roundCount: 2 } }, user: { isGM: false } });
  assertSmoke(!invalidRoundSetupState.travelV2SetupStakes.ok && invalidRoundSetupState.travelV2SetupStakes.hasValidationMessages, "invalid round count produces safe setup validation state");
  const missingCoreSetupState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: { event: { ...createRunnerEventFixture(), availableCoreStations: ["captain", "navigator", "engineer", "veilwarden"] } }, user: { isGM: false } });
  assertSmoke(!missingCoreSetupState.travelV2SetupStakes.ok && missingCoreSetupState.travelV2SetupStakes.validationMessages.includes("Setup is missing an alpha core station."), "missing core station produces safe setup validation state");
  const leakySetupState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: { event: { ...createRunnerEventFixture(), player: { knownDangers: ["safe suspicious tell", "AuditRecord leak", "gm-only leak", "HIDDEN HAZARD leak", "future trigger leak", "internal scoring leak", "consequence tree leak", "debug report leak"], broadFailureDanger: "SECRET leak" } } }, user: { isGM: false } });
  assertEqual(leakySetupState.travelV2SetupStakes.playerSafe.knownDangers.length, 1, "case-insensitive and human-readable forbidden setup terms are redacted");
  assertEqual(leakySetupState.travelV2SetupStakes.playerSafe.broadFailureDanger, "", "case-insensitive forbidden scalar setup terms are redacted");
  const leakySetupJson = JSON.stringify(leakySetupState.travelV2SetupStakes);
  for (const forbidden of ["AuditRecord", "gm-only", "HIDDEN HAZARD", "future trigger", "internal scoring", "consequence tree", "debug report", "SECRET"]) assertSmoke(!leakySetupJson.includes(forbidden), `non-GM setup state redacts ${forbidden}`);

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
  assertSmoke(runnerSource.includes("[data-arcflight-travel-v2-risk-bid-review-queue-persist]"), "RUNNER_CLICK_SELECTOR includes future risk bid review queue persist selector");
  for (const selector of ["[data-arcflight-travel-v2-risk-bid-review-queue-status]", "[data-arcflight-travel-v2-risk-bid-review-queue-select]", "[data-arcflight-travel-v2-risk-bid-review-queue-clear-selection]", "[data-arcflight-travel-v2-risk-bid-review-queue-clear-all-selections]"]) assertSmoke(runnerSource.includes(selector), `RUNNER_CLICK_SELECTOR includes risk bid decision selector ${selector}`);
  for (const helperName of ["updateTravelV2RiskBidReviewQueueRecordStatus", "selectTravelV2RiskBidReviewQueueRecord", "clearTravelV2RiskBidReviewQueueRecordSelection", "clearAllTravelV2RiskBidReviewQueueRecordSelections"]) assertSmoke(runnerSource.includes(helperName), `runner source includes decision helper ${helperName}`);
  assertSmoke(runnerSource.includes('prepareTravelV2RiskBidQueueInsertionIntent(pendingReview, { canReview: true, intentMode: "confirm" })'), "runner handler creates a confirmed risk bid queue insertion intent internally");
  assertSmoke(runnerSource.includes("insertTravelV2RiskBidReviewQueueRecords(this.session, insertionIntent, { canReview: true })"), "runner handler inserts queue records into cloned session-local state");
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
  assertSmoke(templateSource.includes("{{#if state.travelV2SetupStakes.hasSession}}"), "template gates setup stakes panel on active session setup state");
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
      "setup-stakes-render-state",
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
      "gm-visible-finalize-round-action",
      "event-approach-tally-application-controls",
      "risk-bid-result-preview",
      "risk-bid-pending-review",
      "risk-bid-review-queue-state",
      "risk-bid-review-queue-persist-wiring",
      "risk-bid-pending-review-change-scope"
    ]
  };
}

export default runTravelEventRunnerV2PreviewConsumerSmokeChecks;
