import assert from "node:assert/strict";
import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { applyTravelV2InterStationHelpExpirationToSession, prepareTravelV2InterStationHelpExpiration, TRAVEL_V2_INTER_STATION_HELP_EXPIRATION_VERSION } from "./travel-v2-inter-station-help-expiration.js";
import { prepareTravelV2PendingStationBenefitPlayerState, prepareTravelV2PendingStationBenefitGmState } from "./travel-v2-pending-station-benefit-queue.js";
import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";
import { prepareTravelV2InterStationHelpPendingRecord } from "./travel-v2-inter-station-help-pending-records.js";
import { applyTravelV2InterStationHelpApplicationToSession, prepareTravelV2InterStationHelpCheckAdjustment } from "./travel-v2-inter-station-help-application.js";
import { finalizeTravelV2RoundOnRunnerSession } from "./travel-v2-session-round-finalization.js";
import { clearTravelEventRunnerStationResult, setTravelEventRunnerStationResult } from "./travel-event-runner.js";

const NOW = "2026-07-15T12:00:00.000Z";
const TERMINAL_RESULTS = ["criticalSuccess", "success", "failure", "criticalFailure", "skipped"];
const snap = (value) => JSON.stringify(value);

function assertNoAdjustment(session, label, stationKey = "engineer") {
  const adjustment = prepareTravelV2InterStationHelpCheckAdjustment(session, { roundIndex: 0, stationKey });
  assert.equal(adjustment.dcReduction, 0, label);
  assert.equal(adjustment.hasAdjustment, false, label);
}

function assertAdjustment(session, expected, label, stationKey = "engineer") {
  const adjustment = prepareTravelV2InterStationHelpCheckAdjustment(session, { roundIndex: 0, stationKey });
  assert.equal(adjustment.dcReduction, expected, label);
  assert.equal(adjustment.hasAdjustment, expected > 0, label);
}

