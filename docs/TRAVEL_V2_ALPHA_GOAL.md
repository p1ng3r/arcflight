# Travel v2 Alpha Gameplay Goal

Status: canonical Travel Alpha gameplay reference.

This document records the locked Travel v2 alpha target. Use it as the primary reference for Travel implementation before beginning Combat Alpha or beta work.

The alpha goal is not to finish every possible Travel v2 mechanic. The goal is to prove that a Foundry table can run two complete, enjoyable Travel v2 events without hidden mutation, player-facing information leaks, or design drift.

## Alpha definition

Travel v2 alpha is complete when the table can run two playable travel events from setup through final resolution and explicit application.

Alpha requires:

- Two outlined and implemented playable events.
- Event 1: a substantially updated `The Lantern in the Static`.
- Event 2: a different event focused on physical voidfaring, navigation, ship pressure, salvage, environmental danger, and ship-scar behavior.
- At least three rounds per event.
- No event shorter than three rounds.
- Events may contain as many as twelve rounds when explicitly authored and validated.
- All five core stations active:
  - Captain.
  - Navigator.
  - Engineer or Arkengineer.
  - Veilwarden.
  - Watchmaster.
- Shared Crew Planning at the beginning of every round.
- Player-chosen station order for every round.
- Every station action containing authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
- Players seeing the player-safe benefits, targets, timing, and dangers of those bids before choosing station order.
- Station actions and Risk Bids locked before resolution.
- Results calculated behind the scenes from actual round results rather than a visible success/failure track.
- One official dynamic vignette between rounds.
- Immediate mechanical callouts below vignette prose.
- Explicit GM review and explicit GM application for persistent ship changes.
- No automatic actor, item, effect, journal, chat, socket, scene, token, compendium, or world mutation from rolls, bids, hazards, consequences, or event completion.

## Highest-priority Travel Alpha blocker

The first Travel Alpha gameplay priority is the shared round-planning and authored Risk Bid workflow.

Do not close TV2-003 using the obsolete GM-only, once-per-event station-order implementation.

The corrected workflow requires:

- Every round begins in a shared Crew Planning phase.
- Every connected player sees every active station.
- Every player sees every current player-safe station action.
- Every station action displays its authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
- Every Risk Bid displays its player-safe reward, target, timing, and danger.
- Players discuss combinations and choose the current round's station order together.
- The Captain has final say when the crew cannot agree.
- The GM retains override and unlock controls for table management.
- The committed order applies only to the current round.
- Station actions cannot lock or resolve until the current round order is confirmed.
- The next round begins with a fresh Crew Planning phase.
- Reordering does not rebuild the entire runner, collapse controls, reset scroll position, or lose keyboard focus.

Canonical detailed reference:

- `docs/TRAVEL_V2_SHARED_ROUND_PLANNING_AND_RISK_BIDS.md`

## Non-goals for alpha

The following remain beta-or-later unless directly required to prove the two-event alpha loop:

- A full voyage-campaign layer.
- Complete travel-event marketplace polish.
- Final authoring-tool polish.
- A full crew economy.
- Broad procedural generation.
- Live AI narration.
- Automatic journal creation.
- Automatic item or effect creation.
- A completed ship-sheet Voyage Log interface.
- Every imaginable hazard form.
- Every imaginable Risk Bid reward.
- Complete economy or reward balance.
- Final visual polish for every runner panel.
- Automatic persistent ship mutation.

## Core event flow

A playable Travel v2 event follows this table loop:

