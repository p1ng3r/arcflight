import { analyzeVoyageEncounterOverallResult } from "./event-result.js";

const MISFORTUNE_FIELDS = ["misfortuneId", "kind", "title", "description", "tags", "persistence", "enhancementIds", "scarConsequenceProposal"];
const ENHANCEMENT_FIELDS = ["misfortuneEnhancementId", "title", "description", "compatibleMisfortuneIds", "maxApplicationsPerMisfortune"];
const PROPOSAL_FIELDS = ["voidScarDefinitionId", "pressureSystemId", "source"];
const NEXT_FIELDS = ["nextSituationId", "title", "summary", "transitionKind"];
const EVENT_FIELDS = ["schemaVersion", "eventId", "definitionSnapshotId", "roundCount", "rounds", "rewards", "enhancements", "misfortuneEnhancements", "misfortunes", "nextSituations"];
const REQUEST_FIELDS = ["kind", "sessionId", "eventDefinition", "completedRoundHistory", "negativeSelection"];
const SELECTION_FIELDS = ["misfortuneId", "enhancementIds"];
const HISTORY_FIELDS = ["schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "rounds"];
const AUTHORITY_KEYS = ["overallResult", "rewardAnalysis", "negativeAnalysis", "rewardSteps", "negativeSteps", "resultPackage", "allocationPlan", "nextState"];
const KINDS = new Set(["travel-delay", "resource-cost", "operational-restriction", "crew-consequence", "damaged-room", "authored"]);
const PERSISTENCE = new Set(["temporary", "persistent"]);
const TRANSITIONS = new Set(["retreat", "diversion", "emergency", "capture", "delay", "repair", "authored"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const EVENT_FIELDS_WITH_BREACH_DC = [...EVENT_FIELDS, "breachDC"];
function validEventDefinitionShape(value) { return exact(value, EVENT_FIELDS) || (exact(value, EVENT_FIELDS_WITH_BREACH_DC) && typeof value.breachDC === "number" && Number.isFinite(value.breachDC) && value.breachDC > 0); }
const M = Object.freeze({
  hostile: "Input contains inaccessible or unsafe data.",
  requestShape: "Request has an invalid exact shape.",
  requestValues: "Request has invalid field values.",
  mode: "Only m8-negative-steps analysis is supported.",
  eventShape: "Event Definition has an invalid exact shape.",
  eventIdentity: "Event Definition identity or schema is invalid.",
  roundsDense: "Event Definition rounds must be dense.",
  roundsCount: "Event Definition rounds must match roundCount.",
  roundsOrder: "Event Definition rounds must be unique and densely ordered.",
  catalogsDense: "Authored catalogs must be dense arrays.",
  nextCardinality: "A next-situation descriptor is malformed or more than one was authored.",
  nextDescriptor: "A next-situation descriptor is malformed or more than one was authored.",
  invalidMisfortune: "Misfortune descriptor is invalid.",
  invalidEnhancement: "Misfortune-enhancement descriptor is invalid.",
  duplicateMisfortune: "Misfortune identity is duplicated.",
  duplicateEnhancement: "Misfortune-enhancement identity is duplicated.",
  unresolvedEnhancement: "Misfortune enhancement identity does not resolve exactly once.",
  unresolvedCompatible: "Misfortune compatibility identity does not resolve exactly once.",
  duplicateProposal: "The authored Scar-consequence proposal tuple duplicates an earlier authored Misfortune proposal.",
  noMisfortunes: "Negative Step analysis has no valid authored Misfortune definition.",
  insufficient: "The authored Misfortune catalog cannot form any legal package consuming the calculated Negative Steps.",
  onSuccess: "Negative analysis was requested for a successful Event.",
  authority: "Caller-authored result plans are not accepted.",
  invalidSelection: "Negative selection shape or identity is invalid.",
  countMismatch: "The selected enhancement count does not equal negativeSteps - 1.",
  duplicateSelection: "The same Misfortune enhancement was selected twice.",
  incompatible: "Selected enhancement is incompatible with the selected Misfortune.",
  missingNext: "Failure has no required authored next situation.",
  scarNormal: "The selected Misfortune supplies a Scar-consequence proposal for a one-step normal Overall Event Failure."
});

function issue(code, path, message) { return { code, path, message, severity: "error" }; }
function dedupe(errors) { const seen = new Set(); return errors.filter((entry) => { const key = JSON.stringify(entry); if (seen.has(key)) return false; seen.add(key); return true; }); }
function nonblank(value) { return typeof value === "string" && value.length > 0 && value.trim() === value; }
function plain(value) { if (value === null || typeof value !== "object") return false; try { const p = Object.getPrototypeOf(value); return p === Object.prototype || p === null; } catch { return false; } }
function exact(value, keys) { if (!plain(value)) return false; const own = Object.keys(value); return own.length === keys.length && own.every((key, index) => key === keys[index]); }
function dense(value) { if (!Array.isArray(value)) return false; for (let i = 0; i < value.length; i += 1) if (!Object.hasOwn(value, i)) return false; return true; }
function uniqueStrings(value) { if (!dense(value)) return false; const seen = new Set(); for (const entry of value) { if (!nonblank(entry) || seen.has(entry)) return false; seen.add(entry); } return true; }
function hostile(errors) { errors.push(issue("m8-hostile-data-capture-failed", "$", M.hostile)); }
function captureValue(value, errors, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") { if (Number.isFinite(value)) return value; hostile(errors); return null; }
  if (typeof value !== "object" || ancestors.has(value)) { hostile(errors); return null; }
  let isArray; let proto; let keys;
  try { isArray = Array.isArray(value); proto = Object.getPrototypeOf(value); keys = Reflect.ownKeys(value); } catch { hostile(errors); return null; }
  if (isArray ? proto !== Array.prototype : (proto !== Object.prototype && proto !== null)) { hostile(errors); return null; }
  const next = new Set(ancestors); next.add(value);
  if (isArray) {
    let descriptor; try { descriptor = Object.getOwnPropertyDescriptor(value, "length"); } catch { hostile(errors); return null; }
    const length = descriptor?.value;
    if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) { hostile(errors); return null; }
    const output = new Array(length);
    for (const key of keys) if (key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) { hostile(errors); return null; }
    for (let i = 0; i < length; i += 1) { let d; try { d = Object.getOwnPropertyDescriptor(value, String(i)); } catch { hostile(errors); return null; } if (!d || d.enumerable !== true || !Object.hasOwn(d, "value")) { hostile(errors); return null; } output[i] = captureValue(d.value, errors, next); }
    return output;
  }
  const output = {};
  for (const key of keys) { if (typeof key !== "string" || UNSAFE_KEYS.has(key)) { hostile(errors); return null; } let d; try { d = Object.getOwnPropertyDescriptor(value, key); } catch { hostile(errors); return null; } if (!d || d.enumerable !== true || !Object.hasOwn(d, "value")) { hostile(errors); return null; } output[key] = captureValue(d.value, errors, next); }
  return output;
}
function captureRoot(value) { const errors = []; const result = captureValue(value, errors); return errors.length ? { ok: false, value: null, errors: dedupe(errors), warnings: [] } : { ok: true, value: result, errors: [], warnings: [] }; }
function invalidEnvelope(errors) { return { ok: false, readyForNegativeSteps: false, eventId: null, sessionId: null, definitionSnapshotId: null, roundCount: null, winningThreshold: null, overallResult: null, failurePoints: null, negativeSteps: null, overallFailureDegree: null, negativePackage: null, errors: dedupe(errors), warnings: [] }; }

function validateProposal(value, path, errors) {
  if (value === null) return;
  if (!exact(value, PROPOSAL_FIELDS) || !nonblank(value.voidScarDefinitionId) || !nonblank(value.pressureSystemId) || value.source !== "m8-critical-overall-failure") errors.push(issue("m8-invalid-misfortune-definition", path, M.invalidMisfortune));
}
function validateMisfortuneShape(value, path, errors) {
  if (!exact(value, MISFORTUNE_FIELDS)) { errors.push(issue("m8-invalid-misfortune-definition", path, M.invalidMisfortune)); return; }
  if (!nonblank(value.misfortuneId) || !KINDS.has(value.kind) || !nonblank(value.title) || !nonblank(value.description) || !uniqueStrings(value.tags) || !PERSISTENCE.has(value.persistence) || !uniqueStrings(value.enhancementIds)) errors.push(issue("m8-invalid-misfortune-definition", path, M.invalidMisfortune));
  validateProposal(value.scarConsequenceProposal, `${path}.scarConsequenceProposal`, errors);
}
function validateEnhancementShape(value, path, errors) {
  if (!exact(value, ENHANCEMENT_FIELDS) || !nonblank(value.misfortuneEnhancementId) || !nonblank(value.title) || !nonblank(value.description) || !uniqueStrings(value.compatibleMisfortuneIds) || value.maxApplicationsPerMisfortune !== 1) errors.push(issue("m8-invalid-misfortune-enhancement", path, M.invalidEnhancement));
}
function validateMisfortuneCatalog(misfortunes, enhancements) {
  const errors = []; const misPath = "eventDefinition.misfortunes"; const enhPath = "eventDefinition.misfortuneEnhancements";
  if (!dense(misfortunes) || !dense(enhancements)) return [issue("m8-invalid-event-definition", "eventDefinition", M.catalogsDense)];
  misfortunes.forEach((entry, i) => validateMisfortuneShape(entry, `${misPath}[${i}]`, errors));
  enhancements.forEach((entry, i) => validateEnhancementShape(entry, `${enhPath}[${i}]`, errors));
  const misIds = new Map(); misfortunes.forEach((entry, i) => { if (nonblank(entry?.misfortuneId)) misIds.set(entry.misfortuneId, [...(misIds.get(entry.misfortuneId) ?? []), i]); });
  misIds.forEach((indexes) => { if (indexes.length > 1) indexes.slice(1).forEach((i) => errors.push(issue("m8-duplicate-misfortune-identity", `${misPath}[${i}].misfortuneId`, M.duplicateMisfortune))); });
  const enhIds = new Map(); enhancements.forEach((entry, i) => { if (nonblank(entry?.misfortuneEnhancementId)) enhIds.set(entry.misfortuneEnhancementId, [...(enhIds.get(entry.misfortuneEnhancementId) ?? []), i]); });
  enhIds.forEach((indexes) => { if (indexes.length > 1) indexes.slice(1).forEach((i) => errors.push(issue("m8-duplicate-misfortune-enhancement-identity", `${enhPath}[${i}].misfortuneEnhancementId`, M.duplicateEnhancement))); });
  const tuples = new Set();
  misfortunes.forEach((entry, i) => { const proposal = entry?.scarConsequenceProposal; if (proposal && exact(proposal, PROPOSAL_FIELDS) && nonblank(proposal.voidScarDefinitionId) && nonblank(proposal.pressureSystemId) && proposal.source === "m8-critical-overall-failure") { const tuple = JSON.stringify([proposal.voidScarDefinitionId, proposal.pressureSystemId, proposal.source]); if (tuples.has(tuple)) errors.push(issue("m8-duplicate-scar-consequence-proposal", `${misPath}[${i}].scarConsequenceProposal`, M.duplicateProposal)); else tuples.add(tuple); } });
  if (errors.length) return dedupe(errors);
  misfortunes.forEach((entry, i) => entry.enhancementIds.forEach((id, j) => { if ((enhIds.get(id) ?? []).length !== 1) errors.push(issue("m8-unresolved-misfortune-enhancement-reference", `${misPath}[${i}].enhancementIds[${j}]`, M.unresolvedEnhancement)); }));
  enhancements.forEach((entry, i) => entry.compatibleMisfortuneIds.forEach((id, j) => { if ((misIds.get(id) ?? []).length !== 1) errors.push(issue("m8-unresolved-compatible-misfortune-reference", `${enhPath}[${i}].compatibleMisfortuneIds[${j}]`, M.unresolvedCompatible)); }));
  return dedupe(errors);
}
function validateEventDefinition(definition) {
  const errors = [];
  if (!validEventDefinitionShape(definition)) return [issue("m8-invalid-event-definition", "eventDefinition", M.eventShape)];
  if (definition.schemaVersion !== 1 || !nonblank(definition.eventId) || !nonblank(definition.definitionSnapshotId)) errors.push(issue("m8-invalid-event-definition", "eventDefinition", M.eventIdentity));
  if (!dense(definition.rounds)) errors.push(issue("m8-invalid-event-definition", "eventDefinition", M.roundsDense));
  else { if (Number.isSafeInteger(definition.roundCount) && definition.rounds.length !== definition.roundCount) errors.push(issue("m8-invalid-event-definition", "eventDefinition", M.roundsCount)); const ids = new Set(); definition.rounds.forEach((round, i) => { if (!exact(round, ["roundId", "roundNumber"]) || !nonblank(round.roundId) || !Number.isSafeInteger(round.roundNumber) || round.roundNumber !== i + 1 || ids.has(round.roundId)) errors.push(issue("m8-invalid-event-definition", "eventDefinition", M.roundsOrder)); ids.add(round?.roundId); }); }
  for (const key of ["rewards", "enhancements", "misfortuneEnhancements", "misfortunes"]) if (!dense(definition[key])) errors.push(issue("m8-invalid-event-definition", "eventDefinition", M.catalogsDense));
  if (!dense(definition.nextSituations) || definition.nextSituations.length > 1) errors.push(issue("m8-invalid-next-situation", "eventDefinition.nextSituations", M.nextCardinality));
  else if (definition.nextSituations.length === 1) { const next = definition.nextSituations[0]; if (!exact(next, NEXT_FIELDS) || !nonblank(next.nextSituationId) || !nonblank(next.title) || !nonblank(next.summary) || !TRANSITIONS.has(next.transitionKind)) errors.push(issue("m8-invalid-next-situation", "eventDefinition.nextSituations", M.nextDescriptor)); }
  return dedupe(errors);
}
function validateHistoryBindings(history, definition, sessionId) {
  if (!exact(history, HISTORY_FIELDS)) return [];
  const errors = [];
  if (nonblank(history.eventId) && nonblank(definition.eventId) && history.eventId !== definition.eventId) errors.push(issue("m8-event-identity-mismatch", "completedRoundHistory.eventId", "Completed history eventId must match Event Definition."));
  if (nonblank(history.sessionId) && nonblank(sessionId) && history.sessionId !== sessionId) errors.push(issue("m8-session-identity-mismatch", "completedRoundHistory.sessionId", "Request sessionId must match completed history sessionId."));
  if (nonblank(history.definitionSnapshotId) && nonblank(definition.definitionSnapshotId) && history.definitionSnapshotId !== definition.definitionSnapshotId) errors.push(issue("m8-definition-snapshot-mismatch", "completedRoundHistory.definitionSnapshotId", "Completed history definitionSnapshotId must match Event Definition."));
  return errors;
}
function compatible(misfortune, enhancement) { return misfortune.enhancementIds.includes(enhancement.misfortuneEnhancementId) && (enhancement.compatibleMisfortuneIds.length === 0 || enhancement.compatibleMisfortuneIds.includes(misfortune.misfortuneId)); }
function sufficient(misfortunes, enhancements, steps) { const byId = new Map(enhancements.map((entry) => [entry.misfortuneEnhancementId, entry])); return misfortunes.some((misfortune) => { if (steps === 1 && misfortune.scarConsequenceProposal !== null) return false; const legal = misfortune.enhancementIds.map((id) => byId.get(id)).filter((entry) => entry && compatible(misfortune, entry)); return legal.length >= steps - 1; }); }
function selectionErrors(selection, misfortunes, enhancements, steps) {
  const errors = []; if (!exact(selection, SELECTION_FIELDS) || !nonblank(selection.misfortuneId) || !dense(selection.enhancementIds) || !selection.enhancementIds.every(nonblank)) return [issue("m8-invalid-negative-selection", "negativeSelection", M.invalidSelection)];
  const mis = misfortunes.filter((entry) => entry.misfortuneId === selection.misfortuneId); if (mis.length !== 1) errors.push(issue("m8-invalid-negative-selection", "negativeSelection.misfortuneId", M.invalidSelection));
  if (selection.enhancementIds.length !== steps - 1) errors.push(issue("m8-negative-selection-step-mismatch", "negativeSelection.enhancementIds", M.countMismatch));
  const duplicateIds = new Set(); selection.enhancementIds.forEach((id, i) => { if (duplicateIds.has(id)) errors.push(issue("m8-duplicate-negative-selection-enhancement", `negativeSelection.enhancementIds[${i}]`, "The same Misfortune enhancement was selected twice.")); duplicateIds.add(id); });
  const byId = new Map(enhancements.map((entry) => [entry.misfortuneEnhancementId, entry])); const chosen = mis[0];
  if (chosen) selection.enhancementIds.forEach((id, i) => { const enhancement = byId.get(id); if (!enhancement || !chosen.enhancementIds.includes(id)) errors.push(issue("m8-invalid-negative-selection", `negativeSelection.enhancementIds[${i}]`, M.invalidSelection)); else if (!compatible(chosen, enhancement)) errors.push(issue("m8-incompatible-negative-package-enhancement", `negativeSelection.enhancementIds[${i}]`, M.incompatible)); });
  return dedupe(errors);
}

export function captureVoyageEncounterMisfortuneDefinition(misfortuneDefinition) {
  const captured = captureRoot(misfortuneDefinition); if (!captured.ok) return { ok: false, value: null, errors: captured.errors, warnings: [] };
  const errors = []; if (!exact(captured.value, MISFORTUNE_FIELDS)) errors.push(issue("m8-invalid-misfortune-definition", "misfortuneDefinition", M.invalidMisfortune)); else if (captured.value.scarConsequenceProposal !== null && !exact(captured.value.scarConsequenceProposal, PROPOSAL_FIELDS)) errors.push(issue("m8-invalid-misfortune-definition", "misfortuneDefinition.scarConsequenceProposal", M.invalidMisfortune));
  return errors.length ? { ok: false, value: null, errors, warnings: [] } : { ok: true, value: captured.value, errors: [], warnings: [] };
}
export function validateVoyageEncounterMisfortuneDefinition(misfortuneDefinition, misfortuneEnhancementDefinitions) {
  const misCapture = captureVoyageEncounterMisfortuneDefinition(misfortuneDefinition); const enhancementCapture = captureRoot(misfortuneEnhancementDefinitions); if (!misCapture.ok || !enhancementCapture.ok) return { valid: false, errors: dedupe([...(misCapture.ok ? [] : misCapture.errors), ...(enhancementCapture.ok ? [] : enhancementCapture.errors)]), warnings: [] };
  const errors = []; if (!dense(enhancementCapture.value)) errors.push(issue("m8-invalid-misfortune-enhancement", "misfortuneEnhancementDefinitions", M.invalidEnhancement)); else { validateMisfortuneShape(misCapture.value, "misfortuneDefinition", errors); enhancementCapture.value.forEach((entry, i) => validateEnhancementShape(entry, `misfortuneEnhancementDefinitions[${i}]`, errors)); const ids = new Map(); enhancementCapture.value.forEach((entry, i) => { if (plain(entry) && nonblank(entry.misfortuneEnhancementId)) ids.set(entry.misfortuneEnhancementId, [...(ids.get(entry.misfortuneEnhancementId) ?? []), i]); }); ids.forEach((indexes) => { if (indexes.length > 1) indexes.slice(1).forEach((i) => errors.push(issue("m8-duplicate-misfortune-enhancement-identity", `misfortuneEnhancementDefinitions[${i}].misfortuneEnhancementId`, M.duplicateEnhancement))); }); if (!errors.length) misCapture.value.enhancementIds.forEach((id, i) => { if ((ids.get(id) ?? []).length !== 1) errors.push(issue("m8-unresolved-misfortune-enhancement-reference", `misfortuneDefinition.enhancementIds[${i}]`, M.unresolvedEnhancement)); }); }
  return { valid: errors.length === 0, errors: dedupe(errors), warnings: [] };
}
export function analyzeVoyageEncounterNegativeSteps(request) {
  const captured = captureRoot(request); if (!captured.ok) return invalidEnvelope(captured.errors); const value = captured.value; if (!plain(value)) return invalidEnvelope([issue("m8-invalid-request-shape", "request", M.requestShape)]);
  const authority = AUTHORITY_KEYS.filter((key) => Object.hasOwn(value, key)).map((key) => issue("m8-caller-authored-plan-rejected", `request.${key}`, M.authority)); if (authority.length) return invalidEnvelope(authority);
  if (value.kind !== "m8-negative-steps") return invalidEnvelope([issue("m8-invalid-mode", "request.kind", M.mode)]);
  if (!exact(value, REQUEST_FIELDS)) return invalidEnvelope([issue("m8-invalid-request-shape", "request", M.requestShape)]);
  if (!nonblank(value.sessionId) || !plain(value.eventDefinition) || !plain(value.completedRoundHistory)) return invalidEnvelope([issue("m8-invalid-request-shape", "request", M.requestValues)]);
  const definitionErrors = validateEventDefinition(value.eventDefinition); if (definitionErrors.length) return invalidEnvelope(definitionErrors);
  const catalogErrors = validateMisfortuneCatalog(value.eventDefinition.misfortunes, value.eventDefinition.misfortuneEnhancements); if (catalogErrors.length) return invalidEnvelope(catalogErrors);
  const bindingErrors = validateHistoryBindings(value.completedRoundHistory, value.eventDefinition, value.sessionId); if (bindingErrors.length) return invalidEnvelope(bindingErrors);
  const overall = analyzeVoyageEncounterOverallResult({ kind: "m8-overall-result", sessionId: value.sessionId, eventDefinition: value.eventDefinition, completedRoundHistory: value.completedRoundHistory }); if (!overall.ok) return invalidEnvelope(overall.errors);
  if (overall.overallResult !== "overall-failure") return invalidEnvelope([issue("m8-negative-analysis-on-success", "overallResult", M.onSuccess)]);
  if (value.eventDefinition.misfortunes.length === 0) return invalidEnvelope([issue("m8-no-authored-misfortunes", "eventDefinition.misfortunes", M.noMisfortunes)]);
  const failurePoints = value.completedRoundHistory.rounds.reduce((total, round) => total + (round.roundResult === "critical-round-failure" ? 2 : round.roundResult === "round-failure" ? 1 : 0), 0);
  const negativeSteps = Math.min(3, 1 + Math.floor((failurePoints - overall.winningThreshold) / 2)); const overallFailureDegree = negativeSteps === 1 ? "normal" : "critical";
  if (!sufficient(value.eventDefinition.misfortunes, value.eventDefinition.misfortuneEnhancements, negativeSteps)) return invalidEnvelope([issue("m8-insufficient-authored-misfortune-options", "eventDefinition.misfortunes", M.insufficient)]);
  if (value.eventDefinition.nextSituations.length === 0) return invalidEnvelope([issue("m8-missing-next-situation", "eventDefinition.nextSituations", M.missingNext)]);
  const selection = selectionErrors(value.negativeSelection, value.eventDefinition.misfortunes, value.eventDefinition.misfortuneEnhancements, negativeSteps); if (selection.length) return invalidEnvelope(selection);
  const selectedIndex = value.eventDefinition.misfortunes.findIndex((entry) => entry.misfortuneId === value.negativeSelection.misfortuneId); const selected = value.eventDefinition.misfortunes[selectedIndex]; const proposal = selected.scarConsequenceProposal;
  if (negativeSteps === 1 && proposal !== null) return invalidEnvelope([issue("m8-scar-consequence-not-allowed-on-normal-failure", `eventDefinition.misfortunes[${selectedIndex}].scarConsequenceProposal`, M.scarNormal)]);
  const byId = new Map(value.eventDefinition.misfortuneEnhancements.map((entry) => [entry.misfortuneEnhancementId, entry]));
  const negativePackage = { misfortuneId: selected.misfortuneId, enhancementIds: [...value.negativeSelection.enhancementIds], misfortune: { ...selected, tags: [...selected.tags], enhancementIds: [...selected.enhancementIds], scarConsequenceProposal: proposal ? { ...proposal } : null }, enhancements: value.negativeSelection.enhancementIds.map((id) => { const entry = byId.get(id); return { ...entry, compatibleMisfortuneIds: [...entry.compatibleMisfortuneIds] }; }), nextSituation: { ...value.eventDefinition.nextSituations[0] }, scarConsequenceProposals: proposal ? [{ ...proposal }] : [] };
  return { ok: true, readyForNegativeSteps: true, eventId: overall.eventId, sessionId: overall.sessionId, definitionSnapshotId: overall.definitionSnapshotId, roundCount: overall.roundCount, winningThreshold: overall.winningThreshold, overallResult: overall.overallResult, failurePoints, negativeSteps, overallFailureDegree, negativePackage, errors: [], warnings: [] };
}
