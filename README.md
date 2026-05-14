# Arcflight

Arcflight is a Foundry VTT module for PF2E-compatible fantasy voidfaring campaigns.

## Foundry VTT Compatibility

Arcflight targets Foundry VTT v13 first, with future v14 compatibility in mind.

## Framework Foundation Milestone

Arcflight is currently in its **Framework Foundation** milestone. The module provides a PF2E-safe data and sheet foundation for ships and components, plus a minimal station-action backend and ship-sheet UI that validate actions, allow assigned PF2E character actors to make guarded station-action skill/statistic rolls, and record action history without automating gameplay effects. Travel gameplay, combat gameplay, automated AP/RAP spending, hard burn resolution, overcharge resolution, event systems, drag/drop systems, automation buttons, crew/faction gameplay, and GM tooling remain future work.

For release management, promote framework-foundation work through the active development branch first, then merge to `main` only after Foundry smoke tests and normal PF2E sheet compatibility checks pass.

## Current Foundation Status

The current foundation checkpoint is stable for data-driven ship/component setup, controlled helper installs including weapon mount installs, minimal controlled non-core component removal, and a tabbed ship-sheet UX foundation with best-effort scroll preservation for common action refreshes. It includes core component data, tier/refit pressure summaries, validation previews, persistent install-state records, lifecycle history for hull and arkengine replacement plus non-core removal, dry-run-first backfill tooling, controlled Install Component sheet UI, install-rule enforcement for supported blocking cases, station-action preview/execute/roll helpers, station-action sheet preview/roll/history readouts, ship-owned AP/RAP accounting helpers, and actor resolution safeguards.

The milestone remains deliberately limited. Arcflight does not currently provide drag/drop installation, hull/arkengine removal buttons, source/compendium mutation, station-action effects automation, weapon firing, combat rounds, travel/voyage resolution, automated AP/RAP action spending, crew/faction gameplay, GM generators, or broad automation systems.


## Travel Event Data Foundation

Arcflight now includes a read-only Travel Event Data Foundation for future narrative voyage play. This foundation is data/helper only: it does not add UI, does not mutate ship actors, does not start or advance active travel events, does not spend AP/RAP, and does not automatically hand off to combat.

The MVP travel event taxonomy is locked around reusable data constants for travel event categories, result tiers, round outcomes, event outcomes, and broad travel tags. Travel events use only the Travel Five stations for MVP prompts: Navigator, Engineer, Veilwarden, Watchmaster, and Captain. Pilot, Gunnery, and Quartermaster remain valid core stations, but they are not Travel Five MVP stations.

The first sample event is **Black Tide Crossing**, a five-round environmental crossing with soft station prompts, staged outcome branches, proposed non-executable effects, and GM-facing `combatHandoff` metadata where appropriate. Threat branches never launch combat automatically; they only preserve handoff notes for later GM choice.

Public helper exports on `game.arcflight` and `game.arcflight.devTools` support console inspection and future UI preparation, including core travel event lookups, Travel Five keys, degree contribution mapping, round/event outcome helpers, validation, event summaries, round summaries, and station prompt summaries. These helpers clone summary data and return validation messages instead of throwing for missing events.

## Current Architecture Overview

Arcflight deliberately builds on normal PF2E documents instead of registering custom document subtypes:

- **PF2E vehicle actors are Arcflight ships.** A vehicle becomes an Arcflight ship only after Arcflight flags are enabled on that existing PF2E actor.
- **PF2E equipment items are Arcflight components.** Hull, Arkengine, Arkengine Mod, Room, Ship Upgrade, Cargo, Weapon, and Crew Asset data all live on equipment items with Arcflight flags.
- **Arcflight data lives in flags.** Ship and component data are stored under `flags.arcflight.system`; PF2E-owned `system` data remains untouched.
- **Source items are immutable during installation.** Installing a Hull, Arkengine, Arkengine Mod, Weapon, Room, Ship Upgrade, or Crew Asset copies the needed framework data onto the ship actor and keeps the source item unchanged.
- **Runtime ownership belongs to the ship actor.** Installed references, normalized install-state records, copied Base data, recalculated Derived values, Current runtime values, station assignments, station-action history, and crew roster state are owned by the Arcflight-enabled PF2E vehicle actor.
- **Stations are role data, not equipment items.** Station definitions and assignments live under `flags.arcflight.system.stations` on the ship.
- **Sheets are optional and non-default.** Arcflight registers optional ApplicationV2 sheets for PF2E equipment and vehicle actors without replacing normal PF2E item or vehicle sheets. The Arcflight ship sheet uses lightweight tabs to organize readouts and keeps the selected tab through common sheet-triggered refreshes.

This architecture keeps normal PF2E equipment and vehicles functional unless a user explicitly chooses Arcflight helpers or sheets.

## Completed Framework Systems

The current Framework Foundation includes these data-first systems:

- **Hull** — an 11-entry core vessel platform library with copied ship Base values, arkengine compatibility, weapon mount arcs, core room keys, and tier/refit-ready metadata for the future Refit Pressure framework.
- **Arkengine** — installed propulsion framework data, variant family fields, spell-rank fueling schema, derived engine values, and tier/refit pressure metadata.
- **Arkengine Mod** — engine-only tuning components with tracked mod slot usage, a 22-entry core content library, placeholder interactions, and engine/Lifeveil/occult refit pressure metadata.
- **Weapon** — weapon source components with starter entries, size/family/reload/damage profile schema, backend install/remove helpers, hull weapon mount validation, ship-owned installed weapon snapshots, mount occupancy tracking, validation preview support, and lifecycle install-state records. The ship sheet includes a minimal controlled weapon install/remove UI; combat firing remains future work.
- **Room** — physical ship spaces, with core rooms, expansion room slot tracking, a 26-entry core content library, and infrastructure/occult/Lifeveil refit metadata.
- **Ship Upgrade** — permanent vessel improvements with ship upgrade slot tracking, a 28-entry core content library, and meaningful refit pressure across structural, command, Lifeveil, occult, engine, and military categories.
- **Crew Asset** — named/support crew source items copied into ship-owned crew rosters, with a 15-entry core content library and light advisory tier/refit metadata.
- **Station framework** — ship-owned operating role definitions, assignments, backend station-action preview/execution/roll history helpers, AP/RAP cost affordability previews, Travel Five station constants, and a minimal ship-sheet Station Actions section that records action and skill-roll history only by default.
- **Travel resource alignment** — normalized helper access to live ship travel resources (`hull`, `lifeveil`, `strain`, `morale`, `supplies`, and `storedSpellRanks`) from `flags.arcflight.system.current`, while preserving the legacy `resources` block for structured readout compatibility.
- **Ship actor architecture** — separated `installed`, `base`, `derived`, `current`, and ship-owned AP/RAP `actionEconomy` state on Arcflight-enabled PF2E vehicle actors.
- **Framework smoke test helper** — a Foundry-console validation helper exposed as `game.arcflight.runFrameworkSmokeTest`, with coverage for controlled install enforcement, backend weapon install/remove validation, station-action history recording, non-core component removal, lifecycle history, backfill dry runs, and actor resolution safeguards.

Terminology used in sheets and docs:

- **Installed** means source references and copied installed entries stored on the ship actor.
- **Install State** means normalized ship-owned lifecycle records under `flags.arcflight.system.installState` that future install/removal UI, repair state, combat targeting, voyage wear, cargo manifests, and export tooling can consume.
- **Base** means copied component data used as recalculation input.
- **Derived** means recalculated framework values from Base data plus supported installed modifiers.
- **Current** means editable runtime state on the ship actor. For travel-resource preparation, `flags.arcflight.system.current` is the canonical live state for hull, Lifeveil, strain, morale, supplies, and stored spell ranks.
- **Resources** remains a compatibility/readout block. It is preserved for existing sheets and smoke coverage, but travel gameplay helpers read and mutate `current` first and only use `resources` as a legacy fallback when a current value is missing.
- **Rooms** are physical spaces.
- **Ship Upgrades** are permanent vessel improvements.
- **Arkengine Mods** are engine-only tuning.
- **Stations** are operating roles. The Travel Five for MVP travel prep are Navigator, Engineer, Veilwarden, Watchmaster, and Captain. Pilot / Helm, Gunnery, and Quartermaster remain valid Arcflight stations in `STATION_KEYS`, but they are not core Travel Five stations.
- **Station Actions** are action declarations previewed and recorded under `flags.arcflight.system.stationActions.history`; the ship-sheet MVP groups them by station, validates assignment/phase/readiness, offers data-defined PF2E skill/statistic roll options for assigned character actors, and records history without AP/RAP spend, weapon fire, combat, travel, or effect automation.
- **Crew Assets** are named/support crew.

## Travel Resource / Station Alignment

Before the Travel Event system is added, Arcflight now aligns ship travel resource ownership without adding a travel runner or travel UI. Live travel state is canonical under `flags.arcflight.system.current`:

- `current.hull`
- `current.lifeveil`
- `current.strain`
- `current.morale`
- `current.supplies`
- `current.storedSpellRanks`

The older `flags.arcflight.system.resources` block is intentionally retained for compatibility and structured readouts. Helpers may mirror simple readout values such as `resources.hull.value`, `resources.lifeveil.value`, `resources.strain.value`, `resources.supplies`, and `resources.morale`, but travel-facing mutation targets `current` first. AP/RAP remains combat/action-economy state only and is not used or spent by travel resource helpers.

The MVP Travel Five station set is exactly `navigator`, `engineer`, `veilwarden`, `watchmaster`, and `captain`. `pilot`, `gunnery`, and `quartermaster` remain valid Arcflight core stations for broader ship systems, but they are outside the Travel Five for this cleanup pass.

## Controlled Non-Core Component Removal

