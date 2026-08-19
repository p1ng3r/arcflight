import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { createVoyageEncounterBoundarySnapshot } from "../../../scripts/voyage/domain/boundary-snapshots.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";

const TEMPORARY_STATE_FIELDS = [
  "currentSituation", "objective", "participants", "availableStations", "stationAssignments",
  "currentStage", "roundNumber", "phase", "playerVisibleInformation", "gmSecretInformation",
  "temporaryConsequences", "tracks", "pressureSystems", "thresholdHistory", "pendingThresholdQueue", "selections",
  "proposedStationOrder", "committedStationOrder", "targets", "riskBids", "assistance",
  "reservations", "pendingChecks", "pendingConsequences"
];

function activeEncounter() {
  const encounter = createVoyageEncounterState({ encounterId: "boundary-snapshot" });
  Object.assign(encounter, {
    lifecycleState: "active", revision: 7, definitionId: "cinderwake-wreck", primaryShip: { shipId: "glassback" },
    currentSituation: { clue: { id: "debris-field" } }, objective: null,
    participants: [{ participantId: "captain", details: { operatorId: "player-1" } }],
    availableStations: [{ stationId: "captain", actions: [{ id: "command" }] }],
    stationAssignments: [{
      stationId: "captain",
      operator: {
        kind: "actor",
        id: "captain-actor",
        uuid: "Actor.captain-actor",
        name: "Captain"
      }
    }],
    currentStage: { stageId: "opening", details: { tags: ["alpha"] } },
    roundNumber: 2, phase: "crew-planning", playerVisibleInformation: { clues: [{ id: "hazard" }] },
    gmSecretInformation: {}, temporaryConsequences: [],
    tracks: [{ trackId: "pressure", visibility: "exact", limitBehavior: "clamp", thresholds: [], details: { current: 1 } }],
    thresholdHistory: [], pendingThresholdQueue: [], selections: { captain: { action: "command" } },
    proposedStationOrder: ["captain"], committedStationOrder: [], targets: {},
    riskBids: {}, assistance: [], reservations: [], pendingChecks: [], pendingConsequences: [{ id: "pending", details: { lane: "veil" } }],
    successConditions: [{ conditionId: "reach-wreck" }], failureConditions: [{ conditionId: "ship-lost" }],
    permanentConsequences: [], processedRequestIds: ["request-1"], snapshots: [], recovery: {}, metadata: { retained: true },
    extensionData: { future: true }
  });
  return encounter;
}

