import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeVoyageEncounterCloseoutReview,
  applyVoyageEncounterApprovedCloseout
} from "../../../scripts/voyage/domain/closeout-review.js";
import { analyzeVoyageEncounterCloseoutPreview } from "../../../scripts/voyage/domain/closeout.js";
import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../../../scripts/voyage/domain/constants.js";
import { VOYAGE_PRESSURE_BREACH_VOID_SCAR_DESCRIPTORS } from "../../../scripts/voyage/domain/void-scar-creation.js";
import { VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID } from "../../../scripts/voyage/domain/void-scar-schema.js";

const REVIEW_KEYS = [
  "ok", "readyForEmergencyResponse", "readyForControlledApplication", "closeoutId",
  "emergencyResponseHandoff", "applicationPlan", "errors", "warnings"
];
const APPLICATION_KEYS = [
  "ok", "applicationId", "closeoutId", "nextCloseoutSnapshot", "nextShipState", "events", "errors", "warnings"
];
const PROHIBITED_KEYS = [
  "overallResult", "rewardAnalysis", "negativeAnalysis", "resultPackage", "hazardPlan", "pressurePlan", "breachPlan",
  "capacityAnalysis", "capacityExhaustion", "breakdownPlan", "outcomeProposal", "persistentProposals", "temporaryResetPlan",
  "preview", "previewId", "approved", "gmApproved", "approvalToken", "applicationId", "applicationPlan", "nextEncounterState",
  "nextCloseoutSnapshot", "nextShipState", "events", "patch", "ledgerEntry", "idempotencyStatus", "receipt",
  "sessionCommitReceipt", "requestId", "timestamp"
];
const APPLICATION_PROHIBITED_KEYS = PROHIBITED_KEYS.filter((key) => key !== "applicationPlan");

function freshAuthorityValue(kind) {
  if (kind === "null") return null;
  if (kind === "false") return false;
  if (kind === "array") return [];
  if (kind === "object") return {};
  return kind;
}

function validPreviewRequest() {
  const closeoutSnapshot = {
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
    roundOrderRestrictions: [
      { restrictionId: "temporary-order", persistence: "temporary" },
      { restrictionId: "persistent-order", persistence: "persistent" }
    ],
    hazardSuppressions: [],
    temporaryConsequenceIds: ["temporary-consequence-1"]
  };
  return {
    kind: "m10-closeout-preview",
    sessionId: "session-1",
    expectedEncounterRevision: 7,
    expectedShipRevision: 4,
    closeoutSnapshot,
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

function pressureHazard() {
  return {
    hazardId: "hazard-1",
    encounterId: "event-1",
    category: "system",
    status: "active",
    name: "Hazard one",
    currentEffect: { effectId: "hazard-effect", description: "A tactical problem." },
    activationTiming: { kind: "event-closeout", stationId: null, resultId: null },
    removalMethod: { methodId: "address-hazard" },
    ignoredConsequence: { consequenceId: "consequence-1", kind: "pressure-change", pressureSystemId: "crew-morale", delta: 1, persistentProposal: null },
    visibility: "public",
    sourceKind: "authored-hazard",
    createdStageId: "stage-final",
    createdRoundNumber: 3,
    createdSequence: 1,
    escalation: { mode: "none", currentStageId: null, stages: [], countdown: null, maximumEscalationReached: false, escalationConsequence: null },
    collisionPolicy: "trigger-existing-consequence",
    duration: { mode: "none", remaining: null, initial: null, decrementTiming: null },
    failurePressureSystemId: "crew-morale",
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { consequence: { consequenceId: "collision-1", description: "A collision consequence." } } },
    pressureSystemId: "crew-morale",
    eventAreaId: null,
    pressureBreachId: null,
    stationId: "captain",
    actionId: "closeout-action",
    pressureEffectId: null,
    sourceIntentId: null,
    activationSource: null,
    branch: "no-roll",
    sourceTiming: "gm-confirmed",
    sourceVisibility: "public"
  };
}

function validM7Scar(id, pressureSystemId = "crew-morale") {
  const descriptor = VOYAGE_PRESSURE_BREACH_VOID_SCAR_DESCRIPTORS[pressureSystemId];
  const pressureBreachId = `fixture-breach-${id}`;
  return {
    voidScarId: `arcflight-void-scar:${JSON.stringify(["pressure-breach", pressureBreachId])}`,
    name: VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID[pressureSystemId],
    pressureSystemId,
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
    pressureBreachId,
    hazardId: `fixture-hazard-${id}`,
    encounterId: "event-1",
    stageId: "stage-final",
    roundNumber: 3,
    effectIndex: 0,
    sequence: 0,
    stationId: "captain",
    actionId: "closeout-action",
    pressureEffectId: `fixture-effect-${id}`,
    sourceIntentId: null,
    activationSource: "hazard-closeout",
    branch: "no-roll",
    timing: "gm-confirmed",
    visibility: "public"
  };
}

function breakdownDefinition(systemId = "crew-morale") {
  const descriptor = { consequenceId: "descriptive-consequence" };
  const catastrophicHazard = {
    hazardId: `catastrophic-${systemId}`,
    encounterId: "event-1",
    category: "system",
    status: "active",
    name: "Catastrophic system failure",
    currentEffect: descriptor,
    activationTiming: { kind: "immediate", stationId: null, resultId: null },
    removalMethod: { methodId: "emergency-response" },
    ignoredConsequence: descriptor,
    visibility: "public",
    sourceKind: "m9-catastrophic-breakdown",
    createdStageId: "stage-1",
    createdRoundNumber: 1,
    createdSequence: 0,
    escalation: { mode: "none", currentStageId: null, stages: [], countdown: null, maximumEscalationReached: false, escalationConsequence: null },
    collisionPolicy: "trigger-existing-consequence",
    duration: { mode: "none", remaining: null, initial: null, decrementTiming: null },
    failurePressureSystemId: systemId,
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { consequence: descriptor } },
    pressureSystemId: systemId,
    eventAreaId: null,
    pressureBreachId: "breakdown-breach",
    stationId: "engineer",
    actionId: "breakdown-action",
    pressureEffectId: "breakdown-pressure-effect",
    sourceIntentId: "breakdown-intent",
    activationSource: "catastrophic-breakdown",
    branch: "failure",
    sourceTiming: "consequences",
    sourceVisibility: "public"
  };
  const emergencyResponseDefinition = {
    schemaVersion: 1,
    emergencyResponseDefinitionId: `response-${systemId}`,
    breakdownDefinitionId: `breakdown-${systemId}`,
    systemId,
    systemKind: "pressure-system",
    title: "Emergency response",
    description: "An authored emergency response.",
    roundCount: 3,
    rounds: [1, 2, 3].map((roundNumber) => ({ roundId: `response-round-${systemId}-${roundNumber}`, roundNumber })),
    stabilizationOutcome: { outcomeId: `stabilized-${systemId}`, title: "Stabilized", description: "The system is contained.", nextSituationId: `next-${systemId}` },
    failureConsequences: [{ consequenceId: `failure-${systemId}`, kind: "strand", title: "Stranded", description: "The ship is stranded.", nextSituationId: `next-${systemId}` }],
    nextSituations: [{ nextSituationId: `next-${systemId}`, title: "Aftermath", summary: "The voyage continues.", transitionKind: "emergency" }]
  };
  return {
    schemaVersion: 1,
    breakdownDefinitionId: `breakdown-${systemId}`,
    systemId,
    systemKind: "pressure-system",
    title: "Catastrophic Breakdown",
    description: "An authored catastrophic breakdown.",
    catastrophicHazard,
    pausePlan: { timing: "after-current-segment", resumeCondition: "emergency-response-resolved" },
    emergencyResponseDefinition
  };
}

