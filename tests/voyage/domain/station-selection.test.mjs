import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVoyageEncounterStationActionSelection,
  validateVoyageEncounterStationSelections
} from "../../../scripts/voyage/domain/station-selection.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";

function encounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "station-selection", definitionId: "glassback", lifecycleState: STATES.ACTIVE, revision: 7,
    primaryShip: { actorId: "ship", details: { hull: "glassback" } }, currentStage: { stageId: "opening", details: { tags: ["alpha"] } },
    currentSituation: { threat: { id: "debris" } }, objective: { id: "survive" }, roundNumber: 2, phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    participants: [{ participantId: "captain", details: { userId: "user" } }],
    availableStations: [
      { stationId: "captain", actions: [{ actionId: "rally-crew", authored: { skill: "diplomacy" } }, { actionId: "coordinate-orders" }], authored: { title: "Captain" } },
      { stationId: "engineer", actions: [{ actionId: "stabilize-strain" }, { actionId: "hard-burn-prep" }], authored: { title: "Engineer" } }
    ],
    successConditions: [{ conditionId: "success" }], failureConditions: [{ conditionId: "failure" }],
    snapshots: [{ snapshotId: "planning-start", boundaryType: "phase-start", lifecycleState: STATES.ACTIVE, stageId: "opening", roundNumber: 2, phase: VOYAGE_ROUND_PHASES.CREW_PLANNING, temporaryState: { currentStage: { stageId: "opening" } } }],
    recovery: { status: "none" }, metadata: { nested: { retained: true } }
  };
}

function failure(result, codes) {
  assert.equal(result.ok, false); assert.equal(result.nextState, null); assert.deepEqual(result.events, []);
  assert.deepEqual(result.errors.map((entry) => entry.code), codes);
}

test("validates empty, one, and multiple exact stored selections without mutation", () => {
  const source = encounter();
  assert.deepEqual(validateVoyageEncounterStationSelections(source), { valid: true, errors: [], warnings: [] });
  source.selections.captain = { stationId: "captain", actionId: "rally-crew" };
  const oneBefore = clonePlainData(source); assert.equal(validateVoyageEncounterStationSelections(source).valid, true); assert.deepEqual(source, oneBefore);
  source.selections.engineer = { stationId: "engineer", actionId: "stabilize-strain" };
  const multipleBefore = clonePlainData(source); assert.equal(validateVoyageEncounterStationSelections(source).valid, true); assert.deepEqual(source, multipleBefore);
});

test("propagates structural state errors and returns a fresh warnings array", () => {
  const source = encounter(); source.schemaVersion = 99; source.selections = null;
  const structural = validateVoyageEncounterState(source); const result = validateVoyageEncounterStationSelections(source);
  assert.deepEqual(result.errors, structural.errors); assert.notEqual(result.warnings, structural.warnings);
});

test("rejects stored selection shape, IDs, unsafe keys, relations, and exact-case mismatches", () => {
  const cases = [
    ["captain", null, "invalid-station-selection"], ["captain", { actionId: "rally-crew" }, "invalid-selection-station-id"],
    ["captain", { stationId: " ", actionId: "rally-crew" }, "invalid-selection-station-id"], ["captain", { stationId: "engineer", actionId: "rally-crew" }, "selection-station-key-mismatch"],
    ["captain", { stationId: "captain" }, "invalid-selection-action-id"], ["captain", { stationId: "captain", actionId: " " }, "invalid-selection-action-id"],
    ["captain", { stationId: "Captain", actionId: "rally-crew" }, "selection-station-key-mismatch"], ["captain", { stationId: "captain", actionId: "RALLY-CREW" }, "selected-action-not-available"]
  ];
  for (const [key, value, code] of cases) { const source = encounter(); source.selections[key] = value; assert.equal(validateVoyageEncounterStationSelections(source).errors[0].code, code); }
  for (const key of ["__proto__", "constructor", "prototype"]) { const source = encounter(); Object.defineProperty(source.selections, key, { value: {}, enumerable: true }); assert.equal(validateVoyageEncounterStationSelections(source).errors[0].code, "unsafe-station-selection-key"); }
  for (const [stations, code] of [
    [[], "selected-station-not-available"], [[{ stationId: "captain", actions: [] }, { stationId: "captain", actions: [] }], "selected-station-is-ambiguous"],
    [[{ stationId: "captain", actions: {} }], "invalid-available-station-actions"], [[{ stationId: "captain", actions: [] }], "selected-action-not-available"],
    [[{ stationId: "captain", actions: [{ actionId: "rally-crew" }, { actionId: "rally-crew" }] }], "selected-action-is-ambiguous"]
  ]) { const source = encounter(); source.availableStations = stations; source.selections.captain = { stationId: "captain", actionId: "rally-crew" }; assert.equal(validateVoyageEncounterStationSelections(source).errors.at(-1).code, code); }
});

