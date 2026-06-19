# Codex Task: Phase 4G — Travel v2 pressure correction UI and GM action path

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-4g-correction-ui`

## Goal

Expose the Phase 4F session-local pressure correction helper through the GM Travel Event Runner UI.

This should let a GM correct a mistaken already-applied Travel v2 pressure outcome for the current round, using the conservative helper from Phase 4F.

The feature must remain GM-only and session-local. It must not mutate Foundry actors/items, emit sockets, send chat, or touch player station card flow.

## Current foundation

Phase 4C application helper:

- `scripts/helpers/travel-v2-session-pressure-application.js`

Phase 4D internal GM apply action path:

- `scripts/apps/travel-event-runner.js`

Phase 4E visible GM apply controls:

- `templates/apps/travel-event-runner.hbs`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`

Phase 4F correction helper:

- `scripts/helpers/travel-v2-pressure-correction.js`
- `scripts/helpers/travel-v2-pressure-correction.smoke.js`
- `scripts/dev/run-travel-v2-pressure-correction-smoke.mjs`

## Add / update

Likely app/helper/template updates:

- `scripts/apps/travel-event-runner.js`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- `templates/apps/travel-event-runner.hbs`
- `styles/arcflight.css`

Add/update smoke coverage:

- `scripts/apps/travel-event-runner-v2-pressure-correction.smoke.js`
- `scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs`
- `scripts/apps/travel-event-runner-v2-preview-template.smoke.js`
- `scripts/apps/travel-event-runner-v2-preview-panel.smoke.js`
- `scripts/dev/run-travel-v2-smoke.mjs`

## Required behavior

Add a GM runner correction action path that:

1. Requires an explicit corrected outcome key.
2. Calls `correctTravelV2PressureApplicationOnRunnerSession(session, { correctedOutcomeKey })` from `scripts/helpers/travel-v2-pressure-correction.js`.
3. Replaces only the app-local runner session with the returned cloned session when `result.ok && result.corrected`.
4. Stores the latest correction result in app-local UI state for feedback.
5. Rerenders the GM runner after successful correction.
6. Does not run automatically during render/state preparation.
7. Does not call chat, sockets, actor update, item update, or player-card helpers.

Use a data attribute similar to the apply action, for example:

```hbs
data-arcflight-travel-v2-pressure-correct="{{outcomeKey}}"
```

or the smallest equivalent that fits the existing runner action pattern.

## UI behavior

When no pressure outcome has been applied yet:

- show normal Phase 4E apply controls.
- do not show correction controls.

When pressure has already been applied for the current round:

- keep apply controls disabled.
- show correction controls for other valid outcome rows only.
- do not show a correction control for the already-applied/effective outcome.
- label correction controls clearly, for example:

```text
Correct to This Outcome
```

or:

```text
Correct to Failure
```

When correction is blocked:

- show the blocked reason in the local feedback area.

When correction succeeds:

- show a clear session-local success message, for example:

```text
Corrected Travel v2 pressure outcome: Failure → Mixed.
```

Do not send chat.
Do not notify players.

## State/model requirements

Extend prepared panel/app state so the template does not perform business logic.

Rows should expose correction metadata such as:

- `canCorrectPressure`
- `pressureCorrectionDisabled`
- `pressureCorrectionBlockedReason`
- `pressureCorrectionLabel`
- `isEffectiveAppliedOutcome`

The panel/app state should also expose latest correction feedback from app-local UI state.

Keep the existing Phase 4E apply state intact.

## Safety requirements

Correction controls must be disabled/hidden when:

- there is no active session.
- there is no current round.
- no application has been made yet.
- the row is the effective already-applied outcome.
- the outcome row is invalid/unavailable.
- the Phase 4F correction helper would block.
- the session is completed.

Correction helper errors must remain non-destructive.

## Hard boundaries

Do not mutate actors.
Do not mutate items.
Do not emit sockets.
Do not send chat output.
Do not touch player station cards.
Do not change PF2E resolution.
Do not change Hard Correction logic.
Do not change station assignment logic.
Do not change core pressure math.
Do not remove original application records.
Do not silently erase history.
Do not add automatic correction during render.
Do not make correction player-facing.

## Smoke tests

Add smoke coverage for:

1. Version/check export if adding a new correction UI smoke module.
2. GM runner correction update replaces local session only on successful correction.
3. Missing corrected outcome blocks.
4. Invalid corrected outcome blocks.
5. Same/effective outcome correction is disabled or blocked.
6. Template contains `data-arcflight-travel-v2-pressure-correct`.
7. Correction controls appear only when current round already has an effective application record.
8. Apply controls remain disabled after application.
9. Correction feedback renders success and blocked states.
10. No chat/socket/actor side effects are called.
11. Existing Phase 4E apply UI smoke still passes.
12. Existing Phase 4F correction helper smoke still passes.

## Acceptance checks

Run:

```bash
node --check scripts/apps/travel-event-runner.js
node --check scripts/apps/travel-event-runner-v2-preview-panel.js
node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
node --check scripts/helpers/travel-v2-pressure-correction.js
node --check scripts/apps/travel-event-runner-v2-pressure-correction.smoke.js
node --check scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-preview-template-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

If a listed smoke file is not created because an existing smoke file is extended instead, run the relevant existing smoke runner and include that in the PR testing notes.

## Expected result

The GM Travel Event Runner has visible, disabled-aware correction controls for already-applied Travel v2 pressure outcomes. Corrections use the Phase 4F session-local helper, preserve correction history, and remain free of actor/socket/chat/player side effects.
