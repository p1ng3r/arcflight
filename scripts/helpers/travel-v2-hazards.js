import { getTravelV2HazardDeck, getTravelV2HazardById } from "../../data/travel-events/travel-v2-hazard-deck.js";

const STATUSES = Object.freeze(["pending", "held", "active", "cleared"]);

function cloneData(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function nowIso(options = {}) { return typeof options.now === "string" && options.now ? options.now : new Date().toISOString(); }

function normalizeThresholds(value = []) {
  return [...new Set((Array.isArray(value) ? value : []).map(Number).filter((threshold) => [2, 3, 4].includes(threshold)))].sort((a, b) => a - b);
}

export function normalizeTravelV2HazardDeckState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const legacyPending = Array.isArray(source.pending) ? source.pending : [];
  const legacyActive = Array.isArray(source.active) ? source.active : [];
  const legacyCleared = Array.isArray(source.cleared) ? source.cleared : (Array.isArray(source.discarded) ? source.discarded : []);
  const records = [...legacyPending, ...legacyActive, ...legacyCleared, ...(Array.isArray(source.records) ? source.records : [])]
    .filter(isPlainObject)
    .map((record) => {
      const deck = getTravelV2HazardById(record.hazardId ?? record.id ?? record.key) ?? {};
      const status = STATUSES.includes(record.status) ? record.status : (legacyActive.includes(record) ? "active" : (legacyCleared.includes(record) ? "cleared" : "pending"));
      return {
        id: typeof record.id === "string" && record.id ? record.id : `${deck.id ?? record.hazardId ?? "hazard"}-${record.threshold ?? "manual"}`,
        hazardId: deck.id ?? record.hazardId ?? record.key ?? "",
        name: deck.name ?? record.name ?? "Unknown Hazard",
        category: deck.category ?? record.category ?? "",
        threshold: [2, 3, 4].includes(Number(record.threshold)) ? Number(record.threshold) : null,
        pressureType: typeof record.pressureType === "string" ? record.pressureType : "",
        status,
        revealed: record.revealed === true || Boolean(record.revealedAt),
        description: deck.description ?? record.description ?? "",
        pressureContext: deck.pressureContext ?? record.pressureContext ?? "",
        triggerContext: deck.triggerContext ?? record.triggerContext ?? "",
        gmText: deck.gmText ?? record.gmText ?? "",
        playerText: deck.playerText ?? record.playerText ?? "",
        drawnAt: typeof record.drawnAt === "string" ? record.drawnAt : "",
        revealedAt: typeof record.revealedAt === "string" ? record.revealedAt : "",
        heldAt: typeof record.heldAt === "string" ? record.heldAt : "",
        activatedAt: typeof record.activatedAt === "string" ? record.activatedAt : "",
        clearedAt: typeof record.clearedAt === "string" ? record.clearedAt : "",
        effects: cloneData(deck.effects ?? record.effects ?? []),
        responseActions: cloneData(deck.responseActions ?? record.responseActions ?? []),
        clearCondition: cloneData(deck.clearCondition ?? record.clearCondition ?? {}),
        unresolvedConsequence: cloneData(deck.unresolvedConsequence ?? record.unresolvedConsequence ?? {}),
        publicModifierText: deck.publicModifierText ?? record.publicModifierText ?? "",
        gmMechanicalNotes: deck.gmMechanicalNotes ?? record.gmMechanicalNotes ?? "",
        runtime: normalizeHazardRuntime(record.runtime)
      };
    });
  const unique = Array.from(new Map(records.map((record) => [record.id, record])).values());
  return { version: 1, drawnThresholds: normalizeThresholds(source.drawnThresholds), records: unique };
}

function nextDeckCard(state) {
  const deck = getTravelV2HazardDeck();
  if (deck.length <= 0) return null;
  const count = Array.isArray(state.records) ? state.records.length : 0;
  return deck[count % deck.length];
}

