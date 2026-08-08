import test from "node:test";
import assert from "node:assert/strict";
import {
  persistVoyageEncounterApprovedCloseout,
  continueVoyageEncounterCloseoutReservation,
  verifyVoyageEncounterCloseoutShipCheckpoint,
  finalizeVoyageEncounterCloseoutReceipt
} from "../../../scripts/voyage/foundry/closeout-persistence.js";
import {
  analyzeVoyageEncounterCloseoutPreview
} from "../../../scripts/voyage/domain/closeout.js";
import { analyzeVoyageEncounterCloseoutReview } from "../../../scripts/voyage/domain/closeout-review.js";
import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../../../scripts/voyage/domain/constants.js";

const originalGame = globalThis.game;
test.afterEach(() => {
  if (originalGame === undefined) delete globalThis.game;
  else globalThis.game = originalGame;
});

function snapshot() {
  return {
    schemaVersion: 1,
    eventId: "event-1",
    sessionId: "session-1",
    definitionSnapshotId: "definition-1",
    shipId: "ship-1",
    encounterRevision: 7,
    shipRevision: 4,
    lifecycleState: "active",
    stageId: "stage-final",
    roundNumber: 3,
    phase: "cleanup-advance",
    completedRoundHistory: {
      schemaVersion: 1,
      eventId: "event-1",
      sessionId: "session-1",
      definitionSnapshotId: "definition-1",
      roundCount: 3,
      rounds: [
        { roundId: "round-1", roundNumber: 1, roundResult: "round-success" },
        { roundId: "round-2", roundNumber: 2, roundResult: "round-failure" },
        { roundId: "round-3", roundNumber: 3, roundResult: "round-success" }
      ]
    },
    momentum: 2,
    focusPools: [{ operatorId: "operator-1", stationId: "captain", current: 1, capacity: 2 }],
    pressureSystems: VOYAGE_PRESSURE_SYSTEM_IDS.map((pressureSystemId) => ({ pressureSystemId, value: 0, capacity: 2 })),
    activeHazards: [],
    pendingStationBenefitIds: ["benefit-1"],
    unconsumedRiskBidBenefitIds: ["risk-benefit-1"],
    temporaryFocusPenaltyIds: ["focus-penalty-1"],
    roundOrderRestrictions: [{ restrictionId: "persistent-order", persistence: "persistent" }],
    hazardSuppressions: [],
    temporaryConsequenceIds: ["temporary-consequence-1"]
  };
}

function previewRequest() {
  return {
    kind: "m10-closeout-preview",
    sessionId: "session-1",
    expectedEncounterRevision: 7,
    expectedShipRevision: 4,
    closeoutSnapshot: snapshot(),
    shipState: {
      shipId: "ship-1",
      revision: 4,
      installed: { hullPlatform: "void-skiff" },
      hull: { voidScarCapacity: 2 },
      voidScars: []
    },
    eventDefinition: {
      schemaVersion: 1,
      eventId: "event-1",
      definitionSnapshotId: "definition-1",
      roundCount: 3,
      rounds: [
        { roundId: "round-1", roundNumber: 1 },
        { roundId: "round-2", roundNumber: 2 },
        { roundId: "round-3", roundNumber: 3 }
      ],
      rewards: [{
        rewardId: "reward-1",
        kind: "item",
        title: "Reward",
        description: "A reward.",
        tags: ["authored"],
        enhancementIds: [],
        voidFortune: null,
        fieldRepairResource: null
      }],
      enhancements: [],
      misfortuneEnhancements: [],
      misfortunes: [],
      nextSituations: [{ nextSituationId: "next-1", title: "Next", summary: "Continue.", transitionKind: "delay" }]
    },
    rewardAllocation: {
      eventId: "event-1",
      sessionId: "session-1",
      rewardSelections: [{ operation: "add-reward", rewardId: "reward-1", enhancementId: null }]
    },
    negativeSelection: null,
    closeoutScarDefinitions: [],
    breakdownDefinitions: [],
    emergencyResponseEvidence: []
  };
}

function voyageState() {
  return {
    schemaVersion: 1,
    revision: 4,
    voidScars: [],
    disabledSystems: [],
    rewards: [],
    resources: [],
    persistentConsequences: [],
    eventHistory: [],
    closeoutLedger: []
  };
}

function actorFixture() {
  const actor = {
    id: "ship-1",
    type: "vehicle",
    flags: {
      arcflight: {
        enabled: true,
        actorType: "arcflightShip",
        sibling: { preserved: true },
        system: {
          installed: { hullPlatform: "void-skiff", components: [{ id: "component-1" }] },
          base: { hull: { voidScarCapacity: 2 } },
          voyage: voyageState()
        }
      }
    },
    system: { attributes: { preserved: true } },
    items: [{ id: "item-1", type: "equipment" }],
    updates: [],
    async update(patch) {
      this.updates.push(structuredClone(patch));
      const voyage = patch["flags.arcflight.system.voyage"];
      const ledger = patch["flags.arcflight.system.voyage.closeoutLedger"];
      if (voyage !== undefined) this.flags.arcflight.system.voyage = structuredClone(voyage);
      if (ledger !== undefined) this.flags.arcflight.system.voyage.closeoutLedger = structuredClone(ledger);
      return this;
    }
  };
  actor.getFlag = (moduleId, key) => actor.flags[moduleId]?.[key];
  return actor;
}

function installGame(actor, overrides = {}) {
  globalThis.game = {
    user: { id: "gm-1", isGM: true },
    users: { activeGM: { id: "gm-1" } },
    actors: { get: (id) => id === actor.id ? actor : null, contents: [actor] },
    ...overrides
  };
}

function approvedRequest() {
  const request = previewRequest();
  const preview = analyzeVoyageEncounterCloseoutPreview(request);
  assert.equal(preview.ok, true, JSON.stringify(preview.errors));
  const reviewRequest = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest: request,
    suppliedPreview: preview.preview
  };
  const review = analyzeVoyageEncounterCloseoutReview(reviewRequest);
  assert.equal(review.ok, true, JSON.stringify(review.errors));
  return {
    kind: "m10-persist-approved-closeout",
    previewRequest: request,
    reviewRequest,
    applicationPlan: review.applicationPlan
  };
}