1. The GM opens event setup.
2. Players see the broad event stakes.
3. Players see threatened resources, known dangers, event length, and available stations.
4. Round 1 enters the shared Crew Planning phase.
5. Every player sees every active station's player-safe actions for the current round.
6. Every action displays its authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
7. Every bid displays its player-safe reward, target, timing, and danger.
8. Players discuss possible actions, Risk Bids, combinations, and station-order strategies.
9. Players arrange the station order for the current round.
10. The Captain has final say when the crew cannot agree.
11. The Captain confirms the crew's selected order.
12. The GM may override or unlock the order when table management requires it.
13. Players choose and lock their station actions.
14. Players choose and lock one Risk Bid for each selected action.
15. Stations resolve in the committed order.
16. Successful Risk Bids create their authored benefits, cards, protections, or future effects.
17. Failed and critically failed Risk Bids stage their authored dangers.
18. Pressure, hazards, backlash, benefits, consequences, and possible scars are recorded.
19. The GM opens Round Resolution.
20. The system previews the official transition vignette.
21. Mechanical changes appear immediately below the vignette.
22. The GM reviews and confirms Round Resolution.
23. The official between-round vignette is shown to players.
24. The next round enters a fresh Crew Planning phase.
25. Players review the new round's actions and Risk Bids.
26. Players choose a new station order for that round.
27. The process repeats for at least three rounds.
28. Gold-standard events include a meaningful final decision when appropriate.
29. The GM opens End-of-Event Resolution.
30. The GM reviews outcome, rewards, discoveries, consequences, scars, pressure, follow-ups, and proposed ship changes.
31. The GM explicitly applies approved persistent changes.
32. The event writes an audit/history record.
33. Shared Momentum resets at the end of the event.

## Shared Crew Planning

Every round begins with a shared Crew Planning phase.

Crew Planning is a player-facing gameplay phase, not a GM setup panel or an Advanced Runner Details tool.

During Crew Planning:

- Every connected player sees every active station.
- Every player sees all player-safe station actions for the current round.
- Every player sees all three Risk Bid tiers attached to each action.
- Players may review possible rewards before selecting station order.
- Players may discuss which stations should act earlier or later.
- Players may plan self-benefits, next-station benefits, cross-station benefits, future-round benefits, and defensive benefits.
- All players see the same synchronized proposed station order.
- Changes made by one player appear for the other players.
- The Captain provides a final decision when the crew cannot agree.
- The GM observes the same order and retains override controls.

Crew Planning ends only when the current round's order is confirmed.

Station action lock-in and station resolution remain blocked until that confirmation occurs.

## Station order

Station order is chosen separately for every round.

Rules:

- Players choose the order together.
- The order is selected after reviewing the current round's station actions and Risk Bids.
- The Captain has final say when the table cannot agree.
- Captain final say is table guidance and should not expose hidden information.
- The GM may override or unlock the order for table management.
- The order is committed for the current round only.
- The next round requires a new order decision.
- The previous round's order may be offered as a starting suggestion.
- The previous round's order must not remain automatically committed.
- The committed order determines station-resolution sequence.
- The committed order also determines the meaning of rewards such as `next station`, `later station`, and `station acting after this one`.

The preferred interface is a synchronized draggable station-card list with accessible Move Up and Move Down controls.

Reordering must update the order interface without:

- rebuilding the entire runner;
- closing open controls;
- returning users to the top;
- losing keyboard focus;
- interrupting player discussion;
- replacing the current application window.

## Station actions

Every active station receives authored actions for the current round.

Station actions should include:

- Action name.
- Short player-facing description.
- Action-specific vignette or narrative context.
- Applicable statistic or check.
- Base DC or DC source.
- Player-safe success goal.
- Authored `+2 DC` Risk Bid.
- Authored `+5 DC` Risk Bid.
- Authored `+8 DC` Risk Bid.
- Any Focus availability.
- Any known restrictions.
- Any player-safe hazard interactions.

Players openly discuss their intended actions before locking them.

Once a station action and Risk Bid are locked, they cannot be changed merely because an earlier station rolled well or badly.

The GM may unlock an action only through an explicit table-management workflow.

## Risk Bids

Risk Bids are mandatory for Travel Alpha.

Every station action has three authored Risk Bid tiers:

- `+2 DC`
- `+5 DC`
- `+8 DC`

The selected bid increases that action's DC by the listed amount.

The action author defines a distinct reward and danger for every tier.

Rules:

- Risk Bids belong directly to station actions.
- Risk Bids are not a separate universal action menu.
- The benefit does not always help another station.
- Every bid presents player-safe reward text.
- Every bid presents player-safe danger text.
- The exact hidden consequence details may remain GM-only.
- Risk Bids are chosen before the action resolves.
- Risk Bids are locked before earlier results reveal hidden consequences.
- Higher bids should generally offer stronger or more flexible rewards.
- Higher bids must also present greater danger.
- Failure on a Risk Bid must matter.
- Critical failure must be particularly dangerous.
- A `+8 DC` bid should never feel harmless when it fails.

A Risk Bid reward may benefit:

- the acting station during its current action;
- the acting station's next roll;
- the acting station during a later round;
- the next station in the committed order;
- any later station in the committed order;
- another chosen station;
- a specific named station;
- the whole crew;
- the ship;
- an eligible hazard response;
- an eligible backlash response;
- an eligible consequence response;
- the event's rewards, clues, discoveries, salvage, or route outcome.

## Authored Risk Bid reward patterns

Supported reward patterns include, but are not limited to:

### Roll bonuses

- Add `+2` to an eligible roll.
- Add `+3` to an eligible roll.
- Add `+5` to an eligible roll.
- Grant the bonus to the acting station.
- Grant the bonus to the next station.
- Grant the bonus to another chosen station.
- Grant the bonus to a specific named station.

### Fortune effects

- Roll `2d20` and keep the highest.
- Grant fortune to the acting station's next roll.
- Grant fortune to the next station.
- Grant fortune to another eligible station.

### Degree-of-success protection

Improve the next eligible failed result by one degree:

- Critical Failure becomes Failure.
- Failure becomes Success.
- Success and Critical Success remain unchanged unless the authored effect says otherwise.

The benefit must clearly define:

- who receives it;
- which roll it affects;
- when it expires;
- whether it can be held;
- whether it can be combined with other effects.

### Future DC reduction

Examples include:

- Reduce this station's next DC by 2.
- Reduce this station's first action DC next round by 2.
- Reduce another station's next eligible DC.
- Reduce the next station's action DC.
- Reduce an authored hazard-response DC.

### Bonus cards

A successful Risk Bid may create a player-facing bonus card.

The card should identify:

- Card name.
- Source action.
- Source station.
- Receiving station or valid target.
- Mechanical effect.
- Timing.
- Expiration.
- Whether spending it is optional.
- Whether it is consumed on use.
- Whether it may be transferred.
- Whether it affects a roll, DC, degree of success, hazard, backlash, or consequence.

### Consequence protection

Possible benefits include:

- Prevent the next eligible consequence.
- Downgrade the next eligible consequence.
- Absorb one consequence.
- Cancel a specified consequence category.
- Allow the GM and player to choose between two reduced consequences.
- Prevent a consequence from escalating into a scar.

Persistent changes still require explicit GM review and application.

### Hazard and backlash responses

Possible benefits include:

- Suppress a revealed hazard.
- Reduce a hazard countdown.
- Prevent the next hazard escalation.
- Weaken an authored backlash.
- Redirect a hazard effect.
- Protect one station from a known hazard.
- Grant a bonus to a future hazard-response action.

### Reward and discovery benefits

Possible benefits include:

- Improve salvage.
- Reveal a route clue.
- Preserve cargo.
- Discover a hidden location.
- Improve the final reward tier.
- Gain a contact or follow-up.
- Create a future travel advantage.

## Risk Bid dangers

Every Risk Bid tier has authored failure danger.

Possible dangers include:

- Additional pressure.
- Pressure escalation.
- A new hazard.
- Hazard escalation.
- Backlash.
- A station complication.
- A future DC increase.
- A penalty card.
- Loss of an opportunity.
- Reduced reward.
- Cargo, supplies, morale, hull, Lifeveil, or Strain danger.
- A GM-reviewed consequence candidate.
- A ship-scar candidate.
- A dangerous final-round choice.
- A complication for another station next round.

The exact danger should reflect the action and event rather than relying on one universal table.

## Cross-station support

