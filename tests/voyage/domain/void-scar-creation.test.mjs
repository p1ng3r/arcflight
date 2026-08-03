import assert from "node:assert/strict";
import test from "node:test";

import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterCrewPlanningLock } from "../../../scripts/voyage/domain/crew-planning-lock.js";
import { applyVoyageEncounterResolutionTransition } from "../../../scripts/voyage/domain/resolution-transition.js";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";
import { applyVoyageEncounterPressureBreachPlan } from "../../../scripts/voyage/domain/pressure-breach.js";
import {
  analyzeVoyagePressureBreachVoidScarCreation,
  applyVoyagePressureBreachVoidScarCreation
} from "../../../scripts/voyage/domain/void-scar-creation.js";
import { validateVoyageVoidScarRecord } from "../../../scripts/voyage/domain/void-scar-schema.js";

const SYSTEMS = ["crew-morale", "arkengine", "levstone-array", "solar-sail-rig", "lifeveil"];
const SCAR_FIELDS = [
  "voidScarId", "name", "pressureSystemId", "status", "sourceKind", "description",
  "operationalEffects", "baseRepairCost", "baseRepairTime", "repairDcSource",
  "eligibleRepairChecks", "requiredFacilities", "compatibleFieldRepairTags",
  "pressureBreachId", "hazardId", "encounterId", "stageId", "roundNumber", "effectIndex",
  "sequence", "stationId", "actionId", "pressureEffectId", "sourceIntentId",
  "activationSource", "branch", "timing", "visibility"
];
const ANALYSIS_FIELDS = [
  "readyForVoidScarCreation", "shipId", "expectedShipRevision", "sourceEventType",
  "sourceEncounterRevision", "sourceProposal", "voidScar", "activeVoidScarCount",
  "voidScarCapacity", "availableSlots", "errors", "warnings"
];
const APPLICATION_EVENT_FIELDS = [
  "type", "shipId", "encounterId", "pressureSystemId", "sourceEventType",
  "sourceEncounterRevision", "sourceProposal", "previousShipRevision", "revision",
  "previousVoidScarCount", "voidScarCount", "voidScar"
];

const SYSTEM_NAMES = Object.freeze({
  "crew-morale": "Crew Morale",
  arkengine: "Arkengine",
  "levstone-array": "Levstone Array",
  "solar-sail-rig": "Solar Sail Rig",
  lifeveil: "Lifeveil"
});

function clone(value) { return structuredClone(value); }

// This is the real Milestone 6 production path: the event is not hand-authored.
function buildMilestone6PressureBreachEvent(system = "crew-morale", encounterId = "creation-encounter") {
  const state = createVoyageEncounterState({ encounterId, definitionId: "creation-definition", primaryShip: { id: "ship-1" } });
  state.lifecycleState = "active";
  state.currentStage = { stageId: "stage-1" };
  state.roundNumber = 1;
  state.phase = "crew-planning";
  state.availableStations = [{
    stationId: "captain",
    actions: [{
      actionId: "pressure-action",
      approaches: [{ approachId: "pressure-approach", noRoll: true }],
      outcomeDefinition: {
        effectRules: [{
          effectId: "pressure-effect",
          intentType: "pressure-change",
          timing: "consequences",
          visibility: "public",
          target: { kind: "pressure-system", targetId: system },
          payload: { delta: 1 }
        }],
        branches: { "no-roll": ["pressure-effect"] }
      }
    }]
  }];
  state.stationAssignments = [{ stationId: "captain", operator: { kind: "actor", uuid: "Actor.pressure" } }];
  state.selections = {
    captain: {
      stationId: "captain",
      actionId: "pressure-action",
      approachId: "pressure-approach",
      noRoll: true
    }
  };
  state.proposedStationOrder = ["captain"];
  state.committedStationOrder = [];
  state.pressureSystems[system].value = state.pressureSystems[system].capacity;

  const locked = applyVoyageEncounterCrewPlanningLock(state, { phaseStartSnapshotId: "creation-lock" });
  assert.equal(locked.ok, true, JSON.stringify(locked.errors));
  const resolving = applyVoyageEncounterResolutionTransition(locked.nextState, { phaseStartSnapshotId: "creation-resolution" });
  assert.equal(resolving.ok, true, JSON.stringify(resolving.errors));
  const consequences = applyVoyageEncounterConsequencesTransition(resolving.nextState, { phaseStartSnapshotId: "creation-consequences" });
  assert.equal(consequences.ok, true, JSON.stringify(consequences.errors));
  const breach = applyVoyageEncounterPressureBreachPlan(consequences.nextState);
  assert.equal(breach.ok, true, JSON.stringify(breach.errors));
  assert.equal(breach.events.length, 1);
  assert.equal(breach.events[0].type, "voyage.pressure-breach-applied");
  return breach.events[0];
}

