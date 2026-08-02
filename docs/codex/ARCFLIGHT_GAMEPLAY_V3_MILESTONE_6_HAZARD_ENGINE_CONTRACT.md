# Arcflight Gameplay V3 Milestone 6  -  Hazard Engine Contract

Status: proposed Milestone 6 Task 0 contract for review.

This document freezes the proposed domain contract for Milestone 6. It does not
implement production behavior, register public APIs, define UI, or authorize
Milestone 7 or later work.

## 1. Authority and compatibility

The contract is derived from:

- `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`;
- `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`;
- `docs/gameplay-v3/voyage-encounter-architecture.md`;
- the existing Voyage domain validation and atomic-transition conventions; and
- the accepted Milestone 5B Pressure Breach implementation.

The canonical Event Runner rules remain authoritative. Where this document
selects a concrete field name or representation that the canonical documents
leave open, the selection is a proposed Milestone 6 contract requiring review
before implementation.

## 2. Active Hazard state

The authoritative encounter-state collection is:

~~~
activeHazards: []
~~~

`activeHazards` is an array in temporary authoritative Voyage Encounter state
that contains only currently active Hazard records. Every record persisted in
`activeHazards` therefore has `status: "active"`. It is not part of permanent
ship state and is never stored in a ship's permanent configuration.

Terminal statuses remain available in isolated domain-event snapshots and
transition audit payloads, but terminal records are not persisted in
`activeHazards` during Milestone 6.

Every successful mutation returns a fresh cloned `nextState`, increments the
revision exactly once, emits exactly one domain event, and passes final state
validation. The caller's state and nested input data are never mutated.

## 3. Categories and statuses

Allowed Hazard categories are exactly:

~~~
system
event
~~~

Allowed statuses are exactly:

~~~
active
resolved
expired
replaced
~~~

`active` is the only status that occupies a system slot. `resolved`,
`expired`, and `replaced` records do not occupy a system slot. A resolved
Hazard produces no further effect. An unresolved active Hazard is handled by
the closeout contract before it leaves active occupation.

System Hazards require `pressureSystemId` and do not use `eventAreaId`.
Event Hazards require `eventAreaId` and do not use `pressureSystemId`, unless
an authored rule explicitly attaches the event Hazard to a system and changes
its category to `system` before persistence.

## 4. Typed Hazard schema

Each active persisted record is a plain serializable object with the following
required common fields:

~~~
{
  hazardId: String,
  encounterId: String,
  category: "system" | "event",
  status: "active",
  name: String,
  currentEffect: PlainAuthoredDescriptor,
  activationTiming: HazardTiming,
  removalMethod: PlainAuthoredDescriptor,
  ignoredConsequence: PlainAuthoredDescriptor,
  visibility: "public" | "gm-secret",
  sourceKind: String,
  createdStageId: String,
  createdRoundNumber: PositiveSafeInteger,
  createdSequence: NonNegativeSafeInteger,
  escalation: HazardEscalation,
  collisionPolicy: HazardCollisionPolicy,
  duration: HazardDuration,
  failurePressureSystemId: String | null,
  resolvedStageId: String | null,
  resolvedRoundNumber: PositiveSafeInteger | null,
  terminalReason: String | null,
  replacedByHazardId: null,
  metadata: PlainObject
}
~~~

`PlainAuthoredDescriptor` is declarative plain data. It may contain stable
identifiers, labels, timing, targets, and effect payloads, but no functions,
macros, executable JavaScript, or HTML event handlers.

System records additionally require:

~~~
pressureSystemId: String
~~~

Event records additionally require:

~~~
eventAreaId: String
~~~

All provenance fields are normalized to present own enumerable data properties.
Missing provenance is represented by `null`:

~~~
{
  pressureBreachId: String | null,
  stationId: String | null,
  actionId: String | null,
  pressureEffectId: String | null,
  sourceIntentId: String | null,
  activationSource: String | null,
  branch: String | null,
  sourceTiming: String | null,
  sourceVisibility: String | null
}
~~~

They must not be inferred from inherited, accessor, Proxy, or unsafe-key data.

Category-specific fields are also always present. A system Hazard has a
canonical `pressureSystemId` and `eventAreaId: null`. An event Hazard has a
canonical `eventAreaId` and `pressureSystemId: null`. For a system Hazard,
`failurePressureSystemId` must equal `pressureSystemId`. For an event Hazard,
`failurePressureSystemId` is either a canonical Pressure system ID or `null`.

An event Hazard with `failurePressureSystemId: null` is not eligible for the
default Address Hazard action. Pressure targets are never inferred from
`eventAreaId`.

## 5. Visibility and projections

Hazard visibility is exactly one of:

~~~
public
gm-secret
~~~

Mechanical information required for a player decision may not be concealed.
A public Hazard projection must expose:

- `hazardId`;
- `category`;
- `name`;
- the affected system or event area;
- `currentEffect`;
- `activationTiming`;
- `removalMethod`;
- `ignoredConsequence`; and
- the visible escalation state whenever it is mechanically relevant.

GM-only metadata and concealed narrative escalation information may remain
outside the public projection. A public projection must not leak hidden data
through error messages, disabled-action explanations, labels, or tooltips.

## 6. HazardTiming

`HazardTiming` is exactly this discriminated object:

~~~
{
  kind:
    "immediate"
    | "before-next-station"
    | "start-of-next-round"
    | "end-of-round"
    | "named-station-activation"
    | "specified-result"
    | "event-closeout",
  stationId: String | null,
  resultId: String | null
}
~~~

The discriminant controls the identifier fields:

- `named-station-activation` requires `stationId` and requires
  `resultId: null`;
- `specified-result` requires `resultId` and requires `stationId: null`; and
- every other timing requires both identifiers to be `null`.

`countdown.decrementTiming` uses this exact `HazardTiming` shape.

## 7. System-Hazard invariant

Each Pressure system normally supports at most one active system Hazard.

The active-slot predicate is:

~~~
category === "system" && status === "active" &&
pressureSystemId === requestedPressureSystemId
~~~

Resolved, expired, and replaced records do not occupy the slot. Event Hazards
do not occupy a system slot unless an authored rule explicitly attaches them to
the system and persists them as a system Hazard.

## 8. Collision policy

The incoming Hazard creation request owns `collisionPolicy`. It is exactly one
string from this set:

