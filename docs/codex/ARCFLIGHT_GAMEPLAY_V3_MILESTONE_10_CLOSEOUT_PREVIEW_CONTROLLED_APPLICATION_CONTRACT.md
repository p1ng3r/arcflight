# Arcflight Gameplay V3 Milestone 10 — Closeout Preview and Controlled Application

**Status:** Task 0 contract lock. This document authorizes no production,
test, Foundry, PF2e, persistence, registration, or UI change by itself.

**Canonical authority, in precedence order:**

1. `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`;
2. `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`;
3. the accepted standalone Milestone 6, 7, 8, and 9 contracts for behavior
   they already own; and
4. this contract for previously unspecified Milestone 10 details.

When those sources differ, the higher source governs. This contract must not
weaken M6 Hazard rules, M7 capacity arithmetic, M8 result mathematics, M9
Breakdown semantics, M11 runtime authority, or M12 UI/PF2e ownership.

## 1. Audit conclusion

The repository now contains the complete pure-domain M6–M9 prerequisites, but
it contains no M10 module, contract, branch, persistence adapter, or exported
M10 API. The canonical map fixes M10's three responsibilities but deliberately
leaves schemas, diagnostics, storage paths, transaction recovery, and API names
open.

Two predecessor handoffs require explicit M10 decisions:

- M6 permits descriptive `ignoredConsequence` data but defines no generic
  closeout executor. M10 therefore accepts only the closed closeout
  consequence schemas in Section 8 and fails closed for every other shape.
- M8 may propose an ordinary closeout Scar whose provenance is not an M7
  Pressure Breach. M10 therefore defines a versioned closeout Scar variant in
  Section 13. It does not fabricate an M7 Pressure Breach source or alter the
  existing M7 Pressure-Breach record.

The current Voyage Encounter domain also has no complete Focus, temporary
benefit, suppression, or closeout-review runtime representation. M10 therefore
uses the exact closeout snapshot in Section 7. M11 may later construct and
persist that snapshot as part of its recoverable session runtime; M10 does not
invent sockets or a second session runtime.

## 2. Purpose

Milestone 10 owns:

- pure closeout calculation in canonical order;
- unresolved-Hazard closeout consequence planning;
- resulting Pressure and Pressure Breach planning;
- ordinary Scar-capacity review and the exact M10-to-M9 exhaustion handoff;
- complete reward, Misfortune, Scar, Breakdown, system, resource, history, and
  temporary-reset preview composition;
- GM review of one regenerated complete preview;
- one immutable approved application plan;
- a pure atomic encounter/ship application candidate;
- active-GM-gated Foundry persistence after confirmation;
- optimistic revision checks, durable idempotency, and single-Actor
  retry/reconciliation; and
- preservation of PF2e-owned data and sibling Arcflight flags.

Milestone 10 never trusts a caller-authored calculation, proposal list, next
state, mutation patch, event list, idempotency status, or approval token.

## 3. Explicit exclusions

The following remain outside M10:

- command/request transport envelopes, sockets, unique runtime request IDs,
  distributed duplicate delivery handling, connection transfer, session
  persistence, reload recovery, and filtered projections (M11);
- windows, dialogs, sheets, chat presentation, player/observer views, ending
  media, and PF2e Item or roll orchestration (M12);
- generic effect execution, macros, callbacks, scripts, expressions, and
  arbitrary authored payload application;
- direct repair, dock checks, Field Repair Resource consumption, and M7 repair
  outcome rolling;
- unauthored rewards, Misfortunes, Hazards, Scars, Breakdowns, or next
  situations;
- automatic system re-enablement after Emergency Response stabilization;
- direct mutation of PF2e-owned Actor `system` data;
- migration of existing M7 Pressure-Breach Scar records; and
- normal event travel.

The M10 adapter's active-GM check is a local write precondition only. M11 owns
network command authority and transport freshness. No M10 value is a socket
command or proof that a remote caller is authorized.

## 4. Canonical closeout order

M10 must preserve this exact order:

1. validate the final completed round history;
2. regenerate the final round and overall M8 result;
3. regenerate Reward Steps plus allocation, or Negative Steps plus one
   selected package;
4. process unresolved Hazards in captured active-Hazard order;
5. apply each supported closeout consequence to the simulation;
6. process each resulting Pressure Breach before the next Hazard;
7. classify every ordinary Scar proposal against the then-current simulated
   ship capacity;
8. generate an ordinary Scar proposal or exact M10-to-M9 exhaustion handoff;
9. regenerate any required M9 Breakdown or completed Emergency Response
   proposal;
10. generate the exact temporary-state reset plan after all closeout effects;
11. compose one complete mechanical preview;
12. obtain one GM confirmation of that regenerated preview;
13. create a recovery checkpoint and durable prepared ledger entry;
14. revalidate active GM, identities, revisions, and duplicate state;
15. persist the complete approved ship change and committed ledger entry;
16. return the isolated completed encounter state and audit history record.

No persistent ship write may occur before Step 12. Pressure resets only after
all Hazard effects and resulting Breaches have been processed. A failed step
produces no later-step authority.

## 5. Existing boundary reuse

M10 regenerates rather than accepts predecessor analyses:

- M6 validates and captures complete Hazard records. M10 does not fork that
  record schema or call a generic Hazard consequence executor.
- Existing Pressure and Pressure-Breach arithmetic remains canonical. M10 may
  use narrow internal helpers or the existing pure analyzers but must preserve
  their system vocabulary, overflow rule, reset behavior, deterministic
  proposal identity, and event data.
- M7 owns ship-state validation, exact capacity arithmetic, and existing
  Pressure-Breach Scar creation. M10 never fabricates M7 source evidence.
- M8 owns overall result, Reward Steps, Negative Steps, reward allocation, and
  selected Misfortune packages. M10 supplies only caller selections and
  regenerates the applicable M8 result.
- M9 owns Catastrophic Breakdown and Emergency Response analysis. M10 alone
  establishes the capacity-exhaustion handoff, then calls M9 with the exact
  accepted descriptor.

An analyzer result from M6–M9 is inspection data. Possession of it grants no
M10 review or persistence authority.

