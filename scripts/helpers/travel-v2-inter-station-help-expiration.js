export const TRAVEL_V2_INTER_STATION_HELP_EXPIRATION_VERSION = 1;

const TERMINAL_STATUSES = new Set(["expired", "dismissed", "blocked"]);
const TERMINAL_STATION_RESULTS = new Set(["criticalSuccess", "success", "failure", "criticalFailure", "skipped"]);
const TARGET_RESOLVED_MODES = new Set(["afterUse"]);
const ROUND_FINALIZED_MODES = new Set(["afterUse", "endOfRound"]);

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function strictIntegerOrNull(value) { if (typeof value === "number") return Number.isInteger(value) ? value : null; if (typeof value !== "string" || value.trim() === "") return null; if (!/^-?\d+$/.test(value.trim())) return null; const number = Number(value.trim()); return Number.isInteger(number) ? number : null; }
function nowIso(options = {}) { if (typeof options.now === "string" && options.now.trim()) return options.now.trim(); if (options.now instanceof Date) return options.now.toISOString(); if (typeof options.now === "function") { const value = options.now(); if (typeof value === "string" && value.trim()) return value.trim(); if (value instanceof Date) return value.toISOString(); } return new Date().toISOString(); }
function queueRecords(session = {}) { return Array.isArray(session?.travelV2PendingStationBenefits) ? session.travelV2PendingStationBenefits : []; }
function queueKeyFor(record = {}, index = 0) { return text(record.queueKey) || text(record.id) || text(record.benefitId) || `inter-station-help:unknown:${index}`; }
function uniqueStrings(values = []) { return Array.from(new Set(values.map(text).filter(Boolean))); }

function stationResult(session = {}, roundIndex = null, stationKey = "") { return text(session?.roundResults?.[roundIndex]?.stationResults?.[stationKey]); }

function isInterStationHelpRecord(record = {}) {
  if (!isPlainObject(record)) return false;
  const pendingHelpKey = text(record.pendingHelpKey);
  const dedupeKey = text(record.dedupeKey);
  const actionId = text(record.actionId);
  const authoredActionId = text(record.authoredActionId);
  const sourceStationKey = text(record.sourceStationKey);
  const targetStationKey = text(record.targetStationKey);
  return pendingHelpKey.startsWith("inter-station-help:")
    && dedupeKey === pendingHelpKey
    && actionId !== ""
    && authoredActionId === actionId
    && sourceStationKey !== ""
    && targetStationKey !== "";
}

function blocked(session, options, reasons) {
  return {
    version: TRAVEL_V2_INTER_STATION_HELP_EXPIRATION_VERSION,
    ok: false,
    changed: false,
    shouldAdoptSession: false,
    session: cloneData(session),
    nextSession: cloneData(session),
    trigger: text(options?.trigger) || null,
    roundIndex: strictIntegerOrNull(options?.roundIndex),
    roundNumber: strictIntegerOrNull(options?.roundNumber),
    targetStationKey: text(options?.targetStationKey) || null,
    expiredQueueKeys: [],
    expiredCount: 0,
    unchangedCount: queueRecords(session).length,
    blockedReasons: uniqueStrings(reasons)
  };
}

function validate(session = {}, options = {}) {
  const reasons = [];
  if (!isPlainObject(session)) reasons.push("travel-v2-session-required");
  const trigger = text(options.trigger);
  if (!trigger) reasons.push("missing-trigger");
  else if (!["targetResolved", "roundFinalized"].includes(trigger)) reasons.push("unsupported-trigger");
  const roundIndex = strictIntegerOrNull(options.roundIndex);
  if (roundIndex === null) reasons.push("missing-round-index");
  const targetStationKey = text(options.targetStationKey);
  if (trigger === "targetResolved" && !targetStationKey) reasons.push("missing-target-station-key");
  const targetResult = roundIndex === null || !targetStationKey ? "" : stationResult(session, roundIndex, targetStationKey);
  if (trigger === "targetResolved" && targetStationKey && roundIndex !== null && !TERMINAL_STATION_RESULTS.has(targetResult)) reasons.push("target-result-not-resolved");
  return { ok: reasons.length === 0, trigger, roundIndex, roundNumber: strictIntegerOrNull(options.roundNumber) ?? (roundIndex === null ? null : roundIndex + 1), targetStationKey, targetResult, reasons };
}

function shouldExpire(record = {}, normalized = {}) {
  if (!isInterStationHelpRecord(record)) return false;
  const status = text(record.status);
  if (TERMINAL_STATUSES.has(status) || record.expired === true || record.dismissed === true || record.blocked === true) return false;
  if (strictIntegerOrNull(record.roundIndex) !== normalized.roundIndex) return false;
  const expires = text(record.expires);
  if (normalized.trigger === "targetResolved") {
    return TARGET_RESOLVED_MODES.has(expires) && text(record.targetStationKey ?? record.targetStation) === normalized.targetStationKey;
  }
  if (normalized.trigger === "roundFinalized") return ROUND_FINALIZED_MODES.has(expires);
  return false;
}

function expireRecord(record = {}, normalized = {}, timestamp = "") {
  const reason = normalized.trigger === "targetResolved" ? "target-result-recorded" : "round-finalized";
  return {
    ...cloneData(record),
    status: "expired",
    expired: true,
    expiredAt: timestamp,
    expirationTrigger: normalized.trigger,
    expirationReason: reason,
    expiredRoundIndex: normalized.roundIndex,
    expiredRoundNumber: normalized.roundNumber,
    ...(normalized.trigger === "targetResolved" ? { expiredTargetStationKey: normalized.targetStationKey } : {})
  };
}

export function prepareTravelV2InterStationHelpExpiration(session = {}, options = {}) {
  const normalized = validate(session, options);
  if (!normalized.ok) return blocked(session, options, normalized.reasons);
  const records = queueRecords(session);
  const expiredQueueKeys = [];
  let unchangedCount = 0;
  records.forEach((record, index) => {
    if (shouldExpire(record, normalized)) expiredQueueKeys.push(queueKeyFor(record, index));
    else unchangedCount += 1;
  });
  return {
    version: TRAVEL_V2_INTER_STATION_HELP_EXPIRATION_VERSION,
    ok: true,
    changed: expiredQueueKeys.length > 0,
    shouldAdoptSession: expiredQueueKeys.length > 0,
    trigger: normalized.trigger,
    roundIndex: normalized.roundIndex,
    roundNumber: normalized.roundNumber,
    targetStationKey: normalized.trigger === "targetResolved" ? normalized.targetStationKey : null,
    expiredQueueKeys,
    expiredCount: expiredQueueKeys.length,
    unchangedCount,
    blockedReasons: []
  };
}

export function applyTravelV2InterStationHelpExpirationToSession(session = {}, options = {}) {
  const preview = prepareTravelV2InterStationHelpExpiration(session, options);
  if (preview.ok !== true || preview.changed !== true) return { ...preview, session: cloneData(session), nextSession: cloneData(session) };
  const normalized = validate(session, options);
  const timestamp = nowIso(options);
  const nextSession = cloneData(session);
  nextSession.travelV2PendingStationBenefits = queueRecords(nextSession).map((record) => shouldExpire(record, normalized) ? expireRecord(record, normalized, timestamp) : record);
  nextSession.updatedAt = timestamp;
  nextSession.summary = null;
  return { ...preview, session: nextSession, nextSession };
}
