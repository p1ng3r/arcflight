import { normalizeTravelV2RiskBidTier } from "./travel-v2-risk-bids.js";

export const TRAVEL_V2_RISK_BID_RESULT_MODEL_VERSION = 1;

export const TRAVEL_V2_RISK_BID_RESULT_BANDS = Object.freeze([
  "criticalSuccess",
  "success",
  "failure",
  "criticalFailure"
]);

const CANDIDATE_KEYS = Object.freeze(["type", "severity", "tier", "resultBand", "label", "text", "requiresReview"]);

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeInteger(value) {
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

export function normalizeTravelV2RiskBidResultBand(value) {
  const normalized = safeString(value);
  return TRAVEL_V2_RISK_BID_RESULT_BANDS.includes(normalized) ? normalized : null;
}

export function isTravelV2RiskBidResultBand(value) {
  return normalizeTravelV2RiskBidResultBand(value) !== null;
}

function sameNullableInteger(left, right) {
  return left !== null && right !== null && left === right;
}

function buildCandidate(type, severity, tier, resultBand, label, text) {
  const candidate = { type, severity, tier, resultBand, label, text, requiresReview: true };
  for (const key of Object.keys(candidate)) {
    if (!CANDIDATE_KEYS.includes(key)) delete candidate[key];
  }
  return candidate;
}

function candidateDefinitions(resultBand, tier) {
  if (resultBand === "criticalSuccess" && tier === 2) return [
    ["benefit", "minor", "Reviewed benefit candidate", "The selected risk bid may create a modest reviewed benefit."],
    ["progress", "minor", "Reviewed progress candidate", "The selected risk bid may add a modest progress opportunity."]
  ];
  if (resultBand === "criticalSuccess" && tier === 5) return [
    ["benefit", "moderate", "Strong benefit candidate", "The selected risk bid may create a stronger reviewed benefit."],
    ["progress", "moderate", "Strong progress candidate", "The selected risk bid may add meaningful reviewed progress."],
    ["momentumCandidate", "moderate", "Momentum candidate", "The crew may earn a reviewed Momentum opportunity."]
  ];
  if (resultBand === "criticalSuccess" && tier === 8) return [
    ["benefit", "major", "Major benefit candidate", "The selected risk bid may create a major reviewed benefit."],
    ["momentumCandidate", "major", "Major Momentum candidate", "The crew may earn a major reviewed Momentum opportunity."],
    ["rewardImprovement", "major", "Reward improvement candidate", "The final reward may improve after GM review."]
  ];
  if (resultBand === "success" && tier === 2) return [
    ["progress", "minor", "Progress candidate", "The selected risk bid may add minor reviewed progress."],
    ["benefit", "minor", "Minor benefit candidate", "The selected risk bid may create a minor reviewed benefit."]
  ];
  if (resultBand === "success" && tier === 5) return [
    ["progress", "moderate", "Moderate progress candidate", "The selected risk bid may add moderate reviewed progress."],
    ["benefit", "moderate", "Moderate benefit candidate", "The selected risk bid may create a moderate reviewed benefit."]
  ];
  if (resultBand === "success" && tier === 8) return [
    ["progress", "strong", "Strong progress candidate", "The selected risk bid may add strong reviewed progress."],
    ["benefit", "strong", "Strong benefit candidate", "The selected risk bid may create a strong reviewed benefit."]
  ];
  if (resultBand === "failure" && tier === 2) return [
    ["consequenceCandidate", "mild", "Mild consequence candidate", "The selected risk bid may create a mild reviewed consequence."],
    ["pressureCandidate", "mild", "Mild pressure candidate", "The selected risk bid may create mild reviewed pressure."],
    ["stationComplication", "mild", "Mild station complication", "The acting station may face a mild reviewed complication."]
  ];
  if (resultBand === "failure" && tier === 5) return [
    ["consequenceCandidate", "moderate", "Moderate consequence candidate", "The selected risk bid may create a moderate reviewed consequence."],
    ["pressureCandidate", "moderate", "Moderate pressure candidate", "The selected risk bid may create moderate reviewed pressure."],
    ["hazardProgressCandidate", "moderate", "Hazard progress candidate", "An existing hazard may advance after GM review."],
    ["nextRoundDifficulty", "moderate", "Next-round difficulty candidate", "The next round may become harder after GM review."]
  ];
  if (resultBand === "failure" && tier === 8) return [
    ["consequenceCandidate", "strong", "Strong consequence candidate", "The selected risk bid may create a dangerous reviewed consequence."],
    ["pressureCandidate", "strong", "Strong pressure candidate", "The selected risk bid may create dangerous reviewed pressure."],
    ["hazardProgressCandidate", "strong", "Strong hazard progress candidate", "A hazard may make dangerous progress after GM review."],
    ["nextRoundDifficulty", "strong", "Strong next-round difficulty candidate", "The next round may become significantly harder after GM review."]
  ];
  if (resultBand === "criticalFailure" && tier === 2) return [
    ["consequenceCandidate", "moderate", "Moderate consequence candidate", "The selected risk bid may create a moderate reviewed consequence."],
    ["pressureCandidate", "moderate", "Moderate pressure candidate", "The selected risk bid may create moderate reviewed pressure."],
    ["hazardEscalation", "moderate", "Hazard escalation candidate", "A hazard may escalate after GM review."]
  ];
  if (resultBand === "criticalFailure" && tier === 5) return [
    ["consequenceCandidate", "strong", "Strong consequence candidate", "The selected risk bid may create a strong reviewed consequence."],
    ["hazardEscalation", "strong", "Strong hazard escalation candidate", "A hazard may strongly escalate after GM review."],
    ["shipScarCandidate", "strong", "Ship scar candidate", "The ship may receive a reviewed scar candidate."],
    ["severePressureCandidate", "strong", "Severe pressure candidate", "The event may receive a severe reviewed pressure spike."]
  ];
  return [
    ["severePressureCandidate", "severe", "Severe pressure candidate", "The event may receive a severe reviewed pressure spike."],
    ["shipScarCandidate", "severe", "Severe ship scar candidate", "The ship may receive a severe reviewed scar candidate."],
    ["additionalHazardCandidate", "serious", "Additional hazard candidate", "An additional hazard may enter review."],
    ["hazardEscalation", "serious", "Serious hazard escalation candidate", "A hazard may seriously escalate after GM review."],
    ["consequenceCandidate", "serious", "Serious consequence candidate", "The selected risk bid may create an additional serious reviewed consequence."]
  ];
}

function dangerLevel(resultBand, tier) {
  if (resultBand === "criticalSuccess" || resultBand === "success") return "none";
  if (resultBand === "failure") return tier === 2 ? "low" : tier === 5 ? "moderate" : "high";
  return tier === 2 ? "moderate" : tier === 5 ? "high" : "severe";
}

function normalizeContext(input) {
  const selectionRecord = input?.selectionRecord && typeof input.selectionRecord === "object" ? input.selectionRecord : null;
  const resultBand = normalizeTravelV2RiskBidResultBand(input?.resultBand);
  const stationKey = safeString(input?.stationKey);
  const actionId = safeString(input?.actionId);
  const roundIndex = safeInteger(input?.roundIndex);
  const roundNumber = safeInteger(input?.roundNumber);
  const recordStationKey = safeString(selectionRecord?.stationKey);
  const recordActionId = safeString(selectionRecord?.actionId);
  const recordRoundIndex = safeInteger(selectionRecord?.roundIndex);
  const recordRoundNumber = safeInteger(selectionRecord?.roundNumber);
  const tier = normalizeTravelV2RiskBidTier(selectionRecord?.tier);
  const dcModifier = normalizeTravelV2RiskBidTier(selectionRecord?.dcModifier);
  const blockedReasons = [];

  if (!selectionRecord) blockedReasons.push("missing-selected-risk-bid");
  if (selectionRecord?.selected === false) blockedReasons.push("risk-bid-not-selected");
  if (!resultBand) blockedReasons.push("invalid-result-band");
  if (!tier || !dcModifier || tier !== dcModifier) blockedReasons.push("invalid-risk-bid-tier");
  if (!stationKey || !actionId || (roundIndex === null && roundNumber === null)) blockedReasons.push("missing-station-action-round-context");
  if (selectionRecord && (recordStationKey !== stationKey || recordActionId !== actionId || (!sameNullableInteger(recordRoundIndex, roundIndex) && !sameNullableInteger(recordRoundNumber, roundNumber)))) blockedReasons.push("risk-bid-selection-context-mismatch");

  return { blockedReasons: Array.from(new Set(blockedReasons)), resultBand, tier, dcModifier, dangerLevel: resultBand && tier ? dangerLevel(resultBand, tier) : "none", stationKey, stationName: safeString(input?.stationName), actionId, actionName: safeString(input?.actionName), roundIndex, roundNumber };
}

function baseOutput(input) {
  const normalized = normalizeContext(input);
  const ok = normalized.blockedReasons.length === 0;
  return { ...normalized, ok, hasRiskBidResult: ok, tier: ok ? normalized.tier : null, dcModifier: ok ? normalized.dcModifier : null, resultBand: ok ? normalized.resultBand : null, dangerLevel: ok ? normalized.dangerLevel : "none", gmReviewRequired: ok };
}

export function prepareTravelV2RiskBidResultPreview(input = {}, options = {}) {
  const base = baseOutput(input);
  const tierLabel = base.tier ? `+${base.tier}` : "no";
  const summary = base.ok ? `${base.resultBand} ${tierLabel} risk bid result candidate.` : "Risk bid result is blocked.";
  const playerText = base.ok ? `GM review is required before any ${tierLabel} risk bid result is applied.` : "No risk bid result is available for this context.";
  void options;
  return freezeOutput({ version: TRAVEL_V2_RISK_BID_RESULT_MODEL_VERSION, ok: base.ok, hasRiskBidResult: base.hasRiskBidResult, blockedReasons: base.blockedReasons, resultBand: base.resultBand, tier: base.tier, dcModifier: base.dcModifier, dangerLevel: base.dangerLevel, stationKey: base.stationKey, stationName: base.stationName, actionId: base.actionId, actionName: base.actionName, roundIndex: base.roundIndex, roundNumber: base.roundNumber, summary, playerText, gmReviewRequired: base.gmReviewRequired });
}

export function prepareTravelV2RiskBidResultCandidates(input = {}, options = {}) {
  const base = baseOutput(input);
  const candidates = base.ok ? candidateDefinitions(base.resultBand, base.tier).map(([type, severity, label, text]) => buildCandidate(type, severity, base.tier, base.resultBand, label, text)) : [];
  void options;
  return freezeOutput({ version: TRAVEL_V2_RISK_BID_RESULT_MODEL_VERSION, ok: base.ok, hasRiskBidResult: base.hasRiskBidResult, blockedReasons: base.blockedReasons, resultBand: base.resultBand, tier: base.tier, dcModifier: base.dcModifier, dangerLevel: base.dangerLevel, stationKey: base.stationKey, stationName: base.stationName, actionId: base.actionId, actionName: base.actionName, roundIndex: base.roundIndex, roundNumber: base.roundNumber, candidates, gmReviewRequired: base.gmReviewRequired });
}
