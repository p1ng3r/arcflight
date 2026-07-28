import assert from "node:assert/strict";
import test from "node:test";
import { prepareVoyageEncounterCrewPlanningCompleteness } from "../../../scripts/voyage/domain/crew-planning-completeness.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function statisticApproach(approachId, statisticSlugOrAbilityId = approachId) {
  return { approachId, statisticSlugOrAbilityId };
}

function noRollApproach(approachId) {
  return { approachId, noRoll: true };
}

function action(actionId, approaches) {
  return { actionId, approaches };
}

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
      {
        stationId: "captain",
        actions: [action("rally", [
          statisticApproach("diplomacy"),
          noRollApproach("steady-command")
        ])],
        selectionRequired: false
      },
      {
        stationId: "engineer",
        actions: [action("stabilize", [
          statisticApproach("crafting"),
          noRollApproach("automatic-shunt")
        ])],
        selectionRequired: true
      },
      {
        stationId: "navigator",
        actions: [action("course", [
          statisticApproach("survival"),
          noRollApproach("careful-course")
        ])]
      }
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

function planOccupiedStations(source) {
  source.selections = {
    captain: {
      stationId: "captain",
      actionId: "rally",
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy"
    },
    navigator: {
      stationId: "navigator",
      actionId: "course",
      approachId: "careful-course",
      noRoll: true
    }
  };
}

function codes(result) {
  return result.errors.map(({ code }) => code);
}

test("zero occupied stations are fully complete with all canonical arrays empty", () => {
  const source = encounter();
  source.stationAssignments = [];

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.deepEqual(result, {
    occupiedStationIds: [],
    selectedStationIds: [],
    missingOccupiedStationIds: [],
    approachSelectedStationIds: [],
    missingApproachStationIds: [],
    complete: true,
    errors: [],
    warnings: []
  });
});

test("one occupied station with no action is missing only its action", () => {
  const source = encounter();
  source.stationAssignments = [source.stationAssignments[0]];

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.deepEqual(result.occupiedStationIds, ["captain"]);
  assert.deepEqual(result.selectedStationIds, []);
  assert.deepEqual(result.missingOccupiedStationIds, ["captain"]);
  assert.deepEqual(result.approachSelectedStationIds, []);
  assert.deepEqual(result.missingApproachStationIds, []);
  assert.equal(result.complete, false);
});

test("an action-only station remains action-selected but is missing its approach", () => {
  const source = encounter();
  source.stationAssignments = [source.stationAssignments[0]];
  source.selections.captain = { stationId: "captain", actionId: "rally" };

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.deepEqual(result.occupiedStationIds, ["captain"]);
  assert.deepEqual(result.selectedStationIds, ["captain"]);
  assert.deepEqual(result.missingOccupiedStationIds, []);
  assert.deepEqual(result.approachSelectedStationIds, []);
  assert.deepEqual(result.missingApproachStationIds, ["captain"]);
  assert.equal(result.complete, false);
  assert.deepEqual(result.errors, []);
});

test("valid statistic and no-roll approaches are action-selected and approach-selected", () => {
  const source = encounter();
  planOccupiedStations(source);

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.deepEqual(result.occupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.selectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.missingOccupiedStationIds, []);
  assert.deepEqual(result.approachSelectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.missingApproachStationIds, []);
  assert.equal(result.complete, true);
  assert.deepEqual(result.errors, []);
});

test("mixed action and approach completion is reported in separate arrays", () => {
  const source = encounter();
  source.selections = {
    captain: {
      stationId: "captain",
      actionId: "rally",
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy"
    },
    navigator: { stationId: "navigator", actionId: "course" }
  };

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.deepEqual(result.selectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.missingOccupiedStationIds, []);
  assert.deepEqual(result.approachSelectedStationIds, ["captain"]);
  assert.deepEqual(result.missingApproachStationIds, ["navigator"]);
  assert.equal(result.complete, false);
});

test("a station missing its action is not also reported as missing an approach", () => {
  const source = encounter();
  source.selections.captain = {
    stationId: "captain",
    actionId: "rally",
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy"
  };

  const result = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.deepEqual(result.selectedStationIds, ["captain"]);
  assert.deepEqual(result.missingOccupiedStationIds, ["navigator"]);
  assert.deepEqual(result.approachSelectedStationIds, ["captain"]);
  assert.deepEqual(result.missingApproachStationIds, []);
  assert.equal(result.complete, false);
});

