import {
  captureVoyageHazardRecord,
  validateVoyageHazardRecord,
  VOYAGE_HAZARD_RECORD_FIELDS
} from "./hazard-schema.js";

const DEFINITION_FIELDS = Object.freeze([
  "schemaVersion",
  "breakdownDefinitionId",
  "systemId",
  "systemKind",
  "title",
  "description",
  "catastrophicHazard",
  "pausePlan",
  "emergencyResponseDefinition"
]);
const PAUSE_FIELDS = Object.freeze(["timing", "resumeCondition"]);
const RESPONSE_FIELDS = Object.freeze([
  "schemaVersion",
  "emergencyResponseDefinitionId",
  "breakdownDefinitionId",
  "systemId",
  "systemKind",
  "title",
  "description",
  "roundCount",
  "rounds",
  "stabilizationOutcome",
  "failureConsequences",
  "nextSituations"
]);
const ROUND_FIELDS = Object.freeze(["roundId", "roundNumber"]);
const STABILIZATION_FIELDS = Object.freeze(["outcomeId", "title", "description", "nextSituationId"]);
const CONSEQUENCE_FIELDS = Object.freeze(["consequenceId", "kind", "title", "description", "nextSituationId"]);
const NEXT_FIELDS = Object.freeze(["nextSituationId", "title", "summary", "transitionKind"]);
const SYSTEM_IDS = new Set(["crew-morale", "arkengine", "levstone-array", "solar-sail-rig", "lifeveil"]);
const ROUND_COUNTS = new Set([3, 5, 7, 9, 11]);
const CONSEQUENCE_KINDS = new Set(["strand", "diversion", "disablement", "loss"]);
const TRANSITION_KINDS = new Set(["retreat", "diversion", "emergency", "capture", "delay", "repair", "authored"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const CAPACITY_EXHAUSTION_FIELDS = Object.freeze([
  "kind",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "shipId",
  "systemId",
  "systemKind",
  "liveRevision",
  "scarCapacity",
  "occupiedScarCount",
  "incomingScarProposalId",
  "incomingScarProposalKind",
  "incomingScarProposalStatus"
]);
const CATASTROPHIC_BREAKDOWN_REQUEST_FIELDS = Object.freeze([
  "kind",
  "sessionId",
  "breakdownDefinition",
  "capacityExhaustion"
]);
const BREAKDOWN_PLAN_FIELDS = Object.freeze([
  "systemDisablement",
  "catastrophicHazard",
  "pausePlan",
  "emergencyResponseDefinitionId",
  "scarApplication",
  "capacityExhaustion"
]);
const SYSTEM_DISABLEMENT_FIELDS = Object.freeze(["systemId", "systemKind", "disabled"]);
const CATASTROPHIC_BREAKDOWN_PROHIBITED_KEYS = new Set([
  "approved",
  "gmApproved",
  "approval",
  "gmApproval",
  "applicationPlan",
  "nextState",
  "breakdownPlan",
  "emergencyResponseResult",
  "outcomeProposal",
  "persistentChanges",
  "shipUpdate",
  "hazardApplied",
  "systemDisabled",
  "scarCreated",
  "revisionAfter",
  "requestId",
  "staleStatus",
  "duplicateStatus",
  "capacityAnalysis",
  "applicationToken"
]);

const MESSAGES = Object.freeze({
  hostile: "Milestone 9 data could not be captured safely.",
  definition: "Catastrophic Breakdown Definition is invalid.",
  hazard: "Catastrophic Hazard is not a valid M6 Hazard with the required M9 restrictions.",
  response: "Emergency Response Definition is invalid.",
  duplicate: "Authored Milestone 9 definition identities must be unique.",
  unresolved: "Authored Milestone 9 definition reference is unresolved."
});

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function dedupe(errors) {
  const seen = new Set();
  return errors.filter((entry) => {
    const key = JSON.stringify([entry.code, entry.path, entry.message, entry.severity]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPlain(value) {
  if (value === null || typeof value !== "object") return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function exactKeys(value, fields) {
  if (!isPlain(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && keys.every((key, index) => key === fields[index]);
}

function nonblank(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function hasStrictStrings(value) {
  if (typeof value === "string") {
    return value.length > 0 && value.trim() === value;
  }

  if (Array.isArray(value)) {
    return value.every(hasStrictStrings);
  }

  if (isPlain(value)) {
    return Object.values(value).every(hasStrictStrings);
  }

  return true;
}

function denseArray(value) {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return false;
  }
  return true;
}

class HostileCaptureFailure extends Error {}

function hostile() {
  throw new HostileCaptureFailure();
}

function captureValue(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    hostile();
  }
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") hostile();
  if (typeof value !== "object") hostile();
  if (ancestors.has(value)) hostile();

  let array;
  let prototype;
  let keys;
  try {
    array = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    hostile();
  }

  if (array ? prototype !== Array.prototype : (prototype !== Object.prototype && prototype !== null)) hostile();
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);

  if (array) {
    try {
      for (const key in value) if (!Object.hasOwn(value, key)) hostile();
    } catch (error) {
      if (error instanceof HostileCaptureFailure) throw error;
      hostile();
    }
    let lengthDescriptor;
    try {
      lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    } catch {
      hostile();
    }
    const length = lengthDescriptor?.value;
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value") || !Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) hostile();
    const output = new Array(length);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) hostile();
    }
    for (let index = 0; index < length; index += 1) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        hostile();
      }
      if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) hostile();
      output[index] = captureValue(descriptor.value, nextAncestors);
    }
    return output;
  }

  try {
    for (const key in value) if (!Object.hasOwn(value, key)) hostile();
  } catch (error) {
    if (error instanceof HostileCaptureFailure) throw error;
    hostile();
  }
  const output = {};
  for (const key of keys) {
    if (typeof key !== "string" || UNSAFE_KEYS.has(key)) hostile();
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      hostile();
    }
    if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) hostile();
    output[key] = captureValue(descriptor.value, nextAncestors);
  }
  return output;
}

