# Gameplay V3-002: Voyage Encounter Architecture Specification

## Status

**Architecture specification only.** This document defines the intended boundaries, terminology, state ownership, authority model, and lifecycle for Arcflight Voyage Encounters. It does not implement gameplay.

## Scope

Gameplay V3-002 covers only Arcflight's **Voyage Encounter pillar**: noncombat situations encountered while a ship travels through the void.

Representative Voyage Encounters include:

- navigating a meteor storm;
- investigating or salvaging a wreck;
- responding to an Arkengine or Lifeveil crisis;
- encountering a rare void creature;
- surviving environmental or magical phenomena;
- solving navigation, route, or exploration problems;
- handling shipboard emergencies during travel;
- making discoveries whose risks and rewards depend on crew choices.

### Out of scope

This specification does not define or implement:

- Arcflight ship combat;
- combat initiative or combat rounds;
- weapon firing, reloads, facing, range, or weapon arcs;
- boarding combat;
- enemy combat turns;
- the Ship Upgrade pillar;
- executable schemas, applications, sockets, PF2e rolls, or automation.

Installed components, crew, rooms, and upgrades may affect Voyage options in later work. This specification defines only the architectural boundary by which Voyage gameplay may read those capabilities; it does not redesign those systems.

## Goals

The Voyage Encounter architecture must:

1. support simple, progress-based, and multi-stage encounters through one shared model;
2. keep gameplay rules out of Foundry windows and event handlers;
3. maintain one authoritative encounter state;
4. provide filtered player-visible projections instead of exposing GM state;
5. separate permanent ship state from temporary encounter state;
6. isolate pure Voyage rules from Foundry and PF2e adapters;
7. make all state changes atomic, validated, recoverable, and revisioned;
8. support multiplayer planning without duplicated resource spending;
9. define failure, cancellation, reset, completion, and recovery as separate operations;
10. remain extensible without forcing every encounter to use every subsystem.

## Architectural principles

### One authoritative encounter state

A Voyage Encounter has one authoritative state. Player windows, GM windows, chat cards, and socket messages do not own gameplay state. They render projections and submit commands.

### Commands, not direct mutation

Every authoritative change is requested through a command. A command is validated against the current encounter revision, permissions, phase, resource availability, and rules before any mutation is accepted.

### Atomic transitions

A command either succeeds completely or leaves authoritative state unchanged. Partial locks, partial resource spending, partial threshold history, and partial persistence are not valid outcomes.

### Pure domain rules

Core Voyage logic should be representable as pure JavaScript operating on plain data. The domain layer must not require Foundry globals, documents, sockets, sheets, chat messages, or PF2e roll internals.

### Adapter boundaries

Foundry integration, multiplayer transport, persistence, and PF2e checks belong behind adapters. These adapters translate external data into normalized domain inputs and domain outputs into platform actions.

### Projections protect hidden information

Players receive filtered projections. Hidden tracks, concealed DCs, unrevealed stages, secret thresholds, GM notes, and hidden consequences must never be included in player payloads and then merely hidden by CSS.

### Recoverability is part of the design

Reloads, disconnects, stale commands, duplicate requests, missing references, interrupted rolls, and persistence failures are normal conditions that must have defined outcomes.

## Terminology

### Voyage Encounter

A noncombat Arcflight gameplay instance centered on one voyage situation. It may last one round or many rounds and may contain one or several stages.

### Encounter definition

The authored description of an encounter: stages, tracks, actions, thresholds, objectives, visible information, hidden information, and possible consequences.

### Encounter state

The mutable authoritative record for one active Voyage Encounter.

### Stage

A distinct situation inside an encounter. A simple encounter still has one default stage. Stages may be linear, branching, optional, choice-driven, or triggered by tracks and consequences.

### Round

One complete cycle of situation presentation, crew planning, readiness, resolution, consequences, and cleanup.

### Phase

A controlled portion of a round with specific legal commands. The standard Voyage Round uses six phases: Situation, Crew Planning, Lock and Readiness, Resolution, Consequences, and Cleanup and Advance.

