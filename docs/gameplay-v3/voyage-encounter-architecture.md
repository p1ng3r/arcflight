# Gameplay V3-002: Voyage Encounter Architecture Specification

## Status

**Architecture specification only.** This document defines the intended boundaries, terminology, state ownership, authority model, lifecycle, and recovery behavior for Arcflight Voyage Encounters. It does not implement gameplay.

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
9. define creation, activation, pause, recovery, completion, and discard as explicit lifecycle operations;
10. make permanent consequence application idempotent and auditable;
11. give resets exact snapshot semantics without silently reversing permanent changes;
12. remain extensible without forcing every encounter to use every subsystem.

## Architectural principles

### One authoritative encounter state

A Voyage Encounter has one authoritative state. Player windows, GM windows, chat cards, and socket messages do not own gameplay state. They render projections and submit commands.

### Commands, not direct mutation

Every authoritative change is requested through a command. A command is validated against the current encounter revision, permissions, lifecycle state, phase, resource availability, and rules before any mutation is accepted.

### Atomic transitions

A command either succeeds completely or leaves authoritative state unchanged. Partial locks, partial reservations, partial threshold history, and partially published state are not valid outcomes.

Permanent document changes use the separate idempotent consequence-commit protocol defined below because they may span the encounter record and one or more Foundry documents.

### Pure domain rules

Core Voyage logic should be representable as pure JavaScript operating on plain data. The domain layer must not require Foundry globals, documents, sockets, sheets, chat messages, or PF2e roll internals.

### Adapter boundaries

Foundry integration, multiplayer transport, persistence, and PF2e checks belong behind adapters. These adapters translate external data into normalized domain inputs and domain outputs into platform actions.

### Projections protect hidden information

Players receive filtered projections. Hidden tracks, concealed DCs, unrevealed stages, secret thresholds, GM notes, and hidden consequences must never be included in player payloads and then merely hidden by CSS.

### Recoverability is part of the design

Reloads, disconnects, stale commands, duplicate requests, missing references, interrupted rolls, partial cross-document consequence commits, and persistence failures are normal conditions with defined outcomes.

## Terminology

### Voyage Encounter

A noncombat Arcflight gameplay instance centered on one voyage situation. It may last one round or many rounds and may contain one or several stages.

### Encounter definition

The authored description of an encounter: stages, tracks, actions, thresholds, objectives, visible information, hidden information, and possible consequences.

### Encounter state

The mutable authoritative record for one Voyage Encounter instance.

### Lifecycle state

The encounter's top-level operational state: Draft, Configuration, Ready, Active, Paused, Recovery, Completed — Success, Completed — Failure, Abandoned, or Discarded.

### Stage

A distinct situation inside an encounter. A simple encounter still has one default stage. Stages may be linear, branching, optional, choice-driven, or triggered by tracks and consequences.

### Round

One complete cycle of situation presentation, crew planning, readiness, resolution, consequences, and cleanup.

### Phase

A controlled portion of an Active round with specific legal commands. The standard Voyage Round uses six phases: Situation, Crew Planning, Lock and Readiness, Resolution, Consequences, and Cleanup and Advance.

### Participant

A ship, creature, hazard, crew member, or other referenced entity that may affect or be affected by the encounter. Participant data in the encounter is a temporary reference or snapshot, not ownership of the source document.

### Primary ship

The Arcflight-enabled PF2e vehicle whose crew is resolving the Voyage Encounter. An encounter may reference other ships, but one primary ship anchors station capability reads and permanent ship consequences unless the definition explicitly supports more.

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

A structured outcome that may change tracks, stages, participants, temporary state, permanent ship state, narrative information, or encounter completion status.

### Permanent consequence commitment

The explicit, idempotent process that applies an approved permanent consequence to durable ship or component records and records that it was applied exactly once.

### Projection

A filtered view of authoritative encounter state prepared for a GM, crew, specific player, or observer.

### Command

A request to change authoritative encounter state. Commands include an expected revision and unique request identifier.

### Domain event

A structured record of something accepted by the domain engine, such as an encounter activated, station locked, track changed, threshold queued, stage advanced, permanent consequence committed, or encounter completed.

### Snapshot

A recorded copy of temporary authoritative encounter state at a lifecycle, stage, round, or phase boundary. Snapshots do not contain rollback copies of permanent ship documents.

## Encounter lifecycle