function makeShip({ revision = 4, voidScars = [], hullPlatform = "void-skiff" } = {}) {
  const capacities = { "void-skiff": 2, sloop: 3 };
  return {
    shipId: "ship-1",
    revision,
    installed: { hullPlatform },
    hull: { voidScarCapacity: capacities[hullPlatform] },
    voidScars: clone(voidScars)
  };
}

function makeRequest(event, ship, overrides = {}) {
  return {
    shipId: ship.shipId,
    expectedShipRevision: ship.revision,
    encounterId: event.encounterId,
    expectedEncounterRevision: event.revision,
    sourceEventType: event.type,
    sourceEncounterRevision: event.revision,
    sourceProposal: clone(event.voidScarProposal),
    pressureSystemId: event.voidScarProposal.pressureSystemId,
    ...overrides
  };
}

function canonicalPair(system = "crew-morale", encounterId = "creation-encounter") {
  const event = buildMilestone6PressureBreachEvent(system, encounterId);
  const ship = makeShip();
  return { event, ship, request: makeRequest(event, ship) };
}

function assertFailure(result) {
  assert.equal(result.readyForVoidScarCreation, false);
  assert.equal(result.voidScar, null);
  assert.ok(result.errors.length > 0);
}

function assertApplicationFailure(result) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.ok(result.errors.length > 0);
}