The Arcflight ship sheet now includes small **Remove** buttons for installed Weapons, Arkengine Mods, expansion Rooms, Ship Upgrades, and Crew Assets. Removal operates on ship-owned installed lists or the ship-owned crew roster, deactivates matching active install-state records with `removalReason: "removed"`, preserves inactive lifecycle history, recalculates ship stats and slot summaries, and refreshes the sheet. Weapon removal also frees the occupied ship-owned hull mount. If an older ship has installed data but no matching active lifecycle record, the entry is still removed and the sheet warns that lifecycle history was missing.

Hull and Arkengine removal buttons are intentionally not present; core replacement continues to handle Hull and Arkengine lifecycle history. This MVP does not add drag/drop removal, modal wizards, combat/travel automation, weapon firing controls, or source/compendium item mutation.

## Data Ownership Philosophy

Arcflight keeps data ownership explicit:

1. **Compendium/source item data is content.** Core data modules and created equipment items describe available Hulls, Arkengines, Arkengine Mods, Weapons, Rooms, Ship Upgrades, and Crew Assets.
2. **Install helpers copy data onto ships.** Helpers store source item references and framework snapshots under the ship actor's `flags.arcflight.system` tree.
3. **Source items remain immutable.** A component item can be installed or copied into a ship roster without changing that item.
4. **Runtime values stay on ships.** Current Hull, Lifeveil, Strain, Morale, stored spell ranks, crew roster state, station assignments, installed slot summaries, and persistent install lifecycle records are ship-owned runtime data.
5. **Future systems should remain data-driven.** Gameplay pillars should consume Core data instead of hardcoding content into UI or automation logic.

## Core Hull Library and Tier / Refit Readiness

The locked core hull platforms are Void Skiff, Sloop, Cutter, Brigantine, Frigate, Galleon, Hammerhead, Arkcruiser, Dread Caravel, Cathedral Ship, and Leviathan-Class Platform. They remain data-only PF2E equipment components copied into `flags.arcflight.system` by `game.arcflight.createCoreHull(platformKey)`.

Each hull includes base durability, armor, physical resistances, strain, Lifeveil, cargo, speed, maneuverability, AP/RAP, detection, crew bands, core room keys, expansion room slot data, weapon mounts by arc, allowed weapon sizes, arkengine compatibility, traits, and tier/refit-ready schema fields. Tier labels follow the planned scale from Tier 1 Frontier / Local through Tier 5 Mythic / Impossible. Leviathan-Class Platform is marked as district-scale infrastructure instead of a normal expansion-slot hull.

Arcflight now derives ship-side tier and refit pressure state under `flags.arcflight.system.tier`, `flags.arcflight.system.refitPressure`, and `flags.arcflight.system.refitFlags`. The first-pass framework sums installed component `refitPressure` values by category, compares total pressure against the installed hull's `refitTolerance.totalBeforeMajorRefitRequired`, and reports `native`, `pressured`, or `major-refit-required` status. The optional Arcflight ship sheet surfaces those stored tier, pressure, major-refit flag, and validation-summary values as a read-only Tier / Refit / Validation section near the builder/fueling summaries. Major refit completion is intentionally not automated yet, and the framework remains deliberately narrow: it blocks controlled helper installs only for supported install-rule enforcement such as danger validation, slot overflow, duplicate protected installs, and unique crew conflicts; it does not fire weapons, run combat automation, or resolve travel systems.


## Component Tier / Refit Metadata

Arcflight component defaults now include safe, data-only tier/refit fields for future install validation: `minimumTier`, `recommendedTier`, `tierImpact`, `refitPressure`, `refitTags`, `refitCategory`, `specialistRequirements`, and `rareMaterialRequirements`. Missing fields default safely, so older Arcflight items and ships continue to load without migration or install blocking.

Core Arkengines, Arkengine Mods, Weapons, Rooms, Ship Upgrades, and Crew Assets now carry tier-aware metadata. Refit pressure increases ship pressure totals and warning flags, but it does not fire weapons, run travel/combat automation, or mutate PF2E source documents. Use `game.arcflight.getComponentTierMetadata(component)` and `game.arcflight.getComponentRefitPressure(component)` to read normalized metadata from source items, installed entries, or legacy data shapes.

Arcflight also exposes install validation previews through `game.arcflight.previewInstallValidation(shipActor, component)`, `game.arcflight.previewComponentInstall(shipActor, component)`, `game.arcflight.getInstallValidationWarnings(shipActor, component)`, and `game.arcflight.shouldBlockInstall(preview)`. These helpers return stable report objects with `ok`, `severity`, `messages`, `warnings`, `current`, `projected`, and `unsupported` fields. They evaluate component type support, tier fit, projected refit pressure, arkengine compatibility, arkengine mod slots, room slots, ship upgrade slots, weapon hull mounts, crew uniqueness/tier pressure, and duplicate install signals without mutating ship, item, or compendium data. Danger validation always blocks through `shouldBlockInstall`, slot overflow escalates to danger, duplicate unique crew conflicts escalate to danger, and ship upgrade slots are enforced only when the ship has an upgrade slot track.

