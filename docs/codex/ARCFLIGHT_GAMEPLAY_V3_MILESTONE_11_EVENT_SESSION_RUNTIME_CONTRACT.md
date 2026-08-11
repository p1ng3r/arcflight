# Arcflight Gameplay V3 Milestone 11 — Recoverable Event Session Runtime

**Status:** Contract lock for Milestone 11. This document authorizes no
production code, tests, socket registration, UI, PF2e orchestration, or
persistence implementation by itself.

**Authority:** The canonical Event Runner rules and milestone map remain the
gameplay authorities. Accepted M7, M8, M9, and M10 contracts retain ownership
of their schemas and calculations. This contract fixes the previously open
Event Session runtime boundary only.

## 1. Purpose and scope

Milestone 11 owns the recoverable, GM-authoritative runtime around one Voyage
Event Session:

1. command and request envelopes;
2. authenticated transport and active-GM authority;
3. unique request IDs, stale revision rejection, and duplicate replay;
4. durable Event Session persistence and reload recovery;
5. checkpoints before the canonical runtime boundaries;
6. role-filtered GM, operator, crew, and observer projections;
7. disconnection control transfer without station reassignment; and
8. audited GM correction, abort, and recovery commands.

M11 is an orchestration and persistence boundary. It delegates gameplay
calculations to the existing pure-domain APIs and delegates approved ship
mutation to the four M10 Foundry APIs. It never treats a client projection,
M10 ledger, or caller-supplied candidate as authoritative.

## 2. Explicit exclusions

M11 does not own:

- M6–M10 arithmetic, schemas, proposal generation, or event builders;
- the M10 ship Actor subtree `flags.arcflight.system.voyage`;
- M10 closeout ledger state or M10 idempotency markers;
- PF2e Actor `system` data, embedded Items, or component installation;
- generic consequence execution, scripts, callbacks, or macros;
- PF2e statistic lookup, check construction, rolls, or roll-result
  orchestration;
- player-facing windows, chat, sheets, media, or UI interaction;
- a travel route, voyage clock, supplies, ports, or combat runtime; or
- a second persistent gameplay authority on the ship Actor.

M12 owns UI, player interaction, PF2e roll orchestration, and the first
complete vertical slice. M11 may carry normalized domain command payloads
produced by those later adapters, but does not perform their work.

## 3. Durable storage authority

### 3.1 Session document

Each Event Session is stored in exactly one ordinary Foundry `JournalEntry`.
M11 creates and owns that document; it does not introduce a custom Foundry
document subtype. The authoritative data path is:

```text
JournalEntry.flags.arcflight.system.voyageSession
```

The JournalEntry ID is a storage identity, not gameplay authority. It is stored
as `sessionDocumentId` and must equal the resolved document's own `id`.

The resolver searches `game.journal` and requires exactly one JournalEntry with
an own, enumerable, plain-data
`flags.arcflight.system.voyageSession.sessionId` equal to the requested
`sessionId`. Zero matches produce `m11-session-document-not-found`; multiple
matches produce `m11-ambiguous-session-document`. A caller never supplies a
JournalEntry, document ID, or flag projection as authority.

### 3.2 Write ownership

Session creation uses this exact Foundry ownership policy:

```js
{
  default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
  ...Object.fromEntries(
    game.users
      .filter((user) => user.isGM)
      .map((user) => [user.id, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER])
  )
}
```

No non-GM user ID may appear in `ownership`, and the default permission is
always `NONE`. Foundry GM users retain their normal GM document access; players
have no ordinary JournalEntry permission to inspect this document or its flags.
The client transport must not expose the JournalEntry, its raw flags, or a
document UUID to players. Players receive only M11-filtered projections through
the authenticated transport boundary.

After creation, M11 updates only the exact path
`flags.arcflight.system.voyageSession`. It does not rewrite JournalEntry name,
pages, ownership, folder, or unrelated flags. It preserves every other field
on the JournalEntry byte-for-byte. Session creation may set the exact path,
the ownership policy above, and the neutral document name `Arcflight Voyage
Session`; the name is never read as gameplay evidence. GM-only fields,
processed responses, authority data, and private station data must never be
exposed through ordinary JournalEntry permissions.

M10 remains the sole writer of
`flags.arcflight.system.voyage` on the resolved ship Actor. M11 never writes
that path directly and never stores a competing ship-state projection.

Only the authenticated client that Foundry currently identifies as the unique
active GM may issue a mutating JournalEntry update. Other clients may submit
validated player/operator commands through the active-GM transport boundary,
but they never write the Event Session document.

## 4. Exact durable Event Session schema

All objects and arrays are captured plain data with own enumerable properties,
canonical insertion order, dense arrays, no accessors, unsafe keys, cycles, or
non-plain values. The top-level keys are exactly ordered as follows:

```js
{
  schemaVersion,
  sessionDocumentId,
  sessionId,
  eventId,
  definitionSnapshotId,
  shipId,
  revision,
  sessionState,
  activeGmUserId,
  authorityEpoch,
  encounterState,
  events,
  checkpoints,
  processedRequests,
  closeout,
  recovery,
  auditHistory
}
```

Values and bindings:

- `schemaVersion` is `1`.
- `sessionDocumentId`, `sessionId`, `eventId`, `definitionSnapshotId`, and
  `shipId` are nonblank exact strings.
- `revision` is the nonnegative safe-integer M11 Event Session revision. It
  increases once for every accepted state mutation other than an authority-only
  control transfer, including an accepted closeout review and forward recovery,
  and never decreases or is reused. `encounterState.revision` remains the canonical domain encounter
  revision. It increases only as required by its owning pure-domain API and
  may differ from the M11 session revision after an M11-only runtime event.
  M10 bindings always name the domain value explicitly as
  `expectedEncounterRevision`; transport `expectedRevision` always means the
  M11 session revision.
- `sessionState` is one of the canonical Event Session states:
  `setup`, `round-introduction`, `crew-planning`, `plan-locked`,
  `station-resolution`, `round-closeout`, `next-round`,
  `event-closeout-review`, `persistent-application`, `completed`, `paused`,
  `emergency-response`, `aborted`, or `recovery-required`.
- `activeGmUserId` is a nonblank authenticated GM ID while the session is
  mutable and `null` while paused without an available GM or while recovery is
  required.
- `authorityEpoch` is a nonnegative safe integer. It increases exactly once
  for each accepted GM control transfer and never decreases.

`encounterState` is the complete current Voyage Encounter state using the
existing domain schema and exact key order from `createDraftVoyageEncounterDefaults`:

```js
{
  schemaVersion,
  encounterId,
  definitionId,
  definitionRef,
  title,
  description,
  lifecycleState,
  revision,
  momentum,
  currentStage,
  roundNumber,
  phase,
  primaryShip,
  currentSituation,
  objective,
  participants,
  availableStations,
  stationAssignments,
  playerVisibleInformation,
  gmSecretInformation,
  successConditions,
  failureConditions,
  permanentConsequences,
  temporaryConsequences,
  tracks,
  pressureSystems,
  thresholdHistory,
  pendingThresholdQueue,
  selections,
  proposedStationOrder,
  committedStationOrder,
  targets,
  riskBids,
  assistance,
  reservations,
  pendingChecks,
  activeHazards,
  pendingConsequences,
  processedRequestIds,
  snapshots,
  recovery,
  metadata
}
```

The following bindings are mandatory: `encounterState.encounterId === eventId`,
its primary ship identity equals `shipId`, and its canonical `lifecycleState`
and phase satisfy the explicit mapping in Section 4.1. The separate session
and encounter revisions must each have valid monotonic continuity under their
own event authority. Its complete collections are validated by the existing
domain validators. M11 does not silently fill missing temporary state.

### 4.1 Runtime-to-domain lifecycle mapping

M11 state names are runtime vocabulary; they are not aliases for the domain
vocabulary. The following table is exhaustive. A stored pair outside the
listed domain lifecycle/phase values is `m11-invalid-session-document` at
`flags.arcflight.system.voyageSession`, with the standard failure envelope and
zero writes. A command that is not listed for the current row returns
`m11-command-not-allowed` at `request.commandKind`, with zero writes.

| M11 `sessionState` | Permitted domain `lifecycleState` | Permitted `phase` | Commands permitted | Recovery/correction | M10/terminal operations |
| --- | --- | --- | --- | --- | --- |
| `setup` | `draft`, `configuration`, `ready` | `null` | none; reads only | `abort` and GM correction of setup data | no closeout; terminal reads only |
| `round-introduction` | `active` | `situation` | `pause`; the internal `applyVoyageEncounterCrewPlanningTransition` is the only advance | correction only | no closeout |
| `crew-planning` | `active` | `crew-planning` | `station-selection`, `station-selection-clear`, `station-order`, `plan-lock`, `pause` | correction only | no closeout |
| `plan-locked` | `active` | `lock-readiness` | `action-segment`, `reaction`, `pause` | correction only | no closeout |
| `station-resolution` | `active` | `resolution` | `action-segment`, `reaction`, `round-closeout`, `pause` | correction only | no closeout |
| `round-closeout` | `active` | `consequences` | `emergency-response`, `round-closeout`, `pause` | correction only | no closeout unless the canonical round result enters review |
| `next-round` | `active` | `cleanup-advance`, `situation` | `pause`; the canonical transition to `round-introduction` and then Crew Planning is internal to the domain operation | correction only | no closeout |
| `event-closeout-review` | `active` | `cleanup-advance` | `closeout-review`, `pause` | `recover`, `correct`, `abort` | a confirmed accepted review atomically records its M10 application-plan evidence, appends the exact M11 review-acceptance event/audit record, and advances to `persistent-application`; no reservation or commit |
| `persistent-application` | `active` | `cleanup-advance` | `closeout-prepare`, `closeout-reserve`, `closeout-ship-apply`, `closeout-session-commit`, `pause` | `recover`, `correct` before ship mutation; no correction after commit | requires the persisted accepted application-plan evidence; M10 reservation/continuation/checkpoint/finalization only |
| `completed` | `completed-success`, `completed-failure` | `null` | reads only | recovery inspection only | terminal reads; no M10 mutation |
| `paused` | `paused` | `null` or the last verified operational phase | `resume` only for the current authority | `recover`, `correct`, `abort` | no M10 mutation while paused |
| `emergency-response` | `active` | `consequences` | `emergency-response`, `reaction`, `pause` | correction only | M9 result regeneration; no M10 commit until returned to review/application |
| `aborted` | `abandoned`, `discarded` | `null` | reads only | recovery inspection only | no M10 mutation |
| `recovery-required` | `recovery` | `null` or the last verified phase | reads only | `recover`, including `recoveryAction: "abort"` | no M10 mutation |

