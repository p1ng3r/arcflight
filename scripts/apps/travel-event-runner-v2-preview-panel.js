import { prepareTravelV2PressureApplicationState } from "../helpers/travel-v2-pressure-application-state.js";
import { correctTravelV2PressureApplicationOnRunnerSession } from "../helpers/travel-v2-pressure-correction.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION = 3;

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

function normalizePreviewRow(row = {}, applicationState = null) {
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
  const correctionResult = applicationState
    ? correctTravelV2PressureApplicationOnRunnerSession(applicationState.session, { correctedOutcomeKey: outcomeKey, now: "2000-01-01T00:00:00.000Z" })
    : null;
  const correctionBlockedReasons = Array.isArray(correctionResult?.blockedReasons) ? correctionResult.blockedReasons : [];
  const effectiveOutcomeKey = rowApplicationState?.applicationRecord?.outcomeKey ?? "";
  const isEffectiveAppliedOutcome = Boolean(effectiveOutcomeKey && effectiveOutcomeKey === outcomeKey);
  const canCorrectPressure = correctionResult?.ok === true && correctionResult?.corrected === true && !isEffectiveAppliedOutcome;
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
  const rows = Array.isArray(preview.rows) ? preview.rows.map((row) => normalizePreviewRow(row, applicationState)) : [];
  const available = preview.ok === true && rows.length > 0;
  const currentApplicationState = isPlainObject(runnerSession) ? prepareTravelV2PressureApplicationState(runnerSession) : null;
  const latestResult = isPlainObject(appState.travelV2PressureApplicationResult) ? appState.travelV2PressureApplicationResult : null;
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
