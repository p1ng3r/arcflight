# Changelog

### Travel Event Voidsailing Prose Correction

- Corrected core travel event prose toward Arcflight voidsailing/space fantasy tone across Black Tide Crossing, Derelict Lantern Wreck, Crew Fever in the Lifeveil, False Beacon Ambush, and Portside Diplomatic Snare.
- Added smoke coverage to flag literal-ocean wording regressions in core travel event prose.


## Unreleased

### Travel Event Builder Form Editor MVP

- Added basic local-only form editing to the Travel Event Builder shell for top-level draft fields, including key, name, category, base DC, round count, description/GM summary, tags, active resources, and Travel Five stations.
- Kept raw JSON editing/import/export available as the advanced fallback, with form edits normalized through builder helpers and validation/export readiness continuing to display.
- Added smoke coverage for builder form option state, local-only form draft updates, continued validation/normalization, JSON import/export after form edits, and no actor/AP/RAP/travel-resource mutation.
- Preserved scope boundaries: no persistence, no settings or compendium writes, no actor mutation, no chat posting, no event running, no round/station/outcome editors, no AP/RAP mechanics, no combat automation, and no staged-effect application was added.

### Travel Event Builder Foundation MVP

- Added a data/helper-only Travel Event Builder Foundation for future GM-facing event authoring, including draft creation, normalization, strict validation, finalization, cloning from existing event definitions, staged resource-effect scaffolding, and read-only preview summaries.
- Exposed builder helpers on `game.arcflight` and `game.arcflight.devTools` while keeping drafts non-persistent and removing builder metadata from finalized event data by default.
- Extended framework smoke coverage for helper exports, canonical draft shape, non-mutating normalization, safe invalid-draft validation/finalization, source-event cloning, resource-effect validation, preview summaries, continued core-event validation, and no AP/RAP/resource/combat automation.
- Preserved scope boundaries: no full builder UI, drag/drop editor, AI generation, compendium packs, database persistence, automatic combat start, AP/RAP travel use, new travel mechanics, or automatic staged-effect application was added.

### Travel Event Narrative Log MVP

- Added a persistent Travel Event Log to the Travel Event Runner so recorded station results keep round, station, degree, actor/statistic/roll metadata, player action prose, result feedback, notes, and timestamps visible after notification quips fade.
- Preserved existing inline station-card feedback and temporary notifications while keeping this pass runner UI only: no automatic chat posting, combat start, AP/RAP travel use, staged-effect automation, new stations, or new travel mechanics were added.
- Extended smoke coverage for station-result narrative fields, PF2E-style roll metadata compatibility, narrative log row preparation, completed-event preservation, and no AP/RAP or travel-resource mutation from result recording.

### Travel Event Builder Draft Import/Export Foundation

- Added backend-only Travel Event Builder draft import/export helpers for safe JSON parsing, non-mutating draft normalization/validation, WIP draft export, finalized data-only event export, and export preview summaries.
- Exposed the builder IO helpers on `game.arcflight` and `game.arcflight.devTools`, with smoke coverage for malformed JSON, non-object JSON roots, round-trip draft import/export, invalid final export blocking, builder metadata stripping, and no AP/RAP, ship-resource, combat, or persistence automation.
- Preserved scope boundaries: no UI, no draft persistence, no settings storage, no compendium packs, no chat posting, no event running, no actor mutation, no staged-effect application, no AP/RAP travel mechanics, and no combat or encounter automation was added.

### Core Travel Event Template Upgrade and Pack 01B

- Upgraded all existing core travel events to the Travel Event Authoring Template standard with station `playerAction` text and four-degree `rollFeedback` quips.
- Added **False Beacon Ambush** and **Portside Diplomatic Snare** as Core Travel Event Pack 01B, bringing the registry-backed core event selector to five events.
- Added Travel Runner post-roll notification feedback that prefers station `rollFeedback` after manual result recording or PF2E assigned-actor auto-recording, with existing generic messages preserved as a fallback.
- Extended framework smoke coverage for five core event keys, normal and strict authoring validation, expected round counts, Travel Five-only station prompts, valid active resources, library selector details for Pack 01B, and runner readout compatibility.
- Preserved scope boundaries: no GM custom event builder, custom event creation, JSON import/export, compendium packs, automatic combat start, new stations, new travel mechanics, AP/RAP travel use, or automatic staged effect application was added.

### Travel Event Authoring Template MVP

