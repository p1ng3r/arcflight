import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, getTravelV2BuiltInHazardDeck, listTravelV2BuiltInHazardDecks, prepareTravelV2BuiltInHazardDeckGmReview, prepareTravelV2BuiltInHazardDeckPickerState, prepareTravelV2BuiltInHazardDeckPlayerSafeSummary, validateTravelV2BuiltInHazardDeck, validateTravelV2BuiltInHazardDeckRegistry } from "./travel-v2-hazard-deck-registry.js";

const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);
const FORBIDDEN_MUTATION_CALLS = Object.freeze(["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"]);

function assertNoForbiddenFields(value) {
  if (!value || typeof value !== "object") return;
  for (const field of FORBIDDEN_PLAYER_SAFE_FIELDS) assert.equal(Object.hasOwn(value, field), false, `player-safe projection leaked ${field}`);
  for (const nested of Object.values(value)) Array.isArray(nested) ? nested.forEach(assertNoForbiddenFields) : assertNoForbiddenFields(nested);
}

export default async function runTravelV2HazardDeckRegistrySmokeChecks() {
  const listed = listTravelV2BuiltInHazardDecks();
  assert.ok(listed.some((deck) => deck.id === TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID), "gold-standard deck is listed");
  const deck = getTravelV2BuiltInHazardDeck(TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, { includeGmReview: true });
  assert.equal(deck.id, TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, "lookup by id returns deck");
  assert.equal(getTravelV2BuiltInHazardDeck("missing-deck"), null, "missing deck returns null");

  const validation = validateTravelV2BuiltInHazardDeck(TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(validateTravelV2BuiltInHazardDeckRegistry().ok, true, "registry validates");
  assert.equal(deck.cardCount, 12, "gold-standard deck reports exactly 12 cards");
  assert.ok(deck.categories.length > 0, "categories are derived");
  assert.ok(deck.severities.length > 0, "severities are derived");
  assert.ok(deck.stationKeys.length > 0, "station keys are derived");
  assert.ok(deck.consequenceRefs.length > 0, "consequence refs are derived");

  const playerSafe = prepareTravelV2BuiltInHazardDeckPlayerSafeSummary(TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID);
  assert.equal(playerSafe.ok, true, playerSafe.errors.join("\n"));
  assertNoForbiddenFields(playerSafe.summary);
  const gmReview = prepareTravelV2BuiltInHazardDeckGmReview(TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID);
  assert.equal(gmReview.ok, true, "GM review validates");
  assert.ok(gmReview.review.cards.some((card) => typeof card.gmText === "string" && card.gmText.length > 0), "GM review includes GM-only review data");

  const picker = prepareTravelV2BuiltInHazardDeckPickerState({ selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID });
  assert.equal(picker.validation.ok, true, "picker validates");
  assert.equal(picker.selectedDeckId, TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, "valid selected deck retained");
  assertNoForbiddenFields(picker);
  const invalidPicker = prepareTravelV2BuiltInHazardDeckPickerState({ selectedDeckId: "missing-deck" });
  assert.equal(invalidPicker.validation.ok, false, "invalid selected deck disables picker state");
  assert.ok(invalidPicker.disabledReason.includes("missing-deck"), "invalid selected deck has disabled reason");

  const copy = getTravelV2BuiltInHazardDeck(TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID);
  copy.cards[0].title = "Mutated Copy";
  assert.notEqual(getTravelV2BuiltInHazardDeck(TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID).cards[0].title, "Mutated Copy", "deck getter returns clones");
  const options = { selectedDeckId: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID };
  const beforeOptions = JSON.stringify(options);
  prepareTravelV2BuiltInHazardDeckPickerState(options);
  assert.equal(JSON.stringify(options), beforeOptions, "helper does not mutate options");

  const sourceText = readFileSync(new URL("./travel-v2-hazard-deck-registry.js", import.meta.url), "utf8");
  for (const call of FORBIDDEN_MUTATION_CALLS) assert.equal(sourceText.includes(call), false, `forbidden persistent mutation call found: ${call}`);

  return { checked: ["registry imports and listing", "lookup and missing id", "deck validation", "registry validation", "derived coverage", "player-safe redaction", "GM review", "picker state", "immutability", "mutation source scan"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2HazardDeckRegistrySmokeChecks().then((result) => {
    console.log("Travel v2 built-in hazard deck registry smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
