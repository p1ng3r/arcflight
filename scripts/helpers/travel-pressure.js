import { ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_ROUND_OUTCOMES, ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";

export const ARCFLIGHT_TRAVEL_PRESSURE_TRACKS = Object.freeze({
  STRAIN: ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
  LIFEVEIL: ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL,
  MORALE: ARCFLIGHT_TRAVEL_RESOURCES.MORALE
});

export const ARCFLIGHT_TRAVEL_PRESSURE_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_PRESSURE_TRACKS));
export const ARCFLIGHT_TRAVEL_STATION_ACTIONS = Object.freeze({
  EVENT_APPROACH: "eventApproach",
  STABILIZE: "stabilize"
});

const STATION_STABILIZE_PRESSURE = Object.freeze({
  [ARCFLIGHT_TRAVEL_STATIONS.CAPTAIN]: ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.MORALE,
  [ARCFLIGHT_TRAVEL_STATIONS.NAVIGATOR]: ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.STRAIN,
  [ARCFLIGHT_TRAVEL_STATIONS.ENGINEER]: ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.STRAIN,
  [ARCFLIGHT_TRAVEL_STATIONS.VEILWARDEN]: ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.LIFEVEIL,
  [ARCFLIGHT_TRAVEL_STATIONS.WATCHMASTER]: ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.MORALE
});

export const ARCFLIGHT_TRAVEL_PRESSURE_MIN = 0;
export const ARCFLIGHT_TRAVEL_PRESSURE_MAX = 5;
export const ARCFLIGHT_TRAVEL_PRESSURE_FALLOUT_RESET = 3;

export const ARCFLIGHT_TRAVEL_PRESSURE_STATES = Object.freeze({
  STABLE: "stable",
  WARNING: "warning",
  PRESSURED: "pressured",
  STRESSED: "stressed",
  SEVERE: "severe",
  CRISIS: "crisis"
});

export const ARCFLIGHT_TRAVEL_PRESSURE_STATE_LABELS = Object.freeze({
  [ARCFLIGHT_TRAVEL_PRESSURE_STATES.STABLE]: "Stable",
  [ARCFLIGHT_TRAVEL_PRESSURE_STATES.WARNING]: "Warning",
  [ARCFLIGHT_TRAVEL_PRESSURE_STATES.PRESSURED]: "Pressured",
  [ARCFLIGHT_TRAVEL_PRESSURE_STATES.STRESSED]: "Stressed",
  [ARCFLIGHT_TRAVEL_PRESSURE_STATES.SEVERE]: "Severe",
  [ARCFLIGHT_TRAVEL_PRESSURE_STATES.CRISIS]: "Crisis"
});

export const ARCFLIGHT_TRAVEL_PRESSURE_STATE_RULES = Object.freeze({
  0: Object.freeze({ state: ARCFLIGHT_TRAVEL_PRESSURE_STATES.STABLE, label: ARCFLIGHT_TRAVEL_PRESSURE_STATE_LABELS.stable, description: "No meaningful pressure is present." }),
  1: Object.freeze({ state: ARCFLIGHT_TRAVEL_PRESSURE_STATES.WARNING, label: ARCFLIGHT_TRAVEL_PRESSURE_STATE_LABELS.warning, description: "Narrative warning only; the table can see danger building." }),
  2: Object.freeze({ state: ARCFLIGHT_TRAVEL_PRESSURE_STATES.PRESSURED, label: ARCFLIGHT_TRAVEL_PRESSURE_STATE_LABELS.pressured, description: "Pressure is noticeable but still manageable." }),
  3: Object.freeze({ state: ARCFLIGHT_TRAVEL_PRESSURE_STATES.STRESSED, label: ARCFLIGHT_TRAVEL_PRESSURE_STATE_LABELS.stressed, description: "Mechanical penalties or station complications may begin." }),
  4: Object.freeze({ state: ARCFLIGHT_TRAVEL_PRESSURE_STATES.SEVERE, label: ARCFLIGHT_TRAVEL_PRESSURE_STATE_LABELS.severe, description: "Systems, crew, or wards are disrupted until pressure drops." }),
  5: Object.freeze({ state: ARCFLIGHT_TRAVEL_PRESSURE_STATES.CRISIS, label: ARCFLIGHT_TRAVEL_PRESSURE_STATE_LABELS.crisis, description: "Draw Fallout and attach a lasting ship condition." })
});