## 6. Primitive, hostile-data, and identity rules

Unless nullable by an exact schema, strings are nonblank exact UTF-16 strings
with surrounding whitespace rejected. Numbers are finite safe integers within
their stated range. Arrays are dense own-entry arrays with no extra own keys.
Objects are plain objects using `Object.prototype` or a null prototype and
contain only own enumerable data properties in declared insertion order.

Every public M10 boundary safely captures before validation and never throws
for arbitrary JavaScript input. It rejects accessors, getters, setters,
functions, symbols, BigInts, undefined, nonfinite numbers, sparse arrays,
extra array keys, non-enumerable schema fields, unsafe keys, inherited apparent
schema fields, cycles, revoked or reflection-failing Proxies, Date, Map, Set,
class instances, Foundry documents, PF2e objects, and other nonplain values.
The unsafe keys are `__proto__`, `constructor`, and `prototype`.

Acyclic shared references are accepted and captured once per occurrence into
isolated data. An object already in the active ancestor chain is a cycle.
Inputs, results, prior results, next states, events, and adapter snapshots never
share mutable caller references.

Compound identities use `JSON.stringify([component1, component2, ...])` or an
equivalent component-safe tuple. Delimiter concatenation is prohibited.

## 7. Exact closeout snapshot

M10 consumes a plain projection of live session evidence rather than a
Foundry document. Keys are exact and ordered:

```js
{
  schemaVersion,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  encounterRevision,
  shipRevision,
  lifecycleState,
  completedRoundHistory,
  momentum,
  focusPools,
  pressureSystems,
  activeHazards,
  pendingStationBenefitIds,
  unconsumedRiskBidBenefitIds,
  temporaryFocusPenaltyIds,
  roundOrderRestrictions,
  hazardSuppressions,
  temporaryConsequenceIds
}
```

`schemaVersion` is `1`; `lifecycleState` is exactly `"active"` or `"paused"`.
The six identity/revision fields bind to the Event Definition, M8 history,
M7 ship state, and any M9 plan/history. Both revisions are nonnegative safe
integers. `completedRoundHistory` is the complete M8 history.

`momentum` is an integer from zero through three. `focusPools` contains exact
records `{ operatorId, stationId, current, capacity }`; current and capacity
are nonnegative safe integers and current does not exceed capacity. Operator
and station identities are unique, and only occupied operators appear.

`pressureSystems` is an array in canonical five-system order. Each record is
exactly `{ pressureSystemId, value, capacity }` and follows existing Pressure
rules. `activeHazards` contains complete isolated M6 active Hazard records in
authoritative creation/order sequence.

The five `...Ids` collections are dense duplicate-free arrays of nonblank
strings. `roundOrderRestrictions` has exact records
`{ restrictionId, persistence }`, where persistence is `"temporary"` or
`"persistent"`. `hazardSuppressions` has exact records
`{ suppressionId, hazardId }`. Every referenced Hazard resolves exactly once.

The snapshot is evidence, not a persisted session schema. M11 may later own
its durable production and recovery. M10 validates it completely and does not
silently fill absent temporary state.

## 8. Closed Hazard closeout consequence schema

At M10 closeout, every unresolved Hazard's captured `ignoredConsequence` must
match exactly one of these two variants. Unsupported descriptive M6 data fails
closed with `m10-unsupported-hazard-closeout-consequence`.

Pressure variant, exact keys:

```js
{
  consequenceId,
  kind: "pressure-change",
  pressureSystemId,
  delta,
  persistentProposal
}
```

`pressureSystemId` is canonical, `delta` is a positive safe integer, and
`persistentProposal` is exactly `null`. The affected Hazard's
`failurePressureSystemId`, when non-null, must equal `pressureSystemId`.

Persistent proposal variant, with the same exact keys:

```js
{
  consequenceId,
  kind: "persistent-consequence",
  pressureSystemId: null,
  delta: null,
  persistentProposal: {
    proposalId,
    kind,
    title,
    description,
    targetKind,
    targetId
  }
}
```

Persistent proposal `kind` is one of `"ship-damage"`, `"resource-loss"`,
`"crew-consequence"`, `"operational-restriction"`, or `"authored"`.
`targetKind` is `"ship"`, `"system"`, `"crew"`, or `"resource"`; `targetId`
is nonblank. The descriptor is stored as reviewed Arcflight data only. It is
not executed against PF2e data.

Consequence and proposal identities are unique across unresolved Hazards.
Hazards are processed in `activeHazards` order. A supported consequence is
applied once to the simulation, then that Hazard is included in the removal
plan. Closeout emits one proposed
`voyage.hazard-closeout-consequence-applied` event per Hazard in that order.

## 9. Pressure and Breach closeout rules

Pressure consequences are simulated sequentially. For each Hazard:

1. apply its positive delta to the targeted system;
2. if the delta exceeds remaining capacity, process exactly one canonical
   Pressure Breach using existing arithmetic;
3. create or collide the canonical Breach Hazard under M6 rules;
4. generate the canonical ordinary Pressure-Breach Scar proposal;
5. reset the breached system to zero; and
6. continue with the next unresolved Hazard.

One large delta produces one Breach, not multiple Breaches. Any overflow beyond
that Breach is represented by the canonical Breach record and is not carried
into a second implicit Breach. A same-system Hazard collision follows the
existing authored M6 collision policy and never invokes arbitrary data.

After every Hazard has been processed, all five Pressure systems reset to zero
using the existing `analyzeVoyageEncounterPressureCloseoutReset` semantics.
The preview retains each pre-reset value and reset operation.

### 9.1 Snapshot and Hazard API envelopes

`validateVoyageEncounterCloseoutSnapshot(closeoutSnapshot)` returns exactly:

```js
{ valid, errors, warnings }
```

`captureVoyageEncounterCloseoutSnapshot(closeoutSnapshot)` returns exactly:

```js
{ ok, closeoutSnapshot, errors, warnings }
```

Capture failure uses `closeoutSnapshot: null`. Both APIs perform structural,
identity-value, collection, M6 Hazard, and internal-reference checks available
from the snapshot alone. Cross-binding to Event Definition and M7 ship state is
owned by the analyzers that receive those independent roots.

