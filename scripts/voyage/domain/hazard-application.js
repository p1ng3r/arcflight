import {
  VOYAGE_HAZARD_CATEGORIES,
  VOYAGE_HAZARD_EVENT_TYPES,
  VOYAGE_HAZARD_STATUSES,
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "./constants.js";
import { captureVoyageHazardRecord } from "./hazard-schema.js";
import { applyVoyageDomainPressureEffect } from "./pressure.js";
import { validateVoyageEncounterState } from "./validation.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ADDRESS_HAZARD_REQUEST_KEYS = Object.freeze([
  "kind",
  "encounterId",
  "expectedRevision",
  "hazardId",
  "existingHazardIndex",
  "previousHazard",
  "outcome"
]);
const ADDRESS_HAZARD_OUTCOMES = Object.freeze([
  "critical-success",
  "success",
  "failure",
  "critical-failure"
]);
const SUCCESSFUL_OUTCOMES = new Set(["critical-success", "success"]);
const PRESSURE_SYSTEM_IDS = new Set(VOYAGE_PRESSURE_SYSTEM_IDS);
const RESOLVED_TERMINAL_REASON = "addressed";
const RESOLVED_EVENT_KEYS = Object.freeze([
  "type",
  "encounterId",
  "lifecycleState",
  "stageId",
  "roundNumber",
  "phase",
  "hazardId",
  "pressureSystemId",
  "outcome",
  "previousRevision",
  "revision",
  "previousHazard",
  "hazard",
  "benefit"
]);

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const key = `${entry.severity}\u0000${entry.code}\u0000${entry.path}\u0000${entry.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function failure(errors, warnings = []) {
  return {
    ok: false,
    nextState: null,
    events: [],
    errors: deduplicateIssues(errors),
    warnings: deduplicateIssues(warnings)
  };
}

function success(nextState, event, warnings = []) {
  return {
    ok: true,
    nextState,
    events: [event],
    errors: [],
    warnings: deduplicateIssues(warnings)
  };
}

function captureFailure(path) {
  return {
    ok: false,
    value: null,
    error: issue("address-hazard-data-read-failed", path, "Address Hazard data could not be read safely.")
  };
}

function capturePlainData(value, path = "$", ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") return Number.isFinite(value) ? { ok: true, value } : captureFailure(path);
  if (typeof value !== "object" || ancestors.has(value)) return captureFailure(path);

  let prototype;
  let keys;
  let array;
  try {
    prototype = Object.getPrototypeOf(value);
    array = Array.isArray(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return captureFailure(path);
  }
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return captureFailure(path);

  ancestors.add(value);
  try {
    if (array) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      const length = lengthDescriptor?.value;
      if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value") || !Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) {
        return captureFailure(path);
      }
      const clone = new Array(length);
      for (let index = 0; index < length; index += 1) {
        const key = String(index);
        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, key);
        } catch {
          return captureFailure(`${path}[${index}]`);
        }
        if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return captureFailure(`${path}[${index}]`);
        const nested = capturePlainData(descriptor.value, `${path}[${index}]`, ancestors);
        if (!nested.ok) return nested;
        clone[index] = nested.value;
      }
      return { ok: true, value: clone };
    }

    const clone = {};
    for (const key of keys) {
      if (typeof key !== "string" || UNSAFE_KEYS.has(key)) return captureFailure(`${path}.${typeof key === "symbol" ? "[symbol]" : key}`);
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        return captureFailure(`${path}.${key}`);
      }
      if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return captureFailure(`${path}.${key}`);
      const nested = capturePlainData(descriptor.value, `${path}.${key}`, ancestors);
      if (!nested.ok) return nested;
      clone[key] = nested.value;
    }
    return { ok: true, value: clone };
  } finally {
    ancestors.delete(value);
  }
}

function rebaseIssues(errors, path) {
  return errors.map((entry) => ({
    ...entry,
    path: entry.path === "$" ? path : `${path}${entry.path.startsWith("$") ? entry.path.slice(1) : `.${entry.path}`}`
  }));
}

function equalData(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!equalData(left[index], right[index])) return false;
    }
    return true;
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.hasOwn(right, key) || !equalData(left[key], right[key])) return false;
  }
  return true;
}

function readExactRequest(value, errors) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    errors.push(issue("address-hazard-request-invalid", "request", "Address Hazard request must be a plain object."));
    return null;
  }
  const keys = Object.keys(value);
  if (keys.length !== ADDRESS_HAZARD_REQUEST_KEYS.length || keys.some((key, index) => key !== ADDRESS_HAZARD_REQUEST_KEYS[index])) {
    errors.push(issue("address-hazard-request-invalid", "request", "Address Hazard request must use the exact authorized schema and key order."));
    return null;
  }
  return value;
}

function validateLiveSource(state, request, errors) {
  if (request.encounterId !== state.encounterId) {
    errors.push(issue("address-hazard-encounter-mismatch", "request.encounterId", "Address Hazard request encounterId does not match state."));
    return null;
  }
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
    errors.push(issue("address-hazard-request-invalid", "request.expectedRevision", "Address Hazard expectedRevision must be a nonnegative safe integer."));
    return null;
  }
  if (request.expectedRevision !== state.revision) {
    errors.push(issue("address-hazard-revision-mismatch", "request.expectedRevision", "Address Hazard expectedRevision does not match state."));
    return null;
  }
  if (!Number.isSafeInteger(request.existingHazardIndex) || request.existingHazardIndex < 0 || request.existingHazardIndex >= state.activeHazards.length) {
    errors.push(issue("address-hazard-index-invalid", "request.existingHazardIndex", "Address Hazard index must identify one current activeHazards entry."));
    return null;
  }

  const liveCapture = captureVoyageHazardRecord(state.activeHazards[request.existingHazardIndex], {
    mode: "active",
    expectedEncounterId: state.encounterId
  });
  if (!liveCapture.ok) {
    errors.push(
      issue("address-hazard-live-hazard-invalid", `state.activeHazards[${request.existingHazardIndex}]`, "Address Hazard requires a valid active Hazard."),
      ...rebaseIssues(liveCapture.errors, `state.activeHazards[${request.existingHazardIndex}]`)
    );
    return null;
  }

  const liveHazard = liveCapture.record;
  if (
    liveHazard.status !== VOYAGE_HAZARD_STATUSES.ACTIVE
    || liveHazard.category !== VOYAGE_HAZARD_CATEGORIES.SYSTEM
    || liveHazard.hazardId !== request.hazardId
    || liveHazard.encounterId !== state.encounterId
    || !PRESSURE_SYSTEM_IDS.has(liveHazard.pressureSystemId)
    || liveHazard.failurePressureSystemId !== liveHazard.pressureSystemId
  ) {
    errors.push(issue("address-hazard-live-hazard-mismatch", `state.activeHazards[${request.existingHazardIndex}]`, "The exact indexed Hazard does not satisfy Address Hazard requirements."));
    return null;
  }

  const previousCapture = captureVoyageHazardRecord(request.previousHazard, {
    mode: "active",
    expectedEncounterId: state.encounterId
  });
  if (!previousCapture.ok) {
    errors.push(
      issue("address-hazard-snapshot-invalid", "request.previousHazard", "Address Hazard previousHazard must be a valid active Hazard snapshot."),
      ...rebaseIssues(previousCapture.errors, "request.previousHazard")
    );
    return null;
  }
  if (!equalData(liveHazard, previousCapture.record)) {
    errors.push(issue("address-hazard-snapshot-mismatch", "request.previousHazard", "Address Hazard previousHazard does not match the exact indexed live Hazard."));
    return null;
  }
  if (liveHazard.removalMethod.methodId !== "address-hazard") {
    errors.push(issue("address-hazard-removal-method-invalid", `state.activeHazards[${request.existingHazardIndex}].removalMethod`, "Hazard removalMethod does not permit Address Hazard."));
    return null;
  }
  return { liveHazard, previousHazard: previousCapture.record };
}

function criticalSuccessBenefit(hazard, errors) {
  const benefit = hazard.removalMethod.criticalSuccessBenefit;
  if (
    !Object.hasOwn(hazard.removalMethod, "criticalSuccessBenefit")
    || benefit === null
    || typeof benefit !== "object"
    || Array.isArray(benefit)
    || Object.getPrototypeOf(benefit) !== Object.prototype
    || Object.keys(benefit).length === 0
  ) {
    errors.push(issue("address-hazard-critical-benefit-invalid", "request.previousHazard.removalMethod.criticalSuccessBenefit", "Critical-success Address Hazard requires one authored non-empty plain benefit descriptor."));
    return null;
  }
  const captured = capturePlainData(benefit, "request.previousHazard.removalMethod.criticalSuccessBenefit");
  if (!captured.ok) {
    errors.push(issue("address-hazard-critical-benefit-invalid", "request.previousHazard.removalMethod.criticalSuccessBenefit", "Critical-success Address Hazard benefit could not be captured safely."));
    return null;
  }
  return captured.value;
}

function buildTerminalHazard(previousHazard, state) {
  const terminal = capturePlainData(previousHazard, "previousHazard");
  if (!terminal.ok) return null;
  terminal.value.status = VOYAGE_HAZARD_STATUSES.RESOLVED;
  terminal.value.resolvedStageId = state.currentStage.stageId;
  terminal.value.resolvedRoundNumber = state.roundNumber;
  terminal.value.terminalReason = RESOLVED_TERMINAL_REASON;
  terminal.value.replacedByHazardId = null;
  return terminal.value;
}

function buildResolvedEvent(state, request, previousHazard, hazard, benefit, revision) {
  const event = {
    type: VOYAGE_HAZARD_EVENT_TYPES.RESOLVED,
    encounterId: state.encounterId,
    lifecycleState: state.lifecycleState,
    stageId: state.currentStage.stageId,
    roundNumber: state.roundNumber,
    phase: state.phase,
    hazardId: previousHazard.hazardId,
    pressureSystemId: previousHazard.pressureSystemId,
    outcome: request.outcome,
    previousRevision: state.revision,
    revision,
    previousHazard: capturePlainData(previousHazard, "event.previousHazard").value,
    hazard: capturePlainData(hazard, "event.hazard").value,
    benefit: benefit === null ? null : capturePlainData(benefit, "event.benefit").value
  };
  return Object.keys(event).every((key, index) => key === RESOLVED_EVENT_KEYS[index]) && Object.keys(event).length === RESOLVED_EVENT_KEYS.length
    ? event
    : null;
}

/**
 * Apply one precomputed Address Hazard outcome. The request is live-bound to
 * one active Hazard; callers cannot provide a plan or generated effect.
 */
export function applyVoyageAddressHazard(encounterState, request) {
  const capturedState = capturePlainData(encounterState, "encounterState");
  if (!capturedState.ok) return failure([capturedState.error]);
  const capturedRequest = capturePlainData(request, "request");
  if (!capturedRequest.ok) return failure([capturedRequest.error]);

  const stateValidation = validateVoyageEncounterState(capturedState.value);
  if (!stateValidation.valid) {
    return failure([
      issue("address-hazard-state-invalid", "encounterState", "Address Hazard requires a valid Voyage Encounter state."),
      ...rebaseIssues(stateValidation.errors, "encounterState")
    ], stateValidation.warnings);
  }

  const errors = [];
  const parsedRequest = readExactRequest(capturedRequest.value, errors);
  if (!parsedRequest) return failure(errors, stateValidation.warnings);
  if (parsedRequest.kind !== "address-hazard") errors.push(issue("address-hazard-request-invalid", "request.kind", "Address Hazard request kind is not authorized."));
  if (typeof parsedRequest.encounterId !== "string" || parsedRequest.encounterId.trim().length === 0) errors.push(issue("address-hazard-request-invalid", "request.encounterId", "Address Hazard encounterId must be nonblank."));
  if (typeof parsedRequest.hazardId !== "string" || parsedRequest.hazardId.trim().length === 0) errors.push(issue("address-hazard-request-invalid", "request.hazardId", "Address Hazard hazardId must be nonblank."));
  if (errors.length > 0) return failure(errors, stateValidation.warnings);

  const source = validateLiveSource(capturedState.value, parsedRequest, errors);
  if (!source) return failure(errors, stateValidation.warnings);
  if (!ADDRESS_HAZARD_OUTCOMES.includes(parsedRequest.outcome)) {
    return failure([issue("address-hazard-outcome-invalid", "request.outcome", "Address Hazard outcome is not authorized.")], stateValidation.warnings);
  }

  if (!SUCCESSFUL_OUTCOMES.has(parsedRequest.outcome)) {
    const pressureRequest = {
      kind: "domain-pressure-effect",
      encounterId: capturedState.value.encounterId,
      expectedRevision: capturedState.value.revision,
      pressureSystemId: source.liveHazard.pressureSystemId,
      delta: parsedRequest.outcome === "failure" ? 1 : 2,
      source: {
        kind: "hazard-address-failure",
        hazardId: source.liveHazard.hazardId,
        existingHazardIndex: parsedRequest.existingHazardIndex,
        previousHazard: capturePlainData(source.previousHazard, "pressureRequest.source.previousHazard").value,
        addressOutcome: parsedRequest.outcome
      }
    };
    return applyVoyageDomainPressureEffect(capturedState.value, pressureRequest);
  }

  const benefit = parsedRequest.outcome === "critical-success" ? criticalSuccessBenefit(source.liveHazard, errors) : null;
  if (errors.length > 0) return failure(errors, stateValidation.warnings);
  if (!Number.isSafeInteger(capturedState.value.revision + 1)) {
    return failure([issue("address-hazard-revision-overflow", "encounterState.revision", "Address Hazard revision increment would overflow the safe integer range.")], stateValidation.warnings);
  }

  const terminalCandidate = buildTerminalHazard(source.previousHazard, capturedState.value);
  if (!terminalCandidate) return failure([issue("address-hazard-terminal-invalid", "hazard", "Address Hazard terminal snapshot could not be constructed safely.")], stateValidation.warnings);
  const terminalCapture = captureVoyageHazardRecord(terminalCandidate, {
    mode: "snapshot",
    expectedEncounterId: capturedState.value.encounterId
  });
  if (!terminalCapture.ok) {
    return failure([
      issue("address-hazard-terminal-invalid", "hazard", "Address Hazard terminal snapshot is not valid."),
      ...rebaseIssues(terminalCapture.errors, "hazard")
    ], stateValidation.warnings);
  }

  const nextCapture = capturePlainData(capturedState.value, "nextState");
  if (!nextCapture.ok) return failure([issue("address-hazard-final-state-invalid", "nextState", "Address Hazard candidate state could not be constructed safely.")], stateValidation.warnings);
  const nextState = nextCapture.value;
  nextState.activeHazards.splice(parsedRequest.existingHazardIndex, 1);
  nextState.revision += 1;
  const finalValidation = validateVoyageEncounterState(nextState);
  const warnings = [...stateValidation.warnings, ...finalValidation.warnings];
  if (!finalValidation.valid) {
    return failure([
      issue("address-hazard-final-state-invalid", "nextState", "Address Hazard candidate state failed final validation."),
      ...rebaseIssues(finalValidation.errors, "nextState")
    ], warnings);
  }

  const event = buildResolvedEvent(
    capturedState.value,
    parsedRequest,
    source.previousHazard,
    terminalCapture.record,
    benefit,
    nextState.revision
  );
  if (!event) return failure([issue("address-hazard-event-invalid", "event", "Address Hazard resolution event did not satisfy its exact shape.")], warnings);
  return success(nextState, event, warnings);
}
