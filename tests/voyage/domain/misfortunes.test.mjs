import assert from "node:assert/strict";
import test from "node:test";
import {
  validateVoyageEncounterMisfortuneDefinition,
  captureVoyageEncounterMisfortuneDefinition,
  analyzeVoyageEncounterNegativeSteps
} from "../../../scripts/voyage/domain/misfortunes.js";
import {
  analyzeVoyagePressureBreachVoidScarCreation,
  applyVoyagePressureBreachVoidScarCreation
} from "../../../scripts/voyage/domain/void-scar-creation.js";

const proposal = { voidScarDefinitionId: "scar-a", pressureSystemId: "pressure-a", source: "m8-critical-overall-failure" };
const next = { nextSituationId: "next-a", title: "Retreat", summary: "Retreat to safety.", transitionKind: "retreat" };
function misfortune(id = "delay", enhancementIds = [], scarConsequenceProposal = null, kind = "travel-delay") {
  return { misfortuneId: id, kind, title: id, description: `${id} description`, tags: ["hazard"], persistence: "temporary", enhancementIds, scarConsequenceProposal };
}
function enhancement(id, compatibleMisfortuneIds = []) {
  return { misfortuneEnhancementId: id, title: id, description: `${id} description`, compatibleMisfortuneIds, maxApplicationsPerMisfortune: 1 };
}
function definition(overrides = {}) {
  return {
    schemaVersion: 1,
    eventId: "event-a",
    definitionSnapshotId: "snapshot-a",
    roundCount: 3,
    rounds: [{ roundId: "r1", roundNumber: 1 }, { roundId: "r2", roundNumber: 2 }, { roundId: "r3", roundNumber: 3 }],
    rewards: [],
    enhancements: [],
    misfortuneEnhancements: [enhancement("e1", ["delay"]), enhancement("e2", [])],
    misfortunes: [misfortune("delay", ["e1", "e2"])],
    nextSituations: [next],
    ...overrides
  };
}
function history(results = ["round-failure", "round-failure", "round-success"], overrides = {}) {
  return { schemaVersion: 1, eventId: "event-a", sessionId: "session-a", definitionSnapshotId: "snapshot-a", roundCount: 3, rounds: results.map((roundResult, i) => ({ roundId: `r${i + 1}`, roundNumber: i + 1, roundResult })), ...overrides };
}
function request(overrides = {}) {
  return { kind: "m8-negative-steps", sessionId: "session-a", eventDefinition: definition(), completedRoundHistory: history(), negativeSelection: { misfortuneId: "delay", enhancementIds: [] }, ...overrides };
}
function fourRoundDefinition(overrides = {}) {
  return {
    ...definition(),
    roundCount: 4,
    rounds: [{ roundId: "r1", roundNumber: 1 }, { roundId: "r2", roundNumber: 2 }, { roundId: "r3", roundNumber: 3 }, { roundId: "r4", roundNumber: 4 }],
    ...overrides
  };
}
function fourRoundHistory(overrides = {}) {
  return {
    ...history(),
    roundCount: 4,
    rounds: ["round-failure", "round-failure", "round-success", "round-success"].map((roundResult, i) => ({ roundId: `r${i + 1}`, roundNumber: i + 1, roundResult })),
    ...overrides
  };
}
function fourRoundRequest({ eventDefinition = fourRoundDefinition(), completedRoundHistory = fourRoundHistory(), sessionId = "session-a" } = {}) {
  return { kind: "m8-negative-steps", sessionId, eventDefinition, completedRoundHistory, negativeSelection: { misfortuneId: "delay", enhancementIds: [] } };
}
function failed(errors) {
  return { ok: false, readyForNegativeSteps: false, eventId: null, sessionId: null, definitionSnapshotId: null, roundCount: null, winningThreshold: null, overallResult: null, failurePoints: null, negativeSteps: null, overallFailureDegree: null, negativePackage: null, errors, warnings: [] };
}
function reorder(value, order) { const output = {}; for (const key of order) output[key] = value[key]; return output; }
function m7SourceWithM8Proposal() {
  const pressureBreachId = "m8-boundary-breach";
  const encounterId = "m8-boundary-encounter";
  const pressureSystemId = "arkengine";
  const stageId = "stage-1";
  const roundNumber = 1;
  const effectIndex = 0;
  const sequence = 0;
  const stationId = "captain";
  const actionId = "pressure-action";
  const pressureEffectId = "pressure-effect";
  const sourceIntentId = "pressure-intent";
  const activationSource = "voyage-event";
  const branch = "main";
  const timing = "consequences";
  const visibility = "public";
  const m8Proposal = { voidScarDefinitionId: "scar-definition-id", pressureSystemId, source: "m8-critical-overall-failure" };
  const breach = {
    pressureBreachId, encounterId, stageId, roundNumber, effectIndex, sequence, stationId, actionId,
    pressureSystemId, pressureEffectId, sourceKind: "pressure-breach", sourceIntentId, activationSource,
    branch, timing, visibility, previousValue: 1, capacity: 1, remainingCapacity: 0, attemptedDelta: 1, overflowDelta: 1
  };
  const hazard = {
    hazardId: `arcflight-hazard:${JSON.stringify(["pressure-breach", pressureBreachId])}`,
    pressureBreachId, encounterId, stageId, roundNumber, effectIndex, sequence, stationId, actionId,
    pressureSystemId, category: "system", status: "active", sourceKind: "pressure-breach", pressureEffectId,
    sourceIntentId, activationSource, branch, timing, visibility, name: "Arkengine Breach"
  };
  const event = {
    type: "voyage.pressure-breach-applied", encounterId, lifecycleState: "active", stageId, roundNumber,
    phase: "consequences", pressureEffectCount: 1, appliedEffectCount: 1, breach, hazard,
    collisionOutcome: "none", voidScarProposal: m8Proposal, pressureReset: null, effects: [],
    previousPressureSystems: {}, pressureSystems: {}, previousRevision: 0, revision: 1
  };
  const ship = { shipId: "ship-boundary", revision: 4, installed: { hullPlatform: "void-skiff" }, hull: { voidScarCapacity: 2 }, voidScars: [] };
  const request = {
    shipId: ship.shipId, expectedShipRevision: ship.revision, encounterId, expectedEncounterRevision: event.revision,
    sourceEventType: event.type, sourceEncounterRevision: event.revision, sourceProposal: structuredClone(m8Proposal), pressureSystemId
  };
  return { event, ship, request, m8Proposal };
}

