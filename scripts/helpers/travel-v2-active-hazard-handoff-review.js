import {
  prepareTravelV2HazardDrawReviewState,
  prepareTravelV2HazardDrawCandidateGmReviewState,
  prepareTravelV2HazardDrawCandidatePlayerSafeState
} from "./travel-v2-hazard-draw-review.js";

export const TRAVEL_V2_ACTIVE_HAZARD_HANDOFF_REVIEW_VERSION = 1;

const ACTIVE_HAZARD_MUTATION_REASON = "GM activate/hold/dismiss controls are not implemented in this PR.";
const CONSEQUENCE_APPLICATION_REASON = "Consequences are not applied by active hazard handoff review.";
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
    if (FORBIDDEN_PLAYER_SAFE_FIELDS.includes(key)) continue;
    next[key] = stripForbiddenFields(entry);
  }
  return next;
}
function explicitHandoffRequestPresent(input = {}) {
  return input.travelV2ActiveHazardHandoffReviewRequested === true || input.handoffReviewRequested === true || isPlainObject(input.travelV2ActiveHazardHandoffReviewRequest) || isPlainObject(input.handoffReviewRequest);
}
function drawCandidateFrom(input = {}) {
  return isPlainObject(input.drawCandidate) ? input.drawCandidate : (isPlainObject(input.travelV2HazardDrawReview) ? input.travelV2HazardDrawReview : null);
}
function baseState(overrides = {}) {
  return cloneData({
    handoffReviewVersion: TRAVEL_V2_ACTIVE_HAZARD_HANDOFF_REVIEW_VERSION,
    status: "blocked",
    isHandoffCandidate: false,
    isActive: false,
    activationStatus: "review-only",
    source: "built-in",
    deckId: null,
    cardId: null,
    cardIndex: null,
    drawMode: null,
    proposedActiveHazard: null,
    cardSummary: null,
    canReview: false,
    canActivate: false,
    canHold: false,
    canDismiss: false,
    canApply: false,
    canPersist: false,
    activeHazardMutation: { available: false, reason: ACTIVE_HAZARD_MUTATION_REASON },
    consequenceApplication: { available: false, reason: CONSEQUENCE_APPLICATION_REASON },
    ...overrides
  });
}
function publicOnlyClearCondition(clearCondition) {
  if (!isPlainObject(clearCondition)) return clearCondition ?? null;
  return stripForbiddenFields({ type: clearCondition.type ?? null, neededProgress: clearCondition.neededProgress ?? null, publicText: clearCondition.publicText ?? null });
}
function proposedActiveHazardFrom(candidate) {
  const card = isPlainObject(candidate.card) ? candidate.card : {};
  const summary = isPlainObject(candidate.cardSummary) ? candidate.cardSummary : {};
  return stripForbiddenFields({
    reviewOnly: true,
    persisted: false,
    active: false,
    source: "built-in",
    deckId: candidate.deckId ?? null,
    cardId: candidate.cardId ?? card.id ?? summary.id ?? null,
    title: card.title ?? summary.title ?? null,
    category: card.category ?? summary.category ?? null,
    severity: card.severity ?? summary.severity ?? null,
    publicText: card.publicText ?? summary.publicText ?? null,
    playerSafeSummary: card.playerSafeSummary ?? summary.playerSafeSummary ?? card.publicText ?? summary.publicText ?? null,
    stationImpacts: card.stationImpacts ?? summary.stationImpacts ?? {},
    responseActions: card.responseActions ?? summary.responseActions ?? [],
    clearCondition: publicOnlyClearCondition(card.clearCondition ?? summary.clearCondition),
    clearProgress: { current: 0, needed: card.clearCondition?.neededProgress ?? summary.clearCondition?.neededProgress ?? null },
    unresolvedConsequenceRefs: card.unresolvedConsequenceRefs ?? summary.unresolvedConsequenceRefs ?? [],
    escalation: card.escalation ?? card.escalationRefs ?? summary.escalation ?? summary.escalationRefs ?? [],
    tags: card.tags ?? summary.tags ?? [],
    lifecycleStatus: "candidate"
  });
}

export function normalizeTravelV2ActiveHazardHandoffReviewRequest(input = {}, options = {}) {
  const request = isPlainObject(input.travelV2ActiveHazardHandoffReviewRequest) ? input.travelV2ActiveHazardHandoffReviewRequest : (isPlainObject(input.handoffReviewRequest) ? input.handoffReviewRequest : {});
  return cloneData({
    handoffReviewVersion: TRAVEL_V2_ACTIVE_HAZARD_HANDOFF_REVIEW_VERSION,
    explicitHandoffReviewRequested: explicitHandoffRequestPresent(input) || request.explicitHandoffReviewRequested === true,
    includeGmReview: options.includeGmReview === true || input.includeGmReview === true,
    drawCandidate: drawCandidateFrom(input)
  });
}