`analyzeVoyageEncounterHazardCloseout(request)` accepts exactly:

```js
{
  kind: "m10-hazard-closeout",
  sessionId,
  expectedEncounterRevision,
  closeoutSnapshot
}
```

Its exact envelope is:

```js
{
  ok,
  readyForHazardCloseout,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  expectedEncounterRevision,
  hazardCloseoutResults,
  pressureBreachResults,
  ordinaryScarProposals,
  postHazardPressureSystems,
  hazardRemovalPlan,
  errors,
  warnings
}
```

Success returns isolated ordered results from Sections 8–9. Failure has
`ok: false`, `readyForHazardCloseout: false`, all identities/revision null,
all result/plan arrays empty, and nonempty errors. This analyzer does not apply
the final Pressure reset, classify Scar capacity, mutate a state, or emit an
event. `hazardRemovalPlan` has one exact
`{ hazardId, previousStatus: "active", disposition: "removed" }` entry per
processed ordinary Hazard.

## 10. Exact preview request

`analyzeVoyageEncounterCloseoutPreview(request)` accepts exactly:

```js
{
  kind: "m10-closeout-preview",
  sessionId,
  expectedEncounterRevision,
  expectedShipRevision,
  closeoutSnapshot,
  shipState,
  eventDefinition,
  rewardAllocation,
  negativeSelection,
  closeoutScarDefinitions,
  breakdownDefinitions,
  emergencyResponseEvidence
}
```

The request has exactly these keys in order. Revisions and identities bind to
the snapshot and captured M7 ship state. `rewardAllocation` is required and
`negativeSelection` is null on Overall Success; on Overall Failure,
`rewardAllocation` is null and `negativeSelection` is required.

`closeoutScarDefinitions` is the Section 12 catalog. `breakdownDefinitions`
is a dense collection of complete M9 Breakdown Definitions with one or zero
exact system matches per potential incoming Scar. `emergencyResponseEvidence`
is a dense ordered array, empty when no M9 Emergency Response has completed.
Each entry has exact keys:

```js
{
  breakdownDefinition,
  breakdownPlan,
  completedRoundHistory,
  suppliedOutcome
}
```

The first three values form the exact M9 Emergency Response analyzer request
with the independently captured M10 session identity. `suppliedOutcome` is the
complete M9 result envelope being compared. M10 regenerates that envelope and
requires exact structural equality. Entries occur in ordinary-Scar proposal
order and each plan's incoming proposal identity must match the corresponding
capacity overflow. Missing, extra, duplicate, or out-of-order entries are
invalid. An uncompleted Breakdown makes the preview
`blockedByEmergencyResponse: true`; it remains ready for the restricted GM
review in Section 18 but cannot produce a persistent application plan.

The request never accepts M8 analyses, Hazard plans, Pressure plans, Breach
plans, Scar records, capacity analyses, M9 capacity handoffs, Breakdown plans,
proposal lists, reset plans, preview IDs, next states, application plans,
approval tokens, events, patches, ledger entries, timestamps, or request IDs.

## 11. M8 result composition

M10 regenerates M8 Overall Result first. For success it regenerates Reward
Steps and the supplied reward allocation. For failure it regenerates Negative
Steps and the supplied negative selection. It never calls or accepts a combined
M8 analyzer.

The M8-to-M10 result package is regenerated internally with exact M8 keys. It
is embedded in the preview as `resultPackage` and remains informational.

Selected reward operations become persistent proposals in selection order:

- `item` and `benefit` become `reward-grant` records;
- `void-fortune` becomes one `void-fortune-grant` record;
- `field-repair-resource` becomes one `field-repair-resource-grant` record;
- enhancements remain authored descriptor references and do not execute.

A failed event produces no reward proposal. The selected Misfortune and its
enhancements become one `misfortune` proposal. A non-null M8
`scarConsequenceProposal` enters the Section 13 ordinary closeout Scar path.

## 12. Closeout Scar Definition

Every M8 `voidScarDefinitionId` must resolve exactly once in this catalog.
Exact keys are:

```js
{
  schemaVersion,
  voidScarDefinitionId,
  pressureSystemId,
  name,
  description,
  operationalEffects,
  baseRepairCost,
  baseRepairTime,
  repairDcSource,
  eligibleRepairChecks,
  requiredFacilities,
  compatibleFieldRepairTags
}
```

`schemaVersion` is `1`; system identity must match the M8 proposal. Remaining
fields follow the equivalent M7 descriptor constraints. Definitions are
authored data and do not contain provenance, record IDs, application status,
scripts, or executable effects.

## 13. Versioned M10 closeout Scar record

An approved M8 closeout Scar is not an M7 Pressure Breach and must never be
coerced into one. M10 generates this exact durable record variant:

```js
{
  schemaVersion: 2,
  voidScarId,
  name,
  pressureSystemId,
  status: "active",
  sourceKind: "m8-critical-overall-failure",
  description,
  operationalEffects,
  baseRepairCost,
  baseRepairTime,
  repairDcSource,
  eligibleRepairChecks,
  requiredFacilities,
  compatibleFieldRepairTags,
  source: {
    eventId,
    sessionId,
    definitionSnapshotId,
    misfortuneId,
    voidScarDefinitionId
  }
}
```

The deterministic ID is:

```js
`arcflight-void-scar:${JSON.stringify([
  "m8-critical-overall-failure",
  eventId,
  sessionId,
  definitionSnapshotId,
  misfortuneId,
  voidScarDefinitionId,
  pressureSystemId
])}`
```

M10 extends durable `shipState.voidScars` to a versioned union of unchanged M7
Pressure-Breach records and this exact M10 variant. Both variants consume one
capacity slot. Existing M7 creation and repair behavior remains unchanged;
M10 implementation must add union validation before persisting the first M10
record. No existing record is rewritten merely because the union exists. M7
repair analysis/application must accept either union variant and apply the same
existing repair eligibility, cost/time, removal, revision, and event rules;
only creation provenance differs. This is a narrow schema extension, not a new
repair mechanic.

