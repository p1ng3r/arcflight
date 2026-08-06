import assert from "node:assert/strict";
import { test } from "node:test";
import { VOYAGE_ROUND_RESULTS } from "../../../scripts/voyage/domain/constants.js";
import {
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

test("exports only the two authorized Task 3 APIs", async () => {
  const module = await import("../../../scripts/voyage/domain/emergency-response.js");
  assert.deepEqual(Object.keys(module).sort(), [
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