- Added the official Travel Event Authoring Template documentation for canonical event, round, station prompt, roll feedback, outcome branch, and final outcome structures.
- Added template helper exports for blank event/round/station/feedback/outcome skeletons, authoring guidelines, and strict authoring validation on `game.arcflight` and `game.arcflight.devTools`.
- Extended travel event validation with optional `strictAuthoring` checks for station `playerAction`, four-key `rollFeedback`, data-only proposed effects, and no AP/RAP references in event data.
- Made the Travel Event Runner safely display future `playerAction` and degree-based `rollFeedback` fields when present while preserving existing event behavior.
- Extended smoke coverage for template exports, canonical blank skeletons, strict authoring rejection cases, and continued normal validation for current core travel events.
- Preserved scope boundaries: no new core events, GM event builder, custom event creation, JSON import/export, compendium packs, automatic combat start, AP/RAP travel use, new mechanics, or automatic staged effect application was added.

### Core Travel Event Pack 01A

- Added two validated registry-backed core travel events: **Derelict Lantern Wreck** (Discovery, 4 rounds, base DC 19) and **Crew Fever in the Lifeveil** (Shipboard, 4 rounds, base DC 18).
- Kept both events data-only with Travel Five station prompts, known travel resources/tags, staged proposed effects, required round branches, and required final outcomes.
- Extended framework smoke coverage for all three core event keys, Pack 01A event existence/validation, round counts, Travel Five station constraints, active resource constraints, library options, and selected event details.
- Preserved no-new-mechanics boundaries: no runner UI changes, GM builder, custom event creation, AP/RAP travel use, automatic combat start, or new resource mechanics were added.

### Travel Event Library Selector MVP

- Replaced the no-active-event hardcoded **Start Black Tide Crossing** runner control with a small core Travel Event Library selector and **Start Selected Event** control.
- Built selector options and selected-event details from the registered core travel event registry, with Black Tide Crossing remaining the first sample event.
- Added smoke coverage for registry-backed library options, Black Tide Crossing presence, selected detail metadata, and continued runner/helper exposure.
- Preserved existing runner boundaries and behavior: active-event flow, manual station entry, PF2E assigned-actor rolls, staged Apply controls, completed summaries, no AP/RAP use, no combat automation, and no GM custom event builder.

### Travel Staged Effects Apply MVP

- Added explicit GM-controlled Apply controls for staged travel resource effects in the Travel Event Runner, including per-effect Apply buttons, Apply All Resource Effects group buttons, before/after previews, applied status readouts, and disabled applied effects.
- Added `previewTravelStagedEffectApplication`, `applyTravelStagedEffect`, and `applyTravelStagedEffects` helpers for resource staged effects only, using the existing ship travel resource preview/update helpers.
- Staged effect application now records `applied`, `appliedAt`, `appliedBy`, and `applicationResult` metadata on active travel state or completed-event final summaries and blocks double application by default.
- Unsupported non-resource staged effects stay visible as manual / unsupported in MVP and are skipped safely by helpers.
- Extended smoke coverage for non-mutating previews, resource-only mutation, unchanged AP/RAP, double-apply blocking, unsupported-effect safety, and helper exposure on `game.arcflight` and `game.arcflight.devTools`.
- Preserved no-automation boundaries: no automatic effect application, automatic combat start, encounter creation, initiative rolling, AP/RAP use, weapon/movement automation, or GM event builder was added.

### Travel Event Runner PF2E Roll Buttons MVP

- Added optional assigned-actor PF2E roll controls to Travel Event Runner station prompts, including assigned actor readouts, statistic selectors sourced from prompt suggested skills or station primary skills, effective DC display, and a delegated Roll Assigned Actor button.
- PF2E travel rolls now use the shared statistic helpers, create normal PF2E chat cards when possible, and automatically record the travel station result only when a roll degree is available.
- Preserved manual degree entry as the fallback for unassigned stations, unresolved statistics, failed rolls, missing roll degrees, and GM narrative overrides.
- Extended travel station result records with optional PF2E roll metadata (`rollTotal`, `rollId`, `messageId`, and `source`) without changing manual result behavior.
- Kept the boundary explicit: no AP/RAP spending, travel resource mutation, staged effect application, combat station action execution, automatic combat start, encounter creation, initiative rolling, weapon/movement automation, or GM event builder was added.

### Travel Event Runner UI MVP

