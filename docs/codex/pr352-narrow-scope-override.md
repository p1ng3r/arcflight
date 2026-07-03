# PR #352 Narrow Scope Override

Use this file if the full PR #352 prompt is too broad for one Codex pass.

## Goal

For PR #352, implement only the foundation for player-facing pending station benefit display and review-only use requests.

This should be helper logic, render-state integration, docs, and smoke coverage. Do not attempt a broad UI/template rewrite in this pass.

## Required Scope

Implement:

- `scripts/helpers/travel-v2-station-benefit-use-review.js`
- `scripts/helpers/travel-v2-station-benefit-use-review.smoke.js`
- integration in `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- aggregate smoke wiring in `scripts/dev/run-travel-v2-smoke.mjs`
- safe read-only exports in `scripts/arcflight.js` and `scripts/dev/dev-tools.js` if that matches repo style
- `docs/travel-v2-station-benefit-display-use-review.md`
- a small roadmap note in `docs/TRAVEL_V2_ENCOUNTER_ROADMAP.md`

## Out of Scope

Do not add broad templates, new table action transport, persistent use records, real apply behavior, or roll/check/DC changes.

If no narrow visible UI surface already exists, mark UI / Player Flow Agent as `WATCH` and explain that visible UI wiring is deferred.

## Required Agents

Read and follow:

- `AGENTS.md`
- `docs/agents/README.md`
- `docs/agents/roadmap-scope-agent.md`
- `docs/agents/helper-runtime-agent.md`
- `docs/agents/ui-player-flow-agent.md`
- `docs/agents/foundry-pf2e-api-agent.md`
- `docs/agents/safety-leak-audit-agent.md`
- `docs/agents/smoke-test-agent.md`

PR body must include:

- Roadmap / Scope Agent: PASS / FAIL / WATCH
- Helper / Runtime Agent: PASS / FAIL / WATCH
- UI / Player Flow Agent: PASS / FAIL / WATCH
- Foundry / PF2E System Compatibility Agent: PASS / FAIL / WATCH
- Safety / Leak Audit Agent: PASS / FAIL / WATCH
- Smoke Test Agent: PASS / FAIL / WATCH

## Helper Behavior

The helper should consume #351 pending station benefit queue state and produce:

- player-safe display rows
- a review-only candidate when an explicit selected queue key and request flag are provided
- blocked candidates for missing, unknown, non-pending, hidden, malformed, used, dismissed, or expired selections
- GM review state only for GM-like users when requested

All rows and candidates must remain inert and review-only. No real use/apply result should occur in this PR.

Player-safe output must recursively remove GM-only or internal fields.

## Foundry / PF2E Rule

Do not import Foundry or PF2E runtime objects into the helper. Keep helper code Node-smoke-safe. App integration may pass app state into the helper, but should not perform document writes.

Preserve the Arcflight model:

- PF2E vehicle actors are Arcflight ships.
- PF2E equipment items are Arcflight components.
- Arcflight data lives under `flags.arcflight.*`.

## Tests

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

Open a PR from `codex/pr352-player-station-benefit-display` into `dev`. Do not merge.
