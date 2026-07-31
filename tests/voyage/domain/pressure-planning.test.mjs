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
import { analyzeVoyageEncounterPressurePlan } from "../../../scripts/voyage/domain/pressure.js";

const CHECK_BRANCHES = ["critical-failure", "failure", "success", "critical-success"];

function state({
  encounterId = "pressure-encounter",
  stageId = "pressure-stage",
  roundNumber = 1,
  phase = "crew-planning",
  availableStations = [],
  selections = {},
  targets = {},
  committedStationOrder = []
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
  result.committedStationOrder = committedStationOrder;
  return result;
}

function pressureRule(effectId, target, payload, overrides = {}) {
  return {
    effectId,
    intentType: "pressure-change",
    timing: "consequences",
    visibility: "public",
    target,
    payload,
    ...overrides
  };
}

function checkAction(actionId, effectRules, branch = "failure") {
  const branches = Object.fromEntries(CHECK_BRANCHES.map((slug) => [slug, []]));
  branches[branch] = effectRules.map(({ effectId }) => effectId);
  return {
    actionId,
    check: {
      source: { kind: "character", uuid: `Actor.${actionId}` },
      statisticOptions: ["diplomacy"],
      dcSource: { kind: "fixed", value: 20 },
      secrecy: "public",
      metadata: {}
    },
    outcomeDefinition: {
      effectRules,
      branches
    }
  };
}

function noRollAction(actionId, effectRules) {
  return {
    actionId,
    outcomeDefinition: {
      effectRules,
      branches: {
        "no-roll": effectRules.map(({ effectId }) => effectId)
      }
    }
  };
}

function actionIntentId(encounterId, stageId, roundNumber, sequence, activationSource, referenceIndex, effectId) {
  return `arcflight-intent:${JSON.stringify([
    encounterId,
    stageId,
    roundNumber,
    sequence,
    activationSource,
    referenceIndex,
    effectId
  ])}`;
}

function pressureEffectId(encounterId, stageId, roundNumber, sequence, sourceKind, sourceIntentId = null) {
  const components = [encounterId, stageId, roundNumber, sequence, sourceKind];
  if (sourceKind === "outcome-intent") components.push(sourceIntentId);
  return `arcflight-pressure-effect:${JSON.stringify(components)}`;
}

function executionResult(pendingCheck, degreeOfSuccessSlug) {
  return {
    ok: true,
    status: "rolled",
    pendingCheckId: pendingCheck.pendingCheckId,
    sequence: pendingCheck.sequence,
    sourceKind: "character",
    sourceUuid: pendingCheck.source.uuid,
    statisticSlug: pendingCheck.statisticSlugOrAbilityId,
    dc: pendingCheck.finalDc,
    rollMode: pendingCheck.secrecy === "secret" ? "blind" : "public",
    result: {
      total: pendingCheck.finalDc,
      degreeOfSuccess: CHECK_BRANCHES.indexOf(degreeOfSuccessSlug),
      degreeOfSuccessSlug
    },
    errors: [],
    warnings: []
  };
}

function resolveToConsequences(source, resultBranches = []) {
  const working = structuredClone(source);
  working.proposedStationOrder = [...Object.keys(working.selections)];
  working.riskBids = structuredClone(working.riskBids ?? {});
  working.committedStationOrder = [];

  const locked = applyVoyageEncounterCrewPlanningLock(working, {
    phaseStartSnapshotId: "pressure-lock"
  });
  assert.equal(locked.ok, true);

  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, {
    phaseStartSnapshotId: "pressure-resolution"
  });
  assert.equal(resolution.ok, true);

  const execution = prepareVoyageEncounterActionExecutionRequests(resolution.nextState);
  assert.equal(execution.readyForExecution, true);

  let resolved = resolution.nextState;
  const checkRequests = execution.executionRequests.filter(({ mode }) => mode === "check");
  if (checkRequests.length > 0) {
    const prepared = applyVoyageEncounterPendingCheckPreparation(resolved, {
      pendingCheckIds: checkRequests.map(({ sequence }) => ({
        sequence,
        pendingCheckId: `pressure-pending-${sequence}`
      }))
    });
    assert.equal(prepared.ok, true);
    resolved = prepared.nextState;

    for (const request of checkRequests) {
      const pendingCheck = resolved.pendingChecks.find(({ sequence }) => sequence === request.sequence);
      assert.ok(pendingCheck);
      const result = applyVoyageEncounterPendingCheckResult(
        resolved,
        executionResult(pendingCheck, resultBranches[request.sequence] ?? "success")
      );
      assert.equal(result.ok, true);
      resolved = result.nextState;
    }
  }

  const completion = prepareVoyageEncounterResolutionCompletion(resolved);
  assert.equal(completion.readyForConsequences, true);

  const consequences = applyVoyageEncounterConsequencesTransition(resolved, {
    phaseStartSnapshotId: "pressure-consequences"
  });
  assert.equal(consequences.ok, true);

  return consequences.nextState;
}