## Station Action Data Foundation

Arcflight now includes a data-only core station action registry under `data/station-actions/core-station-actions.js` for future combat and travel pillars. Starter actions cover Captain, Pilot / Helm, Engineer, Gunnery, Veilwarden, Watchmaster, and Quartermaster stations with stable keys, station keys, phase labels (`combat`, `travel`, or `both`), `actionType: "stationAction"`, AP/RAP cost placeholders, required crew role text, descriptions, triggers, requirements, effects previews, tags, concise outcome text for `criticalSuccess`, `success`, `failure`, and `criticalFailure`, and future automation notes.

The exposed source helpers are `game.arcflight.getCoreStationAction(key)`, `game.arcflight.getCoreStationActionKeys()`, `game.arcflight.getCoreStationActions()`, `game.arcflight.getCoreStationActionsForStation(stationKey)`, `game.arcflight.getStationActionOutcome(actionKey, degreeOfSuccess)`, and `game.arcflight.previewStationActionOutcome(actionKey, rollResult)`, with matching convenience aliases under `game.arcflight.devTools`. These helpers only read immutable source data and interpret roll result degrees into labels/text. They do not execute actions, mutate actors, spend AP/RAP, create combat rounds, automate travel, fire weapons, or change existing station assignment behavior.

## Station Assignment Sheet UI

The optional Arcflight ship sheet **Crew & Stations** tab now includes a minimal assignment row for each station. Each row shows the current assignment (`Unassigned` or the assigned actor/crew name), a world Actor selector filtered to PF2E character actors, plus **Assign** and **Clear** buttons.

**Assign** calls `assignStation(shipActor, stationKey, { id, uuid, name }, { assigneeType: "actor" })` with the selected character actor identity. **Clear** calls `clearStationAssignment(shipActor, stationKey)`. These controls mutate only the ship actor's station assignment data, preserve sheet tab/scroll context, and rely on normal Foundry actor-update rendering so Station Actions previews refresh after assignment changes. They do not mutate the assigned actor document, spend AP/RAP, execute station actions automatically, or add combat/travel automation.

## Station Action Sheet UI

The optional Arcflight ship sheet now includes a compact **Station Actions** section. It groups registered core station actions by Captain, Pilot / Helm, Engineer, Gunnery, Veilwarden, Watchmaster, and Quartermaster. Each action displays its name, phase, AP/RAP cost, short description, preview status, assigned-crew requirement/status, and a data-defined roll-option selector such as Diplomacy, Piloting Lore, Perception, or Crafting.

The **Roll** button calls `rollStationAction(shipActor, actionKey, { phase, rollOptionKey, skipDialog: false, createMessage: true })`, which first previews the assigned station actor and requested roll option, then resolves a real PF2E `Statistic` from the assigned actor when one exists. Resolution prefers `actor.getStatistic(slug)`, then PF2E skill/perception/save Statistic objects, with read-only `actor.system.skills` used only as fallback metadata. Arcflight normalizes station roll keys such as `piloting-lore`, `warfare-lore`, `perception`, and `reflex` before lookup, then calls `statistic.roll(args)` or `statistic.check.roll(args)` with Arcflight title/label/action/roll-option metadata so PF2E creates the chat card. The helper records `recordType: "roll"` history metadata including action key, station key, assigned actor, roll option, requested/resolved statistic key, statistic label/source, roll status, roll total, PF2E degree of success/outcome when provided, roll/message IDs when available, and interpreted outcome label/text. If PF2E does not provide a degree of success, Arcflight still records the roll total when available and stores the outcome as `Unresolved`. If a rollable PF2E statistic cannot be found or the roll throws, Arcflight warns and records safe `missing-statistic` or `failed` metadata instead of crashing or mutating the assigned actor.

The **Execute/Record** button calls `executeStationAction(shipActor, actionKey, { phase })` after the same preview gate. Actions with blocked/danger previews are disabled and clearly marked. Recording an action appends `recordType: "record"` station-action history on the ship actor and refreshes the sheet; it does not spend AP/RAP, roll dice, fire weapons, create combat rounds, automate travel, or apply effects.

## AP/RAP Economy Foundation

Arcflight ships now carry a ship-owned AP/RAP accounting state under `flags.arcflight.system.actionEconomy`. The framework tracks current AP, max AP, current RAP, and max RAP; derives max values from hull/derived `baseAP` and `baseRAP` when available; and falls back safely for legacy or incomplete ships.

The helper surface includes `game.arcflight.getShipActionEconomy(shipActor)`, `game.arcflight.canSpendShipActionPoints(shipActor, { ap, rap })`, `game.arcflight.spendShipActionPoints(shipActor, { ap, rap, reason })`, and `game.arcflight.resetShipActionEconomy(shipActor, options)`. Spending validates Arcflight-enabled PF2E vehicle ships, rejects negative costs, rejects overspending, and updates only the ship actor's Arcflight flags. Reset restores current AP/RAP to max AP/RAP and accepts only safe numeric overrides.

