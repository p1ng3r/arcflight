/**
 * Data-only constants for the Voyage Encounter domain.
 *
 * This module intentionally has no Foundry dependencies.
 */
export const VOYAGE_ENCOUNTER_SCHEMA_VERSION = 1;
export const VOYAGE_MOMENTUM_START = 0;
export const VOYAGE_MOMENTUM_MIN = 0;
export const VOYAGE_MOMENTUM_MAX = 3;

export const VOYAGE_ENCOUNTER_LIFECYCLE_STATES = Object.freeze({
  DRAFT: "draft",
  CONFIGURATION: "configuration",
  READY: "ready",
  ACTIVE: "active",
  PAUSED: "paused",
  RECOVERY: "recovery",
  COMPLETED_SUCCESS: "completed-success",
  COMPLETED_FAILURE: "completed-failure",
  ABANDONED: "abandoned",
  DISCARDED: "discarded"
});

export const VOYAGE_ROUND_PHASES = Object.freeze({
  SITUATION: "situation",
  CREW_PLANNING: "crew-planning",
  LOCK_READINESS: "lock-readiness",
  RESOLUTION: "resolution",
  CONSEQUENCES: "consequences",
  CLEANUP_ADVANCE: "cleanup-advance"
});

export const VOYAGE_EVENT_RUNNER_STATION_IDS = Object.freeze([
  "captain",
  "engineer",
  "navigator",
  "watchmaster",
  "veilwarden"
]);

export const VOYAGE_EVENT_RUNNER_PRESSURE_SYSTEM_BY_STATION_ID = Object.freeze({
  captain: "crew-morale",
  engineer: "arkengine",
  navigator: "levstone-array",
  watchmaster: "solar-sail-rig",
  veilwarden: "lifeveil"
});

export const VOYAGE_PRESSURE_SYSTEM_BY_STATION_ID = VOYAGE_EVENT_RUNNER_PRESSURE_SYSTEM_BY_STATION_ID;
export const VOYAGE_PRESSURE_SYSTEM_IDS = Object.freeze(Object.values(VOYAGE_PRESSURE_SYSTEM_BY_STATION_ID));
export const VOYAGE_PRESSURE_DEFAULT_VALUE = 0;
export const VOYAGE_PRESSURE_DEFAULT_CAPACITY = 2;
export const VOYAGE_PRESSURE_MAX_CAPACITY = 5;

export const VOYAGE_ACTION_EXECUTION_MODES = Object.freeze({ CHECK: "check", NO_ROLL: "no-roll" });
export const VOYAGE_CHECK_SOURCE_KINDS = Object.freeze({ CHARACTER: "character", SHIP: "ship", STATION: "station", CREW: "crew", CUSTOM: "custom", NO_ROLL: "no-roll" });
export const VOYAGE_DC_SOURCE_KINDS = Object.freeze({ FIXED: "fixed", LEVEL_BASED: "level-based", ENCOUNTER: "encounter", STAGE: "stage", HAZARD: "hazard", OPPOSED: "opposed", TRACK: "track", GM_ENTERED: "gm-entered" });
export const VOYAGE_CHECK_SECRECY = Object.freeze({ PUBLIC: "public", SECRET: "secret" });
export const VOYAGE_PENDING_CHECK_STATUSES = Object.freeze({ PENDING: "pending", RESOLVED: "resolved" });
export const VOYAGE_ACTION_OUTCOME_BRANCHES = Object.freeze({ CRITICAL_FAILURE: "critical-failure", FAILURE: "failure", SUCCESS: "success", CRITICAL_SUCCESS: "critical-success", NO_ROLL: "no-roll" });
export const VOYAGE_ACTION_BRANCH_UNIT_CONTRIBUTIONS = Object.freeze({
  "critical-success": Object.freeze({ successUnits: 2, failureUnits: 0 }),
  success: Object.freeze({ successUnits: 1, failureUnits: 0 }),
  failure: Object.freeze({ successUnits: 0, failureUnits: 1 }),
  "critical-failure": Object.freeze({ successUnits: 0, failureUnits: 2 })
});
export const VOYAGE_ROUND_RESULTS = Object.freeze({
  CRITICAL_SUCCESS: "critical-round-success",
  SUCCESS: "round-success",
  FAILURE: "round-failure",
  CRITICAL_FAILURE: "critical-round-failure"
});
export const VOYAGE_CONTROLLED_EFFECT_INTENT_TYPES = Object.freeze({ DC_CHANGE: "dc-change", ROLL_MODIFIER: "roll-modifier", RESULT_DEGREE_SHIFT: "result-degree-shift", REROLL: "reroll", ROLL_TWICE: "roll-twice", FOCUS_RESTORATION: "focus-restoration", PRESSURE_CHANGE: "pressure-change", HAZARD_CREATE: "hazard-create", HAZARD_REMOVE: "hazard-remove", HAZARD_PREVENT: "hazard-prevent", HAZARD_SUPPRESS: "hazard-suppress", STATION_ORDER_CHANGE: "station-order-change", SYSTEM_REPAIR: "system-repair", SYSTEM_PROTECTION: "system-protection" });
export const VOYAGE_EFFECT_INTENT_TYPES = Object.freeze({ TRACK_CHANGE: "track-change", TEMPORARY_CONSEQUENCE: "temporary-consequence", PERMANENT_CONSEQUENCE_PROPOSAL: "permanent-consequence-proposal", DISCOVERY: "discovery", SETBACK: "setback", TEMPORARY_MODIFIER: "temporary-modifier", STAGE_OUTCOME: "stage-outcome", ENCOUNTER_OUTCOME: "encounter-outcome", ...VOYAGE_CONTROLLED_EFFECT_INTENT_TYPES });
export const VOYAGE_EFFECT_INTENT_TIMING = Object.freeze({ CONSEQUENCES: "consequences", GM_CONFIRMED: "gm-confirmed", END_OF_ROUND: "end-of-round" });
export const VOYAGE_EFFECT_INTENT_VISIBILITY = Object.freeze({ PUBLIC: "public", GM_SECRET: "gm-secret" });
export const VOYAGE_EFFECT_TARGET_KINDS = Object.freeze({ ENCOUNTER: "encounter", CURRENT_STAGE: "current-stage", PRIMARY_SHIP: "primary-ship", SOURCE_STATION: "source-station", SELECTED_TARGET: "selected-target", TRACK: "track", PARTICIPANT: "participant", STATION: "station", PRESSURE_SYSTEM: "pressure-system", HAZARD: "hazard" });

