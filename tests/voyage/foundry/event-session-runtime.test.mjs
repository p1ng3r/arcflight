import test from "node:test";
import assert from "node:assert/strict";
import * as runtime from "../../../scripts/voyage/foundry/event-session-runtime.js";
import { createVoyageEventSession, dispatchVoyageEventSessionCommand, recoverVoyageEventSession, reloadVoyageEventSession, transferVoyageEventSessionControl } from "../../../scripts/voyage/foundry/event-session-runtime.js";
import { createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";

function definition() { return { schemaVersion: 1, eventId: "event-1", definitionSnapshotId: "definition-1", title: "Cinderwake" }; }
function encounter() { return { ...createDraftVoyageEncounterDefaults(), encounterId: "event-1", definitionId: "event-1", definitionRef: null, primaryShip: { id: "ship-1", preserved: true } }; }
function request(definitionValue = definition(), encounterValue = encounter()) {
  return { kind: "voyage.m11-create-session", requestId: "request-1", sessionId: "session-1", eventId: "event-1", definitionSnapshotId: "definition-1", shipId: "ship-1", eventDefinition: definitionValue, initialEncounterState: encounterValue };
}
function command(overrides = {}) { return { kind: "voyage.m11-command", requestId: "command-1", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, commandKind: "pause", payload: {}, ...overrides }; }
function transferRequest(overrides = {}) { return { kind: "voyage.m11-transfer-control", requestId: "transfer-1", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, targetUserId: "gm-1", reason: "election" , ...overrides }; }
function persistSession(document, payload) { document.__testSource.flags.arcflight.system.voyageSession = structuredClone(payload["flags.arcflight.system.voyageSession"]); return document; }
function deferred() { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
function makeCoordinator({ rejectContenders = false, immediate = false, occurredAt = "2026-08-10T12:00:00.000Z" } = {}) {
  const queues = new Map(), active = new Set();
  return {
    descriptors: [], callbacks: 0, releases: 0, witnessFactory: (descriptor) => ({ connectionId: descriptor.connectionId, occurredAt }),
    async runExclusiveSessionMutation(descriptor, callback) {
      this.descriptors.push(structuredClone(descriptor));
      if (rejectContenders && active.has(descriptor.sessionId)) return null;
      if (immediate) { this.callbacks += 1; try { return await callback(this.witnessFactory(descriptor)); } finally { this.releases += 1; } }
      const prior = queues.get(descriptor.sessionId) ?? Promise.resolve();
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      const queued = prior.then(() => gate);
      queues.set(descriptor.sessionId, queued);
      await prior;
      active.add(descriptor.sessionId); this.callbacks += 1;
      try { return await callback(this.witnessFactory(descriptor)); }
      finally {
        active.delete(descriptor.sessionId); release(); this.releases += 1;
        if (queues.get(descriptor.sessionId) === queued) queues.delete(descriptor.sessionId);
      }
    }
  };
}
function makeJournalDocument(data, tracker, journals, { id = data._id, flags = data.flags, persist = true } = {}) {
  const source = { _id: id, name: data.name ?? "Preserved JournalEntry", pages: [{ name: "Preserved page", text: { content: "keep" } }], ownership: structuredClone(data.ownership), folder: { id: "folder-1" }, sort: 42, flags: structuredClone(flags) };
  const document = {
    __isJournalEntry: true, __testSource: source,
    get id() { return source._id; }, get name() { return source.name; }, get pages() { return source.pages; }, get ownership() { return source.ownership; }, get folder() { return source.folder; }, get sort() { return source.sort; },
    toObject() { return source; },
    async update(payload, options) { tracker.updates += 1; return tracker.updateHandler ? tracker.updateHandler(this, payload, options) : this; },
    async delete() { tracker.deletes += 1; tracker.deletedIds.push(this.id); const index = journals.indexOf(this); if (index >= 0) journals.splice(index, 1); return this; }
  };
  if (persist) journals.push(document);
  return document;
}
function makeContext({ journals = [], documentId = "Journal.session-1", definitionValue = definition(), encounterValue = encounter(), create = null, authenticatedUserId = "gm-1", authenticatedConnectionId = authenticatedUserId ? `connection-${authenticatedUserId}` : null, trustedTransportContext = true, activeGmUserId = "gm-1", users = null, operatorResolver = null, update = null, timestamp = "2026-08-10T12:00:00.000Z", coordinator = null } = {}) {
  const tracker = { creates: 0, updates: 0, deletes: 0, deletedIds: [], createOperations: [], resolverCalls: 0, builderCalls: 0, idCalls: 0, journalScans: 0, updateHandler: update };
  const mutationCoordinator = coordinator ?? makeCoordinator();
  const JournalEntry = { async create(data, operation) { tracker.creates += 1; tracker.createOperations.push(operation); const effective = { ...data, _id: operation?.keepId === true ? data._id : "Journal.generated-by-foundry" }; return create ? create(effective, tracker, journals, (options) => makeJournalDocument(effective, tracker, journals, options)) : makeJournalDocument(effective, tracker, journals); } };
  const context = {
    authenticatedUserId, authenticatedConnectionId, trustedTransportContext, activeGmUserId,
    users: users ?? [{ id: "gm-1", isGM: true, active: true }, { id: "gm-2", isGM: true, active: true }, { id: "player-1", isGM: false, active: true }],
    createDocumentId: () => { tracker.idCalls += 1; return documentId; },
    resolveEventDefinitionSnapshot: async () => { tracker.resolverCalls += 1; return structuredClone(definitionValue); },
    createInitialEncounterState: async () => { tracker.builderCalls += 1; return structuredClone(encounterValue); },
    createVoyageTimestamp: () => timestamp,
    runExclusiveSessionMutation: mutationCoordinator.runExclusiveSessionMutation.bind(mutationCoordinator),
    ...(operatorResolver ? { resolveVoyageOperatorForPrincipal: operatorResolver } : {}),
    JournalEntry, isJournalEntryDocument: (document) => document?.__isJournalEntry === true
  };
  Object.defineProperty(context, "journalEntries", { enumerable: true, get() { tracker.journalScans += 1; return journals; } });
  return { context, journals, tracker, coordinator: mutationCoordinator };
}
function session(document) { return document.__testSource.flags.arcflight.system.voyageSession; }
function assertFailure(result, code, path, message) { assert.equal(result.ok, false); assert.deepEqual(Object.keys(result), ["ok", "requestId", "sessionId", "status", "revision", "authorityEpoch", "projection", "events", "errors", "warnings"]); assert.equal(result.errors.length, 1); assert.deepEqual(result.errors[0], { code, path, message, severity: "error" }); assert.deepEqual(result.events, []); assert.deepEqual(result.warnings, []); }
function pristineKeys(value) { assert.deepEqual(Object.keys(value), ["schemaVersion", "sessionDocumentId", "sessionId", "eventId", "definitionSnapshotId", "shipId", "revision", "sessionState", "activeGmUserId", "authorityEpoch", "encounterState", "events", "checkpoints", "processedRequests", "closeout", "recovery", "auditHistory"]); }
function addRecoveryCheckpoint(stored, kind = "before-plan-lock") {
  stored.checkpoints.push({ checkpointId: `arcflight-voyage-checkpoint:${JSON.stringify([stored.sessionId, kind, stored.revision])}`, kind, sessionId: stored.sessionId, revision: stored.revision, encounterRevision: stored.encounterState.revision, eventCount: stored.events.length, sessionState: stored.sessionState, encounterState: structuredClone(stored.encounterState), closeout: structuredClone(stored.closeout), authorityEpoch: stored.authorityEpoch, invalidated: false });
}
function markRecoveryRequired(stored) {
  stored.sessionState = "recovery-required";
  stored.encounterState.lifecycleState = "recovery";
  stored.recovery = { status: "required", reasonCode: "m11-recovery-required", failedRequestId: "failed", failedRevision: stored.revision, checkpointId: null, sourceCheckpointRevision: null, recoveryAuthorityUserId: null };
}

test("M11 runtime exposes the Task 4 recovery boundary", () => assert.deepEqual(Object.keys(runtime).sort(), ["createVoyageEventSession", "dispatchVoyageEventSessionCommand", "recoverVoyageEventSession", "reloadVoyageEventSession", "transferVoyageEventSessionControl"]));

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

test("ordinary control transfer reauthorizes the current GM with one exact write and audit pair", async () => {
  const fixture = makeContext({ update: persistSession });
  assert.equal((await createVoyageEventSession(request(), fixture.context)).ok, true);
  const before = structuredClone(fixture.journals[0].__testSource);
  const result = await transferVoyageEventSessionControl(transferRequest(), fixture.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.authorityEpoch, 1); assert.equal(result.revision, 0); assert.equal(result.projection, null);
  assert.equal(fixture.tracker.updates, 1); assert.equal(fixture.tracker.creates, 1); assert.equal(fixture.tracker.deletes, 0);
  const stored = session(fixture.journals[0]); assert.equal(stored.activeGmUserId, "gm-1"); assert.equal(stored.authorityEpoch, 1);
  assert.deepEqual(stored.events, []); assert.deepEqual(stored.checkpoints, []); assert.deepEqual(stored.encounterState, JSON.parse(JSON.stringify(stored.encounterState)));
  assert.equal(stored.processedRequests.length, 2); assert.equal(stored.auditHistory.length, 1);
  assert.deepEqual(Object.keys(stored.auditHistory[0]), ["auditId", "kind", "sessionId", "requestId", "actorUserId", "authorityEpoch", "previousRevision", "revision", "occurredAt", "details"]);
  assert.equal(stored.auditHistory[0].kind, "control-transfer"); assert.deepEqual(stored.auditHistory[0].details, { previousActiveGmUserId: "gm-1", nextActiveGmUserId: "gm-1", bootstrap: false, reason: "election" });
  assert.equal(stored.auditHistory[0].auditId, `arcflight-voyage-audit:${JSON.stringify(["session-1", 0, "control-transfer"])}`);
  assert.deepEqual(stored.processedRequests[0].response.authorityEpoch, 0);
  assert.deepEqual(before.name, fixture.journals[0].name); assert.deepEqual(before.pages, fixture.journals[0].pages); assert.deepEqual(before.flags.otherModule, fixture.journals[0].__testSource.flags.otherModule);
});

test("bootstrap transfer adopts the connected current GM and preserves historical creation evidence", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  const context = makeContext({ journals: fixture.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-2", update: persistSession });
  const result = await transferVoyageEventSessionControl(transferRequest({ targetUserId: "gm-2", reason: "new election" }), context.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors)); assert.equal(result.authorityEpoch, 1);
  const stored = session(fixture.journals[0]); assert.equal(stored.activeGmUserId, "gm-2"); assert.equal(stored.auditHistory[0].kind, "control-transfer-bootstrap"); assert.equal(stored.auditHistory[0].details.bootstrap, true);
  assert.equal(stored.processedRequests[0].response.authorityEpoch, 0); assert.equal(stored.processedRequests[1].response.authorityEpoch, 1);
  assert.equal(fixture.tracker.updates, 1); assert.equal(context.tracker.updates, 0);
});

test("exact historical transfer replay is isolated and write-free before coordinator entry; changed data and old-epoch new requests conflict", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  const first = await transferVoyageEventSessionControl(transferRequest(), fixture.context); assert.equal(first.ok, true);
  const replayBeforeAdvance = await transferVoyageEventSessionControl(transferRequest(), fixture.context); assert.deepEqual(replayBeforeAdvance, first); replayBeforeAdvance.status = "mutated";
  assert.equal(fixture.coordinator.callbacks, 1); assert.equal(fixture.tracker.updates, 1);
  const second = await transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-2", authorityEpoch: 1 }), fixture.context); assert.equal(second.ok, true);
  const callbacksBeforeReplay = fixture.coordinator.callbacks, updatesBeforeReplay = fixture.tracker.updates;
  const replayAfterAdvance = await transferVoyageEventSessionControl(transferRequest(), fixture.context); assert.deepEqual(replayAfterAdvance, first);
  assert.equal(fixture.coordinator.callbacks, callbacksBeforeReplay); assert.equal(fixture.tracker.updates, updatesBeforeReplay);
  assertFailure(await transferVoyageEventSessionControl(transferRequest({ reason: "changed" }), fixture.context), "m11-request-id-conflict", "request.requestId", "Request ID was previously used with different data.");
  assertFailure(await transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-2", authorityEpoch: 0 }), fixture.context), "m11-request-id-conflict", "request.requestId", "Request ID was previously used with different data.");
  assertFailure(await transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-3", authorityEpoch: 0 }), fixture.context), "m11-control-transfer-required", "authorityEpoch", "Event Session control has transferred.");
  assert.equal(fixture.tracker.updates, 2); assert.equal(fixture.tracker.deletes, 0);
});

test("historical replay bypasses a coordinator that rejects old epochs", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  const first = await transferVoyageEventSessionControl(transferRequest(), fixture.context); assert.equal(first.ok, true);
  const second = await transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-2", authorityEpoch: 1 }), fixture.context); assert.equal(second.ok, true);
  let invocations = 0;
  fixture.context.runExclusiveSessionMutation = async (descriptor) => { invocations += 1; if (descriptor.expectedAuthorityEpoch < session(fixture.journals[0]).authorityEpoch) throw new Error("stale lease"); return null; };
  const replay = await transferVoyageEventSessionControl(transferRequest(), fixture.context); assert.deepEqual(replay, first); assert.equal(invocations, 0); assert.equal(fixture.tracker.updates, 2);
});

test("historical request-ID conflicts cover target, reason, principal, revision, and epoch changes", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); assert.equal((await transferVoyageEventSessionControl(transferRequest(), fixture.context)).ok, true);
  const variants = [
    transferRequest({ targetUserId: "gm-2" }),
    transferRequest({ reason: "changed" }),
    transferRequest({ expectedRevision: 1 }),
    transferRequest({ authorityEpoch: 1 })
  ];
  for (const value of variants) assertFailure(await transferVoyageEventSessionControl(value, fixture.context), "m11-request-id-conflict", "request.requestId", "Request ID was previously used with different data.");
  const principalFixture = makeContext({ journals: fixture.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-2", update: persistSession });
  assertFailure(await transferVoyageEventSessionControl(transferRequest(), principalFixture.context), "m11-request-id-conflict", "request.requestId", "Request ID was previously used with different data.");
  assert.equal(fixture.tracker.updates, 1); assert.equal(principalFixture.tracker.updates, 0);
});

test("multiple transfers preserve dense epoch continuity and reload historical records", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  assert.equal((await transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-a" }), fixture.context)).ok, true);
  assert.equal((await transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-b", authorityEpoch: 1 }), fixture.context)).ok, true);
  const stored = session(fixture.journals[0]); assert.equal(stored.authorityEpoch, 2); assert.equal(stored.processedRequests.length, 3); assert.equal(stored.auditHistory.length, 2);
  assert.deepEqual(stored.auditHistory.map((entry) => entry.authorityEpoch), [1, 2]); assert.deepEqual(stored.auditHistory.map((entry) => entry.details.previousActiveGmUserId), ["gm-1", "gm-1"]);
  assert.equal(reloadVoyageEventSession("session-1", fixture.context).ok, true); assert.equal(fixture.tracker.updates, 2);
});

test("transfer rejects non-current targets and unsupported dispatch vocabulary without writes", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  for (const targetUserId of ["gm-2", "player-1", "missing"]) {
    assertFailure(await transferVoyageEventSessionControl(transferRequest({ targetUserId, requestId: `target-${targetUserId}` }), fixture.context), "m11-control-transfer-target-invalid", "request.targetUserId", "Control-transfer target must be the unique current active GM.");
  }
  assertFailure(dispatchVoyageEventSessionCommand(command({ commandKind: "control-transfer" }), fixture.context), "m11-command-not-allowed", "request.commandKind", "Command is not allowed in the current session state.");
  assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
});

test("transfer authority and final reread failures are write-free or classified without a second write", async () => {
  const unauthenticated = makeContext({ authenticatedUserId: null }); assertFailure(await transferVoyageEventSessionControl(transferRequest({ targetUserId: "gm-1" }), unauthenticated.context), "m11-authentication-required", "transport.user", "Authenticated transport user is required.");
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  const changing = makeContext({ journals: fixture.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-2", update: persistSession });
  assertFailure(await transferVoyageEventSessionControl(transferRequest({ requestId: "drift", targetUserId: "gm-1" }), changing.context), "m11-control-transfer-target-invalid", "request.targetUserId", "Control-transfer target must be the unique current active GM.");
  assert.equal(fixture.tracker.updates, 0);
  const divergent = makeContext({ update() { return this; } }); await createVoyageEventSession(request(), divergent.context);
  const result = await transferVoyageEventSessionControl(transferRequest({ requestId: "write-failed" }), divergent.context); assert.equal(result.ok, false); assert.equal(result.errors[0].code, "m11-session-write-failed"); assert.equal(divergent.tracker.updates, 1);
});

test("same-session transfers serialize and the queued loser observes the advanced epoch", async () => {
  const entered = deferred(), release = deferred(); let updateCalls = 0;
  const fixture = makeContext({ update: async (document, payload) => { updateCalls += 1; if (updateCalls === 1) { entered.resolve(); await release.promise; } return persistSession(document, payload); } });
  await createVoyageEventSession(request(), fixture.context);
  const firstPromise = transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-a" }), fixture.context);
  await entered.promise;
  const secondPromise = transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-b" }), fixture.context);
  release.resolve();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal([first.ok, second.ok].filter(Boolean).length, 1); const loser = first.ok ? second : first;
  assertFailure(loser, "m11-control-transfer-required", "authorityEpoch", "Event Session control has transferred.");
  assert.equal(updateCalls, 1); assert.equal(fixture.tracker.updates, 1); assert.equal(session(fixture.journals[0]).authorityEpoch, 1); assert.equal(session(fixture.journals[0]).processedRequests.length, 2); assert.equal(session(fixture.journals[0]).auditHistory.length, 1);
});

test("two simultaneous identical new requests persist once and the queued caller replays", async () => {
  const entered = deferred(), release = deferred(); let updateCalls = 0;
  const fixture = makeContext({ update: async (document, payload) => { updateCalls += 1; entered.resolve(); await release.promise; return persistSession(document, payload); } }); await createVoyageEventSession(request(), fixture.context);
  const first = transferVoyageEventSessionControl(transferRequest({ requestId: "same-transfer" }), fixture.context); await entered.promise;
  const second = transferVoyageEventSessionControl(transferRequest({ requestId: "same-transfer" }), fixture.context); release.resolve();
  const [winner, replay] = await Promise.all([first, second]); assert.equal(winner.ok, true); assert.deepEqual(replay, winner); assert.equal(updateCalls, 1); assert.equal(fixture.tracker.updates, 1); assert.equal(session(fixture.journals[0]).processedRequests.length, 2); assert.equal(session(fixture.journals[0]).auditHistory.length, 1);
});

test("three same-runtime callers cannot overlap or delete a newer local lock", async () => {
  const enteredA = deferred(), enteredB = deferred(), releaseA = deferred(), releaseB = deferred(); let updateCalls = 0;
  const fixture = makeContext({ coordinator: makeCoordinator({ immediate: true }), update: async (document, payload) => { updateCalls += 1; if (updateCalls === 1) { enteredA.resolve(); await releaseA.promise; } if (updateCalls === 2) { enteredB.resolve(); await releaseB.promise; } return persistSession(document, payload); } });
  await createVoyageEventSession(request(), fixture.context);
  const a = transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-a" }), fixture.context); await enteredA.promise;
  const b = transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-b", authorityEpoch: 1 }), fixture.context);
  const c = transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-c", authorityEpoch: 1 }), fixture.context);
  releaseA.resolve(); await enteredB.promise; releaseB.resolve();
  const results = await Promise.all([a, b, c]); assert.equal(results.filter((result) => result.ok).length, 2);
  for (const result of results.filter((value) => !value.ok)) assertFailure(result, "m11-control-transfer-required", "authorityEpoch", "Event Session control has transferred.");
  assert.equal(updateCalls, 2); assert.equal(fixture.tracker.updates, 2); assert.equal(fixture.coordinator.releases, 3);
});

test("different sessions use independent transfer critical sections", async () => {
  const enteredOne = deferred(), enteredTwo = deferred(), releaseOne = deferred(), releaseTwo = deferred();
  const coordinator = makeCoordinator({ rejectContenders: true });
  const fixtureOne = makeContext({ coordinator, documentId: "Journal.session-1", update: async (document, payload) => { enteredOne.resolve(); await releaseOne.promise; return persistSession(document, payload); } });
  const definitionTwo = definition(); definitionTwo.eventId = "event-2"; definitionTwo.definitionSnapshotId = "definition-2"; const encounterTwo = encounter(); encounterTwo.encounterId = "event-2"; encounterTwo.definitionId = "event-2"; encounterTwo.primaryShip.id = "ship-2";
  const fixtureTwo = makeContext({ coordinator, documentId: "Journal.session-2", definitionValue: definitionTwo, encounterValue: encounterTwo, update: async (document, payload) => { enteredTwo.resolve(); await releaseTwo.promise; return persistSession(document, payload); } });
  const requestTwo = request(definitionTwo, encounterTwo); requestTwo.requestId = "request-2"; requestTwo.sessionId = "session-2"; requestTwo.eventId = "event-2"; requestTwo.definitionSnapshotId = "definition-2"; requestTwo.shipId = "ship-2";
  await createVoyageEventSession(request(), fixtureOne.context); await createVoyageEventSession(requestTwo, fixtureTwo.context);
  const firstPromise = transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-one" }), fixtureOne.context);
  const secondPromise = transferVoyageEventSessionControl(transferRequest({ requestId: "transfer-two", sessionId: "session-2" }), fixtureTwo.context);
  await Promise.all([enteredOne.promise, enteredTwo.promise]); releaseOne.resolve(); releaseTwo.resolve();
  const [first, second] = await Promise.all([firstPromise, secondPromise]); assert.equal(first.ok, true); assert.equal(second.ok, true); assert.equal(fixtureOne.tracker.updates, 1); assert.equal(fixtureTwo.tracker.updates, 1);
});

test("a failed transfer releases its session lock for a later valid call", async () => {
  let fail = true;
  const fixture = makeContext({ update: async (document, payload) => { if (fail) { fail = false; throw new Error("update failed"); } return persistSession(document, payload); } }); await createVoyageEventSession(request(), fixture.context);
  const failed = await transferVoyageEventSessionControl(transferRequest({ requestId: "failed-transfer" }), fixture.context); assertFailure(failed, "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify.");
  const recovered = await transferVoyageEventSessionControl(transferRequest({ requestId: "retry-transfer" }), fixture.context); assert.equal(recovered.ok, true); assert.equal(fixture.tracker.updates, 2);
});

test("transfer requires trusted coordinator evidence after replay preflight and before persistence", async () => {
  for (const mutate of [
    (context) => { delete context.runExclusiveSessionMutation; },
    (context) => { context.trustedTransportContext = false; },
    (context) => { context.authenticatedConnectionId = ""; }
  ]) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); const scans = fixture.tracker.journalScans; mutate(fixture.context);
    const result = await transferVoyageEventSessionControl(transferRequest(), fixture.context);
    assertFailure(result, "m11-cross-client-coordinator-required", "transport.coordinator", "A trusted cross-client mutation coordinator is required."); assert.ok(fixture.tracker.journalScans >= scans); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
  }
});

test("coordinator descriptor binds document, revisions, user, connection, and active GM", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  assert.equal((await transferVoyageEventSessionControl(transferRequest(), fixture.context)).ok, true);
  assert.deepEqual(Object.keys(fixture.coordinator.descriptors[0]), ["sessionId", "sessionDocumentId", "expectedRevision", "expectedAuthorityEpoch", "authenticatedUserId", "connectionId", "activeGmUserId"]);
  assert.deepEqual(fixture.coordinator.descriptors[0], { sessionId: "session-1", sessionDocumentId: "Journal.session-1", expectedRevision: 0, expectedAuthorityEpoch: 0, authenticatedUserId: "gm-1", connectionId: "connection-gm-1", activeGmUserId: "gm-1" }); assert.equal(fixture.coordinator.releases, 1);
});

test("coordinator callback requires a frozen transport witness", async () => {
  let witnessed = null;
  const coordinator = { async runExclusiveSessionMutation(descriptor, callback) { witnessed = { keys: Object.keys({ connectionId: descriptor.connectionId, occurredAt: "2026-08-10T12:00:00.000Z" }), result: await callback(Object.freeze({ connectionId: descriptor.connectionId, occurredAt: "2026-08-10T12:00:00.000Z" })) }; return witnessed.result; } };
  const fixture = makeContext({ coordinator, update: persistSession }); await createVoyageEventSession(request(), fixture.context); const result = await transferVoyageEventSessionControl(transferRequest(), fixture.context); assert.equal(result.ok, true); assert.deepEqual(witnessed.keys, ["connectionId", "occurredAt"]); assert.equal(fixture.tracker.updates, 1);
});

test("fabricated coordinator success without callback fails closed", async () => {
  const coordinator = { async runExclusiveSessionMutation() { return { ok: true, requestId: "fake", sessionId: "session-1", status: "setup", revision: 0, authorityEpoch: 1, projection: null, events: [], errors: [], warnings: [] }; } };
  const fixture = makeContext({ coordinator }); await createVoyageEventSession(request(), fixture.context); const result = await transferVoyageEventSessionControl(transferRequest(), fixture.context); assertFailure(result, "m11-cross-client-coordinator-required", "transport.coordinator", "A trusted cross-client mutation coordinator is required."); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
});

test("coordinator returning a different envelope than the callback fails without false success", async () => {
  const coordinator = { async runExclusiveSessionMutation(descriptor, callback) { const result = await callback({ connectionId: descriptor.connectionId, occurredAt: "2026-08-10T12:00:00.000Z" }); return { ...result, authorityEpoch: result.authorityEpoch + 1 }; } };
  const fixture = makeContext({ coordinator, update: persistSession }); await createVoyageEventSession(request(), fixture.context); const result = await transferVoyageEventSessionControl(transferRequest(), fixture.context); assertFailure(result, "m11-cross-client-coordinator-required", "transport.coordinator", "A trusted cross-client mutation coordinator is required."); assert.equal(fixture.tracker.updates, 1); assert.equal(session(fixture.journals[0]).processedRequests.length, 2); assert.equal(session(fixture.journals[0]).auditHistory.length, 1);
});

test("coordinator callback invoked twice is invalid and cannot duplicate persistence", async () => {
  const coordinator = { async runExclusiveSessionMutation(descriptor, callback) { const witness = { connectionId: descriptor.connectionId, occurredAt: "2026-08-10T12:00:00.000Z" }; const result = await callback(witness); try { await callback(witness); } catch {} return result; } };
  const fixture = makeContext({ coordinator, update: persistSession }); await createVoyageEventSession(request(), fixture.context); const result = await transferVoyageEventSessionControl(transferRequest(), fixture.context); assertFailure(result, "m11-cross-client-coordinator-required", "transport.coordinator", "A trusted cross-client mutation coordinator is required."); assert.equal(fixture.tracker.updates, 1); assert.equal(session(fixture.journals[0]).processedRequests.length, 2); assert.equal(session(fixture.journals[0]).auditHistory.length, 1);
});

test("invalid transport witness has no client-clock fallback", async () => {
  const coordinator = makeCoordinator({ occurredAt: "not-a-timestamp" }); const fixture = makeContext({ coordinator, timestamp: "2026-08-10T12:00:00.000Z", update: persistSession }); await createVoyageEventSession(request(), fixture.context); const result = await transferVoyageEventSessionControl(transferRequest(), fixture.context); assertFailure(result, "m11-cross-client-coordinator-required", "transport.coordinator", "A trusted cross-client mutation coordinator is required."); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
});

test("two independent clients with one same-user coordinator elect one winner", async () => {
  const entered = deferred(), release = deferred(), coordinator = makeCoordinator({ rejectContenders: true });
  const seed = makeContext({ update: async (document, payload) => { entered.resolve(); await release.promise; return persistSession(document, payload); } }); await createVoyageEventSession(request(), seed.context);
  const clientA = makeContext({ journals: seed.journals, coordinator, authenticatedConnectionId: "connection-a" });
  const clientB = makeContext({ journals: seed.journals, coordinator, authenticatedConnectionId: "connection-b", update: persistSession });
  const first = transferVoyageEventSessionControl(transferRequest({ requestId: "client-a" }), clientA.context); await entered.promise;
  const second = transferVoyageEventSessionControl(transferRequest({ requestId: "client-b" }), clientB.context); const loser = await second; assertFailure(loser, "m11-control-transfer-required", "authorityEpoch", "Event Session control has transferred.");
  release.resolve(); const winner = await first; assert.equal(winner.ok, true); assert.equal(seed.tracker.updates, 1); assert.equal(clientB.tracker.updates, 0); assert.equal(coordinator.callbacks, 1); assert.equal(session(seed.journals[0]).processedRequests.length, 2); assert.equal(session(seed.journals[0]).auditHistory.length, 1); assert.equal(coordinator.releases, 1);
});

test("coordinator rejection and exceptions release authority without writes and permit retry", async () => {
  let attempts = 0, releases = 0; const coordinator = { async runExclusiveSessionMutation(descriptor, callback) { attempts += 1; if (attempts === 1) { releases += 1; throw new Error("coordinator rejected"); } try { return await callback({ connectionId: descriptor.connectionId, occurredAt: "2026-08-10T12:00:00.000Z" }); } finally { releases += 1; } } };
  const fixture = makeContext({ coordinator, update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  const rejected = await transferVoyageEventSessionControl(transferRequest({ requestId: "rejected" }), fixture.context); assertFailure(rejected, "m11-cross-client-coordinator-required", "transport.coordinator", "A trusted cross-client mutation coordinator is required."); assert.equal(fixture.tracker.updates, 0);
  const retried = await transferVoyageEventSessionControl(transferRequest({ requestId: "retried" }), fixture.context); assert.equal(retried.ok, true); assert.equal(fixture.tracker.updates, 1); assert.equal(releases, 2);
});

test("winning coordinator connection drift fails before update", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); fixture.coordinator.witnessFactory = (descriptor) => { fixture.context.authenticatedConnectionId = "connection-drifted"; return { connectionId: descriptor.connectionId, occurredAt: "2026-08-10T12:00:00.000Z" }; };
  const result = await transferVoyageEventSessionControl(transferRequest({ requestId: "connection-drift" }), fixture.context); assertFailure(result, "m11-active-gm-required", "transport.connection", "The authenticated user is not the current active GM."); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.coordinator.releases, 1);
  const activeGmDrift = makeContext({ update: persistSession }); await createVoyageEventSession(request(), activeGmDrift.context); activeGmDrift.coordinator.witnessFactory = (descriptor) => { activeGmDrift.context.activeGmUserId = "gm-2"; return { connectionId: descriptor.connectionId, occurredAt: "2026-08-10T12:00:00.000Z" }; };
  const activeResult = await transferVoyageEventSessionControl(transferRequest({ requestId: "active-gm-drift" }), activeGmDrift.context); assertFailure(activeResult, "m11-active-gm-required", "transport.activeGm", "The authenticated user is not the current active GM."); assert.equal(activeGmDrift.tracker.updates, 0); assert.equal(activeGmDrift.coordinator.releases, 1);
});

test("uncertain post-write transfer returns recovery without a second write and releases coordinator", async () => {
  const fixture = makeContext({ update: (document, payload) => { persistSession(document, payload); session(document).authorityEpoch = 99; throw new Error("uncertain"); } }); await createVoyageEventSession(request(), fixture.context);
  const result = await transferVoyageEventSessionControl(transferRequest({ requestId: "uncertain-transfer" }), fixture.context); assertFailure(result, "m11-recovery-required", "recovery", "Event Session requires explicit recovery."); assert.equal(fixture.tracker.updates, 1); assert.equal(fixture.coordinator.releases, 1);
});

test("coordinator and connection authority cannot be supplied in command payload", async () => {
  const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context);
  const result = dispatchVoyageEventSessionCommand(command({ payload: { coordinator: {}, lease: {}, connectionId: "forged", approval: true } }), fixture.context);
  assertFailure(result, "m11-command-payload-invalid", "request.payload", "Command payload is invalid."); assert.equal(fixture.tracker.updates, 0); assert.equal(fixture.tracker.deletes, 0);
});

test("creation and owner identities are independently nonblank and bound", async () => {
  const cases = [
    (stored) => { stored.processedRequests[0].principalUserId = ""; },
    (stored) => { delete stored.processedRequests[0].principalUserId; },
    (stored) => { const tuple = JSON.parse(stored.processedRequests[0].fingerprint); tuple[1] = "gm-2"; stored.processedRequests[0].fingerprint = JSON.stringify(tuple); },
    (stored) => { stored.processedRequests[0].principalUserId = "gm-2"; },
    (stored) => { stored.activeGmUserId = ""; }
  ];
  for (const mutate of cases) { const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context); mutate(session(fixture.journals[0])); assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assertFailure(dispatchVoyageEventSessionCommand(command(), fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(fixture.tracker.updates, 0); }
  const ordinary = makeContext({ update: persistSession }); await createVoyageEventSession(request(), ordinary.context); assert.equal((await transferVoyageEventSessionControl(transferRequest(), ordinary.context)).ok, true);
  const transferStored = session(ordinary.journals[0]); const transferTuple = JSON.parse(transferStored.processedRequests[1].fingerprint);
  transferStored.auditHistory[0].details.previousActiveGmUserId = ""; assertFailure(reloadVoyageEventSession("session-1", ordinary.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid.");
  transferStored.auditHistory[0].details.previousActiveGmUserId = "gm-1"; transferTuple[6].targetUserId = ""; transferStored.processedRequests[1].fingerprint = JSON.stringify(transferTuple); transferStored.activeGmUserId = ""; assertFailure(reloadVoyageEventSession("session-1", ordinary.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid.");
});

test("the exact null bootstrap sentinel is accepted only by transfer and empty-string owner is rejected", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); session(fixture.journals[0]).activeGmUserId = null;
  const bootstrapContext = makeContext({ journals: fixture.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-2" });
  const result = await transferVoyageEventSessionControl(transferRequest({ targetUserId: "gm-2", reason: "bootstrap", requestId: "bootstrap-null" }), bootstrapContext.context); assert.equal(result.ok, true, JSON.stringify(result.errors)); assert.equal(session(fixture.journals[0]).auditHistory[0].details.previousActiveGmUserId, null);
  const forbidden = makeContext({ update: persistSession }); await createVoyageEventSession(request(), forbidden.context); session(forbidden.journals[0]).activeGmUserId = ""; const invalid = await transferVoyageEventSessionControl(transferRequest({ targetUserId: "gm-1", requestId: "empty-owner" }), forbidden.context); assertFailure(invalid, "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(forbidden.tracker.updates, 0);
});

test("Task 4 rebuilds from the latest valid checkpoint with one forward revision and preserves history", async () => {
  const fixture = makeContext({ update: persistSession });
  assert.equal((await createVoyageEventSession(request(), fixture.context)).ok, true);
  const stored = session(fixture.journals[0]);
  stored.checkpoints.push({
    checkpointId: `arcflight-voyage-checkpoint:${JSON.stringify(["session-1", "before-plan-lock", 0])}`,
    kind: "before-plan-lock", sessionId: "session-1", revision: 0, encounterRevision: 0, eventCount: 0, sessionState: "setup",
    encounterState: structuredClone(stored.encounterState), closeout: structuredClone(stored.closeout), authorityEpoch: 0, invalidated: false
  });
  stored.sessionState = "recovery-required"; stored.encounterState.lifecycleState = "recovery"; stored.recovery = { status: "required", reasonCode: "m11-recovery-required", failedRequestId: "failed", failedRevision: 0, checkpointId: null, sourceCheckpointRevision: null, recoveryAuthorityUserId: null };
  const before = structuredClone(stored);
  const result = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "recover-1", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors)); assert.equal(result.revision, 1); assert.equal(fixture.tracker.updates, 1); assert.equal(session(fixture.journals[0]).revision, 1);
  assert.deepEqual(session(fixture.journals[0]).events.map((event) => event.type), ["voyage.m11-recovery-rebuilt"]); assert.equal(session(fixture.journals[0]).checkpoints.length, 2); assert.equal(session(fixture.journals[0]).checkpoints[0].revision, 0); assert.equal(session(fixture.journals[0]).checkpoints[1].revision, 1);
  const replay = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "recover-1", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context);
  assert.deepEqual(replay, result); assert.equal(fixture.tracker.updates, 1); assert.deepEqual(before.checkpoints[0], stored.checkpoints[0]);
});

test("historical recovery records and epochs survive later recovery and control transfer", async () => {
  const fixture = makeContext({ update: persistSession });
  await createVoyageEventSession(request(), fixture.context);
  let stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  const first = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "historical-recovery-1", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair-1" }, fixture.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  stored = session(fixture.journals[0]);
  markRecoveryRequired(stored);
  const second = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "historical-recovery-2", sessionId: "session-1", expectedRevision: 1, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair-2" }, fixture.context);
  assert.equal(second.ok, true, JSON.stringify(second.errors));
  stored = session(fixture.journals[0]);
  assert.equal(stored.processedRequests[1].resultRevision, 1); assert.equal(stored.processedRequests[2].resultRevision, 2);
  assert.equal(reloadVoyageEventSession("session-1", fixture.context).ok, true);
  const transfer = await transferVoyageEventSessionControl(transferRequest({ requestId: "historical-transfer", expectedRevision: 2, authorityEpoch: 0, targetUserId: "gm-2" }), makeContext({ journals: fixture.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-2", update: persistSession }).context);
  assert.equal(transfer.ok, true, JSON.stringify(transfer.errors)); stored = session(fixture.journals[0]); assert.equal(stored.authorityEpoch, 1); assert.equal(reloadVoyageEventSession("session-1", fixture.context).ok, true);
  assert.deepEqual(stored.auditHistory.slice(0, 2).map((entry) => entry.authorityEpoch), [0, 0]);
});

test("bootstrap recovery binds and preserves the adopted GM", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  let stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); stored.activeGmUserId = null; markRecoveryRequired(stored);
  const recoveryContext = makeContext({ journals: fixture.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-2", update: persistSession });
  const result = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "bootstrap-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "adopt" }, recoveryContext.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors)); stored = session(fixture.journals[0]); assert.equal(stored.activeGmUserId, "gm-2"); assert.equal(stored.authorityEpoch, 1); assert.equal(reloadVoyageEventSession("session-1", recoveryContext.context).ok, true);
  assert.equal(stored.auditHistory[0].kind, "recovery-control-transfer"); assert.equal(stored.auditHistory[0].authorityEpoch, 1);
});

test("recovery audit and checkpoint/event cross-bindings fail closed", async () => {
  const mutations = [
    ["audit source id", (stored) => { stored.auditHistory[0].details.sourceCheckpointId = "forged-checkpoint"; }],
    ["audit source revision", (stored) => { stored.auditHistory[0].details.sourceCheckpointRevision = 99; }],
    ["audit replay count", (stored) => { stored.auditHistory[0].details.replayedEventCount = 99; }],
    ["audit authority", (stored) => { stored.auditHistory[0].details.recoveryAuthorityUserId = "gm-2"; }],
    ["stored response event", (stored) => { stored.processedRequests[1].response.events = [{ private: "leak" }]; }],
    ["event authority", (stored) => { stored.events[0].recoveryAuthorityUserId = "gm-2"; }],
    ["event revision", (stored) => { stored.events[0].revision = 2; stored.events[0].previousRevision = 1; }],
    ["checkpoint linkage", (stored) => { stored.events[0].sourceCheckpointId = "forged-checkpoint"; }]
  ];
  for (const [name, mutate] of mutations) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); let stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
    const recovered = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `binding-${name}`, sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context); assert.equal(recovered.ok, true, name); stored = session(fixture.journals[0]);
    mutate(stored); const result = reloadVoyageEventSession("session-1", fixture.context); assertFailure(result, "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(fixture.tracker.creates, 1); assert.equal(fixture.tracker.updates, 1, name); assert.equal(fixture.tracker.deletes, 0, name);
  }
});

test("M11 runtime event revisions are unique and strictly continuous", async () => {
  const mutations = [
    ["duplicate", (stored) => { stored.events[1].previousRevision = stored.events[0].previousRevision; stored.events[1].revision = stored.events[0].revision; }],
    ["skipped", (stored) => { stored.revision = 3; stored.events[1].previousRevision = 2; stored.events[1].revision = 3; }],
    ["mismatched previous", (stored) => { stored.events[1].previousRevision = 0; }],
    ["forged consistent duplicate", (stored) => { stored.events[1] = structuredClone(stored.events[0]); }]
  ];
  for (const [name, mutate] of mutations) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); let stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
    assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `${name}-1`, sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair-1" }, fixture.context)).ok, true);
    stored = session(fixture.journals[0]); markRecoveryRequired(stored);
    assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `${name}-2`, sessionId: "session-1", expectedRevision: 1, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair-2" }, fixture.context)).ok, true); stored = session(fixture.journals[0]);
    mutate(stored); const result = reloadVoyageEventSession("session-1", fixture.context); assertFailure(result, "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(fixture.tracker.updates, 2, name);
  }
});

test("historical checkpoint authority survives a later control transfer", async () => {
  const fixture = makeContext({ update: persistSession });
  await createVoyageEventSession(request(), fixture.context);
  const stored = session(fixture.journals[0]);
  stored.checkpoints.push({ checkpointId: `arcflight-voyage-checkpoint:${JSON.stringify(["session-1", "before-plan-lock", 0])}`, kind: "before-plan-lock", sessionId: "session-1", revision: 0, encounterRevision: 0, eventCount: 0, sessionState: "setup", encounterState: structuredClone(stored.encounterState), closeout: structuredClone(stored.closeout), authorityEpoch: 0, invalidated: false });
  const transferred = await transferVoyageEventSessionControl(transferRequest({ targetUserId: "gm-2", requestId: "checkpoint-transfer" }), makeContext({ journals: fixture.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-2", update: persistSession }).context);
  assert.equal(transferred.ok, true, JSON.stringify(transferred.errors)); assert.equal(session(fixture.journals[0]).checkpoints[0].authorityEpoch, 0); assert.equal(reloadVoyageEventSession("session-1", fixture.context).ok, true);
});

test("invalidated checkpoints require an audited recovery identity", async () => {
  const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context); const stored = session(fixture.journals[0]);
  stored.checkpoints.push({ checkpointId: `arcflight-voyage-checkpoint:${JSON.stringify(["session-1", "before-plan-lock", 0])}`, kind: "before-plan-lock", sessionId: "session-1", revision: 0, encounterRevision: 0, eventCount: 0, sessionState: "setup", encounterState: structuredClone(stored.encounterState), closeout: structuredClone(stored.closeout), authorityEpoch: 0, invalidated: true });
  assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(fixture.tracker.updates, 0);
});

test("Task 4 rejects closeout-review runtime evidence until its owning slice exists", async () => {
  const variants = [
    ["bare event", (stored, event) => { stored.events = [event]; }],
    ["forged audit", (stored, event) => { stored.events = [event]; stored.auditHistory = [{ kind: "closeout-review-accepted", requestId: "forged" }]; }],
    ["mismatched audit", (stored, event) => { stored.events = [event]; stored.auditHistory = [{ kind: "control-transfer", requestId: "wrong" }]; }],
    ["forged accepted evidence", (stored, event) => { stored.events = [event]; stored.closeout = { ...stored.closeout, status: "accepted-for-application", applicationId: "forged", closeoutId: "forged", acceptedApplicationPlan: { forged: true }, expectedEncounterRevision: 0, expectedShipRevision: 0 }; }]
  ];
  for (const [name, mutate] of variants) {
    const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context); const stored = session(fixture.journals[0]);
    stored.revision = 1; stored.sessionState = "event-closeout-review"; stored.encounterState.lifecycleState = "active"; stored.encounterState.phase = "cleanup-advance";
    const event = { type: "voyage.m11-closeout-review-accepted", sessionId: "session-1", eventId: "event-1", definitionSnapshotId: "definition-1", shipId: "ship-1", sourceCheckpointId: null, sourceCheckpointRevision: null, recoveryAuthorityUserId: null, previousRevision: 0, revision: 1 };
    mutate(stored, event);
    assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid.", name);
    assert.equal(fixture.tracker.updates, 0, name); assert.equal(fixture.tracker.creates, 1, name); assert.equal(fixture.tracker.deletes, 0, name);
  }
});

test("recovery validates the complete checkpoint journal before selecting a source", async () => {
  const cases = [
    ["lower event count", (stored) => {
      stored.revision = 2; stored.events = [{ type: "voyage.m11-recovery-rebuilt", sessionId: "session-1", eventId: "event-1", definitionSnapshotId: "definition-1", shipId: "ship-1", sourceCheckpointId: "arcflight-voyage-checkpoint:[\"session-1\",\"before-plan-lock\",0]", sourceCheckpointRevision: 0, recoveryAuthorityUserId: "gm-1", previousRevision: 0, revision: 1 }];
      addRecoveryCheckpoint(stored, "before-plan-lock"); stored.revision = 2; addRecoveryCheckpoint(stored, "after-recovery"); stored.checkpoints[1].eventCount = 0;
    }],
    ["duplicate checkpoint id", (stored) => { addRecoveryCheckpoint(stored); stored.revision = 1; addRecoveryCheckpoint(stored, "after-recovery"); stored.checkpoints[1].checkpointId = stored.checkpoints[0].checkpointId; }],
    ["skipped checkpoint revision", (stored) => { addRecoveryCheckpoint(stored); stored.revision = 2; addRecoveryCheckpoint(stored, "after-recovery"); }],
    ["misordered checkpoint revision", (stored) => { addRecoveryCheckpoint(stored); stored.revision = 1; addRecoveryCheckpoint(stored, "after-recovery"); [stored.checkpoints[0].revision, stored.checkpoints[1].revision] = [1, 0]; stored.checkpoints[0].checkpointId = `arcflight-voyage-checkpoint:${JSON.stringify([stored.sessionId, stored.checkpoints[0].kind, 1])}`; stored.checkpoints[1].checkpointId = `arcflight-voyage-checkpoint:${JSON.stringify([stored.sessionId, stored.checkpoints[1].kind, 0])}`; }],
    ["regressed authority epoch", (stored) => { addRecoveryCheckpoint(stored); stored.revision = 1; addRecoveryCheckpoint(stored, "after-recovery"); stored.checkpoints[1].authorityEpoch = 0; stored.checkpoints[0].authorityEpoch = 1; }],
    ["forged invalidation linkage", (stored) => { addRecoveryCheckpoint(stored); stored.checkpoints[0].invalidated = true; }]
  ];
  for (const [name, mutate] of cases) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); const stored = session(fixture.journals[0]); markRecoveryRequired(stored); mutate(stored);
    const result = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `checkpoint-${name}`, sessionId: "session-1", expectedRevision: stored.revision, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context);
    assertFailure(result, "m11-unrecoverable-session", "flags.arcflight.system.voyageSession", "Immutable Event Session recovery evidence is invalid.", name); assert.equal(fixture.tracker.updates, 0, name); assert.equal(fixture.tracker.deletes, 0, name);
  }
});

test("recovery rejects an M11 event from a later revision inside an earlier checkpoint prefix", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  let stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  const recovered = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "prefix-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context);
  assert.equal(recovered.ok, true, JSON.stringify(recovered.errors)); stored = session(fixture.journals[0]); markRecoveryRequired(stored);
  stored.checkpoints[0].eventCount = 1; stored.auditHistory[0].details.replayedEventCount = 0;
  const result = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "prefix-recovery-forged", sessionId: "session-1", expectedRevision: 1, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context);
  assertFailure(result, "m11-unrecoverable-session", "flags.arcflight.system.voyageSession", "Immutable Event Session recovery evidence is invalid."); assert.equal(fixture.tracker.updates, 1); assert.equal(fixture.tracker.deletes, 0);
});

