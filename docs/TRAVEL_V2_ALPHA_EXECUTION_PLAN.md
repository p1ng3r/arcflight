# Travel v2 Alpha Execution Plan

**Status:** Active master plan  
**Scope:** Travel Event Alpha  
**Integration branch:** `feature/tv2-shared-crew-planning-v2`  
**Baseline commit:** `19662c55bcca8a497810d91cb76d3105ec859df7`  
**Last updated:** 2026-07-18

## Purpose

This document is the single execution checklist for taking Travel v2 from its current foundation to a playable, testable Alpha.

It controls sequencing, pull-request scope, verification, Foundry checkpoints, and final acceptance. Work should not be declared complete merely because code merged. A task is complete only when the required code, automated verification, and Foundry verification are all complete.

## Definition of Travel Event Alpha

Travel Event Alpha is reached only when all of the following are true:

- Every round begins with a synchronized player-facing Crew Planning phase.
- Every connected player can review every active station and every current player-safe station action.
- Every action displays authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids before the crew confirms order.
- Every Risk Bid displays its player-safe reward, target, timing, duration or expiration, and danger.
- Players jointly arrange the current round's station order.
- The Captain has final say and confirms the order.
- The GM can override or unlock for table management.
- Station actions and Risk Bids cannot lock or resolve until the current round order is confirmed.
- Station decisions, rolls, authored benefits, authored dangers, hazards, consequences, rewards, clues, and ship effects form one complete playable loop.
- Persistent actor or world changes occur only through explicit reviewed GM application.
- Two gold-standard Travel Events can be played from opening narration through final aftermath.
- The complete workflow survives reload, reconnect, multiple clients, session switching, and round advancement.
- No player receives hidden GM information.
- No unintended actor, item, effect, journal, chat, socket, scene, token, compendium, or world-setting mutation occurs.

## Completion states

Every implementation item has three distinct completion states:

1. **Code merged** — the reviewed pull request is merged into the integration branch.
2. **Automated verification passed** — focused and aggregate suites pass without removed or weakened coverage.
3. **Foundry verification passed** — the feature works in the supported Foundry/PF2e multiplayer environment.

Do not mark an item complete until all required states are satisfied.

## Current baseline

### Completed and merged

- [x] **TV2-003 Slice 01 — Canonical round-specific Crew Planning order state**
  - PR #515 merged.
  - Canonical selecting, committed, and unlocked lifecycle.
  - Current-round state under `roundResults[roundIndex].actionOrder`.
  - Previous-round committed order may seed a suggestion but does not remain committed.
  - Legacy state migration and deterministic repair.
  - Player-safe identity redaction and immutable state helpers.

- [x] **TV2-003 Slice 02 — Canonical Crew Planning phase lifecycle**
  - PR #516 merged.
  - `crewPlanning` is the first canonical Travel v2 round phase.
  - New and legacy sessions normalize into the canonical lifecycle.
  - Leaving Crew Planning requires a valid committed current-round order.
  - Direct phase-setting paths cannot bypass the gate.
  - New rounds reset to Crew Planning.
  - Completed-round detection and player-safe round-resolution redaction are included.

### Current integration baseline

```text
Branch: feature/tv2-shared-crew-planning-v2
Commit: 19662c55bcca8a497810d91cb76d3105ec859df7
```

### Immediate next implementation slice

- [ ] **TV2-003 Slice 03 — Station Action and Risk Bid lock-in gates**

## Workstream rules

### Branch and pull-request discipline

For every slice:

1. Start from the latest clean `feature/tv2-shared-crew-planning-v2`.
2. Pull all previously merged work locally before creating or switching to the next branch.
3. Create one narrowly scoped work branch.
4. Keep the PR base as `feature/tv2-shared-crew-planning-v2`.
5. Run focused validation before aggregate validation.
6. Review the complete diff and relevant full files.
7. Correct every blocker on the same PR.
8. Merge only after explicit authorization.
9. Pull the merged integration branch locally before beginning the next slice.
10. Update this plan with the PR number, merge commit, automated result, and Foundry status.

