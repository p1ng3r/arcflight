import assert from "node:assert/strict";
import test from "node:test";

import {
  captureVoyageShipState,
  getVoyageHullVoidScarCapacity,
  validateVoyageShipState,
  VOYAGE_HULL_VOID_SCAR_CAPACITY_BY_PLATFORM,
  VOYAGE_SHIP_HULL_FIELDS,
  VOYAGE_SHIP_INSTALLED_FIELDS,
  VOYAGE_SHIP_STATE_FIELDS
} from "../../../scripts/voyage/domain/ship-state.js";
import { VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID } from "../../../scripts/voyage/domain/void-scar-schema.js";

const CAPACITIES = {
  "void-skiff": 2,
  sloop: 3,
  cutter: 4,
  brigantine: 5,
  frigate: 6,
  galleon: 7,
  hammerhead: 7,
  arkcruiser: 9,
  "dread-caravel": 9,
  "cathedral-ship": 10,
  "leviathan-class-platform": 12
};

function scar(index = 0, pressureSystemId = "crew-morale") {
  const pressureBreachId = `breach-${index + 1}`;
  return {
    voidScarId: `arcflight-void-scar:${JSON.stringify(["pressure-breach", pressureBreachId])}`,
    name: VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID[pressureSystemId],
    pressureSystemId,
    status: "active",
    sourceKind: "pressure-breach",
    description: "A persistent impairment affecting ship operation.",
    operationalEffects: ["The affected system imposes its authored operational restriction."],
    baseRepairCost: 100,
    baseRepairTime: 2,
    repairDcSource: "very-hard",
    eligibleRepairChecks: ["crafting", "engineering-lore"],
    requiredFacilities: ["drydock"],
    compatibleFieldRepairTags: [pressureSystemId],
    pressureBreachId,
    hazardId: `hazard-${index + 1}`,
    encounterId: "encounter-1",
    stageId: "stage-1",
    roundNumber: 1,
    effectIndex: index,
    sequence: index,
    stationId: "captain",
    actionId: "action-1",
    pressureEffectId: `pressure-effect-${index + 1}`,
    sourceIntentId: null,
    activationSource: null,
    branch: "failure",
    timing: "consequences",
    visibility: "public"
  };
}

function m10Scar(index = 0, pressureSystemId = "crew-morale") {
  const source = {
    eventId: "event-1",
    sessionId: "session-1",
    definitionSnapshotId: "definition-1",
    misfortuneId: `misfortune-${index + 1}`,
    voidScarDefinitionId: `scar-definition-${index + 1}`
  };
  return {
    schemaVersion: 2,
    voidScarId: `arcflight-void-scar:${JSON.stringify([
      "m8-critical-overall-failure", source.eventId, source.sessionId,
      source.definitionSnapshotId, source.misfortuneId, source.voidScarDefinitionId, pressureSystemId
    ])}`,
    name: "Authored closeout Scar",
    pressureSystemId,
    status: "active",
    sourceKind: "m8-critical-overall-failure",
    description: "A closeout Scar.",
    operationalEffects: ["The system remains impaired."],
    baseRepairCost: 100,
    baseRepairTime: 1,
    repairDcSource: "very-hard",
    eligibleRepairChecks: ["crafting"],
    requiredFacilities: ["drydock"],
    compatibleFieldRepairTags: ["field"],
    source
  };
}

function state(platform = "void-skiff", voidScars = []) {
  return {
    shipId: "ship-1",
    revision: 0,
    installed: { hullPlatform: platform },
    hull: { voidScarCapacity: CAPACITIES[platform] },
    voidScars
  };
}

function assertNoRawReflectionText(value) {
  assert.doesNotMatch(JSON.stringify(value), /TypeError|Proxy|revok|trap|stack|engine/i);
}

test("exports exact ship-state field order and canonical capacities", () => {
  assert.deepEqual(VOYAGE_SHIP_STATE_FIELDS, ["shipId", "revision", "installed", "hull", "voidScars"]);
  assert.deepEqual(VOYAGE_SHIP_INSTALLED_FIELDS, ["hullPlatform"]);
  assert.deepEqual(VOYAGE_SHIP_HULL_FIELDS, ["voidScarCapacity"]);
  assert.deepEqual(VOYAGE_HULL_VOID_SCAR_CAPACITY_BY_PLATFORM, CAPACITIES);
  for (const [platform, capacity] of Object.entries(CAPACITIES)) assert.equal(getVoyageHullVoidScarCapacity(platform), capacity);
  assert.equal(getVoyageHullVoidScarCapacity("unknown"), null);
});

