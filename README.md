# Arcflight

Arcflight is a Foundry VTT module for PF2E-compatible fantasy voidfaring campaigns.

## Foundry VTT Compatibility

Arcflight targets Foundry VTT v13 first, with future v14 compatibility in mind.

## Current Phase 7 Architecture

Phase 7 keeps the PF2E-compatible module architecture, hull, installed hull, arkengine, variant slot, room, ship upgrade, arkengine mod, and station foundations, and adds a lightweight Crew Assets / Crew Assignment Framework. Generic crew remains a simple ship-owned number; named crew assets are meaningful specialists stored as PF2E equipment source items and copied into a ship-owned runtime roster.

- **PF2E vehicle actors are Arcflight ships.** A vehicle becomes an Arcflight ship only when Arcflight flags are enabled on that existing PF2E actor.
- **PF2E equipment items are Arcflight components.** Hulls, arkengines, arkengine mods, weapons, rooms, ship upgrades, cargo, and crew assets are all equipment items with Arcflight flags.
- **Arcflight data is stored in flags.** Ship and component data live under `flags.arcflight.system`; PF2E-owned `system` data remains untouched.
- **Stations are ship actor role data, not equipment items.** Station definitions and assignments live under `flags.arcflight.system.stations` on Arcflight-enabled PF2E vehicle actors.
- **Crew runtime state lives on ships.** Crew asset source items remain immutable; `addCrewAsset` copies crew data into `flags.arcflight.system.crew.namedCrew` and updates `crew.currentGenericCrew` when applicable.
- **No custom Actor or Item document subtypes are registered.** The manifest does not declare `arcflight.*` document types, and the module does not patch `Item.create` or `Item.createDocuments`.

This keeps normal PF2E vehicles and equipment unaffected unless a user opts into the Arcflight sheets or helper APIs.

## Runtime Helpers

When the module initializes, it exposes the stable helper surface at `game.arcflight`:

- `game.arcflight.createItem(componentType, data?, operation?)`
- `game.arcflight.createCoreHull(platformKey, operation?)`
- `game.arcflight.createHull(platformKey, operation?)`
- `game.arcflight.createCoreArkengine(engineKey, operation?)`
- `game.arcflight.createArkengine(engineKey, operation?)`
- `game.arcflight.createCoreArkengineMod(modKey, operation?)`
- `game.arcflight.createArkengineMod(modKey, operation?)`
- `game.arcflight.createCoreRoom(roomKey, operation?)`
- `game.arcflight.createRoom(roomKey, operation?)`
- `game.arcflight.createCoreShipUpgrade(upgradeKey, operation?)`
- `game.arcflight.createShipUpgrade(upgradeKey, operation?)`
- `game.arcflight.createCoreCrewAsset(crewAssetKey, operation?)`
- `game.arcflight.createCrewAsset(crewAssetKey, operation?)`
- `game.arcflight.getCoreHull(platformKey)`
- `game.arcflight.getCoreArkengine(engineKey)`
- `game.arcflight.getCoreArkengineMod(modKey)`
- `game.arcflight.getCoreCrewAsset(crewAssetKey)`
- `game.arcflight.getCoreRoom(roomKey)`
- `game.arcflight.getCoreShipUpgrade(upgradeKey)`
- `game.arcflight.CORE_HULL_PLATFORM_KEYS`
- `game.arcflight.CORE_ARKENGINE_KEYS`
- `game.arcflight.CORE_ARKENGINE_MOD_KEYS`
- `game.arcflight.CORE_CREW_ASSET_KEYS`
- `game.arcflight.CORE_ROOM_KEYS`
- `game.arcflight.CORE_SHIP_UPGRADE_KEYS`
- `game.arcflight.ARKENGINE_VARIANT_KEYS`
- `game.arcflight.STATION_KEYS`
- `game.arcflight.getCoreHullPlatformKeys()`
- `game.arcflight.getCoreArkengineKeys()`
- `game.arcflight.getCoreArkengineModKeys()`
- `game.arcflight.getCoreCrewAssetKeys()`
- `game.arcflight.getCoreRoomKeys()`
- `game.arcflight.getCoreShipUpgradeKeys()`
- `game.arcflight.getArkengineVariantKeys()`
- `game.arcflight.getArkengineVariant(variantKey)`
- `game.arcflight.getArkengineVariants()`
- `game.arcflight.getStationKeys()`
- `game.arcflight.getStation(stationKey)`
- `game.arcflight.getStations()`
- `game.arcflight.getDefaultComponentData(componentType)`
- `game.arcflight.getDefaultShipData()`
- `game.arcflight.isArcflightItem(item)`
- `game.arcflight.getComponentType(item)`
- `game.arcflight.getComponentData(item)`
- `game.arcflight.isArcflightVehicle(actor)`
- `game.arcflight.setArcflightVehicleEnabled(actor, enabled?)`
- `game.arcflight.addCrewAsset(shipActor, crewItem)`
- `game.arcflight.removeCrewAsset(shipActor, crewIdOrUuid)`
- `game.arcflight.installHull(shipActor, hullItem)`
- `game.arcflight.installHullOnShip(shipActor, hullItem)`
- `game.arcflight.installArkengine(shipActor, arkengineItem)`
- `game.arcflight.installArkengineOnShip(shipActor, arkengineItem)`
- `game.arcflight.installArkengineMod(shipActor, modItem)`
- `game.arcflight.installArkengineModOnShip(shipActor, modItem)`
- `game.arcflight.installRoom(shipActor, roomItem)`
- `game.arcflight.installRoomOnShip(shipActor, roomItem)`
- `game.arcflight.installShipUpgrade(shipActor, upgradeItem)`
- `game.arcflight.installShipUpgradeOnShip(shipActor, upgradeItem)`
- `game.arcflight.recalculateShipStats(shipActor)`
- `game.arcflight.assignStation(shipActor, stationKey, assignee, options?)`
- `game.arcflight.clearStationAssignment(shipActor, stationKey)`
- `game.arcflight.assignShipStation(shipActor, stationKey, assignee, options?)`
- `game.arcflight.clearShipStation(shipActor, stationKey)`

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


