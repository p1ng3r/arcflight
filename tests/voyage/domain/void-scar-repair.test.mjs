import assert from "node:assert/strict";
import test from "node:test";

import { analyzeVoyageVoidScarRepair } from "../../../scripts/voyage/domain/void-scar-repair.js";

const SYSTEMS = ["crew-morale", "arkengine", "levstone-array", "solar-sail-rig", "lifeveil"];
const REPAIR_RESULT_FIELDS = ["readyForVoidScarRepair", "shipId", "voidScarId", "repairMethod", "outcome", "costPercent", "timePercent", "removesScar", "errors", "warnings"];
const REQUEST_FIELDS = ["shipId", "expectedShipRevision", "voidScarId", "existingVoidScarIndex", "previousVoidScar", "repairMethod", "outcome", "facilityApproval", "fieldRepairResourceId", "fieldRepairResourceApproval"];
const SCAR_FIELDS = ["voidScarId", "name", "pressureSystemId", "status", "sourceKind", "description", "operationalEffects", "baseRepairCost", "baseRepairTime", "repairDcSource", "eligibleRepairChecks", "requiredFacilities", "compatibleFieldRepairTags", "pressureBreachId", "hazardId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility"];
const NAMES = { "crew-morale": "Crew Morale", arkengine: "Arkengine", "levstone-array": "Levstone Array", "solar-sail-rig": "Solar Sail Rig", lifeveil: "Lifeveil" };

function clone(value) { return structuredClone(value); }

function scar(id, pressureSystemId = "crew-morale", overrides = {}) {
  const pressureBreachId = `repair-breach-${id}`;
  return {
    voidScarId: `arcflight-void-scar:${JSON.stringify(["pressure-breach", pressureBreachId])}`,
    name: `${NAMES[pressureSystemId]} Void Scar`,
    pressureSystemId,
    status: "active",
    sourceKind: "pressure-breach",
    description: `${NAMES[pressureSystemId]} lasting damage.`,
    operationalEffects: [`${pressureSystemId} operations remain impaired until this Scar is repaired.`],
    baseRepairCost: 100,
    baseRepairTime: 1,
    repairDcSource: "very-hard",
    eligibleRepairChecks: ["crafting", "engineering-lore"],
    requiredFacilities: ["drydock"],
    compatibleFieldRepairTags: [`${pressureSystemId}-field-repair`],
    pressureBreachId,
    hazardId: `arcflight-hazard:${JSON.stringify(["pressure-breach", pressureBreachId])}`,
    encounterId: "repair-encounter",
    stageId: "repair-stage",
    roundNumber: 1,
    effectIndex: 0,
    sequence: 0,
    stationId: "captain",
    actionId: "repair-action",
    pressureEffectId: "repair-effect",
    sourceIntentId: null,
    activationSource: null,
    branch: "failure",
    timing: "consequences",
    visibility: "public",
    ...overrides
  };
}

function ship(voidScars = [], overrides = {}) {
  return {
    shipId: "repair-ship",
    revision: 7,
    installed: { hullPlatform: "void-skiff" },
    hull: { voidScarCapacity: 2 },
    voidScars: clone(voidScars),
    ...overrides
  };
}

function request(state, scarValue, overrides = {}) {
  return {
    shipId: state.shipId,
    expectedShipRevision: state.revision,
    voidScarId: scarValue.voidScarId,
    existingVoidScarIndex: state.voidScars.indexOf(scarValue),
    previousVoidScar: clone(scarValue),
    repairMethod: "dock-repair",
    outcome: "success",
    facilityApproval: { approved: true, facilityId: "drydock-1", facilityTag: "drydock" },
    fieldRepairResourceId: null,
    fieldRepairResourceApproval: null,
    ...overrides
  };
}

function pair(system = "crew-morale") {
  const live = scar(system, system);
  const state = ship([live]);
  return { state, live, request: request(state, state.voidScars[0]) };
}

function fieldRequest(state, live, resourceId = "resource-1") {
  return request(state, state.voidScars[0], {
    repairMethod: "field-repair-resource",
    outcome: null,
    facilityApproval: null,
    fieldRepairResourceId: resourceId,
    fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: resourceId, compatibilityTag: `${state.voidScars[0].pressureSystemId}-field-repair` }
  });
}

