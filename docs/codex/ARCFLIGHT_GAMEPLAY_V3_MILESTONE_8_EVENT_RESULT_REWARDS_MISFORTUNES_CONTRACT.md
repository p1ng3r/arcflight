# Arcflight Gameplay V3 Milestone 8 — Event Result, Rewards, and Misfortunes

**Status:** Task 0 contract-only boundary; no Milestone 8 production API is
implemented by this document.

**Canonical authority:**
[`ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`](../gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md),
the canonical milestone map, and the accepted Milestone 6 and Milestone 7
contracts.

**Scope:** A Foundry-free, PF2e-free, pure-domain calculation boundary for the
final result of a completed odd-round Event Session, authored Reward Steps,
authored Negative Steps, Misfortune packages, and reward allocation analysis.

This contract does not register, export, persist, or apply an API. It records
the exact boundary that subsequent implementation tasks must satisfy.

## 1. Audit conclusion

The canonical rules define the gameplay mathematics for overall Event result,
Reward Steps, Negative Steps, Misfortunes, authored rewards, and allocation
limits. The repository does not yet define their implementation schemas,
diagnostics, result envelopes, key order, or public API names. This contract
locks those missing pure-domain details without adding runtime behavior.

The canonical rules and accepted milestone contracts override older alpha and
historical documents whenever their wording differs.

## 2. Milestone 8 purpose

Milestone 8:

- determines final success or failure for a completed odd-round Event Session;
- calculates Reward Steps for a successful Event;
- calculates Negative Steps for a failed Event;
- returns authored reward or Misfortune analysis packages for closeout review;
- validates a pure reward allocation selection;
- preserves the boundary that calculation produces no durable mutation.

Milestone 8 does not execute generic consequences, spend resources, invoke
repair, apply a Void Scar, or write a Foundry document.

## 3. Authority layers and ownership

### 3.1 Canonical gameplay rules

The canonical rules already fix:

- Event round counts of 3, 5, 7, 9, or 11;
- the winning threshold `(roundCount + 1) / 2`;
- successful and failed round counting;
- Critical Round Success and Critical Round Failure point weights;
- Reward Step and Negative Step formulas and caps;
- no automatic Void Fortune;
- no rewards on Overall Event Failure;
- normal and critical overall failure packages;
- authored next-situation progression;
- closeout review before durable application.

### 3.2 Contract decisions

This document fixes the exact plain-data schemas, identity bindings, request
shapes, result envelopes, diagnostic order, selection rules, and zero-mutation
behavior required by those gameplay rules.

### 3.3 Explicit stops

An implementation task must stop with an invalid result when an input does not
meet this contract. It must not infer missing authored data, invent an
unresolved round, execute a descriptor, or treat a caller-supplied analysis as
authorization.

## 4. Implemented prerequisites and Milestone 8 scope

Milestones 1 through 7 provide the following prerequisites:

- fixed operator assignments and occupied stations;
- authored round and action validation;
- committed approaches, station order, Risk Bids, execution requests, and
  four-degree action outcomes;
- round-unit aggregation and four-way round-result classification;
- Momentum calculation;
- Pressure, Pressure Breach, active Hazard, and Scar consequence boundaries;
- Void Scar capacity, creation, repair, and Field Repair Resource analysis;
- hostile-data-safe plain-data domain conventions.

Milestone 8 consumes completed round results and immutable authored reward and
Misfortune definitions. It does not replace any prerequisite operation.

## 5. Explicit exclusions and deferred ownership

The following behavior is outside this contract:

- Catastrophic Breakdown, Catastrophic Hazards, and Emergency Response (M9);
- unresolved-Hazard closeout, closeout Pressure Breaches, complete preview
  composition, approval, persistent application, Foundry writes, and durable
  idempotency (M10);
- active-GM authority, request envelopes, sockets, projections, recovery, and
  audited correction (M11);
- UI, PF2e roll orchestration, and the player-facing vertical slice (M12);
- Hazard countdown or duration ticking;
- unresolved-Hazard `ignoredConsequence` execution;
- generic consequence or benefit execution;
- inventory, resource, gold, time, Hull Integrity, or repair mutation;
- direct Pressure, Hazard, Void Scar, or hull-capacity mutation.

## 6. State ownership

### 6.1 Immutable Event Definition

The Event Definition owns authored identity, round identities, reward
definitions, enhancement definitions, Misfortune definitions, and next
situations. These values are captured into isolated plain data before analysis.

### 6.2 Temporary Event Session

The M8 calculation boundary owns no mutable state. Its input represents the
temporary session identity and completed-round history. Its outputs are
isolated analysis values containing:

- the overall result;
- Reward Steps or Negative Steps;
- authored reward or Misfortune package data;
- an optional pure reward allocation result;
- an optional `scarConsequenceProposal` descriptor for M10 review.

### 6.3 Durable ship state

M8 owns no durable ship state. Active Void Scars, hull capacity, Pressure,
Hazards, repair state, Hull Integrity, inventory, and resources remain outside
the M8 result.

### 6.4 Foundry document state

M8 never reads or writes Foundry Documents. M10 owns the persistence adapter.

### 6.5 Projection and interface state

M8 returns GM-review-safe plain data only. Player, crew, observer, and GM
projections are M11/M12 responsibilities.

## 7. Canonical identifiers and primitive constraints

Unless a field is explicitly nullable, every string is a nonblank UTF-16
string with surrounding whitespace rejected. Arrays are dense own-entry arrays.
Objects are plain objects with either `Object.prototype` or a null prototype.

The following identifiers are stable authored or session identities:

- `eventId`: stable Event Definition identity;
- `sessionId`: stable Event Session identity, equal to the Voyage encounter
  identity supplied by the caller;
- `definitionSnapshotId`: immutable authored-definition snapshot identity;
- `roundId`, `rewardId`, `enhancementId`, `misfortuneId`,
  `misfortuneEnhancementId`, `nextSituationId`, `voidFortuneId`,
  `fieldRepairResourceId`, and `voidScarDefinitionId`: stable authored
  identities.

No identifier is generated during analysis.

## 8. M8 Event Definition slice

The M8 analyzers consume the following exact Event Definition slice. Keys are
listed in required order:

```js
{
  schemaVersion: 1,
  eventId: "event-id",
  definitionSnapshotId: "definition-snapshot-id",
  roundCount: 3,
  rounds: [
    { roundId: "round-1", roundNumber: 1 },
    { roundId: "round-2", roundNumber: 2 },
    { roundId: "round-3", roundNumber: 3 }
  ],
  rewards: [],
  enhancements: [],
  misfortuneEnhancements: [],
  misfortunes: [],
  nextSituations: []
}
```

