import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateVoyageEncounterRewardDefinition,
  captureVoyageEncounterRewardDefinition,
  analyzeVoyageEncounterRewardSteps
} from "../../../scripts/voyage/domain/rewards.js";

const RESULTS = ["critical-round-success", "round-success", "round-failure", "critical-round-failure"];
const AUTHORITY = ["overallResult", "rewardAnalysis", "negativeAnalysis", "rewardSteps", "negativeSteps", "resultPackage", "allocationPlan", "nextState"];
const REWARD_FIELDS = ["rewardId", "kind", "title", "description", "tags", "enhancementIds", "voidFortune", "fieldRepairResource"];
const ENHANCEMENT_FIELDS = ["enhancementId", "title", "description", "compatibleRewardIds", "compatibleRewardKinds", "maxApplicationsPerReward"];
const VOID_FIELDS = ["voidFortuneId", "title", "description", "tags"];
const REPAIR_FIELDS = ["fieldRepairResourceId", "title", "description", "compatibleScarTags", "timing", "safeRestRequired"];
const ANALYSIS_FIELDS = ["ok", "readyForRewardSteps", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "winningThreshold", "overallResult", "rewardPoints", "rewardSteps", "rewardDefinitions", "errors", "warnings"];
const MESSAGE = {
  hostile: "Input contains inaccessible or unsafe data.",
  invalidReward: "Reward descriptor shape or fields are invalid.",
  invalidEnhancement: "Enhancement descriptor is invalid.",
  invalidVoid: "Void Fortune descriptor or authored-only rule is invalid.",
  invalidRepair: "Field Repair Resource descriptor is invalid.",
  duplicateReward: "Reward identity is duplicated.",
  duplicateEnhancement: "Reward-enhancement identity is duplicated.",
  unresolvedRewardEnhancement: "Reward enhancement identity does not resolve exactly once.",
  unresolvedCompatibleReward: "Reward compatibility identity does not resolve exactly once.",
  invalidKind: "Reward compatibility kind is not one of the four authored reward kinds.",
  emptyCompatibility: "Both reward compatibility arrays are empty, authoring an unrestricted enhancement.",
  noRewards: "Reward Step analysis has no valid authored reward definition.",
  onFailure: "Reward analysis was requested for a failed Event.",
  insufficient: "The authored reward and enhancement catalog cannot form any legal allocation consuming the calculated Reward Steps."
};

function reward(id = "reward-1", kind = "item", overrides = {}) {
  return { rewardId: id, kind, title: `${id} title`, description: `${id} description`, tags: ["supplies"], enhancementIds: ["enhancement-1"], voidFortune: null, fieldRepairResource: null, ...overrides };
}
function enhancement(id = "enhancement-1", overrides = {}) {
  return { enhancementId: id, title: `${id} title`, description: `${id} description`, compatibleRewardIds: ["reward-1"], compatibleRewardKinds: ["item"], maxApplicationsPerReward: 1, ...overrides };
}
function voidFortune(id = "fortune-1") { return { voidFortuneId: id, title: "Authored fortune", description: "A fortune", tags: ["fortune"] }; }
function fieldRepair(id = "repair-1") { return { fieldRepairResourceId: id, title: "Field repair", description: "A resource", compatibleScarTags: ["arkengine"], timing: "safe-rest", safeRestRequired: true }; }
function definition(roundCount = 3, rewards = [reward()], enhancements = [enhancement()], overrides = {}) {
  return { schemaVersion: 1, eventId: "event-1", definitionSnapshotId: "snapshot-1", roundCount, rounds: Array.from({ length: roundCount }, (_, index) => ({ roundId: `round-${index + 1}`, roundNumber: index + 1 })), rewards, enhancements, misfortuneEnhancements: [], misfortunes: [], nextSituations: [], ...overrides };
}
function history(def, results = Array(def.roundCount).fill("round-success"), overrides = {}) {
  return { schemaVersion: 1, eventId: def.eventId, sessionId: "session-1", definitionSnapshotId: def.definitionSnapshotId, roundCount: def.roundCount, rounds: def.rounds.map((round, index) => ({ ...round, roundResult: results[index] })), ...overrides };
}
function request(def, hist = history(def), overrides = {}) { return { kind: "m8-reward-steps", sessionId: hist.sessionId, eventDefinition: def, completedRoundHistory: hist, ...overrides }; }
function failure(result) {
  assert.equal(result.ok, false); assert.equal(result.readyForRewardSteps, false); assert.deepEqual(Object.keys(result), ANALYSIS_FIELDS); assert.deepEqual(result.warnings, []);
  for (const key of ["eventId", "sessionId", "definitionSnapshotId", "roundCount", "winningThreshold", "overallResult", "rewardPoints", "rewardSteps"]) assert.equal(result[key], null);
  assert.deepEqual(result.rewardDefinitions, []); assert.ok(result.errors.length > 0);
}
function diagnostic(entry, code, path, message) { assert.deepEqual(entry, { code, path, message, severity: "error" }); }

test("exports, capture envelopes, exact keys, semantic preservation, and isolation", () => {
  const source = reward("r-semantic", "unknown", { title: " title ", tags: ["", "tag", "tag"], enhancementIds: ["missing"] });
  assert.deepEqual(Object.keys(source), REWARD_FIELDS);
  const captured = captureVoyageEncounterRewardDefinition(source);
  assert.equal(captured.ok, true); assert.deepEqual(captured.errors, []); assert.deepEqual(captured.warnings, []); assert.notEqual(captured.value, source); assert.deepEqual(captured.value, source);
  assert.notEqual(captured.value.tags, source.tags); captured.value.tags.push("changed"); assert.equal(source.tags.length, 3);
  const second = captureVoyageEncounterRewardDefinition(source); assert.deepEqual(second.value, source); assert.notEqual(second.value, captured.value);
});

