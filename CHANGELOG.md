# Changelog

## Unreleased

### Ship Tier / Refit Pressure Framework

- Added ship-owned tier state, refit pressure totals, and major-refit warning flags under `flags.arcflight.system` with schema fallbacks for older ships.
- Added non-blocking helpers for calculating refit pressure, updating ship tier state, and reading tier/refit status from ship actors or ship system data.
- Integrated tier/refit recalculation into ship stat recalculation and install helpers while preserving current runtime resources.
- Extended the framework smoke test to validate base-tier copying, native/no-pressure state, pressured state below hull tolerance, major-refit-required state at tolerance, and stored major-refit flags.
- Kept this pass data/helper/validation focused; no refit completion UI, install prevention, travel automation, combat automation, weapon firing, custom PF2E subtypes, or item monkey-patching was added.

### Core Hull Tier / Refit Readiness

- Verified the locked 11-entry core hull platform library and added tier/refit-ready `classification`, `refitTolerance`, and `refitNotes` schema fields to every hull.
- Normalized core hull room references to locked core room keys, kept numeric expansion slots on standard hulls, and marked Leviathan-Class Platform as district-scale infrastructure.
- Extended the framework smoke test helper with lightweight core hull validation for key count, classification, refit tolerance, arkengine compatibility, standard expansion slots, and Leviathan district scale.
- Kept the hull-readiness pass content/data-only; it did not add install blocking, weapon firing, combat automation, travel automation, UI changes, or compendium deletion changes.

### Phase 2A - Item Panel and Compendium Cleanup

- Added Arcflight item organization helpers for the world Items panel, including `game.arcflight.devTools.createItemFolders()` and `game.arcflight.devTools.organizeArcflightItems()`.
- Added safe, dry-run-by-default duplicate cleanup helpers exposed as `game.arcflight.findDuplicateArcflightItems()`, `game.arcflight.cleanupDuplicateArcflightItems()`, and matching `game.arcflight.devTools` aliases.
- Limited duplicate cleanup to Arcflight-enabled PF2E equipment world Items inside the Arcflight folder tree, with skipped-item reporting for non-Arcflight, embedded actor, compendium, or out-of-tree documents.
- Added the suggested `Arcflight` folder tree for Hulls, Arkengines, Arkengine Mods, Weapons, Rooms, Ship Upgrades, Cargo, Crew Assets, and Ammo.
- Kept organization limited to Arcflight PF2E equipment components with supported `flags.arcflight.componentType` values; normal PF2E equipment, embedded actor items, and compendium contents are not moved or deleted.
- Documented the item organization workflow and deferred compendium pack expansion until content pack structure is ready to stabilize.

### Phase 7.5D-4 - Crew Asset Content Library Expansion

- Added 10 lightweight named core crew specialists: Grizzled Bosun, Voidscarred Helmsman, Junior Engine Apprentice, Occult Veil Adept, Old Star Cartographer, Powdermaster Gunner, Quiet Smuggler Contact, Shipboard Surgeon, Morale Cook, and Hull Patcher.
- Updated the core crew asset registry so `CORE_CREW_ASSET_KEYS` now exposes 15 entries and `getCoreCrewAsset()` / `createCoreCrewAsset()` can resolve the new keys.
- Kept this patch content/data-only with immutable source definitions, placeholder capability hooks only, and no morale, wages, injury automation, station actions, combat, travel, UI, or broad refactor work.

### Phase 7.5D-3 - Room Content Library Expansion

- Added 10 core expansion room entries: Salvage Bay, Ritual Chamber, Armory, Chart Room, Smuggler Hold, Crew Lounge, Quarantine Ward, Specimen Vault, Forge Bay, and Diplomatic Suite.
- Updated room type constants and the core room registry so `CORE_ROOM_KEYS` now exposes 26 room entries across locked core rooms and installable expansion rooms.
- Kept this patch content/data-only; no gameplay automation, combat systems, travel systems, station actions, UI changes, or broad refactors were added.

### Phase 7.5D-2 - Ship Upgrade Content Library Expansion

- Added 12 Standard core ship upgrade entries for structural, Lifeveil, detection, support, mobility, deep-void, occult, command, logistics, and strain platform improvements.
- Updated the ship upgrade category constants and core key registry so the immutable core ship upgrade library now exposes 28 entries.
- Kept this patch content/data-only; no gameplay automation, combat systems, travel systems, fuel spending, station actions, UI changes, or broad refactors were added.

