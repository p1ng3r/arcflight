import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_MOMENTUM_MAX,
  VOYAGE_MOMENTUM_MIN,
  VOYAGE_ENCOUNTER_SCHEMA_VERSION,
  VOYAGE_PRESSURE_MAX_CAPACITY,
  VOYAGE_PRESSURE_SYSTEM_IDS,
  VOYAGE_PERMANENT_CONSEQUENCE_COMMITMENT_TIMING,
  VOYAGE_PERMANENT_CONSEQUENCE_STATUSES,
  VOYAGE_ROUND_PHASES,
  VOYAGE_THRESHOLD_RECURRENCE,
  VOYAGE_THRESHOLD_TIMING,
  VOYAGE_TRACK_LIMIT_BEHAVIOR,
  VOYAGE_TRACK_VISIBILITY
} from "./constants.js";
import { createDraftVoyageEncounterDefaults, isPlainObject } from "./defaults.js";
import { validateVoyageHazardRecord } from "./hazard-schema.js";
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
const SAFE_REQUIRED_DATA_COLLECTIONS = new Set([
  "proposedStationOrder",
  "committedStationOrder"
]);
const SAFE_REQUIRED_DATA_OBJECTS = new Set([
  "pressureSystems"
]);
const UNSAFE = new Set([
  "__proto__",
  "constructor",
  "prototype"
]);
const PRESSURE_SYSTEM_RECORD_FIELDS = Object.freeze([
  "pressureSystemId",
  "value",
  "capacity"
]);
const PRESSURE_SYSTEM_RECORD_FIELD_SET = new Set(PRESSURE_SYSTEM_RECORD_FIELDS);
const CANONICAL_PRESSURE_SYSTEM_IDS = new Set(VOYAGE_PRESSURE_SYSTEM_IDS);

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

function readRequiredDataCollection(state, key, errors) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(state, key);
  } catch {
    issue(errors, "error", "voyage-state-data-read-failed", key, `${key} could not be read safely.`);
    return { ok: false, value: undefined };
  }

  if (!descriptor || !Object.hasOwn(descriptor, "value")) {
    issue(errors, "error", "invalid-collection-type", key, `${key} must be an own data-property array.`);
    return { ok: false, value: undefined };
  }
  return { ok: true, value: descriptor.value };
}

function readRequiredDataObject(state, key, errors, path = key, dataReadCode = "voyage-state-data-read-failed") {
  let hasOwn = false;
  try {
    hasOwn = Object.hasOwn(state, key);
  } catch {
    issue(errors, "error", dataReadCode, path, `${key} could not be read safely.`);
    return { ok: false, present: false, inherited: false, value: undefined };
  }

  if (!hasOwn) {
    let inherited = false;
    try {
      inherited = key in state;
    } catch {
      issue(errors, "error", dataReadCode, path, `${key} could not be read safely.`);
      return { ok: false, present: false, inherited: false, value: undefined };
    }

    issue(
      errors,
      "error",
      inherited ? "inherited-pressure-systems" : "missing-pressure-systems",
      path,
      inherited
        ? "Pressure systems must be own data, not inherited data."
        : "Voyage Encounter state requires pressureSystems."
    );
    return { ok: false, present: false, inherited, value: undefined };
  }

  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(state, key);
  } catch {
    issue(errors, "error", dataReadCode, path, `${key} could not be read safely.`);
    return { ok: false, present: true, inherited: false, value: undefined };
  }

  if (!descriptor) {
    issue(errors, "error", dataReadCode, path, `${key} could not be read safely.`);
    return { ok: false, present: true, inherited: false, value: undefined };
  }
  if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) {
    issue(errors, "error", "invalid-pressure-systems-data-property", path, "pressureSystems must be an own enumerable data property.");
    return { ok: false, present: true, inherited: false, value: undefined };
  }
  return { ok: true, present: true, inherited: false, value: descriptor.value };
}

