import assert from "node:assert/strict";
import test from "node:test";

import {
  VOYAGE_HAZARD_CATEGORIES,
  VOYAGE_HAZARD_COLLISION_POLICIES,
  VOYAGE_HAZARD_DURATION_MODES,
  VOYAGE_HAZARD_ESCALATION_MODES,
  VOYAGE_HAZARD_EVENT_TYPES,
  VOYAGE_HAZARD_STATUSES,
  VOYAGE_HAZARD_TIMING_KINDS,
  VOYAGE_HAZARD_VISIBILITY,
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "../../../scripts/voyage/domain/constants.js";
import {
  captureVoyageHazardRecord,
  validateVoyageHazardRecord,
  VOYAGE_HAZARD_PROVENANCE_FIELDS,
  VOYAGE_HAZARD_RECORD_FIELDS
} from "../../../scripts/voyage/domain/hazard-schema.js";

const SYSTEM_ID = VOYAGE_PRESSURE_SYSTEM_IDS[0];
const EVENT_AREA_ID = "event-area-engine-room";
const TIMING_KINDS = Object.values(VOYAGE_HAZARD_TIMING_KINDS);

function timing(kind = VOYAGE_HAZARD_TIMING_KINDS.IMMEDIATE) {
  return { kind, stationId: null, resultId: null };
}

function validRecord(overrides = {}) {
  return {
    hazardId: "hazard-1",
    encounterId: "encounter-1",
    category: VOYAGE_HAZARD_CATEGORIES.SYSTEM,
    status: VOYAGE_HAZARD_STATUSES.ACTIVE,
    name: "Arc instability",
    currentEffect: { effectId: "effect-current", description: "The arc shakes." },
    activationTiming: timing(),
    removalMethod: { methodId: "address-hazard" },
    ignoredConsequence: { consequenceId: "ignored-consequence" },
    visibility: VOYAGE_HAZARD_VISIBILITY.PUBLIC,
    sourceKind: "pressure-breach",
    createdStageId: "stage-1",
    createdRoundNumber: 1,
    createdSequence: 0,
    escalation: {
      mode: VOYAGE_HAZARD_ESCALATION_MODES.NONE,
      currentStageId: null,
      stages: [],
      countdown: null,
      maximumEscalationReached: false,
      escalationConsequence: null
    },
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    duration: {
      mode: VOYAGE_HAZARD_DURATION_MODES.NONE,
      remaining: null,
      initial: null,
      decrementTiming: null
    },
    failurePressureSystemId: SYSTEM_ID,
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { hazardId: "replacement-hazard" } },
    pressureSystemId: SYSTEM_ID,
    eventAreaId: null,
    pressureBreachId: "breach-1",
    stationId: "engineer",
    actionId: "action-1",
    pressureEffectId: "pressure-effect-1",
    sourceIntentId: "intent-1",
    activationSource: "pressure-breach",
    branch: "failure",
    sourceTiming: "consequences",
    sourceVisibility: "public",
    ...overrides
  };
}

function result(record, options = {}) {
  return validateVoyageHazardRecord(record, options);
}

function assertInvalid(record, code, options = {}) {
  const validation = result(record, options);
  assert.equal(validation.valid, false);
  if (code) assert.ok(validation.errors.some((error) => error.code === code), JSON.stringify(validation.errors));
  return validation;
}

function assertIssue(record, code, path, options = {}) {
  const validation = assertInvalid(record, undefined, options);
  assert.ok(validation.errors.some((error) => error.code === code && error.path === path), JSON.stringify(validation.errors));
  return validation;
}

