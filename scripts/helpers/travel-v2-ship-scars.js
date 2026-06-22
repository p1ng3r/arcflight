import { getTravelV2ShipScarById, getTravelV2ShipScarForPressureType } from "../../data/travel-events/travel-v2-ship-scars-deck.js";

export const TRAVEL_V2_SHIP_SCARS_VERSION = 1;
const MODULE_ID = "arcflight";
const STATUSES = Object.freeze(["pending", "applied", "repaired", "dismissed"]);
function cloneData(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function nowIso(options = {}) { return typeof options.now === "string" && options.now ? options.now : new Date().toISOString(); }
function actorSystem(actor) { return actor?.getFlag?.(MODULE_ID, "system") ?? actor?.flags?.[MODULE_ID]?.system ?? {}; }
function actorShipScars(actor) { return readTravelV2ActorShipScarRecords(actor); }
function isSupportedActor(actor) { const enabled = actor?.getFlag?.(MODULE_ID, "enabled") ?? actor?.flags?.[MODULE_ID]?.enabled; const arcType = actor?.getFlag?.(MODULE_ID, "actorType") ?? actor?.flags?.[MODULE_ID]?.actorType; return actor?.type === "vehicle" && (enabled === true || arcType === "ship" || arcType === "arcflightShip"); }
function userIsGm(options = {}) { return options.isGM ?? options.user?.isGM ?? globalThis.game?.user?.isGM ?? false; }
function userRecord(options = {}) { const user = options.user ?? globalThis.game?.user ?? {}; return { id: user.id ?? user._id ?? "", name: user.name ?? "" }; }
function stableId(record = {}) { return record.id || `${record.scarId || record.key || "scar"}-${record.pressureType || "pressure"}-${record.roundNumber ?? "manual"}`; }

function preserveActorScarMetadata(normalizedRecord, source = {}) {
  const preserved = { ...normalizedRecord };
  if (isPlainObject(source.playerSafe)) preserved.playerSafe = cloneData(source.playerSafe);
  for (const key of ["appliedByUserId", "appliedByUserName", "appliedAt", "repairedAt", "dismissedAt", "drawnAt"]) {
    if (typeof source[key] === "string") preserved[key] = source[key];
  }
  return preserved;
}

function readTravelV2ActorShipScarRecords(actor) {
  const shipScars = actorSystem(actor)?.travelV2?.shipScars;
  const source = isPlainObject(shipScars) ? shipScars : {};
  const records = Array.isArray(source.records) ? source.records : [];
  return Array.from(new Map(records.filter(isPlainObject).map((record) => {
    const normalized = normalizeTravelV2ShipScarRecord(record);
    return preserveActorScarMetadata(normalized, record);
  }).map((record) => [stableId(record), record])).values());
}

export function normalizeTravelV2ShipScarRecord(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const deck = getTravelV2ShipScarById(source.scarId ?? source.key ?? source.id) ?? getTravelV2ShipScarForPressureType(source.pressureType);
  const status = STATUSES.includes(source.status) ? source.status : "pending";
  return {
    id: typeof source.id === "string" && source.id ? source.id : `${deck.id}-${source.pressureType ?? deck.pressureType}-${source.roundNumber ?? "manual"}`,
    scarId: deck.id,
    key: deck.id,
    name: deck.name,
    pressureType: source.pressureType ?? deck.pressureType,
    category: deck.category,
    severity: deck.severity,
    status,
    playerVisible: source.playerVisible !== false,
    flavorText: deck.flavorText,
    gmText: deck.gmText,
    playerText: deck.playerText,
    repairRequirement: deck.repairRequirement,
    downtimeRequirement: deck.downtimeRequirement,
    costRequirement: deck.costRequirement,
    roleplayHook: deck.roleplayHook,
    source: typeof source.source === "string" ? source.source : "pressure-overflow",
    roundNumber: source.roundNumber == null ? null : Math.max(1, Number.parseInt(source.roundNumber, 10) || 1),
    overflowAmount: Math.max(0, Number.parseInt(source.overflowAmount, 10) || 0),
    triggerKey: typeof source.triggerKey === "string" ? source.triggerKey : "",
    drawnAt: typeof source.drawnAt === "string" ? source.drawnAt : "",
    appliedAt: typeof source.appliedAt === "string" ? source.appliedAt : "",
    repairedAt: typeof source.repairedAt === "string" ? source.repairedAt : "",
    dismissedAt: typeof source.dismissedAt === "string" ? source.dismissedAt : ""
  };
}

export function normalizeTravelV2ShipScarsState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const records = [...(Array.isArray(source.records) ? source.records : []), ...(Array.isArray(source.pending) ? source.pending : []), ...(Array.isArray(source.applied) ? source.applied : []), ...(Array.isArray(source.repaired) ? source.repaired : []), ...(Array.isArray(source.dismissed) ? source.dismissed : [])]
    .filter(isPlainObject).map(normalizeTravelV2ShipScarRecord);
  return { version: TRAVEL_V2_SHIP_SCARS_VERSION, records: Array.from(new Map(records.map((record) => [record.id, record])).values()) };
}