- Added a GM-facing, ship-attached Travel Event Runner ApplicationV2 UI for Arcflight-enabled PF2E vehicle actors.
- Exposed `ArcflightTravelEventRunner` and `openTravelEventRunner(shipActor, options = {})` on `game.arcflight` and `game.arcflight.devTools`.
- Added an Arcflight ship sheet Overview button/readout for opening the runner while preserving existing tab and scroll behavior.
- The runner can start Black Tide Crossing, display current round vignettes and Travel Five prompts, manually record station result degrees, block duplicate primary station results, advance rounds, complete or clear events, and show latest completed-event summaries.
- Staged round/final effects and combat-handoff metadata are displayed only; the UI does not apply effects, mutate ship travel resources, spend AP/RAP, roll PF2E statistics, create encounters, roll initiative, or start combat.
- Extended framework smoke checks for runner helper exposure, importability, ship sheet travel runner readout state, and continued backend no-mutation boundaries.

### Ship-Attached Travel Event State Foundation MVP

- Added ship-owned travel event state under `flags.arcflight.system.travel`, with one active event, per-round result state, staged effects, combat-handoff metadata, history, and completed-event history.
- Added backend helpers to get state, get the active event, start a validated core event, record Travel Five station results, read the current round, advance rounds, complete events, and clear active events.
- Station result recording normalizes degree labels, uses Travel Five contribution mapping, updates round/event totals, rejects non-Travel Five stations, and blocks duplicate primary station results per round unless explicitly overridden.
- Round advancement and event completion stage proposed effects from data branches without applying them, mutating resources, spending AP/RAP, creating PF2E roll buttons, starting combat, or handing off to automation.
- Exposed all ship travel event state helpers on `game.arcflight` and `game.arcflight.devTools`, and extended framework smoke coverage for Black Tide Crossing state lifecycle, duplicate blocking, staged effects, unchanged AP/RAP/resources, clear behavior, and helper exposure.

### Shared PF2E Statistic Helper Extraction

- Extracted generic PF2E statistic key normalization, Lore candidate discovery, actor statistic resolution, rollability checks, roll-total extraction, and guarded statistic rolling into `scripts/helpers/pf2e-statistics.js`.
- Updated station-action roll execution to consume the shared PF2E statistic helper while preserving current station-action API names, roll history behavior, warning behavior, and default non-spending AP/RAP behavior.
- Exposed the shared PF2E statistic helpers on `game.arcflight` and `game.arcflight.devTools` for station actions now and future travel event prompts later.
- Extended framework smoke coverage for shared helper exports, Lore key normalization/candidates, null-safe resolution, and existing station-action missing-actor/missing-statistic safeguards.
- Kept this pass refactor-only: no travel runner, travel UI, ship travel event state, combat automation, station-action outcome change, or AP/RAP behavior change was added.

### Travel Event Data Foundation MVP

- Added locked travel event taxonomy constants for categories, result tiers, round outcomes, event outcomes, and broad reusable travel tags.
- Added the read-only core travel event registry with the five-round **Black Tide Crossing** sample event, Travel Five station prompts, staged outcome branches, proposed non-executable effects, final outcomes, rewards/losses, and GM-only combat handoff metadata.
- Added travel event helper utilities for Travel Five keys, degree normalization/contribution mapping, round/event outcome interpretation, event validation, and cloned event/round/station prompt summaries.
- Exposed travel event data and helpers on `game.arcflight` and `game.arcflight.devTools` for console inspection and future UI preparation.
- Extended framework smoke coverage for travel taxonomy, Travel Five membership, Black Tide Crossing validation, resource/station constraints, helper mappings, outcome helpers, and public/devTools exports.
- Kept this pass deliberately data/helper-only: no UI, ship mutation, active event state, travel advancement, AP/RAP travel spending, automatic combat handoff, combat automation, or GM builder was added.

### Travel Resource / Station Alignment Cleanup MVP

- Added canonical live travel resource helpers for ship `current` state, including `current.supplies`, normalized readout, non-mutating previews, clamped updates, and legacy `resources` mirroring for simple compatibility fields.
- Added travel resource and Travel Five constants, plus `getTravelStationKeys()` / `isTravelStationKey()` helpers exposed on `game.arcflight` and `game.arcflight.devTools`.
- Normalized older ships so missing `current.supplies` falls back to existing `resources.supplies` before defaulting to 0, without removing the legacy `resources` block.
- Extended framework smoke coverage for travel resource normalization, preview immutability, update clamping, AP/RAP non-use, Travel Five membership, station skill-key normalization, non-travel station preservation, and helper exposure.
- Normalized core station Lore `primarySkills` to PF2E/statistic slug-style keys (`piloting-lore`, `sailing-lore`, `warfare-lore`) without changing station keys, display names, or gameplay meaning.
- Kept this cleanup deliberately narrow: no Travel Event runner, travel UI, GM builder, combat handoff, AP/RAP travel spending, or combat automation was added.

