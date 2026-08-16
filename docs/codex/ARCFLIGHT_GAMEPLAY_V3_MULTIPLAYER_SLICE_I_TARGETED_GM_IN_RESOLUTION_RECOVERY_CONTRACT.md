# Arcflight Gameplay V3 — Multiplayer Slice I

## Targeted GM in-Resolution recovery

Slice I begins only after the Event Session is in `station-resolution` with an
active encounter in the `resolution` phase. It reuses the M11
`voyage.m11-correct-session` envelope, coordinator, optimistic revision and
authority-epoch checks, hostile-safe capture, append-only runtime event/audit,
replay/fingerprint validation, and post-write reread classification.

Slice I defines six roadmap correction categories, but the current executable
Slice I checkpoint accepts exactly four of them: `remaining-order`,
`operator-takeover`, `void-roll`, and `retry-roll-integration`. `target` and
`recorded-result` remain roadmap-authorized categories deferred from executable
acceptance until the canonical prerequisites recorded in
`ARCFLIGHT_GAMEPLAY_V3_MULTIPLAYER_SLICE_I_CANONICAL_CORRECTION_BOUNDARY_CLARIFICATION.md`
exist. They must not be advertised as implemented runtime operations.

| correctionKind | exact `replacementPayload` | bounded effect |
| --- | --- | --- |
| `remaining-order` | `{ stationOrder }` | changes only the unresolved suffix of the committed order; resolved positions and locked selections remain unchanged |
| `target` | `{ stationId, targetStationId }` | roadmap category only; deferred pending canonical target authoring, identity, dependency/recomputation, mutation, and reload boundaries |
| `operator-takeover` | `{ stationId }` | records temporary GM control for the current assigned operator without changing assignment or locked choices |
| `void-roll` | `{ pendingCheckId }` | requires trusted invalid/erroneous/voidable evidence, preserves the original check evidence, and creates a new pending identity for an objectively unusable current check |
| `retry-roll-integration` | `{ pendingCheckId }` | is accepted only for trusted `failed`, `uncertain`, or `recovery-required` integration evidence and creates a new pending identity |
| `recorded-result` | `{ pendingCheckId, correctedResult }` | roadmap category only; deferred pending authoritative correction evidence, supersession identity, downstream reconciliation, and persisted-history validation |

Pause, abort, audit-history browsing, and broad plan editing are not new Slice
I operations; existing M11 abort/correction behavior and later slices retain
those responsibilities.

The complete request has the existing exact M11 correction keys:

```js
{
  kind: "voyage.m11-correct-session",
  requestId, sessionId, expectedRevision, authorityEpoch,
  correctionKind, targetRequestId: null, targetCheckpointId: null,
  replacementPayload, reason, confirmation: true
}
```

Every operation rejects `crew-planning`, `plan-locked`, `round-closeout`,
`next-round`, `event-closeout-review`, `persistent-application`, `completed`,
`paused`, `recovery-required`, and any non-active/non-resolution encounter.
`remaining-order` requires the canonical unresolved current station and an exact
station set with an unchanged resolved prefix. `operator-takeover` and all
check operations bind to the server-derived current station; they never accept
an arbitrary historical or future station. `void-roll` and
`retry-roll-integration` additionally require the trusted integration marker
for the requested failure. The current executable scope is therefore exactly
the four operations listed above. Reserved `target` and `recorded-result`
requests are deferred/unsupported; the subsequent implementation correction
must make them fail deterministically without attempting a missing trusted
capability or writing the session.

Only the authenticated connected current active GM may invoke these operations.
For the current executable `operator-takeover` operation, takeover is
disconnect-only: the runtime derives the assigned operator/Actor server-side,
resolves canonical legitimate non-GM owners, and rejects while any such owner
is active. It may proceed only when legitimate non-GM owners exist and all are
inactive. No non-GM owner does not prove disconnection; existing GM/operator
authority semantics apply. No generic stuck flag, second operator-to-user
mapping, or station reassignment is permitted.
The final authority, document, revision, epoch, current station/check identity,
and candidate are reread inside the existing exclusive coordinator and local
same-runtime mutex. Players and non-active GMs remain outside this API and the
Slice G/H player transport allowlist is unchanged.

Broad Plan Unlock is not available after Resolution begins. No operation may
rewrite the whole session, move the resolution cursor arbitrarily, alter a
resolved station, change a locked Action/Approach/Risk Bid, or casually edit a
PF2e result. Original check/result evidence is retained in the correction
audit/metadata and every successful operation appends exactly one corrected
runtime event, one `correction-applied` audit, and one processed-request record.

Exact replay returns the isolated stored response without a write; changed
payload, stale revision, stale authority epoch, contention, invalid lifecycle,
forged station/check identity, or missing trusted evidence fails closed. Retry
uses a new pending-check identity and therefore cannot reroll by replaying the
old request. Focus receipts/windows, Risk Bids, dependency effects, and the
committed order remain bound to their original identities.

The GM Event Manager may expose only narrowly preconditioned controls for these
four executable operations. UI visibility is never authority. Player projections expose only
the resulting safe canonical resolution state and never correction reasons,
raw audits, or private evidence.

The final station still ends at `Resolution Complete` / `Awaiting Round
Closeout`; Slice I does not implement Momentum, Pressure, Hazards, next-round
aggregation, persistent application, or final closeout. Those remain later
milestones. Slice J owns any future broader recovery handoff.
