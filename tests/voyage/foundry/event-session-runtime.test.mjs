import test from "node:test";
import assert from "node:assert/strict";
import * as runtime from "../../../scripts/voyage/foundry/event-session-runtime.js";
import { createVoyageEventSession, dispatchVoyageEventSessionCommand, reloadVoyageEventSession } from "../../../scripts/voyage/foundry/event-session-runtime.js";
import { createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function definition() { return { schemaVersion: 1, eventId: "event-1", definitionSnapshotId: "definition-1", title: "Cinderwake" }; }
function encounter() { return { ...createDraftVoyageEncounterDefaults(), encounterId: "event-1", definitionId: "event-1", definitionRef: null, primaryShip: { id: "ship-1", preserved: true } }; }
function request(definitionValue = definition(), encounterValue = encounter()) {
  return { kind: "voyage.m11-create-session", requestId: "request-1", sessionId: "session-1", eventId: "event-1", definitionSnapshotId: "definition-1", shipId: "ship-1", eventDefinition: definitionValue, initialEncounterState: encounterValue };
}
function command(overrides = {}) { return { kind: "voyage.m11-command", requestId: "command-1", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, commandKind: "pause", payload: {}, ...overrides }; }
function makeJournalDocument(data, tracker, journals, { id = data._id, flags = data.flags, persist = true } = {}) {
  const source = { _id: id, name: data.name ?? "Preserved JournalEntry", pages: [{ name: "Preserved page", text: { content: "keep" } }], ownership: structuredClone(data.ownership), folder: { id: "folder-1" }, sort: 42, flags: structuredClone(flags) };
  const document = {
    __isJournalEntry: true, __testSource: source,
    get id() { return source._id; }, get name() { return source.name; }, get pages() { return source.pages; }, get ownership() { return source.ownership; }, get folder() { return source.folder; }, get sort() { return source.sort; },
    toObject() { return source; },
    async update() { tracker.updates += 1; return this; },
    async delete() { tracker.deletes += 1; tracker.deletedIds.push(this.id); const index = journals.indexOf(this); if (index >= 0) journals.splice(index, 1); return this; }
  };
  if (persist) journals.push(document);
  return document;
}
function makeContext({ journals = [], documentId = "Journal.session-1", definitionValue = definition(), encounterValue = encounter(), create = null, authenticatedUserId = "gm-1", activeGmUserId = "gm-1", users = null, operatorResolver = null } = {}) {
  const tracker = { creates: 0, updates: 0, deletes: 0, deletedIds: [], createOperations: [], resolverCalls: 0, builderCalls: 0, idCalls: 0, journalScans: 0 };
  const JournalEntry = { async create(data, operation) { tracker.creates += 1; tracker.createOperations.push(operation); const effective = { ...data, _id: operation?.keepId === true ? data._id : "Journal.generated-by-foundry" }; return create ? create(effective, tracker, journals, (options) => makeJournalDocument(effective, tracker, journals, options)) : makeJournalDocument(effective, tracker, journals); } };
  const context = {
    authenticatedUserId, activeGmUserId,
    users: users ?? [{ id: "gm-1", isGM: true, active: true }, { id: "gm-2", isGM: true, active: true }, { id: "player-1", isGM: false, active: true }],
    createDocumentId: () => { tracker.idCalls += 1; return documentId; },
    resolveEventDefinitionSnapshot: async () => { tracker.resolverCalls += 1; return structuredClone(definitionValue); },
    createInitialEncounterState: async () => { tracker.builderCalls += 1; return structuredClone(encounterValue); },
    ...(operatorResolver ? { resolveVoyageOperatorForPrincipal: operatorResolver } : {}),
    JournalEntry, isJournalEntryDocument: (document) => document?.__isJournalEntry === true
  };
  Object.defineProperty(context, "journalEntries", { enumerable: true, get() { tracker.journalScans += 1; return journals; } });
  return { context, journals, tracker };
}
function session(document) { return document.__testSource.flags.arcflight.system.voyageSession; }
function assertFailure(result, code, path, message) { assert.equal(result.ok, false); assert.deepEqual(Object.keys(result), ["ok", "requestId", "sessionId", "status", "revision", "authorityEpoch", "projection", "events", "errors", "warnings"]); assert.equal(result.errors.length, 1); assert.deepEqual(result.errors[0], { code, path, message, severity: "error" }); assert.deepEqual(result.events, []); assert.deepEqual(result.warnings, []); }
function pristineKeys(value) { assert.deepEqual(Object.keys(value), ["schemaVersion", "sessionDocumentId", "sessionId", "eventId", "definitionSnapshotId", "shipId", "revision", "sessionState", "activeGmUserId", "authorityEpoch", "encounterState", "events", "checkpoints", "processedRequests", "closeout", "recovery", "auditHistory"]); }

test("M11 Task 2 exposes only the authorized creation, command, and reload boundaries", () => assert.deepEqual(Object.keys(runtime).sort(), ["createVoyageEventSession", "dispatchVoyageEventSessionCommand", "reloadVoyageEventSession"]));

test("valid creation uses keepId and stores only pristine voyageSession state", async () => {
  const fixture = makeContext(); const result = await createVoyageEventSession(request(), fixture.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors)); assert.deepEqual(fixture.tracker.createOperations, [{ keepId: true, render: false, renderSheet: false }]); assert.equal(fixture.journals[0].id, "Journal.session-1"); assert.equal(fixture.journals[0].toObject()._id, "Journal.session-1");
  const stored = session(fixture.journals[0]); pristineKeys(stored); assert.equal(stored.sessionDocumentId, fixture.journals[0].id); assert.equal(stored.revision, 0); assert.equal(stored.sessionState, "setup"); assert.equal(stored.encounterState.revision, 0); assert.deepEqual(stored.events, []); assert.deepEqual(Object.keys(stored.processedRequests[0]), ["requestId", "principalUserId", "projectionKind", "fingerprint", "commandKind", "resultKind", "resultRevision", "response"]); assert.equal(stored.processedRequests[0].commandKind, "create-session"); assert.equal(stored.processedRequests[0].resultKind, "created"); assert.equal(stored.processedRequests[0].projectionKind, "gm");
});