function negativeApprovedRequest() {
  const request = previewRequest();
  request.eventDefinition.rewards = [];
  request.eventDefinition.misfortuneEnhancements = [
    { misfortuneEnhancementId: "enhancement-1", title: "First", description: "First enhancement.", compatibleMisfortuneIds: ["misfortune-1"], maxApplicationsPerMisfortune: 1 },
    { misfortuneEnhancementId: "enhancement-2", title: "Second", description: "Second enhancement.", compatibleMisfortuneIds: ["misfortune-1"], maxApplicationsPerMisfortune: 1 }
  ];
  request.eventDefinition.misfortunes = [{
    misfortuneId: "misfortune-1",
    kind: "travel-delay",
    title: "A misfortune",
    description: "A lasting misfortune.",
    tags: ["authored"],
    persistence: "persistent",
    enhancementIds: ["enhancement-1", "enhancement-2"],
    scarConsequenceProposal: {
      voidScarDefinitionId: "scar-definition-1",
      pressureSystemId: "crew-morale",
      source: "m8-critical-overall-failure"
    }
  }];
  request.eventDefinition.nextSituations = [{ nextSituationId: "next-1", title: "Next", summary: "Continue.", transitionKind: "delay" }];
  request.rewardAllocation = null;
  request.negativeSelection = { misfortuneId: "misfortune-1", enhancementIds: ["enhancement-1", "enhancement-2"] };
  request.closeoutScarDefinitions = [{
    schemaVersion: 1,
    voidScarDefinitionId: "scar-definition-1",
    pressureSystemId: "crew-morale",
    name: "Crew morale closeout Scar",
    description: "A crew morale Scar.",
    operationalEffects: ["Crew morale operations are impaired."],
    baseRepairCost: 100,
    baseRepairTime: 1,
    repairDcSource: "very-hard",
    eligibleRepairChecks: ["crafting"],
    requiredFacilities: ["drydock"],
    compatibleFieldRepairTags: ["crew-morale-field-repair"]
  }];
  request.closeoutSnapshot.completedRoundHistory.rounds = request.closeoutSnapshot.completedRoundHistory.rounds
    .map((round) => ({ ...round, roundResult: "critical-round-failure" }));
  const preview = analyzeVoyageEncounterCloseoutPreview(request);
  assert.equal(preview.ok, true, JSON.stringify(preview.errors));
  const reviewRequest = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest: request,
    suppliedPreview: preview.preview
  };
  const review = analyzeVoyageEncounterCloseoutReview(reviewRequest);
  assert.equal(review.ok, true, JSON.stringify(review.errors));
  return {
    kind: "m10-persist-approved-closeout",
    previewRequest: request,
    reviewRequest,
    applicationPlan: review.applicationPlan
  };
}

function reservationReceipt(entry, activeGmUserId = "gm-1") {
  return {
    kind: "voyage.m11-closeout-session-reserved",
    reservationId: `arcflight-closeout-reservation:${JSON.stringify([entry.applicationId])}`,
    activeGmUserId,
    applicationId: entry.applicationId,
    closeoutId: entry.closeoutId,
    eventId: entry.eventId,
    sessionId: entry.sessionId,
    definitionSnapshotId: entry.definitionSnapshotId,
    shipId: entry.shipId,
    expectedEncounterRevision: entry.expectedEncounterRevision
  };
}

function commitReceipt(entry, activeGmUserId = "gm-1") {
  return {
    kind: "voyage.m11-closeout-session-committed",
    reservationId: entry.sessionReservationReceipt.reservationId,
    activeGmUserId,
    applicationId: entry.applicationId,
    closeoutId: entry.closeoutId,
    eventId: entry.eventId,
    sessionId: entry.sessionId,
    definitionSnapshotId: entry.definitionSnapshotId,
    shipId: entry.shipId,
    previousEncounterRevision: entry.expectedEncounterRevision,
    encounterRevision: entry.resultingEncounterRevision,
    completedCloseoutSnapshot: entry.completedCloseoutSnapshot,
    encounterEvents: entry.events.filter((event) => [
      "voyage.hazard-closeout-consequence-applied", "voyage.pressure-breach-applied", "voyage.closeout-applied"
    ].includes(event.type))
  };
}

test("prepares exact ledger state without changing gameplay or sibling data", async () => {
  const actor = actorFixture();
  installGame(actor);
  const before = {
    system: structuredClone(actor.system),
    items: structuredClone(actor.items),
    sibling: structuredClone(actor.flags.arcflight.sibling),
    installed: structuredClone(actor.flags.arcflight.system.installed),
    voyage: structuredClone(actor.flags.arcflight.system.voyage)
  };
  const result = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.status, "prepared-awaiting-session");
  assert.equal(actor.updates.length, 1);
  assert.deepEqual(Object.keys(actor.updates[0]), ["flags.arcflight.system.voyage.closeoutLedger"]);
  assert.deepEqual(actor.system, before.system);
  assert.deepEqual(actor.items, before.items);
  assert.deepEqual(actor.flags.arcflight.sibling, before.sibling);
  assert.deepEqual(actor.flags.arcflight.system.installed, before.installed);
  assert.equal(actor.flags.arcflight.system.voyage.revision, 4);
  assert.equal(actor.flags.arcflight.system.voyage.closeoutLedger[0].status, "prepared-awaiting-session");
  assert.deepEqual(Object.keys(actor.flags.arcflight.system.voyage.closeoutLedger[0]), [
    "applicationId", "closeoutId", "status", "eventId", "sessionId", "definitionSnapshotId", "shipId",
    "expectedEncounterRevision", "resultingEncounterRevision", "expectedShipRevision", "resultingShipRevision", "gmUserId",
    "beforeState", "afterState", "completedCloseoutSnapshot", "events", "sessionReservationReceipt", "sessionCommitReceipt"
  ]);
});

