# Changelog

## Unreleased

### Phase 3 - Arkengine Framework

- Added the locked core arkengine data set with 11 lower-case kebab-case arkengine entries.
- Added flat arkengine component defaults under `flags.arcflight.system` for voyage speed, spell rank requirements, Lifeveil and strain modifiers, overcharge risk, hard burn strain cost, mod slots, resistance tendencies, traits, role/design notes, and implied core systems.
- Exposed `game.arcflight.CORE_ARKENGINE_KEYS`, `getCoreArkengineKeys()`, `getCoreArkengine(engineKey)`, `createCoreArkengine(engineKey)`, and `createArkengine(engineKey)`.
- Exposed `game.arcflight.installArkengine(shipActor, arkengineItem)` / `installArkengineOnShip` to install arkengines onto Arcflight-enabled PF2E vehicle actors without mutating the arkengine item.
- Updated derived ship stats so hull base values combine with arkengine effects for voyage speed, Lifeveil capacity, strain capacity, resistance tendencies, arkengine mod slots, hard burn strain cost, and overcharge risk while keeping hull combat speed hull-owned.
- Added minimal ship-sheet display for installed arkengine references and derived arkengine values.
- Kept this phase architecture/data-only; no travel, combat, AP/RAP spending, station actions, voyage events, initiative, firing systems, damage automation, condition gameplay, overcharge resolution, hard burn resolution, GM generators, fleet systems, or salvage systems were added.

### Fixed

- Removed legacy `name` and `type` keys from the module manifest so Foundry VTT v13 no longer reports unknown manifest keys while keeping `id` and `title` unchanged.
### Phase 2.5 - Installed Hull + Derived Ship Stats

- Added the ship actor architecture layer under `flags.arcflight.system.installed`, `base`, `derived`, and `current`.
- Exposed `game.arcflight.installHull(shipActor, hullItem)` / `installHullOnShip` to install one hull onto an Arcflight-enabled PF2E vehicle actor without mutating the hull item.
- Exposed `game.arcflight.recalculateShipStats(shipActor)` for recalculating derived ship stats from copied base hull data.
- Added simple ship-sheet display for installed hull references, base hull values, derived hull values, and current runtime hull/lifeveil/strain/morale.
- Kept this phase architecture-only; no combat rounds, AP/RAP spending, station actions, voyage gameplay, initiative, firing systems, damage automation, condition gameplay, overcharge gameplay, or GM generators were added.

### Phase 2 - Hull Framework

- Added the locked Core Hull Statout V1 data set with 11 lower-case kebab-case hull platform entries.
- Added validation-ready hull component defaults for defenses, capacities, crew, rooms, weapon mounts, arkengine compatibility, traits, role, and design notes.
- Exposed `game.arcflight.createCoreHull(platformKey)` and `game.arcflight.createHull(platformKey)` helpers that create PF2E equipment items with hull data under `flags.arcflight.system`.
- Expanded the Arcflight component sheet hull section so core hull data can display and edit without changing normal PF2E equipment sheets.
- Kept Phase 2 limited to data structure, helper creation, sheet fields, and documentation; no travel, combat, AP/RAP spending, station actions, voyage events, GM generator, or automation were added.

### Phase 1 - PF2E-Compatible Stabilization

- Stabilized the architecture around PF2E vehicle actors as Arcflight ships and PF2E equipment items as Arcflight components.
- Standardized Arcflight ship and component data under `flags.arcflight.system`.
- Removed obsolete custom Actor and Item subtype document scaffolding.
- Confirmed the module manifest does not declare custom `arcflight.*` Actor or Item `documentTypes`.
- Confirmed Arcflight does not monkey-patch `Item.create` or `Item.createDocuments`.
- Exposed the Phase 1 helper surface through `game.arcflight` for creating components, reading defaults, reading component flags, and enabling PF2E vehicles as Arcflight ships.
- Kept Arcflight sheets optional and non-default so normal PF2E equipment and vehicles remain unaffected.

### Phase 0 - Repository / Module Foundation

- Added the initial Foundry VTT module scaffold for Arcflight.
- Added a minimal v13-compatible module manifest.
- Added placeholder directories for future scripts, styles, templates, packs, data, and assets.
- Added project documentation, development guardrails, and MIT licensing.