Helping another station is one possible authored Risk Bid reward.

It is not a separate action category required on every station action.

Some bids:

- help only the acting station;
- help the acting station next round;
- affect the next station;
- affect any later station;
- affect one named station;
- allow the player to choose a station;
- affect the entire crew;
- create no station bonus and instead prevent a consequence or hazard.

When order matters, the player-facing UI must explain it clearly.

Examples:

- `Give the next station +3 on its roll.`
- `Choose any later station; it rolls 2d20 and keeps the highest.`
- `Navigator must act after Engineer to receive this benefit.`
- `Reduce this station's first action DC next round by 2.`
- `Improve the next eligible failure by one degree.`
- `Prevent the next eligible consequence created this round.`

Benefits use their authored duration and expiration rules.

## Focus

Focus is part of Travel Alpha and should not become a free rescue button.

Core Focus rules:

- Focus belongs to the assigned station or player.
- Focus is not part of the shared Momentum pool.
- Each station receives one Focus use per event unless another feature changes it.
- Focus resets at the end of the event.
- Focus is declared before rolling.
- Focus rolls `2d20` and keeps the higher result.
- Focus is not a reroll after failure.
- Focus may improve success.
- Focus failure creates backlash.
- Focus critical failure creates severe backlash.
- Focus should only be available on actions that explicitly allow it.
- Focus may interact with a Risk Bid.
- Focus must not make a high Risk Bid safe.

Possible Focus backlash includes:

- Extra pressure.
- Hazard escalation.
- A station complication.
- A weakened or corrupted benefit.
- Momentum loss.
- A GM-reviewed consequence candidate.
- A ship-scar candidate on severe failure.

## Momentum

Momentum is the crew's shared resource.

Rules:

- Momentum belongs to the crew.
- Momentum should be tied to the ship actor when persistent storage is implemented.
- Momentum is visible to players.
- Momentum resets at the end of each event.
- The GM may award Momentum for excellent roleplay, clever planning, strong table decisions, or authored event outcomes.
- Momentum may be spent only through approved actions.
- Momentum spending should be explicit.

Possible Momentum uses include:

- Improve a result.
- Suppress a hazard effect.
- Improve an earned benefit.
- Reveal a clearer hidden-hazard tell.
- Protect a bonus card.
- Reduce an authored backlash.
- Support an event-specific response.

Momentum differs from Focus:

- Momentum is shared and represents crew-wide advantage.
- Focus is station-specific overcommitment declared before a roll.

## Hazards

Travel Alpha hazards must have mechanical effects.

Each event should include:

- One authored primary evolving hazard.
- Optional secondary hazards selected from event-authored options.
- GM override when random or weighted selection is used.

The primary hazard is authored rather than randomly chosen.

Secondary hazards may be selected from the event's own tagged pool.

Travel Alpha should demonstrate multiple hazard forms:

1. Station Modifier Hazard.
2. Station Lockout Hazard.
3. Countdown Hazard.
4. Pressure Cascade Hazard.
5. Response Action Hazard.
6. Consequence or Scar Handoff Hazard.

Rules:

- Revealed hazards have player-visible names.
- Hidden hazards provide player-facing tells before full reveal.
- Hidden hazards may influence vignettes without exposing secret details.
- Players may see known mechanical restrictions.
- Players must not see unrevealed consequence trees or GM notes.
- Momentum may reveal clearer information without exposing the entire hidden state.
- Risk Bid rewards may suppress, weaken, redirect, or protect against eligible hazards.
- Risk Bid failures may create or escalate hazards.

## Pressure

Pressure represents accumulating danger to the ship, crew, or voyage.

Possible pressure categories include:

- Hull.
- Strain.
- Lifeveil.
- Morale.
- Supplies.
- Cargo.
- Event-specific pressure.

Rules:

- Players may see player-safe current pressure information.
- Pressure changes appear in mechanical callouts.
- Pressure changes may result from station actions, Risk Bids, hazards, backlash, or event decisions.
- Persistent pressure changes require the appropriate explicit GM application boundary.
- Pressure should influence future rounds, hazards, consequences, or final outcomes when authored to do so.

