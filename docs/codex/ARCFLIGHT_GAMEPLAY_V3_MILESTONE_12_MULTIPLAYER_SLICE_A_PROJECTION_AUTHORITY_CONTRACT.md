# M12 Multiplayer Slice A — Projection and Authority Foundation

This narrow contract extends the accepted M11 read boundary without changing
the M11 session schema, mutation commands, or persistence rules.

## Read API

`readVoyageEventSessionMultiplayerProjection` accepts the exact ordered request
root `{ kind, requestId, sessionId, expectedRevision }`, with `kind` equal to
`voyage.m12-read-multiplayer-projection`. It authenticates the connected
principal, resolves and validates the unique Event Session, derives role and
ownership once from trusted context and durable station assignments, applies
stale-revision validation, then returns an isolated projection. Reads never
write JournalEntries or other Foundry documents.

The accepted M11 `readVoyageEventSessionProjection` remains unchanged and keeps
its exact common projection schema.

## Roles and ownership

The role vocabulary is `gm`, `operator`, `crew`, and `observer`. GM status is
derived only from trusted Foundry user metadata. A non-GM operator role is
granted only when the trusted operator resolver returns one or more canonical
operator identities that match the durable assignment records. A nonempty
valid identity set with no match is `crew`; an empty set, absent, malformed,
ambiguous, cyclic, accessor-backed, revoked, or throwing resolver evidence is
fail-closed `observer`. One principal may own multiple assigned operators; unoccupied or
unmatched stations are read-only.

The projection adds only `projectionRole`, `ownedOperators`, and
`readOnlyStationIds` to the M11 common fields. Each owned-operator entry is
plain data: station ID, canonical operator ID/UUID, `canAct`, and
`gmTakeover`. No User, Actor, Item, authority epoch, audit, processed request,
receipt, raw event, secret, or persistence internals are returned.

`authorizeVoyageEventSessionOperator` is a read-only trusted authorization
helper. It accepts `{ kind, sessionId, stationId }` with kind
`voyage.m12-authorize-operator`; the station is looked up in durable evidence,
never accepted as proof of ownership, and the result is isolated plain data.
GM authority remains separate and temporary M11 control transfer is represented
without changing station assignment or introducing a second takeover store.

## Trusted Foundry boundary

The current M12 Foundry adapter resolves only owned canonical Actor documents
through the permission API and converts them to `{ kind, id, uuid, name }`
evidence. Arbitrary Item ownership does not grant station authority in this
slice. Live documents never cross into the runtime or get persisted. Caller
user, role, station, actor, and operator fields are rejected by exact request
schemas.

## Explicit exclusions

This slice does not implement a Player Event application, multiplayer planning
mutations, sockets or broadcast UI, GM Unlock Plan, Begin Resolution changes,
roll controls, Focus popups, round closeout, Pressure/Hazard/Momentum closeout,
or any M10/M11 persistence redesign.
