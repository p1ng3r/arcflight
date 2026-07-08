# Travel v2 Next-Work Audit

Date: 2026-07-08
Base reviewed: current branch at merge of PR #423 (`feature/travel-v2-event-approach-application`).

## Scope

This audit compares the current Travel v2 implementation against the requested stale/open PR set, README future-work notes, and the aggregate Travel v2 smoke runner. It is a documentation-only checkpoint and does not change runtime behavior.

Reviewed areas:

- Open PR #245: Phase 4F pressure correction plan.
- Open PR #220: Focus reaction revert/follow-up plan.
- Open PR #177: final outcome resource effects editor MVP.
- Open PR #151/#153: travel resource alignment PRs.
- README Travel Event Builder and Travel Event Runner sections.
- `scripts/dev/run-travel-v2-smoke.mjs` aggregate coverage.
- Current helpers/apps for pressure correction, focus reactions, event completion, final outcome application, builder library, and runner library selection.

## Current dev implementation snapshot

Current `dev` already has broad Travel v2 alpha-path foundations:

- Builder foundation and UI shell with draft library persistence, round editing, final outcome text editing, final outcome resource-effect editing, quality reports, import/export, and explicit no-world-mutation boundaries.
- Runner sessions with library selection, session switching/isolation, station action lock-in, pressure application/correction, round finalization, event completion, completed summaries, outcome packages, follow-ups, hazard/scar review surfaces, and explicit GM apply paths.
- Smoke coverage for the major Travel v2 helpers and app-facing adapters through one aggregate runner.
- Player-safe preview consumers that intentionally redact internal/GM-only data and keep future card/application concepts review-only unless an explicit GM apply path exists.

## Open PR disposition

| PR | Requested topic | Current disposition | Rationale |
| --- | --- | --- | --- |
| #151 | Travel resource alignment | Stale / superseded | README now lists travel resource alignment as completed framework status, including normalized live resource helpers for `hull`, `lifeveil`, `strain`, `morale`, `supplies`, and `storedSpellRanks`. Current runner/app smoke coverage also exercises resource-effect previews and applications through current helpers. |
| #153 | Travel resource alignment follow-up | Stale / superseded | Same resource-alignment concept is now part of current dev. Any remaining work should be filed as a new focused bug against current helpers rather than reviving the old PR stack. |
| #177 | Final outcome resource effects editor MVP | Stale / superseded | README now documents a local Final Outcome Resource Effects Editor MVP for adding, editing, and removing supported proposed resource effects while preserving unsupported effects read-only. Framework smoke coverage also has explicit checks for the helper exports, add/edit/remove behavior, preservation of unsupported effects, no actor/resource mutation, and JSON IO after edits. |
| #220 | Focus reaction revert / follow-up | Partially stale, still conceptually valid as a narrow audit/follow-up | Current dev no longer appears to need a broad revert: focus backlash/risk suppression, pending reaction flow labels, focus effect records, station lock-in, and preview state are covered in the aggregate smoke runner. The valid next work is not to resurrect the old PR, but to add a small current-dev audit/closeout that confirms any remaining Focus reaction semantics are GM-directed, player-safe, and documented. |
| #245 | Phase 4F pressure correction plan | Stale / superseded as implementation plan | Pressure correction exists in helper and app smoke coverage, and runner pressure apply/correct flows are present in current dev. The old Phase 4F plan should not be merged as-is. If pressure work continues, it should be a small closeout against current pressure-loop docs and current smoke gaps, not a Phase 4F implementation replay. |

## README/doc future-work gaps still visible

These are the most explicit gaps that remain after the current implementation:

1. **README is stale relative to the modern Travel v2 runner.** The README still says the runner is ship-attached, starts events from a registered core event selector, and that a GM custom event builder remains future work. Current dev has newer local runner sessions, builder draft library workflows, builder-to-runner launch paths, session library selection/status coverage, and many Travel v2 alpha features. A docs-only README refresh is needed before more gameplay work.
2. **Builder/importer card-schema gap remains.** The builder/importer compatibility audit says pressure tracks, focus/support cards, reusable consequence cards, station combo benefits, momentum cards, schema versioning, and broader v1 migration are partial or missing. Current card-schema/import-adapter work validates schema payloads, but it intentionally does not replace the builder/importer save path.
3. **Response action execution remains future work.** Response action wiring and review docs keep resolution as a future explicit GM apply path. Current coverage validates wiring/review surfaces, not full gameplay execution.
4. **Station benefit direct use remains future work.** Pending station benefit queues and player-visible review/use surfaces exist, but direct player-use/GM-confirmed application remains deliberately bounded and review-first.
5. **Consequence/resource application is intentionally narrow.** Current session outcome application and actor application bridge coverage exists, but broader reusable consequence-card application still needs a current-dev design slice before implementation.
6. **README still contains older foundation-era exclusions.** Several high-level README paragraphs still describe travel/voyage and GM tooling as future in ways that conflict with the present Travel v2 alpha implementation. This creates planning ambiguity.

## Smoke coverage summary

The aggregate Travel v2 smoke runner currently covers these important areas:

- Travel v2 state, pressure engine, round-pressure adapter, pressure application, and pressure correction.
- Round action order state/persistence/library closeout, session switching, and station action lock-in.
- Preview state, preview consumer, preview panel, player-safe redaction checks, and app-facing runner status.
- Event completion readiness/session completion/completed summary export.
- Event outcome packages, session outcome application, actor application bridge, follow-ups, and pending consequence queue adjacent flows.
- Hazards, ship scars, narration, stabilize repair, momentum, focus backlash/risk suppression, support actions/backlash, response action wiring/review, station impact modifiers, pending station benefits, card schema/import adapter, consequence catalog, and built-in hazard deck flows.

Coverage gap to prioritize: the smoke runner is now broad enough that the next work should mostly be closeout/documentation alignment and narrow current-dev hardening, not re-merging stale implementation PRs.

## Recommended next 3 PR slices

1. **Docs-only README Travel v2 refresh.** Update the README Travel Event Builder and Travel Event Runner sections to describe the current session-local builder/runner reality after PR #423, including builder library, runner session library selection, explicit GM apply boundaries, and what remains future. No runtime changes.
2. **Focus reaction current-dev closeout.** Produce a narrow docs/smoke audit of Focus reaction behavior against current helpers: pending Focus reaction prompts, accepted reroll requirements, focus backlash/risk suppression, station lock-in interactions, and player-safe redaction. Avoid gameplay changes unless a failing current smoke exposes a concrete bug.
3. **Builder/importer schema gap plan.** Add a focused plan for the next data-only bridge between Card Schema v0 and the existing builder/importer: choose one missing schema family, preferably reusable consequence cards or focus/support cards, and define validation/import-preview behavior without save-path replacement or runtime application.

## Non-goals for the next stack

- Do not revive PR #151/#153/#177/#245 wholesale.
- Do not implement response-action gameplay execution before the explicit GM apply design is refreshed.
- Do not add actor/item/chat/journal/socket/scene/token/compendium mutation.
- Do not add autopilot travel resolution.
- Do not expose GM-only/internal data in player-safe state.
