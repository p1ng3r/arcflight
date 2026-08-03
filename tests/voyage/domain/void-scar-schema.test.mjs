import assert from "node:assert/strict";
import test from "node:test";

import {
  captureVoyageVoidScarRecord,
  validateVoyageVoidScarRecord,
  VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID,
  VOYAGE_VOID_SCAR_RECORD_FIELDS,
  VOYAGE_VOID_SCAR_STATUSES,
  VOYAGE_VOID_SCAR_SOURCE_KINDS
} from "../../../scripts/voyage/domain/void-scar-schema.js";
import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../../../scripts/voyage/domain/constants.js";

function scar(overrides = {}) {
  const pressureBreachId = overrides.pressureBreachId ?? "breach-1";
  const pressureSystemId = overrides.pressureSystemId ?? "crew-morale";
  return {
    voidScarId: `arcflight-void-scar:${JSON.stringify(["pressure-breach", pressureBreachId])}`,
    name: VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID[pressureSystemId] ?? "Crew Morale Void Scar",
    pressureSystemId,
    status: VOYAGE_VOID_SCAR_STATUSES.ACTIVE,
    sourceKind: VOYAGE_VOID_SCAR_SOURCE_KINDS.PRESSURE_BREACH,
    description: "A persistent impairment affecting ship operation.",
    operationalEffects: ["The affected system imposes its authored operational restriction."],
    baseRepairCost: 100,
    baseRepairTime: 2,
    repairDcSource: "very-hard",
    eligibleRepairChecks: ["crafting", "engineering-lore"],
    requiredFacilities: ["drydock"],
    compatibleFieldRepairTags: [pressureSystemId],
    pressureBreachId,
    hazardId: "hazard-1",
    encounterId: "encounter-1",
    stageId: "stage-1",
    roundNumber: 1,
    effectIndex: 0,
    sequence: 0,
    stationId: "captain",
    actionId: "action-1",
    pressureEffectId: "pressure-effect-1",
    sourceIntentId: null,
    activationSource: null,
    branch: "failure",
    timing: "consequences",
    visibility: "public",
    ...overrides,
    voidScarId: overrides.voidScarId ?? `arcflight-void-scar:${JSON.stringify(["pressure-breach", pressureBreachId])}`
  };
}

function assertNoRawReflectionText(value) {
  assert.doesNotMatch(JSON.stringify(value), /TypeError|Proxy|revok|trap|stack|engine/i);
}

function assertInvalid(value, code) {
  const result = validateVoyageVoidScarRecord(value);
  assert.equal(result.valid, false);
  if (code) assert.ok(result.errors.some((entry) => entry.code === code), JSON.stringify(result.errors));
  return result;
}

test("exports the exact canonical Void Scar field order and five-system names", () => {
  assert.deepEqual(VOYAGE_VOID_SCAR_RECORD_FIELDS, [
    "voidScarId", "name", "pressureSystemId", "status", "sourceKind", "description",
    "operationalEffects", "baseRepairCost", "baseRepairTime", "repairDcSource",
    "eligibleRepairChecks", "requiredFacilities", "compatibleFieldRepairTags",
    "pressureBreachId", "hazardId", "encounterId", "stageId", "roundNumber", "effectIndex",
    "sequence", "stationId", "actionId", "pressureEffectId", "sourceIntentId",
    "activationSource", "branch", "timing", "visibility"
  ]);
  assert.deepEqual(VOYAGE_PRESSURE_SYSTEM_IDS, ["crew-morale", "arkengine", "levstone-array", "solar-sail-rig", "lifeveil"]);
  assert.deepEqual(Object.values(VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID), [
    "Crew Morale Void Scar", "Arkengine Void Scar", "Levstone Array Void Scar",
    "Solar Sail Rig Void Scar", "Lifeveil Void Scar"
  ]);
});

test("validates and captures a canonical active Void Scar", () => {
  const source = scar();
  const validation = validateVoyageVoidScarRecord(source);
  assert.deepEqual(validation, { valid: true, errors: [], warnings: [] });
  const captured = captureVoyageVoidScarRecord(source);
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));
  assert.deepEqual(Object.keys(captured.record), VOYAGE_VOID_SCAR_RECORD_FIELDS);
  assert.notStrictEqual(captured.record, source);
  assert.notStrictEqual(captured.record.operationalEffects, source.operationalEffects);
});

test("captures are deeply isolated and independent across calls", () => {
  const source = scar();
  const first = captureVoyageVoidScarRecord(source);
  source.operationalEffects[0] = "changed source";
  first.record.operationalEffects[0] = "changed capture";
  const second = captureVoyageVoidScarRecord(source);
  assert.equal(second.ok, true);
  assert.equal(second.record.operationalEffects[0], "changed source");
  assert.equal(first.record.operationalEffects[0], "changed capture");
});