### Scope discipline

- Do not combine UI, socket synchronization, permissions, result mechanics, and persistent application in one oversized PR.
- Do not redesign unrelated Travel v2 systems while completing a focused slice.
- Do not remove or weaken existing test assertions to make a slice pass.
- Do not treat obsolete workflow tests as proof that the corrected Alpha workflow is complete.
- Do not add silent Foundry mutations.
- Do not expose hidden GM data in player-safe projections.

### Standard local synchronization step

After every merged PR:

```bash
cd /c/Users/Owner/AppData/Local/FoundryVTT/Data/modules/arcflight
git status --short
git switch feature/tv2-shared-crew-planning-v2
git fetch origin
git pull --ff-only origin feature/tv2-shared-crew-planning-v2
git rev-parse HEAD
```

Do not switch branches when `git status --short` reports unreviewed local changes.

---

# Milestone 0 — Baseline, documentation, and test inventory

## Goal

Establish one authoritative plan, one known integration baseline, and one verified test inventory before continuing implementation.

## Tasks

- [x] Create this master Alpha execution plan.
- [ ] Merge this documentation PR into `feature/tv2-shared-crew-planning-v2`.
- [ ] Pull the merged documentation locally.
- [ ] Verify `docs/TRAVEL_V2_SHARED_ROUND_PLANNING_AND_RISK_BIDS.md` is complete.
- [ ] Repair the canonical planning document if its state example or closing sections remain truncated.
- [ ] Record every current Travel v2 focused smoke suite.
- [ ] Record the aggregate Travel v2 suite count and assertion-group count.
- [ ] Run the current Foundry check-runner smoke.
- [ ] Record current baseline failures separately from regressions introduced by later slices.
- [ ] Confirm the integration branch is clean before Slice 03.

## Required validation

```bash
git diff --check
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```

## Exit gate

- [ ] This document is merged and local.
- [ ] Canonical documentation is complete.
- [ ] Current suite inventory and baseline results are recorded.
- [ ] The integration branch is clean.

---

# Milestone 1 — Finish Shared Crew Planning

## Goal

Complete corrected TV2-003 so the crew can begin every round by reviewing all legal choices, collaboratively setting order, confirming it, and moving into station decisions without stale state or broken table UX.

## Slice 03 — Station Action and Risk Bid lock-in gates

### Required behavior

- [ ] Block station-action selection before current-round order confirmation.
- [ ] Block station-action lock before current-round order confirmation.
- [ ] Block Risk Bid selection before current-round order confirmation.
- [ ] Require current phase `stationOrders` for selection and lock-in.
- [ ] Require a valid committed order that is an exact permutation of active stations.
- [ ] Prevent historical or previous-round orders from authorizing the current round.
- [ ] Prevent one session from authorizing another session.
- [ ] Couple the selected Risk Bid lock to the station-action lock.
- [ ] Prevent Risk Bid replacement or clearing after station-action lock.
- [ ] Preserve explicit GM unlock and cleanup behavior.
- [ ] Block station result recording without a confirmed order and locked station action.
- [ ] Ensure blocked operations make no secondary state changes.
- [ ] Expose a frozen player-safe planning-lock gate in runner state.

### Scope exclusions

- No shared planning panel.
- No socket synchronization.
- No Captain permission detection.
- No authored benefit or danger execution.
- No station-resolution sequence enforcement.

### Exit gate

- [ ] Focused planning-lock smoke passes.
- [ ] Existing station-action and Risk Bid smokes pass.
- [ ] Aggregate Travel v2 smoke passes.
- [ ] Foundry check-runner smoke passes.
- [ ] PR reviewed and merged.
- [ ] Merged commit pulled locally.

## Slice 04 — Shared player-safe planning projection

### Required behavior