A Voyage Encounter uses explicit lifecycle states. Lifecycle state is independent from round phase.

### Draft

A GM has created an encounter instance and selected or begun authoring its encounter definition. Draft state is not player-playable and does not publish normal crew projections.

Creating the instance establishes:

- a stable encounter identifier;
- the selected encounter definition identifier or embedded definition snapshot;
- lifecycle state `Draft`;
- authoritative revision `0`;
- creation metadata and GM ownership context;
- empty configuration, planning, threshold, consequence, and snapshot collections.

### Configuration

The GM prepares the encounter for play by:

- selecting the primary ship;
- registering participants and validating their references;
- selecting the initial stage;
- initializing stage and encounter tracks;
- defining temporary station availability;
- assigning temporary station operators when needed;
- reviewing visible and GM-secret information;
- confirming success and failure conditions;
- confirming permanent and temporary consequence definitions.

Configuration commands are revisioned and authoritative. They may increment the encounter revision even though no Voyage Round is active.

### Ready

An encounter enters Ready only after activation validation succeeds.

Activation validation confirms at minimum:

- the encounter definition is present and structurally valid;
- the primary ship exists and is eligible;
- required participants resolve or are intentionally represented by valid snapshots;
- the initial stage exists and its entry conditions are satisfied;
- required tracks have valid starting values, limits, visibility, and threshold definitions;
- available stations and temporary operator assignments are legal;
- success and failure conditions exist;
- player projections can be built without hidden-data leakage;
- no unresolved configuration error prevents the first round.

Ready state may publish a limited pre-encounter projection, but players cannot submit normal station selections until activation.

### Active

Activating a Ready encounter is one atomic authoritative command. Activation:

1. applies or queues authored initial-stage entry effects;
2. confirms initial track values and participant snapshots;
3. sets round number to `1`;
4. sets phase to Situation;
5. captures the first round-start snapshot before Situation mutations;
6. captures the first Situation phase-start snapshot;
7. increments the authoritative revision;
8. persists the active encounter state;
9. publishes initial filtered projections.

Only an Active encounter runs Voyage Rounds.

### Paused

A GM may pause an Active encounter through an explicit command. Paused state retains stage, round, phase, selections, reservations, pending checks, threshold queues, consequences, snapshots, and revision history.

While Paused:

- ordinary player mutation commands are rejected;
- the GM may inspect projections and recovery information;
- explicit administrative, recovery, resume, abandon, or discard commands remain available according to permission rules.

Resume restores Active at the same stage, round, and phase unless an authorized recovery command changes them first.

### Recovery

Recovery is entered when the encounter cannot safely continue through ordinary commands, including:

- corrupt or unrecognized stored state;
- missing required references;
- unresolved partial permanent-consequence commitment;
- interrupted external check with uncertain status;
- failed migration or normalization requiring GM review;
- contradictory lifecycle, phase, or snapshot metadata.

Recovery does not silently repair, reroll, discard, or rewrite unknown state. The GM may repair references, reconcile consequence commitments, restore a valid snapshot, return to Configuration or Ready, resume Active, pause, abandon, or discard through explicit commands.

### Terminal lifecycle states

#### Completed — Success

The encounter's success conditions were finalized, approved permanent consequences and rewards were committed or safely queued for required commitment, temporary planning state was closed, and an encounter summary was preserved.

#### Completed — Failure

The encounter's failure conditions were finalized, approved permanent consequences were committed or safely queued for required commitment, temporary planning state was closed, and an encounter summary was preserved.

#### Abandoned

The GM ended the encounter without classifying it as success or failure and explicitly decided which approved but uncommitted permanent consequences, if any, must still be committed or cancelled.

#### Discarded

A destructive GM-only operation removed or tombstoned the temporary encounter record after confirmation. Discard never silently reverses permanent consequences already committed to ship or component documents.

Completed and Abandoned encounter summaries are immutable historical records except through a separate audited recovery or administrative operation. Starting the same authored situation again creates a new encounter instance.

### Legal lifecycle transitions

Conceptually supported transitions are:

- Draft → Configuration;
- Configuration → Draft, Ready, Recovery, or Discarded;
- Ready → Configuration, Active, Recovery, or Discarded;
- Active → Paused, Recovery, Completed — Success, Completed — Failure, or Abandoned;
- Paused → Active, Recovery, Abandoned, or Discarded;
- Recovery → Configuration, Ready, Active, Paused, Abandoned, or Discarded when validation permits;
- Completed or Abandoned → historical read-only state.