## 14. Capacity classification and M9 handoff

Ordinary Scar proposals are considered in canonical proposal order against one
simulated ship state. A proposal whose deterministic Scar ID already exists is
a duplicate error, never a no-op success.

When one slot is available, the generated Scar is appended to the simulation
and simulated ship revision increases once. When no slot is available, M10
does not append or reserve the Scar. It constructs the exact M9 Section 6
handoff:

```js
{
  kind: "voyage.m10-capacity-exhaustion",
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  systemId,
  systemKind: "pressure-system",
  liveRevision,
  scarCapacity,
  occupiedScarCount,
  incomingScarProposalId,
  incomingScarProposalKind: "ordinary-void-scar",
  incomingScarProposalStatus: "approved-unapplied"
}
```

`liveRevision` is the simulated ship revision immediately before the rejected
incoming Scar. M10 validates equality of occupied count and capacity and calls
`analyzeVoyageCatastrophicBreakdown`. Exactly one matching authored Breakdown
Definition is required. M10 does not edit the M9 handoff or generated plan.

The simulated state is not caller-authored projected evidence. It is the
authoritative candidate produced by applying every earlier approved proposal
through pure domain boundaries in this one transaction. The adapter binds the
actual base revision and regenerates the identical candidate before its single
gameplay-state write. This permits multiple ordered Scar proposals without
claiming that an uncommitted caller projection is live state.

An uncompleted generated Breakdown blocks final closeout application and
requires the authored Emergency Response. M10 stops capacity classification at
the first unresolved Breakdown and does not speculate about later ordinary
Scar proposals. After matching completed evidence is supplied, that incoming
Scar is permanently replaced by its regenerated Breakdown/outcome, M10 resumes
with the next proposal, and a later overflow may require another sequential
response. Only regenerated M9 outcome proposals enter M10 review.
Stabilization keeps the system disabled and is not repair.

## 15. Persistent proposal schema

The preview contains a dense ordered `persistentProposals` array. Every entry
has exact common keys:

```js
{
  proposalId,
  kind,
  sourceKind,
  sourceId,
  targetKind,
  targetId,
  title,
  description,
  payload,
  required: true
}
```

`kind` is one of:

- `reward-grant`;
- `void-fortune-grant`;
- `field-repair-resource-grant`;
- `misfortune`;
- `persistent-consequence`;
- `void-scar-create`;
- `catastrophic-breakdown`;
- `system-disablement`;
- `catastrophic-hazard`;
- `emergency-response-outcome`; or
- `event-history`.

`payload` is the complete captured descriptor owned by the applicable prior
contract or the exact M10 descriptor above. It is not arbitrary executable
data. Proposal IDs are deterministic component-safe identities and unique.
Every proposal is required once its source result and GM selection are valid;
M10 does not authorize selective deletion of legitimate consequences.

The complete proposal order is:

1. selected reward grants, or the selected Misfortune;
2. persistent Hazard consequences in active-Hazard order;
3. ordinary Scar outcomes in source order: the selected M8 Scar first, when
   present, then Pressure-Breach Scars in Hazard order;
4. each Breakdown's system disablement, Catastrophic Hazard, and completed
   Emergency Response outcome immediately after that Breakdown; and
5. the event-history proposal last.

## 16. Temporary reset plan

The exact reset plan keys are:

```js
{
  momentum,
  focusPools,
  pressureSystems,
  pendingStationBenefitIds,
  unconsumedRiskBidBenefitIds,
  temporaryFocusPenaltyIds,
  roundOrderRestrictions,
  hazardSuppressions,
  temporaryConsequenceIds,
  activeHazards
}
```

`momentum` is exactly `{ previousValue, nextValue: 0 }`. Every Focus record is
`{ operatorId, stationId, previousValue, nextValue: 0 }`. Pressure records are
in canonical system order and exactly
`{ pressureSystemId, previousValue, nextValue: 0, capacity }`.

The next values of the five ID collections and `hazardSuppressions` are empty
arrays. Temporary round-order restrictions are removed; persistent entries are
copied unchanged in source order. Every unresolved Hazard is listed exactly
once as `{ hazardId, previousStatus: "active", disposition: "removed" }` after
its consequence is processed. A contained M9 Catastrophic Hazard uses
`disposition: "contained"` and is not represented as repaired or re-enabled.

## 17. Complete closeout preview

The exact preview keys are:

```js
{
  schemaVersion,
  closeoutId,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  expectedEncounterRevision,
  expectedShipRevision,
  overallResult,
  successfulRoundCount,
  failedRoundCount,
  resultPackage,
  hazardCloseoutResults,
  pressureBreachResults,
  ordinaryScarResults,
  breakdownResults,
  emergencyResponseOutcomes,
  persistentProposals,
  temporaryResetPlan,
  blockedByEmergencyResponse,
  requiresGmApproval
}
```

`schemaVersion` is `1`; `requiresGmApproval` is true. `closeoutId` is:

```js
`arcflight-closeout:${JSON.stringify([
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId
])}`
```

`emergencyResponseOutcomes` contains zero or more regenerated M9 outcome
envelopes in Breakdown order. Every nested result is regenerated and isolated.
Preview equality is exact,
structural, and canonical-key-order-sensitive. A preview is not an approval or
application token.

The analyzer envelope has exact keys:

```js
{
  ok,
  readyForGmReview,
  closeoutId,
  preview,
  errors,
  warnings
}
```

Failure uses `ok: false`, `readyForGmReview: false`, `closeoutId: null`,
`preview: null`, at least one error, and `warnings: []`. A valid but incomplete
Emergency Response uses `ok: true`, `readyForGmReview: true`, the closeout ID,
the complete blocked preview, no errors, and one warning identifying the
required response. That review can approve only the M9 response handoff below;
it cannot produce or persist final closeout state.

## 18. GM review request and application plan

`analyzeVoyageEncounterCloseoutReview(request)` accepts exactly:

```js
{
  kind: "m10-closeout-review",
  sessionId,
  gmUserId,
  confirmed,
  previewRequest,
  suppliedPreview
}
```

