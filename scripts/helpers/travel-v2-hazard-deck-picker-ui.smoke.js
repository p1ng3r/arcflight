import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID } from "./travel-v2-hazard-deck-registry.js";
import { prepareTravelV2HazardDeckPickerCardRows, prepareTravelV2HazardDeckPickerDeckRows, prepareTravelV2HazardDeckPickerSelectedDeckPanel, prepareTravelV2HazardDeckPickerUiState } from "./travel-v2-hazard-deck-picker-ui.js";

const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);
const FORBIDDEN_MUTATION_CALLS = Object.freeze(["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"]);

function assertNoForbiddenFields(value) {
  if (!value || typeof value !== "object") return;
  for (const field of FORBIDDEN_PLAYER_SAFE_FIELDS) assert.equal(Object.hasOwn(value, field), false, `player-safe picker state leaked ${field}`);
  for (const nested of Object.values(value)) Array.isArray(nested) ? nested.forEach(assertNoForbiddenFields) : assertNoForbiddenFields(nested);
}
function hasGmText(value) {
  if (!value || typeof value !== "object") return false;
  if (Object.hasOwn(value, "gmText")) return true;
  return Object.values(value).some((nested) => Array.isArray(nested) ? nested.some(hasGmText) : hasGmText(nested));
}

export default async function runTravelV2HazardDeckPickerUiSmokeChecks() {
  const deckRows = prepareTravelV2HazardDeckPickerDeckRows({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID });
  assert.ok(deckRows.some((deck) => deck.id === TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID), "gold-standard deck appears in picker rows");
  assert.equal(deckRows.find((deck) => deck.id === TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID).selected, true, "selected row is marked selected");

  const selectedPanel = prepareTravelV2HazardDeckPickerSelectedDeckPanel(TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, { user: { isGM: true } });
  assert.equal(selectedPanel.selectedDeckId, TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, "selected panel retains valid deck id");
  assert.equal(selectedPanel.isValid, true, "selected panel is valid");
  assert.equal(selectedPanel.canDraw, false, "draw remains disabled");
  assert.equal(selectedPanel.canActivate, false, "activate remains disabled");
  assert.equal(selectedPanel.canPersistSelection, false, "persist remains disabled");
  assert.equal(selectedPanel.canImport, false, "import remains disabled");

  const missingPanel = prepareTravelV2HazardDeckPickerSelectedDeckPanel("missing-deck", { user: { isGM: true } });
  assert.equal(missingPanel.selectedDeckId, null, "missing deck is not selected");
  assert.ok(missingPanel.disabledReason.includes("missing-deck"), "missing deck has disabled reason");

  const defaultState = prepareTravelV2HazardDeckPickerUiState({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, user: { isGM: true } });
  assertNoForbiddenFields(defaultState);
  assert.equal(hasGmText(defaultState), false, "default GM picker state omits gmText unless review requested");
  const defaultCards = prepareTravelV2HazardDeckPickerCardRows(TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID);
  assertNoForbiddenFields(defaultCards);

  const gmReview = prepareTravelV2HazardDeckPickerUiState({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, includeGmReview: true, user: { isGM: true } });
  assert.equal(hasGmText(gmReview.selectedDeckReview), true, "explicit GM review includes gmText");
  assert.equal(hasGmText(gmReview.selectedDeckPanel.cardRows), true, "explicit GM card rows include gmText");

  const nonGmReview = prepareTravelV2HazardDeckPickerUiState({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, includeGmReview: true, user: { isGM: false } });
  assert.equal(nonGmReview.isVisible, false, "non-GM picker is not visible");
  assertNoForbiddenFields(nonGmReview);
  assert.equal(hasGmText(nonGmReview), false, "non-GM review request omits gmText");

  const options = { selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, includeGmReview: true, user: { isGM: true }, nested: { value: 1 } };
  const beforeOptions = JSON.stringify(options);
  const cloneSafe = prepareTravelV2HazardDeckPickerUiState(options);
  assert.equal(JSON.stringify(options), beforeOptions, "picker helper does not mutate options");
  assert.deepEqual(JSON.parse(JSON.stringify(cloneSafe)), cloneSafe, "picker state is JSON clone-safe");

  const sourceText = readFileSync(new URL("./travel-v2-hazard-deck-picker-ui.js", import.meta.url), "utf8");
  for (const call of FORBIDDEN_MUTATION_CALLS) assert.equal(sourceText.includes(call), false, `forbidden persistent mutation call found: ${call}`);

  return { checked: ["helper imports", "deck rows", "selected panel", "missing deck disabled state", "player-safe default state", "GM-only review state", "non-GM redaction", "inert capabilities", "immutability and clone safety", "mutation source scan"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2HazardDeckPickerUiSmokeChecks().then((result) => {
    console.log("Travel v2 hazard deck picker UI smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
