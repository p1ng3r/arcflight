# Travel v2 Shared Round Planning and Authored Risk Bids

Status: canonical Travel Alpha design correction and highest-priority gameplay blocker.

This document records the corrected table workflow for station order, station actions, and Risk Bids. It intentionally supersedes older Travel v2 wording that describes station order as a GM-owned control, a once-per-event choice, or Inter-Station Help as a separate universal action menu.

## Priority

This work is the first Travel Alpha gameplay priority.

Do not close TV2-003 through table verification against the old GM-only, event-wide order interface. Correct the player workflow and Risk Bid presentation first, then use the replacement verification checklist.

## Core rule

Every round begins with a shared Crew Planning phase.

During Crew Planning:

- Every connected player sees every active station.
- Every player sees the player-safe actions available to every active station for the current round.
- Every station action exposes its authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bid choices.
- Each Risk Bid shows its player-safe potential benefit and danger.
- Players discuss action combinations and arrange station order together.
- The order is committed for the current round only.
- The next round begins with a new Crew Planning phase and a new order decision.

The Captain has final say when the crew cannot agree. This is table guidance rather than a secret permission model.

The GM may override or unlock the order for table management, but the GM is not the ordinary owner of the decision.

## Station actions and Risk Bids

Risk Bids belong directly to station actions.

Every action has three authored Risk Bid tiers:

- `+2 DC`
- `+5 DC`
- `+8 DC`

The action defines the reward and danger for each tier.

A reward does not always help another station.

A Risk Bid reward may benefit:

- the acting station on its current action;
- the acting station on its next roll;
- the acting station during the next round;
- the next station in the committed order;
- a chosen later station;
- a specific named station;
- the whole crew;
- the ship;
- a future hazard response;
- a future backlash response;
- a future consequence response;
- event rewards, salvage, discoveries, clues, or route advantages.

The higher DC is the bid's immediate cost.

Failure and critical failure invoke the action's authored danger, which may stage:

- pressure;
- hazard creation;
- hazard escalation;
- backlash;
- consequences;
- scars;
- station complications;
- future DC increases;
- lost opportunities;
- reduced rewards.

## Authored reward patterns

Supported authored reward patterns include, but are not limited to:

### Roll bonuses

- Add `+2` to an eligible roll.
- Add `+3` to an eligible roll.
- Add `+5` to an eligible roll.
- Give the bonus to the acting station.
- Give the bonus to the next station.
- Give the bonus to another chosen station.
- Give the bonus to a specific named station.

### Fortune

- Roll `2d20` and keep the highest.
- Grant fortune to the acting station.
- Grant fortune to the next station.
- Grant fortune to another eligible station.

### Future DC reduction

- Reduce the acting station's next DC.
- Reduce the acting station's first action DC next round by 2.
- Reduce another station's next eligible DC.
- Reduce the next station's action DC.
- Reduce an eligible hazard-response DC.

### Degree-of-success protection

Improve the next eligible failed result by one degree:

- Critical Failure becomes Failure.
- Failure becomes Success.
- Success remains Success unless the authored effect says otherwise.
- Critical Success remains Critical Success unless the authored effect says otherwise.

### Bonus cards

Grant a player-facing bonus card to:

- the acting station;
- the next station;
- another chosen station;
- a specific named station;
- the crew.

A bonus card must identify:

- its name;
- its source action;
- its source station;
- its receiving station or valid targets;
- its mechanical effect;
- its timing;
- its expiration;
- whether use is optional;
- whether it is consumed;
- whether it may be transferred.

### Consequence protection

- Prevent the next eligible consequence.
- Downgrade the next eligible consequence.
- Absorb one eligible consequence.
- Prevent a consequence from escalating into a scar.
- Reduce an authored consequence category.
- Offer a reduced consequence choice when authored.

### Hazard and backlash protection

- Suppress a revealed hazard.
- Weaken a hazard.
- Prevent a hazard escalation.
- Reduce a hazard countdown.
- Redirect a hazard effect.
- Protect a station from a known hazard.
- Weaken an authored backlash.
- Grant a bonus to a later hazard-response action.