test("capture rejects malformed exact shapes and hostile data without semantic execution", () => {
  const base = reward();
  for (const malformed of [
    { ...base, extra: true },
    { rewardId: base.rewardId, kind: base.kind, title: base.title, description: base.description, tags: base.tags, enhancementIds: base.enhancementIds, voidFortune: base.voidFortune },
    { ...base, tags: Object.assign([], { 1: "gap" }) },
    { ...base, voidFortune: { ...voidFortune(), extra: true } },
    { ...base, fieldRepairResource: { ...fieldRepair(), extra: true } }
  ]) { const result = captureVoyageEncounterRewardDefinition(malformed); assert.equal(result.ok, false); assert.equal(result.value, null); assert.ok(result.errors.length > 0); }
  const getter = { get rewardId() { throw new Error("secret trap"); } }; const revokedControl = Proxy.revocable(base, {}); const revoked = revokedControl.proxy; revokedControl.revoke(); const nonPlain = new Date(); const cyclic = reward(); cyclic.tags = [cyclic];
  for (const value of [getter, revoked, nonPlain, cyclic, () => undefined, Symbol("x")]) { const result = captureVoyageEncounterRewardDefinition(value); assert.equal(result.ok, false); diagnostic(result.errors[0], "m8-hostile-data-capture-failed", "$", MESSAGE.hostile); assert.ok(!/secret trap|TypeError|Proxy|revocation|trap|stack|engine/i.test(result.errors[0].message)); }
});

test("all reward kinds and descriptor relationships validate exactly", () => {
  const cases = [
    reward("item", "item", { enhancementIds: [] }),
    reward("benefit", "benefit", { enhancementIds: [] }),
    reward("fortune", "void-fortune", { voidFortune: voidFortune(), enhancementIds: [] }),
    reward("repair", "field-repair-resource", { fieldRepairResource: fieldRepair(), enhancementIds: [] })
  ];
  for (const value of cases) { const report = validateVoyageEncounterRewardDefinition(value, []); assert.equal(report.valid, true); assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); }
  const forbiddenFortune = validateVoyageEncounterRewardDefinition(reward("r", "item", { voidFortune: voidFortune() }), []); diagnostic(forbiddenFortune.errors[0], "m8-invalid-void-fortune", "rewardDefinition.voidFortune", MESSAGE.invalidVoid);
  const missingFortune = validateVoyageEncounterRewardDefinition(reward("r", "void-fortune", { enhancementIds: [], voidFortune: null }), []); diagnostic(missingFortune.errors[0], "m8-invalid-void-fortune", "rewardDefinition.voidFortune", MESSAGE.invalidVoid);
  const forbiddenRepair = validateVoyageEncounterRewardDefinition(reward("r", "benefit", { fieldRepairResource: fieldRepair() }), []); diagnostic(forbiddenRepair.errors[0], "m8-invalid-field-repair-resource", "rewardDefinition.fieldRepairResource", MESSAGE.invalidRepair);
  const missingRepair = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: null }), []); diagnostic(missingRepair.errors[0], "m8-invalid-field-repair-resource", "rewardDefinition.fieldRepairResource", MESSAGE.invalidRepair);
});

test("reward and enhancement semantic validation covers strings, arrays, identity, and references", () => {
  const invalid = reward("r", "item", { title: " title ", tags: ["tag", "tag"], enhancementIds: ["missing"] });
  const report = validateVoyageEncounterRewardDefinition(invalid, [enhancement("e", { compatibleRewardIds: ["r"], compatibleRewardKinds: ["item"] })]);
  diagnostic(report.errors[0], "m8-invalid-reward-definition", "rewardDefinition", MESSAGE.invalidReward);
  const duplicateReward = definition(3, [reward("same", "item", { enhancementIds: [] }), reward("same", "benefit", { enhancementIds: [] })], []);
  const duplicateReport = analyzeVoyageEncounterRewardSteps(request(duplicateReward)); failure(duplicateReport); diagnostic(duplicateReport.errors[0], "m8-duplicate-reward-identity", "eventDefinition.rewards[1].rewardId", MESSAGE.duplicateReward);
  const duplicateEnhancement = definition(3, [reward("r", "item", { enhancementIds: ["e"] })], [enhancement("e", { compatibleRewardIds: ["r"] }), enhancement("e", { compatibleRewardIds: ["r"] })]);
  const duplicateEnhancementReport = analyzeVoyageEncounterRewardSteps(request(duplicateEnhancement)); failure(duplicateEnhancementReport); diagnostic(duplicateEnhancementReport.errors[0], "m8-duplicate-enhancement-identity", "eventDefinition.enhancements[1].enhancementId", MESSAGE.duplicateEnhancement);
  const unresolved = validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: ["missing"] }), [enhancement("e")]); diagnostic(unresolved.errors[0], "m8-unresolved-reward-enhancement-reference", "rewardDefinition.enhancementIds[0]", MESSAGE.unresolvedRewardEnhancement);
});

test("enhancement compatibility rules and catalog references are exact", () => {
  const baseReward = reward("r", "item", { enhancementIds: ["e"] });
  for (const kind of ["item", "benefit", "void-fortune", "field-repair-resource"]) {
    const e = enhancement("e", { compatibleRewardIds: ["r"], compatibleRewardKinds: [kind] });
    const report = validateVoyageEncounterRewardDefinition(baseReward, [e]);
    assert.equal(report.valid, true);
  }
  const badKind = validateVoyageEncounterRewardDefinition(baseReward, [enhancement("e", { compatibleRewardKinds: ["unknown"] })]);
  diagnostic(badKind.errors[0], "m8-invalid-compatible-reward-kind", "enhancementDefinitions[0].compatibleRewardKinds[0]", MESSAGE.invalidKind);
  const empty = validateVoyageEncounterRewardDefinition(baseReward, [enhancement("e", { compatibleRewardIds: [], compatibleRewardKinds: [] })]);
  diagnostic(empty.errors[0], "m8-invalid-empty-reward-enhancement-compatibility", "enhancementDefinitions[0]", MESSAGE.emptyCompatibility);
  const unresolved = definition(3, [baseReward], [enhancement("e", { compatibleRewardIds: ["unknown"] })]);
  const unresolvedReport = analyzeVoyageEncounterRewardSteps(request(unresolved)); failure(unresolvedReport); diagnostic(unresolvedReport.errors[0], "m8-unresolved-compatible-reward-reference", "eventDefinition.enhancements[0].compatibleRewardIds[0]", MESSAGE.unresolvedCompatibleReward);
  const noIdRestriction = validateVoyageEncounterRewardDefinition(baseReward, [enhancement("e", { compatibleRewardIds: [], compatibleRewardKinds: ["item"] })]); assert.equal(noIdRestriction.valid, true);
});

