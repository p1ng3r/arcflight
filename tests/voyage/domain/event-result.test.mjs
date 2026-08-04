import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateVoyageEncounterCompletedRoundHistory,
  captureVoyageEncounterCompletedRoundHistory,
  analyzeVoyageEncounterOverallResult
} from "../../../scripts/voyage/domain/event-result.js";

const RESULTS = ["critical-round-success", "round-success", "round-failure", "critical-round-failure"];
const AUTHORITY_KEYS = ["overallResult", "rewardAnalysis", "negativeAnalysis", "rewardSteps", "negativeSteps", "resultPackage", "allocationPlan", "nextState"];
const ANALYSIS_KEYS = ["ok", "readyForOverallResult", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "winningThreshold", "successfulRoundCount", "failedRoundCount", "overallResult", "errors", "warnings"];
const UNAUTHORIZED_HISTORY_CODE = ["m8", "invalid", "history", "shape"].join("-");
const MESSAGE = Object.freeze({
  hostile: "Input contains inaccessible or unsafe data.",
  authority: "Caller-authored result plans are not accepted.",
  mode: "Only m8-overall-result analysis is supported.",
  requestShape: "Request has an invalid exact shape.",
  requestValues: "Request has invalid field values.",
  eventShape: "Event Definition has an invalid exact shape.",
  eventIdentity: "Event Definition identity or schema is invalid.",
  eventRoundsDense: "Event Definition rounds must be dense.",
  eventRoundsCount: "Event Definition rounds must match roundCount.",
  eventRoundsOrder: "Event Definition rounds must be unique and densely ordered.",
  catalogsDense: "Authored catalogs must be dense arrays.",
  nextSituationCardinality: "Event Definition must contain zero or one valid next situation.",
  nextSituationDescriptor: "Event Definition nextSituations must contain one valid descriptor.",
  invalidRoundCount: "Event Definition roundCount must be one of 3, 5, 7, 9, or 11.",
  historyComplete: "Completed round history must contain every authored round exactly once.",
  historyIdentity: "Completed round history has invalid identity or schema fields.",
  eventMismatch: "Completed history eventId must match Event Definition.",
  snapshotMismatch: "Completed history definitionSnapshotId must match Event Definition.",
  countMismatch: "Completed history roundCount must match Event Definition.",
  historyDense: "Completed round history must be dense and complete.",
  roundShape: "Completed round entry shape is invalid.",
  duplicate: "A round result is duplicated.",
  unknown: "Round result references an unknown roundId.",
  order: "Round results must follow Event Definition order.",
  result: "Round result is not canonical.",
  sessionMismatch: "Request sessionId must match completed history sessionId."
});
function definition(roundCount = 3, extra = {}) {
  const rounds = Array.from({ length: roundCount }, (_, i) => ({ roundId: `r${i + 1}`, roundNumber: i + 1 }));
  return { schemaVersion: 1, eventId: "event-1", definitionSnapshotId: "snap-1", roundCount, rounds, rewards: [], enhancements: [], misfortuneEnhancements: [], misfortunes: [], nextSituations: [], ...extra };
}
function history(def, results = Array(def.roundCount).fill("round-success"), extra = {}) {
  return { schemaVersion: 1, eventId: def.eventId, sessionId: "session-1", definitionSnapshotId: def.definitionSnapshotId, roundCount: def.roundCount, rounds: def.rounds.map((round, i) => ({ ...round, roundResult: results[i] })), ...extra };
}
function request(def, hist = history(def), extra = {}) { return { kind: "m8-overall-result", sessionId: hist.sessionId, eventDefinition: def, completedRoundHistory: hist, ...extra }; }
function failure(result) {
  assert.equal(result.ok, false); assert.equal(result.readyForOverallResult, false); assert.deepEqual(Object.keys(result), ANALYSIS_KEYS); assert.deepEqual(result.warnings, []);
  for (const key of ["eventId", "sessionId", "definitionSnapshotId", "roundCount", "winningThreshold", "successfulRoundCount", "failedRoundCount", "overallResult"]) assert.equal(result[key], null);
}
function assertDiagnostic(entry, code, path, message) { assert.deepEqual(entry, { code, path, message, severity: "error" }); }