test("exports the canonical Hazard constants and exact record field lists", () => {
  assert.deepEqual(Object.values(VOYAGE_HAZARD_CATEGORIES), ["system", "event"]);
  assert.deepEqual(Object.values(VOYAGE_HAZARD_STATUSES), ["active", "resolved", "expired", "replaced"]);
  assert.deepEqual(Object.values(VOYAGE_HAZARD_VISIBILITY), ["public", "gm-secret"]);
  assert.deepEqual(TIMING_KINDS, [
    "immediate",
    "before-next-station",
    "start-of-next-round",
    "end-of-round",
    "named-station-activation",
    "specified-result",
    "event-closeout"
  ]);
  assert.deepEqual(Object.values(VOYAGE_HAZARD_EVENT_TYPES), [
    "voyage.hazard-created",
    "voyage.hazard-escalated",
    "voyage.hazard-replaced",
    "voyage.hazard-consequence-triggered",
    "voyage.hazard-duration-extended",
    "voyage.hazard-resolved",
    "voyage.hazard-expired",
    "voyage.hazard-closeout-consequence-applied"
  ]);
  assert.deepEqual(VOYAGE_HAZARD_PROVENANCE_FIELDS, [
    "pressureBreachId",
    "stationId",
    "actionId",
    "pressureEffectId",
    "sourceIntentId",
    "activationSource",
    "branch",
    "sourceTiming",
    "sourceVisibility"
  ]);
  assert.equal(Object.isFrozen(VOYAGE_HAZARD_RECORD_FIELDS), true);
  assert.equal(Object.isFrozen(VOYAGE_HAZARD_PROVENANCE_FIELDS), true);
});

test("accepts a complete active system Hazard with the canonical result shape", () => {
  const validation = result(validRecord());
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.deepEqual(Object.keys(validation), ["valid", "errors", "warnings"]);
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.warnings, []);
});

test("accepts event Hazards and enforces their category-specific locations", () => {
  const event = validRecord({
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    failurePressureSystemId: null,
    pressureSystemId: null,
    eventAreaId: EVENT_AREA_ID
  });
  assert.equal(result(event).valid, true);
  assert.equal(result({
    ...event,
    failurePressureSystemId: SYSTEM_ID
  }).valid, true);
  assertInvalid(validRecord({ category: "unknown" }), "invalid-hazard-category");
  assertInvalid(validRecord({ pressureSystemId: null }), "invalid-hazard-pressure-system");
  assertInvalid(validRecord({ eventAreaId: EVENT_AREA_ID }), "invalid-hazard-event-area");
  assertInvalid(validRecord({ failurePressureSystemId: "not-canonical" }), "invalid-hazard-failure-pressure-system");
  assertInvalid(validRecord({
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    failurePressureSystemId: null,
    pressureSystemId: null,
    eventAreaId: ""
  }), "invalid-hazard-event-area");
});

test("requires every persisted field and rejects unknown fields", () => {
  const missing = validRecord();
  delete missing.metadata;
  assertInvalid(missing, "missing-hazard-field");

  const unknown = validRecord({ futureField: true });
  assertInvalid(unknown, "unexpected-hazard-field");
});

test("active validation rejects terminal records while snapshot mode accepts isolated terminal states", () => {
  for (const status of [VOYAGE_HAZARD_STATUSES.RESOLVED, VOYAGE_HAZARD_STATUSES.EXPIRED]) {
    const terminal = validRecord({
      status,
      resolvedStageId: "stage-2",
      resolvedRoundNumber: 2,
      terminalReason: status
    });
    assertInvalid(terminal, "invalid-hazard-active-status");
    assert.equal(result(terminal, { mode: "snapshot" }).valid, true);
  }

  const replaced = validRecord({
    status: VOYAGE_HAZARD_STATUSES.REPLACED,
    resolvedStageId: "stage-2",
    resolvedRoundNumber: 2,
    terminalReason: "replaced",
    replacedByHazardId: "hazard-2"
  });
  assertInvalid(replaced, "invalid-hazard-active-status");
  assert.equal(result(replaced, { mode: "snapshot" }).valid, true);

  assertInvalid(validRecord({ status: "retained" }), "invalid-hazard-status");
  assertInvalid(validRecord({ terminalReason: "should-not-be-active" }), "invalid-hazard-terminal-field");
  assertInvalid(validRecord({ status: VOYAGE_HAZARD_STATUSES.REPLACED }), "invalid-hazard-replaced-by", { mode: "snapshot" });
});