function pressureHazardVariant(hazardId, pressureSystemId, delta = 1) {
  const value = pressureHazard();
  value.hazardId = hazardId;
  value.ignoredConsequence = {
    consequenceId: `${hazardId}-consequence`,
    kind: "pressure-change",
    pressureSystemId,
    delta,
    persistentProposal: null
  };
  value.pressureSystemId = pressureSystemId;
  value.failurePressureSystemId = pressureSystemId;
  value.currentEffect.effectId = `${hazardId}-effect`;
  value.metadata.collision.consequence.consequenceId = `${hazardId}-collision`;
  return value;
}

function negativePreviewRequest() {
  const value = validPreviewRequest();
  value.eventDefinition.rewards = [];
  value.eventDefinition.misfortuneEnhancements = [
    { misfortuneEnhancementId: "enhancement-1", title: "First", description: "First enhancement.", compatibleMisfortuneIds: ["misfortune-1"], maxApplicationsPerMisfortune: 1 },
    { misfortuneEnhancementId: "enhancement-2", title: "Second", description: "Second enhancement.", compatibleMisfortuneIds: ["misfortune-1"], maxApplicationsPerMisfortune: 1 }
  ];
  value.eventDefinition.misfortunes = [{
    misfortuneId: "misfortune-1",
    kind: "travel-delay",
    title: "A misfortune",
    description: "A lasting misfortune.",
    tags: ["authored"],
    persistence: "persistent",
    enhancementIds: ["enhancement-1", "enhancement-2"],
    scarConsequenceProposal: { voidScarDefinitionId: "scar-definition-1", pressureSystemId: "crew-morale", source: "m8-critical-overall-failure" }
  }];
  value.rewardAllocation = null;
  value.negativeSelection = { misfortuneId: "misfortune-1", enhancementIds: ["enhancement-1", "enhancement-2"] };
  value.closeoutScarDefinitions = [{
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
  value.closeoutSnapshot.completedRoundHistory.rounds = value.closeoutSnapshot.completedRoundHistory.rounds
    .map((round) => ({ ...round, roundResult: "critical-round-failure" }));
  return value;
}

function makeApprovedApplication(previewRequestFactory = validPreviewRequest) {
  const previewRequest = previewRequestFactory();
  const preview = analyzeVoyageEncounterCloseoutPreview(previewRequest);
  assert.equal(preview.ok, true, JSON.stringify(preview.errors));
  const reviewRequest = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest,
    suppliedPreview: preview.preview
  };
  const review = analyzeVoyageEncounterCloseoutReview(reviewRequest);
  assert.equal(review.ok, true, JSON.stringify(review.errors));
  assert.equal(review.readyForControlledApplication, true);
  const request = {
    kind: "m10-apply-approved-closeout",
    previewRequest,
    reviewRequest,
    applicationPlan: review.applicationPlan
  };
  return { previewRequest, preview, reviewRequest, review, request };
}

function assertApplicationFailure(result, code, path, message) {
  assert.deepEqual(result, {
    ok: false,
    applicationId: null,
    closeoutId: null,
    nextCloseoutSnapshot: null,
    nextShipState: null,
    events: [],
    errors: [{ code, path, message, severity: "error" }],
    warnings: []
  });
}

function reviewFailure(result, code = "m10-invalid-request-shape", path = "request") {
  assert.deepEqual(result, {
    ok: false,
    readyForEmergencyResponse: false,
    readyForControlledApplication: false,
    closeoutId: null,
    emergencyResponseHandoff: null,
    applicationPlan: null,
    errors: [{
      code,
      path,
      message: code === "m10-caller-authority-rejected"
        ? "Caller supplied calculated, application, persistence, or runtime authority."
        : "Request shape, order, or root values are invalid.",
      severity: "error"
    }],
    warnings: []
  });
}

test("Task 3 review rejects hostile and malformed roots without throwing", () => {
  for (const value of [null, false, [], Object.create(null)]) {
    assert.doesNotThrow(() => {
      const result = analyzeVoyageEncounterCloseoutReview(value);
      reviewFailure(result);
    });
  }
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const hostile = analyzeVoyageEncounterCloseoutReview(revoked.proxy);
  assert.equal(hostile.ok, false);
  assert.deepEqual(hostile.errors, [{
    code: "m10-hostile-data-capture-failed",
    path: "$",
    message: "M10 data could not be captured safely.",
    severity: "error"
  }]);
});

test("Task 3 review rejects every caller authority field at the root", () => {
  for (const key of PROHIBITED_KEYS) {
    for (const value of ["null", "false", 0, "", "array", "object"]) {
      const request = { kind: "m10-closeout-review", sessionId: "s", gmUserId: "g", confirmed: true, previewRequest: {}, suppliedPreview: {} };
      request[key] = freshAuthorityValue(value);
      const result = analyzeVoyageEncounterCloseoutReview(request);
      assert.equal(result.ok, false);
      assert.deepEqual(Object.keys(result), REVIEW_KEYS);
      assert.deepEqual(result.errors, [{
        code: "m10-caller-authority-rejected",
        path: `request.${key}`,
        message: "Caller supplied calculated, application, persistence, or runtime authority.",
        severity: "error"
      }]);
      assert.equal(result.closeoutId, null);
      assert.equal(result.applicationPlan, null);
      assert.deepEqual(result.warnings, []);
    }
  }
});

test("Task 3 application has an atomic failure sentinel", () => {
  const result = applyVoyageEncounterApprovedCloseout(null, null, null);
  assert.deepEqual(result, {
    ok: false,
    applicationId: null,
    closeoutId: null,
    nextCloseoutSnapshot: null,
    nextShipState: null,
    events: [],
    errors: [{
      code: "m10-invalid-request-shape",
      path: "request",
      message: "Request shape, order, or root values are invalid.",
      severity: "error"
    }],
    warnings: []
  });
});

test("Task 3 application reports the exact invalid closeout snapshot diagnostic", () => {
  const approved = makeApprovedApplication();
  const result = applyVoyageEncounterApprovedCloseout({}, approved.previewRequest.shipState, approved.request);
  assert.deepEqual(result, {
    ok: false,
    applicationId: null,
    closeoutId: null,
    nextCloseoutSnapshot: null,
    nextShipState: null,
    events: [],
    errors: [{
      code: "m10-invalid-closeout-snapshot",
      path: "closeoutSnapshot",
      message: "Closeout snapshot is invalid.",
      severity: "error"
    }],
    warnings: []
  });
});

test("Task 3 application rejects an invalid mode without partial candidates", () => {
  const request = {
    kind: "wrong-mode",
    previewRequest: {},
    reviewRequest: {},
    applicationPlan: {}
  };
  const result = applyVoyageEncounterApprovedCloseout({}, {}, request);
  assert.equal(result.ok, false);
  assert.equal(result.nextCloseoutSnapshot, null);
  assert.equal(result.nextShipState, null);
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.errors, [{
    code: "m10-invalid-mode",
    path: "request.kind",
    message: "The requested M10 API mode is invalid.",
    severity: "error"
  }]);
});