export function validateTravelV2ActiveHazardHandoffReviewRequest(input = {}, options = {}) {
  const normalized = normalizeTravelV2ActiveHazardHandoffReviewRequest(input, options);
  const user = userFrom(input, options);
  if (!isGmLike(user)) return baseState({ status: "blocked", blockedReason: "Active hazard handoff review is GM-only.", disabledReason: "Active hazard handoff review is GM-only." });
  if (!normalized.explicitHandoffReviewRequested) return baseState({ status: "blocked", blockedReason: "Waiting for an explicit GM active hazard handoff review request.", disabledReason: "Waiting for an explicit GM active hazard handoff review request." });
  let candidate = normalized.drawCandidate;
  if (!candidate) candidate = prepareTravelV2HazardDrawReviewState(input, { ...options, user, includeGmReview: false });
  if (!candidate || candidate.status !== "candidate" || candidate.isCandidate !== true || !candidate.cardId || !candidate.deckId) {
    return baseState({ status: candidate?.status === "invalid" ? "invalid" : "blocked", blockedReason: candidate?.blockedReason ?? candidate?.disabledReason ?? "A valid drawn hazard review candidate is required before handoff review.", disabledReason: candidate?.disabledReason ?? candidate?.blockedReason ?? "A valid drawn hazard review candidate is required before handoff review.", deckId: candidate?.deckId ?? null, cardId: candidate?.cardId ?? null, cardIndex: candidate?.cardIndex ?? null, drawMode: candidate?.drawMode ?? null });
  }
  return cloneData({ ok: true, isValid: true, canReview: true, normalized, candidate: stripForbiddenFields(candidate) });
}

export function prepareTravelV2ActiveHazardHandoffCandidate(input = {}, options = {}) {
  const checked = validateTravelV2ActiveHazardHandoffReviewRequest(input, options);
  if (checked.ok !== true) return cloneData(checked);
  const { candidate } = checked;
  const proposedActiveHazard = proposedActiveHazardFrom(candidate);
  return cloneData({
    handoffReviewVersion: TRAVEL_V2_ACTIVE_HAZARD_HANDOFF_REVIEW_VERSION,
    status: "handoff-candidate",
    isHandoffCandidate: true,
    isActive: false,
    activationStatus: "review-only",
    source: "built-in",
    deckId: candidate.deckId,
    cardId: candidate.cardId,
    cardIndex: candidate.cardIndex ?? null,
    drawMode: candidate.drawMode ?? null,
    proposedActiveHazard,
    cardSummary: stripForbiddenFields(candidate.cardSummary ?? proposedActiveHazard),
    canReview: true,
    canActivate: false,
    canHold: false,
    canDismiss: false,
    canApply: false,
    canPersist: false,
    activeHazardMutation: { available: false, reason: ACTIVE_HAZARD_MUTATION_REASON },
    consequenceApplication: { available: false, reason: CONSEQUENCE_APPLICATION_REASON }
  });
}

export function prepareTravelV2ActiveHazardHandoffPlayerSafeState(input = {}, options = {}) {
  return cloneData(stripForbiddenFields(prepareTravelV2ActiveHazardHandoffCandidate(input, { ...options, includeGmReview: false })));
}

export function prepareTravelV2ActiveHazardHandoffGmReviewState(input = {}, options = {}) {
  const state = prepareTravelV2ActiveHazardHandoffCandidate(input, options);
  const user = userFrom(input, options);
  if (state.status === "handoff-candidate" && options.includeGmReview === true && isGmLike(user)) {
    const gmCandidate = prepareTravelV2HazardDrawCandidateGmReviewState({ selectedDeckId: state.deckId, travelV2HazardDrawRequested: true, drawMode: "id", requestedCardId: state.cardId, user }, { ...options, user, includeGmReview: true });
    state.gmReview = cloneData(gmCandidate.gmReview ?? null);
  }
  return cloneData(state);
}

export function prepareTravelV2ActiveHazardHandoffReviewState(input = {}, options = {}) {
  const user = userFrom(input, options);
  return isGmLike(user) ? prepareTravelV2ActiveHazardHandoffGmReviewState(input, { ...options, user }) : prepareTravelV2ActiveHazardHandoffPlayerSafeState(input, { ...options, user });
}

export function applyTravelV2ActiveHazardHandoffReviewToRenderState(renderState = {}, input = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFrom(input, options);
  if (!isGmLike(user)) return cloneData(stripForbiddenFields(base));
  return cloneData({ ...base, travelV2ActiveHazardHandoffReview: prepareTravelV2ActiveHazardHandoffReviewState(input, { ...options, user }) });
}
