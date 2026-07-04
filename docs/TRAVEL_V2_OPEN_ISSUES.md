# Travel v2 Open Issues

This document is the canonical repo-local tracker for the remaining Travel v2 work.

Use this file to avoid drifting between older handoff notes, roadmap drafts, GitHub issue numbers, and pull request numbers. GitHub Issues remain the live work tickets; this file is the stable numbered checklist for what still needs to be built, integrated, or closed out.

## Current status

Travel v2 has substantial foundation coverage already. The aggregate smoke runner currently covers core Travel v2 state, pressure, round pressure, round action order, persistence bridges, library order status, runner preview, pressure application/correction, round finalization, event completion, completed-summary export, outcome packages, actor application bridge, follow-ups, hazards, ship scars, narration, stabilize/repair, momentum, Focus and Support records, runner UI consumers, saved-session startup/session-switch hardening, sample events, dev tools foundation, card schema/import compatibility, consequence catalog, hazard deck selection, hazard review paths, response action wiring, station impact behavior, station impact modifier review, pending station benefit queue, and station benefit use review.

Do not rebuild those foundations unless a new smoke test exposes a narrow bug.

## Numbering rules

- Use `TV2-###` numbers for this document.
- Use GitHub Issues for live tickets and discussion.
- Use PR numbers only for implementation history.
- A system can be `missing`, `partial`, `foundation-complete`, or `closeout-needed`.
- Prefer small smoke-first PRs.
- Every runtime feature needs a focused smoke and aggregate Travel v2 smoke wiring.

## Open numbered issues

### TV2-001 — Phase 8D Dev Tools and Resolution Dialogs

**Status:** partial

**Goal:** Complete the GM-facing development and resolution workflow.

**Remaining work:**

- GM-only dev tools panel gated by `arcflight.enableTravelV2DevTools`.
- Dev buttons for deterministic test setup and session-local forcing.
- Round Resolution dialog/window.
- End-of-Event Resolution dialog/window.
- Live completed-session shape support using `status`, `completedAt`, `summary`, and `roundResults`.
- Copy Travel v2 Debug Report action.
- Full smoke coverage for visibility, GM-only gating, no accidental mutation, dialog state, and debug report keys.

**Safety:** No actor, item, effect, journal, chat, socket, or world mutation without explicit GM confirmation.

### TV2-002 — Station Combo / Inter-Station Help

**Status:** partial

**Goal:** Let stations create benefits for other stations and make round order matter beyond narration.

**Remaining work:**

- Define station-to-station help lanes.
- Let earlier stations create pending benefits for later stations.
- Let later stations consume queued benefits through the existing station benefit review path.
- Add smoke coverage for creation, queueing, visibility, use, expiration, and player-safe state.

**Examples:**

- Engineer stabilizes the Arkengine to help Navigator.
- Watchmaster spots a route threat to help Captain or Veilwarden.
- Veilwarden shields the ship to reduce hazard impact.
- Captain coordinates a later station action.

### TV2-003 — Player-Chosen Round Action Order UX Polish

**Status:** foundation-complete / polish remaining

**Goal:** Make the already-smoke-covered round action order path table-ready.

**Remaining work:**

- Player-facing polish for selecting/reviewing round action order.
- Clear GM/player labels for committed vs proposed order.
- Final UX check for startup, saved-session loading, switching, library row status, and persistence.

**Do not rebuild:** State, commit, persistence bridge, library status, startup hardening, and session-switch isolation are already covered.

### TV2-004 — Risk Bids / Difficulty Bids

**Status:** missing

**Goal:** Add authored fixed-DC risk bids declared before a station roll.

**Remaining work:**

- Add deterministic risk bid data model.
- Support fixed bid tiers such as `+2`, `+5`, and `+10`.
- Attach risk bids to station actions or encounter context.
- Present risk bid choices before rolling.
- Store selected bid in session-local roll context.
- Smoke no freeform arbitrary bid values.

**Safety:** Risk bids must not mutate actors directly. They create session-local benefits, consequences, Momentum, hazards, or modifiers through reviewed paths.