The `pause` command stores the prior operational M11 state and phase in the
durable recovery data, sets the domain lifecycle to `paused`, and preserves
the last valid domain phase; `resume` restores that
exact captured pair after fresh authority and revision checks. The
`emergency-response` and `recovery-required` rows are not implicit aliases for
any other row.

Allowed transitions are exactly:

```text
setup → round-introduction | paused | aborted
round-introduction → crew-planning | paused | aborted
crew-planning → plan-locked | paused | aborted
plan-locked → station-resolution | paused | aborted
station-resolution → round-closeout | emergency-response | paused | aborted
round-closeout → next-round | event-closeout-review | emergency-response | paused | aborted
next-round → round-introduction | paused | aborted
event-closeout-review → persistent-application | paused | recovery-required | aborted
persistent-application → completed | recovery-required | paused
emergency-response → station-resolution | round-closeout | event-closeout-review | paused | recovery-required
paused → the exact prior operational state | recovery-required | aborted
recovery-required → forward-rebuilt latest valid state | paused | aborted
completed → no gameplay state
aborted → no gameplay state
```

Every delegated gameplay transition appends only the canonical domain event(s)
and advances the domain encounter revision exactly as that domain contract
requires. M11 runtime transitions append only the exact M11 runtime event
defined by this contract and advance the M11 session revision once without
changing the domain encounter revision. `pause`, `resume`, and control transfer
append their required audit record; control transfer changes neither revision
nor the domain event history. Illegal transitions are write-free and never
produce a partial candidate.

`events` is a dense append-only array of canonical domain events and the exact
M11 runtime events defined below. Each domain event retains the exact key order
and schema owned by its domain contract; M11 adds no wrapper fields and does
not relabel M6, M7, M8, M9, or M10 events. M11 runtime event kinds are
registered by their owning slices. Task 4 rejects the closeout event until its
owning slice supplies complete canonical evidence; Task 6 is that owning slice.
Task 6 registers `voyage.m11-closeout-review-accepted` with the same
fail-closed audit pairing and accepted closeout-evidence validation. The
Task 4-supported M11 runtime event kind is `voyage.m11-recovery-rebuilt`; it
has this exact ordered shape:

```js
{
  type,
  sessionId,
  eventId,
  definitionSnapshotId,
  shipId,
  sourceCheckpointId,
  sourceCheckpointRevision,
  recoveryAuthorityUserId,
  previousRevision,
  revision
}
```

For `voyage.m11-recovery-rebuilt`, `sourceCheckpointId`,
`sourceCheckpointRevision`, and `recoveryAuthorityUserId` identify the recovered
checkpoint and the authenticated GM who performed recovery. `previousRevision` and `revision` are
the M11 session revisions, and `revision === previousRevision + 1`.

The later closeout-owning slice, not Task 4, validates that every
`voyage.m11-closeout-review-accepted` event is accompanied by exactly one
`auditHistory` record with `kind: "closeout-review-accepted"` and this exact
ordered `details` object:

```js
{
  applicationId,
  closeoutId,
  previousSessionState,
  nextSessionState
}
```

Its top-level audit `previousRevision` and `revision` bind to the same M11
runtime-event revision pair. The accepted application-plan evidence remains in
`closeout`; it is not copied into the runtime event or audit record.

`checkpoints` is a dense array of exact records:

```js
{
  checkpointId,
  kind,
  sessionId,
  revision,
  encounterRevision,
  eventCount,
  sessionState,
  encounterState,
  closeout,
  authorityEpoch,
  invalidated
}
```

`kind` is one of `before-plan-lock`, `before-action-segment`,
`before-reaction`, `before-round-closeout`, `before-emergency-response`,
`before-persistent-application`, or `after-recovery`. `checkpointId` is
`arcflight-voyage-checkpoint:${JSON.stringify([sessionId, kind, revision])}`.
`encounterRevision === encounterState.revision`; `eventCount` equals
`events.length` at capture. `sessionState`, `encounterState`, and `closeout`
are complete isolated captures of the recoverable runtime state. This dense
append-only array is the checkpoint journal. Checkpoints are immutable except
for the boolean `invalidated`, which is changed only by an audited recovery
command.

`processedRequests` is an append-only dense array of exact records:

```js
{
  requestId,
  principalUserId,
  projectionKind,
  fingerprint,
  commandKind,
  resultKind,
  resultRevision,
  response
}
```

`principalUserId` is the authenticated transport user ID captured by M11, and
`projectionKind` is exactly one of `gm`, `operator`, `crew`, `observer`, or
`none`. `none` is used only when the command has no role-filtered projection.
`fingerprint` is the canonical captured JSON tuple
`JSON.stringify([sessionId, principalUserId, projectionKind, authorityEpoch, expectedRevision, commandKind, payload])`.
The stored response is the exact isolated response envelope for that principal
and projection role. For the non-dispatch creation API only, `commandKind` is
the record-only value `"create-session"`, `resultKind` is `"created"`,
`resultRevision` is `0`, `projectionKind` is `"gm"`, and the fingerprint is
exactly:

```js
JSON.stringify([
  sessionId,
  principalUserId,
  "gm",
  0,
  0,
  "create-session",
  { eventId, definitionSnapshotId, shipId, eventDefinition, initialEncounterState }
])
```

`"create-session"` is never accepted as a dispatch `commandKind`. Its stored
response is the exact isolated successful creation envelope, and exact replay
requires the same authenticated active GM, derived `gm` role, and complete
fingerprint. The milestone-wide schema eventually permits historical records
from every owning command producer, but Task 2 accepts exactly one canonical
creation record because no gameplay command-result producer exists yet. Task 3
adds exactly one record-only transfer mapping below; every later slice must add
that command's exact stored-record, result, response, projection, and event
validator simultaneously. Earlier slices never guess or partially validate
future records. Processed request records are never removed by reset, reload,
recovery, abort, or control transfer.

`closeout` is exactly:

```js
{
  status,
  applicationId,
  closeoutId,
  acceptedApplicationPlan,
  reservationId,
  expectedEncounterRevision,
  expectedShipRevision,
  sessionReservationReceipt,
  sessionCommitReceipt
}
```

`status` is one of `none`, `review-required`, `accepted-for-application`,
`prepared-awaiting-session`, `ship-applied-awaiting-session`, `commit-pending`,
`committed`, or `reconciliation-required`. `acceptedApplicationPlan` is `null`
until a confirmed M10 review is accepted; thereafter it is this exact
M11-owned, isolated application-plan evidence object:

```js
{
  previewRequest,
  reviewRequest,
  applicationPlan
}
```

`previewRequest` and `reviewRequest` are the exact M10 review input that M11
captured and constructed from the authenticated principal; `applicationPlan`
is the exact plan returned by that successful read-only review. M11 passes only
this stored evidence to M10 preparation; it never accepts a replacement plan or
input slice from a caller. On acceptance, `applicationId`, `closeoutId`,
`expectedEncounterRevision`, and `expectedShipRevision` are copied exactly from
the validated plan. The receipt fields remain `null` until their named M10
phase creates them. `sessionReservationReceipt` and
`sessionCommitReceipt` are the exact M11-produced Event Session
reservation/commit receipts consumed and validated by M10; M11 does not add
fields or rewrite their accepted schemas.

`recovery` is exactly:

```js
{
  status,
  reasonCode,
  failedRequestId,
  failedRevision,
  checkpointId,
  sourceCheckpointRevision,
  recoveryAuthorityUserId
}
```

`status` is `none`, `required`, or `resolved`; the remaining fields are `null`
when `status` is `none` and otherwise bind to the captured failure/checkpoint
and authenticated recovery authority. Recovery never guesses a candidate state
or overwrites a historical record.

`auditHistory` is an append-only dense array of exact records:

```js
{
  auditId,
  kind,
  sessionId,
  requestId,
  actorUserId,
  authorityEpoch,
  previousRevision,
  revision,
  occurredAt,
  details
}
```

`auditId` is
`arcflight-voyage-audit:${JSON.stringify([sessionId, auditHistory.length, kind])}`.
`occurredAt` is a server-generated ISO-8601 UTC string and is never accepted
from a request or used in identity, revision, or idempotency calculations.
GM correction, abort, recovery, and control-transfer records are mandatory.

## 5. Session lifecycle and revision rules

The canonical lifecycle is:

```text
setup
→ round-introduction
→ crew-planning
→ plan-locked
→ station-resolution
→ round-closeout
→ next-round
→ event-closeout-review
→ persistent-application
→ completed
```

Exceptional states are `paused`, `emergency-response`, `aborted`, and
`recovery-required`. Only the existing domain transition APIs may establish a
domain lifecycle/phase transition. The exact M11 runtime-event rules in
Sections 4, 7, and 11.1 establish M11-only session-state transitions without
changing a domain lifecycle/phase pair.

Every accepted command validates the current M11 `revision`, constructs one
complete next session, and appends its resulting events in source order.
Delegated domain commands advance `encounterState.revision` exactly according
to their event contracts; M11-only closeout acceptance and recovery advance
only the M11 session revision. Neither revision may skip, reuse, or decrement.
Read-only projections, exact duplicate replays, and authority-epoch changes do
not change either revision.

For an atomic multi-event operation, all events and the final state are written
as one document update. M10 closeout event/revision cardinality remains exactly
the M10 contract: Hazard consequence events, immediately following M6 Breach
events where applicable, Scar/application events on the ship revision, the
optional non-Scar batch, and one final closeout event. M11 preserves that event
array exactly when committing the session. The M11 review-acceptance and
recovery runtime events are outside that M10 subsequence and do not alter its
M10 event or encounter-revision cardinality.

## 6. Transport, authentication, and active-GM authority

The sole socket channel is:

```text
module.arcflight
```

Transport messages use the exact root key order:

```js
{
  kind,
  requestId,
  sessionId,
  expectedRevision,
  authorityEpoch,
  commandKind,
  payload
}
```

`kind` is `voyage.m11-command`. `requestId` and `sessionId` are nonblank
strings; `expectedRevision` and `authorityEpoch` are nonnegative safe
integers; `commandKind` is a closed string enum; and `payload` is the exact
captured request body for the delegated domain command. The sender's user ID,
GM status, connection identity, and active-GM status are transport metadata,
not request fields and cannot be supplied by the caller.

