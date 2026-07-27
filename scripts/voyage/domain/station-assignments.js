import {
  VOYAGE_EVENT_RUNNER_STATION_IDS
} from "./constants.js";
import { isPlainObject } from "./defaults.js";

export const VOYAGE_STATION_OPERATOR_KINDS = Object.freeze({
  ACTOR: "actor",
  CREW_ASSET: "crewAsset"
});

const CANONICAL_STATION_IDS = new Set(VOYAGE_EVENT_RUNNER_STATION_IDS);
const OPERATOR_KINDS = new Set(Object.values(VOYAGE_STATION_OPERATOR_KINDS));
const UNSAFE_IDENTITIES = new Set(["__proto__", "constructor", "prototype"]);
const ASSIGNMENT_FIELDS = Object.freeze(["stationId", "operator"]);
const OPERATOR_FIELDS = Object.freeze(["kind", "id", "uuid", "name"]);

function issue(list, code, path, message) {
  list.push({ code, path, message, severity: "error" });
}

function numericIndices(value) {
  const indices = [];
  for (let index = 0; index < value.length; index += 1) {
    if (Object.hasOwn(value, index)) indices.push(index);
  }
  return indices;
}

function isArrayIndexKey(key, length) {
  if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length;
}

function readExactPlainObject(value, fields, path, errors, invalidCode, unexpectedCode, requiredFields = fields) {
  if (!isPlainObject(value)) {
    issue(errors, invalidCode, path, "Value must be a plain object.");
    return null;
  }

  const captured = {};
  for (const key of Reflect.ownKeys(value)) {
    const keyPath = `${path}.${typeof key === "symbol" ? "[symbol]" : key}`;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !fields.includes(key)) {
      issue(errors, unexpectedCode, keyPath, "Unexpected field.");
      continue;
    }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) {
      issue(errors, "station-assignment-data-read-failed", keyPath, "Station assignment data must use own data properties.");
      continue;
    }
    captured[key] = descriptor.value;
  }

  for (const field of requiredFields) {
    if (!Object.hasOwn(captured, field)) {
      issue(errors, invalidCode, `${path}.${field}`, "Required field is missing.");
    }
  }
  return captured;
}

function hasNonEmptyIdentity(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function captureOperator(value, path, errors) {
  const errorCount = errors.length;
  const operator = readExactPlainObject(
    value,
    OPERATOR_FIELDS,
    path,
    errors,
    "invalid-station-operator",
    "unexpected-station-operator-field",
    ["kind"]
  );
  if (!operator) return null;

  if (!OPERATOR_KINDS.has(operator.kind)) {
    issue(errors, "invalid-station-operator-kind", `${path}.kind`, "Operator kind must be actor or crewAsset.");
  }

  const hasId = Object.hasOwn(operator, "id");
  const hasUuid = Object.hasOwn(operator, "uuid");
  const validId = hasId && hasNonEmptyIdentity(operator.id);
  const validUuid = hasUuid && hasNonEmptyIdentity(operator.uuid);

  if (hasId && !validId) {
    issue(errors, "invalid-station-operator-id", `${path}.id`, "Operator id must be a non-empty exact string when supplied.");
  } else if (validId && UNSAFE_IDENTITIES.has(operator.id)) {
    issue(errors, "unsafe-station-operator-id", `${path}.id`, "Operator id must be safe.");
  }

  if (hasUuid && !validUuid) {
    issue(errors, "invalid-station-operator-uuid", `${path}.uuid`, "Operator uuid must be a non-empty exact string when supplied.");
  } else if (validUuid && UNSAFE_IDENTITIES.has(operator.uuid)) {
    issue(errors, "unsafe-station-operator-uuid", `${path}.uuid`, "Operator uuid must be safe.");
  }

  if (!validUuid && !validId) {
    issue(errors, "missing-station-operator-identity", path, "Operator requires a non-empty uuid or id.");
  }

  if (Object.hasOwn(operator, "name") && typeof operator.name !== "string") {
    issue(errors, "invalid-station-operator-name", `${path}.name`, "Operator name must be a string when supplied.");
  }

  if (errors.length !== errorCount) return null;

  const captured = { kind: operator.kind };
  if (hasId) captured.id = operator.id;
  if (hasUuid) captured.uuid = operator.uuid;
  if (Object.hasOwn(operator, "name")) captured.name = operator.name;
  return captured;
}

function captureAssignment(value, index, errors) {
  const path = `stationAssignments[${index}]`;
  const errorCount = errors.length;
  const assignment = readExactPlainObject(
    value,
    ASSIGNMENT_FIELDS,
    path,
    errors,
    "invalid-station-assignment",
    "unexpected-station-assignment-field"
  );
  if (!assignment) return null;

  if (!CANONICAL_STATION_IDS.has(assignment.stationId)) {
    issue(
      errors,
      "unsupported-event-runner-station-id",
      `${path}.stationId`,
      "Station assignment requires a canonical Event Runner stationId."
    );
  }

  const operator = captureOperator(assignment.operator, `${path}.operator`, errors);
  if (errors.length !== errorCount || !operator) return null;
  return { stationId: assignment.stationId, operator };
}

function identityKey(operator, field) {
  return `${operator.kind}\0${field}\0${operator[field]}`;
}

function operatorIdentityIsDuplicate(operator, identities) {
  if (Object.hasOwn(operator, "uuid")) {
    if (identities.uuids.has(identityKey(operator, "uuid"))) return true;
    return Object.hasOwn(operator, "id") && identities.fallbackIds.has(identityKey(operator, "id"));
  }
  return identities.ids.has(identityKey(operator, "id"));
}

function recordOperatorIdentity(operator, identities) {
  if (Object.hasOwn(operator, "uuid")) {
    identities.uuids.add(identityKey(operator, "uuid"));
  } else {
    identities.fallbackIds.add(identityKey(operator, "id"));
  }
  if (Object.hasOwn(operator, "id")) identities.ids.add(identityKey(operator, "id"));
}

function inspectCollectionKeys(value, errors) {
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length" || isArrayIndexKey(key, value.length)) continue;
    const path = `stationAssignments.${typeof key === "symbol" ? "[symbol]" : key}`;
    issue(errors, "unexpected-station-assignment-collection-key", path, "Station assignments must contain only array entries.");
  }
}

