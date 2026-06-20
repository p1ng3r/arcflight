# Codex Task: Phase 5F — Travel v2 event completion readiness summary

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-5f-event-completion-readiness-summary`

## Context

Phase 5A planned Travel v2 round resolution.

Phase 5B added the read-only round finalization state model:

- `scripts/helpers/travel-v2-round-finalization-state.js`

Phase 5C added the session-local round finalization helper:

- `scripts/helpers/travel-v2-session-round-finalization.js`

Phase 5D wired the GM runner internal finalization action path:

- `scripts/apps/travel-event-runner.js`
- `prepareTravelV2RoundFinalizationRunnerUpdate(...)`
- `ArcflightTravelEventRunner#finalizeTravelV2Round(...)`

Phase 5E added visible GM-only finalize controls and feedback:

- `templates/apps/travel-event-runner.hbs`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`

Phase 5F should add a conservative, read-only event completion readiness summary.

Do not complete the event yet. Actual completion and reward/consequence handoff are later.

## Goal

Provide a GM-facing summary that tells the runner whether the Travel v2 event is ready for completion after all required round finalization work is done.

This is a readiness model and display only.

No event completion button.
No event completion action.
No fortune/scar/reward/consequence application.
No actor/item/session completion mutation.

## Suggested helper

Add a new read-only helper:

- `scripts/helpers/travel-v2-event-completion-readiness.js`

Exports:

```js
export const TRAVEL_V2_EVENT_COMPLETION_READINESS_VERSION = 1;
export function prepareTravelV2EventCompletionReadiness(session, options = {}) { ... }
```

Recommended result shape:

```js
{
  version,
  hasSession,
  status,
  lifecycleState,
  isCompleted,
  canCompleteEvent,
  eventReady,
  blockedReasons,
  eventRoundCount,
  finalizedRoundCount,
  pendingRoundCount,
  currentRoundIndex,
  currentRoundNumber,
  finalRoundIndex,
  finalRoundNumber,
  finalizedRounds,
  pendingRounds,
  latestFinalizationRecord,
  effectiveOutcomeSummary,
  title,
  summaryText,
  footerText,
  nextStepText
}
```

Definitions:

- `hasSession`: true only for a usable runner session object.
- `isCompleted`: true when the session is already completed.
- `eventRoundCount`: number of rounds in `session.event.rounds`.
- `finalizedRounds`: safe cloned summary of finalized round records matching event rounds.
- `pendingRounds`: rounds that still need finalization.
- `eventReady` / `canCompleteEvent`: true only when:
  - there is a usable session.
  - session is not already completed.
  - event has at least one round.
  - every event round has a matching finalization record by `roundIndex` and `roundNumber` when possible.
  - the final round is finalized.
- `blockedReasons`: explain why not ready.

Recommended blocked reasons:

```text
No active Travel v2 runner session.
Travel v2 runner session is already completed.
Travel v2 event has no rounds.
Travel v2 event has pending round finalizations.
Final Travel v2 round is not finalized.
```

Recommended ready text:

```text
All Travel v2 rounds are finalized. Event completion handoff is ready for a later step.
```

Recommended not-ready text:

```text
Finalize all Travel v2 rounds before event completion.
```

## Matching finalization records

Finalization records live under:

```js
session.travelV2RoundResolutions.records
```

Use defensive access:

- support missing container.
- support array container only if existing helpers already support it.
- do not mutate records.
- clone record summaries.

A finalized record should match a round using:

1. exact `roundIndex` match when the round index is known.
2. exact `roundNumber` match when available.
3. preferably both when both exist.

Avoid guessing too aggressively. If ambiguous, treat as pending and provide a blocked reason.

## App/model integration

Surface readiness summary in the GM runner app state and/or preview panel state.

Likely files:

- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `templates/apps/travel-event-runner.hbs`
- `styles/arcflight.css`

Recommended model field:

```js
travelV2EventCompletionReadiness: prepareTravelV2EventCompletionReadiness(session)
```

Do not call any finalization helper from this state preparation.
Do not call any event completion helper from this state preparation.

## GM-facing display

Add a compact GM-only readiness summary near the Phase 5E finalization block.

It should show:

- finalized rounds count.
- total event rounds.
- pending rounds count.
- readiness state.
- next step text.

Examples:

```text
Event Completion Readiness
2 / 3 rounds finalized. 1 round pending.
Finalize all Travel v2 rounds before event completion.
```

Ready example:

```text
Event Completion Readiness
3 / 3 rounds finalized. Completion handoff is ready.
All Travel v2 rounds are finalized. Event completion handoff is ready for a later step.
```

Completed example:

```text
Event Completion Readiness
Travel v2 runner session is already completed.
```

Do not add a completion button.
Do not add markup like:

```hbs
data-arcflight-travel-v2-event-complete
```

or similar.

## Smoke tests

Add smoke tests for the helper and app/template integration.

Recommended new files:

- `scripts/helpers/travel-v2-event-completion-readiness.smoke.js`
- `scripts/dev/run-travel-v2-event-completion-readiness-smoke.mjs`

Update if appropriate:

- `scripts/apps/travel-event-runner-v2-preview-panel.smoke.js`
- `scripts/apps/travel-event-runner-v2-preview-template.smoke.js`
- `scripts/dev/run-travel-v2-smoke.mjs`

Smoke coverage should include:

1. Helper exports version and function.
2. Null/missing session returns blocked, not ready, no throw.
3. Completed session returns blocked, not ready.
4. Event with no rounds returns blocked, not ready.
5. Event with no finalization records returns pending all rounds.
6. Event with some finalized rounds returns not ready and lists pending rounds.
7. Event with all rounds finalized returns eventReady/canCompleteEvent true.
8. Final round not finalized blocks even if earlier rounds are finalized.
9. Matching works by roundIndex and roundNumber.
10. Ambiguous/mismatched records do not incorrectly mark ready.
11. Returned records/round summaries are cloned and input session is not mutated.
12. Preview panel exposes readiness summary.
13. Template renders readiness text/counts.
14. Template does not include event completion controls/selectors.
15. State preparation does not call finalization or completion helpers.
16. No chat/socket/actor/item/player-card side effects are called.
17. Aggregate `run-travel-v2-smoke.mjs` includes the new helper smoke suite.

## Hard boundaries

Do not complete the event.
Do not add event completion controls.
Do not add event completion selector markup.
Do not award fortune.
Do not apply scars.
Do not mutate actors.
Do not mutate items.
Do not emit sockets.
Do not send chat.
Do not touch player station cards.
Do not change PF2E resolution.
Do not change Hard Correction logic.
Do not change pressure math.
Do not automatically finalize during render/state preparation.
Do not expose completion controls to players.

## Acceptance checks

Run:

```bash
node --check scripts/helpers/travel-v2-event-completion-readiness.js
node --check scripts/helpers/travel-v2-event-completion-readiness.smoke.js
node --check scripts/dev/run-travel-v2-event-completion-readiness-smoke.mjs
node --check scripts/apps/travel-event-runner-v2-preview-panel.smoke.js
node --check scripts/apps/travel-event-runner-v2-preview-template.smoke.js
node scripts/dev/run-travel-v2-event-completion-readiness-smoke.mjs
node scripts/dev/run-travel-v2-round-finalization-state-smoke.mjs
node scripts/dev/run-travel-v2-session-round-finalization-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-round-finalization-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Also run existing related runner pressure/finalization suites:

```bash
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-pressure-correction-smoke.mjs
```

## Expected result

Phase 5F adds a read-only event completion readiness helper and GM runner readiness summary. It tells the GM whether the event is ready for a later completion handoff, but it does not complete the event and does not apply fortune, scars, rewards, consequences, chat, sockets, actors, items, or player-facing controls.