test("GM-only ownership is exact", async () => { const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context); assert.deepEqual(fixture.journals[0].ownership, { default: 0, "gm-1": 3, "gm-2": 3 }); });

test("authority failures precede document and domain resolution", async () => {
  const cases = [
    [null, "gm-1", [{ id: "gm-1", isGM: true, active: true }], "m11-authentication-required", "transport.user", "Authenticated transport user is required."],
    ["gm-1", null, [{ id: "gm-1", isGM: true, active: true }], "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available."],
    ["player-1", "gm-1", [{ id: "gm-1", isGM: true, active: true }, { id: "player-1", isGM: false, active: true }], "m11-active-gm-required", "transport.activeGm", "The authenticated user is not the current active GM."],
    ["gm-1", "player-1", [{ id: "gm-1", isGM: true, active: true }, { id: "player-1", isGM: false, active: true }], "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available."],
    ["gm-1", "gm-1", [{ id: "gm-1", isGM: true, active: false }], "m11-authentication-required", "transport.user", "Authenticated transport user is required."],
    ["gm-1", "gm-1", [{ id: "gm-1", isGM: true }], "m11-authentication-required", "transport.user", "Authenticated transport user is required."],
    ["gm-1", "gm-1", [{ id: "gm-1", isGM: true, active: 1 }], "m11-authentication-required", "transport.user", "Authenticated transport user is required."],
    ["gm-1", "gm-1", [{ id: "gm-1", isGM: true, active: "true" }], "m11-authentication-required", "transport.user", "Authenticated transport user is required."],
    ["gm-1", "gm-1", [{ id: "gm-1", isGM: true, active: true }, { id: "gm-1", isGM: true, active: true }], "m11-authentication-required", "transport.user", "Authenticated transport user is required."],
    ["gm-2", "gm-1", [{ id: "gm-1", isGM: true, active: true }, { id: "gm-1", isGM: true, active: true }, { id: "gm-2", isGM: true, active: true }], "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available."],
    ["gm-1", "gm-1", [{ id: "gm-1", isGM: false, active: true }], "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available."],
    ["gm-2", "gm-1", [{ id: "gm-1", isGM: true, active: true }, { id: "gm-2", isGM: true, active: true }], "m11-active-gm-required", "transport.activeGm", "The authenticated user is not the current active GM."],
    ["gm-1", "gm-2", [{ id: "gm-1", isGM: true, active: true }, { id: "gm-2", isGM: true, active: false }], "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available."],
    ["gm-1", "gm-2", [{ id: "gm-1", isGM: true, active: true }, { id: "gm-2", isGM: true }], "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available."],
    ["gm-1", "gm-2", [{ id: "gm-1", isGM: true, active: true }, { id: "gm-2", isGM: true, active: 1 }], "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available."],
    ["gm-1", "gm-2", [{ id: "gm-1", isGM: true, active: true }, { id: "gm-2", isGM: true, active: "true" }], "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available."]
  ];
  const malformedRequests = [
    (() => { const value = request(); value.requestId = ""; return value; })(),
    (() => { const value = request(); value.sessionId = " "; return value; })(),
    (() => { const value = request(); value.eventId = " "; return value; })(),
    (() => { const value = request(); value.eventDefinition = null; return value; })(),
    (() => { const value = request(); value.initialEncounterState = null; return value; })(),
    request(), request()
  ];
  for (const [authenticatedUserId, activeGmUserId, users, code, path, message] of cases) {
    for (const value of malformedRequests) {
      const fixture = makeContext({ authenticatedUserId, activeGmUserId, users, definitionValue: { mismatch: true }, encounterValue: { mismatch: true } }); const result = await createVoyageEventSession(value, fixture.context); assertFailure(result, code, path, message); assert.equal(fixture.tracker.journalScans, 0); assert.equal(fixture.tracker.resolverCalls, 0); assert.equal(fixture.tracker.builderCalls, 0); assert.equal(fixture.tracker.idCalls, 0); assert.equal(fixture.tracker.creates, 0); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
    }
  }
  const success = makeContext(); assert.equal((await createVoyageEventSession(request(), success.context)).ok, true); assert.equal(success.tracker.idCalls, 1);
  const inherited = Object.create({ active: true }); inherited.id = "gm-1"; inherited.isGM = true;
  const accessor = {}; Object.defineProperty(accessor, "id", { enumerable: true, get() { throw new Error("id"); } }); Object.defineProperty(accessor, "isGM", { enumerable: true, value: true }); Object.defineProperty(accessor, "active", { enumerable: true, value: true });
  const revoked = Proxy.revocable({ id: "gm-1", isGM: true, active: true }, {}); revoked.revoke();
  for (const users of [[inherited], [accessor], [revoked.proxy]]) { const fixture = makeContext({ users }); assertFailure(await createVoyageEventSession(request(), fixture.context), "m11-authentication-required", "transport.user", "Authenticated transport user is required."); assert.equal(fixture.tracker.journalScans, 0); assert.equal(fixture.tracker.resolverCalls, 0); assert.equal(fixture.tracker.builderCalls, 0); assert.equal(fixture.tracker.idCalls, 0); assert.equal(fixture.tracker.creates, 0); }
});

