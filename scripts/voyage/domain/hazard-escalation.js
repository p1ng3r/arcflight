import {
  VOYAGE_HAZARD_CATEGORIES,
  VOYAGE_HAZARD_ESCALATION_MODES,
  VOYAGE_HAZARD_STATUSES,
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "./constants.js";
import {
  captureVoyageHazardRecord,
  validateVoyageHazardRecord
} from "./hazard-schema.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const PRESSURE_SYSTEM_IDS = new Set(VOYAGE_PRESSURE_SYSTEM_IDS);
const COLLISION_PLAN_FIELDS = Object.freeze([
  "kind",
  "encounterId",
  "expectedRevision",
  "incomingHazardId",
  "existingHazardId",
  "existingHazardIndex",
  "pressureSystemId",
  "collisionPolicy",
  "incomingHazard",
  "existingHazard",
  "collisionPayload",
  "recommendedOperation"
]);

function issue(code, path, message, severity = "error") {
  return { severity, code, path, message };
}

function captureFailure(path) {
  return {
    ok: false,
    value: null,
    error: issue(
      "hazard-stage-escalation-analysis-data-read-failed",
      path,
      "Hazard stage escalation analysis data could not be read safely."
    )
  };
}

function capturePlainData(value, path = "$", ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { ok: true, value };
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? { ok: true, value } : captureFailure(path);
  }
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
      if (
        !lengthDescriptor
        || !Object.hasOwn(lengthDescriptor, "value")
        || !Number.isSafeInteger(lengthDescriptor.value)
        || lengthDescriptor.value < 0
        || ownKeys.length !== lengthDescriptor.value + 1
      ) {
        return captureFailure(path);
      }

      const clone = new Array(lengthDescriptor.value);
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
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
        if (typeof key !== "string" || !/^0$|^[1-9]\d*$/.test(key) || Number(key) >= lengthDescriptor.value) {
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

function clonePlanData(value) {
  if (Array.isArray(value)) return value.map((entry) => clonePlanData(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clonePlanData(entry)]));
  }
  return value;
}

function rebaseIssue(error, basePath) {
  const path = typeof error?.path === "string" ? error.path : "$";
  const suffix = path === "$"
    ? ""
    : path.startsWith("$")
      ? path.slice(1)
      : `.${path}`;
  return issue(
    error?.code ?? "hazard-stage-escalation-plan-invalid",
    `${basePath}${suffix}`,
    error?.message ?? "Hazard stage escalation data is invalid.",
    error?.severity ?? "error"
  );
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

function failure(errors) {
  return {
    structurallyValid: false,
    readyForHazardStageEscalation: false,
    outcome: "invalid-or-not-applicable",
    plan: null,
    errors: deduplicateIssues(errors),
    warnings: []
  };
}

function success(outcome, plan, warnings = []) {
  return {
    structurallyValid: true,
    readyForHazardStageEscalation: true,
    outcome,
    plan,
    errors: [],
    warnings: deduplicateIssues(warnings)
  };
}

function planError(path, message) {
  return issue("hazard-stage-escalation-plan-invalid", path, message);
}

function isNonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sameData(left, right) {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!sameData(left[index], right[index])) return false;
    }
    return true;
  }
  if (typeof left === "object") {
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
  return false;
}

function exactPlanShape(plan, errors) {
  const actual = Object.keys(plan);
  const expected = new Set(COLLISION_PLAN_FIELDS);
  for (const key of actual) {
    if (!expected.has(key)) errors.push(planError(`collisionPlan.${key}`, "Collision plan contains an unexpected field."));
  }
  for (const key of COLLISION_PLAN_FIELDS) {
    if (!Object.hasOwn(plan, key)) errors.push(planError(`collisionPlan.${key}`, "Collision plan requires this field."));
  }
}

function capturePlanHazard(record, path, expectedEncounterId, errors) {
  const captured = captureVoyageHazardRecord(record, {
    mode: "active",
    expectedEncounterId
  });
  if (!captured.ok) {
    errors.push(...captured.errors.map((error) => rebaseIssue(error, path)));
    return null;
  }
  return captured.record;
}

