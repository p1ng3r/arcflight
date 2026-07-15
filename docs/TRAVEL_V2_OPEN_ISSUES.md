# Travel v2 Open Issues

Status: implementation tracker.

This document is the repo-local implementation tracker for Travel v2. It is not the top-level Arcflight roadmap and it is not the Travel Alpha gameplay goal.

Use the current docs in this order:

1. `docs/ARCFLIGHT_ALPHA_PILLAR_ROADMAP.md` — top-level sequencing: Travel Alpha, then Combat Alpha, then Upgrade / Progression Alpha, then Beta.
2. `docs/TRAVEL_V2_ALPHA_GOAL.md` — current Travel Alpha source of truth.
3. This file — numbered implementation tracker for Travel v2 work items.
4. GitHub Issues — live ticket discussion and PR-sized work tracking.

When this tracker conflicts with `TRAVEL_V2_ALPHA_GOAL.md`, treat the alpha goal document as authoritative unless a later docs PR intentionally changes the goal.

## Scope labels

Each numbered item may use one of these scope labels:

- **Alpha blocker:** required before Travel Alpha can be called playable.
- **Alpha support:** useful for alpha or needed by an alpha blocker, but not necessarily a standalone blocker.
- **Post-alpha:** important Travel v2 work that should not block the two-event alpha loop.
- **Foundation / historical:** existing foundation, closeout notes, or work that should not be rebuilt unless a focused smoke test exposes a bug.

## Current status

Travel v2 has substantial foundation coverage already. The aggregate smoke runner currently covers core Travel v2 state, pressure, round pressure, round action order, persistence bridges, library order status, runner preview, pressure application/correction, round finalization, event completion, completed-summary export, outcome packages, actor application bridge, follow-ups, hazards, ship scars, narration, stabilize/repair, momentum, Focus and Support records, runner UI consumers, saved-session startup/session-switch hardening, sample events, dev tools foundation, card schema/import compatibility, consequence catalog, hazard deck selection, hazard review paths, response action wiring, station impact behavior, station impact modifier review, pending station benefit queue, and station benefit use review.

Do not rebuild those foundations unless a new smoke test exposes a narrow bug.

## Gameplay ownership principle

Travel v2 should keep the GM present as voyage director, not replace the GM with an automated board game.

- The GM builds the voyage premise, major story turns, and authored events.
- The GM may choose specific events to trigger at specific route beats.
- The GM may also use random or weighted event picks when improvisation is desired.
- A single voyage can contain multiple Travel v2 events.
- Player choices on the ship should drive station actions, risk bids, Focus, Momentum spends, inter-station help, hazard responses, consequences, and final outcomes.
- The system should make player-driven ship actions mechanically meaningful while leaving pacing, story emphasis, and event curation in the GM's hands.

## Numbering rules

- Use `TV2-###` numbers for this document.
- Use GitHub Issues for live tickets and discussion.
- Use PR numbers only for implementation history.
- A system can be `missing`, `partial`, `foundation-complete`, or `closeout-needed`.
- Prefer small smoke-first PRs.
- Every runtime feature needs a focused smoke and aggregate Travel v2 smoke wiring.
- Alpha work should map back to `docs/TRAVEL_V2_ALPHA_GOAL.md`.

## Alpha blocker summary

These are the implementation areas that most directly define or block the locked Travel Alpha goal; some are complete and kept here for closeout visibility:

- TV2-002 — Inter-Station Help.
- TV2-003 — Player-Chosen Round Action Order UX polish.
- TV2-004 — Risk Bids / Difficulty Bids.
- TV2-005 — Risk Bid Result Pipeline.
- TV2-006 — Momentum Spend Catalog.
- TV2-007 — Hazard Mechanical Completion.
- TV2-008 — Consequence Queue Expansion.
- TV2-009 — Explicit GM Persistent Apply Foundation.
- TV2-010 — Station Action Card Runtime.
- TV2-011 — Station Benefit Card Runtime.
- TV2-012 — Risk Bid Card Runtime.
- TV2-016 — Gold-Standard Encounter Sample, now expanded to two alpha events by `TRAVEL_V2_ALPHA_GOAL.md`.
- TV2-018 — Visible Stakes Runtime.
- TV2-019 — Narration Hook Assembly.
- TV2-020 — Final Outcome and Aftermath Expansion.
- TV2-021 — Player HUD Polish.
- TV2-022 — GM Pending Decisions UI.
- TV2-023 — End-to-End Table Test Scenario.
- TV2-024 — Safety / Leak / Mutation Audit.
- TV2-026 — Core Gameplay Loop Closeout.
- TV2-028 — Crew / Station Assignment and Role Ownership.
- TV2-029 — Player Decision Prompt Flow.
- TV2-032 — Reward / Discovery / Clue Runtime.

Post-alpha items should not delay the two-event alpha loop unless a specific alpha dependency is identified.

## Open numbered issues