### PF2E Statistic Chat Roll Wiring MVP

- Wired station action Roll controls to prefer real PF2E `Statistic` objects via `actor.getStatistic`, actor skills, perception, and saves before falling back to read-only system skill metadata.
- Normalized Arcflight station roll statistic keys for standard PF2E skills, Perception, Reflex, Piloting Lore, Warfare Lore, and matching lore skill slugs.
- Updated `rollStationAction` to call `statistic.roll(args)` or `statistic.check.roll(args)` with Arcflight title/label/action/roll-option metadata and chat message creation enabled by default for sheet rolls.
- Extended roll history metadata with statistic label/source, safe `missing-statistic` and `failed` statuses, PF2E total/degree/outcome details, and roll/message IDs when PF2E provides them.
- Preserved Phase 0 boundaries: Roll still does not spend AP/RAP by default, automate outcomes/effects, mutate assigned actors, start combat rounds, fire weapons, or automate travel.

### AP/RAP Economy Foundation MVP

- Added ship-owned AP/RAP economy state under `flags.arcflight.system.actionEconomy`, tracking current/max AP and current/max RAP with hull/derived `baseAP` and `baseRAP` normalization.
- Added `getShipActionEconomy`, `resetShipActionEconomy`, `spendShipActionPoints`, and `canSpendShipActionPoints` helpers on `game.arcflight` and `game.arcflight.devTools`; spending rejects negative costs and overspending while mutating only ship actor flags.
- Updated station action previews and sheet readouts to show AP/RAP cost and affordability using existing `action.apCost` and `action.rapCost`.
- Added an Overview AP/RAP readout with a manual Reset AP/RAP button that preserves sheet tab/scroll context.
- Added optional `{ spendResources: true }` support to station action record/roll helpers for future/testing use while keeping default Record and Roll behavior non-spending.
- Extended smoke coverage for economy initialization, can-spend checks, spending, overspend blocking, reset, affordability preview, and default non-spending station action record/roll behavior.
- Kept this resource-accounting only: no initiative, combat rounds, turn tracking, weapon firing automation, station-action effects automation, travel automation, assigned-actor mutation, or PF2E roll mechanic changes were added.

### Station Action Outcome Framework MVP

- Added concise `criticalSuccess`, `success`, `failure`, and `criticalFailure` outcome text to core station action data.
- Added `getStationActionOutcome(actionKey, degreeOfSuccess)` and `previewStationActionOutcome(actionKey, rollResult)` helpers on `game.arcflight` and `game.arcflight.devTools`.
- Station-action roll history now records PF2E degree of success when available, interpreted outcome label/text, and `Unresolved` outcome data when no degree is available.
- Updated Station Action History readouts to show outcome text for roll records while preserving roll totals and existing safe metadata.
- Kept this MVP interpretive only: no AP/RAP spending, actor mutation beyond ship history, automated effects, combat automation, travel automation, or roll mechanic changes were added.

### Station Action Skill Rolls MVP

- Added data-defined roll metadata to core station actions, covering station-appropriate PF2E skills/statistics such as Diplomacy, Piloting Lore, Perception, Crafting, Occultism, and Reflex fallback options.
- Added `getStationActionRollOptions`, `previewStationActionRoll`, and `rollStationAction` helpers on `game.arcflight` and `game.arcflight.devTools`.
- Station-action roll preview resolves assigned actors from ship-owned station assignments, validates requested roll options, reports the selected statistic key, and blocks unassigned or missing assigned actors safely.
- Station-action rolling uses guarded best-effort PF2E statistic access and records `recordType: "roll"` history metadata, including assigned actor, roll option, statistic key, roll status, and total/result details when available.
- Added Roll controls and roll history readouts to the ship-sheet Station Actions tab while preserving the active tab/scroll context around the mutation.
- Kept the MVP intentionally narrow: no AP/RAP spending, assigned actor mutation, automated effects, combat rounds, weapon firing, travel automation, or action-effect automation was added.

### Station Assignment Sheet UI MVP