function assertFailure(result) {
  assert.equal(result.readyForVoidScarRepair, false);
  assert.deepEqual(Object.keys(result), REPAIR_RESULT_FIELDS);
  for (const field of ["shipId", "voidScarId", "repairMethod", "outcome", "costPercent", "timePercent", "removesScar"]) assert.equal(result[field], null, field);
  assert.ok(result.errors.length > 0);
  assert.deepEqual(result.warnings, []);
}

function assertNoRawText(value) {
  const text = JSON.stringify(value).toLowerCase();
  for (const forbidden of ["typeerror", "proxy", "revok", "trap", "stack", "engine"]) assert.equal(text.includes(forbidden), false, forbidden);
}

test("all five canonical systems produce exact Dock Repair analyses and isolated descriptors", () => {
  for (const system of SYSTEMS) {
    const first = pair(system);
    const second = pair(system);
    const before = clone(first);
    const result = analyzeVoyageVoidScarRepair(first.state, first.request);
    const repeat = analyzeVoyageVoidScarRepair(second.state, second.request);
    assert.equal(result.readyForVoidScarRepair, true, system);
    assert.deepEqual(Object.keys(result), REPAIR_RESULT_FIELDS);
    assert.deepEqual(result, repeat);
    assert.equal(result.shipId, first.state.shipId);
    assert.equal(result.voidScarId, first.live.voidScarId);
    assert.equal(result.repairMethod, "dock-repair");
    assert.equal(result.outcome, "success");
    assert.equal(result.costPercent, 75);
    assert.equal(result.timePercent, 75);
    assert.equal(result.removesScar, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(Object.hasOwn(result, "facilityApproval"), false);
    assert.equal(Object.hasOwn(result, "fieldRepairResourceApproval"), false);
    assert.deepEqual(first, before);
    assert.deepEqual(Object.keys(first.live), SCAR_FIELDS);
    assert.deepEqual(first.live.requiredFacilities, ["drydock"]);
    assert.deepEqual(first.live.compatibleFieldRepairTags, [`${system}-field-repair`]);
    result.voidScarId = "mutated";
    assert.equal(first.live.voidScarId, before.live.voidScarId);
  }
});

test("Dock Repair accepts every exact outcome with canonical percentages", () => {
  const cases = [["critical-success", 50, 50], ["success", 75, 75], ["failure", 125, 125], ["critical-failure", 150, 150]];
  for (const [outcome, costPercent, timePercent] of cases) {
    const { state, live, request: base } = pair();
    const result = analyzeVoyageVoidScarRepair(state, { ...base, outcome });
    assert.equal(result.readyForVoidScarRepair, true, outcome);
    assert.equal(result.outcome, outcome);
    assert.equal(result.costPercent, costPercent);
    assert.equal(result.timePercent, timePercent);
    assert.equal(result.removesScar, true);
    assert.equal(result.fieldRepairResourceId, undefined);
    assert.equal(live.status, "active");
  }
});

test("Field Repair Resource preserves exact approval evidence semantics without Dock terms", () => {
  for (const system of SYSTEMS) {
    const { state, live } = pair(system);
    const originalState = clone(state);
    const originalLive = clone(live);
    const repairRequest = fieldRequest(state, live, `resource-${system}`);
    const originalRequest = clone(repairRequest);
    const result = analyzeVoyageVoidScarRepair(state, repairRequest);
    assert.equal(result.readyForVoidScarRepair, true, system);
    assert.equal(result.repairMethod, "field-repair-resource");
    assert.equal(result.outcome, null);
    assert.equal(result.costPercent, null);
    assert.equal(result.timePercent, null);
    assert.equal(result.removesScar, true);
    assert.equal(Object.hasOwn(result, "fieldRepairResourceId"), false);
    assert.deepEqual(state, originalState);
    assert.deepEqual(live, originalLive);
    assert.deepEqual(repairRequest, originalRequest);
  }
});

test("live index, identity, snapshot, and revision binding precede method-specific checks", () => {
  const { state, live, request: base } = pair();
  const cases = [
    ["wrong ship", { shipId: "other" }, "stale-void-scar-repair-ship"],
    ["stale revision", { expectedShipRevision: state.revision - 1 }, "stale-void-scar-repair-ship-revision"],
    ["future revision", { expectedShipRevision: state.revision + 1 }, "stale-void-scar-repair-ship-revision"],
    ["negative index", { existingVoidScarIndex: -1 }, "invalid-void-scar-repair-index"],
    ["out of range", { existingVoidScarIndex: 1 }, "stale-void-scar-repair-index"],
    ["wrong ID", { voidScarId: "other" }, "stale-void-scar-repair-void-scar-id"],
    ["changed snapshot", { previousVoidScar: { ...base.previousVoidScar, description: "changed" }, facilityApproval: { approved: true, facilityId: "x", facilityTag: "not-authored" } }, "stale-void-scar-repair-previous-void-scar"]
  ];
  for (const [label, override, code] of cases) {
    const result = analyzeVoyageVoidScarRepair(state, { ...base, ...override });
    assertFailure(result);
    assert.ok(result.errors.some((entry) => entry.code === code), label);
  }
  const moved = ship([scar("other", "arkengine"), live]);
  const movedRequest = request(moved, moved.voidScars[1], { existingVoidScarIndex: 0 });
  const movedResult = analyzeVoyageVoidScarRepair(moved, movedRequest);
  assertFailure(movedResult);
  assert.ok(movedResult.errors.some(({ code }) => code === "stale-void-scar-repair-void-scar-id"));
});

test("method-specific diagnostics preserve exact null and approval rules", () => {
  const { state, live, request: base } = pair();
  const dockCases = [
    [{ repairMethod: "other" }, "invalid-void-scar-repair-method"],
    [{ fieldRepairResourceId: "resource" }, "unexpected-field-repair-resource-id"],
    [{ fieldRepairResourceApproval: {} }, "unexpected-field-repair-resource-approval"],
    [{ facilityApproval: null }, "missing-repair-facility-approval"],
    [{ facilityApproval: { approved: false, facilityId: "x", facilityTag: "drydock" } }, "invalid-repair-facility-approval"],
    [{ facilityApproval: { approved: true, facilityId: "", facilityTag: "drydock" } }, "invalid-repair-facility-approval"],
    [{ facilityApproval: { approved: true, facilityId: "x", facilityTag: "wrong" } }, "unsuitable-repair-facility"],
    [{ outcome: null }, "invalid-void-scar-repair-outcome"],
    [{ outcome: " Success" }, "invalid-void-scar-repair-outcome"]
  ];
  for (const [override, code] of dockCases) {
    const result = analyzeVoyageVoidScarRepair(state, { ...base, ...override });
    assertFailure(result);
    assert.ok(result.errors.some((entry) => entry.code === code), code);
  }

  const fieldBase = fieldRequest(state, live);
  const fieldCases = [
    [{ outcome: "success" }, "invalid-void-scar-repair-outcome"],
    [{ facilityApproval: { approved: true, facilityId: "x", facilityTag: "drydock" } }, "unexpected-repair-facility-approval"],
    [{ fieldRepairResourceId: null, fieldRepairResourceApproval: null }, "missing-field-repair-resource-id"],
    [{ fieldRepairResourceId: "", fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "", compatibilityTag: "crew-morale-field-repair" } }, "invalid-field-repair-resource-id"],
    [{ fieldRepairResourceApproval: null }, "missing-field-repair-resource-approval"],
    [{ fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "other", compatibilityTag: "crew-morale-field-repair" } }, "field-repair-resource-approval-mismatch"],
    [{ fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "resource-1", compatibilityTag: "wrong" } }, "incompatible-field-repair-resource"]
  ];
  for (const [override, code] of fieldCases) {
    const result = analyzeVoyageVoidScarRepair(state, { ...fieldBase, ...override });
    assertFailure(result);
    assert.ok(result.errors.some((entry) => entry.code === code), code);
  }
});

