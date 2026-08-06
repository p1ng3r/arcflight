import assert from "node:assert/strict";
import test from "node:test";

import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../../../scripts/voyage/domain/constants.js";
import {
  analyzeVoyageCatastrophicBreakdown,
  captureVoyageCatastrophicBreakdownDefinition,
  validateVoyageCatastrophicBreakdownDefinition
} from "../../../scripts/voyage/domain/catastrophic-breakdown.js";

const SYSTEM_IDS = [...VOYAGE_PRESSURE_SYSTEM_IDS];
const CONSEQUENCE_KINDS = ["strand", "diversion", "disablement", "loss"];
const TRANSITION_KINDS = ["retreat", "diversion", "emergency", "capture", "delay", "repair", "authored"];
const ROUND_COUNTS = [3, 5, 7, 9, 11];
const DEFINITION_FIELDS = ["schemaVersion", "breakdownDefinitionId", "systemId", "systemKind", "title", "description", "catastrophicHazard", "pausePlan", "emergencyResponseDefinition"];
const RESPONSE_FIELDS = ["schemaVersion", "emergencyResponseDefinitionId", "breakdownDefinitionId", "systemId", "systemKind", "title", "description", "roundCount", "rounds", "stabilizationOutcome", "failureConsequences", "nextSituations"];
const CAPACITY_FIELDS = ["kind", "eventId", "sessionId", "definitionSnapshotId", "shipId", "systemId", "systemKind", "liveRevision", "scarCapacity", "occupiedScarCount", "incomingScarProposalId", "incomingScarProposalKind", "incomingScarProposalStatus"];
const PLAN_FIELDS = ["systemDisablement", "catastrophicHazard", "pausePlan", "emergencyResponseDefinitionId", "scarApplication", "capacityExhaustion"];

function hazard(systemId = "crew-morale", overrides = {}) {
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
    escalation: { mode: "none", currentStageId: null, stages: [], countdown: null, maximumEscalationReached: false, escalationConsequence: null },
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

function response({ systemId = "crew-morale", breakdownDefinitionId = "breakdown-1", roundCount = 3, rounds, consequenceKind = "strand", nextSituationId = "next-1", transitionKind = "emergency", overrides = {} } = {}) {
  const authoredRounds = rounds ?? Array.from({ length: roundCount }, (_, index) => ({ roundId: `round-${index + 1}`, roundNumber: index + 1 }));
  return {
    schemaVersion: 1,
    emergencyResponseDefinitionId: "response-1",
    breakdownDefinitionId,
    systemId,
    systemKind: "pressure-system",
    title: "Emergency response",
    description: "An authored emergency response.",
    roundCount,
    rounds: authoredRounds,
    stabilizationOutcome: { outcomeId: "stabilized-1", title: "Stabilized", description: "The response stabilizes the ship.", nextSituationId },
    failureConsequences: [{ consequenceId: "failure-1", kind: consequenceKind, title: "Failure", description: "The response fails.", nextSituationId }],
    nextSituations: [{ nextSituationId, title: "Next situation", summary: "The voyage continues.", transitionKind }],
    ...overrides
  };
}

function definition({ systemId = "crew-morale", responseOverrides = {}, hazardOverrides = {}, overrides = {} } = {}) {
  return {
    schemaVersion: 1,
    breakdownDefinitionId: "breakdown-1",
    systemId,
    systemKind: "pressure-system",
    title: "Catastrophic Breakdown",
    description: "An authored catastrophic breakdown.",
    catastrophicHazard: hazard(systemId, hazardOverrides),
    pausePlan: { timing: "after-current-segment", resumeCondition: "emergency-response-resolved" },
    emergencyResponseDefinition: response({ systemId, overrides: responseOverrides }),
    ...overrides
  };
}

function capacityExhaustion({
  kind = "voyage.m10-capacity-exhaustion",
  eventId = "event-1",
  sessionId = "session-1",
  definitionSnapshotId = "breakdown-snapshot-1",
  shipId = "ship-1",
  systemId = "crew-morale",
  systemKind = "pressure-system",
  liveRevision = 7,
  scarCapacity = 2,
  occupiedScarCount = 2,
  incomingScarProposalId = "scar-proposal-1",
  incomingScarProposalKind = "ordinary-void-scar",
  incomingScarProposalStatus = "approved-unapplied",
  overrides = {}
} = {}) {
  return {
    kind,
    eventId,
    sessionId,
    definitionSnapshotId,
    shipId,
    systemId,
    systemKind,
    liveRevision,
    scarCapacity,
    occupiedScarCount,
    incomingScarProposalId,
    incomingScarProposalKind,
    incomingScarProposalStatus,
    ...overrides
  };
}

function breakdownRequest({
  kind = "m9-catastrophic-breakdown",
  sessionId = "session-1",
  breakdownDefinition = definition(),
  handoff = capacityExhaustion(),
  extras = {}
} = {}) {
  return {
    kind,
    sessionId,
    breakdownDefinition,
    capacityExhaustion: handoff,
    ...extras
  };
}

function task2Issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function assertValid(value) {
  const validation = validateVoyageCatastrophicBreakdownDefinition(value);
  assert.deepEqual(
    Object.keys(validation),
    ["valid", "errors", "warnings"]
  );
  assert.deepEqual(validation, { valid: true, errors: [], warnings: [] });
  const capture = captureVoyageCatastrophicBreakdownDefinition(value);
  assert.equal(capture.ok, true, JSON.stringify(capture.errors));
  assert.deepEqual(Object.keys(capture), ["ok", "breakdownDefinition", "errors", "warnings"]);
  assert.deepEqual(capture.errors, []);
  assert.deepEqual(capture.warnings, []);
  return capture.breakdownDefinition;
}

function assertIssue(value, expected, label = undefined) {
  const validation = validateVoyageCatastrophicBreakdownDefinition(value);
  assert.deepEqual(
    Object.keys(validation),
    ["valid", "errors", "warnings"],
    label
  );
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.errors, [expected], label);
  assert.deepEqual(validation.warnings, [], label);
  const capture = captureVoyageCatastrophicBreakdownDefinition(value);
  assert.deepEqual(
    Object.keys(capture),
    ["ok", "breakdownDefinition", "errors", "warnings"],
    label
  );
  assert.deepEqual(capture, { ok: false, breakdownDefinition: null, errors: [expected], warnings: [] }, label);
}

