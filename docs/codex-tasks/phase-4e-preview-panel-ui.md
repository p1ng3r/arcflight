# Codex Task: Phase 4E — Travel v2 preview panel GM UI

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-4e-preview-panel-ui`

## Goal

Add visible GM-only pressure application controls to the existing Travel v2 pressure preview panel.

This phase should connect template controls to the internal GM runner action path added in Phase 4D.

The controls must remain session-local and GM-only. They must not mutate actors, emit sockets, send chat, or touch player-facing station flows.

## Current foundation

Phase 4A plan:

- `docs/travel-v2/phase-4-pressure-application-plan.md`

Phase 4B application readiness state:

- `scripts/helpers/travel-v2-pressure-application-state.js`

Phase 4C session-only pressure application helper:

- `scripts/helpers/travel-v2-session-pressure-application.js`

Phase 4D GM runner internal action path:

- `scripts/apps/travel-event-runner.js`
  - `prepareTravelV2PressureApplicationRunnerUpdate(currentSession, options)`
  - internal click selector / handler for `data-arcflight-travel-v2-pressure-apply`
  - stores `uiState.travelV2PressureApplicationResult`

Existing preview panel pieces:

- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- `templates/apps/travel-event-runner.hbs`
- `styles/arcflight.css`

## Required behavior

Add a visible control in the GM Travel v2 pressure preview panel for each applicable outcome row.

The control should:

1. Use the existing Phase 4D handler by adding the correct data attribute:

```hbs
data-arcflight-travel-v2-pressure-apply="{{outcomeKey}}"
```

or the equivalent dataset shape that `getRunnerPressureSelectedOutcomeKey` already understands.

2. Be visible only in the GM runner preview panel.
3. Be clearly labeled, for example:

```text
Apply This Outcome
```

or:

```text
Apply {{outcomeLabel}}
```

4. Be disabled when application is not allowed.
5. Show a clear applied/blocked feedback area based on app-local state when available.
6. Preserve the existing pressure preview rows and chips.
7. Keep duplicate application blocked after a successful apply.

## State/model requirements

Expose enough state to the template to render controls safely.

Use existing helpers instead of duplicating pressure math:

- `prepareTravelV2PressureApplicationState`
- `prepareTravelEventRunnerV2PreviewPanelState`
- existing `travelV2PreviewPanel.rows`
- existing `uiState.travelV2PressureApplicationResult`

Possible implementation approaches:

- Add an application section to `travelV2PreviewPanel` rows that marks rows as actionable/disabled.
- Or add a sibling `travelV2PressureApplication` model to the app state and let the template read it.
- Or combine both if that fits the existing app-state style.

The final template should not need to calculate pressure or business logic. It should only render prepared state and data attributes.

## Feedback expectations

After a successful application, the panel should indicate that the current round has already had Travel v2 pressure applied.

Suggested visible feedback:

```text
Travel v2 pressure already applied for this round: Failure.
```

or:

```text
Applied Travel v2 pressure outcome: Failure.
```

For blocked application, show the blocked reason if `uiState.travelV2PressureApplicationResult` carries one.

Do not create chat messages.

## Hard boundaries

Do not mutate actors.
Do not mutate items.
Do not emit sockets.
Do not call player station card helpers.
Do not send chat output.
Do not change pressure math.
Do not bypass Phase 4B/4C/4D helpers.
Do not change Hard Correction logic.
Do not change station assignment logic.
Do not change PF2E statistic resolution.
Do not change player roll request flow.
Do not change player-facing card templates.
Do not add actor flag writes.

## Expected file changes

Likely:

- `templates/apps/travel-event-runner.hbs`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- `scripts/apps/travel-event-runner.js` only if needed to expose latest result in app state cleanly
- `styles/arcflight.css` only for small, focused button/status styling

Add or update smoke checks:

- `scripts/apps/travel-event-runner-v2-preview-template.smoke.js`
- `scripts/apps/travel-event-runner-v2-preview-panel.smoke.js`
- `scripts/apps/travel-event-runner-v2-pressure-application.smoke.js` if useful
- `scripts/dev/run-travel-v2-smoke.mjs` if adding a new smoke suite or existing suite additions require it

## Smoke-test requirements

At minimum, cover:

1. Template contains `data-arcflight-travel-v2-pressure-apply`.
2. Template renders an apply control inside the Travel v2 preview panel.
3. Template still renders preview rows/chips.
4. Template includes disabled/applied state markers when the model says application is blocked or already applied.
5. Panel state marks current-round already-applied cases as non-actionable.
6. Panel/app state carries latest success or blocked result feedback.
7. Existing template smoke markers from Phase 3I still pass.
8. Existing Phase 4B/4C/4D smoke checks still pass.

## Acceptance checks

Run:

```bash
node --check scripts/apps/travel-event-runner.js
node --check scripts/apps/travel-event-runner-v2-preview-panel.js
node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
node --check scripts/apps/travel-event-runner-v2-preview-template.smoke.js
node --check scripts/apps/travel-event-runner-v2-preview-panel.smoke.js
node --check scripts/apps/travel-event-runner-v2-pressure-application.smoke.js
node scripts/dev/run-travel-event-runner-v2-preview-template-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-session-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-pressure-application-state-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

If any file in the above list does not exist before this phase and remains unnecessary, do not create it just to satisfy the command list. But all newly added/changed smoke files must have `node --check` and runtime smoke coverage.

## Expected result

The GM preview panel now has visible, disabled-aware controls for applying a selected Travel v2 pressure outcome to the local runner session via the Phase 4D internal handler.

No actor, socket, chat, or player-flow side effects are added.
