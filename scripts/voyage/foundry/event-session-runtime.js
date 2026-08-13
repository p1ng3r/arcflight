import { ARCFLIGHT_MODULE_ID } from "../../config/constants.js";
import { validateVoyageEncounterState } from "../domain/validation.js";
import { analyzeVoyageStationAssignments } from "../domain/station-assignments.js";
import {
  applyVoyageEncounterStationActionSelection,
  applyVoyageEncounterStationActionSelectionChange,
  applyVoyageEncounterStationActionSelectionClear
} from "../domain/station-selection.js";
import {
  applyVoyageEncounterStationApproachSelection,
  applyVoyageEncounterStationApproachSelectionChange,
  applyVoyageEncounterStationApproachSelectionClear
} from "../domain/approach-selection.js";
import {
  applyVoyageEncounterRiskBidSelection,
  applyVoyageEncounterRiskBidChange,
  applyVoyageEncounterRiskBidClear
} from "../domain/risk-bids.js";
import {
  applyVoyageEncounterStationOrderProposal,
  applyVoyageEncounterStationOrderProposalChange,
  applyVoyageEncounterStationOrderProposalClear
} from "../domain/station-order-proposal.js";
import { applyVoyageEncounterCrewPlanningLock } from "../domain/crew-planning-lock.js";
import { validateVoyageHazardRecord } from "../domain/hazard-schema.js";
import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../domain/constants.js";
import { analyzeVoyagePressureBreachCloseoutTransaction } from "../domain/pressure-breach.js";
import { validateVoyageEncounterCloseoutSnapshot } from "../domain/closeout.js";
import { analyzeVoyageEncounterCloseoutReview } from "../domain/closeout-review.js";
import {
  persistVoyageEncounterApprovedCloseout,
  continueVoyageEncounterCloseoutReservation,
  verifyVoyageEncounterCloseoutShipCheckpoint,
  finalizeVoyageEncounterCloseoutReceipt
} from "./closeout-persistence.js";

const VOYAGE_SESSION_PATH = `flags.${ARCFLIGHT_MODULE_ID}.system.voyageSession`;
const CREATE_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "eventId", "definitionSnapshotId", "shipId", "eventDefinition", "initialEncounterState"]);
const SESSION_FIELDS = Object.freeze([
  "schemaVersion", "sessionDocumentId", "sessionId", "eventId", "definitionSnapshotId", "shipId", "revision", "sessionState",
  "activeGmUserId", "authorityEpoch", "encounterState", "events", "checkpoints", "processedRequests", "closeout", "recovery", "auditHistory"
]);
const ENCOUNTER_FIELDS = Object.freeze([
  "schemaVersion", "encounterId", "definitionId", "definitionRef", "title", "description", "lifecycleState", "revision", "momentum",
  "currentStage", "roundNumber", "phase", "primaryShip", "currentSituation", "objective", "participants", "availableStations",
  "stationAssignments", "playerVisibleInformation", "gmSecretInformation", "successConditions", "failureConditions", "permanentConsequences",
  "temporaryConsequences", "tracks", "pressureSystems", "thresholdHistory", "pendingThresholdQueue", "selections", "proposedStationOrder",
  "committedStationOrder", "targets", "riskBids", "assistance", "reservations", "pendingChecks", "activeHazards", "pendingConsequences",
  "processedRequestIds", "snapshots", "recovery", "metadata"
]);
const CLOSEOUT_FIELDS = Object.freeze(["status", "applicationId", "closeoutId", "acceptedApplicationPlan", "reservationId", "expectedEncounterRevision", "expectedShipRevision", "sessionReservationReceipt", "sessionCommitReceipt"]);
const RECOVERY_FIELDS = Object.freeze(["status", "reasonCode", "failedRequestId", "failedRevision", "checkpointId", "sourceCheckpointRevision", "recoveryAuthorityUserId"]);
const CHECKPOINT_FIELDS = Object.freeze(["checkpointId", "kind", "sessionId", "revision", "encounterRevision", "eventCount", "sessionState", "encounterState", "closeout", "authorityEpoch", "invalidated"]);
const RECOVERY_REQUEST_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch", "recoveryAction", "reason"]);
const ABORT_REQUEST_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch", "reason", "confirmation"]);
const CORRECTION_REQUEST_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch", "correctionKind", "targetRequestId", "targetCheckpointId", "replacementPayload", "reason", "confirmation"]);
const M11_EVENT_FIELDS = Object.freeze(["type", "sessionId", "eventId", "definitionSnapshotId", "shipId", "sourceCheckpointId", "sourceCheckpointRevision", "recoveryAuthorityUserId", "previousRevision", "revision"]);
const M12_EVENT_FIELDS = Object.freeze(["type", "sessionId", "eventId", "definitionSnapshotId", "shipId", "transitionKind", "previousSessionState", "nextSessionState", "previousEncounterRevision", "encounterRevision", "previousRevision", "revision"]);
const ABORT_EVENT_FIELDS = Object.freeze(["type", "sessionId", "eventId", "definitionSnapshotId", "shipId", "abortScope", "abortAuthorityUserId", "previousRevision", "revision", "previousEncounterRevision", "encounterRevision"]);
const CORRECTION_EVENT_FIELDS = Object.freeze(["type", "sessionId", "eventId", "definitionSnapshotId", "shipId", "correctionKind", "targetRequestId", "correctionAuthorityUserId", "previousRevision", "revision", "previousEncounterRevision", "encounterRevision"]);
const RECOVERY_ABORT_EVENT_FIELDS = Object.freeze(["type", "sessionId", "eventId", "definitionSnapshotId", "shipId", "sourceCheckpointId", "sourceCheckpointRevision", "recoveryAuthorityUserId", "previousRevision", "revision", "previousEncounterRevision", "encounterRevision"]);
const TASK7_ABORT_AUDIT_DETAILS = Object.freeze(["abortScope", "previousSessionState", "nextSessionState", "previousLifecycleState", "nextLifecycleState", "reason"]);
const TASK7_ACTIVE_ABORT_AUDIT_DETAILS = Object.freeze(["abortScope", "previousSessionState", "nextSessionState", "previousLifecycleState", "nextLifecycleState", "reason", "persistentConsequence"]);
const TASK7_CORRECTION_AUDIT_DETAILS = Object.freeze(["correctionKind", "targetRequestId", "previousSessionState", "nextSessionState", "previousEncounterRevision", "encounterRevision", "reason"]);
const TASK7_RECOVERY_ABORT_AUDIT_DETAILS = Object.freeze(["recoveryAction", "sourceCheckpointId", "sourceCheckpointRevision", "recoveryAuthorityUserId", "replayedEventCount", "failedRequestId", "failedRevision", "previousSessionState", "nextSessionState", "previousEncounterRevision", "encounterRevision"]);
const RECOVERY_AUDIT_DETAILS_FIELDS = Object.freeze(["recoveryAction", "sourceCheckpointId", "sourceCheckpointRevision", "recoveryAuthorityUserId", "replayedEventCount", "failedRequestId", "failedRevision"]);
const PROCESSED_REQUEST_FIELDS = Object.freeze(["requestId", "principalUserId", "projectionKind", "fingerprint", "commandKind", "resultKind", "resultRevision", "response"]);
const CREATION_COMMAND_KIND = "create-session";
const TRANSFER_COMMAND_KIND = "control-transfer";
const TRANSFER_RESULT_KIND = "control-transferred";
const RECOVERY_COMMAND_KIND = "recover";
const RECOVERY_RESULT_KIND = "recovered";
const RECOVERY_ACTIONS = new Set(["rebuild-latest", "reconcile-closeout", "abort"]);
const CHECKPOINT_KINDS = new Set(["before-plan-lock", "before-action-segment", "before-reaction", "before-round-closeout", "before-emergency-response", "before-persistent-application", "after-recovery"]);
const SESSION_STATES = new Set(["setup", "round-introduction", "crew-planning", "plan-locked", "station-resolution", "round-closeout", "next-round", "event-closeout-review", "persistent-application", "completed", "paused", "emergency-response", "aborted", "recovery-required"]);
const TRANSFER_REQUEST_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch", "targetUserId", "reason"]);
const READ_PROJECTION_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "expectedRevision"]);
const PROJECTION_FIELDS = Object.freeze([
  "schemaVersion", "sessionId", "eventId", "revision", "sessionState", "currentStage", "roundNumber", "phase",
  "stationAssignments", "committedStationOrder", "currentActingStationId", "momentum", "pressureSystems", "activeHazards",
  "visibleEvents", "closeoutStatus", "recoveryStatus"
]);
const TRANSFER_COORDINATOR_FIELDS = Object.freeze(["sessionId", "sessionDocumentId", "expectedRevision", "expectedAuthorityEpoch", "authenticatedUserId", "connectionId", "activeGmUserId"]);
const TRANSPORT_WITNESS_FIELDS = Object.freeze(["connectionId", "occurredAt"]);
const AUDIT_FIELDS = Object.freeze(["auditId", "kind", "sessionId", "requestId", "actorUserId", "authorityEpoch", "previousRevision", "revision", "occurredAt", "details"]);
const AUDIT_DETAILS_FIELDS = Object.freeze(["previousActiveGmUserId", "nextActiveGmUserId", "bootstrap", "reason"]);
const M12_AUDIT_DETAILS_FIELDS = Object.freeze(["transitionKind", "previousSessionState", "nextSessionState", "previousEncounterRevision", "encounterRevision", "eventCount"]);
const TASK2_COMMANDS = new Set(["station-selection", "station-selection-clear", "station-order", "plan-lock"]);
const TASK2_RESULT_KINDS = Object.freeze({
  "station-selection": "station-selection-applied",
  "station-selection-clear": "station-selection-cleared",
  "station-order": "station-order-applied",
  "plan-lock": "plan-locked"
});
const TASK2_AUDIT_KINDS = Object.freeze({
  "station-selection": "m12-station-selection",
  "station-selection-clear": "m12-station-selection-clear",
  "station-order": "m12-station-order",
  "plan-lock": "m12-plan-lock"
});
const CLOSEOUT_AUDIT_DETAILS_FIELDS = Object.freeze(["applicationId", "closeoutId", "previousSessionState", "nextSessionState"]);
const CLOSEOUT_AUDIT_TRANSITIONS = Object.freeze({
  "closeout-review-accepted": Object.freeze(["event-closeout-review", "persistent-application"]),
  "closeout-session-reserved": Object.freeze(["persistent-application", "persistent-application"]),
  "closeout-session-commit-pending": Object.freeze(["persistent-application", "persistent-application"]),
  "closeout-session-committed": Object.freeze(["persistent-application", "completed"])
});
const M10_COMMIT_EVIDENCE_REQUEST_FIELDS = Object.freeze(["kind", "applicationId", "reservationId", "sessionId", "eventId", "definitionSnapshotId", "shipId", "expectedEncounterRevision"]);
const M10_COMMIT_EVIDENCE_FIELDS = Object.freeze(["ok", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "previousEncounterRevision", "encounterRevision", "completedCloseoutSnapshot", "encounterEvents", "pressureBreachSources", "errors", "warnings"]);
const M10_COMPLETED_SNAPSHOT_FIELDS = Object.freeze(["schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "shipId", "encounterRevision", "shipRevision", "lifecycleState", "stageId", "roundNumber", "phase", "completedRoundHistory", "momentum", "focusPools", "pressureSystems", "activeHazards", "pendingStationBenefitIds", "unconsumedRiskBidBenefitIds", "temporaryFocusPenaltyIds", "roundOrderRestrictions", "hazardSuppressions", "temporaryConsequenceIds"]);
const PRESSURE_EFFECT_FIELDS = Object.freeze(["pressureEffectId", "encounterId", "stageId", "roundNumber", "sequence", "stationId", "actionId", "pressureSystemId", "delta", "timing", "sourceKind", "sourceIntentId", "activationSource", "branch", "visibility"]);
const PRESSURE_SYSTEM_FIELDS = Object.freeze(["pressureSystemId", "value", "capacity"]);
const COMPLETED_HISTORY_FIELDS = Object.freeze(["schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "rounds"]);
const COMPLETED_ROUND_FIELDS = Object.freeze(["roundId", "roundNumber", "roundResult"]);
const FOCUS_FIELDS = Object.freeze(["operatorId", "stationId", "current", "capacity"]);
const RESTRICTION_FIELDS = Object.freeze(["restrictionId", "persistence"]);
const SUPPRESSION_FIELDS = Object.freeze(["suppressionId", "hazardId"]);
const M10_EVENT_FIELDS = Object.freeze({
  "voyage.hazard-closeout-consequence-applied": ["type", "applicationId", "closeoutId", "encounterId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "stageId", "roundNumber", "phase", "hazardId", "consequenceId", "consequenceKind", "pressureSystemId", "pressureEffect", "previousHazard", "disposition", "previousEncounterRevision", "encounterRevision"],
  "voyage.pressure-breach-applied": ["type", "encounterId", "lifecycleState", "stageId", "roundNumber", "phase", "pressureEffectCount", "appliedEffectCount", "breach", "hazard", "collisionOutcome", "voidScarProposal", "pressureReset", "effects", "previousPressureSystems", "pressureSystems", "previousRevision", "revision"],
  "voyage.closeout-applied": ["type", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "overallResult", "proposalIds", "previousEncounterRevision", "encounterRevision", "shipRevision"]
});
const RESPONSE_FIELDS = Object.freeze(["ok", "requestId", "sessionId", "status", "revision", "authorityEpoch", "projection", "events", "errors", "warnings"]);
const transferLocks = new Map();
const COMMAND_KINDS = new Set(["pause", "resume", "station-selection", "station-selection-clear", "station-order", "plan-lock", "action-segment", "reaction", "round-closeout", "emergency-response", "closeout-review", "closeout-prepare", "closeout-reserve", "closeout-ship-apply", "closeout-session-commit"]);
const CLOSEOUT_COMMANDS = new Set(["closeout-review", "closeout-prepare", "closeout-reserve", "closeout-ship-apply", "closeout-session-commit"]);
const FORBIDDEN_PAYLOAD_KEYS = new Set(["principalUserId", "projectionKind", "fingerprint", "result", "resultKind", "resultRevision", "candidate", "event", "response", "receipt", "nextState", "revision", "authorityEpoch", "authenticatedUserId", "connectionId", "clientId", "gmUserId", "isGM", "role", "authority", "approval", "lease", "coordinator", "exclusive", "runExclusiveSessionMutation", "analysis", "outcome"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MESSAGES = Object.freeze({
  hostile: "M11 data could not be captured safely.", shape: "Request shape, order, or root values are invalid.", mode: "The requested M11 API mode is invalid.",
  missing: "Exact Event Session document was not resolved.", ambiguous: "More than one Event Session document matched.", invalid: "Stored Event Session is invalid.",
  write: "Event Session write did not complete or verify.", recovery: "Event Session requires explicit recovery.", payload: "Command payload is invalid.",
  authentication: "Authenticated transport user is required.", activeUnavailable: "No unique active GM is available.", activeRequired: "The authenticated user is not the current active GM.", coordinatorRequired: "A trusted cross-client mutation coordinator is required.",
  targetInvalid: "Control-transfer target must be the unique current active GM.", transferRequired: "Event Session control has transferred.", closeoutNotConfirmed: "Confirmed closeout review is required before persistent application.", closeoutNotAccepted: "Closeout review did not produce one valid application plan.", handoffInvalid: "M10 handoff does not match the Event Session.", reservationNotReady: "Event Session is not ready for M10 reservation.", commitNotReady: "Event Session is not ready for M10 commit.", projectionUnauthorized: "Authenticated user has no Event Session projection role.", abortConfirmation: "Complete abort confirmation is required.", correctionConfirmation: "Complete GM correction confirmation is required.", correctionInvalid: "GM correction cannot be regenerated safely."
});

function diagnostic(code, path) {
  const messages = {
    "m11-hostile-data-capture-failed": MESSAGES.hostile, "m11-invalid-request-shape": MESSAGES.shape, "m11-invalid-mode": MESSAGES.mode,
    "m11-session-document-not-found": MESSAGES.missing, "m11-ambiguous-session-document": MESSAGES.ambiguous, "m11-invalid-session-document": MESSAGES.invalid,
    "m11-session-write-failed": MESSAGES.write, "m11-recovery-required": MESSAGES.recovery, "m11-command-payload-invalid": MESSAGES.payload,
    "m11-request-id-required": "A unique request ID is required.", "m11-request-id-conflict": "Request ID was previously used with different data.",
    "m11-control-transfer-required": MESSAGES.transferRequired, "m11-control-transfer-target-invalid": MESSAGES.targetInvalid, "m11-cross-client-coordinator-required": MESSAGES.coordinatorRequired, "m11-stale-session-revision": "Event Session revision is stale.",
    "m11-command-not-allowed": "Command is not allowed in the current session state.", "m11-closeout-review-not-confirmed": MESSAGES.closeoutNotConfirmed, "m11-closeout-review-not-accepted": MESSAGES.closeoutNotAccepted, "m11-m10-handoff-invalid": MESSAGES.handoffInvalid, "m11-reservation-not-ready": MESSAGES.reservationNotReady, "m11-commit-not-ready": MESSAGES.commitNotReady, "m11-projection-not-authorized": MESSAGES.projectionUnauthorized,
    "m11-checkpoint-required": "Required Event Session checkpoint is missing.", "m11-checkpoint-mismatch": "Event Session checkpoint does not match current state.",
    "m11-unrecoverable-session": "Immutable Event Session recovery evidence is invalid.", "m11-abort-confirmation-required": MESSAGES.abortConfirmation, "m11-correction-confirmation-required": MESSAGES.correctionConfirmation, "m11-correction-invalid": MESSAGES.correctionInvalid,
    "m11-authentication-required": MESSAGES.authentication, "m11-active-gm-unavailable": MESSAGES.activeUnavailable, "m11-active-gm-required": MESSAGES.activeRequired
  };
  return { code, path, message: messages[code] ?? "M11 data is invalid.", severity: "error" };
}

function failure(errors, identities = {}) {
  return { ok: false, requestId: identities.requestId ?? null, sessionId: identities.sessionId ?? null, status: "failed", revision: null, authorityEpoch: null, projection: null, events: [], errors, warnings: [] };
}

function revision0Failure(code, path, identities, details) {
  const issue = diagnostic(code, path);
  if (details) {
    const copy = (value) => {
      const captured = capture(value);
      return captured.ok ? captured.value : null;
    };
    issue.diagnostic = {
      revision0Stage: details.revision0Stage ?? null,
      sessionId: details.sessionId ?? null,
      documentId: details.documentId ?? null,
      createdDocumentId: details.createdDocumentId ?? null,
      rereadDocumentId: details.rereadDocumentId ?? null,
      candidateRevision: details.candidateRevision ?? null,
      persistedRevision: details.persistedRevision ?? null,
      persistedSessionPresent: details.persistedSessionPresent ?? null,
      firstDifferencePath: details.firstDifferencePath ?? null,
      expectedValue: copy(details.expectedValue),
      actualValue: copy(details.actualValue),
      createErrorName: details.createErrorName ?? null,
      createErrorMessage: details.createErrorMessage ?? null,
      createErrorCode: details.createErrorCode ?? null,
      createErrorCauseMessage: details.createErrorCauseMessage ?? null,
      createErrorStack: details.createErrorStack ?? null
    };
  }
  return failure([issue], identities);
}

function success(session, requestId = null, authorityEpoch = session.authorityEpoch) {
  return { ok: true, requestId, sessionId: session.sessionId, status: session.sessionState, revision: session.revision, authorityEpoch, projection: null, events: [], errors: [], warnings: [] };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try { const prototype = Object.getPrototypeOf(value); return prototype === Object.prototype || prototype === null; } catch { return false; }
}

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
          const nested = capture(descriptor.value, ancestors); if (!nested.ok) return nested; output[index] = nested.value;
        }
        for (const key of keys) if (key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) return { ok: false, value: null };
        return { ok: true, value: output };
      }
      const output = {};
      for (const key of keys) {
        if (typeof key !== "string" || UNSAFE_KEYS.has(key)) return { ok: false, value: null };
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, value: null };
        const nested = capture(descriptor.value, ancestors); if (!nested.ok) return nested; output[key] = nested.value;
      }
      return { ok: true, value: output };
    } finally { ancestors.delete(value); }
  } catch { return { ok: false, value: null }; }
}

function exactKeys(value, fields) { return isPlainObject(value) && Object.keys(value).length === fields.length && Object.keys(value).every((key, index) => key === fields[index]); }
function equal(left, right) {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => equal(entry, right[index]));
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]));
}
function firstCanonicalDifference(expected, actual, path = VOYAGE_SESSION_PATH) {
  try {
    if (Object.is(expected, actual)) return null;
    if (typeof expected !== typeof actual || expected === null || actual === null) {
      const kind = (value) => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
      return { path, expected: kind(expected), actual: kind(actual) };
    }
    if (Array.isArray(expected) || Array.isArray(actual)) {
      if (!Array.isArray(expected) || !Array.isArray(actual)) return { path, expected: Array.isArray(expected) ? "array" : typeof expected, actual: Array.isArray(actual) ? "array" : typeof actual };
      if (expected.length !== actual.length) return { path: `${path}.length`, expected: expected.length, actual: actual.length };
      for (let index = 0; index < expected.length; index += 1) {
        const difference = firstCanonicalDifference(expected[index], actual[index], `${path}[${index}]`);
        if (difference) return difference;
      }
      return null;
    }
    if (typeof expected !== "object") return { path, expected, actual };
    const expectedKeys = Object.keys(expected), actualKeys = Object.keys(actual);
    if (expectedKeys.length !== actualKeys.length) return { path: `${path}.keys.length`, expected: expectedKeys.length, actual: actualKeys.length };
    for (let index = 0; index < expectedKeys.length; index += 1) {
      if (expectedKeys[index] !== actualKeys[index]) return { path: `${path}.${expectedKeys[index] ?? actualKeys[index]}`, expected: expectedKeys[index] ?? null, actual: actualKeys[index] ?? null };
      const difference = firstCanonicalDifference(expected[expectedKeys[index]], actual[actualKeys[index]], `${path}.${expectedKeys[index]}`);
      if (difference) return difference;
    }
    return null;
  } catch { return { path, expected: null, actual: null }; }
}
function nonBlank(value) { return typeof value === "string" && value.length > 0 && value.trim() === value; }
function safeInteger(value) { return Number.isSafeInteger(value) && value >= 0; }
function ownData(value, key) {
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); return descriptor && descriptor.enumerable && Object.hasOwn(descriptor, "value") ? { ok: true, value: descriptor.value } : { ok: false, value: null }; } catch { return { ok: false, value: null }; }
}

function primaryShipMatches(primaryShip, shipId) { return isPlainObject(primaryShip) && [primaryShip.id, primaryShip.shipId, primaryShip.actorId].includes(shipId); }
function validEncounterState(encounter, identity) {
  return exactKeys(encounter, ENCOUNTER_FIELDS) && validateVoyageEncounterState(encounter).valid && encounter.schemaVersion === 1
    && encounter.encounterId === identity.eventId && encounter.definitionId === identity.eventId && safeInteger(encounter.revision) && primaryShipMatches(encounter.primaryShip, identity.shipId);
}
function containsForbiddenPayloadAuthority(value, ancestors = new Set()) {
  if (value === null || typeof value !== "object" || ancestors.has(value)) return false;
  ancestors.add(value);
  try {
    for (const key of Object.keys(value)) if (FORBIDDEN_PAYLOAD_KEYS.has(key) || containsForbiddenPayloadAuthority(value[key], ancestors)) return true;
    return false;
  } finally { ancestors.delete(value); }
}
function validCreationDefinition(value, session) {
  if (!isPlainObject(value)) return false;
  for (const [key, expected] of [["sessionId", session.sessionId], ["eventId", session.eventId], ["definitionSnapshotId", session.definitionSnapshotId], ["shipId", session.shipId]]) {
    if (Object.hasOwn(value, key) && value[key] !== expected) return false;
  }
  return true;
}
function validCreationRecord(record, session, initialGmUserId) {
  if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || !nonBlank(record.principalUserId) || !nonBlank(initialGmUserId)
    || record.principalUserId !== initialGmUserId || record.projectionKind !== "gm" || record.commandKind !== CREATION_COMMAND_KIND
    || record.resultKind !== "created" || record.resultRevision !== 0 || !isPlainObject(record.response) || typeof record.fingerprint !== "string") return false;
  const parsed = parseStoredFingerprint(record.fingerprint); if (!parsed.ok) return false;
  const tuple = parsed.value;
  if (tuple[0] !== session.sessionId || tuple[1] !== record.principalUserId || tuple[2] !== "gm" || tuple[3] !== 0 || tuple[4] !== 0 || tuple[5] !== CREATION_COMMAND_KIND
    || !exactKeys(tuple[6], ["eventId", "definitionSnapshotId", "shipId", "eventDefinition", "initialEncounterState"])
    || tuple[6].eventId !== session.eventId || tuple[6].definitionSnapshotId !== session.definitionSnapshotId || tuple[6].shipId !== session.shipId
    || (session.revision === 0 && !equal(tuple[6].initialEncounterState, session.encounterState)) || !validCreationDefinition(tuple[6].eventDefinition, session)) return false;
  const expectedResponse = { ok: true, requestId: record.requestId, sessionId: session.sessionId, status: "setup", revision: 0, authorityEpoch: 0, projection: null, events: [], errors: [], warnings: [] };
  return validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) && equal(record.response, expectedResponse);
}

function parseStoredFingerprint(value) {
  if (typeof value !== "string") return { ok: false, value: null };
  try {
    const parsed = JSON.parse(value);
    const captured = capture(parsed);
    if (!captured.ok || !Array.isArray(captured.value) || captured.value.length !== 7) return { ok: false, value: null };
    if (JSON.stringify(captured.value) !== value) return { ok: false, value: null };
    return { ok: true, value: captured.value };
  } catch { return { ok: false, value: null }; }
}
function validIsoTimestamp(value) {
  try { return typeof value === "string" && nonBlank(value) && new Date(value).toISOString() === value; } catch { return false; }
}
function auditId(sessionId, index, kind) { return `arcflight-voyage-audit:${JSON.stringify([sessionId, index, kind])}`; }
function validAudit(record, session, auditIndex, authorityEpoch, revision, request, previousGm, nextGm, bootstrap) {
  return exactKeys(record, AUDIT_FIELDS) && record.auditId === auditId(session.sessionId, auditIndex, record.kind)
    && (record.kind === "control-transfer" || record.kind === "control-transfer-bootstrap")
    && record.sessionId === session.sessionId && record.requestId === request.requestId
    && nonBlank(record.actorUserId) && record.actorUserId === request.principalUserId && safeInteger(record.authorityEpoch) && record.authorityEpoch === authorityEpoch
    && safeInteger(record.previousRevision) && safeInteger(record.revision) && record.previousRevision === revision && record.revision === revision && validIsoTimestamp(record.occurredAt)
    && (nonBlank(previousGm) || (previousGm === null && bootstrap === true)) && nonBlank(nextGm) && exactKeys(record.details, AUDIT_DETAILS_FIELDS) && record.details.previousActiveGmUserId === previousGm
    && record.details.nextActiveGmUserId === nextGm && record.details.bootstrap === bootstrap && nonBlank(record.details.reason)
    && record.details.reason === request.reason && record.kind === (bootstrap ? "control-transfer-bootstrap" : "control-transfer");
}
function validTransferRecord(record, session, authorityEpoch, audit, previousGm) {
  if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || record.projectionKind !== "gm"
    || record.commandKind !== TRANSFER_COMMAND_KIND || record.resultKind !== TRANSFER_RESULT_KIND || !safeInteger(record.resultRevision)
    || !isPlainObject(record.response) || typeof record.fingerprint !== "string") return false;
  const parsed = parseStoredFingerprint(record.fingerprint); if (!parsed.ok) return false;
  const tuple = parsed.value;
  if (tuple[0] !== session.sessionId || tuple[1] !== record.principalUserId || tuple[2] !== "gm" || !safeInteger(tuple[3]) || !safeInteger(tuple[4]) || tuple[3] !== authorityEpoch || tuple[4] !== record.resultRevision || tuple[4] > session.revision || tuple[5] !== TRANSFER_COMMAND_KIND
    || !exactKeys(tuple[6], ["targetUserId", "reason"]) || !nonBlank(tuple[6].targetUserId) || !nonBlank(tuple[6].reason)) return false;
  const nextGm = tuple[6].targetUserId, bootstrap = previousGm !== nextGm;
  const auditIndex = session.auditHistory.indexOf(audit);
  return validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch)
    && record.response.authorityEpoch === authorityEpoch + 1
    && record.response.events.length === 0
    && validAudit(audit, session, auditIndex, authorityEpoch + 1, record.resultRevision, { ...record, reason: tuple[6].reason }, previousGm, nextGm, bootstrap);
}
function validCloseout(closeout, session = null) {
  if (!exactKeys(closeout, CLOSEOUT_FIELDS) || !new Set(["none", "review-required", "accepted-for-application", "prepared-awaiting-session", "ship-applied-awaiting-session", "commit-pending", "committed", "reconciliation-required"]).has(closeout.status)) return false;
  if (closeout.status === "none") return Object.keys(closeout).slice(1).every((key) => closeout[key] === null);
  if (closeout.status === "accepted-for-application") return nonBlank(closeout.applicationId) && nonBlank(closeout.closeoutId) && exactKeys(closeout.acceptedApplicationPlan, ["previewRequest", "reviewRequest", "applicationPlan"])
    && safeInteger(closeout.expectedEncounterRevision) && safeInteger(closeout.expectedShipRevision)
    && closeout.reservationId === null && closeout.sessionReservationReceipt === null && closeout.sessionCommitReceipt === null;
  if (closeout.status === "prepared-awaiting-session") return nonBlank(closeout.applicationId) && nonBlank(closeout.closeoutId) && exactKeys(closeout.acceptedApplicationPlan, ["previewRequest", "reviewRequest", "applicationPlan"])
    && safeInteger(closeout.expectedEncounterRevision) && safeInteger(closeout.expectedShipRevision) && closeout.reservationId === null && closeout.sessionReservationReceipt === null && closeout.sessionCommitReceipt === null;
  if (closeout.status === "ship-applied-awaiting-session") return nonBlank(closeout.applicationId) && nonBlank(closeout.closeoutId) && exactKeys(closeout.acceptedApplicationPlan, ["previewRequest", "reviewRequest", "applicationPlan"])
    && nonBlank(closeout.reservationId) && safeInteger(closeout.expectedEncounterRevision) && safeInteger(closeout.expectedShipRevision)
    && exactReservationReceipt(closeout.sessionReservationReceipt, closeout, session) && closeout.sessionCommitReceipt === null;
  if (closeout.status === "commit-pending") return nonBlank(closeout.applicationId) && nonBlank(closeout.closeoutId) && exactKeys(closeout.acceptedApplicationPlan, ["previewRequest", "reviewRequest", "applicationPlan"])
    && nonBlank(closeout.reservationId) && safeInteger(closeout.expectedEncounterRevision) && safeInteger(closeout.expectedShipRevision)
    && exactReservationReceipt(closeout.sessionReservationReceipt, closeout, session) && exactCommitReceipt(closeout.sessionCommitReceipt, closeout, session);
  if (closeout.status === "committed") return nonBlank(closeout.applicationId) && nonBlank(closeout.closeoutId) && exactKeys(closeout.acceptedApplicationPlan, ["previewRequest", "reviewRequest", "applicationPlan"])
    && nonBlank(closeout.reservationId) && safeInteger(closeout.expectedEncounterRevision) && safeInteger(closeout.expectedShipRevision)
    && exactReservationReceipt(closeout.sessionReservationReceipt, closeout, session) && exactCommitReceipt(closeout.sessionCommitReceipt, closeout, session);
  if (closeout.status === "reconciliation-required") return nonBlank(closeout.applicationId) && nonBlank(closeout.closeoutId) && exactKeys(closeout.acceptedApplicationPlan, ["previewRequest", "reviewRequest", "applicationPlan"])
    && (closeout.reservationId === null || nonBlank(closeout.reservationId)) && safeInteger(closeout.expectedEncounterRevision) && safeInteger(closeout.expectedShipRevision)
    && (closeout.sessionReservationReceipt === null || exactReservationReceipt(closeout.sessionReservationReceipt, closeout, session))
    && (closeout.sessionCommitReceipt === null || exactCommitReceipt(closeout.sessionCommitReceipt, closeout, session));
  return closeout.status === "review-required" && closeout.applicationId === null && closeout.closeoutId === null && closeout.acceptedApplicationPlan === null
    && closeout.reservationId === null && closeout.expectedEncounterRevision === null && closeout.expectedShipRevision === null && closeout.sessionReservationReceipt === null && closeout.sessionCommitReceipt === null;
}
function validStoredCloseoutPlan(closeout, session) {
  if (!closeout || closeout.status === "none" || closeout.status === "review-required") return true;
  const evidence = closeout.acceptedApplicationPlan;
  if (!exactKeys(evidence, ["previewRequest", "reviewRequest", "applicationPlan"]) || !isPlainObject(evidence.previewRequest) || !isPlainObject(evidence.suppliedPreview ?? evidence.reviewRequest?.suppliedPreview)
    || !exactKeys(evidence.reviewRequest, ["kind", "sessionId", "gmUserId", "confirmed", "previewRequest", "suppliedPreview"]) || evidence.reviewRequest.confirmed !== true
    || !isPlainObject(evidence.reviewRequest.previewRequest) || !isPlainObject(evidence.reviewRequest.suppliedPreview) || !equal(evidence.previewRequest, evidence.reviewRequest.previewRequest)) return false;
  const plan = evidence.applicationPlan;
  if (!(exactKeys(plan, ["schemaVersion", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "expectedEncounterRevision", "expectedShipRevision", "gmUserId", "persistentProposals", "temporaryResetPlan", "expectedPreview"])
    && plan.schemaVersion === 1 && plan.applicationId === `arcflight-closeout-application:${JSON.stringify([plan.closeoutId])}` && plan.applicationId === closeout.applicationId && plan.closeoutId === closeout.closeoutId && plan.eventId === session.eventId && plan.sessionId === session.sessionId && plan.definitionSnapshotId === session.definitionSnapshotId && plan.shipId === session.shipId && safeInteger(plan.expectedEncounterRevision) && plan.expectedEncounterRevision <= session.encounterState.revision && safeInteger(plan.expectedShipRevision) && plan.expectedEncounterRevision === closeout.expectedEncounterRevision && plan.expectedShipRevision === closeout.expectedShipRevision && evidence.reviewRequest.sessionId === session.sessionId && evidence.reviewRequest.kind === "m10-closeout-review" && evidence.reviewRequest.gmUserId === plan.gmUserId && nonBlank(plan.gmUserId) && Array.isArray(plan.persistentProposals) && isPlainObject(plan.temporaryResetPlan) && isPlainObject(plan.expectedPreview))) return false;
  try {
    const regenerated = analyzeVoyageEncounterCloseoutReview(evidence.reviewRequest);
    return validCloseoutReviewResult(regenerated) && regenerated.closeoutId === plan.closeoutId && equal(regenerated.applicationPlan, plan);
  } catch { return false; }
}

