# Travel v2 Response Action Execution / Resolution Review

## Purpose

This layer converts an explicitly selected, already-wired Travel v2 response action into a safe, session-local resolution review candidate. The candidate describes what would be reviewed for resolution, which hazard/action was selected, and what player-safe station/check context may be relevant.

Selection is not execution. The helper and app integration only prepare render-state review data and clone-safe summaries.

## What This Adds

- Explicit selected response action review candidates.
- Player-safe selected response action review state.
- GM response action resolution review state.
- Related station-impact guidance linking where available.
- App render-state integration.
- Smoke coverage for review semantics, redaction, inert flags, clone-safety, and no obvious mutation calls.

## What This Does Not Add

- No response action execution.
- No check rolling.
- No outcome application.
- No station effect application.
- No station DC modifier application.
- No check result mutation.
- No hazard clear/resolve mechanics.
- No clear progress advancement.
- No consequence application.
- No Foundry document mutation.
- No settings persistence.
- No chat/journal/scene/token/combat/socket writes.
- No arbitrary card-pack runtime consumption.
- No import UI.

## Review Semantics

A selected response action is chosen for review, not executed. A `ready` review candidate means the selected action is present in the available wired action rows and can be reviewed by the GM/table; it does not mean the action is safe to auto-apply.

All response action resolution review rows and candidates remain non-persistent render state. They keep execution/application flags false, including check rolling, outcome application, station modifier application, station result mutation, hazard resolution, clear progress, and consequence application.

Actual execution/resolution is future work and should require an explicit GM apply path in a later PR.

## Player Safety

Player state is derived only from player-safe available response actions and player-safe station-impact guidance. GM review details are gated to GM callers that explicitly request GM review data. Player-safe output recursively removes GM-only and internal fields such as `gmText`, `gmReview`, `applyPayload`, target actor identifiers, before/after snapshots, and queue internals.

## Future PRs

- Response action execution application / explicit GM apply.
- Station impact application / modifier review.
- Hazard clear/resolve lifecycle.
- Card pack import/export.
- Expanded hazard packs.