`confirmed` must be literal `true`. The analyzer regenerates the preview from
`previewRequest`, safely captures `suppliedPreview`, and requires complete
structural equality. `gmUserId` is nonblank evidence only; the Foundry adapter
must independently compare it to the current active GM immediately before
each write.

The exact approved plan is:

```js
{
  schemaVersion: 1,
  applicationId,
  closeoutId,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  expectedEncounterRevision,
  expectedShipRevision,
  gmUserId,
  persistentProposals,
  temporaryResetPlan,
  expectedPreview
}
```

`applicationId` equals
`arcflight-closeout-application:${JSON.stringify([closeoutId])}`. The complete
preview is retained for deterministic revalidation. The plan is isolated
inspection data and still grants no persistence authority.

The review envelope is exactly:

```js
{
  ok,
  readyForEmergencyResponse,
  readyForControlledApplication,
  closeoutId,
  emergencyResponseHandoff,
  applicationPlan,
  errors,
  warnings
}
```

For an unblocked confirmed preview, `readyForEmergencyResponse` is false,
`emergencyResponseHandoff` is null, and the application plan is complete. For a
blocked confirmed preview, `readyForEmergencyResponse` is true,
`readyForControlledApplication` is false, and `applicationPlan` is null. Its
exact handoff is:

```js
{
  kind: "voyage.m10-emergency-response-required",
  closeoutId,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  expectedEncounterRevision,
  expectedShipRevision,
  breakdownDefinition,
  breakdownPlan
}
```

This isolated handoff records GM review of the generated M9 Breakdown and
supplies the authored response definition and plan needed by the later runtime.
It does not advance rounds, persist state, or authorize a remote command. M11
owns runtime transport/recovery and M12 owns interaction. After the Emergency
Response completes, its evidence returns through Section 10 and M10 regenerates
the final unblocked preview. Failure has null IDs, handoff, and plan and no
partial authority.

## 19. Pure controlled application

`applyVoyageEncounterApprovedCloseout(closeoutSnapshot, shipState, request)`
accepts exactly:

```js
{
  kind: "m10-apply-approved-closeout",
  previewRequest,
  reviewRequest,
  applicationPlan
}
```

The function captures all roots, regenerates the preview and review, compares
the supplied plan completely, binds snapshot/ship identities and expected
revisions, and constructs both candidates before returning success.

The completed closeout-snapshot candidate uses the Section 7 keys and rules,
except its `lifecycleState` is exactly `"completed-success"` or
`"completed-failure"`. It:

- selects that lifecycle from the regenerated M8 result;
- applies the Section 16 reset;
- removes processed ordinary Hazards;
- retains only persistent round-order restrictions;
- increments `encounterRevision` exactly once; and
- emits one `voyage.closeout-applied` event.

The ship candidate:

- applies generated Scar records, disabled-system records, reward/resource
  grants, and reviewed persistent descriptors under Arcflight ownership;
- applies no PF2e Item or Actor-system mutation;
- preserves each M7 Scar creation's exact one-revision/one-event cardinality;
- increments ship revision once more only when at least one M10-owned non-Scar
  persistent ship proposal is applied, regardless of that batch's size; and
- appends the same closeout history identity.

M10 may reuse M7 analyzers and record builders. It applies ordinary Scars in
proposal order to the simulated ship state, retaining each canonical M7 or
M10-v2 Scar-created event and revision. The optional non-Scar batch emits one
`voyage.closeout-persistent-state-applied` event. Encounter closeout emits one
`voyage.closeout-applied` event. All candidate operations are calculated before
Foundry persistence, which still uses one final Actor gameplay-state update.
M10 must not collapse, duplicate, or relabel M7 events.

The M10-v2 Scar-created event has exact keys:

```js
{
  type: "voyage.closeout-void-scar-created",
  applicationId,
  closeoutId,
  shipId,
  eventId,
  sessionId,
  pressureSystemId,
  sourceProposal,
  previousShipRevision,
  revision,
  previousVoidScarCount,
  voidScarCount,
  voidScar
}
```

An M7 Pressure-Breach Scar retains the existing exact M7
`voyage.void-scar-created` event. The optional M10 non-Scar batch event has:

```js
{
  type: "voyage.closeout-persistent-state-applied",
  applicationId,
  closeoutId,
  shipId,
  proposalIds,
  previousShipRevision,
  revision
}
```

The final closeout event has:

```js
{
  type: "voyage.closeout-applied",
  applicationId,
  closeoutId,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  overallResult,
  proposalIds,
  previousEncounterRevision,
  encounterRevision,
  shipRevision
}
```

Every proposal list preserves Section 15 order. Every nested proposal, record,
and event is independently isolated.

The exact result envelope is:

```js
{
  ok,
  applicationId,
  closeoutId,
  nextCloseoutSnapshot,
  nextShipState,
  events,
  errors,
  warnings
}
```

Success returns both isolated candidates and events in this order: zero or more
Scar-created events, the optional non-Scar batch event, then exactly one
closeout event. Failure returns null IDs, null candidates, `events: []`,
nonempty errors, and `warnings: []`. Neither input is mutated. M11 later owns
mapping and persisting the completed snapshot into its recoverable Event
Session; M10 does not write a second encounter document.

## 20. Arcflight Foundry storage

M10C stores only Arcflight-owned data on the existing PF2e vehicle Actor. The
exact owned subtree is:

```text
flags.arcflight.system.voyage
```

Its exact value is:

```js
{
  schemaVersion: 1,
  revision,
  voidScars,
  disabledSystems,
  rewards,
  resources,
  persistentConsequences,
  eventHistory,
  closeoutLedger
}
```

Every collection is a dense isolated plain-data array. `revision` is the M7/M10
ship revision. The adapter updates only explicit nested paths under this
subtree; it never replaces `flags.arcflight`, `flags.arcflight.system`, the
Actor's PF2e `system`, sibling Arcflight data such as installed components, or
embedded Items.

`voidScars` is the Section 13 versioned union. Each entry in
`disabledSystems`, `rewards`, `resources`, and `persistentConsequences` is an
exact Section 15 persistent-proposal record, restricted respectively to:

- `system-disablement`;
- `reward-grant` or `void-fortune-grant`;
- `field-repair-resource-grant`; and
- `misfortune`, `persistent-consequence`, `catastrophic-breakdown`,
  `catastrophic-hazard`, or `emergency-response-outcome`.

Each `eventHistory` entry has exact keys:

```js
{
  applicationId,
  closeoutId,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  overallResult,
  previousEncounterRevision,
  encounterRevision,
  previousShipRevision,
  shipRevision,
  proposalIds
}
```

`proposalIds` is the complete ordered persistent-proposal identity list. The
history record has no timestamp, arbitrary summary object, or PF2e data.

For ledger comparison, an owned gameplay snapshot has the same exact keys in
the same order except `closeoutLedger` is omitted:

```js
{
  schemaVersion,
  revision,
  voidScars,
  disabledSystems,
  rewards,
  resources,
  persistentConsequences,
  eventHistory
}
```

Ledger entries capture this nonrecursive gameplay snapshot. They never embed a
ledger inside a ledger.

Existing M7 ship state is projected with exact sources:

- `shipId` from the resolved Actor ID;
- `revision` and `voidScars` from `flags.arcflight.system.voyage`;
- `installed.hullPlatform` from
  `flags.arcflight.system.installed.hullPlatform`; and
- `hull.voidScarCapacity` from
  `flags.arcflight.system.base.hull.voidScarCapacity`.

The platform and capacity must match the canonical core-hull definition and
the M7 validator. The adapter never reads capacity from PF2e Actor `system`,
derived Hull Integrity, tier, expansion slots, or caller input. If the voyage
subtree is absent, initialization is permitted only when no pre-existing M7
persistent Scar data exists elsewhere. Conflicting or ambiguous legacy storage
fails closed; silent migration is prohibited.

Safe first initialization uses `schemaVersion: 1`, `revision: 0`, and empty
arrays for every collection in Section 20. It occurs during preview/state
projection before approval and is persisted only as part of the approved
prepared/committed protocol.

## 21. Ledger, idempotency, and reconciliation

Each `closeoutLedger` entry has exact keys:

```js
{
  applicationId,
  closeoutId,
  status,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  expectedShipRevision,
  resultingShipRevision,
  gmUserId,
  beforeState,
  afterState,
  events
}
```

`status` is `"prepared"`, `"committed"`, or `"reconciliation-required"`.
No timestamp is required for identity or ordering. `beforeState` and
`afterState` are complete captured nonrecursive gameplay snapshots from
Section 20. `events` is the complete isolated ordered array returned by pure
application.

`persistVoyageEncounterApprovedCloseout(request)` accepts exactly:

```js
{
  kind: "m10-persist-approved-closeout",
  previewRequest,
  reviewRequest,
  applicationPlan
}
```

The production boundary obtains Foundry user and Actor state from `game`; it
does not accept a caller-authored runtime context, Actor, user, active-GM flag,
or ship state. Automated tests replace the Foundry globals at the module
boundary rather than adding a production overload.

The adapter performs:

1. resolve exactly one Arcflight-enabled PF2e vehicle Actor by `shipId`;
2. verify the executing user is a GM and equals Foundry's current active GM;
3. read and safely project live M10 ship state;
4. reject a committed duplicate as an idempotent success with no write;
5. reject a conflicting application/closeout identity;
6. re-run pure controlled application against live state;
7. write one `prepared` ledger entry containing complete before/after data;
8. re-read the Actor and repeat active-GM, identity, revision, and ledger
   checks;
9. issue one Actor update containing the complete after-state and the same
   entry changed to `committed`; and
10. re-read and verify exact committed state.

The adapter returns exact keys:

```js
{
  ok,
  status,
  applicationId,
  closeoutId,
  shipId,
  revision,
  events,
  errors,
  warnings
}
```

`status` is `"committed"`, `"already-committed"`, `"prepared"`,
`"reconciliation-required"`, or `"failed"`.

If a retry finds `prepared` and live owned state equals `beforeState`, it may
resume Step 8. If live state equals `afterState`, it verifies and promotes the
entry to committed. If neither matches, it performs no gameplay write and
marks only that ledger entry `reconciliation-required` when safely possible.
It never guesses, overwrites unrelated data, or rolls back PF2e/sibling flags.

M11 may later wrap this adapter in command transport and recovery checkpoints.
It must preserve the M10 application identity and ledger semantics rather than
adding a second gameplay idempotency record.

## 22. Active-GM boundary

Immediately before each Foundry write, all must be true:

- `game.user.isGM === true`;
- `game.users.activeGM` exists;
- `game.user.id === game.users.activeGM.id`;
- the active GM ID equals the plan's captured `gmUserId`; and
- the live Actor identity and revision still match.

Failure produces no gameplay write. This local check does not validate a
network sender and does not replace M11 request authority.

## 23. Diagnostic catalog

Diagnostics have exact shape `{ code, path, message, severity: "error" }`.
Warnings use severity `"warning"`. No raw exception, Proxy, Foundry, or engine
text escapes.

The table's final column is the exact public message.

