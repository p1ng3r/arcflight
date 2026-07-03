export const TRAVEL_V2_ACTIVE_HAZARD_LIFECYCLE_DISPLAY_VERSION = 1;

const PERSISTENCE_REASON = "Active hazard lifecycle display does not mutate Foundry documents.";
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals", "gmReview"]);

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
function controlResultFrom(input = {}) {
  return isPlainObject(input.travelV2HazardCandidateControlResult) ? input.travelV2HazardCandidateControlResult : (isPlainObject(input.candidateControlResult) ? input.candidateControlResult : (isPlainObject(input.result) ? input.result : input));
}
function normalizeStatus(status) {
  if (status === "activated" || status === "active") return "active";
  if (status === "held" || status === "dismissed" || status === "blocked" || status === "empty") return status;
  if (status === "invalid") return "blocked";
  return "empty";
}
function lifecycleRecordFrom(result = {}) {
  if (isPlainObject(result.activeHazard)) return { status: "active", record: result.activeHazard };
  if (isPlainObject(result.heldHazard)) return { status: "held", record: result.heldHazard };
  if (isPlainObject(result.dismissedHazard)) return { status: "dismissed", record: result.dismissedHazard };
  return { status: normalizeStatus(result.status), record: null };
}
function previewStationImpacts(record = {}) {
  const impacts = record.stationImpacts ?? record.stationImpactsPreview?.stationImpacts ?? record.stationImpactsPreview?.items ?? {};
  return cloneData({ applied: false, displayOnly: true, stationImpacts: impacts, summary: text(record.stationImpactsPreview?.summary) || (Object.keys(isPlainObject(impacts) ? impacts : {}).length ? "Station impacts are preview-only and not applied." : "No station impact preview." ) });
}
function previewResponseActions(record = {}) {
  const actions = Array.isArray(record.responseActions) ? record.responseActions : (Array.isArray(record.responseActionsPreview?.actions) ? record.responseActionsPreview.actions : []);
  return cloneData({ wired: false, displayOnly: true, actions: actions.map((action) => stripForbiddenFields({ id: action.id ?? action.actionId ?? null, title: action.title ?? action.label ?? null, publicText: action.publicText ?? action.description ?? null })), summary: actions.length ? `${actions.length} response action preview(s); not wired.` : "No response action preview." });
}
function previewClearCondition(record = {}) {
  const clearCondition = isPlainObject(record.clearCondition) ? record.clearCondition : (isPlainObject(record.clearConditionPreview?.clearCondition) ? record.clearConditionPreview.clearCondition : null);
  return cloneData({ progressMutable: false, displayOnly: true, clearCondition: stripForbiddenFields(clearCondition), clearProgress: stripForbiddenFields(record.clearProgress ?? null), summary: text(clearCondition?.publicText) || text(record.clearConditionPreview?.summary) || "Clear progress is display-only and immutable." });
}
function previewUnresolvedConsequence(record = {}) {
  const refs = Array.isArray(record.unresolvedConsequenceRefs) ? record.unresolvedConsequenceRefs : (Array.isArray(record.unresolvedConsequencePreview?.refs) ? record.unresolvedConsequencePreview.refs : []);
  return cloneData({ applied: false, displayOnly: true, refs: stripForbiddenFields(refs), summary: refs.length ? `${refs.length} unresolved consequence reference(s); not applied.` : "No unresolved consequence preview." });
}
function rowFrom(record, status, result = {}, options = {}) {
  const row = {
    lifecycleDisplayVersion: TRAVEL_V2_ACTIVE_HAZARD_LIFECYCLE_DISPLAY_VERSION,
    status,
    source: "built-in",
    deckId: record?.deckId ?? result.deckId ?? null,
    cardId: record?.cardId ?? result.cardId ?? null,
    title: record?.title ?? null,
    publicText: record?.publicText ?? null,
    playerSafeSummary: record?.playerSafeSummary ?? record?.publicText ?? null,
    lifecycleStatus: record?.lifecycleStatus ?? status,
    isActive: status === "active",
    persisted: false,
    stationImpactsPreview: previewStationImpacts(record ?? {}),
    responseActionsPreview: previewResponseActions(record ?? {}),
    clearConditionPreview: previewClearCondition(record ?? {}),
    unresolvedConsequencePreview: previewUnresolvedConsequence(record ?? {}),
    playerVisible: status === "active",
    gmOnly: status !== "active"
  };
  if (status === "blocked") row.blockedReason = result.blockedReason ?? result.disabledReason ?? "Active hazard lifecycle display is blocked.";
  if (result.disabledReason) row.disabledReason = result.disabledReason;
  if (options.includeGmReview === true && isGmLike(options.user) && isPlainObject(result.gmReview)) row.gmReview = cloneData(result.gmReview);
  return cloneData(row);
}
function emptyState() {
  return { displayOnly: true, stationEffectsApplied: false, responseActionsWired: false, consequencesApplied: false, persistentMutation: { available: false, reason: PERSISTENCE_REASON } };
}