~~~
escalate-existing
replace-existing
trigger-existing-consequence
extend-duration
add-pressure
~~~

Policy-specific authored data is stored in `metadata.collision` and is
required as follows:

| Policy | Required `metadata.collision` data |
| --- | --- |
| `escalate-existing` | Exactly one of `{ targetStageId: NonBlankString }` or `{ escalation: { operationId: NonBlankString } }`. |
| `replace-existing` | The incoming Hazard definition to persist. |
| `trigger-existing-consequence` | The existing Hazard's authored collision consequence. |
| `extend-duration` | A positive safe-integer extension amount. |
| `add-pressure` | A canonical `pressureSystemId` and positive safe-integer `amount`. |

For `escalate-existing`, `metadata.collision` must contain exactly one outer
field: `targetStageId` or `escalation`. The two forms are mutually exclusive.
The `targetStageId` form requires a nonblank exact string. The `escalation`
form requires an own enumerable plain-data object containing exactly one field,
`operationId`, whose value is a nonblank exact string. No extra fields are
allowed at either level. `operationId` is only a stable authored reference in
Milestone 6 Task 1; Task 1 does not resolve, look up, or execute it. Actual
escalation execution belongs to Task 4.

Collision results are:

- `escalate-existing`: escalate the existing Hazard. The incoming Hazard is
  not persisted. The existing Hazard remains active unless its authored
  `escalationConsequence` explicitly transitions it. At maximum escalation,
  execute that consequence or fail closed when none is authored.
- `replace-existing`: remove the existing Hazard from `activeHazards`, persist
  the incoming Hazard as `active`, and preserve an isolated `replaced` audit
  snapshot that sets the existing record's
  `metadata.replacedByHazardId` and normalized top-level `replacedByHazardId`
  to the incoming `hazardId`.
- `trigger-existing-consequence`: execute the existing Hazard's authored
  collision consequence. The incoming Hazard is not persisted. The existing
  Hazard remains active unless the authored consequence resolves or expires it.
- `extend-duration`: do not persist the incoming Hazard. Keep the existing
  Hazard active and add the authored positive amount to its normalized
  duration without exceeding safe-integer bounds.
- `add-pressure`: do not persist the incoming Hazard. Keep the existing Hazard
  active and add the authored positive amount to the named canonical Pressure
  system. Any resulting Pressure Breach is deferred to the normal Pressure
  Breach pipeline and is never resolved recursively during collision
  application.

All collision operations are atomic and produce no second active system Hazard.

Every Hazard has this required normalized duration object:

~~~
{
  mode: "none" | "rounds" | "activations",
  remaining: NonNegativeSafeInteger | null,
  initial: NonNegativeSafeInteger | null,
  decrementTiming: HazardTiming | null
}
~~~

`mode: "none"` requires the numeric fields and `decrementTiming` to be null.
Other modes require non-null `remaining`, `initial`, and `decrementTiming`.

## 9. Escalation representation

Every Hazard has an `escalation` object:

~~~
{
  mode: "none" | "stages" | "countdown",
  currentStageId: String | null,
  stages: [
    {
      stageId: String,
      effect: PlainAuthoredDescriptor,
      ignoredConsequence: PlainAuthoredDescriptor
    }
  ],
  countdown: null | {
    current: NonNegativeSafeInteger,
    initial: NonNegativeSafeInteger,
    decrementTiming: HazardTiming
  },
  maximumEscalationReached: Boolean,
  escalationConsequence: PlainAuthoredDescriptor | null
}
~~~

`mode: "none"` uses `currentStageId: null`, an empty `stages` array, and
`countdown: null`. `mode: "stages"` requires a non-empty ordered stage list
and a current stage. `mode: "countdown"` requires a countdown object and does
not require stages. The contract imposes no universal number of stages or
countdown length.

An escalation that reaches its authored maximum sets
`maximumEscalationReached: true`. Further escalation is rejected or handled by
the authored `escalationConsequence`; it must not silently create an unbounded
new stage.

## 10. Terminal transition data

Every Hazard record includes these required terminal-transition fields:

~~~
resolvedStageId: String | null
resolvedRoundNumber: PositiveSafeInteger | null
terminalReason: String | null
replacedByHazardId: String | null
~~~

Persisted active records require all four fields to be `null`. Terminal
transition snapshots use the same fields with the following rules: resolved,
expired, and replaced snapshots require a non-null `terminalReason`; replaced
snapshots require a non-null `replacedByHazardId`; and resolved and expired
snapshots require `replacedByHazardId: null`.

`resolvedStageId` and `resolvedRoundNumber` are populated when a terminal
transition is associated with a stage and round; otherwise they remain null.

Terminal transition rules are:

- a resolved Hazard is removed after `voyage.hazard-resolved` is emitted;
- an expired Hazard is removed after `voyage.hazard-expired` or
  `voyage.hazard-closeout-consequence-applied` is emitted; and
- a replaced Hazard is removed when the incoming replacement is persisted.
  `voyage.hazard-replaced` preserves the previous record in its isolated audit
  snapshot.

Terminal statuses may exist in event payloads and transition snapshots, but
never in persisted `activeHazards`.

## 11. Milestone 5B integration

The `event.hazard` record from `voyage.pressure-breach-applied` is a
deterministic creation/provenance record, not yet persisted active state.

Milestone 6 converts that record into one `activeHazards` entry by:

1. preserving its deterministic `hazardId`;
2. preserving its `pressureBreachId` and other available provenance;
3. supplying the approved Hazard definition fields;
4. enforcing the one-active-system-Hazard invariant; and
5. adding the converted record to `nextState.activeHazards` as part of the
   existing transaction.

The conversion must not persist the 5B Void Scar proposal. Pressure reset,
the existing revision behavior, and the exact
`voyage.pressure-breach-applied` event shape remain unchanged.

This is the explicit Milestone 5B atomic integration exception: Hazard
persistence occurs inside `applyVoyageEncounterPressureBreachPlan`. It does
not increment revision a second time, emit `voyage.hazard-created`, emit a
second event, change the exact Pressure Breach event shape, or perform a
follow-up state mutation. The existing single revision and single event cover
Hazard persistence, Void Scar proposal emission, and Pressure reset.

### 11A. Pressure-system Hazard definition registry

Milestone 6 Task 3 owns the pure authored definition registry for Pressure-
system Hazards. The registry is keyed by the canonical `pressureSystemId` and
contains exactly one definition for each of:

- `crew-morale`;
- `arkengine`;
- `levstone-array`;
- `solar-sail-rig`; and
- `lifeveil`.

There is no fallback or generic unknown-system definition. A missing, blank, or
unknown `pressureSystemId` fails closed with the deterministic diagnostic
`pressure-breach-hazard-definition-missing`, rooted at the sparse Hazard's
`pressureSystemId` path. The authoritative registry data is deeply frozen and
lookups return isolated mutable plain data. The registry performs no Hazard
behavior, state mutation, event emission, or revision change.

The registry is implemented in
`scripts/voyage/domain/pressure-breach-hazard-definitions.js` with these
internal domain exports:

- `VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS`: the deeply frozen five-entry
  authoritative registry;
- `getVoyagePressureBreachHazardDefinition(pressureSystemId)`: returns
  `{ ok: true, definition, errors: [], warnings: [] }` with an isolated plain
  definition, or `{ ok: false, definition: null, errors, warnings: [] }` with
  the deterministic missing-definition diagnostic.

The sparse Milestone 5B `event.hazard` shape remains unchanged. It continues to
supply deterministic identity, Pressure Breach identity, encounter, stage,
round, effect index, sequence, station and action provenance,
`pressureSystemId`, category, status, source kind, source/provenance fields,
source timing, visibility, and deterministic Hazard name. The registry
supplies only the missing authored gameplay definition fields:
`currentEffect`, `activationTiming`, `removalMethod`, `ignoredConsequence`,
`escalation`, `collisionPolicy`, `metadata.collision`, and `duration`.

Every Pressure-system definition uses this common initial policy:

1. The Hazard activates at the start of the next round.
2. The Hazard remains active until successfully addressed or until encounter
   closeout handles it.
3. The removal method is Address Hazard.
4. An unresolved Hazard applies its authored ignored consequence at encounter
   closeout.
5. A repeated breach of the same Pressure system uses
   `trigger-existing-consequence` against the existing Hazard.
6. Task 3 does not execute that collision. Until Task 4 exists, the occupied
   system-slot check fails closed atomically.
7. The Hazard has no escalation stages or countdown.
8. The Hazard has no automatic duration expiration.
9. No Pressure-system definition uses immediate activation.
10. The sparse source timing value `consequences` remains provenance in
    `sourceTiming`; it does not imply immediate Hazard activation.

The registry descriptor shapes are exact and authored. They do not add numeric
penalties, checks, damage, Momentum changes, station restrictions, or
executable effects:

~~~
currentEffect: {
  effectId: NonBlankString,
  name: NonBlankString,
  description: NonBlankString
}

activationTiming: {
  kind: "start-of-next-round",
  stationId: null,
  resultId: null
}

removalMethod: {
  methodId: "address-hazard",
  name: "Address Hazard"
}

ignoredConsequence: {
  consequenceId: NonBlankString,
  name: NonBlankString,
  description: NonBlankString
}

collisionPolicy: "trigger-existing-consequence"

metadata: {
  collision: {
    consequence: {
      consequenceId: NonBlankString,
      name: NonBlankString,
      description: NonBlankString
    }
  }
}
~~~

The escalation and duration values use the complete normalized `none` forms
from this contract:

~~~
escalation: {
  mode: "none",
  currentStageId: null,
  stages: [],
  countdown: null,
  maximumEscalationReached: false,
  escalationConsequence: null
}

duration: {
  mode: "none",
  remaining: null,
  initial: null,
  decrementTiming: null
}
~~~

The five canonical definitions are:

| `pressureSystemId` | Current effect | Ignored consequence | Repeated-breach consequence |
| --- | --- | --- | --- |
| `crew-morale` | `crew-morale-fracture`; **Crew Morale Fracture** — “The crew remains shaken and under mounting morale strain until the Hazard is addressed.” | `crew-morale-fracture-ignored`; **Crew Morale Fracture Ignored** — “The unresolved morale fracture applies its authored closeout consequence.” | `crew-morale-repeat-breach`; **Crew Morale Repeated Breach** — “A repeated Crew Morale breach triggers the existing Hazard's authored consequence.” |
| `arkengine` | `arkengine-instability`; **Arkengine Instability** — “The Arkengine remains dangerously unstable until the Hazard is addressed.” | `arkengine-instability-ignored`; **Arkengine Instability Ignored** — “The unresolved Arkengine instability applies its authored closeout consequence.” | `arkengine-repeat-breach`; **Arkengine Repeated Breach** — “A repeated Arkengine breach triggers the existing Hazard's authored consequence.” |
| `levstone-array` | `levstone-gravity-shear`; **Levstone Gravity Shear** — “The levstone array remains trapped in dangerous gravitational shear until the Hazard is addressed.” | `levstone-gravity-shear-ignored`; **Levstone Gravity Shear Ignored** — “The unresolved gravity shear applies its authored closeout consequence.” | `levstone-array-repeat-breach`; **Levstone Array Repeated Breach** — “A repeated Levstone Array breach triggers the existing Hazard's authored consequence.” |
| `solar-sail-rig` | `solar-sail-desynchronization`; **Solar-Sail Desynchronization** — “The solar-sail rig remains dangerously desynchronized until the Hazard is addressed.” | `solar-sail-desynchronization-ignored`; **Solar-Sail Desynchronization Ignored** — “The unresolved sail desynchronization applies its authored closeout consequence.” | `solar-sail-rig-repeat-breach`; **Solar-Sail Rig Repeated Breach** — “A repeated Solar-Sail Rig breach triggers the existing Hazard's authored consequence.” |
| `lifeveil` | `lifeveil-collapse`; **Lifeveil Collapse** — “The Lifeveil remains critically unstable until the Hazard is addressed.” | `lifeveil-collapse-ignored`; **Lifeveil Collapse Ignored** — “The unresolved Lifeveil collapse applies its authored closeout consequence.” | `lifeveil-repeat-breach`; **Lifeveil Repeated Breach** — “A repeated Lifeveil breach triggers the existing Hazard's authored consequence.” |

Task 3 resolves the definition and combines it with the sparse creation record,
then captures the complete active record through the Task 1 schema. It executes
no timing, collision, removal, Address Hazard, or closeout behavior. Collision
execution remains Task 4, timing execution remains Task 5, Address Hazard
execution remains Task 6, and ignored-consequence closeout remains Task 7.