test("exports and capture return a stable isolated value", () => {
  const input = misfortune(); const result = captureVoyageEncounterMisfortuneDefinition(input);
  assert.equal(result.ok, true); assert.deepEqual(result.errors, []); assert.deepEqual(result.warnings, []); assert.notStrictEqual(result.value, input);
  result.value.tags.push("copy"); assert.deepEqual(input.tags, ["hazard"]);
});
test("misfortune definitions accept every canonical kind and persistence", () => {
  for (const kind of ["travel-delay", "resource-cost", "operational-restriction", "crew-consequence", "damaged-room", "authored"]) for (const persistence of ["temporary", "persistent"]) {
    const value = misfortune("m", [], null, kind); value.persistence = persistence;
    assert.equal(validateVoyageEncounterMisfortuneDefinition(value, []).valid, true);
  }
});
test("exact descriptor keys, strings, dense arrays, and max applications are enforced", () => {
  const bad = misfortune(); delete bad.tags; assert.equal(validateVoyageEncounterMisfortuneDefinition(bad, []).valid, false);
  const badEnhancement = enhancement("e"); badEnhancement.maxApplicationsPerMisfortune = 2;
  assert.equal(validateVoyageEncounterMisfortuneDefinition(misfortune("m", ["e"]), [badEnhancement]).valid, false);
});
test("malformed ordinary enhancement entries return validation envelopes without throwing", () => {
  for (const entry of [null, 42, "invalid"]) {
    assert.deepEqual(validateVoyageEncounterMisfortuneDefinition(misfortune(), [entry]), {
      valid: false,
      errors: [{ code: "m8-invalid-misfortune-enhancement", path: "misfortuneEnhancementDefinitions[0]", message: "Misfortune-enhancement descriptor is invalid.", severity: "error" }],
      warnings: []
    });
  }
});
test("duplicate identities and unresolved forward/reverse references are rejected", () => {
  const d = definition({ misfortunes: [misfortune("delay"), misfortune("delay")] });
  assert.equal(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: d })).errors[0].code, "m8-duplicate-misfortune-identity");
  const unresolved = definition({ misfortunes: [misfortune("delay", ["missing"]) ] });
  assert.equal(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: unresolved })).errors[0].code, "m8-unresolved-misfortune-enhancement-reference");
  const reverse = definition({ misfortuneEnhancements: [enhancement("e1", ["missing"]), enhancement("e2", [])] });
  assert.equal(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: reverse })).errors[0].code, "m8-unresolved-compatible-misfortune-reference");
});
test("duplicate Scar proposal tuples and invalid proposal source are rejected", () => {
  const d = definition({ misfortunes: [misfortune("a", [], proposal), misfortune("b", [], { ...proposal })] });
  assert.equal(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: d })).errors[0].code, "m8-duplicate-scar-consequence-proposal");
  const bad = misfortune("a", [], { ...proposal, source: "other" });
  assert.equal(validateVoyageEncounterMisfortuneDefinition(bad, []).valid, false);
});
test("Scar tuple identity remains component-safe for embedded NUL values", () => {
  const distinct = definition({ misfortunes: [misfortune("safe"), misfortune("a", [], { voidScarDefinitionId: "x\u0000y", pressureSystemId: "z", source: "m8-critical-overall-failure" }), misfortune("b", [], { voidScarDefinitionId: "x", pressureSystemId: "y\u0000z", source: "m8-critical-overall-failure" })], misfortuneEnhancements: [] });
  const result = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: distinct, negativeSelection: { misfortuneId: "safe", enhancementIds: [] } }));
  assert.equal(result.errors.some((entry) => entry.code === "m8-duplicate-scar-consequence-proposal"), false);
  assert.equal(result.ok, true);
});
test("unrestricted compatibility is valid when the compatibility list is empty", () => {
  const d = definition({ misfortunes: [misfortune("delay", ["e2"])], misfortuneEnhancements: [enhancement("e2", [])] });
  assert.equal(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: d })).ok, true);
});
test("authority keys are rejected before mode and request-shape checks", () => {
  for (const key of ["overallResult", "rewardAnalysis", "negativeAnalysis", "rewardSteps", "negativeSteps", "resultPackage", "allocationPlan", "nextState"]) {
    const value = { [key]: {}, ...request() }; const result = analyzeVoyageEncounterNegativeSteps(value);
    assert.equal(result.errors[0].code, "m8-caller-authored-plan-rejected"); assert.equal(result.errors[0].path, `request.${key}`);
  }
});
test("invalid mode and exact request keys are deterministic", () => {
  const wrong = analyzeVoyageEncounterNegativeSteps({ ...request(), kind: "m8-reward-steps" }); assert.equal(wrong.errors[0].code, "m8-invalid-mode");
  const extra = analyzeVoyageEncounterNegativeSteps({ ...request(), extra: true }); assert.equal(extra.errors[0].code, "m8-invalid-request-shape"); assert.deepEqual(extra.warnings, []);
});
test("ordinary non-object root requests return the complete request-shape envelope", () => {
  for (const value of [null, "invalid", 42, true, []]) {
    assert.deepEqual(analyzeVoyageEncounterNegativeSteps(value), failed([{ code: "m8-invalid-request-shape", path: "request", message: "Request has an invalid exact shape.", severity: "error" }]));
  }
});
test("Task 1 owns non-integer round-count diagnostics", () => {
  const eventDefinition = { ...definition(), roundCount: "3" };
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition })), failed([{ code: "m8-invalid-round-count", path: "eventDefinition.roundCount", message: "Event Definition roundCount must be one of 3, 5, 7, 9, or 11.", severity: "error" }]));
});
test("event binding precedes invalid authored round count", () => {
  const result = analyzeVoyageEncounterNegativeSteps(fourRoundRequest({ completedRoundHistory: fourRoundHistory({ eventId: "other-event" }) }));
  assert.deepEqual(result, failed([{ code: "m8-event-identity-mismatch", path: "completedRoundHistory.eventId", message: "Completed history eventId must match Event Definition.", severity: "error" }]));
  assert.equal(result.errors.some(({ code }) => code === "m8-invalid-round-count"), false);
});
test("session binding precedes invalid authored round count", () => {
  const result = analyzeVoyageEncounterNegativeSteps(fourRoundRequest({ completedRoundHistory: fourRoundHistory({ sessionId: "other-session" }) }));
  assert.deepEqual(result, failed([{ code: "m8-session-identity-mismatch", path: "completedRoundHistory.sessionId", message: "Request sessionId must match completed history sessionId.", severity: "error" }]));
  assert.equal(result.errors.some(({ code }) => code === "m8-invalid-round-count"), false);
});
test("definition-snapshot binding precedes invalid authored round count", () => {
  const result = analyzeVoyageEncounterNegativeSteps(fourRoundRequest({ completedRoundHistory: fourRoundHistory({ definitionSnapshotId: "other-snapshot" }) }));
  assert.deepEqual(result, failed([{ code: "m8-definition-snapshot-mismatch", path: "completedRoundHistory.definitionSnapshotId", message: "Completed history definitionSnapshotId must match Event Definition.", severity: "error" }]));
  assert.equal(result.errors.some(({ code }) => code === "m8-invalid-round-count"), false);
});
test("all category-seven bindings retain event, session, snapshot ordering", () => {
  const result = analyzeVoyageEncounterNegativeSteps(fourRoundRequest({ completedRoundHistory: fourRoundHistory({ eventId: "other-event", sessionId: "other-session", definitionSnapshotId: "other-snapshot" }) }));
  assert.deepEqual(result.errors, [
    { code: "m8-event-identity-mismatch", path: "completedRoundHistory.eventId", message: "Completed history eventId must match Event Definition.", severity: "error" },
    { code: "m8-session-identity-mismatch", path: "completedRoundHistory.sessionId", message: "Request sessionId must match completed history sessionId.", severity: "error" },
    { code: "m8-definition-snapshot-mismatch", path: "completedRoundHistory.definitionSnapshotId", message: "Completed history definitionSnapshotId must match Event Definition.", severity: "error" }
  ]);
  assert.equal(result.errors.some(({ code }) => code === "m8-invalid-round-count"), false);
  assert.deepEqual(result.warnings, []);
});
test("bound invalid integer round count remains Task 1-owned", () => {
  const result = analyzeVoyageEncounterNegativeSteps(fourRoundRequest());
  assert.deepEqual(result, failed([{ code: "m8-invalid-round-count", path: "eventDefinition.roundCount", message: "Event Definition roundCount must be one of 3, 5, 7, 9, or 11.", severity: "error" }]));
});
test("hostile root requests remain capture failures", () => {
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  const cyclic = {}; cyclic.self = cyclic;
  const accessor = {}; Object.defineProperty(accessor, "kind", { enumerable: true, get() { throw new Error("root trap"); } });
  for (const value of [() => {}, Symbol("hostile"), 1n, revoked.proxy, cyclic, accessor]) {
    const result = analyzeVoyageEncounterNegativeSteps(value);
    assert.deepEqual(result, failed([{ code: "m8-hostile-data-capture-failed", path: "$", message: "Input contains inaccessible or unsafe data.", severity: "error" }]));
  }
});
test("reordered request and descriptor keys are rejected rather than normalized", () => {
  const baseRequest = request();
  const reorderedRequest = reorder(baseRequest, ["sessionId", "kind", "eventDefinition", "completedRoundHistory", "negativeSelection"]);
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(reorderedRequest), failed([{ code: "m8-invalid-request-shape", path: "request", message: "Request has an invalid exact shape.", severity: "error" }]));
  const reorderedMisfortune = reorder(misfortune(), ["kind", "misfortuneId", "title", "description", "tags", "persistence", "enhancementIds", "scarConsequenceProposal"]);
  assert.deepEqual(captureVoyageEncounterMisfortuneDefinition(reorderedMisfortune).errors, [{ code: "m8-invalid-misfortune-definition", path: "misfortuneDefinition", message: "Misfortune descriptor is invalid.", severity: "error" }]);
  const reorderedEnhancement = reorder(enhancement("e"), ["title", "misfortuneEnhancementId", "description", "compatibleMisfortuneIds", "maxApplicationsPerMisfortune"]);
  assert.deepEqual(validateVoyageEncounterMisfortuneDefinition(misfortune("m", ["e"]), [reorderedEnhancement]).errors, [{ code: "m8-invalid-misfortune-enhancement", path: "misfortuneEnhancementDefinitions[0]", message: "Misfortune-enhancement descriptor is invalid.", severity: "error" }]);
  const reorderedProposal = reorder({ ...misfortune("m", [], proposal), scarConsequenceProposal: reorder(proposal, ["pressureSystemId", "voidScarDefinitionId", "source"]) }, ["misfortuneId", "kind", "title", "description", "tags", "persistence", "enhancementIds", "scarConsequenceProposal"]);
  assert.deepEqual(captureVoyageEncounterMisfortuneDefinition(reorderedProposal).errors, [{ code: "m8-invalid-misfortune-definition", path: "misfortuneDefinition.scarConsequenceProposal", message: "Misfortune descriptor is invalid.", severity: "error" }]);
  const reorderedSelection = reorder({ misfortuneId: "delay", enhancementIds: [] }, ["enhancementIds", "misfortuneId"]);
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ negativeSelection: reorderedSelection })).errors, [{ code: "m8-invalid-negative-selection", path: "negativeSelection", message: "Negative selection shape or identity is invalid.", severity: "error" }]);
  const reorderedNext = reorder(next, ["title", "nextSituationId", "summary", "transitionKind"]);
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: definition({ nextSituations: [reorderedNext] }) })).errors, [{ code: "m8-invalid-next-situation", path: "eventDefinition.nextSituations", message: "A next-situation descriptor is malformed or more than one was authored.", severity: "error" }]);
});
test("malformed non-hostile selections reach category 13 after all earlier gates", () => {
  for (const negativeSelection of [null, "invalid", 42, []]) {
    const result = analyzeVoyageEncounterNegativeSteps(request({ negativeSelection }));
    assert.deepEqual(result, failed([{ code: "m8-invalid-negative-selection", path: "negativeSelection", message: "Negative selection shape or identity is invalid.", severity: "error" }]));
  }
});
test("a hostile selection Proxy still fails during category 1 capture", () => {
  const revoked = Proxy.revocable({ misfortuneId: "delay", enhancementIds: [] }, {}); revoked.revoke();
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ negativeSelection: revoked.proxy })), failed([{ code: "m8-hostile-data-capture-failed", path: "$", message: "Input contains inaccessible or unsafe data.", severity: "error" }]));
});
test("success envelopes have exact key order and complete values", () => {
  const result = analyzeVoyageEncounterNegativeSteps(request());
  assert.deepEqual(Object.keys(result), ["ok", "readyForNegativeSteps", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "winningThreshold", "overallResult", "failurePoints", "negativeSteps", "overallFailureDegree", "negativePackage", "errors", "warnings"]);
  assert.deepEqual(result, { ok: true, readyForNegativeSteps: true, eventId: "event-a", sessionId: "session-a", definitionSnapshotId: "snapshot-a", roundCount: 3, winningThreshold: 2, overallResult: "overall-failure", failurePoints: 2, negativeSteps: 1, overallFailureDegree: "normal", negativePackage: { misfortuneId: "delay", enhancementIds: [], misfortune: { misfortuneId: "delay", kind: "travel-delay", title: "delay", description: "delay description", tags: ["hazard"], persistence: "temporary", enhancementIds: ["e1", "e2"], scarConsequenceProposal: null }, enhancements: [], nextSituation: next, scarConsequenceProposals: [] }, errors: [], warnings: [] });
});
test("diagnostic precedence is exact for compound authority, mode, and request failures", () => {
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps({ ...request(), kind: "wrong", overallResult: {} }), failed([{ code: "m8-caller-authored-plan-rejected", path: "request.overallResult", message: "Caller-authored result plans are not accepted.", severity: "error" }]));
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps({ ...request(), kind: "wrong", extra: true }), failed([{ code: "m8-invalid-mode", path: "request.kind", message: "Only m8-negative-steps analysis is supported.", severity: "error" }]));
});
test("diagnostic precedence is exact for catalog, compatibility, binding, and applicability failures", () => {
  const malformedMisfortune = misfortune("delay", ["missing"]); delete malformedMisfortune.tags;
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: definition({ misfortunes: [malformedMisfortune] }) })).errors, [{ code: "m8-invalid-misfortune-definition", path: "eventDefinition.misfortunes[0]", message: "Misfortune descriptor is invalid.", severity: "error" }]);
  const unresolvedCompatibility = definition({ misfortuneEnhancements: [enhancement("e1", ["missing"]), enhancement("e2", [])] });
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: unresolvedCompatibility, completedRoundHistory: history(undefined, { eventId: "other" }) })).errors, [{ code: "m8-unresolved-compatible-misfortune-reference", path: "eventDefinition.misfortuneEnhancements[0].compatibleMisfortuneIds[0]", message: "Misfortune compatibility identity does not resolve exactly once.", severity: "error" }]);
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: definition({ misfortunes: [], misfortuneEnhancements: [] }), completedRoundHistory: history(["round-success", "round-success", "round-failure"]) })).errors, [{ code: "m8-negative-analysis-on-success", path: "overallResult", message: "Negative analysis was requested for a successful Event.", severity: "error" }]);
});
test("diagnostic precedence is exact for authored presence, sufficiency, next situation, and Scar restriction", () => {
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: definition({ misfortunes: [], misfortuneEnhancements: [], nextSituations: [] }) })).errors, [{ code: "m8-no-authored-misfortunes", path: "eventDefinition.misfortunes", message: "Negative Step analysis has no valid authored Misfortune definition.", severity: "error" }]);
  const insufficient = definition({ misfortunes: [misfortune("delay", [], proposal)], misfortuneEnhancements: [], nextSituations: [] });
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: insufficient })).errors, [{ code: "m8-insufficient-authored-misfortune-options", path: "eventDefinition.misfortunes", message: "The authored Misfortune catalog cannot form any legal package consuming the calculated Negative Steps.", severity: "error" }]);
  const enough = definition({ nextSituations: [], misfortunes: [misfortune("delay", ["e1"])], misfortuneEnhancements: [enhancement("e1", ["delay"])] });
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: enough, negativeSelection: { misfortuneId: "missing", enhancementIds: [] } })).errors, [{ code: "m8-missing-next-situation", path: "eventDefinition.nextSituations", message: "Failure has no required authored next situation.", severity: "error" }]);
  const scar = definition({ misfortunes: [misfortune("safe"), misfortune("delay", [], proposal)], misfortuneEnhancements: [] });
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: scar, negativeSelection: { misfortuneId: "delay", enhancementIds: [] } })).errors, [{ code: "m8-scar-consequence-not-allowed-on-normal-failure", path: "eventDefinition.misfortunes[1].scarConsequenceProposal", message: "The selected Misfortune supplies a Scar-consequence proposal for a one-step normal Overall Event Failure.", severity: "error" }]);
});
test("session binding emits exactly one canonical mismatch diagnostic", () => {
  const result = analyzeVoyageEncounterNegativeSteps(request({ completedRoundHistory: history(undefined, { sessionId: "other" }) }));
  assert.deepEqual(result.errors, [{ code: "m8-session-identity-mismatch", path: "completedRoundHistory.sessionId", message: "Request sessionId must match completed history sessionId.", severity: "error" }]);
});
test("mixed histories calculate uncapped Failure Points while Negative Steps remain capped", () => {
  const rounds = Array.from({ length: 11 }, (_, i) => ({ roundId: `r${i + 1}`, roundNumber: i + 1 }));
  const results = Array.from({ length: 11 }, () => "critical-round-failure");
  const eventDefinition = definition({ roundCount: 11, rounds, misfortunes: [misfortune("delay", ["e1", "e2"])], misfortuneEnhancements: [enhancement("e1", ["delay"]), enhancement("e2", ["delay"])] });
  const completedRoundHistory = history(results, { roundCount: 11, rounds: results.map((roundResult, i) => ({ roundId: `r${i + 1}`, roundNumber: i + 1, roundResult })) });
  const result = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition, completedRoundHistory, negativeSelection: { misfortuneId: "delay", enhancementIds: ["e1", "e2"] } }));
  assert.equal(result.ok, true); assert.equal(result.failurePoints, 22); assert.equal(result.negativeSteps, 3); assert.equal(result.overallFailureDegree, "critical");
  const mixed = analyzeVoyageEncounterNegativeSteps(request({ completedRoundHistory: history(["critical-round-failure", "round-failure", "round-success"]) }));
  assert.equal(mixed.ok, true); assert.equal(mixed.failurePoints, 3); assert.equal(mixed.negativeSteps, 1); assert.equal(mixed.overallFailureDegree, "normal");
});
test("two- and three-step sufficiency reject catalogs without enough legal distinct enhancements", () => {
  const twoStep = definition({ misfortunes: [misfortune("delay", ["e1"]), misfortune("other")], misfortuneEnhancements: [enhancement("e1", ["other"])] });
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: twoStep, completedRoundHistory: history(["critical-round-failure", "critical-round-failure", "round-success"]) })).errors, [{ code: "m8-insufficient-authored-misfortune-options", path: "eventDefinition.misfortunes", message: "The authored Misfortune catalog cannot form any legal package consuming the calculated Negative Steps.", severity: "error" }]);
  const threeStep = definition({ misfortunes: [misfortune("delay", ["e1"])], misfortuneEnhancements: [enhancement("e1", ["delay"])] });
  assert.deepEqual(analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: threeStep, completedRoundHistory: history(["critical-round-failure", "critical-round-failure", "critical-round-failure"]) })).errors, [{ code: "m8-insufficient-authored-misfortune-options", path: "eventDefinition.misfortunes", message: "The authored Misfortune catalog cannot form any legal package consuming the calculated Negative Steps.", severity: "error" }]);
});
test("unknown selected enhancements and unselected proposals remain excluded", () => {
  const eventDefinition = definition({ misfortunes: [misfortune("safe"), misfortune("delay", ["e1"], proposal)], misfortuneEnhancements: [enhancement("e1", ["delay"])] });
  const unknown = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition, completedRoundHistory: history(["critical-round-failure", "critical-round-failure", "round-success"]), negativeSelection: { misfortuneId: "delay", enhancementIds: ["missing"] } }));
  assert.deepEqual(unknown.errors, [{ code: "m8-invalid-negative-selection", path: "negativeSelection.enhancementIds[0]", message: "Negative selection shape or identity is invalid.", severity: "error" }]);
  const selectedSafe = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition, negativeSelection: { misfortuneId: "safe", enhancementIds: [] } }));
  assert.equal(selectedSafe.ok, true); assert.deepEqual(selectedSafe.negativePackage.scarConsequenceProposals, []); assert.equal(selectedSafe.negativePackage.misfortuneId, "safe");
});
test("hostile, non-plain, revoked, cyclic, sparse, symbol, and accessor inputs fail closed", () => {
  const revoked = Proxy.revocable(request(), {}); revoked.revoke(); assert.equal(analyzeVoyageEncounterNegativeSteps(revoked.proxy).errors[0].code, "m8-hostile-data-capture-failed");
  assert.equal(analyzeVoyageEncounterNegativeSteps(() => {}).errors[0].code, "m8-hostile-data-capture-failed");
  const cyclic = request(); cyclic.self = cyclic; assert.equal(analyzeVoyageEncounterNegativeSteps(cyclic).errors[0].code, "m8-hostile-data-capture-failed");
  const accessor = request(); Object.defineProperty(accessor, "sessionId", { enumerable: true, get() { throw new Error("trap"); } }); assert.equal(analyzeVoyageEncounterNegativeSteps(accessor).errors[0].code, "m8-hostile-data-capture-failed");
});
test("M8 Scar proposals cannot cross the Milestone 7 Pressure Breach creation boundary", () => {
  const pair = m7SourceWithM8Proposal();
  const eventBefore = structuredClone(pair.event);
  const shipBefore = structuredClone(pair.ship);
  const requestBefore = structuredClone(pair.request);
  const proposalBefore = structuredClone(pair.m8Proposal);
  const analysis = analyzeVoyagePressureBreachVoidScarCreation(pair.ship, pair.event, pair.request);
  assert.equal(analysis.readyForVoidScarCreation, false);
  assert.equal(analysis.voidScar, null);
  assert.ok(analysis.errors.length > 0);
  const applied = applyVoyagePressureBreachVoidScarCreation(pair.ship, pair.event, pair.request);
  assert.equal(applied.ok, false);
  assert.equal(applied.nextState, null);
  assert.deepEqual(applied.events, []);
  assert.deepEqual(pair.event, eventBefore);
  assert.deepEqual(pair.ship, shipBefore);
  assert.deepEqual(pair.request, requestBefore);
  assert.deepEqual(pair.m8Proposal, proposalBefore);
  assert.equal(JSON.stringify(pair.m8Proposal), JSON.stringify({ voidScarDefinitionId: "scar-definition-id", pressureSystemId: "arkengine", source: "m8-critical-overall-failure" }));
});
test("malformed and multiple next situations use the canonical diagnostic", () => {
  const malformed = definition({ nextSituations: [{ ...next, title: "" }] }); const many = definition({ nextSituations: [next, next] });
  for (const eventDefinition of [malformed, many]) { const result = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition })); assert.equal(result.errors[0].code, "m8-invalid-next-situation"); assert.equal(result.errors[0].path, "eventDefinition.nextSituations"); assert.equal(result.errors[0].severity, "error"); }
});
test("missing next situation is reported only after a valid failing definition", () => {
  const result = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: definition({ nextSituations: [] }) })); assert.equal(result.errors[0].code, "m8-missing-next-situation");
});
test("overall success is rejected without fabricating Negative Steps", () => {
  const result = analyzeVoyageEncounterNegativeSteps(request({ completedRoundHistory: history(["round-success", "round-success", "round-failure"]) }));
  assert.equal(result.errors[0].code, "m8-negative-analysis-on-success"); assert.equal(result.negativeSteps, null); assert.equal(result.negativePackage, null);
});
test("one-step normal failure selects a zero-enhancement Misfortune and preserves no Scar proposal", () => {
  const result = analyzeVoyageEncounterNegativeSteps(request()); assert.equal(result.ok, true); assert.equal(result.failurePoints, 2); assert.equal(result.negativeSteps, 1); assert.equal(result.overallFailureDegree, "normal"); assert.deepEqual(result.negativePackage.enhancementIds, []); assert.deepEqual(result.negativePackage.scarConsequenceProposals, []);
});
test("normal one-step Scar proposal is rejected after selection validation", () => {
  const d = definition({ misfortunes: [misfortune("safe"), misfortune("delay", [], proposal)], misfortuneEnhancements: [] }); const result = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: d, negativeSelection: { misfortuneId: "delay", enhancementIds: [] } })); assert.equal(result.errors[0].code, "m8-scar-consequence-not-allowed-on-normal-failure");
});
test("critical failure produces two steps and a selected enhancement", () => {
  const d = definition({ misfortunes: [misfortune("delay", ["e1"])], misfortuneEnhancements: [enhancement("e1", ["delay"])] });
  const result = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: d, completedRoundHistory: history(["critical-round-failure", "critical-round-failure", "round-success"]), negativeSelection: { misfortuneId: "delay", enhancementIds: ["e1"] } }));
  assert.equal(result.ok, true); assert.equal(result.failurePoints, 4); assert.equal(result.negativeSteps, 2); assert.equal(result.negativePackage.enhancements.length, 1);
});
test("three-step cap is retained and requires two distinct compatible enhancements", () => {
  const d = definition({ misfortunes: [misfortune("delay", ["e1", "e2"])], misfortuneEnhancements: [enhancement("e1", ["delay"]), enhancement("e2", ["delay"])] });
  const result = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: d, completedRoundHistory: history(["critical-round-failure", "critical-round-failure", "critical-round-failure"]), negativeSelection: { misfortuneId: "delay", enhancementIds: ["e1", "e2"] } }));
  assert.equal(result.ok, true); assert.equal(result.failurePoints, 6); assert.equal(result.negativeSteps, 3); assert.equal(result.negativePackage.enhancementIds.length, 2);
});
test("two- and three-step results preserve complete authoritative envelopes", () => {
  const twoDefinition = definition({ misfortunes: [misfortune("delay", ["e1"])], misfortuneEnhancements: [enhancement("e1", ["delay"])] });
  const two = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: twoDefinition, completedRoundHistory: history(["critical-round-failure", "critical-round-failure", "round-success"]), negativeSelection: { misfortuneId: "delay", enhancementIds: ["e1"] } }));
  assert.equal(two.ok, true); assert.deepEqual(Object.keys(two), ["ok", "readyForNegativeSteps", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "winningThreshold", "overallResult", "failurePoints", "negativeSteps", "overallFailureDegree", "negativePackage", "errors", "warnings"]); assert.deepEqual(two.negativePackage, { misfortuneId: "delay", enhancementIds: ["e1"], misfortune: { misfortuneId: "delay", kind: "travel-delay", title: "delay", description: "delay description", tags: ["hazard"], persistence: "temporary", enhancementIds: ["e1"], scarConsequenceProposal: null }, enhancements: [enhancement("e1", ["delay"])], nextSituation: next, scarConsequenceProposals: [] }); assert.deepEqual(two.errors, []); assert.deepEqual(two.warnings, []);
  const threeDefinition = definition({ misfortunes: [misfortune("delay", ["e1", "e2"])], misfortuneEnhancements: [enhancement("e1", ["delay"]), enhancement("e2", ["delay"])] });
  const three = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: threeDefinition, completedRoundHistory: history(["critical-round-failure", "critical-round-failure", "critical-round-failure"]), negativeSelection: { misfortuneId: "delay", enhancementIds: ["e1", "e2"] } }));
  assert.equal(three.ok, true); assert.equal(three.failurePoints, 6); assert.equal(three.negativeSteps, 3); assert.equal(three.overallFailureDegree, "critical"); assert.deepEqual(three.negativePackage.enhancements, [enhancement("e1", ["delay"]), enhancement("e2", ["delay"])]); assert.deepEqual(three.errors, []); assert.deepEqual(three.warnings, []);
});
test("selection count and compatible listed enhancements are validated", () => {
  const count = analyzeVoyageEncounterNegativeSteps(request({ negativeSelection: { misfortuneId: "delay", enhancementIds: ["e1"] } })); assert.equal(count.errors[0].code, "m8-negative-selection-step-mismatch");
  const duplicate = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: definition({ misfortunes: [misfortune("delay", ["e1"])], misfortuneEnhancements: [enhancement("e1", ["delay"])] }), completedRoundHistory: history(["critical-round-failure", "critical-round-failure", "round-success"]), negativeSelection: { misfortuneId: "delay", enhancementIds: ["e1"] } })); assert.equal(duplicate.errors.length, 0); assert.equal(duplicate.ok, true);
  const incompatible = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: definition({ misfortunes: [misfortune("delay", ["e1"])], misfortuneEnhancements: [enhancement("e1", ["other"])] }) })); assert.equal(incompatible.errors[0].code, "m8-unresolved-compatible-misfortune-reference");
});
test("duplicate negative selection returns the complete canonical failure envelope", () => {
  const eventDefinition = definition({ misfortunes: [misfortune("delay", ["e1", "e2"])], misfortuneEnhancements: [enhancement("e1", ["delay"]), enhancement("e2", ["delay"])] });
  const result = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition, completedRoundHistory: history(["critical-round-failure", "critical-round-failure", "critical-round-failure"]), negativeSelection: { misfortuneId: "delay", enhancementIds: ["e1", "e1"] } }));
  assert.deepEqual(result, failed([{ code: "m8-duplicate-negative-selection-enhancement", path: "negativeSelection.enhancementIds[1]", message: "The same Misfortune enhancement was selected twice.", severity: "error" }]));
});
test("selection resolves only selected descriptors and exact package keys", () => {
  const result = analyzeVoyageEncounterNegativeSteps(request()); assert.deepEqual(Object.keys(result.negativePackage), ["misfortuneId", "enhancementIds", "misfortune", "enhancements", "nextSituation", "scarConsequenceProposals"]); assert.equal(result.negativePackage.misfortuneId, "delay"); assert.equal(result.negativePackage.misfortune.misfortuneId, "delay");
});
test("insufficient authored options precede missing next and selection diagnostics", () => {
  const d = definition({ misfortunes: [misfortune("delay", ["e1"], proposal)], misfortuneEnhancements: [enhancement("e1", ["delay"])], nextSituations: [] });
  const result = analyzeVoyageEncounterNegativeSteps(request({ eventDefinition: d })); assert.equal(result.errors[0].code, "m8-insufficient-authored-misfortune-options");
});
test("input, returned values, repeated calls, and cross-call state are isolated", () => {
  const first = request(); const snapshot = JSON.stringify(first); const a = analyzeVoyageEncounterNegativeSteps(first); const b = analyzeVoyageEncounterNegativeSteps(first); assert.equal(JSON.stringify(first), snapshot); assert.deepEqual(a, b); a.negativePackage.misfortune.tags.push("changed"); const c = analyzeVoyageEncounterNegativeSteps(request()); assert.deepEqual(c.negativePackage.misfortune.tags, ["hazard"]);
});
test("all failures use complete null sentinels and empty warnings", () => {
  const result = analyzeVoyageEncounterNegativeSteps(request({ negativeSelection: { misfortuneId: "missing", enhancementIds: [] } })); assert.equal(result.ok, false); for (const key of ["eventId", "sessionId", "definitionSnapshotId", "roundCount", "winningThreshold", "overallResult", "failurePoints", "negativeSteps", "overallFailureDegree", "negativePackage"]) assert.equal(result[key], null); assert.deepEqual(result.warnings, []);
});
test("analysis is deterministic and has no legacy history-shape diagnostic", () => {
  const malformed = request({ completedRoundHistory: history(["round-failure", "round-failure", "round-success"], { rounds: [{ roundId: "r2", roundNumber: 2, roundResult: "round-failure" }, { roundId: "r1", roundNumber: 1, roundResult: "round-failure" }, { roundId: "r3", roundNumber: 3, roundResult: "round-success" }] }) }); const a = analyzeVoyageEncounterNegativeSteps(malformed); const b = analyzeVoyageEncounterNegativeSteps(malformed); assert.deepEqual(a, b); assert.equal(a.errors.some((entry) => entry.code === "m8-invalid-history-shape"), false);
});