test("requires exact discriminated HazardTiming identifiers", () => {
  for (const kind of TIMING_KINDS) {
    const activationTiming = kind === VOYAGE_HAZARD_TIMING_KINDS.NAMED_STATION_ACTIVATION
      ? { kind, stationId: "navigator", resultId: null }
      : kind === VOYAGE_HAZARD_TIMING_KINDS.SPECIFIED_RESULT
        ? { kind, stationId: null, resultId: "result-success" }
        : timing(kind);
    assert.equal(result(validRecord({ activationTiming })).valid, true);
  }
  assert.equal(result(validRecord({
    activationTiming: { kind: VOYAGE_HAZARD_TIMING_KINDS.NAMED_STATION_ACTIVATION, stationId: "navigator", resultId: null }
  })).valid, true);
  assert.equal(result(validRecord({
    activationTiming: { kind: VOYAGE_HAZARD_TIMING_KINDS.SPECIFIED_RESULT, stationId: null, resultId: "result-success" }
  })).valid, true);
  assertInvalid(validRecord({ activationTiming: { kind: "immediate", stationId: "captain", resultId: null } }), "invalid-hazard-timing-station-id");
  assertInvalid(validRecord({ activationTiming: { kind: "immediate", stationId: null, resultId: "result" } }), "invalid-hazard-timing-result-id");
  assertInvalid(validRecord({ activationTiming: { kind: "immediate", stationId: null, resultId: null, extra: true } }), "unexpected-hazard-timing-field");
});

test("enforces normalized duration modes and timing", () => {
  for (const mode of [VOYAGE_HAZARD_DURATION_MODES.ROUNDS, VOYAGE_HAZARD_DURATION_MODES.ACTIVATIONS]) {
    const duration = { mode, remaining: 1, initial: 2, decrementTiming: timing(VOYAGE_HAZARD_TIMING_KINDS.END_OF_ROUND) };
    assert.equal(result(validRecord({ duration })).valid, true);
  }
  assertInvalid(validRecord({
    duration: { mode: VOYAGE_HAZARD_DURATION_MODES.ROUNDS, remaining: 3, initial: 2, decrementTiming: timing() }
  }), "invalid-hazard-duration-count");
  assertInvalid(validRecord({
    duration: { mode: VOYAGE_HAZARD_DURATION_MODES.ROUNDS, remaining: 1, initial: 2, decrementTiming: null }
  }), "missing-hazard-duration-timing");
  assertInvalid(validRecord({
    duration: { mode: VOYAGE_HAZARD_DURATION_MODES.NONE, remaining: 0, initial: null, decrementTiming: null }
  }), "invalid-hazard-duration-remaining");
  assertInvalid(validRecord({ duration: { mode: "minutes", remaining: null, initial: null, decrementTiming: null } }), "invalid-hazard-duration-mode");
});

test("enforces escalation modes, unique stages, and bounded countdowns", () => {
  const stages = {
    mode: VOYAGE_HAZARD_ESCALATION_MODES.STAGES,
    currentStageId: "stage-a",
    stages: [
      { stageId: "stage-a", effect: { effectId: "a" }, ignoredConsequence: { consequenceId: "a" } },
      { stageId: "stage-b", effect: { effectId: "b" }, ignoredConsequence: { consequenceId: "b" } }
    ],
    countdown: null,
    maximumEscalationReached: false,
    escalationConsequence: null
  };
  assert.equal(result(validRecord({ escalation: stages })).valid, true);

  const countdown = {
    mode: VOYAGE_HAZARD_ESCALATION_MODES.COUNTDOWN,
    currentStageId: null,
    stages: [],
    countdown: { current: 1, initial: 2, decrementTiming: timing(VOYAGE_HAZARD_TIMING_KINDS.START_OF_NEXT_ROUND) },
    maximumEscalationReached: false,
    escalationConsequence: null
  };
  assert.equal(result(validRecord({ escalation: countdown })).valid, true);
  assertInvalid(validRecord({ escalation: { ...stages, stages: [stages.stages[0], stages.stages[0]] } }), "duplicate-hazard-escalation-stage-id");
  assertInvalid(validRecord({ escalation: { ...stages, currentStageId: "missing" } }), "invalid-hazard-escalation-current-stage");
  assertInvalid(validRecord({ escalation: { ...countdown, countdown: { current: 3, initial: 2, decrementTiming: timing() } } }), "invalid-hazard-escalation-countdown");
  assertInvalid(validRecord({ escalation: { ...countdown, countdown: null } }), "invalid-hazard-escalation-countdown");
});