test("missing, one, and multiple matching documents have exact precedence", async () => {
  const missing = makeContext(); assertFailure(reloadVoyageEventSession("session-1", missing.context), "m11-session-document-not-found", "sessionId", "Exact Event Session document was not resolved.");
  const one = makeContext(); assert.equal((await createVoyageEventSession(request(), one.context)).ok, true); const replay = await createVoyageEventSession(request(), one.context); assert.equal(replay.ok, true); assert.equal(one.tracker.creates, 1);
  const multiple = makeContext(); assert.equal((await createVoyageEventSession(request(), multiple.context)).ok, true); const duplicate = makeJournalDocument({ _id: "Journal.duplicate", flags: structuredClone(multiple.journals[0].__testSource.flags), ownership: {} }, multiple.tracker, []); multiple.journals.push(duplicate); assertFailure(reloadVoyageEventSession("session-1", multiple.context), "m11-ambiguous-session-document", "sessionId", "More than one Event Session document matched.");
});

test("cleanup is authorized only for the exact generated document", async () => {
  const clean = makeContext({ create(_data, _tracker, _journals, makeDocument) { const document = makeDocument(); session(document).sessionId = "wrong-session"; return document; } }); const result = await createVoyageEventSession(request(), clean.context); assertFailure(result, "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify."); assert.deepEqual(clean.tracker.deletedIds, ["Journal.session-1"]);
  const uncertain = [
    { name: "returned id mismatch", create(_data, _tracker, _journals, makeDocument) { return makeDocument({ id: "Journal.other" }); } },
    { name: "returned source id mismatch", create(_data, _tracker, _journals, makeDocument) { const document = makeDocument(); const source = document.__testSource; document.toObject = () => ({ ...source, _id: "Journal.other" }); return document; } },
    { name: "source id mismatch", create(_data, _tracker, _journals, makeDocument) { const document = makeDocument(); const source = document.__testSource; Object.defineProperty(source, "_id", { value: "Journal.other", enumerable: true, writable: true }); return document; } },
    { name: "not reread", create(_data, _tracker, _journals, makeDocument) { return makeDocument({ persist: false }); } }
  ];
  for (const scenario of uncertain) { const fixture = makeContext({ create: scenario.create }); const failed = await createVoyageEventSession(request(), fixture.context); assertFailure(failed, "m11-recovery-required", "recovery", "Event Session requires explicit recovery."); assert.equal(fixture.tracker.deletes, 0, scenario.name); }

  const existingFixture = makeContext();
  const unrelated = makeJournalDocument({ _id: "Journal.preexisting", flags: { unrelated: { preserved: true } }, ownership: {} }, existingFixture.tracker, existingFixture.journals);
  const returnedExisting = makeContext({ journals: [unrelated], create(_data, _tracker, journals) { return journals[0]; } });
  const existingResult = await createVoyageEventSession(request(), returnedExisting.context);
  assertFailure(existingResult, "m11-recovery-required", "recovery", "Event Session requires explicit recovery.");
  assert.equal(returnedExisting.tracker.deletes, 0);

  const concurrent = makeContext({ create(_data, tracker, journals, makeDocument) {
    const document = makeDocument(); session(document).sessionId = "wrong-session";
    document.delete = async () => { tracker.deletes += 1; tracker.deletedIds.push(document.id); journals.splice(journals.indexOf(document), 1); makeJournalDocument({ _id: "Journal.concurrent", flags: { unrelated: { preserved: true } }, ownership: {} }, tracker, journals); };
    return document;
  } });
  const concurrentResult = await createVoyageEventSession(request(), concurrent.context);
  assertFailure(concurrentResult, "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify.");
  assert.deepEqual(concurrent.tracker.deletedIds, ["Journal.session-1"]);
  assert.equal(concurrent.journals.length, 1);
});