The server resolves the authenticated sender from the socket connection and
reads Foundry's current `game.users.activeGM`. A command mutating session state
is accepted only when:

1. the sender is authenticated and still connected;
2. the active GM exists and is unique;
3. the active GM is a GM user;
4. the session's `activeGmUserId` equals that active GM's `id`; and
5. the supplied `authorityEpoch` equals the stored epoch.

Creation and dispatch use the same hostile-safe trusted-user resolution
boundary. In the injected server/test metadata representation, every trusted
user has exact boolean `isGM` and `active` evidence; the authenticated
principal and current active-GM record must each be unique, connected, and
readable. Creation additionally requires those two identities to be the same
GM; dispatch permits a connected non-GM principal while retaining the stored/
current active-GM binding.

### 6.1 Cross-client control-transfer coordinator

Task 3 does not expose an uncoordinated control-transfer mutator. The concrete
Foundry transport/runtime slice owns a trusted cross-client coordinator and
injects it into the M11 runtime context. The exact dependency is:

```js
runExclusiveSessionMutation(authorityDescriptor, callback)
```

The injected context must carry `trustedTransportContext: true`, a nonblank
`authenticatedConnectionId`, and the callable coordinator above. These are
trusted server/transport metadata, never request fields. The coordinator
descriptor is a frozen plain object with this exact key order:

```js
{
  sessionId,
  sessionDocumentId,
  expectedRevision,
  expectedAuthorityEpoch,
  authenticatedUserId,
  connectionId,
  activeGmUserId
}
```

Every value is captured and bound to the current authenticated principal,
trusted connection, unique active GM, exact JournalEntry identity, and the
request's expected revision/epoch. A missing, malformed, untrusted, or
non-exclusive coordinator fails closed with
`m11-cross-client-coordinator-required` at `transport.coordinator`, with zero
session writes. The caller cannot supply or influence the coordinator,
descriptor, lease, connection identity, or callback through a request.

The coordinator owns the cross-browser mutation lease. Exactly one connection
may own a session/epoch lease; contenders from another connection, including a
second client logged in as the same user, do not enter the persistence
callback and receive `m11-control-transfer-required` at `authorityEpoch`.
The coordinator invokes the supplied callback at most once and must return
either `null` before callback entry for a rejected contender, or the exact
isolated result returned by that callback. A non-null result without callback
entry, a second callback invocation, a callback-result mismatch, or `null`
after callback entry is invalid coordinator behavior and fails closed with
`m11-cross-client-coordinator-required` at `transport.coordinator`.

The coordinator supplies the callback a frozen, hostile-safe transport witness
with exact key order:

```js
{
  connectionId,
  occurredAt
}
```

`connectionId` must equal the descriptor connection and `occurredAt` must be a
server/transport-generated canonical ISO-8601 UTC timestamp. Task 3 never uses
a client-clock fallback. M11 captures and isolates the callback result before
it leaves the boundary and never accepts a coordinator-supplied fabricated
response. The coordinator releases its lease on success, rejection, exception,
update failure, and post-write verification failure. Task 3 only defines and
validates this boundary; the later transport slice supplies the concrete
server-side implementation. A module-local per-session mutex remains
defense-in-depth inside the callback and is never treated as cross-client
serialization.

Before coordinator acquisition, M11 resolves and completely validates the
exact session document, constructs the canonical transfer fingerprint, and
checks `processedRequests`. An exact replay returns its isolated stored
response with zero writes and does not require or invoke the coordinator; a
changed request ID returns `m11-request-id-conflict` with zero writes. A new
request alone proceeds to coordinator acquisition; stale epoch handling is
deferred until the exclusive callback so an in-flight valid write can win.

Inside the exclusive callback M11 acquires that local mutex, freshly resolves
and validates the JournalEntry, rereads trusted user/connection/active-GM
metadata, verifies that the winning descriptor still matches, rechecks replay,
revision, epoch, owner, and target identity, uses only the coordinator's
transport witness timestamp, performs one update, and rereads the complete
result. A changed connection or authority fails before update; an uncertain
result returns `m11-recovery-required` without a speculative second update.

### 6.2 Bootstrap authority after GM loss

There is one and only one exception to condition 4: the bootstrap form of
`transferVoyageEventSessionControl` or `recoverVoyageEventSession` may be
accepted when the stored `activeGmUserId` is unavailable (disconnected or no
longer a GM), no longer Foundry's current active GM, or is the exact null-owner
sentinel of a valid bootstrap fixture. Task 3 does not produce paused or
recovery-required sessions; it accepts the null sentinel only at this transfer
boundary, never treats an empty string as null, and never broadens the rule
into Task 4 recovery. The exception is valid only when all of the following
are true:

1. the transport principal is authenticated, connected, a GM, and exactly
   Foundry's unique current `game.users.activeGM`;
2. for transfer, `targetUserId` is present, names a connected active GM, and
   exactly equals that current active GM's `id`;
3. for recovery, the executing principal becomes the session's active GM and
   no caller-supplied target or next state is accepted;
4. `expectedRevision` equals the latest reread session revision;
5. `authorityEpoch` equals the latest reread stored epoch; and
6. the JournalEntry is reread and the active-GM/identity/revision checks are
   repeated immediately before the one update.

For Task 3, the null-owner fixture is limited to an otherwise complete
creation-only `setup` session at authority epoch zero, with the null value used
only as the unavailable prior owner for this transfer boundary. A pre-transfer
null fixture is not a reload or ordinary-dispatch success; after the verified
bootstrap update, the resulting nonblank owner and bootstrap audit are part of
the canonical reloadable transfer history.

The bootstrap update sets `activeGmUserId` to the current active GM, increments
`authorityEpoch` by exactly one, leaves both revisions, station
assignments, encounter state, and domain events unchanged, and appends exactly
one audit record. The audit `details` object is ordered
`{ previousActiveGmUserId, nextActiveGmUserId, bootstrap, reason }`, where
`bootstrap` is literal `true`; the audit kind is
`control-transfer-bootstrap` for transfer and `recovery-control-transfer`
for recovery. The update is verified by a complete reread. Stale revision or
epoch returns `m11-stale-session-revision` or
`m11-control-transfer-required`; unavailable active GM returns
`m11-active-gm-unavailable`; an unauthenticated/non-GM/non-current principal or
wrong transfer target returns `m11-active-gm-required` or
`m11-control-transfer-target-invalid` at `request.targetUserId`, respectively.
All failures are write-free. No other command may use this exception.

While bootstrap is required, every ordinary mutating command fails with
`m11-control-transfer-required` at `authorityEpoch` before domain validation;
it cannot use the stale stored owner as authority and cannot write gameplay
state.

Player/operator commands may originate from an authenticated non-GM, but the
active GM remains the authoritative session owner. Station permissions are
derived from stored assignments and never from a caller's claimed role.
Task 2 uses the trusted server-side boundary
`resolveVoyageOperatorForPrincipal(principalUserId)`. It is transport/server
evidence, never request data, and returns either `null` or one hostile-safely
captured canonical operator identity using the existing station-assignment
schema: `kind` is required and is `actor` or `crewAsset`; at least one of the
nonblank identities `id` or `uuid` is required; `id`, `uuid`, and `name` are
otherwise optional, and `name` is never authority. M11 reuses the canonical
station-assignment analysis boundary, binds by `kind + uuid` when a UUID is
available or by `kind + id` otherwise, and accepts `operator` only when exactly
one durable assignment matches. Differing display names do not affect binding;
malformed, ambiguous, unsafe, or unmatched resolver data never grants
operator authority. The resolver does not change the durable station-
assignment schema and Task 2 does not implement projection contents.
For every command response and projection read, M11 resolves `projectionKind`
from the authenticated connected principal and the stored station assignments;
the caller never supplies or overrides it. Any authenticated connected GM is
`gm`. For a non-GM, a trusted resolver result is captured and canonicalized by
the existing station-assignment rules. Exactly one matching durable assignment
is `operator`; a canonical resolver identity with zero matching assignments is
`crew`; absent, malformed, ambiguous, throwing, inherited, accessor-backed,
hostile, or otherwise unresolvable resolver data is `observer`. The resolver
never changes the durable station-assignment schema, and a role is never
elevated from caller-authored identity or assignment data.

If no active GM exists, mutating commands pause and return
`m11-active-gm-unavailable`; no gameplay write occurs. A new active GM may
resume only through the bootstrap transfer/recovery rule above. Only the
current active-GM client performs mutating JournalEntry writes.

For every ordinary command, after exact session resolution and before request
replay, stale checks, domain validation, or response return, M11 requires the
stored `activeGmUserId` to equal Foundry's unique current active GM ID and
requires the authenticated sender to remain connected. A mismatch returns
`m11-control-transfer-required` at `authorityEpoch` with zero writes and cannot
replay an old ordinary-command response. Task 2 does not transfer control or
perform bootstrap recovery.

Every ordinary transfer uses the same final pre-write binding as bootstrap:
the executing user is an authenticated connected GM and the unique current
`game.users.activeGM`; the target is a connected active GM whose ID exactly equals
that current active GM's ID; and the latest reread still binds the expected
session revision and authority epoch. A target that is not that GM, is not a
GM, disconnects, or ceases to be active fails with
`m11-control-transfer-target-invalid`; a changed epoch fails with
`m11-control-transfer-required`; and a changed session revision fails with
`m11-stale-session-revision`. All failures are write-free. No arbitrary
authenticated player may become `activeGmUserId`.

Control transfer increments `authorityEpoch`, changes only
`activeGmUserId`, appends an audit record, and does not change station
assignment, either revision, or domain events. In-flight commands from the old
epoch fail with `m11-control-transfer-required`. The new GM must use a new
request ID and, for M10 continuation/finalization, a new exact M11-produced
Event Session receipt.

## 7. Exact public M11 APIs

The contract authorizes these APIs only:

### `createVoyageEventSession(request)`

Exact request keys:

```js
{
  kind,
  requestId,
  sessionId,
  eventId,
  definitionSnapshotId,
  shipId,
  eventDefinition,
  initialEncounterState
}
```

Creation first captures the request and performs only root-shape and exact-mode
discrimination. It then resolves the trusted authenticated transport principal
and Foundry's unique current active GM before inspecting any semantic request
field, resolving an Event Definition, building an encounter, scanning session
documents, generating an ID, or preparing a write. Creation requires that the
authenticated principal is the connected current active GM. In the injected
server/test metadata boundary, `user.active === true` is the exact connected-
user evidence; missing, inherited, accessor, non-boolean, duplicated, or
ambiguous trusted-user metadata fails closed.