test("requires an exact policy-specific collision payload for every collision policy", () => {
  assert.equal(result(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { targetStageId: "stage-b" } }
  })).valid, true);
  assert.equal(result(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { escalation: { operationId: "advance-stage" } } }
  })).valid, true);
  assert.equal(result(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: { hazardId: "replacement-hazard" } }
  })).valid, true);
  const replacementDefinition = validRecord({
    hazardId: "replacement-definition",
    metadata: { collision: { hazardId: "nested-replacement-hazard" } }
  });
  assert.equal(result(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: replacementDefinition }
  })).valid, true);
  assert.equal(result(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE,
    metadata: { collision: { consequence: { consequenceId: "collision" } } }
  })).valid, true);
  assert.equal(result(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION,
    metadata: { collision: { amount: 1 } }
  })).valid, true);
  assert.equal(result(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ADD_PRESSURE,
    metadata: { collision: { pressureSystemId: SYSTEM_ID, amount: 1 } }
  })).valid, true);
  for (const policy of Object.values(VOYAGE_HAZARD_COLLISION_POLICIES)) {
    assertInvalid(validRecord({ collisionPolicy: policy, metadata: { collision: {} } }));
  }
  assertInvalid(validRecord({ collisionPolicy: "unknown" }), "invalid-hazard-collision-policy");
  assertInvalid(validRecord({ metadata: {} }), "missing-hazard-collision-metadata");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { targetStageId: "stage-b", amount: 1 } }
  }), "unexpected-hazard-collision-field");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: { hazardId: "replacement-hazard", amount: 1 } }
  }), "unexpected-hazard-collision-field");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE,
    metadata: { collision: { consequence: { consequenceId: "collision" }, amount: 1 } }
  }), "unexpected-hazard-collision-field");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION,
    metadata: { collision: { amount: 1, pressureSystemId: SYSTEM_ID } }
  }), "unexpected-hazard-collision-field");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ADD_PRESSURE,
    metadata: { collision: { pressureSystemId: SYSTEM_ID, amount: 1, consequence: {} } }
  }), "unexpected-hazard-collision-field");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { escalation: {} } }
  }), "invalid-hazard-collision-escalation");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { escalation: { arbitraryField: true } } }
  }), "unexpected-hazard-collision-escalation-field");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { escalation: { operationId: "" } } }
  }), "invalid-hazard-collision-operation-id");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { escalation: { operationId: "advance", extra: true } } }
  }), "unexpected-hazard-collision-escalation-field");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { targetStageId: "dangerous", escalation: { operationId: "advance" } } }
  }), "unexpected-hazard-collision-field");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { targetStageId: "" } }
  }), "invalid-hazard-collision-target-stage");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: { definitionId: "replacement-definition" } }
  }), "unexpected-hazard-collision-field");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: { hazardId: "" } }
  }), "invalid-hazard-collision-hazard-id");
  const malformedDefinition = structuredClone(replacementDefinition);
  delete malformedDefinition.name;
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: malformedDefinition }
  }), "missing-hazard-field", "$.metadata.collision.name");
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE,
    metadata: { collision: { consequence: {} } }
  }), "invalid-hazard-collision-consequence", "$.metadata.collision.consequence");
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION,
    metadata: { collision: { amount: 0 } }
  }), "invalid-hazard-collision-amount");
  for (const amount of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assertInvalid(validRecord({
      collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION,
      metadata: { collision: { amount } }
    }), "invalid-hazard-collision-amount");
  }
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ADD_PRESSURE,
    metadata: { collision: { pressureSystemId: "unknown", amount: 1 } }
  }), "invalid-hazard-collision-pressure-system");
  for (const pressureSystemId of [null, ""]) {
    assertInvalid(validRecord({
      collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ADD_PRESSURE,
      metadata: { collision: { pressureSystemId, amount: 1 } }
    }), "invalid-hazard-collision-pressure-system");
  }
  for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assertInvalid(validRecord({
      collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ADD_PRESSURE,
      metadata: { collision: { pressureSystemId: SYSTEM_ID, amount } }
    }), "invalid-hazard-collision-amount");
  }
});