test("exact request capture, hostile values, determinism, and no extra authority", () => {
  const { state, request: base } = pair();
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, repairMethod: "unknown" }), "invalid-void-scar-repair-method", "request.repairMethod");
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, facilityApproval: null }), "missing-repair-facility-approval", "request.facilityApproval");
  assert.deepEqual(Object.keys(base), REQUEST_FIELDS);
  const malformed = [
    (() => { const value = { ...base }; delete value.outcome; return value; })(),
    (() => { const value = { ...base }; value.outcome = undefined; return value; })(),
    { ...base, extra: true },
    { ...base, expectedShipRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...base, existingVoidScarIndex: Number.MAX_SAFE_INTEGER + 1 },
    { ...base, facilityApproval: { approved: true, facilityId: "x", facilityTag: "drydock", extra: true } },
    { ...base, facilityApproval: [true, "x", "drydock"] },
    { ...base, fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "x", compatibilityTag: "crew-morale-field-repair", extra: true } }
  ];
  for (const candidate of malformed) {
    const result = analyzeVoyageVoidScarRepair(state, candidate);
    assertFailure(result);
    assertNoRawText(result);
  }
  const symbolRequest = clone(base);
  symbolRequest[Symbol("hostile")] = true;
  assertFailure(analyzeVoyageVoidScarRepair(state, symbolRequest));
  assertFailure(analyzeVoyageVoidScarRepair(state, []));

  assert.deepEqual(Object.keys(base.facilityApproval), ["approved", "facilityId", "facilityTag"]);
  assert.deepEqual(Object.keys(fieldRequest(state, state.voidScars[0]).fieldRepairResourceApproval), ["approved", "fieldRepairResourceId", "compatibilityTag"]);

  const hostileFactories = [
    () => { const p = Proxy.revocable(state, {}); p.revoke(); return [p.proxy, base]; },
    () => { const p = Proxy.revocable(base, {}); p.revoke(); return [state, p.proxy]; },
    () => { const requestValue = clone(base); const p = Proxy.revocable(requestValue.previousVoidScar, {}); p.revoke(); requestValue.previousVoidScar = p.proxy; return [state, requestValue]; },
    () => { const requestValue = clone(base); const p = Proxy.revocable(requestValue.facilityApproval, {}); p.revoke(); requestValue.facilityApproval = p.proxy; return [state, requestValue]; },
    () => { const stateValue = clone(state); const p = Proxy.revocable(stateValue.voidScars[0], {}); p.revoke(); stateValue.voidScars[0] = p.proxy; return [stateValue, base]; },
    () => { const stateValue = clone(state); const p = Proxy.revocable(stateValue.voidScars[0].requiredFacilities, {}); p.revoke(); stateValue.voidScars[0].requiredFacilities = p.proxy; return [stateValue, base]; },
    () => { const stateValue = clone(state); const repairRequest = fieldRequest(stateValue, stateValue.voidScars[0]); const p = Proxy.revocable(stateValue.voidScars[0].compatibleFieldRepairTags, {}); p.revoke(); stateValue.voidScars[0].compatibleFieldRepairTags = p.proxy; return [stateValue, repairRequest]; },
    () => { const requestValue = clone(base); Object.defineProperty(requestValue, "shipId", { enumerable: true, get() { throw new Error("getter"); } }); return [state, requestValue]; },
    () => { const requestValue = clone(base); requestValue.previousVoidScar.operationalEffects = new Proxy(requestValue.previousVoidScar.operationalEffects, { ownKeys() { throw new Error("ownKeys"); } }); return [state, requestValue]; },
    () => { const requestValue = clone(base); requestValue.previousVoidScar = new Proxy(requestValue.previousVoidScar, { getOwnPropertyDescriptor() { throw new Error("descriptor"); } }); return [state, requestValue]; }
  ];
  for (const make of hostileFactories) {
    const firstArgs = make();
    const secondArgs = make();
    const first = analyzeVoyageVoidScarRepair(...firstArgs);
    const second = analyzeVoyageVoidScarRepair(...secondArgs);
    assert.deepEqual(first, second);
    assertFailure(first);
    assertNoRawText(first);
  }

  for (const value of [null, 1, "x", true, undefined, 1n, Symbol("x"), [], new Date(), new Map(), new Set(), new Uint8Array([1]), class Hostile {}]) {
    const first = analyzeVoyageVoidScarRepair(state, value);
    const second = analyzeVoyageVoidScarRepair(state, value);
    assert.deepEqual(first, second);
    assertFailure(first);
    assertNoRawText(first);
  }

  const beforeState = clone(state);
  const beforeRequest = clone(base);
  const fabricated = { readyForVoidScarRepair: true, costPercent: 1, timePercent: 1, removesScar: false };
  const result = analyzeVoyageVoidScarRepair(state, base, fabricated);
  assert.equal(result.readyForVoidScarRepair, true);
  assert.equal(result.costPercent, 75);
  assert.equal(result.timePercent, 75);
  assert.equal(result.removesScar, true);
  assert.deepEqual(state, beforeState);
  assert.deepEqual(base, beforeRequest);
  result.errors.push({ code: "mutated" });
  const later = analyzeVoyageVoidScarRepair(state, base);
  assert.deepEqual(later.errors, []);
});