function riskBidOption(riskBidId, dcAdjustment) {
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

function canonicalRiskEncounter(count = 1) {
  const encounter = activeEncounter();
  const stationIds = ["captain", "engineer", "navigator", "watchmaster"];
  encounter.phase = "lock-readiness";
  encounter.availableStations = stationIds.map((stationId, index) => ({
    stationId,
    actions: [{
      actionId: `action-${stationId}`,
      approaches: [{
        approachId: `approach-${stationId}`,
        statisticSlugOrAbilityId: `approach-${stationId}`
      }],
      riskBidOptions: [
        riskBidOption(`bid-${stationId}`, [2, 5, 8, 2][index])
      ]
    }]
  }));
  encounter.stationAssignments = stationIds.map((stationId) => ({
    stationId,
    operator: { kind: "actor", uuid: `Actor.${stationId}` }
  }));
  encounter.selections = Object.fromEntries(stationIds.map(
    (stationId) => [stationId, {
      stationId,
      actionId: `action-${stationId}`,
      approachId: `approach-${stationId}`,
      statisticSlugOrAbilityId: `approach-${stationId}`
    }]
  ));
  encounter.proposedStationOrder = [];
  encounter.committedStationOrder = [...stationIds];
  encounter.riskBids = Object.fromEntries(
    stationIds.slice(0, count).map((stationId, index) => [stationId, {
      stationId,
      actionId: `action-${stationId}`,
      riskBidId: `bid-${stationId}`,
      dcAdjustment: [2, 5, 8, 2][index]
    }])
  );
  return encounter;
}

function errorCodes(result) {
  return result.errors.map((entry) => entry.code);
}

test("constructs round-start snapshots with the exact allowed shape without mutating inputs", () => {
  const encounter = activeEncounter();
  const request = { snapshotId: "  boundary-1  ", boundaryType: "round-start", ignored: { value: true } };
  const encounterBefore = structuredClone(encounter);
  const requestBefore = structuredClone(request);
  const result = createVoyageEncounterBoundarySnapshot(encounter, request);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.ok(Array.isArray(result.warnings));
  assert.deepEqual(Object.keys(result.snapshot), ["snapshotId", "boundaryType", "lifecycleState", "stageId", "roundNumber", "phase", "temporaryState"]);
  assert.equal(result.snapshot.snapshotId, "  boundary-1  ");
  assert.equal(result.snapshot.boundaryType, "round-start");
  assert.equal(result.snapshot.lifecycleState, "active");
  assert.equal(result.snapshot.stageId, "opening");
  assert.equal(result.snapshot.roundNumber, 2);
  assert.equal(result.snapshot.phase, "crew-planning");
  assert.deepEqual(Object.keys(result.snapshot.temporaryState), TEMPORARY_STATE_FIELDS);
  assert.equal(result.snapshot.temporaryState.roundNumber, encounter.roundNumber);
  assert.equal(result.snapshot.temporaryState.phase, encounter.phase);
  for (const fieldName of ["objective", "stationAssignments", "gmSecretInformation", "temporaryConsequences", "pressureSystems", "proposedStationOrder", "committedStationOrder"]) assert.ok(Object.hasOwn(result.snapshot.temporaryState, fieldName));
  assert.equal(Object.hasOwn(result.snapshot.temporaryState, "temporaryStationAssignments"), false);
  for (const fieldName of ["schemaVersion", "snapshots", "permanentConsequences", "processedRequestIds", "recovery", "metadata", "extensionData"]) assert.equal(Object.hasOwn(result.snapshot.temporaryState, fieldName), false);
  assert.deepEqual(encounter, encounterBefore);
  assert.deepEqual(request, requestBefore);
  assert.equal(encounter.lifecycleState, "active");
  assert.equal(encounter.revision, 7);
  assert.equal(encounter.roundNumber, 2);
  assert.equal(encounter.phase, "crew-planning");
  assert.deepEqual(encounter.snapshots, []);
});

test("contains hostile station-order array reads", () => {
  const encounter = activeEncounter();
  encounter.committedStationOrder = new Proxy([], {
    get(target, key, receiver) {
      if (key === "length") throw new Error("hostile length");
      return Reflect.get(target, key, receiver);
    }
  });

  assert.deepEqual(
    createVoyageEncounterBoundarySnapshot(encounter, {
      snapshotId: "hostile-order",
      boundaryType: "phase-start"
    }),
    {
      ok: false,
      snapshot: null,
      errors: [{
        code: "boundary-snapshot-data-read-failed",
        path: "committedStationOrder",
        message: "Boundary snapshot station-order data could not be read safely.",
        severity: "error"
      }],
      warnings: []
    }
  );
});

test("constructs phase-start snapshots using the supplied recognized phase", () => {
  const encounter = activeEncounter();
  encounter.phase = "consequences";
  const result = createVoyageEncounterBoundarySnapshot(encounter, { snapshotId: "phase-1", boundaryType: "phase-start" });
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.boundaryType, "phase-start");
  assert.equal(result.snapshot.phase, "consequences");
  assert.equal(result.snapshot.temporaryState.phase, "consequences");
});

