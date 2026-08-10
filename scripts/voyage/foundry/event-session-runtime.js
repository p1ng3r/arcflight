import { ARCFLIGHT_MODULE_ID } from "../../config/constants.js";
import { validateVoyageEncounterState } from "../domain/validation.js";

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
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MESSAGES = Object.freeze({
  hostile: "M11 data could not be captured safely.", shape: "Request shape, order, or root values are invalid.", mode: "The requested M11 API mode is invalid.",
  missing: "Exact Event Session document was not resolved.", ambiguous: "More than one Event Session document matched.", invalid: "Stored Event Session is invalid.",
  write: "Event Session write did not complete or verify.", recovery: "Event Session requires explicit recovery.", payload: "Command payload is invalid.",
  authentication: "Authenticated transport user is required.", activeUnavailable: "No unique active GM is available.", activeRequired: "The authenticated user is not the current active GM."
});

function diagnostic(code, path) {
  const messages = {
    "m11-hostile-data-capture-failed": MESSAGES.hostile, "m11-invalid-request-shape": MESSAGES.shape, "m11-invalid-mode": MESSAGES.mode,
    "m11-session-document-not-found": MESSAGES.missing, "m11-ambiguous-session-document": MESSAGES.ambiguous, "m11-invalid-session-document": MESSAGES.invalid,
    "m11-session-write-failed": MESSAGES.write, "m11-recovery-required": MESSAGES.recovery, "m11-command-payload-invalid": MESSAGES.payload,
    "m11-authentication-required": MESSAGES.authentication, "m11-active-gm-unavailable": MESSAGES.activeUnavailable, "m11-active-gm-required": MESSAGES.activeRequired
  };
  return { code, path, message: messages[code] ?? "M11 data is invalid.", severity: "error" };
}

function failure(errors, identities = {}) {
  return { ok: false, requestId: identities.requestId ?? null, sessionId: identities.sessionId ?? null, status: "failed", revision: null, authorityEpoch: null, projection: null, events: [], errors, warnings: [] };
}

function success(session, requestId = null) {
  return { ok: true, requestId, sessionId: session.sessionId, status: session.sessionState, revision: session.revision, authorityEpoch: session.authorityEpoch, projection: null, events: [], errors: [], warnings: [] };
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
function pristineSession(session, documentId) {
  if (!exactKeys(session, SESSION_FIELDS) || session.schemaVersion !== 1 || session.sessionDocumentId !== documentId
    || ![session.sessionId, session.eventId, session.definitionSnapshotId, session.shipId, session.activeGmUserId].every(nonBlank)
    || session.revision !== 0 || session.sessionState !== "setup" || session.authorityEpoch !== 0 || !validEncounterState(session.encounterState, session)
    || session.encounterState.revision !== 0 || session.encounterState.lifecycleState !== "draft" || session.encounterState.phase !== null
    || !Array.isArray(session.events) || session.events.length !== 0 || !Array.isArray(session.checkpoints) || session.checkpoints.length !== 0
    || !Array.isArray(session.processedRequests) || session.processedRequests.length !== 0 || !Array.isArray(session.auditHistory) || session.auditHistory.length !== 0
    || !exactKeys(session.closeout, CLOSEOUT_FIELDS) || session.closeout.status !== "none"
    || !Object.keys(session.closeout).slice(1).every((key) => session.closeout[key] === null)
    || !exactKeys(session.recovery, RECOVERY_FIELDS) || session.recovery.status !== "none"
    || !Object.keys(session.recovery).slice(1).every((key) => session.recovery[key] === null)) return false;
  return session.encounterState.lifecycleState === "draft" && session.encounterState.phase === null;
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

function canonicalUsers(context) {
  try {
    const users = context?.users ?? globalThis.game?.users;
    const values = Array.isArray(users) ? users : users?.contents;
    return Array.isArray(values) ? values : null;
  } catch { return null; }
}
function authority(context) {
  const authenticatedUserId = context?.authenticatedUserId ?? globalThis.game?.user?.id;
  if (!nonBlank(authenticatedUserId)) return { error: diagnostic("m11-authentication-required", "transport.user") };
  const activeGmUserId = context?.activeGmUserId ?? globalThis.game?.users?.activeGM?.id;
  const users = canonicalUsers(context);
  if (!nonBlank(activeGmUserId) || !users) return { error: diagnostic("m11-active-gm-unavailable", "transport.activeGm") };
  const activeUsers = users.filter((user) => user?.id === activeGmUserId);
  if (activeUsers.length !== 1 || activeUsers[0]?.isGM !== true) return { error: diagnostic("m11-active-gm-unavailable", "transport.activeGm") };
  if (authenticatedUserId !== activeGmUserId) return { error: diagnostic("m11-active-gm-required", "transport.activeGm") };
  return { authenticatedUserId, activeGmUserId, users };
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
  if (!nonBlank(value.requestId) || ![value.sessionId, value.eventId, value.definitionSnapshotId, value.shipId].every(nonBlank) || !isPlainObject(value.eventDefinition) || !isPlainObject(value.initialEncounterState)) return failure([diagnostic("m11-invalid-request-shape", "request")], identities);
  const auth = authority(context); if (auth.error) return failure([auth.error], identities);
  const existing = findSessionDocuments(value.sessionId, context); if (existing.error) return failure([existing.error], identities);
  if (existing.matches.length === 1) return failure([diagnostic("m11-session-write-failed", VOYAGE_SESSION_PATH)], identities);
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

export function reloadVoyageEventSession(sessionId, context = {}) {
  const captured = capture(sessionId), identity = { sessionId: captured.ok && nonBlank(captured.value) ? captured.value : null };
  if (!captured.ok) return failure([diagnostic("m11-hostile-data-capture-failed", "$")], identity);
  if (!nonBlank(captured.value)) return failure([diagnostic("m11-invalid-request-shape", "request")], identity);
  const resolved = resolveSessionDocument(captured.value, context); if (resolved.error) return failure([resolved.error], identity);
  return pristineSession(resolved.match.session, resolved.match.documentId) ? success(resolved.match.session) : failure([diagnostic("m11-invalid-session-document", VOYAGE_SESSION_PATH)], identity);
}