const hostileIssue = { code: "m9-hostile-data-capture-failed", path: "$", message: "Milestone 9 data could not be captured safely.", severity: "error" };
const definitionIssue = { code: "m9-invalid-breakdown-definition", path: "breakdownDefinition", message: "Catastrophic Breakdown Definition is invalid.", severity: "error" };
const hazardIssue = { code: "m9-invalid-catastrophic-hazard", path: "breakdownDefinition.catastrophicHazard", message: "Catastrophic Hazard is not a valid M6 Hazard with the required M9 restrictions.", severity: "error" };
const responseIssue = { code: "m9-invalid-emergency-response-definition", path: "breakdownDefinition.emergencyResponseDefinition", message: "Emergency Response Definition is invalid.", severity: "error" };
const duplicateIssue = (path) => ({ code: "m9-duplicate-definition-identity", path, message: "Authored Milestone 9 definition identities must be unique.", severity: "error" });
const unresolvedIssue = (path) => ({ code: "m9-unresolved-definition-reference", path, message: "Authored Milestone 9 definition reference is unresolved.", severity: "error" });

test("exports the Task 1 APIs and the Task 2 analyzer only", async () => {
  const module = await import("../../../scripts/voyage/domain/catastrophic-breakdown.js");
  assert.deepEqual(Object.keys(module).sort(), [
    "analyzeVoyageCatastrophicBreakdown",
    "captureVoyageCatastrophicBreakdownDefinition",
    "validateVoyageCatastrophicBreakdownDefinition"
  ].sort());
});

test("accepts every canonical system and supported round count", () => {
  for (const systemId of SYSTEM_IDS) assertValid(definition({ systemId }));
  for (const roundCount of ROUND_COUNTS) assertValid(definition({ responseOverrides: { roundCount, rounds: Array.from({ length: roundCount }, (_, index) => ({ roundId: `round-${index + 1}`, roundNumber: index + 1 })) } }));
});

test("accepts every failure consequence and transition kind", () => {
  for (const kind of CONSEQUENCE_KINDS) assertValid(definition({ responseOverrides: { failureConsequences: [{ consequenceId: "failure-1", kind, title: "Failure", description: "The response fails.", nextSituationId: "next-1" }] } }));
  for (const transitionKind of TRANSITION_KINDS) assertValid(definition({ responseOverrides: { nextSituations: [{ nextSituationId: "next-1", title: "Next situation", summary: "The voyage continues.", transitionKind }] } }));
});

test("returns exact success envelopes and canonical key orders", () => {
  const captured = assertValid(definition());
  assert.deepEqual(Object.keys(captured), DEFINITION_FIELDS);
  assert.deepEqual(Object.keys(captured.pausePlan), ["timing", "resumeCondition"]);
  assert.deepEqual(Object.keys(captured.emergencyResponseDefinition), RESPONSE_FIELDS);
  assert.deepEqual(Object.keys(captured.emergencyResponseDefinition.rounds[0]), ["roundId", "roundNumber"]);
  assert.deepEqual(Object.keys(captured.emergencyResponseDefinition.stabilizationOutcome), ["outcomeId", "title", "description", "nextSituationId"]);
  assert.deepEqual(Object.keys(captured.emergencyResponseDefinition.failureConsequences[0]), ["consequenceId", "kind", "title", "description", "nextSituationId"]);
  assert.deepEqual(Object.keys(captured.emergencyResponseDefinition.nextSituations[0]), ["nextSituationId", "title", "summary", "transitionKind"]);
});

test("rejects wrong roots and exact root-shape violations", () => {
  for (const value of [null, "invalid", 42, [], true]) assertIssue(value, definitionIssue);
  const missing = definition(); delete missing.description; assertIssue(missing, definitionIssue);
  assertIssue({ ...definition(), extra: true }, definitionIssue);
  const reordered = definition(); const reorderedRoot = {}; for (const key of [...DEFINITION_FIELDS].reverse()) reorderedRoot[key] = reordered[key]; assertIssue(reorderedRoot, definitionIssue);
});

test("rejects root field, system, and pause-plan violations", () => {
  for (const [key, value] of [["schemaVersion", 2], ["systemKind", "wrong"], ["title", " "], ["description", " padded "]]) assertIssue(definition({ overrides: { [key]: value } }), definitionIssue);
  assertIssue(definition({ overrides: { breakdownDefinitionId: " padded " }, responseOverrides: { breakdownDefinitionId: " padded " } }), definitionIssue);
  const invalidSystem = definition({ overrides: { systemId: "unknown" }, responseOverrides: { systemId: "unknown" }, hazardOverrides: { pressureSystemId: "unknown", failurePressureSystemId: "unknown" } });
  assert.deepEqual(validateVoyageCatastrophicBreakdownDefinition(invalidSystem).errors, [definitionIssue, hazardIssue]);
  for (const pausePlan of [{ timing: "wrong", resumeCondition: "emergency-response-resolved" }, { timing: "after-current-segment" }, { timing: "after-current-segment", resumeCondition: "emergency-response-resolved", extra: true }]) assertIssue(definition({ overrides: { pausePlan } }), definitionIssue);
});

test("rejects Emergency Response schema and binding violations", () => {
  for (const responseOverrides of [{ schemaVersion: 2 }, { breakdownDefinitionId: "wrong" }, { systemId: "wrong" }, { systemKind: "wrong" }, { roundCount: 4 }, { rounds: [] }, { rounds: [{ roundId: "round-1", roundNumber: 1 }] }, { nextSituations: [] }, { nextSituations: [{ nextSituationId: "next-1", title: "", summary: "x", transitionKind: "emergency" }] }]) assertIssue(definition({ responseOverrides }), responseIssue);
});