function inspectPlainObject(value, path, errors, code, message) {
  try {
    return { ok: true, plain: isPlainObject(value) };
  } catch {
    issue(errors, "error", code, path, message);
    return { ok: false, plain: false };
  }
}

function readMomentum(state) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(state, "momentum");
    if (!descriptor) {
      if ("momentum" in state) return { ok: false, present: true, inherited: true, value: undefined };
      return { ok: true, present: false, inherited: false, value: undefined };
    }
    if (!Object.hasOwn(descriptor, "value")) return { ok: false, present: true, inherited: false, value: undefined };
    return { ok: true, present: true, inherited: false, value: descriptor.value };
  } catch {
    return { ok: false, present: true, inherited: false, value: undefined };
  }
}

function validatePressureSystemRecord(record, pressureSystemId, path, errors) {
  let keys;
  try {
    keys = Reflect.ownKeys(record);
  } catch {
    issue(errors, "error", "pressure-system-record-data-read-failed", path, "Pressure system record could not be read safely.");
    return;
  }

  const presentFields = new Set();
  for (const key of keys) {
    const keyPath = `${path}.${typeof key === "symbol" ? "[symbol]" : key}`;
    if (typeof key !== "string") {
      issue(errors, "error", "unexpected-pressure-system-field", keyPath, "Pressure system record has an unexpected own field.");
      continue;
    }
    if (UNSAFE.has(key)) {
      issue(errors, "error", "unsafe-pressure-system-field", keyPath, "Pressure system record has an unexpected own field.");
      continue;
    }
    if (!PRESSURE_SYSTEM_RECORD_FIELD_SET.has(key)) {
      issue(errors, "error", "unexpected-pressure-system-field", keyPath, "Pressure system record has an unexpected own field.");
      continue;
    }
    presentFields.add(key);
  }

  for (const field of PRESSURE_SYSTEM_RECORD_FIELDS) {
    if (!presentFields.has(field)) {
      issue(errors, "error", "missing-pressure-system-field", `${path}.${field}`, `Pressure system record requires ${field}.`);
    }
  }

  const fieldValues = {};
  for (const field of PRESSURE_SYSTEM_RECORD_FIELDS) {
    if (!presentFields.has(field)) continue;
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(record, field);
    } catch {
      issue(errors, "error", "pressure-system-record-data-read-failed", `${path}.${field}`, "Pressure system record could not be read safely.");
      continue;
    }
    if (!descriptor) {
      issue(errors, "error", "missing-pressure-system-field", `${path}.${field}`, `Pressure system record requires ${field}.`);
      continue;
    }
    if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) {
      issue(errors, "error", "invalid-pressure-system-data-property", `${path}.${field}`, "Pressure system record fields must be own enumerable data properties.");
      continue;
    }
    fieldValues[field] = descriptor.value;
  }

  if (Object.hasOwn(fieldValues, "pressureSystemId")) {
    const recordId = fieldValues.pressureSystemId;
    if (typeof recordId !== "string" || !recordId.trim()) {
      issue(errors, "error", "invalid-pressure-system-id", `${path}.pressureSystemId`, "Pressure system ID must be a non-blank exact string.");
    } else if (recordId !== pressureSystemId) {
      issue(errors, "error", "pressure-system-id-mismatch", `${path}.pressureSystemId`, "Pressure system ID must exactly match its map key.");
    }
  }

  if (Object.hasOwn(fieldValues, "value")) {
    const value = fieldValues.value;
    if (!Number.isSafeInteger(value) || value < 0) {
      issue(errors, "error", "invalid-pressure-system-value", `${path}.value`, "Pressure system value must be a non-negative safe integer.");
    }
  }

  if (Object.hasOwn(fieldValues, "capacity")) {
    const capacity = fieldValues.capacity;
    if (!Number.isSafeInteger(capacity) || capacity < 0) {
      issue(errors, "error", "invalid-pressure-system-capacity", `${path}.capacity`, "Pressure system capacity must be a non-negative safe integer.");
    } else if (capacity > VOYAGE_PRESSURE_MAX_CAPACITY) {
      issue(errors, "error", "pressure-system-capacity-too-high", `${path}.capacity`, "Pressure system capacity must not exceed 5.");
    }
  }

  if (
    Object.hasOwn(fieldValues, "value")
    && Object.hasOwn(fieldValues, "capacity")
    && Number.isSafeInteger(fieldValues.value)
    && fieldValues.value >= 0
    && Number.isSafeInteger(fieldValues.capacity)
    && fieldValues.capacity >= 0
    && fieldValues.capacity <= VOYAGE_PRESSURE_MAX_CAPACITY
    && fieldValues.value > fieldValues.capacity
  ) {
    issue(errors, "error", "pressure-system-value-exceeds-capacity", `${path}.value`, "Pressure system value must not exceed its capacity.");
  }
}

