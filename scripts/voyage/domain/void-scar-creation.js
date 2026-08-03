import { VOYAGE_PRESSURE_SYSTEM_IDS } from "./constants.js";
import {
  captureVoyageVoidScarPlainData,
  validateVoyageVoidScarRecord,
  VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID
} from "./void-scar-schema.js";
import { captureVoyageShipState, validateVoyageShipState } from "./ship-state.js";

const EVENT_TYPE = "voyage.pressure-breach-applied";
const CREATION_EVENT_TYPE = "voyage.void-scar-created";
const SOURCE_PROPOSAL_FIELDS = Object.freeze([
  "voidScarProposalId", "voidScarId", "pressureBreachId", "hazardId", "encounterId",
  "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId",
  "pressureSystemId", "consequenceKind", "status", "persistence", "sourceKind",
  "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing",
  "visibility", "name"
]);
const REQUEST_FIELDS = Object.freeze([
  "shipId", "expectedShipRevision", "encounterId", "expectedEncounterRevision",
  "sourceEventType", "sourceEncounterRevision", "sourceProposal", "pressureSystemId"
]);
const EVENT_FIELDS = Object.freeze([
  "type", "encounterId", "lifecycleState", "stageId", "roundNumber", "phase",
  "pressureEffectCount", "appliedEffectCount", "breach", "hazard", "collisionOutcome",
  "voidScarProposal", "pressureReset", "effects", "previousPressureSystems",
  "pressureSystems", "previousRevision", "revision"
]);
const BREACH_FIELDS = Object.freeze([
  "pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence",
  "stationId", "actionId", "pressureSystemId", "pressureEffectId", "sourceKind",
  "sourceIntentId", "activationSource", "branch", "timing", "visibility", "previousValue",
  "capacity", "remainingCapacity", "attemptedDelta", "overflowDelta"
]);
const HAZARD_FIELDS = Object.freeze([
  "hazardId", "pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex",
  "sequence", "stationId", "actionId", "pressureSystemId", "category", "status", "sourceKind",
  "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility", "name"
]);
const SYSTEMS = new Set(VOYAGE_PRESSURE_SYSTEM_IDS);
const NAME_BY_SYSTEM = VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID;

// These are declarative Task 2 authored descriptors. They are intentionally
// not executable effects, repair callbacks, or generic consequence data.
const DESCRIPTORS = Object.freeze(Object.fromEntries(VOYAGE_PRESSURE_SYSTEM_IDS.map((id) => [id, Object.freeze({
  description: `${NAME_BY_SYSTEM[id]} represents lasting damage from a Pressure Breach.`,
  operationalEffects: Object.freeze([`${id} operations remain impaired until this Scar is repaired.`]),
  baseRepairCost: 100,
  baseRepairTime: 1,
  repairDcSource: "very-hard",
  eligibleRepairChecks: Object.freeze(["crafting", "engineering-lore"]),
  requiredFacilities: Object.freeze(["drydock"]),
  compatibleFieldRepairTags: Object.freeze([`${id}-field-repair`])
})])));

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function failure(errors = [], warnings = []) {
  return {
    ok: false,
    nextState: null,
    events: [],
    errors: deduplicate(errors),
    warnings: deduplicate(warnings)
  };
}

