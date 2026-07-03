import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } from "./travel-v2-hazard-deck-registry.js";
import { getTravelV2GoldStandardHazardCards } from "../../data/travel-events/travel-v2-gold-standard-hazard-cards.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import { prepareTravelV2HazardDrawReviewState } from "./travel-v2-hazard-draw-review.js";
import {
  TRAVEL_V2_ACTIVE_HAZARD_HANDOFF_REVIEW_VERSION,
  normalizeTravelV2ActiveHazardHandoffReviewRequest,
  validateTravelV2ActiveHazardHandoffReviewRequest,
  prepareTravelV2ActiveHazardHandoffCandidate,
  prepareTravelV2ActiveHazardHandoffPlayerSafeState,
  prepareTravelV2ActiveHazardHandoffGmReviewState,
  applyTravelV2ActiveHazardHandoffReviewToRenderState
} from "./travel-v2-active-hazard-handoff-review.js";

const FORBIDDEN = ["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"];
const MUTATION_CALLS = ["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"];
function json(value) { return JSON.stringify(value); }
function hasKey(value, key) {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, key)) return true;
  return Object.values(value).some((entry) => Array.isArray(entry) ? entry.some((item) => hasKey(item, key)) : hasKey(entry, key));
}
function assertNoForbidden(value, label) { for (const key of FORBIDDEN) assert.equal(hasKey(value, key), false, `${label} must not include ${key}`); }