test("Task 3 review and application regenerate an unblocked preview atomically", () => {
  const previewRequest = validPreviewRequest();
  const preview = analyzeVoyageEncounterCloseoutPreview(previewRequest);
  assert.equal(preview.ok, true, JSON.stringify(preview.errors));
  const reviewRequest = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest,
    suppliedPreview: preview.preview
  };
  const review = analyzeVoyageEncounterCloseoutReview(reviewRequest);
  assert.equal(review.ok, true);
  assert.equal(review.readyForControlledApplication, true);
  const applied = applyVoyageEncounterApprovedCloseout(
    previewRequest.closeoutSnapshot,
    previewRequest.shipState,
    {
      kind: "m10-apply-approved-closeout",
      previewRequest,
      reviewRequest,
      applicationPlan: review.applicationPlan
    }
  );
  assert.equal(applied.ok, true, JSON.stringify(applied.errors));
  assert.equal(applied.events.at(-1).type, "voyage.closeout-applied");
  assert.equal(applied.nextCloseoutSnapshot.lifecycleState, "completed-success");
  assert.equal(applied.nextShipState.revision, previewRequest.shipState.revision + 1);
});

test("Task 3 application of a matching blocked review returns the Emergency Response sentinel", () => {
  const previewRequest = validPreviewRequest();
  previewRequest.closeoutSnapshot.activeHazards = [pressureHazard()];
  previewRequest.closeoutSnapshot.pressureSystems[0].value = 2;
  previewRequest.shipState.voidScars = [validM7Scar("occupied-1"), validM7Scar("occupied-2", "arkengine")];
  previewRequest.breakdownDefinitions = [breakdownDefinition()];

  const preview = analyzeVoyageEncounterCloseoutPreview(previewRequest);
  assert.equal(preview.ok, true, JSON.stringify(preview.errors));
  assert.equal(preview.preview.blockedByEmergencyResponse, true);
  const reviewRequest = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest,
    suppliedPreview: preview.preview
  };
  const review = analyzeVoyageEncounterCloseoutReview(reviewRequest);
  assert.equal(review.ok, true, JSON.stringify(review.errors));
  assert.equal(review.readyForEmergencyResponse, true);
  assert.equal(review.readyForControlledApplication, false);
  assert.equal(review.applicationPlan, null);

  const applied = applyVoyageEncounterApprovedCloseout(previewRequest.closeoutSnapshot, previewRequest.shipState, {
    kind: "m10-apply-approved-closeout",
    previewRequest,
    reviewRequest,
    applicationPlan: null
  });
  assert.deepEqual(applied, {
    ok: false,
    applicationId: null,
    closeoutId: null,
    nextCloseoutSnapshot: null,
    nextShipState: null,
    events: [],
    errors: [{
      code: "m10-emergency-response-required",
      path: "emergencyResponseEvidence[0]",
      message: "Breakdown requires completed Emergency Response before application.",
      severity: "error"
    }],
    warnings: []
  });
});