test("rejects round shape, density, ordering, and duplicate identities", () => {
  assert.deepEqual(validateVoyageCatastrophicBreakdownDefinition(definition({ responseOverrides: { rounds: [{ roundId: "round-1", roundNumber: 1 }, { roundId: "round-1", roundNumber: 2 }, { roundId: "round-3", roundNumber: 3 }] } })).errors, [duplicateIssue("breakdownDefinition.emergencyResponseDefinition.rounds[1].roundId")]);
  assertIssue(definition({ responseOverrides: { rounds: [{ roundId: "round-1", roundNumber: 2 }, { roundId: "round-2", roundNumber: 2 }, { roundId: "round-3", roundNumber: 3 }] } }), responseIssue);
  assertIssue(definition({ responseOverrides: { rounds: [{ roundId: "round-1", roundNumber: 1 }, { roundId: "round-2" }, { roundId: "round-3", roundNumber: 3 }] } }), responseIssue);
  const duplicate = definition({ responseOverrides: { emergencyResponseDefinitionId: "breakdown-1" } });
  assert.deepEqual(validateVoyageCatastrophicBreakdownDefinition(duplicate).errors, [duplicateIssue("breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId")]);
});

test("rejects stabilization, consequence, and next-situation shape violations", () => {
  assertIssue(definition({ responseOverrides: { stabilizationOutcome: { outcomeId: "x", title: "x", description: "x" } } }), responseIssue);
  assertIssue(definition({ responseOverrides: { failureConsequences: [] } }), responseIssue);
  assertIssue(definition({ responseOverrides: { failureConsequences: [{ consequenceId: "x", kind: "custom", title: "x", description: "x", nextSituationId: "next-1" }] } }), responseIssue);
  assertIssue(definition({ responseOverrides: { nextSituations: [{ nextSituationId: "next-1", title: "x", summary: "x", transitionKind: "custom" }] } }), responseIssue);
});

test("rejects every M9 Hazard restriction while preserving M6 validation", () => {
  for (const [key, value] of [["category", "event"], ["status", "resolved"], ["pressureSystemId", "arkengine"], ["failurePressureSystemId", "arkengine"], ["eventAreaId", "area"], ["sourceKind", "pressure-breach"], ["collisionPolicy", "replace-existing"], ["encounterId", ""]]) assertIssue(definition({ hazardOverrides: { [key]: value } }), hazardIssue);
  assertIssue(definition({ hazardOverrides: { metadata: { collision: { consequence: {} } } } }), hazardIssue);
  assertIssue(definition({ hazardOverrides: { metadata: { collision: {} } } }), hazardIssue);
  assertIssue(definition({ hazardOverrides: { createdRoundNumber: 0 } }), hazardIssue);
});

test("rejects padded strings anywhere in the Catastrophic Hazard", () => {
  assertValid(definition());

  const cases = [
    {
      label: "padded hazard ID",
      mutate(value) {
        value.catastrophicHazard.hazardId = " hazard-1 ";
      }
    },
    {
      label: "padded Hazard name",
      mutate(value) {
        value.catastrophicHazard.name = " Catastrophic Failure ";
      }
    },
    {
      label: "padded created-stage ID",
      mutate(value) {
        value.catastrophicHazard.createdStageId = " stage-1 ";
      }
    },
    {
      label: "padded provenance string",
      mutate(value) {
        value.catastrophicHazard.sourceIntentId = " provenance ";
      }
    },
    {
      label: "padded nested descriptive string",
      mutate(value) {
        value.catastrophicHazard.metadata.collision.consequence = {
          ...value.catastrophicHazard.metadata.collision.consequence,
          consequenceId: " consequence "
        };
      }
    }
  ];

  for (const { label, mutate } of cases) {
    const value = definition();
    mutate(value);
    if (label === "padded nested descriptive string") {
      assert.equal(
        value.catastrophicHazard.currentEffect.consequenceId,
        "descriptive-consequence",
        "nested collision mutation must not alter currentEffect"
      );
      assert.equal(
        value.catastrophicHazard.ignoredConsequence.consequenceId,
        "descriptive-consequence",
        "nested collision mutation must not alter ignoredConsequence"
      );
      assert.notStrictEqual(
        value.catastrophicHazard.metadata.collision.consequence,
        value.catastrophicHazard.currentEffect,
        "nested collision consequence must be independently mutated"
      );
      assert.notStrictEqual(
        value.catastrophicHazard.metadata.collision.consequence,
        value.catastrophicHazard.ignoredConsequence,
        "nested collision consequence must be independently mutated"
      );
    }
    assertIssue(value, hazardIssue, label);
  }
});

test("rejects reordered M6 Hazard fields", () => {
  const value = definition();
  const reordered = {};

  for (const key of [...Object.keys(value.catastrophicHazard)].reverse()) {
    reordered[key] = value.catastrophicHazard[key];
  }

  value.catastrophicHazard = reordered;

  assertIssue(value, hazardIssue);
});

test("reports duplicate identities in the fixed authored order", () => {
  const duplicateRounds = definition({ responseOverrides: { rounds: [{ roundId: "same", roundNumber: 1 }, { roundId: "same", roundNumber: 2 }, { roundId: "round-3", roundNumber: 3 }] } });
  assert.deepEqual(validateVoyageCatastrophicBreakdownDefinition(duplicateRounds).errors, [duplicateIssue("breakdownDefinition.emergencyResponseDefinition.rounds[1].roundId")]);
  const duplicateOutcome = definition({ responseOverrides: { stabilizationOutcome: { outcomeId: "breakdown-1", title: "x", description: "x", nextSituationId: "next-1" } } });
  assert.deepEqual(validateVoyageCatastrophicBreakdownDefinition(duplicateOutcome).errors, [duplicateIssue("breakdownDefinition.emergencyResponseDefinition.stabilizationOutcome.outcomeId")]);
  const duplicateConsequence = definition({ responseOverrides: { failureConsequences: [{ consequenceId: "breakdown-1", kind: "strand", title: "x", description: "x", nextSituationId: "next-1" }] } });
  assert.deepEqual(validateVoyageCatastrophicBreakdownDefinition(duplicateConsequence).errors, [duplicateIssue("breakdownDefinition.emergencyResponseDefinition.failureConsequences[0].consequenceId")]);
  const duplicateNext = definition({ responseOverrides: { stabilizationOutcome: { outcomeId: "outcome-1", title: "x", description: "x", nextSituationId: "breakdown-1" }, failureConsequences: [{ consequenceId: "failure-1", kind: "strand", title: "x", description: "x", nextSituationId: "breakdown-1" }], nextSituations: [{ nextSituationId: "breakdown-1", title: "x", summary: "x", transitionKind: "emergency" }] } });
  assert.deepEqual(validateVoyageCatastrophicBreakdownDefinition(duplicateNext).errors, [duplicateIssue("breakdownDefinition.emergencyResponseDefinition.nextSituations[0].nextSituationId")]);
});

