import assert from "node:assert/strict";
import test from "node:test";

import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../../../scripts/voyage/domain/constants.js";
import {
  analyzeVoyageEncounterCloseoutPressureBreach,
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
