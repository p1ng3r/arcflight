# Arcflight Gameplay V3 - Milestone 7: Void Scars, Hull Capacity, and Repair

**Status:** Accepted completed contract for Milestone 7 Tasks 0 through 5.
The canonical decision pass and the exact capacity-analysis, repair-approval,
and atomic-repair clarifications are implemented in committed pure-domain
slices.

**Canonical authority:** The canonical Event Runner rules, the Gameplay V3 Canonical Audit and Milestone Map, and the accepted Milestone 6 Hazard Engine Contract remain authoritative. This document records the smallest pure-domain contract that can be implemented without changing those sources.

**Scope:** Foundry-free plain data, validation, analysis, and atomic domain boundaries for Void Scar records, hull capacity, and repair. Foundry document writes, GM authority, sockets, projections, UI, PF2e roll orchestration, and closeout application remain outside this milestone.

## 1. Audit conclusion

Milestone 6 intentionally leaves a Pressure Breach Void Scar as a proposal. Its existing transaction persists the active Hazard in temporary activeHazards, resets the breached Pressure system, increments the encounter revision once, emits one voyage.pressure-breach-applied event, and includes one lasting voidScarProposal. It does not mutate a ship or consume hull capacity.

The five canonical Pressure systems and the existing proposal are the
available source boundary for this milestone. Durable Void Scar state, hull
capacity, approved creation, repair analysis, and atomic repair application
are implemented in the committed Tasks 1 through 5 pure-domain slices.

Existing ship code already uses Arcflight-owned flags.arcflight.system data, including installed.hullPlatform, base.hull, derived.hullIntegrity, and current.hull. Existing Voyage state uses temporary primaryShip, revision, Pressure, Hazards, snapshots, and consequence collections. Those ownership boundaries are preserved.

## 2. Milestone 7 purpose

Milestone 7 must provide a deterministic pure-domain contract to:

1. author and safely capture a Void Scar record;
2. author voidScarCapacity on every core hull;
3. calculate active Scar occupancy and remaining capacity;
4. analyze and atomically accept one approved Pressure Breach proposal into a durable ship-domain candidate state; and
5. analyze and atomically apply one successful repair or field-repair removal.

The domain must never infer capacity from hull tier, room slots, Hull Integrity, strain, Lifeveil, or expansion slots. A Scar occupies one Void Scar Capacity slot. Reaching capacity is legal; gaining another Scar is an analysis result for later Catastrophic Breakdown handling, not an automatic Milestone 7 mutation.

## 3. Implemented versus deferred scope

### Existing implementation

- Five canonical Pressure-system IDs: crew-morale, arkengine, levstone-array, solar-sail-rig, and lifeveil.
- Pressure Breach detection, one-transaction Pressure reset, and one active Hazard per system slot.
- Deterministic Hazard and voidScarProposal identities.
- Safe Hazard capture/validation, deterministic diagnostics, revisioned encounter application, and isolated event payloads.
- Generic permanent-consequence statuses and commitment timing as a separate foundation; they are not generic execution authority.

### Milestone 7 implementation scope

- Core-hull voidScarCapacity authoring.
- A dedicated plain-data Void Scar schema and capture boundary.
- A pure durable ship-domain state shape containing active Scars.
- Capacity analysis and fail-closed overflow analysis using base hull capacity
  only.
- A request-only, internally regenerated Pressure Breach Scar-creation analyzer/application boundary.
- Pure repair eligibility, cost, and time analysis for normal and field repair.
- Atomic successful repair application and its domain event contract.
- Focused hostile-data, stale-state, duplicate, capacity, isolation, determinism, five-system, repair-outcome, and event-cardinality tests.

### Explicitly not implemented by Milestone 7

- Foundry Actor or Item writes, migration, persistence, idempotent cross-document commit, or session recovery.
- GM/socket authority, UI, projections, player views, or closeout preview.
- PF2e Actor/statistic lookup, check construction, rolling, or result orchestration.
- Generic consequence, reward, Misfortune, resource-spending, or upgrade execution.
- Unresolved-Hazard closeout, Ignored Consequence execution, Catastrophic Breakdown, Emergency Response, or event-result application.
- Automatic Hull Integrity damage. Void Scar Capacity is a separate model.

## 4. Ownership and lifecycle

### Temporary Voyage Encounter state

The encounter owns encounterId, revision, primaryShip, lifecycle/phase, round and stage context, pressureSystems, activeHazards, snapshots, pending checks, and the existing Pressure Breach event/proposal. A voidScarProposal is temporary proposal data until an explicit durable application boundary is approved. It must not be copied into activeHazards, permanentConsequences, or a ship record as an implicit side effect.

### Durable ship-domain state

The ship owns installed-hull identity, base/derived/current ship data, and an
active-only Void Scar collection. A repaired Scar is removed from that
collection; the exact pre-repair snapshot is retained in the repair event. The
event log is the history boundary. No terminal Scar record or separate repair
history collection exists in Milestone 7.

### Foundry document state

Milestone 7 defines serializable ship-domain input/output only. The canonical GM closeout and durable Foundry commit protocol remain Milestone 10 work.

### Projection/interface state

Role-filtered Scar views and capacity projections remain Milestones 11-12.

## 5. Void Scar identity and record schema

The existing proposal's voidScarId is the stable unique identity of the Scar. Milestone 7 must not add a second scarId alias. The ID remains deterministic from the originating pressureBreachId:

