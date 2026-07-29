import { validateVoyageEncounterState } from "./validation.js";
import {
  deriveOccupiedVoyageStationIds,
  validateVoyageStationAssignments
} from "./station-assignments.js";

const ORDER_FIELDS = Object.freeze([
  "proposedStationOrder",
  "committedStationOrder"
]);
const UNSAFE_STATION_IDS = new Set(["__proto__", "constructor", "prototype"]);

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

function issueIdentity(entry) {
  return `${entry.code}\0${entry.path}\0${entry.message}\0${entry.severity}`;
}

function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const identity = issueIdentity(entry);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function cloneIssues(issues) {
  return issues.map((entry) => ({ ...entry }));
}

function readOwnDataProperty(value, key, path, errors) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    issue(
      errors,
      "station-order-data-read-failed",
      path,
      "Voyage station-order data could not be read safely."
    );
    return { ok: false, present: true, value: undefined };
  }

  if (!descriptor) return { ok: true, present: false, value: undefined };
  if (!Object.hasOwn(descriptor, "value")) {
    issue(
      errors,
      "station-order-data-read-failed",
      path,
      "Voyage station-order properties must be own data properties."
    );
    return { ok: false, present: true, value: undefined };
  }
  return { ok: true, present: true, value: descriptor.value };
}

function fieldIssues(structuralErrors, field) {
  return structuralErrors.filter(
    (entry) => entry.path === field || entry.path.startsWith(`${field}.`) || entry.path.startsWith(`${field}[`)
  );
}

function analyzeOrderArray(order, field, occupiedStationIds, errors) {
  let array;
  try {
    array = Array.isArray(order);
  } catch {
    issue(errors, "station-order-data-read-failed", field, `${field} could not be inspected safely.`);
    return { valid: false, complete: false, order: [], errors };
  }
  if (!array) {
    issue(errors, "invalid-station-order-field", field, `${field} must be an array.`);
    return { valid: false, complete: false, order: [], errors };
  }

  const lengthRead = readOwnDataProperty(order, "length", `${field}.length`, errors);
  if (!lengthRead.ok || !lengthRead.present || !Number.isSafeInteger(lengthRead.value) || lengthRead.value < 0) {
    return { valid: false, complete: false, order: [], errors };
  }

  const occupied = new Set(occupiedStationIds);
  const seen = new Set();
  const seenOccupied = new Set();
  const captured = [];
  for (let index = 0; index < lengthRead.value; index += 1) {
    const path = `${field}[${index}]`;
    const entryRead = readOwnDataProperty(order, String(index), path, errors);
    if (!entryRead.present) {
      issue(errors, "sparse-station-order-entry", path, "Station-order arrays must contain dense own entries.");
      continue;
    }
    if (!entryRead.ok) continue;

    const stationId = entryRead.value;
    if (typeof stationId !== "string" || stationId.trim().length === 0) {
      issue(errors, "invalid-station-order-station-id", path, "Station-order entries must be non-empty exact strings.");
      continue;
    }
    if (UNSAFE_STATION_IDS.has(stationId)) {
      issue(errors, "unsafe-station-order-station-id", path, "Station-order station IDs must be safe.");
      continue;
    }
    if (seen.has(stationId)) {
      issue(errors, "duplicate-station-order-station-id", path, "Station-order station IDs must be unique.");
    } else {
      seen.add(stationId);
    }
    if (!occupied.has(stationId)) {
      issue(errors, "unoccupied-station-order-station-id", path, "Station-order entries must identify occupied stations.");
      continue;
    }
    seenOccupied.add(stationId);
    captured.push(stationId);
  }

  if (lengthRead.value > 0) {
    for (const stationId of occupiedStationIds) {
      if (!seenOccupied.has(stationId)) {
        issue(
          errors,
          "missing-occupied-station-order-station-id",
          field,
          `Station order is missing occupied station "${stationId}".`
        );
      }
    }
  }

  const valid = errors.length === 0;
  const complete = valid
    && captured.length === occupiedStationIds.length
    && (occupiedStationIds.length === 0 || captured.length > 0);
  return {
    valid,
    complete,
    order: valid ? [...captured] : [],
    errors
  };
}

function analyzeOrderField(state, field, occupiedStationIds, upstreamFieldIssues) {
  const errors = cloneIssues(upstreamFieldIssues);
  if (errors.length > 0) {
    return { valid: false, complete: false, order: [], errors };
  }

  const fieldRead = readOwnDataProperty(state, field, field, errors);
  if (!fieldRead.present) {
    issue(errors, "missing-station-order-field", field, `${field} must be an own array field.`);
    return { valid: false, complete: false, order: [], errors };
  }
  if (!fieldRead.ok) {
    return { valid: false, complete: false, order: [], errors };
  }

  return analyzeOrderArray(fieldRead.value, field, occupiedStationIds, errors);
}

