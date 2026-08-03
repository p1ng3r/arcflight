import assert from "node:assert/strict";
import test from "node:test";

import {
  VOYAGE_HAZARD_CATEGORIES,
  VOYAGE_HAZARD_COLLISION_POLICIES,
  VOYAGE_HAZARD_DURATION_MODES,
  VOYAGE_HAZARD_ESCALATION_MODES,
  VOYAGE_HAZARD_STATUSES,
  VOYAGE_HAZARD_TIMING_KINDS,
  VOYAGE_HAZARD_VISIBILITY
} from "../../../scripts/voyage/domain/constants.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import {
  VOYAGE_HAZARD_RECORD_FIELDS,
  captureVoyageHazardRecord,
  validateVoyageHazardRecord
} from "../../../scripts/voyage/domain/hazard-schema.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";
import { VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS } from "../../../scripts/voyage/domain/pressure-breach-hazard-definitions.js";
import { applyVoyageEncounterCrewPlanningLock } from "../../../scripts/voyage/domain/crew-planning-lock.js";
import { applyVoyageEncounterResolutionTransition } from "../../../scripts/voyage/domain/resolution-transition.js";
import { prepareVoyageEncounterActionExecutionRequests } from "../../../scripts/voyage/domain/resolution-execution-requests.js";
import { prepareVoyageEncounterResolutionCompletion } from "../../../scripts/voyage/domain/resolution-completion.js";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";
import {
  applyVoyageEncounterPressureBreachPlan,
  analyzeVoyageEncounterPressureBreachHazardPlan,
  buildVoyagePressureBreachActiveHazard
} from "../../../scripts/voyage/domain/pressure-breach.js";

const PRESSURE_BREACH_EVENT_KEYS = [
  "type",
  "encounterId",
  "lifecycleState",
  "stageId",
  "roundNumber",
  "phase",
  "pressureEffectCount",
  "appliedEffectCount",
  "breach",
  "hazard",
  "collisionOutcome",
  "voidScarProposal",
  "pressureReset",
  "effects",
  "previousPressureSystems",
  "pressureSystems",
  "previousRevision",
  "revision"
];

function encounterState({ pressureSystemId = "crew-morale" } = {}) {
  const result = createVoyageEncounterState({
    encounterId: "pressure-breach-active-hazard-encounter",
    definitionId: "pressure-breach-definition",
    primaryShip: { id: "pressure-breach-ship" }
  });
  result.lifecycleState = "active";
  result.currentStage = { stageId: "pressure-breach-stage" };
  result.roundNumber = 1;
  result.phase = "crew-planning";
  result.availableStations = [{
    stationId: "captain",
    actions: [{
      actionId: "pressure-breach-action",
      approaches: [{ approachId: "approach-pressure-breach-action", noRoll: true }],
      outcomeDefinition: {
        effectRules: [{
          effectId: "pressure-breach-effect",
          intentType: "pressure-change",
          timing: "consequences",
          visibility: "public",
          target: pressureSystemId === "crew-morale"
            ? { kind: "source-station" }
            : { kind: "pressure-system", targetId: pressureSystemId },
          payload: { delta: 1 }
        }],
        branches: { "no-roll": ["pressure-breach-effect"] }
      }
    }]
  }];
  result.stationAssignments = [{
    stationId: "captain",
    operator: { kind: "actor", uuid: "Actor.operator-captain" }
  }];
  result.selections = {
    captain: {
      stationId: "captain",
      actionId: "pressure-breach-action",
      approachId: "approach-pressure-breach-action",
      noRoll: true
    }
  };
  result.proposedStationOrder = ["captain"];
  result.committedStationOrder = [];
  return result;
}

function breachState({ pressureSystemId = "crew-morale" } = {}) {
  const source = encounterState({ pressureSystemId });
  const locked = applyVoyageEncounterCrewPlanningLock(source, {
    phaseStartSnapshotId: "pressure-breach-lock"
  });
  assert.equal(locked.ok, true);
  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, {
    phaseStartSnapshotId: "pressure-breach-resolution"
  });
  assert.equal(resolution.ok, true);
  const requests = prepareVoyageEncounterActionExecutionRequests(resolution.nextState);
  assert.equal(requests.readyForExecution, true);
  const completion = prepareVoyageEncounterResolutionCompletion(resolution.nextState);
  assert.equal(completion.readyForConsequences, true);
  const consequences = applyVoyageEncounterConsequencesTransition(resolution.nextState, {
    phaseStartSnapshotId: "pressure-breach-consequences"
  });
  assert.equal(consequences.ok, true);
  consequences.nextState.pressureSystems[pressureSystemId].value = 2;
  return consequences.nextState;
}