test("reload applies the canonical checkpoint-journal continuity rules", async () => {
  const skipped = makeContext({ update: persistSession }); await createVoyageEventSession(request(), skipped.context); let stored = session(skipped.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "reload-skip-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, skipped.context)).ok, true);
  stored = session(skipped.journals[0]); stored.revision = 2; stored.checkpoints[1].revision = 2; stored.checkpoints[1].checkpointId = `arcflight-voyage-checkpoint:${JSON.stringify([stored.sessionId, stored.checkpoints[1].kind, 2])}`;
  assertFailure(reloadVoyageEventSession("session-1", skipped.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(skipped.tracker.updates, 1);

  const regressedEpoch = makeContext({ update: persistSession }); await createVoyageEventSession(request(), regressedEpoch.context); stored = session(regressedEpoch.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "reload-epoch-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, regressedEpoch.context)).ok, true);
  const transferContext = makeContext({ journals: regressedEpoch.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-2", update: persistSession });
  assert.equal((await transferVoyageEventSessionControl(transferRequest({ requestId: "reload-epoch-transfer", expectedRevision: 1, authorityEpoch: 0, targetUserId: "gm-2" }), transferContext.context)).ok, true);
  stored = session(regressedEpoch.journals[0]); stored.checkpoints[0].authorityEpoch = 1;
  assertFailure(reloadVoyageEventSession("session-1", regressedEpoch.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(regressedEpoch.tracker.updates, 2);

  const prefix = makeContext({ update: persistSession }); await createVoyageEventSession(request(), prefix.context); stored = session(prefix.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "reload-prefix-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, prefix.context)).ok, true);
  stored = session(prefix.journals[0]); stored.checkpoints[0].eventCount = 1; stored.auditHistory[0].details.replayedEventCount = 0;
  assertFailure(reloadVoyageEventSession("session-1", prefix.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(prefix.tracker.updates, 1);
});

test("historical transfer numeric fields require nonnegative safe integers", async () => {
  const mutations = [
    ["record resultRevision", (stored) => { stored.processedRequests[1].resultRevision = "0"; }],
    ["fingerprint authority", (stored) => { const tuple = JSON.parse(stored.processedRequests[1].fingerprint); tuple[3] = 1.5; stored.processedRequests[1].fingerprint = JSON.stringify(tuple); }],
    ["fingerprint expected revision", (stored) => { const tuple = JSON.parse(stored.processedRequests[1].fingerprint); tuple[4] = -1; stored.processedRequests[1].fingerprint = JSON.stringify(tuple); }],
    ["response revision", (stored) => { stored.processedRequests[1].response.revision = Number.NaN; }, "m11-hostile-data-capture-failed", "$", "M11 data could not be captured safely."],
    ["response authority", (stored) => { stored.processedRequests[1].response.authorityEpoch = 9007199254740992; }],
    ["audit authority", (stored) => { stored.auditHistory[0].authorityEpoch = "1"; }],
    ["audit previous revision", (stored) => { stored.auditHistory[0].previousRevision = 1.25; }],
    ["audit revision", (stored) => { stored.auditHistory[0].revision = -1; }]
  ];
  for (const [name, mutate] of mutations) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context);
    const transferContext = makeContext({ journals: fixture.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-2", update: persistSession });
    assert.equal((await transferVoyageEventSessionControl(transferRequest({ targetUserId: "gm-2", requestId: `numeric-${name}` }), transferContext.context)).ok, true, name);
    mutate(session(fixture.journals[0]));
    assertFailure(reloadVoyageEventSession("session-1", fixture.context), mutations.find(([label]) => label === name)?.[2] ?? "m11-invalid-session-document", mutations.find(([label]) => label === name)?.[3] ?? "flags.arcflight.system.voyageSession", mutations.find(([label]) => label === name)?.[4] ?? "Stored Event Session is invalid.", name);
    const recovery = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `numeric-recovery-${name}`, sessionId: "session-1", expectedRevision: 0, authorityEpoch: 1, recoveryAction: "rebuild-latest", reason: "repair" }, transferContext.context);
    const recoveryCode = name === "response revision" ? "m11-hostile-data-capture-failed" : "m11-unrecoverable-session";
    const recoveryPath = name === "response revision" ? "$" : "flags.arcflight.system.voyageSession";
    const recoveryMessage = name === "response revision" ? "M11 data could not be captured safely." : "Immutable Event Session recovery evidence is invalid.";
    assertFailure(recovery, recoveryCode, recoveryPath, recoveryMessage, name); assert.equal(fixture.tracker.updates, 1, name); assert.equal(fixture.tracker.deletes, 0, name);
  }
});

test("creation replay response remains the exact canonical creation response after later history", async () => {
  const mutations = [
    ["events", (response) => { response.events = [{ private: true }]; }],
    ["errors", (response) => { response.errors = [{ code: "forged" }]; }],
    ["warnings", (response) => { response.warnings = [{ warning: "forged" }]; }],
    ["projection", (response) => { response.projection = { private: true }; }],
    ["revision", (response) => { response.revision = 99; }],
    ["authority epoch", (response) => { response.authorityEpoch = 99; }],
    ["extra key", (response) => { response.extra = true; }]
  ];
  for (const [name, mutate] of mutations) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); let stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
    assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `creation-recovery-${name}`, sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context)).ok, true, name);
    const transferContext = makeContext({ journals: fixture.journals, authenticatedUserId: "gm-2", activeGmUserId: "gm-2", update: persistSession });
    assert.equal((await transferVoyageEventSessionControl(transferRequest({ requestId: `creation-transfer-${name}`, expectedRevision: 1, authorityEpoch: 0, targetUserId: "gm-2" }), transferContext.context)).ok, true, name);
    stored = session(fixture.journals[0]); mutate(stored.processedRequests[0].response);
    assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid.", name);
    assertFailure(await createVoyageEventSession(request(), fixture.context), "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify.", name); assert.equal(fixture.tracker.creates, 1, name); assert.equal(fixture.tracker.updates, 2, name); assert.equal(fixture.tracker.deletes, 0, name);
  }
});

test("later-owned recovery actions are deferred without a generic rebuild", async () => {
  const fixture = makeContext(); await createVoyageEventSession(request(), fixture.context);
  for (const recoveryAction of ["reconcile-closeout", "abort"]) {
    const result = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `deferred-${recoveryAction}`, sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction, reason: "defer" }, fixture.context);
    assertFailure(result, "m11-command-not-allowed", "request.recoveryAction", "Command is not allowed in the current session state.");
  }
  assert.equal(fixture.tracker.updates, 0);
});

test("recovery fails write-free when authority drifts before the final reread", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); const stored = session(fixture.journals[0]);
  stored.checkpoints.push({ checkpointId: `arcflight-voyage-checkpoint:${JSON.stringify(["session-1", "before-plan-lock", 0])}`, kind: "before-plan-lock", sessionId: "session-1", revision: 0, encounterRevision: 0, eventCount: 0, sessionState: "setup", encounterState: structuredClone(stored.encounterState), closeout: structuredClone(stored.closeout), authorityEpoch: 0, invalidated: false });
  stored.sessionState = "recovery-required"; stored.encounterState.lifecycleState = "recovery"; stored.recovery = { status: "required", reasonCode: "m11-recovery-required", failedRequestId: "failed", failedRevision: 0, checkpointId: null, sourceCheckpointRevision: null, recoveryAuthorityUserId: null };
  fixture.coordinator.witnessFactory = () => { fixture.context.activeGmUserId = "gm-2"; return { connectionId: "connection-gm-1", occurredAt: "2026-08-10T12:00:00.000Z" }; };
  const result = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "drifted-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context);
  assertFailure(result, "m11-active-gm-required", "transport.activeGm", "The authenticated user is not the current active GM."); assert.equal(fixture.tracker.updates, 0);
});

