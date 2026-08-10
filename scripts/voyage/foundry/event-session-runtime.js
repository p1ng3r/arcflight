import { ARCFLIGHT_MODULE_ID } from "../../config/constants.js";
import { validateVoyageEncounterState } from "../domain/validation.js";
import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../domain/constants.js";
import { validateVoyageHazardRecord } from "../domain/hazard-schema.js";
import { captureVoyageDurableVoidScarRecord } from "../domain/void-scar-schema.js";
import { analyzeVoyagePressureBreachCloseoutTransaction } from "../domain/pressure-breach.js";

const VOYAGE_SESSION_PATH = `flags.${ARCFLIGHT_MODULE_ID}.system.voyageSession`;
const CREATE_FIELDS = Object.freeze([
  "kind",
  "requestId",
  "sessionId",
  "eventId",
  "definitionSnapshotId",
  "shipId",
  "eventDefinition",
  "initialEncounterState"
]);
const SESSION_FIELDS = Object.freeze([
  "schemaVersion",
  "sessionDocumentId",
  "sessionId",
  "eventId",
  "definitionSnapshotId",
  "shipId",
  "revision",
  "sessionState",
  "activeGmUserId",
  "authorityEpoch",
  "encounterState",
  "events",
  "checkpoints",
  "processedRequests",
  "closeout",
  "recovery",
  "auditHistory"
]);
const ENCOUNTER_FIELDS = Object.freeze([
  "schemaVersion",
  "encounterId",
  "definitionId",
  "definitionRef",
  "title",
  "description",
  "lifecycleState",
  "revision",
  "momentum",
  "currentStage",
  "roundNumber",
  "phase",
  "primaryShip",
  "currentSituation",
  "objective",
  "participants",
  "availableStations",
  "stationAssignments",
  "playerVisibleInformation",
  "gmSecretInformation",
  "successConditions",
  "failureConditions",
  "permanentConsequences",
  "temporaryConsequences",
  "tracks",
  "pressureSystems",
  "thresholdHistory",
  "pendingThresholdQueue",
  "selections",
  "proposedStationOrder",
  "committedStationOrder",
  "targets",
  "riskBids",
  "assistance",
  "reservations",
  "pendingChecks",
  "activeHazards",
  "pendingConsequences",
  "processedRequestIds",
  "snapshots",
  "recovery",
  "metadata"
]);
const RUNTIME_EVENT_FIELDS = Object.freeze([
  "type",
  "sessionId",
  "eventId",
  "definitionSnapshotId",
  "shipId",
  "sourceCheckpointId",
  "sourceCheckpointRevision",
  "recoveryAuthorityUserId",
  "previousRevision",
  "revision"
]);
const STORED_EVENT_FIELDS = Object.freeze({
  "voyage.pressure-applied": Object.freeze([
    "type", "encounterId", "lifecycleState", "stageId", "roundNumber", "phase", "pressureEffectCount",
    "standardPressureEffectCount", "authoredPressureEffectCount", "effects", "previousPressureSystems", "pressureSystems",
    "previousRevision", "revision"
  ]),
  "voyage.hazard-escalated": Object.freeze([
    "type", "encounterId", "hazardId", "pressureSystemId", "incomingHazardId", "collisionPolicy", "previousRevision",
    "revision", "previousStageId", "targetStageId", "requestKind", "requestedTargetStageId", "operationId", "skippedStages",
    "previousHazard", "hazard"
  ]),
  "voyage.hazard-resolved": Object.freeze([
    "type", "encounterId", "lifecycleState", "stageId", "roundNumber", "phase", "hazardId", "pressureSystemId", "outcome",
    "previousRevision", "revision", "previousHazard", "hazard", "benefit"
  ]),
  "voyage.hazard-closeout-consequence-applied": Object.freeze([
    "type", "applicationId", "closeoutId", "encounterId", "eventId", "sessionId", "definitionSnapshotId", "shipId",
    "stageId", "roundNumber", "phase", "hazardId", "consequenceId", "consequenceKind", "pressureSystemId",
    "pressureEffect", "previousHazard", "disposition", "previousEncounterRevision", "encounterRevision"
  ]),
  "voyage.pressure-breach-applied": Object.freeze([
    "type", "encounterId", "lifecycleState", "stageId", "roundNumber", "phase", "pressureEffectCount", "appliedEffectCount",
    "breach", "hazard", "collisionOutcome", "voidScarProposal", "pressureReset", "effects", "previousPressureSystems",
    "pressureSystems", "previousRevision", "revision"
  ]),
  "voyage.void-scar-created": Object.freeze([
    "type", "shipId", "encounterId", "pressureSystemId", "sourceEventType", "sourceEncounterRevision", "sourceProposal",
    "previousShipRevision", "revision", "previousVoidScarCount", "voidScarCount", "voidScar"
  ]),
  "voyage.closeout-void-scar-created": Object.freeze([
    "type", "applicationId", "closeoutId", "shipId", "eventId", "sessionId", "pressureSystemId", "sourceProposal",
    "previousShipRevision", "revision", "previousVoidScarCount", "voidScarCount", "voidScar"
  ]),
  "voyage.closeout-persistent-state-applied": Object.freeze([
    "type", "applicationId", "closeoutId", "shipId", "proposalIds", "previousShipRevision", "revision"
  ]),
  "voyage.closeout-applied": Object.freeze([
    "type", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "overallResult",
    "proposalIds", "previousEncounterRevision", "encounterRevision", "shipRevision"
  ])
});
const M6_PRESSURE_EFFECT_FIELDS = Object.freeze([
  "pressureEffectId", "encounterId", "stageId", "roundNumber", "sequence", "stationId", "actionId", "pressureSystemId",
  "delta", "timing", "sourceKind", "sourceIntentId", "activationSource", "branch", "visibility"
]);
const M6_BREACH_FIELDS = Object.freeze([
  "pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId",
  "pressureSystemId", "pressureEffectId", "sourceKind", "sourceIntentId", "activationSource", "branch", "timing",
  "visibility", "previousValue", "capacity", "remainingCapacity", "attemptedDelta", "overflowDelta"
]);
const M6_SPARSE_HAZARD_FIELDS = Object.freeze([
  "hazardId", "pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId",
  "actionId", "pressureSystemId", "category", "status", "sourceKind", "pressureEffectId", "sourceIntentId",
  "activationSource", "branch", "timing", "visibility", "name"
]);
const M6_VOID_SCAR_PROPOSAL_FIELDS = Object.freeze([
  "voidScarProposalId", "voidScarId", "pressureBreachId", "hazardId", "encounterId", "stageId", "roundNumber",
  "effectIndex", "sequence", "stationId", "actionId", "pressureSystemId", "consequenceKind", "status", "persistence",
  "sourceKind", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility", "name"
]);
const M6_PRESSURE_RESET_FIELDS = Object.freeze(["pressureBreachId", "pressureSystemId", "previousValue", "resetValue"]);
const M6_PRESSURE_SYSTEM_FIELDS = Object.freeze(["pressureSystemId", "value", "capacity"]);
const M10_SCAR_SOURCE_FIELDS = Object.freeze(["eventId", "sessionId", "definitionSnapshotId", "misfortuneId", "voidScarDefinitionId"]);
const CHECKPOINT_FIELDS = Object.freeze([
  "checkpointId",
  "kind",
  "sessionId",
  "revision",
  "encounterRevision",
  "eventCount",
  "sessionState",
  "encounterState",
  "closeout",
  "authorityEpoch",
  "invalidated"
]);
const PROCESSED_REQUEST_FIELDS = Object.freeze([
  "requestId",
  "principalUserId",
  "projectionKind",
  "fingerprint",
  "commandKind",
  "resultKind",
  "resultRevision",
  "response"
]);
const CLOSEOUT_FIELDS = Object.freeze([
  "status",
  "applicationId",
  "closeoutId",
  "acceptedApplicationPlan",
  "reservationId",
  "expectedEncounterRevision",
  "expectedShipRevision",
  "sessionReservationReceipt",
  "sessionCommitReceipt"
]);
const ACCEPTED_PLAN_FIELDS = Object.freeze(["previewRequest", "reviewRequest", "applicationPlan"]);
const M10_APPLICATION_PLAN_FIELDS = Object.freeze([
  "schemaVersion",
  "applicationId",
  "closeoutId",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "shipId",
  "expectedEncounterRevision",
  "expectedShipRevision",
  "gmUserId",
  "persistentProposals",
  "temporaryResetPlan",
  "expectedPreview"
]);
const RESERVATION_RECEIPT_FIELDS = Object.freeze([
  "kind",
  "reservationId",
  "activeGmUserId",
  "applicationId",
  "closeoutId",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "shipId",
  "expectedEncounterRevision",
  "pressureBreachSources"
]);
const COMMIT_RECEIPT_FIELDS = Object.freeze([
  "kind",
  "reservationId",
  "activeGmUserId",
  "applicationId",
  "closeoutId",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "shipId",
  "previousEncounterRevision",
  "encounterRevision",
  "completedCloseoutSnapshot",
  "encounterEvents",
  "pressureBreachSources"
]);
const PRESSURE_BREACH_SOURCE_FIELDS = Object.freeze([
  "breachEventIndex",
  "sourceHazardId",
  "expectedEncounterRevision",
  "closeoutContext",
  "pressureSystems",
  "activeHazards",
  "pressureEffect"
]);
const CLOSEOUT_CONTEXT_FIELDS = Object.freeze(["eventId", "sessionId", "stageId", "roundNumber", "phase"]);
const RECOVERY_FIELDS = Object.freeze([
  "status",
  "reasonCode",
  "failedRequestId",
  "failedRevision",
  "checkpointId",
  "sourceCheckpointRevision",
  "recoveryAuthorityUserId"
]);
const AUDIT_FIELDS = Object.freeze([
  "auditId",
  "kind",
  "sessionId",
  "requestId",
  "actorUserId",
  "authorityEpoch",
  "previousRevision",
  "revision",
  "occurredAt",
  "details"
]);
const SESSION_STATES = new Set([
  "setup",
  "round-introduction",
  "crew-planning",
  "plan-locked",
  "station-resolution",
  "round-closeout",
  "next-round",
  "event-closeout-review",
  "persistent-application",
  "completed",
  "paused",
  "emergency-response",
  "aborted",
  "recovery-required"
]);
const PHASES = new Set([
  "situation",
  "crew-planning",
  "lock-readiness",
  "resolution",
  "consequences",
  "cleanup-advance"
]);
const CHECKPOINT_KINDS = new Set([
  "before-plan-lock",
  "before-action-segment",
  "before-reaction",
  "before-round-closeout",
  "before-emergency-response",
  "before-persistent-application",
  "after-recovery"
]);
const CLOSEOUT_STATUSES = new Set([
  "none",
  "review-required",
  "accepted-for-application",
  "prepared-awaiting-session",
  "ship-applied-awaiting-session",
  "commit-pending",
  "committed",
  "reconciliation-required"
]);
const PROJECTION_KINDS = new Set(["gm", "operator", "crew", "observer", "none"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MESSAGES = Object.freeze({
  hostile: "M11 data could not be captured safely.",
  shape: "Request shape, order, or root values are invalid.",
  mode: "The requested M11 API mode is invalid.",
  missing: "Exact Event Session document was not resolved.",
  ambiguous: "More than one Event Session document matched.",
  invalid: "Stored Event Session is invalid.",
  write: "Event Session write did not complete or verify.",
  payload: "Command payload is invalid."
});

function diagnostic(code, path) {
  const message = {
    "m11-hostile-data-capture-failed": MESSAGES.hostile,
    "m11-invalid-request-shape": MESSAGES.shape,
    "m11-invalid-mode": MESSAGES.mode,
    "m11-session-document-not-found": MESSAGES.missing,
    "m11-ambiguous-session-document": MESSAGES.ambiguous,
    "m11-invalid-session-document": MESSAGES.invalid,
    "m11-session-write-failed": MESSAGES.write,
    "m11-command-payload-invalid": MESSAGES.payload
  }[code] ?? "M11 data is invalid.";
  return { code, path, message, severity: "error" };
}

function dedupe(errors) {
  const seen = new Set();
  return errors.filter((entry) => {
    const key = JSON.stringify([entry.code, entry.path, entry.message, entry.severity]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function failure(errors, identities = {}) {
  return {
    ok: false,
    requestId: identities.requestId ?? null,
    sessionId: identities.sessionId ?? null,
    status: "failed",
    revision: null,
    authorityEpoch: null,
    projection: null,
    events: [],
    errors: dedupe(errors),
    warnings: []
  };
}

function success(session, requestId = null) {
  return {
    ok: true,
    requestId,
    sessionId: session.sessionId,
    status: session.sessionState,
    revision: session.revision,
    authorityEpoch: session.authorityEpoch,
    projection: null,
    events: [],
    errors: [],
    warnings: []
  };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Capture only safe JSON-like plain data. Ancestor tracking deliberately does
 * not memoize completed objects: acyclic shared references are accepted but
 * become separate isolated captures.
 */
function capture(value, ancestors = new Set()) {
  try {
    if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
    if (typeof value === "number") return Number.isFinite(value) ? { ok: true, value } : { ok: false, value: null };
    if (typeof value !== "object" || ancestors.has(value)) return { ok: false, value: null };
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return { ok: false, value: null };
    const keys = Reflect.ownKeys(value);
    ancestors.add(value);
    try {
      if (array) {
        const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
        if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) return { ok: false, value: null };
        const output = new Array(length);
        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, value: null };
          const nested = capture(descriptor.value, ancestors);
          if (!nested.ok) return nested;
          output[index] = nested.value;
        }
        for (const key of keys) {
          if (key === "length") continue;
          if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) return { ok: false, value: null };
        }
        return { ok: true, value: output };
      }
      const output = {};
      for (const key of keys) {
        if (typeof key !== "string" || UNSAFE_KEYS.has(key)) return { ok: false, value: null };
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, value: null };
        const nested = capture(descriptor.value, ancestors);
        if (!nested.ok) return nested;
        output[key] = nested.value;
      }
      return { ok: true, value: output };
    } finally {
      ancestors.delete(value);
    }
  } catch {
    return { ok: false, value: null };
  }
}

function exactKeys(value, fields) {
  return isPlainObject(value) && Object.keys(value).length === fields.length
    && Object.keys(value).every((key, index) => key === fields[index]);
}

function equal(left, right) {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((entry, index) => equal(entry, right[index]));
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]));
}