### Phase 7.5D-1 - Arkengine Mod Content Library Expansion

- Added 12 Standard core arkengine mod entries for fueling, stealth, hard burn, overcharge, Lifeveil, emergency pressure, deep void, speed, ritual, filtration, and cooling use cases.
- Extended arkengine mod derived-stat support to allow data-driven fuel slot modifiers while keeping mod definitions immutable and gameplay resolution unimplemented.
- Kept this patch content/data-only; no Hard Burn resolution, Overcharge resolution, fuel spending, travel gameplay, combat gameplay, UI changes, or broad refactors were added.

### Arkengine Fueling Core Patch

- Added data-only arkengine fueling defaults for required spell rank, fuel slots, maximum stored spell ranks, burn cost formulas, overcharge cost placeholder, and emergency spell-slot fueling permission.
- Added fueling data to all 11 core arkengines, including numeric Leviathan Heart Core fueling calculations with the ritual-circle requirement preserved separately.
- Derived ship-side fueling summaries for required spell rank, fuel slots, max stored spell ranks, normal burn cost, hard burn cost, lean burn cost, and stealth burn cost from copied arkengine Base data.
- Initialized ship-owned current stored spell ranks only when installing an arkengine can do so safely without overwriting existing current fuel values.
- Updated the framework smoke test helper to verify arkengine fueling Base data, derived fuel costs, and preserved current stored spell ranks.
- Kept fueling architecture/data-only; no travel gameplay, fuel spending automation, spell-slot sacrifice UI, overcharge action resolution, hard burn action resolution, resource gameplay, or event systems were added.

### Alignment Pass Chunk 3 - Sheet / Docs / Release Readiness

- Polished the Arcflight ship sheet terminology around Installed, Base, Derived, and Current ship-owned state.
- Clarified sheet labels for Hull, Arkengine, Arkengine Mod, Room, Ship Upgrade, Crew Asset, Station, and slot summaries.
- Added safer sheet view preparation for empty installed lists, missing crew roster data, and installed entries with missing effect arrays.
- Updated component sheet display to prefer display-friendly labels and identity/display names instead of user-facing kebab-case component keys.
- Refreshed README architecture, data ownership, source item immutability, ship runtime ownership, helper summary, smoke test usage, manual testing, release-readiness, and Framework Foundation milestone notes.
- Kept the pass limited to UI, docs, and release-readiness cleanup; no travel, combat, AP/RAP, station action, overcharge, hard burn, event, drag/drop, or automation gameplay was added.

### Phase 6 - Station Framework

- Added locked Station Framework data for Captain, Pilot / Helm, Navigator, Engineer, Veilwarden, Watchmaster, Gunnery, and Quartermaster.
- Added ship-owned station definitions and assignment slots under `flags.arcflight.system.stations` on Arcflight-enabled PF2E vehicle actors.
- Exposed station helper APIs for reading station definitions and assigning or clearing station operators without mutating assignee actors, rooms, installed components, or source items.
- Updated the ship sheet to display station roles and assignment state while keeping stations decoupled from rooms.
- Documented that stations are operating roles, rooms are physical spaces, and no station actions, AP/RAP spending, combat, travel, room dependencies, or gameplay automation were added.


### Phase 4 - Arkengine Mods Framework

- Added normalized arkengine mod component defaults under `flags.arcflight.system` for identity, installation, effects, restrictions, state, traits, and notes.
- Added 10 Standard starter core arkengine mod entries for pressure, Lifeveil, cooling, fueling, overcharge, void stability, harmonic, deep-void, and core bracing use cases.
- Exposed `game.arcflight.CORE_ARKENGINE_MOD_KEYS`, `getCoreArkengineModKeys()`, `getCoreArkengineMod(modKey)`, `createCoreArkengineMod(modKey)`, `installArkengineMod(shipActor, modItem)`, and `installArkengineModOnShip(shipActor, modItem)`.
- Added ship-side installed arkengine mod tracking under `flags.arcflight.system.installed.arkengineMods` plus `arkengineModSlots` capacity, used, and available counts sourced from the installed arkengine and installed mod slot costs.
- Updated derived ship stat recalculation so installed Arkengine Mods apply only supported arkengine-related modifiers before room and Ship Upgrade layers and without mutating hull, arkengine, room, ship upgrade, or mod items.
- Updated the ship sheet to show installed Arkengine Mods, slot usage, mod type, rarity, state, and direct derived-stat effect summaries.
- Documented that Arkengine Mods are engine-only tuning, Ship Upgrades are broader vessel improvements, and Rooms are infrastructure spaces.
- Kept this phase architecture/data-only beyond installation and stat recalculation; no Hard Burn resolution, Overcharge resolution, travel gameplay, combat gameplay, AP/RAP spending, station actions, voyage events, damage automation, condition gameplay, GM generators, or drag/drop installation was added.

