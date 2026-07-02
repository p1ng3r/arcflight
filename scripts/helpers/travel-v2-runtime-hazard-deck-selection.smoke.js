import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } from "./travel-v2-hazard-deck-registry.js";
import {
  DEFAULT_TRAVEL_V2_RUNTIME_HAZARD_DECK_ID,
  TRAVEL_V2_RUNTIME_HAZARD_DECK_SELECTION_VERSION,
  applyTravelV2RuntimeHazardDeckSelectionToRenderState,
  normalizeTravelV2RuntimeHazardDeckSelection,
  prepareTravelV2RuntimeHazardDeckSelectionGmState,
  prepareTravelV2RuntimeHazardDeckSelectionPlayerSafeState,
  prepareTravelV2RuntimeHazardDeckSelectionState,
  validateTravelV2RuntimeHazardDeckSelection
} from "./travel-v2-runtime-hazard-deck-selection.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";

const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);
const FORBIDDEN_MUTATION_CALLS = Object.freeze(["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"]);

function assertNoForbiddenFields(value) {
  if (!value || typeof value !== "object") return;
  for (const field of FORBIDDEN_PLAYER_SAFE_FIELDS) assert.equal(Object.hasOwn(value, field), false, `player-safe runtime selection leaked ${field}`);
  for (const nested of Object.values(value)) Array.isArray(nested) ? nested.forEach(assertNoForbiddenFields) : assertNoForbiddenFields(nested);
}
function hasKey(value, key) {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, key)) return true;
  return Object.values(value).some((nested) => Array.isArray(nested) ? nested.some((entry) => hasKey(entry, key)) : hasKey(nested, key));
}
function assertInert(state) {
  assert.equal(state.canDraw, false, "selection cannot draw");
  assert.equal(state.canActivate, false, "selection cannot activate");
  assert.equal(state.canApply, false, "selection cannot apply");
  assert.equal(state.canImport, false, "selection cannot import");
  assert.equal(state.drawState.available, false, "draw state is unavailable");
  assert.equal(state.activeHazardMutation.available, false, "active hazard mutation is unavailable");
}

