import assert from "node:assert/strict";
import test from "node:test";

import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES,
  VOYAGE_ROUND_PHASES
} from "../../../scripts/voyage/domain/constants.js";
import {
  clonePlainData,
  createDraftVoyageEncounterDefaults
} from "../../../scripts/voyage/domain/defaults.js";
import {
  applyVoyageEncounterStationOrderProposal,
  applyVoyageEncounterStationOrderProposalChange,
  applyVoyageEncounterStationOrderProposalClear
} from "../../../scripts/voyage/domain/station-order-proposal.js";

function assignment(stationId) {
  return {
    stationId,
    operator: {
      kind: "actor",
      uuid: `Actor.${stationId}`
    }
  };
}

function encounter(...stationIds) {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "station-order-proposal",
    definitionId: "event",
    lifecycleState: STATES.ACTIVE,
    revision: 8,
    primaryShip: { actorId: "ship" },
    currentStage: { stageId: "round-one" },
    currentSituation: { situationId: "debris" },
    roundNumber: 2,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    stationAssignments: stationIds.map(assignment),
    availableStations: [{
      stationId: "captain",
      actions: [{ actionId: "coordinate" }]
    }],
    selections: {
      captain: {
        stationId: "captain",
        actionId: "coordinate",
        approachId: "command",
        statisticSlugOrAbilityId: "diplomacy"
      }
    },
    riskBids: {
      captain: { stationId: "captain", riskBidId: "bold" }
    },
    targets: { captain: { stationId: "engineer" } },
    assistance: [{ stationId: "engineer" }],
    reservations: [{ reservationId: "held" }],
    pendingChecks: [{ checkId: "check" }],
    metadata: { nested: { retained: true } }
  };
}

function codes(result) {
  return result.errors.map(({ code }) => code);
}

function expectFailure(result, expectedCode) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.equal(result.errors[0].code, expectedCode);
}

test("creates an isolated unsorted initial proposal with one revision and event", () => {
  const source = encounter("captain", "engineer", "navigator");
  const request = {
    stationOrder: ["navigator", "captain", "engineer"],
    committedStationOrder: ["captain"],
    revision: 1000
  };
  const before = clonePlainData(source);
  const requestBefore = clonePlainData(request);

  const result = applyVoyageEncounterStationOrderProposal(source, request);

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.proposedStationOrder, [
    "navigator",
    "captain",
    "engineer"
  ]);
  assert.deepEqual(result.nextState.committedStationOrder, []);
  assert.equal(result.nextState.revision, 9);
  assert.deepEqual(result.events, [{
    type: "voyage.station-order-proposed",
    encounterId: "station-order-proposal",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 2,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    proposedStationOrder: ["navigator", "captain", "engineer"],
    previousRevision: 8,
    revision: 9
  }]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(source, before);
  assert.deepEqual(request, requestBefore);
  assert.notEqual(result.nextState, source);
  assert.notEqual(result.nextState.metadata, source.metadata);
  assert.notEqual(
    result.events[0].proposedStationOrder,
    result.nextState.proposedStationOrder
  );

  result.events[0].proposedStationOrder[0] = "changed-event";
  result.nextState.proposedStationOrder[1] = "changed-state";
  assert.deepEqual(source, before);
  assert.deepEqual(request, requestBefore);
  assert.equal(result.events[0].proposedStationOrder[1], "captain");
  assert.equal(result.nextState.proposedStationOrder[0], "navigator");
});

test("accepts the sole complete proposal for one occupied station", () => {
  const source = encounter("captain");
  const result = applyVoyageEncounterStationOrderProposal(
    source,
    { stationOrder: ["captain"] }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.proposedStationOrder, ["captain"]);
  assert.deepEqual(result.events[0].proposedStationOrder, ["captain"]);
});

