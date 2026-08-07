import assert from "node:assert/strict";
import test from "node:test";

import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../../../scripts/voyage/domain/constants.js";
import {
  analyzeVoyageEncounterCloseoutPressureBreach,
  analyzeVoyageEncounterCloseoutPreview,
  analyzeVoyageEncounterHazardCloseout,
  captureVoyageEncounterCloseoutSnapshot,
  validateVoyageEncounterCloseoutSnapshot
} from "../../../scripts/voyage/domain/closeout.js";

const ANALYSIS_KEYS = [
  "ok", "readyForHazardCloseout", "eventId", "sessionId", "definitionSnapshotId", "shipId",
  "expectedEncounterRevision", "hazardCloseoutResults", "pressureBreachResults",
  "ordinaryScarProposals", "postHazardPressureSystems", "hazardRemovalPlan", "errors", "warnings"
];
const BREACH_KEYS = [
  "ok", "breachRequired", "previousEncounterRevision", "encounterRevision", "nextPressureSystems",
  "nextActiveHazards", "breach", "hazard", "ordinaryScarProposal", "pressureReset", "event", "errors", "warnings"
];

function ignoredPressure(consequenceId, pressureSystemId = "crew-morale", delta = 1) {
  return { consequenceId, kind: "pressure-change", pressureSystemId, delta, persistentProposal: null };
}

function ignoredPersistent(consequenceId = "persistent-1") {
  return {
    consequenceId,
    kind: "persistent-consequence",
    pressureSystemId: null,
    delta: null,
    persistentProposal: {
      proposalId: `${consequenceId}-proposal`,
      kind: "ship-damage",
      title: "Hull damage",
      description: "The hull carries a lasting wound.",
      targetKind: "ship",
      targetId: "ship-1"
    }
  };
}

function hazard({
  hazardId = "hazard-1",
  consequence = ignoredPressure("consequence-1"),
  pressureSystemId = "crew-morale",
  failurePressureSystemId = pressureSystemId,
  category = "system"
} = {}) {
  return {
    hazardId,
    encounterId: "event-1",
    category,
    status: "active",
    name: `${hazardId} name`,
    currentEffect: { effectId: `${hazardId}-effect`, description: "A tactical problem." },
    activationTiming: { kind: "event-closeout", stationId: null, resultId: null },
    removalMethod: { methodId: "address-hazard" },
    ignoredConsequence: consequence,
    visibility: "public",
    sourceKind: "authored-hazard",
    createdStageId: "stage-final",
    createdRoundNumber: 3,
    createdSequence: 1,
    escalation: {
      mode: "none",
      currentStageId: null,
      stages: [],
      countdown: null,
      maximumEscalationReached: false,
      escalationConsequence: null
    },
    collisionPolicy: "trigger-existing-consequence",
    duration: { mode: "none", remaining: null, initial: null, decrementTiming: null },
    failurePressureSystemId,
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { consequence: { consequenceId: `${hazardId}-collision`, description: "A collision consequence." } } },
    pressureSystemId: category === "system" ? pressureSystemId : null,
    eventAreaId: category === "event" ? "event-area-1" : null,
    pressureBreachId: null,
    stationId: null,
    actionId: null,
    pressureEffectId: null,
    sourceIntentId: null,
    activationSource: null,
    branch: "no-roll",
    sourceTiming: "gm-confirmed",
    sourceVisibility: "public"
  };
}

function pressureSystems(overrides = {}) {
  return VOYAGE_PRESSURE_SYSTEM_IDS.map((pressureSystemId) => ({
    pressureSystemId,
    value: overrides[pressureSystemId]?.value ?? 0,
    capacity: overrides[pressureSystemId]?.capacity ?? 2
  }));
}