test("all legal round counts, all result values, and no-tie histories validate", () => {
  for (const count of [3, 5, 7, 9, 11]) {
    for (const result of RESULTS) {
      const def = definition(count); const hist = history(def, Array(count).fill(result));
      assert.equal(validateVoyageEncounterCompletedRoundHistory(hist, def).valid, true);
    }
    const successDef = definition(count); const successHist = history(successDef, Array(count).fill("round-success")); const success = analyzeVoyageEncounterOverallResult(request(successDef, successHist));
    assert.equal(success.roundCount, count); assert.equal(success.winningThreshold, (count + 1) / 2); assert.equal(success.successfulRoundCount, count); assert.equal(success.failedRoundCount, 0); assert.equal(success.successfulRoundCount + success.failedRoundCount, count); assert.equal(success.overallResult, "overall-success"); assert.equal(Number(success.successfulRoundCount >= success.winningThreshold) + Number(success.failedRoundCount >= success.winningThreshold), 1);
    const failureDef = definition(count); const failureHist = history(failureDef, Array(count).fill("round-failure")); const failureResult = analyzeVoyageEncounterOverallResult(request(failureDef, failureHist));
    assert.equal(failureResult.roundCount, count); assert.equal(failureResult.winningThreshold, (count + 1) / 2); assert.equal(failureResult.successfulRoundCount, 0); assert.equal(failureResult.failedRoundCount, count); assert.equal(failureResult.successfulRoundCount + failureResult.failedRoundCount, count); assert.equal(failureResult.overallResult, "overall-failure"); assert.equal(Number(failureResult.successfulRoundCount >= failureResult.winningThreshold) + Number(failureResult.failedRoundCount >= failureResult.winningThreshold), 1);
  }
});

test("overall success, failure, threshold, and criticality each count one round", () => {
  const successDef = definition(5); const success = analyzeVoyageEncounterOverallResult(request(successDef, history(successDef, ["critical-round-success", "round-success", "round-failure", "critical-round-failure", "round-success"])));
  assert.deepEqual(Object.keys(success), ANALYSIS_KEYS); assert.equal(success.winningThreshold, 3); assert.equal(success.successfulRoundCount, 3); assert.equal(success.failedRoundCount, 2); assert.equal(success.overallResult, "overall-success"); assert.deepEqual(success.errors, []); assert.deepEqual(success.warnings, []);
  const failureDef = definition(3); const failure = analyzeVoyageEncounterOverallResult(request(failureDef, history(failureDef, ["critical-round-failure", "round-failure", "round-success"])));
  assert.equal(failure.winningThreshold, 2); assert.equal(failure.successfulRoundCount, 1); assert.equal(failure.failedRoundCount, 2); assert.equal(failure.overallResult, "overall-failure");
});

