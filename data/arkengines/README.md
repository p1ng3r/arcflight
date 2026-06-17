# arkengines

Phase 3 introduces locked core arkengine data in `core-arkengines.js`.

Phase 7.5B-1 lightweight arkengine pattern data lives in `arkengine-patterns.js`. Arkengine patterns are data-only configuration records for future "Base Component + Pattern" installs; this phase does not apply modifiers or mutate installed arkengines.

The arkengine pattern keys are:

- `standard`
- `guild`
- `military`
- `experimental`
- `smuggler`
- `pilgrim`
- `stormwake`
- `deepveil`
- `longhaul`

Arkengines are PF2E `equipment` items with Arcflight flags:

- `flags.arcflight.enabled = true`
- `flags.arcflight.componentType = "arkengine"`
- `flags.arcflight.system` contains the arkengine schema data

Arkengines install onto Arcflight ship actors and contribute voyage speed, Lifeveil, strain, hard burn, overcharge, resistance tendency, and mod-slot derived values. Voyage speed uses inverse scaling: lower `travelHexDays` values are faster and more powerful. Combat speed remains hull-owned.

Phase 3 does not implement travel or combat gameplay automation.

## Tier / Refit Metadata

Core arkengines now include data-only `minimumTier`, `recommendedTier`, `tierImpact`, `refitPressure`, `refitTags`, `refitCategory`, `specialistRequirements`, and `rareMaterialRequirements` fields. Arkengine pressure primarily contributes to `enginePressure`, scaling from frontier/local engines through mythic/impossible drives. This metadata is advisory for future install validation and does not block installation or resolve travel, hard burn, overcharge, or combat gameplay.
