# Arcflight Gameplay V3 — M12 Multiplayer Slice B Player Event Shell

## Purpose

Slice B provides a small player-facing `ApplicationV2` shell for the current
Event Session. It is a read-only presentation boundary over the trusted Slice A
`readVoyageEventSessionMultiplayerProjection` API. The GM Event Manager remains
the GM application and is not replaced.

## Authority and privacy

The shell never reads a JournalEntry or raw Event Session directly. The public
`game.arcflight.readVoyageEventSessionMultiplayerProjection` boundary authenticates
the current connected user, validates the stored session, derives the trusted
GM/operator/crew/observer role, and returns only the filtered projection. The
shell does not accept role, principal, station ownership, revision, or authority
metadata from its caller. Discovery returns only a validated `{ sessionId,
revision }` pair so the shell can request the filtered projection.

All render, tab navigation, refresh, and reopen paths are zero-write. No player
command, socket protocol, Actor/Item mutation, PF2e roll, M10 orchestration,
recovery, closeout, audit, history, or GM-control behavior is part of Slice B.

## Application and tabs

`VoyagePlayerEventApp` in `scripts/voyage/apps/player-event.js` uses one
ApplicationV2 root and `templates/voyage/player-event.hbs`. It exposes exactly
four presentation tabs, in this order:

1. Round
2. My Station
3. Crew Plan
4. Resolution

Tab selection is local UI state and is not persisted as gameplay state. The app
retains the selected tab and panel scroll position across local rerenders.

## Role presentation

GM users continue to use the existing GM Event Manager. Operators receive every
owned assigned station (including multiple stations); crew users receive a
read-only shell with no owned stations; observers receive a neutral read-only
shell. An owned active station may be marked `YOUR STATION IS ACTIVE`, but no
roll or reaction control is rendered.

## Visible content

Round shows only projection-backed event/session status and authoring text that
is already available for the registered event, plus projection-backed Momentum,
revealed Pressure, and revealed Hazards when present. My Station shows trusted
owned station identities and neutral unavailable labels for fields not present
in the current projection. Crew Plan shows all occupied stations, ownership
markers, and read-only selections/order when the projection supplies them. The
current common projection intentionally supplies no private selections, raw
events, audits, receipts, encounter state, GM secrets, or accepted plans; the
shell does not reconstruct or manufacture those fields. Resolution shows
waiting, plan-locked, current-station, or completed status from projection
state only.

## Opening and handoff

`game.arcflight.openPlayerEvent()` opens the shell. Caller-selected session IDs
are not supported in Slice B, including for GM preview. The trusted runtime
discovery helper finds exactly one nonterminal validated session and returns
only its identity/revision internally. If none or more than one is available,
the shell shows an explicit unavailable state. No automatic socket pop-open
behavior is added.

The player presentation is projection-only. It does not import or consult the
authored Event Definition to fill absent narrative or mechanical fields. Any
field absent from the filtered projection remains unavailable or omitted until a
later visibility contract explicitly adds it.

## Slice C handoff

Player Action, Approach, Risk Bid, target, order, Plan Lock, resolution,
reaction, and roll commands remain deferred to Slice C and later slices.