### Phase 4.5 - Ship Upgrades Framework

- Added normalized ship upgrade component defaults under `flags.arcflight.system` for identity, installation, effects, restrictions, state, traits, and notes.
- Added 16 Standard core ship upgrade entries for structural, military, command, detection, logistics, defensive, cargo, voidfaring, catastrophe, adaptation, power distribution, propulsion support, lookout, helm system, and sail system use cases.
- Exposed `game.arcflight.CORE_SHIP_UPGRADE_KEYS`, `getCoreShipUpgradeKeys()`, `getCoreShipUpgrade(upgradeKey)`, `createCoreShipUpgrade(upgradeKey)`, `installShipUpgrade(shipActor, upgradeItem)`, and `installShipUpgradeOnShip(shipActor, upgradeItem)`.
- Added ship-side installed upgrade tracking under `flags.arcflight.system.installed.shipUpgrades` plus `shipUpgradeSlots` capacity, used, and available counts with a default capacity of 3.
- Updated derived ship stat recalculation so installed Ship Upgrades can apply `add`, `subtract`, `set`, and `append` modifiers to supported actor-owned derived stats without mutating hull, arkengine, room, or upgrade items.
- Updated the ship sheet to show installed Ship Upgrades, slot usage, upgrade category, rarity, state, and direct derived-stat effect summaries.
- Documented that Ship Upgrades are permanent vessel improvements, not rooms or arkengine mods, and kept placeholder gameplay interactions stored but unresolved.
- Kept this phase architecture/data-only; no combat rounds, travel gameplay, AP/RAP spending, station action resolution, voyage events, weapon firing, Hard Burn resolution, Overcharge resolution, condition gameplay resolution, automation-heavy gameplay, or GM generators were added.

### Phase 4 - Room Framework

- Added normalized room component defaults under `flags.arcflight.system` for identity, installation, utility tags, mechanical effects, upkeep, state, restrictions, traits, and notes.
- Added locked core room references for Arkengine Chamber, Helm, Crew Quarters, Galley & Mess, Cargo Hold, and Officer Wardroom as hull-provided ship infrastructure that does not consume expansion room slots.
- Added starter expansion room data for Workshop, Alchemy Lab, Infirmary, Greenhouse, Observatory, Shrine, Archive, Expanded Cargo Hold, Brig, and Luxury Quarters.
- Exposed `game.arcflight.CORE_ROOM_KEYS`, `getCoreRoomKeys()`, `getCoreRoom(roomKey)`, `createCoreRoom(roomKey)`, `installRoom(shipActor, roomItem)`, and `installRoomOnShip(shipActor, roomItem)`.
- Added ship-side installed room tracking under `flags.arcflight.system.installed.rooms` plus `roomSlots` capacity, used, and available counts sourced from the installed hull.
- Updated derived recalculation and the ship sheet to show core rooms, installed expansion rooms, room states, and slot usage without applying room data to combat speed, AP, RAP, voyage speed, weapon damage, or maneuverability.
- Kept rooms as infrastructure/downtime/logistical support only; no combat, travel, drag/drop, or gameplay automation was added.

### Phase 3.5 - Arkengine Variants + Mod Slot Foundation

- Added the locked 9-family arkengine variant data set with display names, identities, descriptions, effects summaries, traits, and `derivedModifiers` placeholders.
- Exposed `game.arcflight.ARKENGINE_VARIANT_KEYS`, `getArkengineVariantKeys()`, `getArkengineVariant(variantKey)`, and `getArkengineVariants()`.
- Extended core arkengine data with variant families, allowed variant families, and a mod slot profile placeholder without changing existing arkengine stat values.
- Added ship-side installed arkengine mod tracking under `flags.arcflight.system.installed.arkengineMods` and `arkengineModSlots` with capacity, used, and available counts.
- Updated derived ship stats and the ship sheet to show arkengine variant family plus mod slot capacity, used, and available values.
- Kept this phase architecture/data-only; no travel, combat, overcharge resolution, hard burn resolution, station actions, AP/RAP spending, mod item installation behavior, generators, or automation-heavy systems were added.

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
