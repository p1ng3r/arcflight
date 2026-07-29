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
  stageId = "stage",
  roundNumber = 1,
  phase = "consequences",
  availableStations = [],
  selections = {},
  targets = {},
  committedStationOrder = null
} = {}) {
  for (const station of availableStations) {
    for (const action of station.actions) {
      if (!Object.hasOwn(action, "approaches")) {
        action.approaches = Object.hasOwn(action, "check")
          ? [{
              approachId: `approach-${action.actionId}`,
              statisticSlugOrAbilityId: action.check?.statisticOptions?.[0]
            }]
          : [{
              approachId: `approach-${action.actionId}`,
              noRoll: true
            }];
      }
    }
  }
  for (const [stationId, selection] of Object.entries(selections)) {
    if (Object.hasOwn(selection, "approachId")) continue;
    const action = availableStations
      .find((station) => station.stationId === stationId)
      ?.actions.find((candidate) => candidate.actionId === selection.actionId);
    const approach = action?.approaches?.[0];
    if (!approach) continue;
    selection.approachId = approach.approachId;
    if (approach.noRoll === true) selection.noRoll = true;
    else selection.statisticSlugOrAbilityId = approach.statisticSlugOrAbilityId;
  }

  const result = createVoyageEncounterState({
    encounterId,
    definitionId: "definition",
    primaryShip: { id: "ship" }
  });
  result.lifecycleState = "active";
  result.currentStage = { stageId };
  result.roundNumber = roundNumber;
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

function executionResult(sequence, degreeOfSuccessSlug, overrides = {}) {
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
    warnings: [],
    ...overrides
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
      executionResult(sequence, branches[sequence], {
        dc: nextState.pendingChecks[sequence].finalDc
      })
    );
    assert.equal(applied.ok, true);
    nextState = applied.nextState;
  }
  nextState.phase = "consequences";
  return nextState;
}

function completeLockToConsequences({
  availableStations,
  selections,
  riskBids = {},
  committedOrder,
  resultBranches,
  targets = {}
}) {
  const source = state({
    phase: "crew-planning",
    availableStations,
    selections,
    targets,
    committedStationOrder: []
  });
  source.proposedStationOrder = [...committedOrder];
  source.riskBids = structuredClone(riskBids);
  const sourceBefore = structuredClone(source);

  const locked = applyVoyageEncounterCrewPlanningLock(source, {
    phaseStartSnapshotId: "integration-lock"
  });
  assert.equal(locked.ok, true);
  const resolution = applyVoyageEncounterResolutionTransition(
    locked.nextState,
    { phaseStartSnapshotId: "integration-resolution" }
  );
  assert.equal(resolution.ok, true);
  const execution = prepareVoyageEncounterActionExecutionRequests(
    resolution.nextState
  );
  assert.equal(execution.readyForExecution, true);

  const checkRequests = execution.executionRequests.filter(
    ({ mode }) => mode === "check"
  );
  let prepared = null;
  let resolved = resolution.nextState;
  if (checkRequests.length > 0) {
    prepared = applyVoyageEncounterPendingCheckPreparation(
      resolution.nextState,
      {
        pendingCheckIds: checkRequests.map(({ sequence }) => ({
          sequence,
          pendingCheckId: `integration-pending-${sequence}`
        }))
      }
    );
    assert.equal(prepared.ok, true);
    resolved = prepared.nextState;

    for (const request of checkRequests) {
      const pending = resolved.pendingChecks.find(
        ({ sequence }) => sequence === request.sequence
      );
      const degreeOfSuccessSlug = resultBranches[request.sequence];
      const result = executionResult(request.sequence, degreeOfSuccessSlug, {
        pendingCheckId: pending.pendingCheckId,
        sourceUuid: pending.source.uuid,
        statisticSlug: pending.statisticSlugOrAbilityId,
        dc: pending.finalDc,
        rollMode: pending.secrecy === "secret" ? "blind" : "public",
        result: {
          total: pending.finalDc,
          degreeOfSuccess: CHECK_BRANCHES.indexOf(degreeOfSuccessSlug),
          degreeOfSuccessSlug
        }
      });
      const applied = applyVoyageEncounterPendingCheckResult(resolved, result);
      assert.equal(applied.ok, true);
      resolved = applied.nextState;
    }
  }

  const completion = prepareVoyageEncounterResolutionCompletion(resolved);
  assert.equal(completion.readyForConsequences, true);
  const consequences = applyVoyageEncounterConsequencesTransition(
    resolved,
    { phaseStartSnapshotId: "integration-consequences" }
  );
  assert.equal(consequences.ok, true);
  const report = analyzeVoyageEncounterActionOutcomes(consequences.nextState);

  return {
    source,
    sourceBefore,
    locked,
    resolution,
    execution,
    prepared,
    resolved,
    completion,
    consequences,
    report
  };
}

