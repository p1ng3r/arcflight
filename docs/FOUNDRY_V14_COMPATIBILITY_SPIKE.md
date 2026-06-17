# Foundry V14 Compatibility Spike

## Summary verdict

Arcflight is prepared for Foundry V14 smoke testing with a narrow compatibility spike. The module remains a PF2E module that uses PF2E vehicle actors for Arcflight ships, PF2E equipment items for Arcflight components, and `flags.arcflight.system` for Arcflight-owned data. No custom document types, Travel Overlay work, gameplay automation, or data migrations were introduced.

The manifest still declares `minimum` and `verified` as Foundry `13`. This is intentional: the code has been audited and patched for V14 smoke-test readiness, but `verified` should not be raised until the manual Foundry V14 checklist below passes in a real V14 world with PF2E enabled.

## Files inspected

- `module.json`
- `scripts/arcflight.js`
- `scripts/sheets/registration.js`
- `scripts/sheets/ship-sheet.js`
- `scripts/sheets/item-sheet.js`
- `scripts/apps/travel-event-builder.js`
- `scripts/apps/travel-event-runner.js`
- `scripts/helpers/pf2e-statistics.js`
- `scripts/helpers/travel-event-runner.js`
- `scripts/documents/creation.js`
- `scripts/documents/ships.js`
- `scripts/dev/dev-tools.js`
- `scripts/dev/framework-smoke-test.js`

## Changes made

- Added a compatibility boundary at `scripts/compat/pf2e-statistics.js` and left `scripts/helpers/pf2e-statistics.js` as a stable re-export shim for existing imports.
- Kept PF2E statistic behavior unchanged: `actor.getStatistic` is tried first, followed by skills/perception/saves collections, read-only `actor.system.skills` fallback metadata, and rolling through `statistic.roll` or `statistic.check.roll` while preserving total, degree, roll id, and message id metadata when available.
- Added a small sheet registry compatibility helper in `scripts/sheets/registration.js` so optional sheet registration can discover either the Foundry document collection registry or the legacy global registry without scattering version checks.
- Exposed registered Arcflight sheet classes through `game.arcflight.ArcflightShipSheet` and `game.arcflight.ArcflightItemSheet` after optional registration completes.
- Added a non-mutating console report helper at `game.arcflight.devTools.runV14CompatibilityReport()`.

## Known risks

- Foundry V14 and PF2E V14-compatible releases must still be tested manually; this spike does not claim verified V14 support.
- ApplicationV2, DialogV2, ActorSheetV2, and ItemSheetV2 imports are still direct Foundry API usages. They are intentionally left in place because Arcflight already uses the V2 application stack, but a real V14 world must confirm the exact runtime APIs.
- Optional Arcflight sheet registration is defensive. If PF2E changes actor/item type labels or sheet registration semantics further, the compatibility helper may need another small adjustment.
- PF2E Statistic APIs remain the most fragile integration point. The new compatibility boundary localizes those assumptions for future patches.
- Existing settings and flag schemas are intentionally unchanged; no migration was attempted in this spike.

## Manual Foundry V14 smoke-test checklist

1. Enable module in Foundry V14 with PF2E.
2. Confirm `game.arcflight` exists.
3. Confirm settings register.
4. Confirm optional item and ship sheets register.
5. Create/enable a PF2E vehicle as an Arcflight ship.
6. Create core hull and arkengine equipment items.
7. Install hull and arkengine.
8. Open Arcflight ship sheet.
9. Assign station actors.
10. Open Travel Event Builder.
11. Save/load/duplicate/delete a draft.
12. Publish an event.
13. Use published event search/filter/tags/favorites.
14. Start Travel Event Runner from a published event.
15. Confirm ship-seeded station assignments.
16. Override/clear/reset station assignments.
17. Attempt a PF2E statistic roll from an assigned actor.
18. Save/load/duplicate/export/import a runner session.
19. Complete an event.
20. Review/apply/undo staged effects manually.

Additional console check:

```js
game.arcflight.devTools.runV14CompatibilityReport()
```

The report is non-mutating and checks API exposure, settings registration, V2 application/sheet API availability, core key registries, Travel Builder/Runner classes, PF2E statistic helper exports, item creation helpers, and ship helper functions.

## Recommendation on Phase V and Phase W

Phase V and Phase W can proceed after the manual Foundry V14 smoke-test checklist passes. If smoke testing finds only localized API issues, patch them in the compatibility boundary or the sheet registry helper before beginning major Travel Overlay work. Do not raise `module.json` `verified` to `14` until the checklist passes in an actual Foundry V14 + PF2E environment.