function assertNoHostileText(value) {
  const text = JSON.stringify(value);
  for (const forbidden of ["TypeError", "Proxy", "revok", "trap", "stack", "at "]) {
    assert.equal(text.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
}

test("canonical analysis covers all five systems, exact records, identity, determinism, and isolation", () => {
  for (const system of SYSTEMS) {
    const first = canonicalPair(system);
    const second = canonicalPair(system);
    const beforeEvent = clone(first.event);
    const beforeShip = clone(first.ship);
    const beforeRequest = clone(first.request);
    const report = analyzeVoyagePressureBreachVoidScarCreation(first.ship, first.event, first.request);
    const repeat = analyzeVoyagePressureBreachVoidScarCreation(second.ship, second.event, second.request);

    assert.equal(report.readyForVoidScarCreation, true, system);
    assert.deepEqual(report, repeat);
    assert.deepEqual(Object.keys(report), ANALYSIS_FIELDS);
    assert.deepEqual(Object.keys(report.voidScar), SCAR_FIELDS);
    assert.equal(validateVoyageVoidScarRecord(report.voidScar).valid, true);
    assert.equal(report.voidScar.name, `${SYSTEM_NAMES[system]} Void Scar`);
    assert.match(report.voidScar.description, new RegExp(SYSTEM_NAMES[system]));
    assert.deepEqual(report.voidScar.operationalEffects, [`${system} operations remain impaired until this Scar is repaired.`]);
    assert.equal(report.voidScar.baseRepairCost, 100);
    assert.equal(report.voidScar.baseRepairTime, 1);
    assert.equal(report.voidScar.repairDcSource, "very-hard");
    assert.deepEqual(report.voidScar.eligibleRepairChecks, ["crafting", "engineering-lore"]);
    assert.deepEqual(report.voidScar.requiredFacilities, ["drydock"]);
    assert.deepEqual(report.voidScar.compatibleFieldRepairTags, [`${system}-field-repair`]);
    assert.equal(report.voidScar.voidScarId, first.request.sourceProposal.voidScarId);
    assert.equal(report.voidScar.pressureSystemId, system);
    for (const key of ["pressureBreachId", "hazardId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility"]) {
      assert.equal(report.voidScar[key], first.request.sourceProposal[key], `${system}.${key}`);
    }
    assert.equal(report.activeVoidScarCount, 0);
    assert.equal(report.voidScarCapacity, 2);
    assert.equal(report.availableSlots, 2);
    assert.deepEqual(first.event, beforeEvent);
    assert.deepEqual(first.ship, beforeShip);
    assert.deepEqual(first.request, beforeRequest);

    report.voidScar.name = "mutated";
    report.sourceProposal.name = "mutated";
    assert.deepEqual(first.event, beforeEvent);
    const later = analyzeVoyagePressureBreachVoidScarCreation(first.ship, first.event, first.request);
    assert.equal(later.voidScar.name, `${SYSTEM_NAMES[system]} Void Scar`);
    assert.equal(later.voidScar.voidScarId, report.voidScar.voidScarId);
  }
});

test("populated states preserve existing Scars, enforce duplicate identity and capacity atomically", () => {
  const source = canonicalPair("crew-morale");
  const unrelated = canonicalPair("arkengine", "unrelated-encounter");
  const unrelatedScar = analyzeVoyagePressureBreachVoidScarCreation(unrelated.ship, unrelated.event, unrelated.request).voidScar;
  const populated = makeShip({ voidScars: [unrelatedScar] });
  const populatedRequest = makeRequest(source.event, populated);
  const populatedBefore = clone(populated);
  const report = analyzeVoyagePressureBreachVoidScarCreation(populated, source.event, populatedRequest);
  assert.equal(report.readyForVoidScarCreation, true);
  assert.equal(report.activeVoidScarCount, 1);
  assert.equal(report.availableSlots, 1);
  assert.deepEqual(populated, populatedBefore);

  const applied = applyVoyagePressureBreachVoidScarCreation(populated, source.event, populatedRequest);
  assert.equal(applied.ok, true);
  assert.deepEqual(applied.nextState.voidScars[0], unrelatedScar);
  assert.deepEqual(applied.nextState.voidScars.slice(0, 1), populatedBefore.voidScars);
  assert.deepEqual(applied.nextState.voidScars[1], report.voidScar);

  const duplicateRequest = makeRequest(source.event, applied.nextState);
  const duplicateAnalysis = analyzeVoyagePressureBreachVoidScarCreation(applied.nextState, source.event, duplicateRequest);
  assertFailure(duplicateAnalysis);
  assert.ok(duplicateAnalysis.errors.some(({ code }) => code === "duplicate-void-scar-proposal"));
  assertApplicationFailure(applyVoyagePressureBreachVoidScarCreation(applied.nextState, source.event, duplicateRequest));

  const full = makeShip({ voidScars: [unrelatedScar, report.voidScar] });
  const fullBefore = clone(full);
  const fullReport = analyzeVoyagePressureBreachVoidScarCreation(full, source.event, makeRequest(source.event, full));
  assertFailure(fullReport);
  assert.ok(fullReport.errors.some(({ code }) => code === "void-scar-capacity-exhausted"));
  const fullResult = applyVoyagePressureBreachVoidScarCreation(full, source.event, makeRequest(source.event, full));
  assertApplicationFailure(fullResult);
  assert.deepEqual(full, fullBefore);

  const distinct = canonicalPair("crew-morale", "distinct-encounter");
  const distinctState = makeShip({ voidScars: [report.voidScar] });
  const distinctReport = analyzeVoyagePressureBreachVoidScarCreation(distinctState, distinct.event, makeRequest(distinct.event, distinctState));
  assert.equal(distinctReport.readyForVoidScarCreation, true);
  assert.notEqual(distinctReport.voidScar.voidScarId, report.voidScar.voidScarId);
});

test("identity, concurrency, proposal, and source-provenance mutations fail closed", () => {
  const { event, ship, request } = canonicalPair();
  const cases = [
    ["wrong ship", { shipId: "other-ship" }],
    ["stale ship revision", { expectedShipRevision: ship.revision - 1 }],
    ["future ship revision", { expectedShipRevision: ship.revision + 1 }],
    ["wrong encounter", { encounterId: "other-encounter" }],
    ["stale encounter revision", { expectedEncounterRevision: event.revision - 1 }],
    ["future encounter revision", { expectedEncounterRevision: event.revision + 1 }],
    ["wrong pressure system", { pressureSystemId: "lifeveil" }]
  ];
  for (const [label, override] of cases) {
    const stateBefore = clone(ship);
    const eventBefore = clone(event);
    const requestBefore = clone(request);
    const altered = { ...request, ...override };
    assertFailure(analyzeVoyagePressureBreachVoidScarCreation(ship, event, altered));
    assertApplicationFailure(applyVoyagePressureBreachVoidScarCreation(ship, event, altered));
    assert.deepEqual(ship, stateBefore, label);
    assert.deepEqual(event, eventBefore, label);
    assert.deepEqual(request, requestBefore, label);
  }

  const overflow = makeShip({ revision: Number.MAX_SAFE_INTEGER });
  const overflowRequest = makeRequest(event, overflow);
  const overflowAnalysis = analyzeVoyagePressureBreachVoidScarCreation(overflow, event, overflowRequest);
  assertFailure(overflowAnalysis);
  assert.ok(overflowAnalysis.errors.some(({ code }) => code === "void-scar-creation-revision-overflow"));
  assertApplicationFailure(applyVoyagePressureBreachVoidScarCreation(overflow, event, overflowRequest));

  const proposalMutations = [
    ["name", "altered"],
    ["description", "altered"],
    ["operationalEffects", ["altered"]],
    ["baseRepairCost", 999],
    ["baseRepairTime", 999],
    ["repairDcSource", "altered"],
    ["eligibleRepairChecks", ["altered"]],
    ["requiredFacilities", ["altered"]],
    ["compatibleFieldRepairTags", ["altered"]]
  ];
  for (const [field, value] of proposalMutations) {
    const altered = clone(request);
    altered.sourceProposal[field] = value;
    assertFailure(analyzeVoyagePressureBreachVoidScarCreation(ship, event, altered));
  }
  const missingSourceProposal = clone(event);
  delete missingSourceProposal.voidScarProposal;
  assertFailure(analyzeVoyagePressureBreachVoidScarCreation(ship, missingSourceProposal, request));
  const missingExpectedProposal = clone(request);
  delete missingExpectedProposal.sourceProposal;
  assertFailure(analyzeVoyagePressureBreachVoidScarCreation(ship, event, missingExpectedProposal));
  const sparseProposal = clone(request);
  sparseProposal.sourceProposal = new Array(23);
  assertFailure(analyzeVoyagePressureBreachVoidScarCreation(ship, event, sparseProposal));
  const extraProposal = clone(request);
  extraProposal.sourceProposal.extra = true;
  assertFailure(analyzeVoyagePressureBreachVoidScarCreation(ship, event, extraProposal));

  const provenanceFields = ["pressureBreachId", "hazardId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility"];
  for (const field of provenanceFields) {
    const altered = clone(event);
    const target = field === "hazardId" ? altered.hazard : altered.breach;
    target[field] = typeof target[field] === "number" ? target[field] + 1 : `${target[field]}-altered`;
    assertFailure(analyzeVoyagePressureBreachVoidScarCreation(ship, altered, request));
    assertApplicationFailure(applyVoyagePressureBreachVoidScarCreation(ship, altered, request));
  }
});

test("application preserves exact state and event contracts and ignores fabricated authority", () => {
  const source = canonicalPair();
  const unrelated = canonicalPair("arkengine", "existing-encounter");
  const existing = analyzeVoyagePressureBreachVoidScarCreation(unrelated.ship, unrelated.event, unrelated.request).voidScar;
  const ship = makeShip({ voidScars: [existing] });
  const request = makeRequest(source.event, ship);
  const stateBefore = clone(ship);
  const eventBefore = clone(source.event);
  const result = applyVoyagePressureBreachVoidScarCreation(ship, source.event, request);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.nextState), ["shipId", "revision", "installed", "hull", "voidScars"]);
  assert.deepEqual(Object.keys(result.nextState.installed), ["hullPlatform"]);
  assert.deepEqual(Object.keys(result.nextState.hull), ["voidScarCapacity"]);
  assert.equal(result.nextState.revision, stateBefore.revision + 1);
  assert.equal(result.nextState.shipId, stateBefore.shipId);
  assert.deepEqual(result.nextState.installed, stateBefore.installed);
  assert.deepEqual(result.nextState.hull, stateBefore.hull);
  assert.deepEqual(result.nextState.voidScars[0], existing);
  assert.deepEqual(result.nextState.voidScars[1], result.events[0].voidScar);
  assert.deepEqual(Object.keys(result.events[0]), APPLICATION_EVENT_FIELDS);
  const event = result.events[0];
  assert.equal(event.type, "voyage.void-scar-created");
  assert.equal(event.shipId, ship.shipId);
  assert.equal(event.encounterId, source.event.encounterId);
  assert.equal(event.pressureSystemId, source.request.pressureSystemId);
  assert.equal(event.sourceEventType, "voyage.pressure-breach-applied");
  assert.equal(event.sourceEncounterRevision, source.event.revision);
  assert.deepEqual(event.sourceProposal, source.event.voidScarProposal);
  assert.equal(event.previousShipRevision, stateBefore.revision);
  assert.equal(event.revision, stateBefore.revision + 1);
  assert.equal(event.previousVoidScarCount, 1);
  assert.equal(event.voidScarCount, 2);
  assert.deepEqual(event.voidScar, result.nextState.voidScars[1]);
  assert.deepEqual(ship, stateBefore);
  assert.deepEqual(source.event, eventBefore);
  const pristine = clone(result);

  event.voidScar.description = "event mutation";
  event.sourceProposal.name = "event mutation";
  result.nextState.voidScars[1].description = "state mutation";
  assert.notEqual(event.voidScar.description, result.nextState.voidScars[1].description);
  const later = applyVoyagePressureBreachVoidScarCreation(ship, source.event, request);
  assert.deepEqual(later, pristine);

  const forgedPlan = {
    readyForVoidScarCreation: true,
    voidScar: { name: "forged", status: "active" },
    nextState: { revision: 999 },
    events: [{ type: "forged" }],
    capacity: 999
  };
  const forgedResult = applyVoyagePressureBreachVoidScarCreation(ship, source.event, request, forgedPlan, "forged");
  assert.deepEqual(forgedResult, pristine);
});