A lifecycle transition is always a revisioned command and creates a domain event.

## Required encounter structure

Every Voyage Encounter must contain the following fields conceptually, even when some contain default or empty values:

- stable encounter identifier;
- lifecycle state and authoritative revision;
- encounter definition identifier or definition snapshot;
- title and description;
- primary ship reference;
- current situation;
- objective;
- participants;
- available stations;
- current stage;
- round number and phase when Active;
- player-visible information;
- GM-secret information;
- success conditions;
- failure conditions;
- permanent consequences;
- temporary consequences;
- snapshot and recovery metadata.

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

Entering a stage captures a stage-entry snapshot after the transition is accepted and before the new stage's mutable play begins. A GM override is permitted for recovery or adjudication, but it must create an explicit event rather than silently replacing state.

## Standard Voyage Round

### 1. Situation

The authoritative GM presents or updates:

- the current stage;
- visible threats and opportunities;
- objectives;
- revealed tracks and conditions;
- consequences and discoveries from the prior round.

The round-start snapshot already exists before Situation begins. A separate Situation phase-start snapshot is captured before Situation mutations.

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
- proposed permanent consequences;
- stage and encounter outcomes.

A permanent consequence is not considered applied merely because it was generated during this phase. It must pass through the commitment protocol.

### 6. Cleanup and Advance

Round-only state is cleared or archived. The encounter then does exactly one of the following:

- starts the next round in the same stage;
- transitions to another stage;
- completes successfully;
- completes in failure;
- pauses for an authorized GM decision.

Before a new round's Situation phase mutates state, the engine captures the new round-start snapshot and then the Situation phase-start snapshot.

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
- finalized salvage or discoveries that become ship assets;
- durable idempotency markers or commitment journal entries for applied Voyage consequences.

### Voyage Encounter state

A separate authoritative encounter record owns temporary gameplay state, including:

- encounter and definition identifiers;
- lifecycle state and revision;
- primary ship and participants;
- current stage;
- round and phase;
- temporary station assignments;
- selections, targets, Risk Bids, and assistance;
- reservations;
- tracks, threshold history, and pending threshold queue;
- visible and hidden information;
- pending checks and consequences;
- permanent consequence proposals and commitment status;
- processed request identifiers;
- lifecycle, stage, round, and phase snapshots;
- resolution and recovery history required to resume safely.

Temporary encounter state must not be mixed into the ship's permanent configuration object. The exact Foundry storage type is deferred to V3-003.

### Interface-only state

Non-authoritative local state includes window position, active tab, scroll position, collapsed panels, hover state, local filters, and unfinished unsubmitted form edits.

## Permanent consequence commitment

Generating a permanent consequence does not apply it automatically. Every permanent consequence has a stable unique `consequenceId` within the encounter and moves through explicit conceptual states:

- **Proposed** — generated by an action, threshold, stage, or GM adjudication;
- **Approved** — accepted by authored rules or explicit GM confirmation;
- **Committing** — an authoritative commit command is attempting durable application;
- **Committed** — durable target records contain the consequence's idempotency marker and the encounter records successful application;
- **Cancelled** — the consequence will not be applied;
- **Commit failed** — durable application did not complete and requires retry or recovery.

Each permanent consequence also declares its commitment timing:

- **Immediate commitment** — commit as soon as the consequence is approved;
- **Finalization commitment** — remain approved and pending until success, failure, or abandonment finalization decides its disposition.

### Commit protocol

A permanent consequence commit must:

1. validate lifecycle state, authority, expected encounter revision, target references, and consequence status;
2. use `consequenceId` as an idempotency key;
3. determine whether the durable target already records that key;
4. build the complete durable target change;
5. persist the target change and durable idempotency marker together when the Foundry storage model permits;
6. record or reconcile the encounter consequence as Committed;
7. increment encounter revision and publish filtered results only after a recoverable state exists.

Retries with the same `consequenceId` must not apply the effect twice.

If target persistence fails, the consequence remains uncommitted. If a target write succeeds but encounter-state persistence or acknowledgement fails, Recovery must detect the durable idempotency marker, reconcile the encounter record to Committed, and avoid repeating the effect.

### Finalization rules

