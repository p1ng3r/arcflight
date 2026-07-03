Arcflight Codex Prompt — PR #352
Working label: arkflight mod 7/3

Repo: p1ng3r/arcflight
Base branch: dev
Target PR: #352
Working branch: codex/pr352-player-station-benefit-display
Suggested PR title: Travel v2: Add player-facing pending station benefit display and use review

Context

Arcflight is a Foundry VTT module for PF2E-compatible fantasy voidfaring campaigns. It uses PF2E vehicle actors as Arcflight ships and PF2E equipment items as Arcflight components. Arcflight data lives under flags.arcflight.*.

PR #351 is merged into dev. It added the Travel v2 pending station benefit queue foundation:

- docs/agents/* agent workflow docs
- AGENTS.md root agent entrypoint
- docs/codex/pr351-roadmap-benefit-queue-prompt.md
- docs/travel-v2-pending-station-benefit-queue.md
- scripts/helpers/travel-v2-pending-station-benefit-queue.js
- scripts/helpers/travel-v2-pending-station-benefit-queue.smoke.js
- integration into scripts/apps/travel-event-runner-v2-preview-consumer.js
- helper exports in scripts/arcflight.js and scripts/dev/dev-tools.js
- aggregate smoke wiring in scripts/dev/run-travel-v2-smoke.mjs

PR #351 was intentionally inert. It normalized pending station benefit rows and produced player-safe/GM review state, but it did not add player-facing use controls, direct use review, roll mutation, check preview mutation, station modifier application, GM Apply, or persistent Foundry document mutation.

Current roadmap slice

PR #352 is the next slice:

Player-Facing Station Benefit Display / Direct Player Use Review

This means players should be able to see pending station benefits clearly and request/use-review a selected pending benefit through a safe player-facing flow.

Important: this PR should NOT actually apply the benefit to a roll, station check, check preview, DC, hazard, Momentum, consequence, actor, item, chat, journal, scene, token, combat, settings, socket, compendium, world data, or persistent flag.

This PR creates a display and request/review layer only. Actual check-preview application belongs to PR #356 or a later explicit apply slice.

Required agent workflow

Before making changes, read and follow:

- AGENTS.md
- docs/agents/README.md
- docs/agents/roadmap-scope-agent.md
- docs/agents/helper-runtime-agent.md
- docs/agents/ui-player-flow-agent.md
- docs/agents/safety-leak-audit-agent.md
- docs/agents/smoke-test-agent.md

Required agents for PR #352:

- Roadmap / Scope Agent
- Helper / Runtime Agent
- UI / Player Flow Agent
- Safety / Leak Audit Agent
- Smoke Test Agent

The Content Builder Agent is not required unless this PR unexpectedly touches content-builder, JSON pack, import/export, validator, or authored pack behavior.

Add an Agent Checks section to the PR body with:

- Roadmap / Scope Agent: PASS / FAIL / WATCH
- Helper / Runtime Agent: PASS / FAIL / WATCH
- UI / Player Flow Agent: PASS / FAIL / WATCH
- Safety / Leak Audit Agent: PASS / FAIL / WATCH
- Smoke Test Agent: PASS / FAIL / WATCH

Do not mark complete unless all required agents are PASS or any WATCH item is clearly explained, safe, and deferred to a named later PR.

Non-negotiable safety rules

Never automatically mutate Foundry actors, items, chat, journals, scenes, tokens, combats, settings, sockets, compendia, world data, or persistent flags in this PR.

Player-safe state must never leak these fields at any depth:

- gmText
- gmSummary
- gmMechanicalNotes
- gmReview
- explicitGmApplyEffect
- sessionLocalEffect
- internalMutation
- targetActorId
- targetActorUuid
- applyPayload
- before
- after
- queueInternals

Do not add live AI generation.
Do not implement import/export.
Do not implement risk bids.
Do not implement Momentum spend application.
Do not implement round action order.
Do not implement station combo creation runtime.
Do not implement roll/check/DC mutation.
Do not implement GM Apply.

Primary feature goal

Build the first player-facing station benefit display and direct use-review layer on top of the #351 pending station benefit queue.

A player-safe display row should clearly answer:

- What benefit is pending?
- Who created it / source station?
- Who can use it / target station?
- What kind of benefit is it?
- What is the visible magnitude or effect summary?
- When does it expire?
- Is it pending, blocked, used, dismissed, or expired?
- Can the player request use review now?
- If not, why not?

A use-review candidate should clearly answer:

- Which pending benefit did the player select?
- Is the selected benefit valid and pending?
- Is the selected benefit player-visible?
- Which source/target stations are involved?
- What would this request be asking the GM/future apply layer to consider?
- Why is it blocked if it cannot be reviewed?

Recommended helper

Add a helper:

scripts/helpers/travel-v2-station-benefit-use-review.js

Recommended exports:

- TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION
- normalizeTravelV2StationBenefitUseReviewInput(input = {}, options = {})
- prepareTravelV2StationBenefitDisplayRows(input = {}, options = {})
- prepareTravelV2StationBenefitUseReviewPlayerState(input = {}, options = {})
- prepareTravelV2StationBenefitUseReviewGmState(input = {}, options = {})
- applyTravelV2StationBenefitUseReviewToRenderState(renderState = {}, input = {}, options = {})

Use names that fit existing repo style, but keep display rows, player state, GM state, and render-state integration clearly separated.

Inputs to support

The helper should consume existing #351 queue state from any of these shapes when present:

- input.travelV2PendingStationBenefitPlayerState
- input.travelV2PendingStationBenefitQueue
- input.pendingStationBenefits
- input.travelV2PendingStationBenefits
- input.travelV2PendingStationBenefitQueue
- input.session?.pendingStationBenefits
- input.session?.travelV2PendingStationBenefits
- renderState.travelV2PendingStationBenefitPlayerState
- renderState.travelV2PendingStationBenefitQueue

The helper should accept a selected/requested queue key from UI state using names like:

- input.selectedQueueKey
- input.queueKey
- input.travelV2SelectedStationBenefitQueueKey
- input.travelV2StationBenefitUseSelectedQueueKey
- input.uiState?.travelV2StationBenefitUseSelectedQueueKey

The helper should accept an explicit request boolean using names like:

- input.useRequested
- input.travelV2StationBenefitUseRequested
- input.uiState?.travelV2StationBenefitUseRequested

This PR should not require a request by default. Without an explicit request, the helper should still return display rows but no ready use-review candidate.

Display row shape

Suggested player-safe display row fields:

- stationBenefitUseReviewVersion
- queueKey
- title
- sourceStation
- sourceStationLabel
- targetStation
- targetStationLabel
- benefitKind
- magnitude
- expires
- status
- publicText
- playerSafeSummary
- displaySummary
- displayStatusLabel
- canRequestUse
- requestUseLabel
- requestUseDisabledReason
- reviewOnly
- playerVisible
- gmOnly
- applyAvailable: false
- useApplied: false
- stationCheckMutated: false
- rollMutated: false
- checkPreviewMutated: false
- persistentMutation: { available: false, reason: string }

Use-review candidate shape

Suggested player-safe candidate fields:

- stationBenefitUseReviewVersion
- status: empty | ready | blocked
- queueKey
- title
- benefitKind
- sourceStationLabel
- targetStationLabel
- publicText
- playerSafeSummary
- displaySummary
- selected: true
- reviewOnly: true
- applyAvailable: false
- useApplied: false
- stationCheckMutated: false
- rollMutated: false
- checkPreviewMutated: false
- persistentMutation: { available: false, reason: string }
- blockedReason when blocked

GM state may include a GM review wrapper for the requested use-review candidate, but it must remain review-only and must not include an apply payload that looks executable.

Player display behavior

For pending rows:

- canRequestUse should be true only when the row is player-visible, status is pending, and enough safe display data exists.
- requestUseLabel can be "Request Use" or similar.
- requestUseDisabledReason should explain blocked/expired/used/dismissed/malformed rows.

For blocked, expired, used, dismissed, or malformed rows:

- canRequestUse false
- stable disabled reason
- no hidden GM fields
- no apply behavior

Render-state integration

Integrate into:

scripts/apps/travel-event-runner-v2-preview-consumer.js

Use the existing render-state pipeline style.

Recommended order:

1. Existing active hazard lifecycle display.
2. Existing response action wiring.
3. Existing station impact behavior.
4. Existing response action resolution review.
5. Existing station impact modifier review.
6. Existing pending station benefit queue from #351.
7. New station benefit display/use-review layer.
8. Preview panel / GM flow status.

The app state should expose a player-safe state for all users, for example:

- travelV2StationBenefitUseReviewPlayerState

GM-like users may also receive a GM-only review state, for example:

- travelV2StationBenefitUseReview

Do not add a real apply button. If visible control metadata is added, it must clearly be a request/review action only.

Visible UI guidance

If the repository has templates or UI rows for Travel v2 guided queues / preview panel / player mission board, add the smallest display needed to make pending station benefits visible.

If there is no appropriate template surface in this slice, add render-state rows and docs only, and mark UI / Player Flow Agent as WATCH with a clear explanation. Do not force a broad template rewrite.

Do not expose GM-only review details to players.
Do not let a disabled request look clickable.
Do not make review-only state look already applied.

Exports

If existing style requires helper exports, add safe read-only exports to:

- scripts/arcflight.js
- scripts/dev/dev-tools.js

Do not create a broad public API beyond existing pattern.

Documentation

Add:

- docs/travel-v2-station-benefit-display-use-review.md

Update:

- docs/TRAVEL_V2_ENCOUNTER_ROADMAP.md

The docs should explain:

- PR #352 builds on PR #351.
- PR #352 displays pending station benefits and prepares safe use-review requests.
- PR #352 does not apply the benefit to checks, rolls, DCs, hazards, Momentum, consequences, or Foundry documents.
- PR #353 remains Round Action Order State.
- PR #354 remains Station Combo Runtime v1.
- PR #356 remains Risk Bid Apply to Check Preview.
- Actual station benefit application/check-preview mutation is deferred to a later explicit apply slice.

Smoke tests

Add focused smoke:

scripts/helpers/travel-v2-station-benefit-use-review.smoke.js

Wire it into:

scripts/dev/run-travel-v2-smoke.mjs

Required smoke coverage:

1. Helper imports and version export.
2. Empty input returns empty display/use-review state.
3. Pending queue rows become player-safe display rows.
4. Pending player-visible row can request use review.
5. Blocked/expired/used/dismissed rows cannot request use review and get clear disabled reasons.
6. Explicit selected queue key creates a ready review-only candidate when valid.
7. Missing selected queue key with request produces blocked candidate.
8. Unknown selected queue key produces blocked candidate.
9. Non-pending selected row produces blocked candidate.
10. Player state strips forbidden GM/internal fields recursively.
11. GM review is gated by GM-like user and includeGmReview.
12. Helper does not mutate inputs/options/renderState and returns clone-safe state.
13. Render-state integration adds expected keys without mutating the original render state.
14. All use/apply/check/roll/persistent mutation flags remain unavailable/inert.
15. Source scan has no obvious Foundry mutation calls.
16. Aggregate Travel v2 smoke runner includes the new suite.

Expected local commands

Run before marking complete:

```bash
git diff --check
node --check scripts/helpers/travel-v2-station-benefit-use-review.js
node --check scripts/helpers/travel-v2-station-benefit-use-review.smoke.js
node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
node scripts/helpers/travel-v2-station-benefit-use-review.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```

Expected changed files

Likely files:

- docs/codex/pr352-player-station-benefit-display-prompt.md
- docs/TRAVEL_V2_ENCOUNTER_ROADMAP.md
- docs/travel-v2-station-benefit-display-use-review.md
- scripts/apps/travel-event-runner-v2-preview-consumer.js
- scripts/helpers/travel-v2-station-benefit-use-review.js
- scripts/helpers/travel-v2-station-benefit-use-review.smoke.js
- scripts/dev/run-travel-v2-smoke.mjs
- scripts/arcflight.js
- scripts/dev/dev-tools.js

Only add template/style files if there is a narrow existing surface for pending station benefit display.

Acceptance criteria

The PR is acceptable only if:

- It is based on dev.
- It builds on #351 pending station benefit queue state.
- Pending station benefits have a player-safe display state.
- A selected pending benefit can produce a review-only use-review candidate.
- Invalid/missing/non-pending selections block safely.
- No actual benefit application occurs.
- No check preview, roll, DC, station result, hazard, Momentum, consequence, or Foundry document is mutated.
- Player-safe state strips forbidden fields.
- GM review is gated.
- Helper outputs are clone-safe.
- Focused smoke and aggregate smoke pass.
- PR body includes Agent Checks.

PR body requirement

Include:

### Summary

- Adds player-facing pending station benefit display state.
- Adds review-only station benefit use-request candidate state.
- Integrates the display/use-review layer into the Travel v2 render pipeline.
- Preserves no-mutation and player-safe boundaries.

### Agent Checks

- Roadmap / Scope Agent: PASS / FAIL / WATCH
- Helper / Runtime Agent: PASS / FAIL / WATCH
- UI / Player Flow Agent: PASS / FAIL / WATCH
- Safety / Leak Audit Agent: PASS / FAIL / WATCH
- Smoke Test Agent: PASS / FAIL / WATCH

### Tests

- git diff --check
- node --check scripts/helpers/travel-v2-station-benefit-use-review.js
- node --check scripts/helpers/travel-v2-station-benefit-use-review.smoke.js
- node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
- node scripts/helpers/travel-v2-station-benefit-use-review.smoke.js
- node scripts/dev/run-travel-v2-smoke.mjs
- node scripts/dev/run-foundry-check-runner-smoke.mjs

End state

Open a PR from:

codex/pr352-player-station-benefit-display

into:

dev

Do not merge. The PR will be reviewed before local testing and merge.
