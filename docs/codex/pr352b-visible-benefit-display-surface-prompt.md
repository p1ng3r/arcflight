# Arcflight Codex Prompt — PR #352B

## Title

Travel v2: Add visible pending station benefit display surface

## When To Use

Use this after #352A is merged or after #352A state foundation exists on the branch.

Do not run this before #352A unless the helper and render-state keys already exist.

## Branch

Use a fresh branch from `dev` after #352A merges, or continue the current branch only if #352A has not been PR-reviewed yet.

Suggested branch after #352A:

`codex/pr352b-visible-benefit-display-surface`

## Read First

Read:

- `AGENTS.md`
- `docs/agents/README.md`
- `docs/agents/roadmap-scope-agent.md`
- `docs/agents/ui-player-flow-agent.md`
- `docs/agents/foundry-pf2e-api-agent.md`
- `docs/agents/safety-leak-audit-agent.md`
- `docs/agents/smoke-test-agent.md`
- `docs/codex/pr352-split-plan.md`

## Goal

Make #352A pending station benefit display state visible in the smallest existing Travel v2 UI surface.

This pass is display only.

## Build

Use existing state from #352A:

- `travelV2StationBenefitUseReviewPlayerState`
- player-safe display rows
- candidate state if present

Find the smallest existing UI/template/render surface that can display pending station benefits without broad restructuring.

Possible surfaces to inspect:

- Travel event runner preview consumer app state
- Travel event runner preview panel
- guided queue state
- player mission board only if it already consumes compatible Travel v2 state

## Display Requirements

Show enough player-safe information for each pending benefit:

- title
- source station label
- target station label
- display summary
- status label
- request availability label or disabled reason

For non-pending rows, show disabled/not-ready state if the surface supports it.

## No-Go

Do not add request click handlers in this pass.
Do not add new socket messages.
Do not create persistent use records.
Do not create real use/apply behavior.
Do not alter rolls/checks/DCs.
Do not broaden templates if no obvious small surface exists.

If no safe small surface exists, stop and mark UI / Player Flow Agent as WATCH with a clear explanation.

## Foundry / PF2E Compatibility

Do not introduce Foundry runtime globals into helper files.
Keep UI/template changes aligned with actual render-state keys.
Do not rely on PF2E private internals.

## Smoke

Add or extend smoke coverage for:

- visible display state is present in the app/panel state
- non-GM state contains only player-safe fields
- empty/missing display state does not throw
- disabled rows are represented safely
- no new real use/apply behavior appears

Run and report:

```bash
git diff --check
node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```

Also run any focused smoke introduced by #352A.

## PR Body

Include Agent Checks:

- Roadmap / Scope Agent
- UI / Player Flow Agent
- Foundry / PF2E System Compatibility Agent
- Safety / Leak Audit Agent
- Smoke Test Agent

Open the PR into `dev`. Do not merge.
