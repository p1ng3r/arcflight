import assert from "node:assert/strict";
import test from "node:test";
import { analyzeVoyageEncounterRewardAllocation } from "../../../scripts/voyage/domain/reward-allocation.js";

const next = { nextSituationId: "next-a", title: "Retreat", summary: "Retreat safely.", transitionKind: "retreat" };
function reward(rewardId, enhancementIds = [], kind = "item", extra = {}) {
  return { rewardId, kind, title: rewardId, description: `${rewardId} description`, tags: ["authored"], enhancementIds, voidFortune: null, fieldRepairResource: null, ...extra };
}
function enhancement(enhancementId, compatibleRewardIds = [], compatibleRewardKinds = ["item"]) {
  return { enhancementId, title: enhancementId, description: `${enhancementId} description`, compatibleRewardIds, compatibleRewardKinds, maxApplicationsPerReward: 1 };
}
function definition({ roundCount = 3, rewards = [reward("r1", ["e1", "e2"])], enhancements = [enhancement("e1"), enhancement("e2", ["r1"])], rounds, nextSituations = [next], ...extra } = {}) {
  const authoredRounds = rounds ?? Array.from({ length: roundCount }, (_, index) => ({ roundId: `r${index + 1}`, roundNumber: index + 1 }));
  return { schemaVersion: 1, eventId: "event-a", definitionSnapshotId: "snapshot-a", roundCount, rounds: authoredRounds, rewards, enhancements, misfortuneEnhancements: [], misfortunes: [], nextSituations, ...extra };
}
function history(eventDefinition, results = Array(eventDefinition.roundCount).fill("round-success"), overrides = {}) {
  return { schemaVersion: 1, eventId: eventDefinition.eventId, sessionId: "session-a", definitionSnapshotId: eventDefinition.definitionSnapshotId, roundCount: eventDefinition.roundCount, rounds: eventDefinition.rounds.map((round, index) => ({ ...round, roundResult: results[index] })), ...overrides };
}
function allocation(eventDefinition, rewardSelections = [{ operation: "add-reward", rewardId: "r1", enhancementId: null }], overrides = {}) {
  return { eventId: eventDefinition.eventId, sessionId: "session-a", rewardSelections, ...overrides };
}
function request({ eventDefinition = definition(), completedRoundHistory = history(eventDefinition), sessionId = "session-a", allocation: selected = allocation(eventDefinition), ...extra } = {}) {
  return { kind: "m8-reward-allocation", sessionId, eventDefinition, completedRoundHistory, allocation: selected, ...extra };
}
function failure(errors) {
  return { ok: false, readyForRewardAllocation: false, eventId: null, sessionId: null, definitionSnapshotId: null, rewardSteps: null, rewardSelections: [], allocatedRewards: [], errors, warnings: [] };
}
function diagnostic(code, path, message) { return { code, path, message, severity: "error" }; }
function fourRoundDefinition(overrides = {}) {
  return definition({ roundCount: 4, rounds: [1, 2, 3, 4].map((roundNumber) => ({ roundId: `r${roundNumber}`, roundNumber })), ...overrides });
}
function reorder(value, keys) { const output = {}; for (const key of keys) output[key] = value[key]; return output; }
function validThreeStepDefinition() {
  return definition({ rewards: [reward("r1", ["e1", "e2"]), reward("r2", ["e1"]), reward("r3")], enhancements: [enhancement("e1"), enhancement("e2", ["r1"])] });
}

test("exports exactly the allocation analyzer", async () => {
  const module = await import("../../../scripts/voyage/domain/reward-allocation.js");
  assert.deepEqual(Object.keys(module), ["analyzeVoyageEncounterRewardAllocation"]);
});

test("one-step add-reward returns the exact isolated success envelope", () => {
  const result = analyzeVoyageEncounterRewardAllocation(request());
  assert.deepEqual(Object.keys(result), ["ok", "readyForRewardAllocation", "eventId", "sessionId", "definitionSnapshotId", "rewardSteps", "rewardSelections", "allocatedRewards", "errors", "warnings"]);
  assert.deepEqual(result, { ok: true, readyForRewardAllocation: true, eventId: "event-a", sessionId: "session-a", definitionSnapshotId: "snapshot-a", rewardSteps: 1, rewardSelections: [{ operation: "add-reward", rewardId: "r1", enhancementId: null }], allocatedRewards: [{ rewardId: "r1", enhancementIds: [] }], errors: [], warnings: [] });
});

