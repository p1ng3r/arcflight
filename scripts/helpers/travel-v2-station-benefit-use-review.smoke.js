import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, normalizeTravelV2StationBenefitUseReviewInput, prepareTravelV2StationBenefitDisplayRows, prepareTravelV2StationBenefitUseReviewPlayerState, prepareTravelV2StationBenefitUseReviewGmState, applyTravelV2StationBenefitUseReviewToRenderState, prepareTravelV2StationBenefitUseRunnerUpdate } from "./travel-v2-station-benefit-use-review.js";

const json = (value) => JSON.stringify(value);
const forbidden = ["gmText", "gmSummary", "gmMechanicalNotes", "gmReview", "applyPayload", "queueInternals", "targetActorId", "targetActorUuid", "internalMutation"];
const assertPlayerSafe = (value) => { const text = json(value); for (const key of forbidden) assert.equal(text.includes(key), false, `player-safe output leaked ${key}`); };


function helpSession(overrides = {}) {
  return {
    key: "session-1",
    currentRoundIndex: 0,
    pressure: 2,
    event: { rounds: [{ roundNumber: 1, activeStations: ["helm", "engineer"], stationPrompts: { helm: { stationName: "Helm" }, engineer: { stationName: "Engineer" } } }] },
    roundResults: [{ stationResults: { helm: "success" }, stationActions: { helm: { type: "eventApproach", skill: "piloting", dc: 18 }, engineer: { type: "eventApproach", skill: "crafting", dc: 20 } } }],
    travelV2RoundActionOrder: { rounds: { 0: { locked: true, order: ["helm", "engineer"] } } },
    travelV2SupportRecords: { records: [] },
    travelV2PendingStationBenefits: [
      { queueKey: "help-1", pendingHelpKey: "inter-station-help:0:boost:helm:engineer", dedupeKey: "inter-station-help:0:boost:helm:engineer", title: "Boost Engineer", publicText: "Helm opens a line.", sourceStationKey: "helm", sourceStationName: "Helm", targetStationKey: "engineer", targetStationName: "Engineer", roundIndex: 0, roundNumber: 1, resultBand: "success", benefitKind: "stationOrderOpening", magnitude: 2, status: "pending", applied: false, consumed: false, criticalSuccess: false },
      { queueKey: "other-1", title: "Other", sourceStationKey: "helm", targetStationKey: "engineer", roundIndex: 0, status: "pending", applied: false }
    ],
    ...overrides
  };
}

function fixture(status = "pending") {
  return { stations: [{ stationKey: "navigator", stationName: "Navigator" }, { stationKey: "engineer", label: "Engineer" }], travelV2PendingStationBenefitQueue: { rows: [{ queueKey: "benefit-1", title: "Clear Shot", sourceStation: "navigator", targetStation: "engineer", benefitKind: "dcReduction", magnitude: 2, expires: "afterUse", status, publicText: "Engineer gets an opening.", playerSafeSummary: "Reduce one Engineer DC.", gmText: "secret", gmSummary: "hidden", gmMechanicalNotes: { applyPayload: { bad: true } }, applyPayload: { bad: true }, queueInternals: { bad: true } }] } };
}