function fieldNames(value) {
  return Object.keys(value).sort();
}

test("plans canonical Pressure effects across standard, source-station, station, pressure-system, and selected-target boundaries", () => {
  const source = state({
    availableStations: [
      {
        stationId: "captain",
        actions: [
          checkAction(
            "command",
            [
              pressureRule(
                "captain-pressure",
                { kind: "source-station" },
                { delta: 2 }
              )
            ],
            "failure"
          )
        ]
      },
      {
        stationId: "engineer",
        actions: [
          noRollAction("pressure", [
            pressureRule(
              "station-pressure",
              { kind: "station", targetId: "captain" },
              { delta: -1 },
              { visibility: "gm-secret" }
            ),
            pressureRule(
              "system-pressure",
              { kind: "pressure-system", targetId: "arkengine" },
              { delta: 3 },
              { timing: "end-of-round" }
            ),
            pressureRule(
              "selected-pressure",
              { kind: "selected-target" },
              { delta: 4 },
              { timing: "end-of-round", visibility: "gm-secret" }
            )
          ])
        ]
      }
    ],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command"
      },
      engineer: {
        stationId: "engineer",
        actionId: "pressure"
      }
    },
    targets: {
      engineer: {
        kind: "pressure-system",
        targetId: "lifeveil"
      }
    }
  });
  const sourceBefore = structuredClone(source);
  const consequences = resolveToConsequences(source, ["failure"]);
  const consequencesBefore = structuredClone(consequences);
  const report = analyzeVoyageEncounterPressurePlan(consequences);
  const repeatedReport = analyzeVoyageEncounterPressurePlan(consequences);
  const reportBeforeMutation = structuredClone(report);

  assert.deepEqual(source, sourceBefore);
  assert.deepEqual(consequences, consequencesBefore);
  assert.equal(report.structurallyValid, true);
  assert.equal(report.outcomesValid, true);
  assert.equal(report.readyForPressurePlanning, true);
  assert.equal(report.actionCount, 2);
  assert.equal(report.pressureEffectCount, 5);
  assert.equal(report.standardPressureEffectCount, 1);
  assert.equal(report.authoredPressureEffectCount, 4);
  assert.deepEqual(report.effects, [
    {
      pressureEffectId: pressureEffectId("pressure-encounter", "pressure-stage", 1, 0, "standard-result", null),
      encounterId: "pressure-encounter",
      stageId: "pressure-stage",
      roundNumber: 1,
      sequence: 0,
      stationId: "captain",
      actionId: "command",
      pressureSystemId: "crew-morale",
      delta: 1,
      timing: "consequences",
      sourceKind: "standard-result",
      sourceIntentId: null,
      activationSource: null,
      branch: "failure",
      visibility: "public"
    },
    {
      pressureEffectId: pressureEffectId(
        "pressure-encounter",
        "pressure-stage",
        1,
        0,
        "outcome-intent",
        actionIntentId("pressure-encounter", "pressure-stage", 1, 0, "branch", 0, "captain-pressure")
      ),
      encounterId: "pressure-encounter",
      stageId: "pressure-stage",
      roundNumber: 1,
      sequence: 0,
      stationId: "captain",
      actionId: "command",
      pressureSystemId: "crew-morale",
      delta: 2,
      timing: "consequences",
      sourceKind: "outcome-intent",
      sourceIntentId: actionIntentId("pressure-encounter", "pressure-stage", 1, 0, "branch", 0, "captain-pressure"),
      activationSource: "branch",
      branch: "failure",
      visibility: "public"
    },
    {
      pressureEffectId: pressureEffectId(
        "pressure-encounter",
        "pressure-stage",
        1,
        1,
        "outcome-intent",
        actionIntentId("pressure-encounter", "pressure-stage", 1, 1, "branch", 0, "station-pressure")
      ),
      encounterId: "pressure-encounter",
      stageId: "pressure-stage",
      roundNumber: 1,
      sequence: 1,
      stationId: "engineer",
      actionId: "pressure",
      pressureSystemId: "crew-morale",
      delta: -1,
      timing: "consequences",
      sourceKind: "outcome-intent",
      sourceIntentId: actionIntentId("pressure-encounter", "pressure-stage", 1, 1, "branch", 0, "station-pressure"),
      activationSource: "branch",
      branch: "no-roll",
      visibility: "gm-secret"
    },
    {
      pressureEffectId: pressureEffectId(
        "pressure-encounter",
        "pressure-stage",
        1,
        1,
        "outcome-intent",
        actionIntentId("pressure-encounter", "pressure-stage", 1, 1, "branch", 1, "system-pressure")
      ),
      encounterId: "pressure-encounter",
      stageId: "pressure-stage",
      roundNumber: 1,
      sequence: 1,
      stationId: "engineer",
      actionId: "pressure",
      pressureSystemId: "arkengine",
      delta: 3,
      timing: "end-of-round",
      sourceKind: "outcome-intent",
      sourceIntentId: actionIntentId("pressure-encounter", "pressure-stage", 1, 1, "branch", 1, "system-pressure"),
      activationSource: "branch",
      branch: "no-roll",
      visibility: "public"
    },
    {
      pressureEffectId: pressureEffectId(
        "pressure-encounter",
        "pressure-stage",
        1,
        1,
        "outcome-intent",
        actionIntentId("pressure-encounter", "pressure-stage", 1, 1, "branch", 2, "selected-pressure")
      ),
      encounterId: "pressure-encounter",
      stageId: "pressure-stage",
      roundNumber: 1,
      sequence: 1,
      stationId: "engineer",
      actionId: "pressure",
      pressureSystemId: "lifeveil",
      delta: 4,
      timing: "end-of-round",
      sourceKind: "outcome-intent",
      sourceIntentId: actionIntentId("pressure-encounter", "pressure-stage", 1, 1, "branch", 2, "selected-pressure"),
      activationSource: "branch",
      branch: "no-roll",
      visibility: "gm-secret"
    }
  ]);
});