test("void fortune and Field Repair Resource descriptors are authored and isolated", () => {
  const fortuneReward = reward("fortune", "void-fortune", { enhancementIds: [], voidFortune: voidFortune("same") });
  const repairReward = reward("repair", "field-repair-resource", { enhancementIds: [], fieldRepairResource: fieldRepair("same") });
  const def = definition(3, [fortuneReward, repairReward], []);
  const result = analyzeVoyageEncounterRewardSteps(request(def)); assert.equal(result.ok, true); assert.deepEqual(Object.keys(result.rewardDefinitions[0].voidFortune), VOID_FIELDS); assert.deepEqual(Object.keys(result.rewardDefinitions[1].fieldRepairResource), REPAIR_FIELDS);
  result.rewardDefinitions[0].voidFortune.tags.push("tampered"); assert.equal(def.rewards[0].voidFortune.tags.length, 1);
  const duplicateFortune = definition(3, [fortuneReward, reward("fortune-2", "void-fortune", { enhancementIds: [], voidFortune: voidFortune("same") })], []); const fortuneResult = analyzeVoyageEncounterRewardSteps(request(duplicateFortune)); failure(fortuneResult); diagnostic(fortuneResult.errors[0], "m8-duplicate-void-fortune-identity", "eventDefinition.rewards[1].voidFortune.voidFortuneId", "Void Fortune identity is duplicated across rewards.");
  const duplicateRepair = definition(3, [repairReward, reward("repair-2", "field-repair-resource", { enhancementIds: [], fieldRepairResource: fieldRepair("same") })], []); const repairResult = analyzeVoyageEncounterRewardSteps(request(duplicateRepair)); failure(repairResult); diagnostic(repairResult.errors[0], "m8-duplicate-field-repair-resource-identity", "eventDefinition.rewards[1].fieldRepairResource.fieldRepairResourceId", "Field Repair Resource identity is duplicated across rewards.");
});

test("Reward Step calculations cover legal counts, all results, critical weighting, thresholds, and cap", () => {
  for (const count of [3, 5, 7, 9, 11]) {
    for (const value of RESULTS) {
      const def = definition(count, [reward("r1", "item", { enhancementIds: [] }), reward("r2", "benefit", { enhancementIds: [] }), reward("r3", "item", { enhancementIds: [] })], []); const report = validateVoyageEncounterRewardDefinition(def.rewards[0], []); assert.equal(report.valid, true);
      const hist = history(def, Array(count).fill(value)); const result = analyzeVoyageEncounterRewardSteps(request(def, hist)); assert.equal(result.ok, value === "round-success" || value === "critical-round-success");
    }
  }
  const one = definition(3, [reward("r", "item", { enhancementIds: [] })], []); const oneResult = analyzeVoyageEncounterRewardSteps(request(one)); assert.equal(oneResult.rewardPoints, 3); assert.equal(oneResult.rewardSteps, 1);
  const two = definition(5, [reward("r1", "item", { enhancementIds: [] }), reward("r2", "benefit", { enhancementIds: [] })], []); const twoResult = analyzeVoyageEncounterRewardSteps(request(two)); assert.equal(twoResult.rewardPoints, 5); assert.equal(twoResult.rewardSteps, 2);
  const threeRewards = [reward("r1", "item", { enhancementIds: [] }), reward("r2", "benefit", { enhancementIds: [] }), reward("r3", "item", { enhancementIds: [] })]; const three = definition(11, threeRewards, []); const threeResult = analyzeVoyageEncounterRewardSteps(request(three)); assert.equal(threeResult.rewardPoints, 11); assert.equal(threeResult.rewardSteps, 3);
  const critical = definition(3, [reward("r", "item", { enhancementIds: [] })], []); const criticalHistory = history(critical, ["critical-round-success", "round-failure", "round-failure"]); const criticalResult = analyzeVoyageEncounterRewardSteps(request(critical, criticalHistory)); failure(criticalResult); diagnostic(criticalResult.errors[0], "m8-reward-analysis-on-failure", "overallResult", MESSAGE.onFailure);
});

test("analyzer precedence, authority, exact requests, sentinels, next situations, and sufficiency", () => {
  const def = definition(); const hist = history(def);
  for (const key of AUTHORITY) { const result = analyzeVoyageEncounterRewardSteps(request(def, hist, { [key]: null })); failure(result); assert.equal(result.errors.length, 1); diagnostic(result.errors[0], "m8-caller-authored-plan-rejected", `request.${key}`, "Caller-authored result plans are not accepted."); }
  const badMode = analyzeVoyageEncounterRewardSteps({ kind: "other" }); failure(badMode); diagnostic(badMode.errors[0], "m8-invalid-mode", "request.kind", "Only m8-reward-steps analysis is supported.");
  const extra = analyzeVoyageEncounterRewardSteps(request(def, hist, { extra: true })); failure(extra); diagnostic(extra.errors[0], "m8-invalid-request-shape", "request", "Request has an invalid exact shape.");
  const malformedNext = definition(3, [reward("r", "item", { enhancementIds: [] })], [], { nextSituations: [{ nextSituationId: "bad" }] }); const nextResult = analyzeVoyageEncounterRewardSteps(request(malformedNext)); failure(nextResult); diagnostic(nextResult.errors[0], "m8-invalid-next-situation", "eventDefinition.nextSituations", "Event Definition nextSituations must contain one valid descriptor.");
  const noRewards = definition(3, [], []); const noRewardResult = analyzeVoyageEncounterRewardSteps(request(noRewards)); failure(noRewardResult); diagnostic(noRewardResult.errors[0], "m8-no-authored-rewards", "eventDefinition.rewards", MESSAGE.noRewards);
  const insufficient = definition(5, [reward("r", "item", { enhancementIds: [] })], []); const insufficientResult = analyzeVoyageEncounterRewardSteps(request(insufficient)); failure(insufficientResult); diagnostic(insufficientResult.errors[0], "m8-insufficient-authored-reward-options", "eventDefinition.rewards", MESSAGE.insufficient);
  const session = analyzeVoyageEncounterRewardSteps(request(def, { ...hist, sessionId: "other" }, { sessionId: "request-session" })); failure(session); diagnostic(session.errors[0], "m8-session-identity-mismatch", "completedRoundHistory.sessionId", "Request sessionId must match completed history sessionId.");
});