- Added Crew & Stations tab controls for assigning PF2E character world Actors to each ship station and clearing existing station assignments.
- Routed Assign and Clear buttons through the existing `assignStation(shipActor, stationKey, { id, uuid, name }, { assigneeType: "actor" })` and `clearStationAssignment(shipActor, stationKey)` helpers without mutating assigned actors or forcing renders after actor updates.
- Preserved the active tab and scroll position around station assign/clear mutations so Station Actions previews update through normal Foundry auto-render.
- Kept the assignment UI deliberately narrow: no skill rolling, AP/RAP spending, station-action execution, crew/faction systems, travel automation, or combat automation was added.

### Ship Sheet Tabs + Scroll UX MVP

- Added top-level Arcflight ship sheet tabs for Overview, Components, Weapons, Crew & Stations, Station Actions, Validation & History, and Developer readouts.
- Preserved the active tab in sheet instance state so install/remove/station-action refreshes return users to the same tab instead of resetting to Overview.
- Added best-effort scroll capture and restore around sheet-triggered mutating refreshes while leaving underlying ship data, install/remove behavior, station-action behavior, and source/compendium items unchanged.

### Station Action UI MVP

- Added a minimal Station Actions section to the Arcflight ship sheet, grouping registered actions by Captain, Pilot / Helm, Engineer, Gunnery, Veilwarden, Watchmaster, and Quartermaster.
- Each action now shows name, phase, AP/RAP placeholder cost, short description, preview status, and assigned-crew requirement/status.
- Wired Execute/Record buttons through `executeStationAction(shipActor, actionKey, { phase })`, with blocked/danger previews disabled before execution and sheet refresh after recording.
- Added a compact Station Action History readout with latest records plus Clear History using `clearStationActionHistory(shipActor)`.
- Extended smoke coverage for sheet station-action UI state, grouped action lists, and empty/populated history readouts.
- Kept the UI record-only: no AP/RAP spending, weapon firing, dice rolling, effect automation, combat rounds, or travel automation was added.

### Station Action Backend MVP

- Added ship-owned station-action history under `flags.arcflight.system.stationActions.history` with safe empty-array defaults for Arcflight-enabled PF2E vehicle actors.
- Added `getStationActionState`, `previewStationAction`, `executeStationAction`, and `clearStationActionHistory` helpers on `game.arcflight` and `game.arcflight.devTools`.
- Station action previews now validate Arcflight vehicle ownership, action keys, station keys, required assigned station crew, and combat/travel/both phase compatibility while returning stable preview payloads.
- Station action execution calls preview first, rejects blocked/danger previews, and appends history records with action, actor, user, station, assigned crew, cost, timing, and notes fields.
- Extended framework smoke coverage for helper exposure, valid assigned previews, unassigned/invalid blocking, history recording, history clearing, and unchanged AP/RAP values.
- Kept this backend deliberately non-automating: no station-action UI, AP/RAP spending, combat round tracker, weapon firing, travel automation, dice rolls, or action effect automation was added.

### Station Action Data Foundation

- Added a data-only core station action registry for Captain, Pilot / Helm, Engineer, Gunnery, Veilwarden, Watchmaster, and Quartermaster starter actions.
- Added station action lookup helpers (`getCoreStationAction`, `getCoreStationActionKeys`, `getCoreStationActions`, and `getCoreStationActionsForStation`) on `game.arcflight` and `game.arcflight.devTools`.
- Extended framework smoke coverage for station action key arrays, required schema fields, known station references, helper lookups, and devTools exposure.
- Kept this pass schema/helper-only at introduction; backend-only execution history was added later without AP/RAP spend, combat rounds, travel automation, weapon firing, dice rolls, effects automation, or changes to station assignment behavior.

### Weapon Install UI MVP

- Added Weapon to the ship-sheet Install Component selector, with world item filtering for Arcflight weapon equipment.
- Added a hull weapon mount selector that lists mounts by arc with clear arc / mount id / allowed-size labels and disables occupied mounts when possible.
- Routed weapon previews and installs through `previewInstallValidation(shipActor, weaponItem, { mountId, arc })` and `installWeapon(shipActor, weaponItem, { mountId, arc })` without mutating source or compendium items.
- Added an Installed Weapons sheet section grouped by arc with Remove buttons wired to `removeInstalledWeapon(shipActor, mountedWeaponId)`, refreshing the sheet after install/remove and preserving install-state lifecycle behavior.
- Extended smoke coverage for ship-sheet weapon mount option state and selected-mount weapon preview stability.
- Kept combat out of scope: no attack rolls, damage rolls, ammo tracking, reload controls, AP/RAP, targeting, combat station actions, or weapon firing controls were added.