test("two steps support separate rewards and preserve first-add order", () => {
  const eventDefinition = definition({ rewards: [reward("r1"), reward("r2")], enhancements: [] });
  const result = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: history(eventDefinition, ["critical-round-success", "critical-round-success", "round-failure"]), allocation: allocation(eventDefinition, [{ operation: "add-reward", rewardId: "r2", enhancementId: null }, { operation: "add-reward", rewardId: "r1", enhancementId: null }]) }));
  assert.equal(result.rewardSteps, 2);
  assert.deepEqual(result.allocatedRewards, [{ rewardId: "r2", enhancementIds: [] }, { rewardId: "r1", enhancementIds: [] }]);
});

test("two steps support one reward followed by one compatible enhancement", () => {
  const eventDefinition = definition();
  const result = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: history(eventDefinition, ["critical-round-success", "critical-round-success", "round-failure"]), allocation: allocation(eventDefinition, [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "enhance-reward", rewardId: "r1", enhancementId: "e1" }]) }));
  assert.deepEqual(result.rewardSelections, [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "enhance-reward", rewardId: "r1", enhancementId: "e1" }]);
  assert.deepEqual(result.allocatedRewards, [{ rewardId: "r1", enhancementIds: ["e1"] }]);
});

test("three steps support two rewards plus one enhancement", () => {
  const eventDefinition = validThreeStepDefinition();
  const result = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: history(eventDefinition, ["critical-round-success", "critical-round-success", "critical-round-success"]), allocation: allocation(eventDefinition, [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "add-reward", rewardId: "r2", enhancementId: null }, { operation: "enhance-reward", rewardId: "r1", enhancementId: "e1" }]) }));
  assert.deepEqual(result.allocatedRewards, [{ rewardId: "r1", enhancementIds: ["e1"] }, { rewardId: "r2", enhancementIds: [] }]);
  const shared = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: history(eventDefinition, ["critical-round-success", "critical-round-success", "critical-round-success"]), allocation: allocation(eventDefinition, [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "add-reward", rewardId: "r2", enhancementId: null }, { operation: "enhance-reward", rewardId: "r2", enhancementId: "e1" }]) }));
  assert.deepEqual(shared.allocatedRewards, [{ rewardId: "r1", enhancementIds: [] }, { rewardId: "r2", enhancementIds: ["e1"] }]);
});

test("three steps preserve two ordered enhancements on one reward", () => {
  const eventDefinition = definition({ rewards: [reward("r1", ["e1", "e2"])], enhancements: [enhancement("e1"), enhancement("e2", ["r1"])] });
  const result = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: history(eventDefinition, ["critical-round-success", "critical-round-success", "critical-round-success"]), allocation: allocation(eventDefinition, [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "enhance-reward", rewardId: "r1", enhancementId: "e2" }, { operation: "enhance-reward", rewardId: "r1", enhancementId: "e1" }]) }));
  assert.deepEqual(result.allocatedRewards, [{ rewardId: "r1", enhancementIds: ["e2", "e1"] }]);
});

test("three separate rewards consume three explicit Reward Steps", () => {
  const eventDefinition = definition({ rewards: [reward("r1"), reward("r2"), reward("r3")], enhancements: [] });
  const completedRoundHistory = history(eventDefinition, ["critical-round-success", "critical-round-success", "critical-round-success"]);
  const rewardSelections = [
    { operation: "add-reward", rewardId: "r3", enhancementId: null },
    { operation: "add-reward", rewardId: "r1", enhancementId: null },
    { operation: "add-reward", rewardId: "r2", enhancementId: null }
  ];
  const result = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory, allocation: allocation(eventDefinition, rewardSelections) }));
  assert.deepEqual(result, { ok: true, readyForRewardAllocation: true, eventId: "event-a", sessionId: "session-a", definitionSnapshotId: "snapshot-a", rewardSteps: 3, rewardSelections, allocatedRewards: [{ rewardId: "r3", enhancementIds: [] }, { rewardId: "r1", enhancementIds: [] }, { rewardId: "r2", enhancementIds: [] }], errors: [], warnings: [] });
});