function nonBlank(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function sessionMappingIsValid(sessionState, encounter) {
  const lifecycle = encounter.lifecycleState;
  const phase = encounter.phase;
  const oneOf = (values) => values.includes(lifecycle);
  if (sessionState === "setup") return oneOf(["draft", "configuration", "ready"]) && phase === null;
  if (sessionState === "round-introduction") return lifecycle === "active" && phase === "situation";
  if (sessionState === "crew-planning") return lifecycle === "active" && phase === "crew-planning";
  if (sessionState === "plan-locked") return lifecycle === "active" && phase === "lock-readiness";
  if (sessionState === "station-resolution") return lifecycle === "active" && phase === "resolution";
  if (sessionState === "round-closeout" || sessionState === "emergency-response") return lifecycle === "active" && phase === "consequences";
  if (sessionState === "next-round") return lifecycle === "active" && (phase === "cleanup-advance" || phase === "situation");
  if (sessionState === "event-closeout-review" || sessionState === "persistent-application") return lifecycle === "active" && phase === "cleanup-advance";
  if (sessionState === "completed") return (lifecycle === "completed-success" || lifecycle === "completed-failure") && phase === null;
  if (sessionState === "paused") return lifecycle === "paused" && (phase === null || PHASES.has(phase));
  if (sessionState === "aborted") return (lifecycle === "abandoned" || lifecycle === "discarded") && phase === null;
  return sessionState === "recovery-required" && lifecycle === "recovery" && (phase === null || PHASES.has(phase));
}

function primaryShipMatches(primaryShip, shipId) {
  if (!isPlainObject(primaryShip)) return false;
  const values = [primaryShip.id, primaryShip.shipId, primaryShip.actorId];
  return values.some((value) => value === shipId);
}

function validEncounterState(encounter, identity) {
  if (!exactKeys(encounter, ENCOUNTER_FIELDS)) return false;
  const report = validateVoyageEncounterState(encounter);
  return report.valid && encounter.schemaVersion === 1 && encounter.encounterId === identity.eventId
    && safeInteger(encounter.revision) && primaryShipMatches(encounter.primaryShip, identity.shipId);
}

function validRuntimeEvent(event, identity, sessionRevision) {
  if (!exactKeys(event, RUNTIME_EVENT_FIELDS)) return false;
  if (!(["voyage.m11-closeout-review-accepted", "voyage.m11-recovery-rebuilt"].includes(event.type))) return false;
  if (event.sessionId !== identity.sessionId || event.eventId !== identity.eventId
    || event.definitionSnapshotId !== identity.definitionSnapshotId || event.shipId !== identity.shipId
    || !safeInteger(event.previousRevision) || !safeInteger(event.revision)
    || event.revision !== event.previousRevision + 1 || event.revision > sessionRevision) return false;
  if (event.type === "voyage.m11-closeout-review-accepted") {
    return event.sourceCheckpointId === null && event.sourceCheckpointRevision === null && event.recoveryAuthorityUserId === null;
  }
  return nonBlank(event.sourceCheckpointId) && safeInteger(event.sourceCheckpointRevision) && nonBlank(event.recoveryAuthorityUserId);
}

function validPressureEffect(effect, identity, stageId, roundNumber, { closeout = false } = {}) {
  const common = exactKeys(effect, M6_PRESSURE_EFFECT_FIELDS)
    && nonBlank(effect.pressureEffectId) && effect.encounterId === identity.eventId
    && effect.stageId === stageId && effect.roundNumber === roundNumber
    && safeInteger(effect.sequence)
    && VOYAGE_PRESSURE_SYSTEM_IDS.includes(effect.pressureSystemId)
    && Number.isSafeInteger(effect.delta) && effect.delta !== 0
    && nonBlank(effect.timing) && nonBlank(effect.sourceKind)
    && nonBlank(effect.sourceIntentId) && nonBlank(effect.activationSource)
    && nonBlank(effect.branch) && nonBlank(effect.visibility);
  if (!common) return false;
  if (closeout) {
    return effect.stationId === null && effect.actionId === null;
  }
  return (effect.stationId === null && effect.actionId === null)
    || (nonBlank(effect.stationId) && nonBlank(effect.actionId));
}

function validM10HazardCloseoutEvent(event, identity) {
  if (!exactKeys(event, STORED_EVENT_FIELDS[event.type])) return false;
  const shared = [event.applicationId, event.closeoutId, event.encounterId, event.eventId, event.sessionId,
    event.definitionSnapshotId, event.shipId, event.stageId, event.hazardId, event.consequenceId, event.consequenceKind].every(nonBlank);
  if (!shared || event.encounterId !== identity.eventId || event.eventId !== identity.eventId
    || event.sessionId !== identity.sessionId || event.definitionSnapshotId !== identity.definitionSnapshotId
    || event.shipId !== identity.shipId || event.phase !== "cleanup-advance" || event.disposition !== "removed"
    || !safeInteger(event.roundNumber) || !safeInteger(event.previousEncounterRevision)
    || !safeInteger(event.encounterRevision) || event.encounterRevision !== event.previousEncounterRevision + 1
    || !validateVoyageHazardRecord(event.previousHazard, { mode: "snapshot", expectedEncounterId: identity.eventId }).valid
    || event.previousHazard.hazardId !== event.hazardId) return false;
  const pressure = event.consequenceKind === "pressure-change"
    && VOYAGE_PRESSURE_SYSTEM_IDS.includes(event.pressureSystemId)
    && validPressureEffect(event.pressureEffect, identity, event.stageId, event.roundNumber)
    && event.pressureEffect.pressureSystemId === event.pressureSystemId
    && event.pressureEffect.sourceKind === "hazard-closeout"
    && event.pressureEffect.sourceIntentId === event.consequenceId
    && event.pressureEffect.timing === "gm-confirmed"
    && event.pressureEffect.activationSource === "event-closeout"
    && event.pressureEffect.branch === "no-roll";
  const persistent = event.consequenceKind === "persistent-consequence"
    && event.pressureSystemId === null && event.pressureEffect === null;
  return pressure || persistent;
}

function validM6PressureSystemMap(value) {
  if (!isPlainObject(value) || !equal(Object.keys(value), VOYAGE_PRESSURE_SYSTEM_IDS)) return false;
  return VOYAGE_PRESSURE_SYSTEM_IDS.every((pressureSystemId) => {
    const system = value[pressureSystemId];
    return exactKeys(system, M6_PRESSURE_SYSTEM_FIELDS) && system.pressureSystemId === pressureSystemId
      && safeInteger(system.value) && safeInteger(system.capacity) && system.value <= system.capacity;
  });
}

function validM6PressureAppliedEvent(event, identity) {
  return exactKeys(event, STORED_EVENT_FIELDS[event.type]) && event.encounterId === identity.eventId
    && event.lifecycleState === "active" && nonBlank(event.stageId) && safeInteger(event.roundNumber) && PHASES.has(event.phase)
    && safeInteger(event.pressureEffectCount) && safeInteger(event.standardPressureEffectCount)
    && safeInteger(event.authoredPressureEffectCount) && event.pressureEffectCount === event.standardPressureEffectCount + event.authoredPressureEffectCount
    && Array.isArray(event.effects) && event.effects.length === event.pressureEffectCount
    && event.effects.every((effect) => validPressureEffect(effect, identity, event.stageId, event.roundNumber))
    && validM6PressureSystemMap(event.previousPressureSystems) && validM6PressureSystemMap(event.pressureSystems)
    && safeInteger(event.previousRevision) && safeInteger(event.revision) && event.revision === event.previousRevision + 1;
}

function validM6HazardSnapshot(value, identity) {
  return validateVoyageHazardRecord(value, { mode: "snapshot", expectedEncounterId: identity.eventId }).valid;
}

function validM6HazardEscalatedEvent(event, identity) {
  return exactKeys(event, STORED_EVENT_FIELDS[event.type]) && event.encounterId === identity.eventId
    && [event.hazardId, event.pressureSystemId, event.incomingHazardId, event.collisionPolicy, event.previousStageId,
      event.targetStageId, event.requestKind].every(nonBlank)
    && VOYAGE_PRESSURE_SYSTEM_IDS.includes(event.pressureSystemId)
    && (event.requestedTargetStageId === null || nonBlank(event.requestedTargetStageId))
    && (event.operationId === null || nonBlank(event.operationId)) && Array.isArray(event.skippedStages)
    && event.skippedStages.every(nonBlank) && new Set(event.skippedStages).size === event.skippedStages.length
    && safeInteger(event.previousRevision) && safeInteger(event.revision) && event.revision === event.previousRevision + 1
    && validM6HazardSnapshot(event.previousHazard, identity) && validM6HazardSnapshot(event.hazard, identity)
    && event.previousHazard.hazardId === event.hazardId && event.hazard.hazardId === event.hazardId
    && event.previousHazard.pressureSystemId === event.pressureSystemId && event.hazard.pressureSystemId === event.pressureSystemId;
}

function validM6HazardResolvedEvent(event, identity) {
  return exactKeys(event, STORED_EVENT_FIELDS[event.type]) && event.encounterId === identity.eventId
    && event.lifecycleState === "active" && nonBlank(event.stageId) && safeInteger(event.roundNumber) && PHASES.has(event.phase)
    && nonBlank(event.hazardId) && VOYAGE_PRESSURE_SYSTEM_IDS.includes(event.pressureSystemId)
    && nonBlank(event.outcome) && safeInteger(event.previousRevision) && safeInteger(event.revision)
    && event.revision === event.previousRevision + 1 && validM6HazardSnapshot(event.previousHazard, identity)
    && validM6HazardSnapshot(event.hazard, identity) && event.previousHazard.hazardId === event.hazardId
    && event.hazard.hazardId === event.hazardId && event.previousHazard.pressureSystemId === event.pressureSystemId
    && event.hazard.pressureSystemId === event.pressureSystemId && (event.benefit === null || isPlainObject(event.benefit));
}

function validM6BreachEvidence(event, identity) {
  if (!exactKeys(event.breach, M6_BREACH_FIELDS) || !exactKeys(event.hazard, M6_SPARSE_HAZARD_FIELDS)
    || !exactKeys(event.voidScarProposal, M6_VOID_SCAR_PROPOSAL_FIELDS)
    || !exactKeys(event.pressureReset, M6_PRESSURE_RESET_FIELDS)
    || !Array.isArray(event.effects) || event.effects.length === 0
    || !safeInteger(event.breach.effectIndex) || event.breach.effectIndex >= event.effects.length) return false;
  const breach = event.breach;
  const effect = event.effects[breach.effectIndex];
  if (!validPressureEffect(effect, identity, event.stageId, event.roundNumber)
    || breach.encounterId !== identity.eventId || breach.stageId !== event.stageId || breach.roundNumber !== event.roundNumber
    || breach.effectIndex < 0 || breach.sequence !== effect.sequence || breach.stationId !== effect.stationId
    || breach.actionId !== effect.actionId || breach.pressureSystemId !== effect.pressureSystemId
    || breach.pressureEffectId !== effect.pressureEffectId || breach.sourceKind !== effect.sourceKind
    || breach.sourceIntentId !== effect.sourceIntentId || breach.activationSource !== effect.activationSource
    || breach.branch !== effect.branch || breach.timing !== effect.timing || breach.visibility !== effect.visibility
    || breach.pressureBreachId !== `arcflight-pressure-breach:${JSON.stringify([
      effect.encounterId, effect.stageId, effect.roundNumber, breach.effectIndex, effect.pressureSystemId, effect.pressureEffectId
    ])}` || !safeInteger(breach.previousValue) || !safeInteger(breach.capacity)
    || breach.previousValue > breach.capacity || breach.remainingCapacity !== breach.capacity - breach.previousValue
    || breach.attemptedDelta !== effect.delta || breach.overflowDelta !== effect.delta - breach.remainingCapacity
    || breach.overflowDelta <= 0) return false;
  const hazard = event.hazard;
  const proposal = event.voidScarProposal;
  const shared = ["pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId",
    "pressureSystemId", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility"];
  if (!shared.every((field) => hazard[field] === breach[field] && proposal[field] === breach[field])
    || hazard.hazardId !== `arcflight-hazard:${JSON.stringify(["pressure-breach", breach.pressureBreachId])}`
    || hazard.category !== "system" || hazard.status !== "active" || hazard.sourceKind !== "pressure-breach"
    || !nonBlank(hazard.name) || proposal.voidScarProposalId !== `arcflight-void-scar-proposal:${JSON.stringify(["pressure-breach", breach.pressureBreachId])}`
    || proposal.voidScarId !== `arcflight-void-scar:${JSON.stringify(["pressure-breach", breach.pressureBreachId])}`
    || proposal.hazardId !== hazard.hazardId || proposal.consequenceKind !== "void-scar"
    || proposal.status !== "proposed" || proposal.persistence !== "lasting" || proposal.sourceKind !== "pressure-breach"
    || !nonBlank(proposal.name) || event.pressureReset.pressureBreachId !== breach.pressureBreachId
    || event.pressureReset.pressureSystemId !== breach.pressureSystemId
    || event.pressureReset.previousValue !== breach.previousValue || event.pressureReset.resetValue !== 0) return false;
  return event.effects.every((entry) => validPressureEffect(entry, identity, event.stageId, event.roundNumber));
}

function validM6PressureBreachEvent(event, identity, activeHazards) {
  if (!exactKeys(event, STORED_EVENT_FIELDS[event.type])) return false;
  if (event.encounterId !== identity.eventId || event.lifecycleState !== "active" || !nonBlank(event.stageId)
    || !safeInteger(event.roundNumber) || !PHASES.has(event.phase)
    || !safeInteger(event.pressureEffectCount) || !safeInteger(event.appliedEffectCount)
    || event.pressureEffectCount !== event.effects?.length || event.appliedEffectCount !== event.effects?.length
    || !validM6PressureSystemMap(event.previousPressureSystems) || !validM6PressureSystemMap(event.pressureSystems)
    || !validM6BreachEvidence(event, identity)
    || !safeInteger(event.previousRevision) || !safeInteger(event.revision)
    || event.revision !== event.previousRevision + 1) return false;
  const closeoutEffect = event.effects.length === 1 && validPressureEffect(event.effects[0], identity, event.stageId, event.roundNumber, { closeout: true })
    && event.phase === "cleanup-advance" && event.effects[0].timing === "gm-confirmed"
    && event.effects[0].sourceKind === "hazard-closeout" && event.effects[0].activationSource === "event-closeout"
    && event.effects[0].branch === "no-roll";
  if (!closeoutEffect) return true;
  const regenerated = analyzeVoyagePressureBreachCloseoutTransaction({
    expectedEncounterRevision: event.previousRevision,
    closeoutContext: {
      eventId: identity.eventId,
      sessionId: identity.sessionId,
      stageId: event.stageId,
      roundNumber: event.roundNumber,
      phase: event.phase
    },
    pressureSystems: Object.values(event.previousPressureSystems),
    activeHazards,
    pressureEffect: event.effects[0]
  });
  return regenerated.ok && regenerated.breachRequired === true && equal(regenerated.event, event);
}

function validM7ScarEvent(event, identity, m6Events) {
  if (!exactKeys(event, STORED_EVENT_FIELDS[event.type]) || event.shipId !== identity.shipId
    || event.encounterId !== identity.eventId || !VOYAGE_PRESSURE_SYSTEM_IDS.includes(event.pressureSystemId)
    || event.sourceEventType !== "voyage.pressure-breach-applied" || !safeInteger(event.sourceEncounterRevision)
    || !safeInteger(event.previousShipRevision) || !safeInteger(event.revision)
    || event.revision !== event.previousShipRevision + 1 || !safeInteger(event.previousVoidScarCount)
    || !safeInteger(event.voidScarCount) || event.voidScarCount !== event.previousVoidScarCount + 1
    || !isPlainObject(event.sourceProposal) || !captureVoyageDurableVoidScarRecord(event.voidScar).ok) return false;
  const source = m6Events.get(event.sourceEncounterRevision);
  return Boolean(source) && source.encounterId === event.encounterId
    && source.breach.pressureSystemId === event.pressureSystemId
    && equal(source.voidScarProposal, event.sourceProposal)
    && event.voidScar.pressureBreachId === source.breach.pressureBreachId
    && event.voidScar.hazardId === source.hazard.hazardId
    && event.voidScar.encounterId === source.encounterId
    && event.voidScar.pressureSystemId === source.breach.pressureSystemId
    && event.voidScar.voidScarId === source.voidScarProposal.voidScarId;
}

function validM10ScarEvent(event, identity) {
  if (!exactKeys(event, STORED_EVENT_FIELDS[event.type]) || ![event.applicationId, event.closeoutId, event.shipId,
    event.eventId, event.sessionId, event.pressureSystemId].every(nonBlank)
    || event.shipId !== identity.shipId || event.eventId !== identity.eventId || event.sessionId !== identity.sessionId
    || !VOYAGE_PRESSURE_SYSTEM_IDS.includes(event.pressureSystemId) || !exactKeys(event.sourceProposal, ["voidScarDefinitionId", "pressureSystemId", "source"])
    || event.sourceProposal.pressureSystemId !== event.pressureSystemId || event.sourceProposal.source !== "m8-critical-overall-failure"
    || !captureVoyageDurableVoidScarRecord(event.voidScar).ok || !isPlainObject(event.voidScar)
    || !exactKeys(event.voidScar.source, M10_SCAR_SOURCE_FIELDS)
    || event.voidScar.source.eventId !== identity.eventId || event.voidScar.source.sessionId !== identity.sessionId
    || event.voidScar.source.definitionSnapshotId !== identity.definitionSnapshotId
    || event.voidScar.source.voidScarDefinitionId !== event.sourceProposal.voidScarDefinitionId
    || !safeInteger(event.previousShipRevision) || !safeInteger(event.revision)
    || event.revision !== event.previousShipRevision + 1 || !safeInteger(event.previousVoidScarCount)
    || !safeInteger(event.voidScarCount) || event.voidScarCount !== event.previousVoidScarCount + 1) return false;
  return event.voidScar.pressureSystemId === event.pressureSystemId && event.voidScar.sourceKind === "m8-critical-overall-failure";
}

function validM10PersistentEvent(event, identity) {
  return exactKeys(event, STORED_EVENT_FIELDS[event.type]) && [event.applicationId, event.closeoutId, event.shipId].every(nonBlank)
    && event.shipId === identity.shipId && Array.isArray(event.proposalIds) && event.proposalIds.length > 0
    && event.proposalIds.every(nonBlank) && new Set(event.proposalIds).size === event.proposalIds.length
    && safeInteger(event.previousShipRevision) && safeInteger(event.revision)
    && event.revision === event.previousShipRevision + 1;
}

function validM10CloseoutEvent(event, identity) {
  return exactKeys(event, STORED_EVENT_FIELDS[event.type]) && [event.applicationId, event.closeoutId, event.eventId,
    event.sessionId, event.definitionSnapshotId, event.shipId, event.overallResult].every(nonBlank)
    && event.eventId === identity.eventId && event.sessionId === identity.sessionId
    && event.definitionSnapshotId === identity.definitionSnapshotId && event.shipId === identity.shipId
    && ["overall-success", "overall-failure"].includes(event.overallResult)
    && Array.isArray(event.proposalIds) && event.proposalIds.every(nonBlank)
    && new Set(event.proposalIds).size === event.proposalIds.length
    && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision)
    && event.encounterRevision === event.previousEncounterRevision + 1 && safeInteger(event.shipRevision);
}

function validEvents(events, identity, sessionRevision, encounterRevision, activeHazards = []) {
  if (!Array.isArray(events)) return false;
  const m6Events = new Map();
  const knownHazards = [...activeHazards];
  let previousRuntimeRevision = -1;
  let previousEncounterRevision = null;
  let previousShipRevision = null;
  let closeoutFinalized = false;
  for (const event of events) {
    const runtime = event?.type === "voyage.m11-closeout-review-accepted" || event?.type === "voyage.m11-recovery-rebuilt";
    if (runtime) {
      if (!validRuntimeEvent(event, identity, sessionRevision) || event.previousRevision < previousRuntimeRevision) return false;
      previousRuntimeRevision = event.revision;
      continue;
    }
    if (!isPlainObject(event) || !Object.hasOwn(STORED_EVENT_FIELDS, event.type) || closeoutFinalized) return false;
    let eventEncounterRevision = null;
    let eventShipRevision = null;
    if (event.type === "voyage.pressure-applied") {
      if (!validM6PressureAppliedEvent(event, identity)) return false;
      eventEncounterRevision = [event.previousRevision, event.revision];
    } else if (event.type === "voyage.hazard-escalated") {
      if (!validM6HazardEscalatedEvent(event, identity)) return false;
      eventEncounterRevision = [event.previousRevision, event.revision];
    } else if (event.type === "voyage.hazard-resolved") {
      if (!validM6HazardResolvedEvent(event, identity)) return false;
      eventEncounterRevision = [event.previousRevision, event.revision];
    } else if (event.type === "voyage.hazard-closeout-consequence-applied") {
      if (!validM10HazardCloseoutEvent(event, identity)) return false;
      knownHazards.push(event.previousHazard);
      eventEncounterRevision = [event.previousEncounterRevision, event.encounterRevision];
    } else if (event.type === "voyage.pressure-breach-applied") {
      if (!validM6PressureBreachEvent(event, identity, knownHazards)) return false;
      m6Events.set(event.revision, event);
      eventEncounterRevision = [event.previousRevision, event.revision];
    } else if (event.type === "voyage.void-scar-created") {
      if (!validM7ScarEvent(event, identity, m6Events)) return false;
      eventShipRevision = [event.previousShipRevision, event.revision];
    } else if (event.type === "voyage.closeout-void-scar-created") {
      if (!validM10ScarEvent(event, identity)) return false;
      eventShipRevision = [event.previousShipRevision, event.revision];
    } else if (event.type === "voyage.closeout-persistent-state-applied") {
      if (!validM10PersistentEvent(event, identity)) return false;
      eventShipRevision = [event.previousShipRevision, event.revision];
    } else {
      if (!validM10CloseoutEvent(event, identity)) return false;
      eventEncounterRevision = [event.previousEncounterRevision, event.encounterRevision];
      closeoutFinalized = true;
    }
    if (eventEncounterRevision) {
      if (previousEncounterRevision !== null && eventEncounterRevision[0] !== previousEncounterRevision) return false;
      previousEncounterRevision = eventEncounterRevision[1];
    }
    if (eventShipRevision) {
      if (previousShipRevision !== null && eventShipRevision[0] !== previousShipRevision) return false;
      previousShipRevision = eventShipRevision[1];
    }
  }
  return previousRuntimeRevision <= sessionRevision
    && (previousEncounterRevision === null || previousEncounterRevision <= encounterRevision);
}

function validAcceptedPlan(value, identity) {
  if (!exactKeys(value, ACCEPTED_PLAN_FIELDS) || !isPlainObject(value.previewRequest)
    || !isPlainObject(value.reviewRequest) || !exactKeys(value.applicationPlan, M10_APPLICATION_PLAN_FIELDS)) return false;
  const plan = value.applicationPlan;
  return exactKeys(value.reviewRequest, ["kind", "sessionId", "gmUserId", "confirmed", "previewRequest", "suppliedPreview"])
    && value.reviewRequest.kind === "m10-closeout-review" && value.reviewRequest.sessionId === identity.sessionId
    && nonBlank(value.reviewRequest.gmUserId) && value.reviewRequest.confirmed === true
    && equal(value.reviewRequest.previewRequest, value.previewRequest) && isPlainObject(value.reviewRequest.suppliedPreview)
    && plan.schemaVersion === 1 && nonBlank(plan.applicationId) && nonBlank(plan.closeoutId)
    && plan.eventId === identity.eventId && plan.sessionId === identity.sessionId
    && plan.definitionSnapshotId === identity.definitionSnapshotId && plan.shipId === identity.shipId
    && safeInteger(plan.expectedEncounterRevision) && safeInteger(plan.expectedShipRevision) && nonBlank(plan.gmUserId)
    && Array.isArray(plan.persistentProposals) && isPlainObject(plan.temporaryResetPlan) && isPlainObject(plan.expectedPreview);
}

function validPressureBreachSources(sources, identity, expectedEncounterRevision) {
  if (!Array.isArray(sources)) return false;
  const indices = new Set();
  for (const source of sources) {
    if (!exactKeys(source, PRESSURE_BREACH_SOURCE_FIELDS) || !safeInteger(source.breachEventIndex)
      || indices.has(source.breachEventIndex) || !nonBlank(source.sourceHazardId)
      || source.expectedEncounterRevision !== expectedEncounterRevision || !exactKeys(source.closeoutContext, CLOSEOUT_CONTEXT_FIELDS)
      || source.closeoutContext.eventId !== identity.eventId || source.closeoutContext.sessionId !== identity.sessionId
      || !nonBlank(source.closeoutContext.stageId) || !safeInteger(source.closeoutContext.roundNumber)
      || source.closeoutContext.phase !== "cleanup-advance" || !isPlainObject(source.pressureSystems)
      || !Array.isArray(source.activeHazards) || (source.pressureEffect !== null && !isPlainObject(source.pressureEffect))) return false;
    indices.add(source.breachEventIndex);
  }
  return true;
}

function validReservationReceipt(value, closeout, identity) {
  return exactKeys(value, RESERVATION_RECEIPT_FIELDS)
    && value.kind === "voyage.m11-closeout-session-reserved"
    && value.reservationId === `arcflight-closeout-reservation:${JSON.stringify([closeout.applicationId])}`
    && value.reservationId === closeout.reservationId && nonBlank(value.activeGmUserId)
    && value.applicationId === closeout.applicationId && value.closeoutId === closeout.closeoutId
    && value.eventId === identity.eventId && value.sessionId === identity.sessionId
    && value.definitionSnapshotId === identity.definitionSnapshotId && value.shipId === identity.shipId
    && value.expectedEncounterRevision === closeout.expectedEncounterRevision
    && validPressureBreachSources(value.pressureBreachSources, identity, closeout.expectedEncounterRevision);
}

function validCommitReceipt(value, closeout, identity, reservationReceipt) {
  return exactKeys(value, COMMIT_RECEIPT_FIELDS)
    && value.kind === "voyage.m11-closeout-session-committed"
    && value.reservationId === closeout.reservationId && nonBlank(value.activeGmUserId)
    && value.applicationId === closeout.applicationId && value.closeoutId === closeout.closeoutId
    && value.eventId === identity.eventId && value.sessionId === identity.sessionId
    && value.definitionSnapshotId === identity.definitionSnapshotId && value.shipId === identity.shipId
    && value.previousEncounterRevision === closeout.expectedEncounterRevision
    && safeInteger(value.encounterRevision) && value.encounterRevision >= value.previousEncounterRevision
    && isPlainObject(value.completedCloseoutSnapshot) && Array.isArray(value.encounterEvents)
    && validPressureBreachSources(value.pressureBreachSources, identity, closeout.expectedEncounterRevision)
    && equal(value.pressureBreachSources, reservationReceipt.pressureBreachSources);
}

function validCloseout(closeout, identity) {
  if (!exactKeys(closeout, CLOSEOUT_FIELDS) || !CLOSEOUT_STATUSES.has(closeout.status)) return false;
  const empty = closeout.applicationId === null && closeout.closeoutId === null && closeout.acceptedApplicationPlan === null
    && closeout.reservationId === null && closeout.expectedEncounterRevision === null && closeout.expectedShipRevision === null
    && closeout.sessionReservationReceipt === null && closeout.sessionCommitReceipt === null;
  if (closeout.status === "none" || closeout.status === "review-required") return empty;
  if (!validAcceptedPlan(closeout.acceptedApplicationPlan, identity)) return false;
  const plan = closeout.acceptedApplicationPlan.applicationPlan;
  if (closeout.applicationId !== plan.applicationId || closeout.closeoutId !== plan.closeoutId
    || closeout.expectedEncounterRevision !== plan.expectedEncounterRevision || closeout.expectedShipRevision !== plan.expectedShipRevision) return false;
  if (closeout.status === "accepted-for-application") {
    return closeout.reservationId === null && closeout.sessionReservationReceipt === null && closeout.sessionCommitReceipt === null;
  }
  if (!nonBlank(closeout.reservationId)) return false;
  if (["prepared-awaiting-session", "reconciliation-required"].includes(closeout.status)) return closeout.sessionReservationReceipt === null && closeout.sessionCommitReceipt === null;
  if (!validReservationReceipt(closeout.sessionReservationReceipt, closeout, identity)) return false;
  if (closeout.status === "ship-applied-awaiting-session" || closeout.status === "commit-pending") return closeout.sessionCommitReceipt === null;
  return validCommitReceipt(closeout.sessionCommitReceipt, closeout, identity, closeout.sessionReservationReceipt);
}

function validRecovery(recovery) {
  if (!exactKeys(recovery, RECOVERY_FIELDS) || !["none", "required", "resolved"].includes(recovery.status)) return false;
  const rest = [recovery.reasonCode, recovery.failedRequestId, recovery.failedRevision, recovery.checkpointId, recovery.sourceCheckpointRevision, recovery.recoveryAuthorityUserId];
  if (recovery.status === "none") return rest.every((value) => value === null);
  return (recovery.reasonCode === null || nonBlank(recovery.reasonCode))
    && (recovery.failedRequestId === null || nonBlank(recovery.failedRequestId))
    && (recovery.failedRevision === null || safeInteger(recovery.failedRevision))
    && (recovery.checkpointId === null || nonBlank(recovery.checkpointId))
    && (recovery.sourceCheckpointRevision === null || safeInteger(recovery.sourceCheckpointRevision))
    && (recovery.recoveryAuthorityUserId === null || nonBlank(recovery.recoveryAuthorityUserId));
}

function validResponse(response, identity) {
  const fields = ["ok", "requestId", "sessionId", "status", "revision", "authorityEpoch", "projection", "events", "errors", "warnings"];
  return exactKeys(response, fields) && typeof response.ok === "boolean" && response.sessionId === identity.sessionId
    && Array.isArray(response.events) && Array.isArray(response.errors) && Array.isArray(response.warnings);
}

function validProcessedRequests(records, identity, sessionRevision) {
  if (!Array.isArray(records)) return false;
  const ids = new Set();
  for (const record of records) {
    if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || ids.has(record.requestId)
      || !nonBlank(record.principalUserId) || !PROJECTION_KINDS.has(record.projectionKind)
      || !nonBlank(record.commandKind) || !nonBlank(record.resultKind) || !safeInteger(record.resultRevision)
      || record.resultRevision > sessionRevision || !validResponse(record.response, identity)
      || record.response.requestId !== record.requestId) return false;
    let tuple;
    try { tuple = JSON.parse(record.fingerprint); } catch { return false; }
    const captured = capture(tuple);
    if (!captured.ok || !Array.isArray(tuple) || tuple.length !== 7 || JSON.stringify(tuple) !== record.fingerprint
      || tuple[0] !== identity.sessionId || tuple[1] !== record.principalUserId || tuple[2] !== record.projectionKind
      || !safeInteger(tuple[3]) || !safeInteger(tuple[4]) || tuple[5] !== record.commandKind) return false;
    ids.add(record.requestId);
  }
  return true;
}

