import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeVoyageVoidScarRepair,
  applyVoyageVoidScarRepair
} from "../../../scripts/voyage/domain/void-scar-repair.js";

const SYSTEMS = ["crew-morale", "arkengine", "levstone-array", "solar-sail-rig", "lifeveil"];
const REPAIR_RESULT_FIELDS = ["readyForVoidScarRepair", "shipId", "voidScarId", "repairMethod", "outcome", "costPercent", "timePercent", "removesScar", "errors", "warnings"];
const APPLICATION_RESULT_FIELDS = ["ok", "nextState", "events", "errors", "warnings"];
const APPLICATION_EVENT_FIELDS = ["type", "shipId", "voidScarId", "pressureSystemId", "repairMethod", "outcome", "costPercent", "timePercent", "fieldRepairResourceId", "previousShipRevision", "revision", "previousVoidScar", "previousVoidScarCount", "voidScarCount"];
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

function switchingProxy(first, second, { throwOnSecondCapture = false } = {}) {
  let captures = 0;
  const proxy = new Proxy({}, {
    ownKeys() {
      captures += 1;
      if (captures > 1 && throwOnSecondCapture) throw new Error("second raw capture");
      return Reflect.ownKeys(captures === 1 ? first : second);
    },
    getOwnPropertyDescriptor(_target, key) {
      const descriptor = Object.getOwnPropertyDescriptor(captures === 1 ? first : second, key);
      return descriptor ? { ...descriptor } : undefined;
    }
  });
  return { proxy, get captures() { return captures; } };
}

function assertFailure(result) {
  assert.equal(result.readyForVoidScarRepair, false);
  assert.deepEqual(Object.keys(result), REPAIR_RESULT_FIELDS);
  for (const field of ["shipId", "voidScarId", "repairMethod", "outcome", "costPercent", "timePercent", "removesScar"]) assert.equal(result[field], null, field);
  assert.ok(result.errors.length > 0);
  assert.deepEqual(result.warnings, []);
}

function assertApplicationFailure(result) {
  assert.deepEqual(Object.keys(result), APPLICATION_RESULT_FIELDS);
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.ok(result.errors.length > 0);
  assert.deepEqual(result.warnings, []);
}

function assertApplicationSuccess(result) {
  assert.deepEqual(Object.keys(result), APPLICATION_RESULT_FIELDS);
  assert.equal(result.ok, true);
  assert.equal(result.nextState !== null, true);
  assert.equal(result.events.length, 1);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
}

function assertApplicationDiagnostic(result, code, path) {
  assertApplicationFailure(result);
  const diagnostic = result.errors.find((entry) => entry.code === code);
  assert.ok(diagnostic, `${code} missing from ${JSON.stringify(result.errors)}`);
  if (path) assert.equal(diagnostic.path, path);
  assertNoRawText(result);
}

function assertNoRawText(value) {
  const text = JSON.stringify(value).toLowerCase();
  for (const forbidden of ["typeerror", "proxy", "revok", "trap", "stack", "engine"]) assert.equal(text.includes(forbidden), false, forbidden);
}

