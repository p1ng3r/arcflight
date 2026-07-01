# Travel v2 Consequence Catalog Foundation

## Purpose

Travel v2 consequence catalog cards are premade outcome candidates that help the GM quickly review meaningful travel fallout and later choose an explicit Apply workflow. They are authored as reusable, data-only cards so failed station actions, critical failures, unresolved hazards, pressure overflow, failed Focus/Support, bad final outcomes, and manual GM calls can point to stable consequence concepts without mutating the world.

## What This Adds

- A data-only consequence card catalog with reusable foundation cards.
- Validation and normalization helpers for catalog entries and catalogs.
- A GM review summary that includes GM-facing review text and inert apply metadata.
- A player-safe summary that keeps public text clean.
- A pure pending consequence candidate builder for later queue/review flows.

## What This Does Not Add

- No automatic application.
- No actor, item, chat, journal, scene, token, combat, compendium, setting, socket, or world mutation.
- No compendium import.
- No UI card-pack importer.
- No runtime consumption of arbitrary imported packs by the Travel v2 runner.
- No player access to GM-only fields, apply payloads, internal mutation metadata, or queue internals.

## Consequence Card Shape

Required catalog fields are:

- `schemaVersion`: currently `travel-v2-card-schema-v0` for schema-aligned consequence cards.
- `type`: `consequence`.
- `id`: stable catalog identifier.
- `title`: GM/player-readable card title.
- `severity`: foundation severity such as `minor`, `major`, or `severe`.
- `source`: one or more authored source tags such as Focus backlash, unresolved hazards, pressure overflow, failed Support, final outcomes, or manual GM selection.
- `affectedTrack`: the reviewed travel track or handoff lane affected by the consequence.
- `publicText`: table-safe descriptive text.
- `playerSafeSummary`: short player-safe explanation.
- `gmText`: GM-only guidance for review.
- `applyEffectSummary`: plain-language summary of what a future explicit GM Apply may do.
- `status`: currently normalized to `candidate` when omitted by older entries.

Optional inert metadata may include `sessionLocalEffect` or `explicitGmApplyEffect`. These payloads are review hints only. They are not executed by the catalog helper and do not apply persistent effects.

## Player Safety

Player-safe catalog output is intentionally smaller than GM review output. It may include IDs, titles, severity, affected track, public text, player-safe summary, safe source labels, and a non-secret apply summary. It excludes `gmText`, `explicitGmApplyEffect`, `sessionLocalEffect`, internal mutation metadata, target actor UUIDs/IDs, before/after values, apply payload objects, and queue internals.

The validation helper fails entries that copy GM text directly into public or player-safe text, and it verifies that player-safe projections do not include known GM-only or internal fields.

## Future PRs

- Consequence queue UI/catalog selection.
- Explicit GM Apply review improvements.
- First gold-standard hazard cards.
- Card pack import/export later.
