import assert from "node:assert/strict";
import test from "node:test";
import { applyVoyageEncounterCrewPlanningTransition } from "../../../scripts/voyage/domain/crew-planning-transition.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";

function activeSituationEncounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "crew-planning", definitionId: "glassback", lifecycleState: STATES.ACTIVE, revision: 4,
    primaryShip: { actorId: "ship", nested: { hull: "glassback" } }, currentStage: { stageId: "opening", details: { tags: ["alpha"] } },
    currentSituation: { details: { threat: "debris" } }, objective: { id: "survive" }, roundNumber: 2, phase: VOYAGE_ROUND_PHASES.SITUATION,
    participants: [{ participantId: "captain", details: { userId: "user" } }], availableStations: [{ stationId: "captain", actions: [{ actionId: "command" }] }],
    stationAssignments: [{ stationId: "captain", operator: { kind: "actor", id: "captain", uuid: "Actor.captain", name: "Captain" } }],
    successConditions: [{ conditionId: "success" }], failureConditions: [{ conditionId: "failure" }], playerVisibleInformation: { clues: ["wake"] }, gmSecretInformation: { threat: { id: "hidden" } },
    tracks: [{ trackId: "pressure", visibility: "exact", limitBehavior: "clamp", thresholds: [] }], metadata: { nested: { retained: true } },
    snapshots: [{ snapshotId: "existing", boundaryType: "phase-start", lifecycleState: STATES.ACTIVE, stageId: "previous", roundNumber: 1, phase: "situation", temporaryState: {} }],
    pendingThresholdQueue: [{ thresholdId: "queue" }], pendingConsequences: [{ consequenceId: "pending" }], temporaryConsequences: [{ consequenceId: "temporary" }], recovery: { status: "none" }
  };
}

function assertFailure(result) {
  assert.equal(result.ok, false); assert.equal(result.nextState, null); assert.deepEqual(result.events, []);
}

function assertInputsUnchanged(encounter, encounterBefore, request, requestBefore) {
  assert.deepEqual(encounter, encounterBefore);
  assert.deepEqual(request, requestBefore);
}