test("category five and six diagnostics precede deferred Task 1 round-count validation", () => {
  const unresolvedWithInvalidCount = definition(4, [reward("r", "item", { enhancementIds: ["e"] })], [enhancement("e", { compatibleRewardIds: ["missing"], compatibleRewardKinds: ["item"] })]);
  const unresolvedResult = analyzeVoyageEncounterRewardSteps(request(unresolvedWithInvalidCount));
  assert.deepEqual(unresolvedResult, {
    ok: false,
    readyForRewardSteps: false,
    eventId: null,
    sessionId: null,
    definitionSnapshotId: null,
    roundCount: null,
    winningThreshold: null,
    overallResult: null,
    rewardPoints: null,
    rewardSteps: null,
    rewardDefinitions: [],
    errors: [{ code: "m8-unresolved-compatible-reward-reference", path: "eventDefinition.enhancements[0].compatibleRewardIds[0]", message: "Reward compatibility identity does not resolve exactly once.", severity: "error" }],
    warnings: []
  });
  assert.equal(unresolvedResult.errors.some(({ code }) => code === "m8-invalid-round-count"), false);

  const validReferencesWithInvalidCount = definition(4, [reward("r", "item", { enhancementIds: ["e"] })], [enhancement("e", { compatibleRewardIds: ["r"], compatibleRewardKinds: ["item"] })]);
  const invalidCountResult = analyzeVoyageEncounterRewardSteps(request(validReferencesWithInvalidCount));
  assert.deepEqual(invalidCountResult, {
    ok: false,
    readyForRewardSteps: false,
    eventId: null,
    sessionId: null,
    definitionSnapshotId: null,
    roundCount: null,
    winningThreshold: null,
    overallResult: null,
    rewardPoints: null,
    rewardSteps: null,
    rewardDefinitions: [],
    errors: [{ code: "m8-invalid-round-count", path: "eventDefinition.roundCount", message: "Event Definition roundCount must be one of 3, 5, 7, 9, or 11.", severity: "error" }],
    warnings: []
  });

  const categoryFiveFailure = definition(3, [reward("r", "item", { enhancementIds: ["e"] })], [enhancement("e", { compatibleRewardIds: ["missing"], compatibleRewardKinds: ["item"] })], { nextSituations: [{ nextSituationId: "malformed" }] });
  const categoryFiveResult = analyzeVoyageEncounterRewardSteps(request(categoryFiveFailure));
  assert.deepEqual(categoryFiveResult, {
    ok: false,
    readyForRewardSteps: false,
    eventId: null,
    sessionId: null,
    definitionSnapshotId: null,
    roundCount: null,
    winningThreshold: null,
    overallResult: null,
    rewardPoints: null,
    rewardSteps: null,
    rewardDefinitions: [],
    errors: [{ code: "m8-invalid-next-situation", path: "eventDefinition.nextSituations", message: "Event Definition nextSituations must contain one valid descriptor.", severity: "error" }],
    warnings: []
  });
});

test("sufficiency supports add and enhancement operations without returning an allocation", () => {
  const e = enhancement("e", { compatibleRewardIds: ["r1"], compatibleRewardKinds: ["item"] });
  const one = definition(5, [reward("r1", "item", { enhancementIds: ["e"] })], [e]); const result = analyzeVoyageEncounterRewardSteps(request(one)); assert.equal(result.ok, true); assert.equal(result.rewardSteps, 2); assert.deepEqual(result.rewardDefinitions.map(({ rewardId }) => rewardId), ["r1"]); assert.equal(Object.hasOwn(result, "allocation"), false); assert.equal(Object.hasOwn(result, "rewardSelections"), false);
  const source = JSON.stringify(one); const again = analyzeVoyageEncounterRewardSteps(request(one)); assert.deepEqual(again, result); assert.equal(JSON.stringify(one), source);
});

test("capture and analysis remain deterministic, isolated, and pure", () => {
  const def = definition(3); const hist = history(def); const before = JSON.stringify({ def, hist }); const random = Math.random; let calls = 0; Math.random = () => { calls += 1; return 0.5; };
  try { const first = analyzeVoyageEncounterRewardSteps(request(def, hist)); const second = analyzeVoyageEncounterRewardSteps(request(def, hist)); assert.deepEqual(first, second); assert.equal(first.ok, true); assert.deepEqual(first.errors, []); assert.deepEqual(first.warnings, []); } finally { Math.random = random; }
  assert.equal(calls, 0); assert.equal(JSON.stringify({ def, hist }), before);
});

test("capture rejects reordered roots and preserves nested Field Repair Resource data", () => {
  const canonical = reward("r", "item", { enhancementIds: [] });
  const reordered = { kind: canonical.kind, rewardId: canonical.rewardId, title: canonical.title, description: canonical.description, tags: canonical.tags, enhancementIds: canonical.enhancementIds, voidFortune: canonical.voidFortune, fieldRepairResource: canonical.fieldRepairResource };
  const capture = captureVoyageEncounterRewardDefinition(reordered);
  assert.deepEqual(capture, { ok: false, value: null, errors: [{ code: "m8-invalid-reward-definition", path: "rewardDefinition", message: MESSAGE.invalidReward, severity: "error" }], warnings: [] });
  const repair = fieldRepair("nested"); const source = reward("repair", "field-repair-resource", { enhancementIds: [], fieldRepairResource: repair });
  const first = captureVoyageEncounterRewardDefinition(source); assert.equal(first.ok, true); assert.notEqual(first.value, source); assert.notEqual(first.value.fieldRepairResource, source.fieldRepairResource); assert.notEqual(first.value.fieldRepairResource.compatibleScarTags, source.fieldRepairResource.compatibleScarTags); assert.deepEqual(first.value, source);
  first.value.fieldRepairResource.compatibleScarTags.push("tampered"); first.value.fieldRepairResource.title = "changed"; assert.deepEqual(source.fieldRepairResource, repair);
  const def = definition(3, [source], []); const analyzed = analyzeVoyageEncounterRewardSteps(request(def)); assert.equal(analyzed.ok, true); analyzed.rewardDefinitions[0].fieldRepairResource.compatibleScarTags.push("changed"); const later = analyzeVoyageEncounterRewardSteps(request(def)); assert.deepEqual(later.rewardDefinitions[0].fieldRepairResource.compatibleScarTags, ["arkengine"]);
});

