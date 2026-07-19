# Arcflight Codex Task Workflow

This folder contains one self-contained prompt per Codex cloud task.

## How to use these tasks

1. Open Codex.
2. Select repository `p1ng3r/arcflight`.
3. Select branch `rebuild/arcflight-gameplay-v3`, unless the task file names another branch.
4. Open the next task file in this folder.
5. Copy the complete task text into Codex.
6. Use **Ask** mode for read-only audits and reviews.
7. Use **Code** mode only for tasks that explicitly request file changes.
8. Review the result before accepting any changes.
9. Do not ask Codex to merge, rebase, reset, push, open a pull request, or run Foundry unless a later task explicitly says to do so.
10. The user performs manual Foundry validation after each accepted coding task.

## Current order

1. `V3-003-branch-audit.md` — read-only audit.
2. `V3-004-complete-alpha-document.md` — repair the incomplete alpha document after the audit is reviewed.
3. Add later task files only after the preceding dependency is accepted.

## Standard completion report

Every coding task must return:

- summary of what changed;
- complete changed-file list;
- assumptions;
- exact manual Foundry validation steps;
- known limitations;
- anything not completed.
