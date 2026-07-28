import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ENCOUNTER_SCHEMA_VERSION,
  VOYAGE_PERMANENT_CONSEQUENCE_COMMITMENT_TIMING,
  VOYAGE_PERMANENT_CONSEQUENCE_STATUSES,
  VOYAGE_ROUND_PHASES,
  VOYAGE_THRESHOLD_RECURRENCE,
  VOYAGE_THRESHOLD_TIMING,
  VOYAGE_TRACK_LIMIT_BEHAVIOR,
  VOYAGE_TRACK_VISIBILITY
} from "./constants.js";
import { createDraftVoyageEncounterDefaults, isPlainObject } from "./defaults.js";
import { validateVoyageStationAssignments } from "./station-assignments.js";

const COLLECTION_DEFAULTS = createDraftVoyageEncounterDefaults();
const ROUND_CONTEXT_REQUIRED_STATES = new Set([
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES.PAUSED
]);
const DEFINITION_REQUIRED_STATES = new Set([
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES.READY, ...ROUND_CONTEXT_REQUIRED_STATES,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES.COMPLETED_SUCCESS, VOYAGE_ENCOUNTER_LIFECYCLE_STATES.COMPLETED_FAILURE,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ABANDONED
]);
const SHIP_REQUIRED_STATES = new Set([...DEFINITION_REQUIRED_STATES]);

function issue(list, severity, code, path, message) {
  list.push({ code, path, message, severity });
}

function isEnumValue(value, enumValues) {
  return Object.values(enumValues).includes(value);
}

function nonEmptyId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateDistinctIds(value, path, idKey, errors) {
  if (!Array.isArray(value)) return;
  const ids = new Set();
  value.forEach((entry, index) => {
    if (!isPlainObject(entry) || !nonEmptyId(entry[idKey])) return;
    if (ids.has(entry[idKey])) issue(errors, "error", "duplicate-id", `${path}[${index}].${idKey}`, `Duplicate ${idKey} "${entry[idKey]}".`);
    ids.add(entry[idKey]);
  });
}

