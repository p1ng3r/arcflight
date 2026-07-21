# Gameplay V3-003K: Voyage Station Action Selection

## Purpose

This slice adds the first Crew Planning mutation: an Active encounter in the
Crew Planning phase can store one initial primary action for one available
station. It is pure domain code and neither persists state nor accesses
Foundry.

## Encounter-local options and stored selections

`availableStations` is the authoritative, encounter-local option list. A
selectable station is a plain object with a non-empty `stationId` and `actions`
array; each selectable action is a plain object with a non-empty `actionId`.
Additional authored data remains in the option list and is never copied.

Selections remain a plain-object map keyed by station ID:

```js
{
  captain: { stationId: "captain", actionId: "coordinate-orders" }
}
```

The operation creates only those two fields. `__proto__`, `constructor`, and
`prototype` are rejected as exact, case-sensitive unsafe map keys.

## Validation

`validateVoyageEncounterStationSelections(encounterState)` first delegates to
`validateVoyageEncounterState`. Structural errors are returned unchanged and
prevent inspection of selections or options. Otherwise it returns a fresh
`{ valid, errors, warnings }` result, checks only own selection entries in
insertion order, and verifies plain selection shape, IDs, map-key agreement,
and exact available station/action relations. Duplicate matching stations or
actions are errors; no first match is selected.

## Application

`applyVoyageEncounterStationActionSelection(encounterState, selectionRequest)`
returns `{ ok, nextState, events, errors, warnings }`. The request must be a
plain object containing non-empty, unmodified `stationId` and `actionId`;
unknown fields are ignored. It requires an Active encounter and the Crew
Planning phase, matches both IDs exactly and case-sensitively against
encounter-local options, and rejects duplicate options, malformed action
collections, unsafe station keys, and an existing own selection.

Success recursively clones the full encounter, preserves all other planning
state (including targets, bids, assistance, reservations, checks, assignments,
consequences, recovery, metadata, and snapshots), adds exactly one selection,
and increments revision exactly once. It does not create or append a snapshot.
The complete candidate is validated before exposure. Clone construction or
candidate validation failure is atomic: no candidate, event, partial selection,
or exposed revision change is returned.

The one success event is exactly:

```js
{
  type: "voyage.station-action-selected",
  encounterId,
  lifecycleState: "active",
  roundNumber,
  phase: "crew-planning",
  stationId,
  actionId,
  previousRevision,
  revision
}
```

Neither public function mutates its inputs. Successful `nextState` plain data
is recursively isolated from the encounter and from request-owned mutable data.

## Registry boundary and deferrals

This operation does not import or look up the data-only core station-action
registry. A later option-construction adapter may translate registry keys into
encounter-local action IDs. This slice intentionally defers targets, required
choices, Risk Bids, assistance, reservations, resource spending, locking,
readiness, PF2e validation and execution, consequences, snapshots, phase
advancement, persistence, authority, sockets, projections, chat, and UI.
