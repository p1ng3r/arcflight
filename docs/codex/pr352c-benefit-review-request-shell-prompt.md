# Arcflight Codex Prompt — PR #352C

## Title

Travel v2: Add station benefit review request shell

## When To Use

Use this after #352A and #352B are merged, or after their state/display foundations exist and have passed review.

This pass adds a narrow request/review shell. It still does not apply the benefit.

## Branch

Use a fresh branch from `dev` after #352B merges.

Suggested branch:

`codex/pr352c-benefit-review-request-shell`

## Read First

Read:

- `AGENTS.md`
- `docs/agents/README.md`
- `docs/agents/roadmap-scope-agent.md`
- `docs/agents/helper-runtime-agent.md`
- `docs/agents/ui-player-flow-agent.md`
- `docs/agents/foundry-pf2e-api-agent.md`
- `docs/agents/safety-leak-audit-agent.md`
- `docs/agents/smoke-test-agent.md`
- `docs/codex/pr352-split-plan.md`

## Goal

Add a narrow player request shell for selecting a pending station benefit and producing a review-only candidate for GM/table review.

The request should be ephemeral app/UI state only.

## Build

Use #352A helper/state and #352B display surface.

Add the smallest existing action path needed to set:

- selected pending benefit queue key
- explicit use-review request flag

Then feed that state into the #352A review helper so the render state exposes a review-only candidate.

## Behavior

Valid selection:

- selected row is pending
- row is player-visible
- helper returns ready review-only candidate
- GM review state is available only for GM-like users when requested

Invalid selection:

- missing key blocks
- unknown key blocks
- non-pending key blocks
- hidden/malformed key blocks

## No-Go

Do not apply the benefit.
Do not create a persistent use record.
Do not alter rolls/checks/DCs.
Do not change hazard, Momentum, consequence, or ship state.
Do not add broad socket routing unless an existing app-local pattern already supports this safely.

If the only available route would require broad transport or persistence work, stop and mark UI / Player Flow Agent as WATCH.

## Foundry / PF2E Compatibility

Keep helpers Node-smoke-safe.
Keep Foundry runtime references in app/runtime files.
Do not rely on PF2E private internals.
Do not alter Arcflight's PF2E vehicle/equipment model.

## Smoke

Add or extend smoke coverage for:

- clicking/requesting sets only ephemeral request state, if a click path is added
- selected key creates ready review-only candidate
- invalid selections block safely
- GM review is gated
- non-GM state remains player-safe
- app/render state integration does not mutate source state
- no real use/apply behavior appears

Run and report:

```bash
git diff --check
node --check scripts/helpers/travel-v2-station-benefit-use-review.js
node --check scripts/helpers/travel-v2-station-benefit-use-review.smoke.js
node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
node scripts/helpers/travel-v2-station-benefit-use-review.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```

## PR Body

Include Agent Checks:

- Roadmap / Scope Agent
- Helper / Runtime Agent
- UI / Player Flow Agent
- Foundry / PF2E System Compatibility Agent
- Safety / Leak Audit Agent
- Smoke Test Agent

Open the PR into `dev`. Do not merge.
