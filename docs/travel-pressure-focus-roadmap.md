# Arcflight Travel Pressure / Focus Roadmap

This document captures the locked design direction for the next Travel Event Runner gameplay pass.

## Core Design

Travel events use three event-scale pressure tracks:

- **Strain** — ship, hull, Arkengine, hard movement, and system stress.
- **Lifeveil** — air, wards, occult contamination, void exposure, and soul-pressure.
- **Morale** — crew discipline, fear, trust, fatigue, and command stability.

Each pressure track runs from `0` to `5`.

| Value | State | Meaning |
| ---: | --- | --- |
| 0 | Stable | No pressure. |
| 1 | Warning | Narrative warning only. |
| 2 | Pressured | Noticeable pressure; still manageable. |
| 3 | Stressed | Mechanical penalties or danger begin. |
| 4 | Severe | Systems, crew, or wards are disrupted. |
| 5 | Crisis | Draw Fallout and attach a lasting ship condition. |

Pressure normally resets to `0` when a travel event ends. If any track reaches `5`, draw from that track's Fallout deck. The drawn Fallout card remains attached to the ship until resolved.

When a pressure reaches `5`:

1. Draw one Fallout card from the matching pressure deck.
2. Attach the card to the ship.
3. Apply immediate crisis text.
4. Reduce that pressure to `3` so the event can continue without instantly repeating the same crisis.

If a pressure would increase above `5`, it remains at `5` and triggers another crisis/Fallout resolution instead.

## Round Flow

Each travel round should progress through these segments:

1. **Round Reveal** — show vignette, active stations, current pressure, primary/secondary pressure, Focus, exhausted actions, and round target.
2. **Table Strategy** — players discuss whether to push progress, stabilize, save Focus, or risk Overpower.
3. **Station Commitment** — each active station chooses an Event Approach or Stabilize.
4. **Station Rolls** — event approaches generate progress; stabilize rolls generate pending pressure reduction.
5. **Reaction Window** — once-per-event reaction actions may respond to failures or revealed consequences.
6. **Round Outcome Tally** — calculate round result from progress.
7. **Pressure Application** — whole-round outcome applies primary/secondary pressure.
8. **Stabilize Resolution** — successful Stabilize actions reduce pressure.
9. **End-of-Round Focus Window** — end-round signature actions and flexible pressure decisions happen.
10. **Crisis Check** — after reductions, check tracks at `5` and draw Fallout.
11. **Round Transition** — narrate changes and preview the next round.

## Round Outcome Pressure

Pressure is mostly added by whole-round outcomes, not by every failed station roll.

Each round defines:

```js
primaryPressure: "strain",
secondaryPressure: "morale",
progressTarget: 3
```

Default pressure application:

| Round Result | Pressure Result |
| --- | --- |
| Strong Success | Reduce one pressure by `1` or grant a small boon. |
| Success | No pressure added. |
| Mixed | `+1` primary pressure. |
| Failure | `+1` primary and `+1` secondary pressure. |
| Disaster | `+2` primary and `+1` secondary, plus a complication. |

Suggested progress scoring:

| Station Result | Progress |
| --- | ---: |
| Critical Success | +2 |
| Success | +1 |
| Failure | +0 |
| Critical Failure | -1 |
| Skipped | +0 |

## Stabilize Actions

Every active station should always have a Stabilize option.

Choosing Stabilize means the station does **not** contribute normal progress to the round. Instead, that station tries to reduce pressure.

Default Stabilize result:

| Result | Effect |
| --- | --- |
| Critical Success | Reduce chosen pressure by `2`. |
| Success | Reduce chosen pressure by `1`. |
| Failure | No reduction. |
| Critical Failure | No reduction and add `1` pressure. |

Default station pressure specialties:

- Captain reduces Morale.
- Navigator reduces Strain.
- Engineer reduces Strain.
- Veilwarden reduces Lifeveil.
- Watchmaster reduces Morale or reveals/prevents a threat complication.

Events may override or add special Stabilize options.

## Station Focus

Each active station starts with `1` Focus per travel event.

Ship upgrades, rooms, Arkengine mods, crew, or rare features may increase station Focus capacity:

- Base: `1`
- Normal upgraded max: `2`
- Exceptional/late-game max: `3`

Rules:

- Focus is event-long and does not refresh each round.
- Each station has three signature actions.
- Each action costs `1` Focus unless otherwise stated.
- Each action can only be used once per event.
- A station can spend Focus only once per round.
- Upgrades increase how many different actions can be used across the event, not how many can be stacked in one round.

