import assert from "node:assert/strict";
import test from "node:test";

import {
  clonePlainData,
  createDefaultVoyageEncounterCollections,
  createDraftVoyageEncounterDefaults
} from "../../../scripts/voyage/domain/defaults.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import {
  analyzeVoyageEncounterStationOrder,
  validateVoyageEncounterStationOrder
} from "../../../scripts/voyage/domain/station-order.js";

function assignment(stationId, suffix = "") {
  return {
    stationId,
    operator: {
      kind: "actor",
      uuid: `Actor.${stationId}${suffix}`
    }
  };
}

function encounter(...stationIds) {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "station-order",
    definitionId: "event",
    lifecycleState: "active",
    revision: 3,
    primaryShip: { actorId: "ship" },
    currentStage: { stageId: "round-one" },
    roundNumber: 1,
    phase: "crew-planning",
    stationAssignments: stationIds.map((stationId) => assignment(stationId))
  };
}

function codes(report) {
  return report.errors.map(({ code }) => code);
}

test("canonical defaults and newly created states own fresh station-order arrays", () => {
  const firstCollections = createDefaultVoyageEncounterCollections();
  const secondCollections = createDefaultVoyageEncounterCollections();
  const firstDraft = createDraftVoyageEncounterDefaults();
  const secondDraft = createDraftVoyageEncounterDefaults();
  const firstState = createVoyageEncounterState({ encounterId: "first" });
  const secondState = createVoyageEncounterState({ encounterId: "second" });

  for (const value of [firstCollections, firstDraft, firstState]) {
    assert.equal(Object.hasOwn(value, "proposedStationOrder"), true);
    assert.equal(Object.hasOwn(value, "committedStationOrder"), true);
    assert.deepEqual(value.proposedStationOrder, []);
    assert.deepEqual(value.committedStationOrder, []);
  }
  assert.notEqual(firstCollections.proposedStationOrder, secondCollections.proposedStationOrder);
  assert.notEqual(firstCollections.committedStationOrder, secondCollections.committedStationOrder);
  assert.notEqual(firstDraft.proposedStationOrder, secondDraft.proposedStationOrder);
  assert.notEqual(firstDraft.committedStationOrder, secondDraft.committedStationOrder);
  assert.notEqual(firstState.proposedStationOrder, secondState.proposedStationOrder);
  assert.notEqual(firstState.committedStationOrder, secondState.committedStationOrder);
});

test("zero occupied stations produce the exact complete and valid report shape", () => {
  const result = analyzeVoyageEncounterStationOrder(encounter());

  assert.deepEqual(result, {
    structurallyValid: true,
    occupiedStationIds: [],
    proposedStationOrder: [],
    committedStationOrder: [],
    proposedOrderValid: true,
    committedOrderValid: true,
    proposedOrderComplete: true,
    committedOrderComplete: true,
    valid: true,
    errors: [],
    warnings: []
  });
});

