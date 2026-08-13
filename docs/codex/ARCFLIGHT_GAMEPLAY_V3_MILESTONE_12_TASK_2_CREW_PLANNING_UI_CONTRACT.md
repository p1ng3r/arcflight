# Arcflight Gameplay V3 - M12 Task 2 Crew Planning UI Contract

Task 2 uses the existing M11 command envelope and the canonical Voyage domain
mutators. The public command kinds are exactly:

- `station-selection` payload `{ stationId, actionId, approachId, riskBidId }`,
  where `riskBidId` is an authored ID or `null` for No Bid;
- `station-selection-clear` payload `{ stationId }`;
- `station-order` payload `{ stationOrder }`;
- `plan-lock` payload `{ phaseStartSnapshotId }`.

Payload objects are captured and validated by M11 before any domain operation.
The domain validators remain authoritative for action, approach, Risk Bid,
station occupancy, and order legality. The Event Manager never writes a
JournalEntry directly.

Each accepted command appends one canonical `voyage.m12-*` runtime event, one
M12 Task 2 audit, one processed-request record, and advances the M11 revision.
`plan-lock` first captures the sole `before-plan-lock` checkpoint at the
pre-lock session revision, then transitions the session to `plan-locked` with
encounter phase `lock-readiness`. Launch and ordinary planning changes create
no checkpoint.

The planning read adapter is GM-only, read-only, and returns isolated authored
actions, selections, Risk Bids, assignments, and persisted order. It is not a
second planning store and does not expose raw M11 authority, audit, receipt,
or recovery evidence.
