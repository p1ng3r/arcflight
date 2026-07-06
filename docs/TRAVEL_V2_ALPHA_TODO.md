# Travel v2 Alpha TODO

Status: active Travel Alpha worklist.

This document turns `docs/TRAVEL_V2_ALPHA_GOAL.md` into a practical implementation checklist. It should be used with:

- `docs/ARCFLIGHT_ALPHA_PILLAR_ROADMAP.md` for project sequence.
- `docs/TRAVEL_V2_ALPHA_GOAL.md` for the locked alpha gameplay target.
- `docs/TRAVEL_V2_OPEN_ISSUES.md` for stable `TV2-###` implementation IDs.

Travel Alpha is complete when the GM can run two playable Travel v2 events from setup through final application without silent mutation, player leaks, or design drift.

## Current priority

Do not start Combat Alpha, Upgrade / Progression Alpha, or Beta work until Travel Alpha is playable.

The immediate priority is to close the two-event Travel Alpha loop:

1. Outline both alpha events.
2. Implement the missing loop systems.
3. Rewrite `The Lantern in the Static` around the new loop.
4. Build the second physical/voidfaring alpha event.
5. Prove the full loop with manual Foundry acceptance and smoke coverage.

## Alpha event pair

### Event 1: The Lantern in the Static

Primary purpose: occult void pressure and mystery.

Must test:

- Lifeveil, Morale, and Strain pressure.
- Hidden hazard tells.
- Command echoes.
- Dynamic vignettes.
- Momentum reveal.
- Focus backlash.
- Risk bid consequences.
- Inter-Station Help.
- Final choice: rescue, cut free, or abandon.
- Consequence queue.
- Explicit GM apply.

Current state: a 3-round sample exists, but it must be rewritten to use the locked alpha systems.

### Event 2: Shattered Chain Drift

Working title. Primary purpose: physical voidfaring crisis.

Must test:

- Hull, Strain, Supplies, and Cargo pressure.
- Broken chain-field or wreckage-drift navigation.
- Visible environmental hazards.
- Salvage opportunities.
- Route clue reward.
- Risk bids causing direct ship complications.
- Repair or recovery choices.
- Ship scar candidates.
- Explicit GM apply.

Current state: missing.

## Recommended PR sequence

### PR A — Docs alignment and TODO setup

Status: complete when this document and the tracker alignment are in `dev`.

Purpose:

- Make the docs hierarchy clear.
- Prevent old tracker notes from overriding the new alpha goal.
- Mark `docs/codex` as historical closeout notes.
- Add this actionable TODO list.

### PR B — Alpha event pair outline

Purpose:

- Outline Lantern rewrite.
- Outline Shattered Chain Drift.
- Define what each event tests.
- Define round count, resources, main hazard, secondary hazards, station actions, risk bids, Focus options, help actions, final choices, rewards, consequences, scars, and follow-ups.

Outputs:

- Event outline docs or draft data.
- No runtime changes required unless validation helpers are touched.

### PR C — Visible stakes and event setup

Mapped tracker items:

- TV2-018 — Visible Stakes Runtime.
- TV2-013 — Encounter Template Preview and Runtime, if needed.

Purpose:

- Show broad event stakes before Round 1.
- Show threatened resources.
- Show event length.
- Show known danger/tells.
- Keep hidden GM-only hazards hidden.

Acceptance:

- GM can open event setup.
- Players can see player-safe stakes.
- GM-only details remain hidden.
- No mutation occurs.

### PR D — Station order closeout

Mapped tracker items:

- TV2-003 — Player-Chosen Round Action Order UX Polish.
- TV2-028 — Crew / Station Assignment and Role Ownership, if needed.

Purpose:

- Station order is chosen before Round 1.
- Order remains fixed for the event unless GM unlocks it.
- GM can drag/reorder, lock, and unlock.
- Captain tie-break is guidance text.

Acceptance:

- Order works before Round 1.
- Saved/reloaded sessions preserve order safely.
- Player-safe display does not leak GM internals.
- Existing order foundations are reused, not rebuilt.

### PR E — Station action lock-in

Mapped tracker items:

- TV2-010 — Station Action Card Runtime.
- TV2-021 — Player HUD Polish.
- TV2-029 — Player Decision Prompt Flow.

Purpose:

- Players openly discuss station actions.
- Players lock actions before station-by-station resolution.
- Locked actions cannot change after other stations roll.
- Player card shows station action choices and action-specific vignette.

Acceptance:

- Each station can choose and lock an action.
- GM can see locked actions.
- Player card remains player-safe.
- Locked action cannot be changed due to later roll results.

### PR F — Risk bid model

Mapped tracker items:

- TV2-004 — Risk Bids / Difficulty Bids.
- TV2-012 — Risk Bid Card Runtime.

Purpose:

- Add fixed risk bid values: `+2`, `+5`, `+8`.
- Add station-flavored bid labels and text.
- Attach risk bids to actions that allow them.
- Store selected bid session-locally before the roll.

Acceptance:

- No freeform arbitrary bid values.
- Risk bids are selected before consequences are known.
- Risk bids do not mutate actors directly.
- Risk bid state is available to the result pipeline.

### PR G — Risk bid result pipeline

Mapped tracker items:

- TV2-005 — Risk Bid Result Pipeline.
- TV2-008 — Consequence Queue Expansion.
- TV2-007 — Hazard Mechanical Completion, if hazards are escalated.

Purpose:

- Resolve risk bid outcomes into reviewed effects.
- Make `+8` failures dangerous.
- Feed pressure, hazards, consequence candidates, station complications, and ship scar candidates through reviewed paths.

Acceptance:

- Critical success, success, failure, and critical failure are all covered.
- Failure can create pressure/hazard/consequence/complication.
- Critical failure can create stronger consequence, hazard escalation, pressure spike, or scar candidate.
- No silent mutation occurs.

### PR H — Focus alpha behavior

Mapped tracker items:

- TV2-008 — Consequence Queue Expansion.
- TV2-021 — Player HUD Polish.
- Existing Focus backlash foundations.

Purpose:

- Implement locked Focus behavior: declare before roll, roll `2d20`, keep highest.
- Remove/avoid post-failure free-reroll framing.
- Focus failure creates backlash.
- Focus critical failure creates severe backlash.

Acceptance:

- Focus is per station/player once per event unless future rules change it.
- Focus appears only on actions that allow it.
- Focus improves odds but raises stakes.
- Focus backlash feeds reviewed paths.

### PR I — Inter-Station Help UI and event hooks

Mapped tracker items:

- TV2-002 — Station Combo / Inter-Station Help.
- TV2-011 — Station Benefit Card Runtime.
- TV2-022 — GM Pending Decisions UI, if needed.

Purpose:

- Make Inter-Station Help visible as a gameplay system.
- Use existing pending benefit queue internally where possible.
- Earlier stations create help for later stations.
- Later stations consume help.
- Critical success can create stronger or automatic benefit.
- Critical failure creates backlash.

Acceptance:

- Help can be created and consumed in the same round.
- Help expires or carries based on authored rule.
- Help critical failure creates reviewed backlash.
- Player display is safe.

### PR J — Hazard forms and hidden tells

Mapped tracker items:

- TV2-007 — Hazard Mechanical Completion.
- TV2-008 — Consequence Queue Expansion.
- TV2-022 — GM Pending Decisions UI.

Purpose:

- Cover six alpha hazard forms:
  1. Station modifier.
  2. Station lockout.
  3. Countdown.
  4. Pressure cascade.
  5. Response action.
  6. Consequence/scar handoff.
- Support one main evolving hazard per event.
- Support optional event-tagged secondary hazards.
- Support hidden hazard tells.
- Support Momentum reveal.

Acceptance:

- Hazards change gameplay.
- Revealed hazards have player-visible names.
- Hidden hazards can influence vignettes without leaking GM-only details.
- Unresolved hazards can feed reviewed consequences or scars.

### PR K — Dynamic vignette assembly

Mapped tracker items:

- TV2-019 — Narration Hook Assembly.
- TV2-020 — Final Outcome and Aftermath Expansion.

Purpose:

- Generate one official between-round vignette from actual results.
- Include mechanical callouts immediately below prose.
- Let GM edit before showing players.

Preferred assembly ingredients:

1. Base transition.
2. Best station result.
3. Worst station result.
4. Major hazard movement.
5. Hidden hazard tell.
6. Resource or pressure change.
7. Next-round hook.

Acceptance:

- Vignette responds to actual mechanics.
- Mechanics are not hidden in prose only.
- GM can edit the official vignette.
- Player-facing output stays safe.

### PR L — Apply-to-ship and audit closeout

Mapped tracker items:

- TV2-009 — Explicit GM Persistent Apply Foundation.
- TV2-020 — Final Outcome and Aftermath Expansion.
- TV2-024 — Safety / Leak / Mutation Audit.

Purpose:

- Standardize reviewed apply contract.
- Standardize final confirmation summary.
- Standardize audit/history record.
- Preserve future Voyage Log compatibility.

Acceptance:

- Persistent changes require explicit GM confirmation.
- Applied results create audit/history record.
- Rewards are preserved in completed event records and attached to ship where useful.
- No chat, journal, socket, item, effect, or actor mutation occurs without the reviewed apply path.

### PR M — Lantern rewrite

Mapped tracker items:

- TV2-016 — Gold-Standard Encounter Sample.
- TV2-026 — Core Gameplay Loop Closeout.
- Any alpha blocker touched by the event data.

Purpose:

- Rewrite Lantern as the first complete alpha event.

Acceptance:

- Uses all five stations.
- Minimum three rounds.
- Includes stakes, risk bids, Focus, help, Momentum, hazards, dynamic vignette fragments, consequences, rewards, scars/follow-ups, and final choice.
- Runs start to finish in Foundry.

### PR N — Shattered Chain Drift

Mapped tracker items:

- TV2-016 — Gold-Standard Encounter Sample.
- TV2-026 — Core Gameplay Loop Closeout.
- TV2-032 — Reward / Discovery / Clue Runtime.

Purpose:

- Build second complete alpha event with physical voidfaring pressure.

Acceptance:

- Uses all five stations.
- Minimum three rounds.
- Tests Hull, Strain, Supplies, and Cargo.
- Includes salvage, route clue, environmental hazard, risk bid complications, ship scar candidate, and explicit GM apply.
- Runs start to finish in Foundry.

### PR O — Manual alpha acceptance and safety audit

Mapped tracker items:

- TV2-023 — End-to-End Table Test Scenario.
- TV2-024 — Safety / Leak / Mutation Audit.
- TV2-026 — Core Gameplay Loop Closeout.

Purpose:

- Prove the alpha loop at table level.

Acceptance:

- Two events run start to finish.
- GM-only test passes.
- One-player test passes.
- Player-safe output checked.
- No silent mutation checked.
- Known limitations documented.

## Alpha complete definition

Travel Alpha is complete when:

- Two playable events exist.
- Both events run start to finish.
- All five stations participate.
- Station order is chosen before Round 1.
- Actions lock before station-by-station resolution.
- Risk bids `+2`, `+5`, `+8` work where allowed.
- Focus is pre-roll `2d20 keep highest` with backlash.
- Momentum is shared, visible, and resets after event.
- Inter-Station Help works.
- Hazards use multiple mechanical forms.
- Dynamic vignettes are assembled from results.
- Mechanical callouts appear below prose.
- End-of-event resolution works.
- Apply-to-ship is explicit.
- Audit/history record is written.
- No silent mutation occurs.
- No player leaks occur.

After this, Arcflight moves to Combat Alpha, not Travel Beta.
