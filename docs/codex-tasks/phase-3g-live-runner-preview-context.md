# Codex Task: Phase 3G — Live Runner Preview Context

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-3g-live-runner-preview-context`

## Goal

Wire the existing app-level Travel v2 preview consumer into the live GM Travel Event Runner app context.

The live runner app should receive `state.travelV2Preview` and `state.travelV2PreviewPanel`, but this task must not render the panel yet and must not apply pressure.

## Files to inspect

- `scripts/apps/travel-event-runner.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.smoke.js`

## Required change

In `scripts/apps/travel-event-runner.js`:

1. Import `prepareTravelEventRunnerAppStateWithTravelV2Preview` from:

   ```js
   "./travel-event-runner-v2-preview-consumer.js"
   ```

2. In `ArcflightTravelEventRunner._prepareContext`, replace only the local state construction block:

   ```js
   const state = prepareTravelEventRunnerState(this.session, { selectedEventId: this.selectedEventId, selectedSessionKey: this.selectedSessionKey, actor: targetActor });
   state.effectApplication = prepareTravelEventEffectApplicationState(this.session, targetActor);
   state.currentSessionCollapsed = this.uiState.currentSessionCollapsed;
   state.sessionActionsExpanded = this.uiState.sessionActionsExpanded;
   state.compactRunner = this.uiState.compactRunner;
   state.compactRoundLabel = state.hasSession ? (state.isCompleted ? "Completed" : `Round ${state.currentRoundNumber}`) : "No active round";
   ```

   with:

   ```js
   const state = prepareTravelEventRunnerAppStateWithTravelV2Preview({
     session: this.session,
     selectedEventId: this.selectedEventId,
     selectedSessionKey: this.selectedSessionKey,
     actor: targetActor,
     uiState: this.uiState
   });
   ```

3. Keep `defaultSelectedEventId` using `prepareTravelEventRunnerState` unless there is a clean reason to change it.

4. Keep the existing imports from `../helpers/travel-event-runner.js` intact unless removing an import is clearly safe. Do not do broad import cleanup.

## Hard boundaries

Do not edit:

- templates
- `scripts/apps/travel-player-station-card.js`
- socket or player flow
- pressure application logic
- Hard Correction logic
- station assignment logic
- PF2E statistic resolution
- player roll requests
- station result persistence

Do not mutate runner session pressure.

## Acceptance checks

Run:

```bash
node --check scripts/apps/travel-event-runner.js
node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
node --check scripts/apps/travel-event-runner-v2-preview-consumer.smoke.js
node scripts/apps/travel-event-runner-v2-preview-consumer.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
```

## Expected result

The live runner app context now receives:

- `state.travelV2Preview`
- `state.travelV2PreviewPanel`

Nothing renders the panel yet. No pressure is applied.
