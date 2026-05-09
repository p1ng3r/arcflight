# arkengines

Phase 3 introduces locked core arkengine data in `core-arkengines.js`.

Arkengines are PF2E `equipment` items with Arcflight flags:

- `flags.arcflight.enabled = true`
- `flags.arcflight.componentType = "arkengine"`
- `flags.arcflight.system` contains the arkengine schema data

Arkengines install onto Arcflight ship actors and contribute voyage speed, Lifeveil, strain, hard burn, overcharge, resistance tendency, and mod-slot derived values. Voyage speed uses inverse scaling: lower `travelHexDays` values are faster and more powerful. Combat speed remains hull-owned.

Phase 3 does not implement travel or combat gameplay automation.