test("Task 3 application rejects every prohibited authority field with the exact sentinel", () => {
  for (const key of APPLICATION_PROHIBITED_KEYS) {
    for (const value of ["null", "false", 0, "", "array", "object"]) {
      const request = { kind: "m10-apply-approved-closeout", previewRequest: {}, reviewRequest: {}, applicationPlan: {} };
      request[key] = freshAuthorityValue(value);
      const result = applyVoyageEncounterApprovedCloseout(null, null, request);
      assert.equal(result.ok, false);
      assert.deepEqual(Object.keys(result), APPLICATION_KEYS);
      assert.deepEqual(result.errors, [{
        code: "m10-caller-authority-rejected",
        path: `request.${key}`,
        message: "Caller supplied calculated, application, persistence, or runtime authority.",
        severity: "error"
      }]);
      assert.equal(result.applicationId, null);
      assert.equal(result.closeoutId, null);
      assert.equal(result.nextCloseoutSnapshot, null);
      assert.equal(result.nextShipState, null);
      assert.deepEqual(result.events, []);
      assert.deepEqual(result.warnings, []);
    }
  }
});

test("Task 3 application contains hostile roots without partial candidates", () => {
  const request = { kind: "m10-apply-approved-closeout", previewRequest: {}, reviewRequest: {}, applicationPlan: {} };
  const hostileValues = [];
  const getter = {};
  Object.defineProperty(getter, "value", { enumerable: true, get() { throw new Error("hostile"); } });
  hostileValues.push(getter);
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  hostileValues.push(revoked.proxy);
  const cycle = {};
  cycle.self = cycle;
  hostileValues.push(cycle);
  for (const root of hostileValues) {
    const result = applyVoyageEncounterApprovedCloseout(root, null, request);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [{
      code: "m10-hostile-data-capture-failed",
      path: "$",
      message: "M10 data could not be captured safely.",
      severity: "error"
    }]);
    assert.equal(result.nextCloseoutSnapshot, null);
    assert.equal(result.nextShipState, null);
    assert.deepEqual(result.events, []);
  }
});

test("Task 3 contains the complete hostile value matrix at both public boundaries", () => {
  const previewRequest = validPreviewRequest();
  const preview = analyzeVoyageEncounterCloseoutPreview(previewRequest);
  assert.equal(preview.ok, true, JSON.stringify(preview.errors));
  const reviewBase = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest,
    suppliedPreview: preview.preview
  };
  const applyRequest = {
    kind: "m10-apply-approved-closeout",
    previewRequest: {},
    reviewRequest: {},
    applicationPlan: {}
  };
  class HostileClass {}
  const directCycle = {};
  directCycle.self = directCycle;
  const indirectA = {};
  const indirectB = { indirectA };
  indirectA.indirectB = indirectB;
  const sparse = [];
  sparse.length = 1;
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const reflectionFailing = new Proxy({}, { ownKeys() { throw new Error("reflection failure"); } });
  const values = [
    Symbol("hostile"),
    () => {},
    1n,
    undefined,
    NaN,
    Infinity,
    -Infinity,
    new Date(0),
    new Map(),
    new Set(),
    new HostileClass(),
    sparse,
    directCycle,
    indirectA,
    revoked.proxy,
    reflectionFailing
  ];
  for (const value of values) {
    let fingerprint = null;
    try {
      fingerprint = {
        keys: Reflect.ownKeys(value),
        length: Array.isArray(value) ? value.length : null,
        date: value instanceof Date ? value.getTime() : null,
        map: value instanceof Map ? [...value.entries()] : null,
        set: value instanceof Set ? [...value.values()] : null
      };
    } catch {
      fingerprint = null;
    }
    let reviewResult;
    assert.doesNotThrow(() => {
      reviewResult = analyzeVoyageEncounterCloseoutReview({ ...reviewBase, suppliedPreview: value });
    });
    assert.deepEqual(reviewResult, {
      ok: false,
      readyForEmergencyResponse: false,
      readyForControlledApplication: false,
      closeoutId: null,
      emergencyResponseHandoff: null,
      applicationPlan: null,
      errors: [{ code: "m10-hostile-data-capture-failed", path: "$", message: "M10 data could not be captured safely.", severity: "error" }],
      warnings: []
    });

    let applicationResult;
    assert.doesNotThrow(() => {
      applicationResult = applyVoyageEncounterApprovedCloseout(value, previewRequest.shipState, applyRequest);
    });
    assertApplicationFailure(applicationResult, "m10-hostile-data-capture-failed", "$", "M10 data could not be captured safely.");
    const repeatedReview = analyzeVoyageEncounterCloseoutReview({ ...reviewBase, suppliedPreview: value });
    const repeatedApplication = applyVoyageEncounterApprovedCloseout(value, previewRequest.shipState, applyRequest);
    assert.equal(JSON.stringify(reviewResult), JSON.stringify(repeatedReview));
    assert.equal(JSON.stringify(applicationResult), JSON.stringify(repeatedApplication));
    if (fingerprint) {
      assert.deepEqual(Reflect.ownKeys(value), fingerprint.keys);
      if (Array.isArray(value)) assert.equal(value.length, fingerprint.length);
      if (value instanceof Date) assert.equal(value.getTime(), fingerprint.date);
      if (value instanceof Map) assert.deepEqual([...value.entries()], fingerprint.map);
      if (value instanceof Set) assert.deepEqual([...value.values()], fingerprint.set);
    }
  }
});