## Vignettes and mechanical callouts

Between-round vignettes are core gameplay.

There should be one official transition vignette for each completed round.

The vignette is dynamically assembled from actual results.

Possible ingredients include:

1. The round's base transition.
2. The best station result.
3. The worst station result.
4. A major Risk Bid outcome.
5. An earned benefit.
6. Hazard movement.
7. A hidden-hazard tell.
8. Pressure or resource change.
9. A next-round hook.

Rules:

- The GM may edit the official vignette before displaying it.
- The vignette must not reveal hidden mechanics accidentally.
- Important mechanical changes must not exist only in prose.
- Mechanical callouts appear immediately below the vignette.
- Players see one official version rather than multiple competing drafts.

Example:

> The lantern's static recoils as the Navigator holds the line, but the Engineer's failed overburn leaves a second pulse inside the Arkengine. The Watchmaster's warning reaches the Veilwarden in time, granting a narrow opening as the next wave presses against the Lifeveil.

Mechanical Changes:

- Strain pressure +1.
- Veilwarden receives a `+3` bonus card.
- Hidden hazard tell: command echo.
- Engineer backlash staged for review.

## Event stakes

Players see broad stakes before Round 1.

Setup stakes may include:

- Crisis summary.
- Threatened resources.
- Broad failure danger.
- Broad success reward.
- Round count.
- Available stations.
- Known hazards.
- Suspicious tells.

Each round reveals sharper player-safe stakes.

Round stakes should respond to:

- previous results;
- pressure;
- revealed hazards;
- earned benefits;
- failed Risk Bids;
- consequences;
- player decisions;
- event-authored developments.

## Consequences

Failed station actions do not automatically create consequences.

Consequence candidates should appear when supported by:

- a Risk Bid danger;
- a hazard;
- pressure;
- backlash;
- a critical failure;
- a special event rule;
- final-round stakes;
- an unresolved countdown;
- an explicit narrative choice.

The consequence queue is GM-only.

Players may see player-safe descriptions after consequences are revealed or approved.

Risk Bid benefits may prevent, cancel, absorb, or downgrade eligible consequences when explicitly authored.

Persistent consequences require explicit GM review and application.

## Ship scars

Ship scars represent persistent damage, weakness, or transformation.

Rules:

- A scar candidate does not automatically modify the ship.
- Scar candidates are reviewed by the GM.
- Approved scars are explicitly applied.
- Scar application creates an audit entry.
- Scars may later be repaired through events, downtime, port services, upgrades, or a future repair system.
- Risk Bid failure, severe backlash, unresolved hazards, or final-round decisions may create scar candidates.
- Risk Bid benefits may prevent escalation into a scar when authored to do so.

## Final decisions

Gold-standard events should contain a meaningful final decision when appropriate.

Example final choices for `The Lantern in the Static`:

- Rescue the Lantern Voice:
  - greater reward;
  - greater danger;
  - occult follow-up.
- Cut Free Cleanly:
  - safer escape;
  - lower reward;
  - fewer consequences.
- Burn Hard and Abandon It:
  - immediate escape;
  - Strain danger;
  - possible morale or story consequence.

Final decisions should respond to the event's actual results rather than ignoring earlier player choices.

## Apply to ship

Persistent ship changes require explicit GM application.

Rules:

- The GM receives a final confirmation summary.
- Every persistent proposed change is visible before application.
- Apply-to-ship is explicit.
- No roll automatically modifies the ship.
- No Risk Bid automatically modifies the ship.
- No hazard automatically modifies the ship.
- No event completion automatically modifies the ship.
- Approved changes create an audit/history record.
- Rejected changes do not mutate the ship.

Possible persistent changes include:

- Pressure.
- Scars.
- Rewards.
- Cargo.
- Supplies.
- Route clues.
- Contacts.
- Follow-ups.
- Ship resources.
- Upgrade opportunities.

## Audit and Voyage Log preparation

