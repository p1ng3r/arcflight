import { prepareTravelV2PendingStationBenefitQueueItems } from "./travel-v2-pending-station-benefit-queue.js";
import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";

export const TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION = 1;

const PERSISTENCE_REASON = "Station benefit use review is display-only and does not mutate Foundry documents.";
const SELECTED_KEYS = ["selectedPendingBenefitQueueKey", "selectedQueueKey", "travelV2SelectedPendingStationBenefitQueueKey", "travelV2StationBenefitUseReviewSelectedQueueKey"];
const REVIEW_FLAGS = ["travelV2StationBenefitUseReviewRequested", "stationBenefitUseReviewRequested", "includeStationBenefitUseReview"];
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gm" + "Text", "gm" + "Summary", "gm" + "MechanicalNotes", "gm" + "Review", "explicit" + "GmApplyEffect", "session" + "LocalEffect", "internal" + "Mutation", "target" + "ActorId", "target" + "ActorUuid", "apply" + "Payload", "before", "after", "queue" + "Internals"]);
const BLOCKED_STATUSES = new Set(["used", "consumed", "dismissed", "expired", "blocked"]);
const RESOLVED_TARGET_RESULTS = new Set(["criticalSuccess", "success", "failure", "criticalFailure", "skipped"]);
const SUCCESS_SOURCE_RESULTS = new Set(["success", "criticalSuccess"]);

