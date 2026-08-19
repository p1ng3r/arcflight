# Arcflight Gameplay V3 — Milestone 12
# Player / GM Round Interaction + GM Recovery Contract

**Status:** Proposed normative Milestone 12 interaction contract and active forward roadmap
**Scope:** Foundry VTT multiplayer Event Session interaction from Round Introduction through Station Resolution
**Authority:** Subordinate to `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`; normative for M12 player/GM interaction where the canonical gameplay rules do not prescribe UI behavior.
**Implementation principle:** One authoritative Event Session; multiple filtered views; player actions and GM recovery always flow through canonical runtime commands.

---

## 1. Purpose

This contract defines how one authoritative Arcflight Event Session is presented and controlled across the GM, player-controlled station operators, users controlling multiple station operators, non-acting crew members, observers, disconnected users whose operator remains assigned, and GM recovery/correction workflows.

The contract exists to prevent the GM Event Manager from becoming the only usable interface for gameplay. Arcflight is a multiplayer event runner. The authoritative state belongs to the GM-owned Event Session, but normal station decisions and rolls belong to the players controlling those operators.

---

## 2. Core Principle

There is **one authoritative Event Session** and multiple filtered views of it.

```text
                    AUTHORITATIVE
                    EVENT SESSION
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
     GM Projection   Crew Projection  Player Projection
                                         │
                                         ▼
                                  Owned Operator Controls
```

The application must never create separate gameplay truth for the GM UI and player UI. Player selections, rolls, reactions, and order proposals become official only through the existing authoritative Event Session command/runtime path.

---

## 3. Authority Roles

### 3.1 GM

The GM is the Event Session authority and may launch the event, assign operators during Setup, lock the plan, unlock a locked plan before Resolution, begin Resolution, pause/resume, correct invalid state, correct remaining station order, correct an invalid target, recover failed roll integration, take temporary control of an assigned operator, void an erroneous technical/accidental roll, correct a wrongly recorded result when supported by evidence, abandon the event, inspect audit history, and perform later closeout approval.

The GM does **not normally replace legitimate player decisions or legitimate roll results merely because the outcome is undesirable**.

### 3.2 Player

A player receives authority only over station operators they control. A player may view shared round information, view the shared Crew Plan, edit Action/Approach/Risk Bid for their operator, select required targets their operator is authorized to choose, participate in station-order planning, make the PF2e roll when their station becomes active, use or decline eligible Focus abilities, answer eligible reaction prompts, and view revealed station results and known consequences.

A player may not edit another player's Action/Approach/Risk Bid, use another operator's Focus, perform GM recovery commands, expose hidden GM information, or directly mutate Event Session persistence.

### 3.3 Player Controlling Multiple Operators

One Foundry user may control more than one operator if those operators occupy different stations.

```text
User A
├── Captain
└── Watchmaster
```

That user receives normal Player authority for both owned operators, but not for other stations.

### 3.4 Observer

An observer may view shared revealed information, station status, locked order, finalized public results, Momentum, visible Pressure, and revealed Hazards, but receives no gameplay mutation controls.

### 3.5 GM Preview Player View

The GM application SHOULD provide `PREVIEW PLAYER VIEW` as a presentation/debugging feature only. It does not reduce GM runtime authority and must never spoof or rewrite the authenticated user role.

---

## 4. Role Selection

Users do **not** choose whether they are GM or Player from a gameplay dropdown. Foundry permissions and operator ownership determine authority.

```text
game.user.isGM
→ GM projection / GM controls

controlled assigned operator
→ Player projection + owned station controls

neither
→ Observer/shared projection
```

A GM may explicitly enter Player Preview mode for testing.

---

## 5. Required Projections

The Event Session runtime MUST support filtered presentation projections at minimum for:

```text
GM
CREW
PLAYER
OBSERVER
```

### 5.1 GM Projection

May include complete Event Session data, hidden authored branches/escalation, GM notes, secret DC data where appropriate, recovery state, audit records, coordination diagnostics, and all player-visible information.