- Encounter finalization commits only Approved consequences whose status is not already Committed or Cancelled.
- Already Committed consequences are never applied again.
- Success and failure may approve different pending consequences according to the encounter definition.
- Abandonment requires an explicit GM decision for each Approved but uncommitted permanent consequence.
- Discard never reverses Committed permanent consequences.
- Phase, round, and stage resets do not silently reverse Committed permanent consequences.
- Reversing a Committed permanent consequence requires a separate explicit compensating consequence or administrative recovery command, not ordinary reset.

The exact Foundry representation of durable idempotency markers and cross-document reconciliation is deferred, but these semantics are mandatory.

## GM state and player projections

The authoritative GM state is never sent wholesale to players.

Projection types may include:

- GM projection;
- crew projection;
- specific-player projection;
- observer projection.

A player projection may contain:

- lifecycle state appropriate for the viewer;
- visible situation and objective;
- available stations;
- permitted actions;
- the player's selections;
- visible allied selections;
- visible tracks;
- readiness;
- public consequences and results.

It must exclude hidden tracks, concealed DCs, secret thresholds, unrevealed stages, GM notes, secret outcomes, undiscovered participant information, hidden permanent-consequence proposals, and internal commitment diagnostics.

Unavailable-action explanations must be sanitized so they cannot reveal hidden state.

## Multiplayer authority and sockets

The active GM is the authoritative writer for Voyage Encounter state.

### Command flow

1. A player or GM creates a command request with a unique request identifier and expected encounter revision.
2. The request is sent through the socket adapter when remote authority is required.
3. The active GM validates permission, revision, lifecycle state, phase, rules, references, reservations, and hard boundaries.
4. The GM applies the command atomically to a candidate next encounter state.
5. The GM persists the accepted encounter state or invokes the explicit permanent-consequence commit protocol when durable external documents are involved.
6. The authoritative revision increments monotonically.
7. The GM builds filtered projections.
8. The socket adapter broadcasts appropriate projections.
9. Clients rerender from projections.

Players do not directly write authoritative encounter state.

### Socket responsibilities

Sockets transport requests, acknowledgements, structured errors, and projections. Sockets do not decide action legality, Risk Bid coupling, track behavior, resource availability, lifecycle transitions, phase transitions, or permanent consequence commitment.

### Concurrency rules

- stale expected revisions are rejected;
- duplicate request identifiers are safely ignored or return the prior acknowledgement;
- invalid commands do not partially mutate encounter state;
- rejected clients receive a structured error and fresh projection;
- when no active GM exists, state-changing commands pause;
- a new active GM resumes authority from the latest persisted revision;
- permanent consequence retries are deduplicated by `consequenceId`, not only by transient socket request identifier.

## Pure JavaScript, Foundry, and PF2e responsibilities

### Pure Voyage domain layer

The pure layer should own:

- defaults and normalization;
- lifecycle validation and legal lifecycle transitions;
- activation readiness validation;
- phase and stage validation;
- station eligibility;
- action option construction;
- target legality;
- assistance legality;
- Risk Bid coupling;
- reservation accounting;
- station locking and readiness;
- track updates and threshold queues;
- normalized resolution processing;
- consequence proposal and approval rules;
- permanent consequence commitment intent and idempotency semantics;
- projection filtering;
- snapshot content and reset semantics;
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
- durable idempotency marker storage;
- cross-document consequence reconciliation;
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
createEncounter(definitionRef, authorityContext)
  -> { encounterStateAtRevisionZero, events, errors }
```

```text
validateActivation(state, authorityContext)
  -> { ready, errors, warnings, initialProjectionPreview }
```

```text
applyCommand(state, command, authorityContext)
  -> { ok, nextState, events, errors, warnings }
