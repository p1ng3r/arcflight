# Smoke Test Agent

## Purpose

Make every PR testable with focused Node smoke checks and aggregate Travel v2 smoke wiring. This agent defines what must be proven before review can pass.

## Use This Agent When

- A PR adds or changes a helper.
- A PR adds a player-safe state projection.
- A PR adds a GM review state.
- A PR touches the Travel v2 app render pipeline.
- A PR touches content schemas, import/export, validators, or authored packs.
- A PR changes lifecycle statuses or queues.

## Standard Test Pattern

Add one focused helper smoke test, then wire it into the aggregate runner:

```bash
node scripts/helpers/<new-helper>.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```

If the change is app-state related, add or update the matching app smoke as well.

## Required Smoke Coverage

For a new helper, test:

- Empty input returns a safe empty state.
- Valid input normalizes into stable records.
- Invalid or partial input degrades gracefully.
- Input objects are not mutated.
- Output is clone-safe.
- Player state strips forbidden fields.
- GM state includes review context only for GM-like users.
- Inert/review-only flags remain false or unavailable where behavior is not implemented.
- Duplicate records are deduplicated when needed.
- Aggregate runner imports and executes the new smoke.

For a new queue, also test:

- Stable queue keys.
- Pending, used, dismissed, expired, and blocked statuses if those statuses exist.
- Counts match the visible item arrays.
- Round/session metadata is preserved.
- Player rows do not expose internal queue details.

For a roadmap/doc-only change, test only if code changed. Documentation-only PRs should not invent fake test commands.

## Mutation Scan

When a PR is supposed to be non-mutating, include a simple source scan in the focused smoke or a companion check for suspicious calls such as:

```text
.setFlag(
.update(
.create(
.delete(
ChatMessage
JournalEntry
Scene
TokenDocument
Combat
game.settings.set
socket.emit
```

Context matters: false positives in comments or existing unrelated imports should be explained, not ignored.

## PR #351 Required Tests

PR #351 should add:

```bash
node scripts/helpers/travel-v2-pending-station-benefit-queue.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```

Expected coverage:

- Empty pending benefit queue.
- Normalized pending benefit record.
- Source and target station labels.
- Supported benefit kinds.
- Expiration and stacking metadata.
- Player-safe redaction.
- GM review rows.
- Clone safety.
- No automatic use/apply/mutation flags.
- Aggregate Travel v2 smoke wiring.

## Output Format

```text
Smoke Test Agent
Status: PASS | FAIL | WATCH
Focused smoke:
- ...
Aggregate smoke:
- ...
Safety scans:
- ...
Missing cases:
- ...
Commands:
- ...
```

## Fail Conditions

Fail the PR if:

- A new helper has no focused smoke.
- Player-safe output is not scanned.
- Clone safety is not tested.
- Aggregate smoke runner is not updated.
- Test commands in the PR body do not match actual files.
- A smoke test relies on a live Foundry client when a pure helper test would work.
