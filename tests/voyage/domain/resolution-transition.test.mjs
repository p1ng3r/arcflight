import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterResolutionTransition } from "../../../scripts/voyage/domain/resolution-transition.js";

function riskBidOption(riskBidId, dcAdjustment) {
  return {
    riskBidId,
    dcAdjustment,
    outcomes: {
      criticalSuccess: [],
      success: [],
      failure: [],
      criticalFailure: []
    }
  };
}

function lockedState() {
  const state = createVoyageEncounterState({ encounterId: "encounter", definitionId: "definition", primaryShip: { id: "ship" } });
  state.lifecycleState = "active"; state.currentStage = { stageId: "stage" }; state.roundNumber = 1; state.phase = "lock-readiness";
  state.availableStations = [{ stationId: "engineer", actions: [{ actionId: "brace", resolutionPriority: -1 }] }, { stationId: "navigator", actions: [{ actionId: "thread" }] }];
  state.stationAssignments = [{ stationId: "engineer", operator: { kind: "actor", uuid: "Actor.engineer", name: "Engineer" } }, { stationId: "navigator", operator: { kind: "actor", uuid: "Actor.navigator", name: "Navigator" } }];
  state.selections = { engineer: { stationId: "engineer", actionId: "brace" }, navigator: { stationId: "navigator", actionId: "thread" } };
  state.proposedStationOrder = [];
  state.committedStationOrder = ["navigator", "engineer"];
  return state;
}

function lockedRiskState(dcAdjustment = 5) {
  const state = lockedState();
  const action = state.availableStations[1].actions[0];
  action.approaches = [{
    approachId: "survival",
    statisticSlugOrAbilityId: "survival"
  }];
  action.riskBidOptions = [riskBidOption("thread-risk", dcAdjustment)];
  state.selections.navigator = {
    stationId: "navigator",
    actionId: "thread",
    approachId: "survival",
    statisticSlugOrAbilityId: "survival"
  };
  state.riskBids.navigator = {
    stationId: "navigator",
    actionId: "thread",
    riskBidId: "thread-risk",
    dcAdjustment
  };
  return state;
}

function overLimitLockedState() {
  const state = lockedState();
  const stationIds = ["captain", "engineer", "navigator", "watchmaster"];
  state.availableStations = stationIds.map((stationId, index) => ({
    stationId,
    actions: [{
      actionId: `action-${stationId}`,
      approaches: [{
        approachId: `approach-${stationId}`,
        statisticSlugOrAbilityId: `approach-${stationId}`
      }],
      riskBidOptions: [
        riskBidOption(`bid-${stationId}`, [2, 5, 8, 2][index])
      ]
    }]
  }));
  state.stationAssignments = stationIds.map((stationId) => ({
    stationId,
    operator: { kind: "actor", uuid: `Actor.${stationId}` }
  }));
  state.selections = Object.fromEntries(stationIds.map(
    (stationId) => [stationId, {
      stationId,
      actionId: `action-${stationId}`,
      approachId: `approach-${stationId}`,
      statisticSlugOrAbilityId: `approach-${stationId}`
    }]
  ));
  state.riskBids = Object.fromEntries(stationIds.map(
    (stationId, index) => [stationId, {
      stationId,
      actionId: `action-${stationId}`,
      riskBidId: `bid-${stationId}`,
      dcAdjustment: [2, 5, 8, 2][index]
    }]
  ));
  state.committedStationOrder = [...stationIds];
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
  assert.deepEqual(result.nextState.proposedStationOrder, []);
  assert.deepEqual(result.nextState.committedStationOrder, ["navigator", "engineer"]);
  assert.deepEqual(snapshot.temporaryState.proposedStationOrder, []);
  assert.deepEqual(snapshot.temporaryState.committedStationOrder, ["navigator", "engineer"]);
  assert.notEqual(snapshot.temporaryState.proposedStationOrder, result.nextState.proposedStationOrder);
  assert.notEqual(snapshot.temporaryState.committedStationOrder, result.nextState.committedStationOrder);
  assert.deepEqual(result.nextState.stationAssignments, before.stationAssignments); assert.notEqual(result.nextState.stationAssignments[0].operator, state.stationAssignments[0].operator); assert.deepEqual(snapshot.temporaryState.stationAssignments, before.stationAssignments); assert.notEqual(snapshot.temporaryState.stationAssignments[0].operator, result.nextState.stationAssignments[0].operator);
  assert.deepEqual(snapshot.temporaryState.selections, state.selections); assert.deepEqual(snapshot.temporaryState.targets, state.targets); assert.deepEqual(snapshot.temporaryState.riskBids, state.riskBids); assert.deepEqual(snapshot.temporaryState.assistance, state.assistance); assert.deepEqual(snapshot.temporaryState.reservations, state.reservations); assert.deepEqual(result.nextState.pendingChecks, []);
  assert.deepEqual(state, before); assert.deepEqual(request, { phaseStartSnapshotId: "resolution-start" }); assert.equal(result.events.length, 1);
  assert.deepEqual(result.events[0], { type: "voyage.resolution-started", encounterId: "encounter", lifecycleState: "active", roundNumber: 1, previousPhase: "lock-readiness", phase: "resolution", orderedActions: [{ sequence: 0, stationId: "navigator", actionId: "thread", resolutionPriority: 0, riskBidId: null, dcAdjustment: null }, { sequence: 1, stationId: "engineer", actionId: "brace", resolutionPriority: -1, riskBidId: null, dcAdjustment: null }], actionCount: 2, previousRevision: 0, revision: 1, phaseStartSnapshotId: "resolution-start" });
  result.events[0].orderedActions[0].stationId = "changed"; assert.equal(result.nextState.selections.navigator.stationId, "navigator");
  result.nextState.committedStationOrder[0] = "changed-next";
  assert.equal(snapshot.temporaryState.committedStationOrder[0], "navigator");
  assert.equal(state.committedStationOrder[0], "navigator");
});

