import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";
import { queueTravelV2InterStationHelpPendingRecord } from "./travel-v2-inter-station-help-pending-queue.js";

export const TRAVEL_V2_INTER_STATION_HELP_CREATE_REVIEW_VERSION = 1;

function text(value) { return typeof value === "string" ? value.trim() : ""; }
export function integerOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const number = Number(trimmed);
    return Number.isInteger(number) ? number : null;
  }
  if (typeof value !== "number") return null;
  return Number.isInteger(value) ? value : null;
}
function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

function canonicalResultBandFromSession(session = {}, action = {}) {
  const roundIndex = integerOrNull(action.roundIndex);
  const sourceStationKey = text(action.sourceStationKey);
  if (roundIndex === null || !sourceStationKey) return "";
  const raw = session?.roundResults?.[roundIndex]?.stationResults?.[sourceStationKey];
  if (typeof raw === "string") return text(raw);
  if (raw && typeof raw === "object") return text(raw.resultBand ?? raw.result ?? raw.outcome ?? raw.degreeOfSuccess);
  return "";
}

function selectedHelpIdentityFrom(value = {}) {
  return {
    actionId: text(value.actionId),
    sourceStationKey: text(value.sourceStationKey),
    targetStationKey: text(value.targetStationKey),
    roundIndex: integerOrNull(value.roundIndex)
  };
}

export function travelV2InterStationHelpIdentityMatches(action = {}, identity = {}) {
  return text(action.actionId) === text(identity.actionId)
    && text(action.sourceStationKey) === text(identity.sourceStationKey)
    && text(action.targetStationKey) === text(identity.targetStationKey)
    && integerOrNull(action.roundIndex) === integerOrNull(identity.roundIndex);
}

export function prepareTravelV2InterStationHelpQueueStatus(value = null) {
  if (!value || typeof value !== "object") return null;
  return {
    ok: value.ok === true,
    queued: value.queued === true,
    duplicate: value.duplicate === true,
    status: text(value.status) || (value.queued === true ? "queued" : (value.duplicate === true ? "duplicate" : "blocked")),
    message: text(value.message),
    blockedReasons: Array.isArray(value.blockedReasons) ? value.blockedReasons.map(text).filter(Boolean) : []
  };
}


function blockedReview(reason, message, queueStatus = null) {
  return {
    hasSelection: false,
    reviewable: false,
    queueable: false,
    blocked: true,
    blockedReasons: [reason],
    message,
    queued: queueStatus?.queued === true,
    duplicate: queueStatus?.duplicate === true,
    playerSafe: true
  };
}

function blockedUpdate(session, reason, message) {
  return {
    ok: false,
    queued: false,
    duplicate: false,
    shouldAdoptSession: false,
    nextSession: cloneData(session),
    status: {
      ok: false,
      queued: false,
      duplicate: false,
      status: "blocked",
      message,
      blockedReasons: [reason]
    }
  };
}

function selectedIdentityIsEmpty(identity = {}) {
  return !text(identity.actionId)
    && !text(identity.sourceStationKey)
    && !text(identity.targetStationKey)
    && integerOrNull(identity.roundIndex) === null;
}

function validateSelectedRound(session = {}, selectedIdentity = {}) {
  const currentRoundIndex = integerOrNull(session?.currentRoundIndex);
  const selectedRoundIndex = integerOrNull(selectedIdentity?.roundIndex);
  if (currentRoundIndex === null) {
    return { ok: false, reason: "current-travel-round-unavailable", message: "The current Travel round is unavailable.", currentRoundIndex, selectedRoundIndex };
  }
  if (selectedRoundIndex === null) {
    return { ok: false, reason: "selected-inter-station-help-round-required", message: "The selected help round is missing or malformed.", currentRoundIndex, selectedRoundIndex };
  }
  if (selectedRoundIndex !== currentRoundIndex) {
    return { ok: false, reason: "selected-inter-station-help-round-not-current", message: "The selected help belongs to a previous Travel round.", currentRoundIndex, selectedRoundIndex };
  }
  return { ok: true, currentRoundIndex, selectedRoundIndex };
}

