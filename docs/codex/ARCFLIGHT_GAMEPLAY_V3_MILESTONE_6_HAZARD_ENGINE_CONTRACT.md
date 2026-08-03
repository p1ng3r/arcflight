# Arcflight Gameplay V3 Milestone 6 — Hazard Engine Contract

**Status:** Current accepted implementation contract; completion is determined
by the cumulative Milestone 6 audit. This document records implemented
behavior and explicitly deferred behavior.

The canonical Event Runner rules and the Gameplay V3 milestone map remain the
design authority. This contract records the accepted, Foundry-free domain
slice that implements those rules. The public domain APIs listed here are
authorized. Foundry registration, UI, sockets, authority, durable persistence,
and runtime integration remain separately deferred.

## 1. Implemented domain foundation

`activeHazards` is temporary authoritative Voyage Encounter state. It contains
only canonical active Hazard records; it is not permanent ship data. A system
slot is occupied only when:

```text
category === "system" && status === "active" &&
pressureSystemId === requestedPressureSystemId
```

The Hazard schema supports the categories `system` and `event`, statuses
`active`, `resolved`, `expired`, and `replaced`, canonical provenance, exact
timing, escalation, duration, collision, and terminal fields. Capture and
validation reject hostile, accessor, Proxy, cyclic, sparse, unsafe-key, and
noncanonical data. All domain results are isolated serializable data and never
mutate caller inputs.

The implemented registry contains exactly five Pressure-system Hazard
definitions: `crew-morale`, `arkengine`, `levstone-array`, `solar-sail-rig`,
and `lifeveil`. An ordinary Pressure Breach persists its canonical Hazard in
the existing atomic Pressure Breach transaction, resets Pressure as before,
creates the existing Void Scar proposal, increments revision once, and emits
one existing event.

## 2. Implementation-status matrix

| Area | Current Milestone 6 status |
| --- | --- |
| Exact Hazard schema and safe capture | Implemented |
| `activeHazards` encounter validation | Implemented |
| Five canonical system-Hazard definitions and registry | Implemented |
| Ordinary Pressure Breach Hazard persistence | Implemented |
| Pure collision planning for all five policies | Implemented |
| Pure stage-escalation planning | Implemented |
| Contracted staged escalation application | Implemented |
| Repeated `trigger-existing-consequence` Pressure Breach integration | Implemented |
| Narrow domain-authored Pressure for failed Address Hazard | Implemented |
| Pure start-of-next-round operational timing | Implemented |
| Address Hazard success, critical success, failure, and critical failure | Implemented |
| Terminal addressed snapshots and `voyage.hazard-resolved` | Implemented |
| `replace-existing`, `extend-duration`, and `add-pressure` application | Planner/schema support only; atomic application deferred |
| Other policy application beyond the implemented subset | Deferred and fail-closed |

The following remain explicitly deferred: countdown and duration ticking;
unresolved-Hazard closeout and `ignoredConsequence` application to Milestone
10; Hazard projection to Milestone 11 Recoverable Event Session runtime or the
later player-facing vertical slice; UI; sockets and authority; durable
persistence; PF2e Address Hazard roll orchestration; generic
consequence/effect execution; and upgrade hooks.

## 3. Collision policy contract

The schema and pure `analyzeVoyageHazardCollisionPlan` recognize exactly five
policies:

```text
escalate-existing
replace-existing
trigger-existing-consequence
extend-duration
add-pressure
```

Planner recognition does not authorize atomic application. The current support
matrix is:

| Policy | Planner | Atomic application |
| --- | --- | --- |
| `trigger-existing-consequence` | Yes | Yes, only in Pressure Breach |
| `escalate-existing` | Yes | Yes, through the contracted standalone staged application |
| `replace-existing` | Yes | Deferred; fail closed |
| `extend-duration` | Yes | Deferred; fail closed |
| `add-pressure` | Yes | Deferred; fail closed |

For a repeated same-system Pressure Breach,
`applyVoyageHazardTriggerExistingConsequence(encounterState, incomingHazard)`
is a request-only boundary. It safely captures and validates the encounter and
incoming active Hazard, requires matching encounter identity, regenerates
`analyzeVoyageHazardCollisionPlan` internally, validates that same-invocation
analysis, and then selects the exact existing authored consequence. It accepts
no collision analysis or collision plan. JavaScript extra arguments have no
authority.

On a canonical no-collision result, it returns an isolated unchanged
`activeHazards` collection with `consequence: null` and
`collisionOutcome: null`. On the supported collision, it retains the existing
Hazard at its exact index, does not persist the incoming Hazard, does not
execute the consequence, and returns the exact six-key `collisionOutcome`:

```text
kind, hazardId, incomingHazardId, pressureSystemId, collisionPolicy, consequence
```

The helper owns neither revision nor event emission. Failures are atomic and
return `ok: false`, `activeHazards: null`, `consequence: null`, and
`collisionOutcome: null` with deterministic diagnostics.

## 4. Staged escalation

