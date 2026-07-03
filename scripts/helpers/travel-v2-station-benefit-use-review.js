import { prepareTravelV2PendingStationBenefitQueueItems } from "./travel-v2-pending-station-benefit-queue.js";

export const TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION = 1;

const PERSISTENCE_REASON = "Station benefit use review is display-only and does not mutate Foundry documents.";
const SELECTED_KEYS = ["selectedPendingBenefitQueueKey", "selectedQueueKey", "travelV2SelectedPendingStationBenefitQueueKey", "travelV2StationBenefitUseReviewSelectedQueueKey"];
const REVIEW_FLAGS = ["travelV2StationBenefitUseReviewRequested", "stationBenefitUseReviewRequested", "includeStationBenefitUseReview"];
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gm" + "Text", "gm" + "Summary", "gm" + "MechanicalNotes", "gm" + "Review", "explicit" + "GmApplyEffect", "session" + "LocalEffect", "internal" + "Mutation", "target" + "ActorId", "target" + "ActorUuid", "apply" + "Payload", "before", "after", "queue" + "Internals"]);
const BLOCKED_STATUSES = new Set(["used", "dismissed", "expired", "blocked"]);

function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
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
function inertFlags() { return { reviewOnly: true, useAvailable: false, applyAvailable: false, applied: false, used: false, dismissed: false, persistentMutation: { available: false, reason: PERSISTENCE_REASON } }; }
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
function reviewRequested(input = {}, options = {}) { return REVIEW_FLAGS.some((key) => input?.[key] === true || options?.[key] === true) || options.includeGmReview === true || input.includeGmReview === true; }
function displayRowFrom(row = {}) {
  return stripForbiddenFields({ stationBenefitUseReviewVersion: TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, queueKey: row.queueKey ?? null, title: row.title ?? "Pending station benefit", sourceStation: row.sourceStation ?? null, sourceStationLabel: row.sourceStationLabel ?? null, targetStation: row.targetStation ?? null, targetStationLabel: row.targetStationLabel ?? null, benefitKind: row.benefitKind ?? "unknown", magnitude: row.magnitude ?? null, expires: row.expires ?? "unknown", status: row.status ?? "blocked", publicText: row.publicText ?? null, playerSafeSummary: row.playerSafeSummary ?? row.publicText ?? null, reviewOnly: true, selected: false, canReview: row.status === "pending", disabledReason: row.status === "pending" ? null : `Pending station benefit is ${row.status ?? "unavailable"}.`, ...inertFlags() });
}
function blockedCandidate(reason, selectedQueueKey = null) { return cloneData(stripForbiddenFields({ status: "blocked", ready: false, selectedQueueKey, reason, candidate: null, ...inertFlags() })); }
function readyCandidate(row) { return cloneData(stripForbiddenFields({ status: "ready", ready: true, selectedQueueKey: row.queueKey, reason: null, candidate: { ...displayRowFrom(row), selected: true, status: "pending", reviewOnly: true, ...inertFlags() }, ...inertFlags() })); }

export function normalizeTravelV2StationBenefitUseReviewInput(input = {}, options = {}) {
  const user = userFrom(input, options);
  const hiddenKeys = hiddenKeysFor(input);
  const rows = prepareTravelV2PendingStationBenefitQueueItems(input, { ...options, user, includeGmReview: false }).map((row) => hiddenKeys.has(row.queueKey) ? { ...row, hidden: true, playerVisible: false, status: "blocked", disabledReason: "Pending station benefit is hidden." } : row);
  return cloneData({ stationBenefitUseReviewVersion: TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, user: { isGM: isGmLike(user) }, includeGmReview: isGmLike(user) && reviewRequested(input, options), selectedQueueKey: selectedKeyFrom(input, options), rows });
}

export function prepareTravelV2StationBenefitDisplayRows(input = {}, options = {}) {
  return cloneData(normalizeTravelV2StationBenefitUseReviewInput(input, options).rows.map(displayRowFrom));
}

export function prepareTravelV2StationBenefitUseReviewPlayerState(input = {}, options = {}) {
  const normalized = normalizeTravelV2StationBenefitUseReviewInput(input, { ...options, includeGmReview: false });
  const rows = normalized.rows.map(displayRowFrom);
  let selectedCandidate = blockedCandidate("No pending station benefit is selected.", null);
  if (normalized.selectedQueueKey) {
    const row = normalized.rows.find((entry) => entry.queueKey === normalized.selectedQueueKey);
    if (!row) selectedCandidate = blockedCandidate("Selected pending station benefit was not found.", normalized.selectedQueueKey);
    else if (row.playerVisible === false || row.hidden === true) selectedCandidate = blockedCandidate("Selected pending station benefit is hidden.", normalized.selectedQueueKey);
    else if (BLOCKED_STATUSES.has(row.status)) selectedCandidate = blockedCandidate(`Selected pending station benefit is ${row.status}.`, normalized.selectedQueueKey);
    else if (row.status !== "pending") selectedCandidate = blockedCandidate("Selected station benefit is not pending.", normalized.selectedQueueKey);
    else selectedCandidate = readyCandidate(row);
  }
  return cloneData(stripForbiddenFields({ stationBenefitUseReviewVersion: TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, status: rows.length > 0 ? "ready" : "empty", rows, items: rows, selectedQueueKey: normalized.selectedQueueKey, selectedCandidate, ...inertFlags() }));
}

export function prepareTravelV2StationBenefitUseReviewGmState(input = {}, options = {}) {
  const user = userFrom(input, options);
  const playerState = prepareTravelV2StationBenefitUseReviewPlayerState(input, options);
  if (!isGmLike(user) || !reviewRequested(input, options)) return playerState;
  const normalized = normalizeTravelV2StationBenefitUseReviewInput(input, { ...options, user, includeGmReview: true });
  const selectedGmRow = normalized.selectedQueueKey ? normalized.rows.find((row) => row.queueKey === normalized.selectedQueueKey) ?? null : null;
  return cloneData({ ...playerState, gmReview: { reviewRequested: true, selectedQueueKey: normalized.selectedQueueKey, selectedRow: cloneData(selectedGmRow), note: "Review-only station benefit candidate; no use/apply result is created." } });
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
  if (reviewRequested(reviewInput, options)) next.travelV2StationBenefitUseReview = prepareTravelV2StationBenefitUseReviewGmState(reviewInput, { ...options, user, includeGmReview: true });
  return cloneData(next);
}