### 11B. Task 4A pure Hazard collision analysis

Milestone 6 Task 4A owns only pure, deterministic analysis of an incoming
Hazard against the authoritative active Hazard collection. It identifies a
collision and returns an isolated declarative plan for a later operation. It
does not execute the plan or make any unresolved gameplay decision.

The incoming Hazard owns the `collisionPolicy`, `metadata.collision`, and the
requested collision operation. The existing Hazard supplies its current active
record, escalation state, duration state, current effect, and authored
consequences. Task 4A does not decide which existing consequence is executable.

When no occupied system slot exists, analysis returns a `no-collision` plan
whose recommended later action is `persist-incoming`. Task 4A does not persist
the incoming Hazard; the committed Task 3 path remains responsible for
ordinary persistence.

When a valid incoming system Hazard targets a Pressure-system slot already
occupied by an active system Hazard, analysis returns a `collision` plan with:

- `encounterId`;
- the expected `revision`;
- the incoming Hazard ID;
- the existing Hazard ID and its exact `activeHazards` collection index;
- `pressureSystemId`;
- the incoming `collisionPolicy`;
- an isolated incoming collision payload;
- isolated incoming and existing Hazard snapshots; and
- one recommended operation matching exactly the incoming policy:
  `escalate-existing`, `replace-existing`,
  `trigger-existing-consequence`, `extend-duration`, or `add-pressure`.

Event Hazards never occupy system slots. An event Hazard whose
`failurePressureSystemId` matches a system Hazard therefore does not create a
system collision, and Task 4A does not invent an event-area collision rule.

The analysis plan is declarative only. It does not mutate state, persist or
remove Hazards, execute consequences, change escalation, extend duration, add
Pressure, reset Pressure, increment revision, emit an event, or create a Void
Scar proposal. Later Task 4 phases own escalation execution, replacement
resolution, consequence representation and execution, duration arithmetic,
add-pressure and deferred-Breach handling, and Pressure Breach same-slot
integration.

### 11C. Task 4B1 stage-based Hazard escalation

Milestone 6 Task 4B1 defines only the pure transformation semantics for an
existing active Hazard whose `escalation.mode` is `stages` when an incoming
Hazard requests the `escalate-existing` collision policy. The incoming Hazard
is not persisted during a successful escalation collision.

The existing Hazard owns:

- `escalation.mode`;
- `escalation.currentStageId`;
- the authored-order `escalation.stages` array;
- `escalation.escalationConsequence`;
- `currentEffect` and `ignoredConsequence`; and
- all identity, provenance, duration, and active-record data.

The incoming Hazard owns:

- `collisionPolicy`;
- `metadata.collision`; and
- either the explicit `targetStageId` or the stable `escalation.operationId`
  requested by that collision payload.

#### Authored stage order and explicit targets

When `escalation.mode` is `stages`, the array order of
`escalation.stages` is the authoritative progression order. Every `stageId`
remains unique, and `currentStageId` must identify exactly one authored stage.
The final array entry is the maximum stage. No alphabetical, numeric, or
otherwise inferred ordering is permitted.

For the canonical collision payload:

~~~
{
  targetStageId: NonBlankString
}
~~~

`targetStageId` must identify an authored stage in the existing Hazard and
must occur strictly after the current stage in authored array order. Same-stage
and backward movement are invalid. Forward skipping is permitted only because
the incoming authored payload explicitly names the later target stage; skipped
intermediate stage effects and consequences are not applied automatically.
An unknown target fails closed.

#### Canonical stage operation

For the canonical collision payload:

~~~
{
  escalation: {
    operationId: NonBlankString
  }
}
~~~

Task 4B1 recognizes exactly one operation ID: `advance-one-stage`. It selects
the stage immediately following `currentStageId` in authored array order and
never skips a stage. If no later stage exists, it returns the declarative
maximum-escalation outcome. Unknown operation IDs fail closed. Task 4B1 does
not add advance-to-final-stage, arbitrary offsets, decrement, reset, custom
script, or macro operations.

#### Task 4B2 declarative plan provenance

Every successful Task 4B2 declarative plan, including both `escalation-ready`
and `maximum-escalation` plans, contains the exact plain-data field:

~~~
collisionPolicy: "escalate-existing"
~~~

Task 4B2 copies this field from the safely captured and validated Task 4A
collision plan after confirming both `collisionPolicy` and
`recommendedOperation` are `escalate-existing`. The field is independent
plain-data evidence of the originating collision policy at later safe-data
boundaries. It is not inferred from the existing Hazard's own
`collisionPolicy`, does not authorize another collision operation, and is not
added to the outer analysis result or invalid results.

Manually authored Task 4B2-shaped data must still pass exact plan validation;
the field is not a caller-supplied proof token.

#### Successful stage transformation

A successful stage transformation returns an isolated prospective active
Hazard record. It preserves the same `hazardId`, `encounterId`, category,
active status, name, visibility, source and provenance fields, duration,
collision policy and metadata, Pressure-system or event-area field, and
terminal-null fields.

It updates exactly these top-level fields:

1. `escalation.currentStageId` becomes the selected target stage ID;
2. `currentEffect` becomes an isolated copy of the target stage's `effect`;
3. `ignoredConsequence` becomes an isolated copy of the target stage's
   `ignoredConsequence`; and
4. `escalation.maximumEscalationReached` becomes `true` only when the target
   is the final authored stage, and `false` otherwise.

The transformation does not alter `escalation.stages`,
`escalation.countdown`, `escalation.escalationConsequence`, `activationTiming`,
`removalMethod`, duration, provenance, creation stage/round/sequence,
collision metadata, or Hazard identity. The prospective record must pass the
existing active Hazard schema.

#### Maximum-stage outcome

When the existing Hazard is already at its final authored stage, no Hazard
mutation occurs and the incoming Hazard is not persisted. The result is a
declarative `maximum-escalation` outcome. When
`escalation.escalationConsequence` is present, the outcome carries an isolated
copy of that authored descriptor; when it is `null`, the outcome carries no
consequence descriptor. No consequence is executed, no status transition
occurs, and the existing Hazard remains active. No consequence is invented.

An operation attempted at maximum stage may carry the deterministic
`hazard-stage-escalation-at-maximum` diagnostic as a non-fatal warning; the
maximum outcome is not itself an applied mutation.