test("permits a valid empty locked plan when no stations are occupied", () => { const state = lockedState(); state.availableStations = []; state.stationAssignments = []; state.selections = {}; state.committedStationOrder = []; const result = applyVoyageEncounterResolutionTransition(state, { phaseStartSnapshotId: "empty" }); assert.equal(result.ok, true); assert.deepEqual(result.events[0].orderedActions, []); });

test("Resolution transition preserves canonical Risk Bid state, snapshot, and ordered metadata", () => {
  const state = lockedRiskState(5);
  const before = structuredClone(state);
  const result = applyVoyageEncounterResolutionTransition(state, {
    phaseStartSnapshotId: "resolution-risk-bid"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.riskBids, before.riskBids);
  assert.deepEqual(
    result.nextState.snapshots.at(-1).temporaryState.riskBids,
    before.riskBids
  );
  assert.notEqual(
    result.nextState.snapshots.at(-1).temporaryState.riskBids,
    result.nextState.riskBids
  );
  assert.deepEqual(result.events[0].orderedActions[0], {
    sequence: 0,
    stationId: "navigator",
    actionId: "thread",
    resolutionPriority: 0,
    riskBidId: "thread-risk",
    dcAdjustment: 5
  });
  assert.equal(Object.hasOwn(result.events[0].orderedActions[0], "finalDc"), false);
  result.events[0].orderedActions[0].riskBidId = "event-only";
  result.nextState.snapshots.at(-1).temporaryState.riskBids.navigator.riskBidId = "snapshot-only";
  assert.equal(result.nextState.riskBids.navigator.riskBidId, "thread-risk");
  assert.deepEqual(state, before);
});

test("Resolution transition rejects forged and over-limit Risk Bid state atomically", () => {
  const forged = lockedRiskState(2);
  forged.riskBids.navigator.dcAdjustment = 8;
  let result = assertAtomicFailure(forged, {
    phaseStartSnapshotId: "forged-risk-bid"
  });
  assert.ok(result.errors.some(
    (entry) => entry.code === "risk-bid-dc-adjustment-mismatch"
  ));

  const overLimit = overLimitLockedState();
  result = assertAtomicFailure(overLimit, {
    phaseStartSnapshotId: "over-limit-risk-bids"
  });
  assert.ok(result.errors.some(
    (entry) => entry.code === "risk-bid-round-limit-exceeded"
      && entry.path === "riskBids"
  ));
});

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

test("rejects incomplete commitment and stale proposal atomically", () => {
  const incomplete = lockedState();
  incomplete.committedStationOrder = ["navigator"];
  const incompleteResult = assertAtomicFailure(incomplete, { phaseStartSnapshotId: "incomplete" });
  assert.ok(incompleteResult.errors.some(
    (entry) => entry.code === "missing-occupied-station-order-station-id"
  ));

  const staleProposal = lockedState();
  staleProposal.proposedStationOrder = ["engineer", "navigator"];
  const proposalResult = assertAtomicFailure(staleProposal, { phaseStartSnapshotId: "proposal" });
  assert.ok(proposalResult.errors.some(
    (entry) => entry.code === "resolution-order-requires-empty-proposed-station-order"
  ));
});