### 5.2 Crew / Shared Projection

Normally includes event/round title, round introduction, objective, known stakes, occupied stations, operators, current Momentum, visible Pressure, revealed Hazards, station planning state, chosen actions/approaches/Risk Bids, known targets, proposed/locked station order, known cross-station benefits, and revealed results.

### 5.3 Player Projection

Contains the crew/shared projection plus operator ownership information for that user, editable controls only for owned operators, eligible reactions, owned Focus state, owned roll controls, and owned target controls. It MUST NOT expose GM-only information.

### 5.4 Observer Projection

Contains shared revealed information without mutation controls.

---

## 6. Canonical Round Choreography

Every round proceeds:

```text
ROUND INTRODUCTION
        ↓
CREW PLANNING
        ↓
PLAN REVIEW / ORDER
        ↓
PLAN LOCK
        ↓
STATION RESOLUTION
        ↓
ROUND CLOSEOUT
        ↓
NEXT ROUND
```

The canonical Event Runner rules remain authoritative for the detailed round lifecycle.

---

## 7. Round Introduction

GM sees event/round information, vignette, objective, known and hidden stakes, Momentum, Pressure, Hazards, station/operator roster, and administrative controls.

Player sees round number/title, player-visible vignette, objective, known stakes, Momentum, visible Pressure, revealed Hazards, owned station(s), and crew station roster.

GM commands may include:

```text
OPEN CREW PLANNING
PAUSE EVENT
ABORT EVENT
```

Players have no round-transition authority.

---

## 8. Crew Planning

Each occupied station receives exactly three authored actions.

For every owned station, the player chooses:

```text
ACTION
APPROACH
RISK BID / NO BID
TARGET when required
```

The Captain does not choose other operators' Action, Approach, Risk Bid, or Focus decisions. Crew order is collaborative, with Captain able to settle disagreement socially and GM responsible for invalid plans.

---

## 9. Shared Planning Status

All clients SHOULD see station readiness from persisted Event Session state.

```text
CAPTAIN        READY
NAVIGATOR      CHOOSING
WATCHMASTER    READY
VEIL WARDEN    APPROACH REQUIRED
ENGINEER       READY
```

Never derive readiness solely from local browser state.

---

## 10. Player Crew Plan Controls

Owned stations are editable. Unowned stations are read-only.

Example owned station:

```text
[STATION ICON]
CAPTAIN

Action
[ Mark the Beast ]

Approach
[ Society ]

Risk Bid
[ +5 ]

READY
```

---

## 11. Collaborative Station Order

Station order is shared round state and is chosen again each round. Players may participate in proposing/reordering while planning. All order mutations must pass through the canonical authoritative command path. No client-local order is authoritative.

If two clients change the order against the same revision:

```text
one authoritative mutation wins
→ stale mutation rejects
→ stale client rereads Event Session
→ UI rerenders authoritative order
```

Never merge conflicting client-local sequences heuristically.

---

## 12. Plan Review

Before lock, GM and players may review every occupied station, operator, Action, Approach, Risk Bid, target, player-visible final DC information, known cross-station effects, proposed resolution order, and Risk Bid source→target dependencies. GM-only hidden authored data remains filtered.

---

## 13. Plan Lock

Only the GM performs the authoritative Plan Lock in this vertical slice.

After successful lock:

```text
PLAN LOCKED
```

appears for all clients. Normal Action / Approach / Risk Bid / target/order editing becomes unavailable.

---

## 14. GM Unlock Before Resolution

The GM MUST have `UNLOCK PLAN` available after Plan Lock **but before the first Action Segment begins**.

Unlock preserves existing choices, reopens Crew Planning, allows legitimate corrections, does not erase the round, does not recreate the Event Session, does not reroll anything, and records an audit entry.

Recommended audit record:

```js
{
  kind: "plan-unlocked",
  userId,
  roundNumber,
  revisionBefore,
  revisionAfter,
  reason,
  timestamp
}
```

---

## 15. Relock After Correction

After correction, `LOCK PLAN` runs normal validation again. There is no privileged bypass of canonical plan validation. Invalid plans remain unlocked.