test("initial proposal rejects existing, zero-occupancy, and empty proposals", () => {
  const existing = encounter("captain");
  existing.proposedStationOrder = ["captain"];
  expectFailure(
    applyVoyageEncounterStationOrderProposal(
      existing,
      { stationOrder: ["captain"] }
    ),
    "station-order-proposal-already-exists"
  );

  expectFailure(
    applyVoyageEncounterStationOrderProposal(encounter(), { stationOrder: [] }),
    "station-order-proposal-unnecessary"
  );
  expectFailure(
    applyVoyageEncounterStationOrderProposal(
      encounter(),
      { stationOrder: ["captain"] }
    ),
    "unoccupied-station-order-station-id"
  );
  expectFailure(
    applyVoyageEncounterStationOrderProposal(
      encounter("captain"),
      { stationOrder: [] }
    ),
    "incomplete-station-order-proposal"
  );
});

test("initial proposal rejects partial, unoccupied, duplicate, and excess entries", () => {
  const partial = applyVoyageEncounterStationOrderProposal(
    encounter("captain", "engineer"),
    { stationOrder: ["captain"] }
  );
  expectFailure(partial, "missing-occupied-station-order-station-id");
  assert.equal(partial.errors[0].path, "proposalRequest.stationOrder");

  const unoccupied = applyVoyageEncounterStationOrderProposal(
    encounter("captain"),
    { stationOrder: ["captain", "navigator"] }
  );
  expectFailure(unoccupied, "unoccupied-station-order-station-id");
  assert.equal(unoccupied.errors[0].path, "proposalRequest.stationOrder[1]");

  const duplicate = applyVoyageEncounterStationOrderProposal(
    encounter("captain", "engineer"),
    { stationOrder: ["captain", "engineer", "captain"] }
  );
  expectFailure(duplicate, "duplicate-station-order-station-id");
  assert.equal(duplicate.errors[0].path, "proposalRequest.stationOrder[2]");
});

test("request entries require exact nonblank safe strings without normalization", () => {
  for (const [entry, expectedCode] of [
    ["", "invalid-station-order-station-id"],
    ["   ", "invalid-station-order-station-id"],
    ["__proto__", "unsafe-station-order-station-id"],
    ["prototype", "unsafe-station-order-station-id"],
    ["constructor", "unsafe-station-order-station-id"],
    [1, "invalid-station-order-station-id"],
    [{ stationId: "captain" }, "invalid-station-order-station-id"]
  ]) {
    const result = applyVoyageEncounterStationOrderProposal(
      encounter("captain"),
      { stationOrder: [entry] }
    );
    expectFailure(result, expectedCode);
    assert.equal(result.errors[0].path, "proposalRequest.stationOrder[0]");
  }

  const exact = applyVoyageEncounterStationOrderProposal(
    encounter("captain"),
    { stationOrder: [" captain "] }
  );
  assert.deepEqual(codes(exact), [
    "unoccupied-station-order-station-id",
    "missing-occupied-station-order-station-id"
  ]);
});

test("sparse and inherited numeric request entries are rejected", () => {
  const sparse = new Array(1);
  const sparseResult = applyVoyageEncounterStationOrderProposal(
    encounter("captain"),
    { stationOrder: sparse }
  );
  expectFailure(sparseResult, "sparse-station-order-entry");
  assert.equal(sparseResult.errors[0].path, "proposalRequest.stationOrder[0]");

  const prior = Object.getOwnPropertyDescriptor(Array.prototype, "0");
  try {
    Object.defineProperty(Array.prototype, "0", {
      value: "captain",
      configurable: true,
      writable: true
    });
    const inherited = applyVoyageEncounterStationOrderProposal(
      encounter("captain"),
      { stationOrder: new Array(1) }
    );
    expectFailure(inherited, "sparse-station-order-entry");
  } finally {
    if (prior) Object.defineProperty(Array.prototype, "0", prior);
    else delete Array.prototype[0];
  }
});

