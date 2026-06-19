import { ARCFLIGHT_TRAVEL_EVENT_CATEGORIES, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";

export const TRAVEL_V2_STATE_VERSION = 2;
export const TRAVEL_V2_DEFAULT_EVENT_CHANCE = 18;
export const TRAVEL_V2_DEFAULT_EVENT_LEVEL = 1;
export const TRAVEL_V2_DEFAULT_EVENT_ROUND_COUNT = 3;
export const TRAVEL_V2_DEFAULT_MOMENTUM_MAX = 3;
export const TRAVEL_V2_DEFAULT_STATION_FOCUS_MAX = 1;
export const TRAVEL_V2_PRESSURE_MAX = 4;

export const TRAVEL_V2_PRESSURE_TRACK_KEYS = Object.freeze([
  ARCFLIGHT_TRAVEL_RESOURCES.HULL,
  ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
  ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL,
  ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
  ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES
]);

export const TRAVEL_V2_STATION_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_STATIONS));
export const TRAVEL_V2_PRESSURE_THRESHOLDS = Object.freeze([2, 3, 4]);
export const TRAVEL_V2_HAZARD_DRAW_COUNT_BY_THRESHOLD = Object.freeze({ 2: 1, 3: 2, 4: 3 });
export const TRAVEL_V2_SEVERITIES = Object.freeze(["low", "moderate", "severe", "extreme"]);
export const TRAVEL_V2_ROUND_PHASES = Object.freeze(["setup", "orders", "rolls", "reactions", "resolution", "complete"]);

const DEFAULT_PRESSURE_TYPE = ARCFLIGHT_TRAVEL_RESOURCES.STRAIN;
const DEFAULT_PRESSURE_STATION = ARCFLIGHT_TRAVEL_STATIONS.ENGINEER;
const DEFAULT_EVENT_CATEGORY = ARCFLIGHT_TRAVEL_EVENT_CATEGORIES.NAVIGATION;

function cloneData(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
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

function integerValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  return Math.min(Math.max(integerValue(value, fallback), minimum), maximum);
}

function normalizeStringArray(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeObjectRecord(value = {}) {
  return isPlainObject(value) ? cloneData(value) : {};
}

function normalizeSeverity(value, fallback = "moderate") {
  const normalized = stringValue(value).trim().toLowerCase();
  return TRAVEL_V2_SEVERITIES.includes(normalized) ? normalized : fallback;
}

function normalizeRoundPhase(value, fallback = "setup") {
  const normalized = stringValue(value).trim().toLowerCase();
  return TRAVEL_V2_ROUND_PHASES.includes(normalized) ? normalized : fallback;
}

export function isTravelV2PressureTrackKey(pressureType) {
  return TRAVEL_V2_PRESSURE_TRACK_KEYS.includes(pressureType);
}

export function isTravelV2StationKey(stationKey) {
  return TRAVEL_V2_STATION_KEYS.includes(stationKey);
}

export function normalizeTravelV2PressureType(pressureType, fallback = DEFAULT_PRESSURE_TYPE) {
  return isTravelV2PressureTrackKey(pressureType) ? pressureType : fallback;
}

export function normalizeTravelV2StationKey(stationKey, fallback = DEFAULT_PRESSURE_STATION) {
  return isTravelV2StationKey(stationKey) ? stationKey : fallback;
}

export function createTravelV2ShipState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    actorId: stringValue(source.actorId),
    actorUuid: stringValue(source.actorUuid),
    name: stringValue(source.name)
  };
}

export function createTravelV2DailyCheckState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const rollTotal = source.rollTotal === null || source.rollTotal === undefined || source.rollTotal === ""
    ? null
    : integerValue(source.rollTotal, null);
  return {
    hexKey: stringValue(source.hexKey),
    travelDay: Math.max(1, integerValue(source.travelDay, 1)),
    eventChance: clampInteger(source.eventChance, 1, 20, TRAVEL_V2_DEFAULT_EVENT_CHANCE),
    rolled: source.rolled === true,
    rollTotal,
    eventTriggered: source.eventTriggered === true,
    override: source.override === true,
    categoryTableKey: stringValue(source.categoryTableKey),
    selectedEventKey: stringValue(source.selectedEventKey)
  };
}

export function createTravelV2EventState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const category = Object.values(ARCFLIGHT_TRAVEL_EVENT_CATEGORIES).includes(source.category)
    ? source.category
    : DEFAULT_EVENT_CATEGORY;
  return {
    key: stringValue(source.key),
    title: stringValue(source.title),
    level: Math.max(1, integerValue(source.level, TRAVEL_V2_DEFAULT_EVENT_LEVEL)),
    severity: normalizeSeverity(source.severity),
    category,
    tags: normalizeStringArray(source.tags),
    roundCount: clampInteger(source.roundCount, 3, 9, TRAVEL_V2_DEFAULT_EVENT_ROUND_COUNT)
  };
}

