import { VOYAGE_PRESSURE_SYSTEM_IDS, VOYAGE_ROUND_RESULTS } from "./constants.js";

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