`roundCount` must equal `rounds.length` and must be one of 3, 5, 7, 9, or 11.
Round numbers are the dense sequence from 1 through `roundCount`.
The generic Event Definition slice permits zero or one valid authored
next-situation descriptor; more than one descriptor is invalid. The example's
empty `nextSituations` array is valid
for Overall Result and Reward Step analysis; Negative Step analysis requires
exactly one descriptor.

## 9. Completed-round-history contract

Completed history is the exact value below, with keys in this order:

```js
{
  schemaVersion: 1,
  eventId: "event-id",
  sessionId: "session-id",
  definitionSnapshotId: "definition-snapshot-id",
  roundCount: 3,
  rounds: [
    {
      roundId: "round-1",
      roundNumber: 1,
      roundResult: "round-success"
    }
  ]
}
```

The accepted `roundResult` values are exactly:

- `critical-round-success`;
- `round-success`;
- `round-failure`;
- `critical-round-failure`.

History must contain every authored round exactly once, in authored numerical
order, with no extra entries. Every `roundId`, `roundNumber`, and `roundResult`
must match the Event Definition and the accepted enum. Missing, duplicate,
unknown, sparse, or out-of-order entries are errors. `roundCount` and
`definitionSnapshotId` must match the Event Definition.

M8 rejects incomplete histories. Early termination is not encoded as a partial
M8 result; Catastrophic Breakdown and authored termination handoffs are owned
by M9/M10.

## 10. Overall Event result

`critical-round-success` and `round-success` each count as one successful
round. `critical-round-failure` and `round-failure` each count as one failed
round. Criticality does not alter the number of rounds won or lost.

For a valid odd `roundCount`:

```text
winningThreshold = (roundCount + 1) / 2
```

`successfulRoundCount >= winningThreshold` produces
`overallResult: "overall-success"`.

`failedRoundCount >= winningThreshold` produces
`overallResult: "overall-failure"`.

A valid history cannot tie. A history that would produce any other count is
invalid rather than provisionally classified.

## 11. Reward points and Reward Steps

Reward points are calculated only for Overall Event Success:

- `round-success` contributes 1 point;
- `critical-round-success` contributes 2 points;
- either failure result contributes 0 reward points.

The exact formula is:

```js
rewardSteps = Math.min(
  3,
  1 + Math.floor((rewardPoints - winningThreshold) / 2)
);
```

Every successful Event has at least one base Reward Step. `rewardPoints` is
returned even when the three-step cap applies. Momentum is never converted to
reward points or Reward Steps. Reward Step analysis requires at least one valid
authored reward definition. Void Fortune is available only when an authored
reward definition has `kind: "void-fortune"`.

## 12. Failure points and Negative Steps

Failure points are calculated only for Overall Event Failure:

- `round-failure` contributes 1 point;
- `critical-round-failure` contributes 2 points;
- either success result contributes 0 failure points.

The exact formula is:

```js
negativeSteps = Math.min(
  3,
  1 + Math.floor((failurePoints - winningThreshold) / 2)
);
```

`negativeSteps === 1` is `overallFailureDegree: "normal"` and requires a
negative selection with zero enhancements. `negativeSteps === 2` is
`overallFailureDegree: "critical"` and requires one enhancement. `negativeSteps
=== 3` is `overallFailureDegree: "critical"` and requires two enhancements.
The analyzer returns exactly the selected negative package, not the complete
unselected Misfortune catalog. The selection contains no calculated values;
the analyzer regenerates the overall result, failure points, and Negative Steps
before validating it.

An Overall Event Failure produces no reward, salvage, clue, discovery, or Void
Thread. Negative Step analysis requires exactly one authored next situation and
at least one valid authored Misfortune definition. A critical package may
contain an authored `scarConsequenceProposal`, but that proposal is not a Scar
and is never applied by M8.

## 13. Reward descriptor schema

Every authored reward has these keys in order:

```js
{
  rewardId: "reward-id",
  kind: "item",
  title: "Authored reward",
  description: "Visible authored description.",
  tags: ["supplies"],
  enhancementIds: ["enhancement-id"],
  voidFortune: null,
  fieldRepairResource: null
}
```

`kind` is one of `item`, `benefit`, `void-fortune`, or
`field-repair-resource`. `tags` and `enhancementIds` are dense arrays of
nonblank strings with duplicates rejected. Every `enhancementIds` entry must
resolve exactly once in the Event Definition `enhancements` array.
`voidFortune` is non-null only for
`kind: "void-fortune"`; `fieldRepairResource` is non-null only for
`kind: "field-repair-resource"`. A reward definition is authored data, not an
executable effect.

## 14. Reward enhancement descriptor schema

Every authored enhancement has these keys in order:

```js
{
  enhancementId: "enhancement-id",
  title: "Authored enhancement",
  description: "Visible authored description.",
  compatibleRewardIds: ["reward-id"],
  compatibleRewardKinds: ["item"],
  maxApplicationsPerReward: 1
}
```

`maxApplicationsPerReward` must equal 1. A reward may receive no more than two
distinct enhancements total. `compatibleRewardIds` is a dense duplicate-free
array; every nonempty entry resolves exactly once to an authored
`eventDefinition.rewards[n].rewardId`. `compatibleRewardKinds` is a dense
duplicate-free array whose values are exactly `item`, `benefit`, `void-fortune`,
or `field-repair-resource`. An empty `compatibleRewardIds` array means no
reward-ID restriction; otherwise the target reward ID must appear. An empty
`compatibleRewardKinds` array means no reward-kind restriction; otherwise the
target kind must appear. Both arrays may not be empty on one reward
enhancement. When nonempty, every supplied restriction must pass. Enhancement
compatibility also requires the enhancement ID to appear in the selected
reward's `enhancementIds` list.

## 15. Void Fortune descriptor

An authored Void Fortune has exactly these keys:

```js
{
  voidFortuneId: "fortune-id",
  title: "Authored Void Fortune",
  description: "Visible authored fortune description.",
  tags: ["fortune"]
}
```

Void Fortune is not generated from Reward Steps, Momentum, round criticality,
or any default. It exists only when supplied by the Event Definition.

## 16. Field Repair Resource descriptor

An authored Field Repair Resource has exactly these keys:

```js
{
  fieldRepairResourceId: "resource-id",
  title: "Field Repair Resource",
  description: "Visible authored resource description.",
  compatibleScarTags: ["arkengine"],
  timing: "safe-rest",
  safeRestRequired: true
}
```

`compatibleScarTags` is a dense nonempty array of unique tags. `timing` is a
nonblank authored timing string. The descriptor does not consume the resource,
remove a Void Scar, check a dock, spend gold, or invoke repair. Milestone 7
continues to own pure Field Repair Resource repair analysis and application.
M8 only offers the descriptor as an authored reward option.

## 17. Misfortune descriptor schema

