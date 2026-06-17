# documents

Phase 1 document helpers keep Arcflight PF2E-compatible:

- Ship data helpers operate on existing PF2E `vehicle` actors through `flags.arcflight.system`.
- Component helpers operate on existing PF2E `equipment` items through `flags.arcflight.system`.
- No custom Actor or Item document subtypes are registered.
- No `Item.create` or `Item.createDocuments` monkey-patches are used.


## Ship tier and refit pressure

Ship actor helpers maintain non-blocking tier and refit state under `flags.arcflight.system.tier`, `flags.arcflight.system.refitPressure`, and `flags.arcflight.system.refitFlags`. Recalculation sums installed component `refitPressure` snapshots, compares total pressure against the installed hull tolerance, and stores warning/status data only. It does not complete refits or prevent installs.


## Install validation previews

Install validation preview helpers live outside the document mutation helpers and are warning-only. Use `previewInstallValidation(shipActor, component)`, `previewComponentInstall(shipActor, component)`, or `getInstallValidationWarnings(shipActor, component)` through `game.arcflight` or `game.arcflight.devTools` to inspect tier fit, refit pressure projection, compatibility, slots, duplicate signals, and unsupported future component types before or around an install. These helpers return reports; they do not block installs, update actors, change items, touch compendia, or patch Foundry/PF2E document creation.
