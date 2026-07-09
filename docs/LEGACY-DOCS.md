# Arcflight Legacy Docs Map

This file identifies older root-level docs that predate the current source-of-truth spine.

Some older files may still call themselves canonical, active, or current because they were written before the docs cleanup. Those internal status labels are superseded by the docs spine unless a later docs PR intentionally promotes that material back into the source-of-truth set.

## Current source of truth

Use these first:

1. `docs/DOCS-INDEX.md` — documentation entry point and authority order.
2. `docs/ARCFLIGHT-BIBLE.md` — canonical project design, locked rules, and system overview.
3. `docs/ROADMAP.md` — canonical development roadmap and phase order.
4. `docs/TODO.md` — canonical active task list.
5. `docs/TRAVEL-V2.md` — canonical Travel v2 design and implementation reference.
6. `docs/ARCHITECTURE.md` — canonical codebase map.
7. `docs/DATA-MODEL.md` — canonical data-shape reference.
8. `docs/TESTING.md` — canonical testing reference.
9. `docs/GLOSSARY.md` — canonical term reference.
10. `docs/DECISIONS.md` — canonical decision log.

## Legacy/supplemental root docs

The following root-level docs are useful reference material, but they are not the active roadmap or active TODO list unless their contents have been promoted into the source-of-truth docs above:

- `docs/ARCFLIGHT_ALPHA_PILLAR_ROADMAP.md`
  - Legacy alpha sequencing detail.
  - Current roadmap authority is `docs/ROADMAP.md`.

- `docs/TRAVEL_V2_ALPHA_GOAL.md`
  - Legacy detailed Travel v2 alpha target.
  - Current Travel v2 authority is `docs/TRAVEL-V2.md`.
  - Active task ownership belongs in `docs/TODO.md`.

- `docs/TRAVEL_V2_ALPHA_TODO.md`
  - Legacy detailed Travel v2 implementation checklist.
  - Current active task ownership belongs in `docs/TODO.md`.

- `docs/TRAVEL_V2_OPEN_ISSUES.md`
  - Legacy/supplemental numbered Travel v2 tracker.
  - Current active task ownership belongs in `docs/TODO.md` and GitHub issues/PRs.

- `docs/TRAVEL_EVENT_TEMPLATE.md`
  - Supplemental authoring template reference.
  - Current Travel v2 authority is `docs/TRAVEL-V2.md` unless the template is intentionally promoted.

## Promotion rule

If a legacy doc contains a rule, roadmap item, TODO, or design target that should still be active, move or summarize that material into the correct source-of-truth doc instead of leaving it only in the legacy file.

- Permanent system rule: `docs/ARCFLIGHT-BIBLE.md`
- Phase or sequencing rule: `docs/ROADMAP.md`
- Active task: `docs/TODO.md`
- Travel v2 design rule: `docs/TRAVEL-V2.md`
- Code placement rule: `docs/ARCHITECTURE.md`
- Data-shape rule: `docs/DATA-MODEL.md`
- Test command/rule: `docs/TESTING.md`
- Terminology: `docs/GLOSSARY.md`
- Locked decision: `docs/DECISIONS.md`

## Archive/delete rule

Do not delete legacy docs in the same PR that first labels them. Review them first, promote any still-active material into the docs spine, then archive or delete in a later cleanup PR.
