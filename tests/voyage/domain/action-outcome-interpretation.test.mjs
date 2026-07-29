import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterCrewPlanningLock } from "../../../scripts/voyage/domain/crew-planning-lock.js";
import { applyVoyageEncounterResolutionTransition } from "../../../scripts/voyage/domain/resolution-transition.js";
import { prepareVoyageEncounterActionExecutionRequests } from "../../../scripts/voyage/domain/resolution-execution-requests.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../../../scripts/voyage/domain/pending-checks.js";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { prepareVoyageEncounterResolutionCompletion } from "../../../scripts/voyage/domain/resolution-completion.js";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";
import { analyzeVoyageEncounterActionOutcomes } from "../../../scripts/voyage/domain/action-outcome-interpretation.js";

const CHECK_BRANCHES = ["critical-failure", "failure", "success", "critical-success"];
const STATION_IDS = ["captain", "engineer", "navigator", "watchmaster", "veilwarden"];
const ROLL_DETAILS = [
  "total",
  "dc",
  "degreeOfSuccess",
  "degreeOfSuccessSlug",
  "statisticSlug",
  "rollMode",
  "pendingCheckId",
  "pendingCheckIndex"
];

function state({
  encounterId = "encounter",
  phase = "consequences",
  availableStations = [],
  selections = {},
  targets = {},
  committedStationOrder = null
} = {}) {
  const result = createVoyageEncounterState({
    encounterId,
    definitionId: "definition",
    primaryShip: { id: "ship" }
  });
  result.lifecycleState = "active";
  result.currentStage = { stageId: "stage" };
  result.roundNumber = 1;
  result.phase = phase;
  result.availableStations = availableStations;
  result.stationAssignments = Object.keys(selections).map((stationId) => ({
    stationId,
    operator: {
      kind: "actor",
      uuid: `Actor.operator-${stationId}`
    }
  }));
  result.selections = selections;
  result.targets = targets;
  result.committedStationOrder = committedStationOrder ?? Object.keys(selections);
  return result;
}

function effectRule(effectId, { payload = null, target = { kind: "encounter" } } = {}) {
  return {
    effectId,
    intentType: "track-change",
    timing: "consequences",
    visibility: "public",
    target,
    payload
  };
}

function noRollAction(actionId, effectIds, effectRules = effectIds.filter(Boolean).map((id) => effectRule(id))) {
  return {
    actionId,
    outcomeDefinition: {
      effectRules,
      branches: { "no-roll": effectIds }
    }
  };
}

function checkAction(actionId, actionIndex, branch, effectId) {
  const branches = Object.fromEntries(CHECK_BRANCHES.map((slug) => [slug, []]));
  branches[branch] = [effectId];
  return {
    actionId,
    check: {
      source: { kind: "character", uuid: `Actor.${actionIndex}` },
      statisticOptions: ["diplomacy"],
      dcSource: { kind: "fixed", value: 20 + actionIndex },
      secrecy: "public",
      metadata: {}
    },
    outcomeDefinition: {
      effectRules: [effectRule(effectId)],
      branches
    }
  };
}

function riskBidOption(riskBidId, dcAdjustment, overrides = {}) {
  return {
    riskBidId,
    dcAdjustment,
    outcomes: {
      criticalSuccess: [],
      success: [],
      failure: [],
      criticalFailure: [],
      ...overrides
    }
  };
}

function executionResult(sequence, degreeOfSuccessSlug) {
  return {
    ok: true,
    status: "rolled",
    pendingCheckId: `pending-${sequence}`,
    sequence,
    sourceKind: "character",
    sourceUuid: `Actor.${sequence}`,
    statisticSlug: "diplomacy",
    dc: 20 + sequence,
    rollMode: "public",
    result: {
      total: 20 + sequence,
      degreeOfSuccess: CHECK_BRANCHES.indexOf(degreeOfSuccessSlug),
      degreeOfSuccessSlug
    },
    errors: [],
    warnings: []
  };
}

