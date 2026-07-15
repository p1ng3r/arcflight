import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import { prepareTravelSceneOverlayState, resolveStationDc } from "./travel-event-runner.js";
import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";
import { prepareTravelV2InterStationHelpPendingRecord } from "./travel-v2-inter-station-help-pending-records.js";
import { prepareTravelV2PendingStationBenefitGmState, prepareTravelV2PendingStationBenefitPlayerState } from "./travel-v2-pending-station-benefit-queue.js";
import { applyTravelV2InterStationHelpApplicationToSession, prepareTravelV2InterStationHelpApplicationReview, prepareTravelV2InterStationHelpCheckAdjustment } from "./travel-v2-inter-station-help-application.js";

const snap = (v) => JSON.stringify(v);
function fixture({ magnitude = 2, action = null, baseDC = 20, engineerCard = {}, currentRoundIndex = 0, hasMagnitude = true } = {}) {
  const benefit = hasMagnitude ? { kind: "dcReduction", magnitude, expires: "afterUse" } : { kind: "dcReduction", expires: "afterUse" };
  const helpAction = action ?? { id: "open-engine-feed", targetStationKey: "engineer", title: "Open the Engine Feed", publicText: "The Navigator creates a stable approach for Engineering.", benefit, criticalSuccessMetadata: { strengthening: "replaceMagnitude", benefitKind: "dcReduction", magnitude: 4, publicText: "Critical success creates a perfectly stable approach.", secret: "scrubbed" } };
  return {
    status: "active",
    currentRoundIndex,
    event: { key: "slice-06", name: "Slice 06", baseDC, rounds: [{ roundNumber: 1, activeStations: ["navigator", "engineer", "watchmaster"], stationOrder: ["navigator", "engineer", "watchmaster"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer", dcModifier: 1, suggestedSkills: ["crafting"] }, watchmaster: { stationName: "Watchmaster" } }, stationCards: [{ stationKey: "navigator", interStationHelp: [helpAction] }, { stationKey: "engineer", stationName: "Engineer", skillApproaches: [{ skill: "crafting", label: "Tune Feed", dc: 22, helpText: "Tune." }, { skill: "arcana", label: "Arcane Bypass", dc: 30, helpText: "Bypass." }], ...engineerCard }] }] },
    roundResults: [{ roundIndex: 0, selectedStationSkills: { engineer: "crafting" }, stationActions: { engineer: { type: "eventApproach", skill: "crafting" } }, stationResults: { navigator: "success", engineer: null, watchmaster: null }, stationOrderCommitments: { navigator: { committed: true }, engineer: { committed: true }, watchmaster: { committed: true } } }],
    travelV2Hazards: { records: [] },
    stationAssignments: { engineer: { actorName: "Engineer Actor", source: "manual" } }
  };
}
function withEngineerHazard(session, modifier = 2) { return { ...session, travelV2Hazards: { records: [{ id: "hazard-engine-feed", name: "Engine Feed Shear", status: "active", revealed: true, effects: [{ type: "dcModifier", stationKey: "engineer", modifier, label: "Feed Shear" }] }] } }; }
function usedSession(options = {}) { const session = fixture(options); const result = options.result ?? "success"; session.roundResults[0].stationResults.navigator = result; const action = prepareTravelV2InterStationHelpActions(session, { includeUnavailable: true }).helpActions.find((row) => row.actionId === "open-engine-feed"); const pending = prepareTravelV2InterStationHelpPendingRecord(session, action, { result, roundIndex: 0, sourceStationKey: "navigator", targetStationKey: "engineer", actionId: "open-engine-feed", criticalSuccessMetadata: { magnitude: 400 } }).record; return { ...session, travelV2PendingStationBenefits: [{ ...pending, queueKey: pending.pendingHelpKey, status: "used", used: true, consumed: true, applied: false }] }; }
function applyValid(session = usedSession()) { return applyTravelV2InterStationHelpApplicationToSession(session, { queueKey: session.travelV2PendingStationBenefits[0].queueKey }, { canApply: true, applyRequested: true, now: "2026-07-15T00:00:00.000Z" }).nextSession; }
function assertNoAdjustment(session, label, stationKey = "engineer") { const adjustment = prepareTravelV2InterStationHelpCheckAdjustment(session, { roundIndex: 0, stationKey }); assert.equal(adjustment.dcReduction, 0, label); assert.equal(adjustment.hasAdjustment, false, label); }

export default async function runTravelV2InterStationHelpApplicationSmokeChecks() {
  const checked = [];
  const actions = prepareTravelV2InterStationHelpActions(fixture());
  assert.equal(actions.helpActions[0].benefitKind, "dcReduction");
  assert.equal(actions.helpActions[0].magnitude, 2);
  assert.equal(actions.helpActions[0].expires, "afterUse");
  assert.equal(actions.helpActions[0].criticalSuccessMetadata.strengthening, "replaceMagnitude");
  assert.equal(actions.helpActions[0].criticalSuccessMetadata.magnitude, 4);
  assert.equal(Object.hasOwn(actions.helpActions[0].criticalSuccessMetadata, "secret"), false);
  checked.push("authored dcReduction and valid critical replaceMagnitude metadata normalize while forbidden nested metadata is scrubbed");

  for (const criticalMagnitude of [null, undefined, "", " ", 0, -1, 1.5, "1.5", "-2", NaN, Infinity, {}, [], [4], ["4"]]) {
    const prepared = prepareTravelV2InterStationHelpActions(fixture({ action: { id: "open-engine-feed", targetStationKey: "engineer", title: "Open the Engine Feed", benefit: { kind: "dcReduction", magnitude: 2, expires: "afterUse" }, criticalSuccessMetadata: { strengthening: "replaceMagnitude", benefitKind: "dcReduction", magnitude: criticalMagnitude } } }));
    assert.equal(Object.hasOwn(prepared.helpActions[0].criticalSuccessMetadata ?? {}, "magnitude"), false, `malformed critical magnitude ${String(criticalMagnitude)} must not normalize`);
  }
  assert.equal(prepareTravelV2InterStationHelpActions(fixture({ action: { id: "open-engine-feed", targetStationKey: "engineer", title: "Open the Engine Feed", benefit: { kind: "dcReduction", magnitude: 2, expires: "afterUse" }, criticalSuccessMetadata: { strengthening: "replaceMagnitude", benefitKind: "dcReduction", magnitude: "4" } } })).helpActions[0].criticalSuccessMetadata.magnitude, 4);
  checked.push("strict critical magnitude parsing rejects malformed values and accepts positive integer strings");

  for (const magnitude of [null, undefined, "", " ", 0, -1, 1.5, "1.5", "-2", NaN, Infinity, {}, [], [2], ["2"]]) {
    const prepared = prepareTravelV2InterStationHelpActions(fixture({ magnitude, hasMagnitude: magnitude !== undefined }));
    assert.equal(Object.hasOwn(prepared.helpActions[0], "magnitude"), false, `malformed magnitude ${String(magnitude)} must not normalize`);
    const s = usedSession({ magnitude, hasMagnitude: magnitude !== undefined });
    assert.equal(applyTravelV2InterStationHelpApplicationToSession(s, { queueKey: s.travelV2PendingStationBenefits[0].queueKey }, { canApply: true, applyRequested: true }).ok, false, `malformed magnitude ${String(magnitude)} must not apply`);
  }
  for (const magnitude of [2, "2"]) assert.equal(prepareTravelV2InterStationHelpActions(fixture({ magnitude })).helpActions[0].magnitude, 2, "strict positive integer magnitudes remain valid");
  checked.push("strict magnitude parsing rejects arrays objects blanks fractional and non-positive values");

  const session = usedSession();
  const queueKey = session.travelV2PendingStationBenefits[0].queueKey;
  const before = snap(session);
  for (const options of [{ canApply: false, applyRequested: true }, { canApply: true }, { canApply: true, confirm: true }, { canUse: true, useRequested: true }]) { const blocked = applyTravelV2InterStationHelpApplicationToSession(session, { queueKey }, options); assert.equal(blocked.ok, false); assert.equal(blocked.shouldAdoptSession, false); assert.equal(snap(session), before); }
  checked.push("application requires explicit GM apply intent and never mutates blocked source session");

  for (const patch of [{ actionId: "open-engine-feed", authoredActionId: "different", reason: "inter-station-help-application-action-id-mismatch" }, { actionId: "", reason: "inter-station-help-application-action-id-required" }, { authoredActionId: "", reason: "inter-station-help-application-authored-action-id-required" }]) { const s = usedSession(); Object.assign(s.travelV2PendingStationBenefits[0], patch); const result = applyTravelV2InterStationHelpApplicationToSession(s, { queueKey }, { canApply: true, applyRequested: true }); assert.equal(result.ok, false); assert.equal(result.blockedReasons.includes(patch.reason), true); }
  checked.push("application requires actionId and authoredActionId to exist and match");

  for (const status of ["pending", "dismissed", "expired", "blocked"]) { const blockedSession = usedSession(); Object.assign(blockedSession.travelV2PendingStationBenefits[0], { status, used: status !== "pending", consumed: status !== "pending" }); assert.equal(applyTravelV2InterStationHelpApplicationToSession(blockedSession, { queueKey }, { canApply: true, applyRequested: true }).ok, false); }
  for (const currentRoundIndex of [1, ""]) { const stale = usedSession(); stale.currentRoundIndex = currentRoundIndex; assert.equal(applyTravelV2InterStationHelpApplicationToSession(stale, { queueKey }, { canApply: true, applyRequested: true }).ok, false); }
  for (const result of ["success", "failure", "criticalSuccess", "criticalFailure", "skipped"]) { const s = usedSession(); s.roundResults[0].stationResults.engineer = result; assert.equal(applyTravelV2InterStationHelpApplicationToSession(s, { queueKey }, { canApply: true, applyRequested: true }).ok, false); }
  for (const result of [null, "failure", "criticalFailure"]) { const s = usedSession(); s.roundResults[0].stationResults.navigator = result; assert.equal(applyTravelV2InterStationHelpApplicationToSession(s, { queueKey }, { canApply: true, applyRequested: true }).ok, false); }
  checked.push("canonical timing lifecycle source success and unresolved target are enforced");

  for (const tamper of [{ benefitKind: "automaticSuccess" }, { magnitude: 20 }, { expires: "endOfRound" }, { magnitude: 0 }, { magnitude: 1.5 }]) { const s = usedSession(); Object.assign(s.travelV2PendingStationBenefits[0], tamper); assert.equal(applyTravelV2InterStationHelpApplicationToSession(s, { queueKey }, { canApply: true, applyRequested: true }).ok, false); }
  checked.push("queue tampering and unsupported malformed benefits block fresh application");

  const review = prepareTravelV2InterStationHelpApplicationReview(session, { queueKey }, { canApply: true });
  assert.equal(review.ok, true); assert.equal(review.dcReduction, 2); assert.equal(review.fallbackBaseDc, 21); assert.equal(review.fallbackEffectiveDc, 19); assert.equal(review.applyAvailable, true);
  const applied = applyTravelV2InterStationHelpApplicationToSession(session, { queueKey }, { canApply: true, applyRequested: true, now: "2026-07-15T00:00:00.000Z" });
  assert.equal(applied.ok, true); assert.equal(applied.record.version, 2); assert.equal(applied.shouldAdoptSession, true); assert.equal(snap(session), before); assert.notEqual(applied.nextSession, session); assert.equal(applied.nextSession.travelV2InterStationHelpApplications.records.length, 1); assert.equal(applied.nextSession.travelV2PendingStationBenefits[0].applied, true); assert.equal(applied.nextSession.travelV2PendingStationBenefits[0].status, "used"); assert.equal(applied.nextSession.roundResults[0].stationResults.engineer, null); assert.equal(applied.nextSession.event.baseDC, 20);
  checked.push("successful application creates one session-local application record without rolling or rewriting base DC");


  const legacySession = JSON.parse(snap(applied.nextSession));
  const legacyRaw = legacySession.travelV2PendingStationBenefits[0];
  const legacyApplication = { version: 1, applicationKey: legacyRaw.applicationKey, queueKey: legacyRaw.queueKey, pendingHelpKey: legacyRaw.pendingHelpKey, actionId: legacyRaw.actionId, roundIndex: legacyRaw.roundIndex, roundNumber: legacyRaw.roundNumber, sourceStationKey: legacyRaw.sourceStationKey, sourceStationName: legacyRaw.sourceStationName, targetStationKey: legacyRaw.targetStationKey, targetStationName: legacyRaw.targetStationName, benefitKind: "dcReduction", magnitude: 2, status: "applied", applied: true, appliedAt: "2026-07-15T00:00:00.000Z", playerSafe: true };
  legacySession.travelV2InterStationHelpApplications = { version: 1, records: [legacyApplication] };
  const legacyAdjustment = prepareTravelV2InterStationHelpCheckAdjustment(legacySession, { roundIndex: 0, stationKey: "engineer" });
  assert.equal(legacyAdjustment.dcReduction, 2); assert.equal(legacyAdjustment.hasAdjustment, true); assert.equal(legacyAdjustment.applications[0].legacyApplication, true); assert.equal(legacyAdjustment.applications[0].strengthened, false);
  const legacyGmRow = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: legacySession, user: { isGM: true } }).travelV2PreviewPanel.stationBenefitDisplay.rows.find((row) => row.queueKey === legacyRaw.queueKey);
  assert.ok(legacyGmRow); assert.equal(legacyGmRow.appliedMagnitude, 2); assert.equal(legacyGmRow.appliedBaseMagnitude, 2); assert.equal(legacyGmRow.appliedCriticalMagnitude, null); assert.equal(legacyGmRow.appliedStrengthened, false); assert.equal(legacyGmRow.legacyApplication, true); assert.equal(legacyGmRow.applicationStatusLabel, "Effect applied: DC −2");
  const legacyPlayerRow = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: legacySession, user: { isGM: false } }).travelV2PreviewPanel.stationBenefitDisplay.rows.find((row) => row.queueKey === legacyRaw.queueKey);
  assert.ok(legacyPlayerRow); assert.equal(legacyPlayerRow.applicationStatusLabel, "Effect applied: DC −2"); assert.equal(legacyPlayerRow.canReviewEffect, false); assert.equal(legacyPlayerRow.applyAvailable, false);
  const legacyBaseMismatch = JSON.parse(snap(legacySession));
  legacyBaseMismatch.event.rounds[0].stationCards[0].interStationHelp[0].benefit.magnitude = 3;
  assertNoAdjustment(legacyBaseMismatch, "legacy-authored-base-mismatch");
  const legacyFailure = JSON.parse(snap(legacySession));
  legacyFailure.roundResults[0].stationResults.navigator = "failure";
  assertNoAdjustment(legacyFailure, "legacy-unsuccessful-source");
  for (const [label, mutate] of Object.entries({ legacyBaseField: (s) => { s.travelV2InterStationHelpApplications.records[0].baseMagnitude = 2; }, legacyEffectiveField: (s) => { s.travelV2InterStationHelpApplications.records[0].effectiveMagnitude = 2; }, legacyStrengthenedField: (s) => { s.travelV2InterStationHelpApplications.records[0].strengthened = false; }, legacyEffectSourceField: (s) => { s.travelV2InterStationHelpApplications.records[0].effectSource = "base"; }, legacyCriticalSuccessField: (s) => { s.travelV2InterStationHelpApplications.records[0].criticalSuccess = false; }, incompleteV2: (s) => { s.travelV2InterStationHelpApplications.records[0].version = 2; }, unknownVersion: (s) => { s.travelV2InterStationHelpApplications.records[0].version = 3; } })) { const tamperedLegacy = JSON.parse(snap(legacySession)); mutate(tamperedLegacy); assertNoAdjustment(tamperedLegacy, label); }
  checked.push("exact Slice 06 legacy application records remain base-only while hybrid or unknown versions contribute zero");

  const duplicate = applyTravelV2InterStationHelpApplicationToSession(applied.nextSession, { queueKey }, { canApply: true, applyRequested: true });
  assert.equal(duplicate.ok, false); assert.equal(duplicate.shouldAdoptSession, false); assert.equal(snap(duplicate.nextSession), snap(applied.nextSession));
  checked.push("duplicate application is non-adopting and preserves complete session");

  const adjustment = prepareTravelV2InterStationHelpCheckAdjustment(applied.nextSession, { roundIndex: 0, stationKey: "engineer" });
  assert.equal(adjustment.dcReduction, 2); assert.equal(adjustment.hasAdjustment, true);
  const expectedApplicationKey = `inter-station-help-application:${queueKey}`;
  assert.equal(applied.nextSession.travelV2PendingStationBenefits[0].applicationKey, expectedApplicationKey);
  assert.equal(applied.nextSession.travelV2InterStationHelpApplications.records[0].applicationKey, expectedApplicationKey);
  const coordinatedKeyTamper = JSON.parse(snap(applied.nextSession));
  coordinatedKeyTamper.travelV2PendingStationBenefits[0].applicationKey = "tampered-key";
  coordinatedKeyTamper.travelV2InterStationHelpApplications.records[0].applicationKey = "tampered-key";
  assertNoAdjustment(coordinatedKeyTamper, "coordinated-application-key-tamper");
  const missingRawKey = JSON.parse(snap(applied.nextSession));
  delete missingRawKey.travelV2PendingStationBenefits[0].applicationKey;
  assertNoAdjustment(missingRawKey, "missing-raw-application-key");
  const missingAppKey = JSON.parse(snap(applied.nextSession));
  delete missingAppKey.travelV2InterStationHelpApplications.records[0].applicationKey;
  assertNoAdjustment(missingAppKey, "missing-application-record-key");
  assertNoAdjustment(applied.nextSession, "watchmaster", "watchmaster");
  for (const [label, mutate] of Object.entries({ rawActionId: (s) => { s.travelV2PendingStationBenefits[0].actionId = "tampered"; }, rawAuthoredActionId: (s) => { s.travelV2PendingStationBenefits[0].authoredActionId = "tampered"; }, rawSource: (s) => { s.travelV2PendingStationBenefits[0].sourceStationKey = "watchmaster"; }, rawTarget: (s) => { s.travelV2PendingStationBenefits[0].targetStationKey = "watchmaster"; }, rawPendingKey: (s) => { s.travelV2PendingStationBenefits[0].pendingHelpKey = "tampered"; }, rawDedupe: (s) => { s.travelV2PendingStationBenefits[0].dedupeKey = "tampered"; }, rawBenefit: (s) => { s.travelV2PendingStationBenefits[0].benefitKind = "automaticSuccess"; }, rawMagnitude: (s) => { s.travelV2PendingStationBenefits[0].magnitude = 20; }, rawExpires: (s) => { s.travelV2PendingStationBenefits[0].expires = "endOfRound"; }, rawRound: (s) => { s.travelV2PendingStationBenefits[0].roundIndex = 1; }, rawAppKey: (s) => { s.travelV2PendingStationBenefits[0].applicationKey = "wrong"; }, authoredRemoved: (s) => { s.event.rounds[0].stationCards[0].interStationHelp = []; }, authoredMagnitude: (s) => { s.event.rounds[0].stationCards[0].interStationHelp[0].benefit.magnitude = 3; }, sourceCleared: (s) => { s.roundResults[0].stationResults.navigator = null; }, sourceFailure: (s) => { s.roundResults[0].stationResults.navigator = "failure"; }, orderUnlocked: (s) => { s.roundResults[0].stationOrderCommitments = {}; }, sourceAfter: (s) => { s.event.rounds[0].stationOrder = ["engineer", "navigator", "watchmaster"]; }, appMagnitude: (s) => { s.travelV2InterStationHelpApplications.records[0].magnitude = 20; }, appSource: (s) => { s.travelV2InterStationHelpApplications.records[0].sourceStationKey = "watchmaster"; }, appTarget: (s) => { s.travelV2InterStationHelpApplications.records[0].targetStationKey = "watchmaster"; }, appQueue: (s) => { s.travelV2InterStationHelpApplications.records[0].queueKey = "wrong"; } })) { const tampered = JSON.parse(snap(applied.nextSession)); mutate(tampered); assertNoAdjustment(tampered, label); }
  checked.push("applied records are revalidated and tampered raw application authored state or deterministic keys are ignored");

  const overlaySession = applyValid(withEngineerHazard(usedSession()));
  const overlay = prepareTravelSceneOverlayState(overlaySession);
  const engineer = overlay.stations.find((station) => station.stationKey === "engineer");
  assert.equal(resolveStationDc({ selectedApproach: { dc: 22, hazardDcModifier: 2 } }, 20).dc, 24);
  assert.equal(engineer.baseDc, 24); assert.equal(engineer.helpDcReduction, 2); assert.equal(engineer.effectiveDc, 22); assert.equal(engineer.dc, 22);
  const arcana = engineer.approachOptions.find((option) => option.skill === "arcana"); assert.equal(arcana.dc, 30);
  const stationDcSession = applyValid(usedSession({ engineerCard: { dc: 25, skillApproaches: [] } })); stationDcSession.roundResults[0].selectedStationSkills = {}; assert.equal(prepareTravelSceneOverlayState(withEngineerHazard(stationDcSession)).stations.find((station) => station.stationKey === "engineer").baseDc, 27);
  const modifierSession = applyValid(usedSession({ engineerCard: { skillApproaches: [] } })); modifierSession.roundResults[0].selectedStationSkills = {}; modifierSession.event.rounds[0].stationCards[1].dcModifier = 3; assert.equal(prepareTravelSceneOverlayState(modifierSession).stations.find((station) => station.stationKey === "engineer").baseDc, 23);
  const fallbackSession = applyValid(usedSession({ engineerCard: { skillApproaches: [] } })); fallbackSession.roundResults[0].selectedStationSkills = {}; delete fallbackSession.event.rounds[0].stationPrompts.engineer.dcModifier; assert.equal(prepareTravelSceneOverlayState(fallbackSession).stations.find((station) => station.stationKey === "engineer").baseDc, 20);
  const floorSession = applyValid(usedSession({ baseDC: 1, engineerCard: { skillApproaches: [] } })); floorSession.roundResults[0].selectedStationSkills = {}; delete floorSession.event.rounds[0].stationPrompts.engineer.dcModifier; assert.equal(prepareTravelSceneOverlayState(floorSession).stations.find((station) => station.stationKey === "engineer").effectiveDc, 0);
  assert.equal(prepareTravelSceneOverlayState(overlaySession).stations.find((station) => station.stationKey === "watchmaster").hasInterStationHelp, false);
  checked.push("live overlay reduces canonical resolved DCs without replacing selected approach hazard station modifier or event fallback DCs");

  const usedButUnapplied = prepareTravelV2PendingStationBenefitGmState({ session }, { user: { isGM: true }, includeGmReview: true });
  const unappliedRow = usedButUnapplied.rows.find((row) => row.queueKey === queueKey);
  assert.equal(unappliedRow.status, "used"); assert.equal(unappliedRow.used, true); assert.equal(unappliedRow.consumed, true); assert.equal(unappliedRow.applied, false); assert.equal(unappliedRow.applicationStatusLabel, null); assert.equal(unappliedRow.canReviewEffect, true); assert.equal(unappliedRow.applyAvailable, true);
  const gmQueue = prepareTravelV2PendingStationBenefitGmState({ session: applied.nextSession }, { user: { isGM: true }, includeGmReview: true });
  const gmRow = gmQueue.rows.find((row) => row.queueKey === queueKey);
  assert.equal(gmRow.status, "used"); assert.equal(gmRow.used, true); assert.equal(gmRow.consumed, true); assert.equal(gmRow.applied, true); assert.equal(gmRow.magnitude, 2); assert.equal(gmRow.appliedMagnitude, 2); assert.equal(gmRow.appliedStrengthened, false); assert.equal(gmRow.applicationStatusLabel, "Effect applied: DC −2"); assert.equal(gmRow.canReviewEffect, false); assert.equal(gmRow.applyAvailable, false);
  const playerQueue = prepareTravelV2PendingStationBenefitPlayerState({ session: applied.nextSession }, { user: { isGM: false } });
  const playerRow = playerQueue.rows.find((row) => row.queueKey === queueKey);
  assert.equal(playerRow.status, "used"); assert.equal(playerRow.used, true); assert.equal(playerRow.consumed, true); assert.equal(playerRow.applied, true); assert.equal(playerRow.appliedMagnitude, 2); assert.equal(playerRow.appliedStrengthened, false); assert.equal(playerRow.applicationStatusLabel, "Effect applied: DC −2"); assert.equal(playerRow.canReviewEffect, false); assert.equal(playerRow.applyAvailable, false);
  const templateSource = readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
  assert.equal(templateSource.includes("applicationStatusLabel"), true); assert.equal(templateSource.includes("travelV2InterStationHelpApplicationReview.ok"), true); assert.equal(templateSource.includes("Critical-success strengthening will be evaluated during the separate Help Effect review."), true); assert.equal(templateSource.includes("Critical-success metadata remains review-only and inert."), false);
  const gmUnappliedRender = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, user: { isGM: true } });
  const gmUnappliedRows = gmUnappliedRender.travelV2PreviewPanel.stationBenefitDisplay.rows;
  const gmUnappliedRow = gmUnappliedRows.find((row) => row.queueKey === queueKey);
  const authoredOptionRow = gmUnappliedRows.find((row) => row.helpOptionOnly === true);
  assert.ok(authoredOptionRow); assert.ok(gmUnappliedRow);
  assert.equal(gmUnappliedRow.status, "used"); assert.equal(gmUnappliedRow.used, true); assert.equal(gmUnappliedRow.consumed, true); assert.equal(gmUnappliedRow.applied, false); assert.equal(gmUnappliedRow.applicationStatusLabel, ""); assert.equal(gmUnappliedRow.canReviewEffect, true); assert.equal(gmUnappliedRow.applyAvailable, true); assert.equal(gmUnappliedRow.requestAvailabilityLabel, "Effect review available");
  const gmAppliedRender = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: applied.nextSession, user: { isGM: true } });
  const gmAppliedRow = gmAppliedRender.travelV2PreviewPanel.stationBenefitDisplay.rows.find((row) => row.queueKey === queueKey);
  assert.ok(gmAppliedRow); assert.equal(gmAppliedRow.status, "used"); assert.equal(gmAppliedRow.used, true); assert.equal(gmAppliedRow.consumed, true); assert.equal(gmAppliedRow.applied, true); assert.equal(gmAppliedRow.magnitude, 2); assert.equal(gmAppliedRow.appliedMagnitude, 2); assert.equal(gmAppliedRow.appliedStrengthened, false); assert.equal(gmAppliedRow.applicationStatusLabel, "Effect applied: DC −2"); assert.equal(gmAppliedRow.canReviewEffect, false); assert.equal(gmAppliedRow.applyAvailable, false); assert.equal(gmAppliedRow.requestAvailabilityLabel, "Effect applied: DC −2");
  const playerAppliedRender = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: applied.nextSession, user: { isGM: false } });
  const playerAppliedRow = playerAppliedRender.travelV2PreviewPanel.stationBenefitDisplay.rows.find((row) => row.queueKey === queueKey);
  assert.ok(playerAppliedRow); assert.equal(playerAppliedRow.status, "used"); assert.equal(playerAppliedRow.used, true); assert.equal(playerAppliedRow.consumed, true); assert.equal(playerAppliedRow.applied, true); assert.equal(playerAppliedRow.appliedMagnitude, 2); assert.equal(playerAppliedRow.appliedStrengthened, false); assert.equal(playerAppliedRow.applicationStatusLabel, "Effect applied: DC −2"); assert.equal(playerAppliedRow.canReviewEffect, false); assert.equal(playerAppliedRow.applyAvailable, false);
  const playerRender = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: applied.nextSession, user: { isGM: false }, uiState: { travelV2InterStationHelpApplicationReviewRequested: true, travelV2InterStationHelpApplicationSelectedQueueKey: queueKey, travelV2InterStationHelpApplicationResult: { message: "secret" } } });
  const serializedPlayer = JSON.stringify(playerRender);
  assert.equal(serializedPlayer.includes('"canReviewEffect":true'), false); assert.equal(serializedPlayer.includes('"applyAvailable":true'), false); assert.equal(serializedPlayer.includes('"applicationStatusLabel":"Effect applied: DC −2"'), true); assert.equal(serializedPlayer.includes("travelV2InterStationHelpApplicationReview"), false); assert.equal(serializedPlayer.includes("travelV2InterStationHelpApplicationResult"), false);
  checked.push("queue and preview-panel render states show accurate lifecycle while non-GM state exposes no application capability");

  const critical = usedSession({ result: "criticalSuccess" });
  const criticalQueueKey = critical.travelV2PendingStationBenefits[0].queueKey;
  assert.equal(critical.travelV2PendingStationBenefits[0].criticalSuccess, true);
  assert.equal(critical.travelV2PendingStationBenefits[0].criticalSuccessMetadata.magnitude, 4);
  const criticalReview = prepareTravelV2InterStationHelpApplicationReview(critical, { queueKey: criticalQueueKey }, { canApply: true });
  assert.equal(criticalReview.ok, true); assert.equal(criticalReview.baseMagnitude, 2); assert.equal(criticalReview.criticalMagnitude, 4); assert.equal(criticalReview.effectiveMagnitude, 4); assert.equal(criticalReview.magnitude, 4); assert.equal(criticalReview.dcReduction, 4); assert.equal(criticalReview.strengthened, true); assert.equal(criticalReview.effectSource, "criticalSuccess"); assert.equal(criticalReview.criticalSuccessNote.includes("from DC −2 to DC −4"), true);
  const crit = applyTravelV2InterStationHelpApplicationToSession(critical, { queueKey: criticalQueueKey }, { canApply: true, applyRequested: true });
  assert.equal(crit.ok, true); assert.equal(crit.record.version, 2); assert.equal(crit.nextSession.travelV2InterStationHelpApplications.records.length, 1);
  assert.equal(crit.nextSession.travelV2InterStationHelpApplications.records[0].baseMagnitude, 2); assert.equal(crit.nextSession.travelV2InterStationHelpApplications.records[0].criticalMagnitude, 4); assert.equal(crit.nextSession.travelV2InterStationHelpApplications.records[0].effectiveMagnitude, 4); assert.equal(crit.nextSession.travelV2InterStationHelpApplications.records[0].magnitude, 4); assert.equal(crit.nextSession.travelV2InterStationHelpApplications.records[0].strengthened, true); assert.equal(crit.nextSession.travelV2InterStationHelpApplications.records[0].strengtheningMode, "replaceMagnitude"); assert.equal(crit.nextSession.travelV2InterStationHelpApplications.records[0].effectSource, "criticalSuccess");
  assert.equal(prepareTravelV2InterStationHelpCheckAdjustment(crit.nextSession, { roundIndex: 0, stationKey: "engineer" }).dcReduction, 4);
  assert.equal(prepareTravelSceneOverlayState(crit.nextSession).stations.find((station) => station.stationKey === "engineer").effectiveDc, 18);
  assert.equal(crit.nextSession.roundResults[0].stationResults.engineer, null);


  const criticalLegacySession = JSON.parse(snap(crit.nextSession));
  const criticalLegacyRaw = criticalLegacySession.travelV2PendingStationBenefits[0];
  criticalLegacySession.travelV2InterStationHelpApplications = { version: 1, records: [{ version: 1, applicationKey: criticalLegacyRaw.applicationKey, queueKey: criticalLegacyRaw.queueKey, pendingHelpKey: criticalLegacyRaw.pendingHelpKey, actionId: criticalLegacyRaw.actionId, roundIndex: criticalLegacyRaw.roundIndex, roundNumber: criticalLegacyRaw.roundNumber, sourceStationKey: criticalLegacyRaw.sourceStationKey, sourceStationName: criticalLegacyRaw.sourceStationName, targetStationKey: criticalLegacyRaw.targetStationKey, targetStationName: criticalLegacyRaw.targetStationName, benefitKind: "dcReduction", magnitude: 2, status: "applied", applied: true, appliedAt: "2026-07-15T00:00:00.000Z", playerSafe: true }] };
  const criticalLegacyAdjustment = prepareTravelV2InterStationHelpCheckAdjustment(criticalLegacySession, { roundIndex: 0, stationKey: "engineer" });
  assert.equal(criticalLegacyAdjustment.dcReduction, 2); assert.equal(criticalLegacyAdjustment.applications[0].legacyApplication, true); assert.equal(criticalLegacyAdjustment.applications[0].strengthened, false);

  const criticalGmAppliedRender = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: crit.nextSession, user: { isGM: true } });
  const criticalGmAppliedRow = criticalGmAppliedRender.travelV2PreviewPanel.stationBenefitDisplay.rows.find((row) => row.queueKey === criticalQueueKey);
  assert.ok(criticalGmAppliedRow); assert.equal(criticalGmAppliedRow.magnitude, 2); assert.equal(criticalGmAppliedRow.applied, true); assert.equal(criticalGmAppliedRow.appliedMagnitude, 4); assert.equal(criticalGmAppliedRow.appliedBaseMagnitude, 2); assert.equal(criticalGmAppliedRow.appliedCriticalMagnitude, 4); assert.equal(criticalGmAppliedRow.appliedStrengthened, true); assert.equal(criticalGmAppliedRow.applicationStatusLabel, "Effect applied: DC −4");
  const criticalPlayerAppliedRender = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: crit.nextSession, user: { isGM: false } });
  const criticalPlayerAppliedRow = criticalPlayerAppliedRender.travelV2PreviewPanel.stationBenefitDisplay.rows.find((row) => row.queueKey === criticalQueueKey);
  assert.ok(criticalPlayerAppliedRow); assert.equal(criticalPlayerAppliedRow.appliedMagnitude, 4); assert.equal(criticalPlayerAppliedRow.appliedStrengthened, true); assert.equal(criticalPlayerAppliedRow.applicationStatusLabel, "Effect applied: DC −4"); assert.equal(criticalPlayerAppliedRow.canReviewEffect, false); assert.equal(criticalPlayerAppliedRow.applyAvailable, false);
  const malformedHistory = JSON.parse(snap(crit.nextSession));
  malformedHistory.travelV2InterStationHelpApplications.records[0].effectiveMagnitude = 99;
  const malformedHistoryRow = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: malformedHistory, user: { isGM: true } }).travelV2PreviewPanel.stationBenefitDisplay.rows.find((row) => row.queueKey === criticalQueueKey);
  assert.ok(malformedHistoryRow); assert.equal(malformedHistoryRow.applicationStatusLabel, "Effect applied"); assert.equal(malformedHistoryRow.appliedMagnitude, null);
  for (const [label, mutate] of Object.entries({ appMagnitude: (s) => { s.travelV2InterStationHelpApplications.records[0].magnitude = 6; }, appEffective: (s) => { s.travelV2InterStationHelpApplications.records[0].effectiveMagnitude = 6; }, appBase: (s) => { s.travelV2InterStationHelpApplications.records[0].baseMagnitude = 3; }, appCritical: (s) => { s.travelV2InterStationHelpApplications.records[0].criticalMagnitude = 5; }, appStrengthened: (s) => { s.travelV2InterStationHelpApplications.records[0].strengthened = false; }, appMode: (s) => { s.travelV2InterStationHelpApplications.records[0].strengtheningMode = "automaticSuccess"; }, appEffectSource: (s) => { s.travelV2InterStationHelpApplications.records[0].effectSource = "base"; }, appCriticalFlag: (s) => { s.travelV2InterStationHelpApplications.records[0].criticalSuccess = false; }, correctedSource: (s) => { s.roundResults[0].stationResults.navigator = "success"; }, rawCriticalMagnitude: (s) => { s.travelV2PendingStationBenefits[0].criticalSuccessMetadata.magnitude = 5; }, rawCriticalMode: (s) => { s.travelV2PendingStationBenefits[0].criticalSuccessMetadata.strengthening = "automaticSuccess"; }, rawCriticalKind: (s) => { s.travelV2PendingStationBenefits[0].criticalSuccessMetadata.benefitKind = "automaticSuccess"; }, rawCriticalMissing: (s) => { delete s.travelV2PendingStationBenefits[0].criticalSuccessMetadata; } })) { const tampered = JSON.parse(snap(crit.nextSession)); mutate(tampered); assertNoAdjustment(tampered, label); }

  for (const mutate of [
    (s) => { s.travelV2PendingStationBenefits[0].resultBand = "success"; s.travelV2PendingStationBenefits[0].criticalSuccess = false; s.roundResults[0].stationResults.navigator = "criticalSuccess"; },
    (s) => { s.travelV2PendingStationBenefits[0].resultBand = "criticalSuccess"; s.travelV2PendingStationBenefits[0].criticalSuccess = true; s.roundResults[0].stationResults.navigator = "success"; },
    (s) => { s.travelV2PendingStationBenefits[0].resultBand = "criticalSuccess"; s.travelV2PendingStationBenefits[0].criticalSuccess = false; s.roundResults[0].stationResults.navigator = "criticalSuccess"; },
    (s) => { s.travelV2PendingStationBenefits[0].resultBand = "success"; s.travelV2PendingStationBenefits[0].criticalSuccess = true; s.roundResults[0].stationResults.navigator = "success"; }
  ]) {
    const staleSession = JSON.parse(snap(critical));
    mutate(staleSession);
    const staleReview = prepareTravelV2InterStationHelpApplicationReview(staleSession, { queueKey: criticalQueueKey }, { canApply: true });
    assert.equal(staleReview.ok, false); assert.equal(staleReview.canApply, false); assert.equal(staleReview.applyAvailable, false); assert.equal(staleReview.baseMagnitude, null); assert.equal(staleReview.criticalMagnitude, null); assert.equal(staleReview.effectiveMagnitude, null); assert.equal(staleReview.magnitude, null); assert.equal(staleReview.dcReduction, 0); assert.equal(staleReview.fallbackEffectiveDc, null); assert.equal(staleReview.fallbackDcPreview, false); assert.equal(staleReview.helpSummary, ""); assert.equal(staleReview.criticalSuccessNote, "");
    assert.equal(staleReview.blockedReasons.includes("inter-station-help-source-result-mismatch") || staleReview.blockedReasons.includes("inter-station-help-critical-success-flag-mismatch"), true);
  }
  const unsupported = usedSession({ result: "criticalSuccess", action: { id: "open-engine-feed", targetStationKey: "engineer", title: "Open the Engine Feed", benefit: { kind: "dcReduction", magnitude: 2, expires: "afterUse" }, criticalSuccessMetadata: { strengthening: "automaticSuccess", benefitKind: "automaticSuccess", magnitude: 4 } } });
  const unsupportedReview = prepareTravelV2InterStationHelpApplicationReview(unsupported, { queueKey: unsupported.travelV2PendingStationBenefits[0].queueKey }, { canApply: true });
  assert.equal(unsupportedReview.ok, true); assert.equal(unsupportedReview.effectiveMagnitude, 2); assert.equal(unsupportedReview.strengthened, false); assert.equal(unsupportedReview.criticalSuccessNote.includes("normal DC −2"), true);
  const unsupportedApplied = applyTravelV2InterStationHelpApplicationToSession(unsupported, { queueKey: unsupported.travelV2PendingStationBenefits[0].queueKey }, { canApply: true, applyRequested: true });
  assert.equal(prepareTravelV2InterStationHelpCheckAdjustment(unsupportedApplied.nextSession, { roundIndex: 0, stationKey: "engineer" }).dcReduction, 2);
  for (const cm of [undefined, 2, 1]) { const s = usedSession({ result: "criticalSuccess", action: { id: "open-engine-feed", targetStationKey: "engineer", title: "Open the Engine Feed", benefit: { kind: "dcReduction", magnitude: 2, expires: "afterUse" }, ...(cm === undefined ? {} : { criticalSuccessMetadata: { strengthening: "replaceMagnitude", benefitKind: "dcReduction", magnitude: cm } }) } }); const r = applyTravelV2InterStationHelpApplicationToSession(s, { queueKey: s.travelV2PendingStationBenefits[0].queueKey }, { canApply: true, applyRequested: true }); assert.equal(prepareTravelV2InterStationHelpCheckAdjustment(r.nextSession, { roundIndex: 0, stationKey: "engineer" }).dcReduction, 2); }
  const normal = usedSession(); assert.equal(Object.hasOwn(normal.travelV2PendingStationBenefits[0], "criticalSuccessMetadata"), false);
  checked.push("critical success replaceMagnitude uses final stronger dcReduction while unsupported stale or tampered metadata falls back or contributes zero");

  console.log(`travel-v2-inter-station-help-application smoke passed (${checked.length} groups)`);
  return { checked };
}
if (import.meta.url === `file://${process.argv[1]}`) await runTravelV2InterStationHelpApplicationSmokeChecks();
