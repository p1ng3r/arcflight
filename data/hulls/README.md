# hulls

Phase 2 core hull data lives in `core-hulls.js`. The core hull library now carries tier/refit-ready schema fields for the upcoming Refit Pressure framework while remaining data-only.

Phase 7.5B-1 lightweight hull pattern data lives in `hull-patterns.js`. Hull patterns are data-only configuration records for future "Base Component + Pattern" installs; this phase does not apply modifiers or mutate installed hulls.

The locked hull platform keys are:

- `void-skiff`
- `sloop`
- `cutter`
- `brigantine`
- `frigate`
- `galleon`
- `hammerhead`
- `arkcruiser`
- `dread-caravel`
- `cathedral-ship`
- `leviathan-class-platform`

The hull pattern keys are:

- `standard`
- `battle`
- `explorer`
- `trade`
- `stealth`
- `racing`
- `occult`

Each locked hull entry includes platform identity, base stats, physical resistances, strain and Lifeveil capacity, cargo capacity, combat speed, maneuverability, AP/RAP baselines, detection, crew bands, room slots, core room keys, weapon mounts by arc with allowed sizes, arkengine compatibility, traits, and tier/refit-readiness metadata. Standard hulls use numeric expansion room slots; `leviathan-class-platform` is explicitly marked as district-scale infrastructure rather than a normal expansion-slot chassis.

Tier/refit-ready fields are:

- `classification.baseTier`, `classification.tierLabel`, `classification.canBeRefitAboveBaseTier`, and `classification.maximumRefitTier`
- `refitTolerance.weaponPressure`, `enginePressure`, `infrastructurePressure`, `lifeveilPressure`, `crewCommandPressure`, `occultPressure`, and `totalBeforeMajorRefitRequired`
- `refitNotes.allowedRefitThemes`, `restrictedRefitThemes`, and `designIntent`

These fields now feed the ship-side Tier / Refit Pressure framework. Recalculation copies the installed hull base tier into ship tier state, sums installed component pressure snapshots, and marks ships as `native`, `pressured`, or `major-refit-required` without blocking installs. This pass does not add refit completion, weapon firing, travel systems, or combat automation.

Arcflight hulls remain PF2E equipment items. The hull helper copies one of these entries into `flags.arcflight.system` and sets `flags.arcflight.componentType` to `hull`. Use `game.arcflight.createCoreHull(platformKey)` to create a PF2E equipment item from a locked hull definition.