test("atomically creates one isolated initial selection, revision, and event", () => {
  const source = encounter(); source.selections.engineer = { stationId: "engineer", actionId: "stabilize-strain" };
  const request = { stationId: "captain", actionId: "rally-crew", ignored: { mutable: true } }; const before = clonePlainData(source); const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterStationActionSelection(source, request);
  assert.equal(result.ok, true); assert.deepEqual(result.errors, []); assert.equal(result.events.length, 1); assert.ok(Array.isArray(result.warnings));
  assert.deepEqual(result.nextState.selections, { engineer: { stationId: "engineer", actionId: "stabilize-strain" }, captain: { stationId: "captain", actionId: "rally-crew" } });
  assert.deepEqual(Object.keys(result.nextState.selections.captain), ["stationId", "actionId"]); assert.equal(result.nextState.lifecycleState, STATES.ACTIVE); assert.equal(result.nextState.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING); assert.equal(result.nextState.roundNumber, before.roundNumber); assert.deepEqual(result.nextState.currentStage, before.currentStage); assert.deepEqual(result.nextState.snapshots, before.snapshots); assert.equal(result.nextState.snapshots.length, before.snapshots.length); assert.equal(result.nextState.revision, 8);
  assert.deepEqual(result.events[0], { type: "voyage.station-action-selected", encounterId: "station-selection", lifecycleState: STATES.ACTIVE, roundNumber: 2, phase: VOYAGE_ROUND_PHASES.CREW_PLANNING, stationId: "captain", actionId: "rally-crew", previousRevision: 7, revision: 8 });
  assert.equal(validateVoyageEncounterStationSelections(result.nextState).valid, true); assert.deepEqual(source, before); assert.deepEqual(request, requestBefore);
  for (const key of ["selections", "currentStage", "participants", "availableStations", "metadata", "snapshots"]) assert.notEqual(result.nextState[key], source[key]);
  result.nextState.currentStage.details.tags.push("next"); result.nextState.availableStations[0].actions[0].authored.skill = "next"; result.nextState.selections.captain.actionId = "next";
  assert.equal(source.currentStage.details.tags.includes("next"), false); assert.equal(source.availableStations[0].actions[0].authored.skill, "diplomacy"); assert.equal(source.selections.captain, undefined);
  source.metadata.nested.retained = false; assert.equal(result.nextState.metadata.nested.retained, true);
});

test("preserves successful exact IDs with surrounding whitespace", () => {
  const source = encounter(); const stationId = " captain "; const actionId = " rally-crew ";
  source.availableStations[0].stationId = stationId; source.availableStations[0].actions[0].actionId = actionId;
  const result = applyVoyageEncounterStationActionSelection(source, { stationId, actionId });
  assert.equal(result.ok, true); assert.equal(Object.hasOwn(result.nextState.selections, stationId), true); assert.equal(result.nextState.selections[stationId].stationId, stationId); assert.equal(result.nextState.selections[stationId].actionId, actionId); assert.equal(result.events[0].stationId, stationId); assert.equal(result.events[0].actionId, actionId);
});

test("rejects malformed state before request, lifecycle and phase before request, and request errors in order", () => {
  const malformed = encounter(); malformed.schemaVersion = 99; assert.deepEqual(applyVoyageEncounterStationActionSelection(malformed, null).errors, validateVoyageEncounterStationSelections(malformed).errors);
  for (const [lifecycle, phase, code] of [[STATES.READY, VOYAGE_ROUND_PHASES.CREW_PLANNING, "station-selection-requires-active"], [STATES.PAUSED, VOYAGE_ROUND_PHASES.CREW_PLANNING, "station-selection-requires-active"], [STATES.ACTIVE, VOYAGE_ROUND_PHASES.SITUATION, "station-selection-requires-crew-planning"], [STATES.ACTIVE, VOYAGE_ROUND_PHASES.LOCK_READINESS, "station-selection-requires-crew-planning"]]) { const source = encounter(); source.lifecycleState = lifecycle; source.phase = phase; if (lifecycle === STATES.READY) { source.roundNumber = null; source.currentStage = null; } assert.equal(applyVoyageEncounterStationActionSelection(source, null).errors[0].code, code); }
  failure(applyVoyageEncounterStationActionSelection(encounter(), null), ["invalid-station-selection-request"]);
  for (const [request, code] of [[{}, "invalid-station-id"], [{ stationId: " ", actionId: "rally-crew" }, "invalid-station-id"], [{ stationId: "captain" }, "invalid-action-id"], [{ stationId: "captain", actionId: " " }, "invalid-action-id"], [{ stationId: "Captain", actionId: "rally-crew" }, "station-not-available"], [{ stationId: "captain", actionId: "RALLY-CREW" }, "station-action-not-available"]]) assert.equal(applyVoyageEncounterStationActionSelection(encounter(), request).errors[0].code, code);
  for (const stationId of ["__proto__", "constructor", "prototype"]) assert.equal(applyVoyageEncounterStationActionSelection(encounter(), { stationId, actionId: "x" }).errors[0].code, "unsafe-station-selection-key");
});