export function analyzeVoyageStationOrderPermutation(
  stationOrder,
  occupiedStationIds,
  path = "stationOrder"
) {
  try {
    const result = analyzeOrderArray(stationOrder, path, occupiedStationIds, []);
    return {
      valid: result.valid,
      complete: result.complete,
      stationOrder: [...result.order],
      errors: cloneIssues(result.errors)
    };
  } catch {
    return {
      valid: false,
      complete: false,
      stationOrder: [],
      errors: [{
        code: "station-order-data-read-failed",
        path,
        message: "Voyage station-order data could not be analyzed safely.",
        severity: "error"
      }]
    };
  }
}

function failureReport(errors) {
  return {
    structurallyValid: false,
    occupiedStationIds: [],
    proposedStationOrder: [],
    committedStationOrder: [],
    proposedOrderValid: false,
    committedOrderValid: false,
    proposedOrderComplete: false,
    committedOrderComplete: false,
    valid: false,
    errors: cloneIssues(errors),
    warnings: []
  };
}

function analyzeSafely(encounterState) {
  const structural = validateVoyageEncounterState(encounterState);
  const assignments = validateVoyageStationAssignments(encounterState?.stationAssignments);
  const structuralOrderIssues = new Set(
    ORDER_FIELDS.flatMap((field) => fieldIssues(structural.errors, field).map(issueIdentity))
  );
  const upstreamErrors = deduplicateIssues([
    ...structural.errors.filter((entry) => !structuralOrderIssues.has(issueIdentity(entry))),
    ...assignments.errors
  ]);
  const warnings = deduplicateIssues([...structural.warnings, ...assignments.warnings]);
  const occupiedStationIds = assignments.valid
    ? deriveOccupiedVoyageStationIds(encounterState.stationAssignments)
    : [];

  const proposedUpstreamIssues = fieldIssues(structural.errors, "proposedStationOrder");
  const committedUpstreamIssues = fieldIssues(structural.errors, "committedStationOrder");
  const proposed = assignments.valid
    ? analyzeOrderField(
      encounterState,
      "proposedStationOrder",
      occupiedStationIds,
      proposedUpstreamIssues
    )
    : { valid: false, complete: false, order: [], errors: cloneIssues(proposedUpstreamIssues) };
  const committed = assignments.valid
    ? analyzeOrderField(
      encounterState,
      "committedStationOrder",
      occupiedStationIds,
      committedUpstreamIssues
    )
    : { valid: false, complete: false, order: [], errors: cloneIssues(committedUpstreamIssues) };
  const baseTrusted = upstreamErrors.length === 0 && assignments.valid;
  const proposedTrusted = baseTrusted && proposed.valid;
  const committedTrusted = baseTrusted && committed.valid;
  const zeroOccupancySafelyEstablished = assignments.valid && occupiedStationIds.length === 0;

  return {
    structurallyValid: structural.valid,
    occupiedStationIds: [...occupiedStationIds],
    proposedStationOrder: proposedTrusted ? [...proposed.order] : [],
    committedStationOrder: committedTrusted ? [...committed.order] : [],
    proposedOrderValid: proposed.valid,
    committedOrderValid: committed.valid,
    proposedOrderComplete: proposedTrusted
      ? proposed.complete
      : zeroOccupancySafelyEstablished && proposed.valid && proposed.order.length === 0,
    committedOrderComplete: committedTrusted
      ? committed.complete
      : zeroOccupancySafelyEstablished && committed.valid && committed.order.length === 0,
    valid: structural.valid && assignments.valid && proposed.valid && committed.valid,
    errors: deduplicateIssues([
      ...upstreamErrors,
      ...proposed.errors,
      ...committed.errors
    ]),
    warnings: cloneIssues(warnings)
  };
}

export function analyzeVoyageEncounterStationOrder(encounterState) {
  try {
    return analyzeSafely(encounterState);
  } catch {
    return failureReport([{
      code: "station-order-data-read-failed",
      path: "$",
      message: "Voyage station-order state could not be analyzed safely.",
      severity: "error"
    }]);
  }
}

export function validateVoyageEncounterStationOrder(encounterState) {
  const report = analyzeVoyageEncounterStationOrder(encounterState);
  return {
    valid: report.valid,
    errors: cloneIssues(report.errors),
    warnings: cloneIssues(report.warnings)
  };
}
