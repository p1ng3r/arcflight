# Arcflight

Arcflight is a Foundry VTT module for PF2E-compatible fantasy voidfaring campaigns.

## Foundry VTT Compatibility

Arcflight targets Foundry VTT v13 first, with future v14 compatibility in mind.

## Framework Foundation Milestone

Arcflight is currently in its **Framework Foundation** milestone. The module provides a PF2E-safe data and sheet foundation for ships and components, but it does **not** implement gameplay pillar systems yet. Travel gameplay, combat gameplay, AP/RAP spending, station actions, hard burn resolution, overcharge resolution, event systems, drag/drop systems, automation buttons, crew/faction gameplay, and GM tooling remain future work.

For release management, promote framework-foundation work through the active development branch first, then merge to `main` only after Foundry smoke tests and normal PF2E sheet compatibility checks pass.

## Current Architecture Overview

Arcflight deliberately builds on normal PF2E documents instead of registering custom document subtypes:

- **PF2E vehicle actors are Arcflight ships.** A vehicle becomes an Arcflight ship only after Arcflight flags are enabled on that existing PF2E actor.
- **PF2E equipment items are Arcflight components.** Hull, Arkengine, Arkengine Mod, Room, Ship Upgrade, Cargo, Weapon, and Crew Asset data all live on equipment items with Arcflight flags.
- **Arcflight data lives in flags.** Ship and component data are stored under `flags.arcflight.system`; PF2E-owned `system` data remains untouched.
- **Source items are immutable during installation.** Installing a Hull, Arkengine, Arkengine Mod, Room, Ship Upgrade, or Crew Asset copies the needed framework data onto the ship actor and keeps the source item unchanged.
- **Runtime ownership belongs to the ship actor.** Installed references, copied Base data, recalculated Derived values, Current runtime values, station assignments, and crew roster state are owned by the Arcflight-enabled PF2E vehicle actor.
- **Stations are role data, not equipment items.** Station definitions and assignments live under `flags.arcflight.system.stations` on the ship.
- **Sheets are optional and non-default.** Arcflight registers optional ApplicationV2 sheets for PF2E equipment and vehicle actors without replacing normal PF2E item or vehicle sheets.

This architecture keeps normal PF2E equipment and vehicles functional unless a user explicitly chooses Arcflight helpers or sheets.

## Completed Framework Systems

The current Framework Foundation includes these data-first systems:

- **Hull** — an 11-entry core vessel platform library with copied ship Base values, arkengine compatibility, weapon mount arcs, core room keys, and tier/refit-ready metadata for the future Refit Pressure framework.
- **Arkengine** — installed propulsion framework data, variant family fields, spell-rank fueling schema, derived engine values, and tier/refit pressure metadata.
- **Arkengine Mod** — engine-only tuning components with tracked mod slot usage, a 22-entry core content library, placeholder interactions, and engine/Lifeveil/occult refit pressure metadata.
- **Room** — physical ship spaces, with core rooms, expansion room slot tracking, a 26-entry core content library, and infrastructure/occult/Lifeveil refit metadata.
- **Ship Upgrade** — permanent vessel improvements with ship upgrade slot tracking, a 28-entry core content library, and meaningful refit pressure across structural, command, Lifeveil, occult, engine, and military categories.
- **Crew Asset** — named/support crew source items copied into ship-owned crew rosters, with a 15-entry core content library and light advisory tier/refit metadata.
- **Station framework** — ship-owned operating role definitions and assignments.
- **Ship actor architecture** — separated `installed`, `base`, `derived`, and `current` state on Arcflight-enabled PF2E vehicle actors.
- **Framework smoke test helper** — a Foundry-console validation helper exposed as `game.arcflight.runFrameworkSmokeTest`.

Terminology used in sheets and docs:

- **Installed** means source references and copied installed entries stored on the ship actor.
- **Base** means copied component data used as recalculation input.
- **Derived** means recalculated framework values from Base data plus supported installed modifiers.
- **Current** means editable runtime state on the ship actor.
- **Rooms** are physical spaces.
- **Ship Upgrades** are permanent vessel improvements.
- **Arkengine Mods** are engine-only tuning.
- **Stations** are operating roles.
- **Crew Assets** are named/support crew.

## Data Ownership Philosophy

