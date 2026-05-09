# Arcflight

Arcflight is a Foundry VTT module for PF2E-compatible fantasy voidfaring campaigns.

## Foundry VTT Compatibility

Arcflight targets Foundry VTT v13 first, with future v14 compatibility in mind.

## Current Phase 2 Architecture

Phase 2 keeps the Phase 1 PF2E-compatible module architecture and adds the first gameplay-facing Core content structure: locked hull platform data.

- **PF2E vehicle actors are Arcflight ships.** A vehicle becomes an Arcflight ship only when Arcflight flags are enabled on that existing PF2E actor.
- **PF2E equipment items are Arcflight components.** Hulls, arkengines, arkengine mods, weapons, rooms, ship upgrades, cargo, and crew assets are all equipment items with Arcflight flags.
- **Arcflight data is stored in flags.** Ship and component data live under `flags.arcflight.system`; PF2E-owned `system` data remains untouched.
- **No custom Actor or Item document subtypes are registered.** The manifest does not declare `arcflight.*` document types, and the module does not patch `Item.create` or `Item.createDocuments`.

This keeps normal PF2E vehicles and equipment unaffected unless a user opts into the Arcflight sheets or helper APIs.

## Runtime Helpers

When the module initializes, it exposes the stable helper surface at `game.arcflight`:

- `game.arcflight.createItem(componentType, data?, operation?)`
- `game.arcflight.createCoreHull(platformKey, operation?)`
- `game.arcflight.createHull(platformKey, operation?)`
- `game.arcflight.getCoreHull(platformKey)`
- `game.arcflight.CORE_HULL_PLATFORM_KEYS`
- `game.arcflight.getCoreHullPlatformKeys()`
- `game.arcflight.getDefaultComponentData(componentType)`
- `game.arcflight.getDefaultShipData()`
- `game.arcflight.isArcflightItem(item)`
- `game.arcflight.getComponentType(item)`
- `game.arcflight.getComponentData(item)`
- `game.arcflight.isArcflightVehicle(actor)`
- `game.arcflight.setArcflightVehicleEnabled(actor, enabled?)`
- `game.arcflight.installHull(shipActor, hullItem)`
- `game.arcflight.installHullOnShip(shipActor, hullItem)`
- `game.arcflight.recalculateShipStats(shipActor)`

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


## Phase 2 Core Hull Framework

Arcflight hulls are PF2E `equipment` items with Arcflight flags only:

```js
flags.arcflight.enabled = true;
flags.arcflight.componentType = "hull";
flags.arcflight.system = { /* hull schema data */ };
```

The locked core hull platforms live in `data/hulls/core-hulls.js` and use lower-case kebab-case platform keys:

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

Each core hull includes validation-ready fields for hull integrity, armor class, physical resistances, strain, lifeveil, cargo, detection, combat speed, maneuverability, base AP/RAP, crew limits, rooms, weapon mounts by arc, arkengine compatibility, traits, role, and design notes.

To create a locked core hull in Foundry, call for example:

```js
await game.arcflight.createCoreHull("sloop");
```

The helper creates a normal PF2E equipment item and stores hull data under `flags.arcflight.system`; it does not create custom Item subtypes and does not affect normal PF2E equipment.

## Phase 2.5 Installed Hull + Derived Ship Stats

Arcflight ship actors now reserve a forward-compatible architecture layer under `flags.arcflight.system`:

```js
flags.arcflight.system.installed // source item references
flags.arcflight.system.base      // copied immutable hull chassis values
flags.arcflight.system.derived   // calculated ship stats
flags.arcflight.system.current   // runtime ship state
```

A hull remains a normal PF2E `equipment` item and continues to store its component data under `flags.arcflight.system`. Installing a hull copies the hull's base chassis data onto the PF2E vehicle actor; it does not mutate the hull item or permanently rewrite core hull definitions.

Use the console helpers to install and recalculate hull-derived stats:

```js
const hull = await game.arcflight.createCoreHull("brigantine");
const ship = game.actors.find((actor) => actor.type === "vehicle");

await game.arcflight.setArcflightVehicleEnabled(ship, true);
await game.arcflight.installHull(ship, hull);
await game.arcflight.recalculateShipStats(ship);
```

For Phase 2.5, derived values intentionally equal the installed base hull values. Future phases can layer arkengines, rooms, mods, weapons, crew, conditions, and temporary effects into `derived` while preserving `current` as separate runtime state for hull, lifeveil, strain, and morale.

## Current Module Behavior

When the module is enabled, the browser console should log:

```text
Arcflight | Initializing module
```

The module then registers optional ApplicationV2 sheets for PF2E equipment and PF2E vehicle actors without making them defaults. Normal PF2E sheets remain available and unaffected.

## Testing Notes

Phase 2.5 has no travel or combat automation to exercise. Development checks should validate that the 11 locked hull entries load as ESM data, preserve Hull Statout V1 values, expose the helper API, and keep the Arcflight sheet registration optional/non-default for PF2E equipment and vehicles. In Foundry, smoke-test `await game.arcflight.createCoreHull("sloop")` and confirm it creates a PF2E equipment item with `flags.arcflight.componentType` set to `hull`. Then enable a PF2E vehicle with `await game.arcflight.setArcflightVehicleEnabled(ship, true)`, install a hull with `await game.arcflight.installHull(ship, hull)`, and confirm the actor has separate `installed`, `base`, `derived`, and `current` sections under `flags.arcflight.system`.

## Future Direction

Arcflight remains data-driven in direction. Future phases may add arkengine, room, weapon, installation, and compendium workflows before travel, combat, ship progression, crew/faction systems, or GM tooling automation.