export function validateVoyageEncounterState(value) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(value)) {
    issue(errors, "error", "invalid-state", "$", "Voyage Encounter state must be a plain object.");
    return { valid: false, errors, warnings };
  }

  const state = value;
  if (state.schemaVersion !== VOYAGE_ENCOUNTER_SCHEMA_VERSION) issue(errors, "error", "unsupported-schema-version", "schemaVersion", "Unsupported Voyage Encounter schema version.");
  if (!nonEmptyId(state.encounterId)) issue(errors, "error", "invalid-encounter-id", "encounterId", "Encounter ID must be a non-empty string.");
  if (!isEnumValue(state.lifecycleState, VOYAGE_ENCOUNTER_LIFECYCLE_STATES)) issue(errors, "error", "invalid-lifecycle-state", "lifecycleState", "Lifecycle state is not recognized.");
  if (!Number.isInteger(state.revision) || state.revision < 0) issue(errors, "error", "invalid-revision", "revision", "Revision must be a non-negative integer.");

  for (const [key, defaultValue] of Object.entries(COLLECTION_DEFAULTS)) {
    if (Array.isArray(defaultValue) && !Array.isArray(state[key])) issue(errors, "error", "invalid-collection-type", key, `${key} must be an array.`);
    if (isPlainObject(defaultValue) && !isPlainObject(state[key])) issue(errors, "error", "invalid-collection-type", key, `${key} must be a plain object.`);
  }

  if (DEFINITION_REQUIRED_STATES.has(state.lifecycleState) && !nonEmptyId(state.definitionId) && !isPlainObject(state.definitionRef)) issue(errors, "error", "missing-definition", "definitionId", "This lifecycle state requires a definition ID or definition reference.");
  if (state.primaryShip !== null && !isPlainObject(state.primaryShip)) issue(errors, "error", "invalid-primary-ship", "primaryShip", "Primary ship reference must be a plain object or null.");
  if (SHIP_REQUIRED_STATES.has(state.lifecycleState) && !isPlainObject(state.primaryShip)) issue(errors, "error", "missing-primary-ship", "primaryShip", "This lifecycle state requires a primary ship reference.");

  if (ROUND_CONTEXT_REQUIRED_STATES.has(state.lifecycleState)) {
    if (!isPlainObject(state.currentStage)) issue(errors, "error", "missing-current-stage", "currentStage", "Active and paused encounters require a current stage.");
    if (!Number.isInteger(state.roundNumber) || state.roundNumber <= 0) issue(errors, "error", "invalid-active-round", "roundNumber", "Active and paused encounters require a positive round number.");
    if (!isEnumValue(state.phase, VOYAGE_ROUND_PHASES)) issue(errors, "error", "invalid-active-phase", "phase", "Active and paused encounters require a valid round phase.");
  }

  if (Array.isArray(state.tracks)) state.tracks.forEach((track, index) => {
    if (!isPlainObject(track)) { issue(errors, "error", "invalid-track", `tracks[${index}]`, "Track must be a plain object."); return; }
    if (!isEnumValue(track.visibility, VOYAGE_TRACK_VISIBILITY)) issue(errors, "error", "invalid-track-visibility", `tracks[${index}].visibility`, "Track visibility is not recognized.");
    if (!isEnumValue(track.limitBehavior, VOYAGE_TRACK_LIMIT_BEHAVIOR)) issue(errors, "error", "invalid-track-limit-behavior", `tracks[${index}].limitBehavior`, "Track limit behavior is not recognized.");
    if (track.thresholds !== undefined && !Array.isArray(track.thresholds)) issue(errors, "error", "invalid-threshold-collection", `tracks[${index}].thresholds`, "Track thresholds must be an array when supplied.");
    const thresholds = Array.isArray(track.thresholds) ? track.thresholds : [];
    thresholds.forEach((threshold, thresholdIndex) => {
      if (!isPlainObject(threshold)) { issue(errors, "error", "invalid-threshold", `tracks[${index}].thresholds[${thresholdIndex}]`, "Threshold must be a plain object."); return; }
      if (!isEnumValue(threshold.timing, VOYAGE_THRESHOLD_TIMING)) issue(errors, "error", "invalid-threshold-timing", `tracks[${index}].thresholds[${thresholdIndex}].timing`, "Threshold timing is not recognized.");
      if (!isEnumValue(threshold.recurrence, VOYAGE_THRESHOLD_RECURRENCE)) issue(errors, "error", "invalid-threshold-recurrence", `tracks[${index}].thresholds[${thresholdIndex}].recurrence`, "Threshold recurrence is not recognized.");
    });
  });

  if (Array.isArray(state.stationAssignments)) {
    const assignmentValidation = validateVoyageStationAssignments(state.stationAssignments);
    errors.push(...assignmentValidation.errors);
    warnings.push(...assignmentValidation.warnings);
  }

  if (Array.isArray(state.permanentConsequences)) state.permanentConsequences.forEach((consequence, index) => {
    if (!isPlainObject(consequence)) { issue(errors, "error", "invalid-permanent-consequence", `permanentConsequences[${index}]`, "Permanent consequence must be a plain object."); return; }
    if (!isEnumValue(consequence.status, VOYAGE_PERMANENT_CONSEQUENCE_STATUSES)) issue(errors, "error", "invalid-consequence-status", `permanentConsequences[${index}].status`, "Permanent consequence status is not recognized.");
    if (!isEnumValue(consequence.commitmentTiming, VOYAGE_PERMANENT_CONSEQUENCE_COMMITMENT_TIMING)) issue(errors, "error", "invalid-consequence-commitment-timing", `permanentConsequences[${index}].commitmentTiming`, "Permanent consequence commitment timing is not recognized.");
  });

  validateDistinctIds(state.permanentConsequences, "permanentConsequences", "consequenceId", errors);
  validateDistinctIds(state.tracks, "tracks", "trackId", errors);
  validateDistinctIds(state.participants, "participants", "participantId", errors);
  if (Array.isArray(state.processedRequestIds)) {
    const seen = new Set();
    state.processedRequestIds.forEach((requestId, index) => {
      if (seen.has(requestId)) issue(errors, "error", "duplicate-request-id", `processedRequestIds[${index}]`, `Duplicate processed request ID "${requestId}".`);
      seen.add(requestId);
    });
  }
  if (Array.isArray(state.snapshots)) state.snapshots.forEach((snapshot, index) => {
    if (!isPlainObject(snapshot) || !nonEmptyId(snapshot.snapshotId) || !isPlainObject(snapshot.temporaryState)) issue(errors, "error", "malformed-snapshot", `snapshots[${index}]`, "Snapshot requires a snapshotId and temporaryState object.");
  });
  if (!isPlainObject(state.recovery)) issue(errors, "error", "malformed-recovery", "recovery", "Recovery state must be a plain object.");

  return { valid: errors.length === 0, errors, warnings };
}