test("captures missing provenance as null without inferring inherited data", () => {
  const source = validRecord();
  for (const field of VOYAGE_HAZARD_PROVENANCE_FIELDS) delete source[field];
  const captured = captureVoyageHazardRecord(source);
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));
  for (const field of VOYAGE_HAZARD_PROVENANCE_FIELDS) assert.equal(captured.record[field], null);

  const inherited = Object.create({ pressureBreachId: "inherited-breach" });
  Object.assign(inherited, validRecord());
  delete inherited.pressureBreachId;
  assertInvalid(inherited, "invalid-hazard-record");
});

test("capture returns an isolated normalized snapshot and does not mutate input or expose state APIs", () => {
  const source = validRecord({ metadata: { collision: { hazardId: "replacement-hazard" }, nested: { values: [1, 2] } } });
  const before = structuredClone(source);
  const captured = captureVoyageHazardRecord(source);
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));
  assert.notEqual(captured.record, source);
  assert.notEqual(captured.record.metadata, source.metadata);
  assert.deepEqual(source, before);

  captured.record.metadata.nested.values[0] = 99;
  assert.deepEqual(source.metadata.nested.values, [1, 2]);
  assert.deepEqual(Object.keys(captured), ["ok", "record", "errors", "warnings"]);
  assert.equal(Object.hasOwn(captured, "nextState"), false);
  assert.equal(Object.hasOwn(captured, "events"), false);
  assert.equal(Object.hasOwn(captured, "revision"), false);
});

test("failed capture never returns a partially trusted record", () => {
  const captured = captureVoyageHazardRecord(validRecord({ name: "" }));
  assert.equal(captured.ok, false);
  assert.equal(captured.record, null);
  assert.ok(captured.errors.length > 0);
});

test("reports exact nested replacement diagnostic paths", () => {
  const malformedScalar = validRecord({ hazardId: "inline-replacement" });
  malformedScalar.name = "";
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: malformedScalar }
  }), "invalid-hazard-name", "$.metadata.collision.name");

  const extraField = validRecord({ hazardId: "inline-replacement", extraField: true });
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: extraField }
  }), "unexpected-hazard-collision-field", "$.metadata.collision.extraField");

  const hostileMetadata = validRecord({ hazardId: "inline-replacement", metadata: new Map() });
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: hostileMetadata }
  }), "invalid-hazard-object", "$.metadata.collision.metadata");

  const nestedCollision = validRecord({ hazardId: "nested-inline-replacement" });
  const recursiveDefinition = validRecord({
    hazardId: "inline-replacement",
    metadata: { collision: nestedCollision }
  });
  const recursiveSource = validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: recursiveDefinition }
  });
  const recursiveBefore = structuredClone(recursiveSource);
  assertIssue(recursiveSource, "recursive-hazard-replacement", "$.metadata.collision.metadata.collision");
  const recursiveCapture = captureVoyageHazardRecord(recursiveSource);
  assert.equal(recursiveCapture.ok, false);
  assert.equal(recursiveCapture.record, null);
  assert.deepEqual(recursiveSource, recursiveBefore);

  const nestedAccessor = validRecord({ hazardId: "inline-replacement" });
  Object.defineProperty(nestedAccessor.metadata, "collision", {
    get() {
      throw new Error("must not execute");
    },
    enumerable: true
  });
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: nestedAccessor }
  }), "invalid-hazard-data-property", "$.metadata.collision.metadata.collision");
});