test("undefined create with unchanged collection is a write failure without deletion", async () => { const fixture = makeContext({ create: () => undefined }); const result = await createVoyageEventSession(request(), fixture.context); assertFailure(result, "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify."); assert.equal(fixture.tracker.deletes, 0); });

test("cleanup rejection, throw, remaining document, and ambiguity require recovery", async () => {
  const configs = [
    (document) => { document.delete = async () => { throw new Error("reject"); }; },
    (document) => { document.delete = () => { throw new Error("throw"); }; },
    (document, tracker) => { document.delete = async () => { tracker.deletes += 1; }; },
    (document, tracker, journals) => { document.delete = async () => { tracker.deletes += 1; journals.splice(journals.indexOf(document), 1); const duplicate = makeJournalDocument({ _id: "Journal.concurrent", flags: structuredClone(document.__testSource.flags), ownership: {} }, tracker, journals); session(duplicate).sessionId = "session-1"; }; }
  ];
  for (const configure of configs) { const fixture = makeContext({ create(_data, tracker, journals, makeDocument) { const document = makeDocument(); session(document).sessionId = "wrong-session"; configure(document, tracker, journals); return document; } }); const result = await createVoyageEventSession(request(), fixture.context); assertFailure(result, "m11-recovery-required", "recovery", "Event Session requires explicit recovery."); }
});

test("reload accepts only the exact pristine setup state", async () => {
  const mutations = [
    ["events", [null]], ["checkpoints", [null]], ["processedRequests", [null]], ["auditHistory", [null]],
    ["sessionState", "crew-planning"], ["closeout", { status: "review-required", applicationId: null, closeoutId: null, acceptedApplicationPlan: null, reservationId: null, expectedEncounterRevision: null, expectedShipRevision: null, sessionReservationReceipt: null, sessionCommitReceipt: null }],
    ["recovery", { status: "required", reasonCode: null, failedRequestId: null, failedRevision: null, checkpointId: null, sourceCheckpointRevision: null, recoveryAuthorityUserId: null }]
  ];
  for (const [field, value] of mutations) { const fixture = makeContext(); assert.equal((await createVoyageEventSession(request(), fixture.context)).ok, true); session(fixture.journals[0])[field] = structuredClone(value); assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0); }
});