~~~text
arcflight-void-scar:["pressure-breach", pressureBreachId]
~~~

The proposed active VoidScarRecord has exactly these own fields:

~~~js
{
  voidScarId,
  name,
  pressureSystemId,
  status,                    // "active" in the capacity-counted set
  sourceKind,                // "pressure-breach" in this slice
  description,
  operationalEffects,
  baseRepairCost,
  baseRepairTime,
  repairDcSource,
  eligibleRepairChecks,
  requiredFacilities,
  compatibleFieldRepairTags,

  pressureBreachId,
  hazardId,
  encounterId,
  stageId,
  roundNumber,
  effectIndex,
  sequence,
  stationId,
  actionId,
  pressureEffectId,
  sourceIntentId,
  activationSource,
  branch,
  timing,
  visibility
}
~~~

The provenance names and values are copied from the existing proposal; sourceIntentId and activationSource remain nullable as they are there. Description, operationalEffects, repairDcSource, and the authored arrays are plain declarative data. Their internal effect vocabulary must not become generic execution in this milestone.

The schema requires own enumerable data properties, exact keys, finite numbers, safe integers where applicable, dense arrays, plain objects, and no undefined, symbols, functions, BigInts, accessors, revoked Proxies, cycles, or unsafe keys. Capture returns an isolated record or a deterministic failure; it never retains hostile caller data.

Milestone 7 uses only status: "active" in the capacity-counted collection.
Repaired, stabilized, and removed records are never stored in shipState.voidScars.
Stabilization belongs to Milestone 9 and is not a Milestone 7 mechanic.

## 6. Proposed durable ship-state shape

Canonical sources establish that active Scars live on the ship, separately from the hull, and that base capacity is authored on the installed hull at flags.arcflight.system.voidScarCapacity. Existing ship data uses flags.arcflight.system.installed.hullPlatform, base.hull, derived.hullIntegrity, and current.hull.

The authorized pure-domain envelope for Milestone 7 is:

~~~js
{
  shipId,
  revision,
  installed: {
    hullPlatform
  },
  hull: {
    voidScarCapacity
  },
  voidScars: [/* active VoidScarRecord values */]
}
~~~

hull.voidScarCapacity is captured from the installed hull's canonical flags.arcflight.system.voidScarCapacity; it is not inferred from tier or expansion slots. Effective capacity equals hull.voidScarCapacity in Milestone 7. There is no generic capacity modifier array and no upgrade or temporary capacity bonus.

shipId is the exact durable ship identity. revision is a non-negative safe integer used for optimistic concurrency. installed.hullPlatform is the canonical authored hull-platform identifier. voidScars is a dense array containing active canonical Void Scar records only. This envelope is a pure domain value, not a new Foundry document path; Foundry persistence remains deferred.

## 7. Hull-capacity model

Every core hull receives this exact authored capacity:

| Hull | Capacity |
|---|---:|
| Void Skiff | 2 |
| Sloop | 3 |
| Cutter | 4 |
| Brigantine | 5 |
| Frigate | 6 |
| Galleon | 7 |
| Hammerhead | 7 |
| Arkcruiser | 9 |
| Dread Caravel | 9 |
| Cathedral Ship | 10 |
| Leviathan-Class Platform | 12 |

For a valid ship:

~~~text
activeVoidScarCount = count(voidScars where status === "active")
effectiveVoidScarCapacity = hull.voidScarCapacity
availableSlots = effectiveVoidScarCapacity - activeVoidScarCount
~~~

Each active Scar consumes exactly one slot. Capacity is a non-negative safe integer; active count cannot be negative or exceed effective capacity in a valid state. A ship may operate at exactly maximum capacity. Scar creation is allowed only when availableSlots is at least 1. When capacity is exhausted, the analyzer reports capacity exhaustion and application fails atomically: no Scar, revision, or creation event is produced. Milestone 9 consumes that result for Catastrophic Breakdown and Emergency Response.

Upgrade modification is deferred to Milestone 13.

Void Scar Capacity is not Hull Integrity. Creating, repairing, stabilizing, or removing a Scar does not change current.hull or derived.hullIntegrity unless a later authored rule says so.

### Capacity-analysis boundary

The exact pure public capacity analyzer is:

~~~js
analyzeVoyageVoidScarCapacity(shipState)
~~~

It accepts only a candidate durable Voyage ship-state snapshot. It accepts no
options, capacity override, upgrade or temporary modifier, caller-authored
plan, caller-authored active-Scar count, caller-authored platform definition,
expected revision request, or mutation request. It safely captures and
validates the complete ship state before deriving any metric.

The effective capacity in this milestone is exactly the captured
`shipState.hull.voidScarCapacity`; no second effective-capacity field is
returned. The active count is exactly `shipState.voidScars.length`.

## 8. Pressure Breach Scar creation

The existing Pressure Breach transaction remains unchanged. It creates one active Hazard, resets the breached system, and emits one event containing one lasting proposal. It does not create a durable Scar.

Milestone 7 adds a separate boundary for an explicitly GM-approved request:

1. Capture and validate the ship and source encounter/event values.
2. Regenerate the canonical Void Scar from the approved source internally.
3. Bind shipId, expectedShipRevision, encounterId, expectedEncounterRevision
   when the source snapshot requires it, exact source event/proposal identity,
   expected proposal, and targeted Pressure system.
