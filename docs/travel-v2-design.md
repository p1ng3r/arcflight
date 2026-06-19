# Arcflight Travel v2 Design

Status: Phase 0 draft
Branch: `travel-v2-phase-0-design-audit`

## Purpose

Travel v2 turns Arcflight hex travel into a playable cinematic encounter loop. Void Events are not preplanned voyage chains. They are daily random-encounter style crises that may occur during hex travel, run for a limited number of rounds, resolve, and then return the ship to travel.

## Hard Technical Rules

- Do not introduce custom Actor or Item types unless explicitly approved.
- PF2E vehicle actors are Arcflight ships.
- PF2E equipment/items are Arcflight components.
- Arcflight data lives under `flags.arcflight`.
- Preserve PF2E statistic/skill/lore resolution.
- Preserve station assignment.
- Preserve player station roll request flow.
- Preserve station result persistence.
- Preserve structured station approaches.
- Preserve Station Focus state.
- Preserve the Navigator Hard Correction player-side prompt flow.

## Existing Travel v1 Behavior to Protect

The known-good reaction loop is:

1. Navigator fails.
2. Player receives Hard Correction prompt.
3. Player accepts.
4. Focus is spent.
5. Reroll is requested.
6. GM records reroll result.

Any Travel v2 refactor must prove this still works before moving to the next phase.

## Daily Travel Loop

1. Morning begins during hex travel.
2. GM rolls for a Void Event.
3. If no event occurs, travel continues.
4. If an event occurs, GM selects or rolls a matching Void Event.
5. Void Event runs for 3-9 rounds.
6. Normal event pressure resets at event end.
7. Ship Scars persist if pressure crossed the breaking point.
8. If final event score is positive, draw from the Void Fortune Deck.
9. If the event contains a Void Thread, players may investigate, ignore, or mark it for later.
10. Travel continues.

## Void Event Round Loop

1. Round begins.
2. Hidden Risk is set for the round.
3. GM reads the cinematic vignette.
4. Players may reveal Hidden Risk with an ability such as Read the Route.
5. Players choose station orders.
6. Station orders may support, protect, push, scout, or stabilize.
7. Stations roll.
8. Focus may be spent.
9. Momentum may be spent.
10. Round result is calculated.
11. If the round fails, Hidden Risk increases the threatened pressure.
12. If pressure crosses 2, 3, or 4, draw Hazards.
13. If pressure would exceed 4, draw a Ship Scar.
14. If the round succeeds, the crew may gain Momentum.
15. Continue to the next round.

## Canonical Travel Stations

Travel v2 uses the Travel Five:

- Navigator
- Engineer
- Veilwarden
- Watchmaster
- Captain

## Canonical Event Pressure Tracks

Travel v2 pressure is event-scoped. These are the first-class pressure tracks:

- Hull
- Strain
- Lifeveil
- Morale
- Supplies

Pressure values:

| Value | Meaning |
| --- | --- |
| 0 | Stable |
| 1 | Warning |
| 2 | Hazard threshold |
| 3 | Crisis threshold |
| 4 | Disaster threshold |
| 5+ | Ship Scar instead of further normal pressure |

Normal pressure resets at event end. Ship Scars persist.

## Hidden Risk

Every round has exactly one hidden pressure risk unless a specific event says otherwise.

Example:

```js
{
  pressureType: "strain",
  failureIncrease: 1,
  criticalFailureIncrease: 2,
  pressureStation: "engineer",
  playerRevealed: false
}
```

The GM can see Hidden Risk. Players only see it after reveal effects such as Read the Route.

## Hazard Deck v1

Hazards are internal Arcflight data first. Do not start by wiring native Foundry Cards.

Threshold rules:

- Reaches 2: draw 1 matching Hazard.
- Reaches 3: draw 2 matching Hazards.
- Reaches 4: draw 3 matching Hazards.
- Draw only on threshold crossing, not every round while already at the threshold.

Hazard shape:

```js
{
  key: "strain-arcane-backwash",
  name: "Arcane Backwash",
  pressureType: "strain",
  severity: "moderate",
  flavorText: "The arkengine coughs starfire through the deck seams.",
  mechanicalText: "Until cleared, Engineer station checks take -1.",
  visibility: "public",
  clearCondition: "Engineer succeeds at a stabilize order.",
  effectMode: "manual",
  structuredEffects: []
}
```

Manual apply/clear is acceptable for v1.

## Ship Scars

Ship Scars are lasting damage/story hooks. If pressure would exceed 4, do not raise normal event pressure further; draw one matching Ship Scar instead.

Ship Scar shape:

```js
{
  key: "strain-cracked-arkengine-manifold",
  name: "Cracked Arkengine Manifold",
  pressureType: "strain",
  flavorText: "A thin blue-white crack sings through the manifold housing.",
  mechanicalEffect: "Hard Burn costs +1 Strain until repaired.",
  repairRequirement: "Engineering repair during port downtime.",
  downtimeRequirement: "1 downtime day",
  costRequirement: "GM-set material cost",
  roleplayHook: "The crack repeats voices heard during the event."
}
```

Ship Scars persist on the ship actor until repaired.

## Focus

Focus belongs to a station assignment, not to the ship as a shared pool.

Default rule:

- Each station has 1 Focus per travel event.
- Upgrades may eventually raise station Focus caps, probably up to 3 or 4.

Focus categories:

- reaction after failed roll
- hidden risk reveal
- reduce consequence
- reroll
- stabilize pressure
- prevent hazard
- protect against Ship Scar

Hardcoded Focus definitions should move out of the runner helper into data.

## Momentum

Momentum is the short-term event rhythm resource.

Default rule:

- Momentum max: 3.

Suggested gain:

- Critical round success: +2 Momentum.
- Round success: +1 Momentum.
- Narrow success: +0 Momentum.
- Round failure: +0 Momentum.
- Critical round failure: lose 1 Momentum if any.

Default spends:

- Spend 1: +1 to one station roll before rolling.
- Spend 2: reduce one pressure increase by 1.
- Spend 3: cancel one Hazard draw.

Momentum should not replace Void Fortune. Momentum is short-term; Void Fortune is long-term reward.

## Station Orders

Every station order should express a tactical role:

- protect
- push
- support
- scout
- stabilize

Station orders should create table talk. A player should not merely choose a skill.

Example order shape:

```js
{
  key: "navigator-read-the-route",
  stationKey: "navigator",
  role: "scout",
  label: "Read the Route",
  playerText: "Study the shifting route and look for the real danger.",
  revealedRiskEffect: "reveal-current-hidden-risk",
  suggestedSkills: ["navigation-lore", "survival", "arcana"]
}
```

## Void Fortune

Void Fortune triggers at event end if final event score is positive.

Rules:

- Ship can hold 3 Void Fortune burn cards by default.
- Only 1 Void Fortune burn card may be used per travel round by default.
- Ship upgrades may increase hand limit or unlock new burns.
- Discoveries attach to the route/hex/map and do not count against hand limit.

## Void Threads

Most events do not include a Void Thread. About 20% may include one.

A Void Thread is a lingering mystery, signal, trace, or consequence left behind by a Void Event.

Choices:

- continue travel
- investigate now
- mark for later
- ignore

Void Thread shape:

```js
{
  hasVoidThread: true,
  trigger: "event-end",
  playerFacingText: "A fading distress rhythm repeats from below the route.",
  gmNotes: "The signal belongs to a wrecked survey ark.",
  suggestedFollowUpCategory: "discovery",
  suggestedFollowUpLevel: 5,
  suggestedRisks: ["lifeveil", "morale"],
  suggestedRewards: ["salvage", "route-discovery"],
  urgency: "optional"
}
```

## Shared State Model Direction

Travel v2 should introduce a normalized state helper before UI work.

Proposed file:

```text
scripts/helpers/travel-v2-state.js
```

Primary exported functions:

```js
createTravelV2SessionState(input)
normalizeTravelV2SessionState(input)
createTravelV2PressureState(input)
createTravelV2HiddenRiskState(input)
createTravelV2FocusState(input)
createTravelV2MomentumState(input)
createTravelV2HazardState(input)
createTravelV2ShipScarState(input)
createTravelV2VoidFortuneState(input)
createTravelV2VoidThreadState(input)
```

## Build Order

1. Phase 0: design doc and repo audit.
2. Phase 1: shared Travel v2 state model.
3. Phase 2: travel runner cleanup.
4. Phase 3: GM/player socket cleanup.
5. Phase 4: GM UI shell.
6. Phase 5: player UI shell.
7. Phase 6: Hidden Risk + Read the Route.
8. Phase 7: Pressure tracks 0-4 + reset.
9. Phase 8: Hazard Deck v1.
10. Phase 9: Ship Scars Deck.
11. Phase 10: Momentum.
12. Phase 11: Station Support Orders.
13. Phase 12: Void Fortune Deck.
14. Phase 13: Ship Upgrade Travel Effects.
15. Phase 14: Event Level / Severity / GPT Schema.
16. Phase 15: art-ready UI pass.

## Non-goals for the first playable loop

Do not spend the first pass on:

- native Foundry Cards integration
- fully automated every hazard effect
- complete art pass
- full event builder GPT implementation
- every ship upgrade travel effect

The first goal is a playable loop, not a finished subsystem.