test("rejects ambiguous or unavailable options", () => {
  for (const [mutate, code] of [
    [(source) => { source.availableStations = []; }, "station-not-available"], [(source) => { source.availableStations.push(clonePlainData(source.availableStations[0])); }, "available-station-is-ambiguous"],
    [(source) => { source.availableStations[0].actions = {}; }, "invalid-available-station-actions"], [(source) => { source.availableStations[0].actions = []; }, "station-action-not-available"],
    [(source) => { source.availableStations[0].actions.push({ actionId: "rally-crew" }); }, "station-action-is-ambiguous"]
  ]) { const source = encounter(); mutate(source); failure(applyVoyageEncounterStationActionSelection(source, { stationId: "captain", actionId: "rally-crew" }), [code]); }
});

test("does not treat inherited selections as existing own selections", () => {
  const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "captain"); const source = encounter(); const request = { stationId: "captain", actionId: "rally-crew" };
  try {
    Object.defineProperty(Object.prototype, "captain", { value: { stationId: "captain", actionId: "rally-crew" }, configurable: true });
    assert.equal(Object.hasOwn(source.selections, "captain"), false);
    assert.equal(applyVoyageEncounterStationActionSelection(source, request).ok, true);
  } finally {
    if (descriptor) Object.defineProperty(Object.prototype, "captain", descriptor);
    else delete Object.prototype.captain;
  }
  assert.deepEqual(Object.getOwnPropertyDescriptor(Object.prototype, "captain"), descriptor);
});

test("rejects existing own selections atomically without replacement", () => {
  const source = encounter(); const request = { stationId: "captain", actionId: "coordinate-orders" };
  source.selections.captain = { stationId: "captain", actionId: "rally-crew" };
  const before = clonePlainData(source); const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterStationActionSelection(source, request);
  failure(result, ["station-selection-already-exists"]); assert.deepEqual(source.selections.captain, before.selections.captain); assert.equal(source.revision, before.revision); assert.deepEqual(source, before); assert.deepEqual(request, requestBefore);
});

test("clone construction failures and final validation failures are atomic", () => {
  const source = encounter(); const request = { stationId: "captain", actionId: "rally-crew" }; const requestBefore = clonePlainData(request); const metadata = source.metadata; let reads = 0;
  Object.defineProperty(source, "metadata", { enumerable: true, configurable: true, get() { reads += 1; if (reads >= 2) throw new Error("clone failure"); return metadata; } });
  failure(applyVoyageEncounterStationActionSelection(source, request), ["station-selection-candidate-construction-failed"]); assert.equal(source.revision, 7); assert.deepEqual(source.selections, {}); assert.deepEqual(request, requestBefore);
  const candidateFailure = encounter(); const candidateMetadata = candidateFailure.metadata; let candidateReads = 0;
  Object.defineProperty(candidateFailure, "metadata", { enumerable: true, configurable: true, get() { candidateReads += 1; return candidateReads === 1 ? candidateMetadata : null; } });
  failure(applyVoyageEncounterStationActionSelection(candidateFailure, request), ["invalid-collection-type"]); assert.equal(candidateFailure.revision, 7); assert.deepEqual(candidateFailure.selections, {});
});

test("the station selection domain module imports without Foundry globals", () => {
  assert.equal(typeof validateVoyageEncounterStationSelections, "function"); assert.equal(typeof applyVoyageEncounterStationActionSelection, "function");
});

test("Arcflight registers station selection functions and devTools aliases", async () => {
  const previous = Object.fromEntries(["foundry", "Hooks", "CONFIG", "game"].map((key) => [key, { exists: Object.hasOwn(globalThis, key), value: globalThis[key] }])); let init;
  class TestActorSheetV2 {}
  try {
    globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (Base) => Base }, sheets: { ActorSheetV2: TestActorSheetV2 }, apps: {} }, documents: {}, utils: {} };
    globalThis.Hooks = { once: (_event, callback) => { init = callback; } }; globalThis.CONFIG = {}; globalThis.game = {};
    const arcflight = await import(`../../../scripts/arcflight.js?station-selection=${Date.now()}`); init();
    assert.equal(typeof arcflight.validateVoyageEncounterStationSelections, "function"); assert.equal(typeof arcflight.applyVoyageEncounterStationActionSelection, "function"); assert.equal(typeof game.arcflight.validateVoyageEncounterStationSelections, "function"); assert.equal(typeof game.arcflight.applyVoyageEncounterStationActionSelection, "function"); assert.equal(typeof game.arcflight.devTools.validateVoyageEncounterStationSelections, "function"); assert.equal(typeof game.arcflight.devTools.applyVoyageEncounterStationActionSelection, "function");
  } finally { for (const [key, value] of Object.entries(previous)) { if (value.exists) globalThis[key] = value.value; else delete globalThis[key]; } }
});
