import {
  VOYAGE_ACTION_EXECUTION_MODES as MODES,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE,
  VOYAGE_ROUND_PHASES as PHASES,
  VOYAGE_PENDING_CHECK_STATUSES as STATUSES
} from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";
import { deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { analyzeVoyageEncounterActionExecutionRequests, prepareVoyageEncounterActionExecutionRequests } from "./resolution-execution-requests.js";

const REQUIRED = Object.freeze([
  "pendingCheckId",
  "preparedRevision",
  "stageId",
  "roundNumber",
  "sequence",
  "stationId",
  "actionId",
  "resolutionPriority",
  "riskBidId",
  "dcAdjustment",
  "target",
  "mode",
  "source",
  "statisticOptions",
  "dcSource",
  "secrecy",
  "metadata",
  "status",
  "result"
]);
const REQUIRED_SET = new Set(REQUIRED);
const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });

function readOwnValue(object, key, path, errors, code = "pending-check-data-read-failed") {
  if (
    object === null
    || (typeof object !== "object" && typeof object !== "function")
  ) {
    return { present: false, ok: false, value: undefined };
  }

  if (!Object.hasOwn(object, key)) {
    return { present: false, ok: true, value: undefined };
  }

  try {
    return { present: true, ok: true, value: object[key] };
  } catch {
    issue(errors, code, path, "Pending check data could not be read safely.");
    return { present: true, ok: false, value: undefined };
  }
}

function readOwnDataValue(object, key, path, errors) {
  if (
    object === null
    || (typeof object !== "object" && typeof object !== "function")
  ) {
    return { present: false, ok: false, value: undefined };
  }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return { present: false, ok: true, value: undefined };
    if (!Object.hasOwn(descriptor, "value")) {
      issue(
        errors,
        "pending-check-data-read-failed",
        path,
        "Pending check Risk Bid metadata must use own data properties."
      );
      return { present: true, ok: false, value: undefined };
    }
    return { present: true, ok: true, value: descriptor.value };
  } catch {
    issue(errors, "pending-check-data-read-failed", path, "Pending check data could not be read safely.");
    return { present: true, ok: false, value: undefined };
  }
}

function numericIndices(array) {
  if (!Array.isArray(array)) return [];

  const result = [];
  for (let index = 0; index < array.length; index += 1) {
    if (Object.hasOwn(array, index)) result.push(index);
  }
  return result;
}

function capturePlainData(value, path, errors, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { ok: true, value };
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) return { ok: true, value };
    issue(errors, "invalid-pending-check-plain-data", path, "Pending check data numbers must be finite.");
    return { ok: false, value: undefined };
  }

  if (typeof value !== "object" || ancestors.has(value)) {
    issue(errors, "invalid-pending-check-plain-data", path, "Pending check data must be recursively plain and acyclic.");
    return { ok: false, value: undefined };
  }

  const array = Array.isArray(value);
  if (!array && !isPlainObject(value)) {
    issue(errors, "invalid-pending-check-plain-data", path, "Pending check data must be recursively plain.");
    return { ok: false, value: undefined };
  }

  ancestors.add(value);

  if (array) {
    const result = new Array(value.length);
    let ok = true;

    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) continue;

      const childPath = `${path}[${index}]`;
      const read = readOwnValue(value, index, childPath, errors);
      if (!read.ok) {
        ok = false;
        continue;
      }

      const child = capturePlainData(read.value, childPath, errors, ancestors);
      if (!child.ok) {
        ok = false;
        continue;
      }

      result[index] = child.value;
    }

    ancestors.delete(value);
    return { ok, value: ok ? result : undefined };
  }

  const result = {};
  let ok = true;
  for (const key of Object.keys(value)) {
    const childPath = `${path}.${key}`;
    const read = readOwnValue(value, key, childPath, errors);
    if (!read.ok) {
      ok = false;
      continue;
    }

    const child = capturePlainData(read.value, childPath, errors, ancestors);
    if (!child.ok) {
      ok = false;
      continue;
    }

    Object.defineProperty(result, key, {
      value: child.value,
      enumerable: true,
      writable: true,
      configurable: true
    });
  }

  ancestors.delete(value);
  return { ok, value: ok ? result : undefined };
}

