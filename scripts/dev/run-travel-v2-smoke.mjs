import runTravelV2StateSmokeChecks from "../helpers/travel-v2-state.smoke.js";
import runTravelV2PressureEngineSmokeChecks from "../helpers/travel-v2-pressure-engine.smoke.js";
import runTravelV2RoundPressureAdapterSmokeChecks from "../helpers/travel-v2-round-pressure-adapter.smoke.js";
import runTravelV2RoundActionOrderStateSmokeChecks from "../helpers/travel-v2-round-action-order-state.smoke.js";
import runTravelV2RoundActionOrderPersistenceBridgeSmokeChecks from "../helpers/travel-v2-round-action-order-persistence-bridge.smoke.js";
import runTravelV2RoundActionOrderLibraryStatusSmokeChecks from "../helpers/travel-v2-round-action-order-library-status.smoke.js";
import runTravelV2RunnerBridgeSmokeChecks from "../helpers/travel-v2-runner-bridge.smoke.js";
import runTravelV2PreviewStateSmokeChecks from "../helpers/travel-v2-preview-state.smoke.js";
import runTravelV2PressureApplicationStateSmokeChecks from "../helpers/travel-v2-pressure-application-state.smoke.js";
import runTravelV2SessionPressureApplicationSmokeChecks from "../helpers/travel-v2-session-pressure-application.smoke.js";
import runTravelV2PressureCorrectionSmokeChecks from "../helpers/travel-v2-pressure-correction.smoke.js";
import runTravelV2RoundFinalizationStateSmokeChecks from "../helpers/travel-v2-round-finalization-state.smoke.js";
import runTravelV2SessionRoundFinalizationSmokeChecks from "../helpers/travel-v2-session-round-finalization.smoke.js";
import runTravelV2EventCompletionReadinessSmokeChecks from "../helpers/travel-v2-event-completion-readiness.smoke.js";
import runTravelV2SessionEventCompletionSmokeChecks from "../helpers/travel-v2-session-event-completion.smoke.js";
import runTravelV2CompletedSummaryExportSmokeChecks from "../helpers/travel-v2-completed-summary-export.smoke.js";
import runTravelV2EventOutcomePackageSmokeChecks from "../helpers/travel-v2-event-outcome-package.smoke.js";
import runTravelV2FinalOutcomeSmokeChecks from "../helpers/travel-v2-final-outcome.smoke.js";
import runTravelV2FinalOutcomePreservationSmokeChecks from "../helpers/travel-v2-final-outcome-preservation.smoke.js";
import runTravelV2FinalOutcomePreservationApplyPlanSmokeChecks from "../helpers/travel-v2-final-outcome-preservation-apply-plan.smoke.js";
import runTravelV2FinalOutcomePreservationApplyPlanStateSmokeChecks from "../helpers/travel-v2-final-outcome-preservation-apply-plan-state.smoke.js";
import runTravelV2FinalOutcomePreservationSessionApplicationSmokeChecks from "../helpers/travel-v2-final-outcome-preservation-session-application.smoke.js";
import runTravelV2FinalOutcomePreservationActorPreviewSmokeChecks from "../helpers/travel-v2-final-outcome-preservation-actor-preview.smoke.js";
import runTravelV2FinalOutcomePreservationStateSmokeChecks from "../helpers/travel-v2-final-outcome-preservation-state.smoke.js";
import runTravelV2FinalOutcomeStateSmokeChecks from "../helpers/travel-v2-final-outcome-state.smoke.js";
import runTravelV2SessionEventOutcomeApplicationSmokeChecks from "../helpers/travel-v2-session-event-outcome-application.smoke.js";
import runTravelV2ActorApplicationBridgeSmokeChecks from "../helpers/travel-v2-actor-application-bridge.smoke.js";
import runTravelV2FollowUpsSmokeChecks from "../helpers/travel-v2-followups.smoke.js";
import runTravelV2HazardsSmokeChecks from "../helpers/travel-v2-hazards.smoke.js";
import runTravelV2ShipScarsSmokeChecks from "../helpers/travel-v2-ship-scars.smoke.js";
import runTravelV2NarrationSmokeChecks from "../helpers/travel-v2-narration.smoke.js";
import runTravelV2NarrationHooksSmokeChecks from "../helpers/travel-v2-narration-hooks.smoke.js";
import runTravelV2NarrationHooksStateSmokeChecks from "../helpers/travel-v2-narration-hooks-state.smoke.js";
import runTravelV2NarrationHooksRuntimeCloseoutSmokeChecks from "../helpers/travel-v2-narration-hooks-runtime-closeout.smoke.js";
import runTravelV2StabilizeRepairSmokeChecks from "../helpers/travel-v2-stabilize-repair.smoke.js";
import runTravelV2MomentumSmokeChecks from "../helpers/travel-v2-momentum.smoke.js";
import runTravelV2FocusBacklashRecordsSmokeChecks from "../helpers/travel-v2-focus-backlash-records.smoke.js";
import runTravelV2SupportActionTargetingSmokeChecks from "../helpers/travel-v2-support-action-targeting.smoke.js";
import runTravelV2SupportAssistRecordsSmokeChecks from "../helpers/travel-v2-support-assist-records.smoke.js";
import runTravelV2SupportBacklashSmokeChecks from "../helpers/travel-v2-support-backlash.smoke.js";
import runTravelV2InterStationHelpActionsSmokeChecks from "../helpers/travel-v2-inter-station-help-actions.smoke.js";
import runTravelV2InterStationHelpPendingRecordsSmokeChecks from "../helpers/travel-v2-inter-station-help-pending-records.smoke.js";
import runTravelV2InterStationHelpPendingQueueSmokeChecks from "../helpers/travel-v2-inter-station-help-pending-queue.smoke.js";
import runTravelV2FocusRiskSuppressionSmokeChecks from "../helpers/travel-v2-focus-risk-suppression.smoke.js";
import runTravelV2RiskBidsSmokeChecks from "../helpers/travel-v2-risk-bids.smoke.js";
import runTravelV2RiskBidResultSmokeChecks from "../helpers/travel-v2-risk-bid-results.smoke.js";
import runTravelV2RiskBidResultBridgeSmokeChecks from "../helpers/travel-v2-risk-bid-result-bridge.smoke.js";
import runTravelV2RiskBidResultReviewAdapterSmokeChecks from "../helpers/travel-v2-risk-bid-result-review-adapter.smoke.js";
import runTravelV2RiskBidQueueInsertionIntentSmokeChecks from "../helpers/travel-v2-risk-bid-queue-insertion-intent.smoke.js";
import runTravelV2RiskBidReviewQueueSmokeChecks from "../helpers/travel-v2-risk-bid-review-queue.smoke.js";
import runTravelV2RiskBidReviewPreviewSmokeChecks from "../helpers/travel-v2-risk-bid-review-preview.smoke.js";
import runTravelV2RiskBidReviewApplyIntentSmokeChecks from "../helpers/travel-v2-risk-bid-review-apply-intent.smoke.js";
import runTravelV2RiskBidReviewApplyGateSmokeChecks from "../helpers/travel-v2-risk-bid-review-apply-gate.smoke.js";
import runTravelV2RiskBidPressureApplySmokeChecks from "../helpers/travel-v2-risk-bid-pressure-apply.smoke.js";
import runTravelV2RiskBidHazardApplySmokeChecks from "../helpers/travel-v2-risk-bid-hazard-apply.smoke.js";
import runTravelV2RiskBidConsequenceApplySmokeChecks from "../helpers/travel-v2-risk-bid-consequence-apply.smoke.js";
import runTravelV2RiskBidBenefitRewardApplySmokeChecks from "../helpers/travel-v2-risk-bid-benefit-reward-apply.smoke.js";
import runTravelV2RiskBidScarApplySmokeChecks from "../helpers/travel-v2-risk-bid-scar-apply.smoke.js";
import runTravelV2RiskBidFinalApplySmokeChecks from "../helpers/travel-v2-risk-bid-final-apply.smoke.js";
import runTravelV2RiskBidResultPipelineCloseoutSmokeChecks from "../helpers/travel-v2-risk-bid-result-pipeline-closeout.smoke.js";
import runTravelEventRunnerV2PreviewSmokeChecks from "../helpers/travel-event-runner-v2-preview.smoke.js";
import runTravelEventRunnerV2PreviewConsumerSmokeChecks from "../apps/travel-event-runner-v2-preview-consumer.smoke.js";
import runTravelEventRunnerV2InterStationHelpSmokeChecks from "../apps/travel-event-runner-v2-inter-station-help.smoke.js";
import runTravelEventRunnerV2PreviewPanelSmokeChecks from "../apps/travel-event-runner-v2-preview-panel.smoke.js";
import runTravelEventRunnerV2PressureApplicationSmokeChecks from "../apps/travel-event-runner-v2-pressure-application.smoke.js";
import runTravelEventRunnerV2PressureCorrectionSmokeChecks from "../apps/travel-event-runner-v2-pressure-correction.smoke.js";
import runTravelEventRunnerV2RoundFinalizationSmokeChecks from "../apps/travel-event-runner-v2-round-finalization.smoke.js";
import runTravelEventRunnerV2RoundActionOrderCommitSmokeChecks from "../apps/travel-event-runner-v2-round-action-order-commit.smoke.js";
import runTravelEventRunnerV2RoundActionOrderPersistenceSmokeChecks from "../apps/travel-event-runner-v2-round-action-order-persistence.smoke.js";
import runTravelEventRunnerV2RoundActionOrderCloseoutSmokeChecks from "../apps/travel-event-runner-v2-round-action-order-closeout.smoke.js";
import runTravelEventRunnerV2RoundActionOrderStartupSmokeChecks from "../apps/travel-event-runner-v2-round-action-order-startup.smoke.js";
import runTravelEventRunnerV2SessionSwitchOrderStateSmokeChecks from "../apps/travel-event-runner-v2-session-switch-order-state.smoke.js";
import runTravelEventRunnerV2SessionSwitchContextIsolationSmokeChecks from "../apps/travel-event-runner-v2-session-switch-context-isolation.smoke.js";
import runTravelEventRunnerV2LibraryOrderStatusCloseoutSmokeChecks from "../apps/travel-event-runner-v2-library-order-status-closeout.smoke.js";
import runTravelEventRunnerV2EventCompletionSmokeChecks from "../apps/travel-event-runner-v2-event-completion.smoke.js";
import runTravelEventRunnerV2EventOutcomeApplicationSmokeChecks from "../apps/travel-event-runner-v2-event-outcome-application.smoke.js";
import runTravelEventRunnerStartupDiagnosticsSmokeChecks from "../apps/travel-event-runner-startup-diagnostics.smoke.js";
import runTravelV2SampleEventSmokeChecks from "./run-travel-v2-sample-event-smoke.mjs";
import runTravelV2DevToolsSmokeChecks from "../helpers/travel-v2-dev-tools.smoke.js";
import runTravelApproachStatisticDebugSmokeChecks from "../helpers/travel-approach-statistic-debug.smoke.js";
import runTravelPlayerMissionBoardBroadcastDebugSmokeChecks from "../apps/travel-player-mission-board-broadcast-debug.smoke.js";
import runTravelV2RoundResolutionReadinessSmokeChecks from "../helpers/travel-v2-round-resolution-readiness.smoke.js";
import runTravelV2CompletionChecklistSmokeChecks from "../helpers/travel-v2-completion-checklist.smoke.js";
import runTravelV2BuilderImporterCompatibilitySmokeChecks from "../helpers/travel-v2-builder-importer-compatibility.smoke.js";
import runTravelV2CardSchemaSmokeChecks from "../helpers/travel-v2-card-schema.smoke.js";
import runTravelV2CardSchemaImportAdapterSmokeChecks from "../helpers/travel-v2-card-schema-import-adapter.smoke.js";
import runTravelV2ConsequenceCatalogSmokeChecks from "../helpers/travel-v2-consequence-catalog.smoke.js";
import runTravelV2GoldStandardHazardCardsSmokeChecks from "../helpers/travel-v2-gold-standard-hazard-cards.smoke.js";
import runTravelV2HazardDeckRegistrySmokeChecks from "../helpers/travel-v2-hazard-deck-registry.smoke.js";
import runTravelV2HazardDeckPickerUiSmokeChecks from "../helpers/travel-v2-hazard-deck-picker-ui.smoke.js";
import runTravelV2RuntimeHazardDeckSelectionSmokeChecks from "../helpers/travel-v2-runtime-hazard-deck-selection.smoke.js";
import runTravelV2HazardDrawReviewSmokeChecks from "../helpers/travel-v2-hazard-draw-review.smoke.js";
import runTravelV2ActiveHazardHandoffReviewSmokeChecks from "../helpers/travel-v2-active-hazard-handoff-review.smoke.js";
import runTravelV2HazardCandidateControlsSmokeChecks from "../helpers/travel-v2-hazard-candidate-controls.smoke.js";
import runTravelV2ActiveHazardLifecycleDisplaySmokeChecks from "../helpers/travel-v2-active-hazard-lifecycle-display.smoke.js";
import runTravelV2ResponseActionWiringSmokeChecks from "../helpers/travel-v2-response-action-wiring.smoke.js";
import runTravelV2StationImpactBehaviorSmokeChecks from "../helpers/travel-v2-station-impact-behavior.smoke.js";
import runTravelV2ResponseActionResolutionReviewSmokeChecks from "../helpers/travel-v2-response-action-resolution-review.smoke.js";
import runTravelV2StationImpactModifierReviewSmokeChecks from "../helpers/travel-v2-station-impact-modifier-review.smoke.js";
import runTravelV2PendingStationBenefitQueueSmokeChecks from "../helpers/travel-v2-pending-station-benefit-queue.smoke.js";
import runTravelV2StationBenefitUseReviewSmokeChecks from "../helpers/travel-v2-station-benefit-use-review.smoke.js";
import runTravelV2EventSetupStakesSmokeChecks from "../helpers/travel-v2-event-setup-stakes.smoke.js";
import runTravelV2VisibleStakesSmokeChecks from "../helpers/travel-v2-visible-stakes.smoke.js";
import runTravelV2VisibleStakesStateSmokeChecks from "../helpers/travel-v2-visible-stakes-state.smoke.js";
import runTravelV2VisibleStakesRuntimeCloseoutSmokeChecks from "../helpers/travel-v2-visible-stakes-runtime-closeout.smoke.js";
import runTravelV2StationActionLockInSmokeChecks from "../helpers/travel-v2-station-action-lock-in.smoke.js";
import runTravelEventRunnerV2StationActionLockInSmokeChecks from "../apps/travel-event-runner-v2-station-action-lock-in.smoke.js";

