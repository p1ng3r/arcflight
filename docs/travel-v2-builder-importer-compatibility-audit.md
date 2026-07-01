# Travel v2 Builder / Importer Compatibility Audit

## Purpose

This audit maps the existing Travel Event Builder and import/export path to the current Travel v2 runner and to the longer-term roadmap in `docs/TRAVEL_V2_ENCOUNTER_ROADMAP.md`. The goal is alignment, not replacement: the current builder/importer must keep its v1-era behavior while identifying which Travel v2 content-card and validation targets still need dedicated schema work.

## Existing Builder / Importer Inventory

- `scripts/apps/travel-event-builder.js` — Foundry application shell for creating, editing, validating, importing, exporting, previewing, and publishing Travel Event drafts.
- `templates/apps/travel-event-builder.hbs` — Handlebars template for the builder UI, including metadata, round, station prompt, final outcome, import, export, and publish controls.
- `styles/arcflight.css` — `.arcflight-travel-builder*` styles for the builder UI.
- `scripts/helpers/travel-event-builder.js` — draft normalization, draft templates, quality reports, publish-to-library helpers, sample seed helpers, builder library persistence, and legacy-to-canonical final outcome compatibility.
- `scripts/helpers/travel-event-builder-io.js` — JSON parse/import/export helpers for drafts and published event packs, data-only checks, duplicate import preview, and published library save helpers.
- `scripts/helpers/travel-event-template.js` — blank event, round, station prompt, station card, and outcome template factories consumed by the builder normalizer.
- `scripts/helpers/travel-events.js` — canonical Travel Event validation and summary helpers, including strict authoring checks for Travel Five station prompts, station cards, result feedback, proposed effects, and AP/RAP safety language.
- `scripts/apps/travel-event-runner.js` — existing runner consumer for published/core Travel Event definitions and Travel v2 session state.
- `scripts/helpers/travel-v2-runner-bridge.js` — bridge helpers that derive Travel v2 preview/session data from existing travel event structures.
- `data/travel-events/core-travel-events.js` — large built-in event library with structured station prompts/cards and legacy-compatible content.
- `data/travel-events/sample-travel-v2-events.js` — gold-style Travel v2 sample event used by smoke coverage to exercise builder-to-runner publishing.
- `data/travel-events/travel-v2-hazard-deck.js` — current hazard deck foundation; data-only, not a permanent imported card schema.
- `data/travel-events/travel-v2-consequence-catalog.js` — current consequence catalog foundation with explicit GM-apply metadata.
- `data/travel-events/travel-v2-ship-scars-deck.js` — current ship scar candidate deck foundation.
- `scripts/dev/run-travel-v2-sample-event-smoke.mjs` — smoke test proving the Travel v2 sample can validate, seed into the builder draft library, and publish through the existing builder path.
- `scripts/dev/run-travel-v2-smoke.mjs` — umbrella Travel v2 smoke runner.
- `scripts/arcflight.js` — exposes builder, importer, validation, runner, and Travel v2 dev helpers under `CONFIG.arcflight`/`CONFIG.arcflight.dev`.

## Current Travel v2 Runner Requirements

The current runner can consume the existing Travel Event definition shape when events are data-only and validate through the current helper path. Relevant fields/concepts are:

- Event id/title: `key`, `name`, runner/session `key`, display title/name.
- Opening vignette: event-level `openingVignette`, round-level `openingVignette`, and round transition narration.
- Round count: `roundCount` plus a matching `rounds` array.
- Stations: `travelStations` and each round's `activeStations`, using the Travel Five keys `captain`, `navigator`, `engineer`, `veilwarden`, and `watchmaster`.
- Station actions/approaches: round `stationCards[]`, `stationKey`, `problem`, `skillApproaches[]`, `skill`, `statistic` if present, `dc` if present, `label`, `helpText`, and result feedback maps.
- Skill/stat/DC data: builder accepts skill approach labels/skills and can carry DC/statistic fields as data, while current validation only requires non-empty skill/label/help text.
- Public player text: `openingVignette`, station `problem`, approach `label`/`helpText`, board/result feedback, visible round/final outcome vignettes, and visible follow-up candidates.
- GM-only notes: `gmSummary`, `gmOnlyConsequence`, GM narration feedback, final outcome GM review candidates, and explicit GM-apply metadata.
- Pressure: current Travel v2 pressure state/engine is runner-session oriented; imported event definitions can carry pressure-like data, but there is not yet a permanent builder-import card schema for tracks.
- Hazards: the hazard deck foundation exists separately from event import. Events may reference hazards as data, but hazard card import is not permanent yet.
- Focus/support fields: current runner session supports focus/support records and safety handling; the builder does not yet author first-class focus/support cards.
- Consequences: final outcomes and round branches can carry data-only `proposedEffects` and current catalogs can supply reviewed consequence candidates, but imported consequence cards are not permanent yet.
- Final outcomes: canonical `criticalSuccess`, `success`, `mixed`, `failure`, and `criticalFailure`, with legacy outcome key compatibility in builder normalization.
- Completed summary/final aftermath data: current Travel v2 completion/export helpers summarize completed session outcomes; builder/importer definitions can provide source final outcome text and candidates, not full completed-session history.

## Builder to Runner Compatibility Matrix

