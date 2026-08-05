import { analyzeVoyageEncounterRewardSteps } from "./rewards.js";

const EVENT_FIELDS = ["schemaVersion", "eventId", "definitionSnapshotId", "roundCount", "rounds", "rewards", "enhancements", "misfortuneEnhancements", "misfortunes", "nextSituations"];
const HISTORY_FIELDS = ["schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "rounds"];
const REQUEST_FIELDS = ["kind", "sessionId", "eventDefinition", "completedRoundHistory", "allocation"];
const ALLOCATION_FIELDS = ["eventId", "sessionId", "rewardSelections"];
const SELECTION_FIELDS = ["operation", "rewardId", "enhancementId"];
const AUTHORITY_KEYS = new Set(["overallResult", "rewardAnalysis", "negativeAnalysis", "rewardSteps", "negativeSteps", "resultPackage", "allocationPlan", "nextState"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const CATEGORY_5_6_CODES = new Set([
  "m8-invalid-event-definition",
  "m8-invalid-next-situation",
  "m8-invalid-reward-definition",
  "m8-duplicate-reward-identity",
  "m8-invalid-reward-enhancement",
  "m8-duplicate-enhancement-identity",
  "m8-unresolved-reward-enhancement-reference",
  "m8-unresolved-compatible-reward-reference",
  "m8-invalid-compatible-reward-kind",
  "m8-invalid-empty-reward-enhancement-compatibility",
  "m8-invalid-void-fortune",
  "m8-duplicate-void-fortune-identity",
  "m8-invalid-field-repair-resource",
  "m8-duplicate-field-repair-resource-identity"
]);
const MESSAGES = Object.freeze({
  hostile: "Input contains inaccessible or unsafe data.",
  requestShape: "Request has an invalid exact shape.",
  requestValues: "Request has invalid field values.",
  mode: "Only m8-reward-allocation analysis is supported.",
  authority: "Caller-authored result plans are not accepted.",
  invalidAllocation: "Allocation shape is invalid.",
  allocationEventMismatch: "Allocation eventId must match completed history eventId.",
  allocationSessionMismatch: "Allocation sessionId must match request sessionId.",
  exceeds: "Allocation selection count exceeds calculated Reward Steps.",
  underallocated: "Allocation selection count is below calculated Reward Steps.",
  tooManyRewards: "More than three reward items were selected.",
  tooManyEnhancements: "A reward received more than two enhancements.",
  duplicate: "A duplicate reward or enhancement operation was supplied.",
  unsupported: "Enhancement is incompatible with its target."
});

function issue(code, path, message) { return { code, path, message, severity: "error" }; }
function dedupe(errors) {
  const seen = new Set();
  return errors.filter((entry) => { const key = JSON.stringify(entry); if (seen.has(key)) return false; seen.add(key); return true; });
}
function isPlain(value) {
  if (value === null || typeof value !== "object") return false;
  try { const prototype = Object.getPrototypeOf(value); return prototype === Object.prototype || prototype === null; } catch { return false; }
}
function exact(value, fields) {
  if (!isPlain(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && keys.every((key, index) => key === fields[index]);
}
function nonblank(value) { return typeof value === "string" && value.length > 0 && value.trim() === value; }
function dense(value) {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) if (!Object.hasOwn(value, index)) return false;
  return true;
}
function hostile(errors) { errors.push(issue("m8-hostile-data-capture-failed", "$", MESSAGES.hostile)); }
function captureValue(value, errors, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") { if (Number.isFinite(value)) return value; hostile(errors); return null; }
  if (typeof value !== "object" || ancestors.has(value)) { hostile(errors); return null; }
  let array; let prototype; let keys;
  try { array = Array.isArray(value); prototype = Object.getPrototypeOf(value); keys = Reflect.ownKeys(value); } catch { hostile(errors); return null; }
  if (array ? prototype !== Array.prototype : (prototype !== Object.prototype && prototype !== null)) { hostile(errors); return null; }
  const next = new Set(ancestors); next.add(value);
  if (array) {
    let lengthDescriptor;
    try { lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length"); } catch { hostile(errors); return null; }
    const length = lengthDescriptor?.value;
    if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) { hostile(errors); return null; }
    const output = new Array(length);
    for (const key of keys) if (key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) { hostile(errors); return null; }
    for (let index = 0; index < length; index += 1) {
      let descriptor;
      try { descriptor = Object.getOwnPropertyDescriptor(value, String(index)); } catch { hostile(errors); return null; }
      if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) { hostile(errors); return null; }
      output[index] = captureValue(descriptor.value, errors, next);
    }
    return output;
  }
  const output = {};
  for (const key of keys) {
    if (typeof key !== "string" || UNSAFE_KEYS.has(key)) { hostile(errors); return null; }
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { hostile(errors); return null; }
    if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) { hostile(errors); return null; }
    output[key] = captureValue(descriptor.value, errors, next);
  }
  return output;
}
function captureRoot(value) {
  const errors = [];
  const captured = captureValue(value, errors);
  return errors.length ? { ok: false, value: null, errors: dedupe(errors), warnings: [] } : { ok: true, value: captured, errors: [], warnings: [] };
}
function invalidEnvelope(errors) {
  return { ok: false, readyForRewardAllocation: false, eventId: null, sessionId: null, definitionSnapshotId: null, rewardSteps: null, rewardSelections: [], allocatedRewards: [], errors: dedupe(errors), warnings: [] };
}
function narrowBindingErrors(history, definition, sessionId) {
  if (!exact(history, HISTORY_FIELDS)) return [];
  const errors = [];
  if (nonblank(history.eventId) && nonblank(definition.eventId) && history.eventId !== definition.eventId) errors.push(issue("m8-event-identity-mismatch", "completedRoundHistory.eventId", "Completed history eventId must match Event Definition."));
  if (nonblank(history.sessionId) && nonblank(sessionId) && history.sessionId !== sessionId) errors.push(issue("m8-session-identity-mismatch", "completedRoundHistory.sessionId", "Request sessionId must match completed history sessionId."));
  if (nonblank(history.definitionSnapshotId) && nonblank(definition.definitionSnapshotId) && history.definitionSnapshotId !== definition.definitionSnapshotId) errors.push(issue("m8-definition-snapshot-mismatch", "completedRoundHistory.definitionSnapshotId", "Completed history definitionSnapshotId must match Event Definition."));
  return errors;
}
function allocationShapeError() { return issue("m8-invalid-reward-allocation", "allocation", MESSAGES.invalidAllocation); }
function allocationSelectionShapeValid(selection) {
  return exact(selection, SELECTION_FIELDS) && (selection.operation === "add-reward" || selection.operation === "enhance-reward") && nonblank(selection.rewardId) && ((selection.operation === "add-reward" && selection.enhancementId === null) || (selection.operation === "enhance-reward" && nonblank(selection.enhancementId)));
}
function validateAllocationShape(allocation) {
  if (!exact(allocation, ALLOCATION_FIELDS) || !nonblank(allocation.eventId) || !nonblank(allocation.sessionId) || !dense(allocation.rewardSelections)) return [allocationShapeError()];
  if (!allocation.rewardSelections.every(allocationSelectionShapeValid)) return [allocationShapeError()];
  return [];
}
function categoryFiveSix(errors) { return errors.some((entry) => CATEGORY_5_6_CODES.has(entry.code)); }
function validateAllocation(value, rewardAnalysis) {
  const allocation = value.allocation;
  const shapeErrors = validateAllocationShape(allocation);
  if (shapeErrors.length) return shapeErrors;
  const errors = [];
  if (allocation.eventId !== value.completedRoundHistory.eventId) errors.push(issue("m8-allocation-event-mismatch", "allocation.eventId", MESSAGES.allocationEventMismatch));
  if (allocation.sessionId !== value.sessionId) errors.push(issue("m8-allocation-session-mismatch", "allocation.sessionId", MESSAGES.allocationSessionMismatch));
  if (errors.length) return errors;
  if (allocation.rewardSelections.length > rewardAnalysis.rewardSteps) return [issue("m8-allocation-exceeds-reward-steps", "allocation.rewardSelections", MESSAGES.exceeds)];
  if (allocation.rewardSelections.length < rewardAnalysis.rewardSteps) return [issue("m8-allocation-underallocated", "allocation.rewardSelections", MESSAGES.underallocated)];
  const addCount = allocation.rewardSelections.filter((selection) => selection.operation === "add-reward").length;
  if (addCount > 3) return [issue("m8-too-many-selected-rewards", "allocation.rewardSelections", MESSAGES.tooManyRewards)];
  const seenAdds = new Set();
  const seenEnhancements = new Map();
  const duplicateErrors = [];
  allocation.rewardSelections.forEach((selection, index) => {
    if (selection.operation === "add-reward") {
      if (seenAdds.has(selection.rewardId)) duplicateErrors.push(issue("m8-duplicate-selection", `allocation.rewardSelections[${index}]`, MESSAGES.duplicate));
      else seenAdds.add(selection.rewardId);
    } else {
      const selected = seenEnhancements.get(selection.rewardId) ?? new Set();
      if (selected?.has(selection.enhancementId)) duplicateErrors.push(issue("m8-duplicate-selection", `allocation.rewardSelections[${index}]`, MESSAGES.duplicate));
      else { selected.add(selection.enhancementId); seenEnhancements.set(selection.rewardId, selected); }
    }
  });
  if (duplicateErrors.length) return dedupe(duplicateErrors);
  const rewards = new Map(value.eventDefinition.rewards.map((entry) => [entry.rewardId, entry]));
  const enhancements = new Map(value.eventDefinition.enhancements.map((entry) => [entry.enhancementId, entry]));
  const sequentialErrors = [];
  const added = new Set();
  allocation.rewardSelections.forEach((selection, index) => {
    const path = `allocation.rewardSelections[${index}]`;
    if (selection.operation === "add-reward") {
      if (!rewards.has(selection.rewardId)) sequentialErrors.push(allocationShapeError());
      else added.add(selection.rewardId);
      return;
    }
    const reward = rewards.get(selection.rewardId);
    const enhancement = enhancements.get(selection.enhancementId);
    if (!added.has(selection.rewardId) || !reward || !enhancement || !reward.enhancementIds.includes(selection.enhancementId)) sequentialErrors.push(issue("m8-unsupported-enhancement-target", path, MESSAGES.unsupported));
  });
  if (sequentialErrors.length) return dedupe(sequentialErrors);
  const compatibilityErrors = [];
  allocation.rewardSelections.forEach((selection, index) => {
    if (selection.operation !== "enhance-reward") return;
    const reward = rewards.get(selection.rewardId); const enhancement = enhancements.get(selection.enhancementId);
    if ((enhancement.compatibleRewardIds.length > 0 && !enhancement.compatibleRewardIds.includes(reward.rewardId)) || (enhancement.compatibleRewardKinds.length > 0 && !enhancement.compatibleRewardKinds.includes(reward.kind))) compatibilityErrors.push(issue("m8-unsupported-enhancement-target", `allocation.rewardSelections[${index}]`, MESSAGES.unsupported));
  });
  if (compatibilityErrors.length) return dedupe(compatibilityErrors);
  const enhancementCounts = new Map();
  for (const selection of allocation.rewardSelections) if (selection.operation === "enhance-reward") enhancementCounts.set(selection.rewardId, (enhancementCounts.get(selection.rewardId) ?? 0) + 1);
  const tooMany = allocation.rewardSelections.findIndex((selection) => selection.operation === "enhance-reward" && enhancementCounts.get(selection.rewardId) > 2);
  if (tooMany >= 0) return [issue("m8-too-many-enhancements", `allocation.rewardSelections[${tooMany}]`, MESSAGES.tooManyEnhancements)];
  return [];
}

export function analyzeVoyageEncounterRewardAllocation(request) {
  const captured = captureRoot(request);
  if (!captured.ok) return invalidEnvelope(captured.errors);
  const value = captured.value;
  if (!isPlain(value)) return invalidEnvelope([issue("m8-invalid-request-shape", "request", MESSAGES.requestShape)]);
  const authorityErrors = Object.keys(value).filter((key) => AUTHORITY_KEYS.has(key)).map((key) => issue("m8-caller-authored-plan-rejected", `request.${key}`, MESSAGES.authority));
  if (authorityErrors.length) return invalidEnvelope(authorityErrors);
  if (value.kind !== "m8-reward-allocation") return invalidEnvelope([issue("m8-invalid-mode", "request.kind", MESSAGES.mode)]);
  if (!exact(value, REQUEST_FIELDS)) return invalidEnvelope([issue("m8-invalid-request-shape", "request", MESSAGES.requestShape)]);
  if (!nonblank(value.sessionId) || !isPlain(value.eventDefinition) || !isPlain(value.completedRoundHistory)) return invalidEnvelope([issue("m8-invalid-request-shape", "request", MESSAGES.requestValues)]);
  const rewardAnalysis = analyzeVoyageEncounterRewardSteps({ kind: "m8-reward-steps", sessionId: value.sessionId, eventDefinition: value.eventDefinition, completedRoundHistory: value.completedRoundHistory });
  if (!rewardAnalysis.ok && categoryFiveSix(rewardAnalysis.errors)) return invalidEnvelope(rewardAnalysis.errors);
  const bindingErrors = narrowBindingErrors(value.completedRoundHistory, value.eventDefinition, value.sessionId);
  if (bindingErrors.length) return invalidEnvelope(bindingErrors);
  if (!rewardAnalysis.ok) return invalidEnvelope(rewardAnalysis.errors);
  const allocationErrors = validateAllocation(value, rewardAnalysis);
  if (allocationErrors.length) return invalidEnvelope(allocationErrors);
  const selected = new Map();
  for (const selection of value.allocation.rewardSelections) {
    if (selection.operation === "add-reward") selected.set(selection.rewardId, []);
    else selected.get(selection.rewardId).push(selection.enhancementId);
  }
  const allocatedRewards = [...selected].map(([rewardId, enhancementIds]) => ({ rewardId, enhancementIds: [...enhancementIds] }));
  return { ok: true, readyForRewardAllocation: true, eventId: rewardAnalysis.eventId, sessionId: rewardAnalysis.sessionId, definitionSnapshotId: rewardAnalysis.definitionSnapshotId, rewardSteps: rewardAnalysis.rewardSteps, rewardSelections: value.allocation.rewardSelections.map((selection) => ({ ...selection })), allocatedRewards, errors: [], warnings: [] };
}