test("under-allocation and over-allocation use exact diagnostics", () => {
  const under = analyzeVoyageEncounterRewardAllocation(request({ allocation: allocation(definition(), []) }));
  assert.deepEqual(under, failure([diagnostic("m8-allocation-underallocated", "allocation.rewardSelections", "Allocation selection count is below calculated Reward Steps.")]));
  const over = analyzeVoyageEncounterRewardAllocation(request({ completedRoundHistory: history(definition(), ["critical-round-success", "critical-round-success", "critical-round-success"]), allocation: allocation(definition(), [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "add-reward", rewardId: "r1", enhancementId: null }]) }));
  assert.deepEqual(over.errors, [diagnostic("m8-allocation-exceeds-reward-steps", "allocation.rewardSelections", "Allocation selection count exceeds calculated Reward Steps.")]);
});

test("enhancement must target an earlier reward and resolve compatibility", () => {
  const before = analyzeVoyageEncounterRewardAllocation(request({ completedRoundHistory: history(definition(), ["critical-round-success", "critical-round-success", "round-failure"]), allocation: allocation(definition(), [{ operation: "enhance-reward", rewardId: "r1", enhancementId: "e1" }, { operation: "add-reward", rewardId: "r1", enhancementId: null }]) }));
  assert.deepEqual(before.errors, [diagnostic("m8-unsupported-enhancement-target", "allocation.rewardSelections[0]", "Enhancement is incompatible with its target.")]);
  const unlisted = analyzeVoyageEncounterRewardAllocation(request({ completedRoundHistory: history(definition(), ["critical-round-success", "critical-round-success", "round-failure"]), allocation: allocation(definition(), [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "enhance-reward", rewardId: "r1", enhancementId: "missing" }]) }));
  assert.deepEqual(unlisted.errors, [diagnostic("m8-unsupported-enhancement-target", "allocation.rewardSelections[1]", "Enhancement is incompatible with its target.")]);
  const incompatible = definition({ rewards: [reward("r1", ["e1"]), reward("other")], enhancements: [enhancement("e1", ["other"]) ] });
  const result = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition: incompatible, completedRoundHistory: history(incompatible, ["critical-round-success", "critical-round-success", "round-failure"]), allocation: allocation(incompatible, [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "enhance-reward", rewardId: "r1", enhancementId: "e1" }]) }));
  assert.deepEqual(result.errors, [diagnostic("m8-unsupported-enhancement-target", "allocation.rewardSelections[1]", "Enhancement is incompatible with its target.")]);
});

test("duplicate add and duplicate enhancement report the later operation", () => {
  const duplicateAdd = analyzeVoyageEncounterRewardAllocation(request({ completedRoundHistory: history(definition(), ["critical-round-success", "critical-round-success", "round-failure"]), allocation: allocation(definition(), [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "add-reward", rewardId: "r1", enhancementId: null }]) }));
  assert.deepEqual(duplicateAdd.errors, [diagnostic("m8-duplicate-selection", "allocation.rewardSelections[1]", "A duplicate reward or enhancement operation was supplied.")]);
  const duplicateEnhancement = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition: validThreeStepDefinition(), completedRoundHistory: history(validThreeStepDefinition(), ["critical-round-success", "critical-round-success", "critical-round-success"]), allocation: allocation(validThreeStepDefinition(), [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "enhance-reward", rewardId: "r1", enhancementId: "e1" }, { operation: "enhance-reward", rewardId: "r1", enhancementId: "e1" }]) }));
  assert.deepEqual(duplicateEnhancement.errors, [diagnostic("m8-duplicate-selection", "allocation.rewardSelections[2]", "A duplicate reward or enhancement operation was supplied.")]);
});

test("unknown added rewards use the allocation diagnostic", () => {
  const result = analyzeVoyageEncounterRewardAllocation(request({ allocation: allocation(definition(), [{ operation: "add-reward", rewardId: "missing", enhancementId: null }]) }));
  assert.deepEqual(result.errors, [diagnostic("m8-invalid-reward-allocation", "allocation", "Allocation shape is invalid.")]);
});

test("allocation event and session bindings preserve order", () => {
  const eventDefinition = definition();
  const both = analyzeVoyageEncounterRewardAllocation(request({ allocation: allocation(eventDefinition, [{ operation: "add-reward", rewardId: "r1", enhancementId: null }], { eventId: "other-event", sessionId: "other-session" }) }));
  assert.deepEqual(both.errors, [diagnostic("m8-allocation-event-mismatch", "allocation.eventId", "Allocation eventId must match completed history eventId."), diagnostic("m8-allocation-session-mismatch", "allocation.sessionId", "Allocation sessionId must match request sessionId.")]);
});

