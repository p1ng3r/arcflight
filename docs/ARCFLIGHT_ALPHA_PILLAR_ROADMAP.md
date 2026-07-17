# Arcflight Alpha Pillar Roadmap

Status: canonical sequencing reference.

This document locks the high-level Arcflight alpha roadmap. Finish one playable pillar alpha before moving to the next pillar. Do not begin beta work until all three alpha pillars have playable table loops.

## Roadmap rule

The alpha pillar order is:

1. Travel Alpha.
2. Combat Alpha.
3. Upgrade / Progression Alpha.
4. Beta only after all three alpha pillars are playable.

This is a sequencing document, not the complete mechanics specification. Each pillar has its own detailed goal documents.

## Phase 1: Travel Alpha

Travel Alpha comes first.

Primary references:

- `docs/TRAVEL_V2_ALPHA_GOAL.md`
- `docs/TRAVEL_V2_SHARED_ROUND_PLANNING_AND_RISK_BIDS.md`

Travel Alpha proves the non-combat voyage gameplay loop.

### Highest-priority Travel Alpha work

The first Travel Alpha gameplay priority is the shared round-planning workflow.

Before continuing the obsolete TV2-003 table-verification path, implement and verify:

- A shared Crew Planning phase at the beginning of every round.
- Every connected player seeing every active station.
- Every player seeing all player-safe station actions for the current round.
- Every station action displaying its authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
- Every Risk Bid displaying its player-safe reward, target, timing, and danger.
- Players discussing actions, Risk Bids, combinations, and station order together.
- Players arranging the station order for the current round.
- Captain confirmation when the crew needs a final decision.
- GM override and unlock controls for table management.
- A committed order that applies only to the current round.
- A fresh Crew Planning phase and order decision at the beginning of the next round.
- Station actions remaining unavailable for lock-in or resolution until the current round order is confirmed.
- Synchronized multiplayer order changes.
- Reordering that does not rebuild the entire runner, collapse controls, reset scroll position, or lose keyboard focus.

Helping another station is one possible authored Risk Bid reward. It is not a separate universal action category.

Risk Bid rewards may benefit:

- the acting station on its current action;
- the acting station on its next roll;
- the acting station in the next round;
- the next station in the committed order;
- another chosen station;
- a specific named station;
- the whole crew or ship;
- a future hazard, backlash, or consequence response.

Supported authored rewards include:

- adding `+2`, `+3`, or `+5` to an eligible roll;
- rolling `2d20` and keeping the highest;
- reducing an eligible future DC;
- reducing the acting station's first action DC next round;
- improving an eligible failure by one degree;
- granting a player-facing bonus card;
- preventing, downgrading, or absorbing a consequence;
- suppressing or weakening a hazard or backlash;
- improving rewards, salvage, clues, discoveries, or route advantages.

### Travel Alpha completion requirements

Travel Alpha is complete when the table can run two playable travel events from setup through final application, including:

- Event setup.
- Broad player-facing stakes.
- At least three rounds per event.
- All five core stations:
  - Captain.
  - Navigator.
  - Engineer or Arkengineer.
  - Veilwarden.
  - Watchmaster.
- Shared Crew Planning at the beginning of every round.
- Player-chosen, round-specific station order.
- Captain confirmation with GM override and unlock.
- Player-visible station actions.
- Authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids attached to every station action.
- Player-safe Risk Bid rewards, targets, timing, and dangers.
- Locked station actions and Risk Bids before resolution.
- Focus.
- Shared Momentum.
- Authored self-benefits, future benefits, cross-station benefits, and bonus cards.
- Hazards with mechanical effects.
- Dynamic between-round vignettes.
- Immediate mechanical callouts.
- Round Resolution.
- End-of-Event Resolution.
- Explicit GM Apply to Ship.
- Audit and history records.
- No silent actor, item, effect, journal, chat, socket, scene, token, compendium, or world mutation.
- No player-facing leaks of hidden hazards, unrevealed backlash, internal scoring, secret event branches, GM-only queues, or debug state.

Travel Alpha should not expand into full beta polish, complete authoring tools, a full voyage-campaign layer, broad procedural content, or every possible Risk Bid reward before the playable table loop is proven.

