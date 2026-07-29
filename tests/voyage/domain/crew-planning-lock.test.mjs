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
    selections: { captain: { stationId: "captain", actionId: "rally", approachId: "diplomacy", statisticSlugOrAbilityId: "diplomacy" }, navigator: { stationId: "navigator", actionId: "course", approachId: "survival", statisticSlugOrAbilityId: "survival" } }, proposedStationOrder: ["navigator", "captain"], targets: { retained: true }, riskBids: { captain: { stationId: "captain", actionId: "rally", riskBidId: "close" } }, assistance: [{ retained: true }], reservations: [{ retained: true }],
    successConditions: [{ conditionId: "success" }], failureConditions: [{ conditionId: "failure" }], snapshots: [], recovery: {}, metadata: { retained: true } };
}
function failure(result) { assert.equal(result.ok, false); assert.equal(result.nextState, null); assert.deepEqual(result.events, []); }

test("locks a complete plan atomically and creates the established phase-start snapshot", () => {
  const source = encounter(); const before = clonePlainData(source); const request = { phaseStartSnapshotId: "lock-readiness-start" }; const result = applyVoyageEncounterCrewPlanningLock(source, request);
  assert.equal(result.ok, true); assert.equal(result.nextState.phase, VOYAGE_ROUND_PHASES.LOCK_READINESS); assert.equal(result.nextState.revision, 5); assert.deepEqual(result.nextState.selections, before.selections); assert.deepEqual(result.nextState.targets, before.targets); assert.deepEqual(result.nextState.riskBids, before.riskBids); assert.deepEqual(result.nextState.assistance, before.assistance); assert.deepEqual(result.nextState.reservations, before.reservations); assert.equal(result.nextState.snapshots.length, 1);
  assert.deepEqual(result.nextState.stationAssignments, before.stationAssignments); assert.notEqual(result.nextState.stationAssignments[0].operator, source.stationAssignments[0].operator);
  assert.deepEqual(result.nextState.proposedStationOrder, []); assert.deepEqual(result.nextState.committedStationOrder, ["navigator", "captain"]);
  assert.equal(result.nextState.snapshots[0].phase, VOYAGE_ROUND_PHASES.LOCK_READINESS); assert.deepEqual(result.nextState.snapshots[0].temporaryState.selections, before.selections);
  assert.deepEqual(result.nextState.snapshots[0].temporaryState.stationAssignments, before.stationAssignments); assert.notEqual(result.nextState.snapshots[0].temporaryState.stationAssignments[0].operator, result.nextState.stationAssignments[0].operator);
  assert.deepEqual(result.nextState.snapshots[0].temporaryState.proposedStationOrder, []);
  assert.deepEqual(result.nextState.snapshots[0].temporaryState.committedStationOrder, ["navigator", "captain"]);
  assert.deepEqual(result.events, [{ type: "voyage.crew-planning-locked", encounterId: "lock", lifecycleState: STATES.ACTIVE, roundNumber: 1, previousPhase: VOYAGE_ROUND_PHASES.CREW_PLANNING, phase: VOYAGE_ROUND_PHASES.LOCK_READINESS, committedStationOrder: ["navigator", "captain"], previousRevision: 4, revision: 5, phaseStartSnapshotId: "lock-readiness-start" }]);
  assert.equal(Object.hasOwn(result.events[0], "proposedStationOrder"), false);
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
  assert.deepEqual(result.nextState.proposedStationOrder, []);
  assert.deepEqual(result.nextState.committedStationOrder, ["navigator", "captain"]);
  assert.deepEqual(source, before);
});