function assertDiagnostic(result, code, path) {
  assertFailure(result);
  const diagnostic = result.errors.find((entry) => entry.code === code);
  assert.ok(diagnostic, `${code} missing from ${JSON.stringify(result.errors)}`);
  assert.equal(diagnostic.path, path);
  assertNoRawText(result);
}

test("repair coverage closes exact diagnostics for revisions, Scar binding, and outcomes", () => {
  const { state, live, request: base } = pair();
  const revisionCases = [
    [{ expectedShipRevision: -1 }, "invalid-void-scar-repair-ship-revision"],
    [{ expectedShipRevision: Number.MAX_SAFE_INTEGER + 1 }, "invalid-void-scar-repair-ship-revision"],
    [{ expectedShipRevision: -1, facilityApproval: { approved: 1, facilityId: "", facilityTag: "wrong" } }, "invalid-void-scar-repair-ship-revision"]
  ];
  for (const [override, code] of revisionCases) {
    const first = analyzeVoyageVoidScarRepair(state, { ...base, ...override });
    const second = analyzeVoyageVoidScarRepair(state, { ...base, ...override });
    assert.deepEqual(first, second);
    assertDiagnostic(first, code, "request.expectedShipRevision");
  }

  const missing = ship([]);
  assertDiagnostic(analyzeVoyageVoidScarRepair(missing, { ...base, shipId: missing.shipId, expectedShipRevision: missing.revision }), "stale-void-scar-repair-index", "request.existingVoidScarIndex");

  const malformed = ship([scar("malformed")]);
  malformed.voidScars[0].status = "active";
  delete malformed.voidScars[0].name;
  assertDiagnostic(analyzeVoyageVoidScarRepair(malformed, request(malformed, malformed.voidScars[0])), "missing-void-scar-field", "shipState.voidScars[0].name");

  const terminal = ship([scar("terminal", "crew-morale", { status: "repaired" })]);
  assertDiagnostic(analyzeVoyageVoidScarRepair(terminal, request(terminal, terminal.voidScars[0])), "invalid-void-scar-status", "shipState.voidScars[0].status");

  const missingOutcome = { ...base };
  delete missingOutcome.outcome;
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, missingOutcome), "invalid-void-scar-repair-request", "request.outcome");
  const outcomeCases = [
    [{ outcome: undefined }, "invalid-void-scar-value"],
    [{ outcome: "UNKNOWN" }, "invalid-void-scar-repair-outcome"],
    [{ outcome: "SUCCESS" }, "invalid-void-scar-repair-outcome"],
    [{ outcome: "Success" }, "invalid-void-scar-repair-outcome"],
    [{ outcome: " success" }, "invalid-void-scar-repair-outcome"],
    [{ outcome: "success " }, "invalid-void-scar-repair-outcome"],
    [{ outcome: "cces" }, "invalid-void-scar-repair-outcome"],
    [{ outcome: "successfully" }, "invalid-void-scar-repair-outcome"]
  ];
  for (const [override, code] of outcomeCases) {
    const candidate = { ...base, ...override };
    const result = analyzeVoyageVoidScarRepair(state, candidate);
    assertDiagnostic(result, code, code === "invalid-void-scar-value" ? "request.outcome" : "request.outcome");
  }
  assert.equal(live.status, "active");
});