Travel events should preserve audit-ready history.

The future Voyage Log should be able to show:

- Completed events.
- Round-by-round station order.
- Selected station actions.
- Selected Risk Bids.
- Major results.
- Benefits earned.
- Bonus cards used or expired.
- Hazards encountered.
- Consequences approved.
- Final outcome.
- Rewards gained.
- Scars taken.
- Scars repaired.
- Route clues discovered.
- Contacts made.
- Unresolved follow-ups.
- GM-applied ship changes.

The complete Voyage Log UI is not required for alpha, but the data must be suitable for it.

## Player-facing UI boundaries

During Crew Planning, players should see:

- Current round.
- Current player-safe stakes.
- Every active station.
- Assigned station ownership where available.
- Every current player-safe station action.
- Every action's `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
- Each bid's player-safe reward.
- Each bid's target.
- Each bid's timing.
- Each bid's player-safe danger.
- The shared proposed order.
- The committed current-round order.
- Known hazards and conditions.
- Current shared Momentum.
- Earned player-facing bonus cards.

During action selection and resolution, players should see:

- Their station assignment.
- Their selected action.
- Their selected Risk Bid.
- Their Focus availability.
- Their valid bonus cards.
- The committed order.
- Player-safe resolved results.
- Revealed mechanical changes.

Players must not see:

- Hidden hazards that have not been revealed.
- Unrevealed backlash details.
- GM-only consequence candidates.
- Secret event branches.
- Internal scoring.
- Full outcome math.
- Future triggers.
- GM notes.
- Debug reports.
- Other hidden implementation state.

## Alpha event pair

Both alpha events should be outlined before either receives final polish.

### Event 1: The Lantern in the Static

Primary coverage:

- Occult hazard pressure.
- Lifeveil, Morale, and Strain.
- Hidden-hazard tells.
- Dynamic vignettes.
- Command echoes.
- Player-facing mystery.
- Shared Crew Planning.
- Risk Bid combinations.
- Bonus cards.
- Momentum reveal.
- Consequence review.
- Final rescue, cut-free, or abandon decision.

### Event 2: Shattered Chain Drift

Working title.

Primary coverage:

- Physical voidfaring crisis.
- Hull, Strain, Supplies, and Cargo.
- Navigation through wreckage or a broken chain-field.
- Environmental hazards.
- Salvage opportunity.
- Route-clue reward.
- Round-by-round station-order tactics.
- Self-targeted and cross-station Risk Bid rewards.
- Risk Bid failure creating ship complications.
- Repair and recovery choices.
- Ship-scar candidates.
- Visible physical hazards.

## Implementation priority

Travel Alpha implementation proceeds in this order:

1. Replace the obsolete GM-owned, once-per-event TV2-003 specification.
2. Replace the obsolete TV2-003 Foundry checklist.
3. Add the shared `crewPlanning` phase.
4. Add round-specific station-order state.
5. Expose every current station action through player-safe state.
6. Expose all authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
7. Add synchronized multiplayer order updates.
8. Add Captain confirmation.
9. Add GM override and unlock.
10. Block action lock-in until current-round order confirmation.
11. Add station action and Risk Bid lock-in.
12. Implement authored reward targeting and timing.
13. Implement player-facing bonus cards.
14. Implement failure danger staging.
15. Remove whole-runner rerenders from order movement.
16. Add focused smoke coverage.
17. Add multiplayer synchronization coverage.
18. Add a replacement Foundry table checklist.
19. Complete both gold-standard alpha events.
20. Run end-to-end multiplayer table verification.

## Manual Alpha acceptance checklist

Travel Alpha is not complete until the following can be demonstrated:

### Event setup

- [ ] Two playable events exist.
- [ ] Each event has at least three rounds.
- [ ] All five core stations participate.
- [ ] Broad stakes appear before Round 1.
- [ ] Known dangers and threatened resources are player-visible.
- [ ] Hidden information remains redacted.

### Crew Planning

