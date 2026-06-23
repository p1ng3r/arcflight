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
        clearedAt: typeof record.clearedAt === "string" ? record.clearedAt : ""
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
  const records = state.records.map((record) => ({ ...record, statusLabel: record.status[0].toUpperCase() + record.status.slice(1), revealDisabled: !String(record.playerText || "").trim(), canReveal: record.revealed !== true && String(record.playerText || "").trim(), canActivate: ["pending", "held"].includes(record.status), canHold: record.status === "pending", canClear: record.status === "pending" || record.status === "held" || record.status === "active" }));
  return { ...state, records, pending: records.filter((r) => r.status === "pending"), held: records.filter((r) => r.status === "held"), revealed: records.filter((r) => r.revealed === true && r.status !== "cleared"), active: records.filter((r) => r.status === "active"), cleared: records.filter((r) => r.status === "cleared"), availableCount: getTravelV2HazardDeck().length, deckName: "Travel v2 Hazard Deck v1", hasRecords: records.length > 0, drawnThresholdText: state.drawnThresholds.join(", ") || "none" };
}
