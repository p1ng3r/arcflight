# Arcflight Voyage Event V3 — Accepted Alpha Decisions

**Status:** Canonical implementation summary  
**Implementation branch:** `rebuild/arcflight-voyage-events-alpha`  
**Target:** Foundry VTT v14 with PF2e

The full long-form design archive remains at `docs/voyage-event-alpha-scope.md` on branch `rebuild/arcflight-gameplay-v3`. This document is the concise implementation reference for Codex tasks on the current branch.

## 1. Alpha Definition

Voyage Event alpha is a complete table-playable system, not a partial prototype.

Alpha is demonstrated by two bundled events:

1. A three-round introductory event.
2. A five-round advanced event.

The engine must support authored events from 3 through 11 rounds, but events longer than five rounds are not required for alpha acceptance.

Live AI is not required. Alpha imports pre-authored branching narrative packages and deterministically composes cinematic round vignettes.

## 2. Active Stations

Voyage Events use this five-station active subset:

- Captain
- Engineer
- Navigator
- Watchmaster
- Veilwarden

The shared registry also contains Pilot, Gunnery, and Quartermaster. Those definitions remain intact and are not renamed, deleted, or repurposed.

Each station action presents exactly three authored PF2e skill choices.

## 3. Event State Machine

The authoritative phase sequence is:

1. Event Setup
2. Event Opening
3. Round Opening
4. Crew Planning
5. Order Lock
6. Station Activation and Resolution
7. Round Resolution
8. End-of-Round Vignette
9. Next-Round Preparation
10. Event Resolution
11. Aftermath Review
12. Event Archive

The GM client owns authoritative event state. Player clients submit validated requests against the current phase and revision.

## 4. Crew Planning and Station Order

Every round begins with synchronized Crew Planning.

All players see:

- all five active stations;
- player-safe station actions;
- three skills per action;
- No Bid, `+2`, `+5`, and `+8` choices;
- exact visible reward and danger for every bid;
- valid downstream targets;
- tentative station choices;
- proposed station order.

Players drag stations into a new order every round.

The Captain confirms the order. The GM may override or unlock it.

Order locks at the end of Crew Planning. An unresolved station may revise its tentative action, skill, bid, Focus use, and target when its activation begins. Choices lock when the roll begins.

## 5. Difficulty Bids

### No Bid

Uses the base action DC and grants no additional mechanical reward. The station result contributes only to the ship-level round result.

### `+2`

A modest risk for a narrow tactical opportunity.

### `+5`

A serious risk for a strong tactical opportunity.

### `+8`

An extreme risk for a rare or event-shaping opportunity.

Rewards are not universal. They come from centralized validated reward catalogs and are selected to fit station, action, event, timing, and target tags.

A reward may:

- lower a later station's DC;
- grant a later check bonus;
- allow rolling twice and keeping the better result;
- reduce or prevent Pressure;
- reveal danger or future information;
- alter unresolved order;
- suppress or downgrade a Hazard;
- create a held effect or card;
- restore Focus when narratively appropriate;
- improve salvage or another event reward;
- unlock an unusual action or opportunity.

A `+8` reward does not always restore Focus. Focus restoration is one possible rare reward.

Every visible bid also shows its exact failure danger before selection.

## 6. Reward, Danger, and Hazard Catalogs

The initial target is approximately:

- 20 rewards for `+2`;
- 20 rewards for `+5`;
- 20 rewards for `+8`.

Catalog entries use stable IDs and plain serializable data.

A reward definition includes:

- stable ID;
- bid band;
- name and player-facing text;
- effect family;
- valid source and target stations;
- event and action affinities;
- activation timing;
- duration and expiration;
- stacking group and rule;
- targeting rules;
- parameters;
- narrative tags;
- invalid conditions;
- optional Critical Success enhancement.

Danger and Hazard definitions follow the same registry-driven approach.

Bundled alpha events freeze selected reward and danger IDs before final narrative authoring so prose matches the actual mechanics.

Imported packages contain no executable JavaScript, macros, HTML event handlers, arbitrary Foundry operations, or filesystem instructions.

## 7. Cascading Downstream Benefits

Station order is a central tactical system.

A successful bid may create a benefit for a station later in the committed order.

Example:

1. Engineer overpowers the Arkengine.
2. Engineer succeeds and lowers Navigator's effective DC.
3. Navigator sees the updated DC and selects a harder bid.
4. Navigator succeeds and creates an advantage for Captain.
5. Captain uses that advantage later in the round.

Incoming benefits appear on the target station card and effective DCs update immediately.

A downstream benefit normally targets only:

- a later unresolved station;
- a station allowed by the reward definition.

Initial stacking limits:

- maximum total DC reduction: 3;
- one roll-twice effect per check;
- one degree improvement per result;
- identical stacking groups do not stack;
- Focus may combine with one valid external roll modifier;
- stacked effects cannot turn Critical Failure directly into Success;
- no automatic or infinite reward loops.

Effective DC is:

`base action DC + selected bid + active penalties - valid DC reductions`

Check bonuses remain separate from DC reductions.

## 8. Station and Ship Results

PF2e station degrees contribute:

| Station result | Value |
|---|---:|
| Critical Failure | -2 |
| Failure | -1 |
| Success | +1 |
| Critical Success | +2 |

Ship-level round result:

| Round score | Result |
|---:|---|
| -3 or lower | Critical Failure |
| -2 to -1 | Failure |
| 0 | Success at a Cost |
| +1 to +2 | Success |
| +3 or higher | Critical Success |

A normal ship-level Success completes the round goal and grants no automatic bonus.

A ship-level Critical Success applies the round's prepared additional advantage.

Failure and Critical Failure apply targeted authored complications rather than universally increasing every station DC.

Round results contribute to final event score:

| Round result | Event value |
|---|---:|
| Critical Failure | -2 |
| Failure | -1 |
| Success at a Cost | 0 |
| Success | +1 |
| Critical Success | +2 |

The final event uses the same five-result score bands.

## 9. Focus

Each active station begins an event with 1 Focus.

Spend Focus before rolling to gain `+2` to that station's check.

Focus belongs to the station, not the operator. A replacement operator inherits remaining Focus.

Focus resets at event end. Only explicit rewards, upgrades, or event effects restore it.

Momentum is excluded from alpha.

## 10. Pressure and Hazards

Voyage Event Pressure is event-local and must not overwrite ship refit-pressure data.

Five lanes:

- Structure
- Engine
- Veil
- Crew
- Stores

| Pressure | State |
|---:|---|
| 0–1 | Stable |
| 2 | Warning |
| 3 | Crisis |
| 4 | Disaster |
| 5+ | Overflow or Scar threat |

Pressure cannot fall below zero.

Alpha supports minor and serious Hazards.

Initial limit:

- maximum one active minor Hazard;
- maximum one active serious Hazard;
- escalation replaces or upgrades existing Hazards rather than creating unlimited entries.

Persistent ship damage, lost resources, and Ship Scars are staged during aftermath and require explicit GM application.

## 11. Narrative Package and Composer

Alpha imports prepared narrative components.

An event package contains:

- event opening and final outcome vignettes;
- round-opening branches;
- round goals and dangers;
- four degree-specific beats for station actions;
- bid-success and bid-failure beats;
- cascade bridge text for downstream effects;
- five ship-level round conclusions;
- transitions to later rounds;
- event-local narrative flags;
- aftermath narration.

The composer prioritizes:

1. round scene setting;
2. important early station action;
3. up to two cascade bridges;
4. most severe negative outcome;
5. strongest positive outcome not already represented;
6. ship-level conclusion;
7. next-round transition.

Target output is approximately 150–300 words in 2–4 paragraphs.

Cascade bridges should replace repetitive isolated beats when they describe the same actions.

The GM may preview and edit the assembled vignette before posting. The exact posted text and component IDs are saved in event history.

## 12. PF2e Integration

Use native PF2e behavior wherever possible.

The Event Manager must:

- resolve the assigned operator Actor;
- locate the selected standard skill or Lore statistic;
- apply Arcflight modifiers through valid PF2e mechanisms;
- preserve natural 20 and natural 1 degree adjustments;
- respect fortune and misfortune behavior;
- post the roll to chat;
- record the final degree;
- prevent duplicate resolution.

Do not reimplement PF2e degree-of-success rules.

## 13. Persistence and Authority

Arcflight persists after each meaningful transition:

- active event;
- phase and revision;
- current round;
- station order;
- tentative and locked selections;
- completed rolls;
- Focus;
- incoming effects;
- Pressure and Hazards;
- narrative flags;
- exact posted vignettes;
- round and event history;
- staged aftermath.

Events recover after refresh, reconnect, Foundry restart, and session interruption.

Every GM override is logged with user and timestamp.

## 14. UI and Artwork Readiness

Voyage Events use a separate Foundry v14-compatible application. They do not replace PF2e sheets.

Every major UI region requires:

- stable component name;
- stable ID;
- stable CSS class;
- localization key;
- data path;
- optional labeled artwork role;
- editable helper text;
- visible empty state.

The UI remains fully usable without art.

Required screens include:

- Event Library
- Event Setup
- Vignette Panel
- Crew Planning Board
- Station Cards
- Station Action Panel
- Active Station Resolution
- Ship Status
- Round Resolution
- Aftermath and History

Do not identify important UI regions only by visual position.

## 15. Two Bundled Events

### Event One

Three-round introductory event. Recommended concept: **The Glassback at Cinderwake Wreck**.

It proves:

- normal station loop;
- order selection;
- three skills;
- all bid bands;
- downstream cascades;
- limited Pressure and Hazards;
- branching openings;
- composed vignettes;
- benefit or Scar aftermath.

### Event Two

Five-round advanced event.

It proves:

- multiple stages;
- recovery after failed rounds;
- optional objective;
- serious Hazard;
- several narrative flags;
- meaningful branching;
- possible early completion or withdrawal;
- event transformation or Combat handoff;
- multiple aftermath packages.

Both events must use the same generic engine without event-specific executable code.

## 16. Alpha Definition of Done

Alpha is complete when both events can be run from setup through aftermath and demonstrate:

- synchronized five-station planning;
- different order each round;
- exact visible rewards and dangers;
- three skill choices per action;
- native PF2e checks;
- downstream benefits;
- correct scoring;
- Focus, Pressure, and Hazards;
- deterministic branching vignettes;
- exact narrative preservation;
- staged benefit or Scar;
- import and export;
- reload recovery;
- multiplayer authority;
- GM overrides and audit history;
- labeled, localized, art-ready UI regions.

Alpha is not complete merely because calculations work. It is complete when both events feel like a cohesive Arcflight table experience.