### TV2-001 — Phase 8D Dev Tools and Resolution Dialogs

**Status:** foundation-complete / closeout-needed  
**Scope:** Alpha support

**Goal:** Complete the GM-facing development and resolution workflow.

**Current note:** Dev tools, dialog-state helpers, session-local forcing, debug report support, and sample setup have foundation coverage. Treat this as Foundry usability closeout, not a rebuild.

**Remaining work:**

- Verify GM-only dev tools panel behavior in Foundry.
- Verify Round Resolution dialog/window opens cleanly from the runner.
- Verify End-of-Event Resolution dialog/window opens cleanly from the runner.
- Verify live completed-session shape support using `status`, `completedAt`, `summary`, and `roundResults`.
- Verify Copy Travel v2 Debug Report action.
- Finish smoke coverage for visibility, GM-only gating, no accidental mutation, dialog state, and debug report keys.

**Safety:** No actor, item, effect, journal, chat, socket, or world mutation without explicit GM confirmation.

### TV2-002 — Station Combo / Inter-Station Help

**Status:** partial  
**Scope:** Alpha blocker

**Goal:** Let stations create benefits for other stations and make station order matter beyond narration.

**Alpha alignment:** Inter-Station Help must be visible as its own gameplay system. Under the hood it may reuse the pending station benefit queue, but the player-facing flow should read as help created by earlier stations and consumed by later stations.

**Slice 01 note:** Event-authored Inter-Station Help action options are now prepared from supported event, round, station-card, and station-prompt definitions; filtered against active stations and station order; exposed through player-safe runner aliases; and surfaced as option-only Inter-Station Help presentation. No assist is created, consumed, rolled, persisted, or applied by this slice.

**Slice 02 note:** Successful explicitly selected authored Inter-Station Help options can now be converted by a pure helper into deterministic, player-safe pending help records with stable dedupe keys, round/order validation, duplicate/block reasons, and inert critical-success strengthening metadata. This slice does not insert records into a queue, consume benefits, roll dice, persist sessions, or mutate actor, item, effect, journal, chat, socket, scene, token, compendium, or world data.

**Slice 03 note:** Explicitly requested successful canonical Inter-Station Help pending records can now be inserted once into the existing session-local `session.travelV2PendingStationBenefits` pending station benefit queue with stable queue identity and raw-state dedupe. Slice 03 preserves unrelated queue rows and remains helper-only; it does not consume the benefit, apply a modifier, activate critical-success strengthening, expire records, perform round-end cleanup, add runner interaction, persist Foundry/world data, roll dice, or mutate actor, item, effect, journal, chat, socket, scene, token, compendium, or world data.

**Slice 04 note:** Available authored Inter-Station Help options now expose a GM-only Review Help flow. The GM can explicitly Queue Help for canonically successful source-station results through the Slice 03 queue helper, after which the runner adopts the returned session locally and rerenders the existing pending station benefit queue. Non-GM users remain read-only. Slice 04 does not consume help, apply modifiers, alter rolls/DCs, activate critical-success strengthening, handle critical-failure backlash, expire records, perform round-end cleanup, or automatically persist the runner session or world data.

**Slice 05 note:** Pending Inter-Station Help can now be explicitly marked used through the GM station-benefit review flow. The runner re-reads the raw `session.travelV2PendingStationBenefits` record by queue key, validates current round, unresolved target, successful source result, and locked source-before-target order, then adopts the returned cloned session locally. Used records remain visible through the existing queue projection, repeated use is blocked without adoption, and non-GM users remain read-only. Slice 05 does not apply a roll modifier, alter a DC, activate critical-success strengthening, create backlash, expire records, perform round-end cleanup, automatically persist the runner session, or mutate actor/item/world data.

**Slice 06 note:** Authored `dcReduction` Help metadata now survives action preparation and queueing with strict magnitude validation, and a GM can explicitly apply an already-used Help record through a separate Help-effect review. Application creates session-local Inter-Station Help application state, marks only the selected used Help row as applied, and reduces the existing canonical station DC; selected approach, station, event, and hazard DC calculation remains authoritative. Stale or tampered applied records are ignored during effective-DC calculation. Applying the Help effect does not roll the check, record a result, advance the station, persist the runner session, or mutate Foundry actor/item/world data. Critical-success strengthening metadata remains inert, and non-GM users remain read-only with no application capability.

**Slice 07 note:** Authored critical-success `replaceMagnitude` strengthening is now supported only for `dcReduction` Inter-Station Help. The critical magnitude is the final total reduction rather than an additive bonus, normal success continues to use the base magnitude, and unsupported or malformed optional critical metadata falls back to the base Help effect. Stale or tampered critical metadata and application records do not affect DC, the target check remains explicit and is not automatically rolled or resolved, automatic benefits remain deferred, and non-GM users remain read-only.