test("request/history bindings precede allocation identity validation", () => {
  const eventDefinition = definition();
  const historySession = history(eventDefinition, undefined, { sessionId: "history-session" });
  const session = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: historySession, allocation: allocation(eventDefinition, [{ operation: "add-reward", rewardId: "r1", enhancementId: null }], { sessionId: "other-session" }) }));
  assert.deepEqual(session.errors, [diagnostic("m8-session-identity-mismatch", "completedRoundHistory.sessionId", "Request sessionId must match completed history sessionId.")]);
  const eventHistory = history(eventDefinition, undefined, { eventId: "other-event" });
  const event = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: eventHistory, allocation: allocation(eventDefinition) }));
  assert.deepEqual(event.errors, [diagnostic("m8-event-identity-mismatch", "completedRoundHistory.eventId", "Completed history eventId must match Event Definition.")]);
  const snapshotHistory = history(eventDefinition, undefined, { definitionSnapshotId: "other-snapshot" });
  const snapshot = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: snapshotHistory, allocation: allocation(eventDefinition) }));
  assert.deepEqual(snapshot.errors, [diagnostic("m8-definition-snapshot-mismatch", "completedRoundHistory.definitionSnapshotId", "Completed history definitionSnapshotId must match Event Definition.")]);
});

test("category-seven binding precedes Task 1 round-count validity", () => {
  const eventDefinition = fourRoundDefinition();
  const mismatched = history(eventDefinition, ["round-success", "round-success", "round-success", "round-success"], { sessionId: "other-session" });
  const result = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: mismatched, allocation: allocation(eventDefinition) }));
  assert.deepEqual(result.errors, [diagnostic("m8-session-identity-mismatch", "completedRoundHistory.sessionId", "Request sessionId must match completed history sessionId.")]);
  const bound = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: history(eventDefinition, ["round-success", "round-success", "round-success", "round-success"]), allocation: allocation(eventDefinition) }));
  assert.deepEqual(bound.errors, [diagnostic("m8-invalid-round-count", "eventDefinition.roundCount", "Event Definition roundCount must be one of 3, 5, 7, 9, or 11.")]);
  const allMismatched = history(eventDefinition, ["round-success", "round-success", "round-success", "round-success"], { eventId: "other-event", sessionId: "other-session", definitionSnapshotId: "other-snapshot" });
  const all = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: allMismatched, allocation: allocation(eventDefinition) }));
  assert.deepEqual(all.errors, [diagnostic("m8-event-identity-mismatch", "completedRoundHistory.eventId", "Completed history eventId must match Event Definition."), diagnostic("m8-session-identity-mismatch", "completedRoundHistory.sessionId", "Request sessionId must match completed history sessionId."), diagnostic("m8-definition-snapshot-mismatch", "completedRoundHistory.definitionSnapshotId", "Completed history definitionSnapshotId must match Event Definition.")]);
});

test("malformed history roots remain Task 1-owned before category-seven binding", () => {
  const eventDefinition = fourRoundDefinition();
  const canonical = history(eventDefinition, ["round-success", "round-success", "round-success", "round-success"]);
  const missing = { ...canonical }; delete missing.eventId;
  const reordered = reorder(canonical, ["sessionId", "schemaVersion", "eventId", "definitionSnapshotId", "roundCount", "rounds"]);
  const cases = [
    ["blank identity", { ...canonical, eventId: "" }],
    ["non-string identity", { ...canonical, eventId: 42 }],
    ["missing canonical key", missing],
    ["extra root key", { ...canonical, extra: true }],
    ["reordered root keys", reordered]
  ];
  const expected = failure([diagnostic("m8-invalid-round-count", "eventDefinition.roundCount", "Event Definition roundCount must be one of 3, 5, 7, 9, or 11.")]);
  for (const [label, completedRoundHistory] of cases) {
    const result = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory, allocation: allocation(eventDefinition) }));
    assert.deepEqual(result, expected, label);
    assert.equal(result.errors.some(({ code }) => ["m8-event-identity-mismatch", "m8-session-identity-mismatch", "m8-definition-snapshot-mismatch"].includes(code)), false, label);
    assert.deepEqual(result.warnings, [], label);
  }
});