4. Reject caller-authored Scar records and caller-authored authoritative plans.
5. Reject duplicate proposal application and capacity exhaustion.
6. Append exactly one isolated active Scar, validate the complete candidate,
   increment the ship revision once, and emit one creation event.

This is a pure ship-domain application of an already approved proposal. It does not mutate encounter revision, activeHazards, Pressure, or the existing Pressure Breach event. Milestone 10 owns closeout preview, GM confirmation, issuance of the approved request, encounter coordination, and durable Foundry persistence.

## 9. Relationship to voidScarProposal

The existing proposal has these exact keys:

~~~text
voidScarProposalId, voidScarId, pressureBreachId, hazardId, encounterId,
stageId, roundNumber, effectIndex, sequence, stationId, actionId,
pressureSystemId, consequenceKind, status, persistence, sourceKind,
pressureEffectId, sourceIntentId, activationSource, branch, timing, visibility,
name
~~~

For the canonical Pressure Breach, fixed values include consequenceKind void-scar, status proposed, persistence lasting, sourceKind pressure-breach, and the matching five-system name. The proposal is not a Scar record: it lacks operational and repair descriptors and has proposal status. Creation maps its provenance into the record in Section 5 and keeps the proposal ID as the idempotency key.

No caller may replace the internally regenerated proposal with a fabricated record or plan. No generic consequence executor, ignored consequence, reward, or closeout path may be invoked.

## 10. Repair rules

### Normal repair

The two exact repair methods are dock-repair and field-repair-resource.

Dock repair removes one compatible active Scar only when all canonical requirements are represented by the request or an authored environment:

1. suitable port or drydock;
2. required facilities;
3. money;
4. repair time; and
5. one Very Hard authored Crafting, Engineering Lore, or other eligible repair check.

The pure Task 4 request carries an already approved facility choice as
`facilityApproval`. Its exact shape and key order are:

~~~js
{
  approved,
  facilityId,
  facilityTag
}
~~~

`approved` must be the literal boolean `true`. `facilityId` and `facilityTag`
must be non-blank exact strings. `facilityTag` must be exactly equal, using
JavaScript string equality with no trimming, case folding, Unicode
normalization, coercion, substring, prefix, or fuzzy matching, to one entry in
the live Scar's `requiredFacilities` array. An empty `requiredFacilities` array
has no compatible facility tag. `facilityId` is binding evidence only; Task 4
does not query or persist a facility registry, prove existence, ownership,
location, availability, payment, scheduling, or GM authority.

`facilityApproval` is a plain, exact-keyed object containing only own
enumerable data properties. Symbols, unsafe keys, accessors, hostile or
unreadable values, class instances, and extra fields are invalid. The analyzer
captures it into isolated data and never returns the approval object.

Milestone 7 receives a precomputed outcome and never rolls. All four valid
normal outcomes complete the repair; they use fixed percentage-point values
in the pure-domain analysis and repair-event contract:

| Outcome | Cost | Time |
|---|---:|---:|
| critical-success | 50% | 50% |
| success | 75% | 75% |
| failure | 125% | 125% |
| critical-failure | 150% | 150% |

All four valid outcomes remove exactly one live-bound active Scar atomically.
Failure and critical-failure are not failed state applications: they do not
leave the Scar active, emit a failed-repair event, create another Scar, damage
Hull Integrity, cause Catastrophic Breakdown, apply a Misfortune, or spend
resources inside this pure boundary. The analyzer reports the exact
percentages; resource calculation and spending remain outside the domain
transition.

### Field Repair Resource

A field-repair-resource operation requires an exact authored
fieldRepairResourceId and an already approved `fieldRepairResourceApproval`
with compatibility with the targeted Scar. It does not
require docking, normal gold, or the Very Hard check. It removes the exact
active Scar on successful validated application. Its result uses outcome: null,
costPercent: null, and timePercent: null; the normal multiplier table does not
apply. This does not claim all in-world repair time is zero.

The exact `fieldRepairResourceApproval` shape and key order are:

~~~js
{
  approved,
  fieldRepairResourceId,
  compatibilityTag
}
~~~

`approved` must be the literal boolean `true`. The nested
`fieldRepairResourceId` must be a non-blank exact string equal to the
top-level request `fieldRepairResourceId`. `compatibilityTag` must be a
non-blank exact string and must be exactly equal, using JavaScript string
equality with no trimming, case folding, Unicode normalization, coercion,
substring, prefix, or fuzzy matching, to one entry in the live Scar's
`compatibleFieldRepairTags` array. An empty tag array has no compatible
resource. The approval object is binding evidence only; Task 4 does not prove
inventory ownership, Item UUID, quantity, rarity, price, availability,
consumption, persistence, or GM authority.

`fieldRepairResourceApproval` is a plain, exact-keyed object containing only
own enumerable data properties. Symbols, unsafe keys, accessors, hostile or
unreadable values, class instances, and extra fields are invalid. The analyzer
captures it into isolated data and never returns the approval object.

Milestone 7 binds an already approved resource use and does not implement
inventory consumption or resource persistence.

Repair releases one Void Scar slot. It does not change base or effective capacity. Stabilizing a Catastrophic Breakdown is not repair and is deferred to Milestone 9.

## 11. Exact public analyzer and application boundaries

These are pure-domain APIs, not existing exports:

~~~js
validateVoyageVoidScarRecord(record, options)
captureVoyageVoidScarRecord(record, options)
validateVoyageShipState(state)
captureVoyageShipState(state)
analyzeVoyageVoidScarCapacity(shipState)

analyzeVoyagePressureBreachVoidScarCreation(
  shipState,
  sourceEncounterStateOrEvent,
  request
)

applyVoyagePressureBreachVoidScarCreation(
  shipState,
  sourceEncounterStateOrEvent,
  request
)

analyzeVoyageVoidScarRepair(shipState, request)
applyVoyageVoidScarRepair(shipState, request)
~~~

Creation request key order is:

~~~js
{
  shipId,
  expectedShipRevision,
  encounterId,
  expectedEncounterRevision,
  sourceEventType,
  sourceEncounterRevision,
  sourceProposal,
  pressureSystemId
}
~~~

sourceProposal is the expected isolated proposal from the approved source
event/snapshot. The analyzer and application regenerate the authoritative
Void Scar internally. No caller-authored Scar record, collision analysis,
plan, effect list, capacity result, or event payload is accepted.

Repair request key order is:

~~~js
{
  shipId,
  expectedShipRevision,
  voidScarId,
  existingVoidScarIndex,
  previousVoidScar,
  repairMethod,
  outcome,
  facilityApproval,
  fieldRepairResourceId,
  fieldRepairResourceApproval
}
~~~

All ten fields are required own enumerable data properties. Omitted and
`undefined` fields are invalid; method-forbidden fields must be exactly `null`.

repairMethod is exactly dock-repair or field-repair-resource. For dock-repair,
outcome is one of the four normal outcomes, facilityApproval has the exact
shape above, fieldRepairResourceId is null, and
fieldRepairResourceApproval is null. For field-repair-resource, outcome and
facilityApproval are null, fieldRepairResourceId is a non-blank exact string,
and fieldRepairResourceApproval has the exact shape above.

The exact result envelopes are:

~~~js
// Creation analyzer, success or failure
{
  readyForVoidScarCreation,
  shipId,
  expectedShipRevision,
  sourceEventType,
  sourceEncounterRevision,
  sourceProposal,
  voidScar,
  activeVoidScarCount,
  voidScarCapacity,
  availableSlots,
  errors,
  warnings
}

// Creation application, success or failure
{
  ok,
  nextState,       // isolated durable ship-domain state or null
  events,          // [] on failure, exactly [event] on success
  errors,
  warnings
}

// Repair analyzer, success or failure
{
  readyForVoidScarRepair,
  shipId,
  voidScarId,
  repairMethod,
  outcome,
  costPercent,
  timePercent,
  removesScar,
  errors,
  warnings
}

// Repair application, success or failure
{
  ok,
  nextState,       // isolated state or null
  events,          // [] on failure, exactly [event] on success
  errors,
  warnings
}
~~~

### Capacity-analysis result

The capacity analyzer has one exact result envelope and key order:

~~~js
{
  ok,
  shipId,
  hullPlatform,
  voidScarCapacity,
  activeVoidScarCount,
  availableSlots,
  capacityExhausted,
  canAcceptVoidScar,
  errors,
  warnings
}
~~~

For a valid state, the exact successful shape is:

~~~js
{
  ok: true,
  shipId,
  hullPlatform,
  voidScarCapacity,
  activeVoidScarCount,
  availableSlots,
  capacityExhausted,
  canAcceptVoidScar,
  errors: [],
  warnings: []
}
~~~

The fields mean:

- `shipId` is the captured `shipState.shipId`.
- `hullPlatform` is the captured `shipState.installed.hullPlatform`.
- `voidScarCapacity` is the captured authored/effective capacity.
- `activeVoidScarCount` is the captured `shipState.voidScars.length`.
- `availableSlots` is `voidScarCapacity - activeVoidScarCount`.
- `capacityExhausted` is exactly `availableSlots === 0`.
- `canAcceptVoidScar` is exactly `availableSlots > 0`.

No aliases such as `freeSlots`, `remainingCapacity`, `maximumScars`,
`effectiveCapacity`, `hasCapacity`, `canCreate`, or `isFull` are part of this
result.

For an invalid state, the exact failed shape and key order are:

~~~js
{
  ok: false,
  shipId: null,
  hullPlatform: null,
  voidScarCapacity: null,
  activeVoidScarCount: null,
  availableSlots: null,
  capacityExhausted: null,
  canAcceptVoidScar: null,
  errors,
  warnings
}
~~~

The failure result has no partial metric, state, event, or caller reference.
The analyzer uses `captureVoyageShipState(shipState)`, preserves its exact
diagnostic ordering and codes in `errors` and `warnings`, and adds no generic
malformed-state diagnostic. No raw JavaScript exception text is exposed.

Exactly-at-capacity is valid, not an error, warning, exception, or mutation:

~~~js
{
  ok: true,
  availableSlots: 0,
  capacityExhausted: true,
  canAcceptVoidScar: false,
  errors: [],
  warnings: []
}
~~~

Below capacity, `availableSlots` is positive, `capacityExhausted` is false,
and `canAcceptVoidScar` is true. One remaining slot therefore reports
`availableSlots: 1`, `capacityExhausted: false`, and
`canAcceptVoidScar: true`.

