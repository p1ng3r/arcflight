# Codex Task: Phase 4F — Travel v2 pressure corrective patch

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-4f-correction-plan`

## Goal

Add a conservative **session-local corrective patch** for mistaken Travel v2 pressure application.

This phase should let the GM correct one already-applied current-round Travel v2 pressure outcome by replacing it with a different outcome on a cloned runner session, while preserving history with a correction record.

It must remain GM-only and session-local.

## Current foundation

Phase 4B readiness state:

- `scripts/helpers/travel-v2-pressure-application-state.js`

Phase 4C session-only application helper:

- `scripts/helpers/travel-v2-session-pressure-application.js`

Phase 4D internal GM runner action path:

- `scripts/apps/travel-event-runner.js`

Phase 4E visible GM preview-panel controls:

- `templates/apps/travel-event-runner.hbs`
- `scripts/apps/travel-event-runner-v2-preview-panel.js`
- `scripts/apps/travel-event-runner-v2-preview-consumer.js`

## Add

Add a small helper:

- `scripts/helpers/travel-v2-pressure-correction.js`
- `scripts/helpers/travel-v2-pressure-correction.smoke.js`
- `scripts/dev/run-travel-v2-pressure-correction-smoke.mjs`

Update aggregate smoke runner:

- `scripts/dev/run-travel-v2-smoke.mjs`

Optionally add a short docs note:

- `docs/travel-v2/phase-4f-pressure-correction.md`

Only add UI or app wiring if it is very small and strictly GM/session-local. Prefer no visible correction button in this PR unless the helper and smoke tests are already clean.

## Required exports

From `scripts/helpers/travel-v2-pressure-correction.js` export:

```js
export const TRAVEL_V2_PRESSURE_CORRECTION_VERSION = 1;
export function correctTravelV2PressureApplicationOnRunnerSession(session, options = {}) {}
export default correctTravelV2PressureApplicationOnRunnerSession;
```

## Correction model

This must be a conservative corrective replacement, not a silent history erase.

The helper should:

1. Treat input `session` as immutable.
2. Require that the current round already has an application record.
3. Require a corrected outcome key different from the original applied outcome.
4. Start from a clone of the session.
5. Reverse only the pressure deltas from the original application if that can be done safely from the stored application record.
6. Apply the corrected outcome using existing Phase 4C/pressure helpers.
7. Preserve the original application record.
8. Append a correction record.
9. Replace or mark the effective current-round application record so duplicate guards understand the corrected outcome.
10. Return an explicit result object.

Suggested result shape:

```js
{
  ok: true,
  corrected: true,
  session: correctedClonedSession,
  originalApplicationRecord,
  correctionRecord,
  correctedApplicationResult,
  selectedOutcomeKey,
  previousOutcomeKey
}
```

Blocked result shape:

```js
{
  ok: false,
  corrected: false,
  session,
  blockedReasons,
  error,
  selectedOutcomeKey,
  previousOutcomeKey
}
```

## Record requirements

Append correction records under a clear session-local container such as:

```js
session.travelV2PressureCorrections = {
  records: [correctionRecord]
}
```

Each correction record should include:

- roundIndex
- roundNumber
- previousOutcomeKey
- selectedOutcomeKey / correctedOutcomeKey
- reason if provided
- createdAt or deterministic test timestamp from options
- helperVersion
- originalApplicationRecord snapshot
- pressureDeltaReversal summary
- correctedApplicationRecord snapshot if available

Do not delete the original application record.

## Safety requirements

Block correction if:

- there is no session
- there is no current round
- current round has no prior application record
- selected/corrected outcome is invalid
- selected/corrected outcome is the same as the prior applied outcome
- original application record does not include enough totals to reverse safely
- later-round correction would require broader history changes
- pressure would go below zero
- ship scar / hazard draw overflow reversal cannot be proven safe from stored data

For this patch, it is acceptable to support correction only for simple current-round pressure values where reversal can be proven safe.

## Pressure reversal guidance

Use the original application record's `totalsByPressureType` to subtract prior deltas from the cloned session pressure.

Then apply the corrected outcome through the existing session-only pressure application flow.

Do not directly mutate actor data.
Do not directly write Foundry documents.
Do not send chat.
Do not emit sockets.

## Optional GM app integration

If app integration stays tiny, add a pure runner update helper similar to Phase 4D, for example:

```js
prepareTravelV2PressureCorrectionRunnerUpdate(currentSession, options)
```

Do not add visible correction UI yet unless all helper tests pass and the button can be clearly disabled/blocked. UI can be Phase 4G.

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
Do not remove the original application record.
Do not silently erase history.
Do not add automatic correction during render.

## Smoke tests

Add smoke coverage for:

1. Version export is `1`.
2. Correction blocks when no application record exists.
3. Correction blocks when selected outcome is invalid.
4. Correction blocks when selected outcome equals prior outcome.
5. Simple current-round correction from `failure` to `mixed` succeeds.
6. Input session is not mutated.
7. Returned session is a different object.
8. Prior pressure deltas are reversed before corrected pressure is applied.
9. Original application record is preserved.
10. Correction record is appended.
11. Duplicate guards recognize the corrected/effective outcome.
12. Correction blocks if reversal would push pressure below zero.
13. No chat/socket/actor side effects are called.

## Acceptance checks

Run:

```bash
node --check scripts/helpers/travel-v2-pressure-correction.js
node --check scripts/helpers/travel-v2-pressure-correction.smoke.js
node --check scripts/dev/run-travel-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-pressure-correction-smoke.mjs
node scripts/dev/run-travel-v2-session-pressure-application-smoke.mjs
node scripts/dev/run-travel-event-runner-v2-pressure-application-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

If app integration files are changed, also run the appropriate `node --check` for those files.

## Expected result

A safe, session-local Travel v2 pressure correction helper exists. It can correct simple current-round mistaken outcome applications without actor, socket, chat, or player-flow side effects, and it preserves a correction trail instead of erasing history.