Every authored Misfortune has these keys in order:

```js
{
  misfortuneId: "misfortune-id",
  kind: "travel-delay",
  title: "Authored Misfortune",
  description: "Visible authored penalty description.",
  tags: ["delay"],
  persistence: "temporary",
  enhancementIds: [],
  scarConsequenceProposal: null
}
```

`kind` is one of `travel-delay`, `resource-cost`,
`operational-restriction`, `crew-consequence`, `damaged-room`, or `authored`.
`persistence` is `temporary` or `persistent`. `enhancementIds` references
authored Misfortune-enhancement identities for the negative package; it does
not execute them. An authored Misfortune may contain a null or structurally
valid non-null `scarConsequenceProposal`. A non-null proposal must use the
exact fixed M8 source and schema below. Package eligibility is calculated
later: one-step selection forbids a non-null proposal, while two- and
three-step selection permits either null or non-null.

```js
{
  voidScarDefinitionId: "scar-definition-id",
  pressureSystemId: "arkengine",
  source: "m8-critical-overall-failure"
}
```

Its `source` is the fixed value `"m8-critical-overall-failure"`.

Every authored Misfortune enhancement has these keys in order:

```js
{
  misfortuneEnhancementId: "misfortune-enhancement-id",
  title: "Authored Misfortune enhancement",
  description: "Visible authored enhancement description.",
  compatibleMisfortuneIds: [],
  maxApplicationsPerMisfortune: 1
}
```

`compatibleMisfortuneIds` is a dense duplicate-free array; every nonempty entry
resolves exactly once to an authored `eventDefinition.misfortunes[n].misfortuneId`.
An empty array means no additional identity restriction; otherwise the selected
Misfortune identity must appear. `maxApplicationsPerMisfortune` must equal 1.
The Event Definition `misfortuneEnhancements` array contains these descriptors.

Every non-null authored `scarConsequenceProposal` tuple is unique across
`eventDefinition.misfortunes`. Its exact stable identity is
`(voidScarDefinitionId, pressureSystemId, source)`. If a later authored
Misfortune repeats that tuple, the second occurrence is rejected in authored
Misfortune-definition order.

This is an M8-authored closeout consequence proposal. It is not the Milestone
6 `voyage.pressure-breach-applied` proposal and cannot be passed to
`analyzeVoyagePressureBreachVoidScarCreation` or
`applyVoyagePressureBreachVoidScarCreation`. It does not authorize a Void Scar
record. M10 owns ordinary closeout review, live identity and capacity
revalidation, and approved persistent application. M10 may use the M7 pure
capacity analyzer as informational input but may not fabricate an M7 Pressure
Breach source. If approved ordinary Scar application would exceed current
capacity, M10 hands that capacity-exhaustion condition to M9, which owns
Catastrophic Breakdown, the mandatory Catastrophic Hazard, Emergency Response,
and stabilization. M8 does not hand an ordinary proposal directly to M9.

## 18. Authored next-situation descriptor

A next-situation descriptor, when authored, has these keys in order:

```js
{
  nextSituationId: "next-situation-id",
  title: "Authored next situation",
  summary: "Visible authored transition summary.",
  transitionKind: "retreat"
}
```

`transitionKind` is one of `retreat`, `diversion`, `emergency`, `capture`,
`delay`, `repair`, or `authored`. The descriptor is a narrative and routing
proposal; it does not advance the session or execute an Emergency Response.
The generic M8 Event Definition slice permits zero or one valid descriptor.
Overall Result and Reward Step analysis do not require a failure transition.
Negative Step analysis requires exactly one descriptor:
`m8-missing-next-situation` applies only when `nextSituations.length === 0`;
malformed descriptors or `nextSituations.length > 1` use
`m8-invalid-next-situation`.

## 19. Negative Step selection and package

The negative analyzer request owns an authored selection with these keys in
order:

```js
{
  misfortuneId: "misfortune-id",
  enhancementIds: ["misfortune-enhancement-id"]
}
```

`misfortuneId` must identify exactly one authored Misfortune. `enhancementIds`
is dense, ordered, and duplicate-free. The selected Misfortune's
`enhancementIds` list must contain every selected enhancement identity, and
each referenced descriptor must resolve exactly once in
`eventDefinition.misfortuneEnhancements`. Compatibility is checked using the
selected Misfortune ID and each descriptor's `compatibleMisfortuneIds` rule.

The required selection cardinality is exact: the selected enhancement count is
`negativeSteps - 1`. Therefore one Negative Step requires zero enhancements,
two Negative Steps require one enhancement, and three Negative Steps require
two enhancements.

After failure-degree calculation and selected-Misfortune resolution, a
`negativeSteps === 1` selection is valid only when the selected Misfortune's
`scarConsequenceProposal` is null. For `negativeSteps === 2` or `negativeSteps
=== 3`, that proposal may be null or non-null. A normal failure can never
return a Scar-consequence proposal.

The selection consumes exactly all calculated Negative Steps. It cannot supply
`negativeSteps`, `failurePoints`, `overallFailureDegree`, a package plan, a
`scarConsequenceProposal`, or any calculated result. Unselected authored
Misfortunes never appear in the package and never contribute a proposal.

The selected package has these keys in order:

```js
{
  misfortuneId: "misfortune-id",
  enhancementIds: ["misfortune-enhancement-id"],
  misfortune: {/* selected full descriptor */},
  enhancements: [/* selected full descriptors in selection order */],
  nextSituation: {/* Section 18 descriptor */},
  scarConsequenceProposals: [/* selected Misfortune proposal only */]
}
```

`negativePackage.scarConsequenceProposals` is a dense isolated array containing
only the selected Misfortune's non-null `scarConsequenceProposal` (or it is
empty). The selected Misfortune contributes at most one proposal, and no
proposal from an unselected Misfortune may be copied in. Duplicate authored
tuples are rejected before package output; the generated collection itself has
no duplicate-detection rule.

Across the Event Definition, every non-null
  `rewards[n].voidFortune.voidFortuneId` is unique, and every non-null
`rewards[n].fieldRepairResource.fieldRepairResourceId` is unique. Authored
identity collisions are errors; they are never silently deduplicated or
aliased.

## 20. Reward-allocation selection

Allocation is an ordered array of step operations. The request has these keys
in order:

```js
{
  eventId: "event-id",
  sessionId: "session-id",
  rewardSelections: [
    {
      operation: "add-reward",
      rewardId: "reward-id",
      enhancementId: null
    },
    {
      operation: "enhance-reward",
      rewardId: "reward-id",
      enhancementId: "enhancement-id"
    }
  ]
}
```

`operation: "add-reward"` requires a null `enhancementId` and adds one
separate reward item. `operation: "enhance-reward"` requires a non-null
enhancement identity and targets a reward added by an earlier operation.