### TV2-005 — Risk Bid Result Pipeline

**Status:** missing

**Goal:** Resolve risk bid outcomes into reviewed Travel v2 effects.

**Remaining work:**

- Critical success: stronger benefit, Momentum, or major progress.
- Success: selected benefit or progress.
- Failure: consequence candidate, pressure, hazard progress, or complication.
- Critical failure: stronger consequence, hazard escalation, ship scar candidate, or pressure spike.
- Smoke all four result bands.

### TV2-006 — Momentum Spend Catalog

**Status:** partial

**Goal:** Turn Momentum from a tracked resource into a meaningful player/GM decision system.

**Remaining work:**

- Define spend options.
- Add review/apply flow for Momentum spends.
- Integrate with risk bids, hazards, station benefits, pressure prevention, and final outcome adjustment.
- Smoke player-safe preview, GM approval, no duplicate spend, and no silent mutation.

**Candidate spends:**

- Add +1 or +2.
- Upgrade a benefit.
- Downgrade a failure.
- Late assist.
- Suppress a hazard.
- Prevent or reduce pressure.
- Improve final outcome package.

### TV2-007 — Hazard Mechanical Completion

**Status:** partial

**Goal:** Make hazards change gameplay, not just display as pressure or flavor.

**Remaining work:**

- Option lockouts.
- Focus suppression application.
- Response action execution.
- Clear/suppress/resolve lifecycle.
- Countdown and duration handling.
- Unresolved consequence handoff.
- Escalation to ship scar or other reviewed consequences.
- Persistence and reload behavior.

**Do not rebuild:** Hazard deck registry, picker, runtime selection, draw review, handoff review, candidate controls, lifecycle display, response action wiring, and station impact reviews already have foundation coverage.

### TV2-008 — Consequence Queue Expansion

**Status:** partial

**Goal:** Unify how consequences enter review from multiple Travel v2 systems.

**Remaining work:**

- Feed consequence candidates from risk bids.
- Feed consequence candidates from unresolved hazards.
- Feed consequence candidates from pressure overflow or severe pressure events.
- Feed consequence candidates from Focus/Support backlash.
- Feed consequence candidates from final outcome packages.
- Smoke queueing, dedupe, player-safe preview, GM approve/dismiss/defer, and persistence boundaries.

### TV2-009 — Explicit GM Persistent Apply Foundation

**Status:** partial

**Goal:** Create a strict, reusable framework for all persistent Travel v2 mutations.

**Remaining work:**

- Standard reviewed apply contract.
- Standard mutation audit record.
- Standard no-op / blocked reason handling.
- Standard actor/item/world mutation boundary.
- Standard smoke for no chat/journal/socket side effects unless explicitly requested.

**Do not rebuild:** Actor application bridge exists; this is the broader safe apply framework around it.

### TV2-010 — Station Action Card Runtime

**Status:** missing / partial

**Goal:** Consume authored station action cards during Travel v2 runtime.

**Remaining work:**

- Load station action card definitions from encounter/content data.
- Present available station actions by station and round context.
- Attach rolls, DCs, risk bids, success bands, benefit hooks, and consequence hooks.
- Smoke schema compatibility, invalid-card rejection, and player-safe projections.

### TV2-011 — Station Benefit Card Runtime

**Status:** missing / partial

**Goal:** Make authored station benefit cards flow through the existing pending-benefit queue and review/use path.

**Remaining work:**

- Consume benefit card definitions.
- Create pending benefits from station action outcomes.
- Let later stations review/use benefits.
- Expire or carry benefits based on card rules.
- Smoke lifecycle and no duplicated use.

### TV2-012 — Risk Bid Card Runtime

**Status:** missing

**Goal:** Make authored risk bid cards available to station action runtime.

**Remaining work:**

- Define/import risk bid card schema.
- Attach allowed bids to station actions or encounter context.
- Enforce fixed DC increases.
- Resolve bid outcomes through TV2-005.

### TV2-013 — Encounter Template Preview and Runtime

**Status:** missing / partial

**Goal:** Support complete authored Travel v2 encounter templates from content packs.

**Remaining work:**