function validateCollisionPlan(collisionPlan) {
  const errors = [];
  exactPlanShape(collisionPlan, errors);
  if (errors.length > 0) return { ok: false, errors, plan: null };

  if (collisionPlan.kind !== "collision") errors.push(planError("collisionPlan.kind", "Collision plan kind must be collision."));
  if (collisionPlan.recommendedOperation !== "escalate-existing") {
    errors.push(planError("collisionPlan.recommendedOperation", "Stage escalation requires an escalate-existing recommendation."));
  }
  if (collisionPlan.collisionPolicy !== "escalate-existing") {
    errors.push(planError("collisionPlan.collisionPolicy", "Stage escalation requires an escalate-existing collision policy."));
  }
  if (!isNonBlankString(collisionPlan.encounterId)) errors.push(planError("collisionPlan.encounterId", "Collision plan encounterId must be a non-blank string."));
  if (!Number.isSafeInteger(collisionPlan.expectedRevision) || collisionPlan.expectedRevision < 0) errors.push(planError("collisionPlan.expectedRevision", "Collision plan expectedRevision must be a non-negative safe integer."));
  if (!isNonBlankString(collisionPlan.incomingHazardId)) errors.push(planError("collisionPlan.incomingHazardId", "Collision plan incomingHazardId must be a non-blank string."));
  if (!isNonBlankString(collisionPlan.existingHazardId)) errors.push(planError("collisionPlan.existingHazardId", "Collision plan existingHazardId must be a non-blank string."));
  if (collisionPlan.incomingHazardId === collisionPlan.existingHazardId) errors.push(planError("collisionPlan.existingHazardId", "Collision plan Hazard identities must be distinct."));
  if (!Number.isSafeInteger(collisionPlan.existingHazardIndex) || collisionPlan.existingHazardIndex < 0) errors.push(planError("collisionPlan.existingHazardIndex", "Collision plan existingHazardIndex must be a non-negative safe integer."));
  if (!PRESSURE_SYSTEM_IDS.has(collisionPlan.pressureSystemId)) errors.push(planError("collisionPlan.pressureSystemId", "Collision plan pressureSystemId must be canonical."));

  const incoming = capturePlanHazard(collisionPlan.incomingHazard, "collisionPlan.incomingHazard", collisionPlan.encounterId, errors);
  const existing = capturePlanHazard(collisionPlan.existingHazard, "collisionPlan.existingHazard", collisionPlan.encounterId, errors);
  if (errors.some((error) => (
    error.path === "collisionPlan.existingHazard.escalation.currentStageId"
    && error.code === "invalid-hazard-escalation-current-stage"
  ))) {
    errors.push(issue(
      "hazard-stage-escalation-current-stage-unknown",
      "collisionPlan.existingHazard.escalation.currentStageId",
      "Existing Hazard currentStageId must identify an authored stage."
    ));
  }
  if (!incoming || !existing) {
    errors.push(planError("collisionPlan", "Collision plan snapshots must be valid active Hazard records."));
    return { ok: false, errors, plan: null };
  }

  if (incoming.hazardId !== collisionPlan.incomingHazardId) errors.push(planError("collisionPlan.incomingHazard.hazardId", "Incoming Hazard identity does not match the collision plan."));
  if (existing.hazardId !== collisionPlan.existingHazardId) errors.push(planError("collisionPlan.existingHazard.hazardId", "Existing Hazard identity does not match the collision plan."));
  if (incoming.hazardId === existing.hazardId) errors.push(planError("collisionPlan.existingHazard.hazardId", "Collision plan Hazard identities must be distinct."));

  for (const [record, path] of [[incoming, "collisionPlan.incomingHazard"], [existing, "collisionPlan.existingHazard"]]) {
    if (record.category !== VOYAGE_HAZARD_CATEGORIES.SYSTEM) errors.push(planError(`${path}.category`, "Stage escalation requires system Hazards."));
    if (record.status !== VOYAGE_HAZARD_STATUSES.ACTIVE) errors.push(planError(`${path}.status`, "Stage escalation requires active Hazards."));
    if (record.pressureSystemId !== collisionPlan.pressureSystemId) errors.push(planError(`${path}.pressureSystemId`, "Hazard pressureSystemId must match the collision plan."));
  }

  if (!sameData(collisionPlan.collisionPayload, incoming.metadata.collision)) {
    errors.push(planError("collisionPlan.collisionPayload", "Collision payload must exactly match incoming Hazard metadata.collision."));
  }
  if (errors.length > 0) return { ok: false, errors, plan: null };

  return {
    ok: true,
    errors: [],
    plan: {
      ...collisionPlan,
      incomingHazard: incoming,
      existingHazard: existing,
      collisionPayload: clonePlanData(collisionPlan.collisionPayload)
    }
  };
}

