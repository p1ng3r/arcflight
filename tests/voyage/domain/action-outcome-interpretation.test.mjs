import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { analyzeVoyageEncounterActionOutcomes } from "../../../scripts/voyage/domain/action-outcome-interpretation.js";

test("empty plan returns empty actions/intents and expected keys", () => {
  const s = createVoyageEncounterState();
  const report = analyzeVoyageEncounterActionOutcomes(s);
  const keys = [
    "structurallyValid","definitionsValid","pendingChecksValid","resolutionComplete","active","consequences","readyForInterpretation","actionCount","interpretedActionCount","checkActionCount","noRollActionCount","intentCount","actions","intents","errors","warnings"
  ];
  assert.deepEqual(Object.keys(report), keys);
  assert.equal(report.actions.length, 0);
  assert.equal(report.intents.length, 0);
});

test("no-roll action interpretation produces action and intent records without roll details", () => {
  const s = createVoyageEncounterState({ encounterId: "e", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "consequences";
  s.availableStations = [{ stationId: "a", actions: [{ actionId: "doit", outcomeDefinition: { effectRules: [{ effectId: "e1", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: { n: 1 } } ], branches: { "no-roll": [ "e1" ] } } }]}];
  s.selections = { a: { stationId: "a", actionId: "doit" } };
  s.targets = { a: { id: "t" } };
  const report = analyzeVoyageEncounterActionOutcomes(s);
  assert.equal(report.actions.length, 1);
  const act = report.actions[0];
  assert.deepEqual(Object.keys(act), ["sequence","stationId","actionId","mode","branch","riskBidId","branchEffectIds","riskBidEffectIds","intentIds"]);
  const intent = report.intents[0];
  const expectedIntentKeys = [
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
    "activationSource",
    "referenceIndex",
    "effectId",
    "intentType",
    "timing",
    "visibility",
    "target",
    "selectedTarget",
    "payload"
  ];
  assert.deepEqual(Object.keys(intent).sort(), expectedIntentKeys.sort());
  // ensure payload preserved and no roll details present
  assert.equal(intent.payload.n, 1);
});

test("check branches map degreeOfSuccessSlug to branch and reference pendingChecks diagnostic", () => {
  const s = createVoyageEncounterState({ encounterId: "e2", definitionId: "def", primaryShip: { id: "ship" } });
  s.lifecycleState = "active";
  s.currentStage = { stageId: "stage" };
  s.roundNumber = 1;
  s.phase = "resolution";
  s.availableStations = [{ stationId: "b", actions: [{ actionId: "chk", check: { source: { kind: "character" }, statisticOptions: ["X"], dcSource: { kind: "fixed", value: 5 }, secrecy: "public", metadata: {} }, outcomeDefinition: { effectRules: [{ effectId: "r1", intentType: "track-change", timing: "consequences", visibility: "public", target: { kind: "encounter" }, payload: null } ], branches: { "critical-failure": ["r1"], "failure": [], "success": [], "critical-success": [] } } }]}];
  s.selections = { b: { stationId: "b", actionId: "chk" } };
  s.targets = { b: { id: "t" } };
  // prepare pendingChecks matching sequence 0 but unresolved
  s.pendingChecks = [];
  s.pendingChecks[0] = { pendingCheckId: "pc1", preparedRevision: 0, stageId: "stage", roundNumber: 1, sequence: 0, stationId: "b", actionId: "chk", resolutionPriority: 0, riskBidId: null, target: { id: "t" }, mode: "check", source: { kind: "character" }, statisticOptions: ["X"], dcSource: { kind: "fixed", value: 5 }, secrecy: "public", metadata: {}, status: "pending", result: null };
  const report = analyzeVoyageEncounterActionOutcomes(s);
  // unresolved pending check should produce an error referencing its index
  assert.ok(report.errors.some((e) => e.path === "pendingChecks[0].status"));
});
