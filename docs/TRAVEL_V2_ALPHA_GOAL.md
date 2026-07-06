# Travel v2 Alpha Gameplay Goal

Status: canonical alpha goal reference.

This document records the locked Travel v2 alpha target. Use it as the reference for future implementation slices before moving on to beta design.

The alpha goal is not to finish every Travel v2 roadmap item. The alpha goal is to prove that the Foundry table can run a complete Travel v2 gameplay loop through two playable events without hidden mutation, player-facing leaks, or design drift.

## Alpha definition

Travel v2 alpha is complete when the GM can run two playable travel events from setup through final application.

Alpha requires:

- Two outlined and implemented playable events before beta work begins.
- Event 1: a massively updated `The Lantern in the Static`.
- Event 2: a different event that tests physical voidfaring, navigation, ship pressure, salvage, and ship-scar behavior rather than repeating Lantern's occult pressure profile.
- At least three rounds per event.
- No event shorter than three rounds.
- Events may grow up to twelve rounds, but this should be explicit validation rather than assumed behavior.
- All five core stations active for every playable event: Captain, Navigator, Engineer or Arkengineer, Veilwarden, and Watchmaster.
- Future ship upgrades, rooms, crew, hull features, or special systems may add situational extra stations, but the five base stations remain the core loop.
- Player-facing event stakes at setup, with sharper round-specific stakes revealed as the event progresses.
- Results calculated behind the scenes from round results rather than a visible success/failure track.
- One official dynamic vignette between rounds, assembled from actual results.
- Immediate mechanical callouts below vignette prose.
- Explicit GM review and explicit GM application for any persistent ship changes.
- No automatic actor, item, effect, journal, chat, socket, or world mutation from rolls, hazards, outcomes, or event completion.

## Non-goals for alpha

The following remain beta-or-later unless directly needed to prove the two-event alpha loop:

- Full voyage-campaign layer.
- Complete travel event marketplace or authoring UI polish.
- Full crew economy.
- Broad procedural generation.
- Live AI narration bridge.
- Automatic journal creation.
- Automatic item/effect creation.
- Full ship-sheet Voyage Log UI, though the audit data should be shaped so the tab can exist later.
- Every possible hazard, Momentum, Focus, and risk-bid variant.

## Core event flow

A playable Travel v2 event follows this table loop:

1. GM opens event setup.
2. Players see the broad event stakes, threatened resources, event length, known dangers, and available stations.
3. Players choose station order before Round 1 begins.
4. Captain station has final say if the table cannot agree, as guidance text rather than hard UI enforcement.
5. GM can drag or reorder stations for building and table management.
6. GM locks station order.
7. GM may unlock station order if needed.
8. Opening Round 1 vignette is shown.
9. Players openly discuss station actions.
10. Players lock actions before station-by-station resolution.
11. Players choose any allowed risk bid before consequences are known.
12. Stations resolve in locked order.
13. Earlier stations may create help for any later station in the same round.
14. Later stations may consume available help.
15. Hazards, pressure, backlash, and consequence candidates are staged.
16. GM opens Round Resolution.
17. System previews the official transition vignette and mechanical changes.
18. GM confirms Round Resolution.
19. Official between-round vignette is shown with mechanical callouts immediately below it.
20. Repeat for at least three rounds.
21. Gold-standard alpha events should include a meaningful final decision in the final round when appropriate.
22. GM opens End-of-Event Resolution.
23. GM reviews final outcome, rewards, consequences, scars, pressure, follow-ups, and ship changes.
24. GM explicitly applies approved changes to the ship.
25. The event writes an audit/history record for later Voyage Log use.
26. Shared Momentum resets at the end of the event.

## Station order

Station order is chosen once before the opening round and normally remains fixed for the full event.

Rules:

- Players choose the order together.
- The Captain station has final say if the table cannot agree.
- This is guidance text, not a hard permission lock.
- GM can drag or reorder the order while building or testing.
- GM can lock the order.
- GM can unlock the order.
- Station order matters because it determines which stations can create help for later stations.

The preferred UI is a draggable station-card order list.

## Station actions and action lock-in

Players talk openly about what they intend to do, then lock actions before resolution.

Rules:

- Players may discuss station choices before locking.
- Once a station action is locked, it cannot be changed because another station rolled well or badly.
- Station cards should show the player's own station actions and a short action-specific vignette explaining how the action ties into the event.
- Players should not see GM-only consequence queues, hidden hazards, unrevealed backlash, or internal scoring.
- Players may see other locked station actions when appropriate, but not GM-only state.

## Risk bids

Risk bids are mandatory for alpha.

Risk bid values are fixed as:

- `+2`
- `+5`
- `+8`

Rules:

- Risk bids cost nothing up front.
- The cost is increased danger.
- Risk bids are chosen before consequences are known.
- Not every station action in every round needs to allow a risk bid.
- Each event decides where risk bids are available.
- Each station should have station-flavored risk bid names and text.
- Risk bids may add pressure, escalate hazards, create additional hazards, create consequence candidates, complicate another station next round, affect help quality, improve rewards, or stage ship scar candidates.
- A failed risk bid should matter.
- A critical failure on a risk bid should be especially dangerous.
- A `+8` risk bid should never feel harmless on failure.

Example station flavor:

| Station | +2 | +5 | +8 |
| --- | --- | --- | --- |
| Captain | Press the Crew | Hard Command | No One Breaks |
| Navigator | Cut the Angle | Thread the Needle | Blind Through the Black |
| Engineer | Hot Tune | Dangerous Burn | Arkengine Overload |
| Veilwarden | Thin the Veil | Borrow Breath | Open the Wards |
| Watchmaster | Call the Pattern | Stand Exposed | Eyes on the Impossible |

## Focus

Focus is part of alpha and should not become a free rescue button.

Core Focus rule:

- Focus is tied to the assigned station/player, not the shared ship Momentum pool.
- Each station/player gets one Focus use per event unless a future feature changes that.
- Focus resets at the end of the event.
- Focus is declared before rolling.
- Focus rolls `2d20` and keeps the better result.
- Focus may improve success.
- Focus failure causes backlash.
- Focus critical failure causes severe backlash.
- Focus can have downsides.
- Focus is not a reroll after failure.
- Focus should only be available on actions that allow Focus.

Focus backlash can include:

- Extra pressure.
- Hazard escalation.
- A station complication.
- Corrupted or unstable help.
- Momentum loss.
- A GM-reviewed consequence candidate.
- A ship scar candidate on severe failure, a high-risk bid, or a final-round crisis.

Focus should interact with risk bids, but it must not make risk bids safe.

## Momentum

Momentum is the shared crew resource.

Rules:

- Momentum is shared by the crew.
- Momentum should be tied to the ship actor.
- Momentum is visible to players.
- Momentum resets at the end of each event.
- GM may award Momentum for excellent roleplay, clever planning, or strong table decisions.
- Momentum can be spent on approved actions such as improving a result, suppressing a hazard effect, improving a benefit, or revealing a clearer hidden hazard tell.

Momentum differs from Focus:

- Momentum is shared and represents crew-wide advantage.
- Focus is personal or station-specific overcommitment before a roll.

## Inter-station help

Inter-station help should be a visible gameplay system, not just a hidden modifier.

Rules:

- Each event defines custom help actions.
- Not every station needs a help action every round.
- Help is created by earlier stations and can be used by any later station in the same round.
- Help normally expires at the end of the round unless the event says otherwise.
- Success creates a help option.
- Critical success creates stronger help.
- Critical success may create an automatic benefit for the station being helped if that station chooses to use the help.
- Failure may create no help or weak help if the event specifically says so.
- Critical failure creates backlash.

Under the hood, implementation may reuse the existing pending station benefit queue, but the player-facing system should read as Inter-Station Help.

## Hazards

Alpha hazards should have real mechanical teeth.

Each event should have:

- One authored main evolving hazard that defines the crisis.
- Optional secondary hazards selected from event-tagged hazard options.
- GM override for any random secondary hazard choice.

The main hazard is authored, not random. Secondary hazards may be randomly selected from the event's own pool.

Six hazard forms should exist for alpha coverage:

1. Station Modifier Hazard: changes station checks or action conditions.
2. Station Lockout Hazard: temporarily blocks or restricts a station action.
3. Countdown Hazard: ticks down each round until answered or escalated.
4. Pressure Cascade Hazard: adds or escalates pressure when ignored or failed.
5. Response Action Hazard: lets a station suppress, clear, redirect, or reduce the hazard.
6. Consequence or Scar Handoff Hazard: becomes a GM-reviewed consequence or ship scar candidate if unresolved.

Rules:

- Revealed hazards should have player-visible names.
- Hidden hazards should have tells before full reveal.
- Hidden hazards may influence between-round vignettes without exposing GM-only details.
- Momentum may reveal the name, nature, or clearer tell of a hidden hazard, but should not expose all GM notes, future triggers, or full consequence trees.

## Vignettes and mechanical callouts

Between-round vignettes are core gameplay, not flavor polish.

Rules:

- Vignettes should be dynamically assembled from actual results, like a choose-your-own-adventure transition.
- There should be one official vignette, not multiple variants.
- GM can edit the official vignette before showing it to players.
- Mechanics appear immediately below the vignette.
- Important gameplay changes must not be hidden in prose only.

Preferred assembly ingredients:

1. Round base transition.
2. Best station result.
3. Worst station result.
4. Major hazard movement.
5. Hidden hazard tell.
6. Resource or pressure change.
7. Next-round hook.

Example structure:

> The lantern's static recoils as the Navigator holds the line, but the Engineer's failed overburn leaves a second pulse inside the Arkengine. Somewhere in the rigging, a voice repeats an order the Captain has not given yet. The Lifeveil holds for now, but Strain rises as Round 2 begins.

