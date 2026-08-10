import test from "node:test";
import assert from "node:assert/strict";
import {
  createVoyageEventSession,
  reloadVoyageEventSession,
  validateVoyageEventSession
} from "../../../scripts/voyage/foundry/event-session-runtime.js";
import { createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterCrewPlanningLock } from "../../../scripts/voyage/domain/crew-planning-lock.js";
import { applyVoyageEncounterResolutionTransition } from "../../../scripts/voyage/domain/resolution-transition.js";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";
import { analyzeVoyagePressureBreachCloseoutTransaction } from "../../../scripts/voyage/domain/pressure-breach.js";
import { applyVoyageEncounterPressureBreachPlan } from "../../../scripts/voyage/domain/pressure-breach.js";
import { applyVoyagePressureBreachVoidScarCreation } from "../../../scripts/voyage/domain/void-scar-creation.js";

function definition() {
  return { schemaVersion: 1, eventId: "event-1", definitionSnapshotId: "definition-1", title: "Cinderwake" };
}

function encounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "event-1",
    definitionId: "event-1",
    definitionRef: null,
    primaryShip: { id: "ship-1", preserved: true }
  };
}

function request(definitionValue = definition(), encounterValue = encounter()) {
  return {
    kind: "voyage.m11-create-session",
    requestId: "request-1",
    sessionId: "session-1",
    eventId: "event-1",
    definitionSnapshotId: "definition-1",
    shipId: "ship-1",
    eventDefinition: definitionValue,
    initialEncounterState: encounterValue
  };
}

function makeJournalDocument(data, tracker, journals, { id = data._id, flags = data.flags, persist = true } = {}) {
  const document = {
    id,
    name: data.name,
    pages: [{ name: "Preserved page", text: { content: "keep" } }],
    ownership: structuredClone(data.ownership),
    folder: { id: "folder-1" },
    sort: 42,
    flags: structuredClone(flags),
    async update() { tracker.updates += 1; return this; },
    async delete() {
      tracker.deletes += 1;
      tracker.deletedIds.push(this.id);
      const index = journals.indexOf(this);
      if (index >= 0) journals.splice(index, 1);
      return this;
    }
  };
  if (persist) journals.push(document);
  return document;
}

function makeContext({ journals = [], documentId = "Journal.session-1", definitionValue = definition(), encounterValue = encounter(), create = null } = {}) {
  const tracker = { creates: 0, updates: 0, deletes: 0, deletedIds: [] };
  const JournalEntry = {
    async create(data) {
      tracker.creates += 1;
      if (create) return create(data, tracker, journals, (options) => makeJournalDocument(data, tracker, journals, options));
      return makeJournalDocument(data, tracker, journals);
    }
  };
  return {
    context: {
      journalEntries: journals,
      users: [
        { id: "gm-1", isGM: true },
        { id: "gm-2", isGM: true },
        { id: "player-1", isGM: false }
      ],
      activeGmUserId: "gm-1",
      createDocumentId: () => documentId,
      resolveEventDefinitionSnapshot: async () => structuredClone(definitionValue),
      createInitialEncounterState: async () => structuredClone(encounterValue),
      JournalEntry
    },
    journals,
    tracker
  };
}

function session(document) {
  return document.flags.arcflight.system.voyageSession;
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result), ["ok", "requestId", "sessionId", "status", "revision", "authorityEpoch", "projection", "events", "errors", "warnings"]);
  assert.equal(result.status, "failed");
  assert.equal(result.revision, null);
  assert.equal(result.authorityEpoch, null);
  assert.equal(result.projection, null);
  assert.deepEqual(result.events, []);
  assert.equal(result.errors[0].code, code);
  assert.deepEqual(result.warnings, []);
}

function assertExactFailure(result, code, path, message) {
  assertFailure(result, code);
  assert.deepEqual(result.errors, [{ code, path, message, severity: "error" }]);
}

