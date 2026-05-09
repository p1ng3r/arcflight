# Changelog

## Unreleased

### Fixed

- Removed legacy `name` and `type` keys from the module manifest so Foundry VTT v13 no longer reports unknown manifest keys while keeping `id` and `title` unchanged.

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
