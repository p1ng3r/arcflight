import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { prepareVoyageEncounterResolutionOrder } from "../../../scripts/voyage/domain/resolution-order.js";

function assignment(stationId) {
  return {
    stationId,
    operator: {
      kind: "actor",
      uuid: `Actor.${stationId}`
    }
  };
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

function state() {
  const source = createVoyageEncounterState({
    encounterId: "e",
    definitionId: "d",
    primaryShip: { id: "s" },
    lifecycleState: "active",
    currentStage: { stageId: "x" },
    roundNumber: 1,
    phase: "lock-readiness"
  });
  source.lifecycleState = "active";
  source.currentStage = { stageId: "x" };
  source.roundNumber = 1;
  source.phase = "lock-readiness";
  source.availableStations = [
    {
      stationId: "engineer",
      actions: [{
        actionId: "two",
        resolutionPriority: -9007199254740991,
        approaches: [{
          approachId: "engineering",
          statisticSlugOrAbilityId: "crafting"
        }],
        riskBidOptions: [riskBidOption("danger")]
      }]
    },
    {
      stationId: "captain",
      actions: [{ actionId: "one", resolutionPriority: 9007199254740991 }]
    }
  ];
  source.stationAssignments = [
    assignment("engineer"),
    assignment("captain")
  ];
  source.selections = {
    engineer: { stationId: "engineer", actionId: "two", approachId: "engineering", statisticSlugOrAbilityId: "crafting" },
    captain: { stationId: "captain", actionId: "one" }
  };
  source.proposedStationOrder = [];
  source.committedStationOrder = ["captain", "engineer"];
  source.riskBids = {
    engineer: {
      stationId: "engineer",
      actionId: "two",
      riskBidId: "danger",
      dcAdjustment: 2
    }
  };
  return source;
}

test("uses exact committed order while retaining informational priority and Risk Bid fields", () => {
  const source = state();
  const before = structuredClone(source);
  const result = prepareVoyageEncounterResolutionOrder(source);
  assert.equal(result.readyForResolution, true);
  assert.deepEqual(result.orderedActions, [
    {
      sequence: 0,
      stationId: "captain",
      actionId: "one",
      resolutionPriority: 9007199254740991,
      riskBidId: null,
      dcAdjustment: null
    },
    {
      sequence: 1,
      stationId: "engineer",
      actionId: "two",
      resolutionPriority: -9007199254740991,
      riskBidId: "danger",
      dcAdjustment: 2
    }
  ]);
  assert.deepEqual(source, before);
  result.orderedActions[0].stationId = "changed";
  assert.deepEqual(source.committedStationOrder, ["captain", "engineer"]);
  const second = prepareVoyageEncounterResolutionOrder(source);
  assert.equal(second.orderedActions[0].stationId, "captain");
  assert.equal(second.orderedActions[1].riskBidId, "danger");
  assert.equal(second.orderedActions[1].dcAdjustment, 2);
});

test("forged, stale, and accessor-backed Risk Bids block ordered action analysis", () => {
  const cases = [
    [
      (source) => { source.riskBids.engineer.dcAdjustment = 5; },
      "risk-bid-dc-adjustment-mismatch"
    ],
    [
      (source) => { source.riskBids.engineer.actionId = "stale"; },
      "risk-bid-action-mismatch"
    ]
  ];
  for (const [mutate, code] of cases) {
    const source = state();
    mutate(source);
    const result = prepareVoyageEncounterResolutionOrder(source);
    assert.equal(result.readyForResolution, false);
    assert.deepEqual(result.orderedActions, []);
    assert.ok(result.errors.some((entry) => entry.code === code), code);
  }

  const accessor = state();
  let reads = 0;
  Object.defineProperty(accessor.riskBids.engineer, "dcAdjustment", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not execute");
    }
  });
  const result = prepareVoyageEncounterResolutionOrder(accessor);
  assert.equal(result.readyForResolution, false);
  assert.deepEqual(result.orderedActions, []);
  assert.equal(reads, 0);
});

test("rejects invalid supplied priority even when unselected", () => {
  const source = state();
  source.availableStations[0].actions.push({
    actionId: "bad",
    resolutionPriority: null
  });
  assert.equal(prepareVoyageEncounterResolutionOrder(source).readyForResolution, false);
});

test("selectionRequired does not require an unoccupied available station", () => {
  for (const selectionRequired of [undefined, true, false]) {
    const source = state();
    source.availableStations = [{
      stationId: "navigator",
      actions: [],
      ...(selectionRequired === undefined ? {} : { selectionRequired })
    }];
    source.stationAssignments = [];
    source.selections = {};
    source.riskBids = {};
    source.committedStationOrder = [];

    const report = prepareVoyageEncounterResolutionOrder(source);
    assert.equal(report.readyForResolution, true);
    assert.equal(report.actionCount, 0);
    assert.deepEqual(report.orderedActions, []);
  }
});

test("selectionRequired false does not excuse an occupied station", () => {
  const source = state();
  source.availableStations = [{
    stationId: "captain",
    selectionRequired: false,
    actions: [{ actionId: "one" }]
  }];
  source.stationAssignments = [assignment("captain")];
  source.selections = {};
  source.riskBids = {};
  source.committedStationOrder = ["captain"];

  const result = prepareVoyageEncounterResolutionOrder(source);
  assert.equal(result.readyForResolution, false);
  assert.ok(
    result.errors.some((entry) => entry.code === "missing-occupied-station-selection")
  );
});

