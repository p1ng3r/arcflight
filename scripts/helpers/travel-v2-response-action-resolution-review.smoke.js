import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } from "./travel-v2-hazard-deck-registry.js";
import { applyTravelV2ResponseActionWiringToRenderState } from "./travel-v2-response-action-wiring.js";
import { applyTravelV2StationImpactBehaviorToRenderState } from "./travel-v2-station-impact-behavior.js";
import {
  TRAVEL_V2_RESPONSE_ACTION_RESOLUTION_REVIEW_VERSION,
  normalizeTravelV2ResponseActionResolutionReviewRequest,
  validateTravelV2ResponseActionResolutionReviewRequest,
  prepareTravelV2ResponseActionResolutionReviewCandidate,
  prepareTravelV2ResponseActionResolutionPlayerState,
  prepareTravelV2ResponseActionResolutionGmState,
  applyTravelV2ResponseActionResolutionReviewToRenderState
} from "./travel-v2-response-action-resolution-review.js";

const FORBIDDEN = ["gmText", "gmSummary", "gmMechanicalNotes", "gmReview", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"];
const MUTATION_CALLS = ["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"];
function snap(value) { return JSON.stringify(value); }
function hasKey(value, key) { if (!value || typeof value !== "object") return false; if (Object.hasOwn(value, key)) return true; return Object.values(value).some((entry) => Array.isArray(entry) ? entry.some((item) => hasKey(item, key)) : hasKey(entry, key)); }
function assertNoForbidden(value, label) { for (const key of FORBIDDEN) assert.equal(hasKey(value, key), false, `${label} must not include ${key}`); }
function assertInert(candidate) { for (const [key, value] of Object.entries({ reviewOnly: true, resolutionCandidate: true, executable: false, executed: false, rollRequested: false, rollResolved: false, outcomeApplied: false, stationModifierApplied: false, stationResultMutated: false, clearProgressApplied: false, hazardResolved: false, consequencesApplied: false })) assert.equal(candidate[key], value, `${key} mismatch`); assert.equal(candidate.persistentMutation.available, false); }
function lifecycle(status = "active") { return { activeHazards: status === "active" ? [{ status: "active", isActive: true, playerVisible: true, cardId: "void-shear", title: "Void Shear", responseActionsPreview: { actions: [{ id: "brace", title: "Brace", publicText: "Brace for the shear.", stationKeys: ["navigator"], gmText: "GM ONLY", applyPayload: { secret: true } }] }, stationImpactsPreview: [{ stationKey: "navigator", publicText: "Navigator checks may matter.", gmText: "Secret DC note" }] }] : [], heldHazards: status === "held" ? [{ status: "held", isActive: false, cardId: "held", title: "Held", responseActionsPreview: { actions: [{ id: "brace", title: "Brace" }] } }] : [], dismissedHazards: status === "dismissed" ? [{ status: "dismissed", isActive: false, cardId: "dismissed", title: "Dismissed", responseActionsPreview: { actions: [{ id: "brace", title: "Brace" }] } }] : [] }; }
function reviewInput(user = { isGM: true }) { let state = { travelV2ActiveHazardLifecycleDisplay: lifecycle("active"), stations: [{ stationKey: "navigator", stationName: "Navigator" }] }; state = applyTravelV2ResponseActionWiringToRenderState(state, { user }, { user, includeGmReview: true }); state = applyTravelV2StationImpactBehaviorToRenderState(state, { user, stations: state.stations }, { user, includeGmReview: true }); return { ...state, travelV2ResponseActionResolutionRequested: true, travelV2ResponseActionSelectedActionId: "brace", travelV2ResponseActionSelectedHazardCardId: "void-shear" }; }

export default async function runTravelV2ResponseActionResolutionReviewSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_RESPONSE_ACTION_RESOLUTION_REVIEW_VERSION, 1);
  for (const fn of [normalizeTravelV2ResponseActionResolutionReviewRequest, validateTravelV2ResponseActionResolutionReviewRequest, prepareTravelV2ResponseActionResolutionReviewCandidate, prepareTravelV2ResponseActionResolutionPlayerState, prepareTravelV2ResponseActionResolutionGmState, applyTravelV2ResponseActionResolutionReviewToRenderState]) assert.equal(typeof fn, "function");
  checked.push("helper imports");

  const empty = prepareTravelV2ResponseActionResolutionPlayerState({}, { user: { isGM: false } });
  assert.equal(empty.status, "empty");
  assert.notEqual(empty.status, "ready");
  checked.push("missing or empty wiring and missing explicit request returns empty/blocked state");

  const noRequest = prepareTravelV2ResponseActionResolutionReviewCandidate({ ...reviewInput(), travelV2ResponseActionResolutionRequested: false }, { user: { isGM: true } });
  assert.equal(noRequest.status, "empty");
  checked.push("missing explicit request does not create ready candidate");

  const candidate = prepareTravelV2ResponseActionResolutionReviewCandidate(reviewInput(), { user: { isGM: true }, includeGmReview: false });
  assert.equal(candidate.status, "ready");
  assert.equal(candidate.selectedActionId, "brace");
  assert.equal(candidate.hazardTitle, "Void Shear");
  assertInert(candidate);
  assert.equal(candidate.relatedStationImpacts.length, 1);
  checked.push("selected valid action creates inert ready review candidate with station guidance");

  const unknown = prepareTravelV2ResponseActionResolutionReviewCandidate({ ...reviewInput(), travelV2ResponseActionSelectedActionId: "missing" }, { user: { isGM: true } });
  assert.equal(unknown.status, "invalid");
  checked.push("unknown selected action id returns invalid/blocked and no ready candidate");

  const heldState = applyTravelV2ResponseActionWiringToRenderState({ travelV2ActiveHazardLifecycleDisplay: lifecycle("held") }, { user: { isGM: false } }, { user: { isGM: false } });
  assert.notEqual(prepareTravelV2ResponseActionResolutionPlayerState({ ...heldState, travelV2ResponseActionResolutionRequested: true, travelV2ResponseActionSelectedActionId: "brace" }).status, "ready");
  checked.push("held/dismissed/no active actions cannot produce ready candidate");

  const playerState = prepareTravelV2ResponseActionResolutionPlayerState(reviewInput({ isGM: false }), { user: { isGM: false } });
  assert.equal(playerState.status, "ready");
  assertNoForbidden(playerState, "player-safe output");
  const gmNoReview = prepareTravelV2ResponseActionResolutionGmState(reviewInput(), { user: { isGM: true }, includeGmReview: false });
  assert.equal(hasKey(gmNoReview, "gmReview"), false);
  const gmReview = prepareTravelV2ResponseActionResolutionGmState(reviewInput(), { user: { isGM: true }, includeGmReview: true });
  assert.equal(hasKey(gmReview, "gmReview"), true);
  assert.equal(snap(gmReview).includes("GM ONLY"), true);
  checked.push("player redaction and GM review gating work");

  const input = reviewInput(); const options = { user: { isGM: true }, includeGmReview: true }; const renderState = { marker: { ok: true }, ...reviewInput() };
  const before = [snap(input), snap(options), snap(renderState)];
  const applied = applyTravelV2ResponseActionResolutionReviewToRenderState(renderState, input, options);
  assert.deepEqual([snap(input), snap(options), snap(renderState)], before);
  applied.travelV2ResponseActionResolutionPlayerState.actionTitle = "mutated";
  assert.equal(prepareTravelV2ResponseActionResolutionPlayerState(input, options).actionTitle, "Brace");
  checked.push("helper does not mutate input/options/renderState and returns clone-safe state");

  const uiState = { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, travelV2HazardDrawMode: "top", travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate", travelV2ResponseActionResolutionRequested: true, travelV2ResponseActionSelectedActionId: "brace" };
  const gmApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: true }, uiState });
  assert.ok(gmApp.travelV2ResponseActionResolutionReview);
  const action = gmApp.travelV2ResponseActionPlayerState.availableActions[0];
  const playerApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: false }, uiState: { travelV2HazardCandidateControlResult: { status: "active", activeHazard: lifecycle("active").activeHazards[0] }, travelV2ResponseActionResolutionRequested: true, travelV2ResponseActionSelectedActionId: action?.actionId ?? "brace" } });
  assert.ok(playerApp.travelV2ResponseActionResolutionPlayerState);
  assert.equal(hasKey(playerApp, "travelV2ResponseActionResolutionReview"), false);
  assertNoForbidden(playerApp, "non-GM app state");
  checked.push("app render-state integration exposes GM review and player-safe state without leaks");

  const source = readFileSync(new URL("./travel-v2-response-action-resolution-review.js", import.meta.url), "utf8") + readFileSync(new URL("../apps/travel-event-runner-v2-preview-consumer.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("source scan has no obvious persistent mutation calls");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2ResponseActionResolutionReviewSmokeChecks().then((result) => { console.log("Travel v2 response action resolution review smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