function hazard(overrides = {}) {
  return {
    hazardId: "existing-hazard",
    encounterId: "pressure-breach-active-hazard-encounter",
    category: VOYAGE_HAZARD_CATEGORIES.SYSTEM,
    status: VOYAGE_HAZARD_STATUSES.ACTIVE,
    name: "Existing Hazard",
    currentEffect: { effectId: "existing-effect" },
    activationTiming: { kind: VOYAGE_HAZARD_TIMING_KINDS.IMMEDIATE, stationId: null, resultId: null },
    removalMethod: { methodId: "address-hazard" },
    ignoredConsequence: { consequenceId: "existing-ignored-consequence" },
    visibility: VOYAGE_HAZARD_VISIBILITY.PUBLIC,
    sourceKind: "test",
    createdStageId: "pressure-breach-stage",
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
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.ESCALATE_EXISTING,
    duration: {
      mode: VOYAGE_HAZARD_DURATION_MODES.NONE,
      remaining: null,
      initial: null,
      decrementTiming: null
    },
    failurePressureSystemId: "arkengine",
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { targetStageId: "pressure-breach-stage" } },
    pressureSystemId: "arkengine",
    eventAreaId: null,
    pressureBreachId: "existing-breach",
    stationId: "engineer",
    actionId: "existing-action",
    pressureEffectId: "existing-pressure-effect",
    sourceIntentId: null,
    activationSource: null,
    branch: "failure",
    sourceTiming: "consequences",
    sourceVisibility: "public",
    ...overrides
  };
}

function repeatedHazard(pressureSystemId, overrides = {}) {
  return hazard({
    hazardId: `existing-${pressureSystemId}`,
    pressureSystemId,
    failurePressureSystemId: pressureSystemId,
    collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE,
    metadata: {
      collision: {
        consequence: {
          consequenceId: `${pressureSystemId}-authored-repeat`,
          name: `${pressureSystemId} Authored Repeat`,
          description: `The authored ${pressureSystemId} consequence applies.`
        }
      }
    },
    ...overrides
  });
}

function applyWithHazards(activeHazards) {
  const source = breachState();
  source.activeHazards = activeHazards;
  return { source, before: structuredClone(source), result: applyVoyageEncounterPressureBreachPlan(source) };
}

function issueCodes(result) {
  return result.errors.map(({ code }) => code);
}

