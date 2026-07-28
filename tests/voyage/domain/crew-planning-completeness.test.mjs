import assert from "node:assert/strict";
import test from "node:test";
import { prepareVoyageEncounterCrewPlanningCompleteness } from "../../../scripts/voyage/domain/crew-planning-completeness.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function encounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "completeness",
    definitionId: "glassback",
    lifecycleState: STATES.ACTIVE,
    revision: 3,
    primaryShip: { actorId: "ship" },
    currentStage: { stageId: "opening" },
    currentSituation: { threatId: "debris" },
    objective: { objectiveId: "survive" },
    roundNumber: 1,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    availableStations: [
      { stationId: "captain", actions: [{ actionId: "rally" }], selectionRequired: false },
      { stationId: "engineer", actions: [{ actionId: "stabilize" }], selectionRequired: true },
      { stationId: "navigator", actions: [{ actionId: "course" }] }
    ],
    stationAssignments: [
      { stationId: "captain", operator: { kind: "actor", uuid: "Actor.captain", name: "Captain" } },
      { stationId: "navigator", operator: { kind: "actor", uuid: "Actor.navigator", name: "Navigator" } }
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

function codes(result) {
  return result.errors.map(({ code }) => code);
}

test("an occupied station without a selection is incomplete", () => {
  const source = encounter();
  source.selections.captain = { stationId: "captain", actionId: "rally" };

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.equal(result.complete, false);
  assert.deepEqual(result.occupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.selectedStationIds, ["captain"]);
  assert.deepEqual(result.missingOccupiedStationIds, ["navigator"]);
});

test("every occupied station selected is complete in assignment order", () => {
  const source = encounter();
  selectOccupiedStations(source);

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.equal(result.complete, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.occupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.selectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.missingOccupiedStationIds, []);
});

test("an unoccupied available station requires no selection", () => {
  const source = encounter();
  selectOccupiedStations(source);

  assert.equal(prepareVoyageEncounterCrewPlanningCompleteness(source).complete, true);
});

test("a selection for an unoccupied station is rejected", () => {
  const source = encounter();
  selectOccupiedStations(source);
  source.selections.engineer = { stationId: "engineer", actionId: "stabilize" };

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.equal(result.complete, false);
  assert.ok(codes(result).includes("selected-station-not-occupied"));
});

test("selectionRequired does not control occupied-station completeness", () => {
  const source = encounter();

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.deepEqual(result.occupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.missingOccupiedStationIds, ["captain", "navigator"]);
  assert.equal(result.complete, false);
});

test("canonical reports use only the occupied-station result names", () => {
  const result = prepareVoyageEncounterCrewPlanningCompleteness(encounter());

  assert.equal(Object.hasOwn(result, "occupiedStationIds"), true);
  assert.equal(Object.hasOwn(result, "selectedStationIds"), true);
  assert.equal(Object.hasOwn(result, "missingOccupiedStationIds"), true);
  assert.equal(Object.hasOwn(result, "requiredStationIds"), false);
  assert.equal(Object.hasOwn(result, "optionalStationIds"), false);
  assert.equal(Object.hasOwn(result, "missingRequiredStationIds"), false);
});

test("supports no occupied stations without requiring available station selections", () => {
  const source = encounter();
  source.stationAssignments = [];

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.equal(result.complete, true);
  assert.deepEqual(result.occupiedStationIds, []);
  assert.deepEqual(result.selectedStationIds, []);
  assert.deepEqual(result.missingOccupiedStationIds, []);
});

test("rejects duplicate, malformed, missing, blank, and unsafe available station entries", () => {
  for (const [stations, code] of [
    [[{ stationId: "captain", actions: [] }, { stationId: "captain", actions: [] }], "duplicate-available-station-id"],
    [[null], "invalid-available-station"],
    [[{ actions: [] }], "invalid-available-station-id"],
    [[{ stationId: "   ", actions: [] }], "invalid-available-station-id"],
    [[{ stationId: "__proto__", actions: [] }], "unsafe-available-station-id"],
    [[{ stationId: "captain", actions: null }], "invalid-available-station-actions"]
  ]) {
    const source = encounter();
    source.availableStations = stations;
    assert.ok(codes(prepareVoyageEncounterCrewPlanningCompleteness(source)).includes(code));
  }
});

test("returns structural, lifecycle, phase, and unavailable-selection validation errors", () => {
  const structural = encounter();
  structural.schemaVersion = 0;
  assert.ok(codes(prepareVoyageEncounterCrewPlanningCompleteness(structural)).includes("unsupported-schema-version"));

  const inactive = encounter();
  inactive.lifecycleState = STATES.PAUSED;
  assert.ok(codes(prepareVoyageEncounterCrewPlanningCompleteness(inactive)).includes("crew-planning-completeness-requires-active"));

  const wrongPhase = encounter();
  wrongPhase.phase = VOYAGE_ROUND_PHASES.SITUATION;
  assert.ok(codes(prepareVoyageEncounterCrewPlanningCompleteness(wrongPhase)).includes("crew-planning-completeness-requires-crew-planning"));

  const unavailable = encounter();
  unavailable.selections.unknown = { stationId: "unknown", actionId: "none" };
  assert.ok(codes(prepareVoyageEncounterCrewPlanningCompleteness(unavailable)).includes("selected-station-not-available"));
});

test("inherited and sparse available entries and inherited selections are ignored safely", () => {
  const source = encounter();
  const inheritedStations = [{ stationId: "captain", actions: [{ actionId: "rally" }] }];
  inheritedStations.length = 3;
  Object.defineProperty(inheritedStations, 1, {
    value: { stationId: "navigator", actions: [{ actionId: "course" }] },
    enumerable: false
  });
  Object.setPrototypeOf(inheritedStations, {
    2: { stationId: "engineer", actions: [{ actionId: "stabilize" }] }
  });
  source.availableStations = inheritedStations;
  source.stationAssignments = [
    { stationId: "captain", operator: { kind: "actor", uuid: "Actor.captain" } }
  ];
  source.selections = Object.create({
    captain: { stationId: "captain", actionId: "rally" }
  });

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.deepEqual(result.selectedStationIds, []);
  assert.deepEqual(result.missingOccupiedStationIds, ["captain"]);
  assert.equal(result.complete, false);
});

test("report arrays are fresh and isolated and source inputs remain unchanged", () => {
  const source = encounter();
  selectOccupiedStations(source);
  const before = clonePlainData(source);

  const first = prepareVoyageEncounterCrewPlanningCompleteness(source);
  const second = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.notEqual(first, second);
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

test("the completeness helper imports without Foundry globals", () => {
  assert.equal(typeof prepareVoyageEncounterCrewPlanningCompleteness, "function");
});