test("snapshots preserve exact canonical Risk Bids as isolated records", () => {
  const encounter = canonicalRiskEncounter(3);
  const before = structuredClone(encounter);
  const first = createVoyageEncounterBoundarySnapshot(encounter, {
    snapshotId: "risk-bids-first",
    boundaryType: "phase-start"
  });
  const second = createVoyageEncounterBoundarySnapshot(encounter, {
    snapshotId: "risk-bids-second",
    boundaryType: "phase-start"
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.snapshot.temporaryState.riskBids, before.riskBids);
  assert.deepEqual(second.snapshot.temporaryState.riskBids, before.riskBids);
  assert.notEqual(first.snapshot.temporaryState.riskBids, encounter.riskBids);
  assert.notEqual(
    first.snapshot.temporaryState.riskBids,
    second.snapshot.temporaryState.riskBids
  );
  first.snapshot.temporaryState.riskBids.captain.dcAdjustment = 8;
  assert.equal(encounter.riskBids.captain.dcAdjustment, 2);
  assert.equal(second.snapshot.temporaryState.riskBids.captain.dcAdjustment, 2);
  assert.deepEqual(encounter, before);
});

test("malformed, hostile, and unoccupied Risk Bids block snapshots", () => {
  const forged = canonicalRiskEncounter(1);
  forged.riskBids.captain.dcAdjustment = 8;
  let result = createVoyageEncounterBoundarySnapshot(forged, {
    snapshotId: "forged-risk-bid",
    boundaryType: "phase-start"
  });
  assert.equal(result.ok, false);
  assert.equal(result.snapshot, null);
  assert.ok(result.errors.some(
    (entry) => entry.code === "risk-bid-dc-adjustment-mismatch"
      && entry.path === "riskBids.captain.dcAdjustment"
  ));

  const fourOccupied = canonicalRiskEncounter(4);
  result = createVoyageEncounterBoundarySnapshot(fourOccupied, {
    snapshotId: "four-occupied-risk-bids",
    boundaryType: "phase-start"
  });
  assert.equal(result.ok, true);
  assert.equal(Object.keys(result.snapshot.temporaryState.riskBids).length, 4);

  const unoccupiedBid = canonicalRiskEncounter(3);
  unoccupiedBid.riskBids.veilwarden = {
    stationId: "veilwarden",
    actionId: "action-veilwarden",
    riskBidId: "bid-veilwarden",
    dcAdjustment: 2
  };
  result = createVoyageEncounterBoundarySnapshot(unoccupiedBid, {
    snapshotId: "unoccupied-risk-bid",
    boundaryType: "phase-start"
  });
  assert.equal(result.ok, false);
  assert.equal(result.snapshot, null);
  assert.ok(result.errors.some((entry) => entry.code === "risk-bid-selection-missing" && entry.path === "riskBids.veilwarden"));
  const hostile = canonicalRiskEncounter(1);
  let reads = 0;
  Object.defineProperty(hostile.riskBids.captain, "dcAdjustment", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not execute");
    }
  });
  result = createVoyageEncounterBoundarySnapshot(hostile, {
    snapshotId: "hostile-risk-bid",
    boundaryType: "phase-start"
  });
  assert.equal(result.ok, false);
  assert.equal(result.snapshot, null);
  assert.equal(reads, 0);
});

test("recursively isolates captured temporary plain data in both directions", () => {
  const encounter = activeEncounter();
  const result = createVoyageEncounterBoundarySnapshot(encounter, { snapshotId: "isolated", boundaryType: "round-start" });
  const snapshot = result.snapshot;
  for (const fieldName of ["currentStage", "participants", "availableStations", "stationAssignments", "playerVisibleInformation", "tracks", "pressureSystems", "selections", "proposedStationOrder", "committedStationOrder", "pendingConsequences"]) assert.notEqual(snapshot.temporaryState[fieldName], encounter[fieldName]);
  assert.notEqual(snapshot.temporaryState.stationAssignments[0], encounter.stationAssignments[0]);
  assert.notEqual(snapshot.temporaryState.stationAssignments[0].operator, encounter.stationAssignments[0].operator);
  snapshot.temporaryState.currentStage.details.tags.push("snapshot-only");
  snapshot.temporaryState.participants[0].details.operatorId = "snapshot-player";
  snapshot.temporaryState.availableStations[0].actions[0].id = "snapshot-action";
  snapshot.temporaryState.stationAssignments[0].operator.name = "Snapshot Captain";
  snapshot.temporaryState.playerVisibleInformation.clues[0].id = "snapshot-clue";
  snapshot.temporaryState.tracks[0].details.current = 9;
  snapshot.temporaryState.pressureSystems["crew-morale"].value = 2;
  snapshot.temporaryState.selections.captain.action = "snapshot-selection";
  snapshot.temporaryState.proposedStationOrder[0] = "snapshot-order";
  snapshot.temporaryState.committedStationOrder.push("snapshot-commitment");
  snapshot.temporaryState.pendingConsequences[0].details.lane = "snapshot-lane";
  assert.equal(encounter.currentStage.details.tags.includes("snapshot-only"), false);
  assert.equal(encounter.participants[0].details.operatorId, "player-1");
  assert.equal(encounter.availableStations[0].actions[0].id, "command");
  assert.equal(encounter.stationAssignments[0].operator.name, "Captain");
  assert.equal(encounter.playerVisibleInformation.clues[0].id, "hazard");
  assert.equal(encounter.tracks[0].details.current, 1);
  assert.equal(encounter.pressureSystems["crew-morale"].value, 0);
  assert.equal(encounter.selections.captain.action, "command");
  assert.deepEqual(encounter.proposedStationOrder, ["captain"]);
  assert.deepEqual(encounter.committedStationOrder, []);
  assert.equal(encounter.pendingConsequences[0].details.lane, "veil");
  encounter.currentStage.details.tags.push("encounter-only");
  encounter.stationAssignments[0].operator.name = "Encounter Captain";
  assert.equal(snapshot.temporaryState.currentStage.details.tags.includes("encounter-only"), false);
  assert.equal(snapshot.temporaryState.stationAssignments[0].operator.name, "Snapshot Captain");
});