function validAuditHistory(auditHistory, identity, sessionRevision) {
  if (!Array.isArray(auditHistory)) return false;
  for (let index = 0; index < auditHistory.length; index += 1) {
    const audit = auditHistory[index];
    if (!exactKeys(audit, AUDIT_FIELDS) || !nonBlank(audit.kind) || audit.sessionId !== identity.sessionId
      || (audit.requestId !== null && !nonBlank(audit.requestId)) || (audit.actorUserId !== null && !nonBlank(audit.actorUserId))
      || !safeInteger(audit.authorityEpoch) || !safeInteger(audit.previousRevision) || !safeInteger(audit.revision)
      || audit.revision > sessionRevision || !isPlainObject(audit.details)
      || audit.auditId !== `arcflight-voyage-audit:${JSON.stringify([identity.sessionId, index, audit.kind])}`
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(audit.occurredAt)
      || Number.isNaN(Date.parse(audit.occurredAt))) return false;
    const controlTransfer = audit.kind === "control-transfer";
    if (controlTransfer ? audit.revision !== audit.previousRevision : audit.revision !== audit.previousRevision + 1) return false;
    if (audit.kind === "closeout-review-accepted" && !exactKeys(audit.details, ["applicationId", "closeoutId", "previousSessionState", "nextSessionState"])) return false;
    if (audit.kind === "recovery-rebuilt" && !exactKeys(audit.details, ["recoveryAction", "sourceCheckpointId", "sourceCheckpointRevision", "recoveryAuthorityUserId", "replayedEventCount"])) return false;
  }
  return true;
}

