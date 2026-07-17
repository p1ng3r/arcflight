# Travel v2 Open Issues

Status: implementation tracker with shared-round-planning correction active.

This document is the repo-local implementation tracker for Travel v2. It is not the top-level Arcflight roadmap and it is not the complete Travel Alpha gameplay specification.

Use the current documents in this order:

1. `docs/ARCFLIGHT_ALPHA_PILLAR_ROADMAP.md` — top-level sequencing and pillar priority.
2. `docs/TRAVEL_V2_SHARED_ROUND_PLANNING_AND_RISK_BIDS.md` — canonical rules for Crew Planning, round-specific station order, authored Risk Bids, reward targeting, and stable reorder behavior.
3. `docs/TRAVEL_V2_ALPHA_GOAL.md` — complete Travel Alpha gameplay goal.
4. This file — numbered implementation tracker for Travel v2 work items.
5. GitHub Issues — live ticket discussion and PR-sized work tracking.

When this tracker conflicts with either canonical Travel Alpha document, use the more specific canonical document unless a later documentation PR intentionally changes the design.

## Scope labels

Each numbered item may use one of these scope labels:

- **Alpha blocker:** required before Travel Alpha can be called playable.
- **Alpha support:** useful for alpha or needed by an alpha blocker, but not necessarily a standalone blocker.
- **Post-alpha:** important Travel v2 work that should not block the two-event alpha loop.
- **Foundation / historical:** existing foundation, closeout notes, or work that should not be rebuilt unless a focused smoke test exposes a bug.

Status language may include:

- `missing`
- `partial`
- `foundation-complete`
- `design correction required`
- `closeout-needed`
- `complete`

A foundation may remain useful even when the player-facing workflow built on top of it requires correction.

## Current status

Travel v2 has substantial foundation coverage already. The aggregate smoke runner covers core Travel v2 state, pressure, round pressure, legacy round-action-order state, persistence bridges, library order status, runner preview, pressure application and correction, round finalization, event completion, completed-summary export, outcome packages, actor application bridge, follow-ups, hazards, ship scars, narration, stabilize and repair, Momentum, Focus and support records, runner UI consumers, saved-session startup and session-switch hardening, sample events, dev tools foundation, card schema and import compatibility, consequence catalog, hazard deck selection, hazard review paths, response-action wiring, station-impact behavior, station-impact modifier review, the pending station-benefit queue, and station-benefit use review.

Those foundations should be reused where they fit the corrected design.

They do not make the old player workflow acceptable. Manual Foundry testing established that the legacy station-order UI is GM-centered, buried in Advanced Runner Details, selected for the event rather than freshly for each round, and rebuilt through a full runner render after each movement. TV2-003 therefore remains the highest-priority Travel Alpha gameplay blocker.

## Gameplay ownership principle

Travel v2 should keep the GM present as voyage director without replacing player decisions with an automated board game.

- The GM builds the voyage premise, major story turns, and authored events.
- The GM may choose specific events at specific route beats.
- The GM may also use random or weighted event picks when improvisation is desired.
- A single voyage can contain multiple Travel v2 events.
- Every round begins with shared player-facing Crew Planning.
- Players review every active station's player-safe actions and authored Risk Bids.
- Players collaboratively choose the current round's station order.
- The Captain has final say when the crew cannot agree.
- The GM retains override and unlock controls for table management.
- Player choices drive station actions, Risk Bids, Focus, Momentum spends, hazard responses, consequences, and final outcomes.
- Helping another station is one possible authored Risk Bid reward, not a separate universal action menu.
- The system should make player-driven ship actions mechanically meaningful while leaving pacing, story emphasis, hidden information, and event curation in the GM's hands.

## Numbering rules

- Use `TV2-###` numbers for this document.
- Use GitHub Issues for live tickets and discussion.
- Use PR numbers only for implementation history.
- Prefer small smoke-first PRs.
- Every runtime feature needs focused smoke coverage and aggregate Travel v2 smoke wiring.
- Alpha work should map back to `docs/TRAVEL_V2_ALPHA_GOAL.md`.
- Shared Crew Planning, round order, and Risk Bid behavior should map back to `docs/TRAVEL_V2_SHARED_ROUND_PLANNING_AND_RISK_BIDS.md`.
- Do not mark an item complete merely because an obsolete workflow passes its old tests.