function drawForThreshold(session, draw, options) {
  const state = normalizeTravelV2HazardDeckState(session.travelV2Hazards ?? session.hazards);
  const threshold = Number(draw?.threshold);
  if (![2, 3, 4].includes(threshold) || state.drawnThresholds.includes(threshold)) return { state, drawn: null };
  const hazard = nextDeckCard(state);
  if (!hazard) return { state, drawn: null };
  const record = { ...hazard, id: `${hazard.id}-threshold-${threshold}`, hazardId: hazard.id, threshold, pressureType: draw?.pressureType ?? "", status: "pending", revealed: false, drawnAt: nowIso(options), revealedAt: "", heldAt: "", activatedAt: "", clearedAt: "" };
  return { state: { ...state, drawnThresholds: [...state.drawnThresholds, threshold].sort((a, b) => a - b), records: [...state.records, record] }, drawn: record };
}

export function drawTravelV2HazardsForPressureResult(session, pressureResult = {}, options = {}) {
  let next = { ...cloneData(session), travelV2Hazards: normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards) };
  const drawn = [];
  for (const draw of (Array.isArray(pressureResult.hazardDraws) ? pressureResult.hazardDraws : pressureResult.session?.hazards?.pendingDraws ?? [])) {
    const result = drawForThreshold(next, draw, options);
    next.travelV2Hazards = result.state;
    if (result.drawn) drawn.push(result.drawn);
  }
  return { session: next, drawn };
}

export function drawTravelV2ManualHazard(session, options = {}) {
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards);
  const hazard = nextDeckCard(state);
  if (!hazard) return { ok: false, errors: ["Hazard deck is empty."], session, drawn: null };
  const count = state.records.length + 1;
  const record = { ...hazard, id: `${hazard.id}-manual-${count}`, hazardId: hazard.id, threshold: null, pressureType: "", status: "pending", revealed: false, drawnAt: nowIso(options), revealedAt: "", heldAt: "", activatedAt: "", clearedAt: "" };
  const nextState = { ...state, records: [...state.records, record] };
  return { ok: true, errors: [], session: { ...cloneData(session), travelV2Hazards: nextState }, drawn: record };
}

export function setTravelV2HazardStatus(session, hazardRecordId, status, options = {}) {
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards);
  if (!["active", "held", "cleared"].includes(status)) return { ok: false, errors: ["Unsupported hazard status."], session };
  const at = nowIso(options);
  const records = state.records.map((record) => record.id === hazardRecordId ? {
    ...record,
    status,
    heldAt: status === "held" ? at : record.heldAt,
    activatedAt: status === "active" ? at : record.activatedAt,
    clearedAt: status === "cleared" ? at : record.clearedAt
  } : record);
  if (!records.some((record) => record.id === hazardRecordId)) return { ok: false, errors: ["Hazard was not found."], session };
  return { ok: true, errors: [], session: { ...cloneData(session), travelV2Hazards: { ...state, records } } };
}

export function revealTravelV2Hazard(session, hazardRecordId, options = {}) {
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards);
  const target = state.records.find((record) => record.id === hazardRecordId);
  if (!target) return { ok: false, errors: ["Hazard was not found."], session };
  if (!String(target.playerText || "").trim()) return { ok: false, errors: ["Hazard has no player-safe reveal text."], session };
  const records = state.records.map((record) => record.id === hazardRecordId ? { ...record, revealed: true, revealedAt: record.revealedAt || nowIso(options) } : record);
  return { ok: true, errors: [], session: { ...cloneData(session), travelV2Hazards: { ...state, records } } };
}

