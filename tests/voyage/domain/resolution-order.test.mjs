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
      actions: [{ actionId: "two", resolutionPriority: 3 }]
    },
    {
      stationId: "captain",
      actions: [{ actionId: "one", resolutionPriority: -1 }]
    }
  ];
  source.stationAssignments = [
    assignment("engineer"),
    assignment("captain")
  ];
  source.selections = {
    engineer: { stationId: "engineer", actionId: "two" },
    captain: { stationId: "captain", actionId: "one" }
  };
  return source;
}

test("orders selected locked actions by authored priority", () => {
  const result = prepareVoyageEncounterResolutionOrder(state());
  assert.equal(result.readyForResolution, true);
  assert.deepEqual(
    result.orderedActions.map((entry) => entry.actionId),
    ["one", "two"]
  );
  assert.equal(result.orderedActions[0].riskBidId, null);
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

    assert.equal(prepareVoyageEncounterResolutionOrder(source).readyForResolution, true);
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
  assert.equal(prepareVoyageEncounterResolutionOrder(source).readyForResolution, true);

  const actions = [];
  Object.setPrototypeOf(
    actions,
    Object.assign(Object.create(Array.prototype), {
      0: { actionId: "ghost" }
    })
  );
  source.availableStations = [{ stationId: "captain", actions }];
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
      riskBidOptions: [{ riskBidId: "bid" }]
    },
    configurable: true
  });
  Object.setPrototypeOf(actions, actionPrototype);
  source.availableStations = [{ stationId: "captain", actions }];
  source.stationAssignments = [assignment("captain")];
  source.selections = {
    captain: { stationId: "captain", actionId: "ghost" }
  };

  try {
    assert.ok(
      prepareVoyageEncounterResolutionOrder(source).errors
        .some((entry) => entry.code === "selected-action-not-available")
    );
  } finally {
    Object.setPrototypeOf(actions, Array.prototype);
  }
});