function resolveChecks(source, branches) {
  const prepared = applyVoyageEncounterPendingCheckPreparation(source, {
    pendingCheckIds: branches.map((_, sequence) => ({
      sequence,
      pendingCheckId: `pending-${sequence}`
    }))
  });
  assert.equal(prepared.ok, true);

  let nextState = prepared.nextState;
  for (let sequence = 0; sequence < branches.length; sequence += 1) {
    const applied = applyVoyageEncounterPendingCheckResult(
      nextState,
      executionResult(sequence, branches[sequence])
    );
    assert.equal(applied.ok, true);
    nextState = applied.nextState;
  }
  nextState.phase = "consequences";
  return nextState;
}

function assertAtomic(report) {
  assert.equal(report.readyForInterpretation, false);
  assert.equal(report.interpretedActionCount, 0);
  assert.equal(report.intentCount, 0);
  assert.deepEqual(report.actions, []);
  assert.deepEqual(report.intents, []);
}

function hasError(report, code, path = undefined) {
  return report.errors.some((entry) => entry.code === code && (path === undefined || entry.path === path));
}

test("empty Active Consequences plan returns the exact ready report shape", () => {
  const report = analyzeVoyageEncounterActionOutcomes(state({ encounterId: "empty" }));
  assert.deepEqual(Object.keys(report), [
    "structurallyValid",
    "definitionsValid",
    "pendingChecksValid",
    "resolutionComplete",
    "active",
    "consequences",
    "readyForInterpretation",
    "actionCount",
    "interpretedActionCount",
    "checkActionCount",
    "noRollActionCount",
    "intentCount",
    "actions",
    "intents",
    "errors",
    "warnings"
  ]);
  assert.equal(report.resolutionComplete, true);
  assert.equal(report.readyForInterpretation, true);
  assert.deepEqual(report.actions, []);
  assert.deepEqual(report.intents, []);
});

