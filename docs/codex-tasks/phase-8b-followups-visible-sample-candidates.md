# Codex Task: Phase 8B — Follow-up visibility and sample candidates fix

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-8b-followups-visible-sample-candidates`

## Why this fix exists

After Phase 8 merged, Foundry testing first showed the GM could not find the expected follow-up workflow. Further testing on PR #262 showed the UI header now renders, but the workflow is still blocked because the completed live runner session is missing the specific completion/package fields expected by the new outcome package helper.

## New Foundry diagnostics

From live Foundry console on PR #262:

```text
Runner class: ArcflightTravelEventRunner
Event: The Lantern in the Static
Event key: lantern-in-the-static
Completed at: 2026-06-20T23:46:04.738Z
Current round index: 2
Session keys include:
  appliedEffects
  completedAt
  currentRoundIndex
  event
  focusEffectRecords
  key
  name
  notes
  npcStationControllers
  playerMissionBoardRollDetails
  pressure
  reactionPrompts
  roundPhase
  roundResults
  ship
  stabilizeResolutionRecords
  startedAt
  stationAssignments
  stationFocus
  status
  summary
  updatedAt
  version
Session keys do NOT include:
  travelV2EventCompletion
  travelV2RoundResolutions
  travelV2PressureApplications
  completionSummary
  eventCompletion
```

The visible Foundry UI says:

```text
Completed Travel v2 runner session is missing its completion summary.
Cannot Apply Outcome
Travel v2 event outcome package is required.
End-of-Event Follow-Ups
No end-of-event follow-ups are pending for this outcome.
```

So the immediate problem is not that the UI markup is missing. The problem is that the outcome package helper expects `session.travelV2EventCompletion`, `session.travelV2RoundResolutions`, and related newer fields, while the real live runner session currently contains older/session-local fields like `summary` and `roundResults`.

## Required fix

Make the Travel v2 outcome package and follow-up path understand the actual live runner session shape, especially early-ended/completed sessions.

### 1. Completion summary compatibility

Do not require only `session.travelV2EventCompletion` if the live completed runner session has usable completion data under `session.summary` and/or `session.roundResults`.

Add a normalization layer that can derive a completion record from the live session shape:

```text
status/completedAt/summary/roundResults
```

Expected outcome: the event outcome package should no longer block with:

```text
Completed Travel v2 runner session is missing its completion summary.
```

when the session is already completed and has summary/roundResults data.

### 2. Round outcome compatibility

`prepareTravelV2EventOutcomePackage` currently needs round finalization records. It must also support the real runner session’s `roundResults` shape if `travelV2RoundResolutions` is absent.

Derive the selected/effective outcome from the best available live round result data.

### 3. Follow-up candidates should populate after outcome package can prepare

Once the outcome package can prepare, feed final-outcome candidates into the follow-up panel.

For The Lantern in the Static, visible candidate cards should appear for the selected outcome.

### 4. Critical Success candidate coverage

The user’s earlier real run ended as Critical Success / Lantern Rescued Cleanly. The sample event should produce meaningful follow-up candidates for that path too, not only mixed/failure.

Add explicit candidates to criticalSuccess, such as:

```text
Fortune Candidate: True Bearing Remembered
Reward Candidate: Rescued Lantern Flame
```

### 5. Empty state clarity

If cards still cannot load, the follow-up section should distinguish:

```text
No candidates exist for this outcome.
```

from:

```text
Follow-up candidates cannot load because the event outcome package is blocked.
```

## Boundaries

Do not:

- create items.
- create active effects.
- create journals.
- send chat messages.
- emit sockets.
- auto-apply reward/scar/consequence results without GM approval.
- change pressure math.
- change Travel v2 scoring unless required to correctly read existing live session results.

Do:

- keep everything GM-reviewed.
- keep candidates visible.
- keep status actions safe.
- keep follow-up records deduped.
- keep smoke tests deterministic.

## Smoke tests

Add/update tests proving:

1. A completed live-style session with `summary` and `roundResults`, but without `travelV2EventCompletion`, can prepare an outcome package.
2. A completed live-style session without `travelV2RoundResolutions` can derive final outcome from `roundResults`.
3. The exact live failure shape from Foundry no longer shows `Completed Travel v2 runner session is missing its completion summary`.
4. The follow-up section reports package-blocked vs no-candidates clearly.
5. Critical Success / Lantern Rescued Cleanly has visible follow-up candidates.
6. Mixed/failure candidate extraction still works.
7. After actor application, follow-up records persist under ship flags.
8. Keep/Resolve/Dismiss/GM note updates work after persistence.
9. Re-rendering does not duplicate records.
10. No item/effect/journal/chat/socket side effects occur.

## Acceptance checks

Run:

```bash
node --check data/travel-events/sample-travel-v2-events.js
node --check scripts/helpers/travel-v2-event-outcome-package.js
node --check scripts/helpers/travel-v2-followups.js
node --check scripts/helpers/travel-v2-actor-application-bridge.js
node --check scripts/apps/travel-event-runner-v2-preview-panel.js
node --check scripts/apps/travel-event-runner.js
node scripts/dev/run-travel-v2-followups-smoke.mjs
node scripts/dev/run-travel-v2-sample-event-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Add node checks for any new/changed smoke or helper files.

## Expected Foundry result

A GM completes or early-ends `The Lantern in the Static` and can visibly find:

```text
End-of-Event Follow-Ups
```

The Event Outcome Package should prepare instead of blocking on missing completion summary.

The follow-up section should show cards for the selected final outcome, or show a precise package-blocked recovery message.

After **Apply Approved Changes to Ship**, cards persist to the ship actor. The GM can add notes and mark cards kept, resolved, or dismissed.