test("snapshots preserve pressureSystems as isolated temporary state", () => {
  const encounter = activeEncounter();
  encounter.pressureSystems["crew-morale"].value = 1;
  encounter.pressureSystems["arkengine"].capacity = 4;

  const result = createVoyageEncounterBoundarySnapshot(encounter, {
    snapshotId: "pressure-snapshot",
    boundaryType: "round-start"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.snapshot.temporaryState.pressureSystems, encounter.pressureSystems);
  assert.notStrictEqual(result.snapshot.temporaryState.pressureSystems, encounter.pressureSystems);
  result.snapshot.temporaryState.pressureSystems["crew-morale"].value = 2;
  assert.equal(encounter.pressureSystems["crew-morale"].value, 1);
});

test("hostile non-order temporary data returns a contained atomic failure", () => {
  const encounter = activeEncounter();
  encounter.targets.loop = encounter.targets;

  const result = createVoyageEncounterBoundarySnapshot(encounter, {
    snapshotId: "hostile-targets",
    boundaryType: "round-start"
  });

  assert.equal(result.ok, false);
  assert.equal(result.snapshot, null);
  assert.deepEqual(result.errors, [{
    code: "boundary-snapshot-data-read-failed",
    path: "targets",
    message: "Boundary snapshot temporary state could not be read safely.",
    severity: "error"
  }]);
});

test("hostile state-validation and request accessors return deterministic public failures", () => {
  const hostileState = activeEncounter();
  Object.defineProperty(hostileState, "schemaVersion", {
    enumerable: true,
    configurable: true,
    get() {
      throw new Error("hostile schema version");
    }
  });
  const hostileRequest = {
    get snapshotId() {
      throw new Error("hostile snapshot ID");
    },
    boundaryType: "round-start"
  };

  for (const result of [
    createVoyageEncounterBoundarySnapshot(hostileState, {
      snapshotId: "hostile-state",
      boundaryType: "round-start"
    }),
    createVoyageEncounterBoundarySnapshot(activeEncounter(), hostileRequest)
  ]) {
    assert.deepEqual(result, {
      ok: false,
      snapshot: null,
      errors: [{
        code: "boundary-snapshot-data-read-failed",
        path: "$",
        message: "Boundary snapshot inputs could not be read safely.",
        severity: "error"
      }],
      warnings: []
    });
  }
});

test("round cleanup boundary preserves fixed assignments without introducing a legacy field", () => {
  const encounter = activeEncounter();
  encounter.phase = "cleanup-advance";
  const before = structuredClone(encounter.stationAssignments);

  const result = createVoyageEncounterBoundarySnapshot(encounter, {
    snapshotId: "cleanup-boundary",
    boundaryType: "phase-start"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(encounter.stationAssignments, before);
  assert.deepEqual(result.snapshot.temporaryState.stationAssignments, before);
  assert.notEqual(result.snapshot.temporaryState.stationAssignments, encounter.stationAssignments);
  assert.notEqual(result.snapshot.temporaryState.stationAssignments[0].operator, encounter.stationAssignments[0].operator);
  assert.equal(Object.hasOwn(result.snapshot.temporaryState, "temporaryStationAssignments"), false);
});

test("returns existing malformed-state validation reports unchanged", () => {
  const encounter = activeEncounter();
  encounter.schemaVersion = 999;
  encounter.revision = -1;
  const expected = validateVoyageEncounterState(encounter);
  const result = createVoyageEncounterBoundarySnapshot(encounter, { snapshotId: "ignored", boundaryType: "round-start" });
  assert.equal(result.ok, false);
  assert.equal(result.snapshot, null);
  assert.deepEqual(result.errors, expected.errors);
  assert.deepEqual(result.warnings, expected.warnings);
  assert.ok(errorCodes(result).includes("unsupported-schema-version"));
  assert.ok(errorCodes(result).includes("invalid-revision"));
});

test("collects Active, request, and stage errors atomically after state validation", () => {
  for (const lifecycleState of ["ready", "paused"]) {
    const encounter = activeEncounter();
    encounter.lifecycleState = lifecycleState;
    if (lifecycleState === "ready") { encounter.roundNumber = null; encounter.phase = null; }
    const result = createVoyageEncounterBoundarySnapshot(encounter, { snapshotId: "snapshot", boundaryType: "round-start" });
    assert.equal(result.snapshot, null);
    assert.ok(errorCodes(result).includes("boundary-snapshot-requires-active"));
  }
  const encounter = activeEncounter();
  encounter.currentStage.stageId = "  ";
  const before = structuredClone(encounter);
  const result = createVoyageEncounterBoundarySnapshot(encounter, { boundaryType: "invalid" });
  assert.equal(result.ok, false);
  assert.equal(result.snapshot, null);
  for (const code of ["invalid-snapshot-id", "invalid-snapshot-boundary-type", "invalid-snapshot-stage-id"]) assert.ok(errorCodes(result).includes(code));
  assert.deepEqual(encounter, before);
});

test("validates malformed requests without reading their fields", () => {
  const encounter = activeEncounter();
  for (const request of [null, [], "request"]) {
    const result = createVoyageEncounterBoundarySnapshot(encounter, request);
    assert.equal(result.snapshot, null);
    assert.deepEqual(errorCodes(result), ["invalid-snapshot-request"]);
  }
  assert.ok(errorCodes(createVoyageEncounterBoundarySnapshot(encounter, { snapshotId: " ", boundaryType: "round-start" })).includes("invalid-snapshot-id"));
  assert.ok(errorCodes(createVoyageEncounterBoundarySnapshot(encounter, { snapshotId: "id", boundaryType: "stage-start" })).includes("invalid-snapshot-boundary-type"));
});

test("produces a snapshot that satisfies existing stored snapshot validation when appended only to a clone", () => {
  const encounter = activeEncounter();
  const result = createVoyageEncounterBoundarySnapshot(encounter, { snapshotId: "compatible", boundaryType: "round-start" });
  const candidate = structuredClone(encounter);
  candidate.snapshots.push(result.snapshot);
  assert.equal(validateVoyageEncounterState(candidate).valid, true);
  assert.deepEqual(encounter.snapshots, []);
});

test("the domain module imports without Foundry globals", () => {
  assert.equal(typeof createVoyageEncounterBoundarySnapshot, "function");
});

test("Arcflight registers the boundary snapshot helper and dev-tools alias", async () => {
  const previous = Object.fromEntries(["foundry", "Hooks", "CONFIG", "game"].map((key) => [key, { exists: Object.hasOwn(globalThis, key), value: globalThis[key] }]));
  let initCallback;
  class TestActorSheetV2 {}
  try {
    globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (Base) => Base }, sheets: { ActorSheetV2: TestActorSheetV2 }, apps: {} }, documents: {}, utils: {} };
    globalThis.Hooks = { once: (_event, callback) => { initCallback = callback; } };
    globalThis.CONFIG = {};
    globalThis.game = {};
    await import(`../../../scripts/arcflight.js?boundary-snapshots=${Date.now()}`);
    initCallback();
    assert.equal(typeof globalThis.game.arcflight.createVoyageEncounterBoundarySnapshot, "function");
    assert.equal(typeof globalThis.game.arcflight.devTools.createVoyageEncounterBoundarySnapshot, "function");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value.exists) globalThis[key] = value.value;
      else delete globalThis[key];
    }
  }
});
