import assert from "node:assert/strict";
import { test } from "node:test";
import { VOYAGE_ROUND_RESULTS } from "../../../scripts/voyage/domain/constants.js";
import {
  analyzeVoyageEmergencyResponseResult,
  validateVoyageEmergencyResponseCompletedRoundHistory,
  captureVoyageEmergencyResponseCompletedRoundHistory
} from "../../../scripts/voyage/domain/emergency-response.js";

const COUNTS = [3, 5, 7, 9, 11];
const RESULTS = Object.values(VOYAGE_ROUND_RESULTS);
const HISTORY_FIELDS = [
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
];
const ROUND_FIELDS = ["roundId", "roundNumber", "roundResult"];
const MESSAGE = "Emergency Response round history is invalid.";
const HOSTILE_MESSAGE = "Milestone 9 data could not be captured safely.";

function responseDefinition(roundCount = 3, overrides = {}) {
  return {
    schemaVersion: 1,
    emergencyResponseDefinitionId: "response-1",
    breakdownDefinitionId: "breakdown-1",
    systemId: "crew-morale",
    systemKind: "pressure-system",
    title: "Emergency response",
    description: "An authored emergency response.",
    roundCount,
    rounds: Array.from({ length: roundCount }, (_, index) => ({
      roundId: `round-${index + 1}`,
      roundNumber: index + 1
    })),
    stabilizationOutcome: {
      outcomeId: "outcome-1",
      title: "Stabilized",
      description: "The pressure is contained.",
      nextSituationId: "next-1"
    },
    failureConsequences: [{
      consequenceId: "consequence-1",
      kind: "strand",
      title: "Stranded",
      description: "The vessel is stranded.",
      nextSituationId: "next-1"
    }],
    nextSituations: [{
      nextSituationId: "next-1",
      title: "Aftermath",
      summary: "The crew faces the aftermath.",
      transitionKind: "emergency"
    }],
    ...overrides
  };
}

function history(definition = responseDefinition(), overrides = {}) {
  return {
    schemaVersion: 1,
    eventId: "event-1",
    sessionId: "session-1",
    definitionSnapshotId: "snapshot-1",
    shipId: "ship-1",
    systemId: definition.systemId,
    liveRevision: 7,
    breakdownDefinitionId: definition.breakdownDefinitionId,
    emergencyResponseDefinitionId: definition.emergencyResponseDefinitionId,
    roundCount: definition.roundCount,
    rounds: definition.rounds.map((round) => ({ ...round, roundResult: "round-success" })),
    ...overrides
  };
}

function catastrophicHazard(systemId = "crew-morale", overrides = {}) {
  const descriptor = { consequenceId: "descriptive-consequence" };
  return {
    hazardId: "catastrophic-hazard-1",
    encounterId: "event-1",
    category: "system",
    status: "active",
    name: "Catastrophic system failure",
    currentEffect: descriptor,
    activationTiming: { kind: "immediate", stationId: null, resultId: null },
    removalMethod: { methodId: "emergency-response" },
    ignoredConsequence: descriptor,
    visibility: "public",
    sourceKind: "m9-catastrophic-breakdown",
    createdStageId: "stage-1",
    createdRoundNumber: 1,
    createdSequence: 0,
    escalation: {
      mode: "none",
      currentStageId: null,
      stages: [],
      countdown: null,
      maximumEscalationReached: false,
      escalationConsequence: null
    },
    collisionPolicy: "trigger-existing-consequence",
    duration: { mode: "none", remaining: null, initial: null, decrementTiming: null },
    failurePressureSystemId: systemId,
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { consequence: descriptor } },
    pressureSystemId: systemId,
    eventAreaId: null,
    pressureBreachId: "breach-1",
    stationId: "engineer",
    actionId: "action-1",
    pressureEffectId: "pressure-effect-1",
    sourceIntentId: "intent-1",
    activationSource: "catastrophic-breakdown",
    branch: "failure",
    sourceTiming: "consequences",
    sourceVisibility: "public",
    ...overrides
  };
}

function breakdownDefinitionForResult({ systemId = "crew-morale", responseOverrides = {}, hazardOverrides = {}, overrides = {} } = {}) {
  return {
    schemaVersion: 1,
    breakdownDefinitionId: "breakdown-1",
    systemId,
    systemKind: "pressure-system",
    title: "Catastrophic Breakdown",
    description: "An authored catastrophic breakdown.",
    catastrophicHazard: catastrophicHazard(systemId, hazardOverrides),
    pausePlan: { timing: "after-current-segment", resumeCondition: "emergency-response-resolved" },
    emergencyResponseDefinition: responseDefinition(3, { systemId, ...responseOverrides }),
    ...overrides
  };
}

function capacityForResult(overrides = {}) {
  return {
    kind: "voyage.m10-capacity-exhaustion",
    eventId: "event-1",
    sessionId: "session-1",
    definitionSnapshotId: "snapshot-1",
    shipId: "ship-1",
    systemId: "crew-morale",
    systemKind: "pressure-system",
    liveRevision: 7,
    scarCapacity: 2,
    occupiedScarCount: 2,
    incomingScarProposalId: "scar-proposal-1",
    incomingScarProposalKind: "ordinary-void-scar",
    incomingScarProposalStatus: "approved-unapplied",
    ...overrides
  };
}

function breakdownPlanForResult(definition = breakdownDefinitionForResult(), capacity = capacityForResult()) {
  return {
    systemDisablement: {
      systemId: capacity.systemId,
      systemKind: capacity.systemKind,
      disabled: true
    },
    catastrophicHazard: definition.catastrophicHazard,
    pausePlan: definition.pausePlan,
    emergencyResponseDefinitionId: definition.emergencyResponseDefinition.emergencyResponseDefinitionId,
    scarApplication: null,
    capacityExhaustion: capacity
  };
}

function emergencyResponseRequest({
  kind = "m9-emergency-response",
  sessionId = "session-1",
  definition = breakdownDefinitionForResult(),
  capacity = capacityForResult(),
  plan = breakdownPlanForResult(definition, capacity),
  completedRoundHistory = history(definition.emergencyResponseDefinition),
  extras = {}
} = {}) {
  return {
    kind,
    sessionId,
    breakdownDefinition: definition,
    breakdownPlan: plan,
    completedRoundHistory,
    ...extras
  };
}

const RESULT_FAILURE_FIELDS = [
  "ok",
  "readyForEmergencyResponseOutcome",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "shipId",
  "systemId",
  "breakdownDefinitionId",
  "emergencyResponseDefinitionId",
  "emergencyResponseResult",
  "outcomeProposal",
  "requiresGmApproval",
  "errors",
  "warnings"
];
const RESULT_FIELDS = [
  "overallResult",
  "roundCount",
  "winningThreshold",
  "successfulRoundCount",
  "failedRoundCount"
];
const STABILIZED_FIELDS = [
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
];
const FAILED_FIELDS = [
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
];

function task4Diagnostic(code, path, message) {
  return { code, path, message, severity: "error" };
}

function assertTask4Failure(result, errors) {
  assert.deepEqual(Object.keys(result), RESULT_FAILURE_FIELDS);
  assert.equal(result.ok, false);
  assert.equal(result.readyForEmergencyResponseOutcome, false);
  assert.equal(result.eventId, null);
  assert.equal(result.sessionId, null);
  assert.equal(result.definitionSnapshotId, null);
  assert.equal(result.shipId, null);
  assert.equal(result.systemId, null);
  assert.equal(result.breakdownDefinitionId, null);
  assert.equal(result.emergencyResponseDefinitionId, null);
  assert.equal(result.emergencyResponseResult, null);
  assert.equal(result.outcomeProposal, null);
  assert.equal(result.requiresGmApproval, false);
  assert.deepEqual(result.errors, errors);
  assert.deepEqual(result.warnings, []);
}