**Slice 08 note:** Inter-Station Help now has deterministic session-local expiration and round-end cleanup. `afterUse` Help remains mechanically active through the target station check and expires only after the target result is recorded; successful round finalization expires remaining `afterUse` and `endOfRound` Help from that round. Expired records remain visible as lifecycle history, matching applications contribute zero, cleanup is immutable and idempotent, and no rolls, result changes, automatic persistence, or Foundry document mutations are introduced.

**Remaining work:**

- Support authored automatic critical-success benefits.
- Integrate critical-failure backlash.
- Support unsupported/custom benefit kinds.
- Finish final player/table UX polish.
- Expand smoke coverage for expiration, backlash, custom benefits, and the completed player-safe lifecycle.

### TV2-003 — Player-Chosen Round Action Order UX Polish

**Status:** foundation-complete / polish remaining  
**Scope:** Alpha blocker

**Goal:** Make the already-smoke-covered round action order path table-ready.

**Alpha alignment:** Station order is chosen before Round 1, remains fixed for the event unless the GM unlocks it, and determines which stations can help later stations.

**Remaining work:**

- Player-facing polish for selecting/reviewing station order before Round 1.
- GM drag/reorder support where available.
- GM lock/unlock support.
- Captain final-say guidance text when players cannot agree.
- Clear GM/player labels for committed vs proposed order.
- Final UX check for startup, saved-session loading, switching, library row status, and persistence.

**Do not rebuild:** State, commit, persistence bridge, library status, startup hardening, and session-switch isolation are already covered.

**Status guidance slice note:** This PR adds a player-safe Round Action Order decision projection that clearly labels Proposed Order, Committed Order, and Needs Decision states, displays Captain final-say guidance before commitment, and keeps a clear GM Ready to Commit message for valid review candidates. It does not add drag-and-drop yet, does not add an unlock/recommit flow yet, and does not rebuild state preparation, commit, persistence, startup, session-switch, or library foundations.

**Remaining polish after this slice:**

- Drag/reorder interaction where practical.
- GM unlock/recommit flow.
- Final Foundry table UX verification.

### TV2-004 — Risk Bids / Difficulty Bids

**Status:** complete for alpha runtime on `feature/tv2-004-risk-bids`
**Scope:** Alpha blocker

**Goal:** Add authored fixed-DC risk bids declared before a station roll.

**Alpha alignment:** Risk bid values are locked as `+2`, `+5`, and `+8`. Risk bids cost nothing up front; the cost is increased danger.

**Closeout note:** TV2-004 now covers fixed `+2`/`+5`/`+8` tiers, safe option preparation, runner state exposure, current round/station/action selection projection, UI select/clear controls, and session-local storage only. It does not add roll/result resolution, actor/world mutation, or GM-only/player leak fields.

**Completed for alpha runtime:**

- Deterministic risk bid data model with fixed bid tiers `+2`, `+5`, and `+8`.
- Safe authored option preparation that drops invalid tiers, dedupes duplicate tiers, and preserves station-flavored player-safe labels/text.
- Runner state exposure through `state.travelV2RiskBids` and `state.riskBids`.
- Current round/station/action selection projection for the runner UI.
- UI select/clear controls for valid authored bids.
- Session-local storage only for selected bids.
- Smoke coverage that rejects freeform arbitrary bid values and guards against GM-only/player leak fields.

**Safety:** Risk bids do not mutate actors or world data. TV2-004 stops at session-local selection and player-safe state projection. Risk bid outcome resolution remains TV2-005.

### TV2-005 — Risk Bid Result Pipeline

**Status:** complete — Slice 20 adds closeout smoke coverage proving the risk bid result pipeline is safely connected from roll result preview through reviewed candidate, queue, selected review, apply intent, apply gate, category plumbing, and final apply preview. TV2-005 is closed as session-local/review-only; true persistent ship mutation remains under the explicit GM persistent apply foundation, not TV2-005.
**Scope:** Alpha blocker

**Goal:** Resolve risk bid outcomes into reviewed Travel v2 effects.

**Remaining work:**

