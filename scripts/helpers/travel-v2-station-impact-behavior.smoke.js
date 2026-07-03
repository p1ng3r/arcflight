import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } from "./travel-v2-hazard-deck-registry.js";
import { TRAVEL_V2_STATION_IMPACT_BEHAVIOR_VERSION, normalizeTravelV2StationImpactBehaviorInput, prepareTravelV2StationImpactRows, prepareTravelV2StationImpactPlayerState, prepareTravelV2StationImpactGmState, applyTravelV2StationImpactBehaviorToRenderState } from "./travel-v2-station-impact-behavior.js";

const FORBIDDEN = ["gmText", "gmSummary", "gmMechanicalNotes", "gmReview", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"];
const MUTATION_CALLS = ["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"];
function snap(value) { return JSON.stringify(value); }
function hasKey(value, key) { if (!value || typeof value !== "object") return false; if (Object.hasOwn(value, key)) return true; return Object.values(value).some((entry) => Array.isArray(entry) ? entry.some((item) => hasKey(item, key)) : hasKey(entry, key)); }
function assertNoForbidden(value, label) { for (const key of FORBIDDEN) assert.equal(hasKey(value, key), false, `${label} must not include ${key}`); }
function assertInert(row) { assert.equal(row.reviewOnly, true); assert.equal(row.applied, false); assert.equal(row.modifierApplied, false); assert.equal(row.dcApplied, false); assert.equal(row.checkResultMutated, false); assert.equal(row.rollRequested, false); assert.equal(row.responseActionExecuted, false); assert.equal(row.clearProgressApplied, false); assert.equal(row.consequencesApplied, false); assert.equal(row.persistentMutation.available, false); }
function lifecycle(status = "active", stationImpacts = { navigator: "Crosswinds make navigation checks tense." }) { return { activeHazards: status === "active" ? [{ status: "active", isActive: true, playerVisible: true, cardId: "void-shear", title: "Void Shear", gmText: "GM ONLY", stationImpactsPreview: { applied: false, displayOnly: true, stationImpacts } }] : [], heldHazards: status === "held" ? [{ status: "held", isActive: false, cardId: "held", title: "Held", stationImpactsPreview: { stationImpacts } }] : [], dismissedHazards: status === "dismissed" ? [{ status: "dismissed", isActive: false, cardId: "dismissed", title: "Dismissed", stationImpactsPreview: { stationImpacts } }] : [], allRows: [] }; }

export default async function runTravelV2StationImpactBehaviorSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_STATION_IMPACT_BEHAVIOR_VERSION, 1);
  for (const fn of [normalizeTravelV2StationImpactBehaviorInput, prepareTravelV2StationImpactRows, prepareTravelV2StationImpactPlayerState, prepareTravelV2StationImpactGmState, applyTravelV2StationImpactBehaviorToRenderState]) assert.equal(typeof fn, "function");
  checked.push("helper imports");

  const empty = prepareTravelV2StationImpactPlayerState({}, { user: { isGM: false } });
  assert.equal(empty.impactedStations.length, 0); assert.equal(empty.activeHazardCount, 0); assertInert(empty);
  checked.push("empty lifecycle state returns empty station impact state");

  const playerMap = prepareTravelV2StationImpactPlayerState({ travelV2ActiveHazardPlayerHud: lifecycle("active"), stations: [{ stationKey: "navigator", stationName: "Navigator" }] }, { user: { isGM: false } });
  assert.equal(playerMap.impactedStations.length, 1); assert.equal(playerMap.impactedStations[0].stationLabel, "Navigator"); assertInert(playerMap.impactedStations[0]); assertNoForbidden(playerMap, "player object-map state");
  checked.push("active hazard object-map impact produces player-safe impactedStations");

  const impacts = [{ stationKey: "engineer", publicText: "Engine heat surges.", severity: "high", tags: ["heat"], gmText: "GM ONLY", targetActorId: "secret" }];
  const playerArray = prepareTravelV2StationImpactPlayerState({ travelV2ActiveHazardPlayerHud: lifecycle("active", impacts), stations: [{ stationKey: "engineer", stationName: "Engineer" }] }, { user: { isGM: false } });
  assert.equal(playerArray.impactedStations.length, 1); assert.equal(playerArray.impactedStations[0].severity, "high"); assertNoForbidden(playerArray, "player array state");
  checked.push("active hazard array impact produces player-safe impactedStations");

  assert.equal(prepareTravelV2StationImpactPlayerState({ travelV2ActiveHazardLifecycleDisplay: lifecycle("held") }).impactedStations.length, 0);
  assert.equal(prepareTravelV2StationImpactPlayerState({ travelV2ActiveHazardLifecycleDisplay: lifecycle("dismissed") }).impactedStations.length, 0);
  checked.push("held and dismissed hazards do not produce player station impact rows");

  const gmNoReview = prepareTravelV2StationImpactGmState({ travelV2ActiveHazardLifecycleDisplay: lifecycle("active", impacts) }, { user: { isGM: true }, includeGmReview: false });
  assert.equal(hasKey(gmNoReview, "gmReview"), false);
  const gm = prepareTravelV2StationImpactGmState({ travelV2ActiveHazardLifecycleDisplay: lifecycle("active", impacts) }, { user: { isGM: true }, includeGmReview: true });
  assert.equal(gm.gmRows.length, 1); assert.equal(hasKey(gm, "gmReview"), true); assert.equal(snap(gm).includes("GM ONLY"), true);
  checked.push("GM review text is gated by includeGmReview and GM user");

  const input = { travelV2ActiveHazardLifecycleDisplay: lifecycle("active", impacts), stations: [{ stationKey: "engineer", stationName: "Engineer" }] };
  const options = { user: { isGM: true }, includeGmReview: true, nested: { ok: true } };
  const renderState = { existing: { ok: true }, travelV2ActiveHazardLifecycleDisplay: lifecycle("active", impacts), stations: input.stations };
  const before = [snap(input), snap(options), snap(renderState)];
  const applied = applyTravelV2StationImpactBehaviorToRenderState(renderState, input, options);
  assert.deepEqual([snap(input), snap(options), snap(renderState)], before);
  applied.travelV2StationImpactPlayerState.impactedStations[0].stationLabel = "mutated";
  assert.equal(prepareTravelV2StationImpactPlayerState(input, options).impactedStations[0].stationLabel, "Engineer");
  checked.push("helper does not mutate inputs/options/renderState and returns clone-safe state");

  const user = { isGM: true };
  const uiState = { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, travelV2HazardDrawRequested: true, travelV2HazardDrawMode: "top", travelV2ActiveHazardHandoffReviewRequested: true, travelV2HazardCandidateControlRequested: true, travelV2HazardCandidateControlAction: "activate" };
  const gmApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user, uiState });
  assert.ok(gmApp.travelV2StationImpactBehavior.impactedStations.length > 0);
  const playerApp = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: false }, uiState: { travelV2HazardCandidateControlResult: { status: "active", activeHazard: lifecycle("active", impacts).activeHazards[0] } } });
  assert.ok(playerApp.travelV2StationImpactPlayerState.impactedStations.length > 0);
  assert.equal(hasKey(playerApp, "travelV2StationImpactBehavior"), false); assertNoForbidden(playerApp, "non-GM app state");
  checked.push("app render-state integration exposes GM guidance and player-safe state without leaks");

  const source = readFileSync(new URL("./travel-v2-station-impact-behavior.js", import.meta.url), "utf8") + readFileSync(new URL("../apps/travel-event-runner-v2-preview-consumer.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("source scan has no obvious persistent mutation calls");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2StationImpactBehaviorSmokeChecks().then((result) => { console.log("Travel v2 station impact behavior smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
