# Arcflight Alpha Pillar Roadmap

Status: canonical sequencing reference.

This document locks the high-level Arcflight alpha roadmap. It is intentionally short and firm: finish one playable pillar alpha before moving to the next pillar. Do not start beta work until all three alpha pillars have playable table loops.

## Roadmap rule

The alpha pillar order is:

1. Travel Alpha.
2. Combat Alpha.
3. Upgrade / Progression Alpha.
4. Beta only after all three alpha pillars are playable.

This is a sequencing document, not a full mechanics spec. Each pillar should have its own detailed goal document before heavy implementation begins.

## Phase 1: Travel Alpha

Travel Alpha comes first.

Primary reference:

- `docs/TRAVEL_V2_ALPHA_GOAL.md`

Travel Alpha proves the non-combat voyage gameplay loop.

Travel Alpha is complete when the GM can run two playable travel events from setup through final application, including:

- Event setup.
- Broad stakes.
- Minimum three rounds per event.
- All five core stations.
- Station order before Round 1.
- Locked station actions.
- Risk bids.
- Focus.
- Shared Momentum.
- Inter-station help.
- Hazards with mechanical teeth.
- Dynamic between-round vignettes.
- Mechanical callouts.
- Round Resolution.
- End-of-Event Resolution.
- Explicit GM Apply to Ship.
- Audit/history record.
- No silent mutation.
- No player leaks.

Travel Alpha should not expand into full beta polish, full authoring tools, full voyage campaign systems, or broad procedural content before the loop is proven.

## Phase 2: Combat Alpha

Combat Alpha begins only after Travel Alpha is playable.

Combat Alpha proves one complete Arcflight ship combat loop in Foundry.

Combat Alpha should answer one question:

> Can the table run a complete ship fight from start to finish, with meaningful ship/station choices and explicit GM-reviewed aftermath?

Combat Alpha should prove:

- Ship combat setup.
- Ship initiative.
- AP and RAP usage.
- Station turns or station actions.
- Helm movement.
- Facing and positioning.
- Weapon arcs.
- Firing weapons.
- Reloads.
- Basic enemy ship behavior.
- Hull damage.
- Strain or subsystem pressure.
- Consequence or scar candidates from combat.
- End-of-combat resolution.
- Explicit GM Apply to Ship.
- No silent mutation.
- No player leaks.

Combat Alpha should not try to finish every weapon, hull, room, crew, arkengine mod, special maneuver, boarding rule, or balance pass. It only needs a playable combat loop.

## Phase 3: Upgrade / Progression Alpha

Upgrade / Progression Alpha begins only after Combat Alpha is playable.

Upgrade / Progression Alpha proves that ships can grow between adventures and that those choices matter in Travel and Combat.

Upgrade / Progression Alpha should answer one question:

> Can the party improve the ship in Foundry, see the resulting stat changes, and use those improvements in the other pillars?

Upgrade / Progression Alpha should prove:

- Install rooms.
- Install weapons.
- Install ship upgrades.
- Install arkengine mods.
- Enforce hull slots.
- Enforce weapon mounts.
- Enforce upgrade limits.
- Enforce arkengine compatibility where applicable.
- Recalculate derived ship stats.
- Show what changed before and after installation.
- Reject invalid builds safely.
- Connect Travel rewards to upgrade opportunities.
- Connect Combat rewards or salvage to upgrade opportunities.
- Preserve explicit GM review for persistent changes.
- No silent mutation.
- No player leaks.

Upgrade / Progression Alpha should not attempt complete economy balance, every item in the final catalog, full downtime rules, or final ship-sheet polish before the loop is proven.

## Phase 4: Beta

Beta begins only after all three alpha pillars are playable:

- Travel Alpha is playable.
- Combat Alpha is playable.
- Upgrade / Progression Alpha is playable.

Beta is integration and polish, not invention.

Beta work should focus on:

- Making the three pillars talk to each other cleanly.
- Stabilizing ship stats.
- Cleaning up UI and table workflow.
- Balancing risk, rewards, pressure, damage, and upgrades.
- Expanding sample content.
- Expanding event and encounter libraries.
- Improving authoring workflows.
- Hardening validation and smoke tests.
- Real table testing.
- Fixing bugs found during play.
- Preparing for broader module release.

Beta should not be used to discover the basic pillar loops. Those belong to alpha.

## PR triage rule

Every future Arcflight gameplay PR should be classifiable as one of the following:

- Supports Travel Alpha.
- Supports Combat Alpha.
- Supports Upgrade / Progression Alpha.
- Supports integration after alpha.
- Is premature beta/polish work and should wait.

If a PR cannot clearly say which pillar goal it advances, it is probably drift.

## Reference rule

When roadmap questions conflict with this document, treat this document as the sequencing goal unless it is intentionally amended in a later docs PR.
