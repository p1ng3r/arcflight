# Codex Task: Phase 5C — Travel v2 session-local round finalization helper

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-5c-round-finalization-helper`

## Context

Phase 5A planned round resolution in:

- `docs/travel-v2/phase-5-round-resolution-plan.md`

Phase 5B added the read-only finalization state model:

- `scripts/helpers/travel-v2-round-finalization-state.js`
- `scripts/helpers/travel-v2-round-finalization-state.smoke.js`
- `scripts/dev/run-travel-v2-round-finalization-state-smoke.mjs`

Phase 5C must add the session-local helper that actually finalizes the current round by cloning the runner session and appending one round resolution record.

Do not add runner action wiring yet.
Do not add visible finalize controls yet.
Those are Phase 5D and 5E.

## Goal

Implement a conservative session-local round finalization helper.

The helper must:

1. Inspect the current round using `prepareTravelV2RoundFinalizationState`.
2. Block when the round cannot be finalized.
3. Clone the session when finalization is allowed.
4. Append one round resolution record to `session.travelV2RoundResolutions.records`.
5. Return structured success/blocking feedback.
6. Never mutate the input session.
7. Never mutate actors/items, emit sockets, send chat, or touch player station cards.

## Add helper

Add:

- `scripts/helpers/travel-v2-session-round-finalization.js`

Export:

```js
export const TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION = 1;
export function finalizeTravelV2RoundOnRunnerSession(session, options = {}) { ... }
```

Also export default if consistent with existing helper style.

## Use Phase 5B state

Import and use:

```js
prepareTravelV2RoundFinalizationState
```

The helper should rely on that state model for:

- current round detection.
- pressure application availability.
- correction snapshot detection.
- existing finalization detection.
- completed session blocking.
- `canFinalize` and blocked reasons.

Do not duplicate more state logic than needed.

## Success result shape

Return a result similar to existing Phase 4 helpers:

```js
{
  ok: true,
  finalized: true,
  session: finalizedSession,
  roundResolutionRecord,
  lifecycleState,
  roundIndex,
  roundNumber,
  effectiveOutcomeKey
}
```

You may include additional useful fields, but keep it focused.

## Blocked result shape

When blocked, return:

```js
{
  ok: false,
  finalized: false,
  session,
  blockedReasons,
  error,
  lifecycleState,
  roundIndex,
  roundNumber,
  effectiveOutcomeKey
}
```

The blocked result should preserve the input session reference when possible, matching the existing conservative helper style.

## Round resolution record shape

Append a deep-cloned record to:

```js
session.travelV2RoundResolutions = {
  ...existingContainer,
  records: [...existingRecords, roundResolutionRecord]
}
```

Recommended record:

```js
{
  roundIndex,
  roundNumber,
  finalizedAt,
  helperVersion,
  lifecycleState: "finalized",
  effectiveOutcomeKey,
  pressureApplicationRecord,
  correctionRecord,
  stationSummary,
  notes,
  reason
}
```

Field rules:

- `finalizedAt`: use `options.finalizedAt`, `options.createdAt`, `options.now`, or a generated ISO timestamp, following existing helper timestamp style.
- `helperVersion`: `TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION`.
- `pressureApplicationRecord`: clone from finalization state.
- `correctionRecord`: clone from finalization state, or `null`.
- `stationSummary`: clone from finalization state, or `null`.
- `notes`: optional string from `options.notes`.
- `reason`: optional string from `options.reason`.

Do not store live references.

## Duplicate/finality guard

If the current round already has a finalization record, block and do not append another record.

Use the Phase 5B state model blocked reasons where possible, and make sure a duplicate attempt returns a clear reason such as:

```text
Current Travel v2 round is already finalized.
```

Do not treat duplicate finalization as success in Phase 5C.

## Event-complete-ready state

If the finalized round is the final event round, the returned state/helper may expose lifecycle state `event-complete-ready` or `isEventCompleteReady: true` after finalization.

Do not complete the event.
Do not award fortune.
Do not apply scars.
Do not mutate actors/items.

## Add smoke tests

Add:

- `scripts/helpers/travel-v2-session-round-finalization.smoke.js`
- `scripts/dev/run-travel-v2-session-round-finalization-smoke.mjs`

Wire the new runner into:

- `scripts/dev/run-travel-v2-smoke.mjs`

Smoke coverage should include:

1. Missing/null session blocks and does not throw.
2. Active current round without pressure application blocks.
3. Active current round with pressure application finalizes successfully.
4. Successful finalize returns a cloned session.
5. Successful finalize does not mutate input session.
6. Successful finalize appends one `travelV2RoundResolutions.records` entry.
7. Resolution record contains round index/number, effective outcome, helper version, timestamp, pressure application snapshot, correction snapshot when present, and station summary snapshot when present.
8. Duplicate finalization blocks and appends no new record.
9. Completed session blocks.
10. Corrected pressure outcome finalizes with corrected effective outcome and correction snapshot.
11. Final event round finalization reports event-complete-ready/ready metadata when safely detectable.
12. No chat/socket/actor/item/player-card side effects are called.
13. Aggregate `run-travel-v2-smoke.mjs` includes the new smoke runner.

## Hard boundaries

Do not add runner action wiring.
Do not add visible finalize controls.
Do not mutate actors.
Do not mutate items.
Do not emit sockets.
Do not send chat.
Do not touch player station cards.
Do not change PF2E resolution.
Do not change Hard Correction logic except later guards if explicitly requested.
Do not change pressure math.
Do not automatically finalize during render/state preparation.
Do not award fortune.
Do not apply scars.
Do not complete events.

## Acceptance checks

Run:

```bash
node --check scripts/helpers/travel-v2-round-finalization-state.js
node --check scripts/helpers/travel-v2-session-round-finalization.js
node --check scripts/helpers/travel-v2-session-round-finalization.smoke.js
node --check scripts/dev/run-travel-v2-session-round-finalization-smoke.mjs
node scripts/dev/run-travel-v2-round-finalization-state-smoke.mjs
node scripts/dev/run-travel-v2-session-round-finalization-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Also run related Phase 4 pressure loop smoke suites:

```bash
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-pressure-correction-smoke.mjs
```

## Expected result

Phase 5C adds a safe session-local finalization helper that clones the runner session and appends a single round resolution record with evidence snapshots. It is ready for Phase 5D, which will wire the helper into the GM runner internal action path.