function snapshot({ activeHazards = [hazard()], systems = pressureSystems(), lifecycleState = "active" } = {}) {
  return {
    schemaVersion: 1,
    eventId: "event-1",
    sessionId: "session-1",
    definitionSnapshotId: "definition-1",
    shipId: "ship-1",
    encounterRevision: 7,
    shipRevision: 4,
    lifecycleState,
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
    pressureSystems: systems,
    activeHazards,
    pendingStationBenefitIds: ["benefit-1"],
    unconsumedRiskBidBenefitIds: ["risk-benefit-1"],
    temporaryFocusPenaltyIds: ["focus-penalty-1"],
    roundOrderRestrictions: [
      { restrictionId: "temporary-order", persistence: "temporary" },
      { restrictionId: "persistent-order", persistence: "persistent" }
    ],
    hazardSuppressions: activeHazards.length > 0 ? [{ suppressionId: "suppression-1", hazardId: activeHazards[0].hazardId }] : [],
    temporaryConsequenceIds: ["temporary-consequence-1"]
  };
}

function request(closeoutSnapshot, overrides = {}) {
  return {
    kind: "m10-hazard-closeout",
    sessionId: "session-1",
    expectedEncounterRevision: 7,
    closeoutSnapshot,
    ...overrides
  };
}