test("catalog and compatibility diagnostics precede category-seven binding", () => {
  const eventDefinition = definition({ rewards: [reward("r1", ["missing"])], enhancements: [] });
  const result = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory: history(eventDefinition, undefined, { eventId: "other-event" }), allocation: allocation(eventDefinition) }));
  assert.deepEqual(result.errors, [diagnostic("m8-unresolved-reward-enhancement-reference", "eventDefinition.rewards[0].enhancementIds[0]", "Reward enhancement identity does not resolve exactly once.")]);
});

test("failed Event, no rewards, and insufficient catalog precede allocation validation", () => {
  const failedDefinition = definition();
  const failedEvent = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition: failedDefinition, completedRoundHistory: history(failedDefinition, ["round-failure", "round-failure", "round-success"]), allocation: allocation(failedDefinition) }));
  assert.deepEqual(failedEvent.errors, [diagnostic("m8-reward-analysis-on-failure", "overallResult", "Reward analysis was requested for a failed Event.")]);
  const noRewards = definition({ rewards: [], enhancements: [] });
  const noRewardResult = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition: noRewards, completedRoundHistory: history(noRewards), allocation: allocation(noRewards) }));
  assert.deepEqual(noRewardResult.errors, [diagnostic("m8-no-authored-rewards", "eventDefinition.rewards", "Reward Step analysis has no valid authored reward definition.")]);
  const insufficient = definition({ rewards: [reward("r1")], enhancements: [] });
  const insufficientResult = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition: insufficient, completedRoundHistory: history(insufficient, ["critical-round-success", "critical-round-success", "critical-round-success"]), allocation: allocation(insufficient) }));
  assert.deepEqual(insufficientResult.errors, [diagnostic("m8-insufficient-authored-reward-options", "eventDefinition.rewards", "The authored reward and enhancement catalog cannot form any legal allocation consuming the calculated Reward Steps.")]);
});

test("two-step authored insufficiency precedes malformed caller allocation", () => {
  const sufficientDefinition = definition({ rewards: [reward("r1"), reward("r2")], enhancements: [] });
  const twoStepHistory = history(sufficientDefinition, ["critical-round-success", "critical-round-success", "round-failure"]);
  const sufficient = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition: sufficientDefinition, completedRoundHistory: twoStepHistory, allocation: allocation(sufficientDefinition, [{ operation: "add-reward", rewardId: "r1", enhancementId: null }, { operation: "add-reward", rewardId: "r2", enhancementId: null }]) }));
  assert.equal(sufficient.ok, true);
  assert.equal(sufficient.rewardSteps, 2);
  const insufficientDefinition = definition({ rewards: [reward("only")], enhancements: [] });
  const insufficientHistory = history(insufficientDefinition, ["critical-round-success", "critical-round-success", "round-failure"]);
  assert.deepEqual(analyzeVoyageEncounterRewardAllocation(request({ eventDefinition: insufficientDefinition, completedRoundHistory: insufficientHistory, allocation: null })), failure([diagnostic("m8-insufficient-authored-reward-options", "eventDefinition.rewards", "The authored reward and enhancement catalog cannot form any legal allocation consuming the calculated Reward Steps.")]));
});

test("authority, mode, and exact request shape precedence are exact", () => {
  const base = request();
  const authority = { ...base, nextState: {}, overallResult: "overall-success", rewardSteps: 1 };
  const result = analyzeVoyageEncounterRewardAllocation(authority);
  assert.deepEqual(result.errors, [diagnostic("m8-caller-authored-plan-rejected", "request.nextState", "Caller-authored result plans are not accepted."), diagnostic("m8-caller-authored-plan-rejected", "request.overallResult", "Caller-authored result plans are not accepted."), diagnostic("m8-caller-authored-plan-rejected", "request.rewardSteps", "Caller-authored result plans are not accepted.")]);
  const mode = analyzeVoyageEncounterRewardAllocation({ ...base, kind: "bad", extra: true });
  assert.deepEqual(mode.errors, [diagnostic("m8-invalid-mode", "request.kind", "Only m8-reward-allocation analysis is supported.")]);
  const shape = analyzeVoyageEncounterRewardAllocation(reorder(base, ["sessionId", "kind", "eventDefinition", "completedRoundHistory", "allocation"]));
  assert.deepEqual(shape.errors, [diagnostic("m8-invalid-request-shape", "request", "Request has an invalid exact shape.")]);
});

