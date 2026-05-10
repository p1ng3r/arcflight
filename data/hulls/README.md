# hulls

Phase 2 core hull data lives in `core-hulls.js`.

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

Arcflight hulls remain PF2E equipment items. The hull helper copies one of these entries into `flags.arcflight.system` and sets `flags.arcflight.componentType` to `hull`.