function breachRequest({ systems = pressureSystems(), activeHazards = [], effect } = {}) {
  const pressureEffect = effect ?? {
    pressureEffectId: "effect-1",
    encounterId: "event-1",
    stageId: "stage-final",
    roundNumber: 3,
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
  return {
    kind: "m10-closeout-pressure-breach",
    expectedEncounterRevision: 8,
    closeoutContext: {
      eventId: "event-1",
      sessionId: "session-1",
      stageId: "stage-final",
      roundNumber: 3,
      phase: "cleanup-advance"
    },
    pressureSystems: systems,
    activeHazards,
    pressureEffect
  };
}

function previewRequest(overrides = {}) {
  const closeoutSnapshot = snapshot({ activeHazards: [] });
  const eventDefinition = {
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
    eventDefinition,
    rewardAllocation: {
      eventId: "event-1",
      sessionId: "session-1",
      rewardSelections: [{ operation: "add-reward", rewardId: "reward-1", enhancementId: null }]
    },
    negativeSelection: null,
    closeoutScarDefinitions: [],
    breakdownDefinitions: [],
    emergencyResponseEvidence: [],
    ...overrides
  };
}

function assertMalformedSnapshotBoundaries(closeoutSnapshot, activeHazardsPath) {
  const snapshotError = {
    code: "m10-invalid-closeout-snapshot",
    path: activeHazardsPath,
    message: "Closeout snapshot is invalid.",
    severity: "error"
  };
  let validation;
  assert.doesNotThrow(() => {
    validation = validateVoyageEncounterCloseoutSnapshot(closeoutSnapshot);
  });
  assert.deepEqual(validation, {
    valid: false,
    errors: [snapshotError],
    warnings: []
  });

  let captured;
  assert.doesNotThrow(() => {
    captured = captureVoyageEncounterCloseoutSnapshot(closeoutSnapshot);
  });
  assert.deepEqual(captured, {
    ok: false,
    closeoutSnapshot: null,
    errors: [snapshotError],
    warnings: []
  });

  let analysis;
  assert.doesNotThrow(() => {
    analysis = analyzeVoyageEncounterHazardCloseout(request(closeoutSnapshot));
  });
  assert.deepEqual(analysis, {
    ok: false,
    readyForHazardCloseout: false,
    eventId: null,
    sessionId: null,
    definitionSnapshotId: null,
    shipId: null,
    expectedEncounterRevision: null,
    hazardCloseoutResults: [],
    pressureBreachResults: [],
    ordinaryScarProposals: [],
    postHazardPressureSystems: [],
    hazardRemovalPlan: [],
    errors: [
      {
        code: "m10-invalid-closeout-snapshot",
        path: "closeoutSnapshot",
        message: "Closeout snapshot is invalid.",
        severity: "error"
      },
      snapshotError
    ],
    warnings: []
  });
}

function assertInvalidAnalysisRequestRoot(root) {
  let result;
  assert.doesNotThrow(() => {
    result = analyzeVoyageEncounterHazardCloseout(root);
  });
  assert.deepEqual(result, {
    ok: false,
    readyForHazardCloseout: false,
    eventId: null,
    sessionId: null,
    definitionSnapshotId: null,
    shipId: null,
    expectedEncounterRevision: null,
    hazardCloseoutResults: [],
    pressureBreachResults: [],
    ordinaryScarProposals: [],
    postHazardPressureSystems: [],
    hazardRemovalPlan: [],
    errors: [{
      code: "m10-invalid-request-shape",
      path: "request",
      message: "Request shape, order, or root values are invalid.",
      severity: "error"
    }],
    warnings: []
  });
}

test("captures and validates the exact complete closeout snapshot with isolated data", () => {
  const source = snapshot();
  const validation = validateVoyageEncounterCloseoutSnapshot(source);
  const captured = captureVoyageEncounterCloseoutSnapshot(source);

  assert.deepEqual(Object.keys(validation), ["valid", "errors", "warnings"]);
  assert.deepEqual(validation, { valid: true, errors: [], warnings: [] });
  assert.deepEqual(Object.keys(captured), ["ok", "closeoutSnapshot", "errors", "warnings"]);
  assert.equal(captured.ok, true);
  assert.deepEqual(Object.keys(captured.closeoutSnapshot), Object.keys(source));
  captured.closeoutSnapshot.activeHazards[0].name = "tampered";
  captured.closeoutSnapshot.pressureSystems[0].value = 2;
  assert.equal(source.activeHazards[0].name, "hazard-1 name");
  assert.equal(source.pressureSystems[0].value, 0);
});

test("rejects malformed, hostile, cyclic, and wrong-order snapshots with deterministic safe diagnostics", () => {
  const malformed = snapshot();
  malformed.phase = "consequences";
  const invalid = captureVoyageEncounterCloseoutSnapshot(malformed);
  assert.deepEqual(invalid, {
    ok: false,
    closeoutSnapshot: null,
    errors: [{ code: "m10-invalid-closeout-snapshot", path: "closeoutSnapshot", message: "Closeout snapshot is invalid.", severity: "error" }],
    warnings: []
  });

  const getter = snapshot();
  Object.defineProperty(getter, "eventId", { enumerable: true, get() { throw new Error("secret"); } });
  const hostile = validateVoyageEncounterCloseoutSnapshot(getter);
  assert.deepEqual(hostile, {
    valid: false,
    errors: [{ code: "m10-hostile-data-capture-failed", path: "$", message: "M10 data could not be captured safely.", severity: "error" }],
    warnings: []
  });

  const cyclic = snapshot();
  cyclic.activeHazards[0].metadata.self = cyclic.activeHazards[0].metadata;
  assert.equal(captureVoyageEncounterCloseoutSnapshot(cyclic).errors[0].code, "m10-hostile-data-capture-failed");

  const reordered = snapshot();
  const original = reordered.pressureSystems[0];
  reordered.pressureSystems[0] = { value: original.value, pressureSystemId: original.pressureSystemId, capacity: original.capacity };
  assert.equal(validateVoyageEncounterCloseoutSnapshot(reordered).valid, false);
});

test("fails safely at every public boundary for a null activeHazards collection", () => {
  const malformed = snapshot();
  malformed.activeHazards = null;
  malformed.hazardSuppressions = [];
  assertMalformedSnapshotBoundaries(malformed, "closeoutSnapshot.activeHazards");
});

test("fails safely at every public boundary for a null active Hazard entry", () => {
  const malformed = snapshot();
  malformed.activeHazards = [null];
  malformed.hazardSuppressions = [];
  assertMalformedSnapshotBoundaries(malformed, "closeoutSnapshot.activeHazards[0]");
});

test("rejects a null closeout analysis request root without throwing", () => {
  assertInvalidAnalysisRequestRoot(null);
});

test("rejects a primitive closeout analysis request root without throwing", () => {
  assertInvalidAnalysisRequestRoot(false);
});

test("rejects an array closeout analysis request root without throwing", () => {
  assertInvalidAnalysisRequestRoot([]);
});

test("accepts acyclic shared references while isolating each captured occurrence", () => {
  const source = snapshot();
  const shared = { effectId: "shared-effect", description: "Shared descriptor." };
  source.activeHazards[0].currentEffect = shared;
  source.activeHazards[0].metadata.shared = shared;
  const captured = captureVoyageEncounterCloseoutSnapshot(source);
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));
  assert.notStrictEqual(captured.closeoutSnapshot.activeHazards[0].currentEffect, captured.closeoutSnapshot.activeHazards[0].metadata.shared);
});

