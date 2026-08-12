# Arcflight Gameplay V3 — Milestone 12 Task 1 Launch Contract

This narrow Task 1 protocol covers only the first handcrafted M12 Event
launch. It is not a general M12 command contract and does not authorize round
actions, rolls, Risk Bids, reactions, closeout, or M10 persistence.

## Trusted launch request

The controller accepts one hostile-safely captured plain-data request with
this exact key order:

```js
{
  kind,
  requestId,
  sessionId,
  expectedRevision,
  authorityEpoch,
  eventId,
  definitionSnapshotId,
  shipId,
  operatorSelections
}
```

`kind` is `voyage.m12-launch-event`. `expectedRevision` and `authorityEpoch`
must both be non-negative safe integers equal to `0`; nonzero values fail as
stale revision or changed authority before any write. The authenticated
connected principal must be the unique current active GM. `eventId` and
`definitionSnapshotId` must identify the registered immutable M12 snapshot.
`shipId` resolves to an existing valid Arcflight PF2e vehicle Actor. Operator
selections are station-to-Actor id/UUID choices normalized through the
canonical station-assignment identity schema; unoccupied fixed stations are
represented by `null` and duplicate operators are rejected.

## Launch ownership and evidence

The controller resolves and validates the immutable definition, builds a
canonical draft through the M11 creation boundary, and then applies the
existing M12-owned domain transitions for station assignments, configuration,
ready, activation, and Crew Planning. It persists only the Event Session
JournalEntry flag subtree; no ship Actor, PF2e data, Item, M10 ledger, or
closeout state is changed.

The launch appends five M12 runtime events in order:

```js
voyage.m12-station-assignments
voyage.m12-configuration
voyage.m12-ready
voyage.m12-activation
voyage.m12-crew-planning
```

Each event is an exact plain-data record containing `sessionId`, `eventId`,
`definitionSnapshotId`, `shipId`, its transition and session-state pair, the
previous/current encounter revisions, and the previous/current M11 revisions.
The sequence is `0 → 1 → 2 → 3 → 4 → 5`, ending in `crew-planning` with the
canonical fixed station assignments. One `m12-launch` audit and one
`m12-launch` processed request record bind the authenticated GM, revision,
event count, and canonical request fingerprint. Launch does **not** create a
`before-plan-lock` checkpoint: that checkpoint belongs exclusively to the
canonical plan-lock operation, after the crew has supplied and validated its
complete plan. This preserves the M11 pre-lock correction boundary. Existing
M11 reload, idempotency, hostile-data, and append-only validation remains
authoritative.

Launch is one failure-safe orchestration. If this launch creates a JournalEntry
and the complete final state cannot be reread and validated, only that exact
newly-created document may be deleted, with deletion reread and verified
before failure is returned. A persisted-then-thrown update is success only when
the exact complete launch candidate is proven durable. No pre-existing or
identity-mismatched document may be removed.

An exact repeated request returns the isolated stored response without a
write. A changed request using the same request ID conflicts without a write.
Closing or reopening the manager is read-only; the dashboard discovers and
validates the durable M12 session through the trusted Foundry/M11 read path and
is regenerated from the durable M11 projection. Public launch requests contain
only gameplay proposal fields; authenticated user, GM, connection,
active-GM, coordinator, and timestamp authority come from an internal trusted
Foundry adapter. The immutable snapshot already contains canonical authored
round/action structures for direct consumption by later M12 planning APIs.