test("Dock approval values, shapes, paths, and forbidden Field fields are exact", () => {
  const { state, request: base } = pair();
  const cases = [
    [{ facilityApproval: { approved: false, facilityId: "dock", facilityTag: "drydock" } }, "invalid-repair-facility-approval", "request.facilityApproval.approved"],
    [{ facilityApproval: { approved: 1, facilityId: "dock", facilityTag: "drydock" } }, "invalid-repair-facility-approval", "request.facilityApproval.approved"],
    [{ facilityApproval: { approved: "true", facilityId: "dock", facilityTag: "drydock" } }, "invalid-repair-facility-approval", "request.facilityApproval.approved"],
    [{ facilityApproval: { approved: {}, facilityId: "dock", facilityTag: "drydock" } }, "invalid-repair-facility-approval", "request.facilityApproval.approved"],
    [{ facilityApproval: { approved: true, facilityId: "", facilityTag: "drydock" } }, "invalid-repair-facility-approval", "request.facilityApproval.facilityId"],
    [{ facilityApproval: { approved: true, facilityId: "dock", facilityTag: "" } }, "invalid-repair-facility-approval", "request.facilityApproval.facilityTag"],
    [{ facilityApproval: { approved: true, facilityTag: "drydock" } }, "invalid-repair-facility-approval", "request.facilityApproval.facilityId"],
    [{ facilityApproval: { approved: true, facilityId: "dock", facilityTag: "wrong", extra: true } }, "invalid-repair-facility-approval", "request.facilityApproval.extra"],
    [{ facilityApproval: [true, "dock", "drydock"] }, "invalid-repair-facility-approval", "request.facilityApproval"],
    [{ fieldRepairResourceId: "resource" }, "unexpected-field-repair-resource-id", "request.fieldRepairResourceId"],
    [{ fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "r", compatibilityTag: "x" } }, "unexpected-field-repair-resource-approval", "request.fieldRepairResourceApproval"]
  ];
  for (const [override, code, path] of cases) assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, ...override }), code, path);

  const symbolApproval = { approved: true, facilityId: "dock", facilityTag: "drydock" };
  symbolApproval[Symbol("hostile")] = true;
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, facilityApproval: symbolApproval }), "unexpected-void-scar-symbol", "request.facilityApproval.[symbol]");

  const accessorApproval = { approved: true, facilityId: "dock", facilityTag: "drydock" };
  Object.defineProperty(accessorApproval, "facilityTag", { enumerable: true, get() { throw new Error("getter"); } });
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, facilityApproval: accessorApproval }), "invalid-void-scar-data-property", "request.facilityApproval.facilityTag");

  const ownKeysApproval = new Proxy({ approved: true, facilityId: "dock", facilityTag: "drydock" }, { ownKeys() { throw new Error("ownKeys"); } });
  const ownKeysFirst = analyzeVoyageVoidScarRepair(state, { ...base, facilityApproval: ownKeysApproval });
  const ownKeysSecond = analyzeVoyageVoidScarRepair(state, { ...base, facilityApproval: new Proxy({ approved: true, facilityId: "dock", facilityTag: "drydock" }, { ownKeys() { throw new Error("ownKeys"); } }) });
  assert.deepEqual(ownKeysFirst, ownKeysSecond);
  assertDiagnostic(ownKeysFirst, "void-scar-data-read-failed", "request.facilityApproval");

  const descriptorApproval = new Proxy({ approved: true, facilityId: "dock", facilityTag: "drydock" }, { getOwnPropertyDescriptor() { throw new Error("descriptor"); } });
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, facilityApproval: descriptorApproval }), "void-scar-data-read-failed", "request.facilityApproval.approved");
});