function captureRoot(value) {
  try {
    return { ok: true, value: captureValue(value), errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof HostileCaptureFailure) {
      return { ok: false, value: null, errors: [issue("m9-hostile-data-capture-failed", "$", MESSAGES.hostile)], warnings: [] };
    }
    return { ok: false, value: null, errors: [issue("m9-hostile-data-capture-failed", "$", MESSAGES.hostile)], warnings: [] };
  }
}

function validateHazard(hazard, systemId) {
  if (!isPlain(hazard)) return false;
  if (!exactKeys(hazard, VOYAGE_HAZARD_RECORD_FIELDS)) return false;
  if (!hasStrictStrings(hazard)) return false;
  const captured = captureVoyageHazardRecord(hazard);
  if (!captured.ok || !validateVoyageHazardRecord(hazard).valid) return false;
  if (hazard.category !== "system" || hazard.status !== "active") return false;
  if (hazard.pressureSystemId !== systemId || hazard.failurePressureSystemId !== hazard.pressureSystemId) return false;
  if (hazard.eventAreaId !== null) return false;
  if (hazard.sourceKind !== "m9-catastrophic-breakdown") return false;
  if (hazard.collisionPolicy !== "trigger-existing-consequence") return false;
  if (!nonblank(hazard.encounterId)) return false;
  return isPlain(hazard.metadata)
    && isPlain(hazard.metadata.collision)
    && isPlain(hazard.metadata.collision.consequence)
    && Object.keys(hazard.metadata.collision.consequence).length > 0;
}

function validatePausePlan(value) {
  return exactKeys(value, PAUSE_FIELDS)
    && value.timing === "after-current-segment"
    && value.resumeCondition === "emergency-response-resolved";
}

function validateRound(value, index) {
  return exactKeys(value, ROUND_FIELDS)
    && nonblank(value.roundId)
    && Number.isSafeInteger(value.roundNumber)
    && value.roundNumber === index + 1;
}

function validateNext(value) {
  return exactKeys(value, NEXT_FIELDS)
    && nonblank(value.nextSituationId)
    && nonblank(value.title)
    && nonblank(value.summary)
    && TRANSITION_KINDS.has(value.transitionKind);
}

