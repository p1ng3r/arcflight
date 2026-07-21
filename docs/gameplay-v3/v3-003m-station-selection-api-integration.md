# Gameplay V3-003M: Voyage Station Selection API Integration

## Purpose

Expose the V3-003L station-action selection change and clear domain helpers through Arcflight's supported public API surfaces.

## Integration scope

This slice adds `scripts/voyage/station-selection-api.js` as a second Foundry ES module, loaded immediately after the main Arcflight bootstrap. Its `init` callback extends the already-built frozen API without reopening the large bootstrap module.

Both helpers are registered on:

- `game.arcflight`;
- `CONFIG.arcflight`;
- `game.arcflight.devTools`;
- named exports from `scripts/voyage/station-selection-api.js`.

The extension preserves all existing public and development helpers, freezes the replacement API objects, and returns `null` without mutation when the base API is unavailable.

Focused Node coverage verifies public exposure, dev-tools exposure, preservation of existing functions, object freezing, named exports, and the unavailable-base failure path.

## Deferred work

This integration does not add persistence, authority, sockets, UI, station locking, readiness, Risk Bids, PF2e action execution, or phase advancement.