test("invalid persisted selections remain safely incomplete without trusted approach claims", () => {
  const source = encounter();
  source.selections = {
    captain: {
      stationId: "captain",
      actionId: "rally",
      approachId: "diplomacy"
    },
    navigator: {
      stationId: "navigator",
      actionId: "course",
      approachId: "careful-course",
      noRoll: true
    }
  };
  const before = clonePlainData(source);

  const first = prepareVoyageEncounterCrewPlanningCompleteness(source);
  const second = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.equal(first.complete, false);
  assert.deepEqual(first.selectedStationIds, []);
  assert.deepEqual(first.missingOccupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(first.approachSelectedStationIds, []);
  assert.deepEqual(first.missingApproachStationIds, []);
  assert.deepEqual(codes(first), ["missing-selection-approach-execution-identity"]);
  assert.equal(first.errors[0].path, "selections.captain");
  assert.deepEqual(first.errors, second.errors);
  assert.deepEqual(source, before);
});

test("unoccupied stations require no plan while persisted unoccupied selections remain invalid", () => {
  const source = encounter();
  planOccupiedStations(source);
  const complete = prepareVoyageEncounterCrewPlanningCompleteness(source);
  assert.equal(complete.complete, true);
  assert.equal(complete.occupiedStationIds.includes("engineer"), false);
  assert.equal(complete.selectedStationIds.includes("engineer"), false);
  assert.equal(complete.approachSelectedStationIds.includes("engineer"), false);

  source.selections.engineer = {
    stationId: "engineer",
    actionId: "stabilize",
    approachId: "crafting",
    statisticSlugOrAbilityId: "crafting"
  };
  const invalid = prepareVoyageEncounterCrewPlanningCompleteness(source);
  assert.equal(invalid.complete, false);
  assert.ok(codes(invalid).includes("selected-station-not-occupied"));
  assert.deepEqual(invalid.approachSelectedStationIds, []);
});

test("all station arrays follow deterministic occupied order without duplicates", () => {
  const source = encounter();
  planOccupiedStations(source);
  source.stationAssignments = [
    source.stationAssignments[1],
    source.stationAssignments[0]
  ];

  const first = prepareVoyageEncounterCrewPlanningCompleteness(source);
  const second = prepareVoyageEncounterCrewPlanningCompleteness(source);

  for (const field of [
    "occupiedStationIds",
    "selectedStationIds",
    "approachSelectedStationIds"
  ]) {
    assert.deepEqual(first[field], ["navigator", "captain"]);
    assert.deepEqual(first[field], second[field]);
    assert.equal(new Set(first[field]).size, first[field].length);
  }
  assert.deepEqual(first.missingOccupiedStationIds, []);
  assert.deepEqual(first.missingApproachStationIds, []);
  assert.equal(first.complete, true);
});

test("selectionRequired does not control occupied action or approach completeness", () => {
  const result = prepareVoyageEncounterCrewPlanningCompleteness(encounter());

  assert.deepEqual(result.occupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.missingOccupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.missingApproachStationIds, []);
  assert.equal(result.complete, false);
});

test("canonical reports add approach fields without restoring legacy result names", () => {
  const result = prepareVoyageEncounterCrewPlanningCompleteness(encounter());

  for (const field of [
    "occupiedStationIds",
    "selectedStationIds",
    "missingOccupiedStationIds",
    "approachSelectedStationIds",
    "missingApproachStationIds"
  ]) assert.equal(Object.hasOwn(result, field), true);
  assert.equal(Object.hasOwn(result, "requiredStationIds"), false);
  assert.equal(Object.hasOwn(result, "optionalStationIds"), false);
  assert.equal(Object.hasOwn(result, "missingRequiredStationIds"), false);
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
  const inheritedStations = [{
    stationId: "captain",
    actions: [action("rally", [statisticApproach("diplomacy")])]
  }];
  inheritedStations.length = 3;
  Object.defineProperty(inheritedStations, 1, {
    value: {
      stationId: "navigator",
      actions: [action("course", [noRollApproach("careful-course")])]
    },
    enumerable: false
  });
  Object.setPrototypeOf(inheritedStations, {
    2: {
      stationId: "engineer",
      actions: [action("stabilize", [statisticApproach("crafting")])]
    }
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
  assert.deepEqual(result.approachSelectedStationIds, []);
  assert.deepEqual(result.missingApproachStationIds, []);
  assert.equal(result.complete, false);
});

test("report arrays are fresh and isolated and source inputs remain unchanged", () => {
  const source = encounter();
  planOccupiedStations(source);
  const before = clonePlainData(source);

  const first = prepareVoyageEncounterCrewPlanningCompleteness(source);
  const second = prepareVoyageEncounterCrewPlanningCompleteness(source);

  assert.notEqual(first, second);
  for (const field of [
    "occupiedStationIds",
    "selectedStationIds",
    "missingOccupiedStationIds",
    "approachSelectedStationIds",
    "missingApproachStationIds"
  ]) assert.notEqual(first[field], second[field]);

  first.occupiedStationIds.push("engineer");
  first.selectedStationIds.length = 0;
  first.missingOccupiedStationIds.push("captain");
  first.approachSelectedStationIds.length = 0;
  first.missingApproachStationIds.push("navigator");
  assert.deepEqual(second.occupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.selectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.missingOccupiedStationIds, []);
  assert.deepEqual(second.approachSelectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.missingApproachStationIds, []);
  assert.deepEqual(source, before);
});

test("the completeness helper imports without Foundry globals", async () => {
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
      `../../../scripts/voyage/domain/crew-planning-completeness.js?foundry-free=${Date.now()}`
    );
    assert.equal(typeof module.prepareVoyageEncounterCrewPlanningCompleteness, "function");
  } finally {
    for (const [key, entry] of Object.entries(previous)) {
      if (entry.exists) globalThis[key] = entry.value;
      else delete globalThis[key];
    }
  }
});
