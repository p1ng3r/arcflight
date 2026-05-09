# Arcflight

Arcflight is a Foundry VTT module for PF2E-compatible fantasy voidfaring campaigns.

## Foundry VTT Compatibility

Arcflight targets Foundry VTT v13 first, with future v14 compatibility in mind.

## Current Phase 4 Architecture

Phase 4 keeps the PF2E-compatible module architecture, the hull and arkengine framework, and adds the room framework for core ship infrastructure and installed expansion rooms.

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
- `game.arcflight.createCoreArkengine(engineKey, operation?)`
- `game.arcflight.createArkengine(engineKey, operation?)`
- `game.arcflight.createCoreRoom(roomKey, operation?)`
- `game.arcflight.getCoreHull(platformKey)`
- `game.arcflight.getCoreArkengine(engineKey)`
- `game.arcflight.getCoreRoom(roomKey)`
- `game.arcflight.CORE_HULL_PLATFORM_KEYS`
- `game.arcflight.CORE_ARKENGINE_KEYS`
- `game.arcflight.CORE_ROOM_KEYS`
- `game.arcflight.ARKENGINE_VARIANT_KEYS`
- `game.arcflight.getCoreHullPlatformKeys()`
- `game.arcflight.getCoreArkengineKeys()`
- `game.arcflight.getCoreRoomKeys()`
- `game.arcflight.getArkengineVariantKeys()`
- `game.arcflight.getArkengineVariant(variantKey)`
- `game.arcflight.getArkengineVariants()`
- `game.arcflight.getDefaultComponentData(componentType)`
- `game.arcflight.getDefaultShipData()`
- `game.arcflight.isArcflightItem(item)`
- `game.arcflight.getComponentType(item)`
- `game.arcflight.getComponentData(item)`
- `game.arcflight.isArcflightVehicle(actor)`
- `game.arcflight.setArcflightVehicleEnabled(actor, enabled?)`
- `game.arcflight.installHull(shipActor, hullItem)`
- `game.arcflight.installHullOnShip(shipActor, hullItem)`
- `game.arcflight.installArkengine(shipActor, arkengineItem)`
- `game.arcflight.installArkengineOnShip(shipActor, arkengineItem)`
- `game.arcflight.installRoom(shipActor, roomItem)`
- `game.arcflight.installRoomOnShip(shipActor, roomItem)`
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

Phase 3 layers arkengine effects onto hull-derived values while preserving `current` as separate runtime state for hull, lifeveil, strain, and morale. Future phases can layer rooms, mods, weapons, crew, conditions, and temporary effects into `derived`.


## Phase 3 Arkengine Framework

Arcflight arkengines are PF2E `equipment` items with Arcflight flags only:

```js
flags.arcflight.enabled = true;
flags.arcflight.componentType = "arkengine";
flags.arcflight.system = { /* arkengine schema data */ };
```

Arkengines install onto Arcflight-enabled PF2E vehicle actors. Installation stores source item references under `flags.arcflight.system.installed`, copies clean arkengine base data to `flags.arcflight.system.base.arkengine`, and recalculates derived ship stats without mutating the source arkengine item.

Voyage speed belongs to the arkengine, not the hull. Its scale is inverse: lower `travelHexDays` values are faster and more powerful strategic travel capability, while higher values are slower and weaker. Combat speed remains hull-owned.

The locked core arkengine entries live in `data/arkengines/core-arkengines.js` and use lower-case kebab-case engine keys:

- `emberwake-sparkdrive`
- `lanterncoil-arkengine`
- `tidewake-arkengine`
- `iron-choir-engine`
- `furnaceheart-drive`
- `voidbreaker-arkengine`
- `deepwake-veil-engine`
- `crownfire-arkengine`
- `sanctum-choir-core`
- `worldbinder-arkengine`
- `leviathan-heart-core`

Each core arkengine records voyage speed, spell rank requirement, Lifeveil modifier, strain modifier, overcharge risk, hard burn strain cost, mod slots, variant family, allowed variant families, resistance tendencies, traits, role/design notes, and the implied internal core systems: Aetherite Core, Pressure Lattice, Veil Projector, Cooling System, Regulator, Fuel Matrix, and Channeling Assembly. These internal systems are descriptive only in Phase 3.5 and are not separate installed components.

To create and install a locked core arkengine in Foundry, call for example:

```js
const engine = await game.arcflight.createCoreArkengine("tidewake-arkengine");
await game.arcflight.installArkengine(ship, engine);
```

Phase 3 remains architecture/data-only. It does not implement travel gameplay, combat rounds, AP/RAP spending, station actions, voyage events, initiative, firing systems, damage automation, condition gameplay, overcharge resolution, hard burn resolution, GM generators, fleet systems, or salvage systems.

## Phase 3.5 Arkengine Variants + Mod Slot Foundation

Arcflight now separates arkengine architecture into three forward-compatible concepts:

- **Arkengine Class** is the propulsion tier or base engine category, such as `tidewake-arkengine`.
- **Variant Family** is the engineering philosophy applied to an arkengine class. Variants are not separate engine tiers.
- **Mods** are future fine-tuning and specialization components that will occupy tracked arkengine mod slots later.

The locked arkengine variant family data lives in `data/arkengines/arkengine-variants.js` and currently defines these nine families: `stormwake`, `bastion`, `choirbound`, `deepveil`, `longhaul`, `riftburn`, `pilgrim`, `smuggler`, and `leviathan`. Each family includes a display name, identity, description, effects summary, traits, and an empty `derivedModifiers` placeholder for future architecture work.

Arkengine installation now initializes placeholder mod tracking on the ship actor:

```js
flags.arcflight.system.installed.arkengineMods = [];
flags.arcflight.system.installed.arkengineModSlots = {
  capacity: engine.flags.arcflight.system.modSlots,
  used: 0,
  available: engine.flags.arcflight.system.modSlots
};
```

Derived ship stats expose `arkengineVariantFamily`, `arkengineModSlots`, `arkengineModSlotsUsed`, and `arkengineModSlotsAvailable`. This phase does not implement arkengine mod item installation behavior, mod effects, overcharge resolution, hard burn resolution, travel gameplay, combat gameplay, station actions, AP/RAP spending, generators, or automation-heavy systems.

## Current Module Behavior

When the module is enabled, the browser console should log:

```text
Arcflight | Initializing module
```

The module then registers optional ApplicationV2 sheets for PF2E equipment and PF2E vehicle actors without making them defaults. Normal PF2E sheets remain available and unaffected.

## Testing Notes

Phase 3.5 has no travel, combat, or arkengine mod gameplay automation to exercise. Development checks should validate that the 11 locked hull entries and 11 locked arkengine entries and 9 locked arkengine variant families load as ESM data, expose the helper API, and keep the Arcflight sheet registration optional/non-default for PF2E equipment and vehicles. In Foundry, smoke-test `await game.arcflight.createCoreHull("sloop")` and confirm it creates a PF2E equipment item with `flags.arcflight.componentType` set to `hull`. Then enable a PF2E vehicle with `await game.arcflight.setArcflightVehicleEnabled(ship, true)`, install a hull with `await game.arcflight.installHull(ship, hull)`, install an arkengine with `await game.arcflight.installArkengine(ship, engine)`, and confirm the actor has separate `installed`, `base`, `derived`, and `current` sections under `flags.arcflight.system`.
## Phase 4 Room Framework

Arcflight rooms are PF2E `equipment` items with Arcflight flags only:

```js
flags.arcflight.enabled = true;
flags.arcflight.componentType = "room";
flags.arcflight.system = { /* room schema data */ };
```

Rooms are ship infrastructure. They support downtime utility, crafting support, recovery support, narrative identity, ship lifestyle features, and logistical play. Rooms do **not** provide direct combat or direct travel stat buffs: they do not directly modify combat speed, AP, RAP, weapon damage, travel speed, or maneuverability.

Phase 4 distinguishes two room categories:

- **Core Rooms** are mandatory hull infrastructure. Every standard Arcflight hull is assumed to have the Arkengine Chamber, Helm, Crew Quarters, Galley & Mess, Cargo Hold, and Officer Wardroom. Core room references are generated onto the ship under `flags.arcflight.system.base.coreRooms` and `flags.arcflight.system.installed.coreRooms`; they do not consume expansion room slots.
- **Expansion Rooms** are player-installed infrastructure. They consume hull expansion room slots, may be stored as cargo when not installed, and only provide their utility while installed. Installed expansion room references live under `flags.arcflight.system.installed.rooms`.

Expansion room slot tracking lives under:

```js
flags.arcflight.system.installed.roomSlots = {
  capacity: 0,
  used: 0,
  available: 0
};
```

Slot capacity comes from the installed hull's `rooms.expansionSlots`, while used slots are counted only from installed expansion rooms. Core rooms never count against expansion room slots.

The starter room data set lives in `data/rooms/core-rooms.js` and includes `workshop`, `alchemy-lab`, `infirmary`, `greenhouse`, `observatory`, `shrine`, `archive`, `expanded-cargo-hold`, `brig`, and `luxury-quarters`. Create and install a room with the console helpers:

```js
const hull = await game.arcflight.createCoreHull("brigantine");
const engine = await game.arcflight.createCoreArkengine("tidewake-arkengine");
const room = await game.arcflight.createCoreRoom("workshop");
const ship = game.actors.find((actor) => actor.type === "vehicle");

await game.arcflight.setArcflightVehicleEnabled(ship, true);
await game.arcflight.installHull(ship, hull);
await game.arcflight.installArkengine(ship, engine);
await game.arcflight.installRoom(ship, room);
```

The room installer stores source references and copied utility data on the ship actor without mutating the room item, hull item, or arkengine item.


## Future Direction

Arcflight remains data-driven in direction. Future phases may add weapon, arkengine mod, room compendium, and cargo workflows before travel, combat, ship progression, crew/faction systems, or GM tooling automation.