test("persists the authored complete Hazard definition for every Pressure system", () => {
  const expected = {
    "crew-morale": {
      effect: {
        effectId: "crew-morale-fracture",
        name: "Crew Morale Fracture",
        description: "The crew remains shaken and under mounting morale strain until the Hazard is addressed."
      },
      ignored: {
        consequenceId: "crew-morale-fracture-ignored",
        name: "Crew Morale Fracture Ignored",
        description: "The unresolved morale fracture applies its authored closeout consequence."
      },
      collision: {
        consequenceId: "crew-morale-repeat-breach",
        name: "Crew Morale Repeated Breach",
        description: "A repeated Crew Morale breach triggers the existing Hazard's authored consequence."
      }
    },
    arkengine: {
      effect: {
        effectId: "arkengine-instability",
        name: "Arkengine Instability",
        description: "The Arkengine remains dangerously unstable until the Hazard is addressed."
      },
      ignored: {
        consequenceId: "arkengine-instability-ignored",
        name: "Arkengine Instability Ignored",
        description: "The unresolved Arkengine instability applies its authored closeout consequence."
      },
      collision: {
        consequenceId: "arkengine-repeat-breach",
        name: "Arkengine Repeated Breach",
        description: "A repeated Arkengine breach triggers the existing Hazard's authored consequence."
      }
    },
    "levstone-array": {
      effect: {
        effectId: "levstone-gravity-shear",
        name: "Levstone Gravity Shear",
        description: "The levstone array remains trapped in dangerous gravitational shear until the Hazard is addressed."
      },
      ignored: {
        consequenceId: "levstone-gravity-shear-ignored",
        name: "Levstone Gravity Shear Ignored",
        description: "The unresolved gravity shear applies its authored closeout consequence."
      },
      collision: {
        consequenceId: "levstone-array-repeat-breach",
        name: "Levstone Array Repeated Breach",
        description: "A repeated Levstone Array breach triggers the existing Hazard's authored consequence."
      }
    },
    "solar-sail-rig": {
      effect: {
        effectId: "solar-sail-desynchronization",
        name: "Solar-Sail Desynchronization",
        description: "The solar-sail rig remains dangerously desynchronized until the Hazard is addressed."
      },
      ignored: {
        consequenceId: "solar-sail-desynchronization-ignored",
        name: "Solar-Sail Desynchronization Ignored",
        description: "The unresolved sail desynchronization applies its authored closeout consequence."
      },
      collision: {
        consequenceId: "solar-sail-rig-repeat-breach",
        name: "Solar-Sail Rig Repeated Breach",
        description: "A repeated Solar-Sail Rig breach triggers the existing Hazard's authored consequence."
      }
    },
    lifeveil: {
      effect: {
        effectId: "lifeveil-collapse",
        name: "Lifeveil Collapse",
        description: "The Lifeveil remains critically unstable until the Hazard is addressed."
      },
      ignored: {
        consequenceId: "lifeveil-collapse-ignored",
        name: "Lifeveil Collapse Ignored",
        description: "The unresolved Lifeveil collapse applies its authored closeout consequence."
      },
      collision: {
        consequenceId: "lifeveil-repeat-breach",
        name: "Lifeveil Repeated Breach",
        description: "A repeated Lifeveil breach triggers the existing Hazard's authored consequence."
      }
    }
  };

  for (const [pressureSystemId, definition] of Object.entries(expected)) {
    const source = breachState({ pressureSystemId });
    const result = applyVoyageEncounterPressureBreachPlan(source);

    assert.equal(result.ok, true, pressureSystemId);
    assert.equal(result.events.length, 1, pressureSystemId);
    assert.equal(result.nextState.activeHazards.length, 1, pressureSystemId);
    const persisted = result.nextState.activeHazards[0];
    assert.deepEqual(persisted.currentEffect, definition.effect, pressureSystemId);
    assert.deepEqual(persisted.activationTiming, {
      kind: "start-of-next-round",
      stationId: null,
      resultId: null
    }, pressureSystemId);
    assert.deepEqual(
      persisted.removalMethod,
      VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS[pressureSystemId].removalMethod,
      pressureSystemId
    );
    assert.deepEqual(persisted.ignoredConsequence, definition.ignored, pressureSystemId);
    assert.equal(persisted.collisionPolicy, "trigger-existing-consequence", pressureSystemId);
    assert.deepEqual(persisted.metadata, { collision: { consequence: definition.collision } }, pressureSystemId);
    assert.deepEqual(persisted.escalation, {
      mode: "none",
      currentStageId: null,
      stages: [],
      countdown: null,
      maximumEscalationReached: false,
      escalationConsequence: null
    }, pressureSystemId);
    assert.deepEqual(persisted.duration, {
      mode: "none",
      remaining: null,
      initial: null,
      decrementTiming: null
    }, pressureSystemId);
    assert.equal(validateVoyageHazardRecord(persisted, {
      mode: "active",
      expectedEncounterId: source.encounterId
    }).valid, true, pressureSystemId);
    assert.equal(validateVoyageEncounterState(result.nextState).valid, true, pressureSystemId);
    assert.notStrictEqual(
      persisted.currentEffect,
      VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS[pressureSystemId].currentEffect,
      pressureSystemId
    );
    const registryDescription = VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS[pressureSystemId].currentEffect.description;
    persisted.currentEffect.description = "mutated persisted description";
    assert.equal(
      VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS[pressureSystemId].currentEffect.description,
      registryDescription,
      pressureSystemId
    );
  }
});

test("missing authored definitions fail closed before active Hazard capture", () => {
  const source = breachState();
  const before = structuredClone(source);
  const planned = analyzeVoyageEncounterPressureBreachHazardPlan(source).hazard;
  const missingDefinitionHazard = {
    ...planned,
    pressureSystemId: "unapproved-pressure-system"
  };

  const result = buildVoyagePressureBreachActiveHazard(missingDefinitionHazard);

  assert.equal(result.ok, false);
  assert.equal(result.hazard, null);
  assert.deepEqual(result.errors, [{
    code: "pressure-breach-hazard-definition-missing",
    path: "$.pressureSystemId",
    message: "No authored Pressure-system Hazard definition exists for this pressureSystemId.",
    severity: "error"
  }]);
  assert.deepEqual(source, before);
});

