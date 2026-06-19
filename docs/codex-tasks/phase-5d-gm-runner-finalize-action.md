# Codex Task: Phase 5D — Travel v2 GM runner internal finalize action path

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-5d-gm-runner-finalize-action`

## Context

Phase 5A planned Travel v2 round resolution.

Phase 5B added the read-only round finalization state model:

- `scripts/helpers/travel-v2-round-finalization-state.js`

Phase 5C added the session-local round finalization helper:

- `scripts/helpers/travel-v2-session-round-finalization.js`

Phase 5D should wire the Phase 5C helper into the GM runner app’s internal action path, similar to how Phase 4D wired pressure application internally before Phase 4E added visible controls.

Do not add visible finalize controls yet. Visible buttons/feedback are Phase 5E.

## Goal

Add an internal GM runner action/update path that can finalize the current Travel v2 round using the Phase 5C helper.

This should be callable by later UI controls but should not add a visible finalize button yet.

## Primary file

Update:

- `scripts/apps/travel-event-runner.js`

Likely add/import:

```js
import { finalizeTravelV2RoundOnRunnerSession } from "../helpers/travel-v2-session-round-finalization.js";
```

## Required exported helper

Add an exported helper following the existing pressure application/correction runner update style:

```js
export function prepareTravelV2RoundFinalizationRunnerUpdate(currentSession, options = {}) { ... }
```

Recommended result shape:

```js
{
  result,
  nextSession,
  shouldUpdateSession,
  shouldRerender
}
```

Rules:

- Call `finalizeTravelV2RoundOnRunnerSession(currentSession, options)`.
- `shouldUpdateSession` is true only when `result.ok === true` and `result.finalized === true` and `result.session` exists.
- `nextSession` is `result.session` on success, otherwise the original `currentSession`.
- `shouldRerender` should match the conservative pattern used by pressure application/correction helpers.
- Do not mutate `currentSession` directly.

## Runner app wiring

Add an internal instance method or action handler path in `TravelEventRunner` for finalization, similar to pressure application/correction methods.

Recommended behavior:

- Use the new exported update helper.
- On success:
  - update `this.session` with `update.nextSession`.
  - preserve/update `selectedSessionKey` from the session key when present.
  - store the helper result in UI state for later Phase 5E feedback, e.g. `travelV2RoundFinalizationResult`.
  - set a conservative GM status message such as `Finalized Travel v2 round X.`
  - rerender.
- On blocked result:
  - store the blocked result in UI state.
  - set `statusMessage` to the first blocked reason or helper error.
  - do not mutate the session.

## UI state

Add a default UI state field:

```js
travelV2RoundFinalizationResult: null
```

Pass this through app state / preview consumer only if existing patterns make it natural and safe.

Do not add visible finalize controls or template buttons in this phase.

## Action selector boundary

If an action selector is added, keep it internal and inert unless a future Phase 5E template button uses it.

Do not add markup like:

```hbs
<button ... data-arcflight-travel-v2-round-finalize>
```

in Phase 5D.

If a selector is added to the event listener map for future use, smoke tests must prove no automatic finalization happens during render/state preparation.

## Smoke tests

Add or update smoke tests for app-level internal finalization wiring.

Recommended new file:

- `scripts/apps/travel-event-runner-v2-round-finalization.smoke.js`
- `scripts/dev/run-travel-event-runner-v2-round-finalization-smoke.mjs`

Wire the new runner into:

- `scripts/dev/run-travel-v2-smoke.mjs`

Smoke coverage should include:

1. `prepareTravelV2RoundFinalizationRunnerUpdate` is exported.
2. Missing/null session blocks without throwing.
3. Session with current round but no pressure application blocks and does not update session.
4. Session with effective pressure application returns `shouldUpdateSession: true` and a cloned finalized session.
5. Duplicate finalization blocks and does not append another record.
6. Completed session blocks.
7. Corrected pressure outcome can finalize and preserves corrected effective outcome.
8. Returned session contains exactly one appended `travelV2RoundResolutions.records` record on success.
9. Input session is not mutated.
10. No actor/item/socket/chat/player-card side effects are called.
11. Runner state preparation / render state does not automatically finalize.
12. No visible finalize controls are added to the Handlebars template yet.
13. Aggregate `run-travel-v2-smoke.mjs` includes the new smoke runner.

## Files to inspect

Before implementing, inspect:

- `scripts/apps/travel-event-runner.js`
- `scripts/apps/travel-event-runner-v2-pressure-application.smoke.js`
- `scripts/apps/travel-event-runner-v2-pressure-correction.smoke.js`
- `scripts/helpers/travel-v2-session-round-finalization.js`
- `scripts/helpers/travel-v2-round-finalization-state.js`
- `templates/apps/travel-event-runner.hbs`

## Hard boundaries

Do not add visible finalize controls.
Do not add finalize template markup.
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
node --check scripts/apps/travel-event-runner.js
node --check scripts/apps/travel-event-runner-v2-round-finalization.smoke.js
node --check scripts/dev/run-travel-event-runner-v2-round-finalization-smoke.mjs
node scripts/dev/run-travel-v2-round-finalization-state-smoke.mjs
node scripts/dev/run-travel-v2-session-round-finalization-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-round-finalization-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Also run existing related runner pressure suites:

```bash
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-pressure-correction-smoke.mjs
```

## Expected result

Phase 5D adds the internal GM runner finalization action/update path and smoke coverage. It prepares the app for Phase 5E visible finalize controls without exposing a visible button yet.