## Alpha blocker summary

These implementation areas most directly define or block the locked Travel Alpha goal; some contain reusable foundations but still need corrective integration:

- TV2-003 — Shared Crew Planning and Round-Specific Station Order.
- TV2-010 — Station Action Card Runtime.
- TV2-012 — Authored Risk Bid Card Runtime.
- TV2-004 — Fixed Risk Bid Tiers and Selection.
- TV2-011 — Station Benefit Card Runtime.
- TV2-002 — Authored Risk Bid Benefits and Cross-Station Support.
- TV2-005 — Risk Bid Result Pipeline.
- TV2-021 — Shared Player Planning and Station HUD.
- TV2-029 — Player Decision Prompt Flow.
- TV2-006 — Momentum Spend Catalog.
- TV2-007 — Hazard Mechanical Completion.
- TV2-008 — Consequence Queue Expansion.
- TV2-009 — Explicit GM Persistent Apply Foundation.
- TV2-016 — Two Gold-Standard Alpha Events.
- TV2-018 — Visible Stakes Runtime.
- TV2-019 — Narration Hook Assembly.
- TV2-020 — Final Outcome and Aftermath Expansion.
- TV2-022 — GM Pending Decisions UI.
- TV2-023 — End-to-End Multiplayer Table Test Scenario.
- TV2-024 — Safety / Leak / Mutation Audit.
- TV2-026 — Core Gameplay Loop Closeout.
- TV2-028 — Crew / Station Assignment and Captain Role Ownership.
- TV2-032 — Reward / Discovery / Clue Runtime.

Post-alpha items should not delay the two-event alpha loop unless a specific alpha dependency is identified.

## Immediate corrective priority

Implement and verify the corrected gameplay path in this order:

1. Replace legacy event-wide order assumptions with a current-round `crewPlanning` phase.
2. Present every active station and every current player-safe station action to all connected players.
3. Present each action's authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids before order selection.
4. Synchronize proposed order changes across GM and player clients.
5. Add Captain confirmation and GM override or unlock.
6. Block action and Risk Bid lock-in until order confirmation.
7. Integrate authored reward targets, timing, duration, expiration, bonus cards, hazards, backlash, and consequence protection.
8. Replace whole-runner reorder renders with targeted planning-panel updates that preserve open state, scroll, and focus.
9. Replace obsolete smokes and the old Foundry checklist with corrected multiplayer coverage.
10. Run complete GM-plus-player Foundry acceptance before closing TV2-003.

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

### TV2-002 — Authored Risk Bid Benefits and Cross-Station Support

**Status:** foundation-complete in part / design correction required
**Scope:** Alpha blocker

**Goal:** Reuse the existing pending-station-benefit machinery for authored Risk Bid rewards that may affect the acting station, another station, a later station, a future round, the crew, the ship, a hazard, backlash, a consequence, or an event reward.

**Corrected Alpha alignment:**

- Helping another station is one possible authored Risk Bid reward.
- Inter-Station Help is not a separate universal player action category.
- Some Risk Bids affect only the acting station.
- Some affect the next station or another chosen later station.
- Some affect a future round.
- Some create player-facing bonus cards.
- Some suppress hazards, weaken backlash, or prevent or downgrade consequences.
- Order-dependent benefits must clearly describe their valid target and timing during Crew Planning.

**Reusable historical foundation:**

The existing TV2-002 slices provide useful deterministic records, queue insertion, review, use, `dcReduction`, critical-success magnitude replacement, expiration, and round-end cleanup. Preserve and generalize that machinery where it fits the corrected authored-reward model.

**Historical Slice 01 note:** Event-authored Inter-Station Help action options are prepared from supported event, round, station-card, and station-prompt definitions; filtered against active stations and station order; exposed through player-safe runner aliases; and surfaced as option-only presentation. No assist is created, consumed, rolled, persisted, or applied by this slice.

**Historical Slice 02 note:** Successful explicitly selected options can be converted by a pure helper into deterministic, player-safe pending benefit records with stable dedupe keys, round/order validation, duplicate/block reasons, and inert critical-success strengthening metadata.