function validatePressureSystems(state, errors) {
  const read = readRequiredDataObject(state, "pressureSystems", errors);
  if (!read.ok) return;
  const pressureSystems = read.value;
  const pressureSystemsPlain = inspectPlainObject(
    pressureSystems,
    "pressureSystems",
    errors,
    "pressure-systems-data-read-failed",
    "pressureSystems could not be read safely."
  );
  if (!pressureSystemsPlain.ok) return;
  if (!pressureSystemsPlain.plain) {
    issue(errors, "error", "invalid-pressure-systems", "pressureSystems", "pressureSystems must be a plain object.");
    return;
  }

  let keys;
  try {
    keys = Reflect.ownKeys(pressureSystems);
  } catch {
    issue(errors, "error", "pressure-systems-data-read-failed", "pressureSystems", "pressureSystems could not be read safely.");
    return;
  }

  for (const key of keys) {
    const keyPath = `pressureSystems.${typeof key === "symbol" ? "[symbol]" : key}`;
    if (typeof key !== "string") {
      issue(errors, "error", "unexpected-pressure-system-key", keyPath, "Pressure systems has an unexpected own field.");
      continue;
    }
    if (UNSAFE.has(key)) {
      issue(errors, "error", "unsafe-pressure-system-key", keyPath, "Pressure systems must not use unsafe keys.");
      continue;
    }
    if (!CANONICAL_PRESSURE_SYSTEM_IDS.has(key)) {
      issue(errors, "error", "unexpected-pressure-system-key", keyPath, "Pressure systems has an unexpected own field.");
      continue;
    }
  }

  for (const pressureSystemId of VOYAGE_PRESSURE_SYSTEM_IDS) {
    const path = `pressureSystems.${pressureSystemId}`;
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(pressureSystems, pressureSystemId);
    } catch {
      issue(errors, "error", "pressure-systems-data-read-failed", path, "Pressure systems could not be read safely.");
      continue;
    }
    if (!descriptor) {
      issue(errors, "error", "missing-pressure-system", path, `Pressure systems require ${pressureSystemId}.`);
      continue;
    }
    if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) {
      issue(errors, "error", "invalid-pressure-systems-data-property", path, "Pressure system records must be own enumerable data properties.");
      continue;
    }
    const recordPlain = inspectPlainObject(
      descriptor.value,
      path,
      errors,
      "pressure-system-record-data-read-failed",
      "Pressure system record could not be read safely."
    );
    if (!recordPlain.ok) continue;
    if (!recordPlain.plain) {
      issue(errors, "error", "invalid-pressure-system-record", path, "Pressure system records must be plain objects.");
      continue;
    }
    validatePressureSystemRecord(descriptor.value, pressureSystemId, path, errors);
  }
}

