import assert from "node:assert/strict";
import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";
import { prepareTravelV2InterStationHelpPendingRecord } from "./travel-v2-inter-station-help-pending-records.js";
import { prepareTravelV2PendingStationBenefitPlayerState } from "./travel-v2-pending-station-benefit-queue.js";
import { applyTravelV2InterStationHelpApplicationToSession, prepareTravelV2InterStationHelpCheckAdjustment } from "./travel-v2-inter-station-help-application.js";

function fixture(criticalSuccessMetadata) {
  const helpAction = {
    id: "open-engine-feed",
    targetStationKey: "engineer",
    title: "Open the Engine Feed",
    publicText: "The Navigator creates a stable approach for Engineering.",
    benefit: { kind: "dcReduction", magnitude: 2, expires: "afterUse" },
    ...(criticalSuccessMetadata ? { criticalSuccessMetadata } : {})
  };
  return {
    status: "active",
    currentRoundIndex: 0,
    event: {
      key: "slice-07-source-identity",
      name: "Slice 07 Source Identity",
      baseDC: 20,
      rounds: [{
        roundNumber: 1,
        activeStations: ["navigator", "engineer"],
        stationOrder: ["navigator", "engineer"],
        stationPrompts: {
          navigator: { stationName: "Navigator" },
          engineer: { stationName: "Engineer", dcModifier: 1 }
        },
        stationCards: [
          { stationKey: "navigator", interStationHelp: [helpAction] },
          { stationKey: "engineer", stationName: "Engineer", skillApproaches: [] }
        ]
      }]
    },
    roundResults: [{
      roundIndex: 0,
      selectedStationSkills: {},
      stationActions: {},
      stationResults: { navigator: "criticalSuccess", engineer: null },
      stationOrderCommitments: { navigator: { committed: true }, engineer: { committed: true } }
    }],
    travelV2Hazards: { records: [] },
    stationAssignments: {}
  };
}

function usedCriticalSession(criticalSuccessMetadata) {
  const session = fixture(criticalSuccessMetadata);
  const action = prepareTravelV2InterStationHelpActions(session, { includeUnavailable: true }).helpActions.find((row) => row.actionId === "open-engine-feed");
  const pending = prepareTravelV2InterStationHelpPendingRecord(session, action, {
    result: "criticalSuccess",
    roundIndex: 0,
    sourceStationKey: "navigator",
    targetStationKey: "engineer",
    actionId: "open-engine-feed"
  }).record;
  return {
    ...session,
    travelV2PendingStationBenefits: [{
      ...pending,
      queueKey: pending.pendingHelpKey,
      status: "used",
      used: true,
      consumed: true,
      applied: false
    }]
  };
}

function apply(session) {
  const queueKey = session.travelV2PendingStationBenefits[0].queueKey;
  return applyTravelV2InterStationHelpApplicationToSession(session, { queueKey }, {
    canApply: true,
    applyRequested: true,
    now: "2026-07-15T00:00:00.000Z"
  });
}

function assertCriticalBaseFallback(criticalSuccessMetadata, label) {
  const result = apply(usedCriticalSession(criticalSuccessMetadata));
  assert.equal(result.ok, true, label);
  assert.equal(result.record.criticalSuccess, true, label);
  assert.equal(result.record.strengthened, false, label);
  assert.equal(result.record.strengtheningMode, null, label);
  assert.equal(result.record.effectSource, "base", label);
  assert.equal(result.record.magnitude, 2, label);
  assert.equal(result.record.effectiveMagnitude, 2, label);
  assert.equal(prepareTravelV2InterStationHelpCheckAdjustment(result.nextSession, { roundIndex: 0, stationKey: "engineer" }).dcReduction, 2, label);

  const row = prepareTravelV2PendingStationBenefitPlayerState({ session: result.nextSession }, { user: { isGM: false } }).rows[0];
  assert.equal(row.appliedMagnitude, 2, label);
  assert.equal(row.appliedStrengthened, false, label);
  assert.equal(row.applicationStatusLabel, "Effect applied: DC −2", label);

  const tampered = JSON.parse(JSON.stringify(result.nextSession));
  tampered.travelV2InterStationHelpApplications.records[0].criticalSuccess = false;
  assert.equal(prepareTravelV2InterStationHelpCheckAdjustment(tampered, { roundIndex: 0, stationKey: "engineer" }).dcReduction, 0, `${label}-tampered-mechanics`);
  const tamperedRow = prepareTravelV2PendingStationBenefitPlayerState({ session: tampered }, { user: { isGM: false } }).rows[0];
  assert.equal(tamperedRow.appliedMagnitude, null, `${label}-tampered-history`);
  assert.equal(tamperedRow.applicationStatusLabel, "Effect applied", `${label}-tampered-history`);
}

assertCriticalBaseFallback({ strengthening: "automaticSuccess", benefitKind: "automaticSuccess", magnitude: 4 }, "unsupported-mode");
assertCriticalBaseFallback({ strengthening: "replaceMagnitude", benefitKind: "dcReduction", magnitude: 2 }, "equal-magnitude");
assertCriticalBaseFallback({ strengthening: "replaceMagnitude", benefitKind: "dcReduction", magnitude: 1 }, "lower-magnitude");
assertCriticalBaseFallback(null, "missing-metadata");

const strengthened = apply(usedCriticalSession({ strengthening: "replaceMagnitude", benefitKind: "dcReduction", magnitude: 4 }));
assert.equal(strengthened.ok, true);
assert.equal(strengthened.record.criticalSuccess, true);
assert.equal(strengthened.record.strengthened, true);
assert.equal(strengthened.record.effectSource, "criticalSuccess");
assert.equal(prepareTravelV2InterStationHelpCheckAdjustment(strengthened.nextSession, { roundIndex: 0, stationKey: "engineer" }).dcReduction, 4);

console.log("travel-v2-inter-station-help-source-identity smoke passed (5 groups)");
