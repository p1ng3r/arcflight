import { prepareTravelV2FinalOutcomePreservationPlan } from "./travel-v2-final-outcome-preservation.js";

export const TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_APPLY_PLAN_VERSION = 1;

const ACTION_TYPES_BY_CANDIDATE_TYPE = Object.freeze({
  reward: "attachRewardToShip",
  routeAdvantage: "attachRouteAdvantageToShip",
  followUp: "attachFollowUpToShip",
  scar: "attachScarToShip",
  pressureChange: "recordPressureChange"
});

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) { if (!isPlainObject(value) && !Array.isArray(value)) return value; for (const nested of Object.values(value)) deepFreeze(nested); return Object.freeze(value); }
function text(value, fallback = "") { return String(value ?? fallback).trim(); }
function arrayFrom(value) { return Array.isArray(value) ? cloneData(value) : []; }

function emptyApplyPlan() {
  return deepFreeze({
    version: TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_APPLY_PLAN_VERSION,
    hasApplyPlan: false,
    reviewOnly: true,
    requiresExplicitGmApply: true,
    eventKey: "",
    eventName: "",
    completedAt: null,
    completedEventRecordAction: null,
    shipAttachmentActions: [],
    skippedCandidates: [],
    actionCount: 0,
    safetyNote: "Review only. These actions are explicit GM review prompts and do not apply or persist changes.",
    gmReviewPrompts: []
  });
}

function completedEventRecordActionFrom(plan = {}) {
  if (!isPlainObject(plan.completedEventRecord)) return null;
  const eventName = text(plan.eventName, "completed travel event");
  return {
    actionType: "preserveCompletedEventRecord",
    label: `Preserve completed event record: ${eventName}`,
    summary: text(plan.completedEventRecord.playerSafeSummary) || text(plan.completedEventRecord.outcomeSummary) || `Review preservation of the completed event record for ${eventName}.`,
    source: "finalOutcomePreservation.completedEventRecord",
    reviewOnly: true,
    requiresExplicitGmApply: true,
    eligible: true
  };
}

function actionFromCandidate(candidate = {}) {
  const actionType = ACTION_TYPES_BY_CANDIDATE_TYPE[candidate.type];
  if (!actionType) return null;
  const label = text(candidate.label, "Ship attachment candidate");
  return {
    actionType,
    label,
    summary: text(candidate.summary, label),
    source: text(candidate.source, "finalOutcomePreservation.shipAttachmentCandidates"),
    reviewOnly: true,
    requiresExplicitGmApply: true,
    eligible: true
  };
}

function skippedClueCandidates(plan = {}) {
  return arrayFrom(plan.clueCandidates).map((candidate, index) => ({
    type: "clue",
    label: text(candidate?.label ?? candidate?.name ?? candidate?.summary ?? candidate?.text, `Clue ${index + 1}`),
    reason: "Clues are preserved in the completed event record but are not ship attachment actions in this review-only apply plan.",
    reviewOnly: true
  }));
}

export function prepareTravelV2FinalOutcomePreservationApplyPlan(session, options = {}) {
  const preservationPlan = prepareTravelV2FinalOutcomePreservationPlan(session, options);
  if (preservationPlan?.hasPlan !== true) return emptyApplyPlan();

  const completedEventRecordAction = completedEventRecordActionFrom(preservationPlan);
  const shipAttachmentActions = arrayFrom(preservationPlan.shipAttachmentCandidates).map(actionFromCandidate).filter(Boolean);
  const actionCount = (completedEventRecordAction ? 1 : 0) + shipAttachmentActions.length;

  return deepFreeze({
    version: TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_APPLY_PLAN_VERSION,
    hasApplyPlan: actionCount > 0,
    reviewOnly: true,
    requiresExplicitGmApply: true,
    eventKey: text(preservationPlan.eventKey),
    eventName: text(preservationPlan.eventName),
    completedAt: preservationPlan.completedAt ?? null,
    completedEventRecordAction,
    shipAttachmentActions,
    skippedCandidates: skippedClueCandidates(preservationPlan),
    actionCount,
    safetyNote: "Review only. These actions are eligible for later explicit GM apply wiring but this helper never applies or persists changes.",
    gmReviewPrompts: arrayFrom(preservationPlan.gmReviewPrompts)
  });
}

export default prepareTravelV2FinalOutcomePreservationApplyPlan;
