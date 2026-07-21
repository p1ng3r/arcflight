import assert from "node:assert/strict";
import test from "node:test";
import { prepareVoyageEncounterCrewPlanningCompleteness } from "../../../scripts/voyage/domain/crew-planning-completeness.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function encounter() {
  return {
    ...createDraftVoyageEncounterDefaults(), encounterId: "completeness", definitionId: "glassback", lifecycleState: STATES.ACTIVE,
    revision: 3, primaryShip: { actorId: "ship" }, currentStage: { stageId: "opening" }, currentSituation: { threatId: "debris" },
    objective: { objectiveId: "survive" }, roundNumber: 1, phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    availableStations: [
      { stationId: "Captain", actions: [{ actionId: "rally" }] },
      { stationId: " engineer ", actions: [{ actionId: "stabilize" }], selectionRequired: false },
      { stationId: "navigator", actions: [{ actionId: "course" }] }
    ],
    selections: {}, successConditions: [{ conditionId: "success" }], failureConditions: [{ conditionId: "failure" }], snapshots: [], recovery: {}, metadata: {}
  };
}

function codes(result) { return result.errors.map(({ code }) => code); }

test("reports all required stations selected in available-station order", () => {
  const source = encounter();
  source.selections = { Captain: { stationId: "Captain", actionId: "rally" }, navigator: { stationId: "navigator", actionId: "course" } };
  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);
  assert.deepEqual(result.requiredStationIds, ["Captain", "navigator"]);
  assert.deepEqual(result.optionalStationIds, [" engineer "]);
  assert.deepEqual(result.selectedStationIds, ["Captain", "navigator"]);
  assert.deepEqual(result.missingRequiredStationIds, []);
  assert.equal(result.complete, true); assert.deepEqual(result.errors, []);
});

test("reports one or multiple missing required stations deterministically", () => {
  const one = encounter(); one.selections.Captain = { stationId: "Captain", actionId: "rally" };
  assert.deepEqual(prepareVoyageEncounterCrewPlanningCompleteness(one).missingRequiredStationIds, ["navigator"]);
  const multiple = encounter();
  assert.deepEqual(prepareVoyageEncounterCrewPlanningCompleteness(multiple).missingRequiredStationIds, ["Captain", "navigator"]);
});

test("does not require optional stations, whether unselected or selected", () => {
  const unselected = encounter(); unselected.selections = { Captain: { stationId: "Captain", actionId: "rally" }, navigator: { stationId: "navigator", actionId: "course" } };
  assert.equal(prepareVoyageEncounterCrewPlanningCompleteness(unselected).complete, true);
  unselected.selections[" engineer "] = { stationId: " engineer ", actionId: "stabilize" };
  assert.deepEqual(prepareVoyageEncounterCrewPlanningCompleteness(unselected).selectedStationIds, ["Captain", " engineer ", "navigator"]);
});

test("requires own optional and selection properties", () => {
  const source = encounter();
  delete source.availableStations[1].selectionRequired;
  const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "selectionRequired");
  try {
    Object.defineProperty(Object.prototype, "selectionRequired", { value: false, configurable: true });
    const report = prepareVoyageEncounterCrewPlanningCompleteness(source);
    assert.deepEqual(report.requiredStationIds, ["Captain", " engineer ", "navigator"]);
  } finally { if (descriptor) Object.defineProperty(Object.prototype, "selectionRequired", descriptor); else delete Object.prototype.selectionRequired; }

  const selected = encounter();
  selected.selections.Captain = Object.create({ stationId: "Captain", actionId: "rally" });
  assert.deepEqual(prepareVoyageEncounterCrewPlanningCompleteness(selected).selectedStationIds, []);
});

test("supports no available stations", () => {
  const source = encounter(); source.availableStations = [];
  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);
  assert.equal(result.complete, true); assert.deepEqual(result.requiredStationIds, []); assert.deepEqual(result.missingRequiredStationIds, []);
});

test("rejects duplicate, malformed, missing, blank, and unsafe station entries", () => {
  for (const [stations, code] of [
    [[{ stationId: "captain", actions: [] }, { stationId: "captain", actions: [] }], "duplicate-available-station-id"],
    [[null], "invalid-available-station"], [[{ actions: [] }], "invalid-available-station-id"],
    [[{ stationId: "   ", actions: [] }], "invalid-available-station-id"], [[{ stationId: "__proto__", actions: [] }], "unsafe-available-station-id"],
    [[{ stationId: "captain", actions: null }], "invalid-available-station-actions"]
  ]) { const source = encounter(); source.availableStations = stations; assert.ok(codes(prepareVoyageEncounterCrewPlanningCompleteness(source)).includes(code)); }
});

test("returns structural, lifecycle, phase, and unknown-selection validation errors", () => {
  const structural = encounter(); structural.schemaVersion = 0;
  assert.ok(codes(prepareVoyageEncounterCrewPlanningCompleteness(structural)).includes("unsupported-schema-version"));
  const inactive = encounter(); inactive.lifecycleState = STATES.PAUSED;
  assert.ok(codes(prepareVoyageEncounterCrewPlanningCompleteness(inactive)).includes("crew-planning-completeness-requires-active"));
  const wrongPhase = encounter(); wrongPhase.phase = VOYAGE_ROUND_PHASES.SITUATION;
  assert.ok(codes(prepareVoyageEncounterCrewPlanningCompleteness(wrongPhase)).includes("crew-planning-completeness-requires-crew-planning"));
  const unknown = encounter(); unknown.selections.unknown = { stationId: "unknown", actionId: "none" };
  assert.ok(codes(prepareVoyageEncounterCrewPlanningCompleteness(unknown)).includes("selected-station-not-available"));
});

test("preserves exact case and whitespace station IDs", () => {
  const source = encounter(); source.availableStations = [{ stationId: " Captain ", actions: [{ actionId: "rally" }] }];
  source.selections = { " Captain ": { stationId: " Captain ", actionId: "rally" } };
  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);
  assert.deepEqual(result.requiredStationIds, [" Captain "]); assert.equal(result.complete, true);
});

test("ignores inherited selections and returns isolated arrays without input mutation", () => {
  const source = encounter(); const before = clonePlainData(source); const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "Captain");
  try {
    Object.defineProperty(Object.prototype, "Captain", { value: { stationId: "Captain", actionId: "rally" }, configurable: true });
    const first = prepareVoyageEncounterCrewPlanningCompleteness(source); const second = prepareVoyageEncounterCrewPlanningCompleteness(source);
    assert.deepEqual(first.selectedStationIds, []); assert.notEqual(first, second); assert.notEqual(first.requiredStationIds, second.requiredStationIds);
    first.requiredStationIds.push("mutated"); assert.deepEqual(second.requiredStationIds, ["Captain", "navigator"]); assert.deepEqual(source, before);
  } finally { if (descriptor) Object.defineProperty(Object.prototype, "Captain", descriptor); else delete Object.prototype.Captain; }
});

test("the completeness helper imports without Foundry globals", () => {
  assert.equal(typeof prepareVoyageEncounterCrewPlanningCompleteness, "function");
});
