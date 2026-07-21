import assert from "node:assert/strict";
import test from "node:test";
import { applyVoyageEncounterCrewPlanningLock } from "../../../scripts/voyage/domain/crew-planning-lock.js";
import { applyVoyageEncounterStationActionSelection, applyVoyageEncounterStationActionSelectionChange, applyVoyageEncounterStationActionSelectionClear } from "../../../scripts/voyage/domain/station-selection.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function encounter() {
  return { ...createDraftVoyageEncounterDefaults(), encounterId: "lock", definitionId: "glassback", lifecycleState: STATES.ACTIVE, revision: 4,
    primaryShip: { actorId: "ship" }, currentStage: { stageId: "opening" }, currentSituation: { threatId: "debris" }, objective: { objectiveId: "survive" }, roundNumber: 1,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING, availableStations: [{ stationId: "captain", actions: [{ actionId: "rally" }, { actionId: "command" }] }, { stationId: "navigator", actions: [{ actionId: "course" }] }],
    selections: { captain: { stationId: "captain", actionId: "rally" }, navigator: { stationId: "navigator", actionId: "course" } }, targets: { retained: true }, riskBids: { retained: true }, assistance: [{ retained: true }], reservations: [{ retained: true }],
    successConditions: [{ conditionId: "success" }], failureConditions: [{ conditionId: "failure" }], snapshots: [], recovery: {}, metadata: { retained: true } };
}
function failure(result) { assert.equal(result.ok, false); assert.equal(result.nextState, null); assert.deepEqual(result.events, []); }

test("locks a complete plan atomically and creates the established phase-start snapshot", () => {
  const source = encounter(); const before = clonePlainData(source); const request = { phaseStartSnapshotId: "lock-readiness-start" }; const result = applyVoyageEncounterCrewPlanningLock(source, request);
  assert.equal(result.ok, true); assert.equal(result.nextState.phase, VOYAGE_ROUND_PHASES.LOCK_READINESS); assert.equal(result.nextState.revision, 5); assert.deepEqual(result.nextState.selections, before.selections); assert.deepEqual(result.nextState.targets, before.targets); assert.equal(result.nextState.snapshots.length, 1);
  assert.deepEqual(result.events, [{ type: "voyage.crew-planning-locked", encounterId: "lock", lifecycleState: STATES.ACTIVE, roundNumber: 1, previousPhase: VOYAGE_ROUND_PHASES.CREW_PLANNING, phase: VOYAGE_ROUND_PHASES.LOCK_READINESS, previousRevision: 4, revision: 5, phaseStartSnapshotId: "lock-readiness-start" }]);
  assert.deepEqual(source, before);
});

test("rejects incomplete, invalid, wrong-context, duplicate lock, and invalid requests without mutation", () => {
  for (const alter of [(state) => { delete state.selections.navigator; }, (state) => { state.selections.bad = { stationId: "bad", actionId: "none" }; }, (state) => { state.lifecycleState = STATES.PAUSED; }, (state) => { state.phase = VOYAGE_ROUND_PHASES.LOCK_READINESS; }]) {
    const source = encounter(); alter(source); const before = clonePlainData(source); const result = applyVoyageEncounterCrewPlanningLock(source, { phaseStartSnapshotId: "x" }); failure(result); assert.deepEqual(source, before);
  }
  const source = encounter(); const before = clonePlainData(source); failure(applyVoyageEncounterCrewPlanningLock(source, {})); assert.deepEqual(source, before);
});

test("existing selection mutations reject locked plans without changing state, revision, or events", () => {
  const locked = applyVoyageEncounterCrewPlanningLock(encounter(), { phaseStartSnapshotId: "lock" }).nextState; const before = clonePlainData(locked);
  for (const result of [applyVoyageEncounterStationActionSelection(locked, { stationId: "captain", actionId: "command" }), applyVoyageEncounterStationActionSelectionChange(locked, { stationId: "captain", actionId: "command" }), applyVoyageEncounterStationActionSelectionClear(locked, { stationId: "captain" })]) {
    failure(result); assert.equal(result.errors[0].code, "station-selection-requires-crew-planning");
  }
  assert.deepEqual(locked, before);
});