#### Invalid escalation modes and diagnostics

If `escalate-existing` targets an existing Hazard whose escalation mode is
`none`, stage transformation is not applicable. It fails closed with the
deterministic `hazard-stage-escalation-mode-unsupported` diagnostic and does
not execute `escalationConsequence`. If the mode is `countdown`, it fails
closed with `hazard-stage-escalation-not-applicable`; countdown collision
semantics remain deferred and no decrement is inferred.

The canonical diagnostic concepts use isolated deterministic issue objects of
the form `{ severity, code, path, message }`:

- `hazard-stage-escalation-mode-unsupported` for a non-stage mode that cannot
  use stage transformation;
- `hazard-stage-escalation-not-applicable` for countdown escalation;
- `hazard-stage-escalation-current-stage-unknown` when the current stage is
  not authored;
- `hazard-stage-escalation-target-stage-unknown` when an explicit target is
  not authored;
- `hazard-stage-escalation-same-stage` for an explicit same-stage target;
- `hazard-stage-escalation-backward` for an explicit backward target;
- `hazard-stage-escalation-operation-unknown` for an unrecognized operation ID;
- `hazard-stage-escalation-at-maximum` for an operation attempted at the
  maximum stage; and
- `hazard-stage-escalation-result-invalid` when the prospective transformed
  record fails active Hazard schema validation.

The maximum-stage diagnostic is a non-fatal warning; invalid and
not-applicable conditions are errors. Paths identify the existing escalation
field or incoming collision payload field that caused the outcome. No raw
JavaScript or Proxy exception text is exposed.

Prospective-validation clarification: the canonical diagnostic code for a
prospective active-Hazard validation failure is
`hazard-stage-escalation-result-invalid`. This is a defensive postcondition
diagnostic. Under the current Task 1 descriptor schema, a fully valid source
Hazard and target stage may make this branch unreachable through the public
API. The branch remains implemented so future schema refinements fail closed.
Direct behavioral coverage is required only when an accepted canonical input
can naturally reach the branch. Tests must not weaken schema validation or
introduce an artificial public test seam merely to force this diagnostic.

Task 4B1 is a pure transformation or declarative-outcome boundary. It does
not mutate encounter state or caller Hazard data, persist the incoming Hazard,
update `activeHazards`, change Pressure or Momentum, reset Pressure, increment
revision, emit events, produce a Void Scar proposal, process activation timing,
perform Address Hazard, process closeout, replace a Hazard, or extend duration.

Later work still owns stage transformation implementation and tests,
application to encounter state, revision and event behavior,
escalation-consequence execution, countdown collision semantics, and Pressure
Breach same-slot integration. Executable consequence architecture remains
deferred to Task 4E.

### 11D. Task 4B3 stage-escalation state application

Milestone 6 Task 4B3 defines the standalone, atomic application of a valid
Task 4B2 `escalation-ready` result to an authoritative Voyage Encounter state.
It validates the live state and declarative plan, applies one approved stage
transformation at the plan's authored collection index, increments revision
once, and emits one `voyage.hazard-escalated` event.

Task 4B3 does not perform collision analysis, select a stage, handle a
maximum-escalation consequence, execute any consequence, process countdown
escalation, integrate Pressure Breach collisions, process timing, perform
Address Hazard, close out, resolve, expire, replace, or extend a Hazard, add
Pressure, persist a Void Scar, or define UI, sockets, authority, persistence
adapters, or Foundry registration.

#### Accepted result and application boundary

The standalone application boundary is conceptually equivalent to:

~~~
applyVoyageHazardStageEscalationPlan(encounterState, escalationResult)
~~~

The JavaScript name remains subject to repository implementation convention;
this contract fixes the behavior and result shape rather than adding a public
API during Task 4B3 contract work.

The application accepts only a Task 4B2 result with:

- `structurallyValid: true`;
- `readyForHazardStageEscalation: true`;
- `outcome: "escalation-ready"`;
- an isolated declarative `plan`; and
- no errors.

The actual committed Task 4B2 plan field for the expected pre-application
snapshot is `previousExistingHazard`. Task 4B3 uses that exact field name; it
does not introduce a `previousHazard` plan alias. The plan must retain the
Task 4B2 shape and values, including `existingHazardIndex`, request details,
`previousExistingHazard`, and `prospectiveHazard`.

The exact accepted plan shape is:

~~~
{
  kind: "escalation-ready",
  encounterId,
  expectedRevision,
  incomingHazardId,
  existingHazardId,
  existingHazardIndex,
  pressureSystemId,
  collisionPolicy: "escalate-existing",
  requestKind,
  requestedTargetStageId,
  requestedOperationId,
  previousStageId,
  targetStageId,
  skippedStages,
  previousExistingHazard,
  prospectiveHazard,
  escalationConsequence: null
}
~~~

`requestKind` is exactly `target-stage` or `operation`. The non-applicable
request field is null, as defined by Task 4B2. The application requires
`collisionPolicy === "escalate-existing"` as an exact plan field. A missing
or different value, or an extra replacement field intended to substitute for
it, fails exact plan validation. The field is copied from the validated Task
4A collision plan; it is not inferred from the existing Hazard's own
`collisionPolicy`.

The application rejects `maximum-escalation`,
`invalid-or-not-applicable`, null results, missing plans, malformed plans,
wrong collision policies, and plans without a prospective Hazard. A
maximum-escalation result is declarative only: it causes no state mutation, no
revision change, no event, and no incoming-Hazard persistence.

#### Safe application boundary

Before semantic reads, the application safely captures and isolates the
encounter state, application result, Task 4B2 plan, previous snapshot,
prospective snapshot, identifiers, and request details using the existing
Milestone 6 safe plain-data boundary and validators.

It rejects accessors, unsafe keys, inherited or non-enumerable required data,
cycles, sparse arrays, symbols, unsupported objects, hostile Proxy reflection
failures, coercion hooks, and other unsafe data. Hostile input is rejected
before normalization or application. No raw JavaScript or Proxy exception
text is exposed, and no partial state or event is returned.

#### State preconditions and stale plans

Application succeeds only when:

1. The encounter state is structurally valid.
2. The state `encounterId` equals the plan `encounterId`.
3. The state `revision` equals `expectedRevision` exactly.
4. The state revision is a non-negative safe integer and
   `revision + 1` remains a safe integer.
