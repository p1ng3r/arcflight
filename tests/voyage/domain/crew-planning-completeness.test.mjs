import assert from "node:assert/strict";
import test from "node:test";
import { prepareVoyageEncounterCrewPlanningCompleteness } from "../../../scripts/voyage/domain/crew-planning-completeness.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function encounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "planning-completeness",
    definitionId: "glassback",
    lifecycleState: STATES.ACTIVE,
    revision: 4,
    primaryShip: { actorId: "ship" },
    currentStage: { stageId: "opening" },
    currentSituation: { threat: "debris" },
    objective: { id: "survive" },
    roundNumber: 1,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    participants: [{ participantId: "captain" }],
    availableStations: [
      { stationId: "captain", actions: [{ actionId: "coordinate" }] },
      { stationId: "engineer", actions: [{ actionId: "stabilize" }] },
      { stationId: "watch", selectionRequired: false, actions: [{ actionId: "observe" }] }
    ],
    successConditions: [{ conditionId: "success" }],
    failureConditions: [{ conditionId: "failure" }],
    snapshots: [{ snapshotId: "planning", boundaryType: "phase-start", lifecycleState: STATES.ACTIVE, stageId: "opening", roundNumber: 1, phase: VOYAGE_ROUND_PHASES.CREW_PLANNING, temporaryState: {} }]
  };
}

test("reports required, optional, selected, and missing stations without mutation", () => {
  const source = encounter();
  source.selections.captain = { stationId: "captain", actionId: "coordinate" };
  const before = clonePlainData(source);
  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.deepEqual(result, {
    valid: true,
    complete: false,
    requiredStationIds: ["captain", "engineer"],
    selectedStationIds: ["captain"],
    missingStationIds: ["engineer"],
    optionalStationIds: ["watch"],
    errors: [],
    warnings: []
  });
  assert.deepEqual(source, before);
});

test("is complete when every required station has an exact valid selection", () => {
  const source = encounter();
  source.selections.captain = { stationId: "captain", actionId: "coordinate" };
  source.selections.engineer = { stationId: "engineer", actionId: "stabilize" };
  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);
  assert.equal(result.valid, true);
  assert.equal(result.complete, true);
  assert.deepEqual(result.missingStationIds, []);
});

test("optional stations may be unselected or selected", () => {
  const source = encounter();
  source.selections.captain = { stationId: "captain", actionId: "coordinate" };
  source.selections.engineer = { stationId: "engineer", actionId: "stabilize" };
  assert.equal(prepareVoyageEncounterCrewPlanningCompleteness(source).complete, true);
  source.selections.watch = { stationId: "watch", actionId: "observe" };
  const selected = prepareVoyageEncounterCrewPlanningCompleteness(source);
  assert.equal(selected.complete, true);
  assert.deepEqual(selected.selectedStationIds, ["captain", "engineer", "watch"]);
});

test("propagates stored-selection validation failures before completeness inspection", () => {
  const source = encounter();
  source.selections.captain = { stationId: "captain", actionId: "unknown" };
  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);
  assert.equal(result.valid, false);
  assert.equal(result.complete, false);
  assert.equal(result.errors[0].code, "selected-action-not-available");
  assert.deepEqual(result.requiredStationIds, []);
});

test("requires Active Crew Planning", () => {
  const inactive = encounter(); inactive.lifecycleState = STATES.PAUSED;
  assert.equal(prepareVoyageEncounterCrewPlanningCompleteness(inactive).errors[0].code, "crew-planning-completeness-requires-active");
  const wrongPhase = encounter(); wrongPhase.phase = VOYAGE_ROUND_PHASES.LOCK_READINESS;
  assert.equal(prepareVoyageEncounterCrewPlanningCompleteness(wrongPhase).errors[0].code, "crew-planning-completeness-requires-crew-planning");
});

test("rejects malformed and duplicate available station definitions deterministically", () => {
  for (const [stations, code] of [
    [[null], "invalid-available-station"],
    [[{ actions: [] }], "invalid-available-station-id"],
    [[{ stationId: "captain", actions: [] }, { stationId: "captain", actions: [] }], "duplicate-available-station-id"]
  ]) {
    const source = encounter();
    source.availableStations = stations;
    const result = prepareVoyageEncounterCrewPlanningCompleteness(source);
    assert.equal(result.valid, false);
    assert.equal(result.complete, false);
    assert.equal(result.errors.at(-1).code, code);
  }
});

test("imports without Foundry globals", () => {
  assert.equal(typeof prepareVoyageEncounterCrewPlanningCompleteness, "function");
});