test("atomically enters Crew Planning with one appended phase-start snapshot and event", () => {
  const encounter = activeSituationEncounter();
  const request = { phaseStartSnapshotId: "  planning-start  ", ignored: { value: true } };
  const before = clonePlainData(encounter); const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterCrewPlanningTransition(encounter, request);
  assert.equal(result.ok, true); assert.deepEqual(result.errors, []); assert.ok(Array.isArray(result.warnings)); assert.equal(result.events.length, 1);
  assert.equal(result.nextState.lifecycleState, STATES.ACTIVE); assert.equal(result.nextState.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING); assert.equal(result.nextState.roundNumber, 2); assert.equal(result.nextState.revision, 5);
  assert.deepEqual(result.nextState.proposedStationOrder, []);
  assert.deepEqual(result.nextState.committedStationOrder, []);
  assert.deepEqual(result.nextState.stationAssignments, before.stationAssignments); assert.notEqual(result.nextState.stationAssignments, encounter.stationAssignments); assert.notEqual(result.nextState.stationAssignments[0].operator, encounter.stationAssignments[0].operator);
  assert.deepEqual(result.nextState.snapshots.slice(0, -1), before.snapshots);
  const snapshot = result.nextState.snapshots.at(-1);
  assert.equal(snapshot.snapshotId, "  planning-start  "); assert.equal(snapshot.boundaryType, "phase-start"); assert.equal(snapshot.lifecycleState, STATES.ACTIVE); assert.equal(snapshot.roundNumber, 2); assert.equal(snapshot.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING); assert.equal(snapshot.temporaryState.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING); assert.equal(snapshot.temporaryState.roundNumber, 2);
  assert.deepEqual(snapshot.temporaryState.proposedStationOrder, []);
  assert.deepEqual(snapshot.temporaryState.committedStationOrder, []);
  assert.notEqual(snapshot.temporaryState.proposedStationOrder, result.nextState.proposedStationOrder);
  assert.notEqual(snapshot.temporaryState.committedStationOrder, result.nextState.committedStationOrder);
  assert.deepEqual(snapshot.temporaryState.stationAssignments, before.stationAssignments); assert.notEqual(snapshot.temporaryState.stationAssignments[0].operator, result.nextState.stationAssignments[0].operator);
  assert.deepEqual(result.events[0], { type: "voyage.phase-transitioned", encounterId: "crew-planning", lifecycleState: STATES.ACTIVE, roundNumber: 2, fromPhase: VOYAGE_ROUND_PHASES.SITUATION, toPhase: VOYAGE_ROUND_PHASES.CREW_PLANNING, previousRevision: 4, revision: 5, phaseStartSnapshotId: "  planning-start  " });
  assert.deepEqual(encounter, before); assert.deepEqual(request, requestBefore); assert.equal(validateVoyageEncounterState(result.nextState).valid, true);
  assert.notEqual(result.nextState.currentStage, encounter.currentStage); assert.notEqual(result.nextState.currentSituation, encounter.currentSituation); assert.notEqual(result.nextState.participants, encounter.participants); assert.notEqual(result.nextState.availableStations, encounter.availableStations); assert.notEqual(result.nextState.playerVisibleInformation, encounter.playerVisibleInformation); assert.notEqual(result.nextState.gmSecretInformation, encounter.gmSecretInformation); assert.notEqual(result.nextState.tracks, encounter.tracks); assert.notEqual(result.nextState.metadata, encounter.metadata);
  for (const field of ["currentStage", "currentSituation", "participants", "tracks"]) {
    assert.notEqual(snapshot.temporaryState[field], result.nextState[field]);
    assert.notEqual(snapshot.temporaryState[field], encounter[field]);
    assert.notEqual(result.nextState[field], encounter[field]);
  }
  snapshot.temporaryState.currentStage.details.tags.push("snapshot-only"); snapshot.temporaryState.currentSituation.details.threat = "snapshot"; snapshot.temporaryState.participants[0].details.userId = "snapshot"; snapshot.temporaryState.tracks[0].trackId = "snapshot";
  assert.equal(result.nextState.currentStage.details.tags.includes("snapshot-only"), false); assert.equal(encounter.currentSituation.details.threat, "debris"); assert.equal(result.nextState.participants[0].details.userId, "user"); assert.equal(encounter.tracks[0].trackId, "pressure");
  result.nextState.currentStage.details.tags.push("next-only"); result.nextState.currentSituation.details.threat = "next"; result.nextState.participants[0].details.userId = "next"; result.nextState.tracks[0].trackId = "next";
  assert.equal(snapshot.temporaryState.currentStage.details.tags.includes("next-only"), false); assert.equal(encounter.currentSituation.details.threat, "debris"); assert.equal(snapshot.temporaryState.participants[0].details.userId, "snapshot"); assert.equal(encounter.tracks[0].trackId, "pressure");
  encounter.currentStage.details.tags.push("source-only"); encounter.currentSituation.details.threat = "source"; encounter.participants[0].details.userId = "source"; encounter.tracks[0].trackId = "source";
  assert.equal(result.nextState.currentStage.details.tags.includes("source-only"), false); assert.equal(result.nextState.currentSituation.details.threat, "next"); assert.equal(result.nextState.participants[0].details.userId, "next"); assert.equal(result.nextState.tracks[0].trackId, "next");
  assert.deepEqual(result.nextState.pendingThresholdQueue, before.pendingThresholdQueue); assert.deepEqual(result.nextState.pendingConsequences, before.pendingConsequences); assert.deepEqual(result.nextState.temporaryConsequences, before.temporaryConsequences);
});

test("clears a complete previous-round commitment without mutating or aliasing the source", () => {
  const encounter = activeSituationEncounter();
  encounter.committedStationOrder = ["captain"];
  const request = { phaseStartSnapshotId: "next-round-planning" };
  const before = clonePlainData(encounter);

  const result = applyVoyageEncounterCrewPlanningTransition(encounter, request);

  assert.equal(result.ok, true);
  assert.equal(result.nextState.revision, before.revision + 1);
  assert.equal(result.events.length, 1);
  assert.equal(result.nextState.snapshots.length, before.snapshots.length + 1);
  assert.deepEqual(result.nextState.proposedStationOrder, []);
  assert.deepEqual(result.nextState.committedStationOrder, []);
  const snapshot = result.nextState.snapshots.at(-1);
  assert.deepEqual(snapshot.temporaryState.proposedStationOrder, []);
  assert.deepEqual(snapshot.temporaryState.committedStationOrder, []);
  assert.notEqual(snapshot.temporaryState.proposedStationOrder, result.nextState.proposedStationOrder);
  assert.notEqual(snapshot.temporaryState.committedStationOrder, result.nextState.committedStationOrder);
  assert.deepEqual(encounter.proposedStationOrder, []);
  assert.deepEqual(encounter.committedStationOrder, ["captain"]);
  result.nextState.committedStationOrder.push("next-only");
  assert.deepEqual(snapshot.temporaryState.committedStationOrder, []);
  assert.deepEqual(encounter.committedStationOrder, ["captain"]);
});

