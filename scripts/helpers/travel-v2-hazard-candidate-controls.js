import {
  prepareTravelV2ActiveHazardHandoffReviewState,
  prepareTravelV2ActiveHazardHandoffGmReviewState,
  prepareTravelV2ActiveHazardHandoffPlayerSafeState
} from "./travel-v2-active-hazard-handoff-review.js";

export const TRAVEL_V2_HAZARD_CANDIDATE_CONTROLS_VERSION = 1;

const CONSEQUENCE_REASON = "Consequences are not applied by hazard candidate controls.";
const PERSISTENCE_REASON = "Hazard candidate controls are session-local and do not mutate Foundry documents.";
const ACTIONS = Object.freeze(["activate", "hold", "dismiss"]);
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);

function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isGmLike(userLike) { return userLike?.isGM === true || userLike?.isGm === true || userLike === true; }
function userFrom(input = {}, options = {}) { return options.user ?? input.user ?? (options.isGM === true || input.isGM === true ? { isGM: true } : null); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function stripForbiddenFields(value) {
  if (Array.isArray(value)) return value.map(stripForbiddenFields);
  if (!value || typeof value !== "object") return value;
  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_PLAYER_SAFE_FIELDS.includes(key) || key === "gmReview") continue;
    next[key] = stripForbiddenFields(entry);
  }
  return next;
}
function actionFrom(input = {}) {
  const request = isPlainObject(input.travelV2HazardCandidateControlRequest) ? input.travelV2HazardCandidateControlRequest : (isPlainObject(input.candidateControlRequest) ? input.candidateControlRequest : {});
  return text(input.travelV2HazardCandidateControlAction ?? input.requestedAction ?? input.action ?? request.action ?? request.requestedAction).toLowerCase();
}
function explicitControlRequestPresent(input = {}) {
  return input.travelV2HazardCandidateControlRequested === true || input.candidateControlRequested === true || isPlainObject(input.travelV2HazardCandidateControlRequest) || isPlainObject(input.candidateControlRequest);
}
function handoffFrom(input = {}) {
  return isPlainObject(input.handoffCandidate) ? input.handoffCandidate : (isPlainObject(input.travelV2ActiveHazardHandoffReview) ? input.travelV2ActiveHazardHandoffReview : null);
}
function baseState(overrides = {}) {
  return cloneData({
    controlsVersion: TRAVEL_V2_HAZARD_CANDIDATE_CONTROLS_VERSION,
    status: "blocked",
    requestedAction: null,
    isActive: false,
    lifecycleStatus: "blocked",
    source: "built-in",
    deckId: null,
    cardId: null,
    cardIndex: null,
    controlSummary: { status: "blocked", text: "Waiting for an explicit GM hazard candidate control action." },
    canActivate: false,
    canHold: false,
    canDismiss: false,
    canApply: false,
    canPersist: false,
    canApplyConsequences: false,
    consequenceApplication: { available: false, reason: CONSEQUENCE_REASON },
    persistentMutation: { available: false, reason: PERSISTENCE_REASON },
    ...overrides
  });
}
function validHandoff(candidate) {
  return candidate?.status === "handoff-candidate" && candidate?.isHandoffCandidate === true && isPlainObject(candidate.proposedActiveHazard) && candidate.deckId && candidate.cardId;
}
function candidateSummary(candidate, lifecycleStatus) {
  const proposed = isPlainObject(candidate.proposedActiveHazard) ? candidate.proposedActiveHazard : {};
  return stripForbiddenFields({
    persisted: false,
    active: false,
    source: "built-in",
    deckId: candidate.deckId ?? proposed.deckId ?? null,
    cardId: candidate.cardId ?? proposed.cardId ?? null,
    title: proposed.title ?? null,
    publicText: proposed.publicText ?? null,
    playerSafeSummary: proposed.playerSafeSummary ?? proposed.publicText ?? null,
    lifecycleStatus
  });
}
function activeHazardFrom(candidate) {
  const proposed = cloneData(candidate.proposedActiveHazard ?? {});
  return stripForbiddenFields({
    ...proposed,
    reviewOnly: false,
    persisted: false,
    active: true,
    source: "built-in",
    deckId: candidate.deckId ?? proposed.deckId ?? null,
    cardId: candidate.cardId ?? proposed.cardId ?? null,
    lifecycleStatus: "active",
    activationSource: "gm-explicit"
  });
}

export function normalizeTravelV2HazardCandidateControlRequest(input = {}, options = {}) {
  return cloneData({
    controlsVersion: TRAVEL_V2_HAZARD_CANDIDATE_CONTROLS_VERSION,
    explicitControlRequested: explicitControlRequestPresent(input),
    requestedAction: actionFrom(input) || null,
    note: text(input.travelV2HazardCandidateControlNote ?? input.note ?? input.reason),
    includeGmReview: options.includeGmReview === true || input.includeGmReview === true,
    handoffCandidate: handoffFrom(input)
  });
}