The authenticated active GM is transport evidence. `eventDefinition` and
`initialEncounterState` are captured proposals and are regenerated/validated
through existing domain boundaries. A duplicate request replays the stored
creation response; a conflicting request ID or existing session identity fails
closed.

Creation is not a dispatch command. On first successful creation M11 appends
exactly one processed-request record using the record-only `commandKind`
`"create-session"`, `resultKind: "created"`, `resultRevision: 0`,
`projectionKind: "gm"`, principal equal to the authenticated active GM, and
the exact zero/zero fingerprint mapping defined in Section 4. Exact creation
replay returns that isolated successful response without a write. Reuse with
changed request data, principal, role, or fingerprint returns
`m11-request-id-conflict`; an existing session with a different request ID
remains the existing-session identity/write conflict.

The authoritative creation source is an immutable server-side Event Definition
snapshot resolver keyed by `(eventId, definitionSnapshotId)`. The resolver is
not the request body, a JournalEntry, a client projection, or an M10 ledger.
M11 captures the request's `eventDefinition` only as a candidate and requires
structural/key-order equality with the resolved snapshot; if no immutable
snapshot resolves, creation fails with `m11-command-payload-invalid` at
`request.eventDefinition`. The resolver also supplies the canonical starting
identity and lifecycle constraints. M11 constructs the initial encounter from
that snapshot and the resolved `shipId`, `sessionId`, and `eventId`; the caller
cannot supply a derived revision, event list, checkpoint, processed-request
list, closeout, recovery, audit history, or alternate lifecycle. The only valid
starting revision is `0`, with the `setup`/`draft`/`null` mapping in Section
4.1.

### `dispatchVoyageEventSessionCommand(request)`

Accepts the exact transport envelope in Section 6. Supported `commandKind`
values are:

```text
pause
resume
station-selection
station-selection-clear
station-order
plan-lock
action-segment
reaction
round-closeout
emergency-response
closeout-review
closeout-prepare
closeout-reserve
closeout-ship-apply
closeout-session-commit
```

Each payload is the exact existing domain request for that operation, with
`kind`, session identity, revision, authority, analysis, next-state, event,
receipt, and runtime fields removed. M11 rejects caller-authored calculated
results and delegates regeneration to the named pure API. M11 does not add a
second gameplay schema for those payloads.

The following command delegation table is normative. The listed domain
request order is the complete order passed to the named API; fields not listed
in the caller column are loaded from the latest captured session or regenerated
by M11 and are prohibited in the transport payload. Every row performs the
common precedence in Section 8, validates the resulting candidate/events, and
returns the standard success/failure envelope; any domain failure is returned
unchanged at its canonical path with zero writes.

| M11 command | Canonical API and exact domain request order | Caller-captured fields | Loaded from session | Regenerated/forbidden caller fields | Success effect |
| --- | --- | --- | --- | --- | --- |
| `pause` | `applyContextPreservingVoyageLifecycleTransition(encounterState, "paused")` | none | complete encounter state | next state/events/revision | canonical paused lifecycle transition and one revision/event |
| `resume` | `applyContextPreservingVoyageLifecycleTransition(encounterState, "active")` | none | complete paused encounter and saved phase | next state/events/revision | restores the captured operational pair and one revision/event |
| `station-selection` | `applyVoyageEncounterStationActionSelection(encounterState, selectionRequest)`; `selectionRequest` is `{ stationId, actionId }` | `stationId`, `actionId` | available stations, assignments, current revision | all selection state, event, and revision fields | one station-selection event and one revision |
| `station-selection-clear` | `applyVoyageEncounterStationActionSelectionClear(encounterState, clearRequest)`; `{ stationId }` | `stationId` | existing selection and assignments | prior selection, next state, event, revision | one clear event and one revision |
| `station-order` | `applyVoyageEncounterStationOrderProposal`, its change variant, or its clear variant; proposal/change request is `{ stationOrder }`, clear request is `{}` | operation plus `stationOrder` when required | current/proposed order and assignments | canonical proposal, next state, event, revision | canonical order event and revision |
| `plan-lock` | `applyVoyageEncounterCrewPlanningLock(encounterState, lockRequest)`; `{ phaseStartSnapshotId }` | `phaseStartSnapshotId` | selections, risk bids, order, current revision | readiness, snapshot contents, next state, events, revision | canonical lock transition and checkpoint boundary |
| `action-segment` | `applyVoyageEncounterPendingCheckResult(encounterState, executionResult)`; `{ executionResult }` | normalized authoritative execution result only | pending check and station context | rolls, PF2e data, outcome interpretation, next state, events, revision | canonical action result events/revision |
| `reaction` | no accepted pure apply API exists at this contract lock | normalized reaction proposal is rejected until an approved API exists | current reaction window | all calculated reaction effects/results | `m11-command-not-allowed` at `request.commandKind`, zero writes |
| `round-closeout` | `applyVoyageEncounterConsequencesTransition(encounterState, transitionRequest)`; `{ phaseStartSnapshotId }` | `phaseStartSnapshotId` | resolution completion and current state | consequence result, next state, events, revision | canonical Consequences transition and checkpoint boundary |
| `emergency-response` | `analyzeVoyageEmergencyResponseResult(request)`; exact order `{ kind, sessionId, breakdownDefinition, breakdownPlan, completedRoundHistory }` | only those five M9 input fields | current breakdown, history, definitions, revisions | outcome, next state, events, receipts | canonical M9 result; no caller-authored outcome |
| `closeout-review` | `analyzeVoyageEncounterCloseoutReview(request)`; `{ kind, sessionId, gmUserId, confirmed, previewRequest, suppliedPreview }` | `confirmed`, `previewRequest`, `suppliedPreview` | completed history, session identity, and authenticated current GM identity | `kind`, `sessionId`, `gmUserId`, preview, review result, proposals, plans, events | M11 constructs the exact M10 request from authenticated evidence; M10 remains read-only. Only a successful confirmed review with one valid application plan atomically stores the exact bound `previewRequest`, constructed `reviewRequest`, and application plan evidence as `closeout.acceptedApplicationPlan`, copies the exact plan identities/revisions, changes `closeout.status` to `accepted-for-application`, advances to `persistent-application`, increments the M11 session revision, captures the `before-persistent-application` checkpoint, appends `voyage.m11-closeout-review-accepted`, and appends its audit record. Every failed, blocked, unconfirmed, stale, or invalid review performs no M11 write. |
| `closeout-prepare` | `persistVoyageEncounterApprovedCloseout(request)`; `{ kind, previewRequest, reviewRequest, applicationPlan }` | none | latest accepted review evidence, ship identity, and M10 inputs captured by the accepted review | application plan, application candidate, ledger entry, ship state, events | M11 reconstructs this exact M10 preparation request only from the persisted accepted review evidence; M10 prepares its ledger state |
| `closeout-reserve` | M11 reconstructs the reservation receipt, then calls `continueVoyageEncounterCloseoutReservation(request)`; `{ kind, applicationId, receipt }` | no receipt or source fields | latest session evidence, prepared ledger, ship state | receipt sources, ship candidate, ledger writes | M10 ship-applied-awaiting-session state |
| `closeout-ship-apply` | `verifyVoyageEncounterCloseoutShipCheckpoint(request)`; `{ kind, applicationId, reservationId }` | no derived fields | latest ship and ledger identity | checkpoint result | read-only checkpoint; no JournalEntry gameplay write |
| `closeout-session-commit` | M11 writes and verifies the session closeout, then calls `finalizeVoyageEncounterCloseoutReceipt(request)`; `{ kind, applicationId, receipt }` | no commit receipt fields | latest session, reservation receipt, M10 ledger | commit receipt, completed snapshot, events, final revisions | one committed session result and M10 ledger finalization |

For `createVoyageEventSession`, the domain request is the canonical creation
request produced by the immutable snapshot resolver; for every closeout row,
M10 remains the owner of its exact request, ledger, and ship schemas. M11
alone produces the exact Event Session reservation/commit receipts that M10
consumes and validates. M11 never accepts a caller-supplied result, candidate,
event, revision, receipt, or projection in any row.

The internal `round-introduction`/`next-round` advance is not a public command:
M11 invokes `applyVoyageEncounterCrewPlanningTransition` with the exact domain
request `{ phaseStartSnapshotId }`, where
`phaseStartSnapshotId` is
`arcflight-voyage-phase-start:${JSON.stringify([sessionId, encounterState.revision + 1, "crew-planning"])}`.
A caller cannot trigger that internal edge or supply its snapshot contents;
failure is the canonical domain failure with zero writes.

### `readVoyageEventSessionProjection(request)`

Exact request keys:

```js
{
  kind,
  requestId,
  sessionId,
  expectedRevision
}
```

`kind` is `voyage.m11-read-projection`. M11 derives `projectionKind` only from
the authenticated principal's GM status and durable station assignment; no
caller may select, elevate, or override it. This API never writes, never
requires GM confirmation, and returns the latest regenerated projection only
after validating the complete session.

### `transferVoyageEventSessionControl(request)`

Exact request keys:

```js
{
  kind,
  requestId,
  sessionId,
  expectedRevision,
  authorityEpoch,
  targetUserId,
  reason
}
```

`kind` is `voyage.m11-transfer-control`. `requestId`, `sessionId`,
`targetUserId`, and `reason` are nonblank strings; the two numeric fields are
nonnegative safe integers. The caller cannot supply the previous GM, next
state/epoch, bootstrap flag, audit ID, actor identity, timestamp, processed
result, response, or candidate session. Transfer is not a dispatch
`commandKind`; its record-only processed-request mapping is exactly
`commandKind: "control-transfer"`, `resultKind: "control-transferred"`,
`projectionKind: "gm"`, unchanged `resultRevision`, and fingerprint:

```js
JSON.stringify([sessionId, principalUserId, "gm", suppliedAuthorityEpoch,
  expectedRevision, "control-transfer", { targetUserId, reason }])
```

An exact replay returns the stored isolated response with zero writes even when
its epoch is historical. Any changed request identity, principal, role, target,
reason, epoch, or revision is `m11-request-id-conflict`; a new request with an
old epoch is `m11-control-transfer-required`.

After hostile-safe capture, exact mode/shape validation, and trusted connected
active-GM authentication, M11 performs the exact JournalEntry resolution,
complete Task 3 session validation, canonical fingerprint construction, and
`processedRequests` replay/conflict check before coordinator entry. Exact
replay and request-ID conflict therefore remain write-free and coordinator-free,
including after later authority-epoch advances. Only a request ID with no
stored match enters the coordinator; its stale epoch is decided by the
coordinator callback's fresh final reread rather than by a pre-entry stale
return. The callback repeats replay/conflict checking for queued identical
requests that arrive before the winner persists.