const SMOKE_SUITES = Object.freeze([
  ["Travel v2 state", runTravelV2StateSmokeChecks],
  ["Travel v2 pressure engine", runTravelV2PressureEngineSmokeChecks],
  ["Travel v2 round pressure adapter", runTravelV2RoundPressureAdapterSmokeChecks],
  ["Travel v2 round action order state", runTravelV2RoundActionOrderStateSmokeChecks],
  ["Travel v2 round action order persistence bridge", runTravelV2RoundActionOrderPersistenceBridgeSmokeChecks],
  ["Travel v2 round action order library status", runTravelV2RoundActionOrderLibraryStatusSmokeChecks],
  ["Travel v2 runner bridge", runTravelV2RunnerBridgeSmokeChecks],
  ["Travel v2 preview state", runTravelV2PreviewStateSmokeChecks],
  ["Travel v2 pressure application state", runTravelV2PressureApplicationStateSmokeChecks],
  ["Travel v2 session pressure application", runTravelV2SessionPressureApplicationSmokeChecks],
  ["Travel v2 pressure correction", runTravelV2PressureCorrectionSmokeChecks],
  ["Travel v2 round finalization state", runTravelV2RoundFinalizationStateSmokeChecks],
  ["Travel v2 session round finalization", runTravelV2SessionRoundFinalizationSmokeChecks],
  ["Travel v2 event completion readiness", runTravelV2EventCompletionReadinessSmokeChecks],
  ["Travel v2 session event completion", runTravelV2SessionEventCompletionSmokeChecks],
  ["Travel v2 completed summary export", runTravelV2CompletedSummaryExportSmokeChecks],
  ["Travel v2 event outcome package", runTravelV2EventOutcomePackageSmokeChecks],
  ["Travel v2 final outcome", runTravelV2FinalOutcomeSmokeChecks],
  ["Travel v2 final outcome preservation", runTravelV2FinalOutcomePreservationSmokeChecks],
  ["Travel v2 final outcome preservation apply plan", runTravelV2FinalOutcomePreservationApplyPlanSmokeChecks],
  ["Travel v2 final outcome preservation apply plan state", runTravelV2FinalOutcomePreservationApplyPlanStateSmokeChecks],
  ["Travel v2 final outcome preservation session application", runTravelV2FinalOutcomePreservationSessionApplicationSmokeChecks],
  ["Travel v2 final outcome preservation actor preview", runTravelV2FinalOutcomePreservationActorPreviewSmokeChecks],
  ["Travel v2 final outcome preservation state", runTravelV2FinalOutcomePreservationStateSmokeChecks],
  ["Travel v2 final outcome state", runTravelV2FinalOutcomeStateSmokeChecks],
  ["Travel v2 session event outcome application", runTravelV2SessionEventOutcomeApplicationSmokeChecks],
  ["Travel v2 actor application bridge", runTravelV2ActorApplicationBridgeSmokeChecks],
  ["Travel v2 follow-ups", runTravelV2FollowUpsSmokeChecks],
  ["Travel v2 hazards", runTravelV2HazardsSmokeChecks],
  ["Travel v2 ship scars", runTravelV2ShipScarsSmokeChecks],
  ["Travel v2 narration", runTravelV2NarrationSmokeChecks],
  ["Travel v2 narration hooks", runTravelV2NarrationHooksSmokeChecks],
  ["Travel v2 narration hooks state", runTravelV2NarrationHooksStateSmokeChecks],
  ["Travel v2 narration hooks runtime closeout", runTravelV2NarrationHooksRuntimeCloseoutSmokeChecks],
  ["Travel v2 stabilize repair", runTravelV2StabilizeRepairSmokeChecks],
  ["Travel v2 momentum", runTravelV2MomentumSmokeChecks],
  ["Travel v2 focus backlash records", runTravelV2FocusBacklashRecordsSmokeChecks],
  ["Travel v2 support action targeting", runTravelV2SupportActionTargetingSmokeChecks],
  ["Travel v2 support assist records", runTravelV2SupportAssistRecordsSmokeChecks],
  ["Travel v2 support backlash", runTravelV2SupportBacklashSmokeChecks],
  ["Travel v2 inter-station help actions", runTravelV2InterStationHelpActionsSmokeChecks],
  ["Travel v2 inter-station help pending records", runTravelV2InterStationHelpPendingRecordsSmokeChecks],
  ["Travel v2 inter-station help pending queue", runTravelV2InterStationHelpPendingQueueSmokeChecks],
  ["Travel v2 focus risk suppression", runTravelV2FocusRiskSuppressionSmokeChecks],
  ["Travel v2 risk bid alpha closeout", runTravelV2RiskBidsSmokeChecks],
  ["Travel v2 risk bid result model", runTravelV2RiskBidResultSmokeChecks],
  ["Travel v2 risk bid result reviewed candidate bridge", runTravelV2RiskBidResultBridgeSmokeChecks],
  ["Travel v2 risk bid result review adapter", runTravelV2RiskBidResultReviewAdapterSmokeChecks],
  ["Travel v2 risk bid queue insertion intent", runTravelV2RiskBidQueueInsertionIntentSmokeChecks],
  ["Travel v2 risk bid review queue", runTravelV2RiskBidReviewQueueSmokeChecks],
  ["Travel v2 risk bid selected review preview", runTravelV2RiskBidReviewPreviewSmokeChecks],
  ["Travel v2 risk bid review apply intent", runTravelV2RiskBidReviewApplyIntentSmokeChecks],
  ["Travel v2 risk bid review apply gate", runTravelV2RiskBidReviewApplyGateSmokeChecks],
  ["Travel v2 risk bid pressure apply", runTravelV2RiskBidPressureApplySmokeChecks],
  ["Travel v2 risk bid hazard apply", runTravelV2RiskBidHazardApplySmokeChecks],
  ["Travel v2 risk bid consequence apply", runTravelV2RiskBidConsequenceApplySmokeChecks],
  ["Travel v2 risk bid benefit reward apply", runTravelV2RiskBidBenefitRewardApplySmokeChecks],
  ["Travel v2 risk bid scar apply", runTravelV2RiskBidScarApplySmokeChecks],
  ["Travel v2 risk bid final apply", runTravelV2RiskBidFinalApplySmokeChecks],
  ["Travel v2 risk bid result pipeline closeout", runTravelV2RiskBidResultPipelineCloseoutSmokeChecks],
  ["Travel event runner v2 preview", runTravelEventRunnerV2PreviewSmokeChecks],
  ["Travel event runner v2 preview consumer", runTravelEventRunnerV2PreviewConsumerSmokeChecks],
  ["Travel event runner v2 inter-station help", runTravelEventRunnerV2InterStationHelpSmokeChecks],
  ["Travel event runner v2 preview panel", runTravelEventRunnerV2PreviewPanelSmokeChecks],
  ["Travel event runner v2 pressure application", runTravelEventRunnerV2PressureApplicationSmokeChecks],
  ["Travel event runner v2 pressure correction", runTravelEventRunnerV2PressureCorrectionSmokeChecks],
  ["Travel event runner v2 round finalization", runTravelEventRunnerV2RoundFinalizationSmokeChecks],
  ["Travel event runner v2 round action order commit", runTravelEventRunnerV2RoundActionOrderCommitSmokeChecks],
  ["Travel event runner v2 round action order persistence", runTravelEventRunnerV2RoundActionOrderPersistenceSmokeChecks],
  ["Travel event runner v2 round action order closeout", runTravelEventRunnerV2RoundActionOrderCloseoutSmokeChecks],
  ["Travel event runner v2 round action order startup hardening", runTravelEventRunnerV2RoundActionOrderStartupSmokeChecks],
  ["Travel event runner v2 session switch order state isolation", runTravelEventRunnerV2SessionSwitchOrderStateSmokeChecks],
  ["Travel event runner v2 session switch context isolation", runTravelEventRunnerV2SessionSwitchContextIsolationSmokeChecks],
  ["Travel event runner v2 library order status closeout", runTravelEventRunnerV2LibraryOrderStatusCloseoutSmokeChecks],
  ["Travel event runner v2 event completion", runTravelEventRunnerV2EventCompletionSmokeChecks],
  ["Travel event runner v2 event outcome application", runTravelEventRunnerV2EventOutcomeApplicationSmokeChecks],
  ["Travel event runner startup diagnostics", runTravelEventRunnerStartupDiagnosticsSmokeChecks],
  ["Travel v2 sample event", runTravelV2SampleEventSmokeChecks],
  ["Travel v2 dev tools", runTravelV2DevToolsSmokeChecks],
  ["Travel approach statistic debug", runTravelApproachStatisticDebugSmokeChecks],
  ["Travel player mission board broadcast debug", runTravelPlayerMissionBoardBroadcastDebugSmokeChecks],
  ["Travel v2 round resolution readiness", runTravelV2RoundResolutionReadinessSmokeChecks],
  ["Travel v2 completion checklist", runTravelV2CompletionChecklistSmokeChecks],
  ["Travel v2 builder/importer compatibility", runTravelV2BuilderImporterCompatibilitySmokeChecks],
  ["Travel v2 card schema", runTravelV2CardSchemaSmokeChecks],
  ["Travel v2 card schema import adapter", runTravelV2CardSchemaImportAdapterSmokeChecks],
  ["Travel v2 consequence catalog", runTravelV2ConsequenceCatalogSmokeChecks],
  ["Travel v2 gold-standard hazard cards", runTravelV2GoldStandardHazardCardsSmokeChecks],
  ["Travel v2 built-in hazard deck registry", runTravelV2HazardDeckRegistrySmokeChecks],
  ["Travel v2 hazard deck picker UI", runTravelV2HazardDeckPickerUiSmokeChecks],
  ["Travel v2 runtime hazard deck selection", runTravelV2RuntimeHazardDeckSelectionSmokeChecks],
  ["Travel v2 hazard draw review", runTravelV2HazardDrawReviewSmokeChecks],
  ["Travel v2 active hazard handoff review", runTravelV2ActiveHazardHandoffReviewSmokeChecks],
  ["Travel v2 hazard candidate controls", runTravelV2HazardCandidateControlsSmokeChecks],
  ["Travel v2 active hazard lifecycle display", runTravelV2ActiveHazardLifecycleDisplaySmokeChecks],
  ["Travel v2 response action wiring", runTravelV2ResponseActionWiringSmokeChecks],
  ["Travel v2 station impact behavior", runTravelV2StationImpactBehaviorSmokeChecks],
  ["Travel v2 response action resolution review", runTravelV2ResponseActionResolutionReviewSmokeChecks],
  ["Travel v2 station impact modifier review", runTravelV2StationImpactModifierReviewSmokeChecks],
  ["Travel v2 pending station benefit queue", runTravelV2PendingStationBenefitQueueSmokeChecks],
  ["Travel v2 station benefit use review", runTravelV2StationBenefitUseReviewSmokeChecks],
  ["Travel v2 event setup stakes", runTravelV2EventSetupStakesSmokeChecks],
  ["Travel v2 visible stakes", runTravelV2VisibleStakesSmokeChecks],
  ["Travel v2 visible stakes state", runTravelV2VisibleStakesStateSmokeChecks],
  ["Travel v2 visible stakes runtime closeout", runTravelV2VisibleStakesRuntimeCloseoutSmokeChecks],
  ["Travel v2 station action lock-in", runTravelV2StationActionLockInSmokeChecks],
  ["Travel event runner v2 station action lock-in", runTravelEventRunnerV2StationActionLockInSmokeChecks],
]);

function printSuiteResult(label, result) {
  console.log(`${label} smoke checks passed.`);
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) {
    console.log(`- ${checkName}`);
  }
  console.log("");
}

try {
  const results = [];
  for (const [label, runSuite] of SMOKE_SUITES) {
    const result = await runSuite();
    results.push({ label, result });
    printSuiteResult(label, result);
  }
  const groupCount = results.reduce((total, entry) => total + entry.result.checked.length, 0);
  console.log(`All Travel v2 smoke checks passed. ${results.length} suites, ${groupCount} groups.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
