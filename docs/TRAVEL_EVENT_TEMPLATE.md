# Arcflight Travel Event Authoring Template

## Purpose

The Travel Event Authoring Template is the canonical MVP shape for Arcflight travel events. It gives future core event packs, future GM-builder work, and table-facing event prose one shared structure without adding custom event creation, import/export, compendium packs, automatic combat start, or automatic effect application in Phase 0.

Travel events should remain data-first. Runner UI and future tools should consume event data rather than hardcoding event content into UI logic.

## Canonical Event Object

```js
{
  key,
  name,
  category,
  tags,
  roundCount,
  baseDC,
  activeResources,
  travelStations,
  description,
  gmSummary,
  rounds,
  finalOutcomes,
  rewards,
  futureAutomationNotes
}
```

- `key`: stable event id.
- `name`: table-facing name.
- `category`: one known Arcflight travel event category.
- `tags`: string tags for filtering and future pack tooling.
- `roundCount`: number of rounds in `rounds`.
- `baseDC`: default station DC before round or prompt modifiers.
- `activeResources`: travel resources this event may pressure or reward.
- `travelStations`: usually the Travel Five: `navigator`, `engineer`, `veilwarden`, `watchmaster`, `captain`.
- `description`: table/library description.
- `gmSummary`: practical GM run note.
- `rounds`: ordered round objects.
- `finalOutcomes`: event-level outcome objects.
- `rewards`: event-level rewards list.
- `futureAutomationNotes`: non-executable notes for later tooling.

## Canonical Round Object

```js
{
  round,
  title,
  openingVignette,
  activeStations,
  outcomeBranches
}
```

- `round`: 1-based round number.
- `title`: round title.
- `openingVignette`: table-ready read-aloud prose.
- `activeStations`: station prompt objects for the round.
- `outcomeBranches`: keyed by `dominantSuccess`, `mixed`, `dominantFailure`, and `catastrophicFailure`.

## Canonical Station Prompt Object

```js
{
  stationKey,
  stationName,
  vignette,
  playerAction,
  suggestedSkills,
  dcModifier,
  resourceOptions,
  rollFeedback
}
```

- `stationKey`: Travel Five key.
- `stationName`: optional display label; tools may derive it from station data.
- `vignette`: what the station faces.
- `playerAction`: what players actually do.
- `suggestedSkills`: PF2E statistic keys or lore/statistic options.
- `dcModifier`: optional modifier applied to the event base DC.
- `resourceOptions`: table-facing choices or tradeoffs; they are not automatic mechanics.
- `rollFeedback`: four degree-based feedback quips.

## Roll Feedback Object

```js
{
  criticalSuccess,
  success,
  failure,
  criticalFailure
}
```

Each value should be a non-empty, one-sentence post-roll quip.

## Outcome Branch Object

```js
{
  vignette,
  proposedEffects,
  nextRoundNotes,
  combatHandoff,
  handoffNotes
}
```

- `vignette`: fiction update before effects.
- `proposedEffects`: staged data only.
- `nextRoundNotes`: optional GM note for the next round.
- `combatHandoff`: optional metadata flag only.
- `handoffNotes`: optional GM-facing metadata note.

## Final Outcome Object

```js
{
  label,
  vignette,
  proposedEffects,
  rewards,
  losses,
  combatHandoff,
  handoffNotes
}
```

Final outcomes close the travel event and may stage proposed effects, rewards, losses, and handoff metadata.

## Prose Length Standards

1. **Event description:** 2–4 sentences. Explain the situation and gameplay feel.
2. **GM summary:** 2–4 practical GM-facing sentences. Explain how to run the event and what consequences it creates.
3. **Round 1 opening vignette:** event-opening read-aloud paragraph, usually 4–6 sentences. Lay setting, mood, stakes, and immediate tension.
4. **Later round opening vignette:** one table-ready paragraph, usually 3–5 sentences. Set scene, mood, and immediate danger.
5. **Station prompt vignette:** 1–2 evocative sentences describing what the station faces.
6. **Station prompt player action:** 1–2 sentences explaining what the players actually do at that station.
7. **Station prompt roll feedback:** four short, one-sentence post-roll quips keyed by degree.
8. **Outcome branch vignette:** 2–4 sentences describing what changes in the fiction before proposed effects.
9. **Final outcome vignette:** 3–5 sentences with a satisfying closing beat.

## Tone Standards

Arcflight travel events should feel like high fantasy voidsailing:

- beautiful
- dangerous
- haunted
- adventurous
- strange
- mythic
- clear enough to run at the table

Use broad genre inspiration only. Do not imitate any specific author’s wording. Do not use grim political brutality or a Game of Thrones-style tone.

Arcflight ships are voidsailing space vessels crossing the Star Sea, Black Tides, and the Void Between Fires. Nautical words are acceptable as ship culture or metaphor, but travel events should frame the environment as magical voidsailing and should not read like mundane ocean travel.

## Proposed Effects Supported MVP Shape

`proposedEffects` are staged data objects. They may describe resource changes or GM-facing modifiers, but the event data must not contain executable functions.

Supported MVP examples:

```js
{ type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
{ type: "modifier", target: "nextRound.navigator.dc", mode: "add", value: 2, label: "Next Navigator DC +2" }
```

The Travel Runner previews supported resource effects and applies them only when a GM explicitly clicks Apply. Unsupported proposed effects remain manual notes.

## Combat Handoff Metadata Rule

`combatHandoff` is informational metadata only. Arcflight travel events do not start combat automatically, create encounters, roll initiative, or move into tactical rounds.

Use `handoffNotes` to tell the GM what threat or scene is ready if they choose to transition manually.

## PF2E Degree Note

Arcflight does not implement custom natural 20/natural 1 degree logic for PF2E roll buttons. PF2E handles degree of success natively when rolling against a DC: a natural 20 improves the result by one degree, and a natural 1 worsens it by one degree.

Manual result entry remains a GM-selected degree.

## Example Mini Event Skeleton

```js
const event = game.arcflight.createBlankTravelEventTemplate({
  key: "sample-event",
  name: "Sample Event",
  category: "discovery",
  roundCount: 2,
  baseDC: 18
});

// Fill in event.description, event.gmSummary, each round openingVignette,
// station vignettes, playerAction, rollFeedback, outcome branches, and final outcomes.
```

A station prompt can be created independently:

```js
game.arcflight.createBlankStationPromptTemplate("navigator");
```

## Checklist for Event Authors

- [ ] Event uses the canonical event keys.
- [ ] Category and active resources use known Arcflight constants.
- [ ] Travel stations are Travel Five keys unless a future phase expands the model.
- [ ] Description and GM summary meet length and clarity standards.
- [ ] Every round has a table-ready `openingVignette`.
- [ ] Every station prompt has `vignette`, `playerAction`, `suggestedSkills`, and four-key `rollFeedback`.
- [ ] Every round has all four outcome branches.
- [ ] Every final outcome has label, vignette, proposed effects, rewards, and losses.
- [ ] Proposed effects are data objects, not functions.
- [ ] Combat handoff is metadata only.
- [ ] No event data relies on travel action economy spending or automatic combat start.
- [ ] `validateTravelEventDefinition(event, { strictAuthoring: true })` passes before content is considered template-complete.