export const VOYAGE_HAZARD_CATEGORIES = Object.freeze({
  SYSTEM: "system",
  EVENT: "event"
});

export const VOYAGE_HAZARD_STATUSES = Object.freeze({
  ACTIVE: "active",
  RESOLVED: "resolved",
  EXPIRED: "expired",
  REPLACED: "replaced"
});

export const VOYAGE_HAZARD_VISIBILITY = Object.freeze({
  PUBLIC: "public",
  GM_SECRET: "gm-secret"
});

export const VOYAGE_HAZARD_TIMING_KINDS = Object.freeze({
  IMMEDIATE: "immediate",
  BEFORE_NEXT_STATION: "before-next-station",
  START_OF_NEXT_ROUND: "start-of-next-round",
  END_OF_ROUND: "end-of-round",
  NAMED_STATION_ACTIVATION: "named-station-activation",
  SPECIFIED_RESULT: "specified-result",
  EVENT_CLOSEOUT: "event-closeout"
});

export const VOYAGE_HAZARD_COLLISION_POLICIES = Object.freeze({
  ESCALATE_EXISTING: "escalate-existing",
  REPLACE_EXISTING: "replace-existing",
  TRIGGER_EXISTING_CONSEQUENCE: "trigger-existing-consequence",
  EXTEND_DURATION: "extend-duration",
  ADD_PRESSURE: "add-pressure"
});

export const VOYAGE_HAZARD_ESCALATION_MODES = Object.freeze({
  NONE: "none",
  STAGES: "stages",
  COUNTDOWN: "countdown"
});

export const VOYAGE_HAZARD_DURATION_MODES = Object.freeze({
  NONE: "none",
  ROUNDS: "rounds",
  ACTIVATIONS: "activations"
});

export const VOYAGE_HAZARD_EVENT_TYPES = Object.freeze({
  CREATED: "voyage.hazard-created",
  ESCALATED: "voyage.hazard-escalated",
  REPLACED: "voyage.hazard-replaced",
  CONSEQUENCE_TRIGGERED: "voyage.hazard-consequence-triggered",
  DURATION_EXTENDED: "voyage.hazard-duration-extended",
  RESOLVED: "voyage.hazard-resolved",
  EXPIRED: "voyage.hazard-expired",
  CLOSEOUT_CONSEQUENCE_APPLIED: "voyage.hazard-closeout-consequence-applied"
});

export const VOYAGE_TRACK_VISIBILITY = Object.freeze({
  EXACT: "exact",
  DESCRIPTIVE: "descriptive",
  EXISTENCE_ONLY: "existence-only",
  HIDDEN: "hidden"
});

export const VOYAGE_THRESHOLD_TIMING = Object.freeze({
  IMMEDIATE: "immediate",
  GM_CONFIRMED: "gm-confirmed",
  CONSEQUENCES: "consequences",
  END_OF_ROUND: "end-of-round"
});

export const VOYAGE_THRESHOLD_RECURRENCE = Object.freeze({
  ONCE_PER_ENCOUNTER: "once-per-encounter",
  ONCE_PER_STAGE: "once-per-stage",
  ONCE_PER_ROUND: "once-per-round",
  EVERY_VALID_CROSSING: "every-valid-crossing"
});

export const VOYAGE_TRACK_LIMIT_BEHAVIOR = Object.freeze({
  CLAMP: "clamp",
  ALLOW_OVERFLOW: "allow-overflow",
  REJECT: "reject",
  CONVERT_OVERFLOW: "convert-overflow"
});

export const VOYAGE_PERMANENT_CONSEQUENCE_STATUSES = Object.freeze({
  PROPOSED: "proposed",
  APPROVED: "approved",
  COMMITTING: "committing",
  COMMITTED: "committed",
  CANCELLED: "cancelled",
  COMMIT_FAILED: "commit-failed"
});

export const VOYAGE_PERMANENT_CONSEQUENCE_COMMITMENT_TIMING = Object.freeze({
  IMMEDIATE: "immediate",
  FINALIZATION: "finalization"
});

export const INACTIVE_VOYAGE_ROUND_VALUE = null;