function validateResponse(value, definition) {
  if (!exactKeys(value, RESPONSE_FIELDS)) return false;
  if (value.schemaVersion !== 1
    || !nonblank(value.emergencyResponseDefinitionId)
    || value.breakdownDefinitionId !== definition.breakdownDefinitionId
    || value.systemId !== definition.systemId
    || value.systemKind !== "pressure-system"
    || !nonblank(value.title)
    || !nonblank(value.description)
    || !ROUND_COUNTS.has(value.roundCount)
    || !denseArray(value.rounds)
    || value.rounds.length !== value.roundCount
    || !value.rounds.every(validateRound)
    || !exactKeys(value.stabilizationOutcome, STABILIZATION_FIELDS)
    || !nonblank(value.stabilizationOutcome.outcomeId)
    || !nonblank(value.stabilizationOutcome.title)
    || !nonblank(value.stabilizationOutcome.description)
    || !nonblank(value.stabilizationOutcome.nextSituationId)
    || !denseArray(value.failureConsequences)
    || value.failureConsequences.length !== 1
    || !exactKeys(value.failureConsequences[0], CONSEQUENCE_FIELDS)
    || !nonblank(value.failureConsequences[0].consequenceId)
    || !CONSEQUENCE_KINDS.has(value.failureConsequences[0].kind)
    || !nonblank(value.failureConsequences[0].title)
    || !nonblank(value.failureConsequences[0].description)
    || !nonblank(value.failureConsequences[0].nextSituationId)
    || !denseArray(value.nextSituations)
    || value.nextSituations.length !== 1
    || !validateNext(value.nextSituations[0])) return false;
  return true;
}

function validateDefinition(value) {
  const errors = [];
  if (!exactKeys(value, DEFINITION_FIELDS)) return [issue("m9-invalid-breakdown-definition", "breakdownDefinition", MESSAGES.definition)];

  if (value.schemaVersion !== 1
    || !nonblank(value.breakdownDefinitionId)
    || !nonblank(value.systemId)
    || !SYSTEM_IDS.has(value.systemId)
    || value.systemKind !== "pressure-system"
    || !nonblank(value.title)
    || !nonblank(value.description)
    || !validatePausePlan(value.pausePlan)) {
    errors.push(issue("m9-invalid-breakdown-definition", "breakdownDefinition", MESSAGES.definition));
  }

  if (!validateHazard(value.catastrophicHazard, value.systemId)) {
    errors.push(issue("m9-invalid-catastrophic-hazard", "breakdownDefinition.catastrophicHazard", MESSAGES.hazard));
  }

  if (!validateResponse(value.emergencyResponseDefinition, value)) {
    errors.push(issue("m9-invalid-emergency-response-definition", "breakdownDefinition.emergencyResponseDefinition", MESSAGES.response));
  }

  const response = value.emergencyResponseDefinition;
  if (validateResponse(response, value)) {
    const identities = [
      ["breakdownDefinition.breakdownDefinitionId", value.breakdownDefinitionId],
      ["breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId", response.emergencyResponseDefinitionId],
      ...response.rounds.map((round, index) => [`breakdownDefinition.emergencyResponseDefinition.rounds[${index}].roundId`, round.roundId]),
      ["breakdownDefinition.emergencyResponseDefinition.stabilizationOutcome.outcomeId", response.stabilizationOutcome.outcomeId],
      ["breakdownDefinition.emergencyResponseDefinition.failureConsequences[0].consequenceId", response.failureConsequences[0].consequenceId],
      ["breakdownDefinition.emergencyResponseDefinition.nextSituations[0].nextSituationId", response.nextSituations[0].nextSituationId]
    ];
    const seen = new Set();
    for (const [path, id] of identities) {
      if (seen.has(id)) errors.push(issue("m9-duplicate-definition-identity", path, MESSAGES.duplicate));
      else seen.add(id);
    }
    const nextId = response.nextSituations[0].nextSituationId;
    if (response.stabilizationOutcome.nextSituationId !== nextId) {
      errors.push(issue(
        "m9-unresolved-definition-reference",
        "breakdownDefinition.emergencyResponseDefinition.stabilizationOutcome.nextSituationId",
        MESSAGES.unresolved
      ));
    }
    if (response.failureConsequences[0].nextSituationId !== nextId) {
      errors.push(issue(
        "m9-unresolved-definition-reference",
        "breakdownDefinition.emergencyResponseDefinition.failureConsequences[0].nextSituationId",
        MESSAGES.unresolved
      ));
    }
  }
  return dedupe(errors);
}

