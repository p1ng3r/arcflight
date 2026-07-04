import { prepareTravelV2PressureApplicationState } from "../helpers/travel-v2-pressure-application-state.js";
import { prepareTravelV2EventCompletionReadiness } from "../helpers/travel-v2-event-completion-readiness.js";
import { prepareTravelV2RoundFinalizationState } from "../helpers/travel-v2-round-finalization-state.js";
import { prepareTravelV2EventOutcomePackage } from "../helpers/travel-v2-event-outcome-package.js";
import { prepareTravelV2ActorApplicationPreviewFromSession } from "../helpers/travel-v2-actor-application-bridge.js";
import { prepareTravelV2FollowUpState } from "../helpers/travel-v2-followups.js";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION = 11;

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

function normalizeEventCompletionReadiness(state = null, latestResult = null) {
  const eventRoundCount = Number(state?.eventRoundCount) || 0;
  const finalizedRoundCount = Number(state?.finalizedRoundCount) || 0;
  const pendingRoundCount = Number(state?.pendingRoundCount) || 0;
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const completed = state?.isCompleted === true || latestResult?.completed === true;
  const resultBlockedReasons = Array.isArray(latestResult?.blockedReasons) ? latestResult.blockedReasons : [];
  const countText = completed
    ? "Event completed."
    : `${finalizedRoundCount} / ${eventRoundCount} rounds finalized. ${pendingRoundCount} ${pendingRoundCount === 1 ? "round" : "rounds"} pending.`;
  const feedbackText = latestResult?.ok === true && latestResult?.completed === true
    ? (latestResult.summaryText ?? "Completed Travel v2 event.")
    : (resultBlockedReasons[0] ?? latestResult?.error ?? "");
  const canCompleteEvent = state?.canCompleteEvent === true && !completed;
  return {
    version: state?.version ?? 1,
    title: state?.title ?? "Event Completion Readiness",
    status: state?.status ?? "blocked",
    lifecycleState: state?.lifecycleState ?? "event-completion-blocked",
    eventReady: state?.eventReady === true,
    canCompleteEvent,
    completeDisabled: !canCompleteEvent,
    completeButtonLabel: completed ? "Event Completed" : (canCompleteEvent ? "Complete Event" : "Cannot Complete Event"),
    isCompleted: completed,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    eventRoundCount,
    finalizedRoundCount,
    pendingRoundCount,
    countText,
    summaryText: state?.summaryText ?? "Finalize all Travel v2 rounds before event completion.",
    footerText: state?.footerText ?? "Finalize all Travel v2 rounds before event completion.",
    nextStepText: completed ? "Travel v2 event session is completed locally." : (state?.nextStepText ?? "Finalize all Travel v2 rounds before event completion."),
    feedbackText,
    hasFeedback: Boolean(feedbackText)
  };
}


function normalizeOutcomePackage(state = null, latestResult = null) {
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const resultBlockedReasons = Array.isArray(latestResult?.blockedReasons) ? latestResult.blockedReasons : [];
  const alreadyApplied = state?.alreadyApplied === true || latestResult?.applied === true;
  const canApply = state?.canPreparePackage === true && !alreadyApplied;
  return {
    canPreparePackage: state?.canPreparePackage === true,
    canApply,
    applyDisabled: !canApply,
    applyButtonLabel: alreadyApplied ? "Outcome Applied" : (canApply ? "Apply Outcome Package" : "Cannot Apply Outcome"),
    alreadyApplied,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    eventOutcomeKey: state?.eventOutcomeKey ?? "mixed",
    eventOutcomeLabel: state?.eventOutcomeLabel ?? "Mixed",
    summaryText: state?.summaryText ?? "Complete the Travel v2 event before preparing an outcome package.",
    nextStepText: state?.nextStepText ?? "Complete the Travel v2 event before preparing an outcome package.",
    pressureSummary: state?.pressureSummary ?? {},
    hazardSummary: Array.isArray(state?.hazardSummary) ? state.hazardSummary : [],
    shipScarCandidates: Array.isArray(state?.shipScarCandidates) ? state.shipScarCandidates : [],
    fortuneCandidates: Array.isArray(state?.fortuneCandidates) ? state.fortuneCandidates : [],
    rewardCandidates: Array.isArray(state?.rewardCandidates) ? state.rewardCandidates : [],
    consequenceCandidates: Array.isArray(state?.consequenceCandidates) ? state.consequenceCandidates : [],
    hasHazards: Array.isArray(state?.hazardSummary) && state.hazardSummary.length > 0,
    hasShipScars: Array.isArray(state?.shipScarCandidates) && state.shipScarCandidates.length > 0,
    hasFortunes: Array.isArray(state?.fortuneCandidates) && state.fortuneCandidates.length > 0,
    hasRewards: Array.isArray(state?.rewardCandidates) && state.rewardCandidates.length > 0,
    hasConsequences: Array.isArray(state?.consequenceCandidates) && state.consequenceCandidates.length > 0,
    feedbackText: latestResult?.ok === true && latestResult?.applied === true ? "Applied Travel v2 outcome package to this runner session." : (resultBlockedReasons[0] ?? latestResult?.error ?? ""),
    hasFeedback: Boolean(latestResult?.ok === true && latestResult?.applied === true || resultBlockedReasons[0] || latestResult?.error)
  };
}