The array order is authoritative and deterministic. Each entry consumes one
Reward Step. The rules are:

- exactly `rewardSteps` entries;
- the exact count is never zero for a successful Event;
- at most three entries because Reward Steps are capped at three;
- at most three distinct added reward items;
- one enhancement operation per step;
- at most two enhancement operations on one reward;
- a reward may be added only once;
- an enhancement identity may be used at most once for one reward;
- duplicate operations are rejected;
- an operation targeting an unknown or incompatible descriptor is rejected;
- every selected enhancement ID must appear in the selected reward's
  `enhancementIds` list;
- an operation count below `rewardSteps` is rejected;
- an operation count above `rewardSteps` is rejected.

An allocation is valid only for Overall Event Success. A failed Event cannot
receive an allocation.

An allocated reward record has these keys in order:

```js
{
  rewardId: "reward-id",
  enhancementIds: ["enhancement-id"]
}
```

A selected reward may receive zero, one, or two distinct enhancements. The
allocation output contains one record for each selected reward in first-add
order; enhancement IDs retain selection order.

### 20.1 Reward authored-option sufficiency

After Overall Event Success and Reward Steps are regenerated, the analyzer
performs a deterministic existence check using only authored rewards and
enhancements. At least one legal ordered allocation must exist that consumes
exactly `rewardSteps` under every Section 20 rule. The check does not select an
allocation, return a preferred plan, or grant caller authority. If no such
allocation exists, Reward Step and Reward Allocation analysis fail with:

```text
code: m8-insufficient-authored-reward-options
path: eventDefinition.rewards
```

The authored-catalog diagnostic precedes validation of the caller's allocation
selection.

### 20.2 Misfortune authored-option sufficiency

After Overall Event Failure and Negative Steps are regenerated, the analyzer
performs a deterministic existence check for at least one authored Misfortune
that can form a legal package with exactly `negativeSteps - 1` distinct,
resolvable, compatible authored Misfortune enhancements. A one-step failure
requires at least one Misfortune for which a zero-enhancement selection is
legal; its authored `enhancementIds` catalog may be empty or nonempty, no
enhancement is selected, and the selected proposal must be null. Two- and
three-step failures require enough listed, resolvable, compatible, distinct
enhancements. The check does not choose a Misfortune, create a package, or
grant caller authority. If no legal package exists, Negative Step analysis
fails with:

```text
code: m8-insufficient-authored-misfortune-options
path: eventDefinition.misfortunes
```

The authored-catalog diagnostic precedes validation of `negativeSelection`.

## 21. Public request shapes

Every analyzer request is a plain object with exact key order and no extra
keys:

```js
{
  kind: "m8-overall-result",
  sessionId: "session-id",
  eventDefinition: {/* Section 8 */},
  completedRoundHistory: {/* Section 9 */}
}
```

The reward request uses `kind: "m8-reward-steps"` and the same exact four keys.
The negative request uses these exact five keys in order:

```js
{
  kind: "m8-negative-steps",
  sessionId: "session-id",
  eventDefinition: {/* Section 8 */},
  completedRoundHistory: {/* Section 9 */},
  negativeSelection: {/* Section 19 */}
}
```

The request `sessionId` is the authoritative expected Event Session identity.
It must equal `completedRoundHistory.sessionId`. A mismatch emits exactly one
`m8-session-identity-mismatch` diagnostic at
`completedRoundHistory.sessionId`. The immutable Event Definition contains no
`sessionId`.

The allocation request uses these keys in order:

```js
{
  kind: "m8-reward-allocation",
  sessionId: "session-id",
  eventDefinition: {/* Section 8 */},
  completedRoundHistory: {/* Section 9 */},
  allocation: {/* Section 20 */}
}
```

No request accepts a caller-authored overall result, Reward Step analysis,
Negative Step analysis, result package, allocation plan, or calculated negative
value. An analyzer safely captures the complete request and regenerates every
prerequisite from the supplied Event Definition and history.

## 22. Exact result envelopes

Validation returns keys in this order:

```js
{ valid, errors, warnings }
```

Capture returns keys in this order:

```js
{ ok, value, errors, warnings }
```

Every analysis failure returns the complete domain envelope with `ok: false`,
all nullable result fields set to null or empty arrays, at least one error, and
an empty warnings array. No failure returns a partial authoritative plan.

Every analyzer success has `ok: true`, its `readyFor...` field set to `true`,
`errors: []`, `warnings: []`, and every required scalar and collection set to
its calculated isolated value. Every analyzer failure has `ok: false`, its
`readyFor...` field set to `false`, at least one error, `warnings: []`, and no
captured identity or partial calculated result retained as authority. The
following exact failure sentinels apply; the listed scalar fields are nullable
on failure despite the primitive input constraints.

### 22.1 Overall result envelope

```js
{
  ok,
  readyForOverallResult,
  eventId,
  sessionId,
  definitionSnapshotId,
  roundCount,
  winningThreshold,
  successfulRoundCount,
  failedRoundCount,
  overallResult,
  errors,
  warnings
}
```

Overall Result failure values are:

```js
{
  eventId: null,
  sessionId: null,
  definitionSnapshotId: null,
  roundCount: null,
  winningThreshold: null,
  successfulRoundCount: null,
  failedRoundCount: null,
  overallResult: null
}
```

### 22.2 Reward Step envelope

```js
{
  ok,
  readyForRewardSteps,
  eventId,
  sessionId,
  definitionSnapshotId,
  roundCount,
  winningThreshold,
  overallResult,
  rewardPoints,
  rewardSteps,
  rewardDefinitions,
  errors,
  warnings
}
```

Reward Step failure values are:

```js
{
  eventId: null,
  sessionId: null,
  definitionSnapshotId: null,
  roundCount: null,
  winningThreshold: null,
  overallResult: null,
  rewardPoints: null,
  rewardSteps: null,
  rewardDefinitions: []
}
```

### 22.3 Negative Step envelope

```js
{
  ok,
  readyForNegativeSteps,
  eventId,
  sessionId,
  definitionSnapshotId,
  roundCount,
  winningThreshold,
  overallResult,
  failurePoints,
  negativeSteps,
  overallFailureDegree,
  negativePackage,
  errors,
  warnings
}
```

Negative Step failure values are:

```js
{
  eventId: null,
  sessionId: null,
  definitionSnapshotId: null,
  roundCount: null,
  winningThreshold: null,
  overallResult: null,
  failurePoints: null,
  negativeSteps: null,
  overallFailureDegree: null,
  negativePackage: null
}
```

### 22.4 Allocation envelope

```js
{
  ok,
  readyForRewardAllocation,
  eventId,
  sessionId,
  definitionSnapshotId,
  rewardSteps,
  rewardSelections,
  allocatedRewards,
  errors,
  warnings
}
```

