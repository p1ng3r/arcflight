import assert from "node:assert/strict";
import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";
import { prepareTravelV2InterStationHelpPendingRecord } from "./travel-v2-inter-station-help-pending-records.js";
import { applyTravelV2InterStationHelpApplicationToSession, prepareTravelV2InterStationHelpApplicationReview, prepareTravelV2InterStationHelpCheckAdjustment } from "./travel-v2-inter-station-help-application.js";

const snap = (v) => JSON.stringify(v);
function fixture() { return { status: "active", currentRoundIndex: 0, event: { baseDC: 20, rounds: [{ roundNumber: 1, activeStations: ["helm", "engineer", "watch"], stationOrder: ["helm", "engineer", "watch"], stationPrompts: { helm: { stationName: "Helm" }, engineer: { stationName: "Engineer" }, watch: { stationName: "Watch" } }, stationCards: [{ stationKey: "helm", interStationHelp: [{ id: "open-engine-feed", targetStationKey: "engineer", title: "Open the Engine Feed", publicText: "The Helm creates a stable approach for Engineering.", benefit: { kind: "dcReduction", magnitude: 2, expires: "afterUse" }, criticalSuccessMetadata: { benefitKind: "dcReduction", magnitude: 99 } }] }] }] }, roundResults: [{ stationResults: { helm: "success", engineer: null, watch: null }, stationOrderCommitments: { helm: { committed: true }, engineer: { committed: true }, watch: { committed: true } } }] }; }
function usedSession(overrides = {}) { const session = fixture(); const action = prepareTravelV2InterStationHelpActions(session, { includeUnavailable: true }).helpActions[0]; const pending = prepareTravelV2InterStationHelpPendingRecord(session, action, { result: "success", roundIndex: 0, sourceStationKey: "helm", targetStationKey: "engineer", actionId: "open-engine-feed" }).record; return { ...session, ...overrides, travelV2PendingStationBenefits: [{ ...pending, queueKey: pending.pendingHelpKey, status: "used", used: true, consumed: true, applied: false }] }; }
export default async function runTravelV2InterStationHelpApplicationSmokeChecks() {
  const checked = [];
  const actions = prepareTravelV2InterStationHelpActions(fixture());
  assert.equal(actions.helpActions[0].benefitKind, "dcReduction");
  assert.equal(actions.helpActions[0].magnitude, 2);
  assert.equal(actions.helpActions[0].expires, "afterUse");
  assert.equal(actions.helpActions[0].criticalSuccessMetadata.magnitude, 99);
  checked.push("authored dcReduction metadata normalizes while critical metadata remains separate");
  const session = usedSession();
  const queueKey = session.travelV2PendingStationBenefits[0].queueKey;
  const before = snap(session);
  for (const options of [{ canApply: false, applyRequested: true }, { canApply: true }, { canApply: true, confirm: true }, { canUse: true, useRequested: true }]) {
    const blocked = applyTravelV2InterStationHelpApplicationToSession(session, { queueKey }, options);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.shouldAdoptSession, false);
    assert.equal(snap(session), before);
  }
  checked.push("application requires explicit GM apply intent and never mutates blocked source session");
  for (const status of ["pending", "dismissed", "expired", "blocked"]) {
    const blockedSession = usedSession();
    Object.assign(blockedSession.travelV2PendingStationBenefits[0], { status, used: status === "pending" ? false : true, consumed: status === "pending" ? false : true });
    assert.equal(applyTravelV2InterStationHelpApplicationToSession(blockedSession, { queueKey }, { canApply: true, applyRequested: true }).ok, false);
  }
  checked.push("invalid lifecycle states block");
  for (const patch of [{ currentRoundIndex: 1 }, { currentRoundIndex: "" }]) assert.equal(applyTravelV2InterStationHelpApplicationToSession(usedSession(patch), { queueKey }, { canApply: true, applyRequested: true }).ok, false);
  for (const result of ["success", "failure", "criticalSuccess", "criticalFailure", "skipped"]) { const s = usedSession(); s.roundResults[0].stationResults.engineer = result; assert.equal(applyTravelV2InterStationHelpApplicationToSession(s, { queueKey }, { canApply: true, applyRequested: true }).ok, false); }
  for (const result of [null, "failure", "criticalFailure"]) { const s = usedSession(); s.roundResults[0].stationResults.helm = result; assert.equal(applyTravelV2InterStationHelpApplicationToSession(s, { queueKey }, { canApply: true, applyRequested: true }).ok, false); }
  checked.push("canonical timing, source success, unresolved target, and current round are enforced");
  for (const tamper of [{ benefitKind: "automaticSuccess" }, { magnitude: 20 }, { expires: "endOfRound" }, { magnitude: 0 }, { magnitude: 1.5 }]) { const s = usedSession(); Object.assign(s.travelV2PendingStationBenefits[0], tamper); assert.equal(applyTravelV2InterStationHelpApplicationToSession(s, { queueKey }, { canApply: true, applyRequested: true }).ok, false); }
  checked.push("queue tampering and unsupported/malformed benefits block");
  const review = prepareTravelV2InterStationHelpApplicationReview(session, { queueKey }, { canApply: true });
  assert.equal(review.ok, true); assert.equal(review.baseDc, 20); assert.equal(review.effectiveDc, 18); assert.equal(review.applyAvailable, true);
  const applied = applyTravelV2InterStationHelpApplicationToSession(session, { queueKey }, { canApply: true, applyRequested: true, now: "2026-07-15T00:00:00.000Z" });
  assert.equal(applied.ok, true); assert.equal(applied.shouldAdoptSession, true); assert.equal(snap(session), before); assert.notEqual(applied.nextSession, session);
  assert.equal(applied.nextSession.travelV2InterStationHelpApplications.records.length, 1); assert.equal(applied.nextSession.travelV2PendingStationBenefits[0].applied, true); assert.equal(applied.nextSession.travelV2PendingStationBenefits[0].status, "used"); assert.equal(applied.nextSession.travelV2PendingStationBenefits[0].consumed, true); assert.equal(applied.nextSession.roundResults[0].stationResults.engineer, null); assert.equal(applied.nextSession.event.baseDC, 20);
  checked.push("successful application creates one session-local application record without rolling or rewriting base DC");
  const duplicate = applyTravelV2InterStationHelpApplicationToSession(applied.nextSession, { queueKey }, { canApply: true, applyRequested: true });
  assert.equal(duplicate.ok, false); assert.equal(duplicate.shouldAdoptSession, false); assert.equal(snap(duplicate.nextSession), snap(applied.nextSession));
  checked.push("duplicate application is non-adopting and preserves complete session");
  const adjustment = prepareTravelV2InterStationHelpCheckAdjustment(applied.nextSession, { roundIndex: 0, stationKey: "engineer" });
  assert.equal(adjustment.baseDc, 20); assert.equal(adjustment.dcReduction, 2); assert.equal(adjustment.effectiveDc, 18); assert.equal(adjustment.hasAdjustment, true);
  const other = prepareTravelV2InterStationHelpCheckAdjustment(applied.nextSession, { roundIndex: 0, stationKey: "watch" });
  assert.equal(other.hasAdjustment, false); assert.equal(other.effectiveDc, 20);
  const multi = JSON.parse(snap(applied.nextSession));
  multi.travelV2InterStationHelpApplications.records.push({ ...multi.travelV2InterStationHelpApplications.records[0], applicationKey: "inter-station-help-application:second", queueKey: "second", magnitude: 50 });
  const multiAdj = prepareTravelV2InterStationHelpCheckAdjustment(multi, { roundIndex: 0, stationKey: "engineer" });
  assert.equal(multiAdj.effectiveDc, 18);
  checked.push("effective DC uses applied reductions, ignores unrelated stations and duplicate/malformed applications");
  const critical = usedSession(); critical.roundResults[0].stationResults.helm = "criticalSuccess"; const crit = applyTravelV2InterStationHelpApplicationToSession(critical, { queueKey }, { canApply: true, applyRequested: true }); assert.equal(prepareTravelV2InterStationHelpCheckAdjustment(crit.nextSession, { roundIndex: 0, stationKey: "engineer" }).dcReduction, 2); assert.equal(crit.nextSession.roundResults[0].stationResults.engineer, null);
  checked.push("critical success applies only the normal base reduction");
  console.log(`travel-v2-inter-station-help-application smoke passed (${checked.length} groups)`);
  return { checked };
}
if (import.meta.url === `file://${process.argv[1]}`) await runTravelV2InterStationHelpApplicationSmokeChecks();
