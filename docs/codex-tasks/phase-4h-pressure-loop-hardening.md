# Codex Task: Phase 4H — Travel v2 pressure loop hardening

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-4h-pressure-loop-hardening`

## Goal

Harden the completed Travel v2 pressure loop before Phase 5.

Phase 4 now supports:

```text
Preview → Apply → Correct
```

This pass should improve regression coverage, edge-case handling, and documentation for that loop. It should not add new gameplay features.

## Current foundation

Preview state:

- `scripts/helpers/travel-v2-preview-state.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `templates/apps/travel-event-runner.hbs`

Application state and helper:

- `scripts/helpers/travel-v2-pressure-application-state.js`
- `scripts/helpers/travel-v2-session-pressure-application.js`
- `scripts/apps/travel-event-runner.js`

Correction helper and UI path:

- `scripts/helpers/travel-v2-pressure-correction.js`
- `scripts/apps/travel-event-runner.js`
- `scripts/apps/travel-event-runner-v2-pressure-correction.smoke.js`

Existing smoke runners:

- `scripts/dev/run-travel-event-runner-v2-preview-template-smoke.mjs`
- `scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs`
- `scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs`
- `scripts/dev/run-travel-v2-pressure-correction-smoke.mjs`
- `scripts/dev/run-travel-v2-smoke.mjs`

## Scope

This is a hardening/regression pass only.

Do:

- strengthen smoke tests.
- add small safe guard fixes if tests expose missing edge handling.
- add a concise documentation note describing the Phase 4 pressure loop.
- make feedback/button state more consistent if needed.

Do not:

- add new gameplay features.
- add Phase 5 round finalization.
- add event completion.
- add fortune/scar handoff.
- add player-facing correction.
- mutate actors/items.
- emit sockets.
- send chat.

## Required docs

Add:

- `docs/travel-v2/phase-4-pressure-loop.md`

The doc should summarize:

- preview rows.
- apply action.
- correction action.
- duplicate guards.
- application records.
- correction records.
- GM-only/session-local boundary.
- what remains out of scope until Phase 5.

Keep the doc concise and factual.

## Regression focus areas

Strengthen coverage for these cases:

1. Preview rows render before any application.
2. Apply controls are enabled only when an outcome can be applied.
3. After an application, apply controls are disabled.
4. After an application, correction controls appear only for other valid outcomes.
5. Effective applied outcome is clearly marked and cannot be corrected to itself.
6. Missing corrected outcome blocks.
7. Invalid corrected outcome blocks.
8. Same/effective corrected outcome blocks.
9. Correction success updates only local runner session.
10. Correction success appends a correction record and keeps original application record history.
11. Correction feedback takes priority over older application feedback.
12. Blocked correction feedback renders cleanly.
13. Completed sessions block both apply and correction.
14. Preview-panel state preparation does not execute application or correction helpers as side effects.
15. No actor/socket/chat/player-card side effects occur in apply/correct helper paths.
16. Aggregate `run-travel-v2-smoke.mjs` includes all Phase 4 pressure-loop smoke coverage.

## Suggested smoke changes

You may update existing smoke files instead of adding new ones, but keep the coverage clear.

Likely files:

- `scripts/apps/travel-event-runner-v2-preview-panel.smoke.js`
- `scripts/apps/travel-event-runner-v2-preview-template.smoke.js`
- `scripts/apps/travel-event-runner-v2-pressure-correction.smoke.js`
- `scripts/apps/travel-event-runner-v2-pressure-application.smoke.js`
- `scripts/helpers/travel-v2-pressure-correction.smoke.js`
- `scripts/helpers/travel-v2-session-pressure-application.smoke.js`
- `scripts/dev/run-travel-v2-smoke.mjs`

If you add a new smoke module, also add a matching `scripts/dev/run-*.mjs` runner and wire it into `run-travel-v2-smoke.mjs`.

## Guard fixes allowed

Small guard fixes are allowed if tests show a real gap. Examples:

- ensure correction feedback does not display empty labels.
- ensure completed sessions expose disabled correction state.
- ensure panel row correction metadata does not mark skipped rows as correctable.
- ensure helper blocked results preserve session reference and reasons consistently.
- ensure app-local UI state separates apply feedback from correction feedback without stale misleading text.

Keep fixes narrow.

## Hard boundaries

Do not mutate actors.
Do not mutate items.
Do not emit sockets.
Do not send chat output.
Do not touch player station cards except to prove they are not touched.
Do not change PF2E resolution.
Do not change Hard Correction logic.
Do not change station assignment logic.
Do not change pressure math.
Do not add round finalization.
Do not add event completion.
Do not add fortune/scar reward flow.
Do not make correction player-facing.

## Acceptance checks

Run:

```bash
node --check scripts/apps/travel-event-runner.js
node --check scripts/apps/travel-event-runner-v2-preview-panel.js
node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
node --check scripts/helpers/travel-v2-pressure-application-state.js
node --check scripts/helpers/travel-v2-session-pressure-application.js
node --check scripts/helpers/travel-v2-pressure-correction.js
node scripts/dev/run-travel-event-runner-v2-preview-template-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-session-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

If new smoke files are added, include their direct runners in the PR testing notes.

## Expected result

The Phase 4 Travel v2 pressure loop is documented and has strong regression coverage around preview, application, correction, completed-session blocking, duplicate guards, feedback priority, and no-side-effect boundaries.

After this, Phase 5 can begin safely.
