import assert from "node:assert/strict";
import test from "node:test";

import {
  VOYAGE_EVENT_RUNNER_PRESSURE_SYSTEM_BY_STATION_ID,
  VOYAGE_EVENT_RUNNER_STATION_IDS
} from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData } from "../../../scripts/voyage/domain/defaults.js";
import {
  VOYAGE_STATION_OPERATOR_KINDS,
  analyzeVoyageStationAssignments,
  deriveOccupiedVoyageStationIds,
  validateVoyageStationAssignments
} from "../../../scripts/voyage/domain/station-assignments.js";

function actor(stationId = "captain", overrides = {}) {
  return {
    stationId,
    operator: {
      kind: "actor",
      id: `${stationId}-actor`,
      uuid: `Actor.${stationId}-actor`,
      name: `${stationId} operator`,
      ...overrides
    }
  };
}

function codes(report) {
  return report.errors.map(({ code }) => code);
}

test("canonical Event Runner station constants are exact and immutable", () => {
  assert.deepEqual(VOYAGE_EVENT_RUNNER_STATION_IDS, [
    "captain",
    "engineer",
    "navigator",
    "watchmaster",
    "veilwarden"
  ]);
  assert.equal(Object.isFrozen(VOYAGE_EVENT_RUNNER_STATION_IDS), true);
  assert.throws(() => VOYAGE_EVENT_RUNNER_STATION_IDS.push("pilot"), TypeError);
  assert.equal(VOYAGE_EVENT_RUNNER_STATION_IDS.includes("pilot"), false);
  assert.equal(VOYAGE_EVENT_RUNNER_STATION_IDS.includes("gunnery"), false);
  assert.equal(VOYAGE_EVENT_RUNNER_STATION_IDS.includes("quartermaster"), false);
});

test("Pressure-system ownership metadata is exact and immutable", () => {
  assert.deepEqual(VOYAGE_EVENT_RUNNER_PRESSURE_SYSTEM_BY_STATION_ID, {
    captain: "crew-morale",
    engineer: "arkengine",
    navigator: "levstone-array",
    watchmaster: "solar-sail-rig",
    veilwarden: "lifeveil"
  });
  assert.equal(Object.isFrozen(VOYAGE_EVENT_RUNNER_PRESSURE_SYSTEM_BY_STATION_ID), true);
  assert.throws(() => {
    VOYAGE_EVENT_RUNNER_PRESSURE_SYSTEM_BY_STATION_ID.captain = "changed";
  }, TypeError);
});

test("operator-kind metadata is immutable", () => {
  assert.deepEqual(VOYAGE_STATION_OPERATOR_KINDS, { ACTOR: "actor", CREW_ASSET: "crewAsset" });
  assert.equal(Object.isFrozen(VOYAGE_STATION_OPERATOR_KINDS), true);
});

test("empty station assignments are valid", () => {
  const report = analyzeVoyageStationAssignments([]);
  assert.equal(report.valid, true);
  assert.equal(report.assignmentCount, 0);
  assert.equal(report.validAssignmentCount, 0);
  assert.deepEqual(report.assignments, []);
  assert.deepEqual(report.occupiedStationIds, []);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.warnings, []);
});

test("actor assignments accept UUID-preferred identity and ID-only fallback", () => {
  const withUuid = actor("engineer");
  const idOnly = actor("navigator");
  delete idOnly.operator.uuid;
  const report = analyzeVoyageStationAssignments([withUuid, idOnly]);
  assert.equal(report.valid, true);
  assert.deepEqual(report.assignments, [withUuid, idOnly]);
  assert.notEqual(report.assignments[0], withUuid);
  assert.notEqual(report.assignments[0].operator, withUuid.operator);
});