function readActiveHazardsCollection(state, errors) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(state, "activeHazards");
  } catch {
    issue(errors, "error", "active-hazards-data-read-failed", "activeHazards", "activeHazards could not be read safely.");
    return { ok: false, value: undefined };
  }

  if (!descriptor) {
    let inherited = false;
    try {
      inherited = "activeHazards" in state;
    } catch {
      issue(errors, "error", "active-hazards-data-read-failed", "activeHazards", "activeHazards could not be read safely.");
      return { ok: false, value: undefined };
    }
    issue(
      errors,
      "error",
      inherited ? "inherited-active-hazards" : "missing-active-hazards",
      "activeHazards",
      inherited
        ? "activeHazards must be an own data property, not inherited data."
        : "Voyage Encounter state requires activeHazards."
    );
    return { ok: false, value: undefined };
  }

  if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) {
    issue(errors, "error", "invalid-active-hazards-collection-property", "activeHazards", "activeHazards must be an own enumerable data-property array.");
    return { ok: false, value: undefined };
  }
  return { ok: true, value: descriptor.value };
}

function readActiveHazardField(record, field, path, errors) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, field);
  } catch {
    issue(errors, "error", "active-hazards-data-read-failed", path, "Hazard data could not be read safely.");
    return { ok: false, value: undefined };
  }
  if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return { ok: false, value: undefined };
  return { ok: true, value: descriptor.value };
}

function rebaseHazardIssue(error, entryPath) {
  const suffix = error.path === "$" ? "" : error.path.startsWith("$") ? error.path.slice(1) : `.${error.path}`;
  return { ...error, path: `${entryPath}${suffix}` };
}

function validateActiveHazards(state, errors) {
  const read = readActiveHazardsCollection(state, errors);
  if (!read.ok) return;

  let isArray = false;
  try {
    isArray = Array.isArray(read.value);
  } catch {
    issue(errors, "error", "active-hazards-data-read-failed", "activeHazards", "activeHazards could not be read safely.");
    return;
  }
  if (!isArray) {
    issue(errors, "error", "invalid-active-hazards-collection", "activeHazards", "activeHazards must be an array.");
    return;
  }

  let keys;
  let lengthDescriptor;
  try {
    keys = Reflect.ownKeys(read.value);
    lengthDescriptor = Object.getOwnPropertyDescriptor(read.value, "length");
  } catch {
    issue(errors, "error", "active-hazards-data-read-failed", "activeHazards", "activeHazards could not be read safely.");
    return;
  }
  if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value") || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
    issue(errors, "error", "invalid-active-hazards-collection-property", "activeHazards.length", "activeHazards must have an intrinsic safe array length.");
    return;
  }

  const length = lengthDescriptor.value;
  for (const key of keys) {
    if (key === "length") continue;
    const validIndex = typeof key === "string"
      && /^0$|^[1-9]\d*$/.test(key)
      && Number(key) < length
      && String(Number(key)) === key;
    if (!validIndex) issue(errors, "error", "unexpected-active-hazards-array-key", `activeHazards.${typeof key === "symbol" ? "[symbol]" : key}`, "activeHazards must contain only dense numeric entries.");
  }

  const expectedEncounterId = (() => {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(state, "encounterId");
      return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
    } catch {
      return undefined;
    }
  })();
  const hazardIds = new Map();
  const systemSlots = new Map();

  for (let index = 0; index < length; index += 1) {
    const entryPath = `activeHazards[${index}]`;
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(read.value, String(index));
    } catch {
      issue(errors, "error", "active-hazards-data-read-failed", entryPath, "Hazard entry could not be read safely.");
      continue;
    }
    if (!descriptor) {
      issue(errors, "error", "sparse-active-hazards", entryPath, "activeHazards must be dense.");
      continue;
    }
    if (!Object.hasOwn(descriptor, "value") || !descriptor.enumerable) {
      issue(errors, "error", "invalid-active-hazards-entry", entryPath, "Hazard entries must be own enumerable data properties.");
      continue;
    }

    const validation = validateVoyageHazardRecord(descriptor.value, {
      mode: "active",
      expectedEncounterId
    });
    if (!validation.valid) {
      issue(errors, "error", "invalid-active-hazard-record", entryPath, "activeHazards entry is not a valid active Hazard record.");
      errors.push(...validation.errors.map((error) => rebaseHazardIssue(error, entryPath)));
      continue;
    }

    const hazardId = readActiveHazardField(descriptor.value, "hazardId", `${entryPath}.hazardId`, errors);
    if (hazardId.ok) {
      if (hazardIds.has(hazardId.value)) issue(errors, "error", "duplicate-hazard-id", `${entryPath}.hazardId`, `Duplicate hazardId "${hazardId.value}".`);
      else hazardIds.set(hazardId.value, index);
    }

    const category = readActiveHazardField(descriptor.value, "category", `${entryPath}.category`, errors);
    const pressureSystemId = readActiveHazardField(descriptor.value, "pressureSystemId", `${entryPath}.pressureSystemId`, errors);
    if (category.ok && pressureSystemId.ok && category.value === "system") {
      if (systemSlots.has(pressureSystemId.value)) issue(errors, "error", "duplicate-active-hazard-system-slot", `${entryPath}.pressureSystemId`, `Pressure system ${pressureSystemId.value} already has an active system Hazard.`);
      else systemSlots.set(pressureSystemId.value, index);
    }
  }
}