test("fails closed before planning when action outcomes are not ready", () => {
  const source = state({
    availableStations: [
      {
        stationId: "captain",
        actions: [
          checkAction(
            "command",
            [
              pressureRule(
                "captain-pressure",
                { kind: "source-station" },
                { delta: 1 }
              )
            ],
            "failure"
          )
        ]
      }
    ],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command"
      }
    }
  });
  source.proposedStationOrder = ["captain"];
  source.riskBids = {};

  const locked = applyVoyageEncounterCrewPlanningLock(source, {
    phaseStartSnapshotId: "pressure-gate-lock"
  });
  assert.equal(locked.ok, true);
  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, {
    phaseStartSnapshotId: "pressure-gate-resolution"
  });
  assert.equal(resolution.ok, true);

  const report = analyzeVoyageEncounterPressurePlan(resolution.nextState);
  assert.equal(report.structurallyValid, true);
  assert.equal(report.outcomesValid, false);
  assert.equal(report.readyForPressurePlanning, false);
  assert.equal(report.actionCount, 0);
  assert.equal(report.pressureEffectCount, 0);
  assert.deepEqual(report.effects, []);
  assert.ok(report.errors.some((entry) => entry.code === "pressure-plan-outcomes-not-ready"));
});

test("fails closed on malformed Pressure planning context without emitting partial effects", () => {
  const source = state({
    availableStations: [
      {
        stationId: "captain",
        actions: [
          checkAction(
            "command",
            [
              pressureRule(
                "captain-pressure",
                { kind: "source-station" },
                { delta: 1 }
              )
            ],
            "failure"
          )
        ]
      }
    ],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command"
      }
    }
  });

  const consequences = resolveToConsequences(source, ["failure"]);
  const malformed = structuredClone(consequences);
  malformed.currentStage = {};

  const report = analyzeVoyageEncounterPressurePlan(malformed);
  assert.equal(report.readyForPressurePlanning, false);
  assert.equal(report.pressureEffectCount, 0);
  assert.deepEqual(report.effects, []);
  assert.ok(report.errors.some((entry) => entry.code === "pressure-plan-data-read-failed" || entry.code === "pressure-plan-outcomes-not-ready"));
});