At the final pre-write reread, the executing principal is authenticated,
connected, a GM, and exactly Foundry's unique current
`game.users.activeGM.id`; the target is also connected, a GM, and exactly that
same current active-GM ID. An ordinary reauthorization has the same stored and
current GM and records `bootstrap: false`; bootstrap adopts a valid nonblank
stale, unavailable, disconnected, no-longer-GM, or different stored GM and
records `bootstrap: true`. A changed winning connection fails with
`m11-active-gm-required` at `transport.connection` before the update. Task 3
does not fabricate a null owner; its only null use is the exact setup fixture
described in Section 6.2. Broader null-owner recovery remains reserved for
later valid paused or `recovery-required` sessions.

Transfer leaves both revisions, lifecycle/phase, encounter state, station
assignments, events, checkpoints, closeout, and recovery unchanged. It
increments `authorityEpoch` once, changes only `activeGmUserId`, appends one
processed record and one audit record, and verifies one atomic JournalEntry
update. Audit records use exact ordered details
`{ previousActiveGmUserId, nextActiveGmUserId, bootstrap, reason }`, the
canonical audit-ID formula from Section 4, the unchanged session revision for
both revision fields, the resulting epoch, bound session/request/actor IDs,
and a server-generated ISO-8601 UTC timestamp. Only creation and these
canonical Task 3 transfer records are accepted by the Task 3 reload validator;
all later record kinds fail closed.

The trusted cross-client coordinator above is the sole authority for entering
the control-transfer persistence callback. The module-local asynchronous
critical section keyed by exact Event Session identity is defense-in-depth
inside that callback only. `JournalEntry.update` is not a compare-and-set
operation and cannot provide cross-client serialization. The coordinator must
therefore reject a same-session contender before its callback, returning
`m11-control-transfer-required` at `authorityEpoch`; the local mutex separately
prevents same-runtime overlap, with independent locks for different sessions.
Both coordinator and local sections release on every success, failure,
exception, update failure, and verification path. A coordinator that fabricates
an envelope without callback entry, returns a different envelope, invokes the
callback twice, or returns `null` after callback entry is invalid and returns
`m11-cross-client-coordinator-required` at `transport.coordinator` without a
second persistence attempt.

### `recoverVoyageEventSession(request)`

Exact request keys:

```js
{
  kind,
  requestId,
  sessionId,
  expectedRevision,
  authorityEpoch,
  recoveryAction,
  reason
}
```

`recoveryAction` is `rebuild-latest`, `reconcile-closeout`, or `abort`; a
caller cannot select a checkpoint or supply a next state. Recovery uses the
special forward-only validator in Section 11 rather than ordinary complete
current-session validation. It resolves the latest completely valid canonical
checkpoint and replays validated append-only evidence from that checkpoint.
When bootstrap recovery is used, the executing current active GM adopts
ownership under Section 6.2 before the selected recovery action; no gameplay
state is changed by that adoption itself.

### `abortVoyageEventSession(request)`

Exact request keys:

```js
{
  kind,
  requestId,
  sessionId,
  expectedRevision,
  authorityEpoch,
  reason,
  confirmation
}
```

`confirmation` must be literal `true`. Setup cancellation and active-event
abort follow the canonical Event Runner rules. Any persistent consequence still
requires M10 preview, GM review, and M10 application; M11 cannot invent or
apply an abort consequence.

### `correctVoyageEventSession(request)`

Exact request keys:

```js
{
  kind,
  requestId,
  sessionId,
  expectedRevision,
  authorityEpoch,
  correctionKind,
  targetRequestId,
  targetCheckpointId,
  replacementPayload,
  reason,
  confirmation
}
```

This GM-only command is the sole post-lock correction boundary. It requires
literal `true` confirmation, a nonblank reason, a valid target request or
checkpoint, and canonical regeneration from the existing domain API. It
records before/after identity and never silently rewrites rolls, committed
permanent consequences, M10 ship state, or M10 ledger entries.

## 8. Response and failure envelopes

Every public M11 API returns this exact key order:

```js
{
  ok,
  requestId,
  sessionId,
  status,
  revision,
  authorityEpoch,
  projection,
  events,
  errors,
  warnings
}
```

Success uses `ok: true`, the captured request/session identities,
`status` from the session lifecycle, the resulting M11 session `revision`, the
current `authorityEpoch`, an isolated role projection when applicable, the
isolated event delta (empty for reads), `errors: []`, and `warnings: []`.

Failure uses `ok: false`, the safely captured `requestId` and `sessionId` when
available (otherwise `null`), `status: "failed"`, `revision: null`,
`authorityEpoch: null`, `projection: null`, `events: []`, a nonempty ordered
`errors` array, and `warnings: []`. No partial session, candidate, event,
receipt, or projection is returned.

Exact diagnostic shape is `{ code, path, message, severity: "error" }`.
Warnings use severity `"warning"`. Diagnostics are deduplicated by the tuple
`[code, path, message, severity]`, preserving first occurrence.

The canonical precedence for every ordinary mutating API other than
`recoverVoyageEventSession` is:

1. hostile capture;
2. exact root keys and mode;
3. transport authentication and active-GM authority;
4. minimum envelope value validation and session resolution/complete stored-session validation;
5. request-ID duplicate/conflict handling;
6. authority-epoch binding;
7. expected M11 session revision binding;
8. lifecycle/command authorization and forbidden payload-authority validation;
9. delegated pure-domain validation and regeneration;
10. checkpoint validation when required;
11. candidate/event/revision validation;
12. one atomic JournalEntry write;
13. reread and exact verification; and
14. response projection.

No later category may run after an earlier category fails. Projection reads use
this exact precedence: minimal request-root and projection-mode validation;
trusted authenticated connected-principal resolution; exact unique session
document resolution; hostile-safe capture and complete stored-session
validation; exactly one internal derivation of the trusted projection role from
that authenticated principal and the validated durable station assignments;
expected M11 session-revision binding; request-ID duplicate/conflict handling;
and regenerated isolated projection construction. Role derivation never runs
for a missing, ambiguous, malformed, or invalid session. It does run after a
valid session is resolved even when stale-revision or request-ID conflict
handling later fails. The role is never caller-supplied or exposed in the
public projection. Reads never require an active GM, an authority epoch, or
caller-selected `projectionKind`, and never write.

`recoverVoyageEventSession` uses this exact special precedence so recovery does
not require ordinary complete current-session validation:

1. hostile capture;
2. exact root keys, mode, nonblank reason, and recognized recovery action;
3. transport authentication, unique-active-GM authority, and the Section 6.2
   bootstrap rule where needed;
4. exact JournalEntry resolution and hostile-safe minimum recovery-envelope
   capture;
5. request-ID duplicate/conflict handling from safely captured processed
   records;
6. authority-epoch binding and expected M11 session-revision binding;
7. immutable identity and checkpoint-journal validation, including selection
   of the latest completely valid canonical checkpoint;
8. canonical replay/rebuild and, for the selected action, required M10
   reconciliation or canonical abort analysis;
9. rebuilt candidate, append-only evidence, M11 runtime event, audit record,
   recovery record, and forward-revision validation;
10. one atomic JournalEntry write at
    `flags.arcflight.system.voyageSession`;
11. reread and exact verification; and
12. regenerated projection and standard response.

An unavailable or invalid immutable envelope, checkpoint journal, replay
evidence, or safely captured processed-request record fails at the earliest
applicable step with `m11-unrecoverable-session`, performs zero writes, and
returns no partial recovery candidate.

## 9. Diagnostic catalog

| Code | Path | Exact message |
| --- | --- | --- |
| `m11-hostile-data-capture-failed` | `$` | M11 data could not be captured safely. |
| `m11-invalid-request-shape` | `request` | Request shape, order, or root values are invalid. |
| `m11-invalid-mode` | `request.kind` | The requested M11 API mode is invalid. |
| `m11-authentication-required` | `transport.user` | Authenticated transport user is required. |
| `m11-active-gm-unavailable` | `transport.activeGm` | No unique active GM is available. |
| `m11-active-gm-required` | `transport.activeGm` | The authenticated user is not the current active GM. |
| `m11-cross-client-coordinator-required` | `transport.coordinator` | A trusted cross-client mutation coordinator is required. |
| `m11-session-document-not-found` | `sessionId` | Exact Event Session document was not resolved. |
| `m11-ambiguous-session-document` | `sessionId` | More than one Event Session document matched. |
| `m11-invalid-session-document` | `flags.arcflight.system.voyageSession` | Stored Event Session is invalid. |
| `m11-request-id-required` | `request.requestId` | A unique request ID is required. |
| `m11-request-id-conflict` | `request.requestId` | Request ID was previously used with different data. |
| `m11-control-transfer-required` | `authorityEpoch` | Event Session control has transferred. |
| `m11-control-transfer-target-invalid` | `request.targetUserId` | Control-transfer target must be the unique current active GM. |
| `m11-stale-session-revision` | `expectedRevision` | Event Session revision is stale. |
| `m11-command-not-allowed` | `request.commandKind` | Command is not allowed in the current session state. |
| `m11-command-payload-invalid` | `request.payload` | Command payload is invalid. |
| `m11-checkpoint-required` | `checkpointId` | Required Event Session checkpoint is missing. |
| `m11-checkpoint-mismatch` | `checkpointId` | Event Session checkpoint does not match current state. |
| `m11-session-write-failed` | `flags.arcflight.system.voyageSession` | Event Session write did not complete or verify. |
| `m11-recovery-required` | `recovery` | Event Session requires explicit recovery. |
| `m11-unrecoverable-session` | `flags.arcflight.system.voyageSession` | Immutable Event Session recovery evidence is invalid. |
| `m11-closeout-review-not-confirmed` | `request.payload.confirmed` | Confirmed closeout review is required before persistent application. |
| `m11-closeout-review-not-accepted` | `closeout` | Closeout review did not produce one valid application plan. |
| `m11-abort-confirmation-required` | `confirmation` | Complete abort confirmation is required. |
| `m11-correction-confirmation-required` | `confirmation` | Complete GM correction confirmation is required. |
| `m11-correction-invalid` | `replacementPayload` | GM correction cannot be regenerated safely. |
| `m11-m10-handoff-invalid` | `m10` | M10 handoff does not match the Event Session. |
| `m11-reservation-not-ready` | `closeout` | Event Session is not ready for M10 reservation. |
| `m11-commit-not-ready` | `closeout` | Event Session is not ready for M10 commit. |
| `m11-projection-not-authorized` | `transport.user` | Authenticated user has no Event Session projection role. |