5. `existingHazardIndex` is a non-negative safe integer that identifies a
   current entry of `activeHazards`.
6. The indexed live Hazard is active, has category `system`, has
   `hazardId === existingHazardId`, has the plan encounter ID, and has the
   plan `pressureSystemId`.
7. The indexed live Hazard is semantically equal to the isolated
   `previousExistingHazard` snapshot. Semantic safe-data equality means:
   complete recursive equality of safely captured plain-data values;
   identical own enumerable string-key sets at every object level; identical
   array lengths, occupied indexes, and element ordering; primitive equality
   without caller coercion; and no object-identity requirement. Unsupported
   prototype identity is irrelevant after the safe plain-object boundary has
   rejected unsupported prototypes. No Hazard field is ignored: current
   effects, ignored consequences, escalation, duration, metadata, provenance,
   creation fields, category-specific fields, terminal fields, and every other
   Hazard field are included. Symbols, accessors, inherited or non-enumerable
   properties, sparse arrays, unsafe keys, and unsupported values are rejected
   at safe capture and are not equality inputs. Equality must not call
   `toString`, `valueOf`, `Symbol.toPrimitive`, iterators, or user functions;
   it is deterministic and fails closed if either value cannot be safely
   captured or compared.
8. The prospective Hazard is active, has category `system`, has the same
   `hazardId`, encounter ID, and Pressure-system ID as the live Hazard, and
   passes active Hazard validation.
9. The prospective Hazard may differ from `previousExistingHazard` only at
   these four authorized paths:
   `escalation.currentStageId`, `currentEffect`, `ignoredConsequence`, and
   `escalation.maximumEscalationReached`. Values outside these paths must
   remain semantically equal. One or more authorized paths may retain an equal
   value; all four values are not required to differ, and stages may reuse
   semantically identical effect or ignored-consequence descriptors.
10. `incomingHazardId` remains distinct from the active existing Hazard ID.

Any revision mismatch, changed encounter ID, invalid index, moved or missing
Hazard, changed Hazard ID, changed Pressure-system slot, changed live snapshot,
invalid prospective Hazard, unauthorized prospective change, or failed final
state validation is a stale or invalid application. The application must not
search for the Hazard at another index and must not silently reapply a stale
plan. The plan must be recalculated through Task 4A and Task 4B2.

Every failed precondition returns no next state, no event, no revision change,
and no collection mutation.

#### Atomic state transformation

After all preconditions pass, the application constructs an isolated candidate
state and replaces exactly:

~~~
nextState.activeHazards[existingHazardIndex]
~~~

with an isolated copy of `prospectiveHazard`. The incoming Hazard is never
appended or persisted.

The candidate preserves the active-Hazard collection length and order, every
other Hazard, Pressure, Momentum, encounter phase, round and stage context,
and all unrelated encounter fields. The escalated Hazard remains the same
logical active Hazard in the same Pressure-system slot and collection index.

The candidate then sets:

~~~
nextState.revision = previousRevision + 1
~~~

The candidate must pass complete Voyage Encounter state validation. If that
validation fails, the operation returns no candidate state or event. The
caller state, plan, snapshots, collection, Hazards, and nested descriptors are
never mutated.

#### Result shape

The application follows the existing Voyage transition/application result
convention:

~~~
{
  ok: true,
  nextState: isolatedNextState,
  events: [isolatedHazardEscalatedEvent],
  errors: [],
  warnings: []
}
~~~

Failed application:

~~~
{
  ok: false,
  nextState: null,
  events: [],
  errors: isolatedDeterministicErrors,
  warnings: []
}
~~~

No partial candidate, event, or revision output is exposed on failure.

#### `voyage.hazard-escalated` event

A successful standalone Task 4B3 application emits exactly one event of the
existing committed type `voyage.hazard-escalated`. It emits no Hazard-created,
consequence-triggered, Pressure-Breach, generic-collision, or revision-only
event.

The event has exactly this shape for both request forms:

~~~
{
  type: "voyage.hazard-escalated",
  encounterId,
  hazardId,
  pressureSystemId,
  incomingHazardId,
  collisionPolicy: "escalate-existing",
  previousRevision,
  revision,
  previousStageId,
  targetStageId,
  requestKind,
  requestedTargetStageId,
  operationId,
  skippedStages,
  previousHazard,
  hazard
}
~~~

`encounterId` comes from the validated live state and matching plan.
`hazardId` is the existing and prospective Hazard ID.
`pressureSystemId` is the occupied system slot. `incomingHazardId` identifies
the collision source that was not persisted. `previousRevision` is the input
revision and `revision` is exactly one greater.

The event `collisionPolicy` is copied from the validated Task 4B2 plan and is
therefore exactly `"escalate-existing"`; it is not an unsupported hardcoded
inference.

`previousStageId`, `targetStageId`, `requestKind`,
`requestedTargetStageId`, `operationId`, and `skippedStages` come from the
validated Task 4B2 plan. `requestKind` is exactly `target-stage` or
`operation`; `requestedTargetStageId` is null for operation requests;
`operationId` is `advance-one-stage` for operation requests and null for
target-stage requests.

`previousHazard` is an isolated pre-application active snapshot derived from
`previousExistingHazard`. `hazard` is an isolated post-application active
snapshot derived from the candidate state. Both snapshots contain the exact
validated Hazard shape.

The event, next state, plan snapshots, caller state, and separate application
results must not share mutable references. Mutating `event.previousHazard`,
`event.hazard`, or `nextState.activeHazards` must not mutate any other returned
or caller-owned structure.

#### Application diagnostics

Failures use isolated deterministic issues of the form
`{ severity, code, path, message }`. The canonical proposed codes are:

- `hazard-stage-escalation-application-data-read-failed` for hostile or
  unreadable application input;
- `hazard-stage-escalation-application-state-invalid` for invalid encounter
  state;
- `hazard-stage-escalation-application-plan-invalid` for malformed or
  inconsistent Task 4B2 plans;
- `hazard-stage-escalation-application-not-ready` for non-
  `escalation-ready` results;
- `hazard-stage-escalation-application-encounter-mismatch` for differing
  encounter IDs;
- `hazard-stage-escalation-application-revision-mismatch` for stale revision;
- `hazard-stage-escalation-application-index-invalid` for an invalid or
  unusable `existingHazardIndex`;
