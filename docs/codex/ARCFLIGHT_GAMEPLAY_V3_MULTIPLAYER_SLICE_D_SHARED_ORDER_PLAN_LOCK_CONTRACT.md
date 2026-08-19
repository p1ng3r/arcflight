# Arcflight Gameplay V3 — M12 Multiplayer Slice D

## Shared order and plan lock

Slice D extends the existing M11 `station-order` and `plan-lock` command paths. It does not introduce a second ordering store, player-specific validator, socket protocol, or lock engine.

There is one authoritative station resolution order in the Event Session. It is the canonical `proposedStationOrder` while crew planning is active and the canonical `committedStationOrder` after the existing plan-lock transition. Player projections expose that order as `sharedStationOrder`; before an order is proposed, the projection falls back to the current station-assignment order.

Only a trusted authenticated principal with a canonical durable station assignment may mutate the shared order. The request supplies only the desired `stationOrder`; role, user identity, ownership, and authority remain trusted runtime evidence. Crew and observer principals are read-only. Shared-order authority does not grant action, approach, risk-bid, or foreign-station planning authority: those commands remain limited to the caller's owned station.

Plan Lock remains GM-only in this slice, as required by the multiplayer roadmap. The existing `plan-lock` command performs all readiness, order, phase, revision, coordinator, replay, and persistence validation. Slice D does not add a player Plan Lock command or bypass the GM Event Manager.

## Projection and UI

The filtered multiplayer projection adds `sharedStationOrder`, `planReady`, `planLocked`, and `canMutateSharedOrder`. `planLocked` is derived only from the explicit canonical post-plan-lock session-state set (`plan-locked`, `station-resolution`, `round-closeout`, `next-round`, `event-closeout-review`, `persistent-application`, and `completed`). A `lock-readiness` phase or a nonempty `committedStationOrder` alone is not proof of Plan Lock; paused and recovery-required states remain distinct unless canonical state explicitly says otherwise. These fields are derived server-side and contain no raw session, audit, processed-request, recovery, or authority internals. The Player Event Crew Plan presents stations in the shared order with operator, readiness, selected planning summaries, and owned-station markers. Authorized operators receive MOVE UP/MOVE DOWN controls while planning is unlocked; all such controls disappear after Plan Lock. The Player Event consumes projected `planLocked` and does not independently infer it.

## Concurrency and lifecycle

Order edits use the existing M11 coordinator, session revision, authority epoch, replay, stale rejection, and final reread behavior. A stale order never overwrites a newer order; the player refreshes and is told to review the current order. The existing plan-lock transition remains the only lock transition. After lock, selection, clear, and order mutations are rejected and the projection is read-only. Resolution never begins automatically; Begin Resolution and all resolution execution remain later-slice behavior.

Slice E owns Unlock/Relock recovery. Slices F–I own synchronized resolution, player execution, reactions, and targeted recovery. Round closeout, Pressure/Breach, and final closeout remain outside Slice D.