**Historical Slice 03 note:** Explicitly requested successful canonical pending records can be inserted once into `session.travelV2PendingStationBenefits` with stable queue identity and raw-state dedupe while preserving unrelated queue rows.

**Historical Slice 04 note:** Available options expose a GM-only review flow that can queue canonically successful source-station results through the existing helper. This is reusable review infrastructure, not the intended ordinary player-facing planning workflow.

**Historical Slice 05 note:** Pending benefits can be explicitly marked used after validation of round, target, source result, and order.

**Historical Slice 06 note:** Authored `dcReduction` metadata survives action preparation and queueing with strict magnitude validation, and a GM can explicitly apply an already-used record through a separate effect review.

**Historical Slice 07 note:** Authored critical-success `replaceMagnitude` strengthening is supported for `dcReduction` benefits.

**Historical Slice 08 note:** Pending benefits have deterministic session-local expiration and round-end cleanup. Expired records remain visible as lifecycle history, matching applications contribute zero, and cleanup is immutable and idempotent.

**Remaining corrective work:**

- Generalize benefit records beyond the old Help label.
- Support target types for self, self-next-roll, self-next-round, next station, chosen later station, chosen station, specific station, crew, ship, hazard, backlash, consequence, and reward.
- Support authored roll bonuses such as `+2`, `+3`, and `+5`.
- Support `2d20` and keep the highest.
- Support future DC reduction.
- Support one-degree failure improvement.
- Support player-facing bonus cards with timing, duration, expiration, optional use, consumption, and transfer rules.
- Support consequence prevention and downgrade.
- Support hazard and backlash suppression.
- Integrate authored critical-failure danger.
- Keep GM review for persistent changes without making the GM the ordinary owner of player benefits.
- Expand smoke coverage for every supported target, timing, expiration, invalid target, dedupe, no duplicate use, redaction, and no silent mutation.

### TV2-003 — Shared Crew Planning and Round-Specific Station Order

**Status:** design correction required / highest-priority Travel Alpha blocker
**Scope:** Alpha blocker

**Goal:** Make the beginning of every round a synchronized player-facing Crew Planning phase where all players review every active station action and its authored Risk Bids before choosing the current round's station order.

**Corrected Alpha alignment:**

- Every round begins with Crew Planning.
- Every connected player sees every active station.
- Every player sees every current player-safe station action.
- Every action displays its authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
- Each Risk Bid displays its player-safe reward, target, timing, and danger.
- Players arrange the current round's order together.
- The Captain has final say when the crew cannot agree.
- The Captain confirms the order.
- The GM retains override and unlock controls.
- Station actions and Risk Bids cannot lock or resolve until the order is confirmed.
- The committed order applies only to the current round.
- The next round opens a fresh Crew Planning phase.
- The previous order may be a starting suggestion but must not remain automatically committed.

**Discovered blocker:**

The current implementation is based on the obsolete workflow. It is primarily GM-controlled, buried in Advanced Runner Details, built around an event-wide order, and performs a full Travel Event Runner render after candidate movement. Manual Foundry testing showed that moving one station collapses the details panel and returns the user to the top. That is not acceptable table UX.

**Reusable foundation:**

Preserve and adapt the existing deterministic candidate movement, target-index movement, midpoint drop geometry, drag runtime, drag handles, commit records, persistence bridge, reload handling, session-switch isolation, and redaction where they remain useful.

Existing automated acceptance proves the legacy contract only. It must not be used to close the corrected TV2-003.

**Required implementation:**

1. Add a current-round `crewPlanning` phase.
2. Add round-specific proposed and committed order state.
3. Preserve completed-round order as history.
4. Expose all active stations and current player-safe actions to every connected player.
5. Expose all three authored Risk Bid tiers before order selection.
6. Add synchronized multiplayer proposed-order updates.
7. Add deterministic conflict, stale-message, and unauthorized-message handling.
8. Add Captain confirmation.
9. Add GM override and unlock.
10. Block action and Risk Bid lock-in until confirmation.
11. Replace full-runner movement renders with targeted planning-panel updates.
12. Preserve open-panel state, scroll position, and keyboard focus.
13. Replace the obsolete Foundry checklist with corrected multiplayer verification.

**Completion gate:**

TV2-003 is complete only after:

- focused corrected-design smokes pass;
- aggregate Travel v2 smoke passes;
- GM-plus-player synchronization tests pass;
- the replacement Foundry checklist passes;
- exact Foundry, PF2e, browser, operating system, module, and commit details are recorded;
- no player-facing hidden information leak is observed;
- no unintended actor, item, effect, journal, chat, socket, scene, token, compendium, or world mutation is observed.

**Canonical references:**

- `docs/TRAVEL_V2_SHARED_ROUND_PLANNING_AND_RISK_BIDS.md`
- `docs/TRAVEL_V2_TV2_003_FOUNDRY_VERIFICATION.md`

### TV2-004 — Authored Fixed-Tier Risk Bids and Selection

**Status:** fixed-tier foundation-complete / corrective integration required
**Scope:** Alpha blocker

**Goal:** Provide deterministic authored Risk Bid choices at `+2 DC`, `+5 DC`, and `+8 DC` for every station action.

**Corrected Alpha alignment:**

- Every station action has all three authored tiers.
- Every tier has its own player-safe reward, target, timing, and danger.
- The tiers are visible to every player during Crew Planning before order selection.
- A station selects and locks one tier only after the current round's order is confirmed.
- The higher DC is the bid's immediate cost.
- The selected tier's authored danger is staged on failure or critical failure.
- Freeform arbitrary bid values remain prohibited.

**Completed foundation:**

- Deterministic fixed tiers `+2`, `+5`, and `+8`.
- Safe option preparation that rejects invalid tiers and deduplicates duplicates.
- Runner-state exposure through `state.travelV2RiskBids` and `state.riskBids`.
- Current round, station, and action selection projection.
- Session-local selection storage.
- UI select and clear controls for valid authored bids.
- Smoke coverage rejecting freeform values and GM-only/player leak fields.

**Remaining corrective work:**

- Require every authored station action to define all three tiers.
- Include player-safe reward, target, timing, duration, expiration, and danger metadata.
- Present all tiers in shared Crew Planning.
- Block selection before current-round order confirmation.
- Lock the selected tier with the station action.
- Integrate authored benefits with TV2-002 and TV2-011.
- Integrate authored danger with TV2-005, TV2-007, TV2-008, and TV2-009.
- Smoke full per-action tier coverage, planning visibility, lock gating, invalid metadata rejection, redaction, and reload.

**Safety:** Risk Bid selection remains session-local until a reviewed apply path is used. No actor or world mutation occurs from selecting a tier.

### TV2-005 — Risk Bid Result Pipeline

**Status:** complete — Slice 20 adds closeout smoke coverage proving the risk bid result pipeline is safely connected from roll result preview through reviewed candidate, queue, selected review, apply intent, apply gate, category plumbing, and final apply preview. TV2-005 is closed as session-local/review-only; true persistent ship mutation remains under the explicit GM persistent apply foundation, not TV2-005.
**Scope:** Alpha blocker

**Goal:** Resolve risk bid outcomes into reviewed Travel v2 effects.

**Corrective integration note:** The existing reviewed-result pipeline is reusable foundation. It must accept the corrected authored reward targets, timing, bonus-card effects, hazard or backlash protection, consequence protection, and per-tier failure dangers without exposing hidden GM state or silently applying persistent changes.

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
- Feed consequence candidates from authored Risk Bid benefit backlash or failure danger.
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

**Goal:** Consume authored station action cards during Travel v2 runtime and expose them to all players during Crew Planning.

**Corrected Alpha alignment:**

- Every active station has current-round authored actions.
- Every connected player sees every player-safe current action before order selection.
- Each action includes its base check and DC source, player-safe success purpose, Focus availability, and authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
- Players choose station order after reviewing those actions and bids.
- Action and Risk Bid selection remain blocked until the current-round order is confirmed.
- A locked action cannot change merely because an earlier station rolled well or badly.

**Remaining work:**

- Load station-action definitions from encounter or content data.
- Present all current actions by station and round context in shared Crew Planning.
- Attach rolls, DCs, all three Risk Bid tiers, Focus availability, success bands, reward hooks, danger hooks, hazard interactions, and action-specific vignette text.
- Add action lock-in state gated by order confirmation.
- Add explicit GM unlock for table correction.
- Preserve player-safe projections and redact hidden outcomes.
- Smoke schema compatibility, missing-tier rejection, invalid-card rejection, shared planning presentation, lock gating, reload, and redaction.