- [ ] Every connected player sees every active current-round station.
- [ ] Every player sees every current player-safe action for each station.
- [ ] Every action exposes all authored `+2`, `+5`, and `+8` Risk Bids.
- [ ] Every bid exposes reward, target, timing, duration or expiration, and danger.
- [ ] Availability and suppression reasons are player-safe and understandable.
- [ ] The projection is current-round and session-specific.
- [ ] The projection is immutable and deterministic.
- [ ] Hidden hazards, GM notes, audit records, queues, internal scoring, future triggers, and apply payloads remain redacted.

### Exit gate

- [ ] Full per-action tier coverage smoke passes.
- [ ] Redaction and no-alias checks pass.
- [ ] Aggregate validation passes.
- [ ] PR reviewed, merged, and pulled locally.

## Slice 05 — Shared proposed-order synchronization

### Required behavior

- [ ] Proposed order updates synchronize across GM and player clients.
- [ ] Messages include session key, round identity, and state revision.
- [ ] Stale messages are rejected deterministically.
- [ ] Malformed messages are rejected.
- [ ] Unauthorized messages are rejected.
- [ ] Simultaneous edits resolve deterministically.
- [ ] Reloaded clients receive the authoritative candidate order.
- [ ] One runner session cannot modify another.
- [ ] One round cannot modify another.
- [ ] Synchronization changes only session-local planning state.

### Exit gate

- [ ] Socket/message helper smokes pass.
- [ ] Multi-client simulated synchronization passes.
- [ ] No unauthorized or stale update can alter authoritative state.
- [ ] PR reviewed, merged, and pulled locally.

## Slice 06 — Captain confirmation and GM authority

### Required behavior

- [ ] Resolve the Captain from canonical crew/station assignment.
- [ ] Allow the Captain to confirm the candidate order.
- [ ] Prevent non-Captain players from confirming.
- [ ] Allow the GM to confirm or override.
- [ ] Allow explicit GM unlock.
- [ ] Record confirmation and unlock history without exposing player identity in player-safe state.
- [ ] Preserve completed-round committed order as read-only history.
- [ ] A newly started round always returns to unconfirmed Crew Planning.

### Exit gate

- [ ] Captain, non-Captain, GM, stale, and reload cases pass focused tests.
- [ ] Permission behavior passes live Foundry verification.
- [ ] PR reviewed, merged, and pulled locally.

## Slice 07 — Primary Crew Planning interface

### Required behavior

- [ ] Crew Planning is the primary beginning-of-round interface.
- [ ] It is not buried under Advanced Runner Details.
- [ ] All active stations are visible together.
- [ ] Each station exposes its actions and authored Risk Bids.
- [ ] Current candidate order is always visible.
- [ ] Selecting, committed, and unlocked states are clear.
- [ ] Readiness and blocker messages are clear.
- [ ] Captain and GM confirmation controls appear only when authorized.
- [ ] Keyboard navigation and accessible labels are supported.
- [ ] The interface does not expose hidden GM material.

### Exit gate

- [ ] Template and render-state smokes pass.
- [ ] GM and player screenshots or recorded manual observations are captured.
- [ ] PR reviewed, merged, and pulled locally.

## Slice 08 — Stable planning-panel updates

### Required behavior

- [ ] Reordering updates only the Crew Planning panel.
- [ ] Whole-runner rerenders are not used for every movement.
- [ ] Scroll position is preserved.
- [ ] Keyboard focus is preserved.
- [ ] Expanded station/action/Risk Bid cards remain expanded.
- [ ] Selected tabs and controls remain unchanged.
- [ ] Drag, button, and keyboard movement share one deterministic state update path.
- [ ] Session switching resets panel-local state safely.

### Exit gate

- [ ] Focus/scroll/open-state automated coverage passes where practical.
- [ ] Manual Foundry verification confirms no collapse or jump-to-top regression.
- [ ] PR reviewed, merged, and pulled locally.

## Slice 09 — Crew Planning multiplayer closeout

### Required behavior

