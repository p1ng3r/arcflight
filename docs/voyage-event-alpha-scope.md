# Arcflight Voyage Event Alpha Scope

**Status:** Accepted alpha scope  
**Branch:** `rebuild/arcflight-gameplay-v3`  
**Target platform:** Foundry VTT v14 with PF2e  
**Primary gameplay pillar:** Voyage Events

## 1. Alpha Goal

The Arcflight alpha will be a complete, table-playable Voyage Event system rather than a partial technical prototype.

The alpha is successful when a GM can:

1. Import or select a Voyage Event.
2. Present its opening cinematic vignette.
3. Run the event through multiple rounds.
4. Let players arrange the five stations in a new order each round.
5. Resolve native PF2e station checks with visible Difficulty Bids.
6. Apply cascading benefits from earlier stations to later stations.
7. Calculate ship-level round results.
8. Display a combined cinematic end-of-round vignette.
9. Branch the next round according to the crew's results and important narrative flags.
10. Calculate the final event outcome.
11. Stage rewards, benefits, consequences, or Ship Scars.
12. Preserve the full event through refresh, reconnect, and Foundry restart.
13. Export the event history and posted narrative.

Live AI integration is not required for alpha. The alpha narrative system uses imported, pre-authored branching narrative components created manually or by a future Arcflight Event Builder GPT.

## 2. Alpha Boundaries

Alpha focuses on the **Voyage Events** pillar.

Arcflight Combat and Vessel Development remain part of the larger architecture, but alpha only requires the connection points needed for:

- combat handoff;
- Voyage Benefits;
- Ship Scars;
- salvage and upgrade resources;
- future ship-upgrade hooks.

Momentum is excluded from alpha unless a later approved decision gives it a unique role that is not already covered by Focus, Difficulty-Bid rewards, cascading effects, Pressure, Hazards, and round results.

## 3. Alpha Event Content

Alpha includes **two complete playable events**. These are full events, not isolated technical demonstrations.

### 3.1 Event One — Three-Round Introductory Event

The first event proves the standard Voyage Event loop.

Recommended event: **The Glassback at Cinderwake Wreck**.

Required coverage:

- 3 rounds;
- 5 stations;
- 1 or 2 actions per station per round;
- 3 skills per action;
- visible No Bid, `+2`, `+5`, and `+8` choices;
- downstream station cascades;
- branching round openings;
- combined end-of-round vignettes;
- limited Pressure and Hazards;
- final Voyage Benefit or Ship Scar.

### 3.2 Event Two — Five-Round Advanced Event

The second event proves that the system supports a more complicated Voyage Event without becoming repetitive.

Required coverage:

- 5 rounds;
- 5 stations;
- multiple event stages;
- 2 actions per station where appropriate;
- 3 skills per action;
- multiple station-order strategies;
- stronger Pressure and Hazard interaction;
- recovery after failed rounds;
- optional objective;
- at least one serious Hazard;
- several important narrative flags;
- meaningful branching;
- possible early completion, withdrawal, or event transformation;
- possible Arcflight Combat handoff;
- more than one possible aftermath package.

The engine must support the future range of 3 to 11 rounds, but an event longer than 5 rounds is not required for alpha acceptance.

## 4. Standard Stations

Alpha uses five standard stations.

### Captain

Core identity:

- leadership;
- command;
- morale;
- diplomacy;
- coordination;
- tactical direction.

### Engineer

Core identity:

- Arkengine operation;
- mechanical control;
- power distribution;
- repairs;
- technical improvisation.

### Navigator

Core identity:

- piloting;
- course selection;
- void currents;
- celestial positioning;
- maneuvering.

### Watchmaster

Core identity:

- observation;
- threat assessment;
- tactical awareness;
- creature behavior;
- debris and environmental detection.

### Veilwarden

Core identity:

- Lifeveil integrity;
- supernatural defense;
- occult sensing;
- atmosphere and magical protection;
- mental and void threats.

Each station action offers exactly three authored PF2e skill choices. Alpha may use the same base DC for all three skills, but each skill must have a distinct fictional approach and may support later tags, upgrades, or narrative flavor.

## 5. Authoritative Event State Machine

### 5.1 Event Setup

The GM:

- selects or imports the event;
- reviews validation results;
- confirms the active ship;
- confirms the five station operators;
- reviews event length and visible stakes;
- begins the event.

### 5.2 Event Opening

Arcflight displays:

- event title;
- event artwork slot;
- opening vignette;
- player-visible objective;
- visible stakes;
- known starting conditions.

The GM may edit the vignette before posting it.

### 5.3 Round Opening

Arcflight selects the correct beginning-of-round vignette using:

- round number;
- previous ship-level round result;
- active narrative flags;
- important Hazards;
- important Pressure conditions.

The vignette introduces the round's immediate goal.

### 5.4 Crew Planning

All connected players see the synchronized station board.

Players may:

- inspect every station action;
- inspect all three skill choices;
- inspect No Bid, `+2`, `+5`, and `+8` choices;
- inspect the exact reward and danger for each bid;
- inspect valid downstream targets;
- drag stations into the desired order;
- mark tentative actions, skills, bids, Focus use, and targets.

### 5.5 Order Lock

The Captain confirms the station order. The GM may override or unlock it.

The order becomes authoritative for the round.

Unresolved stations may still change their tentative action, skill, bid, Focus use, and target when their activation begins. This allows later stations to react to benefits or complications created earlier in the chain.

### 5.6 Station Activation

When a station becomes active, Arcflight:

1. Applies all valid incoming benefits from earlier stations.
2. Displays updated modifiers and effective DCs.
3. Displays valid held effects and remaining Focus.
4. Allows the operator to confirm the action.
5. Allows the operator to select one of three skills.
6. Allows the operator to select No Bid, `+2`, `+5`, or `+8`.
7. Allows the operator to select Focus and eligible effects.
8. Allows the operator to select required downstream targets.
9. Locks the choices when the roll begins.
10. Resolves the native PF2e check.
11. Reads and records the PF2e degree of success.
12. Applies the selected bid's reward or danger.
13. Applies downstream benefits to valid later stations.
14. Advances to the next station.

A resolved station remains locked unless the GM performs a logged override.

### 5.7 Round Resolution

Each contributing station result has a weighted value:

| PF2e degree | Value |
|---|---:|
| Critical Failure | -2 |
| Failure | -1 |
| Success | +1 |
| Critical Success | +2 |

Arcflight adds all five station values.

| Round score | Ship-level round result |
|---:|---|
| -3 or lower | Critical Failure |
| -2 to -1 | Failure |
| 0 | Success at a Cost |
| +1 to +2 | Success |
| +3 or higher | Critical Success |

A ship-level Success completes the immediate round goal and grants no automatic additional reward.

A ship-level Critical Success completes the goal exceptionally and applies the round's prepared Critical Success advantage.

Failure and Critical Failure apply the round's prepared complications. Failure must create a targeted fictional problem rather than universally increasing every station DC.

### 5.8 End-of-Round Vignette

Arcflight assembles a cinematic vignette from imported narrative components.

The vignette should include:

- the most important early station action;
- successful station-to-station cascades;
- the strongest positive result;
- the most serious negative result;
- important Pressure or Hazard changes;
- the ship-level result conclusion;
- the transition into the next round.

The result must read as one scene rather than five disconnected roll summaries.

The GM may:

- preview it;
- edit it;
- omit a beat;
- choose an alternate prepared beat;
- post it to chat.

The exact posted text is preserved in event history.

### 5.9 Next-Round Preparation

Arcflight expires temporary effects according to their definitions and prepares the next round using:

- previous round result;
- Pressure;
- Hazards;
- narrative flags;
- stored event branches;
- unresolved optional objectives.

The crew then begins a fresh station-order phase.

### 5.10 Event Resolution

Each completed round contributes to the final event score:

| Ship-level round result | Event value |
|---|---:|
| Critical Failure | -2 |
| Failure | -1 |
| Success at a Cost | 0 |
| Success | +1 |
| Critical Success | +2 |

| Final score | Event result |
|---:|---|
| -3 or lower | Critical Failure |
| -2 to -1 | Failure |
| 0 | Success at a Cost |
| +1 to +2 | Success |
| +3 or higher | Critical Success |

### 5.11 Aftermath Review

Arcflight stages persistent changes instead of silently committing them during event resolution.

The GM reviews:

- final event result;
- Voyage Benefit;
- Ship Scar;
- salvage;
- cargo;
- rare materials;
- blueprint or upgrade unlock;
- route discovery;
- faction change;
- persistent narrative flags;
- combat handoff;
- follow-up event;
- campaign-log entry.

The GM selects **Apply Aftermath** to commit persistent changes.

### 5.12 Event Archive

Arcflight stores:

- imported event package;
- all round states;
- station orders;
- tentative and locked choices;
- PF2e roll references and results;
- downstream effects;
- Focus;
- Pressure;
- Hazards;
- narrative flags;
- exact posted vignettes;
- final result;
- applied aftermath.

## 6. Difficulty Bids

### 6.1 No Bid

No Bid uses the action's base DC.

It grants no additional mechanical benefit. The station result only contributes to the ship-level round matrix.

### 6.2 `+2` Bid

A modest risk for a narrow tactical opportunity.

Possible reward families include:

- reduce a later station's DC;
- grant a later station a small check bonus;
- prevent one Pressure;
- reveal a current danger;
- reposition one unresolved station;
- create a limited immediate advantage.

### 6.3 `+5` Bid

A serious risk for a strong tactical opportunity.

Possible reward families include:

- roll twice and use the better result;
- reduce multiple Pressure;
- cancel a minor Hazard;
- reveal the next round's danger;
- improve a later station's position;
- create a held tactical effect.

### 6.4 `+8` Bid

An extreme risk for a rare or event-shaping opportunity.

Possible reward families include:

- restore Focus;
- alter the ship-level result;
- cancel a serious Hazard;
- unlock rare salvage;
- suppress a major danger;
- create a powerful held effect;
- produce an extraordinary downstream advantage.

These are examples, not universal assignments. Every selected reward must match the station action's narrative.

A station's ordinary Success does not automatically create a card, Momentum, bonus, or unrelated reward. Successful Difficulty Bids create only the mechanical reward selected for that specific bid.

## 7. Schema-Driven Reward and Danger Catalogs

Arcflight uses centralized catalogs of validated mechanical effects. Event authors primarily write narrative, actions, skills, tags, and story branches rather than custom mechanics or code.

### 7.1 Initial Reward Pool Target

- approximately 20 rewards for the `+2` band;
- approximately 20 rewards for the `+5` band;
- approximately 20 rewards for the `+8` band.

Each reward definition must include:

- stable ID;
- bid band;
- player-facing name and description;
- effect family;
- valid source stations;
- valid target stations;
- event affinities;
- action affinities;
- timing;
- duration;
- expiration;
- stacking group;
- stacking rule;
- target rules;
- mechanical parameters;
- narrative tags;
- invalid conditions;
- optional Critical Success enhancement.

### 7.2 Danger Catalog

Each visible Difficulty Bid also displays an exact failure danger selected from a validated catalog.

The danger catalog must support:

- Pressure increases;
- temporary penalties;
- loss of position;
- blocked station actions;
- minor Hazards;
- serious Hazards;
- event escalation;
- threatened Ship Scars.

The player must see both the possible reward and possible danger before choosing the bid.

### 7.3 Alpha Selection Timing

For the two bundled alpha events, the selected reward and danger IDs are frozen before the final branching narrative package is completed.

This allows the event's prepared prose to describe the exact mechanics and station-to-station cascades that can occur.

The event package references stable catalog IDs and contains no executable event-specific code.

## 8. Cascading Downstream Station Benefits

Station order is a central tactical system.

A successful Difficulty Bid may create a benefit for a station later in the committed order.

Example:

1. Engineer overpowers the Arkengine.
2. Engineer succeeds and reduces the Navigator's DC.
3. Navigator sees the updated DC and chooses a harder bid.
4. Navigator succeeds and creates an advantage for the Captain.
5. Captain uses the advantage later in the same round.

Incoming benefits appear directly on the target station card. Effective DCs update immediately.

A downstream benefit normally may target only:

- a station later in the committed order;
- a station that has not started resolution;
- a station permitted by the reward definition.

A benefit may affect a resolved station only when its definition explicitly permits post-roll or round-resolution timing.

### 8.1 Effective DC

```text
Effective DC = Base action DC + Difficulty Bid + active penalties - valid DC reductions
```