### Participant

A ship, creature, hazard, crew member, or other referenced entity that may affect or be affected by the encounter. Participant data in the encounter is a temporary reference or snapshot, not ownership of the source document.

### Station

A shipboard operating role through which a participant contributes to a Voyage Round. Stations are roles, not rooms. Available stations may vary by stage.

### Station action

An authored Voyage option chosen by an active station. A station normally receives one primary Voyage Action per round unless another rule explicitly grants more.

### Crew plan

The collection of current station selections, targets, Risk Bids, assistance, and provisional resource reservations for a round.

### Selection

A station's chosen action and its required options.

### Target

A participant, station, track, stage element, or other legal subject of an action.

### Assistance

A station action that supports another selected station action. Assistance is not a free universal bonus.

### Risk Bid

An optional action-specific wager chosen during planning. A bid increases cost, difficulty, exposure, or danger in exchange for an improved potential result.

### Reservation

A provisional claim on a shared resource during Crew Planning. Reservations prevent incompatible plans from locking simultaneously but do not become spending until the action's commitment point.

### Lock

A station's declaration that its plan is complete. Locking prevents ordinary edits and activates readiness validation. A lock is reversible only through an authorized unlock command.

### Readiness

The state in which all required station plans are complete, legal, conflict-free, and ready for GM advancement.

### Threshold

A defined value boundary on a track that may create an immediate, delayed, GM-confirmed, consequence-phase, or end-of-round effect.

### Consequence

A structured outcome that changes tracks, stages, participants, permanent ship state, narrative information, or encounter completion status.

### Projection

A filtered view of authoritative encounter state prepared for a GM, crew, specific player, or observer.

### Command

A request to change authoritative encounter state. Commands include an expected revision and request identifier.

### Domain event

A structured record of something accepted by the domain engine, such as a station locked, track changed, threshold queued, stage advanced, or encounter completed.

## Required encounter structure

Every Voyage Encounter must contain the following fields conceptually, even when some contain default or empty values:

- title and description;
- current situation;
- objective;
- participants;
- available stations;
- current stage;
- round number;
- player-visible information;
- GM-secret information;
- success conditions;
- failure conditions;
- permanent consequences;
- temporary consequences.

A one-stage encounter uses a default stage rather than omitting stage state. Consequence collections may be empty, but the distinction between permanent and temporary consequences must remain explicit.

## Flexible encounter forms

One engine must support:

- a single-round decision;
- a multi-round problem;
- a progress challenge;
- a multi-stage encounter;
- a staged encounter with progress, danger, time, disposition, stability, pursuit, salvage, fuel, strain, or other tracks;
- an encounter with no tracks.

No one form is mandatory for all content.

## Stages

Each stage defines conceptually:

- stable stage identifier and title;
- situation and objective;
- available stations;
- available actions;
- active tracks;
- entry conditions;
- completion conditions;
- failure conditions;
- possible next stages;
- visible information;
- GM-secret information.

Stage graphs may be linear or branching. Stage transitions may be:

- immediate;
- GM-confirmed;
- applied during Consequences;
- applied at end of round.

A GM override is permitted for recovery or adjudication, but it must create an explicit event rather than silently replacing state.

## Standard Voyage Round

### 1. Situation

The authoritative GM presents or updates:

- the current stage;
- visible threats and opportunities;
- objectives;
- revealed tracks and conditions;
- consequences and discoveries from the prior round.

The Situation phase establishes the starting snapshot used by a phase or round reset.

### 2. Crew Planning

Active stations may choose:

- one primary Voyage Action;
- required targets or options;
- an allowed Risk Bid;
- assistance;
- provisional resource commitments.

Selections reserve shared resources provisionally. Changing or unlocking a selection releases its reservations.

### 3. Lock and Readiness

Stations lock completed plans. The engine validates:

- station and operator eligibility;
- action availability;
- legal targets;
- required choices;
- Risk Bid legality;
- assistance legality;
- resource reservations;
- conflicts and hard boundaries.