- [ ] Test one GM, one Captain player, and at least one additional player.
- [ ] Test concurrent proposed-order changes.
- [ ] Test Captain confirmation.
- [ ] Test unauthorized player confirmation.
- [ ] Test GM override and unlock.
- [ ] Test reload and reconnect.
- [ ] Test session switching.
- [ ] Test advancing into a fresh next-round Crew Planning state.
- [ ] Test player-safe redaction on every connected client.
- [ ] Replace obsolete TV2-003 Foundry verification steps with corrected multiplayer coverage.

### Milestone 1 exit gate

- [ ] All Slice 03–09 PRs are merged and local.
- [ ] Corrected-design focused smokes pass.
- [ ] Aggregate Travel v2 smoke passes.
- [ ] GM-plus-player synchronization tests pass.
- [ ] Replacement Foundry checklist passes.
- [ ] No hidden-data leak is observed.
- [ ] No unintended Foundry mutation is observed.

---

# Milestone 2 — Complete the player station-decision runtime

## Goal

Allow assigned players to make legal, understandable, persistent station decisions after Crew Planning confirmation.

## Crew ownership and permissions

- [ ] Complete canonical crew/station assignment records.
- [ ] Complete Captain role ownership rules.
- [ ] Allow assigned players to control only their legal station decisions.
- [ ] Define NPC-controlled station behavior.
- [ ] Define GM reassignment behavior.
- [ ] Define missing-player and reconnect recovery behavior.
- [ ] Redact controller identity from player-safe shared state where not needed.

## Station Action cards

- [ ] Every active station has authored actions.
- [ ] Every action has player-safe name, description, requirements, and effect preview.
- [ ] Every action exposes its legal skill or statistic choices.
- [ ] Suppressed or unavailable actions explain why.
- [ ] Selected actions survive save, reload, and reconnect.
- [ ] Locked actions cannot silently change.
- [ ] GM unlock is explicit and auditable.
- [ ] Invalid authored actions fail validation before play.

## Authored Risk Bid cards

- [ ] Every station action has exactly `+2`, `+5`, and `+8` authored tiers.
- [ ] Every tier has reward metadata.
- [ ] Every tier has target metadata.
- [ ] Every tier has timing metadata.
- [ ] Every tier has duration and expiration metadata where applicable.
- [ ] Every tier has danger metadata.
- [ ] Invalid or incomplete authored tiers fail validation.
- [ ] Selected tiers survive save, reload, and reconnect.
- [ ] Locked tiers remain tied to their station action.
- [ ] Freeform arbitrary bid values remain prohibited.

## Player Station HUD and prompts

- [ ] Assigned players receive a clear station decision prompt.
- [ ] The player sees station, action, skill, Risk Bid, DC impact, and lock state.
- [ ] Blocked choices explain the reason.
- [ ] The GM sees unresolved station decisions.
- [ ] The shared board shows crew progress without exposing hidden information.
- [ ] Mobile or narrow-window behavior remains usable enough for Alpha.

## Milestone 2 exit gate

- [ ] Every station can be assigned.
- [ ] Every assigned player can make a legal action-and-bid decision.
- [ ] Decisions persist through save, reload, reconnect, and session switching.
- [ ] Unauthorized decisions are blocked.
- [ ] Player-safe projections contain no hidden data.
- [ ] Automated and Foundry verification pass.

---

# Milestone 3 — Complete results, benefits, dangers, and persistent review

## Goal

Turn station decisions and Risk Bids into authored gameplay outcomes across all result bands while keeping permanent changes behind explicit GM review.

## Authored benefit runtime

- [ ] Support acting-station benefits.
- [ ] Support self-next-roll benefits.
- [ ] Support self-next-round benefits.
- [ ] Support next-station benefits.
- [ ] Support chosen-later-station benefits.
- [ ] Support chosen or specific station benefits.
- [ ] Support crew-wide benefits.
- [ ] Support ship-wide benefits.
- [ ] Support hazard suppression or weakening.
- [ ] Support backlash suppression or weakening.
- [ ] Support consequence prevention or downgrade.
- [ ] Support reward, salvage, discovery, and clue improvement.
- [ ] Support player-facing bonus cards.
- [ ] Support optional use, consumption, transfer, duration, and expiration.
- [ ] Support authored roll bonuses such as `+2`, `+3`, and `+5`.
- [ ] Support future DC reduction.
- [ ] Support one-degree failure improvement.
- [ ] Support authored `2d20`, keep highest.
- [ ] Generalize legacy Help records into authored benefit records.