test("Task 3 accepts acyclic shared references while isolating every occurrence", () => {
  const previewRequest = validPreviewRequest();
  const preview = analyzeVoyageEncounterCloseoutPreview(previewRequest);
  assert.equal(preview.ok, true, JSON.stringify(preview.errors));
  const sharedEmpty = [];
  const suppliedPreview = {
    ...preview.preview,
    hazardCloseoutResults: sharedEmpty,
    pressureBreachResults: sharedEmpty
  };
  const review = analyzeVoyageEncounterCloseoutReview({
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest,
    suppliedPreview
  });
  assert.equal(review.ok, true, JSON.stringify(review.errors));
  assert.notEqual(review.applicationPlan.expectedPreview.hazardCloseoutResults, review.applicationPlan.expectedPreview.pressureBreachResults);
  review.applicationPlan.expectedPreview.hazardCloseoutResults.push("isolated");
  assert.deepEqual(review.applicationPlan.expectedPreview.pressureBreachResults, []);

  const application = makeApprovedApplication();
  const sharedRequest = {
    kind: "m10-apply-approved-closeout",
    previewRequest: application.previewRequest,
    reviewRequest: application.reviewRequest,
    applicationPlan: application.review.applicationPlan
  };
  const result = applyVoyageEncounterApprovedCloseout(
    application.previewRequest.closeoutSnapshot,
    application.previewRequest.shipState,
    sharedRequest
  );
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  result.nextCloseoutSnapshot.completedRoundHistory.rounds[0].roundResult = "mutated";
  result.nextCloseoutSnapshot.completedRoundHistory.rounds[1].roundResult = "also-mutated";
  assert.equal(application.previewRequest.closeoutSnapshot.completedRoundHistory.rounds[0].roundResult, "round-success");
  assert.notEqual(result.nextCloseoutSnapshot.completedRoundHistory.rounds[0], result.nextCloseoutSnapshot.completedRoundHistory.rounds[1]);
});

test("Task 3 successful review and application are deterministic and non-mutating", () => {
  const first = makeApprovedApplication();
  const firstReviewInput = structuredClone(first.reviewRequest);
  const firstApplyInput = structuredClone(first.request);
  const firstReview = analyzeVoyageEncounterCloseoutReview(first.reviewRequest);
  const second = makeApprovedApplication();
  const secondReview = analyzeVoyageEncounterCloseoutReview(second.reviewRequest);
  assert.equal(JSON.stringify(firstReview), JSON.stringify(secondReview));
  assert.deepEqual(first.reviewRequest, firstReviewInput);

  const firstApplied = applyVoyageEncounterApprovedCloseout(
    first.previewRequest.closeoutSnapshot,
    first.previewRequest.shipState,
    first.request
  );
  const secondApplied = applyVoyageEncounterApprovedCloseout(
    second.previewRequest.closeoutSnapshot,
    second.previewRequest.shipState,
    second.request
  );
  assert.equal(firstApplied.ok, true, JSON.stringify(firstApplied.errors));
  assert.equal(JSON.stringify(firstApplied), JSON.stringify(secondApplied));
  assert.deepEqual(first.request, firstApplyInput);
  assert.deepEqual(first.previewRequest, firstReviewInput.previewRequest);
});

test("Task 3 preserves ordered Hazard/Breach/Scar revisions and exact event schemas", () => {
  const application = makeApprovedApplication(() => {
    const value = validPreviewRequest();
    value.closeoutSnapshot.activeHazards = [
      pressureHazardVariant("hazard-1", "crew-morale"),
      pressureHazardVariant("hazard-2", "arkengine")
    ];
    value.closeoutSnapshot.pressureSystems.find((entry) => entry.pressureSystemId === "crew-morale").value = 2;
    value.closeoutSnapshot.pressureSystems.find((entry) => entry.pressureSystemId === "arkengine").value = 2;
    return value;
  });
  const result = applyVoyageEncounterApprovedCloseout(
    application.previewRequest.closeoutSnapshot,
    application.previewRequest.shipState,
    application.request
  );
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.events.map((event) => event.type), [
    "voyage.hazard-closeout-consequence-applied",
    "voyage.pressure-breach-applied",
    "voyage.hazard-closeout-consequence-applied",
    "voyage.pressure-breach-applied",
    "voyage.void-scar-created",
    "voyage.void-scar-created",
    "voyage.closeout-persistent-state-applied",
    "voyage.closeout-applied"
  ]);
  assert.deepEqual(result.events.map((event) => [event.previousRevision ?? event.previousEncounterRevision ?? event.previousShipRevision, event.revision ?? event.encounterRevision]), [
    [7, 8], [8, 9], [9, 10], [10, 11], [4, 5], [5, 6], [6, 7], [11, 12]
  ]);
  assert.deepEqual(Object.keys(result.events[0]), [
    "type", "applicationId", "closeoutId", "encounterId", "eventId", "sessionId", "definitionSnapshotId", "shipId",
    "stageId", "roundNumber", "phase", "hazardId", "consequenceId", "consequenceKind", "pressureSystemId",
    "pressureEffect", "previousHazard", "disposition", "previousEncounterRevision", "encounterRevision"
  ]);
  assert.deepEqual(Object.keys(result.events[1]), [
    "type", "encounterId", "lifecycleState", "stageId", "roundNumber", "phase", "pressureEffectCount",
    "appliedEffectCount", "breach", "hazard", "collisionOutcome", "voidScarProposal", "pressureReset",
    "effects", "previousPressureSystems", "pressureSystems", "previousRevision", "revision"
  ]);
  assert.deepEqual(Object.keys(result.events[4]), [
    "type", "shipId", "encounterId", "pressureSystemId", "sourceEventType", "sourceEncounterRevision",
    "sourceProposal", "previousShipRevision", "revision", "previousVoidScarCount", "voidScarCount", "voidScar"
  ]);
  assert.deepEqual(Object.keys(result.events[5]), [
    "type", "shipId", "encounterId", "pressureSystemId", "sourceEventType", "sourceEncounterRevision",
    "sourceProposal", "previousShipRevision", "revision", "previousVoidScarCount", "voidScarCount", "voidScar"
  ]);
  assert.deepEqual(Object.keys(result.events[6]), [
    "type", "applicationId", "closeoutId", "shipId", "proposalIds", "previousShipRevision", "revision"
  ]);
  assert.deepEqual(Object.keys(result.events[7]), [
    "type", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId",
    "overallResult", "proposalIds", "previousEncounterRevision", "encounterRevision", "shipRevision"
  ]);
  assert.equal(result.events.filter((event) => event.type === "voyage.pressure-breach-applied").length, 2);
  assert.equal(result.events.filter((event) => event.type === "voyage.void-scar-created").length, 2);
  assert.equal(result.events.filter((event) => event.type === "voyage.closeout-applied").length, 1);
  assert.deepEqual(result.events.filter((event) => event.type === "voyage.hazard-closeout-consequence-applied").map((event) => event.hazardId), ["hazard-1", "hazard-2"]);
  assert.deepEqual(result.events.filter((event) => event.type === "voyage.void-scar-created").map((event) => event.sourceEventType), ["voyage.pressure-breach-applied", "voyage.pressure-breach-applied"]);
  assert.deepEqual(result.nextShipState.voidScars.map((scar) => scar.pressureSystemId), ["crew-morale", "arkengine"]);
  assert.deepEqual(result.nextShipState.disabledSystems, []);
  assert.deepEqual(result.nextShipState.resources, []);
  assert.deepEqual(result.nextShipState.persistentConsequences, []);
  assert.equal(result.nextCloseoutSnapshot.encounterRevision, 12);
  assert.equal(result.nextShipState.revision, 7);
});