Existing M10 diagnostics are preserved exactly when M11 consumes an M10 API.
M11 never rewrites an M10 code, path, message, or severity.

## 10. Request IDs, stale commands, and duplicate handling

The server treats `[sessionId, requestId]` as the lookup key, but an exact
idempotent replay additionally requires the stored `principalUserId`, the
server-derived `projectionKind`, and the complete fingerprint to equal the
newly captured request and authenticated transport context. A request ID must
be nonblank, exact, and unique within that session. It is not proof of
authority. The authenticated transport principal, stored active GM, and
authority epoch provide authority.

For an exact request-ID replay, M11 returns the stored isolated response only
when request ID, principal, projection role, and fingerprint all match. It
performs no write, emits no new event, and changes no revision, even if the
current revision has advanced in a slice that owns that stored record. A reused request ID with any different
principal, projection role, or canonical fingerprint returns
`m11-request-id-conflict` with the standard failure envelope, no stored
response, and zero writes. A new request whose `expectedRevision` differs from
the live session revision returns `m11-stale-session-revision` with zero
writes.

Every stored fingerprint is hostile persisted data. M11 parses it inside a
guarded boundary, immediately hostile-safely recaptures the parsed value, and
requires a dense seven-element tuple whose canonical reserialization equals the
stored string. Unsafe object keys, accessors, non-plain values, sparse or
extra-key arrays, non-finite values, cycles, and reflection failures invalidate
the session. Task 2 continues to accept only its exact record-only
`create-session` record; no generic future command record is inferred.

Processed request IDs survive reload, pause, recovery, control transfer,
abort, and completion. Task 2 stores and replays only its exact creation
record; Task 3 additionally stores and replays only its exact
`control-transfer` record. Any later command record fails closed until its
owning slice registers the complete canonical validator. Later slices validate
historical principal, role, authority, revision, result, response, and
fingerprint values without rewriting them. The replay fingerprint always uses
M11's derived role, not a request field. A completed session accepts only exact
duplicate reads or recovery inspection; it never replays gameplay mutation.

## 11. Checkpoints, persistence, and recovery

M11 writes a complete candidate JournalEntry flag subtree atomically at these
boundaries:

1. before plan lock;
2. before each Action Segment;
3. before each reaction;
4. before round closeout;
5. before Emergency Response; and
6. before persistent application.

The `before-persistent-application` checkpoint is captured in the same write
as a successful closeout-review acceptance, after the accepted M10 application
plan, M11 runtime event, audit record, session-state transition, and new M11
session revision have been constructed. The checkpoint and every other command
result are written together when a command changes state. A successful forward
recovery appends an `after-recovery` checkpoint in the same write as its M11
recovery event and audit record.

M11 rereads the JournalEntry after every write and compares the complete
subtree, not a projection. If the reread equals the candidate, the write is
successful. If it equals the prior state, the command failed with no accepted
revision. Any other result returns `m11-recovery-required` and does not issue
an unverified second gameplay write. This ambiguous-write result may mark the
session recovery-required only in the runtime process; it never makes a second
unverified JournalEntry update merely to record that status.

Immediately before every JournalEntry update M11 must reread the target
document, re-resolve the authenticated principal and unique active GM, verify
the stored `authorityEpoch`, verify the expected M11 session `revision`, and
rebuild the complete candidate from that latest state. Immediately before each
M10 continuation or finalization call, M11 must perform the corresponding
M10-required active-GM, ship identity, ship revision, ledger, and receipt
checks; M11 may not rely on an earlier projection. Loss of authority or any
revision drift produces zero writes.

On reload, M11 resolves exactly one document, validates the full schema,
identity, event list, revision chain, checkpoints, processed requests,
closeout record, and audit history before publishing any projection. Invalid
or contradictory data enters `recovery-required` in memory and blocks ordinary
mutation; it is not silently normalized. It may then be considered only by the
special forward-only recovery validator below.

### 11.1 Forward-only recovery validator and rebuild

Recovery never restores, rolls back to, or numerically reuses a prior state or
revision. The JournalEntry flag is captured hostile-safely, but recovery does
not require the complete current Session to pass ordinary validation. Its
minimum immutable recovery envelope has these exact ordered keys:

```js
{
  schemaVersion,
  sessionDocumentId,
  sessionId,
  eventId,
  definitionSnapshotId,
  shipId,
  revision,
  authorityEpoch,
  events,
  checkpoints,
  processedRequests,
  auditHistory
}
```

The resolver identifies exactly one JournalEntry by the requested `sessionId`,
then requires the envelope's `sessionDocumentId` to equal that document's ID;
all identity fields to be nonblank exact strings; `schemaVersion` to be `1`;
and `revision` and `authorityEpoch` to be nonnegative safe integers. The
minimum envelope must also contain dense, own-property, safe-captured event,
checkpoint, and audit journals plus safely captured processed-request records.
It rejects
hostile values, extra/inherited/unsafe keys, accessors, sparse arrays, cycles,
or mismatched checkpoint identities. A recovery request never supplies a
JournalEntry ID, an identity, a checkpoint ID, a replay event, a candidate
state, a receipt, or an authority role.

M11 validates every checkpoint record independently, including its exact key
order, immutable session identity, captured session/encounter revision pair,
event count, session state, encounter state, closeout state, authority epoch,
and invalidation flag. It considers checkpoints in descending checkpoint
session revision and selects the latest record for which all of the following
are true:

1. the checkpoint itself is completely valid and is not invalidated;
2. its `eventCount` is a valid prefix boundary in the dense stored event
   journal;
3. every retained event from that boundary forward is a complete, identity- and
   revision-continuous canonical domain event or exact M11 runtime event; and
4. deterministic canonical replay from the checkpoint's captured runtime
   state succeeds and produces the recovered state required by the selected
   recovery action.

Task 4 supplies the hostile-safe checkpoint capture/validation and
forward-recovery substrate only. The command-owning later slices wire each
listed checkpoint boundary through this substrate together with their
canonical domain API. M6-M10 event validators/replay, `reconcile-closeout`,
and audited `abort` analysis remain owned by those later slices; until an
owning replay dependency is injected, Task 4 rejects those records/actions
without a generic substitute. In this Task 4 slice, persisted recovery
records are valid only for `recoveryAction: "rebuild-latest"`; persisted
`abort` or `reconcile-closeout` recovery records are invalid session evidence
until their owning slices register the complete canonical implementation.

The complete event journal is one chronological revision chain. M11 validates
each M11 runtime event against the immediately preceding event revision. For
each contiguous owning-domain segment, the trusted dependency receives only
that segment and must return the exact ordered metadata
`{ startIndex, endIndex, previousRevision, nextRevision, sessionState,
encounterState, closeout }`. The indexes, predecessor, and successor revision
must bind exactly to the segment boundaries; the dependency may not consume an
M11 event, skip, reorder, or overlap a segment. Missing, malformed, or
inconsistent segment metadata fails closed as `m11-unrecoverable-session`
during recovery and as invalid stored evidence during reload.

The event and checkpoint journals are preserved byte-for-byte as historical
evidence. Replay regenerates state only through the owning pure-domain APIs,
the exact M11 runtime-event rules in Section 4, and M10's read-only
reconciliation APIs where applicable. It never trusts the malformed current
projection, caller-supplied result, stored M10 ledger event, or a caller
candidate. Replay must validate all processed request/principal/derived-role
bindings before it may return any duplicate response.

For `rebuild-latest`, M11 rebuilds the latest valid recoverable state through
Task 4-supported evidence or an explicitly injected trusted owning replay
dependency. `reconcile-closeout` remains deferred to the M10 orchestration
slice and `abort` remains deferred to the audited abort slice; Task 4 returns
the existing `m11-command-not-allowed` diagnostic at
`request.recoveryAction` for those actions until their owning slice is
present.
No recovery action rerolls, duplicates Pressure or Hazards, reapplies a Scar,
downgrades a committed M10 ledger, removes a processed request, invalidates a
historical event, or overwrites an earlier checkpoint.

The recovered candidate retains every prior event, checkpoint, processed
request, M11-produced Event Session receipt, and audit record unchanged. It
receives exactly one new M11 session revision, which is greater than every
safely validated M11 session revision in the envelope, checkpoint journal,
processed-request results, and M11 runtime-event journal. It appends
exactly one `voyage.m11-recovery-rebuilt` event and an audit record with
`kind: "recovery-rebuilt"`.

Historical processed-request result revisions, audit authority epochs, and
runtime-event revisions remain bound to the values established by their own
fingerprints, events, and checkpoint boundaries. Reload never rebinds an old
record to the current revision or authority epoch; runtime-event revisions are
unique and their `previousRevision` values form a strict chronological chain.

That audit record's `details` object has exact order:

```js
{
  recoveryAction,
  sourceCheckpointId,
  sourceCheckpointRevision,
  recoveryAuthorityUserId,
  replayedEventCount,
  failedRequestId,
  failedRevision
}
```

`failedRequestId` and `failedRevision` are copied only from the captured
pre-recovery failure state. The resolved `recovery` object, recovery event,
audit, and after-recovery checkpoint must agree with that immutable failure
evidence; caller-supplied replacements are invalid.

The recovery event and audit record must contain the selected source checkpoint
revision and the authenticated recovery GM. The candidate sets `recovery` to
`resolved` with the same source checkpoint and recovery authority, regenerates
the canonical replay result through the pure M11 path or an explicitly
injected trusted owning replay dependency, captures an `after-recovery`
checkpoint whose encounter and closeout state equal that regenerated result,
and performs one atomic update of only
`flags.arcflight.system.voyageSession`. It then rereads and completely compares
the flag subtree before returning the standard success envelope with the one
new recovery event, plus any canonical event required by its selected abort
action, as its event delta.

If the immutable envelope, checkpoint journal, processed-request records, or
all replayable checkpoint/evidence chains cannot be safely validated, recovery
fails closed with `m11-unrecoverable-session` and zero writes. It does not
overwrite current data with a guessed checkpoint, reset a revision, or create
a replacement history.

## 12. Role-filtered projections

All projections are isolated captured data and use this exact root key order:

```js
{
  schemaVersion,
  sessionId,
  eventId,
  revision,
  sessionState,
  currentStage,
  roundNumber,
  phase,
  stationAssignments,
  committedStationOrder,
  currentActingStationId,
  momentum,
  pressureSystems,
  activeHazards,
  visibleEvents,
  closeoutStatus,
  recoveryStatus
}
```

The GM projection additionally contains `gmSecretInformation`, complete
hidden outcomes, unrevealed thresholds, and the full audit history. The
operator projection additionally contains only that operator's private Focus,
selection, and reaction data. Crew and observer projections contain public
mechanical state only. Hidden data is omitted, not sent and hidden by UI.

Projection construction never mutates the stored session or increments a
revision. Task 5 derives the trusted role before constructing the common
projection, even when the currently authorized common field set is identical
for multiple non-GM roles. Task 5 returns only the common root above: no public request contains
`projectionKind`, and no role-specific extension fields are fabricated here.
`currentActingStationId` is `null` and `visibleEvents` is `[]` until their
owning slices register canonical sources and filtering rules. Later producer-
owned slices may add exact GM, operator, crew, or observer details only when
their contracts define those fields. A projection request cannot return
`encounterState` directly, and projections are regenerated only for the
authenticated principal. Players can neither read the raw JournalEntry nor
receive GM secrets, processed responses, authority data, private station data,
or another principal's projection through ordinary JournalEntry permissions or
the transport API. Projection reads never append a processed-request record;
reuse of a stored mutation request ID is `m11-request-id-conflict` and never
returns that mutation response.

When a command response is stored in `processedRequests`, its projection is
bound to that record's authenticated `principalUserId` and `projectionKind`.
M11 never returns that stored projection to another principal or role; such a
replay is the exact `m11-request-id-conflict` failure described in Section 10.

## 13. Control transfer and disconnect behavior

An operator remains assigned to its station when its user disconnects. The
active GM may resolve that operator's command, temporarily grant another
authenticated user control of the same operator, or wait. No command changes
the stored station assignment except the canonical pre-lock assignment
operation.

When the active GM disconnects, M11 rejects mutating commands, preserves the
latest persisted state, and emits no speculative projection. Foundry's newly
elected active GM may issue `transferVoyageEventSessionControl` or
`recoverVoyageEventSession` only through the Section 6.2 bootstrap exception;
that command increments `authorityEpoch` and records the transfer without
changing either revision. A recovery action then uses the forward-only rebuild
in Section 11.1. Old authority epochs cannot mutate or replay a new command,
and only the newly elected active-GM client may perform the JournalEntry write.

## 14. M10 reservation and commit handoff

M11-produced Event Session reservation/commit receipts consumed and validated
by M10 are M11-owned. M11 does not change M10's accepted receipt schemas,
ledger, or `pressureBreachSources`.

### 14.1 Reservation receipt

The exact ordered receipt is:

```js
{
  kind,
  reservationId,
  activeGmUserId,
  applicationId,
  closeoutId,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  expectedEncounterRevision,
  pressureBreachSources
}
```

`kind` is `voyage.m11-closeout-session-reserved` and
`reservationId` is
`arcflight-closeout-reservation:${JSON.stringify([applicationId])}`.
M11 independently reads the authoritative session immediately before
reservation and again immediately before the M10 ship mutation. It requires
the session identity and encounter revision to equal the prepared M10 ledger.

`pressureBreachSources` is exactly `[]` when there are no recorded M6 Breach
events. Otherwise it is dense, zero-based, and ordered by the recorded
`voyage.pressure-breach-applied` subsequence. Each entry has this exact order:

```js
{
  breachEventIndex,
  sourceHazardId,
  expectedEncounterRevision,
  closeoutContext: {
    eventId,
    sessionId,
    stageId,
    roundNumber,
    phase
  },
  pressureSystems,
  activeHazards,
  pressureEffect
}
```

Sources are reconstructed from authoritative Event Session state immediately
before reservation and before ship mutation. M11 never derives them from a
stored M10 ledger, `previousHazard`, or caller-authored data.

### 14.2 M10 continuation and checkpoint

After M10 consumes the exact M11-produced Event Session reservation receipt and writes the ship, M11
calls `verifyVoyageEncounterCloseoutShipCheckpoint` with:

```js
{
  kind,
  applicationId,
  reservationId
}
```

M11 must not write the Event Session or issue a commit receipt unless this
read-only M10 checkpoint succeeds. A failed checkpoint aborts the session
write and returns the M10 failure unchanged.

### 14.3 Commit receipt

M11 constructs and validates this exact Event Session commit receipt from the
trusted M10 evidence resolver, but it persists the receipt only after the
reserved Event Session evidence has been reread and the read-only M10 ship
checkpoint has succeeded. The receipt is then durable in the recoverable
`commit-pending` write for M10 to consume and validate:

```js
{
  kind,
  reservationId,
  activeGmUserId,
  applicationId,
  closeoutId,
  eventId,
  sessionId,
  definitionSnapshotId,
  shipId,
  previousEncounterRevision,
  encounterRevision,
  completedCloseoutSnapshot,
  encounterEvents,
  pressureBreachSources
}
```

`kind` is `voyage.m11-closeout-session-committed`. `encounterEvents` is the
exact canonical subsequence of Hazard closeout events, M6 Breach events, and
the one final closeout event, in recorded order. The commit source array must
be canonical-key-order-sensitive equal to the reservation source array and
must independently match fresh M10/M6 regeneration. Missing, malformed,
reordered, duplicated, or forged sources produce the existing M10 receipt
diagnostic and perform no write.

M11 calls `finalizeVoyageEncounterCloseoutReceipt` only after those checks.
M10 then writes only its ledger status/receipt. M11 never changes a committed
M10 ledger back to a nonterminal state.

The Foundry adapter exposes one trusted, server-side M10 evidence resolver for
the commit boundary because the existing public checkpoint API intentionally
returns no completed snapshot or event ledger. Its exact request is:

```js
{
  kind: "m10-resolve-closeout-commit-evidence",
  applicationId,
  reservationId,
  sessionId,
  eventId,
  definitionSnapshotId,
  shipId,
  expectedEncounterRevision
}
```

The resolver is `resolveVoyageEncounterCloseoutCommitEvidence(request)` and is
trusted runtime context only; no public command may supply or override it. It
returns the exact ordered envelope `{ ok, applicationId, closeoutId, eventId,
sessionId, definitionSnapshotId, shipId, previousEncounterRevision,
encounterRevision, completedCloseoutSnapshot, encounterEvents,
pressureBreachSources, errors, warnings }`. The adapter must capture and
validate the complete M10 snapshot, canonical event subsequence, source array,
identities, and revisions before returning success. M11 recaptures that result,
requires exact key order and equality to the stored reservation/session
evidence, and fails closed without a JournalEntry write on any missing,
malformed, hostile, stale, or throwing resolver result.

After M10 finalization succeeds, M11 uses the trusted adapter
`buildVoyageEventSessionCompletedEncounterState(request)` to construct the
canonical completed encounter state. Its exact request key order is
`{ kind, sessionId, eventId, definitionSnapshotId, shipId,
priorEncounterState, completedCloseoutSnapshot }`; `kind` is
`m10-build-completed-encounter-state`. The adapter is trusted runtime context
only, is never caller-supplied, and must return one captured complete encounter
state with the existing M11 encounter schema, identities, and completed
revision/lifecycle bindings. Missing, malformed, hostile, throwing, or
mismatched output is `m11-m10-handoff-invalid` with no JournalEntry write.

Commit finalization is a recoverable handoff. M11 first persists one
`commit-pending` Event Session state with the exact commit receipt, runtime
event, audit, and processed-request record, then calls M10 finalization. The
session is not marked `completed`/`committed` until M10 returns a verified
`committed` or `already-committed` result and M11 rereads the pending evidence.
An M10 failure, throw, or uncertain result leaves the validated nonterminal
`commit-pending` state intact; it performs no speculative second write and can
be retried with a fresh request against that durable receipt. Exact replay of
the original pending request returns its isolated pending response without a
write. A successful retry finalizes M10 idempotently and performs the one
terminal Event Session update without appending duplicate receipt evidence.

## 15. Event ordering and identity bindings

The session event array is append-only and chronological. Domain event order is
the order returned by the canonical pure API; M11 never sorts by timestamp or
client arrival time. Every event's identity and revision fields must bind to
the session's `eventId`, `sessionId`, `definitionSnapshotId`, and `shipId`
according to its owning contract. Domain event revisions bind to
`encounterState.revision`; M11 runtime event revisions bind to the M11 session
`revision`.

Task 6 lifecycle authorization is exact and is reread inside the exclusive
mutation callback: `closeout-review` requires `event-closeout-review` with
`review-required`; `closeout-prepare` requires `persistent-application` with
`accepted-for-application`; `closeout-reserve` requires
`prepared-awaiting-session`; `closeout-ship-apply` requires
`ship-applied-awaiting-session`; and `closeout-session-commit` requires either
`ship-applied-awaiting-session` or the recoverable `commit-pending` state.
Prepare is a record-only M11 idempotency step and appends no runtime event or
audit; its stored response and accepted evidence are nevertheless validated on
reload and exact replay. All other mutating closeout steps append their exact
runtime event/audit pair in the same M11 write.

A successful `closeout-review` is ordered as: the read-only M10 review result,
then exactly one persisted `voyage.m11-closeout-review-accepted` event and its
audit record, then the `before-persistent-application` checkpoint in the same
atomic Session write. It is the sole event that crosses from
`event-closeout-review` to `persistent-application`. A forward recovery
preserves all existing evidence, then appends exactly one
`voyage.m11-recovery-rebuilt` event, its audit record, and its `after-recovery`
checkpoint in one atomic Session write. Neither M11 runtime event is a member
of the M10 closeout subsequence.

The M10 closeout subsequence is exactly:

```text
hazard-closeout-consequence-applied
→ optional pressure-breach-applied
→ next hazard
→ ...
→ optional closeout-void-scar-created / void-scar-created events
→ optional closeout-persistent-state-applied
→ exactly one closeout-applied
```

M11 preserves source order and never duplicates M6/M7 events. Event identity,
source proposal, Hazard, Pressure effect, Scar, reset, encounter revision, and
ship revision bindings remain M6–M10 authority.

## 16. Audited correction and abort

Corrections are GM-only, explicit, revisioned commands. A correction must name
its target request/checkpoint, provide a nonblank reason and literal `true`
confirmation, and pass through the canonical domain analyzer/application for
the affected operation. It appends an audit record containing the authenticated
GM, authority epoch, before/after revisions, target ID, and server timestamp.
It cannot alter a committed closeout, remove a processed request ID, rewrite a
receipt, or mutate M10 ship state directly.