export function drawTravelV2ShipScarsForPressureResult(session, pressureResult = {}, options = {}) {
  const state = normalizeTravelV2ShipScarsState(session?.shipScars ?? session?.travelV2ShipScars);
  const existingTriggers = new Set(state.records.map((record) => record.triggerKey).filter(Boolean));
  const drawn = [];
  let records = state.records;
  for (const trigger of (Array.isArray(pressureResult.shipScarTriggers) ? pressureResult.shipScarTriggers : [])) {
    const pressureType = trigger.pressureType;
    const triggerKey = `${pressureType}|${trigger.roundNumber ?? ""}|${trigger.source ?? "pressure-overflow"}`;
    if (existingTriggers.has(triggerKey)) continue;
    const scar = getTravelV2ShipScarForPressureType(pressureType);
    const record = normalizeTravelV2ShipScarRecord({ ...trigger, id: `${scar.id}-${triggerKey}`.replace(/[^a-zA-Z0-9_-]+/g, "-"), scarId: scar.id, status: "pending", triggerKey, drawnAt: nowIso(options) });
    records = [...records, record]; existingTriggers.add(triggerKey); drawn.push(record);
  }
  return { session: { ...cloneData(session), shipScars: { ...state, records } }, drawn };
}

export function setTravelV2ShipScarSessionStatus(session, scarRecordId, status, options = {}) {
  if (!["dismissed", "repaired"].includes(status)) return { ok: false, errors: ["Unsupported ship scar status."], session };
  const state = normalizeTravelV2ShipScarsState(session?.shipScars ?? session?.travelV2ShipScars);
  let found = false;
  const records = state.records.map((record) => { if (record.id !== scarRecordId) return record; found = true; return { ...record, status, dismissedAt: status === "dismissed" ? nowIso(options) : record.dismissedAt, repairedAt: status === "repaired" ? nowIso(options) : record.repairedAt }; });
  return found ? { ok: true, errors: [], session: { ...cloneData(session), shipScars: { ...state, records } } } : { ok: false, errors: ["Ship scar was not found."], session };
}

export async function applyTravelV2ShipScarToActor(session, actor, scarRecordId, options = {}) {
  const state = normalizeTravelV2ShipScarsState(session?.shipScars ?? session?.travelV2ShipScars);
  const record = state.records.find((entry) => entry.id === scarRecordId);
  const blockedReasons = [];
  if (!userIsGm(options)) blockedReasons.push("Only a GM can apply Ship Scars.");
  if (!record || record.status !== "pending") blockedReasons.push("A pending Ship Scar is required.");
  if (!isSupportedActor(actor)) blockedReasons.push("A PF2E vehicle / Arcflight ship actor is required.");
  const existing = actorShipScars(actor);
  if (record && existing.some((entry) => entry.id === record.id || entry.scarId === record.scarId && entry.triggerKey === record.triggerKey)) blockedReasons.push("This Ship Scar is already applied to this ship.");
  if (blockedReasons.length) return { ok: false, applied: false, session, actor, blockedReasons, error: blockedReasons[0] };
  const appliedBy = userRecord(options);
  const appliedRecord = { ...record, status: "applied", appliedAt: nowIso(options), appliedByUserId: appliedBy.id, appliedByUserName: appliedBy.name, playerSafe: { id: record.id, name: record.name, pressureType: record.pressureType, severity: record.severity, category: record.category, text: record.playerText, repairRequirement: record.repairRequirement, status: "applied" } };
  const actorRecords = Array.from(new Map([...existing, appliedRecord].map((entry) => [stableId(entry), entry])).values());
  const updateData = { [`flags.${MODULE_ID}.system.travelV2.shipScars`]: { version: TRAVEL_V2_SHIP_SCARS_VERSION, records: actorRecords } };
  await (options.updateActor ?? ((target, data) => target.update(data)))(actor, updateData);
  const records = state.records.map((entry) => entry.id === record.id ? appliedRecord : entry);
  return { ok: true, applied: true, session: { ...cloneData(session), shipScars: { ...state, records } }, actor, updateData, scarRecord: appliedRecord, blockedReasons: [] };
}

export async function repairTravelV2ShipScarOnActor(session, actor, scarRecordId, options = {}) {
  const blockedReasons = [];
  if (!userIsGm(options)) blockedReasons.push("Only a GM can repair Ship Scars.");
  if (!isSupportedActor(actor)) blockedReasons.push("A PF2E vehicle / Arcflight ship actor is required.");
  const repairedAt = nowIso(options);
  const actorRecords = actorShipScars(actor).map((record) => record.id === scarRecordId ? { ...record, status: "repaired", repairedAt, playerSafe: { ...(record.playerSafe ?? {}), status: "repaired" } } : record);
  if (!actorRecords.some((record) => record.id === scarRecordId && record.status === "repaired")) blockedReasons.push("Applied Ship Scar was not found on this ship.");
  if (blockedReasons.length) return { ok: false, repaired: false, session, actor, blockedReasons, error: blockedReasons[0] };
  const updateData = { [`flags.${MODULE_ID}.system.travelV2.shipScars`]: { version: TRAVEL_V2_SHIP_SCARS_VERSION, records: actorRecords } };
  await (options.updateActor ?? ((target, data) => target.update(data)))(actor, updateData);
  const sessionResult = setTravelV2ShipScarSessionStatus(session, scarRecordId, "repaired", options);
  return { ok: true, repaired: true, session: sessionResult.session, actor, updateData, blockedReasons: [] };
}

export function prepareTravelV2ShipScarsPanelState(session) {
  const state = normalizeTravelV2ShipScarsState(session?.shipScars ?? session?.travelV2ShipScars);
  const records = state.records.map((record) => ({ ...record, statusLabel: record.status[0].toUpperCase() + record.status.slice(1), canApply: record.status === "pending", canDismiss: record.status === "pending", canRepair: record.status === "applied" }));
  return { ...state, records, pending: records.filter((r) => r.status === "pending"), applied: records.filter((r) => r.status === "applied"), repaired: records.filter((r) => r.status === "repaired"), dismissed: records.filter((r) => r.status === "dismissed"), hasRecords: records.length > 0, footerText: "Ship Scar draws are session-local. No actor, item, chat, journal, combat, or socket changes happen until the GM explicitly applies a scar to the selected ship." };
}
