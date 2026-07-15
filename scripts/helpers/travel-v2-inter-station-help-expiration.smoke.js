import assert from "node:assert/strict";
import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { applyTravelV2InterStationHelpExpirationToSession, prepareTravelV2InterStationHelpExpiration, TRAVEL_V2_INTER_STATION_HELP_EXPIRATION_VERSION } from "./travel-v2-inter-station-help-expiration.js";
import { prepareTravelV2PendingStationBenefitPlayerState, prepareTravelV2PendingStationBenefitGmState } from "./travel-v2-pending-station-benefit-queue.js";
import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";
import { prepareTravelV2InterStationHelpPendingRecord } from "./travel-v2-inter-station-help-pending-records.js";
import { applyTravelV2InterStationHelpApplicationToSession, prepareTravelV2InterStationHelpCheckAdjustment } from "./travel-v2-inter-station-help-application.js";
import { finalizeTravelV2RoundOnRunnerSession, resolveTravelV2StationRollWithPendingEffects } from "./travel-v2-session-round-finalization.js";

const NOW = "2026-07-15T12:00:00.000Z";
const snap = (v) => JSON.stringify(v);
function assertNoAdjustment(session, label, stationKey = "engineer") { const adjustment = prepareTravelV2InterStationHelpCheckAdjustment(session, { roundIndex: 0, stationKey }); assert.equal(adjustment.dcReduction, 0, label); assert.equal(adjustment.hasAdjustment, false, label); }
function assertAdjustment(session, expected, label, stationKey = "engineer") { const adjustment = prepareTravelV2InterStationHelpCheckAdjustment(session, { roundIndex: 0, stationKey }); assert.equal(adjustment.dcReduction, expected, label); assert.equal(adjustment.hasAdjustment, expected > 0, label); }