export function prepareTravelV2InterStationHelpCreateReviewState(session = {}, helpState = {}, selectedIdentity = {}, options = {}) {
  if (options.canReview !== true) return null;
  const identity = selectedHelpIdentityFrom(selectedIdentity);
  const queueStatus = prepareTravelV2InterStationHelpQueueStatus(options.queueResult ?? null);
  if (selectedIdentityIsEmpty(selectedIdentity)) {
    return queueStatus
      ? { hasSelection: false, reviewable: false, queueable: false, blocked: queueStatus.status === "blocked", queued: queueStatus.queued, duplicate: queueStatus.duplicate, message: queueStatus.message, blockedReasons: queueStatus.blockedReasons, playerSafe: true }
      : null;
  }
  const roundValidation = validateSelectedRound(session, selectedIdentity);
  if (roundValidation.ok !== true) return blockedReview(roundValidation.reason, roundValidation.message, queueStatus);
  const actions = Array.isArray(helpState.helpActions) ? helpState.helpActions : [];
  const action = actions.find((row) => travelV2InterStationHelpIdentityMatches(row, { ...identity, roundIndex: roundValidation.currentRoundIndex }));
  if (!action) return blockedReview("selected-inter-station-help-action-not-found", "Selected help is no longer available for review.", queueStatus);

  const resultBand = canonicalResultBandFromSession(session, action);
  const resultSuccessful = resultBand === "success" || resultBand === "criticalSuccess";
  const blockedReasons = [];
  if (action.available !== true) blockedReasons.push(action.unavailableReason || "inter-station-help-action-unavailable");
  if (!resultSuccessful) blockedReasons.push(resultBand ? "inter-station-help-result-not-successful" : "inter-station-help-source-result-unresolved");
  if (action.stationOrderLocked !== true) blockedReasons.push("station-order-not-locked");

  return {
    hasSelection: true,
    actionId: action.actionId,
    authoredActionId: action.authoredActionId || action.actionId,
    title: action.title,
    publicText: action.publicText,
    sourceStationKey: action.sourceStationKey,
    sourceStationName: action.sourceStationName,
    targetStationKey: action.targetStationKey,
    targetStationName: action.targetStationName,
    roundIndex: action.roundIndex,
    roundNumber: action.roundNumber,
    resultBand,
    tags: Array.isArray(action.tags) ? [...action.tags] : [],
    criticalSuccess: resultBand === "criticalSuccess",
    criticalSuccessMetadata: resultBand === "criticalSuccess" && action.criticalSuccessMetadata ? cloneData(action.criticalSuccessMetadata) : null,
    stableHelpIdentity: `inter-station-help:${action.roundIndex}:${action.actionId}:${action.sourceStationKey}:${action.targetStationKey}`,
    reviewable: true,
    queueable: blockedReasons.length === 0,
    blocked: blockedReasons.length > 0,
    blockedReasons,
    message: queueStatus?.message || (blockedReasons.length > 0 ? "Help cannot be queued from the current canonical source result." : "Review ready. Queue Help will add this to the pending station benefit queue."),
    queued: queueStatus?.queued === true,
    duplicate: queueStatus?.duplicate === true,
    playerSafe: true,
    reviewOnly: true,
    applied: false,
    consumed: false
  };
}


export function prepareTravelV2InterStationHelpQueueRunnerUpdate(session = {}, selectedIdentity = {}, options = {}) {
  if (options.canQueue !== true) {
    return blockedUpdate(session, "travel-v2-inter-station-help-gm-required", "Only the GM can queue Inter-Station Help.");
  }

  const roundValidation = validateSelectedRound(session, selectedIdentity);
  if (roundValidation.ok !== true) return blockedUpdate(session, roundValidation.reason, roundValidation.message);

  const actionId = text(selectedIdentity.actionId);
  const sourceStationKey = text(selectedIdentity.sourceStationKey);
  const targetStationKey = text(selectedIdentity.targetStationKey);
  if (!actionId || !sourceStationKey || !targetStationKey) {
    return blockedUpdate(session, "selected-inter-station-help-identity-incomplete", "The selected help identity is incomplete.");
  }

  const currentRoundIndex = roundValidation.currentRoundIndex;
  const helpState = prepareTravelV2InterStationHelpActions(session, { roundIndex: currentRoundIndex, includeUnavailable: true });
  const action = (helpState.helpActions ?? []).find((row) => text(row.actionId) === actionId
    && text(row.sourceStationKey) === sourceStationKey
    && text(row.targetStationKey) === targetStationKey
    && integerOrNull(row.roundIndex) === currentRoundIndex);

  if (!action) {
    return blockedUpdate(session, "selected-inter-station-help-action-not-found", "The selected help is no longer available in the current round.");
  }

  const resultBand = canonicalResultBandFromSession(session, action);
  const resultContext = {
    actionId: action.actionId,
    sourceStationKey: action.sourceStationKey,
    targetStationKey: action.targetStationKey,
    roundIndex: currentRoundIndex,
    roundNumber: action.roundNumber,
    resultBand
  };
  const queueResult = queueTravelV2InterStationHelpPendingRecord(session, action, resultContext, { enqueueRequested: true });
  const queued = queueResult.queued === true;
  const duplicate = queueResult.duplicate === true;
  return {
    ok: queueResult.ok === true,
    queued,
    duplicate,
    shouldAdoptSession: queued && Boolean(queueResult.session),
    nextSession: queued ? cloneData(queueResult.session) : cloneData(session),
    selectedIdentity: { actionId, sourceStationKey, targetStationKey, roundIndex: currentRoundIndex },
    status: {
      ok: queueResult.ok === true,
      queued,
      duplicate,
      status: queued ? "queued" : (duplicate ? "duplicate" : "blocked"),
      message: queued ? "Inter-Station Help queued as a pending station benefit." : (duplicate ? "Inter-Station Help is already queued." : "Inter-Station Help queueing was blocked."),
      blockedReasons: Array.isArray(queueResult.blockedReasons) ? [...queueResult.blockedReasons] : []
    }
  };
}

export default prepareTravelV2InterStationHelpCreateReviewState;