test("allocation and selection key order and values are exact", () => {
  const base = request();
  const reorderedAllocation = analyzeVoyageEncounterRewardAllocation({ ...base, allocation: reorder(base.allocation, ["sessionId", "eventId", "rewardSelections"]) });
  assert.deepEqual(reorderedAllocation.errors, [diagnostic("m8-invalid-reward-allocation", "allocation", "Allocation shape is invalid.")]);
  const reorderedSelection = analyzeVoyageEncounterRewardAllocation({ ...base, allocation: { ...base.allocation, rewardSelections: [reorder(base.allocation.rewardSelections[0], ["rewardId", "operation", "enhancementId"])] } });
  assert.deepEqual(reorderedSelection.errors, [diagnostic("m8-invalid-reward-allocation", "allocation", "Allocation shape is invalid.")]);
  const extraRequest = analyzeVoyageEncounterRewardAllocation({ ...base, extra: true });
  assert.deepEqual(extraRequest.errors, [diagnostic("m8-invalid-request-shape", "request", "Request has an invalid exact shape.")]);
  const extraAllocation = analyzeVoyageEncounterRewardAllocation({ ...base, allocation: { ...base.allocation, extra: true } });
  assert.deepEqual(extraAllocation.errors, [diagnostic("m8-invalid-reward-allocation", "allocation", "Allocation shape is invalid.")]);
  const extraSelection = analyzeVoyageEncounterRewardAllocation({ ...base, allocation: { ...base.allocation, rewardSelections: [{ ...base.allocation.rewardSelections[0], extra: true }] } });
  assert.deepEqual(extraSelection.errors, [diagnostic("m8-invalid-reward-allocation", "allocation", "Allocation shape is invalid.")]);
  for (const malformed of [null, "invalid", 42, []]) assert.deepEqual(analyzeVoyageEncounterRewardAllocation({ ...base, allocation: malformed }), failure([diagnostic("m8-invalid-reward-allocation", "allocation", "Allocation shape is invalid.")]));
  for (const identity of ["", " padded ", "\tvalue"]) {
    const malformed = { ...base.allocation, rewardSelections: [{ operation: "add-reward", rewardId: identity, enhancementId: null }] };
    assert.deepEqual(analyzeVoyageEncounterRewardAllocation({ ...base, allocation: malformed }).errors, [diagnostic("m8-invalid-reward-allocation", "allocation", "Allocation shape is invalid.")]);
  }
  for (const selection of [{ operation: "add-reward", rewardId: "r1", enhancementId: "not-null" }, { operation: "enhance-reward", rewardId: "r1", enhancementId: null }, { operation: "bad", rewardId: "r1", enhancementId: null }]) assert.deepEqual(analyzeVoyageEncounterRewardAllocation({ ...base, allocation: { ...base.allocation, rewardSelections: [selection] } }).errors, [diagnostic("m8-invalid-reward-allocation", "allocation", "Allocation shape is invalid.")]);
});

test("all prohibited authority keys are rejected in captured request order", () => {
  const base = request();
  const keys = ["overallResult", "rewardAnalysis", "negativeAnalysis", "rewardSteps", "negativeSteps", "resultPackage", "allocationPlan", "nextState"];
  const value = { ...base };
  for (const key of keys) value[key] = {};
  const result = analyzeVoyageEncounterRewardAllocation(value);
  assert.deepEqual(result.errors, keys.map((key) => diagnostic("m8-caller-authored-plan-rejected", `request.${key}`, "Caller-authored result plans are not accepted.")));
});