- `hazard-stage-escalation-application-live-hazard-mismatch` for a missing or
  mismatched live Hazard;
- `hazard-stage-escalation-application-snapshot-mismatch` when the live
  snapshot differs from `previousExistingHazard`;
- `hazard-stage-escalation-application-prospective-invalid` for an invalid
  prospective active Hazard;
- `hazard-stage-escalation-application-change-set-invalid` for unauthorized
  prospective changes;
- `hazard-stage-escalation-application-revision-overflow` when the single
  revision increment is not safe; and
- `hazard-stage-escalation-application-result-state-invalid` when the complete
  candidate state fails final validation.

No failure event is emitted. Paths identify the state, result, plan, indexed
Hazard, snapshot, prospective Hazard, revision, or candidate state that caused
the failure.

#### Standalone and embedded transaction boundaries

Standalone Task 4B3 application owns exactly one revision increment and one
`voyage.hazard-escalated` event. A later Pressure Breach integration must not
call this standalone wrapper if doing so would create a second revision or
second event. It must reuse the pure validated transformation boundary inside
its existing atomic transaction.

The existing exact `voyage.pressure-breach-applied` event remains protected.
Task 4B3 does not change Pressure Breach behavior and does not add flags such
as `suppressEvent`, `suppressRevision`, `embeddedMode`, or
`pressureBreachMode`.

#### Collection, lifecycle, and deferred ownership

After successful application:

- `activeHazards` length and order are unchanged;
- the escalated Hazard remains active at the same index and system slot;
- no terminal snapshot is produced;
- no Hazard is resolved, expired, or replaced;
- no incoming Hazard is persisted; and
- one-active-system-Hazard-per-slot validation continues to hold.

Task 4B3 leaves later ownership of implementation and focused tests,
maximum-escalation consequence processing, countdown semantics, replacement,
duration extension, trigger-existing-consequence execution, add-pressure and
deferred Breaches, Pressure Breach same-slot integration, timing, Address
Hazard, closeout, and lifecycle transitions unchanged.

The operation is deterministic, fail-closed, isolated, atomic, one-revision,
and one-event. Repeated equivalent valid inputs produce deeply equivalent
results, and separate calls do not alias.

## 12. Validation contract

Hazard validation is exact and fail-closed. It must:

- reject unexpected top-level Hazard fields;
- require own enumerable data properties;
- recursively allow only null, booleans, finite numbers, strings, dense
  arrays, and plain objects in descriptors and metadata;
- reject accessors, symbols, unsafe keys, cycles, sparse arrays, `undefined`,
  functions, non-finite numbers, and non-plain objects;
- require unique `hazardId` values within `activeHazards`;
- reject any persisted `activeHazards` record whose status is not `"active"`;
- require each record's `encounterId` to match the containing encounter;
- require `pressureSystemId` and `failurePressureSystemId` to use canonical
  Pressure system IDs when non-null;
- require category-specific prohibited fields to be present with `null`, not
  omitted; and
- normalize every provenance field to a present own enumerable field using
  `null` when absent.

## 13. Atomic mutation and event contract

Every successful Hazard mutation must:

- clone the candidate state;
- mutate only the candidate;
- increment `revision` exactly once;
- emit exactly one domain event;
- validate the complete candidate state before returning it; and
- return isolated event and state data.

The proposed event types are:

~~~
voyage.hazard-created
voyage.hazard-escalated
voyage.hazard-replaced
voyage.hazard-consequence-triggered
voyage.hazard-duration-extended
voyage.hazard-resolved
voyage.hazard-expired
voyage.hazard-closeout-consequence-applied
~~~

Each event includes the existing common audit envelope:

~~~
{
  type,
  encounterId,
  hazardId,
  previousRevision,
  revision
}
~~~

The operation-specific payload must be isolated and must not expand existing
Milestone 5B public return contracts. Failed operations return no candidate
state and no partial events.

## 14. Timing planner

Hazard timing uses the exact discriminated `HazardTiming` object defined in
Section 6.

A central pure timing planner evaluates eligible active Hazards against an
explicit timing context. Planning does not mutate state, emit events, or apply
effects. A separate authorized application operation performs the atomic
mutation.

Immediate behavior occurs only when the authored Hazard explicitly uses the
`immediate` timing.

## 15. Address Hazard action

Addressing a Hazard normally replaces the eligible station's regular action.
The default outcome contract is:

| Result | Default behavior | Round units |
| --- | --- | --- |
| Critical Success | Resolve the Hazard and apply its authored benefit. | 2 success |
| Success | Resolve the Hazard. | 1 success |
| Failure | Retain the Hazard and add 1 Pressure to its failure Pressure system. | 1 failure |
| Critical Failure | Retain the Hazard and add 2 Pressure to its failure Pressure system. | 2 failure |

A system Hazard uses its `pressureSystemId`. An addressable event Hazard must
provide `failurePressureSystemId` as a canonical Pressure system ID. An event
Hazard without that field is not eligible for the default Address Hazard
action. The engine never infers a Pressure target from `eventAreaId`.

Authored rules may replace or extend these outcomes only through the normal
validated authored-effect mechanisms. There is no universal Focus, upgrade,
or Risk Bid bypass outside those mechanisms.

## 16. Closeout behavior

Resolved Hazards produce no further effect.

Unresolved active Hazards apply their authored `ignoredConsequence` at event
closeout. After successful application, the operation emits exactly one
`voyage.hazard-closeout-consequence-applied` event containing an isolated
snapshot of:

- the Hazard before removal;
- `hazardId` and `encounterId`;
- closeout `stageId` and `roundNumber` context;
- `terminalReason: "event-closeout"`;
- the applied `ignoredConsequence`;
- `previousRevision`; and
- `revision`.

The operation then removes the Hazard record from `nextState.activeHazards`,
increments revision exactly once for the complete closeout operation, and
returns the new state. The removed Hazard cannot be processed again because it
is no longer present in authoritative active state.

Full closeout preview, GM approval, and persistent ship application remain
Milestone 10 responsibilities. Active Void Scar persistence remains Milestone
7 responsibility.

## 17. Explicit exclusions

Milestone 6 does not implement:

- active Void Scar storage;
- hull Scar capacity;
- Scar repair;
- permanent ship effects;
- Catastrophic Breakdown;
- rewards or Misfortunes;
- UI;
- sockets;
- persistence adapters;
- public module API registration unless separately authorized; or
- complete encounter closeout orchestration.