test("successful no-roll interpretation has exact shapes and excludes every roll detail", () => {
  const source = state({
    encounterId: "no-roll",
    availableStations: [{
      stationId: "captain",
      actions: [noRollAction("command", ["effect"], [
        effectRule("effect", { payload: { amount: 1 } })
      ])]
    }],
    selections: { captain: { stationId: "captain", actionId: "command" } },
    targets: { captain: { id: "target" } }
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(report.readyForInterpretation, true);
  assert.equal(report.interpretedActionCount, 1);
  assert.equal(report.checkActionCount, 0);
  assert.equal(report.pendingChecksValid, true);
  assert.equal(report.resolutionComplete, true);
  assert.equal(report.intentCount, 1);
  assert.equal(report.actions[0].mode, "no-roll");
  assert.equal(report.actions[0].branch, "no-roll");
  assert.deepEqual(report.actions[0].branchEffectIds, ["effect"]);
  assert.deepEqual(report.actions[0].riskBidEffectIds, []);
  assert.equal(report.actions[0].intentIds.length, 1);
  assert.deepEqual(Object.keys(report.actions[0]), [
    "sequence",
    "stationId",
    "actionId",
    "mode",
    "branch",
    "riskBidId",
    "dcAdjustment",
    "branchEffectIds",
    "riskBidEffectIds",
    "intentIds"
  ]);
  assert.deepEqual(Object.keys(report.intents[0]), [
    "intentId",
    "encounterId",
    "stageId",
    "roundNumber",
    "sequence",
    "stationId",
    "actionId",
    "mode",
    "branch",
    "riskBidId",
    "dcAdjustment",
    "activationSource",
    "referenceIndex",
    "effectId",
    "intentType",
    "timing",
    "visibility",
    "target",
    "selectedTarget",
    "payload"
  ]);
  for (const record of [report.actions[0], report.intents[0]]) {
    for (const field of ROLL_DETAILS) assert.equal(Object.hasOwn(record, field), false);
  }
});

test("all four resolved check degrees map to their exact authored branches", () => {
  const availableStations = [];
  const selections = {};
  for (let index = 0; index < CHECK_BRANCHES.length; index += 1) {
    const stationId = STATION_IDS[index];
    const actionId = `action-${index}`;
    availableStations.push({
      stationId,
      actions: [checkAction(actionId, index, CHECK_BRANCHES[index], `effect-${index}`)]
    });
    selections[stationId] = { stationId, actionId };
  }

  const resolved = resolveChecks(
    state({ encounterId: "branches", phase: "resolution", availableStations, selections }),
    CHECK_BRANCHES
  );
  const report = analyzeVoyageEncounterActionOutcomes(resolved);
  assert.equal(report.resolutionComplete, true);
  assert.equal(report.readyForInterpretation, true);
  assert.equal(report.interpretedActionCount, 4);
  assert.equal(report.intentCount, 4);

  for (let index = 0; index < CHECK_BRANCHES.length; index += 1) {
    assert.equal(report.actions[index].branch, CHECK_BRANCHES[index]);
    assert.deepEqual(report.actions[index].branchEffectIds, [`effect-${index}`]);
    assert.equal(report.intents[index].branch, CHECK_BRANCHES[index]);
    assert.equal(report.intents[index].effectId, `effect-${index}`);
    assert.equal(report.intents[index].referenceIndex, 0);
  }
});

test("selected Risk Bid metadata survives outcome analysis without activating its branch", () => {
  const action = checkAction("command", 0, "success", "normal-effect");
  action.approaches = [{
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy"
  }];
  action.riskBidOptions = [
    riskBidOption("bid-5", 5, { success: ["risk-effect"] })
  ];
  action.outcomeDefinition.effectRules.push(effectRule("risk-effect"));
  const source = state({
    phase: "resolution",
    availableStations: [{
      stationId: "captain",
      actions: [action]
    }],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command",
        approachId: "diplomacy",
        statisticSlugOrAbilityId: "diplomacy"
      }
    },
    targets: { captain: { id: "target" } }
  });
  source.riskBids.captain = {
    stationId: "captain",
    actionId: "command",
    riskBidId: "bid-5",
    dcAdjustment: 5
  };
  const resolved = resolveChecks(source, ["success"]);
  const before = structuredClone(resolved);
  const report = analyzeVoyageEncounterActionOutcomes(resolved);

  assert.equal(report.readyForInterpretation, true);
  assert.equal(report.interpretedActionCount, 1);
  assert.equal(report.intentCount, 1);
  assert.equal(report.actions[0].riskBidId, "bid-5");
  assert.equal(report.actions[0].dcAdjustment, 5);
  assert.deepEqual(report.actions[0].riskBidEffectIds, []);
  assert.equal(report.intents[0].effectId, "normal-effect");
  assert.equal(report.intents[0].riskBidId, "bid-5");
  assert.equal(report.intents[0].dcAdjustment, 5);
  assert.equal(
    report.intents.some((intent) => intent.effectId === "risk-effect"),
    false
  );
  assert.deepEqual(resolved, before);

  const contradictory = structuredClone(resolved);
  contradictory.pendingChecks[0].dcAdjustment = 8;
  const failed = analyzeVoyageEncounterActionOutcomes(contradictory);
  assertAtomic(failed);
  assert.ok(failed.errors.some(
    (entry) => entry.code === "pending-check-request-mismatch"
      && entry.path === "pendingChecks[0].dcAdjustment"
  ));
});

