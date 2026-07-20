# Arcflight Codex Task Workflow

This folder contains one self-contained prompt per Codex cloud task.

## Current branch

Use:

`rebuild/arcflight-voyage-events-alpha`

This branch was created from current `main` after the V3-003 audit showed that the older planning branch was 222 commits behind.

## How to use the tasks

1. Open Codex.
2. Select repository `p1ng3r/arcflight`.
3. Select branch `rebuild/arcflight-voyage-events-alpha` as the starting branch.
4. Codex creates a separate temporary working branch for the task.
5. Tell Codex to read `AGENTS.md` and the named task file.
6. Use Ask mode for audits and Code mode for explicit implementation tasks.
7. Review every result before accepting changes.
8. Do not ask Codex to merge, rebase, reset, open a pull request, or run Foundry while implementing.
9. After review, create a PR from the temporary Codex branch into `rebuild/arcflight-voyage-events-alpha`.
10. The user performs manual Foundry validation when the task calls for runtime inspection.
11. For sliced work, finish review, PR, manual validation, merge, and issue closeout for one slice before starting the next slice. Do not run dependent slices in parallel.

## Completed

- V3-003 — branch and architecture audit.
- V3-004 — Voyage Event data contracts, constants, defaults, and documentation.
- V3-005 — package validation, canonical narrative references, and pure catalog registries.
- V3-006 — GM-authoritative Voyage Event flag persistence with revision protection.

## Next — V3-007 slices

Parent plan: `docs/codex/V3-007-voyage-event-lifecycle-manager.md`

Run these in order, one at a time:

1. V3-007A — pure lifecycle transition policy and error contract.
2. V3-007B — validated active-event start.
3. V3-007C — guarded pause and resume.
4. V3-007D — strict normal phase advancement.
5. V3-007E — round-boundary advancement and reset.
6. V3-007F — audited GM override and consolidated lifecycle documentation.

## Standard completion report

Every Code task must return:

- concise summary;
- complete changed-file list;
- assumptions;
- exact manual Foundry validation steps;
- known limitations;
- anything not completed.