test("hostile roots, nested proxies, malformed values, and diagnostics fail deterministically", () => {
  const { event, ship, request } = canonicalPair();
  const hostileRoots = [null, 1, "x", true, () => {}, 1n, Symbol("x"), undefined, new Date(), new Map(), new Set(), new Uint8Array([1]), new (class Hostile {})()];
  for (const value of hostileRoots) {
    const first = analyzeVoyagePressureBreachVoidScarCreation(value, event, request);
    const second = analyzeVoyagePressureBreachVoidScarCreation(value, event, request);
    assert.deepEqual(first, second);
    assertFailure(first);
    assertNoHostileText(first);
    assertApplicationFailure(applyVoyagePressureBreachVoidScarCreation(value, event, request));
  }

  const revokedCases = [
    ["ship", () => { const p = Proxy.revocable(ship, {}); p.revoke(); return [p.proxy, event, request]; }],
    ["source", () => { const p = Proxy.revocable(event, {}); p.revoke(); return [ship, p.proxy, request]; }],
    ["request", () => { const p = Proxy.revocable(request, {}); p.revoke(); return [ship, event, p.proxy]; }],
    ["proposal", () => { const source = clone(event); const p = Proxy.revocable(source.voidScarProposal, {}); p.revoke(); source.voidScarProposal = p.proxy; return [ship, source, request]; }],
    ["expected proposal", () => { const req = clone(request); const p = Proxy.revocable(req.sourceProposal, {}); p.revoke(); req.sourceProposal = p.proxy; return [ship, event, req]; }],
    ["installed", () => { const state = clone(ship); const p = Proxy.revocable(state.installed, {}); p.revoke(); state.installed = p.proxy; return [state, event, request]; }],
    ["hull", () => { const state = clone(ship); const p = Proxy.revocable(state.hull, {}); p.revoke(); state.hull = p.proxy; return [state, event, request]; }],
    ["voidScars", () => { const state = clone(ship); const p = Proxy.revocable(state.voidScars, {}); p.revoke(); state.voidScars = p.proxy; return [state, event, request]; }],
    ["existing Scar", () => { const state = makeShip({ voidScars: [analyzeVoyagePressureBreachVoidScarCreation(ship, event, request).voidScar] }); const p = Proxy.revocable(state.voidScars[0], {}); p.revoke(); state.voidScars[0] = p.proxy; return [state, event, request]; }]
  ];
  for (const [label, make] of revokedCases) {
    const firstArgs = make();
    const secondArgs = make();
    const first = analyzeVoyagePressureBreachVoidScarCreation(...firstArgs);
    const second = analyzeVoyagePressureBreachVoidScarCreation(...secondArgs);
    assert.deepEqual(first, second, label);
    assertFailure(first);
    assertNoHostileText(first);
    assertApplicationFailure(applyVoyagePressureBreachVoidScarCreation(...firstArgs));
  }

  const malformed = [
    (value) => { value.type = "wrong"; },
    (value) => { delete value.voidScarProposal; },
    (value) => { value.effects = Number.NaN; },
    (value) => { value.revision = Number.MAX_SAFE_INTEGER + 1; },
    (value) => { value.effects = new Array(1); },
    (value) => { value.effects.extra = true; },
    (value) => { value[Symbol("hostile")] = true; },
    (value) => { value["__proto__"] = { hostile: true }; },
    (value) => { value.effects = []; value.effects[0] = value; }
  ];
  for (const mutate of malformed) {
    const altered = clone(event);
    mutate(altered);
    const first = analyzeVoyagePressureBreachVoidScarCreation(ship, altered, request);
    const second = analyzeVoyagePressureBreachVoidScarCreation(ship, altered, request);
    assert.deepEqual(first, second);
    assertFailure(first);
    assertNoHostileText(first);
  }

  const accessor = clone(event);
  Object.defineProperty(accessor, "type", { enumerable: true, get() { throw new Error("hostile getter"); } });
  assertFailure(analyzeVoyagePressureBreachVoidScarCreation(ship, accessor, request));
  const throwingOwnKeys = new Proxy(clone(event), { ownKeys() { throw new Error("hostile ownKeys"); } });
  assertFailure(analyzeVoyagePressureBreachVoidScarCreation(ship, throwingOwnKeys, request));
});
