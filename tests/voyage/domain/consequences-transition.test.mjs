import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../../../scripts/voyage/domain/pending-checks.js";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";

const EVENT_KEYS = [
  "type",
  "encounterId",
  "lifecycleState",
  "roundNumber",
  "previousPhase",
  "phase",
  "actionCount",
  "checkCount",
  "noRollActionCount",
  "resolvedCheckCount",
  "previousRevision",
  "revision",
  "phaseStartSnapshotId"
];

function noRollState() {
  const state = createVoyageEncounterState({
    encounterId: "consequences",
    definitionId: "definition",
    primaryShip: { id: "ship" }
  });
  Object.assign(state, {
    lifecycleState: "active",
    currentStage: { stageId: "stage" },
    roundNumber: 1,
    phase: "resolution",
    availableStations: [{ stationId: "captain", actions: [{ actionId: "observe" }] }],
    selections: { captain: { stationId: "captain", actionId: "observe" } }
  });
  return state;
}

function resolvedCheckState() {
  const state = createVoyageEncounterState({
    encounterId: "consequences-check",
    definitionId: "definition",
    primaryShip: { id: "ship" }
  });
  Object.assign(state, {
    lifecycleState: "active",
    currentStage: { stageId: "stage" },
    roundNumber: 1,
    phase: "resolution",
    availableStations: [{
      stationId: "captain",
      actions: [{
        actionId: "check",
        check: {
          source: { kind: "character", uuid: "Actor.captain" },
          statisticOptions: ["diplomacy"],
          dcSource: { kind: "fixed", value: 20 },
          secrecy: "public"
        },
        riskBidOptions: [{ riskBidId: "risk" }]
      }]
    }],
    selections: { captain: { stationId: "captain", actionId: "check" } },
    targets: { captain: { targetId: "target" } },
    riskBids: { captain: { riskBidId: "risk", stationId: "captain", actionId: "check" } },
    tracks: [{ trackId: "pressure", visibility: "exact", limitBehavior: "clamp", thresholds: [] }],
    pendingConsequences: [{ consequenceId: "pending-consequence" }],
    assistance: [{ assistanceId: "help" }],
    reservations: [{ reservationId: "reserve" }]
  });

  const prepared = applyVoyageEncounterPendingCheckPreparation(
    state,
    { pendingCheckIds: [{ sequence: 0, pendingCheckId: "pending-0" }] }
  );
  assert.equal(prepared.ok, true);

  const resolved = applyVoyageEncounterPendingCheckResult(prepared.nextState, {
    ok: true,
    status: "rolled",
    pendingCheckId: "pending-0",
    sequence: 0,
    sourceKind: "character",
    sourceUuid: "Actor.captain",
    statisticSlug: "diplomacy",
    dc: 20,
    rollMode: "public",
    result: { total: 20, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" },
    errors: [],
    warnings: []
  });
  assert.equal(resolved.ok, true);
  return resolved.nextState;
}

function assertFailure(state, request) {
  const stateBefore = structuredClone(state);
  const requestKeysBefore = Reflect.ownKeys(request ?? {});
  const result = applyVoyageEncounterConsequencesTransition(state, request);

  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.deepEqual(state, stateBefore);
  assert.deepEqual(Reflect.ownKeys(request ?? {}), requestKeysBefore);
  return result;
}

test("transitions a ready no-roll plan and creates a Consequences phase-start snapshot", () => {
  const state = noRollState();
  const before = structuredClone(state);
  const result = applyVoyageEncounterConsequencesTransition(state, { phaseStartSnapshotId: "consequences-start" });

  assert.equal(result.ok, true);
  assert.equal(result.nextState.phase, "consequences");
  assert.equal(result.nextState.revision, before.revision + 1);
  assert.deepEqual(Object.keys(result.events[0]), EVENT_KEYS);
  assert.deepEqual(result.events[0], {
    type: "voyage.consequences-started",
    encounterId: "consequences",
    lifecycleState: "active",
    roundNumber: 1,
    previousPhase: "resolution",
    phase: "consequences",
    actionCount: 1,
    checkCount: 0,
    noRollActionCount: 1,
    resolvedCheckCount: 0,
    previousRevision: before.revision,
    revision: before.revision + 1,
    phaseStartSnapshotId: "consequences-start"
  });

  const snapshot = result.nextState.snapshots.at(-1);
  assert.equal(snapshot.snapshotId, "consequences-start");
  assert.equal(snapshot.boundaryType, "phase-start");
  assert.equal(snapshot.phase, "consequences");
  assert.deepEqual(state, before);
});

test("transitions an all-resolved plan while preserving the complete Resolution plan state", () => {
  const state = resolvedCheckState();
  const beforePlan = {
    selections: structuredClone(state.selections),
    targets: structuredClone(state.targets),
    riskBids: structuredClone(state.riskBids),
    tracks: structuredClone(state.tracks),
    pendingConsequences: structuredClone(state.pendingConsequences),
    pendingChecks: structuredClone(state.pendingChecks),
    assistance: structuredClone(state.assistance),
    reservations: structuredClone(state.reservations)
  };
  const before = structuredClone(state);
  const result = applyVoyageEncounterConsequencesTransition(state, { phaseStartSnapshotId: "resolved-start" });

  assert.equal(result.ok, true);
  assert.equal(result.events[0].checkCount, 1);
  assert.equal(result.events[0].resolvedCheckCount, 1);
  for (const [field, value] of Object.entries(beforePlan)) {
    assert.deepEqual(result.nextState[field], value, field);
    assert.deepEqual(result.nextState.snapshots.at(-1).temporaryState[field], value, `snapshot ${field}`);
  }
  assert.equal(result.nextState.pendingChecks[0].status, "resolved");
  assert.deepEqual(result.nextState.pendingChecks[0].result, {
    total: 20,
    degreeOfSuccess: 2,
    degreeOfSuccessSlug: "success",
    statisticSlug: "diplomacy",
    dc: 20,
    rollMode: "public"
  });
  assert.deepEqual(state, before);
});

test("rejects incomplete transitions atomically", () => {
  const state = resolvedCheckState();
  state.pendingChecks[0].status = "pending";
  state.pendingChecks[0].result = null;
  const result = assertFailure(state, { phaseStartSnapshotId: "incomplete" });
  assert.equal(result.errors.some((entry) => entry.code === "resolution-not-complete" || entry.code === "resolution-pending-checks-not-resolved"), true);
});

test("rejects blank, unsafe, duplicate, and malformed snapshot IDs", () => {
  for (const id of ["", " ", "\t", "__proto__", "constructor", "prototype"]) {
    assertFailure(noRollState(), { phaseStartSnapshotId: id });
  }

  const duplicate = noRollState();
  duplicate.snapshots.push({ snapshotId: "taken", boundaryType: "phase-start", temporaryState: {} });
  assertFailure(duplicate, { phaseStartSnapshotId: "taken" });

  for (const request of [
    null,
    {},
    { phaseStartSnapshotId: "valid", extra: true },
    Object.defineProperty({ phaseStartSnapshotId: "valid" }, "extra", { configurable: true, value: true }),
    (() => { const value = { phaseStartSnapshotId: "valid" }; value[Symbol("extra")] = true; return value; })()
  ]) {
    assertFailure(noRollState(), request);
  }
});

test("requires Active Resolution and the existing legal phase transition", () => {
  const paused = noRollState();
  paused.lifecycleState = "paused";
  assertFailure(paused, { phaseStartSnapshotId: "paused" });

  const wrongPhase = noRollState();
  wrongPhase.phase = "crew-planning";
  assertFailure(wrongPhase, { phaseStartSnapshotId: "wrong-phase" });
});

test("fails atomically when the candidate cannot preserve valid pending checks", () => {
  const state = resolvedCheckState();
  state.pendingChecks[0].result.extra = true;
  const result = assertFailure(state, { phaseStartSnapshotId: "malformed" });
  assert.ok(result.errors.length > 0);
});
