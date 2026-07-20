# Gameplay V3-003E: Configuration-to-Ready Voyage Lifecycle Application

## Purpose

`applyVoyageEncounterReadyTransition(encounterState)` is the specialized, pure-JavaScript domain operation for the accepted `Configuration -> Ready` Voyage Encounter lifecycle edge. It prepares a fully configured encounter for later activation; it does not activate play.

## Readiness and validation order

The operation first delegates all Configuration readiness requirements to `validateVoyageEncounterActivationReadiness`. A readiness failure is returned unchanged. For a ready encounter, it validates the lifecycle edge to `Ready`, recursively clones the supplied plain-data state, changes `lifecycleState` to `ready`, increments `revision` once, and validates the complete candidate with `validateVoyageEncounterState`.

Warnings on later outcomes are fresh arrays ordered as readiness warnings, lifecycle-transition warnings, and candidate-validation warnings. This operation is Configuration-only because the readiness validator rejects every other lifecycle state.

## Contracts and atomicity

Success returns `{ ok: true, nextState, events, errors: [], warnings }`, with exactly one event:

```js
{
  type: "voyage.lifecycle-transitioned",
  encounterId,
  fromLifecycleState: "configuration",
  toLifecycleState: "ready",
  previousRevision,
  revision
}
```

Every failure returns `{ ok: false, nextState: null, events: [], errors, warnings }`. Readiness, lifecycle-policy, and final candidate-validation failures are atomic: no candidate or event is returned and the input remains unchanged.

## State boundary and clone isolation

On success, the only fields whose values may differ are `lifecycleState` and `revision`; the revision is exactly the supplied revision plus one. All other known and forward-compatible plain-data fields are preserved. Recursive cloning isolates all mutable nested plain objects and arrays in the returned state from the input.

Ready preserves the validated inactive round context. It does not initialize a round, change phase, clear the current stage, create snapshots, or apply stage-entry effects.

## Foundry and deferred work

The domain module has no Foundry dependency and does not access game state, documents, sockets, UI, PF2e classes, or persistence. Ready-to-Active activation, round initialization, snapshots, stage effects, authority, persistence, projections, and UI remain deferred to later Gameplay V3 work.
