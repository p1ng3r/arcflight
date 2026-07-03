export const TRAVEL_V2_RESPONSE_ACTION_WIRING_VERSION = 1;

const PERSISTENCE_REASON = "Response action wiring does not mutate Foundry documents.";
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
function inertFlags() { return { wired: false, executed: false, outcomeApplied: false, consequencesApplied: false, persistentMutation: persistentMutation() }; }
function arraysFromState(state = {}) {
  if (Array.isArray(state)) return state;
  if (!isPlainObject(state)) return [];
  return [state.activeHazards, state.activeHazardRows, state.rows, state.allRows].filter(Array.isArray).flat();
}
function normalizeHazardRow(row = {}) {
  const status = row.status ?? row.lifecycleStatus ?? (row.isActive === true ? "active" : "empty");
  return { ...row, status, isActive: status === "active" || row.isActive === true };
}
function activeHazardRows(input = {}) {
  const rows = [
    ...arraysFromState(input.activeHazards),
    ...arraysFromState(input.travelV2ActiveHazardPlayerHud),
    ...arraysFromState(input.travelV2ActiveHazardLifecycleDisplay)
  ].map(normalizeHazardRow);
  const seen = new Set();
  return rows.filter((row) => {
    if (!(row.isActive === true && row.status === "active" && row.playerVisible !== false)) return false;
    const key = `${row.cardId ?? row.hazardCardId ?? row.id ?? row.title ?? "hazard"}:${JSON.stringify(row.responseActionsPreview?.actions ?? row.responseActions ?? [])}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function actionsFor(row = {}) {
  if (Array.isArray(row.responseActionsPreview?.actions)) return row.responseActionsPreview.actions;
  if (Array.isArray(row.responseActions)) return row.responseActions;
  return [];
}
function choiceFrom(row = {}, action = {}) {
  const stationKeys = Array.isArray(action.stationKeys) ? action.stationKeys : (Array.isArray(action.stations) ? action.stations : []);
  const stationImpactKeys = Array.isArray(action.stationImpactKeys) ? action.stationImpactKeys : (Array.isArray(action.affectedStations) ? action.affectedStations : stationKeys);
  return stripForbiddenFields({
    responseActionWiringVersion: TRAVEL_V2_RESPONSE_ACTION_WIRING_VERSION,
    hazardCardId: row.cardId ?? row.hazardCardId ?? row.id ?? null,
    hazardTitle: row.title ?? row.hazardTitle ?? null,
    actionId: action.actionId ?? action.id ?? action.key ?? null,
    title: action.title ?? action.label ?? null,
    publicText: action.publicText ?? action.description ?? action.text ?? null,
    stationKeys: cloneData(stationKeys),
    stationImpactKeys: cloneData(stationImpactKeys),
    tags: cloneData(Array.isArray(action.tags) ? action.tags : []),
    playerVisible: true,
    gmOnly: action.gmOnly === true,
    wired: true,
    executed: false,
    rollRequested: false,
    outcomeApplied: false,
    clearProgressApplied: false,
    consequencesApplied: false,
    persistentMutation: persistentMutation()
  });
}

export function normalizeTravelV2ResponseActionWiringInput(input = {}, options = {}) {
  const user = userFrom(input, options);
  const hazards = activeHazardRows(input);
  return cloneData({ responseActionWiringVersion: TRAVEL_V2_RESPONSE_ACTION_WIRING_VERSION, user, includeGmReview: (input.includeGmReview === true || options.includeGmReview === true) && isGmLike(user), activeHazards: hazards });
}

export function prepareTravelV2ResponseActionChoices(input = {}, options = {}) {
  const normalized = normalizeTravelV2ResponseActionWiringInput(input, options);
  return cloneData(normalized.activeHazards.flatMap((row) => actionsFor(row).filter((action) => action?.gmOnly !== true).map((action) => choiceFrom(row, action))));
}

export function prepareTravelV2ResponseActionPlayerState(input = {}, options = {}) {
  const normalized = normalizeTravelV2ResponseActionWiringInput(input, { ...options, includeGmReview: false });
  const availableActions = prepareTravelV2ResponseActionChoices({ ...input, activeHazards: normalized.activeHazards }, { ...options, includeGmReview: false }).map(stripForbiddenFields);
  return cloneData(stripForbiddenFields({ responseActionWiringVersion: TRAVEL_V2_RESPONSE_ACTION_WIRING_VERSION, availableActions, activeHazardCount: normalized.activeHazards.length, ...inertFlags(), wired: availableActions.length > 0, rollRequested: false, clearProgressApplied: false }));
}

export function prepareTravelV2ResponseActionGmState(input = {}, options = {}) {
  const normalized = normalizeTravelV2ResponseActionWiringInput(input, options);
  if (!isGmLike(normalized.user)) return prepareTravelV2ResponseActionPlayerState(input, options);
  const availableActions = prepareTravelV2ResponseActionChoices(input, options);
  const gmRows = normalized.activeHazards.flatMap((row) => actionsFor(row).filter((action) => action?.gmOnly !== true).map((action) => {
    const choice = choiceFrom(row, action);
    return { ...choice, source: { hazardCardId: choice.hazardCardId, hazardTitle: choice.hazardTitle, status: row.status, deckId: row.deckId ?? null }, displayOnly: true, reviewOnly: true, ...(normalized.includeGmReview ? { gmReview: { gmText: text(action.gmText) || text(row.gmText) || null, gmNotes: cloneData(action.gmNotes ?? row.gmNotes ?? null) } } : {}) };
  }));
  return cloneData({ responseActionWiringVersion: TRAVEL_V2_RESPONSE_ACTION_WIRING_VERSION, availableActions, gmRows, counts: { activeHazards: normalized.activeHazards.length, availableActions: availableActions.length, gmRows: gmRows.length }, ...inertFlags(), wired: availableActions.length > 0, rollRequested: false, clearProgressApplied: false });
}

export function applyTravelV2ResponseActionWiringToRenderState(renderState = {}, input = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFrom(input, options);
  const wiringInput = { ...input, travelV2ActiveHazardLifecycleDisplay: input.travelV2ActiveHazardLifecycleDisplay ?? base.travelV2ActiveHazardLifecycleDisplay, travelV2ActiveHazardPlayerHud: input.travelV2ActiveHazardPlayerHud ?? base.travelV2ActiveHazardPlayerHud };
  const playerState = prepareTravelV2ResponseActionPlayerState(wiringInput, { ...options, user, includeGmReview: false });
  if (!isGmLike(user)) return cloneData(stripForbiddenFields({ ...base, travelV2ResponseActionPlayerState: playerState }));
  return cloneData({ ...base, travelV2ResponseActionWiring: prepareTravelV2ResponseActionGmState(wiringInput, { ...options, user, includeGmReview: options.includeGmReview === true }), travelV2ResponseActionPlayerState: playerState });
}