function diagnostic(path) {
  return { code: "m9-invalid-emergency-response-history", path, message: MESSAGE, severity: "error" };
}

function hostileDiagnostic() {
  return { code: "m9-hostile-data-capture-failed", path: "$", message: HOSTILE_MESSAGE, severity: "error" };
}

function assertHostileCapture(result) {
  assert.deepEqual(result, {
    ok: false,
    completedRoundHistory: null,
    errors: [hostileDiagnostic()],
    warnings: []
  });
}

function assertValid(value, definition = responseDefinition()) {
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, definition), {
    valid: true,
    errors: [],
    warnings: []
  });
}

function assertCaptureIsolated(value) {
  const result = captureVoyageEmergencyResponseCompletedRoundHistory(value);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result), ["ok", "completedRoundHistory", "errors", "warnings"]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.notEqual(result.completedRoundHistory, value);
  assert.deepEqual(result.completedRoundHistory, value);
  assert.notEqual(result.completedRoundHistory.rounds, value.rounds);
  for (let index = 0; index < value.rounds.length; index += 1) {
    assert.notEqual(result.completedRoundHistory.rounds[index], value.rounds[index]);
  }
  return result.completedRoundHistory;
}

test("exports only the three authorized Task 3 and Task 4 APIs", async () => {
  const module = await import("../../../scripts/voyage/domain/emergency-response.js");
  assert.deepEqual(Object.keys(module).sort(), [
    "analyzeVoyageEmergencyResponseResult",
    "captureVoyageEmergencyResponseCompletedRoundHistory",
    "validateVoyageEmergencyResponseCompletedRoundHistory"
  ]);
});

test("accepts every supported odd authored round count", () => {
  for (const count of COUNTS) {
    const definition = responseDefinition(count);
    assertValid(history(definition), definition);
  }
});

test("accepts every canonical round-result value", () => {
  for (const result of RESULTS) {
    const definition = responseDefinition();
    assertValid(history(definition, { rounds: definition.rounds.map((round) => ({ ...round, roundResult: result })) }), definition);
  }
});

test("capture preserves the exact canonical root key order", () => {
  const captured = assertCaptureIsolated(history());
  assert.deepEqual(Object.keys(captured), HISTORY_FIELDS);
});

test("capture preserves the exact canonical round-entry key order", () => {
  const captured = assertCaptureIsolated(history());
  assert.deepEqual(Object.keys(captured.rounds[0]), ROUND_FIELDS);
});

test("reordered completed-history root keys fail at the canonical root path", () => {
  const canonical = history();
  const reordered = {
    rounds: canonical.rounds,
    roundCount: canonical.roundCount,
    emergencyResponseDefinitionId: canonical.emergencyResponseDefinitionId,
    breakdownDefinitionId: canonical.breakdownDefinitionId,
    liveRevision: canonical.liveRevision,
    systemId: canonical.systemId,
    shipId: canonical.shipId,
    definitionSnapshotId: canonical.definitionSnapshotId,
    sessionId: canonical.sessionId,
    eventId: canonical.eventId,
    schemaVersion: canonical.schemaVersion
  };
  const before = JSON.stringify(reordered);
  const result = captureVoyageEmergencyResponseCompletedRoundHistory(reordered);
  assert.deepEqual(result, {
    ok: false,
    completedRoundHistory: null,
    errors: [diagnostic("completedRoundHistory")],
    warnings: []
  });
  assert.equal(JSON.stringify(reordered), before);
});

test("reordered round-entry keys fail at the concrete indexed path", () => {
  const value = history();
  const round = value.rounds[0];
  value.rounds[0] = {
    roundNumber: round.roundNumber,
    roundId: round.roundId,
    roundResult: round.roundResult
  };
  const before = JSON.stringify(value);
  const result = captureVoyageEmergencyResponseCompletedRoundHistory(value);
  assert.deepEqual(result, {
    ok: false,
    completedRoundHistory: null,
    errors: [diagnostic("completedRoundHistory.rounds[0]")],
    warnings: []
  });
  assert.equal(JSON.stringify(value), before);
});

test("rejects an unsupported schema version", () => {
  const value = history();
  value.schemaVersion = 2;
  assert.equal(captureVoyageEmergencyResponseCompletedRoundHistory(value).ok, true);
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, responseDefinition()).errors, [diagnostic("completedRoundHistory.schemaVersion")]);
});

test("rejects unsupported round counts", () => {
  const value = history();
  value.roundCount = 4;
  assert.equal(captureVoyageEmergencyResponseCompletedRoundHistory(value).ok, true);
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, responseDefinition()).errors, [diagnostic("completedRoundHistory.roundCount"), diagnostic("completedRoundHistory.rounds")]);
});

test("rejects a history count that differs from its dense rounds", () => {
  const definition = responseDefinition(3);
  const value = history(definition, {
    roundCount: 5,
    rounds: Array.from({ length: 5 }, (_, index) => ({ roundId: `round-${index + 1}`, roundNumber: index + 1, roundResult: "round-success" }))
  });
  assert.equal(captureVoyageEmergencyResponseCompletedRoundHistory(value).ok, true);
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, definition).errors, [
    diagnostic("completedRoundHistory.roundCount"),
    diagnostic("completedRoundHistory.rounds")
  ]);
});

test("rejects a sparse rounds array as hostile capture input", () => {
  const value = history();
  delete value.rounds[1];
  const result = captureVoyageEmergencyResponseCompletedRoundHistory(value);
  assert.deepEqual(result.errors, [hostileDiagnostic()]);
  assert.equal(result.completedRoundHistory, null);
});

test("rejects an absent rounds array", () => {
  const value = history();
  delete value.rounds;
  assert.deepEqual(captureVoyageEmergencyResponseCompletedRoundHistory(value).errors, [diagnostic("completedRoundHistory")]);
});

test("rejects an out-of-order round identity", () => {
  const definition = responseDefinition();
  const value = history(definition);
  value.rounds[0].roundId = "unknown-round";
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, definition).errors, [diagnostic("completedRoundHistory.rounds[0].roundId")]);
});

test("rejects duplicate round identities during capture", () => {
  const value = history();
  value.rounds[1].roundId = value.rounds[0].roundId;
  assert.equal(captureVoyageEmergencyResponseCompletedRoundHistory(value).ok, true);
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, responseDefinition()).errors, [diagnostic("completedRoundHistory.rounds[1].roundId")]);
});

test("rejects an unknown authored round identity", () => {
  const definition = responseDefinition();
  const value = history(definition);
  value.rounds[1].roundId = "unknown-round";
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, definition).errors, [diagnostic("completedRoundHistory.rounds[1].roundId")]);
});

test("rejects an invalid round number", () => {
  const value = history();
  value.rounds[1].roundNumber = 9;
  assert.equal(captureVoyageEmergencyResponseCompletedRoundHistory(value).ok, true);
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, responseDefinition()).errors, [diagnostic("completedRoundHistory.rounds[1].roundNumber")]);
});

test("rejects a noncanonical round result", () => {
  const value = history();
  value.rounds[0].roundResult = "success";
  assert.equal(captureVoyageEmergencyResponseCompletedRoundHistory(value).ok, true);
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, responseDefinition()).errors, [diagnostic("completedRoundHistory.rounds[0].roundResult")]);
});