test("repeated validation is deterministic and returned diagnostics are isolated", () => {
  const source = validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION,
    metadata: { collision: { amount: 0 } }
  });
  const first = result(source);
  const second = result(source);
  assert.deepEqual(first, second);
  first.errors.push({ code: "caller-mutation" });
  first.warnings.push({ code: "caller-mutation" });
  const third = result(source);
  assert.deepEqual(third, second);
});

test("rejects hostile, sparse, unsafe, accessor, and non-serializable data without executing accessors", () => {
  const unsafe = validRecord();
  Object.defineProperty(unsafe.metadata, "__proto__", { value: { polluted: true }, enumerable: true });
  assertInvalid(unsafe, "unsafe-hazard-key");

  const sparse = validRecord({ currentEffect: { values: new Array(2) } });
  assertInvalid(sparse, "sparse-hazard-array");

  const symbolKey = validRecord();
  Object.defineProperty(symbolKey.metadata, Symbol("secret"), { value: true, enumerable: true });
  assertInvalid(symbolKey, "unexpected-hazard-symbol");

  let getterCalls = 0;
  const accessor = validRecord();
  Object.defineProperty(accessor, "name", {
    get() {
      getterCalls += 1;
      return "should not run";
    },
    enumerable: true
  });
  assertInvalid(accessor, "invalid-hazard-data-property");
  assert.equal(getterCalls, 0);

  const nonEnumerable = validRecord();
  Object.defineProperty(nonEnumerable, "name", { value: "hidden", enumerable: false });
  assertInvalid(nonEnumerable, "invalid-hazard-data-property");

  const nonSerializable = validRecord({ currentEffect: { value: undefined } });
  assertInvalid(nonSerializable, "invalid-hazard-undefined");
  assertInvalid(validRecord({ currentEffect: { value: () => "not data" } }), "invalid-hazard-value");
  assertInvalid(validRecord({ currentEffect: { value: 1n } }), "invalid-hazard-value");
  assertInvalid(validRecord({ currentEffect: { value: Number.NaN } }), "invalid-hazard-number");
  assertInvalid(validRecord({ currentEffect: { value: Number.POSITIVE_INFINITY } }), "invalid-hazard-number");
  assertInvalid(validRecord({ currentEffect: { value: Number.NEGATIVE_INFINITY } }), "invalid-hazard-number");
  assertInvalid(validRecord({ currentEffect: new Date() }), "invalid-hazard-object");

  const cyclic = validRecord();
  cyclic.metadata.self = cyclic.metadata;
  assertInvalid(cyclic, "cyclic-hazard-data");

  const throwingKeys = new Proxy(validRecord(), {
    ownKeys() {
      throw new Error("reflection failure");
    }
  });
  assertInvalid(throwingKeys, "hazard-data-read-failed");

  const throwingDescriptor = new Proxy(validRecord(), {
    getOwnPropertyDescriptor() {
      throw new Error("descriptor failure");
    }
  });
  assertInvalid(throwingDescriptor, "hazard-data-read-failed");

  const throwingPrototype = new Proxy(validRecord(), {
    getPrototypeOf() {
      throw new Error("prototype failure");
    }
  });
  assertInvalid(throwingPrototype, "invalid-hazard-record");

  let setterCalls = 0;
  const setter = validRecord();
  Object.defineProperty(setter.currentEffect, "value", {
    set() {
      setterCalls += 1;
    },
    enumerable: true
  });
  assertInvalid(setter, "invalid-hazard-data-property");
  assert.equal(setterCalls, 0);

  for (const nonPlain of [new Map(), new Set(), new Uint8Array([1]), new (class HazardClass {})()]) {
    assertInvalid(validRecord({ currentEffect: nonPlain }), "invalid-hazard-object");
  }

  let collisionGetterCalls = 0;
  const collisionAccessor = validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION,
    metadata: { collision: {} }
  });
  Object.defineProperty(collisionAccessor.metadata.collision, "amount", {
    get() {
      collisionGetterCalls += 1;
      return 1;
    },
    enumerable: true
  });
  assertInvalid(collisionAccessor, "invalid-hazard-data-property");
  assert.equal(collisionGetterCalls, 0);

  let nestedGetterCalls = 0;
  const nestedAccessor = validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { escalation: {} } }
  });
  Object.defineProperty(nestedAccessor.metadata.collision.escalation, "operationId", {
    get() {
      nestedGetterCalls += 1;
      return "must not run";
    },
    enumerable: true
  });
  assertInvalid(nestedAccessor, "invalid-hazard-data-property");
  assert.equal(nestedGetterCalls, 0);

  let nestedSetterCalls = 0;
  const nestedSetter = validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { escalation: {} } }
  });
  Object.defineProperty(nestedSetter.metadata.collision.escalation, "operationId", {
    set() {
      nestedSetterCalls += 1;
    },
    enumerable: true
  });
  assertInvalid(nestedSetter, "invalid-hazard-data-property");
  assert.equal(nestedSetterCalls, 0);

  const inheritedOperation = Object.create({ operationId: "inherited-operation" });
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { escalation: inheritedOperation } }
  }), "invalid-hazard-object");

  const symbolOperation = { operationId: "advance" };
  Object.defineProperty(symbolOperation, Symbol("operation"), { value: true, enumerable: true });
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { escalation: symbolOperation } }
  }), "unexpected-hazard-symbol");

  const unsafeOperation = { operationId: "advance" };
  Object.defineProperty(unsafeOperation, "__proto__", { value: { polluted: true }, enumerable: true });
  assertInvalid(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: { collision: { escalation: unsafeOperation } }
  }), "unsafe-hazard-key");

  for (const proxy of [
    new Proxy({ operationId: "advance" }, { ownKeys() { throw new Error("nested reflection failure"); } }),
    new Proxy({ operationId: "advance" }, { getOwnPropertyDescriptor() { throw new Error("nested descriptor failure"); } }),
    new Proxy({ operationId: "advance" }, { getPrototypeOf() { throw new Error("nested prototype failure"); } })
  ]) {
    assertInvalid(validRecord({
      collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
      metadata: { collision: { escalation: proxy } }
    }));
  }

  const collisionKeys = validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION,
    metadata: { collision: new Proxy({ amount: 1 }, {
      ownKeys() {
        throw new Error("collision reflection failure");
      }
    }) }
  });
  assertInvalid(collisionKeys, "hazard-data-read-failed");

  const collisionDescriptor = validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION,
    metadata: { collision: new Proxy({ amount: 1 }, {
      getOwnPropertyDescriptor() {
        throw new Error("collision descriptor failure");
      }
    }) }
  });
  assertInvalid(collisionDescriptor, "hazard-data-read-failed");

  const fullReplacementAccessor = validRecord({ hazardId: "inline-replacement" });
  let replacementGetterCalls = 0;
  Object.defineProperty(fullReplacementAccessor, "name", {
    get() {
      replacementGetterCalls += 1;
      return "must not execute";
    },
    enumerable: true
  });
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: fullReplacementAccessor }
  }), "invalid-hazard-data-property", "$.metadata.collision.name");
  assert.equal(replacementGetterCalls, 0);

  const fullReplacementSetter = validRecord({ hazardId: "inline-replacement" });
  let replacementSetterCalls = 0;
  Object.defineProperty(fullReplacementSetter, "name", {
    set() {
      replacementSetterCalls += 1;
    },
    enumerable: true
  });
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: fullReplacementSetter }
  }), "invalid-hazard-data-property", "$.metadata.collision.name");
  assert.equal(replacementSetterCalls, 0);

  const inheritedReplacement = Object.create({ name: "inherited-name" });
  Object.assign(inheritedReplacement, validRecord({ hazardId: "inline-replacement" }));
  delete inheritedReplacement.name;
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: inheritedReplacement }
  }), "invalid-hazard-object", "$.metadata.collision");

  const symbolReplacement = validRecord({ hazardId: "inline-replacement" });
  Object.defineProperty(symbolReplacement, Symbol("replacement"), { value: true, enumerable: true });
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: symbolReplacement }
  }), "unexpected-hazard-symbol", "$.metadata.collision.[symbol]");

  const unsafeReplacement = validRecord({ hazardId: "inline-replacement" });
  Object.defineProperty(unsafeReplacement, "__proto__", { value: { polluted: true }, enumerable: true });
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: unsafeReplacement }
  }), "unsafe-hazard-key", "$.metadata.collision.__proto__");

  for (const nonPlain of [new Map(), new Set(), new Uint8Array([1]), new (class ReplacementClass {})()]) {
    const nonPlainReplacement = validRecord({ hazardId: "inline-replacement", currentEffect: nonPlain });
    assertIssue(validRecord({
      collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
      metadata: { collision: nonPlainReplacement }
    }), "invalid-hazard-object", "$.metadata.collision.currentEffect");
  }

  const throwingPrototypeReplacement = new Proxy(validRecord({ hazardId: "inline-replacement" }), {
    getPrototypeOf() {
      throw new Error("replacement prototype failure");
    }
  });
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: throwingPrototypeReplacement }
  }), "invalid-hazard-object", "$.metadata.collision");

  const throwingDescriptorReplacement = new Proxy(validRecord({ hazardId: "inline-replacement" }), {
    getOwnPropertyDescriptor() {
      throw new Error("replacement descriptor failure");
    }
  });
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: throwingDescriptorReplacement }
  }), "hazard-data-read-failed", "$.metadata.collision.hazardId");

  const nestedCollisionAccessor = validRecord({ hazardId: "inline-replacement" });
  Object.defineProperty(nestedCollisionAccessor.metadata.collision, "hazardId", {
    get() {
      throw new Error("nested collision getter");
    },
    enumerable: true
  });
  assertIssue(validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.REPLACE_EXISTING,
    metadata: { collision: nestedCollisionAccessor }
  }), "invalid-hazard-data-property", "$.metadata.collision.metadata.collision.hazardId");
});

