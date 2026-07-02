import {
  getTravelV2BuiltInHazardDeck,
  prepareTravelV2BuiltInHazardDeckGmReview,
  prepareTravelV2BuiltInHazardDeckPlayerSafeSummary,
  validateTravelV2BuiltInHazardDeck
} from "./travel-v2-hazard-deck-registry.js";
import {
  prepareTravelV2RuntimeHazardDeckSelectionGmState,
  prepareTravelV2RuntimeHazardDeckSelectionPlayerSafeState
} from "./travel-v2-runtime-hazard-deck-selection.js";

export const TRAVEL_V2_HAZARD_DRAW_REVIEW_VERSION = 1;

const ACTIVE_HAZARD_HANDOFF_REASON = "Active hazard handoff is not implemented in this PR.";
const CONSEQUENCE_APPLICATION_REASON = "Consequences are not applied by draw review.";
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);
const DRAW_MODES = Object.freeze(["top", "index", "id"]);

function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isGmLike(userLike) { return userLike?.isGM === true || userLike?.isGm === true || userLike === true; }
function userFrom(input = {}, options = {}) { return options.user ?? input.user ?? (options.isGM === true || input.isGM === true ? { isGM: true } : null); }
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
function inertFlags() {
  return {
    isActive: false,
    activationStatus: "inactive",
    canActivate: false,
    canApply: false,
    canPersist: false,
    canSendToPlayers: false,
    activeHazardMutation: { available: false, reason: ACTIVE_HAZARD_HANDOFF_REASON },
    consequenceApplication: { available: false, reason: CONSEQUENCE_APPLICATION_REASON }
  };
}
function baseState(overrides = {}) {
  return cloneData({
    drawReviewVersion: TRAVEL_V2_HAZARD_DRAW_REVIEW_VERSION,
    status: "blocked",
    isCandidate: false,
    source: "built-in",
    deckId: null,
    requestedDeckId: null,
    selectedDeckId: null,
    cardId: null,
    cardIndex: null,
    drawMode: null,
    canDraw: false,
    canReview: false,
    ...inertFlags(),
    ...overrides
  });
}
function explicitRequestPresent(input = {}) {
  return input.travelV2HazardDrawRequested === true || input.drawRequested === true || isPlainObject(input.travelV2HazardDrawRequest) || isPlainObject(input.drawRequest);
}
function requestSource(input = {}) {
  return isPlainObject(input.travelV2HazardDrawRequest) ? input.travelV2HazardDrawRequest : (isPlainObject(input.drawRequest) ? input.drawRequest : input);
}
function selectedDeckIdFrom(input = {}, options = {}) {
  return text(input.selectedDeckId) || text(input.requestedDeckId) || text(input.deckId) || text(options.selectedDeckId) || text(options.requestedDeckId) || text(options.deckId) || null;
}
function cardSummaryFor(deckId, cardId) {
  const summary = prepareTravelV2BuiltInHazardDeckPlayerSafeSummary(deckId).summary;
  return stripForbiddenFields((summary?.cards ?? []).find((card) => card.id === cardId) ?? null);
}
function cardGmReviewFor(deckId, cardId, options = {}) {
  const review = prepareTravelV2BuiltInHazardDeckGmReview(deckId, options.validationOptions ?? {}).review;
  return cloneData((review?.cards ?? []).find((card) => card.id === cardId) ?? null);
}