test("rejects unknown, missing, reordered, and malformed canonical fields", () => {
  const unknown = scar(); unknown.extra = true; assertInvalid(unknown, "unexpected-void-scar-field");
  const missing = scar(); delete missing.description; assertInvalid(missing, "missing-void-scar-field");
  const reordered = { name: "Crew Morale Void Scar", ...scar() }; assertInvalid(reordered, "invalid-void-scar-key-order");
  assertInvalid(scar({ voidScarId: "other" }), "invalid-void-scar-id");
  assertInvalid(scar({ name: "Wrong Name" }), "invalid-void-scar-name");
  assertInvalid(scar({ pressureSystemId: "unknown" }), "invalid-void-scar-pressure-system");
  assertInvalid(scar({ status: "repaired" }), "invalid-void-scar-status");
  assertInvalid(scar({ sourceKind: "other" }), "invalid-void-scar-source-kind");
  assertInvalid(scar({ description: "" }), "invalid-void-scar-description");
  assertInvalid(scar({ operationalEffects: "effect" }), "invalid-void-scar-array");
  assertInvalid(scar({ eligibleRepairChecks: [""] }), "invalid-void-scar-descriptor");
  assertInvalid(scar({ baseRepairCost: -1 }), "invalid-void-scar-descriptor");
});

test("rejects invalid provenance, unsafe numbers, and option mismatches", () => {
  for (const [field, value] of [["pressureBreachId", ""], ["hazardId", null], ["encounterId", ""], ["stageId", ""], ["stationId", ""], ["actionId", ""], ["pressureEffectId", ""]]) {
    assertInvalid(scar({ [field]: value }), `invalid-void-scar-${field}`);
  }
  assertInvalid(scar({ roundNumber: -1 }), "invalid-void-scar-roundNumber");
  assertInvalid(scar({ effectIndex: Number.MAX_SAFE_INTEGER + 1 }), "invalid-void-scar-effectIndex");
  assertInvalid(scar({ sequence: Infinity }), "invalid-void-scar-number");
  assert.equal(validateVoyageVoidScarRecord(scar(), { expectedEncounterId: "other" }).valid, false);
  assert.equal(validateVoyageVoidScarRecord(scar(), { expectedPressureSystemId: "lifeveil" }).valid, false);
  assert.equal(validateVoyageVoidScarRecord(scar(), { expectedPressureBreachId: "other" }).valid, false);
});

test("rejects sparse arrays, extra array properties, symbols, unsafe keys, accessors, cycles, and non-plain objects", () => {
  const sparse = scar({ operationalEffects: [] }); sparse.operationalEffects = new Array(1); assert.equal(assertInvalid(sparse).valid, false);
  const extra = scar(); extra.operationalEffects.extra = true; assertInvalid(extra, "invalid-void-scar-array");
  const symbolKey = scar(); symbolKey[Symbol("hostile")] = true; assertInvalid(symbolKey, "unexpected-void-scar-symbol");
  const unsafe = scar(); Object.defineProperty(unsafe, "__proto__", { value: {}, enumerable: true }); assertInvalid(unsafe, "unsafe-void-scar-key");
  const accessor = scar(); Object.defineProperty(accessor, "description", { get: () => "bad", enumerable: true }); assertInvalid(accessor, "invalid-void-scar-data-property");
  const throwing = scar(); Object.defineProperty(throwing, "description", { get: () => { throw new Error("secret getter"); }, enumerable: true }); const throwingResult = assertInvalid(throwing); assertNoRawReflectionText(throwingResult);
  const cyclic = scar(); cyclic.operationalEffects.push(cyclic); assertInvalid(cyclic, "cyclic-void-scar-data");
  assertInvalid(scar({ baseRepairCost: new Date() }), "invalid-void-scar-object");
});

test("revoked roots, nested values, and options fail closed deterministically", () => {
  const run = (api, value, options) => {
    let result;
    assert.doesNotThrow(() => { result = api(value, options); });
    assertNoRawReflectionText(result);
    return result;
  };
  const rootTarget = scar(); const root = Proxy.revocable(rootTarget, {}); root.revoke();
  const secondRootProxy = Proxy.revocable(scar(), {}); secondRootProxy.revoke();
  const firstRoot = run(validateVoyageVoidScarRecord, root.proxy); const secondRoot = run(validateVoyageVoidScarRecord, secondRootProxy.proxy);
  assert.equal(firstRoot.valid, false); assert.deepEqual(firstRoot, secondRoot);

  for (const field of ["operationalEffects", "baseRepairCost", "baseRepairTime", "repairDcSource", "eligibleRepairChecks", "requiredFacilities", "compatibleFieldRepairTags"]) {
    const source = scar();
    const target = field.includes("Effects") || field.includes("Checks") || field.includes("Facilities") || field.includes("Tags") ? [] : {};
    const revoked = Proxy.revocable(target, {}); source[field] = revoked.proxy; revoked.revoke();
    const validation = run(validateVoyageVoidScarRecord, source);
    const capture = run(captureVoyageVoidScarRecord, source);
    assert.equal(validation.valid, false, field); assert.equal(capture.ok, false, field); assert.equal(capture.record, null, field);
  }

  const optionTarget = {}; const options = Proxy.revocable(optionTarget, {}); options.revoke();
  const optionResult = run(validateVoyageVoidScarRecord, scar(), options.proxy);
  assert.equal(optionResult.valid, false);
  const secondOptions = Proxy.revocable({}, {}); secondOptions.revoke();
  assert.deepEqual(optionResult, run(validateVoyageVoidScarRecord, scar(), secondOptions.proxy));
});

test("does not mutate source input or retain hostile references on failure", () => {
  const source = scar(); const before = structuredClone(source);
  const captured = captureVoyageVoidScarRecord(source);
  assert.equal(captured.ok, true);
  assert.deepEqual(source, before);
  source.description = "changed";
  assert.equal(captured.record.description, "A persistent impairment affecting ship operation.");
});
