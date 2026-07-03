# Travel v2 Active Hazard Lifecycle and Player HUD Display

## Purpose

This document describes the display-only lifecycle layer for Travel v2 active hazard candidate-control results. It displays session-local active, held, and dismissed hazard lifecycle state produced by explicit GM activate/hold/dismiss controls.

Active hazard lifecycle records are render-state objects only. They are not persisted Foundry data and they do not apply gameplay effects.

## What This Adds

- Active hazard lifecycle display rows for candidate-control results.
- Player-safe active hazard HUD state.
- GM active/held/dismissed lifecycle state.
- Display-only station impact preview.
- Display-only response action preview.
- Display-only clear condition preview.
- Smoke coverage for lifecycle display, player redaction, app render-state integration, and no obvious persistent mutation calls.

## What This Does Not Add

- No automatic activation.
- No station effect application.
- No response action execution.
- No hazard clear/resolve mechanics.
- No consequence application.
- No Foundry document mutation.
- No settings persistence.
- No chat/journal/scene/token/combat/socket writes.
- No arbitrary card-pack runtime consumption.
- No import UI.

## Display Semantics

Active hazards appear in the player HUD as player-safe rows with the hazard title, public text, public summary, station impact preview, response action preview, clear condition preview, and unresolved consequence preview. These previews describe what might matter at the table, but they are not applied effects.

Held and dismissed hazards are GM lifecycle rows by default. They help the GM understand what happened to a reviewed hazard candidate, but they do not appear as active player hazards.

All lifecycle states report that station effects are not applied, response actions are not wired, consequences are not applied, and persistent mutation is unavailable.

## Player Safety

GM review data is only included when the requesting user is a GM and `includeGmReview` is true. Player HUD output and non-GM app state recursively remove GM-only and internal fields such as `gmText`, `gmReview`, mutation payloads, actor targets, before/after records, and queue internals.

## Future PRs

- Response action wiring.
- Station-impact behavior.
- Hazard clear/resolve lifecycle.
- Card pack import/export.
- Expanded hazard packs.


## Response Action Wiring Note

Response action previews can now feed response action wiring as player-safe, session-local display choices. This remains non-executing and non-persistent: it does not roll checks, apply station effects, advance clear progress, resolve hazards, apply consequences, or mutate Foundry documents.

Station impact previews emitted by active hazard lifecycle/player HUD rows can now feed review-only station impact guidance. The guidance is display/session-local only and does not apply station effects.
