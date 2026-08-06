# Arcflight Gameplay V3 Milestone 9 — Catastrophic Breakdown and Emergency Response

**Status:** Standalone implementation contract for Milestone 9. This document
authorizes pure-domain validation, capture, and analysis only. It authorizes no
production or test file by itself.

**Canonical source authority:**

1. The completed standalone Milestone 6 Hazard Engine contract at
   `docs/codex/ARCFLIGHT_GAMEPLAY_V3_MILESTONE_6_HAZARD_ENGINE_CONTRACT.md`.
2. The completed standalone Milestone 7 Void Scars, Hull Capacity, and Repair
   contract at
   `docs/codex/ARCFLIGHT_GAMEPLAY_V3_MILESTONE_7_VOID_SCARS_HULL_REPAIR_CONTRACT.md`.
3. The completed standalone Milestone 8 Event Result, Rewards, and Misfortunes
   contract at
   `docs/codex/ARCFLIGHT_GAMEPLAY_V3_MILESTONE_8_EVENT_RESULT_REWARDS_MISFORTUNES_CONTRACT.md`.
4. The canonical roadmap at
   `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`.

When sources conflict, the order is normative: completed M6–M8 standalone
contracts govern their owned boundaries; the canonical milestone map governs
M9 intent where no completed standalone contract owns the behavior; this M9
contract defines previously missing M9 details; and M9 may not redefine or
weaken M6, M7, M8, M10, M11, or M12 authority.

## 1. Purpose and scope

The roadmap names Milestone 9 “Catastrophic Breakdown and Emergency Response”
and requires it to respond when an additional ordinary Void Scar would exceed
live capacity (canonical roadmap, section 8, Milestone 9). The M7 contract
defines exact capacity arithmetic and defers Catastrophic Breakdown to M9
(M7, sections 7, 17, and 18). The M8 contract requires M10 to revalidate and
approve result packages and to hand only an M10-established capacity-exhaustion
condition to M9 (M8, sections 23, 30, and 31).

Milestone 9 owns only:

- receiving an exact capacity-exhaustion condition established by M10;
- Catastrophic Breakdown analysis;
- preventing creation of the overflowing Scar;
- targeting and disabling the affected ship system;
- proposing one mandatory authored Catastrophic Hazard;
- proposing the required pause after the current segment;
- defining and analyzing the authored Emergency Response;
- producing stabilization or authored failure consequences; and
- returning isolated proposals for M10-controlled approval and persistence.

Milestone 9 does not own:

- ordinary M8 reward or Misfortune calculation;
- ordinary Scar proposal review;
- live Scar-capacity discovery;
- fabrication of a capacity-exhaustion condition;
- persistent Scar, Hazard, system, inventory, resource, Hull, session, or ship
  mutation;
- GM approval;
- Foundry writes;
- PF2e writes;
- sockets or multiplayer transport;
- request IDs;
- stale or duplicate command rejection;
- runtime recovery;
- UI;
- ordinary event travel;
- direct repair; or
- automatic re-enablement of a disabled system.

Every public M9 API is Foundry-free, PF2e-free, deterministic, synchronous,
pure, and safe for arbitrary JavaScript input. A successful result is an
isolated proposal, never an application or approval token.

## 2. Normative authority boundaries

Milestone 9 MUST NOT infer, calculate, or fabricate live Void Scar capacity
exhaustion from caller-authored ship data. Its public Catastrophic Breakdown
boundary accepts only an exact capacity-exhaustion handoff established by
Milestone 10 after Milestone 10 has regenerated or revalidated the relevant
calculation, live identity, live revision, and live capacity.

An M8 `scarConsequenceProposal` is descriptive proposal data only and MUST NOT
be supplied directly to Milestone 9. Milestone 10 owns ordinary Scar review
and establishes whether approved application would exceed live capacity.

When a valid capacity-exhaustion handoff is accepted, Milestone 9 MUST propose
Catastrophic Breakdown instead of proposing, creating, appending, or reserving
another Void Scar.

Every Milestone 9 public API is pure. A successful envelope is an isolated
deterministic proposal and is not an application token, approval token,
persistence instruction, runtime command, or proof that the referenced live
state remains current.

M10 MUST revalidate live identity and revision before applying any Milestone 9
proposal and remains the sole owner of GM approval, persistent application,
Foundry writes, and durable idempotency.

Milestone 11 owns active-GM authority, command and request envelopes, unique
request IDs, stale and duplicate command rejection, transport, reload recovery,
and control transfer. Milestone 9 MUST NOT duplicate those runtime
responsibilities.

Because Milestone 10 is not implemented yet, Milestone 9 tests may construct
plain canonical capacity-exhaustion descriptors as fixtures that satisfy the
M10-to-M9 handoff contract. These fixtures test only Milestone 9 capture,
validation, binding, applicability, and deterministic proposal generation.
They do not simulate, replace, prove, or authorize Milestone 10 live-state
discovery, live revision validation, GM approval, persistent application,
atomic writes, or durable idempotency. No M10 API call is required by M9 Tasks
1–4; integrated runtime flow remains unavailable until M10 exists. Fixture
construction does not weaken the rule that M10 establishes exhaustion.

M9 never calls M7 repair, never consumes a Field Repair Resource, never
fabricates an M6 Pressure Breach source, and never executes an M8 reward,
Misfortune, or combined result-package analyzer.

## 3. Trigger and gameplay semantics

Catastrophic Breakdown is applicable only when every condition below is true:

1. M10 supplied an exact `voyage.m10-capacity-exhaustion` handoff.
2. The handoff identifies one existing affected system.
3. Occupied Scar count equals live Scar capacity.
4. One ordinary Scar proposal approved by M10 for inclusion in closeout
   composition would exceed that capacity.
5. The incoming proposal has not already been applied.
6. Task 2 event, session, and system identities bind exactly; the handoff
   definition snapshot, ship, and revision values are structurally valid
   evidence, with their live identity revalidation owned by M10.

A handoff showing unused capacity is invalid and cannot produce a Breakdown
proposal. A handoff with occupied count above capacity is also invalid because
M7 defines a valid ship state as never exceeding effective capacity (M7,
section 7).

A valid Breakdown proposal:

- adds no Scar;
- targets exactly the affected system identified by the handoff;
- proposes that system as disabled;
- includes exactly one authored mandatory Catastrophic Hazard;
- proposes pausing normal action resolution after the current segment;
- identifies exactly one authored Emergency Response definition;
- requires GM approval; and
- preserves source event, session, definition snapshot, ship, system, and
  revision identities.

Emergency Response uses the M8 round-history vocabulary and calculation by
reference. It does not call M8 reward, Misfortune, or result-package APIs. Its
odd round count prevents ties; a critical-round-success and round-success each
count as one successful round, and a critical-round-failure and round-failure
each count as one failed round. The winning threshold is
`(roundCount + 1) / 2`. A response is `emergency-stabilized` when successful
rounds meet the threshold and `emergency-failed` otherwise. There is no
separate overall critical response degree.

The supported round counts are exactly `[3, 5, 7, 9, 11]`. Every round
contributes exactly once and critical results have no additional weight:

```js
winningThreshold = (roundCount + 1) / 2;

successfulRoundCount =
  count("round-success") + count("critical-round-success");

failedRoundCount =
  count("round-failure") + count("critical-round-failure");

overallResult =
  successfulRoundCount >= winningThreshold
    ? "emergency-stabilized"
    : "emergency-failed";

emergencyResponseResult = {
  overallResult,
  roundCount,
  winningThreshold,
  successfulRoundCount,
  failedRoundCount
};
```

`successfulRoundCount + failedRoundCount === roundCount`; no tie is possible,
no critical overall degree exists, and no reward points, failure points, Reward
Steps, Negative Steps, Momentum conversion, or M8 combined analyzer is used.
`overallResult` is the scalar outcome string. `emergencyResponseResult` is the
isolated calculation object and always contains the five keys above on success;
the analysis-envelope field is `null` on failure. No section uses
`emergencyResponseResult` to mean a scalar string.

Emergency Response success:

- stabilizes the catastrophe;
- returns `hazardDisposition: "contained"` only;
- leaves the affected system disabled unless a later separately approved repair
  re-enables it;
- creates no repair;
- restores no Hull Integrity;
- removes no existing Scar;
- creates no new Scar;
- consumes no Field Repair Resource;
- grants no reward, Momentum, Void Fortune, clue, salvage, or discovery; and
- returns an authored next-state proposal suitable for M10 review.

Emergency Response failure:

- ends the Emergency Response;
- ends the originating ordinary event;
- produces exactly one authored consequence path;
- uses only one of the four closed consequence kinds defined below;
- never creates an unauthored retry loop;
- never silently resumes ordinary event resolution; and
- returns an isolated proposal for M10 review and application.

Stabilization is not repair. Containment is not re-enablement. A disabled
system is not destroyed unless the authored catastrophic consequence explicitly
uses the `loss` kind.

`pausePlan.resumeCondition` is descriptive proposal data for Milestone 10
transition review. It is not a runtime command and does not automatically
resume ordinary event resolution. Milestone 9 never resumes an event,
advances a segment, closes a session, re-enables a disabled system, clears a
pause, or writes runtime state. After Emergency Response analysis, both
stabilization and failure return an authored next-state proposal for Milestone
10 review. Runtime continuation requires later approved application and
remains outside Milestone 9.

The contract distinction is invariant:

```text
stabilized !== repaired
contained !== re-enabled
disabled system !== destroyed system unless explicitly authored
```

## 4. Reuse of M6 and M7 boundaries

### 4.1 M6 Hazard reuse

M9 reuses `validateVoyageHazardRecord` and
`captureVoyageHazardRecord` from the M6 contract (M6, sections 1, 3, and 7).
M9 does not copy or fork the M6 schema. `catastrophicHazard` is a complete
M6 active Hazard record with the exact M6 `HAZARD_FIELDS` order:

```js
{
  hazardId,
  encounterId,
  category,
  status,
  name,
  currentEffect,
  activationTiming,
  removalMethod,
  ignoredConsequence,
  visibility,
  sourceKind,
  createdStageId,
  createdRoundNumber,
  createdSequence,
  escalation,
  collisionPolicy,
  duration,
  failurePressureSystemId,
  resolvedStageId,
  resolvedRoundNumber,
  terminalReason,
  replacedByHazardId,
  metadata,
  pressureSystemId,
  eventAreaId,
  pressureBreachId,
  stationId,
  actionId,
  pressureEffectId,
  sourceIntentId,
  activationSource,
  branch,
  sourceTiming,
  sourceVisibility
}
```

M9 additionally restricts the captured descriptor as follows:

- `category` is exactly `"system"`;
- `status` is exactly `"active"`;
- `pressureSystemId` equals the definition and handoff `systemId`;
- `failurePressureSystemId` equals `pressureSystemId`;
- `eventAreaId` is `null`;
- `sourceKind` is exactly `"m9-catastrophic-breakdown"`;
- `collisionPolicy` is exactly `"trigger-existing-consequence"`;
- `metadata.collision.consequence` is a non-empty plain descriptive object;
- `encounterId` equals the handoff `eventId`; and
- all other M6 field, timing, escalation, duration, provenance, visibility,
  and hostile-data rules remain unchanged.

The collision consequence is descriptive only. M9 never invokes the M6
collision application boundary, executes `ignoredConsequence`, or emits an M6
Hazard event. The wrapper adds only the M9 source and affected-system binding;
it does not duplicate M6 validation.

### 4.2 M7 capacity and repair reuse

M10 uses `analyzeVoyageVoidScarCapacity(shipState)` from M7 (M7, sections 7,
13, and 18) before constructing the M9 handoff. M9 validates the handoff’s
arithmetic and identities but never queries live ship state and never
recalculates capacity from a ship document.

M7 owns the durable ship-state shape, active Scar collection, and pure repair
boundary. M9 does not invoke `analyzeVoyageVoidScarRepair` or
`applyVoyageVoidScarRepair`; stabilization does not remove or repair a Scar.
Field Repair Resource remains an authored M8 reward descriptor and M7 repair
boundary, outside M9. M9 cannot fabricate the M7 Pressure Breach source because
M7 creation accepts only internally regenerated approved M6 proposal evidence.

The affected system binds by exact JavaScript string equality across
`capacityExhaustion.systemId`, `breakdownDefinition.systemId`,
`breakdownDefinition.catastrophicHazard.pressureSystemId`, and the generated
plan. No name, display label, prefix, or fuzzy comparison is permitted.

## 5. Identity and hostile-data rules

All strings are nonblank UTF-16 strings with surrounding whitespace rejected.
All arrays are dense own-entry arrays. Objects are plain objects with either
`Object.prototype` or a null prototype. Hostile data includes getters, setters,
accessor descriptors, accessor traps, revoked Proxies, Proxy reflection
failures, cycles, symbol keys, symbol values, functions, BigInt values,
nonfinite numbers, unsafe keys, non-enumerable own keys, inherited enumerable
keys used as apparent schema fields, arrays with extra own keys, sparse arrays,
Date, Map, Set, class instances, Foundry documents, PF2e objects, and every
other nonplain object. `__proto__`, `constructor`, and `prototype` are unsafe
keys. Reflection failures from `Array.isArray`, `Object.getPrototypeOf`,
`Reflect.ownKeys`, `Object.getOwnPropertyDescriptor`, and corresponding safe
capture operations are hostile failures.

No public API throws for any JavaScript input. Ordinary JSON-compatible roots
of the wrong type, including `null`, strings, finite numbers, booleans, and
ordinary arrays where an object is required, produce the API's ordinary
exact-shape diagnostic rather than a hostile-data diagnostic. Every hostile
input is rejected without throwing and produces
`m9-hostile-data-capture-failed` at path `$`. Capture never retains a hostile
reference.
An `undefined` value at any captured position is hostile and produces
`m9-hostile-data-capture-failed` at path `$`. An acyclic shared reference is
accepted. Capture recursively copies each occurrence into the fresh isolated
plain-data graph; the resulting occurrences do not retain caller reference
identity and need not remain aliased. Only an ancestor-cycle, inaccessible
value, reflection failure, accessor, unsafe key, unsupported value type, or
otherwise prohibited hostile value causes hostile-data capture failure. Shared
reference identity has no validation, binding, approval, application, or
persistence authority. Capture distinguishes an object encountered again
through a completed sibling path from an object encountered again while it is
still in the active ancestor chain; only the latter is a cycle.
Every returned object and array is deeply isolated from input, prior results,
and later results. Inputs are never mutated. No API reads time, randomness,
locale, environment, Foundry, PF2e, or global mutable state.