test("ordinary roots and hostile capture return complete deterministic failures", () => {
  for (const value of [null, "invalid", 42, true, []]) assert.deepEqual(analyzeVoyageEncounterRewardAllocation(value), failure([diagnostic("m8-invalid-request-shape", "request", "Request has an invalid exact shape.")]));
  const revoked = Proxy.revocable(request(), {}); revoked.revoke();
  assert.deepEqual(analyzeVoyageEncounterRewardAllocation(revoked.proxy), failure([diagnostic("m8-hostile-data-capture-failed", "$", "Input contains inaccessible or unsafe data.")]));
  const allocationProxy = Proxy.revocable(allocation(definition()), {}); const allocationRequest = request({ allocation: allocationProxy.proxy }); allocationProxy.revoke();
  assert.deepEqual(analyzeVoyageEncounterRewardAllocation(allocationRequest).errors, [diagnostic("m8-hostile-data-capture-failed", "$", "Input contains inaccessible or unsafe data.")]);
  const selectionProxy = Proxy.revocable({ operation: "add-reward", rewardId: "r1", enhancementId: null }, {}); const hostileSelection = request({ allocation: allocation(definition(), [selectionProxy.proxy]) }); selectionProxy.revoke();
  assert.deepEqual(analyzeVoyageEncounterRewardAllocation(hostileSelection).errors, [diagnostic("m8-hostile-data-capture-failed", "$", "Input contains inaccessible or unsafe data.")]);
});

test("getters, cycles, sparse arrays, symbols, functions, bigint, nonfinite, and nonplain values fail closed", () => {
  const getter = request(); Object.defineProperty(getter, "allocation", { enumerable: true, get() { throw new Error("secret"); } });
  const cyclic = request(); cyclic.eventDefinition.cycle = cyclic.eventDefinition;
  const sparse = request(); delete sparse.allocation.rewardSelections[0];
  const symbol = request(); symbol[Symbol("x")] = true;
  const fn = request({ allocation: () => undefined });
  const bigint = request(); bigint.eventDefinition.roundCount = 3n;
  const nonfinite = request(); nonfinite.eventDefinition.roundCount = Infinity;
  const nonplain = request({ allocation: new Date() });
  for (const value of [getter, cyclic, sparse, symbol, fn, bigint, nonfinite, nonplain]) assert.equal(analyzeVoyageEncounterRewardAllocation(value).errors[0].code, "m8-hostile-data-capture-failed");
  const unsafe = request(); Object.defineProperty(unsafe, "__proto__", { enumerable: true, value: 1 });
  assert.equal(analyzeVoyageEncounterRewardAllocation(unsafe).errors[0].code, "m8-hostile-data-capture-failed");
});

test("authored Void Fortune and Field Repair Resource remain descriptive only", () => {
  const fortune = reward("fortune", [], "void-fortune", { voidFortune: { voidFortuneId: "fortune-a", title: "Fortune", description: "Fortune", tags: ["fortune"] } });
  const field = reward("field", [], "field-repair-resource", { fieldRepairResource: { fieldRepairResourceId: "field-a", title: "Field", description: "Field", compatibleScarTags: ["arkengine"], timing: "safe-rest", safeRestRequired: true } });
  const eventDefinition = definition({ rewards: [fortune, field], enhancements: [] });
  const result = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, allocation: allocation(eventDefinition, [{ operation: "add-reward", rewardId: "fortune", enhancementId: null }]) }));
  assert.deepEqual(result.allocatedRewards, [{ rewardId: "fortune", enhancementIds: [] }]);
  assert.equal(JSON.stringify(result).includes("field-a"), false);
});

test("component-safe IDs, caller isolation, returned isolation, determinism, and no mutation hold", () => {
  const eventDefinition = definition({ rewards: [reward("r\u0000x")], enhancements: [] });
  const input = request({ eventDefinition, allocation: allocation(eventDefinition, [{ operation: "add-reward", rewardId: "r\u0000x", enhancementId: null }]) });
  const before = JSON.stringify(input); const first = analyzeVoyageEncounterRewardAllocation(input); const second = analyzeVoyageEncounterRewardAllocation(input);
  assert.deepEqual(first, second); assert.equal(JSON.stringify(input), before);
  first.rewardSelections[0].rewardId = "tampered"; first.allocatedRewards[0].enhancementIds.push("tampered");
  const fresh = analyzeVoyageEncounterRewardAllocation(input); assert.equal(fresh.rewardSelections[0].rewardId, "r\u0000x"); assert.deepEqual(fresh.allocatedRewards, [{ rewardId: "r\u0000x", enhancementIds: [] }]);
  const random = Math.random; Math.random = () => { throw new Error("random"); }; const now = Date.now; Date.now = () => { throw new Error("time"); };
  try { assert.equal(analyzeVoyageEncounterRewardAllocation(input).ok, true); } finally { Math.random = random; Date.now = now; }
  const pairRewardId = "reward\u0000id"; const pairEnhancementId = "enhancement\u0000id";
  const pairDefinition = definition({ rewards: [reward(pairRewardId, [pairEnhancementId])], enhancements: [enhancement(pairEnhancementId, [pairRewardId])] });
  const pairInput = request({ eventDefinition: pairDefinition, completedRoundHistory: history(pairDefinition, ["critical-round-success", "critical-round-success", "round-failure"]), allocation: allocation(pairDefinition, [{ operation: "add-reward", rewardId: pairRewardId, enhancementId: null }, { operation: "enhance-reward", rewardId: pairRewardId, enhancementId: pairEnhancementId }]) });
  const pairResult = analyzeVoyageEncounterRewardAllocation(pairInput);
  assert.equal(pairResult.ok, true);
  assert.deepEqual(pairResult.allocatedRewards, [{ rewardId: pairRewardId, enhancementIds: [pairEnhancementId] }]);
});

