# Codex Task: Phase 6B — Foundry runner session sanity

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-6b-foundry-runner-session-sanity`

## Purpose

This is not a roadmap detour. This is a short sanity checkpoint inside the normal Phase 6 roadmap so the existing Travel v2 work can actually be clicked through in Foundry.

Phase 6 already added a completed-event outcome package and GM-reviewed session-local outcome application. Before moving to actor/item application bridges, make the GM-facing runner/session creation path obvious and diagnosable.

## Current situation

The Travel Event Runner has code paths for:

- selected published travel event
- Start Local Runner Session
- ship/PF2E vehicle selection through DialogV2
- local runner session creation through `startTravelEventRunnerFromPublishedEvent`
- session load/save/import/export

But the Foundry-facing UX may not make it obvious what a local runner session is or why a GM may not see one.

## Goal

Make it clear in Foundry how the GM gets from “no session” to an active Travel Event Runner session.

This PR should improve clarity and diagnostics only. It should not change the Travel v2 outcome pipeline.

## Scope

Do:

- Improve empty-state copy in the Travel Event Runner.
- Make the startup path obvious:
  - select a published finalized travel event
  - click Start Local Runner Session
  - choose a ship/PF2E vehicle
  - get a local runner session
- Add explicit diagnostic text for these blocked states:
  - no published finalized travel event exists
  - published event exists but is malformed/not finalized
  - no PF2E vehicle / Arcflight ship actor exists
  - DialogV2 unavailable
  - a session already exists and must be cleared/saved before starting another
- Add or improve a smoke test that confirms the template includes the start button and the relevant empty-state text.
- Add or improve a smoke test for launch-state/session-start preparation if one already exists.
- Keep terminology consistent: “local runner session” in user-facing copy.

Optional, only if low risk:

- Add a small helper that returns a GM-facing startup diagnostic object from the existing runner/library state. Keep it read-only.

## Hard boundaries

Do not create or modify actors.
Do not create or modify items.
Do not create journals/chat messages.
Do not emit sockets.
Do not change pressure/application/correction/finalization/completion/outcome package logic.
Do not add new reward/scar/fortune/consequence application logic.
Do not add a second runner implementation.
Do not add a separate alternate roadmap.

## Acceptance checks

Run:

```bash
node --check scripts/apps/travel-event-runner.js
node --check scripts/apps/travel-event-runner-v2-preview-template.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
```

Add any new smoke runner if you create new helper tests.

## Expected result

A GM opening the Travel Event Runner in Foundry should understand:

1. whether a published finalized travel event is available,
2. whether a PF2E vehicle/Arcflight ship actor is available,
3. how to start a local runner session,
4. why Start Local Runner Session is disabled or blocked.

After this sanity checkpoint, continue the original roadmap from Phase 7: GM-approved actor/item application bridge.
