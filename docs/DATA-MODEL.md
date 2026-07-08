# Arcflight Data Model

This is the canonical data-shape reference for Arcflight.

## Core storage rule

Arcflight uses Foundry/PF2E documents and stores Arcflight-specific data under `flags.arcflight.*`.

## Actor and item rules

- PF2E vehicle actors represent Arcflight ships.
- PF2E equipment items represent Arcflight components.
- Arcflight should not require custom actor or item types.

## Ship state

A ship actor should be understood as two layers:

1. Derived state
   - calculated from hull base data and installed components
   - includes derived stats such as defenses, capacity, movement, expansion, mounts, and compatible systems

2. Current state
   - mutable play state
   - includes current hull integrity, strain, lifeveil, morale, supplies, cargo, crew status, conditions, and damage states

## Component state

Component data should identify category, install behavior, modifiers, and compatibility rules. Source component items should not be mutated during install unless that is explicitly designed and documented.

Core component categories:

- Hull
- Arkengine
- Room
- Ship Upgrade
- Arkengine Mod
- Weapon or ship weapon system

## Travel v2 session state

Travel v2 session data should keep clear containers for:

- event identity
- current round
- station results
- pressure state
- pressure application records
- correction records
- hazard state
- round finalization records
- event completion records
- follow-up records
- GM review state
- player-safe projections

## Player-safe projections

Player-safe projections must remove GM-only/internal data and expose only safe labels, statuses, summaries, and allowed interaction state.

## GM-only records

GM-only records may contain audit and review context, but should remain out of player-facing projections.

## Mutation rule

Real actor/item/world mutation requires a documented apply path and explicit GM confirmation. Preview, review, and session-local helper flows should not silently mutate Foundry documents.

## Related docs

- `docs/ARCFLIGHT-BIBLE.md`
- `docs/TRAVEL-V2.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