- Slice 01 adds the pure result model and reviewed candidate preview contract.
- Slice 02 exposes the result model in Travel Event Runner state as read-only `travelV2RiskBidResultPreview` / `riskBidResultPreview` aliases fed by session-local/UI state only. It does not apply outcomes, roll dice, insert queue items, or mutate actors/world/session state.
- Slice 03 adds a pure bridge from risk bid result candidates into normalized reviewed candidate records. It does not insert queues, apply pressure/hazards/consequences, roll dice, or mutate actors/world/session state.
- Slice 04 adds a pure queue-review adapter that prepares queue-ready review payload shapes from reviewed candidates. It does not insert queues, apply pressure/hazards/consequences, roll dice, or mutate actors/world/session state.
- Slice 05 exposes those queue-ready review payloads as GM-facing Travel Event Runner pending review state aliases, without inserting queue items, applying payloads, rolling dice, or mutating actors/world/session state.
- Slice 06 adds a pure GM insertion-intent preparation helper for pending review payloads. It prepares deterministic request objects only, and still does not insert queue items, apply effects, apply pressure/hazards/consequences, award Momentum, create scars, or mutate actors/world/session state.
- Slice 07 adds a pure session-local pending risk bid review queue insertion transformer. It returns a cloned session plus a minimal queue patch only, and does not persist data, apply effects, apply pressure/hazards/consequences, award Momentum, create scars, or mutate actors/world/session state.
- Slice 08 wires GM-only runner persistence for the session-local pending risk bid review queue through the existing runner session save path. It only saves pending review records and still does not apply pressure, hazards, consequences, Momentum, rewards, scars, actor changes, world changes, chat messages, journal entries, or sockets.
- Slice 09 adds GM-only Travel Event Runner template presentation for the pending risk bid review queue, safe pending payload/record summaries, the existing persist action, and the persist result message. It does not add new application behavior or mark TV2-005 complete.
- Slice 10 adds GM-only session-local queued risk bid review decision actions: mark reviewed, dismiss, restore pending, select for later apply review, clear one selection, and clear all selections. It does not apply pressure, hazards, consequences, Momentum, rewards, scars, actor changes, world changes, chat messages, journal entries, sockets, or compendium writes. Slice 11 adds a pure GM-only selected-record review preview bridge and minimal runner summary for later resolution readiness; it remains preview-only and does not apply pressure, hazards, consequences, Momentum, rewards, scars, actor changes, world changes, chat messages, journal entries, sockets, or compendium writes. Slice 12 adds a pure GM-only apply-intent preparation layer for selected review previews; it is intent-only and still does not apply pressure, hazards, consequences, Momentum, rewards, scars, actor changes, world changes, chat messages, journal entries, sockets, or compendium writes. Slice 13 adds a pure GM-only apply gate / execution shell for confirmed risk bid review apply intents; it is gate-only, defaults the runner to preview mode, and still does not apply pressure, hazards, consequences, Momentum, rewards, scars, actor changes, world changes, chat messages, journal entries, sockets, or compendium writes. Slice 14 adds pressure-only reviewed risk bid plumbing through a safe session-local pressure plan/result; it does not mutate actors, items, world data, chat, journals, sockets, compendia, or queue record statuses. Slice 15 adds hazard-only reviewed risk bid plumbing through a safe session-local hazard plan/result; it does not mutate actors, items, world data, chat, journals, sockets, compendia, or queue record statuses. Slice 16 adds consequence-only reviewed risk bid plumbing through a safe session-local consequence plan/result; it does not mutate actors, items, world data, chat, journals, sockets, compendia, or queue record statuses. Slice 17 adds benefit/Momentum/reward reviewed risk bid plumbing through a session-local positive-outcome plan/result; it does not mutate actors, items, world data, chat, journals, sockets, compendia, or queue record statuses. Slice 18 adds ship scar reviewed risk bid plumbing through a safe session-local scar plan/result; it does not mutate actors, items, world data, chat, journals, sockets, compendia, or queue record statuses. Slice 19 adds a GM-only final apply orchestration preview/stage/commit layer combining pressure, hazard, consequence, benefit/Momentum/reward, and scar plumbing into one session-local final apply result; it remains session-local and does not mutate actors, items, world data, chat, journals, sockets, or compendia.
- Slice 20 adds a final closeout helper and GM-only runner/template summary for the completed risk bid result pipeline. It remains preview/closeout-only: no actor, item, world, chat, journal, socket, compendium, dice, or persistent ship mutation occurs.
- Critical success: stronger benefit, Momentum, major progress, or improved reward.
- Success: selected benefit or progress.
- Failure: consequence candidate, pressure, hazard progress, station complication, or next-round difficulty.
- Critical failure: stronger consequence, hazard escalation, ship scar candidate, severe pressure spike, or additional hazard.
- Make `+8` failures meaningfully dangerous.
- Smoke all four result bands.

### TV2-006 — Momentum Spend Catalog

**Status:** partial  
**Scope:** Alpha blocker

**Goal:** Turn Momentum from a tracked resource into a meaningful player/GM decision system.

**Alpha alignment:** Momentum is shared by the crew, tied to the ship actor where practical, visible to players, and resets at event end.

**Remaining work:**

- Define alpha spend options.
- Add review/apply flow for Momentum spends where needed.
- Integrate with risk bids, hazards, station benefits, pressure prevention, and final outcome adjustment.
- Support GM-awarded Momentum for excellent roleplay or clever planning.
- Smoke player-safe preview, no duplicate spend, event-end reset, and no silent mutation.

**Candidate alpha spends:**

- Reveal clearer hidden hazard tell.
- Suppress a hazard effect.
- Improve a benefit.
- Add limited bonus where allowed.
- Prevent or reduce pressure where allowed.

### TV2-007 — Hazard Mechanical Completion

**Status:** partial  
**Scope:** Alpha blocker

**Goal:** Make hazards change gameplay, not just display as pressure or flavor.