Reward Allocation failure values are:

```js
{
  eventId: null,
  sessionId: null,
  definitionSnapshotId: null,
  rewardSteps: null,
  rewardSelections: [],
  allocatedRewards: []
}
```

`allocatedRewards` is isolated data containing the selected reward IDs and
ordered enhancement IDs. It is not an inventory mutation or an authorization
token.

`negativePackage` is the selected package from Section 19. The selected
Misfortune and selected Misfortune enhancements are full isolated descriptors;
unselected authored descriptors are absent.

## 23. M8-to-M10 result-package handoff

M8 does not expose a combined analyzer. M10 receives the independently
regenerated envelopes inside this pure handoff value, with keys in order:

```js
{
  kind: "voyage.m8-result-package",
  eventId: "event-id",
  sessionId: "session-id",
  definitionSnapshotId: "definition-snapshot-id",
  overallResult: {/* Section 22.1 */},
  rewardAnalysis: null,
  negativeAnalysis: {/* Section 22.3 */},
  allocationAnalysis: null,
  requiresGmApproval: true
}
```

On success, `rewardAnalysis` may be non-null and `negativeAnalysis` and
`allocationAnalysis` are null until a selection is supplied. On failure,
`negativeAnalysis` is non-null only after one `negativeSelection` has produced
one `negativePackage`, and the reward fields are null. This package is
informational and never authorizes persistent application. M8 does not hand an
ordinary Scar consequence directly to M9. M10 must regenerate or revalidate
every calculation against the live session, revalidate identity and capacity,
and approve the package before application. Only M10 may establish capacity
exhaustion and hand that condition to M9.

## 24. Proposed public API inventory

The final intended inventory is:

- `validateVoyageEncounterCompletedRoundHistory`;
- `captureVoyageEncounterCompletedRoundHistory`;
- `analyzeVoyageEncounterOverallResult`;
- `validateVoyageEncounterRewardDefinition`;
- `captureVoyageEncounterRewardDefinition`;
- `analyzeVoyageEncounterRewardSteps`;
- `validateVoyageEncounterMisfortuneDefinition`;
- `captureVoyageEncounterMisfortuneDefinition`;
- `analyzeVoyageEncounterNegativeSteps`;
- `analyzeVoyageEncounterRewardAllocation`.

`analyzeVoyageEncounterResultPackage` is rejected to avoid overlapping
authority. M10 composes the handoff from independently regenerated results.
Task 0 does not export or implement any inventory entry.

### 24.1 Exact public signatures

The intended signatures are:

```js
validateVoyageEncounterCompletedRoundHistory(
  completedRoundHistory,
  eventDefinition
)

captureVoyageEncounterCompletedRoundHistory(
  completedRoundHistory
)

analyzeVoyageEncounterOverallResult(request)

validateVoyageEncounterRewardDefinition(
  rewardDefinition,
  enhancementDefinitions
)

captureVoyageEncounterRewardDefinition(
  rewardDefinition
)

analyzeVoyageEncounterRewardSteps(request)

validateVoyageEncounterMisfortuneDefinition(
  misfortuneDefinition,
  misfortuneEnhancementDefinitions
)

captureVoyageEncounterMisfortuneDefinition(
  misfortuneDefinition
)

analyzeVoyageEncounterNegativeSteps(request)

analyzeVoyageEncounterRewardAllocation(request)
```

Capture APIs perform safe exact-shape capture only. Standalone validators
perform structural checks and the referential checks made possible by their
explicit second argument. Analyzers safely capture the complete request and
regenerate every prerequisite. Every input is an ordinary value, not a trusted
plan. The reward and Misfortune standalone validators validate only the
explicitly supplied descriptor catalog argument; reverse compatibility
references that require the complete Event Definition catalog are validated by
the analyzer's complete Event Definition validation, never fabricated by a
validator that lacks that catalog. No optional options object or alternate
overload exists.

## 25. Diagnostic contract

Diagnostics have exactly this shape:

```js
{ code, path, message, severity: "error" }
```

Warnings have the same fields with `severity: "warning"`. Task 1–4 return no
warnings; `warnings` is always an empty dense array. Raw exception, Proxy,
revocation, trap, stack, and engine text never escapes.

The exact error inventory is:

| Code | Canonical path | Meaning |
| --- | --- | --- |
| `m8-hostile-data-capture-failed` | `$` | Safe capture encountered inaccessible or hostile data. |
| `m8-invalid-request-shape` | `request` | Request has an ordinary unknown key or is not the exact plain-object shape. |
| `m8-invalid-event-definition` | `eventDefinition` | Event Definition slice is structurally invalid. |
| `m8-event-identity-mismatch` | `completedRoundHistory.eventId` | History event identity differs from the Event Definition. |
| `m8-session-identity-mismatch` | `completedRoundHistory.sessionId` | History session identity differs from the independently supplied request session. |
| `m8-definition-snapshot-mismatch` | `completedRoundHistory.definitionSnapshotId` | History snapshot identity differs from the Event Definition. |
| `m8-history-round-count-mismatch` | `completedRoundHistory.roundCount` | History round count differs from the Event Definition. |
| `m8-invalid-round-count` | `eventDefinition.roundCount` | Authored Event Definition round count is not 3, 5, 7, 9, or 11. |
| `m8-incomplete-round-history` | `completedRoundHistory.rounds` | Not every authored round appears exactly once. |
| `m8-duplicate-round-result` | `completedRoundHistory.rounds[n].roundId` | A round identity occurs more than once. |
| `m8-unknown-round-id` | `completedRoundHistory.rounds[n].roundId` | Round identity is not authored. |
| `m8-round-order-invalid` | `completedRoundHistory.rounds[n]` | Round number or array order is not canonical. |
| `m8-invalid-round-result` | `completedRoundHistory.rounds[n].roundResult` | Result is not one of the four accepted values. |
| `m8-invalid-reward-definition` | `eventDefinition.rewards[n]` | Reward descriptor shape or fields are invalid. |
| `m8-duplicate-reward-identity` | `eventDefinition.rewards[n].rewardId` | Reward identity is duplicated. |
| `m8-invalid-reward-enhancement` | `eventDefinition.enhancements[n]` | Enhancement descriptor is invalid. |
| `m8-duplicate-enhancement-identity` | `eventDefinition.enhancements[n].enhancementId` | Reward-enhancement identity is duplicated. |
| `m8-unresolved-reward-enhancement-reference` | `eventDefinition.rewards[n].enhancementIds[m]` | Reward enhancement identity does not resolve exactly once. |
| `m8-unresolved-compatible-reward-reference` | `eventDefinition.enhancements[n].compatibleRewardIds[m]` | Reward compatibility identity does not resolve exactly once. |
| `m8-invalid-compatible-reward-kind` | `eventDefinition.enhancements[n].compatibleRewardKinds[m]` | Reward compatibility kind is not one of the four authored reward kinds. |
| `m8-invalid-empty-reward-enhancement-compatibility` | `eventDefinition.enhancements[n]` | Both reward compatibility arrays are empty, authoring an unrestricted enhancement. |
| `m8-unsupported-enhancement-target` | `allocation.rewardSelections[n]` | Enhancement is incompatible with its target. |
| `m8-invalid-void-fortune` | `eventDefinition.rewards[n].voidFortune` | Void Fortune descriptor or authored-only rule is invalid. |
| `m8-duplicate-void-fortune-identity` | `eventDefinition.rewards[n].voidFortune.voidFortuneId` | Void Fortune identity is duplicated across rewards. |
| `m8-invalid-field-repair-resource` | `eventDefinition.rewards[n].fieldRepairResource` | Field Repair Resource descriptor is invalid. |
| `m8-duplicate-field-repair-resource-identity` | `eventDefinition.rewards[n].fieldRepairResource.fieldRepairResourceId` | Field Repair Resource identity is duplicated across rewards. |
| `m8-no-authored-rewards` | `eventDefinition.rewards` | Reward Step analysis has no valid authored reward definition. |
| `m8-reward-analysis-on-failure` | `overallResult` | Reward analysis was requested for a failed Event. |
| `m8-negative-analysis-on-success` | `overallResult` | Negative analysis was requested for a successful Event. |
| `m8-invalid-misfortune-definition` | `eventDefinition.misfortunes[n]` | Misfortune descriptor is invalid. |
| `m8-invalid-misfortune-enhancement` | `eventDefinition.misfortuneEnhancements[n]` | Misfortune-enhancement descriptor is invalid. |
| `m8-duplicate-misfortune-identity` | `eventDefinition.misfortunes[n].misfortuneId` | Misfortune identity is duplicated. |
| `m8-duplicate-misfortune-enhancement-identity` | `eventDefinition.misfortuneEnhancements[n].misfortuneEnhancementId` | Misfortune-enhancement identity is duplicated. |
| `m8-unresolved-misfortune-enhancement-reference` | `eventDefinition.misfortunes[n].enhancementIds[m]` | Misfortune enhancement identity does not resolve exactly once. |
| `m8-unresolved-compatible-misfortune-reference` | `eventDefinition.misfortuneEnhancements[n].compatibleMisfortuneIds[m]` | Misfortune compatibility identity does not resolve exactly once. |
| `m8-duplicate-scar-consequence-proposal` | `eventDefinition.misfortunes[n].scarConsequenceProposal` | The authored Scar-consequence proposal tuple duplicates an earlier authored Misfortune proposal. |
| `m8-incompatible-negative-package-enhancement` | `negativeSelection.enhancementIds[n]` | Selected enhancement is incompatible with the selected Misfortune. |
| `m8-no-authored-misfortunes` | `eventDefinition.misfortunes` | Negative Step analysis has no valid authored Misfortune definition. |
| `m8-insufficient-authored-reward-options` | `eventDefinition.rewards` | The authored reward and enhancement catalog cannot form any legal allocation consuming the calculated Reward Steps. |
| `m8-insufficient-authored-misfortune-options` | `eventDefinition.misfortunes` | The authored Misfortune catalog cannot form any legal package consuming the calculated Negative Steps. |
| `m8-invalid-negative-selection` | `negativeSelection` | Negative selection shape or identity is invalid. |
| `m8-negative-selection-step-mismatch` | `negativeSelection.enhancementIds` | The selected enhancement count does not equal `negativeSteps - 1`. |
| `m8-duplicate-negative-selection-enhancement` | `negativeSelection.enhancementIds[n]` | The same Misfortune enhancement was selected twice. |
| `m8-missing-next-situation` | `eventDefinition.nextSituations` | Failure has no required authored next situation. |
| `m8-invalid-next-situation` | `eventDefinition.nextSituations` | A next-situation descriptor is malformed or more than one was authored. |
| `m8-scar-consequence-not-allowed-on-normal-failure` | `eventDefinition.misfortunes[n].scarConsequenceProposal` | The selected Misfortune supplies a Scar-consequence proposal for a one-step normal Overall Event Failure. |
| `m8-invalid-reward-allocation` | `allocation` | Allocation shape is invalid. |
| `m8-allocation-event-mismatch` | `allocation.eventId` | Allocation event identity differs from the completed history. |
| `m8-allocation-session-mismatch` | `allocation.sessionId` | Allocation session identity differs from the independently supplied request session. |
| `m8-allocation-exceeds-reward-steps` | `allocation.rewardSelections` | Selection count exceeds calculated Reward Steps. |
| `m8-allocation-underallocated` | `allocation.rewardSelections` | Selection count is below calculated Reward Steps. |
| `m8-too-many-selected-rewards` | `allocation.rewardSelections` | More than three reward items were selected. |
| `m8-too-many-enhancements` | `allocation.rewardSelections[n]` | A reward received more than two enhancements. |
| `m8-duplicate-selection` | `allocation.rewardSelections[n]` | A duplicate reward or enhancement operation was supplied. |
| `m8-caller-authored-plan-rejected` | `request.overallResult` | Caller supplied an overall-result value. |
| `m8-caller-authored-plan-rejected` | `request.rewardAnalysis` | Caller supplied a reward analysis. |
| `m8-caller-authored-plan-rejected` | `request.negativeAnalysis` | Caller supplied a negative analysis. |
| `m8-caller-authored-plan-rejected` | `request.rewardSteps` | Caller supplied calculated Reward Steps. |
| `m8-caller-authored-plan-rejected` | `request.negativeSteps` | Caller supplied calculated Negative Steps. |
| `m8-caller-authored-plan-rejected` | `request.resultPackage` | Caller supplied a result package. |
| `m8-caller-authored-plan-rejected` | `request.allocationPlan` | Caller supplied an allocation plan. |
| `m8-caller-authored-plan-rejected` | `request.nextState` | Caller supplied mutable next state. |
| `m8-invalid-mode` | `request.kind` | API mode does not match the requested analyzer. |

## 26. Diagnostic precedence

The prohibited request-root authority keys are exactly:

`overallResult`, `rewardAnalysis`, `negativeAnalysis`, `rewardSteps`,
`negativeSteps`, `resultPackage`, `allocationPlan`, and `nextState`.

Diagnostics are emitted in this deterministic order:

1. hostile-data capture;
2. prohibited caller-authored authority keys;
3. invalid analyzer `kind`;
4. ordinary unknown keys and exact request shape;
5. Event Definition structure, descriptor validity, stable identity uniqueness,
   malformed next-situation descriptors, and `nextSituations` length greater
   than one;
