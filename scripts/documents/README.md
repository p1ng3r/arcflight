# documents

Phase 1 document helpers keep Arcflight PF2E-compatible:

- Ship data helpers operate on existing PF2E `vehicle` actors through `flags.arcflight.system`.
- Component helpers operate on existing PF2E `equipment` items through `flags.arcflight.system`.
- No custom Actor or Item document subtypes are registered.
- No `Item.create` or `Item.createDocuments` monkey-patches are used.