function deduplicate(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = `${value?.code}|${value?.path}|${value?.message}|${value?.severity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function capture(value, path) {
  return captureVoyageVoidScarPlainData(value, path);
}

function exactKeys(value, fields, path, errors, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(issue(code, path, "Value must be a plain object."));
    return false;
  }
  const keys = Object.keys(value);
  const expected = new Set(fields);
  for (const key of keys) {
    if (!expected.has(key)) errors.push(issue(code, `${path}.${key}`, "Object contains an unexpected field."));
  }
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) errors.push(issue("missing-void-scar-creation-field", `${path}.${field}`, "Object requires this field."));
  }
  if (keys.length === fields.length && keys.some((key, index) => key !== fields[index])) {
    errors.push(issue("invalid-void-scar-creation-key-order", path, "Object fields must use the canonical order."));
  }
  return errors.length === 0;
}

function isString(value) { return typeof value === "string" && value.trim().length > 0; }
function isSafeInteger(value, positive = false) { return Number.isSafeInteger(value) && (positive ? value > 0 : value >= 0); }

function canonicalId(kind, value) {
  return `arcflight-${kind}:${JSON.stringify(["pressure-breach", value])}`;
}

function canonicalProposalFromSource(event, errors) {
  const breach = event.breach;
  const hazard = event.hazard;
  const proposal = event.voidScarProposal;
  exactKeys(breach, BREACH_FIELDS, "$.breach", errors, "invalid-pressure-breach-source");
  exactKeys(hazard, HAZARD_FIELDS, "$.hazard", errors, "invalid-pressure-breach-source");
  exactKeys(proposal, SOURCE_PROPOSAL_FIELDS, "$.voidScarProposal", errors, "invalid-pressure-breach-source");
  if (errors.length > 0) return null;

  if (event.type !== EVENT_TYPE) errors.push(issue("invalid-pressure-breach-source-event-type", "$.type", "Source must be the canonical Pressure Breach event."));
  if (!isString(event.encounterId) || event.encounterId !== breach.encounterId || event.encounterId !== proposal.encounterId || event.encounterId !== hazard.encounterId) errors.push(issue("pressure-breach-source-encounter-mismatch", "$.encounterId", "Source encounter identity is inconsistent."));
  if (!isSafeInteger(event.revision) || !isSafeInteger(event.previousRevision) || event.revision !== event.previousRevision + 1) errors.push(issue("invalid-pressure-breach-source-revision", "$.revision", "Source event revision is not canonical."));
  if (!SYSTEMS.has(breach.pressureSystemId) || breach.pressureSystemId !== hazard.pressureSystemId || breach.pressureSystemId !== proposal.pressureSystemId) errors.push(issue("pressure-breach-source-system-mismatch", "$.breach.pressureSystemId", "Source Pressure system is not canonical."));
  if (hazard.hazardId !== canonicalId("hazard", breach.pressureBreachId) || proposal.hazardId !== hazard.hazardId) errors.push(issue("pressure-breach-source-hazard-mismatch", "$.hazard.hazardId", "Source Hazard identity is not canonical."));
  if (hazard.category !== "system" || hazard.status !== "active" || hazard.sourceKind !== "pressure-breach" || hazard.name !== `${NAME_BY_SYSTEM[breach.pressureSystemId].replace(" Void Scar", "")} Breach`) {
    errors.push(issue("invalid-pressure-breach-source-hazard", "$.hazard", "Source Hazard is not the canonical active Pressure Breach Hazard."));
  }
  if (proposal.voidScarProposalId !== canonicalId("void-scar-proposal", breach.pressureBreachId) || proposal.voidScarId !== canonicalId("void-scar", breach.pressureBreachId)) errors.push(issue("pressure-breach-source-proposal-id-mismatch", "$.voidScarProposal.voidScarProposalId", "Source proposal identity is not canonical."));

  for (const key of ["pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId", "pressureSystemId", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility"]) {
    if (breach[key] !== hazard[key] || breach[key] !== proposal[key]) errors.push(issue("pressure-breach-source-provenance-mismatch", `$.breach.${key}`, "Source provenance does not match across breach, Hazard, and proposal."));
  }
  if (proposal.consequenceKind !== "void-scar" || proposal.status !== "proposed" || proposal.persistence !== "lasting" || proposal.sourceKind !== "pressure-breach" || proposal.name !== NAME_BY_SYSTEM[breach.pressureSystemId]) {
    errors.push(issue("invalid-pressure-breach-source-proposal", "$.voidScarProposal", "Source proposal is not the approved canonical Pressure Breach proposal."));
  }
  return errors.length === 0 ? proposal : null;
}

function readSource(source) {
  const captured = capture(source, "sourceEncounterStateOrEvent");
  if (!captured.ok) return { ok: false, errors: [issue("void-scar-creation-source-read-failed", "sourceEncounterStateOrEvent", "Source data could not be read safely.")] };
  const event = captured.value;
  const errors = [];
  if (!exactKeys(event, EVENT_FIELDS, "$", errors, "invalid-pressure-breach-source")) return { ok: false, errors };
  const proposal = canonicalProposalFromSource(event, errors);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, event, proposal, errors: [] };
}

function readRequest(request) {
  const captured = capture(request, "request");
  if (!captured.ok) return { ok: false, errors: [issue("void-scar-creation-request-read-failed", "request", "Creation request could not be read safely.")] };
  const value = captured.value;
  const errors = [];
  exactKeys(value, REQUEST_FIELDS, "$.request", errors, "invalid-void-scar-creation-request");
  if (!isString(value.shipId)) errors.push(issue("invalid-void-scar-creation-ship-id", "$.request.shipId", "shipId must be a non-blank string."));
  if (!isSafeInteger(value.expectedShipRevision)) errors.push(issue("invalid-void-scar-creation-ship-revision", "$.request.expectedShipRevision", "expectedShipRevision must be a non-negative safe integer."));
  if (!isString(value.encounterId)) errors.push(issue("invalid-void-scar-creation-encounter-id", "$.request.encounterId", "encounterId must be a non-blank string."));
  if (!isSafeInteger(value.expectedEncounterRevision)) errors.push(issue("invalid-void-scar-creation-encounter-revision", "$.request.expectedEncounterRevision", "expectedEncounterRevision must be a non-negative safe integer."));
  if (value.sourceEventType !== EVENT_TYPE) errors.push(issue("invalid-void-scar-creation-source-event-type", "$.request.sourceEventType", "sourceEventType must be voyage.pressure-breach-applied."));
  if (!isSafeInteger(value.sourceEncounterRevision)) errors.push(issue("invalid-void-scar-creation-source-revision", "$.request.sourceEncounterRevision", "sourceEncounterRevision must be a non-negative safe integer."));
  if (!SYSTEMS.has(value.pressureSystemId)) errors.push(issue("invalid-void-scar-creation-pressure-system", "$.request.pressureSystemId", "pressureSystemId must be canonical."));
  exactKeys(value.sourceProposal, SOURCE_PROPOSAL_FIELDS, "$.request.sourceProposal", errors, "invalid-void-scar-creation-proposal");
  return { ok: errors.length === 0, value, errors };
}

function regenerateScar(proposal) {
  const descriptor = DESCRIPTORS[proposal.pressureSystemId];
  const scar = {
    voidScarId: proposal.voidScarId,
    name: NAME_BY_SYSTEM[proposal.pressureSystemId],
    pressureSystemId: proposal.pressureSystemId,
    status: "active",
    sourceKind: "pressure-breach",
    description: descriptor.description,
    operationalEffects: [...descriptor.operationalEffects],
    baseRepairCost: descriptor.baseRepairCost,
    baseRepairTime: descriptor.baseRepairTime,
    repairDcSource: descriptor.repairDcSource,
    eligibleRepairChecks: [...descriptor.eligibleRepairChecks],
    requiredFacilities: [...descriptor.requiredFacilities],
    compatibleFieldRepairTags: [...descriptor.compatibleFieldRepairTags],
    pressureBreachId: proposal.pressureBreachId,
    hazardId: proposal.hazardId,
    encounterId: proposal.encounterId,
    stageId: proposal.stageId,
    roundNumber: proposal.roundNumber,
    effectIndex: proposal.effectIndex,
    sequence: proposal.sequence,
    stationId: proposal.stationId,
    actionId: proposal.actionId,
    pressureEffectId: proposal.pressureEffectId,
    sourceIntentId: proposal.sourceIntentId,
    activationSource: proposal.activationSource,
    branch: proposal.branch,
    timing: proposal.timing,
    visibility: proposal.visibility
  };
  return scar;
}

function analysisResult(values = {}) {
  return {
    readyForVoidScarCreation: Boolean(values.readyForVoidScarCreation),
    shipId: values.shipId ?? null,
    expectedShipRevision: values.expectedShipRevision ?? null,
    sourceEventType: values.sourceEventType ?? null,
    sourceEncounterRevision: values.sourceEncounterRevision ?? null,
    sourceProposal: values.sourceProposal ?? null,
    voidScar: values.voidScar ?? null,
    activeVoidScarCount: values.activeVoidScarCount ?? 0,
    voidScarCapacity: values.voidScarCapacity ?? null,
    availableSlots: values.availableSlots ?? null,
    errors: deduplicate(values.errors ?? []),
    warnings: deduplicate(values.warnings ?? [])
  };
}

export function analyzeVoyagePressureBreachVoidScarCreation(shipState, sourceEncounterStateOrEvent, request) {
  try {
    const shipCapture = captureVoyageShipState(shipState);
    const source = readSource(sourceEncounterStateOrEvent);
    const parsedRequest = readRequest(request);
    if (!shipCapture.ok) return analysisResult({ errors: shipCapture.errors.map((error) => ({ ...error, path: `shipState${error.path === "$" ? "" : error.path.slice(1)}` })) });
    const common = {
      shipId: parsedRequest.value?.shipId ?? shipCapture.state.shipId,
      expectedShipRevision: parsedRequest.value?.expectedShipRevision ?? null,
      sourceEventType: parsedRequest.value?.sourceEventType ?? null,
      sourceEncounterRevision: parsedRequest.value?.sourceEncounterRevision ?? null,
      sourceProposal: null,
      activeVoidScarCount: shipCapture.state.voidScars.length,
      voidScarCapacity: shipCapture.state.hull.voidScarCapacity,
      availableSlots: shipCapture.state.hull.voidScarCapacity - shipCapture.state.voidScars.length
    };
    const errors = [...(source.errors ?? []), ...(parsedRequest.errors ?? [])];
    if (!source.ok || !parsedRequest.ok) return analysisResult({ ...common, errors });
    const ship = shipCapture.state;
    const { event, proposal } = source;
    const req = parsedRequest.value;
    if (req.shipId !== ship.shipId) errors.push(issue("stale-void-scar-creation-ship", "request.shipId", "Request shipId does not match the live ship."));
    if (req.expectedShipRevision !== ship.revision) errors.push(issue("stale-void-scar-creation-ship-revision", "request.expectedShipRevision", "Ship revision is stale."));
    if (req.encounterId !== event.encounterId || req.encounterId !== proposal.encounterId) errors.push(issue("void-scar-creation-encounter-mismatch", "request.encounterId", "Request encounterId does not match the source."));
    if (req.expectedEncounterRevision !== event.revision || req.sourceEncounterRevision !== event.revision) errors.push(issue("stale-void-scar-creation-encounter-revision", "request.expectedEncounterRevision", "Encounter revision is stale or unbound."));
    if (req.sourceEventType !== event.type) errors.push(issue("void-scar-creation-source-event-mismatch", "request.sourceEventType", "Request source event type does not match the source."));
    if (req.pressureSystemId !== proposal.pressureSystemId) errors.push(issue("void-scar-creation-pressure-system-mismatch", "request.pressureSystemId", "Request Pressure system does not match the approved proposal."));
    if (JSON.stringify(req.sourceProposal) !== JSON.stringify(proposal)) errors.push(issue("void-scar-creation-proposal-mismatch", "request.sourceProposal", "Request proposal snapshot does not match the approved source."));
    const scar = regenerateScar(proposal);
    const scarValidation = validateVoyageVoidScarRecord(scar, { expectedEncounterId: req.encounterId, expectedPressureSystemId: req.pressureSystemId, expectedPressureBreachId: proposal.pressureBreachId });
    if (!scarValidation.valid) errors.push(...scarValidation.errors);
    const duplicate = ship.voidScars.some((existing) => existing.voidScarId === scar.voidScarId && existing.pressureBreachId === scar.pressureBreachId && existing.encounterId === scar.encounterId && existing.pressureSystemId === scar.pressureSystemId && existing.effectIndex === scar.effectIndex && existing.sequence === scar.sequence);
    if (duplicate) errors.push(issue("duplicate-void-scar-proposal", "shipState.voidScars", "This approved Pressure Breach proposal has already been applied."));
    if (common.availableSlots < 1) errors.push(issue("void-scar-capacity-exhausted", "shipState.voidScars", "Void Scar capacity is exhausted."));
    if (!isSafeInteger(ship.revision + 1)) errors.push(issue("void-scar-creation-revision-overflow", "shipState.revision", "Ship revision cannot be incremented safely."));
    return analysisResult({ ...common, sourceProposal: errors.length === 0 ? proposal : null, voidScar: errors.length === 0 ? scar : null, readyForVoidScarCreation: errors.length === 0, errors });
  } catch {
    return analysisResult({ errors: [issue("void-scar-creation-failed", "shipState", "Void Scar creation analysis could not be completed safely.")] });
  }
}

export function applyVoyagePressureBreachVoidScarCreation(shipState, sourceEncounterStateOrEvent, request) {
  try {
    const analysis = analyzeVoyagePressureBreachVoidScarCreation(shipState, sourceEncounterStateOrEvent, request);
    if (!analysis.readyForVoidScarCreation) return failure(analysis.errors, analysis.warnings);
    const shipCapture = captureVoyageShipState(shipState);
    if (!shipCapture.ok) return failure(shipCapture.errors);
    const source = readSource(sourceEncounterStateOrEvent);
    const parsedRequest = readRequest(request);
    if (!source.ok || !parsedRequest.ok) return failure([...(source.errors ?? []), ...(parsedRequest.errors ?? [])]);
    const scarForState = regenerateScar(source.proposal);
    const candidate = {
      shipId: shipCapture.state.shipId,
      revision: shipCapture.state.revision + 1,
      installed: { ...shipCapture.state.installed },
      hull: { ...shipCapture.state.hull },
      voidScars: [...shipCapture.state.voidScars, scarForState]
    };
    const candidateValidation = validateVoyageShipState(candidate);
    if (!candidateValidation.valid) return failure(candidateValidation.errors);
    const nextCapture = captureVoyageShipState(candidate);
    if (!nextCapture.ok) return failure(nextCapture.errors);
    const event = {
      type: CREATION_EVENT_TYPE,
      shipId: nextCapture.state.shipId,
      encounterId: source.event.encounterId,
      pressureSystemId: source.proposal.pressureSystemId,
      sourceEventType: source.event.type,
      sourceEncounterRevision: source.event.revision,
      sourceProposal: { ...source.proposal },
      previousShipRevision: shipCapture.state.revision,
      revision: nextCapture.state.revision,
      previousVoidScarCount: shipCapture.state.voidScars.length,
      voidScarCount: nextCapture.state.voidScars.length,
      voidScar: regenerateScar(source.proposal)
    };
    const eventCapture = capture(event, "events[0]");
    if (!eventCapture.ok) return failure([issue("void-scar-creation-event-invalid", "events[0]", "Creation event could not be captured safely.")]);
    return { ok: true, nextState: nextCapture.state, events: [eventCapture.value], errors: [], warnings: analysis.warnings };
  } catch {
    return failure([issue("void-scar-creation-failed", "shipState", "Void Scar creation could not be completed safely.")]);
  }
}

export const VOYAGE_VOID_SCAR_CREATION_EVENT_TYPE = CREATION_EVENT_TYPE;
export const VOYAGE_PRESSURE_BREACH_VOID_SCAR_DESCRIPTORS = DESCRIPTORS;
