import { applyTravelV2FinalOutcomePreservationToRunnerSession } from "./travel-v2-final-outcome-preservation-session-application.js";

export const TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_ACTOR_PREVIEW_VERSION = 1;

const MODULE_ID = "arcflight";
const UNSAFE_OUTPUT_NEEDLES = Object.freeze([
  "auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "hiddenHazards", "debugReport", "futureTriggers", "HIDDEN_BAIT_VALUE", "HIDDEN_ENTRY_BAIT", "Actor.", "User.", "Compendium.", "updateData", "actor.update"
]);
const PREVIEW_TYPES_BY_ACTION_TYPE = Object.freeze({
  attachRewardToShip: "reward",
  attachRouteAdvantageToShip: "routeAdvantage",
  attachFollowUpToShip: "followUp",
  attachScarToShip: "scar",
  recordPressureChange: "pressureChange"
});
const SAFE_ACTION_FIELDS = Object.freeze(["actionType", "label", "summary", "source", "reviewOnly", "requiresExplicitGmApply", "eligible"]);

function cloneData(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function text(value, fallback = "") { return String(value ?? fallback).trim(); }
function actorId(actor) { return actor?.id ?? actor?._id ?? ""; }
function actorName(actor) { return actor?.name ?? "Unselected ship"; }
function isUnsafeText(value) { return typeof value === "string" && UNSAFE_OUTPUT_NEEDLES.some((needle) => value.includes(needle)); }
function isUnsafeKey(key) { return UNSAFE_OUTPUT_NEEDLES.some((needle) => key.includes(needle)); }
function sanitizePreviewOutput(value) {
  if (isUnsafeText(value)) return undefined;
  if (Array.isArray(value)) return value.map(sanitizePreviewOutput).filter((entry) => entry !== undefined);
  if (isPlainObject(value)) {
    const safe = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isUnsafeKey(key)) continue;
      const sanitized = sanitizePreviewOutput(nested);
      if (sanitized !== undefined) safe[key] = sanitized;
    }
    return safe;
  }
  return cloneData(value);
}
function actorFlag(actor, key) { return actor?.getFlag?.(MODULE_ID, key) ?? actor?.flags?.[MODULE_ID]?.[key]; }
function isSupportedActor(actor) {
  if (!actor || actor.type !== "vehicle") return false;
  const enabled = actorFlag(actor, "enabled");
  const arcType = actorFlag(actor, "actorType");
  return enabled === true || arcType === "ship" || arcType === "arcflightShip";
}
function safeAction(action = {}) {
  const row = {};
  for (const key of SAFE_ACTION_FIELDS) row[key] = sanitizePreviewOutput(action[key]);
  return {
    actionType: text(row.actionType),
    label: text(row.label, "Review action"),
    summary: text(row.summary, row.label ?? "Review action"),
    source: text(row.source, "finalOutcomePreservation"),
    reviewOnly: row.reviewOnly !== false,
    requiresExplicitGmApply: row.requiresExplicitGmApply !== false,
    eligible: row.eligible !== false
  };
}
function previewRow(action = {}, previewType) { return { previewType, ...safeAction(action) }; }
function manualReviewItem(reason, value = {}) {
  const action = safeAction(value);
  return { label: action.label, reason: text(reason, "Manual GM review required."), source: action.source, reviewOnly: true };
}
function emptyPreview(blockedReasons = [], actor = null, application = null) {
  return Object.freeze(sanitizePreviewOutput({
    version: TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_ACTOR_PREVIEW_VERSION,
    canPreview: false,
    previewDisabled: true,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    targetActor: actor ? { id: actorId(actor), name: actorName(actor), type: actor.type ?? "" } : null,
    eventKey: application?.eventKey ?? "",
    eventName: application?.eventName ?? "",
    sessionKey: application?.sessionKey ?? "",
    completedAt: application?.completedAt ?? null,
    applicationVersion: application?.version ?? null,
    applyPlanVersion: application?.applyPlanVersion ?? null,
    actionCount: 0,
    completedEventRecordPreview: null,
    shipAttachmentPreviews: [],
    pressureChangePreviews: [],
    manualReviewItems: [],
    safetyNote: "Preview only. This helper does not update actors, items, scenes, tokens, journals, chat, sockets, compendia, or world data.",
    gmReviewPrompts: []
  }));
}

export function prepareTravelV2FinalOutcomePreservationActorPreview(session, actor, options = {}) {
  const sessionApplication = applyTravelV2FinalOutcomePreservationToRunnerSession(session, options);
  const application = sessionApplication.applicationRecord ?? null;
  const blockedReasons = [];
  if (sessionApplication.ok !== true || sessionApplication.applied !== true || !application) blockedReasons.push(...(sessionApplication.blockedReasons?.length ? sessionApplication.blockedReasons : ["Travel v2 final outcome preservation application cannot be prepared."]));
  if (!actor) blockedReasons.push("A PF2E vehicle / Arcflight ship actor is required.");
  else if (!isSupportedActor(actor)) blockedReasons.push("A PF2E vehicle / Arcflight ship actor is required.");
  if (blockedReasons.length) return emptyPreview(blockedReasons, actor, application);

  const shipAttachmentPreviews = [];
  const pressureChangePreviews = [];
  const manualReviewItems = [];
  const completedEventRecordPreview = application.completedEventRecordAction ? previewRow(application.completedEventRecordAction, "completedEventRecord") : null;
  if (!completedEventRecordPreview) manualReviewItems.push(manualReviewItem("Completed event record action needs manual GM review."));

  for (const action of application.shipAttachmentActions ?? []) {
    const previewType = PREVIEW_TYPES_BY_ACTION_TYPE[action?.actionType];
    if (!previewType) {
      manualReviewItems.push(manualReviewItem("Action type is not yet translated for actor preview.", action));
    } else if (previewType === "pressureChange") {
      pressureChangePreviews.push(previewRow(action, previewType));
    } else {
      shipAttachmentPreviews.push(previewRow(action, previewType));
    }
  }
  for (const candidate of application.skippedCandidates ?? []) manualReviewItems.push(manualReviewItem(text(candidate?.reason, "Candidate requires manual GM review."), candidate));

  return Object.freeze(sanitizePreviewOutput({
    version: TRAVEL_V2_FINAL_OUTCOME_PRESERVATION_ACTOR_PREVIEW_VERSION,
    canPreview: true,
    previewDisabled: false,
    blockedReasons: [],
    blockedReason: "",
    targetActor: { id: actorId(actor), name: actorName(actor), type: actor.type ?? "" },
    eventKey: application.eventKey ?? "",
    eventName: application.eventName ?? "",
    sessionKey: session?.key ?? session?.id ?? "",
    completedAt: application.completedAt ?? null,
    applicationVersion: application.version ?? null,
    applyPlanVersion: application.applyPlanVersion ?? null,
    actionCount: application.actionCount ?? (completedEventRecordPreview ? 1 : 0) + shipAttachmentPreviews.length + pressureChangePreviews.length,
    completedEventRecordPreview,
    shipAttachmentPreviews,
    pressureChangePreviews,
    manualReviewItems,
    safetyNote: application.safetyNote ?? "Preview only. This helper does not apply or persist changes.",
    gmReviewPrompts: application.gmReviewPrompts ?? []
  }));
}

export default prepareTravelV2FinalOutcomePreservationActorPreview;
