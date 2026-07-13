export const TRAVEL_V2_RISK_BID_RESULT_REVIEW_ADAPTER_VERSION = 1;

const REVIEW_PAYLOAD_TYPES = Object.freeze([
  "benefitReview",
  "progressReview",
  "momentumReview",
  "rewardReview",
  "consequenceReview",
  "pressureReview",
  "hazardProgressReview",
  "stationComplicationReview",
  "nextRoundDifficultyReview",
  "hazardEscalationReview",
  "shipScarReview",
  "severePressureReview",
  "additionalHazardReview"
]);

const CANDIDATE_TYPE_TO_PAYLOAD_TYPE = Object.freeze({
  benefit: "benefitReview",
  progress: "progressReview",
  momentumCandidate: "momentumReview",
  rewardImprovement: "rewardReview",
  consequenceCandidate: "consequenceReview",
  pressureCandidate: "pressureReview",
  hazardProgressCandidate: "hazardProgressReview",
  stationComplication: "stationComplicationReview",
  nextRoundDifficulty: "nextRoundDifficultyReview",
  hazardEscalation: "hazardEscalationReview",
  shipScarCandidate: "shipScarReview",
  severePressureCandidate: "severePressureReview",
  additionalHazardCandidate: "additionalHazardReview"
});

const REVIEW_PAYLOAD_KEYS = Object.freeze([
  "adapterVersion",
  "source",
  "payloadType",
  "candidateType",
  "severity",
  "tier",
  "resultBand",
  "dangerLevel",
  "stationKey",
  "stationName",
  "actionId",
  "actionName",
  "roundIndex",
  "roundNumber",
  "label",
  "text",
  "requiresReview",
  "queueReady"
]);

const FORBIDDEN_OUTPUT_TERMS = Object.freeze([
  "gmOnly",
  "secret",
  "hiddenHazards",
  "unrevealedHazard",
  "futureTriggers",
  "internalScoring",
  "debugReport",
  "auditRecord",
  "applyPayload",
  "actorUuid",
  "targetActorUuid",
  "userId",
  "userName",
  "updateData",
  "actor.update",
  "ChatMessage",
  "JournalEntry",
  "socket",
  "Compendium.",
  "Actor.",
  "Item."
]);

function unsafeOutputString(value) {
  if (typeof value !== "string") return false;
  return FORBIDDEN_OUTPUT_TERMS.some((term) => value.includes(term));
}

function safeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return unsafeOutputString(trimmed) ? fallback : trimmed;
}

function safeIntegerOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && Number.isFinite(number) ? number : null;
}

function safeRiskBidTierOrNull(value) {
  if (typeof value === "string" && unsafeOutputString(value)) return null;
  const number = safeIntegerOrNull(value);
  return [2, 5, 8].includes(number) ? number : null;
}

function freezeOutput(value) {
  if (Array.isArray(value)) {
    for (const entry of value) freezeOutput(entry);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) freezeOutput(entry);
  }
  return Object.freeze(value);
}

export function normalizeTravelV2RiskBidReviewPayloadType(value) {
  const normalized = safeString(value);
  return REVIEW_PAYLOAD_TYPES.includes(normalized) ? normalized : null;
}

export function isTravelV2RiskBidReviewPayloadType(value) {
  return normalizeTravelV2RiskBidReviewPayloadType(value) !== null;
}

function bridgeFromInput(input) {
  if (!input || typeof input !== "object") return null;
  if (input.bridge && typeof input.bridge === "object") return input.bridge;
  return input;
}

function payloadTypeForCandidateType(value) {
  const candidateType = safeString(value);
  return CANDIDATE_TYPE_TO_PAYLOAD_TYPE[candidateType] ?? null;
}