test("recovery requires trusted connected coordinator and witness evidence", async () => {
  const cases = [
    ["missing connection", (fixture) => { fixture.context.authenticatedConnectionId = null; }],
    ["missing coordinator", (fixture) => { delete fixture.context.runExclusiveSessionMutation; }],
    ["invalid witness", (fixture) => { fixture.coordinator.witnessFactory = () => ({ connectionId: "foreign", occurredAt: "2026-08-10T12:00:00.000Z" }); }]
  ];
  for (const [name, mutate] of cases) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); const stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored); mutate(fixture);
    const result = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `coordinator-${name}`, sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context);
    assertFailure(result, "m11-cross-client-coordinator-required", "transport.coordinator", "A trusted cross-client mutation coordinator is required.", name); assert.equal(fixture.tracker.updates, 0, name);
  }
});

test("same-session recovery contenders serialize with one accepted write", async () => {
  const seed = makeContext({ update: persistSession }); await createVoyageEventSession(request(), seed.context); const stored = session(seed.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  const first = makeContext({ journals: seed.journals, coordinator: seed.coordinator }); const second = makeContext({ journals: seed.journals, coordinator: seed.coordinator });
  const recovery = { kind: "voyage.m11-recover-session", requestId: "same-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" };
  const [winner, replay] = await Promise.all([recoverVoyageEventSession(recovery, first.context), recoverVoyageEventSession(recovery, second.context)]);
  assert.equal(winner.ok, true); assert.equal(replay.ok, true); assert.equal(seed.tracker.updates, 1); assert.equal(seed.coordinator.callbacks, 2);
});

test("a queued new recovery loses on the advanced revision without another write", async () => {
  const seed = makeContext({ update: persistSession }); await createVoyageEventSession(request(), seed.context); const stored = session(seed.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  const first = makeContext({ journals: seed.journals, coordinator: seed.coordinator }); const second = makeContext({ journals: seed.journals, coordinator: seed.coordinator });
  const base = { sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" };
  const [winner, loser] = await Promise.all([recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "recovery-winner", ...base }, first.context), recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "recovery-loser", ...base }, second.context)]);
  assert.equal(winner.ok, true); assertFailure(loser, "m11-stale-session-revision", "expectedRevision", "Event Session revision is stale."); assert.equal(seed.tracker.updates, 1);
});

