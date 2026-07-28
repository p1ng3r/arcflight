import assert from "node:assert/strict";
import test from "node:test";
import { applyVoyageEncounterCrewPlanningLock } from "../../../scripts/voyage/domain/crew-planning-lock.js";
import { createVoyageEncounterBoundarySnapshot } from "../../../scripts/voyage/domain/boundary-snapshots.js";
import { applyVoyageEncounterStationActionSelection, applyVoyageEncounterStationActionSelectionChange, applyVoyageEncounterStationActionSelectionClear } from "../../../scripts/voyage/domain/station-selection.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function statisticApproach(approachId, statisticSlugOrAbilityId = approachId) {
  return { approachId, statisticSlugOrAbilityId };
}
function noRollApproach(approachId) { return { approachId, noRoll: true }; }

function encounter() {
  return { ...createDraftVoyageEncounterDefaults(), encounterId: "lock", definitionId: "glassback", lifecycleState: STATES.ACTIVE, revision: 4,
    primaryShip: { actorId: "ship" }, currentStage: { stageId: "opening" }, currentSituation: { threatId: "debris" }, objective: { objectiveId: "survive" }, roundNumber: 1,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING, availableStations: [{ stationId: "captain", actions: [{ actionId: "rally", approaches: [statisticApproach("diplomacy"), noRollApproach("steady-command")], riskBidOptions: [{ riskBidId: "close" }] }, { actionId: "command", approaches: [statisticApproach("intimidation")] }] }, { stationId: "navigator", actions: [{ actionId: "course", approaches: [statisticApproach("survival"), noRollApproach("careful-course")] }] }],
    stationAssignments: [{ stationId: "captain", operator: { kind: "actor", uuid: "Actor.captain", name: "Captain" } }, { stationId: "navigator", operator: { kind: "actor", uuid: "Actor.navigator", name: "Navigator" } }],
    selections: { captain: { stationId: "captain", actionId: "rally", approachId: "diplomacy", statisticSlugOrAbilityId: "diplomacy" }, navigator: { stationId: "navigator", actionId: "course", approachId: "survival", statisticSlugOrAbilityId: "survival" } }, targets: { retained: true }, riskBids: { captain: { stationId: "captain", actionId: "rally", riskBidId: "close" } }, assistance: [{ retained: true }], reservations: [{ retained: true }],
    successConditions: [{ conditionId: "success" }], failureConditions: [{ conditionId: "failure" }], snapshots: [], recovery: {}, metadata: { retained: true } };
}
function failure(result) { assert.equal(result.ok, false); assert.equal(result.nextState, null); assert.deepEqual(result.events, []); }

test("locks a complete plan atomically and creates the established phase-start snapshot", () => {
  const source = encounter(); const before = clonePlainData(source); const request = { phaseStartSnapshotId: "lock-readiness-start" }; const result = applyVoyageEncounterCrewPlanningLock(source, request);
  assert.equal(result.ok, true); assert.equal(result.nextState.phase, VOYAGE_ROUND_PHASES.LOCK_READINESS); assert.equal(result.nextState.revision, 5); assert.deepEqual(result.nextState.selections, before.selections); assert.deepEqual(result.nextState.targets, before.targets); assert.deepEqual(result.nextState.riskBids, before.riskBids); assert.deepEqual(result.nextState.assistance, before.assistance); assert.deepEqual(result.nextState.reservations, before.reservations); assert.equal(result.nextState.snapshots.length, 1);
  assert.deepEqual(result.nextState.stationAssignments, before.stationAssignments); assert.notEqual(result.nextState.stationAssignments[0].operator, source.stationAssignments[0].operator);
  assert.equal(result.nextState.snapshots[0].phase, VOYAGE_ROUND_PHASES.LOCK_READINESS); assert.deepEqual(result.nextState.snapshots[0].temporaryState.selections, before.selections);
  assert.deepEqual(result.nextState.snapshots[0].temporaryState.stationAssignments, before.stationAssignments); assert.notEqual(result.nextState.snapshots[0].temporaryState.stationAssignments[0].operator, result.nextState.stationAssignments[0].operator);
  assert.deepEqual(result.events, [{ type: "voyage.crew-planning-locked", encounterId: "lock", lifecycleState: STATES.ACTIVE, roundNumber: 1, previousPhase: VOYAGE_ROUND_PHASES.CREW_PLANNING, phase: VOYAGE_ROUND_PHASES.LOCK_READINESS, previousRevision: 4, revision: 5, phaseStartSnapshotId: "lock-readiness-start" }]);
  assert.deepEqual(source, before);
  assert.deepEqual(request, { phaseStartSnapshotId: "lock-readiness-start" });
});