test("proposal requests require an own data-property stationOrder", () => {
  expectFailure(
    applyVoyageEncounterStationOrderProposal(
      encounter("captain"),
      Object.create({ stationOrder: ["captain"] })
    ),
    "invalid-station-order-proposal-request"
  );

  const prior = Object.getOwnPropertyDescriptor(
    Object.prototype,
    "stationOrder"
  );
  try {
    Object.defineProperty(Object.prototype, "stationOrder", {
      value: ["captain"],
      configurable: true
    });
    expectFailure(
      applyVoyageEncounterStationOrderProposal(encounter("captain"), {}),
      "missing-station-order-proposal"
    );
  } finally {
    if (prior) Object.defineProperty(Object.prototype, "stationOrder", prior);
    else delete Object.prototype.stationOrder;
  }

  expectFailure(
    applyVoyageEncounterStationOrderProposal(encounter("captain"), {}),
    "missing-station-order-proposal"
  );

  let reads = 0;
  const accessor = {};
  Object.defineProperty(accessor, "stationOrder", {
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const accessorResult = applyVoyageEncounterStationOrderProposal(
    encounter("captain"),
    accessor
  );
  expectFailure(accessorResult, "station-order-proposal-data-read-failed");
  assert.equal(accessorResult.errors[0].path, "proposalRequest.stationOrder");
  assert.equal(reads, 0);
});

test("throwing entry getters and descriptor failures become structured failures", () => {
  let reads = 0;
  const order = [];
  Object.defineProperty(order, "0", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const getterResult = applyVoyageEncounterStationOrderProposal(
    encounter("captain"),
    { stationOrder: order }
  );
  expectFailure(getterResult, "station-order-data-read-failed");
  assert.equal(getterResult.errors[0].path, "proposalRequest.stationOrder[0]");
  assert.equal(reads, 0);

  const hostileOrder = new Proxy(["captain"], {
    getOwnPropertyDescriptor(_target, key) {
      if (key === "length") throw new Error("hostile descriptor");
      return Reflect.getOwnPropertyDescriptor(_target, key);
    }
  });
  const descriptorResult = applyVoyageEncounterStationOrderProposal(
    encounter("captain"),
    { stationOrder: hostileOrder }
  );
  expectFailure(descriptorResult, "station-order-data-read-failed");
  assert.equal(
    descriptorResult.errors[0].path,
    "proposalRequest.stationOrder.length"
  );

  const hostileRequest = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error("hostile request");
    }
  });
  expectFailure(
    applyVoyageEncounterStationOrderProposal(
      encounter("captain"),
      hostileRequest
    ),
    "station-order-proposal-data-read-failed"
  );
});

test("changes a proposal to another exact positional permutation", () => {
  const source = encounter("captain", "engineer", "navigator");
  source.proposedStationOrder = ["captain", "engineer", "navigator"];
  const before = clonePlainData(source);
  const request = { stationOrder: ["navigator", "engineer", "captain"] };

  const result = applyVoyageEncounterStationOrderProposalChange(source, request);

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.proposedStationOrder, [
    "navigator",
    "engineer",
    "captain"
  ]);
  assert.equal(result.nextState.revision, 9);
  assert.deepEqual(result.events, [{
    type: "voyage.station-order-proposal-changed",
    encounterId: "station-order-proposal",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 2,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    previousProposedStationOrder: ["captain", "engineer", "navigator"],
    proposedStationOrder: ["navigator", "engineer", "captain"],
    previousRevision: 8,
    revision: 9
  }]);
  assert.deepEqual(source, before);
  assert.notEqual(
    result.events[0].previousProposedStationOrder,
    source.proposedStationOrder
  );
  assert.notEqual(
    result.events[0].proposedStationOrder,
    result.nextState.proposedStationOrder
  );
});

test("change rejects missing, unchanged, malformed, and one-station proposals", () => {
  expectFailure(
    applyVoyageEncounterStationOrderProposalChange(
      encounter("captain"),
      { stationOrder: ["captain"] }
    ),
    "station-order-proposal-does-not-exist"
  );

  const unchanged = encounter("captain", "engineer");
  unchanged.proposedStationOrder = ["engineer", "captain"];
  expectFailure(
    applyVoyageEncounterStationOrderProposalChange(
      unchanged,
      { stationOrder: ["engineer", "captain"] }
    ),
    "station-order-proposal-unchanged"
  );

  const malformed = encounter("captain", "engineer");
  malformed.proposedStationOrder = ["captain", "engineer"];
  expectFailure(
    applyVoyageEncounterStationOrderProposalChange(
      malformed,
      { stationOrder: ["captain"] }
    ),
    "missing-occupied-station-order-station-id"
  );

  const sole = encounter("captain");
  sole.proposedStationOrder = ["captain"];
  expectFailure(
    applyVoyageEncounterStationOrderProposalChange(
      sole,
      { stationOrder: ["captain"] }
    ),
    "station-order-proposal-unchanged"
  );
});

