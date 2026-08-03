import { VOYAGE_HAZARD_CATEGORIES, VOYAGE_HAZARD_EVENT_TYPES, VOYAGE_HAZARD_STATUSES, VOYAGE_PRESSURE_SYSTEM_IDS } from "./constants.js";
import { clonePlainData } from "./defaults.js";
import { captureVoyageHazardRecord } from "./hazard-schema.js";
import { validateVoyageEncounterState } from "./validation.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const PRESSURE_SYSTEM_IDS = new Set(VOYAGE_PRESSURE_SYSTEM_IDS);

const RESULT_FIELDS = Object.freeze([
  "structurallyValid",
  "readyForHazardStageEscalation",
  "outcome",
  "plan",
  "errors",
  "warnings"
]);

const PLAN_FIELDS = Object.freeze([
  "kind",
  "encounterId",
  "expectedRevision",
  "incomingHazardId",
  "existingHazardId",
  "existingHazardIndex",
  "pressureSystemId",
  "collisionPolicy",
  "requestKind",
  "requestedTargetStageId",
  "requestedOperationId",
  "previousStageId",
  "targetStageId",
  "skippedStages",
  "previousExistingHazard",
  "prospectiveHazard",
  "escalationConsequence"
]);

const EVENT_FIELDS = Object.freeze([
  "type",
  "encounterId",
  "hazardId",
  "pressureSystemId",
  "incomingHazardId",
  "collisionPolicy",
  "previousRevision",
  "revision",
  "previousStageId",
  "targetStageId",
  "requestKind",
  "requestedTargetStageId",
  "operationId",
  "skippedStages",
  "previousHazard",
  "hazard"
]);

function issue(code, path, message, severity = "error") {
  return { severity, code, path, message };
}

function deduplicateIssues(errors) {
  const seen = new Set();
  return errors.filter((error) => {
    const key = `${error.severity}\u0000${error.code}\u0000${error.path}\u0000${error.message}`;
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

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function captureFailure(path) {
  return {
    ok: false,
    value: null,
    error: issue(
      "hazard-stage-escalation-application-data-read-failed",
      path,
      "Hazard escalation application data could not be read safely."
    )
  };
}

function capturePlainData(value, path = "$", ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { ok: true, value };
  }
  if (typeof value === "number") return Number.isFinite(value) ? { ok: true, value } : captureFailure(path);
  if (typeof value !== "object") return captureFailure(path);
  if (ancestors.has(value)) return captureFailure(path);

  let prototype;
  let array;
  let ownKeys;
  try {
    prototype = Object.getPrototypeOf(value);
    array = Array.isArray(value);
    ownKeys = Reflect.ownKeys(value);
  } catch {
    return captureFailure(path);
  }

  if (array) {
    if (prototype !== Array.prototype) return captureFailure(path);
  } else if (prototype !== Object.prototype && prototype !== null) {
    return captureFailure(path);
  }

  ancestors.add(value);
  try {
    if (array) {
      let lengthDescriptor;
      try {
        lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      } catch {
        return captureFailure(`${path}.length`);
      }
      const length = lengthDescriptor?.value;
      if (
        !lengthDescriptor
        || !Object.hasOwn(lengthDescriptor, "value")
        || !Number.isSafeInteger(length)
        || length < 0
        || ownKeys.length !== length + 1
      ) return captureFailure(path);

      const clone = new Array(length);
      for (let index = 0; index < length; index += 1) {
        const key = String(index);
        if (!ownKeys.includes(key)) return captureFailure(`${path}[${index}]`);
        let descriptor;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, key);
        } catch {
          return captureFailure(`${path}[${index}]`);
        }
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
          return captureFailure(`${path}[${index}]`);
        }
        const nested = capturePlainData(descriptor.value, `${path}[${index}]`, ancestors);
        if (!nested.ok) return nested;
        clone[index] = nested.value;
      }

      for (const key of ownKeys) {
        if (key === "length") continue;
        if (typeof key !== "string" || !/^0$|^[1-9]\d*$/.test(key) || Number(key) >= length) {
          return captureFailure(`${path}.${typeof key === "symbol" ? "[symbol]" : key}`);
        }
      }
      return { ok: true, value: clone };
    }

    const clone = {};
    for (const key of ownKeys) {
      if (typeof key !== "string") return captureFailure(`${path}.[symbol]`);
      if (UNSAFE_KEYS.has(key)) return captureFailure(`${path}.${key}`);
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        return captureFailure(`${path}.${key}`);
      }
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
        return captureFailure(`${path}.${key}`);
      }
      const nested = capturePlainData(descriptor.value, `${path}.${key}`, ancestors);
      if (!nested.ok) return nested;
      clone[key] = nested.value;
    }
    return { ok: true, value: clone };
  } finally {
    ancestors.delete(value);
  }
}