function normalizeActorApplicationPreview(state = null, latestResult = null) {
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const resultBlockedReasons = Array.isArray(latestResult?.blockedReasons) ? latestResult.blockedReasons : [];
  const applied = latestResult?.ok === true && latestResult?.applied === true;
  return {
    canApply: state?.canApply === true && !applied,
    applyDisabled: state?.canApply !== true || applied,
    applyButtonLabel: applied ? "Approved Changes Applied" : (state?.canApply === true ? "Apply Approved Changes to Ship" : "Cannot Apply to Ship"),
    targetActorName: state?.targetActor?.name ?? "No ship selected",
    targetActorType: state?.targetActor?.type ?? "",
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    proposedChanges: Array.isArray(state?.proposedChanges) ? state.proposedChanges : [],
    manualFollowUps: Array.isArray(state?.manualFollowUps) ? state.manualFollowUps : [],
    hasProposedChanges: Array.isArray(state?.proposedChanges) && state.proposedChanges.length > 0,
    hasManualFollowUps: Array.isArray(state?.manualFollowUps) && state.manualFollowUps.length > 0,
    feedbackText: applied ? "Applied approved Travel v2 changes to the selected ship." : (resultBlockedReasons[0] ?? latestResult?.error ?? ""),
    hasFeedback: Boolean(applied || resultBlockedReasons[0] || latestResult?.error)
  };
}

function normalizeStationBenefitDisplay(state = null) {
  const selectedCandidate = isPlainObject(state?.selectedCandidate) ? state.selectedCandidate : null;
  const reviewRequest = {
    requested: Boolean(state?.selectedQueueKey),
    selectedQueueKey: state?.selectedQueueKey ?? null,
    status: selectedCandidate?.status ?? "blocked",
    ready: selectedCandidate?.ready === true,
    feedbackText: selectedCandidate?.ready === true
      ? "Station benefit review candidate is ready for GM/table review. No benefit has been used or applied."
      : (selectedCandidate?.reason ?? "No station benefit review requested."),
    hasFeedback: Boolean(state?.selectedQueueKey || selectedCandidate?.ready === true)
  };
  const rows = Array.isArray(state?.rows) ? state.rows.map((row) => {
    const status = typeof row?.status === "string" && row.status.trim() ? row.status.trim() : "blocked";
    const useAvailable = row?.useAvailable === true;
    const canReview = row?.canReview === true;
    const disabledReason = typeof row?.disabledReason === "string" && row.disabledReason.trim()
      ? row.disabledReason.trim()
      : (useAvailable ? "" : (status === "pending" ? "Use requests are not available in this display-only pass." : `Pending station benefit is ${status}.`));
    return {
      queueKey: row?.queueKey ?? null,
      title: row?.title || "Pending station benefit",
      sourceStationLabel: row?.sourceStationLabel || row?.sourceStation || "Source station",
      targetStationLabel: row?.targetStationLabel || row?.targetStation || "Target station",
      displaySummary: row?.playerSafeSummary || row?.publicText || "Station benefit details are unavailable.",
      status,
      statusLabel: status === "pending" ? "Pending" : humanizeIdentifier(status || "blocked"),
      requestAvailabilityLabel: useAvailable ? "Request available" : (canReview ? "Review only" : "Not ready"),
      disabledReason,
      canReview,
      useAvailable,
      reviewOnly: row?.reviewOnly !== false
    };
  }) : [];
  return {
    available: rows.length > 0,
    title: "Pending Station Benefits",
    subtitle: rows.length > 0
      ? "Display-only player-safe station benefit review. Request and use controls arrive in a later pass."
      : "No pending station benefits to display.",
    rows,
    hasRows: rows.length > 0,
    pendingCount: rows.filter((row) => row.status === "pending").length,
    disabledCount: rows.filter((row) => !row.useAvailable).length,
    reviewRequest,
    reviewOnly: true
  };
}