export function validateTravelV2HazardCandidateControlRequest(input = {}, options = {}) {
  const normalized = normalizeTravelV2HazardCandidateControlRequest(input, options);
  const user = userFrom(input, options);
  if (!isGmLike(user)) return baseState({ status: "blocked", lifecycleStatus: "blocked", blockedReason: "Hazard candidate controls are GM-only.", disabledReason: "Hazard candidate controls are GM-only." });
  let candidate = normalized.handoffCandidate;
  if (!candidate) candidate = prepareTravelV2ActiveHazardHandoffReviewState(input, { ...options, user, includeGmReview: false });
  if (!validHandoff(candidate)) return baseState({ status: candidate?.status === "invalid" ? "invalid" : "blocked", lifecycleStatus: candidate?.status === "invalid" ? "invalid" : "blocked", requestedAction: normalized.requestedAction, blockedReason: candidate?.blockedReason ?? candidate?.disabledReason ?? "A valid active hazard handoff candidate is required before controls can run.", disabledReason: candidate?.disabledReason ?? candidate?.blockedReason ?? "A valid active hazard handoff candidate is required before controls can run.", deckId: candidate?.deckId ?? null, cardId: candidate?.cardId ?? null, cardIndex: candidate?.cardIndex ?? null });
  if (!normalized.explicitControlRequested || !normalized.requestedAction) return baseState({ requestedAction: normalized.requestedAction, deckId: candidate.deckId, cardId: candidate.cardId, cardIndex: candidate.cardIndex ?? null, canActivate: true, canHold: true, canDismiss: true, blockedReason: "Waiting for an explicit GM hazard candidate control action.", disabledReason: "Waiting for an explicit GM hazard candidate control action." });
  if (!ACTIONS.includes(normalized.requestedAction)) return baseState({ status: "invalid", lifecycleStatus: "invalid", requestedAction: normalized.requestedAction, deckId: candidate.deckId, cardId: candidate.cardId, cardIndex: candidate.cardIndex ?? null, disabledReason: "Unknown hazard candidate control action.", blockedReason: "Unknown hazard candidate control action." });
  return cloneData({ ok: true, isValid: true, normalized, candidate: stripForbiddenFields(candidate) });
}

export function prepareTravelV2HazardCandidateControlResult(input = {}, options = {}) {
  const checked = validateTravelV2HazardCandidateControlRequest(input, options);
  if (checked.ok !== true) return cloneData(checked);
  const { normalized, candidate } = checked;
  const requestedAction = normalized.requestedAction;
  const status = requestedAction === "activate" ? "activated" : (requestedAction === "hold" ? "held" : "dismissed");
  const lifecycleStatus = requestedAction === "activate" ? "active" : requestedAction;
  const result = baseState({
    status,
    requestedAction,
    isActive: requestedAction === "activate",
    lifecycleStatus,
    deckId: candidate.deckId,
    cardId: candidate.cardId,
    cardIndex: candidate.cardIndex ?? null,
    controlSummary: { status, lifecycleStatus, deckId: candidate.deckId, cardId: candidate.cardId, title: candidate.proposedActiveHazard?.title ?? null, text: `Hazard candidate ${status}.`, note: normalized.note || null }
  });
  if (requestedAction === "activate") result.activeHazard = activeHazardFrom(candidate);
  if (requestedAction === "hold") result.heldHazard = candidateSummary(candidate, "held");
  if (requestedAction === "dismiss") result.dismissedHazard = candidateSummary(candidate, "dismissed");
  if (normalized.includeGmReview && isGmLike(userFrom(input, options))) {
    const gm = prepareTravelV2ActiveHazardHandoffGmReviewState({ travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardDrawReview: candidate, handoffCandidate: candidate, user: userFrom(input, options) }, { ...options, includeGmReview: true });
    result.gmReview = cloneData(gm.gmReview ?? candidate.gmReview ?? null);
  }
  return cloneData(result);
}

export function prepareTravelV2HazardCandidateControlPlayerSafeState(input = {}, options = {}) {
  return cloneData(stripForbiddenFields(prepareTravelV2HazardCandidateControlResult(input, { ...options, includeGmReview: false })));
}

export function prepareTravelV2HazardCandidateControlGmState(input = {}, options = {}) {
  const user = userFrom(input, options);
  return isGmLike(user) ? prepareTravelV2HazardCandidateControlResult(input, { ...options, user }) : prepareTravelV2HazardCandidateControlPlayerSafeState(input, { ...options, user });
}

export function applyTravelV2HazardCandidateControlToRenderState(renderState = {}, input = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFrom(input, options);
  if (!isGmLike(user)) return cloneData(stripForbiddenFields(base));
  return cloneData({ ...base, travelV2HazardCandidateControlResult: prepareTravelV2HazardCandidateControlGmState(input, { ...options, user }) });
}
