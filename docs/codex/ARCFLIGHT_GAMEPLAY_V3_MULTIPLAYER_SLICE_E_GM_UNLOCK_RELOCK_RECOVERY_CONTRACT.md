# Arcflight Gameplay V3 — M12 Multiplayer Slice E

## GM Unlock / Relock Recovery

Slice E adds one privileged, audited pre-resolution correction: an authenticated
current GM may unlock a canonically `plan-locked` Event Session only while its
session state is `plan-locked` and its encounter remains in active
`lock-readiness`. `station-resolution` and every later state are too late for
this broad planning unlock; paused, recovery-required, and terminal states are
rejected.

Unlock reuses the M11 `voyage.m11-correct-session` request and coordinator,
revision, authority, replay, reread, and append-only audit path with
`correctionKind: "plan-unlock"` and an empty replacement payload. It never
accepts caller-authored state, selections, order, identity, or authority.

The accepted request is the existing closed correction envelope: `kind`,
`requestId`, `sessionId`, `expectedRevision`, `authorityEpoch`,
`correctionKind`, `targetRequestId`, `targetCheckpointId`, `replacementPayload`,
`reason`, and `confirmation`. For this extension the values are exactly
`"voyage.m11-correct-session"`, `"plan-unlock"`, literal `null` target fields,
an own-empty replacement object, and `confirmation: true`; the authenticated
current GM, connection, active-GM identity, revision, and timestamp remain
trusted runtime/coordinator evidence. Exact replays return the stored isolated
response without a write; changed or stale requests fail through the existing
M11 conflict/stale classifications.

The mutation preserves assignments, operators, selections, approaches, Risk
Bids, Focus, event identity, and committed order. It copies the committed order
to `proposedStationOrder`, clears only the canonical committed-order field, and
returns the session to active `crew-planning` in one revisioned write. The
existing GM-only `plan-lock` command remains the sole relock path; it performs
all normal readiness and order validation and creates its normal checkpoint and
history. No resolution progress, rolls, Focus reactions, or later-round state is
rewound.

Successful unlock appends the existing `voyage.m11-session-corrected` runtime
event and `correction-applied` audit with the authenticated GM, prior/resulting
states, revisions, encounter revisions, reason, and trusted timestamp. Prior
Plan Lock events, audits, and checkpoints remain intact. Failed, stale,
unauthorized, malformed, or uncertain operations write nothing beyond the
existing conservative M11 classification. On reload, the unlock runtime event
must be immediately preceded at its `previousRevision` by the canonical
`voyage.m12-plan-lock` event; its `previousEncounterRevision` must equal that
Plan Lock event's `encounterRevision`, and its resulting encounter revision
must be exactly the one-step successor. Event/audit self-consistency alone is
not accepted.

Players receive only the normal filtered planning projection after unlock;
their owned station and shared-order authority resumes through Slices C/D.
Player Event has no unlock control, no correction/audit internals, and no Plan
Lock authority. The GM Event Manager exposes `UNLOCK PLAN` only in the valid
pre-resolution locked state and requires confirmation before submitting the
runtime request. The public projection reports the normal unlocked planning
state and preserved order/selections without exposing GM authority metadata.

Slice F owns synchronized Begin Resolution. Unlock is not a general rollback,
does not edit locked state directly, and does not implement targeted
in-resolution recovery, round closeout, Pressure/Breach, or final closeout.