Any identity composed from two or more independently authored components MUST
use a component-safe tuple representation such as
`JSON.stringify([component1, component2, ...])` or nested Maps/Sets. Delimiter
concatenation is prohibited. Embedded-NUL collision regressions are required
for every authoritative compound identity.

## 6. Capacity-exhaustion handoff

The exact M10-to-M9 handoff has these keys in this order:

```js
{
  kind: "voyage.m10-capacity-exhaustion",
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  systemId,
  systemKind,
  liveRevision,
  scarCapacity,
  occupiedScarCount,
  incomingScarProposalId,
  incomingScarProposalKind,
  incomingScarProposalStatus
}
```

The following exact shape is the complete canonical M10-to-M9
capacity-exhaustion descriptor. No omitted, additional, reordered, or
alternative field is permitted. `systemKind` and `incomingScarProposalKind`
are the only Milestone 9 discriminator fields added to this canonical
handoff. No other handoff field is permitted. They are necessary to bind the
trigger requirements that the incoming proposal is an ordinary Void Scar and
has not already been applied. `incomingScarProposalKind` is exactly
`"ordinary-void-scar"` at the applicability category; a different nonblank
kind is `m9-breakdown-not-applicable`. `incomingScarProposalStatus` is a
nonblank exact string and must be exactly `"approved-unapplied"` in the
handoff structure.

M10 has approved the ordinary Scar proposal for inclusion in the closeout
transaction, but `incomingScarProposalStatus: "approved-unapplied"` is
descriptive handoff evidence only. It is not an approval token, application
token, persistence instruction, or authorization for Milestone 9 to apply
either the ordinary Scar or a Catastrophic Breakdown proposal.

Milestone 9 validates only the captured descriptor and produces a pure isolated
proposal. Milestone 10 must separately revalidate the live identity and
revision, approve the resulting Milestone 9 proposal, and atomically apply the
final closeout transaction. A valid capacity-exhaustion descriptor proves only
that Milestone 10 established the exhaustion condition during closeout
composition. Possession of the descriptor does not authorize application.

Every identity is a nonblank exact string. `systemKind` is exactly
`"pressure-system"`. `liveRevision`, `scarCapacity`, and `occupiedScarCount`
are nonnegative safe integers. `occupiedScarCount` equals `scarCapacity`.
`incomingScarProposalId`, `incomingScarProposalKind`, and
`incomingScarProposalStatus` are nonblank exact strings. `scarCapacity: 0`
with `occupiedScarCount: 0` is a valid exhausted handoff when all other fields
are valid and one incoming ordinary Scar proposal would exceed that zero
capacity. `occupiedScarCount > scarCapacity` is invalid and never represents a
valid exhaustion handoff. The descriptor contains no full ship document,
mutable proposal, caller-authored capacity calculation, approval token,
application token, timestamp, random ID, function, Map, Set, class instance,
Foundry document, Actor, Item, or socket.

`systemKind` and `incomingScarProposalKind` are Milestone 9 handoff
discriminators, not fields added to an M7 Void Scar or capacity result. M10 may
populate `systemKind` only from the canonical M7 Pressure-system identity
vocabulary (`crew-morale`, `arkengine`, `levstone-array`, `solar-sail-rig`,
and `lifeveil`). M10 may populate `incomingScarProposalKind` only as the exact
M9 discriminator value `"ordinary-void-scar"` from the canonical M7/M8 ordinary
Void Scar proposal provenance accepted by the M10 closeout contract. Milestone
9 does not translate, infer, broaden, or invent either vocabulary.

Handoff capture returns:

```js
{ ok, capacityExhaustion, errors, warnings }
```

with exact keys, `capacityExhaustion: null` on failure, and `warnings: []`.
The descriptor is isolated input evidence, not a live-state guarantee.

## 7. Authored definition schemas

### 7.1 Catastrophic Breakdown Definition

The exact definition keys are:

```js
{
  schemaVersion,
  breakdownDefinitionId,
  systemId,
  systemKind,
  title,
  description,
  catastrophicHazard,
  pausePlan,
  emergencyResponseDefinition
}
```

`schemaVersion` is `1`; `systemKind` is `"pressure-system"`; all identities and
visible text are nonblank strings. `systemId` is one of the five M6 canonical
Pressure systems. `pausePlan` has exactly:

```js
{
  timing: "after-current-segment",
  resumeCondition: "emergency-response-resolved"
}
```

`emergencyResponseDefinition` is the complete nested definition in section
7.2. Its `breakdownDefinitionId` and `systemId` must match the containing
definition exactly. The nested identity is the only Emergency Response
definition selected by this Breakdown Definition.

### 7.2 Emergency Response Definition

The exact nested definition keys are:

```js
{
  schemaVersion,
  emergencyResponseDefinitionId,
  breakdownDefinitionId,
  systemId,
  systemKind,
  title,
  description,
  roundCount,
  rounds,
  stabilizationOutcome,
  failureConsequences,
  nextSituations
}
```

`schemaVersion` is `1`; `roundCount` is one of `3`, `5`, `7`, `9`, or `11`;
`rounds` is a dense array of exactly `roundCount` records with keys
`roundId`, `roundNumber`, where round numbers are densely ordered from one.
`failureConsequences` has exactly one entry. `nextSituations` has exactly one
M8-compatible descriptor with keys `nextSituationId`, `title`, `summary`, and
`transitionKind`; its transition kind is one of `retreat`, `diversion`,
`emergency`, `capture`, `delay`, `repair`, or `authored`.

`stabilizationOutcome` has exactly:

```js
{
  outcomeId,
  title,
  description,
  nextSituationId
}
```

Its `nextSituationId` must resolve to the single authored next situation.
`failureConsequences` contains exactly one descriptor with keys:

```js
{
  consequenceId,
  kind,
  title,
  description,
  nextSituationId
}
```

Failure consequence kind is exactly one of:

- `"strand"`;
- `"diversion"`;
- `"disablement"`;
- `"loss"`.

No other equivalent, inferred, extended, custom, executable, or caller-authored
consequence kind is valid. The descriptor contains only the exact fields above;
it contains no arbitrary effect object, callback, script, expression, macro
command, or generic data bag. Its `nextSituationId` resolves to the same
single next situation. A failure consequence is authored and descriptive; it
is never executed by M9.

All four failure consequence kinds use exactly the same five fields shown in
the canonical failure-consequence descriptor. The keys are ordered
`consequenceId`, `kind`, `title`, `description`, `nextSituationId`.
`consequenceId`, `title`, `description`, and `nextSituationId` are nonblank
strings; `kind` is one of the four closed enum values; and
`nextSituationId` resolves to the single authored next situation. No key may
be omitted, reordered, duplicated, or added, and no kind admits an executable
payload.

