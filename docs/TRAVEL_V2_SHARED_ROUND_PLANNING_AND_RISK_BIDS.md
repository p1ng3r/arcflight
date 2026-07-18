# Travel v2 Shared Round Planning and Authored Risk Bids

**Status:** Canonical Travel Alpha design correction and highest-priority gameplay blocker  
**Applies to:** TV2-003 and all later Travel v2 work that depends on Crew Planning, station order, Station Actions, or Risk Bids

This document defines the corrected table workflow for station order, Station Actions, and Risk Bids. It supersedes older Travel v2 wording that describes station order as a GM-owned control, a once-per-event choice, or Inter-Station Help as a separate universal action menu.

## Priority

This work is the first Travel Alpha gameplay priority.

Do not close TV2-003 through table verification against the old GM-only, event-wide order interface. Correct the player workflow and Risk Bid presentation first, then use the replacement multiplayer verification checklist.

## Core rule

Every round begins with a shared Crew Planning phase.

During Crew Planning:

- Every connected player sees every active station.
- Every player sees the player-safe actions available to every active station for the current round.
- Every Station Action exposes its authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bid choices.
- Every Risk Bid shows its player-safe reward, target, timing, duration or expiration where applicable, and danger.
- Players discuss action combinations and arrange station order together.
- The order is committed for the current round only.
- Station Action and Risk Bid lock-in remains blocked until the current-round order is confirmed.
- The next round begins with a fresh Crew Planning phase and a new order decision.

The Captain has final say when the crew cannot agree. The GM may override or unlock for table management, but the GM is not the ordinary owner of the decision.

## Station Actions and Risk Bids

Risk Bids belong directly to Station Actions.

Every Station Action has exactly three authored Risk Bid tiers:

- `+2 DC`
- `+5 DC`
- `+8 DC`

Each tier defines its own reward and danger. A reward does not always help another station.

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
- hazard creation or escalation;
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

- Add `+2`, `+3`, or `+5` to an eligible roll.
- Give the bonus to the acting station, next station, another chosen station, or a specific named station.

### Fortune

- Roll `2d20` and keep the highest.
- Grant fortune to the acting station, next station, or another eligible station.

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
- Success and Critical Success remain unchanged unless the authored effect says otherwise.

### Bonus cards

A player-facing bonus card must identify:

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

- Prevent, downgrade, or absorb the next eligible consequence.
- Prevent a consequence from escalating into a scar.
- Reduce an authored consequence category.
- Offer a reduced consequence choice when authored.

### Hazard and backlash protection

- Suppress or weaken a revealed hazard.
- Prevent hazard escalation.
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
- Create a useful contact or future Travel advantage.
- Preserve an otherwise lost opportunity.

## Cross-station support

Helping another station is one possible Risk Bid reward. It is not a separate universal action category.

When station order matters, the Crew Planning interface must state the timing clearly.

Examples:

- `Engineer must act before Veilwarden.`
- `Give the next station +3 on its roll.`
- `Choose any later station; it rolls 2d20 and keeps the highest.`
- `Navigator must act after Engineer to receive this benefit.`
- `Prevent the next eligible consequence created this round.`

Some Risk Bids affect only the acting station and create no cross-station benefit. The interface must not imply that every bid is Help.

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
- every current Station Action;
- all three Risk Bid tiers attached to each action;
- each tier's player-safe reward, target, timing, duration or expiration, and danger;
- the shared proposed station order;
- the committed order after confirmation;
- earned player-facing bonus cards;
- clear explanations when a reward depends on station order.

All players see the same synchronized proposed order.

The interface must support:

- drag-and-drop ordering;
- accessible Move Up and Move Down controls;
- keyboard operation and visible keyboard focus;
- Captain confirmation;
- GM override;
- GM unlock.

## Stable rendering requirement

Reordering must update the Crew Planning panel without rebuilding the entire Travel Event Runner.

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
3. Players review every current Station Action.
4. Players review each action's `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
5. Players discuss combinations, risks, self-benefits, future benefits, and cross-station benefits.
6. Players arrange the current round's station order.
7. The Captain confirms the crew's final order.
8. The GM retains override and unlock authority.
9. The committed order becomes visible to all players.
10. The round enters `stationOrders`.
11. Station Action and Risk Bid lock-in becomes available.
12. Stations resolve in committed order.
13. Earned benefits use their authored targets and timing.
14. Failed bids stage their authored dangers.
15. Round Resolution completes.
16. The next round opens a fresh `crewPlanning` phase.

