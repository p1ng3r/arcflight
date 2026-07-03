Arcflight Codex Prompt — PR #351
Chat title / working label: arkflight mod 7/3

Repo: p1ng3r/arcflight
Base branch: dev
Target PR: #351
Suggested branch: codex/pr351-roadmap-benefit-queue
Suggested PR title: Travel v2: Re-anchor roadmap and add pending station benefit queue foundation

Context

Arcflight is a Foundry VTT module for PF2E-compatible fantasy voidfaring campaigns. It uses PF2E vehicle actors as Arcflight ships and PF2E equipment items as Arcflight components. Arcflight data lives under flags.arcflight.* and the Travel v2 runner must remain player-safe, GM-auditable, and non-mutating unless an explicit GM Apply flow is built in a future PR.

The latest merged Travel v2 PR is #350, "Travel v2: Add Station Impact Modifier Review (GM review, player-safe state)", merged into dev. It added:
- scripts/helpers/travel-v2-station-impact-modifier-review.js
- scripts/helpers/travel-v2-station-impact-modifier-review.smoke.js
- integration into scripts/apps/travel-event-runner-v2-preview-consumer.js
- docs for the review-only station impact modifier layer
- aggregate smoke wiring

Important correction for this PR

The prior roadmap over-focused on the hazard safety/review chain. This PR must re-anchor the roadmap around the missing table-play systems while also adding the first narrow runtime foundation for pending station benefits.

This PR is #351 and should do BOTH:
1. Re-anchor docs/roadmap so the missing systems are visible and cannot be skipped.
2. Add the first session-local Pending Station Benefit Queue helper foundation.

Do not make this docs-only.
Do not implement direct benefit use yet.
Do not mutate rolls/check previews yet.
Do not implement round action order yet.
Do not implement station combo runtime yet.
Do not implement risk bids yet.
Do not implement Momentum spends yet.

Required agent workflow

Before making changes, read and follow these repo agent docs on this branch:

- AGENTS.md
- docs/agents/README.md
- docs/agents/roadmap-scope-agent.md
- docs/agents/helper-runtime-agent.md
- docs/agents/safety-leak-audit-agent.md
- docs/agents/smoke-test-agent.md

For PR #351, the required agents are:

- Roadmap / Scope Agent
- Helper / Runtime Agent
- Safety / Leak Audit Agent
- Smoke Test Agent

The UI / Player Flow Agent is not a blocker for PR #351 unless visible UI is added. The Content Builder Agent is not a blocker for PR #351 unless content-builder/import/export code is changed.

Add an Agent Checks section to the PR body with:

- Roadmap / Scope Agent: PASS / FAIL / WATCH
- Helper / Runtime Agent: PASS / FAIL / WATCH
- Safety / Leak Audit Agent: PASS / FAIL / WATCH
- Smoke Test Agent: PASS / FAIL / WATCH

Do not mark the task complete unless all required agents are PASS or any WATCH item is clearly explained, safe, and deferred to a named future PR.

Non-negotiable safety rules

Never automatically mutate Foundry actors, items, chat, journals, scenes, tokens, combats, settings, sockets, compendia, world data, or persistent flags in this PR.

Player-safe state must never leak:
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

The pending station benefit queue must be:
- session-local/render-state only
- clone-safe
- deterministic
- player-safe
- visible as normalized rows
- safe for both GM and player-facing state
- review-only/inert for this PR
- never automatically applied to station checks
- never automatically applied to rolls
- never persistent
- never a Foundry document mutation path

Primary implementation task

Add a helper:

scripts/helpers/travel-v2-pending-station-benefit-queue.js

The helper should define versioned pending station benefit queue foundation behavior.

Recommended exports:

- TRAVEL_V2_PENDING_STATION_BENEFIT_QUEUE_VERSION
- normalizeTravelV2PendingStationBenefitQueueInput(input = {}, options = {})
- prepareTravelV2PendingStationBenefitQueue(input = {}, options = {})
- prepareTravelV2PendingStationBenefitPlayerState(input = {}, options = {})
- prepareTravelV2PendingStationBenefitGmState(input = {}, options = {})
- applyTravelV2PendingStationBenefitQueueToRenderState(renderState = {}, input = {}, options = {})

Use names that fit the repo style, but keep the separation clear.

Pending benefit row shape

Rows should support these concepts:

- version
- id / queueKey
- sourceStationKey
- sourceStationLabel
- targetStationKey
- targetStationLabel
- sourceActionId
- sourceActionTitle
- roundIndex
- roundNumber
- benefitKind
- magnitude
- expires
- stackingPolicy
- status
- title
- publicText
- playerSafeSummary
- reviewOnly
- playerVisible
- gmOnly
- useAvailable
- useApplied
- dismissed
- persistentMutation

Recommended benefit kinds:

- dcReduction
- hazardIgnore
- riskBidDiscount
- backlashShield
- unlockAction
- momentumOption
- clearProgress

Allowed statuses for this foundation:

- pending
- blocked
- expired
- used
- dismissed

For PR #351, use/apply should remain inert. Rows can carry status, but no button or lifecycle should actually use/apply a benefit yet.

Recommended inert flags

Each normalized row should make the safety clear:

- reviewOnly: true
- playerVisible: true unless explicitly false
- gmOnly: false for player rows
- useAvailable: false
- useApplied: false
- rollMutationAvailable: false
- checkPreviewMutated: false
- stationStateMutated: false
- persistentMutation.available: false
- persistentMutation.reason: "Pending station benefit queue does not mutate Foundry documents."

Player state requirements

prepareTravelV2PendingStationBenefitPlayerState must:

- return only player-safe rows
- strip forbidden fields recursively
- never include GM review text
- never include applyPayload/before/after/targetActorUuid/targetActorId
- include counts such as totalCount, pendingCount, blockedCount if helpful
- include version information
- clone its return values

GM state requirements

prepareTravelV2PendingStationBenefitGmState may include:

- GM review rows
- blocked reasons
- source metadata
- validation warnings
- counts

But GM state must still not imply automatic apply/use behavior in this PR.

Integration task

Integrate the helper into:

scripts/apps/travel-event-runner-v2-preview-consumer.js

Use the existing render-state pipeline style. Add the pending station benefit queue after station impact modifier review and before final preview/GM flow status where appropriate.

The integration should:

- add player-safe pending station benefit state for non-GM users
- add GM review state only for GM users
- not add active player buttons yet
- not mutate the runner session
- not mutate any Foundry document
- not apply station modifiers
- not apply check preview changes

Export task

If the repo pattern expects helpers exported from scripts/arcflight.js, add safe exports there. Do not create broad public APIs unless needed by existing style.

Documentation task

Update:

- docs/TRAVEL_V2_ENCOUNTER_ROADMAP.md

Required doc updates:

1. Re-anchor the roadmap after PR #350.
2. Make clear #351 is not docs-only; it includes pending station benefit queue foundation.
3. Keep the following missing table-play systems visible:
   - station combo play
   - player-chosen round action order
   - pending station benefits
   - risk bids
   - Momentum
   - Focus and Support interaction
   - hazard mechanical completion
   - station action cards
   - station benefit cards
   - risk bid cards
   - content-builder import/export
   - encounter templates
   - narration hooks
4. Add or update immediate roadmap:
   - #351 Roadmap Re-anchor + Pending Station Benefit Queue Foundation
   - #352 Player-Facing Station Benefit Display / Direct Player Use Review
   - #353 Round Action Order State
   - #354 Station Combo Runtime v1
   - #355 Risk Bid HUD Selection
   - #356 Risk Bid Apply to Check Preview
   - #357 Risk Bid Result Review
   - #358 Momentum Spend Catalog / Player-Controlled Spend Review
   - #359 Momentum Apply to Session State
   - #360+ Hazard apply/clear/consequence flow
5. Add or preserve the two-GPT content builder plan:
   - GPT 1: Travel Event Story Architect / Branching Event Builder
   - GPT 2: Travel v2 JSON Pack Builder / Schema Converter
6. Add content-builder roadmap insert:
   - #381 Story Architect GPT Event Design Contract
   - #382 JSON Pack Builder GPT Conversion Contract
   - #383 Content Pack Validator CLI / Dev Helper
   - #384 Foundry Import Preview UI
   - #385 Safe Pack Import / Export v1
   - #386 Pack Runtime Selection
   - #387 Gold-Standard Encounter Sample using two-GPT flow

Do not implement import/export in this PR. This PR only keeps that lane visible.

Smoke test task

Add:

scripts/helpers/travel-v2-pending-station-benefit-queue.smoke.js

Wire it into:

scripts/dev/run-travel-v2-smoke.mjs

Required smoke coverage:

1. Empty input returns an empty safe queue.
2. Normal input creates pending rows with source/target station data.
3. Supported benefit kinds normalize correctly.
4. Invalid/partial records become blocked or safe empty rows, not crashes.
5. Player state strips all forbidden GM/internal fields.
6. GM state can include review context without enabling apply/use.
7. Output is clone-safe; mutating output does not mutate input.
8. No row implies persistent mutation.
9. No row implies station roll mutation.
10. No row implies check preview mutation.
11. Integration render-state function adds expected keys without mutating original render state.
12. Aggregate smoke runner includes this new smoke.

Expected local commands

Run these before marking complete:

```bash
git diff --check
node --check scripts/helpers/travel-v2-pending-station-benefit-queue.js
node --check scripts/helpers/travel-v2-pending-station-benefit-queue.smoke.js
node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
node scripts/helpers/travel-v2-pending-station-benefit-queue.smoke.js
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```

Acceptance criteria

The PR is acceptable only if:

- the roadmap is re-anchored after PR #350
- #351 clearly includes runtime foundation, not docs-only
- pending station benefit queue helper exists
- helper is pure/clone-safe
- player-safe state strips forbidden fields
- GM state remains review-only
- render-state integration is non-mutating
- no Foundry document mutation is introduced
- no automatic roll/check/DC modification is introduced
- no player-direct use UI is introduced
- focused smoke test passes
- aggregate Travel v2 smoke includes the new smoke
- Foundry check runner smoke still passes
- PR body includes the required Agent Checks section

PR body summary requirement

Include this in the PR body:

Summary:
- Re-anchors Travel v2 roadmap after PR #350.
- Adds pending station benefit queue foundation.
- Adds player-safe and GM review state separation.
- Adds focused smoke coverage and aggregate smoke wiring.

Agent Checks:
- Roadmap / Scope Agent: PASS / FAIL / WATCH
- Helper / Runtime Agent: PASS / FAIL / WATCH
- Safety / Leak Audit Agent: PASS / FAIL / WATCH
- Smoke Test Agent: PASS / FAIL / WATCH

Tests:
- git diff --check
- node --check scripts/helpers/travel-v2-pending-station-benefit-queue.js
- node --check scripts/helpers/travel-v2-pending-station-benefit-queue.smoke.js
- node --check scripts/apps/travel-event-runner-v2-preview-consumer.js
- node scripts/helpers/travel-v2-pending-station-benefit-queue.smoke.js
- node scripts/dev/run-travel-v2-smoke.mjs
- node scripts/dev/run-foundry-check-runner-smoke.mjs

End state

Open a PR from:

codex/pr351-roadmap-benefit-queue

into:

dev

Do not merge. The PR will be reviewed before local testing and merge.
