# Codex Task: Phase 6D — Round vignette composer fix

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-6d-round-vignette-composer-fix`

## Purpose

Fix the Travel Event Runner narration output so after-round vignettes read like a coherent GM narration instead of a round vignette followed by repetitive station-result boilerplate.

This is a direct follow-up to Phase 6C. The sample event now exists and can be loaded through the Event Builder, but the runner currently composes round result text badly.

## User-visible problem

In Foundry, the after-round text can look like this:

```text
The crew keeps their words their own. False commands die against disciplined decks, the arkengine steadies, and the lantern's static peels open just enough to reveal a voice that sounds frightened rather than hungry. As the ship closes the distance, that voice whispers a name someone aboard recognizes. Borin Gearmantle, the Engineer, the plan only partly holds, leaving a bruise of silver noise where the crew expected certainty. Pip Bramblehook, the Watchmaster, the plan only partly holds, leaving a bruise of silver noise where the crew expected certainty. Cassian Vey, the Captain, the plan only partly holds, leaving a bruise of silver noise where the crew expected certainty. Nara Starwing, the Navigator, the plan lands cleanly; the crew gains a clear read on the static and keeps the ship's intent private. Sella Moonspoke, the Veilwarden, the plan lands cleanly; the crew gains a clear read on the static and keeps the ship's intent private.
```

This is unacceptable as a GM-facing vignette.

Problems:

- repetitive phrase spam.
- station names appended mechanically.
- station role repeated in a clumsy way.
- no narrative flow.
- the final text reads like a log dump, not a story.
- the strong round transition is weakened by boilerplate.

## Design goal

The runner should produce **one readable after-round vignette** that combines the round result and the crew’s station outcomes into a smooth paragraph or two.

It should not concatenate station result feedback verbatim.

## Expected narrative style

Good output should sound like this kind of prose:

```text
The crew keeps their words their own. False commands die against disciplined decks, the arkengine steadies, and the lantern's static peels open just enough to reveal a voice that sounds frightened rather than hungry. The engine room still carries a bruise of silver noise, and the watch crews report a few echoes that learned too much, but the command deck keeps panic from spreading. Nara's clean bearing and Sella's steady warding give the ship enough privacy to close the distance. As the lantern brightens, that frightened voice whispers a name someone aboard recognizes.
```

Or:

```text
The ship holds its line, but not cleanly. Some orders come back wrong, ward-lamps burn blue, and the static learns enough of the crew's rhythm to imitate them. The engineer and watch crews spend the last seconds of the round fighting false echoes in the machinery and along the rails, while the command deck forces silence back into place. A true bearing finally cuts through the noise, and the Lifeveil tightens around the living crew. Ahead, the lantern brightens, and the next voices it throws across the deck sound painfully familiar.
```

Do not copy these exactly unless appropriate. Use them as quality targets.

## Required behavior

When a round is resolved/finalized, the GM-facing narration should:

1. Start from the chosen round-level result vignette when available.
2. Fold station outcomes into one narrative summary.
3. Group repeated station results instead of repeating the same phrase.
4. Mention character names and/or station roles naturally, not mechanically.
5. Avoid repeating the same station feedback phrase more than once.
6. Avoid internal outcome keys.
7. Avoid robotic phrases such as:
   - `the plan only partly holds` repeated multiple times.
   - `StationName StationName`.
   - `Navigator Navigator`.
   - `resolves "`.
   - `turns "`.
   - `station problem`.
   - `undefined`.
   - `[object Object]`.
8. Keep the output concise enough to read at the table.

## Implementation guidance

Find where the runner composes the round result / finalization text. It is likely taking:

- round-level `roundEndNarration` or `outcomeBranches`
- station assignments
- station roll outcomes
- station feedback text

and joining them directly.

Replace this with a small pure helper, for example:

```text
composeTravelV2RoundVignetteNarration(...)
```

or a similarly named helper near the current round-finalization/result-prep code.

The helper should be pure and smoke-testable.

### Suggested composition model

Input:

- round title
- round result key/label
- selected round-level vignette
- station result records/assignments
- station names/character names if available
- station feedback text if useful

Output:

- `text`
- `stationSummaryText`
- optional `warnings`

Rules:

- Use the round-level vignette as the backbone.
- Classify stations into success-like and failure-like groups.
- Do not print identical station feedback lines more than once.
- Prefer role-based narrative phrases over per-station logs.
- Include names sparingly:
  - good: `Nara's clean bearing and Sella's steady warding...`
  - bad: `Nara Starwing, the Navigator, the plan lands cleanly...`
- If all stations share the same broad result, summarize them together.
- If mixed, summarize successes and costs in separate clauses.
- If data is missing, degrade gracefully without `undefined`.

## Boundaries

Do not change pressure math.
Do not change station outcome calculation.
Do not change round finalization rules.
Do not change event completion rules.
Do not change outcome package logic.
Do not mutate actors/items/chat/journals/sockets.
Do not rewrite the runner.
Do not remove station-level result data from internal state; only improve GM-facing prose.

## Sample-event text cleanup

If the sample event’s `APPROACH_FEEDBACK` is too generic and contributes to repeated narration, improve it.

However, the real fix should be in the runner composition, because any future event could have repeated station feedback.

The sample event should still validate and remain builder-loadable.

## Smoke tests

Add a dedicated smoke test for the composer, for example:

```text
scripts/apps/travel-event-runner-v2-round-vignette-composer.smoke.js
```

or a helper smoke test if the helper lives under `scripts/helpers`.

Test cases must include:

1. Mixed station outcomes produce one coherent paragraph, not five repeated station lines.
2. Three stations with identical failure feedback do not repeat the same sentence three times.
3. Two stations with identical success feedback do not repeat the same sentence twice.
4. Names and station roles are included naturally when available.
5. Missing character names degrade to station roles cleanly.
6. Missing station feedback does not produce `undefined` or `[object Object]`.
7. Output does not contain known robotic phrases.
8. Output keeps the round-level vignette backbone.
9. The exact reported failure case from the user no longer produces repeated “the plan only partly holds” lines.

Also update aggregate smoke:

```bash
node scripts/dev/run-travel-v2-smoke.mjs
```

## Acceptance checks

Run:

```bash
node --check scripts/apps/travel-event-runner.js
node --check data/travel-events/sample-travel-v2-events.js
node scripts/dev/run-travel-v2-sample-event-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Add node --check for any new helper/smoke files.

## Expected Foundry result

After a round is resolved/finalized in `The Lantern in the Static`, the displayed GM text should read as a coherent after-round vignette. It should combine the crew’s actions, mention important station results naturally, and set up the next round without repetitive boilerplate.