const RESERVATION_RECEIPT_FIELDS = Object.freeze(["kind", "reservationId", "activeGmUserId", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "expectedEncounterRevision", "pressureBreachSources"]);
const COMMIT_RECEIPT_FIELDS = Object.freeze(["kind", "reservationId", "activeGmUserId", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "previousEncounterRevision", "encounterRevision", "completedCloseoutSnapshot", "encounterEvents", "pressureBreachSources"]);
function validPressureSystemsMap(value) {
  if (!isPlainObject(value) || Object.keys(value).length !== VOYAGE_PRESSURE_SYSTEM_IDS.length || !VOYAGE_PRESSURE_SYSTEM_IDS.every((id) => Object.hasOwn(value, id))) return false;
  return VOYAGE_PRESSURE_SYSTEM_IDS.every((id) => exactKeys(value[id], PRESSURE_SYSTEM_FIELDS) && value[id].pressureSystemId === id && safeInteger(value[id].value) && safeInteger(value[id].capacity));
}
function validPressureEffect(value, session, source) {
  return exactKeys(value, PRESSURE_EFFECT_FIELDS) && value.encounterId === session.eventId && value.stageId === source.stageId && value.roundNumber === source.roundNumber
    && value.sourceKind === "hazard-closeout" && value.timing === "gm-confirmed" && value.activationSource === "event-closeout" && value.branch === "no-roll"
    && value.stationId === null && value.actionId === null && nonBlank(value.pressureEffectId) && nonBlank(value.sourceIntentId) && VOYAGE_PRESSURE_SYSTEM_IDS.includes(value.pressureSystemId)
    && safeInteger(value.roundNumber) && safeInteger(value.sequence) && Number.isSafeInteger(value.delta) && value.delta > 0;
}
function validPressureSourceShape(source, session, index = null) {
  if (!exactKeys(source, ["breachEventIndex", "sourceHazardId", "expectedEncounterRevision", "closeoutContext", "pressureSystems", "activeHazards", "pressureEffect"]) || !nonBlank(source.sourceHazardId)
    || !safeInteger(source.breachEventIndex) || (index !== null && source.breachEventIndex !== index) || !safeInteger(source.expectedEncounterRevision)
    || !exactKeys(source.closeoutContext, ["eventId", "sessionId", "stageId", "roundNumber", "phase"])
    || source.closeoutContext.eventId !== session.eventId || source.closeoutContext.sessionId !== session.sessionId || !nonBlank(source.closeoutContext.stageId)
    || !safeInteger(source.closeoutContext.roundNumber) || source.closeoutContext.phase !== "cleanup-advance" || !validPressureSystemsMap(source.pressureSystems)
    || !Array.isArray(source.activeHazards) || !isPlainObject(source.pressureEffect)) return false;
  return source.activeHazards.every((hazard) => validateVoyageHazardRecord(hazard, { mode: "snapshot", expectedEncounterId: session.eventId }).valid)
    && validPressureEffect(source.pressureEffect, session, source.closeoutContext);
}
function canonicalPressureSources(session) {
  try {
    const breaches = session.events.filter((event) => event?.type === "voyage.pressure-breach-applied");
    return breaches.map((event, breachEventIndex) => {
      const position = session.events.indexOf(event), preceding = session.events[position - 1];
      if (!preceding || preceding.type !== "voyage.hazard-closeout-consequence-applied") return null;
      const activeHazards = [];
      for (let index = position + 1; index < session.events.length; index += 1) {
        const later = session.events[index];
        if (later?.type !== "voyage.hazard-closeout-consequence-applied" || activeHazards.some((hazard) => hazard.hazardId === later.hazardId)) continue;
        const capturedHazard = capture(later.previousHazard);
        if (!capturedHazard.ok) return null;
        activeHazards.push(capturedHazard.value);
      }
      const pressureSystems = capture(event.previousPressureSystems), pressureEffect = capture(preceding.pressureEffect);
      if (!pressureSystems.ok || !pressureEffect.ok) return null;
      return {
        breachEventIndex,
        sourceHazardId: preceding.hazardId,
        expectedEncounterRevision: event.previousRevision,
        closeoutContext: { eventId: session.eventId, sessionId: session.sessionId, stageId: preceding.stageId, roundNumber: preceding.roundNumber, phase: preceding.phase },
        pressureSystems: pressureSystems.value,
        activeHazards,
        pressureEffect: pressureEffect.value
      };
    });
  } catch { return null; }
}
function validPressureSources(sources, session) {
  const canonical = canonicalPressureSources(session);
  return Array.isArray(sources) && Array.isArray(canonical) && sources.length === canonical.length
    && sources.every((source, index) => validPressureSourceShape(source, session, index) && canonical[index] !== null && equal(source, canonical[index]));
}
function validCanonicalPressureBreachEvent(event, session, sourceOverride = null) {
  try {
    if (!isPlainObject(event) || event.type !== "voyage.pressure-breach-applied" || !exactKeys(event, M10_EVENT_FIELDS[event.type])
      || event.encounterId !== session.eventId || event.lifecycleState !== "active" || !nonBlank(event.stageId) || !safeInteger(event.roundNumber)
      || event.phase !== "cleanup-advance" || event.pressureEffectCount !== 1 || event.appliedEffectCount !== 1 || !safeInteger(event.previousRevision) || !safeInteger(event.revision)
      || event.revision !== event.previousRevision + 1 || !validPressureSystemsMap(event.previousPressureSystems) || !validPressureSystemsMap(event.pressureSystems)
      || !Array.isArray(event.effects) || event.effects.length !== 1 || !isPlainObject(event.breach) || !isPlainObject(event.hazard) || !isPlainObject(event.voidScarProposal)
      || !isPlainObject(event.pressureReset) || event.pressureReset.resetValue !== 0 || !VOYAGE_PRESSURE_SYSTEM_IDS.includes(event.pressureReset.pressureSystemId)) return false;
    const sources = canonicalPressureSources(session), breachEvents = session.events.filter((candidate) => candidate?.type === "voyage.pressure-breach-applied");
    const index = breachEvents.findIndex((candidate) => candidate === event || (candidate.revision === event.revision && equal(candidate, event)));
    const source = sourceOverride ?? (index >= 0 ? sources[index] : null);
    if (source === null) return false;
    const result = analyzeVoyagePressureBreachCloseoutTransaction({
      expectedEncounterRevision: event.previousRevision,
      closeoutContext: { eventId: event.encounterId, sessionId: session.sessionId, stageId: event.stageId, roundNumber: event.roundNumber, phase: event.phase },
      pressureSystems: Object.values(source.pressureSystems),
      activeHazards: event.collisionOutcome === null ? [] : source.activeHazards,
      pressureEffect: source.pressureEffect
    });
    return result?.ok === true && result.breachRequired === true && equal(result.event, event);
  } catch { return false; }
}
function validReceiptPressureSources(sources, session, events) {
  if (!Array.isArray(sources) || !Array.isArray(events)) return false;
  const breachEvents = events.filter((event) => event?.type === "voyage.pressure-breach-applied");
  if (sources.length !== breachEvents.length) return false;
  return sources.every((source, index) => {
    const event = breachEvents[index], eventPosition = events.indexOf(event), preceding = eventPosition > 0 ? events[eventPosition - 1] : null;
    if (!validPressureSourceShape(source, session, index) || !preceding || preceding.type !== "voyage.hazard-closeout-consequence-applied"
      || source.sourceHazardId !== preceding.hazardId || source.expectedEncounterRevision !== event.previousRevision
      || preceding.encounterRevision !== event.previousRevision || source.closeoutContext.stageId !== preceding.stageId
      || source.closeoutContext.roundNumber !== preceding.roundNumber || !equal(source.pressureSystems, event.previousPressureSystems)
      || !equal(source.pressureEffect, preceding.pressureEffect)) return false;
    const laterHazards = [];
    for (let position = eventPosition + 1; position < events.length; position += 1) {
      const later = events[position];
      if (later?.type === "voyage.hazard-closeout-consequence-applied" && !laterHazards.some((hazard) => hazard.hazardId === later.hazardId)) laterHazards.push(later.previousHazard);
    }
    return equal(source.activeHazards, laterHazards) && validCanonicalPressureBreachEvent(event, session, source);
  });
}
function validHazardCloseoutEvent(event, session, applicationId, closeoutId) {
  if (!(event.applicationId === applicationId && event.closeoutId === closeoutId && event.encounterId === session.eventId && event.eventId === session.eventId
    && event.sessionId === session.sessionId && event.definitionSnapshotId === session.definitionSnapshotId && event.shipId === session.shipId
    && nonBlank(event.stageId) && safeInteger(event.roundNumber) && event.phase === "cleanup-advance" && nonBlank(event.hazardId) && nonBlank(event.consequenceId)
    && ["pressure-change", "persistent-consequence"].includes(event.consequenceKind) && event.disposition === "removed" && safeInteger(event.previousEncounterRevision)
    && safeInteger(event.encounterRevision) && event.encounterRevision === event.previousEncounterRevision + 1 && validateVoyageHazardRecord(event.previousHazard, { mode: "snapshot", expectedEncounterId: session.eventId }).valid
    && event.previousHazard.hazardId === event.hazardId && event.previousHazard.ignoredConsequence?.consequenceId === event.consequenceId
    && event.previousHazard.ignoredConsequence?.kind === event.consequenceKind)) return false;
  if (event.consequenceKind === "persistent-consequence") return event.pressureSystemId === null && event.pressureEffect === null && event.previousHazard.ignoredConsequence.pressureSystemId === null;
  const consequence = event.previousHazard.ignoredConsequence, effect = event.pressureEffect;
  return VOYAGE_PRESSURE_SYSTEM_IDS.includes(event.pressureSystemId) && consequence.pressureSystemId === event.pressureSystemId && safeInteger(consequence.delta)
    && isPlainObject(effect) && validPressureEffect(effect, session, { stageId: event.stageId, roundNumber: event.roundNumber })
    && effect.pressureSystemId === event.pressureSystemId && effect.sourceIntentId === event.consequenceId && effect.delta === consequence.delta
    && effect.visibility === event.previousHazard.visibility
    && effect.pressureEffectId === `arcflight-pressure-effect:${JSON.stringify(["hazard-closeout", session.eventId, session.sessionId, event.stageId, event.roundNumber, event.hazardId, event.consequenceId, effect.sequence, effect.pressureSystemId])}`;
}
function validM10CommitEvent(event, session, applicationId, closeoutId, pressureSource = null) {
  if (!isPlainObject(event) || !M10_EVENT_FIELDS[event.type] || !exactKeys(event, M10_EVENT_FIELDS[event.type])) return false;
  if (event.type === "voyage.closeout-applied") return event.applicationId === applicationId && event.closeoutId === closeoutId && event.eventId === session.eventId && event.sessionId === session.sessionId && event.definitionSnapshotId === session.definitionSnapshotId && event.shipId === session.shipId && ["overall-success", "overall-failure"].includes(event.overallResult) && Array.isArray(event.proposalIds) && event.proposalIds.every(nonBlank) && new Set(event.proposalIds).size === event.proposalIds.length && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision) && event.encounterRevision === event.previousEncounterRevision + 1 && safeInteger(event.shipRevision);
  if (event.type === "voyage.hazard-closeout-consequence-applied") return validHazardCloseoutEvent(event, session, applicationId, closeoutId);
  return validCanonicalPressureBreachEvent(event, session, pressureSource);
}
function validCompletedSnapshotShape(snapshot, session) {
  if (!exactKeys(snapshot, M10_COMPLETED_SNAPSHOT_FIELDS) || snapshot.schemaVersion !== 1 || snapshot.eventId !== session.eventId || snapshot.sessionId !== session.sessionId
    || snapshot.definitionSnapshotId !== session.definitionSnapshotId || snapshot.shipId !== session.shipId || !safeInteger(snapshot.encounterRevision) || !safeInteger(snapshot.shipRevision)
      || !["completed-success", "completed-failure"].includes(snapshot.lifecycleState) || !nonBlank(snapshot.stageId) || !safeInteger(snapshot.roundNumber) || snapshot.phase !== "cleanup-advance"
    || !exactKeys(snapshot.completedRoundHistory, COMPLETED_HISTORY_FIELDS) || snapshot.completedRoundHistory.schemaVersion !== 1 || snapshot.completedRoundHistory.eventId !== session.eventId || snapshot.completedRoundHistory.sessionId !== session.sessionId || snapshot.completedRoundHistory.definitionSnapshotId !== session.definitionSnapshotId || !safeInteger(snapshot.completedRoundHistory.roundCount) || !Array.isArray(snapshot.completedRoundHistory.rounds)
    || !Array.isArray(snapshot.focusPools) || !Array.isArray(snapshot.pressureSystems) || !Array.isArray(snapshot.activeHazards)
    || !Array.isArray(snapshot.pendingStationBenefitIds) || !Array.isArray(snapshot.unconsumedRiskBidBenefitIds) || !Array.isArray(snapshot.temporaryFocusPenaltyIds)
    || !Array.isArray(snapshot.roundOrderRestrictions) || !Array.isArray(snapshot.hazardSuppressions) || !Array.isArray(snapshot.temporaryConsequenceIds)) return false;
  const domainSnapshot = snapshot.lifecycleState.startsWith("completed-") ? { ...snapshot, lifecycleState: "active" } : snapshot;
  if (validateVoyageEncounterCloseoutSnapshot(domainSnapshot).valid !== true) return false;
  return snapshot.completedRoundHistory.rounds.every((round) => exactKeys(round, COMPLETED_ROUND_FIELDS) && nonBlank(round.roundId) && safeInteger(round.roundNumber) && ["critical-round-failure", "round-failure", "round-success", "critical-round-success"].includes(round.roundResult))
     && snapshot.completedRoundHistory.roundCount === snapshot.completedRoundHistory.rounds.length
     && snapshot.focusPools.every((pool) => exactKeys(pool, FOCUS_FIELDS) && nonBlank(pool.operatorId) && nonBlank(pool.stationId) && safeInteger(pool.current) && safeInteger(pool.capacity))
    && snapshot.pressureSystems.every((system) => exactKeys(system, PRESSURE_SYSTEM_FIELDS) && VOYAGE_PRESSURE_SYSTEM_IDS.includes(system.pressureSystemId) && safeInteger(system.value) && safeInteger(system.capacity))
    && snapshot.activeHazards.every((hazard) => validateVoyageHazardRecord(hazard, { mode: "snapshot", expectedEncounterId: session.eventId }).valid)
    && snapshot.pendingStationBenefitIds.every(nonBlank) && snapshot.unconsumedRiskBidBenefitIds.every(nonBlank) && snapshot.temporaryFocusPenaltyIds.every(nonBlank)
    && snapshot.roundOrderRestrictions.every((restriction) => exactKeys(restriction, RESTRICTION_FIELDS) && nonBlank(restriction.restrictionId) && nonBlank(restriction.persistence))
    && snapshot.hazardSuppressions.every((suppression) => exactKeys(suppression, SUPPRESSION_FIELDS) && nonBlank(suppression.suppressionId) && nonBlank(suppression.hazardId))
    && snapshot.temporaryConsequenceIds.every(nonBlank)
    && snapshot.activeHazards.length === 0 && snapshot.hazardSuppressions.length === 0 && snapshot.pendingStationBenefitIds.length === 0
    && snapshot.unconsumedRiskBidBenefitIds.length === 0 && snapshot.temporaryFocusPenaltyIds.length === 0 && snapshot.temporaryConsequenceIds.length === 0;
}
function exactReservationReceipt(receipt, closeout = null, session = null) {
  if (!exactKeys(receipt, RESERVATION_RECEIPT_FIELDS) || receipt.kind !== "voyage.m11-closeout-session-reserved" || ![receipt.reservationId, receipt.activeGmUserId, receipt.applicationId, receipt.closeoutId, receipt.eventId, receipt.sessionId, receipt.definitionSnapshotId, receipt.shipId].every(nonBlank) || !safeInteger(receipt.expectedEncounterRevision) || receipt.expectedEncounterRevision < 0 || !Array.isArray(receipt.pressureBreachSources)) return false;
  if (receipt.reservationId !== `arcflight-closeout-reservation:${JSON.stringify([receipt.applicationId])}`) return false;
  if (session && (receipt.eventId !== session.eventId || receipt.sessionId !== session.sessionId || receipt.definitionSnapshotId !== session.definitionSnapshotId || receipt.shipId !== session.shipId || !validPressureSources(receipt.pressureBreachSources, session))) return false;
  return !closeout || (receipt.applicationId === closeout.applicationId && receipt.closeoutId === closeout.closeoutId && receipt.expectedEncounterRevision === closeout.expectedEncounterRevision);
}
function exactCommitReceipt(receipt, closeout = null, session = null) {
  if (!exactKeys(receipt, COMMIT_RECEIPT_FIELDS) || receipt.kind !== "voyage.m11-closeout-session-committed" || ![receipt.reservationId, receipt.activeGmUserId, receipt.applicationId, receipt.closeoutId, receipt.eventId, receipt.sessionId, receipt.definitionSnapshotId, receipt.shipId].every(nonBlank) || !safeInteger(receipt.previousEncounterRevision) || receipt.previousEncounterRevision < 0 || !safeInteger(receipt.encounterRevision) || receipt.encounterRevision < 0 || !isPlainObject(receipt.completedCloseoutSnapshot) || !Array.isArray(receipt.encounterEvents) || !Array.isArray(receipt.pressureBreachSources)) return false;
  if (session) {
    let sourceIndex = 0;
    const eventsValid = receipt.encounterEvents.every((event) => {
      const source = event?.type === "voyage.pressure-breach-applied" ? receipt.pressureBreachSources[sourceIndex++] : null;
      return validM10CommitEvent(event, session, receipt.applicationId, receipt.closeoutId, source);
    });
    if (!validCompletedSnapshotShape(receipt.completedCloseoutSnapshot, session) || receipt.encounterRevision !== receipt.completedCloseoutSnapshot.encounterRevision
      || !eventsValid || !validCommitEventChain(receipt, session)) return false;
  }
  if (closeout?.sessionReservationReceipt && !equal(receipt.pressureBreachSources, closeout.sessionReservationReceipt.pressureBreachSources)) return false;
  if (receipt.encounterEvents.length > 0 && receipt.encounterEvents.at(-1)?.type !== "voyage.closeout-applied") return false;
  return !closeout || (receipt.applicationId === closeout.applicationId && receipt.closeoutId === closeout.closeoutId && receipt.reservationId === closeout.reservationId && receipt.previousEncounterRevision === closeout.expectedEncounterRevision);
}
function closeoutLifecycleAllowed(session, commandKind) {
  if (!session) return false;
  if (commandKind === "closeout-review") return session.sessionState === "event-closeout-review" && session.closeout.status === "review-required";
  if (session.sessionState !== "persistent-application") return false;
  return commandKind === "closeout-prepare" ? session.closeout.status === "accepted-for-application"
    : commandKind === "closeout-reserve" ? session.closeout.status === "prepared-awaiting-session"
      : commandKind === "closeout-ship-apply" ? session.closeout.status === "ship-applied-awaiting-session"
        : commandKind === "closeout-session-commit" ? ["ship-applied-awaiting-session", "commit-pending"].includes(session.closeout.status)
          : false;
}
function m10Function(context, key, fallback) {
  try { return typeof context?.[key] === "function" ? context[key] : fallback; } catch { return null; }
}
function lifecycleMappingValid(session) {
  const mappings = {
    setup: [{ lifecycle: "draft", phases: [null] }, { lifecycle: "configuration", phases: [null] }, { lifecycle: "ready", phases: [null] }],
    "round-introduction": [{ lifecycle: "active", phases: ["situation"] }], "crew-planning": [{ lifecycle: "active", phases: ["crew-planning"] }],
    "plan-locked": [{ lifecycle: "active", phases: ["lock-readiness"] }], "station-resolution": [{ lifecycle: "active", phases: ["resolution"] }],
    "round-closeout": [{ lifecycle: "active", phases: ["consequences"] }], "next-round": [{ lifecycle: "active", phases: ["cleanup-advance", "situation"] }],
    "event-closeout-review": [{ lifecycle: "active", phases: ["cleanup-advance"] }], "persistent-application": [{ lifecycle: "active", phases: ["cleanup-advance"] }],
    completed: [{ lifecycle: "completed-success", phases: [null] }, { lifecycle: "completed-failure", phases: [null] }], paused: [{ lifecycle: "paused", phases: [null, "situation", "crew-planning", "lock-readiness", "resolution", "consequences", "cleanup-advance"] }],
    "emergency-response": [{ lifecycle: "active", phases: ["consequences"] }], aborted: [{ lifecycle: "abandoned", phases: [null] }, { lifecycle: "discarded", phases: [null] }],
    "recovery-required": [{ lifecycle: "recovery", phases: [null, "situation", "crew-planning", "lock-readiness", "resolution", "consequences", "cleanup-advance"] }]
  };
  return (mappings[session.sessionState] ?? []).some((entry) => entry.lifecycle === session.encounterState.lifecycleState && entry.phases.includes(session.encounterState.phase));
}
function isM12RuntimeEvent(event) { return typeof event?.type === "string" && event.type.startsWith("voyage.m12-"); }
function validM12RuntimeEvent(event, session) {
  return exactKeys(event, M12_EVENT_FIELDS) && event.type === `voyage.m12-${event.transitionKind}`
    && [event.sessionId, event.eventId, event.definitionSnapshotId, event.shipId].every(nonBlank)
    && event.sessionId === session.sessionId && event.eventId === session.eventId && event.definitionSnapshotId === session.definitionSnapshotId && event.shipId === session.shipId
    && nonBlank(event.transitionKind) && SESSION_STATES.has(event.previousSessionState) && SESSION_STATES.has(event.nextSessionState)
    && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision) && event.encounterRevision === event.previousEncounterRevision + 1
    && safeInteger(event.previousRevision) && safeInteger(event.revision) && event.revision === event.previousRevision + 1 && event.revision <= session.revision;
}
function validRuntimeEvent(event, session, index) {
  if (!isPlainObject(event) || !nonBlank(event.sessionId) || event.sessionId !== session.sessionId || event.eventId !== session.eventId
    || event.definitionSnapshotId !== session.definitionSnapshotId || event.shipId !== session.shipId || !safeInteger(event.previousRevision) || !safeInteger(event.revision)
    || event.revision !== event.previousRevision + 1 || event.revision > session.revision) return false;
  if (isM12RuntimeEvent(event)) return validM12RuntimeEvent(event, session);
  if (["voyage.m11-recovery-rebuilt", "voyage.m11-closeout-review-accepted", "voyage.m11-closeout-session-reserved", "voyage.m11-closeout-session-commit-pending", "voyage.m11-closeout-session-committed"].includes(event.type) && !exactKeys(event, M11_EVENT_FIELDS)) return false;
  if (event.type === "voyage.m11-recovery-rebuilt") return nonBlank(event.sourceCheckpointId) && safeInteger(event.sourceCheckpointRevision) && nonBlank(event.recoveryAuthorityUserId);
  if (event.type === "voyage.m11-recovery-aborted") return exactKeys(event, RECOVERY_ABORT_EVENT_FIELDS) && nonBlank(event.sourceCheckpointId) && safeInteger(event.sourceCheckpointRevision) && nonBlank(event.recoveryAuthorityUserId) && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision) && event.encounterRevision === event.previousEncounterRevision + 1;
  if (event.type === "voyage.m11-session-aborted") return exactKeys(event, ABORT_EVENT_FIELDS) && ["setup-cancellation", "active-event"].includes(event.abortScope) && nonBlank(event.abortAuthorityUserId) && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision) && event.encounterRevision === event.previousEncounterRevision + 1;
  if (event.type === "voyage.m11-session-corrected") return exactKeys(event, CORRECTION_EVENT_FIELDS) && ["station-selection", "station-order"].includes(event.correctionKind) && event.targetRequestId === null && nonBlank(event.correctionAuthorityUserId) && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision) && event.encounterRevision === event.previousEncounterRevision + 1;
  if (event.type === "voyage.m11-closeout-review-accepted") return event.sourceCheckpointId === null && event.sourceCheckpointRevision === null && event.recoveryAuthorityUserId === null;
  if (event.type === "voyage.m11-closeout-session-reserved") return event.sourceCheckpointId === null && event.sourceCheckpointRevision === null && event.recoveryAuthorityUserId === null;
  if (event.type === "voyage.m11-closeout-session-commit-pending") return event.sourceCheckpointId === null && event.sourceCheckpointRevision === null && event.recoveryAuthorityUserId === null;
  if (event.type === "voyage.m11-closeout-session-committed") return event.sourceCheckpointId === null && event.sourceCheckpointRevision === null && event.recoveryAuthorityUserId === null;
  return false;
}
function storedEventRevisionPair(event) {
  if (event?.type === "voyage.hazard-closeout-consequence-applied" || event?.type === "voyage.closeout-applied") return [event.previousEncounterRevision, event.encounterRevision];
  return [event?.previousRevision, event?.revision];
}
function validCheckpoint(checkpoint, session, events, index) {
  if (!exactKeys(checkpoint, CHECKPOINT_FIELDS) || !nonBlank(checkpoint.checkpointId) || !CHECKPOINT_KINDS.has(checkpoint.kind)
    || checkpoint.sessionId !== session.sessionId || !safeInteger(checkpoint.revision) || !safeInteger(checkpoint.encounterRevision) || !safeInteger(checkpoint.eventCount)
    || checkpoint.revision > session.revision || checkpoint.eventCount > events.length || checkpoint.eventCount < 0 || checkpoint.encounterRevision < 0 || !safeInteger(checkpoint.authorityEpoch)
    || checkpoint.encounterRevision !== checkpoint.encounterState?.revision || !SESSION_STATES.has(checkpoint.sessionState) || typeof checkpoint.invalidated !== "boolean"
    || !isPlainObject(checkpoint.encounterState) || !validEncounterState(checkpoint.encounterState, session) || !validCloseout(checkpoint.closeout, session)
    || checkpoint.authorityEpoch > session.authorityEpoch || checkpoint.checkpointId !== `arcflight-voyage-checkpoint:${JSON.stringify([session.sessionId, checkpoint.kind, checkpoint.revision])}`) return false;
  return lifecycleMappingValid({ ...session, sessionState: checkpoint.sessionState, encounterState: checkpoint.encounterState });
}
function validRecoveryRecord(record, session, expectedAuthorityEpoch = null) {
  if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || !nonBlank(record.principalUserId) || record.projectionKind !== "gm"
    || record.commandKind !== RECOVERY_COMMAND_KIND || ![RECOVERY_RESULT_KIND, "recovered-aborted"].includes(record.resultKind) || !safeInteger(record.resultRevision) || record.resultRevision < 1 || record.resultRevision > session.revision || typeof record.fingerprint !== "string" || !isPlainObject(record.response)) return false;
  const parsed = parseStoredFingerprint(record.fingerprint); if (!parsed.ok) return false;
  const tuple = parsed.value;
  return tuple[0] === session.sessionId && tuple[1] === record.principalUserId && tuple[2] === "gm" && safeInteger(tuple[3]) && safeInteger(tuple[4])
    && (expectedAuthorityEpoch === null || tuple[3] === expectedAuthorityEpoch) && tuple[3] <= session.authorityEpoch && tuple[4] + 1 === record.resultRevision && tuple[4] < record.resultRevision
    && tuple[5] === RECOVERY_COMMAND_KIND && exactKeys(tuple[6], ["recoveryAction", "reason"]) && ["rebuild-latest", "abort"].includes(tuple[6].recoveryAction) && tuple[6].recoveryAction === (record.resultKind === "recovered-aborted" ? "abort" : "rebuild-latest") && nonBlank(tuple[6].reason)
    && validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch);
}
function validRecoveryAudit(audit, session, record, event, sourceCheckpoint, replayedEventCount, authorityEpoch) {
  const parsed = parseStoredFingerprint(record.fingerprint);
  return exactKeys(audit, AUDIT_FIELDS) && audit.kind === "recovery-rebuilt" && audit.auditId === auditId(session.sessionId, session.auditHistory.indexOf(audit), "recovery-rebuilt")
    && parsed.ok && audit.sessionId === session.sessionId && audit.requestId === record.requestId && audit.actorUserId === record.principalUserId && audit.authorityEpoch === authorityEpoch
    && audit.previousRevision === record.resultRevision - 1 && audit.revision === record.resultRevision && validIsoTimestamp(audit.occurredAt)
    && record.response.authorityEpoch === authorityEpoch
    && event?.type === "voyage.m11-recovery-rebuilt" && event.revision === audit.revision && event.previousRevision === audit.previousRevision
    && event.recoveryAuthorityUserId === record.principalUserId && event.sourceCheckpointId === sourceCheckpoint?.checkpointId && event.sourceCheckpointRevision === sourceCheckpoint?.revision
    && sourceCheckpoint.invalidated === false && sourceCheckpoint.revision <= event.previousRevision && sourceCheckpoint.eventCount <= session.events.indexOf(event)
    && Array.isArray(record.response.events) && record.response.events.length === 1 && equal(record.response.events[0], event)
    && exactKeys(audit.details, RECOVERY_AUDIT_DETAILS_FIELDS) && audit.details.recoveryAuthorityUserId === event.recoveryAuthorityUserId
    && audit.details.sourceCheckpointId === event.sourceCheckpointId && audit.details.sourceCheckpointRevision === event.sourceCheckpointRevision
    && audit.details.recoveryAction === parsed.value[6].recoveryAction && audit.details.replayedEventCount === replayedEventCount
    && nonBlank(audit.details.failedRequestId) && safeInteger(audit.details.failedRevision)
    && audit.details.failedRevision <= event.previousRevision;
}
function validAfterRecoveryCheckpoint(checkpoint, session, record, event, audit, sourceCheckpoint, replayedEventCount, replayedState = null) {
  try {
    const matching = session.checkpoints.filter((entry) => entry?.kind === "after-recovery" && entry.revision === record.resultRevision && entry.sessionId === session.sessionId);
    if (matching.length !== 1 || checkpoint !== matching[0] || !validCheckpoint(checkpoint, session, session.events, session.checkpoints.indexOf(checkpoint))) return false;
    const eventIndex = session.events.indexOf(event);
    let expectedEncounterState = replayedState?.encounterState ?? null;
    let expectedCloseout = replayedState?.closeout ?? null;
    if (record.resultKind === "recovered-aborted" && replayedState?.encounterState) {
      const lifecycle = ["configuration", "ready"].includes(replayedState.encounterState.lifecycleState) ? "discarded" : ["active", "paused"].includes(replayedState.encounterState.lifecycleState) ? "abandoned" : null;
      const captured = lifecycle ? capture(replayedState.encounterState) : null;
      if (!captured?.ok) return false;
      expectedEncounterState = captured.value;
      expectedEncounterState.lifecycleState = lifecycle;
      expectedEncounterState.phase = null;
      expectedEncounterState.revision = event.encounterRevision;
      if (!validEncounterState(expectedEncounterState, session) || event.previousEncounterRevision !== replayedState.encounterState.revision || event.encounterRevision !== replayedState.encounterState.revision + 1) return false;
    }
    const valid = checkpoint.checkpointId === `arcflight-voyage-checkpoint:${JSON.stringify([session.sessionId, "after-recovery", record.resultRevision])}`
      && checkpoint.invalidated === false && checkpoint.authorityEpoch === record.response.authorityEpoch && checkpoint.sessionState === record.response.status
      && checkpoint.eventCount === eventIndex + 1 && eventIndex >= 0 && event.revision <= checkpoint.revision
      && checkpoint.encounterState && checkpoint.closeout && (record.resultKind === "recovered-aborted"
        ? checkpoint.sessionState === "aborted" && expectedEncounterState && expectedCloseout && equal(checkpoint.encounterState, expectedEncounterState) && equal(checkpoint.closeout, expectedCloseout)
        : replayedState && equal(checkpoint.encounterState, replayedState.encounterState) && equal(checkpoint.closeout, replayedState.closeout) && checkpoint.sessionState === replayedState.sessionState)
      && audit.details.sourceCheckpointId === sourceCheckpoint.checkpointId && audit.details.sourceCheckpointRevision === sourceCheckpoint.revision
      && audit.details.replayedEventCount === replayedEventCount;
    return valid;
  } catch { return false; }
}
function validResolvedRecovery(recovery, event, audit, sourceCheckpoint) {
  return exactKeys(recovery, RECOVERY_FIELDS) && recovery.status === "resolved" && recovery.reasonCode === "m11-recovery-required"
    && recovery.checkpointId === sourceCheckpoint.checkpointId && recovery.sourceCheckpointRevision === sourceCheckpoint.revision
    && recovery.recoveryAuthorityUserId === event.recoveryAuthorityUserId
    && nonBlank(recovery.failedRequestId) && recovery.failedRequestId === audit.details.failedRequestId
    && safeInteger(recovery.failedRevision) && recovery.failedRevision === audit.details.failedRevision
    && recovery.failedRevision <= event.previousRevision;
}
function validRequiredRecovery(recovery) {
  return exactKeys(recovery, RECOVERY_FIELDS) && recovery.status === "required" && recovery.reasonCode === "m11-recovery-required"
    && nonBlank(recovery.failedRequestId) && safeInteger(recovery.failedRevision)
    && (recovery.checkpointId === null || nonBlank(recovery.checkpointId))
    && (recovery.sourceCheckpointRevision === null || safeInteger(recovery.sourceCheckpointRevision))
    && (recovery.recoveryAuthorityUserId === null || nonBlank(recovery.recoveryAuthorityUserId));
}
function validRecoveryBootstrapAudit(audit, session, request, authorityEpoch, revision, previousActiveGmUserId, nextActiveGmUserId) {
  return exactKeys(audit, AUDIT_FIELDS) && audit.kind === "recovery-control-transfer" && audit.auditId === auditId(session.sessionId, session.auditHistory.indexOf(audit), audit.kind)
    && audit.sessionId === session.sessionId && audit.requestId === request.requestId && audit.actorUserId === request.principalUserId && audit.authorityEpoch === authorityEpoch
    && audit.previousRevision === revision && audit.revision === revision && validIsoTimestamp(audit.occurredAt)
    && exactKeys(audit.details, AUDIT_DETAILS_FIELDS) && audit.details.previousActiveGmUserId === previousActiveGmUserId
    && audit.details.nextActiveGmUserId === nextActiveGmUserId && audit.details.bootstrap === true && audit.details.reason === request.reason;
}
function checkpointInvalidationAudited(checkpoint, session) {
  if (checkpoint.invalidated === false) return true;
  return session.auditHistory.some((audit) => audit?.kind === "recovery-rebuilt" && audit.details?.sourceCheckpointId === checkpoint.checkpointId && audit.details?.sourceCheckpointRevision === checkpoint.revision);
}
function validStoredResponse(response, record, sessionId, authorityEpoch) {
  return validTransferEnvelope(response) && response.ok === true && response.requestId === record.requestId && response.sessionId === sessionId
    && SESSION_STATES.has(response.status) && response.projection === null && safeInteger(response.revision) && response.revision === record.resultRevision && safeInteger(response.authorityEpoch) && response.authorityEpoch <= authorityEpoch
    && response.errors.length === 0 && response.warnings.length === 0;
}
function closeoutAuditTransition(kind) {
  return CLOSEOUT_AUDIT_TRANSITIONS[kind] ?? null;
}
function validCloseoutAudit(audit, session, record, event, historicalEpoch = null, expectedKind = "closeout-review-accepted", expectedEventType = "voyage.m11-closeout-review-accepted") {
  const transition = closeoutAuditTransition(expectedKind);
  if (!transition) return false;
  return exactKeys(audit, AUDIT_FIELDS) && audit.kind === expectedKind
    && audit.auditId === auditId(session.sessionId, session.auditHistory.indexOf(audit), audit.kind)
    && audit.sessionId === session.sessionId && audit.requestId === record.requestId && audit.actorUserId === record.principalUserId
    && safeInteger(audit.authorityEpoch) && (historicalEpoch === null ? audit.authorityEpoch === session.authorityEpoch : audit.authorityEpoch === historicalEpoch && historicalEpoch <= session.authorityEpoch) && safeInteger(audit.previousRevision)
    && safeInteger(audit.revision) && audit.previousRevision + 1 === audit.revision && audit.revision === record.resultRevision
    && validIsoTimestamp(audit.occurredAt) && exactKeys(audit.details, CLOSEOUT_AUDIT_DETAILS_FIELDS)
    && audit.details.applicationId === session.closeout.applicationId && audit.details.closeoutId === session.closeout.closeoutId
    && audit.details.previousSessionState === transition[0] && audit.details.nextSessionState === transition[1]
    && event?.type === expectedEventType && event.revision === audit.revision && event.previousRevision === audit.previousRevision;
}
function commitEventRevisionPair(event) {
  if (event?.type === "voyage.hazard-closeout-consequence-applied" || event?.type === "voyage.closeout-applied") return [event.previousEncounterRevision, event.encounterRevision];
  if (event?.type === "voyage.pressure-breach-applied") return [event.previousRevision, event.revision];
  return null;
}
function validCommitEventChain(receipt, session) {
  const events = receipt.encounterEvents;
  if (!Array.isArray(events) || events.length === 0 || events.at(-1)?.type !== "voyage.closeout-applied") return false;
  const revisions = new Set(), identities = new Set(), hazards = new Set(), breaches = new Set();
  let encounterRevision = receipt.previousEncounterRevision;
  let finalCount = 0;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index], pair = commitEventRevisionPair(event);
    if (!pair || !safeInteger(pair[0]) || pair[0] < 0 || !safeInteger(pair[1]) || pair[1] < 0 || pair[1] !== pair[0] + 1 || pair[0] !== encounterRevision || revisions.has(pair[1])) return false;
    revisions.add(pair[1]);
    const identity = event.type === "voyage.pressure-breach-applied" ? event.breach?.pressureBreachId : event.type === "voyage.hazard-closeout-consequence-applied" ? `${event.hazardId}:${event.consequenceId}` : `${event.eventId}:${event.closeoutId}`;
    if (!nonBlank(identity) || identities.has(identity)) return false;
    identities.add(identity);
    if (event.type === "voyage.hazard-closeout-consequence-applied") {
      if (hazards.has(event.hazardId)) return false;
      hazards.add(event.hazardId);
    } else if (event.type === "voyage.pressure-breach-applied") {
      if (index === 0 || events[index - 1].type !== "voyage.hazard-closeout-consequence-applied" || breaches.has(event.breach.pressureBreachId)) return false;
      breaches.add(event.breach.pressureBreachId);
    } else if (event.type === "voyage.closeout-applied") {
      finalCount += 1;
      if (index !== events.length - 1 || finalCount !== 1) return false;
    }
    encounterRevision = pair[1];
  }
  if (finalCount !== 1 || encounterRevision !== receipt.encounterRevision || receipt.encounterRevision !== receipt.completedCloseoutSnapshot.encounterRevision) return false;
  return Array.isArray(receipt.pressureBreachSources) && (validPressureSources(receipt.pressureBreachSources, session) || validReceiptPressureSources(receipt.pressureBreachSources, session, events));
}
function validCloseoutRecord(record, session, audit, event) {
  if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || !nonBlank(record.principalUserId) || record.projectionKind !== "gm" || typeof record.fingerprint !== "string" || !safeInteger(record.resultRevision) || record.resultRevision < 1 || record.resultRevision > session.revision || !isPlainObject(record.response)) return false;
  const parsed = parseStoredFingerprint(record.fingerprint); if (!parsed.ok) return false;
  const tuple = parsed.value;
  const expectedPayloadKeys = record.commandKind === "closeout-review" ? ["confirmed", "previewRequest", "suppliedPreview"] : [];
  if (tuple[0] !== session.sessionId || tuple[1] !== record.principalUserId || tuple[2] !== "gm" || !safeInteger(tuple[3]) || !safeInteger(tuple[4]) || tuple[3] > session.authorityEpoch
    || tuple[5] !== record.commandKind || !exactKeys(tuple[6], expectedPayloadKeys) || !safeInteger(record.response.authorityEpoch) || record.response.authorityEpoch !== tuple[3]) return false;
  if (!["closeout-prepare", "closeout-ship-apply"].includes(record.commandKind) && tuple[4] + 1 !== record.resultRevision) return false;
  if (record.commandKind === "closeout-review" && record.resultKind === "closeout-review-accepted") {
    return session.closeout.status === "accepted-for-application" || session.closeout.status === "prepared-awaiting-session" || session.closeout.status === "ship-applied-awaiting-session" || session.closeout.status === "commit-pending" || session.closeout.status === "committed"
      ? validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) && record.response.status === "persistent-application" && Array.isArray(record.response.events) && record.response.events.length === 1 && equal(record.response.events[0], event) && validCloseoutAudit(audit, session, record, event, tuple[3])
      : false;
  }
  if ((record.commandKind === "closeout-reserve" && record.resultKind === "closeout-session-reserved") || (record.commandKind === "closeout-session-commit" && ["closeout-session-commit-pending", "closeout-session-committed"].includes(record.resultKind))) {
    const eventType = record.resultKind === "closeout-session-commit-pending" ? "voyage.m11-closeout-session-commit-pending" : record.resultKind === "closeout-session-reserved" ? "voyage.m11-closeout-session-reserved" : "voyage.m11-closeout-session-committed";
    const auditKind = record.resultKind === "closeout-session-commit-pending" ? "closeout-session-commit-pending" : record.resultKind === "closeout-session-reserved" ? "closeout-session-reserved" : "closeout-session-committed";
    return validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) && record.response.status === (record.resultKind === "closeout-session-committed" ? "completed" : "persistent-application") && Array.isArray(record.response.events) && record.response.events.length === 1 && equal(record.response.events[0], event)
      && event?.type === eventType && event.revision === record.resultRevision && event.previousRevision === record.resultRevision - 1
      && validCloseoutAudit(audit, session, record, event, tuple[3], auditKind, eventType)
      && audit.details.applicationId === session.closeout.applicationId && audit.details.closeoutId === session.closeout.closeoutId;
  }
  if (record.commandKind === "closeout-prepare" && record.resultKind === "prepared-awaiting-session") {
    return tuple[4] === record.resultRevision && validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) && record.response.status === "persistent-application" && Array.isArray(record.response.events) && record.response.events.length === 0
      && ["prepared-awaiting-session", "ship-applied-awaiting-session", "commit-pending", "committed"].includes(session.closeout.status);
  }
  if (record.commandKind === "closeout-ship-apply" && record.resultKind === "closeout-ship-checkpoint-verified") {
    const valid = tuple[4] === record.resultRevision && validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch)
      && record.response.status === "persistent-application" && Array.isArray(record.response.events) && record.response.events.length === 0
      && ["ship-applied-awaiting-session", "commit-pending", "committed"].includes(session.closeout.status);
    return valid;
  }
  return false;
}
function validTerminalCloseoutEvidence(session) {
  try {
    if (session.sessionState !== "completed" || session.closeout.status !== "committed") return false;
    const events = session.events.filter((entry) => entry?.type === "voyage.m11-closeout-session-committed");
    const audits = session.auditHistory.filter((entry) => entry?.kind === "closeout-session-committed");
    const pendingRecords = session.processedRequests.filter((record) => record.commandKind === "closeout-session-commit" && record.resultKind === "closeout-session-commit-pending");
    const committedRecords = session.processedRequests.filter((record) => record.commandKind === "closeout-session-commit" && record.resultKind === "closeout-session-committed");
    if (events.length !== 1 || audits.length !== 1 || pendingRecords.length !== 1 || committedRecords.length > 1) return false;
    const event = events[0], audit = audits[0], record = committedRecords[0] ?? pendingRecords[0];
    if (!validRuntimeEvent(event, session, session.events.indexOf(event)) || event.revision !== session.revision || event.previousRevision !== session.revision - 1) return false;
    if (committedRecords.length === 0) {
      if (!exactKeys(audit, AUDIT_FIELDS) || audit.kind !== "closeout-session-committed" || audit.auditId !== auditId(session.sessionId, session.auditHistory.indexOf(audit), audit.kind)
        || audit.sessionId !== session.sessionId || audit.requestId !== pendingRecords[0].requestId || audit.actorUserId !== pendingRecords[0].principalUserId
        || audit.authorityEpoch !== session.authorityEpoch || audit.previousRevision !== event.previousRevision || audit.revision !== event.revision || !validIsoTimestamp(audit.occurredAt)
        || !exactKeys(audit.details, CLOSEOUT_AUDIT_DETAILS_FIELDS) || audit.details.applicationId !== session.closeout.applicationId || audit.details.closeoutId !== session.closeout.closeoutId
        || audit.details.previousSessionState !== "persistent-application" || audit.details.nextSessionState !== "completed") return false;
    } else if (!validCloseoutAudit(audit, session, record, event, parseStoredFingerprint(record.fingerprint).value[3], "closeout-session-committed", "voyage.m11-closeout-session-committed")) return false;
    if (committedRecords.length === 1) return validCloseoutRecord(record, session, audit, event);
    return audit.requestId === pendingRecords[0].requestId && audit.actorUserId === pendingRecords[0].principalUserId
      && validStoredResponse(pendingRecords[0].response, pendingRecords[0], session.sessionId, session.authorityEpoch);
  } catch { return false; }
}
function validSessionEvidence(session, documentIdValue, { allowBootstrapNull = false, recoveryEnvelope: recoveryEnvelopeMode = false } = {}, replayContext = {}) {
  try {
    if (!exactKeys(session, SESSION_FIELDS) || session.schemaVersion !== 1 || session.sessionDocumentId !== documentIdValue
      || ![session.sessionId, session.eventId, session.definitionSnapshotId, session.shipId].every(nonBlank) || !safeInteger(session.revision) || !SESSION_STATES.has(session.sessionState)
      || (!nonBlank(session.activeGmUserId) && !(allowBootstrapNull && session.activeGmUserId === null)) || !safeInteger(session.authorityEpoch)
      || !validEncounterState(session.encounterState, session) || !lifecycleMappingValid(session) || !Array.isArray(session.events) || !Array.isArray(session.checkpoints)
       || !Array.isArray(session.processedRequests) || !Array.isArray(session.auditHistory) || !validCloseout(session.closeout, session) || !validStoredCloseoutPlan(session.closeout, session) || !exactKeys(session.recovery, RECOVERY_FIELDS)
      || !new Set(["none", "required", "resolved"]).has(session.recovery.status)) return false;
    const immutableEnvelope = recoveryEnvelope(session, documentIdValue);
    if (!immutableEnvelope || !recoveryStoredRecordsValid(immutableEnvelope, replayContext, session.recovery, session)) return false;
    if (session.revision === 0) {
      if (session.sessionState !== "setup" || session.encounterState.revision !== 0 || !["draft", "configuration", "ready"].includes(session.encounterState.lifecycleState) || session.encounterState.phase !== null
       || session.events.length !== 0 || session.recovery.status !== "none" || session.closeout.status !== "none") return false;
    } else if (session.events.length === 0 && session.checkpoints.length === 0 && session.processedRequests.length === 1 && session.auditHistory.length === 0) return false;
    const events = session.events;
    if (!replayEventChain(session, replayContext, 0, 0, null)) return false;
    if (!recoveryCheckpointJournalValid(session)) return false;
    if (events.some((event, index) => !(typeof event?.type === "string" && event.type.startsWith("voyage.m11-")) && !isM12RuntimeEvent(event) && !isTask7DomainEvent(events, index))) {
      const latestCheckpoint = session.checkpoints.at(-1);
        if (!latestCheckpoint || !replayRecoveryEvidence(session, latestCheckpoint, replayContext)) return false;
    }
    if (session.processedRequests.length < 1 || !validCreationRecord(session.processedRequests[0], session, session.processedRequests[0]?.principalUserId)) return false;
    const requestIds = new Set([session.processedRequests[0].requestId]);
    let owner = session.processedRequests[0].principalUserId, expectedAuthorityEpoch = 0, transferCount = 0, recoveryCount = 0, bootstrapRecoveryCount = 0, lastRecoveryRevision = 0, latestRecoveryEvidence = null;
    for (let index = 1; index < session.processedRequests.length; index += 1) {
      const record = session.processedRequests[index]; if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || requestIds.has(record.requestId)) return false;
      const audit = session.auditHistory.find((entry) => entry?.requestId === record.requestId && (record.commandKind === TRANSFER_COMMAND_KIND ? entry.kind.startsWith("control-transfer") : record.commandKind === RECOVERY_COMMAND_KIND ? ["recovery-rebuilt", "recovery-aborted"].includes(entry.kind) : record.commandKind === "m12-launch" ? entry.kind === "m12-launch" : TASK2_COMMANDS.has(record.commandKind) ? entry.kind === TASK2_AUDIT_KINDS[record.commandKind] : record.commandKind === "closeout-review" ? entry.kind === "closeout-review-accepted" : record.commandKind === "closeout-reserve" ? entry.kind === "closeout-session-reserved" : record.commandKind === "closeout-session-commit" ? ["closeout-session-commit-pending", "closeout-session-committed"].includes(entry.kind) : record.commandKind === "abort-session" ? ["setup-cancelled", "event-aborted"].includes(entry.kind) : record.commandKind === "correct-session" ? entry.kind === "correction-applied" : false));
      if (record.commandKind === TRANSFER_COMMAND_KIND) {
        const tuple = parseStoredFingerprint(record.fingerprint); if (!audit || !tuple.ok || tuple.value[3] !== expectedAuthorityEpoch || !validTransferRecord(record, session, expectedAuthorityEpoch, audit, owner)) return false;
        owner = tuple.value[6].targetUserId; expectedAuthorityEpoch += 1; transferCount += 1;
      } else if (record.commandKind === RECOVERY_COMMAND_KIND) {
        const tuple = parseStoredFingerprint(record.fingerprint); if (!audit || !tuple.ok || tuple.value[3] !== expectedAuthorityEpoch || !validRecoveryRecord(record, session, expectedAuthorityEpoch) || record.resultRevision <= lastRecoveryRevision) return false;
        const bootstrapAudit = session.auditHistory.find((entry) => entry?.requestId === record.requestId && entry.kind === "recovery-control-transfer");
        const previousOwner = bootstrapAudit?.details?.previousActiveGmUserId === null ? null : owner;
        const recoveryAction = tuple.ok && tuple.value[6]?.recoveryAction;
        const event = session.events.find((entry) => entry?.type === (recoveryAction === "abort" ? "voyage.m11-recovery-aborted" : "voyage.m11-recovery-rebuilt") && entry.revision === record.resultRevision && entry.recoveryAuthorityUserId === record.principalUserId);
        const sourceCheckpoint = event && session.checkpoints.find((checkpoint) => checkpoint.checkpointId === event.sourceCheckpointId && checkpoint.revision === event.sourceCheckpointRevision);
        const replayedEventCount = event && sourceCheckpoint && session.events.indexOf(event) - sourceCheckpoint.eventCount;
        const recoveryAuthorityEpoch = expectedAuthorityEpoch + (bootstrapAudit ? 1 : 0);
        const recoveryCheckpoint = event && session.checkpoints.find((checkpoint) => checkpoint.kind === "after-recovery" && checkpoint.revision === record.resultRevision);
        const eventIndex = event && session.events.indexOf(event);
        const replayEnvelope = eventIndex >= 0 ? { ...session, events: session.events.slice(0, eventIndex + 1) } : null;
        const replayedState = replayEnvelope && sourceCheckpoint && replayRecoveryEvidence(replayEnvelope, sourceCheckpoint, replayContext);
        if (recoveryAction === "abort") {
          if (!event || !sourceCheckpoint || !audit || audit.kind !== "recovery-aborted" || !exactKeys(audit.details, TASK7_RECOVERY_ABORT_AUDIT_DETAILS) || audit.details.sourceCheckpointId !== sourceCheckpoint.checkpointId || audit.details.sourceCheckpointRevision !== sourceCheckpoint.revision || !safeInteger(audit.details.replayedEventCount) || !validAfterRecoveryCheckpoint(recoveryCheckpoint, session, record, event, audit, sourceCheckpoint, audit.details.replayedEventCount, replayedState)) return false;
          if (record.response.events.length !== 2 || !validTask7DomainPair(record.response.events[0], event, session) || !equal(record.response.events[1], event)) return false;
        } else if (!event || !sourceCheckpoint || !Number.isSafeInteger(replayedEventCount) || replayedEventCount < 0 || !validRecoveryAudit(audit, session, record, event, sourceCheckpoint, replayedEventCount, recoveryAuthorityEpoch)
          || !recoveryCheckpoint || !replayedState || !validAfterRecoveryCheckpoint(recoveryCheckpoint, session, record, event, audit, sourceCheckpoint, replayedEventCount, replayedState)) return false;
        if (bootstrapAudit && !validRecoveryBootstrapAudit(bootstrapAudit, session, { requestId: record.requestId, principalUserId: record.principalUserId, reason: tuple.value[6].reason }, recoveryAuthorityEpoch, record.resultRevision - 1, previousOwner, event.recoveryAuthorityUserId)) return false;
        if (bootstrapAudit) { owner = bootstrapAudit.details.nextActiveGmUserId; expectedAuthorityEpoch += 1; bootstrapRecoveryCount += 1; }
        lastRecoveryRevision = record.resultRevision;
        recoveryCount += 1;
        latestRecoveryEvidence = { record, event, audit, sourceCheckpoint, recoveryCheckpoint, replayedState };
      } else if (record.commandKind === "closeout-prepare") {
        if (!validCloseoutRecord(record, session, null, null)) return false;
      } else if (record.commandKind === "closeout-ship-apply") {
        if (!validCloseoutRecord(record, session, null, null)) return false;
      } else if (record.commandKind === "closeout-review" || record.commandKind === "closeout-reserve" || record.commandKind === "closeout-session-commit") {
        const eventType = record.commandKind === "closeout-review" ? "voyage.m11-closeout-review-accepted" : record.commandKind === "closeout-reserve" ? "voyage.m11-closeout-session-reserved" : record.resultKind === "closeout-session-commit-pending" ? "voyage.m11-closeout-session-commit-pending" : "voyage.m11-closeout-session-committed";
        const event = session.events.find((entry) => entry?.type === eventType && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        if (!audit || !event || !validCloseoutRecord(record, session, audit, event)) return false;
        if (session.events.indexOf(event) !== session.events.length - 1 && session.events.some((entry, eventIndex) => eventIndex > session.events.indexOf(event) && entry.type === eventType)) return false;
      } else if (record.commandKind === "abort-session" || record.commandKind === "correct-session") {
        const eventType = record.commandKind === "abort-session" ? "voyage.m11-session-aborted" : "voyage.m11-session-corrected";
        const event = session.events.find((entry) => entry?.type === eventType && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const task7Fingerprint = parseStoredFingerprint(record.fingerprint);
        if (!audit || !event || !task7Fingerprint.ok || record.principalUserId !== owner || task7Fingerprint.value[3] !== expectedAuthorityEpoch || !validTask7Record(record, session, audit, event)) return false;
      } else if (record.commandKind === "m12-launch") {
        if (!audit || !validM12LaunchRecord(record, session, audit)) return false;
      } else if (TASK2_COMMANDS.has(record.commandKind)) {
        const event = session.events.find((entry) => entry?.type === `voyage.m12-${record.commandKind}` && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const checkpoint = record.commandKind === "plan-lock" ? session.checkpoints.find((entry) => entry?.kind === "before-plan-lock" && entry.revision === record.resultRevision - 1) : null;
        if (!audit || !event || !validM12Task2Record(record, session, audit, event, checkpoint)) return false;
      } else return false;
      requestIds.add(record.requestId);
    }
    if (session.sessionState === "completed" || session.closeout.status === "committed") {
      if (!validTerminalCloseoutEvidence(session)) return false;
    }
    const storedBootstrapRecoveryCount = session.auditHistory.filter((entry) => entry?.kind === "recovery-control-transfer").length;
    const storedTransferCount = session.auditHistory.filter((entry) => entry?.kind === "control-transfer" || entry?.kind === "control-transfer-bootstrap").length;
    const closeoutAuditCount = session.auditHistory.filter((entry) => Object.hasOwn(CLOSEOUT_AUDIT_TRANSITIONS, entry?.kind)).length;
    const task7AuditCount = session.auditHistory.filter((entry) => ["setup-cancelled", "event-aborted", "correction-applied"].includes(entry?.kind)).length;
    const m12AuditCount = session.auditHistory.filter((entry) => entry?.kind === "m12-launch" || Object.values(TASK2_AUDIT_KINDS).includes(entry?.kind)).length;
    if (session.authorityEpoch !== expectedAuthorityEpoch || session.auditHistory.length !== transferCount + recoveryCount + bootstrapRecoveryCount + closeoutAuditCount + task7AuditCount + m12AuditCount || storedBootstrapRecoveryCount !== bootstrapRecoveryCount || storedTransferCount !== transferCount || (!allowBootstrapNull && session.activeGmUserId === null)) return false;
    if (recoveryCount === 0) {
      if (session.recovery.status !== "none" || !Object.keys(session.recovery).slice(1).every((key) => session.recovery[key] === null)) return false;
    } else if (!latestRecoveryEvidence || !validResolvedRecovery(session.recovery, latestRecoveryEvidence.event, latestRecoveryEvidence.audit, latestRecoveryEvidence.sourceCheckpoint)) return false;
    if (session.activeGmUserId !== null && session.activeGmUserId !== owner && !recoveryEnvelopeMode) return false;
    return true;
  } catch { return false; }
}
function pristineSession(session, documentId, { allowBootstrapNull = false, replayContext = {} } = {}) {
  try {
    if (validSessionEvidence(session, documentId, { allowBootstrapNull }, replayContext)) return true;
    const nullBootstrapState = session?.activeGmUserId === null && allowBootstrapNull && session?.authorityEpoch === 0;
    if (!exactKeys(session, SESSION_FIELDS) || session.schemaVersion !== 1 || session.sessionDocumentId !== documentId
      || ![session.sessionId, session.eventId, session.definitionSnapshotId, session.shipId].every(nonBlank) || (!nonBlank(session.activeGmUserId) && !nullBootstrapState)
      || session.revision !== 0 || session.sessionState !== "setup" || !safeInteger(session.authorityEpoch) || !validEncounterState(session.encounterState, session)
      || session.encounterState.revision !== 0 || session.encounterState.lifecycleState !== "draft" || session.encounterState.phase !== null
      || !Array.isArray(session.events) || session.events.length !== 0 || !Array.isArray(session.checkpoints) || session.checkpoints.length !== 0
      || !Array.isArray(session.processedRequests) || session.processedRequests.length < 1 || !Array.isArray(session.auditHistory)
      || session.processedRequests.length !== session.authorityEpoch + 1 || session.auditHistory.length !== session.authorityEpoch
      || !validCreationRecord(session.processedRequests[0], session, session.processedRequests[0]?.principalUserId)
      || !exactKeys(session.closeout, CLOSEOUT_FIELDS) || session.closeout.status !== "none"
      || !Object.keys(session.closeout).slice(1).every((key) => session.closeout[key] === null)
      || !exactKeys(session.recovery, RECOVERY_FIELDS) || session.recovery.status !== "none"
      || !Object.keys(session.recovery).slice(1).every((key) => session.recovery[key] === null)) return false;
    let owner = session.processedRequests[0].principalUserId;
    const requestIds = new Set([session.processedRequests[0].requestId]);
    for (let index = 0; index < session.authorityEpoch; index += 1) {
      const request = session.processedRequests[index + 1], audit = session.auditHistory[index];
      const auditPrevious = audit?.details?.previousActiveGmUserId;
      const transferPrevious = index === 0 && auditPrevious === null ? null : owner;
      if (!exactKeys(request, PROCESSED_REQUEST_FIELDS) || requestIds.has(request.requestId) || !validTransferRecord(request, session, index, audit, transferPrevious)) return false;
      if (auditPrevious !== transferPrevious) return false;
      requestIds.add(request.requestId);
      const tuple = parseStoredFingerprint(request.fingerprint); if (!tuple.ok) return false;
      owner = tuple.value[6].targetUserId;
    }
    return (session.activeGmUserId === null && allowBootstrapNull && session.authorityEpoch === 0) || owner === session.activeGmUserId;
  } catch { return false; }
}

function trustedJournalEntry(document, context = {}) {
  try {
    if (typeof context.isJournalEntryDocument === "function") return context.isJournalEntryDocument(document) === true;
    const JournalEntry = context.JournalEntry ?? globalThis.JournalEntry;
    return typeof JournalEntry === "function" && document instanceof JournalEntry;
  } catch { return false; }
}
function documentId(document) { try { const id = document?.id; return nonBlank(id) ? { ok: true, value: id } : { ok: false, value: null }; } catch { return { ok: false, value: null }; } }
function persistedSessionValue(source) {
  const flags = ownData(source, "flags");
  if (!flags.ok || !isPlainObject(flags.value)) return { present: false, hostile: false, value: null };
  const moduleFlags = ownData(flags.value, ARCFLIGHT_MODULE_ID);
  if (!moduleFlags.ok) return { present: false, hostile: false, value: null };
  if (!isPlainObject(moduleFlags.value)) return { present: false, hostile: true, value: null };
  const system = ownData(moduleFlags.value, "system");
  if (!system.ok) return { present: false, hostile: false, value: null };
  if (!isPlainObject(system.value)) return { present: false, hostile: true, value: null };
  const voyage = ownData(system.value, "voyageSession");
  if (!voyage.ok) return { present: false, hostile: false, value: null };
  return { present: true, hostile: false, value: voyage.value };
}
function readDocumentSession(document, context = {}, trace = null) {
  try {
    if (!trustedJournalEntry(document, context) || typeof document.toObject !== "function") { trace?.("extract-session"); return { ok: false }; }
    const source = document.toObject(), sourceId = ownData(source, "_id"), liveId = documentId(document);
    if (!sourceId.ok || !liveId.ok || sourceId.value !== liveId.value) { trace?.("extract-session"); return { ok: false }; }
    const extracted = persistedSessionValue(source);
    if (!extracted.present) { trace?.("extract-session"); return extracted.hostile ? { ok: false } : { ok: true, session: null, sessionId: null, documentId: liveId.value, document }; }
    const captured = capture(extracted.value); if (!captured.ok || !isPlainObject(captured.value)) { trace?.("capture-session"); return { ok: false }; }
    const sessionId = ownData(captured.value, "sessionId"); if (!sessionId.ok || !nonBlank(sessionId.value)) { trace?.("capture-session"); return { ok: false }; }
    return { ok: true, session: captured.value, sessionId: sessionId.value, documentId: liveId.value, document };
  } catch { return { ok: false }; }
}
function journalDocuments(context) {
  try {
    const collection = context?.journalEntries ?? globalThis.game?.journal;
    const contents = Array.isArray(collection) ? collection : collection?.contents;
    return Array.isArray(contents) ? { ok: true, documents: [...contents] } : { ok: false, documents: [] };
  } catch { return { ok: false, documents: [] }; }
}
function findSessionDocuments(sessionId, context) {
  const journal = journalDocuments(context); if (!journal.ok) return { error: diagnostic("m11-hostile-data-capture-failed", "$") };
  const matches = [];
  for (const document of journal.documents) { const read = readDocumentSession(document, context); if (!read.ok) return { error: diagnostic("m11-hostile-data-capture-failed", "$") }; if (read.sessionId === sessionId) matches.push(read); }
  return { matches, documents: journal.documents };
}
function resolveSessionDocument(sessionId, context) {
  const found = findSessionDocuments(sessionId, context); if (found.error) return { error: found.error };
  if (found.matches.length === 0) return { error: diagnostic("m11-session-document-not-found", "sessionId") };
  if (found.matches.length > 1) return { error: diagnostic("m11-ambiguous-session-document", "sessionId") };
  return { match: found.matches[0] };
}

function trustedUsers(context) {
  try {
    const source = context?.users ?? globalThis.game?.users;
    const values = Array.isArray(source) ? source : source?.contents;
    const captured = capture(values);
    if (!captured.ok || !Array.isArray(captured.value)) return { ok: false, users: [] };
    const users = [], duplicates = new Set();
    const ids = new Set();
    for (const entry of captured.value) {
      if (!isPlainObject(entry) || !nonBlank(entry.id)) return { ok: false, users: [] };
      if (ids.has(entry.id)) duplicates.add(entry.id);
      ids.add(entry.id); users.push({ id: entry.id, isGM: entry.isGM, active: entry.active });
    }
    return { ok: true, users, duplicates };
  } catch { return { ok: false, users: [] }; }
}
function trustedAuthorityContext(context) {
  let authenticatedUserId, activeGmUserId, authenticatedConnectionId, trustedTransportContext;
  try {
    authenticatedUserId = context?.authenticatedUserId ?? globalThis.game?.user?.id;
    activeGmUserId = context?.activeGmUserId ?? globalThis.game?.users?.activeGM?.id;
    authenticatedConnectionId = context?.authenticatedConnectionId;
    trustedTransportContext = context?.trustedTransportContext;
  } catch { return { error: diagnostic("m11-authentication-required", "transport.user") }; }
  if (!nonBlank(authenticatedUserId)) return { error: diagnostic("m11-authentication-required", "transport.user") };
  const trusted = trustedUsers(context);
  if (!trusted.ok) return { error: diagnostic("m11-authentication-required", "transport.user") };
  const principalMatches = trusted.users.filter((user) => user.id === authenticatedUserId);
  if (principalMatches.length !== 1 || typeof principalMatches[0].isGM !== "boolean" || typeof principalMatches[0].active !== "boolean" || principalMatches[0].active !== true) return { error: diagnostic("m11-authentication-required", "transport.user") };
  if (!nonBlank(activeGmUserId)) return { error: diagnostic("m11-active-gm-unavailable", "transport.activeGm") };
  const activeMatches = trusted.users.filter((user) => user.id === activeGmUserId);
  if (activeMatches.length !== 1 || typeof activeMatches[0].isGM !== "boolean" || typeof activeMatches[0].active !== "boolean" || activeMatches[0].isGM !== true || activeMatches[0].active !== true) return { error: diagnostic("m11-active-gm-unavailable", "transport.activeGm") };
  if (trusted.duplicates?.size) return { error: diagnostic("m11-authentication-required", "transport.user") };
  return { authenticatedUserId, authenticatedConnectionId, trustedTransportContext, user: principalMatches[0], activeGmUserId, activeUser: activeMatches[0], users: trusted.users };
}
function authority(context, { requireConnection = false } = {}) {
  const resolved = trustedAuthorityContext(context); if (resolved.error) return resolved;
  if (resolved.user.isGM !== true || resolved.authenticatedUserId !== resolved.activeGmUserId) return { error: diagnostic("m11-active-gm-required", "transport.activeGm") };
  if (requireConnection && (resolved.trustedTransportContext !== true || !nonBlank(resolved.authenticatedConnectionId))) return { error: diagnostic("m11-cross-client-coordinator-required", "transport.coordinator") };
  return resolved;
}
function authenticatedContext(context) { return trustedAuthorityContext(context); }
function projectionPrincipal(context) {
  try {
    const authenticatedUserId = context?.authenticatedUserId ?? globalThis.game?.user?.id;
    const authenticatedConnectionId = context?.authenticatedConnectionId;
    const trustedTransportContext = context?.trustedTransportContext;
    if (!nonBlank(authenticatedUserId) || trustedTransportContext !== true || !nonBlank(authenticatedConnectionId)) return { error: diagnostic("m11-authentication-required", "transport.user") };
    const trusted = trustedUsers(context); if (!trusted.ok || trusted.duplicates?.size) return { error: diagnostic("m11-authentication-required", "transport.user") };
    const matches = trusted.users.filter((user) => user.id === authenticatedUserId);
    if (matches.length !== 1 || typeof matches[0].isGM !== "boolean" || typeof matches[0].active !== "boolean" || matches[0].active !== true) return { error: diagnostic("m11-authentication-required", "transport.user") };
    return { authenticatedUserId, authenticatedConnectionId, trustedTransportContext, user: matches[0], users: trusted.users };
  } catch { return { error: diagnostic("m11-authentication-required", "transport.user") }; }
}
function transferCoordinator(context) {
  try {
    const operation = ownData(context, "runExclusiveSessionMutation"), trust = ownData(context, "trustedTransportContext");
    if (!operation.ok || !trust.ok || trust.value !== true || typeof operation.value !== "function") return { error: diagnostic("m11-cross-client-coordinator-required", "transport.coordinator") };
    return { operation: operation.value };
  } catch { return { error: diagnostic("m11-cross-client-coordinator-required", "transport.coordinator") };
  }
}
function coordinatorDescriptor(value, documentIdValue, authorityContext) {
  const descriptor = {
    sessionId: value.sessionId,
    sessionDocumentId: documentIdValue,
    expectedRevision: value.expectedRevision,
    expectedAuthorityEpoch: value.authorityEpoch,
    authenticatedUserId: authorityContext.authenticatedUserId,
    connectionId: authorityContext.authenticatedConnectionId,
    activeGmUserId: authorityContext.activeGmUserId
  };
  return exactKeys(descriptor, TRANSFER_COORDINATOR_FIELDS) && TRANSFER_COORDINATOR_FIELDS.every((key) => nonBlank(descriptor[key]) || (key === "expectedRevision" || key === "expectedAuthorityEpoch")) && safeInteger(descriptor.expectedRevision) && safeInteger(descriptor.expectedAuthorityEpoch)
    ? Object.freeze(descriptor) : null;
}
function canonicalOperator(value) {
  const captured = capture(value);
  if (!captured.ok || captured.value === null) return null;
  const report = analyzeVoyageStationAssignments([{ stationId: "captain", operator: captured.value }]);
  return report.valid && report.assignments.length === 1 ? report.assignments[0].operator : null;
}
function deriveProjectionKind(authenticated, session, context) {
  if (authenticated.user?.isGM === true) return "gm";
  const assignments = session?.encounterState?.stationAssignments;
  let resolvedOperator = null;
  try {
    if (typeof context?.resolveVoyageOperatorForPrincipal === "function") resolvedOperator = canonicalOperator(context.resolveVoyageOperatorForPrincipal(authenticated.authenticatedUserId));
  } catch { resolvedOperator = null; }
  if (resolvedOperator && Array.isArray(assignments)) {
    const report = analyzeVoyageStationAssignments(assignments);
    if (report.valid) {
      const field = Object.hasOwn(resolvedOperator, "uuid") ? "uuid" : "id";
      const matches = report.assignments.filter((entry) => entry.operator.kind === resolvedOperator.kind && entry.operator[field] === resolvedOperator[field]);
      if (matches.length === 1) return "operator";
      if (matches.length === 0) return "crew";
    }
  }
  return "observer";
}
function buildSessionProjection(session, projectionKind) {
  try {
    const projectionFields = projectionKind === "gm" || projectionKind === "operator" || projectionKind === "crew" || projectionKind === "observer" ? PROJECTION_FIELDS : null;
    if (!projectionFields) return null;
    const captured = capture(session); if (!captured.ok || !isPlainObject(captured.value) || !isPlainObject(captured.value.encounterState)) return null;
    const value = captured.value, encounter = value.encounterState;
    const projection = {
      schemaVersion: value.schemaVersion,
      sessionId: value.sessionId,
      eventId: value.eventId,
      revision: value.revision,
      sessionState: value.sessionState,
      currentStage: encounter.currentStage,
      roundNumber: encounter.roundNumber,
      phase: encounter.phase,
      stationAssignments: encounter.stationAssignments,
      committedStationOrder: encounter.committedStationOrder,
      currentActingStationId: null,
      momentum: encounter.momentum,
      pressureSystems: encounter.pressureSystems,
      activeHazards: encounter.activeHazards,
      visibleEvents: [],
      closeoutStatus: value.closeout.status,
      recoveryStatus: value.recovery.status
    };
    const isolated = capture(projection); return isolated.ok && exactKeys(isolated.value, projectionFields) ? isolated.value : null;
  } catch { return null; }
}
function creationPayload(value) {
  return { eventId: value.eventId, definitionSnapshotId: value.definitionSnapshotId, shipId: value.shipId, eventDefinition: value.eventDefinition, initialEncounterState: value.initialEncounterState };
}
function fingerprint(sessionId, principalUserId, projectionKind, authorityEpoch, expectedRevision, commandKind, payload) {
  return JSON.stringify([sessionId, principalUserId, projectionKind, authorityEpoch, expectedRevision, commandKind, payload]);
}
function replayOrConflict(records, requestId, principalUserId, projectionKind, requestFingerprint, identities) {
  const record = records.find((entry) => entry.requestId === requestId);
  if (!record) return null;
  if (record.principalUserId !== principalUserId || record.projectionKind !== projectionKind || record.fingerprint !== requestFingerprint) return failure([diagnostic("m11-request-id-conflict", "request.requestId")], identities);
  const captured = capture(record.response);
  return captured.ok ? captured.value : failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
}
function ownershipForGms(users, levels) {
  if (!Array.isArray(users) || typeof levels?.NONE !== "number" || typeof levels?.OWNER !== "number") return null;
  const entries = [["default", levels.NONE]], ids = new Set();
  for (const user of users) {
    if (!nonBlank(user?.id) || typeof user.isGM !== "boolean" || ids.has(user.id)) return null;
    if (user.isGM) { entries.push([user.id, levels.OWNER]); ids.add(user.id); }
  }
  return Object.fromEntries(entries);
}
function generatedId(context) { try { const generator = context?.createDocumentId ?? globalThis.foundry?.utils?.randomID; const id = typeof generator === "function" ? generator() : globalThis.crypto?.randomUUID?.(); return nonBlank(id) ? id : null; } catch { return null; } }

function closeoutEvent(type, session, previousRevision, revision) {
  return { type, sessionId: session.sessionId, eventId: session.eventId, definitionSnapshotId: session.definitionSnapshotId, shipId: session.shipId, sourceCheckpointId: null, sourceCheckpointRevision: null, recoveryAuthorityUserId: null, previousRevision, revision };
}
function closeoutAudit(session, requestId, actorUserId, authorityEpoch, previousRevision, revision, occurredAt, kind, details) {
  return { auditId: auditId(session.sessionId, session.auditHistory.length, kind), kind, sessionId: session.sessionId, requestId, actorUserId, authorityEpoch, previousRevision, revision, occurredAt, details };
}
function closeoutResponse(candidate, requestId, event = null) {
  const response = success(candidate, requestId);
  response.events = event ? [capture(event).value] : [];
  return response;
}
function m10Failure(result) { return isPlainObject(result) && Array.isArray(result.errors) && result.errors.length > 0; }
function validM10OperationSuccess(result, statuses, session, applicationId, closeoutId) {
  return isPlainObject(result) && exactKeys(result, ["ok", "status", "applicationId", "closeoutId", "shipId", "revision", "events", "errors", "warnings"])
    && result.ok === true && statuses.includes(result.status) && result.applicationId === applicationId && result.closeoutId === closeoutId && result.shipId === session.shipId
    && safeInteger(result.revision) && Array.isArray(result.events) && Array.isArray(result.errors) && result.errors.length === 0 && Array.isArray(result.warnings);
}
async function callM10(api, request) { try { if (typeof api !== "function") return null; const result = await api(request); const captured = capture(result); return captured.ok ? captured.value : null; } catch { return null; } }
function validShipCheckpointResult(result, session, receipt) {
  return isPlainObject(result) && exactKeys(result, ["ok", "readyForSessionCommit", "applicationId", "closeoutId", "shipId", "revision", "errors", "warnings"])
    && result.ok === true && result.readyForSessionCommit === true && result.applicationId === receipt.applicationId && result.closeoutId === receipt.closeoutId && result.shipId === receipt.shipId
    && safeInteger(result.revision) && result.revision === session.closeout.expectedShipRevision + 1 && Array.isArray(result.errors) && result.errors.length === 0 && Array.isArray(result.warnings) && result.warnings.length === 0;
}
function closeoutReviewRequest(session, auth, payload) {
  if (!isPlainObject(payload) || !exactKeys(payload, ["confirmed", "previewRequest", "suppliedPreview"]) || typeof payload.confirmed !== "boolean" || !isPlainObject(payload.previewRequest) || !isPlainObject(payload.suppliedPreview)) return null;
  return { kind: "m10-closeout-review", sessionId: session.sessionId, gmUserId: auth.authenticatedUserId, confirmed: payload.confirmed, previewRequest: payload.previewRequest, suppliedPreview: payload.suppliedPreview };
}
function closeoutPlanEvidence(session) {
  const plan = session.closeout?.acceptedApplicationPlan;
  return isPlainObject(plan) && exactKeys(plan, ["previewRequest", "reviewRequest", "applicationPlan"]) && isPlainObject(plan.previewRequest) && isPlainObject(plan.reviewRequest) && isPlainObject(plan.applicationPlan) ? plan : null;
}
function validApplicationPlan(plan, session, auth, closeoutId) {
  const fields = ["schemaVersion", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "expectedEncounterRevision", "expectedShipRevision", "gmUserId", "persistentProposals", "temporaryResetPlan", "expectedPreview"];
  return exactKeys(plan, fields) && plan.schemaVersion === 1 && plan.applicationId === `arcflight-closeout-application:${JSON.stringify([closeoutId])}` && plan.closeoutId === closeoutId && plan.eventId === session.eventId && plan.sessionId === session.sessionId && plan.definitionSnapshotId === session.definitionSnapshotId && plan.shipId === session.shipId && safeInteger(plan.expectedEncounterRevision) && plan.expectedEncounterRevision === session.encounterState.revision && safeInteger(plan.expectedShipRevision) && plan.gmUserId === auth.authenticatedUserId && Array.isArray(plan.persistentProposals) && isPlainObject(plan.temporaryResetPlan) && isPlainObject(plan.expectedPreview);
}
function validCloseoutReviewResult(result) {
  return isPlainObject(result) && exactKeys(result, ["ok", "readyForEmergencyResponse", "readyForControlledApplication", "closeoutId", "emergencyResponseHandoff", "applicationPlan", "errors", "warnings"])
    && result.ok === true && result.readyForEmergencyResponse === false && result.readyForControlledApplication === true && nonBlank(result.closeoutId)
    && result.emergencyResponseHandoff === null && Array.isArray(result.errors) && result.errors.length === 0 && Array.isArray(result.warnings);
}
function closeoutResponseForM10(result, requestId, session) {
  if (!isPlainObject(result)) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], { requestId, sessionId: session.sessionId });
  const out = success(session, requestId);
  out.status = SESSION_STATES.has(result.status) ? result.status : session.sessionState;
  out.events = Array.isArray(result.events) ? capture(result.events).value ?? [] : [];
  out.errors = Array.isArray(result.errors) ? capture(result.errors).value ?? [] : [];
  out.warnings = Array.isArray(result.warnings) ? capture(result.warnings).value ?? [] : [];
  return out;
}
function sessionWriteClassification(document, sessionId, documentIdValue, candidate, prior, requestId, context, options = {}) {
  try {
    const resolved = resolveSessionDocument(sessionId, context);
    if (resolved.error || resolved.match.documentId !== documentIdValue) return failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId });
    const reread = resolved.match.session;
    if (equal(reread, candidate) && pristineSession(reread, documentIdValue, { replayContext: context })) {
      if (options.successResponse) {
        const isolated = capture(options.successResponse); if (!isolated.ok) return failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId });
        return isolated.value;
      }
      return success(reread, requestId);
    }
    if (equal(reread, prior)) return failure([diagnostic(options.operationVerified ? "m11-recovery-required" : "m11-session-write-failed", options.operationVerified ? "recovery" : VOYAGE_SESSION_PATH)], { requestId, sessionId });
    return failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId });
  } catch { return failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId }); }
}
function closeoutBoundary(value, auth, match, context, identities) {
  const current = authority(context, { requireConnection: true });
  if (current.error || current.authenticatedUserId !== auth.authenticatedUserId || current.authenticatedConnectionId !== auth.authenticatedConnectionId || current.activeGmUserId !== auth.activeGmUserId) return { error: current.error ?? diagnostic("m11-active-gm-required", "transport.connection") };
  const resolved = resolveSessionDocument(value.sessionId, context);
  if (resolved.error) return { error: resolved.error };
  if (resolved.match.documentId !== match.documentId || resolved.match.session.revision !== value.expectedRevision || resolved.match.session.authorityEpoch !== value.authorityEpoch || resolved.match.session.activeGmUserId !== current.activeGmUserId || !pristineSession(resolved.match.session, resolved.match.documentId, { replayContext: context })) return { error: diagnostic("m11-recovery-required", "recovery") };
  return { match: resolved.match, auth: current };
}
async function dispatchCloseoutCommand(value, identities, auth, match, context, coordinated = false, trustedWitness = null) {
  const commandKind = value.commandKind;
  if (!["closeout-review", "closeout-prepare", "closeout-reserve", "closeout-ship-apply", "closeout-session-commit"].includes(commandKind)) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
  if (!coordinated) {
    const gm = authority(context, { requireConnection: true }); if (gm.error) return failure([gm.error], identities);
    const coordinator = transferCoordinator(context); if (coordinator.error) return failure([coordinator.error], identities);
    const descriptor = coordinatorDescriptor(value, match.documentId, gm); if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
    return runExclusiveTransfer(coordinator, descriptor, (witness) => withTransferLock(value.sessionId, async () => {
      const locked = authority(context, { requireConnection: true }); if (locked.error) return failure([locked.error], identities);
      if (locked.authenticatedUserId !== descriptor.authenticatedUserId || locked.authenticatedConnectionId !== descriptor.connectionId || locked.activeGmUserId !== descriptor.activeGmUserId) return failure([diagnostic("m11-active-gm-required", "transport.connection")], identities);
      const latest = resolveSessionDocument(value.sessionId, context); if (latest.error) return failure([latest.error], identities);
      if (latest.match.documentId !== descriptor.sessionDocumentId || !pristineSession(latest.match.session, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
      return dispatchCloseoutCommand(value, identities, locked, latest.match, context, true, witness);
    }), identities, { nonWinnerCode: "m11-control-transfer-required", nonWinnerPath: "authorityEpoch" });
  }
  if (match.session.activeGmUserId !== auth.activeGmUserId) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  const requestFingerprint = fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, commandKind, value.payload);
  const replay = replayOrConflict(match.session.processedRequests, value.requestId, auth.authenticatedUserId, "gm", requestFingerprint, identities); if (replay) return replay;
  if (value.authorityEpoch !== match.session.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  if (value.expectedRevision !== match.session.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
  // Closeout review carries untrusted M10 preview evidence for canonical
  // re-analysis; the owning M10 validator, not this recursive authority scan,
  // decides whether that domain evidence is acceptable. Other commands have
  // no caller-authored domain payload and retain the hostile authority scan.
  if (commandKind !== "closeout-review" && containsForbiddenPayloadAuthority(value.payload)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
  const expectedPayloadKeys = commandKind === "closeout-review" ? ["confirmed", "previewRequest", "suppliedPreview"] : [];
  if (!exactKeys(value.payload, expectedPayloadKeys)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
  if (commandKind === "closeout-ship-apply") {
    const boundary = closeoutBoundary(value, auth, match, context, identities); if (boundary.error) return failure([boundary.error], identities); match = boundary.match; auth = boundary.auth;
    if (!closeoutLifecycleAllowed(match.session, commandKind)) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
    const plan = closeoutPlanEvidence(match.session); if (!plan || !nonBlank(match.session.closeout.applicationId) || !nonBlank(match.session.closeout.reservationId)) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
    const api = m10Function(context, "verifyVoyageEncounterCloseoutShipCheckpoint", verifyVoyageEncounterCloseoutShipCheckpoint); if (!api) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const result = await callM10(api, { kind: "m10-verify-closeout-ship-checkpoint", applicationId: match.session.closeout.applicationId, reservationId: match.session.closeout.reservationId });
    if (!validShipCheckpointResult(result, match.session, match.session.closeout.sessionReservationReceipt)) return m10Failure(result) ? failure(result.errors, identities) : failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    return persistShipCheckpointRecord(match, value, auth, context, result);
  }
  if (commandKind === "closeout-review") {
    const boundary = closeoutBoundary(value, auth, match, context, identities); if (boundary.error) return failure([boundary.error], identities); match = boundary.match; auth = boundary.auth;
    if (!closeoutLifecycleAllowed(match.session, commandKind)) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
    const reviewRequest = closeoutReviewRequest(match.session, auth, value.payload); if (!reviewRequest) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
    const api = m10Function(context, "analyzeVoyageEncounterCloseoutReview", analyzeVoyageEncounterCloseoutReview); if (!api) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const review = await callM10(api, reviewRequest);
    if (!validCloseoutReviewResult(review) || !isPlainObject(review.applicationPlan) || !validApplicationPlan(review.applicationPlan, match.session, auth, review.closeoutId)) return m10Failure(review) ? failure(review.errors, identities) : failure([diagnostic("m11-closeout-review-not-accepted", "closeout")], identities);
    const reviewedBoundary = closeoutBoundary(value, auth, match, context, identities); if (reviewedBoundary.error) return failure([reviewedBoundary.error], identities); match = reviewedBoundary.match; auth = reviewedBoundary.auth;
    const plan = capture({ previewRequest: reviewRequest.previewRequest, reviewRequest, applicationPlan: review.applicationPlan }); if (!plan.ok) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const candidateCapture = capture(match.session); if (!candidateCapture.ok) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const candidate = candidateCapture.value, previousRevision = candidate.revision, revision = previousRevision + 1;
    candidate.revision = revision; candidate.sessionState = "persistent-application";
    candidate.closeout = { status: "accepted-for-application", applicationId: review.applicationPlan.applicationId, closeoutId: review.closeoutId, acceptedApplicationPlan: plan.value, reservationId: null, expectedEncounterRevision: review.applicationPlan.expectedEncounterRevision, expectedShipRevision: review.applicationPlan.expectedShipRevision, sessionReservationReceipt: null, sessionCommitReceipt: null };
    const event = closeoutEvent("voyage.m11-closeout-review-accepted", candidate, previousRevision, revision);
    if (!trustedWitness?.occurredAt) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
    const audit = closeoutAudit(candidate, value.requestId, auth.authenticatedUserId, candidate.authorityEpoch, previousRevision, revision, trustedWitness.occurredAt, "closeout-review-accepted", { applicationId: candidate.closeout.applicationId, closeoutId: candidate.closeout.closeoutId, previousSessionState: "event-closeout-review", nextSessionState: "persistent-application" });
    candidate.events.push(event); candidate.auditHistory.push(audit);
    candidate.checkpoints.push({ checkpointId: `arcflight-voyage-checkpoint:${JSON.stringify([candidate.sessionId, "before-persistent-application", revision])}`, kind: "before-persistent-application", sessionId: candidate.sessionId, revision, encounterRevision: candidate.encounterState.revision, eventCount: candidate.events.length, sessionState: candidate.sessionState, encounterState: capture(candidate.encounterState).value, closeout: capture(candidate.closeout).value, authorityEpoch: candidate.authorityEpoch, invalidated: false });
    const response = closeoutResponse(candidate, value.requestId, event);
    candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind: "gm", fingerprint: requestFingerprint, commandKind, resultKind: "closeout-review-accepted", resultRevision: revision, response });
    if (!pristineSession(candidate, match.documentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    try { await match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(match.document, value.sessionId, match.documentId, candidate, match.session, value.requestId, context, { successResponse: response }); }
    return sessionWriteClassification(match.document, value.sessionId, match.documentId, candidate, match.session, value.requestId, context, { successResponse: response });
  }
  if (commandKind === "closeout-prepare") {
    const boundary = closeoutBoundary(value, auth, match, context, identities); if (boundary.error) return failure([boundary.error], identities); match = boundary.match; auth = boundary.auth;
    if (!closeoutLifecycleAllowed(match.session, commandKind)) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
    const plan = closeoutPlanEvidence(match.session); if (!plan) return failure([diagnostic("m11-closeout-review-not-accepted", "closeout")], identities);
    const api = m10Function(context, "persistVoyageEncounterApprovedCloseout", persistVoyageEncounterApprovedCloseout); if (!api) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const result = await callM10(api, { kind: "m10-persist-approved-closeout", previewRequest: plan.previewRequest, reviewRequest: plan.reviewRequest, applicationPlan: plan.applicationPlan });
    if (!validM10OperationSuccess(result, ["prepared-awaiting-session", "already-prepared-awaiting-session"], match.session, match.session.closeout.applicationId, match.session.closeout.closeoutId)) return m10Failure(result) ? failure(result.errors, identities) : failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    return persistPrepareRecord(match, value, auth, context, result);
  }
  if (commandKind === "closeout-reserve") {
    const boundary = closeoutBoundary(value, auth, match, context, identities); if (boundary.error) return failure([boundary.error], identities); match = boundary.match; auth = boundary.auth;
    if (!closeoutLifecycleAllowed(match.session, commandKind)) return failure([diagnostic("m11-reservation-not-ready", "closeout")], identities);
    const receipt = buildReservationReceipt(match.session, context); if (!receipt) return failure([diagnostic("m11-reservation-not-ready", "closeout")], identities);
    const api = m10Function(context, "continueVoyageEncounterCloseoutReservation", continueVoyageEncounterCloseoutReservation); if (!api) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const result = await callM10(api, { kind: "m10-continue-closeout-reservation", applicationId: match.session.closeout.applicationId, receipt });
    if (!validM10OperationSuccess(result, ["ship-applied-awaiting-session", "already-ship-applied-awaiting-session"], match.session, match.session.closeout.applicationId, match.session.closeout.closeoutId)
      || result.revision !== match.session.closeout.expectedShipRevision + 1) return m10Failure(result) ? failure(result.errors, identities) : failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const checkpointApi = m10Function(context, "verifyVoyageEncounterCloseoutShipCheckpoint", verifyVoyageEncounterCloseoutShipCheckpoint); if (!checkpointApi) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const checkpoint = await callM10(checkpointApi, { kind: "m10-verify-closeout-ship-checkpoint", applicationId: receipt.applicationId, reservationId: receipt.reservationId });
    if (!validShipCheckpointResult(checkpoint, match.session, receipt)) return m10Failure(checkpoint) ? failure(checkpoint.errors, identities) : failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    return persistCloseoutReceiptState(match, value, auth, context, result, receipt, "ship-applied-awaiting-session", "voyage.m11-closeout-session-reserved", false, trustedWitness);
  }
  if (commandKind === "closeout-session-commit") {
    const boundary = closeoutBoundary(value, auth, match, context, identities); if (boundary.error) return failure([boundary.error], identities); match = boundary.match; auth = boundary.auth;
    if (!closeoutLifecycleAllowed(match.session, commandKind) || !exactReservationReceipt(match.session.closeout.sessionReservationReceipt, match.session.closeout, match.session)) return failure([diagnostic("m11-commit-not-ready", "closeout")], identities);
    const receipt = match.session.closeout.status === "commit-pending" ? match.session.closeout.sessionCommitReceipt : await resolveCommitReceipt(match.session, context); if (!receipt || !exactCommitReceipt(receipt, match.session.closeout, match.session)) return failure([diagnostic("m11-m10-handoff-invalid", "receipt")], identities);
    const checkpointApi = m10Function(context, "verifyVoyageEncounterCloseoutShipCheckpoint", verifyVoyageEncounterCloseoutShipCheckpoint); if (!checkpointApi) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const checkpoint = await callM10(checkpointApi, { kind: "m10-verify-closeout-ship-checkpoint", applicationId: receipt.applicationId, reservationId: receipt.reservationId });
    if (!validShipCheckpointResult(checkpoint, match.session, match.session.closeout.sessionReservationReceipt)) return m10Failure(checkpoint) ? failure(checkpoint.errors, identities) : failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const candidateResult = match.session.closeout.status === "commit-pending" ? success(match.session, value.requestId) : await persistCloseoutReceiptState(match, value, auth, context, null, receipt, "commit-pending", "voyage.m11-closeout-session-commit-pending", true, trustedWitness);
    if (!candidateResult.ok) return candidateResult;
    const finalizedAuth = authority(context, { requireConnection: true }); if (finalizedAuth.error || finalizedAuth.authenticatedUserId !== auth.authenticatedUserId || finalizedAuth.authenticatedConnectionId !== auth.authenticatedConnectionId || finalizedAuth.activeGmUserId !== auth.activeGmUserId) return failure([finalizedAuth.error ?? diagnostic("m11-active-gm-required", "transport.connection")], identities);
    const finalizedSession = resolveSessionDocument(value.sessionId, context); if (finalizedSession.error || finalizedSession.match.session.revision !== candidateResult.revision || finalizedSession.match.session.closeout.status !== "commit-pending") return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    const api = m10Function(context, "finalizeVoyageEncounterCloseoutReceipt", finalizeVoyageEncounterCloseoutReceipt); if (!api) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const finalized = await callM10(api, { kind: "m10-finalize-closeout-receipt", applicationId: match.session.closeout.applicationId, receipt });
    if (!validM10OperationSuccess(finalized, ["committed", "already-committed"], match.session, receipt.applicationId, receipt.closeoutId)
      || finalized.revision !== receipt.completedCloseoutSnapshot.shipRevision) return m10Failure(finalized) ? failure(finalized.errors, identities) : failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const finalValue = match.session.closeout.status === "commit-pending" ? value : { ...value, expectedRevision: candidateResult.revision };
    return finalizePendingCloseoutSession(match, finalValue, auth, context, trustedWitness);
  }
  return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
}
function buildReservationReceipt(session, context) {
  try {
    for (const key of ["buildVoyageEventSessionPressureBreachSources", "buildPressureBreachSources"]) {
      if (typeof context?.[key] === "function") {
        const builtSources = capture(context[key](capture(session).value));
        if (!builtSources.ok || !Array.isArray(builtSources.value)) return null;
        const plan = session.closeout.acceptedApplicationPlan?.applicationPlan;
        if (!isPlainObject(plan)) return null;
        const customReceipt = { kind: "voyage.m11-closeout-session-reserved", reservationId: `arcflight-closeout-reservation:${JSON.stringify([plan.applicationId])}`, activeGmUserId: session.activeGmUserId, applicationId: plan.applicationId, closeoutId: plan.closeoutId ?? session.closeout.closeoutId, eventId: session.eventId, sessionId: session.sessionId, definitionSnapshotId: session.definitionSnapshotId, shipId: session.shipId, expectedEncounterRevision: session.closeout.expectedEncounterRevision, pressureBreachSources: builtSources.value };
        return exactReservationReceipt(customReceipt, session.closeout, session) ? customReceipt : null;
      }
    }
    if (typeof context?.buildVoyageEventSessionReservationReceipt === "function") {
      const built = capture(context.buildVoyageEventSessionReservationReceipt(capture(session).value)); if (built.ok && exactReservationReceipt(built.value, session.closeout, session)) return built.value;
    }
    const plan = session.closeout.acceptedApplicationPlan?.applicationPlan;
    if (!isPlainObject(plan)) return null;
    const pressureBreachSources = canonicalPressureSources(session);
    if (!pressureBreachSources) return null;
    const receipt = { kind: "voyage.m11-closeout-session-reserved", reservationId: `arcflight-closeout-reservation:${JSON.stringify([plan.applicationId])}`, activeGmUserId: session.activeGmUserId, applicationId: plan.applicationId, closeoutId: plan.closeoutId ?? session.closeout.closeoutId, eventId: session.eventId, sessionId: session.sessionId, definitionSnapshotId: session.definitionSnapshotId, shipId: session.shipId, expectedEncounterRevision: session.closeout.expectedEncounterRevision, pressureBreachSources };
    return exactReservationReceipt(receipt, session.closeout, session) ? receipt : null;
  } catch { return null; }
}
async function resolveCommitReceipt(session, context) {
  try {
    const resolver = m10Function(context, "resolveVoyageEncounterCloseoutCommitEvidence", null);
    const reservation = session.closeout.sessionReservationReceipt;
    if (!resolver || !exactReservationReceipt(reservation, session.closeout, session)) return null;
    const request = { kind: "m10-resolve-closeout-commit-evidence", applicationId: reservation.applicationId, reservationId: reservation.reservationId, sessionId: session.sessionId, eventId: session.eventId, definitionSnapshotId: session.definitionSnapshotId, shipId: session.shipId, expectedEncounterRevision: reservation.expectedEncounterRevision };
    if (!exactKeys(request, M10_COMMIT_EVIDENCE_REQUEST_FIELDS)) return null;
    const result = await callM10(resolver, request);
    if (!isPlainObject(result) || !exactKeys(result, M10_COMMIT_EVIDENCE_FIELDS) || result.ok !== true || ![result.applicationId, result.closeoutId, result.eventId, result.sessionId, result.definitionSnapshotId, result.shipId].every(nonBlank)
      || result.applicationId !== reservation.applicationId || result.eventId !== session.eventId || result.sessionId !== session.sessionId || result.definitionSnapshotId !== session.definitionSnapshotId || result.shipId !== session.shipId
      || !safeInteger(result.previousEncounterRevision) || result.previousEncounterRevision !== reservation.expectedEncounterRevision || !safeInteger(result.encounterRevision) || !validCompletedSnapshotShape(result.completedCloseoutSnapshot, session) || result.encounterRevision !== result.completedCloseoutSnapshot.encounterRevision
      || !Array.isArray(result.encounterEvents) || result.encounterEvents.length === 0
      || !Array.isArray(result.pressureBreachSources) || !equal(result.pressureBreachSources, reservation.pressureBreachSources)
      || !result.errors || result.errors.length !== 0 || !result.warnings || result.warnings.length !== 0) return null;
    let sourceIndex = 0;
    if (!result.encounterEvents.every((event) => validM10CommitEvent(event, session, result.applicationId, result.closeoutId, event?.type === "voyage.pressure-breach-applied" ? result.pressureBreachSources[sourceIndex++] : null))
      || (!validPressureSources(result.pressureBreachSources, session) && !validReceiptPressureSources(result.pressureBreachSources, session, result.encounterEvents))) return null;
    if (!result.encounterEvents.some((event) => event.type === "voyage.closeout-applied")) return null;
    return { kind: "voyage.m11-closeout-session-committed", reservationId: reservation.reservationId, activeGmUserId: session.activeGmUserId, applicationId: result.applicationId, closeoutId: result.closeoutId, eventId: result.eventId, sessionId: result.sessionId, definitionSnapshotId: result.definitionSnapshotId, shipId: result.shipId, previousEncounterRevision: result.previousEncounterRevision, encounterRevision: result.encounterRevision, completedCloseoutSnapshot: result.completedCloseoutSnapshot, encounterEvents: result.encounterEvents, pressureBreachSources: result.pressureBreachSources };
  } catch { return null; }
}
async function persistPrepareRecord(match, value, auth, context, result) {
  const boundary = closeoutBoundary(value, auth, match, context, { requestId: value.requestId, sessionId: value.sessionId }); if (boundary.error) return failure([boundary.error], { requestId: value.requestId, sessionId: value.sessionId }); match = boundary.match; auth = boundary.auth;
  const prior = match.session, captured = capture(prior); if (!captured.ok) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], { requestId: value.requestId, sessionId: value.sessionId });
  const candidate = captured.value, response = success(candidate, value.requestId);
  if (result.status === "prepared-awaiting-session" || result.status === "already-prepared-awaiting-session") candidate.closeout.status = "prepared-awaiting-session";
  if (result.status === "ship-applied-awaiting-session" || result.status === "already-ship-applied-awaiting-session") candidate.closeout.status = "ship-applied-awaiting-session";
  if (result.status === "committed" || result.status === "already-committed") candidate.closeout.status = "committed";
  candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind: "gm", fingerprint: fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload), commandKind: "closeout-prepare", resultKind: "prepared-awaiting-session", resultRevision: candidate.revision, response });
  if (!pristineSession(candidate, match.documentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], { requestId: value.requestId, sessionId: value.sessionId });
  try { await match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(match.document, value.sessionId, match.documentId, candidate, prior, value.requestId, context, { successResponse: response }); }
  return sessionWriteClassification(match.document, value.sessionId, match.documentId, candidate, prior, value.requestId, context, { successResponse: response });
}
async function persistShipCheckpointRecord(match, value, auth, context, result) {
  const boundary = closeoutBoundary(value, auth, match, context, { requestId: value.requestId, sessionId: value.sessionId }); if (boundary.error) return failure([boundary.error], { requestId: value.requestId, sessionId: value.sessionId }); match = boundary.match; auth = boundary.auth;
  const prior = match.session, captured = capture(prior); if (!captured.ok) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], { requestId: value.requestId, sessionId: value.sessionId });
  const candidate = captured.value, response = closeoutResponseForM10(result, value.requestId, candidate);
  if (!response.ok) return response;
  candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind: "gm", fingerprint: fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload), commandKind: "closeout-ship-apply", resultKind: "closeout-ship-checkpoint-verified", resultRevision: candidate.revision, response });
  if (!pristineSession(candidate, match.documentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], { requestId: value.requestId, sessionId: value.sessionId });
  try { await match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(match.document, value.sessionId, match.documentId, candidate, prior, value.requestId, context, { successResponse: response }); }
  return sessionWriteClassification(match.document, value.sessionId, match.documentId, candidate, prior, value.requestId, context, { successResponse: response });
}
async function persistCloseoutReceiptState(match, value, auth, context, m10Result, receipt, status, eventType, commit = false, trustedWitness = null) {
  const boundary = closeoutBoundary(value, auth, match, context, { requestId: value.requestId, sessionId: value.sessionId }); if (boundary.error) return failure([boundary.error], { requestId: value.requestId, sessionId: value.sessionId }); match = boundary.match; auth = boundary.auth;
  const prior = match.session;
  const captured = capture(prior); if (!captured.ok) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], { requestId: value.requestId, sessionId: value.sessionId });
  const candidate = captured.value, previousRevision = candidate.revision, revision = previousRevision + 1;
  candidate.revision = revision; candidate.sessionState = status === "committed" ? "completed" : "persistent-application";
  candidate.closeout.status = status;
  if (status === "ship-applied-awaiting-session") { candidate.closeout.reservationId = receipt.reservationId; candidate.closeout.sessionReservationReceipt = capture(receipt).value; }
  if (status === "committed" || status === "commit-pending") {
    candidate.closeout.reservationId = receipt.reservationId; candidate.closeout.sessionCommitReceipt = capture(receipt).value;
    if (status === "committed") try {
      const rebuilt = typeof context?.buildVoyageEventSessionCompletedEncounterState === "function" ? capture(context.buildVoyageEventSessionCompletedEncounterState({ kind: "m10-build-completed-encounter-state", sessionId: candidate.sessionId, eventId: candidate.eventId, definitionSnapshotId: candidate.definitionSnapshotId, shipId: candidate.shipId, priorEncounterState: capture(candidate.encounterState).value, completedCloseoutSnapshot: receipt.completedCloseoutSnapshot })) : { ok: false };
      if (!rebuilt.ok || !isPlainObject(rebuilt.value)) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], { requestId: value.requestId, sessionId: value.sessionId });
      candidate.encounterState = rebuilt.value;
    } catch { return failure([diagnostic("m11-m10-handoff-invalid", "m10")], { requestId: value.requestId, sessionId: value.sessionId }); }
  }
  const event = closeoutEvent(eventType, candidate, previousRevision, revision);
  candidate.events.push(event);
  const auditKind = status === "committed" ? "closeout-session-committed" : status === "commit-pending" ? "closeout-session-commit-pending" : "closeout-session-reserved";
  const details = { applicationId: candidate.closeout.applicationId, closeoutId: candidate.closeout.closeoutId, previousSessionState: prior.sessionState, nextSessionState: candidate.sessionState };
  if (!trustedWitness?.occurredAt) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], { requestId: value.requestId, sessionId: value.sessionId });
  const audit = closeoutAudit(candidate, value.requestId, auth.authenticatedUserId, candidate.authorityEpoch, previousRevision, revision, trustedWitness.occurredAt, auditKind, details);
  candidate.auditHistory.push(audit);
  const response = closeoutResponse(candidate, value.requestId, event);
  candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind: "gm", fingerprint: fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload), commandKind: value.commandKind, resultKind: status === "committed" ? "closeout-session-committed" : status === "commit-pending" ? "closeout-session-commit-pending" : "closeout-session-reserved", resultRevision: revision, response });
  if (!pristineSession(candidate, match.documentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], { requestId: value.requestId, sessionId: value.sessionId });
  try { await match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(match.document, value.sessionId, match.documentId, candidate, prior, value.requestId, context, { operationVerified: Boolean(m10Result), successResponse: response }); }
  return sessionWriteClassification(match.document, value.sessionId, match.documentId, candidate, prior, value.requestId, context, { operationVerified: Boolean(m10Result), successResponse: response });
}
async function finalizePendingCloseoutSession(match, value, auth, context, trustedWitness = null) {
  const boundary = closeoutBoundary(value, auth, match, context, { requestId: value.requestId, sessionId: value.sessionId });
  if (boundary.error) return failure([boundary.error], { requestId: value.requestId, sessionId: value.sessionId });
  const prior = boundary.match.session;
  if (!closeoutLifecycleAllowed(prior, "closeout-session-commit") || prior.closeout.status !== "commit-pending") return failure([diagnostic("m11-commit-not-ready", "closeout")], { requestId: value.requestId, sessionId: value.sessionId });
  const captured = capture(prior); if (!captured.ok) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], { requestId: value.requestId, sessionId: value.sessionId });
  const candidate = captured.value, previousRevision = candidate.revision, revision = previousRevision + 1;
  candidate.revision = revision;
  candidate.closeout.status = "committed";
  candidate.sessionState = "completed";
  if (typeof context?.buildVoyageEventSessionCompletedEncounterState === "function") {
    try {
      const rebuilt = capture(context.buildVoyageEventSessionCompletedEncounterState({ kind: "m10-build-completed-encounter-state", sessionId: candidate.sessionId, eventId: candidate.eventId, definitionSnapshotId: candidate.definitionSnapshotId, shipId: candidate.shipId, priorEncounterState: capture(candidate.encounterState).value, completedCloseoutSnapshot: candidate.closeout.sessionCommitReceipt?.completedCloseoutSnapshot }));
      if (!rebuilt.ok || !isPlainObject(rebuilt.value)) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], { requestId: value.requestId, sessionId: value.sessionId });
      candidate.encounterState = rebuilt.value;
    } catch { return failure([diagnostic("m11-m10-handoff-invalid", "m10")], { requestId: value.requestId, sessionId: value.sessionId }); }
  } else return failure([diagnostic("m11-m10-handoff-invalid", "m10")], { requestId: value.requestId, sessionId: value.sessionId });
  if (!trustedWitness?.occurredAt) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], { requestId: value.requestId, sessionId: value.sessionId });
  const pendingRecord = candidate.processedRequests.find((record) => record.commandKind === "closeout-session-commit" && record.resultKind === "closeout-session-commit-pending");
  if (!pendingRecord) return failure([diagnostic("m11-recovery-required", "recovery")], { requestId: value.requestId, sessionId: value.sessionId });
  const event = closeoutEvent("voyage.m11-closeout-session-committed", candidate, previousRevision, revision);
  candidate.events.push(event);
  const audit = closeoutAudit(candidate, value.requestId, auth.authenticatedUserId, candidate.authorityEpoch, previousRevision, revision, trustedWitness.occurredAt, "closeout-session-committed", { applicationId: candidate.closeout.applicationId, closeoutId: candidate.closeout.closeoutId, previousSessionState: "persistent-application", nextSessionState: "completed" });
  candidate.auditHistory.push(audit);
  const response = closeoutResponse(candidate, value.requestId, event);
  if (!pendingRecord || pendingRecord.requestId !== value.requestId) {
    candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind: "gm", fingerprint: fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload), commandKind: "closeout-session-commit", resultKind: "closeout-session-committed", resultRevision: revision, response });
  }
  if (!pristineSession(candidate, boundary.match.documentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], { requestId: value.requestId, sessionId: value.sessionId });
  try { await boundary.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); }
  catch { return sessionWriteClassification(boundary.match.document, value.sessionId, boundary.match.documentId, candidate, prior, value.requestId, context, { operationVerified: true, successResponse: response }); }
  return sessionWriteClassification(boundary.match.document, value.sessionId, boundary.match.documentId, candidate, prior, value.requestId, context, { operationVerified: true, successResponse: response });
}

