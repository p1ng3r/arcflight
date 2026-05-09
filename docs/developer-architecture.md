# Arcflight Developer Architecture Note

Phase 1 is PF2E-compatible by design:

- PF2E `vehicle` actors are Arcflight ships when `flags.arcflight.enabled` is true and `flags.arcflight.actorType` is `arcflightShip`.
- PF2E `equipment` items are Arcflight components when `flags.arcflight.enabled` is true and `flags.arcflight.componentType` is one of the supported component types.
- Arcflight-owned data lives under `flags.arcflight.system` on those PF2E documents.

Do not add custom Actor or Item subtypes for Phase 1. Do not patch `Item.create` or `Item.createDocuments`; use `game.arcflight.createItem` to create flagged PF2E equipment components.
