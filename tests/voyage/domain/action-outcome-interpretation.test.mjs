import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../../../scripts/voyage/domain/pending-checks.js";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { analyzeVoyageEncounterActionOutcomes } from "../../../scripts/voyage/domain/action-outcome-interpretation.js";

test("empty Active Consequences plan returns empty results and ready", () => {
  const s = createVoyageEncounterState({ encounterId: "empty", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "consequences";
  s.availableStations = [];
  s.selections = {};

  const report = analyzeVoyageEncounterActionOutcomes(s);
  const keys = [
    "structurallyValid","definitionsValid","pendingChecksValid","resolutionComplete","active","consequences","readyForInterpretation","actionCount","interpretedActionCount","checkActionCount","noRollActionCount","intentCount","actions","intents","errors","warnings"
  ];
  assert.deepEqual(Object.keys(report), keys);
  assert.equal(report.resolutionComplete, true);
  assert.equal(report.readyForInterpretation, true);
  assert.equal(report.actions.length, 0);
  assert.equal(report.intents.length, 0);
});

test("successful no-roll interpretation produces exact action and intent shapes", () => {
  const s = createVoyageEncounterState({ encounterId: "e", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "consequences";
  s.availableStations = [{ stationId: "a", actions: [{ actionId: "doit", outcomeDefinition: { effectRules: [{ effectId: "e1", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: { n: 1 } } ], branches: { "no-roll": [ "e1" ] } } }]}];
  s.selections = { a: { stationId: "a", actionId: "doit" } };
  s.targets = { a: { id: "t" } };

  const report = analyzeVoyageEncounterActionOutcomes(s);
  assert.equal(report.interpretedActionCount, 1);
  assert.equal(report.intentCount, 1);
  const act = report.actions[0];
  assert.deepEqual(Object.keys(act), ["sequence","stationId","actionId","mode","branch","riskBidId","branchEffectIds","riskBidEffectIds","intentIds"]);
  const intent = report.intents[0];
  const expectedIntentKeys = [
    "intentId","encounterId","stageId","roundNumber","sequence","stationId","actionId","mode","branch","riskBidId","activationSource","referenceIndex","effectId","intentType","timing","visibility","target","selectedTarget","payload"
  ];
  assert.deepEqual(Object.keys(intent), expectedIntentKeys);
  // roll details must not be present
  for (const forbidden of ["total","dc","degreeOfSuccess","statisticSlug","rollMode","pendingCheckId","pendingCheckIndex"]) assert.equal(Object.hasOwn(intent, forbidden), false);
});

test("four resolved check branches interpreted correctly", () => {
  const state = createVoyageEncounterState({ encounterId: "branches", definitionId: "def", primaryShip: { id: "ship" } });
  state.lifecycleState = "active";
  state.currentStage = { stageId: "stage" };
  state.roundNumber = 1;
  state.phase = "resolution";

  const branches = ["critical-failure","failure","success","critical-success"];
  const availableStations = [];
  const selections = {};
  for (let i = 0; i < 4; i += 1) {
    const stationId = `s${i}`;
    const actionId = `a${i}`;
    const branchObj = { "critical-failure": [], "failure": [], "success": [], "critical-success": [] };
    branchObj[branches[i]] = [`r-${i}`].map((v) => v.replace('-', ''));
    availableStations.push({ stationId, actions: [{ actionId, check: { source: { kind: "character", uuid: `Actor.${i}` }, statisticOptions: ["diplomacy"], dcSource: { kind: "fixed", value: 20 + i }, secrecy: "public", metadata: {} }, outcomeDefinition: { effectRules: [{ effectId: `r${i}`, intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: null } ], branches: branchObj } }] });
    selections[stationId] = { stationId, actionId };
  }

  Object.assign(state, { availableStations, selections, targets: {} });

  // prepare pending checks
  const prepared = applyVoyageEncounterPendingCheckPreparation(state, { pendingCheckIds: Array.from({ length: 4 }, (_, sequence) => ({ sequence, pendingCheckId: `p-${sequence}` })) });
  assert.equal(prepared.ok, true);
  let after = prepared.nextState;

  // apply results to resolve each pending check
  for (let seq = 0; seq < 4; seq += 1) {
    const result = {
      ok: true,
      status: "rolled",
      pendingCheckId: `p-${seq}`,
      sequence: seq,
      sourceKind: "character",
      sourceUuid: `Actor.${seq}`,
      statisticSlug: "diplomacy",
      dc: 20 + seq,
      rollMode: "public",
      result: {
        total: 20 + seq,
        degreeOfSuccess: seq, // map 0..3
        degreeOfSuccessSlug: branches[seq]
      },
      errors: [],
      warnings: []
    };
    const applied = applyVoyageEncounterPendingCheckResult(after, result);
    assert.equal(applied.ok, true);
    after = applied.nextState;
  }

  // move to consequences for interpretation
  after.phase = "consequences";
  const report = analyzeVoyageEncounterActionOutcomes(after);
  assert.equal(report.resolutionComplete, true);
  assert.equal(report.readyForInterpretation, true);
  assert.equal(report.interpretedActionCount, 4);
  assert.equal(report.intentCount, 4);
});

test("complete plan with invalid definition is incomplete for interpretation but resolutionComplete true", () => {
  const s = createVoyageEncounterState({ encounterId: "baddef", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "consequences";
  // a no-roll action with malformed branches (invalid definition)
  s.availableStations = [{ stationId: "x", actions: [{ actionId: "bad", outcomeDefinition: { effectRules: [], branches: null } }]}];
  s.selections = { x: { stationId: "x", actionId: "bad" } };

  const report = analyzeVoyageEncounterActionOutcomes(s);
  assert.equal(report.resolutionComplete, true);
  assert.equal(report.definitionsValid, false);
  assert.equal(report.readyForInterpretation, false);
  assert.equal(report.interpretedActionCount, 0);
  assert.equal(report.intentCount, 0);
});

test("selected check action with no pending check yields missing pending check diagnostic and atomic empty output", () => {
  const s = createVoyageEncounterState({ encounterId: "nopending", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "resolution";
  s.availableStations = [{ stationId: "b", actions: [{ actionId: "chk", check: { source: { kind: "character" }, statisticOptions: ["X"], dcSource: { kind: "fixed", value: 5 }, secrecy: "public", metadata: {} }, outcomeDefinition: { effectRules: [{ effectId: "r1", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: null } ], branches: { "critical-failure": ["r1"], "failure": [], "success": [], "critical-success": [] } } }]}];
  s.selections = { b: { stationId: "b", actionId: "chk" } };
  s.targets = { b: { id: "t" } };
  // no pendingChecks prepared
  s.pendingChecks = [];
  const report = analyzeVoyageEncounterActionOutcomes(s);
  assert.ok(report.errors.some((e) => e.code === "outcome-interpretation-pending-check-missing"));
  assert.equal(report.interpretedActionCount, 0);
  assert.equal(report.intentCount, 0);
});

test("unresolved sparse pending check at index 3 yields exact path and atomic empty output", () => {
  const s = createVoyageEncounterState({ encounterId: "sparse", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "resolution";
  s.availableStations = [{ stationId: "b", actions: [{ actionId: "chk", check: { source: { kind: "character" }, statisticOptions: ["X"], dcSource: { kind: "fixed", value: 5 }, secrecy: "public", metadata: {} }, outcomeDefinition: { effectRules: [{ effectId: "r1", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: null } ], branches: { "critical-failure": ["r1"], "failure": [], "success": [], "critical-success": [] } } }]}];
  s.selections = { b: { stationId: "b", actionId: "chk" } };
  s.targets = { b: { id: "t" } };
  s.pendingChecks = [];
  s.pendingChecks.length = 4;
  s.pendingChecks[3] = { pendingCheckId: "pc3", preparedRevision: 0, stageId: "stage", roundNumber: 1, sequence: 0, stationId: "b", actionId: "chk", resolutionPriority: 0, riskBidId: null, target: { id: "t" }, mode: "check", source: { kind: "character" }, statisticOptions: ["X"], dcSource: { kind: "fixed", value: 5 }, secrecy: "public", metadata: {}, status: "pending", result: null };

  const report = analyzeVoyageEncounterActionOutcomes(s);
  assert.ok(report.errors.some((e) => e.code === "outcome-interpretation-pending-check-unresolved" && e.path === "pendingChecks[3].status"));
  assert.equal(report.resolutionComplete, false);
  assert.equal(report.interpretedActionCount, 0);
  assert.equal(report.intentCount, 0);
});

test("two selected actions from two stations interpret in priority order", () => {
  const s = createVoyageEncounterState({ encounterId: "prio", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "consequences";
  s.availableStations = [
    { stationId: "one", actions: [{ actionId: "a", resolutionPriority: 5, outcomeDefinition: { effectRules: [{ effectId: "r1", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: null } ], branches: { "no-roll": ["r1"] } } }] },
    { stationId: "two", actions: [{ actionId: "b", resolutionPriority: 1, outcomeDefinition: { effectRules: [{ effectId: "r2", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: null } ], branches: { "no-roll": ["r2"] } } }] }
  ];
  s.selections = { one: { stationId: "one", actionId: "a" }, two: { stationId: "two", actionId: "b" } };
  s.targets = {};
  const report = analyzeVoyageEncounterActionOutcomes(s);
  assert.equal(report.interpretedActionCount, 2);
  // sequence numbers should reflect resolutionPriority order: b then a
  assert.equal(report.actions[0].stationId, "two");
  assert.equal(report.actions[1].stationId, "one");
});

test("sparse own branch refs ignore inherited getters and preserve indexes", () => {
  const s = createVoyageEncounterState({ encounterId: "sparse-ref", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "consequences";
  const branches = [];
  branches.length = 3;
  Object.defineProperty(branches, 0, { configurable: true, enumerable: true, value: "r0" });
  // put an inherited getter at index 1 that would throw if read
  const proto = Object.create(Array.prototype);
  Object.defineProperty(proto, 1, { configurable: true, get() { throw new Error("inherited"); } });
  Object.setPrototypeOf(branches, proto);

  s.availableStations = [{ stationId: "s", actions: [{ actionId: "a", outcomeDefinition: { effectRules: [{ effectId: "r0", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: null } ], branches: { "no-roll": branches } } }]}];
  s.selections = { s: { stationId: "s", actionId: "a" } };
  const report = analyzeVoyageEncounterActionOutcomes(s);
  // should create only one intent for own index 0 and preserve index 0
  assert.equal(report.intentCount, 1);
  assert.equal(report.intents[0].referenceIndex, 0);
});

test("deterministic intent IDs and uniqueness across sequences and refs", () => {
  const s = createVoyageEncounterState({ encounterId: "det", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "consequences";
  s.availableStations = [{ stationId: "x", actions: [{ actionId: "a", outcomeDefinition: { effectRules: [{ effectId: "e1", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: null } ], branches: { "no-roll": ["e1"] } } }, { actionId: "b", outcomeDefinition: { effectRules: [{ effectId: "e2", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: null } ], branches: { "no-roll": ["e2"] } } }] }];
  s.selections = { x: { stationId: "x", actionId: "a" } };
  s.targets = {};
  const r1 = analyzeVoyageEncounterActionOutcomes(s);
  const ids1 = r1.intents.map((i) => i.intentId);
  const r2 = analyzeVoyageEncounterActionOutcomes(s);
  const ids2 = r2.intents.map((i) => i.intentId);
  assert.deepEqual(ids1, ids2);
  // different sequence -> different id
  s.selections = { x: { stationId: "x", actionId: "b" } };
  const r3 = analyzeVoyageEncounterActionOutcomes(s);
  assert.notDeepEqual(r3.intents.map((i) => i.intentId), ids1);
});

test("deep isolation: mutating returned data does not affect source and later reports", () => {
  const s = createVoyageEncounterState({ encounterId: "iso", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "consequences";
  s.availableStations = [{ stationId: "a", actions: [{ actionId: "doit", outcomeDefinition: { effectRules: [{ effectId: "e1", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: { nested: { v: 1 } } } ], branches: { "no-roll": [ "e1" ] } } }]}];
  s.selections = { a: { stationId: "a", actionId: "doit" } };
  const r1 = analyzeVoyageEncounterActionOutcomes(s);
  // mutate returned arrays and objects
  r1.actions[0].branchEffectIds[0] = "mut";
  r1.intents[0].payload.nested.v = 999;
  // re-run report
  const r2 = analyzeVoyageEncounterActionOutcomes(s);
  assert.equal(r2.actions[0].branchEffectIds[0], "e1");
  assert.equal(r2.intents[0].payload.nested.v, 1);
});
