export const TRAVEL_V2_INTER_STATION_HELP_CREATE_REVIEW_VERSION = 1;

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function integerOrNull(value) { const number = Number(value); return Number.isInteger(number) ? number : null; }
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

export function prepareTravelV2InterStationHelpCreateReviewState(session = {}, helpState = {}, selectedIdentity = {}, options = {}) {
  if (options.canReview !== true) return null;
  const identity = selectedHelpIdentityFrom(selectedIdentity);
  const actions = Array.isArray(helpState.helpActions) ? helpState.helpActions : [];
  const action = actions.find((row) => travelV2InterStationHelpIdentityMatches(row, identity));
  const queueStatus = prepareTravelV2InterStationHelpQueueStatus(options.queueResult ?? null);
  if (!action) {
    if (!identity.actionId && !identity.sourceStationKey && !identity.targetStationKey && identity.roundIndex === null) {
      return queueStatus
        ? { hasSelection: false, reviewable: false, queueable: false, blocked: queueStatus.status === "blocked", queued: queueStatus.queued, duplicate: queueStatus.duplicate, message: queueStatus.message, blockedReasons: queueStatus.blockedReasons, playerSafe: true }
        : null;
    }
    return { hasSelection: false, reviewable: false, queueable: false, blocked: true, blockedReasons: ["selected-inter-station-help-action-not-found"], message: "Selected help is no longer available for review.", playerSafe: true };
  }

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

export default prepareTravelV2InterStationHelpCreateReviewState;
