# Gameplay V3 Decision Log

## Scope of this log

This log records accepted architecture decisions for **Gameplay V3-002: Voyage Encounter Architecture Specification**.

V3-002 covers only the Voyage Encounter pillar. It does not design Arcflight Combat or the Ship Upgrade pillar and does not implement executable gameplay.

Each entry uses the following headings:

- Decision
- Reason
- Consequences
- Rejected alternatives
- Unresolved questions

---

## V3-002-001 — Flexible encounter forms

### Decision

Use one Voyage Encounter model that supports single-round situations, multi-round problems, progress challenges, multi-stage encounters, and combinations of stages and tracks.

### Reason

Meteor storms, salvage operations, rare creatures, navigation failures, discoveries, and shipboard crises should not be forced into one rigid structure.

### Consequences

- A simple encounter may use one default stage and no tracks.
- Complex encounters may use branching stages and several tracks.
- Every encounter defines explicit success and failure conditions.
- The future engine must not create separate incompatible subsystems for each encounter shape.

### Rejected alternatives

- Only one major problem per encounter.
- Only connected scenes.
- Only progress challenges.

### Unresolved questions

Exact schema representation is deferred to V3-003.

---

## V3-002-002 — Required common encounter structure

### Decision

Every Voyage Encounter includes title and description, current situation, objective, participants, available stations, current stage, round number, player-visible information, GM-secret information, success conditions, failure conditions, permanent consequences, and temporary consequences.

### Reason

A consistent required structure gives the GM, players, persistence layer, projections, and future UI stable locations for essential information.

### Consequences

- A simple encounter still has a default stage.
- Empty consequence collections remain explicit.
- Visible and secret information are separate from the beginning.
- Success and failure conditions are authored before play.

### Rejected alternatives

- A minimal core with most fields optional.
- Mandatory progress, danger, time, and resource tracks on every encounter.

### Unresolved questions

Exact field names and version format are deferred to V3-003.

---

## V3-002-003 — Optional generic tracks

### Decision

Progress, danger, time, resources, disposition, stability, pursuit, salvage, corruption, and other tracks are optional modules selected by the encounter designer.

### Reason

Different encounters need different pressures. Mandatory tracks would create meaningless bookkeeping.

### Consequences

- Encounters may use no tracks, one track, or several tracks.
- Custom track types are allowed.
- Actions, stages, thresholds, and consequences may read or modify tracks.
- The domain engine must treat tracks generically rather than hard-code progress and danger.

### Rejected alternatives

A universal fixed set of tracks required by every encounter.

### Unresolved questions

Exact authored track data syntax is deferred.

---

## V3-002-004 — Per-track visibility

### Decision

Each active track has its own visibility setting.

### Reason

Voyage gameplay needs both informed teamwork and concealed danger.

### Consequences

- The GM always receives complete exact track state.
- Player projections filter each track independently.
- Visibility may change when fiction reveals or conceals information.
- Hidden data must not leak through payloads, tooltips, labels, or disabled-action reasons.

### Rejected alternatives

- Every track is exact and public.
- Every track is descriptive or hidden.

### Unresolved questions

Player-specific visibility is supported architecturally, but its use is content-dependent.

---

## V3-002-005 — Four visibility levels

### Decision

Support four standard visibility levels: Exact, Descriptive, Existence only, and Hidden.

### Reason

These levels cover transparent teamwork, narrative uncertainty, known-but-unmeasured pressures, and completely secret complications without requiring a separate approximate-number mode.

### Consequences

- Exact shows values and revealed boundaries.
- Descriptive shows an authored condition without numbers.
- Existence only acknowledges a pressure without value or condition.
- Hidden removes the track from the player projection.

### Rejected alternatives

- Three levels without Existence only.
- Five levels with a mandatory approximate numeric range.

### Unresolved questions

Successful actions may reveal or upgrade visibility when authored to do so.

---

## V3-002-006 — Per-track direction and meaning

### Decision

Each track declares whether it increases, decreases, or moves both directions and separately identifies beneficial and harmful movement.

### Reason

Progress, danger, fuel, time remaining, disposition, and stability do not share one intuitive direction.

### Consequences

- The engine cannot assume higher is better or worse.
- Player messages must explain the meaning of changes.
- Track validation uses authored range and movement rules.

### Rejected alternatives

- Every track counts upward from zero.
- Direction is presentation-only.

### Unresolved questions

Whether a particular authored track may reverse its beneficial direction is content-specific.

---