function normalizeRoundActionOrderReorderRequest(request = null) {
  const currentRows = Array.isArray(request?.currentRows) ? request.currentRows : [];
  const proposedRows = Array.isArray(request?.proposedRows) ? request.proposedRows : [];
  const blockedReasons = Array.isArray(request?.blockedReasons) ? request.blockedReasons : [];
  return {
    requested: request?.requested === true,
    ready: request?.ready === true,
    blocked: request?.blocked !== false,
    status: request?.status ?? "not-requested",
    feedbackText: request?.feedbackText ?? "No GM reorder review requested.",
    hasFeedback: Boolean(request?.requested === true || request?.feedbackText),
    showComparison: request?.requested === true,
    currentRows,
    proposedRows,
    hasComparisonRows: currentRows.length > 0 || proposedRows.length > 0,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    mutationNote: request?.mutationNote ?? "Review-only reorder candidate. No order is persisted or applied.",
    reviewOnly: true
  };
}

function normalizeRoundActionOrderDisplay(state = null, options = {}) {
  const rows = Array.isArray(state?.rows) ? state.rows.map((row) => ({
    stationKey: row?.stationKey ?? "",
    stationName: row?.stationName || "Station",
    orderNumber: Number.isInteger(Number(row?.orderNumber)) ? Number(row.orderNumber) : null,
    orderLabel: Number.isInteger(Number(row?.orderNumber)) ? `#${Number(row.orderNumber)}` : "—",
    selectedActionLabel: row?.selectedActionLabel || row?.actionTypeLabel || "Station order",
    status: row?.status || "needs-order",
    statusLabel: row?.statusLabel || humanizeIdentifier(row?.status || "needs-order"),
    current: row?.current === true,
    currentMarker: row?.current === true ? "Current" : "",
    resultLabel: row?.resultLabel || "Unresolved"
  })) : [];
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const blockedText = blockedReasons[0] ?? "";
  const proposedShellOrder = rows.map((row) => row.stationKey).reverse();
  return {
    available: rows.length > 0,
    title: "Round Action Order",
    subtitle: rows.length > 0
      ? "Display-only station action order for the current Travel v2 round."
      : "No round action order is available for this state.",
    roundIndex: Number.isInteger(Number(state?.roundIndex)) ? Number(state.roundIndex) : -1,
    roundNumber: state?.roundNumber ?? null,
    phase: state?.phase ?? "roundReveal",
    rows,
    hasRows: rows.length > 0,
    rowCount: rows.length,
    hasCurrent: state?.hasCurrent === true,
    blocked: state?.blocked === true,
    blockedReasons,
    blockedText,
    hasBlockedText: Boolean(blockedText),
    canRequestReorderReview: rows.length > 1,
    proposedShellOrder,
    proposedShellOrderCsv: proposedShellOrder.join(","),
    footerText: state?.footerText || (rows.length > 0 ? "Round action order is display-only." : "No round action-order rows are available."),
    reorderRequest: normalizeRoundActionOrderReorderRequest(state?.reorderRequest),
    commitResult: normalizeRoundActionOrderCommitResult(options.commitResult, rows, options),
    persistResult: normalizeRoundActionOrderPersistResult(options.persistResult, rows, options),
    canPersistCommittedOrder: options.hasCommittedOrder === true && (options.isGM === true || options.user?.isGM === true),
    readOnly: true
  };
}

function orderLabelsForKeys(keys = [], rows = []) {
  const rowByKey = new Map(rows.map((row) => [row.stationKey, row]));
  return (Array.isArray(keys) ? keys : []).map((stationKey, index) => {
    const row = rowByKey.get(stationKey);
    const stationName = row?.stationName || humanizeIdentifier(stationKey || "station");
    return {
      stationKey,
      stationName,
      orderNumber: index + 1,
      orderLabel: `#${index + 1}`,
      displayText: `#${index + 1} · ${stationName}`,
      playerSafe: true
    };
  });
}