export default async function runTravelV2ActiveHazardHandoffReviewSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_ACTIVE_HAZARD_HANDOFF_REVIEW_VERSION, 1);
  assert.equal(typeof normalizeTravelV2ActiveHazardHandoffReviewRequest, "function");
  assert.equal(typeof validateTravelV2ActiveHazardHandoffReviewRequest, "function");
  assert.equal(typeof prepareTravelV2ActiveHazardHandoffCandidate, "function");
  assert.equal(typeof prepareTravelV2ActiveHazardHandoffPlayerSafeState, "function");
  assert.equal(typeof prepareTravelV2ActiveHazardHandoffGmReviewState, "function");
  assert.equal(typeof applyTravelV2ActiveHazardHandoffReviewToRenderState, "function");
  checked.push("helper imports");

  const cards = getTravelV2GoldStandardHazardCards();
  const user = { isGM: true };
  const drawInput = { selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, drawMode: "top", user };
  const draw = prepareTravelV2HazardDrawReviewState(drawInput, { user, includeGmReview: true });
  const missingRequest = prepareTravelV2ActiveHazardHandoffCandidate({ travelV2HazardDrawReview: draw, user }, { user });
  assert.equal(missingRequest.status, "blocked");
  assert.equal(missingRequest.isHandoffCandidate, false);
  checked.push("missing handoff request does not create a candidate");

  const missingDraw = prepareTravelV2ActiveHazardHandoffCandidate({ travelV2ActiveHazardHandoffReviewRequested: true, user }, { user });
  assert.notEqual(missingDraw.status, "handoff-candidate");
  const invalidDraw = prepareTravelV2ActiveHazardHandoffCandidate({ travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardDrawReview: { status: "invalid", isCandidate: false, disabledReason: "bad" }, user }, { user });
  assert.equal(invalidDraw.status, "invalid");
  checked.push("invalid or missing draw candidate blocks handoff");

  const handoff = prepareTravelV2ActiveHazardHandoffGmReviewState({ travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardDrawReview: draw, user }, { user, includeGmReview: true });
  assert.equal(handoff.status, "handoff-candidate");
  assert.equal(handoff.isHandoffCandidate, true);
  assert.equal(handoff.cardId, cards[0].id);
  assert.equal(handoff.proposedActiveHazard.reviewOnly, true);
  assert.equal(handoff.proposedActiveHazard.persisted, false);
  assert.equal(handoff.proposedActiveHazard.active, false);
  assert.equal(handoff.proposedActiveHazard.lifecycleStatus, "candidate");
  assert.equal(handoff.proposedActiveHazard.title, cards[0].title);
  assert.equal(handoff.proposedActiveHazard.playerSafeSummary, cards[0].playerSafeSummary);
  assert.deepEqual(Object.keys(handoff.proposedActiveHazard.stationImpacts), Object.keys(cards[0].stationImpacts));
  assert.equal(handoff.proposedActiveHazard.responseActions.length, cards[0].responseActions.length);
  assert.equal(handoff.proposedActiveHazard.clearCondition.neededProgress, cards[0].clearCondition.neededProgress);
  assert.deepEqual(handoff.proposedActiveHazard.unresolvedConsequenceRefs, cards[0].unresolvedConsequenceRefs);
  checked.push("GM explicit handoff creates review-only proposed active hazard record");

  const nonGm = prepareTravelV2ActiveHazardHandoffGmReviewState({ travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardDrawReview: draw, user: { isGM: false } }, { user: { isGM: false }, includeGmReview: true });
  assert.equal(nonGm.status, "blocked");
  assertNoForbidden(nonGm, "non-GM handoff");
  const safe = prepareTravelV2ActiveHazardHandoffPlayerSafeState({ travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardDrawReview: draw, user }, { user });
  assertNoForbidden(safe, "player-safe handoff");
  assert.equal(hasKey(handoff.gmReview, "gmText"), true);
  checked.push("GM review gating and player-safe redaction");

  for (const key of ["canActivate", "canHold", "canDismiss", "canApply", "canPersist"]) assert.equal(handoff[key], false);
  assert.equal(handoff.activeHazardMutation.available, false);
  assert.equal(handoff.consequenceApplication.available, false);
  checked.push("activation and application controls remain unavailable");

  const input = { travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardDrawReview: draw, user };
  const options = { user, includeGmReview: true };
  const renderState = { existing: { ok: true }, travelV2Hazards: { records: [] } };
  const beforeInput = json(input); const beforeOptions = json(options); const beforeRender = json(renderState);
  const applied = applyTravelV2ActiveHazardHandoffReviewToRenderState(renderState, input, options);
  assert.equal(json(input), beforeInput);
  assert.equal(json(options), beforeOptions);
  assert.equal(json(renderState), beforeRender);
  applied.travelV2ActiveHazardHandoffReview.proposedActiveHazard.title = "mutated";
  assert.notEqual(prepareTravelV2ActiveHazardHandoffCandidate(input, options).proposedActiveHazard.title, "mutated");
  checked.push("helpers do not mutate inputs and return clone-safe state");

  const noRequestApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user, uiState: { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, travelV2HazardDrawMode: "top" } });
  assert.equal(noRequestApp.travelV2ActiveHazardHandoffReview.status, "blocked");
  assert.equal(noRequestApp.travelV2ActiveHazardHandoffReview.isHandoffCandidate, false);
  const app = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user, uiState: { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, travelV2HazardDrawMode: "top", travelV2ActiveHazardHandoffReviewRequested: true } });
  assert.equal(app.travelV2ActiveHazardHandoffReview.status, "handoff-candidate");
  assert.equal((app.travelV2Hazards?.records ?? []).length, 0);
  const playerApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: false }, uiState: { travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardDrawRequested: true } });
  assertNoForbidden(playerApp, "non-GM app state");
  checked.push("app render-state integration is GM-only and inert");

  const source = readFileSync(new URL("./travel-v2-active-hazard-handoff-review.js", import.meta.url), "utf8") + readFileSync(new URL("../apps/travel-event-runner-v2-preview-consumer.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("source scan has no obvious persistence mutation calls");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2ActiveHazardHandoffReviewSmokeChecks().then((result) => {
    console.log("Travel v2 active hazard handoff review smoke checks passed.");
    for (const check of result.checked) console.log(`- ${check}`);
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}