test("one canonical Risk Bid survives the complete lock-to-Consequences pipeline", () => {
  const action = checkAction("command", 0, "success", "normal-effect");
  action.approaches = [{
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy"
  }];
  action.riskBidOptions = [
    riskBidOption("bid-5", 5, { success: ["risk-effect"] })
  ];
  action.outcomeDefinition.effectRules.push(effectRule("risk-effect"));
  const source = state({
    phase: "crew-planning",
    availableStations: [{
      stationId: "captain",
      actions: [action]
    }],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command",
        approachId: "diplomacy",
        statisticSlugOrAbilityId: "diplomacy"
      }
    },
    targets: { captain: { id: "target" } },
    committedStationOrder: []
  });
  source.proposedStationOrder = ["captain"];
  source.riskBids.captain = {
    stationId: "captain",
    actionId: "command",
    riskBidId: "bid-5",
    dcAdjustment: 5
  };
  const sourceBefore = structuredClone(source);

  const locked = applyVoyageEncounterCrewPlanningLock(source, {
    phaseStartSnapshotId: "integration-lock"
  });
  assert.equal(locked.ok, true);
  assert.deepEqual(locked.events[0].riskBids, [{
    stationId: "captain",
    actionId: "command",
    riskBidId: "bid-5",
    dcAdjustment: 5
  }]);
  assert.deepEqual(
    locked.nextState.snapshots.at(-1).temporaryState.riskBids,
    source.riskBids
  );
  assert.deepEqual(source, sourceBefore);

  const lockStateBefore = structuredClone(locked.nextState);
  const resolution = applyVoyageEncounterResolutionTransition(
    locked.nextState,
    { phaseStartSnapshotId: "integration-resolution" }
  );
  assert.equal(resolution.ok, true);
  assert.deepEqual(resolution.events[0].orderedActions, [{
    sequence: 0,
    stationId: "captain",
    actionId: "command",
    resolutionPriority: 0,
    riskBidId: "bid-5",
    dcAdjustment: 5
  }]);
  assert.deepEqual(
    resolution.nextState.snapshots.at(-1).temporaryState.riskBids,
    source.riskBids
  );
  assert.deepEqual(locked.nextState, lockStateBefore);

  const execution = prepareVoyageEncounterActionExecutionRequests(
    resolution.nextState
  );
  assert.equal(execution.readyForExecution, true);
  assert.equal(execution.executionRequests.length, 1);
  assert.equal(execution.executionRequests[0].riskBidId, "bid-5");
  assert.equal(execution.executionRequests[0].dcAdjustment, 5);
  assert.deepEqual(
    execution.executionRequests[0].dcSource,
    { kind: "fixed", value: 20 }
  );
  assert.equal(
    Object.hasOwn(execution.executionRequests[0], "finalDc"),
    false
  );
  execution.executionRequests[0].riskBidId = "report-only";

  const prepared = applyVoyageEncounterPendingCheckPreparation(
    resolution.nextState,
    {
      pendingCheckIds: [{
        sequence: 0,
        pendingCheckId: "integration-pending"
      }]
    }
  );
  assert.equal(prepared.ok, true);
  assert.equal(prepared.nextState.pendingChecks.length, 1);
  assert.equal(prepared.nextState.pendingChecks[0].riskBidId, "bid-5");
  assert.equal(prepared.nextState.pendingChecks[0].dcAdjustment, 5);
  assert.equal(
    Object.hasOwn(prepared.nextState.pendingChecks[0], "finalDc"),
    false
  );

  const resolved = applyVoyageEncounterPendingCheckResult(
    prepared.nextState,
    {
      ...executionResult(0, "success"),
      pendingCheckId: "integration-pending"
    }
  );
  assert.equal(resolved.ok, true);
  assert.equal(resolved.nextState.pendingChecks[0].riskBidId, "bid-5");
  assert.equal(resolved.nextState.pendingChecks[0].dcAdjustment, 5);
  assert.deepEqual(Object.keys(resolved.nextState.pendingChecks[0].result), [
    "total",
    "degreeOfSuccess",
    "degreeOfSuccessSlug",
    "statisticSlug",
    "dc",
    "rollMode"
  ]);
  assert.equal(
    prepareVoyageEncounterResolutionCompletion(
      resolved.nextState
    ).readyForConsequences,
    true
  );

  const consequences = applyVoyageEncounterConsequencesTransition(
    resolved.nextState,
    { phaseStartSnapshotId: "integration-consequences" }
  );
  assert.equal(consequences.ok, true);
  assert.deepEqual(consequences.nextState.riskBids, source.riskBids);
  assert.equal(
    consequences.nextState.pendingChecks[0].dcAdjustment,
    5
  );
  assert.deepEqual(
    consequences.nextState.snapshots.at(-1).temporaryState.riskBids,
    source.riskBids
  );

  const report = analyzeVoyageEncounterActionOutcomes(
    consequences.nextState
  );
  assert.equal(report.readyForInterpretation, true);
  assert.equal(report.actions[0].riskBidId, "bid-5");
  assert.equal(report.actions[0].dcAdjustment, 5);
  assert.deepEqual(report.actions[0].riskBidEffectIds, []);
  assert.deepEqual(
    report.intents.map(({ effectId }) => effectId),
    ["normal-effect"]
  );
  assert.equal(report.intents[0].riskBidId, "bid-5");
  assert.equal(report.intents[0].dcAdjustment, 5);
});