Setup cancellation is an audited transition with no persistent consequences.
Active-event abort stops later station commands, retains all prior events,
applies only the authored abort path after GM review, and uses M10 for any
persistent closeout consequence. Abort never silently rolls back committed
ship data.

## 17. Security and isolation rules

Every public M11 boundary captures before validation and rejects getters,
setters, revoked/reflection-failing Proxies, symbols, functions, BigInts,
undefined, nonfinite numbers, Date, Map, Set, class instances, sparse arrays,
extra keys, inherited fields, unsafe keys, cycles, and hostile Foundry
documents. Acyclic shared references are accepted but captured separately.

M11 never trusts caller-authored identity, authority, revision, candidate,
event, receipt, projection, or recovery state. The authenticated transport
principal, resolved JournalEntry, Foundry active-GM state, canonical domain
regeneration, and M11-produced Event Session receipts consumed and validated by
M10 are the only authorities.

For command payloads, the exact forbidden authority-key boundary includes
`principalUserId`, `authenticatedUserId`, `gmUserId`, `isGM`, `role`,
`projectionKind`, `fingerprint`, `result`, `resultKind`, `resultRevision`,
`candidate`, `event`, `response`, `receipt`, `nextState`, `revision`,
`authorityEpoch`, `authority`, `analysis`, and `outcome`, including nested
occurrences. Legitimate domain fields are not rejected merely because they
contain generic words outside this closed list.

Every failure performs zero session writes, zero Actor writes, emits no socket
state mutation, returns no partial state/events/projection, and leaves M10
ledger and ship state unchanged. An exact duplicate replay is write-free and
returns the stored isolated response only for the same authenticated principal
and projection role; cross-principal or cross-role reuse returns the exact
request-ID-conflict failure without the stored response.

## 18. Focused test matrix

The M11 implementation must cover:

- exact JournalEntry resolution, duplicate-document rejection, exact flag path,
  GM-only ownership creation policy (`default: NONE`, OWNER entries only for
  GM users), player denial of raw JournalEntry/flag access, preservation of
  name/pages/ownership/unrelated flags, and no Actor writes;
- complete session schema/key-order validation, every lifecycle and phase,
  explicit M11-to-domain lifecycle mapping, allowed transitions, identity
  bindings, dense arrays, event/revision continuity, checkpoint
  identity, processed-request identity, closeout state, recovery state, and
  audit history;
- invalid roots, hostile values, accessors, inherited fields, revoked
  Proxies, cycles, shared references, unsafe keys, sparse arrays, and mutation
  of inputs/outputs;
- every command envelope, nested key order, unsupported command, payload
  authority rejection, stale revision, wrong authority epoch, and exact
  failure sentinels;
- authentication failure, no active GM, non-GM GM-only command, active-GM
  election, Task 3 bootstrap transfer with stale stored GM, and later-slice
  bootstrap recovery with its valid null-owner state,
  old-epoch rejection, disconnected/non-GM/non-active control-transfer target,
  final-reread authority/revision drift, and station preservation;
- unique request success, exact creation replay with zero writes, the exact
  record-only `create-session` creation mapping, changed-data/principal/role
  conflict, exact creation-record tamper rejection, and zero-write reload;
- Task 3 control-transfer request order and record-only mapping, ordinary and
  bootstrap audit pairing, dense authority-epoch continuity, historical replay
  before and after transfer without coordinator entry, same-request concurrent
  replay, trusted cross-client coordinator descriptors and frozen transport
  witnesses, same-user different-connection contention, callback provenance
  failures (fabricated/mismatched/double invocation), missing/rejected
  coordinator zero-write failures, final active-GM/connection reread, one-write
  verification, server-generated audit timestamps, and exact
  write-failure/recovery classification;
- trusted operator-resolution witnesses for canonical `kind + id` and
  `kind + uuid` assignments, optional names, differing display names, wrong
  kind/identity, ambiguous or malformed resolver data, and caller-authored
  user fields that never grant operator role;
- authentication before semantic payload validation, connected-principal
  rejection, stored/current active-GM mismatch before replay or stale checks,
  and zero-write authority failures;
- checkpoints before plan lock, Action Segment, reaction, round closeout,
  Emergency Response, persistent application, and after forward recovery;
- failed writes, failed rereads, unchanged-before, exact-after, ambiguous
  state, recovery-required classification, and no unverified second write;
- GM/operator/crew/observer projection field filtering, server-derived role,
  hidden-data omission, raw-JournalEntry denial, projection isolation,
  cross-principal/cross-role replay conflict, and no client mutation authority;
- confirmed closeout-review acceptance transition, exact persisted application
  plan, M11 review-acceptance event/audit/checkpoint, unconfirmed/blocked/
  invalid review zero-write behavior, and persistent-application preparation
  from stored evidence only;
- pause, resume, reload, missing-reference recovery, corrupt-current-state
  forward recovery, invalid immutable-envelope/checkpoint-journal failure,
  latest-valid-checkpoint selection, canonical replay, new forward recovery
  revision/event/audit/checkpoint, append-only historical evidence, abort,
  audited correction, and committed-consequence preservation;
- exact M11-produced Event Session reservation and commit receipt key order and
  identity as consumed and validated by M10;
- `pressureBreachSources: []` for non-collision closeout;
- valid collision source entries and every source mutation: index, Hazard,
  expected revision, context identity/stage/round/phase, Pressure systems,
  active Hazards, Pressure effect, arithmetic, policy, and consequence;
- missing, extra, reordered, duplicated, cyclic, accessor-backed, shared, or
  forged M10 sources with the exact M10 diagnostics and zero writes;
- M10 checkpoint failure before Event Session mutation;
- every command-to-domain delegation mapping, exact nested request key order,
  caller-authority rejection, immutable event-definition snapshot resolution,
  and unsupported reaction-command handling;
- commit-source equality against the reservation receipt, recorded events,
  and fresh canonical M10/M6 regeneration;
- no M11 UI, chat, Item creation, roll, random, or time access outside
  server-generated audit timestamps; and
- deterministic repeated requests, caller immutability, returned-value
  isolation, PF2e/sibling-data preservation through M10, and terminal
  committed-state behavior.

## 19. Manual Foundry validation checklist

In a Foundry v14 PF2e world:

1. Create one valid Event Session and verify exactly one JournalEntry owns
   `flags.arcflight.system.voyageSession`, with the exact key order, no
   unrelated document changes, `ownership.default` set to Foundry `NONE`, and
   OWNER entries only for GM users. From a player client, verify the raw
   JournalEntry, UUID, pages, and flags cannot be read; verify the same player
   receives only its authenticated M11 projection.
2. Confirm the session's Actor, Event Definition, ship, session, and revision
   identities bind exactly; inspect a reload and verify the same document is
   recovered.
3. Exercise planning, Action Segment, reaction, round closeout, Emergency
   Response, and persistent-application checkpoints; interrupt each boundary
   and recover without duplicate, reused, or decremented session/event
   revisions. Verify the recovered Session retains all prior events and
   checkpoints, appends one forward recovery event/audit/checkpoint, and does
   not overwrite history.
4. Disconnect the active GM, verify mutation pauses, transfer control through
   the bootstrap rule only after the target is the connected unique current
   active GM, and verify a player, inactive GM, or disconnected target fails
   write-free. Verify `authorityEpoch` changes exactly once while both
   revisions, domain events, and station assignments remain unchanged.
5. Replay an exact request and reuse its ID with changed payload; verify
   write-free replay, then repeat it from another principal/role and verify
   exact request-ID conflict with no private projection returned.
6. Complete a confirmed M10 closeout review and verify it remains read-only
   until M11 atomically stores the exact application plan, appends the M11
   acceptance event/audit/checkpoint, advances to `persistent-application`,
   and increments only the M11 session revision. Verify unconfirmed, blocked,
   stale, and invalid reviews perform no M11 write. Then run M10 preparation
   with a non-collision closeout and verify the exact M11-produced Event
   Session reservation/commit receipts consumed by M10 contain
   `pressureBreachSources: []`.
7. Run a collision closeout and verify every source entry is independently
   captured from Event Session evidence, ordered densely, and accepted by M10.
8. Mutate or omit each source field, receipt event, identity, or revision;
   verify the exact M10 receipt diagnostic and zero Actor/JournalEntry writes.
9. Verify M10 changes only `flags.arcflight.system.voyage`; PF2e Actor
   `system`, embedded Items, installed component data, and sibling Arcflight
   flags remain byte-identical.
10. Force a failed JournalEntry write/reread and verify no unverified second
    gameplay write and in-memory recovery-required status. Corrupt only the
    current recoverable projection, then verify forward recovery selects the
    latest valid checkpoint, canonically replays valid evidence, writes one new
    revision/event/audit/checkpoint, and preserves historical records. Corrupt
    the immutable envelope or checkpoint journal and verify the exact
    `m11-unrecoverable-session` failure with zero writes.
11. Exercise GM correction and setup/active abort; verify audit records,
    monotonic revisions, no silent rollback, and no persistent consequence
    without M10 approval/application.
12. Verify player/operator/crew/observer projections omit GM secrets, callers
    cannot supply `projectionKind`, replay fingerprints use the derived role,
    and no client can mutate or read the stored session through direct client
    data or ordinary JournalEntry permissions.
13. Verify no UI, chat, Item creation, PF2e roll, or unrelated Actor write is
   produced by the runtime boundary.
14. Verify each command dispatches only to its mapped canonical domain API,
   rejects caller-derived fields, and rejects the reserved reaction command
   until an approved pure reaction API exists.

## 20. Implementation sequence and stop conditions

M11 implementation must proceed in narrow reviewed slices:

1. session document creation, capture, validation, and reload;
2. authenticated command envelope and request idempotency, including only the
   record-only `create-session` producer/validator and the trusted
   principal-to-operator resolver; future command records remain rejected until
   their owning slices add complete validators;
3. active-GM authority and control transfer;
4. checkpoint persistence and recovery;
5. role-filtered projections;
6. M10 reservation/continuation/checkpoint/commit orchestration; and
7. audited correction and abort.

No slice may add M12 UI, PF2e roll orchestration, Item creation, a second M10
ledger, or a competing ship persistence path. No implementation may begin
until independent review confirms that this contract fixes the storage document,
exact schemas, command envelopes, diagnostics, precedence, and M11-produced
Event Session receipt ownership without weakening prior contracts.

This contract changes no M10 file and does not authorize any production or test
implementation by itself.