The analyzer is pure and deterministic. It never changes revision, returns a
next state, emits an event, creates a Scar, changes Hull Integrity, or invokes
Catastrophic Breakdown or Emergency Response. Invalid input—including unknown
platforms, capacity mismatch, malformed or duplicate Scars, over-capacity
state, invalid or unsafe revision, and hostile data—returns the exact failed
envelope with no capacity metrics. Returned diagnostics and values are
isolated; equivalent canonical or hostile inputs produce deeply equal
results.

Neither boundary performs PF2e rolls, Actor lookups, ownership checks, Foundry
updates, generic resource spending, or UI/socket work. Returned analyses are
inspection data and never authorization tokens.

The capacity analyzer is informational only and consumes no ship revision and
emits no event. Task 2 creation analysis may reuse this analyzer or a narrow
internal metric helper, but it must not accept or trust a caller-authored
capacity result. Task 2 preserves its existing request, analysis, application,
duplicate-precedence, stale-identity/revision precedence, creation-event, and
atomicity contracts.

## 12. Concurrency, authority, and atomicity

Every analyzer and application must:

- safely capture both roots and every nested descriptor;
- validate exact schema and canonical identifiers;
- bind encounter identity, ship identity, expected encounter revision, expected ship revision, exact source event/proposal provenance, and live Scar index/snapshot where applicable;
- regenerate the Pressure Breach proposal from domain state;
- reject duplicate Scar identity and duplicate breach provenance;
- reject capacity overflow and safe-integer count/revision arithmetic overflow;
- construct a complete isolated candidate before returning success;
- validate the complete final ship state;
- increment exactly one durable revision on successful creation or repair;
- return deterministic structured diagnostics on every failure;
- preserve caller inputs, prior state, and returned structures by deep isolation; and
- fail closed for unsupported repair kinds, unknown systems, malformed authored descriptors, hostile data, stale snapshots, and fabricated plans.

Invalid, stale, duplicate, or capacity-exhausted operations return no partial
ship state, no partial Scar, no capacity change, no Hull Integrity change, no
revision increment, and no event. A valid dock-repair outcome, including
failure and critical-failure, is a successful removal transition with one next
ship state, one revision, and one repair event. A valid field-repair-resource
operation has null outcome and percentages and likewise removes one Scar with
one revision and one event.

## 13. Event inventory and cardinality

The repository currently emits no Void Scar or hull-capacity events. The existing voyage.pressure-breach-applied event remains unchanged and carries the proposal only.

| Event or condition | Milestone 7 status | Proposed payload/cardinality |
|---|---|---|
| voyage.pressure-breach-applied | Existing; unchanged | Existing exact payload; one encounter revision and one event; proposal remains uncommitted |
| voyage.void-scar-created | Required for pure successful creation | Exact keys, in order: type, shipId, encounterId, pressureSystemId, sourceEventType, sourceEncounterRevision, sourceProposal, previousShipRevision, revision, previousVoidScarCount, voidScarCount, voidScar; one ship revision and one event |
| voyage.void-scar-repaired | Required for every valid removal | Exact keys, in order: type, shipId, voidScarId, pressureSystemId, repairMethod, outcome, costPercent, timePercent, fieldRepairResourceId, previousShipRevision, revision, previousVoidScar, previousVoidScarCount, voidScarCount; one ship revision and one event |
| failed repair event | Not emitted | Invalid or stale applications return no state, revision, or event; valid failure and critical-failure outcomes still remove the Scar and emit the repair event |
| capacity analysis | Required pure informational result | `analyzeVoyageVoidScarCapacity(shipState)` returns the exact metric envelope; no revision, state mutation, Scar, or event |
| Hull-capacity change | Deferred | No Milestone 7 producer; upgrade-derived capacity changes belong to authored upgrade work |
| Scar stabilization | Milestone 9 | No Milestone 7 producer; stabilization is not repair |
| Capacity exhaustion / Catastrophic Breakdown | Milestone 9 | No Scar-created event; return a fail-closed deferred Breakdown analysis |
| closeout preview/application | Milestone 10 | No Milestone 7 producer |

Event snapshots and arrays must be isolated from both input and next-state records. No event may contain executable functions, Foundry documents, PF2e objects, or caller-owned references.

For dock-repair, fieldRepairResourceId is null and outcome, costPercent, and
timePercent use the normal table. For field-repair-resource, outcome,
costPercent, and timePercent are null and fieldRepairResourceId is required.
No generic effects, resource transactions, PF2e rolls, Foundry objects, or
callbacks belong in either event.

### Repair diagnostic ownership and precedence

After ship-state capture and validation, request capture, ship identity,
expected revision, live Scar index, live Scar identity, and exact
`previousVoidScar` snapshot binding succeed, repair validation uses this exact
precedence:

1. validate `repairMethod`;
2. for Dock Repair, require `fieldRepairResourceId` to be null;
3. for Dock Repair, require `fieldRepairResourceApproval` to be null;
4. validate `facilityApproval` shape;
5. validate facility approval ID/tag values;
6. require exact `facilityTag` membership in live `requiredFacilities`;
7. validate the exact Dock outcome;
8. for Field Repair Resource, require `outcome` to be null;
9. for Field Repair Resource, require `facilityApproval` to be null;
10. validate the resource ID;
11. validate `fieldRepairResourceApproval` shape;
12. require nested and top-level resource IDs to match exactly;
13. require exact `compatibilityTag` membership in live
    `compatibleFieldRepairTags`.