## Phase 7 Crew Assets / Crew Assignment Framework

Crew assets are Arcflight components backed by normal PF2E equipment items with `flags.arcflight.componentType = "crewAsset"`. Core crew assets are exposed through `game.arcflight.CORE_CREW_ASSET_KEYS`, `game.arcflight.getCoreCrewAssetKeys()`, `game.arcflight.getCoreCrewAsset(key)`, and `game.arcflight.createCoreCrewAsset(key)`.

The locked core crew asset keys are:

- `veteran-chief-engineer`
- `seasoned-navigator`
- `sharp-eyed-watchmaster`
- `veteran-gunner`
- `steady-quartermaster`

Crew asset data includes `componentType`, `identity`, `crew`, `stationAssignment`, `capabilities`, `effects`, `state`, `restrictions`, `traits`, and `notes`. Supported crew qualities are `green`, `trained`, `veteran`, `elite`, and `legendary`.

Use the console helpers to create and roster a crew asset:

```js
const crew = await game.arcflight.createCoreCrewAsset("veteran-chief-engineer");
const ship = game.actors.find((actor) => actor.type === "vehicle");

await game.arcflight.setArcflightVehicleEnabled(ship, true);
await game.arcflight.addCrewAsset(ship, crew);
await game.arcflight.assignStation(ship, "engineer", ship.flags.arcflight.system.crew.namedCrew[0]);
```

`addCrewAsset` validates that the actor is an Arcflight-enabled PF2E vehicle and that the item is a crew asset, then copies source crew data into `flags.arcflight.system.crew.namedCrew`. If `crew.countsTowardCrewTotal` is true, it increments `flags.arcflight.system.crew.currentGenericCrew` by the crew asset's generic crew equivalent. The helper does not mutate the source crew item and does not overwrite unrelated runtime state.

Phase 7 does not add station actions, AP/RAP spending, crew wages/upkeep, morale resolution, injury automation, combat automation, travel automation, or drag/drop crew management.

## Phase 6 Station Framework

Stations are Arcflight ship operating roles and assignment records. They are not PF2E equipment items, not installed components, and not rooms. Station data lives on the Arcflight-enabled PF2E vehicle actor under `flags.arcflight.system.stations`.

Rooms remain physical ship spaces such as workshops, helms, wardrooms, cabins, or holds. Stations remain duty roles such as Captain, Pilot / Helm, Navigator, Engineer, Veilwarden, Watchmaster, Gunnery, and Quartermaster. A room may provide narrative context in a later phase, but Phase 6 does not require rooms for stations, does not unlock stations through room installation, does not store station assignments on rooms, and does not store room state on stations.

The locked station keys are exposed through `game.arcflight.STATION_KEYS` and are currently:

- `captain`
- `pilot`
- `navigator`
- `engineer`
- `veilwarden`
- `watchmaster`
- `gunnery`
- `quartermaster`

Each station definition supports `key`, `displayName`, `role`, `description`, `gameplayDomains`, `primarySkills`, `traits`, and `notes`. Assignment records support `stationKey`, `assigneeType`, `actorId`, `actorUuid`, `crewAssetId`, `crewAssetUuid`, `name`, and `notes`.

Use the console helpers to read station data and manage simple actor assignments:

```js
game.arcflight.STATION_KEYS;
game.arcflight.getStationKeys();
game.arcflight.getStation("engineer");
game.arcflight.getStations();

const ship = game.actors.find((actor) => actor.type === "vehicle");
const assignee = game.actors.find((actor) => actor.type !== "vehicle");

await game.arcflight.setArcflightVehicleEnabled(ship, true);
await game.arcflight.assignStation(ship, "engineer", assignee);
await game.arcflight.clearStationAssignment(ship, "engineer");
```

Assigning or clearing a station updates only `flags.arcflight.system.stations.assignments` on the ship actor. It does not mutate the assignee actor, rooms, installed components, hulls, arkengines, upgrades, arkengine mods, or source items, and it does not change derived stats. Phase 6 does not implement station actions, AP/RAP spending, combat rounds, travel gameplay, voyage events, firing systems, overcharge resolution, hard burn resolution, drag/drop crew assignment, room/station dependency rules, or automation-heavy gameplay.

## Phase 4 Arkengine Mods Framework

Arkengine Mods are engine-only tuning and specialization components. They affect the installed arkengine profile and actor-owned derived stats; they are not generic Ship Upgrades and they are not Rooms. Ship Upgrades remain broader vessel improvements, while Rooms remain infrastructure spaces. Do not mix these systems.

Arkengine Mods are PF2E `equipment` items with Arcflight flags only:

```js
flags.arcflight.enabled = true;
flags.arcflight.componentType = "arkengineMod";
flags.arcflight.system = { /* arkengine mod schema data */ };
```

The locked starter mod data lives in `data/arkengine-mods/core-arkengine-mods.js` and includes these 10 keys:

- `pressure-lattice-tuning`
- `veil-projector-focusing`
- `cooling-loop-expansion`
- `fuel-matrix-efficiency`
- `stormwake-injector`
- `voidglass-regulator`
- `choir-harmonic-lattice`
- `overburn-catalysts`
- `deepwake-stabilizers`
- `aetherite-core-bracing`

Create and install a core arkengine mod with the console helpers:

```js
const hull = await game.arcflight.createCoreHull("brigantine");
const engine = await game.arcflight.createCoreArkengine("tidewake-arkengine");
const mod = await game.arcflight.createCoreArkengineMod("pressure-lattice-tuning");
const ship = game.actors.find((actor) => actor.type === "vehicle");

await game.arcflight.setArcflightVehicleEnabled(ship, true);
await game.arcflight.installHull(ship, hull);
await game.arcflight.installArkengine(ship, engine);
await game.arcflight.installArkengineMod(ship, mod);
```

Installing an Arkengine Mod appends copied installation state under `flags.arcflight.system.installed.arkengineMods`, updates `installed.arkengineModSlots`, and recalculates ship-derived values without mutating the mod item, arkengine item, hull item, room items, or ship upgrade items. Slot capacity comes from the installed arkengine's `modSlots`; used slots come from installed mod slot costs; available slots are `capacity - used`.

Phase 4 supports Arkengine Mod `derivedStatModifiers` only for `voyageSpeedTravelHexDays`, `lifeveilCapacity`, `strainCapacity`, `hardBurnStrainCost`, `overchargeRisk`, `resistanceTendencies`, and `arkengineModSlots`, using `add`, `subtract`, `set`, and `append`. Voyage speed uses inverse scaling: lower `travelHexDays` is faster/more powerful, and higher `travelHexDays` is slower/weaker.

This phase does not implement Hard Burn resolution, Overcharge resolution, travel gameplay, combat gameplay, AP/RAP spending, station actions, voyage events, damage automation, condition gameplay, GM generators, or drag-and-drop installation. Drag-and-drop UX should eventually route Arkengine Mods into installed arkengine mod slots rather than treating them as generic ship upgrades.

## Phase 4.5 Ship Upgrades Framework