test("Field Resource IDs, approvals, exact compatibility, and paths are exhaustive", () => {
  const { state, live } = pair();
  const base = fieldRequest(state, live);
  const idCases = [
    [{ fieldRepairResourceId: null, fieldRepairResourceApproval: null }, "missing-field-repair-resource-id", "request.fieldRepairResourceId"],
    [{ fieldRepairResourceId: "", fieldRepairResourceApproval: null }, "invalid-field-repair-resource-id", "request.fieldRepairResourceId"],
    [{ fieldRepairResourceId: "   ", fieldRepairResourceApproval: null }, "invalid-field-repair-resource-id", "request.fieldRepairResourceId"],
    [{ fieldRepairResourceId: 1, fieldRepairResourceApproval: null }, "invalid-field-repair-resource-id", "request.fieldRepairResourceId"],
    [{ fieldRepairResourceId: true, fieldRepairResourceApproval: null }, "invalid-field-repair-resource-id", "request.fieldRepairResourceId"],
    [{ fieldRepairResourceId: {}, fieldRepairResourceApproval: null }, "invalid-field-repair-resource-id", "request.fieldRepairResourceId"],
    [{ fieldRepairResourceId: [], fieldRepairResourceApproval: null }, "invalid-field-repair-resource-id", "request.fieldRepairResourceId"],
    [{ fieldRepairResourceId: undefined, fieldRepairResourceApproval: null }, "invalid-void-scar-value", "request.fieldRepairResourceId"],
    [{ fieldRepairResourceId: Symbol("resource"), fieldRepairResourceApproval: null }, "invalid-void-scar-value", "request.fieldRepairResourceId"]
  ];
  for (const [override, code, path] of idCases) assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, ...override }), code, path);

  const approvalCases = [
    [{ approved: false, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.approved"],
    [{ approved: 1, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.approved"],
    [{ approved: "true", fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.approved"],
    [{ approved: {}, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.approved"],
    [{ approved: true, fieldRepairResourceId: "", compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.fieldRepairResourceId"],
    [{ approved: true, fieldRepairResourceId: "resource-1", compatibilityTag: "" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.compatibilityTag"],
    [{ approved: true, compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.fieldRepairResourceId"],
    [{ approved: true, fieldRepairResourceId: "other", compatibilityTag: "crew-morale-field-repair" }, "field-repair-resource-approval-mismatch", "request.fieldRepairResourceApproval.fieldRepairResourceId"],
    [{ approved: true, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair", extra: true }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.extra"],
    [[true, "resource-1", "crew-morale-field-repair"], "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval"]
  ];
  for (const [approval, code, path] of approvalCases) assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, fieldRepairResourceApproval: approval }), code, path);
  const missingApproval = { ...base }; delete missingApproval.fieldRepairResourceApproval;
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, missingApproval), "invalid-void-scar-repair-request", "request.fieldRepairResourceApproval");

  const tags = ["CREW-MORALE-FIELD-REPAIR", "crew-Morale-field-repair", " crew-morale-field-repair", "crew-morale-field-repair ", "crew-morale-field", "crew-morale-field-repair-extra", "other-system-field-repair", "fabricated"];
  for (const compatibilityTag of tags) {
    const result = analyzeVoyageVoidScarRepair(state, { ...base, fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "resource-1", compatibilityTag } });
    assertDiagnostic(result, "incompatible-field-repair-resource", "request.fieldRepairResourceApproval.compatibilityTag");
  }
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, outcome: "success" }), "invalid-void-scar-repair-outcome", "request.outcome");
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, facilityApproval: { approved: true, facilityId: "dock", facilityTag: "drydock" } }), "unexpected-repair-facility-approval", "request.facilityApproval");
  const symbolApproval = { approved: true, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" };
  symbolApproval[Symbol("hostile")] = true;
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, fieldRepairResourceApproval: symbolApproval }), "unexpected-void-scar-symbol", "request.fieldRepairResourceApproval.[symbol]");
  const sparseApproval = new Array(3);
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, fieldRepairResourceApproval: sparseApproval }), "invalid-void-scar-array", "request.fieldRepairResourceApproval");
  const resourceAccessor = { approved: true, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" };
  Object.defineProperty(resourceAccessor, "compatibilityTag", { enumerable: true, get() { throw new Error("getter"); } });
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...base, fieldRepairResourceApproval: resourceAccessor }), "invalid-void-scar-data-property", "request.fieldRepairResourceApproval.compatibilityTag");
});