test("accepts all required handoff identity fields when structurally valid", () => {
  const definition = responseDefinition();
  const value = history(definition, {
    eventId: "handoff-event",
    sessionId: "handoff-session",
    definitionSnapshotId: "handoff-snapshot",
    shipId: "handoff-ship",
    systemId: "crew-morale",
    liveRevision: 0
  });
  assertValid(value, definition);
});

test("accumulates complete binding failures in canonical history order", () => {
  const definition = responseDefinition(3);
  const value = history(definition, {
    systemId: "arkengine",
    breakdownDefinitionId: "other-breakdown",
    emergencyResponseDefinitionId: "other-response",
    roundCount: 5,
    rounds: Array.from({ length: 5 }, (_, index) => ({ roundId: `round-${index + 1}`, roundNumber: index + 1, roundResult: "round-success" }))
  });
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, definition).errors, [
    diagnostic("completedRoundHistory.systemId"),
    diagnostic("completedRoundHistory.breakdownDefinitionId"),
    diagnostic("completedRoundHistory.emergencyResponseDefinitionId"),
    diagnostic("completedRoundHistory.roundCount"),
    diagnostic("completedRoundHistory.rounds")
  ]);
});

test("rejects a blank event identity", () => {
  const value = history();
  value.eventId = " ";
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, responseDefinition()).errors, [diagnostic("completedRoundHistory.eventId")]);
});

test("rejects a blank session identity", () => {
  const value = history();
  value.sessionId = "";
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, responseDefinition()).errors, [diagnostic("completedRoundHistory.sessionId")]);
});

test("rejects a padded definition snapshot identity", () => {
  const value = history();
  value.definitionSnapshotId = " snapshot-1";
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, responseDefinition()).errors, [diagnostic("completedRoundHistory.definitionSnapshotId")]);
});

test("rejects a padded ship identity", () => {
  const value = history();
  value.shipId = "ship-1 ";
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, responseDefinition()).errors, [diagnostic("completedRoundHistory.shipId")]);
});

test("rejects a noncanonical live revision", () => {
  const value = history();
  value.liveRevision = -1;
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, responseDefinition()).errors, [diagnostic("completedRoundHistory.liveRevision")]);
});

test("undefined values fail as hostile data with no partial capture", () => {
  const value = history();
  value.shipId = undefined;
  const result = captureVoyageEmergencyResponseCompletedRoundHistory(value);
  assert.deepEqual(result.errors, [hostileDiagnostic()]);
  assert.equal(result.completedRoundHistory, null);
});

test("throwing accessors fail safely without exposing trap text", () => {
  const value = history();
  Object.defineProperty(value, "eventId", { enumerable: true, get() { throw new Error("secret trap"); } });
  const result = captureVoyageEmergencyResponseCompletedRoundHistory(value);
  assert.deepEqual(result.errors, [hostileDiagnostic()]);
  assert.ok(result.errors.every((entry) => !/secret trap|TypeError|stack|Proxy/i.test(entry.message)));
});

test("setter and non-throwing accessor descriptors fail with the exact hostile envelope", () => {
  const fixtures = [
    (value) => Object.defineProperty(value, "eventId", { enumerable: true, set() {} }),
    (value) => Object.defineProperty(value.rounds[0], "roundResult", {
      enumerable: true,
      get() { return "round-success"; },
      set() {}
    })
  ];
  for (const setup of fixtures) {
    const value = history();
    setup(value);
    const result = captureVoyageEmergencyResponseCompletedRoundHistory(value);
    assertHostileCapture(result);
    assert.equal(result.completedRoundHistory, null);
  }
});

test("symbol keys are rejected as hostile data", () => {
  const value = history();
  value[Symbol("unexpected")] = true;
  assert.deepEqual(captureVoyageEmergencyResponseCompletedRoundHistory(value).errors, [hostileDiagnostic()]);
});

test("symbol values fail with the exact hostile envelope and remain isolated", () => {
  const value = history();
  const symbol = Symbol("unexpected-value");
  value.rounds[0].roundResult = symbol;
  const result = captureVoyageEmergencyResponseCompletedRoundHistory(value);
  assertHostileCapture(result);
  assert.strictEqual(value.rounds[0].roundResult, symbol);
});

test("nonplain Date values are rejected as hostile data", () => {
  const value = history();
  value.rounds[0].roundResult = new Date(0);
  assert.deepEqual(captureVoyageEmergencyResponseCompletedRoundHistory(value).errors, [hostileDiagnostic()]);
});

test("functions BigInts and nonfinite numbers are rejected as hostile data", () => {
  for (const hostileValue of [() => undefined, 1n, Infinity, NaN]) {
    const value = history();
    value.liveRevision = hostileValue;
    assert.deepEqual(captureVoyageEmergencyResponseCompletedRoundHistory(value).errors, [hostileDiagnostic()]);
  }
});

test("reflection-failing proxies fail with the exact hostile envelope", () => {
  const proxyFactories = [
    (value) => new Proxy(value, { getPrototypeOf() { throw new Error("prototype trap"); } }),
    (value) => new Proxy(value, { ownKeys() { throw new Error("ownKeys trap"); } }),
    (value) => new Proxy(value, {
      getOwnPropertyDescriptor() { throw new Error("descriptor trap"); }
    })
  ];
  for (const makeProxy of proxyFactories) {
    const value = history();
    const before = JSON.stringify(value);
    const result = captureVoyageEmergencyResponseCompletedRoundHistory(makeProxy(value));
    assertHostileCapture(result);
    assert.equal(JSON.stringify(value), before);
  }
});

test("arrays with extra enumerable keys fail with the exact hostile envelope", () => {
  const value = history();
  value.rounds.extra = "unexpected";
  const result = captureVoyageEmergencyResponseCompletedRoundHistory(value);
  assertHostileCapture(result);
  assert.equal(value.rounds.extra, "unexpected");
});

test("inherited enumerable schema keys fail with the exact hostile envelope", () => {
  const key = "__m9InheritedEnumerableWitness";
  const original = Object.getOwnPropertyDescriptor(Object.prototype, key);
  Object.defineProperty(Object.prototype, key, {
    configurable: true,
    enumerable: true,
    value: true
  });
  try {
    const value = history();
    const result = captureVoyageEmergencyResponseCompletedRoundHistory(value);
    assertHostileCapture(result);
    assert.equal(Object.hasOwn(value, key), false);
  } finally {
    if (original) Object.defineProperty(Object.prototype, key, original);
    else delete Object.prototype[key];
  }
});

test("Map instances fail with the exact hostile envelope", () => {
  const value = history();
  value.rounds[0].roundResult = new Map([["result", "round-success"]]);
  assertHostileCapture(captureVoyageEmergencyResponseCompletedRoundHistory(value));
});

test("Set instances fail with the exact hostile envelope", () => {
  const value = history();
  value.rounds[0].roundResult = new Set(["round-success"]);
  assertHostileCapture(captureVoyageEmergencyResponseCompletedRoundHistory(value));
});

test("class instances fail with the exact hostile envelope", () => {
  class HostileRoundResult {
    constructor() {
      this.value = "round-success";
    }
  }
  const value = history();
  value.rounds[0].roundResult = new HostileRoundResult();
  assertHostileCapture(captureVoyageEmergencyResponseCompletedRoundHistory(value));
});

test("direct active-ancestor cycles are rejected", () => {
  const value = history();
  value.rounds[0].self = value.rounds[0];
  assert.deepEqual(captureVoyageEmergencyResponseCompletedRoundHistory(value).errors, [hostileDiagnostic()]);
});

test("indirect active-ancestor cycles are rejected", () => {
  const value = history();
  value.rounds[0].link = value.rounds[1];
  value.rounds[1].link = value.rounds[0];
  assert.deepEqual(captureVoyageEmergencyResponseCompletedRoundHistory(value).errors, [hostileDiagnostic()]);
});