Station action previews now include AP/RAP cost and affordability metadata from `action.apCost` and `action.rapCost`. The ship sheet shows the current/max AP and RAP readout plus a manual **Reset AP/RAP** button, preserving tab/scroll context around the mutation. Existing **Execute/Record** and **Roll** controls still do not spend AP/RAP by default; helper calls can opt into spending with `{ spendResources: true }` for future/testing use. No initiative, combat rounds, turn tracking, weapon firing, travel automation, station-action effects, assigned-actor mutation, or PF2E roll mechanic changes were added.

A compact **Station Action History** readout shows the latest records with action name, station, phase, assigned crew, timestamp, notes when present, roll statistic/total/result details, and outcome text for `recordType: "roll"` entries. **Clear History** calls `clearStationActionHistory(shipActor)` and refreshes the sheet.

## Weapon Data Foundation

Arcflight now includes a data-only core weapon library under `data/weapons/core-weapons.js`. Weapons remain normal PF2E `equipment` Items with `flags.arcflight.enabled === true` and `flags.arcflight.componentType === "weapon"`; their Arcflight source data lives under `flags.arcflight.system` like every other component.

The starter weapon schema includes stable source keys, names, `small` / `medium` / `large` sizes, family/category fields, crew requirements, reload profiles, compatible arcs, traits, data-only damage profiles, and refit pressure metadata. The exposed source helpers are `game.arcflight.getCoreWeapon(key)`, `game.arcflight.getCoreWeaponKeys()`, `game.arcflight.createCoreWeapon(key)`, and `game.arcflight.createWeapon(key)`, with matching convenience aliases under `game.arcflight.devTools`. Backend install helpers are also available as `game.arcflight.installWeapon(shipActor, weaponItem, { mountId, arc })` and `game.arcflight.removeInstalledWeapon(shipActor, mountedWeaponId)`. These copy a ship-owned installed weapon snapshot, validate hull weapon mounts and compatible arcs, mark the ship-owned mount occupied/free, maintain install-state lifecycle history, and recalculate ship stats. The ship sheet now exposes these helpers through a minimal controlled Weapon install/remove UI, but there is still no combat firing, attack roll, damage roll, ammo tracking, AP/RAP spending, reload-state automation, targeting, station-action automation, or source/compendium mutation.

## Controlled Ship Sheet Install UI

The optional Arcflight ship sheet includes a compact **Install Component** section for controlled helper-driven installs. The selector is limited to Arcflight-enabled PF2E equipment world Items whose `flags.arcflight.componentType` matches the selected category: Hull, Arkengine, Arkengine Mod, Weapon, Room, Ship Upgrade, or Crew Asset. Item selector labels include the component key when available, such as `Workshop [workshop]`, to make similarly named world Items easier to identify. When Weapon is selected, the sheet also shows a hull weapon mount selector with arc/mount/allowed-size labels and disables occupied mounts when possible.

Selecting an item shows read-only item identity (selected item name, component type, UUID, and component key when available), a severity badge (`ok`, `info`, `warning`, or `danger`), an `Install allowed` / `Install blocked` status line with the blocking reason, messages, warnings, projected refit status, projected refit pressure total, and any available slot projection rows. If no matching world Items exist, the sheet hints to run core item sync, confirm the item is PF2E equipment, and confirm `flags.arcflight.enabled` plus `flags.arcflight.componentType`.

The Install button calls only the existing helper for the selected component type (`installHull`, `installArkengine`, `installArkengineMod`, `installWeapon`, `installRoom`, `installShipUpgrade`, or `addCrewAsset`). Weapon preview and install pass `{ mountId, arc }` from the selected hull mount. Successful installs refresh the sheet, clear the selected item, and preserve the selected component type. Helpers now reject duplicate protected installs with clearer errors, preserve hull and arkengine replacement lifecycle history, enforce arkengine mod and room slot overflow, enforce ship upgrade slots when a slot track exists, block occupied/incompatible weapon mounts, and block duplicate unique crew assets. The controlled UI does not mutate source/compendium items, add drag/drop weapon behavior, open a modal wizard, or implement combat/travel automation.

## Persistent Install-State Foundation

Arcflight ships now have a normalized, ship-owned install-state container at `flags.arcflight.system.installState`:

```js
{
  version: 1,
  installs: []
}
```

Each install record is plain serializable data:

```js
{
  installId: "install-id",
  itemId: "source-item-id",
  itemUuid: "Item.sourceUuid",
  componentType: "room",
  installedAt: Date.now(),
  installedBy: "user-id",
  hullSlot: "optional-hull-slot",
  roomSlot: "optional-room-slot",
  weaponArc: "optional-weapon-arc",
  installCategory: "native",
  nativeInstall: true,
  refitInstall: false,
  temporaryInstall: false,
  pressureContribution: {
    total: 0,
    weapon: 0,
    engine: 0,
    infrastructure: 0,
    lifeveil: 0,
    crewCommand: 0,
    occult: 0
  },
  tierAtInstall: 2,
  notes: "optional notes",
  active: true,
  removedAt: Date.now(),
  removedBy: "user-id",
  removalReason: "replaced",
  replacedByInstallId: "new-install-id"
}
```

