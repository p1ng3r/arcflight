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
import { analyzeVoyageEncounterActionOutcomeDefinitions } from "../../../scripts/voyage/domain/consequence-rules.js";
import {
  VOYAGE_CONTROLLED_EFFECT_INTENT_TYPES as CONTROLLED,
  VOYAGE_EFFECT_INTENT_TYPES as INTENTS
} from "../../../scripts/voyage/domain/constants.js";

const DEGREES = ["critical-failure", "failure", "success", "critical-success"];
const STATIONS = ["captain", "engineer", "navigator", "watchmaster", "veilwarden"];

function effectRule(effectId, { intentType = "track-change", payload = null, target = { kind: "encounter" }, timing = "consequences", visibility = "public" } = {}) {
  return { effectId, intentType, timing, visibility, target, payload };
}

function noRollAction(actionId, effectIds, effectRules) {
  return { actionId, outcomeDefinition: { effectRules: effectRules ?? effectIds.map((id) => effectRule(id)), branches: { "no-roll": effectIds } } };
}

function checkAction(actionId, effectIds, effectRules, branch = "success") {
  const branches = Object.fromEntries(DEGREES.map((degree) => [degree, []]));
  branches[branch] = effectIds;
  return {
    actionId,
    check: { source: { kind: "character", uuid: "Actor.captain" }, statisticOptions: ["diplomacy"], dcSource: { kind: "fixed", value: 20 }, secrecy: "public", metadata: {} },
    outcomeDefinition: { effectRules, branches }
  };
}

function riskBidOption(riskBidId, dcAdjustment, outcomes) {
  return { riskBidId, dcAdjustment, outcomes: { criticalSuccess: [], success: [], failure: [], criticalFailure: [], ...outcomes } };
}

function encounterState({ availableStations, selections, phase = "crew-planning", committedStationOrder = [], targets = {}, riskBids = {}, encounterId = "encounter", stageId = "stage", roundNumber = 1 }) {
  for (const station of availableStations) {
    for (const action of station.actions) {
      if (!Object.hasOwn(action, "approaches")) action.approaches = Object.hasOwn(action, "check")
        ? [{ approachId: `approach-${action.actionId}`, statisticSlugOrAbilityId: action.check.statisticOptions[0] }]
        : [{ approachId: `approach-${action.actionId}`, noRoll: true }];
    }
  }
  const state = createVoyageEncounterState({ encounterId, definitionId: "definition", primaryShip: { id: "ship" } });
  state.lifecycleState = "active";
  state.currentStage = { stageId };
  state.roundNumber = roundNumber;
  state.phase = phase;
  state.availableStations = availableStations;
  state.stationAssignments = Object.keys(selections).map((stationId) => ({ stationId, operator: { kind: "actor", uuid: `Actor.${stationId}` } }));
  state.selections = selections;
  state.targets = targets;
  state.proposedStationOrder = phase === "crew-planning" ? [...committedStationOrder] : [];
  state.committedStationOrder = phase === "crew-planning" ? [] : [...committedStationOrder];
  state.riskBids = structuredClone(riskBids);
  return state;
}

function executionResult(request, pending) {
  const degree = request.degreeOfSuccessSlug;
  return {
    ok: true,
    status: "rolled",
    pendingCheckId: pending.pendingCheckId,
    sequence: request.sequence,
    sourceKind: "character",
    sourceUuid: pending.source.uuid,
    statisticSlug: pending.statisticSlugOrAbilityId,
    dc: pending.finalDc,
    rollMode: pending.secrecy === "secret" ? "blind" : "public",
    result: { total: pending.finalDc, degreeOfSuccess: DEGREES.indexOf(degree), degreeOfSuccessSlug: degree },
    errors: [],
    warnings: []
  };
}