test("ignores inherited numeric station and action entries", () => {
  const source = state();
  source.availableStations = [];
  Object.setPrototypeOf(
    source.availableStations,
    Object.assign(Object.create(Array.prototype), {
      0: { stationId: "ghost", actions: [{ actionId: "ghost-action" }] }
    })
  );
  source.stationAssignments = [];
  source.selections = {};
  source.riskBids = {};
  source.committedStationOrder = [];
  assert.equal(prepareVoyageEncounterResolutionOrder(source).readyForResolution, true);

  const actions = [];
  Object.setPrototypeOf(
    actions,
    Object.assign(Object.create(Array.prototype), {
      0: { actionId: "ghost" }
    })
  );
  source.availableStations = [{ stationId: "captain", actions }];
  source.committedStationOrder = [];
  assert.equal(prepareVoyageEncounterResolutionOrder(source).readyForResolution, true);
});

test("keeps structural validity separate and reports context alongside plan errors", () => {
  const source = state();
  source.lifecycleState = "paused";
  source.phase = "situation";
  source.availableStations[0].actions[0].resolutionPriority = null;

  const report = prepareVoyageEncounterResolutionOrder(source);
  assert.equal(report.structurallyValid, true);
  assert.equal(report.readyForResolution, false);
  assert.deepEqual(
    report.errors.map((entry) => entry.code),
    [
      "invalid-resolution-priority",
      "resolution-order-requires-active",
      "resolution-order-requires-lock-readiness"
    ]
  );
});

test("inherited entries in real array holes are unavailable and cannot satisfy plans", () => {
  const source = state();
  const stations = new Array(1);
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, "0", {
    value: {
      stationId: "captain",
      actions: [{ actionId: "ghost-action" }]
    },
    configurable: true
  });
  Object.setPrototypeOf(stations, prototype);
  source.availableStations = stations;
  source.stationAssignments = [assignment("captain")];
  source.selections = {
    captain: { stationId: "captain", actionId: "ghost-action" }
  };
  source.riskBids = {};
  source.committedStationOrder = ["captain"];

  try {
    const report = prepareVoyageEncounterResolutionOrder(source);
    assert.equal(report.readyForResolution, false);
    assert.equal(report.orderedActions.length, 0);
    assert.ok(
      report.errors.some((entry) => entry.code === "selected-station-not-available")
    );
  } finally {
    Object.setPrototypeOf(stations, Array.prototype);
  }
});

test("inherited actions and Risk Bid options in real holes are unavailable", () => {
  const source = state();
  const actions = new Array(1);
  const actionPrototype = Object.create(Array.prototype);
  Object.defineProperty(actionPrototype, "0", {
    value: {
      actionId: "ghost",
      riskBidOptions: [riskBidOption("bid")]
    },
    configurable: true
  });
  Object.setPrototypeOf(actions, actionPrototype);
  source.availableStations = [{ stationId: "captain", actions }];
  source.stationAssignments = [assignment("captain")];
  source.selections = {
    captain: { stationId: "captain", actionId: "ghost" }
  };
  source.riskBids = {};
  source.committedStationOrder = ["captain"];

  try {
    assert.ok(
      prepareVoyageEncounterResolutionOrder(source).errors
        .some((entry) => entry.code === "selected-action-not-available")
    );
  } finally {
    Object.setPrototypeOf(actions, Array.prototype);
  }
});

test("requires a complete committed order and an empty post-lock proposal", () => {
  const emptyCommitment = state();
  emptyCommitment.committedStationOrder = [];
  assert.deepEqual(
    prepareVoyageEncounterResolutionOrder(emptyCommitment).errors.find(
      (entry) => entry.code === "resolution-order-requires-complete-committed-station-order"
    ),
    {
      code: "resolution-order-requires-complete-committed-station-order",
      path: "committedStationOrder",
      message: "Resolution ordering requires a complete committed station order for every occupied station.",
      severity: "error"
    }
  );

  const partial = state();
  partial.committedStationOrder = ["captain"];
  const partialReport = prepareVoyageEncounterResolutionOrder(partial);
  assert.equal(partialReport.readyForResolution, false);
  assert.ok(partialReport.errors.some(
    (entry) => entry.code === "missing-occupied-station-order-station-id"
      && entry.path === "committedStationOrder"
  ));

  const staleProposal = state();
  staleProposal.proposedStationOrder = ["engineer", "captain"];
  const staleReport = prepareVoyageEncounterResolutionOrder(staleProposal);
  assert.equal(staleReport.readyForResolution, false);
  assert.ok(staleReport.errors.some(
    (entry) => entry.code === "resolution-order-requires-empty-proposed-station-order"
      && entry.path === "proposedStationOrder"
  ));
});

test("retains precise diagnostics for duplicate, unoccupied, malformed, and unreadable commitment data", () => {
  const cases = [
    [["captain", "captain"], "duplicate-station-order-station-id"],
    [["captain", "watchmaster"], "unoccupied-station-order-station-id"],
    [{ captain: true }, "invalid-collection-type"]
  ];
  for (const [committedStationOrder, code] of cases) {
    const source = state();
    source.committedStationOrder = committedStationOrder;
    const report = prepareVoyageEncounterResolutionOrder(source);
    assert.equal(report.readyForResolution, false);
    assert.ok(report.errors.some((entry) => entry.code === code));
  }

  const unreadable = state();
  Object.defineProperty(unreadable, "committedStationOrder", {
    enumerable: true,
    get() {
      throw new Error("unreadable");
    }
  });
  const report = prepareVoyageEncounterResolutionOrder(unreadable);
  assert.equal(report.readyForResolution, false);
  assert.ok(report.errors.some(
    (entry) => entry.code === "invalid-collection-type"
      && entry.path === "committedStationOrder"
  ));
});