| Builder / importer field or concept | Current Travel v2 runner field or concept | Roadmap target | Status | Notes / risk |
| --- | --- | --- | --- | --- |
| Event metadata | `key`, `name`, `category`, `tags`, builder metadata | Encounter template metadata | supported | Builder normalizes and importer validates data-only JSON. |
| Opening vignette | `openingVignette`, round `openingVignette` | Narration/vignette hooks | partial | Text works now; typed narration hook schema is future. |
| Round count | `roundCount`, `rounds.length` | Encounter template pacing | supported | Validation checks positive count and matching rounds. |
| Travel Five stations | `travelStations`, round `activeStations` | Station-based encounter play | supported | Canonical station keys are enforced. |
| Station action cards | round `stationCards[]` | Permanent station action cards | partial | Current station cards are embedded event data, not reusable imported cards. |
| Station approaches | `skillApproaches[]` | Action/approach choices | supported | Current structured cards support skill/label/help text. |
| DC / skill / statistic | `skill`, optional carried `dc`/`statistic` data | Check profile schema | partial | Validation requires skill text; DC/statistic are not yet permanent schema requirements. |
| Success/failure text | `rollFeedback`, `boardResultFeedback`, `gmNarrationFeedback`, outcome branches | Result/consequence narration | supported | Strict authoring can require feedback maps. |
| GM-only notes | `gmSummary`, `gmOnlyConsequence`, GM narration/candidates | GM notes and review-only effects | supported | Must stay redacted from player views. |
| Player-safe text | station problem/help text, public vignettes, visible candidates | Player-facing card text | supported | Existing Player2 checks remain required. |
| Pressure tracks | Travel v2 session pressure state; event `activeResources` | Pressure card/track schema | partial | Runner pressure exists; imported/builder pressure track schema is not final. |
| Hazard deck / active hazards | `travel-v2-hazard-deck.js`, session hazard helpers | hazard cards | partial | Foundation exists outside builder/importer card schema. |
| Hazard response actions | current hazard helper/runner responses | hazard response cards | missing | Builder does not author reusable hazard response actions yet. |
| Consequence candidates | final outcome candidates, consequence catalog | consequence cards | partial | Catalog exists; imported reusable consequence cards remain future. |
| Final outcomes | `finalOutcomes` canonical/legacy-compatible keys | Encounter aftermath package | supported | Current runner/completion can review package-level outcomes separately from ship resources. |
| Visible stakes | public event/round text, visible candidates | visible stakes card | missing | No first-class visible stakes card schema yet. |
| Risk bids | none first-class | risk-bid options | missing | Do not add gameplay in this PR. |
| Station combo benefits | none first-class | station combo benefit cards | missing | Needs future card schema. |
| Momentum spends/awards | Travel v2 momentum foundation/session records | Momentum identity and cards | partial | Runner has foundation; builder/importer has no card authoring schema. |
| Narration hooks | vignettes, round end narration, optional card hooks object | narration hooks | partial | Data-only hooks are allowed, but hook vocabulary/versioning is not stable. |
| Import validation | parse/import/validate helpers | validation/dev tools | supported | Existing helpers validate data-only JSON and report errors/warnings. |
| Export format | draft export, final export, published event/pack export | import/export tools | supported | Current export version exists for published event packs. |
| Versioning / schema version | builder/library/export versions | schema version | partial | Builder/export versions exist; permanent Travel v2 card schema version is missing. |
| Migration from old/v1 data | legacy final outcome key mapping, draft normalization | migration tooling | partial | Existing normalization protects old outcome keys; broader v1 card migration is not complete. |
| Player-safety sanitization | player-safe runner/mission board states and smoke checks | non-GM redaction | supported | Must remain locked by Player2/non-GM safety checks. |

## What Existing Builder Can Safely Do Now

The existing builder/importer can safely create and import data-only Travel Event drafts or published event JSON that include metadata, category/tags, round count, active resources, Travel Five station lists, round vignettes, active station prompts, embedded station cards, approach text, roll feedback, round outcome branches, and final outcome packages. The publish path can normalize legacy final outcome keys to canonical Travel v2 final outcomes, validate strict authoring, preview duplicate imports, and export/import published event packs without mutating actors, items, scenes, tokens, combats, journals, chat, compendia, or ship resources during parse/validation/preview.

## Compatibility Gaps

- Permanent card schema for Travel v2 content: introduced by #336 as the data-only Travel v2 Card Schema v0 contract; builder/importer adaptation remains future #337.
- Hazard cards that can be authored/imported independently of the current foundation deck.
- Consequence cards that connect catalog entries, review text, and explicit GM Apply metadata.
- Station action cards that are reusable instead of embedded per event.
- Risk bids.
- Station combo benefit cards.
- Visible stakes card.
- Narration/vignette hooks with stable names and versioning.
- Schema versioning for each Travel v2 card/content family.
- Validation tooling that targets permanent card schemas, not only whole-event definitions.
- Import/export tooling for card packs and encounter templates.
- Gold-standard sample encounter that exercises the permanent schemas after they exist.

## Safety Requirements

- GM-only notes must not leak to player-facing views, exports intended for players, Player2 checks, or mission-board state.
- Player-facing text must remain clean, public, and free of GM-only consequence instructions.
- Importing, validating, previewing, and smoke testing must not mutate actors, items, chat, journals, combats, sockets, scenes, tokens, compendia, settings, or world data.
- Persistent effects remain explicit GM Apply only.
- Package-level outcome application and ship-resource application must remain separate.
- Existing Player2/non-GM safety checks remain required for any runtime-facing work.

## Recommended Next PRs

1. #336 Permanent Travel v2 Card Schema v0 (introduced as a data-only schema contract, validator skeleton, fixture pack, and smoke coverage).
2. #337 Builder/Importer v2 Validate Adapter.
3. #338 Applyable Consequence Catalog Foundation.
4. #339 First 12 Gold-Standard Hazard Cards.
5. #340 Station Action / Risk Bid / Combo Benefit Cards.
6. #341 Visible Stakes Card.
7. #342 Momentum Identity Polish.
8. #343 Gold-Standard Travel v2 Encounter Sample.
9. #344 Travel v2 Content + Runner Release Lock.
