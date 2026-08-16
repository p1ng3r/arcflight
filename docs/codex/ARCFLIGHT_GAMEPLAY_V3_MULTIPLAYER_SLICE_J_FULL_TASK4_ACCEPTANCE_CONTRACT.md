# Arcflight Gameplay V3 — M12 Multiplayer Slice J

## Full Task 4 multiplayer acceptance contract

Status: acceptance/integration contract only. Slice J composes the accepted
Slice A–I boundaries; it does not add a gameplay system or alter any command,
projection, persistence, PF2e, transport, or recovery schema.

## Authority and scope

The canonical authorities are, in order:

1. `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`
2. `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`
3. `docs/gameplay-v3/reconciliation-and-continuation-roadmap.md`
4. `docs/codex/CURRENT-GAMEPLAY-V3.md`
5. `docs/codex/ARCFLIGHT_GAMEPLAY_V3_MILESTONE_12_PLAYER_GM_ROUND_INTERACTION_RECOVERY_CONTRACT.md`

Slice J accepts one authoritative Event Session through the already accepted
boundaries:

```text
active Event Session
→ multiplayer Crew Planning
→ shared Resolution Order
→ Plan Lock
→ optional GM Unlock / Relock
→ Begin Resolution
→ pre-roll Focus / PASS
→ player station execution
→ multi-station progression
→ targeted GM recovery evidence
→ final occupied station
→ RESOLUTION COMPLETE / AWAITING ROUND CLOSEOUT
```

Task 5 does not begin in Slice J. No round closeout, Momentum update, Pressure
breach processing, Hazard closeout, next round, M10 closeout, or persistent ship
application is part of this acceptance slice.

## Required integration witness

The deterministic witness in
`tests/voyage/foundry/slice-j-acceptance.test.mjs` uses one Event Session with
an authenticated GM, Player A owning Captain, Player B owning Engineer, Player
C owning Navigator, a crew reader, and an observer reader. It uses the existing
trusted operator resolver and existing runtime command paths; it does not invent
production-only identities or a second socket protocol.

The primary scenario directly proves the accepted GM-authoritative transport boundary for player execution: each socketlib-shaped Player call retains its originating sender identity while its handler executes under the active-GM identity. Player-side JournalEntry wrappers are write-instrumented and remain at zero writes; only the GM wrapper performs canonical updates. Focus USE and all three station executions use this transport, while direct local Player Focus/station mutation fails write-free. Crew Planning selections/order use the existing GM-context planning path in this primary witness; retained Slice C transport/authority suites remain the authority for any separate planning-transport claim.

The witness proves:

- GM, operator, crew, and observer projections are derived from trusted context;
- no raw session, processed-request, audit, or authority internals are sent to
  a player projection;
- each station execution is sent by its owning Player and runs in the active-GM handler (with at least two distinct Player senders);
- a foreign station operation is rejected without a write;
- a shared order is proposed and Plan Lock is GM-authoritative;
- a before-resolution reload succeeds;
- GM Unlock returns to Crew Planning, preserves existing selections/order, and
  Relock makes the corrected order authoritative;
- Begin Resolution creates pending checks without executing PF2e;
- the current operator uses the existing transported Focus path once;
- each occupied station executes through the existing transported, server-derived selected-statistic PF2e path exactly once;
- reload after progression succeeds; and
- the final projection is `station-resolution` / `resolution` with
  `resolutionComplete: true`, while Momentum and Task 5 closeout data remain
  untouched.

The existing Slice A–I suites remain the detailed witnesses for all other
matrix rows, including transport, contention, stale revisions, authority-epoch
drift, disconnect/takeover, void/retry recovery, Risk Bid effects, dependency
ordering, and hostile payload rejection.

## Cross-slice acceptance matrix

