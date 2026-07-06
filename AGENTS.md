# Arcflight Codex Instructions

## Project
Arcflight is a Foundry VTT module for PF2E. Active development targets the `dev` branch.

PF2E vehicle actors are Arcflight ships.
PF2E equipment items are Arcflight components.
Do not introduce custom actor or item types.
Arcflight data belongs under `flags.arcflight.*`.

## Travel v2 hard boundaries
Travel v2 is GM-directed, not autopilot.

Do not silently mutate:
- actors
- items
- active effects
- journals
- chat
- sockets
- scenes
- tokens
- compendia
- world data

Persistent changes require explicit GM confirmation.

Never leak GM-only/internal data into player-safe state.

Forbidden player-safe terms include:
- auditRecord
- commitRecords
- userId
- userName
- gmText
- applyPayload
- targetActorUuid
- mutationScope
- internalMutation
- secret
- pendingConsequenceQueue
- gmOnly
- unrevealedHazard
- catalogSuggestions

## Preferred PR style
Keep PRs tied to one Travel v2 tracker item.
Slightly larger slices are okay only when they stay inside one concept.
Prefer helper-first, deterministic, session-local code.

## Required validation
Before PR:
- git diff --check
- node --check on changed JS files
- node scripts/dev/run-travel-v2-smoke.mjs

If Foundry-facing behavior changed, also run:
- node scripts/dev/run-foundry-check-runner-smoke.mjs

## Current priority
Travel v2 alpha path.
Do not rebuild existing foundations unless a focused bug requires it.