## V3-002-007 — Per-threshold trigger timing

### Decision

Each threshold declares one trigger timing: Immediate, GM-confirmed, Consequences phase, or End of round.

### Reason

Some effects must occur at once, while others need narration, coordinated consequence processing, or round-end timing.

### Consequences

- Non-immediate thresholds create pending structured events.
- Pending thresholds survive reload and reconnect.
- Threshold timing belongs to domain rules, not UI timing.

### Rejected alternatives

- Every threshold triggers immediately.
- Every threshold requires GM confirmation.

### Unresolved questions

Exact queue representation is deferred to V3-003.

---

## V3-002-008 — Per-threshold recurrence

### Decision

Each threshold declares one recurrence mode: Once per encounter, Once per stage, Once per round, or Every valid crossing.

### Reason

Some thresholds represent unique dramatic events while others represent recurring pressure.

### Consequences

- Authoritative state records threshold history.
- Remaining on a threshold does not count as a new crossing.
- Stage and round snapshots must preserve the history needed for reset and recovery.

### Rejected alternatives

- Every threshold triggers once.
- Every threshold triggers on every crossing.

### Unresolved questions

Reset commands use snapshots rather than informal history deletion.

---

## V3-002-009 — Multiple threshold ordering

### Decision

Multiple thresholds crossed by one change resolve in directional crossing order by default. An individual threshold may define a priority override.

### Reason

Crossing order is predictable and natural, while priority supports exceptional catastrophe, termination, or stage-transition effects.

### Consequences

- Increasing tracks default from lower crossed values to higher values.
- Decreasing tracks default from higher crossed values to lower values.
- Equal priorities fall back to crossing order.
- The complete deterministic queue is built before effects begin.

### Rejected alternatives

- Crossing order with no exceptions.
- Mandatory priority on every threshold.
- GM chooses the order manually every time.

### Unresolved questions

Exact priority representation may use numbers or named bands in V3-003.

---

## V3-002-010 — Per-track limit and overflow behavior

### Decision

Each track declares one behavior for attempted movement beyond its minimum or maximum: Clamp, Allow overflow, Reject, or Convert overflow.

### Reason

Resources, progress, danger, and narrative pressures need different boundary behavior.

### Consequences

- Rejected updates leave the track unchanged.
- Conversion identifies an explicit destination effect.
- Conversion chains must be bounded and non-circular.
- Threshold crossings use the accepted final movement.

### Rejected alternatives

One universal boundary rule for every track.

### Unresolved questions

Exact conversion-chain protection belongs to the future domain schema and validator.

---

## V3-002-011 — Per-track minimum and maximum effects

### Decision

Each track separately defines what reaching its minimum and maximum does, including `no effect`.

### Reason

A limit may represent completion, disaster, capacity, depletion, or simply a display boundary.

### Consequences

- A limit may complete or fail a stage or encounter, restrict actions, trigger consequences, reveal information, or do nothing.
- Limit effect and overflow behavior remain separate concepts.
- One-time limit effects require authoritative history.

### Rejected alternatives

- Every limit automatically creates success or failure.
- Limits never matter without unrelated custom logic.

### Unresolved questions

Limit effects normally use threshold definitions, as clarified by Decision 012.

---

## V3-002-012 — Limits use thresholds plus optional hard boundaries

### Decision

Minimum and maximum effects normally use the common threshold system, but a track may define a hard boundary validated before accepting a command.

### Reason

Narrative limit effects can use normal timing, but impossible spending and illegal capacity changes must be rejected before state mutation.

### Consequences

- Hard-boundary validation occurs before mutation.
- Rejection is atomic.
- The hard rule controls legality; threshold effects control what happens after reaching a value.
- Player-facing errors must not reveal hidden values.

### Rejected alternatives

- Treat every limit only as a delayed threshold.
- Build an entirely separate limit-resolution framework.

### Unresolved questions

Shared spending conflicts are handled through provisional reservations in Decision 013.

---

## V3-002-013 — Provisional shared resource reservations

### Decision

During Crew Planning, selections provisionally reserve required shared resources. Changing or unlocking releases the reservation. Spending becomes final only at the action's commitment point.

### Reason

Two stations must not unknowingly spend the same Fuel, Strain capacity, crew asset, or other limited resource.

### Consequences

- Player-visible budgets show remaining unreserved amounts.
- Hidden resources are validated by GM authority without exposing values.
- A station cannot lock an unaffordable plan.
- Invalid or cancelled uncommitted actions release reservations.

### Rejected alternatives