function assertNoRawExceptionText(value) {
  const text = JSON.stringify(value).toLowerCase();
  for (const forbidden of ["typeerror", "proxy", "revok", "trap", "stack", "second raw capture"]) assert.equal(text.includes(forbidden), false, forbidden);
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

test("application removes one live Scar for every system and Dock outcome", () => {
  const outcomes = [
    ["critical-success", 50, 50],
    ["success", 75, 75],
    ["failure", 125, 125],
    ["critical-failure", 150, 150]
  ];
  for (const system of SYSTEMS) {
    for (const [outcome, costPercent, timePercent] of outcomes) {
      const { state, live, request: base } = pair(system);
      const before = clone(state);
      const result = applyVoyageVoidScarRepair(state, { ...base, outcome });
      assertApplicationSuccess(result);
      assert.deepEqual(Object.keys(result.nextState), ["shipId", "revision", "installed", "hull", "voidScars"]);
      assert.deepEqual(result.nextState.voidScars, []);
      assert.equal(result.nextState.revision, before.revision + 1);
      assert.equal(result.nextState.shipId, before.shipId);
      assert.deepEqual(result.nextState.installed, before.installed);
      assert.deepEqual(result.nextState.hull, before.hull);
      assert.deepEqual(Object.keys(result.events[0]), APPLICATION_EVENT_FIELDS);
      assert.deepEqual(result.events[0], {
        type: "voyage.void-scar-repaired",
        shipId: before.shipId,
        voidScarId: live.voidScarId,
        pressureSystemId: system,
        repairMethod: "dock-repair",
        outcome,
        costPercent,
        timePercent,
        fieldRepairResourceId: null,
        previousShipRevision: before.revision,
        revision: before.revision + 1,
        previousVoidScar: before.voidScars[0],
        previousVoidScarCount: 1,
        voidScarCount: 0
      });
      assert.deepEqual(state, before);
      assert.equal(live.status, "active");
    }
  }
});

test("application preserves Scar order, snapshots, state shape, and exact counts at every index", () => {
  const scars = [scar("first", "crew-morale"), scar("middle", "arkengine"), scar("last", "lifeveil")];
  for (const index of [0, 1, 2]) {
    const state = ship(scars, { installed: { hullPlatform: "sloop" }, hull: { voidScarCapacity: 3 } });
    const target = state.voidScars[index];
    const repairRequest = request(state, target, { existingVoidScarIndex: index });
    const before = clone(state);
    const result = applyVoyageVoidScarRepair(state, repairRequest);
    assertApplicationSuccess(result);
    assert.deepEqual(result.nextState.voidScars, before.voidScars.filter((_, position) => position !== index));
    assert.deepEqual(result.events[0].previousVoidScar, before.voidScars[index]);
    assert.equal(result.events[0].previousVoidScarCount, 3);
    assert.equal(result.events[0].voidScarCount, 2);
    assert.equal(result.events[0].previousShipRevision, before.revision);
    assert.equal(result.events[0].revision, before.revision + 1);
    assert.deepEqual(state, before);
  }

  const one = pair();
  const oneBefore = clone(one.state);
  const oneResult = applyVoyageVoidScarRepair(one.state, one.request);
  assertApplicationSuccess(oneResult);
  assert.deepEqual(oneResult.nextState.voidScars, []);
  assert.equal(oneResult.nextState.voidScars.length, 0);
  assert.deepEqual(one.state, oneBefore);
});

test("Field Repair Resource application removes the Scar with exact null terms", () => {
  const { state, live } = pair("solar-sail-rig");
  const repairRequest = fieldRequest(state, live, "resource-solar");
  const before = clone(state);
  const requestBefore = clone(repairRequest);
  const result = applyVoyageVoidScarRepair(state, repairRequest);
  assertApplicationSuccess(result);
  assert.deepEqual(result.nextState.voidScars, []);
  assert.deepEqual(result.events[0], {
    type: "voyage.void-scar-repaired",
    shipId: before.shipId,
    voidScarId: before.voidScars[0].voidScarId,
    pressureSystemId: "solar-sail-rig",
    repairMethod: "field-repair-resource",
    outcome: null,
    costPercent: null,
    timePercent: null,
    fieldRepairResourceId: "resource-solar",
    previousShipRevision: before.revision,
    revision: before.revision + 1,
    previousVoidScar: before.voidScars[0],
    previousVoidScarCount: 1,
    voidScarCount: 0
  });
  assert.deepEqual(state, before);
  assert.deepEqual(repairRequest, requestBefore);
});

test("Field Repair application uses one stable capture for a toggling request Proxy", () => {
  const first = pair();
  const second = pair();
  const firstRequest = fieldRequest(first.state, first.live, "resource-a");
  const secondRequest = fieldRequest(second.state, second.live, "resource-b");
  const request = switchingProxy(firstRequest, secondRequest);
  const stateBefore = clone(first.state);

  const result = applyVoyageVoidScarRepair(first.state, request.proxy);

  assertApplicationSuccess(result);
  assert.equal(request.captures, 1);
  assert.deepEqual(first.state, stateBefore);
  assert.equal(result.events[0].fieldRepairResourceId, "resource-a");
  assert.equal(result.nextState.voidScars.length, 0);
  assert.equal(result.nextState.revision, stateBefore.revision + 1);
  assert.equal(result.events.length, 1);
  assertNoRawExceptionText(result);

  const fresh = pair();
  const freshRequest = switchingProxy(
    fieldRequest(fresh.state, fresh.live, "resource-a"),
    fieldRequest(fresh.state, fresh.live, "resource-b")
  );
  assert.deepEqual(result, applyVoyageVoidScarRepair(fresh.state, freshRequest.proxy));
});

test("Field Repair application never performs a second raw request capture", () => {
  const { state, live } = pair();
  const request = switchingProxy(
    fieldRequest(state, live, "resource-a"),
    fieldRequest(state, live, "resource-b"),
    { throwOnSecondCapture: true }
  );

  const result = applyVoyageVoidScarRepair(state, request.proxy);

  assertApplicationSuccess(result);
  assert.equal(request.captures, 1);
  assert.equal(result.events[0].fieldRepairResourceId, "resource-a");
  assertNoRawExceptionText(result);
});

test("application is isolated, deterministic, authoritative, and rejects repeated repair", () => {
  const { state, request: repairRequest } = pair();
  const beforeState = clone(state);
  const beforeRequest = clone(repairRequest);
  const fabricated = {
    readyForVoidScarRepair: true,
    nextState: { revision: 999 },
    events: [{ type: "forged" }],
    costPercent: 0,
    timePercent: 0,
    removesScar: false
  };
  const first = applyVoyageVoidScarRepair(state, repairRequest, fabricated);
  const secondPair = pair();
  const second = applyVoyageVoidScarRepair(secondPair.state, secondPair.request);
  assertApplicationSuccess(first);
  assert.deepEqual(first, second);
  assert.deepEqual(state, beforeState);
  assert.deepEqual(repairRequest, beforeRequest);
  first.events[0].previousVoidScar.name = "event mutation";
  assert.notEqual(first.events[0].previousVoidScar.name, first.nextState.voidScars[0]?.name);
  const laterPair = pair();
  const later = applyVoyageVoidScarRepair(laterPair.state, laterPair.request);
  assert.deepEqual(later, second);
  const repeated = applyVoyageVoidScarRepair(first.nextState, repairRequest);
  assertApplicationFailure(repeated);
  assert.ok(repeated.errors.some(({ code }) => code === "stale-void-scar-repair-ship-revision"));
  const rewritten = request(first.nextState, first.events[0].previousVoidScar, { existingVoidScarIndex: 0 });
  const rewrittenResult = applyVoyageVoidScarRepair(first.nextState, rewritten);
  assertApplicationFailure(rewrittenResult);
  assert.ok(rewrittenResult.errors.some(({ code }) => code === "stale-void-scar-repair-index"));
});

test("application failures are atomic for malformed, stale, overflow, and hostile inputs", () => {
  const { state, request: base } = pair();
  const cases = [
    { request: { ...base, shipId: "other" }, code: "stale-void-scar-repair-ship" },
    { request: { ...base, expectedShipRevision: base.expectedShipRevision - 1 }, code: "stale-void-scar-repair-ship-revision" },
    { request: { ...base, expectedShipRevision: base.expectedShipRevision + 1 }, code: "stale-void-scar-repair-ship-revision" },
    { request: { ...base, existingVoidScarIndex: -1 }, code: "invalid-void-scar-repair-index" },
    { request: { ...base, existingVoidScarIndex: 1 }, code: "stale-void-scar-repair-index" },
    { request: { ...base, voidScarId: "wrong" }, code: "stale-void-scar-repair-void-scar-id" },
    { request: { ...base, previousVoidScar: { ...base.previousVoidScar, name: "altered" } }, code: "stale-void-scar-repair-previous-void-scar" },
    { request: { ...base, repairMethod: "unknown" }, code: "invalid-void-scar-repair-method" },
    { request: { ...base, facilityApproval: { approved: false, facilityId: "dock", facilityTag: "drydock" } }, code: "invalid-repair-facility-approval" },
    { request: { ...base, outcome: "unknown" }, code: "invalid-void-scar-repair-outcome" },
    { request: { ...base, fieldRepairResourceId: "resource" }, code: "unexpected-field-repair-resource-id" },
    { request: (() => { const value = { ...base }; delete value.outcome; return value; })(), code: "invalid-void-scar-repair-request" },
    { request: { ...base, expectedShipRevision: -1 }, code: "invalid-void-scar-repair-ship-revision" },
    { request: { ...base, expectedShipRevision: Number.NaN }, code: "invalid-void-scar-number" },
    { request: { ...base, expectedShipRevision: Number.POSITIVE_INFINITY }, code: "invalid-void-scar-number" },
    { request: { ...base, expectedShipRevision: Number.NEGATIVE_INFINITY }, code: "invalid-void-scar-number" }
  ];
  for (const { request: candidate, code } of cases) {
    const before = clone(state);
    const result = applyVoyageVoidScarRepair(state, candidate);
    assertApplicationFailure(result);
    assert.ok(result.errors.some(({ code: actualCode }) => actualCode === code), `${code} missing`);
    if (candidate.expectedShipRevision === -1 || !Number.isFinite(candidate.expectedShipRevision)) {
      assert.equal(result.errors[0].path, "request.expectedShipRevision");
    }
    assert.deepEqual(state, before);
    assertNoRawText(result);
  }

  const overflow = ship([scar("overflow")], { revision: Number.MAX_SAFE_INTEGER });
  const overflowRequest = request(overflow, overflow.voidScars[0]);
  const overflowBefore = clone(overflow);
  const overflowResult = applyVoyageVoidScarRepair(overflow, overflowRequest);
  assertApplicationFailure(overflowResult);
  assert.ok(overflowResult.errors.some(({ code }) => code === "invalid-ship-revision"));
  assert.deepEqual(overflow, overflowBefore);

  const hostileFactories = [
    () => { const p = Proxy.revocable(state, {}); p.revoke(); return [p.proxy, base]; },
    () => { const p = Proxy.revocable(base, {}); p.revoke(); return [state, p.proxy]; },
    () => { const candidate = clone(base); const p = Proxy.revocable(candidate.previousVoidScar, {}); p.revoke(); candidate.previousVoidScar = p.proxy; return [state, candidate]; },
    () => { const candidate = clone(base); const p = Proxy.revocable(candidate.facilityApproval, {}); p.revoke(); candidate.facilityApproval = p.proxy; return [state, candidate]; },
    () => { const candidate = fieldRequest(state, state.voidScars[0]); const p = Proxy.revocable(candidate.fieldRepairResourceApproval, {}); p.revoke(); candidate.fieldRepairResourceApproval = p.proxy; return [state, candidate]; },
    () => { const candidateState = clone(state); const p = Proxy.revocable(candidateState.voidScars[0], {}); p.revoke(); candidateState.voidScars[0] = p.proxy; return [candidateState, base]; },
    () => { const candidateState = clone(state); const p = Proxy.revocable(candidateState.voidScars[0].requiredFacilities, {}); p.revoke(); candidateState.voidScars[0].requiredFacilities = p.proxy; return [candidateState, base]; },
    () => { const candidateState = clone(state); const p = Proxy.revocable(candidateState.voidScars[0].compatibleFieldRepairTags, {}); p.revoke(); candidateState.voidScars[0].compatibleFieldRepairTags = p.proxy; return [candidateState, base]; },
    () => { const candidateState = clone(state); const p = Proxy.revocable(candidateState.voidScars[0].operationalEffects, {}); p.revoke(); candidateState.voidScars[0].operationalEffects = p.proxy; return [candidateState, base]; },
    () => { const candidateState = clone(state); const p = Proxy.revocable(candidateState.voidScars[0].eligibleRepairChecks, {}); p.revoke(); candidateState.voidScars[0].eligibleRepairChecks = p.proxy; return [candidateState, base]; },
    () => { const candidate = clone(base); candidate.previousVoidScar.cycle = candidate.previousVoidScar; return [state, candidate]; },
    () => { const candidate = clone(base); candidate.previousVoidScar = new Array(1); return [state, candidate]; }
  ];
  for (const hostile of [null, 1, "x", true, undefined, 1n, Symbol("hostile"), [], new Date(), new Map(), new Set(), new Uint8Array([1]), class Hostile {}]) {
    const result = applyVoyageVoidScarRepair(state, hostile);
    assertApplicationFailure(result);
    assertNoRawText(result);
  }
  for (const make of hostileFactories) {
    const first = applyVoyageVoidScarRepair(...make());
    const second = applyVoyageVoidScarRepair(...make());
    assert.deepEqual(first, second);
    assertApplicationFailure(first);
    assertNoRawText(first);
  }
});

test("application preserves Task 4 diagnostic precedence across method-specific and hostile boundaries", () => {
  const { state, request: dock } = pair();
  const field = fieldRequest(state, state.voidScars[0]);
  const malformedState = clone(state);
  delete malformedState.voidScars[0].name;
  const inactiveState = clone(state);
  inactiveState.voidScars[0].status = "repaired";
  const cases = [
    [malformedState, dock, "missing-void-scar-field"],
    [inactiveState, request(inactiveState, inactiveState.voidScars[0]), "invalid-void-scar-status"],
    [state, { ...dock, expectedShipRevision: Number.MAX_SAFE_INTEGER + 1 }, "invalid-void-scar-repair-ship-revision"],
    [state, { ...dock, existingVoidScarIndex: Number.MAX_SAFE_INTEGER + 1 }, "invalid-void-scar-repair-index"],
    [state, { ...dock, facilityApproval: { approved: true, facilityId: "dock", facilityTag: "wrong" } }, "unsuitable-repair-facility"],
    [state, { ...dock, facilityApproval: { approved: true, facilityId: "dock", facilityTag: "drydock" }, fieldRepairResourceApproval: {} }, "unexpected-field-repair-resource-approval"],
    [state, { ...field, outcome: "success" }, "invalid-void-scar-repair-outcome"],
    [state, { ...field, facilityApproval: { approved: true, facilityId: "dock", facilityTag: "drydock" } }, "unexpected-repair-facility-approval"],
    [state, { ...field, fieldRepairResourceId: "", fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "", compatibilityTag: "crew-morale-field-repair" } }, "invalid-field-repair-resource-id"],
    [state, { ...field, fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "other", compatibilityTag: "crew-morale-field-repair" } }, "field-repair-resource-approval-mismatch"],
    [state, { ...field, fieldRepairResourceApproval: { approved: true, fieldRepairResourceId: "resource-1", compatibilityTag: "wrong" } }, "incompatible-field-repair-resource"],
    [state, { ...dock, facilityApproval: { approved: true, facilityId: "dock", facilityTag: "drydock", extra: true } }, "invalid-repair-facility-approval"],
    [state, { ...dock, fieldRepairResourceId: "resource", fieldRepairResourceApproval: null }, "unexpected-field-repair-resource-id"]
  ];
  for (const [candidateState, candidateRequest, code] of cases) {
    const result = applyVoyageVoidScarRepair(candidateState, candidateRequest);
    assertApplicationFailure(result);
    assert.ok(result.errors.some(({ code: actualCode }) => actualCode === code), `${code} missing`);
    assertNoRawText(result);
  }

  const symbolRequest = clone(dock);
  symbolRequest[Symbol("hostile")] = true;
  const symbolResult = applyVoyageVoidScarRepair(state, symbolRequest);
  assertApplicationFailure(symbolResult);
  assert.ok(symbolResult.errors.some(({ code }) => code === "unexpected-void-scar-symbol"));

  const unsafePrevious = { ...dock.previousVoidScar };
  Object.defineProperty(unsafePrevious, "__proto__", { value: "hostile", enumerable: true, writable: true, configurable: true });
  const unsafeRequest = { ...dock, previousVoidScar: unsafePrevious };
  const unsafeResult = applyVoyageVoidScarRepair(state, unsafeRequest);
  assertApplicationFailure(unsafeResult);
  assert.ok(unsafeResult.errors.some(({ code }) => code === "unsafe-void-scar-key"));

  const twoScarState = ship([scar("survivor-a"), scar("survivor-b")]);
  const twoScarRequest = request(twoScarState, twoScarState.voidScars[0]);
  const revokedSurvivorState = clone(twoScarState);
  const survivorProxy = Proxy.revocable(revokedSurvivorState.voidScars[1], {});
  survivorProxy.revoke();
  revokedSurvivorState.voidScars[1] = survivorProxy.proxy;
  const revokedSurvivorResult = applyVoyageVoidScarRepair(revokedSurvivorState, twoScarRequest);
  assertApplicationFailure(revokedSurvivorResult);
  assertNoRawText(revokedSurvivorResult);

  const nestedProxyState = clone(state);
  nestedProxyState.voidScars[0].operationalEffects = new Proxy(nestedProxyState.voidScars[0].operationalEffects, { ownKeys() { throw new Error("hostile ownKeys"); } });
  const nestedProxyResult = applyVoyageVoidScarRepair(nestedProxyState, dock);
  assertApplicationFailure(nestedProxyResult);
  assertNoRawText(nestedProxyResult);
});