test("capture boundaries reject accessors, proxies, cycles, sparse arrays, and prohibited values", async () => {
  const hostileValues = [undefined, () => undefined, 1n, Symbol("x"), Infinity, new Date(), new Map(), new Set(), new (class Hostile {})()];
  for (const hostile of hostileValues) { const fixture = makeContext(); assert.equal((await createVoyageEventSession(request(), fixture.context)).ok, true); session(fixture.journals[0]).encounterState.metadata = { hostile }; assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-hostile-data-capture-failed", "$", "M11 data could not be captured safely."); }
  const fixture = makeContext(); assert.equal((await createVoyageEventSession(request(), fixture.context)).ok, true); const value = session(fixture.journals[0]); const cycle = {}; cycle.self = cycle; value.encounterState.metadata = cycle; assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-hostile-data-capture-failed", "$", "M11 data could not be captured safely.");
  const getterFixture = makeContext(); await createVoyageEventSession(request(), getterFixture.context); Object.defineProperty(session(getterFixture.journals[0]).encounterState, "metadata", { enumerable: true, get() { throw new Error("getter"); } }); assertFailure(reloadVoyageEventSession("session-1", getterFixture.context), "m11-hostile-data-capture-failed", "$", "M11 data could not be captured safely.");
  const sparseFixture = makeContext(); await createVoyageEventSession(request(), sparseFixture.context); session(sparseFixture.journals[0]).events = new Array(1); assertFailure(reloadVoyageEventSession("session-1", sparseFixture.context), "m11-hostile-data-capture-failed", "$", "M11 data could not be captured safely.");
  const proxyFixture = makeContext(); await createVoyageEventSession(request(), proxyFixture.context); session(proxyFixture.journals[0]).encounterState.metadata = new Proxy({}, { ownKeys() { throw new Error("proxy"); } }); assertFailure(reloadVoyageEventSession("session-1", proxyFixture.context), "m11-hostile-data-capture-failed", "$", "M11 data could not be captured safely.");
});

test("reload is read-only and preserves unrelated JournalEntry data", async () => { const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context); fixture.journals[0].__testSource.flags.otherModule = { preserved: ["yes"] }; const before = structuredClone(fixture.journals[0].__testSource); const result = reloadVoyageEventSession("session-1", fixture.context); assert.equal(result.ok, true); assert.deepEqual(fixture.journals[0].__testSource, before); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0); });

test("caller and returned session data are isolated", async () => { const fixture = makeContext(); const value = request(); const result = await createVoyageEventSession(value, fixture.context); assert.equal(result.ok, true); value.initialEncounterState.primaryShip.id = "changed"; result.status = "changed"; assert.equal(session(fixture.journals[0]).encounterState.primaryShip.id, "ship-1"); assert.equal(reloadVoyageEventSession("session-1", fixture.context).ok, true); });

test("exact command envelopes enforce order, capture, and authentication precedence", async () => {
  const fixture = makeContext();
  const fields = ["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch", "commandKind", "payload"];
  for (const field of fields) {
    const value = command(); delete value[field];
    assertFailure(dispatchVoyageEventSessionCommand(value, fixture.context), field === "requestId" ? "m11-request-id-required" : "m11-invalid-request-shape", field === "requestId" ? "request.requestId" : "request", field === "requestId" ? "A unique request ID is required." : "Request shape, order, or root values are invalid.");
  }
  const reordered = { requestId: "command-1", kind: "voyage.m11-command", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, commandKind: "pause", payload: {} };
  assertFailure(dispatchVoyageEventSessionCommand(reordered, fixture.context), "m11-invalid-request-shape", "request", "Request shape, order, or root values are invalid.");
  const hostile = command({ payload: { nested: undefined } }); assertFailure(dispatchVoyageEventSessionCommand(hostile, fixture.context), "m11-hostile-data-capture-failed", "$", "M11 data could not be captured safely.");
  await createVoyageEventSession(request(), fixture.context);
  assertFailure(dispatchVoyageEventSessionCommand(command({ commandKind: "unknown" }), fixture.context), "m11-command-not-allowed", "request.commandKind", "Command is not allowed in the current session state.");
  for (const payload of [{ response: { forged: true } }, { nested: { response: { forged: true } } }, { result: { forged: true } }]) {
    assertFailure(dispatchVoyageEventSessionCommand(command({ payload }), fixture.context), "m11-command-payload-invalid", "request.payload", "Command payload is invalid.");
  }
  assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
  const unauthenticated = makeContext({ authenticatedUserId: null }); assertFailure(dispatchVoyageEventSessionCommand(command({ payload: { response: { forged: true } } }), unauthenticated.context), "m11-authentication-required", "transport.user", "Authenticated transport user is required."); assert.equal(unauthenticated.tracker.creates, 0); assert.equal(unauthenticated.tracker.resolverCalls, 0); assert.equal(unauthenticated.tracker.builderCalls, 0);
});

