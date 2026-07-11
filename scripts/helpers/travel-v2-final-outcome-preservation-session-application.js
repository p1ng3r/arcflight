import { prepareTravelV2FinalOutcomePreservationApplyPlan } from "./travel-v2-final-outcome-preservation-apply-plan.js";

export const TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_SESSION_APPLICATION_VERSION = 1;

const UNSAFE_OUTPUT_NEEDLES = Object.freeze([
  "auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenHazards", "debugReport", "futureTriggers", "HIDDEN_BAIT_VALUE", "HIDDEN_ENTRY_BAIT", "Actor.", "User.", "Compendium."
]);

function cloneData(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function isUnsafeText(value) { return typeof value === "string" && UNSAFE_OUTPUT_NEEDLES.some((needle) => value.includes(needle)); }
function isUnsafeKey(key) { return UNSAFE_OUTPUT_NEEDLES.some((needle) => key.includes(needle)); }
function sanitizeForSessionOutput(value) {
  if (isUnsafeText(value)) return undefined;
  if (Array.isArray(value)) return value.map(sanitizeForSessionOutput).filter((entry) => entry !== undefined);
  if (value && typeof value === "object") {
    const safe = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isUnsafeKey(key)) continue;
      const sanitized = sanitizeForSessionOutput(nested);
      if (sanitized !== undefined) safe[key] = sanitized;
    }
    return safe;
  }
  return cloneData(value);
}
function timestampFromOptions(options = {}) {
  const value = options.appliedAt ?? options.now;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "function") {
    const produced = value();
    if (typeof produced === "string" && produced.trim()) return produced.trim();
    if (produced instanceof Date) return produced.toISOString();
  }
  return new Date().toISOString();
}
function alreadyApplied(session) { return session?.travelV2FinalOutcomePreservationApplication?.applied === true; }

export function applyTravelV2FinalOutcomePreservationToRunnerSession(session, options = {}) {
  const applyPlan = prepareTravelV2FinalOutcomePreservationApplyPlan(session, options);
  if (applyPlan.hasApplyPlan !== true) {
    const error = "Travel v2 final outcome preservation apply plan cannot be prepared.";
    return { ok: false, applied: false, session: sanitizeForSessionOutput(session), applyPlan, blockedReasons: [error], error };
  }
  if (alreadyApplied(session)) {
    const error = "Travel v2 final outcome preservation has already been applied to this runner session.";
    return { ok: false, applied: false, session: sanitizeForSessionOutput(session), applyPlan, blockedReasons: [error], error };
  }

  const applicationRecord = {
    version: TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_SESSION_APPLICATION_VERSION,
    applied: true,
    appliedAt: timestampFromOptions(options),
    helperVersion: TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_SESSION_APPLICATION_VERSION,
    applyPlanVersion: applyPlan.version,
    eventKey: applyPlan.eventKey,
    eventName: applyPlan.eventName,
    completedAt: applyPlan.completedAt,
    completedEventRecordAction: cloneData(applyPlan.completedEventRecordAction),
    shipAttachmentActions: cloneData(applyPlan.shipAttachmentActions),
    skippedCandidates: cloneData(applyPlan.skippedCandidates),
    actionCount: applyPlan.actionCount,
    safetyNote: applyPlan.safetyNote,
    gmReviewPrompts: cloneData(applyPlan.gmReviewPrompts)
  };
  const updatedSession = { ...sanitizeForSessionOutput(session), travelV2FinalOutcomePreservationApplication: applicationRecord };
  return { ok: true, applied: true, session: updatedSession, originalSession: sanitizeForSessionOutput(session), applyPlan, applicationRecord, blockedReasons: [] };
}

export default applyTravelV2FinalOutcomePreservationToRunnerSession;