test("accepted escalation and consequence descriptors remain deeply isolated", () => {
  const source = validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    metadata: {
      collision: {
        escalation: { operationId: "advance-stage" }
      }
    }
  });
  const captured = captureVoyageHazardRecord(source);
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));

  source.metadata.collision.escalation.operationId = "changed-source";
  assert.equal(captured.record.metadata.collision.escalation.operationId, "advance-stage");
  captured.record.metadata.collision.escalation.operationId = "changed-result";
  assert.equal(source.metadata.collision.escalation.operationId, "changed-source");

  const consequenceSource = validRecord({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE,
    metadata: {
      collision: {
        consequence: { consequenceId: "trigger", nested: { values: [1] } }
      }
    }
  });
  const consequenceCapture = captureVoyageHazardRecord(consequenceSource);
  assert.equal(consequenceCapture.ok, true, JSON.stringify(consequenceCapture.errors));
  consequenceSource.metadata.collision.consequence.nested.values[0] = 2;
  consequenceCapture.record.metadata.collision.consequence.nested.values[0] = 3;
  const laterCapture = captureVoyageHazardRecord(consequenceSource);
  assert.equal(laterCapture.ok, true, JSON.stringify(laterCapture.errors));
  assert.deepEqual(laterCapture.record.metadata.collision.consequence.nested.values, [2]);
});

test("rejects encounter mismatches and invalid validation modes without changing the source", () => {
  const source = validRecord();
  const before = structuredClone(source);
  assertInvalid(source, "hazard-encounter-id-mismatch", { expectedEncounterId: "other-encounter" });
  assertInvalid(source, "invalid-hazard-validation-mode", { mode: "invalid" });
  assert.deepEqual(source, before);
});

test("hostile validation options fail closed without invoking getters", () => {
  let getterCalls = 0;
  const options = {};
  Object.defineProperty(options, "mode", {
    get() {
      getterCalls += 1;
      return "snapshot";
    },
    enumerable: true
  });
  const validation = result(validRecord(), options);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.code === "invalid-hazard-data-property"));
  assert.equal(getterCalls, 0);

  const captured = captureVoyageHazardRecord(validRecord(), options);
  assert.equal(captured.ok, false);
  assert.equal(captured.record, null);
  assert.equal(getterCalls, 0);
});