function task2Failure(identities) {
  return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
}

function canonicalTask2Stations(session, context) {
  try {
    const resolver = context?.resolveEventDefinitionSnapshot;
    if (typeof resolver !== "function") return null;
    const resolved = resolver(session.eventId, session.definitionSnapshotId);
    if (resolved && typeof resolved.then === "function") return null;
    const definition = capture(resolved);
    const round = definition.ok && Array.isArray(definition.value?.rounds)
      ? definition.value.rounds[session.encounterState.roundNumber - 1]
      : null;
    const authored = round && Array.isArray(round.availableStations) ? capture(round.availableStations) : null;
    if (!authored?.ok || authored.value.length !== session.encounterState.availableStations.length) return null;
    const currentIds = session.encounterState.availableStations.map((entry) => entry?.stationId);
    if (!authored.value.every((entry, index) => entry?.stationId === currentIds[index])) return null;
    return authored.value;
  } catch {
    return null;
  }
}

function bareTask2Stations(stations) {
  return Array.isArray(stations) && stations.every((station) => isPlainObject(station) && Object.keys(station).length === 1 && nonBlank(station.stationId));
}

async function task2WorkingState(prior, context) {
  const captured = capture(prior); if (!captured.ok) return null;
  const current = captured.value;
  const stations = current.encounterState?.availableStations;
  const canonical = canonicalTask2Stations(current, context);
  if (canonical && Array.isArray(stations) && stations.length > 0 && equal(stations, canonical)) return current;
  if (canonical) {
    if (bareTask2Stations(stations)) {
      current.encounterState.availableStations = canonical;
      return current;
    }
    return null;
  }
  try {
    const resolver = context?.resolveEventDefinitionSnapshot;
    if (typeof resolver !== "function") return null;
    const definition = capture(await resolver(current.eventId, current.definitionSnapshotId));
    const round = definition.ok && Array.isArray(definition.value?.rounds) ? definition.value.rounds[current.encounterState.roundNumber - 1] : null;
    const authored = round && Array.isArray(round.availableStations) ? capture(round.availableStations) : null;
    if (!authored?.ok || authored.value.length !== current.encounterState.availableStations.length) return null;
    current.encounterState.availableStations = authored.value;
    return current;
  } catch { return null; }
}