test("validates an empty ship state for every canonical hull platform", () => {
  for (const platform of Object.keys(CAPACITIES)) {
    const result = validateVoyageShipState(state(platform));
    assert.deepEqual(result, { valid: true, errors: [], warnings: [] }, platform);
  }
});

test("accepts one Scar and a ship exactly at capacity", () => {
  assert.equal(validateVoyageShipState(state("brigantine", [scar()])).valid, true);
  const full = Array.from({ length: CAPACITIES.frigate }, (_, index) => scar(index));
  assert.equal(validateVoyageShipState(state("frigate", full)).valid, true);
});

test("accepts the durable M7/M10 Scar union, counts both variants once, and rejects duplicate IDs or overflow", () => {
  const v1 = scar(0, "crew-morale");
  const v2 = m10Scar(0, "arkengine");
  const mixed = state("cutter", [v1, v2]);
  const mixedValidation = validateVoyageShipState(mixed);
  assert.equal(mixedValidation.valid, true, JSON.stringify(mixedValidation.errors));
  assert.equal(mixed.voidScars.length, 2);
  assert.equal(Object.hasOwn(mixed.voidScars[0], "schemaVersion"), false);
  assert.equal(mixed.voidScars[1].schemaVersion, 2);

  const duplicate = state("cutter", [v2, m10Scar(0, "arkengine")]);
  assert.ok(validateVoyageShipState(duplicate).errors.some((entry) => entry.code === "duplicate-void-scar-id"));

  const overflow = state("void-skiff", [scar(0), m10Scar(0, "arkengine"), m10Scar(1, "levstone-array")]);
  assert.ok(validateVoyageShipState(overflow).errors.some((entry) => entry.code === "void-scar-capacity-exceeded"));
});

test("captures exact state shape with deep caller and cross-call isolation", () => {
  const source = state("cutter", [scar()]);
  const first = captureVoyageShipState(source);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  assert.deepEqual(Object.keys(first.state), VOYAGE_SHIP_STATE_FIELDS);
  assert.deepEqual(Object.keys(first.state.installed), VOYAGE_SHIP_INSTALLED_FIELDS);
  assert.deepEqual(Object.keys(first.state.hull), VOYAGE_SHIP_HULL_FIELDS);
  source.voidScars[0].description = "changed source";
  first.state.voidScars[0].description = "changed capture";
  const second = captureVoyageShipState(source);
  assert.equal(second.ok, true);
  assert.equal(second.state.voidScars[0].description, "changed source");
  assert.equal(first.state.voidScars[0].description, "changed capture");
});

test("rejects invalid identity, revision, platform, and authored capacity", () => {
  assert.equal(validateVoyageShipState(state("void-skiff", [])).valid, true);
  for (const [field, value, code] of [["shipId", "", "invalid-ship-id"], ["revision", -1, "invalid-ship-revision"], ["revision", Number.MAX_SAFE_INTEGER + 1, "invalid-ship-revision"]]) {
    const candidate = state(); candidate[field] = value;
    const result = validateVoyageShipState(candidate);
    assert.ok(result.errors.some((entry) => entry.code === code), JSON.stringify(result.errors));
  }
  const unknownPlatform = state(); unknownPlatform.installed.hullPlatform = "unknown";
  assert.ok(validateVoyageShipState(unknownPlatform).errors.some((entry) => entry.code === "unknown-hull-platform"));
  for (const capacity of [1, 3, 0, -1, Number.MAX_SAFE_INTEGER + 1]) {
    const candidate = state(); candidate.hull.voidScarCapacity = capacity;
    assert.equal(validateVoyageShipState(candidate).valid, false, String(capacity));
  }
  const below = state(); below.hull.voidScarCapacity = 1;
  assert.ok(validateVoyageShipState(below).errors.some((entry) => entry.code === "void-scar-capacity-mismatch"));
  const above = state(); above.hull.voidScarCapacity = 3;
  assert.ok(validateVoyageShipState(above).errors.some((entry) => entry.code === "void-scar-capacity-mismatch"));
});

