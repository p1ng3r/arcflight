# Arcflight Codex Task Workflow

This folder contains one self-contained prompt per Codex cloud task.

## Current branch

Use:

`rebuild/arcflight-voyage-events-alpha`

This branch was created from current `main` after the V3-003 audit showed that the older planning branch was 222 commits behind.

## How to use the tasks

1. Open Codex.
2. Select repository `p1ng3r/arcflight`.
3. Select branch `rebuild/arcflight-voyage-events-alpha`.
4. Tell Codex to read `AGENTS.md` and the named task file.
5. Use Ask mode for audits and Code mode for explicit implementation tasks.
6. Review every result before accepting changes.
7. Do not ask Codex to merge, rebase, reset, push, open a pull request, or run Foundry.
8. The user performs manual Foundry validation after each accepted coding task.

## Completed

- V3-003 — branch and architecture audit.
- V3-004 — Voyage Event data contracts, constants, defaults, and documentation.

## Next

- V3-005 — validate Voyage Event packages, correct per-station action arrays, and define pure catalog registries.

## Standard completion report

Every Code task must return:

- concise summary;
- complete changed-file list;
- assumptions;
- exact manual Foundry validation steps;
- known limitations;
- anything not completed.