test("prepared retry is idempotent and hostile roots fail safely", async () => {
  const actor = actorFixture();
  installGame(actor);
  const request = approvedRequest();
  const first = await persistVoyageEncounterApprovedCloseout(request);
  assert.equal(first.ok, true, JSON.stringify(first));
  const updates = actor.updates.length;
  const retry = await persistVoyageEncounterApprovedCloseout(request);
  assert.equal(retry.status, "already-prepared-awaiting-session");
  assert.equal(actor.updates.length, updates);
  for (const hostile of [Symbol("x"), () => {}, 1n, new Date(), new Map(), new Set()]) {
    const result = await persistVoyageEncounterApprovedCloseout(hostile);
    assert.equal(result.ok, false);
    assert.equal(result.applicationId, null);
    assert.deepEqual(result.events, []);
    assert.equal(result.errors[0].code, "m10-hostile-data-capture-failed");
  }
  const invalidRoot = await persistVoyageEncounterApprovedCloseout(null);
  assert.equal(invalidRoot.ok, false);
  assert.equal(invalidRoot.errors[0].code, "m10-invalid-request-shape");
  assert.equal(first.ok, true);
});

test("reservation continuation consumes only an exact receipt and preserves retry", async () => {
  const actor = actorFixture();
  installGame(actor);
  const request = approvedRequest();
  await persistVoyageEncounterApprovedCloseout(request);
  const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const receipt = reservationReceipt(entry);
  const continued = await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt });
  assert.equal(continued.ok, true, JSON.stringify(continued.errors));
  assert.equal(continued.status, "ship-applied-awaiting-session");
  assert.deepEqual(Object.keys(actor.updates.at(-1)), ["flags.arcflight.system.voyage"]);
  assert.equal(actor.flags.arcflight.system.voyage.revision, entry.resultingShipRevision);
  const writes = actor.updates.length;
  const retry = await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt });
  assert.equal(retry.status, "already-ship-applied-awaiting-session");
  assert.equal(actor.updates.length, writes);
  const mismatch = await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt: { ...receipt, expectedEncounterRevision: 99 } });
  assert.deepEqual(mismatch.errors, [{ code: "m10-invalid-session-reservation-receipt", path: "receipt", message: "M11 session reservation receipt does not match the prepared closeout.", severity: "error" }]);
});

test("checkpoint is read-only and finalization commits the ledger only", async () => {
  const actor = actorFixture();
  installGame(actor);
  const preserved = {
    system: structuredClone(actor.system),
    items: structuredClone(actor.items),
    sibling: structuredClone(actor.flags.arcflight.sibling),
    installed: structuredClone(actor.flags.arcflight.system.installed)
  };
  const request = approvedRequest();
  await persistVoyageEncounterApprovedCloseout(request);
  let entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const receipt = reservationReceipt(entry);
  await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt });
  assert.deepEqual(actor.system, preserved.system);
  assert.deepEqual(actor.items, preserved.items);
  assert.deepEqual(actor.flags.arcflight.sibling, preserved.sibling);
  assert.deepEqual(actor.flags.arcflight.system.installed, preserved.installed);
  entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const checkpoint = await verifyVoyageEncounterCloseoutShipCheckpoint({ kind: "m10-verify-closeout-ship-checkpoint", applicationId: entry.applicationId, reservationId: receipt.reservationId });
  assert.deepEqual(checkpoint, { ok: true, readyForSessionCommit: true, applicationId: entry.applicationId, closeoutId: entry.closeoutId, shipId: entry.shipId, revision: entry.resultingShipRevision, errors: [], warnings: [] });
  const gameplay = structuredClone(actor.flags.arcflight.system.voyage);
  const commit = await finalizeVoyageEncounterCloseoutReceipt({ kind: "m10-finalize-closeout-receipt", applicationId: entry.applicationId, receipt: commitReceipt(entry) });
  assert.equal(commit.ok, true, JSON.stringify(commit.errors));
  assert.equal(commit.status, "committed");
  assert.deepEqual(actor.system, preserved.system);
  assert.deepEqual(actor.items, preserved.items);
  assert.deepEqual(actor.flags.arcflight.sibling, preserved.sibling);
  assert.deepEqual(actor.flags.arcflight.system.installed, preserved.installed);
  assert.deepEqual(Object.keys(actor.updates.at(-1)), ["flags.arcflight.system.voyage.closeoutLedger"]);
  assert.deepEqual({ ...actor.flags.arcflight.system.voyage, closeoutLedger: [] }, { ...gameplay, closeoutLedger: [] });
  const writes = actor.updates.length;
  const retry = await finalizeVoyageEncounterCloseoutReceipt({ kind: "m10-finalize-closeout-receipt", applicationId: entry.applicationId, receipt: commitReceipt({ ...entry, sessionReservationReceipt: receipt }) });
  assert.equal(retry.status, "already-committed");
  assert.equal(actor.updates.length, writes);
});

test("active-GM loss, stale revision, and checkpoint drift fail without later writes", async () => {
  const actor = actorFixture();
  installGame(actor);
  const request = approvedRequest();
  globalThis.game.user.isGM = false;
  const denied = await persistVoyageEncounterApprovedCloseout(request);
  assert.deepEqual(denied.errors, [{ code: "m10-active-gm-required", path: "game.user", message: "Executing Foundry user is not the current active GM.", severity: "error" }]);
  assert.equal(actor.updates.length, 0);
  globalThis.game.user.isGM = true;
  await persistVoyageEncounterApprovedCloseout(request);
  const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const receipt = reservationReceipt(entry);
  actor.flags.arcflight.system.voyage.revision = 99;
  const drift = await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt });
  assert.equal(drift.ok, false);
  assert.equal(drift.errors[0].code, "m10-reconciliation-required");
});

test("all adapter boundaries contain hostile roots with exact empty sentinels", async () => {
  const cases = [null, Symbol("x"), () => {}, 1n, undefined, NaN, new Date(), new Map(), new Set(), [], class Example {}];
  const calls = [
    (value) => persistVoyageEncounterApprovedCloseout(value),
    (value) => continueVoyageEncounterCloseoutReservation(value),
    (value) => verifyVoyageEncounterCloseoutShipCheckpoint(value),
    (value) => finalizeVoyageEncounterCloseoutReceipt(value)
  ];
  for (const call of calls) {
    for (const value of cases) {
      let result;
      await assert.doesNotReject(async () => { result = await call(value); });
      assert.equal(result.ok, false);
      assert.deepEqual(result.events ?? [], []);
      assert.deepEqual(result.warnings, []);
      assert.equal(result.applicationId, null);
    }
  }
});