export const ARCFLIGHT_TRAVEL_PRESSURE_IDENTITIES = Object.freeze({
  [ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.STRAIN]: Object.freeze({
    key: ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.STRAIN,
    label: "Strain",
    summary: "Ship, hull, Arkengine, hard movement, and system stress.",
    falloutDeck: "strain"
  }),
  [ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.LIFEVEIL]: Object.freeze({
    key: ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.LIFEVEIL,
    label: "Lifeveil",
    summary: "Air, wards, occult contamination, void exposure, and soul-pressure.",
    falloutDeck: "lifeveil"
  }),
  [ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.MORALE]: Object.freeze({
    key: ARCFLIGHT_TRAVEL_PRESSURE_TRACKS.MORALE,
    label: "Morale",
    summary: "Crew discipline, fear, trust, fatigue, and command stability.",
    falloutDeck: "morale"
  })
});

export const ARCFLIGHT_TRAVEL_ROUND_PRESSURE_RESULTS = Object.freeze({
  strongSuccess: Object.freeze({ primary: 0, secondary: 0, flexibleReduction: 1, complication: false }),
  success: Object.freeze({ primary: 0, secondary: 0, flexibleReduction: 0, complication: false }),
  mixed: Object.freeze({ primary: 1, secondary: 0, flexibleReduction: 0, complication: false }),
  failure: Object.freeze({ primary: 1, secondary: 1, flexibleReduction: 0, complication: false }),
  disaster: Object.freeze({ primary: 2, secondary: 1, flexibleReduction: 0, complication: true })
});

export const ARCFLIGHT_TRAVEL_ROUND_OUTCOME_PRESSURE_ALIASES = Object.freeze({
  criticalRoundSuccess: "strongSuccess",
  roundSuccess: "success",
  narrowRoundSuccess: "mixed",
  roundFailure: "failure",
  criticalRoundFailure: "disaster",
  [ARCFLIGHT_TRAVEL_ROUND_OUTCOMES.DOMINANT_SUCCESS]: "success",
  [ARCFLIGHT_TRAVEL_ROUND_OUTCOMES.MIXED]: "mixed",
  [ARCFLIGHT_TRAVEL_ROUND_OUTCOMES.DOMINANT_FAILURE]: "failure",
  [ARCFLIGHT_TRAVEL_ROUND_OUTCOMES.CATASTROPHIC_FAILURE]: "disaster"
});

function numericValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampPressure(value) {
  return Math.min(ARCFLIGHT_TRAVEL_PRESSURE_MAX, Math.max(ARCFLIGHT_TRAVEL_PRESSURE_MIN, Math.trunc(numericValue(value))));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isTravelPressureKey(key) {
  return ARCFLIGHT_TRAVEL_PRESSURE_KEYS.includes(key);
}

export function eventApproach() {
  return { type: ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH, stabilizePressureKey: "" };
}

export function stabilize(pressureKey = "") {
  return {
    type: ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE,
    stabilizePressureKey: isTravelPressureKey(pressureKey) ? pressureKey : ""
  };
}

export function getTravelStationStabilizePressureKey(stationKey, round = {}) {
  return STATION_STABILIZE_PRESSURE[stationKey]
    ?? (isTravelPressureKey(round?.primaryPressure) ? round.primaryPressure : "");
}

export function normalizeTravelStationAction(value = {}, stationKey = "", round = {}) {
  const source = isPlainObject(value) ? value : {};
  if (source.type !== ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE) return eventApproach();
  const pressureKey = isTravelPressureKey(source.stabilizePressureKey)
    ? source.stabilizePressureKey
    : getTravelStationStabilizePressureKey(stationKey, round);
  return stabilize(pressureKey);
}

export function getPendingTravelStabilizeEffect(result, pressureKey) {
  const validPressureKey = isTravelPressureKey(pressureKey) ? pressureKey : "";
  const reduction = result === "criticalSuccess" ? 2 : (result === "success" ? 1 : 0);
  const pressureIncrease = result === "criticalFailure" ? 1 : 0;
  return {
    pressureKey: validPressureKey,
    reduction,
    pressureIncrease,
    complication: result === "criticalFailure",
    pendingDelta: pressureIncrease - reduction
  };
}

export function getTravelPressureIdentity(key) {
  return ARCFLIGHT_TRAVEL_PRESSURE_IDENTITIES[key] ?? null;
}

export function getTravelPressureState(value) {
  const pressure = clampPressure(value);
  return { pressure, ...(ARCFLIGHT_TRAVEL_PRESSURE_STATE_RULES[pressure] ?? ARCFLIGHT_TRAVEL_PRESSURE_STATE_RULES[0]) };
}

export function createEmptyTravelPressureState() {
  return Object.fromEntries(ARCFLIGHT_TRAVEL_PRESSURE_KEYS.map((key) => [key, 0]));
}

export function normalizeTravelPressureState(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(ARCFLIGHT_TRAVEL_PRESSURE_KEYS.map((key) => [key, clampPressure(source[key])]));
}

export function normalizeTravelRoundPressureProfile(round = {}) {
  const primaryPressure = isTravelPressureKey(round?.primaryPressure) ? round.primaryPressure : "";
  const secondaryPressure = isTravelPressureKey(round?.secondaryPressure) ? round.secondaryPressure : "";
  const progressTarget = Number.isInteger(Number(round?.progressTarget)) && Number(round.progressTarget) > 0 ? Number(round.progressTarget) : null;
  return { primaryPressure, secondaryPressure, progressTarget };
}

export function normalizeRoundOutcomePressureKey(outcomeKey) {
  if (Object.hasOwn(ARCFLIGHT_TRAVEL_ROUND_PRESSURE_RESULTS, outcomeKey)) return outcomeKey;
  return ARCFLIGHT_TRAVEL_ROUND_OUTCOME_PRESSURE_ALIASES[outcomeKey] ?? "mixed";
}

export function getTravelRoundPressureResult(outcomeKey) {
  return ARCFLIGHT_TRAVEL_ROUND_PRESSURE_RESULTS[normalizeRoundOutcomePressureKey(outcomeKey)] ?? ARCFLIGHT_TRAVEL_ROUND_PRESSURE_RESULTS.mixed;
}

export function applyTravelPressureChange(pressureState = {}, pressureKey, amount = 0) {
  const normalized = normalizeTravelPressureState(pressureState);
  if (!isTravelPressureKey(pressureKey)) {
    return { pressure: normalized, changes: [], falloutTriggers: [], warnings: [`Invalid pressure key "${String(pressureKey ?? "")}".`] };
  }

  const before = normalized[pressureKey];
  const rawAfter = before + numericValue(amount);
  const after = clampPressure(rawAfter);
  normalized[pressureKey] = after;

  const falloutTriggers = rawAfter >= ARCFLIGHT_TRAVEL_PRESSURE_MAX && before < ARCFLIGHT_TRAVEL_PRESSURE_MAX
    ? [{ pressureKey, before, after, overflow: Math.max(0, rawAfter - ARCFLIGHT_TRAVEL_PRESSURE_MAX) }]
    : [];

  return {
    pressure: normalized,
    changes: [{ pressureKey, before, after, delta: after - before, requestedDelta: numericValue(amount) }],
    falloutTriggers,
    warnings: []
  };
}

export function applyTravelPressureChanges(pressureState = {}, changes = []) {
  let pressure = normalizeTravelPressureState(pressureState);
  const appliedChanges = [];
  const falloutTriggers = [];
  const warnings = [];

  for (const change of Array.isArray(changes) ? changes : []) {
    const pressureKey = typeof change === "string" ? change : change?.pressureKey ?? change?.resource ?? change?.key;
    const amount = typeof change === "string" ? 1 : change?.amount ?? change?.value ?? 0;
    const result = applyTravelPressureChange(pressure, pressureKey, amount);
    pressure = result.pressure;
    appliedChanges.push(...result.changes);
    falloutTriggers.push(...result.falloutTriggers);
    warnings.push(...result.warnings);
  }

  return { pressure, changes: appliedChanges, falloutTriggers, warnings };
}

export function applyTravelRoundOutcomePressure(pressureState = {}, round = {}, outcomeKey = "mixed") {
  const pressure = normalizeTravelPressureState(pressureState);
  const profile = normalizeTravelRoundPressureProfile(round);
  const result = getTravelRoundPressureResult(outcomeKey);
  const changes = [];

  if (profile.primaryPressure && result.primary) changes.push({ pressureKey: profile.primaryPressure, amount: result.primary, source: "primary" });
  if (profile.secondaryPressure && result.secondary) changes.push({ pressureKey: profile.secondaryPressure, amount: result.secondary, source: "secondary" });

  const applied = applyTravelPressureChanges(pressure, changes);
  return {
    ...applied,
    roundPressureKey: normalizeRoundOutcomePressureKey(outcomeKey),
    pressureResult: result,
    profile,
    flexibleReduction: result.flexibleReduction,
    complication: result.complication
  };
}

export function resolveTravelPressureFallout(pressureState = {}, pressureKey) {
  const pressure = normalizeTravelPressureState(pressureState);
  if (!isTravelPressureKey(pressureKey)) return { pressure, fallout: null, warnings: [`Invalid pressure key "${String(pressureKey ?? "")}".`] };
  const before = pressure[pressureKey];
  if (before < ARCFLIGHT_TRAVEL_PRESSURE_MAX) return { pressure, fallout: null, warnings: [] };
  pressure[pressureKey] = ARCFLIGHT_TRAVEL_PRESSURE_FALLOUT_RESET;
  return {
    pressure,
    fallout: {
      pressureKey,
      deck: ARCFLIGHT_TRAVEL_PRESSURE_IDENTITIES[pressureKey]?.falloutDeck ?? pressureKey,
      before,
      after: pressure[pressureKey]
    },
    warnings: []
  };
}
