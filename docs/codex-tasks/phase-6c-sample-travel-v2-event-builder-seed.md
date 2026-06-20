# Codex Task: Phase 6C — Sample Travel v2 event builder seed

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-6c-sample-travel-v2-event-builder-seed`

## Purpose

Build a robust, playable, 3-round Travel v2 sample event and make it available through the existing Travel Event Builder workflow.

Do **not** bypass the Event Builder by writing directly into the Published Travel Event Library as the primary path.

The GM should be able to seed/load the sample into the Event Builder, review it, and publish it using the normal builder publish path. After publishing, the Travel Event Runner should see it in the Published Travel Event Library and be able to start a local runner session.

## Why this exists

The Travel Event Runner starts from the Published Travel Event Library. The Published Travel Event Library is normally populated by publishing a valid finalized event from the Travel Event Builder.

So this test sample should validate the real workflow:

```text
sample event -> Event Builder draft/sample -> normal publish path -> Published Travel Event Library -> Travel Event Runner -> local runner session
```

This keeps the roadmap order intact while making Foundry testing practical.

## Sample event concept

Use this event unless schema limitations require a small rename:

```text
The Lantern in the Static
```

Category:

```text
occult
```

Tags:

```text
sample, travel-v2, foundry-test, occult, void, arkflight, lifeveil, morale, strain
```

Length:

```text
3 rounds
```

Base DC:

```text
18 or 20, whichever best matches existing event balance.
```

Premise:

The ship crosses a dead stretch of void where a lone lantern burns inside a cloud of silver static. The lantern is not a ship, not a star, and not quite a ghost. As the crew approaches, the static repeats fragments of their own shouted orders before anyone has spoken them. Something inside the lantern wants to be rescued; something wrapped around it wants the crew to answer.

Tone:

- eerie but adventurous.
- cinematic Arkflight / void-sailing fantasy.
- table-readable.
- fun as a real encounter.
- no placeholder QA filler.

## Critical writing requirement

The vignettes must read like polished GM prose.

Avoid awkward generated phrasing such as:

```text
Nadi the Navigator Navigator failed.
Navigator's work during Round 1 turns problem into advantage.
Station X resolves problem well enough.
```

Do not produce robotic station-name repetition.
Do not expose internal outcome keys in GM-facing prose.
Do not produce generic “station problem” phrasing.
Do not include `[object Object]`, `undefined`, or templated fragments.

Round transition/result text should sound like something the GM can read aloud.

## Required implementation direction

Prefer adding the sample through an Event Builder sample/draft mechanism, not direct published-library mutation.

Acceptable implementation patterns:

### Preferred

Add the event as a **sample Event Builder draft/template** and provide a GM-only builder UI action such as:

```text
Load Sample: The Lantern in the Static
```

The GM can then inspect/edit it in the Event Builder and publish it through the existing publish path.

### Also acceptable

Add a GM-only action in the Travel Event Runner empty state that says:

```text
Open Sample in Event Builder
```

This should seed or load the sample into the Event Builder draft library, then direct the GM to publish it from the builder.

### Fallback if builder UI wiring is currently too isolated

Add a dev helper and dev smoke command that seeds the sample into the Event Builder draft library only, plus clear diagnostic UI text explaining that the GM should open the Event Builder and publish the sample.

Do not make direct published-library seeding the primary user path.

## Sample event structure

Use the existing strict authoring schema used by the Travel Event Builder and core events.

The event should include:

- key
- name
- category
- tags
- roundCount = 3
- baseDC
- activeResources
- travelStations
- openingVignette
- description
- gmSummary
- rounds
- finalOutcomes

## Round design

Use all five Travel Five stations across the event:

- Captain
- Navigator
- Engineer
- Veilwarden
- Watchmaster

### Round 1 — The Lantern Answers Before You Speak

Opening vignette should establish the hook.

Core situation:

The ship spots the lantern inside static. The static echoes orders before the crew says them. The route bends toward the light.

Station problems should include:

- Navigator: choose whether to skirt the static or approach the lantern directly.
- Engineer: keep the arkengine from synchronizing with the false echoes.
- Veilwarden: prevent the Lifeveil from carrying voices that are not aboard.
- Watchmaster: identify which echoes are predictions and which are bait.
- Captain: stop the crew from answering the voices by instinct.

### Round 2 — The Voices Know the Crew

Opening vignette should flow from round 1.

Core situation:

The lantern projects familiar voices: lost crew, old captains, family, debt-holders, dead gods, or other table-appropriate echoes. Some voices beg for rescue; others give useful warnings.

Station problems should include:

- Navigator: follow the one voice that gives a true bearing or reject all voices and trust the ship.
- Engineer: dampen resonance before the arkengine records the voices as commands.
- Veilwarden: seal emotional echoes before they leak into the Lifeveil.
- Watchmaster: spot the shape moving behind the lantern.
- Captain: decide whether to let one voice speak through the deck or order silence.

### Round 3 — The Thing Wearing the Lantern

Opening vignette should escalate.

Core situation:

The lantern cracks open and reveals the thing wrapped around it: a void parasite, echo-wraith, static angel, or similar occult void predator. This remains a travel event, not a combat statblock. The crew’s goal is to break past it, bargain with it, or sever the static tether.

Station problems should include:

- Navigator: plot the final escape line through collapsing static.
- Engineer: surge the arkengine at the exact moment the tether slackens.
- Veilwarden: keep the Lifeveil from becoming the parasite’s new lantern glass.
- Watchmaster: call the true moment to run, fire, or hide.
- Captain: commit the ship to rescue, escape, or severance.

## After-round / transition vignettes

This is the most important part.

Each round must include GM-facing transition/result prose that can be read after the round is resolved.

It must:

- combine the crew’s general actions into a coherent paragraph.
- set up the next round naturally.
- avoid repeating station names mechanically.
- avoid “X failed / Y succeeded” bookkeeping language.
- work for success, mixed, and failure outcomes.
- mention pressure/consequences fictionally when appropriate.

Use existing schema fields if possible, such as:

- `roundEndNarration`
- `outcomeBranches`
- `vignette`
- any current branch/result narration fields already accepted by validation.

If current schema is too limited, add minimal optional read-only support for improved narration fields rather than rewriting the runner.

Suggested quality floor:

### Round 1 success

```text
The crew keeps their words their own. False commands die against disciplined decks, the arkengine steadies, and the lantern’s static peels open just enough to reveal a voice that sounds frightened rather than hungry. As the ship closes the distance, that voice whispers a name someone aboard recognizes.
```

### Round 1 mixed

```text
The ship holds its line, but not cleanly. A few shouted orders come back wrong, a few ward-lamps burn blue, and the static learns enough of the crew’s rhythm to imitate them. Ahead, the lantern brightens, and the next voices it throws across the deck sound painfully familiar.
```

### Round 1 failure

```text
The first answer costs the ship. The static steals a handful of commands, twists them, and sends them running from deck to deck in voices the crew trusts. By the time discipline returns, the lantern is closer than it should be, and it has begun speaking with the dead.
```

### Round 2 success

```text
The crew listens without surrendering. Truth is separated from bait, old grief is kept outside the Lifeveil, and the lantern’s warning becomes a usable bearing. For one breath the static thins, and the thing coiled around the light can finally be seen.
```

### Round 2 mixed

```text
Some voices are answered, some are silenced, and some are carried too long in the air. The ship learns enough to continue, but the lantern learns the crew in return. A shadow folds around the light, patient and immense, and the static begins tightening like a noose.
```

### Round 2 failure

```text
The voices get inside the rhythm of the ship. The arkengine catches half a command that no living officer gave, the Lifeveil trembles with borrowed grief, and the lantern stops pretending to be alone. Something behind it opens its eyes.
```

### Round 3 success

```text
The final order lands at the exact right moment. The arkengine surges, the wards bite shut, and the ship tears free of the static with the lantern’s true flame flickering safely behind glass. Whatever wore the light is left shrieking in the wake, too late to follow.
```

### Round 3 mixed

```text
The ship escapes, but the static leaves fingerprints. A voice lingers in the rigging, one ward-lamp refuses to go dark, and the rescued lantern burns with an uneasy pulse. The crew has survived the thing in the void, but something about the crossing will need a GM’s attention when the voyage ends.
```

### Round 3 failure

```text
The ship breaks loose only by tearing through the parasite’s grasp. The lantern gutters, the static screams through the Lifeveil, and the wake behind the vessel fills with voices calling after the crew in perfect imitation. The crossing is over, but the cost follows them.
```

These do not need to be copied verbatim if the final version is better, but the final quality must be at least this readable.

## Station approach text

Every station card should include:

- clear problem statement.
- 2–3 skill approaches.
- player-facing help text.
- result feedback that does not sound robotic.
- GM narration feedback that is readable.

Example style:

```text
Failure: The bearing holds for a moment, then the static repeats it back in a voice the crew trusts. The ship keeps moving, but the route is no longer private.
```

Not:

```text
Navigator fails to resolve the route problem.
```

## Builder/publish workflow requirement

The Foundry test flow should become:

```text
Open Travel Event Builder
Load Sample: The Lantern in the Static
Review or edit it
Publish it through the existing Publish Current Draft path
Open Travel Event Runner
Select The Lantern in the Static
Start Local Runner Session
```

If UI surface area is limited, then add clear text to the Runner diagnostics that says the sample must be loaded/published through the Event Builder before it appears in the Runner.

## Safety boundaries

Allowed:

- add sample event data/template.
- add builder sample loading/seeding helper.
- add GM-only builder UI action if consistent with existing UI.
- write to Event Builder draft library only after explicit GM action.
- publish through existing builder publish path.
- improve runner diagnostics text.
- add smoke tests.

Not allowed:

- direct published-library seeding as primary path.
- actor mutation.
- item mutation.
- chat messages.
- journal creation.
- sockets.
- automatic session creation.
- automatic event completion.
- automatic effect application.
- changing pressure math.
- changing outcome package logic except minimal read-only narration support if required.

## Smoke tests

Add or update tests for:

1. Sample event exists.
2. Sample event validates with strict authoring.
3. Sample event has exactly 3 rounds.
4. Every round has readable opening vignette.
5. Every round has readable transition/result vignettes.
6. Transition/result vignettes do not contain obvious robotic phrases:
   - `Navigator Navigator`
   - `undefined`
   - `[object Object]`
   - `resolves "`
   - `turns "`
   - `station problem`
7. Every station card has player-facing text and GM-facing narration text.
8. Sample can be loaded/seeded into the Event Builder draft library.
9. Sample can pass the existing publish validation path from the builder.
10. Aggregate `run-travel-v2-smoke.mjs` includes the new sample/builder checks.

Recommended runner:

```bash
node scripts/dev/run-travel-v2-sample-event-smoke.mjs
```

Update aggregate:

```bash
node scripts/dev/run-travel-v2-smoke.mjs
```

## Acceptance checks

Run:

```bash
node --check data/travel-events/core-travel-events.js
node --check scripts/helpers/travel-event-builder.js
node --check scripts/apps/travel-event-builder.js
node --check scripts/apps/travel-event-runner.js
node --check scripts/apps/travel-event-runner-v2-preview-template.smoke.js
node scripts/dev/run-travel-v2-sample-event-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

## Expected Foundry result

A GM can load `The Lantern in the Static` into the Travel Event Builder, publish it through the existing builder publish workflow, open the Travel Event Runner, select it from the Published Travel Event Library, click `Start Local Runner Session`, choose a ship/PF2E vehicle, and get a real local runner session with a fun 3-round encounter ready for testing.