```

```text
buildProjection(state, viewerContext)
  -> { lifecycle, encounter, stage, round, visibleStations, visibleTracks,
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

```text
preparePermanentConsequenceCommit(state, consequenceId, authorityContext)
  -> { ok, durableWriteIntent, nextEncounterCandidate, errors }
```

```text
reconcilePermanentConsequence(state, consequenceId, durableTargetState)
  -> { ok, nextState, status, errors }
```

```text
captureSnapshot(state, boundary)
  -> { snapshotId, snapshotKind, encounterRevision, temporaryState }
```

```text
applyReset(state, snapshotId, authorityContext)
  -> { ok, nextStateAtNewRevision, cancelledExternalRequests, events, errors }
```

## Failure and atomicity

A normal encounter-state operation follows this order:

1. validate;
2. build a complete candidate encounter state;
3. persist the complete candidate encounter state;
4. increment revision;
5. publish projections and events.

If validation or encounter persistence fails before commit:

- authoritative encounter state remains unchanged;
- provisional reservations are not spent;
- locks are not partially applied;
- threshold history is not partially recorded;
- the requester receives a structured error;
- the GM receives enough diagnostic context to recover without exposing secrets to players.

Permanent consequence commits additionally follow the idempotency and reconciliation protocol because durable target state may exist outside the encounter record.

## Snapshot and reset semantics

Snapshots record temporary authoritative encounter state at explicit boundaries.

### Snapshot boundaries

- **Lifecycle snapshot** — optionally captured before a major administrative transition when recovery policy requires it.
- **Stage-entry snapshot** — captured after a stage transition is accepted and before mutable play in the new stage.
- **Round-start snapshot** — captured before the Situation phase mutates state for that round.
- **Phase-start snapshot** — captured at the beginning of every phase after the previous phase completed.

The first round-start snapshot is captured during activation before the first Situation phase begins.

### Snapshot contents

A snapshot contains the temporary encounter state needed to restore play, including as applicable:

- lifecycle state when the reset command permits restoring it;
- current stage, round, and phase;
- temporary participants and station assignments;
- selections, targets, Risk Bids, assistance, locks, and readiness;
- reservations and uncommitted resource state;
- track values, visibility state, threshold history, and pending threshold queue;
- pending checks, temporary consequences, and uncommitted permanent consequence status;
- visible and hidden encounter information;
- references to committed permanent consequences and durable target revisions;
- recovery markers needed to invalidate or reconcile external operations.

A snapshot does not contain:

- window or interface state;
- rollback copies of ship, component, Actor, Item, or other permanent documents;
- authority to remove durable idempotency markers;
- permission to reapply an already Committed permanent consequence.

### Reset behavior

A reset is a new authoritative command at a new monotonically increasing revision. Encounter revision numbers never move backward.

Resetting to a snapshot:

- restores temporary gameplay fields from that snapshot;
- restores locks, reservations, track values, threshold queues, and recurrence history to the snapshot's recorded state;
- invalidates pending external check or adapter request identifiers created after the snapshot;
- prevents late results from invalidated requests from being applied;
- preserves the append-only audit history of commands that occurred after the snapshot while marking them superseded by the reset;
- preserves processed socket request identifiers so duplicate old requests cannot be replayed as new mutations;
- preserves all Committed permanent consequences and their durable idempotency markers;
- reconciles any permanent consequence that was durably applied after the snapshot rather than attempting to erase it;
- removes or restores Proposed, Approved, Cancelled, or failed uncommitted consequences according to the snapshot;
- publishes fresh filtered projections after persistence.

Round-scoped threshold history returns to the round-start snapshot. Phase-scoped state returns to the selected phase-start snapshot. Encounter-scoped and stage-scoped history that existed at the snapshot remains. A reset may undo a temporary threshold effect accepted after the snapshot, but it does not reverse a permanent consequence already Committed from that effect.

Exact snapshot storage format, compression, and retention count are deferred to V3-003. Snapshot meaning and reset behavior are not deferred.

## Cancellation, reset, completion, and discard

These are separate commands with distinct meanings.

### Cancel current input

Discard an unsubmitted local edit. No authoritative state changes.

### Unlock one station

Reopen one station plan and release its provisional reservations. This requires station-owner permission or GM authority according to lifecycle state and phase.

### Reset current phase

Restore the current phase-start snapshot through the snapshot reset protocol while preserving earlier completed phases and every Committed permanent consequence.

### Reset current round

Restore the current round-start snapshot through the snapshot reset protocol. The reset receives a new revision and invalidates late external results from the superseded portion of the round.

### Return to previous stage

A GM-only recovery command requiring an available stage-entry snapshot. It uses the same reset semantics and does not silently reverse permanent ship changes.

### Pause and resume

Pause moves Active to Paused without changing round state. Resume returns Paused to Active at the preserved phase after validation.

### End encounter successfully

Finalize success, approve the success-specific permanent outcomes, commit only Approved and uncommitted permanent consequences, close temporary planning state, and preserve an encounter summary.

### End encounter in failure

Finalize failure, approve the failure-specific permanent outcomes, commit only Approved and uncommitted permanent consequences, close temporary planning state, and preserve an encounter summary.

### Abandon encounter

Close the encounter without classifying it as success or failure. The GM explicitly chooses whether each Approved but uncommitted permanent consequence is committed or cancelled.

### Discard encounter

A destructive GM-only operation that removes or tombstones temporary encounter state after confirmation. It does not silently reverse permanent ship changes already committed.

## Reload, disconnect, and recovery behavior

### Player disconnect

Selections, locks, reservations, pending results, and lifecycle state remain authoritative. Reconnecting players receive a fresh projection at the current revision.

### GM disconnect

Mutating commands pause when no active GM is available. A new active GM resumes from the latest persisted state and processes no unverified client-side candidate state.

### Foundry reload or restart

The latest persisted encounter revision is restored, including lifecycle state, stage, round, phase, reservations, threshold history, pending threshold queue, pending consequences, permanent consequence status, processed request identifiers, snapshots, and recovery markers.

### Interrupted checks

An unresolved check request is marked for GM review. It is not silently rerolled or treated as failure. The GM may resume, cancel, replace, or invalidate it through an explicit recovery command.

### Missing references

Missing actors, items, crew, ships, or targets are quarantined as invalid references. The system preserves encounter state and blocks affected commands until the GM repairs, replaces, snapshots, or removes the reference.

### Interrupted permanent consequence commit

Recovery checks the target document or commitment journal for the stable `consequenceId`:

- when no durable marker exists, the consequence remains uncommitted and may be retried;
- when the durable marker exists, the encounter record is reconciled to Committed without reapplying the effect;
- when target state is contradictory or incomplete, the encounter remains in Recovery for explicit GM resolution.

### Corrupt or unrecognized state

The encounter opens in Recovery. The system must not automatically rewrite unknown data or discard hidden information. Recovery tools may normalize known safe fields, preserve the original record, and require explicit GM confirmation.

## Travel versus combat boundary

Voyage Encounters and future Arcflight Combat may eventually share broad concepts such as participants, stations, commands, authority, projections, PF2e adapters, and idempotent permanent consequences. V3-002 does not define a shared combat engine and does not require Voyage phases, tracks, action economy, or resolution order to serve combat.

Future combat work must integrate through deliberate contracts rather than expanding Voyage-specific state into combat by accident.

## Deferred implementation choices for V3-003 and later

This specification intentionally leaves the following implementation details unresolved:

- exact Foundry document type used for encounter persistence;
- exact schema field names and version format;
- exact socket channel and message envelope;
- active-GM election details when several GMs are connected;
- exact check and DC adapter APIs for the installed PF2e version;
- exact stage graph and threshold data syntax;
- exact snapshot storage format, compression, and retention count;
- exact durable idempotency-marker or commitment-journal storage;
- exact UI presentation;
- exact library of Voyage Actions and Risk Bid levels;
- exact permanent-consequence approval interface.

These choices must conform to this architecture and should be introduced in narrow later PRs.

## V3-002 acceptance criteria

V3-002 is complete when documentation:

- limits scope to Voyage Encounters;
- defines required encounter structure and flexible encounter forms;
- defines the Draft, Configuration, Ready, Active, Paused, Recovery, and terminal lifecycle states;
- defines activation validation and first-round initialization;
- defines stages, rounds, and phases;
- defines stations, actions, assistance, Risk Bids, locks, and readiness;
- defines generic tracks, visibility, thresholds, limits, and overflow;
- defines shared resource reservations;
- defines authoritative GM state and filtered projections;
- separates permanent ship, encounter, and interface state;
- defines idempotent permanent consequence proposal, approval, commitment, retry, reconciliation, and finalization behavior;
- separates pure domain, Foundry, and PF2e responsibilities;
- defines socket authority and concurrency behavior;
- defines PF2e check and DC entry points;
- defines atomic failure behavior;
- defines lifecycle, stage, round, and phase snapshots;
- defines reset behavior without rolling back revisions or committed permanent changes;
- distinguishes cancellation, unlock, pause, reset, completion, abandonment, and discard;
- defines reload, disconnect, missing-reference, interrupted-commit, and corrupted-state recovery;
- changes no executable gameplay code.