test("every applicable primitive string rejects the complete invalid-string table independently", () => {
  const invalidStrings = ["", " ", "\t", "\n", " id", "id ", "\tid", "id\n"];
  for (const value of invalidStrings) {
    for (const field of ["rewardId", "title", "description"]) {
      const valueUnderTest = reward("r", "item", { enhancementIds: [], [field]: value }); const report = validateVoyageEncounterRewardDefinition(valueUnderTest, []); assert.deepEqual(report, { valid: false, errors: [{ code: "m8-invalid-reward-definition", path: "rewardDefinition", message: MESSAGE.invalidReward, severity: "error" }], warnings: [] });
    }
    const tagReport = validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: [], tags: [value] }), []); assert.deepEqual(tagReport.errors, [{ code: "m8-invalid-reward-definition", path: "rewardDefinition", message: MESSAGE.invalidReward, severity: "error" }]);
    const enhancementIdReport = validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: [value] }), []); assert.deepEqual(enhancementIdReport.errors, [{ code: "m8-invalid-reward-definition", path: "rewardDefinition", message: MESSAGE.invalidReward, severity: "error" }]);
    for (const field of ["enhancementId", "title", "description"]) {
      const e = enhancement("e", { compatibleRewardIds: ["r"], compatibleRewardKinds: ["item"], [field]: value }); const report = validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: ["e"] }), [e]); assert.deepEqual(report.errors, [{ code: "m8-invalid-reward-enhancement", path: "enhancementDefinitions[0]", message: MESSAGE.invalidEnhancement, severity: "error" }]);
    }
    const compatibleId = enhancement("e", { compatibleRewardIds: [value], compatibleRewardKinds: ["item"] }); const compatibleIdReport = validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: ["e"] }), [compatibleId]); assert.deepEqual(compatibleIdReport.errors, [{ code: "m8-invalid-reward-enhancement", path: "enhancementDefinitions[0]", message: MESSAGE.invalidEnhancement, severity: "error" }]);
    const compatibleKind = enhancement("e", { compatibleRewardIds: ["r"], compatibleRewardKinds: [value] }); const compatibleKindReport = validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: ["e"] }), [compatibleKind]); assert.deepEqual(compatibleKindReport.errors, [{ code: "m8-invalid-compatible-reward-kind", path: "enhancementDefinitions[0].compatibleRewardKinds[0]", message: MESSAGE.invalidKind, severity: "error" }]);
    for (const field of ["voidFortuneId", "title", "description"]) {
      const fortune = { ...voidFortune(), [field]: value }; const report = validateVoyageEncounterRewardDefinition(reward("r", "void-fortune", { enhancementIds: [], voidFortune: fortune }), []); assert.deepEqual(report.errors, [{ code: "m8-invalid-void-fortune", path: "rewardDefinition.voidFortune", message: MESSAGE.invalidVoid, severity: "error" }]);
    }
    const fortuneTags = validateVoyageEncounterRewardDefinition(reward("r", "void-fortune", { enhancementIds: [], voidFortune: { ...voidFortune(), tags: [value] } }), []); assert.deepEqual(fortuneTags.errors, [{ code: "m8-invalid-void-fortune", path: "rewardDefinition.voidFortune", message: MESSAGE.invalidVoid, severity: "error" }]);
    for (const field of ["fieldRepairResourceId", "title", "description", "timing"]) {
      const resource = { ...fieldRepair(), [field]: value }; const report = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: resource }), []); assert.deepEqual(report.errors, [{ code: "m8-invalid-field-repair-resource", path: "rewardDefinition.fieldRepairResource", message: MESSAGE.invalidRepair, severity: "error" }]);
    }
    const scarTags = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: { ...fieldRepair(), compatibleScarTags: [value] } }), []); assert.deepEqual(scarTags.errors, [{ code: "m8-invalid-field-repair-resource", path: "rewardDefinition.fieldRepairResource", message: MESSAGE.invalidRepair, severity: "error" }]);
  }
});

test("duplicate reward enhancement IDs and exact enhancement shape rules are independent", () => {
  const duplicate = validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: ["e", "e"] }), [enhancement("e", { compatibleRewardIds: ["r"] })]); assert.deepEqual(duplicate.errors, [{ code: "m8-invalid-reward-definition", path: "rewardDefinition", message: MESSAGE.invalidReward, severity: "error" }]);
  const e = enhancement("e", { compatibleRewardIds: ["r"], compatibleRewardKinds: ["item"] }); assert.deepEqual(Object.keys(e), ENHANCEMENT_FIELDS); assert.equal(validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: ["e"] }), [e]).valid, true);
  const reordered = { title: e.title, enhancementId: e.enhancementId, description: e.description, compatibleRewardIds: e.compatibleRewardIds, compatibleRewardKinds: e.compatibleRewardKinds, maxApplicationsPerReward: e.maxApplicationsPerReward }; const reorderedReport = validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: ["e"] }), [reordered]); assert.deepEqual(reorderedReport.errors, [{ code: "m8-invalid-reward-enhancement", path: "enhancementDefinitions[0]", message: MESSAGE.invalidEnhancement, severity: "error" }]);
  for (const value of [0, 2, -1, null, "1"]) { const report = validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: ["e"] }), [enhancement("e", { compatibleRewardIds: ["r"], maxApplicationsPerReward: value })]); assert.deepEqual(report.errors, [{ code: "m8-invalid-reward-enhancement", path: "enhancementDefinitions[0]", message: MESSAGE.invalidEnhancement, severity: "error" }]); }
  assert.equal(validateVoyageEncounterRewardDefinition(reward("r", "item", { enhancementIds: ["e"] }), [enhancement("e", { compatibleRewardIds: ["r"], maxApplicationsPerReward: 1.0 })]).valid, true);
});

