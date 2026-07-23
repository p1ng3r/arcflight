/**
 * Data-only constants for the Voyage Encounter domain.
 *
 * This module intentionally has no Foundry dependencies.
 */
export const VOYAGE_ENCOUNTER_SCHEMA_VERSION = 1;

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

export const VOYAGE_ACTION_EXECUTION_MODES = Object.freeze({ CHECK: "check", NO_ROLL: "no-roll" });
export const VOYAGE_CHECK_SOURCE_KINDS = Object.freeze({ CHARACTER: "character", SHIP: "ship", STATION: "station", CREW: "crew", CUSTOM: "custom", NO_ROLL: "no-roll" });
export const VOYAGE_DC_SOURCE_KINDS = Object.freeze({ FIXED: "fixed", LEVEL_BASED: "level-based", ENCOUNTER: "encounter", STAGE: "stage", HAZARD: "hazard", OPPOSED: "opposed", TRACK: "track", GM_ENTERED: "gm-entered" });
export const VOYAGE_CHECK_SECRECY = Object.freeze({ PUBLIC: "public", SECRET: "secret" });
export const VOYAGE_PENDING_CHECK_STATUSES = Object.freeze({ PENDING: "pending", RESOLVED: "resolved" });

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