test("Task 3 preserves the exact M10-v2 Scar-created event without M7 relabeling", () => {
  const application = makeApprovedApplication(negativePreviewRequest);
  const result = applyVoyageEncounterApprovedCloseout(
    application.previewRequest.closeoutSnapshot,
    application.previewRequest.shipState,
    application.request
  );
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const scarEvent = result.events.find((event) => event.type === "voyage.closeout-void-scar-created");
  assert.ok(scarEvent);
  assert.deepEqual(Object.keys(scarEvent), [
    "type", "applicationId", "closeoutId", "shipId", "eventId", "sessionId", "pressureSystemId",
    "sourceProposal", "previousShipRevision", "revision", "previousVoidScarCount", "voidScarCount", "voidScar"
  ]);
  assert.equal(scarEvent.sourceProposal.source, "m8-critical-overall-failure");
  assert.equal(scarEvent.previousShipRevision, 4);
  assert.equal(scarEvent.revision, 5);
  assert.equal(scarEvent.previousVoidScarCount, 0);
  assert.equal(scarEvent.voidScarCount, 1);
  assert.equal(result.events.some((event) => event.type === "voyage.void-scar-created"), false);
  assert.equal(result.nextShipState.voidScars.length, 1);
  assert.deepEqual(result.nextShipState.persistentConsequences.map(({ kind }) => kind), ["misfortune"]);
  assert.equal(result.nextShipState.eventHistory.length, 1);
});

test("Task 3 returns exact completed candidates, reset values, proposal classification, and history", () => {
  const application = makeApprovedApplication();
  const result = applyVoyageEncounterApprovedCloseout(
    application.previewRequest.closeoutSnapshot,
    application.previewRequest.shipState,
    application.request
  );
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(Object.keys(result.nextCloseoutSnapshot), [
    "schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "shipId", "encounterRevision", "shipRevision",
    "lifecycleState", "stageId", "roundNumber", "phase", "completedRoundHistory", "momentum", "focusPools",
    "pressureSystems", "activeHazards", "pendingStationBenefitIds", "unconsumedRiskBidBenefitIds",
    "temporaryFocusPenaltyIds", "roundOrderRestrictions", "hazardSuppressions", "temporaryConsequenceIds"
  ]);
  assert.equal(result.nextCloseoutSnapshot.lifecycleState, "completed-success");
  assert.equal(result.nextCloseoutSnapshot.momentum, 0);
  assert.deepEqual(result.nextCloseoutSnapshot.focusPools.map((pool) => pool.current), [0]);
  assert.deepEqual(result.nextCloseoutSnapshot.pressureSystems.map((system) => system.value), [0, 0, 0, 0, 0]);
  assert.deepEqual(result.nextCloseoutSnapshot.pendingStationBenefitIds, []);
  assert.deepEqual(result.nextCloseoutSnapshot.unconsumedRiskBidBenefitIds, []);
  assert.deepEqual(result.nextCloseoutSnapshot.temporaryFocusPenaltyIds, []);
  assert.deepEqual(result.nextCloseoutSnapshot.hazardSuppressions, []);
  assert.deepEqual(result.nextCloseoutSnapshot.temporaryConsequenceIds, []);
  assert.deepEqual(result.nextCloseoutSnapshot.roundOrderRestrictions, [{ restrictionId: "persistent-order", persistence: "persistent" }]);
  assert.deepEqual(result.nextCloseoutSnapshot.activeHazards, []);

  assert.deepEqual(Object.keys(result.nextShipState), [
    "schemaVersion", "revision", "voidScars", "disabledSystems", "rewards", "resources", "persistentConsequences", "eventHistory"
  ]);
  assert.deepEqual(result.nextShipState.rewards.map(({ kind }) => kind), ["reward-grant"]);
  assert.deepEqual(result.nextShipState.resources, []);
  assert.deepEqual(result.nextShipState.persistentConsequences, []);
  assert.deepEqual(result.applicationId, application.review.applicationPlan.applicationId);
  assert.deepEqual(result.nextShipState.eventHistory, [{
    applicationId: result.applicationId,
    closeoutId: application.preview.preview.closeoutId,
    eventId: "event-1",
    sessionId: "session-1",
    definitionSnapshotId: "definition-1",
    shipId: "ship-1",
    overallResult: "overall-success",
    previousEncounterRevision: 7,
    encounterRevision: 8,
    previousShipRevision: 4,
    shipRevision: 5,
    proposalIds: application.preview.preview.persistentProposals.map(({ proposalId }) => proposalId)
  }]);
  assert.deepEqual(application.preview.preview.persistentProposals.map(({ kind }) => kind), ["reward-grant", "event-history"]);
});