export function prepareTravelV2HazardPanelState(session) {
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards);
  const records = state.records.map((record) => {
    const gm = sanitizeTravelV2GmHazard(record);
    const runtime = normalizeHazardRuntime(record.runtime);
    const currentRoundKey = String(Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0);
    return { ...record, ...gm, statusLabel: record.status[0].toUpperCase() + record.status.slice(1), revealDisabled: !String(record.playerText || "").trim(), canReveal: record.revealed !== true && String(record.playerText || "").trim(), canActivate: ["pending", "held"].includes(record.status), canHold: record.status === "pending", canClear: record.status === "pending" || record.status === "held" || record.status === "active", canApplyToRound: record.status !== "cleared" && !runtime.appliedRoundKeys.includes(currentRoundKey), appliedThisRound: runtime.appliedRoundKeys.includes(currentRoundKey), applyButtonLabel: record.revealed === true || record.status === "active" ? "Apply Hazard to Round" : "Reveal and Apply" };
  });
  return { ...state, records, pending: records.filter((r) => r.status === "pending"), held: records.filter((r) => r.status === "held"), revealed: records.filter((r) => r.revealed === true && r.status !== "cleared"), active: records.filter((r) => r.status === "active"), cleared: records.filter((r) => r.status === "cleared"), availableCount: getTravelV2HazardDeck().length, deckName: "Travel v2 Hazard Deck v1", hasRecords: records.length > 0, drawnThresholdText: state.drawnThresholds.join(", ") || "none" };
}

function normalizeHazardEffects(value = []) {
  return (Array.isArray(value) ? value : []).filter(isPlainObject).map((effect) => ({
    type: typeof effect.type === "string" ? effect.type : "",
    stationKey: typeof effect.stationKey === "string" ? effect.stationKey : "",
    actionType: typeof effect.actionType === "string" ? effect.actionType : "",
    modifier: Number.isFinite(Number(effect.modifier)) ? Number(effect.modifier) : 0,
    match: Array.isArray(effect.match) ? effect.match.map((entry) => String(entry ?? "").toLowerCase()).filter(Boolean) : [],
    label: typeof effect.label === "string" ? effect.label : ""
  })).filter((effect) => effect.type);
}

function normalizeHazardResponseActions(value = []) {
  return (Array.isArray(value) ? value : []).filter(isPlainObject).map((action) => ({
    key: typeof action.key === "string" ? action.key : "",
    stationKey: typeof action.stationKey === "string" ? action.stationKey : "",
    label: typeof action.label === "string" ? action.label : "Respond to Hazard",
    skill: typeof action.skill === "string" ? action.skill : "",
    helpText: typeof action.helpText === "string" ? action.helpText : "",
    actionType: "hazardResponse",
    hazardResponse: true
  })).filter((action) => action.key && action.stationKey);
}

function normalizeHazardMechanics(record = {}) {
  const deck = getTravelV2HazardById(record.hazardId ?? record.id) ?? {};
  return {
    effects: normalizeHazardEffects(record.effects ?? deck.effects),
    responseActions: normalizeHazardResponseActions(record.responseActions ?? deck.responseActions),
    clearCondition: isPlainObject(record.clearCondition ?? deck.clearCondition) ? cloneData(record.clearCondition ?? deck.clearCondition) : {},
    unresolvedConsequence: isPlainObject(record.unresolvedConsequence ?? deck.unresolvedConsequence) ? cloneData(record.unresolvedConsequence ?? deck.unresolvedConsequence) : {},
    publicModifierText: typeof (record.publicModifierText ?? deck.publicModifierText) === "string" ? (record.publicModifierText ?? deck.publicModifierText) : "",
    gmMechanicalNotes: typeof (record.gmMechanicalNotes ?? deck.gmMechanicalNotes) === "string" ? (record.gmMechanicalNotes ?? deck.gmMechanicalNotes) : ""
  };
}

function normalizeHazardRuntime(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    appliedRoundKeys: Array.isArray(source.appliedRoundKeys) ? source.appliedRoundKeys.filter((key) => typeof key === "string") : [],
    responseProgress: Math.max(0, Number.isFinite(Number(source.responseProgress)) ? Number(source.responseProgress) : 0),
    responseLog: Array.isArray(source.responseLog) ? cloneData(source.responseLog) : [],
    suppressedRoundKeys: Array.isArray(source.suppressedRoundKeys) ? source.suppressedRoundKeys.filter((key) => typeof key === "string") : [],
    unresolvedFiredRoundKeys: Array.isArray(source.unresolvedFiredRoundKeys) ? source.unresolvedFiredRoundKeys.filter((key) => typeof key === "string") : []
  };
}

