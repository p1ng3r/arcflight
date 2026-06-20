import { prepareTravelV2PressureApplicationState } from "../helpers/travel-v2-pressure-application-state.js";
import { prepareTravelV2EventCompletionReadiness } from "../helpers/travel-v2-event-completion-readiness.js";
import { prepareTravelV2RoundFinalizationState } from "../helpers/travel-v2-round-finalization-state.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION = 5;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeOutcomeTone(row = {}) {
  const outcomeKey = String(row.outcomeKey ?? "");
  if (outcomeKey === "criticalSuccess" || outcomeKey === "success") return "safe";
  if (outcomeKey === "mixed") return "warning";
  if (outcomeKey === "failure") return "danger";
  if (outcomeKey === "criticalFailure") return "severe";
  return row.hasRequests ? "warning" : "neutral";
}


function normalizeFinalizationState(state = null, latestResult = null) {
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const resultBlockedReasons = Array.isArray(latestResult?.blockedReasons) ? latestResult.blockedReasons : [];
  const roundNumber = state?.roundNumber ?? null;
  const successText = latestResult?.ok === true && latestResult?.finalized === true
    ? `Finalized Travel v2 round ${latestResult.roundNumber ?? latestResult.roundIndex + 1}.`
    : "";
  const feedbackText = successText || resultBlockedReasons[0] || latestResult?.error || "";
  const isEventCompleteReady = state?.isEventCompleteReady === true;
  const isFinalized = state?.isFinalized === true;
  const canFinalize = state?.canFinalize === true;
  const buttonLabel = isEventCompleteReady
    ? "Event Ready"
    : (isFinalized ? "Round Finalized" : (canFinalize ? "Finalize Round" : "Cannot Finalize"));
  const readinessText = isEventCompleteReady
    ? "Final event round finalized. Event completion will be handled in a later step."
    : "";

  return {
    lifecycleState: state?.lifecycleState ?? "previewing",
    canFinalize,
    finalizeDisabled: !canFinalize,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    roundIndex: Number.isInteger(Number(state?.roundIndex)) ? Number(state.roundIndex) : -1,
    roundNumber,
    effectiveOutcomeKey: state?.effectiveOutcomeKey ?? "",
    isFinalized,
    isEventCompleteReady,
    footerText: state?.footerText ?? "Current Travel v2 round is not ready to finalize.",
    buttonLabel,
    feedbackText,
    hasFeedback: Boolean(feedbackText),
    readinessText,
    hasReadinessText: Boolean(readinessText)
  };
}

function normalizeEventCompletionReadiness(state = null) {
  const eventRoundCount = Number(state?.eventRoundCount) || 0;
  const finalizedRoundCount = Number(state?.finalizedRoundCount) || 0;
  const pendingRoundCount = Number(state?.pendingRoundCount) || 0;
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const countText = state?.isCompleted === true
    ? (blockedReasons[0] ?? "Travel v2 runner session is already completed.")
    : `${finalizedRoundCount} / ${eventRoundCount} rounds finalized. ${pendingRoundCount} ${pendingRoundCount === 1 ? "round" : "rounds"} pending.`;
  return {
    version: state?.version ?? 1,
    title: state?.title ?? "Event Completion Readiness",
    status: state?.status ?? "blocked",
    lifecycleState: state?.lifecycleState ?? "event-completion-blocked",
    eventReady: state?.eventReady === true,
    canCompleteEvent: state?.canCompleteEvent === true,
    isCompleted: state?.isCompleted === true,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    eventRoundCount,
    finalizedRoundCount,
    pendingRoundCount,
    countText,
    summaryText: state?.summaryText ?? "Finalize all Travel v2 rounds before event completion.",
    footerText: state?.footerText ?? "Finalize all Travel v2 rounds before event completion.",
    nextStepText: state?.nextStepText ?? "Finalize all Travel v2 rounds before event completion."
  };
}