function assertHelperFailure(input) {
  let result;
  assert.doesNotThrow(() => {
    result = buildVoyagePressureBreachActiveHazard(input);
  });
  assert.equal(result.ok, false);
  assert.equal(result.hazard, null);
  assert.equal(Object.hasOwn(result, "definition"), false);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, "pressure-breach-application-hazard-invalid");
  assert.equal(result.errors[0].severity, "error");
  assert.equal(result.errors[0].message.includes("raw-helper-message"), false);
  return result;
}

test("safely captures a valid sparse Hazard and isolates the complete result", () => {
  const source = breachState();
  const sparseHazard = analyzeVoyageEncounterPressureBreachHazardPlan(source).hazard;
  const before = structuredClone(sparseHazard);
  const result = buildVoyagePressureBreachActiveHazard(sparseHazard);

  assert.deepEqual(Object.keys(result), ["ok", "hazard", "errors", "warnings"]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(Object.keys(result.hazard).sort(), [...VOYAGE_HAZARD_RECORD_FIELDS].sort());
  assert.equal(result.hazard.pressureBreachId, sparseHazard.pressureBreachId);
  assert.equal(result.hazard.sourceTiming, sparseHazard.timing);
  assert.notStrictEqual(result.hazard, sparseHazard);
  assert.notStrictEqual(result.hazard.currentEffect, VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS["crew-morale"].currentEffect);

  result.hazard.currentEffect.description = "changed";
  result.hazard.activationTiming.kind = "event-closeout";
  result.hazard.removalMethod.name = "changed";
  result.hazard.ignoredConsequence.description = "changed";
  result.hazard.escalation.stages.push({});
  result.hazard.metadata.collision.consequence.description = "changed";
  result.hazard.duration.mode = "rounds";

  assert.deepEqual(sparseHazard, before);
  assert.equal(
    VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS["crew-morale"].currentEffect.description,
    "The crew remains shaken and under mounting morale strain until the Hazard is addressed."
  );
});

test("rejects hostile sparse Hazard properties without executing caller code", () => {
  const source = breachState();
  const sparseHazard = analyzeVoyageEncounterPressureBreachHazardPlan(source).hazard;

  let pressureGetterReads = 0;
  const getterPressureSystem = { ...sparseHazard };
  Object.defineProperty(getterPressureSystem, "pressureSystemId", {
    enumerable: true,
    configurable: true,
    get() {
      pressureGetterReads += 1;
      throw new Error("raw-helper-message");
    }
  });
  assertHelperFailure(getterPressureSystem);
  assert.equal(pressureGetterReads, 0);

  let otherGetterReads = 0;
  const getterOtherField = { ...sparseHazard };
  Object.defineProperty(getterOtherField, "name", {
    enumerable: true,
    configurable: true,
    get() {
      otherGetterReads += 1;
      throw new Error("raw-helper-message");
    }
  });
  assertHelperFailure(getterOtherField);
  assert.equal(otherGetterReads, 0);

  let setterCalls = 0;
  const setterField = { ...sparseHazard };
  Object.defineProperty(setterField, "name", {
    enumerable: true,
    configurable: true,
    set() {
      setterCalls += 1;
    }
  });
  assertHelperFailure(setterField);
  assert.equal(setterCalls, 0);

  const inheritedField = { ...sparseHazard };
  delete inheritedField.pressureSystemId;
  Object.setPrototypeOf(inheritedField, { pressureSystemId: "crew-morale" });
  assert.equal(assertHelperFailure(inheritedField).errors[0].path, "$");

  const nonEnumerableField = { ...sparseHazard };
  Object.defineProperty(nonEnumerableField, "name", {
    configurable: true,
    enumerable: false,
    value: sparseHazard.name,
    writable: true
  });
  assert.equal(assertHelperFailure(nonEnumerableField).errors[0].path, "$.name");

  const symbolField = { ...sparseHazard, [Symbol("unexpected")]: true };
  assertHelperFailure(symbolField);

  const unsafeField = { ...sparseHazard };
  Object.defineProperty(unsafeField, "__proto__", {
    configurable: true,
    enumerable: true,
    value: "unsafe",
    writable: true
  });
  assertHelperFailure(unsafeField);
});

test("contains Proxy reflection failures and coercion objects at the helper boundary", () => {
  const source = breachState();
  const sparseHazard = analyzeVoyageEncounterPressureBreachHazardPlan(source).hazard;

  const ownKeysFailure = new Proxy(sparseHazard, {
    ownKeys() {
      throw new Error("raw-helper-message");
    }
  });
  assertHelperFailure(ownKeysFailure);

  const descriptorFailure = new Proxy(sparseHazard, {
    ownKeys: Reflect.ownKeys,
    getOwnPropertyDescriptor() {
      throw new Error("raw-helper-message");
    }
  });
  assertHelperFailure(descriptorFailure);

  const prototypeFailure = new Proxy(sparseHazard, {
    getPrototypeOf() {
      throw new Error("raw-helper-message");
    }
  });
  assertHelperFailure(prototypeFailure);

  let coercionCalls = 0;
  const coercionObject = {
    [Symbol.toPrimitive]() {
      coercionCalls += 1;
      throw new Error("raw-helper-message");
    },
    toString() {
      coercionCalls += 1;
      throw new Error("raw-helper-message");
    },
    valueOf() {
      coercionCalls += 1;
      throw new Error("raw-helper-message");
    }
  };
  assertHelperFailure(coercionObject);
  assert.equal(coercionCalls, 0);
  assertHelperFailure(new String("crew-morale"));
  assertHelperFailure(() => "crew-morale");
});

test("persists one captured active Hazard after existing records in canonical order", () => {
  const first = hazard({ hazardId: "first-hazard", pressureSystemId: "arkengine", failurePressureSystemId: "arkengine" });
  const second = hazard({
    hazardId: "event-hazard",
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    pressureSystemId: null,
    eventAreaId: "engine-room",
    failurePressureSystemId: "crew-morale"
  });
  const { source, result } = applyWithHazards([first, second]);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.nextState.activeHazards.slice(0, 2).map(({ hazardId }) => hazardId), ["first-hazard", "event-hazard"]);
  assert.equal(result.nextState.activeHazards.length, 3);
  const persisted = result.nextState.activeHazards[2];
  assert.equal(persisted.status, "active");
  assert.equal(persisted.category, "system");
  assert.equal(persisted.encounterId, source.encounterId);
  assert.deepEqual(Object.keys(persisted).sort(), [...VOYAGE_HAZARD_RECORD_FIELDS].sort());
  assert.equal(persisted.pressureSystemId, "crew-morale");
  assert.equal(persisted.failurePressureSystemId, "crew-morale");
  assert.equal(validateVoyageHazardRecord(persisted, { mode: "active", expectedEncounterId: source.encounterId }).valid, true);
  assert.equal(validateVoyageEncounterState(result.nextState).valid, true);
  assert.notStrictEqual(result.nextState.activeHazards, source.activeHazards);
  assert.notStrictEqual(result.nextState.activeHazards[0], source.activeHazards[0]);
  assert.notStrictEqual(result.nextState.activeHazards[2], result.events[0].hazard);
  assert.equal(result.nextState.pressureSystems["crew-morale"].value, 0);
  assert.equal(result.nextState.pressureSystems.arkengine.value, source.pressureSystems.arkengine.value);
});