Each station should have:

- One Reaction action.
- Two End-of-Round actions.

## Travel Five Signature Action Drafts

### Captain

**Reaction — Call for Everything**
After any active station fails, spend `1` Captain Focus. That station rerolls. If the reroll fails, add `1` Morale pressure.

**End of Round — Command the Momentum**
Choose one active station for the next round. That station rolls `2d20` and keeps the better result on its next station roll.

**End of Round — Hold the Line**
After pressure is revealed, reduce one pressure gain or consequence by `1`.

### Navigator

**Reaction — Hard Correction**
After the Navigator fails, spend `1` Navigator Focus. Reroll. If the reroll fails, add `1` Strain, but reveal the most threatened station next round.

**End of Round — Read Ahead**
Reveal one next-round pressure threat, hidden danger, or most threatened station.

**End of Round — Find the Safer Line**
Reduce one next-round station DC or pressure risk.

### Engineer

**Reaction — Blow the Safety Valves**
After the Engineer fails, spend `1` Engineer Focus. Improve the result by one degree, then add `1` Strain.

**End of Round — Brace the Drive**
Reduce Strain by `1` or prevent one Strain gain.

**End of Round — Route Emergency Power**
Grant one next-round station a strong setup boon.

### Veilwarden

**Reaction — Seal the Breach**
When Lifeveil loss or an occult consequence is revealed, spend `1` Veilwarden Focus. Reduce it by `1`. If the round still fails, add `1` Lifeveil pressure.

**End of Round — Thicken the Lifeveil**
Reduce Lifeveil by `1` or protect against the next Lifeveil gain.

**End of Round — Name the Intrusion**
Reveal, suppress, or delay one occult/void complication.

### Watchmaster

**Reaction — Shout the Warning**
After a threat, ambush, hidden hazard, or false signal causes a station failure, spend `1` Watchmaster Focus. That station rerolls. If the reroll fails, add `1` Morale pressure, but reveal one hidden danger.

**End of Round — Call the Threat**
Reveal one hidden danger, false signal, or next-round threatened station.

**End of Round — Set the Watch**
Grant protection against the next Threat, ambush, or Morale pressure gain.

## Fallout Decks

Create three Fallout decks:

- Strain Fallout Deck
- Lifeveil Fallout Deck
- Morale Fallout Deck

Fallout cards attach to the ship as lasting conditions until repaired, cleansed, treated, paid off, or otherwise resolved.

### Strain Fallout Examples

- **Arkengine Rebuild Required** — the ship cannot begin a new voyage until repaired; requires about five days in port, expensive parts, proper facilities, and Engineering/Crafting work.
- **Warped Helm Assembly** — Navigator checks suffer until repaired.
- **Cracked Levstone Bracing** — ship cannot use Hard Burn or related Overpower movement options until repaired.
- **Buckled Frame Rib** — reduce maximum Hull Integrity or apply a lasting hull condition until drydock repair.

### Lifeveil Fallout Examples

- **Lifeveil Contamination** — Lifeveil starts at `1` during the next travel event until cleansed.
- **Breath-Sick Crew** — one crew station begins the next event impaired or unavailable until treated.
- **Churn Echo Imprint** — GM may add one hidden Churn complication to the next event.
- **Veilglass Fracture** — Veilwarden checks suffer until repaired.

### Morale Fallout Examples

- **Crew Confidence Broken** — Morale starts at `1` during the next travel event until repaired through shore leave, bonus pay, or command resolution.
- **Mutiny Spark** — GM adds a crew conflict complication to the next Shipboard/Social event.
- **Watch Rotation Collapse** — Watchmaster checks suffer until the crew rests.
- **Fear of the Void** — first failed Threat or Occult station roll next event adds `1` Morale pressure.

## Pressure Decision Panel

Do not implement anonymous voting as the first version.

First version:

- Show current Strain / Lifeveil / Morale.
- Show any available flexible pressure reduction.
- Let the table discuss.
- GM or station owner applies the final choice.

Later version:

- Add public player recommendation buttons.
- GM still applies the final result.

## Implementation Order

1. Pressure tracks and helpers.
2. Round outcome pressure rules.
3. Round segment state.
4. Stabilize actions.
5. Station Focus.
6. Travel Five signature actions.
7. Fallout decks.
8. Pressure decision panel.
9. Runner/UI integration.
10. Smoke tests.
11. Content GPT update.
12. Foundation content pack.