test("control transfer uses only a newly authenticated exact reservation and commit receipt", async () => {
  const actor = actorFixture();
  installGame(actor);
  const request = approvedRequest();
  const prepared = await persistVoyageEncounterApprovedCloseout(request);
  assert.equal(prepared.ok, true, JSON.stringify(prepared.errors));
  let entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  globalThis.game.user = { id: "gm-2", isGM: true };
  globalThis.game.users.activeGM = { id: "gm-2" };
  const receipt = reservationReceipt(entry, "gm-2");
  const continued = await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt });
  assert.equal(continued.ok, true, JSON.stringify(continued.errors));
  entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const checkpoint = await verifyVoyageEncounterCloseoutShipCheckpoint({ kind: "m10-verify-closeout-ship-checkpoint", applicationId: entry.applicationId, reservationId: receipt.reservationId });
  assert.equal(checkpoint.ok, true, JSON.stringify(checkpoint.errors));
  const finalized = await finalizeVoyageEncounterCloseoutReceipt({ kind: "m10-finalize-closeout-receipt", applicationId: entry.applicationId, receipt: commitReceipt(entry, "gm-2") });
  assert.equal(finalized.ok, true, JSON.stringify(finalized.errors));
  assert.equal(actor.flags.arcflight.system.voyage.closeoutLedger[0].gmUserId, "gm-1");
});

test("failed persistence writes return no partial state and receipt mismatches do not write", async () => {
  const actor = actorFixture();
  const originalUpdate = actor.update;
  actor.update = async () => { throw new Error("write failed"); };
  installGame(actor);
  const failed = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.deepEqual(failed.errors, [{ code: "m10-persistence-write-failed", path: "flags.arcflight.system.voyage", message: "Foundry write did not complete or verify.", severity: "error" }]);
  assert.equal(actor.updates.length, 0);
  actor.update = originalUpdate;
  const prepared = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.equal(prepared.ok, true, JSON.stringify(prepared.errors));
  const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const receipt = reservationReceipt(entry);
  const before = actor.updates.length;
  const mismatch = await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt: { ...receipt, reservationId: "wrong" } });
  assert.deepEqual(mismatch.errors, [{ code: "m10-invalid-session-reservation-receipt", path: "receipt", message: "M11 session reservation receipt does not match the prepared closeout.", severity: "error" }]);
  assert.equal(actor.updates.length, before);
});

test("every adapter rejects the complete prohibited authority matrix", async () => {
  const prohibited = [
    "overallResult", "rewardAnalysis", "negativeAnalysis", "resultPackage", "hazardPlan", "pressurePlan", "breachPlan",
    "capacityAnalysis", "capacityExhaustion", "breakdownPlan", "outcomeProposal", "persistentProposals", "temporaryResetPlan",
    "preview", "previewId", "approved", "gmApproved", "approvalToken", "applicationId", "applicationPlan", "nextEncounterState",
    "nextCloseoutSnapshot", "nextShipState", "events", "patch", "ledgerEntry", "idempotencyStatus", "receipt", "sessionCommitReceipt",
    "requestId", "timestamp"
  ];
  const values = [null, false, 0, "", [], {}];
  const cases = [
    ["persist", (request) => persistVoyageEncounterApprovedCloseout(request), { kind: "m10-persist-approved-closeout", previewRequest: {}, reviewRequest: {}, applicationPlan: null }, new Set(["applicationPlan"])],
    ["continue", (request) => continueVoyageEncounterCloseoutReservation(request), { kind: "m10-continue-closeout-reservation", applicationId: "application", receipt: null }, new Set(["applicationId", "receipt"])],
    ["checkpoint", (request) => verifyVoyageEncounterCloseoutShipCheckpoint(request), { kind: "m10-verify-closeout-ship-checkpoint", applicationId: "application", reservationId: "reservation" }, new Set(["applicationId"])],
    ["finalize", (request) => finalizeVoyageEncounterCloseoutReceipt(request), { kind: "m10-finalize-closeout-receipt", applicationId: "application", receipt: null }, new Set(["applicationId", "receipt"])]
  ];
  for (const [, invoke, base, allowed] of cases) {
    for (const key of prohibited) {
      if (allowed.has(key)) continue;
      for (const source of values) {
        const value = Array.isArray(source) ? [] : source && typeof source === "object" ? {} : source;
        const request = { ...base, [key]: value };
        const result = await invoke(request);
        const expected = result.errors[0];
        assert.deepEqual(expected, {
          code: "m10-caller-authority-rejected",
          path: `request.${key}`,
          message: "Caller supplied calculated, application, persistence, or runtime authority.",
          severity: "error"
        });
        assert.equal(result.ok, false);
        assert.deepEqual(result.warnings, []);
      }
    }
  }
});

test("active-GM precedence wins before malformed owned state and ledger inspection", async () => {
  const actor = actorFixture();
  actor.flags.arcflight.system.voyage = { malformed: true };
  installGame(actor);
  globalThis.game.user.isGM = false;
  const denied = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.deepEqual(denied.errors, [{ code: "m10-active-gm-required", path: "game.user", message: "Executing Foundry user is not the current active GM.", severity: "error" }]);
  const continuation = await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: "application", receipt: { shipId: actor.id, activeGmUserId: "gm-1" } });
  assert.deepEqual(continuation.errors, [{ code: "m10-active-gm-required", path: "game.user", message: "Executing Foundry user is not the current active GM.", severity: "error" }]);
});

test("verification failures are classified without unverified gameplay rewrites", async () => {
  const preparationActor = actorFixture();
  const originalPreparationUpdate = preparationActor.update;
  preparationActor.update = async function (patch) {
    await originalPreparationUpdate.call(this, patch);
    this.flags.arcflight.system.voyage.closeoutLedger[0].gmUserId = "gm-drift";
  };
  installGame(preparationActor);
  const preparedFailure = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.equal(preparedFailure.status, "reconciliation-required");
  assert.equal(preparedFailure.errors[0].code, "m10-reconciliation-required");

  const continuationActor = actorFixture();
  const originalContinuationUpdate = continuationActor.update;
  installGame(continuationActor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  let entry = continuationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  const reservation = reservationReceipt(entry);
  continuationActor.update = async function (patch) {
    await originalContinuationUpdate.call(this, patch);
    const current = this.flags.arcflight.system.voyage.closeoutLedger[0];
    current.sessionReservationReceipt = { ...current.sessionReservationReceipt, activeGmUserId: "gm-2" };
  };
  const continuationFailure = await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt: reservation });
  assert.equal(continuationFailure.status, "reconciliation-required");
  assert.equal(continuationFailure.errors[0].code, "m10-reconciliation-required");

  const finalizationActor = actorFixture();
  installGame(finalizationActor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  entry = finalizationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  const finalReservation = reservationReceipt(entry);
  await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt: finalReservation });
  entry = finalizationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  const finalCommit = commitReceipt(entry);
  const originalFinalizationUpdate = finalizationActor.update;
  let skippedFinalizationWrite = false;
  finalizationActor.update = async function (patch) {
    if (!skippedFinalizationWrite) {
      skippedFinalizationWrite = true;
      return this;
    }
    return originalFinalizationUpdate.call(this, patch);
  };
  const finalizationFailure = await finalizeVoyageEncounterCloseoutReceipt({ kind: "m10-finalize-closeout-receipt", applicationId: entry.applicationId, receipt: finalCommit });
  assert.equal(finalizationFailure.status, "reconciliation-required");
  assert.equal(finalizationFailure.errors[0].code, "m10-reconciliation-required");
});