### Weapon Install/Remove Backend

- Added ship-owned installed weapon storage under `flags.arcflight.system.installed.weapons` with mounted weapon identity, source item reference, key/name, size/family/category, arc, mount id, crew/reload/traits/damage profile, system state, and refit/tier snapshot metadata.
- Added `installWeapon(shipActor, weaponItem, { mountId, arc })` and `removeInstalledWeapon(shipActor, mountedWeaponId)` helpers exposed on `game.arcflight` and `game.arcflight.devTools`.
- Weapon installs now validate Arcflight-enabled PF2E vehicle actors, Arcflight weapon components, valid arcs, existing hull weapon mounts, mount size compatibility, mount occupancy, and weapon `compatibleArcs` before copying data to the ship.
- Successful installs mark the ship-owned hull weapon mount occupied, create a persistent install-state record with weapon arc/mount metadata, and recalculate ship stats; removals free the mount, deactivate the active install-state record with `removalReason: "removed"`, and recalculate ship stats.
- Install validation preview now supports weapon components and reports valid mounts as informational while treating invalid arcs, missing mounts, incompatible size, occupied mounts, and incompatible `compatibleArcs` as danger states.
- Extended framework smoke coverage for core weapon creation, valid installs, invalid arc/missing mount/incompatible size/occupied mount blocking, removal mount cleanup, install-state deactivation, and existing install/remove flows.
- Kept this backend-only: no weapon UI, attack rolls, damage rolls, ammo tracking, AP/RAP, reload state, targeting, station actions, combat automation, or source/compendium item mutation were added.

### Weapon Data Foundation

- Added data-only core weapon source entries with `small` / `medium` / `large` sizes, family/category fields, crew requirements, reload profiles, compatible arcs, traits, data-only damage profiles, and refit pressure metadata.
- Added weapon creation and lookup helpers (`getCoreWeapon`, `getCoreWeaponKeys`, `createCoreWeapon`, and `createWeapon`) for PF2E equipment Items flagged as Arcflight weapon components.
- Included weapons in core item sync reports and extended the framework smoke test for weapon keys, required starter fields, creation behavior, and item flags.
- Kept this pass schema/helper-only at introduction; weapon install/remove helpers were added later as backend-only lifecycle helpers without weapon UI, combat firing, attack rolls, damage rolls, ammo tracking, AP/RAP, or station actions.

### Component Removal UI MVP

- Added controlled ship-sheet Remove buttons for installed Arkengine Mods, expansion Rooms, Ship Upgrades, and Crew Assets.
- Added actor-owned removal helpers that remove installed entries or crew roster entries, deactivate matching active install-state records with `removalReason: "removed"`, preserve inactive lifecycle history, and recalculate ship stats/slots after removal.
- Kept Hull and Arkengine removal buttons out of scope because core replacement already preserves their lifecycle history.
- Extended framework smoke coverage for non-core component removal, inactive install-state increments, and derived stat/slot recalculation without adding drag/drop, modal wizards, travel/combat systems, or source/compendium mutation.

### Foundation Checkpoint Cleanup

- Added a Current Foundation Status section that summarizes the stable Framework Foundation after controlled install UI, enforcement, install-state persistence, lifecycle history, backfill tooling, and actor resolution safeguards.
- Refreshed README helper listings so documented `game.arcflight` and `game.arcflight.devTools` names include current install enforcement and backfill exports.
- Clarified smoke test expectations around install-rule enforcement, lifecycle history, dry-run backfill coverage, and actor resolution without changing runtime behavior.
- Added a Recommended Next Systems section for component removal UI, weapon framework, combat stations, and travel/voyage work while keeping this checkpoint documentation-only.

### Controlled Install Rule Enforcement

- Added `shouldBlockInstall(preview)` as the shared install-preview blocking helper and exposed it on `game.arcflight` plus `game.arcflight.devTools`.
- Escalated supported blocking conditions so danger validation, arkengine mod slot overflow, room slot overflow, active ship upgrade slot overflow, and duplicate unique crew conflicts prevent controlled installs.
- Updated existing install helpers to reject duplicate protected installs with clearer errors while preserving hull and arkengine replacement lifecycle history.
- Updated the ship sheet Install Component section to disable the Install button for blocked previews and show the specific blocked reason without adding drag/drop, remove buttons, modal flows, source item mutation, combat, or travel systems.
- Extended smoke coverage for room slot overflow blocks, mod slot overflow blocks, duplicate unique crew blocks, replacement hull behavior, replacement arkengine behavior, and `shouldBlockInstall` exposure.