test("locks an explicit no-roll-approach-complete plan", () => {
  const source = encounter();
  source.selections.captain = { stationId: "captain", actionId: "rally", approachId: "steady-command", noRoll: true };
  source.selections.navigator = { stationId: "navigator", actionId: "course", approachId: "careful-course", noRoll: true };
  const before = clonePlainData(source);

  const result = applyVoyageEncounterCrewPlanningLock(source, { phaseStartSnapshotId: "no-roll-lock" });

  assert.equal(result.ok, true);
  assert.equal(result.nextState.phase, VOYAGE_ROUND_PHASES.LOCK_READINESS);
  assert.equal(result.nextState.revision, 5);
  assert.deepEqual(result.nextState.selections, before.selections);
  assert.deepEqual(source, before);
});

test("action-only and one-missing-approach plans cannot lock and remain atomic", () => {
  const actionOnly = encounter();
  actionOnly.selections = {
    captain: { stationId: "captain", actionId: "rally" },
    navigator: { stationId: "navigator", actionId: "course" }
  };
  const oneMissing = encounter();
  oneMissing.selections.navigator = { stationId: "navigator", actionId: "course" };

  for (const [source, snapshotId] of [
    [actionOnly, "action-only"],
    [oneMissing, "one-missing-approach"]
  ]) {
    const before = clonePlainData(source);
    const request = { phaseStartSnapshotId: snapshotId };
    const result = applyVoyageEncounterCrewPlanningLock(source, request);
    failure(result);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(source, before);
    assert.deepEqual(request, { phaseStartSnapshotId: snapshotId });
  }
});

test("rejects request failures atomically without changing source state or request input", () => {
  for (const request of [null, {}, { phaseStartSnapshotId: "   " }]) {
    const source = encounter(); const before = clonePlainData(source); const requestBefore = clonePlainData(request); const result = applyVoyageEncounterCrewPlanningLock(source, request);
    failure(result); assert.equal(source.revision, 4); assert.deepEqual(source, before); assert.deepEqual(request, requestBefore);
  }
  const source = encounter(); source.snapshots.push(createVoyageEncounterBoundarySnapshot(source, { snapshotId: "taken", boundaryType: "phase-start" }).snapshot);
  const before = clonePlainData(source); const request = { phaseStartSnapshotId: "taken" }; const result = applyVoyageEncounterCrewPlanningLock(source, request);
  failure(result); assert.equal(result.errors[0].code, "phase-start-snapshot-id-already-exists"); assert.equal(source.revision, 4); assert.deepEqual(source, before); assert.deepEqual(request, { phaseStartSnapshotId: "taken" });
});

test("rejects state and readiness failures atomically", () => {
  const cases = [
    [(state) => { delete state.selections.navigator; }, "incomplete"],
    [(state) => { state.selections.bad = { stationId: "bad", actionId: "none" }; }, "invalid selection"],
    [(state) => { state.lifecycleState = STATES.PAUSED; }, "inactive"],
    [(state) => { state.phase = VOYAGE_ROUND_PHASES.SITUATION; }, "wrong phase"],
    [(state) => { state.currentStage = {}; }, "missing stage ID"],
    [(state) => { state.currentStage = { stageId: " " }; }, "blank stage ID"]
  ];
  for (const [alter, name] of cases) {
    const source = encounter(); alter(source); const before = clonePlainData(source); const request = { phaseStartSnapshotId: "x" }; const result = applyVoyageEncounterCrewPlanningLock(source, request);
    failure(result); assert.equal(source.revision, 4, name); assert.deepEqual(source, before, name); assert.deepEqual(request, { phaseStartSnapshotId: "x" }, name);
  }
  const initiallyLocked = encounter(); initiallyLocked.phase = VOYAGE_ROUND_PHASES.LOCK_READINESS; const repeated = applyVoyageEncounterCrewPlanningLock(initiallyLocked, { phaseStartSnapshotId: "repeat" }); failure(repeated); assert.equal(repeated.errors[0].code, "same-voyage-phase");
});

test("existing selection mutations reject locked plans without changing state, revision, or events", () => {
  const locked = applyVoyageEncounterCrewPlanningLock(encounter(), { phaseStartSnapshotId: "lock" }).nextState; const before = clonePlainData(locked);
  for (const result of [applyVoyageEncounterStationActionSelection(locked, { stationId: "captain", actionId: "command" }), applyVoyageEncounterStationActionSelectionChange(locked, { stationId: "captain", actionId: "command" }), applyVoyageEncounterStationActionSelectionClear(locked, { stationId: "captain" })]) {
    failure(result); assert.equal(result.errors[0].code, "station-selection-requires-crew-planning");
  }
  assert.deepEqual(locked, before);
});