test("committed ledger rejects a mismatched receipt without changing status", async () => {
  const actor = actorFixture();
  installGame(actor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  let entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const reservation = reservationReceipt(entry);
  await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt: reservation });
  entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const commit = commitReceipt(entry);
  await finalizeVoyageEncounterCloseoutReceipt({ kind: "m10-finalize-closeout-receipt", applicationId: entry.applicationId, receipt: commit });
  const writes = actor.updates.length;
  const mismatch = await finalizeVoyageEncounterCloseoutReceipt({ kind: "m10-finalize-closeout-receipt", applicationId: entry.applicationId, receipt: { ...commit, encounterRevision: 999 } });
  assert.deepEqual(mismatch.errors, [{ code: "m10-invalid-session-commit-receipt", path: "receipt", message: "M11 session commit receipt does not match the prepared closeout.", severity: "error" }]);
  assert.equal(actor.updates.length, writes);
  assert.equal(actor.flags.arcflight.system.voyage.closeoutLedger[0].status, "committed");
});

test("malformed durable proposals, history, and ledger records fail before any write", async () => {
  const mutations = [
    ["disabledSystems", [{ malformed: true }]],
    ["rewards", [{ malformed: true }]],
    ["resources", [{ malformed: true }]],
    ["persistentConsequences", [{ malformed: true }]],
    ["eventHistory", [{ malformed: true }]],
    ["voidScars", [{ malformed: true }]],
    ["closeoutLedger", [null]]
  ];
  for (const [field, value] of mutations) {
    const actor = actorFixture();
    actor.flags.arcflight.system.voyage[field] = value;
    installGame(actor);
    const result = await persistVoyageEncounterApprovedCloseout(approvedRequest());
    assert.deepEqual(result.errors, [{ code: "m10-ledger-conflict", path: "closeoutLedger", message: "Ledger identity or state conflicts with this application.", severity: "error" }]);
    assert.equal(actor.updates.length, 0);
  }
});

test("nested hostile document and request values fail closed without mutation", async () => {
  const actor = actorFixture();
  installGame(actor);
  const request = approvedRequest();
  Object.defineProperty(request, "previewRequest", { enumerable: true, get() { throw new Error("getter"); } });
  const getterFailure = await persistVoyageEncounterApprovedCloseout(request);
  assert.equal(getterFailure.errors[0].code, "m10-hostile-data-capture-failed");
  const cycleRequest = approvedRequest();
  cycleRequest.previewRequest.closeoutSnapshot.cycle = cycleRequest.previewRequest.closeoutSnapshot;
  const cycleFailure = await persistVoyageEncounterApprovedCloseout(cycleRequest);
  assert.equal(cycleFailure.errors[0].code, "m10-hostile-data-capture-failed");
  const revoked = Proxy.revocable(actor.flags.arcflight.system, {});
  revoked.revoke();
  actor.flags.arcflight.system = revoked.proxy;
  const actorFailure = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.equal(actorFailure.errors[0].code, "m10-hostile-data-capture-failed");
  assert.equal(actor.updates.length, 0);
});

test("committed state is terminal for preparation and continuation drift", async () => {
  const preparationActor = actorFixture();
  installGame(preparationActor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  let entry = preparationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt: reservationReceipt(entry) });
  entry = preparationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  await finalizeVoyageEncounterCloseoutReceipt({ kind: "m10-finalize-closeout-receipt", applicationId: entry.applicationId, receipt: commitReceipt(entry) });
  const writes = preparationActor.updates.length;
  preparationActor.flags.arcflight.system.voyage.revision += 1;
  const preparedRetry = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.equal(preparedRetry.status, "reconciliation-required");
  assert.equal(preparedRetry.errors[0].code, "m10-reconciliation-required");
  assert.equal(preparationActor.updates.length, writes);
  assert.equal(preparationActor.flags.arcflight.system.voyage.closeoutLedger[0].status, "committed");

  const continuationActor = actorFixture();
  installGame(continuationActor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  entry = continuationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  const receipt = reservationReceipt(entry);
  await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt });
  entry = continuationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  await finalizeVoyageEncounterCloseoutReceipt({ kind: "m10-finalize-closeout-receipt", applicationId: entry.applicationId, receipt: commitReceipt(entry) });
  const continuationWrites = continuationActor.updates.length;
  continuationActor.flags.arcflight.system.voyage.revision += 1;
  const continuationRetry = await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt });
  assert.equal(continuationRetry.status, "reconciliation-required");
  assert.equal(continuationRetry.errors[0].code, "m10-reconciliation-required");
  assert.equal(continuationActor.updates.length, continuationWrites);
  assert.equal(continuationActor.flags.arcflight.system.voyage.closeoutLedger[0].status, "committed");
});