### Controlled Install Component UI Polish

- Polished the Arcflight ship sheet Install Component preview with selected item identity, UUID, component type, severity badges, and a concise install allowed/blocked status line.
- Improved matching world Item selector labels to include component keys when available and added clearer empty-list hints for core item sync, PF2E equipment type, and Arcflight flags.
- Successful controlled installs now clear only the selected item, keep the selected component type, refresh the sheet, and provide clearer feedback when an existing helper skips a duplicate attempt.
- Improved spacing and responsive layout for the controlled install section while keeping all preview fields read-only and avoiding drag/drop, remove buttons, modal flows, combat/travel automation, source mutation, or duplicated install logic.

### Controlled Install Component UI MVP

- Added a compact Install Component section to the Arcflight ship sheet with component type and matching world Item selectors for Hull, Arkengine, Arkengine Mod, Room, Ship Upgrade, and Crew Asset installs.
- Wired the section to `previewInstallValidation()` for severity, message, warning, projected refit status, projected refit pressure, and slot-preview readouts.
- Install actions now route only through the existing install helpers and block only `danger` validation previews, leaving `ok`, `info`, and `warning` previews installable.
- Extended framework smoke coverage so ship sheet install UI data preparation can build safely without a selected item.
- Kept the MVP controlled and narrow: no new drag/drop behavior, modal wizard, remove buttons, combat/travel automation, compendium mutation, or duplicated install logic was added.

### Install-State Backfill Helpers

- Added dry-run-first `findShipsMissingInstallState()`, `backfillInstallStateForShip()`, and `backfillInstallStateForAllShips()` helpers with matching `game.arcflight.devTools` aliases.
- Backfill reports infer missing records from ship-owned `flags.arcflight.system.installed` data and `crew.namedCrew`, skip components already represented by install-state records, and return clear `wouldCreate`, `created`, and `skipped` results.
- Backfilled records are marked as `installCategory: "backfilled"`, inactive for native/refit/temporary flags, active for lifecycle state, and preserve available identity and refit pressure without mutating source or compendium items.
- Extended framework smoke coverage for dry-run backfill behavior on the smoke test ship while avoiding startup migrations, UI buttons, deletion, drag/drop, enforcement, or compendium mutation.

### Install Lifecycle Removal Tracking

- Added removal lifecycle fields (`removedAt`, `removedBy`, `removalReason`, and optional `replacedByInstallId`) to normalized install-state records while preserving older records safely.
- Added `getActiveInstallRecords()`, `getInactiveInstallRecords()`, `deactivateInstallRecord()`, and `deactivateInstallRecordsByComponent()` with matching `game.arcflight.devTools` aliases; `getInstalledComponents()` and `removeInstallState()` remain compatibility aliases.
- Updated `installHull` and `installArkengine` replacement flows so prior active hull/arkengine install records are marked inactive with `removalReason: "replaced"` before the new install record becomes active.
- Extended the framework smoke test to verify hull and arkengine replacement metadata, inactive history preservation, active install counts, and helper exposure without adding remove buttons, drag/drop, slot locking, cargo, combat, repair, or migration automation.

### Helper-Driven Install-State Recording

- Wired existing install helpers (`installHull`, `installArkengine`, `installArkengineMod`, `installRoom`, `installShipUpgrade`, and `addCrewAsset`) to persist one ship-owned install-state record after successful helper installs.
- Install-state records now capture item identity, component type, active lifecycle state, install time/user, tier at install, stable native/refit install category, and pressure contribution copied from component `refitPressure`.
- Duplicate helper install attempts for the same component no longer append duplicate lifecycle records; existing installed component lists remain the source of truth for Phase 0.
- Extended the framework smoke test to verify helper-created install-state records and duplicate-attempt protection while keeping this pass free of drag/drop UI, remove buttons, slot blocking, custom PF2E document types, and source/compendium item mutation.

### Install State Ship Sheet Readout

- Added a compact read-only Install State section to the Arcflight ship sheet showing persistent install summary counts, active pressure totals, component type counts, install categories, and active install record details.
- Added safe sheet display preparation for empty and malformed install state so older ships show “No persistent install records yet.” instead of crashing.
- Kept this pass UI-readout-only; no install buttons, remove buttons, drag/drop behavior, slot enforcement, helper behavior changes, combat automation, travel automation, custom PF2E document types, or source item mutation were added.