test("acyclic shared round references are accepted", () => {
  const value = history();
  const shared = value.rounds[0];
  value.rounds[1] = shared;
  const captured = captureVoyageEmergencyResponseCompletedRoundHistory(value);
  assert.equal(captured.ok, true);
  assert.notEqual(captured.completedRoundHistory.rounds[0], captured.completedRoundHistory.rounds[1]);
  assert.deepEqual(captured.completedRoundHistory.rounds[0], captured.completedRoundHistory.rounds[1]);
});

test("captured occurrences are isolated even when source values are shared", () => {
  const value = history();
  const shared = value.rounds[0].roundResult;
  value.rounds[1].roundResult = shared;
  const captured = assertCaptureIsolated(value);
  assert.equal(captured.rounds[0].roundResult, captured.rounds[1].roundResult);
});

test("returned capture graphs are isolated from later caller mutation", () => {
  const value = history();
  const captured = assertCaptureIsolated(value);
  value.rounds[0].roundResult = "round-failure";
  value.rounds.push({ roundId: "round-4", roundNumber: 4, roundResult: "round-success" });
  assert.equal(captured.rounds.length, 3);
  assert.equal(captured.rounds[0].roundResult, "round-success");
});

test("capture never mutates its input", () => {
  const value = history();
  const before = JSON.stringify(value);
  captureVoyageEmergencyResponseCompletedRoundHistory(value);
  assert.equal(JSON.stringify(value), before);
});

test("valid validation is deterministic across repeated calls", () => {
  const validDefinition = responseDefinition(5);
  const validValue = history(validDefinition);
  assert.deepEqual(
    validateVoyageEmergencyResponseCompletedRoundHistory(validValue, validDefinition),
    validateVoyageEmergencyResponseCompletedRoundHistory(validValue, validDefinition)
  );
  const invalidDefinition = responseDefinition();
  const invalidValue = history(invalidDefinition, { systemId: "arkengine", breakdownDefinitionId: "other" });
  const first = validateVoyageEmergencyResponseCompletedRoundHistory(invalidValue, invalidDefinition);
  const second = validateVoyageEmergencyResponseCompletedRoundHistory(invalidValue, invalidDefinition);
  assert.deepEqual(first, second);
});

test("validation exposes the exact success envelope", () => {
  const result = validateVoyageEmergencyResponseCompletedRoundHistory(history(), responseDefinition());
  assert.deepEqual(Object.keys(result), ["valid", "errors", "warnings"]);
  assert.deepEqual(result, { valid: true, errors: [], warnings: [] });
});

test("capture exposes the exact complete failure envelope", () => {
  const result = captureVoyageEmergencyResponseCompletedRoundHistory({ kind: "invalid" });
  assert.deepEqual(Object.keys(result), ["ok", "completedRoundHistory", "errors", "warnings"]);
  assert.equal(result.ok, false);
  assert.equal(result.completedRoundHistory, null);
  assert.deepEqual(result.errors, [diagnostic("completedRoundHistory")]);
  assert.deepEqual(result.warnings, []);
});

test("malformed response definitions fail safely without throwing", () => {
  const result = validateVoyageEmergencyResponseCompletedRoundHistory(history(), { schemaVersion: 1 });
  assert.deepEqual(result, { valid: false, errors: [diagnostic("emergencyResponseDefinition")], warnings: [] });
});

test("hostile response definitions produce only the safe capture sentinel", () => {
  const definition = responseDefinition();
  definition.rounds[0].roundId = undefined;
  const result = validateVoyageEmergencyResponseCompletedRoundHistory(history(), definition);
  assert.deepEqual(result, { valid: false, errors: [hostileDiagnostic()], warnings: [] });
});

test("definition identity and authored round bindings accumulate in order", () => {
  const definition = responseDefinition(3);
  const value = history(definition, {
    systemId: "arkengine",
    breakdownDefinitionId: "other-breakdown",
    emergencyResponseDefinitionId: "other-response",
    rounds: [
      { roundId: "other-round-1", roundNumber: 1, roundResult: "round-success" },
      { roundId: "other-round-2", roundNumber: 2, roundResult: "round-success" },
      { roundId: "other-round-3", roundNumber: 3, roundResult: "round-success" }
    ]
  });
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, definition).errors, [
    diagnostic("completedRoundHistory.systemId"),
    diagnostic("completedRoundHistory.breakdownDefinitionId"),
    diagnostic("completedRoundHistory.emergencyResponseDefinitionId"),
    diagnostic("completedRoundHistory.rounds[0].roundId"),
    diagnostic("completedRoundHistory.rounds[1].roundId"),
    diagnostic("completedRoundHistory.rounds[2].roundId")
  ]);
});

test("malformed identity short-circuits later binding mismatches", () => {
  const definition = responseDefinition();
  const value = history(definition, { systemId: "", breakdownDefinitionId: "other" });
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, definition).errors, [diagnostic("completedRoundHistory.systemId")]);
});

test("valid later binding mismatches remain after a structurally valid identity", () => {
  const definition = responseDefinition();
  const value = history(definition, { systemId: "arkengine", breakdownDefinitionId: "other" });
  assert.deepEqual(validateVoyageEmergencyResponseCompletedRoundHistory(value, definition).errors, [
    diagnostic("completedRoundHistory.systemId"),
    diagnostic("completedRoundHistory.breakdownDefinitionId")
  ]);
});

test("capture rejects unsafe schema keys", () => {
  const value = history();
  Object.defineProperty(value, "__proto__", { enumerable: true, value: {} });
  assert.deepEqual(captureVoyageEmergencyResponseCompletedRoundHistory(value).errors, [hostileDiagnostic()]);
});

test("capture rejects non-enumerable schema fields", () => {
  const value = history();
  Object.defineProperty(value, "eventId", { enumerable: false, value: "event-1" });
  assert.deepEqual(captureVoyageEmergencyResponseCompletedRoundHistory(value).errors, [hostileDiagnostic()]);
});

test("capture rejects a revoked proxy", () => {
  const value = history();
  const revoked = Proxy.revocable(value, {});
  revoked.revoke();
  assert.deepEqual(captureVoyageEmergencyResponseCompletedRoundHistory(revoked.proxy).errors, [hostileDiagnostic()]);
});

test("no random or wall-clock access is required", () => {
  const originalRandom = Math.random;
  const originalNow = Date.now;
  Math.random = () => { throw new Error("Math.random must not be called"); };
  Date.now = () => { throw new Error("Date.now must not be called"); };
  try {
    const definition = responseDefinition();
    const result = validateVoyageEmergencyResponseCompletedRoundHistory(history(definition), definition);
    assert.equal(result.valid, true);
    const captured = captureVoyageEmergencyResponseCompletedRoundHistory(history(definition));
    assert.equal(captured.ok, true);
  } finally {
    Math.random = originalRandom;
    Date.now = originalNow;
  }
});

test("capture returns no partial rounds on every malformed fixture", () => {
  const malformed = [
    { ...history(), rounds: null },
    { ...history(), rounds: [{ roundId: "round-1", roundNumber: 1 }, ...history().rounds.slice(1)] },
    { ...history(), rounds: [{ roundId: "round-1", roundNumber: 1, roundResult: "round-success", extra: true }, ...history().rounds.slice(1)] },
    { ...history(), eventId: undefined }
  ];
  for (const value of malformed) {
    const result = captureVoyageEmergencyResponseCompletedRoundHistory(value);
    assert.equal(result.ok, false);
    assert.equal(result.completedRoundHistory, null);
  }
});

