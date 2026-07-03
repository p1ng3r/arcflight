# Codex Task: Phase 3H — Read-only Travel v2 Preview Panel UI

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-3h-preview-panel-ui`

## Goal

Render the existing read-only Travel v2 preview panel state in the live GM Travel Event Runner template.

The live runner context already exposes:

- `state.travelV2Preview`
- `state.travelV2PreviewPanel`

This task should make the GM preview panel visible in the runner UI, but must not apply pressure or add any player/socket flow.

## Files to inspect

- `templates/apps/travel-event-runner.hbs`
- `scripts/apps/travel-event-runner.js`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- existing stylesheet files that already style `arcflight-travel-runner-mvp__panel`, `arcflight-sheet__hint`, and runner UI classes

## Required UI change

In `templates/apps/travel-event-runner.hbs`, add a read-only Travel v2 pressure preview panel using `state.travelV2PreviewPanel`.

Recommended placement:

- Inside the `{{#if state.hasSession}}` block.
- Near the current round section, preferably after the current round header/vignette and before station cards.
- Keep it visible only when not in compact mode because the surrounding template already hides full runner panels in compact mode.

The panel should:

1. Check `state.travelV2PreviewPanel.available` before rendering outcome rows.
2. Show the panel title and subtitle.
3. Render each row in `state.travelV2PreviewPanel.rows`.
4. For each row, show:
   - `outcomeLabel`
   - `summaryText`
   - `tone` as a class hook only, not game logic
   - pressure chips from `pressureChips`, showing `displayAmount` and `label`
5. Show a safe fallback message if unavailable.
6. Show `footerText` as a clear read-only warning/hint.

Suggested class naming:

```hbs
arcflight-travel-runner-mvp__v2-preview
arcflight-travel-runner-mvp__v2-preview-row
arcflight-travel-runner-mvp__v2-preview-row--{{tone}}
arcflight-travel-runner-mvp__v2-preview-chips
arcflight-travel-runner-mvp__v2-preview-chip
```

If styles are needed, add only minimal CSS for layout/readability. Do not redesign the runner.

## Hard boundaries

Do not edit:

- pressure application logic
- socket or player flow
- `scripts/apps/travel-player-station-card.js`
- Hard Correction logic
- station assignment logic
- PF2E statistic resolution
- player roll requests
- station result persistence

Do not add clickable pressure-apply buttons.
Do not mutate runner session pressure.
Do not change saved session format.
Do not make the panel visible to players.
Do not add chat output.

## Acceptance checks

Run:

```bash
node --check scripts/apps/travel-event-runner.js
node --check scripts/apps/travel-event-runner-v2-preview-panel.js
node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
node scripts/apps/travel-event-runner-v2-preview-panel.smoke.js
node scripts/apps/travel-event-runner-v2-preview-consumer.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
```

Also inspect the diff and confirm it only touches the template, optional minimal CSS, and this task file.

## Expected result

The GM Travel Event Runner UI displays a read-only Travel v2 pressure preview panel showing outcome rows and pressure chips.

Nothing applies pressure yet.