---

## 16. Begin Resolution

`BEGIN RESOLUTION` is a **multiplayer Event Session transition**, not merely a GM tab change.

After successful transition every connected Event UI rereads authoritative state, planning becomes read-only, Resolution becomes active, the first unresolved occupied station becomes current, the acting player's Resolution controls activate, other players become observers/reaction participants, and the GM receives full administrative Resolution controls.

---

## 17. Action Segment State Machine

Every occupied station follows:

```text
REVEAL
↓
CONFIRM LOCKED SELECTION
↓
PRE-ROLL REACTION WINDOW
↓
STATION ROLL
↓
RESULT-MODIFICATION WINDOW
↓
FINALIZE RESULT
↓
APPLY OUTCOME
↓
POST-RESOLUTION / INTER-STATION WINDOW
↓
NEXT STATION
```

---

## 18. Acting-Player View

The acting player sees the current station, operator, locked action, approach, Risk Bid, final DC, active benefits, and the authorized roll control. Only the authorized operator or GM recovery authority may initiate the normal station roll.

---

## 19. Other-Player View

Other players see the current station and operator in an observer state. If they become eligible for a reaction, the reaction UI supersedes the passive waiting state.

---

## 20. GM Resolution View

GM sees current station, operator, action, approach, Risk Bid, target, relevant DC, pending reactions, pending roll, result, active cross-station effects, recovery controls, and audit access.

---

## 21. Reactions

Eligible reactions belong to their eligible users.

```text
FOCUS REACTION AVAILABLE

[VEIL WARDEN ICON]
Brace the Veil

Target:
Navigator

Cost:
1 Focus

[USE FOCUS]
[DECLINE]
```

If a reaction decision is required, Resolution cannot advance until the window closes.

---

## 22. Reaction Visibility

GM sees that a reaction is pending. The eligible player sees decision controls. Other players see a non-authoritative waiting state. Hidden reaction details may remain hidden if explicitly authored.

---

## 23. Risk Bid Cross-Station Effects

Earned effects appear on the affected station before its roll.

```text
[NAVIGATOR ICON]
NAVIGATOR

ACTIVE BENEFIT

[CAPTAIN ICON]
Mark the Beast

+2 NEXT ROLL

Consumed when Navigator resolves.
```

Both GM and players see player-visible benefits.

---

## 24. Order-Link Visual

Runtime overlay composition SHOULD use:

```text
TOP SOCKET
= source/providing station

BOTTOM SOCKET
= target/beneficiary station
```

The overlay is presentation only. Canonical source/target IDs remain Event Session data.

---

## 25. Result Presentation

After a station roll but before finalization, the raw result may be shown. If a result-modification reaction exists, it is offered before the final result is committed. After reaction windows close, the final result is applied.

---

## 26. No Undo After Normal Finalization

Once an Action Segment has finalized and its outcome has been durably applied, normal Plan Unlock is unavailable, normal station editing is unavailable, previous stations remain historical, and only explicit GM recovery/correction operations may alter invalid recorded state.

---

## 27. GM Recovery During Resolution

After Resolution begins, recovery must be **targeted**.

Initial recovery commands:

```text
CORRECT REMAINING ORDER
CORRECT TARGET
TAKE CONTROL OF OPERATOR
VOID ERRONEOUS ROLL
RETRY FAILED ROLL INTEGRATION
CORRECT RECORDED RESULT
PAUSE EVENT
ABORT EVENT
VIEW AUDIT HISTORY
```

Do not reopen the entire Crew Plan.

---

## 28. Correct Remaining Order

GM may change only unresolved station positions. Already-resolved positions cannot be moved. All dependency validation reruns. Audit is required.

---

## 29. Correct Target

Used when a target is objectively invalid or was selected incorrectly due to UI/runtime error. It may correct an unresolved target or a currently resolving target before irreversible outcome application. It must not silently rewrite a legitimate previously resolved choice. Audit is required.

---

## 30. Take Control of Operator