export function normalizeTravelV2ActiveHazardLifecycleInput(input = {}, options = {}) {
  const result = controlResultFrom(input);
  const { status, record } = lifecycleRecordFrom(result ?? {});
  return cloneData({ lifecycleDisplayVersion: TRAVEL_V2_ACTIVE_HAZARD_LIFECYCLE_DISPLAY_VERSION, status, result: result ?? {}, record, includeGmReview: options.includeGmReview === true || input.includeGmReview === true, user: userFrom(input, options) });
}

export function prepareTravelV2ActiveHazardLifecycleRows(input = {}, options = {}) {
  const normalized = normalizeTravelV2ActiveHazardLifecycleInput(input, options);
  if (normalized.status === "empty") return [];
  return [rowFrom(normalized.record, normalized.status, normalized.result, { ...options, user: normalized.user, includeGmReview: normalized.includeGmReview })];
}

export function prepareTravelV2ActiveHazardPlayerHudState(input = {}, options = {}) {
  const rows = prepareTravelV2ActiveHazardLifecycleRows(input, { ...options, includeGmReview: false }).map(stripForbiddenFields);
  return cloneData({ ...emptyState(), activeHazards: rows.filter((row) => row.status === "active" && row.playerVisible === true), heldHazards: [], dismissedHazards: [] });
}

export function prepareTravelV2ActiveHazardGmLifecycleState(input = {}, options = {}) {
  const user = userFrom(input, options);
  const allRows = prepareTravelV2ActiveHazardLifecycleRows(input, { ...options, user, includeGmReview: options.includeGmReview === true && isGmLike(user) });
  const activeHazards = allRows.filter((row) => row.status === "active");
  const heldHazards = allRows.filter((row) => row.status === "held");
  const dismissedHazards = allRows.filter((row) => row.status === "dismissed");
  return cloneData({ ...emptyState(), activeHazards, heldHazards, dismissedHazards, allRows, counts: { active: activeHazards.length, held: heldHazards.length, dismissed: dismissedHazards.length, blocked: allRows.filter((row) => row.status === "blocked").length, total: allRows.length } });
}

export function applyTravelV2ActiveHazardLifecycleDisplayToRenderState(renderState = {}, input = {}, options = {}) {
  const base = cloneData(renderState ?? {});
  const user = userFrom(input, options);
  const playerHud = prepareTravelV2ActiveHazardPlayerHudState(input, { ...options, user, includeGmReview: false });
  if (!isGmLike(user)) return cloneData(stripForbiddenFields({ ...base, travelV2ActiveHazardPlayerHud: playerHud }));
  return cloneData({ ...base, travelV2ActiveHazardLifecycleDisplay: prepareTravelV2ActiveHazardGmLifecycleState(input, { ...options, user, includeGmReview: options.includeGmReview === true }), travelV2ActiveHazardPlayerHud: playerHud });
}