### TV2-011 — Station Benefit and Bonus Card Runtime

**Status:** missing / partial
**Scope:** Alpha blocker

**Goal:** Make authored Risk Bid benefits flow through player-facing bonus cards and the reusable pending-benefit queue.

**Corrected Alpha alignment:**

Benefits may target:

- the acting station now;
- the acting station's next roll;
- the acting station next round;
- the next station in order;
- another chosen later station;
- another chosen station;
- a specific station;
- the crew or ship;
- a hazard or backlash response;
- a consequence response;
- an event reward, clue, discovery, salvage, or route advantage.

**Remaining work:**

- Consume benefit-card definitions.
- Create pending benefits from successful authored Risk Bids and other approved station outcomes.
- Display player-facing cards to valid recipients.
- Support target validation based on the committed round order.
- Support roll bonuses, fortune, future DC reduction, degree-of-success protection, consequence protection, hazard protection, and reward benefits.
- Support critical-success strengthening when authored.
- Support optional use, required use, consumption, transfer, duration, expiration, carry-forward, and next-round activation.
- Keep persistent mutations behind explicit GM review.
- Smoke lifecycle, invalid targets, order dependencies, expiration, reload, redaction, and no duplicated use.

### TV2-012 — Authored Risk Bid Card Runtime

**Status:** missing / corrective expansion required
**Scope:** Alpha blocker

**Goal:** Make complete authored Risk Bid definitions available to station-action runtime and shared Crew Planning.

**Required card data:**

- fixed tier: `+2`, `+5`, or `+8`;
- player-safe label and description;
- reward kind;
- reward target type;
- valid targets;
- activation timing;
- duration;
- expiration;
- optional or automatic use;
- consumed or persistent behavior;
- transfer rules where allowed;
- player-safe danger;
- failure result;
- critical-failure result;
- hidden GM-only payload kept outside player-safe state.

**Remaining work:**

- Define and validate the expanded Risk Bid card schema.
- Require all three tiers on every station action.
- Attach authored bids directly to actions.
- Present all tiers during Crew Planning.
- Enforce fixed DC increases.
- Resolve rewards through TV2-002, TV2-005, and TV2-011.
- Resolve danger through TV2-005, TV2-007, TV2-008, and TV2-009.
- Reject malformed targets, timing, duration, danger, and hidden-field leakage.
- Smoke import, export, runtime preparation, player-safe projection, lock-in, resolution, reload, and no silent mutation.

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
- Authored Risk Bid benefits, including self-targeted and cross-station rewards.
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

**Corrected Alpha alignment:** During Crew Planning, every player sees all active stations, every current player-safe station action, every action's authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids, player-safe reward and danger text, the synchronized proposed order, known hazards, shared Momentum, and earned player-facing bonus cards. After order confirmation, each station sees its action, selected bid, Focus availability, valid benefits, roll controls, and immediate round context.

**Remaining work:**

- Player-safe HUD state.
- Current station/action context.
- Action-specific vignette.
- Authored self-benefit, cross-station benefit, and bonus-card availability.
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
- Pending authored Risk Bid benefit backlash or failure danger.
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
- Expected Crew Planning, round-order, authored Risk Bid, Focus, Momentum, benefit-card, and hazard interactions.
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
- Shared player-owned station order chosen separately for every round.
- Station action choices.
- Action lock-in.
- Authored Risk Bid benefits, including self, future, cross-station, hazard, and consequence targets.
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

### TV2-028 — Crew / Station Assignment and Captain Role Ownership

**Status:** missing / partial
**Scope:** Alpha blocker

**Goal:** Make station ownership clear while preserving shared Crew Planning and the Captain's final-confirmation role.

**Remaining work:**

- Assign a player, actor, or NPC crew member to Navigator, Engineer or Arkengineer, Veilwarden, Watchmaster, Captain, and future stations.
- Show assignments to all players during Crew Planning.
- Allow every player to review every current station action and Risk Bid regardless of assignment.
- Use assignment to control station action lock-in and resolution where appropriate.
- Identify the Captain for final order confirmation when reliable assignment data exists.
- Preserve table-guidance fallback when no automated Captain assignment exists.
- Handle missing, duplicate, substitute, and NPC stations safely.
- Show the current and upcoming station during resolution.
- Preserve player-safe output.
- Smoke assignment, reassignment, Captain confirmation, fallback behavior, missing stations, duplicates, reload, and redaction.