Nested identities are unique by exact string equality: the response-definition
ID, every round ID, the stabilization outcome ID, the single failure
consequence ID, and the single next-situation ID are each nonblank and unique
within their authored scope. No nested catalog or duplicate outcome collection
is permitted. Titles, descriptions, and summaries are nonblank exact strings.

M9 uses the M8 round-history vocabulary and calculation by reference. M9 does
not use M8’s ordinary overall-result, reward, Negative Step, Misfortune, or
result-package APIs. Critical round results affect only successful or failed
round counts; no response reward points, Negative Steps, or critical overall
response result exists.

## 8. Public API inventory

The exact public APIs are:

```js
validateVoyageCatastrophicBreakdownDefinition(breakdownDefinition)
captureVoyageCatastrophicBreakdownDefinition(breakdownDefinition)
analyzeVoyageCatastrophicBreakdown(request)

validateVoyageEmergencyResponseCompletedRoundHistory(
  completedRoundHistory,
  emergencyResponseDefinition
)
captureVoyageEmergencyResponseCompletedRoundHistory(completedRoundHistory)
analyzeVoyageEmergencyResponseResult(request)
```

No combined M8–M9–M10 analyzer is authorized. No application, persistence,
transport, socket, request-envelope, or Foundry API is authorized. Export-index
wiring is deferred unless the established domain pattern requires it after the
pure module is independently accepted.

### 8.1 Definition validation and capture

`validateVoyageCatastrophicBreakdownDefinition` accepts any JavaScript input,
never throws, and returns exactly:

```js
{
  valid,
  errors,
  warnings
}
```

`captureVoyageCatastrophicBreakdownDefinition` accepts any JavaScript input,
never throws, and returns exactly:

```js
{
  ok,
  breakdownDefinition,
  errors,
  warnings
}
```

On failure, `breakdownDefinition` is `null`; on success it is deeply isolated.
Validation and capture use the exact schemas and diagnostics in sections 7 and
20.

### 8.2 Catastrophic Breakdown analysis

The exact request keys are:

```js
{
  kind: "m9-catastrophic-breakdown",
  sessionId,
  breakdownDefinition,
  capacityExhaustion
}
```

The root must be a plain object with these four own enumerable data keys in
this order. `sessionId` is a nonblank string; the two descriptor values are
plain objects. The prohibited authority keys in section 9 are rejected before
mode and shape diagnostics.

`request.sessionId` is the independently supplied authoritative expected Event
Session identity. It must equal `capacityExhaustion.sessionId`. A mismatch
emits exactly one `m9-session-identity-mismatch` diagnostic at
`capacityExhaustion.sessionId`. Task 2 category-9 binding is limited to event,
session, and system, in that order. Event binds the captured Hazard encounter
identity to `capacityExhaustion.eventId`; session binds the request session to
`capacityExhaustion.sessionId`; and system binds the Breakdown Definition and
captured Hazard system to `capacityExhaustion.systemId`.

Task 2 structurally validates and safely captures
`capacityExhaustion.definitionSnapshotId`, `capacityExhaustion.shipId`, and
`capacityExhaustion.liveRevision` as M10 handoff evidence. The exact Task 2
request has no independently supplied snapshot, ship, or live-revision value,
and the Breakdown Definition has none of those fields. Task 2 therefore does
not compare those evidence values against themselves, does not treat their
mere presence as live identity revalidation, and does not add a request field
or other caller authority for them. M10 owns live snapshot, ship, and revision
revalidation. Task 4 retains its separately applicable identity and complete
supplied-plan validation rules.
Task 2 generates and validates its BreakdownPlan internally and performs no
supplied-plan equality. During Emergency Response analysis, Breakdown
Definition binding is performed by complete plan equality when the supplied
BreakdownPlan is revalidated; there is no separate handoff Breakdown
Definition field.

The exact success envelope keys are:

```js
{
  ok,
  readyForCatastrophicBreakdown,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  systemId,
  systemKind,
  liveRevision,
  breakdownDefinitionId,
  breakdownPlan,
  requiresGmApproval,
  errors,
  warnings
}
```

Success has `ok: true`, `readyForCatastrophicBreakdown: true`,
`requiresGmApproval: true`, an isolated plan, empty errors, and empty warnings.
Failure preserves the same key order with all identity and revision fields
`null`, `breakdownDefinitionId: null`, `breakdownPlan: null`,
`readyForCatastrophicBreakdown: false`, `requiresGmApproval: false`, nonempty
errors, and `warnings: []`.

### 8.3 Breakdown plan

The exact `breakdownPlan` keys are:

```js
{
  systemDisablement,
  catastrophicHazard,
  pausePlan,
  emergencyResponseDefinitionId,
  scarApplication,
  capacityExhaustion
}
```

`systemDisablement` has exactly `{ systemId, systemKind, disabled }`, with
`disabled: true`. `catastrophicHazard` is the isolated complete M6 descriptor.
`pausePlan` is the exact authored pause plan. The response definition ID and
capacity handoff are isolated exact values. `scarApplication` is literally
`null`. No application status, next state, approval, or mutation field may
appear.

`BreakdownPlan` has no standalone plan ID. Its canonical identity is its
complete captured exact-shape plain-data graph, including every nested
system-disablement field, complete M6-compatible Hazard descriptor, pause-plan
field, Emergency Response definition identity, `scarApplication: null`
sentinel, and capacity-exhaustion source field. Task 2 regenerates this
complete plan internally from the captured Breakdown Definition and captured
capacity-exhaustion descriptor, validates its exact shape and components, and
returns the isolated generated graph; Task 2 never accepts a supplied plan and
does not perform supplied-plan comparison. Emergency Response analysis alone
must regenerate the expected BreakdownPlan and compare the supplied captured
BreakdownPlan to that regenerated graph using exact component-safe structural
equality and exact canonical key order. Object identity, reference identity,
hashes used as authority, timestamps, random identifiers, approval tokens,
persistence tokens, application tokens, and caller-authored plan IDs are
invalid.

After hostile-safe capture, exact-shape validation, canonical key-order
validation, descriptor validation, and component-safe identity validation, the
comparison is equivalent to:

```js
const expectedPlan = regenerateBreakdownPlan(
  capturedBreakdownDefinition,
  capturedCapacityExhaustion
);
const suppliedPlanKey = JSON.stringify(capturedBreakdownPlan);
const expectedPlanKey = JSON.stringify(expectedPlan);
const matches = suppliedPlanKey === expectedPlanKey;
```

This comparison is not a hash, approval, persistence, or security mechanism.

## 9. Prohibited authority keys

For `m9-catastrophic-breakdown`, the following request-root keys are the exact
closed prohibited-authority list:

```js
[
  "approved",
  "gmApproved",
  "approval",
  "gmApproval",
  "applicationPlan",
  "nextState",
  "breakdownPlan",
  "emergencyResponseResult",
  "outcomeProposal",
  "persistentChanges",
  "shipUpdate",
  "hazardApplied",
  "systemDisabled",
  "scarCreated",
  "revisionAfter",
  "requestId",
  "staleStatus",
  "duplicateStatus",
  "capacityAnalysis",
  "applicationToken"
]
```

For `m9-emergency-response`, the exact closed prohibited-authority list is the
same list with the required captured `breakdownPlan` request field removed:

```js
[
  "approved", "gmApproved", "approval", "gmApproval", "applicationPlan",
  "nextState", "emergencyResponseResult", "outcomeProposal",
  "persistentChanges", "shipUpdate", "hazardApplied", "systemDisabled",
  "scarCreated", "revisionAfter", "requestId", "staleStatus",
  "duplicateStatus", "capacityAnalysis", "applicationToken"
]
```

Each prohibited key in captured request-key order emits one
`m9-caller-authored-application-rejected` diagnostic. Multiple prohibited keys
therefore produce multiple diagnostics in captured request-key order. No later
precedence category is evaluated after any prohibited-key diagnostic is
produced. Ordinary unknown keys are handled later by exact-shape validation.
The value of a prohibited key has no effect on rejection. Values including
`null`, `false`, `0`, empty strings, empty arrays, and empty objects are rejected
identically.
`breakdownPlan` is authorized only once as the exact required Emergency
Response request field; duplicate or additional authority keys remain
category-2 failures.

## 10. Emergency Response history capture and validation

Emergency Response history reuses the M8 completed-round-history schema by
reference, without invoking M8 analyzers. Its exact keys are:

```js
{
  schemaVersion,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  systemId,
  liveRevision,
  breakdownDefinitionId,
  emergencyResponseDefinitionId,
  roundCount,
  rounds
}
```

The completed-round-history root contains exactly these own enumerable keys in
the declared insertion order. `schemaVersion` is exactly `1`. `roundCount` is
exactly one of `3`, `5`, `7`, `9`, or `11` and equals `rounds.length`.
`rounds` is dense. Each round has exactly `{ roundId, roundNumber,
roundResult }` in that insertion order. Round IDs are unique and match the
Emergency Response Definition by index. Round numbers are unique, start at 1,
and equal index + 1. Round results are exactly `round-success`,
`critical-round-success`, `round-failure`, or `critical-round-failure`.
History identity binds to the M10 handoff event, session, definition snapshot,
ship, system, revision, Breakdown Definition, and Emergency Response
Definition. Every authored round appears exactly once, in definition order.

`validateVoyageEmergencyResponseCompletedRoundHistory` returns exactly
`{ valid, errors, warnings }`. `captureVoyageEmergencyResponseCompletedRoundHistory`
returns exactly `{ ok, completedRoundHistory, errors, warnings }`, with a null
captured value on failure and `warnings: []`.

## 11. Emergency Response request and result analysis

The exact request keys are:

```js
{
  kind: "m9-emergency-response",
  sessionId,
  breakdownDefinition,
  breakdownPlan,
  completedRoundHistory
}
```

The root has exactly these five own enumerable data keys in order. The plan is
revalidated against the captured definition and handoff; it is never treated
as an application token. No caller-authored result, stabilization outcome,
failure outcome, next state, or persistent application is trusted.

`request.sessionId` is the independently supplied authoritative expected Event
Session identity. It must equal the session identity captured in the supplied
BreakdownPlan and the regenerated expected BreakdownPlan. A mismatch emits
exactly one `m9-session-identity-mismatch` diagnostic at
`breakdownPlan.capacityExhaustion.sessionId`. Emergency Response category-9
binding order is event, session, definition snapshot, ship, system, revision,
then `breakdownPlan.emergencyResponseDefinitionId`; Breakdown Definition
binding is part of complete plan equality because the canonical plan has no
`breakdownDefinitionId` property.

The exact result envelope keys are:

```js
{
  ok,
  readyForEmergencyResponseOutcome,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  systemId,
  breakdownDefinitionId,
  emergencyResponseDefinitionId,
  emergencyResponseResult,
  outcomeProposal,
  requiresGmApproval,
  errors,
  warnings
}
```

On valid analysis, `ok`, `readyForEmergencyResponseOutcome`, and
`requiresGmApproval` are true; `emergencyResponseResult` and exactly one
`outcomeProposal` are isolated; errors and warnings are empty. On failure all
identity fields are `null`, both result/proposal fields are `null`, readiness
and approval are false, errors are nonempty, and warnings are empty.

`emergencyResponseResult` has exactly:

```js
{
  overallResult,
  roundCount,
  winningThreshold,
  successfulRoundCount,
  failedRoundCount
}
```

`overallResult` is exactly `emergency-stabilized` or `emergency-failed`.

## 12. Outcome proposals

The stabilized proposal has exactly these keys:

```js
{
  kind: "m9-emergency-response-stabilized",
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  systemId,
  breakdownDefinitionId,
  emergencyResponseDefinitionId,
  catastrophicHazardId,
  catastropheStatus: "stabilized",
  hazardDisposition: "contained",
  systemStatus: "disabled",
  repairApplied: false,
  scarAdded: false,
  scarRemoved: false,
  sourceEventStatus: "ended",
  nextSituation,
  requiresGmApproval: true
}
```

Milestone 9 stabilization always returns:

```text
hazardDisposition: "contained"
```

Milestone 9 never emits `"resolved"`, never changes an M6 Hazard status, never
ticks or closes an M6 Hazard, and never requests persistent Hazard resolution.
`contained` is an isolated outcome proposal meaning only that the authored
Emergency Response succeeded in preventing immediate catastrophic escalation.
Any later persistent Hazard transition, removal, or resolution is a separate
Milestone 10 application decision.

The failed proposal has exactly these keys:

```js
{
  kind: "m9-emergency-response-failed",
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  systemId,
  breakdownDefinitionId,
  emergencyResponseDefinitionId,
  catastrophicHazardId,
  catastropheStatus: "failed",
  systemStatus: "disabled",
  sourceEventStatus: "ended",
  retryAllowed: false,
  consequence,
  nextSituation,
  requiresGmApproval: true
}
```

`nextSituation` is the isolated single authored descriptor. `consequence` is
the isolated single authored failure consequence. M9 returns no mutation,
application, approval record, revision update, timestamp, or random ID.

## 13. Diagnostic catalog

Every diagnostic has exactly `{ code, path, message, severity }`, with
`severity: "error"`. The complete reachable catalog is:

| Code | Path | Message | Category |
|---|---|---|---:|
| `m9-hostile-data-capture-failed` | `$` | `Milestone 9 data could not be captured safely.` | 1 |
| `m9-caller-authored-application-rejected` | `request.<capturedProhibitedKey>` | `Caller-authored application or runtime authority is not accepted.` | 2 |
| `m9-invalid-mode` | `request.kind` | `Only the requested Milestone 9 analysis mode is supported.` | 3 |
| `m9-invalid-request-shape` | `request` | `Request has an invalid exact shape or field values.` | 4 |
| `m9-invalid-breakdown-definition` | `breakdownDefinition` | `Catastrophic Breakdown Definition is invalid.` | 5 |
| `m9-invalid-catastrophic-hazard` | `breakdownDefinition.catastrophicHazard` | `Catastrophic Hazard is not a valid M6 Hazard with the required M9 restrictions.` | 6 |
| `m9-invalid-emergency-response-definition` | `breakdownDefinition.emergencyResponseDefinition` | `Emergency Response Definition is invalid.` | 6 |
| `m9-duplicate-definition-identity` | first duplicate path in identity-order rule* | `Authored Milestone 9 definition identities must be unique.` | 7 |
| `m9-unresolved-definition-reference` | exact unresolved reference path in reference-order rule† | `Authored Milestone 9 definition reference is unresolved.` | 7 |
| `m9-invalid-capacity-exhaustion` | `capacityExhaustion` | `Capacity-exhaustion handoff is invalid.` | 8 |
| `m9-event-identity-mismatch` | `capacityExhaustion.eventId` | `Event identity does not match the M10 handoff.` | 9 |
| `m9-event-identity-mismatch` | `breakdownPlan.capacityExhaustion.eventId` | `Event identity does not match the M10 handoff.` | 9 |
| `m9-session-identity-mismatch` | `capacityExhaustion.sessionId` | `Session identity does not match the M10 handoff or request.` | 9 |
| `m9-session-identity-mismatch` | `breakdownPlan.capacityExhaustion.sessionId` | `Session identity does not match the M10 handoff or request.` | 9 |
| `m9-definition-snapshot-mismatch` | `breakdownPlan.capacityExhaustion.definitionSnapshotId` | `Definition snapshot identity does not match the M10 handoff.` | 9 |
| `m9-ship-identity-mismatch` | `breakdownPlan.capacityExhaustion.shipId` | `Ship identity does not match the M10 handoff.` | 9 |
| `m9-system-identity-mismatch` | `capacityExhaustion.systemId` | `Affected system identity does not match the M10 handoff.` | 9 |
| `m9-system-identity-mismatch` | `breakdownPlan.capacityExhaustion.systemId` | `Affected system identity does not match the M10 handoff.` | 9 |
| `m9-revision-binding-mismatch` | `breakdownPlan.capacityExhaustion.liveRevision` | `Live revision binding does not match the M10 handoff.` | 9 |
| `m9-capacity-not-exhausted` | `capacityExhaustion.occupiedScarCount` | `Capacity exhaustion is not established.` | 10 |
| `m9-invalid-incoming-scar-proposal` | `capacityExhaustion.incomingScarProposalId` | `Incoming ordinary Scar proposal evidence is invalid.` | 10 |
| `m9-breakdown-not-applicable` | `capacityExhaustion` | `Catastrophic Breakdown is not applicable to this handoff.` | 11 |
| `m9-invalid-breakdown-plan` | `breakdownPlan` | `Breakdown plan does not match the captured definition and handoff.` | 12 |
| `m9-invalid-emergency-response-history` | exact history-order path defined by history-order rule‡ | `Emergency Response round history is invalid.` | 13 |

Definition validators may accumulate all applicable errors in deterministic
source order. Analysis stops after the first failing precedence category;
within a category, fixed field order and authored array order are retained.
Duplicate identical diagnostics are removed by exact tuple
`[code, path, message, severity]`, using a component-safe representation.
No diagnostic exposes exception, Proxy, revocation, trap, stack, or engine
text.

*Identity-order rule:* duplicate identities are selected in this fixed order:
`breakdownDefinition.breakdownDefinitionId`,
`breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId`,
`breakdownDefinition.emergencyResponseDefinition.rounds[n].roundId`,
`breakdownDefinition.emergencyResponseDefinition.stabilizationOutcome.outcomeId`,
`breakdownDefinition.emergencyResponseDefinition.failureConsequences[0].consequenceId`,
then `breakdownDefinition.emergencyResponseDefinition.nextSituations[0].nextSituationId`.
The later duplicate element is named.

†Reference-order rule:* unresolved references are selected in this order:
`breakdownDefinition.emergencyResponseDefinition.stabilizationOutcome.nextSituationId`,
then `breakdownDefinition.emergencyResponseDefinition.failureConsequences[0].nextSituationId`.

‡History-order rule:* the first failing path is selected from
`completedRoundHistory.schemaVersion`, `eventId`, `sessionId`,
`definitionSnapshotId`, `shipId`, `systemId`, `liveRevision`,
`breakdownDefinitionId`, `emergencyResponseDefinitionId`, `roundCount`,
`completedRoundHistory.rounds`, then the indexed `roundId`, `roundNumber`, or
`roundResult` field.

Definition, Hazard, identity, and reference diagnostics are owned by both
definition validators and the analyzers that capture definitions. Capacity and
applicability diagnostics are owned by
`analyzeVoyageCatastrophicBreakdown`. The Breakdown-plan diagnostic is owned
only by `analyzeVoyageEmergencyResponseResult`. History diagnostics are owned by both
Emergency Response history APIs and `analyzeVoyageEmergencyResponseResult`.
Every retained row has a corresponding malformed, hostile, binding, or
applicability witness in Section 18.

Every diagnostic path is the first failing canonical field path selected in
fixed schema order. Structural root failures use the canonical root path;
For a prohibited caller-authority key named `<capturedProhibitedKey>`, the
exact path is `request.<capturedProhibitedKey>`; the captured name is the exact
own root-property name. Task 2 identity rows use only the
`capacityExhaustion.eventId`, `capacityExhaustion.sessionId`, and
`capacityExhaustion.systemId` paths shown in the catalog. Task 2's
`definitionSnapshotId`, `shipId`, and `liveRevision` are category-8 handoff
evidence fields, not category-9 identity mismatches; their presence is not
live identity revalidation. Emergency Response identity rows use the
`breakdownPlan.capacityExhaustion.*` paths shown in the catalog. For Task 2,
the internally generated plan is validated from the captured definition and
handoff; no supplied-plan comparison or category-12 diagnostic is applicable.
For Emergency Response, Breakdown Definition binding is revalidated by
complete plan equality, not a separate category-9 field, because the
canonical six-key plan has no `breakdownDefinitionId` property. Emergency
Response Definition binding uses the declared
`breakdownPlan.emergencyResponseDefinitionId` property.
nested descriptor failures use the exact nested descriptor property path;
duplicate
diagnostics identify the later duplicate element; unresolved references identify
the exact reference element; identity mismatches identify the exact captured
field that disagrees with the independently supplied expected identity; history
failures identify the exact history root field or
`completedRoundHistory.rounds[n]` field; and next-situation cardinality or
descriptor failures are definition-validation failures at the containing
`breakdownDefinition.emergencyResponseDefinition.nextSituations` path or its
exact indexed child path. Each retained diagnostic has one owning API and one
mandatory reachable test witness in the task matrix. Indexed paths use the
zero-based authored array index `n`.

The owning-API and witness mapping is fixed as follows: hostile, authority,
mode, request-shape, definition, Hazard, Emergency Response definition,
duplicate-identity, and unresolved-reference rows are owned by the applicable
validation/capture APIs and both analyzers; capacity, exhaustion, and
applicability rows are owned by `analyzeVoyageCatastrophicBreakdown`; the
Breakdown-plan row is owned only by `analyzeVoyageEmergencyResponseResult`;
history rows are owned by both history validation/capture APIs and
`analyzeVoyageEmergencyResponseResult`; and every
identity row is owned by the analyzer that receives that captured descriptor.
Section 18 supplies one mandatory malformed, hostile, authority, binding, or
applicability witness for every retained row.

## 14. Diagnostic precedence

Both analyzers use this complete precedence:

1. hostile capture;
2. prohibited caller-authored application or runtime authority;
3. invalid analyzer kind;
4. exact request shape and root values;
5. Breakdown Definition structure;
6. M6 Hazard and Emergency Response descriptor validity;
7. authored identity uniqueness and reference integrity;
8. M10 capacity-exhaustion handoff structure;
9. analyzer-applicable identity binding: Task 2 event, session, and system;
   Emergency Response event, session, snapshot, ship, system, and revision;
10. capacity arithmetic and exhaustion applicability;
11. Breakdown applicability;
12. Breakdown-plan identity revalidation (Emergency Response only);
13. Emergency Response history structure and binding;
14. authored stabilization/failure consequence sufficiency; and
15. final outcome proposal validation.

`analyzeVoyageCatastrophicBreakdown` skips category 12 because it generates
the canonical plan internally and accepts no supplied `breakdownPlan`.
`analyzeVoyageEmergencyResponseResult` applies category 12 to the supplied
captured plan. Within precedence category 9, every valid identity mismatch
accumulates exactly once in fixed analyzer-specific order. Task 2 accumulates
event, session, and system only. It structurally validates and captures the
snapshot, ship, and live-revision evidence in category 8 and leaves their live
revalidation to M10. Emergency Response accumulates event, session, definition
snapshot, ship, system, and revision, then
`breakdownPlan.emergencyResponseDefinitionId` when applicable.
Breakdown Definition binding for Emergency Response remains category-12
complete plan equality and is not a category-9 identity field. After the complete ordered
category-9 diagnostic array is produced, no later category is evaluated. A
structurally malformed identity belongs to an earlier structure or value
category and does not also produce a category-9 mismatch.

Categories not applicable to a particular analyzer are skipped without adding
diagnostics. Hostile capture, authority, mode, request shape, and each failed
definition or binding category return no later-category diagnostic. Multiple
errors may coexist only inside the active category according to its fixed
ordering. A failed analysis returns no partial plan or outcome proposal.

After a valid captured Emergency Response Definition and a valid captured
completed-round history, Emergency Response result calculation is total and
cannot produce a separate invalid-result diagnostic. After valid authored
outcome and next-situation descriptors have passed definition validation and
reference integrity, selection of the applicable authored next situation is
total and cannot produce a later invalid-next-situation diagnostic.

## 15. Revision, runtime, and persistence boundaries

M10 establishes and supplies `liveRevision`. Task 2 structurally validates and
captures that value as M10 handoff evidence and carries it into the generated
proposal; it does not compare the value against itself, treat its presence as
live revision revalidation, or query live state. Task 4 retains its separate
supplied-plan and history identity rules. M10 revalidates revision, identity,
capacity, and source evidence immediately before application. M11 owns stale and duplicate runtime
command rejection, request IDs, transport, recovery, and control transfer.
M9 results may be deterministically recomputed and are not durable idempotency
records. No generated timestamp or random proposal ID is permitted.

## 16. Atomicity and rollback

Pure M9 analysis has no partial mutation and therefore requires no runtime
rollback. M9 returns either one complete valid proposal or one complete failure
envelope. No partial `breakdownPlan` or `outcomeProposal` leaks on failure.
M10’s later persistent application must be atomic or reconcile partial writes;
that behavior is not implemented by M9.

## 17. Task decomposition

### Task 1 — Breakdown Definition validation and capture

- Files: `scripts/voyage/domain/catastrophic-breakdown.js` and
  `tests/voyage/domain/catastrophic-breakdown.test.mjs` only.
- APIs: `validateVoyageCatastrophicBreakdownDefinition` and
  `captureVoyageCatastrophicBreakdownDefinition`.
- Prerequisites: accepted M6 Hazard capture, M7 capacity/ship schemas, and
  this M9 contract.
- Behavior: safely capture and validate every Section 7 definition, nested M6
  Hazard restriction, Emergency Response definition, identity, reference,
  outcome, and next-situation rule.
- Tests: exact keys, M6 wrapper validity, duplicate identities, references,
  hostile data, isolation, determinism, complete failure envelopes, and exact
  history-independent definition diagnostics.
- Stop condition: no invalid or hostile definition may produce a captured
  definition.
- Prohibited: application, capacity discovery, session mutation, M8 analyzer
  calls, M10 approval, M11 runtime, PF2e, Foundry, and UI.

### Task 2 — Capacity-exhaustion handoff and Breakdown analysis

- Files: `scripts/voyage/domain/catastrophic-breakdown.js` and
  `tests/voyage/domain/catastrophic-breakdown.test.mjs` only.
- API: `analyzeVoyageCatastrophicBreakdown`.
- Prerequisites: Task 1 and the accepted M7 capacity result boundary. Because
  M10 is not implemented yet, tests construct only plain canonical handoff
  fixtures; no M10 API call is required and fixtures do not simulate, replace,
  prove, or authorize M10 live discovery, approval, or persistence.
- Behavior: capture the exact M10 handoff, bind event, session, and system
  identities, structurally validate and capture snapshot, ship, and
  live-revision evidence, validate exhaustion and unapplied incoming proposal
  evidence, internally regenerate and validate the complete BreakdownPlan
  shape and components, and return the exact isolated Breakdown envelope and
  generated plan. Task 2 does not compare snapshot, ship, or live-revision
  evidence against itself, does not treat its presence as live identity
  revalidation, and introduces no request field or caller authority for those
  values. M10 owns their live revalidation. Task 2 never accepts or compares a
  caller-supplied BreakdownPlan.
- Tests: capacity boundaries, zero capacity, unused capacity, over-capacity
  invalid state, event/session/system binding, malformed-identity precedence,
  structural snapshot/ship/revision evidence, no Scar output, exact generated
  plan shape and key order, internally generated system disablement, complete
  M6 Hazard, pause plan, Emergency Response definition identity,
  `scarApplication: null`, isolated capacity-exhaustion evidence, returned
  plan isolation, deterministic generated-plan reconstruction success, request-input acyclic
  shared-reference acceptance, request-input direct and indirect
  active-ancestor cycle rejection, and captured request-occurrence isolation,
  complete authority-key rejection for every value type and concrete path,
  one-key and multiple-key ordered diagnostic arrays, full Breakdown category-9
  mismatch accumulation, malformed identity plus valid later mismatch,
  identity-plus-capacity failure, undefined hostile values, M7 vocabulary,
  determinism, and zero mutation.
- Stop condition: no caller-authored plan or ship data can create a Breakdown
  result without an M10-established exhausted handoff.
- Prohibited: ship-state reads, Scar creation, Hazard application, event
  emission, repair, persistence, approval, runtime, PF2e, Foundry, and UI.

### Task 3 — Emergency Response history validation and capture

- Files: `scripts/voyage/domain/emergency-response.js` and
  `tests/voyage/domain/emergency-response.test.mjs` only.
- APIs: `validateVoyageEmergencyResponseCompletedRoundHistory` and
  `captureVoyageEmergencyResponseCompletedRoundHistory`.
- Prerequisites: Task 1 definition capture and the M8 completed-round-history
  vocabulary.
- Behavior: safely capture exact M8-compatible history without invoking M8
  result analyzers or reward/Misfortune logic.
