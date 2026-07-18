import { getStation } from "../../data/stations/core-stations.js";
import { getCoreStationAction } from "../../data/station-actions/core-station-actions.js";
import { prepareTravelV2StationActionPlanningGate } from "./travel-v2-station-action-planning-gate.js";

export const TRAVEL_V2_STATION_ACTION_LOCK_IN_STATE_VERSION = 1;
export const TRAVEL_V2_STATION_ACTION_LOCK_IN_STATE_KEY = "travelV2StationActionLockIn";
export const TRAVEL_V2_ALPHA_CORE_STATION_KEYS = Object.freeze(["captain", "navigator", "engineer", "veilwarden", "watchmaster"]);

const STATION_ALIASES = Object.freeze({ arkengineer: "engineer" });
const FORBIDDEN_PLAYER_SAFE_KEYS = Object.freeze([
  "auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions",
  "hiddenHazards", "gmNotes", "consequenceQueues", "riskBidOutcomes", "focusBacklash", "internalScoring", "debugData", "futureTriggers", "actorUuid", "mutationData"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStationKey(stationKey) {
  const key = safeString(stationKey).toLowerCase();
  return STATION_ALIASES[key] ?? key;
}

function actionLabelFor(actionKey, action = {}) {
  const catalogAction = getCoreStationAction(actionKey);
  return safeString(action.label) || safeString(action.name) || catalogAction?.name || actionKey;
}

function requiredStationKeysFrom(options = {}) {
  const source = Array.isArray(options.requiredStationKeys) ? options.requiredStationKeys : TRAVEL_V2_ALPHA_CORE_STATION_KEYS;
  return Array.from(new Set(source.map(normalizeStationKey).filter(Boolean)));
}

function stationOrderFrom(source = {}, options = {}) {
  const explicit = Array.isArray(options.stationOrder) ? options.stationOrder : null;
  const sourceOrder = explicit ?? source.stationOrder ?? source.requiredStationKeys ?? source.activeStations ?? Object.keys(source.stations ?? source.actions ?? source.choices ?? source);
  const normalized = Array.isArray(sourceOrder) ? sourceOrder.map((entry) => normalizeStationKey(typeof entry === "string" ? entry : entry?.stationKey)).filter(Boolean) : [];
  if (Array.isArray(options.stationOrder)) return Array.from(new Set(normalized));
  return Array.from(new Set([...normalized, ...requiredStationKeysFrom(options)]));
}

function error(code, stationKey, message) {
  return { code, stationKey, message };
}

function sourceChoices(source = {}) {
  if (isPlainObject(source?.stations)) return source.stations;
  if (isPlainObject(source?.actions)) return source.actions;
  if (isPlainObject(source?.choices)) return source.choices;
  return isPlainObject(source) ? source : {};
}

function normalizeChoice(stationKey, rawChoice) {
  const raw = isPlainObject(rawChoice) ? rawChoice : { actionKey: rawChoice };
  const actionKey = safeString(raw.actionKey ?? raw.key ?? raw.actionKey ?? raw.action?.actionKey ?? raw.action?.key ?? raw.action ?? raw.type);
  if (!actionKey) return { action: null, locked: raw.locked === true };
  return {
    action: {
      actionKey,
      label: actionLabelFor(actionKey, raw),
      stationKey
    },
    locked: raw.locked === true
  };
}

function validateState(state, requiredStationKeys = TRAVEL_V2_ALPHA_CORE_STATION_KEYS) {
  const errors = [];
  const required = new Set(requiredStationKeys);
  for (const stationKey of state.stationOrder) {
    if (!getStation(stationKey)) errors.push(error("invalidStationKey", stationKey, `Station key is not valid for Travel v2: ${stationKey}.`));
  }
  for (const stationKey of required) {
    const row = state.stations[stationKey];
    if (!row) errors.push(error("missingRequiredStation", stationKey, `Required station is missing: ${stationKey}.`));
    else if (!row.action) errors.push(error("missingStationAction", stationKey, `Required station has no selected action: ${stationKey}.`));
    else if (!row.locked) errors.push(error("stationActionUnlocked", stationKey, `Required station action is not locked: ${stationKey}.`));
  }
  return errors;
}

function blockedPlanningGateState(gate) {
  return deepFreeze({
    ok: false,
    blocked: true,
    blockedByPlanningGate: true,
    reasonCode: gate?.reasonCode ?? "",
    planningGate: gate ?? null,
    session: null,
    playerSafe: true,
    readOnly: true
  });
}

function missingSessionPlanningGate(stationKey = "") {
  return deepFreeze({
    allowed: false,
    blocked: true,
    reasonCode: "missing-session",
    stationKey,
    playerSafe: true,
    readOnly: true
  });
}

function hasCanonicalTravelV2StationActionSessionShape(session = null) {
  if (!isPlainObject(session) || !Number.isInteger(session.currentRoundIndex) || !Array.isArray(session.event?.rounds) || !Array.isArray(session.roundResults)) return false;
  const round = session.event.rounds[session.currentRoundIndex];
  const roundResult = session.roundResults[session.currentRoundIndex];
  const roundNumber = round?.roundNumber ?? round?.number ?? round?.round;
  return isPlainObject(round) && isPlainObject(roundResult) && Number.isInteger(roundNumber) && roundNumber > 0;
}

function planningGateForOptions(options = {}, stationKey = "") {
  if (!isPlainObject(options) || !hasCanonicalTravelV2StationActionSessionShape(options.session)) return missingSessionPlanningGate(stationKey);
  return prepareTravelV2StationActionPlanningGate(options.session, stationKey);
}

export function normalizeTravelV2StationActionChoices(source = {}, options = {}) {
  const requiredStationKeys = requiredStationKeysFrom(options);
  const choices = sourceChoices(source);
  const stationOrder = stationOrderFrom(source, { ...options, requiredStationKeys });
  const stations = {};
  const validationErrors = [];

  for (const originalKey of Object.keys(choices)) {
    const stationKey = normalizeStationKey(originalKey);
    if (!stationKey || !getStation(stationKey)) validationErrors.push(error("invalidStationKey", stationKey || originalKey, `Station key is not valid for Travel v2: ${stationKey || originalKey}.`));
  }

  for (const stationKey of stationOrder) {
    const rawChoice = choices[stationKey] ?? choices[Object.keys(STATION_ALIASES).find((alias) => STATION_ALIASES[alias] === stationKey)];
    const choice = normalizeChoice(stationKey, rawChoice ?? {});
    stations[stationKey] = { stationKey, action: choice.action, locked: choice.locked };
  }

  const state = {
    version: TRAVEL_V2_STATION_ACTION_LOCK_IN_STATE_VERSION,
    requiredStationKeys,
    stationOrder,
    stations,
    allRequiredLocked: false,
    readyToResolve: false,
    validationErrors: []
  };
  const errors = [...validationErrors, ...validateState(state, requiredStationKeys).filter((entry) => entry.code !== "stationActionUnlocked")];
  state.allRequiredLocked = requiredStationKeys.every((stationKey) => Boolean(stations[stationKey]?.action && stations[stationKey]?.locked));
  state.readyToResolve = errors.length === 0 && state.allRequiredLocked;
  state.validationErrors = state.readyToResolve ? [] : [...errors, ...validateState(state, requiredStationKeys).filter((entry) => entry.code === "stationActionUnlocked")];
  return deepFreeze(state);
}

export function selectTravelV2StationAction(state, stationKey, actionChoice, options = {}) {
  const gate = planningGateForOptions(options, stationKey);
  if (gate?.blocked) return blockedPlanningGateState(gate);
  const normalized = normalizeTravelV2StationActionChoices(state);
  const key = normalizeStationKey(stationKey);
  if (!getStation(key)) return { ...normalized, validationErrors: [...normalized.validationErrors, error("invalidStationKey", key, `Station key is not valid for Travel v2: ${key}.`)] };
  if (normalized.stations[key]?.locked) return normalized;
  const next = cloneData(normalized);
  if (!next.stationOrder.includes(key)) next.stationOrder.push(key);
  next.stations[key] = { stationKey: key, ...normalizeChoice(key, actionChoice), locked: false };
  return normalizeTravelV2StationActionChoices(next, { requiredStationKeys: next.requiredStationKeys, stationOrder: next.stationOrder });
}

export function lockTravelV2StationAction(state, stationKey, options = {}) {
  const gate = planningGateForOptions(options, stationKey);
  if (gate?.blocked) return blockedPlanningGateState(gate);
  const normalized = normalizeTravelV2StationActionChoices(state);
  const key = normalizeStationKey(stationKey);
  const next = cloneData(normalized);
  if (next.stations[key]) next.stations[key].locked = Boolean(next.stations[key].action);
  return normalizeTravelV2StationActionChoices(next, { requiredStationKeys: next.requiredStationKeys, stationOrder: next.stationOrder });
}

export function unlockTravelV2StationAction(state, stationKey, { allowUnlock = false, session = null } = {}) {
  const gate = planningGateForOptions({ session }, stationKey);
  if (gate?.blocked) return blockedPlanningGateState(gate);
  const normalized = normalizeTravelV2StationActionChoices(state);
  if (!allowUnlock) return normalized;
  const key = normalizeStationKey(stationKey);
  const next = cloneData(normalized);
  if (next.stations[key]) next.stations[key].locked = false;
  return normalizeTravelV2StationActionChoices(next, { requiredStationKeys: next.requiredStationKeys, stationOrder: next.stationOrder });
}

export function checkTravelV2StationActionLockInReady(state) {
  const normalized = normalizeTravelV2StationActionChoices(state);
  const resolutionErrors = normalized.readyToResolve ? [] : [error("resolveBeforeLockIn", "", "Cannot resolve Travel v2 round before all required station actions are selected and locked.")];
  return deepFreeze({ ready: normalized.readyToResolve, allRequiredLocked: normalized.allRequiredLocked, validationErrors: [...normalized.validationErrors, ...resolutionErrors] });
}

export function preparePlayerSafeTravelV2StationActionLockState(state) {
  const normalized = normalizeTravelV2StationActionChoices(state);
  const stations = normalized.stationOrder.map((stationKey) => ({ stationKey, action: normalized.stations[stationKey]?.action ?? null, locked: normalized.stations[stationKey]?.locked === true }));
  return deepFreeze({ version: normalized.version, requiredStationKeys: normalized.requiredStationKeys, stationOrder: normalized.stationOrder, stations, allRequiredLocked: normalized.allRequiredLocked, readyToResolve: normalized.readyToResolve, validationErrors: normalized.validationErrors });
}

export function prepareGmTravelV2StationActionLockState(state) {
  const normalized = normalizeTravelV2StationActionChoices(state);
  return deepFreeze({ ...cloneData(normalized), stateKey: TRAVEL_V2_STATION_ACTION_LOCK_IN_STATE_KEY });
}

export function playerSafeTravelV2StationActionLockStateHasForbiddenKeys(state) {
  const text = JSON.stringify(state ?? {});
  return FORBIDDEN_PLAYER_SAFE_KEYS.some((key) => text.includes(key));
}