6. authored compatibility-reference integrity;
7. event, session, and definition-snapshot binding;
8. round-count and completed-history validity;
9. regenerated overall-result analyzer applicability: reward analysis on
   Overall Event Failure emits `m8-reward-analysis-on-failure`; Negative
   analysis on Overall Event Success emits `m8-negative-analysis-on-success`;
10. mode-specific authored-option presence;
11. calculated authored-option sufficiency;
12. Negative Step missing-next-situation check;
13. `negativeSelection` or reward-allocation structural, identity,
   cardinality, duplicate, and compatibility validation;
14. selected-Misfortune normal-failure Scar restriction.

An invalid but structurally captured `kind` produces `m8-invalid-mode`, not
`m8-invalid-request-shape`. If `request.sessionId` differs from
`completedRoundHistory.sessionId`, exactly one session-mismatch diagnostic is
emitted at `completedRoundHistory.sessionId`.

Malformed next-situation descriptors and more than one next situation are
generic Event Definition validity failures for every analyzer. Zero next
situations is valid for Overall Result and Reward Step analysis but emits
`m8-missing-next-situation` during Negative Step analysis. The two analyzer
applicability diagnostics occur before no-authored-option and sufficiency
diagnostics. `m8-scar-consequence-not-allowed-on-normal-failure` is checked
only after `negativeSelection` succeeds and the selected Misfortune is
resolved. Within one category, input array order is preserved. Duplicate
diagnostics are deduplicated by `(code, path, message, severity)` while
retaining first occurrence. A failed category does not grant authority to any
subsequent category.

## 27. Hostile-data capture and isolation

All public inputs are captured before validation. Capture uses descriptor-safe
own-data reads, rejects accessors, cycles, sparse arrays, unsafe keys, revoked
Proxies, symbols, functions, and non-plain objects, and catches reflection
failures. The captured value is a fresh plain-data graph.

Every returned descriptor, array, envelope, and handoff is a fresh isolated
plain-data graph. No caller object is retained or mutated.

## 28. Determinism and authority

For identical captured inputs, every analyzer returns byte-for-byte equivalent
JSON-compatible data with identical array order and diagnostics. No random,
time, global, Foundry, PF2e, callback, or executable effect value is accepted.

Caller-authored analyses, plans, reward packages, Misfortune packages, and
Void Scar records have no authority. Only regenerated canonical analysis and
validated authored descriptors may appear in a result.

## 29. Mutation, revision, and event cardinality

Every M8 public API is pure:

- zero Event Session state changes;
- zero ship-state changes;
- zero revision increments;
- zero emitted events;
- zero inventory or resource changes;
- zero Pressure or Hazard changes;
- zero Void Scar creation or repair;
- zero Hull Integrity changes.

No failure or success analysis is an authorization token. M10 owns any
approved mutation transaction and its event/revision contract.

## 30. Interactions with existing systems

- **Momentum:** consumed only as existing round state; never converted to
  Reward Steps.
- **Risk Bids:** already reflected in the completed round results; M8 does not
  reinterpret or reroll them.
- **Pressure and Pressure Breaches:** M8 does not apply or reset Pressure and
  does not create a Breach.
- **Hazards:** M8 does not address, tick, close out, remove, replace, or
  escalate a Hazard.
- **Scar consequence proposals:** a critical Misfortune may return an authored
  `scarConsequenceProposal` descriptor only. It is not the M6
  `voyage.pressure-breach-applied` proposal, cannot be passed to either M7
  Pressure Breach creation function, and never authorizes a Scar record.
  M10 owns ordinary closeout review, live identity/capacity revalidation, and
  approved persistent application. M10 may use the M7 pure capacity analyzer
  as informational input but may not fabricate an M7 Pressure Breach source.
- **Void Scar capacity:** M8 does not calculate or mutate capacity. If M10's
  approved ordinary Scar application would exceed live capacity, M10 hands
  that established capacity-exhaustion condition to M9.
- **Repair:** a Field Repair Resource is an authored reward descriptor only;
  M7 owns its pure repair boundary.
- **Permanent consequences:** Misfortune persistence is descriptive proposal
  data. Generic consequence execution and durable approval are M10 scope.
- **Hull Integrity:** M8 never reads or changes Hull Integrity.

## 31. Milestone handoffs

### 31.1 Milestone 9

M9 receives only the capacity-exhaustion condition established by M10's later
closeout process. M9 owns Catastrophic Breakdown, the mandatory Catastrophic
Hazard, Emergency Response, and stabilization outcome. M8 does not hand an
ordinary `scarConsequenceProposal` directly to M9 and performs none of those
operations.

### 31.2 Milestone 10

M10 consumes regenerated M8 envelopes while composing the complete closeout
preview. M10 owns unresolved-Hazard closeout, resulting Pressure Breaches,
ordinary `scarConsequenceProposal` review, live identity/capacity
revalidation, complete proposal composition, GM approval, persistent
application, Foundry writes, and durable idempotency. M10 must revalidate live
identity and revision before any mutation and hands an established capacity
exhaustion to M9.

### 31.3 Milestone 11

M11 owns active-GM authority, request envelopes, unique request IDs, stale and
duplicate rejection, sockets, filtered projections, reload recovery, control
transfer, and audited correction. M8 has no multiplayer transport behavior.
M8 only revalidates selection identities and compatibility against the captured
Event Definition supplied to its analyzer; it does not determine transport
freshness, request-revision freshness, duplicate request delivery, or active-GM
authority.

### 31.4 Milestone 12

M12 owns UI, PF2e roll orchestration, player-facing projections, imported
content loading, and the first complete vertical slice. M8 remains a pure
domain calculation dependency.

## 32. Required future test matrix

Task 1–4 tests must cover:

- every legal round count;
- all four round-result values;
- critical results counting as one overall round;
- dense ordered history, missing entries, extras, duplicates, unknown IDs, and
  malformed results;
- identity, session, and definition-snapshot binding;
- exact request key order, independent session mismatch, and prohibited
  caller-authority-key precedence;
- exact success flags and failure sentinels for every analysis envelope,
  including null scalars, empty arrays, exact key order, errors, warnings, and
  absence of partial authority;
- exact winning threshold and no-tie behavior;
- Reward Step and Negative Step formulas, caps, and point retention;
- Momentum non-conversion;
- authored-only Void Fortune;
- reward, enhancement, Field Repair Resource, Misfortune,
  Misfortune-enhancement, and next-situation schema validation;
- unresolved reward/Misfortune enhancement references, empty compatibility-array
  semantics, nested Void Fortune/Field Repair Resource identity collisions, and
  exact authored-option availability diagnostics;
- compatibility-reference reverse lookups, exact reward-kind enum rejection,
  authored reward-allocation sufficiency, and authored Misfortune-package
  sufficiency before caller selection;