test("reports both unresolved references in fixed order and deduplicates exact tuples", () => {
  const invalid = definition({ responseOverrides: { stabilizationOutcome: { outcomeId: "outcome-1", title: "x", description: "x", nextSituationId: "missing-a" }, failureConsequences: [{ consequenceId: "failure-1", kind: "strand", title: "x", description: "x", nextSituationId: "missing-b" }] } });
  assert.deepEqual(validateVoyageCatastrophicBreakdownDefinition(invalid).errors, [
    unresolvedIssue("breakdownDefinition.emergencyResponseDefinition.stabilizationOutcome.nextSituationId"),
    unresolvedIssue("breakdownDefinition.emergencyResponseDefinition.failureConsequences[0].nextSituationId")
  ]);
});

test("keeps embedded-NUL identities exact", () => {
  const valid = definition({
    overrides: {
      breakdownDefinitionId: "breakdown\u0000id"
    },
    responseOverrides: {
      breakdownDefinitionId: "breakdown\u0000id",
      emergencyResponseDefinitionId: "response\u0000id"
    }
  });

  assertValid(valid);

  const duplicate = definition({
    overrides: {
      breakdownDefinitionId: "same\u0000id"
    },
    responseOverrides: {
      breakdownDefinitionId: "same\u0000id",
      emergencyResponseDefinitionId: "same\u0000id"
    }
  });

  assert.deepEqual(
    validateVoyageCatastrophicBreakdownDefinition(duplicate).errors,
    [
      duplicateIssue(
        "breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId"
      )
    ]
  );
});

test("rejects missing, extra, and reordered nested descriptor keys", () => {
  const cases = [
    {
      label: "round missing key",
      make() {
        const value = definition();
        delete value.emergencyResponseDefinition.rounds[0].roundNumber;
        return value;
      }
    },
    {
      label: "round extra key",
      make() {
        const value = definition();
        value.emergencyResponseDefinition.rounds[0].extra = true;
        return value;
      }
    },
    {
      label: "round reordered keys",
      make() {
        const value = definition();
        const round = value.emergencyResponseDefinition.rounds[0];

        value.emergencyResponseDefinition.rounds[0] = {
          roundNumber: round.roundNumber,
          roundId: round.roundId
        };

        return value;
      }
    },
    {
      label: "stabilization outcome missing key",
      make() {
        const value = definition();
        delete value.emergencyResponseDefinition
          .stabilizationOutcome.nextSituationId;
        return value;
      }
    },
    {
      label: "failure consequence extra key",
      make() {
        const value = definition();
        value.emergencyResponseDefinition
          .failureConsequences[0].extra = true;
        return value;
      }
    },
    {
      label: "next situation reordered keys",
      make() {
        const value = definition();
        const next =
          value.emergencyResponseDefinition.nextSituations[0];

        value.emergencyResponseDefinition.nextSituations[0] = {
          transitionKind: next.transitionKind,
          nextSituationId: next.nextSituationId,
          title: next.title,
          summary: next.summary
        };

        return value;
      }
    }
  ];

  for (const { label, make } of cases) {
    assertIssue(make(), responseIssue, label);
  }
});

test("rejects the remaining malformed nested descriptor shapes", () => {
  const cases = [
    {
      label: "pause plan reordered keys",
      expected: definitionIssue,
      make() {
        const value = definition();
        const pause = value.pausePlan;

        value.pausePlan = {
          resumeCondition: pause.resumeCondition,
          timing: pause.timing
        };

        return value;
      }
    },
    {
      label: "response root missing key",
      expected: responseIssue,
      make() {
        const value = definition();
        delete value.emergencyResponseDefinition.description;
        return value;
      }
    },
    {
      label: "response root extra key",
      expected: responseIssue,
      make() {
        const value = definition();
        value.emergencyResponseDefinition.extra = true;
        return value;
      }
    },
    {
      label: "response root reordered keys",
      expected: responseIssue,
      make() {
        const value = definition();
        const response = value.emergencyResponseDefinition;

        value.emergencyResponseDefinition = {
          emergencyResponseDefinitionId:
            response.emergencyResponseDefinitionId,
          schemaVersion: response.schemaVersion,
          breakdownDefinitionId: response.breakdownDefinitionId,
          systemId: response.systemId,
          systemKind: response.systemKind,
          title: response.title,
          description: response.description,
          roundCount: response.roundCount,
          rounds: response.rounds,
          stabilizationOutcome: response.stabilizationOutcome,
          failureConsequences: response.failureConsequences,
          nextSituations: response.nextSituations
        };

        return value;
      }
    },
    {
      label: "stabilization outcome extra key",
      expected: responseIssue,
      make() {
        const value = definition();
        value.emergencyResponseDefinition
          .stabilizationOutcome.extra = true;
        return value;
      }
    },
    {
      label: "stabilization outcome reordered keys",
      expected: responseIssue,
      make() {
        const value = definition();
        const outcome =
          value.emergencyResponseDefinition.stabilizationOutcome;

        value.emergencyResponseDefinition.stabilizationOutcome = {
          title: outcome.title,
          outcomeId: outcome.outcomeId,
          description: outcome.description,
          nextSituationId: outcome.nextSituationId
        };

        return value;
      }
    },
    {
      label: "failure consequence missing key",
      expected: responseIssue,
      make() {
        const value = definition();
        delete value.emergencyResponseDefinition
          .failureConsequences[0].description;
        return value;
      }
    },
    {
      label: "failure consequence reordered keys",
      expected: responseIssue,
      make() {
        const value = definition();
        const consequence =
          value.emergencyResponseDefinition.failureConsequences[0];

        value.emergencyResponseDefinition.failureConsequences[0] = {
          kind: consequence.kind,
          consequenceId: consequence.consequenceId,
          title: consequence.title,
          description: consequence.description,
          nextSituationId: consequence.nextSituationId
        };

        return value;
      }
    },
    {
      label: "next situation missing key",
      expected: responseIssue,
      make() {
        const value = definition();
        delete value.emergencyResponseDefinition
          .nextSituations[0].summary;
        return value;
      }
    },
    {
      label: "next situation extra key",
      expected: responseIssue,
      make() {
        const value = definition();
        value.emergencyResponseDefinition
          .nextSituations[0].extra = true;
        return value;
      }
    }
  ];

  for (const { label, expected, make } of cases) {
    assertIssue(make(), expected, label);
  }
});