test("returns the exact stabilized result envelope and proposal", () => {
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest());
  assert.deepEqual(Object.keys(result), [
    "ok",
    "readyForEmergencyResponseOutcome",
    "eventId",
    "sessionId",
    "definitionSnapshotId",
    "shipId",
    "systemId",
    "breakdownDefinitionId",
    "emergencyResponseDefinitionId",
    "emergencyResponseResult",
    "outcomeProposal",
    "requiresGmApproval",
    "errors",
    "warnings"
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.readyForEmergencyResponseOutcome, true);
  assert.equal(result.requiresGmApproval, true);
  assert.deepEqual(Object.keys(result.emergencyResponseResult), RESULT_FIELDS);
  assert.deepEqual(result.emergencyResponseResult, {
    overallResult: "emergency-stabilized",
    roundCount: 3,
    winningThreshold: 2,
    successfulRoundCount: 3,
    failedRoundCount: 0
  });
  assert.deepEqual(Object.keys(result.outcomeProposal), STABILIZED_FIELDS);
  assert.equal(result.outcomeProposal.hazardDisposition, "contained");
  assert.equal(result.outcomeProposal.systemStatus, "disabled");
  assert.equal(result.outcomeProposal.repairApplied, false);
  assert.equal(result.outcomeProposal.scarAdded, false);
  assert.equal(result.outcomeProposal.scarRemoved, false);
  assert.equal(result.outcomeProposal.sourceEventStatus, "ended");
  assert.equal(result.outcomeProposal.requiresGmApproval, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("returns the exact failed result and one authored consequence", () => {
  const definition = breakdownDefinitionForResult({
    responseOverrides: {
      failureConsequences: [{
        consequenceId: "failure-1",
        kind: "loss",
        title: "Loss",
        description: "The response fails.",
        nextSituationId: "next-1"
      }]
    }
  });
  const completedRoundHistory = history(definition.emergencyResponseDefinition, {
    rounds: definition.emergencyResponseDefinition.rounds.map((round) => ({ ...round, roundResult: "round-failure" }))
  });
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition, completedRoundHistory }));
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.emergencyResponseResult), RESULT_FIELDS);
  assert.deepEqual(result.emergencyResponseResult, {
    overallResult: "emergency-failed",
    roundCount: 3,
    winningThreshold: 2,
    successfulRoundCount: 0,
    failedRoundCount: 3
  });
  assert.deepEqual(Object.keys(result.outcomeProposal), FAILED_FIELDS);
  assert.equal(result.outcomeProposal.kind, "m9-emergency-response-failed");
  assert.equal(result.outcomeProposal.consequence.kind, "loss");
  assert.equal(result.outcomeProposal.retryAllowed, false);
  assert.equal(result.outcomeProposal.systemStatus, "disabled");
  assert.equal(result.outcomeProposal.sourceEventStatus, "ended");
  assert.equal(result.outcomeProposal.requiresGmApproval, true);
});

test("rejects a resolved Hazard instead of fabricating contained resolution", () => {
  const definition = breakdownDefinitionForResult({ hazardOverrides: { status: "resolved" } });
  assertTask4Failure(analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition })), [
    task4Diagnostic(
      "m9-invalid-catastrophic-hazard",
      "breakdownDefinition.catastrophicHazard",
      "Catastrophic Hazard is not a valid M6 Hazard with the required M9 restrictions."
    )
  ]);
});

test("applies the locked odd-round threshold at every supported boundary", () => {
  for (const roundCount of COUNTS) {
    const definition = breakdownDefinitionForResult({
      responseOverrides: {
        roundCount,
        rounds: Array.from({ length: roundCount }, (_, index) => ({ roundId: `round-${index + 1}`, roundNumber: index + 1 }))
      }
    });
    const threshold = (roundCount + 1) / 2;
    const completedRoundHistory = history(definition.emergencyResponseDefinition, {
      rounds: definition.emergencyResponseDefinition.rounds.map((round, index) => ({
        ...round,
        roundResult: index < threshold ? "round-success" : "round-failure"
      }))
    });
    const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition, completedRoundHistory }));
    assert.equal(result.ok, true);
    assert.equal(result.emergencyResponseResult.roundCount, roundCount);
    assert.equal(result.emergencyResponseResult.winningThreshold, threshold);
    assert.equal(result.emergencyResponseResult.successfulRoundCount, threshold);
    assert.equal(result.emergencyResponseResult.overallResult, "emergency-stabilized");

    const belowThresholdHistory = history(definition.emergencyResponseDefinition, {
      rounds: definition.emergencyResponseDefinition.rounds.map((round, index) => ({
        ...round,
        roundResult: index < threshold - 1 ? "round-success" : "round-failure"
      }))
    });
    const belowThreshold = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
      definition,
      completedRoundHistory: belowThresholdHistory
    }));
    assert.equal(belowThreshold.ok, true);
    assert.equal(belowThreshold.emergencyResponseResult.roundCount, roundCount);
    assert.equal(belowThreshold.emergencyResponseResult.winningThreshold, threshold);
    assert.equal(belowThreshold.emergencyResponseResult.successfulRoundCount, threshold - 1);
    assert.equal(belowThreshold.emergencyResponseResult.failedRoundCount, roundCount - threshold + 1);
    assert.equal(belowThreshold.emergencyResponseResult.overallResult, "emergency-failed");
  }
});

test("counts critical success and failure as one round each", () => {
  const definition = breakdownDefinitionForResult();
  const completedRoundHistory = history(definition.emergencyResponseDefinition, {
    rounds: [
      { roundId: "round-1", roundNumber: 1, roundResult: "critical-round-success" },
      { roundId: "round-2", roundNumber: 2, roundResult: "critical-round-failure" },
      { roundId: "round-3", roundNumber: 3, roundResult: "round-success" }
    ]
  });
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition, completedRoundHistory }));
  assert.equal(result.ok, true);
  assert.equal(result.emergencyResponseResult.successfulRoundCount, 2);
  assert.equal(result.emergencyResponseResult.failedRoundCount, 1);
  assert.equal(result.emergencyResponseResult.overallResult, "emergency-stabilized");
});

test("accepts every closed-enum authored failure consequence kind", () => {
  for (const kind of ["strand", "diversion", "disablement", "loss"]) {
    const definition = breakdownDefinitionForResult({
      responseOverrides: {
        failureConsequences: [{
          consequenceId: `failure-${kind}`,
          kind,
          title: "Failure",
          description: "The response fails.",
          nextSituationId: "next-1"
        }]
      }
    });
    const completedRoundHistory = history(definition.emergencyResponseDefinition, {
      rounds: definition.emergencyResponseDefinition.rounds.map((round) => ({ ...round, roundResult: "round-failure" }))
    });
    const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition, completedRoundHistory }));
    assert.equal(result.ok, true);
    assert.equal(result.outcomeProposal.consequence.kind, kind);
    assert.deepEqual(Object.keys(result.outcomeProposal.consequence), [
      "consequenceId",
      "kind",
      "title",
      "description",
      "nextSituationId"
    ]);
  }
});