export function validateVoyageEncounterState(value) {
  const errors = [];
  const warnings = [];
  let plainState = false;
  try {
    plainState = isPlainObject(value);
  } catch {
    issue(errors, "error", "voyage-state-data-read-failed", "$", "Voyage Encounter state could not be read safely.");
  }
  if (!plainState) {
    issue(errors, "error", "invalid-state", "$", "Voyage Encounter state must be a plain object.");
    return { valid: false, errors, warnings };
  }

  const state = value;
  const momentum = readMomentum(state);
  if (!momentum.ok) {
    issue(errors, "error", momentum.inherited ? "inherited-momentum" : "invalid-momentum-data-property", "momentum", "Momentum must be an own data property.");
  } else if (!momentum.present) {
    issue(errors, "error", "missing-momentum", "momentum", "Voyage Encounter state requires Momentum.");
  } else if (!Number.isSafeInteger(momentum.value) || momentum.value < VOYAGE_MOMENTUM_MIN || momentum.value > VOYAGE_MOMENTUM_MAX) {
    issue(errors, "error", "invalid-momentum", "momentum", "Momentum must be a safe integer from 0 through 3.");
  }
  if (state.schemaVersion !== VOYAGE_ENCOUNTER_SCHEMA_VERSION) issue(errors, "error", "unsupported-schema-version", "schemaVersion", "Unsupported Voyage Encounter schema version.");
  if (!nonEmptyId(state.encounterId)) issue(errors, "error", "invalid-encounter-id", "encounterId", "Encounter ID must be a non-empty string.");
  if (!isEnumValue(state.lifecycleState, VOYAGE_ENCOUNTER_LIFECYCLE_STATES)) issue(errors, "error", "invalid-lifecycle-state", "lifecycleState", "Lifecycle state is not recognized.");
  if (!Number.isInteger(state.revision) || state.revision < 0) issue(errors, "error", "invalid-revision", "revision", "Revision must be a non-negative integer.");
  validatePressureSystems(state, errors);
  validateActiveHazards(state, errors);

  for (const [key, defaultValue] of Object.entries(COLLECTION_DEFAULTS)) {
    if (key === "activeHazards") continue;
    if (Array.isArray(defaultValue)) {
      const safeRead = SAFE_REQUIRED_DATA_COLLECTIONS.has(key)
        ? readRequiredDataCollection(state, key, errors)
        : { ok: true, value: state[key] };
      if (safeRead.ok && !Array.isArray(safeRead.value)) issue(errors, "error", "invalid-collection-type", key, `${key} must be an array.`);
      continue;
    }
    if (SAFE_REQUIRED_DATA_OBJECTS.has(key)) continue;
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