export function normalizeTravelV2HazardDrawRequest(input = {}, options = {}) {
  const source = requestSource(input);
  const drawMode = text(source.drawMode ?? input.travelV2HazardDrawMode ?? options.drawMode) || "top";
  return cloneData({
    drawReviewVersion: TRAVEL_V2_HAZARD_DRAW_REVIEW_VERSION,
    explicitDrawRequested: explicitRequestPresent(input) || source.explicitDrawRequested === true,
    requestedDeckId: selectedDeckIdFrom(source, options) || selectedDeckIdFrom(input, options),
    selectedDeckId: text(source.selectedDeckId) || text(input.selectedDeckId) || text(options.selectedDeckId) || null,
    drawMode,
    requestedCardId: text(source.requestedCardId ?? source.cardId ?? input.travelV2HazardDrawCardId ?? options.requestedCardId) || null,
    requestedIndex: source.requestedIndex ?? source.cardIndex ?? input.travelV2HazardDrawIndex ?? options.requestedIndex ?? null,
    drawSeed: source.drawSeed ?? input.travelV2HazardDrawSeed ?? options.drawSeed ?? null
  });
}

export function validateTravelV2HazardDrawRequest(input = {}, options = {}) {
  const normalized = normalizeTravelV2HazardDrawRequest(input, options);
  const user = userFrom(input, options);
  const isGm = isGmLike(user);
  if (!isGm) return baseState({ status: "blocked", blockedReason: "Hazard draw review is GM-only.", disabledReason: "Hazard draw review is GM-only.", requestedDeckId: normalized.requestedDeckId, selectedDeckId: normalized.selectedDeckId, drawMode: normalized.drawMode });
  const selection = prepareTravelV2RuntimeHazardDeckSelectionGmState({ selectedDeckId: normalized.requestedDeckId ?? normalized.selectedDeckId }, { ...options, user, defaultToGoldStandard: false, includeGmReview: false });
  if (!normalized.explicitDrawRequested) return baseState({ status: "blocked", blockedReason: "Waiting for an explicit GM hazard draw request.", disabledReason: "Waiting for an explicit GM hazard draw request.", requestedDeckId: normalized.requestedDeckId, selectedDeckId: selection.selectedDeckId, deckId: selection.selectedDeckId, drawMode: normalized.drawMode, canDraw: selection.isValid === true });
  if (!selection.selectedDeckId || selection.isValid !== true) return baseState({ status: selection.status === "invalid" ? "invalid" : "blocked", blockedReason: selection.disabledReason ?? "No valid built-in hazard deck is selected.", disabledReason: selection.disabledReason ?? "No valid built-in hazard deck is selected.", requestedDeckId: normalized.requestedDeckId, selectedDeckId: selection.selectedDeckId, drawMode: normalized.drawMode });
  if (!DRAW_MODES.includes(normalized.drawMode)) return baseState({ status: "invalid", disabledReason: `Unsupported draw mode: ${normalized.drawMode}`, blockedReason: `Unsupported draw mode: ${normalized.drawMode}`, requestedDeckId: normalized.requestedDeckId, selectedDeckId: selection.selectedDeckId, deckId: selection.selectedDeckId, drawMode: normalized.drawMode });
  const validation = validateTravelV2BuiltInHazardDeck(selection.selectedDeckId, options.validationOptions ?? {});
  if (!validation.ok) return baseState({ status: "invalid", disabledReason: validation.errors[0] ?? "Selected hazard deck is invalid.", blockedReason: validation.errors[0] ?? "Selected hazard deck is invalid.", requestedDeckId: normalized.requestedDeckId, selectedDeckId: selection.selectedDeckId, deckId: selection.selectedDeckId, drawMode: normalized.drawMode });
  return cloneData({ ok: true, isValid: true, canDraw: true, normalized, selection, validation });
}

