import assert from "node:assert/strict";
import test from "node:test";
import { prepareVoyageEncounterCrewPlanningReadiness } from "../../../scripts/voyage/domain/crew-planning-readiness.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function encounter() {
  return { ...createDraftVoyageEncounterDefaults(), encounterId: "readiness", definitionId: "glassback", lifecycleState: STATES.ACTIVE, revision: 4,
    primaryShip: { actorId: "ship" }, currentStage: { stageId: "opening" }, currentSituation: { threatId: "debris" }, objective: { objectiveId: "survive" }, roundNumber: 1,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING, availableStations: [{ stationId: " Captain ", actions: [{ actionId: "rally" }] }, { stationId: "engineer", actions: [{ actionId: "repair" }], selectionRequired: false }, { stationId: "navigator", actions: [{ actionId: "course" }] }],
    selections: {}, successConditions: [{ conditionId: "success" }], failureConditions: [{ conditionId: "failure" }], snapshots: [], recovery: {}, metadata: {} };
}

test("reports readiness from completeness without mutating input or sharing results", () => {
  const source = encounter(); source.selections = { " Captain ": { stationId: " Captain ", actionId: "rally" }, navigator: { stationId: "navigator", actionId: "course" } };
  const before = clonePlainData(source); const first = prepareVoyageEncounterCrewPlanningReadiness(source); const second = prepareVoyageEncounterCrewPlanningReadiness(source);
  assert.equal(first.structurallyValid, true); assert.equal(first.active, true); assert.equal(first.crewPlanning, true); assert.equal(first.complete, true); assert.equal(first.readyToLock, true);
  assert.deepEqual(first.missingRequiredStationIds, []); assert.notEqual(first, second); assert.notEqual(first.errors, second.errors); first.requiredStationIds.push("changed");
  assert.deepEqual(second.requiredStationIds, [" Captain ", "navigator"]); assert.deepEqual(source, before);
});

test("reports required omissions, malformed persisted data, context failures, and exact IDs", () => {
  const missing = encounter(); assert.deepEqual(prepareVoyageEncounterCrewPlanningReadiness(missing).missingRequiredStationIds, [" Captain ", "navigator"]);
  const invalid = encounter(); invalid.selections.bad = { stationId: "bad", actionId: "none" }; assert.equal(prepareVoyageEncounterCrewPlanningReadiness(invalid).readyToLock, false);
  const duplicate = encounter(); duplicate.availableStations.push({ stationId: "navigator", actions: [] }); assert.ok(prepareVoyageEncounterCrewPlanningReadiness(duplicate).errors.some((item) => item.code === "duplicate-available-station-id"));
  const inactive = encounter(); inactive.lifecycleState = STATES.PAUSED; assert.ok(prepareVoyageEncounterCrewPlanningReadiness(inactive).errors.some((item) => item.code === "crew-planning-readiness-requires-active"));
  const wrongPhase = encounter(); wrongPhase.phase = VOYAGE_ROUND_PHASES.LOCK_READINESS; assert.ok(prepareVoyageEncounterCrewPlanningReadiness(wrongPhase).errors.some((item) => item.code === "crew-planning-readiness-requires-crew-planning"));
});

test("readiness imports without Foundry globals", () => assert.equal(typeof prepareVoyageEncounterCrewPlanningReadiness, "function"));
