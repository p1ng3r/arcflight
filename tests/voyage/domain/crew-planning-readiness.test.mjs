import assert from "node:assert/strict";
import test from "node:test";
import { prepareVoyageEncounterCrewPlanningReadiness } from "../../../scripts/voyage/domain/crew-planning-readiness.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function statisticApproach(approachId, statisticSlugOrAbilityId = approachId) {
  return { approachId, statisticSlugOrAbilityId };
}

function noRollApproach(approachId) {
  return { approachId, noRoll: true };
}

function action(actionId, approaches, riskBidOptions) {
  return {
    actionId,
    approaches,
    ...(riskBidOptions ? { riskBidOptions } : {})
  };
}

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
      {
        stationId: "captain",
        actions: [action(
          "rally",
          [
            statisticApproach("diplomacy"),
            noRollApproach("steady-command")
          ],
          [{ riskBidId: "close" }]
        )],
        selectionRequired: false
      },
      {
        stationId: "engineer",
        actions: [action("repair", [
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

function statisticSelection(stationId, actionId, approachId) {
  return {
    stationId,
    actionId,
    approachId,
    statisticSlugOrAbilityId: approachId
  };
}

function noRollSelection(stationId, actionId, approachId) {
  return { stationId, actionId, approachId, noRoll: true };
}

function planOccupiedStations(source) {
  source.selections = {
    captain: statisticSelection("captain", "rally", "diplomacy"),
    navigator: noRollSelection("navigator", "course", "careful-course")
  };
}

function errorCodes(result) {
  return result.errors.map(({ code }) => code);
}

test("zero occupied stations are complete and ready with all station arrays empty", () => {
  const source = encounter();
  source.stationAssignments = [];

  const result = prepareVoyageEncounterCrewPlanningReadiness(source);

  assert.deepEqual(result, {
    structurallyValid: true,
    active: true,
    crewPlanning: true,
    occupiedStationIds: [],
    selectedStationIds: [],
    missingOccupiedStationIds: [],
    approachSelectedStationIds: [],
    missingApproachStationIds: [],
    complete: true,
    readyToLock: true,
    errors: [],
    warnings: []
  });
});

test("an occupied station with no action is missing only its action and is not ready", () => {
  const source = encounter();
  source.stationAssignments = [source.stationAssignments[0]];

  const result = prepareVoyageEncounterCrewPlanningReadiness(source);

  assert.deepEqual(result.occupiedStationIds, ["captain"]);
  assert.deepEqual(result.selectedStationIds, []);
  assert.deepEqual(result.missingOccupiedStationIds, ["captain"]);
  assert.deepEqual(result.approachSelectedStationIds, []);
  assert.deepEqual(result.missingApproachStationIds, []);
  assert.equal(result.complete, false);
  assert.equal(result.readyToLock, false);
});

test("an action-only station is selected, missing its approach, and not ready", () => {
  const source = encounter();
  source.stationAssignments = [source.stationAssignments[0]];
  source.selections.captain = { stationId: "captain", actionId: "rally" };

  const result = prepareVoyageEncounterCrewPlanningReadiness(source);

  assert.deepEqual(result.selectedStationIds, ["captain"]);
  assert.deepEqual(result.missingOccupiedStationIds, []);
  assert.deepEqual(result.approachSelectedStationIds, []);
  assert.deepEqual(result.missingApproachStationIds, ["captain"]);
  assert.equal(result.complete, false);
  assert.equal(result.readyToLock, false);
  assert.deepEqual(result.errors, []);
});

test("valid statistic and explicit no-roll plans are ready", () => {
  const statistic = encounter();
  statistic.stationAssignments = [statistic.stationAssignments[0]];
  statistic.selections.captain = statisticSelection("captain", "rally", "diplomacy");

  const noRoll = encounter();
  noRoll.stationAssignments = [noRoll.stationAssignments[0]];
  noRoll.selections.captain = noRollSelection("captain", "rally", "steady-command");

  for (const source of [statistic, noRoll]) {
    const result = prepareVoyageEncounterCrewPlanningReadiness(source);
    assert.equal(result.complete, true);
    assert.equal(result.readyToLock, true);
    assert.deepEqual(result.selectedStationIds, ["captain"]);
    assert.deepEqual(result.approachSelectedStationIds, ["captain"]);
    assert.deepEqual(result.missingOccupiedStationIds, []);
    assert.deepEqual(result.missingApproachStationIds, []);
  }
});

test("every occupied station fully planned is ready", () => {
  const source = encounter();
  planOccupiedStations(source);

  const result = prepareVoyageEncounterCrewPlanningReadiness(source);

  assert.equal(result.complete, true);
  assert.equal(result.readyToLock, true);
  assert.deepEqual(result.selectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.approachSelectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.missingOccupiedStationIds, []);
  assert.deepEqual(result.missingApproachStationIds, []);
  assert.deepEqual(result.errors, []);
});

test("mixed missing-action and missing-approach states remain distinct and not ready", () => {
  const missingAction = encounter();
  missingAction.selections.captain = statisticSelection("captain", "rally", "diplomacy");
  const actionReport = prepareVoyageEncounterCrewPlanningReadiness(missingAction);
  assert.deepEqual(actionReport.selectedStationIds, ["captain"]);
  assert.deepEqual(actionReport.missingOccupiedStationIds, ["navigator"]);
  assert.deepEqual(actionReport.approachSelectedStationIds, ["captain"]);
  assert.deepEqual(actionReport.missingApproachStationIds, []);
  assert.equal(actionReport.readyToLock, false);

  const missingApproach = encounter();
  missingApproach.selections = {
    captain: statisticSelection("captain", "rally", "diplomacy"),
    navigator: { stationId: "navigator", actionId: "course" }
  };
  const approachReport = prepareVoyageEncounterCrewPlanningReadiness(missingApproach);
  assert.deepEqual(approachReport.selectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(approachReport.missingOccupiedStationIds, []);
  assert.deepEqual(approachReport.approachSelectedStationIds, ["captain"]);
  assert.deepEqual(approachReport.missingApproachStationIds, ["navigator"]);
  assert.equal(approachReport.readyToLock, false);
});

test("malformed committed approaches retain precise errors without trusted station claims", () => {
  const source = encounter();
  source.selections = {
    captain: {
      stationId: "captain",
      actionId: "rally",
      approachId: "diplomacy"
    },
    navigator: noRollSelection("navigator", "course", "careful-course")
  };

  const result = prepareVoyageEncounterCrewPlanningReadiness(source);

  assert.equal(result.complete, false);
  assert.equal(result.readyToLock, false);
  assert.deepEqual(result.selectedStationIds, []);
  assert.deepEqual(result.missingOccupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(result.approachSelectedStationIds, []);
  assert.deepEqual(result.missingApproachStationIds, []);
  assert.deepEqual(errorCodes(result), ["missing-selection-approach-execution-identity"]);
  assert.equal(result.errors[0].path, "selections.captain");
});

test("invalid persisted selections and Risk Bids remain not ready", () => {
  const invalidSelection = encounter();
  invalidSelection.selections.engineer = {
    stationId: "engineer",
    actionId: "repair",
    approachId: "crafting",
    statisticSlugOrAbilityId: "crafting"
  };
  const selectionResult = prepareVoyageEncounterCrewPlanningReadiness(invalidSelection);
  assert.equal(selectionResult.readyToLock, false);
  assert.ok(errorCodes(selectionResult).includes("selected-station-not-occupied"));
  assert.deepEqual(selectionResult.selectedStationIds, []);
  assert.deepEqual(selectionResult.approachSelectedStationIds, []);

  const invalidBid = encounter();
  planOccupiedStations(invalidBid);
  invalidBid.riskBids.captain = {
    stationId: "captain",
    actionId: "rally",
    riskBidId: "missing"
  };
  const bidResult = prepareVoyageEncounterCrewPlanningReadiness(invalidBid);
  assert.equal(bidResult.complete, true);
  assert.equal(bidResult.readyToLock, false);
  assert.ok(errorCodes(bidResult).includes("risk-bid-not-available"));
});

test("wrong lifecycle and phase remain not ready", () => {
  const inactive = encounter();
  planOccupiedStations(inactive);
  inactive.lifecycleState = STATES.PAUSED;
  const inactiveResult = prepareVoyageEncounterCrewPlanningReadiness(inactive);
  assert.equal(inactiveResult.active, false);
  assert.equal(inactiveResult.readyToLock, false);
  assert.ok(errorCodes(inactiveResult).includes("crew-planning-readiness-requires-active"));

  const wrongPhase = encounter();
  planOccupiedStations(wrongPhase);
  wrongPhase.phase = VOYAGE_ROUND_PHASES.LOCK_READINESS;
  const phaseResult = prepareVoyageEncounterCrewPlanningReadiness(wrongPhase);
  assert.equal(phaseResult.crewPlanning, false);
  assert.equal(phaseResult.readyToLock, false);
  assert.ok(errorCodes(phaseResult).includes("crew-planning-readiness-requires-crew-planning"));
});

test("invalid or missing current stage prevents readiness with a precise deterministic error", () => {
  const cases = [
    [null, {
      code: "missing-current-stage",
      path: "currentStage",
      message: "Active and paused encounters require a current stage.",
      severity: "error"
    }],
    [{}, {
      code: "invalid-crew-planning-readiness-stage-id",
      path: "currentStage.stageId",
      message: "Crew Planning readiness requires a non-empty current stageId for the Lock Readiness snapshot.",
      severity: "error"
    }],
    [{ stageId: "   " }, {
      code: "invalid-crew-planning-readiness-stage-id",
      path: "currentStage.stageId",
      message: "Crew Planning readiness requires a non-empty current stageId for the Lock Readiness snapshot.",
      severity: "error"
    }]
  ];
  for (const [currentStage, expectedError] of cases) {
    const source = encounter();
    planOccupiedStations(source);
    source.currentStage = currentStage;

    const result = prepareVoyageEncounterCrewPlanningReadiness(source);

    assert.equal(result.readyToLock, false);
    assert.deepEqual(result.errors, [expectedError]);
  }
});

test("unoccupied stations create no readiness requirements", () => {
  const source = encounter();
  planOccupiedStations(source);

  const result = prepareVoyageEncounterCrewPlanningReadiness(source);

  for (const field of [
    "occupiedStationIds",
    "selectedStationIds",
    "missingOccupiedStationIds",
    "approachSelectedStationIds",
    "missingApproachStationIds"
  ]) assert.equal(result[field].includes("engineer"), false);
  assert.equal(result.readyToLock, true);
});

test("station arrays follow deterministic occupied order without duplicates", () => {
  const source = encounter();
  planOccupiedStations(source);
  source.stationAssignments = [
    source.stationAssignments[1],
    source.stationAssignments[0]
  ];

  const first = prepareVoyageEncounterCrewPlanningReadiness(source);
  const second = prepareVoyageEncounterCrewPlanningReadiness(source);

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
});

test("all arrays and issues are fresh, isolated, and leave source state unchanged", () => {
  const source = encounter();
  planOccupiedStations(source);
  const before = clonePlainData(source);

  const first = prepareVoyageEncounterCrewPlanningReadiness(source);
  const second = prepareVoyageEncounterCrewPlanningReadiness(source);

  assert.notEqual(first, second);
  for (const field of [
    "occupiedStationIds",
    "selectedStationIds",
    "missingOccupiedStationIds",
    "approachSelectedStationIds",
    "missingApproachStationIds",
    "errors",
    "warnings"
  ]) assert.notEqual(first[field], second[field]);

  first.occupiedStationIds.push("engineer");
  first.selectedStationIds.length = 0;
  first.missingOccupiedStationIds.push("captain");
  first.approachSelectedStationIds.length = 0;
  first.missingApproachStationIds.push("navigator");
  first.errors.push({ code: "changed" });
  first.warnings.push({ code: "changed" });

  assert.deepEqual(second.occupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.selectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.missingOccupiedStationIds, []);
  assert.deepEqual(second.approachSelectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.missingApproachStationIds, []);
  assert.deepEqual(second.errors, []);
  assert.deepEqual(second.warnings, []);
  assert.deepEqual(source, before);
});

test("the report shape adds approach fields without restoring legacy array names", () => {
  const result = prepareVoyageEncounterCrewPlanningReadiness(encounter());

  assert.deepEqual(Object.keys(result), [
    "structurallyValid",
    "active",
    "crewPlanning",
    "occupiedStationIds",
    "selectedStationIds",
    "missingOccupiedStationIds",
    "approachSelectedStationIds",
    "missingApproachStationIds",
    "complete",
    "readyToLock",
    "errors",
    "warnings"
  ]);
  assert.equal(Object.hasOwn(result, "requiredStationIds"), false);
  assert.equal(Object.hasOwn(result, "optionalStationIds"), false);
  assert.equal(Object.hasOwn(result, "missingRequiredStationIds"), false);
});

test("the readiness helper imports without Foundry globals", async () => {
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
      `../../../scripts/voyage/domain/crew-planning-readiness.js?foundry-free=${Date.now()}`
    );
    assert.equal(typeof module.prepareVoyageEncounterCrewPlanningReadiness, "function");
  } finally {
    for (const [key, entry] of Object.entries(previous)) {
      if (entry.exists) globalThis[key] = entry.value;
      else delete globalThis[key];
    }
  }
});