Check bonuses remain separate from DC reductions.

### 8.2 Initial Stacking Limits

- maximum total DC reduction: 3;
- one roll-twice-and-use-the-better effect per check;
- one degree improvement per result;
- identical stacking groups do not stack;
- Focus may combine with one valid external roll modifier;
- a Critical Failure cannot be improved directly to Success through stacked effects;
- a successful reward cannot create an infinite or automatic reward loop.

## 9. Focus

Each active station begins an event with 1 Focus.

Alpha Focus rule:

> Spend Focus before rolling to gain a +2 bonus to that station's check.

Focus belongs to the station, not the individual character. A replacement operator inherits the station's remaining Focus.

Focus resets at event end. Only explicit rewards, upgrades, or event effects may restore it.

## 10. Pressure

Alpha uses five event-local Pressure lanes:

- Structure;
- Engine;
- Veil;
- Crew;
- Stores.

| Pressure | State |
|---:|---|
| 0-1 | Stable |
| 2 | Warning |
| 3 | Crisis |
| 4 | Disaster |
| 5 or more | Overflow or Scar threat |

Pressure is temporary event state. Persistent ship damage, resource loss, and Ship Scars are staged during aftermath.

Pressure cannot fall below 0.

## 11. Hazards

Alpha supports:

- minor Hazards;
- serious Hazards.

Initial limit:

- maximum one active minor Hazard;
- maximum one active serious Hazard;
- escalation may replace or upgrade an existing Hazard rather than adding unlimited new entries.

Hazards may:

- alter a station's DC;
- restrict actions;
- add Pressure;
- interrupt a planned cascade;
- threaten a Ship Scar;
- create or remove a narrative flag.

## 12. Event and Round Goals

Every event defines:

- title;
- category and tags;
- overall objective;
- minimum and maximum rounds;
- visible stakes;
- hidden GM information;
- early-success conditions;
- early-failure conditions;
- withdrawal conditions;
- transformation conditions;
- final reward packages;
- valid Ship Scar categories.

Every round defines:

- title;
- immediate goal;
- beginning vignette and branch variants;
- visible danger;
- hidden danger;
- station actions;
- result conclusions;
- Critical Success advantage;
- Failure complication;
- Critical Failure complication;
- narrative flags created or removed;
- next-round transition.

Events may end early through:

- completed objective;
- catastrophic failure;
- voluntary withdrawal;
- emergency escape;
- Arcflight Combat handoff;
- transformation into another Voyage Event;
- optional continuation for additional reward.

## 13. Branching Narrative Package

Alpha uses imported, prepared narrative components rather than live AI prose.

### 13.1 Event-Level Narrative

- title;
- summary;
- opening vignette;
- visible stakes;
- hidden GM information;
- final outcome vignettes;
- aftermath narration.

### 13.2 Round-Level Narrative

- beginning vignette;
- opening variants based on the previous round result;
- immediate goal;
- visible and hidden dangers;
- Critical Failure conclusion;
- Failure conclusion;
- Success-at-a-Cost conclusion;
- Success conclusion;
- Critical Success conclusion;
- transition to the next round.

### 13.3 Station-Level Narrative

For each station action:

- Critical Failure beat;
- Failure beat;
- Success beat;
- Critical Success beat;
- optional skill-flavor phrases;
- bid-success beat;
- bid-failure beat.

### 13.4 Cascade Narrative

For downstream rewards:

- source station;
- target station;
- reward ID;
- bridge text for creation of the benefit;
- bridge text for use of the benefit;
- narrative priority;
- replacement and compatibility rules.

The composer should prefer one connected cascade bridge over repetitive individual station beats.

### 13.5 Narrative Flags

Alpha events should normally use 3 to 6 important narrative flags.

Flags may represent developments such as:

- creature alerted;
- hidden route found;
- salvage rig damaged;
- optional cache discovered;
- NPC trust gained;
- escape route blocked.

The event package must distinguish event-local flags from proposed persistent campaign flags.

## 14. Narrative Composer

Initial target:

- approximately 150 to 300 words;
- 2 to 4 paragraphs;
- cinematic language rather than mechanical reporting.

Initial assembly priority:

1. Round scene-setting sentence.
2. Most important early station beat.
3. Up to two cascade bridges.
4. Most severe negative outcome.
5. Strongest positive outcome not already represented.
6. Ship-level result conclusion.
7. Next-round transition.

The composer must avoid repeating the same action through both an individual beat and a cascade bridge unless the components explicitly support combination.

The exact posted vignette and the component IDs used to assemble it are saved in event history.

## 15. PF2e Integration

Arcflight must use native PF2e roll behavior wherever possible.

The Event Manager must:

- resolve the assigned operator Actor;
- locate the selected PF2e skill or Lore statistic;
- apply Arcflight modifiers through valid PF2e modifier handling;
- preserve natural 20 and natural 1 degree adjustments;
- support valid fortune and misfortune behavior;
- post the roll to chat;
- read the final degree of success;
- prevent duplicate resolution from double clicks or stale clients.

Alpha does not reimplement PF2e's core degree-of-success rules.

## 16. Multiplayer Authority and Recovery

The GM client owns authoritative Voyage Event state.

Player clients submit requests for:

- station-order changes;
- tentative selections;
- station confirmation;
- target selection;
- roll execution;
- use of valid held effects.

Arcflight validates requests against the current authoritative phase and revision.

The event must survive:

- browser refresh;
- player reconnect;
- GM reconnect;
- Foundry restart;
- session ending during Crew Planning;
- session ending during a station activation;
- session ending before aftermath is applied.

Arcflight must persist after each meaningful state transition:

- active event;
- current phase;
- current round;
- station order;
- tentative selections;
- locked selections;
- completed rolls;
- Focus;
- incoming benefits;
- catalog effects;
- Pressure;
- Hazards;
- narrative flags;
- exact posted vignettes;
- event score and history;
- staged aftermath.

## 17. GM Controls

Alpha includes controls to:

- pause and resume the event;
- unlock station order;
- reassign a station operator;
- edit an unresolved station selection;
- override a station result;
- skip a station;
- add or remove Pressure;
- activate, escalate, downgrade, or remove a Hazard;
- edit a vignette;
- suppress a narrative beat;
- end the event early;
- withdraw from the event;
- stage an Arcflight Combat handoff;
- reopen aftermath;
- view event history.

All overrides are logged with user and timestamp.

## 18. Import and Export

Alpha supports a versioned JSON event package.

The package may contain:

- narrative text;
- stable Arcflight mechanical references;
- reward IDs;
- danger IDs;
- Hazard IDs;
- station actions;
- skills;
- narrative flags;
- artwork paths.

The package may not contain:

- executable JavaScript;
- macros;
- HTML event handlers;
- arbitrary Foundry operations;
- unvalidated file-system instructions.

Import validation produces:

- errors for missing required fields;
- errors for unknown mechanical identifiers;
- warnings for missing optional art;
- warnings for unreachable narrative branches;
- warnings for invalid target combinations;
- warnings for incompatible timing or final-round effects.

## 19. UI Architecture and Naming

The alpha UI must be easy to edit, restyle, localize, animate, and add artwork to later.

Every major UI region must have:

- clear developer-facing component name;
- stable component ID;
- stable CSS class;
- localization key;
- associated data path;
- optional artwork role;
- editable title and helper text;
- visible empty-state placeholder.

UI elements must never be identified only by position such as "left box" or "top panel."

No important UI text should be hardcoded in JavaScript.

### 19.1 Event Library

Component: `AF-UI-EVENT-LIBRARY`

Contains:

- event cards;
- import event control;
- validation status;
- event category;
- round count;
- artwork thumbnail slot;
- start-event control.

### 19.2 Event Setup

Component: `AF-UI-EVENT-SETUP`

Contains:

- event overview;
- ship selection;
- station assignments;
- player assignments;
- visible stakes;
- opening-art slot;
- begin-event control.

### 19.3 Cinematic Vignette Panel

Component: `AF-UI-VIGNETTE-PANEL`

Contains:

- artwork slot;
- vignette title;
- vignette body;
- edit control;
- alternate-variant selector;
- post-to-chat control;
- continue control.

### 19.4 Crew Planning Board

Component: `AF-UI-CREW-PLANNING`

Contains:

- draggable station cards;
- current order;
- tentative action summaries;
- incoming-benefit indicators;
- lock-order control;
- Captain confirmation;
- GM override.