test("rejects missing, extra, reordered, and wrong-type authored consequence fields", () => {
  const fields = ["consequenceId", "kind", "title", "description", "nextSituationId"];
  const definitionError = [
    task4Diagnostic(
      "m9-invalid-emergency-response-definition",
      "breakdownDefinition.emergencyResponseDefinition",
      "Emergency Response Definition is invalid."
    )
  ];
  for (const field of fields) {
    const missing = breakdownDefinitionForResult();
    delete missing.emergencyResponseDefinition.failureConsequences[0][field];
    assertTask4Failure(analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition: missing })), definitionError);

    const extra = breakdownDefinitionForResult();
    extra.emergencyResponseDefinition.failureConsequences[0].extra = true;
    assertTask4Failure(analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition: extra })), definitionError);

    const reordered = breakdownDefinitionForResult();
    const consequence = reordered.emergencyResponseDefinition.failureConsequences[0];
    const reorderedFields = [field, ...fields.filter((candidate) => candidate !== field)];
    if (reorderedFields.every((candidate, index) => candidate === fields[index])) {
      reorderedFields.push(reorderedFields.shift());
    }
    reordered.emergencyResponseDefinition.failureConsequences[0] = Object.fromEntries(
      reorderedFields.map((candidate) => [candidate, consequence[candidate]])
    );
    assertTask4Failure(analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition: reordered })), definitionError);

    const wrongType = breakdownDefinitionForResult();
    wrongType.emergencyResponseDefinition.failureConsequences[0][field] = 7;
    assertTask4Failure(analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition: wrongType })), definitionError);
  }
});

test("rejects unknown, padded, case-variant, and non-string consequence kinds", () => {
  for (const kind of ["unknown", " loss", "LOSS", 1, null]) {
    const definition = breakdownDefinitionForResult({ responseOverrides: {
      failureConsequences: [{
        consequenceId: "failure-1",
        kind,
        title: "Failure",
        description: "The response fails.",
        nextSituationId: "next-1"
      }]
    } });
    assertTask4Failure(analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition })), [
      task4Diagnostic("m9-invalid-emergency-response-definition", "breakdownDefinition.emergencyResponseDefinition", "Emergency Response Definition is invalid.")
    ]);
  }
});

test("rejects every prohibited caller-authority key before later validation", () => {
  const keys = [
    "approved", "gmApproved", "approval", "gmApproval", "applicationPlan", "nextState",
    "emergencyResponseResult", "outcomeProposal", "persistentChanges", "shipUpdate",
    "hazardApplied", "systemDisabled", "scarCreated", "revisionAfter", "requestId",
    "staleStatus", "duplicateStatus", "capacityAnalysis", "applicationToken"
  ];
  const values = [
    () => null,
    () => false,
    () => 0,
    () => "",
    () => [],
    () => ({})
  ];
  for (const key of keys) {
    for (const makeValue of values) {
      const request = emergencyResponseRequest({ extras: { [key]: makeValue() } });
      assertTask4Failure(analyzeVoyageEmergencyResponseResult(request), [
        task4Diagnostic("m9-caller-authored-application-rejected", `request.${key}`, "Caller-authored application or runtime authority is not accepted.")
      ]);
    }
  }
});

test("accumulates multiple prohibited keys in captured insertion order", () => {
  const request = emergencyResponseRequest({ extras: { outcomeProposal: null, approved: false, applicationToken: "token" } });
  assertTask4Failure(analyzeVoyageEmergencyResponseResult(request), [
    task4Diagnostic("m9-caller-authored-application-rejected", "request.outcomeProposal", "Caller-authored application or runtime authority is not accepted."),
    task4Diagnostic("m9-caller-authored-application-rejected", "request.approved", "Caller-authored application or runtime authority is not accepted."),
    task4Diagnostic("m9-caller-authored-application-rejected", "request.applicationToken", "Caller-authored application or runtime authority is not accepted.")
  ]);
});

test("returns the complete failure envelope for mode and exact-shape failures", () => {
  const invalidMode = emergencyResponseRequest({ kind: "m9-catastrophic-breakdown" });
  assertTask4Failure(analyzeVoyageEmergencyResponseResult(invalidMode), [
    task4Diagnostic("m9-invalid-mode", "request.kind", "Only the requested Milestone 9 analysis mode is supported.")
  ]);
  const canonical = emergencyResponseRequest();
  const reordered = {
    completedRoundHistory: canonical.completedRoundHistory,
    breakdownPlan: canonical.breakdownPlan,
    sessionId: canonical.sessionId,
    kind: canonical.kind,
    breakdownDefinition: canonical.breakdownDefinition
  };
  assertTask4Failure(analyzeVoyageEmergencyResponseResult(reordered), [
    task4Diagnostic("m9-invalid-request-shape", "request", "Request has an invalid exact shape or field values.")
  ]);
});

test("rejects hostile request values without partial result or plan", () => {
  const fixtures = [
    () => ({ ...emergencyResponseRequest(), completedRoundHistory: undefined }),
    () => ({ ...emergencyResponseRequest(), breakdownPlan: new Map() }),
    () => {
      const value = emergencyResponseRequest();
      value.breakdownDefinition[Symbol("hostile")] = true;
      return value;
    },
    () => {
      const value = emergencyResponseRequest();
      value.breakdownPlan.capacityExhaustion = value.breakdownPlan;
      return value;
    }
  ];
  for (const create of fixtures) assertTask4Failure(analyzeVoyageEmergencyResponseResult(create()), [hostileDiagnostic()]);
});

test("accumulates every valid Emergency Response category-9 mismatch in order", () => {
  const definition = breakdownDefinitionForResult();
  const capacity = capacityForResult({
    eventId: "handoff-event",
    sessionId: "handoff-session",
    definitionSnapshotId: "handoff-snapshot",
    shipId: "handoff-ship",
    systemId: "arkengine",
    liveRevision: 8
  });
  const completedRoundHistory = history(definition.emergencyResponseDefinition, {
    eventId: "history-event",
    sessionId: "history-session",
    definitionSnapshotId: "history-snapshot",
    shipId: "history-ship",
    liveRevision: 9
  });
  const plan = breakdownPlanForResult(definition, capacity);
  plan.pausePlan = { ...plan.pausePlan, timing: "immediate" };
  const request = emergencyResponseRequest({
    definition,
    capacity,
    plan,
    completedRoundHistory
  });
  assertTask4Failure(analyzeVoyageEmergencyResponseResult(request), [
    task4Diagnostic("m9-event-identity-mismatch", "breakdownPlan.capacityExhaustion.eventId", "Event identity does not match the M10 handoff."),
    task4Diagnostic("m9-session-identity-mismatch", "breakdownPlan.capacityExhaustion.sessionId", "Session identity does not match the M10 handoff or request."),
    task4Diagnostic("m9-definition-snapshot-mismatch", "breakdownPlan.capacityExhaustion.definitionSnapshotId", "Definition snapshot identity does not match the M10 handoff."),
    task4Diagnostic("m9-ship-identity-mismatch", "breakdownPlan.capacityExhaustion.shipId", "Ship identity does not match the M10 handoff."),
    task4Diagnostic("m9-system-identity-mismatch", "breakdownPlan.capacityExhaustion.systemId", "Affected system identity does not match the M10 handoff."),
    task4Diagnostic("m9-revision-binding-mismatch", "breakdownPlan.capacityExhaustion.liveRevision", "Live revision binding does not match the M10 handoff.")
  ]);
});

test("binds the captured Hazard encounter identity to the capacity handoff", () => {
  const definition = breakdownDefinitionForResult({ hazardOverrides: { encounterId: "definition-event" } });
  const capacity = capacityForResult({ eventId: "handoff-event" });
  const completedRoundHistory = history(definition.emergencyResponseDefinition, { eventId: "handoff-event" });
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
    definition,
    capacity,
    plan: breakdownPlanForResult(definition, capacity),
    completedRoundHistory
  }));
  assertTask4Failure(result, [
    task4Diagnostic("m9-event-identity-mismatch", "breakdownPlan.capacityExhaustion.eventId", "Event identity does not match the M10 handoff.")
  ]);
});