export default async function runTravelV2RuntimeHazardDeckSelectionSmokeChecks() {
  assert.equal(TRAVEL_V2_RUNTIME_HAZARD_DECK_SELECTION_VERSION, 1, "selection version is exported");
  assert.equal(DEFAULT_TRAVEL_V2_RUNTIME_HAZARD_DECK_ID, TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, "default deck id is gold-standard");

  const normalized = normalizeTravelV2RuntimeHazardDeckSelection({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID });
  assert.equal(normalized.selectedDeckId, TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, "normalizer keeps explicit deck id");
  const valid = validateTravelV2RuntimeHazardDeckSelection(TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, { user: { isGM: true } });
  assert.equal(valid.isValid, true, "gold-standard deck validates");
  assert.equal(valid.selectedDeckId, TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, "valid deck is selected");

  const defaulted = prepareTravelV2RuntimeHazardDeckSelectionState({}, { user: { isGM: true }, defaultToGoldStandard: true });
  assert.equal(defaulted.status, "selected", "default-to-gold-standard selects safely when requested");
  assert.equal(defaulted.selectedDeckId, TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, "default selection is gold-standard");

  const none = prepareTravelV2RuntimeHazardDeckSelectionState({}, { user: { isGM: true } });
  assert.equal(none.status, "none", "missing deck reports none without default option");
  assert.ok(none.disabledReason.includes("No built-in hazard deck"), "missing deck has disabled reason");

  const unknown = prepareTravelV2RuntimeHazardDeckSelectionState({ selectedDeckId: "missing-deck" }, { user: { isGM: true } });
  assert.equal(unknown.status, "invalid", "unknown deck is invalid");
  assert.equal(unknown.selectedDeckId, null, "unknown deck is not selected");
  assert.ok(unknown.disabledReason.includes("missing-deck"), "unknown deck includes disabled reason");

  const nonGm = prepareTravelV2RuntimeHazardDeckSelectionState({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID }, { includeGmReview: true, user: { isGM: false } });
  assert.equal(nonGm.canSelect, false, "non-GM cannot select decks");
  assert.equal(hasKey(nonGm, "gmReview"), false, "non-GM cannot receive gmReview");
  assert.equal(hasKey(nonGm, "gmText"), false, "non-GM cannot receive gmText");
  assertNoForbiddenFields(nonGm);

  const gm = prepareTravelV2RuntimeHazardDeckSelectionGmState({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID }, { includeGmReview: true, user: { isGM: true } });
  assert.equal(gm.status, "selected", "GM state selects known deck");
  assert.ok(gm.gmReview, "GM state can include explicit GM review");
  assert.equal(hasKey(gm.gmReview, "gmText"), true, "GM review includes GM text only for GM");
  assertInert(gm);

  const playerSafe = prepareTravelV2RuntimeHazardDeckSelectionPlayerSafeState({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID }, { includeGmReview: true, user: { isGM: true } });
  assertNoForbiddenFields(playerSafe);
  assert.equal(hasKey(playerSafe, "gmReview"), false, "player-safe output excludes gmReview");
  assertInert(playerSafe);

  const options = { user: { isGM: true }, includeGmReview: true, defaultToGoldStandard: true, nested: { value: 1 } };
  const input = { selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, nested: { value: 2 } };
  const renderState = { existing: { value: 3 } };
  const beforeOptions = JSON.stringify(options);
  const beforeInput = JSON.stringify(input);
  const beforeRender = JSON.stringify(renderState);
  const applied = applyTravelV2RuntimeHazardDeckSelectionToRenderState(renderState, input, options);
  assert.equal(JSON.stringify(options), beforeOptions, "helper does not mutate options");
  assert.equal(JSON.stringify(input), beforeInput, "helper does not mutate input");
  assert.equal(JSON.stringify(renderState), beforeRender, "helper does not mutate renderState");
  assert.deepEqual(JSON.parse(JSON.stringify(applied)), applied, "returned state is clone-safe");
  applied.existing.value = 99;
  assert.equal(renderState.existing.value, 3, "returned render state is cloned");

  const gmAppState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: true }, uiState: { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } });
  assert.ok(gmAppState.travelV2RuntimeHazardDeckSelection, "GM app state includes runtime selection");
  assert.equal(gmAppState.travelV2RuntimeHazardDeckSelection.selectedDeckId, TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, "GM app selection keeps selected deck id");
  assert.equal(gmAppState.travelV2HazardDeckPicker.selectedDeckId, TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, "picker reflects runtime selected deck id");
  assert.equal(gmAppState.travelV2RuntimeHazardDeckSelection.activeHazardMutation.available, false, "app selection does not create active hazard records");
  const hazardsBefore = JSON.stringify(gmAppState.travelV2Hazards ?? { records: [] });
  assert.equal(hazardsBefore, JSON.stringify(gmAppState.travelV2Hazards ?? { records: [] }), "selection leaves hazard records unchanged");

  const nonGmAppState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ user: { isGM: false }, uiState: { travelV2HazardDeckPickerSelectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } });
  assert.equal(hasKey(nonGmAppState, "gmReview"), false, "non-GM app state excludes gmReview");
  assert.equal(hasKey(nonGmAppState, "gmText"), false, "non-GM app state excludes gmText");

  const sourceFiles = [
    new URL("./travel-v2-runtime-hazard-deck-selection.js", import.meta.url),
    new URL("../apps/travel-event-runner-v2-preview-consumer.js", import.meta.url)
  ];
  for (const sourceFile of sourceFiles) {
    const sourceText = readFileSync(sourceFile, "utf8");
    for (const call of FORBIDDEN_MUTATION_CALLS) assert.equal(sourceText.includes(call), false, `forbidden persistent mutation call found: ${call}`);
  }

  return { checked: ["helper imports", "gold-standard validation", "default and none semantics", "unknown deck rejection", "non-GM redaction", "GM-only review", "player-safe output", "inert draw and mutation capabilities", "immutability and clone safety", "app render-state integration", "mutation source scan"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2RuntimeHazardDeckSelectionSmokeChecks().then((result) => {
    console.log("Travel v2 runtime hazard deck selection smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
