# Codex Task: Phase 5E — Travel v2 visible GM finalize controls and feedback

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-5e-visible-gm-finalize-controls`

## Context

Phase 5A planned Travel v2 round resolution.

Phase 5B added the read-only round finalization state model:

- `scripts/helpers/travel-v2-round-finalization-state.js`

Phase 5C added the session-local round finalization helper:

- `scripts/helpers/travel-v2-session-round-finalization.js`

Phase 5D wired the helper into the GM runner app’s internal action path:

- `scripts/apps/travel-event-runner.js`
- `prepareTravelV2RoundFinalizationRunnerUpdate(...)`
- `ArcflightTravelEventRunner#finalizeTravelV2Round(...)`
- `uiState.travelV2RoundFinalizationResult`

Phase 5E should expose the internal 5D finalization path through visible GM-only runner controls and feedback.

Do not complete the event yet. That is a later phase.
Do not award fortune.
Do not apply scars.
Do not touch player station cards.

## Goal

Add visible GM-only controls in the Travel Event Runner for finalizing the current Travel v2 round.

The controls must use the internal Phase 5D action path and Phase 5B/5C state. They must not duplicate finalization logic.

## Files likely changed

Likely update:

- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- `templates/apps/travel-event-runner.hbs`
- `styles/arcflight.css`
- `scripts/apps/travel-event-runner-v2-round-finalization.smoke.js`
- `scripts/dev/run-travel-v2-smoke.mjs` if needed

Inspect existing Phase 4E and 4G control patterns before implementing:

- pressure apply button behavior.
- pressure correction button behavior.
- disabled button text/status patterns.
- GM-only display patterns.

## State preparation

The visible control should derive from `prepareTravelV2RoundFinalizationState(session, options)` or already-prepared equivalent state.

Add finalization state to the runner app/preview panel state where appropriate.

Recommended state fields for the template:

```js
travelV2RoundFinalizationState: {
  lifecycleState,
  canFinalize,
  blockedReasons,
  roundIndex,
  roundNumber,
  effectiveOutcomeKey,
  isFinalized,
  isEventCompleteReady,
  footerText
}
```

Also surface the most recent action result from:

```js
uiState.travelV2RoundFinalizationResult
```

Do not compute finalization by mutating session during state preparation.

## Visible control behavior

Add a GM-only finalize control in the current round / Travel v2 preview area.

Use the existing internal selector from Phase 5D:

```hbs
data-arcflight-travel-v2-round-finalize
```

Button behavior:

- Show only for GM / runner owner context consistent with existing GM controls.
- Enabled only when `canFinalize === true`.
- Disabled when blocked.
- Disabled after already finalized.
- Should clearly display why blocked, using `footerText` or first blocked reason.
- Should not be visible to player station cards.
- Should not appear in player-facing templates.

Suggested labels:

```text
Finalize Round
Round Finalized
Event Ready
Cannot Finalize
```

Do not add an event completion button yet.

## Feedback behavior

Show compact GM-only feedback in the runner after finalization attempts.

Success examples:

```text
Finalized Travel v2 round 2.
```

Blocked examples:

```text
Current Travel v2 round has no effective pressure application.
Current Travel v2 round is already finalized.
Travel v2 runner session is completed.
```

Use the result stored by the Phase 5D action path. Do not send chat.

## Event-complete-ready display

If the final round is finalized and the state is `event-complete-ready`, show GM-facing readiness text such as:

```text
Final event round finalized. Event completion will be handled in a later step.
```

Do not complete the event.
Do not award fortune.
Do not apply scars.

## Smoke tests

Update or add smoke coverage for visible controls.

Recommended new or extended files:

- `scripts/apps/travel-event-runner-v2-round-finalization.smoke.js`
- maybe `scripts/apps/travel-event-runner-v2-preview-panel.smoke.js`
- maybe `scripts/apps/travel-event-runner-v2-preview-template.smoke.js`

Smoke coverage should include:

1. Finalize button is present in the GM runner template state/HTML when current round can finalize.
2. Finalize button uses `data-arcflight-travel-v2-round-finalize`.
3. Finalize button is disabled when current round has no pressure application.
4. Finalize button is disabled after round is finalized.
5. Final round finalized state shows event-complete-ready/readiness text, not event completion action.
6. Blocked reasons or footer feedback appear for blocked states.
7. Success feedback appears after internal finalize action result is present.
8. No finalize controls are added to player station card templates.
9. Rendering/state preparation does not call `finalizeTravelV2RoundOnRunnerSession` or `finalizeTravelV2Round` automatically.
10. Clicking/dispatch wiring still uses the Phase 5D internal method/action path; no duplicate finalization logic in template/panel.
11. No chat/socket/actor/item/player-card side effects are called.
12. Aggregate `run-travel-v2-smoke.mjs` still passes.

## Hard boundaries

Do not complete the event.
Do not add event completion controls.
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
Do not expose controls to players.

## Acceptance checks

Run:

```bash
node --check scripts/apps/travel-event-runner.js
node --check scripts/apps/travel-event-runner-v2-round-finalization.smoke.js
node --check scripts/apps/travel-event-runner-v2-preview-panel.smoke.js
node --check scripts/apps/travel-event-runner-v2-preview-template.smoke.js
node scripts/dev/run-travel-event-runner-v2-round-finalization-smoke.mjs
node scripts/dev/run-travel-v2-round-finalization-state-smoke.mjs
node scripts/dev/run-travel-v2-session-round-finalization-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Also run existing related runner pressure suites:

```bash
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-pressure-correction-smoke.mjs
```

## Expected result

Phase 5E exposes a visible GM-only `Finalize Round` control and clear feedback in the Travel Event Runner. It uses the internal Phase 5D path and remains strictly bounded: no event completion, fortune, scars, chat, sockets, actor/item mutation, or player-facing controls.
