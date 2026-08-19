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
import { prepareVoyageEncounterCrewPlanningReadiness } from "../domain/crew-planning-readiness.js";
import { validateVoyageHazardRecord, VOYAGE_HAZARD_RECORD_FIELDS } from "../domain/hazard-schema.js";
import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../domain/constants.js";
import { analyzeVoyagePressureBreachCloseoutTransaction } from "../domain/pressure-breach.js";
import { analyzeVoyageEncounterPressurePlan } from "../domain/pressure.js";
import { analyzeVoyageEncounterHazardCloseout, validateVoyageEncounterCloseoutSnapshot } from "../domain/closeout.js";
import { analyzeVoyageEncounterCloseoutReview } from "../domain/closeout-review.js";
import { applyVoyageEncounterResolutionTransition } from "../domain/resolution-transition.js";
import { applyVoyageEncounterConsequencesTransition } from "../domain/consequences-transition.js";
import { applyVoyageEncounterCrewPlanningTransition } from "../domain/crew-planning-transition.js";
import { analyzeVoyageEncounterRoundUnitAggregation } from "../domain/round-unit-aggregation.js";
import { analyzeVoyageEncounterRoundResult } from "../domain/round-result-classification.js";
import { analyzeVoyageEncounterActionOutcomes } from "../domain/action-outcome-interpretation.js";
import { analyzeVoyageEncounterActionOutcomeDefinitions } from "../domain/consequence-rules.js";
import { prepareVoyageEncounterActionExecutionRequests } from "../domain/resolution-execution-requests.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../domain/pending-checks.js";
import { applyVoyageEncounterPendingCheckResult } from "../domain/resolution-results.js";
import { validateVoyageEncounterStationOrder } from "../domain/station-order.js";
import { analyzeVoyageEncounterResolutionOrder } from "../domain/resolution-order.js";
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
// Slice I is intentionally expressed through the existing M11 correction
// envelope.  These are the only post-resolution corrections; the old Task 7
// planning corrections remain separate and are never enabled here.
const SLICE_I_CORRECTION_KINDS = Object.freeze(["remaining-order", "target", "operator-takeover", "void-roll", "retry-roll-integration", "recorded-result"]);
const SLICE_I_EXECUTABLE_CORRECTION_KINDS = new Set(["remaining-order", "operator-takeover", "void-roll", "retry-roll-integration"]);
const SLICE_I_CORRECTION_AUDIT_DETAILS = Object.freeze(["correctionKind", "targetRequestId", "previousSessionState", "nextSessionState", "previousEncounterRevision", "encounterRevision", "reason", "stationId", "pendingCheckId", "before", "after"]);
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
const PLAN_LOCKED_SESSION_STATES = new Set(["plan-locked", "station-resolution", "round-closeout", "next-round", "event-closeout-review", "persistent-application", "completed"]);
const TRANSFER_REQUEST_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch", "targetUserId", "reason"]);
const READ_PROJECTION_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "expectedRevision"]);
const PROJECTION_FIELDS = Object.freeze([
  "schemaVersion", "sessionId", "eventId", "revision", "sessionState", "currentStage", "roundNumber", "phase",
  "stationAssignments", "committedStationOrder", "currentActingStationId", "momentum", "pressureSystems", "activeHazards",
  "visibleEvents", "closeoutStatus", "recoveryStatus"
]);
const MULTIPLAYER_PROJECTION_FIELDS = Object.freeze([
  ...PROJECTION_FIELDS,
  "projectionRole", "ownedOperators", "readOnlyStationIds", "ownedPlanningOptions",
  "sharedStationOrder", "planReady", "planLocked", "canMutateSharedOrder",
  "resolutionStarted", "resolutionOrder", "resolutionCurrentStationId", "resolutionCurrentOperator",
  "resolutionOrderPosition", "resolutionTotalStations", "resolutionStations", "resolutionComplete",
  "canExecuteCurrentStation", "currentStationOwnedByViewer", "currentExecutionState", "currentExecution",
  "hasPendingPlayerDecision", "decisionPhase", "decisionRequired", "decisionStationId", "decisionStationName",
  "decisionTargetStationId", "decisionTargetStationName", "decisionTitle", "decisionDescription", "decisionNarration",
  "decisionSourceOperatorName", "decisionCost", "decisionStatisticLabel", "decisionDc", "decisionVisibility",
  "decisionOutcomes", "decisionOptions", "canUseFocus", "canPassReaction", "rollBlockedByDecision"
]);
const MULTIPLAYER_AUTHORIZATION_FIELDS = Object.freeze(["kind", "sessionId", "stationId"]);
const TRANSFER_COORDINATOR_FIELDS = Object.freeze(["sessionId", "sessionDocumentId", "expectedRevision", "expectedAuthorityEpoch", "authenticatedUserId", "connectionId", "activeGmUserId"]);
const TRANSPORT_WITNESS_FIELDS = Object.freeze(["connectionId", "occurredAt"]);
const AUDIT_FIELDS = Object.freeze(["auditId", "kind", "sessionId", "requestId", "actorUserId", "authorityEpoch", "previousRevision", "revision", "occurredAt", "details"]);
const AUDIT_DETAILS_FIELDS = Object.freeze(["previousActiveGmUserId", "nextActiveGmUserId", "bootstrap", "reason"]);
const M12_AUDIT_DETAILS_FIELDS = Object.freeze(["transitionKind", "previousSessionState", "nextSessionState", "previousEncounterRevision", "encounterRevision", "eventCount"]);
const ROUND_CLOSEOUT_EVENT_FIELDS = Object.freeze(["type", "sessionId", "eventId", "definitionSnapshotId", "shipId", "roundId", "roundNumber", "previousRevision", "revision", "previousAuthorityEpoch", "authorityEpoch", "previousSessionState", "nextSessionState", "previousPhase", "nextPhase", "stationResultIds", "successUnits", "failureUnits", "roundResult", "momentumBefore", "momentumAfter", "pressureBefore", "pressureAfter", "pressureEffects", "breaches", "hazardEffects", "consequenceEffects", "benefitTransition", "focusTransition", "riskBidTransition", "recoveryControlTransition", "nextRoundId"]);
const ROUND_CLOSEOUT_AUDIT_DETAILS_FIELDS = Object.freeze(["roundId", "roundNumber", "runtimeEventType", "checkpointId", "stationResultIds", "successUnits", "failureUnits", "roundResult", "momentumBefore", "momentumAfter", "pressureEffectIds", "breachIds", "hazardEffectIds", "consequenceEffectIds", "benefitTransition", "focusTransition", "riskBidTransition", "recoveryControlTransition", "previousSessionState", "nextSessionState", "nextRoundId"]);
const ROUND_CLOSEOUT_PRESSURE_EFFECT_FIELDS = Object.freeze(["pressureEffectId", "encounterId", "stageId", "roundNumber", "sequence", "stationId", "actionId", "pressureSystemId", "delta", "timing", "sourceKind", "sourceIntentId", "activationSource", "branch", "visibility"]);
const ROUND_CLOSEOUT_BREACH_FIELDS = Object.freeze(["pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId", "pressureSystemId", "pressureEffectId", "sourceKind", "sourceIntentId", "activationSource", "branch", "timing", "visibility", "previousValue", "capacity", "remainingCapacity", "attemptedDelta", "overflowDelta"]);
const ROUND_CLOSEOUT_BENEFIT_FIELDS = Object.freeze(["effectId", "sourceStationId", "sourceActionId", "riskBidId", "sourceRevision", "sourceEncounterRevision", "sourceResult", "targetStationId", "targetPendingCheckId", "effectKind", "effectValue", "activationTiming", "consumptionTiming", "roundNumber", "requiresSourceBeforeTarget", "previousStatus", "persistence", "status", "consumedAtRevision"]);
const TASK5_BENEFIT_PERSISTENCE = new Set(["round-local", "next-round", "event"]);
const TASK2_COMMANDS = new Set(["station-selection", "station-selection-clear", "station-order", "plan-lock"]);
const TASK3_COMMANDS = new Set(["resolution-start", "action-segment"]);
const TASK3_RECORD_COMMANDS = new Set(["resolution-start", "action-segment", "pending-checks-prepared"]);
const TASK3_RESULT_KINDS = Object.freeze({ "resolution-start": "resolution-started", "action-segment": "action-segment-applied", "pending-checks-prepared": "pending-checks-prepared" });
const TASK3_AUDIT_KINDS = Object.freeze({ "resolution-start": "m12-resolution-start", "action-segment": "m12-action-segment", "pending-checks-prepared": "m12-pending-checks-prepared" });
const FOCUS_COMMANDS = new Set(["focus-reaction-use", "focus-reaction-pass"]);
const FOCUS_RESULT_KINDS = Object.freeze({ "focus-reaction-use": "focus-reaction-used", "focus-reaction-pass": "focus-reaction-passed" });
const FOCUS_AUDIT_KINDS = Object.freeze({ "focus-reaction-use": "m12-focus-reaction-used", "focus-reaction-pass": "m12-focus-reaction-passed" });
const FOCUS_PENDING_COMMAND_KIND = "focus-reaction-commit";
const FOCUS_PENDING_RESULT_KIND = "focus-reaction-committed";
const FOCUS_PENDING_AUDIT_KIND = "m12-focus-reaction-committed";
// Keep an uncertain result isolated to the trusted runtime context that
// executed it; a fresh world/context must never reuse another context's roll.
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
const COMMAND_KINDS = new Set(["pause", "resume", "station-selection", "station-selection-clear", "station-order", "plan-lock", "resolution-start", "action-segment", "focus-reaction-use", "focus-reaction-pass", "reaction", "round-closeout", "emergency-response", "closeout-review", "closeout-prepare", "closeout-reserve", "closeout-ship-apply", "closeout-session-commit"]);
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
function focusMetadata(state, context = {}) {
  try {
    const metadata = isPlainObject(state?.metadata) ? capture(state.metadata).value : {};
    const assignments = Array.isArray(state?.stationAssignments) ? state.stationAssignments : [];
    const pools = Array.isArray(metadata.focusPools) ? metadata.focusPools : assignments.map((assignment) => ({ operatorId: assignment.operator?.uuid ?? assignment.operator?.id ?? null, stationId: assignment.stationId, current: 1, capacity: 1 }));
    const assignmentIdentity = new Map(assignments.map((assignment) => [assignment.stationId, assignment.operator?.uuid ?? assignment.operator?.id ?? null]));
    const poolStations = new Set();
    if (pools.length !== assignmentIdentity.size || !pools.every((pool) => isPlainObject(pool) && nonBlank(pool.operatorId) && nonBlank(pool.stationId) && !poolStations.has(pool.stationId) && poolStations.add(pool.stationId) && safeInteger(pool.current) && safeInteger(pool.capacity) && pool.capacity > 0 && pool.current <= pool.capacity && assignmentIdentity.get(pool.stationId) === pool.operatorId)) return null;
    const hasTrustedAuthoring = ownData(context, "focusAbilities").ok;
    const authored = hasTrustedAuthoring ? capture(context.focusAbilities) : { ok: false, value: null };
    let abilities = hasTrustedAuthoring ? (authored.ok ? authored.value : null) : (Array.isArray(metadata.focusAbilities) ? metadata.focusAbilities : []);
    if (!Array.isArray(abilities) || !abilities.every(validFocusAbility)) return null;
    if (hasTrustedAuthoring && (!authored.ok || (Array.isArray(metadata.focusAbilities) && !equal(metadata.focusAbilities, authored.value)))) return null;
    return { metadata, pools, abilities };
  } catch { return null; }
}
function focusWindowForState(state, stationId, context = {}, targetPendingCheckId = null) {
  const source = focusMetadata(state, context); if (!source) return null;
  const opportunities = source.abilities.filter((ability) => (ability.targetStationId ?? ability.stationId) === stationId).map((ability) => {
    const pool = source.pools.find((entry) => entry.stationId === ability.stationId && entry.current > 0);
    return pool ? { reactionId: `arcflight-focus-reaction:${JSON.stringify([state.encounterId, state.revision, targetPendingCheckId, stationId, ability.focusAbilityId])}`, focusAbilityId: ability.focusAbilityId, stationId: ability.stationId, targetStationId: stationId, targetPendingCheckId, operatorId: pool.operatorId } : null;
  }).filter(Boolean);
  return opportunities.length ? { status: "open", stationId, opportunities, resolved: [] } : null;
}
function validFocusAbility(ability) {
  try {
    const authoredFields = ["focusAbilityId", "name", "description", "trigger", "timing", "cost", "stationId", "targetStationId", "eligibleSource", "targetRule", "check", "dcSource", "statisticSlugOrAbilityId", "dc", "secrecy", "outcomes", "outcomeNarration", "visibility", "narration"];
    if (!isPlainObject(ability) || !exactKeys(ability, authoredFields)) return false;
    const authoredValid = (
      exactKeys(ability.eligibleSource, ["kind", "stationId"]) && ability.eligibleSource.kind === "station" && ability.eligibleSource.stationId === ability.stationId
      && exactKeys(ability.targetRule, ["kind", "stationId"]) && ability.targetRule.kind === "current-station" && ability.targetRule.stationId === ability.targetStationId
      && exactKeys(ability.check, ["kind", "statisticSlugOrAbilityId"]) && ability.check.kind === "pf2e-check" && ability.check.statisticSlugOrAbilityId === ability.statisticSlugOrAbilityId
      && exactKeys(ability.dcSource, ["kind", "value"]) && ability.dcSource.kind === "fixed" && ability.dcSource.value === ability.dc
      && exactKeys(ability.outcomeNarration, ["criticalSuccess", "success", "failure", "criticalFailure"])
      && Object.values(ability.outcomeNarration).every(nonBlank)
      && nonBlank(ability.name) && nonBlank(ability.description)
      && ability.visibility === ability.secrecy && nonBlank(ability.narration)
    );
    return authoredValid
      && nonBlank(ability.focusAbilityId) && nonBlank(ability.trigger) && nonBlank(ability.timing) && safeInteger(ability.cost) && ability.cost === 1
      && nonBlank(ability.stationId) && nonBlank(ability.targetStationId) && nonBlank(ability.statisticSlugOrAbilityId) && safeInteger(ability.dc) && ability.dc >= 0
      && ["public", "secret"].includes(ability.secrecy) && exactKeys(ability.outcomes, ["criticalSuccess", "success", "failure", "criticalFailure"])
      && Object.values(ability.outcomes).every((value) => Number.isSafeInteger(value) && value >= -5 && value <= 5);
  } catch { return false; }
}
function focusOutcomeModifier(ability, degree) {
  if (!validFocusAbility(ability)) return null;
  return ability.outcomes[degree] ?? null;
}
function normalizeFocusDegree(value) {
  if (Number.isSafeInteger(value)) return ["criticalFailure", "failure", "success", "criticalSuccess"][value] ?? null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
  return ["criticalFailure", "failure", "success", "criticalSuccess"].includes(normalized) ? normalized : null;
}
function focusModifierForCheck(state, pendingCheckId, stationId) {
  try {
    const effects = Array.isArray(state?.metadata?.focusEffects) ? state.metadata.focusEffects : [];
    const applicable = effects.filter((effect) => effect?.targetPendingCheckId === pendingCheckId && effect?.targetStationId === stationId && Number.isSafeInteger(effect.modifier));
    const total = applicable.reduce((sum, effect) => sum + effect.modifier, 0);
    return Math.max(-5, Math.min(5, total));
  } catch { return 0; }
}
const RISK_BID_EFFECT_FIELDS = Object.freeze([
  "effectId", "sourceStationId", "sourceActionId", "riskBidId", "sourceRevision",
  "sourceEncounterRevision", "sourceResult", "targetStationId", "targetPendingCheckId",
  "effectKind", "effectValue", "activationTiming", "consumptionTiming",
  "roundNumber", "requiresSourceBeforeTarget", "status", "consumedAtRevision"
]);
function validStoredRiskBidEffects(state, session = null) {
  try {
    const effects = state?.metadata?.riskBidEffects;
    if (effects === undefined) return true;
    if (!Array.isArray(effects)) return false;
    const ids = new Set();
    const order = Array.isArray(state.committedStationOrder) ? state.committedStationOrder : [];
    const indexByStation = new Map(order.map((stationId, index) => [stationId, index]));
    return effects.every((effect) => {
      const historical = Number.isSafeInteger(effect?.roundNumber) && effect.roundNumber < state.roundNumber;
      const historicalOwners = historical
        ? (session?.events?.filter((event) => event?.type === "voyage.m12-round-closeout"
          && Array.isArray(event.benefitTransition)
          && event.benefitTransition.some((candidate) => candidate?.effectId === effect.effectId
            && RISK_BID_EFFECT_FIELDS.every((field) => candidate[field] === effect[field]))) ?? [])
        : [];
      const historicalPersistence = historical && historicalOwners.length === 1
        ? historicalOwners[0].benefitTransition.find((candidate) => candidate?.effectId === effect.effectId)?.persistence
        : null;
      const authoredPersistence = !historical ? task5AuthoredBenefitPersistence(state, effect) : historicalPersistence;
      if (historical && (historicalOwners.length !== 1 || !TASK5_BENEFIT_PERSISTENCE.has(historicalPersistence)
        || (historicalPersistence === "next-round" && state.roundNumber !== effect.roundNumber + 1)
        || historicalPersistence === "round-local")) return false;
      if (!isPlainObject(effect) || !exactKeys(effect, RISK_BID_EFFECT_FIELDS)
        || !nonBlank(effect.effectId) || ids.has(effect.effectId) || !ids.add(effect.effectId)
        || !nonBlank(effect.sourceStationId) || !nonBlank(effect.sourceActionId) || !nonBlank(effect.riskBidId)
        || !safeInteger(effect.sourceRevision) || effect.sourceRevision < 1 || effect.sourceRevision > state.revision
        || !safeInteger(effect.sourceEncounterRevision) || effect.sourceEncounterRevision < 1 || effect.sourceEncounterRevision > state.revision
        || !["success", "critical-success"].includes(effect.sourceResult)
        || !nonBlank(effect.targetStationId) || !nonBlank(effect.targetPendingCheckId)
        || !["roll-bonus", "degree-shift"].includes(effect.effectKind)
        || !safeInteger(effect.effectValue) || effect.effectValue <= 0
        || effect.activationTiming !== "next-unresolved-check" || effect.consumptionTiming !== "on-target-resolution"
        || !safeInteger(effect.roundNumber) || effect.roundNumber > state.roundNumber || effect.requiresSourceBeforeTarget !== true
        || !["active", "consumed", "blocked"].includes(effect.status)
        || (effect.consumedAtRevision !== null && (!safeInteger(effect.consumedAtRevision) || effect.consumedAtRevision < effect.sourceRevision || effect.consumedAtRevision > state.revision))
        || (effect.status === "blocked" && effect.consumedAtRevision !== null)
        || (effect.status === "consumed" && effect.consumedAtRevision === null)
        || !indexByStation.has(effect.sourceStationId) || !indexByStation.has(effect.targetStationId)) return false;
      const sourceCheck = historical ? null : state.pendingChecks.find((check) => check.stationId === effect.sourceStationId && check.status === "resolved");
      const targetCheck = historical ? null : state.pendingChecks.find((check) => check.pendingCheckId === effect.targetPendingCheckId && check.stationId === effect.targetStationId);
      const selection = state.selections?.[effect.sourceStationId];
      const bid = state.riskBids?.[effect.sourceStationId];
      const station = state.availableStations?.find((entry) => entry.stationId === effect.sourceStationId);
      const action = station?.actions?.find((entry) => entry.actionId === effect.sourceActionId);
      const presentation = action?.riskBidPresentation?.[String(bid?.dcAdjustment)];
      const authored = presentation?.mechanicalEffect?.effects?.find((entry) => entry.targetStationIds?.includes(effect.targetStationId)
        && entry.effectKind === effect.effectKind && entry.value === effect.effectValue);
      const sourceIndex = indexByStation.get(effect.sourceStationId);
      const targetIndex = indexByStation.get(effect.targetStationId);
      return historical || (authoredPersistence && sourceCheck && targetCheck && selection?.actionId === effect.sourceActionId && bid?.riskBidId === effect.riskBidId
        && sourceCheck.result?.degreeOfSuccessSlug === effect.sourceResult && authored
        && effect.sourceEncounterRevision >= sourceCheck.preparedRevision
        && (effect.status === "blocked" ? sourceIndex >= targetIndex : sourceIndex < targetIndex));
    });
  } catch { return false; }
}
function activeRiskBidEffectsForCheck(state, pendingCheckId, stationId) {
  try {
    return (state?.metadata?.riskBidEffects ?? []).filter((effect) => effect.status === "active"
      && effect.targetPendingCheckId === pendingCheckId
      && effect.targetStationId === stationId);
  } catch { return []; }
}
function riskBidModifierForCheck(state, pendingCheckId, stationId) {
  return activeRiskBidEffectsForCheck(state, pendingCheckId, stationId)
    .filter((effect) => effect.effectKind === "roll-bonus")
    .reduce((sum, effect) => sum + effect.effectValue, 0);
}
function applyRiskBidDegreeShift(result, effects) {
  try {
    const shift = effects.filter((effect) => effect.effectKind === "degree-shift").reduce((sum, effect) => sum + effect.effectValue, 0);
    if (!shift || !isPlainObject(result?.result)) return result;
    const slugs = ["critical-failure", "failure", "success", "critical-success"];
    const current = slugs.indexOf(result.result.degreeOfSuccessSlug);
    if (current < 0) return result;
    const next = Math.min(slugs.length - 1, current + shift);
      return { ...result, result: { ...result.result, degreeOfSuccess: next, degreeOfSuccessSlug: slugs[next] } };
  } catch { return result; }
}
function prepareFocusWindowForNextPending(state, context = {}) {
  try {
    const focus = focusMetadata(state, context); if (!focus) return;
    state.metadata.focusPools = focus.pools;
    state.metadata.focusAbilities = focus.abilities;
    state.metadata.focusEffects = Array.isArray(state.metadata.focusEffects) ? state.metadata.focusEffects : [];
    const order = Array.isArray(state.committedStationOrder) ? state.committedStationOrder : [];
    const pending = order.map((stationId) => state.pendingChecks?.find((check) => check.stationId === stationId && check.status === "pending")).find(Boolean);
    if (!pending) { state.metadata.reactionWindow = null; return; }
    const existing = state.metadata.reactionWindow;
    const existingTarget = existing?.opportunities?.[0]?.targetPendingCheckId ?? null;
    if (!existing || existing.status !== "open" || existing.stationId !== pending.stationId || existingTarget !== pending.pendingCheckId) state.metadata.reactionWindow = focusWindowForState(state, pending.stationId, context, pending.pendingCheckId);
  } catch { state.metadata.reactionWindow = null; }
}
function validStoredFocusResult(result, binding, focusAbility) {
  try {
    if (!isPlainObject(result) || !exactKeys(result, ["ok", "status", "pendingCheckId", "sequence", "sourceKind", "sourceUuid", "statisticSlug", "dc", "rollMode", "result", "errors", "warnings", "normalizedDegree"])) return false;
    if (!isPlainObject(binding) || !nonBlank(binding.pendingCheckId) || !nonBlank(binding.targetPendingCheckId) || !nonBlank(binding.sourceOperatorId) || !nonBlank(binding.sourceStationId) || !nonBlank(binding.targetStationId) || !nonBlank(binding.reactionId) || !nonBlank(binding.focusAbilityId)) return false;
    if (result.ok !== true || result.status !== "rolled" || result.pendingCheckId !== binding.pendingCheckId || !safeInteger(result.sequence) || result.sourceKind !== "character" || result.sourceUuid !== binding.sourceOperatorId || !nonBlank(result.statisticSlug) || !safeInteger(result.dc) || !["public", "blind"].includes(result.rollMode) || !Array.isArray(result.errors) || result.errors.length !== 0 || !Array.isArray(result.warnings) || !["criticalFailure", "failure", "success", "criticalSuccess"].includes(result.normalizedDegree)) return false;
    if (!isPlainObject(result.result) || !exactKeys(result.result, ["total", "degreeOfSuccess", "degreeOfSuccessSlug"]) || !Number.isFinite(result.result.total) || !safeInteger(result.result.degreeOfSuccess) || !["critical-failure", "failure", "success", "critical-success"].includes(result.result.degreeOfSuccessSlug)) return false;
    return !focusAbility || result.statisticSlug === focusAbility.statisticSlugOrAbilityId && result.dc === focusAbility.dc && result.rollMode === (focusAbility.secrecy === "secret" ? "blind" : "public") && result.normalizedDegree in focusAbility.outcomes;
  } catch { return false; }
}
function focusEvidenceBinding(entry, state) {
  try {
    const pending = state?.pendingChecks?.find((check) => check.pendingCheckId === entry.targetPendingCheckId);
    const ability = state?.metadata?.focusAbilities?.find((candidate) => candidate.focusAbilityId === entry.focusAbilityId);
    const assignment = state?.stationAssignments?.find((candidate) => candidate.stationId === entry.sourceStationId);
    const assignedOperatorId = assignment?.operator?.uuid ?? assignment?.operator?.id;
    return pending && ability && assignment && entry.pendingCheckId && entry.reactionId && entry.sourceStationId && entry.sourceOperatorId && entry.targetStationId
      && pending.stationId === entry.targetStationId && ability.focusAbilityId === entry.focusAbilityId && ability.stationId === entry.sourceStationId && assignedOperatorId === entry.sourceOperatorId
      ? { pendingCheckId: entry.pendingCheckId, targetPendingCheckId: entry.targetPendingCheckId, reactionId: entry.reactionId, focusAbilityId: entry.focusAbilityId, sourceStationId: entry.sourceStationId, sourceOperatorId: entry.sourceOperatorId, targetStationId: entry.targetStationId, ability }
      : null;
  } catch { return null; }
}
function validStoredFocusMetadata(state, session = null) {
  try {
    const metadata = state?.metadata; if (!isPlainObject(metadata)) return true;
    if (!validStoredRiskBidEffects(state, session)) return false;
    if (metadata.focusPendingCheck !== null && metadata.focusPendingCheck !== undefined && !validPendingFocusCheck(metadata.focusPendingCheck, { encounterState: state })) return false;
    if (metadata.focusResults !== undefined) {
      if (!Array.isArray(metadata.focusResults)) return false;
      for (const entry of metadata.focusResults) {
        if (!isPlainObject(entry) || !exactKeys(entry, ["reactionId", "pendingCheckId", "targetPendingCheckId", "focusAbilityId", "sourceStationId", "sourceOperatorId", "targetStationId", "modifier", "result"])) return false;
        if (!Number.isSafeInteger(entry.modifier) || entry.modifier < -5 || entry.modifier > 5) return false;
        const binding = focusEvidenceBinding(entry, state); if (!binding || !validFocusAbility(binding.ability) || entry.modifier !== focusOutcomeModifier(binding.ability, entry.result?.normalizedDegree)) return false;
        const result = entry.result;
        if (!validStoredFocusResult(result, binding, binding.ability)) return false;
      }
    }
    if (metadata.focusEffects !== undefined) {
      if (!Array.isArray(metadata.focusEffects)) return false;
      for (const entry of metadata.focusEffects) {
        if (!isPlainObject(entry) || !exactKeys(entry, ["reactionId", "pendingCheckId", "focusAbilityId", "sourceStationId", "sourceOperatorId", "targetStationId", "targetPendingCheckId", "modifier", "result"])) return false;
        if (!Number.isSafeInteger(entry.modifier) || entry.modifier < -5 || entry.modifier > 5) return false;
        const binding = focusEvidenceBinding(entry, state); if (!binding || !validFocusAbility(binding.ability) || entry.modifier !== focusOutcomeModifier(binding.ability, entry.result?.normalizedDegree) || !validStoredFocusResult(entry.result, binding, binding.ability)) return false;
      }
    }
    return true;
  } catch { return false; }
}
function validFocusResult(result, pending) {
  try {
    const captured = capture(result); if (!captured.ok || !isPlainObject(captured.value)) return false;
    const value = captured.value, normalized = value.result;
    return value.ok === true && value.status === "rolled" && value.pendingCheckId === pending.pendingCheckId && value.sequence === pending.sequence
      && value.sourceKind === "character" && value.sourceUuid === pending.source.uuid && value.statisticSlug === pending.statisticSlugOrAbilityId && value.dc === pending.finalDc
      && ["public", "blind"].includes(value.rollMode) && isPlainObject(normalized) && Number.isSafeInteger(normalized.total)
      && (typeof normalized.degreeOfSuccessSlug === "string" || typeof normalized.degreeOfSuccess === "string" || Number.isSafeInteger(normalized.degreeOfSuccess));
  } catch { return false; }
}
function validDurableFocusReceipt(result, pending) {
  try {
    const binding = {
      pendingCheckId: pending.pendingCheckId,
      targetPendingCheckId: pending.targetPendingCheckId,
      reactionId: pending.reactionId,
      focusAbilityId: pending.focusAbilityId,
      sourceStationId: pending.sourceStationId,
      sourceOperatorId: pending.source.uuid,
      targetStationId: pending.targetStationId
    };
    return validStoredFocusResult(result, binding, null)
      && result.statisticSlug === pending.statisticSlugOrAbilityId
      && result.dc === pending.finalDc
      && result.rollMode === (pending.secrecy === "secret" ? "blind" : "public")
      && ["criticalFailure", "failure", "success", "criticalSuccess"].includes(result.normalizedDegree);
  } catch { return false; }
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
  if (commandKind === "round-closeout") {
    const state = session.encounterState;
    const metadata = state?.metadata;
    const unresolvedReaction = metadata?.reactionWindow?.status === "open" && Array.isArray(metadata.reactionWindow.opportunities) && metadata.reactionWindow.opportunities.some((entry) => !(metadata.reactionWindow.resolved ?? []).includes(entry?.reactionId));
    const pendingFocus = metadata?.focusPendingCheck !== null && metadata?.focusPendingCheck !== undefined;
    const unresolvedRecovery = session.recovery?.status !== "none" || metadata?.recoveryControl?.status === "required";
    const unresolvedRetryStatuses = new Set(["pending", "executing", "failed", "uncertain", "recovery-required", "invalid", "erroneous", "voidable"]);
    const pendingRetry = Array.isArray(metadata?.sliceIRecovery) && metadata.sliceIRecovery.some((entry) => entry?.kind === "retry-roll-integration" && (
      !nonBlank(entry.replacementPendingCheckId)
      || state.pendingChecks?.some((check) => check?.pendingCheckId === entry.replacementPendingCheckId && check.status !== "resolved")
      || unresolvedRetryStatuses.has(entry.integrationStatus ?? entry.evidence?.integrationStatus ?? "")
    ));
    return session.sessionState === "station-resolution" && state?.lifecycleState === "active" && state?.phase === "resolution"
      && session.closeout.status === "none" && Array.isArray(state.pendingThresholdQueue) && state.pendingThresholdQueue.length === 0
      && !unresolvedReaction && !pendingFocus && !unresolvedRecovery && !pendingRetry;
  }
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
function task5DefinitionRound(definition, roundNumber) {
  try {
    const rounds = Array.isArray(definition?.rounds) ? definition.rounds : null;
    return rounds?.find((round) => round?.roundNumber === roundNumber) ?? rounds?.[roundNumber - 1] ?? null;
  } catch { return null; }
}
function task5AuthoredBenefitPersistence(state, effect) {
  try {
    const station = state?.availableStations?.find((entry) => entry?.stationId === effect?.sourceStationId);
    const action = station?.actions?.find((entry) => entry?.actionId === effect?.sourceActionId);
    const bid = state?.riskBids?.[effect?.sourceStationId];
    const presentation = action?.riskBidPresentation?.[String(bid?.dcAdjustment)];
    const authoredEffects = presentation?.mechanicalEffect?.effects;
    if (!Array.isArray(authoredEffects)) return null;
    const matches = authoredEffects.filter((candidate) => Array.isArray(candidate?.targetStationIds)
      && candidate.targetStationIds.includes(effect.targetStationId)
      && candidate.effectKind === effect.effectKind
      && candidate.value === effect.effectValue
      && candidate.activationTiming === effect.activationTiming
      && candidate.consumptionTiming === effect.consumptionTiming
      && candidate.requiresSourceBeforeTarget === effect.requiresSourceBeforeTarget);
    if (matches.length !== 1) return null;
    const persistence = Object.prototype.hasOwnProperty.call(matches[0], "persistence") ? matches[0].persistence : "round-local";
    return TASK5_BENEFIT_PERSISTENCE.has(persistence) ? persistence : null;
  } catch { return null; }
}
function task5BenefitTransitionEvidence(state, effect) {
  try {
    if (!isPlainObject(effect) || !exactKeys(effect, RISK_BID_EFFECT_FIELDS)
      || !["active", "consumed", "blocked"].includes(effect.status)) return null;
    const persistence = task5AuthoredBenefitPersistence(state, effect);
    if (!persistence) return null;
    const evidence = {};
    for (const field of ROUND_CLOSEOUT_BENEFIT_FIELDS) evidence[field] = field === "previousStatus" ? effect.status : field === "persistence" ? persistence : effect[field];
    const captured = capture(evidence);
    return captured.ok && exactKeys(captured.value, ROUND_CLOSEOUT_BENEFIT_FIELDS) ? captured.value : null;
  } catch { return null; }
}
function task5BenefitTransitionEvidenceList(state, effects) {
  try {
    if (!Array.isArray(effects)) return null;
    const result = [];
    for (const effect of effects) {
      const evidence = task5BenefitTransitionEvidence(state, effect);
      if (!evidence) return null;
      result.push(evidence);
    }
    return result;
  } catch { return null; }
}
function task5CarryoverRiskBidEffects(state, effects) {
  try {
    if (!Array.isArray(effects)) return null;
    const result = [];
    for (const effect of effects) {
      const evidence = task5BenefitTransitionEvidence(state, effect);
      if (!evidence) return null;
      if (evidence.persistence === "next-round" || evidence.persistence === "event") result.push(capture(effect).value);
    }
    return result;
  } catch { return null; }
}function task5StationResultEvidence(state, events, roundNumber, roundId) {
  try {
    if (!isPlainObject(state) || !Array.isArray(events) || !Array.isArray(state.committedStationOrder)) return null;
    const startIndex = events.findIndex((entry) => entry?.type === "voyage.resolution-started" && entry.encounterId === state.encounterId && entry.roundNumber === roundNumber);
    const preparedIndex = events.findIndex((entry, index) => index > startIndex && entry?.type === "voyage.pending-checks-prepared" && entry.encounterId === state.encounterId && entry.roundNumber === roundNumber);
    if (startIndex < 0 || preparedIndex < 0) return null;
    const nextRoundStart = events.findIndex((entry, index) => index > preparedIndex && entry?.type === "voyage.resolution-started" && entry.roundNumber !== roundNumber);
    const endIndex = nextRoundStart < 0 ? events.length : nextRoundStart;
    const results = events.slice(preparedIndex + 1, endIndex).filter((entry) => entry?.type === "voyage.pending-check-resolved" && entry.roundNumber === roundNumber);
    if (results.length === 0 || results.some((entry) => !isPlainObject(entry) || entry.encounterId !== state.encounterId || entry.lifecycleState !== "active" || entry.phase !== "resolution" || !nonBlank(entry.pendingCheckId) || !nonBlank(entry.stationId) || !nonBlank(entry.actionId) || !safeInteger(entry.sequence) || !safeInteger(entry.previousRevision) || !safeInteger(entry.revision) || entry.revision !== entry.previousRevision + 1 || typeof entry.allChecksResolved !== "boolean" || !safeInteger(entry.remainingCheckCount) || entry.remainingCheckCount < 0 || !safeInteger(entry.resolvedCheckCount) || entry.resolvedCheckCount < 1)) return null;
    const expected = new Map();
    for (const stationId of state.committedStationOrder) {
      const selection = state.selections?.[stationId];
      const pending = (state.pendingChecks ?? []).find((entry) => entry?.stationId === stationId && entry?.status === "resolved");
      if (!selection?.actionId || !pending) continue;
      if (expected.has(stationId)) return null;
      expected.set(stationId, { pendingCheckId: pending.pendingCheckId, actionId: selection.actionId, sequence: pending.sequence });
    }
    if (expected.size !== state.committedStationOrder.length || expected.size !== results.length) return null;
    const ids = [];
    for (const result of results) {
      if (expected.has(result.stationId) === false || ids.includes(result.pendingCheckId)) return null;
      const binding = expected.get(result.stationId);
      if (binding.pendingCheckId !== result.pendingCheckId || binding.actionId !== result.actionId || binding.sequence !== result.sequence) return null;
      ids.push(result.pendingCheckId);
    }
    if (new Set(ids).size !== ids.length) return null;
    const finalResult = results[results.length - 1];
    if (finalResult.allChecksResolved !== true || finalResult.remainingCheckCount !== 0 || finalResult.resolvedCheckCount !== state.committedStationOrder.length) return null;
    return { ids, results };
  } catch { return null; }
}function task5RoundAnalysis(state, roundId, sourceEvents = []) {
  try {
    const aggregate = analyzeVoyageEncounterRoundUnitAggregation(state);
    const classification = analyzeVoyageEncounterRoundResult(state);
    if (!aggregate?.readyForAggregation || !classification?.readyForRoundResult) return null;
    const evidence = task5StationResultEvidence(state, sourceEvents, state.roundNumber, roundId);
    if (!evidence) return null;
    return { stationResultIds: evidence.ids, successUnits: classification.successUnits, failureUnits: classification.failureUnits, roundResult: classification.roundResult, results: evidence.results };
  } catch { return null; }
}
function task5PressureEffectFromIntent(intent, state) {
  try {
    if (intent?.intentType !== "pressure-change" || !isPlainObject(intent.payload)) return null;
    const pressureSystemId = intent.target?.kind === "pressure-system" ? intent.target.targetId : intent.payload.pressureSystemId;
    if (!VOYAGE_PRESSURE_SYSTEM_IDS.includes(pressureSystemId) || !safeInteger(intent.payload.delta) || intent.payload.delta === 0) return null;
    return {
      pressureEffectId: `arcflight-pressure-effect:${JSON.stringify([state.encounterId, intent.stageId, state.roundNumber, intent.sequence, "outcome-intent", intent.intentId])}`,
      encounterId: state.encounterId, stageId: intent.stageId, roundNumber: state.roundNumber, sequence: intent.sequence,
      stationId: intent.stationId, actionId: intent.actionId, pressureSystemId, delta: intent.payload.delta,
      timing: intent.timing, sourceKind: "outcome-intent", sourceIntentId: intent.intentId,
      activationSource: intent.activationSource, branch: intent.branch, visibility: intent.visibility
    };
  } catch { return null; }
}
function task5StandardPressureEffect(action, state) {
  const delta = action?.branch === "failure" ? 1 : action?.branch === "critical-failure" ? 2 : 0;
  if (!delta) return null;
  const pressureSystemId = { captain: "crew-morale", engineer: "arkengine", navigator: "navigation", watchmaster: "hull-integrity", veilwarden: "veil-stability" }[action.stationId];
  if (!pressureSystemId) return null;
  return {
    pressureEffectId: `arcflight-pressure-effect:${JSON.stringify([state.encounterId, state.currentStage?.stageId, state.roundNumber, action.sequence, "standard-result"])}`,
    encounterId: state.encounterId, stageId: state.currentStage?.stageId, roundNumber: state.roundNumber, sequence: action.sequence,
    stationId: action.stationId, actionId: action.actionId, pressureSystemId, delta, timing: "consequences", sourceKind: "standard-result",
    sourceIntentId: null, activationSource: null, branch: action.branch, visibility: "public"
  };
}
function task5RoundEffects(state, sourceEvents = [], session = null, roundId = null, roundAnalysis = null) {
  try {
    const definitions = analyzeVoyageEncounterActionOutcomeDefinitions(state);
    if (!definitions?.definitionsValid) return null;
    const pressurePlan = analyzeVoyageEncounterPressurePlan(state);
    if (!pressurePlan?.readyForPressurePlanning || !Array.isArray(pressurePlan.effects)) return null;
    const priorPressureIds = new Set((Array.isArray(sourceEvents) ? sourceEvents : []).flatMap((entry) => [
      ...(Array.isArray(entry?.pressureEffects) ? entry.pressureEffects : []),
      ...(Array.isArray(entry?.effects) ? entry.effects : [])
    ]).map((entry) => entry?.pressureEffectId).filter(nonBlank));
    const pressureEffects = capture(pressurePlan.effects.filter((effect) => !priorPressureIds.has(effect?.pressureEffectId)));
    if (!pressureEffects.ok) return null;
    const consequenceEffects = [];
    for (const stationId of state.committedStationOrder ?? []) {
      const selection = state.selections?.[stationId]; if (!selection?.actionId) continue;
      const station = (state.availableStations ?? []).find((entry) => entry?.stationId === stationId);
      const action = station?.actions?.find((entry) => entry?.actionId === selection.actionId);
      const definition = definitions.actions?.find((entry) => entry?.stationId === stationId && entry?.actionId === selection.actionId);
      if (!action || !definition) return null;
      const pending = (state.pendingChecks ?? []).find((entry) => entry.stationId === stationId && entry.status === "resolved");
      const branch = pending ? pending.result?.degreeOfSuccessSlug : "no-roll";
      const refs = [...(definition.branches?.[branch] ?? [])];
      const bid = state.riskBids?.[stationId];
      const bidOption = bid?.riskBidId ? definition.riskBidOptions?.find((entry) => entry?.riskBidId === bid.riskBidId) : null;
      if (bidOption) refs.push(...(bidOption.outcomes?.[branch === "critical-success" ? "criticalSuccess" : branch] ?? []));
      for (const effectId of refs) {
        const rule = definition.effectRules?.find((entry) => entry?.effectId === effectId); if (!rule) return null;
        const capturedRule = capture(rule); if (!capturedRule.ok) return null;
        if (rule.intentType !== "pressure-change") consequenceEffects.push(capturedRule.value);
      }
    }
    pressureEffects.value.sort((a, b) => a.sequence - b.sequence || a.pressureEffectId.localeCompare(b.pressureEffectId));
    const sourceSystems = Array.isArray(state.pressureSystems) ? state.pressureSystems : Object.values(state.pressureSystems ?? {});
    const nextSystems = Object.fromEntries(sourceSystems.map((entry) => [entry.pressureSystemId, { ...entry }]));
    const initialActiveHazards = capture(state.activeHazards ?? []).value;
    let nextActiveHazards = capture(initialActiveHazards).value;
    const generatedHazards = [];
    let encounterRevision = state.revision;
    const breaches = [], hazardEffects = [];
    for (const effect of pressureEffects.value) {
      const system = nextSystems[effect.pressureSystemId]; if (!system) return null;
      const proposed = system.value + effect.delta;
      if (effect.delta > 0 && proposed > system.capacity) {
        const transaction = analyzeVoyagePressureBreachCloseoutTransaction({
          expectedEncounterRevision: encounterRevision,
          closeoutContext: { eventId: state.encounterId, sessionId: session?.sessionId ?? state.encounterId, stageId: state.currentStage?.stageId ?? state.currentStage, roundNumber: state.roundNumber, phase: "cleanup-advance" },
          pressureSystems: Object.values(nextSystems), activeHazards: nextActiveHazards, pressureEffect: { ...effect, sourceKind: "hazard-closeout", timing: "gm-confirmed", activationSource: "event-closeout", branch: "no-roll", stationId: null, actionId: null, sourceIntentId: effect.sourceIntentId ?? effect.pressureEffectId }
        });
        if (!transaction?.ok || !transaction.breachRequired) return null;
        Object.assign(nextSystems, Object.fromEntries(transaction.nextPressureSystems.map((entry) => [entry.pressureSystemId, entry])));
        nextActiveHazards = capture(transaction.nextActiveHazards).value;
        if (transaction.hazard) generatedHazards.push(transaction.hazard);
        breaches.push(transaction.breach); if (transaction.hazard) hazardEffects.push(transaction.hazard); encounterRevision = transaction.encounterRevision;
      } else system.value = Math.max(0, proposed);
    }

    if (nextActiveHazards.length > 0) {
      const eventId = session?.eventId ?? state.encounterId;
      const sessionId = session?.sessionId ?? state.encounterId;
      const definitionSnapshotId = session?.definitionSnapshotId;
      const shipId = session?.shipId;
      const stageId = state.currentStage?.stageId ?? state.currentStage;
      if (![eventId, sessionId, definitionSnapshotId, shipId, stageId].every(nonBlank)) return null;
      const rounds = new Map();
      for (const source of Array.isArray(sourceEvents) ? sourceEvents : []) {
        if (source?.type === "voyage.m12-round-closeout" && safeInteger(source.roundNumber) && nonBlank(source.roundId) && ["critical-round-success", "round-success", "round-failure", "round-neutral", "critical-round-failure"].includes(source.roundResult)) {
          rounds.set(source.roundNumber, { roundId: source.roundId, roundNumber: source.roundNumber, roundResult: source.roundResult });
        }
      }
      if (!nonBlank(roundId) || !roundAnalysis?.roundResult) return null;
      rounds.set(state.roundNumber, { roundId, roundNumber: state.roundNumber, roundResult: roundAnalysis.roundResult });
      const completedRounds = [];
      for (let number = 1; number <= state.roundNumber; number += 1) {
        const round = rounds.get(number); if (!round) return null;
        completedRounds.push(round);
      }
      const snapshot = {
        schemaVersion: 1, eventId, sessionId, definitionSnapshotId, shipId,
        encounterRevision, shipRevision: state.metadata?.shipRevision ?? 0, lifecycleState: "active", stageId,
        roundNumber: state.roundNumber, phase: "cleanup-advance",
        completedRoundHistory: { schemaVersion: 1, eventId, sessionId, definitionSnapshotId, roundCount: completedRounds.length, rounds: completedRounds },
        momentum: state.momentum,
        focusPools: capture(state.metadata?.focusPools ?? []).value,
        pressureSystems: Object.values(nextSystems),
        activeHazards: initialActiveHazards,
        pendingStationBenefitIds: [], unconsumedRiskBidBenefitIds: [], temporaryFocusPenaltyIds: [],
        roundOrderRestrictions: [], hazardSuppressions: [], temporaryConsequenceIds: []
      };
      const hazardCloseout = analyzeVoyageEncounterHazardCloseout({
        kind: "m10-hazard-closeout", sessionId, expectedEncounterRevision: encounterRevision, closeoutSnapshot: snapshot
      });
      if (!hazardCloseout?.ok) return null;
      const hazardPressureEffects = [];
      for (const result of hazardCloseout.hazardCloseoutResults ?? []) {
        if (result.pressureEffect && !priorPressureIds.has(result.pressureEffect.pressureEffectId) && !pressureEffects.value.some((entry) => entry.pressureEffectId === result.pressureEffect.pressureEffectId)) hazardPressureEffects.push(result.pressureEffect);
      }
      pressureEffects.value.push(...hazardPressureEffects);
      for (const result of hazardCloseout.pressureBreachResults ?? []) {
        if (result.breachRequired && result.breach) breaches.push(result.breach);
        if (result.breachRequired && result.hazard) hazardEffects.push(result.hazard);
      }
      const finalSystems = capture(hazardCloseout.postHazardPressureSystems);
      if (!finalSystems.ok) return null;
      Object.assign(nextSystems, Object.fromEntries(finalSystems.value.map((entry) => [entry.pressureSystemId, entry])));
      nextActiveHazards = [...generatedHazards];
      for (const result of hazardCloseout.pressureBreachResults ?? []) if (result.breachRequired && result.hazard) nextActiveHazards.push(result.hazard);
      encounterRevision += (hazardCloseout.hazardCloseoutResults?.length ?? 0) + (hazardCloseout.pressureBreachResults ?? []).filter((entry) => entry.breachRequired).length;
    }
    pressureEffects.value.sort((a, b) => a.sequence - b.sequence || a.pressureEffectId.localeCompare(b.pressureEffectId));
    return { pressureEffects: pressureEffects.value, breaches, hazardEffects, consequenceEffects, pressureAfter: nextSystems, activeHazardsAfter: nextActiveHazards, encounterRevision };
  } catch { return null; }
}function validRoundCloseoutNestedEvidence(event) {
  try {
    if (![event.pressureEffects, event.breaches, event.hazardEffects, event.consequenceEffects, event.benefitTransition].every(Array.isArray)) return false;
    const pressureIds = new Set();
    for (let index = 0; index < event.pressureEffects.length; index += 1) {
      const effect = event.pressureEffects[index];
      if (!isPlainObject(effect) || !exactKeys(effect, ROUND_CLOSEOUT_PRESSURE_EFFECT_FIELDS) || !nonBlank(effect.pressureEffectId) || pressureIds.has(effect.pressureEffectId)
        || effect.encounterId !== event.eventId || effect.roundNumber !== event.roundNumber || effect.sequence < 0 || !safeInteger(effect.sequence) || !safeInteger(effect.delta)
        || !nonBlank(effect.stageId) || (effect.stationId !== null && !nonBlank(effect.stationId)) || (effect.actionId !== null && !nonBlank(effect.actionId)) || !VOYAGE_PRESSURE_SYSTEM_IDS.includes(effect.pressureSystemId)
        || !["standard-result", "outcome-intent", "hazard-closeout"].includes(effect.sourceKind) || !["consequences", "gm-confirmed"].includes(effect.timing)
        || (effect.sourceKind === "hazard-closeout" ? effect.activationSource !== "event-closeout" || effect.branch !== "no-roll" || !nonBlank(effect.sourceIntentId) || effect.stationId !== null || effect.actionId !== null
          : effect.sourceKind === "standard-result" ? effect.sourceIntentId !== null || effect.activationSource !== null || !["failure", "critical-failure"].includes(effect.branch)
            : !nonBlank(effect.sourceIntentId) || !nonBlank(effect.activationSource))
        || !["public", "gm", "secret"].includes(effect.visibility)) return false;
      pressureIds.add(effect.pressureEffectId);
    }
    const breachIds = new Set();
    for (const breach of event.breaches) {
      if (!isPlainObject(breach) || !exactKeys(breach, ROUND_CLOSEOUT_BREACH_FIELDS) || !nonBlank(breach.pressureBreachId) || breachIds.has(breach.pressureBreachId)
        || breach.encounterId !== event.eventId || breach.roundNumber !== event.roundNumber || !safeInteger(breach.effectIndex) || !safeInteger(breach.sequence)
        || !nonBlank(breach.stageId) || (breach.stationId !== null && !nonBlank(breach.stationId)) || (breach.actionId !== null && !nonBlank(breach.actionId)) || !VOYAGE_PRESSURE_SYSTEM_IDS.includes(breach.pressureSystemId)
        || breach.sourceKind !== "hazard-closeout" || !nonBlank(breach.sourceIntentId) || breach.activationSource !== "event-closeout" || breach.branch !== "no-roll" || breach.timing !== "gm-confirmed"
        || !["public", "gm", "secret"].includes(breach.visibility) || !pressureIds.has(breach.pressureEffectId) || !safeInteger(breach.previousValue) || !safeInteger(breach.capacity) || !safeInteger(breach.remainingCapacity)
        || !safeInteger(breach.attemptedDelta) || !safeInteger(breach.overflowDelta)) return false;
      breachIds.add(breach.pressureBreachId);
    }
    for (const hazard of event.hazardEffects) if (!isPlainObject(hazard) || !exactKeys(hazard, VOYAGE_HAZARD_RECORD_FIELDS) || !validateVoyageHazardRecord(hazard, { mode: "snapshot", expectedEncounterId: event.eventId }).valid) return false;
    const consequenceIds = new Set();
    for (const effect of event.consequenceEffects) if (!isPlainObject(effect) || !exactKeys(effect, ["effectId", "intentType", "timing", "visibility", "target", "payload"]) || !nonBlank(effect.effectId) || consequenceIds.has(effect.effectId) || !capture(effect.target).ok || !capture(effect.payload).ok) return false; else consequenceIds.add(effect.effectId);
    for (const benefit of event.benefitTransition) if (!isPlainObject(benefit) || !exactKeys(benefit, ["effectId", "sourceStationId", "sourceActionId", "riskBidId", "sourceRevision", "sourceEncounterRevision", "sourceResult", "targetStationId", "targetPendingCheckId", "effectKind", "effectValue", "activationTiming", "consumptionTiming", "roundNumber", "requiresSourceBeforeTarget", "previousStatus", "persistence", "status", "consumedAtRevision"]) || !nonBlank(benefit.effectId) || !nonBlank(benefit.sourceStationId) || !nonBlank(benefit.sourceActionId) || !nonBlank(benefit.riskBidId) || !safeInteger(benefit.sourceRevision) || !safeInteger(benefit.sourceEncounterRevision) || !["success", "critical-success"].includes(benefit.sourceResult) || !nonBlank(benefit.targetStationId) || !nonBlank(benefit.targetPendingCheckId) || !["roll-bonus", "degree-shift"].includes(benefit.effectKind) || !safeInteger(benefit.effectValue) || benefit.effectValue <= 0 || benefit.activationTiming !== "next-unresolved-check" || benefit.consumptionTiming !== "on-target-resolution" || benefit.roundNumber !== event.roundNumber || benefit.requiresSourceBeforeTarget !== true || !["active", "consumed", "blocked"].includes(benefit.status) || !["round-local", "next-round", "event"].includes(benefit.persistence) || ![null, "active", "consumed", "blocked"].includes(benefit.previousStatus) || (benefit.status === "consumed" ? !safeInteger(benefit.consumedAtRevision) : benefit.consumedAtRevision !== null)) return false;
    const validTransition = (value) => value === null || (isPlainObject(value) && exactKeys(value, ["previous", "next"]) && capture(value.previous).ok && capture(value.next).ok);
    return validTransition(event.focusTransition) && validTransition(event.riskBidTransition) && validTransition(event.recoveryControlTransition);
  } catch { return false; }
}
function validRoundCloseoutDerivedEvidence(event, checkpoint, session = null) {
  try {
    const transition = applyVoyageEncounterConsequencesTransition(checkpoint.encounterState, { phaseStartSnapshotId: `arcflight-voyage-task5-validation:${JSON.stringify([checkpoint.sessionId, checkpoint.revision])}` });
    if (!transition?.ok) return false;
    const sourceEvents = session?.events?.slice(0, checkpoint.eventCount) ?? [];
    const analysis = task5RoundAnalysis(transition.nextState, event.roundId, sourceEvents);
    const effects = task5RoundEffects(transition.nextState, sourceEvents, session, event.roundId, analysis);
    const historicalNext = effects ? effects.pressureAfter : null;
    const checkpointRiskEffects = Array.isArray(checkpoint.encounterState?.metadata?.riskBidEffects)
      ? checkpoint.encounterState.metadata.riskBidEffects.filter((effect) => effect?.roundNumber === event.roundNumber)
      : [];
    const expectedBenefits = task5BenefitTransitionEvidenceList(checkpoint.encounterState, checkpointRiskEffects);
    if (!expectedBenefits) return false;
    const continuing = event.nextSessionState === "crew-planning";
    const expectedFocusTransition = continuing ? { previous: capture(checkpoint.encounterState.metadata?.focusEffects ?? []).value, next: [] } : null;
    const expectedRiskBidNext = continuing && Array.isArray(checkpoint.encounterState.metadata?.riskBidEffects)
      ? task5CarryoverRiskBidEffects(checkpoint.encounterState, checkpoint.encounterState.metadata.riskBidEffects)
      : null;
    if (continuing && !expectedRiskBidNext) return false;
    const expectedRiskBidTransition = continuing ? { previous: capture(checkpoint.encounterState.metadata?.riskBidEffects ?? []).value, next: capture(expectedRiskBidNext ?? []).value } : null;
    const expectedRecoveryControlTransition = continuing ? { previous: capture(checkpoint.encounterState.metadata?.recoveryControl ?? null).value, next: null } : null;

    const latestOnly = !session || event.revision === session.revision;
    return Boolean(analysis && effects) && event.roundNumber === checkpoint.encounterState.roundNumber && analysis.successUnits === event.successUnits && analysis.failureUnits === event.failureUnits && analysis.roundResult === event.roundResult
      && equal(analysis.stationResultIds, event.stationResultIds) && equal(event.pressureBefore, checkpoint.encounterState.pressureSystems) && event.momentumBefore === checkpoint.encounterState.momentum
      && equal(event.pressureEffects, effects.pressureEffects) && equal(event.breaches, effects.breaches) && equal(event.hazardEffects, effects.hazardEffects)
      && equal(event.consequenceEffects, effects.consequenceEffects) && equal(event.benefitTransition, expectedBenefits) && equal(event.focusTransition, expectedFocusTransition)
      && equal(event.riskBidTransition, expectedRiskBidTransition) && equal(event.recoveryControlTransition, expectedRecoveryControlTransition) && equal(event.pressureAfter, historicalNext)
      && (!session || (!latestOnly || (event.momentumAfter === session.encounterState.momentum && equal(event.pressureAfter, session.encounterState.pressureSystems) && equal(checkpoint.encounterState.currentStage, session.encounterState.currentStage) && equal(checkpoint.encounterState.tracks, session.encounterState.tracks))));
  } catch { return false; }
}
function validRoundCloseoutEvent(event, session) {
  try {
    const checks = {
      keys: exactKeys(event, ROUND_CLOSEOUT_EVENT_FIELDS),
      type: event.type === "voyage.m12-round-closeout",
      id: event.sessionId === session.sessionId && event.eventId === session.eventId && event.definitionSnapshotId === session.definitionSnapshotId && event.shipId === session.shipId,
      round: nonBlank(event.roundId) && safeInteger(event.roundNumber) && event.roundNumber > 0,
      rev: safeInteger(event.previousRevision) && safeInteger(event.revision) && event.revision === event.previousRevision + 1 && event.revision <= session.revision,
      epoch: safeInteger(event.previousAuthorityEpoch) && safeInteger(event.authorityEpoch) && event.previousAuthorityEpoch === event.authorityEpoch && event.authorityEpoch <= session.authorityEpoch,
      state: event.previousSessionState === "station-resolution" && ["crew-planning", "event-closeout-review"].includes(event.nextSessionState) && event.previousPhase === "resolution",
      phase: (event.nextSessionState === "crew-planning" ? event.nextPhase === "crew-planning" && nonBlank(event.nextRoundId) : event.nextPhase === "cleanup-advance" && event.nextRoundId === null),
      ids: Array.isArray(event.stationResultIds) && event.stationResultIds.length > 0 && event.stationResultIds.every(nonBlank) && new Set(event.stationResultIds).size === event.stationResultIds.length,
      units: safeInteger(event.successUnits) && event.successUnits >= 0 && safeInteger(event.failureUnits) && event.failureUnits >= 0,
      result: ["critical-round-success", "round-success", "round-failure", "critical-round-failure", "round-neutral"].includes(event.roundResult),
      momentum: safeInteger(event.momentumBefore) && event.momentumBefore >= 0 && event.momentumBefore <= 3 && safeInteger(event.momentumAfter) && event.momentumAfter >= 0 && event.momentumAfter <= 3,
      momentumTransition: event.roundResult === "round-neutral" ? event.momentumAfter === event.momentumBefore : event.momentumAfter === (event.roundResult.includes("success") ? Math.min(3, event.momentumBefore + 1) : Math.max(0, event.momentumBefore - 1)),
      pressure: validPressureSystemsMap(event.pressureBefore) && validPressureSystemsMap(event.pressureAfter),
      nested: validRoundCloseoutNestedEvidence(event)
    };

    return Object.values(checks).every(Boolean);
  } catch { return false; }
}function validRoundCloseoutRecord(record, session, audit, event) {
  try {
    const tuple = parseStoredFingerprint(record?.fingerprint);
    const response = record?.response;
    const details = audit?.details;
    const expectedPressureEffectIds = Array.isArray(event?.pressureEffects) ? event.pressureEffects.map((entry) => entry.pressureEffectId) : null;
    const expectedBreachIds = Array.isArray(event?.breaches) ? event.breaches.map((entry) => entry.pressureBreachId) : null;
    const expectedHazardEffectIds = Array.isArray(event?.hazardEffects) ? event.hazardEffects.map((entry) => entry.hazardId) : null;
    const expectedConsequenceEffectIds = Array.isArray(event?.consequenceEffects) ? event.consequenceEffects.map((entry) => entry.effectId) : null;
    return exactKeys(record, PROCESSED_REQUEST_FIELDS) && record.commandKind === "round-closeout" && record.resultKind === "round-closeout-completed" && record.projectionKind === "gm"
      && safeInteger(record.resultRevision) && record.resultRevision > 0 && tuple.ok && tuple.value[0] === session.sessionId && tuple.value[1] === record.principalUserId && tuple.value[2] === "gm"
      && safeInteger(tuple.value[3]) && tuple.value[3] === event.authorityEpoch && safeInteger(tuple.value[4]) && tuple.value[4] === event.previousRevision
      && tuple.value[5] === "round-closeout" && exactKeys(tuple.value[6], ["roundId"]) && tuple.value[6].roundId === event.roundId
      && validStoredResponse(response, record, session.sessionId, event.authorityEpoch) && response.status === event.nextSessionState && response.revision === event.revision && response.authorityEpoch === event.authorityEpoch
      && response.events.length === 1 && equal(response.events[0], event)
      && validRoundCloseoutEvent(event, session) && event.revision === record.resultRevision
      && exactKeys(audit, AUDIT_FIELDS) && audit.kind === "round-closeout" && audit.sessionId === session.sessionId && audit.requestId === record.requestId
      && audit.actorUserId === record.principalUserId && safeInteger(audit.authorityEpoch) && audit.authorityEpoch === event.authorityEpoch
      && audit.previousRevision === event.previousRevision && audit.revision === event.revision && validIsoTimestamp(audit.occurredAt)
      && exactKeys(details, ROUND_CLOSEOUT_AUDIT_DETAILS_FIELDS) && details.roundId === event.roundId && details.roundNumber === event.roundNumber
      && details.runtimeEventType === event.type && details.checkpointId === `arcflight-voyage-checkpoint:${JSON.stringify([session.sessionId, "before-round-closeout", event.previousRevision])}`
      && equal(details.stationResultIds, event.stationResultIds) && details.successUnits === event.successUnits && details.failureUnits === event.failureUnits && details.roundResult === event.roundResult
      && details.momentumBefore === event.momentumBefore && details.momentumAfter === event.momentumAfter
      && equal(details.pressureEffectIds, expectedPressureEffectIds) && equal(details.breachIds, expectedBreachIds)
      && equal(details.hazardEffectIds, expectedHazardEffectIds) && equal(details.consequenceEffectIds, expectedConsequenceEffectIds)
      && equal(details.benefitTransition, event.benefitTransition) && equal(details.focusTransition, event.focusTransition)
      && equal(details.riskBidTransition, event.riskBidTransition) && equal(details.recoveryControlTransition, event.recoveryControlTransition)
      && details.previousSessionState === event.previousSessionState && details.nextSessionState === event.nextSessionState && details.nextRoundId === event.nextRoundId;
  } catch { return false; }
}
function validRuntimeEvent(event, session, index) {
  if (!isPlainObject(event) || !nonBlank(event.sessionId) || event.sessionId !== session.sessionId || event.eventId !== session.eventId
    || event.definitionSnapshotId !== session.definitionSnapshotId || event.shipId !== session.shipId || !safeInteger(event.previousRevision) || !safeInteger(event.revision)
    || event.revision !== event.previousRevision + 1 || event.revision > session.revision) return false;
  if (event?.type === "voyage.m12-round-closeout") return validRoundCloseoutEvent(event, session);
  if (isM12RuntimeEvent(event)) return validM12RuntimeEvent(event, session);
  if (["voyage.m11-recovery-rebuilt", "voyage.m11-closeout-review-accepted", "voyage.m11-closeout-session-reserved", "voyage.m11-closeout-session-commit-pending", "voyage.m11-closeout-session-committed"].includes(event.type) && !exactKeys(event, M11_EVENT_FIELDS)) return false;
  if (event.type === "voyage.m11-recovery-rebuilt") return nonBlank(event.sourceCheckpointId) && safeInteger(event.sourceCheckpointRevision) && nonBlank(event.recoveryAuthorityUserId);
  if (event.type === "voyage.m11-recovery-aborted") return exactKeys(event, RECOVERY_ABORT_EVENT_FIELDS) && nonBlank(event.sourceCheckpointId) && safeInteger(event.sourceCheckpointRevision) && nonBlank(event.recoveryAuthorityUserId) && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision) && event.encounterRevision === event.previousEncounterRevision + 1;
  if (event.type === "voyage.m11-session-aborted") return exactKeys(event, ABORT_EVENT_FIELDS) && ["setup-cancellation", "active-event"].includes(event.abortScope) && nonBlank(event.abortAuthorityUserId) && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision) && event.encounterRevision === event.previousEncounterRevision + 1;
  if (event.type === "voyage.m11-session-corrected") return exactKeys(event, CORRECTION_EVENT_FIELDS) && ["station-selection", "station-order", "plan-unlock", ...SLICE_I_CORRECTION_KINDS].includes(event.correctionKind) && event.targetRequestId === null && nonBlank(event.correctionAuthorityUserId) && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision) && event.encounterRevision === event.previousEncounterRevision + 1;
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
       || !validEncounterState(session.encounterState, session) || !validStoredFocusMetadata(session.encounterState, session) || !lifecycleMappingValid(session) || !Array.isArray(session.events) || !Array.isArray(session.checkpoints)
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
    if (events.some((event, index) => !(typeof event?.type === "string" && event.type.startsWith("voyage.m11-")) && !isM12RuntimeEvent(event) && !isTask7DomainEvent(events, index) && !(isTask3DomainEvent(event) && isM12RuntimeEvent(events[index + 1])))) {
      const latestCheckpoint = session.checkpoints.at(-1);
        if (!latestCheckpoint || !replayRecoveryEvidence(session, latestCheckpoint, replayContext)) return false;
    }
    if (session.processedRequests.length < 1 || !validCreationRecord(session.processedRequests[0], session, session.processedRequests[0]?.principalUserId)) return false;
    const requestIds = new Set([session.processedRequests[0].requestId]);
    let owner = session.processedRequests[0].principalUserId, expectedAuthorityEpoch = 0, transferCount = 0, recoveryCount = 0, bootstrapRecoveryCount = 0, lastRecoveryRevision = 0, latestRecoveryEvidence = null;
    for (let index = 1; index < session.processedRequests.length; index += 1) {
      const record = session.processedRequests[index]; if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || requestIds.has(record.requestId)) return false;

      const audit = session.auditHistory.find((entry) => entry?.requestId === record.requestId && (record.commandKind === TRANSFER_COMMAND_KIND ? entry.kind.startsWith("control-transfer") : record.commandKind === RECOVERY_COMMAND_KIND ? ["recovery-rebuilt", "recovery-aborted"].includes(entry.kind) : record.commandKind === "m12-launch" ? entry.kind === "m12-launch" : TASK2_COMMANDS.has(record.commandKind) ? entry.kind === TASK2_AUDIT_KINDS[record.commandKind] : TASK3_RECORD_COMMANDS.has(record.commandKind) ? entry.kind === TASK3_AUDIT_KINDS[record.commandKind] : record.commandKind === FOCUS_PENDING_COMMAND_KIND ? entry.kind === FOCUS_PENDING_AUDIT_KIND : FOCUS_COMMANDS.has(record.commandKind) ? entry.kind === FOCUS_AUDIT_KINDS[record.commandKind] : record.commandKind === "round-closeout" ? entry.kind === "round-closeout" : record.commandKind === "closeout-review" ? entry.kind === "closeout-review-accepted" : record.commandKind === "closeout-reserve" ? entry.kind === "closeout-session-reserved" : record.commandKind === "closeout-session-commit" ? ["closeout-session-commit-pending", "closeout-session-committed"].includes(entry.kind) : record.commandKind === "abort-session" ? ["setup-cancelled", "event-aborted"].includes(entry.kind) : record.commandKind === "correct-session" ? entry.kind === "correction-applied" : false));
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
      } else if (record.commandKind === "round-closeout") {
        const event = session.events.find((entry) => entry?.type === "voyage.m12-round-closeout" && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const audit = session.auditHistory.find((entry) => entry?.requestId === record.requestId && entry.kind === "round-closeout");
        const checkpoint = event && session.checkpoints.find((entry) => entry?.kind === "before-round-closeout" && entry.revision === event.previousRevision && entry.eventCount === session.events.indexOf(event));
        if (!event || !audit || !checkpoint || !validCheckpoint(checkpoint, session, session.events, session.checkpoints.indexOf(checkpoint)) || !validRoundCloseoutDerivedEvidence(event, checkpoint, session) || !validRoundCloseoutRecord(record, session, audit, event)) return false;
      } else if (record.commandKind === "closeout-prepare") {
        if (!validCloseoutRecord(record, session, null, null)) return false;
      } else if (record.commandKind === "closeout-ship-apply") {
        if (!validCloseoutRecord(record, session, null, null)) return false;
      } else if (record.commandKind === FOCUS_PENDING_COMMAND_KIND) {
        const event = session.events.find((entry) => entry?.type === "voyage.m12-focus-reaction-committed" && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        if (!audit || !event || !validFocusPendingRecord(record, session, audit, event)) return false;
      } else if (FOCUS_COMMANDS.has(record.commandKind)) {
        const event = session.events.find((entry) => entry?.type === `voyage.m12-${record.commandKind}` && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        if (!audit || !event || !validFocusRecord(record, session, audit, event)) return false;
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
      } else if (TASK3_RECORD_COMMANDS.has(record.commandKind)) {
        const runtimeEvent = session.events.find((entry) => entry?.type === `voyage.m12-${record.commandKind}` && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const eventIndex = runtimeEvent ? session.events.indexOf(runtimeEvent) : -1;
        const domainEvent = eventIndex > 0 ? session.events[eventIndex - 1] : null;
        const tuple = parseStoredFingerprint(record.fingerprint);
        const task3Valid = validM12Task3Record(record, session, audit, domainEvent, runtimeEvent);
        if (!audit || !runtimeEvent || !domainEvent || (record.commandKind !== "action-segment" && !FOCUS_COMMANDS.has(record.commandKind) && record.commandKind !== FOCUS_PENDING_COMMAND_KIND && record.principalUserId !== owner) || !tuple.ok || tuple.value[3] !== expectedAuthorityEpoch || record.resultRevision <= 0 || !task3Valid) return false;
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
    const m12AuditCount = session.auditHistory.filter((entry) => entry?.kind === "m12-launch" || Object.values(TASK2_AUDIT_KINDS).includes(entry?.kind) || Object.values(TASK3_AUDIT_KINDS).includes(entry?.kind) || Object.values(FOCUS_AUDIT_KINDS).includes(entry?.kind) || entry?.kind === FOCUS_PENDING_AUDIT_KIND || entry?.kind === "round-closeout").length;
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
function coordinatorDescriptor(value, documentIdValue, authorityContext, context = {}) {
  const executingUserId = context?.__trustedRemotePlayerIntent === true
    ? (nonBlank(context.executingGmUserId) ? context.executingGmUserId : authorityContext.activeGmUserId)
    : authorityContext.authenticatedUserId;
  const descriptor = {
    sessionId: value.sessionId,
    sessionDocumentId: documentIdValue,
    expectedRevision: value.expectedRevision,
    expectedAuthorityEpoch: value.authorityEpoch,
    authenticatedUserId: executingUserId,
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
function coordinatorIdentityMatches(auth, descriptor, context = {}) {
  const expectedUserId = context?.__trustedRemotePlayerIntent === true ? auth.activeGmUserId : auth.authenticatedUserId;
  return descriptor.authenticatedUserId === expectedUserId
    && auth.authenticatedConnectionId === descriptor.connectionId
    && auth.activeGmUserId === descriptor.activeGmUserId;
}
function canonicalOperators(value) {
  const captured = capture(value);
  if (!captured.ok || captured.value === null) return null;
  const source = Array.isArray(captured.value) ? captured.value : [captured.value];
  if (source.length === 0) return [];
  const operators = [];
  const seen = new Set();
  for (const entry of source) {
    const operator = canonicalOperator(entry);
    if (!operator) return null;
    const key = `${operator.kind}\0${operator.uuid ?? operator.id}`;
    if (seen.has(key)) return null;
    seen.add(key);
    operators.push(operator);
  }
  return operators;
}
function operatorIdentityMatches(left, right) {
  if (!left || !right || left.kind !== right.kind) return false;
  if (Object.hasOwn(left, "uuid") && Object.hasOwn(right, "uuid")) return left.uuid === right.uuid;
  return Object.hasOwn(left, "id") && Object.hasOwn(right, "id") && left.id === right.id;
}
function deriveProjectionAuthority(authenticated, session, context) {
  const assignments = session?.encounterState?.stationAssignments;
  const report = analyzeVoyageStationAssignments(assignments);
  if (!report.valid) return { role: "observer", ownedOperators: [], readOnlyStationIds: [] };
  if (authenticated.user?.isGM === true) {
    const currentSessionGm = authenticated.authenticatedUserId === session?.activeGmUserId;
    return {
      role: "gm",
      ownedOperators: report.assignments.map((entry) => ({
        stationId: entry.stationId,
        operatorId: entry.operator?.id ?? null,
        operatorUuid: entry.operator?.uuid ?? null,
        canAct: currentSessionGm,
        gmTakeover: currentSessionGm
      })),
      readOnlyStationIds: []
    };
  }
  let resolvedOperators = null;
  try {
    if (typeof context?.resolveVoyageOperatorForPrincipal === "function") {
      resolvedOperators = canonicalOperators(context.resolveVoyageOperatorForPrincipal(authenticated.authenticatedUserId));
    }
  } catch {
    resolvedOperators = null;
  }
  const ownedOperators = [];
  if (Array.isArray(resolvedOperators)) {
    for (const entry of report.assignments) {
      if (resolvedOperators.some((operator) => operatorIdentityMatches(operator, entry.operator))) {
        ownedOperators.push({
          stationId: entry.stationId,
          operatorId: entry.operator?.id ?? null,
          operatorUuid: entry.operator?.uuid ?? null,
          canAct: true,
          gmTakeover: false
        });
      }
    }
  }
  return {
    role: ownedOperators.length > 0 ? "operator" : (Array.isArray(resolvedOperators) && resolvedOperators.length > 0 ? "crew" : "observer"),
    ownedOperators,
    readOnlyStationIds: report.assignments.filter((entry) => !ownedOperators.some((owned) => owned.stationId === entry.stationId)).map((entry) => entry.stationId)
  };
}
function deriveProjectionKind(authenticated, session, context) {
  return deriveProjectionAuthority(authenticated, session, context).role;
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
    const canonicalMatch = equal(reread, candidate) || (typeof options.acceptedReread === "function" && options.acceptedReread(reread));
    if (canonicalMatch && pristineSession(reread, documentIdValue, { replayContext: context })) {
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
async function dispatchRoundCloseoutCommand(value, identities, initialAuth, initialMatch, context) {
  const descriptor = coordinatorDescriptor(value, initialMatch.documentId, initialAuth, context);
  if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  return runExclusiveSessionMutation(context, descriptor, async (trustedWitness) => withTransferLock(value.sessionId, async () => {
    const auth = authority(context, { requireConnection: true });
    if (auth.error || !coordinatorIdentityMatches(auth, descriptor, context)) return failure([auth.error ?? diagnostic("m11-active-gm-required", "transport.connection")], identities);
    const resolved = resolveSessionDocument(value.sessionId, context);
    if (resolved.error) return failure([resolved.error], identities);
    if (resolved.match.documentId !== descriptor.sessionDocumentId || !pristineSession(resolved.match.session, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const prior = resolved.match.session;
    const fp = fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload);
    const replay = replayOrConflict(prior.processedRequests, value.requestId, auth.authenticatedUserId, "gm", fp, identities);
    if (replay) return replay;
    if (prior.activeGmUserId !== auth.activeGmUserId || value.authorityEpoch !== prior.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.expectedRevision !== prior.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    if (!closeoutLifecycleAllowed(prior, "round-closeout")) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
    const built = await buildTask5Candidate(prior, value, auth, trustedWitness, context);
    if (!built?.candidate || !built.response) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
    const candidate = built.candidate, response = built.response;
    if (!pristineSession(candidate, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    try { await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); }
    catch { return sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, value.requestId, context, { successResponse: response }); }
    return sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, value.requestId, context, { successResponse: response });
  }), identities, { nonWinnerCode: "m11-control-transfer-required", nonWinnerPath: "authorityEpoch" });
}async function dispatchCloseoutCommand(value, identities, auth, match, context, coordinated = false, trustedWitness = null) {
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

function canonicalTask3SourceBoundStations(session, canonicalStations) {
  try {
    if (!isPlainObject(session) || !Array.isArray(canonicalStations)) return null;
    const assignments = Array.isArray(session.encounterState?.stationAssignments) ? session.encounterState.stationAssignments : [];
    const captured = capture(canonicalStations); if (!captured.ok) return null;
    const result = captured.value.map((station) => {
      const assignment = assignments.find((entry) => entry?.stationId === station?.stationId);
      const operatorUuid = assignment?.operator?.uuid;
      const actions = Array.isArray(station?.actions) ? station.actions.map((action) => {
        const copy = capture(action); if (!copy.ok) return null;
        if (isPlainObject(copy.value?.check) && isPlainObject(copy.value.check.source)) {
          copy.value.check.source = operatorUuid ? { kind: "character", uuid: operatorUuid } : { kind: "character" };
        }
        return copy.value;
      }) : null;
      if (!actions || actions.some((action) => action === null)) return null;
      return { ...station, actions };
    });
    return result.every((station) => station !== null) ? result : null;
  } catch { return null; }
}function bareTask2Stations(stations) {
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
    if (commandKind === "plan-lock") {
      const proposed = Array.isArray(prior.encounterState.proposedStationOrder) ? prior.encounterState.proposedStationOrder : [];
      if (proposed.length > 0) return applyVoyageEncounterCrewPlanningLock(prior.encounterState, payload);
      const fallback = Array.isArray(prior.encounterState.stationAssignments)
        ? prior.encounterState.stationAssignments.map((entry) => entry?.stationId)
        : [];
      if (fallback.length === 0 || fallback.some((stationId) => typeof stationId !== "string" || stationId.length === 0) || new Set(fallback).size !== fallback.length) return null;
      const effective = capture(prior.encounterState); if (!effective.ok) return null;
      effective.value.proposedStationOrder = fallback;
      return applyVoyageEncounterCrewPlanningLock(effective.value, payload);
    }
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
    const auth = trustedAuthorityContext(context);
    if (auth.error || auth.authenticatedUserId !== descriptor.authenticatedUserId || auth.authenticatedConnectionId !== descriptor.connectionId || auth.activeGmUserId !== descriptor.activeGmUserId) {
      return failure([auth.error ?? diagnostic("m11-active-gm-required", "transport.connection")], identities);
    }
    const resolved = resolveSessionDocument(value.sessionId, context);
    if (resolved.error) return failure([resolved.error], identities);
    if (resolved.match.documentId !== descriptor.sessionDocumentId || !pristineSession(resolved.match.session, descriptor.sessionDocumentId, { replayContext: context })) {
      return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    }
    const prior = resolved.match.session;
    const authorityDecision = deriveProjectionAuthority(auth, prior, context);
    const projectionKind = auth.user?.isGM === true ? "gm" : authorityDecision.role;
    if (auth.user?.isGM !== true) {
      const authorizedOrder = value.commandKind === "station-order"
        ? authorityDecision.ownedOperators.length > 0
        : authorityDecision.ownedOperators.some((entry) => entry.stationId === value.payload.stationId);
      if (!operatorAllowedCommand(value.commandKind) || projectionKind !== "operator" || !authorizedOrder) {
        return failure([diagnostic("m11-projection-not-authorized", value.commandKind === "station-order" ? "request.payload.stationOrder" : "request.payload.stationId")], identities);
      }
    }
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
function collectionUnchanged(before, after) {
  try {
    const beforeIds = before.map((entry) => documentId(entry).value);
    const afterIds = after.map((entry) => documentId(entry).value);
    return beforeIds.length === afterIds.length && beforeIds.every((id) => nonBlank(id) && afterIds.includes(id)) && afterIds.every((id) => beforeIds.includes(id));
  } catch { return false; }
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
    const afterIds = after.documents.map((entry) => documentId(entry).value);
    return beforeIds.every((beforeId) => nonBlank(beforeId) && afterIds.includes(beforeId));
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
}function recoveryInvalidationValid(checkpoint, envelope) {
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
    const identity = { sessionId: envelope.sessionId, eventId: envelope.eventId, definitionSnapshotId: envelope.definitionSnapshotId, shipId: envelope.shipId, revision: envelope.revision, authorityEpoch: envelope.authorityEpoch };
    let previousChainRevision = 0; const runtimeRevisions = new Set();
    for (let eventIndex = 0; eventIndex < envelope.events.length; eventIndex += 1) {
      const event = envelope.events[eventIndex];
      if (event?.type?.startsWith('voyage.m11-') || isM12RuntimeEvent(event)) {
        if (runtimeRevisions.has(event.revision)) return false;
        if (!validRuntimeEvent(event, identity, eventIndex) || (event.previousRevision !== previousChainRevision && !(event.previousRevision + 1 === previousChainRevision && event.revision === previousChainRevision))) return false;
        runtimeRevisions.add(event.revision);
        previousChainRevision = Math.max(previousChainRevision, event.revision);
      } else {
        const pair = storedEventRevisionPair(event);
        const nextType = envelope.events[eventIndex + 1]?.type;
        const task7Domain = isTask7RuntimeType(nextType);
        const task3Domain = isTask3DomainEvent(event) && isM12RuntimeEvent(envelope.events[eventIndex + 1]);
        if (!isPlainObject(event) || !safeInteger(pair[1]) || !safeInteger(pair[0]) || (!task7Domain && !task3Domain && pair[0] !== previousChainRevision) || pair[1] !== pair[0] + 1
          || (task3Domain && (!validTask3DomainEvent(event, identity) || event.revision !== envelope.events[eventIndex + 1]?.previousEncounterRevision + 1 || envelope.events[eventIndex + 1]?.previousRevision !== previousChainRevision || envelope.events[eventIndex + 1]?.revision !== previousChainRevision + 1))) return false;        if (!task7Domain && !task3Domain) previousChainRevision = pair[1];
      }
    }
    for (const checkpoint of envelope.checkpoints) {
      if (!recoveryCheckpointValid(checkpoint, envelope)) return false;
      if (ids.has(checkpoint.checkpointId) || checkpoint.revision <= previousRevision || checkpoint.authorityEpoch < previousAuthorityEpoch || checkpoint.eventCount < previousEventCount
        || (previousRevision >= 0 && checkpoint.revision !== previousRevision + 1
          && !Array.from({ length: checkpoint.revision - previousRevision - 1 }, (_, offset) => previousRevision + offset + 1)
            .every((revision) => envelope.events.some((event) => {
              const pair = isM12RuntimeEvent(event) ? [event.previousRevision, event.revision] : storedEventRevisionPair(event);
              return safeInteger(pair[1]) && pair[1] === revision;
            })))
        || !recoveryInvalidationValid(checkpoint, envelope)) return false;
      for (let index = 0; index < checkpoint.eventCount; index += 1) {
        const event = envelope.events[index];
        const pair = isM12RuntimeEvent(event) ? [event.previousRevision, event.revision] : storedEventRevisionPair(event);
        const prefixRevision = isTask3DomainEvent(event) && isM12RuntimeEvent(envelope.events[index + 1]) ? envelope.events[index + 1].revision : pair[1];
        if (!event || !capture(event).ok || !safeInteger(pair?.[0]) || !safeInteger(pair?.[1]) || !safeInteger(prefixRevision) || prefixRevision > checkpoint.revision) return false;
      }
      ids.add(checkpoint.checkpointId); previousRevision = checkpoint.revision; previousAuthorityEpoch = checkpoint.authorityEpoch; previousEventCount = checkpoint.eventCount;
    }
    return previousChainRevision === envelope.revision;
  } catch { return false; }
}async function buildTask5Candidate(prior, value, auth, trustedWitness, context) {
  try {
    if (prior.sessionState !== "station-resolution" || prior.encounterState.lifecycleState !== "active" || prior.encounterState.phase !== "resolution" || !Array.isArray(prior.encounterState.pendingThresholdQueue) || prior.encounterState.pendingThresholdQueue.length !== 0) return null;
    const consequences = applyVoyageEncounterConsequencesTransition(prior.encounterState, { phaseStartSnapshotId: `arcflight-voyage-task5:${JSON.stringify([prior.sessionId, prior.encounterState.revision + 1])}` });
    if (!consequences?.ok) return null;
    const definitionResult = typeof context?.resolveEventDefinitionSnapshot === "function" ? await context.resolveEventDefinitionSnapshot(prior.eventId, prior.definitionSnapshotId) : null;
    const definition = capture(definitionResult); if (!definition.ok) return null;
    const round = task5DefinitionRound(definition.value, prior.encounterState.roundNumber);
    if (!round || round.roundId !== value.payload.roundId) return null;
    const analysis = task5RoundAnalysis(consequences.nextState, round.roundId, prior.events);
    if (!analysis) return null;
    const effects = task5RoundEffects(consequences.nextState, prior.events, prior, round.roundId, analysis); if (!effects) return null;
    let nextState = capture(consequences.nextState).value;
    nextState.pressureSystems = capture(effects.pressureAfter).value;
    nextState.activeHazards = capture(effects.activeHazardsAfter ?? nextState.activeHazards ?? []).value;
    nextState.revision = effects.encounterRevision;
    const nextRound = task5DefinitionRound(definition.value, prior.encounterState.roundNumber + 1);
    let nextSessionState = "event-closeout-review", nextPhase = "cleanup-advance", nextRoundId = null;
    if (nextRound) {
      nextRoundId = nextRound.roundId;
      nextState.title = nextRound.title;
      nextState.description = nextRound.vignette ?? nextRound.description ?? nextRound.situation;
      nextState.currentSituation = nextRound.situation;
      nextState.objective = nextRound.objective;
      nextState.availableStations = capture(nextRound.availableStations).value;
      nextState.roundNumber = nextRound.roundNumber;
      nextState.phase = "situation";
      nextState.selections = {}; nextState.targets = {}; nextState.riskBids = {}; nextState.assistance = []; nextState.reservations = []; nextState.pendingChecks = [];
      nextState.pendingConsequences = []; nextState.temporaryConsequences = []; nextState.proposedStationOrder = []; nextState.committedStationOrder = [];
      nextState.metadata.reactionWindow = null; nextState.metadata.focusEffects = []; nextState.metadata.riskBidEffects = Array.isArray(prior.encounterState.metadata?.riskBidEffects) ? task5CarryoverRiskBidEffects(prior.encounterState, prior.encounterState.metadata.riskBidEffects) : []; if (!nextState.metadata.riskBidEffects) return null; nextState.metadata.recoveryControl = null;
      const planning = applyVoyageEncounterCrewPlanningTransition(nextState, { phaseStartSnapshotId: `arcflight-voyage-task5-planning:${JSON.stringify([prior.sessionId, prior.revision + 1])}` });
      if (!planning?.ok) return null;
      nextState = planning.nextState; nextSessionState = "crew-planning"; nextPhase = "crew-planning";
    } else { nextState.phase = "cleanup-advance"; nextState.revision += 1; }
    nextState.lifecycleState = "active";
    const candidate = capture(prior); if (!candidate.ok) return null;
    const next = candidate.value, previousRevision = prior.revision, revision = previousRevision + 1;
    next.revision = revision; next.sessionState = nextSessionState; next.encounterState = nextState;
     const priorRiskEffects = Array.isArray(prior.encounterState.metadata?.riskBidEffects) ? prior.encounterState.metadata.riskBidEffects.filter((effect) => effect?.roundNumber === prior.encounterState.roundNumber) : [];
     const benefitTransition = task5BenefitTransitionEvidenceList(prior.encounterState, priorRiskEffects);
     if (!benefitTransition) return null;
     const event = { type: "voyage.m12-round-closeout", sessionId: next.sessionId, eventId: next.eventId, definitionSnapshotId: next.definitionSnapshotId, shipId: next.shipId, roundId: round.roundId, roundNumber: prior.encounterState.roundNumber, previousRevision, revision, previousAuthorityEpoch: prior.authorityEpoch, authorityEpoch: prior.authorityEpoch, previousSessionState: prior.sessionState, nextSessionState, previousPhase: prior.encounterState.phase, nextPhase, stationResultIds: analysis.stationResultIds, successUnits: analysis.successUnits, failureUnits: analysis.failureUnits, roundResult: analysis.roundResult, momentumBefore: prior.encounterState.momentum, momentumAfter: analysis.roundResult === "round-neutral" ? prior.encounterState.momentum : analysis.roundResult.includes("success") ? Math.min(3, prior.encounterState.momentum + 1) : Math.max(0, prior.encounterState.momentum - 1), pressureBefore: capture(prior.encounterState.pressureSystems).value, pressureAfter: capture(effects.pressureAfter).value, pressureEffects: capture(effects.pressureEffects).value, breaches: capture(effects.breaches).value, hazardEffects: capture(effects.hazardEffects).value, consequenceEffects: capture(effects.consequenceEffects).value, benefitTransition, focusTransition: nextRound ? { previous: capture(prior.encounterState.metadata?.focusEffects ?? []).value, next: [] } : null, riskBidTransition: nextRound ? { previous: capture(prior.encounterState.metadata?.riskBidEffects ?? []).value, next: capture(nextState.metadata?.riskBidEffects ?? []).value } : null, recoveryControlTransition: nextRound ? { previous: capture(prior.encounterState.metadata?.recoveryControl ?? null).value, next: null } : null, nextRoundId };
     next.encounterState.momentum = event.momentumAfter;
     const checkpoint = { checkpointId: `arcflight-voyage-checkpoint:${JSON.stringify([next.sessionId, "before-round-closeout", previousRevision])}`, kind: "before-round-closeout", sessionId: next.sessionId, revision: previousRevision, encounterRevision: prior.encounterState.revision, eventCount: prior.events.length, sessionState: prior.sessionState, encounterState: capture(prior.encounterState).value, closeout: capture(prior.closeout).value, authorityEpoch: prior.authorityEpoch, invalidated: false };
     if (!trustedWitness?.occurredAt) return null;
     const audit = { auditId: auditId(next.sessionId, next.auditHistory.length, "round-closeout"), kind: "round-closeout", sessionId: next.sessionId, requestId: value.requestId, actorUserId: auth.authenticatedUserId, authorityEpoch: next.authorityEpoch, previousRevision, revision, occurredAt: trustedWitness.occurredAt, details: { roundId: event.roundId, roundNumber: event.roundNumber, runtimeEventType: event.type, checkpointId: checkpoint.checkpointId, stationResultIds: capture(event.stationResultIds).value, successUnits: event.successUnits, failureUnits: event.failureUnits, roundResult: event.roundResult, momentumBefore: event.momentumBefore, momentumAfter: event.momentumAfter, pressureEffectIds: event.pressureEffects.map((entry) => entry.pressureEffectId), breachIds: event.breaches.map((entry) => entry.pressureBreachId), hazardEffectIds: event.hazardEffects.map((entry) => entry.hazardId), consequenceEffectIds: event.consequenceEffects.map((entry) => entry.effectId), benefitTransition: capture(event.benefitTransition).value, focusTransition: event.focusTransition, riskBidTransition: event.riskBidTransition, recoveryControlTransition: event.recoveryControlTransition, previousSessionState: event.previousSessionState, nextSessionState, nextRoundId } };
     next.checkpoints.push(checkpoint); next.events.push(event); next.auditHistory.push(audit);
     const response = closeoutResponse(next, value.requestId, event);
     next.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind: "gm", fingerprint: fingerprint(next.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, "round-closeout", value.payload), commandKind: "round-closeout", resultKind: "round-closeout-completed", resultRevision: revision, response });
     return { candidate: next, response };
   } catch { return null; }
 }
function replayEventChain(envelope, context, startIndex = 0, startRevision = 0, checkpoint = null) {
  try {
    const identity = { sessionId: envelope.sessionId, eventId: envelope.eventId, definitionSnapshotId: envelope.definitionSnapshotId, shipId: envelope.shipId, revision: envelope.revision, authorityEpoch: envelope.authorityEpoch };
    let priorRevision = startRevision, index = startIndex, replayedState = checkpoint ? { sessionState: checkpoint.sessionState, encounterState: capture(checkpoint.encounterState).value, closeout: capture(checkpoint.closeout).value } : null; const runtimeRevisions = new Set();
    while (index < envelope.events.length) {
      const event = envelope.events[index];
      if (isTask3DomainEvent(event) && isM12RuntimeEvent(envelope.events[index + 1])) {
        const runtime = envelope.events[index + 1];
        if (!validTask3DomainEvent(event, identity) || !validM12RuntimeEvent(runtime, identity)
          || event.revision !== runtime.previousEncounterRevision + 1
          || runtime.previousRevision !== priorRevision || runtime.revision !== priorRevision + 1) return null;
        priorRevision = runtime.revision;
        index += 2;
        continue;
      }
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
      const task3Segment = isTask3DomainEvent(envelope.events[index]?.type) && envelope.events[index]?.type !== undefined;
      const task7OnlyDomainSegment = task7Segment && segment.length === 1;
      const task3OnlyDomainSegment = task3Segment && segment.every((entry) => isTask3DomainEvent(entry));
      for (const ownedEvent of segment) {
        const pair = storedEventRevisionPair(ownedEvent);
        if (!isPlainObject(ownedEvent) || !safeInteger(pair[0]) || !safeInteger(pair[1])
           || (!task7Segment && pair[0] !== segmentRevision) || pair[1] !== pair[0] + 1
           || (task3OnlyDomainSegment && !validTask3DomainEvent(ownedEvent, identity))) return null;
        segmentRevision = pair[1];
      }
      if (task7OnlyDomainSegment || task3OnlyDomainSegment) {
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
    const identity = { sessionId: envelope.sessionId, eventId: envelope.eventId, definitionSnapshotId: envelope.definitionSnapshotId, shipId: envelope.shipId, revision: envelope.revision, authorityEpoch: envelope.authorityEpoch };
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
      if (sessionEvidence && (FOCUS_COMMANDS.has(record.commandKind) || record.commandKind === FOCUS_PENDING_COMMAND_KIND)) {
        lastEvidenceRevision = record.resultRevision;
        auditIndex += 1;
        ids.add(record.requestId);
        continue;
      }
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
      } else if (sessionEvidence && TASK3_RECORD_COMMANDS.has(record.commandKind)) {
        const runtimeEvent = envelope.events.find((entry) => entry?.type === `voyage.m12-${record.commandKind}` && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const eventIndex = runtimeEvent ? envelope.events.indexOf(runtimeEvent) : -1;
        const domainEvent = eventIndex > 0 ? envelope.events[eventIndex - 1] : null;
        const audit = envelope.auditHistory[auditIndex];
        const task3Valid = runtimeEvent && domainEvent && audit && validM12Task3Record(record, sessionEvidence, audit, domainEvent, runtimeEvent);
        if (!task3Valid) return false;
        lastEvidenceRevision = record.resultRevision; auditIndex += 1;
      } else if (sessionEvidence && record.commandKind === FOCUS_PENDING_COMMAND_KIND) {
        const event = envelope.events.find((entry) => entry?.type === "voyage.m12-focus-reaction-committed" && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const audit = envelope.auditHistory[auditIndex];
        if (!event || !audit || !validFocusPendingRecord(record, sessionEvidence, audit, event)) return false;
        lastEvidenceRevision = record.resultRevision; auditIndex += 1;
      } else if (sessionEvidence && FOCUS_COMMANDS.has(record.commandKind)) {
        const event = envelope.events.find((entry) => entry?.type === `voyage.m12-${record.commandKind}` && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const audit = envelope.auditHistory[auditIndex];
        if (!event || !audit || !validFocusRecord(record, sessionEvidence, audit, event)) return false;
        lastEvidenceRevision = record.resultRevision; auditIndex += 1;
      } else if (sessionEvidence && record.commandKind === "correct-session") {
        const event = envelope.events.find((entry) => entry?.type === "voyage.m11-session-corrected" && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const audit = envelope.auditHistory[auditIndex];
        const tuple = parseStoredFingerprint(record.fingerprint);
        const sliceI = tuple.ok && SLICE_I_CORRECTION_KINDS.includes(tuple.value[6]?.correctionKind);
        const expectedEvents = sliceI ? 1 : (tuple.ok && tuple.value[6]?.correctionKind === "plan-unlock" ? 1 : 2);
        if (!event || !audit || !validTask7Record(record, sessionEvidence, audit, event) || record.response.events.length !== expectedEvents || !equal(record.response.events.at(-1), event)) return false;
        lastEvidenceRevision = record.resultRevision; auditIndex += 1;
      } else if (sessionEvidence && record.commandKind === "round-closeout") {
        const event = envelope.events.find((entry) => entry?.type === "voyage.m12-round-closeout" && entry.revision === record.resultRevision && entry.previousRevision === record.resultRevision - 1);
        const audit = envelope.auditHistory[auditIndex];
        const checkpoint = event && envelope.checkpoints.find((entry) => entry?.kind === "before-round-closeout" && entry.revision === event.previousRevision && entry.eventCount === envelope.events.indexOf(event));
        if (!event || !audit || !checkpoint || !validRoundCloseoutRecord(record, sessionEvidence, audit, event) || !validRoundCloseoutDerivedEvidence(event, checkpoint, sessionEvidence)) return false;
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
        const correctionTuple = record.commandKind === "correct-session" ? parseStoredFingerprint(record.fingerprint) : null;
        const planUnlock = correctionTuple?.ok === true && correctionTuple.value[6]?.correctionKind === "plan-unlock";
        if (!responseEvent || !audit || !validTask7Record(record, sessionEvidence, audit, responseEvent) || record.response.events.length !== (planUnlock ? 1 : 2) || !equal(record.response.events[planUnlock ? 0 : 1], responseEvent)) return false;
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
function validPlanUnlockPredecessor(session, runtimeEvent) {
  try {
    const predecessor = session.events.find((event) => event?.revision === runtimeEvent.previousRevision);
    return predecessor
      && validM12RuntimeEvent(predecessor, session)
      && predecessor.type === "voyage.m12-plan-lock"
      && predecessor.transitionKind === "plan-lock"
      && predecessor.previousSessionState === "crew-planning"
      && predecessor.nextSessionState === "plan-locked"
      && runtimeEvent.previousEncounterRevision === predecessor.encounterRevision
      && runtimeEvent.encounterRevision === predecessor.encounterRevision + 1;
  } catch { return false; }
}

function sliceICurrentStation(session) {
  try {
    const order = session?.encounterState?.committedStationOrder;
    const checks = session?.encounterState?.pendingChecks;
    if (!Array.isArray(order) || !Array.isArray(checks)) return null;
    const voided = new Set((session?.encounterState?.metadata?.sliceIRecovery ?? [])
      .filter((entry) => entry?.kind === "void-roll")
      .flatMap((entry) => [entry.originalPendingCheckId, entry.replacementPendingCheckId].filter(nonBlank)));
    const voidedStation = order.find((stationId) => checks.some((check) => check?.stationId === stationId && voided.has(check.pendingCheckId)));
    if (voidedStation) return voidedStation;
    return order.find((stationId) => checks.some((check) => check?.stationId === stationId && check.status === "pending" && !voided.has(check.pendingCheckId))) ?? null;
  } catch { return null; }
}
function sliceIVoidedPendingCheck(session, pendingCheckId) {
  try {
    return Array.isArray(session?.encounterState?.metadata?.sliceIRecovery)
      && session.encounterState.metadata.sliceIRecovery.some((entry) => entry?.kind === "void-roll" && [entry.originalPendingCheckId, entry.replacementPendingCheckId].includes(pendingCheckId));
  } catch { return false; }
}

function sliceIOperatorTakeoverEligibility(session, stationId, context) {
  try {
    const assignment = analyzeVoyageStationAssignments(session?.encounterState?.stationAssignments).assignments
      .find((entry) => entry?.stationId === stationId);
    if (!assignment?.operator || typeof context?.resolveVoyageOperatorForPrincipal !== "function") return { ok: false, found: false };
    const trusted = trustedUsers(context);
    if (!trusted.ok || trusted.duplicates?.size) return { ok: false, found: false };
    let found = false;
    for (const user of trusted.users) {
      if (typeof user.isGM !== "boolean" || typeof user.active !== "boolean") return { ok: false, found: false };
      if (user.isGM !== false) continue;
      let operators;
      try { operators = canonicalOperators(context.resolveVoyageOperatorForPrincipal(user.id)); } catch { operators = null; }
      if (!Array.isArray(operators) || !operators.some((operator) => operatorIdentityMatches(operator, assignment.operator))) continue;
      found = true;
      if (user.active === true) return { ok: false, found: true, active: true };
    }
    return { ok: found, found, active: false };
  } catch { return { ok: false, found: false }; }
}

function validSliceIPayload(kind, payload) {
  if (!isPlainObject(payload) || !SLICE_I_CORRECTION_KINDS.includes(kind)) return false;
  const fields = {
    "remaining-order": ["stationOrder"],
    target: ["stationId", "targetStationId"],
    "operator-takeover": ["stationId"],
    "void-roll": ["pendingCheckId"],
    "retry-roll-integration": ["pendingCheckId"],
    "recorded-result": ["pendingCheckId", "correctedResult"]
  }[kind];
  if (!fields || !exactKeys(payload, fields) || containsForbiddenPayloadAuthority(payload)) return false;
  if (kind === "remaining-order") return Array.isArray(payload.stationOrder) && payload.stationOrder.every(nonBlank);
  if (kind === "target") return nonBlank(payload.stationId) && nonBlank(payload.targetStationId);
  if (kind === "operator-takeover") return nonBlank(payload.stationId);
  if (kind === "void-roll" || kind === "retry-roll-integration") return nonBlank(payload.pendingCheckId);
  return nonBlank(payload.pendingCheckId) && isPlainObject(payload.correctedResult)
    && exactKeys(payload.correctedResult, ["total", "degreeOfSuccess", "degreeOfSuccessSlug", "statisticSlug", "dc", "rollMode"])
    && Number.isFinite(payload.correctedResult.total) && safeInteger(payload.correctedResult.degreeOfSuccess)
    && payload.correctedResult.degreeOfSuccess >= 0 && payload.correctedResult.degreeOfSuccess <= 3
    && ["critical-failure", "failure", "success", "critical-success"][payload.correctedResult.degreeOfSuccess] === payload.correctedResult.degreeOfSuccessSlug
    && nonBlank(payload.correctedResult.statisticSlug) && safeInteger(payload.correctedResult.dc) && payload.correctedResult.dc >= 0
    && ["public", "blind"].includes(payload.correctedResult.rollMode);
}

function sliceIHistoricalAuditAfter(session, audit, correctionKind) {
  try {
    const index = session.auditHistory.indexOf(audit);
    for (let position = index - 1; position >= 0; position -= 1) {
      const prior = session.auditHistory[position];
      if (prior?.kind === "correction-applied" && prior.details?.correctionKind === correctionKind) return capture(prior.details.after).value;
    }
    if (correctionKind === "remaining-order") {
      const orderRecord = [...session.processedRequests].reverse().find((record) => record?.commandKind === "station-order" && record.resultRevision < audit.revision);
      const orderTuple = orderRecord && parseStoredFingerprint(orderRecord.fingerprint);
      if (orderTuple?.ok && Array.isArray(orderTuple.value[6]?.stationOrder)) return capture(orderTuple.value[6].stationOrder).value;
      const checkpoint = session.checkpoints.find((entry) => entry?.kind === "before-plan-lock");
      return capture(checkpoint?.encounterState?.committedStationOrder).value;
    }
    return null;
  } catch { return null; }
}

function sliceIExpectedReplacement(evidence, pendingCheckId, encounterRevision) {
  const captured = capture(evidence);
  if (!captured.ok || !nonBlank(pendingCheckId) || !safeInteger(encounterRevision)) return null;
  const replacement = captured.value;
  replacement.pendingCheckId = pendingCheckId;
  replacement.preparedRevision = encounterRevision;
  replacement.status = "pending";
  replacement.result = null;
  return replacement;
}

function sliceIRecoveryAuditBound(session, runtimeEvent, payload, audit) {
  try {
    const history = session.encounterState.metadata?.sliceIRecovery?.find((entry) => entry?.kind === payload.correctionKind && entry.originalPendingCheckId === payload.replacementPayload.pendingCheckId);
    if (!history || !exactKeys(history, ["kind", "originalPendingCheckId", "replacementPendingCheckId", "evidence"]) || !equal(history.evidence, audit.details.before)) return false;
    const expected = sliceIExpectedReplacement(history.evidence, history.replacementPendingCheckId, runtimeEvent.encounterRevision);
    if (!expected || !equal(expected, audit.details.after)) return false;
    if (payload.correctionKind === "retry-roll-integration") {
      const current = session.encounterState.pendingChecks?.find((entry) => entry?.pendingCheckId === history.replacementPendingCheckId);
      return Boolean(current && equal(current, audit.details.after));
    }
    const current = session.encounterState.pendingChecks?.find((entry) => entry?.pendingCheckId === history.replacementPendingCheckId);
    if (current && equal(current, audit.details.after)) return true;
    return session.encounterState.metadata?.sliceIRecovery?.some((entry) => entry?.kind === "retry-roll-integration"
      && entry.originalPendingCheckId === history.originalPendingCheckId && equal(entry.evidence, history.evidence));
  } catch { return false; }
}

function validSliceIAudit(audit, record, runtimeEvent, payload, session) {
  const replacement = payload.replacementPayload;
  const stationMatches = ["operator-takeover", "target"].includes(payload.correctionKind) ? audit?.details?.stationId === replacement?.stationId : true;
  const checkMatches = ["void-roll", "retry-roll-integration", "recorded-result"].includes(payload.correctionKind) ? audit?.details?.pendingCheckId === replacement?.pendingCheckId : true;
  if (!(audit && exactKeys(audit, AUDIT_FIELDS) && audit.kind === "correction-applied"
    && audit.requestId === record.requestId && audit.actorUserId === record.principalUserId
    && safeInteger(audit.authorityEpoch) && audit.authorityEpoch === record.response.authorityEpoch
    && audit.previousRevision === record.resultRevision - 1 && audit.revision === record.resultRevision
    && validIsoTimestamp(audit.occurredAt) && exactKeys(audit.details, SLICE_I_CORRECTION_AUDIT_DETAILS)
    && audit.details.correctionKind === payload.correctionKind && audit.details.targetRequestId === null
    && audit.details.previousSessionState === "station-resolution" && audit.details.nextSessionState === "station-resolution"
    && audit.details.reason === payload.reason && audit.details.previousEncounterRevision === runtimeEvent.previousEncounterRevision
    && audit.details.encounterRevision === runtimeEvent.encounterRevision
    && (audit.details.stationId === null || nonBlank(audit.details.stationId))
    && (audit.details.pendingCheckId === null || nonBlank(audit.details.pendingCheckId)) && stationMatches && checkMatches
    && capture(audit.details.before).ok && capture(audit.details.after).ok)) return false;
  if (payload.correctionKind === "remaining-order") {
    const before = audit.details.before, after = audit.details.after;
    const currentOrder = session.encounterState.committedStationOrder;
    const priorOrder = sliceIHistoricalAuditAfter(session, audit, payload.correctionKind);
    if (!Array.isArray(before) || !Array.isArray(after) || !Array.isArray(currentOrder) || !Array.isArray(priorOrder)
      || !equal(after, currentOrder) || !equal(before, priorOrder) || before.length !== currentOrder.length
      || new Set(before).size !== before.length || new Set(before).size !== new Set(currentOrder).size
      || before.some((stationId) => !currentOrder.includes(stationId))) return false;
    const resolvedPrefix = currentOrder.filter((stationId) => session.encounterState.pendingChecks.some((check) => check.stationId === stationId && check.status !== "pending"));
    if (!resolvedPrefix.every((stationId, index) => before[index] === stationId && after[index] === stationId)) return false;
  } else if (payload.correctionKind === "operator-takeover") {
    const priorControl = sliceIHistoricalAuditAfter(session, audit, payload.correctionKind);
    const currentControl = session.encounterState.metadata?.recoveryControl ?? null;
    if (!equal(audit.details.before, priorControl) || !equal(audit.details.after, currentControl)
      || !isPlainObject(currentControl) || !exactKeys(currentControl, ["kind", "stationId", "operatorId", "controllerUserId"])
      || currentControl.kind !== "operator-takeover" || currentControl.stationId !== replacement.stationId) return false;
    const checkpoint = session.checkpoints.find((entry) => entry?.kind === "before-plan-lock");
    if (checkpoint?.encounterState?.stationAssignments && !equal(checkpoint.encounterState.stationAssignments, session.encounterState.stationAssignments)) return false;
  } else if (["void-roll", "retry-roll-integration"].includes(payload.correctionKind) && !sliceIRecoveryAuditBound(session, runtimeEvent, payload, audit)) return false;
  return true;
}

function validSliceIRecord(record, session, audit, runtimeEvent) {
  try {
    if (record.commandKind !== "correct-session" || record.resultKind !== "corrected" || !validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) || record.response.status !== "station-resolution" || record.response.events.length !== 1) return false;
    const tuple = parseStoredFingerprint(record.fingerprint); if (!tuple.ok || tuple.value[5] !== "correct-session") return false;
    const payload = tuple.value[6];
    if (!exactKeys(payload, ["correctionKind", "targetRequestId", "targetCheckpointId", "replacementPayload", "reason", "confirmation"]) || payload.targetRequestId !== null || payload.targetCheckpointId !== null || payload.confirmation !== true || !nonBlank(payload.reason) || !validSliceIPayload(payload?.correctionKind, payload?.replacementPayload)) return false;
    if (!SLICE_I_EXECUTABLE_CORRECTION_KINDS.has(payload.correctionKind)) return false;
    if (!validRuntimeEvent(runtimeEvent, session, session.events.indexOf(runtimeEvent)) || runtimeEvent.type !== "voyage.m11-session-corrected" || runtimeEvent.correctionKind !== payload.correctionKind || runtimeEvent.correctionAuthorityUserId !== record.principalUserId || !equal(record.response.events[0], runtimeEvent)) return false;
    if (!validSliceIAudit(audit, record, runtimeEvent, { correctionKind: payload.correctionKind, reason: payload.reason, replacementPayload: payload.replacementPayload }, session)) return false;
    if (payload.correctionKind === "recorded-result") {
      const check = session.encounterState.pendingChecks?.find((entry) => entry?.pendingCheckId === payload.replacementPayload.pendingCheckId);
      if (!check || check.status !== "resolved" || !equal(check.result, payload.replacementPayload.correctedResult)) return false;
    }
    if (["void-roll", "retry-roll-integration"].includes(payload.correctionKind)) {
      const history = session.encounterState.metadata?.sliceIRecovery?.find((entry) => entry?.kind === payload.correctionKind && entry.originalPendingCheckId === payload.replacementPayload.pendingCheckId);
      if (!history || !exactKeys(history, ["kind", "originalPendingCheckId", "replacementPendingCheckId", "evidence"]) || !equal(history.evidence, audit.details.before) || !isPlainObject(audit.details.after)) return false;
      const expectedReplacement = capture(history.evidence);
      if (!expectedReplacement.ok || !nonBlank(history.replacementPendingCheckId)) return false;
      expectedReplacement.value.pendingCheckId = history.replacementPendingCheckId;
      expectedReplacement.value.preparedRevision = runtimeEvent.encounterRevision;
      expectedReplacement.value.status = "pending";
      expectedReplacement.value.result = null;
      if (!equal(expectedReplacement.value, audit.details.after)) return false;
      if (payload.correctionKind === "void-roll") {
        const replacement = session.encounterState.pendingChecks?.find((entry) => entry?.pendingCheckId === history.replacementPendingCheckId);
        const superseded = !replacement && session.encounterState.metadata?.sliceIRecovery?.some((entry) => entry?.kind === "retry-roll-integration" && entry.originalPendingCheckId === history.originalPendingCheckId && equal(entry.evidence, history.evidence));
        if (!superseded && (!replacement || replacement.status !== "pending" || !equal(replacement, audit.details.after))) return false;
      } else if (!nonBlank(history.replacementPendingCheckId) || history.replacementPendingCheckId !== audit.details.after.pendingCheckId) return false;
    }
    return true;
  } catch { return false; }
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
      const unlock = payload.correctionKind === "plan-unlock";
      if (SLICE_I_CORRECTION_KINDS.includes(payload.correctionKind)) return validSliceIRecord(record, session, audit, runtimeEvent);
      if (record.resultKind !== "corrected" || parsed.value[5] !== "correct-session" || !exactKeys(payload, ["correctionKind", "targetRequestId", "targetCheckpointId", "replacementPayload", "reason", "confirmation"]) || !["station-selection", "station-order", "plan-unlock"].includes(payload.correctionKind)
        || !exactKeys(payload.replacementPayload, unlock ? [] : payload.correctionKind === "station-selection" ? ["stationId", "actionId"] : ["stationOrder"])
        || payload.targetRequestId !== null || payload.targetCheckpointId !== null || payload.confirmation !== true || !validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch)
        || record.response.status !== "crew-planning" || record.response.events.length !== (unlock ? 1 : 2)
        || audit.details?.previousSessionState !== (unlock ? "plan-locked" : "crew-planning") || audit.details?.nextSessionState !== "crew-planning"
        || (!unlock && session.checkpoints.some((checkpoint) => checkpoint.kind === "before-plan-lock" && checkpoint.revision <= record.resultRevision - 1))) return false;
      if (!validRuntimeEvent(runtimeEvent, session, session.events.indexOf(runtimeEvent)) || runtimeEvent.type !== "voyage.m11-session-corrected" || runtimeEvent.correctionAuthorityUserId !== record.principalUserId
        || runtimeEvent.correctionKind !== payload.correctionKind
        || (unlock && !validPlanUnlockPredecessor(session, runtimeEvent))
        || (unlock ? !equal(record.response.events[0], runtimeEvent) : (!validTask7DomainPair(record.response.events[0], runtimeEvent, session) || !equal(record.response.events[1], runtimeEvent)))) return false;
      const unlockAuditValid = audit && exactKeys(audit, AUDIT_FIELDS) && audit.kind === "correction-applied" && audit.requestId === record.requestId && audit.actorUserId === record.principalUserId && safeInteger(audit.authorityEpoch) && parsed.value[3] === audit.authorityEpoch && audit.authorityEpoch === record.response.authorityEpoch && audit.revision === record.resultRevision && audit.previousRevision === record.resultRevision - 1 && validIsoTimestamp(audit.occurredAt) && exactKeys(audit.details, TASK7_CORRECTION_AUDIT_DETAILS) && audit.details.correctionKind === payload.correctionKind && audit.details.targetRequestId === null && audit.details.previousSessionState === (unlock ? "plan-locked" : "crew-planning") && audit.details.nextSessionState === "crew-planning" && audit.details.reason === payload.reason && audit.details.previousEncounterRevision === runtimeEvent.previousEncounterRevision && audit.details.encounterRevision === runtimeEvent.encounterRevision;
      return unlockAuditValid;
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
function operatorAllowedCommand(commandKind) {
  return commandKind === "station-selection" || commandKind === "station-selection-clear" || commandKind === "station-order";
}

function validM12Task2Record(record, session, audit, event, checkpoint = null) {
  try {
    const operatorRecord = record.commandKind === "station-selection" || record.commandKind === "station-selection-clear" || record.commandKind === "station-order";
    if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || !nonBlank(record.principalUserId)
      || !["gm", ...(operatorRecord ? ["operator"] : [])].includes(record.projectionKind) || !TASK2_COMMANDS.has(record.commandKind)
      || record.resultKind !== TASK2_RESULT_KINDS[record.commandKind] || !safeInteger(record.resultRevision)
      || record.resultRevision < 1 || record.resultRevision > session.revision || !isPlainObject(record.response)) return false;
    const parsed = parseStoredFingerprint(record.fingerprint); if (!parsed.ok) return false;
    const tuple = parsed.value;
    if (tuple[0] !== session.sessionId || tuple[1] !== record.principalUserId || tuple[2] !== record.projectionKind
      || !safeInteger(tuple[3]) || !safeInteger(tuple[4]) || tuple[3] > session.authorityEpoch || tuple[4] !== record.resultRevision - 1
      || tuple[5] !== record.commandKind || !task2PayloadValid(record.commandKind, tuple[6])) return false;
    if (record.projectionKind === "operator") {
      if (record.commandKind === "station-order") {
        if (!Array.isArray(tuple[6].stationOrder) || !tuple[6].stationOrder.every((stationId) => session.encounterState.stationAssignments.some((entry) => entry?.stationId === stationId))) return false;
      } else if (!session.encounterState.stationAssignments.some((entry) => entry?.stationId === tuple[6].stationId)) return false;
    }
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
      if (matching.filter((entry) => entry.revision === record.resultRevision - 1).length !== 1) return false;
    } else if (checkpoint !== null) return false;
    return true;
  } catch { return false; }
}

function task7AbortRereadMatches(reread, candidate, documentIdValue, requestId, context) {
  try {
    if (!isPlainObject(reread) || reread.sessionDocumentId !== documentIdValue || reread.sessionId !== candidate.sessionId
      || reread.revision !== candidate.revision || reread.sessionState !== "aborted"
      || !["abandoned", "discarded"].includes(reread.encounterState?.lifecycleState) || reread.encounterState?.phase !== null) return false;
    const runtimeEvent = reread.events.at(-1), domainEvent = reread.events.at(-2), record = reread.processedRequests.at(-1), audit = reread.auditHistory.at(-1);
    return runtimeEvent?.type === "voyage.m11-session-aborted" && record?.requestId === requestId
      && validTask7Record(record, reread, audit, runtimeEvent) && validTask7DomainPair(domainEvent, runtimeEvent, reread)
      && pristineSession(reread, documentIdValue, { replayContext: context });
  } catch { return false; }
}

function task3RereadMatches(reread, candidate, documentIdValue, requestId, commandKind, context) {
  try {
    if (!isPlainObject(reread) || reread.sessionDocumentId !== documentIdValue || reread.sessionId !== candidate.sessionId
      || reread.revision !== candidate.revision || reread.sessionState !== "station-resolution" || reread.encounterState?.phase !== "resolution") return false;
    const runtimeEvent = reread.events.at(-1), domainEvent = reread.events.at(-2);
    const record = reread.processedRequests.at(-1), audit = reread.auditHistory.at(-1);
    return runtimeEvent?.type === `voyage.m12-${commandKind}` && runtimeEvent.revision === candidate.revision
      && runtimeEvent.previousRevision === candidate.revision - 1 && record?.requestId === requestId
      && validM12Task3Record(record, reread, audit, domainEvent, runtimeEvent)
      && validTask3DomainEvent(domainEvent, reread) && validM12RuntimeEvent(runtimeEvent, reread)
      && pristineSession(reread, documentIdValue, { replayContext: context });
  } catch { return false; }
}

const TASK3_RESOLUTION_EVENT_FIELDS = Object.freeze(["type", "encounterId", "lifecycleState", "roundNumber", "previousPhase", "phase", "orderedActions", "actionCount", "previousRevision", "revision", "phaseStartSnapshotId"]);
const TASK3_PREPARE_EVENT_FIELDS = Object.freeze(["type", "encounterId", "lifecycleState", "roundNumber", "phase", "actionCount", "checkCount", "noRollActionCount", "preparedChecks", "previousRevision", "revision"]);
const TASK3_RESULT_EVENT_FIELDS = Object.freeze(["type", "encounterId", "lifecycleState", "roundNumber", "phase", "pendingCheckId", "sequence", "stationId", "actionId", "resolvedCheckCount", "remainingCheckCount", "allChecksResolved", "previousRevision", "revision"]);

function isTask3DomainEvent(event) {
  return ["voyage.resolution-started", "voyage.pending-checks-prepared", "voyage.pending-check-resolved"].includes(event?.type);
}

function validTask3DomainEvent(event, session) {
  try {
    if (!isPlainObject(event) || event.encounterId !== session.eventId || event.lifecycleState !== "active" || event.phase !== "resolution"
      || !safeInteger(event.previousRevision) || !safeInteger(event.revision) || event.revision !== event.previousRevision + 1) return false;
    if (event.type === "voyage.resolution-started") {
      return exactKeys(event, TASK3_RESOLUTION_EVENT_FIELDS) && event.previousPhase === "lock-readiness" && nonBlank(event.phaseStartSnapshotId)
        && Array.isArray(event.orderedActions) && event.actionCount === event.orderedActions.length && event.actionCount > 0
        && event.orderedActions.every((entry) => isPlainObject(entry) && nonBlank(entry.stationId) && nonBlank(entry.actionId) && safeInteger(entry.sequence));
    }
    if (event.type === "voyage.pending-checks-prepared") {
      return exactKeys(event, TASK3_PREPARE_EVENT_FIELDS) && [event.actionCount, event.checkCount, event.noRollActionCount].every((value) => safeInteger(value) && value >= 0)
        && Array.isArray(event.preparedChecks) && event.preparedChecks.length === event.checkCount
        && event.preparedChecks.every((entry) => isPlainObject(entry) && exactKeys(entry, ["pendingCheckId", "sequence", "stationId", "actionId"]) && nonBlank(entry.pendingCheckId) && safeInteger(entry.sequence) && nonBlank(entry.stationId) && nonBlank(entry.actionId));
    }
    if (event.type === "voyage.pending-check-resolved") {
      return exactKeys(event, TASK3_RESULT_EVENT_FIELDS) && nonBlank(event.pendingCheckId) && safeInteger(event.sequence) && nonBlank(event.stationId) && nonBlank(event.actionId)
        && [event.resolvedCheckCount, event.remainingCheckCount].every((value) => safeInteger(value) && value >= 0) && typeof event.allChecksResolved === "boolean"
        && event.allChecksResolved === (event.remainingCheckCount === 0);
    }
    return false;
  } catch { return false; }
}

function task3PayloadValid(commandKind, payload) {
  if (!isPlainObject(payload)) return false;
  if (commandKind === "resolution-start") return exactKeys(payload, ["phaseStartSnapshotId"]) && nonBlank(payload.phaseStartSnapshotId) && !UNSAFE_KEYS.has(payload.phaseStartSnapshotId);
  if (commandKind === "action-segment") return exactKeys(payload, []) || (exactKeys(payload, ["executionResult"]) && isPlainObject(payload.executionResult));
  if (commandKind === "pending-checks-prepared") return exactKeys(payload, ["pendingCheckIds"]) && Array.isArray(payload.pendingCheckIds)
    && payload.pendingCheckIds.every((entry) => isPlainObject(entry) && exactKeys(entry, ["sequence", "pendingCheckId"]) && safeInteger(entry.sequence) && nonBlank(entry.pendingCheckId));
  return false;
}

function task3SourceBoundState(state) {
  try {
    const next = capture(state); if (!next.ok) return null;
    const assignments = Array.isArray(next.value.stationAssignments) ? next.value.stationAssignments : [];
    const byStation = new Map(assignments.map((entry) => [entry?.stationId, entry?.operator?.uuid ?? entry?.operator?.id ?? null]));
    for (const station of next.value.availableStations ?? []) {
      for (const action of station.actions ?? []) {
        if (!action?.check || !isPlainObject(action.check)) continue;
        const sourceId = byStation.get(station.stationId);
        if (!nonBlank(sourceId)) continue;
        action.check.source = { kind: "character", uuid: sourceId };
      }
    }
    return next.value;
  } catch { return null; }
}

function validM12Task3Record(record, session, audit, domainEvent, runtimeEvent) {
  try {
    if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || !nonBlank(record.principalUserId) || !["gm", "operator"].includes(record.projectionKind)
      || !TASK3_RECORD_COMMANDS.has(record.commandKind) || record.resultKind !== TASK3_RESULT_KINDS[record.commandKind] || !safeInteger(record.resultRevision)
      || record.resultRevision < 1 || record.resultRevision > session.revision || !isPlainObject(record.response)) return false;
    const parsed = parseStoredFingerprint(record.fingerprint); if (!parsed.ok) return false;
    const tuple = parsed.value;
    if (tuple[0] !== session.sessionId || tuple[1] !== record.principalUserId || tuple[2] !== record.projectionKind || !safeInteger(tuple[3]) || !safeInteger(tuple[4])
      || tuple[3] > session.authorityEpoch || tuple[5] !== record.commandKind || !task3PayloadValid(record.commandKind, tuple[6])
      || !validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) || record.response.status !== "station-resolution"
      || record.response.authorityEpoch !== tuple[3] || record.response.events.length !== 2 || !domainEvent || !runtimeEvent
      || (record.commandKind !== "action-segment" && record.projectionKind !== "gm")
      || !validTask3DomainEvent(domainEvent, session) || !validM12RuntimeEvent(runtimeEvent, session) || runtimeEvent.type !== `voyage.m12-${record.commandKind === "pending-checks-prepared" ? "pending-checks-prepared" : record.commandKind}`
      || runtimeEvent.previousRevision !== record.resultRevision - 1 || runtimeEvent.revision !== record.resultRevision
      || !equal(record.response.events[0], domainEvent) || !equal(record.response.events[1], runtimeEvent)) return false;
    if (!audit || !exactKeys(audit, AUDIT_FIELDS) || audit.kind !== TASK3_AUDIT_KINDS[record.commandKind] || audit.requestId !== record.requestId
      || audit.actorUserId !== record.principalUserId || audit.authorityEpoch !== tuple[3] || audit.previousRevision !== record.resultRevision - 1
      || audit.revision !== record.resultRevision || !validIsoTimestamp(audit.occurredAt) || !exactKeys(audit.details, M12_AUDIT_DETAILS_FIELDS)
      || audit.details.transitionKind !== record.commandKind || audit.details.previousSessionState !== (record.commandKind === "resolution-start" ? "plan-locked" : "station-resolution")
      || audit.details.nextSessionState !== "station-resolution" || audit.details.previousEncounterRevision !== domainEvent.previousRevision
      || audit.details.encounterRevision !== domainEvent.revision || audit.details.eventCount !== session.events.indexOf(runtimeEvent) + 1) return false;
    return tuple[4] === record.resultRevision - 1;
  } catch { return false; }
}
function ownedPlanningOptions(session, authority) {
  try {
    const captured = capture(session);
    if (!captured.ok || !isPlainObject(captured.value) || !isPlainObject(captured.value.encounterState)) return [];
    const state = captured.value.encounterState;
    const owned = new Set((authority?.ownedOperators ?? []).map((entry) => entry?.stationId).filter((entry) => nonBlank(entry)));
    if (authority?.role !== "gm" && authority?.role !== "operator") return [];
    const assignments = Array.isArray(state.stationAssignments) ? state.stationAssignments : [];
    const selections = isPlainObject(state.selections) ? state.selections : {};
    const riskBids = isPlainObject(state.riskBids) ? state.riskBids : {};
    const editable = state.phase === "crew-planning" && session.sessionState === "crew-planning";
    const stations = Array.isArray(state.availableStations) ? state.availableStations : [];
    return assignments.filter((assignment) => owned.has(assignment?.stationId)).map((assignment) => {
      const stationId = assignment.stationId;
      const authored = stations.find((entry) => entry?.stationId === stationId);
      const selection = isPlainObject(selections[stationId]) ? selections[stationId] : null;
      const selectedBid = isPlainObject(riskBids[stationId]) ? riskBids[stationId] : null;
      const actions = Array.isArray(authored?.actions) ? authored.actions : [];
      const safeActions = actions.map((action) => {
        const selected = selection?.actionId === action?.actionId;
        const approaches = Array.isArray(action?.approaches) ? action.approaches : [];
        const bids = Array.isArray(action?.riskBidOptions) ? action.riskBidOptions : [];
        const presentation = isPlainObject(action?.riskBidPresentation) ? action.riskBidPresentation : {};
        const safeApproaches = approaches.map((approach) => ({
          approachId: approach?.approachId ?? null,
          label: approach?.name ?? approach?.label ?? null,
          description: approach?.description ?? null,
          selected: selection?.approachId === approach?.approachId
        }));
        const safeBids = bids.filter((bid) => [2, 5, 8].includes(Number(bid?.dcAdjustment))).map((bid) => {
          const details = isPlainObject(presentation[String(bid?.dcAdjustment)]) ? presentation[String(bid.dcAdjustment)] : null;
          const outcome = isPlainObject(details?.outcome) ? details.outcome : {};
          return {
            riskBidId: bid?.riskBidId ?? null,
            dcAdjustment: bid?.dcAdjustment ?? null,
            label: details?.label ?? `+${bid?.dcAdjustment ?? ""} Risk Bid`,
            intendedBenefit: details?.intendedBenefit ?? null,
            target: details?.target ?? null,
            outcome: {
              criticalSuccess: outcome.criticalSuccess ?? null,
              success: outcome.success ?? null,
              failure: outcome.failure ?? null,
              criticalFailure: outcome.criticalFailure ?? null
            },
            selected: selectedBid?.riskBidId === bid?.riskBidId
          };
        });
        const targetRule = isPlainObject(action?.targetRule) ? action.targetRule : null;
        const eligibleTargets = Array.isArray(action?.eligibleTargets) ? action.eligibleTargets : [];
        return {
          actionId: action?.actionId ?? null,
          displayName: action?.name ?? action?.label ?? action?.actionId ?? null,
          description: action?.description ?? null,
          selected,
          approaches: safeApproaches,
          riskBidCapable: safeBids.length > 0,
          riskBidOptions: safeBids,
          targetRequired: Boolean(targetRule),
          eligibleTargets: eligibleTargets.map((target) => ({ targetId: target?.targetId ?? target?.stationId ?? null, label: target?.label ?? target?.name ?? target?.stationId ?? null }))
        };
      });
      return {
        stationId,
        selectedActionId: selection?.actionId ?? null,
        selectedApproachId: selection?.approachId ?? null,
        selectedRiskBidId: selectedBid?.riskBidId ?? null,
        editable,
        ready: Boolean(selection?.actionId && selection?.approachId),
        actions: safeActions
      };
    });
  } catch { return []; }
}
function multiplayerResolutionState(session) {
  try {
    const state = session?.encounterState;
    const order = Array.isArray(state?.committedStationOrder) ? state.committedStationOrder.filter((entry) => nonBlank(entry)) : [];
    const assignments = Array.isArray(state?.stationAssignments) ? state.stationAssignments : [];
    const byStation = new Map(assignments.map((entry) => [entry?.stationId, entry?.operator ?? null]));
    const pending = Array.isArray(state?.pendingChecks) ? state.pendingChecks : [];
    const pendingByStation = new Map(pending.map((entry) => [entry?.stationId, entry]));
    const started = session.sessionState === "station-resolution" && state?.phase === "resolution";
    const unresolved = order.find((stationId) => pendingByStation.get(stationId)?.status !== "resolved");
    const currentStationId = started ? (unresolved ?? (pending.length === 0 ? order[0] ?? null : null)) : null;
    const currentIndex = currentStationId === null ? -1 : order.indexOf(currentStationId);
    const stations = order.map((stationId, index) => {
      const check = pendingByStation.get(stationId);
      const status = check?.status === "resolved" ? "resolved" : stationId === currentStationId ? "current" : "waiting";
      const operator = byStation.get(stationId);
      return {
        stationId,
        orderPosition: index + 1,
        status,
        current: status === "current",
        operator: operator ? { id: operator.id ?? null, uuid: operator.uuid ?? null, name: operator.name ?? null } : null
      };
    });
    return {
      resolutionStarted: started,
      resolutionOrder: [...order],
      resolutionCurrentStationId: currentStationId,
      resolutionCurrentOperator: currentStationId === null ? null : stations.find((entry) => entry.stationId === currentStationId)?.operator ?? null,
      resolutionOrderPosition: currentIndex < 0 ? null : currentIndex + 1,
      resolutionTotalStations: order.length,
      resolutionStations: stations,
      resolutionComplete: started && stations.length > 0 && stations.every((entry) => entry.status === "resolved")
    };
  } catch {
    return {
      resolutionStarted: false,
      resolutionOrder: [],
      resolutionCurrentStationId: null,
      resolutionCurrentOperator: null,
      resolutionOrderPosition: null,
      resolutionTotalStations: 0,
      resolutionStations: [],
      resolutionComplete: false
    };
  }
}
function multiplayerExecutionPresentation(session, authority, resolution) {
  try {
    const state = session.encounterState;
    const currentStationId = resolution.resolutionCurrentStationId;
    const pending = Array.isArray(state.pendingChecks)
      ? state.pendingChecks.find((entry) => entry?.stationId === currentStationId && entry?.status === "pending" && !sliceIVoidedPendingCheck(session, entry.pendingCheckId))
      : null;
    const assignment = Array.isArray(state.stationAssignments)
      ? state.stationAssignments.find((entry) => entry?.stationId === currentStationId)
      : null;
    const owned = authority.ownedOperators?.some((entry) => entry?.stationId === currentStationId) === true;
    const windowOpen = state.metadata?.reactionWindow?.status === "open"
      && state.metadata.reactionWindow.stationId === currentStationId;
    const station = Array.isArray(state.availableStations)
      ? state.availableStations.find((entry) => entry?.stationId === currentStationId)
      : null;
    const selection = isPlainObject(state.selections?.[currentStationId]) ? state.selections[currentStationId] : null;
    const action = station?.actions?.find((entry) => entry?.actionId === selection?.actionId) ?? null;
    const approach = action?.approaches?.find((entry) => entry?.approachId === selection?.approachId) ?? null;
    const bid = isPlainObject(state.riskBids?.[currentStationId]) ? state.riskBids[currentStationId] : null;
    const bidOption = action?.riskBidOptions?.find((entry) => entry?.riskBidId === bid?.riskBidId) ?? null;
    const riskPresentation = bidOption && isPlainObject(action?.riskBidPresentation?.[String(bidOption.dcAdjustment)])
      ? action.riskBidPresentation[String(bidOption.dcAdjustment)]
      : null;
    const canExecute = session.sessionState === "station-resolution"
      && state.phase === "resolution"
      && Boolean(currentStationId && pending && pending.status !== "resolved")
      && !windowOpen
      && (authority.role === "gm" || (authority.role === "operator" && owned));
    let stateLabel = "not-started";
    if (resolution.resolutionComplete) stateLabel = "complete";
    else if (!resolution.resolutionStarted) stateLabel = "not-started";
    else if (!currentStationId || !pending) stateLabel = "waiting";
    else if (windowOpen) stateLabel = "waiting-reaction";
    else if (authority.role === "operator" && !owned) stateLabel = "waiting-on-operator";
    else if (canExecute) stateLabel = "available";
    return {
      canExecuteCurrentStation: canExecute,
      currentStationOwnedByViewer: owned,
      currentExecutionState: stateLabel,
      currentExecution: {
        stationId: currentStationId ?? null,
        stationName: assignment?.stationId ?? currentStationId ?? null,
        actionName: action?.name ?? action?.label ?? null,
        approachName: approach?.name ?? approach?.label ?? null,
        statisticLabel: selection?.statisticSlugOrAbilityId ?? approach?.statisticSlugOrAbilityId ?? null,
        riskBidLabel: bidOption ? (riskPresentation?.label ?? bidOption.label ?? bidOption.riskBidId ?? null) : "NO BID",
        waitingForReaction: windowOpen
      }
    };
  } catch {
    return {
      canExecuteCurrentStation: false,
      currentStationOwnedByViewer: false,
      currentExecutionState: "unavailable",
      currentExecution: { stationId: null, stationName: null, actionName: null, approachName: null, statisticLabel: null, riskBidLabel: null, waitingForReaction: false }
    };
  }
}
function reactionParticipantForAuthority(session, authority, reactionId) {
  try {
    const window = session?.encounterState?.metadata?.reactionWindow;
    const opportunity = window?.opportunities?.find((entry) => entry?.reactionId === reactionId);
    if (!opportunity || window.status !== "open" || window.resolved?.includes(reactionId)) return null;
    if (authority?.role === "gm") return opportunity;
    if (authority?.role !== "operator") return null;
    return authority.ownedOperators?.some((entry) => entry.stationId === opportunity.stationId
      && [entry.operatorId, entry.operatorUuid].includes(opportunity.operatorId)) ? opportunity : null;
  } catch { return null; }
}
function multiplayerReactionPresentation(session, authority) {
  const empty = {
    hasPendingPlayerDecision: false, decisionPhase: null, decisionRequired: false, decisionStationId: null,
    decisionStationName: null, decisionTargetStationId: null, decisionTargetStationName: null, decisionTitle: null,
    decisionDescription: null, decisionNarration: null, decisionSourceOperatorName: null, decisionCost: null,
    decisionStatisticLabel: null, decisionDc: null, decisionVisibility: null, decisionOutcomes: [], decisionOptions: [],
    canUseFocus: false, canPassReaction: false, rollBlockedByDecision: false
  };
  try {
    const state = session.encounterState;
    const window = state.metadata?.reactionWindow;
    if (!window || window.status !== "open" || !Array.isArray(window.opportunities)) return empty;
    const pending = window.opportunities.find((entry) => !window.resolved?.includes(entry.reactionId));
    if (!pending) return empty;
    const eligible = reactionParticipantForAuthority(session, authority, pending.reactionId);
    if (!eligible) return { ...empty, hasPendingPlayerDecision: true, decisionPhase: "waiting-reaction", decisionRequired: true, rollBlockedByDecision: true };
    const ability = state.metadata?.focusAbilities?.find((entry) => entry.focusAbilityId === pending.focusAbilityId);
    const assignment = state.stationAssignments?.find((entry) => entry.stationId === pending.stationId);
    const targetAssignment = state.stationAssignments?.find((entry) => entry.stationId === pending.targetStationId);
    const pool = state.metadata?.focusPools?.find((entry) => entry.stationId === pending.stationId && entry.operatorId === pending.operatorId);
    if (!ability || !assignment || !pool) return { ...empty, hasPendingPlayerDecision: true, decisionPhase: "waiting-reaction", decisionRequired: true, rollBlockedByDecision: true };
    const privateVisible = ability.visibility === "public" || ability.secrecy === "public";
    const outcomes = privateVisible ? ["criticalSuccess", "success", "failure", "criticalFailure"].map((key) => ({ key, text: ability.outcomeNarration?.[key] ?? null })) : [];
    const options = [{ reactionId: pending.reactionId, kind: "focus-reaction-use", label: "USE FOCUS" }];
    options.push({ reactionId: pending.reactionId, kind: "focus-reaction-pass", label: "PASS" });
    return {
      hasPendingPlayerDecision: true, decisionPhase: "before-roll", decisionRequired: true,
      decisionStationId: pending.stationId, decisionStationName: assignment.stationId,
      decisionTargetStationId: pending.targetStationId, decisionTargetStationName: targetAssignment?.stationId ?? pending.targetStationId,
      decisionTitle: ability.name, decisionDescription: ability.description, decisionNarration: ability.narration,
      decisionSourceOperatorName: assignment.operator?.name ?? pending.operatorId, decisionCost: ability.cost,
      decisionStatisticLabel: ability.statisticSlugOrAbilityId, decisionDc: privateVisible ? ability.dc : null,
      decisionVisibility: ability.visibility ?? ability.secrecy, decisionOutcomes: outcomes, decisionOptions: options,
      canUseFocus: pool.current >= ability.cost, canPassReaction: true, rollBlockedByDecision: true
    };
  } catch { return empty; }
}
function buildMultiplayerProjection(session, authority) {
  const common = buildSessionProjection(session, authority.role);
  if (!common || !authority || !["gm", "operator", "crew", "observer"].includes(authority.role)) return null;
  const encounter = session.encounterState;
  const assignedOrder = Array.isArray(encounter.stationAssignments) ? encounter.stationAssignments.map((entry) => entry?.stationId).filter((entry) => nonBlank(entry)) : [];
  const proposedOrder = Array.isArray(encounter.proposedStationOrder) ? encounter.proposedStationOrder : [];
  const committedOrder = Array.isArray(encounter.committedStationOrder) ? encounter.committedStationOrder : [];
  const sharedStationOrder = committedOrder.length > 0 ? [...committedOrder] : proposedOrder.length > 0 ? [...proposedOrder] : [...assignedOrder];
  let planReady = false;
  try { planReady = session.sessionState === "crew-planning" && prepareVoyageEncounterCrewPlanningReadiness(encounter).readyToLock === true; } catch { planReady = false; }
  const planLocked = PLAN_LOCKED_SESSION_STATES.has(session.sessionState);
  const resolution = multiplayerResolutionState(session);
  const execution = multiplayerExecutionPresentation(session, authority, resolution);
  const reaction = multiplayerReactionPresentation(session, authority);
  const projection = {
    ...common,
    projectionRole: authority.role,
    ownedOperators: authority.ownedOperators,
    readOnlyStationIds: authority.readOnlyStationIds,
    ownedPlanningOptions: ownedPlanningOptions(session, authority),
    sharedStationOrder,
    planReady,
    planLocked,
    canMutateSharedOrder: authority.role === "operator" && session.sessionState === "crew-planning" && encounter.phase === "crew-planning",
    currentActingStationId: resolution.resolutionCurrentStationId,
    ...resolution,
    ...execution,
    ...reaction
  };
  const isolated = capture(projection);
  return isolated.ok && exactKeys(isolated.value, MULTIPLAYER_PROJECTION_FIELDS) ? isolated.value : null;
}

function createResolvedRiskBidEffects(prior, candidate, commandValue) {
  try {
    if (commandValue.commandKind !== "action-segment") return [];
    const resultSlug = commandValue.payload?.executionResult?.result?.degreeOfSuccessSlug;
    if (!["success", "critical-success"].includes(resultSlug)) return [];
    const pendingId = commandValue.payload.executionResult.pendingCheckId;
    const sourceCheck = prior.encounterState.pendingChecks.find((check) => check.pendingCheckId === pendingId);
    if (!sourceCheck) return [];
    const selection = prior.encounterState.selections?.[sourceCheck.stationId];
    const bid = prior.encounterState.riskBids?.[sourceCheck.stationId];
    if (!selection?.actionId || !bid?.riskBidId) return [];
    const station = prior.encounterState.availableStations?.find((entry) => entry.stationId === sourceCheck.stationId);
    const action = station?.actions?.find((entry) => entry.actionId === selection.actionId);
    const presentation = action?.riskBidPresentation?.[String(bid.dcAdjustment)];
    const authored = presentation?.mechanicalEffect;
    if (!authored || !Array.isArray(authored.effects)) return [];
    const order = prior.encounterState.committedStationOrder ?? [];
    const sourceIndex = order.indexOf(sourceCheck.stationId);
    const effects = authored.effects.filter((effect) => nonBlank(effect?.targetStationIds?.[0])
      && prior.encounterState.pendingChecks.some((check) => check.stationId === effect.targetStationIds[0]));
    return effects.map((effect, index) => {
      const targetStationId = effect.targetStationIds?.[0];
      const targetCheck = prior.encounterState.pendingChecks.find((check) => check.stationId === targetStationId);
      const targetIndex = order.indexOf(targetStationId);
      const validTarget = nonBlank(targetStationId) && targetCheck && sourceIndex >= 0 && targetIndex > sourceIndex;
      return {
        effectId: `arcflight-risk-bid-effect:${JSON.stringify([candidate.sessionId, candidate.revision, bid.riskBidId, targetStationId, index])}`,
        sourceStationId: sourceCheck.stationId,
        sourceActionId: selection.actionId,
        riskBidId: bid.riskBidId,
        sourceRevision: candidate.revision,
        sourceEncounterRevision: candidate.encounterState.revision,
        sourceResult: resultSlug,
        targetStationId,
        targetPendingCheckId: targetCheck.pendingCheckId,
        effectKind: effect.effectKind,
        effectValue: effect.value,
        activationTiming: effect.activationTiming,
        consumptionTiming: effect.consumptionTiming,
        roundNumber: candidate.encounterState.roundNumber,
        requiresSourceBeforeTarget: effect.requiresSourceBeforeTarget === true,
        status: validTarget ? "active" : "blocked",
        consumedAtRevision: null
      };
    });
  } catch { return []; }
}

async function dispatchTask3Command(value, identities, initialAuth, initialMatch, context) {
  const descriptor = coordinatorDescriptor(value, initialMatch.documentId, initialAuth, context);
  if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  return runExclusiveSessionMutation(context, descriptor, async (trustedWitness) => withTransferLock(value.sessionId, async () => {
    const auth = context?.__trustedResolutionOperator === true
      ? authenticatedContext(context)
      : authority(context, { requireConnection: true });
    if (auth.error || !coordinatorIdentityMatches(auth, descriptor, context)) return failure([auth.error ?? diagnostic("m11-active-gm-required", "transport.connection")], identities);
    const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
    if (resolved.match.documentId !== descriptor.sessionDocumentId || !pristineSession(resolved.match.session, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const prior = resolved.match.session;
    const projectionKind = deriveProjectionKind(auth, prior, context);
    if (context?.__trustedResolutionOperator === true && projectionKind !== "operator") return failure([diagnostic("m11-projection-not-authorized", "transport.user")], identities);
    const takeover = prior.encounterState?.metadata?.recoveryControl;
    if (context?.__trustedResolutionOperator === true && takeover?.kind === "operator-takeover" && takeover.stationId === prior.encounterState?.committedStationOrder?.find((stationId) => prior.encounterState.pendingChecks?.some((check) => check.stationId === stationId && check.status === "pending"))) return failure([diagnostic("m11-projection-not-authorized", "transport.user")], identities);
    const fp = fingerprint(value.sessionId, auth.authenticatedUserId, projectionKind, value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload);
    const replay = replayOrConflict(prior.processedRequests, value.requestId, auth.authenticatedUserId, projectionKind, fp, identities); if (replay) return replay;
    if (prior.activeGmUserId !== auth.activeGmUserId || value.authorityEpoch !== prior.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.expectedRevision !== prior.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    if (value.commandKind === "resolution-start" && context?.__trustedResolutionStart !== true) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
    if (ownData(context, "focusAbilities").ok && !focusMetadata(prior.encounterState, context)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
    let applied;
    let executionResult = value.payload.executionResult;
    if (value.commandKind === "action-segment" && context?.__executePendingCheck === true) {
      const state = prior.encounterState;
      const currentStationId = state.committedStationOrder?.find((stationId) => state.pendingChecks?.some((check) => check.stationId === stationId && check.status === "pending"));
      const pending = state.pendingChecks?.find((check) => check.stationId === currentStationId && check.status === "pending" && !sliceIVoidedPendingCheck(prior, check.pendingCheckId));
      const owned = projectionKind === "operator" && deriveProjectionAuthority(auth, prior, context).ownedOperators.some((entry) => entry.stationId === currentStationId);
      if (!pending || (projectionKind === "operator" && !owned) || state.metadata?.reactionWindow?.status === "open") return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
      const executor = m10Function(context, "executeVoyagePf2ePendingCheck", null);
      if (typeof executor !== "function") return failure([diagnostic("m11-command-not-allowed", "transport")], identities);
      const focusModifier = focusModifierForCheck(state, pending.pendingCheckId, pending.stationId);
      const riskModifier = riskBidModifierForCheck(state, pending.pendingCheckId, pending.stationId);
      const activeRiskEffects = activeRiskBidEffectsForCheck(state, pending.pendingCheckId, pending.stationId);
      const effectiveArcflightModifier = Math.max(-5, Math.min(5, (pending.momentumRollBonus ?? 0) + focusModifier + riskModifier));
      const executionInput = capture(pending).value;
      const cappedFocusModifier = effectiveArcflightModifier - (pending.momentumRollBonus ?? 0);
      if (cappedFocusModifier !== 0) executionInput.focusModifier = cappedFocusModifier;
      let rawExecution = null;
      try { rawExecution = await executor(executionInput); } catch { rawExecution = null; }
      const isolatedExecution = capture(rawExecution);
      if (!isolatedExecution.ok || !isPlainObject(isolatedExecution.value) || isolatedExecution.value.ok !== true) return failure([diagnostic("m11-command-payload-invalid", "executionResult")], identities);
      executionResult = applyRiskBidDegreeShift(isolatedExecution.value, activeRiskEffects);
    }
    if (value.commandKind === "resolution-start") {
      if (prior.sessionState !== "plan-locked" || prior.encounterState.phase !== "lock-readiness") return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
      const bound = task3SourceBoundState(prior.encounterState); if (!bound) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
      applied = applyVoyageEncounterResolutionTransition(bound, value.payload);
    } else {
      if (prior.sessionState !== "station-resolution" || prior.encounterState.phase !== "resolution") return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
      applied = applyVoyageEncounterPendingCheckResult(prior.encounterState, executionResult);
    }
    if (!applied?.ok || !applied.nextState || !Array.isArray(applied.events) || applied.events.length !== 1 || !trustedWitness?.occurredAt) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
    const captured = capture(prior); if (!captured.ok) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const candidate = captured.value; candidate.encounterState = capture(applied.nextState).value; candidate.revision = prior.revision + 1;
    if (value.commandKind === "action-segment") {
      const priorEffects = Array.isArray(prior.encounterState.metadata?.riskBidEffects)
        ? prior.encounterState.metadata.riskBidEffects.map((effect) => ({ ...effect }))
        : [];
      const consumed = priorEffects.map((effect) => effect.status === "active"
        && effect.targetPendingCheckId === executionResult?.pendingCheckId
        ? { ...effect, status: "consumed", consumedAtRevision: candidate.revision }
        : effect);
      const effectCommand = executionResult === value.payload.executionResult ? value : { ...value, payload: { executionResult } };
      candidate.encounterState.metadata.riskBidEffects = [...consumed, ...createResolvedRiskBidEffects(prior, candidate, effectCommand)];
    }
    if (value.commandKind === "action-segment") prepareFocusWindowForNextPending(candidate.encounterState, context);
    if (value.commandKind === "resolution-start") {
      const focus = focusMetadata(candidate.encounterState, context);
      if (ownData(context, "focusAbilities").ok && !focus) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
      if (focus) {
        candidate.encounterState.metadata.focusPools = focus.pools;
        candidate.encounterState.metadata.focusAbilities = focus.abilities;
        candidate.encounterState.metadata.reactionWindow = null;
        candidate.encounterState.metadata.focusEffects = [];
      }
      candidate.encounterState.metadata.riskBidEffects = [];
    }
    candidate.sessionState = "station-resolution";
    const domainEvent = capture(applied.events[0]); if (!domainEvent.ok || !validTask3DomainEvent(domainEvent.value, candidate)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
    const runtimeEvent = { type: `voyage.m12-${value.commandKind}`, sessionId: candidate.sessionId, eventId: candidate.eventId, definitionSnapshotId: candidate.definitionSnapshotId, shipId: candidate.shipId, transitionKind: value.commandKind, previousSessionState: prior.sessionState, nextSessionState: candidate.sessionState, previousEncounterRevision: prior.encounterState.revision, encounterRevision: candidate.encounterState.revision, previousRevision: prior.revision, revision: candidate.revision };
    candidate.events.push(domainEvent.value, runtimeEvent);
    candidate.auditHistory.push({ auditId: auditId(candidate.sessionId, candidate.auditHistory.length, TASK3_AUDIT_KINDS[value.commandKind]), kind: TASK3_AUDIT_KINDS[value.commandKind], sessionId: candidate.sessionId, requestId: value.requestId, actorUserId: auth.authenticatedUserId, authorityEpoch: candidate.authorityEpoch, previousRevision: prior.revision, revision: candidate.revision, occurredAt: trustedWitness.occurredAt, details: { transitionKind: value.commandKind, previousSessionState: prior.sessionState, nextSessionState: candidate.sessionState, previousEncounterRevision: prior.encounterState.revision, encounterRevision: candidate.encounterState.revision, eventCount: candidate.events.length } });
    const response = successWithEvents(candidate, value.requestId, [domainEvent.value, runtimeEvent]);
    candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind, fingerprint: fp, commandKind: value.commandKind, resultKind: TASK3_RESULT_KINDS[value.commandKind], resultRevision: candidate.revision, response });
    if (!pristineSession(candidate, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    const acceptedReread = (reread) => task3RereadMatches(reread, candidate, descriptor.sessionDocumentId, value.requestId, value.commandKind, context);
    try { await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, value.requestId, context, { successResponse: response, acceptedReread }); }
    return sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, value.requestId, context, { successResponse: response, acceptedReread });
  }), identities, { nonWinnerCode: "m11-control-transfer-required", nonWinnerPath: "authorityEpoch" });
}

function focusPayloadValid(payload) { return isPlainObject(payload) && exactKeys(payload, ["reactionId"]) && nonBlank(payload.reactionId); }
function focusParticipantAuthorized(auth, session, reactionId, context) {
  try {
    if (auth.user?.isGM === true && auth.authenticatedUserId === auth.activeGmUserId) return true;
    const authorityDecision = deriveProjectionAuthority(auth, session, context);
    return reactionParticipantForAuthority(session, authorityDecision, reactionId) !== null;
  } catch { return false; }
}
function validPendingFocusCheck(check, session) {
  try {
    return isPlainObject(check) && exactKeys(check, ["pendingCheckId", "targetPendingCheckId", "sequence", "status", "mode", "source", "approachId", "statisticSlugOrAbilityId", "finalDc", "momentumRollBonus", "secrecy", "reactionId", "focusAbilityId", "sourceStationId", "targetStationId", "executionStatus", "executionReceipt"])
      && nonBlank(check.pendingCheckId) && safeInteger(check.sequence) && check.status === "pending" && check.mode === "check"
      && isPlainObject(check.source) && exactKeys(check.source, ["kind", "uuid"]) && check.source.kind === "character" && nonBlank(check.source.uuid)
      && nonBlank(check.targetPendingCheckId) && nonBlank(check.approachId) && nonBlank(check.statisticSlugOrAbilityId) && safeInteger(check.finalDc) && safeInteger(check.momentumRollBonus)
      && ["public", "secret"].includes(check.secrecy) && nonBlank(check.reactionId) && nonBlank(check.focusAbilityId) && nonBlank(check.sourceStationId) && nonBlank(check.targetStationId)
      && ["executing", "captured"].includes(check.executionStatus)
      && (check.executionReceipt === null || (check.executionReceipt && validDurableFocusReceipt(check.executionReceipt, check)))
      && session.encounterState.pendingChecks.some((entry) => entry.pendingCheckId === check.targetPendingCheckId);
  } catch { return false; }
}
function validFocusPendingRecord(record, session, audit, event) {
  try {
    if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || record.commandKind !== FOCUS_PENDING_COMMAND_KIND || record.resultKind !== FOCUS_PENDING_RESULT_KIND
      || !["gm", "operator"].includes(record.projectionKind) || !safeInteger(record.resultRevision) || record.resultRevision < 1 || record.resultRevision > session.revision
      || !isPlainObject(record.response) || !audit || audit.kind !== FOCUS_PENDING_AUDIT_KIND || !event || event.type !== "voyage.m12-focus-reaction-committed") return false;
    const tuple = parseStoredFingerprint(record.fingerprint); if (!tuple.ok || tuple.value[0] !== session.sessionId || tuple.value[1] !== record.principalUserId || tuple.value[2] !== record.projectionKind
      || !safeInteger(tuple.value[3]) || !safeInteger(tuple.value[4]) || tuple.value[4] + 1 !== record.resultRevision || tuple.value[5] !== FOCUS_PENDING_COMMAND_KIND || !focusPayloadValid(tuple.value[6])) return false;
    const pending = session.encounterState.metadata?.focusPendingCheck;
    const reactionId = tuple.value[6].reactionId;
    const pendingMatches = pending?.reactionId === reactionId;
    const completed = Array.isArray(session.encounterState.metadata?.focusResults)
      && session.encounterState.metadata.focusResults.some((entry) => entry?.reactionId === reactionId)
      && Array.isArray(session.encounterState.metadata?.focusEffects)
      && session.encounterState.metadata.focusEffects.some((entry) => entry?.reactionId === reactionId);
    const passed = session.processedRequests.some((candidate) => {
      if (candidate?.commandKind !== "focus-reaction-pass" || candidate.resultRevision <= record.resultRevision) return false;
      const candidateFingerprint = parseStoredFingerprint(candidate.fingerprint);
      return candidateFingerprint.ok && candidateFingerprint.value[6]?.reactionId === reactionId
        && session.events.some((entry) => entry?.type === "voyage.m12-focus-reaction-pass"
          && entry.revision === candidate.resultRevision && entry.previousRevision === candidate.resultRevision - 1);
    });
    const pendingEvidenceValid = pending
      ? (pendingMatches ? validPendingFocusCheck(pending, session) : completed || passed)
      : completed || passed;
    const ok = pendingEvidenceValid
      && validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) && record.response.status === "station-resolution" && record.response.events.length === 1 && equal(record.response.events[0], event)
      && validM12RuntimeEvent(event, session) && exactKeys(audit, AUDIT_FIELDS) && audit.auditId === auditId(session.sessionId, session.auditHistory.indexOf(audit), audit.kind)
      && audit.sessionId === session.sessionId && audit.requestId === record.requestId && audit.actorUserId === record.principalUserId && audit.authorityEpoch === tuple.value[3]
      && audit.previousRevision === record.resultRevision - 1 && audit.revision === record.resultRevision && validIsoTimestamp(audit.occurredAt)
      && exactKeys(audit.details, M12_AUDIT_DETAILS_FIELDS) && audit.details.transitionKind === FOCUS_PENDING_COMMAND_KIND;
    if (!ok) return false;
    return true;
  } catch { return false; }
}
function validFocusRecord(record, session, audit, event) {
  try {
    if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !["gm", "operator"].includes(record.projectionKind) || !FOCUS_COMMANDS.has(record.commandKind)
      || record.resultKind !== FOCUS_RESULT_KINDS[record.commandKind] || !safeInteger(record.resultRevision) || record.resultRevision < 1 || record.resultRevision > session.revision
      || !isPlainObject(record.response) || !audit || audit.kind !== FOCUS_AUDIT_KINDS[record.commandKind] || !event || event.type !== `voyage.m12-${record.commandKind}`) return false;
    const tuple = parseStoredFingerprint(record.fingerprint); if (!tuple.ok || tuple.value[0] !== session.sessionId || tuple.value[1] !== record.principalUserId || tuple.value[2] !== record.projectionKind || !safeInteger(tuple.value[3]) || !safeInteger(tuple.value[4]) || ![tuple.value[4] + 1, tuple.value[4] + 2].includes(record.resultRevision) || tuple.value[5] !== record.commandKind || !focusPayloadValid(tuple.value[6])) return false;
    let focusEvidenceValid = true;
    if (record.commandKind === "focus-reaction-use") {
      const stored = session.encounterState.metadata?.focusResults?.find((entry) => entry.reactionId === tuple.value[6].reactionId);
      const effect = session.encounterState.metadata?.focusEffects?.find((entry) => entry.reactionId === tuple.value[6].reactionId);
      const binding = stored ? focusEvidenceBinding(stored, session.encounterState) : null;
      const effectBinding = effect ? focusEvidenceBinding(effect, session.encounterState) : null;
      focusEvidenceValid = Boolean(stored && effect && binding && effectBinding && equal(binding, effectBinding) && validStoredFocusResult(stored.result, binding, binding.ability) && validStoredFocusResult(effect.result, effectBinding, binding.ability) && effect.modifier === stored.modifier && stored.modifier === focusOutcomeModifier(binding.ability, stored.result.normalizedDegree));
    }
    const ok = focusEvidenceValid && validStoredResponse(record.response, record, session.sessionId, session.authorityEpoch) && record.response.status === "station-resolution" && record.response.authorityEpoch === tuple.value[3]
      && record.response.events.length === 1 && equal(record.response.events[0], event) && validM12RuntimeEvent(event, session)
      && exactKeys(audit, AUDIT_FIELDS) && audit.auditId === auditId(session.sessionId, session.auditHistory.indexOf(audit), audit.kind) && audit.sessionId === session.sessionId && audit.requestId === record.requestId && audit.actorUserId === record.principalUserId
      && audit.kind === FOCUS_AUDIT_KINDS[record.commandKind] && audit.revision === record.resultRevision && audit.previousRevision === record.resultRevision - 1 && safeInteger(audit.authorityEpoch) && audit.authorityEpoch === tuple.value[3] && validIsoTimestamp(audit.occurredAt)
      && exactKeys(audit.details, M12_AUDIT_DETAILS_FIELDS) && audit.details.transitionKind === record.commandKind && audit.details.previousSessionState === event.previousSessionState && audit.details.nextSessionState === event.nextSessionState
      && audit.details.previousEncounterRevision === event.previousEncounterRevision && audit.details.encounterRevision === event.encounterRevision && audit.details.eventCount === session.events.indexOf(event) + 1;
    return ok;
  } catch { return false; }
}

async function persistDurableFocusReceipt(document, value, descriptor, prior, pending, focusResult, normalizedDegree, context, identities) {
  try {
    const candidate = capture(prior).value;
    candidate.encounterState.metadata.focusPendingCheck.executionStatus = "captured";
    candidate.encounterState.metadata.focusPendingCheck.executionReceipt = { ...capture(focusResult).value, normalizedDegree };
    if (!pristineSession(candidate, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    try { await document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { /* reread below classifies persisted-then-thrown safely */ }
    const reread = resolveSessionDocument(value.sessionId, context);
    if (!reread.error && reread.match.documentId === descriptor.sessionDocumentId && pristineSession(reread.match.session, descriptor.sessionDocumentId, { replayContext: context })) {
      const stored = reread.match.session.encounterState.metadata?.focusPendingCheck;
      if (stored?.executionStatus === "captured" && validDurableFocusReceipt(stored.executionReceipt, stored)) return { ok: true, session: reread.match.session };
      if (equal(reread.match.session, prior)) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    }
    return failure([diagnostic("m11-recovery-required", "recovery")], identities);
  } catch { return failure([diagnostic("m11-recovery-required", "recovery")], identities); }
}

async function completePersistedFocusUse(value, identities, descriptor, auth, pendingSession, context, trustedWitness, { allowExecution = false, projectionKind = "gm" } = {}) {
  try {
    let pending = pendingSession.encounterState.metadata?.focusPendingCheck;
    const focus = focusMetadata(pendingSession.encounterState, context);
    const ability = focus?.abilities.find((entry) => entry.focusAbilityId === pending?.focusAbilityId);
    if (!pending || !ability || !trustedWitness?.occurredAt) return failure([diagnostic("m11-command-payload-invalid", "focusResult")], identities);
    const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
    const executor = m10Function(context, "executeVoyagePf2eFocusCheck", m10Function(context, "executeVoyagePf2ePendingCheck", null));
    if (typeof executor !== "function") return failure([diagnostic("m11-command-not-allowed", "transport")], identities);
    let focusResult = pending.executionStatus === "captured" && pending.executionReceipt
      ? capture(pending.executionReceipt).value
      : null;
    if (!focusResult && allowExecution && pending.executionStatus === "executing") {
      try { focusResult = await executor(capture(pending).value); } catch { focusResult = null; }
    }
    if (!focusResult && pending.executionStatus === "executing" && !allowExecution) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    if (!validFocusResult(focusResult, pending)) return failure([diagnostic("m11-command-payload-invalid", "focusResult")], identities);
    const rawDegree = focusResult.result?.degreeOfSuccessSlug ?? focusResult.result?.degreeOfSuccess;
    const degree = normalizeFocusDegree(rawDegree);
    const modifier = focusOutcomeModifier(ability, degree); if (modifier === null) return failure([diagnostic("m11-command-payload-invalid", "focusResult")], identities);
    let prior = resolved.match.session;
    if (resolved.match.documentId !== descriptor.sessionDocumentId || !pristineSession(prior, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const currentPending = prior.encounterState.metadata?.focusPendingCheck;
    if (!currentPending || !equal(currentPending, pending)) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (pending.executionStatus === "captured" && !validDurableFocusReceipt(focusResult, pending)) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    if (pending.executionStatus !== "captured") {
      const receiptPersisted = await persistDurableFocusReceipt(resolved.match.document, value, descriptor, prior, pending, focusResult, degree, context, identities);
      if (!receiptPersisted?.ok) return receiptPersisted;
      prior = receiptPersisted.session;
      pending = prior.encounterState.metadata?.focusPendingCheck;
    }
    const candidate = capture(prior).value;
    const metadata = candidate.encounterState.metadata;
    metadata.focusPendingCheck = null;
    const window = metadata.reactionWindow;
    const resolvedIds = [...(window?.resolved ?? []), pending.reactionId];
    const remaining = window?.opportunities?.some((entry) => !resolvedIds.includes(entry.reactionId)) ?? false;
    metadata.reactionWindow = window ? { ...window, status: remaining ? "open" : "closed", resolved: resolvedIds, committed: (window.committed ?? []).filter((id) => id !== pending.reactionId), result: { reactionId: pending.reactionId, focusAbilityId: pending.focusAbilityId, stationId: pending.sourceStationId, targetStationId: pending.targetStationId, targetPendingCheckId: pending.targetPendingCheckId, modifier, result: capture(focusResult).value } } : null;
    metadata.focusResults = Array.isArray(metadata.focusResults) ? metadata.focusResults : [];
    metadata.focusResults.push({ reactionId: pending.reactionId, pendingCheckId: pending.pendingCheckId, targetPendingCheckId: pending.targetPendingCheckId, focusAbilityId: pending.focusAbilityId, sourceStationId: pending.sourceStationId, sourceOperatorId: pending.source.uuid, targetStationId: pending.targetStationId, modifier, result: { ...capture(focusResult).value, normalizedDegree: degree } });
    metadata.focusEffects = Array.isArray(metadata.focusEffects) ? metadata.focusEffects : [];
    metadata.focusEffects.push({ reactionId: pending.reactionId, pendingCheckId: pending.pendingCheckId, focusAbilityId: pending.focusAbilityId, sourceStationId: pending.sourceStationId, sourceOperatorId: pending.source.uuid, targetStationId: pending.targetStationId, targetPendingCheckId: pending.targetPendingCheckId, modifier, result: { ...capture(focusResult).value, normalizedDegree: degree } });
    candidate.revision = prior.revision + 1; candidate.encounterState.revision = prior.encounterState.revision + 1;
    const runtimeEvent = { type: "voyage.m12-focus-reaction-use", sessionId: candidate.sessionId, eventId: candidate.eventId, definitionSnapshotId: candidate.definitionSnapshotId, shipId: candidate.shipId, transitionKind: "focus-reaction-use", previousSessionState: prior.sessionState, nextSessionState: prior.sessionState, previousEncounterRevision: prior.encounterState.revision, encounterRevision: candidate.encounterState.revision, previousRevision: prior.revision, revision: candidate.revision };
    candidate.events.push(runtimeEvent);
    const audit = { auditId: auditId(candidate.sessionId, candidate.auditHistory.length, FOCUS_AUDIT_KINDS["focus-reaction-use"]), kind: FOCUS_AUDIT_KINDS["focus-reaction-use"], sessionId: candidate.sessionId, requestId: value.requestId, actorUserId: auth.authenticatedUserId, authorityEpoch: candidate.authorityEpoch, previousRevision: prior.revision, revision: candidate.revision, occurredAt: trustedWitness.occurredAt, details: { transitionKind: "focus-reaction-use", previousSessionState: prior.sessionState, nextSessionState: prior.sessionState, previousEncounterRevision: prior.encounterState.revision, encounterRevision: candidate.encounterState.revision, eventCount: candidate.events.length } };
    candidate.auditHistory.push(audit);
    const fp = fingerprint(value.sessionId, auth.authenticatedUserId, projectionKind, value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload);
    const response = successWithEvents(candidate, value.requestId, [runtimeEvent]);
    candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind, fingerprint: fp, commandKind: value.commandKind, resultKind: FOCUS_RESULT_KINDS[value.commandKind], resultRevision: candidate.revision, response });
    if (!pristineSession(candidate, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    try { await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch {
      return sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, value.requestId, context, { successResponse: response });
    }
    return sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, value.requestId, context, { successResponse: response });
  } catch { return failure([diagnostic("m11-command-payload-invalid", "focusResult")], identities); }
}

async function dispatchFocusReactionCommand(value, identities, initialAuth, initialMatch, context) {
  const descriptor = coordinatorDescriptor(value, initialMatch.documentId, initialAuth, context);
  if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  return runExclusiveSessionMutation(context, descriptor, async (trustedWitness) => withTransferLock(value.sessionId, async () => {
    const auth = authenticatedContext(context);
    if (auth.error || !coordinatorIdentityMatches(auth, descriptor, context)) return failure([auth.error ?? diagnostic("m11-authentication-required", "transport.user")], identities);
    const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
    const prior = resolved.match.session;
    if (resolved.match.documentId !== descriptor.sessionDocumentId || !pristineSession(prior, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const isGm = auth.user?.isGM === true && auth.authenticatedUserId === auth.activeGmUserId;
    const projectionKind = isGm ? "gm" : deriveProjectionKind(auth, prior, context);
    if (!isGm && (projectionKind !== "operator" || !focusParticipantAuthorized(auth, prior, value.payload.reactionId, context))) return failure([diagnostic("m11-projection-not-authorized", "request.payload.reactionId")], identities);
    const fp = fingerprint(value.sessionId, auth.authenticatedUserId, projectionKind, value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload);
    const replay = replayOrConflict(prior.processedRequests, value.requestId, auth.authenticatedUserId, projectionKind, fp, identities); if (replay) return replay;
    const existingPending = prior.encounterState.metadata?.focusPendingCheck;
    if (value.commandKind === "focus-reaction-use" && existingPending?.reactionId === value.payload.reactionId) {
      if (value.authorityEpoch !== prior.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
      if (value.expectedRevision !== prior.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
      return completePersistedFocusUse(value, identities, descriptor, auth, prior, context, trustedWitness, { projectionKind });
    }
    if (prior.sessionState !== "station-resolution" || prior.encounterState.phase !== "resolution" || value.authorityEpoch !== prior.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.expectedRevision !== prior.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    const window = prior.encounterState.metadata?.reactionWindow;
    if (!isPlainObject(window) || window.status !== "open" || !Array.isArray(window.opportunities)) return failure([diagnostic("m11-command-not-allowed", "reactionWindow")], identities);
    const opportunity = window.opportunities.find((entry) => entry.reactionId === value.payload.reactionId);
    if (!opportunity || window.resolved?.includes(opportunity.reactionId)) return failure([diagnostic("m11-command-not-allowed", "request.payload.reactionId")], identities);
    const focus = focusMetadata(prior.encounterState, context); const pool = focus?.pools.find((entry) => entry.stationId === opportunity.stationId && entry.operatorId === opportunity.operatorId);
    if (!focus || !pool || (value.commandKind === "focus-reaction-use" && pool.current < 1)) return failure([diagnostic("m11-command-not-allowed", "reactionWindow")], identities);
    if (value.commandKind === "focus-reaction-use") {
      const ability = focus.abilities.find((entry) => entry.focusAbilityId === opportunity.focusAbilityId);
      if (!ability || !trustedWitness?.occurredAt || opportunity.targetPendingCheckId === null) return failure([diagnostic("m11-command-payload-invalid", "reactionWindow")], identities);
      const targetPending = prior.encounterState.pendingChecks.find((entry) => entry.pendingCheckId === opportunity.targetPendingCheckId && entry.status === "pending");
      if (!targetPending) return failure([diagnostic("m11-command-not-allowed", "reactionWindow")], identities);
      const candidate = capture(prior).value, metadata = candidate.encounterState.metadata;
      metadata.focusPools = metadata.focusPools.map((entry) => entry.stationId === pool.stationId && entry.operatorId === pool.operatorId ? { ...entry, current: entry.current - 1 } : entry);
      metadata.focusPendingCheck = { pendingCheckId: `arcflight-focus-check:${JSON.stringify([value.sessionId, prior.revision + 1, opportunity.reactionId])}`, targetPendingCheckId: targetPending.pendingCheckId, sequence: 0, status: "pending", mode: "check", source: { kind: "character", uuid: opportunity.operatorId }, approachId: ability.focusAbilityId, statisticSlugOrAbilityId: ability.statisticSlugOrAbilityId, finalDc: ability.dc, momentumRollBonus: prior.encounterState.momentum, secrecy: ability.secrecy, reactionId: opportunity.reactionId, focusAbilityId: ability.focusAbilityId, sourceStationId: opportunity.stationId, targetStationId: opportunity.targetStationId, executionStatus: "executing", executionReceipt: null };
      metadata.reactionWindow = { ...window, status: "open", committed: [...(window.committed ?? []), opportunity.reactionId] };
      candidate.revision = prior.revision + 1; candidate.encounterState.revision = prior.encounterState.revision + 1;
      const pendingEvent = { type: "voyage.m12-focus-reaction-committed", sessionId: candidate.sessionId, eventId: candidate.eventId, definitionSnapshotId: candidate.definitionSnapshotId, shipId: candidate.shipId, transitionKind: "focus-reaction-committed", previousSessionState: prior.sessionState, nextSessionState: prior.sessionState, previousEncounterRevision: prior.encounterState.revision, encounterRevision: candidate.encounterState.revision, previousRevision: prior.revision, revision: candidate.revision };
      candidate.events.push(pendingEvent);
      candidate.auditHistory.push({ auditId: auditId(candidate.sessionId, candidate.auditHistory.length, FOCUS_PENDING_AUDIT_KIND), kind: FOCUS_PENDING_AUDIT_KIND, sessionId: candidate.sessionId, requestId: `${value.requestId}:pending`, actorUserId: auth.authenticatedUserId, authorityEpoch: candidate.authorityEpoch, previousRevision: prior.revision, revision: candidate.revision, occurredAt: trustedWitness.occurredAt, details: { transitionKind: FOCUS_PENDING_COMMAND_KIND, previousSessionState: prior.sessionState, nextSessionState: prior.sessionState, previousEncounterRevision: prior.encounterState.revision, encounterRevision: candidate.encounterState.revision, eventCount: candidate.events.length } });
      const pendingRequestId = `${value.requestId}:pending`;
      const pendingFingerprint = fingerprint(value.sessionId, auth.authenticatedUserId, projectionKind, value.authorityEpoch, value.expectedRevision, FOCUS_PENDING_COMMAND_KIND, { reactionId: value.payload.reactionId });
      const pendingResponse = successWithEvents(candidate, pendingRequestId, [pendingEvent]);
      candidate.processedRequests.push({ requestId: pendingRequestId, principalUserId: auth.authenticatedUserId, projectionKind, fingerprint: pendingFingerprint, commandKind: FOCUS_PENDING_COMMAND_KIND, resultKind: FOCUS_PENDING_RESULT_KIND, resultRevision: candidate.revision, response: pendingResponse });
      if (!pristineSession(candidate, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
      let pendingWrite; try { pendingWrite = await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { const classified = sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, pendingRequestId, context, { successResponse: pendingResponse }); if (!classified.ok) return classified; }
      if (pendingWrite !== undefined) { const classified = sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, pendingRequestId, context, { successResponse: pendingResponse }); if (!classified.ok) return classified; }
      const refreshed = resolveSessionDocument(value.sessionId, context); if (refreshed.error) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
      return completePersistedFocusUse(value, identities, descriptor, auth, refreshed.match.session, context, trustedWitness, { allowExecution: true, projectionKind });
    }
    let focusResult = null, modifier = 0;
    if (value.commandKind === "focus-reaction-use") {
      const ability = focus.abilities.find((entry) => entry.focusAbilityId === opportunity.focusAbilityId); if (!ability || !trustedWitness?.occurredAt) return failure([diagnostic("m11-command-payload-invalid", "reactionWindow")], identities);
      const executor = m10Function(context, "executeVoyagePf2eFocusCheck", m10Function(context, "executeVoyagePf2ePendingCheck", null));
      if (typeof executor !== "function") return failure([diagnostic("m11-command-not-allowed", "transport")], identities);
      const focusPendingCheck = {
        pendingCheckId: opportunity.reactionId,
        sequence: 0,
        status: "pending",
        mode: "check",
        source: { kind: "character", uuid: opportunity.operatorId },
        approachId: ability.focusAbilityId,
        statisticSlugOrAbilityId: ability.statisticSlugOrAbilityId,
        finalDc: ability.dc,
        momentumRollBonus: prior.encounterState.momentum,
        secrecy: ability.secrecy ?? "public"
      };
      try { focusResult = capture(await executor(focusPendingCheck)).value; } catch { focusResult = null; }
      if (!validFocusResult(focusResult, focusPendingCheck)) return failure([diagnostic("m11-command-payload-invalid", "focusResult")], identities);
      const rawDegree = focusResult.result?.degreeOfSuccessSlug ?? focusResult.degreeOfSuccessSlug ?? focusResult.result?.degreeOfSuccess;
      const degree = normalizeFocusDegree(rawDegree); modifier = focusOutcomeModifier(ability, degree); if (modifier === null) return failure([diagnostic("m11-command-payload-invalid", "focusResult")], identities);
    }
    const candidate = capture(prior).value; const metadata = candidate.encounterState.metadata;
    const terminalPending = existingPending?.reactionId === opportunity.reactionId;
    if (value.commandKind === "focus-reaction-pass" && terminalPending) metadata.focusPendingCheck = null;
    metadata.focusPools = metadata.focusPools.map((entry) => entry.stationId === pool.stationId && entry.operatorId === pool.operatorId ? { ...entry, current: value.commandKind === "focus-reaction-use" ? entry.current - 1 : entry.current } : entry);
    const resolvedIds = [...(window.resolved ?? []), opportunity.reactionId];
    const remaining = window.opportunities.some((entry) => !resolvedIds.includes(entry.reactionId));
    metadata.reactionWindow = { ...window, status: remaining ? "open" : "closed", resolved: resolvedIds, committed: terminalPending ? (window.committed ?? []).filter((id) => id !== opportunity.reactionId) : (window.committed ?? []), result: value.commandKind === "focus-reaction-use" ? { reactionId: opportunity.reactionId, focusAbilityId: opportunity.focusAbilityId, stationId: opportunity.stationId, targetStationId: opportunity.targetStationId, modifier, result: focusResult.result ?? focusResult, focusSpent: 1 } : null };
    metadata.focusEffects = Array.isArray(metadata.focusEffects) ? metadata.focusEffects : [];
    if (value.commandKind === "focus-reaction-use") metadata.focusEffects.push({ reactionId: opportunity.reactionId, targetStationId: opportunity.targetStationId, modifier });
    const revision = prior.revision + 1; candidate.revision = revision; candidate.encounterState.revision = prior.encounterState.revision + 1;
    const runtimeEvent = { type: `voyage.m12-${value.commandKind}`, sessionId: candidate.sessionId, eventId: candidate.eventId, definitionSnapshotId: candidate.definitionSnapshotId, shipId: candidate.shipId, transitionKind: value.commandKind, previousSessionState: prior.sessionState, nextSessionState: prior.sessionState, previousEncounterRevision: prior.encounterState.revision, encounterRevision: candidate.encounterState.revision, previousRevision: prior.revision, revision };
    candidate.events.push(runtimeEvent);
    candidate.auditHistory.push({ auditId: auditId(candidate.sessionId, candidate.auditHistory.length, FOCUS_AUDIT_KINDS[value.commandKind]), kind: FOCUS_AUDIT_KINDS[value.commandKind], sessionId: candidate.sessionId, requestId: value.requestId, actorUserId: auth.authenticatedUserId, authorityEpoch: candidate.authorityEpoch, previousRevision: prior.revision, revision, occurredAt: trustedWitness.occurredAt, details: { transitionKind: value.commandKind, previousSessionState: prior.sessionState, nextSessionState: prior.sessionState, previousEncounterRevision: prior.encounterState.revision, encounterRevision: candidate.encounterState.revision, eventCount: candidate.events.length } });
    const response = successWithEvents(candidate, value.requestId, [runtimeEvent]);
    candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind, fingerprint: fp, commandKind: value.commandKind, resultKind: FOCUS_RESULT_KINDS[value.commandKind], resultRevision: revision, response });
    if (!pristineSession(candidate, descriptor.sessionDocumentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    try { await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, value.requestId, context, { successResponse: response }); }
    return sessionWriteClassification(resolved.match.document, value.sessionId, descriptor.sessionDocumentId, candidate, prior, value.requestId, context, { successResponse: response });
  }), identities, { nonWinnerCode: "m11-control-transfer-required", nonWinnerPath: "authorityEpoch" });
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

// Pure trusted boundary for the GM abandon control. It changes only the
// encounter evidence; the existing audited M11 abort path performs the sole
// JournalEntry write and never mutates an Actor or ship document.
export function applyVoyageEncounterAbortTransition(state, request = {}) {
  try {
    const captured = capture(state); if (!captured.ok || !isPlainObject(captured.value)) return { ok: false, nextState: null, events: [], errors: [], warnings: [], persistentConsequence: null };
    const prior = captured.value;
    if (!["active", "paused"].includes(prior.lifecycleState) || request.abortScope !== "active-event") return { ok: false, nextState: null, events: [], errors: [], warnings: [], persistentConsequence: null };
    const nextState = capture(prior).value;
    nextState.lifecycleState = "abandoned";
    nextState.phase = null;
    nextState.revision = prior.revision + 1;
    const event = { type: "voyage.lifecycle-transitioned", encounterId: prior.encounterId, fromLifecycleState: prior.lifecycleState, toLifecycleState: "abandoned", previousRevision: prior.revision, revision: nextState.revision };
    return { ok: true, nextState, events: [event], errors: [], warnings: [], persistentConsequence: null };
  } catch { return { ok: false, nextState: null, events: [], errors: [], warnings: [], persistentConsequence: null }; }
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

async function buildSliceICorrectionCandidate(prior, value, auth, trustedWitness, context) {
  try {
    const kind = value.correctionKind;
    if (!SLICE_I_CORRECTION_KINDS.includes(kind) || prior.sessionState !== "station-resolution" || prior.encounterState.lifecycleState !== "active" || prior.encounterState.phase !== "resolution") return null;
    if (!validSliceIPayload(kind, value.replacementPayload)) return null;
    const currentStation = sliceICurrentStation(prior);
    const payload = value.replacementPayload;
    const candidate = capture(prior); if (!candidate.ok) return null;
    const next = candidate.value, previousEncounterRevision = prior.encounterState.revision;
    let stationId = null, pendingCheckId = null, before = null, after = null;
    if (kind === "remaining-order") {
      const committedOrder = prior.encounterState.committedStationOrder;
      if (!currentStation || !Array.isArray(committedOrder) || payload.stationOrder.length !== committedOrder.length || new Set(payload.stationOrder).size !== payload.stationOrder.length || new Set(payload.stationOrder).size !== new Set(committedOrder).size || payload.stationOrder.some((stationId) => !committedOrder.includes(stationId))) return null;
      const resolvedPrefix = prior.encounterState.committedStationOrder.filter((id) => !prior.encounterState.pendingChecks.some((check) => check.stationId === id && check.status === "pending"));
      if (resolvedPrefix.some((id, index) => payload.stationOrder[index] !== id) || !payload.stationOrder.includes(currentStation)) return null;
      before = capture(prior.encounterState.committedStationOrder).value; next.encounterState.committedStationOrder = [...payload.stationOrder]; after = capture(next.encounterState.committedStationOrder).value;
    } else if (kind === "operator-takeover") {
      if (!currentStation || payload.stationId !== currentStation) return null;
      const eligibility = sliceIOperatorTakeoverEligibility(prior, currentStation, context);
      if (!eligibility.ok) return null;
      const assignment = prior.encounterState.stationAssignments?.find((entry) => entry?.stationId === currentStation);
      const operatorId = assignment?.operator?.id ?? assignment?.operator?.uuid ?? null; if (!nonBlank(operatorId)) return null;
      stationId = currentStation; before = capture(next.encounterState.metadata?.recoveryControl ?? null).value;
      next.encounterState.metadata.recoveryControl = { kind: "operator-takeover", stationId: currentStation, operatorId, controllerUserId: auth.activeGmUserId };
      after = capture(next.encounterState.metadata.recoveryControl).value;
    } else {
      const check = prior.encounterState.pendingChecks?.find((entry) => entry?.pendingCheckId === payload.pendingCheckId);
      const existingHistory = Array.isArray(prior.encounterState.metadata?.sliceIRecovery)
        ? prior.encounterState.metadata.sliceIRecovery.find((entry) => entry?.kind === "void-roll" && entry.originalPendingCheckId === payload.pendingCheckId && nonBlank(entry.replacementPendingCheckId))
        : null;
      const replacementCheck = existingHistory?.replacementPendingCheckId
        ? prior.encounterState.pendingChecks?.find((entry) => entry?.pendingCheckId === existingHistory.replacementPendingCheckId)
        : null;
      const source = kind === "retry-roll-integration" && existingHistory?.evidence
        ? (replacementCheck ?? existingHistory.evidence)
        : check;
      const sourceStation = source?.stationId ?? null;
      if (!source || !nonBlank(sourceStation) || (kind === "retry-roll-integration" ? !existingHistory : !currentStation || sourceStation !== currentStation)) return null;
      stationId = sourceStation; pendingCheckId = payload.pendingCheckId;
      before = kind === "retry-roll-integration" && existingHistory ? capture(existingHistory.evidence).value : capture(source).value;
      const integrationStatus = source.integrationStatus ?? next.encounterState.metadata?.pendingCheckIntegrationStatus;
      if (kind === "retry-roll-integration") {
        if (!existingHistory || !["failed", "uncertain", "recovery-required", "invalid", "erroneous", "voidable"].includes(integrationStatus)) return null;
        const replacement = capture(source).value;
        replacement.pendingCheckId = `arcflight-pending-check:recovery:${JSON.stringify([prior.sessionId, prior.revision + 1, source.pendingCheckId, kind])}`;
        replacement.preparedRevision = prior.encounterState.revision + 1; replacement.status = "pending"; replacement.result = null;
        const index = next.encounterState.pendingChecks.findIndex((entry) => entry?.pendingCheckId === source.pendingCheckId); if (index < 0) return null;
        next.encounterState.pendingChecks[index] = replacement;
        next.encounterState.metadata.sliceIRecovery = Array.isArray(next.encounterState.metadata.sliceIRecovery) ? next.encounterState.metadata.sliceIRecovery : [];
        next.encounterState.metadata.sliceIRecovery.push({ kind, originalPendingCheckId: existingHistory.originalPendingCheckId, replacementPendingCheckId: replacement.pendingCheckId, evidence: capture(existingHistory.evidence).value });
        after = capture(replacement).value;
      } else {
        if (!check || check.status !== "pending" || existingHistory || !["invalid", "erroneous", "voidable", "failed", "uncertain"].includes(integrationStatus)) return null;
        const replacement = capture(check).value;
        replacement.pendingCheckId = `arcflight-pending-check:recovery:${JSON.stringify([prior.sessionId, prior.revision + 1, check.pendingCheckId, kind])}`;
        replacement.preparedRevision = prior.encounterState.revision + 1; replacement.status = "pending"; replacement.result = null;
        const index = next.encounterState.pendingChecks.findIndex((entry) => entry?.pendingCheckId === check.pendingCheckId); if (index < 0) return null;
        next.encounterState.pendingChecks[index] = replacement;
        next.encounterState.metadata.sliceIRecovery = Array.isArray(next.encounterState.metadata.sliceIRecovery) ? next.encounterState.metadata.sliceIRecovery : [];
        next.encounterState.metadata.sliceIRecovery.push({ kind, originalPendingCheckId: check.pendingCheckId, replacementPendingCheckId: replacement.pendingCheckId, evidence: before });
        after = capture(replacement).value;
      }
    }
    if (kind === "remaining-order") {
      const stationReport = validateVoyageEncounterStationOrder(next.encounterState);
      const resolutionReport = analyzeVoyageEncounterResolutionOrder(next.encounterState);
      if (stationReport.valid !== true || resolutionReport.valid !== true) return null;
    }
    next.revision = prior.revision + 1; next.encounterState.revision = previousEncounterRevision + 1;
    if (!validEncounterState(next.encounterState, prior) || !trustedWitness?.occurredAt) return null;
    const runtimeEvent = task7CorrectionEvent(next, value, auth, prior.revision, next.revision, previousEncounterRevision, next.encounterState.revision);
    next.events.push(runtimeEvent);
    const audit = { auditId: auditId(next.sessionId, next.auditHistory.length, "correction-applied"), kind: "correction-applied", sessionId: next.sessionId, requestId: value.requestId, actorUserId: auth.authenticatedUserId, authorityEpoch: next.authorityEpoch, previousRevision: prior.revision, revision: next.revision, occurredAt: trustedWitness.occurredAt, details: { correctionKind: kind, targetRequestId: null, previousSessionState: prior.sessionState, nextSessionState: next.sessionState, previousEncounterRevision, encounterRevision: next.encounterState.revision, reason: value.reason, stationId, pendingCheckId, before, after } };
    next.auditHistory.push(audit);
    const response = successWithEvents(next, value.requestId, [runtimeEvent]);
    const payloadForFingerprint = { correctionKind: kind, targetRequestId: null, targetCheckpointId: null, replacementPayload: capture(payload).value, reason: value.reason, confirmation: true };
    const fp = fingerprint(next.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, prior.revision, "correct-session", payloadForFingerprint);
    next.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind: "gm", fingerprint: fp, commandKind: "correct-session", resultKind: "corrected", resultRevision: next.revision, response });
    return { candidate: next, response };
  } catch { return null; }
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
    const acceptedReread = (reread) => task7AbortRereadMatches(reread, candidate, resolved.match.documentId, value.requestId, context);
    try { await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(resolved.match.document, value.sessionId, resolved.match.documentId, candidate, prior, value.requestId, context, { successResponse: response, acceptedReread }); }
    return sessionWriteClassification(resolved.match.document, value.sessionId, resolved.match.documentId, candidate, prior, value.requestId, context, { successResponse: response, acceptedReread });
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
    if (!["station-selection", "station-order", "plan-unlock", ...SLICE_I_CORRECTION_KINDS].includes(value.correctionKind)) return failure([diagnostic("m11-command-payload-invalid", "correctionKind")], identities);
    if (value.targetRequestId !== null || value.targetCheckpointId !== null || !nonBlank(value.reason) || containsForbiddenPayloadAuthority(value.replacementPayload)) return failure([diagnostic("m11-command-payload-invalid", "replacementPayload")], identities);
    if (SLICE_I_CORRECTION_KINDS.includes(value.correctionKind) && !SLICE_I_EXECUTABLE_CORRECTION_KINDS.has(value.correctionKind)) return failure([diagnostic("m11-command-not-allowed", "correctionKind")], identities);
    if (SLICE_I_CORRECTION_KINDS.includes(value.correctionKind)) {
      const built = await buildSliceICorrectionCandidate(prior, value, auth, trustedWitness, context);
      if (!built) return failure([diagnostic(prior.sessionState !== "station-resolution" ? "m11-command-not-allowed" : "m11-correction-invalid", "replacementPayload")], identities);
      if (!pristineSession(built.candidate, resolved.match.documentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
      try { await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: built.candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(resolved.match.document, value.sessionId, resolved.match.documentId, built.candidate, prior, value.requestId, context, { successResponse: built.response }); }
      return sessionWriteClassification(resolved.match.document, value.sessionId, resolved.match.documentId, built.candidate, prior, value.requestId, context, { successResponse: built.response });
    }
    const unlock = value.correctionKind === "plan-unlock";
    if (unlock) {
      if (prior.sessionState !== "plan-locked" || prior.encounterState.lifecycleState !== "active" || prior.encounterState.phase !== "lock-readiness") return failure([diagnostic("m11-command-not-allowed", "request.kind")], identities);
    } else if (prior.sessionState !== "crew-planning" || prior.encounterState.lifecycleState !== "active" || prior.encounterState.phase !== "crew-planning" || prior.checkpoints.some((checkpoint) => checkpoint.kind === "before-plan-lock")) return failure([diagnostic("m11-command-not-allowed", "request.kind")], identities);
    const fields = unlock ? [] : value.correctionKind === "station-selection" ? ["stationId", "actionId"] : ["stationOrder"];
    if (!exactKeys(value.replacementPayload, fields)) return failure([diagnostic("m11-command-payload-invalid", "replacementPayload")], identities);
    if (unlock) {
      if (containsForbiddenPayloadAuthority(value.replacementPayload)) return failure([diagnostic("m11-command-payload-invalid", "replacementPayload")], identities);
      if (!Array.isArray(prior.encounterState.committedStationOrder) || prior.encounterState.committedStationOrder.length === 0) return failure([diagnostic("m11-command-not-allowed", "request.kind")], identities);
      const candidate = capture(prior).value, previousRevision = prior.revision, revision = previousRevision + 1;
      candidate.revision = revision;
      candidate.sessionState = "crew-planning";
      candidate.encounterState.lifecycleState = "active";
      candidate.encounterState.phase = "crew-planning";
      candidate.encounterState.proposedStationOrder = [...prior.encounterState.committedStationOrder];
      candidate.encounterState.committedStationOrder = [];
      candidate.encounterState.revision = prior.encounterState.revision + 1;
      if (!validEncounterState(candidate.encounterState, prior)) return failure([diagnostic("m11-correction-invalid", "replacementPayload")], identities);
      if (!trustedWitness?.occurredAt) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
      const runtimeEvent = task7CorrectionEvent(candidate, value, auth, previousRevision, revision, prior.encounterState.revision, candidate.encounterState.revision);
      candidate.events.push(runtimeEvent);
      candidate.auditHistory.push({ auditId: auditId(candidate.sessionId, candidate.auditHistory.length, "correction-applied"), kind: "correction-applied", sessionId: candidate.sessionId, requestId: value.requestId, actorUserId: auth.authenticatedUserId, authorityEpoch: candidate.authorityEpoch, previousRevision, revision, occurredAt: trustedWitness.occurredAt, details: { correctionKind: value.correctionKind, targetRequestId: null, previousSessionState: prior.sessionState, nextSessionState: candidate.sessionState, previousEncounterRevision: prior.encounterState.revision, encounterRevision: candidate.encounterState.revision, reason: value.reason } });
      const response = successWithEvents(candidate, value.requestId, [runtimeEvent]);
      candidate.processedRequests.push({ requestId: value.requestId, principalUserId: auth.authenticatedUserId, projectionKind: "gm", fingerprint: fp, commandKind: "correct-session", resultKind: "corrected", resultRevision: revision, response });
      if (!pristineSession(candidate, resolved.match.documentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
      try { await resolved.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(resolved.match.document, value.sessionId, resolved.match.documentId, candidate, prior, value.requestId, context, { successResponse: response }); }
      return sessionWriteClassification(resolved.match.document, value.sessionId, resolved.match.documentId, candidate, prior, value.requestId, context, { successResponse: response });
    }
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
    return collectionUnchanged(before.documents, reread.documents) && !reread.documents.some((entry) => readDocumentSession(entry, context).sessionId === value.sessionId)
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
  if (FOCUS_COMMANDS.has(value.commandKind) && (auth.trustedTransportContext !== true || !nonBlank(auth.authenticatedConnectionId))) return failure([diagnostic("m11-authentication-required", "transport.user")], identities);
  const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
  const match = resolved.match; if (!pristineSession(match.session, match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  if (match.session.activeGmUserId !== auth.activeGmUserId) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  const projectionKind = deriveProjectionKind(auth, match.session, context);
  const requestFingerprint = fingerprint(value.sessionId, auth.authenticatedUserId, projectionKind, value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload);
  const replay = replayOrConflict(match.session.processedRequests, value.requestId, auth.authenticatedUserId, projectionKind, requestFingerprint, identities); if (replay) return replay;
  if (value.authorityEpoch !== match.session.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  if (value.expectedRevision !== match.session.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
  if (!COMMAND_KINDS.has(value.commandKind)) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
  const trustedResolutionExecution = value.commandKind === "action-segment" && context?.__trustedResolutionExecution === true;
  if (value.commandKind !== "closeout-review" && !trustedResolutionExecution && containsForbiddenPayloadAuthority(value.payload)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
  if (TASK2_COMMANDS.has(value.commandKind)) {
    if (auth.user?.isGM !== true && !operatorAllowedCommand(value.commandKind)) return failure([diagnostic("m11-active-gm-required", "transport.activeGm")], identities);
    if (!task2PayloadValid(value.commandKind, value.payload)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
    if (auth.user?.isGM !== true) {
      const authorityDecision = deriveProjectionAuthority(auth, match.session, context);
      const authorizedOrder = value.commandKind === "station-order"
        ? authorityDecision.ownedOperators.length > 0
        : authorityDecision.ownedOperators.some((entry) => entry.stationId === value.payload.stationId);
      if (authorityDecision.role !== "operator" || !authorizedOrder) return failure([diagnostic("m11-projection-not-authorized", value.commandKind === "station-order" ? "request.payload.stationOrder" : "request.payload.stationId")], identities);
    }
    return dispatchTask2Command(value, identities, auth, match, context);
  }
  if (TASK3_COMMANDS.has(value.commandKind)) {
    const trustedPlayerExecution = value.commandKind === "action-segment" && context?.__trustedResolutionOperator === true && context?.__executePendingCheck === true;
    const trustedExecution = value.commandKind === "action-segment" && context?.__trustedResolutionExecution === true && context?.__executePendingCheck === true;
    if (!trustedPlayerExecution && (auth.user?.isGM !== true || auth.authenticatedUserId !== auth.activeGmUserId)) return failure([diagnostic("m11-active-gm-required", "transport.activeGm")], identities);
    const internalExecutionPayload = trustedExecution && exactKeys(value.payload, []);
    if (!task3PayloadValid(value.commandKind, value.payload) && !internalExecutionPayload) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
    return dispatchTask3Command(value, identities, auth, match, context);
  }
  if (FOCUS_COMMANDS.has(value.commandKind)) {
    if (!focusPayloadValid(value.payload)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
    if (!focusParticipantAuthorized(auth, match.session, value.payload.reactionId, context)) return failure([diagnostic("m11-projection-not-authorized", "request.payload.reactionId")], identities);
    return dispatchFocusReactionCommand(value, identities, auth, match, context);
  }
  if (value.commandKind === "round-closeout") {
    if (auth.user?.isGM !== true || auth.authenticatedUserId !== auth.activeGmUserId) return failure([diagnostic("m11-active-gm-required", "transport.activeGm")], identities);
    if (!exactKeys(value.payload, ["roundId"]) || !nonBlank(value.payload.roundId)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
    return dispatchRoundCloseoutCommand(value, identities, auth, match, context);
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

/**
 * Slice A read boundary.  This deliberately leaves the accepted M11 common
 * projection untouched and adds only trusted role/ownership decisions.
 */
export function readVoyageEventSessionMultiplayerProjection(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = requestIdentities(value);
  if (!exactKeys(value, READ_PROJECTION_FIELDS)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  if (value.kind !== "voyage.m12-read-multiplayer-projection") return failure([diagnostic("m11-invalid-mode", "request.kind")], identities);
  const auth = projectionPrincipal(context); if (auth.error) return failure([auth.error], identities);
  if (!nonBlank(value.requestId) || !nonBlank(value.sessionId) || !safeInteger(value.expectedRevision)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
  const match = resolved.match;
  if (!pristineSession(match.session, match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  const authorityDecision = deriveProjectionAuthority(auth, match.session, context);
  if (value.expectedRevision !== match.session.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
  if (match.session.processedRequests.some((record) => record.requestId === value.requestId)) return failure([diagnostic("m11-request-id-conflict", "request.requestId")], identities);
  const projection = buildMultiplayerProjection(match.session, authorityDecision);
  if (!projection) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  const response = success(match.session, value.requestId);
  response.projection = projection;
  return response;
}

/** Reusable, read-only owned-operator authorization for future M12 commands. */
export function authorizeVoyageEventSessionOperator(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = requestIdentities(value);
  if (!exactKeys(value, MULTIPLAYER_AUTHORIZATION_FIELDS)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  if (value.kind !== "voyage.m12-authorize-operator") return failure([diagnostic("m11-invalid-mode", "request.kind")], identities);
  const auth = projectionPrincipal(context); if (auth.error) return failure([auth.error], identities);
  if (!nonBlank(value.sessionId) || !nonBlank(value.stationId)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
  if (!pristineSession(resolved.match.session, resolved.match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  const authorityDecision = deriveProjectionAuthority(auth, resolved.match.session, context);
  const assignment = resolved.match.session.encounterState.stationAssignments.find((entry) => entry.stationId === value.stationId);
  if (!assignment) return failure([diagnostic("m11-projection-not-authorized", "request.stationId")], identities);
  const owned = authorityDecision.ownedOperators.find((entry) => entry.stationId === value.stationId);
  const result = {
    ok: true,
    sessionId: resolved.match.session.sessionId,
    stationId: value.stationId,
    projectionRole: authorityDecision.role,
    operatorId: assignment.operator?.id ?? null,
    operatorUuid: assignment.operator?.uuid ?? null,
    canAct: Boolean(owned?.canAct),
    gmTakeover: Boolean(owned?.gmTakeover)
  };
  const isolated = capture(result);
  return isolated.ok ? isolated.value : failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
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
      const sourceBound = canonicalTask3SourceBoundStations(match.session, canonical);
      if (sourceBound && equal(available.value, sourceBound)) {
        // Resolution-start durably binds authored character checks to their assigned operators.
      } else if (bareTask2Stations(available.value)) available = { ok: true, value: canonical };
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
      committedStationOrder: committed.value,
      focusPools: capture(match.session.encounterState.metadata?.focusPools ?? []).value,
      focusAbilities: capture(match.session.encounterState.metadata?.focusAbilities ?? []).value
    };
    const isolated = capture(planning); if (!isolated.ok) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
    const out = success(match.session, null); out.projection = isolated.value; return out;
  } catch { return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity); }
}

function resolutionProjection(session, context) {
  try {
    const state = session.encounterState;
    const resolvedDefinition = typeof context?.resolveEventDefinitionSnapshot === "function" ? context.resolveEventDefinitionSnapshot(session.eventId, session.definitionSnapshotId) : null;
    const capturedDefinition = resolvedDefinition && typeof resolvedDefinition.then !== "function" ? capture(resolvedDefinition) : null;
    const authoredRound = capturedDefinition?.ok ? task5DefinitionRound(capturedDefinition.value, state.roundNumber) : null;
    const roundId = nonBlank(authoredRound?.roundId) ? authoredRound.roundId : null;
    const focus = focusMetadata(state, context);
    const report = prepareVoyageEncounterActionExecutionRequests(state);
    const assignments = new Map((state.stationAssignments ?? []).map((entry) => [entry.stationId, entry.operator]));
    const selections = state.selections ?? {};
    const bids = state.riskBids ?? {};
    const pending = new Map((state.pendingChecks ?? []).map((entry) => [entry.stationId, entry]));
    const order = Array.isArray(state.committedStationOrder) ? [...state.committedStationOrder] : [];
    const currentStationId = order.find((stationId) => pending.get(stationId)?.status !== "resolved") ?? null;
    const stations = order.map((stationId, index) => {
      const selection = selections[stationId] ?? null;
      const bid = bids[stationId] ?? null;
      const request = report.executionRequests?.find((entry) => entry.stationId === stationId) ?? null;
      const check = pending.get(stationId) ?? null;
      const riskEffects = check ? activeRiskBidEffectsForCheck(state, check.pendingCheckId, stationId) : [];
      return {
        stationId,
        order: index + 1,
        operator: capture(assignments.get(stationId) ?? null).value,
        actionId: selection?.actionId ?? null,
        approachId: selection?.approachId ?? null,
        statisticSlugOrAbilityId: selection?.statisticSlugOrAbilityId ?? null,
        riskBidId: bid?.riskBidId ?? null,
        riskBidDcAdjustment: bid?.dcAdjustment ?? 0,
        baseDc: request?.baseDc ?? null,
        finalDc: request?.finalDc ?? null,
        focusModifier: focusModifierForCheck(state, check?.pendingCheckId, stationId),
        riskBidModifier: riskBidModifierForCheck(state, check?.pendingCheckId, stationId),
        riskBidEffects: capture(riskEffects).value,
        momentum: state.momentum,
        pendingCheckId: check?.pendingCheckId ?? null,
        status: check?.status === "resolved" ? "resolved" : "pending",
        current: stationId === currentStationId,
        canRoll: state.phase === "resolution" && stationId === currentStationId && check?.status !== "resolved" && !(state.metadata?.reactionWindow?.status === "open" && state.metadata.reactionWindow.stationId === stationId),
        result: check?.status === "resolved" && isPlainObject(check.result) ? capture(check.result).value : null
      };
    });
    const current = stations.find((entry) => entry.status !== "resolved") ?? null;
    return {
      schemaVersion: session.schemaVersion,
      sessionId: session.sessionId,
      revision: session.revision,
      sessionState: session.sessionState,
      roundNumber: state.roundNumber,
      phase: state.phase,
      roundId,
      roundCloseoutReady: closeoutLifecycleAllowed(session, "round-closeout"),
      stationOrder: order,
      currentStationId: current?.stationId ?? null,
      currentActionId: current?.actionId ?? null,
      currentOperator: current?.operator ?? null,
      currentFocusRemaining: current ? (state.metadata?.focusPools?.find((pool) => pool.stationId === current.stationId && [current.operator?.id, current.operator?.uuid].includes(pool.operatorId))?.current ?? 0) : 0,
      completed: stations.length > 0 && stations.every((entry) => entry.status === "resolved"),
      stations
      ,focusPools: capture(state.metadata?.focusPools ?? []).value
      ,reactionWindow: capture(state.metadata?.reactionWindow ?? null).value
      ,reactionWindowOpen: state.metadata?.reactionWindow?.status === "open"
      ,reactionWindowPending: capture((state.metadata?.reactionWindow?.opportunities ?? []).filter((entry) => !(state.metadata?.reactionWindow?.resolved ?? []).includes(entry.reactionId)).map((entry) => {
        const ability = focus?.abilities.find((candidate) => candidate.focusAbilityId === entry.focusAbilityId);
        return {
          ...entry,
          focusAbility: ability ? {
            name: ability.name ?? ability.focusAbilityId,
            description: ability.description ?? "Authored Focus reaction",
            cost: ability.cost,
            sourceStationId: ability.stationId,
            sourceStationName: ability.stationId.replace(/(^|-)(\w)/g, (_match, _prefix, letter) => letter.toUpperCase()),
            targetStationId: ability.targetStationId,
            targetStationName: ability.targetStationId.replace(/(^|-)(\w)/g, (_match, _prefix, letter) => letter.toUpperCase()),
            statisticSlugOrAbilityId: ability.statisticSlugOrAbilityId,
            statisticName: ability.statisticSlugOrAbilityId.replace(/(^|-)(\w)/g, (_match, _prefix, letter) => letter.toUpperCase()),
            dc: ability.dc,
            criticalSuccess: ability.outcomeNarration?.criticalSuccess ?? "Critical Success benefit applies.",
            success: ability.outcomeNarration?.success ?? "Success benefit applies.",
            failure: ability.outcomeNarration?.failure ?? "Failure consequence applies.",
            criticalFailure: ability.outcomeNarration?.criticalFailure ?? "Critical Failure consequence applies.",
            visibility: ability.visibility ?? ability.secrecy,
            narration: ability.narration ?? ""
          } : null
        };
      })).value
      ,focusEffects: capture(state.metadata?.focusEffects ?? []).value
    };
  } catch { return null; }
}

export function readVoyageEventSessionResolution(sessionId, context = {}) {
  const captured = capture(sessionId), identity = { sessionId: captured.ok && nonBlank(captured.value) ? captured.value : null };
  if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")], identity);
  if (!nonBlank(captured.value)) return failure([diagnostic("m11-invalid-request-shape", "sessionId")], identity);
  const auth = authority(context, { requireConnection: true }); if (auth.error) return failure([auth.error], identity);
  const resolved = resolveSessionDocument(captured.value, context); if (resolved.error) return failure([resolved.error], identity);
  if (!pristineSession(resolved.match.session, resolved.match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
  if (resolved.match.session.activeGmUserId !== auth.activeGmUserId) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identity);
  const projection = resolutionProjection(resolved.match.session, context);
  if (!projection) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
  const response = success(resolved.match.session, null); response.projection = capture(projection).value; return response;
}

export async function beginVoyageEventSessionResolution(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = requestIdentities(value);
  if (!isPlainObject(value) || !exactKeys(value, ["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch"])
    || value.kind !== "voyage.m12-begin-resolution" || !nonBlank(value.requestId) || !nonBlank(value.sessionId)
    || !safeInteger(value.expectedRevision) || !safeInteger(value.authorityEpoch)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const auth = authority(context, { requireConnection: true }); if (auth.error) return failure([auth.error], identities);
  const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
  if (!pristineSession(resolved.match.session, resolved.match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  const phaseStartSnapshotId = `arcflight-voyage-resolution:${JSON.stringify([value.sessionId, value.expectedRevision + 1])}`;
  const replay = replayOrConflict(resolved.match.session.processedRequests, value.requestId, auth.authenticatedUserId, "gm", fingerprint(value.sessionId, auth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, "resolution-start", { phaseStartSnapshotId }), identities);
  if (replay) {
    const storedPending = resolved.match.session.processedRequests.find((record) => record.commandKind === "pending-checks-prepared");
    if (replay.ok && storedPending?.response) { const response = capture(storedPending.response).value; response.requestId = value.requestId; return response; }
    return replay;
  }
  if (resolved.match.session.activeGmUserId !== auth.activeGmUserId || value.authorityEpoch !== resolved.match.session.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  if (value.expectedRevision !== resolved.match.session.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
  const started = await dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: value.requestId, sessionId: value.sessionId, expectedRevision: value.expectedRevision, authorityEpoch: value.authorityEpoch, commandKind: "resolution-start", payload: { phaseStartSnapshotId } }, { ...context, __trustedResolutionStart: true });
  if (!started?.ok) return started;
  const prepared = await persistTask3PendingChecks(value.sessionId, context);
  if (prepared?.ok) prepared.requestId = value.requestId;
  return prepared;
}

async function persistTask3PendingChecks(sessionId, context) {
  const resolved = resolveSessionDocument(sessionId, context); if (resolved.error) return failure([resolved.error], { sessionId });
  const auth = authority(context, { requireConnection: true }); if (auth.error) return failure([auth.error], { sessionId });
  const prior = resolved.match.session;
  const descriptor = coordinatorDescriptor({ sessionId, expectedRevision: prior.revision, authorityEpoch: prior.authorityEpoch }, resolved.match.documentId, auth);
  if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], { sessionId });
  return runExclusiveSessionMutation(context, descriptor, async (trustedWitness) => withTransferLock(sessionId, async () => {
    const locked = authority(context, { requireConnection: true }); if (locked.error) return failure([locked.error], { sessionId });
    const current = resolveSessionDocument(sessionId, context); if (current.error) return failure([current.error], { sessionId });
    const state = current.match.session;
    if (state.activeGmUserId !== locked.activeGmUserId) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], { sessionId });
    if (state.sessionState !== "station-resolution" || state.encounterState.phase !== "resolution") return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], { sessionId });
    if (state.revision !== descriptor.expectedRevision || state.authorityEpoch !== descriptor.expectedAuthorityEpoch) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], { sessionId });
    if (state.encounterState.pendingChecks?.length) {
      const stored = state.processedRequests.find((record) => record.commandKind === "pending-checks-prepared");
      if (stored?.response) return capture(stored.response).value;
      return success(state, null);
    }
    const bound = task3SourceBoundState(state.encounterState); if (!bound) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], { sessionId });
    const report = prepareVoyageEncounterActionExecutionRequests(bound); if (!report.readyForExecution || report.checkCount === 0) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], { sessionId });
    const mappings = report.executionRequests.filter((entry) => entry.mode === "check").map((entry) => ({ sequence: entry.sequence, pendingCheckId: `arcflight-pending-check:${JSON.stringify([sessionId, state.revision + 1, entry.sequence])}` }));
    const prepared = applyVoyageEncounterPendingCheckPreparation(bound, { pendingCheckIds: mappings });
    if (!prepared?.ok) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], { sessionId });
    const candidate = capture(state).value; candidate.encounterState = capture(prepared.nextState).value; candidate.revision = state.revision + 1;
    const focus = focusMetadata(candidate.encounterState, context);
    if (focus) {
      candidate.encounterState.metadata.focusPools = focus.pools;
      candidate.encounterState.metadata.focusAbilities = focus.abilities;
      candidate.encounterState.metadata.focusEffects = Array.isArray(candidate.encounterState.metadata.focusEffects) ? candidate.encounterState.metadata.focusEffects : [];
      const currentStationId = candidate.encounterState.committedStationOrder.find((stationId) => candidate.encounterState.pendingChecks.some((check) => check.stationId === stationId && check.status === "pending"));
      const currentPending = candidate.encounterState.pendingChecks.find((check) => check.stationId === currentStationId && check.status === "pending");
      if ((!candidate.encounterState.metadata.reactionWindow || candidate.encounterState.metadata.reactionWindow.status !== "open" || candidate.encounterState.metadata.reactionWindow.stationId !== currentStationId || candidate.encounterState.metadata.reactionWindow.targetPendingCheckId !== currentPending?.pendingCheckId) && currentStationId) candidate.encounterState.metadata.reactionWindow = focusWindowForState(candidate.encounterState, currentStationId, context, currentPending?.pendingCheckId ?? null);
    }
    const domainEvent = capture(prepared.events[0]); if (!domainEvent.ok || !validTask3DomainEvent(domainEvent.value, candidate)) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], { sessionId });
    const runtimeEvent = { type: "voyage.m12-pending-checks-prepared", sessionId: candidate.sessionId, eventId: candidate.eventId, definitionSnapshotId: candidate.definitionSnapshotId, shipId: candidate.shipId, transitionKind: "pending-checks-prepared", previousSessionState: state.sessionState, nextSessionState: state.sessionState, previousEncounterRevision: state.encounterState.revision, encounterRevision: candidate.encounterState.revision, previousRevision: state.revision, revision: candidate.revision };
    candidate.events.push(domainEvent.value, runtimeEvent);
    if (!trustedWitness?.occurredAt) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], { sessionId });
    const requestId = `m12-pending-checks:${JSON.stringify([sessionId, state.revision])}`;
    const payload = { pendingCheckIds: mappings };
    const fp = fingerprint(sessionId, locked.authenticatedUserId, "gm", state.authorityEpoch, state.revision, "pending-checks-prepared", payload);
    const audit = { auditId: auditId(candidate.sessionId, candidate.auditHistory.length, TASK3_AUDIT_KINDS["pending-checks-prepared"]), kind: TASK3_AUDIT_KINDS["pending-checks-prepared"], sessionId, requestId, actorUserId: locked.authenticatedUserId, authorityEpoch: state.authorityEpoch, previousRevision: state.revision, revision: candidate.revision, occurredAt: trustedWitness.occurredAt, details: { transitionKind: "pending-checks-prepared", previousSessionState: state.sessionState, nextSessionState: state.sessionState, previousEncounterRevision: state.encounterState.revision, encounterRevision: candidate.encounterState.revision, eventCount: candidate.events.length } };
    candidate.auditHistory.push(audit);
    const response = successWithEvents(candidate, requestId, [domainEvent.value, runtimeEvent]);
    candidate.processedRequests.push({ requestId, principalUserId: locked.authenticatedUserId, projectionKind: "gm", fingerprint: fp, commandKind: "pending-checks-prepared", resultKind: "pending-checks-prepared", resultRevision: candidate.revision, response });
    if (!pristineSession(candidate, current.match.documentId, { replayContext: context })) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], { sessionId });
    try { await current.match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false }); } catch { return sessionWriteClassification(current.match.document, sessionId, current.match.documentId, candidate, state, requestId, context, { successResponse: response }); }
    return sessionWriteClassification(current.match.document, sessionId, current.match.documentId, candidate, state, requestId, context, { successResponse: response });
  }), { sessionId }, { nonWinnerCode: "m11-control-transfer-required", nonWinnerPath: "authorityEpoch" });
}

export async function resolveVoyageEventSessionStation(request, context = {}) {
  const captured = capture(request); if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")]);
  const value = captured.value, identities = requestIdentities(value);
  if (!isPlainObject(value) || !exactKeys(value, ["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch"]) || value.kind !== "voyage.m12-resolve-station" || !nonBlank(value.requestId) || !nonBlank(value.sessionId) || !safeInteger(value.expectedRevision) || !safeInteger(value.authorityEpoch)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const auth = authenticatedContext(context); if (auth.error) return failure([auth.error], identities);
  const initial = resolveSessionDocument(value.sessionId, context); if (initial.error) return failure([initial.error], identities);
  if (!pristineSession(initial.match.session, initial.match.documentId, { replayContext: context })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  if (auth.trustedTransportContext !== true || !nonBlank(auth.authenticatedConnectionId)) return failure([diagnostic("m11-authentication-required", "transport.user")], identities);
  const isGm = auth.user?.isGM === true && auth.authenticatedUserId === auth.activeGmUserId;
  const authorityDecision = isGm ? { role: "gm", ownedOperators: [] } : deriveProjectionAuthority(auth, initial.match.session, context);
  const projectionKind = isGm ? "gm" : authorityDecision.role;
  const requestFingerprint = fingerprint(value.sessionId, auth.authenticatedUserId, projectionKind, value.authorityEpoch, value.expectedRevision, "action-segment", {});
  const replay = replayOrConflict(initial.match.session.processedRequests, value.requestId, auth.authenticatedUserId, projectionKind, requestFingerprint, identities);
  if (replay) return replay;
  if (initial.match.session.activeGmUserId !== auth.activeGmUserId || value.authorityEpoch !== initial.match.session.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  if (value.expectedRevision !== initial.match.session.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
  if (initial.match.session.sessionState !== "station-resolution" || initial.match.session.encounterState.phase !== "resolution") return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
  if (!isGm && authorityDecision.role !== "operator") return failure([diagnostic("m11-projection-not-authorized", "transport.user")], identities);
  let prepared = { ok: true };
  const hasPreparedChecks = Array.isArray(initial.match.session.encounterState.pendingChecks) && initial.match.session.encounterState.pendingChecks.length > 0;
  if (isGm && !hasPreparedChecks) { prepared = await persistTask3PendingChecks(value.sessionId, context); if (!prepared.ok) return prepared; }
  const refreshed = resolveSessionDocument(value.sessionId, context); if (refreshed.error) return failure([refreshed.error], identities);
  const currentStationId = refreshed.match.session.encounterState.committedStationOrder?.find((stationId) => refreshed.match.session.encounterState.pendingChecks?.some((entry) => entry.stationId === stationId && entry.status === "pending"));
  const pending = refreshed.match.session.encounterState.pendingChecks?.find((entry) => entry.stationId === currentStationId && entry.status === "pending");
  if (!pending) return readVoyageEventSessionResolution(value.sessionId, context);
  if (!isGm && !authorityDecision.ownedOperators.some((entry) => entry.stationId === currentStationId)) return failure([diagnostic("m11-projection-not-authorized", "transport.user")], identities);
  if (refreshed.match.session.encounterState.metadata?.reactionWindow?.status === "open") return failure([diagnostic("m11-command-not-allowed", "reactionWindow")], { requestId: value.requestId, sessionId: value.sessionId });
  const latest = resolveSessionDocument(value.sessionId, context); if (latest.error) return failure([latest.error], identities);
  return dispatchVoyageEventSessionCommand({ kind: "voyage.m11-command", requestId: value.requestId, sessionId: value.sessionId, expectedRevision: value.expectedRevision, authorityEpoch: value.authorityEpoch, commandKind: "action-segment", payload: {} }, { ...context, __trustedResolutionExecution: true, __executePendingCheck: true, __trustedResolutionOperator: !isGm });
}

export function reloadVoyageEventSession(sessionId, context = {}) {
  const captured = capture(sessionId), identity = { sessionId: captured.ok && nonBlank(captured.value) ? captured.value : null };
  if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")], identity);
  if (!nonBlank(captured.value)) return failure([diagnostic("m11-invalid-request-shape", "request")], identity);
  const resolved = resolveSessionDocument(captured.value, context); if (resolved.error) return failure([resolved.error], identity);
  return pristineSession(resolved.match.session, resolved.match.documentId, { replayContext: context }) ? success(resolved.match.session) : failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
}