function prospectiveValidation(prospectiveHazard) {
  const validation = validateVoyageHazardRecord(prospectiveHazard, {
    mode: "active",
    expectedEncounterId: prospectiveHazard.encounterId
  });
  return validation;
}

function prospectiveFailure(validation) {
  return failure([
    ...validation.errors.map((error) => rebaseIssue(error, "collisionPlan.prospectiveHazard")),
    issue(
      "hazard-stage-escalation-result-invalid",
      "collisionPlan.prospectiveHazard",
      "Prospective stage-escalated Hazard failed active Hazard validation."
    )
  ]);
}

function basePlan(collisionPlan, existing, requestKind, requestedTargetStageId, requestedOperationId, previousStageId, targetStageId, skippedStages, prospectiveHazard, escalationConsequence = null) {
  return {
    kind: prospectiveHazard ? "escalation-ready" : "maximum-escalation",
    encounterId: collisionPlan.encounterId,
    expectedRevision: collisionPlan.expectedRevision,
    incomingHazardId: collisionPlan.incomingHazardId,
    existingHazardId: collisionPlan.existingHazardId,
    existingHazardIndex: collisionPlan.existingHazardIndex,
    pressureSystemId: collisionPlan.pressureSystemId,
    requestKind,
    requestedTargetStageId,
    requestedOperationId,
    previousStageId,
    targetStageId,
    skippedStages,
    previousExistingHazard: clonePlanData(existing),
    prospectiveHazard: prospectiveHazard ? clonePlanData(prospectiveHazard) : null,
    escalationConsequence: escalationConsequence === null ? null : clonePlanData(escalationConsequence)
  };
}

function buildProspectiveHazard(existing, targetStage) {
  const prospective = clonePlanData(existing);
  prospective.escalation.currentStageId = targetStage.stageId;
  prospective.currentEffect = clonePlanData(targetStage.effect);
  prospective.ignoredConsequence = clonePlanData(targetStage.ignoredConsequence);
  prospective.escalation.maximumEscalationReached = prospective.escalation.stages.at(-1).stageId === targetStage.stageId;
  return prospective;
}

function invalidStageResult(code, path, message) {
  return failure([issue(code, path, message)]);
}

/**
 * Analyze and transform a validated Task 4A stage-escalation collision plan.
 * The returned prospective Hazard is isolated and is not applied to state.
 */