function failureReport(errors) {
  return {
    valid: false,
    assignmentCount: 0,
    validAssignmentCount: 0,
    assignments: [],
    occupiedStationIds: [],
    errors,
    warnings: []
  };
}

export function analyzeVoyageStationAssignments(value) {
  const errors = [];
  try {
    if (!Array.isArray(value)) {
      issue(errors, "invalid-station-assignments", "stationAssignments", "Station assignments must be an array.");
      return failureReport(errors);
    }

    inspectCollectionKeys(value, errors);
    const indices = numericIndices(value);
    const assignments = new Array(value.length);
    const occupiedStationIds = [];
    const seenStationIds = new Set();
    const seenOperatorIdentities = {
      uuids: new Set(),
      ids: new Set(),
      fallbackIds: new Set()
    };
    let validAssignmentCount = 0;

    for (const index of indices) {
      const descriptor = Object.getOwnPropertyDescriptor(value, index);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) {
        issue(
          errors,
          "station-assignment-data-read-failed",
          `stationAssignments[${index}]`,
          "Station assignment entries must use own data properties."
        );
        continue;
      }

      const assignment = captureAssignment(descriptor.value, index, errors);
      if (!assignment) continue;

      let unique = true;
      if (seenStationIds.has(assignment.stationId)) {
        issue(
          errors,
          "duplicate-station-assignment",
          `stationAssignments[${index}].stationId`,
          `Station "${assignment.stationId}" is assigned more than once.`
        );
        unique = false;
      }

      if (operatorIdentityIsDuplicate(assignment.operator, seenOperatorIdentities)) {
        issue(
          errors,
          "duplicate-station-operator",
          `stationAssignments[${index}].operator`,
          "Operator is assigned to more than one station."
        );
        unique = false;
      }

      if (!unique) continue;
      seenStationIds.add(assignment.stationId);
      recordOperatorIdentity(assignment.operator, seenOperatorIdentities);
      assignments[index] = assignment;
      occupiedStationIds.push(assignment.stationId);
      validAssignmentCount += 1;
    }

    return {
      valid: errors.length === 0,
      assignmentCount: indices.length,
      validAssignmentCount,
      assignments,
      occupiedStationIds,
      errors,
      warnings: []
    };
  } catch (_error) {
    return failureReport([{
      code: "station-assignment-data-read-failed",
      path: "stationAssignments",
      message: "Station assignment data could not be read safely.",
      severity: "error"
    }]);
  }
}

export function validateVoyageStationAssignments(value) {
  const report = analyzeVoyageStationAssignments(value);
  return {
    valid: report.valid,
    errors: report.errors.map((entry) => ({ ...entry })),
    warnings: report.warnings.map((entry) => ({ ...entry }))
  };
}

export function deriveOccupiedVoyageStationIds(value) {
  const report = analyzeVoyageStationAssignments(value);
  return report.valid ? [...report.occupiedStationIds] : [];
}