**Alpha alignment:** Each alpha event should have one authored main evolving hazard and optional event-tagged secondary hazards. Six hazard forms should be covered across alpha work.

**Remaining work:**

- Station modifier hazards.
- Station lockout hazards.
- Countdown hazards.
- Pressure cascade hazards.
- Response action hazards.
- Consequence or scar handoff hazards.
- Focus suppression application if still compatible with the locked Focus rule.
- Response action execution.
- Clear/suppress/resolve lifecycle.
- Countdown and duration handling.
- Unresolved consequence handoff.
- Escalation to ship scar or other reviewed consequences.
- Persistence and reload behavior.
- Hidden hazard tells and Momentum reveal support.

**Do not rebuild:** Hazard deck registry, picker, runtime selection, draw review, handoff review, candidate controls, lifecycle display, response action wiring, and station impact reviews already have foundation coverage.

### TV2-008 — Consequence Queue Expansion

**Status:** partial  
**Scope:** Alpha blocker

**Goal:** Unify how consequences enter review from multiple Travel v2 systems.

**Remaining work:**

- Feed consequence candidates from risk bids.
- Feed consequence candidates from unresolved hazards.
- Feed consequence candidates from pressure overflow or severe pressure events.
- Feed consequence candidates from Focus backlash.
- Feed consequence candidates from inter-station help backlash.
- Feed consequence candidates from final outcome packages.
- Smoke queueing, dedupe, player-safe preview, GM approve/dismiss/defer, and persistence boundaries.

### TV2-009 — Explicit GM Persistent Apply Foundation

**Status:** partial  
**Scope:** Alpha blocker

**Goal:** Create a strict, reusable framework for all persistent Travel v2 mutations.

**Alpha alignment:** Apply-to-ship requires a final GM confirmation summary and creates an audit/history record for later Voyage Log use.

**Remaining work:**

- Standard reviewed apply contract.
- Standard mutation audit record.
- Standard no-op / blocked reason handling.
- Standard actor/item/world mutation boundary.
- Standard final confirmation summary.
- Standard smoke for no chat/journal/socket side effects unless explicitly requested.

**Do not rebuild:** Actor application bridge exists; this is the broader safe apply framework around it.

### TV2-010 — Station Action Card Runtime

**Status:** missing / partial  
**Scope:** Alpha blocker

**Goal:** Consume authored station action cards during Travel v2 runtime.

**Alpha alignment:** Players discuss station actions openly, then lock their actions before station-by-station resolution. A locked action cannot be changed because another station rolled well or badly.

**Remaining work:**

- Load station action card definitions from encounter/content data.
- Present available station actions by station and round context.
- Attach rolls, DCs, risk bids, Focus availability, success bands, benefit hooks, and consequence hooks.
- Add action lock-in state.
- Add action-specific vignette text on player station cards.
- Smoke schema compatibility, invalid-card rejection, lock-in behavior, and player-safe projections.

### TV2-011 — Station Benefit Card Runtime

**Status:** missing / partial  
**Scope:** Alpha blocker

**Goal:** Make authored station benefit cards flow through the existing pending-benefit queue and review/use path.

**Remaining work:**

- Consume benefit card definitions.
- Create pending benefits from station action outcomes.
- Let later stations review/use benefits.
- Support critical success stronger/automatic benefit rules.
- Expire or carry benefits based on card rules.
- Smoke lifecycle and no duplicated use.

### TV2-012 — Risk Bid Card Runtime

**Status:** missing  
**Scope:** Alpha blocker

**Goal:** Make authored risk bid cards available to station action runtime.

**Remaining work:**

- Define/import risk bid card schema.
- Support fixed bid tiers `+2`, `+5`, and `+8`.
- Attach allowed bids to station actions or encounter context.
- Enforce fixed DC increases.
- Add station-flavored labels and text.
- Resolve bid outcomes through TV2-005.

### TV2-013 — Encounter Template Preview and Runtime

**Status:** missing / partial  
**Scope:** Alpha support

**Goal:** Support complete authored Travel v2 encounter templates from content packs.

**Remaining work:**

- Define encounter template shape.
- Preview encounter template in Foundry.
- Start runtime session from template.
- Validate minimum 3 and maximum 12 rounds.
- Validate all five core stations are present for playable alpha events.
- Validate rounds, stations, hazards, consequences, rewards, follow-ups, and aftermath.
- Smoke malformed template rejection and safe import.

### TV2-014 — ChatGPT Content Builder Export Contract

**Status:** partial  
**Scope:** Post-alpha unless needed by alpha event authoring

**Goal:** Establish a reliable two-GPT authoring flow.

**Remaining work:**

- Story/content GPT writes adventure text.
- JSON/builder GPT converts to validated Travel v2 JSON.
- Foundry validates and previews the JSON before import.
- Smoke export/import compatibility and error reports.

### TV2-015 — Content Pack Validator and Safe Import/Export