- normal and critical failure packages;
- no-reward guarantees;
- `scarConsequenceProposal`-only behavior, M7 boundary rejection, M10 review,
  and capacity handoff to M9 only after M10 establishes exhaustion;
- exact `negativeSelection` counts for one, two, and three Negative Steps,
  selected-package-only output, the `negativeSteps - 1` equation, normal-failure
  Scar rejection, incompatible and duplicate enhancement rejection, and
  authored Scar tuple rejection;
- zero-or-one generic next-situation cardinality and exact Negative Step
  missing/malformed/multiple diagnostics;
- allocation limits, duplicate rejection, compatibility, ordering, and
  selection identity revalidation against the captured Event Definition,
  including exact allocation and under-allocation rejection;
- M8 non-ownership of transport freshness, request-revision freshness,
  duplicate delivery, and active-GM authority, with those checks reserved for
  M11;
- hostile getters, Proxies including revoked Proxies, cycles, symbols, sparse
  arrays, unsafe keys, functions, and non-plain objects;
- deterministic repeated calls, caller isolation, cross-call isolation, and
  zero mutation/revision/event cardinality;
- rejection of caller-authored analyses and plans.

## 33. Proposed implementation task sequence

### Task 0 — contract lock

- **Files:** this contract only.
- **APIs:** none implemented or exported.
- **Behavior:** lock all schemas, envelopes, diagnostics, authority, and
  handoffs in this document.
- **Tests:** document quality, encoding, line-ending, and baseline checks.
- **Prerequisites:** synchronized Milestone 7 base and the sources listed in
  the authority section.
- **Exclusions:** every production, test, export, fixture, PF2e, Foundry, UI,
  persistence, and GitHub change.
- **Stop condition:** no implementation begins in Task 0.

### Task 1 — completed-round history and overall result

- **Files:** `scripts/voyage/domain/event-result.js` and
  `tests/voyage/domain/event-result.test.mjs`.
- **APIs:** `validateVoyageEncounterCompletedRoundHistory(completedRoundHistory,
  eventDefinition)`, `captureVoyageEncounterCompletedRoundHistory(completedRoundHistory)`,
  and `analyzeVoyageEncounterOverallResult(request)`.
- **Behavior:** capture and validate Section 9, then calculate Section 10.
- **Tests:** the complete history and result matrix in Section 32.
- **Prerequisites:** this contract and existing round-result classification.
- **Exclusions:** rewards, Misfortunes, allocation, closeout, and mutation.
- **Stop condition:** incomplete or hostile input returns the specified error
  envelope with zero mutation.

### Task 2 — reward definitions and Reward Steps

- **Files:** `scripts/voyage/domain/rewards.js` and
  `tests/voyage/domain/rewards.test.mjs`.
- **APIs:** `validateVoyageEncounterRewardDefinition(rewardDefinition,
  enhancementDefinitions)`, `captureVoyageEncounterRewardDefinition(rewardDefinition)`,
  and `analyzeVoyageEncounterRewardSteps(request)`.
- **Behavior:** validate Sections 13–16 and their reward-enhancement
  references/compatibility, then calculate Section 11 from a regenerated
  overall result and independently supplied session identity. Perform the
  authored-catalog existence check before accepting any allocation selection.
- **Tests:** Reward Step formula, cap, authored-only rewards, descriptor
  schemas, compatibility references and kinds, sufficiency failure, exact
  envelope sentinels, and isolation.
- **Prerequisites:** Task 1 and authored Event Definition capture.
- **Exclusions:** item creation, inventory, resource spending, and closeout.
- **Stop condition:** a failed Event is rejected and no reward is fabricated.

### Task 3 — Misfortune definitions and Negative Steps

- **Files:** `scripts/voyage/domain/misfortunes.js` and
  `tests/voyage/domain/misfortunes.test.mjs`.
- **APIs:** `validateVoyageEncounterMisfortuneDefinition(misfortuneDefinition,
  misfortuneEnhancementDefinitions)`,
  `captureVoyageEncounterMisfortuneDefinition(misfortuneDefinition)`, and
  `analyzeVoyageEncounterNegativeSteps(request)`.
- **Behavior:** validate Sections 17–18 and their Misfortune-enhancement
  references/compatibility, regenerate Section 12, require the exact
  negative-step sufficiency and next-situation cardinality, then validate the
  exact `negativeSelection` and return one selected `negativePackage`.
- **Tests:** normal/critical failure, no-reward guarantees, exact negative
  selection cardinality, `negativeSteps - 1`, normal-failure Scar rejection,
  authored tuple uniqueness, compatibility references, sufficiency failure,
  selected-package isolation, next situations,
  `scarConsequenceProposal` boundary rejection by M7 functions, exact envelope
  sentinels, M10 review, and M9 handoff only after M10 establishes capacity
  exhaustion.
- **Prerequisites:** Task 1 and the M7 Scar consequence boundary.
- **Exclusions:** Breakdown, Emergency Response, generic consequence
  execution, and persistent application.
- **Stop condition:** a successful Event is rejected and no Misfortune is
  fabricated.

### Task 4 — reward-allocation analysis

- **Files:** `scripts/voyage/domain/reward-allocation.js` and
  `tests/voyage/domain/reward-allocation.test.mjs`; public export wiring is
  permitted only after the pure module satisfies this contract.
- **APIs:** `analyzeVoyageEncounterRewardAllocation`.
- **Behavior:** regenerate the overall and Reward Step analyses, bind the
  independent session identity, require
  `allocation.rewardSelections.length === rewardSteps`, validate Section 20,
  and return the isolated allocation envelope.
- **Tests:** all allocation limits, ordering, duplicate selection, enhancement
  compatibility, exact authored-catalog sufficiency precedence, exact
  under-allocation rejection, envelope sentinels, and selection identity
  revalidation against the captured Event Definition.
- **Prerequisites:** Tasks 1 and 2.
- **Exclusions:** inventory, resources, Field Repair Resource consumption,
  repair, approval, persistence, and UI.
- **Stop condition:** caller-authored analysis or allocation plan has no
  authority and cannot bypass regenerated limits.

No Task 5 combined analyzer is authorized. The independently regenerated
envelopes are sufficient for the M10 handoff and avoid overlapping authority.

## 34. Contract acceptance criteria

This Task 0 contract is accepted only when:

- every public field used by Tasks 1–4 is defined above;
- every public value has a fixed key order;
- every diagnostic has a fixed code, path, message meaning, and precedence;
- every analyzer is pure and non-authoritative;
- M9, M10, M11, and M12 boundaries remain explicit;
- no executable callback, generic effect, PF2e object, or Foundry object is
  present;
- the document contains no Task 0 production or test implementation.
