# Phase V Travel Event Card Schema

Phase V prepares Arcflight travel events for richer narrative station cards without building the future Travel Scene Overlay. Event records remain data-only, Foundry v13-safe, and backward compatible with existing published events, import/export records, runner sessions, and station assignment flows.

## Event-level fields

Travel events may now include `openingVignette` as table-ready prose that frames the voyage event before round play begins. Older events without `openingVignette` remain valid; normalization falls back to the existing description text when possible.

## Round-level fields

Each entry in `rounds` continues to support the existing `openingVignette`, `activeStations`, `stationPrompts`, and `outcomeBranches` fields. Phase V adds optional `stationCards` to each round. `stationCards` is an array, ordered for display, and keyed by the locked Travel Five station keys:

- `navigator`
- `engineer`
- `veilwarden`
- `watchmaster`
- `captain`

Existing events that only have `activeStations` and station prompt data are normalized into safe station cards for downstream tools. Published event compatibility still keeps `activeStations` as station keys where import validation expects that shape.

## Station card shape

```js
{
  stationKey: "navigator",
  stationName: "Navigator",
  problem: "Find a bearing through a sky with no stars.",
  skillApproaches: [
    {
      skill: "survival",
      label: "Sound the current",
      helpText: "Read pressure, drift, and false wake."
    }
  ],
  rollFeedback: {
    criticalSuccess: "The route opens cleanly.",
    success: "The ship holds the line.",
    failure: "The route costs time or resources.",
    criticalFailure: "The route turns hostile."
  },
  hooks: {
    rooms: [],
    shipUpgrades: [],
    arkengineMods: [],
    crewAssets: [],
    factions: []
  }
}
```

`skillApproaches` should usually contain two or three choices. The helper normalizer preserves explicit entries and can derive fallback approaches from legacy `suggestedSkills` plus `playerAction` text.

`hooks` is metadata only. Phase V does not automate room, ship upgrade, arkengine mod, crew asset, or faction effects.

## Final outcomes

The long-term narrative contract names final outcome branches as:

- `majorVictory`
- `victory`
- `costlySuccess`
- `failure`
- `catastrophicFailure`

Current helper compatibility also accepts the existing canonical runner keys `criticalSuccess`, `success`, `mixed`, `failure`, and `criticalFailure` and maps legacy names where needed. Do not remove either shape until downstream tools have completed their own migration.

## Compatibility rules

- Do not delete legacy `stationPrompts`, `activeStations`, or result feedback fields yet.
- Import/export should round-trip `openingVignette`, `rounds[*].stationCards`, `skillApproaches`, `rollFeedback`, and `hooks` as ordinary data.
- Runner preparation may read and preserve station cards, but Phase V must not add overlay, canvas, player ownership, or automated effect behavior.
- Proposed effects remain staged data for explicit GM review.