test("binds the captured Definition and Hazard system identity to the capacity handoff", () => {
  const definition = breakdownDefinitionForResult();
  const capacity = capacityForResult({ systemId: "arkengine" });
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
    definition,
    capacity,
    plan: breakdownPlanForResult(definition, capacity),
    completedRoundHistory: history(definition.emergencyResponseDefinition)
  }));
  assertTask4Failure(result, [
    task4Diagnostic("m9-system-identity-mismatch", "breakdownPlan.capacityExhaustion.systemId", "Affected system identity does not match the M10 handoff.")
  ]);
});

test("accumulates Definition/Hazard-to-handoff event and system mismatches before an invalid plan", () => {
  const definition = breakdownDefinitionForResult({ hazardOverrides: { encounterId: "definition-event" } });
  const capacity = capacityForResult({ eventId: "handoff-event", systemId: "arkengine" });
  const plan = breakdownPlanForResult(definition, capacity);
  plan.pausePlan = { ...plan.pausePlan, timing: "immediate" };
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
    definition,
    capacity,
    plan,
    completedRoundHistory: history(definition.emergencyResponseDefinition, { eventId: "history-event" })
  }));
  assertTask4Failure(result, [
    task4Diagnostic("m9-event-identity-mismatch", "breakdownPlan.capacityExhaustion.eventId", "Event identity does not match the M10 handoff."),
    task4Diagnostic("m9-system-identity-mismatch", "breakdownPlan.capacityExhaustion.systemId", "Affected system identity does not match the M10 handoff.")
  ]);
});

test("accepts matching Definition, Hazard, and capacity-handoff identities", () => {
  const definition = breakdownDefinitionForResult({
    systemId: "arkengine",
    hazardOverrides: { encounterId: "handoff-event" }
  });
  const capacity = capacityForResult({ eventId: "handoff-event", systemId: "arkengine" });
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
    definition,
    capacity,
    plan: breakdownPlanForResult(definition, capacity),
    completedRoundHistory: history(definition.emergencyResponseDefinition, { eventId: "handoff-event" })
  }));
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test("reports each single category-9 mismatch at its canonical plan path", () => {
  const fields = [
    ["eventId", "history-event", "m9-event-identity-mismatch", "breakdownPlan.capacityExhaustion.eventId", "Event identity does not match the M10 handoff."],
    ["sessionId", "history-session", "m9-session-identity-mismatch", "breakdownPlan.capacityExhaustion.sessionId", "Session identity does not match the M10 handoff or request."],
    ["definitionSnapshotId", "history-snapshot", "m9-definition-snapshot-mismatch", "breakdownPlan.capacityExhaustion.definitionSnapshotId", "Definition snapshot identity does not match the M10 handoff."],
    ["shipId", "history-ship", "m9-ship-identity-mismatch", "breakdownPlan.capacityExhaustion.shipId", "Ship identity does not match the M10 handoff."],
    ["systemId", "arkengine", "m9-system-identity-mismatch", "breakdownPlan.capacityExhaustion.systemId", "Affected system identity does not match the M10 handoff."],
    ["liveRevision", 8, "m9-revision-binding-mismatch", "breakdownPlan.capacityExhaustion.liveRevision", "Live revision binding does not match the M10 handoff."]
  ];
  for (const [field, mismatch, code, path, message] of fields) {
    const definition = breakdownDefinitionForResult();
    const capacity = capacityForResult({ [field]: mismatch });
    const completedRoundHistory = history(definition.emergencyResponseDefinition);
    const request = emergencyResponseRequest({
      definition,
      capacity,
      plan: breakdownPlanForResult(definition, capacity),
      completedRoundHistory
    });
    assertTask4Failure(analyzeVoyageEmergencyResponseResult(request), [task4Diagnostic(code, path, message)]);
  }
});

test("checks the supplied response-definition identity before capacity diagnostics", () => {
  const definition = breakdownDefinitionForResult();
  const capacity = capacityForResult({ occupiedScarCount: 1 });
  const plan = breakdownPlanForResult(definition, capacity);
  plan.emergencyResponseDefinitionId = "wrong-response";
  assertTask4Failure(analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
    definition,
    capacity,
    plan
  })), [
    task4Diagnostic("m9-invalid-breakdown-plan", "breakdownPlan", "Breakdown plan does not match the captured definition and handoff.")
  ]);
});

test("identity mismatch takes precedence over capacity arithmetic", () => {
  const definition = breakdownDefinitionForResult();
  const capacity = capacityForResult({ eventId: "handoff-event", occupiedScarCount: 1 });
  assertTask4Failure(analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
    definition,
    capacity,
    plan: breakdownPlanForResult(definition, capacity)
  })), [
    task4Diagnostic("m9-event-identity-mismatch", "breakdownPlan.capacityExhaustion.eventId", "Event identity does not match the M10 handoff.")
  ]);
});

test("malformed history identity suppresses later category-9 mismatches", () => {
  const definition = breakdownDefinitionForResult();
  const completedRoundHistory = history(definition.emergencyResponseDefinition, {
    definitionSnapshotId: "",
    shipId: "other-ship",
    eventId: "other-event"
  });
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition, completedRoundHistory }));
  assertTask4Failure(result, [diagnostic("completedRoundHistory.definitionSnapshotId")]);
});

test("valid event, session, and system evidence does not invent snapshot, ship, or revision authority", () => {
  const definition = breakdownDefinitionForResult();
  const capacity = capacityForResult({ definitionSnapshotId: "m10-snapshot", shipId: "m10-ship", liveRevision: 99 });
  const completedRoundHistory = history(definition.emergencyResponseDefinition, {
    definitionSnapshotId: "m10-snapshot",
    shipId: "m10-ship",
    liveRevision: 99
  });
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
    definition,
    capacity,
    plan: breakdownPlanForResult(definition, capacity),
    completedRoundHistory
  }));
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test("reports capacity arithmetic and applicability in fixed order", () => {
  const capacity = capacityForResult({ occupiedScarCount: 1, incomingScarProposalStatus: "approved" });
  const definition = breakdownDefinitionForResult();
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
    definition,
    capacity,
    plan: breakdownPlanForResult(definition, capacity)
  }));
  assertTask4Failure(result, [
    task4Diagnostic("m9-capacity-not-exhausted", "capacityExhaustion.occupiedScarCount", "Capacity exhaustion is not established."),
    task4Diagnostic("m9-invalid-incoming-scar-proposal", "capacityExhaustion.incomingScarProposalId", "Incoming ordinary Scar proposal evidence is invalid.")
  ]);

  const notApplicable = capacityForResult({ incomingScarProposalKind: "catastrophic-void-scar" });
  const notApplicableResult = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
    capacity: notApplicable,
    plan: breakdownPlanForResult(definition, notApplicable)
  }));
  assertTask4Failure(notApplicableResult, [
    task4Diagnostic("m9-breakdown-not-applicable", "capacityExhaustion", "Catastrophic Breakdown is not applicable to this handoff.")
  ]);
});

test("rejects malformed capacity handoff fields at category 8", () => {
  for (const [field, value] of [
    ["kind", "wrong-kind"],
    ["eventId", ""],
    ["sessionId", " "],
    ["definitionSnapshotId", ""],
    ["shipId", ""],
    ["systemId", "not-a-system"],
    ["systemKind", "ship"],
    ["liveRevision", -1],
    ["scarCapacity", -1],
    ["occupiedScarCount", -1],
    ["incomingScarProposalId", ""],
    ["incomingScarProposalKind", ""],
    ["incomingScarProposalStatus", ""]
  ]) {
    const capacity = capacityForResult({ [field]: value });
    const definition = breakdownDefinitionForResult();
    const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
      definition,
      capacity,
      plan: breakdownPlanForResult(definition, capacity)
    }));
    assertTask4Failure(result, [task4Diagnostic("m9-invalid-capacity-exhaustion", "breakdownPlan.capacityExhaustion", "Capacity-exhaustion handoff is invalid.")]);
  }
});