function task2DomainApply(prior, commandKind, payload) {
  try {
    if (commandKind === "station-selection-clear") {
      return applyVoyageEncounterStationActionSelectionClear(prior.encounterState, payload);
    }
    if (commandKind === "station-order") {
      const existing = Array.isArray(prior.encounterState.proposedStationOrder) && prior.encounterState.proposedStationOrder.length > 0;
      return (existing ? applyVoyageEncounterStationOrderProposalChange : applyVoyageEncounterStationOrderProposal)(prior.encounterState, payload);
    }
    if (commandKind === "plan-lock") return applyVoyageEncounterCrewPlanningLock(prior.encounterState, payload);
    if (commandKind !== "station-selection") return null;

    let result;
    const hasSelection = Object.hasOwn(prior.encounterState.selections, payload.stationId);
    const currentSelection = hasSelection ? prior.encounterState.selections[payload.stationId] : null;
    const actionChanged = !hasSelection || currentSelection.actionId !== payload.actionId;
    let next = prior.encounterState;

    if (actionChanged) {
      const actionRequest = { stationId: payload.stationId, actionId: payload.actionId };
      result = hasSelection
        ? applyVoyageEncounterStationActionSelectionChange(next, actionRequest)
        : applyVoyageEncounterStationActionSelection(next, actionRequest);
      if (!result?.ok) return result;
      next = result.nextState;

      const approachRequest = { stationId: payload.stationId, approachId: payload.approachId };
      result = applyVoyageEncounterStationApproachSelection(next, approachRequest);
      if (!result?.ok) return result;
      next = result.nextState;
    } else {
      const currentApproachId = currentSelection?.approachId ?? null;
      if (currentApproachId !== payload.approachId) {
        result = applyVoyageEncounterStationApproachSelectionChange(next, {
          stationId: payload.stationId,
          approachId: payload.approachId
        });
        if (!result?.ok) return result;
        next = result.nextState;
      }
    }

    const currentRiskBidId = next.riskBids?.[payload.stationId]?.riskBidId ?? null;
    if (currentRiskBidId !== payload.riskBidId) {
      if (payload.riskBidId === null) {
        result = applyVoyageEncounterRiskBidClear(next, { stationId: payload.stationId });
      } else {
        const bidRequest = { stationId: payload.stationId, riskBidId: payload.riskBidId };
        result = currentRiskBidId === null
          ? applyVoyageEncounterRiskBidSelection(next, bidRequest)
          : applyVoyageEncounterRiskBidChange(next, bidRequest);
      }
      if (!result?.ok) return result;
      next = result.nextState;
    }

    if (next === prior.encounterState) {
      return {
        ok: false,
        nextState: null,
        events: [],
        errors: [{ code: "station-selection-unchanged", path: "request.payload", message: "Requested station planning selection is already selected.", severity: "error" }],
        warnings: []
      };
    }
    next.revision = prior.encounterState.revision + 1;
    return { ok: true, nextState: next, events: [], errors: [], warnings: [] };
  } catch {
    return { ok: false, nextState: null, events: [], errors: [], warnings: [] };
  }
}