test("creation replay is isolated and changed request identity conflicts without writes", async () => {
  const fixture = makeContext(); const first = await createVoyageEventSession(request(), fixture.context); assert.equal(first.ok, true); const replay = await createVoyageEventSession(request(), fixture.context); assert.deepEqual(replay, first); assert.equal(fixture.tracker.creates, 1); replay.status = "mutated"; const replayAgain = await createVoyageEventSession(request(), fixture.context); assert.equal(replayAgain.status, "setup"); assert.equal(fixture.tracker.creates, 1);
  const changed = request(); changed.eventDefinition.title = "changed"; assertFailure(await createVoyageEventSession(changed, fixture.context), "m11-request-id-conflict", "request.requestId", "Request ID was previously used with different data."); assert.equal(fixture.tracker.creates, 1);
  const differentRequest = request(); differentRequest.requestId = "request-2"; assertFailure(await createVoyageEventSession(differentRequest, fixture.context), "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify."); assert.equal(fixture.tracker.creates, 1);
  const crossPrincipal = makeContext({ authenticatedUserId: "gm-2", activeGmUserId: "gm-2", journals: fixture.journals }); assertFailure(await createVoyageEventSession(request(), crossPrincipal.context), "m11-request-id-conflict", "request.requestId", "Request ID was previously used with different data."); assert.equal(crossPrincipal.tracker.creates, 0);
});

test("request-ID conflict precedes stale revision and unsupported commands never write", async () => {
  const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context);
  const stale = command({ requestId: "request-1", expectedRevision: 99 }); assertFailure(dispatchVoyageEventSessionCommand(stale, fixture.context), "m11-request-id-conflict", "request.requestId", "Request ID was previously used with different data.");
  assertFailure(dispatchVoyageEventSessionCommand(command({ requestId: "new-command", expectedRevision: 99 }), fixture.context), "m11-stale-session-revision", "expectedRevision", "Event Session revision is stale.");
  assertFailure(dispatchVoyageEventSessionCommand(command(), fixture.context), "m11-command-not-allowed", "request.commandKind", "Command is not allowed in the current session state."); assert.equal(fixture.tracker.creates, 1); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
});

test("Task 2 rejects positive revisions, missing/extra creation records, and all future record kinds", async () => {
  const mutations = [
    (stored) => { stored.revision = 1; },
    (stored) => { stored.authorityEpoch = 1; },
    (stored) => { stored.processedRequests = []; },
    (stored) => { stored.processedRequests.push(structuredClone(stored.processedRequests[0])); },
    (stored) => { stored.processedRequests[0].commandKind = "pause"; },
    (stored) => { stored.processedRequests[0].resultKind = "replayed-success"; }
  ];
  for (const mutate of mutations) {
    const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context); mutate(session(fixture.journals[0])); assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
  }
});

test("creation record binding rejects every independently tampered identity, fingerprint, payload, and response field", async () => {
  const mutations = [
    (record) => { record.principalUserId = "gm-2"; },
    (record) => { record.projectionKind = "observer"; },
    (record) => { record.commandKind = "pause"; },
    (record) => { record.resultKind = "replayed-success"; },
    (record) => { record.resultRevision = 1; },
    (record) => { const tuple = JSON.parse(record.fingerprint); tuple[0] = "other-session"; record.fingerprint = JSON.stringify(tuple); },
    (record) => { const tuple = JSON.parse(record.fingerprint); tuple[1] = "gm-2"; record.fingerprint = JSON.stringify(tuple); },
    (record) => { const tuple = JSON.parse(record.fingerprint); tuple[2] = "observer"; record.fingerprint = JSON.stringify(tuple); },
    (record) => { const tuple = JSON.parse(record.fingerprint); tuple[3] = 1; record.fingerprint = JSON.stringify(tuple); },
    (record) => { const tuple = JSON.parse(record.fingerprint); tuple[4] = 1; record.fingerprint = JSON.stringify(tuple); },
    (record) => { const tuple = JSON.parse(record.fingerprint); tuple[5] = "pause"; record.fingerprint = JSON.stringify(tuple); },
    (record) => { const tuple = JSON.parse(record.fingerprint); tuple[6].eventId = "other-event"; record.fingerprint = JSON.stringify(tuple); },
    (record) => { const tuple = JSON.parse(record.fingerprint); tuple[6].initialEncounterState.primaryShip.id = "other-ship"; record.fingerprint = JSON.stringify(tuple); },
    (record) => { record.response.status = "failed"; },
    (record) => { record.response.revision = 1; },
    (record) => { record.response.authorityEpoch = 1; },
    (record) => { record.response.projection = {}; },
    (record) => { record.response.events = [{}]; },
    (record) => { record.response.errors = [{}]; },
    (record) => { record.response.warnings = [{}]; }
  ];
  for (const mutate of mutations) {
    const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context); mutate(session(fixture.journals[0]).processedRequests[0]); assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
  }
});