function normalizePreviewRow(row = {}, applicationState = null, correctionState = {}) {
  const outcomeKey = String(row.outcomeKey ?? "skipped");
  const totals = isPlainObject(row.totalsByPressureType) ? row.totalsByPressureType : {};
  const pressureChips = Object.entries(totals)
    .filter(([, amount]) => Number(amount) !== 0)
    .map(([pressureType, amount]) => ({
      pressureType,
      label: humanizeIdentifier(pressureType),
      amount: Number(amount),
      displayAmount: `${Number(amount) > 0 ? "+" : ""}${Number(amount)}`
    }));
  const rowApplicationState = applicationState
    ? prepareTravelV2PressureApplicationState(applicationState.session, { selectedOutcomeKey: outcomeKey })
    : null;
  const blockedReasons = Array.isArray(rowApplicationState?.blockedReasons) ? rowApplicationState.blockedReasons : [];
  const effectiveOutcomeKey = correctionState.effectiveOutcomeKey ?? rowApplicationState?.applicationRecord?.outcomeKey ?? "";
  const isEffectiveAppliedOutcome = Boolean(effectiveOutcomeKey && effectiveOutcomeKey === outcomeKey);
  const hasEffectiveApplication = Boolean(correctionState.hasEffectiveApplication);
  const sessionCompleted = correctionState.sessionCompleted === true;
  const hasRealOutcomeKey = Boolean(outcomeKey && outcomeKey !== "skipped");
  const canCorrectPressure = hasEffectiveApplication
    && row.ok === true
    && hasRealOutcomeKey
    && !isEffectiveAppliedOutcome
    && !sessionCompleted;
  const correctionBlockedReasons = [];
  if (!hasEffectiveApplication) correctionBlockedReasons.push("Current Travel v2 round has no pressure application record to correct.");
  if (sessionCompleted) correctionBlockedReasons.push("Completed Travel v2 runner sessions cannot be corrected.");
  if (!hasRealOutcomeKey) correctionBlockedReasons.push("Correction requires a real Travel v2 pressure outcome key.");
  if (row.ok !== true) correctionBlockedReasons.push(`Selected Travel v2 pressure correction outcome is not available: ${outcomeKey}.`);
  if (isEffectiveAppliedOutcome) correctionBlockedReasons.push("Corrected Travel v2 pressure outcome must be different from the prior applied outcome.");
  return {
    outcomeKey,
    outcomeLabel: row.outcomeLabel || humanizeIdentifier(outcomeKey),
    tone: normalizeOutcomeTone(row),
    ok: row.ok === true,
    requestCount: Number(row.requestCount) || pressureChips.length,
    hasRequests: row.hasRequests === true || pressureChips.length > 0,
    summaryText: typeof row.summaryText === "string" && row.summaryText.trim() ? row.summaryText.trim() : "No Travel v2 pressure change.",
    pressureChips,
    errors: Array.isArray(row.errors) ? row.errors : [],
    canApplyPressure: rowApplicationState?.canApply === true,
    pressureApplyDisabled: rowApplicationState?.canApply !== true,
    pressureApplyBlockedReason: blockedReasons[0] ?? "",
    pressureApplyLabel: `Apply ${row.outcomeLabel || humanizeIdentifier(outcomeKey)}`,
    canCorrectPressure,
    pressureCorrectionDisabled: !canCorrectPressure,
    pressureCorrectionBlockedReason: correctionBlockedReasons[0] ?? "",
    pressureCorrectionLabel: `Correct to ${row.outcomeLabel || humanizeIdentifier(outcomeKey)}`,
    isEffectiveAppliedOutcome
  };
}

