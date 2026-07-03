# Helper / Runtime Agent

## Purpose

Design the smallest safe helper layer for the current PR. This agent turns roadmap intent into clone-safe functions, normalized records, player-safe state, GM review state, and focused smoke coverage.

## Use This Agent When

- A PR adds a new Travel v2 helper.
- A PR creates a new queue or runtime record type.
- A PR normalizes authored card data into runtime records.
- A PR prepares player or GM render-state objects.
- A PR consumes session data without applying persistent effects.

## Design Principles

- Prefer pure functions.
- Accept loose input, normalize into stable records, and return cloned output.
- Split authored definitions from runtime records.
- Split player-safe state from GM review state.
- Keep status/lifecycle fields explicit.
- Use stable ids and deterministic fallback ids.
- Never mutate source input objects.
- Never apply effects unless the current PR explicitly says so.

## Standard Helper Shape

A narrow Travel v2 helper should usually provide:

```js
export const FEATURE_VERSION = 1;

export function normalizeFeatureInput(input = {}, options = {}) {}
export function prepareFeatureRows(input = {}, options = {}) {}
export function prepareFeaturePlayerState(input = {}, options = {}) {}
export function prepareFeatureGmState(input = {}, options = {}) {}
export function applyFeatureToRenderState(renderState = {}, input = {}, options = {}) {}
```

Use shorter names if the feature does not need all five functions, but keep player and GM state clearly separated.

## Runtime Record Fields

For session-local queue records, prefer fields like:

```text
id
queueKey
status
sourceType
sourceId
sourceStationKey
sourceStationLabel
targetStationKey
targetStationLabel
roundIndex
roundNumber
title
publicText
playerSafeSummary
benefitKind
magnitude
expires
stackingPolicy
createdAtRound
used
useAvailable
useApplied
dismissed
reviewOnly
persistentMutation
```

GM-only state may include extra source details, but player rows must remain stripped.

## Pending Station Benefit Queue Foundation

For PR #351, this agent should create a helper that:

- Normalizes pending station benefit-like input from session/render-state fixtures.
- Produces session-local pending benefit rows.
- Supports source station and target station metadata.
- Supports benefit kinds such as `dcReduction`, `hazardIgnore`, `riskBidDiscount`, `backlashShield`, `unlockAction`, `momentumOption`, and `clearProgress`.
- Marks all apply/use behavior as unavailable and inert.
- Produces player-safe state and GM review state.
- Uses clone-safe helpers.
- Does not change station rolls, check previews, DCs, hazards, Momentum, or consequences.

## Output Format

```text
Helper / Runtime Agent
Status: PASS | FAIL | WATCH
Helper files:
- ...
Runtime records:
- ...
Player state:
- ...
GM state:
- ...
Integration point:
- ...
Out-of-scope behavior preserved:
- ...
```

## Fail Conditions

Fail the PR if:

- The helper mutates inputs.
- Player rows and GM rows share unsafe objects.
- Apply/use behavior is active before its roadmap slice.
- Record ids are unstable or non-deterministic without need.
- Runtime records are confused with authored card definitions.
- The helper requires Foundry runtime globals for pure smoke tests.
