# Travel v2

This is the canonical Travel v2 reference. It describes the current intended design, alpha target, table loop, and safety boundaries. Detailed historical phase plans may remain in other docs, but they do not override this file.

## Purpose

Travel v2 is Arcflight's GM-directed travel procedure for running dangerous voidfaring events at the table. It is not an autopilot simulator. It should help the GM frame events, collect station actions, preview consequences, apply pressure through explicit review, handle hazards, finalize rounds, complete events, and prepare follow-ups.

## Current alpha target

Travel v2 alpha is complete when the GM can run two playable travel events from setup through final application without silent mutation, player-facing leaks, or design drift.

The alpha target is not to finish every Travel v2 idea. The alpha target is to prove the playable table loop.

Alpha requires:

- two outlined and implemented playable events
- at least three rounds per event
- all five core Travel stations active for every playable event
- player-facing event stakes at setup
- sharper round-specific stakes as the event progresses
- hidden result math rather than a visible success/failure track
- one official between-round vignette assembled from actual results
- mechanical callouts directly below vignette prose
- explicit GM review and explicit GM application for persistent ship changes
- no automatic actor, item, effect, journal, chat, socket, or world mutation from rolls, hazards, outcomes, or event completion
- no player-facing leaks of GM-only state

## Alpha event pair

Travel v2 alpha should prove two different event profiles.

### Event 1 — The Lantern in the Static

Primary purpose: occult void pressure and mystery.

This event should test:

- Lifeveil, Morale, and Strain pressure
- hidden hazard tells
- command echoes
- dynamic vignettes
- Momentum reveal
- Focus backlash
- risk bid consequences
- Inter-Station Help
- final choice: rescue, cut free, or abandon
- consequence queue
- explicit GM apply

### Event 2 — Shattered Chain Drift

Working title. Primary purpose: physical voidfaring crisis.

This event should test:

- Hull, Strain, Supplies, and Cargo pressure
- broken chain-field or wreckage-drift navigation
- visible environmental hazards
- salvage opportunities
- route clue rewards
- risk bids causing direct ship complications
- repair or recovery choices
- ship scar candidates
- explicit GM apply

## Core lifecycle

1. GM prepares or selects a Travel v2 event.
2. GM starts a runner session.
3. Players see the broad event stakes, threatened resources, event length, known dangers, and available stations.
4. Players choose station order before Round 1 begins.
5. GM may drag, reorder, lock, or unlock station order for table management.
6. GM opens Round 1.
7. Players openly discuss station actions.
8. Players lock actions before station-by-station resolution.
9. Players choose any allowed risk bid before consequences are known.
10. Stations resolve in locked order.
11. Earlier stations may create help for later stations in the same round.
12. Later stations may consume available help.
13. Hazards, pressure, backlash, benefits, and consequence candidates are staged.
14. GM opens Round Resolution.
15. System previews the official transition vignette and mechanical changes.
16. GM confirms Round Resolution.
17. Official between-round vignette is shown with mechanical callouts immediately below it.
18. Repeat for at least three rounds.
19. GM opens End-of-Event Resolution.
20. GM reviews final outcome, rewards, consequences, scars, pressure, follow-ups, and ship changes.
21. GM explicitly applies approved persistent changes to the ship.
22. The event writes audit/history records for later Voyage Log use.
23. Shared Momentum resets at the end of the event.

## Session-local first

Travel v2 should prefer session-local state until the GM explicitly confirms a real application. Session-local helpers may update cloned runner session data and write audit/application records. They should not silently mutate Foundry actor/item/world data.

## Player-safe boundary

Player-facing state must be sanitized. It should not leak GM-only fields, secret hazard data, internal mutation payloads, target actor UUIDs, user IDs, audit details, unrevealed backlash, future triggers, hidden consequence trees, or unrevealed hazard internals.

Players may see:

- their station
- their current action choices
- short action-specific vignette text
- risk bid options if available
- help options if available
- Focus availability if the action supports it
- roll/action controls
- Momentum options if allowed
- current shared Momentum
- immediate round context
- revealed hazards and known stakes

Players must not see:

- GM consequence queue
- hidden hazards unless revealed
- unrevealed backlash
- full event math
- internal scoring
- GM-only debug reports
- future triggers or hidden consequence trees
- GM-only application payloads

## GM-only review boundary

GM-facing controls may expose richer context, but actual application still requires explicit GM intent. Review-only state should stay review-only until an apply helper is invoked.

Persistent ship changes require explicit GM application:

- GM gets a final confirmation summary before applying changes.
- Apply-to-ship is explicit.
- No roll, hazard, event completion, or outcome package mutates a ship automatically.
- Applied results create audit/history records.
- Audit data should support a future ship-sheet Voyage Log tab.
- Ship scars can be removed later through repair events, downtime, port services, or future repair systems.
- Rewards should be preserved both in completed event records and attached to the ship where useful.

## Stations

The five core Travel stations for alpha are:

- Captain
- Navigator
- Engineer or Arkengineer
- Veilwarden
- Watchmaster

Future ship upgrades, rooms, crew, hull features, or special systems may add situational extra stations, but the five base stations remain the Travel v2 alpha loop.

Station order is chosen once before the opening round and normally remains fixed for the full event. The Captain station has final say if the table cannot agree; this is guidance text, not a hard permission lock.

## Station actions and action lock-in

Players may discuss station choices before locking. Once a station action is locked, it should not be changed because another station rolled well or badly.

Station cards should show the player's own station actions and a short action-specific vignette explaining how the action ties into the event. Players may see other locked station actions when appropriate, but not GM-only state.

