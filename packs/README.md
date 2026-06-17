# packs

Arcflight compendium packs are intentionally minimal while the framework content shape is still stabilizing.

Use the world Items panel organization helpers for current cleanup work instead of adding placeholder packs:

```js
await game.arcflight.createArcflightItemFolders();
await game.arcflight.findMissingCoreArcflightItems();
await game.arcflight.syncCoreArcflightItems({ dryRun: true });
await game.arcflight.syncCoreArcflightItems({ dryRun: false });
await game.arcflight.organizeArcflightItems();
await game.arcflight.findDuplicateArcflightItems();
await game.arcflight.cleanupDuplicateArcflightItems({ dryRun: true });
```

Core library sync materializes missing source registry entries as world Items only; it does not edit compendium data, actor embedded items, stations, or existing duplicates.

Duplicate cleanup remains a world-only maintenance helper. It must not be used to edit or delete compendium source data, and `cleanupDuplicateArcflightItems()` defaults to `dryRun: true` so returned duplicate groups can be reviewed before any world Item deletion.

Future compendium packs should stay data-driven and should store Arcflight components as PF2E `equipment` items with component metadata under `flags.arcflight`.