test("recovery callback authority drift is write-free and uncertain writes never retry", async () => {
  const drift = makeContext({ update: persistSession }); await createVoyageEventSession(request(), drift.context); let stored = session(drift.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored); drift.coordinator.witnessFactory = () => { drift.context.authenticatedConnectionId = "connection-drift"; return { connectionId: "connection-gm-1", occurredAt: "2026-08-10T12:00:00.000Z" }; };
  const driftResult = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "drift-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, drift.context);
  assertFailure(driftResult, "m11-active-gm-required", "transport.connection", "The authenticated user is not the current active GM."); assert.equal(drift.tracker.updates, 0);
  const uncertain = makeContext({ update(document, payload) { persistSession(document, payload); throw new Error("uncertain"); } }); await createVoyageEventSession(request(), uncertain.context); stored = session(uncertain.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  const uncertainResult = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "uncertain-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, uncertain.context);
  assert.equal(uncertainResult.ok, true); assert.equal(uncertainResult.revision, 1); assert.equal(uncertain.tracker.updates, 1);
  const prior = makeContext({ update() { throw new Error("before persistence"); } }); await createVoyageEventSession(request(), prior.context); stored = session(prior.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  const priorResult = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "prior-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, prior.context);
  assertFailure(priorResult, "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify."); assert.equal(prior.tracker.updates, 1);
  const unknown = makeContext({ update(document, payload) { document.__testSource.flags.arcflight.system.voyageSession.revision = 99; throw new Error("uncertain state"); } }); await createVoyageEventSession(request(), unknown.context); stored = session(unknown.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  const unknownResult = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "unknown-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, unknown.context);
  assertFailure(unknownResult, "m11-recovery-required", "recovery", "Event Session requires explicit recovery."); assert.equal(unknown.tracker.updates, 1);
});

test("every recovery record has exactly one matching after-recovery checkpoint", async () => {
  const mutations = [
    ["missing", (stored) => { stored.checkpoints.pop(); }],
    ["wrong kind", (stored) => { stored.checkpoints.at(-1).kind = "before-plan-lock"; }],
    ["event count", (stored) => { stored.checkpoints.at(-1).eventCount = 0; }],
    ["encounter state", (stored) => { stored.checkpoints.at(-1).encounterState.revision = 7; }],
    ["closeout state", (stored) => { stored.checkpoints.at(-1).closeout.status = "review-required"; }],
    ["wrong recovery event", (stored) => { stored.events.at(-1).sourceCheckpointId = "forged-source"; }]
  ];
  for (const [name, mutate] of mutations) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); let stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
    assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `after-${name}`, sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context)).ok, true, name);
    stored = session(fixture.journals[0]); mutate(stored);
    assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid.", name);
    assertFailure(await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `after-retry-${name}`, sessionId: "session-1", expectedRevision: 1, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context), "m11-unrecoverable-session", "flags.arcflight.system.voyageSession", "Immutable Event Session recovery evidence is invalid.", name);
    assert.equal(fixture.tracker.updates, 1, name);
  }
});