## Risk bids

Risk bids are mandatory for Travel v2 alpha.

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

## Focus

Focus is part of Travel v2 alpha and should not become a free rescue button.

Core Focus rules:

- Focus is tied to the assigned station/player, not the shared ship Momentum pool.
- Each station/player gets one Focus use per event unless a future feature changes that.
- Focus resets at the end of the event.
- Focus is declared before rolling.
- Focus rolls `2d20` and keeps the better result.
- Focus may improve success.
- Focus failure causes backlash.
- Focus critical failure causes severe backlash.
- Focus is not a reroll after failure.
- Focus should only be available on actions that allow Focus.
- Focus should interact with risk bids, but it must not make risk bids safe.

Focus backlash can include:

- extra pressure
- hazard escalation
- a station complication
- corrupted or unstable help
- Momentum loss
- a GM-reviewed consequence candidate
- a ship scar candidate on severe failure, high-risk bid, or final-round crisis

## Momentum

Momentum is the shared crew resource.

Rules:

- Momentum is shared by the crew.
- Momentum should be tied to the ship actor or active Travel v2 session state.
- Momentum is visible to players.
- Momentum resets at the end of each event.
- GM may award Momentum for excellent roleplay, clever planning, or strong table decisions.
- Momentum can be spent on approved actions such as improving a result, suppressing a hazard effect, improving a benefit, or revealing a clearer hidden hazard tell.

Momentum differs from Focus:

- Momentum is shared and represents crew-wide advantage.
- Focus is personal or station-specific overcommitment before a roll.

## Inter-Station Help

Inter-Station Help should be a visible gameplay system, not just a hidden modifier.

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

Under the hood, implementation may reuse existing pending station benefit queues, but the player-facing system should read as Inter-Station Help.

## Pressure

Pressure represents escalating travel danger and consequence load. The pressure loop supports preview, application, correction, duplicate protection, and recordkeeping.

Pressure can be driven by:

- failed or critically failed station actions
- risk bid failures
- Focus backlash
- hazard escalation
- event-specific rules
- final-round stakes

## Hazards

Hazards may be drawn, held, revealed, activated, dismissed, progressed, or cleared through explicit GM-facing flows. Unrevealed hazard data must remain private.

Alpha hazards should have real mechanical teeth. Each alpha event should have:

- one authored main evolving hazard that defines the crisis
- optional secondary hazards selected from event-tagged hazard options
- GM override for any random secondary hazard choice

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

- Vignettes should be dynamically assembled from actual results.
- There should be one official vignette, not multiple competing variants.
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

## Consequences, rewards, scars, and follow-ups

Failed station actions should not always create consequence candidates.

Consequence candidates should usually appear when tied to:

- a risk bid
- hazard pressure
- help backlash
- Focus backlash
- a special event rule
- a critical failure
- final-round stakes

The consequence queue is GM-only until the GM chooses what to reveal, apply, ignore, or save for later.

Future Voyage Log data should eventually show:

- completed events
- final outcome
- rewards gained
- scars taken
- scars repaired
- route clues discovered
- contacts made
- unresolved follow-ups
- GM-applied changes
- audit trail of what was applied

## Event approach tally

Event approach tally records how the party's chosen approach contributes toward the travel event outcome. Canonical helpers and session containers should be kept stable and documented in code-facing notes as needed.

## Round finalization

A round should only finalize when required inputs are complete and blocking state is resolved. Finalization should append clear records and avoid mutating unrelated session data.

## Event completion

Event completion summarizes the completed session and prepares the GM for follow-up/outcome review. It should not jump directly into uncontrolled actor or item mutation.

## Builder/importer relationship

The Travel Event Builder and importer/exporter paths must remain compatible with current runner expectations. Builder/importer schema gaps should be tracked in `docs/TODO.md` until they become a focused roadmap slice.

## Alpha acceptance checklist

A GM-only table test is acceptable before multiplayer polish.

Alpha acceptance should prove:

- two events exist and can be run start to finish
- event setup works
- broad stakes display before Round 1
- station order can be chosen before Round 1
- station order can be dragged, locked, and unlocked by the GM
- all five Travel stations participate
- players or GM can lock actions before resolution
- risk bids `+2`, `+5`, and `+8` work where allowed
- station-specific risk bid flavor appears
- Focus is declared before rolling and uses `2d20 keep highest`
- Focus failure creates backlash
- Inter-Station Help can be created and consumed by later stations
- Critical Help can create stronger or automatic benefit
- Critical Help failure can create backlash
- Momentum is visible, shared, and resets after the event
- hazards use multiple forms and can affect play
- hidden hazards can influence vignettes without leaking internals
- GM can edit the official transition vignette
- mechanical callouts display immediately below vignette prose
- Round Resolution requires GM confirmation
- End-of-Event Resolution shows final outcome, rewards, consequences, scars, pressure, follow-ups, and ship changes
- Apply-to-ship requires explicit GM confirmation
- audit/history records are written
- no silent actor, item, effect, journal, chat, socket, or world mutation occurs
- players do not see GM-only queues, hidden hazards, debug reports, or internal scoring

## Testing

Travel v2 smoke tests protect pressure, hazards, round finalization, event completion, player-safe state, and application-review boundaries. Official testing commands belong in `docs/TESTING.md`.

## Related docs

- `docs/ARCFLIGHT-BIBLE.md`
- `docs/ROADMAP.md`
- `docs/TODO.md`
- `docs/DATA-MODEL.md`
- `docs/TESTING.md`
- `docs/LEGACY-DOCS.md`