test("crew-asset assignments use the same plain operator contract", () => {
  const assignment = {
    stationId: "watchmaster",
    operator: {
      kind: "crewAsset",
      id: "lookouts",
      uuid: "Item.lookouts",
      name: "Veteran Lookouts"
    }
  };
  assert.equal(validateVoyageStationAssignments([assignment]).valid, true);
  assert.deepEqual(analyzeVoyageStationAssignments([assignment]).assignments, [assignment]);
});

test("PC and named NPC labels do not change actor-reference behavior", () => {
  const pc = actor("captain", { id: "pc", uuid: "Actor.pc", name: "Player Captain" });
  const npc = actor("captain", { id: "npc", uuid: "Actor.npc", name: "Named NPC Captain" });
  assert.equal(validateVoyageStationAssignments([pc]).valid, true);
  assert.equal(validateVoyageStationAssignments([npc]).valid, true);
  assert.equal(analyzeVoyageStationAssignments([pc]).assignments[0].operator.kind, "actor");
  assert.equal(analyzeVoyageStationAssignments([npc]).assignments[0].operator.kind, "actor");
});

test("duplicate station IDs are rejected deterministically", () => {
  const report = analyzeVoyageStationAssignments([
    actor("engineer", { id: "first", uuid: "Actor.first" }),
    actor("engineer", { id: "second", uuid: "Actor.second" })
  ]);
  assert.equal(report.valid, false);
  assert.deepEqual(codes(report), ["duplicate-station-assignment"]);
  assert.equal(report.errors[0].path, "stationAssignments[1].stationId");
});

test("duplicate operators use kind plus UUID-preferred stable identity", () => {
  const report = analyzeVoyageStationAssignments([
    actor("captain", { id: "shared-id", uuid: "Actor.shared" }),
    actor("veilwarden", { id: "different-id", uuid: "Actor.shared" })
  ]);
  assert.equal(report.valid, false);
  assert.deepEqual(codes(report), ["duplicate-station-operator"]);

  const idOnlyCaptain = actor("captain", { id: "shared-id" });
  const idOnlyEngineer = actor("engineer", { id: "shared-id" });
  delete idOnlyCaptain.operator.uuid;
  delete idOnlyEngineer.operator.uuid;
  assert.ok(codes(analyzeVoyageStationAssignments([
    idOnlyCaptain,
    idOnlyEngineer
  ])).includes("duplicate-station-operator"));

  const mixedFallback = actor("engineer", { id: "shared-id" });
  delete mixedFallback.operator.uuid;
  assert.ok(codes(analyzeVoyageStationAssignments([
    actor("captain", { id: "shared-id", uuid: "Actor.shared-id" }),
    mixedFallback
  ])).includes("duplicate-station-operator"));

  assert.equal(validateVoyageStationAssignments([
    actor("captain", { id: "shared-id", uuid: "Actor.first" }),
    actor("engineer", { id: "shared-id", uuid: "Actor.second" })
  ]).valid, true);

  const differentKinds = [
    actor("captain", { id: "shared", uuid: "Shared.operator" }),
    {
      stationId: "engineer",
      operator: { kind: "crewAsset", id: "shared", uuid: "Shared.operator", name: "Crew" }
    }
  ];
  assert.equal(validateVoyageStationAssignments(differentKinds).valid, true);
});

test("malformed operator identities and kinds are rejected", () => {
  for (const [operator, expectedCode] of [
    [{ kind: "actor", name: "Missing identity" }, "missing-station-operator-identity"],
    [{ kind: "actor", id: "   " }, "invalid-station-operator-id"],
    [{ kind: "actor", uuid: "" }, "invalid-station-operator-uuid"],
    [{ kind: "ship", id: "ship-id" }, "invalid-station-operator-kind"],
    [{ kind: "actor", id: "__proto__" }, "unsafe-station-operator-id"]
  ]) {
    const report = analyzeVoyageStationAssignments([{ stationId: "captain", operator }]);
    assert.equal(report.valid, false);
    assert.ok(codes(report).includes(expectedCode), expectedCode);
  }
});