test("same applicationId identity conflicts never return a retry result or write", async () => {
  const fields = [
    ["closeoutId", "different-closeout"], ["eventId", "different-event"], ["sessionId", "different-session"],
    ["definitionSnapshotId", "different-definition"], ["shipId", "different-ship"], ["expectedEncounterRevision", 99],
    ["expectedShipRevision", 99], ["gmUserId", "gm-2"]
  ];
  for (const [field, value] of fields) {
    const actor = actorFixture();
    installGame(actor);
    await persistVoyageEncounterApprovedCloseout(approvedRequest());
    let entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
    await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt: reservationReceipt(entry) });
    entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
    await finalizeVoyageEncounterCloseoutReceipt({ kind: "m10-finalize-closeout-receipt", applicationId: entry.applicationId, receipt: commitReceipt(entry) });
    const writes = actor.updates.length;
    const request = approvedRequest();
    request.applicationPlan[field] = value;
    if (field === "gmUserId") {
      globalThis.game.user = { id: "gm-2", isGM: true };
      globalThis.game.users.activeGM = { id: "gm-2" };
    }
    const result = await persistVoyageEncounterApprovedCloseout(request);
    assert.deepEqual(result.errors, [{ code: "m10-ledger-conflict", path: "closeoutLedger", message: "Ledger identity or state conflicts with this application.", severity: "error" }], field);
    assert.equal(actor.updates.length, writes, field);
    assert.equal(actor.flags.arcflight.system.voyage.closeoutLedger[0].status, "committed", field);
  }
});

test("receipt mismatches never reconcile drifted gameplay", async () => {
  const continuationActor = actorFixture();
  installGame(continuationActor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  const entry = continuationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  const before = continuationActor.updates.length;
  continuationActor.flags.arcflight.system.voyage.revision += 1;
  const reservationFailure = await continueVoyageEncounterCloseoutReservation({
    kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId,
    receipt: { ...reservationReceipt(entry), reservationId: "wrong" }
  });
  assert.deepEqual(reservationFailure.errors, [{ code: "m10-invalid-session-reservation-receipt", path: "receipt", message: "M11 session reservation receipt does not match the prepared closeout.", severity: "error" }]);
  assert.equal(continuationActor.updates.length, before);

  const finalizationActor = actorFixture();
  installGame(finalizationActor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  let finalEntry = finalizationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: finalEntry.applicationId, receipt: reservationReceipt(finalEntry) });
  finalEntry = finalizationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  const finalBefore = finalizationActor.updates.length;
  finalizationActor.flags.arcflight.system.voyage.revision += 1;
  const commitFailure = await finalizeVoyageEncounterCloseoutReceipt({
    kind: "m10-finalize-closeout-receipt", applicationId: finalEntry.applicationId,
    receipt: { ...commitReceipt(finalEntry), encounterRevision: 999 }
  });
  assert.deepEqual(commitFailure.errors, [{ code: "m10-invalid-session-commit-receipt", path: "receipt", message: "M11 session commit receipt does not match the prepared closeout.", severity: "error" }]);
  assert.equal(finalizationActor.updates.length, finalBefore);
});

test("malformed nested proposal, event, and duplicate ledger data fail closed", async () => {
  const mutations = [
    (entry) => { entry.afterState.rewards = [{ ...entry.afterState.rewards[0], payload: { malformed: true } }]; },
    (entry) => { entry.events[0] = { malformed: true }; },
    (entry) => { entry.afterState = structuredClone(entry.beforeState); }
  ];
  for (const mutate of mutations) {
    const actor = actorFixture();
    installGame(actor);
    await persistVoyageEncounterApprovedCloseout(approvedRequest());
    const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
    if (mutate === mutations[2]) actor.flags.arcflight.system.voyage.closeoutLedger.push(structuredClone(entry));
    else mutate(entry);
    const writes = actor.updates.length;
    const result = await persistVoyageEncounterApprovedCloseout(approvedRequest());
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "m10-ledger-conflict");
    assert.equal(actor.updates.length, writes);
  }
});

test("inherited and hostile Actor metadata fail exact ship resolution without throwing", async () => {
  const inheritedActor = actorFixture();
  const inherited = Object.create({ enabled: true, actorType: "arcflightShip" });
  inherited.system = inheritedActor.flags.arcflight.system;
  inheritedActor.flags.arcflight = inherited;
  installGame(inheritedActor);
  const inheritedResult = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.deepEqual(inheritedResult.errors, [{ code: "m10-ship-document-not-found", path: "shipId", message: "Exact Arcflight ship Actor was not resolved.", severity: "error" }]);
  assert.equal(inheritedActor.updates.length, 0);

  const hostileActor = actorFixture();
  const revoked = Proxy.revocable(hostileActor.flags, {});
  revoked.revoke();
  hostileActor.flags = revoked.proxy;
  installGame(hostileActor);
  const hostileResult = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.equal(hostileResult.errors[0].code, "m10-hostile-data-capture-failed");
  assert.equal(hostileActor.updates.length, 0);
});

test("active-GM loss immediately before reconciliation returns authority failure without a second write", async () => {
  const actor = actorFixture();
  installGame(actor);
  const originalUpdate = actor.update;
  actor.update = async function (patch) {
    await originalUpdate.call(this, patch);
    this.flags.arcflight.system.voyage.closeoutLedger[0].gmUserId = "drifted-gm";
    globalThis.game.user.isGM = false;
  };
  const result = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.equal(result.status, "reconciliation-required");
  assert.deepEqual(result.errors, [{ code: "m10-active-gm-required", path: "game.user", message: "Executing Foundry user is not the current active GM.", severity: "error" }]);
  assert.equal(actor.updates.length, 1);

  const continuationActor = actorFixture();
  installGame(continuationActor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  let entry = continuationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  const reservation = reservationReceipt(entry);
  const continuationUpdate = continuationActor.update;
  continuationActor.update = async function (patch) {
    await continuationUpdate.call(this, patch);
    this.flags.arcflight.system.voyage.closeoutLedger[0].sessionReservationReceipt.activeGmUserId = "gm-drift";
    globalThis.game.user.isGM = false;
  };
  const continuationResult = await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt: reservation });
  assert.deepEqual(continuationResult.errors, [{ code: "m10-active-gm-required", path: "game.user", message: "Executing Foundry user is not the current active GM.", severity: "error" }]);
  assert.equal(continuationActor.updates.length, 2);

  const finalizationActor = actorFixture();
  installGame(finalizationActor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  entry = finalizationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  await continueVoyageEncounterCloseoutReservation({ kind: "m10-continue-closeout-reservation", applicationId: entry.applicationId, receipt: reservationReceipt(entry) });
  entry = finalizationActor.flags.arcflight.system.voyage.closeoutLedger[0];
  const finalUpdate = finalizationActor.update;
  let skipped = false;
  finalizationActor.update = async function (patch) {
    if (!skipped) {
      skipped = true;
      globalThis.game.user.isGM = false;
      return this;
    }
    return finalUpdate.call(this, patch);
  };
  const finalResult = await finalizeVoyageEncounterCloseoutReceipt({ kind: "m10-finalize-closeout-receipt", applicationId: entry.applicationId, receipt: commitReceipt(entry) });
  assert.deepEqual(finalResult.errors, [{ code: "m10-active-gm-required", path: "game.user", message: "Executing Foundry user is not the current active GM.", severity: "error" }]);
  assert.equal(finalizationActor.updates.length, 2);
});

