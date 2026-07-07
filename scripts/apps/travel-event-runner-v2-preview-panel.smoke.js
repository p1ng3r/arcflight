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
  assertEqual(TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION, 15, "panel version should be 15");
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
  assertSmoke(panel.stationBenefitDisplay, "panel should expose station benefit display state");
  assertSmoke(!panel.stationBenefitDisplay.hasRows, "empty station benefit display state should be safe");
  assertSmoke(panel.roundActionOrderDisplay.hasRows, "panel should expose round action order display rows");
  assertEqual(panel.roundActionOrderDisplay.rows[0].stationName, "Navigator", "round action order display should expose station name");
  assertEqual(panel.roundActionOrderDisplay.rows[0].orderNumber, 1, "round action order display should expose order number");
  assertEqual(panel.roundActionOrderDisplay.rows[0].selectedActionLabel, "Event Approach", "round action order display should expose selected action label fallback");
  assertEqual(panel.roundActionOrderDisplay.rows[0].statusLabel, "Needs Order", "round action order display should expose status label");
  assertSmoke(panel.roundActionOrderDisplay.rows[0].current, "first uncommitted order row should be marked current");
  assertSmoke(panel.roundActionOrderDisplay.footerText.includes("has not committed"), "round action order display should expose footer text");
  assertSmoke(!panel.roundActionOrderDisplay.reorderRequest.requested, "panel should not show reorder comparison without explicit request");
  assertSmoke(panel.roundActionOrderDisplay.canRequestReorderReview, "panel should expose an explicit reorder review request shell for multi-station rounds");

  const reorderPanel = prepareTravelEventRunnerV2PreviewPanelState({ session: appState.session, user: { isGM: true }, isGM: true, travelV2RoundActionOrderReorderRequested: true, travelV2ProposedRoundActionOrder: ["engineer", "navigator"] });
  assertSmoke(reorderPanel.roundActionOrderDisplay.reorderRequest.ready, "explicit GM reorder request should prepare a ready review-only candidate");
  assertEqual(reorderPanel.roundActionOrderDisplay.reorderRequest.proposedRows[0].stationName, "Engineer", "reorder candidate should expose proposed station order");

  const successfulCommitPanel = prepareTravelEventRunnerV2PreviewPanelState({
    session: appState.session,
    user: { isGM: true },
    isGM: true,
    travelV2RoundActionOrderCommitResult: { ok: true, committed: true, duplicate: false, blocked: false, roundIndex: 0, roundNumber: 1, previousOrder: ["navigator", "engineer"], committedOrder: ["engineer", "navigator"], auditRecord: { timestamp: "2026-07-04T00:00:00.000Z", source: "app", userName: "GM" } }
  });
  assertEqual(successfulCommitPanel.roundActionOrderDisplay.commitResult.status, "committed", "successful commit result should display committed status");
  assertSmoke(successfulCommitPanel.roundActionOrderDisplay.commitResult.summaryText.includes("action order committed"), "successful commit result should use success copy");
  assertSmoke(successfulCommitPanel.roundActionOrderDisplay.commitResult.committedOrderText.includes("Engineer"), "successful commit result should show committed labels");
  assertSmoke(successfulCommitPanel.roundActionOrderDisplay.commitResult.previousOrderText.includes("Navigator"), "successful commit result should show previous order labels to GM");
  assertSmoke(successfulCommitPanel.roundActionOrderDisplay.commitResult.hasAuditMetadata, "successful GM commit result should include safe audit metadata");

  const duplicateCommitPanel = prepareTravelEventRunnerV2PreviewPanelState({
    session: appState.session,
    user: { isGM: true },
    isGM: true,
    travelV2RoundActionOrderCommitResult: { ok: true, committed: false, duplicate: true, blocked: false, roundIndex: 0, roundNumber: 1, previousOrder: ["engineer", "navigator"], committedOrder: ["engineer", "navigator"], reason: "Round action order already committed with the same station order." }
  });
  assertEqual(duplicateCommitPanel.roundActionOrderDisplay.commitResult.status, "duplicate", "duplicate commit result should display duplicate status");
  assertSmoke(duplicateCommitPanel.roundActionOrderDisplay.commitResult.summaryText.includes("No session changes were made"), "duplicate commit result should be explicitly non-destructive");

  const blockedCommitPanel = prepareTravelEventRunnerV2PreviewPanelState({
    session: appState.session,
    user: { isGM: true },
    isGM: true,
    travelV2RoundActionOrderCommitResult: { ok: false, committed: false, duplicate: false, blocked: true, roundIndex: 0, roundNumber: 1, blockedReasons: ["Current Travel v2 round is already completed."], previousOrder: ["navigator", "engineer"], committedOrder: ["engineer", "navigator"] }
  });
  assertEqual(blockedCommitPanel.roundActionOrderDisplay.commitResult.status, "blocked", "blocked commit result should display blocked status");
  assertSmoke(blockedCommitPanel.roundActionOrderDisplay.commitResult.summaryText.includes("commit blocked"), "blocked commit result should use blocked copy");
  assertEqual(blockedCommitPanel.roundActionOrderDisplay.commitResult.blockedReason, "Current Travel v2 round is already completed.", "blocked commit result should expose reason text");

  const nonGmCommitPanel = prepareTravelEventRunnerV2PreviewPanelState({
    session: appState.session,
    user: { isGM: false },
    isGM: false,
    travelV2RoundActionOrderCommitResult: { ok: false, committed: false, duplicate: false, blocked: true, playerSafe: true, blockedReasons: ["Only the GM can commit round action order."], session: null, previousOrder: ["navigator", "engineer"], committedOrder: ["engineer", "navigator"], auditRecord: { timestamp: "2026-07-04T00:00:00.000Z", source: "app", userName: "Captain Secret" } }
  });
  assertEqual(nonGmCommitPanel.roundActionOrderDisplay.commitResult.status, "blocked", "non-GM commit result should still show safe blocked status");
  assertSmoke(!nonGmCommitPanel.roundActionOrderDisplay.commitResult.hasAuditMetadata, "non-GM commit result should redact audit metadata");
  assertSmoke(!nonGmCommitPanel.roundActionOrderDisplay.commitResult.hasPreviousRows, "non-GM blocked commit result should redact previous order rows");
  assertSmoke(!JSON.stringify(nonGmCommitPanel.roundActionOrderDisplay.commitResult).includes("Captain Secret"), "non-GM commit result should not expose GM user name");
  assertSmoke(!JSON.stringify(nonGmCommitPanel.roundActionOrderDisplay.commitResult).includes("session"), "non-GM commit result display should not expose session payload");

  const stationBenefitPanel = prepareTravelEventRunnerV2PreviewPanelState({
    ...appState,
    travelV2StationBenefitUseReviewPlayerState: {
      rows: [
        { queueKey: "benefit-1", title: "Clear Shot", sourceStationLabel: "Navigator", targetStationLabel: "Engineer", playerSafeSummary: "Reduce one Engineer DC.", status: "pending", canReview: true, useAvailable: false, disabledReason: null, reviewOnly: true },
        { queueKey: "benefit-2", title: "Shielded Approach", sourceStationLabel: "Gunner", targetStationLabel: "Pilot", publicText: "Pilot may ignore one hazard complication.", status: "expired", canReview: false, useAvailable: false, disabledReason: "Pending station benefit is expired.", reviewOnly: true }
      ]
    }
  });
  assertSmoke(stationBenefitPanel.stationBenefitDisplay.hasRows, "visible station benefit display should be present in panel state");
  assertEqual(stationBenefitPanel.stationBenefitDisplay.rows.length, 2, "panel should expose all player-safe benefit rows");
  assertEqual(stationBenefitPanel.stationBenefitDisplay.rows[0].title, "Clear Shot", "benefit display should expose title");
  assertEqual(stationBenefitPanel.stationBenefitDisplay.rows[0].sourceStationLabel, "Navigator", "benefit display should expose source station label");
  assertEqual(stationBenefitPanel.stationBenefitDisplay.rows[0].targetStationLabel, "Engineer", "benefit display should expose target station label");
  assertEqual(stationBenefitPanel.stationBenefitDisplay.rows[0].displaySummary, "Reduce one Engineer DC.", "benefit display should expose summary");
  assertEqual(stationBenefitPanel.stationBenefitDisplay.rows[0].statusLabel, "Pending", "benefit display should expose status label");
  assertEqual(stationBenefitPanel.stationBenefitDisplay.rows[0].requestAvailabilityLabel, "Review only", "pending rows should be display/review-only without use behavior");
  assertEqual(stationBenefitPanel.stationBenefitDisplay.rows[1].requestAvailabilityLabel, "Not ready", "disabled rows should be represented safely");
  assertSmoke(JSON.stringify(stationBenefitPanel.stationBenefitDisplay).includes("gmText") === false, "station benefit panel state should remain player-safe");


  const orderedPanel = prepareTravelEventRunnerV2PreviewPanelState({
    ...appState,
    session: {
      ...appState.session,
      roundPhase: "stationRolls",
      roundResults: [{
        stationActionOrder: ["engineer", "navigator"],
        selectedStationOptionLabels: { engineer: "Stabilize Engines", navigator: "Plot Safe Course" },
        stationActions: { engineer: { type: "repair" }, navigator: { type: "navigate" } },
        stationOrderCommitments: { engineer: { committed: true, source: "player" }, navigator: { committed: true, source: "player" } },
        stationResults: { engineer: "success" }
      }]
    }
  });
  assertEqual(orderedPanel.roundActionOrderDisplay.rows[0].stationName, "Engineer", "explicit action order should control row ordering");
  assertEqual(orderedPanel.roundActionOrderDisplay.rows[0].orderLabel, "#1", "ordered row should expose display order label");
  assertEqual(orderedPanel.roundActionOrderDisplay.rows[0].selectedActionLabel, "Stabilize Engines", "ordered row should expose selected action label");
  assertEqual(orderedPanel.roundActionOrderDisplay.rows[0].statusLabel, "Resolved", "resolved row should expose status label");
  assertSmoke(orderedPanel.roundActionOrderDisplay.rows[1].current, "first unresolved station roll should be marked current in station rolls phase");
  assertSmoke(!JSON.stringify(orderedPanel.roundActionOrderDisplay).includes("applyPayload"), "order display should not expose apply payloads");

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
  assertSmoke(finalizedPanel.travelV2EventCompletionReadiness.canCompleteEvent, "finalized panel should enable event completion");
  assertEqual(finalizedPanel.travelV2EventCompletionReadiness.completeButtonLabel, "Complete Event", "ready panel should show complete label");
  assertEqual(finalizedPanel.travelV2EventCompletionReadiness.countText, "1 / 1 rounds finalized. 0 rounds pending.", "ready panel should expose readiness counts");
  assertSmoke(finalizedPanel.travelV2RoundFinalizationState.feedbackText.includes("Finalized Travel v2 round 1"), "success finalization feedback should appear");

  assertEqual(completedPanel.travelV2EventCompletionReadiness.completeButtonLabel, "Event Completed", "completed panel should show completed label");
  assertSmoke(completedPanel.travelV2EventCompletionReadiness.completeDisabled, "completed panel should disable completion control");
  assertSmoke(completedPanel.rows.every((row) => row.pressureApplyDisabled), "completed sessions should disable apply controls");
  assertSmoke(completedPanel.rows.every((row) => !row.canCorrectPressure), "completed sessions should not expose correction controls");

  const liveCompletedPanel = prepareTravelEventRunnerV2PreviewPanelState({
    session: {
      key: "live-completed",
      status: "completed",
      completedAt: "2026-06-21T00:00:00.000Z",
      event: { key: "lantern-in-the-static", name: "The Lantern in the Static", rounds: [{ roundNumber: 1 }] },
      summary: {
        suggestedFinalOutcome: "criticalSuccess",
        suggestedFinalOutcomeLabel: "Lantern Rescued Cleanly",
        finalOutcomeText: "The lantern is rescued cleanly.",
        rounds: [{ roundNumber: 1, stationResults: { navigator: "criticalSuccess" } }]
      },
      roundResults: [{ roundNumber: 1, stationResults: { navigator: "criticalSuccess" } }]
    },
    actor: {
      id: "ship",
      name: "Live Ship",
      type: "vehicle",
      flags: { arcflight: { enabled: true, system: { current: { hull: 0, strain: 0, lifeveil: 0, morale: 0 }, resources: { supplies: 0 }, cargo: { used: 0 }, travelV2: { followUps: { records: [] } } } } }
    },
    travelV2Preview: { ok: false, rows: [] }
  });
  assertSmoke(liveCompletedPanel.travelV2EventOutcomePackage.canPreparePackage, "live completed panel should prepare an outcome package without v2 completion records");
  assertSmoke(liveCompletedPanel.travelV2FollowUps.hasRecords, "live completed panel should expose staged follow-up cards");
  assertSmoke(liveCompletedPanel.travelV2FollowUps.records.some((record) => record.title === "Lantern Rescued Cleanly"), "live completed panel should stage summary final outcome text as a follow-up card");
  assertSmoke(liveCompletedPanel.travelV2FollowUps.records.every((record) => record.actionsDisabled), "live completed staged follow-up cards should disable actions until saved");


  const supportSourceSession = {
    ...appState.session,
    currentRoundIndex: 1,
    event: {
      ...appState.session.event,
      rounds: [
        ...appState.session.event.rounds,
        { roundNumber: 2, activeStations: ["navigator", "engineer"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" } } }
      ]
    },
    roundResults: [
      { roundNumber: 1, stationResults: { engineer: "success" } },
      {
        roundNumber: 2,
        stationResults: { navigator: "success" },
        stationCheckAppliedBonuses: {
          navigator: [{ bonusKey: "support", bonusType: "circumstance", bonusValue: 1, bonusLabel: "Engineer supports Navigator: +1 circumstance bonus.", sourceStationKey: "engineer", sourceStationLabel: "Engineer", targetStationKey: "navigator", targetStationLabel: "Navigator", roundIndex: 0, roundNumber: 1, appliesToRoundIndex: 1, nextRoundIndex: 1, playerSafe: true, auditRecord: { secret: true } }]
        }
      }
    ],
    travelV2PendingStationActionBonuses: {
      records: [
        { bonusKey: "support", bonusType: "circumstance", bonusValue: 1, sourceStationKey: "engineer", sourceStationLabel: "Engineer", targetStationKey: "navigator", targetStationLabel: "Navigator", roundIndex: 0, roundNumber: 1, appliesToRoundIndex: 1, nextRoundIndex: 1, consumed: false, playerSafe: true, readOnly: true, auditRecord: { secret: true } },
        { bonusKey: "support", bonusType: "circumstance", bonusValue: 1, sourceStationKey: "navigator", sourceStationLabel: "Navigator", targetStationKey: "engineer", targetStationLabel: "Engineer", roundIndex: 0, roundNumber: 1, appliesToRoundIndex: 1, nextRoundIndex: 1, consumed: true, consumedRoundIndex: 1, consumedStationKey: "engineer", playerSafe: true, readOnly: true, gmText: "secret" }
      ],
      playerSafe: true,
      readOnly: true
    }
  };
  const supportBefore = JSON.stringify(supportSourceSession);
  const supportPanel = prepareTravelEventRunnerV2PreviewPanelState({ ...appState, session: supportSourceSession });
  assertEqual(JSON.stringify(supportSourceSession), supportBefore, "Support preview preparation should not mutate the source session");
  assertSmoke(supportPanel.supportBonusStatusAvailable, "Support bonus status section should be available when only bonus records exist");
  assertEqual(supportPanel.travelV2PendingStationActionBonuses.records.length, 2, "pending Support bonus display should include pending and consumed records");
  const pendingSupport = supportPanel.travelV2PendingStationActionBonuses.records.find((record) => record.status === "pending");
  assertSmoke(pendingSupport?.readableLabel.includes("Engineer supports Navigator") && pendingSupport.bonusValue === 1 && pendingSupport.bonusType === "circumstance" && pendingSupport.statusLabel === "Pending", "pending Support bonus render state includes safe label/value/status");
  const consumedSupport = supportPanel.travelV2PendingStationActionBonuses.records.find((record) => record.status === "consumed");
  assertSmoke(consumedSupport?.consumed === true && consumedSupport.statusLabel === "Consumed" && consumedSupport.sourceStationLabel === "Navigator" && consumedSupport.targetStationLabel === "Engineer", "consumed Support bonus render state is marked consumed with safe source and target labels");
  const appliedSupport = supportPanel.travelV2AppliedStationActionBonuses.records[0];
  assertSmoke(appliedSupport?.status === "applied" && appliedSupport.statusLabel === "Applied" && appliedSupport.sourceStationKey === "engineer" && appliedSupport.targetStationKey === "navigator" && appliedSupport.bonusValue === 1 && appliedSupport.playerSafe === true && appliedSupport.readOnly === true, "applied Support bonus render state includes safe source/target/value/status");
  const supportPanelJson = JSON.stringify({ pending: supportPanel.travelV2PendingStationActionBonuses, applied: supportPanel.travelV2AppliedStationActionBonuses });
  for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
    assertSmoke(!supportPanelJson.includes(forbidden), `Support bonus preview state should not include forbidden player-safe term ${forbidden}`);
  }


  const eventApproachPanel = prepareTravelEventRunnerV2PreviewPanelState({
    ...appState,
    session: {
      ...appState.session,
      travelV2RoundResolutions: {
        records: [{
          roundIndex: 0,
          roundNumber: 1,
          stationActionEventApproachEffects: {
            roundIndex: 0,
            roundNumber: 1,
            effects: [{ sourceStationKey: "navigator", sourceStationLabel: "Navigator", effectKey: "eventApproach", effectType: "eventApproach", effectLabel: "Navigator uses Event Approach.", selectedSkillLabel: "Piloting Lore", stationOutcome: "success", playerSafe: true, readOnly: true, gmText: "secret", auditRecord: { secret: true } }],
            playerSafe: true,
            readOnly: true
          },
          stationActionEventApproachContributions: {
            roundIndex: 0,
            roundNumber: 1,
            records: [{ sourceStationKey: "navigator", sourceStationLabel: "Navigator", contributionKey: "eventApproach", contributionType: "eventApproach", contributionValue: 1, contributionLabel: "Navigator Event Approach using Piloting Lore: Success (+1).", selectedSkillLabel: "Piloting Lore", stationOutcome: "success", playerSafe: true, readOnly: true, gmText: "secret", auditRecord: { secret: true } }],
            playerSafe: true,
            readOnly: true
          },
          stationActionEventApproachContributionTally: {
            roundIndex: 0,
            roundNumber: 1,
            tallyKey: "eventApproach",
            tallyType: "eventApproach",
            tallyLabel: "Event Approach contribution tally: +1 from 1 contribution.",
            totalContributionValue: 1,
            contributionCount: 1,
            positiveContributionCount: 1,
            zeroContributionCount: 0,
            negativeContributionCount: 0,
            contributingStationLabels: ["Navigator"],
            playerSafe: true,
            readOnly: true,
            gmText: "secret",
            auditRecord: { secret: true }
          },
          stationActionEventApproachTallyStatus: {
            roundIndex: 0,
            roundNumber: 1,
            statusKey: "partialProgress",
            statusLabel: "Partial Progress",
            statusTone: "warning",
            totalContributionValue: 1,
            previewLabel: "Partial Progress preview: +1 Event Approach tally captured for later resolution.",
            previewMessage: "Partial Progress preview: +1 Event Approach tally captured as read-only and not applied yet. It does not change pressure, hazards, rewards, resources, DCs, event progress, or completion.",
            playerSafe: true,
            readOnly: true,
            gmText: "secret",
            auditRecord: { secret: true }
          }
        }]
      },
      roundResults: [{
        stationOrderCommitments: { captain: { committed: true }, navigator: { committed: true }, engineer: { committed: true }, veilwarden: { committed: true }, watchmaster: { committed: true } },
        stationResults: {}
      }]
    }
  });
  assertSmoke(eventApproachPanel.stationActionEffectsAvailable, "Event Approach effects should make station action effects section available");
  assertSmoke(eventApproachPanel.travelV2StationActionEventApproachEffects.hasEffects, "Event Approach effects should be exposed in preview render state");
  const eventApproachEffect = eventApproachPanel.travelV2StationActionEventApproachEffects.effects[0];
  assertSmoke(eventApproachEffect.sourceStationLabel === "Navigator", "Event Approach preview effect should include safe source station label");
  assertSmoke(eventApproachEffect.effectLabel.includes("Event Approach") && eventApproachEffect.selectedSkillLabel === "Piloting Lore" && eventApproachEffect.stationOutcome === "success", "Event Approach preview effect should include safe readable labels and result");
  assertSmoke(eventApproachPanel.travelV2StationActionEventApproachContributions.hasRecords, "Event Approach contributions should be exposed in preview render state");
  const eventApproachContribution = eventApproachPanel.travelV2StationActionEventApproachContributions.records[0];
  assertSmoke(eventApproachContribution.sourceStationLabel === "Navigator", "Event Approach preview contribution should include safe source station label");
  assertSmoke(eventApproachContribution.contributionLabel.includes("Event Approach") && eventApproachContribution.contributionValue === 1 && eventApproachContribution.valueLabel === "+1", "Event Approach preview contribution should include safe readable label and value");
  assertSmoke(eventApproachPanel.travelV2StationActionEventApproachContributionTally.available, "Event Approach contribution tally should be exposed in preview render state");
  const eventApproachTally = eventApproachPanel.travelV2StationActionEventApproachContributionTally;
  assertSmoke(eventApproachTally.totalContributionValue === 1 && eventApproachTally.valueLabel === "+1" && eventApproachTally.contributionCount === 1, "Event Approach preview tally should include safe total and contribution count");
  assertSmoke(eventApproachTally.positiveContributionCount === 1 && eventApproachTally.zeroContributionCount === 0 && eventApproachTally.negativeContributionCount === 0, "Event Approach preview tally should include safe sign counts");
  assertSmoke(eventApproachTally.contributingStationLabelText === "Navigator" && eventApproachTally.tallyLabel.includes("Event Approach"), "Event Approach preview tally should include safe station labels and readable label");
  assertSmoke(eventApproachPanel.travelV2StationActionEventApproachTallyStatus.available, "Event Approach tally status should be exposed in preview render state");
  const eventApproachStatus = eventApproachPanel.travelV2StationActionEventApproachTallyStatus;
  assertSmoke(eventApproachStatus.statusKey === "partialProgress" && eventApproachStatus.statusLabel === "Partial Progress" && eventApproachStatus.statusTone === "warning", "Event Approach preview status should include safe status key label and tone");
  assertSmoke(eventApproachStatus.totalContributionValue === 1 && eventApproachStatus.previewLabel.includes("captured") && eventApproachStatus.previewMessage.includes("read-only") && eventApproachStatus.previewMessage.includes("not applied yet"), "Event Approach preview status should include total and readable not-applied message");
  const fallbackStatusPanel = prepareTravelEventRunnerV2PreviewPanelState({ ...appState, travelV2RoundFinalizationResult: { stationActionEventApproachContributionTally: { roundIndex: 0, roundNumber: 1, totalContributionValue: -1, contributionCount: 1, hasContributions: true, playerSafe: true, readOnly: true } } });
  assertSmoke(fallbackStatusPanel.travelV2StationActionEventApproachTallyStatus.statusKey === "setback", "Event Approach preview status should fall back from tally when status object is absent");
  const eventApproachPanelJson = JSON.stringify({ effects: eventApproachPanel.travelV2StationActionEventApproachEffects, contributions: eventApproachPanel.travelV2StationActionEventApproachContributions, tally: eventApproachPanel.travelV2StationActionEventApproachContributionTally, status: eventApproachPanel.travelV2StationActionEventApproachTallyStatus });
  for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
    assertSmoke(!eventApproachPanelJson.includes(forbidden), `Event Approach preview state should not include forbidden player-safe term ${forbidden}`);
  }

  const activeCardsPanel = prepareTravelEventRunnerV2PreviewPanelState({
    ...appState,
    session: {
      ...appState.session,
      roundResults: [{
        stationOrderCommitments: { captain: { committed: true }, navigator: { committed: true }, engineer: { committed: true }, veilwarden: { committed: true }, watchmaster: { committed: true } },
        stationResults: {}
      }],
      travelV2ActiveCards: {
        version: 1,
        records: [{
          cardId: "travel-v2-card:0:navigator:extreme:criticalSuccess:legendaryEvent",
          rewardKey: "legendaryEvent",
          cardLabel: "Legendary Event",
          sourceStationKey: "navigator",
          sourceStationLabel: "Navigator",
          sourceBidKey: "extreme",
          sourceBidLabel: "Extreme Bid",
          sourceResult: "criticalSuccess",
          roundIndex: 0,
          roundNumber: 1,
          status: "pending",
          timingHint: "Play after station actions are locked but before the target station rolls.",
          effectPreviewText: "Future effect: target station cannot resolve worse than success.",
          targetStationKey: "engineer",
          targetStationLabel: "Engineer",
          playerSafe: true,
          readOnly: true,
          gmText: "secret",
          auditRecord: { secret: true }
        }],
        playerSafe: true,
        readOnly: true
      }
    }
  });
  assertSmoke(activeCardsPanel.travelV2ActiveCards.available, "active card preview summary should be available when session cards exist");
  assertEqual(activeCardsPanel.travelV2ActiveCards.records.length, 1, "active card preview summary should expose session card records");
  const activeCard = activeCardsPanel.travelV2ActiveCards.records[0];
  assertSmoke(activeCard.rewardKey === "legendaryEvent" && activeCard.cardLabel === "Legendary Event" && activeCard.status === "pending", "active card preview should include safe card key, label, and status");
  assertSmoke(activeCard.playerSafe === true && activeCard.readOnly === true && activeCard.effectPreviewText.includes("Future effect"), "active card preview should be player-safe, read-only, and preview-only");
  assertSmoke(activeCard.hasTargetStation === true && activeCard.targetStationKey === "engineer", "active card preview should expose target station state");
  assertSmoke(activeCard.timingType === "beforeRoll" && activeCard.previewStatus === "playable" && activeCard.playablePreview === true, "active card preview should expose before-roll readiness state");
  assertSmoke(Array.isArray(activeCard.availableTargetStations) && activeCard.availableTargetStations.some((option) => option.stationKey === "engineer"), "active card preview should expose safe target station options");
  const activeCardsPanelJson = JSON.stringify(activeCardsPanel.travelV2ActiveCards);
  for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
    assertSmoke(!activeCardsPanelJson.includes(forbidden), `Active card preview state should not include forbidden player-safe term ${forbidden}`);
  }
  const activeCardsWithEmptyLatestPanel = prepareTravelEventRunnerV2PreviewPanelState({
    ...appState,
    session: activeCardsPanel.session ?? {
      ...appState.session,
      travelV2ActiveCards: {
        records: [activeCard],
        playerSafe: true,
        readOnly: true
      }
    },
    travelV2RoundFinalizationResult: {
      ok: true,
      finalized: true,
      travelV2ActiveCards: { version: 1, records: [], playerSafe: true, readOnly: true }
    }
  });
  assertEqual(activeCardsWithEmptyLatestPanel.travelV2ActiveCards.records.length, 1, "active card preview should keep existing session card when latest finalization has no created cards");

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
      "station-benefit-display-state",
      "support-bonus-status-render-state",
      "event-approach-effects-render-state",
      "event-approach-contributions-render-state",
      "event-approach-contribution-tally-render-state",
      "active-card-preview-render-state",
      "active-card-merged-preview-state",
      "round-action-order-display-state",
      "round-action-order-commit-result-display",
      "round-action-order-commit-result-redaction",
      "already-applied-disabled-state",
      "event-completion-readiness-summary",
      "live-completed-follow-ups",
      "no-completion-helper-in-preview-preparation"
    ]
  };
}

export default runTravelEventRunnerV2PreviewPanelSmokeChecks;