Specific concurrency and live-snapshot diagnostics always precede these
method-specific diagnostics. No generic repair-analysis wrapper diagnostic is
added when a specific diagnostic applies.

The exact method-specific diagnostic codes and paths are:

| Code | Path | Meaning |
|---|---|---|
| `missing-repair-facility-approval` | `request.facilityApproval` | Required Dock approval is absent when root exact-key capture has not already reported the missing field. |
| `invalid-repair-facility-approval` | `request.facilityApproval` or exact nested path | Dock approval is non-plain, malformed, unreadable, unsafe, extra-keyed, not literally approved, or has a blank ID/tag. |
| `unsuitable-repair-facility` | `request.facilityApproval.facilityTag` | Valid tag is not an exact member of live `requiredFacilities`. |
| `unexpected-repair-facility-approval` | `request.facilityApproval` | Field Repair Resource supplied non-null facility approval. |
| `missing-field-repair-resource-id` | `request.fieldRepairResourceId` | Required Field Repair Resource ID is absent. |
| `invalid-field-repair-resource-id` | `request.fieldRepairResourceId` | Resource ID is blank or not an exact string. |
| `missing-field-repair-resource-approval` | `request.fieldRepairResourceApproval` | Required Field Repair approval is absent. |
| `invalid-field-repair-resource-approval` | `request.fieldRepairResourceApproval` or exact nested path | Resource approval is non-plain, malformed, unreadable, unsafe, extra-keyed, not literally approved, or has a blank ID/tag. |
| `field-repair-resource-approval-mismatch` | `request.fieldRepairResourceApproval.fieldRepairResourceId` | Nested resource ID differs from the top-level ID. |
| `incompatible-field-repair-resource` | `request.fieldRepairResourceApproval.compatibilityTag` | Valid tag is not an exact member of live `compatibleFieldRepairTags`. |
| `unexpected-field-repair-resource-id` | `request.fieldRepairResourceId` | Dock Repair supplied a non-null resource ID. |
| `unexpected-field-repair-resource-approval` | `request.fieldRepairResourceApproval` | Dock Repair supplied non-null resource approval. |

Generic request-capture diagnostics remain authoritative for missing root
fields, unknown root keys, symbols, unsafe keys, and unreadable request roots.
"Fabricated" evidence means false/non-boolean approval, mismatched nested
resource ID, absent facility/resource tag, unknown approval fields, or
malformed, unsafe, unreadable, or hostile approval data. The analyzer does not
judge whether a well-formed upstream approval was honestly issued.

Both approval shapes must fail closed for revoked root or nested Proxies,
throwing `ownKeys` and `getOwnPropertyDescriptor` traps, accessors, symbols,
unsafe keys, cycles, arrays, sparse or extra-keyed arrays, non-finite values,
unsupported primitives and objects, and missing fields. Diagnostics must not
expose raw exception, Proxy, revocation, trap, stack, or engine-specific text;
no hostile approval reference may be retained or returned. Equivalent fresh
hostile inputs produce deeply equal failed results.

## 14. All-five-system behavior

Pressure Breach creation must be exercised for every canonical system:

~~~text
crew-morale       -> Crew Morale Void Scar
arkengine         -> Arkengine Void Scar
levstone-array    -> Levstone Array Void Scar
solar-sail-rig    -> Solar Sail Rig Void Scar
lifeveil          -> Lifeveil Void Scar
~~~

Each system uses the same schema and capacity transaction. System ID, Hazard identity, proposal identity, name, and provenance remain exact and deterministic. Repair compatibility is authored per record; no system receives an implicit special repair rule.

## 15. Test plan

### Schema and capture

- exact keys, required types, canonical five-system IDs, and all provenance;
- stable voidScarId and proposal-to-record mapping;
- plain-data, dense-array, finite-number, safe-integer, unsafe-key, accessor, Proxy/revocation, cycle, symbol, BigInt, function, undefined, and hostile nested-data rejection;
- deterministic diagnostics, caller isolation, and independent returned values;
- valid active records and invalid terminal/status variants.

### Hull and capacity

- all eleven canonical hull capacities;
- no tier/room-slot inference;
- zero, below-maximum, exactly-maximum, duplicate, overflow, and arithmetic overflow cases;
- no mutation of current.hull, derived.hullIntegrity, Pressure, or encounter activeHazards.
- exact capacity-analysis success and failure key order;
- exact `shipId`, `hullPlatform`, `voidScarCapacity`, `activeVoidScarCount`,
  `availableSlots`, `capacityExhausted`, and `canAcceptVoidScar` values;
- one remaining slot, exact exhaustion, invalid-state diagnostic preservation,
  caller/result/cross-call isolation, deterministic hostile failures, and no
  revision or event.

### Creation

- one accepted proposal for each of the five systems;
- internally regenerated proposal and fabricated-proposal rejection;
- duplicate voidScarId and duplicate pressureBreachId rejection;
- stale encounter/ship revisions, ship identity, and source identity;
- exact one-event/one-revision success and zero-event/zero-revision failure;
- deterministic equivalent calls and cross-call isolation.

### Repair

- normal eligibility, facility/context validation, and field-repair tags;
- all four normal outcomes and exact fixed 50/75/125/150 percentage-point
  terms;
