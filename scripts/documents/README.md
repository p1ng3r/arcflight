# documents

Phase 1 document helpers keep Arcflight PF2E-compatible:

- Ship data helpers operate on existing PF2E `vehicle` actors through `flags.arcflight.system`.
- Component helpers operate on existing PF2E `equipment` items through `flags.arcflight.system`.
- No custom Actor or Item document subtypes are registered.
- No `Item.create` or `Item.createDocuments` monkey-patches are used.


## Ship tier and refit pressure

Ship actor helpers maintain non-blocking tier and refit state under `flags.arcflight.system.tier`, `flags.arcflight.system.refitPressure`, and `flags.arcflight.system.refitFlags`. Recalculation sums installed component `refitPressure` snapshots, compares total pressure against the installed hull tolerance, and stores warning/status data only. It does not complete refits or prevent installs.