Arcflight keeps data ownership explicit:

1. **Compendium/source item data is content.** Core data modules and created equipment items describe available Hulls, Arkengines, Arkengine Mods, Rooms, Ship Upgrades, and Crew Assets.
2. **Install helpers copy data onto ships.** Helpers store source item references and framework snapshots under the ship actor's `flags.arcflight.system` tree.
3. **Source items remain immutable.** A component item can be installed or copied into a ship roster without changing that item.
4. **Runtime values stay on ships.** Current Hull, Lifeveil, Strain, Morale, stored spell ranks, crew roster state, station assignments, and installed slot summaries are ship-owned runtime data.
5. **Future systems should remain data-driven.** Gameplay pillars should consume Core data instead of hardcoding content into UI or automation logic.

## Core Hull Library and Tier / Refit Readiness

The locked core hull platforms are Void Skiff, Sloop, Cutter, Brigantine, Frigate, Galleon, Hammerhead, Arkcruiser, Dread Caravel, Cathedral Ship, and Leviathan-Class Platform. They remain data-only PF2E equipment components copied into `flags.arcflight.system` by `game.arcflight.createCoreHull(platformKey)`.

Each hull includes base durability, armor, physical resistances, strain, Lifeveil, cargo, speed, maneuverability, AP/RAP, detection, crew bands, core room keys, expansion room slot data, weapon mounts by arc, allowed weapon sizes, arkengine compatibility, traits, and tier/refit-ready schema fields. Tier labels follow the planned scale from Tier 1 Frontier / Local through Tier 5 Mythic / Impossible. Leviathan-Class Platform is marked as district-scale infrastructure instead of a normal expansion-slot hull.

Arcflight now derives non-blocking ship-side tier and refit pressure state under `flags.arcflight.system.tier`, `flags.arcflight.system.refitPressure`, and `flags.arcflight.system.refitFlags`. The first-pass framework sums installed component `refitPressure` values by category, compares total pressure against the installed hull's `refitTolerance.totalBeforeMajorRefitRequired`, and reports `native`, `pressured`, or `major-refit-required` status. Major refit completion is intentionally not automated yet, and the framework remains warning/status-only: it does not block installs, fire weapons, run combat automation, or resolve travel systems.


## Component Tier / Refit Metadata

Arcflight component defaults now include safe, data-only tier/refit fields for future install validation: `minimumTier`, `recommendedTier`, `tierImpact`, `refitPressure`, `refitTags`, `refitCategory`, `specialistRequirements`, and `rareMaterialRequirements`. Missing fields default safely, so older Arcflight items and ships continue to load without migration or install blocking.

Core Arkengines, Arkengine Mods, Rooms, Ship Upgrades, and Crew Assets now carry tier-aware metadata. Refit pressure is still non-blocking and advisory: it increases ship pressure totals and warning flags, but it does not prevent installs, open validation dialogs, fire weapons, run travel/combat automation, or mutate PF2E source documents. Use `game.arcflight.getComponentTierMetadata(component)` and `game.arcflight.getComponentRefitPressure(component)` to read normalized metadata from source items, installed entries, or legacy data shapes.

## Arkengine Fueling Framework

Arkengines are treated as propulsion, Lifeveil, and magical power systems that store spell-rank energy rather than ordinary fuel. Core arkengine source data now includes `fueling.requiredSpellRank`, `fueling.fuelSlots`, and `fueling.maxStoredSpellRanks`, with max storage normalized as required spell rank multiplied by fuel slots.

Fueling remains data-only in this patch. Strain continues to represent short-term danger, while stored spell ranks represent long-term engine endurance. Installing an arkengine copies its fueling snapshot into `flags.arcflight.system.base.arkengine.fueling`, derives read-only burn cost summaries under `flags.arcflight.system.derived`, and initializes `flags.arcflight.system.current.storedSpellRanks` only when doing so is safe for ship-owned runtime state. No fuel spending, spell-slot sacrifice UI, travel gameplay, overcharge resolution, hard burn resolution, resource gameplay, or event automation is implemented.

## Runtime Helpers

When the module initializes, it exposes the stable helper surface at `game.arcflight`:

- Creation: `createItem`, `createCoreHull`, `createHull`, `createCoreArkengine`, `createArkengine`, `createCoreArkengineMod`, `createArkengineMod`, `createCoreRoom`, `createRoom`, `createCoreShipUpgrade`, `createShipUpgrade`, `createCoreCrewAsset`, `createCrewAsset`.
- Data lookup: `getCoreHull`, `getCoreArkengine`, `getCoreArkengineMod`, `getCoreCrewAsset`, `getCoreRoom`, `getCoreShipUpgrade`, `getArkengineVariant`, `getArkengineVariants`, `getStation`, `getStations`.
- Key lookup: `CORE_HULL_PLATFORM_KEYS`, `CORE_ARKENGINE_KEYS`, `CORE_ARKENGINE_MOD_KEYS`, `CORE_CREW_ASSET_KEYS`, `CORE_ROOM_KEYS`, `CORE_SHIP_UPGRADE_KEYS`, `ARKENGINE_VARIANT_KEYS`, `STATION_KEYS`, plus matching `get*Keys()` helpers.
- Defaults and type checks: `getDefaultComponentData`, `getDefaultShipData`, `isArcflightItem`, `getComponentType`, `getComponentData`, `getComponentTierMetadata`, `getComponentRefitPressure`, `isArcflightVehicle`, `setArcflightVehicleEnabled`.
- Installation and ship state: `installHull`, `installHullOnShip`, `installArkengine`, `installArkengineOnShip`, `installArkengineMod`, `installArkengineModOnShip`, `installRoom`, `installRoomOnShip`, `installShipUpgrade`, `installShipUpgradeOnShip`, `addCrewAsset`, `removeCrewAsset`, `recalculateShipStats`, `calculateDerivedShipStats`, `calculateRefitPressure`, `updateShipTierState`, `getShipTierState`, `getShipRefitPressure`, `getShipRefitStatus`.
- Stations: `assignStation`, `clearStationAssignment`, `assignShipStation`, `clearShipStation`.
- Development validation: `runFrameworkSmokeTest`.
- Item organization, core library sync, and safe duplicate cleanup: `game.arcflight.devTools.createItemFolders()`, `game.arcflight.devTools.organizeArcflightItems()`, `game.arcflight.devTools.findMissingCoreArcflightItems()`, `game.arcflight.devTools.syncCoreArcflightItems()`, `game.arcflight.devTools.findDuplicateArcflightItems()`, `game.arcflight.devTools.cleanupDuplicateArcflightItems()`, and matching top-level helpers on `game.arcflight`.

## Item Organization Workflow

Arcflight components remain normal PF2E `equipment` items with Arcflight data under `flags.arcflight`; the module does not register custom Item subtypes and does not patch PF2E item creation. For world cleanup before adding larger content libraries, use the development helpers from the Foundry console after `game.ready === true`:

```js
await game.arcflight.createArcflightItemFolders();
await game.arcflight.findMissingCoreArcflightItems();
await game.arcflight.syncCoreArcflightItems({ dryRun: true });
await game.arcflight.syncCoreArcflightItems({ dryRun: false });
await game.arcflight.organizeArcflightItems();
await game.arcflight.findDuplicateArcflightItems();
await game.arcflight.cleanupDuplicateArcflightItems({ dryRun: true });
```

`createItemFolders()` creates the suggested world Items panel tree without creating, moving, or deleting items:

- `Arcflight/Hulls`
- `Arcflight/Arkengines`
- `Arcflight/Arkengine Mods`
- `Arcflight/Weapons`
- `Arcflight/Rooms`
- `Arcflight/Ship Upgrades`
- `Arcflight/Cargo`
- `Arcflight/Crew Assets`
- `Arcflight/Ammo`

### Core Item Library Sync

`findMissingCoreArcflightItems()` is a dry-run reporting helper for the Arcflight source registries. It compares the core Hull, Arkengine, Arkengine Mod, Room, Ship Upgrade, and Crew Asset keys against existing Arcflight-enabled world Items and reports `existing`, `missing`, `skipped`, and warning details by category. It does not create, move, update, or delete anything. Core Stations are reported as skipped because they remain data-only in the current architecture.