test("Task 3 enforces identity and revision bindings with canonical precedence", () => {
  const base = makeApprovedApplication();
  const cases = [
    ["event", (snapshot, ship) => { snapshot.eventId = "other-event"; snapshot.completedRoundHistory.eventId = "other-event"; }, "m10-event-identity-mismatch", "closeoutSnapshot.eventId", "Event identity is not bound."],
    ["session", (snapshot) => { snapshot.sessionId = "other-session"; snapshot.completedRoundHistory.sessionId = "other-session"; }, "m10-session-identity-mismatch", "closeoutSnapshot.sessionId", "Session identity is not bound."],
    ["definition", (snapshot) => { snapshot.definitionSnapshotId = "other-definition"; snapshot.completedRoundHistory.definitionSnapshotId = "other-definition"; }, "m10-definition-snapshot-mismatch", "closeoutSnapshot.definitionSnapshotId", "Definition snapshot is not bound."],
    ["ship", (snapshot, ship) => { snapshot.shipId = "other-ship"; ship.shipId = "other-ship"; }, "m10-ship-identity-mismatch", "closeoutSnapshot.shipId", "Ship identity is not bound."],
    ["encounter revision", (snapshot) => { snapshot.encounterRevision = 8; }, "m10-encounter-revision-mismatch", "expectedEncounterRevision", "Encounter revision is stale."],
    ["ship revision", (snapshot, ship) => { snapshot.shipRevision = 5; ship.revision = 5; }, "m10-ship-revision-mismatch", "expectedShipRevision", "Ship revision is stale."]
  ];
  for (const [, mutate, code, path, message] of cases) {
    const snapshot = structuredClone(base.previewRequest.closeoutSnapshot);
    const ship = structuredClone(base.previewRequest.shipState);
    mutate(snapshot, ship);
    const result = applyVoyageEncounterApprovedCloseout(snapshot, ship, base.request);
    assertApplicationFailure(result, code, path, message);
  }

  const combinedSnapshot = structuredClone(base.previewRequest.closeoutSnapshot);
  const combinedShip = structuredClone(base.previewRequest.shipState);
  combinedSnapshot.eventId = "other-event";
  combinedSnapshot.completedRoundHistory.eventId = "other-event";
  combinedSnapshot.sessionId = "other-session";
  combinedSnapshot.completedRoundHistory.sessionId = "other-session";
  combinedSnapshot.definitionSnapshotId = "other-definition";
  combinedSnapshot.completedRoundHistory.definitionSnapshotId = "other-definition";
  combinedSnapshot.shipId = "other-ship";
  combinedShip.shipId = "other-ship";
  combinedSnapshot.encounterRevision = 8;
  combinedSnapshot.shipRevision = 5;
  combinedShip.revision = 5;
  const combined = applyVoyageEncounterApprovedCloseout(combinedSnapshot, combinedShip, base.request);
  assertApplicationFailure(combined, "m10-event-identity-mismatch", "closeoutSnapshot.eventId", "Event identity is not bound.");
});

test("Task 3 review enforces confirmation and exact review envelope", () => {
  const previewRequest = validPreviewRequest();
  const preview = analyzeVoyageEncounterCloseoutPreview(previewRequest);
  const base = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest,
    suppliedPreview: preview.preview
  };
  const falseConfirmation = analyzeVoyageEncounterCloseoutReview({ ...base, confirmed: false });
  assert.deepEqual(Object.keys(falseConfirmation), REVIEW_KEYS);
  assert.deepEqual(falseConfirmation.errors, [{
    code: "m10-gm-confirmation-required",
    path: "confirmed",
    message: "Complete GM confirmation is required.",
    severity: "error"
  }]);
  const missingConfirmation = { ...base };
  delete missingConfirmation.confirmed;
  const missing = analyzeVoyageEncounterCloseoutReview(missingConfirmation);
  assert.equal(missing.ok, false);
  assert.equal(missing.errors[0].code, "m10-invalid-request-shape");
  const success = analyzeVoyageEncounterCloseoutReview(base);
  assert.equal(success.ok, true);
  assert.deepEqual(Object.keys(success), REVIEW_KEYS);
  assert.deepEqual(Object.keys(success.applicationPlan), [
    "schemaVersion", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId",
    "expectedEncounterRevision", "expectedShipRevision", "gmUserId", "persistentProposals", "temporaryResetPlan", "expectedPreview"
  ]);
});

test("Task 3 review rejects preview mutations, key-order drift, shape drift, and session mismatch", () => {
  const previewRequest = validPreviewRequest();
  const preview = analyzeVoyageEncounterCloseoutPreview(previewRequest);
  const base = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest,
    suppliedPreview: preview.preview
  };
  const cases = [
    ["nested scalar", (value) => { value.resultPackage.overallResult.overallResult = "overall-failure"; }],
    ["omitted field", (value) => { delete value.temporaryResetPlan; }],
    ["extra field", (value) => { value.extra = true; }],
    ["reordered root", (value) => { const { schemaVersion, ...rest } = value; return { ...rest, schemaVersion }; }]
  ];
  for (const [, mutate] of cases) {
    const supplied = structuredClone(preview.preview);
    const replaced = mutate(supplied) ?? supplied;
    const result = analyzeVoyageEncounterCloseoutReview({ ...base, suppliedPreview: replaced });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [{
      code: "m10-preview-mismatch",
      path: "suppliedPreview",
      message: "Supplied preview differs from regenerated preview.",
      severity: "error"
    }]);
  }
  const sessionMismatch = analyzeVoyageEncounterCloseoutReview({ ...base, sessionId: "other-session" });
  assert.deepEqual(sessionMismatch.errors, [{
    code: "m10-session-identity-mismatch",
    path: "sessionId",
    message: "Session identity is not bound.",
    severity: "error"
  }]);
});

