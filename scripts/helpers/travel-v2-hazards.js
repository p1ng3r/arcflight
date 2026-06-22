import { getTravelV2HazardDeck, getTravelV2HazardById } from "../../data/travel-events/travel-v2-hazard-deck.js";

const STATUSES = Object.freeze(["pending", "active", "cleared"]);

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
        description: deck.description ?? record.description ?? "",
        pressureContext: deck.pressureContext ?? record.pressureContext ?? "",
        triggerContext: deck.triggerContext ?? record.triggerContext ?? "",
        gmText: deck.gmText ?? record.gmText ?? "",
        playerText: deck.playerText ?? record.playerText ?? "",
        drawnAt: typeof record.drawnAt === "string" ? record.drawnAt : "",
        activatedAt: typeof record.activatedAt === "string" ? record.activatedAt : "",
        clearedAt: typeof record.clearedAt === "string" ? record.clearedAt : ""
      };
    });
  const unique = Array.from(new Map(records.map((record) => [record.id, record])).values());
  return { version: 1, drawnThresholds: normalizeThresholds(source.drawnThresholds), records: unique };
}

function drawForThreshold(session, draw, options) {
  const state = normalizeTravelV2HazardDeckState(session.travelV2Hazards ?? session.hazards);
  const threshold = Number(draw?.threshold);
  if (![2, 3, 4].includes(threshold) || state.drawnThresholds.includes(threshold)) return { state, drawn: null };
  const deck = getTravelV2HazardDeck();
  const hazard = deck[(threshold - 2) % deck.length];
  const record = { ...hazard, id: `${hazard.id}-threshold-${threshold}`, hazardId: hazard.id, threshold, pressureType: draw?.pressureType ?? "", status: "pending", drawnAt: nowIso(options), activatedAt: "", clearedAt: "" };
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

export function setTravelV2HazardStatus(session, hazardRecordId, status, options = {}) {
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards);
  if (!["active", "cleared"].includes(status)) return { ok: false, errors: ["Unsupported hazard status."], session };
  const records = state.records.map((record) => record.id === hazardRecordId ? { ...record, status, activatedAt: status === "active" ? nowIso(options) : record.activatedAt, clearedAt: status === "cleared" ? nowIso(options) : record.clearedAt } : record);
  if (!records.some((record) => record.id === hazardRecordId)) return { ok: false, errors: ["Hazard was not found."], session };
  return { ok: true, errors: [], session: { ...cloneData(session), travelV2Hazards: { ...state, records } } };
}

export function prepareTravelV2HazardPanelState(session) {
  const state = normalizeTravelV2HazardDeckState(session?.travelV2Hazards ?? session?.hazards);
  const records = state.records.map((record) => ({ ...record, statusLabel: record.status[0].toUpperCase() + record.status.slice(1), canActivate: record.status === "pending", canClear: record.status === "pending" || record.status === "active" }));
  return { ...state, records, pending: records.filter((r) => r.status === "pending"), active: records.filter((r) => r.status === "active"), cleared: records.filter((r) => r.status === "cleared"), hasRecords: records.length > 0, drawnThresholdText: state.drawnThresholds.join(", ") || "none" };
}