function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function strictIntegerOrNull(value) {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  if (!/^-?\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isInteger(number) ? number : null;
}
function uniqueStrings(values = []) { return Array.from(new Set(values.map(text).filter(Boolean))); }
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
function inertFlags() { return { reviewOnly: true, canUse: false, useAvailable: false, applyAvailable: false, applied: false, used: false, consumed: false, dismissed: false, persistentMutation: { available: false, reason: PERSISTENCE_REASON } }; }
function rawBenefitRows(input = {}) {
  const sources = [input.pendingStationBenefits, input.travelV2PendingStationBenefits, input.travelV2PendingStationBenefitQueue, input.session?.pendingStationBenefits, input.session?.travelV2PendingStationBenefits];
  return sources.flatMap((source) => Array.isArray(source) ? source : (Array.isArray(source?.rows) ? source.rows : (Array.isArray(source?.items) ? source.items : [])));
}
function rawKey(row = {}) { return text(row.queueKey) || text(row.id) || text(row.benefitId); }
function hiddenKeysFor(input = {}) {
  return new Set(rawBenefitRows(input).filter((row) => row?.hidden === true || row?.playerVisible === false || text(row?.status) === "hidden").map(rawKey).filter(Boolean));
}
function selectedKeyFrom(input = {}, options = {}) {
  for (const source of [options, input]) for (const key of SELECTED_KEYS) { const value = text(source?.[key]); if (value) return value; }
  return null;
}
function useReviewRequested(input = {}, options = {}) { return REVIEW_FLAGS.some((key) => input?.[key] === true || options?.[key] === true); }
function canIncludeGmReview(user, input = {}, options = {}) { return isGmLike(user) && (input.includeGmReview === true || options.includeGmReview === true); }
function displayRowFrom(row = {}) {
  return stripForbiddenFields({ stationBenefitUseReviewVersion: TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, queueKey: row.queueKey ?? null, title: row.title ?? "Pending station benefit", sourceStation: row.sourceStation ?? null, sourceStationLabel: row.sourceStationLabel ?? null, targetStation: row.targetStation ?? null, targetStationLabel: row.targetStationLabel ?? null, benefitKind: row.benefitKind ?? "unknown", magnitude: row.magnitude ?? null, expires: row.expires ?? "unknown", status: row.status ?? "blocked", publicText: row.publicText ?? null, playerSafeSummary: row.playerSafeSummary ?? row.publicText ?? null, reviewOnly: true, selected: false, canReview: row.status === "pending", disabledReason: row.status === "pending" ? null : `Pending station benefit is ${row.status ?? "unavailable"}.`, ...inertFlags() });
}
function blockedCandidate(reason, selectedQueueKey = null) { return cloneData(stripForbiddenFields({ status: "blocked", ready: false, selectedQueueKey, reason, candidate: null, ...inertFlags() })); }
function readyCandidate(row, useState = null) {
  const canUse = useState?.ok === true;
  const blockedReasons = useState?.reasons ?? [];
  return cloneData(stripForbiddenFields({ status: "ready", ready: true, selectedQueueKey: row.queueKey, reason: canUse ? null : (blockedReasons[0] ?? null), blockedReasons, canUse, useAvailable: canUse, candidate: { ...displayRowFrom(row), selected: true, status: "pending", reviewOnly: true, canUse, useAvailable: canUse, useHelpCopy: "Marks this Help used in the local session. No roll or DC modifier is applied by this slice.", disabledReason: canUse ? null : (blockedReasons[0] ?? "Use Help is unavailable.") }, ...inertFlags(), canUse, useAvailable: canUse }));
}

function safeRecordProjection(record = {}) {
  return stripForbiddenFields({
    queueKey: text(record.queueKey),
    pendingHelpKey: text(record.pendingHelpKey),
    dedupeKey: text(record.dedupeKey),
    title: text(record.title) || "Inter-Station Help",
    publicText: text(record.publicText ?? record.playerSafeSummary ?? record.publicSummary),
    sourceStationKey: text(record.sourceStationKey ?? record.sourceStation),
    sourceStationName: text(record.sourceStationName ?? record.sourceStationLabel),
    targetStationKey: text(record.targetStationKey ?? record.targetStation),
    targetStationName: text(record.targetStationName ?? record.targetStationLabel),
    roundIndex: strictIntegerOrNull(record.roundIndex),
    roundNumber: strictIntegerOrNull(record.roundNumber),
    resultBand: text(record.resultBand),
    benefitKind: text(record.benefitKind ?? record.kind ?? record.type),
    status: text(record.status) || "pending",
    used: record.used === true || text(record.status) === "used",
    consumed: record.consumed === true,
    applied: record.applied === true,
    criticalSuccess: record.criticalSuccess === true,
    tags: uniqueStrings(Array.isArray(record.tags) ? record.tags : [])
  });
}
function useBlockedResult(session, queueKey, reasons, record = null) {
  const blockedReasons = uniqueStrings(reasons);
  return cloneData(stripForbiddenFields({
    ok: false, used: false, consumed: false, duplicate: blockedReasons.includes("pending-station-benefit-already-used") || blockedReasons.includes("pending-station-benefit-already-consumed"), shouldAdoptSession: false, nextSession: cloneData(session), record: record ? safeRecordProjection(record) : null,
    status: { ok: false, used: false, consumed: false, status: "blocked", queueKey: queueKey || null, message: blockedReasons[0] || "Inter-Station Help use was blocked.", blockedReasons }
  }));
}
function canonicalQueueRecords(session = {}) { return Array.isArray(session?.travelV2PendingStationBenefits) ? session.travelV2PendingStationBenefits : []; }
function isInterStationHelpRecord(record = {}) {
  return text(record.pendingHelpKey).startsWith("inter-station-help:") || text(record.dedupeKey).startsWith("inter-station-help:") || text(record.kind) === "interStationHelp" || text(record.benefitKind) === "stationOrderOpening";
}
function stationResultFor(session = {}, roundIndex, stationKey = "") { return session?.roundResults?.[roundIndex]?.stationResults?.[stationKey]; }
function validatePendingStationBenefitUse(session = {}, selection = {}, options = {}) {
  const queueKey = text(selection.queueKey ?? selection.selectedQueueKey);
  const reasons = [];
  if (!isPlainObject(session)) reasons.push("travel-v2-session-required");
  if (!queueKey) reasons.push("missing-queue-key");
  const records = canonicalQueueRecords(session);
  const matches = queueKey ? records.map((record, index) => ({ record, index })).filter(({ record }) => text(record?.queueKey) === queueKey) : [];
  if (queueKey && matches.length === 0) reasons.push("unknown-queue-key");
  if (matches.length > 1) reasons.push("duplicate-queue-key");
  const match = matches[0] ?? null;
  const record = match?.record ?? null;
  if (record) {
    if (!isInterStationHelpRecord(record)) reasons.push("not-inter-station-help-record");
    const status = text(record.status) || "pending";
    if (status === "used") reasons.push("pending-station-benefit-already-used");
    else if (status === "consumed" || record.consumed === true) reasons.push("pending-station-benefit-already-consumed");
    else if (["dismissed", "expired", "blocked"].includes(status)) reasons.push(`pending-station-benefit-${status}`);
    else if (status !== "pending") reasons.push("pending-station-benefit-not-pending");
    const roundIndex = strictIntegerOrNull(record.roundIndex);
    const currentRoundIndex = strictIntegerOrNull(session.currentRoundIndex);
    if (roundIndex === null) reasons.push("missing-or-malformed-round");
    if (currentRoundIndex === null) reasons.push("missing-current-round");
    if (roundIndex !== null && currentRoundIndex !== null && roundIndex !== currentRoundIndex) reasons.push("stale-round");
    const prepared = prepareTravelV2InterStationHelpActions(session, { ...options, roundIndex: roundIndex ?? currentRoundIndex });
    const order = Array.isArray(prepared.stationOrder) ? prepared.stationOrder : [];
    const active = new Set(order);
    if (prepared.stationOrderLocked !== true) reasons.push("station-order-not-locked");
    const sourceStationKey = text(record.sourceStationKey ?? record.sourceStation);
    const targetStationKey = text(record.targetStationKey ?? record.targetStation);
    if (!sourceStationKey) reasons.push("missing-source-station");
    if (!targetStationKey) reasons.push("missing-target-station");
    if (sourceStationKey && targetStationKey && sourceStationKey === targetStationKey) reasons.push("target-station-self");
    if (sourceStationKey && !active.has(sourceStationKey)) reasons.push("source-station-inactive");
    if (targetStationKey && !active.has(targetStationKey)) reasons.push("target-station-inactive");
    const sourceIndex = order.indexOf(sourceStationKey);
    const targetIndex = order.indexOf(targetStationKey);
    if (sourceIndex >= 0 && targetIndex >= 0 && sourceIndex >= targetIndex) reasons.push("source-not-before-target");
    const targetResult = stationResultFor(session, roundIndex, targetStationKey);
    if (RESOLVED_TARGET_RESULTS.has(text(targetResult))) reasons.push("target-station-already-resolved");
    const sourceResult = stationResultFor(session, roundIndex, sourceStationKey);
    if (!SUCCESS_SOURCE_RESULTS.has(text(sourceResult))) reasons.push("source-result-not-successful");
  }
  return { ok: reasons.length === 0, queueKey, reasons: uniqueStrings(reasons), record, index: match?.index ?? -1 };
}

export function prepareTravelV2StationBenefitUseRunnerUpdate(session = {}, selection = {}, options = {}) {
  const permissionReasons = [];
  if (options.canUse !== true) permissionReasons.push("gm-use-permission-required");
  if (options.useRequested !== true) permissionReasons.push("explicit-use-request-required");
  const validation = validatePendingStationBenefitUse(session, selection, options);
  if (permissionReasons.length > 0 || validation.ok !== true) return useBlockedResult(session, validation.queueKey, [...permissionReasons, ...validation.reasons], validation.record);
  const nextSession = cloneData(session);
  const record = nextSession.travelV2PendingStationBenefits[validation.index];
  const timestamp = new Date().toISOString();
  Object.assign(record, { status: "used", used: true, consumed: true, applied: false, reviewOnly: false, usedAt: timestamp, consumedAt: timestamp, resolutionNote: "Inter-Station Help was explicitly used for its target station." });
  nextSession.updatedAt = timestamp;
  nextSession.summary = null;
  return cloneData(stripForbiddenFields({ ok: true, used: true, consumed: true, duplicate: false, shouldAdoptSession: true, nextSession, record: safeRecordProjection(record), status: { ok: true, used: true, consumed: true, status: "used", queueKey: validation.queueKey, message: "Inter-Station Help marked used in the local runner session.", blockedReasons: [] } }));
}


export function normalizeTravelV2StationBenefitUseReviewInput(input = {}, options = {}) {
  const user = userFrom(input, options);
  const hiddenKeys = hiddenKeysFor(input);
  const rows = prepareTravelV2PendingStationBenefitQueueItems(input, { ...options, user, includeGmReview: false }).map((row) => hiddenKeys.has(row.queueKey) ? { ...row, hidden: true, playerVisible: false, status: "blocked", disabledReason: "Pending station benefit is hidden." } : row);
  return cloneData({ stationBenefitUseReviewVersion: TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, user: { isGM: isGmLike(user) }, includeGmReview: canIncludeGmReview(user, input, options) && useReviewRequested(input, options), selectedQueueKey: selectedKeyFrom(input, options), rows });
}

export function prepareTravelV2StationBenefitDisplayRows(input = {}, options = {}) {
  return cloneData(normalizeTravelV2StationBenefitUseReviewInput(input, options).rows.map(displayRowFrom));
}

export function prepareTravelV2StationBenefitUseReviewPlayerState(input = {}, options = {}) {
  const requested = useReviewRequested(input, options);
  const normalized = normalizeTravelV2StationBenefitUseReviewInput(input, { ...options, includeGmReview: false });
  const rows = normalized.rows.map(displayRowFrom);
  let selectedCandidate = blockedCandidate("No pending station benefit is selected.", null);
  if (normalized.selectedQueueKey && !requested) selectedCandidate = blockedCandidate("No station benefit use review was requested.", normalized.selectedQueueKey);
  else if (requested && normalized.selectedQueueKey) {
    const row = normalized.rows.find((entry) => entry.queueKey === normalized.selectedQueueKey);
    if (!row) selectedCandidate = blockedCandidate("Selected pending station benefit was not found.", normalized.selectedQueueKey);
    else if (row.playerVisible === false || row.hidden === true) selectedCandidate = blockedCandidate("Selected pending station benefit is hidden.", normalized.selectedQueueKey);
    else if (BLOCKED_STATUSES.has(row.status)) selectedCandidate = blockedCandidate(`Selected pending station benefit is ${row.status}.`, normalized.selectedQueueKey);
    else if (row.status !== "pending") selectedCandidate = blockedCandidate("Selected station benefit is not pending.", normalized.selectedQueueKey);
    else selectedCandidate = readyCandidate(row, validatePendingStationBenefitUse(input.session ?? input, { queueKey: row.queueKey }, options));
  }
  return cloneData(stripForbiddenFields({ stationBenefitUseReviewVersion: TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, status: rows.length > 0 ? "ready" : "empty", rows, items: rows, selectedQueueKey: normalized.selectedQueueKey, selectedCandidate, ...inertFlags() }));
}

export function prepareTravelV2StationBenefitUseReviewGmState(input = {}, options = {}) {
  const user = userFrom(input, options);
  const playerState = prepareTravelV2StationBenefitUseReviewPlayerState(input, options);
  if (!canIncludeGmReview(user, input, options) || !useReviewRequested(input, options)) return playerState;
  const normalized = normalizeTravelV2StationBenefitUseReviewInput(input, { ...options, user, includeGmReview: true });
  const selectedGmRow = normalized.selectedQueueKey ? normalized.rows.find((row) => row.queueKey === normalized.selectedQueueKey) ?? null : null;
  return cloneData({ ...playerState, gmReview: { reviewRequested: true, selectedQueueKey: normalized.selectedQueueKey, selectedRow: cloneData(selectedGmRow), note: "GM review-only selection. Use Help requires a separate explicit GM action and applies no numerical modifier." } });
}

export function applyTravelV2StationBenefitUseReviewToRenderState(renderState = {}, input = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFrom(input, options);
  const reviewInput = { ...base, ...input, pendingStationBenefits: input.pendingStationBenefits ?? base.pendingStationBenefits, travelV2PendingStationBenefits: input.travelV2PendingStationBenefits ?? base.travelV2PendingStationBenefits, travelV2PendingStationBenefitQueue: input.travelV2PendingStationBenefitQueue ?? base.travelV2PendingStationBenefitQueue, session: input.session ?? base.session, stations: input.stations ?? base.stations ?? [] };
  const playerState = prepareTravelV2StationBenefitUseReviewPlayerState(reviewInput, { ...options, user, includeGmReview: false });
  if (!isGmLike(user)) {
    const { travelV2StationBenefitUseReview, ...safeBase } = base;
    return cloneData(stripForbiddenFields({ ...safeBase, travelV2StationBenefitUseReviewPlayerState: playerState }));
  }
  const next = { ...base, travelV2StationBenefitUseReviewPlayerState: playerState };
  if (canIncludeGmReview(user, reviewInput, options) && useReviewRequested(reviewInput, options)) next.travelV2StationBenefitUseReview = prepareTravelV2StationBenefitUseReviewGmState(reviewInput, { ...options, user, includeGmReview: true });
  return cloneData(next);
}