**Status:** partial  
**Scope:** Alpha support / post-alpha expansion

**Goal:** Make Travel v2 content packs safe to author, validate, import, export, and select at runtime.

**Remaining work:**

- Validator CLI or dev helper.
- Foundry import preview UI.
- Safe export path.
- Pack metadata and versioning.
- Runtime pack selection.
- Smoke invalid pack handling.

### TV2-016 — Gold-Standard Encounter Sample

**Status:** missing  
**Scope:** Alpha blocker

**Goal:** Create complete Travel v2 encounters that prove the whole system works as intended.

**Alpha alignment:** The locked alpha goal expands this from one sample encounter to two playable alpha events: updated `The Lantern in the Static` and a second physical/voidfaring event such as `Shattered Chain Drift`.

**Must include:**

- Stakes.
- Station actions.
- Risk bids.
- Focus.
- Station benefits / Inter-Station Help.
- Hazards.
- Consequences.
- Momentum.
- Final outcome.
- Rewards/follow-ups/aftermath.
- Full smoke and manual Foundry acceptance path.

### TV2-017 — Expanded Content Packs

**Status:** missing  
**Scope:** Post-alpha

**Goal:** Build enough authored cards and encounters to make Travel v2 feel rich at the table.

**Remaining work:**

- More station action cards.
- More risk bid cards.
- More station benefit cards.
- More consequence cards.
- More hazard cards.
- More encounter templates.

### TV2-018 — Visible Stakes Runtime

**Status:** complete for alpha runtime
**Scope:** Alpha blocker closeout

**Goal:** Give players and GM a clear view of what is at stake before and during each event.

**Alpha alignment:** Players see general event stakes at setup and sharper round-specific stakes as the event unfolds.

**Closeout notes:**

- The canonical visible-stakes helper prepares player-safe runtime state.
- Runner state exposes the helper output as `travelV2VisibleStakes` and `visibleStakes`.
- The Travel Event Runner template displays the player-safe visible-stakes panel from `state.visibleStakes`.
- Hidden GM-only details remain outside the visible-stakes template block.
- Slice 04 adds aggregate smoke coverage for helper → runner state → runner template wiring.

### TV2-019 — Narration Hook Assembly

**Status:** complete for alpha runtime
**Scope:** Alpha blocker closeout

**Goal:** Assemble narration hooks from the actual mechanics that happened.

**Alpha alignment:** Travel v2 alpha exposes player-safe narration hooks for the GM to use while framing dynamic round narration.

**Closeout notes:**

- The canonical narration-hook helper prepares player-safe runtime hook state.
- Runner state exposes the helper output as `travelV2NarrationHooks` and `narrationHooks`.
- The Travel Event Runner UI displays narration hooks from `state.narrationHooks`.
- Player-safe smoke coverage guards against GM-only/internal leakage.
- Slice 04 adds closeout smoke coverage across helper, runner state, template, and CSS contracts.

### TV2-020 — Final Outcome and Aftermath Expansion

**Status:** complete for alpha runtime
**Scope:** Alpha blocker closeout

**Goal:** Make event completion produce a useful aftermath package.

**Closeout notes:**

- Final outcome aftermath now summarizes completion context, unresolved hazards, consequences, rewards, clues, route advantages, follow-ups, scars, and pressure changes.
- Runner state exposes final outcome and preservation review state through short aliases for the Travel Event Runner UI.
- The Travel Event Runner displays Final Outcome & Aftermath, Final Outcome Preservation Review, and Final Outcome Preservation Apply Plan sections.
- Preservation now has a reviewed apply-plan path, session-local preservation application, selected ship actor preview bridge, and explicit GM controls for previewing selected-ship attachments and applying preservation to the local completed session.
- The completed-session preservation path remains explicit and GM-facing; actor/world persistence still requires reviewed apply paths.
- Smoke coverage guards helper output, runner state wiring, template rendering, session-local application, actor-preview safety, forbidden-field leakage, and mutation boundaries.

### TV2-021 — Player HUD Polish

**Status:** missing / partial  
**Scope:** Alpha blocker

**Goal:** Make the player-facing Travel v2 UI clear, safe, and table-ready.

**Alpha alignment:** Players see their station, current action choices, action-specific vignette, allowed risk bid options, help options, Focus availability, roll button, allowed Momentum options, shared Momentum, and immediate round context.

**Remaining work:**

- Player-safe HUD state.
- Current station/action context.
- Action-specific vignette.
- Help/benefit availability.
- Risk bid selection state.
- Focus availability and spent state.
- Momentum visibility.
- Hazard visibility for revealed hazards.
- No GM-only consequence queue, hidden hazards, unrevealed backlash, internal scoring, debug reports, future triggers, or hidden consequence trees.

### TV2-022 — GM Pending Decisions UI

**Status:** missing / partial  
**Scope:** Alpha blocker

**Goal:** Give the GM one unified queue for unresolved Travel v2 decisions.