test("standard Pressure uses exact canonical IDs and only the failure branches create it", () => {
  const branches = new Map([
    ["failure", { count: 1, delta: 1, id: 'arcflight-pressure-effect:["pressure-encounter","pressure-stage",1,0,"standard-result"]' }],
    ["critical-failure", { count: 1, delta: 2, id: 'arcflight-pressure-effect:["pressure-encounter","pressure-stage",1,0,"standard-result"]' }],
    ["success", { count: 0 }],
    ["critical-success", { count: 0 }],
    ["no-roll", { count: 0 }]
  ]);

  for (const [branch, expectation] of branches) {
    const action = branch === "failure" || branch === "critical-failure"
      ? checkAction(
          "command",
          [pressureRule("captain-pressure", { kind: "source-station" }, { delta: 2 })],
          branch
        )
      : branch === "no-roll"
        ? noRollAction("command", [])
        : checkAction("command", [], branch);
    const source = state({
      availableStations: [
        {
          stationId: "captain",
          actions: [action]
        }
      ],
      selections: {
        captain: {
          stationId: "captain",
          actionId: "command"
        }
      }
    });
    const report = analyzeVoyageEncounterPressurePlan(resolveToConsequences(source, [branch]));
    assert.equal(report.readyForPressurePlanning, true, branch);
    assert.equal(report.standardPressureEffectCount, expectation.count, branch);
    assert.equal(report.authoredPressureEffectCount, expectation.count === 0 ? 0 : 1, branch);
    assert.equal(report.pressureEffectCount, expectation.count === 0 ? 0 : 2, branch);
    if (expectation.count === 0) {
      assert.deepEqual(report.effects, []);
      continue;
    }

    assert.equal(report.effects[0].pressureEffectId, expectation.id);
    assert.equal(report.effects[0].delta, expectation.delta);
  }
});

test("selected Risk Bid pressure planning preserves order and avoids a second standard effect", () => {
  const source = state({
    availableStations: [
      {
        stationId: "captain",
        actions: [
          checkAction(
            "command",
            [
              pressureRule("normal-pressure", { kind: "source-station" }, { delta: 1 }),
              pressureRule("risk-pressure", { kind: "pressure-system", targetId: "arkengine" }, { delta: -2 })
            ],
            "failure"
          )
        ]
      }
    ],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command"
      }
    }
  });
  source.availableStations[0].actions[0].outcomeDefinition.branches.failure = ["normal-pressure"];
  source.availableStations[0].actions[0].riskBidOptions = [
    {
      riskBidId: "bid-2",
      dcAdjustment: 2,
      outcomes: {
        failure: ["risk-pressure"],
        success: [],
        criticalSuccess: [],
        criticalFailure: []
      }
    }
  ];
  source.riskBids = {
    captain: {
      stationId: "captain",
      actionId: "command",
      riskBidId: "bid-2",
      dcAdjustment: 2
    }
  };

  const consequences = resolveToConsequences(source, ["failure"]);
  const report = analyzeVoyageEncounterPressurePlan(consequences);
  const actionReport = analyzeVoyageEncounterActionOutcomes(consequences);

  assert.equal(actionReport.actions[0].riskBidId, "bid-2");
  assert.equal(actionReport.actions[0].dcAdjustment, 2);
  assert.equal(actionReport.actions[0].intentIds.length, 1);
  assert.deepEqual(actionReport.actions[0].branchEffectIds, []);
  assert.deepEqual(actionReport.actions[0].riskBidEffectIds, ["risk-pressure"]);
  assert.deepEqual(actionReport.intents.map(({ activationSource, intentType, payload, target }) => ({
    activationSource,
    intentType,
    payload,
    target
  })), [
    {
      activationSource: "risk-bid",
      intentType: "pressure-change",
      payload: { delta: -2 },
      target: { kind: "pressure-system", targetId: "arkengine" }
    }
  ]);

  assert.equal(report.readyForPressurePlanning, true);
  assert.equal(report.pressureEffectCount, 2);
  assert.equal(report.standardPressureEffectCount, 1);
  assert.equal(report.authoredPressureEffectCount, 1);
  assert.deepEqual(report.effects.map(({ sourceKind, activationSource, branch, pressureSystemId, delta, timing, visibility }) => ({
    sourceKind,
    activationSource,
    branch,
    pressureSystemId,
    delta,
    timing,
    visibility
  })), [
    { sourceKind: "standard-result", activationSource: null, branch: "failure", pressureSystemId: "crew-morale", delta: 1, timing: "consequences", visibility: "public" },
    { sourceKind: "outcome-intent", activationSource: "risk-bid", branch: "failure", pressureSystemId: "arkengine", delta: -2, timing: "consequences", visibility: "public" }
  ]);
  assert.deepEqual(report.effects.map(({ pressureEffectId }) => pressureEffectId), [
    'arcflight-pressure-effect:["pressure-encounter","pressure-stage",1,0,"standard-result"]',
    `arcflight-pressure-effect:${JSON.stringify(["pressure-encounter", "pressure-stage", 1, 0, "outcome-intent", 'arcflight-intent:["pressure-encounter","pressure-stage",1,0,"risk-bid",0,"risk-pressure"]'])}`
  ]);
});

