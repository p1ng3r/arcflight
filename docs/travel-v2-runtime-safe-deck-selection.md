# Travel v2 Runtime Safe Deck Selection

## Purpose

This adds safe runtime/render/session-local selection state for known built-in Travel v2 hazard decks. The selected deck id is validated against the built-in hazard deck registry so a future explicit GM draw/review flow can use a known, validated deck source.

This is selection state only. Selecting a deck is not drawing a card, activating a hazard, importing a pack, applying a consequence, or writing anything to Foundry world data.

## What This Adds

- Runtime/render/session-local selected built-in deck state.
- Validation against the built-in deck registry.
- Player-safe selected deck summary.
- Optional GM-only review data when a GM caller explicitly requests it.
- Picker integration with the validated selected deck id.
- Smoke coverage for validation, player-safety, immutability, app render-state integration, and mutation-call scanning.

## What This Does Not Add

- No automatic hazard draw.
- No automatic hazard activation.
- No active hazard creation.
- No arbitrary card-pack runtime consumption.
- No import UI.
- No consequence application.
- No settings persistence.
- No actor/item/world mutation.
- No socket/chat/journal/scene/token/combat writes.

## Selection Semantics

A selection references a known built-in hazard deck id and reports whether the request is `selected`, `invalid`, or `none`. Unknown deck ids are rejected and do not become the selected deck.

The helper itself only defaults to `travel-v2-gold-standard-hazards` when the caller explicitly passes `defaultToGoldStandard: true`. The GM app render-state path uses that option so a GM preview has a safe built-in default when no local picker selection exists. Other callers that omit a deck id and do not opt into the default receive `status: "none"` with a disabled reason.

Selection is not a draw. Runtime selection state always reports `canDraw: false`, `canActivate: false`, `canApply: false`, `canImport: false`, `drawState.available: false`, and `activeHazardMutation.available: false`.

## Player Safety

Player-safe state contains only redacted deck summary data. GM review data is gated behind both `includeGmReview: true` and a GM user. Non-GM callers cannot create GM review state, and player-safe projections recursively remove GM-only and internal mutation fields such as `gmText`, `gmSummary`, `explicitGmApplyEffect`, `sessionLocalEffect`, actor ids, apply payloads, and queue internals.

## Future PRs

- Explicit GM draw/review flow.
- Active hazard handoff review.
- Card pack import/export.
- Expanded hazard packs.
