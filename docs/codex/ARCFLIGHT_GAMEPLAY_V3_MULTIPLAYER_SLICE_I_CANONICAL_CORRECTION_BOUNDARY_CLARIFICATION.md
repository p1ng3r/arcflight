# M12 Multiplayer Slice I — Canonical Correction Boundary Clarification

## Status

Architecture/contract clarification only. This document adds no runtime API,
does not authorize a generic callback, and does not change Event Session
persistence. The current executable Slice I scope is limited to
`remaining-order`, `operator-takeover`, `void-roll`, and
`retry-roll-integration`. Target and recorded-result remain roadmap-authorized
but deferred and write-free until the missing canonical boundaries below are
decided and implemented.

## Authorities inspected

The authority order was applied as written:

1. `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`
2. `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`
3. `docs/gameplay-v3/reconciliation-and-continuation-roadmap.md`
4. `docs/codex/CURRENT-GAMEPLAY-V3.md`
5. `docs/codex/ARCFLIGHT_GAMEPLAY_V3_MILESTONE_12_PLAYER_GM_ROUND_INTERACTION_RECOVERY_CONTRACT.md`
6. `docs/codex/ARCFLIGHT_GAMEPLAY_V3_MULTIPLAYER_SLICE_I_TARGETED_GM_IN_RESOLUTION_RECOVERY_CONTRACT.md`
7. `docs/codex/ARCFLIGHT_GAMEPLAY_V3_MILESTONE_11_EVENT_SESSION_RUNTIME_CONTRACT.md`

The corresponding domain, Foundry runtime, trusted-boundary, and focused test
files were inspected before this clarification was written.

## Target correction

### Classification: B — roadmap-authorized but domain model incomplete

There is a real target-bearing field, but there is not enough canonical target
state or mutation policy to define a safe correction operation.

The current production path is:

```text
encounterState.targets[stationId]
  → resolution-execution-requests target
  → pendingChecks[].target
```

`pendingChecks.js` validates the copied target against the execution request,
and `resolution-results.js` resolves a pending check into
`pendingChecks[].result`. `station-selection.js` has no target mutation, and
the current M12 authored actions do not author a target-bearing selection path.
No accepted domain helper currently reconstructs or changes a target.

Consequently, the target field is present in the canonical state shape, but
the source of truth for a correction, its identity, and its downstream effect
are not defined. The current Slice I runtime correctly requires a trusted
`applyVoyageEncounterTargetCorrection` capability and rejects when it is
absent; it must remain write-free until that capability exists.

### Target timing and protected state

The M12 interaction contract permits correction only for an objectively invalid
target on the unresolved/current station before irreversible outcome
application. It does not define how to distinguish an authored target, a
player-selected target, and a runtime-generated target, nor how a corrected
target updates all dependent evidence. No legal correction window can therefore
be implemented safely yet.

The eventual domain boundary must, at minimum, derive the current station and
pending-check identity server-side, accept only the canonical target identity
for that current unresolved check, reject foreign/future/historical checks and
post-finalization changes, and return a new canonical plain-data state. It must
preserve the selected Action, Approach, statistic, Risk Bid, station order,
pending-check identity, and any already-finalized PF2e/result evidence. These
are design constraints, not an API definition.

### Target design decision required

Define the canonical target authoring/selection source and the exact dependent
state that a target correction is allowed to recompute. Target is not an
executable operation in the current Slice I checkpoint. Until that decision and
domain operation exist, the runtime must not advertise target correction as
implemented or invoke a missing callback; any reserved target request remains a
deterministic write-free deferred/unsupported result using an existing
authorized diagnostic.

## Recorded-result correction

### Classification: C — authoritative evidence is undefined

The exact canonical result identity currently available is the
`pendingCheckId`/sequence/station identity in `pendingChecks[]`, with the
resolved result record containing `total`, `degreeOfSuccess`,
`degreeOfSuccessSlug`, `statisticSlug`, `dc`, and `rollMode`. The trusted PF2e
execution result is validated by `validExecutionResult` and is copied into the
matching pending check by `applyVoyageEncounterPendingCheckResult`, which also
appends `voyage.pending-check-resolved`.

That architecture has no canonical source that can later prove a different
result is the actual valid PF2e result. It also has no superseding-result
identity, void marker, corrected-result history, or downstream reconciliation
operation. A GM-supplied `{ total, degree, dc, result }` is expressly not an
authoritative source and must never be accepted.

