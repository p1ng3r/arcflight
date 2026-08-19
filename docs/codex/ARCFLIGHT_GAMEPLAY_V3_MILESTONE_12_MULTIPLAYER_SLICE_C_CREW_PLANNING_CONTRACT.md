# Arcflight Gameplay V3 — M12 Multiplayer Slice C: Crew Planning

This slice adds the first player-owned write path to the existing Event Session
runtime. It does not create a second planning engine or a second persistence
store.

## Boundary

The only player commands enabled here are the existing canonical
`station-selection` and `station-selection-clear` commands. A player may submit
intent for an assigned station only when the trusted durable station assignment
is owned by that authenticated player. The request may contain only the
canonical station/action/approach/risk-bid selection fields; identity, role,
ownership, revision, authority, and coordinator values remain trusted runtime
data. GM station order, Plan Lock, resolution, reactions, rolls, recovery,
closeout, and round consequences remain outside this slice.

The command path is:

`authenticated connected user → validated Event Session → trusted owned-operator
derivation → existing M11 coordinator and station-selection command → one
authoritative revision → fresh filtered projection`.

The durable Event Session remains the sole source of truth. Stale revisions,
locked sessions, resolution sessions, foreign stations, unoccupied stations,
crew users, observers, malformed payloads, and forged authority claims fail
closed without a write.

## Filtered planning options

`readVoyageEventSessionMultiplayerProjection` retains the Slice A common
projection and adds `ownedPlanningOptions`. It is an array containing entries
only for stations owned by the authenticated operator (or all assigned stations
for the GM projection). Each entry has this exact key order:

```js
{
  stationId, selectedActionId, selectedApproachId, selectedRiskBidId,
  editable, ready, actions
}
```

Each action contains only:

```js
{
  actionId, displayName, description, selected, approaches,
  riskBidCapable, riskBidOptions, targetRequired, eligibleTargets
}
```

Approaches contain `approachId`, `label`, `description`, and `selected`.
Risk-bid options contain the authored `riskBidId`, tier, player-facing label,
intended benefit, target, four player-facing outcome strings, and selection
state. No GM notes, internal DC calculations, hidden effects, raw authored
objects, recovery data, live documents, audits, receipts, or private authority
metadata cross the projection boundary. Crew, observer, and unowned stations
receive no option catalogue.

## UI and state boundaries

The Player Event `MY STATION` tab renders controls only from
`ownedPlanningOptions`. It submits the existing command payload and rerenders
from a fresh projection after success or stale rejection. `CREW PLAN` remains a
shared read-only summary. Plan Lock and Resolution make all player controls
read-only; DOM state is not a security boundary. Multiple owned stations are
independent, and the M11 revision/coordinator/idempotency rules prevent stale
overwrites.

Slice D owns collaborative station order; Plan Lock remains GM-only under the
current roadmap authority. Slice E owns Unlock/Relock recovery. Later slices
own resolution, execution, reactions, recovery, and closeout.