function completeRound({ availableStations, selections, committedOrder, resultBranches = [], riskBids = {}, targets = {}, encounterId = "encounter" }) {
  const source = encounterState({ availableStations, selections, committedStationOrder: committedOrder, riskBids, targets, encounterId });
  const sourceBefore = structuredClone(source);
  const locked = applyVoyageEncounterCrewPlanningLock(source, { phaseStartSnapshotId: "pipeline-lock" });
  assert.equal(locked.ok, true, JSON.stringify(locked));
  const resolution = applyVoyageEncounterResolutionTransition(locked.nextState, { phaseStartSnapshotId: "pipeline-resolution" });
  assert.equal(resolution.ok, true);
  const execution = prepareVoyageEncounterActionExecutionRequests(resolution.nextState);
  assert.equal(execution.readyForExecution, true, JSON.stringify(execution));
  let resolved = resolution.nextState;
  const checks = execution.executionRequests.filter(({ mode }) => mode === "check");
  if (checks.length) {
    const prepared = applyVoyageEncounterPendingCheckPreparation(resolved, {
      pendingCheckIds: checks.map(({ sequence }) => ({ sequence, pendingCheckId: `pending-${sequence}` }))
    });
    assert.equal(prepared.ok, true);
    resolved = prepared.nextState;
    for (const request of checks) {
      const pending = resolved.pendingChecks.find(({ sequence }) => sequence === request.sequence);
      const applied = applyVoyageEncounterPendingCheckResult(resolved, executionResult({ ...request, degreeOfSuccessSlug: resultBranches[request.sequence] ?? "success" }, pending));
      assert.equal(applied.ok, true);
      resolved = applied.nextState;
    }
  }
  const completion = prepareVoyageEncounterResolutionCompletion(resolved);
  assert.equal(completion.readyForConsequences, true);
  const consequences = applyVoyageEncounterConsequencesTransition(resolved, { phaseStartSnapshotId: "pipeline-consequences" });
  assert.equal(consequences.ok, true);
  return { source, sourceBefore, execution, resolved, report: analyzeVoyageEncounterActionOutcomes(consequences.nextState) };
}

const CONTROLLED_FIXTURES = [
  [CONTROLLED.DC_CHANGE, { delta: -2 }, { kind: "station", targetId: "navigator" }],
  [CONTROLLED.ROLL_MODIFIER, { delta: 2 }, { kind: "source-station" }],
  [CONTROLLED.RESULT_DEGREE_SHIFT, { steps: 1 }, { kind: "selected-target" }],
  [CONTROLLED.REROLL, { keep: "second" }, { kind: "station", targetId: "captain" }],
  [CONTROLLED.ROLL_TWICE, { keep: "better" }, { kind: "source-station" }],
  [CONTROLLED.FOCUS_RESTORATION, { amount: 1 }, { kind: "source-station" }],
  [CONTROLLED.PRESSURE_CHANGE, { delta: -1 }, { kind: "pressure-system", targetId: "arkengine" }],
  [CONTROLLED.HAZARD_CREATE, { hazardId: "storm" }, { kind: "encounter" }],
  [CONTROLLED.HAZARD_REMOVE, {}, { kind: "hazard", targetId: "storm" }],
  [CONTROLLED.HAZARD_PREVENT, {}, { kind: "selected-target" }],
  [CONTROLLED.HAZARD_SUPPRESS, {}, { kind: "hazard", targetId: "storm" }],
  [CONTROLLED.STATION_ORDER_CHANGE, { position: "first" }, { kind: "station", targetId: "captain" }],
  [CONTROLLED.SYSTEM_REPAIR, { scope: "temporary" }, { kind: "source-station" }],
  [CONTROLLED.SYSTEM_PROTECTION, { scope: "next-consequence" }, { kind: "pressure-system", targetId: "arkengine" }]
];

function expectedIntent({ activationSource, effectId, intentType, target, payload, riskBidId = null, dcAdjustment = null, referenceIndex = 0, mode = "check", branch = "success", visibility = "public", selectedTarget = { id: "selected", nested: { value: 1 } } }) {
  const activation = activationSource === "branch" ? ["branch", referenceIndex] : ["risk-bid", referenceIndex];
  return {
    intentId: `arcflight-intent:${JSON.stringify(["encounter", "stage", 1, 0, ...activation, effectId])}`,
    encounterId: "encounter", stageId: "stage", roundNumber: 1, sequence: 0, stationId: "captain", actionId: "action", mode, branch,
    riskBidId, dcAdjustment, activationSource, referenceIndex, effectId, intentType, timing: "consequences", visibility, target,
    selectedTarget, payload
  };
}

function assertExactIntent(intent, expected) {
  assert.deepEqual(intent, expected);
  assert.deepEqual(Object.keys(intent), ["intentId", "encounterId", "stageId", "roundNumber", "sequence", "stationId", "actionId", "mode", "branch", "riskBidId", "dcAdjustment", "activationSource", "referenceIndex", "effectId", "intentType", "timing", "visibility", "target", "selectedTarget", "payload"]);
}