test("locks a one-station proposal without generating or sorting order", () => {
  const source = encounter();
  source.stationAssignments = [source.stationAssignments[0]];
  source.selections = { captain: source.selections.captain };
  source.riskBids = { captain: source.riskBids.captain };
  source.proposedStationOrder = ["captain"];
  const before = clonePlainData(source);

  const result = applyVoyageEncounterCrewPlanningLock(source, {
    phaseStartSnapshotId: "one-station"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.proposedStationOrder, []);
  assert.deepEqual(result.nextState.committedStationOrder, ["captain"]);
  assert.deepEqual(result.events[0].committedStationOrder, ["captain"]);
  assert.deepEqual(result.nextState.snapshots[0].temporaryState.committedStationOrder, ["captain"]);
  assert.deepEqual(source, before);
});

test("committed order arrays are isolated across source, state, event, and snapshot", () => {
  const source = encounter();
  const sourceProposal = source.proposedStationOrder;
  const sourceCommitment = source.committedStationOrder;
  const result = applyVoyageEncounterCrewPlanningLock(source, {
    phaseStartSnapshotId: "isolated-order"
  });
  const nextOrder = result.nextState.committedStationOrder;
  const eventOrder = result.events[0].committedStationOrder;
  const snapshotOrder = result.nextState.snapshots[0].temporaryState.committedStationOrder;
  const snapshotProposal = result.nextState.snapshots[0].temporaryState.proposedStationOrder;

  for (const pair of [
    [sourceProposal, nextOrder],
    [sourceCommitment, nextOrder],
    [nextOrder, eventOrder],
    [nextOrder, snapshotOrder],
    [eventOrder, snapshotOrder],
    [result.nextState.proposedStationOrder, snapshotProposal]
  ]) assert.notEqual(...pair);

  eventOrder[0] = "event-only";
  assert.deepEqual(nextOrder, ["navigator", "captain"]);
  assert.deepEqual(snapshotOrder, ["navigator", "captain"]);
  nextOrder[1] = "state-only";
  assert.deepEqual(snapshotOrder, ["navigator", "captain"]);
  snapshotOrder[0] = "snapshot-only";
  assert.deepEqual(sourceProposal, ["navigator", "captain"]);
  assert.deepEqual(sourceCommitment, []);
  assert.deepEqual(eventOrder, ["event-only", "captain"]);
});

test("successful lock preserves planning data and existing snapshots", () => {
  const source = encounter();
  const earlier = createVoyageEncounterBoundarySnapshot(source, {
    snapshotId: "earlier",
    boundaryType: "phase-start"
  }).snapshot;
  source.snapshots.push(earlier);
  const before = clonePlainData(source);

  const result = applyVoyageEncounterCrewPlanningLock(source, {
    phaseStartSnapshotId: "new-lock"
  });

  assert.equal(result.ok, true);
  assert.equal(result.events.length, 1);
  assert.equal(result.nextState.snapshots.length, 2);
  assert.deepEqual(result.nextState.snapshots[0], before.snapshots[0]);
  assert.notEqual(result.nextState.snapshots[0], source.snapshots[0]);
  for (const field of [
    "stationAssignments",
    "selections",
    "riskBids",
    "targets",
    "availableStations",
    "currentStage",
    "roundNumber",
    "pendingChecks",
    "pendingConsequences",
    "recovery",
    "metadata"
  ]) assert.deepEqual(result.nextState[field], before[field], field);
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

test("station-order readiness failures block locking atomically", () => {
  const cases = [
    [(state) => { state.proposedStationOrder = []; }, "missing-proposal", []],
    [(state) => { state.proposedStationOrder = ["captain"]; }, "partial-proposal", ["missing-occupied-station-order-station-id"]],
    [(state) => { state.proposedStationOrder = ["captain", "captain"]; }, "malformed-proposal", [
      "duplicate-station-order-station-id",
      "missing-occupied-station-order-station-id"
    ]],
    [(state) => { state.proposedStationOrder = "navigator,captain"; }, "non-array-proposal", [
      "invalid-collection-type"
    ]],
    [(state) => { state.committedStationOrder = ["navigator", "captain"]; }, "premature-commitment", [
      "crew-planning-committed-station-order-already-present"
    ]]
  ];

  for (const [alter, snapshotId, expectedCodes] of cases) {
    const source = encounter();
    alter(source);
    const before = clonePlainData(source);
    const result = applyVoyageEncounterCrewPlanningLock(source, { phaseStartSnapshotId: snapshotId });

    failure(result);
    assert.deepEqual(result.errors.map(({ code }) => code), expectedCodes);
    assert.deepEqual(source, before);
    assert.equal(source.revision, 4);
    assert.equal(source.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING);
    assert.deepEqual(source.snapshots, before.snapshots);
    assert.deepEqual(source.proposedStationOrder, before.proposedStationOrder);
    assert.deepEqual(source.committedStationOrder, before.committedStationOrder);
  }
});

test("zero occupied stations lock with the canonical empty proposal and commitment", () => {
  const source = encounter();
  source.stationAssignments = [];
  source.selections = {};
  source.riskBids = {};
  source.proposedStationOrder = [];
  const before = clonePlainData(source);

  const result = applyVoyageEncounterCrewPlanningLock(source, {
    phaseStartSnapshotId: "zero-occupancy"
  });

  assert.equal(result.ok, true);
  assert.equal(result.nextState.phase, VOYAGE_ROUND_PHASES.LOCK_READINESS);
  assert.deepEqual(result.nextState.proposedStationOrder, []);
  assert.deepEqual(result.nextState.committedStationOrder, []);
  assert.deepEqual(result.events[0].committedStationOrder, []);
  assert.deepEqual(result.nextState.snapshots[0].temporaryState.proposedStationOrder, []);
  assert.deepEqual(result.nextState.snapshots[0].temporaryState.committedStationOrder, []);
  assert.deepEqual(source, before);
});

test("clone and snapshot-construction failures leave no partial commitment", () => {
  const cloneSource = encounter();
  Object.defineProperty(cloneSource, "hostileExtension", {
    enumerable: true,
    get() { throw new Error("clone failed"); }
  });
  const cloneResult = applyVoyageEncounterCrewPlanningLock(cloneSource, {
    phaseStartSnapshotId: "clone-failure"
  });
  failure(cloneResult);
  assert.equal(cloneResult.errors[0].code, "crew-planning-lock-candidate-construction-failed");
  assert.equal(cloneSource.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING);
  assert.equal(cloneSource.revision, 4);
  assert.deepEqual(cloneSource.proposedStationOrder, ["navigator", "captain"]);
  assert.deepEqual(cloneSource.committedStationOrder, []);
  assert.deepEqual(cloneSource.snapshots, []);

  const snapshotSource = encounter();
  let snapshotIdReads = 0;
  const snapshotRequest = {};
  Object.defineProperty(snapshotRequest, "phaseStartSnapshotId", {
    enumerable: true,
    get() {
      snapshotIdReads += 1;
      if (snapshotIdReads > 2) throw new Error("snapshot failed");
      return "snapshot-failure";
    }
  });
  const snapshotBefore = clonePlainData(snapshotSource);
  const snapshotResult = applyVoyageEncounterCrewPlanningLock(
    snapshotSource,
    snapshotRequest
  );
  failure(snapshotResult);
  assert.equal(
    snapshotResult.errors[0].code,
    "crew-planning-lock-phase-start-snapshot-construction-failed"
  );
  assert.deepEqual(snapshotSource, snapshotBefore);
});

test("hostile first-read lock data returns an atomic structured failure", () => {
  const source = encounter();
  const request = {};
  Object.defineProperty(request, "phaseStartSnapshotId", {
    enumerable: true,
    get() { throw new Error("unreadable request"); }
  });
  const before = clonePlainData(source);

  const result = applyVoyageEncounterCrewPlanningLock(source, request);

  failure(result);
  assert.deepEqual(result.errors, [{
    code: "crew-planning-lock-data-read-failed",
    path: "$",
    message: "Crew Planning lock data could not be read safely.",
    severity: "error"
  }]);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(source, before);
});

test("candidate station-order validation failures remain atomic and precisely pathed", () => {
  const source = encounter();
  const underlyingProposal = ["navigator", "captain"];
  source.proposedStationOrder = new Proxy(underlyingProposal, {
    get(target, property, receiver) {
      if (property === "1") return "navigator";
      return Reflect.get(target, property, receiver);
    }
  });

  const result = applyVoyageEncounterCrewPlanningLock(source, {
    phaseStartSnapshotId: "candidate-order-failure"
  });

  failure(result);
  assert.deepEqual(result.errors.map(({ code, path }) => ({ code, path })), [
    {
      code: "duplicate-station-order-station-id",
      path: "committedStationOrder[1]"
    },
    {
      code: "missing-occupied-station-order-station-id",
      path: "committedStationOrder"
    }
  ]);
  assert.equal(source.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING);
  assert.equal(source.revision, 4);
  assert.deepEqual(underlyingProposal, ["navigator", "captain"]);
  assert.deepEqual(source.committedStationOrder, []);
  assert.deepEqual(source.snapshots, []);
});

test("candidate structural validation failures remain atomic", () => {
  const source = encounter();
  const validTrack = {
    trackId: "pressure",
    visibility: "exact",
    limitBehavior: "clamp",
    thresholds: []
  };
  let consecutiveLengthReads = 0;
  let cloning = false;
  source.tracks = new Proxy([validTrack], {
    get(target, property, receiver) {
      if (property === "length") {
        consecutiveLengthReads += 1;
        if (consecutiveLengthReads >= 2) cloning = true;
        return Reflect.get(target, property, receiver);
      }
      if (property === "0") {
        const value = cloning ? {} : Reflect.get(target, property, receiver);
        consecutiveLengthReads = 0;
        cloning = false;
        return value;
      }
      return Reflect.get(target, property, receiver);
    }
  });

  const result = applyVoyageEncounterCrewPlanningLock(source, {
    phaseStartSnapshotId: "candidate-structural-failure"
  });

  failure(result);
  assert.deepEqual(result.errors.map(({ code, path }) => ({ code, path })), [
    { code: "invalid-track-visibility", path: "tracks[0].visibility" },
    { code: "invalid-track-limit-behavior", path: "tracks[0].limitBehavior" }
  ]);
  assert.equal(source.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING);
  assert.equal(source.revision, 4);
  assert.deepEqual(source.committedStationOrder, []);
  assert.deepEqual(source.snapshots, []);
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

test("the lock module imports without Foundry globals", async () => {
  const previous = Object.fromEntries(
    ["foundry", "CONFIG", "game"].map((key) => [
      key,
      { exists: Object.hasOwn(globalThis, key), value: globalThis[key] }
    ])
  );
  try {
    delete globalThis.foundry;
    delete globalThis.CONFIG;
    delete globalThis.game;
    const module = await import(
      `../../../scripts/voyage/domain/crew-planning-lock.js?foundry-free=${Date.now()}`
    );
    assert.equal(typeof module.applyVoyageEncounterCrewPlanningLock, "function");
  } finally {
    for (const [key, entry] of Object.entries(previous)) {
      if (entry.exists) globalThis[key] = entry.value;
      else delete globalThis[key];
    }
  }
});