test("non-Consequences phase returns the exact phase gate and atomic empty output", () => {
  const source = state({
    phase: "resolution",
    availableStations: [{
      stationId: "captain",
      actions: [noRollAction("command", ["effect"])]
    }],
    selections: { captain: { stationId: "captain", actionId: "command" } }
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(report.resolutionComplete, true);
  assert.equal(
    hasError(report, "outcome-interpretation-requires-consequences", "phase"),
    true
  );
  assertAtomic(report);
});

test("non-Active lifecycle reports the exact Active gate and atomic empty output", () => {
  const source = state({
    availableStations: [{
      stationId: "captain",
      actions: [noRollAction("command", ["effect"])]
    }],
    selections: { captain: { stationId: "captain", actionId: "command" } }
  });
  source.lifecycleState = "paused";

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(report.active, false);
  assert.equal(
    hasError(report, "outcome-interpretation-requires-active", "lifecycleState"),
    true
  );
  assertAtomic(report);
});

test("incomplete check resolution reports both the completion gate and missing check atomically", () => {
  const source = state({
    availableStations: [{
      stationId: "engineer",
      actions: [checkAction("repair", 0, "success", "effect")]
    }],
    selections: { engineer: { stationId: "engineer", actionId: "repair" } }
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(report.resolutionComplete, false);
  assert.equal(
    hasError(report, "outcome-interpretation-resolution-incomplete", "pendingChecks"),
    true
  );
  assert.equal(hasError(report, "outcome-interpretation-pending-check-missing"), true);
  assertAtomic(report);
});

test("invalid definitions preserve precise upstream errors without a summary diagnostic", () => {
  const source = state({
    availableStations: [{
      stationId: "captain",
      actions: [{
        actionId: "bad",
        outcomeDefinition: { effectRules: [], branches: null }
      }]
    }],
    selections: { captain: { stationId: "captain", actionId: "bad" } }
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(report.resolutionComplete, true);
  assert.equal(report.definitionsValid, false);
  assert.equal(report.readyForInterpretation, false);
  assert.equal(hasError(report, "invalid-action-outcome-branches"), true);
  assert.equal(hasError(report, "outcome-interpretation-definitions-invalid"), false);
  assertAtomic(report);
});

test("missing effect rules preserve upstream diagnostics and fail interpreter preflight atomically", () => {
  const source = state({
    availableStations: [{
      stationId: "captain",
      actions: [noRollAction("command", ["missing"], [])]
    }],
    selections: { captain: { stationId: "captain", actionId: "command" } }
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(hasError(report, "missing-effect-reference"), true);
  assert.equal(hasError(report, "outcome-interpretation-effect-rule-missing"), true);
  assertAtomic(report);
});

test("an invalid resolved result remains atomic and preserves its precise validation error", () => {
  const source = state({
    phase: "resolution",
    availableStations: [{
      stationId: "navigator",
      actions: [checkAction("navigate", 0, "success", "effect")]
    }],
    selections: { navigator: { stationId: "navigator", actionId: "navigate" } }
  });
  const resolved = resolveChecks(source, ["success"]);
  resolved.pendingChecks[0].result.degreeOfSuccessSlug = "not-a-degree";

  const report = analyzeVoyageEncounterActionOutcomes(resolved);
  assert.equal(hasError(report, "invalid-pending-check-result"), true);
  assert.equal(
    hasError(report, "outcome-interpretation-resolution-incomplete", "pendingChecks"),
    true
  );
  assertAtomic(report);
});

test("an unresolved sparse pending check reports its original index path atomically", () => {
  const source = state({
    phase: "resolution",
    availableStations: [{
      stationId: "engineer",
      actions: [checkAction("repair", 0, "success", "effect")]
    }],
    selections: { engineer: { stationId: "engineer", actionId: "repair" } },
    targets: { engineer: { id: "target" } }
  });
  source.pendingChecks.length = 4;
  source.pendingChecks[3] = {
    pendingCheckId: "pending-3",
    preparedRevision: 0,
    stageId: "stage",
    roundNumber: 1,
    sequence: 0,
    stationId: "engineer",
    actionId: "repair",
    resolutionPriority: 0,
    riskBidId: null,
    dcAdjustment: null,
    target: { id: "target" },
    mode: "check",
    source: { kind: "character", uuid: "Actor.0" },
    statisticOptions: ["diplomacy"],
    dcSource: { kind: "fixed", value: 20 },
    secrecy: "public",
    metadata: {},
    status: "pending",
    result: null
  };

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(
    hasError(
      report,
      "outcome-interpretation-pending-check-unresolved",
      "pendingChecks[3].status"
    ),
    true
  );
  assertAtomic(report);
});

test("two selected actions and consequences retain exact committed order", () => {
  const source = state({
    availableStations: [
      {
        stationId: "captain",
        actions: [{ ...noRollAction("later", ["late-effect"]), resolutionPriority: 5 }]
      },
      {
        stationId: "engineer",
        actions: [{ ...noRollAction("earlier", ["early-effect"]), resolutionPriority: 1 }]
      }
    ],
    selections: {
      captain: { stationId: "captain", actionId: "later" },
      engineer: { stationId: "engineer", actionId: "earlier" }
    },
    committedStationOrder: ["engineer", "captain"]
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.deepEqual(report.actions.map(({ stationId }) => stationId), ["engineer", "captain"]);
  assert.deepEqual(report.actions.map(({ sequence }) => sequence), [0, 1]);
  assert.deepEqual(report.intents.map(({ stationId }) => stationId), ["engineer", "captain"]);
  assert.deepEqual(report.intents.map(({ sequence }) => sequence), [0, 1]);
});

test("sparse own branch references ignore inherited getters and preserve indexes", () => {
  const references = [];
  references.length = 4;
  Object.defineProperty(references, 1, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: "first"
  });
  Object.defineProperty(references, 3, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: "second"
  });
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 2, {
    configurable: true,
    get() {
      throw new Error("Inherited getter must not run.");
    }
  });
  Object.setPrototypeOf(references, prototype);

  const source = state({
    availableStations: [{
      stationId: "watchmaster",
      actions: [noRollAction(
        "observe",
        references,
        [effectRule("first"), effectRule("second")]
      )]
    }],
    selections: { watchmaster: { stationId: "watchmaster", actionId: "observe" } }
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(report.readyForInterpretation, true);
  assert.equal(report.intentCount, 2);
  assert.deepEqual(report.intents.map(({ referenceIndex }) => referenceIndex), [1, 3]);
  assert.equal(report.actions[0].branchEffectIds.length, 4);
  assert.equal(Object.hasOwn(report.actions[0].branchEffectIds, 0), false);
  assert.equal(report.actions[0].branchEffectIds[1], "first");
  assert.equal(Object.hasOwn(report.actions[0].branchEffectIds, 2), false);
  assert.equal(report.actions[0].branchEffectIds[3], "second");
});

test("intent IDs are deterministic and distinguish action sequences and original reference indexes", () => {
  const references = [];
  references.length = 3;
  references[0] = "effect,one";
  references[2] = "effect:[two]";
  const source = state({
    encounterId: "encounter,with:[delimiters]",
    availableStations: [
      {
        stationId: "captain",
        actions: [noRollAction(
          "command",
          references,
          [effectRule("effect,one"), effectRule("effect:[two]")]
        )]
      },
      {
        stationId: "engineer",
        actions: [noRollAction("repair", ["effect,one"])]
      }
    ],
    selections: {
      captain: { stationId: "captain", actionId: "command" },
      engineer: { stationId: "engineer", actionId: "repair" }
    }
  });

  const first = analyzeVoyageEncounterActionOutcomes(source);
  const second = analyzeVoyageEncounterActionOutcomes(source);
  assert.deepEqual(
    first.intents.map(({ intentId }) => intentId),
    second.intents.map(({ intentId }) => intentId)
  );
  assert.equal(new Set(first.intents.map(({ intentId }) => intentId)).size, 3);
  assert.notEqual(first.intents[0].intentId, first.intents[1].intentId);
  assert.notEqual(first.intents[0].intentId, first.intents[2].intentId);
  assert.equal(first.intents[0].sequence, 0);
  assert.equal(first.intents[1].sequence, 0);
  assert.equal(first.intents[2].sequence, 1);
  assert.equal(
    first.intents[0].intentId,
    `arcflight-intent:${JSON.stringify([
      "encounter,with:[delimiters]",
      "stage",
      1,
      0,
      "branch",
      0,
      "effect,one"
    ])}`
  );
  assert.equal(first.intents[1].referenceIndex, 2);
  assert.equal(first.intents[2].referenceIndex, 0);
});

test("source, sibling outputs, and later invocations remain deeply isolated", () => {
  const firstPayload = { nested: { values: [1, { value: 2 }] } };
  const secondPayload = { nested: { values: [4, { value: 5 }] } };
  const firstTarget = { id: "first-target", nested: { value: 3 } };
  const secondTarget = { id: "second-target", nested: { value: 6 } };
  const source = state({
    availableStations: [
      {
        stationId: "veilwarden",
        actions: [noRollAction("ward", ["first-effect"], [
          effectRule("first-effect", { payload: firstPayload })
        ])]
      },
      {
        stationId: "engineer",
        actions: [noRollAction("repair", ["second-effect"], [
          effectRule("second-effect", { payload: secondPayload })
        ])]
      }
    ],
    selections: {
      veilwarden: { stationId: "veilwarden", actionId: "ward" },
      engineer: { stationId: "engineer", actionId: "repair" }
    },
    targets: {
      veilwarden: firstTarget,
      engineer: secondTarget
    }
  });
  const sourceSnapshot = structuredClone(source);
  const sourceRevision = source.revision;

  const first = analyzeVoyageEncounterActionOutcomes(source);
  first.actions[0].branchEffectIds[0] = "changed";
  first.actions[0].riskBidEffectIds.push("changed");
  first.actions[0].intentIds[0] = "changed";
  first.intents[0].target.kind = "changed";
  first.intents[0].selectedTarget.nested.value = 30;
  first.intents[0].payload.nested.values[1].value = 20;
  assert.deepEqual(first.actions[1].branchEffectIds, ["second-effect"]);
  assert.deepEqual(first.actions[1].riskBidEffectIds, []);
  assert.equal(first.intents[1].selectedTarget.nested.value, 6);
  assert.equal(first.intents[1].payload.nested.values[1].value, 5);
  assert.deepEqual(source, sourceSnapshot);
  assert.equal(source.revision, sourceRevision);

  const second = analyzeVoyageEncounterActionOutcomes(source);
  assert.notEqual(first.actions, second.actions);
  assert.notEqual(first.intents, second.intents);
  assert.deepEqual(second.actions[0].branchEffectIds, ["first-effect"]);
  assert.deepEqual(second.actions[0].riskBidEffectIds, []);
  assert.notEqual(second.actions[0].intentIds[0], "changed");
  assert.deepEqual(second.intents[0].target, { kind: "encounter" });
  assert.equal(second.intents[0].selectedTarget.nested.value, 3);
  assert.equal(second.intents[0].payload.nested.values[1].value, 2);
  assert.equal(second.intents[1].selectedTarget.nested.value, 6);
  assert.equal(second.intents[1].payload.nested.values[1].value, 5);
  assert.equal(firstTarget.nested.value, 3);
  assert.equal(firstPayload.nested.values[1].value, 2);
  assert.deepEqual(source, sourceSnapshot);
  assert.equal(source.revision, sourceRevision);
});

test("duplicate effect rules preserve upstream errors without a noncontract interpreter diagnostic", () => {
  const source = state({
    availableStations: [{
      stationId: "captain",
      actions: [noRollAction(
        "command",
        ["duplicate"],
        [effectRule("duplicate"), effectRule("duplicate")]
      )]
    }],
    selections: { captain: { stationId: "captain", actionId: "command" } }
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(hasError(report, "duplicate-effect-id"), true);
  assert.equal(hasError(report, "outcome-interpretation-effect-rule-ambiguous"), false);
  assertAtomic(report);
});

test("cloning preserves an own __proto__ payload key without changing the output prototype", () => {
  const payload = { ordinary: true };
  Object.defineProperty(payload, "__proto__", {
    value: { preserved: true },
    enumerable: true,
    configurable: true,
    writable: true
  });
  const source = state({
    availableStations: [{
      stationId: "engineer",
      actions: [noRollAction("repair", ["effect"], [
        effectRule("effect", { payload })
      ])]
    }],
    selections: { engineer: { stationId: "engineer", actionId: "repair" } }
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  const clonedPayload = report.intents[0].payload;
  assert.equal(Object.getPrototypeOf(clonedPayload), Object.prototype);
  assert.equal(Object.hasOwn(clonedPayload, "__proto__"), true);
  assert.deepEqual(clonedPayload.__proto__, { preserved: true });
  assert.equal(clonedPayload.ordinary, true);
});

test("unexpected hostile reads remain contained and return atomic output", () => {
  const source = state();
  Object.defineProperty(source, "lifecycleState", {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error("Hostile getter must be contained.");
    }
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(hasError(report, "outcome-interpretation-data-read-failed", "$"), true);
  assertAtomic(report);
});

test("safe failure preserves constructed report facts, upstream diagnostics, and warnings", () => {
  const source = state({
    availableStations: [{
      stationId: "captain",
      actions: [{
        actionId: "command",
        outcomeDefinition: {
          effectRules: [effectRule("unused")],
          branches: null
        }
      }]
    }],
    selections: { captain: { stationId: "captain", actionId: "command" } }
  });
  Object.defineProperty(source.currentStage, "stageId", {
    configurable: true,
    enumerable: true,
    get() {
      return "stage";
    }
  });

  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(report.structurallyValid, true);
  assert.equal(report.definitionsValid, false);
  assert.equal(report.pendingChecksValid, true);
  assert.equal(report.resolutionComplete, true);
  assert.equal(report.active, true);
  assert.equal(report.consequences, true);
  assert.equal(report.actionCount, 1);
  assert.equal(report.checkActionCount, 0);
  assert.equal(report.noRollActionCount, 1);
  assert.equal(hasError(report, "invalid-action-outcome-branches"), true);
  assert.equal(hasError(report, "outcome-interpretation-data-read-failed", "$"), true);
  assert.equal(
    report.errors.filter(({ code }) => code === "outcome-interpretation-data-read-failed").length,
    1
  );
  assert.equal(report.warnings.some(({ code }) => code === "unreferenced-effect-rule"), true);
  assertAtomic(report);
});
