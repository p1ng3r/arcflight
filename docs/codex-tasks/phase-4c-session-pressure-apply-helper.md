# Codex Task: Phase 4C — Session-only Travel v2 pressure application helper

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-4c-session-pressure-apply-helper`

## Goal

Add a **session-only** Travel v2 pressure application helper.

This is the first Phase 4 helper that may apply pressure, but only to a cloned runner-session object. It must not touch Foundry actors, player sockets, chat, templates, app event handlers, or UI controls.

## Current foundation

Phase 4A added the plan:

- `docs/travel-v2/phase-4-pressure-application-plan.md`

Phase 4B added read-only application readiness state:

- `scripts/helpers/travel-v2-pressure-application-state.js`
- `scripts/helpers/travel-v2-pressure-application-state.smoke.js`
- `scripts/dev/run-travel-v2-pressure-application-state-smoke.mjs`

Existing pressure/preview helpers:

- `scripts/helpers/travel-v2-pressure-engine.js`
- `scripts/helpers/travel-v2-round-pressure-adapter.js`
- `scripts/helpers/travel-v2-preview-state.js`
- `scripts/helpers/travel-v2-runner-bridge.js`

## Add

- `scripts/helpers/travel-v2-session-pressure-application.js`
- `scripts/helpers/travel-v2-session-pressure-application.smoke.js`
- `scripts/dev/run-travel-v2-session-pressure-application-smoke.mjs`

Optionally wire the new smoke suite into:

- `scripts/dev/run-travel-v2-smoke.mjs`

only if this stays a small, clean import + suite-list addition.

## Required exports

From `scripts/helpers/travel-v2-session-pressure-application.js` export:

```js
export const TRAVEL_V2_SESSION_PRESSURE_APPLICATION_VERSION = 1;
export function applyTravelV2PressureToRunnerSession(session, options = {}) {}
export default applyTravelV2PressureToRunnerSession;
```

## Helper behavior

`applyTravelV2PressureToRunnerSession(session, options = {})` should:

1. Treat the input `session` as immutable.
2. Return a result object, not just the cloned session.
3. Clone the session before making changes.
4. Use Phase 4B's `prepareTravelV2PressureApplicationState` to check whether application is allowed.
5. Default `selectedOutcomeKey` to `mixed` if not supplied.
6. Use existing preview/adapter/pressure-engine helpers for pressure requests and application.
7. Apply pressure only to the cloned session's Travel v2 pressure state.
8. Write an application record so duplicate application for the same round is blocked later.
9. Preserve existing session shape where possible.
10. Return a clear failure object when blocked.

Suggested result shape:

```js
{
  ok: true,
  applied: true,
  session: clonedUpdatedSession,
  applicationRecord,
  applicationStateBefore,
  selectedOutcomeKey,
  pressureResult
}
```

Blocked result shape:

```js
{
  ok: false,
  applied: false,
  session: originalSessionOrClone,
  applicationStateBefore,
  selectedOutcomeKey,
  blockedReasons,
  error
}
```

The exact names may vary if the existing repo style suggests better names, but the result must be explicit and smoke-tested.

## Application record requirements

Record enough information to block duplicate application for the same round:

- roundIndex
- roundNumber
- outcomeKey
- requestCount
- totalsByPressureType or pressure summary
- createdAt or deterministic test timestamp supplied by options
- helper version

Recommended storage shape:

```js
session.travelV2PressureApplications = {
  records: [applicationRecord]
}
```

If an existing record collection exists, preserve it and append to it.

## Pressure-state requirements

The helper should update only Travel v2 session pressure state, using the existing pressure engine's canonical structure.

Do not invent a separate pressure shape if `travel-v2-pressure-engine.js` already expects a specific one.

If the current session lacks an initialized Travel v2 pressure state, initialize the minimum valid state using existing helpers if available.

## Hard boundaries

Do not edit:

- templates
- styles
- `scripts/apps/travel-event-runner.js`
- player station card code
- socket code
- chat code
- actor update code
- item update code
- Hard Correction logic
- station assignment logic
- PF2E statistic resolution
- player roll requests

Do not add UI buttons.
Do not add app action handlers.
Do not mutate the input session.
Do not mutate Foundry actors.
Do not send chat output.
Do not notify players.

## Smoke tests

Add smoke coverage for:

1. Version export is `1`.
2. Applying `mixed` to a valid active session succeeds.
3. Input session is not mutated.
4. Returned session is a different object.
5. Pressure state changes on the returned session.
6. Application record is written.
7. Duplicate application for the same round is blocked.
8. Completed session blocks application.
9. Invalid selected outcome blocks application.
10. `failure` and `criticalFailure` apply expected pressure totals.
11. Existing application records are preserved when appending a new record.

## Acceptance checks

Run:

```bash
node --check scripts/helpers/travel-v2-session-pressure-application.js
node --check scripts/helpers/travel-v2-session-pressure-application.smoke.js
node --check scripts/dev/run-travel-v2-session-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-session-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-pressure-application-state-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

## Expected result

A pure/session-only helper can apply one selected current-round Travel v2 pressure outcome to a cloned runner session, write an application record, and block duplicates.

No UI or Foundry-side mutation happens in this phase.