async function dispatchTask2Command(value, identities, initialAuth, initialMatch, context) {
  const descriptor = coordinatorDescriptor(value, initialMatch.documentId, initialAuth);
  if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  return runExclusiveSessionMutation(context, descriptor, async (trustedWitness) => withTransferLock(value.sessionId, async () => {
    const auth = authority(context, { requireConnection: true });
    if (auth.error || auth.authenticatedUserId !== descriptor.authenticatedUserId || auth.authenticatedConnectionId !== descriptor.connectionId || auth.activeGmUserId !== descriptor.activeGmUserId) {
      return failure([auth.error ?? diagnostic("m11-active-gm-required", "transport.connection")], identities);
    }
    const resolved = resolveSessionDocument(value.sessionId, context);
    if (resolved.error) return failure([resolved.error], identities);
    if (resolved.match.documentId !== descriptor.sessionDocumentId || !pristineSession(resolved.match.session, descriptor.sessionDocumentId, { replayContext: context })) {
      return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    }
    const prior = resolved.match.session;
    const projectionKind = "gm";
    const requestFingerprint = fingerprint(value.sessionId, auth.authenticatedUserId, projectionKind, value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload);
    const replay = replayOrConflict(prior.processedRequests, value.requestId, auth.authenticatedUserId, projectionKind, requestFingerprint, identities);
    if (replay) return replay;
    if (prior.activeGmUserId !== auth.activeGmUserId) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.authorityEpoch !== prior.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.expectedRevision !== prior.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    if (prior.sessionState !== "crew-planning") return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
    const working = await task2WorkingState(prior, context);
    if (!working) return task2Failure(identities);
    const applied = task2DomainApply(working, value.commandKind, value.payload);
    if (!applied?.ok || !applied.nextState) return task2Failure(identities);
    const captured = capture(prior); if (!captured.ok) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const candidate = captured.value;
    const previousRevision = prior.revision;
    const nextEncounter = capture(applied.nextState); if (!nextEncounter.ok) return task2Failure(identities);
    candidate.encounterState = nextEncounter.value;
    candidate.revision = previousRevision + 1;
    candidate.sessionState = value.commandKind === "plan-lock" ? "plan-locked" : "crew-planning";
    if (value.commandKind === "plan-lock") {
      const checkpoint = captureCheckpoint(prior, "before-plan-lock");
      if (!checkpoint) return failure([diagnostic("m11-checkpoint-mismatch", "checkpoints")], identities);
      candidate.checkpoints.push(checkpoint);
    }
    const runtimeEvent = {
      type: `voyage.m12-${value.commandKind}`,
      sessionId: candidate.sessionId,
      eventId: candidate.eventId,
      definitionSnapshotId: candidate.definitionSnapshotId,
      shipId: candidate.shipId,
      transitionKind: value.commandKind,
      previousSessionState: prior.sessionState,
      nextSessionState: candidate.sessionState,
      previousEncounterRevision: prior.encounterState.revision,
      encounterRevision: candidate.encounterState.revision,
      previousRevision,
      revision: candidate.revision
    };
    candidate.events.push(runtimeEvent);
    if (!trustedWitness?.occurredAt) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
    const auditKind = TASK2_AUDIT_KINDS[value.commandKind];
    candidate.auditHistory.push({
      auditId: auditId(candidate.sessionId, candidate.auditHistory.length, auditKind),
      kind: auditKind,
      sessionId: candidate.sessionId,
      requestId: value.requestId,
      actorUserId: auth.authenticatedUserId,
      authorityEpoch: candidate.authorityEpoch,
      previousRevision,
      revision: candidate.revision,
      occurredAt: trustedWitness.occurredAt,
      details: {
        transitionKind: value.commandKind,
        previousSessionState: prior.sessionState,
        nextSessionState: candidate.sessionState,
        previousEncounterRevision: prior.encounterState.revision,
        encounterRevision: candidate.encounterState.revision,
        eventCount: candidate.events.length
      }
    });
    const response = successWithEvents(candidate, value.requestId, [runtimeEvent]);
    candidate.processedRequests.push({
      requestId: value.requestId,
      principalUserId: auth.authenticatedUserId,
      projectionKind,
      fingerprint: requestFingerprint,
      commandKind: value.commandKind,
      resultKind: TASK2_RESULT_KINDS[value.commandKind],
      resultRevision: candidate.revision,
      response
    });
    if (!pristineSession(candidate, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    try { await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); }
    catch { return sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, value.requestId, context, { successResponse: response }); }
    return sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, value.requestId, context, { successResponse: response });
  }), identities, { nonWinnerCode: "m11-control-transfer-required", nonWinnerPath: "authorityEpoch" });
}

function initialSession(identity, encounter, activeGmUserId) {
  return {
    schemaVersion: 1, sessionDocumentId: identity.sessionDocumentId, sessionId: identity.sessionId, eventId: identity.eventId, definitionSnapshotId: identity.definitionSnapshotId,
    shipId: identity.shipId, revision: 0, sessionState: "setup", activeGmUserId, authorityEpoch: 0, encounterState: encounter, events: [], checkpoints: [], processedRequests: [],
    closeout: { status: "none", applicationId: null, closeoutId: null, acceptedApplicationPlan: null, reservationId: null, expectedEncounterRevision: null, expectedShipRevision: null, sessionReservationReceipt: null, sessionCommitReceipt: null },
    recovery: { status: "none", reasonCode: null, failedRequestId: null, failedRevision: null, checkpointId: null, sourceCheckpointRevision: null, recoveryAuthorityUserId: null }, auditHistory: []
  };
}
function requestIdentities(value) { return { requestId: nonBlank(value?.requestId) ? value.requestId : null, sessionId: nonBlank(value?.sessionId) ? value.sessionId : null }; }
function sourceSnapshot(document, context) {
  try {
    if (!trustedJournalEntry(document, context) || typeof document.toObject !== "function") return null;
    const captured = capture(document.toObject()); return captured.ok ? captured.value : null;
  } catch { return null; }
}
function collectionUnchanged(before, after, beforeSources, context) {
  return before.length === after.length && before.every((entry, index) => entry === after[index] && equal(beforeSources[index], sourceSnapshot(after[index], context)));
}
function transportWitness(value, descriptor) {
  try {
    const captured = capture(value);
    if (!captured.ok || !exactKeys(captured.value, TRANSPORT_WITNESS_FIELDS)
      || captured.value.connectionId !== descriptor.connectionId || !validIsoTimestamp(captured.value.occurredAt)) return null;
    return Object.freeze(captured.value);
  } catch { return null; }
}
function targetIsCurrentActiveGm(targetUserId, authorityContext) {
  if (targetUserId !== authorityContext.activeGmUserId) return false;
  const matches = authorityContext.users.filter((user) => user.id === targetUserId);
  return matches.length === 1 && matches[0].isGM === true && matches[0].active === true;
}
function transferRecord(session, value, authorityContext, bootstrap, response) {
  const payload = { targetUserId: value.targetUserId, reason: value.reason };
  return {
    requestId: value.requestId,
    principalUserId: authorityContext.authenticatedUserId,
    projectionKind: "gm",
    fingerprint: fingerprint(value.sessionId, authorityContext.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, TRANSFER_COMMAND_KIND, payload),
    commandKind: TRANSFER_COMMAND_KIND,
    resultKind: TRANSFER_RESULT_KIND,
    resultRevision: session.revision,
    response
  };
}
function transferAudit(session, value, authorityContext, previousGm, bootstrap, occurredAt) {
  const nextEpoch = session.authorityEpoch + 1;
  const kind = bootstrap ? "control-transfer-bootstrap" : "control-transfer";
  return {
    auditId: auditId(session.sessionId, session.auditHistory.length, kind),
    kind,
    sessionId: session.sessionId,
    requestId: value.requestId,
    actorUserId: authorityContext.authenticatedUserId,
    authorityEpoch: nextEpoch,
    previousRevision: session.revision,
    revision: session.revision,
    occurredAt,
    details: { previousActiveGmUserId: previousGm, nextActiveGmUserId: authorityContext.activeGmUserId, bootstrap, reason: value.reason }
  };
}
function classifyTransferWrite(document, sessionId, documentIdValue, candidate, previous, requestId, context, options = {}) {
  try {
    const resolved = resolveSessionDocument(sessionId, context);
    if (resolved.error || resolved.match.documentId !== documentIdValue) return failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId });
    if (equal(resolved.match.session, candidate) && pristineSession(resolved.match.session, documentIdValue, options)) return success(resolved.match.session, requestId);
    if (equal(resolved.match.session, previous) && pristineSession(resolved.match.session, documentIdValue, options)) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], { requestId, sessionId });
    return failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId });
  } catch { return failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId }); }
}
async function withTransferLock(sessionId, operation) {
  const prior = transferLocks.get(sessionId) ?? Promise.resolve();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const queued = prior.then(() => gate);
  transferLocks.set(sessionId, queued);
  await prior;
  try { return await operation(); }
  finally {
    release();
    if (transferLocks.get(sessionId) === queued) transferLocks.delete(sessionId);
  }
}
function validTransferEnvelope(value) { return isPlainObject(value) && exactKeys(value, RESPONSE_FIELDS) && typeof value.ok === "boolean" && Array.isArray(value.events) && Array.isArray(value.errors) && Array.isArray(value.warnings); }
async function runExclusiveTransfer(coordinator, descriptor, callback, identities, options = {}) {
  let callbackStarted = false, callbackCount = 0, invalid = false, callbackResult = null;
  const guardedCallback = async (witness) => {
    callbackCount += 1;
    if (callbackCount !== 1) { invalid = true; throw new Error("M11 coordinator callback invoked more than once."); }
    callbackStarted = true;
    const capturedWitness = transportWitness(witness, descriptor);
    if (!capturedWitness) { invalid = true; throw new Error("M11 coordinator transport witness is invalid."); }
    let result;
    try { result = await callback(capturedWitness); }
    catch (error) { invalid = true; throw error; }
    const capturedResult = capture(result);
    if (!capturedResult.ok || !validTransferEnvelope(capturedResult.value)) { invalid = true; throw new Error("M11 coordinator callback result is invalid."); }
    callbackResult = capturedResult.value;
    const outbound = capture(callbackResult);
    if (!outbound.ok) { invalid = true; throw new Error("M11 coordinator callback result could not be isolated."); }
    return outbound.value;
  };
  let result;
  try { result = await coordinator.operation(descriptor, guardedCallback); }
  catch { return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities); }
  if (invalid) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  if (!callbackStarted) {
    return result === null
      ? failure([diagnostic(options.nonWinnerCode ?? "m11-control-transfer-required", options.nonWinnerPath ?? "authorityEpoch")], identities)
      : failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  }
  if (result === null) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  const returned = capture(result);
  if (!returned.ok || !equal(returned.value, callbackResult)) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  return callbackResult;
}

// Narrow adapter for later Foundry mutation boundaries. It intentionally
// reuses the same hostile-safe coordinator, witness, callback-provenance, and
// result-isolation checks as control transfer.
export async function runExclusiveSessionMutation(context, descriptor, callback, identities = {}, options = {}) {
  const coordinator = transferCoordinator(context);
  if (coordinator.error) return failure([coordinator.error], identities);
  if (!isPlainObject(descriptor) || !exactKeys(descriptor, TRANSFER_COORDINATOR_FIELDS)
    || !TRANSFER_COORDINATOR_FIELDS.every((key) => nonBlank(descriptor[key]) || key === "expectedRevision" || key === "expectedAuthorityEpoch")
    || !safeInteger(descriptor.expectedRevision) || !safeInteger(descriptor.expectedAuthorityEpoch)
    || typeof callback !== "function") {
    return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  }
  return runExclusiveTransfer(coordinator, Object.freeze({ ...descriptor }), callback, identities, options);
}

async function cleanupExact(document, expectedId, sessionId, beforeDocuments, context, expectedSession = null) {
  try {
    const returnedId = documentId(document);
    if (!trustedJournalEntry(document, context) || !returnedId.ok || returnedId.value !== expectedId || !nonBlank(expectedId) || beforeDocuments.some((entry) => documentId(entry).value === expectedId)) return false;
    const before = journalDocuments(context); if (!before.ok) return false;
    const exact = before.documents.filter((entry) => documentId(entry).value === expectedId); if (exact.length !== 1) return false;
    const persisted = readDocumentSession(exact[0], context);
    if (!persisted.ok || persisted.documentId !== expectedId || persisted.sessionId !== sessionId || (expectedSession !== null && (!equal(persisted.session, expectedSession) || !pristineSession(persisted.session, expectedId, { replayContext: context })))) return false;
    await exact[0].delete();
    const after = journalDocuments(context); if (!after.ok) return false;
    if (after.documents.some((entry) => documentId(entry).value === expectedId)) return false;
    const found = findSessionDocuments(sessionId, context); if (found.error || found.matches.length !== 0) return false;
    const beforeIds = beforeDocuments.map((entry) => documentId(entry).value);
    return beforeIds.every((beforeId) => nonBlank(beforeId) && after.documents.some((entry) => documentId(entry).value === beforeId))
      && beforeDocuments.every((entry) => after.documents.includes(entry));
  } catch { return false; }
}