- [ ] Crew Planning appears automatically at the beginning of every round.
- [ ] Every player sees every active station.
- [ ] Every player sees every player-safe station action.
- [ ] Every action displays authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids.
- [ ] Every bid displays its player-safe reward, target, timing, and danger.
- [ ] Players can discuss actions and bids before selecting order.
- [ ] All players see the same synchronized proposed order.
- [ ] Players can rearrange the order.
- [ ] Dragging works.
- [ ] Move Up and Move Down controls work.
- [ ] Reordering does not rerender the entire runner.
- [ ] Reordering does not collapse controls.
- [ ] Reordering does not reset scroll position.
- [ ] Reordering preserves keyboard focus.
- [ ] The Captain can confirm the order.
- [ ] The GM can override or unlock the order.
- [ ] The committed order applies only to the current round.
- [ ] The next round opens a new Crew Planning phase.

### Actions and Risk Bids

- [ ] Station actions cannot lock before the order is confirmed.
- [ ] Station actions cannot resolve before the order is confirmed.
- [ ] Each station can select an action.
- [ ] Each station can select one authored Risk Bid.
- [ ] The chosen action and bid lock before resolution.
- [ ] The selected bid correctly increases DC by `+2`, `+5`, or `+8`.
- [ ] Rewards may target the acting station.
- [ ] Rewards may target the next station.
- [ ] Rewards may target another chosen station.
- [ ] Rewards may affect a later round.
- [ ] Rewards may affect the crew or ship.
- [ ] Rewards may affect a hazard.
- [ ] Rewards may affect a consequence.
- [ ] Roll bonuses work.
- [ ] `2d20` keep highest works where authored.
- [ ] Future DC reduction works where authored.
- [ ] One-degree failure improvement works where authored.
- [ ] Bonus cards display and expire correctly.
- [ ] Consequence protection works where authored.
- [ ] Failed Risk Bids stage their authored danger.
- [ ] Critical failures stage appropriately severe danger.

### Round resolution

- [ ] Stations resolve in committed order.
- [ ] Benefits use their authored target and timing.
- [ ] Hazards affect play.
- [ ] Pressure changes are recorded.
- [ ] The GM can review staged consequences.
- [ ] The official vignette reflects actual results.
- [ ] Mechanical callouts appear immediately below the vignette.
- [ ] Round Resolution requires explicit GM confirmation.

### Event resolution

- [ ] End-of-Event Resolution shows the final outcome.
- [ ] Rewards are shown.
- [ ] Discoveries and clues are shown.
- [ ] Consequences are shown.
- [ ] Scars are shown.
- [ ] Pressure changes are shown.
- [ ] Follow-ups are shown.
- [ ] Proposed ship changes are shown.
- [ ] Persistent changes require explicit GM confirmation.
- [ ] Applied changes create an audit record.
- [ ] Momentum resets at event end.

### Safety

- [ ] No silent actor mutation occurs.
- [ ] No silent item mutation occurs.
- [ ] No silent effect mutation occurs.
- [ ] No silent journal mutation occurs.
- [ ] No unintended chat mutation occurs.
- [ ] No unintended socket message occurs.
- [ ] No silent scene or token mutation occurs.
- [ ] No silent world mutation occurs.
- [ ] Players do not see GM-only queues.
- [ ] Players do not see hidden hazards.
- [ ] Players do not see unrevealed backlash.
- [ ] Players do not see secret branches.
- [ ] Players do not see debug reports.
- [ ] Players do not see internal scoring.

## Reference rule

When older Travel v2 documents conflict with this file:

- Use `docs/TRAVEL_V2_SHARED_ROUND_PLANNING_AND_RISK_BIDS.md` for shared Crew Planning, station order, Risk Bid ownership, reward targeting, and timing.
- Use this document for the complete Travel Alpha gameplay loop.
- Use `docs/ARCFLIGHT_ALPHA_PILLAR_ROADMAP.md` for overall pillar sequencing.

Conflicting trackers, checklists, and implementation notes must be intentionally corrected before obsolete acceptance testing continues.