test("stored recovery actions are rebuild-only and recovery projection is canonical", async () => {
  const actionFixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), actionFixture.context); let stored = session(actionFixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "action-recovery", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, actionFixture.context)).ok, true);
  stored = session(actionFixture.journals[0]); const tuple = JSON.parse(stored.processedRequests[1].fingerprint); tuple[6].recoveryAction = "abort"; stored.processedRequests[1].fingerprint = JSON.stringify(tuple);
  assertFailure(reloadVoyageEventSession("session-1", actionFixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(actionFixture.tracker.updates, 1);
  const recoveryFields = [
    ["status", (value) => { value.status = "none"; }],
    ["reasonCode", (value) => { value.reasonCode = "forged"; }],
    ["failedRequestId", (value) => { value.failedRequestId = null; }],
    ["failedRevision", (value) => { value.failedRevision = 99; }],
    ["checkpointId", (value) => { value.checkpointId = "forged"; }],
    ["sourceCheckpointRevision", (value) => { value.sourceCheckpointRevision = 99; }],
    ["recoveryAuthorityUserId", (value) => { value.recoveryAuthorityUserId = "gm-2"; }]
  ];
  for (const [name, mutate] of recoveryFields) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
    assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `canonical-${name}`, sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context)).ok, true, name);
    mutate(session(fixture.journals[0]).recovery);
    const reloadResult = reloadVoyageEventSession("session-1", fixture.context); assertFailure(reloadResult, "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid.", name); assert.equal(fixture.tracker.updates, 1, name);
  }
});

