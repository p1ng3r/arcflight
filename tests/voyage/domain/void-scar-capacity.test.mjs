import assert from "node:assert/strict";
import test from "node:test";

import { CORE_HULL_PLATFORM_KEYS } from "../../../data/hulls/core-hulls.js";
import { VOYAGE_HULL_VOID_SCAR_CAPACITY_BY_PLATFORM } from "../../../scripts/voyage/domain/ship-state.js";
import { analyzeVoyageVoidScarCapacity } from "../../../scripts/voyage/domain/void-scar-capacity.js";
import { validateVoyageShipState } from "../../../scripts/voyage/domain/ship-state.js";

const RESULT_FIELDS = ["ok", "shipId", "hullPlatform", "voidScarCapacity", "activeVoidScarCount", "availableSlots", "capacityExhausted", "canAcceptVoidScar", "errors", "warnings"];
const SCAR_FIELDS = ["voidScarId", "name", "pressureSystemId", "status", "sourceKind", "description", "operationalEffects", "baseRepairCost", "baseRepairTime", "repairDcSource", "eligibleRepairChecks", "requiredFacilities", "compatibleFieldRepairTags", "pressureBreachId", "hazardId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility"];

function scar(id, system = "crew-morale") {
  const pressureBreachId = `breach-${id}`;
  const names = { "crew-morale": "Crew Morale", arkengine: "Arkengine", "levstone-array": "Levstone Array", "solar-sail-rig": "Solar Sail Rig", lifeveil: "Lifeveil" };
  return {
    voidScarId: `arcflight-void-scar:${JSON.stringify(["pressure-breach", pressureBreachId])}`,
    name: `${names[system]} Void Scar`, pressureSystemId: system, status: "active", sourceKind: "pressure-breach",
    description: "lasting damage", operationalEffects: ["impaired"], baseRepairCost: 100, baseRepairTime: 1,
    repairDcSource: "very-hard", eligibleRepairChecks: ["crafting"], requiredFacilities: ["drydock"], compatibleFieldRepairTags: ["field"],
    pressureBreachId, hazardId: `hazard-${id}`, encounterId: "encounter", stageId: "stage", roundNumber: 1, effectIndex: 0,
    sequence: 0, stationId: "captain", actionId: "action", pressureEffectId: `effect-${id}`, sourceIntentId: null,
    activationSource: "branch", branch: "failure", timing: "consequences", visibility: "public"
  };
}

function m10Scar(id, system = "crew-morale") {
  const source = {
    eventId: "event-1",
    sessionId: "session-1",
    definitionSnapshotId: "definition-1",
    misfortuneId: `misfortune-${id}`,
    voidScarDefinitionId: `scar-definition-${id}`
  };
  return {
    schemaVersion: 2,
    voidScarId: `arcflight-void-scar:${JSON.stringify([
      "m8-critical-overall-failure", source.eventId, source.sessionId,
      source.definitionSnapshotId, source.misfortuneId, source.voidScarDefinitionId, system
    ])}`,
    name: "Authored closeout Scar",
    pressureSystemId: system,
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

function ship(platform = "void-skiff", voidScars = [], overrides = {}) {
  return {
    shipId: "capacity-ship",
    revision: 3,
    installed: { hullPlatform: platform },
    hull: { voidScarCapacity: VOYAGE_HULL_VOID_SCAR_CAPACITY_BY_PLATFORM[platform] },
    voidScars: structuredClone(voidScars),
    ...overrides
  };
}

function assertFailure(result) {
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result), RESULT_FIELDS);
  for (const field of ["shipId", "hullPlatform", "voidScarCapacity", "activeVoidScarCount", "availableSlots", "capacityExhausted", "canAcceptVoidScar"]) assert.equal(result[field], null, field);
  assert.ok(result.errors.length > 0);
  assert.deepEqual(result.warnings, []);
}

function assertNoRawText(result) {
  const text = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["typeerror", "proxy", "revok", "trap", "stack", "engine"]) assert.equal(text.includes(forbidden), false, forbidden);
}

