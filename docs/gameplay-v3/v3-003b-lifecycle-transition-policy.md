# Gameplay V3-003B — Voyage Encounter Lifecycle Transition Policy

## Purpose

This slice adds a pure-JavaScript policy layer that describes the legal Voyage
Encounter lifecycle graph. It evaluates proposed lifecycle changes only: it
does not mutate an encounter, increment a revision, issue commands, emit domain
events, persist data, or access Foundry globals.

## Accepted transition graph

- Draft → Configuration
- Configuration → Draft, Ready, Recovery, or Discarded
- Ready → Configuration, Active, Recovery, or Discarded
- Active → Paused, Recovery, Completed Success, Completed Failure, or Abandoned
- Paused → Active, Recovery, Abandoned, or Discarded
- Recovery → Configuration, Ready, Active, Paused, Abandoned, or Discarded
- Completed Success, Completed Failure, Abandoned, and Discarded have no normal
  transitions.

The policy uses the existing `VOYAGE_ENCOUNTER_LIFECYCLE_STATES` constants for
all lifecycle values.

## Public helpers

The following helpers are exported from `scripts/voyage/domain/lifecycle.js`
and registered through both `game.arcflight` and `game.arcflight.devTools`:

- `getAllowedVoyageLifecycleTransitions(lifecycleState)` returns recognized
  legal target states, or an empty array for an unrecognized or terminal source.
- `isLegalVoyageLifecycleTransition(fromLifecycleState, toLifecycleState)`
  returns `true` only for an explicit graph edge between distinct recognized
  states.
- `validateVoyageLifecycleTransition(fromLifecycleState, toLifecycleState)`
  returns a structural validation report without changing state.
- `getVoyageLifecycleTransitionPolicy()` returns a complete inspectable copy of
  the graph.

## Immutability guarantees

The transition graph is private to the lifecycle module and its policy object
and transition arrays are frozen. Every public inspection helper returns fresh
plain-data arrays or objects. Changing a returned array or policy object cannot
change future helper results or transition legality.

## Validation result format

`validateVoyageLifecycleTransition` returns:

```js
{
  valid,
  errors: [{ code, path, message, severity }],
  warnings: []
}
```

It distinguishes invalid source and target lifecycle values, same-state
requests, and recognized but illegal graph edges using stable error codes:
`invalid-source-lifecycle-state`, `invalid-target-lifecycle-state`,
`same-lifecycle-state`, and `illegal-lifecycle-transition`.

## Explicitly deferred

- lifecycle mutation, commands, request IDs, revisions, and domain events;
- Ready construction, activation, pause/resume, completion, abandonment,
  discard, and recovery execution;
- snapshots, persistence, sockets, multiplayer authority, permissions, and
  PF2e document checks;
- projections, UI, migrations, track mutation, station planning, Risk Bids,
  reservations, and combat.
