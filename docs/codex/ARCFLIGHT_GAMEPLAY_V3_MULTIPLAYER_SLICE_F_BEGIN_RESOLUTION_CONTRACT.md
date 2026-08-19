# Arcflight Gameplay V3 — M12 Multiplayer Slice F

## Multiplayer Begin Resolution

Slice F exposes the existing authoritative M12 `resolution-start` transition
to the multiplayer Event Session projection. It does not add a second
resolution engine or a player command.

### Authority and eligibility

Only the authenticated, connected current active GM may submit
`voyage.m12-begin-resolution`. The request is the existing closed envelope
`{ kind, requestId, sessionId, expectedRevision, authorityEpoch }`; identity,
GM status, role, station ownership, active-GM identity, connection, revision,
and authority epoch come from trusted runtime evidence. Operators, crew,
observers, former GMs, forged callers, and stale requests are rejected before
any write.

The existing Task 3 command path remains the sole transition. It requires a
valid `plan-locked` session in active `lock-readiness`, a canonical committed
station order and locked selections, and no paused, recovery-required,
terminal, or existing resolution progress. It performs the accepted
coordinator, replay, revision, audit, reread, and write classification rules.

### Transition and order

The transition is atomic with the existing Task 3 resolution-start path:
`plan-locked` → `station-resolution`, with the encounter phase changing to
`resolution`. The committed station order is authoritative. The first
applicable occupied station is the current station; no caller or player UI
order is consulted. Existing Task 3 pending-check preparation remains the
canonical pre-execution setup, but no PF2e check is executed by Slice F.

An exact replay returns the isolated stored result without another transition,
revision, current-station reset, or write. A changed request conflicts and a
stale request fails through the existing M11 precedence. Once resolution has
begun, Plan Unlock, station selection, station-order, and other planning
mutations remain unavailable.

### Filtered multiplayer projection

`readVoyageEventSessionMultiplayerProjection` remains the only player read
boundary. After authentication, session resolution, complete validation, and
trusted role derivation, it adds isolated public resolution state: the shared
resolution order, whether resolution started, current station and display
operator, order position/count, and per-station `waiting`/`current`/`resolved`
status. GM, operator, crew, and observer clients receive the same shared
current station and order. An owned current station may be presented as
`YOUR STATION IS ACTIVE`; this is presentation only.

The projection contains no raw Event Session, pending-check receipt, hidden
DC, authored secret, audit, recovery, processed request, coordinator, or
authority data. Player Event planning controls remain read-only after Plan
Lock and no roll, Focus, or reaction control is added in this slice.

### Client refresh and handoff

No new socket authority protocol is introduced. Clients refresh by rereading
the trusted filtered projection when the application is reopened or refreshed;
the persisted JournalEntry remains the sole source of truth. A future accepted
notification transport may signal that a reread is needed, but a notification
payload must never become canonical gameplay state.

Slice G owns player station execution and roll controls. Focus/reactions,
targeted recovery, round closeout, Pressure/Hazard/Momentum closeout, and final
closeout remain deferred to their owning slices.