## Authored Risk Bid danger runtime

- [ ] Resolve failure danger for every tier.
- [ ] Resolve critical-failure danger for every tier.
- [ ] Make `+8` failure and critical failure meaningfully more dangerous.
- [ ] Support pressure changes.
- [ ] Support hazard escalation.
- [ ] Support backlash.
- [ ] Support station complications.
- [ ] Support next-round complications.
- [ ] Support consequence candidates.
- [ ] Support ship-scar candidates.
- [ ] Support additional hazard candidates.
- [ ] Keep persistent consequences behind GM review.

## Hazard runtime

- [ ] Support one authored main evolving hazard per Alpha event.
- [ ] Support optional event-tagged secondary hazards.
- [ ] Reveal player-safe tells separately from hidden mechanics.
- [ ] Apply station suppression or modification where authored.
- [ ] Support hazard-response actions.
- [ ] Support progress, escalation, suppression, weakening, and clearing.
- [ ] Support reload-safe hazard lifecycle state.
- [ ] Prove hidden hazard data never reaches player state.

## Consequence queue and persistent application

- [ ] Complete pending consequence queue review.
- [ ] Support review, select, dismiss, restore, and clear actions.
- [ ] Provide explicit Apply controls.
- [ ] Apply actor or ship changes only after GM confirmation.
- [ ] Record idempotent application identity.
- [ ] Prevent duplicate resource, condition, scar, or effect application.
- [ ] Support recovery after interrupted application.
- [ ] Preserve review history without exposing GM-only metadata.

## Momentum, rewards, discoveries, and clues

- [ ] Complete Momentum earning.
- [ ] Define the Alpha Momentum spend catalog.
- [ ] Support hazard suppression spends.
- [ ] Support benefit improvement spends.
- [ ] Support pressure prevention or reduction spends.
- [ ] Support GM-awarded Momentum for exceptional planning or roleplay.
- [ ] Support reward candidates.
- [ ] Support discoveries and clues.
- [ ] Support route advantages.
- [ ] Support salvage.
- [ ] Support follow-up hooks.
- [ ] Reset event-scoped Momentum at event end where required.

## Result-band coverage

- [ ] Critical success produces stronger benefit, Momentum, progress, or improved reward.
- [ ] Success produces the selected benefit or progress.
- [ ] Failure produces authored danger or complication.
- [ ] Critical failure produces stronger authored danger.

## Milestone 3 exit gate

- [ ] All supported target and timing types have focused tests.
- [ ] All four result bands have focused tests.
- [ ] Expiration, consumption, transfer, and dedupe tests pass.
- [ ] Persistent changes require explicit GM confirmation.
- [ ] No duplicate application occurs.
- [ ] Aggregate automated validation passes.
- [ ] Live Foundry review and apply workflow passes.

---

# Milestone 4 — Build two gold-standard Alpha events

## Goal

Prove the complete system using two authored events rather than disconnected fixtures.

## Event One

- [ ] Opening vignette and visible stakes.
- [ ] Complete round count and phase structure.
- [ ] Active station definitions for every round.
- [ ] Authored actions for every active station.
- [ ] Three authored Risk Bid tiers for every action.
- [ ] Main evolving hazard.
- [ ] Optional secondary hazard where useful.
- [ ] Authored benefits and dangers.
- [ ] Narration hooks for all result bands.
- [ ] Rewards, discoveries, clues, and consequences.
- [ ] Final outcome package.
- [ ] Follow-up hooks.

## Event Two

- [ ] Different pressure profile from Event One.
- [ ] Different station emphasis.
- [ ] Different hazard form.
- [ ] Different benefit targets and timings.
- [ ] Different danger and consequence patterns.
- [ ] Different rewards or discoveries.
- [ ] Complete final outcome package.

