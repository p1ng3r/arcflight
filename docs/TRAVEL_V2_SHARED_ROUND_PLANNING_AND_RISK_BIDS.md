# Travel v2 Shared Round Planning and Authored Risk Bids

Status: canonical Travel Alpha design correction and highest-priority gameplay blocker.

This document records the corrected table workflow for station order, station actions, and Risk Bids. It intentionally supersedes any older Travel v2 wording that describes station order as a GM-owned control, a once-per-event choice, or Inter-Station Help as a separate action menu.

## Priority

This work is the first Travel Alpha gameplay priority.

Do not close TV2-003 through table verification against the old GM-only, event-wide order interface. Correct the player workflow and Risk Bid presentation first, then replace the obsolete verification checklist.

## Core rule

Every round begins with a shared Crew Planning phase.

During Crew Planning:

- Every connected player sees every active station.
- Every player sees the player-safe actions available to every active station for the current round.
- Every station action exposes its authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bid choices.
- Each Risk Bid shows its player-safe potential benefit and player-safe danger.
- Players discuss action combinations and arrange the station order together.
- The order is committed for the current round only.
- The next round begins with a new Crew Planning phase and a new order decision.

The Captain has final say when the crew cannot agree. This is table guidance, not a secret permission model. The GM may override or unlock the order for table management, but the GM is not the ordinary owner of the decision.

## Station actions and Risk Bids

Risk Bids belong directly to station actions.

Every action has three authored Risk Bid tiers:

- `+2 DC`
- `+5 DC`
- `+8 DC`

The action defines the reward and danger for each tier. A reward does not always help another station.

A Risk Bid reward may benefit:

- the acting station on its current action;
- the acting station on its next roll;
- the acting station in the next round;
- the next station in the committed order;
- a chosen later station;
- a specific named station;
- the whole crew or ship;
- a future hazard, backlash, or consequence response.

Supported authored reward patterns include, but are not limited to:

- Add `+2`, `+3`, or `+5` to an eligible roll.
- Roll `2d20` and keep the highest.
- Reduce an eligible future DC, such as lowering this station's first DC next round by 2.
- Improve the next eligible failure by one degree: critical failure becomes failure, and failure becomes success.
- Grant a bonus card to the acting station, the next station, or another chosen station.
- Prevent, cancel, downgrade, or absorb the next eligible consequence.
- Suppress or weaken an eligible hazard or backlash.
- Improve rewards, salvage, clues, route advantages, or other event-authored outcomes.

The higher DC is the bid's immediate cost. Failure and critical failure must invoke the action's authored danger, which may stage pressure, hazards, backlash, consequences, scars, complications, or lost opportunities.

## Cross-station support

Helping another station is one possible Risk Bid reward, not a separate universal action category.

A Risk Bid may create a card or benefit for another station. When order matters, the planning UI must state the timing clearly, for example:

- `Engineer must act before Veilwarden.`
- `Give the next station +3 on its roll.`
- `Choose any later station; it rolls 2d20 and keeps the highest.`

Some Risk Bids affect only the acting station and create no cross-station benefit. The UI must not imply that every bid is Help.

## Shared Crew Planning UI

The Crew Planning interface is a primary player-facing screen, not an Advanced Runner Details control.

It must show:

- current round number and player-safe round stakes;
- all active station cards;
- assigned player or crew ownership where available;
- every current station action;
- all three Risk Bid tiers attached to each action;
- each tier's player-safe benefit, target, timing, and danger;
- the shared proposed station order;
- clear explanations when a reward depends on acting before, after, or immediately next to another station.

All players see the same synchronized proposed order. The interface should support drag controls and accessible Move Up / Move Down controls.

Reordering must update the order panel without rebuilding the entire runner, collapsing drawers, resetting scroll position, or losing keyboard focus.

## Round lifecycle

The required round lifecycle is:

1. Round enters `crewPlanning`.
2. Players review every station action and Risk Bid.
3. Players discuss combinations, risks, self-benefits, future benefits, and cross-station benefits.
4. Players arrange the current round's station order.
5. The Captain confirms the crew's final order; the GM retains an override.
6. The committed order is visible to all players.
7. Station action and Risk Bid lock-in becomes available.
8. Stations resolve in committed order.
9. Earned benefit cards and effects use their authored target and timing rules.
10. Round Resolution completes.
11. The next round opens a fresh `crewPlanning` phase.

The previous round's order may be offered as a starting suggestion, but it must not remain automatically committed.

## Player visibility boundary

During Crew Planning, players may see:

- all active stations;
- all current player-safe station actions;
- all authored `+2`, `+5`, and `+8` Risk Bid benefits;
- player-safe dangers and known conditions;
- available shared resources;
- proposed and committed station order;
- earned player-facing bonus cards and their valid targets.

Players must not see:

- hidden hazards that have not been revealed;
- unrevealed backlash details;
- GM-only consequence candidates;
- internal scoring or outcome math;
- future triggers or secret event branches;
- GM-only notes and debug state.

## Implementation priority

Implement in this order:

1. Replace the obsolete once-per-event, GM-owned TV2-003 specification and checklist.
2. Add a current-round `crewPlanning` phase and round-specific order state.
3. Expose all current station actions and authored Risk Bid tiers through player-safe shared state.
4. Add synchronized multiplayer candidate-order updates.
5. Add Captain confirmation and GM override/unlock behavior.
6. Block station action lock-in and resolution until the current round order is confirmed.
7. Apply Risk Bid rewards through authored benefit cards and timing rules.
8. Replace whole-runner reorder renders with targeted panel updates that preserve focus and viewport state.
9. Add focused smoke coverage, multiplayer synchronization coverage, and a new Foundry table checklist.

## Acceptance requirements

Travel Alpha cannot call this workflow playable until all of the following pass:

- [ ] Crew Planning appears automatically at the beginning of every round.
- [ ] Every player sees all active station actions for the current round.
- [ ] Every action exposes authored `+2`, `+5`, and `+8` Risk Bid choices.
- [ ] Each Risk Bid shows its player-safe reward, target, timing, and danger.
- [ ] Rewards can correctly target self, another station, the next station, a later round, the crew, a hazard, or a consequence as authored.
- [ ] Players can discuss and synchronously rearrange the current round order.
- [ ] The Captain can confirm the order and the GM can override or unlock it.
- [ ] Station actions cannot lock or resolve before the round order is confirmed.
- [ ] Reordering does not rerender or reset the entire runner interface.
- [ ] The committed order applies only to the current round.
- [ ] The next round begins with a fresh Crew Planning phase.
- [ ] Hidden and GM-only information remains redacted from player state.

## Reference rule

When older Travel v2 documents conflict with this design, use this document for shared round planning and authored Risk Bid behavior until those documents are intentionally revised in the same direction.