It also does not change Pressure gain/loss rules, Momentum rules, PF2e
contracts, or the existing Milestone 5B event contract except at the explicitly
authorized Hazard-state integration boundary.

## 18. Recommended implementation tasks

Each task is intended to be implemented, tested, reviewed, committed, and
authorized separately.

### Task 1  -  Hazard constants, schema, and validation

Anticipated production files:

- `scripts/voyage/domain/constants.js`;
- new `scripts/voyage/domain/hazard-schema.js`;
- `scripts/voyage/domain/validation.js`.

Focused tests:

- new `tests/voyage/domain/hazard-schema.test.mjs`;
- relevant existing state/validation tests.

Freeze exact keys, categories, statuses, visibility, provenance, system/event
discrimination, null category fields, terminal fields, exact `HazardTiming`,
duration, and recursive hostile-data validation.

### Task 2  -  Active Hazard state collection

Anticipated production files:

- `scripts/voyage/domain/defaults.js`;
- `scripts/voyage/domain/state.js`;
- `scripts/voyage/domain/validation.js`.

Focused tests:

- new `tests/voyage/domain/active-hazards-state.test.mjs`;
- `tests/voyage/domain/state-foundation.test.mjs`.

Add `activeHazards` to normalized temporary encounter state while preserving
all existing collection and hostile-data contracts. Test unique IDs, matching
encounter IDs, rejection of persisted terminal-status records, and no
source-state mutation.

### Task 3  -  Pressure Breach Hazard-state integration

Anticipated production files:

- new `scripts/voyage/domain/hazard-application.js`;
- `scripts/voyage/domain/pressure-breach.js` only for the narrow integration
  adapter.

Focused tests:

- new `tests/voyage/domain/hazard-application.test.mjs`;
- `tests/voyage/domain/pressure-breach-hazard.test.mjs`;
- `tests/voyage/domain/pressure-breach-application.test.mjs`.

Convert `event.hazard` into `nextState.activeHazards` inside
`applyVoyageEncounterPressureBreachPlan`. Preserve identity and provenance,
retain the exact 5B event shape, and prove one revision, one event, no follow-up
mutation, no Void Scar persistence, and no second `voyage.hazard-created`
event.

### Task 4  -  Collision and escalation operations

Anticipated production files:

- new `scripts/voyage/domain/hazard-collision.js`;
- new `scripts/voyage/domain/hazard-escalation.js`;
- `scripts/voyage/domain/hazard-application.js`.

Focused tests:

- new `tests/voyage/domain/hazard-collision.test.mjs`;
- new `tests/voyage/domain/hazard-escalation.test.mjs`.

Implement incoming-request ownership, all five collision results, normalized
duration updates, staged escalation, countdown limits, replacement metadata,
safe-integer bounds, and exact one-event/one-revision atomicity. Prove that
replacement removes the old Hazard and persists the incoming Hazard, that the
audit event preserves the old record, and that an `add-pressure` collision
defers any resulting Breach to the normal pipeline.

These tests must also prove that resolving a Hazard emits its resolution event
and removes it atomically from `activeHazards`.

### Task 5  -  Hazard timing and projections

Anticipated production files:

- new `scripts/voyage/domain/hazard-timing.js`;
- new `scripts/voyage/domain/hazard-projection.js`.

Focused tests:

- new `tests/voyage/domain/hazard-timing.test.mjs`;
- new `tests/voyage/domain/hazard-projection.test.mjs`.

Implement pure timing planning using the exact discriminated object and public/
GM projections. No UI, socket, or public API work is included.

### Task 6  -  Address Hazard action

Anticipated production files, limited to the integration points proven
necessary by the focused tests:

- `scripts/voyage/domain/action-outcome-interpretation.js`;
- `scripts/voyage/domain/resolution-execution-requests.js`;
- `scripts/voyage/domain/pressure.js`;
- `scripts/voyage/domain/hazard-application.js`.

Focused tests:

- new `tests/voyage/domain/address-hazard.test.mjs`;
- relevant action-outcome and resolution-execution-request regressions.

Implement action replacement, four default outcomes, success/failure units,
system-Hazard targeting, event-Hazard `failurePressureSystemId` eligibility,
and authored-effect extension only. Prove that `eventAreaId` is never used as
a Pressure target.

### Task 7  -  Hazard closeout-local behavior

Anticipated production files:

- new `scripts/voyage/domain/hazard-closeout.js`;
- `scripts/voyage/domain/hazard-application.js`.

Focused tests:

- new `tests/voyage/domain/hazard-closeout.test.mjs`.

Apply unresolved Hazard consequences once, emit one isolated terminal snapshot,
remove the Hazard record from `activeHazards`, increment revision once, prove a
removed Hazard cannot trigger twice, and preserve Milestone 10's closeout
orchestration boundary.

The focused tests must assert one closeout event, removal of the unresolved
Hazard, terminal snapshot isolation, the exact `terminalReason`, and that a
second closeout attempt cannot process the removed Hazard.

### Task 8  -  Cumulative Milestone 6 integration review

Anticipated production changes: none unless an actual focused regression defect
is found.

Focused and regression tests:

- all new Hazard tests;
- all Pressure and Pressure Breach tests;
- all 732 Voyage domain tests;
- all 145 Voyage PF2e tests;
- combined Voyage suites.

## 19. Compatibility risks and safeguards

`scripts/voyage/domain/pressure-breach.js` is currently 1,351 lines. It
contains hostile-data capture, breach planning, Hazard creation-record
construction, Void Scar proposal construction, atomic Pressure application,
revision handling, and event construction.

Milestone 6 must not expand that file with collision, escalation, timing,
projection, or closeout policy. Those concerns belong in focused Hazard
modules. The breach file should receive only a narrow integration adapter, if
needed.

The following contracts are protected:

- exact `voyage.pressure-breach-applied` event shape;
- deterministic 5B `hazardId` values;
- Pressure reset behavior;
- no Void Scar persistence;
- current 732 domain-test baseline;
- current 145 PF2e-test baseline; and
- current 877 combined-test baseline.

Before implementation, review this proposed contract against the canonical
documents and resolve any disagreement explicitly. No production JavaScript,
tests, UI, sockets, persistence adapter, or public API is authorized by this
Task 0 document.
