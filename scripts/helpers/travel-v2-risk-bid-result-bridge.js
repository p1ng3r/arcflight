export const TRAVEL_V2_RISK_BID_RESULT_BRIDGE_VERSION = 1;

const REVIEWED_CANDIDATE_TYPES = Object.freeze([
  "benefit",
  "progress",
  "momentumCandidate",
  "rewardImprovement",
  "consequenceCandidate",
  "pressureCandidate",
  "hazardProgressCandidate",
  "stationComplication",
  "nextRoundDifficulty",
  "hazardEscalation",
  "shipScarCandidate",
  "severePressureCandidate",
  "additionalHazardCandidate"
]);

const REVIEWED_CANDIDATE_KEYS = Object.freeze([
  "bridgeVersion",
  "source",
  "type",
  "severity",
  "tier",
  "resultBand",
  "dangerLevel",
  "stationKey",
  "actionId",
  "roundIndex",
  "roundNumber",
  "label",
  "text",
  "requiresReview"
]);

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeIntegerOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && Number.isFinite(number) ? number : null;
}

function freezeOutput(value) {
  if (Array.isArray(value)) {
    for (const entry of value) freezeOutput(entry);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) freezeOutput(entry);
  }
  return Object.freeze(value);
}

export function normalizeTravelV2RiskBidReviewedCandidateType(value) {
  const normalized = safeString(value);
  return REVIEWED_CANDIDATE_TYPES.includes(normalized) ? normalized : null;
}

export function isTravelV2RiskBidReviewedCandidateType(value) {
  return normalizeTravelV2RiskBidReviewedCandidateType(value) !== null;
}

function candidateStateFromInput(input) {
  if (!input || typeof input !== "object") return null;
  if (input.preview && typeof input.preview === "object") return input.preview;
  return input;
}

function baseBlockedOutput(candidateState, blockedReasons) {
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_RESULT_BRIDGE_VERSION,
    ok: false,
    hasReviewedCandidates: false,
    blockedReasons: Array.from(new Set(blockedReasons)),
    resultBand: safeString(candidateState?.resultBand) || null,
    tier: candidateState?.tier ?? null,
    dcModifier: candidateState?.dcModifier ?? null,
    dangerLevel: safeString(candidateState?.dangerLevel) || "none",
    stationKey: safeString(candidateState?.stationKey),
    stationName: safeString(candidateState?.stationName),
    actionId: safeString(candidateState?.actionId),
    actionName: safeString(candidateState?.actionName),
    roundIndex: safeIntegerOrNull(candidateState?.roundIndex),
    roundNumber: safeIntegerOrNull(candidateState?.roundNumber),
    reviewedCandidates: [],
    gmReviewRequired: false
  });
}

function buildReviewedCandidate(candidate, context) {
  const type = normalizeTravelV2RiskBidReviewedCandidateType(candidate?.type);
  if (!type) return null;
  const reviewedCandidate = {
    bridgeVersion: TRAVEL_V2_RISK_BID_RESULT_BRIDGE_VERSION,
    source: "riskBidResult",
    type,
    severity: safeString(candidate?.severity) || "standard",
    tier: context.tier,
    resultBand: context.resultBand,
    dangerLevel: context.dangerLevel,
    stationKey: context.stationKey,
    actionId: context.actionId,
    roundIndex: context.roundIndex,
    roundNumber: context.roundNumber,
    label: safeString(candidate?.label),
    text: safeString(candidate?.text),
    requiresReview: candidate?.requiresReview === false ? false : true
  };
  for (const key of Object.keys(reviewedCandidate)) {
    if (!REVIEWED_CANDIDATE_KEYS.includes(key)) delete reviewedCandidate[key];
  }
  return reviewedCandidate;
}

export function prepareTravelV2RiskBidReviewedCandidateBridge(input = {}, options = {}) {
  void options;
  const candidateState = candidateStateFromInput(input);
  if (!candidateState || typeof candidateState !== "object") return baseBlockedOutput(null, ["missing-risk-bid-result-candidate-state"]);
  if (candidateState.ok !== true) return baseBlockedOutput(candidateState, ["risk-bid-result-not-ok"]);
  if (candidateState.hasRiskBidResult !== true) return baseBlockedOutput(candidateState, ["missing-risk-bid-result"]);
  if (!Array.isArray(candidateState.candidates) || candidateState.candidates.length === 0) return baseBlockedOutput(candidateState, ["missing-risk-bid-result-candidates"]);

  const context = {
    tier: candidateState.tier ?? null,
    resultBand: safeString(candidateState.resultBand) || null,
    dangerLevel: safeString(candidateState.dangerLevel) || "none",
    stationKey: safeString(candidateState.stationKey),
    actionId: safeString(candidateState.actionId),
    roundIndex: safeIntegerOrNull(candidateState.roundIndex),
    roundNumber: safeIntegerOrNull(candidateState.roundNumber)
  };
  const reviewedCandidates = candidateState.candidates.map((candidate) => buildReviewedCandidate(candidate, context)).filter(Boolean);
  if (reviewedCandidates.length === 0) return baseBlockedOutput(candidateState, ["no-valid-reviewed-candidates"]);

  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_RESULT_BRIDGE_VERSION,
    ok: true,
    hasReviewedCandidates: true,
    blockedReasons: [],
    resultBand: context.resultBand,
    tier: context.tier,
    dcModifier: candidateState.dcModifier ?? null,
    dangerLevel: context.dangerLevel,
    stationKey: context.stationKey,
    stationName: safeString(candidateState.stationName),
    actionId: context.actionId,
    actionName: safeString(candidateState.actionName),
    roundIndex: context.roundIndex,
    roundNumber: context.roundNumber,
    reviewedCandidates,
    gmReviewRequired: candidateState.gmReviewRequired === true
  });
}