function captureRecord(record, path, errors) {
  const captured = Object.create(null);
  const present = new Set();
  const originals = Object.create(null);

  for (let fieldIndex = 0; fieldIndex < REQUIRED.length; fieldIndex += 1) {
    const field = REQUIRED[fieldIndex];
    const fieldPath = `${path}.${field}`;
    const read = field === "riskBidId" || field === "dcAdjustment"
      ? readOwnDataValue(record, field, fieldPath, errors)
      : readOwnValue(record, field, fieldPath, errors);
    if (!read.present) {
      issue(errors, "missing-pending-check-field", fieldPath, `Pending check requires ${field}.`);
      continue;
    }

    present.add(field);
    if (field === "result") Object.defineProperty(originals, field, { value: read.value, enumerable: true });
    if (!read.ok) continue;

    const value = capturePlainData(read.value, fieldPath, errors);
    if (value.ok) {
      Object.defineProperty(captured, field, {
        value: value.value,
        enumerable: true,
        writable: true,
        configurable: true
      });
    }
  }

  return { captured, present, originals };
}

function equal(left, right) {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;

    for (let index = 0; index < left.length; index += 1) {
      if (Object.hasOwn(left, index) !== Object.hasOwn(right, index)) return false;
      if (Object.hasOwn(left, index) && !equal(left[index], right[index])) return false;
    }
    return true;
  }

  if (!isPlainObject(left) || !isPlainObject(right)) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (!Object.hasOwn(right, key) || !equal(left[key], right[key])) return false;
  }
  return true;
}

const validId = (value) => typeof value === "string" && value.trim().length > 0 && !UNSAFE.has(value);
function hasExactOwnDataFields(value, fields) {
  if (!isPlainObject(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length || keys.some((key) => typeof key !== "string" || !fields.includes(key))) return false;
    return fields.every((field) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      return descriptor && Object.hasOwn(descriptor, "value");
    });
  } catch { return false; }
}

function pendingChecksAreEmpty(pendingChecks) {
  if (!Array.isArray(pendingChecks)) return false;

  for (let index = 0; index < pendingChecks.length; index += 1) {
    if (Object.hasOwn(pendingChecks, index)) return false;
  }
  return true;
}