test("recovery failure provenance is bound to the captured failure and audit evidence", async () => {
  const mutations = [
    ["recovery failed request", (stored) => { stored.recovery.failedRequestId = "forged"; }],
    ["recovery failed revision", (stored) => { stored.recovery.failedRevision = 99; }],
    ["audit failed request", (stored) => { stored.auditHistory.at(-1).details.failedRequestId = "forged"; }],
    ["audit failed revision", (stored) => { stored.auditHistory.at(-1).details.failedRevision = 99; }]
  ];
  for (const [name, mutate] of mutations) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); const stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
    assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `provenance-${name}`, sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context)).ok, true, name);
    mutate(session(fixture.journals[0])); const before = structuredClone(session(fixture.journals[0]));
    assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid.", name);
    assertFailure(await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `provenance-retry-${name}`, sessionId: "session-1", expectedRevision: 1, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context), "m11-unrecoverable-session", "flags.arcflight.system.voyageSession", "Immutable Event Session recovery evidence is invalid.", name);
    assert.deepEqual(session(fixture.journals[0]), before, name); assert.equal(fixture.tracker.updates, 1, name);
  }
});

test("trusted owning replay regenerates changed state and rejects forged after-recovery state", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); let stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); stored.revision = 1; markRecoveryRequired(stored);
  stored.events.push({ type: "voyage.m6-owned-event", evidence: "canonical", previousRevision: 0, revision: 1 });
  fixture.context.trustedReplayDependencies = true;
  fixture.context.replayVoyageEventSessionEvidence = ({ events, checkpoint }) => {
    assert.equal(events.some((event) => event.type === "voyage.m6-owned-event"), true);
    events[0].evidence = "mutated-by-dependency"; if (checkpoint) checkpoint.sessionState = "forged";
    const replayedEncounter = structuredClone(encounter()); replayedEncounter.title = "Trusted replay";
    return { startIndex: 0, endIndex: 1, previousRevision: 0, nextRevision: 1, sessionState: "setup", encounterState: replayedEncounter, closeout: structuredClone(stored.closeout) };
  };
  const result = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "owning-replay", sessionId: "session-1", expectedRevision: 1, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors)); stored = session(fixture.journals[0]); assert.equal(stored.encounterState.title, "Trusted replay"); assert.equal(stored.checkpoints.at(-1).encounterState.title, "Trusted replay"); assert.equal(reloadVoyageEventSession("session-1", fixture.context).ok, true);
  stored.checkpoints.at(-1).encounterState.title = "forged stored state";
  assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid."); assert.equal(fixture.tracker.updates, 1);
});

