export const TRAVEL_V2_PENDING_STATION_BENEFIT_QUEUE_VERSION = 1;

const PERSISTENCE_REASON = "Pending station benefit queue foundation does not mutate Foundry documents.";
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze([
  "gm" + "Text",
  "gm" + "Summary",
  "gm" + "MechanicalNotes",
  "gm" + "Review",
  "explicit" + "GmApplyEffect",
  "session" + "LocalEffect",
  "internal" + "Mutation",
  "target" + "ActorId",
  "target" + "ActorUuid",
  "apply" + "Payload",
  "before",
  "after",
  "queue" + "Internals"
]);
const BENEFIT_KINDS = new Set(["dcReduction", "hazardIgnore", "riskBidDiscount", "backlashShield", "unlockAction", "momentumOption", "clearProgress", "supportOpening", "stationOrderOpening", "unknown"]);
const EXPIRES_VALUES = new Set(["afterUse", "endOfRound", "endOfEvent", "manual", "unknown"]);
const STATUS_VALUES = new Set(["pending", "used", "dismissed", "expired", "blocked"]);

function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isGmLike(userLike) { return userLike?.isGM === true || userLike?.isGm === true || userLike === true; }
function userFrom(input = {}, options = {}) { return options.user ?? input.user ?? (options.isGM === true || input.isGM === true ? { isGM: true } : null); }
function userSnapshot(userLike) { return { isGM: isGmLike(userLike) }; }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function nullableText(value) { const next = text(value); return next || null; }
function persistentMutation() { return { available: false, reason: PERSISTENCE_REASON }; }
function inertFlags() { return { reviewOnly: true, applyAvailable: false, useAvailable: false, applied: false, used: false, dismissed: false, stationCheckMutated: false, rollMutated: false, checkPreviewMutated: false, persistentMutation: persistentMutation() }; }
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
function stationLabelFor(stationsByKey, stationKey, row = {}, prefix = "") {
  const matched = stationKey ? stationsByKey.get(String(stationKey)) : null;
  return text(row[`${prefix}StationLabel`]) || text(row[`${prefix}StationName`]) || text(matched?.stationName) || text(matched?.label) || text(matched?.name) || (stationKey ? String(stationKey) : "Unmatched station");
}
function rowsFrom(input = {}) {
  const sources = [input.pendingStationBenefits, input.travelV2PendingStationBenefits, input.travelV2PendingStationBenefitQueue, input.session?.pendingStationBenefits, input.session?.travelV2PendingStationBenefits];
  return sources.flatMap((source) => Array.isArray(source) ? source : (Array.isArray(source?.rows) ? source.rows : (Array.isArray(source?.items) ? source.items : []))).map(cloneData);
}
function normalizeBenefitKind(value) { const next = text(value) || "unknown"; return BENEFIT_KINDS.has(next) ? next : "unknown"; }
function normalizeExpires(value) { const next = text(value) || "unknown"; return EXPIRES_VALUES.has(next) ? next : "unknown"; }
function normalizeStatus(row = {}, blocked = false) {
  if (blocked) return "blocked";
  if (row.used === true) return "used";
  if (row.dismissed === true) return "dismissed";
  const next = text(row.status) || "pending";
  return STATUS_VALUES.has(next) ? next : "pending";
}
function magnitudeFrom(row = {}) {
  const value = row.magnitude ?? row.value ?? row.amount ?? row.dcReduction ?? null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}
function queueKeyFor(row = {}, index = 0, sourceStation = null, targetStation = null, benefitKind = "unknown") {
  const supplied = text(row.queueKey) || text(row.id) || text(row.benefitId);
  if (supplied) return supplied;
  const parts = [row.sourceId, row.sourceCardId, row.benefitCardId, sourceStation, targetStation, benefitKind, index].map((part) => text(part) || "none");
  return parts.join(":").replace(/\s+/g, "-").toLowerCase();
}
function countsFor(rows = []) {
  return { pendingCount: rows.filter((row) => row.status === "pending").length, usedCount: rows.filter((row) => row.status === "used").length, dismissedCount: rows.filter((row) => row.status === "dismissed").length, expiredCount: rows.filter((row) => row.status === "expired").length, blockedCount: rows.filter((row) => row.status === "blocked").length, totalCount: rows.length };
}
function rowFromRecord(record, index, stationsByKey, options = {}) {
  const row = isPlainObject(record) ? record : {};
  const sourceStation = nullableText(row.sourceStation ?? row.sourceStationKey ?? row.stationKey);
  const targetStation = nullableText(row.targetStation ?? row.targetStationKey);
  const benefitKind = normalizeBenefitKind(row.benefitKind ?? row.kind ?? row.type);
  const title = text(row.title) || text(row.name) || "Pending station benefit";
  const publicText = nullableText(row.publicText ?? row.description);
  const playerSafeSummary = nullableText(row.playerSafeSummary ?? row.summary ?? row.publicSummary ?? publicText);
  const malformed = !isPlainObject(record) || (!publicText && !playerSafeSummary && !sourceStation && !targetStation && benefitKind === "unknown" && !text(row.title) && !text(row.id));
  const status = normalizeStatus(row, malformed);
  const base = stripForbiddenFields({
    pendingStationBenefitQueueVersion: TRAVEL_V2_PENDING_STATION_BENEFIT_QUEUE_VERSION,
    queueKey: queueKeyFor(row, index, sourceStation, targetStation, benefitKind),
    sourceId: row.sourceId ?? null,
    sourceCardId: row.sourceCardId ?? row.actionCardId ?? null,
    benefitCardId: row.benefitCardId ?? row.cardId ?? null,
    title,
    sourceStation,
    sourceStationLabel: stationLabelFor(stationsByKey, sourceStation, row, "source"),
    targetStation,
    targetStationLabel: stationLabelFor(stationsByKey, targetStation, row, "target"),
    benefitKind,
    magnitude: magnitudeFrom(row),
    expires: normalizeExpires(row.expires ?? row.expiration),
    status,
    publicText,
    playerSafeSummary,
    playerVisible: true,
    gmOnly: false,
    ...inertFlags(),
    ...(status === "blocked" ? { blockedReason: "Pending station benefit record is missing safe display data.", disabledReason: "Pending station benefit is review-only and cannot be used in this PR." } : {})
  });
  if (!(options.includeGmReview === true && isGmLike(options.user))) return cloneData(base);
  return cloneData({ ...base, gmReview: { gmText: nullableText(row.gmText), gmSummary: nullableText(row.gmSummary), gmMechanicalNotes: cloneData(row.gmMechanicalNotes ?? null), sourceRecord: cloneData(row) } });
}