function validatePendingChecksAgainstReport(state, report, structural) {
  const errors = [...report.errors];
  const warnings = [...structural.warnings, ...report.warnings];
  const pendingChecks = state.pendingChecks;

  if (!Array.isArray(pendingChecks)) {
    issue(errors, "invalid-pending-checks", "pendingChecks", "pendingChecks must be an array.");
  }

  const expected = new Map();
  for (let requestIndex = 0; requestIndex < report.executionRequests.length; requestIndex += 1) {
    const request = report.executionRequests[requestIndex];
    if (request.mode === MODES.CHECK) expected.set(request.sequence, request);
  }

  const ids = new Set();
  const sequences = new Set();
  const capturedRecords = [];
  let previous = -1;

  if (Array.isArray(pendingChecks)) {
    for (let index = 0; index < pendingChecks.length; index += 1) {
      if (!Object.hasOwn(pendingChecks, index)) continue;

      const path = `pendingChecks[${index}]`;
      const recordRead = readOwnValue(pendingChecks, index, path, errors);
      if (!recordRead.ok) continue;

      const record = recordRead.value;
      if (!isPlainObject(record)) {
        issue(errors, "invalid-pending-check", path, "Pending check must be a plain object.");
        continue;
      }

      const captured = captureRecord(record, path, errors);
      const capturedRecord = captured.captured;
      const originalResult = captured.originals.result;
      for (const key of Reflect.ownKeys(record)) {
        if (typeof key !== "string" || !REQUIRED_SET.has(key)) {
          issue(errors, "unexpected-pending-check-field", `${path}.${String(key)}`, "Pending check has an unexpected own field.");
        }
      }

      const pendingCheckId = capturedRecord.pendingCheckId;
      if (!validId(pendingCheckId)) {
        issue(errors, "invalid-pending-check-id", `${path}.pendingCheckId`, "Pending check ID must be a safe non-blank exact string.");
      } else if (ids.has(pendingCheckId)) {
        issue(errors, "duplicate-pending-check-id", `${path}.pendingCheckId`, "Pending check IDs must be unique.");
      } else {
        ids.add(pendingCheckId);
      }

      const sequence = capturedRecord.sequence;
      if (!Number.isSafeInteger(sequence) || sequence < 0) {
        issue(errors, "invalid-pending-check-sequence", `${path}.sequence`, "Pending check sequence must be a non-negative safe integer.");
      } else {
        if (sequences.has(sequence)) issue(errors, "duplicate-pending-check-sequence", `${path}.sequence`, "Pending check sequences must be unique.");
        sequences.add(sequence);
        if (sequence < previous) issue(errors, "pending-check-order", `${path}.sequence`, "Pending checks must be in ascending execution sequence.");
        previous = sequence;
      }

      if (
        !Number.isSafeInteger(capturedRecord.preparedRevision)
        || capturedRecord.preparedRevision < 0
        || capturedRecord.preparedRevision > state.revision
      ) issue(errors, "invalid-pending-check-prepared-revision", `${path}.preparedRevision`, "preparedRevision must not exceed the encounter revision.");

      if (capturedRecord.stageId !== state.currentStage?.stageId) issue(errors, "pending-check-stage-mismatch", `${path}.stageId`, "Pending check stage must match current stage.");
      if (capturedRecord.roundNumber !== state.roundNumber) issue(errors, "pending-check-round-mismatch", `${path}.roundNumber`, "Pending check round must match current round.");
      if (capturedRecord.mode !== MODES.CHECK) issue(errors, "invalid-pending-check-mode", `${path}.mode`, "Pending check mode must be check.");
      if (![STATUSES.PENDING, STATUSES.RESOLVED].includes(capturedRecord.status)) issue(errors, "invalid-pending-check-status", `${path}.status`, "Pending check status must be pending or resolved.");
      if (capturedRecord.status === STATUSES.PENDING && capturedRecord.result !== null) issue(errors, "invalid-pending-check-result", `${path}.result`, "Pending check result must be null.");
      if (capturedRecord.status === STATUSES.RESOLVED) {
        const result = capturedRecord.result ?? originalResult;
        const keys = ["total", "degreeOfSuccess", "degreeOfSuccessSlug", "statisticSlug", "dc", "rollMode"];
        if (!hasExactOwnDataFields(originalResult, keys)) issue(errors, "invalid-pending-check-result", `${path}.result`, "Resolved pending check result has an invalid shape.");
        else {
          const slugs = ["critical-failure", "failure", "success", "critical-success"];
          if (!Number.isFinite(result.total) || !Number.isSafeInteger(result.degreeOfSuccess) || result.degreeOfSuccess < 0 || result.degreeOfSuccess > 3 || result.degreeOfSuccessSlug !== slugs[result.degreeOfSuccess]) issue(errors, "invalid-pending-check-result", `${path}.result`, "Resolved result degree or total is invalid.");
          let authoredStatistic = false;
          if (Array.isArray(capturedRecord.statisticOptions)) {
            for (let optionIndex = 0; optionIndex < capturedRecord.statisticOptions.length; optionIndex += 1) {
              if (Object.hasOwn(capturedRecord.statisticOptions, optionIndex)
                && capturedRecord.statisticOptions[optionIndex] === result.statisticSlug) {
                authoredStatistic = true;
                break;
              }
            }
          }
          if (!authoredStatistic) issue(errors, "invalid-pending-check-result", `${path}.result.statisticSlug`, "Resolved result statistic must be authored.");
          if (!Number.isSafeInteger(result.dc) || result.dc < 0 || capturedRecord.dcSource?.kind !== "fixed" || result.dc !== capturedRecord.dcSource.value) issue(errors, "invalid-pending-check-result", `${path}.result.dc`, "Resolved result DC must match fixed authored DC.");
          const expectedMode = capturedRecord.secrecy === "secret" ? "blind" : "public";
          if (result.rollMode !== expectedMode) issue(errors, "invalid-pending-check-result", `${path}.result.rollMode`, "Resolved result roll mode must match secrecy.");
        }
      }

      const request = expected.get(sequence);
      if (!request) {
        issue(errors, "unexpected-pending-check", path, "Pending check does not correspond to a selected check action.");
      } else {
        const fields = ["stationId", "actionId", "resolutionPriority", "riskBidId", "dcAdjustment", "target", "source", "statisticOptions", "dcSource", "secrecy", "metadata"];
        for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
          const field = fields[fieldIndex];
          if (!equal(capturedRecord[field], request[field])) issue(errors, "pending-check-request-mismatch", `${path}.${field}`, `Pending check ${field} must match its execution request.`);
        }
      }

      capturedRecords.push({ pendingCheckIndex: index, record: capturedRecord });
    }
  }

  if (!pendingChecksAreEmpty(pendingChecks)) {
    for (const sequence of expected.keys()) {
      if (!sequences.has(sequence)) issue(errors, "missing-pending-check", "pendingChecks", `Selected check action sequence ${sequence} has no pending check.`);
    }
  }

  const final = deduplicateVoyageResolutionIssues(errors);
  return {
    valid: final.length === 0,
    errors: final,
    warnings: deduplicateVoyageResolutionIssues(warnings),
    capturedRecords
  };
}