export function validateVoyageCatastrophicBreakdownDefinition(breakdownDefinition) {
  const captured = captureRoot(breakdownDefinition);
  if (!captured.ok) return { valid: false, errors: captured.errors, warnings: [] };
  const errors = validateDefinition(captured.value);
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function captureVoyageCatastrophicBreakdownDefinition(breakdownDefinition) {
  const captured = captureRoot(breakdownDefinition);
  if (!captured.ok) return { ok: false, breakdownDefinition: null, errors: captured.errors, warnings: [] };
  const errors = validateDefinition(captured.value);
  return {
    ok: errors.length === 0,
    breakdownDefinition: errors.length === 0 ? captured.value : null,
    errors,
    warnings: []
  };
}

function invalidTask2Request(message, path, code) {
  return issue(code, path, message);
}

function catastrophicBreakdownFailure(errors) {
  return {
    ok: false,
    readyForCatastrophicBreakdown: false,
    eventId: null,
    sessionId: null,
    definitionSnapshotId: null,
    shipId: null,
    systemId: null,
    systemKind: null,
    liveRevision: null,
    breakdownDefinitionId: null,
    breakdownPlan: null,
    requiresGmApproval: false,
    errors: dedupe(errors),
    warnings: []
  };
}

function catastrophicBreakdownSuccess(breakdownDefinition, capacityExhaustion, breakdownPlan) {
  return {
    ok: true,
    readyForCatastrophicBreakdown: true,
    eventId: capacityExhaustion.eventId,
    sessionId: capacityExhaustion.sessionId,
    definitionSnapshotId: capacityExhaustion.definitionSnapshotId,
    shipId: capacityExhaustion.shipId,
    systemId: capacityExhaustion.systemId,
    systemKind: capacityExhaustion.systemKind,
    liveRevision: capacityExhaustion.liveRevision,
    breakdownDefinitionId: breakdownDefinition.breakdownDefinitionId,
    breakdownPlan,
    requiresGmApproval: true,
    errors: [],
    warnings: []
  };
}

function validateDefinitionStructure(value) {
  return exactKeys(value, DEFINITION_FIELDS)
    && value.schemaVersion === 1
    && nonblank(value.breakdownDefinitionId)
    && SYSTEM_IDS.has(value.systemId)
    && value.systemKind === "pressure-system"
    && nonblank(value.title)
    && nonblank(value.description)
    && validatePausePlan(value.pausePlan);
}

function validateAnalysisDefinition(value) {
  if (!validateDefinitionStructure(value)) {
    return [invalidTask2Request(MESSAGES.definition, "breakdownDefinition", "m9-invalid-breakdown-definition")];
  }

  const descriptorErrors = [];
  if (!validateHazard(value.catastrophicHazard, value.systemId)) {
    descriptorErrors.push(issue(
      "m9-invalid-catastrophic-hazard",
      "breakdownDefinition.catastrophicHazard",
      MESSAGES.hazard
    ));
  }
  if (!validateResponse(value.emergencyResponseDefinition, value)) {
    descriptorErrors.push(issue(
      "m9-invalid-emergency-response-definition",
      "breakdownDefinition.emergencyResponseDefinition",
      MESSAGES.response
    ));
  }
  if (descriptorErrors.length > 0) return descriptorErrors;

  const response = value.emergencyResponseDefinition;
  const errors = [];
  const identities = [
    ["breakdownDefinition.breakdownDefinitionId", value.breakdownDefinitionId],
    ["breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId", response.emergencyResponseDefinitionId],
    ...response.rounds.map((round, index) => [
      `breakdownDefinition.emergencyResponseDefinition.rounds[${index}].roundId`,
      round.roundId
    ]),
    ["breakdownDefinition.emergencyResponseDefinition.stabilizationOutcome.outcomeId", response.stabilizationOutcome.outcomeId],
    ["breakdownDefinition.emergencyResponseDefinition.failureConsequences[0].consequenceId", response.failureConsequences[0].consequenceId],
    ["breakdownDefinition.emergencyResponseDefinition.nextSituations[0].nextSituationId", response.nextSituations[0].nextSituationId]
  ];
  const seen = new Set();
  for (const [path, id] of identities) {
    if (seen.has(id)) errors.push(issue("m9-duplicate-definition-identity", path, MESSAGES.duplicate));
    else seen.add(id);
  }

  const nextId = response.nextSituations[0].nextSituationId;
  if (response.stabilizationOutcome.nextSituationId !== nextId) {
    errors.push(issue(
      "m9-unresolved-definition-reference",
      "breakdownDefinition.emergencyResponseDefinition.stabilizationOutcome.nextSituationId",
      MESSAGES.unresolved
    ));
  }
  if (response.failureConsequences[0].nextSituationId !== nextId) {
    errors.push(issue(
      "m9-unresolved-definition-reference",
      "breakdownDefinition.emergencyResponseDefinition.failureConsequences[0].nextSituationId",
      MESSAGES.unresolved
    ));
  }
  return dedupe(errors);
}

function validateCapacityExhaustionStructure(value) {
  return exactKeys(value, CAPACITY_EXHAUSTION_FIELDS)
    && value.kind === "voyage.m10-capacity-exhaustion"
    && nonblank(value.eventId)
    && nonblank(value.sessionId)
    && nonblank(value.definitionSnapshotId)
    && nonblank(value.shipId)
    && SYSTEM_IDS.has(value.systemId)
    && value.systemKind === "pressure-system"
    && Number.isSafeInteger(value.liveRevision)
    && value.liveRevision >= 0
    && Number.isSafeInteger(value.scarCapacity)
    && value.scarCapacity >= 0
    && Number.isSafeInteger(value.occupiedScarCount)
    && value.occupiedScarCount >= 0
    && nonblank(value.incomingScarProposalId)
    && nonblank(value.incomingScarProposalKind)
    && nonblank(value.incomingScarProposalStatus);
}

function validateBreakdownBinding(breakdownDefinition, capacityExhaustion, request) {
  const errors = [];
  if (breakdownDefinition.catastrophicHazard.encounterId !== capacityExhaustion.eventId) {
    errors.push(issue(
      "m9-event-identity-mismatch",
      "capacityExhaustion.eventId",
      "Event identity does not match the M10 handoff."
    ));
  }
  if (request.sessionId !== capacityExhaustion.sessionId) {
    errors.push(issue(
      "m9-session-identity-mismatch",
      "capacityExhaustion.sessionId",
      "Session identity does not match the M10 handoff or request."
    ));
  }
  if (breakdownDefinition.systemId !== capacityExhaustion.systemId) {
    errors.push(issue(
      "m9-system-identity-mismatch",
      "capacityExhaustion.systemId",
      "Affected system identity does not match the M10 handoff."
    ));
  }
  return errors;
}

function validateCapacityApplicability(capacityExhaustion) {
  const errors = [];
  if (capacityExhaustion.occupiedScarCount !== capacityExhaustion.scarCapacity) {
    errors.push(issue(
      "m9-capacity-not-exhausted",
      "capacityExhaustion.occupiedScarCount",
      "Capacity exhaustion is not established."
    ));
  }
  if (capacityExhaustion.incomingScarProposalStatus !== "approved-unapplied") {
    errors.push(issue(
      "m9-invalid-incoming-scar-proposal",
      "capacityExhaustion.incomingScarProposalId",
      "Incoming ordinary Scar proposal evidence is invalid."
    ));
  }
  return errors;
}

function validateGeneratedBreakdownPlan(plan, breakdownDefinition, capacityExhaustion) {
  if (!exactKeys(plan, BREAKDOWN_PLAN_FIELDS)) return false;
  if (!exactKeys(plan.systemDisablement, SYSTEM_DISABLEMENT_FIELDS)
    || plan.systemDisablement.systemId !== capacityExhaustion.systemId
    || plan.systemDisablement.systemKind !== capacityExhaustion.systemKind
    || plan.systemDisablement.disabled !== true) return false;
  if (!validateHazard(plan.catastrophicHazard, capacityExhaustion.systemId)) return false;
  if (plan.catastrophicHazard.encounterId !== capacityExhaustion.eventId) return false;
  if (!validatePausePlan(plan.pausePlan)) return false;
  if (plan.emergencyResponseDefinitionId !== breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId) return false;
  if (plan.scarApplication !== null) return false;
  return JSON.stringify(plan.capacityExhaustion) === JSON.stringify(capacityExhaustion);
}

function regenerateBreakdownPlan(breakdownDefinition, capacityExhaustion) {
  return {
    systemDisablement: {
      systemId: capacityExhaustion.systemId,
      systemKind: capacityExhaustion.systemKind,
      disabled: true
    },
    catastrophicHazard: breakdownDefinition.catastrophicHazard,
    pausePlan: breakdownDefinition.pausePlan,
    emergencyResponseDefinitionId: breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId,
    scarApplication: null,
    capacityExhaustion
  };
}

export function analyzeVoyageCatastrophicBreakdown(request) {
  const captured = captureRoot(request);
  if (!captured.ok) return catastrophicBreakdownFailure(captured.errors);

  try {
    const value = captured.value;
    if (!isPlain(value)) {
      return catastrophicBreakdownFailure([issue(
        "m9-invalid-request-shape",
        "request",
        "Request has an invalid exact shape or field values."
      )]);
    }
    const prohibitedErrors = Object.keys(value)
      .filter((key) => CATASTROPHIC_BREAKDOWN_PROHIBITED_KEYS.has(key))
      .map((key) => issue(
        "m9-caller-authored-application-rejected",
        `request.${key}`,
        "Caller-authored application or runtime authority is not accepted."
      ));
    if (prohibitedErrors.length > 0) return catastrophicBreakdownFailure(prohibitedErrors);

    if (value.kind !== "m9-catastrophic-breakdown") {
      return catastrophicBreakdownFailure([issue(
        "m9-invalid-mode",
        "request.kind",
        "Only the requested Milestone 9 analysis mode is supported."
      )]);
    }

    if (!exactKeys(value, CATASTROPHIC_BREAKDOWN_REQUEST_FIELDS)
      || !nonblank(value.sessionId)
      || !isPlain(value.breakdownDefinition)
      || !isPlain(value.capacityExhaustion)) {
      return catastrophicBreakdownFailure([issue(
        "m9-invalid-request-shape",
        "request",
        "Request has an invalid exact shape or field values."
      )]);
    }

    const definitionErrors = validateAnalysisDefinition(value.breakdownDefinition);
    if (definitionErrors.length > 0) return catastrophicBreakdownFailure(definitionErrors);

    if (!validateCapacityExhaustionStructure(value.capacityExhaustion)) {
      return catastrophicBreakdownFailure([issue(
        "m9-invalid-capacity-exhaustion",
        "capacityExhaustion",
        "Capacity-exhaustion handoff is invalid."
      )]);
    }

    const bindingErrors = validateBreakdownBinding(value.breakdownDefinition, value.capacityExhaustion, value);
    if (bindingErrors.length > 0) return catastrophicBreakdownFailure(bindingErrors);

    const capacityErrors = validateCapacityApplicability(value.capacityExhaustion);
    if (capacityErrors.length > 0) return catastrophicBreakdownFailure(capacityErrors);

    if (value.capacityExhaustion.incomingScarProposalKind !== "ordinary-void-scar") {
      return catastrophicBreakdownFailure([issue(
        "m9-breakdown-not-applicable",
        "capacityExhaustion",
        "Catastrophic Breakdown is not applicable to this handoff."
      )]);
    }

    const generatedPlan = captureRoot(regenerateBreakdownPlan(value.breakdownDefinition, value.capacityExhaustion));
    if (!generatedPlan.ok || !validateGeneratedBreakdownPlan(
      generatedPlan.value,
      value.breakdownDefinition,
      value.capacityExhaustion
    )) {
      return catastrophicBreakdownFailure([issue(
        "m9-invalid-catastrophic-hazard",
        "breakdownDefinition.catastrophicHazard",
        MESSAGES.hazard
      )]);
    }

    return catastrophicBreakdownSuccess(value.breakdownDefinition, value.capacityExhaustion, generatedPlan.value);
  } catch {
    return catastrophicBreakdownFailure([issue("m9-hostile-data-capture-failed", "$", MESSAGES.hostile)]);
  }
}
