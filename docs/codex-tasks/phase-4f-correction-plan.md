# Codex Task: Phase 4F — Travel v2 pressure correction plan

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-4f-correction-plan`

## Goal

Add a planning and guardrail document for correcting a mistaken Travel v2 pressure application.

This phase is **design/planning only** unless the existing smoke files need tiny wording updates to preserve the plan. Do not add live undo controls, live correction handlers, actor mutation, socket emission, chat output, or player-facing flow.

## Current foundation

Phase 4A plan:

- `docs/travel-v2/phase-4-pressure-application-plan.md`

Phase 4B readiness state:

- `scripts/helpers/travel-v2-pressure-application-state.js`

Phase 4C session-only application helper:

- `scripts/helpers/travel-v2-session-pressure-application.js`

Phase 4D internal GM runner action path:

- `scripts/apps/travel-event-runner.js`

Phase 4E visible GM preview-panel controls:

- `templates/apps/travel-event-runner.hbs`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`

## Add

Add a design document:

- `docs/travel-v2/phase-4f-pressure-correction-plan.md`

Optional, only if it helps future tracking:

- Update `docs/travel-v2/phase-4-pressure-application-plan.md` with a short pointer to the new Phase 4F correction plan.

## Required document content

The new plan should cover:

1. Why correction is needed.
2. What data must be recorded during application for correction to be safe.
3. What should be reversible and what should not be reversible.
4. How a GM should correct a mistaken pressure outcome.
5. Whether correction should be a full rollback, a compensating adjustment, or a mark-and-reapply workflow.
6. How duplicate-application guards interact with correction.
7. How correction should behave if later rounds already happened.
8. How correction should behave if ship scars or hazard draws were queued by pressure overflow.
9. Which side effects are forbidden.
10. Which future implementation phases are required before any live correction controls are added.

## Recommended correction model

Prefer a conservative model:

- Do not silently erase history.
- Store correction records rather than deleting original application records.
- Treat correction as GM-only and session-local unless a later phase explicitly expands it.
- Block correction if dependent later-round changes make automatic rollback unsafe.
- Require visible GM confirmation before any live correction is added in a later phase.

Recommended future record concepts:

```js
pressureCorrectionRecords: [
  {
    roundIndex,
    roundNumber,
    originalOutcomeKey,
    correctedOutcomeKey,
    reason,
    createdAt,
    helperVersion,
    originalApplicationRecordId,
    safetyStatus
  }
]
```

Do not implement this data shape in runtime code in this phase unless the repo already has a docs-only schema example pattern.

## Hard boundaries

Do not add live correction buttons.
Do not add live undo buttons.
Do not add new GM app handlers.
Do not mutate runner session data in code.
Do not edit pressure math.
Do not mutate actors.
Do not mutate items.
Do not emit sockets.
Do not send chat output.
Do not touch player station cards.
Do not change PF2E resolution.
Do not change Hard Correction logic.
Do not change station assignment logic.
Do not change Travel v2 pressure application behavior from Phase 4C/4D/4E.

## Suggested document structure

Use headings similar to:

```md
# Phase 4F — Travel v2 Pressure Correction Plan

## Purpose
## Current Phase 4 State
## Problem Cases
## Correction Principles
## Required Application Data
## Proposed Correction Record
## Duplicate Guard Interaction
## Later Round Safety
## Overflow / Hazard Draw / Ship Scar Safety
## Future Implementation Phases
## Hard Boundaries
## Local Test Checklist
```

## Acceptance checks

Run:

```bash
node scripts/dev/run-travel-event-runner-v2-preview-template-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-session-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

If only docs are changed, no JavaScript `node --check` command is required unless a smoke or JS file is also changed.

## Expected result

A clear Phase 4F correction/undo plan exists, with guardrails strong enough that future runtime correction work can be split into safe follow-up phases.

No live correction feature is added in this PR.
