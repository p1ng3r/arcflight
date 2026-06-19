# Travel v2 Phase 4 — Pressure Application Plan

## Purpose

Phase 4 moves Travel v2 from read-only preview into controlled pressure application.

The goal is to let a GM explicitly apply one previewed outcome for the current round to the local runner session's Travel v2 pressure state while preserving the existing safety boundaries.

## Non-goals

Phase 4 must not begin by mutating actors or sending player-facing effects.

Do not add, change, or call logic that:

- mutates PF2E actors, vehicle actors, items, hull, AP/RAP, Lifeveil, morale, cargo, or supplies outside the runner session pressure object
- sends chat output automatically
- changes player station cards or socket flow
- changes Hard Correction, station assignment, player roll request, PF2E statistic resolution, or station result persistence logic
- silently applies pressure without an explicit GM action
- applies pressure more than once for the same round without an explicit undo/reapply design

## Current foundation

Phase 3 now provides the GM runner with:

- `state.travelV2Preview`
- `state.travelV2PreviewPanel`
- preview rows for `criticalSuccess`, `success`, `mixed`, `failure`, `criticalFailure`, and `skipped`
- read-only template rendering for the preview panel
- a standalone smoke check for the template and CSS preview markers

The pressure engine and round adapter already provide preview/application helpers. Phase 4 should reuse those helpers instead of duplicating pressure math in the UI.

## Application model

A pressure application should be a GM-only commit of one existing preview outcome row for the current round.

Minimum input:

- active runner session
- current round index
- selected outcome key
- preview requests from the current round pressure adapter / preview row

Minimum output:

- updated local runner session pressure state
- application record showing what was applied
- no actor mutation
- no player message
- no automatic chat output

## Idempotency rule

The runner must protect against accidental double-application.

A round should record whether Travel v2 pressure has already been applied, including:

- round index
- outcome key
- pressure request summary
- application timestamp or revision marker

Before applying pressure, the app should detect an existing application record and block the action unless a future explicit undo/reapply workflow exists.

## Suggested PR sequence

### Phase 4A — Plan and guardrails

This document only.

No runtime behavior changes.

### Phase 4B — Application state model

Add a helper that prepares read-only UI state for whether pressure can be applied.

It should answer:

- is there an active session?
- is the event completed?
- is there a current round?
- is the preview panel available?
- has pressure already been applied for this round?
- which outcome key is selected or defaulted?
- which rows are available as apply candidates?

No mutation.

### Phase 4C — Session-only application helper

Add a pure helper that accepts a runner session and an outcome key, previews the round requests, and returns a cloned/updated session with pressure applied to the session pressure object only.

Rules:

- use existing Travel v2 pressure engine application helpers
- clone before changing
- write an application record into session metadata
- block duplicate application for the same round
- smoke-test success, mixed, failure, critical failure, and duplicate blocking

No app action handler yet.
No template buttons yet.

### Phase 4D — GM app action handler

Add a GM-only app handler that calls the session-only application helper and updates the local runner session.

Rules:

- explicit GM action only
- no player socket calls
- no actor mutation
- no chat output
- no template redesign
- update local runner session and rerender

### Phase 4E — Apply controls in preview panel

Add UI controls to the existing read-only preview panel.

Rules:

- label the action clearly, for example `Apply This Outcome to Session Pressure`
- disable controls when current round is already applied
- show the applied outcome and read-only summary after application
- keep the pressure preview rows visible
- no actor mutation

### Phase 4F — Undo or correction design, if needed

Only after GM apply is stable, decide whether to support undo, correction, or manual pressure adjustment.

Phase 4F is documented in `docs/travel-v2/phase-4f-pressure-correction-plan.md` as a planning-only correction model. It keeps duplicate application blocked and recommends additive correction records rather than silently erasing application history.

Until then, duplicate application remains blocked.

## Smoke-test expectations

Every Phase 4 implementation PR should run at least:

```bash
node scripts/dev/run-travel-v2-smoke.mjs
```

New helpers should add dedicated smoke runners before being wired into the live app.

## Safety checklist for every Phase 4 PR

Before merging any Phase 4 PR, confirm:

- pressure application is GM-only
- pressure application is explicit, not automatic
- duplicate application is blocked
- actor data is not changed
- player sockets are not touched
- chat output is not generated automatically
- existing Travel v2 preview smoke checks still pass
- existing Travel v2 pressure engine smoke checks still pass