test("Field Repair Resource tags and literals use complete exact diagnostics", () => {
  const empty = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: { ...fieldRepair(), compatibleScarTags: [] } }), []); assert.deepEqual(empty.errors, [{ code: "m8-invalid-field-repair-resource", path: "rewardDefinition.fieldRepairResource", message: MESSAGE.invalidRepair, severity: "error" }]);
  const duplicate = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: { ...fieldRepair(), compatibleScarTags: ["a", "a"] } }), []); assert.deepEqual(duplicate.errors, [{ code: "m8-invalid-field-repair-resource", path: "rewardDefinition.fieldRepairResource", message: MESSAGE.invalidRepair, severity: "error" }]);
  const sparseTags = []; sparseTags.length = 1; const sparse = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: { ...fieldRepair(), compatibleScarTags: sparseTags } }), []); assert.deepEqual(sparse.errors, [{ code: "m8-hostile-data-capture-failed", path: "$", message: MESSAGE.hostile, severity: "error" }]);
  const nonString = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: { ...fieldRepair(), compatibleScarTags: [1] } }), []); assert.deepEqual(nonString.errors, [{ code: "m8-invalid-field-repair-resource", path: "rewardDefinition.fieldRepairResource", message: MESSAGE.invalidRepair, severity: "error" }]);
  for (const timing of ["safe-rest", "safe rest", "immediate", "during-downtime", "authored timing"]) { const resource = { ...fieldRepair(), timing }; const report = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: resource }), []); assert.equal(report.valid, true); assert.equal(report.errors.length, 0); assert.equal(report.warnings.length, 0); assert.equal(report.valid && resource.timing, timing); }
  for (const timing of ["", " ", "\t", "\n", " safe-rest", "safe-rest ", "\tsafe-rest", "safe-rest\n", null, 0, true]) { const report = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: { ...fieldRepair(), timing } }), []); assert.deepEqual(report.errors, [{ code: "m8-invalid-field-repair-resource", path: "rewardDefinition.fieldRepairResource", message: MESSAGE.invalidRepair, severity: "error" }]); }
  for (const safeRestRequired of [true, false]) { const resource = { ...fieldRepair(), safeRestRequired }; const report = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: resource }), []); assert.equal(report.valid, true); assert.equal(report.errors.length, 0); assert.equal(report.warnings.length, 0); assert.equal(report.valid && resource.safeRestRequired, safeRestRequired); }
  for (const safeRestRequired of [null, 0, 1, "true", "false"]) { const report = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: { ...fieldRepair(), safeRestRequired } }), []); assert.deepEqual(report.errors, [{ code: "m8-invalid-field-repair-resource", path: "rewardDefinition.fieldRepairResource", message: MESSAGE.invalidRepair, severity: "error" }]); }
  const undefinedSafeRest = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: { ...fieldRepair(), safeRestRequired: undefined } }), []); assert.deepEqual(undefinedSafeRest.errors, [{ code: "m8-hostile-data-capture-failed", path: "$", message: MESSAGE.hostile, severity: "error" }]);
  const objectSafeRest = validateVoyageEncounterRewardDefinition(reward("r", "field-repair-resource", { enhancementIds: [], fieldRepairResource: { ...fieldRepair(), safeRestRequired: {} } }), []); assert.deepEqual(objectSafeRest.errors, [{ code: "m8-invalid-field-repair-resource", path: "rewardDefinition.fieldRepairResource", message: MESSAGE.invalidRepair, severity: "error" }]);
});

test("hostile enhancement catalogs fail closed through validation and analysis", () => {
  const base = definition(3, [reward("r", "item", { enhancementIds: [] })], [enhancement("e", { compatibleRewardIds: ["r"] })]);
  const hostileValues = [];
  const getter = {}; Object.defineProperty(getter, "enhancementId", { get() { throw new Error("secret trap"); }, enumerable: true }); hostileValues.push(getter);
  const accessor = { ...base.enhancements[0] }; Object.defineProperty(accessor, "title", { get() { return "bad"; }, enumerable: true }); hostileValues.push(accessor);
  hostileValues.push(() => undefined);
  const symbol = { ...base.enhancements[0] }; symbol[Symbol("hostile")] = true; hostileValues.push(symbol);
  const cyclic = { ...base.enhancements[0] }; cyclic.description = cyclic; hostileValues.push(cyclic);
  const unsafe = { ...base.enhancements[0] }; Object.defineProperty(unsafe, "__proto__", { value: true, enumerable: true }); hostileValues.push(unsafe);
  hostileValues.push(new Date());
  for (const hostile of hostileValues) { const value = { ...base, enhancements: [hostile] }; const report = analyzeVoyageEncounterRewardSteps(request(value)); failure(report); diagnostic(report.errors[0], "m8-hostile-data-capture-failed", "$", MESSAGE.hostile); assert.ok(report.errors.every(({ message }) => !/secret trap|TypeError|Proxy|revocation|trap|stack|engine/i.test(message))); }
  const sparse = []; sparse.length = 1; const sparseReport = analyzeVoyageEncounterRewardSteps(request({ ...base, enhancements: sparse })); failure(sparseReport); diagnostic(sparseReport.errors[0], "m8-hostile-data-capture-failed", "$", MESSAGE.hostile);
  const control = Proxy.revocable({ ...base.enhancements[0] }, {}); const revoked = control.proxy; control.revoke(); const revokedReport = analyzeVoyageEncounterRewardSteps(request({ ...base, enhancements: [revoked] })); failure(revokedReport); diagnostic(revokedReport.errors[0], "m8-hostile-data-capture-failed", "$", MESSAGE.hostile);
});

