# Gameplay V3-003A — Voyage Encounter Core State Foundation

## Scope

This change adds the first pure-JavaScript, serializable Voyage Encounter state
contract. It establishes a Draft encounter shape only; it does not persist,
activate, mutate, transition, reset, or render an encounter.

## Public helpers

The following helpers are exposed through `game.arcflight` and
`game.arcflight.devTools`:

- `createVoyageEncounterState(input?, context?)`
- `normalizeVoyageEncounterState(value)`
- `validateVoyageEncounterState(value)`

The domain helpers themselves do not access Foundry globals. The registration
layer alone attaches their imported references to Arcflight's existing API.

## Draft contract

`createVoyageEncounterState` creates a new plain-data object with schema version
`1`, a stable encounter ID, lifecycle state `draft`, revision `0`, and explicit
inactive (`null`) stage, round, and phase values. It creates fresh arrays and
objects for every encounter, so callers cannot share mutable default state.

The optional `context.idGenerator` supports deterministic host-side ID creation.
Without it, generation uses platform randomness when available and a JavaScript
fallback otherwise; it does not require Foundry APIs.

## Normalization and validation

Normalization is non-mutating and restores required array and object
collections. It preserves unrecognized enum values so validation can report
corrupt or unsupported data rather than silently changing it.

Validation is structural and returns `{ valid, errors, warnings }`. Each issue
has `code`, `path`, `message`, and `severity`. It checks state shape, lifecycle
requirements, active-round requirements, track and threshold configuration,
permanent consequence status/timing, duplicate identifiers, snapshots, and
recovery data. Gameplay legality, document references, and state transitions
remain future work.

## Explicitly deferred

- Foundry persistence, sockets, and multiplayer authority;
- lifecycle transitions and activation;
- track and threshold mutation or execution;
- permanent consequence commitment and reset execution;
- PF2e checks, UI, and projections.