export function prepareTravelEventRunnerV2PreviewPanelState(appState = {}) {
  const preview = isPlainObject(appState.travelV2Preview) ? appState.travelV2Preview : {};
  const appSessionHasPressureApplications = isPlainObject(appState.session?.travelV2PressureApplications) || Array.isArray(appState.session?.travelV2PressureApplications);
  const runnerSession = appSessionHasPressureApplications ? appState.session : (isPlainObject(appState.travelV2PressureRunnerSession) ? appState.travelV2PressureRunnerSession : appState.session);
  const applicationState = isPlainObject(runnerSession) ? { session: runnerSession } : null;
  const currentApplicationState = isPlainObject(runnerSession) ? prepareTravelV2PressureApplicationState(runnerSession) : null;
  const effectiveOutcomeKey = currentApplicationState?.applicationRecord?.outcomeKey ?? "";
  const correctionState = {
    hasEffectiveApplication: Boolean(currentApplicationState?.applicationRecord),
    effectiveOutcomeKey,
    sessionCompleted: currentApplicationState?.sessionCompleted === true || runnerSession?.status === "completed" || appState.isCompleted === true
  };
  const rows = Array.isArray(preview.rows) ? preview.rows.map((row) => normalizePreviewRow(row, applicationState, correctionState)) : [];
  const available = preview.ok === true && rows.length > 0;
  const latestResult = isPlainObject(appState.travelV2PressureApplicationResult) ? appState.travelV2PressureApplicationResult : null;
  const latestFinalizationResult = isPlainObject(appState.travelV2RoundFinalizationResult) ? appState.travelV2RoundFinalizationResult : null;
  const latestCorrectionResult = isPlainObject(appState.travelV2PressureCorrectionResult) ? appState.travelV2PressureCorrectionResult : null;
  const latestBlockedReasons = Array.isArray(latestResult?.blockedReasons) ? latestResult.blockedReasons : [];
  const latestCorrectionBlockedReasons = Array.isArray(latestCorrectionResult?.blockedReasons) ? latestCorrectionResult.blockedReasons : [];
  const latestOutcomeLabel = latestResult?.selectedOutcomeKey ? humanizeIdentifier(latestResult.selectedOutcomeKey) : "";
  const previousCorrectionOutcomeLabel = latestCorrectionResult?.previousOutcomeKey ? humanizeIdentifier(latestCorrectionResult.previousOutcomeKey) : "";
  const correctedOutcomeLabel = latestCorrectionResult?.selectedOutcomeKey ? humanizeIdentifier(latestCorrectionResult.selectedOutcomeKey) : "";
  const correctionFeedbackText = latestCorrectionResult?.ok === true && latestCorrectionResult?.corrected === true
    ? `Corrected Travel v2 pressure outcome: ${previousCorrectionOutcomeLabel} → ${correctedOutcomeLabel}.`
    : (latestCorrectionBlockedReasons[0] ?? latestCorrectionResult?.error ?? "");
  const feedbackText = correctionFeedbackText || (latestResult?.ok === true && latestResult?.applied === true
    ? `Applied Travel v2 pressure outcome: ${latestOutcomeLabel}.`
    : (latestBlockedReasons[0] ?? latestResult?.error ?? ""));
  const travelV2RoundFinalizationState = normalizeFinalizationState(
    isPlainObject(runnerSession) ? prepareTravelV2RoundFinalizationState(runnerSession) : null,
    latestFinalizationResult
  );
  const travelV2EventCompletionReadiness = normalizeEventCompletionReadiness(
    isPlainObject(runnerSession) ? prepareTravelV2EventCompletionReadiness(runnerSession) : null
  );
  return {
    version: TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION,
    available,
    title: "Travel v2 Pressure Preview",
    subtitle: available
      ? `Round ${preview.roundNumber ?? appState.currentRoundNumber ?? "?"} — read-only GM preview`
      : "Travel v2 preview unavailable for this runner state.",
    roundIndex: Number.isInteger(Number(preview.roundIndex)) ? Number(preview.roundIndex) : -1,
    roundNumber: preview.roundNumber ?? appState.currentRoundNumber ?? null,
    rows,
    hasPressureChanges: rows.some((row) => row.hasRequests),
    travelV2RoundFinalizationState,
    roundFinalization: travelV2RoundFinalizationState,
    travelV2EventCompletionReadiness,
    eventCompletionReadiness: travelV2EventCompletionReadiness,
    pressureApplication: {
      canApply: currentApplicationState?.canApply === true,
      alreadyApplied: currentApplicationState?.alreadyApplied === true,
      appliedOutcomeLabel: currentApplicationState?.applicationRecord?.outcomeKey ? humanizeIdentifier(currentApplicationState.applicationRecord.outcomeKey) : "",
      blockedReasons: Array.isArray(currentApplicationState?.blockedReasons) ? currentApplicationState.blockedReasons : [],
      feedbackText,
      hasFeedback: Boolean(feedbackText)
    },
    errors: Array.isArray(preview.errors) ? preview.errors : [],
    footerText: "GM-only session-local controls apply pressure to this runner session only. They do not notify players, send chat, emit sockets, or change actors."
  };
}

export default prepareTravelEventRunnerV2PreviewPanelState;