export function normalizeTravelV2PendingStationBenefitQueueInput(input = {}, options = {}) {
  const user = userFrom(input, options);
  const safeUser = userSnapshot(user);
  return cloneData({
    pendingStationBenefitQueueVersion: TRAVEL_V2_PENDING_STATION_BENEFIT_QUEUE_VERSION,
    user: safeUser,
    includeGmReview: (input.includeGmReview === true || options.includeGmReview === true) && safeUser.isGM === true,
    rows: rowsFrom(input),
    stations: Array.isArray(input.stations) ? input.stations : []
  });
}

export function prepareTravelV2PendingStationBenefitQueueItems(input = {}, options = {}) {
  const normalized = normalizeTravelV2PendingStationBenefitQueueInput(input, options);
  const stationsByKey = stationMap(normalized.stations);
  const seen = new Set();
  const rows = normalized.rows.map((row, index) => rowFromRecord(row, index, stationsByKey, { ...options, user: normalized.user, includeGmReview: normalized.includeGmReview })).filter((row) => {
    if (seen.has(row.queueKey)) return false;
    seen.add(row.queueKey);
    return true;
  });
  return cloneData(rows);
}

export function prepareTravelV2PendingStationBenefitPlayerState(input = {}, options = {}) {
  const rows = prepareTravelV2PendingStationBenefitQueueItems(input, { ...options, includeGmReview: false }).map(stripForbiddenFields);
  return cloneData(stripForbiddenFields({ pendingStationBenefitQueueVersion: TRAVEL_V2_PENDING_STATION_BENEFIT_QUEUE_VERSION, status: rows.length > 0 ? "ready" : "empty", rows, items: rows, ...countsFor(rows), flags: inertFlags() }));
}

export function prepareTravelV2PendingStationBenefitGmState(input = {}, options = {}) {
  const user = userFrom(input, options);
  if (!isGmLike(user)) return prepareTravelV2PendingStationBenefitPlayerState(input, options);
  const rows = prepareTravelV2PendingStationBenefitQueueItems(input, { ...options, user, includeGmReview: options.includeGmReview === true || input.includeGmReview === true });
  return cloneData({ pendingStationBenefitQueueVersion: TRAVEL_V2_PENDING_STATION_BENEFIT_QUEUE_VERSION, status: rows.length > 0 ? "ready" : "empty", rows: rows.map(stripForbiddenFields), items: rows.map(stripForbiddenFields), gmRows: rows, counts: countsFor(rows), flags: inertFlags() });
}

export function applyTravelV2PendingStationBenefitQueueToRenderState(renderState = {}, input = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFrom(input, options);
  const queueInput = { ...input, pendingStationBenefits: input.pendingStationBenefits ?? base.pendingStationBenefits, travelV2PendingStationBenefits: input.travelV2PendingStationBenefits ?? base.travelV2PendingStationBenefits, travelV2PendingStationBenefitQueue: input.travelV2PendingStationBenefitQueue ?? base.travelV2PendingStationBenefitQueue, session: input.session ?? base.session, stations: input.stations ?? base.stations ?? [] };
  const playerState = prepareTravelV2PendingStationBenefitPlayerState(queueInput, { ...options, user, includeGmReview: false });
  if (!isGmLike(user)) {
    const { travelV2PendingStationBenefitQueue, ...safeBase } = base;
    return cloneData(stripForbiddenFields({ ...safeBase, travelV2PendingStationBenefitPlayerState: playerState }));
  }
  return cloneData({ ...base, travelV2PendingStationBenefitPlayerState: playerState, travelV2PendingStationBenefitQueue: prepareTravelV2PendingStationBenefitGmState(queueInput, { ...options, user, includeGmReview: options.includeGmReview === true }) });
}