test("analyzes ordered persistent and non-breaching Pressure Hazard consequences without a final reset", () => {
  const source = snapshot({
    activeHazards: [
      hazard({ consequence: ignoredPersistent("persistent-1") }),
      hazard({ hazardId: "hazard-2", consequence: ignoredPressure("consequence-2", "arkengine", 1), pressureSystemId: "arkengine" })
    ]
  });
  source.hazardSuppressions = [];
  const result = analyzeVoyageEncounterHazardCloseout(request(source));

  assert.deepEqual(Object.keys(result), ANALYSIS_KEYS);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.readyForHazardCloseout, true);
  assert.deepEqual(result.hazardRemovalPlan, [
    { hazardId: "hazard-1", previousStatus: "active", disposition: "removed" },
    { hazardId: "hazard-2", previousStatus: "active", disposition: "removed" }
  ]);
  assert.equal(result.pressureBreachResults.length, 1);
  assert.equal(result.pressureBreachResults[0].breachRequired, false);
  assert.equal(result.postHazardPressureSystems.find(({ pressureSystemId }) => pressureSystemId === "arkengine").value, 1);
  assert.equal(result.postHazardPressureSystems.find(({ pressureSystemId }) => pressureSystemId === "crew-morale").value, 0);
  assert.equal(result.hazardCloseoutResults[0].pressureEffect, null);
  assert.equal(result.hazardCloseoutResults[1].pressureEffect.sourceKind, "hazard-closeout");
  assert.equal(result.hazardCloseoutResults[1].pressureEffect.encounterId, "event-1");
  assert.equal(result.hazardCloseoutResults[1].pressureEffect.pressureEffectId, 'arcflight-pressure-effect:["hazard-closeout","event-1","session-1","stage-final",3,"hazard-2","consequence-2",2,"arkengine"]');
  assert.deepEqual(result.ordinaryScarProposals, []);
});

test("creates exactly one canonical Breach and M7 Scar proposal for one large closeout delta", () => {
  const source = snapshot({
    systems: pressureSystems({ "crew-morale": { value: 2, capacity: 2 } }),
    activeHazards: [hazard({ consequence: ignoredPressure("consequence-overflow", "crew-morale", 8) })]
  });
  const result = analyzeVoyageEncounterHazardCloseout(request(source));

  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.pressureBreachResults.length, 1);
  const breach = result.pressureBreachResults[0];
  assert.equal(breach.breachRequired, true);
  assert.equal(breach.breach.attemptedDelta, 8);
  assert.equal(breach.breach.overflowDelta, 8);
  assert.equal(breach.pressureReset.previousValue, 2);
  assert.equal(breach.pressureReset.resetValue, 0);
  assert.equal(breach.ordinaryScarProposal.encounterId, "event-1");
  assert.equal(breach.ordinaryScarProposal.sourceKind, "pressure-breach");
  assert.deepEqual(result.ordinaryScarProposals, [breach.ordinaryScarProposal]);
  assert.equal(result.postHazardPressureSystems[0].value, 0);
  assert.equal(result.hazardCloseoutResults[0].pressureEffect.encounterId, "event-1");
});