function baseSession({ result = "success", targetResult = null, expires = "afterUse", criticalMetadata = { strengthening: "replaceMagnitude", benefitKind: "dcReduction", magnitude: 4 } } = {}) {
  const helpAction = { id: "open-engine-feed", targetStationKey: "engineer", title: "Open the Engine Feed", publicText: "Navigator steadies Engineering.", benefit: { kind: "dcReduction", magnitude: 2, expires }, criticalSuccessMetadata: criticalMetadata };
  return {
    status: "active",
    currentRoundIndex: 0,
    event: { baseDC: 20, rounds: [{ roundNumber: 1, activeStations: ["captain", "navigator", "engineer", "watchmaster", "veilwarden"], stationOrder: ["captain", "navigator", "engineer", "watchmaster", "veilwarden"], stationPrompts: { captain: { stationName: "Captain" }, navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer", dcModifier: 1 }, watchmaster: { stationName: "Watchmaster" }, veilwarden: { stationName: "Veilwarden" } }, stationCards: [{ stationKey: "navigator", interStationHelp: [helpAction] }] }] },
    roundResults: [{ roundIndex: 0, roundNumber: 1, stationResults: { captain: "success", navigator: result, engineer: targetResult, watchmaster: null, veilwarden: null }, stationActions: { captain: { actionKey: "eventApproach", label: "Event Approach" }, navigator: { actionKey: "eventApproach", label: "Event Approach" }, engineer: { actionKey: "eventApproach", label: "Event Approach" }, watchmaster: { actionKey: "eventApproach", label: "Event Approach" }, veilwarden: { actionKey: "eventApproach", label: "Event Approach" } }, stationOrderCommitments: { captain: { committed: true }, navigator: { committed: true }, engineer: { committed: true }, watchmaster: { committed: true }, veilwarden: { committed: true } } }]
  };
}

function pendingRecord(session, { state = "pending", target = "engineer", roundIndex = 0, expires = null } = {}) {
  const action = prepareTravelV2InterStationHelpActions(session, { includeUnavailable: true }).helpActions.find((row) => row.actionId === "open-engine-feed");
  const prepared = prepareTravelV2InterStationHelpPendingRecord(session, { ...action, targetStationKey: target, expires: expires ?? action.expires }, { result: session.roundResults[0].stationResults.navigator, roundIndex: 0, sourceStationKey: "navigator", targetStationKey: target, actionId: "open-engine-feed" });
  const canonical = prepared.record ?? { pendingHelpKey: `inter-station-help:0:open-engine-feed:navigator:${target}`, dedupeKey: `inter-station-help:0:open-engine-feed:navigator:${target}`, actionId: "open-engine-feed", authoredActionId: "open-engine-feed", sourceStationKey: "navigator", sourceStationName: "Navigator", targetStationKey: target, targetStationName: target, benefitKind: "dcReduction", magnitude: 2, expires: expires ?? action.expires, status: "pending", roundIndex: 0, roundNumber: 1 };
  const row = { ...canonical, queueKey: `${canonical.pendingHelpKey}:${target}:${roundIndex}:${state}`, roundIndex, roundNumber: roundIndex + 1, expires: expires ?? canonical.expires };
  if (!row.dedupeKey) row.dedupeKey = row.pendingHelpKey;
  if (state === "used" || state === "applied") Object.assign(row, { status: "used", used: true, consumed: true });
  if (state === "applied") Object.assign(row, { applied: true, applicationKey: `inter-station-help-application:${row.queueKey}`, appliedAt: NOW });
  if (state === "dismissed") Object.assign(row, { status: "dismissed", dismissed: true });
  if (state === "blocked") Object.assign(row, { status: "blocked", blocked: true });
  if (state === "expired") Object.assign(row, { status: "expired", expired: true, expiredAt: "2026-07-14T00:00:00.000Z", expirationTrigger: "targetResolved", expirationReason: "target-result-recorded" });
  return row;
}

function sessionWithRows(rows, options = {}) {
  return { ...baseSession(options), travelV2PendingStationBenefits: rows, travelV2InterStationHelpApplications: { version: 2, records: [] } };
}

function sessionWithRecord(row, options = {}) { return sessionWithRows([row], options); }
function usedSession(options = {}) { const session = baseSession(options); return { ...session, travelV2PendingStationBenefits: [pendingRecord(session, { state: "used", expires: options.expires })] }; }
function applyValid(session = usedSession(), now = "2026-07-15T00:00:00.000Z") { return applyTravelV2InterStationHelpApplicationToSession(session, { queueKey: session.travelV2PendingStationBenefits[0].queueKey }, { canApply: true, applyRequested: true, now }).nextSession; }

function finalizableSession(rows = []) {
  const stations = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
  const lockedRound = { roundIndex: 0, roundNumber: 1, stationActions: Object.fromEntries(stations.map((stationKey) => [stationKey, { actionKey: "eventApproach", label: "Event Approach" }])), stationOrderCommitments: Object.fromEntries(stations.map((stationKey) => [stationKey, { committed: true }])), stationResults: Object.fromEntries(stations.map((stationKey) => [stationKey, "success"])) };
  const session = { status: "active", currentRoundIndex: 0, event: { rounds: [{ number: 1, primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL, secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES, pressureStation: "engineer", activeStations: stations, stationSummary: { engineer: { outcomeKey: "mixed", pressure: 1 } } }] }, roundResults: [lockedRound], travelV2PressureApplications: { records: [{ roundIndex: 0, roundNumber: 1, outcomeKey: "mixed", requestCount: 1 }] } };
  if (rows.length > 0) session.travelV2PendingStationBenefits = rows;
  return session;
}

function unrelatedRows() {
  return [
    { queueKey: "hazard-ignore:0:engineer", sourceId: "hazard-card-1", sourceStationKey: "watchmaster", targetStationKey: "engineer", benefitKind: "hazardIgnore", expires: "afterUse", roundIndex: 0, status: "pending" },
    { queueKey: "risk-bid-discount:0", sourceId: "risk-bid-1", sourceStationKey: "captain", targetStationKey: "engineer", benefitKind: "riskBidDiscount", expires: "endOfRound", roundIndex: 0, status: "pending" },
    { queueKey: "inter-station-help:fake", pendingHelpKey: "inter-station-help:fake", dedupeKey: "different-key", actionId: "open-engine-feed", authoredActionId: "open-engine-feed", sourceStationKey: "navigator", targetStationKey: "engineer", benefitKind: "dcReduction", expires: "afterUse", roundIndex: 0, status: "pending" },
    { queueKey: "inter-station-help:no-pending-key", sourceStationKey: "navigator", targetStationKey: "engineer", benefitKind: "dcReduction", expires: "afterUse", roundIndex: 0, status: "pending" }
  ];
}

function assertUnrelatedPreserved(beforeRows, afterRows, offset = 1) {
  beforeRows.forEach((row, index) => assert.equal(snap(afterRows[index + offset]), snap(row), `unrelated row ${index} should be byte-for-byte preserved`));
}

export default async function runTravelV2InterStationHelpExpirationSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_INTER_STATION_HELP_EXPIRATION_VERSION, 1);
  assert.equal(prepareTravelV2InterStationHelpExpiration({}, { trigger: "missing", roundIndex: 0 }).ok, false);
  checked.push("unknown trigger is rejected");

  const unresolved = sessionWithRecord(pendingRecord(baseSession(), { state: "applied" }));
  assert.equal(unresolved.roundResults[0].stationResults.engineer, null);
  const blockedUnresolved = applyTravelV2InterStationHelpExpirationToSession(unresolved, { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW });
  assert.equal(blockedUnresolved.ok, false); assert.equal(blockedUnresolved.changed, false); assert.equal(blockedUnresolved.shouldAdoptSession, false); assert.equal(blockedUnresolved.expiredCount, 0); assert.deepEqual(blockedUnresolved.blockedReasons, ["target-result-not-resolved"]); assert.equal(snap(blockedUnresolved.session), snap(unresolved));
  checked.push("unresolved targetResolved is rejected without mutation");

  for (const state of ["pending", "used", "applied"]) {
    const row = pendingRecord(baseSession(), { state });
    const result = applyTravelV2InterStationHelpExpirationToSession(sessionWithRecord(row, { targetResult: "success" }), { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW });
    assert.equal(result.ok, true, state); assert.equal(result.expiredCount, 1, state); assert.equal(result.session.travelV2PendingStationBenefits[0].status, "expired", state); assert.equal(result.session.travelV2PendingStationBenefits[0].expirationReason, "target-result-recorded", state);
  }
  checked.push("matching resolved afterUse pending used and applied Help expires");

  for (const row of [pendingRecord(baseSession(), { state: "applied", target: "watchmaster" }), pendingRecord(baseSession(), { state: "applied", roundIndex: 1 }), pendingRecord(baseSession({ expires: "endOfRound" }), { state: "applied", expires: "endOfRound" })]) {
    const before = snap(row); const result = applyTravelV2InterStationHelpExpirationToSession(sessionWithRecord(row, { targetResult: "success" }), { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW });
    assert.equal(result.expiredCount, 0); assert.equal(snap(result.session.travelV2PendingStationBenefits[0]), before);
  }
  checked.push("other targets rounds and endOfRound target-resolution rows remain unchanged");

  for (const terminalResult of TERMINAL_RESULTS) {
    const applied = applyValid(usedSession());
    assertAdjustment(applied, 2, `${terminalResult} before`);
    const updated = setTravelEventRunnerStationResult(applied, 0, "engineer", terminalResult, { now: NOW });
    assert.equal(updated.ok, true, terminalResult); assert.equal(updated.session.roundResults[0].stationResults.engineer, terminalResult, terminalResult); assert.equal(updated.session.travelV2PendingStationBenefits[0].status, "expired", terminalResult); assert.equal(updated.session.travelV2PendingStationBenefits[0].expirationTrigger, "targetResolved", terminalResult); assert.equal(updated.session.travelV2PendingStationBenefits[0].expirationReason, "target-result-recorded", terminalResult); assertNoAdjustment(updated.session, `${terminalResult} after`);
  }
  checked.push("every terminal station result including skipped triggers canonical station-result cleanup");

  const mixedValid = pendingRecord(baseSession(), { state: "applied" });
  const unrelated = unrelatedRows();
  const mixedTarget = applyTravelV2InterStationHelpExpirationToSession(sessionWithRows([mixedValid, ...unrelated], { targetResult: "success" }), { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW });
  assert.equal(mixedTarget.expiredCount, 1); assert.equal(mixedTarget.session.travelV2PendingStationBenefits[0].status, "expired"); assertUnrelatedPreserved(unrelated, mixedTarget.session.travelV2PendingStationBenefits);
  const mixedRoundRows = [pendingRecord(baseSession(), { expires: "afterUse" }), pendingRecord(baseSession({ expires: "endOfRound" }), { expires: "endOfRound" }), ...unrelatedRows()];
  const mixedRound = applyTravelV2InterStationHelpExpirationToSession(sessionWithRows(mixedRoundRows), { trigger: "roundFinalized", roundIndex: 0, now: NOW });
  assert.equal(mixedRound.expiredCount, 2); assert.equal(mixedRound.session.travelV2PendingStationBenefits[0].status, "expired"); assert.equal(mixedRound.session.travelV2PendingStationBenefits[1].status, "expired"); assertUnrelatedPreserved(mixedRoundRows.slice(2), mixedRound.session.travelV2PendingStationBenefits, 2); assert.equal(mixedRound.unchangedCount, 4);
  checked.push("unrelated shared-queue and malformed pseudo-Help rows remain byte-for-byte unchanged; unchangedCount covers unchanged queue rows");

  for (const expires of ["afterUse", "endOfRound"]) for (const state of ["pending", "applied"]) {
    const row = pendingRecord(baseSession({ expires }), { state, expires });
    const result = applyTravelV2InterStationHelpExpirationToSession(sessionWithRecord(row), { trigger: "roundFinalized", roundIndex: 0, roundNumber: 1, now: NOW });
    assert.equal(result.expiredCount, 1, `${expires}-${state}`); assert.equal(result.session.travelV2PendingStationBenefits[0].expirationReason, "round-finalized");
  }
  checked.push("round finalization expires canonical afterUse and endOfRound Help");

  for (const expires of ["endOfEvent", "manual", "unknown"]) { const row = pendingRecord(baseSession({ expires }), { expires }); const before = snap(row); const result = applyTravelV2InterStationHelpExpirationToSession(sessionWithRecord(row), { trigger: "roundFinalized", roundIndex: 0, now: NOW }); assert.equal(result.expiredCount, 0, expires); assert.equal(snap(result.session.travelV2PendingStationBenefits[0]), before, expires); }
  for (const state of ["dismissed", "blocked", "expired"]) { const row = pendingRecord(baseSession(), { state }); const before = snap(row); const result = applyTravelV2InterStationHelpExpirationToSession(sessionWithRecord(row, { targetResult: "success" }), { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW }); assert.equal(result.expiredCount, 0, state); assert.equal(snap(result.session.travelV2PendingStationBenefits[0]), before, state); }
  checked.push("unsupported modes and terminal lifecycle rows remain unchanged");

  const immutable = sessionWithRecord(pendingRecord(baseSession(), { state: "applied" }), { targetResult: "success" }); immutable.travelV2InterStationHelpApplications = { records: [{ applicationKey: immutable.travelV2PendingStationBenefits[0].applicationKey, queueKey: immutable.travelV2PendingStationBenefits[0].queueKey, preserved: true }] };
  const before = snap(immutable); const once = applyTravelV2InterStationHelpExpirationToSession(immutable, { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW }); const twice = applyTravelV2InterStationHelpExpirationToSession(once.session, { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: "2026-07-16T00:00:00.000Z" });
  assert.equal(snap(immutable), before); assert.equal(twice.expiredCount, 0); assert.equal(twice.session.travelV2PendingStationBenefits[0].expiredAt, NOW); assert.deepEqual(twice.session.travelV2InterStationHelpApplications.records, immutable.travelV2InterStationHelpApplications.records);
  checked.push("cleanup is immutable idempotent and preserves timestamps plus application records");

  const appliedNormal = applyValid(usedSession()); assertAdjustment(appliedNormal, 2, "normal before"); const expiredNormal = setTravelEventRunnerStationResult(appliedNormal, 0, "engineer", "success", { now: NOW }).session; assertNoAdjustment(expiredNormal, "normal after");
  const legacy = JSON.parse(snap(appliedNormal)); legacy.travelV2InterStationHelpApplications.records[0] = { version: 1, applicationKey: legacy.travelV2PendingStationBenefits[0].applicationKey, queueKey: legacy.travelV2PendingStationBenefits[0].queueKey, pendingHelpKey: legacy.travelV2PendingStationBenefits[0].pendingHelpKey, actionId: "open-engine-feed", roundIndex: 0, targetStationKey: "engineer", sourceStationKey: "navigator", benefitKind: "dcReduction", magnitude: 2, status: "applied", applied: true }; assertAdjustment(legacy, 2, "legacy before"); assertNoAdjustment(setTravelEventRunnerStationResult(legacy, 0, "engineer", "success", { now: NOW }).session, "legacy after");
  const fallback = applyValid(usedSession({ result: "criticalSuccess", criticalMetadata: { strengthening: "automaticSuccess", benefitKind: "dcReduction", magnitude: 4 } })); assertAdjustment(fallback, 2, "fallback before"); assertNoAdjustment(setTravelEventRunnerStationResult(fallback, 0, "engineer", "success", { now: NOW }).session, "fallback after");
  const strengthened = applyValid(usedSession({ result: "criticalSuccess" })); assertAdjustment(strengthened, 4, "strengthened before"); assertNoAdjustment(setTravelEventRunnerStationResult(strengthened, 0, "engineer", "success", { now: NOW }).session, "strengthened after");
  checked.push("unexpired legacy base fallback and strengthened Help retain magnitude before expiration and contribute zero after");

  const cleared = clearTravelEventRunnerStationResult(expiredNormal, 0, "engineer", { now: "2026-07-15T12:30:00.000Z" }); assert.equal(cleared.ok, true); assert.equal(cleared.session.roundResults[0].stationResults.engineer, null); assert.equal(cleared.session.travelV2PendingStationBenefits[0].status, "expired");
  checked.push("result clearing does not resurrect expired Help");

  const display = prepareTravelV2PendingStationBenefitPlayerState({ session: expiredNormal }); const displayRow = display.rows[0]; assert.equal(displayRow.applicationStatusLabel, "Effect applied: DC −2 · Expired after target resolution"); assert.equal(displayRow.expirationStatusLabel, "Expired after target resolution"); assert.equal(displayRow.expired, true); assert.equal(displayRow.expirationTrigger, "targetResolved");
  const roundEndDisplaySession = applyTravelV2InterStationHelpExpirationToSession(applyValid(usedSession({ expires: "endOfRound" })), { trigger: "roundFinalized", roundIndex: 0, roundNumber: 1, now: NOW }).session;
  const roundEndDisplayRow = prepareTravelV2PendingStationBenefitPlayerState({ session: roundEndDisplaySession }).rows[0]; assert.equal(roundEndDisplayRow.applicationStatusLabel, "Effect applied: DC −2 · Expired at round end"); assert.equal(roundEndDisplayRow.expirationStatusLabel, "Expired at round end");
  const gmRow = prepareTravelV2PendingStationBenefitGmState({ session: expiredNormal }, { user: { isGM: true }, includeGmReview: true }).gmRows[0]; assert.equal(gmRow.canReviewEffect, false); assert.equal(gmRow.applyAvailable, false); assert.equal(gmRow.useAvailable, false);
  checked.push("player-safe applied and expired history renders target-resolution and round-end lifecycle labels while expired controls remain false");

  const blockedFinalizationRow = pendingRecord(baseSession(), { state: "pending" }); const blocked = finalizeTravelV2RoundOnRunnerSession(sessionWithRows([blockedFinalizationRow]), { now: NOW }); assert.equal(blocked.ok, false); assert.equal(blocked.session.travelV2PendingStationBenefits[0].status, "pending");
  checked.push("blocked finalization performs no cleanup");

  const roundRows = [pendingRecord(baseSession({ expires: "afterUse" }), { expires: "afterUse" }), pendingRecord(baseSession({ expires: "endOfRound" }), { expires: "endOfRound" }), ...unrelatedRows()];
  const finalized = finalizeTravelV2RoundOnRunnerSession(finalizableSession(roundRows), { now: NOW }); assert.equal(finalized.ok, true); assert.equal(finalized.expiredInterStationHelpCount, 2); assert.equal(finalized.session.travelV2PendingStationBenefits[0].status, "expired"); assert.equal(finalized.session.travelV2PendingStationBenefits[1].status, "expired"); assertUnrelatedPreserved(roundRows.slice(2), finalized.session.travelV2PendingStationBenefits, 2); assert.equal(Object.hasOwn(finalized.interStationHelpExpiration, "session"), false); assert.equal(Object.hasOwn(finalized.interStationHelpExpiration, "nextSession"), false);
  checked.push("successful finalization returns cleaned session with compact expiration summary and no duplicated session copies");

  console.log(`travel-v2-inter-station-help-expiration smoke passed (${checked.length} groups)`);
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) runTravelV2InterStationHelpExpirationSmokeChecks().catch((error) => { console.error(error); process.exitCode = 1; });
