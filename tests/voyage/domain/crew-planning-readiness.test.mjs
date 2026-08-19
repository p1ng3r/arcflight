import assert from "node:assert/strict";
import test from "node:test";
import { prepareVoyageEncounterCrewPlanningCompleteness } from "../../../scripts/voyage/domain/crew-planning-completeness.js";
import { prepareVoyageEncounterCrewPlanningReadiness } from "../../../scripts/voyage/domain/crew-planning-readiness.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function statisticApproach(approachId, statisticSlugOrAbilityId = approachId) {
  return { approachId, statisticSlugOrAbilityId };
}

function noRollApproach(approachId) {
  return { approachId, noRoll: true };
}

function riskBidOption(riskBidId, dcAdjustment = 2) {
  return {
    riskBidId,
    dcAdjustment,
    outcomes: {
      criticalSuccess: [],
      success: [],
      failure: [],
      criticalFailure: []
    }
  };
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
          [riskBidOption("close")]
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
  source.proposedStationOrder = ["captain", "navigator"];
}

const RISK_PLANNING_ORDER = [
  "navigator",
  "captain",
  "veilwarden",
  "engineer",
  "watchmaster"
];

function riskPlanningEncounter(selectedRiskBidStationIds = [], occupiedStationIds = RISK_PLANNING_ORDER) {
  const source = encounter();
  source.availableStations = RISK_PLANNING_ORDER.map((stationId, index) => ({
    stationId,
    actions: [action(
      `action-${stationId}`,
      [
        statisticApproach(`approach-${stationId}`),
        noRollApproach(`no-roll-${stationId}`)
      ],
      [riskBidOption(`bid-${stationId}`, [2, 5, 8][index % 3])]
    )]
  }));
  source.stationAssignments = occupiedStationIds.map((stationId) => ({
    stationId,
    operator: { kind: "actor", uuid: `Actor.${stationId}` }
  }));
  source.selections = Object.fromEntries(occupiedStationIds.map(
    (stationId) => [stationId, statisticSelection(
      stationId,
      `action-${stationId}`,
      `approach-${stationId}`
    )]
  ));
  source.proposedStationOrder = [...occupiedStationIds];
  source.riskBids = Object.fromEntries(selectedRiskBidStationIds.map(
    (stationId) => {
      const index = RISK_PLANNING_ORDER.indexOf(stationId);
      return [stationId, {
        stationId,
        actionId: `action-${stationId}`,
        riskBidId: `bid-${stationId}`,
        dcAdjustment: [2, 5, 8][index % 3]
      }];
    }
  ));
  return source;
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
    proposedStationOrder: [],
    proposedOrderComplete: true,
    riskBidsValid: true,
    selectedRiskBidCount: 0,
    selectedRiskBidStationIds: [],
    baseActionStationIds: [],
    riskBidLimit: 0,
    overRiskBidLimit: false,
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
  source.proposedStationOrder = ["captain"];

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
  statistic.proposedStationOrder = ["captain"];

  const noRoll = encounter();
  noRoll.stationAssignments = [noRoll.stationAssignments[0]];
  noRoll.selections.captain = noRollSelection("captain", "rally", "steady-command");
  noRoll.proposedStationOrder = ["captain"];

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

test("complete actions and approaches without a proposal are not ready", () => {
  const source = encounter();
  planOccupiedStations(source);
  source.proposedStationOrder = [];

  const result = prepareVoyageEncounterCrewPlanningReadiness(source);

  assert.equal(result.complete, false);
  assert.equal(result.readyToLock, false);
  assert.deepEqual(result.proposedStationOrder, []);
  assert.equal(result.proposedOrderComplete, false);
  assert.deepEqual(result.errors, []);
});

test("a complete proposal cannot compensate for missing actions or approaches", () => {
  const missingAction = encounter();
  missingAction.proposedStationOrder = ["captain", "navigator"];
  missingAction.selections.captain = statisticSelection("captain", "rally", "diplomacy");

  const missingApproach = encounter();
  missingApproach.proposedStationOrder = ["captain", "navigator"];
  missingApproach.selections = {
    captain: statisticSelection("captain", "rally", "diplomacy"),
    navigator: { stationId: "navigator", actionId: "course" }
  };

  for (const source of [missingAction, missingApproach]) {
    const result = prepareVoyageEncounterCrewPlanningReadiness(source);
    assert.equal(result.proposedOrderComplete, true);
    assert.equal(result.complete, false);
    assert.equal(result.readyToLock, false);
  }
});

test("readiness preserves exact unsorted proposals and precise malformed-order errors", () => {
  const valid = encounter();
  planOccupiedStations(valid);
  valid.proposedStationOrder = ["navigator", "captain"];
  const validResult = prepareVoyageEncounterCrewPlanningReadiness(valid);
  assert.deepEqual(validResult.proposedStationOrder, ["navigator", "captain"]);
  assert.equal(validResult.readyToLock, true);

  const malformed = encounter();
  planOccupiedStations(malformed);
  malformed.proposedStationOrder = ["captain", "captain"];
  const malformedResult = prepareVoyageEncounterCrewPlanningReadiness(malformed);
  assert.deepEqual(malformedResult.proposedStationOrder, []);
  assert.equal(malformedResult.proposedOrderComplete, false);
  assert.equal(malformedResult.readyToLock, false);
  assert.deepEqual(errorCodes(malformedResult), [
    "duplicate-station-order-station-id",
    "missing-occupied-station-order-station-id"
  ]);
});

test("premature committed order blocks readiness with a readiness-owned exact-path error", () => {
  const source = encounter();
  planOccupiedStations(source);
  source.committedStationOrder = ["navigator", "captain"];

  const result = prepareVoyageEncounterCrewPlanningReadiness(source);

  assert.equal(result.complete, true);
  assert.equal(result.readyToLock, false);
  assert.deepEqual(result.errors.at(-1), {
    code: "crew-planning-committed-station-order-already-present",
    path: "committedStationOrder",
    message: "Crew Planning requires committedStationOrder to remain empty until the plan is locked.",
    severity: "error"
  });
});

test("readiness and completeness reports do not alias arrays or issues", () => {
  const source = encounter();
  planOccupiedStations(source);

  const completeness = prepareVoyageEncounterCrewPlanningCompleteness(source);
  const readiness = prepareVoyageEncounterCrewPlanningReadiness(source);

  for (const field of [
    "occupiedStationIds",
    "selectedStationIds",
    "missingOccupiedStationIds",
    "approachSelectedStationIds",
    "missingApproachStationIds",
    "proposedStationOrder",
    "errors",
    "warnings"
  ]) assert.notEqual(completeness[field], readiness[field]);

  completeness.proposedStationOrder.length = 0;
  completeness.errors.push({ code: "changed" });
  assert.deepEqual(readiness.proposedStationOrder, ["captain", "navigator"]);
  assert.deepEqual(readiness.errors, []);
});

test("station-order and readiness-owned issues compose deterministically without duplicates", () => {
  const source = encounter();
  planOccupiedStations(source);
  source.proposedStationOrder = ["captain", "captain"];
  source.lifecycleState = STATES.PAUSED;

  const first = prepareVoyageEncounterCrewPlanningReadiness(source);
  const second = prepareVoyageEncounterCrewPlanningReadiness(source);

  assert.deepEqual(errorCodes(first), [
    "duplicate-station-order-station-id",
    "missing-occupied-station-order-station-id",
    "crew-planning-completeness-requires-active",
    "crew-planning-readiness-requires-active"
  ]);
  assert.equal(new Set(first.errors.map((entry) => JSON.stringify(entry))).size, first.errors.length);
  assert.deepEqual(first.errors, second.errors);
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
    riskBidId: "missing",
    dcAdjustment: 2
  };
  const bidResult = prepareVoyageEncounterCrewPlanningReadiness(invalidBid);
  assert.equal(bidResult.complete, false);
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

test("readiness accepts zero through five optional Risk Bids across five stations", () => {
  for (let count = 0; count <= 5; count += 1) {
    const selected = RISK_PLANNING_ORDER.slice(0, count);
    const result = prepareVoyageEncounterCrewPlanningReadiness(
      riskPlanningEncounter(selected)
    );

    assert.equal(result.riskBidsValid, true);
    assert.equal(result.selectedRiskBidCount, count);
    assert.deepEqual(result.selectedRiskBidStationIds, selected);
    assert.deepEqual(
      result.baseActionStationIds,
      RISK_PLANNING_ORDER.slice(count)
    );
    assert.equal(result.riskBidLimit, 5);
    assert.equal(result.overRiskBidLimit, false);
    assert.equal(result.complete, true);
    assert.equal(result.readyToLock, true);
    assert.deepEqual(result.errors, []);
  }
});

test("readiness accepts four and five bids at occupied-station capacity", () => {
  const four = riskPlanningEncounter(RISK_PLANNING_ORDER.slice(0, 4), RISK_PLANNING_ORDER.slice(0, 4));
  const fourResult = prepareVoyageEncounterCrewPlanningReadiness(four);
  assert.equal(fourResult.selectedRiskBidCount, 4);
  assert.equal(fourResult.riskBidLimit, 4);
  assert.equal(fourResult.overRiskBidLimit, false);
  assert.equal(fourResult.complete, true);
  assert.equal(fourResult.readyToLock, true);
  assert.deepEqual(fourResult.errors, []);

  const five = riskPlanningEncounter(RISK_PLANNING_ORDER);
  const fiveResult = prepareVoyageEncounterCrewPlanningReadiness(five);
  assert.equal(fiveResult.selectedRiskBidCount, 5);
  assert.equal(fiveResult.riskBidLimit, 5);
  assert.equal(fiveResult.overRiskBidLimit, false);
  assert.equal(fiveResult.complete, true);
  assert.equal(fiveResult.readyToLock, true);
  assert.deepEqual(fiveResult.errors, []);
});

test("readiness rejects a Risk Bid on an unoccupied station", () => {
  const occupied = RISK_PLANNING_ORDER.slice(0, 4);
  const source = riskPlanningEncounter([...occupied, "watchmaster"], occupied);
  const before = clonePlainData(source);
  const result = prepareVoyageEncounterCrewPlanningReadiness(source);
  assert.equal(result.selectedRiskBidCount, 4);
  assert.equal(result.riskBidLimit, 4);
  assert.equal(result.overRiskBidLimit, false);
  assert.equal(result.complete, false);
  assert.equal(result.readyToLock, false);
  assert.ok(result.errors.some((entry) => entry.code === "risk-bid-selection-missing" && entry.path === "riskBids.watchmaster"));
  assert.deepEqual(source, before);
});

test("invalid bids block readiness and do not contribute to the valid count", () => {
  const cases = [
    [
      (source) => { source.riskBids.navigator.dcAdjustment = 8; },
      "risk-bid-dc-adjustment-mismatch"
    ],
    [
      (source) => { source.riskBids.navigator.actionId = "stale-action"; },
      "risk-bid-action-mismatch"
    ],
    [
      (source) => {
        source.selections.navigator = noRollSelection(
          "navigator",
          "action-navigator",
          "no-roll-navigator"
        );
      },
      "risk-bid-requires-rolled-approach"
    ],
    [
      (source) => {
        source.stationAssignments = source.stationAssignments.slice(1);
        source.proposedStationOrder = source.proposedStationOrder.slice(1);
      },
      "risk-bid-station-not-occupied"
    ]
  ];

  for (const [mutate, code] of cases) {
    const source = riskPlanningEncounter(["navigator"]);
    mutate(source);
    const result = prepareVoyageEncounterCrewPlanningReadiness(source);
    assert.equal(result.riskBidsValid, false, code);
    assert.equal(result.selectedRiskBidCount, 0, code);
    assert.deepEqual(result.selectedRiskBidStationIds, [], code);
    assert.equal(result.overRiskBidLimit, false, code);
    assert.equal(result.complete, false, code);
    assert.equal(result.readyToLock, false, code);
    assert.ok(errorCodes(result).includes(code), code);
  }
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
    "proposedStationOrder",
    "selectedRiskBidStationIds",
    "baseActionStationIds",
    "errors",
    "warnings"
  ]) assert.notEqual(first[field], second[field]);

  first.occupiedStationIds.push("engineer");
  first.selectedStationIds.length = 0;
  first.missingOccupiedStationIds.push("captain");
  first.approachSelectedStationIds.length = 0;
  first.missingApproachStationIds.push("navigator");
  first.proposedStationOrder.length = 0;
  first.selectedRiskBidStationIds.push("navigator");
  first.baseActionStationIds.length = 0;
  first.errors.push({ code: "changed" });
  first.warnings.push({ code: "changed" });

  assert.deepEqual(second.occupiedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.selectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.missingOccupiedStationIds, []);
  assert.deepEqual(second.approachSelectedStationIds, ["captain", "navigator"]);
  assert.deepEqual(second.missingApproachStationIds, []);
  assert.deepEqual(second.proposedStationOrder, ["captain", "navigator"]);
  assert.deepEqual(second.selectedRiskBidStationIds, []);
  assert.deepEqual(second.baseActionStationIds, ["captain", "navigator"]);
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
    "proposedStationOrder",
    "proposedOrderComplete",
    "riskBidsValid",
    "selectedRiskBidCount",
    "selectedRiskBidStationIds",
    "baseActionStationIds",
    "riskBidLimit",
    "overRiskBidLimit",
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