function normalizeRoundActionOrderPersistResult(result = null, rows = [], options = {}) {
  if (!isPlainObject(result)) {
    return { available: false, hasFeedback: false, status: "none", title: "Latest Persistence Result", summaryText: "No committed round action-order persistence has been attempted.", readOnly: true };
  }
  const isGm = options.isGM === true || options.user?.isGM === true;
  const blockedReasons = Array.isArray(result.blockedReasons) ? result.blockedReasons.filter((reason) => typeof reason === "string" && reason.trim()) : [];
  const status = result.persisted === true ? "persisted" : (result.duplicate === true ? "duplicate" : (result.blocked === true || result.ok === false ? "blocked" : "review"));
  const keys = Array.isArray(result.persistedRecord?.order) ? result.persistedRecord.order : (Array.isArray(result.persistedRecord?.stationOrder) ? result.persistedRecord.stationOrder : []);
  const persistedRows = orderLabelsForKeys(keys, rows);
  const orderText = persistedRows.length > 0 ? persistedRows.map((row) => row.displayText).join(" → ") : "No persisted order listed.";
  const summaryText = typeof result.summaryText === "string" && result.summaryText.trim()
    ? result.summaryText.trim()
    : (status === "persisted" ? `Committed action order persisted: ${orderText}.` : (status === "duplicate" ? `Committed action order was already persisted: ${orderText}. No local session changes were made.` : `Committed action order persistence blocked: ${blockedReasons[0] ?? "No reason provided."}`));
  return {
    available: true,
    hasFeedback: true,
    status,
    statusLabel: status === "persisted" ? "Persisted" : (status === "duplicate" ? "Duplicate" : (status === "blocked" ? "Blocked" : "Review")),
    title: "Latest Persistence Result",
    summaryText,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    persistedRows: isGm || status !== "blocked" ? persistedRows : [],
    hasPersistedRows: (isGm || status !== "blocked") && persistedRows.length > 0,
    persistedOrderText: isGm || status !== "blocked" ? orderText : "",
    playerSafe: !isGm,
    readOnly: true
  };
}

