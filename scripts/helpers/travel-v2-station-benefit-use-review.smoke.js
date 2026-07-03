import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, normalizeTravelV2StationBenefitUseReviewInput, prepareTravelV2StationBenefitDisplayRows, prepareTravelV2StationBenefitUseReviewPlayerState, prepareTravelV2StationBenefitUseReviewGmState, applyTravelV2StationBenefitUseReviewToRenderState } from "./travel-v2-station-benefit-use-review.js";

const json = (value) => JSON.stringify(value);
const forbidden = ["gmText", "gmSummary", "gmMechanicalNotes", "gmReview", "applyPayload", "queueInternals", "targetActorId", "targetActorUuid", "internalMutation"];
const assertPlayerSafe = (value) => { const text = json(value); for (const key of forbidden) assert.equal(text.includes(key), false, `player-safe output leaked ${key}`); };

function fixture(status = "pending") {
  return { stations: [{ stationKey: "navigator", stationName: "Navigator" }, { stationKey: "engineer", label: "Engineer" }], travelV2PendingStationBenefitQueue: { rows: [{ queueKey: "benefit-1", title: "Clear Shot", sourceStation: "navigator", targetStation: "engineer", benefitKind: "dcReduction", magnitude: 2, expires: "afterUse", status, publicText: "Engineer gets an opening.", playerSafeSummary: "Reduce one Engineer DC.", gmText: "secret", gmSummary: "hidden", gmMechanicalNotes: { applyPayload: { bad: true } }, applyPayload: { bad: true }, queueInternals: { bad: true } }] } };
}

export default async function runTravelV2StationBenefitUseReviewSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, 1);
  for (const fn of [normalizeTravelV2StationBenefitUseReviewInput, prepareTravelV2StationBenefitDisplayRows, prepareTravelV2StationBenefitUseReviewPlayerState, prepareTravelV2StationBenefitUseReviewGmState, applyTravelV2StationBenefitUseReviewToRenderState]) assert.equal(typeof fn, "function");
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
