# packs

Arcflight compendium packs are intentionally minimal while the framework content shape is still stabilizing.

Use the world Items panel organization helpers for current cleanup work instead of adding placeholder packs:

```js
await game.arcflight.devTools.createItemFolders();
await game.arcflight.devTools.organizeArcflightItems();
```

Future compendium packs should stay data-driven and should store Arcflight components as PF2E `equipment` items with component metadata under `flags.arcflight`.