test("persists the deterministic Hazard identity and provenance through the Task 1 capture boundary", () => {
  const source = breachState();
  const planned = analyzeVoyageEncounterPressureBreachHazardPlan(source);
  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, true);
  const persisted = result.nextState.activeHazards[0];
  assert.equal(persisted.hazardId, planned.hazard.hazardId);
  for (const key of [
    "pressureBreachId",
    "encounterId",
    "pressureSystemId",
    "pressureEffectId",
    "sourceIntentId",
    "stationId",
    "actionId",
    "activationSource",
    "branch"
  ]) {
    assert.equal(persisted[key], planned.hazard[key], key);
  }
  assert.equal(persisted.createdStageId, planned.hazard.stageId);
  assert.equal(persisted.createdRoundNumber, planned.hazard.roundNumber);
  assert.equal(persisted.createdSequence, planned.hazard.sequence);
  assert.equal(persisted.sourceTiming, planned.hazard.timing);
  assert.equal(persisted.sourceVisibility, planned.hazard.visibility);
  assert.equal(persisted.eventAreaId, null);
  assert.equal(persisted.replacedByHazardId, null);
  assert.equal(persisted.terminalReason, null);
});

test("keeps the exact single Pressure Breach event, Void Scar proposal, and one revision", () => {
  const source = breachState();
  const before = structuredClone(source);
  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, true);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, "voyage.pressure-breach-applied");
  assert.equal(result.events.some(({ type }) => type === "voyage.hazard-created"), false);
  assert.equal(result.nextState.revision, before.revision + 1);
  assert.equal(result.events[0].previousRevision, before.revision);
  assert.equal(result.events[0].revision, before.revision + 1);
  assert.equal(result.events[0].voidScarProposal.status, "proposed");
  assert.equal(result.events[0].voidScarProposal.hazardId, result.nextState.activeHazards[0].hazardId);
  assert.deepEqual(Object.keys(result.events[0]), PRESSURE_BREACH_EVENT_KEYS);
  assert.equal(result.events[0].collisionOutcome, null);
});

