import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } from "./travel-v2-hazard-deck-registry.js";
import {
  TRAVEL_V2_RESPONSE_ACTION_WIRING_VERSION,
  normalizeTravelV2ResponseActionWiringInput,
  prepareTravelV2ResponseActionChoices,
  prepareTravelV2ResponseActionPlayerState,
  prepareTravelV2ResponseActionGmState,
  applyTravelV2ResponseActionWiringToRenderState
} from "./travel-v2-response-action-wiring.js";

const FORBIDDEN = ["gmText", "gmSummary", "gmMechanicalNotes", "gmReview", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"];
const MUTATION_CALLS = ["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"];
function snap(value) { return JSON.stringify(value); }
function hasKey(value, key) { if (!value || typeof value !== "object") return false; if (Object.hasOwn(value, key)) return true; return Object.values(value).some((entry) => Array.isArray(entry) ? entry.some((item) => hasKey(item, key)) : hasKey(entry, key)); }
function assertNoForbidden(value, label) { for (const key of FORBIDDEN) assert.equal(hasKey(value, key), false, `${label} must not include ${key}`); }
function assertInert(choice) { assert.equal(choice.wired, true); assert.equal(choice.executed, false); assert.equal(choice.rollRequested, false); assert.equal(choice.outcomeApplied, false); assert.equal(choice.clearProgressApplied, false); assert.equal(choice.consequencesApplied, false); assert.equal(choice.persistentMutation.available, false); }
function lifecycle(status = "active") { return { activeHazards: status === "active" ? [{ status: "active", isActive: true, playerVisible: true, cardId: "void-shear", title: "Void Shear", responseActionsPreview: { wired: false, actions: [{ id: "brace", title: "Brace", publicText: "Brace for the shear.", stationKeys: ["navigator"], tags: ["careful"], gmText: "GM ONLY", applyPayload: { secret: true } }] } }] : [], heldHazards: status === "held" ? [{ status: "held", isActive: false, cardId: "held", title: "Held", responseActionsPreview: { actions: [{ id: "nope", title: "Nope" }] } }] : [], dismissedHazards: status === "dismissed" ? [{ status: "dismissed", isActive: false, cardId: "dismissed", title: "Dismissed", responseActionsPreview: { actions: [{ id: "nope", title: "Nope" }] } }] : [], allRows: [] }; }

export default async function runTravelV2ResponseActionWiringSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_RESPONSE_ACTION_WIRING_VERSION, 1);
  for (const fn of [normalizeTravelV2ResponseActionWiringInput, prepareTravelV2ResponseActionChoices, prepareTravelV2ResponseActionPlayerState, prepareTravelV2ResponseActionGmState, applyTravelV2ResponseActionWiringToRenderState]) assert.equal(typeof fn, "function");
  checked.push("helper imports");

  const empty = prepareTravelV2ResponseActionPlayerState({}, { user: { isGM: false } });
  assert.equal(empty.availableActions.length, 0);
  assert.equal(empty.wired, false);
  assert.equal(empty.persistentMutation.available, false);
  checked.push("empty lifecycle state returns empty wiring state");

  const player = prepareTravelV2ResponseActionPlayerState({ travelV2ActiveHazardLifecycleDisplay: lifecycle("active") }, { user: { isGM: false } });
  assert.equal(player.availableActions.length, 1);
  assert.equal(player.activeHazardCount, 1);
  assertInert(player.availableActions[0]);
  assertNoForbidden(player, "player state");
  checked.push("active hazard response actions produce player-safe available actions");

  assert.equal(prepareTravelV2ResponseActionPlayerState({ travelV2ActiveHazardLifecycleDisplay: lifecycle("held") }).availableActions.length, 0);
  assert.equal(prepareTravelV2ResponseActionPlayerState({ travelV2ActiveHazardLifecycleDisplay: lifecycle("dismissed") }).availableActions.length, 0);
  checked.push("held and dismissed hazards do not produce player actions");

  const gmNoReview = prepareTravelV2ResponseActionGmState({ travelV2ActiveHazardLifecycleDisplay: lifecycle("active") }, { user: { isGM: true }, includeGmReview: false });
  assert.equal(hasKey(gmNoReview, "gmReview"), false);
  const gm = prepareTravelV2ResponseActionGmState({ travelV2ActiveHazardLifecycleDisplay: lifecycle("active") }, { user: { isGM: true }, includeGmReview: true });
  assert.equal(gm.availableActions.length, 1);
  assert.equal(gm.gmRows.length, 1);
  assert.equal(hasKey(gm, "gmReview"), true);
  assert.equal(snap(gm).includes("GM ONLY"), true);
  checked.push("GM review text is gated by includeGmReview and GM user");

  const input = { travelV2ActiveHazardLifecycleDisplay: lifecycle("active") };
  const options = { user: { isGM: true }, includeGmReview: true, nested: { ok: true } };
  const renderState = { existing: { ok: true }, travelV2ActiveHazardLifecycleDisplay: lifecycle("active") };
  const before = [snap(input), snap(options), snap(renderState)];
  const applied = applyTravelV2ResponseActionWiringToRenderState(renderState, input, options);
  assert.deepEqual([snap(input), snap(options), snap(renderState)], before);
  applied.travelV2ResponseActionPlayerState.availableActions[0].title = "mutated";
  assert.equal(prepareTravelV2ResponseActionPlayerState(input, options).availableActions[0].title, "Brace");
  checked.push("helper does not mutate inputs/options/renderState and returns clone-safe state");

  const user = { isGM: true };
  const uiState = { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, travelV2HazardDrawMode: "top", travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate" };
  const gmApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user, uiState });
  assert.ok(gmApp.travelV2ResponseActionWiring.availableActions.length > 0);
  const playerApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: false }, uiState: { travelV2HazardCandidateControlResult: { status: "active", activeHazard: lifecycle("active").activeHazards[0] } } });
  assert.ok(playerApp.travelV2ResponseActionPlayerState.availableActions.length > 0);
  assert.equal(hasKey(playerApp, "travelV2ResponseActionWiring"), false);
  assertNoForbidden(playerApp, "non-GM app state");
  checked.push("app render-state integration exposes GM wiring and player-safe state without leaks");

  const source = readFileSync(new URL("./travel-v2-response-action-wiring.js", import.meta.url), "utf8") + readFileSync(new URL("../apps/travel-event-runner-v2-preview-consumer.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("source scan has no obvious persistent mutation calls");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2ResponseActionWiringSmokeChecks().then((result) => { console.log("Travel v2 response action wiring smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
