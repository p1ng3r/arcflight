# Changelog

## Unreleased

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
