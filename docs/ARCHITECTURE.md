# Arcflight Architecture

This is the canonical codebase map for Arcflight. It explains where things live and how to decide where new work belongs.

## Repository map

- `scripts/` — runtime JavaScript, apps, helpers, registration, and dev scripts.
- `scripts/apps/` — Foundry application classes and app-level UI behavior.
- `scripts/helpers/` — reusable logic, state builders, normalizers, clone-safe helpers, and smoke-tested pure functions.
- `scripts/dev/` — developer-only scripts and aggregate smoke runners.
- `templates/` — Handlebars templates for Foundry UI.
- `styles/` — module CSS.
- `data/` — static data, sample content, and content definitions.
- `docs/` — project documentation.
- `docs/codex/` — historical Codex prompts and notes unless promoted into source-of-truth docs.
- `docs/codex-tasks/` — historical task prompts and implementation notes unless promoted into source-of-truth docs.
- `docs/agents/` — process agents/guidance for review discipline.

## App vs helper rule

Apps should handle Foundry UI integration and user interaction. Helpers should handle state derivation, normalization, cloning, validation, and pure transformations.

If logic can be tested without Foundry UI, prefer a helper.

## Public API rule

Only stable, intentionally supported surfaces should be exported broadly through module registration. Temporary debug helpers, one-off smoke helpers, and internal normalization utilities should not become public API by accident.

## Travel v2 architecture rule

Travel v2 should keep a clear separation between:

- event data
- runner session state
- read-only preview state
- GM-only review state
- player-safe projected state
- explicit application records
- real actor/item/world mutation bridges

## Docs architecture rule

The docs spine is authoritative:

- `docs/DOCS-INDEX.md`
- `docs/ARCFLIGHT-BIBLE.md`
- `docs/ROADMAP.md`
- `docs/TODO.md`
- `docs/TRAVEL-V2.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA-MODEL.md`
- `docs/TESTING.md`
- `docs/GLOSSARY.md`
- `docs/DECISIONS.md`

Historical folders may support the docs spine, but they should not replace it.
