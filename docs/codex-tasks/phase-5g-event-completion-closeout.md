# Codex Task: Phase 5G — Travel v2 event completion closeout

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-5g-event-completion-closeout`

## Context

Phase 5 has already built the Travel v2 round finalization pipeline:

- 5A — round resolution plan and guardrails.
- 5B — read-only round finalization state model.
- 5C — session-local round finalization helper.
- 5D — GM runner internal finalize-round action path.
- 5E — visible GM-only finalize-round controls and feedback.
- 5F — read-only event completion readiness summary.

Phase 5G should close this phase out by adding the minimum safe GM-only event completion handoff/action.

This is still session-local. Do not mutate actors/items. Do not apply scars/fortune/rewards/consequences. Those belong to later systems.

## Goal

When the 5F readiness helper says the event is ready, let the GM complete the Travel v2 runner session locally.

Completion should:

- mark the runner session completed.
- store a completion record/summary on the session.
- preserve round finalization records.
- surface success/blocked feedback in the GM runner UI.
- avoid all external side effects.

This should make Phase 5 feel usable end-to-end: apply/correct pressure, finalize rounds, see readiness, and mark the event session completed.

## New helper

Add a session-local helper, likely:

- `scripts/helpers/travel-v2-session-event-completion.js`

Exports:

```js
export const TRAVEL_V2_SESSION_EVENT_COMPLETION_VERSION = 1;
export function completeTravelV2EventOnRunnerSession(session, options = {}) { ... }
```

Recommended result shape:

```js
{
  ok,
  completed,
  session,
  originalSession,
  blockedReasons,
  completionRecord,
  readiness,
  completedAt,
  helperVersion,
  summaryText
}
```

Rules:

- Use `prepareTravelV2EventCompletionReadiness(session, options)`.
- Only complete if readiness says `eventReady === true` and `canCompleteEvent === true`.
- Block if session is missing, already completed, has no rounds, has pending finalizations, or final round is not finalized.
- On blocked result, return original session reference and do not mutate input.
- On success, deep clone session and update the clone only.
- Set session status to `completed`.
- Set a completed timestamp, defaulting to `new Date().toISOString()` unless `options.now` is provided.
- Append or set a Travel v2 completion record in a clearly named session-local container.

Recommended container:

```js
session.travelV2EventCompletion = {
  version,
  completed: true,
  completedAt,
  helperVersion,
  finalizedRoundCount,
  eventRoundCount,
  effectiveOutcomeSummary,
  readinessSummary
}
```

Also okay to include `records: [...]` if that matches existing project patterns, but keep it simple and stable.

Do not remove or rewrite `travelV2RoundResolutions.records`.

## Runner app wiring

Update:

- `scripts/apps/travel-event-runner.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `templates/apps/travel-event-runner.hbs`
- `styles/arcflight.css`

Add an exported runner update helper similar to pressure application/correction/finalization:

```js
export function prepareTravelV2EventCompletionRunnerUpdate(currentSession, options = {}) { ... }
```

Recommended return shape:

```js
{
  result,
  nextSession,
  shouldUpdateSession,
  shouldRerender
}
```

Rules:

- Call `completeTravelV2EventOnRunnerSession(currentSession, options)`.
- `shouldUpdateSession` true only when `result.ok === true`, `result.completed === true`, and `result.session` exists.
- `nextSession` is result session on success, otherwise original session.
- Store result in UI state, e.g. `travelV2EventCompletionResult`.
- On success update `this.session` with clone, preserve/update `selectedSessionKey`, set status message such as `Completed Travel v2 event.` and rerender.
- On blocked result store blocked result, set status message to first blocked reason/error, do not mutate session.

## Visible GM control

Add a GM-only completion control near the 5F readiness summary.

Use a clear selector:

```hbs
data-arcflight-travel-v2-event-complete
```

Button rules:

- Show only in the GM runner UI.
- Enabled only when readiness says ready and session is not completed.
- Disabled otherwise.
- After completion, show completed state such as `Event Completed`.
- Blocked reason/readiness text should remain visible.

Suggested labels:

```text
Complete Event
Event Completed
Cannot Complete Event
```

This is allowed in Phase 5G because 5F intentionally withheld it.

## Hard boundaries

This phase may update the runner session object only.

Do not mutate actors.
Do not mutate items.
Do not emit sockets.
Do not send chat.
Do not touch player station cards.
Do not award fortune.
Do not apply scars.
Do not apply rewards.
Do not apply consequences.
Do not change PF2E resolution.
Do not change Hard Correction logic.
Do not change pressure math.
Do not automatically finalize rounds.
Do not automatically complete during render/state preparation.
Do not expose completion controls to players.

## Smoke tests

Add smoke coverage for helper, runner action, and template wiring.

Recommended new files:

- `scripts/helpers/travel-v2-session-event-completion.smoke.js`
- `scripts/dev/run-travel-v2-session-event-completion-smoke.mjs`
- `scripts/apps/travel-event-runner-v2-event-completion.smoke.js`
- `scripts/dev/run-travel-event-runner-v2-event-completion-smoke.mjs`

Update:

- `scripts/apps/travel-event-runner-v2-preview-panel.smoke.js`
- `scripts/apps/travel-event-runner-v2-preview-template.smoke.js`
- `scripts/dev/run-travel-v2-smoke.mjs`

Smoke coverage should include:

1. Helper exports version and function.
2. Missing/null session blocks.
3. Not-ready event blocks without mutation.
4. Already completed session blocks.
5. Ready event completes and returns cloned session.
6. Completed clone has `status: "completed"` and a completed timestamp.
7. Completion record/summary exists and includes finalized/total round counts.
8. Original session is not mutated.
9. Duplicate completion blocks and does not append duplicate records.
10. Runner update helper updates session only on successful completion.
11. Runner app stores success/blocked result in UI state.
12. Template includes GM-only complete control with `data-arcflight-travel-v2-event-complete`.
13. Complete control is disabled when readiness is blocked and enabled when ready.
14. Template shows completed state after completion.
15. State preparation does not complete the event automatically.
16. No chat/socket/actor/item/player-card side effects.
17. Aggregate `run-travel-v2-smoke.mjs` includes new smoke suites.

## Acceptance checks

Run:

```bash
node --check scripts/helpers/travel-v2-session-event-completion.js
node --check scripts/helpers/travel-v2-session-event-completion.smoke.js
node --check scripts/dev/run-travel-v2-session-event-completion-smoke.mjs
node --check scripts/apps/travel-event-runner.js
node --check scripts/apps/travel-event-runner-v2-event-completion.smoke.js
node --check scripts/dev/run-travel-event-runner-v2-event-completion-smoke.mjs
node --check scripts/apps/travel-event-runner-v2-preview-panel.smoke.js
node --check scripts/apps/travel-event-runner-v2-preview-template.smoke.js

node scripts/dev/run-travel-v2-session-event-completion-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-event-completion-smoke.mjs
node scripts/dev/run-travel-v2-event-completion-readiness-smoke.mjs
node scripts/dev/run-travel-v2-session-round-finalization-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-round-finalization-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Also run existing pressure/correction suites:

```bash
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-pressure-correction-smoke.mjs
```

## Expected result

Phase 5G closes Phase 5 by allowing a GM to complete a ready Travel v2 runner session locally. It remains safe and session-local: no actor/item mutation, no sockets, no chat, no rewards, no fortune, no scars, no consequences, and no player-facing controls.
