import { listTravelV2BuiltInHazardDecks, prepareTravelV2BuiltInHazardDeckGmReview, prepareTravelV2BuiltInHazardDeckPickerState, prepareTravelV2BuiltInHazardDeckPlayerSafeSummary } from "./travel-v2-hazard-deck-registry.js";

export const TRAVEL_V2_HAZARD_DECK_PICKER_UI_VERSION = 1;

const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);

function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function isGmLike(userLike) { return userLike?.isGM === true || userLike?.isGm === true || userLike === true; }
function userFromOptions(options = {}) { return options.user ?? options.userLike ?? (options.isGM === true ? { isGM: true } : null); }
function uniqueSorted(values = []) { return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].sort(); }
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
function inertCapabilities() { return { canDraw: false, canActivate: false, canPersistSelection: false, canImport: false }; }
function cardRowFromSafeCard(card = {}) {
  return stripForbiddenFields({
    id: card.id ?? "",
    title: card.title ?? "",
    category: card.category ?? "",
    severity: card.severity ?? "",
    publicText: card.publicText ?? "",
    playerSafeSummary: card.playerSafeSummary ?? null,
    stationKeys: uniqueSorted(card.stationKeys ?? []),
    consequenceRefs: uniqueSorted(card.consequenceRefs ?? []),
    tags: cloneData(card.tags ?? [])
  });
}
function cardRowFromGmCard(card = {}) { return { ...cardRowFromSafeCard(card), gmText: typeof card.gmText === "string" ? card.gmText : "" }; }

export function isTravelV2HazardDeckPickerVisibleForUser(userLike, options = {}) {
  return isGmLike(userLike ?? userFromOptions(options));
}

export function prepareTravelV2HazardDeckPickerDeckRows(options = {}) {
  const requestedDeckId = options.selectedDeckId ?? options.requestedDeckId ?? null;
  const decks = listTravelV2BuiltInHazardDecks();
  return cloneData(decks.map((deck) => {
    const disabled = deck.status !== "available";
    return stripForbiddenFields({
      id: deck.id,
      title: deck.title,
      description: deck.description,
      status: deck.status,
      cardCount: deck.cardCount,
      categories: uniqueSorted(deck.categories ?? []),
      severities: uniqueSorted(deck.severities ?? []),
      stationKeys: uniqueSorted(deck.stationKeys ?? []),
      consequenceRefs: uniqueSorted(deck.consequenceRefs ?? []),
      selected: requestedDeckId === deck.id,
      disabled,
      disabledReason: disabled ? `Built-in hazard deck ${deck.id} is ${deck.status || "unavailable"}.` : null
    });
  }));
}

export function prepareTravelV2HazardDeckPickerCardRows(deckOrId, options = {}) {
  const includeGmReview = options.includeGmReview === true && isTravelV2HazardDeckPickerVisibleForUser(userFromOptions(options));
  if (includeGmReview) {
    const gmReview = prepareTravelV2BuiltInHazardDeckGmReview(deckOrId, options.validationOptions ?? {});
    return cloneData((gmReview.review?.cards ?? []).map(cardRowFromGmCard));
  }
  const safe = prepareTravelV2BuiltInHazardDeckPlayerSafeSummary(typeof deckOrId === "string" ? deckOrId : deckOrId?.id);
  return cloneData((safe.summary?.cards ?? []).map(cardRowFromSafeCard));
}

export function prepareTravelV2HazardDeckPickerSelectedDeckPanel(selectedDeckId, options = {}) {
  const requestedDeckId = selectedDeckId ?? null;
  const base = prepareTravelV2BuiltInHazardDeckPickerState({ selectedDeckId: requestedDeckId, validationOptions: options.validationOptions ?? {} });
  const isGm = isTravelV2HazardDeckPickerVisibleForUser(userFromOptions(options));
  const includeGmReview = options.includeGmReview === true && isGm;
  const selectedDeckSummary = stripForbiddenFields(base.selectedDeckSummary);
  const selectedDeckReview = includeGmReview && base.selectedDeckId ? prepareTravelV2BuiltInHazardDeckGmReview(base.selectedDeckId, options.validationOptions ?? {}).review : null;
  const panel = {
    pickerUiVersion: TRAVEL_V2_HAZARD_DECK_PICKER_UI_VERSION,
    requestedDeckId,
    selectedDeckId: base.selectedDeckId,
    selectedDeckSummary,
    ...(includeGmReview ? { selectedDeckReview: cloneData(selectedDeckReview) } : {}),
    cardRows: prepareTravelV2HazardDeckPickerCardRows(base.selectedDeckId ?? requestedDeckId, { ...options, includeGmReview }),
    disabledReason: base.disabledReason,
    canReview: isGm && Boolean(base.selectedDeckId) && !base.disabledReason,
    isValid: base.validation?.ok === true && Boolean(base.selectedDeckId),
    ...inertCapabilities()
  };
  return cloneData(includeGmReview ? panel : stripForbiddenFields(panel));
}

export function prepareTravelV2HazardDeckPickerUiState(options = {}) {
  const user = userFromOptions(options);
  const isVisible = isTravelV2HazardDeckPickerVisibleForUser(user, options);
  const requestedDeckId = options.selectedDeckId ?? options.requestedDeckId ?? null;
  if (!isVisible) return cloneData({ pickerUiVersion: TRAVEL_V2_HAZARD_DECK_PICKER_UI_VERSION, isVisible: false, isGM: false, requestedDeckId, selectedDeckId: null, deckRows: [], selectedDeckSummary: null, disabledReason: "Hazard deck picker review is GM-only.", canReview: false, ...inertCapabilities() });
  const base = prepareTravelV2BuiltInHazardDeckPickerState({ selectedDeckId: requestedDeckId, validationOptions: options.validationOptions ?? {} });
  const includeGmReview = options.includeGmReview === true;
  const panel = prepareTravelV2HazardDeckPickerSelectedDeckPanel(requestedDeckId, { ...options, user, includeGmReview });
  const state = {
    pickerUiVersion: TRAVEL_V2_HAZARD_DECK_PICKER_UI_VERSION,
    isVisible: true,
    isGM: true,
    requestedDeckId,
    selectedDeckId: panel.selectedDeckId,
    validation: stripForbiddenFields(base.validation),
    deckRows: prepareTravelV2HazardDeckPickerDeckRows({ selectedDeckId: requestedDeckId }),
    selectedDeckSummary: panel.selectedDeckSummary,
    ...(includeGmReview ? { selectedDeckReview: panel.selectedDeckReview } : {}),
    selectedDeckPanel: panel,
    disabledReason: panel.disabledReason,
    canReview: panel.canReview,
    ...inertCapabilities()
  };
  return cloneData(includeGmReview ? state : stripForbiddenFields(state));
}