function recoveryEnvelope(session, documentIdValue) {
  try {
    if (!isPlainObject(session)) return null;
    const fields = ["schemaVersion", "sessionDocumentId", "sessionId", "eventId", "definitionSnapshotId", "shipId", "revision", "authorityEpoch", "events", "checkpoints", "processedRequests", "auditHistory"];
    const envelope = {};
    for (const field of fields) { const value = ownData(session, field); if (!value.ok) return null; envelope[field] = value.value; }
    if (!exactKeys(envelope, fields) || envelope.schemaVersion !== 1 || envelope.sessionDocumentId !== documentIdValue
      || ![envelope.sessionId, envelope.eventId, envelope.definitionSnapshotId, envelope.shipId].every(nonBlank) || !safeInteger(envelope.revision) || !safeInteger(envelope.authorityEpoch)
      || !Array.isArray(envelope.events) || !Array.isArray(envelope.checkpoints) || !Array.isArray(envelope.processedRequests) || !Array.isArray(envelope.auditHistory)) return null;
    if (!envelope.events.every((event) => capture(event).ok) || !envelope.checkpoints.every((checkpoint) => capture(checkpoint).ok) || !envelope.processedRequests.every((record) => capture(record).ok) || !envelope.auditHistory.every((audit) => capture(audit).ok)) return null;
    return envelope;
  } catch { return null; }
}
function recoveryCheckpointValid(checkpoint, envelope) {
  try {
    if (!exactKeys(checkpoint, CHECKPOINT_FIELDS) || !CHECKPOINT_KINDS.has(checkpoint.kind) || checkpoint.sessionId !== envelope.sessionId
      || checkpoint.checkpointId !== `arcflight-voyage-checkpoint:${JSON.stringify([envelope.sessionId, checkpoint.kind, checkpoint.revision])}` || !safeInteger(checkpoint.revision) || checkpoint.revision > envelope.revision
      || !safeInteger(checkpoint.encounterRevision) || !safeInteger(checkpoint.eventCount) || checkpoint.eventCount > envelope.events.length || typeof checkpoint.invalidated !== "boolean"
      || !safeInteger(checkpoint.authorityEpoch) || !SESSION_STATES.has(checkpoint.sessionState) || !isPlainObject(checkpoint.encounterState) || !validCloseout(checkpoint.closeout, envelope)
      || checkpoint.authorityEpoch > envelope.authorityEpoch || !validEncounterState(checkpoint.encounterState, envelope) || !lifecycleMappingValid({ ...envelope, sessionState: checkpoint.sessionState, encounterState: checkpoint.encounterState })) return false;
    return checkpoint.encounterRevision === checkpoint.encounterState.revision;
  } catch { return false; }
}
function recoveryInvalidationValid(checkpoint, envelope) {
  if (checkpoint.invalidated === false) return true;
  return envelope.auditHistory.some((audit) => {
    if (!exactKeys(audit, AUDIT_FIELDS) || audit.kind !== "recovery-rebuilt" || !nonBlank(audit.requestId) || !nonBlank(audit.actorUserId)
      || !safeInteger(audit.authorityEpoch) || !safeInteger(audit.previousRevision) || !safeInteger(audit.revision)
      || !validIsoTimestamp(audit.occurredAt) || !exactKeys(audit.details, RECOVERY_AUDIT_DETAILS_FIELDS)
      || audit.details.recoveryAction !== "rebuild-latest" || audit.details.sourceCheckpointId !== checkpoint.checkpointId
      || audit.details.sourceCheckpointRevision !== checkpoint.revision || audit.details.recoveryAuthorityUserId !== audit.actorUserId
      || !safeInteger(audit.details.sourceCheckpointRevision) || !safeInteger(audit.details.replayedEventCount)
      || !nonBlank(audit.details.failedRequestId) || !safeInteger(audit.details.failedRevision)) return false;
    return envelope.events.some((event) => event?.type === "voyage.m11-recovery-rebuilt" && event.revision === audit.revision && event.previousRevision === audit.previousRevision
      && event.sourceCheckpointId === checkpoint.checkpointId && event.sourceCheckpointRevision === checkpoint.revision && event.recoveryAuthorityUserId === audit.actorUserId);
  });
}
function recoveryCheckpointJournalValid(envelope) {
  try {
    const ids = new Set(); let previousRevision = -1, previousAuthorityEpoch = -1, previousEventCount = -1;
    const identity = { sessionId: envelope.sessionId, eventId: envelope.eventId, definitionSnapshotId: envelope.definitionSnapshotId, shipId: envelope.shipId, revision: envelope.revision };
    let previousChainRevision = 0; const runtimeRevisions = new Set();
    for (const event of envelope.events) {
      if (event?.type?.startsWith("voyage.m11-") || isM12RuntimeEvent(event)) {
        if (runtimeRevisions.has(event.revision)) return false;
        if (!validRuntimeEvent(event, identity, 0) || (event.previousRevision !== previousChainRevision && !(event.previousRevision + 1 === previousChainRevision && event.revision === previousChainRevision))) return false;
        runtimeRevisions.add(event.revision);
        previousChainRevision = Math.max(previousChainRevision, event.revision);
      } else {
        const pair = storedEventRevisionPair(event);
        const task7Domain = isTask7RuntimeType(envelope.events[envelope.events.indexOf(event) + 1]?.type);
        if (!isPlainObject(event) || !safeInteger(pair[1]) || !safeInteger(pair[0]) || (!task7Domain && pair[0] !== previousChainRevision) || pair[1] !== pair[0] + 1) return false;
        if (!isTask7RuntimeType(envelope.events[envelope.events.indexOf(event) + 1]?.type)) previousChainRevision = pair[1];
      }
    }
    for (const checkpoint of envelope.checkpoints) {
      if (!recoveryCheckpointValid(checkpoint, envelope)) return false;
      if (ids.has(checkpoint.checkpointId) || checkpoint.revision <= previousRevision || checkpoint.authorityEpoch < previousAuthorityEpoch || checkpoint.eventCount < previousEventCount
        || (previousRevision >= 0 && checkpoint.revision !== previousRevision + 1
          && !Array.from({ length: checkpoint.revision - previousRevision - 1 }, (_, offset) => previousRevision + offset + 1)
            .every((revision) => envelope.events.some((event) => !event?.type?.startsWith("voyage.m11-") && !isM12RuntimeEvent(event) && storedEventRevisionPair(event)[1] === revision)))
        || !recoveryInvalidationValid(checkpoint, envelope)) return false;
      for (let index = 0; index < checkpoint.eventCount; index += 1) {
        const event = envelope.events[index];
        const pair = isM12RuntimeEvent(event) ? [event.previousRevision, event.revision] : storedEventRevisionPair(event);
        if (!event || !capture(event).ok || !safeInteger(pair?.[0]) || !safeInteger(pair?.[1]) || pair[1] > checkpoint.revision) return false;
      }
      ids.add(checkpoint.checkpointId); previousRevision = checkpoint.revision; previousAuthorityEpoch = checkpoint.authorityEpoch; previousEventCount = checkpoint.eventCount;
    }
    return previousChainRevision === envelope.revision;
  } catch { return false; }
}
function replayEventChain(envelope, context, startIndex = 0, startRevision = 0, checkpoint = null) {
  try {
    const identity = { sessionId: envelope.sessionId, eventId: envelope.eventId, definitionSnapshotId: envelope.definitionSnapshotId, shipId: envelope.shipId, revision: envelope.revision };
    let priorRevision = startRevision, index = startIndex, replayedState = checkpoint ? { sessionState: checkpoint.sessionState, encounterState: capture(checkpoint.encounterState).value, closeout: capture(checkpoint.closeout).value } : null; const runtimeRevisions = new Set();
    while (index < envelope.events.length) {
      const event = envelope.events[index];
      if (event?.type?.startsWith("voyage.m11-") || isM12RuntimeEvent(event)) {
        if (runtimeRevisions.has(event.revision)) return null;
        if (!validRuntimeEvent(event, identity, index) || (event.previousRevision !== priorRevision && !(event.previousRevision + 1 === priorRevision && event.revision === priorRevision))) return null;
        runtimeRevisions.add(event.revision);
        priorRevision = Math.max(priorRevision, event.revision); index += 1; continue;
      }
      const segmentStart = index;
      while (index < envelope.events.length && !envelope.events[index]?.type?.startsWith("voyage.m11-") && !isM12RuntimeEvent(envelope.events[index])) index += 1;
      const segment = envelope.events.slice(segmentStart, index);
      let segmentRevision = priorRevision;
      const task7Segment = isTask7RuntimeType(envelope.events[index]?.type);
      const task7OnlyDomainSegment = task7Segment && segment.length === 1;
      for (const ownedEvent of segment) {
        const pair = storedEventRevisionPair(ownedEvent);
        if (!isPlainObject(ownedEvent) || !safeInteger(pair[0]) || !safeInteger(pair[1])
           || (!task7Segment && pair[0] !== segmentRevision) || pair[1] !== pair[0] + 1) return null;
        segmentRevision = pair[1];
      }
      if (task7OnlyDomainSegment) {
        priorRevision = segmentRevision;
        continue;
      }
      const trusted = ownData(context, "trustedReplayDependencies"), replay = ownData(context, "replayVoyageEventSessionEvidence");
      if (!trusted.ok || trusted.value !== true || !replay.ok || typeof replay.value !== "function") return null;
      const capturedSegment = capture(segment); if (!capturedSegment.ok) return null;
      const capturedCheckpoint = checkpoint ? capture(checkpoint) : { ok: true, value: null };
      if (!capturedCheckpoint.ok) return null;
      const result = capture(replay.value({ sessionId: envelope.sessionId, eventId: envelope.eventId, definitionSnapshotId: envelope.definitionSnapshotId, shipId: envelope.shipId, checkpoint: capturedCheckpoint.value, events: capturedSegment.value, startIndex: segmentStart, endIndex: index, previousRevision: priorRevision }));
      if (!result.ok || !exactKeys(result.value, ["startIndex", "endIndex", "previousRevision", "nextRevision", "sessionState", "encounterState", "closeout"])
        || result.value.startIndex !== segmentStart || result.value.endIndex !== index || result.value.previousRevision !== priorRevision
        || !safeInteger(result.value.nextRevision) || (!task7Segment && result.value.nextRevision !== segmentRevision) || (task7Segment && result.value.nextRevision !== segmentRevision && result.value.nextRevision !== priorRevision) || result.value.nextRevision > envelope.revision || !SESSION_STATES.has(result.value.sessionState)
        || !validEncounterState(result.value.encounterState, envelope) || !validCloseout(result.value.closeout, envelope)) return null;
      for (const ownedEvent of segment) if (!isPlainObject(ownedEvent) || ownedEvent.type?.startsWith("voyage.m11-") || isM12RuntimeEvent(ownedEvent)) return null;
      if (!task7OnlyDomainSegment) priorRevision = result.value.nextRevision;
      replayedState = result.value;
    }
    if (startIndex === 0 && startRevision === 0 && checkpoint === null && priorRevision !== envelope.revision) return null;
    return { state: replayedState, revision: priorRevision };
  } catch { return null; }
}
function replayRecoveryEvidence(envelope, checkpoint, context) {
  try {
    const replay = replayEventChain(envelope, context, checkpoint.eventCount, checkpoint.revision, checkpoint);
    if (!replay || !replay.state) return null;
    return replay.state;
  } catch { return null; }
}
function validRecoveryReplayRecord(record, envelope, request, authenticatedUserId, requestFingerprint) {
  try {
    const capturedRecord = capture(record); if (!capturedRecord.ok) return false;
    const value = capturedRecord.value, responseCapture = capture(value?.response); if (!responseCapture.ok) return false;
    const response = responseCapture.value, parsed = parseStoredFingerprint(value?.fingerprint);
    if (!exactKeys(value, PROCESSED_REQUEST_FIELDS) || !nonBlank(value.requestId) || value.requestId !== request.requestId
      || value.principalUserId !== authenticatedUserId || value.projectionKind !== "gm" || value.fingerprint !== requestFingerprint
      || value.commandKind !== RECOVERY_COMMAND_KIND || ![RECOVERY_RESULT_KIND, "recovered-aborted"].includes(value.resultKind) || !safeInteger(value.resultRevision)
      || value.resultRevision < 1 || !parsed.ok || !validStoredResponse(response, value, envelope.sessionId, envelope.authorityEpoch)
      || response.projection !== null || response.events.length !== (value.resultKind === "recovered-aborted" ? 2 : 1) || response.errors.length !== 0 || response.warnings.length !== 0) return false;
    const tuple = parsed.value, payload = tuple[6], event = response.events.at(-1);
    const identity = { sessionId: envelope.sessionId, eventId: envelope.eventId, definitionSnapshotId: envelope.definitionSnapshotId, shipId: envelope.shipId, revision: envelope.revision };
    const responseRuntimeEvent = response.events.at(-1);
    const matchingEvent = envelope.events.find((storedEvent) => isPlainObject(storedEvent) && storedEvent.type === responseRuntimeEvent?.type && storedEvent.revision === responseRuntimeEvent?.revision
      && storedEvent.previousRevision === event?.previousRevision && storedEvent.recoveryAuthorityUserId === event?.recoveryAuthorityUserId && equal(storedEvent, event));
    const matchingCheckpoint = matchingEvent && envelope.checkpoints.find((checkpoint) => isPlainObject(checkpoint) && checkpoint.kind === "after-recovery"
      && checkpoint.revision === value.resultRevision && checkpoint.eventCount === envelope.events.indexOf(matchingEvent) + 1 && checkpoint.sessionState === response.status
      && checkpoint.authorityEpoch === response.authorityEpoch);
    const matchingAudit = value.resultKind === "recovered-aborted" && envelope.auditHistory.find((audit) => audit?.requestId === value.requestId && audit.kind === "recovery-aborted" && audit.revision === value.resultRevision && audit.previousRevision === value.resultRevision - 1 && audit.actorUserId === authenticatedUserId && exactKeys(audit.details, TASK7_RECOVERY_ABORT_AUDIT_DETAILS) && audit.details.sourceCheckpointId === event?.sourceCheckpointId && audit.details.sourceCheckpointRevision === event?.sourceCheckpointRevision && audit.details.recoveryAuthorityUserId === authenticatedUserId && audit.details.recoveryAction === "abort");
    return tuple[0] === envelope.sessionId && tuple[1] === authenticatedUserId && tuple[2] === "gm"
      && tuple[3] === request.authorityEpoch && tuple[4] === request.expectedRevision && tuple[5] === RECOVERY_COMMAND_KIND
      && exactKeys(payload, ["recoveryAction", "reason"]) && payload.recoveryAction === (value.resultKind === "recovered-aborted" ? "abort" : "rebuild-latest") && payload.reason === request.reason
      && event?.type === (value.resultKind === "recovered-aborted" ? "voyage.m11-recovery-aborted" : "voyage.m11-recovery-rebuilt") && validRuntimeEvent(event, identity, 0)
      && event.revision === value.resultRevision && event.previousRevision === value.resultRevision - 1
      && event.recoveryAuthorityUserId === authenticatedUserId
      && matchingEvent && matchingCheckpoint && (value.resultKind !== "recovered-aborted" || (matchingAudit && validTask7DomainPair(response.events[0], event, envelope)));
  } catch { return false; }
}
function recoveryStoredRecordsValid(envelope, context = {}, currentRecovery = null, sessionEvidence = null) {
  try {
    if (!envelope.processedRequests.length || !recoveryCheckpointJournalValid(envelope) || !replayEventChain(envelope, context, 0, 0, null)) return false;
    const ids = new Set();
    let owner = null, expectedAuthorityEpoch = 0, lastEvidenceRevision = 0, latestRecoveryEvidence = null, auditIndex = 0;
    const creation = envelope.processedRequests[0];
    if (!exactKeys(creation, PROCESSED_REQUEST_FIELDS) || !nonBlank(creation.requestId) || creation.commandKind !== CREATION_COMMAND_KIND || creation.resultKind !== "created"
      || creation.resultRevision !== 0 || creation.projectionKind !== "gm" || !nonBlank(creation.principalUserId) || !isPlainObject(creation.response)) return false;
    const creationTuple = parseStoredFingerprint(creation.fingerprint);
    if (!creationTuple.ok || creationTuple.value[0] !== envelope.sessionId || creationTuple.value[1] !== creation.principalUserId || creationTuple.value[2] !== "gm"
      || creationTuple.value[3] !== 0 || creationTuple.value[4] !== 0 || creationTuple.value[5] !== CREATION_COMMAND_KIND
      || !exactKeys(creationTuple.value[6], ["eventId", "definitionSnapshotId", "shipId", "eventDefinition", "initialEncounterState"])
      || creationTuple.value[6].eventId !== envelope.eventId || creationTuple.value[6].definitionSnapshotId !== envelope.definitionSnapshotId || creationTuple.value[6].shipId !== envelope.shipId
      || !validStoredResponse(creation.response, creation, envelope.sessionId, envelope.authorityEpoch)
      || !equal(creation.response, { ok: true, requestId: creation.requestId, sessionId: envelope.sessionId, status: "setup", revision: 0, authorityEpoch: 0, projection: null, events: [], errors: [], warnings: [] })) return false;
    owner = creation.principalUserId; ids.add(creation.requestId);
    for (let index = 1; index < envelope.processedRequests.length; index += 1) {
      const record = envelope.processedRequests[index];
      if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || ids.has(record.requestId) || !nonBlank(record.principalUserId) || !isPlainObject(record.response)) return false;
      const tuple = parseStoredFingerprint(record.fingerprint); if (!tuple.ok || tuple.value[0] !== envelope.sessionId || tuple.value[1] !== record.principalUserId || tuple.value[2] !== record.projectionKind
        || !["gm", "operator", "crew", "observer", "none"].includes(record.projectionKind) || !safeInteger(tuple.value[3]) || !safeInteger(tuple.value[4])
        || tuple.value[3] > envelope.authorityEpoch || tuple.value[4] > envelope.revision || !safeInteger(record.resultRevision) || record.resultRevision > envelope.revision
        || record.resultRevision < lastEvidenceRevision || !validStoredResponse(record.response, record, envelope.sessionId, envelope.authorityEpoch)) return false;
      let audit = null;
      if (record.commandKind === TRANSFER_COMMAND_KIND) {
        if (record.projectionKind !== "gm" || record.resultKind !== TRANSFER_RESULT_KIND || tuple.value[2] !== "gm" || tuple.value[3] !== expectedAuthorityEpoch
          || record.resultRevision !== tuple.value[4] || record.response.authorityEpoch !== expectedAuthorityEpoch + 1 || record.response.events.length !== 0
          || !exactKeys(tuple.value[6], ["targetUserId", "reason"]) || !nonBlank(tuple.value[6].targetUserId) || !nonBlank(tuple.value[6].reason)) return false;
        audit = envelope.auditHistory[auditIndex];
        const bootstrap = owner !== record.principalUserId;
        if (!audit || !validAudit(audit, envelope, auditIndex, expectedAuthorityEpoch + 1, record.resultRevision, { ...record, reason: tuple.value[6].reason }, owner, tuple.value[6].targetUserId, bootstrap)) return false;
        owner = tuple.value[6].targetUserId; expectedAuthorityEpoch += 1; auditIndex += 1;
      } else if (record.commandKind === RECOVERY_COMMAND_KIND) {
        if (record.projectionKind !== "gm" || ![RECOVERY_RESULT_KIND, "recovered-aborted"].includes(record.resultKind) || tuple.value[2] !== "gm" || tuple.value[3] !== expectedAuthorityEpoch
          || !safeInteger(tuple.value[4]) || !exactKeys(tuple.value[6], ["recoveryAction", "reason"]) || !["rebuild-latest", "abort"].includes(tuple.value[6].recoveryAction) || !nonBlank(tuple.value[6].reason)) return false;
        if (tuple.value[6].recoveryAction === "abort") {
          const abortEvent = envelope.events.find((event) => event?.type === "voyage.m11-recovery-aborted" && event.revision === record.resultRevision && event.recoveryAuthorityUserId === record.principalUserId);
          const abortAudit = envelope.auditHistory[auditIndex];
          const sourceCheckpoint = abortEvent && envelope.checkpoints.find((checkpoint) => checkpoint.checkpointId === abortEvent.sourceCheckpointId && checkpoint.revision === abortEvent.sourceCheckpointRevision);
          const recoveryCheckpoint = abortEvent && envelope.checkpoints.find((checkpoint) => checkpoint.kind === "after-recovery" && checkpoint.revision === record.resultRevision);
          const abortEventIndex = abortEvent && envelope.events.indexOf(abortEvent);
          const abortReplayEnvelope = abortEventIndex >= 0 ? { ...envelope, events: envelope.events.slice(0, abortEventIndex + 1) } : null;
          const abortReplayedState = abortReplayEnvelope && sourceCheckpoint && replayRecoveryEvidence(abortReplayEnvelope, sourceCheckpoint, context);
          if (!abortEvent || !sourceCheckpoint || !recoveryCheckpoint || !validRuntimeEvent(abortEvent, envelope, envelope.events.indexOf(abortEvent)) || !abortReplayedState || !validAfterRecoveryCheckpoint(recoveryCheckpoint, sessionEvidence ?? envelope, record, abortEvent, abortAudit, sourceCheckpoint, abortAudit?.details?.replayedEventCount ?? -1, abortReplayedState)
            || !abortAudit || !exactKeys(abortAudit, AUDIT_FIELDS) || abortAudit.kind !== "recovery-aborted" || abortAudit.requestId !== record.requestId || abortAudit.actorUserId !== record.principalUserId || abortAudit.authorityEpoch !== record.response.authorityEpoch || abortAudit.previousRevision !== record.resultRevision - 1 || abortAudit.revision !== record.resultRevision || !validIsoTimestamp(abortAudit.occurredAt) || !exactKeys(abortAudit.details, TASK7_RECOVERY_ABORT_AUDIT_DETAILS) || abortAudit.details.recoveryAction !== "abort" || abortAudit.details.sourceCheckpointId !== sourceCheckpoint.checkpointId || abortAudit.details.sourceCheckpointRevision !== sourceCheckpoint.revision || abortAudit.details.recoveryAuthorityUserId !== record.principalUserId || abortAudit.details.replayedEventCount < 0 || !safeInteger(abortAudit.details.replayedEventCount)) return false;
          if (record.response.events.length !== 2 || !validTask7DomainPair(record.response.events[0], abortEvent, sessionEvidence ?? envelope) || !equal(record.response.events[1], abortEvent)) return false;
          lastEvidenceRevision = record.resultRevision; latestRecoveryEvidence = { record, event: abortEvent, audit: abortAudit, sourceCheckpoint, recoveryCheckpoint, replayedState: abortReplayedState }; auditIndex += 1; ids.add(record.requestId); continue;
        }
        let bootstrapAudit = null;
        if (owner !== record.principalUserId) {
          bootstrapAudit = envelope.auditHistory[auditIndex];
          const previousOwner = bootstrapAudit?.details?.previousActiveGmUserId;
          if (!bootstrapAudit || (!nonBlank(previousOwner) && previousOwner !== null) || (previousOwner === null && auditIndex !== 0) || (previousOwner !== owner && previousOwner !== null)
            || !validRecoveryBootstrapAudit(bootstrapAudit, envelope, { requestId: record.requestId, principalUserId: record.principalUserId, reason: tuple.value[6].reason }, expectedAuthorityEpoch + 1, record.resultRevision - 1, previousOwner, record.principalUserId)) return false;
          auditIndex += 1; expectedAuthorityEpoch += 1; owner = record.principalUserId;
        }
        audit = envelope.auditHistory[auditIndex];
        if (!audit || audit.kind !== "recovery-rebuilt") return false;
        const responseEvent = envelope.events.find((event) => event?.type === "voyage.m11-recovery-rebuilt" && event.revision === record.resultRevision && event.recoveryAuthorityUserId === record.principalUserId);
        const sourceCheckpoint = responseEvent && envelope.checkpoints.find((checkpoint) => checkpoint.checkpointId === responseEvent.sourceCheckpointId && checkpoint.revision === responseEvent.sourceCheckpointRevision);
        const replayedEventCount = sourceCheckpoint && envelope.events.indexOf(responseEvent) - sourceCheckpoint.eventCount;
        const recoveryCheckpoint = responseEvent && envelope.checkpoints.find((checkpoint) => checkpoint.kind === "after-recovery" && checkpoint.revision === record.resultRevision);
        const eventIndex = responseEvent && envelope.events.indexOf(responseEvent);
        const replayEnvelope = eventIndex >= 0 ? { ...envelope, events: envelope.events.slice(0, eventIndex + 1) } : null;
        const replayedState = replayEnvelope && sourceCheckpoint && replayRecoveryEvidence(replayEnvelope, sourceCheckpoint, context);
        if (!sourceCheckpoint || !Number.isSafeInteger(replayedEventCount) || replayedEventCount < 0 || !validRecoveryAudit(audit, envelope, record, responseEvent, sourceCheckpoint, replayedEventCount, record.response.authorityEpoch)
          || !recoveryCheckpoint || !replayedState || !validAfterRecoveryCheckpoint(recoveryCheckpoint, envelope, record, responseEvent, audit, sourceCheckpoint, replayedEventCount, replayedState)) return false;
        if (record.response.events.length !== 1 || !equal(record.response.events[0], responseEvent)) return false;
        lastEvidenceRevision = record.resultRevision; owner = record.principalUserId; latestRecoveryEvidence = { record, event: responseEvent, audit, sourceCheckpoint, recoveryCheckpoint, replayedState }; auditIndex += 1;
      } else if (sessionEvidence && record.commandKind === "m12-launch") {
        const audit = envelope.auditHistory[auditIndex];
        if (!audit || !validM12LaunchRecord(record, sessionEvidence, audit)) return false;
        lastEvidenceRevision = record.resultRevision; auditIndex += 1;
      } else if (sessionEvidence && TASK2_COMMANDS.has(record.commandKind)) {
        const event = envelope.events.find((entry) => entry?.type === `voyage.m12-${record.commandKind}` && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const audit = envelope.auditHistory[auditIndex];
        const checkpoint = record.commandKind === "plan-lock"
          ? envelope.checkpoints.find((entry) => entry?.kind === "before-plan-lock" && entry.revision === record.resultRevision - 1)
          : null;
        if (!event || !audit || !validM12Task2Record(record, sessionEvidence, audit, event, checkpoint)) return false;
        lastEvidenceRevision = record.resultRevision; auditIndex += 1;
      } else if (sessionEvidence && (record.commandKind === "closeout-review" || record.commandKind === "closeout-prepare" || record.commandKind === "closeout-reserve" || record.commandKind === "closeout-ship-apply" || record.commandKind === "closeout-session-commit")) {
        if (record.commandKind === "closeout-prepare" || record.commandKind === "closeout-ship-apply") {
          if (!validCloseoutRecord(record, sessionEvidence, null, null)) return false;
          ids.add(record.requestId);
          continue;
        }
        const eventType = record.commandKind === "closeout-review" ? "voyage.m11-closeout-review-accepted" : record.commandKind === "closeout-reserve" ? "voyage.m11-closeout-session-reserved" : record.resultKind === "closeout-session-commit-pending" ? "voyage.m11-closeout-session-commit-pending" : "voyage.m11-closeout-session-committed";
        const event = envelope.events.find((entry) => entry?.type === eventType && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const audit = envelope.auditHistory[auditIndex];
        if (!event || !validCloseoutRecord(record, sessionEvidence, audit, event)) return false;
        if (record.commandKind !== "closeout-prepare") auditIndex += 1;
      } else if (sessionEvidence && (record.commandKind === "abort-session" || record.commandKind === "correct-session")) {
        const eventType = record.commandKind === "abort-session" ? "voyage.m11-session-aborted" : "voyage.m11-session-corrected";
        const responseEvent = envelope.events.find((event) => event?.type === eventType && event.revision === record.resultRevision && event.previousRevision === record.resultRevision - 1);
        const audit = envelope.auditHistory[auditIndex];
        if (!responseEvent || !audit || !validTask7Record(record, sessionEvidence, audit, responseEvent) || record.response.events.length !== 2 || !equal(record.response.events[1], responseEvent)) return false;
        auditIndex += 1;
      } else return false;
      ids.add(record.requestId);
      if (record.commandKind === TRANSFER_COMMAND_KIND) lastEvidenceRevision = Math.max(lastEvidenceRevision, record.resultRevision);
    }
    if (sessionEvidence?.sessionState === "completed" || sessionEvidence?.closeout.status === "committed") {
      if (!validTerminalCloseoutEvidence(sessionEvidence)) return false;
      if (!sessionEvidence.processedRequests.some((record) => record.commandKind === "closeout-session-commit" && record.resultKind === "closeout-session-committed")) auditIndex += 1;
    }
    if (auditIndex !== envelope.auditHistory.length) return false;
    if (!latestRecoveryEvidence) return validRequiredRecovery(currentRecovery) || (currentRecovery?.status === "none" && Object.keys(currentRecovery).slice(1).every((key) => currentRecovery[key] === null));
    const resolved = validResolvedRecovery(currentRecovery, latestRecoveryEvidence.event, latestRecoveryEvidence.audit, latestRecoveryEvidence.sourceCheckpoint);
    const required = validRequiredRecovery(currentRecovery)
      && (currentRecovery.checkpointId === null || currentRecovery.checkpointId === latestRecoveryEvidence.sourceCheckpoint.checkpointId)
      && (currentRecovery.sourceCheckpointRevision === null || currentRecovery.sourceCheckpointRevision === latestRecoveryEvidence.sourceCheckpoint.revision)
      && (currentRecovery.recoveryAuthorityUserId === null || currentRecovery.recoveryAuthorityUserId === latestRecoveryEvidence.event.recoveryAuthorityUserId);
    return resolved || required;
  } catch { return false; }
}
function recoveryAudit(session, request, authorityContext, sourceCheckpoint, replayedEventCount, previousRevision, revision, occurredAt, failedRequestId, failedRevision) {
  return {
    auditId: auditId(session.sessionId, session.auditHistory.length, "recovery-rebuilt"), kind: "recovery-rebuilt", sessionId: session.sessionId, requestId: request.requestId,
    actorUserId: authorityContext.authenticatedUserId, authorityEpoch: session.authorityEpoch, previousRevision, revision, occurredAt,
    details: { recoveryAction: request.recoveryAction, sourceCheckpointId: sourceCheckpoint.checkpointId, sourceCheckpointRevision: sourceCheckpoint.revision, recoveryAuthorityUserId: authorityContext.authenticatedUserId, replayedEventCount, failedRequestId, failedRevision }
  };
}
function recoveryEvent(session, checkpoint, authorityContext, previousRevision, revision) {
  return {
    type: "voyage.m11-recovery-rebuilt", sessionId: session.sessionId, eventId: session.eventId, definitionSnapshotId: session.definitionSnapshotId, shipId: session.shipId,
    sourceCheckpointId: checkpoint.checkpointId, sourceCheckpointRevision: checkpoint.revision, recoveryAuthorityUserId: authorityContext.authenticatedUserId, previousRevision, revision
  };
}
function recoveryCheckpoint(session) {
  return captureCheckpoint(session, "after-recovery");
}
function captureCheckpoint(session, kind) {
  try {
    if (!CHECKPOINT_KINDS.has(kind) || !isPlainObject(session) || !safeInteger(session.revision) || !safeInteger(session.authorityEpoch) || !Array.isArray(session.events)) return null;
    const encounterState = capture(session.encounterState), closeout = capture(session.closeout);
    if (!encounterState.ok || !closeout.ok) return null;
    const checkpoint = {
      checkpointId: `arcflight-voyage-checkpoint:${JSON.stringify([session.sessionId, kind, session.revision])}`, kind, sessionId: session.sessionId, revision: session.revision,
      encounterRevision: encounterState.value.revision, eventCount: session.events.length, sessionState: session.sessionState,
      encounterState: encounterState.value, closeout: closeout.value, authorityEpoch: session.authorityEpoch, invalidated: false
    };
    return validCheckpoint(checkpoint, session, session.events, session.checkpoints?.length ?? 0) ? checkpoint : null;
  } catch { return null; }
}
function classifyRecoveryWrite(sessionId, documentIdValue, candidate, previous, requestId, context, { successResponse = null } = {}) {
  try {
    const resolved = resolveSessionDocument(sessionId, context);
    if (resolved.error || resolved.match.documentId !== documentIdValue) return failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId });
    if (equal(resolved.match.session, candidate) && validSessionEvidence(resolved.match.session, documentIdValue, { recoveryEnvelope: true }, context)) {
      const stored = successResponse ?? successWithEvents(resolved.match.session, requestId, resolved.match.session.events.slice(-1));
      const captured = capture(stored); return captured.ok ? captured.value : failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId });
    }
    if (equal(resolved.match.session, previous)) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], { requestId, sessionId });
    return failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId });
  } catch { return failure([diagnostic("m11-recovery-required", "recovery")], { requestId, sessionId }); }
}
function successWithEvents(session, requestId, events, authorityEpoch = session.authorityEpoch) {
  return { ok: true, requestId, sessionId: session.sessionId, status: session.sessionState, revision: session.revision, authorityEpoch, projection: null, events: capture(events).value, errors: [], warnings: [] };
}
function buildRecoveryCandidate(baseSession, envelope, source, replayedState, request, authorityContext, requestFingerprint, occurredAt) {
  try {
    const captured = capture(baseSession); if (!captured.ok) return null;
    const lastEventPair = envelope.events.length > 0 ? storedEventRevisionPair(envelope.events.at(-1)) : null;
    const candidate = captured.value, previousRevision = lastEventPair ? lastEventPair[1] : envelope.revision, bootstrap = candidate.activeGmUserId !== authorityContext.activeGmUserId;
    if (!safeInteger(previousRevision) || previousRevision > envelope.revision) return null;
    const failedRequestId = candidate.recovery?.failedRequestId, failedRevision = candidate.recovery?.failedRevision;
    if (candidate.recovery?.status !== "required" || !nonBlank(failedRequestId) || !safeInteger(failedRevision) || failedRevision >= previousRevision + 1) return null;
    if (bootstrap) {
      const previousActiveGmUserId = candidate.activeGmUserId;
      candidate.activeGmUserId = authorityContext.activeGmUserId;
      candidate.authorityEpoch = envelope.authorityEpoch + 1;
      candidate.auditHistory.push({ auditId: auditId(candidate.sessionId, candidate.auditHistory.length, "recovery-control-transfer"), kind: "recovery-control-transfer", sessionId: candidate.sessionId, requestId: request.requestId, actorUserId: authorityContext.authenticatedUserId, authorityEpoch: candidate.authorityEpoch, previousRevision, revision: previousRevision, occurredAt, details: { previousActiveGmUserId, nextActiveGmUserId: authorityContext.activeGmUserId, bootstrap: true, reason: request.reason } });
    }
    candidate.sessionState = replayedState.sessionState; candidate.encounterState = capture(replayedState.encounterState).value; candidate.closeout = capture(replayedState.closeout).value;
    candidate.recovery = { status: "resolved", reasonCode: "m11-recovery-required", failedRequestId, failedRevision, checkpointId: source.checkpointId, sourceCheckpointRevision: source.revision, recoveryAuthorityUserId: authorityContext.authenticatedUserId };
    let maxEvidenceRevision = Math.max(previousRevision, source.revision);
    for (const checkpoint of envelope.checkpoints) if (checkpoint.revision > maxEvidenceRevision) maxEvidenceRevision = checkpoint.revision;
    for (const event of envelope.events) { const pair = storedEventRevisionPair(event); if (safeInteger(pair[1]) && pair[1] > maxEvidenceRevision) maxEvidenceRevision = pair[1]; }
    for (const record of envelope.processedRequests) if (record.resultRevision > maxEvidenceRevision) maxEvidenceRevision = record.resultRevision;
    candidate.revision = maxEvidenceRevision + 1;
    const event = recoveryEvent(candidate, source, authorityContext, previousRevision, candidate.revision);
    if (!validIsoTimestamp(occurredAt)) return null;
    candidate.events.push(event);
    candidate.auditHistory.push(recoveryAudit(candidate, request, authorityContext, source, Math.max(0, envelope.events.length - source.eventCount), previousRevision, candidate.revision, occurredAt, failedRequestId, failedRevision));
    const checkpoint = recoveryCheckpoint(candidate); if (!checkpoint) return null;
    candidate.checkpoints.push(checkpoint);
    const response = successWithEvents(candidate, request.requestId, [event]);
    candidate.processedRequests.push({ requestId: request.requestId, principalUserId: authorityContext.authenticatedUserId, projectionKind: "gm", fingerprint: requestFingerprint, commandKind: RECOVERY_COMMAND_KIND, resultKind: RECOVERY_RESULT_KIND, resultRevision: candidate.revision, response });
    return { candidate, event, response };
  } catch { return null; }
}
function isTask7RuntimeType(type) { return ["voyage.m11-session-aborted", "voyage.m11-session-corrected", "voyage.m11-recovery-aborted"].includes(type); }
function isTask7DomainEvent(events, index) {
  const next = events?.[index + 1];
  return isPlainObject(events?.[index]) && next && isTask7RuntimeType(next.type);
}
function validTask7DomainPair(domainEvent, runtimeEvent, session) {
  return isPlainObject(domainEvent) && nonBlank(domainEvent.type)
    && (!Object.hasOwn(domainEvent, "encounterId") || domainEvent.encounterId === session.eventId)
    && safeInteger(domainEvent.previousRevision) && safeInteger(domainEvent.revision)
    && domainEvent.revision === domainEvent.previousRevision + 1
    && runtimeEvent.previousEncounterRevision === domainEvent.previousRevision
    && runtimeEvent.encounterRevision === domainEvent.revision;
}

