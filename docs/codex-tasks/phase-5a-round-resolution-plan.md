# Codex Task: Phase 5A — Travel v2 round resolution plan

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-5a-round-resolution-plan`

## Context

Phase 4 is complete and documented. The GM pressure loop now supports:

```text
Preview → Apply → Correct
```

Phase 5 begins the next layer: round resolution.

This first Phase 5 pass should define the plan, guardrails, data model, and incremental implementation path for finalizing a Travel v2 round after the GM has applied/corrected pressure.

Do not implement round finalization in this task unless a tiny helper is needed only to clarify the plan. This should primarily be a design/specification and task-breakdown PR.

## Goal

Create a clear Phase 5 plan for how a Travel v2 round becomes resolved/finalized and how the runner advances toward event completion.

The plan must preserve the Phase 4 boundaries:

- GM pressure application/correction remains session-local.
- No actor/item mutation until a later explicit persistence phase.
- No sockets/chat/player-facing automation unless a later explicit phase adds it.
- No fortune/scar reward handoff until a later explicit phase.

## Add docs

Add:

- `docs/codex-tasks/phase-5a-round-resolution-plan.md` if this file is not already present.
- `docs/travel-v2/phase-5-round-resolution-plan.md`

The second file is the actual design note.

## Design note requirements

`docs/travel-v2/phase-5-round-resolution-plan.md` should define:

### 1. Phase 5 purpose

Explain that Phase 5 owns round finalization and event progression after Phase 4 pressure application/correction.

### 2. Round lifecycle states

Define a conservative state progression, for example:

```text
previewing → pressure-applied → finalized → event-complete-ready
```

or a better equivalent that fits existing runner state.

The plan should clarify:

- what marks a round as unresolved.
- what marks a round as pressure-applied.
- what marks a round as finalized.
- what remains editable before finalization.
- what becomes locked after finalization.

### 3. Finalization inputs

Define what the GM must have before finalizing a round:

- active session.
- current round.
- pressure application/effective outcome exists unless skipped/zero-pressure special case is explicitly allowed.
- station result summaries available if current runner model already exposes them.
- no unresolved correction state or blocked action.

### 4. Finalization record

Define a session-local record shape for finalized rounds, for example:

```js
session.travelV2RoundResolutions = {
  records: [roundResolutionRecord]
}
```

The record should include:

- roundIndex.
- roundNumber.
- finalizedAt.
- helperVersion.
- effectiveOutcomeKey.
- pressureApplicationRecord snapshot.
- correctionRecord snapshot if present.
- station summary snapshot if available.
- notes/reason optional.

### 5. Duplicate/finality guards

Define how repeated finalization is blocked or treated idempotently.

Clarify whether a finalized round can still be corrected. Conservative default:

- no correction after finalization.
- if a GM needs to fix after finalization, that is a later explicit rollback/admin phase.

### 6. Runner advancement

Define how finalizing current round relates to advancing to the next round.

Recommended conservative split:

- 5B creates read-only finalization state/model.
- 5C creates session-local finalize helper.
- 5D wires internal GM action path.
- 5E adds visible finalize controls.
- 5F handles event-complete-ready summary.
- 5G handles fortune/scar handoff planning or implementation.

### 7. Event completion boundary

Explain what should happen when the last round is finalized:

- mark event as ready for completion or completion-summary-ready.
- do not yet mutate actors/items.
- do not yet award fortune/scars unless later phase says so.

### 8. Safety boundaries

Restate hard boundaries:

- no actor mutation.
- no item mutation.
- no socket emission.
- no chat output.
- no player station card changes.
- no PF2E resolution changes.
- no Hard Correction changes.
- no pressure math changes.
- no automatic finalization during render.

### 9. Proposed Phase 5 task list

Include a task list with short descriptions, likely:

- 5A — plan and guardrails.
- 5B — round finalization state model.
- 5C — session-local round finalization helper.
- 5D — GM runner internal finalize action path.
- 5E — visible finalize controls and feedback.
- 5F — event completion readiness summary.
- 5G — final consequence/reward handoff plan.

Do not over-build beyond the plan.

## Optional code inspection

You may inspect existing runner files to make the plan accurate:

- `scripts/apps/travel-event-runner.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- `scripts/helpers/travel-v2-pressure-application-state.js`
- `scripts/helpers/travel-v2-session-pressure-application.js`
- `scripts/helpers/travel-v2-pressure-correction.js`
- `docs/travel-v2/phase-4-pressure-loop.md`

## Acceptance checks

Run any applicable markdown/static checks already used in the repo. At minimum, make sure the new docs are plain Markdown and contain the required headings.

Suggested local sanity checks:

```bash
git diff --name-only dev...HEAD
cat docs/travel-v2/phase-5-round-resolution-plan.md
```

No Node smoke runner is required for this planning-only Phase 5A task unless Codex adds a small doc smoke check. If it does add one, include the runner in PR testing notes.

## Expected result

A concise but complete Phase 5 round-resolution plan exists, defining the lifecycle, finalization record, safety boundaries, and the next implementation slices.
