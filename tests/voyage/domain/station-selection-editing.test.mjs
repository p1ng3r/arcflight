import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVoyageEncounterStationActionSelectionChange,
  applyVoyageEncounterStationActionSelectionClear,
  validateVoyageEncounterStationSelections
} from "../../../scripts/voyage/domain/station-selection.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function encounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "station-selection-editing",
    definitionId: "glassback",
    lifecycleState: STATES.ACTIVE,
    revision: 11,
    primaryShip: { actorId: "ship" },
    currentStage: { stageId: "opening" },
    currentSituation: { threatId: "debris" },
    objective: { objectiveId: "survive" },
    roundNumber: 3,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    availableStations: [
      {
        stationId: "captain",
        actions: [
          { actionId: "rally-crew" },
          { actionId: "coordinate-orders" }
        ]
      },
      {
        stationId: "engineer",
        actions: [{ actionId: "stabilize-strain" }]
      }
    ],
    selections: {
      captain: { stationId: "captain", actionId: "rally-crew" }
    },
    successConditions: [{ conditionId: "success" }],
    failureConditions: [{ conditionId: "failure" }],
    snapshots: [],
    recovery: { status: "none" },
    metadata: { nested: { retained: true } }
  };
}

function expectFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.equal(result.errors[0].code, code);
}

test("changes an existing selection atomically", () => {
  const source = encounter();
  const before = clonePlainData(source);
  const request = { stationId: "captain", actionId: "coordinate-orders", ignored: true };

  const result = applyVoyageEncounterStationActionSelectionChange(source, request);

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: "coordinate-orders"
  });
  assert.equal(result.nextState.revision, 12);
  assert.deepEqual(result.events, [{
    type: "voyage.station-action-selection-changed",
    encounterId: "station-selection-editing",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 3,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    stationId: "captain",
    previousActionId: "rally-crew",
    actionId: "coordinate-orders",
    previousRevision: 11,
    revision: 12
  }]);
  assert.equal(validateVoyageEncounterStationSelections(result.nextState).valid, true);
  assert.deepEqual(source, before);
  assert.notEqual(result.nextState, source);
  assert.notEqual(result.nextState.metadata, source.metadata);
});

test("clears an existing selection atomically", () => {
  const source = encounter();
  const before = clonePlainData(source);

  const result = applyVoyageEncounterStationActionSelectionClear(source, { stationId: "captain" });

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.selections, {});
  assert.equal(result.nextState.revision, 12);
  assert.deepEqual(result.events, [{
    type: "voyage.station-action-selection-cleared",
    encounterId: "station-selection-editing",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 3,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    stationId: "captain",
    actionId: "rally-crew",
    previousRevision: 11,
    revision: 12
  }]);
  assert.equal(validateVoyageEncounterStationSelections(result.nextState).valid, true);
  assert.deepEqual(source, before);
});

test("rejects missing, unchanged, unavailable, and malformed edits", () => {
  expectFailure(
    applyVoyageEncounterStationActionSelectionChange(encounter(), { stationId: "engineer", actionId: "stabilize-strain" }),
    "station-selection-does-not-exist"
  );
  expectFailure(
    applyVoyageEncounterStationActionSelectionChange(encounter(), { stationId: "captain", actionId: "rally-crew" }),
    "station-selection-unchanged"
  );
  expectFailure(
    applyVoyageEncounterStationActionSelectionChange(encounter(), { stationId: "captain", actionId: "missing" }),
    "station-action-not-available"
  );
  expectFailure(
    applyVoyageEncounterStationActionSelectionClear(encounter(), null),
    "invalid-station-selection-request"
  );
  expectFailure(
    applyVoyageEncounterStationActionSelectionClear(encounter(), { stationId: "engineer" }),
    "station-selection-does-not-exist"
  );
});

test("requires Active Crew Planning and safe exact station keys", () => {
  const inactive = encounter();
  inactive.lifecycleState = STATES.PAUSED;
  expectFailure(
    applyVoyageEncounterStationActionSelectionChange(inactive, { stationId: "captain", actionId: "coordinate-orders" }),
    "station-selection-requires-active"
  );

  const wrongPhase = encounter();
  wrongPhase.phase = VOYAGE_ROUND_PHASES.SITUATION;
  expectFailure(
    applyVoyageEncounterStationActionSelectionClear(wrongPhase, { stationId: "captain" }),
    "station-selection-requires-crew-planning"
  );

  expectFailure(
    applyVoyageEncounterStationActionSelectionClear(encounter(), { stationId: "__proto__" }),
    "unsafe-station-selection-key"
  );
});

test("clone failures remain atomic", () => {
  const source = encounter();
  const metadata = source.metadata;
  let reads = 0;
  Object.defineProperty(source, "metadata", {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      if (reads >= 4) throw new Error("clone failure");
      return metadata;
    }
  });

  const result = applyVoyageEncounterStationActionSelectionClear(source, { stationId: "captain" });
  expectFailure(result, "station-selection-clear-candidate-construction-failed");
  assert.equal(source.revision, 11);
  assert.equal(source.selections.captain.actionId, "rally-crew");
});

test("editing helpers import without Foundry globals", () => {
  assert.equal(typeof applyVoyageEncounterStationActionSelectionChange, "function");
  assert.equal(typeof applyVoyageEncounterStationActionSelectionClear, "function");
});