function runtimeEventsHaveAuditRecords(events, auditHistory, identity) {
  const audits = new Map();
  for (const audit of auditHistory) {
    if (["closeout-review-accepted", "recovery-rebuilt"].includes(audit.kind)) {
      const key = JSON.stringify([audit.kind, audit.previousRevision, audit.revision]);
      if (audits.has(key)) return false;
      audits.set(key, audit);
    }
  }
  for (const event of events) {
    const kind = event.type === "voyage.m11-closeout-review-accepted" ? "closeout-review-accepted"
      : event.type === "voyage.m11-recovery-rebuilt" ? "recovery-rebuilt" : null;
    if (!kind) continue;
    const audit = audits.get(JSON.stringify([kind, event.previousRevision, event.revision]));
    if (!audit || audit.sessionId !== identity.sessionId) return false;
  }
  return true;
}

function validCheckpoints(checkpoints, identity, events, sessionRevision, authorityEpoch) {
  if (!Array.isArray(checkpoints)) return false;
  const ids = new Set();
  let lastRevision = -1;
  for (const checkpoint of checkpoints) {
    if (!exactKeys(checkpoint, CHECKPOINT_FIELDS) || !CHECKPOINT_KINDS.has(checkpoint.kind)
      || checkpoint.sessionId !== identity.sessionId || !safeInteger(checkpoint.revision)
      || checkpoint.revision > sessionRevision || checkpoint.revision < lastRevision || !safeInteger(checkpoint.encounterRevision)
      || !safeInteger(checkpoint.eventCount) || checkpoint.eventCount > events.length
      || !SESSION_STATES.has(checkpoint.sessionState) || !safeInteger(checkpoint.authorityEpoch)
      || checkpoint.authorityEpoch > authorityEpoch || typeof checkpoint.invalidated !== "boolean") return false;
    const checkpointId = `arcflight-voyage-checkpoint:${JSON.stringify([identity.sessionId, checkpoint.kind, checkpoint.revision])}`;
    if (checkpoint.checkpointId !== checkpointId || ids.has(checkpoint.checkpointId)
      || !validEncounterState(checkpoint.encounterState, identity)
      || checkpoint.encounterRevision !== checkpoint.encounterState.revision
      || !sessionMappingIsValid(checkpoint.sessionState, checkpoint.encounterState)
      || !validCloseout(checkpoint.closeout, identity)) return false;
    ids.add(checkpoint.checkpointId);
    lastRevision = checkpoint.revision;
  }
  return true;
}

