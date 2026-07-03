# Travel v2 Response Action Wiring

## Purpose

Travel v2 response action wiring converts active hazard response action previews into safe, session-local available response choices for GM and player display. The wiring layer is a render-state affordance only: it lets the GM review which active-hazard response actions are available and lets players see player-safe response options without executing those actions.

## What This Adds

- Response action choice rows derived from active hazard HUD/lifecycle rows.
- Player-safe response action state with available choices only.
- GM response action review state gated by GM user and explicit review options.
- App render-state integration for the Travel Event Runner v2 preview consumer.
- Smoke coverage for player safety, no-mutation guarantees, clone safety, and app integration.

## What This Does Not Add

- No response action execution.
- No check rolling.
- No station effect application.
- No hazard clear/resolve mechanics.
- No clear progress advancement.
- No consequence application.
- No Foundry document mutation.
- No settings persistence.
- No chat, journal, scene, token, combat, or socket writes.
- No arbitrary card-pack runtime consumption.
- No import UI.

## Wiring Semantics

`wired` means that a response action is available for review/display. It does not mean the action has been executed, rolled, resolved, applied, or persisted.

Choices are derived from active hazards only. Held and dismissed hazards do not produce player response action choices. Each choice remains explicitly non-persistent and reports that response action wiring does not mutate Foundry documents.

Every wired choice keeps execution and outcome flags false, including `executed`, `rollRequested`, `outcomeApplied`, `clearProgressApplied`, and `consequencesApplied`.

## Player Safety

Player-safe response action state is recursively redacted before it is returned. Non-GM output excludes GM review fields and internal mutation payload fields such as GM text, target actor identifiers, apply payloads, before/after snapshots, and queue internals.

GM review rows may include GM review information only when the user is a GM and GM review output is explicitly requested. The non-GM app state exposes only the player-safe response action state.

## Future PRs

- Response action execution / resolution review.
- Station-impact behavior.
- Hazard clear/resolve lifecycle.
- Card pack import/export.
- Expanded hazard packs.

Station impact previews can now feed Travel v2 station-impact behavior guidance. That guidance remains review-only and still does not apply modifiers, execute response actions, or persist data.
