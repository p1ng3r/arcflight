# Travel v2 Station Impact Application / Modifier Review

## Purpose

This layer converts Travel v2 station-impact guidance into safe, session-local station-impact modifier review candidates. It gives the GM/table a structured proposal describing the affected station, the player-safe impact summary, and any modifier or DC note that was already present in the guidance.

The review package is display/review-only. It does not apply station modifiers, change station DCs, roll checks, update check results, persist data, or mutate Foundry documents.

## What This Adds

- Proposed station modifier review rows.
- Player-safe station impact modifier review state.
- GM station impact modifier review state.
- Optional linking to response action resolution review context.
- App render-state integration.
- Smoke coverage.

## What This Does Not Add

- No station modifier application.
- No station DC application.
- No station state mutation.
- No check result mutation.
- No check rolling.
- No response action execution.
- No hazard clear/resolve mechanics.
- No clear progress advancement.
- No consequence application.
- No Foundry document mutation.
- No settings persistence.
- No chat/journal/scene/token/combat/socket writes.
- No arbitrary card-pack runtime consumption.
- No import UI.

## Review Semantics

A proposed modifier is a review candidate, not an applied effect. The helper reads existing station-impact guidance rows and produces modifier review rows marked `reviewOnly`, `modifierReviewCandidate`, `applyAvailable: false`, and with all application/mutation flags false.

Numeric modifiers are normalized only when the source guidance already includes an explicit numeric field such as `dcDelta`, `modifier`, `modifierDelta`, `penalty`, or `bonus`. The helper does not invent a number from text. If no numeric modifier exists, `proposedModifier.dcDelta` remains `null` and the public text/summary/note remains review guidance.

A `ready` row means the proposal is ready for GM/table review. It does not mean the modifier is safe to auto-apply. All rows remain non-persistent render-state data. Actual station check modifier application is future work.

## Player Safety

Player-facing state is recursively redacted to remove GM-only/internal fields such as `gmText`, `gmSummary`, `gmMechanicalNotes`, `gmReview`, apply payloads, internal mutation records, target actor identifiers, and queue internals.

GM review details are included only when the current user is GM-like and `includeGmReview` is explicitly enabled. Non-GM app state receives only the player-safe station impact modifier player state.

## Future PRs

- Station impact explicit GM apply / check modifier application.
- Response action execution application / explicit GM apply.
- Hazard clear/resolve lifecycle.
- Card pack import/export.
- Expanded hazard packs.