function oneFixtureAction(intentType, payload, target, { risk = false, visibility = "public" } = {}) {
  const effectId = "effect";
  const rule = effectRule(effectId, { intentType, payload, target, visibility });
  const action = checkAction("action", [effectId], [rule], "success");
  if (risk) action.riskBidOptions = [riskBidOption("bid-5", 5, { success: [effectId] })];
  return action;
}

test("every canonical controlled intent survives a complete normal-branch pipeline", () => {
  assert.equal(CONTROLLED_FIXTURES.length, Object.keys(CONTROLLED).length);
  for (const [intentType, payload, target] of CONTROLLED_FIXTURES) {
    const selectedTarget = { id: "selected", nested: { value: 1 } };
    const action = oneFixtureAction(intentType, payload, target);
    const result = completeRound({
      availableStations: [{ stationId: "captain", actions: [action] }],
      selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", statisticSlugOrAbilityId: "diplomacy" } },
      committedOrder: ["captain"],
      resultBranches: ["success"],
      targets: { captain: selectedTarget }
    });
    assert.equal(result.report.readyForInterpretation, true, intentType);
    assert.equal(result.report.intentCount, 1, intentType);
    assertExactIntent(result.report.intents[0], expectedIntent({ activationSource: "branch", effectId: "effect", intentType, target, payload, selectedTarget }));
  }
});

test("every canonical controlled intent survives a complete selected Risk Bid pipeline", () => {
  for (const [index, [intentType, payload, target]] of CONTROLLED_FIXTURES.entries()) {
    const tier = [2, 5, 8][index % 3];
    const selectedTarget = [
      { kind: "station", targetId: "navigator" },
      { kind: "pressure-system", targetId: "arkengine" },
      { kind: "hazard", targetId: "storm" }
    ][index % 3];
    const visibility = index === 1 ? "gm-secret" : "public";
    const action = oneFixtureAction(intentType, payload, target, { risk: false, visibility });
    action.riskBidOptions = [riskBidOption(`bid-${tier}`, tier, { success: ["effect"] })];
    const result = completeRound({
      availableStations: [{ stationId: "captain", actions: [action] }],
      selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", statisticSlugOrAbilityId: "diplomacy" } },
      committedOrder: ["captain"],
      resultBranches: ["success"],
      targets: { captain: selectedTarget },
      riskBids: { captain: { stationId: "captain", actionId: "action", riskBidId: `bid-${tier}`, dcAdjustment: tier } }
    });
    assert.equal(result.report.readyForInterpretation, true, intentType);
    assert.equal(result.report.intentCount, 2, intentType);
    assertExactIntent(result.report.intents[1], expectedIntent({ activationSource: "risk-bid", effectId: "effect", intentType, target, payload, riskBidId: `bid-${tier}`, dcAdjustment: tier, visibility, selectedTarget }));
  }
});