test("clears an existing complete proposal with an exact isolated event", () => {
  const source = encounter("captain", "engineer");
  source.proposedStationOrder = ["engineer", "captain"];
  const before = clonePlainData(source);
  const request = {};

  const result = applyVoyageEncounterStationOrderProposalClear(source, request);

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.proposedStationOrder, []);
  assert.deepEqual(result.nextState.committedStationOrder, []);
  assert.equal(result.nextState.revision, 9);
  assert.deepEqual(result.events, [{
    type: "voyage.station-order-proposal-cleared",
    encounterId: "station-order-proposal",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 2,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    clearedProposedStationOrder: ["engineer", "captain"],
    previousRevision: 8,
    revision: 9
  }]);
  assert.deepEqual(source, before);
  assert.deepEqual(request, {});
  assert.notEqual(
    result.events[0].clearedProposedStationOrder,
    source.proposedStationOrder
  );
});

test("clear rejects an empty proposal and malformed clear request", () => {
  expectFailure(
    applyVoyageEncounterStationOrderProposalClear(encounter("captain"), {}),
    "station-order-proposal-does-not-exist"
  );

  const source = encounter("captain");
  source.proposedStationOrder = ["captain"];
  expectFailure(
    applyVoyageEncounterStationOrderProposalClear(source, null),
    "invalid-station-order-proposal-request"
  );
});

test("all operations reject a non-empty committed order", () => {
  const initial = encounter("captain");
  initial.committedStationOrder = ["captain"];
  expectFailure(
    applyVoyageEncounterStationOrderProposal(
      initial,
      { stationOrder: ["captain"] }
    ),
    "station-order-proposal-already-committed"
  );

  for (const operation of [
    (state) => applyVoyageEncounterStationOrderProposalChange(
      state,
      { stationOrder: ["engineer", "captain"] }
    ),
    (state) => applyVoyageEncounterStationOrderProposalClear(state, {})
  ]) {
    const source = encounter("captain", "engineer");
    source.proposedStationOrder = ["captain", "engineer"];
    source.committedStationOrder = ["engineer", "captain"];
    expectFailure(
      operation(source),
      "station-order-proposal-already-committed"
    );
  }
});

test("all operations require Active Crew Planning", () => {
  const operations = [
    (state) => applyVoyageEncounterStationOrderProposal(
      state,
      { stationOrder: ["captain"] }
    ),
    (state) => applyVoyageEncounterStationOrderProposalChange(
      state,
      { stationOrder: ["captain"] }
    ),
    (state) => applyVoyageEncounterStationOrderProposalClear(state, {})
  ];

  for (const [index, operation] of operations.entries()) {
    const inactive = encounter("captain");
    if (index > 0) inactive.proposedStationOrder = ["captain"];
    inactive.lifecycleState = STATES.PAUSED;
    expectFailure(
      operation(inactive),
      "station-order-proposal-requires-active"
    );

    const wrongPhase = encounter("captain");
    if (index > 0) wrongPhase.proposedStationOrder = ["captain"];
    wrongPhase.phase = VOYAGE_ROUND_PHASES.SITUATION;
    expectFailure(
      operation(wrongPhase),
      "station-order-proposal-requires-crew-planning"
    );
  }
});

test("all operations reject malformed current order or assignment state", () => {
  const malformedProposal = encounter("captain");
  malformedProposal.proposedStationOrder = ["captain", "captain"];
  for (const operation of [
    (state) => applyVoyageEncounterStationOrderProposal(
      state,
      { stationOrder: ["captain"] }
    ),
    (state) => applyVoyageEncounterStationOrderProposalChange(
      state,
      { stationOrder: ["captain"] }
    ),
    (state) => applyVoyageEncounterStationOrderProposalClear(state, {})
  ]) {
    const source = clonePlainData(malformedProposal);
    expectFailure(operation(source), "duplicate-station-order-station-id");
  }

  const malformedAssignments = encounter("captain");
  malformedAssignments.stationAssignments.push(assignment("captain"));
  expectFailure(
    applyVoyageEncounterStationOrderProposal(
      malformedAssignments,
      { stationOrder: ["captain"] }
    ),
    "duplicate-station-assignment"
  );
});