test("all eleven canonical hulls produce exact deterministic empty-capacity metrics", () => {
  for (const platform of CORE_HULL_PLATFORM_KEYS) {
    const firstState = ship(platform);
    const secondState = ship(platform);
    const first = analyzeVoyageVoidScarCapacity(firstState);
    const second = analyzeVoyageVoidScarCapacity(secondState);
    assert.deepEqual(Object.keys(first), RESULT_FIELDS);
    assert.deepEqual(first, second);
    assert.equal(first.ok, true);
    assert.equal(first.shipId, "capacity-ship");
    assert.equal(first.hullPlatform, platform);
    assert.equal(first.voidScarCapacity, VOYAGE_HULL_VOID_SCAR_CAPACITY_BY_PLATFORM[platform]);
    assert.equal(first.activeVoidScarCount, 0);
    assert.equal(first.availableSlots, first.voidScarCapacity);
    assert.equal(first.capacityExhausted, false);
    assert.equal(first.canAcceptVoidScar, true);
    assert.deepEqual(first.errors, []);
    assert.deepEqual(first.warnings, []);
    assert.deepEqual(firstState, secondState);
  }
});

test("active counts, one-slot boundary, and exact exhaustion are valid and pure", () => {
  const one = ship("void-skiff", [scar("one")]);
  const oneBefore = structuredClone(one);
  const oneResult = analyzeVoyageVoidScarCapacity(one);
  assert.equal(oneResult.availableSlots, 1);
  assert.equal(oneResult.capacityExhausted, false);
  assert.equal(oneResult.canAcceptVoidScar, true);
  assert.deepEqual(one, oneBefore);

  const multiple = ship("sloop", [scar("one"), scar("two", "arkengine")]);
  const multipleResult = analyzeVoyageVoidScarCapacity(multiple);
  assert.equal(multipleResult.activeVoidScarCount, 2);
  assert.equal(multipleResult.availableSlots, 1);

  const full = ship("void-skiff", [scar("one"), scar("two", "arkengine")]);
  const fullBefore = structuredClone(full);
  const fullResult = analyzeVoyageVoidScarCapacity(full);
  assert.deepEqual(Object.keys(fullResult), RESULT_FIELDS);
  assert.equal(fullResult.ok, true);
  assert.equal(fullResult.activeVoidScarCount, 2);
  assert.equal(fullResult.availableSlots, 0);
  assert.equal(fullResult.capacityExhausted, true);
  assert.equal(fullResult.canAcceptVoidScar, false);
  assert.deepEqual(fullResult.errors, []);
  assert.deepEqual(fullResult.warnings, []);
  assert.deepEqual(full, fullBefore);
  fullResult.errors.push({ code: "mutated" });
  const later = analyzeVoyageVoidScarCapacity(full);
  assert.deepEqual(later.errors, []);
});

test("counts the durable M7/M10 Scar union exactly once at capacity boundaries", () => {
  const mixed = ship("void-skiff", [scar("one"), m10Scar("two", "arkengine")]);
  const result = analyzeVoyageVoidScarCapacity(mixed);
  assert.equal(result.ok, true);
  assert.equal(result.voidScarCapacity, 2);
  assert.equal(result.activeVoidScarCount, 2);
  assert.equal(result.availableSlots, 0);
  assert.equal(result.capacityExhausted, true);
  assert.equal(result.canAcceptVoidScar, false);

  const withOneSlot = analyzeVoyageVoidScarCapacity(ship("void-skiff", [m10Scar("one")]));
  assert.equal(withOneSlot.activeVoidScarCount, 1);
  assert.equal(withOneSlot.availableSlots, 1);
  assert.equal(withOneSlot.canAcceptVoidScar, true);

  const duplicate = analyzeVoyageVoidScarCapacity(ship("void-skiff", [m10Scar("one"), m10Scar("one")]));
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.errors[0].code, "duplicate-void-scar-id");
});

