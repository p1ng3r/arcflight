import assert from "node:assert/strict";
import test from "node:test";
import { prepareVoyageEncounterCrewPlanningReadiness } from "../../../scripts/voyage/domain/crew-planning-readiness.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function encounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "readiness",
    definitionId: "glassback",
    lifecycleState: STATES.ACTIVE,
    revision: 4,
    primaryShip: { actorId: "ship" },
    currentStage: { stageId: "opening" },
    currentSituation: { threatId: "debris" },
    objective: { objectiveId: "survive" },
    roundNumber: 1,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    availableStations: [
      { stationId: "captain", actions: [{ actionId: "rally" }], selectionRequired: false },
      { stationId: "engineer", actions: [{ actionId: "repair" }], selectionRequired: true },
      { stationId: "navigator", actions: [{ actionId: "course" }] }
    ],
    stationAssignments: [
      { stationId: "captain", operator: { kind: "actor", uuid: "Actor.captain" } },
      { stationId: "navigator", operator: { kind: "actor", uuid: "Actor.navigator" } }
    ],
    selections: {},
    successConditions: [{ conditionId: "success" }],
    failureConditions: [{ conditionId: "failure" }],
    snapshots: [],
    recovery: {},
    metadata: {}
  };
}

function selectOccupiedStations(source) {
  source.selections = {
    captain: { stationId: "captain", actionId: "rally" },
    navigator: { stationId: "navigator", actionId: "course" }
  };
}

test("reports readiness from occupied-station completeness without mutation or shared arrays", () => {
  const source = encounter();
  selectOccupiedStations(source);
  const before = clonePlainData(source);

  const first = prepareVoyageEncounterCrewPlanningReadiness(source);
  const second = prepareVoyageEncounterCrewPlanningReadiness(source);

  assert.equal(first.structurallyValid, true);
  assert.equal(first.active, true);
  assert.equal(first.crewPlanning, true);
  assert.equal(first.complete, true);
  assert.equal(first.readyToLock, true);
  assert.deepEqual(first.occupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(first.selectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(first.missingOccupiedStationIds, []);
  assert.notEqual(first, second);
  assert.notEqual(first.errors, second.errors);
  assert.notEqual(first.occupiedStationIds, second.occupiedStationIds);
  assert.notEqual(first.selectedStationIds, second.selectedStationIds);
  assert.notEqual(first.missingOccupiedStationIds, second.missingOccupiedStationIds);

  first.occupiedStationIds.push("engineer");
  first.selectedStationIds.length = 0;
  first.missingOccupiedStationIds.push("captain");

  assert.deepEqual(second.occupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.selectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.missingOccupiedStationIds, []);
  assert.deepEqual(source, before);
});

test("readiness reports only the canonical occupied-station array names", () => {
  const result = prepareVoyageEncounterCrewPlanningReadiness(encounter());

  assert.equal(Object.hasOwn(result, "occupiedStationIds"), true);
  assert.equal(Object.hasOwn(result, "selectedStationIds"), true);
  assert.equal(Object.hasOwn(result, "missingOccupiedStationIds"), true);
  assert.equal(Object.hasOwn(result, "requiredStationIds"), false);
  assert.equal(Object.hasOwn(result, "optionalStationIds"), false);
  assert.equal(Object.hasOwn(result, "missingRequiredStationIds"), false);
});

test("reports occupied omissions, malformed persisted data, and context failures", () => {
  const missing = encounter();
  assert.deepEqual(
    prepareVoyageEncounterCrewPlanningReadiness(missing).missingOccupiedStationIds,
    ["captain", "navigator"]
  );

  const invalid = encounter();
  invalid.selections.engineer = { stationId: "engineer", actionId: "repair" };
  assert.equal(prepareVoyageEncounterCrewPlanningReadiness(invalid).readyToLock, false);

  const duplicate = encounter();
  duplicate.availableStations.push({ stationId: "navigator", actions: [] });
  assert.ok(
    prepareVoyageEncounterCrewPlanningReadiness(duplicate).errors
      .some((item) => item.code === "duplicate-available-station-id")
  );

  const inactive = encounter();
  inactive.lifecycleState = STATES.PAUSED;
  assert.ok(
    prepareVoyageEncounterCrewPlanningReadiness(inactive).errors
      .some((item) => item.code === "crew-planning-readiness-requires-active")
  );

  const wrongPhase = encounter();
  wrongPhase.phase = VOYAGE_ROUND_PHASES.LOCK_READINESS;
  assert.ok(
    prepareVoyageEncounterCrewPlanningReadiness(wrongPhase).errors
      .some((item) => item.code === "crew-planning-readiness-requires-crew-planning")
  );
});

test("requires a deterministic non-empty current stage ID before reporting lock readiness", () => {
  for (const currentStage of [{}, { stageId: "   " }]) {
    const source = encounter();
    source.currentStage = currentStage;
    selectOccupiedStations(source);

    const report = prepareVoyageEncounterCrewPlanningReadiness(source);

    assert.equal(report.readyToLock, false);
    assert.deepEqual(report.errors, [{
      code: "invalid-crew-planning-readiness-stage-id",
      path: "currentStage.stageId",
      message: "Crew Planning readiness requires a non-empty current stageId for the Lock Readiness snapshot.",
      severity: "error"
    }]);
  }
});

test("readiness imports without Foundry globals", () => {
  assert.equal(typeof prepareVoyageEncounterCrewPlanningReadiness, "function");
});