async function buildRecoveryAbortCandidate(baseSession, envelope, source, replayedState, request, authorityContext, requestFingerprint, occurredAt, context) {
  try {
    const dep = m10Function(context, "applyVoyageEncounterAbortTransition", null); if (!dep) return null;
    const lifecycle = ["configuration", "ready"].includes(replayedState.encounterState.lifecycleState) ? "discarded" : ["active", "paused"].includes(replayedState.encounterState.lifecycleState) ? "abandoned" : null;
    if (!lifecycle) return null;
    const depResult = await callAbortDependency(dep, replayedState.encounterState, { kind: "voyage.abort-recovery", sessionId: baseSession.sessionId, abortScope: "recovery-abort", reason: request.reason });
    const replaySession = { ...baseSession, sessionState: replayedState.sessionState, encounterState: replayedState.encounterState, closeout: replayedState.closeout };
    const validated = task7DependencyResult(depResult, replaySession, lifecycle, "aborted"); if (!validated) return null;
    const captured = capture(baseSession); if (!captured.ok || !validIsoTimestamp(occurredAt)) return null;
    const candidate = captured.value, previousRevision = Math.max(envelope.revision, ...envelope.events.map((event) => storedEventRevisionPair(event)[1] ?? 0), ...envelope.processedRequests.map((record) => record.resultRevision ?? 0));
    const priorState = replayedState.sessionState;
    const bootstrap = candidate.activeGmUserId !== authorityContext.activeGmUserId;
    if (bootstrap) {
      const previousActiveGmUserId = candidate.activeGmUserId;
      candidate.activeGmUserId = authorityContext.activeGmUserId;
      candidate.authorityEpoch = envelope.authorityEpoch + 1;
      candidate.auditHistory.push({ auditId: auditId(candidate.sessionId, candidate.auditHistory.length, "recovery-control-transfer"), kind: "recovery-control-transfer", sessionId: candidate.sessionId, requestId: request.requestId, actorUserId: authorityContext.authenticatedUserId, authorityEpoch: candidate.authorityEpoch, previousRevision, revision: previousRevision, occurredAt, details: { previousActiveGmUserId, nextActiveGmUserId: authorityContext.activeGmUserId, bootstrap: true, reason: request.reason } });
    }
    candidate.sessionState = "aborted"; candidate.encounterState = validated.nextState; candidate.closeout = capture(replayedState.closeout).value; candidate.recovery = { status: "resolved", reasonCode: "m11-recovery-required", failedRequestId: baseSession.recovery.failedRequestId, failedRevision: baseSession.recovery.failedRevision, checkpointId: source.checkpointId, sourceCheckpointRevision: source.revision, recoveryAuthorityUserId: authorityContext.authenticatedUserId };
    candidate.revision = previousRevision + 1;
    const domainEvent = capture(validated.events[0]).value;
    const runtimeEvent = { type: "voyage.m11-recovery-aborted", sessionId: candidate.sessionId, eventId: candidate.eventId, definitionSnapshotId: candidate.definitionSnapshotId, shipId: candidate.shipId, sourceCheckpointId: source.checkpointId, sourceCheckpointRevision: source.revision, recoveryAuthorityUserId: authorityContext.authenticatedUserId, previousRevision, revision: candidate.revision, previousEncounterRevision: replayedState.encounterState.revision, encounterRevision: validated.nextState.revision };
    candidate.events.push(domainEvent, runtimeEvent);
    candidate.auditHistory.push({ auditId: auditId(candidate.sessionId, candidate.auditHistory.length, "recovery-aborted"), kind: "recovery-aborted", sessionId: candidate.sessionId, requestId: request.requestId, actorUserId: authorityContext.authenticatedUserId, authorityEpoch: candidate.authorityEpoch, previousRevision, revision: candidate.revision, occurredAt, details: { recoveryAction: "abort", sourceCheckpointId: source.checkpointId, sourceCheckpointRevision: source.revision, recoveryAuthorityUserId: authorityContext.authenticatedUserId, replayedEventCount: envelope.events.length - source.eventCount, failedRequestId: baseSession.recovery.failedRequestId, failedRevision: baseSession.recovery.failedRevision, previousSessionState: priorState, nextSessionState: "aborted", previousEncounterRevision: replayedState.encounterState.revision, encounterRevision: validated.nextState.revision } });
    const checkpoint = captureCheckpoint(candidate, "after-recovery"); if (!checkpoint) return null; candidate.checkpoints.push(checkpoint);
    const response = successWithEvents(candidate, request.requestId, [domainEvent, runtimeEvent]);
    candidate.processedRequests.push({ requestId: request.requestId, principalUserId: authorityContext.authenticatedUserId, projectionKind: "gm", fingerprint: requestFingerprint, commandKind: "recover", resultKind: "recovered-aborted", resultRevision: candidate.revision, response });
    return { candidate, event: runtimeEvent, response };
  } catch { return null; }
}
function validTask7Record(record, session, audit, runtimeEvent) {
  try {
    if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || !nonBlank(record.principalUserId) || record.projectionKind !== "gm" || !safeInteger(record.resultRevision) || record.resultRevision < 1 || record.resultRevision > session.revision || !isPlainObject(record.response)) return false;
    const parsed = parseStoredFingerprint(record.fingerprint); if (!parsed.ok || parsed.value[0] !== session.sessionId || parsed.value[1] !== record.principalUserId || parsed.value[2] !== "gm" || !safeInteger(parsed.value[3]) || !safeInteger(parsed.value[4]) || parsed.value[3] > session.authorityEpoch || parsed.value[4] !== record.resultRevision - 1) return false;
    const payload = parsed.value[6];
    if (record.commandKind === "abort-session") {
      if (record.resultKind !== "aborted" || parsed.value[5] !== "abort-session" || !exactKeys(payload, ["reason", "confirmation"]) || !nonBlank(payload.reason) || payload.confirmation !== true || !validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) || record.response.status !== "aborted" || record.response.events.length !== 2) return false;
      const domainEvent = record.response.events[0];
      if (!validRuntimeEvent(runtimeEvent, session, session.events.indexOf(runtimeEvent)) || runtimeEvent.type !== "voyage.m11-session-aborted" || runtimeEvent.abortAuthorityUserId !== record.principalUserId || !validTask7DomainPair(domainEvent, runtimeEvent, session) || !equal(record.response.events[1], runtimeEvent)) return false;
      if (!audit || !exactKeys(audit, AUDIT_FIELDS) || !["setup-cancelled", "event-aborted"].includes(audit.kind) || audit.requestId !== record.requestId || audit.actorUserId !== record.principalUserId || !safeInteger(audit.authorityEpoch) || parsed.value[3] !== audit.authorityEpoch || audit.authorityEpoch !== record.response.authorityEpoch || audit.revision !== record.resultRevision || audit.previousRevision !== record.resultRevision - 1 || !validIsoTimestamp(audit.occurredAt) || runtimeEvent.previousRevision !== audit.previousRevision || runtimeEvent.revision !== audit.revision) return false;
      const fields = audit.kind === "setup-cancelled" ? TASK7_ABORT_AUDIT_DETAILS : TASK7_ACTIVE_ABORT_AUDIT_DETAILS;
      return exactKeys(audit.details, fields) && audit.details.abortScope === runtimeEvent.abortScope && audit.details.nextSessionState === "aborted" && audit.details.reason === payload.reason && audit.details.previousSessionState !== "aborted" && audit.details.nextLifecycleState === (audit.kind === "setup-cancelled" ? "discarded" : "abandoned") && (audit.kind === "setup-cancelled" || audit.details.persistentConsequence === false);
    }
    if (record.commandKind === "correct-session") {
      if (record.resultKind !== "corrected" || parsed.value[5] !== "correct-session" || !exactKeys(payload, ["correctionKind", "targetRequestId", "targetCheckpointId", "replacementPayload", "reason", "confirmation"]) || !["station-selection", "station-order"].includes(payload.correctionKind) || !exactKeys(payload.replacementPayload, payload.correctionKind === "station-selection" ? ["stationId", "actionId"] : ["stationOrder"]) || payload.targetRequestId !== null || payload.targetCheckpointId !== null || payload.confirmation !== true || !validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) || record.response.status !== "crew-planning" || record.response.events.length !== 2 || audit.details?.previousSessionState !== "crew-planning" || audit.details?.nextSessionState !== "crew-planning" || session.checkpoints.some((checkpoint) => checkpoint.kind === "before-plan-lock" && checkpoint.revision <= record.resultRevision - 1)) return false;
      if (!validRuntimeEvent(runtimeEvent, session, session.events.indexOf(runtimeEvent)) || runtimeEvent.type !== "voyage.m11-session-corrected" || runtimeEvent.correctionAuthorityUserId !== record.principalUserId || !validTask7DomainPair(record.response.events[0], runtimeEvent, session) || !equal(record.response.events[1], runtimeEvent)) return false;
      return audit && exactKeys(audit, AUDIT_FIELDS) && audit.kind === "correction-applied" && audit.requestId === record.requestId && audit.actorUserId === record.principalUserId && safeInteger(audit.authorityEpoch) && parsed.value[3] === audit.authorityEpoch && audit.authorityEpoch === record.response.authorityEpoch && audit.revision === record.resultRevision && audit.previousRevision === record.resultRevision - 1 && validIsoTimestamp(audit.occurredAt) && exactKeys(audit.details, TASK7_CORRECTION_AUDIT_DETAILS) && audit.details.correctionKind === payload.correctionKind && audit.details.targetRequestId === null && audit.details.previousSessionState === "crew-planning" && audit.details.nextSessionState === "crew-planning" && audit.details.reason === payload.reason && audit.details.previousEncounterRevision === runtimeEvent.previousEncounterRevision && audit.details.encounterRevision === runtimeEvent.encounterRevision;
    }
    return false;
  } catch { return false; }
}
function validM12LaunchRecord(record, session, audit) {
  try {
    if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || record.commandKind !== "m12-launch" || record.resultKind !== "launched" || record.projectionKind !== "gm" || !safeInteger(record.resultRevision) || record.resultRevision < 1 || record.resultRevision > session.revision || !isPlainObject(record.response)) return false;
    const parsed = parseStoredFingerprint(record.fingerprint); if (!parsed.ok || parsed.value[0] !== session.sessionId || parsed.value[1] !== record.principalUserId || parsed.value[2] !== "gm" || parsed.value[3] !== 0 || parsed.value[4] !== 0 || parsed.value[5] !== "m12-launch" || !exactKeys(parsed.value[6], ["eventId", "definitionSnapshotId", "shipId", "operatorSelections"])) return false;
    const payload = parsed.value[6];
    if (payload.eventId !== session.eventId || payload.definitionSnapshotId !== session.definitionSnapshotId || payload.shipId !== session.shipId || !Array.isArray(payload.operatorSelections) || payload.operatorSelections.length !== 5
      || payload.operatorSelections.some((entry, index) => !Array.isArray(entry) || entry.length !== 2 || entry[0] !== ["captain", "engineer", "navigator", "watchmaster", "veilwarden"][index] || (entry[1] !== null && !nonBlank(entry[1])))) return false;
    const assignments = session.encounterState.stationAssignments;
    if (!Array.isArray(assignments) || payload.operatorSelections.some(([stationId, selected]) => {
      const assignment = assignments.find((entry) => entry?.stationId === stationId);
      if (selected === null) return assignment !== undefined;
      return !assignment || !isPlainObject(assignment.operator) || ![assignment.operator.id, assignment.operator.uuid].includes(selected);
    })) return false;
    const events = session.events.filter((event) => isM12RuntimeEvent(event)).slice(0, 5);
    const transitionKinds = ["station-assignments", "configuration", "ready", "activation", "crew-planning"];
    const sessionStates = [["setup", "setup"], ["setup", "setup"], ["setup", "setup"], ["setup", "round-introduction"], ["round-introduction", "crew-planning"]];
    return events.length === 5 && record.resultRevision === events.at(-1)?.revision && validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) && record.response.status === "crew-planning" && record.response.authorityEpoch === 0
      && record.response.events.length === events.length && events.every((event, index) => validM12RuntimeEvent(event, session) && event.transitionKind === transitionKinds[index] && event.previousSessionState === sessionStates[index][0] && event.nextSessionState === sessionStates[index][1] && event.previousRevision === index && event.revision === index + 1 && equal(event, record.response.events[index]))
      && audit && exactKeys(audit, AUDIT_FIELDS) && audit.kind === "m12-launch" && audit.auditId === auditId(session.sessionId, session.auditHistory.indexOf(audit), "m12-launch")
      && audit.sessionId === session.sessionId && audit.requestId === record.requestId && audit.actorUserId === record.principalUserId && audit.authorityEpoch === 0
      && audit.previousRevision === record.resultRevision - 1 && audit.revision === record.resultRevision && validIsoTimestamp(audit.occurredAt)
      && exactKeys(audit.details, M12_AUDIT_DETAILS_FIELDS) && audit.details.transitionKind === "launch" && audit.details.previousSessionState === "setup" && audit.details.nextSessionState === "crew-planning"
      && audit.details.previousEncounterRevision === 0
      && audit.details.encounterRevision === events.at(-1)?.encounterRevision && audit.details.eventCount === events.length;
  } catch { return false; }
}

function task2PayloadValid(commandKind, payload) {
  if (!isPlainObject(payload)) return false;
  const fields = commandKind === "station-selection" ? ["stationId", "actionId", "approachId", "riskBidId"]
    : commandKind === "station-selection-clear" ? ["stationId"]
      : commandKind === "station-order" ? ["stationOrder"]
        : commandKind === "plan-lock" ? ["phaseStartSnapshotId"] : null;
  if (!fields || !exactKeys(payload, fields)) return false;
  if (commandKind === "station-selection") return [payload.stationId, payload.actionId, payload.approachId].every((entry) => nonBlank(entry) && !UNSAFE_KEYS.has(entry))
    && (payload.riskBidId === null || (nonBlank(payload.riskBidId) && !UNSAFE_KEYS.has(payload.riskBidId)));
  if (commandKind === "station-selection-clear") return nonBlank(payload.stationId) && !UNSAFE_KEYS.has(payload.stationId);
  if (commandKind === "station-order") return Array.isArray(payload.stationOrder) && payload.stationOrder.length > 0
    && payload.stationOrder.every((entry) => nonBlank(entry) && !UNSAFE_KEYS.has(entry)) && new Set(payload.stationOrder).size === payload.stationOrder.length;
  return nonBlank(payload.phaseStartSnapshotId) && !UNSAFE_KEYS.has(payload.phaseStartSnapshotId);
}

function validM12Task2Record(record, session, audit, event, checkpoint = null) {
  try {
    if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || !nonBlank(record.principalUserId)
      || record.projectionKind !== "gm" || !TASK2_COMMANDS.has(record.commandKind)
      || record.resultKind !== TASK2_RESULT_KINDS[record.commandKind] || !safeInteger(record.resultRevision)
      || record.resultRevision < 1 || record.resultRevision > session.revision || !isPlainObject(record.response)) return false;
    const parsed = parseStoredFingerprint(record.fingerprint); if (!parsed.ok) return false;
    const tuple = parsed.value;
    if (tuple[0] !== session.sessionId || tuple[1] !== record.principalUserId || tuple[2] !== "gm"
      || !safeInteger(tuple[3]) || !safeInteger(tuple[4]) || tuple[3] > session.authorityEpoch || tuple[4] !== record.resultRevision - 1
      || tuple[5] !== record.commandKind || !task2PayloadValid(record.commandKind, tuple[6])) return false;
    if (!validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch)
      || record.response.status !== (record.commandKind === "plan-lock" ? "plan-locked" : "crew-planning")
      || record.response.authorityEpoch !== tuple[3] || record.response.events.length !== 1) return false;
    if (!event || event.type !== `voyage.m12-${record.commandKind}` || event.revision !== record.resultRevision
      || event.previousRevision !== record.resultRevision - 1 || !validM12RuntimeEvent(event, session)) return false;
    if (!equal(record.response.events[0], event)) return false;
    const auditKind = TASK2_AUDIT_KINDS[record.commandKind];
    if (!audit || !exactKeys(audit, AUDIT_FIELDS) || audit.kind !== auditKind
      || audit.auditId !== auditId(session.sessionId, session.auditHistory.indexOf(audit), audit.kind)
      || audit.sessionId !== session.sessionId || audit.requestId !== record.requestId || audit.actorUserId !== record.principalUserId
      || audit.authorityEpoch !== tuple[3] || audit.previousRevision !== record.resultRevision - 1 || audit.revision !== record.resultRevision
      || !validIsoTimestamp(audit.occurredAt) || !exactKeys(audit.details, M12_AUDIT_DETAILS_FIELDS)
      || audit.details.transitionKind !== record.commandKind
      || audit.details.previousSessionState !== (record.commandKind === "plan-lock" ? "crew-planning" : "crew-planning")
      || audit.details.nextSessionState !== record.response.status
      || audit.details.previousEncounterRevision !== event.previousEncounterRevision
      || audit.details.encounterRevision !== event.encounterRevision
      || audit.details.eventCount !== session.events.indexOf(event) + 1) return false;
    if (record.commandKind === "plan-lock") {
      if (!checkpoint || checkpoint.kind !== "before-plan-lock" || checkpoint.revision !== record.resultRevision - 1
        || checkpoint.eventCount !== session.events.indexOf(event) || checkpoint.sessionState !== "crew-planning"
        || checkpoint.encounterState?.phase !== "crew-planning" || checkpoint.encounterState?.revision !== event.previousEncounterRevision
        || !validCheckpoint(checkpoint, session, session.events, session.checkpoints.indexOf(checkpoint))) return false;
      const matching = session.checkpoints.filter((entry) => entry?.kind === "before-plan-lock");
      if (matching.length !== 1) return false;
    } else if (checkpoint !== null) return false;
    return true;
  } catch { return false; }
}

function task7DependencyResult(result, session, expectedLifecycle, expectedSessionState) {
  try {
    const captured = capture(result); if (!captured.ok || !exactKeys(captured.value, ["ok", "nextState", "events", "errors", "warnings", "persistentConsequence"])) return null;
    const value = captured.value;
    if (value.ok !== true || value.persistentConsequence !== null || !Array.isArray(value.events) || value.events.length !== 1 || !Array.isArray(value.errors) || value.errors.length !== 0 || !Array.isArray(value.warnings) || !isPlainObject(value.nextState)
      || !validEncounterState(value.nextState, session) || value.nextState.lifecycleState !== expectedLifecycle || value.nextState.phase !== null || value.nextState.revision !== session.encounterState.revision + 1) return null;
    const event = value.events[0];
    if (!isPlainObject(event) || !nonBlank(event.type) || event.encounterId !== session.eventId || (event.lifecycleState ?? event.toLifecycleState) !== expectedLifecycle || !safeInteger(event.previousRevision) || !safeInteger(event.revision) || event.previousRevision !== session.encounterState.revision || event.revision !== value.nextState.revision) return null;
    return value;
  } catch { return null; }
}
async function callAbortDependency(api, encounterState, request) {
  try { if (typeof api !== "function") return null; const result = await api(capture(encounterState).value, capture(request).value); const captured = capture(result); return captured.ok ? captured.value : null; } catch { return null; }
}

function task7AbortAudit(session, request, auth, previousRevision, revision, occurredAt, previousLifecycle, nextLifecycle, kind, persistent = null) {
  const details = { abortScope: request.abortScope, previousSessionState: session.sessionState, nextSessionState: "aborted", previousLifecycleState: previousLifecycle, nextLifecycleState: nextLifecycle, reason: request.reason };
  if (persistent !== null) details.persistentConsequence = persistent;
  return { auditId: auditId(session.sessionId, session.auditHistory.length, kind), kind, sessionId: session.sessionId, requestId: request.requestId, actorUserId: auth.authenticatedUserId, authorityEpoch: session.authorityEpoch, previousRevision, revision, occurredAt, details };
}

function task7AbortEvent(session, request, auth, previousRevision, revision, previousEncounterRevision, encounterRevision) {
  return { type: "voyage.m11-session-aborted", sessionId: session.sessionId, eventId: session.eventId, definitionSnapshotId: session.definitionSnapshotId, shipId: session.shipId, abortScope: request.abortScope, abortAuthorityUserId: auth.authenticatedUserId, previousRevision, revision, previousEncounterRevision, encounterRevision };
}

function task7CorrectionEvent(session, request, auth, previousRevision, revision, previousEncounterRevision, encounterRevision) {
  return { type: "voyage.m11-session-corrected", sessionId: session.sessionId, eventId: session.eventId, definitionSnapshotId: session.definitionSnapshotId, shipId: session.shipId, correctionKind: request.correctionKind, targetRequestId: null, correctionAuthorityUserId: auth.authenticatedUserId, previousRevision, revision, previousEncounterRevision, encounterRevision };
}

