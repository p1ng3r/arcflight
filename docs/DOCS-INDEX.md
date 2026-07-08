# Arcflight Docs Index

This file is the entry point for Arcflight documentation.

Arcflight has accumulated historical plans, Codex prompts, task notes, and roadmap fragments. Those documents are useful as reference material, but they are not all equally authoritative. When documents conflict, use the source-of-truth order below.

## Source-of-truth order

1. `docs/ARCFLIGHT-BIBLE.md` — canonical project design, locked rules, and system overview.
2. `docs/ROADMAP.md` — canonical development roadmap and phase order.
3. `docs/TODO.md` — canonical active task list.
4. `docs/TRAVEL-V2.md` — canonical Travel v2 design and implementation reference.
5. `docs/ARCHITECTURE.md` — canonical codebase map.
6. `docs/DATA-MODEL.md` — canonical data-shape reference.
7. `docs/TESTING.md` — canonical testing reference.
8. `docs/GLOSSARY.md` — canonical term reference.
9. `docs/DECISIONS.md` — canonical decision log.

## Historical, legacy, and support documents

The following folders and files may contain useful historical context, but they are not the active roadmap unless explicitly referenced by the source-of-truth docs above:

- `docs/LEGACY-DOCS.md`
- `docs/codex/`
- `docs/codex-tasks/`
- `docs/agents/`
- `docs/travel-v2/`
- old phase plans
- old PR prompts
- old closeout notes
- superseded implementation plans

Historical and legacy documents should not override current source-of-truth docs.

## Rules for future docs

- Do not create a second roadmap.
- Do not create a second TODO list.
- Do not scatter active future work across old notes.
- Move active work into `docs/TODO.md`.
- Move phase sequencing into `docs/ROADMAP.md`.
- Move permanent system rules into `docs/ARCFLIGHT-BIBLE.md`.
- Move obsolete or superseded material into `docs/archive/` or clearly mark it as historical.
- Do not change code in a docs-only cleanup PR.

## Current cleanup goal

The current docs cleanup goal is to maintain one clear documentation spine:

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
- `docs/archive/README.md`

After that spine exists, stale documents can be reviewed and either linked, updated, marked superseded, or archived.