- First locked always wins without shared planning visibility.
- Discover conflicts only during resolution.
- Leave every conflict for manual GM allocation.

### Unresolved questions

Exact commitment points are defined by individual actions.

---

## V3-002-014 — Flexible stage graph

### Decision

Voyage Encounters may use one or several stages arranged linearly, through branches, as optional stages, through player choices, or through track and consequence triggers.

### Reason

Voyage content ranges from simple hazards to discoveries with meaningful route and escalation choices.

### Consequences

- Every encounter still has a current stage.
- Each stage defines its situation, objective, stations, actions, tracks, entry and exit conditions, possible next stages, and information boundaries.
- Stage transitions use explicit timing.
- GM overrides create domain events rather than silent data replacement.

### Rejected alternatives

- Only linear stages.
- No formal stage model.

### Unresolved questions

Exact graph validation is deferred to V3-003.

---

## V3-002-015 — Six-phase Voyage Round

### Decision

Use six standard phases: Situation, Crew Planning, Lock and Readiness, Resolution, Consequences, and Cleanup and Advance.

### Reason

The phases clearly separate presentation, simultaneous decisions, validation, PF2e resolution, fallout, and lifecycle transition.

### Consequences

- Commands are phase-restricted.
- Phase-start and round-start snapshots support reset and recovery.
- The GM controls authoritative advancement.
- Cleanup produces one next state: next round, next stage, success, failure, or pause.

### Rejected alternatives

- Freeform rounds with UI-controlled transitions.
- Combining selection, rolling, and consequences into one mutable phase.

### Unresolved questions

Encounter definitions may omit inactive mechanics but retain the six lifecycle boundaries.

---

## V3-002-016 — One primary Voyage Action per active station

### Decision

Each active station normally receives one primary Voyage Action per round. Additional, reaction, free, emergency, and follow-up actions require explicit grants.

### Reason

A clear default protects planning readability without preventing components, crew, stages, or actions from creating exceptions.

### Consequences

- No universal reaction or free-action economy is assumed.
- Disabled or unmanned stations have no normal action unless an authored fallback exists.
- Future option construction must account for explicit grants.

### Rejected alternatives

- Unlimited station actions.
- A universal complex action-point economy in the initial Voyage architecture.

### Unresolved questions

Action grants and costs will be defined in later action schemas.

---

## V3-002-017 — Assistance is a station action

### Decision

Helping another station is a selected and locked station action, not a free universal bonus.

### Reason

Assistance should create a meaningful crew-planning tradeoff and remain compatible with targets, resources, checks, and Risk Bids.

### Consequences

- Assistance targets another selected action.
- One helper is allowed by default unless the target permits more.
- The target action defines the benefit.
- Cancelling or changing the target invalidates attached assistance.
- Failed assistance creates no extra penalty unless authored.

### Rejected alternatives

- Free untracked helping.
- One universal assistance bonus for every action.

### Unresolved questions

Specific assistance benefits are action content, not architecture.

---

## V3-002-018 — Action-specific Risk Bids

### Decision

Risk Bids are optional action-specific wagers chosen during Crew Planning. Each action defines allowed levels, added risk or cost, improved success benefit, failure danger, visibility, and commitment timing.

### Reason

Different Voyage Actions expose the ship and crew to different forms of danger; one universal numeric bid formula would flatten encounter design.

### Consequences

- Changing action or target clears the bid.
- Unlocking allows bid changes.
- The domain engine validates bid coupling.
- Players understand the general wager, while authored hidden consequences may remain secret.

### Rejected alternatives

- Universal bid levels and formula for every action.
- UI-only bid coupling.

### Unresolved questions

The initial bid vocabulary and action library are deferred.

---

## V3-002-019 — PF2e check and DC adapter boundary

### Decision

Voyage Actions declare allowed normalized check and DC sources. A PF2e adapter performs the actual roll and returns critical success, success, failure, or critical failure to the pure Voyage domain.

### Reason

Voyage rules should use PF2e without depending on unstable roll internals or embedding PF2e behavior into UI handlers.

### Consequences

- Check sources may include character, ship, station, crew, custom, or no-roll actions.
- DCs may be fixed, level-based, hazard-based, opposed, track-derived, GM-entered, or secret.
- Missing actors, statistics, DCs, cancelled checks, and adapter failures create structured failures without partial action resolution.

### Rejected alternatives

- Direct PF2e roll construction inside domain rules.
- Hard-code every Voyage Action to one global skill and DC model.

### Unresolved questions

