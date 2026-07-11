import { prepareTravelV2FinalOutcomePackage } from "./travel-v2-final-outcome.js";

export const TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_VERSION = 1;

const PUBLIC_ATTACHMENT_TYPES = Object.freeze(["reward", "routeAdvantage", "followUp", "scar", "pressureChange"]);
const PACKAGE_ARRAY_KEYS = Object.freeze(["unresolvedHazards", "resolvedHazards", "consequences", "rewards", "clues", "routeAdvantages", "followUps", "scars", "pressureChanges", "gmReviewPrompts"]);

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) { if (!isPlainObject(value) && !Array.isArray(value)) return value; for (const nested of Object.values(value)) deepFreeze(nested); return Object.freeze(value); }
function text(value, fallback = "") { return String(value ?? fallback).trim(); }
function firstText(record = {}, keys = []) { for (const key of keys) { const value = text(record?.[key]); if (value) return value; } return ""; }
function arrayFrom(value) { return Array.isArray(value) ? cloneData(value) : []; }

function emptyPlan() {
  return deepFreeze({
    hasPlan: false,
    reviewOnly: true,
    eventKey: "",
    eventName: "",
    completedAt: null,
    completionState: "",
    packageVersion: TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_VERSION,
    completedEventRecord: null,
    shipAttachmentCandidates: [],
    rewardCandidates: [],
    clueCandidates: [],
    routeAdvantageCandidates: [],
    followUpCandidates: [],
    scarCandidates: [],
    pressureChangeCandidates: [],
    safetyNote: "Review only. This plan does not apply or persist changes.",
    gmReviewPrompts: []
  });
}

function completedAtFrom(session = {}, finalOutcome = {}) {
  return text(session?.completedAt) || text(session?.travelV2EventCompletion?.completedAt) || text(finalOutcome?.completedAt) || null;
}

function completedEventRecordFrom(finalOutcome = {}, completedAt = null) {
  return {
    eventKey: text(finalOutcome.eventKey),
    eventName: text(finalOutcome.eventName),
    completedAt,
    completionState: text(finalOutcome.completionState),
    locationChange: cloneData(finalOutcome.locationChange ?? { from: "", to: "", summary: "" }),
    unresolvedHazards: arrayFrom(finalOutcome.unresolvedHazards),
    resolvedHazards: arrayFrom(finalOutcome.resolvedHazards),
    consequences: arrayFrom(finalOutcome.consequences),
    rewards: arrayFrom(finalOutcome.rewards),
    clues: arrayFrom(finalOutcome.clues),
    routeAdvantages: arrayFrom(finalOutcome.routeAdvantages),
    followUps: arrayFrom(finalOutcome.followUps),
    scars: arrayFrom(finalOutcome.scars),
    pressureChanges: arrayFrom(finalOutcome.pressureChanges),
    outcomeSummary: text(finalOutcome.outcomeSummary),
    playerSafeSummary: text(finalOutcome.playerSafeSummary)
  };
}

function candidateLabel(entry = {}, fallback = "") {
  if (typeof entry === "string") return text(entry, fallback);
  return firstText(entry, ["label", "name", "title", "summary", "text", "description", "resource"]) || fallback;
}

function candidateSummary(entry = {}, fallback = "") {
  if (typeof entry === "string") return text(entry, fallback);
  return firstText(entry, ["summary", "text", "description", "playerText", "publicText", "displayText", "status"]) || candidateLabel(entry, fallback);
}

function candidateSource(entry = {}, fallback = "finalOutcome") {
  if (typeof entry === "string") return fallback;
  return firstText(entry, ["sourceType", "category", "outcomeKey"]) || fallback;
}

function attachmentCandidates(type, entries = [], sourceFallback = "finalOutcome") {
  if (!PUBLIC_ATTACHMENT_TYPES.includes(type)) return [];
  return entries.map((entry, index) => ({
    type,
    label: candidateLabel(entry, `${type} ${index + 1}`),
    summary: candidateSummary(entry, `${type} ${index + 1}`),
    source: candidateSource(entry, sourceFallback),
    reviewOnly: true
  }));
}

export function prepareTravelV2FinalOutcomePreservationPlan(session, options = {}) {
  const source = isPlainObject(session) ? session : null;
  if (!source) return emptyPlan();
  const finalOutcome = cloneData(prepareTravelV2FinalOutcomePackage(source, options));
  for (const key of PACKAGE_ARRAY_KEYS) if (!Array.isArray(finalOutcome[key])) finalOutcome[key] = [];
  if (finalOutcome.hasFinalOutcome !== true) return emptyPlan();

  const completedAt = completedAtFrom(source, finalOutcome);
  const rewardCandidates = attachmentCandidates("reward", finalOutcome.rewards, "finalOutcome.rewards");
  const routeAdvantageCandidates = attachmentCandidates("routeAdvantage", finalOutcome.routeAdvantages, "finalOutcome.routeAdvantages");
  const followUpCandidates = attachmentCandidates("followUp", finalOutcome.followUps, "finalOutcome.followUps");
  const scarCandidates = attachmentCandidates("scar", finalOutcome.scars, "finalOutcome.scars");
  const pressureChangeCandidates = attachmentCandidates("pressureChange", finalOutcome.pressureChanges, "finalOutcome.pressureChanges");

  return deepFreeze({
    hasPlan: true,
    reviewOnly: true,
    eventKey: text(finalOutcome.eventKey),
    eventName: text(finalOutcome.eventName),
    completedAt,
    completionState: text(finalOutcome.completionState),
    packageVersion: TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_VERSION,
    completedEventRecord: completedEventRecordFrom(finalOutcome, completedAt),
    shipAttachmentCandidates: [...rewardCandidates, ...routeAdvantageCandidates, ...followUpCandidates, ...scarCandidates, ...pressureChangeCandidates],
    rewardCandidates,
    clueCandidates: arrayFrom(finalOutcome.clues),
    routeAdvantageCandidates,
    followUpCandidates,
    scarCandidates,
    pressureChangeCandidates,
    safetyNote: "Review only. This plan does not apply or persist changes.",
    gmReviewPrompts: arrayFrom(finalOutcome.gmReviewPrompts)
  });
}

export default prepareTravelV2FinalOutcomePreservationPlan;