test("stored fingerprints are hostile-safely recaptured in reload and command validation", async () => {
  const fingerprints = [];
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context); const record = session(fixture.journals[0]).processedRequests[0]; const tuple = JSON.parse(record.fingerprint); Object.defineProperty(tuple[6].eventDefinition, key, { value: { nested: true }, enumerable: true }); fingerprints.push(JSON.stringify(tuple));
    const nested = {}; Object.defineProperty(nested, key, { value: true, enumerable: true }); const nestedTuple = JSON.parse(record.fingerprint); nestedTuple[6].eventDefinition.details = { nested }; fingerprints.push(JSON.stringify(nestedTuple));
  }
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context); const record = session(fixture.journals[0]).processedRequests[0]; const tuple = JSON.parse(record.fingerprint); const nested = {}; Object.defineProperty(nested, key, { value: true, enumerable: true }); tuple[6].initialEncounterState.metadata = { nested: [nested] }; record.fingerprint = JSON.stringify(tuple); fingerprints.push(record.fingerprint); assert.equal(Object.prototype.polluted, undefined); assert.equal(({}).polluted, undefined); assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assertFailure(dispatchVoyageEventSessionCommand(command(), fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
  }
  const malformed = [
    "not-json",
    "[]",
    "{}",
    "[1,2,3,4,5,6]",
    "[\"session-1\",\"gm-1\",\"gm\",0,0,\"create-session\",{}]",
    "[\"session-1\",\"gm-1\",\"gm\",0,0,\"create-session\",{\"eventId\":\"event-1\",\"eventId\":\"other\"}]"
  ];
  for (const fingerprint of [...fingerprints, ...malformed]) {
    const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context); session(fixture.journals[0]).processedRequests[0].fingerprint = fingerprint; assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assertFailure(await createVoyageEventSession(request(), fixture.context), "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify."); assert.equal(Object.prototype.polluted, undefined); assert.equal(({}).polluted, undefined); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
  }
});

test("approximately 5000-level stored fingerprints fail closed across every validation path", async () => {
  let deep = "{}";
  for (let index = 0; index < 5000; index += 1) deep = `{"x":${deep}}`;
  const eventDefinition = `{"schemaVersion":1,"eventId":"event-1","definitionSnapshotId":"definition-1","title":"Cinderwake","deep":${deep}}`;
  const run = async (kind) => {
    const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context);
    const stored = session(fixture.journals[0]);
    stored.processedRequests[0].fingerprint = `["session-1","gm-1","gm",0,0,"create-session",{"eventId":"event-1","definitionSnapshotId":"definition-1","shipId":"ship-1","eventDefinition":${eventDefinition},"initialEncounterState":${JSON.stringify(stored.encounterState)}}]`;
    const beforeDocument = structuredClone(fixture.journals[0].__testSource);
    const beforeRequest = request();
    const invoke = kind === "reload" ? () => reloadVoyageEventSession("session-1", fixture.context) : kind === "create" ? () => createVoyageEventSession(request(), fixture.context) : () => dispatchVoyageEventSessionCommand(command(), fixture.context);
    const expected = kind === "create" ? ["m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify."] : ["m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."];
    let first; let second;
    await assert.doesNotReject(async () => { first = await invoke(); });
    await assert.doesNotReject(async () => { second = await invoke(); });
    assertFailure(first, ...expected); assertFailure(second, ...expected); assert.deepEqual(second, first);
    assert.deepEqual(fixture.journals[0].__testSource, beforeDocument); assert.deepEqual(request(), beforeRequest); assert.equal(fixture.tracker.creates, 1); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
  };
  await run("reload"); await run("create"); await run("dispatch");
});