test("application propagates the complete Field Repair approval failure matrix", () => {
  const cases = [
    [{ approved: false, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.approved"],
    [{ approved: 1, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.approved"],
    [{ approved: "true", fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.approved"],
    [{ approved: {}, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.approved"],
    [null, "missing-field-repair-resource-approval", "request.fieldRepairResourceApproval"],
    [1, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval"],
    [[], "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval"],
    [new Array(3), "invalid-void-scar-array", "request.fieldRepairResourceApproval"],
    [new Date(), "invalid-void-scar-object", "request.fieldRepairResourceApproval"],
    [new Map(), "invalid-void-scar-object", "request.fieldRepairResourceApproval"],
    [class Hostile {}, "invalid-void-scar-value", "request.fieldRepairResourceApproval"],
    [{ approved: true, fieldRepairResourceId: "", compatibilityTag: "crew-morale-field-repair" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.fieldRepairResourceId"],
    [{ approved: true, fieldRepairResourceId: "resource-1", compatibilityTag: "" }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.compatibilityTag"],
    [{ approved: true, fieldRepairResourceId: "other", compatibilityTag: "crew-morale-field-repair" }, "field-repair-resource-approval-mismatch", "request.fieldRepairResourceApproval.fieldRepairResourceId"],
    [{ approved: true, fieldRepairResourceId: "resource-1", compatibilityTag: "crew-morale-field-repair", extra: true }, "invalid-field-repair-resource-approval", "request.fieldRepairResourceApproval.extra"]
  ];
  function equivalentApproval(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof Map) return new Map(value);
    if (typeof value === "function") return class EquivalentHostile {};
    if (Array.isArray(value)) {
      const copy = new Array(value.length);
      for (const key of Object.keys(value)) copy[key] = value[key];
      return copy;
    }
    return structuredClone(value);
  }
  for (const [approval, code, path] of cases) {
    const firstPair = pair();
    const firstRequest = fieldRequest(firstPair.state, firstPair.state.voidScars[0]);
    firstRequest.fieldRepairResourceApproval = approval;
    const secondPair = pair();
    const secondRequest = fieldRequest(secondPair.state, secondPair.state.voidScars[0]);
    secondRequest.fieldRepairResourceApproval = equivalentApproval(approval);
    const first = applyVoyageVoidScarRepair(firstPair.state, firstRequest);
    const second = applyVoyageVoidScarRepair(secondPair.state, secondRequest);
    assert.deepEqual(first, second);
    assertApplicationDiagnostic(first, code, path);
    assert.deepEqual(firstPair.state, pair().state);
  }

  const symbolFactory = () => {
    const { state } = pair();
    const requestValue = fieldRequest(state, state.voidScars[0]);
    requestValue.fieldRepairResourceApproval[Symbol("hostile")] = true;
    return [state, requestValue];
  };
  const symbolFirst = symbolFactory();
  const symbolSecond = symbolFactory();
  const symbolResult = applyVoyageVoidScarRepair(...symbolFirst);
  assert.deepEqual(symbolResult, applyVoyageVoidScarRepair(...symbolSecond));
  assertApplicationDiagnostic(symbolResult, "unexpected-void-scar-symbol", "request.fieldRepairResourceApproval.[symbol]");

  const accessorFactory = () => {
    const { state } = pair();
    const requestValue = fieldRequest(state, state.voidScars[0]);
    Object.defineProperty(requestValue.fieldRepairResourceApproval, "compatibilityTag", { enumerable: true, get() { return "crew-morale-field-repair"; } });
    return [state, requestValue];
  };
  const accessorFirst = accessorFactory();
  const accessorSecond = accessorFactory();
  const accessorResult = applyVoyageVoidScarRepair(...accessorFirst);
  assert.deepEqual(accessorResult, applyVoyageVoidScarRepair(...accessorSecond));
  assertApplicationDiagnostic(accessorResult, "invalid-void-scar-data-property", "request.fieldRepairResourceApproval.compatibilityTag");

  const throwingGetterFactory = () => {
    const { state } = pair();
    const requestValue = fieldRequest(state, state.voidScars[0]);
    Object.defineProperty(requestValue.fieldRepairResourceApproval, "compatibilityTag", { enumerable: true, get() { throw new Error("getter"); } });
    return [state, requestValue];
  };
  const throwingGetterFirst = throwingGetterFactory();
  const throwingGetterSecond = throwingGetterFactory();
  const throwingGetterResult = applyVoyageVoidScarRepair(...throwingGetterFirst);
  assert.deepEqual(throwingGetterResult, applyVoyageVoidScarRepair(...throwingGetterSecond));
  assertApplicationDiagnostic(throwingGetterResult, "invalid-void-scar-data-property", "request.fieldRepairResourceApproval.compatibilityTag");

  const ownKeysFactory = () => {
    const { state } = pair();
    const requestValue = fieldRequest(state, state.voidScars[0]);
    requestValue.fieldRepairResourceApproval = new Proxy(requestValue.fieldRepairResourceApproval, { ownKeys() { throw new Error("ownKeys"); } });
    return [state, requestValue];
  };
  const ownKeysFirst = ownKeysFactory();
  const ownKeysSecond = ownKeysFactory();
  const ownKeysResult = applyVoyageVoidScarRepair(...ownKeysFirst);
  assert.deepEqual(ownKeysResult, applyVoyageVoidScarRepair(...ownKeysSecond));
  assertApplicationDiagnostic(ownKeysResult, "void-scar-data-read-failed", "request.fieldRepairResourceApproval");

  const descriptorFactory = () => {
    const { state } = pair();
    const requestValue = fieldRequest(state, state.voidScars[0]);
    requestValue.fieldRepairResourceApproval = new Proxy(requestValue.fieldRepairResourceApproval, { getOwnPropertyDescriptor() { throw new Error("descriptor"); } });
    return [state, requestValue];
  };
  const descriptorFirst = descriptorFactory();
  const descriptorSecond = descriptorFactory();
  const descriptorResult = applyVoyageVoidScarRepair(...descriptorFirst);
  assert.deepEqual(descriptorResult, applyVoyageVoidScarRepair(...descriptorSecond));
  assertApplicationDiagnostic(descriptorResult, "void-scar-data-read-failed", "request.fieldRepairResourceApproval.approved");

  const revokedFactory = () => {
    const { state } = pair();
    const requestValue = fieldRequest(state, state.voidScars[0]);
    const revocable = Proxy.revocable(requestValue.fieldRepairResourceApproval, {});
    revocable.revoke();
    requestValue.fieldRepairResourceApproval = revocable.proxy;
    return [state, requestValue];
  };
  const revokedFirst = revokedFactory();
  const revokedSecond = revokedFactory();
  const revokedResult = applyVoyageVoidScarRepair(...revokedFirst);
  assert.deepEqual(revokedResult, applyVoyageVoidScarRepair(...revokedSecond));
  assertApplicationDiagnostic(revokedResult, "void-scar-data-read-failed", "request.fieldRepairResourceApproval");
});

test("application captures accessors, reflection traps, and extra-property arrays at every repair boundary", () => {
  const factories = [
    ["root request accessor", () => { const { state } = pair(); const value = request(state, state.voidScars[0]); Object.defineProperty(value, "shipId", { enumerable: true, get() { throw new Error("getter"); } }); return [state, value]; }, "invalid-void-scar-data-property", "request.shipId"],
    ["previous snapshot accessor", () => { const { state } = pair(); const value = request(state, state.voidScars[0]); Object.defineProperty(value, "previousVoidScar", { enumerable: true, get() { throw new Error("getter"); } }); return [state, value]; }, "invalid-void-scar-data-property", "request.previousVoidScar"],
    ["facility approval accessor", () => { const { state } = pair(); const value = request(state, state.voidScars[0]); Object.defineProperty(value, "facilityApproval", { enumerable: true, get() { throw new Error("getter"); } }); return [state, value]; }, "invalid-void-scar-data-property", "request.facilityApproval"],
    ["live descriptor accessor", () => { const { state } = pair(); const value = request(state, state.voidScars[0]); Object.defineProperty(state.voidScars[0], "operationalEffects", { enumerable: true, get() { throw new Error("getter"); } }); return [state, value]; }, "invalid-void-scar-data-property", "shipState.voidScars[0].operationalEffects"],
    ["surviving descriptor accessor", () => { const state = ship([scar("target"), scar("survivor")]); const value = request(state, state.voidScars[0]); Object.defineProperty(state.voidScars[1], "eligibleRepairChecks", { enumerable: true, get() { throw new Error("getter"); } }); return [state, value]; }, "invalid-void-scar-data-property", "shipState.voidScars[1].eligibleRepairChecks"],
    ["request ownKeys trap", () => { const { state } = pair(); const value = new Proxy(request(state, state.voidScars[0]), { ownKeys() { throw new Error("ownKeys"); } }); return [state, value]; }, "void-scar-data-read-failed", "request"],
    ["request descriptor trap", () => { const { state } = pair(); const value = new Proxy(request(state, state.voidScars[0]), { getOwnPropertyDescriptor() { throw new Error("descriptor"); } }); return [state, value]; }, "void-scar-data-read-failed", "request.shipId"]
  ];
  for (const [label, factory, code, path] of factories) {
    const first = factory();
    const second = factory();
    const firstResult = applyVoyageVoidScarRepair(...first);
    const secondResult = applyVoyageVoidScarRepair(...second);
    assert.deepEqual(firstResult, secondResult, label);
    assertApplicationDiagnostic(firstResult, code, path);
  }

  const extraFactories = [
    ["request array", () => { const { state } = pair(); const value = []; value.extra = true; return [state, value]; }, "invalid-void-scar-array", "request"],
    ["ship voidScars", () => { const { state } = pair(); state.voidScars.extra = true; return [state, request(state, state.voidScars[0])]; }, "invalid-void-scar-array", "shipState.voidScars"],
    ["required facilities", () => { const { state } = pair(); state.voidScars[0].requiredFacilities.extra = true; return [state, request(state, state.voidScars[0])]; }, "invalid-void-scar-array", "shipState.voidScars[0].requiredFacilities"],
    ["compatible tags", () => { const { state } = pair(); state.voidScars[0].compatibleFieldRepairTags.extra = true; return [state, request(state, state.voidScars[0])]; }, "invalid-void-scar-array", "shipState.voidScars[0].compatibleFieldRepairTags"],
    ["operational effects", () => { const { state } = pair(); state.voidScars[0].operationalEffects.extra = true; return [state, request(state, state.voidScars[0])]; }, "invalid-void-scar-array", "shipState.voidScars[0].operationalEffects"]
  ];
  for (const [label, factory, code, path] of extraFactories) {
    const firstResult = applyVoyageVoidScarRepair(...factory());
    const secondResult = applyVoyageVoidScarRepair(...factory());
    assert.deepEqual(firstResult, secondResult, label);
    assertApplicationDiagnostic(firstResult, code, path);
  }
});

test("application preserves bidirectional event and next-state isolation", () => {
  const state = ship([scar("removed"), scar("survivor")]);
  const repairRequest = request(state, state.voidScars[0]);
  const inputBefore = clone(state);
  const requestBefore = clone(repairRequest);
  const result = applyVoyageVoidScarRepair(state, repairRequest);
  assertApplicationSuccess(result);
  const eventBefore = clone(result.events[0]);
  result.nextState.installed.hullPlatform = "sloop";
  result.nextState.hull.voidScarCapacity = 3;
  result.nextState.voidScars[0].description = "next-state mutation";
  result.nextState.voidScars[0].operationalEffects[0] = "next-state nested mutation";
  assert.deepEqual(result.events[0], eventBefore);
  assert.deepEqual(result.events[0].previousVoidScar, eventBefore.previousVoidScar);
  assert.deepEqual(state, inputBefore);
  assert.deepEqual(repairRequest, requestBefore);

  const eventMutationResult = applyVoyageVoidScarRepair(...[clone(inputBefore), clone(requestBefore)]);
  assertApplicationSuccess(eventMutationResult);
  const nextBefore = clone(eventMutationResult.nextState);
  eventMutationResult.events[0].previousVoidScar.description = "event mutation";
  assert.deepEqual(eventMutationResult.nextState, nextBefore);
  assert.notDeepEqual(eventMutationResult.events[0].previousVoidScar, nextBefore.voidScars[0]);
  assert.deepEqual(repairRequest, requestBefore);
});

test("application preserves exact precedence for compound invalid requests", () => {
  const { state, request: dock } = pair();
  const field = fieldRequest(state, state.voidScars[0]);
  const cases = [
    [{ ...field, expectedShipRevision: -1, fieldRepairResourceApproval: false }, "invalid-void-scar-repair-ship-revision", "request.expectedShipRevision"],
    [{ ...field, expectedShipRevision: Number.NaN, fieldRepairResourceApproval: false }, "invalid-void-scar-number", "request.expectedShipRevision"],
    [{ ...field, voidScarId: "wrong", fieldRepairResourceApproval: { approved: false, fieldRepairResourceId: "resource-1", compatibilityTag: "wrong" } }, "stale-void-scar-repair-void-scar-id", "request.voidScarId"],
    [{ ...field, previousVoidScar: { ...field.previousVoidScar, name: "changed" }, fieldRepairResourceApproval: { approved: true, fieldRepairResourceResourceId: "other", compatibilityTag: "wrong" } }, "stale-void-scar-repair-previous-void-scar", "request.previousVoidScar"],
    [{ ...field, outcome: "success", fieldRepairResourceApproval: null }, "invalid-void-scar-repair-outcome", "request.outcome"],
    [{ ...field, facilityApproval: { approved: true, facilityId: "dock", facilityTag: "drydock" }, fieldRepairResourceId: "" }, "unexpected-repair-facility-approval", "request.facilityApproval"]
  ];
  const malformedState = clone(state);
  delete malformedState.voidScars[0].name;
  for (const [candidate, code, path] of cases) {
    const result = applyVoyageVoidScarRepair(state, candidate);
    assertApplicationDiagnostic(result, code, path);
  }
  assertApplicationDiagnostic(applyVoyageVoidScarRepair(malformedState, { ...dock, facilityApproval: null }), "missing-void-scar-field", "shipState.voidScars[0].name");
});
