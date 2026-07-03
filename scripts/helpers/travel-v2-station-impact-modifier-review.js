export const TRAVEL_V2_STATION_IMPACT_MODIFIER_REVIEW_VERSION = 1;

const PERSISTENCE_REASON = "Station impact modifier review does not mutate Foundry documents.";
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "gmReview", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);
const NUMERIC_MODIFIER_FIELDS = Object.freeze(["dcDelta", "modifier", "modifierDelta", "penalty", "bonus"]);

function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isGmLike(userLike) { return userLike?.isGM === true || userLike?.isGm === true || userLike === true; }
function userFrom(input = {}, options = {}) { return options.user ?? input.user ?? (options.isGM === true || input.isGM === true ? { isGM: true } : null); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function persistentMutation() { return { available: false, reason: PERSISTENCE_REASON }; }
function inertFlags() { return { reviewOnly: true, modifierReviewCandidate: true, applyAvailable: false, applied: false, modifierApplied: false, dcApplied: false, stationStateMutated: false, checkResultMutated: false, rollRequested: false, responseActionExecuted: false, clearProgressApplied: false, hazardResolved: false, consequencesApplied: false, persistentMutation: persistentMutation() }; }
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
function stationMap(stations = []) {
  const map = new Map();
  for (const station of Array.isArray(stations) ? stations : []) {
    const key = station?.stationKey ?? station?.key ?? station?.id;
    if (key) map.set(String(key), station);
  }
  return map;
}
function stationLabelFor(stationsByKey, stationKey, row = {}) {
  const matched = stationKey ? stationsByKey.get(String(stationKey)) : null;
  return text(row.stationLabel) || text(row.stationName) || text(matched?.stationName) || text(matched?.label) || text(matched?.name) || (stationKey ? String(stationKey) : "Unmatched station");
}
function rowsFrom(input = {}) {
  return [
    ...(Array.isArray(input.impactedStations) ? input.impactedStations : []),
    ...(Array.isArray(input.travelV2StationImpactBehavior?.gmRows) ? input.travelV2StationImpactBehavior.gmRows : []),
    ...(Array.isArray(input.travelV2StationImpactBehavior?.impactedStations) ? input.travelV2StationImpactBehavior.impactedStations : []),
    ...(Array.isArray(input.travelV2StationImpactPlayerState?.impactedStations) ? input.travelV2StationImpactPlayerState.impactedStations : [])
  ].filter(Boolean);
}
function numericDeltaFrom(row = {}) {
  for (const field of NUMERIC_MODIFIER_FIELDS) {
    if (!Object.hasOwn(row, field)) continue;
    const value = Number(row[field]);
    if (Number.isFinite(value)) return field === "penalty" ? -Math.abs(value) : value;
  }
  const proposed = row.proposedModifier;
  if (isPlainObject(proposed) && Object.hasOwn(proposed, "dcDelta")) {
    const value = Number(proposed.dcDelta);
    if (Number.isFinite(value)) return value;
  }
  return null;
}
function relatedResponseActionFrom(input = {}, row = {}) {
  const review = input.travelV2ResponseActionResolutionPlayerState ?? input.travelV2ResponseActionResolutionReview ?? null;
  if (!isPlainObject(review) || review.status !== "ready") return null;
  const relatedKeys = Array.isArray(review.relatedStationKeys) ? review.relatedStationKeys.map(String) : [];
  if (row.stationKey && relatedKeys.length > 0 && !relatedKeys.includes(String(row.stationKey))) return null;
  return stripForbiddenFields({ selectedActionId: review.selectedActionId ?? null, actionTitle: review.actionTitle ?? null, status: review.status ?? null });
}
function rowFromGuidance(row = {}, input = {}, stationsByKey, options = {}) {
  const user = userFrom(input, options);
  const stationKey = row.stationKey ? String(row.stationKey) : null;
  const summary = text(row.publicText) || text(row.playerSafeSummary) || text(row.impactSummary) || text(row.summary) || text(row.description);
  const base = stripForbiddenFields({
    stationImpactModifierReviewVersion: TRAVEL_V2_STATION_IMPACT_MODIFIER_REVIEW_VERSION,
    status: summary || stationKey ? "ready" : "blocked",
    hazardCardId: row.hazardCardId ?? row.cardId ?? null,
    hazardTitle: row.hazardTitle ?? row.title ?? null,
    stationKey,
    stationLabel: stationLabelFor(stationsByKey, stationKey, row),
    impactId: row.impactId ?? row.id ?? null,
    impactKey: row.impactKey ?? row.key ?? null,
    publicText: text(row.publicText) || summary || null,
    playerSafeSummary: text(row.playerSafeSummary) || summary || null,
    impactSummary: summary || null,
    proposedModifier: { dcDelta: numericDeltaFrom(row), circumstance: text(row.circumstance) || text(row.proposedModifier?.circumstance) || null, note: text(row.note) || text(row.proposedModifier?.note) || summary || null, source: "station-impact-guidance", reviewOnly: true, applied: false },
    relatedResponseAction: relatedResponseActionFrom(input, row),
    playerVisible: true,
    gmOnly: false,
    ...inertFlags(),
    ...(summary || stationKey ? {} : { blockedReason: "Station impact guidance is missing station and summary data.", disabledReason: "Station impact modifier review needs guidance before table review." })
  });
  if (!(options.includeGmReview === true && isGmLike(user))) return cloneData(base);
  return cloneData({ ...base, gmReview: { gmText: text(row.gmReview?.gmText) || text(row.gmText) || null, gmMechanicalNotes: cloneData(row.gmMechanicalNotes ?? row.gmNotes ?? null), sourceImpact: cloneData(row) } });
}

export function normalizeTravelV2StationImpactModifierReviewInput(input = {}, options = {}) {
  const user = userFrom(input, options);
  return cloneData({ stationImpactModifierReviewVersion: TRAVEL_V2_STATION_IMPACT_MODIFIER_REVIEW_VERSION, user, includeGmReview: (input.includeGmReview === true || options.includeGmReview === true) && isGmLike(user), impactedStations: rowsFrom(input).map(cloneData), stations: Array.isArray(input.stations) ? input.stations : [] });
}

export function prepareTravelV2StationImpactModifierReviewRows(input = {}, options = {}) {
  const normalized = normalizeTravelV2StationImpactModifierReviewInput(input, options);
  const stationsByKey = stationMap(normalized.stations);
  const seen = new Set();
  const rows = normalized.impactedStations.map((row) => rowFromGuidance(row, input, stationsByKey, { ...options, user: normalized.user, includeGmReview: normalized.includeGmReview })).filter((row) => {
    const key = `${row.hazardCardId ?? ""}:${row.stationKey ?? ""}:${row.impactKey ?? row.impactId ?? row.publicText ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return cloneData(rows);
}

export function prepareTravelV2StationImpactModifierPlayerState(input = {}, options = {}) {
  const rows = prepareTravelV2StationImpactModifierReviewRows(input, { ...options, includeGmReview: false }).map(stripForbiddenFields);
  return cloneData(stripForbiddenFields({ stationImpactModifierReviewVersion: TRAVEL_V2_STATION_IMPACT_MODIFIER_REVIEW_VERSION, status: rows.length > 0 ? "ready" : "empty", modifierReviewRows: rows, modifierReviewCount: rows.length, ...inertFlags() }));
}

export function prepareTravelV2StationImpactModifierGmState(input = {}, options = {}) {
  const user = userFrom(input, options);
  if (!isGmLike(user)) return prepareTravelV2StationImpactModifierPlayerState(input, options);
  const rows = prepareTravelV2StationImpactModifierReviewRows(input, { ...options, user, includeGmReview: options.includeGmReview === true || input.includeGmReview === true });
  return cloneData({ stationImpactModifierReviewVersion: TRAVEL_V2_STATION_IMPACT_MODIFIER_REVIEW_VERSION, status: rows.length > 0 ? "ready" : "empty", modifierReviewRows: rows.map(stripForbiddenFields), gmRows: rows, counts: { modifierReviewRows: rows.length, blockedRows: rows.filter((row) => row.status === "blocked").length }, ...inertFlags() });
}

export function applyTravelV2StationImpactModifierReviewToRenderState(renderState = {}, input = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFrom(input, options);
  const reviewInput = { ...input, travelV2StationImpactBehavior: input.travelV2StationImpactBehavior ?? base.travelV2StationImpactBehavior, travelV2StationImpactPlayerState: input.travelV2StationImpactPlayerState ?? base.travelV2StationImpactPlayerState, travelV2ResponseActionResolutionReview: input.travelV2ResponseActionResolutionReview ?? base.travelV2ResponseActionResolutionReview, travelV2ResponseActionResolutionPlayerState: input.travelV2ResponseActionResolutionPlayerState ?? base.travelV2ResponseActionResolutionPlayerState, stations: input.stations ?? base.stations ?? [] };
  const playerState = prepareTravelV2StationImpactModifierPlayerState(reviewInput, { ...options, user, includeGmReview: false });
  if (!isGmLike(user)) return cloneData(stripForbiddenFields({ ...base, travelV2StationImpactModifierPlayerState: playerState }));
  return cloneData({ ...base, travelV2StationImpactModifierReview: prepareTravelV2StationImpactModifierGmState(reviewInput, { ...options, user, includeGmReview: options.includeGmReview === true }), travelV2StationImpactModifierPlayerState: playerState });
}