test("currentStage and state access are descriptor-only and do not execute getters", () => {
  let currentStageReads = 0;
  const source = state({
    encounterId: "pressure-encounter",
    availableStations: [
      {
        stationId: "captain",
        actions: [noRollAction("command", [])]
      }
    ],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command"
      }
    },
    committedStationOrder: ["captain"]
  });
  const consequences = resolveToConsequences(source, []);
  const before = structuredClone(consequences);
  const candidate = structuredClone(consequences);
  Object.defineProperty(candidate, "currentStage", {
    enumerable: true,
    configurable: true,
    get() {
      currentStageReads += 1;
      return { stageId: "pressure-stage" };
    }
  });
  const report = analyzeVoyageEncounterPressurePlan(candidate);

  assert.equal(currentStageReads, 0);
  assert.equal(report.readyForPressurePlanning, false);
  assert.equal(report.structurallyValid, false);
  assert.equal(report.outcomesValid, false);
  assert.equal(report.actionCount, 0);
  assert.equal(report.pressureEffectCount, 0);
  assert.equal(report.standardPressureEffectCount, 0);
  assert.equal(report.authoredPressureEffectCount, 0);
  assert.deepEqual(report.effects, []);
  assert.ok(report.errors.some((entry) => entry.code === "pressure-plan-data-read-failed"));
  assert.ok(report.errors.some((entry) => entry.path === "$.currentStage"));
  assert.deepEqual(consequences, before);
});

test("state Proxy get trap is never touched during safe source capture", () => {
  let getReads = 0;
  const source = resolveToConsequences(state({
    availableStations: [
      {
        stationId: "captain",
        actions: [noRollAction("command", [])]
      }
    ],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command"
      }
    },
    committedStationOrder: ["captain"]
  }), []);
  const proxy = new Proxy(source, {
    get(target, key, receiver) {
      getReads += 1;
      return Reflect.get(target, key, receiver);
    },
    getPrototypeOf(target) {
      return Reflect.getPrototypeOf(target);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, key) {
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });

  const report = analyzeVoyageEncounterPressurePlan(proxy);
  const repeatedReport = analyzeVoyageEncounterPressurePlan(proxy);

  assert.equal(getReads, 0);
  assert.deepEqual(repeatedReport, report);
  assert.equal(report.readyForPressurePlanning, true);
  assert.equal(report.actionCount, 1);
  assert.equal(report.pressureEffectCount, 0);
  assert.equal(report.standardPressureEffectCount, 0);
  assert.equal(report.authoredPressureEffectCount, 0);
  assert.deepEqual(report.effects, []);
});