A disconnected user does not vacate the station.

`TAKE CONTROL` temporarily grants GM runtime control of the same operator, preserves station assignment, character/operator identity, and locked Action/Approach/Risk Bid, and records takeover. It does not reassign stations.

---

## 31. Return Control

If the user reconnects, `RETURN CONTROL` may restore normal player interaction. Station/operator assignment does not change.

---

## 32. Void Erroneous Roll

This is not a Hero Point/reroll mechanic.

Valid reasons include wrong character rolled, invalid duplicate integration, incorrect statistic integration, roll fired before required reaction, or technical integration failure. It requires GM authority and an audit reason and must never be presented as “reroll bad result.”

---

## 33. Retry Failed Roll Integration

Used when a PF2e roll completed but Arcflight failed to capture/integrate it correctly and authoritative recovery evidence permits deterministic retry/reconciliation. It must reuse canonical durable identity/receipt behavior and must never intentionally create a second legitimate roll merely because the first integration failed.

---

## 34. Correct Recorded Result

Exceptional only. Allowed when the recorded Arcflight result is objectively inconsistent with the actual valid PF2e result or another verified technical error occurred. It requires explicit reason, old value, corrected value, evidence/reference when available, and an audit record.

---

## 35. Audit History

Every privileged post-lock correction must record:

```text
correctionId
sessionId
roundNumber
stationId when applicable
kind
performedBy
reason
revisionBefore
revisionAfter
before
after
timestamp
```

Do not store audit solely in console logs.

---

## 36. Player-Facing Audit Visibility

Material corrections SHOULD be publicly visible when they affect known gameplay. Hidden technical details remain GM-only.

---

## 37. Pause Behavior

Safe pause points include Crew Planning, between Action Segments, after reaction resolution, after Round Closeout, and Closeout Review. The system must not pause halfway through one atomic outcome application.

---

## 38. Disconnect Behavior

Disconnect does not invalidate the round. If the current operator disconnects, GM may wait, take control, grant temporary control, or pause. The station remains occupied and locked selections remain intact.

---

## 39. Reconnection

On reconnection the client finds the active Event Session, obtains the current filtered projection, opens/refreshes Event UI, sees the current phase, and resumes controls only if currently eligible. No replay of previous rolls, spent Focus, consumed Risk Bid effects, or finalized outcomes.

---

## 40. Client Synchronization

After every authoritative Event Session mutation:

```text
COMMAND
↓
GM-authoritative mutation
↓
revision changes
↓
interested clients notified
↓
clients reread filtered projection
↓
UI rerenders from authoritative state
```

Socket messages do not become gameplay truth. Persisted Event Session remains authoritative.

---

## 41. Stale Client Commands

Every mutation should carry sufficient session/revision identity to reject stale interaction. On stale rejection, reread, rerender, and allow retry if still relevant. Do not guess or auto-merge.

---

## 42. Player Application Navigation

Initial player-facing tabs:

```text
ROUND
MY STATION
CREW PLAN
RESOLUTION
```

Do not clone the entire GM Event Manager.

---

## 43. Player Round Tab

Shows vignette, objective, stakes, round number, Momentum, Pressure, Hazards, and crew status.

---

## 44. My Station Tab

Shows owned station(s), operator, Focus, current Action, Approach, Risk Bid, active benefits, Pressure, and eligible reactions. During Crew Planning it contains editing controls; during Resolution it contains current execution controls.

---

## 45. Crew Plan Tab

Shows all occupied stations. Owned stations are editable when planning is unlocked; other stations are read-only. It shows shared proposed/locked order.

---

## 46. Resolution Tab

Shows current station/operator, locked action, approach, Risk Bid, target, active benefits, pending reaction state, revealed result, and completed station history for the round. Only eligible users receive active controls.

---

## 47. GM Application Additions

The existing GM Event Manager should add explicit administrative regions:

```text
GM CONTROLS
RECOVERY
AUDIT
```

Recovery controls should not clutter ordinary player-facing station cards.

---

## 48. Begin Resolution Authorization