function normalizePendingCheck({ pendingCheckIndex, record }) {
  return {
    pendingCheckIndex,
    pendingCheckId: record.pendingCheckId,
    preparedRevision: record.preparedRevision,
    stageId: record.stageId,
    roundNumber: record.roundNumber,
    sequence: record.sequence,
    stationId: record.stationId,
    actionId: record.actionId,
    resolutionPriority: record.resolutionPriority,
    riskBidId: record.riskBidId,
    dcAdjustment: record.dcAdjustment,
    target: record.target,
    mode: record.mode,
    source: record.source,
    statisticOptions: record.statisticOptions,
    dcSource: record.dcSource,
    secrecy: record.secrecy,
    metadata: record.metadata,
    status: record.status,
    result: record.result
  };
}

export function analyzeVoyageEncounterPendingChecks(state) {
  try {
    const structural = validateVoyageEncounterState(state);
    const structuralErrors = deduplicateVoyageResolutionIssues(structural.errors);
    const structuralWarnings = deduplicateVoyageResolutionIssues(structural.warnings);
    if (!structural.valid) {
      return {
        structurallyValid: false,
        pendingChecksValid: false,
        pendingCheckCount: 0,
        unresolvedCheckCount: 0,
        resolvedCheckCount: 0,
        pendingChecks: [],
        errors: structuralErrors,
        warnings: structuralWarnings
      };
    }

    const execution = analyzeVoyageEncounterActionExecutionRequests(state, { requireResolution: false });
    const validation = validatePendingChecksAgainstReport(state, execution, structural);
    if (!validation.valid) {
      return {
        structurallyValid: true,
        pendingChecksValid: false,
        pendingCheckCount: 0,
        unresolvedCheckCount: 0,
        resolvedCheckCount: 0,
        pendingChecks: [],
        errors: validation.errors,
        warnings: validation.warnings
      };
    }

    const pendingChecks = validation.capturedRecords.map(normalizePendingCheck);
    const unresolvedCheckCount = pendingChecks.filter((record) => record.status === STATUSES.PENDING).length;
    return {
      structurallyValid: true,
      pendingChecksValid: true,
      pendingCheckCount: pendingChecks.length,
      unresolvedCheckCount,
      resolvedCheckCount: pendingChecks.length - unresolvedCheckCount,
      pendingChecks,
      errors: validation.errors,
      warnings: validation.warnings
    };
  } catch {
    return {
      structurallyValid: false,
      pendingChecksValid: false,
      pendingCheckCount: 0,
      unresolvedCheckCount: 0,
      resolvedCheckCount: 0,
      pendingChecks: [],
      errors: [{ code: "invalid-pending-checks", path: "pendingChecks", message: "pendingChecks could not be analyzed safely.", severity: "error" }],
      warnings: []
    };
  }
}