A station cannot lock a plan that exceeds the currently unreserved shared budget. The GM advances only when readiness rules are satisfied or uses an explicit override.

### 4. Resolution

PF2e checks and no-roll actions resolve in a deterministic authored order. A check that is missing required inputs, cancelled, or invalid does not partially resolve its action.

### 5. Consequences

The engine applies or queues:

- track changes;
- threshold effects;
- discoveries;
- danger and setbacks;
- temporary modifiers;
- damage or persistent consequences;
- stage and encounter outcomes.

### 6. Cleanup and Advance

Round-only state is cleared or archived. The encounter then does exactly one of the following:

- starts the next round in the same stage;
- transitions to another stage;
- completes successfully;
- completes in failure;
- pauses for an authorized GM decision.

## Station participation

### Default action economy

Each active station normally receives one primary Voyage Action per round.

Additional primary actions, reactions, free actions, emergency actions, or follow-up actions exist only when explicitly granted by an action, component, upgrade, crew ability, stage effect, consequence, or encounter rule.

An unmanned or disabled station receives no normal action unless an authored fallback crew action is available.

### Assistance

Helping another station is itself a station action.

Default assistance rules:

- the helper selects a target station action;
- assistance reserves any required resource;
- assistance locks with the rest of the crew plan;
- assistance may require its own PF2e check;
- one helper is allowed by default;
- the target action may allow additional helpers;
- the target action defines the benefit;
- failed assistance adds no extra penalty unless the assistance action says otherwise;
- changing or cancelling the target action invalidates attached assistance and requires replanning.

Possible authored benefits include a circumstance bonus, lower DC, degree adjustment, danger reduction, consequence protection, or an additional option.

## Risk Bids

Risk Bids are optional and action-specific. Each action defines:

- whether bids are allowed;
- available bid levels;
- added difficulty, cost, or exposure;
- improved success benefit;
- added failure danger;
- player-visible risk information;
- commitment timing.

Core rules:

- a bid is chosen before the station locks;
- changing the action or target clears the bid;
- unlocking allows the bid to change;
- the bid becomes final at the action's commitment point;
- the domain engine validates bid coupling;
- no universal numeric formula is assumed;
- players must understand the general risk accepted, while explicitly hidden consequences may remain secret.

## Generic encounter tracks

Tracks are optional modules selected by the encounter designer. A Voyage Encounter may use no tracks, one track, or multiple custom tracks.

Examples include progress, danger, time, fuel, strain, disposition, salvage, pursuit, corruption, and stability.

### Track definition

Each track defines conceptually:

- stable identifier and label;
- purpose;
- starting value;
- current value;
- minimum and maximum;
- movement direction: increasing, decreasing, or bidirectional;
- beneficial and harmful directions;
- visibility level;
- descriptive bands when needed;
- hard boundary rules;
- limit behavior;
- minimum and maximum effects;
- thresholds and threshold history.

The engine must not assume that higher is always better or worse.

### Visibility levels

Each track independently uses one of four visibility levels:

1. **Exact** — name, current value, range, and revealed thresholds may be shown.
2. **Descriptive** — name and authored narrative condition are shown without numeric value.
3. **Existence only** — players know a pressure exists but receive no value or condition.
4. **Hidden** — the track does not exist in player projections.

The GM projection contains complete exact state. Hidden information must not leak through socket payloads, disabled-action reasons, labels, tooltips, or threshold messages.

Visibility may change when the fiction reveals or conceals information. Player-specific visibility is permitted by the projection architecture but is not required for every encounter.

### Threshold timing

Every threshold defines one trigger timing:

- immediate;
- GM-confirmed;
- Consequences phase;
- end of round.

Non-immediate threshold effects become pending structured events and survive reloads and reconnects.

### Threshold recurrence

Every threshold defines one recurrence rule:

- once per encounter;
- once per stage;
- once per round;
- every valid crossing.

Threshold history is part of authoritative encounter state.

### Multiple thresholds

When one accepted change crosses multiple thresholds, default order follows the direction of movement. An increasing track resolves lower crossed values before higher values; a decreasing track resolves higher crossed values before lower values.