export function createTravelV2RoundState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const index = Math.max(0, integerValue(source.index, 0));
  return {
    index,
    number: Math.max(1, integerValue(source.number, index + 1)),
    phase: normalizeRoundPhase(source.phase),
    vignette: stringValue(source.vignette),
    hiddenRiskRevealed: source.hiddenRiskRevealed === true,
    ordersLocked: source.ordersLocked === true,
    rollsRequested: source.rollsRequested === true,
    resolved: source.resolved === true
  };
}

export function createTravelV2HiddenRiskState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    pressureType: normalizeTravelV2PressureType(source.pressureType),
    failureIncrease: Math.max(0, integerValue(source.failureIncrease, 1)),
    criticalFailureIncrease: Math.max(0, integerValue(source.criticalFailureIncrease, 2)),
    pressureStation: normalizeTravelV2StationKey(source.pressureStation),
    revealed: source.revealed === true
  };
}

export function createTravelV2PressureTrackState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const value = clampInteger(source.value, 0, TRAVEL_V2_PRESSURE_MAX, 0);
  const crossed = (Array.isArray(source.crossed) ? source.crossed : [])
    .map((threshold) => Number(threshold))
    .filter((threshold) => TRAVEL_V2_PRESSURE_THRESHOLDS.includes(threshold))
    .filter((threshold, index, array) => array.indexOf(threshold) === index)
    .sort((a, b) => a - b);
  return { value, crossed };
}

export function createTravelV2PressureState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return Object.fromEntries(TRAVEL_V2_PRESSURE_TRACK_KEYS.map((pressureType) => [pressureType, createTravelV2PressureTrackState(source[pressureType])]));
}

export function createTravelV2FocusState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return Object.fromEntries(TRAVEL_V2_STATION_KEYS.map((stationKey) => {
    const stationSource = isPlainObject(source[stationKey]) ? source[stationKey] : {};
    const max = Math.max(0, integerValue(stationSource.max, TRAVEL_V2_DEFAULT_STATION_FOCUS_MAX));
    const value = clampInteger(stationSource.value, 0, max, max);
    return [stationKey, {
      value,
      max,
      spent: Array.isArray(stationSource.spent) ? cloneData(stationSource.spent) : []
    }];
  }));
}

export function createTravelV2MomentumState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const max = Math.max(0, integerValue(source.max, TRAVEL_V2_DEFAULT_MOMENTUM_MAX));
  return {
    value: clampInteger(source.value, 0, max, 0),
    max,
    spentThisRound: Array.isArray(source.spentThisRound) ? cloneData(source.spentThisRound) : []
  };
}

export function createTravelV2HazardCardState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    key: stringValue(source.key),
    name: stringValue(source.name),
    pressureType: normalizeTravelV2PressureType(source.pressureType),
    severity: normalizeSeverity(source.severity, "low"),
    flavorText: stringValue(source.flavorText),
    mechanicalText: stringValue(source.mechanicalText),
    visibility: stringValue(source.visibility, "public"),
    clearCondition: stringValue(source.clearCondition),
    effectMode: stringValue(source.effectMode, "manual"),
    structuredEffects: Array.isArray(source.structuredEffects) ? cloneData(source.structuredEffects) : []
  };
}

export function createTravelV2HazardDrawRequest(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    pressureType: normalizeTravelV2PressureType(source.pressureType),
    threshold: Number(TRAVEL_V2_PRESSURE_THRESHOLDS.includes(Number(source.threshold)) ? Number(source.threshold) : 2),
    count: Math.max(0, integerValue(source.count, 1)),
    reason: stringValue(source.reason, "threshold-crossing"),
    roundNumber: source.roundNumber == null ? null : Math.max(1, integerValue(source.roundNumber, 1))
  };
}

export function createTravelV2HazardState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    active: (Array.isArray(source.active) ? source.active : []).map((entry) => createTravelV2HazardCardState(entry)),
    discarded: (Array.isArray(source.discarded) ? source.discarded : []).map((entry) => createTravelV2HazardCardState(entry)),
    pendingDraws: (Array.isArray(source.pendingDraws) ? source.pendingDraws : []).map((entry) => createTravelV2HazardDrawRequest(entry))
  };
}