function validateCapturedSession(session, documentId) {
  if (!exactKeys(session, SESSION_FIELDS) || session.schemaVersion !== 1 || session.sessionDocumentId !== documentId
    || ![session.sessionId, session.eventId, session.definitionSnapshotId, session.shipId].every(nonBlank)
    || !safeInteger(session.revision) || !SESSION_STATES.has(session.sessionState) || !safeInteger(session.authorityEpoch)
    || !validEncounterState(session.encounterState, session) || !sessionMappingIsValid(session.sessionState, session.encounterState)
    || !validEvents(session.events, session, session.revision, session.encounterState.revision, session.encounterState.activeHazards)
    || !validCloseout(session.closeout, session) || !validRecovery(session.recovery)
    || !validCheckpoints(session.checkpoints, session, session.events, session.revision, session.authorityEpoch)
    || !validProcessedRequests(session.processedRequests, session, session.revision)
    || !validAuditHistory(session.auditHistory, session, session.revision)
    || !runtimeEventsHaveAuditRecords(session.events, session.auditHistory, session)) return false;
  if (session.sessionState === "event-closeout-review" && session.closeout.status !== "review-required") return false;
  if (session.sessionState === "persistent-application" && ![
    "accepted-for-application", "prepared-awaiting-session", "ship-applied-awaiting-session", "commit-pending", "reconciliation-required"
  ].includes(session.closeout.status)) return false;
  if (session.sessionState === "recovery-required" && session.recovery.status !== "required") return false;
  if (session.recovery.status === "required" && session.sessionState !== "recovery-required") return false;
  const authorityMustBePresent = !["paused", "completed", "aborted", "recovery-required"].includes(session.sessionState);
  return authorityMustBePresent ? nonBlank(session.activeGmUserId)
    : (session.activeGmUserId === null || nonBlank(session.activeGmUserId));
}