function baseSession({ result = "success", expires = "afterUse", critical = false, criticalMetadata = { strengthening: "replaceMagnitude", benefitKind: "dcReduction", magnitude: 4 } } = {}) {
  const helpAction = { id: "open-engine-feed", targetStationKey: "engineer", title: "Open the Engine Feed", publicText: "Navigator steadies Engineering.", benefit: { kind: "dcReduction", magnitude: 2, expires }, criticalSuccessMetadata: criticalMetadata };
  return {
    status: "active",
    currentRoundIndex: 0,
    event: { baseDC: 20, rounds: [{ roundNumber: 1, activeStations: ["captain", "navigator", "engineer", "watchmaster", "veilwarden"], stationOrder: ["captain", "navigator", "engineer", "watchmaster", "veilwarden"], stationPrompts: { captain: { stationName: "Captain" }, navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer", dcModifier: 1 }, watchmaster: { stationName: "Watchmaster" }, veilwarden: { stationName: "Veilwarden" } }, stationCards: [{ stationKey: "navigator", interStationHelp: [helpAction] }] }] },
    roundResults: [{ roundIndex: 0, stationResults: { captain: "success", navigator: result, engineer: null, watchmaster: null, veilwarden: null }, stationActions: { captain: { actionKey: "eventApproach", label: "Event Approach" }, navigator: { actionKey: "eventApproach", label: "Event Approach" }, engineer: { actionKey: "eventApproach", label: "Event Approach" }, watchmaster: { actionKey: "eventApproach", label: "Event Approach" }, veilwarden: { actionKey: "eventApproach", label: "Event Approach" } }, stationOrderCommitments: { captain: { committed: true }, navigator: { committed: true }, engineer: { committed: true }, watchmaster: { committed: true }, veilwarden: { committed: true } } }]
  };
}
function pendingRecord(session, { state = "pending", target = "engineer", roundIndex = 0, expires = null } = {}) {
  const action = prepareTravelV2InterStationHelpActions(session, { includeUnavailable: true }).helpActions.find((row) => row.actionId === "open-engine-feed");
  const prepared = prepareTravelV2InterStationHelpPendingRecord(session, { ...action, targetStationKey: target, expires: expires ?? action.expires }, { result: session.roundResults[0].stationResults.navigator, roundIndex: 0, sourceStationKey: "navigator", targetStationKey: target, actionId: "open-engine-feed" });
  const record = prepared.record ?? { pendingHelpKey: `inter-station-help:0:open-engine-feed:navigator:${target}`, actionId: "open-engine-feed", authoredActionId: "open-engine-feed", sourceStationKey: "navigator", sourceStationName: "Navigator", targetStationKey: target, targetStationName: target, benefitKind: "dcReduction", magnitude: 2, expires: expires ?? action.expires, status: "pending", roundIndex: 0, roundNumber: 1 };
  const row = { ...record, queueKey: `${record.pendingHelpKey}:${target}:${roundIndex}:${state}`, targetStationKey: target, roundIndex, roundNumber: roundIndex + 1, expires: expires ?? record.expires };
  if (state === "used" || state === "applied") Object.assign(row, { status: "used", used: true, consumed: true });
  if (state === "applied") Object.assign(row, { applied: true, applicationKey: `inter-station-help-application:${row.queueKey}`, appliedAt: NOW });
  if (state === "dismissed") Object.assign(row, { status: "dismissed", dismissed: true });
  if (state === "expired") Object.assign(row, { status: "expired", expired: true, expiredAt: "2026-07-14T00:00:00.000Z", expirationTrigger: "targetResolved", expirationReason: "target-result-recorded" });
  return row;
}
function sessionWithRecord(row, options = {}) { return { ...baseSession(options), travelV2PendingStationBenefits: [row], travelV2InterStationHelpApplications: { version: 2, records: [] } }; }
function usedSession(options = {}) { const session = baseSession(options); const row = pendingRecord(session, { state: "used", expires: options.expires }); return { ...session, travelV2PendingStationBenefits: [row] }; }
function applyValid(session = usedSession(), now = "2026-07-15T00:00:00.000Z") { return applyTravelV2InterStationHelpApplicationToSession(session, { queueKey: session.travelV2PendingStationBenefits[0].queueKey }, { canApply: true, applyRequested: true, now }).nextSession; }
function finalizableSession(row = null) {
  const stations = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
  const lockedRound = { stationActions: Object.fromEntries(stations.map((stationKey) => [stationKey, { actionKey: "eventApproach", label: "Event Approach" }])), stationOrderCommitments: Object.fromEntries(stations.map((stationKey) => [stationKey, { committed: true }])), stationResults: Object.fromEntries(stations.map((stationKey) => [stationKey, "success"])) };
  const s = { status: "active", currentRoundIndex: 0, event: { rounds: [{ number: 1, primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL, secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES, pressureStation: "engineer", activeStations: stations, stationSummary: { engineer: { outcomeKey: "mixed", pressure: 1 } } }] }, roundResults: [lockedRound] };
  s.travelV2PressureApplications = { records: [{ roundIndex: 0, roundNumber: 1, outcomeKey: "mixed", requestCount: 1 }] };
  if (row) s.travelV2PendingStationBenefits = [row];
  return s;
}

export default async function runTravelV2InterStationHelpExpirationSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_INTER_STATION_HELP_EXPIRATION_VERSION, 1);
  assert.equal(prepareTravelV2InterStationHelpExpiration({}, { trigger: "missing", roundIndex: 0 }).ok, false);
  checked.push("exports version and rejects unknown triggers");

  for (const state of ["pending", "used", "applied"]) {
    const row = pendingRecord(baseSession(), { state });
    const result = applyTravelV2InterStationHelpExpirationToSession(sessionWithRecord(row), { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW });
    assert.equal(result.expiredCount, 1, state); assert.equal(result.session.travelV2PendingStationBenefits[0].status, "expired", state); assert.equal(result.session.travelV2PendingStationBenefits[0].expirationReason, "target-result-recorded", state);
  }
  checked.push("target-resolution cleanup expires matching afterUse pending used and applied records");

  for (const row of [pendingRecord(baseSession(), { state: "applied", target: "watchmaster" }), pendingRecord(baseSession(), { state: "applied", roundIndex: 1 }), pendingRecord(baseSession({ expires: "endOfRound" }), { state: "applied", expires: "endOfRound" })]) {
    const before = snap(row); const result = applyTravelV2InterStationHelpExpirationToSession(sessionWithRecord(row), { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW });
    assert.equal(result.expiredCount, 0); assert.equal(snap(result.session.travelV2PendingStationBenefits[0]), before);
  }
  checked.push("target-resolution cleanup preserves other targets rounds and expiration modes");

  for (const expires of ["afterUse", "endOfRound"]) for (const state of ["pending", "applied"]) {
    const row = pendingRecord(baseSession({ expires }), { state, expires });
    const result = applyTravelV2InterStationHelpExpirationToSession(sessionWithRecord(row), { trigger: "roundFinalized", roundIndex: 0, roundNumber: 1, now: NOW });
    assert.equal(result.expiredCount, 1, `${expires}-${state}`); assert.equal(result.session.travelV2PendingStationBenefits[0].expirationReason, "round-finalized");
  }
  checked.push("round-finalization cleanup expires matching afterUse and endOfRound records");

  for (const expires of ["endOfEvent", "manual", "unknown"]) { const row = pendingRecord(baseSession({ expires }), { expires }); const before = snap(row); const result = applyTravelV2InterStationHelpExpirationToSession(sessionWithRecord(row), { trigger: "roundFinalized", roundIndex: 0, now: NOW }); assert.equal(result.expiredCount, 0, expires); assert.equal(snap(result.session.travelV2PendingStationBenefits[0]), before, expires); }
  for (const state of ["dismissed", "expired"]) { const row = pendingRecord(baseSession(), { state }); const before = snap(row); const result = applyTravelV2InterStationHelpExpirationToSession(sessionWithRecord(row), { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW }); assert.equal(result.expiredCount, 0, state); assert.equal(snap(result.session.travelV2PendingStationBenefits[0]), before, state); }
  checked.push("terminal and unsupported expiration records remain unchanged");

  const immutable = sessionWithRecord(pendingRecord(baseSession(), { state: "applied" })); immutable.travelV2InterStationHelpApplications = { records: [{ applicationKey: immutable.travelV2PendingStationBenefits[0].applicationKey, queueKey: immutable.travelV2PendingStationBenefits[0].queueKey, preserved: true }] };
  const before = snap(immutable); const once = applyTravelV2InterStationHelpExpirationToSession(immutable, { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW }); const twice = applyTravelV2InterStationHelpExpirationToSession(once.session, { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: "2026-07-16T00:00:00.000Z" });
  assert.equal(snap(immutable), before); assert.equal(twice.expiredCount, 0); assert.equal(twice.session.travelV2PendingStationBenefits[0].expiredAt, NOW); assert.deepEqual(twice.session.travelV2InterStationHelpApplications.records, immutable.travelV2InterStationHelpApplications.records);
  checked.push("cleanup is immutable idempotent preserves timestamps and application records");

  const appliedNormal = applyValid(usedSession()); assertAdjustment(appliedNormal, 2, "normal before"); const expiredNormal = applyTravelV2InterStationHelpExpirationToSession(appliedNormal, { trigger: "targetResolved", roundIndex: 0, targetStationKey: "engineer", now: NOW }).session; assertNoAdjustment(expiredNormal, "normal after");
  const legacy = JSON.parse(snap(appliedNormal)); legacy.travelV2InterStationHelpApplications.records[0] = { version: 1, applicationKey: legacy.travelV2PendingStationBenefits[0].applicationKey, queueKey: legacy.travelV2PendingStationBenefits[0].queueKey, pendingHelpKey: legacy.travelV2PendingStationBenefits[0].pendingHelpKey, actionId: "open-engine-feed", roundIndex: 0, targetStationKey: "engineer", sourceStationKey: "navigator", benefitKind: "dcReduction", magnitude: 2, status: "applied", applied: true }; assertAdjustment(legacy, 2, "legacy before"); assertNoAdjustment(applyTravelV2InterStationHelpExpirationToSession(legacy, { trigger: "roundFinalized", roundIndex: 0, now: NOW }).session, "legacy after");
  checked.push("applied version-1 and version-2 records contribute zero after expiration");

  const fallback = applyValid(usedSession({ result: "criticalSuccess", criticalMetadata: { strengthening: "automaticSuccess", benefitKind: "dcReduction", magnitude: 4 } })); assertAdjustment(fallback, 2, "fallback before");
  const strengthened = applyValid(usedSession({ result: "criticalSuccess" })); assertAdjustment(strengthened, 4, "strengthened before");
  checked.push("normal critical-fallback and strengthened applications remain valid before expiration");

  const display = prepareTravelV2PendingStationBenefitPlayerState({ session: expiredNormal }); const row = display.rows[0]; assert.equal(row.applicationStatusLabel, "Effect applied: DC −2"); assert.equal(row.expirationStatusLabel, "Expired after target resolution"); assert.equal(row.expired, true); assert.equal(row.expirationTrigger, "targetResolved");
  checked.push("player-safe lifecycle history preserves both applied and expired facts");

  const gmRow = prepareTravelV2PendingStationBenefitGmState({ session: expiredNormal }, { user: { isGM: true }, includeGmReview: true }).gmRows[0]; assert.equal(gmRow.canReviewEffect, false); assert.equal(gmRow.applyAvailable, false); assert.equal(gmRow.useAvailable, false);
  checked.push("non-GM and expired GM controls remain false");

  const blocked = finalizeTravelV2RoundOnRunnerSession(baseSession(), { now: NOW }); assert.equal(blocked.ok, false); assert.equal(blocked.session.travelV2PendingStationBenefits, undefined);
  checked.push("blocked finalization does not clean up Help");

  const roundRow = pendingRecord(baseSession({ expires: "endOfRound" }), { state: "applied", expires: "endOfRound" }); const finalized = finalizeTravelV2RoundOnRunnerSession(finalizableSession(roundRow), { now: NOW }); if (finalized.ok !== true) throw new Error(`finalization blocked: ${JSON.stringify(finalized.blockedReasons)}`); assert.equal(finalized.expiredInterStationHelpCount, 1); assert.equal(finalized.session.travelV2PendingStationBenefits[0].status, "expired");
  checked.push("successful finalization includes cleanup in the returned session");

  const rollSession = applyValid(usedSession()); const rolled = resolveTravelV2StationRollWithPendingEffects(rollSession, "engineer", { rawRollTotal: 18, dc: 20 }, { roundIndex: 0, now: NOW }); assert.equal(["criticalSuccess", "success", "failure", "criticalFailure", "skipped"].includes(rolled.session.roundResults[0].stationResults.engineer), true); assert.equal(rolled.session.travelV2PendingStationBenefits[0].status, "expired");
  checked.push("successful target result adoption includes target-resolution cleanup");

  console.log(`travel-v2-inter-station-help-expiration smoke passed (${checked.length} groups)`);
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) runTravelV2InterStationHelpExpirationSmokeChecks().catch((error) => { console.error(error); process.exitCode = 1; });
