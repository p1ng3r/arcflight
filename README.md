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

- **Hull** — base vessel platform data and copied ship Base values.
- **Arkengine** — installed propulsion framework data, variant family fields, spell-rank fueling schema, and derived engine values.
- **Arkengine Mod** — engine-only tuning components with tracked mod slot usage, a 22-entry core content library, and placeholder interactions.
- **Room** — physical ship spaces, with core rooms and expansion room slot tracking.
- **Ship Upgrade** — permanent vessel improvements with ship upgrade slot tracking and a 28-entry core content library.
- **Crew Asset** — named/support crew source items copied into ship-owned crew rosters.
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

## Arkengine Fueling Framework

Arkengines are treated as propulsion, Lifeveil, and magical power systems that store spell-rank energy rather than ordinary fuel. Core arkengine source data now includes `fueling.requiredSpellRank`, `fueling.fuelSlots`, and `fueling.maxStoredSpellRanks`, with max storage normalized as required spell rank multiplied by fuel slots.

Fueling remains data-only in this patch. Strain continues to represent short-term danger, while stored spell ranks represent long-term engine endurance. Installing an arkengine copies its fueling snapshot into `flags.arcflight.system.base.arkengine.fueling`, derives read-only burn cost summaries under `flags.arcflight.system.derived`, and initializes `flags.arcflight.system.current.storedSpellRanks` only when doing so is safe for ship-owned runtime state. No fuel spending, spell-slot sacrifice UI, travel gameplay, overcharge resolution, hard burn resolution, resource gameplay, or event automation is implemented.

## Runtime Helpers

When the module initializes, it exposes the stable helper surface at `game.arcflight`:

- Creation: `createItem`, `createCoreHull`, `createHull`, `createCoreArkengine`, `createArkengine`, `createCoreArkengineMod`, `createArkengineMod`, `createCoreRoom`, `createRoom`, `createCoreShipUpgrade`, `createShipUpgrade`, `createCoreCrewAsset`, `createCrewAsset`.
- Data lookup: `getCoreHull`, `getCoreArkengine`, `getCoreArkengineMod`, `getCoreCrewAsset`, `getCoreRoom`, `getCoreShipUpgrade`, `getArkengineVariant`, `getArkengineVariants`, `getStation`, `getStations`.
- Key lookup: `CORE_HULL_PLATFORM_KEYS`, `CORE_ARKENGINE_KEYS`, `CORE_ARKENGINE_MOD_KEYS`, `CORE_CREW_ASSET_KEYS`, `CORE_ROOM_KEYS`, `CORE_SHIP_UPGRADE_KEYS`, `ARKENGINE_VARIANT_KEYS`, `STATION_KEYS`, plus matching `get*Keys()` helpers.
- Defaults and type checks: `getDefaultComponentData`, `getDefaultShipData`, `isArcflightItem`, `getComponentType`, `getComponentData`, `isArcflightVehicle`, `setArcflightVehicleEnabled`.
- Installation and ship state: `installHull`, `installHullOnShip`, `installArkengine`, `installArkengineOnShip`, `installArkengineMod`, `installArkengineModOnShip`, `installRoom`, `installRoomOnShip`, `installShipUpgrade`, `installShipUpgradeOnShip`, `addCrewAsset`, `removeCrewAsset`, `recalculateShipStats`, `calculateDerivedShipStats`.
- Stations: `assignStation`, `clearStationAssignment`, `assignShipStation`, `clearShipStation`.
- Development validation: `runFrameworkSmokeTest`.

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