test("hostile source capture rejects proxies, sparse arrays, accessors, symbols, and unsafe keys deterministically", () => {
  const base = resolveToConsequences(state({
    availableStations: [
      {
        stationId: "captain",
        actions: [noRollAction("command", [])]
      }
    ],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command"
      }
    },
    committedStationOrder: ["captain"]
  }), []);

  const assertDeterministicFailure = (value, expectedPath = null) => {
    const first = analyzeVoyageEncounterPressurePlan(value);
    const second = analyzeVoyageEncounterPressurePlan(value);

    assert.deepEqual(first, second);
    assert.equal(first.readyForPressurePlanning, false);
    assert.equal(first.actionCount, 0);
    assert.equal(first.pressureEffectCount, 0);
    assert.equal(first.standardPressureEffectCount, 0);
    assert.equal(first.authoredPressureEffectCount, 0);
    assert.deepEqual(first.effects, []);
    assert.ok(first.errors.some((entry) => entry.code === "pressure-plan-data-read-failed"));
    if (expectedPath) {
      assert.ok(first.errors.some((entry) => entry.path === expectedPath), expectedPath);
    }
    assert.equal(first.errors.length > 0, true);
    assert.equal(first.warnings.length, 0);
  };

  let hostilePrototypeGetReads = 0;
  assertDeterministicFailure(new Proxy(base, {
    get(target, key, receiver) {
      hostilePrototypeGetReads += 1;
      return Reflect.get(target, key, receiver);
    },
    getPrototypeOf() {
      throw new Error("hostile prototype");
    }
  }));
  assert.equal(hostilePrototypeGetReads, 0);

  assertDeterministicFailure(new Proxy(base, {
    getPrototypeOf(target) {
      return Reflect.getPrototypeOf(target);
    },
    ownKeys() {
      throw new Error("hostile ownKeys");
    }
  }));

  assertDeterministicFailure(new Proxy(base, {
    getPrototypeOf(target) {
      return Reflect.getPrototypeOf(target);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor() {
      throw new Error("hostile descriptor");
    }
  }));

  const sparse = structuredClone(base);
  sparse.availableStations = [];
  sparse.availableStations[1] = structuredClone(base.availableStations[0]);
  assertDeterministicFailure(sparse);

  const accessor = structuredClone(base);
  let arrayReads = 0;
  Object.defineProperty(accessor.availableStations, "0", {
    enumerable: true,
    configurable: true,
    get() {
      arrayReads += 1;
      return structuredClone(base.availableStations[0]);
    }
  });
  assertDeterministicFailure(accessor);
  assert.equal(arrayReads, 0);

  const symbolState = structuredClone(base);
  symbolState[Symbol("hidden")] = true;
  assertDeterministicFailure(symbolState);

  const unsafeState = structuredClone(base);
  Object.defineProperty(unsafeState, "constructor", {
    enumerable: true,
    configurable: true,
    value: true
  });
  assertDeterministicFailure(unsafeState);

  const cyclicState = structuredClone(base);
  cyclicState.cycle = cyclicState;
  assertDeterministicFailure(cyclicState, "$.cycle");

  const undefinedFieldState = structuredClone(base);
  undefinedFieldState.metadata = { marker: undefined };
  assertDeterministicFailure(undefinedFieldState, "$.metadata.marker");

  const undefinedArrayEntryState = structuredClone(base);
  undefinedArrayEntryState.availableStations = [undefined];
  assertDeterministicFailure(undefinedArrayEntryState, "$.availableStations[0]");
});