function rebaseIssues(errors, basePath) {
  return errors.map((error) => {
    const path = typeof error?.path === "string" ? error.path : "$";
    const suffix = path === "$" ? "" : path.startsWith("$") ? path.slice(1) : `.${path}`;
    return issue(
      error?.code ?? "hazard-stage-escalation-application-plan-invalid",
      `${basePath}${suffix}`,
      error?.message ?? "Hazard escalation application data is invalid.",
      error?.severity ?? "error"
    );
  });
}

function exactKeys(value, expected, path, errors, code = "hazard-stage-escalation-application-plan-invalid") {
  const expectedSet = new Set(expected);
  for (const key of Object.keys(value)) {
    if (!expectedSet.has(key)) errors.push(issue(code, `${path}.${key}`, "Object contains an unexpected field."));
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) errors.push(issue(code, `${path}.${key}`, "Object requires this field."));
  }
}

function nonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sameData(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;

  if (Array.isArray(left)) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (Object.hasOwn(left, index) !== Object.hasOwn(right, index)) return false;
      if (!Object.hasOwn(left, index) || !sameData(left[index], right[index])) return false;
    }
    return Object.keys(left).sort().join("\u0000") === Object.keys(right).sort().join("\u0000");
  }

  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    if (leftKeys[index] !== rightKeys[index]) return false;
    const key = leftKeys[index];
    if (!sameData(left[key], right[key])) return false;
  }
  return true;
}

function sameExceptAuthorizedChanges(previous, prospective) {
  const authorizedTopLevel = new Set(["currentEffect", "ignoredConsequence"]);
  for (const key of Object.keys(previous)) {
    if (authorizedTopLevel.has(key)) continue;
    if (key === "escalation") {
      const previousEscalation = previous.escalation;
      const prospectiveEscalation = prospective.escalation;
      const escalationKeys = Object.keys(previousEscalation).sort();
      if (!sameData(escalationKeys, Object.keys(prospectiveEscalation).sort())) return false;
      for (const escalationKey of escalationKeys) {
        if (escalationKey === "currentStageId" || escalationKey === "maximumEscalationReached") continue;
        if (!sameData(previousEscalation[escalationKey], prospectiveEscalation[escalationKey])) return false;
      }
      continue;
    }
    if (!sameData(previous[key], prospective[key])) return false;
  }
  return true;
}

function captureHazard(value, path, encounterId, errors) {
  const captured = captureVoyageHazardRecord(value, { mode: "active", expectedEncounterId: encounterId });
  if (!captured.ok) {
    errors.push(...rebaseIssues(captured.errors, path));
    return null;
  }
  return captured.record;
}

