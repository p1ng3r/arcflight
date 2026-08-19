# Arcflight Gameplay V3 — M12 Multiplayer Slice G

## Player Station Execution

Slice G allows the authenticated operator of the canonical current station to
invoke the existing Task 3 station-resolution path. It adds no player roll
engine, result store, cursor, or socket protocol.

### Authority and request boundary

The public `voyage.m12-resolve-station` intent contains only its existing
request identity, session, expected revision, and authority epoch. The runtime
derives the authenticated principal from trusted transport metadata and the
operator from canonical durable station assignments. A player may execute only
when the session is in `station-resolution`/`resolution`, the canonical current
station has a pending unresolved check, that station is assigned to the
authenticated operator, the revision and authority epoch are current, and no
required reaction/Focus window is open. Caller-supplied station, operator,
actor, statistic, action, approach, bid, DC, result, degree, or authority data
is not accepted.

The current active GM retains the existing execution authority. Control
transfer and temporary GM control continue to use the accepted M11 authority
model; disconnecting an operator does not reassign the station.

An execution replay requires the authenticated principal to still be connected
through the trusted transport boundary and requires the complete canonical
action-segment fingerprint, including the caller's captured expected revision
and authority epoch, to match the stored processed request. A changed
fingerprint or disconnected replay is rejected without returning the stored
response. Those caller-supplied revision and epoch values are immutable
optimistic-concurrency evidence; a later reread never upgrades them.

### Canonical execution and exactly-once behavior

Player and GM execution use the same coordinator-protected Task 3
`action-segment` pipeline. The locked action, approach/statistic, Risk Bid,
target, selected PF2e statistic, roll options, result normalization, degree,
payoff, event, audit, revision, reread, and next-station preparation are all
owned by that existing path. The PF2e executor runs inside the exclusive
mutation callback, so a duplicate request, double click, two tabs, or player/GM
contention can produce at most one canonical PF2e execution and one station
advancement. Exact replay returns the isolated stored response without another
executor call or write; stale and foreign-station requests fail closed.

The client never supplies a roll total, die result, degree, modifier, DC,
receipt, or final outcome. A current operator cannot execute a future, foreign,
or already-resolved station. The persisted pending-check identity and canonical
station order determine the target check.

### Filtered projection and Player Event

The multiplayer projection adds only safe execution presentation: whether the
viewer may execute the current station, a bounded availability state, and
public action/approach/statistic/Risk Bid labels. It does not expose the raw
pending-check receipt, hidden DC or modifiers, Actor documents, audit history,
processed requests, fingerprints, or authority metadata. The Player Event shows
`ROLL STATION CHECK` only for the legitimate current operator; other operators,
crew, and observers see the current station and a waiting state. No Focus,
reaction, result-modification, or planning controls are added here.

### Advancement and handoff

Successful execution consumes the current pending check and reuses Task 3
advancement. The next occupied station becomes current with its canonical
pending check. After the final station, the projection reports Resolution
Complete / Awaiting Round Closeout. Slice G does not implement Focus/reaction
UI, in-resolution correction, retry/void, Momentum, Pressure, Hazard,
round-closeout, or final closeout; those belong to later slices.

Other clients may require the documented refresh/reopen because no new socket
notification protocol is introduced. Slice H owns player Focus/reaction UI.