test("derived resulting-revision conflicts never return duplicate success or write", async () => {
  for (const field of ["resultingEncounterRevision", "resultingShipRevision"]) {
    const actor = actorFixture();
    installGame(actor);
    const prepared = await persistVoyageEncounterApprovedCloseout(approvedRequest());
    assert.equal(prepared.ok, true, field);
    const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
    entry[field] += 1;
    const writes = actor.updates.length;
    const retry = await persistVoyageEncounterApprovedCloseout(approvedRequest());
    assert.equal(retry.ok, false, field);
    assert.equal(retry.errors[0].code, "m10-ledger-conflict", field);
    assert.equal(actor.updates.length, writes, field);
  }
});

test("reconciliation-required retries are read-only when state is unchanged", async () => {
  const actor = actorFixture();
  installGame(actor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  entry.status = "reconciliation-required";
  const receipt = reservationReceipt(entry);
  const writes = actor.updates.length;
  const retry = await continueVoyageEncounterCloseoutReservation({
    kind: "m10-continue-closeout-reservation",
    applicationId: entry.applicationId,
    receipt
  });
  assert.equal(retry.status, "reconciliation-required");
  assert.equal(retry.errors[0].code, "m10-reconciliation-required");
  assert.equal(actor.updates.length, writes);
});

test("checkpoint resolves Actor state before active-GM diagnostics", async () => {
  const malformed = actorFixture();
  malformed.flags.arcflight.system.voyage = { malformed: true };
  installGame(malformed, { user: { id: "gm-1", isGM: false } });
  const malformedResult = await verifyVoyageEncounterCloseoutShipCheckpoint({
    kind: "m10-verify-closeout-ship-checkpoint",
    applicationId: "application",
    reservationId: "reservation"
  });
  assert.equal(malformedResult.errors[0].code, "m10-active-gm-required");

  const valid = actorFixture();
  installGame(valid);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  globalThis.game.user.isGM = false;
  const validEntry = valid.flags.arcflight.system.voyage.closeoutLedger[0];
  const activeGmResult = await verifyVoyageEncounterCloseoutShipCheckpoint({
    kind: "m10-verify-closeout-ship-checkpoint",
    applicationId: validEntry.applicationId,
    reservationId: "reservation"
  });
  assert.equal(activeGmResult.errors[0].code, "m10-active-gm-required");
});

test("checkpoint does not inspect owned voyage state before active-GM authority", async () => {
  const actor = actorFixture();
  installGame(actor, { user: { id: "gm-1", isGM: false } });
  Object.defineProperty(actor.flags.arcflight.system, "voyage", {
    enumerable: true,
    configurable: true,
    get() { throw new Error("voyage must not be read before the GM decision"); }
  });
  const result = await verifyVoyageEncounterCloseoutShipCheckpoint({
    kind: "m10-verify-closeout-ship-checkpoint",
    applicationId: "application",
    reservationId: "reservation"
  });
  assert.deepEqual(result.errors, [{ code: "m10-active-gm-required", path: "game.user", message: "Executing Foundry user is not the current active GM.", severity: "error" }]);
  assert.deepEqual(result.warnings, []);
});

test("receipt event lists reject missing, duplicated, and reordered records", async () => {
  const actor = actorFixture();
  installGame(actor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  let entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  await continueVoyageEncounterCloseoutReservation({
    kind: "m10-continue-closeout-reservation",
    applicationId: entry.applicationId,
    receipt: reservationReceipt(entry)
  });
  entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const valid = commitReceipt(entry);
  const cases = [
    { ...valid, encounterEvents: [] },
    { ...valid, encounterEvents: [...valid.encounterEvents, ...valid.encounterEvents] },
    { ...valid, encounterEvents: [...valid.encounterEvents, ...valid.encounterEvents].reverse() }
  ];
  for (const receipt of cases) {
    const writes = actor.updates.length;
    const result = await finalizeVoyageEncounterCloseoutReceipt({
      kind: "m10-finalize-closeout-receipt",
      applicationId: entry.applicationId,
      receipt
    });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "m10-invalid-session-commit-receipt");
    assert.equal(actor.updates.length, writes);
  }
});

test("stored completed snapshots enforce canonical reset values", async () => {
  const mutations = [
    (snapshotValue) => { snapshotValue.momentum = 1; },
    (snapshotValue) => { snapshotValue.focusPools[0].current = 1; },
    (snapshotValue) => { snapshotValue.pressureSystems[0].value = 1; },
    (snapshotValue) => { snapshotValue.hazardSuppressions = [{ suppressionId: "suppression", hazardId: "hazard" }]; },
    (snapshotValue) => { snapshotValue.roundOrderRestrictions.push({ restrictionId: "temporary", persistence: "temporary" }); }
  ];
  for (const mutate of mutations) {
    const actor = actorFixture();
    installGame(actor);
    await persistVoyageEncounterApprovedCloseout(approvedRequest());
    const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
    mutate(entry.completedCloseoutSnapshot);
    const writes = actor.updates.length;
    const result = await persistVoyageEncounterApprovedCloseout(approvedRequest());
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "m10-ledger-conflict");
    assert.equal(actor.updates.length, writes);
  }
});

