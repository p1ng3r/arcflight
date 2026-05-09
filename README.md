# Arcflight

Arcflight is a Foundry VTT module for PF2E-compatible fantasy voidfaring campaigns.

## Foundry VTT Compatibility

Arcflight targets Foundry VTT v13 first, with future v14 compatibility in mind.

## Current Phase 1 Architecture

Phase 1 stabilizes Arcflight as a PF2E-compatible module rather than a replacement system:

- **PF2E vehicle actors are Arcflight ships.** A vehicle becomes an Arcflight ship only when Arcflight flags are enabled on that existing PF2E actor.
- **PF2E equipment items are Arcflight components.** Hulls, arkengines, arkengine mods, weapons, rooms, ship upgrades, cargo, and crew assets are all equipment items with Arcflight flags.
- **Arcflight data is stored in flags.** Ship and component data live under `flags.arcflight.system`; PF2E-owned `system` data remains untouched.
- **No custom Actor or Item document subtypes are registered.** The manifest does not declare `arcflight.*` document types, and the module does not patch `Item.create` or `Item.createDocuments`.

This keeps normal PF2E vehicles and equipment unaffected unless a user opts into the Arcflight sheets or helper APIs.

## Runtime Helpers

When the module initializes, it exposes the stable Phase 1 helper surface at `game.arcflight`:

- `game.arcflight.createItem(componentType, data?, operation?)`
- `game.arcflight.getDefaultComponentData(componentType)`
- `game.arcflight.getDefaultShipData()`
- `game.arcflight.isArcflightItem(item)`
- `game.arcflight.getComponentType(item)`
- `game.arcflight.getComponentData(item)`
- `game.arcflight.isArcflightVehicle(actor)`
- `game.arcflight.setArcflightVehicleEnabled(actor, enabled?)`

## Implemented Component Types

`createItem` and the Arcflight component sheet currently support:

- `hull`
- `arkengine`
- `arkengineMod`
- `weapon`
- `room`
- `shipUpgrade`
- `cargo`
- `crewAsset`

## Current Module Behavior

When the module is enabled, the browser console should log:

```text
Arcflight | Initializing module
```

The module then registers optional ApplicationV2 sheets for PF2E equipment and PF2E vehicle actors without making them defaults. Normal PF2E sheets remain available and unaffected.

## Future Direction

Arcflight remains data-driven in direction. Future phases may add compendium content and gameplay pillars, but Phase 1 intentionally avoids travel, combat, ship progression, crew/faction systems, and GM tooling automation.