test("the narrow closeout Breach boundary preserves canonical event shape, collision policy, and failure sentinels", () => {
  const existing = hazard({
    hazardId: "existing-system-hazard",
    consequence: ignoredPersistent("existing-persistent"),
    pressureSystemId: "crew-morale"
  });
  const success = analyzeVoyageEncounterCloseoutPressureBreach(breachRequest({
    systems: pressureSystems({ "crew-morale": { value: 2, capacity: 2 } }),
    activeHazards: [existing]
  }));
  assert.deepEqual(Object.keys(success), BREACH_KEYS);
  assert.equal(success.ok, true, JSON.stringify(success.errors));
  assert.equal(success.breachRequired, true);
  assert.equal(success.nextActiveHazards.length, 1);
  assert.equal(success.event.type, "voyage.pressure-breach-applied");
  assert.deepEqual(Object.keys(success.event), [
    "type", "encounterId", "lifecycleState", "stageId", "roundNumber", "phase",
    "pressureEffectCount", "appliedEffectCount", "breach", "hazard", "collisionOutcome",
    "voidScarProposal", "pressureReset", "effects", "previousPressureSystems", "pressureSystems",
    "previousRevision", "revision"
  ]);
  assert.equal(success.event.collisionOutcome.kind, "hazard-consequence-triggered");
  assert.equal(success.previousEncounterRevision, 8);
  assert.equal(success.encounterRevision, 9);

  const failure = analyzeVoyageEncounterCloseoutPressureBreach({ kind: "bad" });
  assert.deepEqual(Object.keys(failure), BREACH_KEYS);
  assert.equal(failure.ok, false);
  assert.equal(failure.previousEncounterRevision, null);
  assert.deepEqual(failure.nextPressureSystems, []);
  assert.deepEqual(failure.warnings, []);
});

test("fails closed for unsupported or duplicate closeout consequences, stale authority, and caller plans", () => {
  const unsupported = snapshot({ activeHazards: [hazard({ consequence: { consequenceId: "generic", description: "Not closed." } })] });
  let result = analyzeVoyageEncounterHazardCloseout(request(unsupported));
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m10-unsupported-hazard-closeout-consequence");

  const duplicate = snapshot({
    activeHazards: [
      hazard({ consequence: ignoredPressure("same", "crew-morale", 1) }),
      hazard({ hazardId: "hazard-2", consequence: ignoredPressure("same", "arkengine", 1), pressureSystemId: "arkengine" })
    ]
  });
  duplicate.hazardSuppressions = [];
  result = analyzeVoyageEncounterHazardCloseout(request(duplicate));
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m10-duplicate-closeout-consequence-id");

  result = analyzeVoyageEncounterHazardCloseout(request(snapshot(), { expectedEncounterRevision: 6 }));
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m10-encounter-revision-mismatch");

  result = analyzeVoyageEncounterHazardCloseout(request(snapshot(), { preview: null }));
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m10-caller-authority-rejected");
  assert.deepEqual(result.hazardCloseoutResults, []);
});

test("rejects every prohibited authority key and value with the exact failure envelope", () => {
  const prohibitedKeys = [
    "overallResult",
    "rewardAnalysis",
    "negativeAnalysis",
    "resultPackage",
    "hazardPlan",
    "pressurePlan",
    "breachPlan",
    "capacityAnalysis",
    "capacityExhaustion",
    "breakdownPlan",
    "outcomeProposal",
    "persistentProposals",
    "temporaryResetPlan",
    "preview",
    "previewId",
    "approved",
    "gmApproved",
    "approvalToken",
    "applicationId",
    "applicationPlan",
    "nextEncounterState",
    "nextCloseoutSnapshot",
    "nextShipState",
    "events",
    "patch",
    "ledgerEntry",
    "idempotencyStatus",
    "receipt",
    "sessionCommitReceipt",
    "requestId",
    "timestamp"
  ];
  const valueFactories = [
    ["null", () => null],
    ["false", () => false],
    ["zero", () => 0],
    ["empty-string", () => ""],
    ["empty-array", () => []],
    ["empty-object", () => ({})]
  ];

  for (const key of prohibitedKeys) {
    for (const [label, makeValue] of valueFactories) {
      const result = analyzeVoyageEncounterHazardCloseout(
        request(snapshot(), { [key]: makeValue() })
      );
      assert.equal(result.ok, false, `${key}=${label}`);
      assert.equal(result.readyForHazardCloseout, false, `${key}=${label}`);
      assert.deepEqual(
        result,
        {
          ok: false,
          readyForHazardCloseout: false,
          eventId: null,
          sessionId: null,
          definitionSnapshotId: null,
          shipId: null,
          expectedEncounterRevision: null,
          hazardCloseoutResults: [],
          pressureBreachResults: [],
          ordinaryScarProposals: [],
          postHazardPressureSystems: [],
          hazardRemovalPlan: [],
          errors: [{
            code: "m10-caller-authority-rejected",
            path: `request.${key}`,
            message: "Caller supplied calculated, application, persistence, or runtime authority.",
            severity: "error"
          }],
          warnings: []
        },
        `${key}=${label}`
      );
    }
  }
});