test("rejects hostile roots and nested values with one sanitized diagnostic", () => {
  const hostileValues = [undefined, Symbol("x"), 1n, NaN, Infinity, () => {}, new Date(), new Map(), new Set()];
  for (const value of hostileValues) assertIssue(value, hostileIssue);
  const nestedUndefined = definition(); nestedUndefined.description = undefined; assertIssue(nestedUndefined, hostileIssue);
  const getter = definition(); Object.defineProperty(getter, "title", { enumerable: true, get() { throw new Error("secret"); } }); assertIssue(getter, hostileIssue);
  const setter = definition(); Object.defineProperty(setter, "title", { enumerable: true, set() {} }); assertIssue(setter, hostileIssue);
  const symbolKey = definition(); Object.defineProperty(symbolKey, Symbol("hostile"), { enumerable: true, value: true }); assertIssue(symbolKey, hostileIssue);
  const inherited = Object.assign(Object.create({ inheritedField: true }), definition()); assertIssue(inherited, hostileIssue);
  const unsafe = definition(); Object.defineProperty(unsafe.catastrophicHazard.metadata.collision.consequence, "__proto__", { enumerable: true, value: true }); assertIssue(unsafe, hostileIssue);
  const sparse = definition(); delete sparse.emergencyResponseDefinition.rounds[1]; assertIssue(sparse, hostileIssue);
  const extraArrayKey = definition(); extraArrayKey.emergencyResponseDefinition.rounds.extra = true; assertIssue(extraArrayKey, hostileIssue);
  const nonEnumerable = definition(); Object.defineProperty(nonEnumerable.emergencyResponseDefinition.rounds[0], "hidden", { enumerable: false, value: true }); assertIssue(nonEnumerable, hostileIssue);
  const reflection = definition(); reflection.emergencyResponseDefinition.rounds[0] = new Proxy(reflection.emergencyResponseDefinition.rounds[0], { ownKeys() { throw new Error("trap"); } }); assertIssue(reflection, hostileIssue);
  const revoked = Proxy.revocable(definition(), {}); revoked.revoke(); assertIssue(revoked.proxy, hostileIssue);
});

test("rejects class, document-like, and reflection-hostile values", () => {
  class OrdinaryClass {
    constructor() {
      this.value = 1;
    }
  }

  class FakeFoundryDocument {
    constructor() {
      this.id = "document-1";
      this.documentName = "Actor";
    }
  }

  class FakePf2eDocument {
    constructor() {
      this.id = "actor-1";
      this.system = { hp: 1 };
    }
  }

  const prototypeTrap = new Proxy(
    { value: 1 },
    {
      getPrototypeOf() {
        throw new Error("prototype trap");
      }
    }
  );

  const descriptorTrap = new Proxy(
    { value: 1 },
    {
      getOwnPropertyDescriptor() {
        throw new Error("descriptor trap");
      }
    }
  );

  const cases = [
    {
      label: "ordinary class instance",
      value: new OrdinaryClass()
    },
    {
      label: "Foundry-like document instance",
      value: new FakeFoundryDocument()
    },
    {
      label: "PF2e-like document instance",
      value: new FakePf2eDocument()
    },
    {
      label: "prototype reflection trap",
      value: prototypeTrap
    },
    {
      label: "descriptor reflection trap",
      value: descriptorTrap
    }
  ];

  for (const { label, value } of cases) {
    const hostile = definition();
    hostile.description = value;

    assertIssue(hostile, hostileIssue, label);
  }
});

test("accepts acyclic shared references and isolates every copied occurrence", () => {
  const value = definition();
  const shared = { consequenceId: "shared" };
  value.catastrophicHazard.currentEffect = shared;
  value.catastrophicHazard.ignoredConsequence = shared;
  value.catastrophicHazard.metadata.collision.consequence = shared;
  const captured = assertValid(value);
  assert.notEqual(captured.catastrophicHazard.currentEffect, shared);
  assert.notEqual(captured.catastrophicHazard.currentEffect, captured.catastrophicHazard.ignoredConsequence);
  shared.consequenceId = "mutated";
  captured.catastrophicHazard.currentEffect.consequenceId = "returned-mutation";
  assert.equal(value.catastrophicHazard.currentEffect.consequenceId, "mutated");
  assert.equal(captured.catastrophicHazard.ignoredConsequence.consequenceId, "shared");
});

test("rejects direct and indirect active-ancestor cycles", () => {
  const direct = definition(); direct.catastrophicHazard.currentEffect.loop = direct.catastrophicHazard.currentEffect; assertIssue(direct, hostileIssue);
  const indirect = definition(); const first = {}; const second = {}; first.second = second; second.first = first; indirect.catastrophicHazard.currentEffect = first; assertIssue(indirect, hostileIssue);
});

