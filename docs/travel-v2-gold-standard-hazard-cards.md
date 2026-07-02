# Travel v2 Gold-Standard Hazard Cards

## Purpose

This document describes the first 12 high-quality, data-only Travel v2 hazard cards. They are authoring examples for future hazard packs: playable at the table, schema-aligned, player-safe, and easy for a GM to review before using any consequence handoff.


The pack is now registered through the built-in hazard deck registry as `travel-v2-gold-standard-hazards` for safe review and later picker-state use. The registry does not draw, activate, import, or apply these cards at runtime.

## What This Adds

- 12 schema-aligned hazard cards in `data/travel-events/travel-v2-gold-standard-hazard-cards.js`.
- Validation, GM review, player-safe projection, and smoke coverage for the pack.
- Consequence catalog references where unresolved hazards naturally point to reviewed consequence candidates.

## What This Does Not Add

- No automatic hazard draw or activation.
- No runtime consumption of arbitrary imported packs.
- No card-pack import UI.
- No automatic consequence application.
- No actor, item, chat, journal, scene, token, combat, setting, compendium, or world mutation.
- No player access to GM-only fields.

## Card Authoring Rules

Each card should include:

- A readable public premise in `publicText`.
- GM handling notes in `gmText`.
- At least one gameplay impact field, such as `stationImpacts`, `immediateEffects`, `responseActions`, `clearCondition`, or `suppressionCondition`.
- A response or clear path through `responseActions` or `clearCondition`.
- A concise `playerSafeSummary` that does not duplicate or reveal GM text.
- Useful `unresolvedConsequenceRefs` and `escalationRefs` when a reviewed consequence catalog entry fits.
- Practical `tags` and recognized Travel v2 narration hooks.

Custom fields in this pack are plain descriptive data. They explain table use and authoring intent; they do not execute behavior.

## Player Safety

Player-safe projection removes GM-only and internal fields, including `gmText`, `gmSummary`, `gmMechanicalNotes`, `explicitGmApplyEffect`, `sessionLocalEffect`, `internalMutation`, target actor identifiers, apply payloads, before/after snapshots, and queue internals. Public text should describe visible stakes and choices, while GM text should preserve adjudication guidance and hidden handling notes.

## Future PRs

- Hazard deck selection UI.
- Runtime safe deck registration.
- Card pack import/export.
- Expanded hazard pack.
- Consequence apply review integration.
