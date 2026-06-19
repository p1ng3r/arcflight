# Codex Task: Phase 5B — Travel v2 round finalization state model

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-5b-round-finalization-state`

## Context

Phase 5A planned round resolution in:

- `docs/travel-v2/phase-5-round-resolution-plan.md`

Phase 4 completed the GM pressure loop:

```text
Preview → Apply → Correct
```

Phase 5B is the first implementation slice for round resolution. It must add a read-only state/model helper that can tell the runner whether the current round is unresolved, pressure-applied, finalized, or event-complete-ready.

Do not add the actual finalize action yet. Do not add visible finalize controls yet. Those are later phases.

## Goal

Implement a conservative, read-only Travel v2 round finalization state helper.

The helper must inspect a runner session and return structured state for the active/current round without mutating the session.

## Add helper

Add:

- `scripts/helpers/travel-v2-round-finalization-state.js`

Export:

```js
export const TRAVEL_V2_ROUND_FINALIZATION_STATE_VERSION = 1;
export function prepareTravelV2RoundFinalizationState(session = null, options = {}) { ... }
```

Also export a default if that matches existing helper style.

## Expected state shape

Return a plain object similar in style to other Travel v2 state helpers.

Recommended fields:

```js
{
  version,
  hasSession,
  isCompleted,
  hasCurrentRound,
  roundIndex,
  roundNumber,
  lifecycleState,
  isPreviewing,
  isPressureApplied,
  isFinalized,
  isEventCompleteReady,
  canFinalize,
  blockedReasons,
  finalizationRecord,
  pressureApplicationRecord,
  correctionRecord,
  effectiveOutcomeKey,
  stationSummary,
  footerText
}
```

You may add small additional fields if useful for later phases, but keep the model focused and read-only.

## Lifecycle rules

Use the Phase 5A lifecycle:

```text
previewing → pressure-applied → finalized → event-complete-ready
```

Conservative rules:

- `previewing`: session/current round exists, but no effective current-round pressure application record and no finalization record.
- `pressure-applied`: effective current-round pressure application record exists, no finalization record, and session is not completed.
- `finalized`: matching finalization record exists for the current round, and it is not the final event round or completion readiness is not detected.
- `event-complete-ready`: matching finalization record exists for the final event round.

If the session is completed, expose `isCompleted: true` and block finalization.

## Matching records

The helper should inspect existing Phase 4 pressure application/correction containers if present.

Likely containers:

- `session.travelV2PressureApplications.records`
- `session.travelV2PressureCorrections.records`

Planned Phase 5 container:

- `session.travelV2RoundResolutions.records`

Record matching should use `roundIndex` first and `roundNumber` as fallback when needed, consistent with the Phase 5A plan.

The helper should identify:

- the effective current-round pressure application record.
- the latest matching correction record, if any.
- the matching round finalization record, if any.

Do not mutate or normalize these source records in place. Return cloned/safe snapshots where needed.

## canFinalize / blocked reasons

`canFinalize` should be true only when:

- session exists.
- session is not completed.
- current round exists.
- current round is not already finalized.
- an effective current-round pressure application exists.

Blocked reasons should be clear and stable strings, for example:

- `Travel v2 runner session is required.`
- `Travel v2 runner session is completed.`
- `Travel v2 runner session has no current round.`
- `Current Travel v2 round has no effective pressure application.`
- `Current Travel v2 round is already finalized.`

Do not implement skipped/zero-pressure finalization in 5B. Treat missing pressure application as blocked.

## Current round detection

Follow existing runner/session patterns where possible. Inspect existing helpers before inventing new assumptions:

- `scripts/apps/travel-v2-runner-bridge.js`
- `scripts/helpers/travel-v2-pressure-application-state.js`
- `scripts/helpers/travel-v2-session-pressure-application.js`
- `scripts/helpers/travel-v2-pressure-correction.js`

Do not change these helpers unless a very small export is needed and is clearly safe.

## Station summary

If station result summaries are already exposed in the current runner/session shape, return a cloned snapshot in `stationSummary`.

If not available, return `null`.

Do not invent station summary content.

## Event-complete-ready detection

Derive `isEventCompleteReady` conservatively.

If a matching finalization record exists and the helper can confidently determine the current round is the final event round, set `lifecycleState: "event-complete-ready"` and `isEventCompleteReady: true`.

If final-round detection is not reliable from the current session shape, keep `lifecycleState: "finalized"` and document the limitation in comments or smoke expectations.

Do not complete the event.
Do not award fortune/scars.
Do not mutate actors/items.

## Add smoke tests

Add:

- `scripts/helpers/travel-v2-round-finalization-state.smoke.js`
- `scripts/dev/run-travel-v2-round-finalization-state-smoke.mjs`

Wire the new runner into:

- `scripts/dev/run-travel-v2-smoke.mjs`

Smoke coverage should include:

1. Empty/null session returns blocked preview-ish state and does not throw.
2. Active session with current round but no pressure application returns `previewing`, `canFinalize: false`.
3. Active session with a current-round pressure application returns `pressure-applied`, `canFinalize: true`.
4. Corrected pressure application returns the corrected effective outcome and matching correction record when available.
5. Existing finalization record returns `finalized`, `canFinalize: false`.
6. Completed session blocks finalization.
7. Returned state does not mutate input session.
8. Finalization records are matched by round index/number.
9. Aggregate `run-travel-v2-smoke.mjs` includes the new smoke runner.

## Hard boundaries

Do not add finalize action.
Do not add visible finalize controls.
Do not mutate actors.
Do not mutate items.
Do not emit sockets.
Do not send chat.
Do not touch player station cards.
Do not change PF2E resolution.
Do not change Hard Correction logic.
Do not change pressure math.
Do not automatically finalize during render/state preparation.
Do not award fortune.
Do not apply scars.
Do not complete events.

## Acceptance checks

Run:

```bash
node --check scripts/helpers/travel-v2-round-finalization-state.js
node --check scripts/helpers/travel-v2-round-finalization-state.smoke.js
node --check scripts/dev/run-travel-v2-round-finalization-state-smoke.mjs
node scripts/dev/run-travel-v2-round-finalization-state-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Also run related Phase 4 pressure loop smoke suites to make sure the new read-only helper did not break them:

```bash
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-pressure-correction-smoke.mjs
```

## Expected result

Phase 5B adds a read-only round finalization state model that identifies current round lifecycle and finalization availability without changing gameplay state. It is ready for Phase 5C, which will add the session-local finalize helper.