export function createTravelV2ShipScarState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    key: stringValue(source.key),
    name: stringValue(source.name),
    pressureType: normalizeTravelV2PressureType(source.pressureType),
    flavorText: stringValue(source.flavorText),
    mechanicalEffect: stringValue(source.mechanicalEffect),
    repairRequirement: stringValue(source.repairRequirement),
    downtimeRequirement: stringValue(source.downtimeRequirement),
    costRequirement: stringValue(source.costRequirement),
    roleplayHook: stringValue(source.roleplayHook),
    source: stringValue(source.source),
    roundNumber: source.roundNumber == null ? null : Math.max(1, integerValue(source.roundNumber, 1)),
    overflowAmount: Math.max(0, integerValue(source.overflowAmount, 0))
  };
}

export function createTravelV2ShipScarsState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    pending: (Array.isArray(source.pending) ? source.pending : []).map((entry) => createTravelV2ShipScarState(entry)),
    applied: (Array.isArray(source.applied) ? source.applied : []).map((entry) => createTravelV2ShipScarState(entry))
  };
}

export function createTravelV2VoidFortuneCardState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    key: stringValue(source.key),
    name: stringValue(source.name),
    type: stringValue(source.type, "burn"),
    text: stringValue(source.text),
    visibility: stringValue(source.visibility, "public"),
    structuredEffects: Array.isArray(source.structuredEffects) ? cloneData(source.structuredEffects) : []
  };
}

export function createTravelV2VoidFortuneState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    hand: (Array.isArray(source.hand) ? source.hand : []).map((entry) => createTravelV2VoidFortuneCardState(entry)),
    pendingDraws: (Array.isArray(source.pendingDraws) ? source.pendingDraws : []).map((entry) => normalizeObjectRecord(entry)),
    handLimit: Math.max(0, integerValue(source.handLimit, 3)),
    usedThisRound: Array.isArray(source.usedThisRound) ? cloneData(source.usedThisRound) : []
  };
}

export function createTravelV2VoidThreadState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const suggestedFollowUpCategory = Object.values(ARCFLIGHT_TRAVEL_EVENT_CATEGORIES).includes(source.suggestedFollowUpCategory)
    ? source.suggestedFollowUpCategory
    : "";
  return {
    hasVoidThread: source.hasVoidThread === true,
    trigger: stringValue(source.trigger),
    playerFacingText: stringValue(source.playerFacingText),
    gmNotes: stringValue(source.gmNotes),
    suggestedFollowUpCategory,
    suggestedFollowUpLevel: source.suggestedFollowUpLevel == null ? null : Math.max(1, integerValue(source.suggestedFollowUpLevel, 1)),
    suggestedRisks: normalizeStringArray(source.suggestedRisks).filter((entry) => isTravelV2PressureTrackKey(entry)),
    suggestedRewards: normalizeStringArray(source.suggestedRewards),
    urgency: stringValue(source.urgency, "optional")
  };
}

export function createTravelV2VoidThreadsState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    offered: (Array.isArray(source.offered) ? source.offered : []).map((entry) => createTravelV2VoidThreadState(entry)),
    chosen: source.chosen == null ? null : createTravelV2VoidThreadState(source.chosen)
  };
}

export function createTravelV2StationOrdersState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return Object.fromEntries(TRAVEL_V2_STATION_KEYS.map((stationKey) => [stationKey, normalizeObjectRecord(source[stationKey])]));
}

export function createTravelV2StationResultsState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return Object.fromEntries(TRAVEL_V2_STATION_KEYS.map((stationKey) => [stationKey, normalizeObjectRecord(source[stationKey])]));
}

export function createTravelV2SessionState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    version: TRAVEL_V2_STATE_VERSION,
    key: trimmedString(source.key),
    ship: createTravelV2ShipState(source.ship),
    dailyCheck: createTravelV2DailyCheckState(source.dailyCheck),
    event: createTravelV2EventState(source.event),
    round: createTravelV2RoundState(source.round),
    hiddenRisk: createTravelV2HiddenRiskState(source.hiddenRisk),
    pressure: createTravelV2PressureState(source.pressure),
    hazards: createTravelV2HazardState(source.hazards),
    shipScars: createTravelV2ShipScarsState(source.shipScars),
    focus: createTravelV2FocusState(source.focus),
    momentum: createTravelV2MomentumState(source.momentum),
    stationOrders: createTravelV2StationOrdersState(source.stationOrders),
    stationResults: createTravelV2StationResultsState(source.stationResults),
    voidFortune: createTravelV2VoidFortuneState(source.voidFortune),
    voidThreads: createTravelV2VoidThreadsState(source.voidThreads)
  };
}

