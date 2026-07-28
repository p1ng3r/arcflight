import assert from "node:assert/strict";
import test from "node:test";

import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterStationAssignments } from "../../../scripts/voyage/domain/station-assignments-application.js";
import { analyzeVoyageStationAssignments } from "../../../scripts/voyage/domain/station-assignments.js";

function operator(stationId = "captain", overrides = {}) {
  return {
    stationId,
    operator: {
      kind: "actor",
      id: `${stationId}-actor`,
      uuid: `Actor.${stationId}-actor`,
      name: `${stationId} operator`,
      ...overrides
    }
  };
}

test("applyVoyageEncounterStationAssignments succeeds in pre-activation and increments revision once", () => {
  const source = createVoyageEncounterState({ encounterId: "assignments-test" });
  source.lifecycleState = "configuration";
  const request = [operator("captain"), operator("engineer")];
  const requestClone = structuredClone(request);
  const result = applyVoyageEncounterStationAssignments(source, request);

  assert.equal(result.ok, true);
  assert.equal(result.nextState.revision, 1);
  assert.equal(result.nextState.lifecycleState, "configuration");
  assert.deepEqual(result.nextState.stationAssignments, request);
  assert.notEqual(result.nextState, source);
  assert.deepEqual(source.stationAssignments, []);
  assert.deepEqual(request, requestClone);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, "voyage.station-assignments-set");
  assert.equal(result.events[0].previousRevision, 0);
  assert.equal(result.events[0].revision, 1);
  assert.deepEqual(result.events[0].occupiedStationIds, ["captain", "engineer"]);
});

test("applyVoyageEncounterStationAssignments rejects malformed input atomically", () => {
  const source = createVoyageEncounterState({ encounterId: "assignments-fail" });
  source.lifecycleState = "ready";
  const malformed = [{ stationId: "pilot", operator: { kind: "actor", id: "pilot-actor" } }];
  const before = structuredClone(source);
  const requestClone = structuredClone(malformed);
  const result = applyVoyageEncounterStationAssignments(source, malformed);

  assert.equal(result.ok, false);
  assert.equal(source.revision, before.revision);
  assert.deepEqual(source, before);
  assert.deepEqual(malformed, requestClone);
  assert.equal(result.events.length, 0);
  assert.ok(result.errors.some((entry) => entry.code === "unsupported-event-runner-station-id"));
});

test("applyVoyageEncounterStationAssignments rejects duplicate stations and operators", () => {
  const source = createVoyageEncounterState({ encounterId: "assignments-duplicate" });
  source.lifecycleState = "draft";
  const bad = [operator("captain"), operator("captain", { id: "captain-actor" })];
  const result = applyVoyageEncounterStationAssignments(source, bad);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.code === "duplicate-station-assignment"));
  assert.ok(result.errors.some((entry) => entry.code === "duplicate-station-operator"));
  assert.equal(source.revision, 0);
});

test("applyVoyageEncounterStationAssignments rejects after activation", () => {
  const source = createVoyageEncounterState({ encounterId: "assignments-active" });
  source.lifecycleState = "active";
  source.roundNumber = 1;
  source.phase = "situation";
  source.currentStage = { stageId: "opening" };
  const result = applyVoyageEncounterStationAssignments(source, []);

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "station-assignments-requires-preactivation");
});

test("analyzeVoyageStationAssignments is non-mutating for valid assignment collections", () => {
  const source = [operator("captain")];
  const before = structuredClone(source);
  const report = analyzeVoyageStationAssignments(source);
  report.assignments[0].operator.name = "Changed";
  assert.deepEqual(source, before);
});

test("empty stationAssignments are permitted when canonical rules allow unoccupied stations", () => {
  const source = createVoyageEncounterState({ encounterId: "assignments-empty" });
  source.lifecycleState = "configuration";
  const result = applyVoyageEncounterStationAssignments(source, []);

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.stationAssignments, []);
  assert.equal(result.nextState.revision, 1);
});

test("non-array assignment input delegates to the single assignment contract", () => {
  const source = createVoyageEncounterState({ encounterId: "assignments-non-array" });
  source.lifecycleState = "configuration";

  const result = applyVoyageEncounterStationAssignments(source, {});

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [{
    code: "invalid-station-assignments",
    path: "stationAssignments",
    message: "Station assignments must be an array.",
    severity: "error"
  }]);
  assert.equal(source.revision, 0);
});

test("candidate construction failures remain atomic and structured", () => {
  const source = createVoyageEncounterState({ encounterId: "assignments-clone-failure" });
  source.lifecycleState = "configuration";
  const request = [operator("captain")];
  const requestBefore = structuredClone(request);
  Object.defineProperty(source, "metadata", {
    enumerable: true,
    configurable: true,
    get() {
      throw new Error("clone failure");
    }
  });

  const result = applyVoyageEncounterStationAssignments(source, request);

  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.equal(result.errors[0].code, "station-assignments-candidate-construction-failed");
  assert.equal(source.revision, 0);
  assert.deepEqual(source.stationAssignments, []);
  assert.deepEqual(request, requestBefore);
});

test("sparse replacement reports the number of actual assignments", () => {
  const source = createVoyageEncounterState({ encounterId: "assignments-sparse" });
  source.lifecycleState = "configuration";
  const request = new Array(3);
  request[2] = operator("navigator");

  const result = applyVoyageEncounterStationAssignments(source, request);

  assert.equal(result.ok, true);
  assert.equal(result.nextState.stationAssignments.length, 3);
  assert.equal(Object.hasOwn(result.nextState.stationAssignments, 0), false);
  assert.equal(Object.hasOwn(result.nextState.stationAssignments, 1), false);
  assert.equal(Object.hasOwn(result.nextState.stationAssignments, 2), true);
  assert.equal(result.events[0].stationAssignmentCount, 1);
  assert.deepEqual(result.events[0].occupiedStationIds, ["navigator"]);
});