export function prepareTravelV2HazardDrawCandidate(input = {}, options = {}) {
  const checked = validateTravelV2HazardDrawRequest(input, options);
  if (checked.ok !== true) return cloneData(checked);
  const { normalized, selection } = checked;
  const deck = getTravelV2BuiltInHazardDeck(selection.selectedDeckId, { includeGmReview: true });
  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  let cardIndex = 0;
  if (normalized.drawMode === "index") {
    if (!Number.isInteger(normalized.requestedIndex)) return baseState({ status: "invalid", disabledReason: "Draw index must be an integer.", blockedReason: "Draw index must be an integer.", requestedDeckId: normalized.requestedDeckId, selectedDeckId: selection.selectedDeckId, deckId: selection.selectedDeckId, drawMode: normalized.drawMode });
    cardIndex = normalized.requestedIndex;
  } else if (normalized.drawMode === "id") {
    cardIndex = cards.findIndex((card) => card.id === normalized.requestedCardId);
  }
  if (cardIndex < 0 || cardIndex >= cards.length) return baseState({ status: "invalid", disabledReason: normalized.drawMode === "id" ? `Unknown hazard card id: ${normalized.requestedCardId}` : `Hazard draw index is out of range: ${normalized.requestedIndex}`, blockedReason: normalized.drawMode === "id" ? `Unknown hazard card id: ${normalized.requestedCardId}` : `Hazard draw index is out of range: ${normalized.requestedIndex}`, requestedDeckId: normalized.requestedDeckId, selectedDeckId: selection.selectedDeckId, deckId: selection.selectedDeckId, drawMode: normalized.drawMode });
  const card = cloneData(cards[cardIndex]);
  const candidate = {
    drawReviewVersion: TRAVEL_V2_HAZARD_DRAW_REVIEW_VERSION,
    status: "candidate",
    isCandidate: true,
    ...inertFlags(),
    source: "built-in",
    deckId: selection.selectedDeckId,
    requestedDeckId: normalized.requestedDeckId,
    selectedDeckId: selection.selectedDeckId,
    cardId: card.id,
    cardIndex,
    drawMode: normalized.drawMode,
    ...(normalized.drawSeed !== null ? { drawSeed: normalized.drawSeed } : {}),
    canDraw: true,
    canReview: true,
    cardSummary: cardSummaryFor(selection.selectedDeckId, card.id),
    card: stripForbiddenFields(card)
  };
  return cloneData(candidate);
}

export function prepareTravelV2HazardDrawCandidatePlayerSafeState(input = {}, options = {}) {
  return cloneData(stripForbiddenFields(prepareTravelV2HazardDrawCandidate(input, { ...options, includeGmReview: false })));
}

export function prepareTravelV2HazardDrawCandidateGmReviewState(input = {}, options = {}) {
  const candidate = prepareTravelV2HazardDrawCandidate(input, options);
  const user = userFrom(input, options);
  if (candidate.status === "candidate" && options.includeGmReview === true && isGmLike(user)) candidate.gmReview = cardGmReviewFor(candidate.deckId, candidate.cardId, options);
  return cloneData(candidate);
}

export function prepareTravelV2HazardDrawReviewState(input = {}, options = {}) {
  const user = userFrom(input, options);
  const isGm = isGmLike(user);
  const state = isGm ? prepareTravelV2HazardDrawCandidateGmReviewState(input, { ...options, user }) : prepareTravelV2HazardDrawCandidatePlayerSafeState(input, { ...options, user });
  const selectedDeckId = state.selectedDeckId ?? state.deckId ?? selectedDeckIdFrom(input, options);
  const deckSelection = isGm ? prepareTravelV2RuntimeHazardDeckSelectionGmState({ selectedDeckId }, { ...options, user, defaultToGoldStandard: false, includeGmReview: false }) : prepareTravelV2RuntimeHazardDeckSelectionPlayerSafeState({ selectedDeckId }, { ...options, user, defaultToGoldStandard: false });
  return cloneData(isGm ? { ...state, deckSelection } : stripForbiddenFields({ ...state, deckSelection }));
}

export function applyTravelV2HazardDrawReviewToRenderState(renderState = {}, drawInput = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFrom(drawInput, options);
  if (!isGmLike(user)) return cloneData(stripForbiddenFields(base));
  return cloneData({ ...base, travelV2HazardDrawReview: prepareTravelV2HazardDrawReviewState(drawInput, { ...options, user }) });
}
