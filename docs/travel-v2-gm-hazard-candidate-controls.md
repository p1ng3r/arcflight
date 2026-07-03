# Travel v2 GM Hazard Candidate Controls

## Purpose

Travel v2 GM hazard candidate controls let a GM explicitly activate, hold, or dismiss a reviewed active-hazard handoff candidate. The result remains session-local/render-state only: it is cloned return data for review and UI rendering, not a Foundry document write and not a gameplay effect application.

## What This Adds

- explicit GM-only activate/hold/dismiss request state
- session-local active hazard result shape for activate
- held and dismissed candidate result shapes
- player-safe control summary
- optional GM-only review data
- app render-state integration
- smoke coverage

## What This Does Not Add

- no automatic activation
- no Foundry document mutation
- no actor/item/world mutation
- no settings persistence
- no chat/journal/scene/token/combat/socket writes
- no automatic station effect application
- no consequence application
- no arbitrary card-pack runtime consumption
- no import UI

## Lifecycle Semantics

`activate` produces an `activeHazard` object in returned state only. That object is marked `reviewOnly: false`, `active: true`, `persisted: false`, `lifecycleStatus: "active"`, and `activationSource: "gm-explicit"`.

`hold` produces `heldHazard` only. It is marked inactive, non-persistent, and `lifecycleStatus: "held"`.

`dismiss` produces `dismissedHazard` only. It is marked inactive, non-persistent, and `lifecycleStatus: "dismissed"`.

None of these lifecycle results mutate Foundry documents, apply station effects, create consequences, post chat, write settings, touch scenes/tokens/combat, update compendia, or send sockets.

## Player Safety

Controls are GM-only and require a valid handoff candidate plus an explicit GM control request. Non-GM callers receive blocked/player-safe state and never receive GM review text. Player-safe output recursively removes GM-only and internal fields such as `gmText`, `gmSummary`, `gmMechanicalNotes`, explicit apply payloads, mutation internals, actor targets, before/after snapshots, and queue internals.

## Future PRs

- active hazard lifecycle and player HUD display polish
- response action wiring
- station-impact behavior
- card pack import/export
- expanded hazard packs
