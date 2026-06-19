# Phase 4F — Travel v2 Pressure Correction Plan

## Purpose

Phase 4F defines how a GM should recover from a mistaken Travel v2 pressure application in a future implementation phase.

Correction is needed because Phase 4C through Phase 4E intentionally make pressure application explicit and duplicate-guarded, but a GM can still choose the wrong preview outcome, apply pressure to the wrong round context, or discover after application that the table result was entered incorrectly. Without a documented correction model, future undo work could erase history, bypass duplicate-application guards, or accidentally introduce actor mutation and player-facing side effects before the data architecture is ready.

This phase is planning only. It does not add live undo controls, correction handlers, actor mutation, socket emission, chat output, or player-facing flow.

## Current Phase 4 State

Phase 4 currently treats application as a GM-only commit of one previewed outcome into the local runner session pressure state.

The existing safety model is:

- the GM chooses an outcome from the preview panel
- pressure application updates session-local pressure data only
- an application record marks the round as already applied
- later attempts to apply pressure for the same round are blocked
- no actors, items, sockets, chat cards, player station cards, Hard Correction logic, station assignment logic, or PF2E statistic resolution are changed

Phase 4F keeps those boundaries intact and only describes a future-safe correction path.

## Problem Cases

A future correction workflow should handle these mistakes without silently rewriting history:

- the GM applied the wrong outcome key for the current round
- the GM applied pressure before all station results or table rulings were finalized
- the applied preview was based on stale pressure state
- the wrong round was active when the application was committed
- duplicate-application protection correctly blocks reapplying, but the GM needs a documented recovery path
- pressure overflow queued future consequences such as hazard draws or ship scars that may no longer be valid after correction
- one or more later rounds have already been applied, making automatic rollback unsafe

## Correction Principles

Correction should be conservative and auditable.

Future runtime work should follow these principles:

- Do not silently delete or overwrite original pressure application records.
- Store correction records that reference the original application record.
- Treat correction as GM-only and session-local unless a later phase explicitly expands the scope.
- Prefer explicit GM confirmation before any live correction changes session state.
- Block automatic rollback when dependent later-round changes make the result unsafe.
- Keep the original application visible in GM-facing history so the table can understand what changed.
- Do not use correction as a way to bypass duplicate-application guards.
- Do not introduce actor mutation, item mutation, socket emission, chat output, or player-facing updates as part of Phase 4 correction.

## Required Application Data

Safe correction depends on recording enough data at application time to understand what happened and whether it can be adjusted later.

Future application records should preserve at least:

- a stable application record id
- helper or schema version
- round index and player-visible round number
- selected outcome key
- pressure request summary used for the application
- pressure state before application, or a compact reversible delta if full snapshots are not chosen
- pressure state after application, or the resulting aggregate fields needed for audit
- whether the application caused overflow
- whether overflow queued hazard draws, ship scars, or other follow-up consequences
- timestamp of application
- GM user id when available in a Foundry v13-safe way
- source preview revision or equivalent marker if the preview model later gains revisions

If this data is missing, correction should fall back to a manual mark-and-adjust flow rather than pretending automatic rollback is safe.

## Proposed Correction Record

A future correction record should be additive. It should not delete the original application record.

Example planning shape:

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

Recommended additional fields for a later schema phase include:

- `correctionRecordId`
- `createdByUserId`
- `correctionMode`
- `blockedReasons`
- `previousPressureSummary`
- `correctedPressureSummary`
- `overflowReviewRequired`
- `laterRoundReviewRequired`

These fields remain documentation-only in Phase 4F.

## Correction Model

Correction should use a mark-and-reapply workflow as the default model.

A full rollback is only safe when all of the following are true:

- the original application record contains enough data to reconstruct the previous state
- no later round has applied pressure that depends on the current pressure totals
- no overflow consequence has been consumed, resolved, shown to players, or transferred into another system
- the GM confirms the correction before it changes session state

A compensating adjustment is safer when pressure has already influenced later play. In that case, the workflow should preserve the original application, record the reason for correction, and apply an explicit GM-visible adjustment rather than trying to make history disappear.

The recommended future order is:

1. Mark the original application as corrected or superseded.
2. Add a correction record with the GM reason and safety status.
3. Recalculate or apply a compensating session-local adjustment only if the safety checks pass.
4. Keep both the original application and the correction visible in GM history.

## GM Correction Flow

A future GM-facing correction flow should be deliberate and visible:

1. The GM opens the applied round's pressure summary.
2. The UI shows the original outcome, applied request summary, timestamp, and any overflow notes.
3. The GM chooses a corrected outcome or manual adjustment mode.
4. The UI explains whether automatic correction is safe, blocked, or requires manual review.
5. The GM enters a reason.
6. The GM confirms the correction.
7. The session records an additive correction record.
8. The UI shows the original application as corrected or superseded without removing it.

If automatic correction is blocked, the UI should still allow the GM to record a note for audit, but it should not mutate pressure totals.

## Duplicate Guard Interaction

Duplicate-application guards should remain strict.

Correction must not mean "apply again." A round with an application record should continue to block normal application, even if a correction record exists. Future correction controls should be separate from apply controls and should require a distinct permission check, confirmation, and audit record.

Recommended guard behavior:

- unapplied round: allow normal apply if all existing Phase 4 requirements pass
- applied round with no correction: block normal apply; optionally show future correction entry point
- applied round with correction pending or blocked: block normal apply and show the correction status
- corrected round: block normal apply and show both original and corrected outcome summaries

## Later Round Safety

Automatic correction becomes risky once later rounds have happened.

If later rounds have pressure applications, preview calculations, overflow queues, or other derived state that depends on the original application, the future correction helper should treat automatic rollback as unsafe unless a later schema phase can prove the dependency graph is reversible.

Recommended behavior:

- If no later pressure application exists, allow correction only when the original application data is complete.
- If later rounds exist but have no committed pressure application, require GM review and clear stale previews.
- If later rounds have committed pressure applications, block automatic rollback and offer a mark-only or compensating-adjustment path.
- Never recalculate later rounds silently.

## Overflow / Hazard Draw / Ship Scar Safety

Pressure overflow is a boundary between session pressure math and future consequences. Correction must be careful when overflow has queued hazard draws, ship scars, or similar follow-up results.

Future correction logic should record whether the original application produced overflow and whether that overflow queued or triggered any consequence.

Recommended behavior:

- If overflow was only previewed and never committed, correction may proceed subject to normal safety checks.
- If overflow queued a hazard draw or ship scar but it has not been resolved, mark the queue for GM review instead of deleting it silently.
- If a hazard draw, ship scar, or other consequence has already been resolved, block automatic rollback and require a compensating adjustment or manual note.
- Do not remove scars, hazard history, or player-visible consequences automatically.

## Reversible and Non-Reversible Effects

Potentially reversible in a future phase, if complete application data exists:

- session-local pressure totals changed by the original application
- session-local application status for the affected round
- session-local derived preview state that has not been shown or committed elsewhere

Not automatically reversible:

- actor or item changes
- chat messages
- socket-delivered player updates
- player station card state
- resolved hazard draws
- applied ship scars
- later round pressure applications
- GM notes or audit records
- any effect whose source data is incomplete or whose dependencies are unknown

## Forbidden Side Effects

Phase 4F and any immediate follow-up correction design must not:

- add live correction buttons
- add live undo buttons
- add new GM app handlers
- mutate runner session data in code
- edit pressure math
- mutate actors
- mutate items
- emit sockets
- send chat output
- touch player station cards
- change PF2E resolution
- change Hard Correction logic
- change station assignment logic
- change Travel v2 pressure application behavior from Phase 4C, Phase 4D, or Phase 4E

## Future Implementation Phases

Before any live correction controls are added, future work should be split into small phases:

1. **Correction schema planning:** define stable application and correction record fields, ids, helper versions, safety statuses, and migration expectations.
2. **Read-only correction state helper:** report whether a round is correctable, blocked, or manual-review-only without mutating data.
3. **Session-local correction helper:** perform additive correction records and safe session-local pressure adjustments with dedicated smoke tests.
4. **GM app action path:** wire the helper into GM-only runner code without sockets, chat, actor mutation, or player UI changes.
5. **GM confirmation UI:** add clearly labeled controls, confirmation copy, reason entry, and blocked-state messaging.
6. **Overflow review tooling:** add GM-only review states for unresolved overflow consequences before any automatic handling is considered.
7. **Broader persistence review:** only after the data architecture exists, decide whether correction records should persist outside the local runner session.

## Hard Boundaries

This document is not permission to implement correction runtime behavior.

Until a later phase explicitly implements and tests correction, the only safe runtime behavior remains the existing Phase 4 duplicate-application block.

## Local Test Checklist

For Phase 4F documentation-only changes, run the existing Phase 4 smoke checks:

```bash
node scripts/dev/run-travel-event-runner-v2-preview-template-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-session-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

No JavaScript syntax check is required when this phase changes only Markdown documentation.