function baseBlockedOutput(bridge, blockedReasons) {
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_RESULT_REVIEW_ADAPTER_VERSION,
    ok: false,
    hasReviewPayloads: false,
    blockedReasons: Array.from(new Set(blockedReasons)),
    resultBand: safeString(bridge?.resultBand) || null,
    tier: safeRiskBidTierOrNull(bridge?.tier),
    dcModifier: safeRiskBidTierOrNull(bridge?.dcModifier),
    dangerLevel: safeString(bridge?.dangerLevel) || "none",
    stationKey: safeString(bridge?.stationKey),
    stationName: safeString(bridge?.stationName),
    actionId: safeString(bridge?.actionId),
    actionName: safeString(bridge?.actionName),
    roundIndex: safeIntegerOrNull(bridge?.roundIndex),
    roundNumber: safeIntegerOrNull(bridge?.roundNumber),
    reviewPayloads: [],
    gmReviewRequired: false
  });
}

function buildReviewPayload(candidate, context) {
  const payloadType = payloadTypeForCandidateType(candidate?.type);
  if (!payloadType || !isTravelV2RiskBidReviewPayloadType(payloadType)) return null;
  const payload = {
    adapterVersion: TRAVEL_V2_RISK_BID_RESULT_REVIEW_ADAPTER_VERSION,
    source: "riskBidResult",
    payloadType,
    candidateType: safeString(candidate?.type),
    severity: safeString(candidate?.severity, "standard") || "standard",
    tier: context.tier,
    resultBand: context.resultBand,
    dangerLevel: context.dangerLevel,
    stationKey: context.stationKey,
    stationName: context.stationName,
    actionId: context.actionId,
    actionName: context.actionName,
    roundIndex: context.roundIndex,
    roundNumber: context.roundNumber,
    label: safeString(candidate?.label, "Risk bid review payload"),
    text: safeString(candidate?.text, "Reviewed risk bid payload requires GM review."),
    requiresReview: candidate?.requiresReview === false ? false : true,
    queueReady: true
  };
  for (const key of Object.keys(payload)) {
    if (!REVIEW_PAYLOAD_KEYS.includes(key)) delete payload[key];
  }
  return payload;
}

export function prepareTravelV2RiskBidQueueReviewPayloads(input = {}, options = {}) {
  void options;
  const bridge = bridgeFromInput(input);
  if (!bridge || typeof bridge !== "object") return baseBlockedOutput(null, ["missing-risk-bid-reviewed-candidate-bridge"]);
  if (bridge.ok !== true) return baseBlockedOutput(bridge, ["risk-bid-reviewed-candidate-bridge-not-ok"]);
  if (bridge.hasReviewedCandidates !== true) return baseBlockedOutput(bridge, ["missing-reviewed-candidates"]);
  if (!Array.isArray(bridge.reviewedCandidates) || bridge.reviewedCandidates.length === 0) return baseBlockedOutput(bridge, ["missing-reviewed-candidates"]);

  const context = {
    tier: safeRiskBidTierOrNull(bridge.tier),
    resultBand: safeString(bridge.resultBand) || null,
    dangerLevel: safeString(bridge.dangerLevel) || "none",
    stationKey: safeString(bridge.stationKey),
    stationName: safeString(bridge.stationName),
    actionId: safeString(bridge.actionId),
    actionName: safeString(bridge.actionName),
    roundIndex: safeIntegerOrNull(bridge.roundIndex),
    roundNumber: safeIntegerOrNull(bridge.roundNumber)
  };
  const reviewPayloads = bridge.reviewedCandidates.map((candidate) => buildReviewPayload(candidate, context)).filter(Boolean);
  if (reviewPayloads.length === 0) return baseBlockedOutput(bridge, ["no-valid-review-payloads"]);

  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_RESULT_REVIEW_ADAPTER_VERSION,
    ok: true,
    hasReviewPayloads: true,
    blockedReasons: [],
    resultBand: context.resultBand,
    tier: context.tier,
    dcModifier: safeRiskBidTierOrNull(bridge.dcModifier),
    dangerLevel: context.dangerLevel,
    stationKey: context.stationKey,
    stationName: context.stationName,
    actionId: context.actionId,
    actionName: context.actionName,
    roundIndex: context.roundIndex,
    roundNumber: context.roundNumber,
    reviewPayloads,
    gmReviewRequired: bridge.gmReviewRequired === true
  });
}