test("station mapping and committed order stay exact across all five canonical stations", () => {
  const source = state({
    availableStations: [
      {
        stationId: "captain",
        actions: [noRollAction("command", [
          pressureRule("captain-pressure", { kind: "source-station" }, { delta: 1 })
        ])]
      },
      {
        stationId: "engineer",
        actions: [noRollAction("repair", [
          pressureRule("engineer-pressure", { kind: "source-station" }, { delta: -1 }, { visibility: "gm-secret" })
        ])]
      },
      {
        stationId: "navigator",
        actions: [noRollAction("chart", [
          pressureRule("navigator-pressure", { kind: "source-station" }, { delta: 2 }, { timing: "end-of-round" })
        ])]
      },
      {
        stationId: "watchmaster",
        actions: [noRollAction("scan", [
          pressureRule("watchmaster-pressure", { kind: "source-station" }, { delta: -2 })
        ])]
      },
      {
        stationId: "veilwarden",
        actions: [noRollAction("ward", [
          pressureRule("veilwarden-pressure", { kind: "source-station" }, { delta: 3 })
        ])]
      }
    ],
    selections: {
      captain: { stationId: "captain", actionId: "command" },
      engineer: { stationId: "engineer", actionId: "repair" },
      navigator: { stationId: "navigator", actionId: "chart" },
      watchmaster: { stationId: "watchmaster", actionId: "scan" },
      veilwarden: { stationId: "veilwarden", actionId: "ward" }
    },
    committedStationOrder: ["captain", "engineer", "navigator", "watchmaster", "veilwarden"]
  });

  const report = analyzeVoyageEncounterPressurePlan(resolveToConsequences(source, []));

  assert.equal(report.readyForPressurePlanning, true);
  assert.equal(report.actionCount, 5);
  assert.equal(report.pressureEffectCount, 5);
  assert.equal(report.standardPressureEffectCount, 0);
  assert.equal(report.authoredPressureEffectCount, 5);
  assert.deepEqual(report.effects.map(({ stationId, pressureSystemId }) => [stationId, pressureSystemId]), [
    ["captain", "crew-morale"],
    ["engineer", "arkengine"],
    ["navigator", "levstone-array"],
    ["watchmaster", "solar-sail-rig"],
    ["veilwarden", "lifeveil"]
  ]);
  assert.deepEqual(report.effects.map(({ sequence }) => sequence), [0, 1, 2, 3, 4]);
});

test("selected-target and payload records require exact plain enumerable data objects", () => {
  const run = (effectRules, target, expectedError) => {
    const source = state({
      availableStations: [
        {
          stationId: "captain",
          actions: [
            checkAction("command", effectRules, "failure")
          ]
        }
      ],
      selections: {
        captain: {
          stationId: "captain",
          actionId: "command"
        }
      },
      targets: {
        captain: target
      }
    });
    const report = analyzeVoyageEncounterPressurePlan(resolveToConsequences(source, ["failure"]));
    assert.equal(report.readyForPressurePlanning, false);
    assert.ok(report.errors.some((entry) => entry.code === expectedError), expectedError);
    assert.deepEqual(report.effects, []);
  };

  run(
    [pressureRule("selected-pressure", { kind: "selected-target" }, { delta: 3 })],
    { kind: "station", targetId: "navigator", extra: true },
    "pressure-plan-target-invalid"
  );
  run(
    [pressureRule("payload-pressure", { kind: "source-station" }, { delta: 1, extra: true })],
    { kind: "station", targetId: "navigator" },
    "pressure-plan-outcomes-not-ready"
  );
});

test("selected-target records resolve exact station and pressure-system targets", () => {
  const buildConsequence = (target, stationId = "captain") => resolveToConsequences(state({
    availableStations: [
      {
        stationId,
        actions: [
          noRollAction("command", [
            pressureRule("selected-pressure", { kind: "selected-target" }, { delta: 3 })
          ])
        ]
      }
    ],
    selections: {
      [stationId]: {
        stationId,
        actionId: "command"
      }
    },
    targets: {
      [stationId]: target
    }
  }), []);

  const stationTarget = { kind: "station", targetId: "navigator" };
  const pressureSystemTarget = { kind: "pressure-system", targetId: "lifeveil" };
  const stationReport = analyzeVoyageEncounterPressurePlan(buildConsequence(stationTarget));
  assert.equal(stationReport.readyForPressurePlanning, true);
  assert.equal(stationReport.pressureEffectCount, 1);
  assert.equal(stationReport.standardPressureEffectCount, 0);
  assert.equal(stationReport.authoredPressureEffectCount, 1);
  assert.equal(stationReport.effects[0].pressureSystemId, "levstone-array");

  const systemReport = analyzeVoyageEncounterPressurePlan(buildConsequence(pressureSystemTarget));
  assert.equal(systemReport.readyForPressurePlanning, true);
  assert.equal(systemReport.pressureEffectCount, 1);
  assert.equal(systemReport.effects[0].pressureSystemId, "lifeveil");
  assert.deepEqual(stationTarget, { kind: "station", targetId: "navigator" });
  assert.deepEqual(pressureSystemTarget, { kind: "pressure-system", targetId: "lifeveil" });
});