test("capture and validation envelopes have exact keys and isolated values", () => {
  const def = definition(); const hist = history(def); const capture = captureVoyageEncounterCompletedRoundHistory(hist);
  assert.deepEqual(Object.keys(capture), ["ok", "value", "errors", "warnings"]); assert.equal(capture.ok, true); assert.deepEqual(Object.keys(capture.value), ["schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "rounds"]); for (const round of capture.value.rounds) assert.deepEqual(Object.keys(round), ["roundId", "roundNumber", "roundResult"]); assert.deepEqual(capture.value, hist); assert.notEqual(capture.value, hist); assert.deepEqual(capture.errors, []); assert.deepEqual(capture.warnings, []);
  capture.value.rounds[0].roundResult = "round-failure"; assert.equal(hist.rounds[0].roundResult, "round-success");
  const validation = validateVoyageEncounterCompletedRoundHistory(hist, def); assert.deepEqual(Object.keys(validation), ["valid", "errors", "warnings"]); assert.deepEqual(validation, { valid: true, errors: [], warnings: [] }); const analyzed = analyzeVoyageEncounterOverallResult(request(def, hist)); for (const round of hist.rounds) assert.deepEqual(Object.keys(round), ["roundId", "roundNumber", "roundResult"]); assert.equal(analyzed.ok, true);
});

test("extra, missing, sparse, unknown, wrong-number, and out-of-order histories fail canonically", () => {
  const def = definition();
  const extra = history(def); extra.rounds.push({ roundId: "r4", roundNumber: 4, roundResult: "round-success" });
  assertDiagnostic(validateVoyageEncounterCompletedRoundHistory(extra, def).errors.find((entry) => entry.code === "m8-incomplete-round-history"), "m8-incomplete-round-history", "completedRoundHistory.rounds", MESSAGE.historyComplete);
  const missing = history(def); missing.rounds.splice(1, 1); assertDiagnostic(validateVoyageEncounterCompletedRoundHistory(missing, def).errors[0], "m8-incomplete-round-history", "completedRoundHistory.rounds", MESSAGE.historyComplete);
  const sparse = history(def); delete sparse.rounds[1]; assertDiagnostic(validateVoyageEncounterCompletedRoundHistory(sparse, def).errors[0], "m8-hostile-data-capture-failed", "$", MESSAGE.hostile);
  const unknown = history(def); unknown.rounds[1].roundId = "unknown"; assertDiagnostic(validateVoyageEncounterCompletedRoundHistory(unknown, def).errors.find((entry) => entry.code === "m8-unknown-round-id"), "m8-unknown-round-id", "completedRoundHistory.rounds[1].roundId", MESSAGE.unknown);
  const wrongNumber = history(def); wrongNumber.rounds[1].roundNumber = 9; assertDiagnostic(validateVoyageEncounterCompletedRoundHistory(wrongNumber, def).errors.find((entry) => entry.code === "m8-round-order-invalid"), "m8-round-order-invalid", "completedRoundHistory.rounds[1]", MESSAGE.order);
  const ordered = history(def); [ordered.rounds[0], ordered.rounds[1]] = [ordered.rounds[1], ordered.rounds[0]]; assertDiagnostic(validateVoyageEncounterCompletedRoundHistory(ordered, def).errors.find((entry) => entry.code === "m8-round-order-invalid"), "m8-round-order-invalid", "completedRoundHistory.rounds[0]", MESSAGE.order);
});

test("duplicate and invalid result diagnostics are exact and ordered", () => {
  const def = definition(); const hist = history(def); hist.rounds[1].roundId = "r1"; hist.rounds[0].roundResult = "invalid";
  const report = validateVoyageEncounterCompletedRoundHistory(hist, def); assert.deepEqual(report.errors, [
    { code: "m8-invalid-round-result", path: "completedRoundHistory.rounds[0].roundResult", message: MESSAGE.result, severity: "error" },
    { code: "m8-duplicate-round-result", path: "completedRoundHistory.rounds[1].roundId", message: MESSAGE.duplicate, severity: "error" },
    { code: "m8-round-order-invalid", path: "completedRoundHistory.rounds[1]", message: MESSAGE.order, severity: "error" }
  ]);
});

test("identity, snapshot, count, and independent session bindings are exact", () => {
  const def = definition(); const hist = history(def); assertDiagnostic(validateVoyageEncounterCompletedRoundHistory({ ...hist, eventId: "other" }, def).errors[0], "m8-event-identity-mismatch", "completedRoundHistory.eventId", MESSAGE.eventMismatch); assertDiagnostic(validateVoyageEncounterCompletedRoundHistory({ ...hist, definitionSnapshotId: "other" }, def).errors[0], "m8-definition-snapshot-mismatch", "completedRoundHistory.definitionSnapshotId", MESSAGE.snapshotMismatch);
  const countMismatch = { ...hist, roundCount: 5 }; assertDiagnostic(validateVoyageEncounterCompletedRoundHistory(countMismatch, def).errors[0], "m8-history-round-count-mismatch", "completedRoundHistory.roundCount", MESSAGE.countMismatch);
  const result = analyzeVoyageEncounterOverallResult(request(def, hist, { sessionId: "other" })); failure(result); assertDiagnostic(result.errors[0], "m8-session-identity-mismatch", "completedRoundHistory.sessionId", MESSAGE.sessionMismatch); assert.equal(result.errors.filter((entry) => entry.code === "m8-session-identity-mismatch").length, 1);
});

test("request key order, authority precedence, invalid mode, and exact messages are covered", () => {
  const def = definition(); const hist = history(def); const validRequest = request(def, hist); assert.deepEqual(Object.keys(validRequest), ["kind", "sessionId", "eventDefinition", "completedRoundHistory"]);
  for (const key of AUTHORITY_KEYS) { const result = analyzeVoyageEncounterOverallResult(request(def, hist, { [key]: null })); failure(result); assert.equal(result.errors.length, 1); assertDiagnostic(result.errors[0], "m8-caller-authored-plan-rejected", `request.${key}`, MESSAGE.authority); }
  const invalidMode = analyzeVoyageEncounterOverallResult({ kind: "bad" }); failure(invalidMode); assert.equal(invalidMode.errors.length, 1); assertDiagnostic(invalidMode.errors[0], "m8-invalid-mode", "request.kind", MESSAGE.mode);
  const unknown = analyzeVoyageEncounterOverallResult(request(def, hist, { unknown: true })); failure(unknown); assert.equal(unknown.errors.length, 1); assertDiagnostic(unknown.errors[0], "m8-invalid-request-shape", "request", MESSAGE.requestShape);
});

test("invalid Event Definition and next-situation diagnostics use canonical codes and paths", () => {
  const invalidCount = analyzeVoyageEncounterOverallResult(request(definition(4))); failure(invalidCount); assertDiagnostic(invalidCount.errors[0], "m8-invalid-round-count", "eventDefinition.roundCount", MESSAGE.invalidRoundCount);
  const malformed = analyzeVoyageEncounterOverallResult(request(definition(3, { nextSituations: [{ nextSituationId: "x" }] }))); failure(malformed); assertDiagnostic(malformed.errors[0], "m8-invalid-next-situation", "eventDefinition.nextSituations", MESSAGE.nextSituationDescriptor);
  const multiple = analyzeVoyageEncounterOverallResult(request(definition(3, { nextSituations: [{ nextSituationId: "a", title: "a", summary: "a", transitionKind: "retreat" }, { nextSituationId: "b", title: "b", summary: "b", transitionKind: "repair" }] }))); failure(multiple); assertDiagnostic(multiple.errors[0], "m8-invalid-next-situation", "eventDefinition.nextSituations", MESSAGE.nextSituationCardinality);
  const malformedRounds = analyzeVoyageEncounterOverallResult(request(definition(3, { rounds: [{ roundId: "r1", roundNumber: 1 }] }))); failure(malformedRounds); assertDiagnostic(malformedRounds.errors[0], "m8-invalid-event-definition", "eventDefinition", MESSAGE.eventRoundsCount);
});

test("all failure sentinels and diagnostic shapes are complete", () => {
  const result = analyzeVoyageEncounterOverallResult({ kind: "bad" }); failure(result); assert.ok(result.errors.length > 0); for (const entry of result.errors) assert.deepEqual(Object.keys(entry), ["code", "path", "message", "severity"]); assert.ok(result.errors.every((entry) => entry.severity === "error")); assert.ok(result.errors.every((entry) => entry.code !== UNAUTHORIZED_HISTORY_CODE));
});

test("hostile getters, functions, non-plain values, cycles, symbols, unsafe keys, sparse arrays, and revoked proxies fail safely", () => {
  const def = definition(); const hist = history(def); const getter = { get kind() { throw new Error("secret trap"); } }; const fn = () => undefined; const nonPlain = new Date(); const cyclic = request(def, hist); cyclic.eventDefinition.cycle = cyclic.eventDefinition; const symbol = request(def, hist); symbol[Symbol("x")] = 1; const unsafe = request(def, hist); Object.defineProperty(unsafe, "__proto__", { value: 1, enumerable: true }); const sparse = request(def, hist); delete sparse.completedRoundHistory.rounds[1]; const revoked = Proxy.revocable(request(def, hist), {}).proxy;
  for (const value of [getter, fn, nonPlain, cyclic, symbol, unsafe, sparse, revoked]) { const result = analyzeVoyageEncounterOverallResult(value); failure(result); assertDiagnostic(result.errors[0], "m8-hostile-data-capture-failed", "$", MESSAGE.hostile); assert.ok(result.errors.every((entry) => !/secret trap|TypeError|Proxy|revocation|trap|stack|engine/i.test(entry.message))); }
});

function assertExactCapturedHistory(input) {
  const result = captureVoyageEncounterCompletedRoundHistory(input);
  assert.equal(result.ok, true); assert.deepEqual(result.errors, []); assert.deepEqual(result.warnings, []); assert.notEqual(result.value, input); assert.deepEqual(result.value, input); assert.notEqual(result.value.rounds, input.rounds);
  result.value.rounds.forEach((round, index) => { assert.notEqual(round, input.rounds[index]); assert.deepEqual(round, input.rounds[index]); });
  return result.value;
}

test("capture preserves every semantic value while later validation rejects each fixture exactly", () => {
  const unsupportedSchema = definition(); const unsupportedSchemaHistory = history(unsupportedSchema); unsupportedSchemaHistory.schemaVersion = 99;
  const capturedSchema = assertExactCapturedHistory(unsupportedSchemaHistory);
  assert.deepEqual(validateVoyageEncounterCompletedRoundHistory(capturedSchema, unsupportedSchema), { valid: false, errors: [{ code: "m8-incomplete-round-history", path: "completedRoundHistory.rounds", message: "Completed round history has invalid identity or schema fields.", severity: "error" }], warnings: [] });

  const unsupportedCount = definition(); const unsupportedCountHistory = history(unsupportedCount); unsupportedCountHistory.roundCount = 4;
  const capturedCount = assertExactCapturedHistory(unsupportedCountHistory);
  assert.deepEqual(validateVoyageEncounterCompletedRoundHistory(capturedCount, unsupportedCount), { valid: false, errors: [{ code: "m8-history-round-count-mismatch", path: "completedRoundHistory.roundCount", message: "Completed history roundCount must match Event Definition.", severity: "error" }], warnings: [] });

  const whitespaceIdentity = definition(); const whitespaceIdentityHistory = history(whitespaceIdentity); whitespaceIdentityHistory.eventId = " id";
  const capturedWhitespace = assertExactCapturedHistory(whitespaceIdentityHistory);
  assert.deepEqual(validateVoyageEncounterCompletedRoundHistory(capturedWhitespace, whitespaceIdentity), { valid: false, errors: [{ code: "m8-incomplete-round-history", path: "completedRoundHistory.rounds", message: "Completed round history has invalid identity or schema fields.", severity: "error" }, { code: "m8-event-identity-mismatch", path: "completedRoundHistory.eventId", message: "Completed history eventId must match Event Definition.", severity: "error" }], warnings: [] });

  const noncanonicalNumber = definition(); const noncanonicalNumberHistory = history(noncanonicalNumber); noncanonicalNumberHistory.rounds[0].roundNumber = 9;
  const capturedNumber = assertExactCapturedHistory(noncanonicalNumberHistory);
  assert.deepEqual(validateVoyageEncounterCompletedRoundHistory(capturedNumber, noncanonicalNumber), { valid: false, errors: [{ code: "m8-round-order-invalid", path: "completedRoundHistory.rounds[0]", message: "Round results must follow Event Definition order.", severity: "error" }], warnings: [] });

  const noncanonicalResult = definition(); const noncanonicalResultHistory = history(noncanonicalResult); noncanonicalResultHistory.rounds[0].roundResult = "not-canonical";
  const capturedResult = assertExactCapturedHistory(noncanonicalResultHistory);
  assert.deepEqual(validateVoyageEncounterCompletedRoundHistory(capturedResult, noncanonicalResult), { valid: false, errors: [{ code: "m8-invalid-round-result", path: "completedRoundHistory.rounds[0].roundResult", message: "Round result is not canonical.", severity: "error" }], warnings: [] });

  const duplicateIdentity = definition(); const duplicateHistory = history(duplicateIdentity); duplicateHistory.rounds[1].roundId = duplicateHistory.rounds[0].roundId;
  const capturedDuplicate = assertExactCapturedHistory(duplicateHistory);
  assert.deepEqual(validateVoyageEncounterCompletedRoundHistory(capturedDuplicate, duplicateIdentity), { valid: false, errors: [{ code: "m8-duplicate-round-result", path: "completedRoundHistory.rounds[1].roundId", message: "A round result is duplicated.", severity: "error" }, { code: "m8-round-order-invalid", path: "completedRoundHistory.rounds[1]", message: "Round results must follow Event Definition order.", severity: "error" }], warnings: [] });

  const unknownIdentity = definition(); const unknownHistory = history(unknownIdentity); unknownHistory.rounds[1].roundId = "unknown-round";
  const capturedUnknown = assertExactCapturedHistory(unknownHistory);
  assert.deepEqual(validateVoyageEncounterCompletedRoundHistory(capturedUnknown, unknownIdentity), { valid: false, errors: [{ code: "m8-unknown-round-id", path: "completedRoundHistory.rounds[1].roundId", message: "Round result references an unknown roundId.", severity: "error" }, { code: "m8-round-order-invalid", path: "completedRoundHistory.rounds[1]", message: "Round results must follow Event Definition order.", severity: "error" }], warnings: [] });

  const mismatchedIdentities = definition(); const mismatchedHistory = history(mismatchedIdentities, undefined, { eventId: "other-event", sessionId: "other-session", definitionSnapshotId: "other-snapshot" });
  const capturedMismatches = assertExactCapturedHistory(mismatchedHistory);
  assert.deepEqual(validateVoyageEncounterCompletedRoundHistory(capturedMismatches, mismatchedIdentities), { valid: false, errors: [{ code: "m8-event-identity-mismatch", path: "completedRoundHistory.eventId", message: "Completed history eventId must match Event Definition.", severity: "error" }, { code: "m8-definition-snapshot-mismatch", path: "completedRoundHistory.definitionSnapshotId", message: "Completed history definitionSnapshotId must match Event Definition.", severity: "error" }], warnings: [] });
  const mismatchAnalysis = analyzeVoyageEncounterOverallResult(request(mismatchedIdentities, capturedMismatches, { sessionId: "request-session" })); failure(mismatchAnalysis); assert.deepEqual(mismatchAnalysis.errors, [{ code: "m8-session-identity-mismatch", path: "completedRoundHistory.sessionId", message: "Request sessionId must match completed history sessionId.", severity: "error" }, { code: "m8-event-identity-mismatch", path: "completedRoundHistory.eventId", message: "Completed history eventId must match Event Definition.", severity: "error" }, { code: "m8-definition-snapshot-mismatch", path: "completedRoundHistory.definitionSnapshotId", message: "Completed history definitionSnapshotId must match Event Definition.", severity: "error" }]);
});

test("nonblank string rules reject every invalid value independently", () => {
  const values = ["", " ", "\t", "\n", " id", "id ", "\tid", "id\n"];
  for (const value of values) {
    for (const field of ["eventId", "definitionSnapshotId"]) {
      const def = definition(); def[field] = value; const hist = history(def); const result = analyzeVoyageEncounterOverallResult(request(def, hist)); failure(result); assert.deepEqual(result.errors, [{ code: "m8-invalid-event-definition", path: "eventDefinition", message: "Event Definition identity or schema is invalid.", severity: "error" }]);
    }
    const roundDef = definition(); roundDef.rounds[0].roundId = value; const roundResult = analyzeVoyageEncounterOverallResult(request(roundDef)); failure(roundResult); assert.deepEqual(roundResult.errors, [{ code: "m8-invalid-event-definition", path: "eventDefinition", message: "Event Definition rounds must be unique and densely ordered.", severity: "error" }]);
    for (const field of ["nextSituationId", "title", "summary"]) {
      const next = { nextSituationId: "next-1", title: "Next title", summary: "Next summary", transitionKind: "retreat" }; next[field] = value; const nextDef = definition(3, { nextSituations: [next] }); const result = analyzeVoyageEncounterOverallResult(request(nextDef)); failure(result); assert.deepEqual(result.errors, [{ code: "m8-invalid-next-situation", path: "eventDefinition.nextSituations", message: "Event Definition nextSituations must contain one valid descriptor.", severity: "error" }]);
    }
    const eventHistoryDef = definition(); const eventHistory = history(eventHistoryDef); eventHistory.eventId = value; const eventHistoryResult = validateVoyageEncounterCompletedRoundHistory(eventHistory, eventHistoryDef); assert.deepEqual(eventHistoryResult, { valid: false, errors: [{ code: "m8-incomplete-round-history", path: "completedRoundHistory.rounds", message: "Completed round history has invalid identity or schema fields.", severity: "error" }, { code: "m8-event-identity-mismatch", path: "completedRoundHistory.eventId", message: "Completed history eventId must match Event Definition.", severity: "error" }], warnings: [] });
    const sessionDef = definition(); const sessionHistory = history(sessionDef); sessionHistory.sessionId = value; const sessionResult = analyzeVoyageEncounterOverallResult(request(sessionDef, sessionHistory, { sessionId: "request-session" })); failure(sessionResult); assert.deepEqual(sessionResult.errors, [{ code: "m8-session-identity-mismatch", path: "completedRoundHistory.sessionId", message: "Request sessionId must match completed history sessionId.", severity: "error" }, { code: "m8-incomplete-round-history", path: "completedRoundHistory.rounds", message: "Completed round history has invalid identity or schema fields.", severity: "error" }]);
    const snapshotDef = definition(); const snapshotHistory = history(snapshotDef); snapshotHistory.definitionSnapshotId = value; const snapshotResult = validateVoyageEncounterCompletedRoundHistory(snapshotHistory, snapshotDef); assert.deepEqual(snapshotResult, { valid: false, errors: [{ code: "m8-incomplete-round-history", path: "completedRoundHistory.rounds", message: "Completed round history has invalid identity or schema fields.", severity: "error" }, { code: "m8-definition-snapshot-mismatch", path: "completedRoundHistory.definitionSnapshotId", message: "Completed history definitionSnapshotId must match Event Definition.", severity: "error" }], warnings: [] });
    const roundHistoryDef = definition(); const roundHistory = history(roundHistoryDef); roundHistory.rounds[0].roundId = value; const roundHistoryResult = validateVoyageEncounterCompletedRoundHistory(roundHistory, roundHistoryDef); assert.deepEqual(roundHistoryResult, { valid: false, errors: [{ code: "m8-round-order-invalid", path: "completedRoundHistory.rounds[0]", message: "Round results must follow Event Definition order.", severity: "error" }], warnings: [] });
    const requestDef = definition(); const requestHistory = history(requestDef); const requestResult = analyzeVoyageEncounterOverallResult(request(requestDef, requestHistory, { sessionId: value })); failure(requestResult); assert.deepEqual(requestResult.errors, [{ code: "m8-invalid-request-shape", path: "request", message: "Request has invalid field values.", severity: "error" }]);
  }
});

test("valid strings with internal whitespace remain exact through capture and analysis", () => {
  for (const value of ["id", "event-1", "Two Words"]) {
    const def = definition(); def.eventId = value; def.definitionSnapshotId = `${value}-snapshot`; def.rounds[0].roundId = `${value}-round`; const hist = history(def); hist.sessionId = `${value}-session`; const captured = assertExactCapturedHistory(hist); assert.equal(captured.eventId, hist.eventId); assert.equal(captured.sessionId, hist.sessionId); assert.equal(captured.definitionSnapshotId, hist.definitionSnapshotId); assert.equal(captured.rounds[0].roundId, hist.rounds[0].roundId);
    const result = analyzeVoyageEncounterOverallResult(request(def, hist)); assert.equal(result.ok, true); assert.equal(result.eventId, def.eventId); assert.equal(result.sessionId, hist.sessionId); assert.equal(result.definitionSnapshotId, def.definitionSnapshotId);
  }
});

test("standalone validator short-circuits after invalid Event Definition capture", () => {
  const def = definition(); const hist = history(def); for (const rounds of [{}, null]) {
    const invalidDef = { ...def, rounds }; assert.doesNotThrow(() => validateVoyageEncounterCompletedRoundHistory(hist, invalidDef)); const result = validateVoyageEncounterCompletedRoundHistory(hist, invalidDef); assert.equal(result.valid, false); assert.deepEqual(result.errors, [{ code: "m8-invalid-event-definition", path: "eventDefinition", message: MESSAGE.eventRoundsDense, severity: "error" }]); assert.deepEqual(result.warnings, []); assert.ok(result.errors.every((entry) => !/TypeError|stack|engine/i.test(entry.message)));
  }
});

test("determinism, input immutability, returned isolation, and cross-call isolation hold", () => {
  const def = definition(); const hist = history(def); const source = JSON.stringify({ def, hist }); const first = analyzeVoyageEncounterOverallResult(request(def, hist)); const second = analyzeVoyageEncounterOverallResult(request(def, hist)); assert.deepEqual(first, second); assert.equal(JSON.stringify({ def, hist }), source); first.errors.push({ code: "tampered" }); first.overallResult = "tampered"; assert.equal(analyzeVoyageEncounterOverallResult(request(def, hist)).overallResult, "overall-success");
});

test("overall analysis remains pure and excludes later-milestone behavior", () => {
  const def = definition(); const hist = history(def); const before = JSON.stringify({ def, hist }); const originalRandom = Math.random; let randomCalls = 0; Math.random = () => { randomCalls += 1; return 0.5; };
  try { const result = analyzeVoyageEncounterOverallResult(request(def, hist)); assert.equal(result.ok, true); assert.deepEqual(Object.keys(result).filter((key) => /reward|misfortune|allocation|closeout|socket|revision|event|foundry|pf2e|pressure|hazard/i.test(key)), ["eventId"]); } finally { Math.random = originalRandom; }
  assert.equal(randomCalls, 0); assert.equal(JSON.stringify({ def, hist }), before);
});

test("public analysis envelopes preserve exact success and failure key order", () => {
  const def = definition(); const hist = history(def); assert.deepEqual(Object.keys(analyzeVoyageEncounterOverallResult(request(def, hist))), ANALYSIS_KEYS); assert.deepEqual(Object.keys(analyzeVoyageEncounterOverallResult({ kind: "bad" })), ANALYSIS_KEYS);
});