The foundation layer initializes missing state for older ships, normalizes malformed legacy shapes, generates lightweight install IDs, rejects duplicate `installId` values when recording new installs, and marks records inactive during removal so lifecycle history can remain available to future systems. Existing helper-driven installs now append one persistent install-state record after each successful `installHull`, `installArkengine`, `installArkengineMod`, `installRoom`, `installShipUpgrade`, or `addCrewAsset` call, while repeated duplicate attempts for the same component do not add extra lifecycle records. These records capture item identity, component type, install time/user, active lifecycle state, ship tier at install, and the component's `refitPressure` contribution using stable install categories (`native` for hulls, arkengines, and crew assets; `refit` for arkengine mods and ship upgrades; room installs use `refit` only when the source room carries refit pressure). When helper installs naturally replace a hull or arkengine, the previous active install-state record for that component type is preserved, marked inactive, and annotated with `removedAt`, `removedBy`, `removalReason: "replaced"`, and `replacedByInstallId`; the newly installed hull or arkengine becomes the active record. It does not mutate source or compendium items, create custom document subclasses, enforce slot blocking through install state, or require an install UI.

Helper API:

- `game.arcflight.createInstallId(componentType)` generates a lightweight install record id.
- `game.arcflight.getInstallState(shipActor)` returns normalized `{ version, installs }` state.
- `game.arcflight.getActiveInstallRecords(shipActor)` returns active install records.
- `game.arcflight.getInactiveInstallRecords(shipActor)` returns inactive historical install records.
- `game.arcflight.getInstalledComponents(shipActor)` remains a legacy alias for active install records.
- `game.arcflight.recordInstallState(shipActor, installRecord)` appends one sanitized record and persists it to the ship.
- `game.arcflight.deactivateInstallRecord(shipActor, installId, options)` marks one active record inactive, preserves history, and writes removal metadata.
- `game.arcflight.deactivateInstallRecordsByComponent(shipActor, componentMatcher, options)` marks matching active records inactive for component-driven lifecycle changes.
- `game.arcflight.removeInstallState(shipActor, installId, options)` remains a legacy alias for `deactivateInstallRecord`.
- `game.arcflight.findInstallRecord(shipActor, installId)` returns a matching record or `null`.
- `game.arcflight.prepareInstallStateSummary(shipActor)` derives counts by component type, active/inactive totals, active pressure totals, and present active install categories.
- `game.arcflight.findShipsMissingInstallState()` dry-runs all Arcflight-enabled PF2E vehicle actors and reports ships that have installed hull, arkengine, arkengine mod, room, ship upgrade, or named crew data not represented by active install-state records.
- `game.arcflight.backfillInstallStateForShip(shipActor, { dryRun: true })` prepares safe backfilled records for one ship without writing by default; pass `{ dryRun: false }` to append only missing records.
- `game.arcflight.backfillInstallStateForAllShips({ dryRun: true })` runs the same dry-run-first backfill across all Arcflight ships and returns aggregate `wouldCreate`, `created`, and `skipped` counts.

Backfilled records are marked `installCategory: "backfilled"`, `nativeInstall: false`, `refitInstall: false`, `temporaryInstall: false`, `active: true`, and `notes: "Backfilled from existing installed ship data."`; they preserve available component type, item id/UUID, key/name, `refitPressure` pressure contribution, and use `Date.now()` for `installedAt` unless the installed entry already provides a timestamp. The backfill helpers only read existing ship-owned installed data and append missing ship-owned install-state records when explicitly run with `{ dryRun: false }`; they do not mutate source items, compendium items, delete records, add UI buttons, or run automatically on startup.

Matching aliases are available under `game.arcflight.devTools`. The Arcflight ship sheet now includes a compact, read-only Install State section that surfaces the normalized summary, pressure contribution totals, component type counts, install categories, and active record details from these helpers. The section is display-only: no drag/drop UI, enforced slot locking, install buttons, UI editing, combat systems, travel systems, or persistence migrations beyond basic normalization were added.

## Arkengine Fueling Framework

Arkengines are treated as propulsion, Lifeveil, and magical power systems that store spell-rank energy rather than ordinary fuel. Core arkengine source data now includes `fueling.requiredSpellRank`, `fueling.fuelSlots`, and `fueling.maxStoredSpellRanks`, with max storage normalized as required spell rank multiplied by fuel slots.