A threshold may define an explicit priority override. Priority overrides resolve before ordinary crossing-order thresholds. Equal priorities fall back to crossing order.

The complete threshold queue must be produced deterministically before resolution begins. An encounter-ending effect may cancel later queued effects only when its authored behavior explicitly says so.

### Track limit behavior

Each track defines one behavior for attempted movement beyond a minimum or maximum:

- **Clamp** — stop at the limit and discard overflow.
- **Allow overflow** — retain the out-of-range value.
- **Reject** — reject the whole update and preserve the prior value.
- **Convert overflow** — stop at the limit and turn excess into another defined effect.

Conversion chains must be bounded and may not loop indefinitely.

### Limit effects and hard boundaries

Reaching a minimum or maximum does not inherently mean success or failure. Each track separately defines its minimum and maximum effects, including `no effect`.

Limit effects normally use the threshold timing, recurrence, priority, queue, and visibility system.

A track may additionally define a hard boundary rule enforced before a command is accepted, such as:

- fuel cannot be spent below zero;
- a full cargo track blocks additional salvage;
- an unavailable atmosphere state blocks actions requiring normal air;
- completed progress cannot accept more progress unless overflow behavior exists.

Hard-boundary rejection leaves authoritative state unchanged.

## Shared resource reservations

During Crew Planning, selected actions reserve shared resources provisionally.

Rules:

- reservations affect the currently available planning budget;
- player-visible resources show the remaining unreserved amount;
- hidden resources are validated by the authoritative GM without exposing values;
- changing or unlocking releases the reservation;
- a station cannot lock an unaffordable plan;
- reservations become actual spending only at the action's defined commitment point;
- cancelled or invalid actions release uncommitted reservations.

This prevents two stations from spending the same Fuel, Strain capacity, crew asset, or other limited resource.

## PF2e checks and DCs

### Domain boundary

The Voyage domain engine does not construct PF2e rolls. It creates a normalized check request and later consumes a normalized result.

Supported check sources may include:

- character skill;
- character Perception;
- character saving throw;
- ship statistic;
- station statistic;
- crew statistic;
- custom encounter modifier;
- no-roll automatic action.

An action defines whether the statistic is fixed or selected by the player, GM, ship, station, or assigned crew member.

Supported DC sources may include:

- fixed action DC;
- encounter-level DC;
- stage-level DC;
- hazard DC;
- opposing creature or ship statistic;
- track-derived DC;
- GM-entered DC;
- secret GM DC.

### Normalized result

The PF2e adapter returns a domain-safe result containing a degree of success:

- critical success;
- success;
- failure;
- critical failure.

It may also return reference metadata such as roll identifier, total, DC, statistic slug, and roller identity, filtered according to visibility.

Missing actors, missing statistics, invalid DCs, cancelled checks, or adapter failures produce structured failure results. They do not partially resolve the action.

## State ownership and persistence

### Permanent ship state

Permanent ship or component records own durable configuration and long-term results, including:

- installed Hull and Arkengine;
- installed rooms, weapons, Arkengine Mods, and Ship Upgrades;
- crew roster;
- permanent station configuration;
- long-term damage and persistent conditions;
- permanent resource losses;
- finalized salvage or discoveries that become ship assets.

### Voyage Encounter state

A separate authoritative encounter record owns temporary gameplay state, including:

- encounter and definition identifiers;
- current stage;
- round and phase;
- participants and temporary references;
- temporary station assignments;
- selections, targets, Risk Bids, and assistance;
- reservations;
- tracks, threshold history, and pending threshold queue;
- visible and hidden information;
- pending checks and consequences;
- revision and processed request identifiers;
- resolution and recovery history required to resume safely.

Temporary encounter state must not be mixed into the ship's permanent configuration object. The exact Foundry storage type is deferred to V3-003.

### Interface-only state

Non-authoritative local state includes window position, active tab, scroll position, collapsed panels, hover state, local filters, and unfinished unsubmitted form edits.

## GM state and player projections

