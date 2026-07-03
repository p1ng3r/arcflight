import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } from "./travel-v2-hazard-deck-registry.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import { prepareTravelV2HazardDrawReviewState } from "./travel-v2-hazard-draw-review.js";
import { prepareTravelV2ActiveHazardHandoffReviewState } from "./travel-v2-active-hazard-handoff-review.js";
import { prepareTravelV2HazardCandidateControlResult } from "./travel-v2-hazard-candidate-controls.js";
import {
  TRAVEL_V2_ACTIVE_HAZARD_LIFECYCLE_DISPLAY_VERSION,
  normalizeTravelV2ActiveHazardLifecycleInput,
  prepareTravelV2ActiveHazardLifecycleRows,
  prepareTravelV2ActiveHazardPlayerHudState,
  prepareTravelV2ActiveHazardGmLifecycleState,
  applyTravelV2ActiveHazardLifecycleDisplayToRenderState
} from "./travel-v2-active-hazard-lifecycle-display.js";

const FORBIDDEN = ["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals", "gmReview"];
const MUTATION_CALLS = ["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"];
function json(value) { return JSON.stringify(value); }
function hasKey(value, key) {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, key)) return true;
  return Object.values(value).some((entry) => Array.isArray(entry) ? entry.some((item) => hasKey(item, key)) : hasKey(entry, key));
}
function assertNoForbidden(value, label) { for (const key of FORBIDDEN) assert.equal(hasKey(value, key), false, `${label} must not include ${key}`); }
function assertDisplayOnly(state) {
  assert.equal(state.displayOnly, true);
  assert.equal(state.stationEffectsApplied, false);
  assert.equal(state.responseActionsWired, false);
  assert.equal(state.consequencesApplied, false);
  assert.equal(state.persistentMutation.available, false);
}
function assertPreviews(row) {
  assert.equal(row.stationImpactsPreview.applied, false);
  assert.equal(row.responseActionsPreview.wired, false);
  assert.equal(row.clearConditionPreview.progressMutable, false);
  assert.equal(row.unresolvedConsequencePreview.applied, false);
}
function control(action) {
  const user = { isGM: true };
  const draw = prepareTravelV2HazardDrawReviewState({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, drawMode: "top", user }, { user, includeGmReview: true });
  const handoff = prepareTravelV2ActiveHazardHandoffReviewState({ travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardDrawReview: draw, user }, { user, includeGmReview: true });
  return prepareTravelV2HazardCandidateControlResult({ travelV2ActiveHazardHandoffReview: handoff, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: action, user }, { user, includeGmReview: true });
}