test("cycles, hostile arrays, revoked approvals, and precedence remain fail-closed", () => {
  const { state, live, request: dock } = pair();
  const field = fieldRequest(state, live);
  const cyclicRequest = { ...dock, previousVoidScar: clone(dock.previousVoidScar) };
  cyclicRequest.previousVoidScar.cycle = cyclicRequest.previousVoidScar;
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, cyclicRequest), "cyclic-void-scar-data", "request.previousVoidScar.cycle");
  const cyclicRoot = { ...dock };
  cyclicRoot.cycle = cyclicRoot;
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, cyclicRoot), "cyclic-void-scar-data", "request.cycle");

  const cyclicFacility = { approved: true, facilityId: "dock", facilityTag: "drydock" };
  cyclicFacility.cycle = cyclicFacility;
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...dock, facilityApproval: cyclicFacility }), "cyclic-void-scar-data", "request.facilityApproval.cycle");

  const cyclicResource = { approved: true, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" };
  cyclicResource.cycle = cyclicResource;
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, { ...field, fieldRepairResourceApproval: cyclicResource }), "cyclic-void-scar-data", "request.fieldRepairResourceApproval.cycle");

  const sparseRequest = { ...dock, previousVoidScar: new Array(1) };
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, sparseRequest), "invalid-void-scar-array", "request.previousVoidScar");
  const sparseFacility = { ...dock, facilityApproval: new Array(3) };
  assertDiagnostic(analyzeVoyageVoidScarRepair(state, sparseFacility), "invalid-void-scar-array", "request.facilityApproval");

  for (const [field, path] of [["requiredFacilities", "shipState.voidScars[0].requiredFacilities"], ["compatibleFieldRepairTags", "shipState.voidScars[0].compatibleFieldRepairTags"], ["operationalEffects", "shipState.voidScars[0].operationalEffects"]]) {
    const sparseState = clone(state);
    sparseState.voidScars[0][field] = new Array(1);
    assertDiagnostic(analyzeVoyageVoidScarRepair(sparseState, dock), "invalid-void-scar-array", path);
    const extraState = clone(state);
    extraState.voidScars[0][field].extra = true;
    assertDiagnostic(analyzeVoyageVoidScarRepair(extraState, dock), "invalid-void-scar-array", path);
  }
  const cyclicDescriptor = clone(state);
  cyclicDescriptor.voidScars[0].operationalEffects.push(cyclicDescriptor.voidScars[0]);
  assertDiagnostic(analyzeVoyageVoidScarRepair(cyclicDescriptor, dock), "cyclic-void-scar-data", "shipState.voidScars[0].operationalEffects[1]");

  const hostileFactories = [
    () => { const p = Proxy.revocable(state, {}); p.revoke(); return [p.proxy, dock]; },
    () => { const p = Proxy.revocable(dock, {}); p.revoke(); return [state, p.proxy]; },
    () => { const candidate = clone(dock); const p = Proxy.revocable(candidate.previousVoidScar, {}); p.revoke(); candidate.previousVoidScar = p.proxy; return [state, candidate]; },
    () => { const candidate = clone(dock); const p = Proxy.revocable(candidate.facilityApproval, {}); p.revoke(); candidate.facilityApproval = p.proxy; return [state, candidate]; },
    () => { const candidate = clone(field); const p = Proxy.revocable(candidate.fieldRepairResourceApproval, {}); p.revoke(); candidate.fieldRepairResourceApproval = p.proxy; return [state, candidate]; },
    () => { const candidateState = clone(state); const p = Proxy.revocable(candidateState.voidScars[0], {}); p.revoke(); candidateState.voidScars[0] = p.proxy; return [candidateState, dock]; },
    () => { const candidateState = clone(state); const candidate = fieldRequest(candidateState, candidateState.voidScars[0]); const p = Proxy.revocable(candidateState.voidScars[0].requiredFacilities, {}); p.revoke(); candidateState.voidScars[0].requiredFacilities = p.proxy; return [candidateState, candidate]; },
    () => { const candidateState = clone(state); const candidate = fieldRequest(candidateState, candidateState.voidScars[0]); const p = Proxy.revocable(candidateState.voidScars[0].compatibleFieldRepairTags, {}); p.revoke(); candidateState.voidScars[0].compatibleFieldRepairTags = p.proxy; return [candidateState, candidate]; }
  ];
  for (const make of hostileFactories) {
    const first = analyzeVoyageVoidScarRepair(...make());
    const second = analyzeVoyageVoidScarRepair(...make());
    assert.deepEqual(first, second);
    assertFailure(first);
    assertNoRawText(first);
  }

  const precedenceDock = analyzeVoyageVoidScarRepair(state, { ...dock, fieldRepairResourceId: "forbidden", fieldRepairResourceApproval: {}, facilityApproval: { approved: true, facilityId: "dock", facilityTag: "wrong" }, outcome: "UNKNOWN" });
  assertDiagnostic(precedenceDock, "unexpected-field-repair-resource-id", "request.fieldRepairResourceId");
  const precedenceField = analyzeVoyageVoidScarRepair(state, { ...field, outcome: "success", facilityApproval: {}, fieldRepairResourceId: "", fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "other", compatibilityTag: "wrong" } });
  assertDiagnostic(precedenceField, "invalid-void-scar-repair-outcome", "request.outcome");
  const wrongShip = analyzeVoyageVoidScarRepair(state, { ...field, shipId: "other", fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "resource-1", compatibilityTag: "wrong" } });
  assertDiagnostic(wrongShip, "stale-void-scar-repair-ship", "request.shipId");
});