function roundKey(session, options = {}) { return String(Number.isInteger(Number(options.roundIndex)) ? Number(options.roundIndex) : (Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0)); }
function humanizeIdentifier(value = "") { return String(value ?? "").replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function sanitizeTravelV2PublicHazard(record = {}) {
  const mechanics = normalizeHazardMechanics(record);
  const affectedStations = Array.from(new Set([
    ...mechanics.effects.map((effect) => effect.stationKey).filter(Boolean),
    ...mechanics.responseActions.map((action) => action.stationKey).filter((stationKey) => stationKey && stationKey !== "any")
  ]));
  return {
    id: record.id ?? "", hazardId: record.hazardId ?? "", name: record.name ?? "Unknown Hazard", category: record.category ?? "", status: record.status ?? "", revealed: record.revealed === true,
    playerText: record.playerText ?? "", publicModifierText: mechanics.publicModifierText,
    affectedStations,
    affectedStationText: affectedStations.length ? affectedStations.map(humanizeIdentifier).join(", ") : "Any station",
    responseActions: mechanics.responseActions.map((action) => ({ key: action.key, stationKey: action.stationKey, stationLabel: action.stationKey === "any" ? "Any station" : humanizeIdentifier(action.stationKey), label: action.label, skill: action.skill, helpText: action.helpText, actionType: action.actionType, hazardRecordId: record.id ?? "", hazardName: record.name ?? "" }))
  };
}

export function sanitizeTravelV2GmHazard(record = {}) {
  const pub = sanitizeTravelV2PublicHazard(record);
  const mechanics = normalizeHazardMechanics(record);
  return { ...pub, gmText: record.gmText ?? "", gmMechanicalNotes: mechanics.gmMechanicalNotes, effects: mechanics.effects, clearCondition: mechanics.clearCondition, unresolvedConsequence: mechanics.unresolvedConsequence, runtime: normalizeHazardRuntime(record.runtime) };
}

export function prepareTravelV2ActiveHazardModifiers(session, options = {}) {
  const key = roundKey(session, options);
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards);
  const activeRecords = state.records.filter((record) => record.status === "active");
  const publicHazards = activeRecords.filter((record) => record.revealed === true).map(sanitizeTravelV2PublicHazard);
  const dcModifiers = [];
  const suppressions = [];
  const responseActions = [];
  let suppressFocus = false;
  for (const record of activeRecords) {
    const runtime = normalizeHazardRuntime(record.runtime);
    if (runtime.suppressedRoundKeys.includes(key)) continue;
    const mechanics = normalizeHazardMechanics(record);
    for (const effect of mechanics.effects) {
      if (effect.type === "dcModifier") dcModifiers.push({ ...effect, hazardRecordId: record.id, hazardName: record.name, publicModifierText: mechanics.publicModifierText });
      if (effect.type === "suppressOption") suppressions.push({ ...effect, hazardRecordId: record.id, hazardName: record.name, publicModifierText: mechanics.publicModifierText });
      if (effect.type === "suppressFocus") suppressFocus = true;
    }
    responseActions.push(...mechanics.responseActions.map((action) => ({ ...action, hazardRecordId: record.id, hazardName: record.name, publicModifierText: mechanics.publicModifierText })));
  }
  return { roundKey: key, publicHazards, dcModifiers, suppressions, responseActions, suppressFocus, hasActiveHazards: activeRecords.length > 0 };
}

export function applyTravelV2HazardToRound(session, hazardRecordId, options = {}) {
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards);
  const key = roundKey(session, options);
  let found = false, duplicate = false;
  const at = nowIso(options);
  const records = state.records.map((record) => {
    if (record.id !== hazardRecordId) return record;
    found = true;
    const runtime = normalizeHazardRuntime(record.runtime);
    if (runtime.appliedRoundKeys.includes(key)) { duplicate = true; return { ...record, runtime }; }
    return { ...record, status: "active", revealed: true, revealedAt: record.revealedAt || at, activatedAt: record.activatedAt || at, runtime: { ...runtime, appliedRoundKeys: [...runtime.appliedRoundKeys, key] } };
  });
  if (!found) return { ok: false, errors: ["Hazard was not found."], session };
  if (duplicate) return { ok: false, duplicate: true, errors: ["Hazard already applied to this round."], session: { ...cloneData(session), travelV2Hazards: { ...state, records } } };
  return { ok: true, duplicate: false, errors: [], session: { ...cloneData(session), travelV2Hazards: { ...state, records } } };
}