Ship Upgrades are permanent installed ship improvements. They are not rooms, arkengines, arkengine mods, or runtime effects. Rooms remain interior spaces and downtime/logistical infrastructure; Ship Upgrades are permanent modifications to how the vessel operates or structural/operational additions to the vessel itself. Arkengine Mods affect the engine; Ship Upgrades affect the ship.

Ship Upgrades may represent structural retrofits, operational enhancements, tactical infrastructure, command systems, military refits, exposed ship hardware, visible vessel components, and vessel-wide enhancement packages. The Phase 4.5 data set implements Standard upgrades only; future rarity tiers may add uncommon, rare, epic, and legendary upgrades.

Ship Upgrades are PF2E `equipment` items with Arcflight flags only:

```js
flags.arcflight.enabled = true;
flags.arcflight.componentType = "shipUpgrade";
flags.arcflight.system = { /* ship upgrade schema data */ };
```

The locked Standard upgrade entries live in `data/ship-upgrades/core-ship-upgrades.js` and include 16 keys:

- `reinforced-structural-ribbing`
- `expanded-cargo-lattice`
- `stabilized-helm-relays`
- `fleet-signal-array`
- `reinforced-ram-prow`
- `emergency-veil-relay`
- `void-anchor-array`
- `deep-void-reinforcement`
- `arc-conduit-stabilizers`
- `lookout-spire`
- `reinforced-void-sails`
- `auxiliary-command-roost`
- `pressure-redistribution-network`
- `detection-spire`
- `docking-claw-system`
- `propulsion-stabilization-fins`

Use the console helpers to create and install upgrades:

```js
const upgrade = await game.arcflight.createCoreShipUpgrade("reinforced-structural-ribbing");
await game.arcflight.installShipUpgrade(shipActor, upgrade);
```

Installing a Ship Upgrade appends copied installation state to `flags.arcflight.system.installed.shipUpgrades`, updates `shipUpgradeSlots` with a default capacity of 3, and recalculates actor-owned derived stats. Upgrade items, hull items, arkengine items, and room items are not mutated. Current runtime values remain separate under `flags.arcflight.system.current`.

Phase 4.5 supports direct derived-stat modifiers for `hullIntegrity`, `armorClass`, `strainCapacity`, `lifeveilCapacity`, `cargoCapacity`, `detection`, `combatSpeed`, `maneuverability`, `baseAP`, `baseRAP`, and `resistanceTendencies` using `add`, `subtract`, `set`, and `append` modes. Placeholder condition, operational, system, station, and event interactions are stored as data for later systems, but Phase 4.5 does not resolve combat rounds, travel gameplay, AP/RAP spending, station actions, voyage events, weapon firing, Hard Burn, Overcharge, condition gameplay, automation-heavy gameplay, or GM generators.


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

Derived ship stats expose `arkengineVariantFamily`, `arkengineModSlots`, `arkengineModSlotsUsed`, and `arkengineModSlotsAvailable`. Phase 4 adds arkengine mod item installation and supported actor-owned derived stat modifiers. Hard Burn resolution, Overcharge resolution, travel gameplay, combat gameplay, station actions, AP/RAP spending, generators, and automation-heavy systems remain unimplemented.

## Current Module Behavior

When the module is enabled, the browser console should log:

```text
Arcflight | Initializing module
```

The module then registers optional ApplicationV2 sheets for PF2E equipment and PF2E vehicle actors without making them defaults. Normal PF2E sheets remain available and unaffected.

## Testing Notes

Phase 7 has no travel, combat, Hard Burn, Overcharge, station action, AP/RAP, crew wages, morale resolution, event, damage, condition, or GM automation to exercise. Development checks should validate that the locked hull, arkengine, arkengine variant, arkengine mod, room, ship upgrade, station, and crew asset data load as ESM data, expose the helper API, and keep the Arcflight sheet registration optional/non-default for PF2E equipment and vehicles. In Foundry, smoke-test `await game.arcflight.createCoreHull("sloop")` and confirm it creates a PF2E equipment item with `flags.arcflight.componentType` set to `hull`. Then enable a PF2E vehicle with `await game.arcflight.setArcflightVehicleEnabled(ship, true)`, install a hull with `await game.arcflight.installHull(ship, hull)`, install an arkengine with `await game.arcflight.installArkengine(ship, engine)`, and confirm the actor has separate `installed`, `base`, `derived`, and `current` sections under `flags.arcflight.system`.
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

Arcflight remains data-driven in direction. Future phases may add weapon, arkengine mod, ship upgrade compendium, room compendium, and cargo workflows before travel, combat, ship progression, crew/faction systems, or GM tooling automation.