test("request shape, values, Task 1 propagation, and category precedence are exact", () => {
  const def = definition(3, [reward("r", "item", { enhancementIds: [] })], []); const hist = history(def); const valid = request(def, hist);
  const missingKind = { ...valid }; delete missingKind.kind; const missingKindReport = analyzeVoyageEncounterRewardSteps(missingKind); failure(missingKindReport); diagnostic(missingKindReport.errors[0], "m8-invalid-mode", "request.kind", "Only m8-reward-steps analysis is supported.");
  for (const key of ["sessionId", "eventDefinition", "completedRoundHistory"]) { const missing = { ...valid }; delete missing[key]; const report = analyzeVoyageEncounterRewardSteps(missing); failure(report); diagnostic(report.errors[0], "m8-invalid-request-shape", "request", "Request has an invalid exact shape."); }
  const reordered = { sessionId: valid.sessionId, kind: valid.kind, eventDefinition: valid.eventDefinition, completedRoundHistory: valid.completedRoundHistory }; const reorderedReport = analyzeVoyageEncounterRewardSteps(reordered); failure(reorderedReport); diagnostic(reorderedReport.errors[0], "m8-invalid-request-shape", "request", "Request has an invalid exact shape.");
  for (const sessionId of ["", " ", "\tsession", "session "]) { const report = analyzeVoyageEncounterRewardSteps({ ...valid, sessionId }); failure(report); diagnostic(report.errors[0], "m8-invalid-request-shape", "request", "Request has invalid field values."); }
  for (const malformed of [{ eventDefinition: null }, { eventDefinition: 1 }, { completedRoundHistory: null }, { completedRoundHistory: 1 }]) { const report = analyzeVoyageEncounterRewardSteps({ ...valid, ...malformed }); failure(report); diagnostic(report.errors[0], "m8-invalid-request-shape", "request", "Request has invalid field values."); }
  for (const key of AUTHORITY) { const report = analyzeVoyageEncounterRewardSteps({ [key]: null }); failure(report); assert.deepEqual(report.errors, [{ code: "m8-caller-authored-plan-rejected", path: `request.${key}`, message: "Caller-authored result plans are not accepted.", severity: "error" }]); }
  const mismatchCases = [
    { mutate: (h) => { h.eventId = "other"; }, expected: { code: "m8-event-identity-mismatch", path: "completedRoundHistory.eventId", message: "Completed history eventId must match Event Definition." } },
    { mutate: (h) => { h.definitionSnapshotId = "other"; }, expected: { code: "m8-definition-snapshot-mismatch", path: "completedRoundHistory.definitionSnapshotId", message: "Completed history definitionSnapshotId must match Event Definition." } },
    { mutate: (h) => { h.roundCount = 5; }, expected: { code: "m8-history-round-count-mismatch", path: "completedRoundHistory.roundCount", message: "Completed history roundCount must match Event Definition." } },
    { mutate: (h) => { h.rounds.pop(); }, expected: { code: "m8-incomplete-round-history", path: "completedRoundHistory.rounds", message: "Completed round history must contain every authored round exactly once." } },
    { mutate: (h) => { h.rounds[1].roundId = h.rounds[0].roundId; }, expected: { code: "m8-duplicate-round-result", path: "completedRoundHistory.rounds[1].roundId", message: "A round result is duplicated." } },
    { mutate: (h) => { h.rounds[1].roundId = "unknown"; }, expected: { code: "m8-unknown-round-id", path: "completedRoundHistory.rounds[1].roundId", message: "Round result references an unknown roundId." } },
    { mutate: (h) => { h.rounds.reverse(); }, expected: { code: "m8-round-order-invalid", path: "completedRoundHistory.rounds[0]", message: "Round results must follow Event Definition order." } },
    { mutate: (h) => { h.rounds[0].roundResult = "other"; }, expected: { code: "m8-invalid-round-result", path: "completedRoundHistory.rounds[0].roundResult", message: "Round result is not canonical." } }
  ];
  for (const { mutate, expected } of mismatchCases) { const changed = JSON.parse(JSON.stringify(hist)); mutate(changed); const report = analyzeVoyageEncounterRewardSteps({ ...valid, completedRoundHistory: changed }); failure(report); assert.deepEqual(report.errors[0], { ...expected, severity: "error" }); }
  const invalidReward = { ...def, rewards: [{ ...def.rewards[0], title: " " }] }; const invalidRewardReport = analyzeVoyageEncounterRewardSteps(request(invalidReward, { ...hist, sessionId: "other" }, { sessionId: "request" })); failure(invalidRewardReport); diagnostic(invalidRewardReport.errors[0], "m8-invalid-reward-definition", "eventDefinition.rewards[0]", MESSAGE.invalidReward);
  const invalidReference = { ...def, rewards: [{ ...def.rewards[0], enhancementIds: ["missing"] }], enhancements: [] }; const invalidReferenceReport = analyzeVoyageEncounterRewardSteps(request(invalidReference, { ...hist, rounds: [] }, { sessionId: "request" })); failure(invalidReferenceReport); diagnostic(invalidReferenceReport.errors[0], "m8-unresolved-reward-enhancement-reference", "eventDefinition.rewards[0].enhancementIds[0]", MESSAGE.unresolvedRewardEnhancement);
});