function resolvedSelectedRiskBid(
  degreeOfSuccessSlug,
  {
    encounterId = "encounter",
    stageId = "stage",
    roundNumber = 1,
    riskBidId = "bid-5",
    dcAdjustment = 5,
    riskEffectId = "risk-effect",
    riskVisibility = "public",
    riskTarget = { kind: "encounter" },
    riskPayload = null,
    selectedTarget = { id: "target" }
  } = {}
) {
  const outcomeField = {
    "critical-failure": "criticalFailure",
    failure: "failure",
    success: "success",
    "critical-success": "criticalSuccess"
  }[degreeOfSuccessSlug];
  const action = checkAction(
    "command",
    0,
    degreeOfSuccessSlug,
    "normal-effect"
  );
  action.approaches = [{
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy"
  }];
  action.riskBidOptions = [
    riskBidOption(riskBidId, dcAdjustment, {
      [outcomeField]: [riskEffectId]
    })
  ];
  action.outcomeDefinition.effectRules.push({
    ...effectRule(riskEffectId, {
      target: riskTarget,
      payload: riskPayload
    }),
    visibility: riskVisibility
  });
  const source = state({
    encounterId,
    stageId,
    roundNumber,
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
    targets: { captain: selectedTarget }
  });
  source.riskBids.captain = {
    stationId: "captain",
    actionId: "command",
    riskBidId,
    dcAdjustment
  };
  return resolveChecks(source, [degreeOfSuccessSlug]);
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

test("no selected Risk Bid preserves normal behavior for all four degrees", () => {
  for (const branch of CHECK_BRANCHES) {
    const action = checkAction("command", 0, branch, `normal-${branch}`);
    const resolved = resolveChecks(state({
      phase: "resolution",
      availableStations: [{
        stationId: "captain",
        actions: [action]
      }],
      selections: {
        captain: { stationId: "captain", actionId: "command" }
      }
    }), [branch]);
    const report = analyzeVoyageEncounterActionOutcomes(resolved);
    assert.equal(report.readyForInterpretation, true);
    assert.deepEqual(report.actions[0].branchEffectIds, [`normal-${branch}`]);
    assert.deepEqual(report.actions[0].riskBidEffectIds, []);
    assert.deepEqual(
      report.intents.map(({ effectId }) => effectId),
      [`normal-${branch}`]
    );
  }
});

test("selected Risk Bid resolves the same degree and applies the canonical normal-branch matrix", () => {
  for (const branch of CHECK_BRANCHES) {
    const resolved = resolvedSelectedRiskBid(branch);
    const before = structuredClone(resolved);
    const report = analyzeVoyageEncounterActionOutcomes(resolved);
    const normalActive = branch === "success" || branch === "critical-success";

    assert.equal(report.readyForInterpretation, true, branch);
    assert.equal(report.interpretedActionCount, 1, branch);
    assert.equal(report.actions[0].branch, branch);
    assert.equal(report.actions[0].riskBidId, "bid-5");
    assert.equal(report.actions[0].dcAdjustment, 5);
    assert.deepEqual(
      report.actions[0].branchEffectIds,
      normalActive ? ["normal-effect"] : [],
      branch
    );
    assert.deepEqual(report.actions[0].riskBidEffectIds, ["risk-effect"]);
    assert.deepEqual(
      report.intents.map(({ effectId }) => effectId),
      normalActive
        ? ["normal-effect", "risk-effect"]
        : ["risk-effect"],
      branch
    );
    assert.deepEqual(
      report.intents.map(({ activationSource }) => activationSource),
      normalActive ? ["branch", "risk-bid"] : ["risk-bid"],
      branch
    );
    assert.deepEqual(
      report.actions[0].intentIds,
      report.intents.map(({ intentId }) => intentId),
      branch
    );
    assert.equal(resolved.pendingChecks.length, 1, branch);
    assert.deepEqual(resolved, before, branch);
  }
});

test("empty selected Risk Bid branches emit no bid intents or fallback effects", () => {
  const outcomeFields = {
    "critical-failure": "criticalFailure",
    failure: "failure",
    success: "success",
    "critical-success": "criticalSuccess"
  };

  for (const branch of CHECK_BRANCHES) {
    const resolved = resolvedSelectedRiskBid(branch);
    resolved.availableStations[0].actions[0]
      .riskBidOptions[0].outcomes[outcomeFields[branch]] = [];
    const report = analyzeVoyageEncounterActionOutcomes(resolved);
    const normalActive = branch === "success" || branch === "critical-success";

    assert.equal(report.readyForInterpretation, true, branch);
    assert.deepEqual(report.actions[0].riskBidEffectIds, [], branch);
    assert.deepEqual(
      report.intents.map(({ effectId }) => effectId),
      normalActive ? ["normal-effect"] : [],
      branch
    );
    assert.equal(
      report.intents.some(({ activationSource }) => activationSource === "risk-bid"),
      false,
      branch
    );
  }
});

test("combined intents preserve authored source order and action intent ID order", () => {
  const resolved = resolvedSelectedRiskBid("success");
  const action = resolved.availableStations[0].actions[0];
  action.outcomeDefinition.effectRules.push(
    effectRule("normal-second"),
    effectRule("risk-second")
  );
  action.outcomeDefinition.branches.success = [
    "normal-second",
    "normal-effect"
  ];
  action.riskBidOptions[0].outcomes.success = [
    "risk-effect",
    "risk-second"
  ];

  const report = analyzeVoyageEncounterActionOutcomes(resolved);

  assert.equal(report.readyForInterpretation, true);
  assert.deepEqual(
    report.actions[0].branchEffectIds,
    ["normal-second", "normal-effect"]
  );
  assert.deepEqual(
    report.actions[0].riskBidEffectIds,
    ["risk-effect", "risk-second"]
  );
  assert.deepEqual(
    report.intents.map(({ effectId }) => effectId),
    ["normal-second", "normal-effect", "risk-effect", "risk-second"]
  );
  assert.deepEqual(
    report.intents.map(({ activationSource }) => activationSource),
    ["branch", "branch", "risk-bid", "risk-bid"]
  );
  assert.deepEqual(
    report.intents.map(({ referenceIndex }) => referenceIndex),
    [0, 1, 0, 1]
  );
  assert.deepEqual(
    report.actions[0].intentIds,
    report.intents.map(({ intentId }) => intentId)
  );
});

test("intent identity separates activation sources and valid reference positions", () => {
  const resolved = resolvedSelectedRiskBid("success");
  const action = resolved.availableStations[0].actions[0];
  action.riskBidOptions[0].outcomes.success = [
    "risk-effect",
    "normal-effect"
  ];

  const first = analyzeVoyageEncounterActionOutcomes(resolved);
  const second = analyzeVoyageEncounterActionOutcomes(resolved);
  const normalShared = first.intents.find(
    (intent) => intent.effectId === "normal-effect"
      && intent.activationSource === "branch"
  );
  const bidShared = first.intents.find(
    (intent) => intent.effectId === "normal-effect"
      && intent.activationSource === "risk-bid"
  );

  assert.equal(first.readyForInterpretation, true);
  assert.equal(normalShared.referenceIndex, 0);
  assert.equal(bidShared.referenceIndex, 1);
  assert.notEqual(normalShared.intentId, bidShared.intentId);
  assert.deepEqual(
    first.intents.map(({ intentId }) => intentId),
    second.intents.map(({ intentId }) => intentId)
  );
  assert.equal(
    normalShared.intentId,
    `arcflight-intent:${JSON.stringify([
      "encounter",
      "stage",
      1,
      0,
      "branch",
      0,
      "normal-effect"
    ])}`
  );
  assert.equal(
    bidShared.intentId,
    `arcflight-intent:${JSON.stringify([
      "encounter",
      "stage",
      1,
      0,
      "risk-bid",
      1,
      "normal-effect"
    ])}`
  );
});

test("selected Risk Bid intent IDs distinguish stages rounds and action sequences", () => {
  const stageOneRoundOne = analyzeVoyageEncounterActionOutcomes(
    resolvedSelectedRiskBid("success", {
      stageId: "stage-one",
      roundNumber: 1
    })
  );
  const stageTwoRoundOne = analyzeVoyageEncounterActionOutcomes(
    resolvedSelectedRiskBid("success", {
      stageId: "stage-two",
      roundNumber: 1
    })
  );
  const stageOneRoundTwo = analyzeVoyageEncounterActionOutcomes(
    resolvedSelectedRiskBid("success", {
      stageId: "stage-one",
      roundNumber: 2
    })
  );
  const riskIntentId = (report) => report.intents.find(
    ({ activationSource }) => activationSource === "risk-bid"
  ).intentId;

  assert.notEqual(riskIntentId(stageOneRoundOne), riskIntentId(stageTwoRoundOne));
  assert.notEqual(riskIntentId(stageOneRoundOne), riskIntentId(stageOneRoundTwo));

  const captainAction = checkAction("command", 0, "success", "captain-normal");
  captainAction.riskBidOptions = [
    riskBidOption("captain-bid", 2, { success: ["captain-risk"] })
  ];
  captainAction.outcomeDefinition.effectRules.push(effectRule("captain-risk"));
  const engineerAction = checkAction("repair", 1, "success", "engineer-normal");
  engineerAction.riskBidOptions = [
    riskBidOption("engineer-bid", 5, { success: ["engineer-risk"] })
  ];
  engineerAction.outcomeDefinition.effectRules.push(effectRule("engineer-risk"));
  const source = state({
    phase: "resolution",
    availableStations: [
      { stationId: "captain", actions: [captainAction] },
      { stationId: "engineer", actions: [engineerAction] }
    ],
    selections: {
      captain: { stationId: "captain", actionId: "command" },
      engineer: { stationId: "engineer", actionId: "repair" }
    },
    committedStationOrder: ["captain", "engineer"]
  });
  source.riskBids.captain = {
    stationId: "captain",
    actionId: "command",
    riskBidId: "captain-bid",
    dcAdjustment: 2
  };
  source.riskBids.engineer = {
    stationId: "engineer",
    actionId: "repair",
    riskBidId: "engineer-bid",
    dcAdjustment: 5
  };
  const report = analyzeVoyageEncounterActionOutcomes(
    resolveChecks(source, ["success", "success"])
  );
  const bidIntents = report.intents.filter(
    ({ activationSource }) => activationSource === "risk-bid"
  );

  assert.deepEqual(
    report.intents.map(({ effectId }) => effectId),
    ["captain-normal", "captain-risk", "engineer-normal", "engineer-risk"]
  );
  assert.deepEqual(bidIntents.map(({ sequence }) => sequence), [0, 1]);
  assert.notEqual(bidIntents[0].intentId, bidIntents[1].intentId);
});

test("Risk Bid intent preserves authoritative metadata target selection payload and secrecy", () => {
  const source = resolvedSelectedRiskBid("success", {
    riskBidId: "bid-8",
    dcAdjustment: 8,
    riskVisibility: "gm-secret",
    riskTarget: {
      kind: "station",
      targetId: "engineer"
    },
    riskPayload: {
      nested: {
        values: [1, { amount: 2 }]
      }
    },
    selectedTarget: {
      id: "selected",
      nested: { value: 3 }
    }
  });
  const before = structuredClone(source);
  const first = analyzeVoyageEncounterActionOutcomes(source);
  const riskIntent = first.intents[1];

  assert.equal(riskIntent.riskBidId, "bid-8");
  assert.equal(riskIntent.dcAdjustment, 8);
  assert.equal(riskIntent.branch, "success");
  assert.equal(riskIntent.visibility, "gm-secret");
  assert.deepEqual(riskIntent.target, {
    kind: "station",
    targetId: "engineer"
  });
  assert.deepEqual(riskIntent.selectedTarget, {
    id: "selected",
    nested: { value: 3 }
  });
  assert.deepEqual(riskIntent.payload, {
    nested: {
      values: [1, { amount: 2 }]
    }
  });

  riskIntent.target.targetId = "changed";
  riskIntent.selectedTarget.nested.value = 30;
  riskIntent.payload.nested.values[1].amount = 20;
  first.actions[0].riskBidEffectIds[0] = "changed";
  first.actions[0].intentIds[1] = "changed";
  assert.equal(first.intents[0].selectedTarget.nested.value, 3);

  const second = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(second.intents[1].target.targetId, "engineer");
  assert.equal(second.intents[1].selectedTarget.nested.value, 3);
  assert.equal(second.intents[1].payload.nested.values[1].amount, 2);
  assert.deepEqual(second.actions[0].riskBidEffectIds, ["risk-effect"]);
  assert.notEqual(second.actions[0].intentIds[1], "changed");
  assert.deepEqual(source, before);
});

test("normal and Risk Bid intents preserve exact cross-station, pressure-system, and Hazard targets", () => {
  const targets = [
    { kind: "station", targetId: "navigator" },
    { kind: "pressure-system", targetId: "levstone-array" },
    { kind: "hazard", targetId: "solar-sail-fire" }
  ];
  for (const riskTarget of targets) {
    const source = resolvedSelectedRiskBid("success", {
      riskTarget,
      selectedTarget: { kind: "station", targetId: "engineer" },
      riskVisibility: "gm-secret"
    });
    const action = source.availableStations[0].actions[0];
    const normalTarget = { kind: "station", targetId: "navigator" };
    action.outcomeDefinition.effectRules[0].target = normalTarget;
    action.outcomeDefinition.effectRules[0].visibility = "gm-secret";
    const before = structuredClone(source);
    const report = analyzeVoyageEncounterActionOutcomes(source);

    assert.equal(report.readyForInterpretation, true, riskTarget.kind);
    assert.deepEqual(report.intents[0].target, normalTarget, riskTarget.kind);
    assert.deepEqual(report.intents[1].target, riskTarget, riskTarget.kind);
    assert.deepEqual(report.intents[0].selectedTarget, {
      kind: "station",
      targetId: "engineer"
    }, riskTarget.kind);
    assert.deepEqual(report.intents[1].selectedTarget, {
      kind: "station",
      targetId: "engineer"
    }, riskTarget.kind);
    assert.equal(report.intents[0].visibility, "gm-secret", riskTarget.kind);
    assert.equal(report.intents[1].visibility, "gm-secret", riskTarget.kind);
    assert.deepEqual(source, before, riskTarget.kind);
  }
});

test("selected-target remains an authored marker distinct from selectedTarget data", () => {
  const source = resolvedSelectedRiskBid("success", {
    riskTarget: { kind: "selected-target" },
    selectedTarget: { kind: "station", targetId: "navigator" }
  });
  const report = analyzeVoyageEncounterActionOutcomes(source);

  assert.equal(report.readyForInterpretation, true);
  assert.deepEqual(report.intents[1].target, { kind: "selected-target" });
  assert.deepEqual(report.intents[1].selectedTarget, {
    kind: "station",
    targetId: "navigator"
  });
  assert.notEqual(report.intents[1].target, report.intents[1].selectedTarget);
});

test("invalid normal or Risk Bid targets fail interpretation atomically", () => {
  for (const sourceKind of ["normal", "risk-bid"]) {
    const source = resolvedSelectedRiskBid("success");
    const action = source.availableStations[0].actions[0];
    const effectRule = sourceKind === "normal"
      ? action.outcomeDefinition.effectRules[0]
      : action.outcomeDefinition.effectRules[1];
    effectRule.target = sourceKind === "normal"
      ? { kind: "station", targetId: "unknown-station" }
      : { kind: "pressure-system", targetId: "unknown-system" };
    const before = structuredClone(source);
    const revision = source.revision;
    const report = analyzeVoyageEncounterActionOutcomes(source);

    assertAtomic(report);
    assert.equal(source.revision, revision, sourceKind);
    assert.deepEqual(source, before, sourceKind);
  }
});

test("equivalent target cloning does not change deterministic intent IDs", () => {
  const firstState = resolvedSelectedRiskBid("success", {
    riskTarget: { kind: "station", targetId: "navigator" }
  });
  const secondState = structuredClone(firstState);
  const first = analyzeVoyageEncounterActionOutcomes(firstState);
  const second = analyzeVoyageEncounterActionOutcomes(secondState);

  assert.deepEqual(
    first.intents.map(({ intentId }) => intentId),
    second.intents.map(({ intentId }) => intentId)
  );
});

test("invalid ambiguous and hostile Risk Bid effect data fail atomically", () => {
  {
    const source = resolvedSelectedRiskBid("success");
    source.availableStations[0].actions[0]
      .riskBidOptions[0].outcomes.success = ["missing"];
    const before = structuredClone(source);
    const report = analyzeVoyageEncounterActionOutcomes(source);
    assertAtomic(report);
    assert.equal(hasError(report, "missing-effect-reference"), true);
    assert.equal(
      hasError(report, "outcome-interpretation-risk-bid-effect-rule-missing"),
      true
    );
    assert.deepEqual(source, before);
  }

  {
    const source = resolvedSelectedRiskBid("success");
    source.availableStations[0].actions[0]
      .outcomeDefinition.effectRules.push(effectRule("risk-effect"));
    const before = structuredClone(source);
    const report = analyzeVoyageEncounterActionOutcomes(source);
    assertAtomic(report);
    assert.equal(hasError(report, "duplicate-effect-id"), true);
    assert.equal(
      hasError(report, "outcome-interpretation-risk-bid-effect-rule-ambiguous"),
      true
    );
    assert.deepEqual(source, before);
  }

  {
    const source = resolvedSelectedRiskBid("success");
    const payload = source.availableStations[0].actions[0]
      .outcomeDefinition.effectRules[1].payload = {};
    payload.self = payload;
    const report = analyzeVoyageEncounterActionOutcomes(source);
    assertAtomic(report);
    assert.equal(hasError(report, "invalid-effect-payload"), true);
  }
});

test("selected Risk Bid branch emits without introducing another roll or pending check", () => {
  const resolved = resolvedSelectedRiskBid("success");
  const before = structuredClone(resolved);
  const report = analyzeVoyageEncounterActionOutcomes(resolved);
  assert.equal(resolved.pendingChecks.length, 1);
  assert.equal(report.checkActionCount, 1);
  assert.equal(report.actions.length, 1);
  assert.deepEqual(report.actions[0].riskBidEffectIds, ["risk-effect"]);
  assert.deepEqual(
    report.intents.map(({ effectId }) => effectId),
    ["normal-effect", "risk-effect"]
  );
  assert.deepEqual(resolved, before);
});

test("selected Risk Bid metadata survives outcome analysis and activates its branch", () => {
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
  assert.equal(report.intentCount, 2);
  assert.equal(report.actions[0].riskBidId, "bid-5");
  assert.equal(report.actions[0].dcAdjustment, 5);
  assert.deepEqual(report.actions[0].riskBidEffectIds, ["risk-effect"]);
  assert.equal(report.intents[0].effectId, "normal-effect");
  assert.equal(report.intents[0].riskBidId, "bid-5");
  assert.equal(report.intents[0].dcAdjustment, 5);
  assert.equal(report.intents[0].activationSource, "branch");
  assert.equal(report.intents[1].effectId, "risk-effect");
  assert.equal(report.intents[1].riskBidId, "bid-5");
  assert.equal(report.intents[1].dcAdjustment, 5);
  assert.equal(report.intents[1].activationSource, "risk-bid");
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

test("unknown IDs, mismatched tiers, and cross-authority contradictions fail atomically", () => {
  const fixtures = [
    {
      name: "unknown stored ID",
      mutate(value) {
        value.riskBids.captain.riskBidId = "unknown";
      },
      code: "risk-bid-not-available"
    },
    {
      name: "mismatched stored tier",
      mutate(value) {
        value.riskBids.captain.dcAdjustment = 8;
      },
      code: "risk-bid-dc-adjustment-mismatch"
    },
    {
      name: "contradictory pending ID",
      mutate(value) {
        value.pendingChecks[0].riskBidId = "other";
      },
      code: "pending-check-request-mismatch"
    },
    {
      name: "contradictory pending tier",
      mutate(value) {
        value.pendingChecks[0].dcAdjustment = 8;
      },
      code: "pending-check-request-mismatch"
    },
    {
      name: "contradictory selected action",
      mutate(value) {
        value.selections.captain.actionId = "other";
      },
      code: "selected-action-not-available"
    },
    {
      name: "contradictory authored option ID",
      mutate(value) {
        value.availableStations[0].actions[0]
          .riskBidOptions[0].riskBidId = "other";
      },
      code: "risk-bid-not-available"
    }
  ];

  for (const fixture of fixtures) {
    const source = resolvedSelectedRiskBid("success");
    const revision = source.revision;
    fixture.mutate(source);
    const before = structuredClone(source);
    const report = analyzeVoyageEncounterActionOutcomes(source);
    assertAtomic(report);
    assert.equal(hasError(report, fixture.code), true, fixture.name);
    assert.deepEqual(source, before, fixture.name);
    assert.equal(source.revision, revision, fixture.name);
  }
});

test("duplicate and ambiguous authored Risk Bid options fail atomically", () => {
  const source = resolvedSelectedRiskBid("success");
  const option = source.availableStations[0].actions[0].riskBidOptions[0];
  source.availableStations[0].actions[0].riskBidOptions.push(
    structuredClone(option)
  );
  const before = structuredClone(source);
  const report = analyzeVoyageEncounterActionOutcomes(source);
  assertAtomic(report);
  assert.equal(
    hasError(report, "duplicate-risk-bid-id")
      || hasError(report, "outcome-interpretation-risk-bid-option-ambiguous"),
    true
  );
  assert.deepEqual(source, before);
});

test("missing invalid sparse and inherited Risk Bid outcome branches fail atomically", () => {
  const fixtures = [
    {
      name: "missing",
      mutate(branches) {
        delete branches.success;
      },
      code: "missing-risk-bid-outcome-branch"
    },
    {
      name: "invalid",
      mutate(branches) {
        branches.success = {};
      },
      code: "invalid-risk-bid-outcome-branch"
    },
    {
      name: "sparse",
      mutate(branches) {
        delete branches.success[0];
      },
      code: "sparse-risk-bid-outcome-branch"
    },
    {
      name: "cyclic",
      mutate(branches) {
        branches.success[0] = branches.success;
      },
      code: "invalid-effect-reference"
    }
  ];

  for (const fixture of fixtures) {
    const source = resolvedSelectedRiskBid("success");
    const branches = source.availableStations[0].actions[0]
      .riskBidOptions[0].outcomes;
    fixture.mutate(branches);
    const report = analyzeVoyageEncounterActionOutcomes(source);
    assertAtomic(report);
    assert.equal(hasError(report, fixture.code), true, fixture.name);
  }

  const inherited = resolvedSelectedRiskBid("success");
  const branch = inherited.availableStations[0].actions[0]
    .riskBidOptions[0].outcomes.success;
  let reads = 0;
  delete branch[0];
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 0, {
    get() {
      reads += 1;
      return "risk-effect";
    }
  });
  Object.setPrototypeOf(branch, prototype);
  const report = analyzeVoyageEncounterActionOutcomes(inherited);
  assertAtomic(report);
  assert.equal(hasError(report, "sparse-risk-bid-outcome-branch"), true);
  assert.equal(reads, 0);
});

test("authored Risk Bid accessors symbols unsafe IDs and descriptor failures are contained", () => {
  {
    const source = resolvedSelectedRiskBid("success");
    const option = source.availableStations[0].actions[0].riskBidOptions[0];
    let reads = 0;
    Object.defineProperty(option, "riskBidId", {
      enumerable: true,
      get() {
        reads += 1;
        return "bid-5";
      }
    });
    const report = analyzeVoyageEncounterActionOutcomes(source);
    assertAtomic(report);
    assert.equal(hasError(report, "outcome-data-read-failed"), true);
    assert.equal(reads, 0);
  }

  {
    const source = resolvedSelectedRiskBid("success");
    source.availableStations[0].actions[0]
      .riskBidOptions[0][Symbol("hostile")] = true;
    const report = analyzeVoyageEncounterActionOutcomes(source);
    assertAtomic(report);
    assert.equal(hasError(report, "unexpected-risk-bid-option-field"), true);
  }

  {
    const source = resolvedSelectedRiskBid("success");
    source.availableStations[0].actions[0]
      .riskBidOptions[0].riskBidId = "__proto__";
    const report = analyzeVoyageEncounterActionOutcomes(source);
    assertAtomic(report);
    assert.equal(hasError(report, "unsafe-risk-bid-key"), true);
  }

  {
    const source = resolvedSelectedRiskBid("success");
    const options = source.availableStations[0].actions[0].riskBidOptions;
    source.availableStations[0].actions[0].riskBidOptions = new Proxy(
      options,
      {
        ownKeys() {
          throw new Error("hostile descriptor");
        }
      }
    );
    assert.doesNotThrow(() => analyzeVoyageEncounterActionOutcomes(source));
    const report = analyzeVoyageEncounterActionOutcomes(source);
    assertAtomic(report);
    assert.equal(hasError(report, "outcome-data-read-failed"), true);
  }
});

test("hostile declared Risk Bid branch length is rejected without dense-length work", () => {
  const source = resolvedSelectedRiskBid("success");
  const branch = source.availableStations[0].actions[0]
    .riskBidOptions[0].outcomes.success;
  branch.length = 0xffffffff;
  const report = analyzeVoyageEncounterActionOutcomes(source);
  assertAtomic(report);
  assert.equal(hasError(report, "sparse-risk-bid-outcome-branch"), true);
});

test("Risk Bids on no-roll actions and committed no-roll approaches are rejected", () => {
  const noRoll = noRollAction("command", []);
  noRoll.riskBidOptions = [riskBidOption("bid-2", 2)];
  let source = state({
    availableStations: [{
      stationId: "captain",
      actions: [noRoll]
    }],
    selections: {
      captain: { stationId: "captain", actionId: "command" }
    }
  });
  source.riskBids.captain = {
    stationId: "captain",
    actionId: "command",
    riskBidId: "bid-2",
    dcAdjustment: 2
  };
  let report = analyzeVoyageEncounterActionOutcomes(source);
  assertAtomic(report);
  assert.equal(
    hasError(report, "no-roll-risk-bid-options")
      || hasError(report, "risk-bid-requires-rolled-approach"),
    true
  );

  const mixed = checkAction("mixed", 0, "success", "normal-effect");
  mixed.approaches = [
    { approachId: "rolled", statisticSlugOrAbilityId: "diplomacy" },
    { approachId: "automatic", noRoll: true }
  ];
  mixed.riskBidOptions = [riskBidOption("bid-2", 2)];
  source = state({
    availableStations: [{
      stationId: "captain",
      actions: [mixed]
    }],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "mixed",
        approachId: "automatic",
        noRoll: true
      }
    }
  });
  source.riskBids.captain = {
    stationId: "captain",
    actionId: "mixed",
    riskBidId: "bid-2",
    dcAdjustment: 2
  };
  report = analyzeVoyageEncounterActionOutcomes(source);
  assertAtomic(report);
  assert.equal(hasError(report, "risk-bid-requires-rolled-approach"), true);
});