test("the four-degree branch matrix preserves exact normal and selected-bid ordering", () => {
  for (const degree of DEGREES) {
    const normalId = `normal-${degree}`;
    const bidId = `bid-${degree}`;
    const rules = [
      effectRule(normalId, { intentType: CONTROLLED.FOCUS_RESTORATION, payload: { amount: 1 }, target: { kind: "source-station" } }),
      effectRule(bidId, { intentType: CONTROLLED.PRESSURE_CHANGE, payload: { delta: 1 }, target: { kind: "source-station" } })
    ];
    const action = checkAction("action", [normalId], rules, degree);
    const bidOutcome = { "critical-success": "criticalSuccess", success: "success", failure: "failure", "critical-failure": "criticalFailure" }[degree];
    action.riskBidOptions = [riskBidOption("bid-2", 2, { [bidOutcome]: [bidId] })];
    const noBid = completeRound({ availableStations: [{ stationId: "captain", actions: [action] }], selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", statisticSlugOrAbilityId: "diplomacy" } }, committedOrder: ["captain"], resultBranches: [degree] }).report;
    assert.deepEqual(noBid.intents.map(({ effectId }) => effectId), [normalId]);
    const selected = completeRound({ availableStations: [{ stationId: "captain", actions: [action] }], selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", statisticSlugOrAbilityId: "diplomacy" } }, committedOrder: ["captain"], resultBranches: [degree], riskBids: { captain: { stationId: "captain", actionId: "action", riskBidId: "bid-2", dcAdjustment: 2 } } }).report;
    if (degree === "failure" || degree === "critical-failure") assert.deepEqual(selected.intents.map(({ effectId }) => effectId), [bidId]);
    else assert.deepEqual(selected.intents.map(({ effectId }) => effectId), [normalId, bidId]);
  }
});

test("empty selected bid branches never fall back and no-bid failure branches remain authored", () => {
  for (const degree of DEGREES) {
    const normalId = `normal-${degree}`;
    const action = checkAction("action", [normalId], [effectRule(normalId)], degree);
    action.riskBidOptions = [riskBidOption("bid-8", 8)];
    const selected = completeRound({ availableStations: [{ stationId: "captain", actions: [action] }], selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", statisticSlugOrAbilityId: "diplomacy" } }, committedOrder: ["captain"], resultBranches: [degree], riskBids: { captain: { stationId: "captain", actionId: "action", riskBidId: "bid-8", dcAdjustment: 8 } } }).report;
    assert.deepEqual(selected.intents.map(({ effectId }) => effectId), degree === "failure" || degree === "critical-failure" ? [] : [normalId]);
  }
  for (const degree of ["failure", "critical-failure"]) {
    const id = `no-bid-${degree}`;
    const action = checkAction("action", [id], [effectRule(id)], degree);
    const report = completeRound({ availableStations: [{ stationId: "captain", actions: [action] }], selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", statisticSlugOrAbilityId: "diplomacy" } }, committedOrder: ["captain"], resultBranches: [degree] }).report;
    assert.equal(report.intents[0].riskBidId, null);
    assert.equal(report.intents[0].dcAdjustment, null);
  }
});

test("no-roll controlled output is exact and Risk Bids are rejected", () => {
  const rules = [
    effectRule("focus", { intentType: CONTROLLED.FOCUS_RESTORATION, payload: { amount: 1 }, target: { kind: "source-station" } }),
    effectRule("hazard", { intentType: CONTROLLED.HAZARD_PREVENT, payload: {}, target: { kind: "selected-target" }, visibility: "gm-secret" })
  ];
  const action = noRollAction("action", ["focus", "hazard"], rules);
  const source = encounterState({ phase: "consequences", availableStations: [{ stationId: "captain", actions: [action] }], selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", noRoll: true } }, committedStationOrder: ["captain"], targets: { captain: { id: "hazard-target" } } });
  const report = analyzeVoyageEncounterActionOutcomes(source);
  assert.equal(report.readyForInterpretation, true, JSON.stringify(report.errors));
  assert.deepEqual(report.intents.map(({ mode, branch, riskBidId, dcAdjustment, activationSource, effectId }) => ({ mode, branch, riskBidId, dcAdjustment, activationSource, effectId })), [
    { mode: "no-roll", branch: "no-roll", riskBidId: null, dcAdjustment: null, activationSource: "branch", effectId: "focus" },
    { mode: "no-roll", branch: "no-roll", riskBidId: null, dcAdjustment: null, activationSource: "branch", effectId: "hazard" }
  ]);
  const invalid = structuredClone(action);
  invalid.riskBidOptions = [riskBidOption("bid-2", 2, { success: ["focus"] })];
  const invalidReport = analyzeVoyageEncounterActionOutcomeDefinitions(encounterState({ availableStations: [{ stationId: "captain", actions: [invalid] }], selections: { captain: { stationId: "captain", actionId: "action" } } }));
  assert.equal(invalidReport.definitionsValid, false);
  const storedBid = encounterState({ phase: "consequences", availableStations: [{ stationId: "captain", actions: [action] }], selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", noRoll: true } }, committedStationOrder: ["captain"], riskBids: { captain: { stationId: "captain", actionId: "action", riskBidId: "bid-2", dcAdjustment: 2 } } });
  const storedBidReport = analyzeVoyageEncounterActionOutcomes(storedBid);
  assert.equal(storedBidReport.readyForInterpretation, false);
  assert.equal(storedBidReport.intentCount, 0);
});

test("five-station mixed round preserves committed order, visibility, tiers, and deterministic output", () => {
  const order = ["veilwarden", "watchmaster", "navigator", "engineer", "captain"];
  const stations = STATIONS.map((stationId, index) => {
    const effectId = `effect-${stationId}`;
    const rule = effectRule(effectId, { intentType: CONTROLLED.PRESSURE_CHANGE, payload: { delta: index + 1 }, target: stationId === "navigator" ? { kind: "selected-target" } : { kind: "pressure-system", targetId: "arkengine" }, visibility: index % 2 ? "gm-secret" : "public" });
    if (stationId === "veilwarden") return { stationId, actions: [noRollAction(`action-${stationId}`, [effectId], [rule])] };
    const action = checkAction(`action-${stationId}`, [effectId], [rule], "success");
    const tier = [2, 5, 8][STATIONS.indexOf(stationId) % 3];
    if (stationId !== "captain") action.riskBidOptions = [riskBidOption(`bid-${tier}`, tier, { success: [effectId] })];
    return { stationId, actions: [action] };
  });
  const selections = Object.fromEntries(STATIONS.map((stationId) => [stationId, { stationId, actionId: `action-${stationId}`, approachId: stationId === "veilwarden" ? "approach-action-veilwarden" : `approach-action-${stationId}`, ...(stationId === "veilwarden" ? { noRoll: true } : { statisticSlugOrAbilityId: "diplomacy" }) }]));
  const riskBids = Object.fromEntries(STATIONS.filter((stationId) => stationId !== "veilwarden" && stationId !== "captain").map((stationId) => { const tier = [2, 5, 8][STATIONS.indexOf(stationId) % 3]; return [stationId, { stationId, actionId: `action-${stationId}`, riskBidId: `bid-${tier}`, dcAdjustment: tier }]; }));
  const targets = Object.fromEntries(STATIONS.map((stationId) => [stationId, { kind: "station", targetId: "navigator" }]));
  const first = completeRound({ availableStations: stations, selections, committedOrder: order, resultBranches: STATIONS.map(() => "success"), riskBids, targets }).report;
  const second = completeRound({ availableStations: stations, selections: structuredClone(selections), committedOrder: order, resultBranches: STATIONS.map(() => "success"), riskBids, targets: structuredClone(targets) }).report;
  assert.equal(first.interpretedActionCount, 5);
  assert.equal(first.intentCount, 8);
  assert.deepEqual(first.actions.map(({ stationId }) => stationId), order);
  assert.deepEqual(first.intents.map(({ stationId }) => stationId), ["veilwarden", "watchmaster", "watchmaster", "navigator", "navigator", "engineer", "engineer", "captain"]);
  assert.deepEqual(first, second);
});

test("targets, selected targets, visibility, isolation, and legacy intents remain authoritative", () => {
  const selectedTarget = { id: "selected", nested: { value: 1 } };
  const rules = [
    effectRule("system", { intentType: CONTROLLED.SYSTEM_REPAIR, payload: { scope: "temporary" }, target: { kind: "pressure-system", targetId: "arkengine" } }),
    effectRule("hazard", { intentType: CONTROLLED.HAZARD_CREATE, payload: { hazardId: "storm" }, target: { kind: "encounter" }, visibility: "gm-secret" }),
    effectRule("legacy", { intentType: INTENTS.TEMPORARY_MODIFIER, payload: { arbitrary: { nested: true } }, target: { kind: "current-stage" } })
  ];
  const action = checkAction("action", rules.map(({ effectId }) => effectId), rules, "success");
  const result = completeRound({ availableStations: [{ stationId: "captain", actions: [action] }], selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", statisticSlugOrAbilityId: "diplomacy" } }, committedOrder: ["captain"], resultBranches: ["success"], targets: { captain: selectedTarget } });
  assert.deepEqual(result.report.intents.map(({ target, selectedTarget: selected, visibility }) => ({ target, selectedTarget: selected, visibility })), [
    { target: { kind: "pressure-system", targetId: "arkengine" }, selectedTarget, visibility: "public" },
    { target: { kind: "encounter" }, selectedTarget, visibility: "gm-secret" },
    { target: { kind: "current-stage" }, selectedTarget, visibility: "public" }
  ]);
  result.source.availableStations[0].actions[0].outcomeDefinition.effectRules[0].payload.scope = "changed";
  result.source.targets.captain.nested.value = 99;
  result.report.intents[0].payload.scope = "changed-output";
  assert.equal(result.report.intents[0].payload.scope, "changed-output");
  assert.equal(result.report.intents[1].payload.hazardId, "storm");
  assert.equal(result.sourceBefore.availableStations[0].actions[0].outcomeDefinition.effectRules[0].payload.scope, "temporary");
});

test("malformed controlled data rejects atomically at every action position", () => {
  const malformedPayloads = [
    { payload: 1 },
    { payload: { amount: 1, extra: true } },
    { payload: Object.defineProperty({}, "amount", { get() { throw new Error("must not read"); }, enumerable: true }) },
    { payload: Object.assign({ amount: 1 }, { [Symbol("hidden")]: true }) },
    { payload: new Proxy({ amount: 1 }, { ownKeys() { throw new Error("hostile"); } }) },
    { payload: { amount: 1 }, target: { kind: "station", targetId: "Captain" } },
    { payload: { amount: 1 }, timing: "gm-confirmed" },
    { payload: { amount: 1 }, target: { kind: "hazard", targetId: "__proto__" } }
  ];
  for (const position of [0, 1, 2]) {
    for (const malformed of malformedPayloads) {
      const actions = [0, 1, 2].map((index) => noRollAction(`action-${index}`, [`effect-${index}`], [effectRule(`effect-${index}`, { intentType: CONTROLLED.FOCUS_RESTORATION, payload: { amount: 1 }, target: { kind: "source-station" } })]));
      actions[position].outcomeDefinition.effectRules[0] = effectRule(`effect-${position}`, { intentType: CONTROLLED.FOCUS_RESTORATION, payload: malformed.payload ?? { amount: 1 }, target: malformed.target ?? { kind: "source-station" }, timing: malformed.timing ?? "consequences" });
      const source = encounterState({ phase: "consequences", availableStations: [{ stationId: "captain", actions }], selections: { captain: { stationId: "captain", actionId: "action-0" } } });
      const report = analyzeVoyageEncounterActionOutcomes(source);
      assert.equal(report.readyForInterpretation, false);
      assert.equal(report.interpretedActionCount, 0);
      assert.equal(report.intentCount, 0);
      assert.deepEqual(report.actions, []);
      assert.deepEqual(report.intents, []);
    }
  }
  const riskRule = effectRule("risk-effect", { intentType: CONTROLLED.FOCUS_RESTORATION, payload: { amount: 0 }, target: { kind: "source-station" }, visibility: "gm-secret" });
  const riskAction = checkAction("risk-action", ["normal-effect"], [effectRule("normal-effect"), riskRule], "success");
  riskAction.riskBidOptions = [riskBidOption("bid-2", 2, { success: ["risk-effect"] })];
  const riskDefinition = analyzeVoyageEncounterActionOutcomeDefinitions(encounterState({ availableStations: [{ stationId: "captain", actions: [riskAction] }], selections: { captain: { stationId: "captain", actionId: "risk-action" } } }));
  assert.equal(riskDefinition.definitionsValid, false);
  const variantAction = noRollAction("variant-action", ["variant-effect"], [effectRule("variant-effect", {
    intentType: CONTROLLED.STATION_ORDER_CHANGE,
    payload: { position: "before" },
    target: { kind: "source-station" }
  })]);
  const variantDefinition = analyzeVoyageEncounterActionOutcomeDefinitions(encounterState({ availableStations: [{ stationId: "captain", actions: [variantAction] }], selections: { captain: { stationId: "captain", actionId: "variant-action" } } }));
  assert.equal(variantDefinition.definitionsValid, false);
});

test("registry-derived fixture coverage is exact and legacy effects coexist", () => {
  const ids = Object.values(CONTROLLED);
  assert.deepEqual(CONTROLLED_FIXTURES.map(([intentType]) => intentType).sort(), [...ids].sort());
  assert.equal(new Set(CONTROLLED_FIXTURES.map(([intentType]) => intentType)).size, ids.length);
  const riskFixtureIds = CONTROLLED_FIXTURES.map(([intentType]) => intentType);
  assert.deepEqual([...new Set(riskFixtureIds)].sort(), [...ids].sort());
  for (const legacy of ["track-change", "temporary-consequence", "permanent-consequence-proposal", "discovery", "setback", "temporary-modifier", "stage-outcome", "encounter-outcome"]) {
    const rule = effectRule("legacy", { intentType: legacy, payload: { nested: true } });
    const action = noRollAction("action", ["legacy"], [rule]);
    const report = analyzeVoyageEncounterActionOutcomes(encounterState({ phase: "consequences", availableStations: [{ stationId: "captain", actions: [action] }], selections: { captain: { stationId: "captain", actionId: "action", approachId: "approach-action", noRoll: true } }, committedStationOrder: ["captain"] }));
    assert.equal(report.readyForInterpretation, true, `${legacy}:${JSON.stringify(report.errors)}`);
    assert.equal(report.intents[0].intentType, legacy);
  }
});