For M12, only the GM may perform the authoritative Begin Resolution transition. Players see the resulting transition automatically.

---

## 49. Advancing Between Stations

Normal station advancement should be runtime-driven once the station result is finalized, outcomes are applied, and required post-resolution reactions are closed. If a manual `NEXT STATION` confirmation remains useful during alpha, it is a GM presentation control over an already-valid transition, not an alternate state machine.

---

## 50. End of Task 4 Boundary

After the final occupied station resolves:

```text
RESOLUTION COMPLETE
AWAITING ROUND CLOSEOUT
```

Both GM and player projections must reflect that state. No Task 5 round closeout mechanics occur inside this interaction contract.

---

## 51. Task 5 Handoff

Task 5 receives finalized station results, success/failure units, consumed/unconsumed effects, current Momentum, Pressure, Hazards, reaction history, and round history.

Task 5 owns round degree, Momentum update, Pressure/Breaches, end-of-round Hazard effects, and next-round transition.

---

## 52. Momentum Presentation Boundary

The player/GM interaction contract may expose current Momentum but does not calculate new Momentum. When Task 5 implements live round closeout, both GM and player projections should use the same canonical Momentum value.

The planned `momentum_icon.webp` may display a runtime overlay:

```text
0
+1
+2
+3
```

---

## 53. Visibility Invariant

Client-side CSS/Handlebars hiding is **not sufficient authority protection**. Player clients must not receive secret GM data merely because it is hidden visually. Projection filtering occurs before presentation.

---

## 54. Ownership Invariant

An operator's UI authority is determined from trusted Foundry/user/operator mapping. A browser-supplied station/user claim is never sufficient by itself to authorize a player command.

---

## 55. Roll Invariant

Every legitimate station action still has one canonical PF2e roll. Player-side UI must reuse the existing selected-statistic PF2e execution engine. No separate player roll engine.

---

## 56. Focus Invariant

Player Focus controls must reuse the current durable Focus/reaction contract. No client-only Focus spending.

---

## 57. Risk Bid Invariant

Player-side UI reuses the same canonical Risk Bid selection/effect state. No duplicate player-specific Risk Bid interpretation.

---

## 58. GM Correction Invariant

A correction changes authoritative state only through an explicit recovery operation. Never directly mutate Journal flags or arbitrary session fields from a UI handler.

---

## 59. Resolved-History Invariant

Normal planning operations cannot alter resolved station history. Recovery operations must explicitly identify what historical state is being corrected and why.

---

## 60. Reload Invariant

Reloading any client must reproduce the same playable state from persisted session data. No essential state may exist only in DOM, local variables, transient popup state, or client-only action history.

---

## 61. Player UI Art Invariant

GM and Player views may share station icons, Risk Bid icons, Focus icon, Order Link art, Momentum art, and state chips. Artwork is presentation only. Canonical IDs and mechanical values remain plain runtime data.

---

## 62. Minimum Implementation Sequence

Do not implement all of this in one PR.

### Slice A — Projection / Authority Foundation

Implement GM, Crew, Player, and Observer projections plus owned-operator authorization. No large player UI yet.

### Slice B — Player Event Shell

Implement Round, My Station, Crew Plan, and Resolution tabs. Read-only first where possible.

### Slice C — Multiplayer Crew Planning

Enable owned-station Action, Approach, Risk Bid, and Target selection through canonical commands.

### Slice D — Shared Order + Plan Lock State

Implement shared order, player proposals, stale revision handling, and Plan Locked presentation.

### Slice E — GM Pre-Resolution Recovery

Implement `UNLOCK PLAN`, `RELOCK`, and correction audit.

### Slice F — Multiplayer Begin Resolution

One GM transition activates Resolution for every projection/client.

### Slice G — Player Station Execution

Authorized acting player receives roll controls. Others receive observe/reaction state.

### Slice H — Player Focus / Reaction UI

Eligible users receive decision prompts.

### Slice I — GM In-Resolution Recovery

Implement targeted remaining-order correction, target correction, operator takeover, erroneous-roll recovery, failed-integration retry, recorded-result correction, and audit.