test("isolates input, prior Hazards, the new Hazard, and nested authored data", () => {
  const sourceHazard = hazard({
    metadata: { collision: { targetStageId: "pressure-breach-stage" }, nested: { values: [1] } },
    currentEffect: { effectId: "existing-effect", nested: { values: [1] } }
  });
  const source = breachState();
  source.activeHazards = [sourceHazard];
  const before = structuredClone(source);
  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, true);
  result.nextState.activeHazards[0].metadata.nested.values[0] = 2;
  result.nextState.activeHazards[0].currentEffect.nested.values[0] = 2;
  result.nextState.activeHazards[1].metadata.collision.consequence.description = "changed";
  result.events[0].hazard.name = "changed";
  result.events[0].voidScarProposal.name = "changed";
  assert.deepEqual(source, before);
  assert.equal(sourceHazard.metadata.nested.values[0], 1);
  assert.equal(sourceHazard.currentEffect.nested.values[0], 1);
  assert.equal(result.nextState.activeHazards[0].metadata.collision.targetStageId, "pressure-breach-stage");
  assert.equal(result.nextState.activeHazards[1].metadata.collision.consequence.description, "changed");
  assert.equal(result.events[0].hazard.name, "changed");
});

test("rejects a duplicate deterministic hazardId atomically", () => {
  const source = breachState();
  const planned = analyzeVoyageEncounterPressureBreachHazardPlan(source);
  source.activeHazards = [hazard({
    hazardId: planned.hazard.hazardId,
    pressureSystemId: "arkengine",
    failurePressureSystemId: "arkengine"
  })];
  const before = structuredClone(source);

  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.ok(issueCodes(result).includes("duplicate-hazard-id"));
  assert.deepEqual(source, before);
});

test("rejects an occupied system slot without an authored repeated-breach consequence", () => {
  const source = breachState();
  source.activeHazards = [hazard({
    hazardId: "same-system-hazard",
    pressureSystemId: "crew-morale",
    failurePressureSystemId: "crew-morale"
  })];
  const before = structuredClone(source);

  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.ok(issueCodes(result).includes("pressure-breach-application-consequence-invalid"));
  assert.equal(source.pressureSystems["crew-morale"].value, before.pressureSystems["crew-morale"].value);
  assert.equal(source.revision, before.revision);
  assert.deepEqual(source, before);
});