test("rejects reordered, omitted, extra, and edited supplied plans", () => {
  const definition = breakdownDefinitionForResult();
  const canonical = breakdownPlanForResult(definition);
  const reverseKeys = (value) => Object.fromEntries(Object.entries(value).reverse());
  const reordered = {
    capacityExhaustion: canonical.capacityExhaustion,
    scarApplication: canonical.scarApplication,
    emergencyResponseDefinitionId: canonical.emergencyResponseDefinitionId,
    pausePlan: canonical.pausePlan,
    catastrophicHazard: canonical.catastrophicHazard,
    systemDisablement: canonical.systemDisablement
  };
  const fixtures = [
    reordered,
    (() => {
      const { scarApplication, ...withoutScarApplication } = canonical;
      return withoutScarApplication;
    })(),
    { ...canonical, extra: true },
    { ...canonical, systemDisablement: reverseKeys(canonical.systemDisablement) },
    { ...canonical, systemDisablement: { systemId: canonical.systemDisablement.systemId, disabled: true } },
    { ...canonical, systemDisablement: { ...canonical.systemDisablement, extra: true } },
    { ...canonical, systemDisablement: { ...canonical.systemDisablement, disabled: false } },
    { ...canonical, systemDisablement: { ...canonical.systemDisablement, systemId: "arkengine" } },
    { ...canonical, catastrophicHazard: reverseKeys(canonical.catastrophicHazard) },
    (() => {
      const catastrophicHazard = { ...canonical.catastrophicHazard };
      delete catastrophicHazard.metadata;
      return { ...canonical, catastrophicHazard };
    })(),
    { ...canonical, catastrophicHazard: { ...canonical.catastrophicHazard, extra: true } },
    { ...canonical, catastrophicHazard: { ...canonical.catastrophicHazard, hazardId: "other-hazard" } },
    { ...canonical, pausePlan: reverseKeys(canonical.pausePlan) },
    (() => {
      const pausePlan = { ...canonical.pausePlan };
      delete pausePlan.resumeCondition;
      return { ...canonical, pausePlan };
    })(),
    { ...canonical, pausePlan: { ...canonical.pausePlan, extra: true } },
    { ...canonical, pausePlan: { ...canonical.pausePlan, timing: "immediate" } },
    { ...canonical, emergencyResponseDefinitionId: "wrong-response" }
  ];
  for (const plan of fixtures) {
    const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition, plan }));
    assertTask4Failure(result, [task4Diagnostic("m9-invalid-breakdown-plan", "breakdownPlan", "Breakdown plan does not match the captured definition and handoff.")]);
  }
});

test("rejects malformed nested capacity exhaustion before supplied-plan equality", () => {
  const definition = breakdownDefinitionForResult();
  const canonical = breakdownPlanForResult(definition);
  const reversedCapacity = Object.fromEntries(Object.entries(canonical.capacityExhaustion).reverse());
  const omittedCapacity = { ...canonical.capacityExhaustion };
  delete omittedCapacity.liveRevision;
  const extraCapacity = { ...canonical.capacityExhaustion, extra: true };
  for (const capacityExhaustion of [reversedCapacity, omittedCapacity, extraCapacity]) {
    const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({
      definition,
      plan: { ...canonical, capacityExhaustion }
    }));
    assertTask4Failure(result, [
      task4Diagnostic("m9-invalid-capacity-exhaustion", "breakdownPlan.capacityExhaustion", "Capacity-exhaustion handoff is invalid.")
    ]);
  }
});

test("accepts fresh structurally equal plans and isolates supplied shared occurrences", () => {
  const definition = breakdownDefinitionForResult();
  const canonical = breakdownPlanForResult(definition);
  const plan = structuredClone(canonical);
  const request = emergencyResponseRequest({ definition, plan });
  const before = JSON.stringify(request);
  const result = analyzeVoyageEmergencyResponseResult(request);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(request), before);
  request.breakdownPlan.catastrophicHazard.name = "mutated";
  request.completedRoundHistory.rounds[0].roundResult = "round-failure";
  assert.equal(result.outcomeProposal.hazardDisposition, "contained");
  assert.equal(result.emergencyResponseResult.successfulRoundCount, 3);
});

test("accepts acyclic shared plan references while isolating every captured occurrence", () => {
  const definition = breakdownDefinitionForResult();
  const plan = breakdownPlanForResult(definition);
  const sharedDescriptor = { consequenceId: "descriptive-consequence" };
  plan.catastrophicHazard.currentEffect = sharedDescriptor;
  plan.catastrophicHazard.ignoredConsequence = sharedDescriptor;
  plan.catastrophicHazard.metadata = { collision: { consequence: sharedDescriptor } };
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ definition, plan }));
  assert.equal(result.ok, true);
  sharedDescriptor.consequenceId = "mutated";
  assert.equal(result.outcomeProposal.catastrophicHazardId, "catastrophic-hazard-1");
});

test("rejects direct and indirect active-ancestor supplied-plan cycles", () => {
  const direct = emergencyResponseRequest();
  direct.breakdownPlan.pausePlan.cycle = direct.breakdownPlan;
  assertTask4Failure(analyzeVoyageEmergencyResponseResult(direct), [hostileDiagnostic()]);

  const indirect = emergencyResponseRequest();
  indirect.breakdownPlan.pausePlan.link = indirect.breakdownPlan.systemDisablement;
  indirect.breakdownPlan.systemDisablement.link = indirect.breakdownPlan.pausePlan;
  assertTask4Failure(analyzeVoyageEmergencyResponseResult(indirect), [hostileDiagnostic()]);
});

test("preserves disabled containment and never emits repair, Scar, reward, or resume authority", () => {
  const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest());
  assert.equal(result.ok, true);
  assert.equal(result.outcomeProposal.systemStatus, "disabled");
  assert.equal(result.outcomeProposal.hazardDisposition, "contained");
  assert.equal(result.outcomeProposal.repairApplied, false);
  assert.equal(result.outcomeProposal.scarAdded, false);
  assert.equal(result.outcomeProposal.scarRemoved, false);
  assert.equal(Object.hasOwn(result.outcomeProposal, "resume"), false);
  assert.equal(Object.hasOwn(result.outcomeProposal, "reward"), false);
  assert.equal(Object.hasOwn(result.outcomeProposal, "misfortune"), false);
});

test("rejects scalar and container authority values before request-shape errors", () => {
  for (const authorityValue of [null, false, 0, "token", []]) {
    const result = analyzeVoyageEmergencyResponseResult(emergencyResponseRequest({ extras: { approval: authorityValue } }));
    assertTask4Failure(result, [
      task4Diagnostic("m9-caller-authored-application-rejected", "request.approval", "Caller-authored application or runtime authority is not accepted.")
    ]);
  }
});

test("uses no random or wall-clock access and is deterministic", () => {
  const originalRandom = Math.random;
  const originalNow = Date.now;
  Math.random = () => { throw new Error("Math.random must not be called"); };
  Date.now = () => { throw new Error("Date.now must not be called"); };
  try {
    const request = emergencyResponseRequest();
    const first = analyzeVoyageEmergencyResponseResult(request);
    const second = analyzeVoyageEmergencyResponseResult(request);
    assert.deepEqual(first, second);
    assert.equal(first.ok, true);
  } finally {
    Math.random = originalRandom;
    Date.now = originalNow;
  }
});