**Remaining work:**

- Pending consequences.
- Pending station benefits.
- Pending hazards.
- Pending Momentum spend reviews where required.
- Pending Focus backlash.
- Pending help backlash.
- Pending outcome package changes.
- Approve/dismiss/defer/use controls.
- Player-safe boundaries.

### TV2-023 — End-to-End Table Test Scenario

**Status:** missing  
**Scope:** Alpha blocker

**Goal:** Create a full scripted scenario for manual Foundry testing.

**Remaining work:**

- Setup instructions.
- Sample ship.
- Sample crew/stations.
- Two alpha events.
- Expected round-by-round decisions.
- Expected risk bid, Focus, Momentum, help, and hazard interactions.
- Expected final outcome.
- Smoke/manual acceptance checklist.

### TV2-024 — Safety / Leak / Mutation Audit

**Status:** closeout-needed  
**Scope:** Alpha blocker

**Goal:** Audit Travel v2 before any beta-style release for player-safe output and mutation boundaries.

**Remaining work:**

- Player-safe render state audit.
- GM-only/internal field audit.
- Actor/item/world mutation audit.
- Chat/journal/socket side-effect audit.
- Persistence/reload audit.
- Verify no silent mutation from rolls, risk bids, Focus, Momentum, hazards, outcomes, or completion.

### TV2-025 — Beta Readiness Pass

**Status:** final  
**Scope:** Post-alpha

**Goal:** Prepare Travel v2 for a beta-style release.

**Roadmap alignment:** Do not begin real beta work until Travel Alpha, Combat Alpha, and Upgrade / Progression Alpha are all playable according to `ARCFLIGHT_ALPHA_PILLAR_ROADMAP.md`.

**Remaining work:**

- Docs.
- Smoke runner closeout.
- Manual Foundry acceptance.
- Known limitations.
- Upgrade notes.
- Release checklist.

### TV2-026 — Core Gameplay Loop Closeout

**Status:** closeout-needed  
**Scope:** Alpha blocker

**Goal:** Prove Travel v2 feels like a complete gameplay loop instead of a set of disconnected helpers.

**Must prove two complete alpha events include:**

- Visible stakes.
- Player-owned station order.
- Station action choices.
- Action lock-in.
- Inter-station help.
- Risk bids.
- Focus.
- Momentum spend.
- Active hazard interaction.
- Consequence queue review.
- Round Resolution flow.
- End-of-Event Resolution flow.
- Explicit GM apply.
- Audit/history record.
- Aftermath, rewards, and follow-ups.

### TV2-027 — Voyage Route / Event Chain Frame

**Status:** missing  
**Scope:** Post-alpha

**Goal:** Add the voyage layer above individual Travel v2 events.

**Roadmap alignment:** This is not part of the two-event Travel Alpha blocker set unless a narrow handoff is needed for event rewards/follow-ups.

**Remaining work:**

- Define origin, destination, route, leg, travel day/hex, and arrival state.
- Allow a voyage to contain multiple Travel v2 events.
- Track completed, skipped, failed, or deferred events within a voyage.
- Carry route consequences, advantages, hazards, clues, and detours between events.
- Smoke event-to-event handoff and no accidental persistence without GM confirmation.

### TV2-028 — Crew / Station Assignment and Role Ownership

**Status:** missing / partial  
**Scope:** Alpha blocker

**Goal:** Make it clear who owns each station at the table.

**Remaining work:**

- Assign player/actor/NPC crew to Navigator, Engineer, Veilwarden, Watchmaster, Captain, and any future stations.
- Handle missing stations safely.
- Handle duplicate or substitute stations safely.
- Show who is up next.
- Preserve player-safe output.
- Smoke assignment, reassignment, missing station fallback, and saved-session reload.

### TV2-029 — Player Decision Prompt Flow

**Status:** missing  
**Scope:** Alpha blocker

**Goal:** Guide players through station decisions instead of making the GM manually ask every question.

**Prompt chain:**

- Choose station action.
- Lock station action.
- Choose optional risk bid if the action allows it.
- Choose whether to spend Focus if the action allows it.
- Choose whether to use queued help if available.
- Choose Momentum spend if allowed.
- Roll/resolve.
- Choose response action if a hazard triggers.

**Safety:** Player prompts create session-local requests until the GM confirms reviewed effects.

### TV2-030 — Between-Round / Between-Event Recovery

**Status:** missing / partial  
**Scope:** Post-alpha unless an alpha event explicitly uses it

**Goal:** Define what recovery and maintenance look like during a voyage.

**Questions to answer:**

- Can the crew repair between rounds?
- Can the crew recover Lifeveil, Morale, Supplies, Cargo, Strain, or Hull between events?
- What actions cost supplies or time?
- What can happen at port, safe harbor, or after a long rest?
- Which recovery choices are player-driven and which require GM approval?

### TV2-031 — Failure / Retreat / Abort Flow

