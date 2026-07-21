# Gameplay V3-003N: Crew Planning Completeness

## Purpose

This slice adds a Foundry-free, read-only report describing whether every required available station has selected an exact valid station action during Active Crew Planning.

## Required station rule

Every entry in `availableStations` requires a selection by default. An authored station may opt out only by setting:

```js
{ stationId: "watch", selectionRequired: false, actions: [...] }
```

This default keeps existing encounter definitions strict while permitting explicitly optional stations.

## Report

`prepareVoyageEncounterCrewPlanningCompleteness(encounterState)` returns:

- `valid`: whether state, selections, context, and station definitions are valid;
- `complete`: whether validation succeeded and no required station is missing;
- `requiredStationIds`;
- `selectedStationIds`;
- `missingStationIds`;
- `optionalStationIds`;
- `errors` and `warnings`.

Ordering follows authored available-station order and stored selection insertion order. The helper does not mutate input data.

## Validation order

The helper first delegates to persisted station-selection validation. Structural or selection errors are returned before completeness inspection. It then requires an Active encounter in Crew Planning and rejects malformed or duplicate available station definitions.

## Deferred work

This slice does not lock selections, mark participants ready, advance phase, persist state, check authority, use sockets, execute PF2e actions, emit chat, or provide UI. Public API registration is deferred to a later integration slice after focused tests pass.
