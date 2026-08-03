import assert from "node:assert/strict";
import test from "node:test";

import {
  VOYAGE_HAZARD_CATEGORIES,
  VOYAGE_HAZARD_COLLISION_POLICIES,
  VOYAGE_HAZARD_DURATION_MODES,
  VOYAGE_HAZARD_ESCALATION_MODES,
  VOYAGE_HAZARD_STATUSES,
  VOYAGE_HAZARD_TIMING_KINDS,
  VOYAGE_HAZARD_VISIBILITY,
  VOYAGE_PRESSURE_SYSTEM_IDS
} from "../../../scripts/voyage/domain/constants.js";
import { createDefaultVoyageEncounterCollections, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";
import { createVoyageEncounterState, normalizeVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";

const [SYSTEM_A, SYSTEM_B] = VOYAGE_PRESSURE_SYSTEM_IDS;

function timing() {
  return { kind: VOYAGE_HAZARD_TIMING_KINDS.IMMEDIATE, stationId: null, resultId: null };
}

function hazard(overrides = {}) {
  return {
    hazardId: "hazard-1",
    encounterId: "encounter-1",
    category: VOYAGE_HAZARD_CATEGORIES.SYSTEM,
    status: VOYAGE_HAZARD_STATUSES.ACTIVE,
    name: "Arc instability",
    currentEffect: { effectId: "current-effect" },
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
    failurePressureSystemId: SYSTEM_A,
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { hazardId: "replacement-hazard" } },
    pressureSystemId: SYSTEM_A,
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

function stateWithHazards(activeHazards) {
  const state = createVoyageEncounterState({ encounterId: "encounter-1" });
  state.activeHazards = activeHazards;
  return state;
}

function reportFor(activeHazards) {
  return validateVoyageEncounterState(stateWithHazards(activeHazards));
}

function codes(report) {
  return report.errors.map((error) => error.code);
}

function hasIssue(report, code, path) {
  return report.errors.some((error) => error.code === code && (!path || error.path === path));
}

test("defaults and fresh collections contain independent empty activeHazards arrays", () => {
  const firstCollections = createDefaultVoyageEncounterCollections();
  const secondCollections = createDefaultVoyageEncounterCollections();
  const firstDefaults = createDraftVoyageEncounterDefaults();
  const secondDefaults = createDraftVoyageEncounterDefaults();

  assert.deepEqual(firstCollections.activeHazards, []);
  assert.deepEqual(firstDefaults.activeHazards, []);
  assert.notStrictEqual(firstCollections.activeHazards, secondCollections.activeHazards);
  assert.notStrictEqual(firstDefaults.activeHazards, secondDefaults.activeHazards);
  firstDefaults.activeHazards.push(hazard());
  assert.deepEqual(secondDefaults.activeHazards, []);
});

test("created Draft encounters contain an owned empty activeHazards array", () => {
  const first = createVoyageEncounterState({}, { idGenerator: () => "encounter-1" });
  const second = createVoyageEncounterState({}, { idGenerator: () => "encounter-2" });

  assert.deepEqual(first.activeHazards, []);
  assert.equal(Object.hasOwn(first, "activeHazards"), true);
  assert.notStrictEqual(first.activeHazards, second.activeHazards);
});

test("normalization defaults activeHazards and preserves invalid supplied entries", () => {
  const missing = normalizeVoyageEncounterState({ encounterId: "encounter-1" });
  const nonArray = normalizeVoyageEncounterState({ encounterId: "encounter-1", activeHazards: { invalid: true } });
  const invalid = { hazardId: "invalid", unknown: { retained: true } };
  const preserved = normalizeVoyageEncounterState({ encounterId: "encounter-1", activeHazards: [invalid] });

  assert.deepEqual(missing.activeHazards, []);
  assert.deepEqual(nonArray.activeHazards, []);
  assert.deepEqual(preserved.activeHazards, [invalid]);
  assert.notStrictEqual(preserved.activeHazards[0], invalid);
});

test("normalization clones activeHazards and nested Hazard data without aliasing", () => {
  const sourceHazard = hazard({ metadata: { collision: { hazardId: "replacement", nested: { values: [1] } } } });
  const source = { encounterId: "encounter-1", activeHazards: [sourceHazard] };
  const normalized = normalizeVoyageEncounterState(source);

  assert.notStrictEqual(normalized.activeHazards, source.activeHazards);
  assert.notStrictEqual(normalized.activeHazards[0], sourceHazard);
  assert.notStrictEqual(normalized.activeHazards[0].metadata, sourceHazard.metadata);
  normalized.activeHazards[0].metadata.collision.nested.values[0] = 2;
  assert.deepEqual(sourceHazard.metadata.collision.nested.values, [1]);
});

test("normalization does not convert terminal Hazard records into active records", () => {
  const terminal = hazard({ status: VOYAGE_HAZARD_STATUSES.EXPIRED, terminalReason: "duration-ended" });
  const normalized = normalizeVoyageEncounterState({ encounterId: "encounter-1", activeHazards: [terminal] });

  assert.equal(normalized.activeHazards[0].status, VOYAGE_HAZARD_STATUSES.EXPIRED);
});

test("valid active system and event Hazards pass collection validation", () => {
  const system = hazard();
  const event = hazard({
    hazardId: "event-hazard",
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    pressureSystemId: null,
    eventAreaId: "engine-room",
    failurePressureSystemId: null
  });

  assert.equal(reportFor([system]).valid, true);
  assert.equal(reportFor([event]).valid, true);
});

test("multiple event Hazards may share an eventAreaId", () => {
  const first = hazard({ hazardId: "event-1", category: VOYAGE_HAZARD_CATEGORIES.EVENT, pressureSystemId: null, eventAreaId: "engine-room", failurePressureSystemId: null });
  const second = hazard({ hazardId: "event-2", category: VOYAGE_HAZARD_CATEGORIES.EVENT, pressureSystemId: null, eventAreaId: "engine-room", failurePressureSystemId: null });

  assert.equal(reportFor([first, second]).valid, true);
});

test("event Hazards do not occupy a system slot through failurePressureSystemId", () => {
  const system = hazard();
  const event = hazard({
    hazardId: "event-hazard",
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    pressureSystemId: null,
    eventAreaId: "engine-room",
    failurePressureSystemId: SYSTEM_A
  });

  assert.equal(reportFor([system, event]).valid, true);
});

test("duplicate hazardId reports the second exact entry path", () => {
  const first = hazard();
  const second = structuredClone(first);
  const report = reportFor([first, second]);

  assert.equal(report.valid, false);
  assert.equal(hasIssue(report, "duplicate-hazard-id", "activeHazards[1].hazardId"), true);
});

test("duplicate IDs remain invalid for otherwise isolated cloned records", () => {
  const first = hazard({ metadata: { collision: { hazardId: "replacement" }, nested: { value: 1 } } });
  const second = structuredClone(first);
  second.metadata.nested.value = 2;
  const report = reportFor([first, second]);

  assert.equal(report.valid, false);
  assert.equal(hasIssue(report, "duplicate-hazard-id", "activeHazards[1].hazardId"), true);
});

test("two active system Hazards cannot occupy one Pressure system slot", () => {
  const report = reportFor([hazard({ hazardId: "system-1" }), hazard({ hazardId: "system-2" })]);

  assert.equal(report.valid, false);
  assert.equal(hasIssue(report, "duplicate-active-hazard-system-slot", "activeHazards[1].pressureSystemId"), true);
});

test("system Hazards on different Pressure systems pass", () => {
  const report = reportFor([
    hazard({ hazardId: "system-a", pressureSystemId: SYSTEM_A, failurePressureSystemId: SYSTEM_A }),
    hazard({ hazardId: "system-b", pressureSystemId: SYSTEM_B, failurePressureSystemId: SYSTEM_B })
  ]);

  assert.equal(report.valid, true);
});

for (const status of [VOYAGE_HAZARD_STATUSES.RESOLVED, VOYAGE_HAZARD_STATUSES.EXPIRED, VOYAGE_HAZARD_STATUSES.REPLACED]) {
  test(`terminal ${status} Hazard records fail in activeHazards`, () => {
    const report = reportFor([hazard({
      status,
      terminalReason: `${status}-reason`,
      replacedByHazardId: status === VOYAGE_HAZARD_STATUSES.REPLACED ? "replacement" : null
    })]);

    assert.equal(report.valid, false);
    assert.equal(hasIssue(report, "invalid-active-hazard-record", "activeHazards[0]"), true);
    assert.equal(hasIssue(report, "invalid-hazard-active-status", "activeHazards[0].status"), true);
  });
}

test("Hazard encounterId must match the containing state", () => {
  const report = reportFor([hazard({ encounterId: "other-encounter" })]);

  assert.equal(report.valid, false);
  assert.equal(hasIssue(report, "hazard-encounter-id-mismatch", "activeHazards[0].encounterId"), true);
});

test("activeHazards requires an own enumerable data array property", () => {
  const missing = createVoyageEncounterState({ encounterId: "encounter-1" });
  delete missing.activeHazards;
  assert.equal(hasIssue(validateVoyageEncounterState(missing), "missing-active-hazards", "activeHazards"), true);

  const nonEnumerable = createVoyageEncounterState({ encounterId: "encounter-1" });
  Object.defineProperty(nonEnumerable, "activeHazards", { value: [], enumerable: false, writable: true, configurable: true });
  assert.equal(hasIssue(validateVoyageEncounterState(nonEnumerable), "invalid-active-hazards-collection-property", "activeHazards"), true);

  const nonArray = stateWithHazards({});
  assert.equal(hasIssue(validateVoyageEncounterState(nonArray), "invalid-active-hazards-collection", "activeHazards"), true);
});

test("inherited and accessor activeHazards fail without executing the getter", () => {
  const inheritedDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, "activeHazards");
  const inherited = createVoyageEncounterState({ encounterId: "encounter-1" });
  delete inherited.activeHazards;
  Object.defineProperty(Object.prototype, "activeHazards", { value: [], enumerable: false, configurable: true });
  try {
    assert.equal(hasIssue(validateVoyageEncounterState(inherited), "inherited-active-hazards", "activeHazards"), true);
  } finally {
    if (inheritedDescriptor) Object.defineProperty(Object.prototype, "activeHazards", inheritedDescriptor);
    else delete Object.prototype.activeHazards;
  }

  let getterCalls = 0;
  const accessor = createVoyageEncounterState({ encounterId: "encounter-1" });
  Object.defineProperty(accessor, "activeHazards", {
    get() {
      getterCalls += 1;
      return [];
    },
    enumerable: true,
    configurable: true
  });
  assert.equal(hasIssue(validateVoyageEncounterState(accessor), "invalid-active-hazards-collection-property", "activeHazards"), true);
  assert.equal(getterCalls, 0);
});

test("sparse, symbol-keyed, and unexpected activeHazards arrays fail", () => {
  const sparse = stateWithHazards(new Array(1));
  assert.equal(hasIssue(validateVoyageEncounterState(sparse), "sparse-active-hazards", "activeHazards[0]"), true);

  const symbolKeyed = stateWithHazards([hazard()]);
  Object.defineProperty(symbolKeyed.activeHazards, Symbol("extra"), { value: true, enumerable: true });
  assert.equal(hasIssue(validateVoyageEncounterState(symbolKeyed), "unexpected-active-hazards-array-key"), true);

  const unexpected = stateWithHazards([hazard()]);
  unexpected.activeHazards.extra = true;
  assert.equal(hasIssue(validateVoyageEncounterState(unexpected), "unexpected-active-hazards-array-key", "activeHazards.extra"), true);
});

test("activeHazards Proxy reflection failures fail closed", () => {
  const ownKeysFailure = stateWithHazards(new Proxy([], { ownKeys() { throw new Error("active hazard keys"); } }));
  assert.equal(hasIssue(validateVoyageEncounterState(ownKeysFailure), "active-hazards-data-read-failed", "activeHazards"), true);

  const descriptorFailure = stateWithHazards(new Proxy([], { getOwnPropertyDescriptor() { throw new Error("active hazard descriptor"); } }));
  assert.equal(hasIssue(validateVoyageEncounterState(descriptorFailure), "active-hazards-data-read-failed", "activeHazards"), true);
});

test("invalid nested Hazard data is rebased to the exact collection path", () => {
  const invalid = hazard({
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.EXTEND_DURATION,
    metadata: { collision: { amount: 0 } }
  });
  const report = reportFor([invalid]);

  assert.equal(hasIssue(report, "invalid-active-hazard-record", "activeHazards[0]"), true);
  assert.equal(hasIssue(report, "invalid-hazard-collision-amount", "activeHazards[0].metadata.collision.amount"), true);
});

test("unknown nested Hazard top-level fields fail", () => {
  const invalid = hazard({ unexpectedField: true });
  const report = reportFor([invalid]);

  assert.equal(hasIssue(report, "unexpected-hazard-field", "activeHazards[0].unexpectedField"), true);
});

test("collection validation preserves order and does not mutate state or unrelated data", () => {
  const state = stateWithHazards([
    hazard({ hazardId: "first" }),
    hazard({ hazardId: "second", pressureSystemId: SYSTEM_B, failurePressureSystemId: SYSTEM_B })
  ]);
  state.revision = 7;
  state.permanentConsequences = [{ consequenceId: "permanent", status: "proposed", commitmentTiming: "immediate" }];
  state.temporaryConsequences = [{ consequenceId: "temporary" }];
  const before = structuredClone(state);
  const report = validateVoyageEncounterState(state);

  assert.equal(report.valid, true);
  assert.deepEqual(state, before);
  assert.deepEqual(state.activeHazards.map(({ hazardId }) => hazardId), ["first", "second"]);
  assert.deepEqual(Object.keys(report).sort(), ["errors", "valid", "warnings"]);
  assert.equal(state.revision, 7);
});