### Persistent Install-State Foundation

- Added ship-owned persistent install state under `flags.arcflight.system.installState` with `{ version: 1, installs: [] }` defaults and safe normalization for older or malformed ship data.
- Added normalized plain-data install records for item identity, component type, install timing/location/category, native/refit/temporary flags, pressure contribution, tier at install, notes, and active lifecycle state.
- Exposed `game.arcflight.getInstalledComponents()`, `getInstallState()`, `recordInstallState()`, `removeInstallState()`, `findInstallRecord()`, and `prepareInstallStateSummary()` with matching `game.arcflight.devTools` aliases.
- Added lightweight install ID generation, duplicate installId rejection for new records, inactive removal semantics for lifecycle history, and derived summaries for component counts, active/inactive installs, pressure totals, and install categories.
- Extended the framework smoke test helper with install-state initialization, record add/remove, duplicate protection, malformed state normalization, summary generation, and helper exposure coverage.
- Kept this pass foundation-only; no drag/drop UI, enforced slot locking, install buttons, UI editing, combat systems, travel systems, source/compendium item mutation, custom document subclasses, or persistence migrations beyond basic normalization were added.

### Install Validation UI Readout

- Added a read-only Tier / Refit / Validation section to the Arcflight ship sheet that displays stored tier state, refit pressure categories, major-refit flags, and a compact native/pressured/major-refit-required summary.
- Prepared sheet display data with safe fallbacks for older ships so missing tier/refit state renders as zero/No/native instead of crashing.
- Added minimal severity classes for validation readouts while keeping the pass UI-only and non-blocking; no install controls, drag/drop changes, dialogs, compendium mutation, or gameplay automation were added.

### Install Validation Preview Helpers

- Added read-only install validation preview helpers exposed as `game.arcflight.previewInstallValidation(shipActor, component)`, `game.arcflight.previewComponentInstall(shipActor, component)`, `game.arcflight.getInstallValidationWarnings(shipActor, component)`, and matching `game.arcflight.devTools` aliases; controlled install enforcement was added later via `shouldBlockInstall(preview)`.
- Preview reports now evaluate supported component type, duplicate install signals, tier fit, projected refit pressure/status, hull category tolerances, arkengine compatibility, arkengine mod slots, room slots, ship upgrade slots, and crew asset uniqueness/tier pressure without mutating ships or source items.
- Unsupported future component types such as Weapon and Cargo now return stable `unsupported` warning reports instead of throwing during preview.
- Extended the framework smoke test helper with install preview coverage for low-pressure installs, over-tier installs, major refit projections, incompatible arkengines, room slot overflow, legacy metadata, and unsupported future component types.
- Kept the initial preview patch helper-only and preview-only at introduction; later controlled install enforcement consumes danger previews to block supported invalid installs. It did not add drag/drop UI, open modal dialogs, monkey-patch item creation, mutate compendium data, or add travel/combat automation.

### Component Tier / Refit Metadata Retrofit

- Added safe component defaults and normalized helper APIs for `minimumTier`, `recommendedTier`, `tierImpact`, `refitPressure`, `refitTags`, `refitCategory`, `specialistRequirements`, and `rareMaterialRequirements`.
- Retrofitted core Arkengines, Arkengine Mods, Rooms, Ship Upgrades, and Crew Assets with data-only tier/refit metadata so installed components now contribute meaningful pressure totals.
- Exposed `game.arcflight.getComponentTierMetadata(component)` and `game.arcflight.getComponentRefitPressure(component)` for source items, installed snapshots, and legacy data shapes.
- Extended smoke validation for retrofitted categories, pressure total changes, readable tier metadata, and legacy items without metadata.
- Kept this metadata pass advisory and content/schema focused at introduction; controlled install blocking was added later. No drag/drop UI, combat automation, travel automation, weapon firing, validation dialogs, custom PF2E document types, or `Item.create` monkey-patching was added.

### Core Item Library Sync

- Added dry-run reporting and dry-run-by-default sync helpers for materializing missing core Arcflight component source entries as PF2E equipment world Items.
- Exposed `game.arcflight.findMissingCoreArcflightItems()`, `game.arcflight.syncCoreArcflightItems()`, and matching `game.arcflight.devTools` aliases.
- Kept sync conservative: existing matches are not recreated, duplicates are not deleted, actor embedded Items and compendium data are untouched, stations remain data-only, and created Items are organized through the existing Arcflight folder helper.

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
