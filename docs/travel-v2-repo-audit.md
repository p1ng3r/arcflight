# Arcflight Travel v2 Repo Audit

Status: Phase 0 draft
Branch: `travel-v2-phase-0-design-audit`
Audit source: GitHub repository review plus Travel v2 handoff notes.

## Executive Summary

Travel v2 should not be added as another layer inside the current travel runner. The module already has useful foundations, but Travel v2 needs a normalized state model and smaller engine modules before large UI changes.

Verification note: An earlier GitHub fetch appeared truncated around `rollFeedback: {`. Later fetches showed the file continues beyond that point, so this should be verified locally with `node --check scripts/helpers/travel-event-runner.js` and by comparing the local Foundry module copy against the repository before Phase 1 coding begins.

This is not a blocker unless the local `node --check` fails or the local Foundry module differs from the repository in ways that affect Travel v2.

## Confirmed Current Repository Facts

Repository:

```text
p1ng3r/arcflight
```

Default branch:

```text
main
```

PR #224 target decision:

```text
Keep PR #224 targeted at main unless a dev branch is created or confirmed as the active integration branch.
```

Reason:

```text
A repository branch search did not show a dev branch, and main is the repository default branch.
```

Module manifest:

```text
module.json
```

Current manifest target found in `module.json`:

```json
"compatibility": {
  "minimum": "14",
  "verified": "14"
}
```

This differs from older notes that mentioned a v13 target/later v14. For Travel v2, treat Foundry v14 as the current code target unless the local repo says otherwise.

## Immediate Local Verification Commands

Run these before Phase 1 coding:

```bash
cd "/c/Users/Owner/AppData/Local/FoundryVTT/Data/modules/arcflight"

git fetch origin
git checkout travel-v2-phase-0-design-audit
git status --short
node --check scripts/helpers/travel-event-runner.js
git diff --name-only main...HEAD
```

Expected good result:

```text
node --check passes with no syntax error

git diff --name-only main...HEAD shows only:
docs/travel-v2-design.md
docs/travel-v2-repo-audit.md
```

If `node --check scripts/helpers/travel-event-runner.js` fails locally, fix that before Phase 1. If the diff includes runtime files, stop and inspect before merging the docs PR.

## Keep

These systems should be preserved and wrapped, not rewritten first.

### 1. Constants layer

File:

```text
scripts/config/constants.js
```

Current strengths:

- Module id is centralized.
- Actor/item/component constants are centralized.
- Travel resources are centralized.
- Travel stations are centralized.
- Travel event categories are centralized.

Keep these constants as the canonical key source.

Important note: `ARCFLIGHT_TRAVEL_RESOURCES` currently includes six keys:

```text
hull
lifeveil
strain
morale
supplies
storedSpellRanks
```

Travel v2 pressure should use the first five as event pressure tracks. `storedSpellRanks` should remain a travel resource/fuel value, but should not be treated as a normal pressure track unless explicitly approved.

### 2. Ship document data model

File:

```text
scripts/documents/ships.js
```

Current strengths:

- Arcflight ship data already lives under flags.
- Current ship state includes hull, lifeveil, strain, morale, supplies, and stored spell ranks.
- Ship resources include hull/lifeveil/strain max-value shapes plus supplies and morale.
- Station definitions and station assignments are already part of ship defaults.
- Component install state is mature enough to support later travel upgrade effects.

Keep this as the persistent ship layer. Travel v2 event pressure should be session-scoped and only write persistent effects when applying Ship Scars, selected hazards, or explicit event results.

### 3. Travel event validation helper

File:

```text
scripts/helpers/travel-events.js
```

Current strengths:

- Travel Five validation exists.
- Travel degree normalization exists.
- Round and event outcome helpers exist.
- Event definition validation already checks category, round count, rounds, tags, active resources, travel stations, station cards, outcome branches, final outcomes, and data-only proposed effects.

Keep and extend this into the Travel v2 validator rather than replacing it.

### 4. Player station socket flow

File:

```text
scripts/apps/travel-player-station-card.js
```

Current strengths:

- Player station card socket actions exist.
- Approach submission action exists.
- Player roll action exists.
- Mission board actions exist.
- There is already owner-based targeting with fallback broadcast.

Keep the working flow while moving message names and payload shapes toward a cleaner `travel-socket-flow.js` later.

### 5. Module bootstrap/import exposure

File:

```text
scripts/arcflight.js
```

Current strengths:

- Central module entry already imports travel builder, runner, scene overlay, player station card, station actions, travel events, and ship helpers.
- This gives us a clear public API surface to stabilize during the refactor.

Do not break exposed debug/dev helpers during early phases.

## Refactor

### 1. `scripts/helpers/travel-event-runner.js`

Reason:

The handoff identifies this as too broad, and current import surfaces confirm many responsibilities are concentrated around the runner helper.

Target split, in order:

```text
scripts/helpers/travel-v2-state.js
scripts/helpers/travel-risk-engine.js
scripts/helpers/travel-pressure-engine.js
scripts/helpers/travel-hazard-deck.js
scripts/helpers/travel-ship-scars.js
scripts/helpers/travel-momentum-engine.js
scripts/helpers/travel-socket-flow.js
scripts/helpers/travel-ui-state.js
```

Do not create all at once. Start with `travel-v2-state.js` only.

### 2. `scripts/apps/travel-event-runner.js`

Reason:

The current app imports many helper functions directly and handles many click actions. Travel v2 needs this to become a GM control center, not a summary/session/debug surface.

Refactor target:

- Keep current app working.
- Add a v2 shell later.
- Prefer passing prepared UI state into templates rather than recalculating in click handlers.

### 3. `scripts/apps/travel-player-station-card.js`

Reason:

The socket flow works, but the app has socket action constants, state sanitization, owner resolution, emit functions, handlers, and app behavior together.

Refactor target:

- Preserve current behavior first.
- Move socket action constants and payload normalization into `travel-socket-flow.js` later.
- Keep UI focused on: crisis, station, order, roll, reaction.

### 4. Templates

Files:

```text
templates/apps/travel-event-runner.hbs
templates/apps/travel-player-station-card.hbs
```

Refactor target:

- Add clear named zones before art.
- Avoid full-board rerenders that reset scroll.
- Use hooks/classes for pressure, hazards, scars, focus, momentum, fortune, and thread panels.

## Replace / Deprecate

Do not delete first. Mark deprecated, route around, then remove when v2 passes smoke tests.

### Replace old pressure terminology

Terms such as `fallout` should be replaced with Travel v2 pressure/hazard/scar language.

### Replace hardcoded default Focus definitions inside the runner

Focus ability definitions should move to data definitions. The first protected one is Navigator Hard Correction.

### Replace debug-log-dependent UI flow

Console logs can remain for diagnostics, but normal GM/player operation must be understandable from the UI.

### Replace duplicated state calculation

The same session/round/player state should not be rebuilt differently in GM app, player app, and socket handlers.

## Missing / Mismatch Findings

### `scripts/helpers/travel-pressure.js` was not found on GitHub `main`

The handoff lists it as an existing file to refactor, but GitHub `main` returned 404 for that path. Check local repo before assuming deletion or recreation.

### `scripts/helpers/travel-event-runner.js` needs local syntax verification

Verification note: An earlier GitHub fetch appeared truncated around `rollFeedback: {`. Later fetches showed the file continues beyond that point, so this should be verified locally with `node --check scripts/helpers/travel-event-runner.js` and by comparing the local Foundry module copy against the repository before Phase 1 coding begins.

Recommended local commands:

```bash
cd "/c/Users/Owner/AppData/Local/FoundryVTT/Data/modules/arcflight"

git fetch origin
git checkout travel-v2-phase-0-design-audit
git status --short
node --check scripts/helpers/travel-event-runner.js
git diff --name-only main...HEAD
```

Expected good result:

```text
node --check passes with no syntax error

git diff --name-only main...HEAD shows only:
docs/travel-v2-design.md
docs/travel-v2-repo-audit.md
```

## Phase 1 Target: Shared State Model

First code PR should not touch major UI. It should add a normalized state helper with tests/smoke functions if the project has a testing pattern.

Suggested first file:

```text
scripts/helpers/travel-v2-state.js
```

Suggested responsibilities:

- normalize session state
- normalize daily event check state
- normalize current event metadata
- normalize round state
- normalize hidden risk state
- normalize pressure tracks
- normalize threshold crossing memory
- normalize hazards
- normalize Ship Scars
- normalize station Focus
- normalize Momentum
- normalize Void Fortune
- normalize Void Threads
- provide pure functions that can be called from GM UI, player UI, sockets, and tests

## Proposed Travel v2 Session Shape

```js
{
  version: 2,
  key: "",
  ship: {
    actorId: "",
    actorUuid: "",
    name: ""
  },
  dailyCheck: {
    hexKey: "",
    travelDay: 1,
    eventChance: 18,
    rolled: false,
    rollTotal: null,
    eventTriggered: false,
    override: false
  },
  event: {
    key: "",
    title: "",
    level: 1,
    severity: "moderate",
    category: "navigation",
    tags: [],
    roundCount: 3
  },
  round: {
    index: 0,
    number: 1,
    phase: "setup",
    vignette: "",
    hiddenRiskRevealed: false,
    ordersLocked: false,
    rollsRequested: false,
    resolved: false
  },
  hiddenRisk: {
    pressureType: "strain",
    failureIncrease: 1,
    criticalFailureIncrease: 2,
    pressureStation: "engineer",
    revealed: false
  },
  pressure: {
    hull: { value: 0, crossed: [] },
    strain: { value: 0, crossed: [] },
    lifeveil: { value: 0, crossed: [] },
    morale: { value: 0, crossed: [] },
    supplies: { value: 0, crossed: [] }
  },
  hazards: {
    active: [],
    discarded: []
  },
  shipScars: {
    pending: [],
    applied: []
  },
  focus: {
    navigator: { value: 1, max: 1, spent: [] },
    engineer: { value: 1, max: 1, spent: [] },
    veilwarden: { value: 1, max: 1, spent: [] },
    watchmaster: { value: 1, max: 1, spent: [] },
    captain: { value: 1, max: 1, spent: [] }
  },
  momentum: {
    value: 0,
    max: 3,
    spentThisRound: []
  },
  stationOrders: {},
  stationResults: {},
  voidFortune: {
    hand: [],
    pendingDraws: []
  },
  voidThreads: {
    offered: [],
    chosen: null
  }
}
```

## First PR Acceptance Criteria

A Phase 1 PR should pass these checks before UI work:

- Creates a normalized Travel v2 session state.
- Uses canonical constants for station/resource keys.
- Treats only Hull, Strain, Lifeveil, Morale, Supplies as pressure tracks.
- Tracks threshold crossings for pressure 2/3/4.
- Converts pressure overflow beyond 4 into a pending Ship Scar trigger.
- Includes Focus defaults for all Travel Five stations.
- Includes Momentum defaults: value 0, max 3.
- Does not alter current Hard Correction behavior.
- Does not alter current player roll request behavior.
- Does not introduce custom Actor or Item types.
- Does not require native Foundry Cards.

## Phase 1 Safe Move

After this docs PR is checked locally and merged, Phase 1 should be:

```text
Add `scripts/helpers/travel-v2-state.js` as pure model/state logic.
No UI changes.
No socket changes.
No Hard Correction changes.
No player roll flow changes.
```
