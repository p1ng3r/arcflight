import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterResolutionTransition } from "../../../scripts/voyage/domain/resolution-transition.js";

function lockedState() {
  const state = createVoyageEncounterState({ encounterId: "encounter", definitionId: "definition", primaryShip: { id: "ship" } });
  state.lifecycleState = "active"; state.currentStage = { stageId: "stage" }; state.roundNumber = 1; state.phase = "lock-readiness";
  state.availableStations = [{ stationId: "engineer", actions: [{ actionId: "brace", resolutionPriority: -1 }] }, { stationId: "navigator", actions: [{ actionId: "thread" }] }];
  state.stationAssignments = [{ stationId: "engineer", operator: { kind: "actor", uuid: "Actor.engineer", name: "Engineer" } }, { stationId: "navigator", operator: { kind: "actor", uuid: "Actor.navigator", name: "Navigator" } }];
  state.selections = { engineer: { stationId: "engineer", actionId: "brace" }, navigator: { stationId: "navigator", actionId: "thread" } };
  return state;
}
function assertAtomicFailure(state, request) {
  const before = structuredClone(state); const requestBefore = structuredClone(request);
  const result = applyVoyageEncounterResolutionTransition(state, request);
  assert.equal(result.ok, false); assert.equal(result.nextState, null); assert.deepEqual(result.events, []);
  assert.deepEqual(state, before); assert.deepEqual(request, requestBefore); assert.equal(state.revision, before.revision); assert.equal(state.snapshots.length, before.snapshots.length);
  return result;
}

test("starts Resolution atomically with an isolated phase-start snapshot and event", () => {
  const state = lockedState(); state.targets = { engineer: { targetId: "x" } }; state.assistance = [{ id: "help" }]; state.reservations = [{ id: "reserve" }];
  const request = { phaseStartSnapshotId: "resolution-start" }; const before = structuredClone(state);
  const result = applyVoyageEncounterResolutionTransition(state, request);
  assert.equal(result.ok, true); assert.equal(state.phase, "lock-readiness"); assert.equal(result.nextState.phase, "resolution"); assert.equal(result.nextState.revision, before.revision + 1); assert.equal(result.nextState.snapshots.length, 1);
  const snapshot = result.nextState.snapshots[0]; assert.equal(snapshot.boundaryType, "phase-start"); assert.equal(snapshot.phase, "resolution");
  assert.deepEqual(result.nextState.stationAssignments, before.stationAssignments); assert.notEqual(result.nextState.stationAssignments[0].operator, state.stationAssignments[0].operator); assert.deepEqual(snapshot.temporaryState.stationAssignments, before.stationAssignments); assert.notEqual(snapshot.temporaryState.stationAssignments[0].operator, result.nextState.stationAssignments[0].operator);
  assert.deepEqual(snapshot.temporaryState.selections, state.selections); assert.deepEqual(snapshot.temporaryState.targets, state.targets); assert.deepEqual(snapshot.temporaryState.riskBids, state.riskBids); assert.deepEqual(snapshot.temporaryState.assistance, state.assistance); assert.deepEqual(snapshot.temporaryState.reservations, state.reservations); assert.deepEqual(result.nextState.pendingChecks, []);
  assert.deepEqual(state, before); assert.deepEqual(request, { phaseStartSnapshotId: "resolution-start" }); assert.equal(result.events.length, 1);
  assert.deepEqual(result.events[0], { type: "voyage.resolution-started", encounterId: "encounter", lifecycleState: "active", roundNumber: 1, previousPhase: "lock-readiness", phase: "resolution", orderedActions: [{ sequence: 0, stationId: "engineer", actionId: "brace", resolutionPriority: -1, riskBidId: null }, { sequence: 1, stationId: "navigator", actionId: "thread", resolutionPriority: 0, riskBidId: null }], actionCount: 2, previousRevision: 0, revision: 1, phaseStartSnapshotId: "resolution-start" });
  result.events[0].orderedActions[0].stationId = "changed"; assert.equal(result.nextState.selections.engineer.stationId, "engineer");
});

test("permits a valid empty locked plan when no stations are occupied", () => { const state = lockedState(); state.availableStations = []; state.stationAssignments = []; state.selections = {}; const result = applyVoyageEncounterResolutionTransition(state, { phaseStartSnapshotId: "empty" }); assert.equal(result.ok, true); assert.deepEqual(result.events[0].orderedActions, []); });

test("rejects every ordinary invalid boundary atomically", () => {
  const cases = [
    (state) => { state.lifecycleState = "paused"; }, (state) => { state.phase = "crew-planning"; }, (state) => { delete state.selections.engineer; },
    (state) => { state.selections.engineer.actionId = "unknown"; }, (state) => { state.availableStations[0].actions[0].resolutionPriority = null; },
    (state) => { state.pendingChecks.push({}); }, (state) => { state.riskBids.engineer = {}; }
  ];
  for (const mutate of cases) { const state = lockedState(); mutate(state); assertAtomicFailure(state, { phaseStartSnapshotId: "failure" }); }
});

test("rejects malformed requests and exact snapshot collisions atomically", () => {
  for (const request of [null, {}, { phaseStartSnapshotId: "" }]) assertAtomicFailure(lockedState(), request);
  const state = lockedState(); state.snapshots.push({ snapshotId: "taken", temporaryState: {} }); assertAtomicFailure(state, { phaseStartSnapshotId: "taken" });
});
