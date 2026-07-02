# Travel v2 GM Hazard Deck Picker UI

## Purpose

This adds a GM-facing review/picker UI-state surface for known built-in Travel v2 hazard decks. The picker is fed by the built-in hazard deck registry and lets a GM review which validated decks are available before later runtime selection and draw flows exist.

## What This Adds

- GM-only picker/review state.
- A built-in deck list sourced from the known hazard deck registry.
- A selected deck summary/review panel for local UI state.
- Player-safe default state that omits GM-only text and internal fields.
- Disabled/inert draw, activate, persist-selection, and import affordance flags when shown by UI consumers.
- Smoke coverage for deck rows, selected panels, GM review gating, non-GM redaction, clone safety, and mutation-call scanning.

## What This Does Not Add

- No runtime deck selection persistence.
- No arbitrary card-pack import UI.
- No automatic hazard draw.
- No automatic hazard activation.
- No automatic consequence application.
- No settings writes.
- No actor/item/world mutation.
- No socket/chat/journal/scene/token/combat writes.

## GM Review vs Player Safety

Default picker state is player-safe: deck and card rows include public titles, public text, summaries, coverage metadata, station keys, consequence refs, and tags, but they do not include `gmText` or internal mutation fields.

GM review data is only included when a GM-facing caller explicitly requests it with `includeGmReview: true` and provides a GM user/flag. In that review mode, `gmText` may appear in the selected deck review and GM card rows so the GM can inspect author notes. Non-GM callers receive hidden/disabled picker state and no GM-only text even if they request review data.

## Future PRs

- Runtime safe deck selection.
- Explicit GM draw/review flow.
- Active hazard handoff review.
- Card pack import/export.
- Expanded hazard packs.