**Status:** missing / partial  
**Scope:** Alpha support / post-alpha expansion

**Goal:** Make bad outcomes playable instead of letting the event simply stop.

**Remaining work:**

- Abandon route.
- Retreat.
- Emergency jump.
- Fail forward.
- Ship disabled state.
- Event transforms into a new problem.
- GM-approved abort/retreat controls.
- Smoke early-end, abort, retreat, and fail-forward state.

### TV2-032 — Reward / Discovery / Clue Runtime

**Status:** missing / partial  
**Scope:** Alpha blocker

**Goal:** Give players positive mechanical and story reasons to engage with Travel v2.

**Reward types:**

- Route advantage.
- Map clue.
- Faction clue.
- Salvage.
- Cargo.
- Morale gain.
- Safe harbor.
- Shortcut.
- Hazard knowledge.
- New contact or follow-up.

### TV2-033 — Travel Event Selection / Trigger Runtime

**Status:** missing  
**Scope:** Post-alpha

**Goal:** Support both GM-authored event triggers and random/weighted event selection.

**Remaining work:**

- GM-selected event trigger.
- Route-beat trigger.
- Random event table/deck.
- Weighted event selection by region, route, danger, biome, faction, or story state.
- Repeat protection and cooldowns.
- Event preview before launch.
- Support multiple events during one voyage.
- Smoke deterministic random selection and GM-forced event selection.

### TV2-034 — GM Voyage Director Tools

**Status:** missing  
**Scope:** Post-alpha

**Goal:** Keep the GM present as storyteller and pacing director while the players drive ship actions.

**Remaining work:**

- GM chooses next event from available candidates.
- GM pins authored events to voyage legs.
- GM marks story-triggered events.
- GM mixes random events with curated events.
- GM adjusts pacing between calm, danger, discovery, social, and crisis beats.
- GM can defer or replace an event without corrupting voyage/session state.
- Smoke GM-only visibility and no player leakage of hidden event candidates.

### TV2-035 — GM Override / Edit Tools

**Status:** missing / partial  
**Scope:** Alpha support / post-alpha expansion

**Goal:** Give the GM safe live-table correction tools that are distinct from dev/test tools.

**Remaining work:**

- Edit pending consequence.
- Edit pressure delta.
- Edit final outcome note.
- Override blocked reason.
- Manually add/remove pending benefit.
- Manually mark hazard resolved.
- Undo last local step before apply.
- Smoke GM-only gating, audit record, and no silent mutation.

### TV2-036 — Tutorial / Table Onboarding

**Status:** missing  
**Scope:** Post-alpha

**Goal:** Make Travel v2 usable without the GM explaining every button and term live.

**Remaining work:**

- GM quickstart.
- Player quickstart.
- Station role summary.
- Risk bid explanation.
- Focus explanation.
- Momentum explanation.
- Hazard explanation.
- Round-end explanation.
- Event-end explanation.
- Minimal in-app help text or docs link.

## Completed / foundation-complete systems

These systems should generally be treated as existing foundations rather than rebuilt:

- Core Travel v2 state.
- Pressure engine and round pressure adapter.
- Round action order state, commit, persistence, library status, startup, and session-switch hardening.
- Runner bridge and preview state.
- Pressure application and pressure correction.
- Round finalization.
- Event completion readiness and session event completion.
- Completed summary export.
- Event outcome package and outcome application.
- Actor application bridge.
- Follow-ups.
- Hazards foundation.
- Ship scars.
- Narration foundation.
- Stabilize/repair.
- Momentum foundation.
- Focus backlash records.
- Support action targeting, assist records, support backlash, and Focus risk suppression.
- Runner preview consumer/panel.
- Saved-session library/order status closeout.
- Saved-session context/session-switch isolation.
- Travel v2 sample event.
- Travel v2 dev tools foundation.
- Round resolution readiness.
- Completion checklist.
- Builder/importer compatibility.
- Card schema and card schema import adapter.
- Consequence catalog.
- Built-in hazard deck registry, picker UI, and runtime selection.
- Hazard draw review, active hazard handoff review, hazard candidate controls, active hazard lifecycle display.
- Response action wiring.
- Station impact behavior and station impact modifier review.
- Pending station benefit queue and station benefit use review.

## Safety rules

All future Travel v2 work must preserve these rules unless a PR explicitly changes them with smoke coverage:

- No automatic actor mutation.
- No automatic item creation.
- No automatic active effect creation.
- No automatic journal creation.
- No automatic chat output.
- No automatic socket emission.
- No player-facing leak of GM-only/internal fields.
- Persistent changes require explicit GM confirmation.
- Runtime helpers should remain deterministic and smoke-testable.
- Prefer session-local records until a reviewed apply path is used.

## Standard validation

At minimum, run:

```bash
node scripts/dev/run-travel-v2-smoke.mjs
node scripts/dev/run-foundry-check-runner-smoke.mjs
```

Add `node --check` and focused smoke commands for any touched files.