test("true delimiter collisions remain distinct through both public allocation paths", () => {
  const firstPair = ["a\u0000b", "c"];
  const secondPair = ["a", "b\u0000c"];
  assert.equal(`${firstPair[0]}\u0000${firstPair[1]}`, `${secondPair[0]}\u0000${secondPair[1]}`);
  assert.notEqual(JSON.stringify(firstPair), JSON.stringify(secondPair));
  const eventDefinition = definition({ rewards: [reward(firstPair[0], [firstPair[1]]), reward(secondPair[0], [secondPair[1]])], enhancements: [enhancement(firstPair[1], [firstPair[0]]), enhancement(secondPair[1], [secondPair[0]])] });
  const completedRoundHistory = history(eventDefinition, ["critical-round-success", "critical-round-success", "round-failure"]);
  const firstSelections = [{ operation: "add-reward", rewardId: firstPair[0], enhancementId: null }, { operation: "enhance-reward", rewardId: firstPair[0], enhancementId: firstPair[1] }];
  const secondSelections = [{ operation: "add-reward", rewardId: secondPair[0], enhancementId: null }, { operation: "enhance-reward", rewardId: secondPair[0], enhancementId: secondPair[1] }];
  const first = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory, allocation: allocation(eventDefinition, firstSelections) }));
  const second = analyzeVoyageEncounterRewardAllocation(request({ eventDefinition, completedRoundHistory, allocation: allocation(eventDefinition, secondSelections) }));
  assert.deepEqual(first, { ok: true, readyForRewardAllocation: true, eventId: "event-a", sessionId: "session-a", definitionSnapshotId: "snapshot-a", rewardSteps: 2, rewardSelections: firstSelections, allocatedRewards: [{ rewardId: firstPair[0], enhancementIds: [firstPair[1]] }], errors: [], warnings: [] });
  assert.deepEqual(second, { ok: true, readyForRewardAllocation: true, eventId: "event-a", sessionId: "session-a", definitionSnapshotId: "snapshot-a", rewardSteps: 2, rewardSelections: secondSelections, allocatedRewards: [{ rewardId: secondPair[0], enhancementIds: [secondPair[1]] }], errors: [], warnings: [] });
  assert.equal(first.rewardSelections.some(({ rewardId }) => rewardId === secondPair[0]), false);
  assert.equal(second.rewardSelections.some(({ rewardId }) => rewardId === firstPair[0]), false);
  assert.equal(first.allocatedRewards.some(({ enhancementIds }) => enhancementIds.includes(secondPair[1])), false);
  assert.equal(second.allocatedRewards.some(({ enhancementIds }) => enhancementIds.includes(firstPair[1])), false);
});

test("all failures retain exact sentinels and empty warnings", () => {
  const result = analyzeVoyageEncounterRewardAllocation(request({ allocation: allocation(definition(), []) }));
  assert.deepEqual(Object.keys(result), ["ok", "readyForRewardAllocation", "eventId", "sessionId", "definitionSnapshotId", "rewardSteps", "rewardSelections", "allocatedRewards", "errors", "warnings"]);
  assert.equal(result.ok, false); assert.equal(result.readyForRewardAllocation, false); assert.equal(result.eventId, null); assert.equal(result.sessionId, null); assert.equal(result.definitionSnapshotId, null); assert.equal(result.rewardSteps, null); assert.deepEqual(result.rewardSelections, []); assert.deepEqual(result.allocatedRewards, []); assert.deepEqual(result.warnings, []);
});