- successful one-Scar removal for all four normal outcomes, exact outcome percentages, capacity release, and no Hull Integrity mutation;
- field repair without docking, gold, or PF2e checks, with exact fieldRepairResourceId compatibility and null outcome/percentages;
- stale snapshots, duplicate requests, safe-integer overflow, hostile input, deterministic results, and exact success event shape.
- exact ten-field repair-request key order and required own data properties;
- exact three-field `facilityApproval` shape, literal approval, non-blank ID,
  required-facility tag membership, unsuitable-tag rejection, null resource
  fields, and exact diagnostics/precedence;
- exact three-field `fieldRepairResourceApproval` shape, literal approval,
  top-level/nested resource-ID equality, compatibility-tag membership, null
  Dock fields, and exact diagnostics/precedence;
- no trimming, case folding, Unicode normalization, coercion, substring,
  prefix, fuzzy matching, registry lookup, inventory lookup, or approval
  reference in returned analysis;
- hostile and revoked approval objects, accessors, reflection traps, unsafe
  keys, cycles, sparse/extra-key arrays, deterministic failures, and
  cross-call isolation.

### Boundary regressions

- no PF2e orchestration, Foundry registration, persistence, sockets, UI, authority, generic consequence execution, reward, Misfortune, closeout, Catastrophic Breakdown, or Emergency Response behavior;
- existing Milestone 6 Hazard, Pressure Breach, proposal, revision, and event contracts remain unchanged.

## 16. Implementation slices

### Task 0 - Accepted contract and decisions

- **Capability:** Freeze the accepted decision set in this contract.
- **Production files:** None.
- **Tests:** None; document review only.
- **Public API:** None.
- **Non-goals:** No schema or runtime code.
- **Focused regressions:** Verify the Milestone 6 contract and proposal event remain unchanged.

### Task 1 - Hull and Scar schema/capture

- **Capability:** Add voidScarCapacity to all core hull definitions and add safe Void Scar and durable ship-state capture/validation.
- **Expected production files:** data/hulls/core-hulls.js, new scripts/voyage/domain/void-scar-schema.js, and the selected pure ship-state helper.
- **Expected tests:** tests/voyage/domain/void-scar-schema.test.mjs and focused hull-capacity cases.
- **Public API:** validateVoyageVoidScarRecord, captureVoyageVoidScarRecord, validateVoyageShipState, captureVoyageShipState.
- **Non-goals:** No proposal application, repair, Foundry write, or events.
- **Focused regressions:** Hostile data, five systems, eleven capacities, exact keys, and isolation.

### Task 2 - Approved Pressure Breach proposal analysis and atomic Scar creation

- **Capability:** Regenerate an accepted M6 proposal and apply one Scar to a pure ship-domain candidate atomically.
- **Expected production files:** new scripts/voyage/domain/void-scar-application.js; narrow pressure-breach.js integration only if needed to expose the proposal boundary.
- **Expected tests:** new creation/application tests plus pressure-breach-void-scar and pressure-breach-application regressions.
- **Public API:** analyzeVoyagePressureBreachVoidScarCreation(shipState, sourceEncounterStateOrEvent, request), applyVoyagePressureBreachVoidScarCreation(shipState, sourceEncounterStateOrEvent, request).
- **Non-goals:** No encounter mutation, Foundry persistence, or generic permanent-consequence execution.
- **Focused regressions:** One event/revision, duplicate/fabricated-proposal rejection, stale snapshots, five systems, and overflow.

### Task 3 - Capacity analysis and capacity-exhaustion result

- **Capability:** Calculate active count, base/effective capacity, available slots, and a fail-closed capacity-exhaustion result.
- **Expected production files:** new scripts/voyage/domain/void-scar-capacity.js and selected ship-state helper.
- **Expected tests:** tests/voyage/domain/void-scar-capacity.test.mjs for every hull, boundary, invalid state, hostile input, exact keys, diagnostics, isolation, and determinism.
- **Public API:** `analyzeVoyageVoidScarCapacity(shipState)`.
- **Successful result key order:** `ok`, `shipId`, `hullPlatform`, `voidScarCapacity`, `activeVoidScarCount`, `availableSlots`, `capacityExhausted`, `canAcceptVoidScar`, `errors`, `warnings`.
- **Failed result key order:** the same order, with `ok: false`, all seven metric/identity fields null, and captured ship-state `errors`/`warnings`.
- **Production capability:** pure canonical metrics and valid exhaustion reporting; no mutation, revision, event, Scar creation, Catastrophic Breakdown, Emergency Response, or Hull damage.
- **Non-goals:** No Catastrophic Hazard, Emergency Response, or Hull damage.
- **Atomicity:** Exact maximum is valid; one additional Scar is rejected without mutation, revision, or event.
- **Non-goals:** No Catastrophic Breakdown or Emergency Response execution.

### Task 4 - Dock and Field Repair Resources repair analysis

- **Capability:** Validate dock-repair and field-repair-resource requests, eligibility, compatibility, exact outcomes, and fixed percentage-point cost/time terms without mutation.
- **Expected production files:** scripts/voyage/domain/void-scar-repair.js.
- **Expected tests:** tests/voyage/domain/void-scar-repair.test.mjs for exact ten-field request capture, live Scar binding, normal/field repair, outcomes, facility approval, compatibility evidence, diagnostics, isolation, and hostile data.
- **Public API:** analyzeVoyageVoidScarRepair(shipState, request).
- **Production capability:** exact ten-field request capture; exact `facilityApproval` and `fieldRepairResourceApproval` capture; live Scar binding; Dock Repair terms; Field Repair compatibility; pure analysis only.
- **Non-goals:** No PF2e roll, inventory consumption, resource persistence, or ship mutation.
- **Atomicity:** Valid failure and critical-failure outcomes are repair successes that remove the Scar; invalid requests do not mutate.