function canonicalM10CloseoutM6PressureBreachEvent() {
  const state = encounter();
  state.pressureSystems["crew-morale"].value = state.pressureSystems["crew-morale"].capacity;
  const pressureEffect = {
    pressureEffectId: `arcflight-pressure-effect:${JSON.stringify(["hazard-closeout", "event-1", "session-1", "stage-1", 1, "hazard-source", "consequence-1", 1, "crew-morale"])}`,
    encounterId: "event-1",
    stageId: "stage-1",
    roundNumber: 1,
    sequence: 1,
    stationId: null,
    actionId: null,
    pressureSystemId: "crew-morale",
    delta: 1,
    timing: "gm-confirmed",
    sourceKind: "hazard-closeout",
    sourceIntentId: "consequence-1",
    activationSource: "event-closeout",
    branch: "no-roll",
    visibility: "public"
  };
  const result = analyzeVoyagePressureBreachCloseoutTransaction({
    expectedEncounterRevision: 0,
    closeoutContext: { eventId: "event-1", sessionId: "session-1", stageId: "stage-1", roundNumber: 1, phase: "cleanup-advance" },
    pressureSystems: Object.values(state.pressureSystems),
    activeHazards: [],
    pressureEffect
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.breachRequired, true);
  return result.event;
}

function canonicalM6PressureBreachEvent() {
  const state = createVoyageEncounterState({ encounterId: "event-1", definitionId: "definition-1", primaryShip: { id: "ship-1" } });
  state.lifecycleState = "active";
  state.currentStage = { stageId: "stage-1" };
  state.roundNumber = 1;
  state.phase = "crew-planning";
  state.availableStations = [{
    stationId: "captain",
    actions: [{
      actionId: "pressure-action",
      approaches: [{ approachId: "pressure-approach", noRoll: true }],
      outcomeDefinition: {
        effectRules: [{
          effectId: "pressure-effect",
          intentType: "pressure-change",
          timing: "consequences",
          visibility: "public",
          target: { kind: "pressure-system", targetId: "crew-morale" },
          payload: { delta: 1 }
        }],
        branches: { "no-roll": ["pressure-effect"] }
      }
    }]
  }];
  state.stationAssignments = [{ stationId: "captain", operator: { kind: "actor", uuid: "Actor.pressure" } }];
  state.selections = { captain: { stationId: "captain", actionId: "pressure-action", approachId: "pressure-approach", noRoll: true } };
  state.proposedStationOrder = ["captain"];
  state.committedStationOrder = [];
  state.pressureSystems["crew-morale"].value = state.pressureSystems["crew-morale"].capacity;
  const locked = applyVoyageEncounterCrewPlanningLock(state, { phaseStartSnapshotId: "event-lock" });
  const resolving = applyVoyageEncounterResolutionTransition(locked.nextState, { phaseStartSnapshotId: "event-resolution" });
  const consequences = applyVoyageEncounterConsequencesTransition(resolving.nextState, { phaseStartSnapshotId: "event-consequences" });
  const result = applyVoyageEncounterPressureBreachPlan(consequences.nextState);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.events[0];
}

function canonicalM7VoidScarEvent(m6Event) {
  const ship = {
    shipId: "ship-1",
    revision: 0,
    installed: { hullPlatform: "void-skiff" },
    hull: { voidScarCapacity: 2 },
    voidScars: []
  };
  const result = applyVoyagePressureBreachVoidScarCreation(ship, m6Event, {
    shipId: ship.shipId,
    expectedShipRevision: ship.revision,
    encounterId: m6Event.encounterId,
    expectedEncounterRevision: m6Event.revision,
    sourceEventType: m6Event.type,
    sourceEncounterRevision: m6Event.revision,
    sourceProposal: structuredClone(m6Event.voidScarProposal),
    pressureSystemId: m6Event.voidScarProposal.pressureSystemId
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.events[0];
}

function persistedSessionWithEvents(document, events, encounterRevision = 1) {
  const stored = session(document);
  stored.events = structuredClone(events);
  stored.encounterState.revision = encounterRevision;
  return stored;
}

function acceptedApplicationPlan() {
  const previewRequest = { kind: "m10-closeout-preview", sessionId: "session-1" };
  return {
    previewRequest,
    reviewRequest: {
      kind: "m10-closeout-review",
      sessionId: "session-1",
      gmUserId: "gm-1",
      confirmed: true,
      previewRequest: structuredClone(previewRequest),
      suppliedPreview: {}
    },
    applicationPlan: {
      schemaVersion: 1,
      applicationId: "application-1",
      closeoutId: "closeout-1",
      eventId: "event-1",
      sessionId: "session-1",
      definitionSnapshotId: "definition-1",
      shipId: "ship-1",
      expectedEncounterRevision: 0,
      expectedShipRevision: 0,
      gmUserId: "gm-1",
      persistentProposals: [],
      temporaryResetPlan: {},
      expectedPreview: {}
    }
  };
}

test("M11 Task 1 creates exactly one ordinary JournalEntry with the exact state path", async () => {
  const definitionValue = definition();
  const encounterValue = encounter();
  const { context, journals, tracker } = makeContext({ definitionValue, encounterValue });
  const result = await createVoyageEventSession(request(definitionValue, encounterValue), context);

  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(tracker.creates, 1);
  assert.equal(tracker.updates, 0);
  assert.equal(tracker.deletes, 0);
  assert.equal(journals.length, 1);
  assert.deepEqual(Object.keys(session(journals[0])), [
    "schemaVersion", "sessionDocumentId", "sessionId", "eventId", "definitionSnapshotId", "shipId", "revision", "sessionState", "activeGmUserId", "authorityEpoch", "encounterState", "events", "checkpoints", "processedRequests", "closeout", "recovery", "auditHistory"
  ]);
  assert.equal(session(journals[0]).sessionDocumentId, "Journal.session-1");
  assert.equal(session(journals[0]).sessionId, "session-1");
  assert.equal(session(journals[0]).revision, 0);
  assert.equal(session(journals[0]).encounterState.revision, 0);
  assert.equal(session(journals[0]).encounterState.encounterId, "event-1");
  assert.deepEqual(session(journals[0]).events, []);
  assert.equal(Object.hasOwn(journals[0].flags.arcflight.system, "voyage"), false);
});

test("M11 Task 1 applies GM-only JournalEntry ownership with no player entry", async () => {
  const definitionValue = definition();
  const encounterValue = encounter();
  const { context, journals } = makeContext({ definitionValue, encounterValue });
  context.documentOwnershipLevels = { NONE: 11, OWNER: 17 };
  await createVoyageEventSession(request(definitionValue, encounterValue), context);

  assert.deepEqual(journals[0].ownership, { default: 11, "gm-1": 17, "gm-2": 17 });
  assert.equal(Object.hasOwn(journals[0].ownership, "player-1"), false);
});

test("M11 Task 1 resolves missing and duplicate session documents exactly and writes nothing", async () => {
  const missing = makeContext();
  const missingResult = reloadVoyageEventSession("session-1", missing.context);
  assertExactFailure(missingResult, "m11-session-document-not-found", "sessionId", "Exact Event Session document was not resolved.");
  assert.equal(missing.tracker.creates, 0);
  assert.equal(missing.tracker.updates, 0);

  const definitionValue = definition();
  const encounterValue = encounter();
  const fixture = makeContext({ definitionValue, encounterValue });
  await createVoyageEventSession(request(definitionValue, encounterValue), fixture.context);
  const duplicate = {
    id: "Journal.duplicate",
    flags: structuredClone(fixture.journals[0].flags)
  };
  fixture.journals.push(duplicate);
  const duplicateResult = reloadVoyageEventSession("session-1", fixture.context);
  assertExactFailure(duplicateResult, "m11-ambiguous-session-document", "sessionId", "More than one Event Session document matched.");
  assert.equal(fixture.tracker.creates, 1);
  assert.equal(fixture.tracker.updates, 0);
  assert.equal(fixture.tracker.deletes, 0);
});

test("M11 Task 1 treats zero, one, and multiple matching documents as distinct create outcomes", async () => {
  const zero = makeContext();
  const zeroResult = await createVoyageEventSession(request(), zero.context);
  assert.equal(zeroResult.ok, true, JSON.stringify(zeroResult.errors));
  assert.equal(zero.tracker.creates, 1);
  assert.equal(zero.tracker.updates, 0);
  assert.equal(zero.tracker.deletes, 0);

  const one = makeContext();
  const initial = await createVoyageEventSession(request(), one.context);
  assert.equal(initial.ok, true, JSON.stringify(initial.errors));
  const conflict = await createVoyageEventSession(request(), one.context);
  assertExactFailure(conflict, "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify.");
  assert.equal(one.tracker.creates, 1);
  assert.equal(one.tracker.updates, 0);
  assert.equal(one.tracker.deletes, 0);
  assert.equal(one.journals.length, 1);

  const multiple = makeContext();
  const first = await createVoyageEventSession(request(), multiple.context);
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  multiple.journals.push({ id: "Journal.duplicate", flags: structuredClone(multiple.journals[0].flags) });
  const ambiguous = await createVoyageEventSession(request(), multiple.context);
  assertExactFailure(ambiguous, "m11-ambiguous-session-document", "sessionId", "More than one Event Session document matched.");
  assert.equal(multiple.tracker.creates, 1);
  assert.equal(multiple.tracker.updates, 0);
  assert.equal(multiple.tracker.deletes, 0);
});

test("M11 Task 1 cleans up only its post-create document when full reread verification fails", async () => {
  const scenarios = [
    {
      name: "persisted flag mismatch",
      create(data, tracker, journals, makeDocument) {
        const document = makeDocument();
        document.flags.arcflight.system.voyageSession.sessionId = "wrong-session";
        return document;
      }
    },
    {
      name: "returned document ID mismatch",
      create(_data, _tracker, _journals, makeDocument) {
        return makeDocument({ id: "Journal.returned-other" });
      }
    },
    {
      name: "reread does not find created document",
      create(_data, _tracker, _journals, makeDocument) {
        return makeDocument({ persist: false });
      }
    }
  ];
  for (const scenario of scenarios) {
    const fixture = makeContext({ create: scenario.create });
    const result = await createVoyageEventSession(request(), fixture.context);
    assertExactFailure(result, "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify.");
    assert.equal(fixture.tracker.creates, 1, scenario.name);
    assert.equal(fixture.tracker.updates, 0, scenario.name);
    assert.equal(fixture.tracker.deletes, 1, scenario.name);
    assert.deepEqual(fixture.journals, [], scenario.name);
  }

  const preserved = { id: "Journal.preexisting", flags: { unrelatedModule: { preserved: true } } };
  const noPreexistingDelete = makeContext({
    journals: [preserved],
    create(data, tracker, journals, makeDocument) {
      const document = makeDocument();
      document.flags.arcflight.system.voyageSession.sessionId = "wrong-session";
      return document;
    }
  });
  const result = await createVoyageEventSession(request(), noPreexistingDelete.context);
  assertExactFailure(result, "m11-session-write-failed", "flags.arcflight.system.voyageSession", "Event Session write did not complete or verify.");
  assert.equal(noPreexistingDelete.tracker.deletes, 1);
  assert.deepEqual(noPreexistingDelete.tracker.deletedIds, ["Journal.session-1"]);
  assert.deepEqual(noPreexistingDelete.journals, [preserved]);
});

test("M11 Task 1 rejects malformed, hostile, inherited, and sparse stored data without writes", async () => {
  const definitionValue = definition();
  const encounterValue = encounter();
  const fixture = makeContext({ definitionValue, encounterValue });
  await createVoyageEventSession(request(definitionValue, encounterValue), fixture.context);
  const stored = session(fixture.journals[0]);
  stored.revision = 1.5;
  assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document");
  stored.revision = 0;
  stored.events = new Array(1);
  assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-hostile-data-capture-failed");
  stored.events = [];
  Object.defineProperty(stored, "events", { enumerable: true, get: () => [] });
  assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-hostile-data-capture-failed");
  assert.equal(fixture.tracker.updates, 0);

  const inherited = Object.create(session(fixture.journals[0]));
  fixture.journals[0].flags.arcflight.system.voyageSession = inherited;
  assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-hostile-data-capture-failed");
  assert.equal(fixture.tracker.updates, 0);
});

test("M11 Task 1 capture rejects prohibited nested values, unsafe keys, cycles, and reflection failures", async () => {
  const hostileValues = [
    undefined,
    () => undefined,
    1n,
    Symbol("hostile"),
    Infinity,
    new Date(),
    new Map(),
    new Set(),
    new (class Hostile {})()
  ];
  for (const hostile of hostileValues) {
    const definitionValue = definition();
    const encounterValue = encounter();
    const fixture = makeContext({ definitionValue, encounterValue });
    await createVoyageEventSession(request(definitionValue, encounterValue), fixture.context);
    session(fixture.journals[0]).encounterState.metadata = { hostile };
    assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-hostile-data-capture-failed");
    assert.equal(fixture.tracker.updates, 0);
  }

  const definitionValue = definition();
  const encounterValue = encounter();
  const fixture = makeContext({ definitionValue, encounterValue });
  await createVoyageEventSession(request(definitionValue, encounterValue), fixture.context);
  const metadata = session(fixture.journals[0]).encounterState.metadata;
  Object.defineProperty(metadata, "__proto__", { value: true, enumerable: true });
  assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-hostile-data-capture-failed");
  assert.equal(fixture.tracker.updates, 0);

  const cyclicDefinition = definition();
  const cyclicEncounter = encounter();
  const cyclic = makeContext({ definitionValue: cyclicDefinition, encounterValue: cyclicEncounter });
  await createVoyageEventSession(request(cyclicDefinition, cyclicEncounter), cyclic.context);
  const cycle = {};
  cycle.self = cycle;
  session(cyclic.journals[0]).encounterState.metadata = cycle;
  assertFailure(reloadVoyageEventSession("session-1", cyclic.context), "m11-hostile-data-capture-failed");

  const reflectedDefinition = definition();
  const reflectedEncounter = encounter();
  const reflected = makeContext({ definitionValue: reflectedDefinition, encounterValue: reflectedEncounter });
  await createVoyageEventSession(request(reflectedDefinition, reflectedEncounter), reflected.context);
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  session(reflected.journals[0]).encounterState.metadata = revoked.proxy;
  assertFailure(reloadVoyageEventSession("session-1", reflected.context), "m11-hostile-data-capture-failed");
  assert.equal(reflected.tracker.updates, 0);
});

test("M11 Task 1 enforces JournalEntry/session identity and initial revision bindings", async () => {
  const definitionValue = definition();
  const encounterValue = encounter();
  const fixture = makeContext({ definitionValue, encounterValue });
  await createVoyageEventSession(request(definitionValue, encounterValue), fixture.context);
  session(fixture.journals[0]).sessionDocumentId = "Journal.other";
  assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document");
  session(fixture.journals[0]).sessionDocumentId = fixture.journals[0].id;
  session(fixture.journals[0]).encounterState.encounterId = "other-event";
  assertFailure(reloadVoyageEventSession("session-1", fixture.context), "m11-invalid-session-document");
  assert.equal(fixture.tracker.updates, 0);

  const invalidEncounter = encounter();
  invalidEncounter.revision = 2;
  const invalid = makeContext({ definitionValue, encounterValue: invalidEncounter });
  const result = await createVoyageEventSession(request(definitionValue, invalidEncounter), invalid.context);
  assertFailure(result, "m11-command-payload-invalid");
  assert.equal(invalid.tracker.creates, 0);
  assert.equal(invalid.tracker.updates, 0);
});

test("M11 Task 1 accepts only representative canonical M6, M7, and M10 stored-event shapes", async () => {
  const m6 = canonicalM6PressureBreachEvent();
  const m7 = canonicalM7VoidScarEvent(m6);
  const m10CloseoutM6 = canonicalM10CloseoutM6PressureBreachEvent();
  const m10Persistent = {
    type: "voyage.closeout-persistent-state-applied",
    applicationId: "application-1",
    closeoutId: "closeout-1",
    shipId: "ship-1",
    proposalIds: ["proposal-1"],
    previousShipRevision: 0,
    revision: 1
  };
  const m10Closeout = {
    type: "voyage.closeout-applied",
    applicationId: "application-1",
    closeoutId: "closeout-1",
    eventId: "event-1",
    sessionId: "session-1",
    definitionSnapshotId: "definition-1",
    shipId: "ship-1",
    overallResult: "overall-success",
    proposalIds: [],
    previousEncounterRevision: 0,
    encounterRevision: 1,
    shipRevision: 1
  };
  const witnesses = [
    { name: "M6 pressure breach", events: [m6], encounterRevision: 4 },
    { name: "M7 Void Scar", events: [m6, m7], encounterRevision: 4 },
    // M8 and M9 provide the canonical result/proposal inputs. They do not
    // define a persisted Event Session event kind; M10 owns these two events.
    { name: "M10 closeout M6 breach", events: [m10CloseoutM6], encounterRevision: 1 },
    { name: "M10 persistent batch", events: [m10Persistent], encounterRevision: 0 },
    { name: "M10 final closeout", events: [m10Closeout], encounterRevision: 1 }
  ];
  for (const witness of witnesses) {
    const fixture = makeContext();
    const created = await createVoyageEventSession(request(), fixture.context);
    assert.equal(created.ok, true, `${witness.name}: ${JSON.stringify(created.errors)}`);
    persistedSessionWithEvents(fixture.journals[0], witness.events, witness.encounterRevision);
    const result = reloadVoyageEventSession("session-1", fixture.context);
    assert.equal(result.ok, true, `${witness.name}: ${JSON.stringify(result.errors)}`);
    assert.equal(fixture.tracker.updates, 0, witness.name);
  }
});

test("M11 Task 1 accepts only exact M11 runtime event shapes with their required audit evidence", async () => {
  const accepted = makeContext();
  assert.equal((await createVoyageEventSession(request(), accepted.context)).ok, true);
  const acceptedStored = persistedSessionWithEvents(accepted.journals[0], [{
    type: "voyage.m11-closeout-review-accepted",
    sessionId: "session-1",
    eventId: "event-1",
    definitionSnapshotId: "definition-1",
    shipId: "ship-1",
    sourceCheckpointId: null,
    sourceCheckpointRevision: null,
    recoveryAuthorityUserId: null,
    previousRevision: 0,
    revision: 1
  }], 0);
  acceptedStored.revision = 1;
  acceptedStored.sessionState = "persistent-application";
  acceptedStored.encounterState.lifecycleState = "active";
  acceptedStored.encounterState.phase = "cleanup-advance";
  acceptedStored.encounterState.currentStage = { stageId: "stage-1" };
  acceptedStored.encounterState.roundNumber = 1;
  const plan = acceptedApplicationPlan();
  acceptedStored.closeout = {
    status: "accepted-for-application",
    applicationId: "application-1",
    closeoutId: "closeout-1",
    acceptedApplicationPlan: plan,
    reservationId: null,
    expectedEncounterRevision: 0,
    expectedShipRevision: 0,
    sessionReservationReceipt: null,
    sessionCommitReceipt: null
  };
  acceptedStored.auditHistory = [{
    auditId: `arcflight-voyage-audit:${JSON.stringify(["session-1", 0, "closeout-review-accepted"])}`,
    kind: "closeout-review-accepted",
    sessionId: "session-1",
    requestId: "closeout-request-1",
    actorUserId: "gm-1",
    authorityEpoch: 0,
    previousRevision: 0,
    revision: 1,
    occurredAt: "2026-01-01T00:00:00.000Z",
    details: {
      applicationId: "application-1",
      closeoutId: "closeout-1",
      previousSessionState: "event-closeout-review",
      nextSessionState: "persistent-application"
    }
  }];
  assert.equal(reloadVoyageEventSession("session-1", accepted.context).ok, true);
  assert.equal(accepted.tracker.updates, 0);

  const recovered = makeContext();
  assert.equal((await createVoyageEventSession(request(), recovered.context)).ok, true);
  const recoveredStored = persistedSessionWithEvents(recovered.journals[0], [{
    type: "voyage.m11-recovery-rebuilt",
    sessionId: "session-1",
    eventId: "event-1",
    definitionSnapshotId: "definition-1",
    shipId: "ship-1",
    sourceCheckpointId: "arcflight-voyage-checkpoint:[\"session-1\",\"before-plan-lock\",0]",
    sourceCheckpointRevision: 0,
    recoveryAuthorityUserId: "gm-1",
    previousRevision: 0,
    revision: 1
  }], 0);
  recoveredStored.revision = 1;
  recoveredStored.recovery = {
    status: "resolved",
    reasonCode: "recovered",
    failedRequestId: "failed-request-1",
    failedRevision: 0,
    checkpointId: "arcflight-voyage-checkpoint:[\"session-1\",\"before-plan-lock\",0]",
    sourceCheckpointRevision: 0,
    recoveryAuthorityUserId: "gm-1"
  };
  recoveredStored.auditHistory = [{
    auditId: `arcflight-voyage-audit:${JSON.stringify(["session-1", 0, "recovery-rebuilt"])}`,
    kind: "recovery-rebuilt",
    sessionId: "session-1",
    requestId: "recover-request-1",
    actorUserId: "gm-1",
    authorityEpoch: 0,
    previousRevision: 0,
    revision: 1,
    occurredAt: "2026-01-01T00:00:00.000Z",
    details: {
      recoveryAction: "rebuild",
      sourceCheckpointId: "arcflight-voyage-checkpoint:[\"session-1\",\"before-plan-lock\",0]",
      sourceCheckpointRevision: 0,
      recoveryAuthorityUserId: "gm-1",
      replayedEventCount: 0
    }
  }];
  assert.equal(reloadVoyageEventSession("session-1", recovered.context).ok, true);
  assert.equal(recovered.tracker.updates, 0);
});

test("M11 Task 1 rejects noncanonical stored-event unions without writes", async () => {
  const m6 = canonicalM6PressureBreachEvent();
  const m7 = canonicalM7VoidScarEvent(m6);
  const malformedM7 = structuredClone(m7);
  delete malformedM7.voidScar.description;
  const reorderedM7 = structuredClone(m7);
  const reorderedM7Fields = Object.keys(reorderedM7);
  const firstM7Field = reorderedM7Fields.shift();
  const reorderedM7Value = { ...reorderedM7 };
  delete reorderedM7Value[firstM7Field];
  reorderedM7Value[firstM7Field] = reorderedM7[firstM7Field];
  const extraM6 = { ...m6, forged: true };
  const omittedM6 = structuredClone(m6);
  delete omittedM6.pressureReset;
  const wrongIdentity = structuredClone(m7);
  wrongIdentity.shipId = "ship-other";
  const persistent = {
    type: "voyage.closeout-persistent-state-applied",
    applicationId: "application-1",
    closeoutId: "closeout-1",
    shipId: "ship-1",
    proposalIds: ["proposal-1"],
    previousShipRevision: 1,
    revision: 2
  };
  const brokenShipContinuity = structuredClone(persistent);
  brokenShipContinuity.previousShipRevision = 3;
  brokenShipContinuity.revision = 4;
  const invalidCases = [
    { name: "unknown event kind", events: [{ type: "voyage.unknown", eventId: "event-1", sessionId: "session-1" }], encounterRevision: 0 },
    { name: "plausible arbitrary object", events: [{ type: "voyage.pressure-breach-applied", eventId: "event-1", sessionId: "session-1", definitionSnapshotId: "definition-1", shipId: "ship-1" }], encounterRevision: 0 },
    { name: "malformed M7 Scar", events: [m6, malformedM7], encounterRevision: 4 },
    { name: "extra event key", events: [extraM6], encounterRevision: 4 },
    { name: "omitted event key", events: [omittedM6], encounterRevision: 4 },
    { name: "reordered event key", events: [m6, reorderedM7Value], encounterRevision: 4 },
    { name: "wrong event identity", events: [m6, wrongIdentity], encounterRevision: 4 },
    { name: "broken ship revision continuity", events: [m6, m7, persistent, brokenShipContinuity], encounterRevision: 4 },
    { name: "malformed nested evidence", events: [{ ...m6, previousPressureSystems: null }], encounterRevision: 4 }
  ];
  for (const invalid of invalidCases) {
    const fixture = makeContext();
    const created = await createVoyageEventSession(request(), fixture.context);
    assert.equal(created.ok, true, `${invalid.name}: ${JSON.stringify(created.errors)}`);
    persistedSessionWithEvents(fixture.journals[0], invalid.events, invalid.encounterRevision);
    const result = reloadVoyageEventSession("session-1", fixture.context);
    assertExactFailure(result, "m11-invalid-session-document", "flags.arcflight.system.voyageSession", "Stored Event Session is invalid.");
    assert.equal(fixture.tracker.updates, 0, invalid.name);
    assert.equal(fixture.tracker.deletes, 0, invalid.name);
  }
});

test("M11 Task 1 reload is read-only and leaves JournalEntry non-voyage data untouched", async () => {
  const definitionValue = definition();
  const encounterValue = encounter();
  const fixture = makeContext({ definitionValue, encounterValue });
  await createVoyageEventSession(request(definitionValue, encounterValue), fixture.context);
  fixture.journals[0].flags.otherModule = { preserved: ["yes"] };
  fixture.journals[0].ownership.extraGm = 2;
  const before = structuredClone({
    name: fixture.journals[0].name,
    pages: fixture.journals[0].pages,
    ownership: fixture.journals[0].ownership,
    folder: fixture.journals[0].folder,
    flags: fixture.journals[0].flags
  });

  const result = reloadVoyageEventSession("session-1", fixture.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(fixture.tracker.creates, 1);
  assert.equal(fixture.tracker.updates, 0);
  assert.deepEqual({
    name: fixture.journals[0].name,
    pages: fixture.journals[0].pages,
    ownership: fixture.journals[0].ownership,
    folder: fixture.journals[0].folder,
    flags: fixture.journals[0].flags
  }, before);
});

test("M11 Task 1 captures caller data before validation and isolates the stored session", async () => {
  const definitionValue = definition();
  const encounterValue = encounter();
  const fixture = makeContext({ definitionValue, encounterValue });
  const value = request(definitionValue, encounterValue);
  const result = await createVoyageEventSession(value, fixture.context);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  value.initialEncounterState.primaryShip.id = "mutated-ship";
  definitionValue.title = "mutated definition";
  encounterValue.playerVisibleInformation.changed = true;
  assert.equal(session(fixture.journals[0]).encounterState.primaryShip.id, "ship-1");
  assert.equal(session(fixture.journals[0]).encounterState.playerVisibleInformation.changed, undefined);

  const shared = { shared: true };
  session(fixture.journals[0]).encounterState.playerVisibleInformation = shared;
  session(fixture.journals[0]).encounterState.gmSecretInformation = shared;
  assert.equal(reloadVoyageEventSession("session-1", fixture.context).ok, true);
  assert.equal(validateVoyageEventSession(session(fixture.journals[0]), fixture.journals[0].id), true);
  assert.equal(fixture.tracker.updates, 0);
});

test("M11 Task 1 rejects invalid creation proposals before any JournalEntry write", async () => {
  const definitionValue = definition();
  const encounterValue = encounter();
  const fixture = makeContext({ definitionValue, encounterValue });
  const wrongDefinition = structuredClone(definitionValue);
  wrongDefinition.title = "caller authority";
  const result = await createVoyageEventSession(request(wrongDefinition, encounterValue), fixture.context);
  assertFailure(result, "m11-command-payload-invalid");
  assert.equal(fixture.tracker.creates, 0);
  assert.equal(fixture.tracker.updates, 0);
  assert.equal(fixture.tracker.deletes, 0);

  const hostile = request(definitionValue, encounterValue);
  Object.defineProperty(hostile, "eventDefinition", { enumerable: true, get: () => definitionValue });
  const hostileResult = await createVoyageEventSession(hostile, fixture.context);
  assertFailure(hostileResult, "m11-hostile-data-capture-failed");
  assert.equal(fixture.tracker.creates, 0);
  assert.equal(fixture.tracker.updates, 0);
  assert.equal(fixture.tracker.deletes, 0);
});
