# Travel v2 Built-In Hazard Deck Registry

## Purpose

The Travel v2 built-in hazard deck registry lists and validates known built-in hazard decks, starting with the gold-standard hazard cards in `data/travel-events/travel-v2-gold-standard-hazard-cards.js`.

This is a registry, review, and picker-state foundation only. It gives later UI and runner work a safe way to ask which built-in hazard decks exist before any runtime selection or draw behavior is added.

## What This Adds

- Built-in hazard deck registry.
- Gold-standard deck lookup by the stable id `travel-v2-gold-standard-hazards`.
- Validation and review helpers for built-in hazard decks.
- Player-safe picker and review summaries that redact GM-only/internal fields.
- Smoke coverage for registry listing, lookup, validation, picker state, clone safety, and mutation-call source scanning.
- A registry-fed GM-only picker/review UI-state helper can now consume the known deck list without adding runtime selection, draw, or activation behavior.

## What This Does Not Add

- No arbitrary card-pack runtime consumption.
- No import UI.
- No automatic hazard draw.
- No automatic hazard activation.
- No automatic consequence application.
- No settings persistence.
- No actor/item/world mutation.
- No socket/chat/journal/scene/token/combat writes.

## Deck Shape

A built-in hazard deck registry entry uses a data-only shape:

- `id`: stable built-in deck id, currently `travel-v2-gold-standard-hazards`.
- `version`: source pack version.
- `title` and `description`: review-facing deck labels.
- `source`: source module path for the built-in card data.
- `cardSchemaVersion`: schema version used by the cards.
- `cardType`: `hazard`.
- `deckKind`: `built-in`.
- `status`: availability state for later picker use.
- `cards`: cloned card data.
- `cardCount`: derived card count.
- `categories`: derived unique hazard categories.
- `severities`: derived unique severities.
- `stationKeys`: derived unique station keys from station impacts and response actions.
- `consequenceRefs`: derived unique consequence catalog references.
- `tags`: derived unique tags.
- `playerSafeSummary`: redacted deck/card summary suitable for player-safe picker state.
- `gmReviewSummary`: GM review data for explicit GM-facing review flows.

## Player Safety

Player-safe registry output removes GM-only and internal fields recursively. The forbidden fields include `gmText`, `gmSummary`, `gmMechanicalNotes`, `explicitGmApplyEffect`, `sessionLocalEffect`, `internalMutation`, actor UUID/id targets, apply payloads, before/after snapshots, and queue internals.

Default picker state uses safe deck summaries and does not include raw GM text. GM review output is opt-in through the registry helper options and is intended for future explicit GM-only review UI.

## Future PRs

- GM hazard deck picker UI-state/render foundation.
- GM hazard deck picker template interaction polish.
- Runtime safe deck selection.
- Explicit GM draw/review flow.
- Card pack import/export.
- Expanded hazard packs.
