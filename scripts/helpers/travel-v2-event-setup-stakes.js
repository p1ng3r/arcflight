import { ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";

export const TRAVEL_V2_EVENT_SETUP_STAKES_VERSION = 2;
export const TRAVEL_V2_ALPHA_MIN_ROUND_COUNT = 3;
export const TRAVEL_V2_ALPHA_MAX_ROUND_COUNT = 12;

export const TRAVEL_V2_ALPHA_CORE_STATION_GROUPS = Object.freeze([
  Object.freeze([ARCFLIGHT_TRAVEL_STATIONS.CAPTAIN]),
  Object.freeze([ARCFLIGHT_TRAVEL_STATIONS.NAVIGATOR]),
  Object.freeze([ARCFLIGHT_TRAVEL_STATIONS.ENGINEER, "arkengineer"]),
  Object.freeze([ARCFLIGHT_TRAVEL_STATIONS.VEILWARDEN]),
  Object.freeze([ARCFLIGHT_TRAVEL_STATIONS.WATCHMASTER])
]);

export const FORBIDDEN_PLAYER_SAFE_KEYS = Object.freeze([
  "auditRecord",
  "commitRecords",
  "userId",
  "userName",
  "gmText",
  "applyPayload",
  "targetActorUuid",
  "mutationScope",
  "internalMutation",
  "secret",
  "pendingConsequenceQueue",
  "gmOnly",
  "unrevealedHazard",
  "catalogSuggestions"
]);

export const FORBIDDEN_PLAYER_SAFE_TEXT_VARIANTS = Object.freeze([
  "gm-only",
  "hidden hazard",
  "future trigger",
  "internal scoring",
  "consequence tree",
  "debug report"
]);

function normalizeForbiddenTerm(value) {
  return stringValue(value).toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function trimmedString(value, fallback = "") {
  const text = stringValue(value, fallback).trim();
  return text.length > 0 ? text : fallback;
}

function normalizeStringArray(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function cloneData(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function firstString(source, keys, fallback = "") {
  for (const key of keys) {
    const value = trimmedString(source[key]);
    if (value) return value;
  }
  return fallback;
}

function firstStringArray(source, keys) {
  for (const key of keys) {
    const value = normalizeStringArray(source[key]);
    if (value.length > 0) return value;
  }
  return [];
}

function normalizeStationKey(value) {
  return stringValue(value).trim().toLowerCase();
}

function normalizeStationEntry(entry) {
  if (typeof entry === "string") return normalizeStationKey(entry);
  if (!isPlainObject(entry)) return "";
  return normalizeStationKey(entry.key ?? entry.stationKey ?? entry.slug ?? entry.id ?? entry.name);
}

function normalizeStationList(value = []) {
  const entries = Array.isArray(value)
    ? value
    : isPlainObject(value)
      ? Object.entries(value).filter(([, stationValue]) => stationValue !== false && stationValue != null).map(([key, stationValue]) => {
        if (isPlainObject(stationValue)) return { key, ...stationValue };
        return key;
      })
      : [];
  return [...new Set(entries.map((entry) => normalizeStationEntry(entry)).filter(Boolean))];
}

function readSetupSource(input = {}) {
  const root = isPlainObject(input) ? input : {};
  const event = isPlainObject(root.event) ? root.event : root;
  const setup = isPlainObject(event.setup) ? event.setup : {};
  const stakes = isPlainObject(event.stakes) ? event.stakes : {};
  const player = isPlainObject(event.player) ? event.player : {};
  const gm = isPlainObject(event.gm) ? event.gm : {};
  return { root, event, setup, stakes, player, gm };
}

function getRoundCount({ root, event, setup, stakes }) {
  const raw = event.roundCount ?? setup.roundCount ?? stakes.roundCount ?? root.roundCount;
  const roundCount = Number(raw);
  return Number.isInteger(roundCount) ? roundCount : null;
}

function getAvailableCoreStations({ root, event, setup, stakes }) {
  return normalizeStationList(
    event.availableCoreStations
      ?? event.coreStations
      ?? event.stations
      ?? setup.availableCoreStations
      ?? setup.coreStations
      ?? stakes.availableCoreStations
      ?? root.availableCoreStations
      ?? root.coreStations
      ?? root.stations
  );
}

function validateRoundCount(roundCount) {
  if (!Number.isInteger(roundCount)) return ["round-count-required"];
  if (roundCount < TRAVEL_V2_ALPHA_MIN_ROUND_COUNT) return ["round-count-below-alpha-minimum"];
  if (roundCount > TRAVEL_V2_ALPHA_MAX_ROUND_COUNT) return ["round-count-above-alpha-maximum"];
  return [];
}

function validateCoreStations(stations) {
  const missing = TRAVEL_V2_ALPHA_CORE_STATION_GROUPS
    .filter((group) => !group.some((stationKey) => stations.includes(stationKey)))
    .map((group) => group.join("|"));
  return missing.map((group) => `missing-core-station:${group}`);
}

function includesForbiddenPlayerSafeTerm(value) {
  const text = stringValue(value);
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeForbiddenTerm(text);
  return FORBIDDEN_PLAYER_SAFE_KEYS.some((key) => lowerText.includes(key.toLowerCase()))
    || FORBIDDEN_PLAYER_SAFE_TEXT_VARIANTS.some((variant) => normalizedText.includes(normalizeForbiddenTerm(variant)));
}

function playerSafeText(value) {
  const text = trimmedString(value);
  return includesForbiddenPlayerSafeTerm(text) ? "" : text;
}

function playerSafeStringArray(value = []) {
  return normalizeStringArray(value).filter((entry) => !includesForbiddenPlayerSafeTerm(entry));
}

function firstPlayerSafeString(source, keys, fallback = "") {
  return playerSafeText(firstString(source, keys, fallback));
}

function firstPlayerSafeStringArray(source, keys) {
  return playerSafeStringArray(firstStringArray(source, keys));
}

function buildPlayerSafeSetupData(sources, roundCount, availableCoreStations) {
  const { event, setup, stakes, player } = sources;
  const playerThreatenedResources = firstPlayerSafeStringArray(player, ["threatenedResources", "resources"]);
  const playerKnownDangers = firstPlayerSafeStringArray(player, ["knownDangers", "knownHazards", "suspiciousTells", "knownDangersOrSuspiciousTells"]);
  return {
    eventName: firstPlayerSafeString(player, ["eventName", "name", "title"], firstString(event, ["eventName", "name", "title"])),
    openingPremise: firstPlayerSafeString(player, ["openingPremise", "premise"], firstString(setup, ["openingPremise", "premise"])),
    openingVignette: firstPlayerSafeString(player, ["openingVignette", "vignette"], firstString(setup, ["openingVignette", "vignette"])),
    threatenedResources: playerThreatenedResources.length > 0
      ? playerThreatenedResources
      : firstPlayerSafeStringArray(stakes, ["threatenedResources", "resources"]),
    roundCount,
    knownDangers: playerKnownDangers.length > 0
      ? playerKnownDangers
      : firstPlayerSafeStringArray(stakes, ["knownDangers", "knownHazards", "suspiciousTells", "knownDangersOrSuspiciousTells"]),
    broadSuccessReward: firstPlayerSafeString(player, ["broadSuccessReward", "successReward"], firstString(stakes, ["broadSuccessReward", "successReward"])),
    broadFailureDanger: firstPlayerSafeString(player, ["broadFailureDanger", "failureDanger"], firstString(stakes, ["broadFailureDanger", "failureDanger"])),
    availableCoreStations
  };
}

function buildGmSetupData({ event, setup, stakes, gm }, roundCount, availableCoreStations) {
  return {
    eventKey: trimmedString(event.key),
    roundCount,
    availableCoreStations,
    gmNotes: firstString(gm, ["notes", "gmNotes"], firstString(setup, ["gmNotes"])),
    setupNotes: firstString(gm, ["setupNotes"], firstString(stakes, ["gmSetupNotes", "setupNotes"])),
    hiddenHazards: Array.isArray(gm.hiddenHazards) ? cloneData(gm.hiddenHazards) : [],
    futureTriggers: Array.isArray(gm.futureTriggers) ? cloneData(gm.futureTriggers) : [],
    internalScoring: isPlainObject(gm.internalScoring) ? cloneData(gm.internalScoring) : {}
  };
}

export function prepareTravelV2EventSetupStakesState(input = {}) {
  const sources = readSetupSource(input);
  const roundCount = getRoundCount(sources);
  const availableCoreStations = getAvailableCoreStations(sources);
  const errors = [
    ...validateRoundCount(roundCount),
    ...validateCoreStations(availableCoreStations)
  ];
  const playerSafe = buildPlayerSafeSetupData(sources, roundCount, availableCoreStations);
  const gmFacing = buildGmSetupData(sources, roundCount, availableCoreStations);

  return {
    ok: errors.length === 0,
    version: TRAVEL_V2_EVENT_SETUP_STAKES_VERSION,
    errors,
    playerSafe,
    gmFacing
  };
}

export function travelV2PlayerSafeSetupHasForbiddenKeys(playerSafe = {}) {
  const serialized = JSON.stringify(playerSafe);
  return includesForbiddenPlayerSafeTerm(serialized);
}

export default prepareTravelV2EventSetupStakesState;
