import {
  TRAVEL_V2_BUILT_IN_HAZARD_DECK_IDS,
  TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID,
  prepareTravelV2BuiltInHazardDeckGmReview,
  prepareTravelV2BuiltInHazardDeckPlayerSafeSummary,
  validateTravelV2BuiltInHazardDeck
} from "./travel-v2-hazard-deck-registry.js";
import { prepareTravelV2HazardDeckPickerUiState } from "./travel-v2-hazard-deck-picker-ui.js";

export const TRAVEL_V2_RUNTIME_HAZARD_DECK_SELECTION_VERSION = 1;
export const DEFAULT_TRAVEL_V2_RUNTIME_HAZARD_DECK_ID = TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID;

const DRAW_UNAVAILABLE_REASON = "Explicit draw/review flow is not implemented in this PR.";
const ACTIVE_HAZARD_MUTATION_UNAVAILABLE_REASON = "Selection does not create active hazards.";
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);

function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function isGmLike(userLike) { return userLike?.isGM === true || userLike?.isGm === true || userLike === true; }
function userFromOptions(options = {}) { return options.user ?? options.userLike ?? (options.isGM === true ? { isGM: true } : null); }
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
function inertRuntimeState() {
  return {
    canDraw: false,
    canActivate: false,
    canApply: false,
    canImport: false,
    canPersistSelection: false,
    drawState: { available: false, reason: DRAW_UNAVAILABLE_REASON },
    activeHazardMutation: { available: false, reason: ACTIVE_HAZARD_MUTATION_UNAVAILABLE_REASON }
  };
}
function requestedDeckIdFromInput(input = {}, options = {}) {
  if (typeof input === "string") return text(input) || null;
  const requested = text(input?.selectedDeckId) || text(input?.requestedDeckId);
  if (requested) return requested;
  if (options.defaultToGoldStandard === true) return DEFAULT_TRAVEL_V2_RUNTIME_HAZARD_DECK_ID;
  return null;
}

export function normalizeTravelV2RuntimeHazardDeckSelection(input = {}, options = {}) {
  const requestedDeckId = requestedDeckIdFromInput(input, options);
  return cloneData({
    selectionVersion: TRAVEL_V2_RUNTIME_HAZARD_DECK_SELECTION_VERSION,
    selectedDeckId: requestedDeckId,
    requestedDeckId,
    source: "built-in",
    deckKind: "built-in"
  });
}

export function validateTravelV2RuntimeHazardDeckSelection(selectionOrDeckId, options = {}) {
  const normalized = normalizeTravelV2RuntimeHazardDeckSelection(selectionOrDeckId, options);
  const canSelect = isGmLike(userFromOptions(options));
  if (!canSelect) return cloneData({ ok: false, isValid: false, canSelect, status: "none", selectedDeckId: null, requestedDeckId: normalized.requestedDeckId, disabledReason: "Hazard deck selection is GM-only.", validation: null });
  if (!normalized.requestedDeckId) return cloneData({ ok: false, isValid: false, canSelect, status: "none", selectedDeckId: null, requestedDeckId: null, disabledReason: "No built-in hazard deck is selected.", validation: null });
  if (!TRAVEL_V2_BUILT_IN_HAZARD_DECK_IDS.includes(normalized.requestedDeckId)) return cloneData({ ok: false, isValid: false, canSelect, status: "invalid", selectedDeckId: null, requestedDeckId: normalized.requestedDeckId, disabledReason: `Unknown built-in hazard deck id: ${normalized.requestedDeckId}`, validation: null });
  const validation = validateTravelV2BuiltInHazardDeck(normalized.requestedDeckId, options.validationOptions ?? {});
  return cloneData({ ok: validation.ok, isValid: validation.ok, canSelect, status: validation.ok ? "selected" : "invalid", selectedDeckId: validation.ok ? normalized.requestedDeckId : null, requestedDeckId: normalized.requestedDeckId, disabledReason: validation.ok ? null : (validation.errors[0] ?? `Built-in hazard deck is invalid: ${normalized.requestedDeckId}`), validation: { ok: validation.ok, errors: validation.errors, warnings: validation.warnings } });
}

export function prepareTravelV2RuntimeHazardDeckSelectionState(input = {}, options = {}) {
  const normalized = normalizeTravelV2RuntimeHazardDeckSelection(input, options);
  const result = validateTravelV2RuntimeHazardDeckSelection(normalized, options);
  const deckSummary = result.selectedDeckId ? prepareTravelV2BuiltInHazardDeckPlayerSafeSummary(result.selectedDeckId, options.validationOptions ?? {}).summary : null;
  const isGm = isGmLike(userFromOptions(options));
  const includeGmReview = options.includeGmReview === true && isGm && result.selectedDeckId;
  const gmReview = includeGmReview ? prepareTravelV2BuiltInHazardDeckGmReview(result.selectedDeckId, options.validationOptions ?? {}).review : undefined;
  const state = {
    selectionVersion: TRAVEL_V2_RUNTIME_HAZARD_DECK_SELECTION_VERSION,
    selectedDeckId: result.selectedDeckId,
    requestedDeckId: normalized.requestedDeckId,
    source: "built-in",
    deckKind: "built-in",
    status: result.status,
    isValid: result.isValid,
    disabledReason: result.disabledReason,
    canSelect: result.canSelect,
    ...inertRuntimeState(),
    deckSummary: stripForbiddenFields(deckSummary),
    validation: stripForbiddenFields(result.validation),
    ...(includeGmReview ? { gmReview: cloneData(gmReview) } : {})
  };
  return cloneData(isGm ? state : stripForbiddenFields(state));
}

export function prepareTravelV2RuntimeHazardDeckSelectionPlayerSafeState(input = {}, options = {}) {
  return cloneData(stripForbiddenFields(prepareTravelV2RuntimeHazardDeckSelectionState(input, { ...options, includeGmReview: false })));
}

export function prepareTravelV2RuntimeHazardDeckSelectionGmState(input = {}, options = {}) {
  return prepareTravelV2RuntimeHazardDeckSelectionState(input, { ...options, user: userFromOptions(options) ?? { isGM: true }, includeGmReview: options.includeGmReview === true });
}

export function applyTravelV2RuntimeHazardDeckSelectionToRenderState(renderState = {}, selection = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFromOptions(options);
  const isGm = isGmLike(user);
  if (!isGm) return cloneData(stripForbiddenFields(base));
  const selected = prepareTravelV2RuntimeHazardDeckSelectionGmState(selection, { ...options, user, defaultToGoldStandard: options.defaultToGoldStandard === true, includeGmReview: options.includeGmReview === true });
  const pickerSelectedDeckId = selected.selectedDeckId ?? null;
  return cloneData({
    ...base,
    travelV2RuntimeHazardDeckSelection: selected,
    travelV2HazardDeckPicker: prepareTravelV2HazardDeckPickerUiState({ selectedDeckId: pickerSelectedDeckId, includeGmReview: options.includeGmReview === true, user, validationOptions: options.validationOptions ?? {} })
  });
}