### 19.5 Station Cards

Component pattern: `AF-UI-STATION-{STATION_ID}`

Required components:

- `AF-UI-STATION-CAPTAIN`
- `AF-UI-STATION-ENGINEER`
- `AF-UI-STATION-NAVIGATOR`
- `AF-UI-STATION-WATCHMASTER`
- `AF-UI-STATION-VEILWARDEN`

Each station card contains:

- station-art or portrait slot;
- station title;
- operator portrait slot;
- operator name;
- remaining Focus;
- incoming effects;
- tentative action;
- readiness indicator;
- drag handle;
- expand-details control.

### 19.6 Station Action Panel

Component: `AF-UI-STATION-ACTION-PANEL`

Contains:

- action name;
- action artwork slot;
- narrative description;
- three skill choices;
- base DC;
- No Bid;
- visible `+2`, `+5`, and `+8` bids;
- exact reward and danger;
- valid target selector;
- Focus control;
- effective-DC preview;
- confirm-and-roll control.

### 19.7 Active Station Resolution

Component: `AF-UI-STATION-RESOLUTION`

Contains:

- active station;
- selected action;
- selected skill;
- selected bid;
- incoming benefits;
- effective-DC breakdown;
- roll control;
- PF2e result;
- generated effect;
- next-station control.

### 19.8 Ship Status Panel

Component: `AF-UI-SHIP-STATUS`

Contains:

- five Pressure lanes;
- active Hazards;
- held effects;
- narrative flags;
- current round;
- event score;
- ship-result history.

### 19.9 Round Resolution Panel

Component: `AF-UI-ROUND-RESOLUTION`

Contains:

- five station results;
- weighted total;
- ship-level result;
- Critical Success advantage or failure consequence;
- narrative-composer preview;
- continue-to-vignette control.

### 19.10 Aftermath Panel

Component: `AF-UI-AFTERMATH`

Contains:

- final event score;
- final event result;
- Voyage Benefit;
- Ship Scar;
- salvage;
- cargo;
- discoveries;
- narrative changes;
- Apply Aftermath control;
- export-event-log control.

### 19.11 UI Traceability Example

```text
Component: AF-UI-STATION-ENGINEER
CSS: .arcflight-station-card--engineer
Localization: ARCFLIGHT.UI.Station.Engineer
Data path: event.round.stations.engineer
Artwork role: station-engineer
```

## 20. Artwork Slots

Artwork is optional. Every event remains fully playable without it.

Every artwork region has a stable role name, including:

- `event-cover`;
- `event-opening`;
- `round-opening`;
- `round-conclusion`;
- `station-captain`;
- `station-engineer`;
- `station-navigator`;
- `station-watchmaster`;
- `station-veilwarden`;
- `action-illustration`;
- `hazard-illustration`;
- `aftermath-benefit`;
- `aftermath-scar`.

Empty artwork regions display clearly labeled development placeholders.

Art paths are data-driven and editable without changing layout code. Artwork dimensions must not be the only factor controlling panel layout.

## 21. Alpha Acceptance Criteria

Alpha is complete when the two bundled events demonstrate all of the following:

- five visible stations;
- synchronized drag-and-drop ordering;
- a different possible station order each round;
- tentative Crew Planning choices;
- final station confirmation at activation;
- three skills per station action;
- No Bid and three visible Difficulty Bids;
- exact visible reward and danger;
- native PF2e check resolution;
- correct degree-of-success reading;
- correct weighted station totals;
- cascading downstream station benefits;
- updated effective-DC display;
- Focus spending and restoration when explicitly awarded;
- five Pressure lanes;
- minor and serious Hazards;
- branching beginning-of-round vignettes;
- combined cinematic end-of-round vignettes;
- exact vignette preservation;
- final event-result calculation;
- staged Voyage Benefit or Ship Scar;
- Apply Aftermath workflow;
- event history;
- import and export;
- reload and reconnect recovery;
- multiplayer synchronization;
- GM override controls;
- clearly labeled, localized, and art-ready UI regions.

## 22. Definition of Done

Alpha is not complete merely because calculations work.

Alpha is complete when both events can be run at the table from opening vignette through aftermath and feel like a cohesive Arcflight gameplay experience.
