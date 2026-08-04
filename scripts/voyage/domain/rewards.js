import { analyzeVoyageEncounterOverallResult } from "./event-result.js";

const REWARD_FIELDS = Object.freeze(["rewardId", "kind", "title", "description", "tags", "enhancementIds", "voidFortune", "fieldRepairResource"]);
const ENHANCEMENT_FIELDS = Object.freeze(["enhancementId", "title", "description", "compatibleRewardIds", "compatibleRewardKinds", "maxApplicationsPerReward"]);
const VOID_FORTUNE_FIELDS = Object.freeze(["voidFortuneId", "title", "description", "tags"]);
const FIELD_REPAIR_FIELDS = Object.freeze(["fieldRepairResourceId", "title", "description", "compatibleScarTags", "timing", "safeRestRequired"]);
const EVENT_FIELDS = Object.freeze(["schemaVersion", "eventId", "definitionSnapshotId", "roundCount", "rounds", "rewards", "enhancements", "misfortuneEnhancements", "misfortunes", "nextSituations"]);
const ROUND_FIELDS = Object.freeze(["roundId", "roundNumber", "roundResult"]);
const NEXT_FIELDS = Object.freeze(["nextSituationId", "title", "summary", "transitionKind"]);
const REQUEST_FIELDS = Object.freeze(["kind", "sessionId", "eventDefinition", "completedRoundHistory"]);
const AUTHORITY_KEYS = Object.freeze(["overallResult", "rewardAnalysis", "negativeAnalysis", "rewardSteps", "negativeSteps", "resultPackage", "allocationPlan", "nextState"]);
const KINDS = new Set(["item", "benefit", "void-fortune", "field-repair-resource"]);
const TRANSITIONS = new Set(["retreat", "diversion", "emergency", "capture", "delay", "repair", "authored"]);
const ROUND_RESULTS = new Set(["critical-round-success", "round-success", "round-failure", "critical-round-failure"]);
const ROUND_COUNTS = new Set([3, 5, 7, 9, 11]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const MESSAGES = Object.freeze({
  hostile: "Input contains inaccessible or unsafe data.",
  requestShape: "Request has an invalid exact shape.",
  requestValues: "Request has invalid field values.",
  mode: "Only m8-reward-steps analysis is supported.",
  eventShape: "Event Definition has an invalid exact shape.",
  eventIdentity: "Event Definition identity or schema is invalid.",
  roundsDense: "Event Definition rounds must be dense.",
  roundsCount: "Event Definition rounds must match roundCount.",
  roundsOrder: "Event Definition rounds must be unique and densely ordered.",
  catalogsDense: "Authored catalogs must be dense arrays.",
  nextCardinality: "Event Definition must contain zero or one valid next situation.",
  nextDescriptor: "Event Definition nextSituations must contain one valid descriptor.",
  invalidRoundCount: "Event Definition roundCount must be one of 3, 5, 7, 9, or 11.",
  historyComplete: "Completed round history must contain every authored round exactly once.",
  historyIdentity: "Completed round history has invalid identity or schema fields.",
  eventMismatch: "Completed history eventId must match Event Definition.",
  sessionMismatch: "Request sessionId must match completed history sessionId.",
  snapshotMismatch: "Completed history definitionSnapshotId must match Event Definition.",
  countMismatch: "Completed history roundCount must match Event Definition.",
  historyDense: "Completed round history must be dense and complete.",
  roundShape: "Completed round entry shape is invalid.",
  duplicateRound: "A round result is duplicated.",
  unknownRound: "Round result references an unknown roundId.",
  roundOrder: "Round results must follow Event Definition order.",
  invalidRoundResult: "Round result is not canonical.",
  authority: "Caller-authored result plans are not accepted.",
  invalidReward: "Reward descriptor shape or fields are invalid.",
  duplicateReward: "Reward identity is duplicated.",
  invalidEnhancement: "Enhancement descriptor is invalid.",
  duplicateEnhancement: "Reward-enhancement identity is duplicated.",
  unresolvedRewardEnhancement: "Reward enhancement identity does not resolve exactly once.",
  unresolvedCompatibleReward: "Reward compatibility identity does not resolve exactly once.",
  invalidCompatibleKind: "Reward compatibility kind is not one of the four authored reward kinds.",
  emptyCompatibility: "Both reward compatibility arrays are empty, authoring an unrestricted enhancement.",
  invalidVoidFortune: "Void Fortune descriptor or authored-only rule is invalid.",
  duplicateVoidFortune: "Void Fortune identity is duplicated across rewards.",
  invalidFieldRepair: "Field Repair Resource descriptor is invalid.",
  duplicateFieldRepair: "Field Repair Resource identity is duplicated across rewards.",
  noRewards: "Reward Step analysis has no valid authored reward definition.",
  onFailure: "Reward analysis was requested for a failed Event.",
  insufficient: "The authored reward and enhancement catalog cannot form any legal allocation consuming the calculated Reward Steps."
});

function issue(code, path, message) { return { code, path, message, severity: "error" }; }
function dedupe(errors) {
  const seen = new Set();
  return errors.filter((entry) => { const key = JSON.stringify(entry); if (seen.has(key)) return false; seen.add(key); return true; });
}
function hostile(errors) { errors.push(issue("m8-hostile-data-capture-failed", "$", MESSAGES.hostile)); }
function isPlain(value) {
  if (value === null || typeof value !== "object") return false;
  let proto;
  try { proto = Object.getPrototypeOf(value); } catch { return false; }
  return proto === Object.prototype || proto === null;
}
function exactKeys(value, expected) {
  if (!isPlain(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}
function nonblank(value) { return typeof value === "string" && value.length > 0 && value.trim() === value; }
function dense(value) {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) if (!Object.hasOwn(value, index)) return false;
  return true;
}
function uniqueStrings(value) {
  if (!dense(value)) return false;
  const seen = new Set();
  return value.every((entry) => nonblank(entry) && !seen.has(entry) && (seen.add(entry), true));
}

function captureValue(value, errors, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") { if (Number.isFinite(value)) return value; hostile(errors); return null; }
  if (typeof value !== "object") { hostile(errors); return null; }
  if (ancestors.has(value)) { hostile(errors); return null; }
  let array;
  let prototype;
  let keys;
  try {
    array = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch { hostile(errors); return null; }
  if (array ? prototype !== Array.prototype : (prototype !== Object.prototype && prototype !== null)) { hostile(errors); return null; }
  const next = new Set(ancestors); next.add(value);
  if (array) {
    let lengthDescriptor;
    try { lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length"); } catch { hostile(errors); return null; }
    const length = lengthDescriptor?.value;
    if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) { hostile(errors); return null; }
    const output = new Array(length);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) { hostile(errors); return null; }
    }
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
  const result = captureValue(value, errors);
  return errors.length ? { ok: false, value: null, errors: dedupe(errors), warnings: [] } : { ok: true, value: result, errors: [], warnings: [] };
}
function captureWithShape(value, fields, path, code, message) {
  const captured = captureRoot(value);
  if (!captured.ok) return captured;
  if (!exactKeys(captured.value, fields)) return { ok: false, value: null, errors: [issue(code, path, message)], warnings: [] };
  return captured;
}

function invalidEnvelope(errors) {
  return { ok: false, readyForRewardSteps: false, eventId: null, sessionId: null, definitionSnapshotId: null, roundCount: null, winningThreshold: null, overallResult: null, rewardPoints: null, rewardSteps: null, rewardDefinitions: [], errors: dedupe(errors), warnings: [] };
}

function validateStringFields(value, fields, path, errors) {
  for (const field of fields) if (!nonblank(value[field])) errors.push(issue("m8-invalid-reward-definition", path, MESSAGES.invalidReward));
}
function validateTags(value, path, errors, code = "m8-invalid-reward-definition", message = MESSAGES.invalidReward, nonempty = false) {
  if (!uniqueStrings(value) || (nonempty && value.length === 0)) errors.push(issue(code, path, message));
}
function validateVoidFortune(value, path, errors) {
  if (!exactKeys(value, VOID_FORTUNE_FIELDS) || !nonblank(value.voidFortuneId) || !nonblank(value.title) || !nonblank(value.description) || !uniqueStrings(value.tags)) {
    errors.push(issue("m8-invalid-void-fortune", path, MESSAGES.invalidVoidFortune));
  }
}
function validateFieldRepair(value, path, errors) {
  if (!exactKeys(value, FIELD_REPAIR_FIELDS) || !nonblank(value.fieldRepairResourceId) || !nonblank(value.title) || !nonblank(value.description) || !uniqueStrings(value.compatibleScarTags) || value.compatibleScarTags.length === 0 || !nonblank(value.timing) || typeof value.safeRestRequired !== "boolean") {
    errors.push(issue("m8-invalid-field-repair-resource", path, MESSAGES.invalidFieldRepair));
  }
}
function validateRewardShape(reward, path, errors) {
  if (!exactKeys(reward, REWARD_FIELDS)) { errors.push(issue("m8-invalid-reward-definition", path, MESSAGES.invalidReward)); return; }
  validateStringFields(reward, ["rewardId", "title", "description"], path, errors);
  if (!KINDS.has(reward.kind) || !uniqueStrings(reward.tags) || !uniqueStrings(reward.enhancementIds)) errors.push(issue("m8-invalid-reward-definition", path, MESSAGES.invalidReward));
  if (reward.kind === "void-fortune") {
    if (reward.voidFortune === null) errors.push(issue("m8-invalid-void-fortune", `${path}.voidFortune`, MESSAGES.invalidVoidFortune));
    else validateVoidFortune(reward.voidFortune, `${path}.voidFortune`, errors);
    if (reward.fieldRepairResource !== null) errors.push(issue("m8-invalid-field-repair-resource", `${path}.fieldRepairResource`, MESSAGES.invalidFieldRepair));
  } else if (reward.kind === "field-repair-resource") {
    if (reward.fieldRepairResource === null) errors.push(issue("m8-invalid-field-repair-resource", `${path}.fieldRepairResource`, MESSAGES.invalidFieldRepair));
    else validateFieldRepair(reward.fieldRepairResource, `${path}.fieldRepairResource`, errors);
    if (reward.voidFortune !== null) errors.push(issue("m8-invalid-void-fortune", `${path}.voidFortune`, MESSAGES.invalidVoidFortune));
  } else {
    if (reward.voidFortune !== null) errors.push(issue("m8-invalid-void-fortune", `${path}.voidFortune`, MESSAGES.invalidVoidFortune));
    if (reward.fieldRepairResource !== null) errors.push(issue("m8-invalid-field-repair-resource", `${path}.fieldRepairResource`, MESSAGES.invalidFieldRepair));
  }
}
function validateEnhancementShape(enhancement, path, errors) {
  if (!exactKeys(enhancement, ENHANCEMENT_FIELDS) || !nonblank(enhancement.enhancementId) || !nonblank(enhancement.title) || !nonblank(enhancement.description) || !uniqueStrings(enhancement.compatibleRewardIds) || !dense(enhancement.compatibleRewardKinds) || new Set(enhancement.compatibleRewardKinds).size !== enhancement.compatibleRewardKinds.length || enhancement.maxApplicationsPerReward !== 1) {
    errors.push(issue("m8-invalid-reward-enhancement", path, MESSAGES.invalidEnhancement));
    return;
  }
  enhancement.compatibleRewardKinds.forEach((kind, index) => {
    if (!KINDS.has(kind)) errors.push(issue("m8-invalid-compatible-reward-kind", `${path}.compatibleRewardKinds[${index}]`, MESSAGES.invalidCompatibleKind));
  });
  if (enhancement.compatibleRewardIds.length === 0 && enhancement.compatibleRewardKinds.length === 0) errors.push(issue("m8-invalid-empty-reward-enhancement-compatibility", path, MESSAGES.emptyCompatibility));
}

function validateCatalog(rewards, enhancements, basePath = "eventDefinition") {
  const errors = [];
  const rewardPath = `${basePath}.rewards`;
  const enhancementPath = `${basePath}.enhancements`;
  if (!dense(rewards) || !dense(enhancements)) return [issue("m8-invalid-event-definition", basePath, MESSAGES.catalogsDense)];
  rewards.forEach((reward, index) => validateRewardShape(reward, `${rewardPath}[${index}]`, errors));
  enhancements.forEach((enhancement, index) => validateEnhancementShape(enhancement, `${enhancementPath}[${index}]`, errors));
  const rewardIds = new Map();
  rewards.forEach((reward, index) => { if (nonblank(reward?.rewardId)) { const list = rewardIds.get(reward.rewardId) ?? []; list.push(index); rewardIds.set(reward.rewardId, list); } });
  rewardIds.forEach((indexes) => { if (indexes.length > 1) indexes.slice(1).forEach((index) => errors.push(issue("m8-duplicate-reward-identity", `${rewardPath}[${index}].rewardId`, MESSAGES.duplicateReward))); });
  const enhancementIds = new Map();
  enhancements.forEach((enhancement, index) => { if (nonblank(enhancement?.enhancementId)) { const list = enhancementIds.get(enhancement.enhancementId) ?? []; list.push(index); enhancementIds.set(enhancement.enhancementId, list); } });
  enhancementIds.forEach((indexes) => { if (indexes.length > 1) indexes.slice(1).forEach((index) => errors.push(issue("m8-duplicate-enhancement-identity", `${enhancementPath}[${index}].enhancementId`, MESSAGES.duplicateEnhancement))); });
  const fortunes = new Map(); const repairs = new Map();
  rewards.forEach((reward, index) => {
    if (reward?.voidFortune && nonblank(reward.voidFortune.voidFortuneId)) { const list = fortunes.get(reward.voidFortune.voidFortuneId) ?? []; list.push(index); fortunes.set(reward.voidFortune.voidFortuneId, list); }
    if (reward?.fieldRepairResource && nonblank(reward.fieldRepairResource.fieldRepairResourceId)) { const list = repairs.get(reward.fieldRepairResource.fieldRepairResourceId) ?? []; list.push(index); repairs.set(reward.fieldRepairResource.fieldRepairResourceId, list); }
  });
  fortunes.forEach((indexes) => { if (indexes.length > 1) indexes.slice(1).forEach((index) => errors.push(issue("m8-duplicate-void-fortune-identity", `${rewardPath}[${index}].voidFortune.voidFortuneId`, MESSAGES.duplicateVoidFortune))); });
  repairs.forEach((indexes) => { if (indexes.length > 1) indexes.slice(1).forEach((index) => errors.push(issue("m8-duplicate-field-repair-resource-identity", `${rewardPath}[${index}].fieldRepairResource.fieldRepairResourceId`, MESSAGES.duplicateFieldRepair))); });
  if (errors.length) return dedupe(errors);
  rewards.forEach((reward, rewardIndex) => reward.enhancementIds.forEach((id, refIndex) => {
    if ((enhancementIds.get(id) ?? []).length !== 1) errors.push(issue("m8-unresolved-reward-enhancement-reference", `${rewardPath}[${rewardIndex}].enhancementIds[${refIndex}]`, MESSAGES.unresolvedRewardEnhancement));
  }));
  enhancements.forEach((enhancement, enhancementIndex) => enhancement.compatibleRewardIds.forEach((id, refIndex) => {
    if ((rewardIds.get(id) ?? []).length !== 1) errors.push(issue("m8-unresolved-compatible-reward-reference", `${enhancementPath}[${enhancementIndex}].compatibleRewardIds[${refIndex}]`, MESSAGES.unresolvedCompatibleReward));
  }));
  return dedupe(errors);
}

function validateEventDefinition(definition) {
  const errors = [];
  if (!exactKeys(definition, EVENT_FIELDS)) return [issue("m8-invalid-event-definition", "eventDefinition", MESSAGES.eventShape)];
  if (definition.schemaVersion !== 1 || !nonblank(definition.eventId) || !nonblank(definition.definitionSnapshotId)) errors.push(issue("m8-invalid-event-definition", "eventDefinition", MESSAGES.eventIdentity));
  if (!Number.isSafeInteger(definition.roundCount) || !ROUND_COUNTS.has(definition.roundCount)) errors.push(issue("m8-invalid-round-count", "eventDefinition.roundCount", MESSAGES.invalidRoundCount));
  if (!dense(definition.rounds)) errors.push(issue("m8-invalid-event-definition", "eventDefinition", MESSAGES.roundsDense));
  else {
    if (Number.isSafeInteger(definition.roundCount) && definition.rounds.length !== definition.roundCount) errors.push(issue("m8-invalid-event-definition", "eventDefinition", MESSAGES.roundsCount));
    const ids = new Set();
    definition.rounds.forEach((round, index) => { if (!exactKeys(round, ["roundId", "roundNumber"]) || !nonblank(round.roundId) || !Number.isSafeInteger(round.roundNumber) || round.roundNumber !== index + 1 || ids.has(round.roundId)) errors.push(issue("m8-invalid-event-definition", "eventDefinition", MESSAGES.roundsOrder)); ids.add(round?.roundId); });
  }
  for (const key of ["rewards", "enhancements", "misfortuneEnhancements", "misfortunes"]) if (!dense(definition[key])) errors.push(issue("m8-invalid-event-definition", "eventDefinition", MESSAGES.catalogsDense));
  if (!dense(definition.nextSituations) || definition.nextSituations.length > 1) errors.push(issue("m8-invalid-next-situation", "eventDefinition.nextSituations", MESSAGES.nextCardinality));
  else if (definition.nextSituations.length === 1) { const next = definition.nextSituations[0]; if (!exactKeys(next, NEXT_FIELDS) || !nonblank(next.nextSituationId) || !nonblank(next.title) || !nonblank(next.summary) || !TRANSITIONS.has(next.transitionKind)) errors.push(issue("m8-invalid-next-situation", "eventDefinition.nextSituations", MESSAGES.nextDescriptor)); }
  return dedupe(errors);
}
function validHistory(history, definition) {
  const errors = [];
  if (!exactKeys(history, ["schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "rounds"])) return [issue("m8-incomplete-round-history", "completedRoundHistory.rounds", MESSAGES.historyComplete)];
  if (history.schemaVersion !== 1 || !nonblank(history.eventId) || !nonblank(history.sessionId) || !nonblank(history.definitionSnapshotId)) errors.push(issue("m8-incomplete-round-history", "completedRoundHistory.rounds", MESSAGES.historyIdentity));
  if (history.eventId !== definition.eventId) errors.push(issue("m8-event-identity-mismatch", "completedRoundHistory.eventId", MESSAGES.eventMismatch));
  if (history.definitionSnapshotId !== definition.definitionSnapshotId) errors.push(issue("m8-definition-snapshot-mismatch", "completedRoundHistory.definitionSnapshotId", MESSAGES.snapshotMismatch));
  if (history.roundCount !== definition.roundCount) errors.push(issue("m8-history-round-count-mismatch", "completedRoundHistory.roundCount", MESSAGES.countMismatch));
  if (!dense(history.rounds)) return [...errors, issue("m8-incomplete-round-history", "completedRoundHistory.rounds", MESSAGES.historyDense)];
  if (history.rounds.length !== definition.rounds.length) errors.push(issue("m8-incomplete-round-history", "completedRoundHistory.rounds", MESSAGES.historyComplete));
  const seen = new Set();
  history.rounds.forEach((round, index) => {
    const path = `completedRoundHistory.rounds[${index}]`;
    if (!exactKeys(round, ROUND_FIELDS)) { errors.push(issue("m8-incomplete-round-history", path, MESSAGES.roundShape)); return; }
    const validIdentity = nonblank(round.roundId) && Number.isSafeInteger(round.roundNumber);
    if (!validIdentity) errors.push(issue("m8-round-order-invalid", path, MESSAGES.roundOrder));
    if (seen.has(round.roundId)) errors.push(issue("m8-duplicate-round-result", `${path}.roundId`, MESSAGES.duplicateRound));
    seen.add(round.roundId);
    const expected = definition.rounds[index];
    if (validIdentity && !definition.rounds.some((entry) => entry.roundId === round.roundId)) errors.push(issue("m8-unknown-round-id", `${path}.roundId`, MESSAGES.unknownRound));
    if (validIdentity && expected && (round.roundId !== expected.roundId || round.roundNumber !== expected.roundNumber)) errors.push(issue("m8-round-order-invalid", path, MESSAGES.roundOrder));
    if (!ROUND_RESULTS.has(round.roundResult)) errors.push(issue("m8-invalid-round-result", `${path}.roundResult`, MESSAGES.invalidRoundResult));
  });
  return dedupe(errors);
}

function catalogSufficient(rewards, enhancements, steps) {
  const enhancementById = new Map(enhancements.map((entry) => [entry.enhancementId, entry]));
  const rewardById = new Map(rewards.map((entry) => [entry.rewardId, entry]));
  function compatible(reward, enhancement) {
    if (!reward.enhancementIds.includes(enhancement.enhancementId)) return false;
    if (enhancement.compatibleRewardIds.length && !enhancement.compatibleRewardIds.includes(reward.rewardId)) return false;
    if (enhancement.compatibleRewardKinds.length && !enhancement.compatibleRewardKinds.includes(reward.kind)) return false;
    return true;
  }
  function walk(depth, added, used) {
    if (depth === steps) return true;
    for (const reward of rewards) if (!added.has(reward.rewardId)) {
      const next = new Map(added); next.set(reward.rewardId, []);
      if (walk(depth + 1, next, used)) return true;
    }
    for (const [rewardId, selected] of added) {
      if (selected.length >= 2) continue;
      const reward = rewardById.get(rewardId);
      for (const enhancementId of reward.enhancementIds) {
        if (selected.includes(enhancementId) || used.has(`${rewardId}\u0000${enhancementId}`)) continue;
        const enhancement = enhancementById.get(enhancementId);
        if (!enhancement || !compatible(reward, enhancement)) continue;
        const nextAdded = new Map(added); nextAdded.set(rewardId, [...selected, enhancementId]);
        const nextUsed = new Set(used); nextUsed.add(`${rewardId}\u0000${enhancementId}`);
        if (walk(depth + 1, nextAdded, nextUsed)) return true;
      }
    }
    return false;
  }
  return steps > 0 && walk(0, new Map(), new Set());
}

export function captureVoyageEncounterRewardDefinition(rewardDefinition) {
  const captured = captureWithShape(rewardDefinition, REWARD_FIELDS, "rewardDefinition", "m8-invalid-reward-definition", MESSAGES.invalidReward);
  if (!captured.ok) return captured;
  const errors = [];
  if (captured.value.voidFortune !== null && !exactKeys(captured.value.voidFortune, VOID_FORTUNE_FIELDS)) errors.push(issue("m8-invalid-void-fortune", "rewardDefinition.voidFortune", MESSAGES.invalidVoidFortune));
  if (captured.value.fieldRepairResource !== null && !exactKeys(captured.value.fieldRepairResource, FIELD_REPAIR_FIELDS)) errors.push(issue("m8-invalid-field-repair-resource", "rewardDefinition.fieldRepairResource", MESSAGES.invalidFieldRepair));
  return errors.length ? { ok: false, value: null, errors, warnings: [] } : { ok: true, value: captured.value, errors: [], warnings: [] };
}

export function validateVoyageEncounterRewardDefinition(rewardDefinition, enhancementDefinitions) {
  const rewardCapture = captureVoyageEncounterRewardDefinition(rewardDefinition);
  const enhancementCapture = captureRoot(enhancementDefinitions);
  if (!rewardCapture.ok || !enhancementCapture.ok) return { valid: false, errors: dedupe([...(rewardCapture.ok ? [] : rewardCapture.errors), ...(enhancementCapture.ok ? [] : enhancementCapture.errors)]), warnings: [] };
  const errors = [];
  if (!dense(enhancementCapture.value)) errors.push(issue("m8-invalid-reward-enhancement", "enhancementDefinitions", MESSAGES.invalidEnhancement));
  else {
    validateRewardShape(rewardCapture.value, "rewardDefinition", errors);
    enhancementCapture.value.forEach((entry, index) => validateEnhancementShape(entry, `enhancementDefinitions[${index}]`, errors));
    const ids = new Map(); enhancementCapture.value.forEach((entry, index) => { const list = ids.get(entry.enhancementId) ?? []; list.push(index); ids.set(entry.enhancementId, list); });
    ids.forEach((indexes) => { if (indexes.length > 1) indexes.slice(1).forEach((index) => errors.push(issue("m8-duplicate-enhancement-identity", `enhancementDefinitions[${index}].enhancementId`, MESSAGES.duplicateEnhancement))); });
    if (!errors.length) rewardCapture.value.enhancementIds.forEach((id, index) => { if ((ids.get(id) ?? []).length !== 1) errors.push(issue("m8-unresolved-reward-enhancement-reference", `rewardDefinition.enhancementIds[${index}]`, MESSAGES.unresolvedRewardEnhancement)); });
  }
  return { valid: errors.length === 0, errors: dedupe(errors), warnings: [] };
}

export function analyzeVoyageEncounterRewardSteps(request) {
  const requestCapture = captureRoot(request);
  if (!requestCapture.ok) return invalidEnvelope(requestCapture.errors);
  const value = requestCapture.value;
  const authorityErrors = AUTHORITY_KEYS.filter((key) => Object.hasOwn(value, key)).map((key) => issue("m8-caller-authored-plan-rejected", `request.${key}`, MESSAGES.authority));
  if (authorityErrors.length) return invalidEnvelope(authorityErrors);
  if (value.kind !== "m8-reward-steps") return invalidEnvelope([issue("m8-invalid-mode", "request.kind", MESSAGES.mode)]);
  if (!exactKeys(value, REQUEST_FIELDS)) return invalidEnvelope([issue("m8-invalid-request-shape", "request", MESSAGES.requestShape)]);
  if (!nonblank(value.sessionId) || !isPlain(value.eventDefinition) || !isPlain(value.completedRoundHistory)) return invalidEnvelope([issue("m8-invalid-request-shape", "request", MESSAGES.requestValues)]);
  const definitionErrors = validateEventDefinition(value.eventDefinition);
  if (definitionErrors.length) return invalidEnvelope(definitionErrors);
  const catalogErrors = validateCatalog(value.eventDefinition.rewards, value.eventDefinition.enhancements);
  if (catalogErrors.length) return invalidEnvelope(catalogErrors);
  const overall = analyzeVoyageEncounterOverallResult({ kind: "m8-overall-result", sessionId: value.sessionId, eventDefinition: value.eventDefinition, completedRoundHistory: value.completedRoundHistory });
  if (!overall.ok) return invalidEnvelope(overall.errors);
  if (overall.overallResult !== "overall-success") return invalidEnvelope([issue("m8-reward-analysis-on-failure", "overallResult", MESSAGES.onFailure)]);
  if (value.eventDefinition.rewards.length === 0) return invalidEnvelope([issue("m8-no-authored-rewards", "eventDefinition.rewards", MESSAGES.noRewards)]);
  const rewardPoints = value.completedRoundHistory.rounds.reduce((total, round) => total + (round.roundResult === "critical-round-success" ? 2 : round.roundResult === "round-success" ? 1 : 0), 0);
  const rewardSteps = Math.min(3, 1 + Math.floor((rewardPoints - overall.winningThreshold) / 2));
  if (!catalogSufficient(value.eventDefinition.rewards, value.eventDefinition.enhancements, rewardSteps)) return invalidEnvelope([issue("m8-insufficient-authored-reward-options", "eventDefinition.rewards", MESSAGES.insufficient)]);
  return { ok: true, readyForRewardSteps: true, eventId: overall.eventId, sessionId: overall.sessionId, definitionSnapshotId: overall.definitionSnapshotId, roundCount: overall.roundCount, winningThreshold: overall.winningThreshold, overallResult: overall.overallResult, rewardPoints, rewardSteps, rewardDefinitions: value.eventDefinition.rewards.map((entry) => captureRoot(entry).value), errors: [], warnings: [] };
}