function normalizeRoundActionOrderCommitResult(result = null, rows = [], options = {}) {
  if (!isPlainObject(result)) {
    return { available: false, hasFeedback: false, status: "none", title: "Latest Commit Result", summaryText: "No round action-order commit has been attempted.", readOnly: true };
  }
  const isGm = options.isGM === true || options.user?.isGM === true;
  const blockedReasons = Array.isArray(result.blockedReasons) ? result.blockedReasons.filter((reason) => typeof reason === "string" && reason.trim()) : [];
  const status = result.committed === true ? "committed" : (result.duplicate === true ? "duplicate" : (result.blocked === true || result.ok === false ? "blocked" : "review"));
  const committedRows = orderLabelsForKeys(result.committedOrder, rows);
  const previousRows = orderLabelsForKeys(result.previousOrder, rows);
  const safeAudit = isGm && isPlainObject(result.auditRecord) ? result.auditRecord : {};
  const roundNumber = result.roundNumber ?? safeAudit.roundNumber ?? null;
  const roundIndex = Number.isInteger(Number(result.roundIndex ?? safeAudit.roundIndex)) ? Number(result.roundIndex ?? safeAudit.roundIndex) : null;
  const orderText = committedRows.length > 0 ? committedRows.map((row) => row.displayText).join(" → ") : "No committed order listed.";
  const previousOrderText = previousRows.length > 0 ? previousRows.map((row) => row.displayText).join(" → ") : "No previous order listed.";
  const roundText = roundNumber ? `Round ${roundNumber}` : (roundIndex !== null ? `Round index ${roundIndex}` : "Current round");
  const summaryText = status === "committed"
    ? `${roundText} action order committed: ${orderText}.`
    : (status === "duplicate"
      ? `${roundText} already had this committed action order: ${orderText}. No session changes were made.`
      : `${roundText} action order commit blocked: ${blockedReasons[0] ?? result.reason ?? "No reason provided."}`);
  return {
    available: true,
    hasFeedback: true,
    status,
    statusLabel: status === "committed" ? "Committed" : (status === "duplicate" ? "Duplicate" : (status === "blocked" ? "Blocked" : "Review")),
    title: "Latest Commit Result",
    summaryText,
    reason: typeof result.reason === "string" ? result.reason : "",
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    roundNumber,
    roundIndex,
    hasRoundMetadata: roundNumber !== null || roundIndex !== null,
    committedRows: isGm || status !== "blocked" ? committedRows : [],
    previousRows: isGm ? previousRows : [],
    hasCommittedRows: (isGm || status !== "blocked") && committedRows.length > 0,
    hasPreviousRows: isGm && previousRows.length > 0,
    committedOrderText: isGm || status !== "blocked" ? orderText : "",
    previousOrderText: isGm ? previousOrderText : "",
    timestamp: isGm && typeof safeAudit.timestamp === "string" ? safeAudit.timestamp : "",
    source: isGm && typeof safeAudit.source === "string" ? safeAudit.source : "",
    userName: isGm && typeof safeAudit.userName === "string" ? safeAudit.userName : "",
    hasAuditMetadata: Boolean(isGm && (safeAudit.timestamp || safeAudit.source || safeAudit.userName)),
    playerSafe: !isGm,
    readOnly: true
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
  const latestEventCompletionResult = isPlainObject(appState.travelV2EventCompletionResult) ? appState.travelV2EventCompletionResult : null;
  const travelV2EventCompletionReadiness = normalizeEventCompletionReadiness(
    isPlainObject(runnerSession) ? prepareTravelV2EventCompletionReadiness(runnerSession) : null,
    latestEventCompletionResult
  );
  const latestOutcomeApplicationResult = isPlainObject(appState.travelV2EventOutcomeApplicationResult) ? appState.travelV2EventOutcomeApplicationResult : null;
  const travelV2EventOutcomePackage = normalizeOutcomePackage(
    isPlainObject(runnerSession) ? prepareTravelV2EventOutcomePackage(runnerSession) : null,
    latestOutcomeApplicationResult
  );
  const latestActorApplicationResult = isPlainObject(appState.travelV2ActorApplicationResult) ? appState.travelV2ActorApplicationResult : null;
  const actorPreviewSource = isPlainObject(runnerSession) ? prepareTravelV2ActorApplicationPreviewFromSession(runnerSession, appState.actor, { session: runnerSession }) : null;
  const travelV2ActorApplicationPreview = normalizeActorApplicationPreview(actorPreviewSource, latestActorApplicationResult);
  const travelV2FollowUps = prepareTravelV2FollowUpState(appState.actor, latestActorApplicationResult?.applicationRecord ?? actorPreviewSource, { session: runnerSession });
  const stationBenefitDisplay = normalizeStationBenefitDisplay(appState.travelV2StationBenefitUseReviewPlayerState);
  const currentOrderState = isPlainObject(runnerSession?.travelV2RoundActionOrder?.rounds) ? (runnerSession.travelV2RoundActionOrder.rounds[String(runnerSession.currentRoundIndex ?? 0)] ?? runnerSession.travelV2RoundActionOrder.rounds[runnerSession.currentRoundIndex ?? 0] ?? null) : null;
  const hasCommittedOrder = isPlainObject(currentOrderState) && (Array.isArray(currentOrderState.order) || Array.isArray(currentOrderState.stationOrder));
  const roundActionOrderDisplay = normalizeRoundActionOrderDisplay(isPlainObject(runnerSession) ? prepareTravelV2RoundActionOrderState(runnerSession, { user: appState.user, isGM: appState.isGM === true, travelV2RoundActionOrderReorderRequested: appState.travelV2RoundActionOrderReorderRequested === true, proposedOrder: appState.travelV2ProposedRoundActionOrder }) : null, { user: appState.user, isGM: appState.isGM === true, commitResult: appState.travelV2RoundActionOrderCommitResult, persistResult: appState.travelV2RoundActionOrderPersistResult, hasCommittedOrder });
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
    travelV2EventOutcomePackage,
    eventOutcomePackage: travelV2EventOutcomePackage,
    travelV2ActorApplicationPreview,
    actorApplicationPreview: travelV2ActorApplicationPreview,
    travelV2FollowUps,
    followUps: travelV2FollowUps,
    stationBenefitDisplay,
    travelV2StationBenefitDisplay: stationBenefitDisplay,
    roundActionOrderDisplay,
    travelV2RoundActionOrderDisplay: roundActionOrderDisplay,
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