| Code | Canonical path | Exact message |
| --- | --- | --- |
| `m10-hostile-data-capture-failed` | `$` | M10 data could not be captured safely. |
| `m10-caller-authority-rejected` | `request.<key>` | Caller supplied calculated, application, persistence, or runtime authority. |
| `m10-invalid-mode` | `request.kind` | The requested M10 API mode is invalid. |
| `m10-invalid-request-shape` | `request` | Request shape, order, or root values are invalid. |
| `m10-invalid-closeout-snapshot` | `closeoutSnapshot` | Closeout snapshot is invalid. |
| `m10-event-identity-mismatch` | first mismatching event field | Event identity is not bound. |
| `m10-session-identity-mismatch` | first mismatching session field | Session identity is not bound. |
| `m10-definition-snapshot-mismatch` | first mismatching snapshot field | Definition snapshot is not bound. |
| `m10-ship-identity-mismatch` | first mismatching ship field | Ship identity is not bound. |
| `m10-encounter-revision-mismatch` | `expectedEncounterRevision` | Encounter revision is stale. |
| `m10-ship-revision-mismatch` | `expectedShipRevision` | Ship revision is stale. |
| `m10-result-regeneration-failed` | `resultPackage` | Applicable M8 analysis failed. |
| `m10-invalid-hazard-closeout-consequence` | exact Hazard path | Closeout consequence is malformed. |
| `m10-unsupported-hazard-closeout-consequence` | exact Hazard path | M6 descriptive consequence is outside the closed M10 vocabulary. |
| `m10-duplicate-closeout-consequence-id` | later consequence path | Consequence identity is duplicated. |
| `m10-pressure-closeout-failed` | `hazardCloseoutResults` | Pressure/Breach simulation failed. |
| `m10-invalid-closeout-scar-definition` | catalog entry path | Closeout Scar Definition is invalid. |
| `m10-unresolved-closeout-scar-definition` | proposal path | M8 Scar definition does not resolve exactly once. |
| `m10-duplicate-scar-identity` | proposal path | Generated Scar already exists or repeats. |
| `m10-missing-breakdown-definition` | `breakdownDefinitions` | Exhausted system has no exact authored M9 definition. |
| `m10-ambiguous-breakdown-definition` | `breakdownDefinitions` | More than one M9 definition matches the exhausted system. |
| `m10-breakdown-regeneration-failed` | `breakdownResults` | M9 Breakdown analysis failed. |
| `m10-emergency-response-required` | `emergencyResponseEvidence[n]` | Breakdown requires completed Emergency Response before application. |
| `m10-emergency-response-mismatch` | `emergencyResponseEvidence[n].suppliedOutcome` | Supplied M9 outcome does not match regeneration. |
| `m10-preview-mismatch` | `suppliedPreview` | Supplied preview differs from regenerated preview. |
| `m10-gm-confirmation-required` | `confirmed` | Complete GM confirmation is required. |
| `m10-application-plan-mismatch` | `applicationPlan` | Supplied plan differs from regenerated plan. |
| `m10-closeout-already-applied` | `applicationId` | Pure state already contains this application. |
| `m10-active-gm-required` | `game.user` | Executing Foundry user is not the current active GM. |
| `m10-ship-document-not-found` | `shipId` | Exact Arcflight ship Actor was not resolved. |
| `m10-ambiguous-legacy-storage` | `flags.arcflight.system.voyage` | Existing persistent data cannot be initialized safely. |
| `m10-ledger-conflict` | `closeoutLedger` | Ledger identity or state conflicts with this application. |
| `m10-persistence-write-failed` | `flags.arcflight.system.voyage` | Foundry write did not complete or verify. |
| `m10-reconciliation-required` | `closeoutLedger` | Prepared state differs from both recorded before and after state. |

`m10-emergency-response-required` is the sole planned M10 warning on a valid
blocked preview/review. It uses the table message with severity `"warning"`.
Attempting persistent application while the response remains incomplete uses
the same code and message with severity `"error"`. Every other table entry is
an error.

Predecessor diagnostics are retained unchanged when a regenerated M6–M9
boundary fails. M10 adds its wrapper diagnostic only where the table explicitly
requires one and never hides the specific predecessor errors.

## 24. Diagnostic precedence

Pure preview and review use:

1. hostile capture;
2. prohibited caller authority;
3. mode;
4. exact request shape;
5. closeout snapshot and source definition structure;
6. event, session, snapshot, and ship binding;
7. encounter then ship revision binding;
8. M8 result regeneration and selection applicability;
9. Hazard closeout schema, uniqueness, and source binding;
10. Pressure and Breach simulation;
11. Scar Definition resolution and duplicate identity;
12. capacity classification;
13. M9 Breakdown regeneration;
14. Emergency Response requirement or regeneration;
15. reset-plan validation;
16. complete preview validation;
17. supplied-preview equality and GM confirmation; and
18. application-plan equality.

The Foundry adapter then uses:

1. context capture;
2. ship resolution;
3. active-GM check;
4. owned-state and legacy-storage validation;
5. application/closeout duplicate or conflict check;
6. live identity and revision binding;
7. pure application regeneration;
8. prepared write and verification;
9. repeated active-GM and revision check;
10. committed write and verification; and
11. reconciliation classification.

One failed category prevents all later categories. Within a category, fixed
field order and captured array order apply. Diagnostics deduplicate by the
component-safe tuple `[code, path, message, severity]` while retaining first
occurrence.

## 25. Prohibited authority keys

Every M10 request rejects these root keys when not an exact required field of
that specific API:

```js
[
  "overallResult", "rewardAnalysis", "negativeAnalysis", "resultPackage",
  "hazardPlan", "pressurePlan", "breachPlan", "capacityAnalysis",
  "capacityExhaustion", "breakdownPlan", "outcomeProposal",
  "persistentProposals", "temporaryResetPlan", "preview", "previewId",
  "approved", "gmApproved", "approvalToken", "applicationId",
  "applicationPlan", "nextEncounterState", "nextCloseoutSnapshot",
  "nextShipState", "events",
  "patch", "ledgerEntry", "idempotencyStatus", "requestId", "timestamp"
]
```

A field explicitly required by Sections 10, 18, or 19 is removed from that
API's prohibited list exactly once. Every other key remains prohibited. Values
`null`, `false`, `0`, `""`, `[]`, and `{}` are rejected identically.

## 26. Determinism, mutation, and cardinality

Pure M10 APIs read no time, randomness, locale, Foundry, PF2e, global mutable
state, or callbacks. Equivalent captured input returns byte-equivalent
JSON-compatible output.

Preview and review perform zero mutations, revision changes, and events. Pure
controlled application returns two candidates, increments encounter revision
once, preserves one ship revision/event per Scar creation, adds at most one
ship revision/event for the non-Scar batch, and emits one encounter closeout
event. Failure returns no candidate, event, or revision.

Foundry persistence writes the prepared ledger once and the committed owned
state once. An already committed retry writes nothing. Reconciliation may
change only the affected ledger entry's status and never changes gameplay
state.

## 27. Required test matrix

Every implementation task must cover:

- exact root/nested shapes, key order, enums, identities, and failure sentinels;
- every hostile-data category in Section 6, acyclic sharing, cycles, isolation,
  immutability, and embedded-NUL tuple collisions;
- all prohibited keys with `null`, `false`, `0`, `""`, `[]`, and `{}`;
- every supported M8 round count and both overall outcomes;
- exact reward allocation and negative selection regeneration;
- no reward on failure and no Misfortune on success;
- all unresolved Hazards in authoritative order;
- both closed consequence variants and unsupported generic data;
- sequential Pressure, one large-delta Breach, multiple-system Breaches,
  collision behavior, and final all-system reset;
- existing M7 Pressure-Breach Scar creation without source fabrication;
- M8 closeout Scar Definition resolution, v2 record generation, mixed v1/v2
  capacity counting, and no eager migration;
- one remaining capacity slot, exact capacity, zero capacity, duplicates, and
  simulated revision changes across multiple proposals;
- exact M10-to-M9 handoff and matching Breakdown Definition cardinality;
- zero, one, and sequential multiple blocked Emergency Responses,
  missing/extra/reordered evidence, stabilization, failure, disabled-system
  preservation, and complete M9 outcome regeneration;
- complete persistent proposal order and exact reset plan;
- preview regeneration/equality, mutation attempts, and cross-call isolation;
- confirmation false/missing, wrong GM evidence, and altered plan rejection;
- pure two-state atomicity, exact revision/event cardinality, and no partial
  candidates;
- Actor-path preservation of PF2e and sibling Arcflight fields;
- active-GM loss before each write;
- stale revision before prepare and between prepare/commit;
- committed duplicate, prepared-before, prepared-after, conflict, failed write,
  failed verification, and reconciliation-required behavior; and
- no sockets, transport, UI, PF2e Item creation, rolls, random, or time access.

## 28. Implementation task sequence

### Task 0 — contract lock

- **Files:** this contract only.
- **APIs:** none.
- **Stop:** no production, tests, registration, persistence, commit, push, PR,
  or GitHub mutation.

### Task 1 — closeout snapshot and Hazard closeout analysis

- **Files:** `scripts/voyage/domain/closeout.js` and
  `tests/voyage/domain/closeout.test.mjs`.
- **APIs:** `validateVoyageEncounterCloseoutSnapshot`,
  `captureVoyageEncounterCloseoutSnapshot`, and
  `analyzeVoyageEncounterHazardCloseout`.
- **Behavior:** Sections 6–9 and Section 16 only.
- **Stop:** no M8 result package, Scar capacity, M9, approval, or persistence.

### Task 2 — complete closeout preview

- **Files:** the Task 1 files, plus the minimum versioned Scar schema/state
  files and focused tests required by Sections 12–14.
- **API:** `analyzeVoyageEncounterCloseoutPreview`.
- **Behavior:** regenerate M8, compose Hazards/Pressure/Breaches, classify
  ordinary Scars, create exact M9 handoffs, and return Section 17.
- **Stop:** no GM approval, state application, Foundry, or registration.

### Task 3 — GM review and pure controlled application

- **Files:** `scripts/voyage/domain/closeout-review.js`,
  `tests/voyage/domain/closeout-review.test.mjs`, and the minimum domain files
  required for final candidate validation.
- **APIs:** `analyzeVoyageEncounterCloseoutReview` and
  `applyVoyageEncounterApprovedCloseout`.
- **Behavior:** Sections 18–19, one all-or-nothing pure transaction.
- **Stop:** no Foundry, sockets, UI, or PF2e writes.

### Task 4 — Foundry persistence adapter

- **Files:** `scripts/voyage/foundry/closeout-persistence.js` and
  `tests/voyage/foundry/closeout-persistence.test.mjs`; minimal registration is
  permitted only after adapter review.
- **API:** `persistVoyageEncounterApprovedCloseout`.
- **Behavior:** Sections 20–22 using mocked document boundaries in automated
  tests and one explicit manual Foundry validation checklist.
- **Stop:** no sockets, distributed requests, UI, embedded Item creation,
  session runtime, or M11 behavior.

### Task 5 — cumulative integration review

- **Files:** tests and documentation only unless review finds a genuine defect.
- **Behavior:** run focused M10, complete Voyage domain, Voyage PF2e, and
  Foundry-adapter suites; inspect full M10 diff and manual validation evidence.
- **Stop:** no scope expansion into M11 or M12.

## 29. Manual Foundry validation for Task 4

Automated mocks do not prove Foundry behavior. Before Task 4 acceptance, in a
Foundry v14 PF2e world:

1. use an Arcflight-enabled PF2e vehicle Actor with sibling Arcflight flags;
2. persist one approved closeout as the active GM;
3. verify only `flags.arcflight.system.voyage` changed;
4. verify PF2e Actor `system`, embedded Items, installed component flags, and
   sibling Arcflight flags are byte-equivalent to their pre-write values;
5. repeat the same application and verify `already-committed` with no write;
6. retry a prepared entry in before-state and after-state conditions;
7. force a conflicting state and verify reconciliation-required with no
   gameplay overwrite;
8. change or remove active-GM authority before each write and verify failure;
9. reload and verify the committed ledger/history and ship state remain; and
10. verify no socket, chat, UI, roll, or Item side effect occurred.

## 30. Contract acceptance criteria

This contract is ready for implementation only when review confirms:

- every M10 public field and key order is fixed;
- M6 generic closeout data fails closed outside Section 8;
- M7 Pressure-Breach provenance is never fabricated;
- the M8 closeout Scar has a versioned, capacity-counted durable representation;
- M8 and M9 calculations are regenerated, not trusted;
- an incomplete Emergency Response blocks application;
- the reset occurs only after closeout effects and Breaches;
- GM confirmation precedes every persistent gameplay write;
- pure application is all-or-nothing with exact revision/event cardinality;
- Foundry persistence preserves PF2e and sibling Arcflight data;
- prepared/committed recovery is deterministic and idempotent;
- M10's active-GM check does not duplicate M11 transport authority; and
- M11/M12 responsibilities remain explicitly deferred.

No implementation begins under Task 0.
