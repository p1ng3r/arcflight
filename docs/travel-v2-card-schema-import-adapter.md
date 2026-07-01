# Travel v2 Card Schema Import Adapter

## Purpose

The Travel v2 Card Schema Import Adapter is a validation bridge between the existing Travel Event Builder/importer path and the permanent data-only Travel v2 Card Schema v0 contract. It lets developer tooling recognize card-schema payloads without replacing the v1-compatible builder/importer behavior.

## What It Does

- Detects Travel v2 Card Schema v0 packs.
- Validates packs with the pure v0 card schema validator.
- Produces a read-only preview for developer review.
- Reports validation errors, warnings, type counts, card ids, duplicate ids, and card counts.
- Does not import, save, publish, or runtime-consume cards yet.

## What It Does Not Do

- Does not replace the old Travel Event Builder or existing importer.
- Does not import cards into compendia.
- Does not add a UI card-pack import button.
- Does not change Travel v2 gameplay.
- Does not mutate Foundry documents or world data.
- Does not send raw GM-only card data to player UI.

## Supported Payloads

The adapter supports these validation-only payload shapes:

- An object pack with `schemaVersion: "travel-v2-card-schema-v0"` and a `cards` array.
- An array where every card has `schemaVersion: "travel-v2-card-schema-v0"`.
- Unknown payloads fail safely with `detected: false`, `ok: false`, and an explanatory error.

## Safety Model

This helper is validation-only. It does not create or update actors, items, chat messages, journals, settings, sockets, scenes, tokens, compendia, worlds, runtime sessions, or saved imports.

The preview keeps player-safe text separate from `gmText`. It never copies `gmText` into `playerSafeSummary`, and any future import/save path should remain a separate PR after the validation adapter is stable.

## Console Usage

When Arcflight dev helpers are available, a GM/dev can validate a pasted or loaded pack from the browser console:

```js
const pack = /* paste or load card schema pack */;
const preview = CONFIG.arcflight.dev.prepareTravelV2CardSchemaImportPreview(pack);
preview;
```

Expected fixture results are `ok: true`, `detected: true`, `cardCount: 6`, and one card for each v0 type.

## Next PRs

- #338 Applyable Consequence Catalog Foundation or card-pack content foundation, depending on roadmap choice.
- #339 First 12 Gold-Standard Hazard Cards.
- Later: UI import/export for card packs only after this validation adapter is stable.