test("analysis is deterministic and result structures do not alias inputs or later calls", () => {
  const source = snapshot({
    systems: pressureSystems({ "crew-morale": { value: 2, capacity: 2 } }),
    activeHazards: [hazard({ consequence: ignoredPressure("consequence-overflow", "crew-morale", 3) })]
  });
  const first = analyzeVoyageEncounterHazardCloseout(request(source));
  const second = analyzeVoyageEncounterHazardCloseout(request(source));
  assert.deepEqual(first, second);
  first.postHazardPressureSystems[0].value = 99;
  first.ordinaryScarProposals[0].name = "tampered";
  assert.equal(source.pressureSystems[0].value, 2);
  assert.equal(analyzeVoyageEncounterHazardCloseout(request(source)).postHazardPressureSystems[0].value, 0);
  assert.notStrictEqual(first.ordinaryScarProposals, second.ordinaryScarProposals);
});

test("composes a deterministic Task 2 preview from regenerated M8 and Task 1 results", () => {
  const result = analyzeVoyageEncounterCloseoutPreview(previewRequest());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.readyForGmReview, true);
  assert.deepEqual(Object.keys(result.preview), [
    "schemaVersion", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId",
    "expectedEncounterRevision", "expectedShipRevision", "overallResult", "successfulRoundCount",
    "failedRoundCount", "resultPackage", "hazardCloseoutResults", "pressureBreachResults",
    "ordinaryScarResults", "breakdownResults", "emergencyResponseOutcomes", "persistentProposals",
    "temporaryResetPlan", "blockedByEmergencyResponse", "requiresGmApproval"
  ]);
  assert.equal(result.preview.overallResult, "overall-success");
  assert.equal(result.preview.persistentProposals.at(-1).kind, "event-history");
  assert.deepEqual(result.warnings, []);
});

test("binds the closeout snapshot ship revision to the captured ship state", () => {
  const validRequest = previewRequest();
  const success = analyzeVoyageEncounterCloseoutPreview(validRequest);
  assert.equal(success.ok, true, JSON.stringify(success.errors));
  assert.equal(success.readyForGmReview, true);

  const staleRequest = previewRequest();
  staleRequest.closeoutSnapshot.shipRevision = 3;
  let failure;
  assert.doesNotThrow(() => {
    failure = analyzeVoyageEncounterCloseoutPreview(staleRequest);
  });
  assert.deepEqual(failure, {
    ok: false,
    readyForGmReview: false,
    closeoutId: null,
    preview: null,
    errors: [{
      code: "m10-ship-revision-mismatch",
      path: "expectedShipRevision",
      message: "Ship revision is stale.",
      severity: "error"
    }],
    warnings: []
  });
  assert.equal(failure.preview, null);
  assert.deepEqual(failure.errors.map((error) => error.code), ["m10-ship-revision-mismatch"]);
});