function validateStructuralApplicationResult(escalationResult) {
  const errors = [];
  if (!isPlainObject(escalationResult)) {
    return {
      ok: false,
      errors: [issue("hazard-stage-escalation-application-plan-invalid", "escalationResult", "Task 4B2 result must be a plain object.")],
      plan: null
    };
  }
  exactKeys(escalationResult, RESULT_FIELDS, "escalationResult", errors);
  if (errors.length > 0) return { ok: false, errors, plan: null };

  const outcome = escalationResult.outcome;
  const isReadyOutcome = outcome === "escalation-ready";
  const isMaximumOutcome = outcome === "maximum-escalation";
  const isInvalidOutcome = outcome === "invalid-or-not-applicable";
  if (!isReadyOutcome && !isMaximumOutcome && !isInvalidOutcome) {
    errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.outcome", "Task 4B2 result outcome is not recognized."));
  }
  if (isInvalidOutcome) {
    if (escalationResult.structurallyValid !== false) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.structurallyValid", "Invalid Task 4B2 results must be marked structurally invalid."));
    if (escalationResult.readyForHazardStageEscalation !== false) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.readyForHazardStageEscalation", "Invalid Task 4B2 results must not be ready for stage escalation."));
    if (!Array.isArray(escalationResult.errors) || escalationResult.errors.length === 0) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.errors", "Invalid Task 4B2 results require a non-empty errors array."));
    if (!Array.isArray(escalationResult.warnings)) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.warnings", "Task 4B2 result warnings must be an array."));
    if (escalationResult.plan !== null) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan", "Invalid Task 4B2 results require a null plan."));
    if (errors.length > 0) return { ok: false, errors, plan: null };
    return {
      ok: false,
      errors: [issue("hazard-stage-escalation-application-not-ready", "escalationResult.outcome", "Only an escalation-ready Task 4B2 result may be applied.")],
      plan: null
    };
  }
  if (escalationResult.structurallyValid !== true) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.structurallyValid", "Ready and maximum Task 4B2 results must be structurally valid."));
  if (escalationResult.readyForHazardStageEscalation !== true) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.readyForHazardStageEscalation", "Ready and maximum Task 4B2 results must be ready for stage escalation."));
  if (!Array.isArray(escalationResult.errors) || escalationResult.errors.length !== 0) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.errors", "Ready and maximum Task 4B2 result errors must be an empty array."));
  if (!Array.isArray(escalationResult.warnings)) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.warnings", "Task 4B2 result warnings must be an array."));
  if (errors.length > 0) return { ok: false, errors, plan: null };

  const notReady = issue(
    "hazard-stage-escalation-application-not-ready",
    "escalationResult.outcome",
    "Only an escalation-ready Task 4B2 result may be applied."
  );
  if (!isPlainObject(escalationResult.plan)) {
    return {
      ok: false,
      errors: [issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan", "Task 4B2 result plan must be a plain object.")],
      plan: null
    };
  }

  exactKeys(escalationResult.plan, PLAN_FIELDS, "escalationResult.plan", errors);
  if (errors.length > 0) return { ok: false, errors, plan: null };
  const plan = escalationResult.plan;

  const expectedKind = isMaximumOutcome ? "maximum-escalation" : "escalation-ready";
  if (plan.kind !== expectedKind) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.kind", `Task 4B2 ${outcome} results require a ${expectedKind} plan.`));
  if (!nonBlankString(plan.encounterId)) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.encounterId", "Plan encounterId must be a non-blank string."));
  if (!Number.isSafeInteger(plan.expectedRevision) || plan.expectedRevision < 0) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.expectedRevision", "Plan expectedRevision must be a non-negative safe integer."));
  if (!nonBlankString(plan.incomingHazardId)) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.incomingHazardId", "Plan incomingHazardId must be a non-blank string."));
  if (!nonBlankString(plan.existingHazardId)) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.existingHazardId", "Plan existingHazardId must be a non-blank string."));
  if (plan.incomingHazardId === plan.existingHazardId) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.existingHazardId", "Plan Hazard identities must be distinct."));
  if (!Number.isSafeInteger(plan.existingHazardIndex) || plan.existingHazardIndex < 0) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.existingHazardIndex", "Plan existingHazardIndex must be a non-negative safe integer."));
  if (!PRESSURE_SYSTEM_IDS.has(plan.pressureSystemId)) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.pressureSystemId", "Plan pressureSystemId must be canonical."));
  if (plan.collisionPolicy !== "escalate-existing") errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.collisionPolicy", "Plan collisionPolicy must be escalate-existing."));
  if (!nonBlankString(plan.previousStageId)) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.previousStageId", "Plan previousStageId must be a non-blank string."));
  if (isMaximumOutcome) {
    if (plan.targetStageId !== null) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.targetStageId", "Maximum-escalation plans require a null targetStageId."));
    if (plan.prospectiveHazard !== null) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.prospectiveHazard", "Maximum-escalation plans require a null prospectiveHazard."));
    if (plan.escalationConsequence !== null && (!isPlainObject(plan.escalationConsequence) || Object.keys(plan.escalationConsequence).length === 0)) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.escalationConsequence", "Maximum-escalation escalationConsequence must be null or a non-empty plain object."));
  } else {
    if (!nonBlankString(plan.targetStageId)) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.targetStageId", "Plan targetStageId must be a non-blank string."));
    if (plan.escalationConsequence !== null) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.escalationConsequence", "Escalation-ready plans require a null escalationConsequence."));
  }

  if (plan.requestKind === "target-stage") {
    if (!nonBlankString(plan.requestedTargetStageId)) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.requestedTargetStageId", "Target-stage requests require a non-blank requestedTargetStageId."));
    if (plan.requestedOperationId !== null) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.requestedOperationId", "Target-stage requests require a null requestedOperationId."));
    if (typeof plan.skippedStages !== "boolean") errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.skippedStages", "Target-stage requests require a boolean skippedStages value."));
  } else if (plan.requestKind === "operation") {
    if (plan.requestedTargetStageId !== null) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.requestedTargetStageId", "Operation requests require a null requestedTargetStageId."));
    if (plan.requestedOperationId !== "advance-one-stage") errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.requestedOperationId", "Operation requests require advance-one-stage."));
    if (plan.skippedStages !== false) errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.skippedStages", "Operation requests require skippedStages to be false."));
  } else {
    errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.requestKind", "Plan requestKind must be target-stage or operation."));
  }

  if (errors.length > 0) return { ok: false, errors, plan: null };

  const snapshots = [[plan.previousExistingHazard, "previousExistingHazard"]];
  if (isReadyOutcome) snapshots.push([plan.prospectiveHazard, "prospectiveHazard"]);
  for (const [value, path] of snapshots) {
    if (!isPlainObject(value)) {
      errors.push(issue(
        "hazard-stage-escalation-application-plan-invalid",
        `escalationResult.plan.${path}`,
        `Plan ${path} must be a plain object.`
      ));
    }
  }
  if (errors.length > 0) return { ok: false, errors, plan: null };

  if (isMaximumOutcome) {
    const previousErrors = [];
    const previous = captureHazard(
      plan.previousExistingHazard,
      "escalationResult.plan.previousExistingHazard",
      plan.encounterId,
      previousErrors
    );
    if (!previous) {
      errors.push(issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.previousExistingHazard", "Maximum-escalation plans require a valid active system Hazard snapshot."));
      errors.push(...previousErrors);
    }
    if (errors.length > 0) return { ok: false, errors: deduplicateIssues(errors), plan: null };
    return { ok: false, errors: [notReady], plan: null };
  }

  return { ok: true, errors: [], plan };
}

function validateTransitionHazards(plan) {
  const previousErrors = [];
  const previous = captureHazard(
    plan.previousExistingHazard,
    "escalationResult.plan.previousExistingHazard",
    plan.encounterId,
    previousErrors
  );
  if (!previous) {
    return {
      ok: false,
      errors: deduplicateIssues([
        issue("hazard-stage-escalation-application-plan-invalid", "escalationResult.plan.previousExistingHazard", "Plan previousExistingHazard must be a valid active system Hazard."),
        ...previousErrors
      ])
    };
  }

  const prospectiveErrors = [];
  const prospective = captureHazard(
    plan.prospectiveHazard,
    "escalationResult.plan.prospectiveHazard",
    plan.encounterId,
    prospectiveErrors
  );
  if (!prospective) {
    return {
      ok: false,
      errors: deduplicateIssues([
        issue("hazard-stage-escalation-application-prospective-invalid", "escalationResult.plan.prospectiveHazard", "Plan prospectiveHazard must be a valid active system Hazard."),
        ...prospectiveErrors
      ])
    };
  }

  const previousValidationErrors = [];
  const prospectiveValidationErrors = [];
  for (const [hazard, path, validationErrors, code] of [
    [previous, "previousExistingHazard", previousValidationErrors, "hazard-stage-escalation-application-plan-invalid"],
    [prospective, "prospectiveHazard", prospectiveValidationErrors, "hazard-stage-escalation-application-prospective-invalid"]
  ]) {
    if (hazard.category !== VOYAGE_HAZARD_CATEGORIES.SYSTEM) validationErrors.push(issue(code, `escalationResult.plan.${path}.category`, "Stage escalation requires system Hazards."));
    if (hazard.status !== VOYAGE_HAZARD_STATUSES.ACTIVE) validationErrors.push(issue(code, `escalationResult.plan.${path}.status`, "Stage escalation requires active Hazards."));
    if (hazard.hazardId !== plan.existingHazardId) validationErrors.push(issue(code, `escalationResult.plan.${path}.hazardId`, "Hazard ID must match existingHazardId."));
    if (hazard.encounterId !== plan.encounterId) validationErrors.push(issue(code, `escalationResult.plan.${path}.encounterId`, "Hazard encounterId must match the plan."));
    if (hazard.pressureSystemId !== plan.pressureSystemId) validationErrors.push(issue(code, `escalationResult.plan.${path}.pressureSystemId`, "Hazard pressureSystemId must match the plan."));
    if (hazard.failurePressureSystemId !== plan.pressureSystemId) validationErrors.push(issue(code, `escalationResult.plan.${path}.failurePressureSystemId`, "Hazard failurePressureSystemId must match the plan."));
    if (hazard.resolvedStageId !== null || hazard.resolvedRoundNumber !== null || hazard.terminalReason !== null || hazard.replacedByHazardId !== null) validationErrors.push(issue(code, `escalationResult.plan.${path}`, "Active Hazard terminal fields must remain null."));
  }
  if (previousValidationErrors.length > 0) return { ok: false, errors: previousValidationErrors };
  if (prospectiveValidationErrors.length > 0) return { ok: false, errors: prospectiveValidationErrors };
  if (!sameExceptAuthorizedChanges(previous, prospective)) {
    return {
      ok: false,
      errors: [issue("hazard-stage-escalation-application-change-set-invalid", "escalationResult.plan.prospectiveHazard", "Prospective Hazard contains an unauthorized change outside the four stage-escalation paths.")]
    };
  }

  return { ok: true, errors: [], previousExistingHazard: previous, prospectiveHazard: prospective };
}

function validateLiveHazard(state, plan, previousExistingHazard) {
  const errors = [];
  if (state.encounterId !== plan.encounterId) {
    errors.push(issue("hazard-stage-escalation-application-encounter-mismatch", "state.encounterId", "Encounter state and escalation plan encounterId must match."));
    return errors;
  }
  if (state.revision !== plan.expectedRevision) {
    errors.push(issue("hazard-stage-escalation-application-revision-mismatch", "state.revision", "Encounter state revision does not match the escalation plan."));
    return errors;
  }
  if (!Number.isSafeInteger(plan.existingHazardIndex) || plan.existingHazardIndex >= state.activeHazards.length) {
    errors.push(issue("hazard-stage-escalation-application-index-invalid", "escalationResult.plan.existingHazardIndex", "The escalation plan Hazard index is not present in activeHazards."));
    return errors;
  }

  const live = state.activeHazards[plan.existingHazardIndex];
  if (
    live.status !== VOYAGE_HAZARD_STATUSES.ACTIVE
    || live.category !== VOYAGE_HAZARD_CATEGORIES.SYSTEM
    || live.hazardId !== plan.existingHazardId
    || live.encounterId !== plan.encounterId
    || live.pressureSystemId !== plan.pressureSystemId
  ) {
    errors.push(issue("hazard-stage-escalation-application-live-hazard-mismatch", `state.activeHazards[${plan.existingHazardIndex}]`, "The indexed live Hazard does not match the escalation plan."));
    return errors;
  }
  if (!sameData(live, previousExistingHazard)) {
    errors.push(issue("hazard-stage-escalation-application-snapshot-mismatch", `state.activeHazards[${plan.existingHazardIndex}]`, "The indexed live Hazard does not match previousExistingHazard."));
  }
  return errors;
}

function buildNextState(state, plan, prospectiveHazard, revision) {
  const nextState = clonePlainData(state);
  nextState.activeHazards[plan.existingHazardIndex] = clonePlainData(prospectiveHazard);
  nextState.revision = revision;
  return nextState;
}

function buildEvent(state, plan, previousHazard, hazard, revision) {
  const event = {
    type: VOYAGE_HAZARD_EVENT_TYPES.ESCALATED,
    encounterId: state.encounterId,
    hazardId: plan.existingHazardId,
    pressureSystemId: plan.pressureSystemId,
    incomingHazardId: plan.incomingHazardId,
    collisionPolicy: plan.collisionPolicy,
    previousRevision: state.revision,
    revision,
    previousStageId: plan.previousStageId,
    targetStageId: plan.targetStageId,
    requestKind: plan.requestKind,
    requestedTargetStageId: plan.requestedTargetStageId,
    operationId: plan.requestKind === "operation" ? plan.requestedOperationId : null,
    skippedStages: plan.skippedStages,
    previousHazard: clonePlainData(previousHazard),
    hazard: clonePlainData(hazard)
  };
  return Object.keys(event).length === EVENT_FIELDS.length ? event : null;
}

/**
 * Apply one validated Task 4B2 escalation-ready plan atomically.
 * Maximum and invalid outcomes are declarative and are never applied here.
 */
export function applyVoyageHazardStageEscalationPlan(encounterState, escalationResult) {
  const capturedState = capturePlainData(encounterState, "state");
  if (!capturedState.ok) return failure([capturedState.error]);
  const capturedResult = capturePlainData(escalationResult, "escalationResult");
  if (!capturedResult.ok) return failure([capturedResult.error]);

  const stateValidation = validateVoyageEncounterState(capturedState.value);
  if (!stateValidation.valid) {
    return failure([
      issue("hazard-stage-escalation-application-state-invalid", "state", "Encounter state failed canonical Voyage state validation."),
      ...rebaseIssues(stateValidation.errors, "state")
    ], stateValidation.warnings);
  }

  const resultValidation = validateStructuralApplicationResult(capturedResult.value);
  if (!resultValidation.ok) return failure(resultValidation.errors, stateValidation.warnings);
  const { plan } = resultValidation;

  const liveErrors = validateLiveHazard(capturedState.value, plan, plan.previousExistingHazard);
  if (liveErrors.length > 0) return failure(liveErrors, stateValidation.warnings);

  const transitionValidation = validateTransitionHazards(plan);
  if (!transitionValidation.ok) return failure(transitionValidation.errors, stateValidation.warnings);
  const { previousExistingHazard, prospectiveHazard } = transitionValidation;

  if (!Number.isSafeInteger(capturedState.value.revision + 1)) {
    return failure([
      issue("hazard-stage-escalation-application-revision-overflow", "state.revision", "The escalation application revision increment would overflow the safe integer range.")
    ], stateValidation.warnings);
  }
  const revision = capturedState.value.revision + 1;

  let nextState;
  try {
    nextState = buildNextState(capturedState.value, plan, prospectiveHazard, revision);
  } catch {
    return failure([
      issue("hazard-stage-escalation-application-result-state-invalid", "nextState", "The escalation application candidate could not be constructed safely.")
    ], stateValidation.warnings);
  }
  const candidateValidation = validateVoyageEncounterState(nextState);
  const warnings = [...stateValidation.warnings, ...candidateValidation.warnings];
  if (!candidateValidation.valid) {
    return failure([
      issue("hazard-stage-escalation-application-result-state-invalid", "nextState", "The escalation application candidate failed final state validation."),
      ...rebaseIssues(candidateValidation.errors, "nextState")
    ], warnings);
  }

  const event = buildEvent(
    capturedState.value,
    plan,
    capturedState.value.activeHazards[plan.existingHazardIndex],
    nextState.activeHazards[plan.existingHazardIndex],
    revision
  );
  if (event === null) {
    return failure([
      issue("hazard-stage-escalation-application-result-state-invalid", "event", "The escalation event did not satisfy its exact shape.")
    ], warnings);
  }
  return success(nextState, event, warnings);
}