`syncCoreArcflightItems()` is also dry-run by default. `syncCoreArcflightItems({ dryRun: true })` reports the Items that would be created, while `syncCoreArcflightItems({ dryRun: false })` creates only missing PF2E `equipment` world Items through the existing `createCore*` helpers, leaves existing matches and duplicates alone, and then runs `organizeArcflightItems()` to place Arcflight components in the correct folders. Matching is intentionally conservative: Arcflight-enabled equipment must have the expected `flags.arcflight.componentType`, source/core keys are preferred when present, and name-plus-component matching is used only when an existing item lacks a key.

`organizeArcflightItems()` first ensures that tree exists, then moves only world Items where `type === "equipment"`, `flags.arcflight.enabled === true`, and `flags.arcflight.componentType` matches a supported Arcflight component type. Normal PF2E equipment, actor-embedded items, and compendium contents are left untouched, and no items are deleted. The `Ammo` folder is created for future content organization but is not currently tied to an Arcflight component type.

Compendium packs remain intentionally minimal for now. Source data continues to live in the data modules until Arcflight's content pack shape is ready to stabilize.

### Duplicate Cleanup Workflow

Repeated helper/test/content creation can leave duplicate Arcflight world Items in the Items tab. Duplicate cleanup is conservative and dry-run-only by default. It scans only world Items from `game.items`, requires `type === "equipment"`, `flags.arcflight.enabled === true`, a supported `flags.arcflight.componentType`, and membership in the `Arcflight` item folder tree. It does not scan or delete compendium source packs, non-Arcflight equipment, or actor-embedded installed ship items.

Duplicate groups are matched by item name, Foundry item type, Arcflight enabled state, component type, and an Arcflight source/core key when present under fields such as `flags.arcflight.system.key`, `flags.arcflight.key`, `flags.arcflight.system.identity.id`, `flags.arcflight.system.platform`, or `flags.arcflight.system.engineClass`. The oldest/lowest-sort matching world Item is kept and later duplicates are reported or deleted.

Recommended Foundry console workflow after `game.ready === true`:

```js
await game.arcflight.findDuplicateArcflightItems();
await game.arcflight.cleanupDuplicateArcflightItems({ dryRun: true });
await game.arcflight.cleanupDuplicateArcflightItems({ dryRun: false });
await game.arcflight.organizeArcflightItems();
await game.arcflight.runFrameworkSmokeTest({ cleanup: true });
```

Use `dryRun: false` only after reviewing the returned `duplicateGroups`, `keptItem`, `duplicateItems`, `skippedItems`, and `warnings` report. The same helpers are also available under `game.arcflight.devTools`.

## Smoke Test Helper Usage

Run the framework smoke test from the Foundry console:

```js
await game.arcflight.runFrameworkSmokeTest({ cleanup: true });
```

Expected result:

- The returned object has `passed: true`.
- No Arcflight-specific console errors appear.
- The helper can create temporary Arcflight framework data, install components, validate slot summaries, assign and clear a Station, and clean up temporary documents when `cleanup: true` is provided.
- Normal PF2E equipment sheets still open.
- Normal PF2E vehicle sheets still open.

## Manual Test Checklist

After sheet or release-readiness changes, verify the following in Foundry:

1. Run:

   ```js
   await game.arcflight.runFrameworkSmokeTest({ cleanup: true });
   ```

2. Confirm the returned result has `passed === true`.
3. Open an Arcflight ship sheet and confirm it displays Installed Hull, Installed Arkengine, Installed Arkengine Mods, Installed Rooms, Ship Upgrades, Crew Roster, Station Assignments, Derived values, Current values, and room / arkengine mod / ship upgrade slot summaries.
4. Open Arcflight component sheets for Hull, Arkengine, Arkengine Mod, Room, Ship Upgrade, and Crew Asset items.
5. Open a normal PF2E equipment sheet.
6. Open a normal PF2E vehicle sheet.
7. Confirm empty or missing installed sections do not crash Arcflight sheet rendering.
8. Confirm there are no Arcflight-specific console errors.

## Current Module Behavior

When the module is enabled, the browser console should log:

```text
Arcflight | Initializing module
```

The module then registers optional ApplicationV2 sheets for PF2E equipment and PF2E vehicle actors without making them defaults. Normal PF2E sheets remain available and unaffected.

## Future Direction

Arcflight remains data-driven in direction. Core defines reusable systems; future pillars should consume Core; future GM tools should consume Core and pillars. Gameplay pillar systems are intentionally not part of the Framework Foundation milestone.
