import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } from "./travel-v2-hazard-deck-registry.js";
import { getTravelV2GoldStandardHazardCards } from "../../data/travel-events/travel-v2-gold-standard-hazard-cards.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import {
  TRAVEL_V2_HAZARD_DRAW_REVIEW_VERSION,
  normalizeTravelV2HazardDrawRequest,
  validateTravelV2HazardDrawRequest,
  prepareTravelV2HazardDrawCandidate,
  prepareTravelV2HazardDrawCandidatePlayerSafeState,
  prepareTravelV2HazardDrawCandidateGmReviewState,
  prepareTravelV2HazardDrawReviewState,
  applyTravelV2HazardDrawReviewToRenderState
} from "./travel-v2-hazard-draw-review.js";

const FORBIDDEN = ["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"];
const MUTATION_CALLS = ["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"];
function json(value) { return JSON.stringify(value); }
function hasKey(value, key) {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, key)) return true;
  return Object.values(value).some((entry) => Array.isArray(entry) ? entry.some((item) => hasKey(item, key)) : hasKey(entry, key));
}
function assertNoForbidden(value, label) { for (const key of FORBIDDEN) assert.equal(hasKey(value, key), false, `${label} must not include ${key}`); }

export default async function runTravelV2HazardDrawReviewSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_HAZARD_DRAW_REVIEW_VERSION, 1);
  assert.equal(typeof normalizeTravelV2HazardDrawRequest, "function");
  assert.equal(typeof validateTravelV2HazardDrawRequest, "function");
  assert.equal(typeof prepareTravelV2HazardDrawCandidate, "function");
  assert.equal(typeof prepareTravelV2HazardDrawCandidatePlayerSafeState, "function");
  assert.equal(typeof prepareTravelV2HazardDrawCandidateGmReviewState, "function");
  assert.equal(typeof prepareTravelV2HazardDrawReviewState, "function");
  assert.equal(typeof applyTravelV2HazardDrawReviewToRenderState, "function");
  checked.push("helper imports");

  const cards = getTravelV2GoldStandardHazardCards();
  const base = { selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, user: { isGM: true } };
  const missing = prepareTravelV2HazardDrawCandidate(base, { user: { isGM: true } });
  assert.equal(missing.status, "blocked");
  assert.equal(missing.isCandidate, false);
  assert.equal(missing.cardId, null);
  checked.push("missing request blocks automatic draw");

  const top = prepareTravelV2HazardDrawCandidate({ ...base, travelV2HazardDrawRequested: true, drawMode: "top" }, { user: { isGM: true } });
  assert.equal(top.status, "candidate");
  assert.equal(top.cardId, cards[0].id);
  assert.equal(top.cardIndex, 0);
  assert.equal(top.isActive, false);
  checked.push("GM top draw returns inert candidate");

  const indexed = prepareTravelV2HazardDrawCandidate({ ...base, travelV2HazardDrawRequested: true, drawMode: "index", requestedIndex: 2 }, { user: { isGM: true } });
  assert.equal(indexed.cardId, cards[2].id);
  assert.equal(indexed.cardIndex, 2);
  checked.push("GM index draw returns expected candidate");

  const byId = prepareTravelV2HazardDrawCandidate({ ...base, travelV2HazardDrawRequested: true, drawMode: "id", requestedCardId: cards[3].id }, { user: { isGM: true } });
  assert.equal(byId.cardId, cards[3].id);
  assert.equal(byId.cardIndex, 3);
  checked.push("GM id draw returns requested candidate");

  assert.equal(prepareTravelV2HazardDrawCandidate({ ...base, travelV2HazardDrawRequested: true, drawMode: "id", requestedCardId: "missing" }, { user: { isGM: true } }).status, "invalid");
  assert.equal(prepareTravelV2HazardDrawCandidate({ ...base, travelV2HazardDrawRequested: true, drawMode: "index", requestedIndex: 99 }, { user: { isGM: true } }).status, "invalid");
  assert.notEqual(prepareTravelV2HazardDrawCandidate({ selectedDeckId: "missing", travelV2HazardDrawRequested: true, user: { isGM: true } }, { user: { isGM: true } }).status, "candidate");
  checked.push("invalid card and deck requests fail safely");

  const nonGm = prepareTravelV2HazardDrawReviewState({ ...base, travelV2HazardDrawRequested: true, user: { isGM: false } }, { user: { isGM: false }, includeGmReview: true });
  assert.equal(nonGm.status, "blocked");
  assertNoForbidden(nonGm, "non-GM state");
  checked.push("non-GM draw is blocked and redacted");

  const safe = prepareTravelV2HazardDrawCandidatePlayerSafeState({ ...base, travelV2HazardDrawRequested: true, drawMode: "top" }, { user: { isGM: true } });
  assertNoForbidden(safe, "player-safe candidate");
  const gm = prepareTravelV2HazardDrawCandidateGmReviewState({ ...base, travelV2HazardDrawRequested: true, drawMode: "top" }, { user: { isGM: true }, includeGmReview: true });
  assert.equal(hasKey(gm.gmReview, "gmText"), true);
  assert.equal(gm.canActivate, false);
  assert.equal(gm.canApply, false);
  assert.equal(gm.canPersist, false);
  assert.equal(gm.activeHazardMutation.available, false);
  assert.equal(gm.consequenceApplication.available, false);
  checked.push("redaction, GM review, and inert flags");

  const input = { ...base, travelV2HazardDrawRequested: true, drawMode: "top" };
  const options = { user: { isGM: true }, includeGmReview: true };
  const beforeInput = json(input); const beforeOptions = json(options); const renderState = { existing: { ok: true } }; const beforeRender = json(renderState);
  const applied = applyTravelV2HazardDrawReviewToRenderState(renderState, input, options);
  assert.equal(json(input), beforeInput);
  assert.equal(json(options), beforeOptions);
  assert.equal(json(renderState), beforeRender);
  applied.travelV2HazardDrawReview.cardSummary.title = "mutated";
  assert.notEqual(prepareTravelV2HazardDrawCandidate(input, options).cardSummary.title, "mutated");
  checked.push("helpers do not mutate inputs and return clone-safe state");

  const noDrawApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: true }, uiState: { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } });
  assert.equal(noDrawApp.travelV2HazardDrawReview.status, "blocked");
  assert.equal(noDrawApp.travelV2HazardDrawReview.isCandidate, false);
  const drawApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: true }, uiState: { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, travelV2HazardDrawMode: "top" } });
  assert.equal(drawApp.travelV2HazardDrawReview.status, "candidate");
  assert.equal(drawApp.travelV2RuntimeHazardDeckSelection.selectedDeckId, TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID);
  assert.equal((drawApp.travelV2Hazards?.records ?? []).length, 0);
  const playerApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: false }, uiState: { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true } });
  assertNoForbidden(playerApp, "non-GM app state");
  checked.push("app render-state integration");

  const source = readFileSync(new URL("./travel-v2-hazard-draw-review.js", import.meta.url), "utf8") + readFileSync(new URL("../apps/travel-event-runner-v2-preview-consumer.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("source scan has no obvious persistence mutation calls");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2HazardDrawReviewSmokeChecks().then((result) => {
    console.log("Travel v2 hazard draw review smoke checks passed.");
    for (const check of result.checked) console.log(`- ${check}`);
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}