### TV2-029 — Player Decision Prompt Flow

**Status:** missing
**Scope:** Alpha blocker

**Goal:** Guide players through the corrected round workflow instead of making the GM manually ask every question.

**Prompt chain:**

1. Enter shared Crew Planning.
2. Review all active stations.
3. Review all current player-safe station actions.
4. Review every action's authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
5. Discuss action combinations, rewards, dangers, and station order.
6. Arrange the synchronized proposed order.
7. Captain confirms the order; GM may override or unlock.
8. Each station chooses an action.
9. Each station chooses and locks one authored Risk Bid.
10. Choose whether to spend Focus when the action allows it.
11. Choose any valid earned bonus card or benefit.
12. Choose a Momentum spend when allowed.
13. Roll and resolve in committed order.
14. Choose a response action when a hazard triggers.
15. Enter Round Resolution.
16. Begin the next round with a fresh Crew Planning phase.

**Safety:** Player prompts create session-local requests until the appropriate reviewed apply path is used. Hidden hazards, unrevealed backlash, GM consequence queues, internal scoring, future triggers, secret branches, GM notes, and debug state remain redacted.

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
- Shared Crew Planning and round-order explanation.
- Risk Bid tier, reward, target, timing, and danger explanation.
- Focus explanation.
- Momentum explanation.
- Hazard explanation.
- Round-end explanation.
- Event-end explanation.
- Minimal in-app help text or docs link.

## Completed / foundation-complete systems

These systems should generally be treated as existing foundations rather than rebuilt. Their presence does not prove the corrected player-facing workflow is complete:

- Core Travel v2 state.
- Pressure engine and round pressure adapter.
- Legacy round-action-order state, commit, persistence, library status, startup, and session-switch hardening.
- Candidate movement, target-index movement, drop-target geometry, and drag foundations.
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
- Stabilize and repair.
- Momentum foundation.
- Focus backlash records.
- Support targeting, assist records, support backlash, and Focus risk-suppression foundations that may be generalized for authored Risk Bid benefits.
- Pending station-benefit queue and benefit-use review.
- Runner preview consumer and panel.
- Saved-session library and order-status closeout.
- Saved-session context and session-switch isolation.
- Travel v2 sample event.
- Travel v2 dev-tools foundation.
- Round-resolution readiness.
- Completion checklist foundation.
- Builder and importer compatibility.
- Card schema and card-schema import adapter.
- Consequence catalog.
- Built-in hazard-deck registry, picker UI, and runtime selection.
- Hazard draw review, active-hazard handoff review, hazard candidate controls, and active-hazard lifecycle display.
- Response-action wiring.
- Station-impact behavior and station-impact modifier review.

The following are explicitly not complete merely because legacy foundations exist:

- shared Crew Planning at the beginning of every round;
- player-safe presentation of all current station actions;
- presentation of all three authored Risk Bid tiers per action;
- synchronized multiplayer proposed-order changes;
- Captain confirmation;
- round-specific committed order;
- action and Risk Bid lock gating;
- complete authored reward targeting and timing;
- targeted reorder-panel rendering;
- corrected multiplayer Foundry acceptance.

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

## Historical TV2-003 implementation note

The legacy TV2-003 slices added useful foundations, including keyboard candidate movement, Move Up and Move Down controls, pointer dragging, target-index movement, drop-target geometry, explicit commit and unlock integration, persistence and reload support, player redaction, post-result blocking, and session or round isolation.

Those slices were built for the obsolete GM-centered, event-wide order workflow. They are historical implementation foundations, not proof that corrected TV2-003 is complete.

The corrected closeout requires:

- shared player-facing Crew Planning every round;
- all player-safe station actions and authored Risk Bids visible before order selection;
- synchronized multiplayer ordering;
- Captain confirmation;
- GM override and unlock;
- round-specific commitment;
- action and Risk Bid lock gating;
- targeted panel updates without full runner rerender;
- the replacement multiplayer Foundry verification checklist.