test("invalid ship states preserve ship-state diagnostics with null capacity metrics", () => {
  const invalidStates = [
    ship("unknown-platform", [], { hull: { voidScarCapacity: 2 } }),
    ship("void-skiff", [], { hull: { voidScarCapacity: 1 } }),
    ship("void-skiff", [], { hull: { voidScarCapacity: 3 } }),
    ship("void-skiff", [scar("duplicate"), scar("duplicate")]),
    ship("void-skiff", [scar("one"), scar("two"), scar("three")]),
    ship("void-skiff", [null]),
    ship("void-skiff", [], { revision: Number.MAX_SAFE_INTEGER + 1 }),
    ship("void-skiff", [], { hull: { voidScarCapacity: Number.MAX_SAFE_INTEGER + 1 } }),
    ship("void-skiff", [], { voidScars: new Array(1) })
  ];
  for (const state of invalidStates) {
    const expected = validateVoyageShipState(state);
    const result = analyzeVoyageVoidScarCapacity(state);
    assertFailure(result);
    assert.deepEqual(result.errors, expected.errors);
    assert.deepEqual(result.warnings, expected.warnings);
    assertNoRawText(result);
  }
});

test("hostile reflection paths fail closed deterministically without retaining input", () => {
  const base = ship("void-skiff", [scar("one")]);
  const factories = [
    () => { const p = Proxy.revocable(base, {}); p.revoke(); return p.proxy; },
    () => { const s = structuredClone(base); const p = Proxy.revocable(s.installed, {}); p.revoke(); s.installed = p.proxy; return s; },
    () => { const s = structuredClone(base); const p = Proxy.revocable(s.hull, {}); p.revoke(); s.hull = p.proxy; return s; },
    () => { const s = structuredClone(base); const p = Proxy.revocable(s.voidScars, {}); p.revoke(); s.voidScars = p.proxy; return s; },
    () => { const s = structuredClone(base); const p = Proxy.revocable(s.voidScars[0], {}); p.revoke(); s.voidScars[0] = p.proxy; return s; },
    () => { const s = structuredClone(base); const p = Proxy.revocable(s.voidScars[0].operationalEffects, {}); p.revoke(); s.voidScars[0].operationalEffects = p.proxy; return s; },
    () => { const s = structuredClone(base); Object.defineProperty(s, "shipId", { enumerable: true, get() { throw new Error("getter"); } }); return s; },
    () => new Proxy(structuredClone(base), { ownKeys() { throw new Error("ownKeys"); } }),
    () => { const s = structuredClone(base); s.voidScars[0].cycle = s.voidScars[0]; return s; },
    () => { const s = structuredClone(base); s.voidScars = new Array(1); return s; },
    () => { const s = structuredClone(base); s.voidScars.extra = true; return s; },
    () => { const s = structuredClone(base); s[Symbol("hostile")] = true; return s; },
    () => { const s = structuredClone(base); s["__proto__"] = { hostile: true }; return s; }
  ];
  for (const make of factories) {
    const first = analyzeVoyageVoidScarCapacity(make());
    const second = analyzeVoyageVoidScarCapacity(make());
    assert.deepEqual(first, second);
    assertFailure(first);
    assertNoRawText(first);
  }
  for (const value of [null, 1, "x", true, () => {}, 1n, Symbol("x"), undefined, new Date(), new Map(), new Set(), new Uint8Array([1]), class Value {}]) {
    const result = analyzeVoyageVoidScarCapacity(value);
    assertFailure(result);
    assertNoRawText(result);
  }
});

test("result and diagnostics are isolated across calls and do not expose Scar references", () => {
  const state = ship("sloop", [scar("one")]);
  const first = analyzeVoyageVoidScarCapacity(state);
  const second = analyzeVoyageVoidScarCapacity(state);
  first.errors.push({ code: "mutated" });
  first.warnings.push({ code: "mutated" });
  assert.notEqual(first.errors, second.errors);
  assert.notEqual(first.warnings, second.warnings);
  assert.deepEqual(second.errors, []);
  assert.deepEqual(second.warnings, []);
  assert.equal(Object.hasOwn(first, "nextState"), false);
  assert.equal(Object.hasOwn(first, "events"), false);
  assert.deepEqual(Object.keys(state.voidScars[0]), SCAR_FIELDS);
});