## Gold-standard schema validation

- [ ] No active station lacks an action.
- [ ] No action lacks a `+2`, `+5`, or `+8` tier.
- [ ] No Risk Bid lacks reward, target, timing, and danger metadata.
- [ ] No invalid target or timing reference exists.
- [ ] No hidden text appears in player-safe output.
- [ ] Save, reload, and import/export preserve authored content.
- [ ] Event validation reports actionable errors.

## Milestone 4 exit gate

- [ ] Event One completes from opening Crew Planning through aftermath.
- [ ] Event Two completes from opening Crew Planning through aftermath.
- [ ] Both events pass schema validation.
- [ ] Both events pass GM-plus-player Foundry tests.
- [ ] Both events produce distinct meaningful gameplay.

---

# Milestone 5 — Finish GM workflow and table usability

## Goal

Let the GM understand and complete the event without editing raw data or relying on developer-only panels.

## Pending Decisions interface

- [ ] Crew Planning readiness.
- [ ] Unresolved station assignments.
- [ ] Unresolved action and Risk Bid decisions.
- [ ] Pending station rolls.
- [ ] Pending reactions or rerolls.
- [ ] Pending hazards.
- [ ] Pending authored benefits.
- [ ] Pending Risk Bid dangers.
- [ ] Pending consequences.
- [ ] Pending rewards, discoveries, and clues.
- [ ] Pending persistent applications.

## Resolution workflow

- [ ] Round Resolution dialog opens cleanly.
- [ ] Round Resolution dialog presents player-safe narration separately from GM review data.
- [ ] End-of-Event Resolution dialog opens cleanly.
- [ ] Final outcome review covers rewards, consequences, ship changes, clues, and follow-ups.
- [ ] Completed sessions can be reopened safely.
- [ ] Corrections are explicit and idempotent.
- [ ] Recovery messages explain blocked or incomplete state.

## Debug and support workflow

- [ ] Copy Travel v2 Debug Report works.
- [ ] Debug report includes exact session, event, round, and version context.
- [ ] Debug report does not leak into player UI.
- [ ] Exported support data is deterministic and useful.
- [ ] Important Alpha controls are not buried in development-only details.

## Milestone 5 exit gate

- [ ] The GM can identify the next required decision at every phase.
- [ ] The GM can resolve and finish an event without raw JSON editing.
- [ ] Error recovery and correction paths work.
- [ ] Automated UI-state tests and live Foundry usability checks pass.

---

# Milestone 6 — Alpha acceptance, safety audit, and release record

## Goal

Prove the complete two-event loop under the supported multiplayer Foundry environment and record the exact tested release state.

## Automated acceptance

- [ ] All focused helper smokes pass.
- [ ] All focused application smokes pass.
- [ ] Aggregate Travel v2 smoke passes.
- [ ] Foundry check-runner smoke passes.
- [ ] No suite is removed, skipped, or commented out.
- [ ] No fixture is weakened to hide a regression.
- [ ] Deterministic timestamps and IDs are used in tests.
- [ ] Input immutability checks pass.
- [ ] Returned nested data does not alias source data.
- [ ] Reload and serialization checks pass.

## Multiplayer Foundry acceptance

- [ ] One GM client.
- [ ] One Captain player client.
- [ ] At least one additional player client.
- [ ] Shared Crew Planning synchronization.
- [ ] Captain confirmation and GM override.
- [ ] Station assignment and ownership.
- [ ] Action and Risk Bid selection and locking.
- [ ] Station rolls and result resolution.
- [ ] Benefit, hazard, backlash, and consequence review.
- [ ] Round advancement.
- [ ] Fresh next-round Crew Planning.
- [ ] Event completion and aftermath.
- [ ] Reload and reconnect.
- [ ] Session switching.
- [ ] Completed-session reopen.

## Hidden-information audit