export function normalizeTravelV2SessionState(input = {}) {
  return createTravelV2SessionState(input);
}

export function createTravelV2ThresholdCrossings({ pressureType = DEFAULT_PRESSURE_TYPE, fromValue = 0, toValue = 0, crossed = [] } = {}) {
  const startingValue = clampInteger(fromValue, 0, TRAVEL_V2_PRESSURE_MAX, 0);
  const endingValue = clampInteger(toValue, 0, TRAVEL_V2_PRESSURE_MAX, 0);
  const existing = createTravelV2PressureTrackState({ value: startingValue, crossed }).crossed;
  return TRAVEL_V2_PRESSURE_THRESHOLDS
    .filter((threshold) => startingValue < threshold && endingValue >= threshold && !existing.includes(threshold))
    .map((threshold) => ({
      pressureType: normalizeTravelV2PressureType(pressureType),
      threshold,
      hazardDrawCount: TRAVEL_V2_HAZARD_DRAW_COUNT_BY_THRESHOLD[threshold] ?? 0
    }));
}

export function previewTravelV2PressureChange(pressureInput = {}, pressureTypeInput = DEFAULT_PRESSURE_TYPE, deltaInput = 0, options = {}) {
  const pressureType = normalizeTravelV2PressureType(pressureTypeInput);
  const pressure = createTravelV2PressureState(pressureInput);
  const track = pressure[pressureType];
  const delta = integerValue(deltaInput, 0);
  const requestedValue = track.value + delta;
  const nextValue = clampInteger(requestedValue, 0, TRAVEL_V2_PRESSURE_MAX, track.value);
  const thresholdCrossings = delta > 0
    ? createTravelV2ThresholdCrossings({ pressureType, fromValue: track.value, toValue: nextValue, crossed: track.crossed })
    : [];
  const crossed = [...new Set([...track.crossed, ...thresholdCrossings.map((entry) => entry.threshold)])].sort((a, b) => a - b);
  const nextPressure = {
    ...pressure,
    [pressureType]: {
      value: nextValue,
      crossed
    }
  };
  const overflowAmount = delta > 0 ? Math.max(0, requestedValue - TRAVEL_V2_PRESSURE_MAX) : 0;
  const shipScarTrigger = overflowAmount > 0
    ? createTravelV2ShipScarState({
      key: stringValue(options.shipScarKey),
      name: stringValue(options.shipScarName),
      pressureType,
      source: stringValue(options.source, "pressure-overflow"),
      roundNumber: options.roundNumber,
      overflowAmount
    })
    : null;
  const hazardDraws = thresholdCrossings.map((entry) => createTravelV2HazardDrawRequest({
    pressureType,
    threshold: entry.threshold,
    count: entry.hazardDrawCount,
    reason: stringValue(options.reason, "threshold-crossing"),
    roundNumber: options.roundNumber
  }));

  return {
    pressure: nextPressure,
    pressureType,
    previousValue: track.value,
    requestedValue,
    value: nextValue,
    delta,
    thresholdCrossings,
    hazardDraws,
    shipScarTrigger,
    overflowAmount
  };
}

export function applyTravelV2PressureChange(sessionInput = {}, pressureType = DEFAULT_PRESSURE_TYPE, delta = 0, options = {}) {
  const session = normalizeTravelV2SessionState(sessionInput);
  const preview = previewTravelV2PressureChange(session.pressure, pressureType, delta, options);
  return {
    ...session,
    pressure: preview.pressure,
    hazards: {
      ...session.hazards,
      pendingDraws: [...session.hazards.pendingDraws, ...preview.hazardDraws]
    },
    shipScars: {
      ...session.shipScars,
      pending: preview.shipScarTrigger ? [...session.shipScars.pending, preview.shipScarTrigger] : session.shipScars.pending
    }
  };
}

export function resetTravelV2EventPressure(sessionInput = {}) {
  const session = normalizeTravelV2SessionState(sessionInput);
  return {
    ...session,
    pressure: createTravelV2PressureState(),
    hazards: createTravelV2HazardState(),
    momentum: createTravelV2MomentumState({ max: session.momentum.max }),
    focus: createTravelV2FocusState(Object.fromEntries(TRAVEL_V2_STATION_KEYS.map((stationKey) => [stationKey, { max: session.focus[stationKey]?.max ?? TRAVEL_V2_DEFAULT_STATION_FOCUS_MAX }]))),
    stationOrders: createTravelV2StationOrdersState(),
    stationResults: createTravelV2StationResultsState()
  };
}