Fueling remains data-only in this patch. Strain continues to represent short-term danger, while stored spell ranks represent long-term engine endurance. Installing an arkengine copies its fueling snapshot into `flags.arcflight.system.base.arkengine.fueling`, derives read-only burn cost summaries under `flags.arcflight.system.derived`, and initializes `flags.arcflight.system.current.storedSpellRanks` only when doing so is safe for ship-owned runtime state. No fuel spending, spell-slot sacrifice UI, travel gameplay, overcharge resolution, hard burn resolution, resource gameplay, or event automation is implemented.

## Runtime Helpers

When the module initializes, it exposes the stable helper surface at `game.arcflight`:

- Creation: `createItem`, `createCoreHull`, `createHull`, `createCoreArkengine`, `createArkengine`, `createCoreArkengineMod`, `createArkengineMod`, `createCoreWeapon`, `createWeapon`, `createCoreRoom`, `createRoom`, `createCoreShipUpgrade`, `createShipUpgrade`, `createCoreCrewAsset`, `createCrewAsset`.
- Data lookup: `getCoreHull`, `getCoreArkengine`, `getCoreArkengineMod`, `getCoreWeapon`, `getCoreCrewAsset`, `getCoreRoom`, `getCoreShipUpgrade`, `getArkengineVariant`, `getArkengineVariants`, `getStation`, `getStations`, `getCoreStationAction`, `getCoreStationActionKeys`, `getCoreStationActions`, `getCoreStationActionsForStation`.
- Key lookup: `CORE_HULL_PLATFORM_KEYS`, `CORE_ARKENGINE_KEYS`, `CORE_ARKENGINE_MOD_KEYS`, `CORE_WEAPON_KEYS`, `CORE_CREW_ASSET_KEYS`, `CORE_ROOM_KEYS`, `CORE_SHIP_UPGRADE_KEYS`, `ARKENGINE_VARIANT_KEYS`, `STATION_KEYS`, `CORE_STATION_ACTION_KEYS`, plus matching `get*Keys()` helpers.
- Defaults, type checks, and install previews: `getDefaultComponentData`, `getDefaultShipData`, `isArcflightItem`, `getComponentType`, `getComponentData`, `getComponentTierMetadata`, `getComponentRefitPressure`, `previewInstallValidation`, `previewComponentInstall`, `getInstallValidationWarnings`, `shouldBlockInstall`, `isArcflightVehicle`, `setArcflightVehicleEnabled`.
- Installation and ship state: `installHull`, `installHullOnShip`, `installArkengine`, `installArkengineOnShip`, `installArkengineMod`, `installArkengineModOnShip`, `installWeapon`, `installWeaponOnShip`, `removeInstalledWeapon`, `installRoom`, `installRoomOnShip`, `installShipUpgrade`, `installShipUpgradeOnShip`, `addCrewAsset`, `removeCrewAsset`, `recalculateShipStats`, `calculateDerivedShipStats`, `calculateRefitPressure`, `updateShipTierState`, `getShipTierState`, `getShipRefitPressure`, `getShipRefitStatus`, `getShipActionEconomy`, `resetShipActionEconomy`, `spendShipActionPoints`, `canSpendShipActionPoints`, `getActiveInstallRecords`, `getInactiveInstallRecords`, `getInstalledComponents`, `getInstallState`, `createInstallId`, `recordInstallState`, `deactivateInstallRecord`, `deactivateInstallRecordsByComponent`, `removeInstallState`, `findInstallRecord`, `prepareInstallStateSummary`, `findShipsMissingInstallState`, `backfillInstallStateForShip`, and `backfillInstallStateForAllShips`.
- Stations: `assignStation`, `clearStationAssignment`, `assignShipStation`, `clearShipStation`.
- Development validation: `runFrameworkSmokeTest`.
- Item organization, core library sync, safe duplicate cleanup, install preview, install-state, and backfill helpers: `game.arcflight.devTools.getCoreStationAction()`, `game.arcflight.devTools.getCoreStationActionKeys()`, `game.arcflight.devTools.getCoreStationActions()`, `game.arcflight.devTools.getCoreStationActionsForStation()`, `game.arcflight.devTools.createItemFolders()`, `game.arcflight.devTools.organizeArcflightItems()`, `game.arcflight.devTools.getCoreWeaponKeys()`, `game.arcflight.devTools.getCoreWeapon()`, `game.arcflight.devTools.createCoreWeapon()`, `game.arcflight.devTools.createWeapon()`, `game.arcflight.devTools.findMissingCoreArcflightItems()`, `game.arcflight.devTools.syncCoreArcflightItems()`, `game.arcflight.devTools.findDuplicateArcflightItems()`, `game.arcflight.devTools.cleanupDuplicateArcflightItems()`, `game.arcflight.devTools.previewInstallValidation()`, `game.arcflight.devTools.previewComponentInstall()`, `game.arcflight.devTools.getInstallValidationWarnings()`, `game.arcflight.devTools.shouldBlockInstall()`, `game.arcflight.devTools.getShipActionEconomy()`, `game.arcflight.devTools.resetShipActionEconomy()`, `game.arcflight.devTools.spendShipActionPoints()`, `game.arcflight.devTools.canSpendShipActionPoints()`, `game.arcflight.devTools.installWeapon()`, `game.arcflight.devTools.removeInstalledWeapon()`, `game.arcflight.devTools.getActiveInstallRecords()`, `game.arcflight.devTools.getInactiveInstallRecords()`, `game.arcflight.devTools.getInstalledComponents()`, `game.arcflight.devTools.getInstallState()`, `game.arcflight.devTools.createInstallId()`, `game.arcflight.devTools.recordInstallState()`, `game.arcflight.devTools.deactivateInstallRecord()`, `game.arcflight.devTools.deactivateInstallRecordsByComponent()`, `game.arcflight.devTools.removeInstallState()`, `game.arcflight.devTools.findInstallRecord()`, `game.arcflight.devTools.prepareInstallStateSummary()`, `game.arcflight.devTools.findShipsMissingInstallState()`, `game.arcflight.devTools.backfillInstallStateForShip()`, `game.arcflight.devTools.backfillInstallStateForAllShips()`, and matching top-level helpers on `game.arcflight`.

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