test("successful operations preserve unrelated planning and station data", () => {
  const source = encounter("captain", "engineer");
  const preserved = {
    stationAssignments: clonePlainData(source.stationAssignments),
    availableStations: clonePlainData(source.availableStations),
    selections: clonePlainData(source.selections),
    riskBids: clonePlainData(source.riskBids),
    targets: clonePlainData(source.targets),
    assistance: clonePlainData(source.assistance),
    reservations: clonePlainData(source.reservations),
    pendingChecks: clonePlainData(source.pendingChecks),
    currentStage: clonePlainData(source.currentStage),
    metadata: clonePlainData(source.metadata)
  };

  const result = applyVoyageEncounterStationOrderProposal(
    source,
    { stationOrder: ["engineer", "captain"] }
  );

  for (const [key, value] of Object.entries(preserved)) {
    assert.deepEqual(result.nextState[key], value);
  }
});

test("clone and candidate-validation failures remain atomic", () => {
  const cloneSource = encounter("captain");
  const metadata = cloneSource.metadata;
  let metadataReads = 0;
  Object.defineProperty(cloneSource, "metadata", {
    enumerable: true,
    configurable: true,
    get() {
      metadataReads += 1;
      if (metadataReads > 1) throw new Error("clone failed");
      return metadata;
    }
  });
  const cloneResult = applyVoyageEncounterStationOrderProposal(
    cloneSource,
    { stationOrder: ["captain"] }
  );
  expectFailure(cloneResult, "station-order-proposal-clone-failed");
  assert.equal(cloneSource.revision, 8);
  assert.deepEqual(cloneSource.proposedStationOrder, []);

  const candidateSource = encounter("captain");
  let participantReads = 0;
  Object.defineProperty(candidateSource, "participants", {
    enumerable: true,
    configurable: true,
    get() {
      participantReads += 1;
      return participantReads <= 2 ? [] : {};
    }
  });
  const candidateResult = applyVoyageEncounterStationOrderProposal(
    candidateSource,
    { stationOrder: ["captain"] }
  );
  expectFailure(candidateResult, "invalid-collection-type");
  assert.equal(candidateSource.revision, 8);
  assert.deepEqual(candidateSource.proposedStationOrder, []);
});

test("failures are atomic with deterministic precise issue ordering", () => {
  const source = encounter("captain", "engineer");
  const request = { stationOrder: ["", "__proto__", "navigator"] };
  const before = clonePlainData(source);
  const requestBefore = clonePlainData(request);

  const result = applyVoyageEncounterStationOrderProposal(source, request);

  assert.deepEqual(codes(result), [
    "invalid-station-order-station-id",
    "unsafe-station-order-station-id",
    "unoccupied-station-order-station-id",
    "missing-occupied-station-order-station-id",
    "missing-occupied-station-order-station-id"
  ]);
  assert.deepEqual(result.errors.map(({ path }) => path), [
    "proposalRequest.stationOrder[0]",
    "proposalRequest.stationOrder[1]",
    "proposalRequest.stationOrder[2]",
    "proposalRequest.stationOrder",
    "proposalRequest.stationOrder"
  ]);
  assert.deepEqual(source, before);
  assert.deepEqual(request, requestBefore);
  assert.equal(source.revision, 8);
});

test("the proposal module imports and operates without Foundry globals", async () => {
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
      `../../../scripts/voyage/domain/station-order-proposal.js?foundry-free=${Date.now()}`
    );
    assert.equal(
      typeof module.applyVoyageEncounterStationOrderProposal,
      "function"
    );
    assert.equal(
      typeof module.applyVoyageEncounterStationOrderProposalChange,
      "function"
    );
    assert.equal(
      typeof module.applyVoyageEncounterStationOrderProposalClear,
      "function"
    );

    const source = encounter("captain");
    assert.equal(
      module.applyVoyageEncounterStationOrderProposal(
        source,
        { stationOrder: ["captain"] }
      ).ok,
      true
    );
  } finally {
    for (const [key, entry] of Object.entries(previous)) {
      if (entry.exists) globalThis[key] = entry.value;
      else delete globalThis[key];
    }
  }
});
