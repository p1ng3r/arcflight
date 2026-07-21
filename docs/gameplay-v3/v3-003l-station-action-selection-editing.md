# Gameplay V3-003L: Voyage Station Action Selection Editing

## Purpose

This slice extends Crew Planning with two Foundry-free mutations that operate on
an already selected station action:

- change the selected action for one station;
- clear the selected action for one station.

It follows V3-003K's initial-selection boundary and still does not persist state,
access Foundry, execute actions, or lock planning.

## Change operation

`applyVoyageEncounterStationActionSelectionChange(encounterState, selectionRequest)`
requires an Active encounter in the Crew Planning phase, a valid existing own
selection for the requested station, and a different exact action ID from that
station's encounter-local `availableStations` options.

A successful change:

- recursively clones the complete encounter;
- replaces only the selected station's `{ stationId, actionId }` record;
- increments revision exactly once;
- validates the complete candidate before exposing it;
- emits exactly one `voyage.station-action-selection-changed` event containing
  both `previousActionId` and `actionId`.

Selecting the already stored action is rejected as `station-selection-unchanged`
rather than creating a revision-only no-op.

## Clear operation

`applyVoyageEncounterStationActionSelectionClear(encounterState, clearRequest)`
requires an Active encounter in the Crew Planning phase and an existing own
selection for the exact requested station ID.

A successful clear:

- recursively clones the complete encounter;
- removes only that station's selection;
- increments revision exactly once;
- validates the complete candidate before exposing it;
- emits exactly one `voyage.station-action-selection-cleared` event containing
  the removed `actionId`.

## Safety and atomicity

Both operations reuse persisted-selection validation before request handling.
They reject the exact unsafe map keys `__proto__`, `constructor`, and `prototype`,
preserve case-sensitive IDs without trimming or normalization, ignore unknown
request fields, and treat inherited selections as absent.

Clone construction and final candidate validation failures are atomic. They
return no candidate, event, partial mutation, or exposed revision change.
Neither operation mutates its encounter or request input.

## Deferred work

This slice intentionally defers target choices, Risk Bids, assistance,
reservations, resource spending, readiness, station locking, PF2e checks,
action execution, consequences, snapshots, phase advancement, persistence,
authority, sockets, projections, chat, and UI.
