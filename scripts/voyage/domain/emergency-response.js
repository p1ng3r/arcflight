import { VOYAGE_PRESSURE_SYSTEM_IDS, VOYAGE_ROUND_RESULTS } from "./constants.js";
import { validateVoyageCatastrophicBreakdownDefinition } from "./catastrophic-breakdown.js";

const COMPLETED_ROUND_HISTORY_FIELDS = Object.freeze([
  "schemaVersion",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "shipId",
  "systemId",
  "liveRevision",
  "breakdownDefinitionId",
  "emergencyResponseDefinitionId",
  "roundCount",
  "rounds"
]);
const ROUND_FIELDS = Object.freeze(["roundId", "roundNumber", "roundResult"]);
const RESPONSE_DEFINITION_FIELDS = Object.freeze([
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
const AUTHORED_ROUND_FIELDS = Object.freeze(["roundId", "roundNumber"]);
const STABILIZATION_FIELDS = Object.freeze(["outcomeId", "title", "description", "nextSituationId"]);
const CONSEQUENCE_FIELDS = Object.freeze(["consequenceId", "kind", "title", "description", "nextSituationId"]);
const NEXT_SITUATION_FIELDS = Object.freeze(["nextSituationId", "title", "summary", "transitionKind"]);
const ROUND_COUNTS = new Set([3, 5, 7, 9, 11]);
const SYSTEM_IDS = new Set(VOYAGE_PRESSURE_SYSTEM_IDS);
const CONSEQUENCE_KINDS = new Set(["strand", "diversion", "disablement", "loss"]);
const TRANSITION_KINDS = new Set(["retreat", "diversion", "emergency", "capture", "delay", "repair", "authored"]);
const ROUND_RESULTS = new Set(Object.values(VOYAGE_ROUND_RESULTS));
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
const EMERGENCY_RESPONSE_REQUEST_FIELDS = Object.freeze([
  "kind",
  "sessionId",
  "breakdownDefinition",
  "breakdownPlan",
  "completedRoundHistory"
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
const EMERGENCY_RESPONSE_RESULT_FIELDS = Object.freeze([
  "overallResult",
  "roundCount",
  "winningThreshold",
  "successfulRoundCount",
  "failedRoundCount"
]);
const STABILIZED_PROPOSAL_FIELDS = Object.freeze([
  "kind",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "shipId",
  "systemId",
  "breakdownDefinitionId",
  "emergencyResponseDefinitionId",
  "catastrophicHazardId",
  "catastropheStatus",
  "hazardDisposition",
  "systemStatus",
  "repairApplied",
  "scarAdded",
  "scarRemoved",
  "sourceEventStatus",
  "nextSituation",
  "requiresGmApproval"
]);
const FAILED_PROPOSAL_FIELDS = Object.freeze([
  "kind",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "shipId",
  "systemId",
  "breakdownDefinitionId",
  "emergencyResponseDefinitionId",
  "catastrophicHazardId",
  "catastropheStatus",
  "systemStatus",
  "sourceEventStatus",
  "retryAllowed",
  "consequence",
  "nextSituation",
  "requiresGmApproval"
]);
const EMERGENCY_RESPONSE_PROHIBITED_KEYS = new Set([
  "approved",
  "gmApproved",
  "approval",
  "gmApproval",
  "applicationPlan",
  "nextState",
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
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const HOSTILE_MESSAGE = "Milestone 9 data could not be captured safely.";
const HISTORY_MESSAGE = "Emergency Response round history is invalid.";

function issue(path) {
  return {
    code: "m9-invalid-emergency-response-history",
    path,
    message: HISTORY_MESSAGE,
    severity: "error"
  };
}

function hostileIssue() {
  return {
    code: "m9-hostile-data-capture-failed",
    path: "$",
    message: HOSTILE_MESSAGE,
    severity: "error"
  };
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

function exactKeys(value, expected) {
  if (!isPlain(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function nonblank(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function denseArray(value) {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return false;
  }
  return true;
}

function safeRevision(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

class HostileCaptureFailure extends Error {}

function rejectHostile() {
  throw new HostileCaptureFailure();
}

function captureValue(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    rejectHostile();
  }
  if (typeof value === "undefined"
    || typeof value === "function"
    || typeof value === "symbol"
    || typeof value === "bigint") rejectHostile();
  if (typeof value !== "object") rejectHostile();
  if (ancestors.has(value)) rejectHostile();

  let array;
  let prototype;
  let keys;
  try {
    array = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    rejectHostile();
  }

  if (array ? prototype !== Array.prototype : (prototype !== Object.prototype && prototype !== null)) rejectHostile();
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);

  if (array) {
    try {
      for (const key in value) if (!Object.hasOwn(value, key)) rejectHostile();
    } catch (error) {
      if (error instanceof HostileCaptureFailure) throw error;
      rejectHostile();
    }
    let lengthDescriptor;
    try {
      lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    } catch {
      rejectHostile();
    }
    const length = lengthDescriptor?.value;
    if (!lengthDescriptor
      || !Object.hasOwn(lengthDescriptor, "value")
      || lengthDescriptor.enumerable !== false
      || !Number.isSafeInteger(length)
      || length < 0
      || keys.length !== length + 1) rejectHostile();

    const output = new Array(length);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) rejectHostile();
    }
    for (let index = 0; index < length; index += 1) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        rejectHostile();
      }
      if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) rejectHostile();
      output[index] = captureValue(descriptor.value, nextAncestors);
    }
    return output;
  }

  try {
    for (const key in value) if (!Object.hasOwn(value, key)) rejectHostile();
  } catch (error) {
    if (error instanceof HostileCaptureFailure) throw error;
    rejectHostile();
  }

  const output = {};
  for (const key of keys) {
    if (typeof key !== "string" || UNSAFE_KEYS.has(key)) rejectHostile();
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      rejectHostile();
    }
    if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) rejectHostile();
    output[key] = captureValue(descriptor.value, nextAncestors);
  }
  return output;
}

function captureRoot(value) {
  try {
    return { ok: true, value: captureValue(value), errors: [], warnings: [] };
  } catch {
    return { ok: false, value: null, errors: [hostileIssue()], warnings: [] };
  }
}

function task4Issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function emergencyResponseFailure(errors) {
  return {
    ok: false,
    readyForEmergencyResponseOutcome: false,
    eventId: null,
    sessionId: null,
    definitionSnapshotId: null,
    shipId: null,
    systemId: null,
    breakdownDefinitionId: null,
    emergencyResponseDefinitionId: null,
    emergencyResponseResult: null,
    outcomeProposal: null,
    requiresGmApproval: false,
    errors: dedupe(errors),
    warnings: []
  };
}

function emergencyResponseSuccess(capacityExhaustion, breakdownDefinition, emergencyResponseResult, outcomeProposal) {
  const resultCapture = captureRoot(emergencyResponseResult);
  const proposalCapture = captureRoot(outcomeProposal);
  if (!resultCapture.ok || !proposalCapture.ok) {
    return emergencyResponseFailure([
      ...(!resultCapture.ok ? resultCapture.errors : []),
      ...(!proposalCapture.ok ? proposalCapture.errors : [])
    ]);
  }
  const proposalFields = emergencyResponseResult.overallResult === "emergency-stabilized"
    ? STABILIZED_PROPOSAL_FIELDS
    : FAILED_PROPOSAL_FIELDS;
  if (!exactKeys(resultCapture.value, EMERGENCY_RESPONSE_RESULT_FIELDS)
    || !exactKeys(proposalCapture.value, proposalFields)) {
    return emergencyResponseFailure([hostileIssue()]);
  }
  const responseDefinition = breakdownDefinition.emergencyResponseDefinition;
  return {
    ok: true,
    readyForEmergencyResponseOutcome: true,
    eventId: capacityExhaustion.eventId,
    sessionId: capacityExhaustion.sessionId,
    definitionSnapshotId: capacityExhaustion.definitionSnapshotId,
    shipId: capacityExhaustion.shipId,
    systemId: capacityExhaustion.systemId,
    breakdownDefinitionId: breakdownDefinition.breakdownDefinitionId,
    emergencyResponseDefinitionId: responseDefinition.emergencyResponseDefinitionId,
    emergencyResponseResult: resultCapture.value,
    outcomeProposal: proposalCapture.value,
    requiresGmApproval: true,
    errors: [],
    warnings: []
  };
}

function validateCapacityExhaustion(value) {
  return exactKeys(value, CAPACITY_EXHAUSTION_FIELDS)
    && value.kind === "voyage.m10-capacity-exhaustion"
    && nonblank(value.eventId)
    && nonblank(value.sessionId)
    && nonblank(value.definitionSnapshotId)
    && nonblank(value.shipId)
    && SYSTEM_IDS.has(value.systemId)
    && value.systemKind === "pressure-system"
    && safeRevision(value.liveRevision)
    && Number.isSafeInteger(value.scarCapacity)
    && value.scarCapacity >= 0
    && Number.isSafeInteger(value.occupiedScarCount)
    && value.occupiedScarCount >= 0
    && nonblank(value.incomingScarProposalId)
    && nonblank(value.incomingScarProposalKind)
    && nonblank(value.incomingScarProposalStatus);
}

function structurallyEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!structurallyEqual(left[index], right[index])) return false;
    }
    return true;
  }
  if (isPlain(left) || isPlain(right)) {
    if (!isPlain(left) || !isPlain(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length || !leftKeys.every((key, index) => key === rightKeys[index])) return false;
    return leftKeys.every((key) => structurallyEqual(left[key], right[key]));
  }
  return false;
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

function validateEmergencyResponseIdentity(request, breakdownDefinition, breakdownPlan, historyValue) {
  const capacityExhaustion = breakdownPlan.capacityExhaustion;
  const errors = [];
  if (breakdownDefinition.catastrophicHazard.encounterId !== capacityExhaustion.eventId
    || historyValue.eventId !== capacityExhaustion.eventId) {
    errors.push(task4Issue(
      "m9-event-identity-mismatch",
      "breakdownPlan.capacityExhaustion.eventId",
      "Event identity does not match the M10 handoff."
    ));
  }
  if (request.sessionId !== capacityExhaustion.sessionId || historyValue.sessionId !== capacityExhaustion.sessionId) {
    errors.push(task4Issue(
      "m9-session-identity-mismatch",
      "breakdownPlan.capacityExhaustion.sessionId",
      "Session identity does not match the M10 handoff or request."
    ));
  }
  if (historyValue.definitionSnapshotId !== capacityExhaustion.definitionSnapshotId) {
    errors.push(task4Issue(
      "m9-definition-snapshot-mismatch",
      "breakdownPlan.capacityExhaustion.definitionSnapshotId",
      "Definition snapshot identity does not match the M10 handoff."
    ));
  }
  if (historyValue.shipId !== capacityExhaustion.shipId) {
    errors.push(task4Issue(
      "m9-ship-identity-mismatch",
      "breakdownPlan.capacityExhaustion.shipId",
      "Ship identity does not match the M10 handoff."
    ));
  }
  if (breakdownDefinition.systemId !== capacityExhaustion.systemId
    || breakdownDefinition.catastrophicHazard.pressureSystemId !== capacityExhaustion.systemId
    || historyValue.systemId !== capacityExhaustion.systemId) {
    errors.push(task4Issue(
      "m9-system-identity-mismatch",
      "breakdownPlan.capacityExhaustion.systemId",
      "Affected system identity does not match the M10 handoff."
    ));
  }
  if (historyValue.liveRevision !== capacityExhaustion.liveRevision) {
    errors.push(task4Issue(
      "m9-revision-binding-mismatch",
      "breakdownPlan.capacityExhaustion.liveRevision",
      "Live revision binding does not match the M10 handoff."
    ));
  }
  if (breakdownPlan.emergencyResponseDefinitionId
    !== breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId) {
    errors.push(task4Issue(
      "m9-invalid-breakdown-plan",
      "breakdownPlan",
      "Breakdown plan does not match the captured definition and handoff."
    ));
  }
  return errors;
}

function validateCapacityApplicability(value) {
  const errors = [];
  if (value.occupiedScarCount !== value.scarCapacity) {
    errors.push(task4Issue(
      "m9-capacity-not-exhausted",
      "capacityExhaustion.occupiedScarCount",
      "Capacity exhaustion is not established."
    ));
  }
  if (value.incomingScarProposalStatus !== "approved-unapplied") {
    errors.push(task4Issue(
      "m9-invalid-incoming-scar-proposal",
      "capacityExhaustion.incomingScarProposalId",
      "Incoming ordinary Scar proposal evidence is invalid."
    ));
  }
  return errors;
}

function calculateEmergencyResponseResult(historyValue) {
  const successfulRoundCount = historyValue.rounds.filter((round) => (
    round.roundResult === VOYAGE_ROUND_RESULTS.SUCCESS
    || round.roundResult === VOYAGE_ROUND_RESULTS.CRITICAL_SUCCESS
  )).length;
  const failedRoundCount = historyValue.rounds.filter((round) => (
    round.roundResult === VOYAGE_ROUND_RESULTS.FAILURE
    || round.roundResult === VOYAGE_ROUND_RESULTS.CRITICAL_FAILURE
  )).length;
  const roundCount = historyValue.rounds.length;
  const winningThreshold = (roundCount + 1) / 2;
  const overallResult = successfulRoundCount >= winningThreshold
    ? "emergency-stabilized"
    : "emergency-failed";
  return {
    overallResult,
    roundCount,
    winningThreshold,
    successfulRoundCount,
    failedRoundCount
  };
}

function createOutcomeProposal(result, capacityExhaustion, breakdownDefinition) {
  const responseDefinition = breakdownDefinition.emergencyResponseDefinition;
  if (result.overallResult === "emergency-stabilized") {
    return {
      kind: "m9-emergency-response-stabilized",
      eventId: capacityExhaustion.eventId,
      sessionId: capacityExhaustion.sessionId,
      definitionSnapshotId: capacityExhaustion.definitionSnapshotId,
      shipId: capacityExhaustion.shipId,
      systemId: capacityExhaustion.systemId,
      breakdownDefinitionId: breakdownDefinition.breakdownDefinitionId,
      emergencyResponseDefinitionId: responseDefinition.emergencyResponseDefinitionId,
      catastrophicHazardId: breakdownDefinition.catastrophicHazard.hazardId,
      catastropheStatus: "stabilized",
      hazardDisposition: "contained",
      systemStatus: "disabled",
      repairApplied: false,
      scarAdded: false,
      scarRemoved: false,
      sourceEventStatus: "ended",
      nextSituation: responseDefinition.nextSituations[0],
      requiresGmApproval: true
    };
  }
  return {
    kind: "m9-emergency-response-failed",
    eventId: capacityExhaustion.eventId,
    sessionId: capacityExhaustion.sessionId,
    definitionSnapshotId: capacityExhaustion.definitionSnapshotId,
    shipId: capacityExhaustion.shipId,
    systemId: capacityExhaustion.systemId,
    breakdownDefinitionId: breakdownDefinition.breakdownDefinitionId,
    emergencyResponseDefinitionId: responseDefinition.emergencyResponseDefinitionId,
    catastrophicHazardId: breakdownDefinition.catastrophicHazard.hazardId,
    catastropheStatus: "failed",
    systemStatus: "disabled",
    sourceEventStatus: "ended",
    retryAllowed: false,
    consequence: responseDefinition.failureConsequences[0],
    nextSituation: responseDefinition.nextSituations[0],
    requiresGmApproval: true
  };
}

function validateResponseDefinition(value) {
  if (!exactKeys(value, RESPONSE_DEFINITION_FIELDS)) return false;
  if (value.schemaVersion !== 1
    || !nonblank(value.emergencyResponseDefinitionId)
    || !nonblank(value.breakdownDefinitionId)
    || !nonblank(value.systemId)
    || !SYSTEM_IDS.has(value.systemId)
    || value.systemKind !== "pressure-system"
    || !nonblank(value.title)
    || !nonblank(value.description)
    || !ROUND_COUNTS.has(value.roundCount)
    || !denseArray(value.rounds)
    || value.rounds.length !== value.roundCount) return false;
  const ids = new Set();
  for (let index = 0; index < value.rounds.length; index += 1) {
    const round = value.rounds[index];
    if (!exactKeys(round, AUTHORED_ROUND_FIELDS)
      || !nonblank(round.roundId)
      || !Number.isSafeInteger(round.roundNumber)
      || round.roundNumber !== index + 1
      || ids.has(round.roundId)) return false;
    ids.add(round.roundId);
  }
  if (!exactKeys(value.stabilizationOutcome, STABILIZATION_FIELDS)
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
    || !exactKeys(value.nextSituations[0], NEXT_SITUATION_FIELDS)
    || !nonblank(value.nextSituations[0].nextSituationId)
    || !nonblank(value.nextSituations[0].title)
    || !nonblank(value.nextSituations[0].summary)
    || !TRANSITION_KINDS.has(value.nextSituations[0].transitionKind)) return false;

  const nextSituationId = value.nextSituations[0].nextSituationId;
  if (value.stabilizationOutcome.nextSituationId !== nextSituationId
    || value.failureConsequences[0].nextSituationId !== nextSituationId) return false;
  const identities = [
    value.emergencyResponseDefinitionId,
    ...value.rounds.map((round) => round.roundId),
    value.stabilizationOutcome.outcomeId,
    value.failureConsequences[0].consequenceId,
    nextSituationId
  ];
  return new Set(identities).size === identities.length;
}

function validateCaptureShape(history) {
  const root = "completedRoundHistory";
  if (!exactKeys(history, COMPLETED_ROUND_HISTORY_FIELDS)) return [issue(root)];
  if (!denseArray(history.rounds)) return [issue(`${root}.rounds`)];
  const errors = [];
  for (let index = 0; index < history.rounds.length; index += 1) {
    if (!exactKeys(history.rounds[index], ROUND_FIELDS)) errors.push(issue(`${root}.rounds[${index}]`));
  }
  return dedupe(errors);
}

function validateHistoryShape(history) {
  const errors = [];
  const root = "completedRoundHistory";
  const captureErrors = validateCaptureShape(history);
  if (captureErrors.length > 0) return captureErrors;

  if (history.schemaVersion !== 1) errors.push(issue(`${root}.schemaVersion`));
  for (const field of ["eventId", "sessionId", "definitionSnapshotId", "shipId", "systemId", "breakdownDefinitionId", "emergencyResponseDefinitionId"]) {
    if (!nonblank(history[field])) errors.push(issue(`${root}.${field}`));
  }
  if (!safeRevision(history.liveRevision)) errors.push(issue(`${root}.liveRevision`));
  if (!ROUND_COUNTS.has(history.roundCount)) errors.push(issue(`${root}.roundCount`));
  if (!denseArray(history.rounds)) return [...errors, issue(`${root}.rounds`)];
  if (history.rounds.length !== history.roundCount) errors.push(issue(`${root}.rounds`));

  const seen = new Set();
  for (let index = 0; index < history.rounds.length; index += 1) {
    const path = `${root}.rounds[${index}]`;
    const round = history.rounds[index];
    if (!exactKeys(round, ROUND_FIELDS)) {
      errors.push(issue(path));
      continue;
    }
    const validId = nonblank(round.roundId);
    const validNumber = Number.isSafeInteger(round.roundNumber);
    if (!validId) errors.push(issue(`${path}.roundId`));
    if (!validNumber || round.roundNumber !== index + 1) errors.push(issue(`${path}.roundNumber`));
    if (!ROUND_RESULTS.has(round.roundResult)) errors.push(issue(`${path}.roundResult`));
    if (validId && seen.has(round.roundId)) errors.push(issue(`${path}.roundId`));
    if (validId) seen.add(round.roundId);
  }
  return dedupe(errors);
}

function validateHistoryBindings(history, emergencyResponseDefinition) {
  const errors = [];
  const root = "completedRoundHistory";
  if (!validateResponseDefinition(emergencyResponseDefinition)) return [issue("emergencyResponseDefinition")];

  if (history.systemId !== emergencyResponseDefinition.systemId) {
    errors.push(issue(`${root}.systemId`));
  }
  if (history.breakdownDefinitionId !== emergencyResponseDefinition.breakdownDefinitionId) {
    errors.push(issue(`${root}.breakdownDefinitionId`));
  }
  if (history.emergencyResponseDefinitionId !== emergencyResponseDefinition.emergencyResponseDefinitionId) {
    errors.push(issue(`${root}.emergencyResponseDefinitionId`));
  }
  if (history.roundCount !== emergencyResponseDefinition.roundCount) {
    errors.push(issue(`${root}.roundCount`));
  }

  const authoredRounds = emergencyResponseDefinition.rounds;
  const rounds = history.rounds;
  if (rounds.length !== authoredRounds.length) errors.push(issue(`${root}.rounds`));
  const limit = Math.min(rounds.length, authoredRounds.length);
  for (let index = 0; index < limit; index += 1) {
    const historyRound = rounds[index];
    const authoredRound = authoredRounds[index];
    if (!exactKeys(historyRound, ROUND_FIELDS) || !exactKeys(authoredRound, AUTHORED_ROUND_FIELDS)) continue;
    if (nonblank(historyRound.roundId) && historyRound.roundId !== authoredRound.roundId) {
      errors.push(issue(`completedRoundHistory.rounds[${index}].roundId`));
    }
    if (Number.isSafeInteger(historyRound.roundNumber) && historyRound.roundNumber !== authoredRound.roundNumber) {
      errors.push(issue(`completedRoundHistory.rounds[${index}].roundNumber`));
    }
  }
  return errors;
}

function validationResult(errors) {
  const normalized = dedupe(errors);
  return { valid: normalized.length === 0, errors: normalized, warnings: [] };
}

function captureFailure(errors) {
  return {
    ok: false,
    completedRoundHistory: null,
    errors: dedupe(errors),
    warnings: []
  };
}

export function validateVoyageEmergencyResponseCompletedRoundHistory(completedRoundHistory, emergencyResponseDefinition) {
  const historyCapture = captureRoot(completedRoundHistory);
  if (!historyCapture.ok) return validationResult(historyCapture.errors);
  const definitionCapture = captureRoot(emergencyResponseDefinition);
  if (!definitionCapture.ok) return validationResult(definitionCapture.errors);

  const shapeErrors = validateHistoryShape(historyCapture.value);
  if (shapeErrors.length > 0) return validationResult(shapeErrors);
  return validationResult(validateHistoryBindings(historyCapture.value, definitionCapture.value));
}

export function captureVoyageEmergencyResponseCompletedRoundHistory(completedRoundHistory) {
  const captured = captureRoot(completedRoundHistory);
  if (!captured.ok) return captureFailure(captured.errors);
  const errors = validateCaptureShape(captured.value);
  if (errors.length > 0) return captureFailure(errors);
  return {
    ok: true,
    completedRoundHistory: captured.value,
    errors: [],
    warnings: []
  };
}

export function analyzeVoyageEmergencyResponseResult(request) {
  const captured = captureRoot(request);
  if (!captured.ok) return emergencyResponseFailure(captured.errors);

  try {
    const value = captured.value;
    if (!isPlain(value)) {
      return emergencyResponseFailure([task4Issue(
        "m9-invalid-request-shape",
        "request",
        "Request has an invalid exact shape or field values."
      )]);
    }

    const prohibitedErrors = Object.keys(value)
      .filter((key) => EMERGENCY_RESPONSE_PROHIBITED_KEYS.has(key))
      .map((key) => task4Issue(
        "m9-caller-authored-application-rejected",
        `request.${key}`,
        "Caller-authored application or runtime authority is not accepted."
      ));
    if (prohibitedErrors.length > 0) return emergencyResponseFailure(prohibitedErrors);

    if (value.kind !== "m9-emergency-response") {
      return emergencyResponseFailure([task4Issue(
        "m9-invalid-mode",
        "request.kind",
        "Only the requested Milestone 9 analysis mode is supported."
      )]);
    }

    if (!exactKeys(value, EMERGENCY_RESPONSE_REQUEST_FIELDS)
      || !nonblank(value.sessionId)
      || !isPlain(value.breakdownDefinition)
      || !isPlain(value.breakdownPlan)
      || !isPlain(value.completedRoundHistory)) {
      return emergencyResponseFailure([task4Issue(
        "m9-invalid-request-shape",
        "request",
        "Request has an invalid exact shape or field values."
      )]);
    }

    const definitionValidation = validateVoyageCatastrophicBreakdownDefinition(value.breakdownDefinition);
    if (!definitionValidation.valid) return emergencyResponseFailure(definitionValidation.errors);

    const breakdownPlan = value.breakdownPlan;
    if (!Object.hasOwn(breakdownPlan, "capacityExhaustion")
      || !isPlain(breakdownPlan.capacityExhaustion)) {
      return emergencyResponseFailure([task4Issue(
        "m9-invalid-breakdown-plan",
        "breakdownPlan",
        "Breakdown plan does not match the captured definition and handoff."
      )]);
    }

    const capacityExhaustion = breakdownPlan.capacityExhaustion;
    if (!validateCapacityExhaustion(capacityExhaustion)) {
      return emergencyResponseFailure([task4Issue(
        "m9-invalid-capacity-exhaustion",
        "breakdownPlan.capacityExhaustion",
        "Capacity-exhaustion handoff is invalid."
      )]);
    }

    const responseDefinition = value.breakdownDefinition.emergencyResponseDefinition;
    const historyValidation = validateVoyageEmergencyResponseCompletedRoundHistory(
      value.completedRoundHistory,
      responseDefinition
    );
    const historyErrors = historyValidation.errors;
    if (historyErrors.length === 0) {
      const identityErrors = validateEmergencyResponseIdentity(
        value,
        value.breakdownDefinition,
        breakdownPlan,
        value.completedRoundHistory
      );
      if (identityErrors.length > 0) return emergencyResponseFailure(identityErrors);
    }

    const capacityErrors = validateCapacityApplicability(capacityExhaustion);
    if (capacityErrors.length > 0) return emergencyResponseFailure(capacityErrors);

    if (capacityExhaustion.incomingScarProposalKind !== "ordinary-void-scar") {
      return emergencyResponseFailure([task4Issue(
        "m9-breakdown-not-applicable",
        "capacityExhaustion",
        "Catastrophic Breakdown is not applicable to this handoff."
      )]);
    }

    const expectedPlan = regenerateBreakdownPlan(value.breakdownDefinition, capacityExhaustion);
    if (!structurallyEqual(breakdownPlan, expectedPlan)) {
      return emergencyResponseFailure([task4Issue(
        "m9-invalid-breakdown-plan",
        "breakdownPlan",
        "Breakdown plan does not match the captured definition and handoff."
      )]);
    }

    if (historyErrors.length > 0) return emergencyResponseFailure(historyErrors);

    const emergencyResponseResult = calculateEmergencyResponseResult(value.completedRoundHistory);
    const outcomeProposal = createOutcomeProposal(
      emergencyResponseResult,
      capacityExhaustion,
      value.breakdownDefinition
    );
    return emergencyResponseSuccess(
      capacityExhaustion,
      value.breakdownDefinition,
      emergencyResponseResult,
      outcomeProposal
    );
  } catch {
    return emergencyResponseFailure([hostileIssue()]);
  }
}