test("representative durable proposal families reject malformed canonical nested records", async () => {
  const families = [
    ["rewards", "void-fortune-grant", "m8-reward", "fortune", "ship", "ship-1"],
    ["resources", "field-repair-resource-grant", "m8-reward", "repair", "ship", "ship-1"],
    ["persistentConsequences", "misfortune", "m8-misfortune", "misfortune", "ship", "ship-1"],
    ["persistentConsequences", "catastrophic-breakdown", "m9-capacity-exhaustion", "breakdown", "pressure-system", "crew-morale"],
    ["persistentConsequences", "catastrophic-hazard", "m9-breakdown", "breakdown", "event", "event-1"],
    ["persistentConsequences", "emergency-response-outcome", "m9-emergency-response", "response", "pressure-system", "crew-morale"],
    ["disabledSystems", "system-disablement", "m9-breakdown", "breakdown", "pressure-system", "crew-morale"]
  ];
  for (const [collection, kind, sourceKind, sourceId, targetKind, targetId] of families) {
    const actor = actorFixture();
    installGame(actor);
    await persistVoyageEncounterApprovedCloseout(approvedRequest());
    const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
    const proposal = {
      proposalId: `arcflight-closeout-proposal:${JSON.stringify([entry.closeoutId, kind, sourceKind, sourceId, targetKind, targetId])}`,
      kind, sourceKind, sourceId, targetKind, targetId, title: "forged", description: "forged", payload: {}, required: true
    };
    entry.afterState[collection].push(proposal);
    const writes = actor.updates.length;
    const result = await persistVoyageEncounterApprovedCloseout(approvedRequest());
    assert.equal(result.ok, false, kind);
    assert.equal(result.errors[0].code, "m10-ledger-conflict", kind);
    assert.equal(actor.updates.length, writes, kind);
  }
});

test("malformed Hazard and M6/M7/M10 event records and exact batch IDs fail closed", async () => {
  const eventTypes = [
    "voyage.hazard-closeout-consequence-applied",
    "voyage.pressure-breach-applied",
    "voyage.void-scar-created",
    "voyage.closeout-void-scar-created"
  ];
  for (const type of eventTypes) {
    const actor = actorFixture();
    installGame(actor);
    await persistVoyageEncounterApprovedCloseout(approvedRequest());
    const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
    entry.events[0] = { type, malformed: true };
    const writes = actor.updates.length;
    const result = await persistVoyageEncounterApprovedCloseout(approvedRequest());
    assert.equal(result.ok, false, type);
    assert.equal(result.errors[0].code, "m10-ledger-conflict", type);
    assert.equal(actor.updates.length, writes, type);
  }

  const actor = actorFixture();
  installGame(actor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const batch = entry.events.find((event) => event.type === "voyage.closeout-persistent-state-applied");
  assert.ok(batch);
  batch.proposalIds = [...batch.proposalIds, "forged-proposal"];
  const writes = actor.updates.length;
  const result = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [{ code: "m10-ledger-conflict", path: "closeoutLedger", message: "Ledger identity or state conflicts with this application.", severity: "error" }]);
  assert.equal(actor.updates.length, writes);
});

test("completed history identities are bound to the completed snapshot", async () => {
  for (const field of ["eventId", "sessionId", "definitionSnapshotId"]) {
    const actor = actorFixture();
    installGame(actor);
    await persistVoyageEncounterApprovedCloseout(approvedRequest());
    const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
    entry.completedCloseoutSnapshot.completedRoundHistory[field] = `mismatch-${field}`;
    const writes = actor.updates.length;
    const result = await persistVoyageEncounterApprovedCloseout(approvedRequest());
    assert.equal(result.ok, false, field);
    assert.deepEqual(result.errors, [{ code: "m10-ledger-conflict", path: "closeoutLedger", message: "Ledger identity or state conflicts with this application.", severity: "error" }], field);
    assert.equal(actor.updates.length, writes, field);
  }
});

test("stored M8 Scar provenance is bound to its Misfortune and closeout identity", async () => {
  const misfortuneActor = actorFixture();
  installGame(misfortuneActor);
  await persistVoyageEncounterApprovedCloseout(negativeApprovedRequest());
  const misfortuneEntry = misfortuneActor.flags.arcflight.system.voyage.closeoutLedger[0];
  const misfortune = misfortuneEntry.afterState.persistentConsequences.find((proposal) => proposal.kind === "misfortune");
  assert.ok(misfortune);
  misfortune.payload.negativePackage.scarConsequenceProposals[0].source = "foreign-source";
  const misfortuneWrites = misfortuneActor.updates.length;
  const misfortuneFailure = await persistVoyageEncounterApprovedCloseout(negativeApprovedRequest());
  assert.equal(misfortuneFailure.ok, false);
  assert.equal(misfortuneFailure.errors[0].code, "m10-ledger-conflict");
  assert.equal(misfortuneActor.updates.length, misfortuneWrites);

  const scarActor = actorFixture();
  installGame(scarActor);
  await persistVoyageEncounterApprovedCloseout(negativeApprovedRequest());
  const scarEntry = scarActor.flags.arcflight.system.voyage.closeoutLedger[0];
  const scarEvent = scarEntry.events.find((event) => event.type === "voyage.closeout-void-scar-created");
  assert.ok(scarEvent);
  scarEvent.voidScar.source.eventId = "foreign-event";
  const scarWrites = scarActor.updates.length;
  const scarFailure = await persistVoyageEncounterApprovedCloseout(negativeApprovedRequest());
  assert.equal(scarFailure.ok, false);
  assert.equal(scarFailure.errors[0].code, "m10-ledger-conflict");
  assert.equal(scarActor.updates.length, scarWrites);
});

test("stored closeout event records reject forged consequence and breach arithmetic", async () => {
  const actor = actorFixture();
  installGame(actor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const finalEvent = entry.events.find((event) => event.type === "voyage.closeout-applied");
  assert.ok(finalEvent);
  finalEvent.overallResult = "forged-result";
  const writes = actor.updates.length;
  const failure = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.equal(failure.ok, false);
  assert.equal(failure.errors[0].code, "m10-ledger-conflict");
  assert.equal(actor.updates.length, writes);
});

test("stored M6 breach events bind nested encounter identity to the outer event", async () => {
  const actor = actorFixture();
  installGame(actor);
  await persistVoyageEncounterApprovedCloseout(approvedRequest());
  const entry = actor.flags.arcflight.system.voyage.closeoutLedger[0];
  const breachEvent = entry.events.find((event) => event.type === "voyage.pressure-breach-applied");
  if (!breachEvent) return;
  breachEvent.breach.encounterId = "foreign-event";
  const writes = actor.updates.length;
  const result = await persistVoyageEncounterApprovedCloseout(approvedRequest());
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m10-ledger-conflict");
  assert.equal(actor.updates.length, writes);
});