test("mixed M11 and owning-domain revisions replay as one chronological chain", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); let stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  fixture.context.trustedReplayDependencies = true;
  fixture.context.replayVoyageEventSessionEvidence = ({ events, startIndex, endIndex, previousRevision }) => {
    assert.equal(events.length, 1); assert.equal(events[0].type, "voyage.m6-owned-event"); assert.equal(startIndex, 1); assert.equal(endIndex, 2); assert.equal(previousRevision, 1);
    return { startIndex, endIndex, previousRevision, nextRevision: 2, sessionState: "setup", encounterState: structuredClone(encounter()), closeout: structuredClone(stored.closeout) };
  };
  assert.equal((await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "mixed-first", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "first" }, fixture.context)).ok, true);
  stored = session(fixture.journals[0]); stored.sessionState = "recovery-required"; stored.encounterState.lifecycleState = "recovery"; stored.recovery = { status: "required", reasonCode: "m11-recovery-required", failedRequestId: "failed-2", failedRevision: 1, checkpointId: null, sourceCheckpointRevision: null, recoveryAuthorityUserId: null };
  stored.events.push({ type: "voyage.m6-owned-event", evidence: "canonical", previousRevision: 1, revision: 2 }); stored.revision = 2;
  const result = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "mixed-second", sessionId: "session-1", expectedRevision: 2, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "second" }, fixture.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors)); assert.equal(result.revision, 3); assert.equal(reloadVoyageEventSession("session-1", fixture.context).ok, true);
});