test("rejects unknown nested fields, malformed collections, duplicate IDs, and capacity overflow", () => {
  const root = state(); root.extra = true; assert.ok(validateVoyageShipState(root).errors.some((entry) => entry.code === "unexpected-ship-state-field"));
  const installed = state(); installed.installed.extra = true; assert.ok(validateVoyageShipState(installed).errors.some((entry) => entry.code === "unexpected-ship-installed-field"));
  const hull = state(); hull.hull.extra = true; assert.ok(validateVoyageShipState(hull).errors.some((entry) => entry.code === "unexpected-ship-hull-field"));
  const malformed = state(); malformed.voidScars = {}; assert.ok(validateVoyageShipState(malformed).errors.some((entry) => entry.code === "invalid-ship-void-scars"));
  const duplicate = state("cutter", [scar(0), scar(0)]); assert.ok(validateVoyageShipState(duplicate).errors.some((entry) => entry.code === "duplicate-void-scar-id"));
  const overflow = state("void-skiff", [scar(0), scar(1), scar(2)]); assert.ok(validateVoyageShipState(overflow).errors.some((entry) => entry.code === "void-scar-capacity-exceeded"));
  const sparse = state(); sparse.voidScars = new Array(1); assert.ok(validateVoyageShipState(sparse).errors.length > 0);
  const extraArray = state(); extraArray.voidScars.extra = true; assert.ok(validateVoyageShipState(extraArray).errors.length > 0);
});

test("contains accessors, cycles, symbols, unsafe keys, and revoked proxies", () => {
  const accessor = state(); Object.defineProperty(accessor, "shipId", { get: () => "hostile", enumerable: true }); assert.equal(validateVoyageShipState(accessor).valid, false);
  const cycle = state(); cycle.voidScars.push(cycle); assert.equal(validateVoyageShipState(cycle).valid, false);
  const symbol = state(); symbol[Symbol("hostile")] = true; assert.equal(validateVoyageShipState(symbol).valid, false);
  const unsafe = state(); Object.defineProperty(unsafe, "__proto__", { value: {}, enumerable: true }); assert.equal(validateVoyageShipState(unsafe).valid, false);
  const revokedRoot = Proxy.revocable(state(), {}); revokedRoot.revoke();
  let revokedRootResult;
  assert.doesNotThrow(() => { revokedRootResult = validateVoyageShipState(revokedRoot.proxy); });
  assert.equal(revokedRootResult.valid, false);
  assertNoRawReflectionText(revokedRootResult);
  const cases = [
    ["installed", state(), (source) => { const proxy = Proxy.revocable(source.installed, {}); source.installed = proxy.proxy; return proxy; }],
    ["hull", state(), (source) => { const proxy = Proxy.revocable(source.hull, {}); source.hull = proxy.proxy; return proxy; }],
    ["voidScars", state(), (source) => { const proxy = Proxy.revocable(source.voidScars, {}); source.voidScars = proxy.proxy; return proxy; }],
    ["scar", state("void-skiff", [scar()]), (source) => { const proxy = Proxy.revocable(source.voidScars[0], {}); source.voidScars[0] = proxy.proxy; return proxy; }]
  ];
  for (const [label, source, make] of cases) {
    const revoked = make(source); revoked.revoke();
    let result;
    assert.doesNotThrow(() => { result = validateVoyageShipState(source); }, label);
    assert.equal(result.valid, false, label);
    assertNoRawReflectionText(result);
    let capture;
    assert.doesNotThrow(() => { capture = captureVoyageShipState(source); }, label);
    assert.equal(capture.ok, false, label);
    assert.equal(capture.state, null, label);
    assertNoRawReflectionText(capture);
  }
});

test("nested invalid Scars produce no partial ship capture and deterministic failures", () => {
  const invalid = state("cutter", [scar({ status: "repaired" })]);
  const first = captureVoyageShipState(invalid);
  const second = captureVoyageShipState(invalid);
  assert.equal(first.ok, false);
  assert.equal(first.state, null);
  assert.deepEqual(first, second);
  assertNoRawReflectionText(first);
});