test("authentication precedes semantic payload checks and active-GM binding", async () => {
  const unauthenticated = makeContext({ authenticatedUserId: null }); assertFailure(dispatchVoyageEventSessionCommand(command({ payload: { response: { forged: true } } }), unauthenticated.context), "m11-authentication-required", "transport.user", "Authenticated transport user is required."); assert.equal(unauthenticated.tracker.resolverCalls, 0); assert.equal(unauthenticated.tracker.builderCalls, 0); assert.equal(unauthenticated.tracker.creates, 0); assert.equal(unauthenticated.tracker.updates, 0); assert.equal(unauthenticated.tracker.deletes, 0);
  const disconnectedPlayer = makeContext({ authenticatedUserId: "player-1", users: [{ id: "gm-1", isGM: true, active: true }, { id: "player-1", isGM: false, active: false }] }); assertFailure(dispatchVoyageEventSessionCommand(command({ payload: { response: { forged: true } } }), disconnectedPlayer.context), "m11-authentication-required", "transport.user", "Authenticated transport user is required.");
  const missingGm = makeContext({ activeGmUserId: null }); assertFailure(dispatchVoyageEventSessionCommand(command(), missingGm.context), "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available.");
  const invalidGm = makeContext({ users: [{ id: "gm-1", isGM: false, active: true }] }); assertFailure(dispatchVoyageEventSessionCommand(command(), invalidGm.context), "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available.");
  const duplicateGm = makeContext({ authenticatedUserId: "gm-2", activeGmUserId: "gm-1", users: [{ id: "gm-1", isGM: true, active: true }, { id: "gm-1", isGM: true, active: true }, { id: "gm-2", isGM: true, active: true }] }); assertFailure(dispatchVoyageEventSessionCommand(command(), duplicateGm.context), "m11-active-gm-unavailable", "transport.activeGm", "No unique active GM is available.");
  const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context);
  const nonActiveGm = makeContext({ journals: fixture.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-1" }); assertFailure(dispatchVoyageEventSessionCommand(command({ requestId: "non-active-gm" }), nonActiveGm.context), "m11-command-not-allowed", "request.commandKind", "Command is not allowed in the current session state."); assert.equal(nonActiveGm.tracker.updates, 0); assert.equal(nonActiveGm.tracker.deletes, 0);
  for (const value of [
    makeContext({ journals: fixture.journals, activeGmUserId: "gm-2", authenticatedUserId: "player-1" }),
    makeContext({ journals: fixture.journals, activeGmUserId: "gm-2", authenticatedUserId: "player-1" }),
    makeContext({ journals: fixture.journals, activeGmUserId: "gm-2", authenticatedUserId: "player-1" })
  ]) {
    assertFailure(dispatchVoyageEventSessionCommand(command({ requestId: "request-1", expectedRevision: 99 }), value.context), "m11-control-transfer-required", "authorityEpoch", "Event Session control has transferred."); assert.equal(value.tracker.updates, 0); assert.equal(value.tracker.deletes, 0);
  }
  const disconnectedGm = makeContext({ journals: fixture.journals, users: [{ id: "gm-1", isGM: true, active: false }], authenticatedUserId: "gm-1", activeGmUserId: "gm-1" }); assertFailure(dispatchVoyageEventSessionCommand(command(), disconnectedGm.context), "m11-authentication-required", "transport.user", "Authenticated transport user is required.");
});

test("canonical operator resolver uses existing id/uuid identity semantics without granting from malformed evidence", async () => {
  const variants = [
    { kind: "actor", id: "captain" },
    { kind: "actor", uuid: "Actor.captain" },
    { kind: "actor", id: "captain", name: "Captain" },
    { kind: "actor", uuid: "Actor.captain", name: "Captain" },
    { kind: "actor", uuid: "Actor.captain", name: "Different display name" },
    { kind: "crewAsset", id: "captain" },
    { kind: "actor", id: "wrong" },
    { kind: "actor", uuid: "Actor.wrong" },
    { kind: "actor" },
    { kind: "actor", id: "captain", uuid: "Actor.captain" },
    new Proxy({}, { ownKeys() { throw new Error("hostile"); } })
  ];
  for (const resolverValue of variants) {
    const encounterValue = encounter(); encounterValue.stationAssignments = [{ stationId: "captain", operator: { kind: "actor", id: "captain", uuid: "Actor.captain", name: "Captain" } }]; const fixture = makeContext({ encounterValue, operatorResolver: () => resolverValue }); await createVoyageEventSession(request(definition(), encounterValue), fixture.context); const result = dispatchVoyageEventSessionCommand(command({ requestId: "operator-request" }), makeContext({ journals: fixture.journals, authenticatedUserId: "player-1", activeGmUserId: "gm-1", operatorResolver: () => resolverValue }).context); assertFailure(result, "m11-command-not-allowed", "request.commandKind", "Command is not allowed in the current session state."); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
  }
});