async function task7AbortWithinExclusive(value, identities, descriptor, initialAuth, trustedWitness, context) {
  return withTransferLock(value.sessionId, async () => {
    const auth = authority(context, { requireConnection: true });
    if (auth.error || auth.authenticatedUserId !== descriptor.authenticatedUserId || auth.authenticatedConnectionId !== descriptor.connectionId || auth.activeGmUserId !== descriptor.activeGmUserId) return failure([auth.error ?? diagnostic("m11-active-gm-required", "transport.connection")], identities);
    const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
    if (resolved.match.documentId !== descriptor.sessionDocumentId || !pristineSession(resolved.match.session, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const prior = resolved.match.session;
    const fp = fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, "abort-session", { reason: value.reason, confirmation: value.confirmation });
    const replay = replayOrConflict(prior.processedRequests, value.requestId, auth.authenticatedUserId, "gm", fp, identities); if (replay) return replay;
    if (prior.activeGmUserId !== auth.activeGmUserId) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.authorityEpoch !== prior.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.expectedRevision !== prior.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    if (value.confirmation !== true) return failure([diagnostic("m11-abort-confirmation-required", "confirmation")], identities);
    const setup = prior.sessionState === "setup" && ["configuration", "ready"].includes(prior.encounterState.lifecycleState);
    const active = ["round-introduction", "crew-planning", "plan-locked", "station-resolution", "round-closeout", "next-round", "event-closeout-review", "paused"].includes(prior.sessionState)
      && ["active", "paused"].includes(prior.encounterState.lifecycleState);
    if (!setup && !active) return failure([diagnostic("m11-command-not-allowed", "request.kind")], identities);
    const abortScope = setup ? "setup-cancellation" : "active-event";
    const expectedLifecycle = setup ? "discarded" : "abandoned";
    const dep = m10Function(context, "applyVoyageEncounterAbortTransition", null);
    if (!dep) return failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    const depResult = await callAbortDependency(dep, prior.encounterState, { kind: setup ? "voyage.abort-setup" : "voyage.abort-active-event", sessionId: prior.sessionId, abortScope, reason: value.reason });
    const validated = task7DependencyResult(depResult, prior, expectedLifecycle, "aborted");
    if (!validated) return m10Failure(depResult) ? failure(depResult.errors, identities) : failure([diagnostic("m11-m10-handoff-invalid", "m10")], identities);
    if (!trustedWitness?.occurredAt) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
    const candidate = capture(prior).value, previousRevision = prior.revision, revision = previousRevision + 1;
    candidate.revision = revision; candidate.sessionState = "aborted"; candidate.encounterState = validated.nextState;
    const domainEvent = capture(validated.events[0]).value; candidate.events.push(domainEvent);
    const runtimeEvent = task7AbortEvent(candidate, { abortScope }, auth, previousRevision, revision, prior.encounterState.revision, validated.nextState.revision); candidate.events.push(runtimeEvent);
    const audit = task7AbortAudit({ ...candidate, sessionState: prior.sessionState }, { ...value, abortScope }, auth, previousRevision, revision, trustedWitness.occurredAt, prior.encounterState.lifecycleState, expectedLifecycle, setup ? "setup-cancelled" : "event-aborted", active ? false : null); candidate.auditHistory.push(audit);
    const response = successWithEvents(candidate, value.requestId, [domainEvent, runtimeEvent]);
    candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind: "gm", fingerprint: fp, commandKind: "abort-session", resultKind: "aborted", resultRevision: revision, response });
    if (!pristineSession(candidate, resolved.match.documentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    try { await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(resolved.match.document, value.sessionId, resolved.match.documentId, candidate, prior, value.requestId, context, { successResponse: response }); }
    return sessionWriteClassification(resolved.match.document, value.sessionId, resolved.match.documentId, candidate, prior, value.requestId, context, { successResponse: response });
  });
}

async function task7CorrectionWithinExclusive(value, identities, descriptor, trustedWitness, context) {
  return withTransferLock(value.sessionId, async () => {
    const auth = authority(context, { requireConnection: true }); if (auth.error || auth.authenticatedUserId !== descriptor.authenticatedUserId || auth.authenticatedConnectionId !== descriptor.connectionId || auth.activeGmUserId !== descriptor.activeGmUserId) return failure([auth.error ?? diagnostic("m11-active-gm-required", "transport.connection")], identities);
    const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
    if (resolved.match.documentId !== descriptor.sessionDocumentId || !pristineSession(resolved.match.session, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const prior = resolved.match.session, payload = { correctionKind: value.correctionKind, targetRequestId: value.targetRequestId, targetCheckpointId: value.targetCheckpointId, replacementPayload: value.replacementPayload, reason: value.reason, confirmation: value.confirmation };
    const fp = fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, "correct-session", payload);
    const replay = replayOrConflict(prior.processedRequests, value.requestId, auth.authenticatedUserId, "gm", fp, identities); if (replay) return replay;
    if (prior.activeGmUserId !== auth.activeGmUserId) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.authorityEpoch !== prior.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.expectedRevision !== prior.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    if (value.confirmation !== true) return failure([diagnostic("m11-correction-confirmation-required", "confirmation")], identities);
    if (value.correctionKind !== "station-selection" && value.correctionKind !== "station-order") return failure([diagnostic("m11-command-payload-invalid", "correctionKind")], identities);
    if (value.targetRequestId !== null || value.targetCheckpointId !== null || !nonBlank(value.reason) || containsForbiddenPayloadAuthority(value.replacementPayload)) return failure([diagnostic("m11-command-payload-invalid", "replacementPayload")], identities);
    if (prior.sessionState !== "crew-planning" || prior.encounterState.lifecycleState !== "active" || prior.encounterState.phase !== "crew-planning" || prior.checkpoints.some((checkpoint) => checkpoint.kind === "before-plan-lock")) return failure([diagnostic("m11-command-not-allowed", "request.kind")], identities);
    const fields = value.correctionKind === "station-selection" ? ["stationId", "actionId"] : ["stationOrder"];
    if (!exactKeys(value.replacementPayload, fields)) return failure([diagnostic("m11-command-payload-invalid", "replacementPayload")], identities);
    const api = m10Function(context, value.correctionKind === "station-selection" ? "applyVoyageEncounterStationActionSelectionChange" : "applyVoyageEncounterStationOrderProposalChange", value.correctionKind === "station-selection" ? applyVoyageEncounterStationActionSelectionChange : applyVoyageEncounterStationOrderProposalChange);
    let result = null;
    try { result = typeof api === "function" ? await api(capture(prior.encounterState).value, capture(value.replacementPayload).value) : null; result = capture(result).ok ? capture(result).value : null; } catch { result = null; }
    const valid = isPlainObject(result) && exactKeys(result, ["ok", "nextState", "events", "errors", "warnings"]) && result.ok === true && Array.isArray(result.events) && result.events.length === 1 && Array.isArray(result.errors) && result.errors.length === 0 && Array.isArray(result.warnings) && isPlainObject(result.nextState) && validEncounterState(result.nextState, prior) && result.nextState.lifecycleState === "active" && result.nextState.phase === "crew-planning" && result.nextState.revision === prior.encounterState.revision + 1 && result.events[0]?.encounterId === prior.eventId && result.events[0]?.lifecycleState === "active" && safeInteger(result.events[0]?.previousRevision) && safeInteger(result.events[0]?.revision) && result.events[0].previousRevision === prior.encounterState.revision && result.events[0].revision === result.nextState.revision;
    if (!valid) return failure([diagnostic("m11-correction-invalid", "replacementPayload")], identities);
    if (!trustedWitness?.occurredAt) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
    const candidate = capture(prior).value, previousRevision = prior.revision, revision = previousRevision + 1; candidate.revision = revision; candidate.encounterState = capture(result.nextState).value;
    const domainEvent = capture(result.events[0]).value; candidate.events.push(domainEvent);
    const runtimeEvent = task7CorrectionEvent(candidate, value, auth, previousRevision, revision, prior.encounterState.revision, candidate.encounterState.revision); candidate.events.push(runtimeEvent);
    candidate.auditHistory.push({ auditId: auditId(candidate.sessionId, candidate.auditHistory.length, "correction-applied"), kind: "correction-applied", sessionId: candidate.sessionId, requestId: value.requestId, actorUserId: auth.authenticatedUserId, authorityEpoch: candidate.authorityEpoch, previousRevision, revision, occurredAt: trustedWitness.occurredAt, details: { correctionKind: value.correctionKind, targetRequestId: null, previousSessionState: prior.sessionState, nextSessionState: candidate.sessionState, previousEncounterRevision: prior.encounterState.revision, encounterRevision: candidate.encounterState.revision, reason: value.reason } });
    const response = successWithEvents(candidate, value.requestId, [domainEvent, runtimeEvent]);
    candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind: "gm", fingerprint: fp, commandKind: "correct-session", resultKind: "corrected", resultRevision: revision, response });
    if (!pristineSession(candidate, resolved.match.documentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    try { await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(resolved.match.document, value.sessionId, resolved.match.documentId, candidate, prior, value.requestId, context, { successResponse: response }); }
    return sessionWriteClassification(resolved.match.document, value.sessionId, resolved.match.documentId, candidate, prior, value.requestId, context, { successResponse: response });
  });
}

export async function createVoyageEventSession(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = requestIdentities(value);
  if (!exactKeys(value, CREATE_FIELDS)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  if (value.kind !== "voyage.m11-create-session") return failure([diagnostic("m11-invalid-mode", "request.kind")], identities);
  const auth = authority(context); if (auth.error) return failure([auth.error], identities);
  if (!nonBlank(value.requestId) || ![value.sessionId, value.eventId, value.definitionSnapshotId, value.shipId].every(nonBlank) || !isPlainObject(value.eventDefinition) || !isPlainObject(value.initialEncounterState)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const existing = findSessionDocuments(value.sessionId, context); if (existing.error) return failure([existing.error], identities);
  if (existing.matches.length === 1) {
    const existingSession = existing.matches[0].session;
    if (existingSession && pristineSession(existingSession, existing.matches[0].documentId)) {
      const replay = replayOrConflict(existingSession.processedRequests, value.requestId, auth.activeGmUserId, "gm", fingerprint(value.sessionId, auth.activeGmUserId, "gm", 0, 0, CREATION_COMMAND_KIND, creationPayload(value)), identities);
      if (replay) return replay;
    }
    return revision0Failure("m11-session-write-failed", VOYAGE_SESSION_PATH, identities, {
      revision0Stage: "create-before",
      sessionId: value.sessionId,
      documentId: existing.matches[0]?.documentId ?? null,
      candidateRevision: null,
      persistedRevision: existingSession?.revision ?? null,
      persistedSessionPresent: Boolean(existingSession)
    });
  }
  if (existing.matches.length > 1) return failure([diagnostic("m11-ambiguous-session-document", "sessionId")], identities);
  let resolved, initialEncounter;
  try {
    if (typeof context.resolveEventDefinitionSnapshot !== "function" || typeof context.createInitialEncounterState !== "function") return failure([diagnostic("m11-command-payload-invalid", "request.eventDefinition")], identities);
    resolved = await context.resolveEventDefinitionSnapshot(value.eventId, value.definitionSnapshotId);
    const definition = capture(resolved); if (!definition.ok || !isPlainObject(definition.value) || !equal(value.eventDefinition, definition.value)) return failure([diagnostic("m11-command-payload-invalid", "request.eventDefinition")], identities);
    initialEncounter = await context.createInitialEncounterState({ eventDefinition: definition.value, sessionId: value.sessionId, eventId: value.eventId, definitionSnapshotId: value.definitionSnapshotId, shipId: value.shipId });
    const encounter = capture(initialEncounter); if (!encounter.ok || !equal(value.initialEncounterState, encounter.value)) return failure([diagnostic("m11-command-payload-invalid", "request.initialEncounterState")], identities);
    initialEncounter = encounter.value;
  } catch { return failure([diagnostic("m11-command-payload-invalid", "request.eventDefinition")], identities); }
  const id = generatedId(context), levels = context.documentOwnershipLevels ?? globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS ?? { NONE: 0, OWNER: 3 }, ownership = ownershipForGms(auth.users, levels);
  const earlyRevision0Failure = (revision0Stage, details = {}) => revision0Failure("m11-session-write-failed", VOYAGE_SESSION_PATH, identities, { revision0Stage, sessionId: value.sessionId, documentId: id, ...details });
  if (!id || !ownership || ownership[auth.activeGmUserId] !== levels.OWNER) return earlyRevision0Failure("create-before");
  const before = journalDocuments(context); if (!before.ok) return earlyRevision0Failure("create-before");
  const beforeIds = before.documents.map((entry) => documentId(entry).value); if (beforeIds.some((entry) => !nonBlank(entry)) || beforeIds.includes(id)) return earlyRevision0Failure("create-before");
  const beforeSources = before.documents.map((entry) => sourceSnapshot(entry, context)); if (beforeSources.some((entry) => entry === null)) return earlyRevision0Failure("create-before");
  const identity = { sessionDocumentId: id, sessionId: value.sessionId, eventId: value.eventId, definitionSnapshotId: value.definitionSnapshotId, shipId: value.shipId };
  const session = initialSession(identity, initialEncounter, auth.activeGmUserId);
  const revision0 = {
    revision0Stage: "create-before", sessionId: value.sessionId, documentId: id, createdDocumentId: null,
    rereadDocumentId: null, candidateRevision: session?.revision ?? 0, persistedRevision: null,
    persistedSessionPresent: null, firstDifferencePath: null, expectedValue: null, actualValue: null,
    createErrorName: null, createErrorMessage: null, createErrorCode: null, createErrorCauseMessage: null, createErrorStack: null
  };
  const setCreationSubstage = (substage, details = {}) => {
    revision0.revision0Stage = substage;
    if (Object.hasOwn(details, "createdDocumentId")) revision0.createdDocumentId = details.createdDocumentId ?? null;
    if (Object.hasOwn(details, "rereadDocumentId")) revision0.rereadDocumentId = details.rereadDocumentId ?? null;
    if (Object.hasOwn(details, "persistedRevision")) revision0.persistedRevision = details.persistedRevision ?? null;
    if (Object.hasOwn(details, "persistedSessionPresent")) revision0.persistedSessionPresent = details.persistedSessionPresent ?? null;
    if (Object.hasOwn(details, "firstDifferencePath")) revision0.firstDifferencePath = details.firstDifferencePath ?? null;
    if (Object.hasOwn(details, "expectedValue")) revision0.expectedValue = details.expectedValue ?? null;
    if (Object.hasOwn(details, "actualValue")) revision0.actualValue = details.actualValue ?? null;
    if (Object.hasOwn(details, "createErrorName")) revision0.createErrorName = details.createErrorName ?? null;
    if (Object.hasOwn(details, "createErrorMessage")) revision0.createErrorMessage = details.createErrorMessage ?? null;
    if (Object.hasOwn(details, "createErrorCode")) revision0.createErrorCode = details.createErrorCode ?? null;
    if (Object.hasOwn(details, "createErrorCauseMessage")) revision0.createErrorCauseMessage = details.createErrorCauseMessage ?? null;
    if (Object.hasOwn(details, "createErrorStack")) revision0.createErrorStack = details.createErrorStack ?? null;
    if (details.firstDifference) {
      revision0.firstDifferencePath = details.firstDifference.path ?? null;
      revision0.expectedValue = details.firstDifference.expected ?? null;
      revision0.actualValue = details.firstDifference.actual ?? null;
    }
  };
  let firstRevision0Failure = null;
  const reportCreationFailure = (substage = revision0.revision0Stage, details = {}) => {
    setCreationSubstage(substage, details);
    if (firstRevision0Failure === null) firstRevision0Failure = { ...revision0 };
  };
  const revision0Result = (code, path) => revision0Failure(code, path, identities, firstRevision0Failure ?? revision0);
  const creationResponse = success(session, value.requestId);
  session.processedRequests = [{ requestId: value.requestId, principalUserId: auth.activeGmUserId, projectionKind: "gm", fingerprint: fingerprint(value.sessionId, auth.activeGmUserId, "gm", 0, 0, CREATION_COMMAND_KIND, creationPayload(value)), commandKind: CREATION_COMMAND_KIND, resultKind: "created", resultRevision: 0, response: creationResponse }];
  if (!pristineSession(session, id)) return earlyRevision0Failure("validate-pristine", { candidateRevision: session?.revision ?? null });
  const JournalEntry = context.JournalEntry ?? globalThis.JournalEntry; if (typeof JournalEntry?.create !== "function") return earlyRevision0Failure("create-before", { candidateRevision: session?.revision ?? null });
  let document;
  try {
    setCreationSubstage("create-before");
    document = await JournalEntry.create({ _id: id, name: "Arcflight Voyage Session", ownership, flags: { [ARCFLIGHT_MODULE_ID]: { system: { voyageSession: session } } } }, { keepId: true, render: false, renderSheet: false });
  } catch (error) {
    const errorField = (key) => {
      try {
        const value = error?.[key];
        return typeof value === "string" || typeof value === "number" ? value : null;
      } catch { return null; }
    };
    const createErrorCauseMessage = (() => {
      try {
        const cause = error?.cause;
        const message = cause?.message;
        return typeof message === "string" ? message : null;
      } catch { return null; }
    })();
    const createErrorStackValue = errorField("stack");
    const createErrorStack = typeof createErrorStackValue === "string" ? createErrorStackValue.slice(0, 2000) : null;
    const createError = { name: errorField("name"), message: errorField("message"), code: errorField("code"), causeMessage: createErrorCauseMessage, stack: createErrorStack };
    reportCreationFailure("create-before", { createErrorName: createError.name, createErrorMessage: createError.message, createErrorCode: createError.code, createErrorCauseMessage: createError.causeMessage, createErrorStack });
    return revision0Result("m11-session-write-failed", VOYAGE_SESSION_PATH);
  }
  setCreationSubstage("create-returned");
  const returnedId = documentId(document).value;
  setCreationSubstage("reread-by-id", { createdDocumentId: returnedId });
  const reread = journalDocuments(context); if (!reread.ok) { reportCreationFailure("reread-by-id", { createdDocumentId: returnedId }); return revision0Result("m11-recovery-required", "recovery"); }
  if (document === undefined) {
    reportCreationFailure("reread-by-id", { createdDocumentId: returnedId, rereadDocumentId: null, persistedSessionPresent: false });
    return collectionUnchanged(before.documents, reread.documents, beforeSources, context) && !reread.documents.some((entry) => readDocumentSession(entry, context).sessionId === value.sessionId)
      ? revision0Result("m11-session-write-failed", VOYAGE_SESSION_PATH) : revision0Result("m11-recovery-required", "recovery");
  }
  const live = reread.documents.filter((entry) => documentId(entry).value === id);
  if (live.length !== 1) {
    const sessionReread = reread.documents.map((entry) => readDocumentSession(entry, context)).find((entry) => entry.ok && entry.sessionId === value.sessionId);
    reportCreationFailure("reread-by-id", { createdDocumentId: returnedId, rereadDocumentId: sessionReread?.documentId ?? null, persistedSessionPresent: Boolean(sessionReread?.session) });
  }
  setCreationSubstage("extract-session", { createdDocumentId: returnedId, persistedSessionPresent: live.length === 1 ? null : false });
  const persisted = live.length === 1 ? readDocumentSession(live[0], context, (substage) => setCreationSubstage(substage)) : null;
  setCreationSubstage(revision0.revision0Stage, { createdDocumentId: returnedId, rereadDocumentId: persisted?.documentId ?? null, persistedRevision: persisted?.session?.revision ?? null, persistedSessionPresent: persisted?.ok === true && Boolean(persisted.session) });
  setCreationSubstage("compare-session");
  const comparison = persisted?.ok === true && persisted.session ? firstCanonicalDifference(session, persisted.session) : null;
  if (comparison) reportCreationFailure("compare-session", { createdDocumentId: returnedId, rereadDocumentId: persisted.documentId, persistedRevision: persisted.session?.revision ?? null, persistedSessionPresent: true, firstDifference: comparison });
  setCreationSubstage("reload-session");
  const pristine = persisted?.ok === true && persisted.documentId === id && pristineSession(persisted.session, id, { replayContext: context });
  if (persisted?.ok === true && !pristine) reportCreationFailure("validate-pristine", { createdDocumentId: returnedId, rereadDocumentId: persisted.documentId, persistedRevision: persisted.session?.revision ?? null, persistedSessionPresent: Boolean(persisted.session) });
  const verified = returnedId === id && persisted?.ok === true && persisted.documentId === id && persisted.sessionId === value.sessionId && !comparison && pristine;
  if (verified) return success(persisted.session, value.requestId);
  reportCreationFailure("cleanup-classification", { createdDocumentId: returnedId, rereadDocumentId: persisted?.documentId ?? null, persistedRevision: persisted?.session?.revision ?? null, persistedSessionPresent: persisted?.ok === true && Boolean(persisted.session), firstDifference: comparison });
  const cleaned = returnedId === id && await cleanupExact(document, id, value.sessionId, before.documents, context, session);
  return revision0Result(cleaned ? "m11-session-write-failed" : "m11-recovery-required", cleaned ? VOYAGE_SESSION_PATH : "recovery");
}

export function dispatchVoyageEventSessionCommand(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = { requestId: nonBlank(value?.requestId) ? value.requestId : null, sessionId: nonBlank(value?.sessionId) ? value.sessionId : null };
  const fields = ["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch", "commandKind", "payload"];
  if (!isPlainObject(value) || !Object.hasOwn(value, "requestId") || !nonBlank(value.requestId)) return failure([diagnostic("m11-request-id-required", "request.requestId")], identities);
  if (!exactKeys(value, fields)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  if (value.kind !== "voyage.m11-command") return failure([diagnostic("m11-invalid-mode", "request.kind")], identities);
  const auth = authenticatedContext(context); if (auth.error) return failure([auth.error], identities);
  if (!nonBlank(value.sessionId) || !nonBlank(value.commandKind) || !safeInteger(value.expectedRevision) || !safeInteger(value.authorityEpoch) || !isPlainObject(value.payload)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
  const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
  const match = resolved.match; if (!pristineSession(match.session, match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  if (match.session.activeGmUserId !== auth.activeGmUserId) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  const projectionKind = deriveProjectionKind(auth, match.session, context);
  const requestFingerprint = fingerprint(value.sessionId, auth.authenticatedUserId, projectionKind, value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload);
  const replay = replayOrConflict(match.session.processedRequests, value.requestId, auth.authenticatedUserId, projectionKind, requestFingerprint, identities); if (replay) return replay;
  if (value.authorityEpoch !== match.session.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  if (value.expectedRevision !== match.session.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
  if (!COMMAND_KINDS.has(value.commandKind)) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
  if (value.commandKind !== "closeout-review" && containsForbiddenPayloadAuthority(value.payload)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
  if (TASK2_COMMANDS.has(value.commandKind)) {
    if (auth.user?.isGM !== true || auth.authenticatedUserId !== auth.activeGmUserId) return failure([diagnostic("m11-active-gm-required", "transport.activeGm")], identities);
    if (!task2PayloadValid(value.commandKind, value.payload)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
    return dispatchTask2Command(value, identities, auth, match, context);
  }
  if (CLOSEOUT_COMMANDS.has(value.commandKind)) return dispatchCloseoutCommand(value, identities, auth, match, context);
  return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
}

export async function transferVoyageEventSessionControl(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = requestIdentities(value);
  if (!isPlainObject(value) || !Object.hasOwn(value, "requestId") || !nonBlank(value.requestId)) return failure([diagnostic("m11-request-id-required", "request.requestId")], identities);
  if (!exactKeys(value, TRANSFER_REQUEST_FIELDS)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  if (value.kind !== "voyage.m11-transfer-control") return failure([diagnostic("m11-invalid-mode", "request.kind")], identities);
  const auth = authority(context, { requireConnection: true }); if (auth.error) return failure([auth.error], identities);
  if (!nonBlank(value.sessionId) || !nonBlank(value.targetUserId) || !nonBlank(value.reason) || !safeInteger(value.expectedRevision) || !safeInteger(value.authorityEpoch)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const initialResolved = resolveSessionDocument(value.sessionId, context); if (initialResolved.error) return failure([initialResolved.error], identities);
  if (!pristineSession(initialResolved.match.session, initialResolved.match.documentId, { allowBootstrapNull: true, replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  const requestFingerprint = fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, TRANSFER_COMMAND_KIND, { targetUserId: value.targetUserId, reason: value.reason });
  const earlyReplay = replayOrConflict(initialResolved.match.session.processedRequests, value.requestId, auth.authenticatedUserId, "gm", requestFingerprint, identities); if (earlyReplay) return earlyReplay;
  const coordinator = transferCoordinator(context); if (coordinator.error) return failure([coordinator.error], identities);
  const descriptor = coordinatorDescriptor(value, initialResolved.match.documentId, auth);
  if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  return runExclusiveTransfer(coordinator, descriptor, (trustedWitness) => withTransferLock(value.sessionId, async () => {
    const lockedAuth = authority(context, { requireConnection: true }); if (lockedAuth.error) return failure([lockedAuth.error], identities);
    if (lockedAuth.authenticatedUserId !== descriptor.authenticatedUserId || lockedAuth.authenticatedConnectionId !== descriptor.connectionId || lockedAuth.activeGmUserId !== descriptor.activeGmUserId) return failure([diagnostic("m11-active-gm-required", "transport.connection")], identities);
    const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
    const match = resolved.match;
    if (match.documentId !== descriptor.sessionDocumentId) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    if (!pristineSession(match.session, match.documentId, { allowBootstrapNull: true, replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const replay = replayOrConflict(match.session.processedRequests, value.requestId, lockedAuth.authenticatedUserId, "gm", requestFingerprint, identities); if (replay) return replay;
    if (!targetIsCurrentActiveGm(value.targetUserId, lockedAuth)) return failure([diagnostic("m11-control-transfer-target-invalid", "request.targetUserId")], identities);
    if (value.authorityEpoch !== match.session.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.expectedRevision !== match.session.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    const previous = match.session;
    const previousGm = previous.activeGmUserId, bootstrap = previousGm !== lockedAuth.activeGmUserId, occurredAt = trustedWitness.occurredAt;
    const finalAuth = authority(context, { requireConnection: true }); if (finalAuth.error) return failure([finalAuth.error], identities);
    if (finalAuth.authenticatedUserId !== descriptor.authenticatedUserId || finalAuth.authenticatedConnectionId !== descriptor.connectionId || finalAuth.activeGmUserId !== descriptor.activeGmUserId) return failure([diagnostic("m11-active-gm-required", "transport.connection")], identities);
    if (!targetIsCurrentActiveGm(value.targetUserId, finalAuth)) return failure([diagnostic("m11-control-transfer-target-invalid", "request.targetUserId")], identities);
    const finalResolved = resolveSessionDocument(value.sessionId, context); if (finalResolved.error) return failure([finalResolved.error], identities);
    if (finalResolved.match.documentId !== descriptor.sessionDocumentId || !pristineSession(finalResolved.match.session, descriptor.sessionDocumentId, { allowBootstrapNull: true, replayContext: context })) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    const latest = finalResolved.match.session;
    const finalReplay = replayOrConflict(latest.processedRequests, value.requestId, finalAuth.authenticatedUserId, "gm", requestFingerprint, identities); if (finalReplay) return finalReplay;
    if (latest.activeGmUserId !== previousGm) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    if (value.authorityEpoch !== latest.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.expectedRevision !== latest.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    let candidateCapture;
    try { candidateCapture = capture(latest); } catch { candidateCapture = { ok: false }; }
    if (!candidateCapture.ok) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const candidate = candidateCapture.value;
    candidate.activeGmUserId = finalAuth.activeGmUserId;
    candidate.authorityEpoch = latest.authorityEpoch + 1;
    const response = success(candidate, value.requestId);
    const record = transferRecord(latest, value, finalAuth, bootstrap, response);
    const audit = transferAudit(latest, value, finalAuth, previousGm, bootstrap, occurredAt);
    candidate.processedRequests.push(record); candidate.auditHistory.push(audit);
    if (!pristineSession(candidate, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    try {
      await match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false });
    } catch {
      return classifyTransferWrite(match.document, value.sessionId, descriptor.sessionDocumentId, candidate, previous, value.requestId, context, { allowBootstrapNull: true, replayContext: context });
    }
    return classifyTransferWrite(match.document, value.sessionId, descriptor.sessionDocumentId, candidate, previous, value.requestId, context, { allowBootstrapNull: true, replayContext: context });
  }), identities);
}

export async function abortVoyageEventSession(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = requestIdentities(value);
  if (!exactKeys(value, ABORT_REQUEST_FIELDS)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  if (value.kind !== "voyage.m11-abort-session") return failure([diagnostic("m11-invalid-mode", "request.kind")], identities);
  if (!nonBlank(value.requestId) || !nonBlank(value.sessionId) || !safeInteger(value.expectedRevision) || !safeInteger(value.authorityEpoch) || !nonBlank(value.reason) || typeof value.confirmation !== "boolean") return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const auth = authority(context, { requireConnection: true }); if (auth.error) return failure([auth.error], identities);
  const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
  if (!pristineSession(resolved.match.session, resolved.match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  const fp = fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, "abort-session", { reason: value.reason, confirmation: value.confirmation });
  const replay = replayOrConflict(resolved.match.session.processedRequests, value.requestId, auth.authenticatedUserId, "gm", fp, identities); if (replay) return replay;
  const coordinator = transferCoordinator(context); if (coordinator.error) return failure([coordinator.error], identities);
  const descriptor = coordinatorDescriptor(value, resolved.match.documentId, auth); if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  return runExclusiveTransfer(coordinator, descriptor, (witness) => task7AbortWithinExclusive(value, identities, descriptor, auth, witness, context), identities, { nonWinnerCode: "m11-control-transfer-required", nonWinnerPath: "authorityEpoch" });
}

export async function correctVoyageEventSession(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = requestIdentities(value);
  if (!exactKeys(value, CORRECTION_REQUEST_FIELDS)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  if (value.kind !== "voyage.m11-correct-session") return failure([diagnostic("m11-invalid-mode", "request.kind")], identities);
  if (!nonBlank(value.requestId) || !nonBlank(value.sessionId) || !safeInteger(value.expectedRevision) || !safeInteger(value.authorityEpoch) || !nonBlank(value.reason) || typeof value.confirmation !== "boolean" || !isPlainObject(value.replacementPayload)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const auth = authority(context, { requireConnection: true }); if (auth.error) return failure([auth.error], identities);
  const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
  if (!pristineSession(resolved.match.session, resolved.match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  const payload = { correctionKind: value.correctionKind, targetRequestId: value.targetRequestId, targetCheckpointId: value.targetCheckpointId, replacementPayload: value.replacementPayload, reason: value.reason, confirmation: value.confirmation };
  const fp = fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, "correct-session", payload);
  const replay = replayOrConflict(resolved.match.session.processedRequests, value.requestId, auth.authenticatedUserId, "gm", fp, identities); if (replay) return replay;
  const coordinator = transferCoordinator(context); if (coordinator.error) return failure([coordinator.error], identities);
  const descriptor = coordinatorDescriptor(value, resolved.match.documentId, auth); if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  return runExclusiveTransfer(coordinator, descriptor, (witness) => task7CorrectionWithinExclusive(value, identities, descriptor, witness, context), identities, { nonWinnerCode: "m11-control-transfer-required", nonWinnerPath: "authorityEpoch" });
}

async function recoverWithinExclusive(value, identities, descriptor, initialAuth, trustedWitness, context) {
  return withTransferLock(value.sessionId, async () => {
    const lockedAuth = authority(context, { requireConnection: true }); if (lockedAuth.error) return failure([lockedAuth.error], identities);
    if (lockedAuth.authenticatedUserId !== descriptor.authenticatedUserId || lockedAuth.authenticatedConnectionId !== descriptor.connectionId || lockedAuth.activeGmUserId !== descriptor.activeGmUserId) return failure([diagnostic("m11-active-gm-required", "transport.connection")], identities);
    const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
    if (resolved.match.documentId !== descriptor.sessionDocumentId) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    const envelope = recoveryEnvelope(resolved.match.session, resolved.match.documentId);
    const requestFingerprint = fingerprint(value.sessionId, lockedAuth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, RECOVERY_COMMAND_KIND, { recoveryAction: value.recoveryAction, reason: value.reason });
    if (!envelope) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    const existing = envelope.processedRequests.find((record) => record.requestId === value.requestId);
    if (existing) {
      if (existing.principalUserId !== lockedAuth.authenticatedUserId || existing.projectionKind !== "gm" || existing.fingerprint !== requestFingerprint) return failure([diagnostic("m11-request-id-conflict", "request.requestId")], identities);
      if (!validRecoveryReplayRecord(existing, envelope, value, lockedAuth.authenticatedUserId, requestFingerprint)) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
      const replay = capture(existing.response); return replay.ok ? replay.value : failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    }
    if (!["rebuild-latest", "abort"].includes(value.recoveryAction) || (value.recoveryAction === "abort" && resolved.match.session.recovery?.status !== "required")) return failure([diagnostic("m11-command-not-allowed", "request.recoveryAction")], identities);
    if (!recoveryStoredRecordsValid(envelope, context, resolved.match.session.recovery, resolved.match.session)) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    if (value.authorityEpoch !== envelope.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.expectedRevision !== envelope.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    if (!recoveryCheckpointJournalValid(envelope)) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    const checkpoints = envelope.checkpoints.filter((checkpoint) => checkpoint.invalidated === false && replayRecoveryEvidence(envelope, checkpoint, context)).sort((left, right) => right.revision - left.revision);
    const source = checkpoints[0];
    if (!source) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    const replayedState = replayRecoveryEvidence(envelope, source, context);
    if (!replayedState) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    const occurredAt = trustedWitness.occurredAt;
    const finalAuth = authority(context, { requireConnection: true }); if (finalAuth.error) return failure([finalAuth.error], identities);
    if (finalAuth.authenticatedUserId !== initialAuth.authenticatedUserId || finalAuth.authenticatedConnectionId !== descriptor.connectionId || finalAuth.activeGmUserId !== descriptor.activeGmUserId) return failure([diagnostic("m11-active-gm-required", "transport.connection")], identities);
    const finalResolved = resolveSessionDocument(value.sessionId, context); if (finalResolved.error) return failure([finalResolved.error], identities);
    if (finalResolved.match.documentId !== descriptor.sessionDocumentId) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    const finalEnvelope = recoveryEnvelope(finalResolved.match.session, finalResolved.match.documentId);
    if (!finalEnvelope || !recoveryStoredRecordsValid(finalEnvelope, context, finalResolved.match.session.recovery, finalResolved.match.session)) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    const finalExisting = finalEnvelope.processedRequests.find((record) => record.requestId === value.requestId);
    if (finalExisting) {
      if (finalExisting.principalUserId !== finalAuth.authenticatedUserId || finalExisting.projectionKind !== "gm" || finalExisting.fingerprint !== requestFingerprint) return failure([diagnostic("m11-request-id-conflict", "request.requestId")], identities);
      const replay = capture(finalExisting.response); return replay.ok ? replay.value : failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    }
    if (finalEnvelope.authorityEpoch !== value.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (finalEnvelope.revision !== value.expectedRevision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    if (!recoveryCheckpointJournalValid(finalEnvelope)) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    const finalCheckpoints = finalEnvelope.checkpoints.filter((checkpoint) => checkpoint.invalidated === false && replayRecoveryEvidence(finalEnvelope, checkpoint, context)).sort((left, right) => right.revision - left.revision);
    const finalSource = finalCheckpoints[0], finalState = finalSource && replayRecoveryEvidence(finalEnvelope, finalSource, context);
    if (!finalSource || !finalState) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    const built = value.recoveryAction === "abort" ? await buildRecoveryAbortCandidate(finalResolved.match.session, finalEnvelope, finalSource, finalState, value, finalAuth, requestFingerprint, occurredAt, context) : buildRecoveryCandidate(finalResolved.match.session, finalEnvelope, finalSource, finalState, value, finalAuth, requestFingerprint, occurredAt);
    if (!built || !validSessionEvidence(built.candidate, finalResolved.match.documentId, { recoveryEnvelope: true }, context)) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    try { await finalResolved.match.document.update({ [VOYAGE_SESSION_PATH]: built.candidate }, { diff: false, recursive: false }); }
    catch { return classifyRecoveryWrite(value.sessionId, finalResolved.match.documentId, built.candidate, finalResolved.match.session, value.requestId, context, { successResponse: built.response }); }
    return classifyRecoveryWrite(value.sessionId, finalResolved.match.documentId, built.candidate, finalResolved.match.session, value.requestId, context, { successResponse: built.response });
  });
}

export async function recoverVoyageEventSession(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = requestIdentities(value);
  if (!exactKeys(value, RECOVERY_REQUEST_FIELDS)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  if (value.kind !== "voyage.m11-recover-session") return failure([diagnostic("m11-invalid-mode", "request.kind")], identities);
  if (!nonBlank(value.requestId) || !nonBlank(value.sessionId) || !nonBlank(value.reason) || !safeInteger(value.expectedRevision) || !safeInteger(value.authorityEpoch) || !RECOVERY_ACTIONS.has(value.recoveryAction)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const auth = authority(context, { requireConnection: true }); if (auth.error) return failure([auth.error], identities);
  const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
  const envelope = recoveryEnvelope(resolved.match.session, resolved.match.documentId);
  const requestFingerprint = fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, RECOVERY_COMMAND_KIND, { recoveryAction: value.recoveryAction, reason: value.reason });
  if (!envelope) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
  const existing = envelope.processedRequests.find((record) => record.requestId === value.requestId);
  if (existing) {
    if (existing.principalUserId !== auth.authenticatedUserId || existing.projectionKind !== "gm" || existing.fingerprint !== requestFingerprint) return failure([diagnostic("m11-request-id-conflict", "request.requestId")], identities);
    if (!validRecoveryReplayRecord(existing, envelope, value, auth.authenticatedUserId, requestFingerprint)) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
    const replay = capture(existing.response); return replay.ok ? replay.value : failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
  }
  if (!["rebuild-latest", "abort"].includes(value.recoveryAction) || (value.recoveryAction === "abort" && resolved.match.session.recovery?.status !== "required")) return failure([diagnostic("m11-command-not-allowed", "request.recoveryAction")], identities);
  if (!recoveryStoredRecordsValid(envelope, context, resolved.match.session.recovery, resolved.match.session)) return failure([diagnostic("m11-unrecoverable-session", VOYAGE_SESSION_PATH)], identities);
  const coordinator = transferCoordinator(context); if (coordinator.error) return failure([coordinator.error], identities);
  const descriptor = coordinatorDescriptor(value, resolved.match.documentId, auth);
  if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  return runExclusiveTransfer(coordinator, descriptor, (trustedWitness) => recoverWithinExclusive(value, identities, descriptor, auth, trustedWitness, context), identities);
}

export function readVoyageEventSessionProjection(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = requestIdentities(value);
  if (!exactKeys(value, READ_PROJECTION_FIELDS)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  if (value.kind !== "voyage.m11-read-projection") return failure([diagnostic("m11-invalid-mode", "request.kind")], identities);
  const auth = projectionPrincipal(context); if (auth.error) return failure([auth.error], identities);
  if (!nonBlank(value.requestId) || !nonBlank(value.sessionId) || !safeInteger(value.expectedRevision)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
  const match = resolved.match;
  if (!pristineSession(match.session, match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  const projectionKind = deriveProjectionKind(auth, match.session, context);
  if (value.expectedRevision !== match.session.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
  if (match.session.processedRequests.some((record) => record.requestId === value.requestId)) return failure([diagnostic("m11-request-id-conflict", "request.requestId")], identities);
  const projection = buildSessionProjection(match.session, projectionKind);
  if (!projection) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  const response = success(match.session, value.requestId);
  response.projection = capture(projection).value;
  return response;
}

/** Read the GM-only planning data needed by the M12 Event Manager. */
export function readVoyageEventSessionPlanning(sessionId, context = {}) {
  const captured = capture(sessionId);
  const identity = { sessionId: captured.ok && nonBlank(captured.value) ? captured.value : null };
  if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")], identity);
  if (!nonBlank(captured.value)) return failure([diagnostic("m11-invalid-request-shape", "sessionId")], identity);
  const auth = authority(context, { requireConnection: true }); if (auth.error) return failure([auth.error], identity);
  const resolved = resolveSessionDocument(captured.value, context); if (resolved.error) return failure([resolved.error], identity);
  const match = resolved.match;
  if (!pristineSession(match.session, match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
  if (match.session.activeGmUserId !== auth.activeGmUserId) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identity);
  try {
    const assignments = capture(match.session.encounterState.stationAssignments);
    let available = capture(match.session.encounterState.availableStations);
    const canonical = canonicalTask2Stations(match.session, context);
    if (canonical && !equal(available.value, canonical)) {
      if (bareTask2Stations(available.value)) available = { ok: true, value: canonical };
      else return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
    }
    const selections = capture(match.session.encounterState.selections);
    const riskBids = capture(match.session.encounterState.riskBids);
    const proposed = capture(match.session.encounterState.proposedStationOrder);
    const committed = capture(match.session.encounterState.committedStationOrder);
    if (![assignments, available, selections, riskBids, proposed, committed].every((entry) => entry.ok)) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
    const occupied = new Set(assignments.value.map((entry) => entry.stationId));
    const stations = available.value.filter((entry) => occupied.has(entry.stationId)).map((entry) => ({ stationId: entry.stationId, actions: entry.actions }));
    const planning = {
      schemaVersion: match.session.schemaVersion,
      sessionId: match.session.sessionId,
      eventId: match.session.eventId,
      revision: match.session.revision,
      sessionState: match.session.sessionState,
      authorityEpoch: match.session.authorityEpoch,
      roundNumber: match.session.encounterState.roundNumber,
      phase: match.session.encounterState.phase,
      stationAssignments: assignments.value,
      stations,
      selections: selections.value,
      riskBids: riskBids.value,
      proposedStationOrder: proposed.value,
      committedStationOrder: committed.value
    };
    const isolated = capture(planning); if (!isolated.ok) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
    const out = success(match.session, null); out.projection = isolated.value; return out;
  } catch { return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity); }
}

export function reloadVoyageEventSession(sessionId, context = {}) {
  const captured = capture(sessionId), identity = { sessionId: captured.ok && nonBlank(captured.value) ? captured.value : null };
  if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")], identity);
  if (!nonBlank(captured.value)) return failure([diagnostic("m11-invalid-request-shape", "request")], identity);
  const resolved = resolveSessionDocument(captured.value, context); if (resolved.error) return failure([resolved.error], identity);
  return pristineSession(resolved.match.session, resolved.match.documentId, { replayContext: context }) ? success(resolved.match.session) : failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
}