function ownData(value, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && descriptor.enumerable === true && Object.hasOwn(descriptor, "value") ? { ok: true, value: descriptor.value } : { ok: false, value: null };
  } catch {
    return { ok: false, value: null };
  }
}

function readDocumentSession(document) {
  try {
    if (document === null || (typeof document !== "object" && typeof document !== "function")) return { ok: false, hostile: true };
    const id = ownData(document, "id");
    const flags = ownData(document, "flags");
    if (!id.ok || !flags.ok || !nonBlank(id.value) || !isPlainObject(flags.value)) return { ok: false, hostile: true };
    const moduleFlags = ownData(flags.value, ARCFLIGHT_MODULE_ID);
    if (!moduleFlags.ok) return { ok: true, session: null, documentId: id.value, document };
    if (!isPlainObject(moduleFlags.value)) return { ok: false, hostile: true };
    const system = ownData(moduleFlags.value, "system");
    if (!system.ok) return { ok: true, session: null, documentId: id.value, document };
    if (!isPlainObject(system.value)) return { ok: false, hostile: true };
    const voyageSession = ownData(system.value, "voyageSession");
    if (!voyageSession.ok) return { ok: true, session: null, documentId: id.value, document };
    if (!isPlainObject(voyageSession.value)) return { ok: false, hostile: true };
    const sessionId = ownData(voyageSession.value, "sessionId");
    if (!sessionId.ok || !nonBlank(sessionId.value)) return { ok: false, hostile: true };
    const captured = capture(voyageSession.value);
    return captured.ok ? { ok: true, session: captured.value, sessionId: sessionId.value, documentId: id.value, document } : { ok: false, hostile: true };
  } catch {
    return { ok: false, hostile: true };
  }
}

