export const TRAVEL_V2_STATION_IMPACT_BEHAVIOR_VERSION = 1;

const PERSISTENCE_REASON = "Station impact behavior does not mutate Foundry documents.";
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "gmReview", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);

function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isGmLike(userLike) { return userLike?.isGM === true || userLike?.isGm === true || userLike === true; }
function userFrom(input = {}, options = {}) { return options.user ?? input.user ?? (options.isGM === true || input.isGM === true ? { isGM: true } : null); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function persistentMutation() { return { available: false, reason: PERSISTENCE_REASON }; }
function inertFlags() { return { reviewOnly: true, applied: false, modifierApplied: false, dcApplied: false, checkResultMutated: false, rollRequested: false, responseActionExecuted: false, clearProgressApplied: false, consequencesApplied: false, persistentMutation: persistentMutation() }; }
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
    const key = `${row.cardId ?? row.hazardCardId ?? row.id ?? row.title ?? "hazard"}:${JSON.stringify(row.stationImpactsPreview ?? row.stationImpacts ?? [])}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function stationMap(stations = []) {
  const entries = Array.isArray(stations) ? stations : [];
  const map = new Map();
  for (const station of entries) {
    const key = station?.stationKey ?? station?.key ?? station?.id;
    if (key) map.set(String(key), station);
  }
  return map;
}
function stationLabelFor(stationsByKey, stationKey, impact = {}) {
  const matched = stationKey ? stationsByKey.get(String(stationKey)) : null;
  return text(impact.stationLabel) || text(impact.stationName) || text(matched?.stationName) || text(matched?.label) || text(matched?.name) || (stationKey ? String(stationKey) : "Unmatched station");
}
function previewFrom(row = {}) {
  const preview = row.stationImpactsPreview ?? row.stationImpacts ?? row.impacts ?? null;
  if (isPlainObject(preview) && (preview.stationImpacts !== undefined || preview.items !== undefined)) return preview.stationImpacts ?? preview.items;
  return preview;
}
function impactEntries(preview) {
  if (Array.isArray(preview)) return preview.map((impact, index) => ({ key: impact?.stationKey ?? impact?.station ?? impact?.key ?? impact?.id ?? `impact-${index + 1}`, impact }));
  if (isPlainObject(preview)) return Object.entries(preview).map(([key, impact]) => ({ key, impact }));
  return [];
}
function normalizeImpactValue(key, value) {
  if (typeof value === "string") return { stationKey: key, publicText: value, impactSummary: value };
  if (isPlainObject(value)) return { stationKey: value.stationKey ?? value.station ?? value.key ?? key, ...value };
  return { stationKey: key, publicText: String(value ?? ""), impactSummary: String(value ?? "") };
}
function rowFromImpact(hazard = {}, impactInput = {}, stationsByKey, options = {}) {
  const impact = normalizeImpactValue(impactInput.key, impactInput.impact);
  const stationKey = impact.stationKey ? String(impact.stationKey) : null;
  const matchedStation = stationKey ? stationsByKey.get(stationKey) : null;
  const summary = text(impact.publicText) || text(impact.playerSafeSummary) || text(impact.impactSummary) || text(impact.summary) || text(impact.description);
  const base = stripForbiddenFields({
    stationImpactBehaviorVersion: TRAVEL_V2_STATION_IMPACT_BEHAVIOR_VERSION,
    hazardCardId: hazard.cardId ?? hazard.hazardCardId ?? hazard.id ?? null,
    hazardTitle: hazard.title ?? hazard.hazardTitle ?? hazard.name ?? null,
    stationKey,
    stationLabel: stationLabelFor(stationsByKey, stationKey, impact),
    impactId: impact.impactId ?? impact.id ?? null,
    impactKey: impact.impactKey ?? impact.key ?? impactInput.key ?? null,
    severity: impact.severity ?? null,
    weight: impact.weight ?? null,
    publicText: text(impact.publicText) || summary || null,
    playerSafeSummary: text(impact.playerSafeSummary) || summary || null,
    impactSummary: summary || null,
    tags: cloneData(Array.isArray(impact.tags) ? impact.tags : []),
    playerVisible: true,
    gmOnly: false,
    ...inertFlags()
  });
  if (!(options.includeGmReview === true && isGmLike(options.user))) return cloneData(base);
  return cloneData({
    ...base,
    source: { hazardCardId: base.hazardCardId, hazardTitle: base.hazardTitle, status: hazard.status, deckId: hazard.deckId ?? null },
    matchedStation: matchedStation ? cloneData(matchedStation) : null,
    displayOnly: true,
    reviewOnly: true,
    gmReview: { gmText: text(impact.gmText) || text(hazard.gmText) || null, gmNotes: cloneData(impact.gmNotes ?? hazard.gmNotes ?? null) }
  });
}

export function normalizeTravelV2StationImpactBehaviorInput(input = {}, options = {}) {
  const user = userFrom(input, options);
  return cloneData({ stationImpactBehaviorVersion: TRAVEL_V2_STATION_IMPACT_BEHAVIOR_VERSION, user, includeGmReview: (input.includeGmReview === true || options.includeGmReview === true) && isGmLike(user), activeHazards: activeHazardRows(input), stations: Array.isArray(input.stations) ? input.stations : [] });
}

export function prepareTravelV2StationImpactRows(input = {}, options = {}) {
  const normalized = normalizeTravelV2StationImpactBehaviorInput(input, options);
  const stationsByKey = stationMap(normalized.stations);
  const rows = normalized.activeHazards.flatMap((hazard) => impactEntries(previewFrom(hazard)).map((impact) => rowFromImpact(hazard, impact, stationsByKey, { ...options, user: normalized.user, includeGmReview: normalized.includeGmReview })));
  return cloneData(rows);
}

export function prepareTravelV2StationImpactPlayerState(input = {}, options = {}) {
  const normalized = normalizeTravelV2StationImpactBehaviorInput(input, { ...options, includeGmReview: false });
  const impactedStations = prepareTravelV2StationImpactRows({ ...input, activeHazards: normalized.activeHazards, stations: normalized.stations }, { ...options, includeGmReview: false }).map(stripForbiddenFields);
  return cloneData(stripForbiddenFields({ stationImpactBehaviorVersion: TRAVEL_V2_STATION_IMPACT_BEHAVIOR_VERSION, impactedStations, activeHazardCount: normalized.activeHazards.length, stationImpactCount: impactedStations.length, ...inertFlags() }));
}

export function prepareTravelV2StationImpactGmState(input = {}, options = {}) {
  const normalized = normalizeTravelV2StationImpactBehaviorInput(input, options);
  if (!isGmLike(normalized.user)) return prepareTravelV2StationImpactPlayerState(input, options);
  const gmRows = prepareTravelV2StationImpactRows(input, options);
  const impactedStations = gmRows.map(stripForbiddenFields);
  const unmatchedImpacts = gmRows.filter((row) => !row.stationKey || row.matchedStation === null).map(stripForbiddenFields);
  return cloneData({ stationImpactBehaviorVersion: TRAVEL_V2_STATION_IMPACT_BEHAVIOR_VERSION, impactedStations, gmRows, counts: { activeHazards: normalized.activeHazards.length, stationImpacts: gmRows.length, unmatchedImpacts: unmatchedImpacts.length }, unmatchedImpacts, ...inertFlags() });
}

export function applyTravelV2StationImpactBehaviorToRenderState(renderState = {}, input = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFrom(input, options);
  const behaviorInput = { ...input, travelV2ActiveHazardLifecycleDisplay: input.travelV2ActiveHazardLifecycleDisplay ?? base.travelV2ActiveHazardLifecycleDisplay, travelV2ActiveHazardPlayerHud: input.travelV2ActiveHazardPlayerHud ?? base.travelV2ActiveHazardPlayerHud, stations: input.stations ?? base.stations ?? [] };
  const playerState = prepareTravelV2StationImpactPlayerState(behaviorInput, { ...options, user, includeGmReview: false });
  if (!isGmLike(user)) return cloneData(stripForbiddenFields({ ...base, travelV2StationImpactPlayerState: playerState }));
  return cloneData({ ...base, travelV2StationImpactBehavior: prepareTravelV2StationImpactGmState(behaviorInput, { ...options, user, includeGmReview: options.includeGmReview === true }), travelV2StationImpactPlayerState: playerState });
}