export default async function runTravelV2ActiveHazardLifecycleDisplaySmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_ACTIVE_HAZARD_LIFECYCLE_DISPLAY_VERSION, 1);
  for (const fn of [normalizeTravelV2ActiveHazardLifecycleInput, prepareTravelV2ActiveHazardLifecycleRows, prepareTravelV2ActiveHazardPlayerHudState, prepareTravelV2ActiveHazardGmLifecycleState, applyTravelV2ActiveHazardLifecycleDisplayToRenderState]) assert.equal(typeof fn, "function");
  checked.push("helper imports");

  const empty = prepareTravelV2ActiveHazardGmLifecycleState({}, { user: { isGM: true } });
  assert.equal(empty.allRows.length, 0);
  assertDisplayOnly(empty);
  checked.push("empty lifecycle result returns empty display state");

  const active = control("activate");
  active.gmReview = { gmText: "secret", before: { targetActorId: "a" } };
  active.activeHazard.gmText = "secret";
  active.activeHazard.responseActions = [{ id: "counter", title: "Counter", publicText: "Counter it.", gmText: "secret" }];
  const playerHud = prepareTravelV2ActiveHazardPlayerHudState({ travelV2HazardCandidateControlResult: active }, { user: { isGM: false } });
  assert.equal(playerHud.activeHazards.length, 1);
  assert.equal(playerHud.activeHazards[0].status, "active");
  assertPreviews(playerHud.activeHazards[0]);
  assertDisplayOnly(playerHud);
  assertNoForbidden(playerHud, "player HUD");
  checked.push("activated control result produces player-safe active HUD row");

  const gmActive = prepareTravelV2ActiveHazardGmLifecycleState({ travelV2HazardCandidateControlResult: active }, { user: { isGM: true }, includeGmReview: true });
  assert.equal(gmActive.activeHazards.length, 1);
  assert.equal(hasKey(gmActive, "gmReview"), true);
  const gmNoReview = prepareTravelV2ActiveHazardGmLifecycleState({ travelV2HazardCandidateControlResult: active }, { user: { isGM: true }, includeGmReview: false });
  assert.equal(hasKey(gmNoReview, "gmReview"), false);
  checked.push("GM review is gated by includeGmReview and GM user");

  const held = control("hold");
  const gmHeld = prepareTravelV2ActiveHazardGmLifecycleState({ travelV2HazardCandidateControlResult: held }, { user: { isGM: true } });
  assert.equal(gmHeld.heldHazards.length, 1);
  assert.equal(prepareTravelV2ActiveHazardPlayerHudState({ travelV2HazardCandidateControlResult: held }, { user: { isGM: false } }).activeHazards.length, 0);
  checked.push("held result produces GM held row and no player active row");

  const dismissed = control("dismiss");
  const gmDismissed = prepareTravelV2ActiveHazardGmLifecycleState({ travelV2HazardCandidateControlResult: dismissed }, { user: { isGM: true } });
  assert.equal(gmDismissed.dismissedHazards.length, 1);
  assert.equal(prepareTravelV2ActiveHazardPlayerHudState({ travelV2HazardCandidateControlResult: dismissed }, { user: { isGM: false } }).activeHazards.length, 0);
  checked.push("dismissed result produces GM dismissed row and no player active row");

  const blocked = prepareTravelV2ActiveHazardLifecycleRows({ travelV2HazardCandidateControlResult: { status: "blocked", blockedReason: "nope" } });
  assert.equal(blocked[0].status, "blocked");
  checked.push("blocked lifecycle state does not throw");

  const input = { travelV2HazardCandidateControlResult: active };
  const options = { user: { isGM: true }, includeGmReview: true };
  const render = { existing: { ok: true } };
  const before = [json(input), json(options), json(render)];
  const applied = applyTravelV2ActiveHazardLifecycleDisplayToRenderState(render, input, options);
  assert.deepEqual([json(input), json(options), json(render)], before);
  applied.travelV2ActiveHazardPlayerHud.activeHazards[0].title = "mutated";
  assert.notEqual(prepareTravelV2ActiveHazardPlayerHudState(input, options).activeHazards[0].title, "mutated");
  checked.push("helper does not mutate inputs and returns clone-safe state");

  const user = { isGM: true };
  const baseUi = { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, travelV2HazardDrawMode: "top", travelV2ActiveHazardHandoffReviewRequested: true };
  const gmApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user, uiState: { ...baseUi, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate" } });
  assert.equal(gmApp.travelV2ActiveHazardLifecycleDisplay.activeHazards.length, 1);
  const playerApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: false }, uiState: { travelV2HazardCandidateControlResult: active } });
  assert.equal(playerApp.travelV2ActiveHazardPlayerHud.activeHazards.length, 1);
  assertNoForbidden(playerApp, "non-GM app");
  const holdApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user, uiState: { ...baseUi, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "hold" } });
  assert.equal(holdApp.travelV2ActiveHazardPlayerHud.activeHazards.length, 0);
  checked.push("app render-state integration exposes GM lifecycle and player-safe HUD");

  const source = readFileSync(new URL("./travel-v2-active-hazard-lifecycle-display.js", import.meta.url), "utf8") + readFileSync(new URL("../apps/travel-event-runner-v2-preview-consumer.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("source scan has no obvious persistence mutation calls");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2ActiveHazardLifecycleDisplaySmokeChecks().then((result) => {
    console.log("Travel v2 active hazard lifecycle display smoke checks passed.");
    for (const check of result.checked) console.log(`- ${check}`);
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}