function journalDocuments(context) {
  try {
    const supplied = context?.journalEntries;
    const collection = supplied ?? globalThis.game?.journal;
    const contents = Array.isArray(collection) ? collection : collection?.contents;
    if (!Array.isArray(contents)) return { ok: false, documents: [] };
    const captured = capture(contents.map((_, index) => index));
    if (!captured.ok) return { ok: false, documents: [] };
    return { ok: true, documents: [...contents] };
  } catch {
    return { ok: false, documents: [] };
  }
}

function findSessionDocuments(sessionId, context) {
  const journal = journalDocuments(context);
  if (!journal.ok) return { errors: [diagnostic("m11-hostile-data-capture-failed", "$")] };
  const matches = [];
  for (const document of journal.documents) {
    const captured = readDocumentSession(document);
    if (!captured.ok) return { errors: [diagnostic("m11-hostile-data-capture-failed", "$")] };
    if (captured.sessionId === sessionId) matches.push(captured);
  }
  return { matches };
}

function resolveSessionDocument(sessionId, context) {
  const found = findSessionDocuments(sessionId, context);
  if (found.errors) return found;
  const { matches } = found;
  if (matches.length === 0) return { errors: [diagnostic("m11-session-document-not-found", "sessionId")] };
  if (matches.length !== 1) return { errors: [diagnostic("m11-ambiguous-session-document", "sessionId")] };
  return { match: matches[0] };
}

async function cleanupCreatedSessionDocument(document, documentId, sessionId, preexistingDocumentIds, context) {
  try {
    if (!nonBlank(documentId) || preexistingDocumentIds.has(documentId) || !document || typeof document.delete !== "function") return false;
    await document.delete();
    const journal = journalDocuments(context);
    if (!journal.ok) return false;
    const found = findSessionDocuments(sessionId, context);
    if (found.errors || found.matches.length !== 0) return false;
    return !journal.documents.some((candidate) => {
      const captured = readDocumentSession(candidate);
      return captured.ok && captured.documentId === documentId;
    });
  } catch {
    return false;
  }
}

function documentIdForCreation(context) {
  try {
    const generator = context?.createDocumentId ?? globalThis.foundry?.utils?.randomID;
    if (typeof generator === "function") {
      const id = generator();
      return nonBlank(id) ? id : null;
    }
    const uuid = globalThis.crypto?.randomUUID?.();
    return nonBlank(uuid) ? uuid : null;
  } catch {
    return null;
  }
}