test("mixed histories and success envelopes are exact at one, two, and three steps", () => {
  const oneDef = definition(3, [reward("r", "item", { enhancementIds: [] })], []); const one = analyzeVoyageEncounterRewardSteps(request(oneDef)); assert.equal(one.ok, true); assert.deepEqual(Object.keys(one), ANALYSIS_FIELDS); assert.deepEqual(one, { ok: true, readyForRewardSteps: true, eventId: "event-1", sessionId: "session-1", definitionSnapshotId: "snapshot-1", roundCount: 3, winningThreshold: 2, overallResult: "overall-success", rewardPoints: 3, rewardSteps: 1, rewardDefinitions: oneDef.rewards, errors: [], warnings: [] });
  const twoDef = definition(5, [reward("r1", "item", { enhancementIds: [] }), reward("r2", "benefit", { enhancementIds: [] })], []); const two = analyzeVoyageEncounterRewardSteps(request(twoDef)); assert.equal(two.ok, true); assert.equal(two.rewardPoints, 5); assert.equal(two.rewardSteps, 2); assert.deepEqual(Object.keys(two), ANALYSIS_FIELDS);
  const threeDef = definition(11, [reward("r1", "item", { enhancementIds: [] }), reward("r2", "benefit", { enhancementIds: [] }), reward("r3", "item", { enhancementIds: [] })], []); const three = analyzeVoyageEncounterRewardSteps(request(threeDef)); assert.equal(three.ok, true); assert.equal(three.rewardPoints, 11); assert.equal(three.rewardSteps, 3); assert.deepEqual(Object.keys(three), ANALYSIS_FIELDS);
  const mixedDef = definition(5, [reward("r1", "item", { enhancementIds: [] }), reward("r2", "benefit", { enhancementIds: [] })], []); const mixedHistory = history(mixedDef, ["critical-round-success", "round-success", "round-failure", "critical-round-failure", "round-success"]); const mixed = analyzeVoyageEncounterRewardSteps(request(mixedDef, mixedHistory)); assert.equal(mixed.overallResult, "overall-success"); assert.equal(mixed.rewardPoints, 4); assert.equal(mixed.rewardSteps, 1);
});

test("sufficiency graph matrix covers exact operation feasibility without returning authority", () => {
  const rewardOnly = (count) => Array.from({ length: count }, (_, i) => reward(`r${i + 1}`, "item", { enhancementIds: [] }));
  const cases = [
    ["one step one reward", 3, rewardOnly(1), [], true],
    ["one step no reward", 3, [], [], false],
    ["two distinct rewards", 5, rewardOnly(2), [], true],
    ["one reward plus enhancement", 5, [reward("r1", "item", { enhancementIds: ["e"] })], [enhancement("e", { compatibleRewardIds: ["r1"] })], true],
    ["three distinct rewards", 11, rewardOnly(3), [], true],
    ["two rewards plus enhancement", 11, [reward("r1", "item", { enhancementIds: ["e"] }), reward("r2", "benefit", { enhancementIds: [] })], [enhancement("e", { compatibleRewardIds: ["r1"] })], true],
    ["one reward plus two enhancements", 11, [reward("r1", "item", { enhancementIds: ["e1", "e2"] })], [enhancement("e1", { compatibleRewardIds: ["r1"] }), enhancement("e2", { compatibleRewardIds: ["r1"] })], true],
    ["incompatible graph", 5, [reward("r1", "item", { enhancementIds: ["e"] })], [enhancement("e", { compatibleRewardIds: ["r1"], compatibleRewardKinds: ["benefit"] })], false],
    ["undeclared enhancement", 5, [reward("r1", "item", { enhancementIds: [] })], [enhancement("e", { compatibleRewardIds: ["r1"] })], false]
  ];
  for (const [name, count, rewards, enhancements, expected] of cases) { const def = definition(count, rewards, enhancements); const result = analyzeVoyageEncounterRewardSteps(request(def)); if (expected) { assert.equal(result.ok, true, name); assert.equal(Object.hasOwn(result, "allocation"), false); assert.equal(Object.hasOwn(result, "rewardSelections"), false); } else { failure(result); const expectedCode = rewards.length === 0 ? "m8-no-authored-rewards" : "m8-insufficient-authored-reward-options"; const expectedMessage = rewards.length === 0 ? MESSAGE.noRewards : MESSAGE.insufficient; diagnostic(result.errors[0], expectedCode, "eventDefinition.rewards", expectedMessage); } }
  const idOnly = analyzeVoyageEncounterRewardSteps(request(definition(5, [reward("r", "item", { enhancementIds: ["e"] })], [enhancement("e", { compatibleRewardIds: ["r"], compatibleRewardKinds: [] })]))); assert.equal(idOnly.ok, true);
  const kindOnly = analyzeVoyageEncounterRewardSteps(request(definition(5, [reward("r", "item", { enhancementIds: ["e"] })], [enhancement("e", { compatibleRewardIds: [], compatibleRewardKinds: ["item"] })]))); assert.equal(kindOnly.ok, true);
  const wrongKind = analyzeVoyageEncounterRewardSteps(request(definition(5, [reward("r", "item", { enhancementIds: ["e"] })], [enhancement("e", { compatibleRewardIds: [], compatibleRewardKinds: ["benefit"] })]))); failure(wrongKind); diagnostic(wrongKind.errors[0], "m8-insufficient-authored-reward-options", "eventDefinition.rewards", MESSAGE.insufficient);
  const duplicateReward = analyzeVoyageEncounterRewardSteps(request(definition(5, [reward("r", "item", { enhancementIds: ["e"] })], [enhancement("e", { compatibleRewardIds: ["r"] })]))); assert.equal(duplicateReward.ok, true);
});

test("purity test blocks deferred runtime access and output authority", () => {
  const def = definition(3, [reward("r", "item", { enhancementIds: [] })], []); const hist = history(def); const originalRandom = Math.random; const originalDateNow = Date.now; const originalGame = globalThis.game; let randomCalls = 0; let dateCalls = 0; Math.random = () => { randomCalls += 1; throw new Error("random"); }; Date.now = () => { dateCalls += 1; throw new Error("clock"); }; Object.defineProperty(globalThis, "game", { configurable: true, value: undefined });
  try { const result = analyzeVoyageEncounterRewardSteps(request(def, hist)); assert.equal(result.ok, true); assert.equal(randomCalls, 0); assert.equal(dateCalls, 0); assert.equal(Object.hasOwn(result, "allocation"), false); assert.equal(Object.hasOwn(result, "selectedReward"), false); assert.equal(Object.hasOwn(result, "revision"), false); assert.equal(Object.hasOwn(result, "event"), false); assert.equal(Object.hasOwn(result, "socket"), false); assert.equal(Object.hasOwn(result, "persistence"), false); } finally { Math.random = originalRandom; Date.now = originalDateNow; if (originalGame === undefined) delete globalThis.game; else Object.defineProperty(globalThis, "game", { configurable: true, value: originalGame }); }
});