- Tests: all supported odd round counts, dense order, exact root and round-entry
  keys, schema version, count and order boundaries, result vocabulary,
  identity bindings, concrete history paths, undefined values, acyclic shared
  round references, malformed histories, hostile data, isolation, and
  deterministic diagnostics, including exact complete binding-path arrays.
- Stop condition: incomplete or hostile history returns a complete failure
  envelope with no partial rounds.
- Prohibited: M8 reward/Misfortune/result-package calls, outcome application,
  persistence, runtime, PF2e, Foundry, and UI.

### Task 4 — Emergency Response result and outcome analysis

- Files: `scripts/voyage/domain/emergency-response.js` and
  `tests/voyage/domain/emergency-response.test.mjs` only.
- API: `analyzeVoyageEmergencyResponseResult`.
- Prerequisites: Tasks 1 and 3, the captured Breakdown plan, and the M8
  round-history vocabulary by reference.
- Behavior: capture the supplied plan, revalidate its regenerated complete
  plan identity, regenerate the exact response result using the locked
  formula, select exactly one authored stabilization or closed-enum failure
  consequence, enforce containment-only
  Hazard disposition and no automatic resume, and return the exact isolated
  outcome envelope.
- Tests: threshold boundaries, success, failure, critical-round weighting,
  disabled-system preservation, contained-only Hazard disposition, no repair/
  Scar/reward behavior, no automatic resume, one closed-enum authored failure
  consequence with exact five-key schema, missing-key, extra-key, reordered-key,
  and wrong-type witnesses for every consequence field, unknown/padded/case-variant/non-string
  kind rejection, exact scalar `overallResult`, exact object
  `emergencyResponseResult` and key order, complete envelope and failure-null
  sentinel, all Emergency Response category-9 mismatches, supplied-plan nested
  edits, reordered keys, omitted fields, extra fields, wrong identities,
  wrong revision, fresh structurally equal supplied graphs, supplied-plan
  shared-reference capture and isolation, supplied-plan active-ancestor
  cycles, identity-plus-plan failure, identity-plus-capacity failure, no retry
  loop, next situation, all precedence, exact session/plan binding, authority
  rejection, isolation, determinism, and no runtime access.
- Stop condition: no malformed result or caller-authored outcome can produce a
  proposal.
- Prohibited: generic consequence execution, repair, Scar mutation, Hazard
  mutation, session closeout, approval, persistence, runtime, PF2e, Foundry,
  sockets, and UI.

No Task 5 combined analyzer is authorized. No export-index wiring is authorized
until the pure modules pass independent review and the repository’s established
domain pattern demonstrably requires it.

## 18. Required test matrix

Tests must cover all of the following.

### Definition and capture

- exact shapes and insertion-order-sensitive keys;
- malformed nested descriptors;
- duplicate identities and unresolved references;
- invalid M6 Hazard wrapper;
- invalid Emergency Response definition;
- hostile getters, setters, accessor descriptors and traps, cycles, symbol keys
  and values, Proxies including revoked Proxies, reflection failures, sparse
  arrays, arrays with extra own keys, unsafe/non-enumerable/inherited keys,
  nonplain objects including Date/Map/Set/class/Foundry/PF2e objects, functions,
  BigInts, undefined, and nonfinite numbers;
- capture isolation and determinism.

### Capacity exhaustion

- exact `occupiedScarCount === scarCapacity`;
- unused capacity rejection;
- occupied count above capacity rejection;
- zero capacity and zero occupied count;
- missing or malformed incoming proposal evidence;
- Task 2 event, session, and system mismatch accumulation;
- Task 2 malformed identity short-circuiting and malformed identity followed by
  a valid later mismatch;
- structural validation and isolated capture of snapshot, ship, and
  live-revision handoff evidence, without treating those fields as live
  identity revalidation;
- padded identities;
- unsafe and nonfinite numbers;
- every prohibited authority key in both analyzer-specific closed lists,
  including null, false, zero, empty strings, empty arrays, and empty objects;
- M7 system and incoming-proposal vocabulary witnesses.

### Breakdown proposal

- no Scar in output;
- exact affected-system disablement;
- exactly one Catastrophic Hazard;
- exact pause timing;
- exact Emergency Response identity;
- complete success envelope;
- complete failure sentinels;
- M10 fixture construction without an M10 API call;
- returned-value isolation;
- input immutability;
- no random or time access.

### Emergency Response history and result

- all supported odd round counts;
- threshold boundaries;
- success and failure;
- critical-round-success and critical-round-failure weighting;
- exact schema version, root/round key order, dense rounds, count, IDs, and
  identity fields;
- malformed history ownership and diagnostic precedence;
- event, session, snapshot, ship, system, and revision mismatch order;
- category-9 arrays for each single mismatch, all Breakdown mismatches, all
  Emergency Response mismatches, and malformed identity followed by valid
  later mismatches;
- stabilization leaves the system disabled;
- stabilization does not repair;
- Hazard disposition is exactly `contained`, with `resolved` rejected;
- no automatic resume, runtime action, or executable output;
- failure ends or supersedes the source event;
- exactly one authored closed-enum failure consequence, including rejection of
  unknown, padded, case-variant, and non-string kinds;
- no retry loop;
- required next situation;
- no reward, Momentum, Void Fortune, Field Repair Resource, or M8 combined
  analyzer behavior;
- complete envelopes and isolation.

### Component-safe identities and scope

- true embedded-NUL delimiter-collision counterexamples;
- distinct tuples remain distinct;
- no cross-definition or cross-system aliasing;
- Task 4 supplied-plan regenerated equality rejects nested edits, reordered
  keys, omissions, extra fields, wrong identities/revision, accepts fresh
  structurally equal graphs, and preserves supplied-plan shared-reference
  isolation while rejecting active-ancestor cycles;
- no Foundry, PF2e, persistence, inventory, repair, socket, transport,
  request-ID, or runtime behavior.

## 19. Baseline arithmetic

The accepted starting baseline is Task 1 `17`, Task 2 `20`, Task 3 `46`, Task 4
`27`, Voyage domain `1,125`, Voyage PF2e `145`, and combined Voyage `1,270`.

For each M9 implementation task, the required arithmetic is:

```text
new domain total = prior domain total + focused M9 test count
new combined total = prior combined total + focused M9 test count
PF2e remains 145 unless a later explicitly authorized task changes it
```

No final M9 count is authorized before tests exist.

## 20. Contract completeness criteria

This contract is implementation-authorizing because it answers all of the
following without inference:

- M10 establishes the exact exhaustion condition;
- M9 accepts only the isolated handoff and never discovers live capacity;
- M9 targets the handoff system and adds no Scar;
- the M6 Hazard representation and M9 restrictions are exact;
- the pause timing and Emergency Response trigger are exact;
- Emergency Response rounds use M8 vocabulary and threshold mathematics;
- success stabilizes without repair or re-enablement;
- failure ends or supersedes the event through one authored consequence;
- M10 receives isolated proposals and alone approves and persists;
- M11 owns runtime freshness, transport, and recovery;
- all diagnostics and precedence categories are fixed;
- task files, APIs, exclusions, stop conditions, and test matrix are fixed.

No public API performs persistent application, generic consequence execution,
PF2e rolling, Foundry access, transport, or runtime authority.