### Slice J — Full Task 4 Multiplayer Acceptance

Run one complete Glassback round:

```text
introduction
→ multiplayer planning
→ order
→ lock
→ begin resolution
→ player rolls
→ Focus
→ Risk Bid
→ recovery test
→ last station
→ AWAITING ROUND CLOSEOUT
```

Only then declare M12 Task 4 fully complete.

---

## 63. Minimum Real Foundry Acceptance Scenario

Use:

```text
1 GM
2+ connected player users
5 occupied station operators where practical
```

Test ownership filtering, multiplayer planning, stale revision recovery, GM lock/unlock/relock, shared Begin Resolution, acting-player rolls, non-acting observation, correct Focus recipient, cross-station Risk Bid benefits, disconnect/takeover, remaining-order correction, audited erroneous-roll recovery, reload restoration, and final stop at Awaiting Round Closeout.

---

## 64. Explicit Non-Goals

This contract does **not** implement Task 5 round closeout, Momentum calculation, Pressure Breaches, Hazard closeout, next-round runtime, Task 6 final Event closeout, rewards, Misfortunes, persistent ship application, or new Risk Bid +8 variants discussed during design brainstorming.

---

## 65. Locked Design Decisions

```text
ONE authoritative Event Session
Foundry determines GM vs Player authority
GM UI and Player UI consume filtered projections
Players operate only owned station operators
Players perform their own station rolls
Players receive their own Focus/reaction prompts
Begin Resolution is a shared multiplayer transition
GM can unlock a locked plan before Resolution begins
After Resolution begins, recovery is targeted rather than full-plan unlock
Already-resolved stations are protected from normal editing
Legitimate bad rolls are not casually rewritten
Technical/invalid roll corrections are explicit and audited
Disconnected players do not vacate stations
GM can temporarily take over the same operator
Every privileged post-lock correction is audited
Task 4 still ends at AWAITING ROUND CLOSEOUT
```

---

## 66. Relationship to Completed Gameplay V3 Work

This roadmap **extends the existing Gameplay V3 architecture; it does not replace it**.

The work already completed remains directly useful:

- pure plain-data domain boundaries;
- lifecycle and phase transitions;
- snapshots and recovery foundations;
- fixed station/operator assignments;
- occupied/unoccupied station handling;
- round-specific action authoring;
- committed approaches;
- player-committed order;
- canonical Risk Bid contracts and target/timing metadata;
- one-roll PF2e execution and pending-check identity;
- round mechanics foundations;
- Pressure, Hazards, Void Scars, rewards/Misfortunes, catastrophic breakdown contracts;
- controlled closeout/persistent application boundaries;
- M11 durable Event Session runtime, revisions, replay/idempotency, checkpoints, authority, projections, disconnection control transfer, and audited recovery;
- M12 Event launch;
- M12 Crew Planning;
- M12 station resolution;
- M12 Focus/reaction and Risk Bid UI/runtime work.

The player application is a new adapter/presentation layer over those foundations. It must reuse them rather than reimplement them.

---

## 67. Active Forward Roadmap

```text
CURRENT M12 GM TASK 4
        ↓
stable checkpoint / commit
        ↓
THIS PLAYER + GM ROUND INTERACTION CONTRACT
        ↓
Slice A — filtered projections / owned-operator authority
        ↓
Slice B — player Event shell
        ↓
Slice C — multiplayer Crew Planning
        ↓
Slice D — shared order / Plan Lock state
        ↓
Slice E — GM Unlock / Relock recovery
        ↓
Slice F — multiplayer Begin Resolution
        ↓
Slice G — player station execution
        ↓
Slice H — player Focus / reactions
        ↓
Slice I — targeted GM in-resolution recovery
        ↓
Slice J — full multiplayer Task 4 acceptance
        ↓
Task 5 — Round Closeout + Momentum
        ↓
Next Round
        ↓
Task 6 — Final Event Closeout
```

This document is the working roadmap for the next M12 implementation phase.