- Define encounter template shape.
- Preview encounter template in Foundry.
- Start runtime session from template.
- Validate rounds, stations, hazards, consequences, rewards, follow-ups, and aftermath.
- Smoke malformed template rejection and safe import.

### TV2-014 — ChatGPT Content Builder Export Contract

**Status:** partial

**Goal:** Establish a reliable two-GPT authoring flow.

**Remaining work:**

- Story/content GPT writes adventure text.
- JSON/builder GPT converts to validated Travel v2 JSON.
- Foundry validates and previews the JSON before import.
- Smoke export/import compatibility and error reports.

### TV2-015 — Content Pack Validator and Safe Import/Export

**Status:** partial

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

**Goal:** Create one complete Travel v2 encounter that proves the whole system works as intended.

**Must include:**

- Stakes.
- Station actions.
- Risk bids.
- Station benefits.
- Hazards.
- Consequences.
- Momentum.
- Final outcome.
- Rewards/follow-ups/aftermath.
- Full smoke and manual Foundry acceptance path.

### TV2-017 — Expanded Content Packs

**Status:** missing

**Goal:** Build enough authored cards and encounters to make Travel v2 feel rich at the table.

**Remaining work:**

- More station action cards.
- More risk bid cards.
- More station benefit cards.
- More consequence cards.
- More hazard cards.
- More encounter templates.

### TV2-018 — Visible Stakes Runtime

**Status:** missing / partial

**Goal:** Give players and GM a clear view of what is at stake before and during each event.

**Remaining work:**

- Stakes card projection.
- Risk/reward/consequence summary.
- Player-safe state.
- Integration with final outcome and aftermath.

### TV2-019 — Narration Hook Assembly

**Status:** partial

**Goal:** Assemble narration from the actual mechanics that happened.

**Remaining work:**

- Include station order.
- Include assists and station benefits.
- Include risk bids.
- Include hazards and consequences.
- Include Momentum spends.
- Avoid repetitive station-result prose.

### TV2-020 — Final Outcome and Aftermath Expansion

**Status:** partial

**Goal:** Make event completion produce a useful aftermath package.

**Remaining work:**

- Summarize location change.
- Summarize unresolved hazards.
- Summarize consequences.
- Summarize rewards, clues, route advantages, and follow-ups.
- Integrate with End-of-Event Resolution dialog.

### TV2-021 — Player HUD Polish

**Status:** missing / partial

**Goal:** Make the player-facing Travel v2 UI clear, safe, and table-ready.

**Remaining work:**

- Player-safe HUD state.
- Current station/action context.
- Help/benefit availability.
- Risk bid selection state.
- Momentum visibility.
- Hazard visibility.
- Consequence visibility.

### TV2-022 — GM Pending Decisions UI

**Status:** missing / partial

**Goal:** Give the GM one unified queue for unresolved Travel v2 decisions.

**Remaining work:**

- Pending consequences.
- Pending station benefits.
- Pending hazards.
- Pending Momentum spend reviews.
- Pending outcome package changes.
- Approve/dismiss/defer/use controls.

### TV2-023 — End-to-End Table Test Scenario

**Status:** missing

**Goal:** Create a full scripted scenario for manual Foundry testing.

**Remaining work:**

- Setup instructions.
- Sample ship.
- Sample crew/stations.
- Sample event.
- Expected round-by-round decisions.
- Expected final outcome.
- Smoke/manual acceptance checklist.

### TV2-024 — Safety / Leak / Mutation Audit

**Status:** closeout-needed

**Goal:** Audit Travel v2 before beta for player-safe output and mutation boundaries.

**Remaining work:**

- Player-safe render state audit.
- GM-only/internal field audit.
- Actor/item/world mutation audit.
- Chat/journal/socket side-effect audit.
- Persistence/reload audit.

### TV2-025 — Beta Readiness Pass

**Status:** final

**Goal:** Prepare Travel v2 for a beta-style release.

**Remaining work:**

- Docs.
- Smoke runner closeout.
- Manual Foundry acceptance.
- Known limitations.
- Upgrade notes.
- Release checklist.

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
