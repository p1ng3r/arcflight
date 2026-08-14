# Arcflight Gameplay V3 — M12 Task 4 Focus + Reaction Contract

Task 4 begins only after the merged Task 3 `station-resolution` / `resolution`
boundary. Task 3 remains authoritative for station order, pending station
checks, PF2e station execution, Risk Bid DCs, and advancement.

The registered immutable M12 event snapshot is
`m12-glassback-cinderwake-v3`. It is a new handcrafted snapshot; prior v1 and
v2 identities are not silently reinterpreted or remapped.

The event authoring package owns three explicit round records. Each round
contains three distinct authored actions for each of the five canonical
stations. Action names, descriptions, approaches, targets, and Risk Bid
stakes are authored by round and are not generated from a station-wide action
template. An action may offer no Risk Bid or an authored subset of `+2`, `+5`,
and `+8`. Every offered tier owns concrete Critical Success, Success, Failure,
and Critical Failure text/effect rules and a target. Its four branch reference
lists resolve exactly once to effect rules in that action's own
`outcomeDefinition`; no universal `dcAdjustment`-only benefit/consequence
branch is valid. This task only authors and presents those rules; it does not
apply Pressure, Hazard, or other deferred Task 5 consequences. Risk Bid
authoring is capped at four capable actions per round and two per station, and
every station retains at least one no-bid action. A round may select at most
three bids and a station at most one. The increased DC is the complete Risk
Bid downside: Failure and Critical Failure receive no Risk Bid payoff and no
additional Risk-Bid-specific penalty. Payoff scales with the wager and remains
action-specific.

Risk Bid effects are durable cross-station evidence. Each effect is bound to
its source station/action/bid/result and source revision, target station and
pending-check ID, effect kind/value, round, timing, and source-before-target
ordering. Effects are derived before the target roll, applied at most once,
survive reload, and are consumed or blocked without a duplicate roll. The
resolution bonus joins other Arcflight modifiers under the total `+5`/`-5`
cap; an authored degree shift is applied once after the target result.

The planning and Resolution Order UI marks Risk-Bid-capable actions, displays
the exact authored wager payoff, target, final DC, and no-extra-penalty failure
wording, and identifies whether source order permits activation. Resolution
shows an active benefit before the target roll.

Each occupied station starts with one event-local Focus point. Focus is keyed by
the occupied station and canonical operator identity; unoccupied stations have
none. Focus is neither ship-wide Momentum nor a Hero Point, and is never stored
as a live Actor or Foundry object.

The authored M12 ability is an explicit `focusAbilityId` record supplied by the
trusted event authoring boundary. Its canonical authoring record explicitly
contains `focusAbilityId`, name, description, `trigger`, `timing`, `cost`,
eligible source
operator/station, target rule, PF2e check or reroll structure, `dcSource`,
Critical Success, Success, Failure, Critical Failure, visibility, and
narration. It opens only in the `before-roll` window for
its declared target station. Its example outcome mapping is authored event
content, not a universal Focus rule: critical success `+3`, success `+1`,
failure `-1`, critical failure `-3` to the target station roll. The ability costs
one Focus and the cost is committed before its PF2e check.

The durable encounter metadata records `focusPools`, `focusAbilities`,
`reactionWindow`, `focusPendingCheck`, `focusResults`, and `focusEffects`. A
reaction window is ordered, explicit, and either `open` with eligible
opportunities or `closed` with resolved opportunity IDs. A station check cannot
execute while its required window is open. PASS closes one opportunity without
spending or rolling. USE first persists the exact pending Focus check, decrements
Focus, and marks the opportunity in-progress; only after that reread succeeds
may the trusted PF2e Focus executor run. The normalized result is then persisted
as append-only evidence keyed by the reaction and target pending-check IDs,
closes that opportunity, and never advances the station itself. A retry resumes
the persisted pending check and never rolls it twice. Multiple opportunities
are processed in stable order; no opportunity may be reused.

`focus-reaction-pass` and `focus-reaction-use` use the authenticated active-GM
command boundary with exact request shape, revision/authority checks, replay and
conflict handling, isolated responses, and reread verification for each durable
transition. USE has one spend/preparation write followed, when execution
succeeds, by one result-application write; uncertain writes do not trigger a
speculative second PF2e roll. Callers cannot author Focus remaining, result,
degree, modifier, refund, or station advancement. PF2e execution reuses the
existing trusted pending-check executor boundary and includes the current
Momentum context. Authored Focus plus Momentum and other Arcflight roll
modifiers are clamped to a total bonus/penalty range of `+5`/`-5`.

Focus events, audits, processed requests, window state, spent pools, normalized
results, target station, and modifiers are append-only reloadable evidence.
Distinct Foundry rereads and persisted-then-thrown writes are classified by the
existing runtime rules. No Actor, Item, ship, M10, socket, chat, or UI write is
performed by this task.

The Resolution UI must show the current reaction window, authored ability name
and narration, eligible source station, target, Focus cost, selected statistic,
DC, visibility, and the authored Critical Success, Success, Failure, and
Critical Failure outcomes before USE FOCUS is committed. Raw identifiers are
supporting evidence, not the primary player-facing choice text. Risk Bid choice
presentation must likewise show the selected approach/check, base and adjusted
DC, intended benefit, target, and authored Failure/Critical Failure
consequences before commitment. This transparency is required, not optional.

The Focus execution receipt is durable Event Session evidence keyed by
`pendingCheckId`. A Focus pending check records an execution status and either
an empty receipt or one trusted normalized PF2e result receipt. Once the
execution status is `executing`, a fresh runtime must never execute that
`pendingCheckId` again unless the same invocation that durably committed the
pending check is continuing; a later runtime may only consume a persisted
receipt or return the existing recovery-required result. The receipt is
persisted before result application so a full process/world reload cannot
reroll a completed Focus check. The pre-reaction pending transition remains
the required recovery checkpoint.

The Resolution UI shows the current reaction window, authored ability name,
eligible operator, remaining Focus, result, and effective modifier. It shows USE FOCUS or
PASS while open and hides/disables ROLL CHECK until the window closes. After
the normal station check, Task 3 advances to the next station and Task 4 may
open that station’s window. The task ends at `RESOLUTION COMPLETE — AWAITING
ROUND CLOSEOUT`; round aggregation, Momentum updates, Pressure, Hazards,
aftermath, closeout cleanup, and generalized reaction systems are deferred.