test("pressure payloads remain exact and preserve valid values", () => {
  const buildConsequence = (payload = { delta: 1 }) => resolveToConsequences(state({
    availableStations: [
      {
        stationId: "captain",
        actions: [
          noRollAction("command", [
            pressureRule("payload-pressure", { kind: "source-station" }, payload)
          ])
        ]
      }
    ],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command"
      }
    }
  }), []);

  const payload = { delta: 1 };
  const report = analyzeVoyageEncounterPressurePlan(buildConsequence(payload));
  const repeatedReport = analyzeVoyageEncounterPressurePlan(buildConsequence(payload));
  const reportBeforeMutation = structuredClone(report);
  assert.equal(report.readyForPressurePlanning, true);
  assert.equal(report.pressureEffectCount, 1);
  assert.equal(report.standardPressureEffectCount, 0);
  assert.equal(report.authoredPressureEffectCount, 1);
  assert.equal(report.effects[0].delta, 1);
  report.effects[0].delta = 99;
  assert.deepEqual(repeatedReport, reportBeforeMutation);
  assert.deepEqual(payload, { delta: 1 });
});

test("successful reports expose the exact ten-field report contract and fifteen-field effect contract", () => {
  const source = state({
    availableStations: [
      {
        stationId: "captain",
        actions: [
          checkAction(
            "command",
            [
              pressureRule("captain-pressure", { kind: "source-station" }, { delta: 2 }),
              pressureRule("risk-pressure", { kind: "pressure-system", targetId: "arkengine" }, { delta: 1 })
            ],
            "critical-failure"
          )
        ]
      }
    ],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "command"
      }
    }
  });
  source.availableStations[0].actions[0].outcomeDefinition.branches["critical-failure"] = ["captain-pressure"];
  source.availableStations[0].actions[0].riskBidOptions = [
    {
      riskBidId: "bid-2",
      dcAdjustment: 2,
      outcomes: {
        criticalFailure: ["risk-pressure"],
        success: [],
        failure: [],
        criticalSuccess: []
      }
    }
  ];
  source.riskBids = {
    captain: {
      stationId: "captain",
      actionId: "command",
      riskBidId: "bid-2",
      dcAdjustment: 2
    }
  };

  const sourceBefore = structuredClone(source);
  const consequences = resolveToConsequences(source, ["critical-failure"]);
  const consequencesBefore = structuredClone(consequences);
  const report = analyzeVoyageEncounterPressurePlan(consequences);
  assert.deepEqual(fieldNames(report), [
    "actionCount",
    "authoredPressureEffectCount",
    "effects",
    "errors",
    "outcomesValid",
    "pressureEffectCount",
    "readyForPressurePlanning",
    "standardPressureEffectCount",
    "structurallyValid",
    "warnings"
  ]);
  assert.equal(report.errors.length, 0);
  assert.equal(report.warnings.length, 0);
  assert.equal(report.actionCount, 1);
  assert.equal(report.pressureEffectCount, 2);
  assert.equal(report.standardPressureEffectCount, 1);
  assert.equal(report.authoredPressureEffectCount, 1);
  assert.deepEqual(report.effects.map(fieldNames), [
    [
      "actionId",
      "activationSource",
      "branch",
      "delta",
      "encounterId",
      "pressureEffectId",
      "pressureSystemId",
      "roundNumber",
      "sequence",
      "sourceIntentId",
      "sourceKind",
      "stageId",
      "stationId",
      "timing",
      "visibility"
    ],
    [
      "actionId",
      "activationSource",
      "branch",
      "delta",
      "encounterId",
      "pressureEffectId",
      "pressureSystemId",
      "roundNumber",
      "sequence",
      "sourceIntentId",
      "sourceKind",
      "stageId",
      "stationId",
      "timing",
      "visibility"
    ]
  ]);
  const repeatedReport = analyzeVoyageEncounterPressurePlan(resolveToConsequences(source, ["critical-failure"]));
  const reportBeforeMutation = structuredClone(report);
  assert.deepEqual(repeatedReport, report);
  report.effects[0].delta = 99;
  report.effects[0].pressureSystemId = "changed";
  assert.deepEqual(repeatedReport, reportBeforeMutation);
  assert.deepEqual(consequences, consequencesBefore);
  assert.deepEqual(source, sourceBefore);
});