`analyzeVoyageHazardStageEscalation` derives a pure stage result from a
validated escalation collision plan. `applyVoyageHazardStageEscalationPlan`
performs the contracted standalone application: it binds the indexed live
Hazard and snapshot, changes only that active Hazard, validates the candidate,
increments revision once, and emits exactly one `voyage.hazard-escalated`
event. It does not execute a consequence, trigger Pressure Breach, tick a
countdown, process duration, perform closeout, or add runtime behavior.

## 5. Operational timing and Address Hazard

`analyzeVoyageHazardOperationalTiming(encounterState, hazard)` is a pure
eligibility analyzer. For `start-of-next-round`, a Hazard becomes operational
when `state.roundNumber >= hazard.createdRoundNumber + 1`. It does not mutate
state, activate or execute an effect, increment revision, or emit an event.

`applyVoyageAddressHazard(encounterState, request)` accepts a validated,
live-bound, precomputed four-degree outcome; it performs no PF2e roll,
skill/DC selection, actor lookup, ownership check, or station-eligibility
decision. Success and critical success remove the exact active system Hazard
and emit one resolved event. Failure and critical failure retain the Hazard
and delegate exactly one narrow domain-authored Pressure effect (+1 or +2).
Neither failure path performs a same-transaction Pressure Breach.

## 6. Event constants and emitted payloads

These constants may exist without current producers:

| Event constant | Status |
| --- | --- |
| `voyage.hazard-created` | Deferred |
| `voyage.hazard-replaced` | Deferred |
| `voyage.hazard-consequence-triggered` | Deferred; the repeated-breach helper returns isolated outcome data only |
| `voyage.hazard-duration-extended` | Deferred |
| `voyage.hazard-expired` | Deferred |
| `voyage.hazard-closeout-consequence-applied` | Deferred to Milestone 10 |

The currently emitted event payloads are exact, isolated, and covered by the
named focused tests:

| Event | Exact keys |
| --- | --- |
| `voyage.pressure-breach-applied` | `type`, `encounterId`, `lifecycleState`, `stageId`, `roundNumber`, `phase`, `pressureEffectCount`, `appliedEffectCount`, `breach`, `hazard`, `collisionOutcome`, `voidScarProposal`, `pressureReset`, `effects`, `previousPressureSystems`, `pressureSystems`, `previousRevision`, `revision` |
| `voyage.hazard-escalated` | `type`, `encounterId`, `hazardId`, `incomingHazardId`, `pressureSystemId`, `collisionPolicy`, `requestKind`, `requestedTargetStageId`, `operationId`, `previousStageId`, `targetStageId`, `skippedStages`, `previousHazard`, `hazard`, `previousRevision`, `revision` |
| `voyage.hazard-resolved` | `type`, `encounterId`, `lifecycleState`, `stageId`, `roundNumber`, `phase`, `hazardId`, `pressureSystemId`, `outcome`, `previousRevision`, `revision`, `previousHazard`, `hazard`, `benefit` |
| `voyage.pressure-applied` | `type`, `encounterId`, `lifecycleState`, `stageId`, `roundNumber`, `phase`, `pressureEffectCount`, `standardPressureEffectCount`, `authoredPressureEffectCount`, `effects`, `previousPressureSystems`, `pressureSystems`, `previousRevision`, `revision` |

## 7. Public domain API inventory

The accepted public domain APIs for this slice are:

- `validateVoyageHazardRecord`
- `captureVoyageHazardRecord`
- `analyzeVoyageHazardCollisionPlan`
- `analyzeVoyageHazardStageEscalation`
- `applyVoyageHazardStageEscalationPlan`
- `applyVoyageHazardTriggerExistingConsequence`
- `analyzeVoyageDomainPressureEffectPlan`
- `applyVoyageDomainPressureEffect`
- `analyzeVoyageHazardOperationalTiming`
- `applyVoyageAddressHazard`

No caller-authored repeated-breach collision-plan or collision-analysis
application API exists. A planner result is inspectable data, not an
authorization token.

## 8. Projection and runtime boundary

No Hazard projection module or projection test is required for Milestone 6.
Role-filtered player, crew, observer, and GM projections belong to the
Milestone 11 Recoverable Event Session runtime and the later player-facing
vertical slice. Current outputs are isolated domain data.

## 9. Test and audit baseline

Before this correction, the committed baselines were 302 focused-audit tests,
956 Voyage domain tests, 145 Voyage PF2e tests, and 1,101 combined Voyage
tests. The post-correction totals are 303 focused-audit tests, 957 Voyage
domain tests, 145 Voyage PF2e tests, and 1,102 combined Voyage tests. Test
counts are not a source-code line-count contract.

## 10. Boundaries retained by this milestone

This slice introduces no countdown or duration processing, Hazard projection,
closeout, UI, socket, authority, persistence, PF2e, Foundry, generic effect
execution, or additional collision-policy application behavior. It preserves
ordinary Pressure Breach behavior, its exact event contract, Pressure reset,
and Void Scar proposal semantics.