test("empty orders remain valid but incomplete when stations are occupied", () => {
  const result = analyzeVoyageEncounterStationOrder(encounter("captain", "engineer"));

  assert.equal(result.structurallyValid, true);
  assert.deepEqual(result.occupiedStationIds, ["captain", "engineer"]);
  assert.deepEqual(result.proposedStationOrder, []);
  assert.deepEqual(result.committedStationOrder, []);
  assert.equal(result.proposedOrderValid, true);
  assert.equal(result.committedOrderValid, true);
  assert.equal(result.proposedOrderComplete, false);
  assert.equal(result.committedOrderComplete, false);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("one occupied station may have an independently complete proposal or commitment", () => {
  const proposal = encounter("captain");
  proposal.proposedStationOrder = ["captain"];
  const proposalReport = analyzeVoyageEncounterStationOrder(proposal);
  assert.equal(proposalReport.proposedOrderComplete, true);
  assert.equal(proposalReport.committedOrderComplete, false);
  assert.deepEqual(proposalReport.proposedStationOrder, ["captain"]);

  const commitment = encounter("captain");
  commitment.committedStationOrder = ["captain"];
  const commitmentReport = analyzeVoyageEncounterStationOrder(commitment);
  assert.equal(commitmentReport.proposedOrderComplete, false);
  assert.equal(commitmentReport.committedOrderComplete, true);
  assert.deepEqual(commitmentReport.committedStationOrder, ["captain"]);
});

test("multiple player-chosen exact permutations remain exact and unsorted", () => {
  const first = encounter("captain", "engineer", "navigator");
  first.proposedStationOrder = ["navigator", "captain", "engineer"];
  first.committedStationOrder = ["engineer", "navigator", "captain"];
  const firstReport = analyzeVoyageEncounterStationOrder(first);

  assert.deepEqual(firstReport.occupiedStationIds, ["captain", "engineer", "navigator"]);
  assert.deepEqual(firstReport.proposedStationOrder, ["navigator", "captain", "engineer"]);
  assert.deepEqual(firstReport.committedStationOrder, ["engineer", "navigator", "captain"]);
  assert.equal(firstReport.proposedOrderComplete, true);
  assert.equal(firstReport.committedOrderComplete, true);
  assert.equal(firstReport.valid, true);

  const second = encounter("navigator", "captain", "engineer");
  second.proposedStationOrder = ["engineer", "navigator", "captain"];
  assert.deepEqual(
    analyzeVoyageEncounterStationOrder(second).proposedStationOrder,
    ["engineer", "navigator", "captain"]
  );
});

test("missing occupied stations invalidate non-empty proposed and committed orders", () => {
  const proposed = encounter("captain", "engineer");
  proposed.proposedStationOrder = ["captain"];
  const proposedReport = analyzeVoyageEncounterStationOrder(proposed);
  assert.equal(proposedReport.proposedOrderValid, false);
  assert.equal(proposedReport.proposedOrderComplete, false);
  assert.deepEqual(proposedReport.proposedStationOrder, []);
  assert.equal(proposedReport.errors[0].code, "missing-occupied-station-order-station-id");
  assert.equal(proposedReport.errors[0].path, "proposedStationOrder");

  const committed = encounter("captain", "engineer");
  committed.committedStationOrder = ["engineer"];
  const committedReport = analyzeVoyageEncounterStationOrder(committed);
  assert.equal(committedReport.committedOrderValid, false);
  assert.equal(committedReport.committedOrderComplete, false);
  assert.deepEqual(committedReport.committedStationOrder, []);
  assert.equal(committedReport.errors[0].path, "committedStationOrder");
});

test("unoccupied and excess station IDs invalidate each order at precise entry paths", () => {
  const proposed = encounter("captain");
  proposed.proposedStationOrder = ["captain", "navigator"];
  let result = analyzeVoyageEncounterStationOrder(proposed);
  assert.equal(result.proposedOrderValid, false);
  assert.ok(codes(result).includes("unoccupied-station-order-station-id"));
  assert.equal(
    result.errors.find(({ code }) => code === "unoccupied-station-order-station-id").path,
    "proposedStationOrder[1]"
  );

  const committed = encounter("captain");
  committed.committedStationOrder = ["captain", "engineer"];
  result = analyzeVoyageEncounterStationOrder(committed);
  assert.equal(result.committedOrderValid, false);
  assert.equal(
    result.errors.find(({ code }) => code === "unoccupied-station-order-station-id").path,
    "committedStationOrder[1]"
  );
});

test("duplicate and too-many station IDs are rejected in both orders", () => {
  const source = encounter("captain", "engineer");
  source.proposedStationOrder = ["captain", "engineer", "captain"];
  source.committedStationOrder = ["engineer", "engineer"];

  const result = analyzeVoyageEncounterStationOrder(source);

  assert.deepEqual(codes(result), [
    "duplicate-station-order-station-id",
    "duplicate-station-order-station-id",
    "missing-occupied-station-order-station-id"
  ]);
  assert.equal(result.errors[0].path, "proposedStationOrder[2]");
  assert.equal(result.errors[1].path, "committedStationOrder[1]");
  assert.equal(result.errors[2].path, "committedStationOrder");
});

test("blank, unsafe, and non-string entries are rejected without repair", () => {
  for (const [entry, code] of [
    ["", "invalid-station-order-station-id"],
    ["   ", "invalid-station-order-station-id"],
    ["__proto__", "unsafe-station-order-station-id"],
    ["prototype", "unsafe-station-order-station-id"],
    ["constructor", "unsafe-station-order-station-id"],
    [1, "invalid-station-order-station-id"],
    [{ stationId: "captain" }, "invalid-station-order-station-id"]
  ]) {
    const source = encounter("captain");
    source.proposedStationOrder = [entry];
    const result = analyzeVoyageEncounterStationOrder(source);
    assert.equal(result.proposedOrderValid, false);
    assert.equal(result.errors[0].code, code);
    assert.equal(result.errors[0].path, "proposedStationOrder[0]");
  }

  const exact = encounter("captain");
  exact.proposedStationOrder = [" captain "];
  const exactResult = analyzeVoyageEncounterStationOrder(exact);
  assert.deepEqual(codes(exactResult), [
    "unoccupied-station-order-station-id",
    "missing-occupied-station-order-station-id"
  ]);
  assert.deepEqual(exactResult.proposedStationOrder, []);
});

test("sparse proposed and committed arrays reject inherited numeric entries", () => {
  const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, "0");
  try {
    Object.defineProperty(Array.prototype, "0", {
      value: "captain",
      configurable: true,
      writable: true
    });

    const proposed = encounter("captain");
    proposed.proposedStationOrder = new Array(1);
    const proposedReport = analyzeVoyageEncounterStationOrder(proposed);
    assert.equal(proposedReport.proposedOrderValid, false);
    assert.equal(proposedReport.errors[0].code, "sparse-station-order-entry");
    assert.equal(proposedReport.errors[0].path, "proposedStationOrder[0]");

    const committed = encounter("captain");
    committed.committedStationOrder = new Array(1);
    const committedReport = analyzeVoyageEncounterStationOrder(committed);
    assert.equal(committedReport.committedOrderValid, false);
    assert.equal(committedReport.errors[0].path, "committedStationOrder[0]");
  } finally {
    if (descriptor) Object.defineProperty(Array.prototype, "0", descriptor);
    else delete Array.prototype[0];
  }
});

test("missing and non-array top-level order fields are rejected precisely", () => {
  const missing = encounter();
  delete missing.proposedStationOrder;
  const missingReport = analyzeVoyageEncounterStationOrder(missing);
  assert.deepEqual(codes(missingReport), ["invalid-collection-type"]);
  assert.equal(missingReport.errors[0].path, "proposedStationOrder");

  const nonArray = encounter();
  nonArray.committedStationOrder = {};
  const nonArrayReport = analyzeVoyageEncounterStationOrder(nonArray);
  assert.deepEqual(codes(nonArrayReport), ["invalid-collection-type"]);
  assert.equal(nonArrayReport.errors[0].path, "committedStationOrder");
});

test("inherited top-level order fields do not satisfy the required own-field contract", () => {
  const priorProposed = Object.getOwnPropertyDescriptor(Object.prototype, "proposedStationOrder");
  const priorCommitted = Object.getOwnPropertyDescriptor(Object.prototype, "committedStationOrder");
  try {
    Object.defineProperty(Object.prototype, "proposedStationOrder", {
      value: [],
      configurable: true
    });
    Object.defineProperty(Object.prototype, "committedStationOrder", {
      value: [],
      configurable: true
    });
    const source = encounter();
    delete source.proposedStationOrder;
    delete source.committedStationOrder;

    const result = analyzeVoyageEncounterStationOrder(source);

    assert.equal(result.structurallyValid, false);
    assert.equal(result.proposedOrderValid, false);
    assert.equal(result.committedOrderValid, false);
    assert.deepEqual(codes(result), ["invalid-collection-type", "invalid-collection-type"]);
    assert.deepEqual(result.errors.map(({ path }) => path), [
      "proposedStationOrder",
      "committedStationOrder"
    ]);
  } finally {
    if (priorProposed) Object.defineProperty(Object.prototype, "proposedStationOrder", priorProposed);
    else delete Object.prototype.proposedStationOrder;
    if (priorCommitted) Object.defineProperty(Object.prototype, "committedStationOrder", priorCommitted);
    else delete Object.prototype.committedStationOrder;
  }
});

test("accessor-backed top-level fields and throwing entry getters are rejected without invocation", () => {
  const topLevel = encounter();
  let topLevelReads = 0;
  Object.defineProperty(topLevel, "proposedStationOrder", {
    enumerable: true,
    get() {
      topLevelReads += 1;
      throw new Error("must not run");
    }
  });
  const topLevelReport = analyzeVoyageEncounterStationOrder(topLevel);
  assert.equal(topLevelReads, 0);
  assert.equal(topLevelReport.proposedOrderValid, false);
  assert.deepEqual(codes(topLevelReport), ["invalid-collection-type"]);
  assert.equal(topLevelReport.errors[0].path, "proposedStationOrder");

  const entry = encounter("captain");
  let entryReads = 0;
  entry.proposedStationOrder = [];
  Object.defineProperty(entry.proposedStationOrder, "0", {
    enumerable: true,
    get() {
      entryReads += 1;
      throw new Error("must not run");
    }
  });
  const entryReport = analyzeVoyageEncounterStationOrder(entry);
  assert.equal(entryReads, 0);
  assert.equal(entryReport.errors[0].code, "station-order-data-read-failed");
  assert.equal(entryReport.errors[0].path, "proposedStationOrder[0]");
});

test("proxy descriptor failures become structured issues from both public exports", () => {
  const source = encounter("captain");
  source.proposedStationOrder = new Proxy(["captain"], {
    getOwnPropertyDescriptor() {
      throw new Error("hostile descriptor");
    }
  });

  const analyzed = analyzeVoyageEncounterStationOrder(source);
  const validated = validateVoyageEncounterStationOrder(source);

  assert.equal(analyzed.valid, false);
  assert.equal(analyzed.errors[0].code, "station-order-data-read-failed");
  assert.equal(analyzed.errors[0].path, "proposedStationOrder.length");
  assert.equal(validated.valid, false);
  assert.deepEqual(validated.errors, analyzed.errors);
});

test("invalid proposal and commitment analyses remain independent", () => {
  const invalidProposal = encounter("captain", "engineer");
  invalidProposal.proposedStationOrder = ["captain"];
  invalidProposal.committedStationOrder = ["engineer", "captain"];
  let result = analyzeVoyageEncounterStationOrder(invalidProposal);
  assert.equal(result.proposedOrderValid, false);
  assert.deepEqual(result.proposedStationOrder, []);
  assert.equal(result.committedOrderValid, true);
  assert.deepEqual(result.committedStationOrder, ["engineer", "captain"]);

  const invalidCommitment = encounter("captain", "engineer");
  invalidCommitment.proposedStationOrder = ["engineer", "captain"];
  invalidCommitment.committedStationOrder = ["engineer"];
  result = analyzeVoyageEncounterStationOrder(invalidCommitment);
  assert.equal(result.proposedOrderValid, true);
  assert.deepEqual(result.proposedStationOrder, ["engineer", "captain"]);
  assert.equal(result.committedOrderValid, false);
  assert.deepEqual(result.committedStationOrder, []);

  const malformedProposal = encounter("captain", "engineer");
  malformedProposal.proposedStationOrder = {};
  malformedProposal.committedStationOrder = ["engineer", "captain"];
  result = analyzeVoyageEncounterStationOrder(malformedProposal);
  assert.equal(result.structurallyValid, false);
  assert.equal(result.proposedOrderValid, false);
  assert.deepEqual(result.proposedStationOrder, []);
  assert.equal(result.committedOrderValid, true);
  assert.equal(result.committedOrderComplete, true);
  assert.deepEqual(result.committedStationOrder, ["engineer", "captain"]);

  const malformedCommitment = encounter("captain", "engineer");
  malformedCommitment.proposedStationOrder = ["engineer", "captain"];
  malformedCommitment.committedStationOrder = {};
  result = analyzeVoyageEncounterStationOrder(malformedCommitment);
  assert.equal(result.structurallyValid, false);
  assert.equal(result.proposedOrderValid, true);
  assert.equal(result.proposedOrderComplete, true);
  assert.deepEqual(result.proposedStationOrder, ["engineer", "captain"]);
  assert.equal(result.committedOrderValid, false);
  assert.deepEqual(result.committedStationOrder, []);
});

test("upstream, proposed, and committed issues remain deterministically ordered", () => {
  const source = encounter("captain", "engineer");
  source.revision = -1;
  source.proposedStationOrder = ["", "__proto__"];
  source.committedStationOrder = ["engineer", "engineer"];

  const result = analyzeVoyageEncounterStationOrder(source);

  assert.deepEqual(codes(result), [
    "invalid-revision",
    "invalid-station-order-station-id",
    "unsafe-station-order-station-id",
    "missing-occupied-station-order-station-id",
    "missing-occupied-station-order-station-id",
    "duplicate-station-order-station-id",
    "missing-occupied-station-order-station-id"
  ]);
  assert.deepEqual(result.errors.map(({ path }) => path), [
    "revision",
    "proposedStationOrder[0]",
    "proposedStationOrder[1]",
    "proposedStationOrder",
    "proposedStationOrder",
    "committedStationOrder[1]",
    "committedStationOrder"
  ]);
});

test("invalid assignments retain upstream errors without untrusted order claims", () => {
  const source = encounter("captain");
  source.stationAssignments.push(assignment("captain", "-duplicate"));
  source.proposedStationOrder = ["captain"];
  source.committedStationOrder = ["captain"];

  const result = analyzeVoyageEncounterStationOrder(source);

  assert.equal(result.structurallyValid, false);
  assert.deepEqual(result.occupiedStationIds, []);
  assert.deepEqual(result.proposedStationOrder, []);
  assert.deepEqual(result.committedStationOrder, []);
  assert.equal(result.proposedOrderValid, false);
  assert.equal(result.committedOrderValid, false);
  assert.equal(result.proposedOrderComplete, false);
  assert.equal(result.committedOrderComplete, false);
  assert.deepEqual(codes(result), ["duplicate-station-assignment"]);
});

test("zero occupancy remains safely complete during an unrelated structural failure", () => {
  const source = encounter();
  source.revision = -1;

  const result = analyzeVoyageEncounterStationOrder(source);

  assert.equal(result.structurallyValid, false);
  assert.equal(result.valid, false);
  assert.equal(result.proposedOrderValid, true);
  assert.equal(result.committedOrderValid, true);
  assert.equal(result.proposedOrderComplete, true);
  assert.equal(result.committedOrderComplete, true);
  assert.deepEqual(codes(result), ["invalid-revision"]);
});

test("analyzer and validator outputs are fresh, isolated, and non-mutating", () => {
  const source = encounter("captain", "engineer");
  source.proposedStationOrder = ["engineer", "captain"];
  source.committedStationOrder = ["captain", "engineer"];
  const before = clonePlainData(source);

  const first = analyzeVoyageEncounterStationOrder(source);
  const second = analyzeVoyageEncounterStationOrder(source);
  const validated = validateVoyageEncounterStationOrder(source);

  for (const field of [
    "occupiedStationIds",
    "proposedStationOrder",
    "committedStationOrder",
    "errors",
    "warnings"
  ]) assert.notEqual(first[field], second[field]);
  assert.notEqual(validated.errors, first.errors);
  assert.notEqual(validated.warnings, first.warnings);
  assert.deepEqual(validated, {
    valid: first.valid,
    errors: first.errors,
    warnings: first.warnings
  });

  first.occupiedStationIds.push("navigator");
  first.proposedStationOrder.length = 0;
  first.committedStationOrder.push("navigator");
  first.errors.push({ code: "changed" });
  first.warnings.push({ code: "changed" });

  assert.deepEqual(second.occupiedStationIds, ["captain", "engineer"]);
  assert.deepEqual(second.proposedStationOrder, ["engineer", "captain"]);
  assert.deepEqual(second.committedStationOrder, ["captain", "engineer"]);
  assert.deepEqual(second.errors, []);
  assert.deepEqual(second.warnings, []);
  assert.deepEqual(source, before);
});

test("the station-order module imports without Foundry globals", async () => {
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
      `../../../scripts/voyage/domain/station-order.js?foundry-free=${Date.now()}`
    );
    assert.equal(typeof module.analyzeVoyageEncounterStationOrder, "function");
    assert.equal(typeof module.validateVoyageEncounterStationOrder, "function");
  } finally {
    for (const [key, entry] of Object.entries(previous)) {
      if (entry.exists) globalThis[key] = entry.value;
      else delete globalThis[key];
    }
  }
});