test("unsupported and repaired station IDs are rejected without affecting broader framework stations", () => {
  for (const stationId of ["pilot", "gunnery", "quartermaster", "Captain", " captain ", "__proto__"]) {
    const report = analyzeVoyageStationAssignments([actor(stationId)]);
    assert.equal(report.valid, false, stationId);
    assert.ok(codes(report).includes("unsupported-event-runner-station-id"), stationId);
  }
});

test("malformed entries, unexpected fields, unsafe keys, and accessors are rejected safely", () => {
  for (const value of [null, "captain", { stationId: "captain" }]) {
    assert.equal(validateVoyageStationAssignments([value]).valid, false);
  }

  const extra = actor("captain");
  extra.ignored = true;
  assert.ok(codes(analyzeVoyageStationAssignments([extra])).includes("unexpected-station-assignment-field"));

  const unsafe = actor("captain");
  Object.defineProperty(unsafe.operator, "__proto__", { value: "hostile", enumerable: true });
  assert.ok(codes(analyzeVoyageStationAssignments([unsafe])).includes("unexpected-station-operator-field"));

  let reads = 0;
  const accessor = actor("captain");
  Object.defineProperty(accessor.operator, "uuid", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const report = analyzeVoyageStationAssignments([accessor]);
  assert.equal(reads, 0);
  assert.ok(codes(report).includes("station-assignment-data-read-failed"));
});

test("inherited array entries are ignored and sparse arrays are preserved deliberately", () => {
  const inherited = actor("captain");
  const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, "1");
  try {
    Object.defineProperty(Array.prototype, "1", { value: inherited, configurable: true, writable: true });
    const source = new Array(3);
    source[2] = actor("navigator");
    const report = analyzeVoyageStationAssignments(source);
    assert.equal(report.valid, true);
    assert.equal(report.assignmentCount, 1);
    assert.equal(report.assignments.length, 3);
    assert.equal(Object.hasOwn(report.assignments, 0), false);
    assert.equal(Object.hasOwn(report.assignments, 1), false);
    assert.equal(Object.hasOwn(report.assignments, 2), true);
    assert.deepEqual(report.occupiedStationIds, ["navigator"]);
  } finally {
    if (descriptor) Object.defineProperty(Array.prototype, "1", descriptor);
    else delete Array.prototype[1];
  }
});

test("occupied station IDs derive only from valid assignments and are fresh arrays", () => {
  const source = [actor("engineer"), actor("veilwarden")];
  const first = deriveOccupiedVoyageStationIds(source);
  const second = deriveOccupiedVoyageStationIds(source);
  assert.deepEqual(first, ["engineer", "veilwarden"]);
  assert.notEqual(first, second);
  first.push("captain");
  assert.deepEqual(second, ["engineer", "veilwarden"]);
  assert.deepEqual(deriveOccupiedVoyageStationIds([actor("pilot")]), []);
});

test("analysis returns fresh isolated arrays and records without mutating source input", () => {
  const source = [actor("engineer")];
  const before = clonePlainData(source);
  const first = analyzeVoyageStationAssignments(source);
  const second = analyzeVoyageStationAssignments(source);
  first.assignments[0].stationId = "captain";
  first.assignments[0].operator.name = "Changed";
  first.occupiedStationIds.push("captain");
  first.errors.push({ code: "changed" });
  assert.deepEqual(source, before);
  assert.deepEqual(second.assignments, before);
  assert.deepEqual(second.occupiedStationIds, ["engineer"]);
  assert.deepEqual(second.errors, []);
});

test("collection-level hostile keys and non-array input are rejected", () => {
  assert.equal(validateVoyageStationAssignments({}).valid, false);
  const source = [];
  Object.defineProperty(source, "__proto__", { value: actor("captain"), enumerable: true });
  assert.ok(codes(analyzeVoyageStationAssignments(source)).includes("unexpected-station-assignment-collection-key"));
});