- [ ] No GM notes in player state.
- [ ] No hidden hazards in player state.
- [ ] No consequence queue internals in player state.
- [ ] No internal scoring in player state.
- [ ] No user identity audit payloads in player state.
- [ ] No apply payloads or actor UUIDs in player state.
- [ ] No future-trigger internals in player state.

## Mutation audit

Install or retain counting sentinels and verify zero unintended calls to:

- [ ] `game.socket.emit`
- [ ] `game.settings.set`
- [ ] Actor create/update/delete
- [ ] Item create/update/delete
- [ ] ActiveEffect create/update/delete
- [ ] ChatMessage creation
- [ ] JournalEntry creation
- [ ] Scene create/update/delete
- [ ] TokenDocument create/update/delete
- [ ] Compendium writes

Explicit reviewed GM application paths must be tested separately from preview-only and session-local paths.

## Release record

Record:

- [ ] Foundry VTT version.
- [ ] PF2e system version.
- [ ] Browser and version.
- [ ] Operating system.
- [ ] Arcflight module version.
- [ ] Enabled supporting modules.
- [ ] Final tested commit.
- [ ] Event keys and fixture versions.
- [ ] Test account/client arrangement.
- [ ] Known limitations.
- [ ] Installation and verification instructions.

## Final Alpha exit gate

Travel Event Alpha is approved only when:

- [ ] Two gold-standard events complete end to end.
- [ ] All required automated suites pass.
- [ ] Multiplayer Foundry acceptance passes.
- [ ] No critical gameplay blocker remains.
- [ ] No hidden-information leak remains.
- [ ] No unintended persistent mutation remains.
- [ ] Exact environment and commit details are recorded.
- [ ] The integration branch is ready for its final reviewed merge into the selected development branch.

---

# Pull-request roadmap

Use this table as the active PR ledger. Update it after every merge.

| Sequence | Work item | Status | PR | Merge commit | Automated | Foundry |
|---:|---|---|---:|---|---|---|
| 1 | TV2-003 Slice 01 — round-specific order state | Merged | #515 | `9184de45f6cd0260ff84328783e34a5a4617171b` | Passed at review | Pending milestone closeout |
| 2 | TV2-003 Slice 02 — Crew Planning lifecycle | Merged | #516 | `19662c55bcca8a497810d91cb76d3105ec859df7` | Passed at review | Pending milestone closeout |
| 3 | Alpha execution plan | In progress | — | — | Documentation only | Not applicable |
| 4 | TV2-003 Slice 03 — action and Risk Bid gates | Not started | — | — | Pending | Pending |
| 5 | TV2-003 Slice 04 — shared planning projection | Not started | — | — | Pending | Pending |
| 6 | TV2-003 Slice 05 — proposed-order synchronization | Not started | — | — | Pending | Pending |
| 7 | TV2-003 Slice 06 — Captain and GM authority | Not started | — | — | Pending | Pending |
| 8 | TV2-003 Slice 07 — primary planning panel | Not started | — | — | Pending | Pending |
| 9 | TV2-003 Slice 08 — stable panel rendering | Not started | — | — | Pending | Pending |
| 10 | TV2-003 Slice 09 — multiplayer closeout | Not started | — | — | Pending | Pending |
| 11+ | Milestones 2–6 scoped PRs | Not started | — | — | Pending | Pending |

# Milestone checkpoint record

At the end of every milestone, add a record with:

```text
Milestone:
Integration commit:
Focused suites:
Aggregate suites/groups:
Foundry check runner:
Foundry version:
PF2e version:
Browser/OS:
Clients used:
Manual scenarios passed:
Known blockers:
Decision: PASS / HOLD
```

# Immediate sequence

1. Merge this plan PR after review.
2. Pull `feature/tv2-shared-crew-planning-v2` locally.
3. Complete Milestone 0 baseline and documentation checks.
4. Start TV2-003 Slice 03 from the resulting integration commit.
5. Continue through Milestone 1 without changing the locked sequence unless a verified dependency requires it.
6. Perform a live Foundry checkpoint after Milestone 1 before beginning Milestone 2.
