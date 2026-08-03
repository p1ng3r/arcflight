# Arcflight Gameplay V3 - Milestone 7: Void Scars, Hull Capacity, and Repair

**Status:** Accepted documentation-only contract after the canonical decision
pass. No Milestone 7 production or test implementation exists yet.

**Canonical authority:** The canonical Event Runner rules, the Gameplay V3 Canonical Audit and Milestone Map, and the accepted Milestone 6 Hazard Engine Contract remain authoritative. This document records the smallest pure-domain contract that can be implemented without changing those sources.

**Scope:** Foundry-free plain data, validation, analysis, and atomic domain boundaries for Void Scar records, hull capacity, and repair. Foundry document writes, GM authority, sockets, projections, UI, PF2e roll orchestration, and closeout application remain outside this milestone.

## 1. Audit conclusion

Milestone 6 intentionally leaves a Pressure Breach Void Scar as a proposal. Its existing transaction persists the active Hazard in temporary activeHazards, resets the breached Pressure system, increments the encounter revision once, emits one voyage.pressure-breach-applied event, and includes one lasting voidScarProposal. It does not mutate a ship or consume hull capacity.

The current repository has no durable Void Scar collection, Void Scar schema, hull-capacity field, repair analyzer, repair application, or Scar event producer. The five canonical Pressure systems and the existing proposal are the available source boundary for this milestone.

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

Milestone 7 receives a precomputed outcome and never rolls. All four valid
normal outcomes complete the repair; they differ only in authored cost/time
percentages, rounded upward by the implementation's chosen unit:

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
fieldRepairResourceId and compatibility with the targeted Scar. It does not
require docking, normal gold, or the Very Hard check. It removes the exact
active Scar on successful validated application. Its result uses outcome: null,
costPercent: null, and timePercent: null; the normal multiplier table does not
apply. This does not claim all in-world repair time is zero.

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
  fieldRepairResourceId
}
~~~

repairMethod is exactly dock-repair or field-repair-resource. For dock-repair,
outcome is one of the four normal outcomes, facilityApproval is required, and
fieldRepairResourceId is null. For field-repair-resource, outcome and
facilityApproval are null and fieldRepairResourceId is required.

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

Neither boundary performs PF2e rolls, Actor lookups, ownership checks, Foundry
updates, generic resource spending, or UI/socket work. Returned analyses are
inspection data and never authorization tokens.

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

### Creation

- one accepted proposal for each of the five systems;
- internally regenerated proposal and fabricated-proposal rejection;
- duplicate voidScarId and duplicate pressureBreachId rejection;
- stale encounter/ship revisions, ship identity, and source identity;
- exact one-event/one-revision success and zero-event/zero-revision failure;
- deterministic equivalent calls and cross-call isolation.

### Repair

- normal eligibility, facility/context validation, and field-repair tags;
- all four normal outcomes and exact 50/75/125/150% upward rounding;
- successful one-Scar removal for all four normal outcomes, exact outcome percentages, capacity release, and no Hull Integrity mutation;
- field repair without docking, gold, or PF2e checks, with exact fieldRepairResourceId compatibility and null outcome/percentages;
- stale snapshots, duplicate requests, safe-integer overflow, hostile input, deterministic results, and exact success event shape.

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
- **Expected tests:** capacity analyzer tests for every hull and boundary.
- **Public API:** analyzeVoyageVoidScarCapacity.
- **Non-goals:** No Catastrophic Hazard, Emergency Response, or Hull damage.
- **Atomicity:** Exact maximum is valid; one additional Scar is rejected without mutation, revision, or event.
- **Non-goals:** No Catastrophic Breakdown or Emergency Response execution.

### Task 4 - Dock and Field Repair Resources repair analysis

- **Capability:** Validate dock-repair and field-repair-resource requests, eligibility, compatibility, exact outcomes, and rounded cost/time without mutation.
- **Expected production files:** scripts/voyage/domain/void-scar-repair.js.
- **Expected tests:** repair planning tests for normal/field repair, outcomes, contexts, tags, and hostile data.
- **Public API:** analyzeVoyageVoidScarRepair.
- **Non-goals:** No PF2e roll, inventory consumption, resource persistence, or ship mutation.
- **Atomicity:** Valid failure and critical-failure outcomes are repair successes that remove the Scar; invalid requests do not mutate.

### Task 5 - Atomic repair application and events

- **Capability:** Remove one compatible Scar for every valid normal outcome or field-repair-resource request, release one slot, validate final state, and emit the exact repair event.
- **Expected production files:** scripts/voyage/domain/void-scar-repair.js and selected event constants.
- **Expected tests:** repair application/event tests, revision cardinality, active-only preservation, exact dock/field payloads, and isolation.
- **Public API:** applyVoyageVoidScarRepair.
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

Repair outcome (Milestone 7 pure ship-domain boundary)
  -> remove one active Scar for every valid normal outcome or field resource
  -> one ship revision + voyage.void-scar-repaired

At capacity + another proposal
  -> no Scar mutation; deferred Catastrophic Breakdown analysis
~~~

## 19. Remaining implementation choices (not canonical gameplay decisions)

The seven canonical decisions above are resolved. No blocking canonical
ambiguity remains for the pure Milestone 7 slice. These are non-gameplay
implementation choices to record in code review:

- internal file/module split and the concrete safe-schema helper, while
  preserving the exact public APIs;
- JSON/schema library versus manual validation, while preserving plain data and
  hostile-input defenses;
- the rounding unit for cost and time; canonical behavior is upward rounding,
  and the implementation must document its chosen unit;
- the exact source-snapshot transport shape between Milestones 10 and 7, while
  retaining the required request keys and provenance bindings; and
- Foundry adapter/persistence paths, socket envelopes, UI, and projections,
  which remain deferred to Milestones 10-12.

No implementation choice may add mechanics or change event fields,
cardinality, or ownership defined above.

## 20. Contract acceptance criteria

This contract is accepted for implementation beginning with Task 1. No
Milestone 7 production JavaScript or tests were added by this documentation
pass. Every implementation slice must preserve the canonical Event Runner
rules, the Milestone 6 Hazard contract, and the explicit Milestone 8-13
deferrals above.
