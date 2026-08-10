import { ARCFLIGHT_MODULE_ID } from "../../config/constants.js";
import { validateVoyageEncounterState } from "../domain/validation.js";
import { analyzeVoyageStationAssignments } from "../domain/station-assignments.js";

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
const PROCESSED_REQUEST_FIELDS = Object.freeze(["requestId", "principalUserId", "projectionKind", "fingerprint", "commandKind", "resultKind", "resultRevision", "response"]);
const CREATION_COMMAND_KIND = "create-session";
const TRANSFER_COMMAND_KIND = "control-transfer";
const TRANSFER_RESULT_KIND = "control-transferred";
const TRANSFER_REQUEST_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch", "targetUserId", "reason"]);
const TRANSFER_COORDINATOR_FIELDS = Object.freeze(["sessionId", "sessionDocumentId", "expectedRevision", "expectedAuthorityEpoch", "authenticatedUserId", "connectionId", "activeGmUserId"]);
const AUDIT_FIELDS = Object.freeze(["auditId", "kind", "sessionId", "requestId", "actorUserId", "authorityEpoch", "previousRevision", "revision", "occurredAt", "details"]);
const AUDIT_DETAILS_FIELDS = Object.freeze(["previousActiveGmUserId", "nextActiveGmUserId", "bootstrap", "reason"]);
const RESPONSE_FIELDS = Object.freeze(["ok", "requestId", "sessionId", "status", "revision", "authorityEpoch", "projection", "events", "errors", "warnings"]);
const transferLocks = new Map();
const COMMAND_KINDS = new Set(["pause", "resume", "station-selection", "station-selection-clear", "station-order", "plan-lock", "action-segment", "reaction", "round-closeout", "emergency-response", "closeout-review", "closeout-prepare", "closeout-reserve", "closeout-ship-apply", "closeout-session-commit"]);
const FORBIDDEN_PAYLOAD_KEYS = new Set(["principalUserId", "projectionKind", "fingerprint", "result", "resultKind", "resultRevision", "candidate", "event", "response", "receipt", "nextState", "revision", "authorityEpoch", "authenticatedUserId", "connectionId", "clientId", "gmUserId", "isGM", "role", "authority", "approval", "lease", "coordinator", "exclusive", "runExclusiveSessionMutation", "analysis", "outcome"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MESSAGES = Object.freeze({
  hostile: "M11 data could not be captured safely.", shape: "Request shape, order, or root values are invalid.", mode: "The requested M11 API mode is invalid.",
  missing: "Exact Event Session document was not resolved.", ambiguous: "More than one Event Session document matched.", invalid: "Stored Event Session is invalid.",
  write: "Event Session write did not complete or verify.", recovery: "Event Session requires explicit recovery.", payload: "Command payload is invalid.",
  authentication: "Authenticated transport user is required.", activeUnavailable: "No unique active GM is available.", activeRequired: "The authenticated user is not the current active GM.", coordinatorRequired: "A trusted cross-client mutation coordinator is required.",
  targetInvalid: "Control-transfer target must be the unique current active GM.", transferRequired: "Event Session control has transferred."
});

function diagnostic(code, path) {
  const messages = {
    "m11-hostile-data-capture-failed": MESSAGES.hostile, "m11-invalid-request-shape": MESSAGES.shape, "m11-invalid-mode": MESSAGES.mode,
    "m11-session-document-not-found": MESSAGES.missing, "m11-ambiguous-session-document": MESSAGES.ambiguous, "m11-invalid-session-document": MESSAGES.invalid,
    "m11-session-write-failed": MESSAGES.write, "m11-recovery-required": MESSAGES.recovery, "m11-command-payload-invalid": MESSAGES.payload,
    "m11-request-id-required": "A unique request ID is required.", "m11-request-id-conflict": "Request ID was previously used with different data.",
    "m11-control-transfer-required": MESSAGES.transferRequired, "m11-control-transfer-target-invalid": MESSAGES.targetInvalid, "m11-cross-client-coordinator-required": MESSAGES.coordinatorRequired, "m11-stale-session-revision": "Event Session revision is stale.",
    "m11-command-not-allowed": "Command is not allowed in the current session state.",
    "m11-authentication-required": MESSAGES.authentication, "m11-active-gm-unavailable": MESSAGES.activeUnavailable, "m11-active-gm-required": MESSAGES.activeRequired
  };
  return { code, path, message: messages[code] ?? "M11 data is invalid.", severity: "error" };
}

function failure(errors, identities = {}) {
  return { ok: false, requestId: identities.requestId ?? null, sessionId: identities.sessionId ?? null, status: "failed", revision: null, authorityEpoch: null, projection: null, events: [], errors, warnings: [] };
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
    || !equal(tuple[6].initialEncounterState, session.encounterState) || !validCreationDefinition(tuple[6].eventDefinition, session)) return false;
  const expectedResponse = success(session, record.requestId, 0);
  return equal(record.response, expectedResponse);
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
function validAudit(record, session, index, request, previousGm, nextGm, bootstrap) {
  return exactKeys(record, AUDIT_FIELDS) && record.auditId === auditId(session.sessionId, index, record.kind)
    && (record.kind === "control-transfer" || record.kind === "control-transfer-bootstrap")
    && record.sessionId === session.sessionId && record.requestId === request.requestId
    && nonBlank(record.actorUserId) && record.actorUserId === request.principalUserId && record.authorityEpoch === index + 1
    && record.previousRevision === session.revision && record.revision === session.revision && validIsoTimestamp(record.occurredAt)
    && (nonBlank(previousGm) || (previousGm === null && bootstrap === true)) && nonBlank(nextGm) && exactKeys(record.details, AUDIT_DETAILS_FIELDS) && record.details.previousActiveGmUserId === previousGm
    && record.details.nextActiveGmUserId === nextGm && record.details.bootstrap === bootstrap && nonBlank(record.details.reason)
    && record.details.reason === request.reason && record.kind === (bootstrap ? "control-transfer-bootstrap" : "control-transfer");
}
function validTransferRecord(record, session, index, audit, previousGm) {
  if (!exactKeys(record, PROCESSED_REQUEST_FIELDS) || !nonBlank(record.requestId) || record.projectionKind !== "gm"
    || record.commandKind !== TRANSFER_COMMAND_KIND || record.resultKind !== TRANSFER_RESULT_KIND || record.resultRevision !== session.revision
    || !isPlainObject(record.response) || typeof record.fingerprint !== "string") return false;
  const parsed = parseStoredFingerprint(record.fingerprint); if (!parsed.ok) return false;
  const tuple = parsed.value;
  if (tuple[0] !== session.sessionId || tuple[1] !== record.principalUserId || tuple[2] !== "gm" || tuple[3] !== index || tuple[4] !== session.revision || tuple[5] !== TRANSFER_COMMAND_KIND
    || !exactKeys(tuple[6], ["targetUserId", "reason"]) || !nonBlank(tuple[6].targetUserId) || !nonBlank(tuple[6].reason)) return false;
  const nextGm = tuple[6].targetUserId, bootstrap = previousGm !== nextGm;
  if (record.response && (!equal(record.response, success(session, record.requestId, index + 1)) || !validAudit(audit, session, index, { ...record, reason: tuple[6].reason }, previousGm, nextGm, bootstrap))) return false;
  return true;
}
function pristineSession(session, documentId, { allowBootstrapNull = false } = {}) {
  try {
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
function readDocumentSession(document, context = {}) {
  try {
    if (!trustedJournalEntry(document, context) || typeof document.toObject !== "function") return { ok: false };
    const sourceCapture = capture(document.toObject()); if (!sourceCapture.ok || !isPlainObject(sourceCapture.value)) return { ok: false };
    const sourceId = ownData(sourceCapture.value, "_id"), liveId = documentId(document);
    if (!sourceId.ok || !liveId.ok || sourceId.value !== liveId.value) return { ok: false };
    const flags = ownData(sourceCapture.value, "flags"); if (!flags.ok || !isPlainObject(flags.value)) return { ok: false };
    const moduleFlags = ownData(flags.value, ARCFLIGHT_MODULE_ID); if (!moduleFlags.ok) return { ok: true, session: null, sessionId: null, documentId: liveId.value, document };
    if (!isPlainObject(moduleFlags.value)) return { ok: false };
    const system = ownData(moduleFlags.value, "system"); if (!system.ok) return { ok: true, session: null, sessionId: null, documentId: liveId.value, document };
    if (!isPlainObject(system.value)) return { ok: false };
    const voyage = ownData(system.value, "voyageSession"); if (!voyage.ok) return { ok: true, session: null, sessionId: null, documentId: liveId.value, document };
    if (!isPlainObject(voyage.value)) return { ok: false };
    const sessionId = ownData(voyage.value, "sessionId"); if (!sessionId.ok || !nonBlank(sessionId.value)) return { ok: false };
    return { ok: true, session: voyage.value, sessionId: sessionId.value, documentId: liveId.value, document };
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
    }
  }
  return "observer";
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
function trustedTimestamp(context) {
  try {
    const value = typeof context?.createVoyageTimestamp === "function" ? context.createVoyageTimestamp() : new Date().toISOString();
    return validIsoTimestamp(value) ? value : null;
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
async function runExclusiveTransfer(coordinator, descriptor, callback, identities) {
  let result;
  try { result = await coordinator.operation(descriptor, callback); }
  catch { return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities); }
  if (result === null) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  return validTransferEnvelope(result) ? result : failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
}

async function cleanupExact(document, expectedId, sessionId, beforeDocuments, context) {
  try {
    if (!trustedJournalEntry(document, context) || !nonBlank(expectedId) || beforeDocuments.some((entry) => documentId(entry).value === expectedId)) return false;
    const beforeRead = readDocumentSession(document, context); if (!beforeRead.ok || beforeRead.documentId !== expectedId) return false;
    const before = journalDocuments(context); if (!before.ok) return false;
    const exact = before.documents.filter((entry) => entry === document && documentId(entry).value === expectedId); if (exact.length !== 1) return false;
    await document.delete();
    const after = journalDocuments(context); if (!after.ok) return false;
    if (after.documents.some((entry) => documentId(entry).value === expectedId)) return false;
    const found = findSessionDocuments(sessionId, context); if (found.error || found.matches.length !== 0) return false;
    const beforeIds = beforeDocuments.map((entry) => documentId(entry).value);
    return beforeIds.every((beforeId) => nonBlank(beforeId) && after.documents.some((entry) => documentId(entry).value === beforeId))
      && beforeDocuments.every((entry) => after.documents.includes(entry));
  } catch { return false; }
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
    return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
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
  if (!id || !ownership || ownership[auth.activeGmUserId] !== levels.OWNER) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  const before = journalDocuments(context); if (!before.ok) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  const beforeIds = before.documents.map((entry) => documentId(entry).value); if (beforeIds.some((entry) => !nonBlank(entry)) || beforeIds.includes(id)) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  const beforeSources = before.documents.map((entry) => sourceSnapshot(entry, context)); if (beforeSources.some((entry) => entry === null)) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  const identity = { sessionDocumentId: id, sessionId: value.sessionId, eventId: value.eventId, definitionSnapshotId: value.definitionSnapshotId, shipId: value.shipId };
  const session = initialSession(identity, initialEncounter, auth.activeGmUserId);
  const creationResponse = success(session, value.requestId);
  session.processedRequests = [{ requestId: value.requestId, principalUserId: auth.activeGmUserId, projectionKind: "gm", fingerprint: fingerprint(value.sessionId, auth.activeGmUserId, "gm", 0, 0, CREATION_COMMAND_KIND, creationPayload(value)), commandKind: CREATION_COMMAND_KIND, resultKind: "created", resultRevision: 0, response: creationResponse }];
  if (!pristineSession(session, id)) return failure([diagnostic("m11-command-payload-invalid", "request.initialEncounterState")], identities);
  const JournalEntry = context.JournalEntry ?? globalThis.JournalEntry; if (typeof JournalEntry?.create !== "function") return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
  let document;
  try {
    document = await JournalEntry.create({ _id: id, name: "Arcflight Voyage Session", ownership, flags: { [ARCFLIGHT_MODULE_ID]: { system: { voyageSession: session } } } }, { keepId: true, render: false, renderSheet: false });
  } catch { return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities); }
  const reread = journalDocuments(context); if (!reread.ok) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
  if (document === undefined) return collectionUnchanged(before.documents, reread.documents, beforeSources, context) && !reread.documents.some((entry) => readDocumentSession(entry, context).sessionId === value.sessionId)
    ? failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities) : failure([diagnostic("m11-recovery-required", "recovery")], identities);
  const returned = readDocumentSession(document, context), returnedId = returned.ok ? returned.documentId : documentId(document).value;
  const live = reread.documents.filter((entry) => entry === document && documentId(entry).value === id);
  const verified = returned.ok && returnedId === id && live.length === 1 && equal(returned.session, session) && pristineSession(returned.session, id);
  if (verified) return success(returned.session, value.requestId);
  const cleaned = returned.ok && returnedId === id && await cleanupExact(document, id, value.sessionId, before.documents, context);
  return failure([diagnostic(cleaned ? "m11-session-write-failed" : "m11-recovery-required", cleaned ? VOYAGE_SESSION_PATH : "recovery")], identities);
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
  const match = resolved.match; if (!pristineSession(match.session, match.documentId)) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
  if (match.session.activeGmUserId !== auth.activeGmUserId) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  const projectionKind = deriveProjectionKind(auth, match.session, context);
  const requestFingerprint = fingerprint(value.sessionId, auth.authenticatedUserId, projectionKind, value.authorityEpoch, value.expectedRevision, value.commandKind, value.payload);
  const replay = replayOrConflict(match.session.processedRequests, value.requestId, auth.authenticatedUserId, projectionKind, requestFingerprint, identities); if (replay) return replay;
  if (value.authorityEpoch !== match.session.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
  if (value.expectedRevision !== match.session.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
  if (!COMMAND_KINDS.has(value.commandKind)) return failure([diagnostic("m11-command-not-allowed", "request.commandKind")], identities);
  if (containsForbiddenPayloadAuthority(value.payload)) return failure([diagnostic("m11-command-payload-invalid", "request.payload")], identities);
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
  const coordinator = transferCoordinator(context); if (coordinator.error) return failure([coordinator.error], identities);
  const initialResolved = resolveSessionDocument(value.sessionId, context); if (initialResolved.error) return failure([initialResolved.error], identities);
  const descriptor = coordinatorDescriptor(value, initialResolved.match.documentId, auth);
  if (!descriptor) return failure([diagnostic("m11-cross-client-coordinator-required", "transport.coordinator")], identities);
  return runExclusiveTransfer(coordinator, descriptor, () => withTransferLock(value.sessionId, async () => {
    const lockedAuth = authority(context, { requireConnection: true }); if (lockedAuth.error) return failure([lockedAuth.error], identities);
    if (lockedAuth.authenticatedUserId !== descriptor.authenticatedUserId || lockedAuth.authenticatedConnectionId !== descriptor.connectionId || lockedAuth.activeGmUserId !== descriptor.activeGmUserId) return failure([diagnostic("m11-active-gm-required", "transport.connection")], identities);
    const resolved = resolveSessionDocument(value.sessionId, context); if (resolved.error) return failure([resolved.error], identities);
    const match = resolved.match;
    if (match.documentId !== descriptor.sessionDocumentId) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
    if (!pristineSession(match.session, match.documentId, { allowBootstrapNull: true })) return failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identities);
    const requestFingerprint = fingerprint(value.sessionId, lockedAuth.authenticatedUserId, "gm", value.authorityEpoch, value.expectedRevision, TRANSFER_COMMAND_KIND, { targetUserId: value.targetUserId, reason: value.reason });
    const replay = replayOrConflict(match.session.processedRequests, value.requestId, lockedAuth.authenticatedUserId, "gm", requestFingerprint, identities); if (replay) return replay;
    if (!targetIsCurrentActiveGm(value.targetUserId, lockedAuth)) return failure([diagnostic("m11-control-transfer-target-invalid", "request.targetUserId")], identities);
    if (value.authorityEpoch !== match.session.authorityEpoch) return failure([diagnostic("m11-control-transfer-required", "authorityEpoch")], identities);
    if (value.expectedRevision !== match.session.revision) return failure([diagnostic("m11-stale-session-revision", "expectedRevision")], identities);
    const previous = match.session;
    const previousGm = previous.activeGmUserId, bootstrap = previousGm !== lockedAuth.activeGmUserId, occurredAt = trustedTimestamp(context);
    if (!occurredAt) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    const finalAuth = authority(context, { requireConnection: true }); if (finalAuth.error) return failure([finalAuth.error], identities);
    if (finalAuth.authenticatedUserId !== descriptor.authenticatedUserId || finalAuth.authenticatedConnectionId !== descriptor.connectionId || finalAuth.activeGmUserId !== descriptor.activeGmUserId) return failure([diagnostic("m11-active-gm-required", "transport.connection")], identities);
    if (!targetIsCurrentActiveGm(value.targetUserId, finalAuth)) return failure([diagnostic("m11-control-transfer-target-invalid", "request.targetUserId")], identities);
    const finalResolved = resolveSessionDocument(value.sessionId, context); if (finalResolved.error) return failure([finalResolved.error], identities);
    if (finalResolved.match.documentId !== descriptor.sessionDocumentId || !pristineSession(finalResolved.match.session, descriptor.sessionDocumentId, { allowBootstrapNull: true })) return failure([diagnostic("m11-recovery-required", "recovery")], identities);
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
    if (!pristineSession(candidate, descriptor.sessionDocumentId)) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
    try {
      await match.document.update({ [VOYAGE_SESSION_PATH]: candidate }, { diff: false, recursive: false });
    } catch {
      return classifyTransferWrite(match.document, value.sessionId, descriptor.sessionDocumentId, candidate, previous, value.requestId, context, { allowBootstrapNull: true });
    }
    return classifyTransferWrite(match.document, value.sessionId, descriptor.sessionDocumentId, candidate, previous, value.requestId, context, { allowBootstrapNull: true });
  }), identities);
}

export function reloadVoyageEventSession(sessionId, context = {}) {
  const captured = capture(sessionId), identity = { sessionId: captured.ok && nonBlank(captured.value) ? captured.value : null };
  if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")], identity);
  if (!nonBlank(captured.value)) return failure([diagnostic("m11-invalid-request-shape", "request")], identity);
  const resolved = resolveSessionDocument(captured.value, context); if (resolved.error) return failure([resolved.error], identity);
  return pristineSession(resolved.match.session, resolved.match.documentId) ? success(resolved.match.session) : failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
}