### Task 5 - Atomic repair application and events

- **Capability:** Remove one compatible Scar for every valid normal outcome or field-repair-resource request, release one slot, validate final state, and emit the exact repair event.
- **Expected production files:** scripts/voyage/domain/void-scar-repair.js and selected event constants.
- **Expected tests:** repair application/event tests, revision cardinality, active-only preservation, exact dock/field payloads, and isolation.
- **Public API:** applyVoyageVoidScarRepair(shipState, request).
- **Authority:** Application accepts the original exact ten-field request and regenerates Task 4 analysis internally. It does not accept caller-authored analysis, approval replacement, compatibility replacement, percentages, event, or next state; approval evidence is not persisted into durable ship state.
- **Non-goals:** No failed-repair event, resource spending, closeout, persistence, UI, or authority.
- **Atomicity:** Every valid removal is one revision and one event; invalid/stale/capacity failures are zero revision and zero events.

### Task 6 - Milestone 7 cumulative audit

- **Capability:** Run the complete focused and Voyage suites and verify every deferred boundary.
- **Expected production files:** None beyond reviewed prior slices.
- **Expected tests:** all Void Scar, hull, Pressure Breach, state, repair, domain, PF2e, and combined suites.
- **Public API:** Final audit of the APIs above.
- **Non-goals:** No Milestones 8-13 implementation.
- **Focused regressions:** Determinism, isolation, stale protection, event cardinality, and no runtime behavior.

## 17. Deferred Milestones 8-13

- **Milestone 8:** overall event result, Reward Steps, Negative Steps, Misfortunes, authored Field Repair Resource rewards, and reward allocation.
- **Milestone 9:** Catastrophic Breakdown, mandatory Catastrophic Hazard, Emergency Response, stabilization, and capacity-exhaustion consequences.
- **Milestone 10:** pure closeout preview, GM review, controlled persistent application, durable idempotency, and Foundry document writes.
- **Milestone 11:** recoverable session runtime, request envelopes, GM authority, sockets, projections, reload, and audited correction.
- **Milestone 12:** first player-facing vertical slice, UI, PF2e roll orchestration, and session recovery proof.
- **Milestone 13:** upgrade hooks, capacity modifiers, Scar protection, repair improvements, and broader ship integration.

No Milestone 7 API may execute any deferred behavior indirectly.

## 18. Canonical event and state boundary summary

~~~text
Pressure Breach (Milestone 6 encounter transaction)
  -> active Hazard + Pressure reset + lasting voidScarProposal
  -> one encounter revision + voyage.pressure-breach-applied

Approved proposal (Milestone 7 pure ship-domain boundary)
  -> one active VoidScarRecord, if capacity permits
  -> one ship revision + voyage.void-scar-created

Capacity analysis (Milestone 7 pure informational boundary)
  -> exact count, capacity, slots, exhaustion, and acceptance metrics
  -> no ship revision + no event

Repair outcome (Milestone 7 pure ship-domain boundary)
  -> remove one active Scar for every valid normal outcome or field resource
  -> one ship revision + voyage.void-scar-repaired

At capacity + another proposal
  -> no Scar mutation; deferred Catastrophic Breakdown analysis
~~~

## 19. Fixed Milestone 7 decisions and deferred integration

The following pure-domain decisions are fixed and implemented by Tasks 1
through 5:

- the canonical creation source transport is exactly
  `voyage.pressure-breach-applied`;
- the Milestone 6 `voidScarProposal` remains proposal-only until explicit
  approved creation evidence is supplied, after which the canonical Scar is
  regenerated internally and caller-authored Scars or application plans have
  no authority;
- capacity is the authored installed-hull `voidScarCapacity`, exhaustion is
  exactly zero available slots, exactly-at-capacity is valid, and duplicate
  creation is rejected atomically;
- Dock Repair uses fixed `costPercent`/`timePercent` percentage-point terms of
  50/50, 75/75, 125/125, and 150/150 for critical-success, success, failure,
  and critical-failure;
- all four Dock outcomes complete repair and remove the active Scar; Field
  Repair Resource uses `outcome: null`, `costPercent: null`, and
  `timePercent: null` and also removes the active Scar;
- durable ship state stores active Scars only, while the repair event retains
  the isolated `previousVoidScar` snapshot;
- each successful creation or repair consumes exactly one revision and emits
  exactly one event, while failed applications produce no mutation, revision,
  or event.

The remaining work is explicitly deferred integration ownership, not an
unresolved Milestone 7 choice:

- Milestone 9 owns Catastrophic Breakdown, Catastrophic Hazard, Emergency
  Response, and stabilization;
- Milestone 10 owns Foundry persistence, document mutation, sockets, GM
  authority, approval UI, inventory and resource integration, spending,
  durable idempotency, closeout, orchestration, and player projection/privacy.

## 20. Contract acceptance criteria

This contract records the accepted and completed Milestone 7 Tasks 0 through
5. It preserves the canonical Event Runner rules, the Milestone 6 Hazard
contract, and the explicit Milestone 8 through 13 deferrals above. No
implemented Task 1 through 5 boundary remains a placeholder or unresolved
gameplay decision.