for (const pressureSystemId of [
  "crew-morale",
  "arkengine",
  "levstone-array",
  "solar-sail-rig",
  "lifeveil"
]) {
  test(`repeated ${pressureSystemId} breach triggers the existing consequence without persisting the incoming Hazard`, () => {
    const existing = repeatedHazard(pressureSystemId);
    const prefix = hazard({
      hazardId: "unrelated-prefix",
      pressureSystemId: pressureSystemId === "crew-morale" ? "arkengine" : "crew-morale",
      failurePressureSystemId: pressureSystemId === "crew-morale" ? "arkengine" : "crew-morale"
    });
    const source = breachState({ pressureSystemId });
    source.activeHazards = [prefix, existing];
    const before = structuredClone(source);
    const result = applyVoyageEncounterPressureBreachPlan(source);
    const ordinary = applyVoyageEncounterPressureBreachPlan(
      breachState({ pressureSystemId })
    );
    const incomingHazardId = result.events[0]?.hazard.hazardId;

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(ordinary.ok, true, JSON.stringify(ordinary));
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].type, "voyage.pressure-breach-applied");
    assert.deepEqual(Object.keys(result.events[0]), PRESSURE_BREACH_EVENT_KEYS);
    assert.deepEqual(Object.keys(result.events[0].collisionOutcome), [
      "kind",
      "hazardId",
      "incomingHazardId",
      "pressureSystemId",
      "collisionPolicy",
      "consequence"
    ]);
    assert.deepEqual(result.events[0].collisionOutcome, {
      kind: "hazard-consequence-triggered",
      hazardId: existing.hazardId,
      incomingHazardId,
      pressureSystemId,
      collisionPolicy: VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE,
      consequence: existing.metadata.collision.consequence
    });
    assert.deepEqual(
      Object.keys(result.events[0].hazard),
      Object.keys(ordinary.events[0].hazard)
    );
    assert.deepEqual(
      result.events[0].voidScarProposal,
      ordinary.events[0].voidScarProposal
    );
    assert.notStrictEqual(
      result.events[0].voidScarProposal,
      ordinary.events[0].voidScarProposal
    );
    assert.deepEqual(result.events[0].effects, ordinary.events[0].effects);
    assert.equal(
      result.events[0].pressureEffectCount,
      ordinary.events[0].pressureEffectCount
    );
    assert.equal(
      result.events[0].appliedEffectCount,
      ordinary.events[0].appliedEffectCount
    );
    assert.equal(result.events.some(({ type }) => type === "voyage.hazard-created"), false);
    assert.equal(result.events.some(({ type }) => type.includes("consequence")), false);
    assert.deepEqual(result.nextState.activeHazards.map(({ hazardId }) => hazardId), [
      prefix.hazardId,
      existing.hazardId
    ]);
    assert.equal(result.nextState.activeHazards.length, before.activeHazards.length);
    assert.deepEqual(result.nextState.activeHazards[1], existing);
    assert.equal(result.nextState.activeHazards.some(({ hazardId }) => hazardId === incomingHazardId), false);
    assert.deepEqual(Object.keys(result.events[0].hazard), [
      "hazardId",
      "pressureBreachId",
      "encounterId",
      "stageId",
      "roundNumber",
      "effectIndex",
      "sequence",
      "stationId",
      "actionId",
      "pressureSystemId",
      "category",
      "status",
      "sourceKind",
      "pressureEffectId",
      "sourceIntentId",
      "activationSource",
      "branch",
      "timing",
      "visibility",
      "name"
    ]);
    assert.equal(Object.hasOwn(result.events[0].hazard, "metadata"), false);
    assert.equal(Object.hasOwn(result.events[0].hazard, "collision"), false);
    assert.equal(Object.hasOwn(result.events[0].hazard, "consequence"), false);
    assert.equal(Object.hasOwn(result.events[0].hazard, "collisionOutcome"), false);
    assert.equal(result.nextState.revision, before.revision + 1);
    assert.equal(result.events[0].previousRevision, before.revision);
    assert.equal(result.events[0].revision, before.revision + 1);
    // All inputs and the only permitted mutations are validated: the
    // existing active-Hazard collection is preserved, the breached Pressure
    // value is bounded, and revision increments within the safe-integer
    // range. The final canonical state validator must therefore accept every
    // generated repeated candidate across all five Pressure systems.
    assert.equal(validateVoyageEncounterState(result.nextState).valid, true);
    assert.equal(result.events[0].voidScarProposal.status, "proposed");
    assert.equal(result.events[0].voidScarProposal.hazardId, incomingHazardId);

    for (const [systemId, pressure] of Object.entries(before.pressureSystems)) {
      const expected = systemId === pressureSystemId ? 0 : pressure.value;
      assert.equal(result.nextState.pressureSystems[systemId].value, expected, systemId);
    }

    result.events[0].collisionOutcome.consequence.name = "changed-event";
    result.events[0].voidScarProposal.name = "changed-event";
    assert.equal(result.nextState.activeHazards[1].metadata.collision.consequence.name, existing.metadata.collision.consequence.name);
    assert.equal(result.events[0].collisionOutcome.consequence.name, "changed-event");
    assert.deepEqual(source, before);
  });
}