## Phase 2: Combat Alpha

Combat Alpha begins only after Travel Alpha is playable.

Combat Alpha proves one complete Arcflight ship-combat loop in Foundry.

Combat Alpha should answer one question:

> Can the table run a complete ship fight from start to finish, with meaningful ship and station choices and an explicit GM-reviewed aftermath?

Combat Alpha should prove:

- Ship-combat setup.
- Ship initiative.
- AP and RAP usage.
- Station turns or station actions.
- Helm movement.
- Facing and positioning.
- Weapon arcs.
- Firing weapons.
- Reloads.
- Basic enemy-ship behavior.
- Hull damage.
- Strain or subsystem pressure.
- Consequence or scar candidates from combat.
- End-of-combat resolution.
- Explicit GM Apply to Ship.
- No silent mutation.
- No player leaks.

Combat Alpha should not attempt to finish every weapon, hull, room, crew type, Arkengine modification, special maneuver, boarding rule, or final balance pass. It only needs a playable combat loop.

## Phase 3: Upgrade / Progression Alpha

Upgrade / Progression Alpha begins only after Combat Alpha is playable.

Upgrade / Progression Alpha proves that ships can grow between adventures and that those choices matter during Travel and Combat.

Upgrade / Progression Alpha should answer one question:

> Can the party improve the ship in Foundry, see the resulting mechanical changes, and use those improvements in the other pillars?

Upgrade / Progression Alpha should prove:

- Installing rooms.
- Installing weapons.
- Installing ship upgrades.
- Installing Arkengine modifications.
- Enforcing hull slots.
- Enforcing weapon mounts.
- Enforcing upgrade limits.
- Enforcing Arkengine compatibility where applicable.
- Recalculating derived ship statistics.
- Showing what changed before and after installation.
- Rejecting invalid builds safely.
- Connecting Travel rewards to upgrade opportunities.
- Connecting Combat rewards and salvage to upgrade opportunities.
- Preserving explicit GM review for persistent changes.
- No silent mutation.
- No player leaks.

Upgrade / Progression Alpha should not attempt complete economy balance, every item in the final catalog, full downtime rules, or final ship-sheet polish before the loop is proven.

## Phase 4: Beta

Beta begins only after all three alpha pillars are playable:

- Travel Alpha is playable.
- Combat Alpha is playable.
- Upgrade / Progression Alpha is playable.

Beta is integration and polish, not invention of the basic gameplay loops.

Beta work should focus on:

- Making the three pillars interact cleanly.
- Stabilizing ship statistics.
- Cleaning up UI and table workflow.
- Balancing risk, rewards, pressure, damage, and upgrades.
- Expanding sample content.
- Expanding event and encounter libraries.
- Improving authoring workflows.
- Hardening validation and smoke tests.
- Multiplayer table testing.
- Fixing bugs discovered during play.
- Preparing for broader module release.

Beta should not be used to discover the basic pillar loops. Those belong to alpha.

## PR triage rule

Every future Arcflight gameplay pull request should clearly fit one of these categories:

- Supports Travel Alpha.
- Supports Combat Alpha.
- Supports Upgrade / Progression Alpha.
- Supports integration after alpha.
- Is premature beta or polish work and should wait.

Travel Alpha pull requests should be prioritized in this order:

1. Shared Crew Planning and authored Risk Bid presentation.
2. Round-specific synchronized player ordering.
3. Captain confirmation and GM override.
4. Station action and Risk Bid lock-in.
5. Authored benefit-card targeting and timing.
6. Complete round resolution and event resolution.
7. Gold-standard playable event coverage.
8. Foundry multiplayer verification.

A pull request that cannot clearly state which pillar goal it advances is likely design drift.

## Reference rule

When roadmap questions conflict with older Travel v2 documents, use:

- `docs/TRAVEL_V2_SHARED_ROUND_PLANNING_AND_RISK_BIDS.md` for shared Crew Planning, station order, and authored Risk Bid behavior;
- `docs/TRAVEL_V2_ALPHA_GOAL.md` for the detailed Travel Alpha gameplay loop;
- this document for overall pillar sequencing and priority.

Conflicting documents should be intentionally updated before obsolete acceptance tests continue.