export default async function runTravelV2StationBenefitUseReviewSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, 1);
  for (const fn of [normalizeTravelV2StationBenefitUseReviewInput, prepareTravelV2StationBenefitDisplayRows, prepareTravelV2StationBenefitUseReviewPlayerState, prepareTravelV2StationBenefitUseReviewGmState, applyTravelV2StationBenefitUseReviewToRenderState, prepareTravelV2StationBenefitUseRunnerUpdate]) assert.equal(typeof fn, "function");
  checked.push("imports and version are available");

  const empty = prepareTravelV2StationBenefitUseReviewPlayerState({}, { user: { isGM: false } });
  assert.equal(empty.status, "empty");
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.selectedCandidate.status, "blocked");
  assertPlayerSafe(empty);
  checked.push("empty input returns safe empty display and blocked selection state");

  const rows = prepareTravelV2StationBenefitDisplayRows(fixture());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceStationLabel, "Navigator");
  assert.equal(rows[0].targetStationLabel, "Engineer");
  assert.equal(rows[0].canReview, true);
  assertPlayerSafe(rows);
  checked.push("display rows are prepared from PR #351 pending queue state");

  const selectedWithoutRequest = prepareTravelV2StationBenefitUseReviewPlayerState(fixture(), { selectedPendingBenefitQueueKey: "benefit-1" });
  assert.equal(selectedWithoutRequest.selectedCandidate.status, "blocked");
  assert.equal(selectedWithoutRequest.selectedCandidate.ready, false);
  assert.match(selectedWithoutRequest.selectedCandidate.reason, /No station benefit use review was requested/);
  checked.push("selected queue key without explicit request stays blocked");

  const ready = prepareTravelV2StationBenefitUseReviewPlayerState(fixture(), { selectedPendingBenefitQueueKey: "benefit-1", travelV2StationBenefitUseReviewRequested: true });
  assert.equal(ready.selectedCandidate.status, "ready");
  assert.equal(ready.selectedCandidate.candidate.reviewOnly, true);
  assert.equal(ready.selectedCandidate.useAvailable, false);
  checked.push("valid pending selected row plus explicit request becomes ready review-only candidate");

  for (const status of ["used", "dismissed", "expired", "blocked"]) {
    const blocked = prepareTravelV2StationBenefitUseReviewPlayerState(fixture(status), { selectedQueueKey: "benefit-1", travelV2StationBenefitUseReviewRequested: true });
    assert.equal(blocked.selectedCandidate.status, "blocked");
    assert.match(blocked.selectedCandidate.reason, new RegExp(status));
  }
  const unknown = prepareTravelV2StationBenefitUseReviewPlayerState(fixture(), { selectedQueueKey: "missing", travelV2StationBenefitUseReviewRequested: true });
  assert.equal(unknown.selectedCandidate.status, "blocked");
  const hidden = prepareTravelV2StationBenefitUseReviewPlayerState({ pendingStationBenefits: [{ ...fixture().travelV2PendingStationBenefitQueue.rows[0], hidden: true }] }, { selectedQueueKey: "benefit-1", travelV2StationBenefitUseReviewRequested: true });
  assert.equal(hidden.selectedCandidate.status, "blocked");
  assert.match(hidden.selectedCandidate.reason, /hidden/);
  const malformed = prepareTravelV2StationBenefitUseReviewPlayerState({ pendingStationBenefits: [{}] }, { selectedQueueKey: "none:none:none:none:none:unknown:0", travelV2StationBenefitUseReviewRequested: true });
  assert.equal(malformed.selectedCandidate.status, "blocked");
  checked.push("invalid selections block safely for missing, unknown, hidden, malformed, used, dismissed, expired, and non-pending rows");

  assertPlayerSafe(ready);
  ready.rows[0].title = "Mutated";
  assert.equal(fixture().travelV2PendingStationBenefitQueue.rows[0].title, "Clear Shot");
  checked.push("player-safe redaction and clone safety are enforced");

  const gmNoFlag = prepareTravelV2StationBenefitUseReviewGmState(fixture(), { user: { isGM: true }, selectedQueueKey: "benefit-1" });
  assert.equal(gmNoFlag.gmReview, undefined);
  const gmWithGenericIncludeOnly = prepareTravelV2StationBenefitUseReviewGmState(fixture(), { user: { isGM: true }, selectedQueueKey: "benefit-1", includeGmReview: true });
  assert.equal(gmWithGenericIncludeOnly.gmReview, undefined);
  const gmWithRequestNoVisibility = prepareTravelV2StationBenefitUseReviewGmState(fixture(), { user: { isGM: true }, selectedQueueKey: "benefit-1", travelV2StationBenefitUseReviewRequested: true });
  assert.equal(gmWithRequestNoVisibility.gmReview, undefined);
  const gmWithFlag = prepareTravelV2StationBenefitUseReviewGmState(fixture(), { user: { isGM: true }, selectedQueueKey: "benefit-1", includeGmReview: true, travelV2StationBenefitUseReviewRequested: true });
  assert.equal(gmWithFlag.gmReview.selectedRow.queueKey, "benefit-1");
  const nonGm = prepareTravelV2StationBenefitUseReviewGmState(fixture(), { user: { isGM: false }, selectedQueueKey: "benefit-1", includeGmReview: true, travelV2StationBenefitUseReviewRequested: true });
  assert.equal(nonGm.gmReview, undefined);
  checked.push("GM review state requires GM-like user, visibility permission, and explicit station-benefit review flag");

  const renderState = { marker: { ok: true }, ...fixture() };
  const before = json(renderState);
  const genericGmRender = applyTravelV2StationBenefitUseReviewToRenderState(renderState, { selectedQueueKey: "benefit-1" }, { user: { isGM: true }, includeGmReview: true });
  assert.equal(genericGmRender.travelV2StationBenefitUseReview, undefined);
  const applied = applyTravelV2StationBenefitUseReviewToRenderState(renderState, { selectedQueueKey: "benefit-1", travelV2StationBenefitUseReviewRequested: true }, { user: { isGM: true }, includeGmReview: true });
  assert.equal(json(renderState), before);
  assert.equal(applied.travelV2StationBenefitUseReviewPlayerState.selectedCandidate.status, "ready");
  assert.equal(applied.travelV2StationBenefitUseReview.gmReview.selectedQueueKey, "benefit-1");
  const playerApplied = applyTravelV2StationBenefitUseReviewToRenderState({ travelV2StationBenefitUseReview: { gmReview: true }, ...fixture() }, { selectedQueueKey: "benefit-1" }, { user: { isGM: false } });
  assert.equal(playerApplied.travelV2StationBenefitUseReview, undefined);
  assertPlayerSafe(playerApplied);
  checked.push("render-state integration preserves clone safety and hides GM state from players");


  const canonicalSession = helpSession();
  const canonicalBefore = json(canonicalSession);
  const reviewReady = prepareTravelV2StationBenefitUseReviewPlayerState({ session: canonicalSession }, { selectedQueueKey: "help-1", travelV2StationBenefitUseReviewRequested: true });
  assert.equal(reviewReady.selectedCandidate.ready, true);
  assert.equal(reviewReady.selectedCandidate.useAvailable, true);
  const noIntent = prepareTravelV2StationBenefitUseRunnerUpdate(canonicalSession, { queueKey: "help-1" }, { canUse: true });
  assert.equal(noIntent.shouldAdoptSession, false);
  assert.match(noIntent.status.blockedReasons.join(" "), /explicit-use-request-required/);
  const nonGmUse = prepareTravelV2StationBenefitUseRunnerUpdate(canonicalSession, { queueKey: "help-1" }, { useRequested: true });
  assert.equal(nonGmUse.shouldAdoptSession, false);
  assert.match(nonGmUse.status.blockedReasons.join(" "), /gm-use-permission-required/);
  const used = prepareTravelV2StationBenefitUseRunnerUpdate(canonicalSession, { queueKey: "help-1", status: "dismissed", sourceStationKey: "spoof", targetStationKey: "spoof", roundIndex: 99, resultBand: "criticalSuccess", title: "spoof" }, { canUse: true, useRequested: true, applyRequested: true });
  assert.equal(used.ok, true);
  assert.equal(used.shouldAdoptSession, true);
  assert.notEqual(used.nextSession, canonicalSession);
  assert.equal(json(canonicalSession), canonicalBefore);
  const usedRecord = used.nextSession.travelV2PendingStationBenefits[0];
  assert.equal(usedRecord.status, "used");
  assert.equal(usedRecord.used, true);
  assert.equal(usedRecord.consumed, true);
  assert.equal(usedRecord.applied, false);
  assert.equal(usedRecord.queueKey, "help-1");
  assert.equal(usedRecord.dedupeKey, "inter-station-help:0:boost:helm:engineer");
  assert.deepEqual(used.nextSession.travelV2PendingStationBenefits[1], canonicalSession.travelV2PendingStationBenefits[1]);
  assert.equal(used.nextSession.roundResults[0].stationResults.engineer, undefined);
  assert.equal(used.nextSession.roundResults[0].stationActions.engineer.skill, "crafting");
  assert.equal(used.nextSession.roundResults[0].stationActions.engineer.dc, 20);
  assert.equal(used.nextSession.pressure, 2);
  assert.deepEqual(used.nextSession.travelV2SupportRecords, { records: [] });
  assert.equal(json(used.status).includes("nextSession"), false);
  assertPlayerSafe(used.status);
  const afterRows = prepareTravelV2StationBenefitDisplayRows({ session: used.nextSession });
  assert.equal(afterRows.find((row) => row.queueKey === "help-1").status, "used");
  const duplicate = prepareTravelV2StationBenefitUseRunnerUpdate(used.nextSession, { queueKey: "help-1" }, { canUse: true, useRequested: true });
  assert.equal(duplicate.shouldAdoptSession, false);
  assert.equal(json(duplicate.nextSession), json(used.nextSession));
  checked.push("explicit GM Inter-Station Help use consumes only the selected raw queue record without mechanical application and blocks duplicate use");

  for (const [label, mutated] of [
    ["stale-round", helpSession({ currentRoundIndex: 1 })],
    ["malformed-round", helpSession({ travelV2PendingStationBenefits: [{ ...helpSession().travelV2PendingStationBenefits[0], roundIndex: " " }] })],
    ["target-resolved", helpSession({ roundResults: [{ stationResults: { helm: "success", engineer: "success" }, stationActions: helpSession().roundResults[0].stationActions }] })],
    ["source-failed", helpSession({ roundResults: [{ stationResults: { helm: "failure" }, stationActions: helpSession().roundResults[0].stationActions }] })],
    ["source-after-target", helpSession({ travelV2RoundActionOrder: { rounds: { 0: { locked: true, order: ["engineer", "helm"] } } } })],
    ["self-target", helpSession({ travelV2PendingStationBenefits: [{ ...helpSession().travelV2PendingStationBenefits[0], targetStationKey: "helm" }] })],
    ["unlocked-order", helpSession({ travelV2RoundActionOrder: { rounds: { 0: { locked: false, order: ["helm", "engineer"] } } } })],
    ["missing-key", helpSession()],
    ["unknown-key", helpSession()],
    ["dismissed", helpSession({ travelV2PendingStationBenefits: [{ ...helpSession().travelV2PendingStationBenefits[0], status: "dismissed" }] })],
    ["expired", helpSession({ travelV2PendingStationBenefits: [{ ...helpSession().travelV2PendingStationBenefits[0], status: "expired" }] })],
    ["blocked", helpSession({ travelV2PendingStationBenefits: [{ ...helpSession().travelV2PendingStationBenefits[0], status: "blocked" }] })]
  ]) {
    const key = label === "missing-key" ? "" : (label === "unknown-key" ? "missing" : "help-1");
    const result = prepareTravelV2StationBenefitUseRunnerUpdate(mutated, { queueKey: key }, { canUse: true, useRequested: true });
    assert.equal(result.shouldAdoptSession, false, label);
    assert.equal(json(result.nextSession), json(mutated), label);
  }
  checked.push("stale, malformed, resolved, ordering, status, missing, and unknown queue states block without adoption");

  const source = readFileSync(new URL("./travel-v2-station-benefit-use-review.js", import.meta.url), "utf8");
  for (const forbiddenCall of [".setFlag(", ".update(", ".create(", ".delete(", "ChatMessage", "JournalEntry", "Scene", "TokenDocument", "Combat", "game.settings.set", "socket.emit"]) assert.equal(source.includes(forbiddenCall), false, `helper contains forbidden runtime write call ${forbiddenCall}`);
  const aggregate = readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assert.equal(aggregate.includes("runTravelV2StationBenefitUseReviewSmokeChecks"), true);
  checked.push("source scan finds no obvious runtime writes and aggregate runner includes this suite");

  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2StationBenefitUseReviewSmokeChecks().then((result) => { console.log("Travel v2 station benefit use review smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