### Rewards and discoveries

- Improve salvage.
- Preserve cargo.
- Reveal a route clue.
- Discover a hidden location.
- Improve the final reward.
- Create a useful contact.
- Create a future Travel advantage.
- Preserve an otherwise lost opportunity.

## Cross-station support

Helping another station is one possible Risk Bid reward. It is not a separate universal action category.

A Risk Bid may create a card or benefit for another station.

When station order matters, the planning interface must state the timing clearly.

Examples:

- `Engineer must act before Veilwarden.`
- `Give the next station +3 on its roll.`
- `Choose any later station; it rolls 2d20 and keeps the highest.`
- `Navigator must act after Engineer to receive this benefit.`
- `Prevent the next eligible consequence created this round.`

Some Risk Bids affect only the acting station and create no cross-station benefit.

The interface must not imply that every bid is Help.

## Shared Crew Planning interface

The Crew Planning interface is a primary player-facing screen.

It must not be hidden inside:

- Advanced Runner Details;
- GM-only development controls;
- debug controls;
- an optional review drawer.

It must show:

- current round number;
- player-safe round stakes;
- all active station cards;
- assigned player or crew ownership where available;
- every current station action;
- all three Risk Bid tiers attached to each action;
- each tier's player-safe benefit;
- each tier's target;
- each tier's timing;
- each tier's player-safe danger;
- the shared proposed station order;
- the committed order after confirmation;
- earned player-facing bonus cards;
- clear explanations when a reward depends on station order.

All players see the same synchronized proposed order.

The interface must support:

- drag-and-drop ordering;
- accessible Move Up controls;
- accessible Move Down controls;
- keyboard operation;
- visible keyboard focus;
- Captain confirmation;
- GM override;
- GM unlock.

## Stable rendering requirement

Reordering must update the order interface without rebuilding the entire Travel Event Runner.

Reordering must not:

- collapse an open panel;
- close a `<details>` element;
- reset scroll position;
- return the user to the top;
- lose keyboard focus;
- replace the application window;
- interrupt player discussion;
- commit the order automatically;
- send unintended socket messages.

A full runner render may occur only when genuinely required and must preserve:

- open panel state;
- scroll position;
- focused control;
- compact or expanded state;
- current round context.

## Round lifecycle

The required round lifecycle is:

1. The round enters `crewPlanning`.
2. Players review every active station.
3. Players review every current station action.
4. Players review each action's `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
5. Players discuss combinations, risks, self-benefits, future benefits, and cross-station benefits.
6. Players arrange the current round's station order.
7. The Captain confirms the crew's final order.
8. The GM retains an override.
9. The committed order becomes visible to all players.
10. Station action and Risk Bid lock-in becomes available.
11. Stations resolve in committed order.
12. Earned benefits use their authored targets and timing.
13. Failed bids stage their authored dangers.
14. Round Resolution completes.
15. The next round opens a fresh `crewPlanning` phase.

The previous round's order may be offered as a starting suggestion, but it must not remain automatically committed.

## Order ownership

The ordinary order-selection workflow belongs to the players.

### Players

Players may:

- see all current station actions;
- see all authored Risk Bid choices;
- discuss strategy;
- rearrange the shared proposed order;
- see synchronized changes;
- review the committed order.

### Captain

The Captain:

- participates in shared planning;
- has final say when the crew cannot agree;
- confirms the final crew order.

Captain authority is primarily table guidance. Automated Captain permissions may be added when station ownership is reliably available.

### GM

The GM may:

- observe player planning;
- rearrange the order for table management;
- override a proposed order;
- confirm when necessary;
- unlock a committed order;
- test and debug the workflow.

The GM must not be treated as the ordinary owner of the decision.

## Round-specific state

The committed station order belongs to the current round.

Conceptually:

```javascript
session.roundResults[roundIndex].actionOrder = {
  status: "selecting",
  stationKeys: [
    "captain",
    "navigator",
    "engineer",
    "veilwarden",
    "watchmaster"
  ],
  committedAt: null,
  committedByUserId: null
};