test("rejects stale, malformed, incomplete, and unreadable source order state atomically", () => {
  const stale = activeSituationEncounter();
  stale.proposedStationOrder = ["captain"];
  let result = applyVoyageEncounterCrewPlanningTransition(stale, {
    phaseStartSnapshotId: "stale-proposal"
  });
  assertFailure(result);
  assert.ok(result.errors.some(
    (entry) => entry.code === "crew-planning-transition-requires-empty-proposed-station-order"
      && entry.path === "proposedStationOrder"
  ));

  const malformedProposal = activeSituationEncounter();
  malformedProposal.proposedStationOrder = {};
  result = applyVoyageEncounterCrewPlanningTransition(malformedProposal, {
    phaseStartSnapshotId: "malformed-proposal"
  });
  assertFailure(result);
  assert.ok(result.errors.some(
    (entry) => entry.code === "invalid-collection-type"
      && entry.path === "proposedStationOrder"
  ));

  const malformedCommitment = activeSituationEncounter();
  malformedCommitment.committedStationOrder = {};
  result = applyVoyageEncounterCrewPlanningTransition(malformedCommitment, {
    phaseStartSnapshotId: "malformed-commitment"
  });
  assertFailure(result);
  assert.ok(result.errors.some(
    (entry) => entry.code === "invalid-collection-type"
      && entry.path === "committedStationOrder"
  ));

  const incomplete = activeSituationEncounter();
  incomplete.availableStations.push({
    stationId: "engineer",
    actions: [{ actionId: "repair" }]
  });
  incomplete.stationAssignments.push({
    stationId: "engineer",
    operator: { kind: "actor", uuid: "Actor.engineer", name: "Engineer" }
  });
  incomplete.committedStationOrder = ["captain"];
  const incompleteBefore = clonePlainData(incomplete);
  result = applyVoyageEncounterCrewPlanningTransition(incomplete, {
    phaseStartSnapshotId: "incomplete-commitment"
  });
  assertFailure(result);
  assert.ok(result.errors.some(
    (entry) => entry.code === "missing-occupied-station-order-station-id"
      && entry.path === "committedStationOrder"
  ));
  assert.deepEqual(incomplete, incompleteBefore);

  const unreadable = activeSituationEncounter();
  Object.defineProperty(unreadable, "committedStationOrder", {
    enumerable: true,
    get() {
      return [];
    }
  });
  result = applyVoyageEncounterCrewPlanningTransition(unreadable, {
    phaseStartSnapshotId: "unreadable-commitment"
  });
  assertFailure(result);
  assert.ok(result.errors.some(
    (entry) => entry.code === "invalid-collection-type"
      && entry.path === "committedStationOrder"
  ));
});

test("propagates structural, lifecycle, and phase-policy failures before request inspection", () => {
  const malformed = { ...activeSituationEncounter(), schemaVersion: 99 };
  const validation = validateVoyageEncounterState(malformed);
  const malformedResult = applyVoyageEncounterCrewPlanningTransition(malformed, null);
  assertFailure(malformedResult); assert.deepEqual(malformedResult.errors, validation.errors);
  for (const [lifecycle, phase, code] of [[STATES.READY, "inactive", "crew-planning-transition-requires-active"], [STATES.PAUSED, VOYAGE_ROUND_PHASES.SITUATION, "crew-planning-transition-requires-active"], [STATES.ACTIVE, VOYAGE_ROUND_PHASES.CREW_PLANNING, "same-voyage-phase"], [STATES.ACTIVE, VOYAGE_ROUND_PHASES.LOCK_READINESS, "illegal-voyage-phase-transition"], [STATES.ACTIVE, VOYAGE_ROUND_PHASES.RESOLUTION, "illegal-voyage-phase-transition"]]) {
    const encounter = activeSituationEncounter(); encounter.lifecycleState = lifecycle; encounter.phase = phase;
    if (lifecycle === STATES.READY) { encounter.roundNumber = "inactive"; }
    const result = applyVoyageEncounterCrewPlanningTransition(encounter, null); assertFailure(result); assert.equal(result.errors[0].code, code);
  }
});

