export const TRAVEL_V2_RESPONSE_ACTION_RESOLUTION_REVIEW_VERSION = 1;

const PERSISTENCE_REASON = "Response action resolution review does not mutate Foundry documents.";
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "gmReview", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);

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
function persistentMutation() { return { available: false, reason: PERSISTENCE_REASON }; }
function inertFlags() { return { reviewOnly: true, resolutionCandidate: true, executable: false, executed: false, rollRequested: false, rollResolved: false, outcomeApplied: false, stationModifierApplied: false, stationResultMutated: false, clearProgressApplied: false, hazardResolved: false, consequencesApplied: false, persistentMutation: persistentMutation() }; }
function availableActionsFrom(input = {}) {
  const direct = Array.isArray(input.availableActions) ? input.availableActions : [];
  const player = Array.isArray(input.travelV2ResponseActionPlayerState?.availableActions) ? input.travelV2ResponseActionPlayerState.availableActions : [];
  const gm = Array.isArray(input.travelV2ResponseActionWiring?.gmRows) ? input.travelV2ResponseActionWiring.gmRows : [];
  const wiring = Array.isArray(input.travelV2ResponseActionWiring?.availableActions) ? input.travelV2ResponseActionWiring.availableActions : [];
  return [...direct, ...gm, ...player, ...wiring].filter(Boolean);
}
function selectedId(input = {}) { return text(input.travelV2ResponseActionSelectedActionId ?? input.selectedActionId ?? input.actionId); }
function selectedHazardId(input = {}) { return text(input.travelV2ResponseActionSelectedHazardCardId ?? input.selectedHazardCardId ?? input.hazardCardId); }
function matchesSelection(action = {}, actionId = "", hazardId = "") {
  const id = text(action.actionId ?? action.id ?? action.key);
  const hazard = text(action.hazardCardId ?? action.selectedHazardCardId ?? action.cardId);
  return id === actionId && (!hazardId || !hazard || hazard === hazardId);
}
function stationImpactsFrom(input = {}) {
  const rows = [
    ...(Array.isArray(input.travelV2StationImpactPlayerState?.impactedStations) ? input.travelV2StationImpactPlayerState.impactedStations : []),
    ...(Array.isArray(input.travelV2StationImpactBehavior?.impactedStations) ? input.travelV2StationImpactBehavior.impactedStations : [])
  ];
  const seen = new Set();
  return rows.map(stripForbiddenFields).filter((row) => {
    const key = `${row?.hazardCardId ?? ""}:${row?.stationKey ?? ""}:${row?.impactKey ?? row?.impactId ?? row?.publicText ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function relatedImpacts(input = {}, action = {}) {
  const keys = new Set([...(Array.isArray(action.stationImpactKeys) ? action.stationImpactKeys : []), ...(Array.isArray(action.stationKeys) ? action.stationKeys : [])].filter(Boolean).map(String));
  if (keys.size === 0) return [];
  return stationImpactsFrom(input).filter((row) => row?.stationKey && keys.has(String(row.stationKey))).map(stripForbiddenFields);
}
function baseCandidate(status, input = {}, options = {}, extras = {}) {
  const user = userFrom(input, options);
  return cloneData({ responseActionResolutionReviewVersion: TRAVEL_V2_RESPONSE_ACTION_RESOLUTION_REVIEW_VERSION, status, selectedActionId: selectedId(input) || null, selectedHazardCardId: selectedHazardId(input) || null, hazardTitle: null, actionTitle: null, publicText: null, playerSafeSummary: null, relatedStationKeys: [], relatedStationImpacts: [], requestedBy: isGmLike(user) ? "gm" : (user ? "player" : "unknown"), explicitRequest: input.travelV2ResponseActionResolutionRequested === true, ...inertFlags(), ...extras });
}

export function normalizeTravelV2ResponseActionResolutionReviewRequest(input = {}, options = {}) {
  const user = userFrom(input, options);
  return cloneData({ responseActionResolutionReviewVersion: TRAVEL_V2_RESPONSE_ACTION_RESOLUTION_REVIEW_VERSION, user, includeGmReview: (input.includeGmReview === true || options.includeGmReview === true) && isGmLike(user), explicitRequest: input.travelV2ResponseActionResolutionRequested === true, selectedActionId: selectedId(input) || null, selectedHazardCardId: selectedHazardId(input) || null, resolutionNote: text(input.travelV2ResponseActionResolutionNote ?? input.resolutionNote) || null, availableActions: availableActionsFrom(input).map(cloneData) });
}

export function validateTravelV2ResponseActionResolutionReviewRequest(input = {}, options = {}) {
  const normalized = normalizeTravelV2ResponseActionResolutionReviewRequest(input, options);
  if (!normalized.explicitRequest) return baseCandidate("empty", input, options, { blockedReason: "No explicit response action resolution review was requested." });
  if (!normalized.selectedActionId) return baseCandidate("blocked", input, options, { blockedReason: "Select a response action before reviewing resolution." });
  const action = normalized.availableActions.find((row) => matchesSelection(row, normalized.selectedActionId, normalized.selectedHazardCardId));
  if (!action) return baseCandidate("invalid", input, options, { blockedReason: "Selected response action is not available for resolution review.", disabledReason: "Unknown selected response action." });
  if (!isGmLike(normalized.user) && action.gmOnly === true) return baseCandidate("blocked", input, options, { blockedReason: "Selected response action is not player-visible." });
  return cloneData({ ...baseCandidate("ready", input, options), action: cloneData(action), valid: true });
}

export function prepareTravelV2ResponseActionResolutionReviewCandidate(input = {}, options = {}) {
  const validation = validateTravelV2ResponseActionResolutionReviewRequest(input, options);
  if (validation.status !== "ready") return cloneData(validation);
  const action = validation.action;
  const relatedStationKeys = [...new Set([...(Array.isArray(action.stationKeys) ? action.stationKeys : []), ...(Array.isArray(action.stationImpactKeys) ? action.stationImpactKeys : [])].filter(Boolean).map(String))];
  const candidate = { ...baseCandidate("ready", input, options), selectedActionId: action.actionId ?? action.id ?? validation.selectedActionId, selectedHazardCardId: action.hazardCardId ?? validation.selectedHazardCardId, hazardTitle: action.hazardTitle ?? null, actionTitle: action.title ?? action.label ?? null, publicText: action.publicText ?? action.description ?? null, playerSafeSummary: action.playerSafeSummary ?? action.publicText ?? action.description ?? action.title ?? null, relatedStationKeys, relatedStationImpacts: relatedImpacts(input, action), disabledReason: null, blockedReason: null };
  const normalized = normalizeTravelV2ResponseActionResolutionReviewRequest(input, options);
  if (normalized.includeGmReview) candidate.gmReview = { gmText: text(action.gmReview?.gmText) || text(action.gmText) || null, gmNotes: cloneData(action.gmReview?.gmNotes ?? action.gmNotes ?? null), resolutionNote: normalized.resolutionNote };
  return cloneData(candidate);
}

export function prepareTravelV2ResponseActionResolutionPlayerState(input = {}, options = {}) {
  return cloneData(stripForbiddenFields(prepareTravelV2ResponseActionResolutionReviewCandidate(input, { ...options, includeGmReview: false })));
}

export function prepareTravelV2ResponseActionResolutionGmState(input = {}, options = {}) {
  const user = userFrom(input, options);
  if (!isGmLike(user)) return prepareTravelV2ResponseActionResolutionPlayerState(input, options);
  return cloneData(prepareTravelV2ResponseActionResolutionReviewCandidate(input, { ...options, user, includeGmReview: options.includeGmReview === true || input.includeGmReview === true }));
}

export function applyTravelV2ResponseActionResolutionReviewToRenderState(renderState = {}, input = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFrom(input, options);
  const reviewInput = { ...input, travelV2ResponseActionWiring: input.travelV2ResponseActionWiring ?? base.travelV2ResponseActionWiring, travelV2ResponseActionPlayerState: input.travelV2ResponseActionPlayerState ?? base.travelV2ResponseActionPlayerState, travelV2StationImpactBehavior: input.travelV2StationImpactBehavior ?? base.travelV2StationImpactBehavior, travelV2StationImpactPlayerState: input.travelV2StationImpactPlayerState ?? base.travelV2StationImpactPlayerState };
  const playerState = prepareTravelV2ResponseActionResolutionPlayerState(reviewInput, { ...options, user, includeGmReview: false });
  if (!isGmLike(user)) return cloneData(stripForbiddenFields({ ...base, travelV2ResponseActionResolutionPlayerState: playerState }));
  return cloneData({ ...base, travelV2ResponseActionResolutionReview: prepareTravelV2ResponseActionResolutionGmState(reviewInput, { ...options, user, includeGmReview: options.includeGmReview === true }), travelV2ResponseActionResolutionPlayerState: playerState });
}