export function validateVoyageEncounterPendingChecks(state) {
  const report = analyzeVoyageEncounterPendingChecks(state);
  return {
    valid: report.structurallyValid && report.pendingChecksValid,
    errors: [...report.errors],
    warnings: [...report.warnings]
  };
}

const fail = (errors, warnings = []) => ({
  ok: false,
  nextState: null,
  events: [],
  errors: deduplicateVoyageResolutionIssues(errors),
  warnings: deduplicateVoyageResolutionIssues(warnings)
});

function capturePreparationMappings(preparationRequest, errors) {
  const mappings = new Map();
  const ids = new Set();
  const requestRead = readOwnValue(preparationRequest, "pendingCheckIds", "preparationRequest.pendingCheckIds", errors, "pending-check-id-mappings-read-failed");

  if (!requestRead.present || !requestRead.ok || !Array.isArray(requestRead.value)) {
    issue(errors, "invalid-pending-check-id-mappings", "preparationRequest.pendingCheckIds", "Preparation requires an own pendingCheckIds array.");
    return { mappings, ids };
  }

  const pendingCheckIds = requestRead.value;
  for (let index = 0; index < pendingCheckIds.length; index += 1) {
    if (!Object.hasOwn(pendingCheckIds, index)) continue;

    const path = `preparationRequest.pendingCheckIds[${index}]`;
    const entryRead = readOwnValue(pendingCheckIds, index, path, errors, "pending-check-id-mapping-read-failed");
    if (!entryRead.ok) continue;

    const entry = entryRead.value;
    if (!isPlainObject(entry)) {
      issue(errors, "invalid-pending-check-id-mapping", path, "Pending check ID mapping must be a plain object.");
      continue;
    }

    const sequenceRead = readOwnValue(entry, "sequence", `${path}.sequence`, errors, "pending-check-mapping-read-failed");
    const idRead = readOwnValue(entry, "pendingCheckId", `${path}.pendingCheckId`, errors, "pending-check-mapping-read-failed");
    const sequence = sequenceRead.ok ? sequenceRead.value : undefined;
    const pendingCheckId = idRead.ok ? idRead.value : undefined;
    const validSequence = sequenceRead.present && sequenceRead.ok && Number.isSafeInteger(sequence) && sequence >= 0;
    const validPendingCheckId = idRead.present && idRead.ok && validId(pendingCheckId);

    if (!validSequence) issue(errors, "invalid-pending-check-mapping-sequence", `${path}.sequence`, "Mapping sequence must be a non-negative safe integer.");
    if (!validPendingCheckId) issue(errors, "invalid-pending-check-mapping-id", `${path}.pendingCheckId`, "Mapping pendingCheckId must be safe and non-blank.");

    if (validSequence) {
      if (mappings.has(sequence)) issue(errors, "duplicate-pending-check-mapping-sequence", `${path}.sequence`, "Mapping sequences must be unique.");
      mappings.set(sequence, pendingCheckId);
    }

    if (validPendingCheckId) {
      if (ids.has(pendingCheckId)) issue(errors, "duplicate-pending-check-mapping-id", `${path}.pendingCheckId`, "Mapping IDs must be unique.");
      ids.add(pendingCheckId);
    }
  }

  return { mappings, ids };
}

