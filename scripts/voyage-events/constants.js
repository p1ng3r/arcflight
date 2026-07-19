/** Stable identifiers for the declarative Voyage Event alpha data contracts. */
export const VOYAGE_EVENT_SCHEMA_VERSION = 1;
export const VOYAGE_EVENT_PACKAGE_SCHEMA_VERSION = 1;
export const VOYAGE_EVENT_MECHANICS_VERSION = 1;

export const VOYAGE_EVENT_PHASES = Object.freeze({
  SETUP: "setup", OPENING: "opening", ROUND_OPENING: "roundOpening", CREW_PLANNING: "crewPlanning",
  ORDER_LOCK: "orderLock", STATION_RESOLUTION: "stationResolution", ROUND_RESOLUTION: "roundResolution",
  END_ROUND_VIGNETTE: "endRoundVignette", NEXT_ROUND_PREPARATION: "nextRoundPreparation",
  EVENT_RESOLUTION: "eventResolution", AFTERMATH_REVIEW: "aftermathReview", ARCHIVE: "archive"
});

export const VOYAGE_EVENT_STATION_KEYS = Object.freeze(["captain", "engineer", "navigator", "watchmaster", "veilwarden"]);
export const VOYAGE_EVENT_STATION_DEGREES = Object.freeze({ CRITICAL_FAILURE: -2, FAILURE: -1, SUCCESS: 1, CRITICAL_SUCCESS: 2 });
export const VOYAGE_EVENT_ROUND_RESULTS = Object.freeze({ CRITICAL_FAILURE: "criticalFailure", FAILURE: "failure", SUCCESS_AT_COST: "successAtCost", SUCCESS: "success", CRITICAL_SUCCESS: "criticalSuccess" });
export const VOYAGE_EVENT_RESULTS = VOYAGE_EVENT_ROUND_RESULTS;
export const VOYAGE_EVENT_PRESSURE_LANES = Object.freeze(["structure", "engine", "veil", "crew", "stores"]);
export const VOYAGE_EVENT_PRESSURE_THRESHOLDS = Object.freeze({ STABLE_MAX: 1, WARNING: 2, CRISIS: 3, DISASTER: 4, OVERFLOW: 5 });
export const VOYAGE_EVENT_PRESSURE_STATES = Object.freeze({ STABLE: "stable", WARNING: "warning", CRISIS: "crisis", DISASTER: "disaster", OVERFLOW: "overflow" });
export const VOYAGE_EVENT_BID_BANDS = Object.freeze({ NONE: "none", PLUS_2: "plus2", PLUS_5: "plus5", PLUS_8: "plus8" });
export const VOYAGE_EVENT_BID_MODIFIERS = Object.freeze({ none: 0, plus2: 2, plus5: 5, plus8: 8 });
export const VOYAGE_EVENT_NARRATIVE_COMPONENT_TYPES = Object.freeze({ OPENING: "opening", STATION_BEAT: "stationBeat", BID_SUCCESS: "bidSuccess", BID_FAILURE: "bidFailure", CASCADE_BRIDGE: "cascadeBridge", ROUND_CONCLUSION: "roundConclusion", TRANSITION: "transition", FINAL_OUTCOME: "finalOutcome", AFTERMATH: "aftermath" });
export const VOYAGE_EVENT_HAZARD_SEVERITIES = Object.freeze({ MINOR: "minor", SERIOUS: "serious" });
export const VOYAGE_EVENT_STACKING_LIMITS = Object.freeze({ MAX_DC_REDUCTION: 3, MAX_ROLL_TWICE_PER_CHECK: 1, MAX_DEGREE_IMPROVEMENT_PER_RESULT: 1, MAX_ACTIVE_MINOR_HAZARDS: 1, MAX_ACTIVE_SERIOUS_HAZARDS: 1 });
