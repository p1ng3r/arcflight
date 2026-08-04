const ROUND_RESULTS = Object.freeze({
  CRITICAL_SUCCESS: "critical-round-success",
  SUCCESS: "round-success",
  FAILURE: "round-failure",
  CRITICAL_FAILURE: "critical-round-failure"
});
const ROUND_RESULT_SET = new Set(Object.values(ROUND_RESULTS));
const VALID_ROUND_COUNTS = new Set([3, 5, 7, 9, 11]);
const TRANSITIONS = new Set(["retreat", "diversion", "emergency", "capture", "delay", "repair", "authored"]);
const PROHIBITED = ["overallResult", "rewardAnalysis", "negativeAnalysis", "rewardSteps", "negativeSteps", "resultPackage", "allocationPlan", "nextState"];

function issue(code, path, message, severity = "error") {
  return { code, path, message, severity };
}
function dedupe(errors) {
  const seen = new Set();
  return errors.filter((entry) => { const key = JSON.stringify(entry); if (seen.has(key)) return false; seen.add(key); return true; });
}
function hostile(path, errors) { errors.push(issue("m8-hostile-data-capture-failed", path, "Input contains inaccessible or unsafe data.")); }

function capture(value, path = "$", errors = [], ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") { if (Number.isFinite(value)) return value; hostile(path, errors); return null; }
  if (typeof value !== "object") { hostile(path, errors); return null; }
  if (ancestors.has(value)) { hostile(path, errors); return null; }
  let isArray; let proto; let keys;
  try { isArray = Array.isArray(value); proto = Object.getPrototypeOf(value); keys = Reflect.ownKeys(value); } catch { hostile(path, errors); return null; }
  if (!isArray && proto !== null && proto !== Object.prototype) { hostile(path, errors); return null; }
  const nextAncestors = new Set(ancestors); nextAncestors.add(value);
  if (isArray) {
    let length; try { const d = Object.getOwnPropertyDescriptor(value, "length"); length = d && d.value; } catch { hostile(path, errors); return null; }
    if (!Number.isSafeInteger(length) || length < 0) { hostile(path, errors); return null; }
    const out = new Array(length); const indices = new Set();
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) { hostile(path, errors); return null; }
      const index = Number(key); if (!Number.isSafeInteger(index) || index >= length) { hostile(path, errors); return null; }
      let d; try { d = Object.getOwnPropertyDescriptor(value, key); } catch { hostile(path, errors); return null; }
      if (!d || !Object.hasOwn(d, "value") || d.enumerable !== true) { hostile(`${path}[${index}]`, errors); return null; }
      indices.add(index); out[index] = capture(d.value, `${path}[${index}]`, errors, nextAncestors);
    }
    if (indices.size !== length) { hostile(path, errors); return null; }
    return out;
  }
  const out = {};
  for (const key of keys) {
    if (typeof key !== "string" || key === "__proto__" || key === "constructor" || key === "prototype") { hostile(path, errors); return null; }
    let d; try { d = Object.getOwnPropertyDescriptor(value, key); } catch { hostile(path, errors); return null; }
    if (!d || !Object.hasOwn(d, "value") || d.enumerable !== true) { hostile(`${path}.${key}`, errors); return null; }
    out[key] = capture(d.value, `${path}.${key}`, errors, nextAncestors);
  }
  return out;
}
function captured(value, path = "$") {
  const errors = []; const result = capture(value, path, errors);
  const normalizedErrors = dedupe(errors).map((entry) => entry.code === "m8-hostile-data-capture-failed" ? { ...entry, path: "$" } : entry);
  return errors.length ? { ok: false, value: null, errors: normalizedErrors, warnings: [] } : { ok: true, value: result, errors: [], warnings: [] };
}
function exactKeys(value, expected) { return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === expected.length && Object.keys(value).every((key, i) => key === expected[i]); }
function string(value) { return typeof value === "string" && value.length > 0; }
function denseArray(value) { return Array.isArray(value) && value.every((entry, i) => Object.hasOwn(value, i)); }
function invalidEnvelope(errors) {
  return { ok: false, readyForOverallResult: false, eventId: null, sessionId: null, definitionSnapshotId: null, roundCount: null, winningThreshold: null, successfulRoundCount: null, failedRoundCount: null, overallResult: null, errors: dedupe(errors), warnings: [] };
}
function validateDefinition(definition) {
  const errors = []; const root = "eventDefinition";
  if (!exactKeys(definition, ["schemaVersion", "eventId", "definitionSnapshotId", "roundCount", "rounds", "rewards", "enhancements", "misfortuneEnhancements", "misfortunes", "nextSituations"])) { errors.push(issue("m8-invalid-event-definition", root, "Event Definition has an invalid exact shape.")); return errors; }
  if (definition.schemaVersion !== 1 || !string(definition.eventId) || !string(definition.definitionSnapshotId)) errors.push(issue("m8-invalid-event-definition", root, "Event Definition identity or schema is invalid."));
  if (!Number.isSafeInteger(definition.roundCount) || !VALID_ROUND_COUNTS.has(definition.roundCount)) errors.push(issue("m8-invalid-round-count", `${root}.roundCount`, "Event Definition roundCount must be one of 3, 5, 7, 9, or 11."));
  if (!denseArray(definition.rounds)) errors.push(issue("m8-invalid-event-definition", root, "Event Definition rounds must be dense."));
  else {
    if (Number.isSafeInteger(definition.roundCount) && definition.rounds.length !== definition.roundCount) errors.push(issue("m8-invalid-event-definition", root, "Event Definition rounds must match roundCount."));
    const ids = new Set(); definition.rounds.forEach((round, i) => {
      if (!exactKeys(round, ["roundId", "roundNumber"]) || !string(round.roundId) || !Number.isSafeInteger(round.roundNumber) || round.roundNumber !== i + 1 || ids.has(round.roundId)) errors.push(issue("m8-invalid-event-definition", root, "Event Definition rounds must be unique and densely ordered."));
      ids.add(round && round.roundId);
    });
  }
  for (const key of ["rewards", "enhancements", "misfortuneEnhancements", "misfortunes"]) if (!denseArray(definition[key])) errors.push(issue("m8-invalid-event-definition", root, "Authored catalogs must be dense arrays."));
  if (!denseArray(definition.nextSituations) || definition.nextSituations.length > 1) errors.push(issue("m8-invalid-next-situation", `${root}.nextSituations`, "Event Definition must contain zero or one valid next situation."));
  else if (definition.nextSituations.length === 1) {
    const next = definition.nextSituations[0];
    if (!exactKeys(next, ["nextSituationId", "title", "summary", "transitionKind"]) || !string(next.nextSituationId) || typeof next.title !== "string" || typeof next.summary !== "string" || !TRANSITIONS.has(next.transitionKind)) errors.push(issue("m8-invalid-next-situation", `${root}.nextSituations`, "Event Definition nextSituations must contain one valid descriptor."));
  }
  return dedupe(errors);
}
function validateHistory(history, definition) {
  const errors = []; const root = "completedRoundHistory";
  if (!exactKeys(history, ["schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "rounds"])) { errors.push(issue("m8-incomplete-round-history", `${root}.rounds`, "Completed round history must contain every authored round exactly once.")); return errors; }
  if (history.schemaVersion !== 1 || !string(history.eventId) || !string(history.sessionId) || !string(history.definitionSnapshotId)) errors.push(issue("m8-incomplete-round-history", `${root}.rounds`, "Completed round history has invalid identity or schema fields."));
  if (history.eventId !== definition.eventId) errors.push(issue("m8-event-identity-mismatch", `${root}.eventId`, "Completed history eventId must match Event Definition."));
  if (history.definitionSnapshotId !== definition.definitionSnapshotId) errors.push(issue("m8-definition-snapshot-mismatch", `${root}.definitionSnapshotId`, "Completed history definitionSnapshotId must match Event Definition."));
  if (history.roundCount !== definition.roundCount) errors.push(issue("m8-history-round-count-mismatch", `${root}.roundCount`, "Completed history roundCount must match Event Definition."));
  if (!denseArray(history.rounds)) { errors.push(issue("m8-incomplete-round-history", `${root}.rounds`, "Completed round history must be dense and complete.")); return errors; }
  if (history.rounds.length !== definition.rounds.length) errors.push(issue("m8-incomplete-round-history", `${root}.rounds`, "Completed round history must contain every authored round exactly once."));
  const seen = new Set();
  history.rounds.forEach((round, i) => {
    const path = `${root}.rounds[${i}]`;
    if (!exactKeys(round, ["roundId", "roundNumber", "roundResult"])) { errors.push(issue("m8-incomplete-round-history", path, "Completed round entry shape is invalid.")); return; }
    if (seen.has(round.roundId)) errors.push(issue("m8-duplicate-round-result", `${path}.roundId`, "A round result is duplicated.")); seen.add(round.roundId);
    const expected = definition.rounds[i];
    if (!expected || !definition.rounds.some((entry) => entry.roundId === round.roundId)) errors.push(issue("m8-unknown-round-id", `${path}.roundId`, "Round result references an unknown roundId."));
    if (expected && (round.roundId !== expected.roundId || round.roundNumber !== expected.roundNumber)) errors.push(issue("m8-round-order-invalid", path, "Round results must follow Event Definition order."));
    if (!ROUND_RESULT_SET.has(round.roundResult)) errors.push(issue("m8-invalid-round-result", `${path}.roundResult`, "Round result is not canonical."));
  });
  return dedupe(errors);
}
function validateCaptureOnly(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "rounds"]) || value.schemaVersion !== 1 || !string(value.eventId) || !string(value.sessionId) || !string(value.definitionSnapshotId) || !Number.isSafeInteger(value.roundCount) || !VALID_ROUND_COUNTS.has(value.roundCount) || !denseArray(value.rounds)) {
    errors.push(issue("m8-incomplete-round-history", "completedRoundHistory.rounds", "Completed round history must contain every authored round exactly once."));
  } else {
    value.rounds.forEach((round, index) => {
      if (!exactKeys(round, ["roundId", "roundNumber", "roundResult"]) || !string(round.roundId) || !Number.isSafeInteger(round.roundNumber)) errors.push(issue("m8-incomplete-round-history", `completedRoundHistory.rounds[${index}]`, "Completed round entry has an invalid exact shape."));
      else if (!ROUND_RESULT_SET.has(round.roundResult)) errors.push(issue("m8-invalid-round-result", `completedRoundHistory.rounds[${index}].roundResult`, "Round result is not canonical."));
    });
  }
  return errors;
}
export function captureVoyageEncounterCompletedRoundHistory(completedRoundHistory) {
  const result = captured(completedRoundHistory);
  if (!result.ok) return { ok: false, value: null, errors: result.errors, warnings: [] };
  const errors = validateCaptureOnly(result.value);
  return errors.length ? { ok: false, value: null, errors, warnings: [] } : { ok: true, value: result.value, errors: [], warnings: [] };
}
export function validateVoyageEncounterCompletedRoundHistory(completedRoundHistory, eventDefinition) {
  const historyCapture = captured(completedRoundHistory); const definitionCapture = captured(eventDefinition);
  if (!historyCapture.ok || !definitionCapture.ok) return { valid: false, errors: dedupe([...(historyCapture.ok ? [] : historyCapture.errors), ...(definitionCapture.ok ? [] : definitionCapture.errors)]), warnings: [] };
  const definitionErrors = validateDefinition(definitionCapture.value); const errors = [...definitionErrors, ...validateHistory(historyCapture.value, definitionCapture.value)];
  return { valid: errors.length === 0, errors: dedupe(errors), warnings: [] };
}
export function analyzeVoyageEncounterOverallResult(request) {
  const reqCapture = captured(request);
  if (!reqCapture.ok) return invalidEnvelope(reqCapture.errors);
  const req = reqCapture.value;
  const prohibitedErrors = PROHIBITED.filter((key) => Object.hasOwn(req, key)).map((key) => issue("m8-caller-authored-plan-rejected", `request.${key}`, "Caller-authored result plans are not accepted."));
  if (prohibitedErrors.length) return invalidEnvelope(prohibitedErrors);
  if (req.kind !== "m8-overall-result") return invalidEnvelope([issue("m8-invalid-mode", "request.kind", "Only m8-overall-result analysis is supported.")]);
  if (!exactKeys(req, ["kind", "sessionId", "eventDefinition", "completedRoundHistory"])) return invalidEnvelope([issue("m8-invalid-request-shape", "request", "Request has an invalid exact shape.")]);
  if (!string(req.sessionId) || req.eventDefinition === null || typeof req.eventDefinition !== "object" || req.completedRoundHistory === null || typeof req.completedRoundHistory !== "object") return invalidEnvelope([issue("m8-invalid-request-shape", "request", "Request has invalid field values.")]);
  const definition = req.eventDefinition; const history = req.completedRoundHistory;
  const definitionErrors = validateDefinition(definition); if (definitionErrors.length) return invalidEnvelope(definitionErrors);
  const errors = [];
  if (!string(req.sessionId) || req.sessionId !== history.sessionId) errors.push(issue("m8-session-identity-mismatch", "completedRoundHistory.sessionId", "Request sessionId must match completed history sessionId."));
  errors.push(...validateHistory(history, definition));
  if (errors.length) return invalidEnvelope(errors);
  const successfulRoundCount = history.rounds.filter((round) => round.roundResult === ROUND_RESULTS.CRITICAL_SUCCESS || round.roundResult === ROUND_RESULTS.SUCCESS).length;
  const failedRoundCount = history.rounds.length - successfulRoundCount;
  const winningThreshold = (definition.roundCount + 1) / 2;
  const overallResult = successfulRoundCount >= winningThreshold ? "overall-success" : "overall-failure";
  return { ok: true, readyForOverallResult: true, eventId: definition.eventId, sessionId: req.sessionId, definitionSnapshotId: definition.definitionSnapshotId, roundCount: definition.roundCount, winningThreshold, successfulRoundCount, failedRoundCount, overallResult, errors: [], warnings: [] };
}