export function applyVoyageEncounterPendingCheckPreparation(state, preparationRequest) {
  const structural = validateVoyageEncounterState(state);
  if (!structural.valid) return fail(structural.errors, structural.warnings);

  const existingReport = prepareVoyageEncounterActionExecutionRequests(state);
  const existing = validatePendingChecksAgainstReport(state, existingReport, structural);
  const warnings = [...structural.warnings, ...existing.warnings];
  if (!existing.valid) return fail(existing.errors, warnings);

  if (state.lifecycleState !== LIFE.ACTIVE) return fail([{ code: "pending-check-preparation-requires-active", path: "lifecycleState", message: "Preparing pending checks requires an Active encounter.", severity: "error" }], warnings);
  if (state.phase !== PHASES.RESOLUTION) return fail([{ code: "pending-check-preparation-requires-resolution", path: "phase", message: "Preparing pending checks requires Resolution phase.", severity: "error" }], warnings);
  if (!existingReport.readyForExecution) return fail(existingReport.errors, warnings);
  if (!existingReport.checkCount) return fail([{ code: "pending-check-preparation-not-required", path: "pendingChecks", message: "This Resolution plan has no check actions.", severity: "error" }], warnings);
  if (!existingReport.pendingChecksEmpty) return fail([{ code: "pending-checks-not-empty", path: "pendingChecks", message: "Pending checks must be empty before preparation.", severity: "error" }], warnings);

  const errors = [];
  if (!isPlainObject(preparationRequest)) issue(errors, "invalid-pending-check-preparation-request", "preparationRequest", "Preparation request must be a plain object.");
  const { mappings } = capturePreparationMappings(preparationRequest, errors);
  const checks = [];
  for (let requestIndex = 0; requestIndex < existingReport.executionRequests.length; requestIndex += 1) {
    const request = existingReport.executionRequests[requestIndex];
    if (request.mode === MODES.CHECK) checks.push(request);
  }

  for (let checkIndex = 0; checkIndex < checks.length; checkIndex += 1) {
    const request = checks[checkIndex];
    if (!mappings.has(request.sequence)) issue(errors, "missing-pending-check-mapping", "preparationRequest.pendingCheckIds", `Check sequence ${request.sequence} requires an ID mapping.`);
  }
  for (const sequence of mappings.keys()) {
    let found = false;
    for (let checkIndex = 0; checkIndex < checks.length; checkIndex += 1) {
      if (checks[checkIndex].sequence === sequence) {
        found = true;
        break;
      }
    }
    if (!found) issue(errors, "unexpected-pending-check-mapping", "preparationRequest.pendingCheckIds", "Mapping does not identify a check-producing sequence.");
  }
  if (errors.length) return fail(errors, warnings);

  let candidate;
  try {
    candidate = clonePlainData(state);
    candidate.revision = state.revision + 1;
    candidate.pendingChecks = [];
    for (let checkIndex = 0; checkIndex < checks.length; checkIndex += 1) {
      const request = checks[checkIndex];
      candidate.pendingChecks.push({
        pendingCheckId: mappings.get(request.sequence),
        preparedRevision: candidate.revision,
        stageId: candidate.currentStage.stageId,
        roundNumber: candidate.roundNumber,
        ...clonePlainData(request),
        status: "pending",
        result: null
      });
    }
  } catch {
    return fail([{ code: "pending-check-candidate-construction-failed", path: "encounterState", message: "Pending check preparation could not clone encounter state.", severity: "error" }], warnings);
  }

  const final = validateVoyageEncounterState(candidate);
  const pending = validateVoyageEncounterPendingChecks(candidate);
  warnings.push(...final.warnings, ...pending.warnings);
  if (!final.valid || !pending.valid) return fail([...final.errors, ...pending.errors], warnings);

  const preparedChecks = [];
  for (let index = 0; index < candidate.pendingChecks.length; index += 1) {
    const { pendingCheckId, sequence, stationId, actionId } = candidate.pendingChecks[index];
    preparedChecks.push({ pendingCheckId, sequence, stationId, actionId });
  }

  return {
    ok: true,
    nextState: candidate,
    events: [{
      type: "voyage.pending-checks-prepared",
      encounterId: candidate.encounterId,
      lifecycleState: candidate.lifecycleState,
      roundNumber: candidate.roundNumber,
      phase: candidate.phase,
      actionCount: existingReport.actionCount,
      checkCount: existingReport.checkCount,
      noRollActionCount: existingReport.noRollActionCount,
      preparedChecks: clonePlainData(preparedChecks),
      previousRevision: state.revision,
      revision: candidate.revision
    }],
    errors: [],
    warnings: deduplicateVoyageResolutionIssues(warnings)
  };
}
