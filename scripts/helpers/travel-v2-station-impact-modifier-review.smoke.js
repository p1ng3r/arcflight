import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } from "./travel-v2-hazard-deck-registry.js";
import { applyTravelV2StationImpactBehaviorToRenderState } from "./travel-v2-station-impact-behavior.js";
import { applyTravelV2ResponseActionWiringToRenderState } from "./travel-v2-response-action-wiring.js";
import { applyTravelV2ResponseActionResolutionReviewToRenderState } from "./travel-v2-response-action-resolution-review.js";
import { TRAVEL_V2_STATION_IMPACT_MODIFIER_REVIEW_VERSION, normalizeTravelV2StationImpactModifierReviewInput, prepareTravelV2StationImpactModifierReviewRows, prepareTravelV2StationImpactModifierPlayerState, prepareTravelV2StationImpactModifierGmState, applyTravelV2StationImpactModifierReviewToRenderState } from "./travel-v2-station-impact-modifier-review.js";

const FORBIDDEN = ["gmText", "gmSummary", "gmMechanicalNotes", "gmReview", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"];
const MUTATION_CALLS = ["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"];
function snap(value) { return JSON.stringify(value); }
function hasKey(value, key) { if (!value || typeof value !== "object") return false; if (Object.hasOwn(value, key)) return true; return Object.values(value).some((entry) => Array.isArray(entry) ? entry.some((item) => hasKey(item, key)) : hasKey(entry, key)); }
function assertNoForbidden(value, label) { for (const key of FORBIDDEN) assert.equal(hasKey(value, key), false, `${label} must not include ${key}`); }
function assertInert(row) { for (const [key, value] of Object.entries({ reviewOnly: true, modifierReviewCandidate: true, applyAvailable: false, applied: false, modifierApplied: false, dcApplied: false, stationStateMutated: false, checkResultMutated: false, rollRequested: false, responseActionExecuted: false, clearProgressApplied: false, hazardResolved: false, consequencesApplied: false })) assert.equal(row[key], value, `${key} mismatch`); assert.equal(row.persistentMutation.available, false); }
function activeHazards() { return { activeHazards: [{ status: "active", isActive: true, playerVisible: true, cardId: "void-shear", title: "Void Shear", responseActionsPreview: { actions: [{ id: "brace", title: "Brace", publicText: "Brace.", stationKeys: ["navigator"] }] }, stationImpactsPreview: [{ stationKey: "navigator", publicText: "Navigator DC may shift.", dcDelta: 2, gmText: "Secret DC reason" }] }] }; }
function state(user = { isGM: true }) { let s = { travelV2ActiveHazardLifecycleDisplay: activeHazards(), stations: [{ stationKey: "navigator", stationName: "Navigator" }] }; s = applyTravelV2ResponseActionWiringToRenderState(s, { user }, { user, includeGmReview: true }); s = applyTravelV2StationImpactBehaviorToRenderState(s, { user, stations: s.stations }, { user, includeGmReview: true }); s = applyTravelV2ResponseActionResolutionReviewToRenderState(s, { user, travelV2ResponseActionResolutionRequested: true, travelV2ResponseActionSelectedActionId: "brace", travelV2ResponseActionSelectedHazardCardId: "void-shear" }, { user, includeGmReview: true }); return s; }

export default async function runTravelV2StationImpactModifierReviewSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_STATION_IMPACT_MODIFIER_REVIEW_VERSION, 1);
  for (const fn of [normalizeTravelV2StationImpactModifierReviewInput, prepareTravelV2StationImpactModifierReviewRows, prepareTravelV2StationImpactModifierPlayerState, prepareTravelV2StationImpactModifierGmState, applyTravelV2StationImpactModifierReviewToRenderState]) assert.equal(typeof fn, "function");
  checked.push("helper imports");

  const empty = prepareTravelV2StationImpactModifierPlayerState({}, { user: { isGM: false } });
  assert.equal(empty.status, "empty");
  assert.equal(empty.modifierReviewRows.length, 0);
  checked.push("empty/missing station impact guidance returns empty modifier review state");

  const rows = prepareTravelV2StationImpactModifierReviewRows(state(), { user: { isGM: true } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "ready");
  assert.equal(rows[0].stationLabel, "Navigator");
  assert.equal(rows[0].proposedModifier.dcDelta, null);
  assertInert(rows[0]);
  const numeric = prepareTravelV2StationImpactModifierReviewRows({ impactedStations: [{ stationKey: "navigator", stationLabel: "Navigator", publicText: "Navigator DC may shift.", dcDelta: 2 }] })[0];
  assert.equal(numeric.proposedModifier.dcDelta, 2);
  checked.push("station impact guidance produces inert review-only modifier row with numeric dcDelta");

  assert.equal(prepareTravelV2StationImpactModifierReviewRows({ impactedStations: [{ stationKey: "engines", publicText: "Penalty listed.", penalty: 1 }] })[0].proposedModifier.dcDelta, -1);
  assert.equal(prepareTravelV2StationImpactModifierReviewRows({ impactedStations: [{ stationKey: "engines", publicText: "Review only." }] })[0].proposedModifier.dcDelta, null);
  checked.push("modifier-like fields normalize only when present and no number is invented");

  const linked = prepareTravelV2StationImpactModifierReviewRows(state(), { user: { isGM: true } })[0];
  assert.equal(linked.relatedResponseAction.selectedActionId, "brace");
  assert.equal(linked.relatedResponseAction.status, "ready");
  checked.push("related response action resolution review links when available and player-safe");

  const player = prepareTravelV2StationImpactModifierPlayerState(state({ isGM: false }), { user: { isGM: false } });
  assertNoForbidden(player, "player-safe output");
  const gmNoReview = prepareTravelV2StationImpactModifierGmState(state(), { user: { isGM: true }, includeGmReview: false });
  assert.equal(hasKey(gmNoReview, "gmReview"), false);
  const gmReview = prepareTravelV2StationImpactModifierGmState(state(), { user: { isGM: true }, includeGmReview: true });
  assert.equal(hasKey(gmReview, "gmReview"), true);
  assert.equal(snap(gmReview).includes("Secret DC reason"), true);
  checked.push("non-GM redaction and GM review gating work");

  const input = state(); const options = { user: { isGM: true }, includeGmReview: true }; const renderState = { marker: { ok: true }, ...state() };
  const before = [snap(input), snap(options), snap(renderState)];
  const applied = applyTravelV2StationImpactModifierReviewToRenderState(renderState, input, options);
  assert.deepEqual([snap(input), snap(options), snap(renderState)], before);
  applied.travelV2StationImpactModifierPlayerState.modifierReviewRows[0].stationLabel = "mutated";
  assert.equal(prepareTravelV2StationImpactModifierPlayerState(input, options).modifierReviewRows[0].stationLabel, "Navigator");
  checked.push("helper does not mutate input/options/renderState and returns clone-safe state");

  const uiState = { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, travelV2HazardDrawMode: "top", travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate" };
  const gmApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: true }, uiState });
  assert.ok(gmApp.travelV2StationImpactModifierReview);
  const playerApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: false }, uiState: { travelV2HazardCandidateControlResult: { status: "active", activeHazard: activeHazards().activeHazards[0] } } });
  assert.ok(playerApp.travelV2StationImpactModifierPlayerState);
  assert.equal(hasKey(playerApp, "travelV2StationImpactModifierReview"), false);
  assertNoForbidden(playerApp, "non-GM app state");
  checked.push("app render-state integration exposes GM review and player-safe state without leaks");

  const source = readFileSync(new URL("./travel-v2-station-impact-modifier-review.js", import.meta.url), "utf8") + readFileSync(new URL("../apps/travel-event-runner-v2-preview-consumer.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("source scan has no obvious persistent mutation calls");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2StationImpactModifierReviewSmokeChecks().then((result) => { console.log("Travel v2 station impact modifier review smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