test("is deterministic and never mutates inputs or shares results", () => {
  const value = definition();
  const before = structuredClone(value);
  const first = assertValid(value);
  const second = assertValid(value);
  assert.deepEqual(first, second);
  assert.deepEqual(value, before);
  first.pausePlan.timing = "mutated";
  assert.equal(second.pausePlan.timing, "after-current-segment");
  assert.equal(value.pausePlan.timing, "after-current-segment");
  const invalid = { ...definition(), schemaVersion: 2 };
  assert.deepEqual(validateVoyageCatastrophicBreakdownDefinition(invalid), validateVoyageCatastrophicBreakdownDefinition(invalid));
});

test("accepts every M7 system, zero capacity, and returns the exact isolated Breakdown envelope", () => {
  for (const systemId of SYSTEM_IDS) {
    const inputDefinition = definition({ systemId });
    const inputHandoff = capacityExhaustion({ systemId, scarCapacity: 0, occupiedScarCount: 0 });
    const result = analyzeVoyageCatastrophicBreakdown(breakdownRequest({
      breakdownDefinition: inputDefinition,
      handoff: inputHandoff
    }));

    assert.deepEqual(Object.keys(result), [
      "ok",
      "readyForCatastrophicBreakdown",
      "eventId",
      "sessionId",
      "definitionSnapshotId",
      "shipId",
      "systemId",
      "systemKind",
      "liveRevision",
      "breakdownDefinitionId",
      "breakdownPlan",
      "requiresGmApproval",
      "errors",
      "warnings"
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.readyForCatastrophicBreakdown, true);
    assert.equal(result.requiresGmApproval, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.systemId, systemId);
    assert.equal(result.breakdownDefinitionId, "breakdown-1");

    const plan = result.breakdownPlan;
    assert.deepEqual(Object.keys(plan), PLAN_FIELDS);
    assert.deepEqual(Object.keys(plan.systemDisablement), ["systemId", "systemKind", "disabled"]);
    assert.deepEqual(plan.systemDisablement, { systemId, systemKind: "pressure-system", disabled: true });
    assert.deepEqual(plan.pausePlan, inputDefinition.pausePlan);
    assert.equal(plan.emergencyResponseDefinitionId, "response-1");
    assert.equal(plan.scarApplication, null);
    assert.deepEqual(Object.keys(plan.capacityExhaustion), CAPACITY_FIELDS);
    assert.deepEqual(plan.capacityExhaustion, inputHandoff);
    assert.deepEqual(plan.catastrophicHazard, inputDefinition.catastrophicHazard);
    assert.notEqual(plan.catastrophicHazard, inputDefinition.catastrophicHazard);
    assert.notEqual(plan.pausePlan, inputDefinition.pausePlan);
    assert.notEqual(plan.capacityExhaustion, inputHandoff);
    assert.equal("scarCreated" in plan, false);
    assert.equal("systemDisabled" in plan, false);
  }
});

test("rejects every prohibited authority key before mode and shape analysis", () => {
  const prohibitedKeys = [
    "approved", "gmApproved", "approval", "gmApproval", "applicationPlan", "nextState",
    "breakdownPlan", "emergencyResponseResult", "outcomeProposal", "persistentChanges",
    "shipUpdate", "hazardApplied", "systemDisabled", "scarCreated", "revisionAfter",
    "requestId", "staleStatus", "duplicateStatus", "capacityAnalysis", "applicationToken"
  ];
  const values = [null, false, 0, "", [], {}];

  for (const key of prohibitedKeys) {
    for (const value of values) {
      const result = analyzeVoyageCatastrophicBreakdown(breakdownRequest({
        extras: { [key]: value }
      }));
      assert.deepEqual(result.errors, [task2Issue(
        "m9-caller-authored-application-rejected",
        `request.${key}`,
        "Caller-authored application or runtime authority is not accepted."
      )], `${key} with ${typeof value}`);
      assert.equal(result.breakdownPlan, null);
    }
  }

  const multiple = analyzeVoyageCatastrophicBreakdown(breakdownRequest({
    extras: { approved: null, breakdownPlan: {}, applicationToken: 0 }
  }));
  assert.deepEqual(multiple.errors, [
    task2Issue("m9-caller-authored-application-rejected", "request.approved", "Caller-authored application or runtime authority is not accepted."),
    task2Issue("m9-caller-authored-application-rejected", "request.breakdownPlan", "Caller-authored application or runtime authority is not accepted."),
    task2Issue("m9-caller-authored-application-rejected", "request.applicationToken", "Caller-authored application or runtime authority is not accepted.")
  ]);
});

test("enforces Task2 mode, exact request shape, and precedence", () => {
  const wrongMode = analyzeVoyageCatastrophicBreakdown(breakdownRequest({ kind: "m9-emergency-response" }));
  assert.deepEqual(wrongMode.errors, [task2Issue(
    "m9-invalid-mode",
    "request.kind",
    "Only the requested Milestone 9 analysis mode is supported."
  )]);

  const extra = analyzeVoyageCatastrophicBreakdown(breakdownRequest({ extras: { extra: true } }));
  assert.deepEqual(extra.errors, [task2Issue(
    "m9-invalid-request-shape",
    "request",
    "Request has an invalid exact shape or field values."
  )]);

  const missing = breakdownRequest();
  delete missing.sessionId;
  const missingResult = analyzeVoyageCatastrophicBreakdown(missing);
  assert.deepEqual(missingResult.errors, [task2Issue(
    "m9-invalid-request-shape",
    "request",
    "Request has an invalid exact shape or field values."
  )]);

  for (const value of [null, "invalid", 42, [], true]) {
    const result = analyzeVoyageCatastrophicBreakdown(value);
    assert.deepEqual(result.errors, [task2Issue(
      "m9-invalid-request-shape",
      "request",
      "Request has an invalid exact shape or field values."
    )]);
  }

  const invalidDefinition = breakdownRequest({ breakdownDefinition: definition({ overrides: { title: " " } }) });
  const definitionResult = analyzeVoyageCatastrophicBreakdown(invalidDefinition);
  assert.deepEqual(definitionResult.errors, [definitionIssue]);

  const invalidDescriptors = breakdownRequest({
    breakdownDefinition: definition({
      hazardOverrides: { category: "event" },
      responseOverrides: { schemaVersion: 2 }
    })
  });
  const descriptorResult = analyzeVoyageCatastrophicBreakdown(invalidDescriptors);
  assert.deepEqual(descriptorResult.errors, [hazardIssue, responseIssue]);
});

test("validates every handoff field, arithmetic, status, applicability, and M7 vocabulary", () => {
  const unused = analyzeVoyageCatastrophicBreakdown(breakdownRequest({
    handoff: capacityExhaustion({ scarCapacity: 3, occupiedScarCount: 2 })
  }));
  assert.deepEqual(unused.errors, [task2Issue(
    "m9-capacity-not-exhausted",
    "capacityExhaustion.occupiedScarCount",
    "Capacity exhaustion is not established."
  )]);

  const overCapacity = analyzeVoyageCatastrophicBreakdown(breakdownRequest({
    handoff: capacityExhaustion({ scarCapacity: 1, occupiedScarCount: 2 })
  }));
  assert.deepEqual(overCapacity.errors, unused.errors);

  const invalidEvidence = analyzeVoyageCatastrophicBreakdown(breakdownRequest({
    handoff: capacityExhaustion({ incomingScarProposalStatus: "applied", scarCapacity: 3, occupiedScarCount: 2 })
  }));
  assert.deepEqual(invalidEvidence.errors, [
    task2Issue("m9-capacity-not-exhausted", "capacityExhaustion.occupiedScarCount", "Capacity exhaustion is not established."),
    task2Issue("m9-invalid-incoming-scar-proposal", "capacityExhaustion.incomingScarProposalId", "Incoming ordinary Scar proposal evidence is invalid.")
  ]);

  const notOrdinary = analyzeVoyageCatastrophicBreakdown(breakdownRequest({
    handoff: capacityExhaustion({ incomingScarProposalKind: "other-proposal" })
  }));
  assert.deepEqual(notOrdinary.errors, [task2Issue(
    "m9-breakdown-not-applicable",
    "capacityExhaustion",
    "Catastrophic Breakdown is not applicable to this handoff."
  )]);

  for (const { field, expected = [task2Issue(
    "m9-invalid-capacity-exhaustion",
    "capacityExhaustion",
    "Capacity-exhaustion handoff is invalid."
  )] } of [
    { field: { kind: "wrong-kind" } },
    { field: { eventId: " " } },
    { field: { eventId: " event-1 " } },
    { field: { sessionId: " " } },
    { field: { sessionId: " session-1 " } },
    { field: { definitionSnapshotId: " " } },
    { field: { definitionSnapshotId: " breakdown-snapshot-1 " } },
    { field: { shipId: " " } },
    { field: { shipId: " ship-1 " } },
    { field: { systemId: "unknown" } },
    { field: { systemKind: "wrong" } },
    { field: { liveRevision: -1 } },
    { field: { scarCapacity: Number.MAX_SAFE_INTEGER + 1 } },
    { field: { occupiedScarCount: -1 } },
    { field: { incomingScarProposalId: " " } },
    { field: { incomingScarProposalKind: " " } },
    { field: { incomingScarProposalStatus: " " } },
    { field: { liveRevision: Number.NaN }, expected: [hostileIssue] },
    { field: { liveRevision: Number.POSITIVE_INFINITY }, expected: [hostileIssue] },
    { field: { scarCapacity: Number.NaN }, expected: [hostileIssue] },
    { field: { occupiedScarCount: Number.POSITIVE_INFINITY }, expected: [hostileIssue] }
  ]) {
    const result = analyzeVoyageCatastrophicBreakdown(breakdownRequest({ handoff: capacityExhaustion(field) }));
    assert.deepEqual(result.errors, expected, JSON.stringify(field));
  }
});

test("requires the exact handoff key order and short-circuits malformed identity before later mismatches", () => {
  const malformedLaterMismatch = capacityExhaustion({
    eventId: "handoff-event",
    definitionSnapshotId: " ",
    systemId: "arkengine"
  });
  const malformedResult = analyzeVoyageCatastrophicBreakdown(breakdownRequest({
    handoff: malformedLaterMismatch
  }));
  assert.deepEqual(malformedResult.errors, [task2Issue(
    "m9-invalid-capacity-exhaustion",
    "capacityExhaustion",
    "Capacity-exhaustion handoff is invalid."
  )]);

  const missing = capacityExhaustion();
  delete missing.shipId;
  assert.deepEqual(
    analyzeVoyageCatastrophicBreakdown(breakdownRequest({ handoff: missing })).errors,
    [task2Issue("m9-invalid-capacity-exhaustion", "capacityExhaustion", "Capacity-exhaustion handoff is invalid.")]
  );

  const extra = { ...capacityExhaustion(), extraEvidence: true };
  assert.deepEqual(
    analyzeVoyageCatastrophicBreakdown(breakdownRequest({ handoff: extra })).errors,
    [task2Issue("m9-invalid-capacity-exhaustion", "capacityExhaustion", "Capacity-exhaustion handoff is invalid.")]
  );

  const reordered = Object.fromEntries(Object.entries(capacityExhaustion()).reverse());
  assert.deepEqual(
    analyzeVoyageCatastrophicBreakdown(breakdownRequest({ handoff: reordered })).errors,
    [task2Issue("m9-invalid-capacity-exhaustion", "capacityExhaustion", "Capacity-exhaustion handoff is invalid.")]
  );
});

test("captures snapshot, ship, and live-revision evidence in isolation without Task 2 self-revalidation", () => {
  const input = breakdownRequest({
    handoff: capacityExhaustion({
      definitionSnapshotId: "m10-only-snapshot-evidence",
      shipId: "m10-only-ship-evidence",
      liveRevision: 987654
    })
  });
  assert.equal("definitionSnapshotId" in input.breakdownDefinition, false);
  assert.equal("shipId" in input.breakdownDefinition, false);
  assert.equal("liveRevision" in input.breakdownDefinition, false);

  const result = analyzeVoyageCatastrophicBreakdown(input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.definitionSnapshotId, "m10-only-snapshot-evidence");
  assert.equal(result.shipId, "m10-only-ship-evidence");
  assert.equal(result.liveRevision, 987654);
  assert.deepEqual(result.breakdownPlan.capacityExhaustion, input.capacityExhaustion);
  assert.notEqual(result.breakdownPlan.capacityExhaustion, input.capacityExhaustion);
  assert.deepEqual(Object.keys(result.breakdownPlan.capacityExhaustion), CAPACITY_FIELDS);

  result.breakdownPlan.capacityExhaustion.definitionSnapshotId = "returned-snapshot";
  result.breakdownPlan.capacityExhaustion.shipId = "returned-ship";
  result.breakdownPlan.capacityExhaustion.liveRevision = 1;
  assert.equal(input.capacityExhaustion.definitionSnapshotId, "m10-only-snapshot-evidence");
  assert.equal(input.capacityExhaustion.shipId, "m10-only-ship-evidence");
  assert.equal(input.capacityExhaustion.liveRevision, 987654);
});

test("accumulates Breakdown category-9 event, session, and system mismatches in order", () => {
  const result = analyzeVoyageCatastrophicBreakdown(breakdownRequest({
    sessionId: "request-session",
    breakdownDefinition: definition({
      systemId: "arkengine",
      hazardOverrides: { encounterId: "definition-event" }
    }),
    handoff: capacityExhaustion({
      eventId: "handoff-event",
      sessionId: "handoff-session",
      systemId: "crew-morale"
    })
  }));
  assert.deepEqual(result.errors, [
    task2Issue("m9-event-identity-mismatch", "capacityExhaustion.eventId", "Event identity does not match the M10 handoff."),
    task2Issue("m9-session-identity-mismatch", "capacityExhaustion.sessionId", "Session identity does not match the M10 handoff or request."),
    task2Issue("m9-system-identity-mismatch", "capacityExhaustion.systemId", "Affected system identity does not match the M10 handoff.")
  ]);

  const identityAndCapacity = analyzeVoyageCatastrophicBreakdown(breakdownRequest({
    sessionId: "request-session",
    handoff: capacityExhaustion({ sessionId: "handoff-session", scarCapacity: 2, occupiedScarCount: 1 })
  }));
  assert.deepEqual(identityAndCapacity.errors, [task2Issue(
    "m9-session-identity-mismatch",
    "capacityExhaustion.sessionId",
    "Session identity does not match the M10 handoff or request."
  )]);
});

test("accepts shared references, rejects active-ancestor cycles, and rejects undefined request data", () => {
  const sharedDefinition = definition();
  const sharedDescriptor = { consequenceId: "shared-task2" };
  sharedDefinition.catastrophicHazard.currentEffect = sharedDescriptor;
  sharedDefinition.catastrophicHazard.ignoredConsequence = sharedDescriptor;
  sharedDefinition.catastrophicHazard.metadata.collision.consequence = sharedDescriptor;
  const sharedInput = breakdownRequest({ breakdownDefinition: sharedDefinition });
  const sharedResult = analyzeVoyageCatastrophicBreakdown(sharedInput);
  assert.equal(sharedResult.ok, true);
  assert.notEqual(sharedResult.breakdownPlan.catastrophicHazard.currentEffect, sharedResult.breakdownPlan.catastrophicHazard.ignoredConsequence);
  assert.notEqual(sharedResult.breakdownPlan.catastrophicHazard.currentEffect, sharedDescriptor);

  const direct = breakdownRequest();
  direct.breakdownDefinition.catastrophicHazard.currentEffect.loop = direct.breakdownDefinition.catastrophicHazard.currentEffect;
  assert.deepEqual(analyzeVoyageCatastrophicBreakdown(direct).errors, [hostileIssue]);

  const indirect = breakdownRequest();
  const first = {};
  const second = {};
  first.second = second;
  second.first = first;
  indirect.breakdownDefinition.catastrophicHazard.currentEffect = first;
  assert.deepEqual(analyzeVoyageCatastrophicBreakdown(indirect).errors, [hostileIssue]);

  const undefinedValue = breakdownRequest();
  undefinedValue.capacityExhaustion.incomingScarProposalStatus = undefined;
  assert.deepEqual(analyzeVoyageCatastrophicBreakdown(undefinedValue).errors, [hostileIssue]);
});

test("is deterministic, zero-mutating, and reconstructs isolated plans per request occurrence", () => {
  const input = breakdownRequest();
  const before = structuredClone(input);
  const first = analyzeVoyageCatastrophicBreakdown(input);
  const second = analyzeVoyageCatastrophicBreakdown(input);
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);

  first.breakdownPlan.pausePlan.timing = "returned-mutation";
  first.breakdownPlan.capacityExhaustion.eventId = "returned-event";
  assert.equal(second.breakdownPlan.pausePlan.timing, "after-current-segment");
  assert.equal(second.breakdownPlan.capacityExhaustion.eventId, "event-1");
  assert.equal(input.breakdownDefinition.pausePlan.timing, "after-current-segment");
  assert.equal(input.capacityExhaustion.eventId, "event-1");
});

test("does not expose later Task APIs, runtime behavior, or forbidden markers", async () => {
  const module = await import("../../../scripts/voyage/domain/catastrophic-breakdown.js");
  assert.equal("analyzeVoyageCatastrophicBreakdown" in module, true);
  assert.equal("validateVoyageEmergencyResponseCompletedRoundHistory" in module, false);
  assert.equal("captureVoyageEmergencyResponseCompletedRoundHistory" in module, false);
  assert.equal("analyzeVoyageEmergencyResponseResult" in module, false);
});
