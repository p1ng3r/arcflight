# Codex Task: Phase 4D — GM runner session pressure action wiring

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-4d-gm-runner-wire`

## Goal

Wire the Phase 4C session-only pressure application helper into the GM Travel Event Runner app as an internal GM-only action path.

This phase may update the local runner session and rerender the GM runner after an explicit GM action, but it must not add visible UI controls yet. The visible panel button/control comes later in Phase 4E.

## Current foundation

Phase 4A plan:

- `docs/travel-v2/phase-4-pressure-application-plan.md`

Phase 4B read-only application readiness state:

- `scripts/helpers/travel-v2-pressure-application-state.js`

Phase 4C session-only pressure application helper:

- `scripts/helpers/travel-v2-session-pressure-application.js`
- `scripts/helpers/travel-v2-session-pressure-application.smoke.js`
- `scripts/dev/run-travel-v2-session-pressure-application-smoke.mjs`

GM runner files to inspect:

- `scripts/apps/travel-event-runner.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `templates/apps/travel-event-runner.hbs` only for understanding current data attributes; do not edit it in this phase unless absolutely unavoidable, and do not add buttons.

## Add / modify

Primary expected edit:

- `scripts/apps/travel-event-runner.js`

Likely helper/smoke additions if useful:

- `scripts/apps/travel-event-runner-v2-pressure-application.smoke.js`
- `scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs`

Optional aggregate smoke wiring:

- `scripts/dev/run-travel-v2-smoke.mjs`

only if this remains a small import + suite-list change.

## Required behavior

Add a GM-runner action path that can call:

```js
applyTravelV2PressureToRunnerSession(session, { selectedOutcomeKey })
```

from `scripts/helpers/travel-v2-session-pressure-application.js`.

The action path should:

1. Be GM-runner-only.
2. Require an explicit action/event, not run automatically during render or state preparation.
3. Read a selected outcome key from action data when available.
4. Default to `mixed` only if no valid selected outcome key is supplied, matching Phase 4B/4C helpers.
5. Replace the app's local runner session with the cloned updated session returned by the helper when `result.ok && result.applied`.
6. Rerender the GM runner after successful local session update.
7. Store or expose the most recent result in app-local UI state if the existing app style supports this cleanly.
8. Leave blocked results non-destructive and rerender only if needed to show local feedback later.

## Hard boundaries

Do not edit player station card code.
Do not edit socket code.
Do not send chat output.
Do not mutate Foundry actors.
Do not mutate Foundry items.
Do not write to PF2E actor data.
Do not add a visible button/control in the Handlebars template.
Do not add CSS.
Do not change pressure math.
Do not bypass `prepareTravelV2PressureApplicationState` or `applyTravelV2PressureToRunnerSession`.
Do not change Hard Correction logic.
Do not change station assignment logic.
Do not change PF2E statistic resolution.
Do not change player roll request flow.
Do not change saved session format beyond the Phase 4C session-level application record produced by the helper.

## Suggested implementation notes

Look for the runner's existing action delegation pattern in `travel-event-runner.js`.

If there is already an action switch for `data-action`, add a new action branch with a clear internal action name such as:

```text
travel-v2-pressure-apply
```

Do not add the corresponding template button in this PR.

If there is no clean action delegation pattern, add a small private method on the runner app class, for example:

```js
async _onTravelV2PressureApply(event) {}
```

or a style-consistent equivalent.

The method should be callable by future Phase 4E template controls but not invoked automatically.

## Smoke tests

Add smoke coverage that does not require Foundry runtime. Prefer testing any extracted pure/action helper if the app class cannot be safely constructed in Node.

At minimum cover:

1. Successful helper result replaces local session with cloned updated session.
2. Input/app session pressure changes only after explicit handler call.
3. Blocked duplicate result does not replace session destructively.
4. Invalid selected outcome is blocked without mutation.
5. No chat/socket/actor functions are referenced or called by the new smoke-tested path.

If the app class cannot be instantiated cleanly in Node, extract a tiny pure helper such as:

```js
prepareTravelV2PressureApplicationRunnerUpdate(currentSession, options)
```

that returns:

```js
{
  result,
  nextSession,
  shouldUpdateSession,
  shouldRerender
}
```

Then have the app handler call that helper.

## Acceptance checks

Run:

```bash
node --check scripts/apps/travel-event-runner.js
node --check scripts/helpers/travel-v2-session-pressure-application.js
node --check scripts/helpers/travel-v2-pressure-application-state.js
node scripts/dev/run-travel-v2-session-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-pressure-application-state-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

If adding a new app smoke runner, also run:

```bash
node --check scripts/apps/travel-event-runner-v2-pressure-application.smoke.js
node --check scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
```

## Expected result

The GM Travel Event Runner has an internal, explicit, GM-only path ready to apply a selected Travel v2 pressure outcome to the local runner session via the Phase 4C helper.

No visible UI control is added yet.
No player-facing or actor-facing side effects occur.
