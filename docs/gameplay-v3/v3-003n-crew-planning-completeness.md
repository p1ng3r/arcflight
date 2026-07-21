# Gameplay V3-003N: Voyage Crew Planning Completeness

## Purpose

Provide `prepareVoyageEncounterCrewPlanningCompleteness(encounterState)`, a Foundry-free, read-only report for the Active Crew Planning phase.

## Selection rule and output

Every available station is required by default. An event author may make a station optional only by setting its own `selectionRequired` property to `false`; all other values, including an omitted or inherited property, remain required.

The helper returns fresh plain arrays in this shape:

```js
{
  requiredStationIds,
  optionalStationIds,
  selectedStationIds,
  missingRequiredStationIds,
  complete,
  errors,
  warnings
}
```

Station-derived arrays preserve `availableStations` order and preserve station IDs exactly, including case and surrounding whitespace. `selectedStationIds` includes only valid own selection properties; unknown, inherited, malformed, or otherwise invalid selections are not accepted.

## Validation and safety

The report reuses structural encounter and persisted station-selection validation, then requires an Active encounter in the Crew Planning phase. It also rejects malformed available-station entries, blank IDs, unsafe map-key IDs, duplicate station IDs, and non-array station actions. Validation issues are emitted deterministically: reused validation issues first, then context issues, followed by station entries in source order.

The helper does not mutate its input and returns new result objects and arrays for each call.

## Deferred work

This domain-only slice does not register a public API and does not add persistence, sockets, authority, UI, locking, readiness mutation, Risk Bids, PF2e rolls, action execution, chat, or phase advancement.