The current Slice I runtime must not expose recorded-result as an executable
operation. No result correction API may be invented around the caller's
`correctedResult` payload.

### Recorded-result design decision required

The owning domain contract must first identify the trustworthy evidence source
(for example, a durable PF2e execution receipt or another explicitly verified
technical record), define whether correction is a supersession or a void-plus-
replacement, and specify every downstream field that is recomputed or
superseded. It must preserve the original pending check, PF2e evidence, result,
runtime event, and audit, append a new correction identity, and define which
result later consumers treat as authoritative. Until then the required
classification is `ROADMAP-AUTHORIZED BUT CANONICAL EVIDENCE SOURCE UNDEFINED`.

## Required trusted capabilities (not implemented here)

| correction | owning boundary still required | purpose | persistence owner |
| --- | --- | --- | --- |
| target | a new canonical encounter target-correction helper in the domain layer | validate the current unresolved target and return canonical plain state | M11 Event Session runtime |
| recorded-result | a new canonical result-evidence/supersession helper in the domain layer | reconstruct a result only from verified evidence and return canonical plain state | M11 Event Session runtime |

`trustedLaunchContext()` currently exposes no capability for either operation.
Adding arbitrary callbacks would bypass the domain boundary and is prohibited.

## Current executable scope

The current Slice I acceptance surface contains exactly these four operations:

1. `remaining-order`
2. `operator-takeover`
3. `void-roll`
4. `retry-roll-integration`

`target` and `recorded-result` remain roadmap-authorized categories, but are
deferred from this executable checkpoint. The main Slice I contract must not
describe them as implemented public/runtime operations until their prerequisites
are accepted.

The current JavaScript still contains reserved knowledge of the two deferred
kinds from the earlier six-category pass. That is an implementation-alignment
follow-up, not part of this design task: the next narrow runtime correction must
remove or deactivate those dispatcher paths, or reject them deterministically as
deferred/unsupported before checking for missing capabilities. No JavaScript is
changed by this clarification.

## Existing reusable witnesses

### Remaining-order

The later correction pass should reuse the existing canonical order helpers:

- `analyzeVoyageEncounterStationOrder` and
  `validateVoyageEncounterStationOrder` from
  `scripts/voyage/domain/station-order.js`;
- `analyzeVoyageEncounterResolutionOrder` from
  `scripts/voyage/domain/resolution-order.js` for the resolution-specific
  dependency/order analysis.

No order implementation is changed by this clarification.

### Operator-takeover

The existing trusted authority witness is split across:

- `trustedAuthorityContext`/`authority` in
  `scripts/voyage/foundry/event-session-runtime.js`, which validates the
  authenticated GM, the unique active GM, and (when required) the trusted
  connection ID;
- the trusted users snapshot supplied by `trustedLaunchContext()`, whose
  `active` value is the only existing connected/disconnected Foundry-user
  witness;
- `session.authorityEpoch` for the durable authority epoch; and
- `encounterState.metadata.recoveryControl.controllerUserId` for the current
  GM takeover marker.

There is no existing trusted mapping from an assigned operator/Actor to its
controlling player connection, and `resolveVoyageOperatorForPrincipal` returns
owned operator identities rather than connection/control status. Therefore the
current Slice I takeover rule is disconnect-only: derive the assigned
operator/Actor server-side, resolve all legitimate non-GM owners through the
canonical ownership resolver, and inspect trusted Foundry `User.active` state.
If any legitimate non-GM owner is active, takeover rejects. If legitimate
non-GM owners exist and all are inactive, takeover may proceed. If no non-GM
owner exists, do not infer disconnection; use existing GM/operator authority
semantics. If no canonical controller can be established, takeover rejects
unless existing M11 control semantics explicitly define that case. No generic
`stuck` flag, second operator-to-user mapping, or station reassignment is
allowed.

## Required decisions before implementation

1. Define the canonical target authoring/selection identity and all target-
   dependent state that may be recomputed before irreversible outcome
   application.
2. Define the trusted evidence source, supersession identity, and downstream
   reconciliation model for recorded results.
3. Preserve the disconnect-only takeover rule by using canonical operator
   ownership plus trusted Foundry user activity; do not invent a stuck detector.

Until these decisions are accepted, implementing target or recorded-result
mutation would require inventing authoritative behavior. The safe result is
to keep those operations rejected with zero writes.