export function analyzeVoyageHazardStageEscalation(collisionPlan) {
  const captured = capturePlainData(collisionPlan, "collisionPlan");
  if (!captured.ok) return failure([captured.error]);

  const validatedPlan = validateCollisionPlan(captured.value);
  if (!validatedPlan.ok) return failure(validatedPlan.errors);
  const plan = validatedPlan.plan;
  const existing = plan.existingHazard;
  const escalation = existing.escalation;

  if (escalation.mode === VOYAGE_HAZARD_ESCALATION_MODES.NONE) {
    return invalidStageResult(
      "hazard-stage-escalation-mode-unsupported",
      "collisionPlan.existingHazard.escalation.mode",
      "Stage escalation is not applicable to an existing Hazard with none escalation mode."
    );
  }
  if (escalation.mode === VOYAGE_HAZARD_ESCALATION_MODES.COUNTDOWN) {
    return invalidStageResult(
      "hazard-stage-escalation-not-applicable",
      "collisionPlan.existingHazard.escalation.mode",
      "Stage escalation is not applicable to an existing Hazard with countdown escalation mode."
    );
  }

  const currentIndex = escalation.stages.findIndex((stage) => stage.stageId === escalation.currentStageId);
  if (currentIndex < 0) {
    return invalidStageResult(
      "hazard-stage-escalation-current-stage-unknown",
      "collisionPlan.existingHazard.escalation.currentStageId",
      "Existing Hazard currentStageId must identify an authored stage."
    );
  }

  const collisionPayload = plan.collisionPayload;
  const payloadKeys = Object.keys(collisionPayload);
  const isTargetRequest = payloadKeys.length === 1 && Object.hasOwn(collisionPayload, "targetStageId");
  const isOperationRequest = payloadKeys.length === 1 && Object.hasOwn(collisionPayload, "escalation");

  if (!isTargetRequest && !isOperationRequest) {
    return invalidStageResult(
      "hazard-stage-escalation-plan-invalid",
      "collisionPlan.collisionPayload",
      "Stage escalation collision payload must use exactly one recognized request form."
    );
  }

  if (isTargetRequest) {
    const targetStageId = collisionPayload.targetStageId;
    const targetIndex = escalation.stages.findIndex((stage) => stage.stageId === targetStageId);
    if (targetIndex < 0) {
      return invalidStageResult(
        "hazard-stage-escalation-target-stage-unknown",
        "collisionPlan.collisionPayload.targetStageId",
        "Stage escalation targetStageId must identify an authored stage."
      );
    }
    if (targetIndex === currentIndex) {
      return invalidStageResult(
        "hazard-stage-escalation-same-stage",
        "collisionPlan.collisionPayload.targetStageId",
        "Stage escalation targetStageId must not equal the current stage."
      );
    }
    if (targetIndex < currentIndex) {
      return invalidStageResult(
        "hazard-stage-escalation-backward",
        "collisionPlan.collisionPayload.targetStageId",
        "Stage escalation targetStageId must occur after the current stage."
      );
    }

    const targetStage = escalation.stages[targetIndex];
    const prospective = buildProspectiveHazard(existing, targetStage);
    const validation = prospectiveValidation(prospective);
    if (!validation.valid) return prospectiveFailure(validation);

    return success("escalation-ready", basePlan(
      plan,
      existing,
      "target-stage",
      targetStageId,
      null,
      escalation.currentStageId,
      targetStageId,
      targetIndex > currentIndex + 1,
      prospective
    ));
  }

  const operationId = collisionPayload.escalation?.operationId;
  if (operationId !== "advance-one-stage") {
    return invalidStageResult(
      "hazard-stage-escalation-operation-unknown",
      "collisionPlan.collisionPayload.escalation.operationId",
      "Stage escalation operationId is not recognized."
    );
  }

  const targetIndex = currentIndex + 1;
  if (targetIndex >= escalation.stages.length) {
    return success(
      "maximum-escalation",
      basePlan(
        plan,
        existing,
        "operation",
        null,
        operationId,
        escalation.currentStageId,
        null,
        false,
        null,
        escalation.escalationConsequence
      ),
      [issue(
        "hazard-stage-escalation-at-maximum",
        "collisionPlan.existingHazard.escalation.currentStageId",
        "Stage escalation operation reached the maximum authored stage.",
        "warning"
      )]
    );
  }

  const targetStage = escalation.stages[targetIndex];
  const prospective = buildProspectiveHazard(existing, targetStage);
  const validation = prospectiveValidation(prospective);
  if (!validation.valid) return prospectiveFailure(validation);

  return success("escalation-ready", basePlan(
    plan,
    existing,
    "operation",
    null,
    operationId,
    escalation.currentStageId,
    targetStage.stageId,
    false,
    prospective
  ));
}
