# Gameplay V3-003M: Voyage Station Selection API Integration

## Purpose

Expose the V3-003L station-action selection change and clear domain helpers through Arcflight's supported public API surfaces.

## Integration scope

This slice registers both helpers on:

- `game.arcflight`;
- `game.arcflight.devTools`;
- named exports from `scripts/arcflight.js`.

It also adds focused exposure coverage so the runtime API, development aliases, and ES module exports remain synchronized.

## Deferred work

This integration does not add persistence, authority, sockets, UI, station locking, readiness, Risk Bids, PF2e action execution, or phase advancement.