test("another-system active Hazards do not collide with a Pressure breach", () => {
  const source = breachState({ pressureSystemId: "crew-morale" });
  const existing = repeatedHazard("arkengine");
  source.activeHazards = [existing];

  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.activeHazards.map(({ hazardId }) => hazardId), [
    existing.hazardId,
    result.events[0].hazard.hazardId
  ]);
  assert.equal(result.events[0].collisionOutcome, null);
  for (const key of ["metadata", "collision", "consequence", "collisionOutcome"]) {
    assert.equal(Object.hasOwn(result.events[0].hazard, key), false, `event.hazard.${key}`);
  }
});

test("repeated breach revision overflow fails atomically", () => {
  const source = breachState();
  source.activeHazards = [repeatedHazard("crew-morale")];
  source.revision = Number.MAX_SAFE_INTEGER;
  const before = structuredClone(source);

  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.equal(Object.hasOwn(result, "collisionOutcome"), false);
  assert.ok(issueCodes(result).includes("pressure-breach-application-candidate-invalid"));
  assert.deepEqual(source, before);
});

test("equivalent repeated breaches are deterministic and separately isolated", () => {
  const apply = () => {
    const source = breachState({ pressureSystemId: "crew-morale" });
    source.activeHazards = [repeatedHazard("crew-morale")];
    return applyVoyageEncounterPressureBreachPlan(source);
  };

  const first = apply();
  const second = apply();

  assert.deepEqual(first, second);
  assert.notStrictEqual(first.nextState, second.nextState);
  assert.notStrictEqual(first.nextState.activeHazards, second.nextState.activeHazards);
  assert.notStrictEqual(first.events[0], second.events[0]);
  assert.notStrictEqual(first.events[0].hazard, second.events[0].hazard);
  assert.notStrictEqual(first.events[0].collisionOutcome, second.events[0].collisionOutcome);
  assert.notStrictEqual(
    first.events[0].collisionOutcome.consequence,
    second.events[0].collisionOutcome.consequence
  );
  first.events[0].collisionOutcome.consequence.name = "changed-first";
  assert.equal(second.events[0].collisionOutcome.consequence.name, "crew-morale Authored Repeat");
});

test("event Hazards sharing failurePressureSystemId do not occupy the system slot", () => {
  const source = breachState();
  source.activeHazards = [hazard({
    hazardId: "matching-event-hazard",
    category: VOYAGE_HAZARD_CATEGORIES.EVENT,
    pressureSystemId: null,
    eventAreaId: "engine-room",
    failurePressureSystemId: "crew-morale"
  })];

  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.activeHazards.map(({ hazardId }) => hazardId), [
    "matching-event-hazard",
    result.events[0].hazard.hazardId
  ]);
});

test("invalid activeHazards state fails before Pressure Breach application", () => {
  const source = breachState();
  source.activeHazards = { invalid: true };
  const before = structuredClone(source);

  const result = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.ok(issueCodes(result).includes("invalid-active-hazards-collection"));
  assert.deepEqual(source, before);
});

test("repeated application from the same state is deterministic and does not process a removed or persisted Hazard twice", () => {
  const source = breachState();
  const first = applyVoyageEncounterPressureBreachPlan(source);
  const second = applyVoyageEncounterPressureBreachPlan(source);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.equal(first.nextState.activeHazards.length, 1);
  const repeated = applyVoyageEncounterPressureBreachPlan(first.nextState);
  assert.equal(repeated.ok, false);
  assert.equal(repeated.nextState, null);
  assert.ok(issueCodes(repeated).includes("pressure-breach-application-not-required"));
});

test("Hazard capture reports a terminal or malformed planned record without returning a record", () => {
  const source = breachState();
  const planned = analyzeVoyageEncounterPressureBreachHazardPlan(source).hazard;
  const terminal = {
    ...planned,
    status: "expired"
  };
  const malformed = {
    ...planned,
    status: "active",
    hazardId: ""
  };

  const terminalCapture = captureVoyageHazardRecord(terminal, {
    mode: "active",
    expectedEncounterId: source.encounterId
  });
  const malformedCapture = captureVoyageHazardRecord(malformed, {
    mode: "active",
    expectedEncounterId: source.encounterId
  });

  assert.equal(terminalCapture.ok, false);
  assert.equal(terminalCapture.record, null);
  assert.equal(malformedCapture.ok, false);
  assert.equal(malformedCapture.record, null);
});
