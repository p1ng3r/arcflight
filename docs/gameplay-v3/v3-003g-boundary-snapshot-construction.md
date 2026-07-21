# Gameplay V3-003G: Voyage Boundary Snapshot Construction

## Purpose

`createVoyageEncounterBoundarySnapshot(encounterState, snapshotRequest)` is a Foundry-free domain helper that constructs one immutable-in-practice, recursively cloned boundary snapshot from an already-valid Active Voyage Encounter. It establishes the snapshot data contract that a future Ready-to-Active application will use to construct the first round-start snapshot and then the first Situation phase-start snapshot.

The helper only constructs and validates data. It does not append a snapshot, change lifecycle or revision values, initialize an encounter, generate IDs or timestamps, apply effects, restore state, persist documents, build projections, use sockets, check authority, or perform PF2e work.

## Result and input contracts

The request must be a plain object with an explicitly caller-supplied, non-blank `snapshotId` and a `boundaryType` of either `"round-start"` or `"phase-start"`. The ID is copied exactly as supplied; the helper never trims it for output or generates an identifier.

Success returns `{ ok: true, snapshot, errors: [], warnings }`. Failure returns `{ ok: false, snapshot: null, errors, warnings }`. Each new error has `code`, `path`, `message`, and `severity: "error"`. Existing encounter-validation errors and warnings are returned unchanged if initial state validation fails; later results use a new warnings array.

Construction is Active-only. A structurally valid non-Active encounter receives `boundary-snapshot-requires-active`. The helper also validates the request and requires a non-blank `currentStage.stageId` after state validation succeeds.

## Snapshot shape

Successful snapshots contain exactly these top-level fields:

```js
{
  snapshotId,
  boundaryType,
  lifecycleState,
  stageId,
  roundNumber,
  phase,
  temporaryState
}
```

Both supported boundary types capture the supplied recognized Active phase exactly; this helper does not hard-code Situation.

`temporaryState` is a plain object containing exactly these fields, in order, each recursively copied with `clonePlainData`:

1. `currentSituation`
2. `objective`
3. `participants`
4. `availableStations`
5. `temporaryStationAssignments`
6. `currentStage`
7. `roundNumber`
8. `phase`
9. `playerVisibleInformation`
10. `gmSecretInformation`
11. `temporaryConsequences`
12. `tracks`
13. `thresholdHistory`
14. `pendingThresholdQueue`
15. `selections`
16. `targets`
17. `riskBids`
18. `assistance`
19. `reservations`
20. `pendingChecks`
21. `pendingConsequences`

Every allowlisted field remains present even when its value is `null`, empty, or otherwise inactive.

## Intentional exclusions and isolation

Temporary state intentionally excludes schema and encounter identity, definition and authored configuration, lifecycle and revision, primary ship data, success and failure conditions, permanent consequences, processed request IDs, the `snapshots` collection, recovery, metadata, and all unknown top-level extension fields. This prevents recursive snapshots, preserves specialized lifecycle/revision control, and avoids silently rolling back permanent, idempotency, ship, configuration, or unclassified forward-compatible state.

The helper never mutates either input. It creates recursively cloned plain data for every captured temporary value, so mutable nested arrays and plain objects are isolated in both directions: changing a returned snapshot cannot alter the encounter, and later encounter changes cannot alter the snapshot. The request is read only and unknown request fields are not copied.

The produced shape meets the existing stored snapshot structural requirement: a non-empty `snapshotId` and plain-object `temporaryState`.

## Deferred behavior

Appending a snapshot, duplicate-ID checking, Ready-to-Active application, lifecycle events, revision changes, timestamps, stage/lifecycle/cleanup snapshots, restoration, phase and round reset, consequence reconciliation, persistence, projections, authority and socket behavior, and PF2e behavior remain deferred to specialized future operations.