Exact PF2e API integration is deferred to a later compatibility-focused PR.

---

## V3-002-020 — Filtered viewer projections

### Decision

Authoritative encounter state is converted into GM, crew, player-specific, or observer projections. It is never sent wholesale to players.

### Reason

Voyage gameplay requires hidden tracks, concealed DCs, secret stages, complications, and player-safe action explanations.

### Consequences

- Projection generation is a domain responsibility.
- Hidden information is omitted, not merely hidden visually.
- Unavailable-action reasons are sanitized.
- Player-specific visibility is possible when authored.

### Rejected alternatives

- Send full state and hide fields in the UI.
- Maintain independent authoritative states per client.

### Unresolved questions

Exact projection payload shapes are deferred to V3-003.

---

## V3-002-021 — Active GM authority and socket responsibilities

### Decision

The active GM is the authoritative writer. Players send revisioned command requests; the GM validates, applies atomically, persists, increments revision, builds projections, and broadcasts. Sockets only transport messages.

### Reason

A single authority prevents conflicting writes, cheating, accidental secret exposure, and client divergence.

### Consequences

- Players do not directly commit encounter state.
- Stale revisions are rejected.
- Duplicate request IDs are idempotent.
- No active GM means mutations pause.
- A replacement active GM resumes from persisted state.

### Rejected alternatives

- Player-authoritative writes.
- Peer-to-peer conflict resolution.
- Gameplay rules inside socket handlers.

### Unresolved questions

Exact active-GM election and socket envelope are deferred.

---

## V3-002-022 — Separate permanent, encounter, and interface state

### Decision

Permanent ship state remains on ship and component records. Temporary Voyage state belongs to a separate authoritative encounter record. Window preferences and unfinished local input remain non-authoritative interface state.

### Reason

Temporary plans, locks, tracks, and pending checks must not pollute permanent ship configuration or be owned by windows.

### Consequences

- Ship configuration and finalized long-term consequences remain durable.
- Stage, round, phase, selections, bids, reservations, thresholds, hidden data, and recovery history stay with the encounter.
- Exact Foundry persistence type is deferred.

### Rejected alternatives

- Store the entire active encounter inside permanent ship configuration.
- Let application instances own state.

### Unresolved questions

The Foundry document or flag host is selected in V3-003.

---

## V3-002-023 — Atomic commands and recoverable persistence

### Decision

Every mutation validates, creates a complete candidate state, persists it completely, then publishes. Failures before persistence leave authoritative state unchanged.

### Reason

Partial locks, spending, threshold history, and projections would make multiplayer recovery unreliable.

### Consequences

- Persistence failure does not publish candidate state.
- Reload restores the latest persisted revision.
- Player disconnect preserves selections and locks.
- Pending thresholds and consequences survive reconnect.
- Missing references are quarantined rather than deleting encounter state.
- Corrupt or unknown state opens GM recovery mode rather than being silently rewritten.

### Rejected alternatives

- Mutate live state incrementally and attempt rollback.
- Treat reload or disconnect as encounter cancellation.

### Unresolved questions

Exact snapshot retention and recovery UI are deferred.

---

## V3-002-024 — Distinct cancellation, reset, completion, abandonment, and discard commands

### Decision

Cancel current input, unlock one station, reset current phase, reset current round, return to previous stage, end successfully, end in failure, abandon encounter, and discard encounter are separate operations.

### Reason

These operations have different authority, persistence, resource, threshold-history, and permanent-consequence effects and must not be represented by one ambiguous Reset button.

### Consequences

- Local cancellation does not change authoritative state.
- Unlock releases provisional reservations.
- Phase and round reset restore recorded snapshots.
- Previous-stage recovery requires a stage-entry snapshot.
- Success and failure finalize defined permanent outcomes.
- Abandonment requires explicit decisions about pending permanent results.
- Discard removes temporary state but never silently reverses permanent ship changes.

### Rejected alternatives

- One generic reset operation.
- Automatically delete state when an encounter cannot continue.

### Unresolved questions

Exact permissions and confirmation dialogs belong to later Foundry UI work.

---

## Implementation boundary accepted for V3-002

The following remain deliberately deferred:

- executable encounter schemas;
- Foundry persistence type;
- socket message implementation;
- UI applications;
- PF2e roll implementation;
- authored Voyage Action library;
- authored Risk Bid levels;
- stage and track editors;
- migrations and recovery tools.

Future work must conform to these decisions or explicitly amend this log through a reviewed architecture change.
