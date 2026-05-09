# hulls

Phase 2 core hull data lives in `core-hulls.js`.

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

Arcflight hulls remain PF2E equipment items. The hull helper copies one of these entries into `flags.arcflight.system` and sets `flags.arcflight.componentType` to `hull`.