export function resolveTravelV2HazardResponse(session, hazardRecordId, stationKey, degreeOfSuccess, options = {}) {
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards);
  const key = roundKey(session, options);
  const success = ["success", "criticalSuccess", 2, 3, "2", "3"].includes(degreeOfSuccess);
  const critical = ["criticalSuccess", 3, "3"].includes(degreeOfSuccess);
  let found = false, cleared = false;
  const records = state.records.map((record) => {
    if (record.id !== hazardRecordId) return record;
    found = true;
    const mechanics = normalizeHazardMechanics(record);
    const cc = mechanics.clearCondition ?? {};
    const runtime = normalizeHazardRuntime(record.runtime);
    let progressGain = success ? 1 : 0;
    if (critical) progressGain = Number(cc.criticalSuccessProgress ?? 2) || 2;
    const clearingStations = Array.isArray(cc.clearingStations) ? cc.clearingStations : [];
    const stationClears = success && clearingStations.includes(stationKey);
    const nextProgress = runtime.responseProgress + (stationClears ? Number(cc.target ?? 1) || 1 : progressGain);
    const target = Math.max(1, Number(cc.target ?? 1) || 1);
    cleared = success && (stationClears || nextProgress >= target);
    const nextRuntime = { ...runtime, responseProgress: nextProgress, responseLog: [...runtime.responseLog, { roundKey: key, stationKey, degreeOfSuccess: String(degreeOfSuccess), progressGain, at: nowIso(options) }] };
    if (success && cc.suppressOnSuccess === true && !cleared && !nextRuntime.suppressedRoundKeys.includes(key)) nextRuntime.suppressedRoundKeys.push(key);
    return { ...record, status: cleared ? "cleared" : record.status, clearedAt: cleared ? nowIso(options) : record.clearedAt, runtime: nextRuntime };
  });
  if (!found) return { ok: false, errors: ["Hazard was not found."], session };
  return { ok: true, cleared, errors: [], session: { ...cloneData(session), travelV2Hazards: { ...state, records } } };
}

export function resolveTravelV2UnresolvedHazardsForRound(session, options = {}) {
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards);
  const key = roundKey(session, options);
  const consequences = [];
  const records = state.records.map((record) => {
    if (record.status !== "active") return record;
    const runtime = normalizeHazardRuntime(record.runtime);
    if (!runtime.appliedRoundKeys.includes(key) || runtime.unresolvedFiredRoundKeys.includes(key)) return { ...record, runtime };
    const mechanics = normalizeHazardMechanics(record);
    consequences.push({ hazardRecordId: record.id, hazardName: record.name, ...cloneData(mechanics.unresolvedConsequence) });
    return { ...record, runtime: { ...runtime, unresolvedFiredRoundKeys: [...runtime.unresolvedFiredRoundKeys, key] } };
  });
  if (consequences.length === 0 && records.every((record, index) => JSON.stringify(record.runtime ?? {}) === JSON.stringify(state.records[index]?.runtime ?? {}))) return { ok: true, errors: [], consequences, session: cloneData(session) };
  const next = { ...cloneData(session), travelV2Hazards: { ...state, records } };
  if (consequences.length > 0 || Array.isArray(session?.travelV2HazardConsequences?.records)) next.travelV2HazardConsequences = { records: [...(Array.isArray(session?.travelV2HazardConsequences?.records) ? cloneData(session.travelV2HazardConsequences.records) : []), ...consequences.map((c) => ({ ...c, roundKey: key, firedAt: nowIso(options) }))] };
  return { ok: true, errors: [], consequences, session: next };
}