The previous round's committed order may be offered as a starting suggestion, but it must not remain automatically committed.

## Order ownership

### Players

Players may:

- see all current Station Actions;
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

Automated Captain permissions may be enforced after canonical crew and station ownership is available.

### GM

The GM may:

- observe player planning;
- rearrange the order for table management;
- override a proposed order;
- confirm when necessary;
- unlock a committed order;
- test and debug the workflow.

The GM must not be treated as the ordinary owner of the decision.

## Canonical round-specific state

The station order belongs to one session and one round.

The canonical state lives at:

```javascript
session.roundResults[roundIndex].actionOrder
```

Its normalized shape is:

```javascript
{
  version: 1,
  roundIndex,
  roundNumber,
  status: "selecting" | "committed" | "unlocked",
  proposedStationKeys: [],
  committedStationKeys: [],
  orderSource: "authored" | "priorRoundSuggestion" | "manual" | "legacyCommitted" | "none",
  suggestionSource: null | {
    type: "priorRoundCommittedOrder",
    sourceRoundIndex,
    sourceRoundNumber
  },
  committedAt: null | "ISO timestamp",
  committedByUserId: null | string,
  committedByUserName: null | string,
  committedByIsGM: false | true,
  unlockedAt: null | "ISO timestamp",
  unlockedByUserId: null | string,
  unlockedByUserName: null | string,
  unlockedByIsGM: false | true,
  historicalCommittedStationKeys: []
}
```

### Status meaning

- `selecting` — the current-round proposed order may be edited and has not been confirmed.
- `committed` — the current-round committed order is authoritative and action lock-in may proceed once the phase is `stationOrders`.
- `unlocked` — a previously committed order was explicitly unlocked; the historical committed order remains available for audit while a new proposal may be edited.

### Valid committed order

A valid committed order must:

- belong to the current session;
- belong to the current round;
- contain every active station exactly once;
- contain no inactive or unknown station;
- contain no duplicate station;
- have status `committed`;
- preserve immutable snapshots for consumers.

A previous-round or legacy event-wide order cannot authorize the current round.

## Initialization, repair, and migration

When a new round begins:

1. Read the destination round's active station list.
2. Start from the previous round's committed order only as a suggestion.
3. Retain destination-active stations from that prior order in relative order.
4. Append newly active stations in the destination round's authored order.
5. Remove inactive stations and duplicates.
6. Set status to `selecting`.
7. Clear `committedStationKeys`.
8. Record `orderSource` and `suggestionSource`.

Legacy committed state may be migrated only when its round identity and active-station permutation are valid. Migration must not silently authorize a different round or session.

## Crew Planning phase gate

Leaving `crewPlanning` is allowed only when:

- the current round exists;
- the current round is not already started or completed through another lifecycle path;
- the canonical action-order state belongs to the current round;
- the action-order status is `committed`;
- `committedStationKeys` is an exact permutation of current active stations.

The only normal transition out of `crewPlanning` is to `stationOrders`.

Direct phase setters, wrapper methods, legacy aliases, and UI controls must all use the same authoritative gate. A blocked transition must not change timestamps, summaries, round state, or any secondary state.

## Station Action and Risk Bid lock-in gate

Station Action selection, skill selection, action lock-in, Risk Bid selection, Risk Bid clearing, submission, and station result recording must use one authoritative planning-lock gate.

The gate allows station decision changes only when:

- current phase is `stationOrders`;
- the current-round order is valid and committed;
- the target station is active in the current round;
- the operation belongs to the current session and round;
- the station decision has not already been locked, except through explicit authorized unlock or cleanup behavior.

Required behavior:

- Station Action selection is blocked before order confirmation.
- Station Action lock-in is blocked before order confirmation.
- Risk Bid selection is blocked before order confirmation.
- A selected Risk Bid locks together with its Station Action.
- A locked Risk Bid cannot be replaced or cleared while the Station Action remains locked.
- Station result recording is blocked without a confirmed order and a locked Station Action.
- Blocked operations return the original session without normalization, container creation, timestamp changes, or secondary mutation.
- The player-safe gate projection is frozen and contains only player-safe blocker information.

Explicit GM unlock and cleanup behavior must remain narrow, auditable, and unable to authorize unrelated sessions or rounds.

## Station resolution order

After lock-in:

- Stations resolve according to `committedStationKeys`.
- A station outside the committed order cannot resolve.
- A station cannot resolve from a previous round's order.
- Later sequence enforcement may require earlier stations to resolve first, but that is separate from the Slice 03 lock-in gate.
- Result recording must remain deterministic and idempotent.

## Synchronized proposed-order updates

Shared proposed-order updates must include:

- session identity;
- round identity;
- state revision or equivalent stale-update protection;
- proposed station order;
- requesting user identity and authorization context where needed.

The synchronization layer must reject:

- stale updates;
- malformed updates;
- unknown stations;
- duplicate stations;
- wrong-session updates;
- wrong-round updates;
- unauthorized confirmation or unlock attempts.

Simultaneous edits must resolve deterministically. Reloaded or reconnected clients must receive authoritative current state rather than replaying stale local state.

## Player visibility boundary

During Crew Planning, players may see:

- all active stations;
- all current player-safe Station Actions;
- all authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bid rewards;
- player-safe targets, timing, duration, expiration, dangers, and known conditions;
- available shared resources;
- proposed and committed station order;
- earned player-facing bonus cards and their valid targets;
- player-safe blocker and readiness messages.

Players must not see:

- hidden hazards that have not been revealed;
- unrevealed backlash details;
- GM-only consequence candidates;
- internal scoring or outcome math;
- future triggers or secret event branches;
- GM-only notes;
- audit identities that are not needed for play;
- pending apply payloads;
- debug state.

Player-safe projections must be immutable, deterministic, and free of aliases to authoritative session state.

## Mutation boundary

Crew Planning, Station Action selection, Risk Bid selection, rolls, hazards, and consequence staging must not silently mutate Foundry world documents.

No operation in this workflow may automatically create, update, or delete:

- Actors;
- Items;
- Active Effects;
- Journal Entries;
- Chat Messages;
- Scenes;
- Tokens;
- Compendium content;
- world settings;
- unrelated socket state.

Persistent actor, ship, or world changes require explicit reviewed GM application through the appropriate later resolution workflow.

## Implementation order

Implement in this order:

1. Canonical round-specific order state.
2. Canonical `crewPlanning` phase lifecycle.
3. Station Action and Risk Bid lock-in gates.
4. Player-safe shared planning projection.
5. Synchronized multiplayer proposed-order updates.
6. Captain confirmation and GM override or unlock behavior.
7. Primary Crew Planning interface.
8. Stable targeted panel updates.
9. Multiplayer Foundry closeout and replacement TV2-003 verification.
10. Authored benefit, danger, hazard, consequence, reward, clue, and persistent-application systems.

## Acceptance requirements

Travel Alpha cannot call this workflow playable until all of the following pass:

- [ ] Crew Planning appears automatically at the beginning of every round.
- [ ] Every player sees all active stations and all current player-safe Station Actions.
- [ ] Every action exposes authored `+2`, `+5`, and `+8` Risk Bid choices.
- [ ] Every Risk Bid shows its player-safe reward, target, timing, duration or expiration, and danger.
- [ ] Rewards can target self, another station, the next station, a later round, the crew, ship, hazard, backlash, consequence, rewards, salvage, discoveries, or clues as authored.
- [ ] Players can synchronously rearrange the current-round order.
- [ ] The Captain can confirm and the GM can override or unlock.
- [ ] Station Actions and Risk Bids cannot select, lock, submit, or resolve before current-round confirmation and `stationOrders`.
- [ ] Locked Risk Bids remain coupled to locked Station Actions.
- [ ] Reordering does not rerender or reset the entire runner interface.
- [ ] The committed order applies only to the current session and round.
- [ ] The next round begins with a fresh Crew Planning phase.
- [ ] Reload, reconnect, and session switching preserve authoritative state without stale local overwrite.
- [ ] Hidden and GM-only information remains redacted from player state.
- [ ] Blocked operations create no secondary state changes.
- [ ] No unintended Foundry mutation occurs.
- [ ] Focused smokes, aggregate Travel v2 smoke, Foundry check-runner smoke, and live multiplayer verification pass.

## Reference rule

When older Travel v2 documents conflict with this design, use this document for shared Crew Planning, station order, Station Action gating, and authored Risk Bid behavior until those documents are intentionally revised in the same direction.

The single execution checklist for reaching Travel Event Alpha is:

- `docs/TRAVEL_V2_ALPHA_EXECUTION_PLAN.md`