The authoritative GM state is never sent wholesale to players.

Projection types may include:

- GM projection;
- crew projection;
- specific-player projection;
- observer projection.

A player projection may contain:

- visible situation and objective;
- available stations;
- permitted actions;
- the player's selections;
- visible allied selections;
- visible tracks;
- readiness;
- public consequences and results.

It must exclude hidden tracks, concealed DCs, secret thresholds, unrevealed stages, GM notes, secret outcomes, and undiscovered participant information.

Unavailable-action explanations must be sanitized so they cannot reveal hidden state.

## Multiplayer authority and sockets

The active GM is the authoritative writer for Voyage Encounter state.

### Command flow

1. A player creates a command request with a unique request identifier and expected encounter revision.
2. The player sends the request through the socket adapter.
3. The active GM validates permission, revision, phase, rules, references, reservations, and hard boundaries.
4. The GM applies the command atomically to a candidate next state.
5. The GM persists the accepted state.
6. The authoritative revision increments.
7. The GM builds filtered projections.
8. The socket adapter broadcasts appropriate projections.
9. clients rerender from projections.

Players do not directly write authoritative encounter state.

### Socket responsibilities

Sockets transport requests, acknowledgements, structured errors, and projections. Sockets do not decide action legality, Risk Bid coupling, track behavior, resource availability, or phase transitions.

### Concurrency rules

- stale expected revisions are rejected;
- duplicate request identifiers are safely ignored or return the prior acknowledgement;
- invalid commands do not partially mutate state;
- rejected clients receive a structured error and fresh projection;
- when no active GM exists, state-changing commands pause;
- a new active GM resumes authority from the latest persisted revision.

## Pure JavaScript, Foundry, and PF2e responsibilities

### Pure Voyage domain layer

The pure layer should own:

- defaults and normalization;
- validation;
- legal phase transitions;
- stage transitions;
- station eligibility;
- action option construction;
- target legality;
- assistance legality;
- Risk Bid coupling;
- reservation accounting;
- station locking and readiness;
- track updates and threshold queues;
- normalized resolution processing;
- consequence generation;
- projection filtering;
- recovery-state validation.

It must not directly import or access Foundry globals, documents, applications, sockets, UI notifications, chat messages, or PF2e roll classes.

### Foundry adapter layer

The Foundry layer should own:

- reading and writing persistent documents;
- resolving Actor, Item, User, Scene, and other references;
- permission checks;
- active GM detection;
- socket transport;
- application rendering;
- notifications and chat output;
- reload restoration;
- document update failure handling.

### PF2e adapter layer

The PF2e layer should own:

- locating the rolling actor or ship;
- locating the requested PF2e statistic;
- constructing and executing checks;
- applying PF2e roll options and modifiers;
- determining or receiving the DC;
- respecting secret checks;
- capturing degree of success;
- returning normalized results to the Voyage domain.

## Conceptual contracts

The following are documentation contracts, not executable APIs for V3-002.

```text
applyCommand(state, command, authorityContext)
  -> { ok, nextState, events, errors, warnings }
```

```text
buildProjection(state, viewerContext)
  -> { encounter, stage, round, visibleStations, visibleTracks,
       visibleSelections, availableCommands, publicResults }
```

```text
buildCheckRequest(state, actionSelection)
  -> { source, statisticOptions, dcSource, secrecy, metadata }
```

```text
applyNormalizedCheckResult(state, pendingCheck, result)
  -> { ok, nextState, consequences, publicResult, gmResult }
```

```text
applyTrackChange(state, trackId, change)
  -> { ok, nextState, thresholdsQueued, conversions, errors }
```

## Failure and atomicity

A state-changing operation follows this order:

1. validate;
2. build a complete candidate state;
3. persist the complete candidate state;
4. publish projections and events.

If validation or persistence fails before commit:

- authoritative state remains unchanged;
- provisional reservations are not spent;
- locks are not partially applied;
- threshold history is not partially recorded;
- the requester receives a structured error;
- the GM receives enough diagnostic context to recover without exposing secrets to players.