test("selected Risk Bid analysis preserves GM-secret data and isolates repeated reports", () => {
  const source = resolvedSelectedRiskBid("success", {
    riskVisibility: "gm-secret"
  });
  const before = structuredClone(source);
  const first = analyzeVoyageEncounterActionOutcomes(source);
  const second = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(first.readyForInterpretation, true);
  assert.equal(second.readyForInterpretation, true);
  assert.equal(
    source.availableStations[0].actions[0]
      .outcomeDefinition.effectRules[1].visibility,
    "gm-secret"
  );
  first.actions[0].branchEffectIds[0] = "changed";
  first.actions[0].riskBidEffectIds[0] = "changed";
  first.intents[1].payload = { changed: true };
  assert.deepEqual(second.actions[0].branchEffectIds, ["normal-effect"]);
  assert.deepEqual(second.actions[0].riskBidEffectIds, ["risk-effect"]);
  assert.equal(second.intents[1].visibility, "gm-secret");
  assert.equal(second.intents[1].activationSource, "risk-bid");
  assert.notDeepEqual(first.actions, second.actions);
  assert.notEqual(first.intents, second.intents);
  assert.deepEqual(source, before);
});

test("all four selected Risk Bid degrees survive the complete lock-to-Consequences pipeline", () => {
  for (const branch of CHECK_BRANCHES) {
    const action = checkAction("command", 0, branch, `normal-${branch}`);
    action.approaches = [{
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy"
    }];
    const outcomeField = {
      "critical-failure": "criticalFailure",
      failure: "failure",
      success: "success",
      "critical-success": "criticalSuccess"
    }[branch];
    action.riskBidOptions = [riskBidOption("bid-5", 5, {
      [outcomeField]: [`risk-${branch}`]
    })];
    action.outcomeDefinition.effectRules.push(
      effectRule(`risk-${branch}`, {
        target: { kind: "station", targetId: "navigator" },
        payload: { branch }
      })
    );
    const pipeline = completeLockToConsequences({
      availableStations: [{ stationId: "captain", actions: [action] }],
      selections: {
        captain: {
          stationId: "captain",
          actionId: "command",
          approachId: "diplomacy",
          statisticSlugOrAbilityId: "diplomacy"
        }
      },
      riskBids: {
        captain: {
          stationId: "captain",
          actionId: "command",
          riskBidId: "bid-5",
          dcAdjustment: 5
        }
      },
      committedOrder: ["captain"],
      resultBranches: { 0: branch },
      targets: { captain: { kind: "hazard", targetId: "solar-sail-fire" } }
    });
    const normalActive = branch === "success" || branch === "critical-success";
    const pending = pipeline.resolved.pendingChecks[0];
    const report = pipeline.report;

    assert.deepEqual(pipeline.source, pipeline.sourceBefore, branch);
    assert.deepEqual(pipeline.locked.events[0].riskBids, [{
      stationId: "captain",
      actionId: "command",
      riskBidId: "bid-5",
      dcAdjustment: 5
    }], branch);
    assert.deepEqual(
      pipeline.locked.nextState.snapshots.at(-1).temporaryState.riskBids,
      pipeline.source.riskBids,
      branch
    );
    assert.deepEqual(pipeline.resolution.events[0].orderedActions, [{
      sequence: 0,
      stationId: "captain",
      actionId: "command",
      resolutionPriority: 0,
      riskBidId: "bid-5",
      dcAdjustment: 5
    }], branch);
    assert.deepEqual(
      pipeline.resolution.nextState.snapshots.at(-1).temporaryState.riskBids,
      pipeline.source.riskBids,
      branch
    );
    assert.equal(pipeline.execution.executionRequests.length, 1, branch);
    assert.deepEqual({
      approachId: pipeline.execution.executionRequests[0].approachId,
      statisticSlugOrAbilityId: pipeline.execution.executionRequests[0].statisticSlugOrAbilityId,
      riskBidId: pipeline.execution.executionRequests[0].riskBidId,
      dcAdjustment: pipeline.execution.executionRequests[0].dcAdjustment,
      baseDc: pipeline.execution.executionRequests[0].baseDc,
      actionDcAdjustment: pipeline.execution.executionRequests[0].actionDcAdjustment,
      upgradeDcReduction: pipeline.execution.executionRequests[0].upgradeDcReduction,
      riskBidDcAdjustment: pipeline.execution.executionRequests[0].riskBidDcAdjustment,
      finalDc: pipeline.execution.executionRequests[0].finalDc
    }, {
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy",
      riskBidId: "bid-5",
      dcAdjustment: 5,
      baseDc: 20,
      actionDcAdjustment: 0,
      upgradeDcReduction: 0,
      riskBidDcAdjustment: 5,
      finalDc: 25
    }, branch);
    assert.equal(pipeline.prepared.nextState.pendingChecks.length, 1, branch);
    assert.equal(pending.riskBidId, "bid-5", branch);
    assert.equal(pending.dcAdjustment, 5, branch);
    assert.equal(pending.approachId, "diplomacy", branch);
    assert.equal(pending.statisticSlugOrAbilityId, "diplomacy", branch);
    assert.equal(pending.finalDc, 25, branch);
    assert.equal(pending.result.degreeOfSuccessSlug, branch, branch);
    assert.equal(pending.result.statisticSlug, "diplomacy", branch);
    assert.equal(pending.result.dc, 25, branch);
    assert.equal(pipeline.resolved.pendingChecks.length, 1, branch);
    assert.equal(pipeline.completion.resolvedCheckCount, 1, branch);
    assert.equal(pipeline.consequences.nextState.phase, "consequences", branch);
    assert.deepEqual(
      pipeline.consequences.nextState.snapshots.at(-1).temporaryState.riskBids,
      pipeline.source.riskBids,
      branch
    );
    assert.equal(report.readyForInterpretation, true, branch);
    assert.equal(report.actions.length, 1, branch);
    assert.equal(report.actions[0].branch, branch, branch);
    assert.deepEqual(report.actions[0].branchEffectIds, normalActive ? [`normal-${branch}`] : [], branch);
    assert.deepEqual(report.actions[0].riskBidEffectIds, [`risk-${branch}`], branch);
    assert.deepEqual(report.intents.map(({ effectId }) => effectId), normalActive
      ? [`normal-${branch}`, `risk-${branch}`]
      : [`risk-${branch}`], branch);
    assert.deepEqual(report.intents.map(({ activationSource }) => activationSource), normalActive
      ? ["branch", "risk-bid"]
      : ["risk-bid"], branch);
    const riskIntent = report.intents.find(({ activationSource }) => activationSource === "risk-bid");
    assert.deepEqual(riskIntent.target, { kind: "station", targetId: "navigator" }, branch);
    assert.deepEqual(riskIntent.selectedTarget, { kind: "hazard", targetId: "solar-sail-fire" }, branch);
    assert.deepEqual(riskIntent.payload, { branch }, branch);
    assert.equal(riskIntent.riskBidId, "bid-5", branch);
    assert.equal(riskIntent.dcAdjustment, 5, branch);
  }
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
  assert.equal(
    Object.hasOwn(execution.executionRequests[0], "dcSource"),
    false
  );
  assert.equal(
    Object.hasOwn(execution.executionRequests[0], "statisticOptions"),
    false
  );
  assert.deepEqual(
    {
      baseDc: execution.executionRequests[0].baseDc,
      actionDcAdjustment: execution.executionRequests[0].actionDcAdjustment,
      upgradeDcReduction: execution.executionRequests[0].upgradeDcReduction,
      riskBidDcAdjustment: execution.executionRequests[0].riskBidDcAdjustment,
      finalDc: execution.executionRequests[0].finalDc
    },
    {
      baseDc: 20,
      actionDcAdjustment: 0,
      upgradeDcReduction: 0,
      riskBidDcAdjustment: 5,
      finalDc: 25
    }
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
  assert.equal(prepared.nextState.pendingChecks[0].approachId, "diplomacy");
  assert.equal(
    prepared.nextState.pendingChecks[0].statisticSlugOrAbilityId,
    "diplomacy"
  );
  assert.equal(prepared.nextState.pendingChecks[0].finalDc, 25);
  assert.equal(Object.hasOwn(prepared.nextState.pendingChecks[0], "dcSource"), false);
  assert.equal(Object.hasOwn(prepared.nextState.pendingChecks[0], "statisticOptions"), false);

  const resolved = applyVoyageEncounterPendingCheckResult(
    prepared.nextState,
    {
      ...executionResult(0, "success"),
      pendingCheckId: "integration-pending",
      dc: 25
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
  assert.deepEqual(report.actions[0].riskBidEffectIds, ["risk-effect"]);
  assert.deepEqual(
    report.intents.map(({ effectId }) => effectId),
    ["normal-effect", "risk-effect"]
  );
  assert.equal(report.intents[0].riskBidId, "bid-5");
  assert.equal(report.intents[0].dcAdjustment, 5);
  assert.equal(report.intents[0].activationSource, "branch");
  assert.equal(report.intents[1].riskBidId, "bid-5");
  assert.equal(report.intents[1].dcAdjustment, 5);
  assert.equal(report.intents[1].activationSource, "risk-bid");
});

test("all four no-bid degrees survive the complete lock-to-Consequences pipeline unchanged", () => {
  for (const branch of CHECK_BRANCHES) {
    const action = checkAction("command", 0, branch, `normal-${branch}`);
    action.approaches = [{
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy"
    }];
    const pipeline = completeLockToConsequences({
      availableStations: [{ stationId: "captain", actions: [action] }],
      selections: {
        captain: {
          stationId: "captain",
          actionId: "command",
          approachId: "diplomacy",
          statisticSlugOrAbilityId: "diplomacy"
        }
      },
      committedOrder: ["captain"],
      resultBranches: { 0: branch }
    });
    const request = pipeline.execution.executionRequests[0];
    const report = pipeline.report;

    assert.equal(report.readyForInterpretation, true, branch);
    assert.equal(request.riskBidId, null, branch);
    assert.equal(request.dcAdjustment, null, branch);
    assert.equal(request.riskBidDcAdjustment, 0, branch);
    assert.equal(request.finalDc, 20, branch);
    assert.equal(pipeline.prepared.nextState.pendingChecks[0].riskBidId, null, branch);
    assert.equal(pipeline.prepared.nextState.pendingChecks[0].dcAdjustment, null, branch);
    assert.deepEqual(report.actions[0].branchEffectIds, [`normal-${branch}`], branch);
    assert.deepEqual(report.actions[0].riskBidEffectIds, [], branch);
    assert.deepEqual(report.intents.map(({ effectId }) => effectId), [`normal-${branch}`], branch);
    assert.deepEqual(report.intents.map(({ activationSource }) => activationSource), ["branch"], branch);
    assert.equal(report.intents[0].riskBidId, null, branch);
    assert.equal(report.intents[0].dcAdjustment, null, branch);
  }
});

test("no-roll actions survive the complete lock-to-Consequences pipeline without roll data", () => {
  const action = noRollAction("command", ["no-roll-effect"], [
    effectRule("no-roll-effect", {
      target: { kind: "source-station" },
      payload: { unchanged: true }
    })
  ]);
  const pipeline = completeLockToConsequences({
    availableStations: [{ stationId: "captain", actions: [action] }],
    selections: {
      captain: { stationId: "captain", actionId: "command" }
    },
    committedOrder: ["captain"],
    resultBranches: {}
  });
  const report = pipeline.report;

  assert.equal(pipeline.execution.executionRequests.length, 1);
  assert.equal(pipeline.execution.executionRequests[0].mode, "no-roll");
  assert.equal(pipeline.prepared, null);
  assert.equal(pipeline.resolved.pendingChecks.length, 0);
  assert.equal(pipeline.completion.checkCount, 0);
  assert.equal(pipeline.completion.pendingCheckCount, 0);
  assert.equal(report.readyForInterpretation, true);
  assert.equal(report.checkActionCount, 0);
  assert.equal(report.noRollActionCount, 1);
  assert.deepEqual(report.actions[0].riskBidEffectIds, []);
  assert.deepEqual(report.intents.map(({ effectId }) => effectId), ["no-roll-effect"]);
  assert.deepEqual(report.intents.map(({ activationSource }) => activationSource), ["branch"]);
  for (const record of [report.actions[0], report.intents[0]]) {
    for (const field of ROLL_DETAILS) assert.equal(Object.hasOwn(record, field), false);
  }
});

test("mixed multi-station pipeline preserves committed order, station-local bids, and three-bid maximum", () => {
  const captain = checkAction("command", 0, "critical-success", "shared-normal");
  captain.approaches = [{ approachId: "diplomacy", statisticSlugOrAbilityId: "diplomacy" }];
  captain.riskBidOptions = [riskBidOption("captain-bid", 5, { criticalSuccess: ["shared-risk"] })];
  captain.outcomeDefinition.effectRules.push(effectRule("shared-risk"));

  const engineer = checkAction("repair", 1, "failure", "normal-failure");
  engineer.approaches = [{ approachId: "crafting", statisticSlugOrAbilityId: "crafting" }];
  engineer.riskBidOptions = [riskBidOption("engineer-bid", 2, { failure: ["shared-risk"] })];
  engineer.outcomeDefinition.effectRules.push(effectRule("shared-risk"));

  const navigator = checkAction("navigate", 2, "success", "shared-normal");
  navigator.approaches = [{ approachId: "survival", statisticSlugOrAbilityId: "survival" }];
  navigator.riskBidOptions = [riskBidOption("navigator-bid", 8, { success: ["shared-risk"] })];
  navigator.outcomeDefinition.effectRules.push(effectRule("shared-risk"));

  const watchmaster = checkAction("watch", 3, "success", "shared-normal");
  watchmaster.approaches = [{ approachId: "perception", statisticSlugOrAbilityId: "perception" }];
  const veilwarden = noRollAction("ward", ["no-roll-effect"]);

  const pipeline = completeLockToConsequences({
    availableStations: [
      { stationId: "captain", actions: [captain] },
      { stationId: "engineer", actions: [engineer] },
      { stationId: "navigator", actions: [navigator] },
      { stationId: "watchmaster", actions: [watchmaster] },
      { stationId: "veilwarden", actions: [veilwarden] }
    ],
    selections: {
      captain: { stationId: "captain", actionId: "command", approachId: "diplomacy", statisticSlugOrAbilityId: "diplomacy" },
      engineer: { stationId: "engineer", actionId: "repair", approachId: "crafting", statisticSlugOrAbilityId: "crafting" },
      navigator: { stationId: "navigator", actionId: "navigate", approachId: "survival", statisticSlugOrAbilityId: "survival" },
      watchmaster: { stationId: "watchmaster", actionId: "watch", approachId: "perception", statisticSlugOrAbilityId: "perception" },
      veilwarden: { stationId: "veilwarden", actionId: "ward" }
    },
    riskBids: {
      captain: { stationId: "captain", actionId: "command", riskBidId: "captain-bid", dcAdjustment: 5 },
      engineer: { stationId: "engineer", actionId: "repair", riskBidId: "engineer-bid", dcAdjustment: 2 },
      navigator: { stationId: "navigator", actionId: "navigate", riskBidId: "navigator-bid", dcAdjustment: 8 }
    },
    committedOrder: ["navigator", "captain", "veilwarden", "engineer", "watchmaster"],
    resultBranches: {
      0: "success",
      1: "critical-success",
      3: "failure",
      4: "success"
    }
  });
  const report = pipeline.report;

  assert.deepEqual(
    report.actions.map(({ stationId, sequence }) => ({ stationId, sequence })),
    [
      { stationId: "navigator", sequence: 0 },
      { stationId: "captain", sequence: 1 },
      { stationId: "veilwarden", sequence: 2 },
      { stationId: "engineer", sequence: 3 },
      { stationId: "watchmaster", sequence: 4 }
    ]
  );
  assert.equal(report.actions.some(({ stationId }) => stationId === "unoccupied"), false);
  assert.deepEqual(pipeline.execution.executionRequests.map(({ sequence }) => sequence), [0, 1, 2, 3, 4]);
  assert.deepEqual(pipeline.resolved.pendingChecks.map(({ sequence }) => sequence), [0, 1, 3, 4]);
  assert.equal(pipeline.resolved.pendingChecks.length, 4);
  assert.equal(pipeline.execution.executionRequests.filter(({ mode }) => mode === "check").length, 4);
  assert.deepEqual(
    report.intents.map(({ sequence, activationSource, effectId }) => ({ sequence, activationSource, effectId })),
    [
      { sequence: 0, activationSource: "branch", effectId: "shared-normal" },
      { sequence: 0, activationSource: "risk-bid", effectId: "shared-risk" },
      { sequence: 1, activationSource: "branch", effectId: "shared-normal" },
      { sequence: 1, activationSource: "risk-bid", effectId: "shared-risk" },
      { sequence: 2, activationSource: "branch", effectId: "no-roll-effect" },
      { sequence: 3, activationSource: "risk-bid", effectId: "shared-risk" },
      { sequence: 4, activationSource: "branch", effectId: "shared-normal" }
    ]
  );
  assert.equal(new Set(report.intents.map(({ intentId }) => intentId)).size, report.intents.length);
  assert.equal(report.actions[1].riskBidId, "captain-bid");
  assert.equal(report.actions[3].riskBidId, "engineer-bid");
  assert.equal(report.actions[0].riskBidId, "navigator-bid");
  assert.equal(report.actions[4].riskBidId, null);
  assert.deepEqual(report.actions[3].branchEffectIds, []);
  assert.deepEqual(report.actions[3].riskBidEffectIds, ["shared-risk"]);
  assert.equal(pipeline.locked.events[0].riskBids.length, 3);
  assert.deepEqual(pipeline.consequences.nextState.riskBids, pipeline.source.riskBids);
});

test("full-pipeline downstream contradictions remain atomically rejected", () => {
  const makePipeline = () => {
    const action = checkAction("command", 0, "success", "normal-effect");
    action.approaches = [{ approachId: "diplomacy", statisticSlugOrAbilityId: "diplomacy" }];
    action.riskBidOptions = [riskBidOption("bid-5", 5, { success: ["risk-effect"] })];
    action.outcomeDefinition.effectRules.push(effectRule("risk-effect"));
    return completeLockToConsequences({
      availableStations: [{ stationId: "captain", actions: [action] }],
      selections: {
        captain: {
          stationId: "captain",
          actionId: "command",
          approachId: "diplomacy",
          statisticSlugOrAbilityId: "diplomacy"
        }
      },
      riskBids: {
        captain: {
          stationId: "captain",
          actionId: "command",
          riskBidId: "bid-5",
          dcAdjustment: 5
        }
      },
      committedOrder: ["captain"],
      resultBranches: { 0: "success" }
    });
  };
  const fixtures = [
    {
      name: "pending Risk Bid ID",
      mutate(stateValue) { stateValue.pendingChecks[0].riskBidId = "other-bid"; }
    },
    {
      name: "pending Risk Bid adjustment",
      mutate(stateValue) { stateValue.pendingChecks[0].dcAdjustment = 8; }
    },
    {
      name: "pending final DC",
      mutate(stateValue) { stateValue.pendingChecks[0].finalDc = 26; }
    },
    {
      name: "pending approach",
      mutate(stateValue) { stateValue.pendingChecks[0].approachId = "other-approach"; }
    },
    {
      name: "pending statistic",
      mutate(stateValue) { stateValue.pendingChecks[0].statisticSlugOrAbilityId = "other-statistic"; }
    },
    {
      name: "persisted result DC",
      mutate(stateValue) { stateValue.pendingChecks[0].result.dc = 26; }
    },
    {
      name: "persisted result statistic",
      mutate(stateValue) { stateValue.pendingChecks[0].result.statisticSlug = "other-statistic"; }
    },
    {
      name: "wrong pending action identity",
      mutate(stateValue) { stateValue.pendingChecks[0].actionId = "other-action"; }
    },
    {
      name: "invalid normal target",
      mutate(stateValue) {
        stateValue.availableStations[0].actions[0]
          .outcomeDefinition.effectRules[0].target = { kind: "station", targetId: "unknown" };
      }
    },
    {
      name: "invalid Risk Bid target",
      mutate(stateValue) {
        stateValue.availableStations[0].actions[0]
          .outcomeDefinition.effectRules[1].target = { kind: "pressure-system", targetId: "unknown" };
      }
    }
  ];

  for (const fixture of fixtures) {
    const pipeline = makePipeline();
    const candidate = structuredClone(pipeline.consequences.nextState);
    const revision = candidate.revision;
    fixture.mutate(candidate);
    const before = structuredClone(candidate);
    const report = analyzeVoyageEncounterActionOutcomes(candidate);

    assertAtomic(report);
    assert.equal(candidate.revision, revision, fixture.name);
    assert.deepEqual(candidate, before, fixture.name);
  }
});

test("full-pipeline snapshots, inputs, and final reports remain isolated", () => {
  const action = checkAction("command", 0, "success", "normal-effect");
  action.approaches = [{ approachId: "diplomacy", statisticSlugOrAbilityId: "diplomacy" }];
  action.riskBidOptions = [riskBidOption("bid-5", 5, { success: ["risk-effect"] })];
  action.outcomeDefinition.effectRules.push(effectRule("risk-effect", {
    target: { kind: "hazard", targetId: "solar-sail-fire" },
    payload: { nested: { value: 1 } }
  }));
  const pipeline = completeLockToConsequences({
    availableStations: [{ stationId: "captain", actions: [action] }],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command",
        approachId: "diplomacy",
        statisticSlugOrAbilityId: "diplomacy"
      }
    },
    riskBids: {
      captain: {
        stationId: "captain",
        actionId: "command",
        riskBidId: "bid-5",
        dcAdjustment: 5
      }
    },
    committedOrder: ["captain"],
    resultBranches: { 0: "success" },
    targets: { captain: { kind: "station", targetId: "navigator" } }
  });
  const sourceBefore = structuredClone(pipeline.source);
  const lockSnapshot = pipeline.locked.nextState.snapshots.at(-1);
  const resolutionSnapshot = pipeline.resolution.nextState.snapshots.at(-1);
  const consequencesSnapshot = pipeline.consequences.nextState.snapshots.at(-1);

  lockSnapshot.temporaryState.riskBids.captain.riskBidId = "changed";
  resolutionSnapshot.temporaryState.riskBids.captain.riskBidId = "changed";
  consequencesSnapshot.temporaryState.riskBids.captain.riskBidId = "changed";
  assert.equal(pipeline.locked.nextState.riskBids.captain.riskBidId, "bid-5");
  assert.equal(pipeline.resolution.nextState.riskBids.captain.riskBidId, "bid-5");
  assert.equal(pipeline.consequences.nextState.riskBids.captain.riskBidId, "bid-5");

  const first = analyzeVoyageEncounterActionOutcomes(pipeline.consequences.nextState);
  first.intents[1].target.targetId = "changed";
  first.intents[1].payload.nested.value = 99;
  first.actions[0].riskBidEffectIds[0] = "changed";
  const second = analyzeVoyageEncounterActionOutcomes(pipeline.consequences.nextState);

  assert.deepEqual(pipeline.source, sourceBefore);
  assert.equal(pipeline.consequences.nextState.riskBids.captain.riskBidId, "bid-5");
  assert.equal(second.intents[1].target.targetId, "solar-sail-fire");
  assert.equal(second.intents[1].payload.nested.value, 1);
  assert.deepEqual(second.actions[0].riskBidEffectIds, ["risk-effect"]);
  assert.deepEqual(second, analyzeVoyageEncounterActionOutcomes(pipeline.consequences.nextState));
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
    approachId: "approach-repair",
    statisticSlugOrAbilityId: "diplomacy",
    finalDc: 20,
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

test("Task 02 controlled payloads survive normal and selected Risk Bid intent emission", () => {
  const normalPayload = { delta: -2 };
  const riskPayload = { delta: 1 };
  const action = checkAction("command", 0, "success", "normal-effect");
  action.approaches = [{ approachId: "diplomacy", statisticSlugOrAbilityId: "diplomacy" }];
  action.outcomeDefinition.effectRules[0] = {
    ...effectRule("normal-effect", {
      target: { kind: "source-station" },
      payload: normalPayload
    }),
    intentType: "dc-change"
  };
  action.riskBidOptions = [riskBidOption("bid-2", 2, { success: ["risk-effect"] })];
  action.outcomeDefinition.effectRules.push({
    ...effectRule("risk-effect", {
      target: { kind: "station", targetId: "navigator" },
      payload: riskPayload
    }),
    intentType: "roll-modifier",
    visibility: "gm-secret"
  });

  const source = state({
    phase: "resolution",
    availableStations: [{ stationId: "captain", actions: [action] }],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command",
        approachId: "diplomacy",
        statisticSlugOrAbilityId: "diplomacy"
      }
    }
  });
  source.riskBids.captain = {
    stationId: "captain",
    actionId: "command",
    riskBidId: "bid-2",
    dcAdjustment: 2
  };

  const report = analyzeVoyageEncounterActionOutcomes(resolveChecks(source, ["success"]));
  assert.equal(report.readyForInterpretation, true);
  assert.deepEqual(report.intents.map(({ activationSource, intentType, timing, visibility, target, payload }) => ({
    activationSource,
    intentType,
    timing,
    visibility,
    target,
    payload
  })), [
    {
      activationSource: "branch",
      intentType: "dc-change",
      timing: "consequences",
      visibility: "public",
      target: { kind: "source-station" },
      payload: { delta: -2 }
    },
    {
      activationSource: "risk-bid",
      intentType: "roll-modifier",
      timing: "consequences",
      visibility: "gm-secret",
      target: { kind: "station", targetId: "navigator" },
      payload: { delta: 1 }
    }
  ]);
  const firstIds = report.intents.map(({ intentId }) => intentId);
  report.intents[0].payload.delta = 99;
  assert.equal(normalPayload.delta, -2);
  assert.equal(riskPayload.delta, 1);
  assert.deepEqual(firstIds, analyzeVoyageEncounterActionOutcomes(resolveChecks(source, ["success"])).intents.map(({ intentId }) => intentId));
});

test("Task 03 controlled intents survive normal and selected Risk Bid emission without application", () => {
  const controlledRule = (effectId, intentType, payload, target, overrides = {}) => ({
    ...effectRule(effectId, { payload, target }),
    intentType,
    ...overrides
  });
  const normalRules = [
    controlledRule("focus", "focus-restoration", { amount: 1 }, { kind: "source-station" }),
    controlledRule("pressure", "pressure-change", { delta: -1 }, { kind: "pressure-system", targetId: "arkengine" }),
    controlledRule("create", "hazard-create", { hazardId: "storm" }, { kind: "encounter" }),
    controlledRule("remove", "hazard-remove", {}, { kind: "hazard", targetId: "storm" }),
    controlledRule("order", "station-order-change", { position: "first" }, { kind: "station", targetId: "captain" }),
    controlledRule("repair", "system-repair", { scope: "temporary" }, { kind: "source-station" }),
    controlledRule("protect", "system-protection", { scope: "next-consequence" }, { kind: "pressure-system", targetId: "arkengine" })
  ];
  const normalAction = noRollAction("command", normalRules.map(({ effectId }) => effectId), normalRules);
  const normal = analyzeVoyageEncounterActionOutcomes(state({
    availableStations: [{ stationId: "captain", actions: [normalAction] }],
    selections: { captain: { stationId: "captain", actionId: "command" } }
  }));
  assert.equal(normal.readyForInterpretation, true);
  assert.deepEqual(normal.intents.map(({ activationSource, intentType, timing, visibility, target, payload }) => ({
    activationSource, intentType, timing, visibility, target, payload
  })), normalRules.map(({ intentType, timing, visibility, target, payload }) => ({
    activationSource: "branch", intentType, timing, visibility, target, payload
  })));

  const riskAction = checkAction("ward", 0, "success", "prevent");
  riskAction.outcomeDefinition.effectRules[0] = controlledRule("prevent", "hazard-prevent", {}, { kind: "hazard", targetId: "storm" });
  riskAction.outcomeDefinition.effectRules.push(controlledRule("suppress", "hazard-suppress", {}, { kind: "selected-target" }, { visibility: "gm-secret" }));
  riskAction.riskBidOptions = [riskBidOption("bid-2", 2, { success: ["prevent", "suppress"] })];
  const riskSource = state({
    phase: "resolution",
    availableStations: [{ stationId: "captain", actions: [riskAction] }],
    selections: { captain: { stationId: "captain", actionId: "ward" } },
    targets: { captain: { targetId: "storm" } }
  });
  riskSource.riskBids.captain = { stationId: "captain", actionId: "ward", riskBidId: "bid-2", dcAdjustment: 2 };
  const risk = analyzeVoyageEncounterActionOutcomes(resolveChecks(riskSource, ["success"]));
  assert.equal(risk.readyForInterpretation, true);
  assert.deepEqual(risk.intents.map(({ activationSource, intentType, timing, visibility, target, payload }) => ({
    activationSource, intentType, timing, visibility, target, payload
  })), [
    { activationSource: "branch", intentType: "hazard-prevent", timing: "consequences", visibility: "public", target: { kind: "hazard", targetId: "storm" }, payload: {} },
    { activationSource: "risk-bid", intentType: "hazard-prevent", timing: "consequences", visibility: "public", target: { kind: "hazard", targetId: "storm" }, payload: {} },
    { activationSource: "risk-bid", intentType: "hazard-suppress", timing: "consequences", visibility: "gm-secret", target: { kind: "selected-target" }, payload: {} }
  ]);
  assert.deepEqual(risk.intents.map(({ intentId }) => intentId), [
    'arcflight-intent:["encounter","stage",1,0,"branch",0,"prevent"]',
    'arcflight-intent:["encounter","stage",1,0,"risk-bid",0,"prevent"]',
    'arcflight-intent:["encounter","stage",1,0,"risk-bid",1,"suppress"]'
  ]);
  assert.equal(Object.hasOwn(risk.intents[0], "application"), false);
});