test("unavailable or noncanonical owning replay dependencies fail recovery without writes", async () => {
  const variants = [
    ["missing", (context) => { context.trustedReplayDependencies = true; }],
    ["untrusted", (context) => { context.trustedReplayDependencies = false; context.replayVoyageEventSessionEvidence = () => ({ sessionState: "setup", encounterState: encounter(), closeout: { status: "none", applicationId: null, closeoutId: null, acceptedApplicationPlan: null, reservationId: null, expectedEncounterRevision: null, expectedShipRevision: null, sessionReservationReceipt: null, sessionCommitReceipt: null } }); }],
    ["throwing", (context) => { context.trustedReplayDependencies = true; context.replayVoyageEventSessionEvidence = () => { throw new Error("replay"); }; }],
    ["malformed", (context) => { context.trustedReplayDependencies = true; context.replayVoyageEventSessionEvidence = () => ({ forged: true }); }],
    ["mismatched", (context) => { context.trustedReplayDependencies = true; context.replayVoyageEventSessionEvidence = () => ({ sessionState: "setup", encounterState: { ...encounter(), encounterId: "wrong" }, closeout: { status: "none", applicationId: null, closeoutId: null, acceptedApplicationPlan: null, reservationId: null, expectedEncounterRevision: null, expectedShipRevision: null, sessionReservationReceipt: null, sessionCommitReceipt: null } }); }]
  ];
  for (const [name, configure] of variants) {
    const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); const stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); stored.revision = 1; markRecoveryRequired(stored); stored.events.push({ type: "voyage.m6-owned-event", evidence: "canonical", previousRevision: 0, revision: 1 }); configure(fixture.context);
    const result = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: `dependency-${name}`, sessionId: "session-1", expectedRevision: 1, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, fixture.context);
    assertFailure(result, "m11-unrecoverable-session", "flags.arcflight.system.voyageSession", "Immutable Event Session recovery evidence is invalid.", name); assert.equal(fixture.tracker.updates, 0, name);
  }
});

test("coordinator null is a contender loss while invalid coordinator behavior is required", async () => {
  const contender = { async runExclusiveSessionMutation() { return null; } };
  const fixture = makeContext({ coordinator: contender, update: persistSession }); await createVoyageEventSession(request(), fixture.context);
  const transfer = await transferVoyageEventSessionControl(transferRequest({ requestId: "contender-loss" }), fixture.context);
  assertFailure(transfer, "m11-control-transfer-required", "authorityEpoch", "Event Session control has transferred."); assert.equal(fixture.tracker.updates, 0);
  const recovery = makeContext({ coordinator: contender, update: persistSession }); await createVoyageEventSession(request(), recovery.context); const stored = session(recovery.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  const recovered = await recoverVoyageEventSession({ kind: "voyage.m11-recover-session", requestId: "recovery-contender-loss", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" }, recovery.context);
  assertFailure(recovered, "m11-control-transfer-required", "authorityEpoch", "Event Session control has transferred."); assert.equal(recovery.tracker.updates, 0);
});

test("recovery replay is coordinator-free while new recovery still requires coordination", async () => {
  const fixture = makeContext({ update: persistSession }); await createVoyageEventSession(request(), fixture.context); let stored = session(fixture.journals[0]); addRecoveryCheckpoint(stored); markRecoveryRequired(stored);
  const original = { kind: "voyage.m11-recover-session", requestId: "coordinator-free-replay", sessionId: "session-1", expectedRevision: 0, authorityEpoch: 0, recoveryAction: "rebuild-latest", reason: "repair" };
  const first = await recoverVoyageEventSession(original, fixture.context); assert.equal(first.ok, true);
  const replayContext = makeContext({ journals: fixture.journals }); delete replayContext.context.runExclusiveSessionMutation;
  const replay = await recoverVoyageEventSession(original, replayContext.context); assert.deepEqual(replay, first); assert.equal(replayContext.tracker.updates, 0);
  const conflict = await recoverVoyageEventSession({ ...original, reason: "changed" }, replayContext.context); assertFailure(conflict, "m11-request-id-conflict", "request.requestId", "Request ID was previously used with different data."); assert.equal(replayContext.tracker.updates, 0);
  const fresh = await recoverVoyageEventSession({ ...original, requestId: "new-recovery" }, replayContext.context); assertFailure(fresh, "m11-cross-client-coordinator-required", "transport.coordinator", "A trusted cross-client mutation coordinator is required."); assert.equal(replayContext.tracker.updates, 0);
});