test("collects request, collision, and stale planning errors in contract order", () => {
  const invalidRequest = applyVoyageEncounterCrewPlanningTransition(activeSituationEncounter(), null); assertFailure(invalidRequest); assert.deepEqual(invalidRequest.errors.map((entry) => entry.code), ["invalid-crew-planning-transition-request"]);
  const missing = applyVoyageEncounterCrewPlanningTransition(activeSituationEncounter(), {}); assert.deepEqual(missing.errors.map((entry) => entry.code), ["invalid-phase-start-snapshot-id"]);
  const encounter = activeSituationEncounter(); encounter.selections.a = {}; encounter.targets.a = {}; encounter.riskBids.a = {}; encounter.assistance.push({}); encounter.reservations.push({}); encounter.pendingChecks.push({});
  const result = applyVoyageEncounterCrewPlanningTransition(encounter, { phaseStartSnapshotId: "existing" }); assertFailure(result);
  assert.deepEqual(result.errors.map((entry) => entry.code), ["phase-start-snapshot-id-already-exists", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty"]);
  assert.deepEqual(result.errors.map((entry) => entry.path), ["transitionRequest.phaseStartSnapshotId", "selections", "targets", "riskBids", "assistance", "reservations", "pendingChecks"]);
  const caseSensitive = applyVoyageEncounterCrewPlanningTransition(activeSituationEncounter(), { phaseStartSnapshotId: "EXISTING" }); assert.equal(caseSensitive.ok, true);
});

test("collects non-object request and stale planning errors without an ID error", () => {
  const encounter = activeSituationEncounter(); const request = null;
  encounter.selections.captain = {}; encounter.targets.captain = {}; encounter.riskBids.captain = {}; encounter.assistance.push({}); encounter.reservations.push({}); encounter.pendingChecks.push({});
  const before = clonePlainData(encounter); const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterCrewPlanningTransition(encounter, request);
  assertFailure(result);
  assert.deepEqual(result.errors.map((entry) => entry.code), ["invalid-crew-planning-transition-request", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty", "crew-planning-input-not-empty"]);
  assert.equal(result.errors.some((entry) => entry.code === "invalid-phase-start-snapshot-id"), false);
  assertInputsUnchanged(encounter, before, request, requestBefore);
});

test("rejects missing and blank phase-start snapshot IDs without mutation", () => {
  for (const request of [{}, { phaseStartSnapshotId: "   " }]) {
    const encounter = activeSituationEncounter(); const before = clonePlainData(encounter); const requestBefore = clonePlainData(request);
    const result = applyVoyageEncounterCrewPlanningTransition(encounter, request);
    assertFailure(result); assert.deepEqual(result.errors.map((entry) => entry.code), ["invalid-phase-start-snapshot-id"]);
    assertInputsUnchanged(encounter, before, request, requestBefore);
  }
});

test("rejects an exact snapshot collision without replacing or appending source snapshots", () => {
  const encounter = activeSituationEncounter(); const request = { phaseStartSnapshotId: "existing" };
  const before = clonePlainData(encounter); const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterCrewPlanningTransition(encounter, request);
  assertFailure(result); assert.equal(result.errors[0].code, "phase-start-snapshot-id-already-exists");
  assert.deepEqual(encounter.snapshots, before.snapshots); assert.equal(encounter.snapshots.length, 1); assert.equal(encounter.snapshots[0].snapshotId, "existing");
  assertInputsUnchanged(encounter, before, request, requestBefore);
});

test("returns an atomic clone failure for an adversarial enumerable plain-data getter", () => {
  const encounter = activeSituationEncounter(); const request = { phaseStartSnapshotId: "clone-failure" }; const requestBefore = clonePlainData(request);
  const metadata = encounter.metadata; let reads = 0;
  Object.defineProperty(encounter, "metadata", { enumerable: true, configurable: true, get() { reads += 1; if (reads >= 3) throw new Error("clone failure"); return metadata; } });
  const sourceSnapshotIds = encounter.snapshots.map((snapshot) => snapshot.snapshotId);
  const result = applyVoyageEncounterCrewPlanningTransition(encounter, request);
  assertFailure(result); assert.equal(result.errors[0].code, "crew-planning-candidate-construction-failed"); assert.equal(encounter.lifecycleState, STATES.ACTIVE); assert.equal(encounter.phase, VOYAGE_ROUND_PHASES.SITUATION); assert.equal(encounter.revision, 4); assert.deepEqual(encounter.snapshots.map((snapshot) => snapshot.snapshotId), sourceSnapshotIds); assert.deepEqual(request, requestBefore);
});

test("propagates a snapshot helper returned failure atomically", () => {
  const encounter = activeSituationEncounter(); const request = { phaseStartSnapshotId: "snapshot-returned-failure" };
  encounter.currentStage = {};
  const before = clonePlainData(encounter); const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterCrewPlanningTransition(encounter, request);
  assertFailure(result); assert.deepEqual(result.errors, [{ code: "invalid-snapshot-stage-id", path: "currentStage.stageId", message: "Boundary snapshot construction requires a non-empty current stageId.", severity: "error" }]);
  assertInputsUnchanged(encounter, before, request, requestBefore); assert.equal(encounter.snapshots.length, before.snapshots.length);
});

test("returns an atomic snapshot construction exception after candidate cloning", () => {
  const encounter = activeSituationEncounter(); const request = { phaseStartSnapshotId: "snapshot-throw" }; const requestBefore = clonePlainData(request);
  let metadataReads = 0; let prototypeReads = 0;
  const deferredFailure = new Proxy({}, { getPrototypeOf() { prototypeReads += 1; if (prototypeReads > 1) throw new Error("snapshot failure"); return Date.prototype; } });
  encounter.currentSituation = deferredFailure;
  const metadata = encounter.metadata;
  Object.defineProperty(encounter, "metadata", { enumerable: true, configurable: true, get() { metadataReads += 1; return metadata; } });
  const sourceSnapshotIds = encounter.snapshots.map((snapshot) => snapshot.snapshotId);
  const result = applyVoyageEncounterCrewPlanningTransition(encounter, request);
  assertFailure(result); assert.equal(result.errors[0].code, "crew-planning-phase-start-snapshot-construction-failed"); assert.equal(encounter.lifecycleState, STATES.ACTIVE); assert.equal(encounter.phase, VOYAGE_ROUND_PHASES.SITUATION); assert.equal(encounter.revision, 4); assert.deepEqual(encounter.snapshots.map((snapshot) => snapshot.snapshotId), sourceSnapshotIds); assert.deepEqual(request, requestBefore);
});

test("the Crew Planning domain module imports without Foundry globals", () => {
  assert.equal(typeof applyVoyageEncounterCrewPlanningTransition, "function");
});

test("Arcflight registers the Crew Planning transition and matching devTools alias", async () => {
  const previous = Object.fromEntries(["foundry", "Hooks", "CONFIG", "game"].map((key) => [key, { exists: Object.hasOwn(globalThis, key), value: globalThis[key] }]));
  let initCallback;
  class TestActorSheetV2 {}
  try {
    globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (Base) => Base }, sheets: { ActorSheetV2: TestActorSheetV2 }, apps: {} }, documents: {}, utils: {} };
    globalThis.Hooks = { once: (_event, callback) => { initCallback = callback; } };
    globalThis.CONFIG = {}; globalThis.game = {};
    const arcflight = await import(`../../../scripts/arcflight.js?crew-planning-transition=${Date.now()}`);
    initCallback();
    assert.equal(typeof arcflight.applyVoyageEncounterCrewPlanningTransition, "function");
    assert.equal(typeof globalThis.game.arcflight.applyVoyageEncounterCrewPlanningTransition, "function");
    assert.equal(typeof globalThis.game.arcflight.devTools.applyVoyageEncounterCrewPlanningTransition, "function");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value.exists) globalThis[key] = value.value;
      else delete globalThis[key];
    }
  }
});
