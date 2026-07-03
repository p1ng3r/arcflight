# Arcflight Codex Prompt — PR #352A

## Title

Travel v2: Add station benefit display state foundation

## Branch

Use branch:

`codex/pr352-player-station-benefit-display`

Base remains:

`dev`

## Read First

Read:

- `AGENTS.md`
- `docs/agents/README.md`
- `docs/agents/roadmap-scope-agent.md`
- `docs/agents/helper-runtime-agent.md`
- `docs/agents/foundry-pf2e-api-agent.md`
- `docs/agents/safety-leak-audit-agent.md`
- `docs/agents/smoke-test-agent.md`
- `docs/codex/pr352-split-plan.md`

UI / Player Flow Agent may be WATCH for this pass because #352A is state foundation only.

## Goal

Implement the state foundation for pending station benefit display and selected-benefit review.

This pass should not do visible template rewrites or real table actions.

## Build

Add:

- `scripts/helpers/travel-v2-station-benefit-use-review.js`
- `scripts/helpers/travel-v2-station-benefit-use-review.smoke.js`
- render-state integration in `scripts/apps/travel-event-runner-v2-preview-consumer.js`
- aggregate smoke wiring in `scripts/dev/run-travel-v2-smoke.mjs`
- safe helper exports in `scripts/arcflight.js` and `scripts/dev/dev-tools.js` if that matches existing style
- `docs/travel-v2-station-benefit-display-use-review.md`
- roadmap note in `docs/TRAVEL_V2_ENCOUNTER_ROADMAP.md`

## Helper Requirements

The helper consumes #351 pending benefit queue state and prepares:

- player-safe display rows
- ready review-only candidate for an explicit selected pending row
- blocked candidate for missing, unknown, hidden, malformed, used, dismissed, expired, or non-pending selections
- GM review state only when GM-like user and review flag are present

All output must be clone-safe and inert. No real use result is created.

## State Names

Recommended exports:

- `TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION`
- `normalizeTravelV2StationBenefitUseReviewInput`
- `prepareTravelV2StationBenefitDisplayRows`
- `prepareTravelV2StationBenefitUseReviewPlayerState`
- `prepareTravelV2StationBenefitUseReviewGmState`
- `applyTravelV2StationBenefitUseReviewToRenderState`

Recommended render-state keys:

- `travelV2StationBenefitUseReviewPlayerState`
- `travelV2StationBenefitUseReview` for GM-like users only

## No-Go

Do not add broad UI/template changes.
Do not add real use/apply behavior.
Do not add roll/check/DC changes.
Do not add persistent document writes.
Do not use Foundry or PF2E runtime globals inside the helper.

## Smoke

Required coverage:

- imports and version
- empty input
- display rows from #351 queue state
- valid pending selected row becomes ready review-only candidate
- invalid selections block safely
- player-safe redaction
- GM review gating
- clone safety
- render-state integration
- source scan for obvious runtime write calls
- aggregate runner includes the suite

## Commands

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