| Boundary | Acceptance result |
|---|---|
| A — projection authority | PASS: GM/full, owned operator, multi-owned operator, crew, and observer projections use trusted role derivation. |
| B — Player Event shell | PASS: ROUND, MY STATION, CREW PLAN, and RESOLUTION remain the exact four tabs; state is projection-driven. |
| C — Crew Planning | PASS: owned Action/Approach/Risk Bid selection and clear/edit paths remain canonical; foreign, crew, and observer mutation is rejected. |
| D — shared order / Plan Lock | PASS: one proposed/committed order, dependency/source-before-target validation, stale rejection, and GM lock authority. |
| E — Unlock / Relock | PASS: pre-resolution GM unlock preserves choices, records correction evidence, and relock reruns canonical validation. |
| F — Begin Resolution | PASS: `plan-locked → station-resolution`, pending checks are prepared, and no PF2e roll runs during Begin. |
| G — player station execution | PASS: current station/operator/statistic are server-derived and one PF2e execution is persisted/replayed exactly once. |
| H — player Focus / PASS | PASS: eligible player Focus/PASS gates the roll, spends once, and exact replay is write-free. |
| I — targeted GM recovery | PASS: remaining-order, operator-takeover, void-roll, and retry-roll-integration are the only executable kinds; histories are audited and durable. |
| Task 4 Risk Bid | PASS: authored bid selection, single-roll resolution, source/target order, and one-time payoff remain canonical. |
| Task 4 source→target dependency | PASS: source-before-target validation and durable benefit consumption remain canonical. |
| M11 persistence/replay | PASS: one JournalEntry, monotonic revisions, reload validation, isolated replay, and zero-write failures remain intact. |
| socketlib GM transport | PASS: player-originating RPC is handled by the active GM; local non-GM mutation is not authoritative. |
| multi-owned operators | PASS: each owned station is independently authorized and a prior station loses authority after advancement. |
| disconnect/control transfer | PASS: disconnect does not vacate assignment; takeover is permitted only under accepted inactive-owner rules. |
| privacy | PASS: filtering occurs before presentation; CSS/Handlebars hiding is not authority. |
| final Resolution state | PASS: the final occupied station stops at `RESOLUTION COMPLETE / AWAITING ROUND CLOSEOUT`. |
| target correction | DEFERRED BY CONTRACT. |
| recorded-result correction | DEFERRED BY CONTRACT. |
| Task 5 | OUT OF SCOPE / not implemented. |
| Task 6 | OUT OF SCOPE / not implemented. |

## Required security and contention answers

The integrated acceptance is PASS only when all answers below are “NO”:

- Can a player mutate a foreign station? No.
- Can a player write the Event Session JournalEntry directly? No.
- Can a player spoof GM, role, ownership, station, statistic, DC, or result? No.
- Can a player execute a foreign pending check? No.
- Can replay reroll PF2e or spend Focus twice? No.
- Can PASS spend Focus? No.
- Can Risk Bid change after Plan Lock or during Resolution? No.
- Can a dependency effect apply twice? No.
- Can Plan Unlock occur after Begin Resolution? No.
- Can a player invoke Slice I recovery? No.
- Can a connected healthy operator be taken over? No.
- Can a quarantined void identity execute? No.
- Can retry reuse the old check identity? No.
- Can target or recorded-result correction execute? No; both are deferred.
- Can Slice J enter Task 5? No.

Representative contention and stale/epoch cases are retained from the accepted
Slice A–I suites: player versus GM station execution has one winner and one
PF2e roll, Focus USE versus PASS resolves one reaction, duplicate Plan Lock and
Begin perform one lifecycle transition, destructive recovery has one winner,
stale revision returns `m11-stale-session-revision`, and authority-epoch drift
returns the canonical authority/control diagnostic with no mutation.

## Persistence and document-write boundary

The Slice J acceptance uses the existing M11 JournalEntry path. Player-originated
commands never receive a document-write capability. The authoritative GM path
performs only the expected canonical session updates; read, replay, conflict,
stale, hostile, and unauthorized paths perform zero writes. PF2e Actor `system`,
embedded Items, sibling Arcflight flags, and unrelated Actor data remain outside
the M11/M12 session write boundary.

## Reload and recovery boundary

Strategic reloads occur after Plan Lock, after Unlock/Relock, after Begin, after
Focus or station resolution, and after Slice I recovery. Reload must reproduce
the authoritative revision, current station, Focus spend, locked Risk Bid,
dependency receipts, and correction history without duplicate mutation.

The acceptance slice does not add player recovery RPC, generic GM editing,
target authoring, recorded-result supersession, a second coordinator, or a
second PF2e engine.

## Manual Foundry acceptance

With one GM and at least two connected players:

1. Reload Foundry and open the existing Event Session.
2. Verify GM, owned operator, crew, and observer projections.
3. Select Action, Approach, and one authored Risk Bid from separate owned
   stations; attempt one foreign-station edit and confirm rejection.
4. Propose order, Plan Lock, reload, GM Unlock, make one valid edit, and Relock.
5. Begin Resolution and verify no roll occurs during the transition.
6. Use Focus or PASS from the eligible player, then roll the current station.
7. Progress through at least two different player-owned stations and reload.
8. Exercise accepted Slice I recovery in a controlled test session.
9. Resolve the final occupied station and verify exactly:
   `RESOLUTION COMPLETE / AWAITING ROUND CLOSEOUT`.
10. Confirm no Task 5 closeout, Momentum update, Pressure breach, Hazard
    closeout, next round, or Task 6 behavior occurs.

No live Foundry execution is claimed by the automated acceptance suite; the
manual steps above are required for final world validation.
