# Travel v2 Station-Impact Behavior

## Purpose

Travel v2 station-impact behavior converts active hazard station impact previews into safe, review-only station-impact guidance for GM and player display. It makes hazard pressure understandable without applying station math, mutating station results, rolling checks, resolving response actions, or persisting data.

## What This Adds

- Station impact guidance rows derived from active hazards.
- Player-safe station impact state.
- GM station impact review state.
- App render-state integration for the Travel v2 preview consumer.
- Smoke coverage for helper behavior, redaction, clone safety, app integration, and no obvious persistent mutation calls.

## What This Does Not Add

- No station effect application.
- No station DC modifier application.
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

## Behavior Semantics

Station impacts are guidance rows, not applied modifiers. Rows are derived from active hazards only, using the existing lifecycle/player HUD station impact previews and matching station keys to current app stations where possible.

Held and dismissed hazards do not produce player station impact guidance. All station-impact rows remain review-only, unapplied, and non-persistent: modifier, DC, roll, check-result, response-action, clear-progress, and consequence application flags remain false.

## Player Safety

Player state contains only player-safe impact rows. GM review details are gated behind a GM user and `includeGmReview`; non-GM output recursively removes GM-only and internal fields such as `gmText`, `gmReview`, actor UUIDs, apply payloads, before/after snapshots, and queue internals.

## Future PRs

- Station impact application / modifier review.
- Response action execution / resolution review.
- Hazard clear/resolve lifecycle.
- Card pack import/export.
- Expanded hazard packs.