test("Task 3 application-plan branches are independently captured and later comparison remains deterministic", () => {
  const previewRequest = validPreviewRequest();
  const preview = analyzeVoyageEncounterCloseoutPreview(previewRequest);
  const reviewRequest = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest,
    suppliedPreview: preview.preview
  };
  const review = analyzeVoyageEncounterCloseoutReview(reviewRequest);
  const pristine = structuredClone(review.applicationPlan);
  const pristinePreview = structuredClone(preview.preview);
  review.applicationPlan.persistentProposals[0].payload.reward.title = "mutated";
  assert.deepEqual(review.applicationPlan.expectedPreview, pristine.expectedPreview);
  review.applicationPlan.temporaryResetPlan.momentum.nextValue = 99;
  assert.deepEqual(review.applicationPlan.expectedPreview, pristine.expectedPreview);
  review.applicationPlan.expectedPreview.persistentProposals[0].payload.reward.title = "mutated-again";
  assert.deepEqual(review.applicationPlan.temporaryResetPlan.momentum, { previousValue: 2, nextValue: 99 });
  assert.notDeepEqual(review.applicationPlan.persistentProposals, pristinePreview.persistentProposals);
  assert.deepEqual(preview.preview, pristinePreview);
  const altered = applyVoyageEncounterApprovedCloseout(previewRequest.closeoutSnapshot, previewRequest.shipState, {
    kind: "m10-apply-approved-closeout",
    previewRequest,
    reviewRequest,
    applicationPlan: review.applicationPlan
  });
  assert.equal(altered.ok, false);
  assert.deepEqual(altered.errors, [{
    code: "m10-application-plan-mismatch",
    path: "applicationPlan",
    message: "Supplied plan differs from regenerated plan.",
    severity: "error"
  }]);
  assert.equal(altered.nextCloseoutSnapshot, null);
  assert.equal(altered.nextShipState, null);
  assert.deepEqual(altered.events, []);
});

test("Task 3 compares preview requests before blocked-response handling", () => {
  const previewRequest = validPreviewRequest();
  const preview = analyzeVoyageEncounterCloseoutPreview(previewRequest);
  const alteredPreviewRequest = structuredClone(previewRequest);
  alteredPreviewRequest.expectedEncounterRevision = 8;
  alteredPreviewRequest.closeoutSnapshot.encounterRevision = 8;
  const alteredPreview = analyzeVoyageEncounterCloseoutPreview(alteredPreviewRequest);
  assert.equal(alteredPreview.ok, true);
  const reviewRequest = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest: alteredPreviewRequest,
    suppliedPreview: alteredPreview.preview
  };
  const result = applyVoyageEncounterApprovedCloseout(previewRequest.closeoutSnapshot, previewRequest.shipState, {
    kind: "m10-apply-approved-closeout",
    previewRequest,
    reviewRequest,
    applicationPlan: analyzeVoyageEncounterCloseoutReview(reviewRequest).applicationPlan
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [{
    code: "m10-application-plan-mismatch",
    path: "applicationPlan",
    message: "Supplied plan differs from regenerated plan.",
    severity: "error"
  }]);
  assert.equal(result.nextCloseoutSnapshot, null);
  assert.equal(result.nextShipState, null);
  assert.deepEqual(result.events, []);
  assert.equal(preview.ok, true);
});

test("Task 3 preserves canonical M7 Pressure-Breach Scar provenance and event type", () => {
  const previewRequest = validPreviewRequest();
  previewRequest.closeoutSnapshot.activeHazards = [pressureHazard()];
  previewRequest.closeoutSnapshot.pressureSystems[0].value = 2;
  const preview = analyzeVoyageEncounterCloseoutPreview(previewRequest);
  assert.equal(preview.ok, true, JSON.stringify(preview.errors));
  const m7Proposal = preview.preview.persistentProposals.find((proposal) => proposal.kind === "void-scar-create" && proposal.sourceKind === "m7-pressure-breach");
  assert.ok(m7Proposal);
  const reviewRequest = {
    kind: "m10-closeout-review",
    sessionId: "session-1",
    gmUserId: "gm-1",
    confirmed: true,
    previewRequest,
    suppliedPreview: preview.preview
  };
  const review = analyzeVoyageEncounterCloseoutReview(reviewRequest);
  const applied = applyVoyageEncounterApprovedCloseout(previewRequest.closeoutSnapshot, previewRequest.shipState, {
    kind: "m10-apply-approved-closeout",
    previewRequest,
    reviewRequest,
    applicationPlan: review.applicationPlan
  });
  assert.equal(applied.ok, true, JSON.stringify(applied.errors));
  const m7Event = applied.events.find((event) => event.type === "voyage.void-scar-created");
  assert.ok(m7Event);
  assert.equal(m7Event.sourceEventType, "voyage.pressure-breach-applied");
  assert.equal(m7Event.sourceEncounterRevision, m7Event.sourceProposal ? applied.events.find((event) => event.type === "voyage.pressure-breach-applied").revision : null);
  assert.deepEqual(m7Event.sourceProposal, m7Proposal.payload.incomingScarProposal);
  assert.equal(applied.events.some((event) => event.type === "voyage.closeout-void-scar-created"), false);
});