## Cancellation, reset, completion, and discard

These are separate commands with distinct meanings.

### Cancel current input

Discard an unsubmitted local edit. No authoritative state changes.

### Unlock one station

Reopen one station plan and release its provisional reservations. This requires station-owner permission or GM authority according to the current phase.

### Reset current phase

Restore the phase-start snapshot while preserving earlier completed phases and permanent changes already committed before that snapshot.

### Reset current round

Restore the round-start snapshot, including selections, locks, reservations, round-scoped threshold history, and pending round outcomes according to the recorded snapshot policy.

### Return to previous stage

A GM-only recovery command requiring an available stage-entry snapshot. It does not silently reverse permanent ship changes.

### End encounter successfully

Finalize success, apply approved permanent consequences and rewards, close temporary planning state, and preserve an encounter summary.

### End encounter in failure

Finalize failure, apply defined permanent consequences, close temporary planning state, and preserve an encounter summary.

### Abandon encounter

Close the encounter without classifying it as success or failure. The GM explicitly chooses which pending permanent consequences remain.

### Discard encounter

A destructive GM-only operation that removes the temporary encounter record after confirmation. It does not silently reverse permanent ship changes already applied.

## Reload, disconnect, and recovery behavior

### Player disconnect

Selections, locks, reservations, and pending results remain authoritative. Reconnecting players receive a fresh projection at the current revision.

### GM disconnect

Mutating commands pause when no active GM is available. A new active GM resumes from the latest persisted state and processes no unverified client-side candidate state.

### Foundry reload or restart

The latest persisted encounter revision is restored, including stage, round, phase, reservations, threshold history, pending threshold queue, pending consequences, processed request identifiers, and recovery markers.

### Interrupted checks

An unresolved check request is marked for GM review. It is not silently rerolled or treated as failure. The GM may resume, cancel, or replace it through an explicit recovery command.

### Missing references

Missing actors, items, crew, or targets are quarantined as invalid references. The system preserves encounter state and blocks affected commands until the GM repairs, replaces, or removes the reference.

### Corrupt or unrecognized state

The encounter opens in GM recovery mode. The system should not automatically rewrite unknown data or discard hidden information. Recovery tools may normalize known safe fields, preserve the original record, and require explicit GM confirmation.

## Travel versus combat boundary

Voyage Encounters and future Arcflight Combat may eventually share broad concepts such as participants, stations, commands, authority, projections, and PF2e adapters. V3-002 does not define a shared combat engine and does not require Voyage phases, tracks, action economy, or resolution order to serve combat.

Future combat work must integrate through deliberate contracts rather than expanding Voyage-specific state into combat by accident.

## Deferred implementation choices for V3-003 and later

This specification intentionally leaves the following implementation details unresolved:

- exact Foundry document type used for encounter persistence;
- exact schema field names and version format;
- exact socket channel and message envelope;
- active-GM election details when several GMs are connected;
- exact check and DC adapter APIs for the installed PF2e version;
- exact stage graph and threshold data syntax;
- exact snapshot storage and retention policy;
- exact UI presentation;
- exact library of Voyage Actions and Risk Bid levels;
- exact permanent-consequence approval workflow.

These choices must conform to this architecture and should be introduced in narrow later PRs.

## V3-002 acceptance criteria

V3-002 is complete when documentation:

- limits scope to Voyage Encounters;
- defines required encounter structure and flexible encounter forms;
- defines stages, rounds, and phases;
- defines stations, actions, assistance, Risk Bids, locks, and readiness;
- defines generic tracks, visibility, thresholds, limits, and overflow;
- defines shared resource reservations;
- defines authoritative GM state and filtered projections;
- separates permanent ship, encounter, and interface state;
- separates pure domain, Foundry, and PF2e responsibilities;
- defines socket authority and concurrency behavior;
- defines PF2e check and DC entry points;
- defines atomic failure behavior;
- distinguishes cancellation, reset, completion, abandonment, and discard;
- defines reload, disconnect, missing-reference, and corrupted-state recovery;
- changes no executable gameplay code.