Mechanical Changes:

- Strain pressure +1.
- Hidden hazard influence: command echo.
- Engineer backlash created.
- Navigator created a route opening for a later station.

## Event stakes and final choices

Players should see general event stakes at setup and more specific round stakes as the event unfolds.

Setup stakes may include:

- Crisis summary.
- Threatened resources.
- Broad failure danger.
- Broad success reward.
- Round count.
- Known hazards or suspicious tells.

Round stakes should get more specific and should respond to what happened in previous rounds.

Not every event needs a final choice, but alpha gold-standard events should include a meaningful final-round decision when appropriate.

Example final choices for Lantern:

- Rescue the Lantern Voice: greater reward, greater risk, occult follow-up.
- Cut Free Cleanly: safer escape, lower reward, fewer consequences.
- Burn Hard and Abandon It: fast escape, Strain risk, possible morale or story consequence.

## Consequences

Failed station actions should not always create consequence candidates.

Consequence candidates should usually appear when tied to:

- A risk bid.
- Hazard pressure.
- Help backlash.
- Focus backlash.
- A special event rule.
- A critical failure.
- Final-round stakes.

The consequence queue is GM-only.

## Apply to ship and audit records

Persistent ship changes require explicit GM application.

Rules:

- The GM gets a final confirmation summary before applying changes.
- Apply-to-ship is explicit.
- No roll, hazard, event completion, or outcome package mutates a ship automatically.
- Applied results create an audit/history record.
- Audit data should support a future ship-sheet Voyage Log tab.
- Ship scars can be removed later through repair events, downtime, port services, or future repair systems.
- Rewards should be preserved both in the completed event record and attached to the ship where useful.

Future Voyage Log should eventually show:

- Completed events.
- Final outcome.
- Rewards gained.
- Scars taken.
- Scars repaired.
- Route clues discovered.
- Contacts made.
- Unresolved follow-ups.
- GM-applied changes.
- Audit trail of what was applied.

## Player-facing UI boundaries

Players should see:

- Their station.
- Their current action choices.
- Short action-specific vignette text.
- Risk bid options if available.
- Help options if available.
- Focus availability if the action supports it.
- Roll button.
- Momentum options if allowed.
- Current shared Momentum.
- Immediate round context.

Players should not see:

- GM consequence queue.
- Hidden hazards unless revealed.
- Unrevealed backlash.
- Full event math.
- Internal scoring.
- GM-only debug reports.
- Future triggers or hidden consequence trees.

## Alpha event pair

Outline both alpha events before fully rewriting Lantern, so they test different systems.

### Event 1: The Lantern in the Static

Primary focus:

- Occult hazard pressure.
- Lifeveil, Morale, and Strain.
- Hidden hazard tells.
- Dynamic vignettes.
- Command echoes.
- Player-facing mystery.
- Momentum reveal.
- Consequence queue.
- Final rescue, cut-free, or abandon decision.

### Event 2: Shattered Chain Drift

Working title only.

Primary focus:

- Physical voidfaring crisis.
- Hull, Strain, Supplies, and Cargo.
- Navigation through broken chain-field or wreckage drift.
- Salvage opportunity.
- Route clue reward.
- Station-order tactics.
- Risk bids creating direct ship complications.
- Repair or recovery choices.
- Ship scar candidate.
- Visible environmental hazards.

## Manual alpha acceptance checklist

A GM-only table test is acceptable before multiplayer polish.

Alpha acceptance should prove:

- Two events exist and can be run start to finish.
- Event setup works.
- Broad stakes display before Round 1.
- Station order can be chosen before Round 1.
- Station order can be dragged, locked, and unlocked by the GM.
- All five stations participate.
- Players or GM can lock actions before resolution.
- Risk bids `+2`, `+5`, and `+8` work where allowed.
- Station-specific risk bid flavor appears.
- Focus is declared before rolling and uses `2d20 keep highest`.
- Focus failure creates backlash.
- Inter-station help can be created and consumed by later stations.
- Critical help can create stronger or automatic benefit.
- Critical help failure can create backlash.
- Momentum is visible, shared, and resets after the event.
- Hazards use multiple forms and can affect play.
- Hidden hazards can influence vignettes without leaking internals.
- The GM can edit the official transition vignette.
- Mechanical callouts display immediately below vignette prose.
- Round Resolution requires GM confirmation.
- End-of-Event Resolution shows final outcome, rewards, consequences, scars, pressure, follow-ups, and ship changes.
- Apply-to-ship requires explicit GM confirmation.
- Audit/history record is written.
- No silent actor, item, effect, journal, chat, socket, or world mutation occurs.
- Players do not see GM-only queues, hidden hazards, debug reports, or internal scoring.

## Reference rule

When future Travel v2 implementation details conflict with this document, treat this document as the alpha gameplay goal unless the goal is intentionally amended in a later docs PR.