test("rejects every prohibited Task 2 authority key and value with the exact failure envelope", () => {
  const prohibitedKeys = [
    "overallResult", "rewardAnalysis", "negativeAnalysis", "resultPackage",
    "hazardPlan", "pressurePlan", "breachPlan", "capacityAnalysis",
    "capacityExhaustion", "breakdownPlan", "outcomeProposal",
    "persistentProposals", "temporaryResetPlan", "preview", "previewId",
    "approved", "gmApproved", "approvalToken", "applicationId",
    "applicationPlan", "nextEncounterState", "nextCloseoutSnapshot",
    "nextShipState", "events", "patch", "ledgerEntry", "idempotencyStatus",
    "receipt", "sessionCommitReceipt", "requestId", "timestamp"
  ];
  const valueFactories = [
    ["null", () => null],
    ["false", () => false],
    ["zero", () => 0],
    ["empty-string", () => ""],
    ["empty-array", () => []],
    ["empty-object", () => ({})]
  ];
  for (const key of prohibitedKeys) {
    for (const [label, makeValue] of valueFactories) {
      const result = analyzeVoyageEncounterCloseoutPreview(previewRequest({ [key]: makeValue() }));
      assert.deepEqual(result, {
        ok: false,
        readyForGmReview: false,
        closeoutId: null,
        preview: null,
        errors: [{
          code: "m10-caller-authority-rejected",
          path: `request.${key}`,
          message: "Caller supplied calculated, application, persistence, or runtime authority.",
          severity: "error"
        }],
        warnings: []
      }, `${key}=${label}`);
    }
  }
});

test("returns the exact Task 2 request-shape failure for non-object roots", () => {
  for (const root of [null, false, []]) {
    let result;
    assert.doesNotThrow(() => {
      result = analyzeVoyageEncounterCloseoutPreview(root);
    });
    assert.deepEqual(result, {
      ok: false,
      readyForGmReview: false,
      closeoutId: null,
      preview: null,
      errors: [{
        code: "m10-invalid-request-shape",
        path: "request",
        message: "Request shape, order, or root values are invalid.",
        severity: "error"
      }],
      warnings: []
    });
  }
});

test("regenerates a selected M8 Scar as the exact M10-v2 durable record", () => {
  const requestValue = previewRequest({
    closeoutSnapshot: snapshot({ activeHazards: [] }),
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
      rewards: [],
      enhancements: [],
      misfortuneEnhancements: [
        { misfortuneEnhancementId: "enhancement-1", title: "First", description: "First enhancement.", compatibleMisfortuneIds: ["misfortune-1"], maxApplicationsPerMisfortune: 1 },
        { misfortuneEnhancementId: "enhancement-2", title: "Second", description: "Second enhancement.", compatibleMisfortuneIds: ["misfortune-1"], maxApplicationsPerMisfortune: 1 }
      ],
      misfortunes: [{
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
      }],
      nextSituations: [{ nextSituationId: "next-1", title: "Next", summary: "Continue.", transitionKind: "delay" }]
    },
    rewardAllocation: null,
    negativeSelection: { misfortuneId: "misfortune-1", enhancementIds: ["enhancement-1", "enhancement-2"] },
    closeoutScarDefinitions: [{
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
    }]
  });
  requestValue.closeoutSnapshot.completedRoundHistory.rounds = requestValue.closeoutSnapshot.completedRoundHistory.rounds.map((round) => ({ ...round, roundResult: "critical-round-failure" }));
  const result = analyzeVoyageEncounterCloseoutPreview(requestValue);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.preview.overallResult, "overall-failure");
  assert.equal(result.preview.ordinaryScarResults.length, 1);
  const ordinary = result.preview.ordinaryScarResults[0];
  assert.equal(ordinary.sourceKind, "m8-critical-overall-failure");
  assert.equal(ordinary.disposition, "void-scar");
  assert.deepEqual(Object.keys(ordinary.voidScar), [
    "schemaVersion", "voidScarId", "name", "pressureSystemId", "status", "sourceKind",
    "description", "operationalEffects", "baseRepairCost", "baseRepairTime", "repairDcSource",
    "eligibleRepairChecks", "requiredFacilities", "compatibleFieldRepairTags", "source"
  ]);
  assert.equal(ordinary.voidScar.schemaVersion, 2);
  assert.equal(ordinary.voidScar.sourceKind, "m8-critical-overall-failure");
  assert.deepEqual(Object.keys(ordinary.voidScar.source), ["eventId", "sessionId", "definitionSnapshotId", "misfortuneId", "voidScarDefinitionId"]);
  assert.equal(result.preview.persistentProposals.find((proposal) => proposal.kind === "void-scar-create").payload.incomingScarProposal.source, "m8-critical-overall-failure");
});
