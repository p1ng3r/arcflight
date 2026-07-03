import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } from "./travel-v2-hazard-deck-registry.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import { prepareTravelV2HazardDrawReviewState } from "./travel-v2-hazard-draw-review.js";
import { prepareTravelV2ActiveHazardHandoffReviewState } from "./travel-v2-active-hazard-handoff-review.js";
import {
  TRAVEL_V2_HAZARD_CANDIDATE_CONTROLS_VERSION,
  normalizeTravelV2HazardCandidateControlRequest,
  validateTravelV2HazardCandidateControlRequest,
  prepareTravelV2HazardCandidateControlResult,
  prepareTravelV2HazardCandidateControlPlayerSafeState,
  prepareTravelV2HazardCandidateControlGmState,
  applyTravelV2HazardCandidateControlToRenderState
} from "./travel-v2-hazard-candidate-controls.js";

const FORBIDDEN = ["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"];
const MUTATION_CALLS = ["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"];
function json(value) { return JSON.stringify(value); }
function hasKey(value, key) {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, key)) return true;
  return Object.values(value).some((entry) => Array.isArray(entry) ? entry.some((item) => hasKey(item, key)) : hasKey(entry, key));
}
function assertNoForbidden(value, label) { for (const key of FORBIDDEN) assert.equal(hasKey(value, key), false, `${label} must not include ${key}`); }
function assertNonPersistent(result) {
  assert.equal(result.canApply, false);
  assert.equal(result.canPersist, false);
  assert.equal(result.canApplyConsequences, false);
  assert.equal(result.consequenceApplication.available, false);
  assert.equal(result.persistentMutation.available, false);
}

export default async function runTravelV2HazardCandidateControlsSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_HAZARD_CANDIDATE_CONTROLS_VERSION, 1);
  for (const fn of [normalizeTravelV2HazardCandidateControlRequest, validateTravelV2HazardCandidateControlRequest, prepareTravelV2HazardCandidateControlResult, prepareTravelV2HazardCandidateControlPlayerSafeState, prepareTravelV2HazardCandidateControlGmState, applyTravelV2HazardCandidateControlToRenderState]) assert.equal(typeof fn, "function");
  checked.push("helper imports");

  const user = { isGM: true };
  const draw = prepareTravelV2HazardDrawReviewState({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, drawMode: "top", user }, { user, includeGmReview: true });
  const handoff = prepareTravelV2ActiveHazardHandoffReviewState({ travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardDrawReview: draw, user }, { user, includeGmReview: true });

  const missing = prepareTravelV2HazardCandidateControlResult({ travelV2ActiveHazardHandoffReview: handoff, user }, { user });
  assert.equal(missing.status, "blocked");
  assert.equal(missing.isActive, false);
  assert.equal(missing.canActivate, true);
  checked.push("missing control request does not activate/hold/dismiss");

  const unknown = prepareTravelV2HazardCandidateControlResult({ travelV2ActiveHazardHandoffReview: handoff, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "archive", user }, { user });
  assert.equal(unknown.status, "invalid");
  const invalid = prepareTravelV2HazardCandidateControlResult({ travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate", user }, { user });
  assert.notEqual(invalid.status, "activated");
  checked.push("unknown action and invalid handoff are rejected");

  const active = prepareTravelV2HazardCandidateControlResult({ travelV2ActiveHazardHandoffReview: handoff, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate", user }, { user, includeGmReview: true });
  assert.equal(active.status, "activated");
  assert.equal(active.activeHazard.active, true);
  assert.equal(active.activeHazard.persisted, false);
  assert.equal(active.activeHazard.lifecycleStatus, "active");
  assert.equal(active.activeHazard.activationSource, "gm-explicit");
  assert.equal(hasKey(active, "appliedConsequences"), false);
  assert.equal(hasKey(active, "stationDcApplication"), false);
  assertNonPersistent(active);
  checked.push("GM explicit activate creates only session-local active hazard state");

  const held = prepareTravelV2HazardCandidateControlResult({ travelV2ActiveHazardHandoffReview: handoff, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "hold", user }, { user });
  assert.equal(held.status, "held");
  assert.equal(held.heldHazard.active, false);
  assert.equal(held.heldHazard.persisted, false);
  assert.equal(held.heldHazard.lifecycleStatus, "held");
  assert.equal(held.activeHazard, undefined);
  const dismissed = prepareTravelV2HazardCandidateControlResult({ travelV2ActiveHazardHandoffReview: handoff, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "dismiss", user }, { user });
  assert.equal(dismissed.status, "dismissed");
  assert.equal(dismissed.dismissedHazard.active, false);
  assert.equal(dismissed.dismissedHazard.persisted, false);
  assert.equal(dismissed.dismissedHazard.lifecycleStatus, "dismissed");
  assert.equal(dismissed.activeHazard, undefined);
  checked.push("GM explicit hold and dismiss do not create active hazards");

  const nonGm = prepareTravelV2HazardCandidateControlGmState({ travelV2ActiveHazardHandoffReview: handoff, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate", user: { isGM: false } }, { user: { isGM: false }, includeGmReview: true });
  assert.equal(nonGm.status, "blocked");
  assertNoForbidden(nonGm, "non-GM control");
  const safe = prepareTravelV2HazardCandidateControlPlayerSafeState({ travelV2ActiveHazardHandoffReview: handoff, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate", user }, { user });
  assertNoForbidden(safe, "player-safe control");
  assert.equal(hasKey(active, "gmReview"), true);
  checked.push("GM review gating and player-safe redaction");

  const input = { travelV2ActiveHazardHandoffReview: handoff, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate", user };
  const options = { user, includeGmReview: true };
  const render = { existing: { ok: true } };
  const before = [json(input), json(options), json(render)];
  const applied = applyTravelV2HazardCandidateControlToRenderState(render, input, options);
  assert.deepEqual([json(input), json(options), json(render)], before);
  applied.travelV2HazardCandidateControlResult.activeHazard.title = "mutated";
  assert.notEqual(prepareTravelV2HazardCandidateControlResult(input, options).activeHazard.title, "mutated");
  checked.push("helpers do not mutate inputs and return clone-safe state");

  const baseUi = { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, travelV2HazardDrawMode: "top", travelV2ActiveHazardHandoffReviewRequested: true };
  const noActionApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user, uiState: baseUi });
  assert.equal(noActionApp.travelV2HazardCandidateControlResult.status, "blocked");
  const activateApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user, uiState: { ...baseUi, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate" } });
  assert.equal(activateApp.travelV2HazardCandidateControlResult.status, "activated");
  const holdApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user, uiState: { ...baseUi, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "hold" } });
  assert.equal(holdApp.travelV2HazardCandidateControlResult.status, "held");
  const dismissApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user, uiState: { ...baseUi, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "dismiss" } });
  assert.equal(dismissApp.travelV2HazardCandidateControlResult.status, "dismissed");
  const playerApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: false }, uiState: { ...baseUi, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate" } });
  assertNoForbidden(playerApp, "non-GM app");
  checked.push("app render-state integration is explicit and GM-only");

  const source = readFileSync(new URL("./travel-v2-hazard-candidate-controls.js", import.meta.url), "utf8") + readFileSync(new URL("../apps/travel-event-runner-v2-preview-consumer.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("source scan has no obvious persistence mutation calls");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2HazardCandidateControlsSmokeChecks().then((result) => {
    console.log("Travel v2 hazard candidate controls smoke checks passed.");
    for (const check of result.checked) console.log(`- ${check}`);
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}