function ownershipForGms(context) {
  try {
    const users = context?.users ?? globalThis.game?.users;
    const values = Array.isArray(users) ? users : users?.contents ?? (typeof users?.filter === "function" ? users.filter(() => true) : null);
    if (!Array.isArray(values)) return { ok: false, ownership: null };
    const levels = context?.documentOwnershipLevels ?? globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS ?? { NONE: 0, OWNER: 3 };
    if (typeof levels?.NONE !== "number" || typeof levels?.OWNER !== "number") return { ok: false, ownership: null };
    const entries = [["default", levels.NONE]];
    const ids = new Set();
    for (const user of values) {
      const id = user?.id;
      const isGM = user?.isGM;
      if (typeof isGM !== "boolean" || !nonBlank(id) || (isGM && ids.has(id))) return { ok: false, ownership: null };
      if (isGM) {
        entries.push([id, levels.OWNER]);
        ids.add(id);
      }
    }
    return { ok: true, ownership: Object.fromEntries(entries) };
  } catch {
    return { ok: false, ownership: null };
  }
}

function makeInitialSession(identity, encounter, activeGmUserId) {
  return {
    schemaVersion: 1,
    sessionDocumentId: identity.sessionDocumentId,
    sessionId: identity.sessionId,
    eventId: identity.eventId,
    definitionSnapshotId: identity.definitionSnapshotId,
    shipId: identity.shipId,
    revision: 0,
    sessionState: "setup",
    activeGmUserId,
    authorityEpoch: 0,
    encounterState: encounter,
    events: [],
    checkpoints: [],
    processedRequests: [],
    closeout: {
      status: "none",
      applicationId: null,
      closeoutId: null,
      acceptedApplicationPlan: null,
      reservationId: null,
      expectedEncounterRevision: null,
      expectedShipRevision: null,
      sessionReservationReceipt: null,
      sessionCommitReceipt: null
    },
    recovery: {
      status: "none",
      reasonCode: null,
      failedRequestId: null,
      failedRevision: null,
      checkpointId: null,
      sourceCheckpointRevision: null,
      recoveryAuthorityUserId: null
    },
    auditHistory: []
  };
}

function capturedIdentities(value) {
  return {
    requestId: nonBlank(value?.requestId) ? value.requestId : null,
    sessionId: nonBlank(value?.sessionId) ? value.sessionId : null
  };
}

/**
 * Create the one ordinary JournalEntry owned by an Event Session. The second
 * argument is server-side dependency injection, not a transport field: M12
 * will provide the immutable snapshot resolver when the transport exists.
 */
export async function createVoyageEventSession(request, context = {}) {
  const captured = capture(request);
  if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value;
  const identities = capturedIdentities(value);
  if (!exactKeys(value, CREATE_FIELDS)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  if (value.kind !== "voyage.m11-create-session") return failure([diagnostic("m11-invalid-mode", "request.kind")], identities);
  if (!nonBlank(value.requestId) || ![value.sessionId, value.eventId, value.definitionSnapshotId, value.shipId].every(nonBlank)
    || !isPlainObject(value.eventDefinition) || !isPlainObject(value.initialEncounterState)) {
    return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  }
  const existing = findSessionDocuments(value.sessionId, context);
  if (existing.errors) return failure(existing.errors, identities);
  if (existing.matches.length === 1) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  if (existing.matches.length > 1) return failure([diagnostic("m11-ambiguous-session-document", "sessionId")], identities);
  let resolved;
  try {
    if (typeof context.resolveEventDefinitionSnapshot !== "function" || typeof context.createInitialEncounterState !== "function") {
      return failure([diagnostic("m11-command-payload-invalid", "request.eventDefinition")], identities);
    }
    resolved = await context.resolveEventDefinitionSnapshot(value.eventId, value.definitionSnapshotId);
  } catch {
    return failure([diagnostic("m11-command-payload-invalid", "request.eventDefinition")], identities);
  }
  const capturedDefinition = capture(resolved);
  if (!capturedDefinition.ok || !isPlainObject(capturedDefinition.value)
    || !equal(value.eventDefinition, capturedDefinition.value)) {
    return failure([diagnostic("m11-command-payload-invalid", "request.eventDefinition")], identities);
  }
  let initialEncounter;
  try {
    initialEncounter = await context.createInitialEncounterState({
      eventDefinition: capturedDefinition.value,
      sessionId: value.sessionId,
      eventId: value.eventId,
      definitionSnapshotId: value.definitionSnapshotId,
      shipId: value.shipId
    });
  } catch {
    return failure([diagnostic("m11-command-payload-invalid", "request.initialEncounterState")], identities);
  }
  const capturedEncounter = capture(initialEncounter);
  if (!capturedEncounter.ok || !equal(value.initialEncounterState, capturedEncounter.value)) {
    return failure([diagnostic("m11-command-payload-invalid", "request.initialEncounterState")], identities);
  }
  if (!validEncounterState(capturedEncounter.value, value)
    || capturedEncounter.value.revision !== 0
    || capturedEncounter.value.lifecycleState !== "draft"
    || capturedEncounter.value.phase !== null) {
    return failure([diagnostic("m11-command-payload-invalid", "request.initialEncounterState")], identities);
  }
  const documentId = documentIdForCreation(context);
  const ownership = ownershipForGms(context);
  if (!documentId || !ownership.ok) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  const collectionBeforeCreate = journalDocuments(context);
  if (!collectionBeforeCreate.ok) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  const preexistingDocumentIds = new Set();
  for (const candidate of collectionBeforeCreate.documents) {
    const candidateId = ownData(candidate, "id");
    if (!candidateId.ok || !nonBlank(candidateId.value)) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    preexistingDocumentIds.add(candidateId.value);
  }
  if (preexistingDocumentIds.has(documentId)) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  const activeGmUserId = context.activeGmUserId ?? globalThis.game?.users?.activeGM?.id ?? null;
  const identity = { sessionDocumentId: documentId, sessionId: value.sessionId, eventId: value.eventId, definitionSnapshotId: value.definitionSnapshotId, shipId: value.shipId };
  const session = makeInitialSession(identity, capturedEncounter.value, activeGmUserId);
  if (!validateCapturedSession(session, documentId)) return failure([diagnostic("m11-command-payload-invalid", "request.initialEncounterState")], identities);
  const JournalEntry = context.JournalEntry ?? globalThis.JournalEntry;
  if (typeof JournalEntry?.create !== "function") return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  let document;
  try {
    document = await JournalEntry.create({
      _id: documentId,
      name: "Arcflight Voyage Session",
      ownership: ownership.ownership,
      flags: { [ARCFLIGHT_MODULE_ID]: { system: { voyageSession: session } } }
    });
  } catch {
    return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  }
  const returned = readDocumentSession(document);
  const returnedId = returned.ok ? returned.documentId : ownData(document, "id").value;
  const reread = findSessionDocuments(value.sessionId, context);
  const written = reread.matches?.length === 1 ? reread.matches[0] : null;
  const verified = returned.ok && nonBlank(returnedId) && !preexistingDocumentIds.has(returnedId)
    && returned.documentId === documentId && equal(returned.session, session)
    && written?.document === document && written.documentId === documentId
    && equal(written.session, session) && validateCapturedSession(written.session, documentId);
  if (!verified) {
    const cleaned = await cleanupCreatedSessionDocument(document, returnedId, value.sessionId, preexistingDocumentIds, context);
    if (cleaned) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    throw new Error("M11 Task 1 cannot verify cleanup of the exact JournalEntry created by this invocation.");
  }
  return success(written.session, value.requestId);
}

/**
 * Internal reload boundary for Task 1. It deliberately has no transport,
 * command, projection, or request-id behavior and never writes a document.
 */
export function reloadVoyageEventSession(sessionId, context = {}) {
  const captured = capture(sessionId);
  const identities = { sessionId: captured.ok && nonBlank(captured.value) ? captured.value : null };
  if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")], identities);
  if (!nonBlank(captured.value)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const resolved = resolveSessionDocument(captured.value, context);
  if (resolved.errors) return failure(resolved.errors, identities);
  if (!validateCapturedSession(resolved.match.session, resolved.match.documentId)) {
    return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  }
  return success(resolved.match.session);
}

/** Test-facing, non-mutating validation helper. */
export function validateVoyageEventSession(value, sessionDocumentId) {
  const captured = capture(value);
  return captured.ok && nonBlank(sessionDocumentId) && validateCapturedSession(captured.value, sessionDocumentId);
}