`findMissingCoreArcflightItems()` is a dry-run reporting helper for the Arcflight source registries. It compares the core Hull, Arkengine, Arkengine Mod, Weapon, Room, Ship Upgrade, and Crew Asset keys against existing Arcflight-enabled world Items and reports `existing`, `missing`, `skipped`, and warning details by category. It does not create, move, update, or delete anything. Core Stations are reported as skipped because they remain data-only in the current architecture.

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
- The helper can create temporary Arcflight framework data, install components, verify controlled install-rule enforcement labels, validate slot summaries, preserve replacement lifecycle history, run dry-run backfill coverage, assign and clear a Station, resolve the smoke-test actor reliably, and clean up temporary documents when `cleanup: true` is provided.
- Normal PF2E equipment sheets still open.
- Normal PF2E vehicle sheets still open.

## Manual Test Checklist

After sheet or release-readiness changes, verify the following in Foundry:

1. Run:

   ```js
   await game.arcflight.runFrameworkSmokeTest({ cleanup: true });
   ```

2. Confirm the returned result has `passed === true`.
3. Open an Arcflight ship sheet and confirm it displays Installed Hull, Installed Arkengine, Fueling, the read-only Tier / Refit / Validation summary, the controlled Install Component section, the read-only Install State summary/empty state, Installed Arkengine Mods, Installed Weapons, Installed Rooms, Ship Upgrades, Crew Roster, Station Assignments, Derived values, Current values, and room / arkengine mod / ship upgrade slot summaries.
4. In Install Component, select each component type and confirm the world Item list is filtered and clearly labeled with component keys when available; for Weapon, confirm mount options show arc, mount id, allowed sizes, and occupied status.
5. Select an item and confirm the preview includes the severity badge, allowed/blocked status, selected item name, component type, UUID, messages/warnings, refit pressure, and slot rows when available.
6. Install an allowed item and confirm the sheet refreshes, the selected item clears, and the selected component type remains selected.
7. Fill room slots and confirm the next room shows a blocked preview and cannot install.
8. Fill arkengine mod slots and confirm the next mod shows a blocked preview and cannot install.
9. Try a duplicate unique Crew Asset and confirm the preview and helper feedback block the install clearly.
10. Replace the active Hull and confirm the prior hull install-state record becomes inactive with replacement metadata while the new hull is active.
11. Replace the active Arkengine and confirm the prior arkengine install-state record becomes inactive with replacement metadata while the new arkengine is active.
12. Confirm install-state lifecycle history remains intact after blocked installs, replacements, and duplicate attempts.
13. Confirm preview messages match the enforcement behavior shown by the enabled/disabled Install button.
14. Open Arcflight component sheets for Hull, Arkengine, Arkengine Mod, Room, Ship Upgrade, and Crew Asset items.
15. Open a normal PF2E equipment sheet.
16. Open a normal PF2E vehicle sheet.
17. Confirm empty or missing installed sections do not crash Arcflight sheet rendering.
18. Confirm there are no Arcflight-specific console errors.

## Current Module Behavior

When the module is enabled, the browser console should log:

```text
Arcflight | Initializing module
```

The module then registers optional ApplicationV2 sheets for PF2E equipment and PF2E vehicle actors without making them defaults. Normal PF2E sheets remain available and unaffected.

## Recommended Next Systems

Recommended follow-up systems after this foundation checkpoint are:

1. Station-action filtering/notes ergonomics once the data architecture needs it.
2. Travel/voyage system.
3. Cargo and crew/faction expansion.
4. Future combat pillar work after data contracts are stable.

These should remain data-driven and should continue to avoid source/compendium mutation unless a future content-pack architecture explicitly requires it.

## Future Direction

Arcflight remains data-driven in direction. Core defines reusable systems; future pillars should consume Core; future GM tools should consume Core and pillars. Gameplay pillar systems are intentionally not part of the Framework Foundation milestone.
