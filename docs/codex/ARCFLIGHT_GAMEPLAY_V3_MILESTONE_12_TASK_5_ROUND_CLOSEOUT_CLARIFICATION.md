# Arcflight Gameplay V3 — M12 Task 5 Round-Closeout Clarification

Status: clarification/draft authority only. This document does not authorize or implement Task 5.

## Purpose and classification

This draft separates rules that are already explicit from integration behavior forced by the existing M11/M12 architecture and from decisions that the authorities do not yet make. `CANONICAL` means directly stated by an authority. `DERIVABLE` means required to preserve an existing authoritative boundary without adding game mechanics. `OPEN DECISION` means the authorities do not define the value, ordering, vocabulary, or ownership needed for implementation.

## Authorities inspected

Read in the required order:

1. `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`
2. `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`
3. `docs/gameplay-v3/reconciliation-and-continuation-roadmap.md`
4. `docs/codex/CURRENT-GAMEPLAY-V3.md`
5. `docs/codex/ARCFLIGHT_GAMEPLAY_V3_MILESTONE_12_PLAYER_GM_ROUND_INTERACTION_RECOVERY_CONTRACT.md`
6. `docs/codex/ARCFLIGHT_GAMEPLAY_V3_MULTIPLAYER_SLICE_J_FULL_TASK4_ACCEPTANCE_CONTRACT.md`

The current runtime and M12 event definition were inspected only to record existing field, event, checkpoint, revision, and command conventions. Existing implementation is not treated as authority for missing mechanics.

## 1. Task 5 entry state

### CANONICAL

The accepted Task 4 terminal boundary is:

```text
resolutionComplete === true
sessionState === "station-resolution"
encounterState.lifecycleState === "active"
encounterState.phase === "resolution"
```

The accepted Slice J contract presents this as `RESOLUTION COMPLETE / AWAITING ROUND CLOSEOUT`. Task 4 performs no closeout, Momentum update, Pressure Breach, Hazard closeout, next-round, or Task 6 transition.

### DERIVABLE

A Task 5 mutation must reread and validate the complete stored session before mutation. It must reject a session with an unresolved pending check, open reaction, retry-pending integration, recovery-required state, or incomplete occupied-station result because such a session is not the accepted Task 4 boundary. This is an integrity precondition, not a new gameplay rule.

### OPEN DECISION

The authorities do not define the exact persisted predicates for “all occupied stations finalized”, canonical skipping evidence for every unoccupied station, an empty reaction queue, no retry-pending state, or no unresolved recovery state. The implementation must not invent field names or a closeout command until these predicates are specified.

## 2. Round-closeout command/API

### CANONICAL

Task 5 owns round degree, Momentum update, Pressure/Breaches, end-of-round Hazard effects, and next-round transition. The M12 interaction contract explicitly says that it does not implement these mechanics.

### OPEN DECISION

No canonical Task 5 command literal or public API is currently defined. The existing runtime contains later closeout commands, but none is the Task 5 round-closeout command. Exact command name, request key order, request payload, server-derived fields, GM/active-GM requirement, player transport exposure, `requestId`, expected revision, and authority-epoch requirements remain open. The eventual operation must be one authoritative atomic Task 5 mutation, but its wire vocabulary is not chosen here.

## 3. Round units

### CANONICAL

The canonical individual outcome mapping is:

```text
Critical Success → 2 success units
Success          → 1 success unit
Failure          → 1 failure unit
Critical Failure → 2 failure units
```

Each occupied station makes one check and its degree resolves the station’s round units. Unoccupied stations are skipped, make no check, and contribute no success or failure units. Success and failure are separate nonnegative pools. The one-roll action interpreter and the canonical action-branch unit table are the existing sources for station outcome units.

The round sequence aggregates units after occupied-station resolution and before determining the round result. Risk Bid selection raises the check DC; the canonical Risk Bid rule does not add a second normal-action penalty or replace the normal station unit contribution. The selected branch still supplies its authored outcome effects.

### DERIVABLE

Task 5 must sum each finalized station result exactly once from trusted Task 4 evidence. It must not accept caller-authored totals, reinterpret a degree, count an unoccupied station, or apply the same station result twice. Focus, reactions, cross-station benefits, and Risk Bid effects may only affect totals where their canonical authored outcome explicitly changes the station result; no generic Task 5 adjustment is authorized.

### OPEN DECISION

The authorities do not completely specify whether any particular Focus/reaction/source-to-target effect can add, remove, or transform round units, nor the complete precedence when multiple authored effects would do so. They also do not define a Task 5 evidence schema for the aggregate. Those bindings must be decided before coding.

## 4. Round-result ladder

### CANONICAL

The explicit round ladder is:

```text
Critical Round Success: success units >= 2 × failure units
Round Success:          success units >= failure units, but not critical
Critical Round Failure: failure units >= 2 × success units
Round Failure:          failure units > success units, but not critical
```

Critical degrees change rewards and consequences but do not change the Momentum step. The normal overall-event threshold for a three-round event is at least two successful rounds.

### OPEN DECISION — ZERO/ZERO FALLBACK

The authorities expressly state that a round with zero success units and zero failure units must use an explicit authored fallback and must not be classified by the ratio formulas. No authoritative fallback category or source is supplied. It is not valid to choose success, failure, a critical result, a draw, or an automatic continuation in this clarification.

## 5. Momentum

### CANONICAL gameplay formula

- Event starting Momentum is `0`.
- Round Success or Critical Round Success increases Momentum by `1`, capped at `+3`.
- Round Failure or Critical Round Failure decreases Momentum by `1`, floored at `0`.
- Critical round degree does not change the one-step update.
- The new value applies beginning with the next qualifying check after the completed round.
- Momentum applies to qualifying event checks, including station, Risk Bid, Focus, Hazard response, support, stabilization, and repair checks.
- Remaining Momentum disappears at event closeout and does not become a reward or restore Focus.
- Authored exceptions may create temporary penalties or bonuses; ordinary failed rounds do not create negative Momentum.

### DERIVABLE integration

Task 5 must derive the post-round value from the stored pre-round value and canonical round result, persist it atomically with the round transition, and return the stored post-transition value on replay. It must not allow a caller to supply Momentum or apply it before the completed round.

### OPEN DECISION

The authorities do not define the exact Task 5 evidence fields, event/audit kind, receipt requirement, or how an authored exceptional Momentum effect is cross-bound to the round-closeout mutation. Those integration details remain open.

## 6. Pressure — type model

### CANONICAL

Pressure is tracked independently for five canonical station-system identifiers:

```text
crew-morale
arkengine
levstone-array
solar-sail-rig
lifeveil
```

The generic constants define default value `0`, default capacity `2`, and maximum capacity `5`. Pressure is temporary event strain tracked separately per system. The canonical rules allow authored effects to change Pressure when explicitly authored.

### DERIVABLE

Existing runtime validation requires a complete canonical pressure-system map with `pressureSystemId`, `value`, and `capacity` records. Task 5 must preserve that ordering and identity and must derive changes from trusted station/action, Hazard, or authored effect evidence rather than a caller-authored map.

### OPEN DECISION

The milestone map explicitly says typed Pressure tracks are missing and only generic tracks exist. The authorities do not define the complete Task 5 source/effect schema, per-system capacity provenance, round-local versus event-durable evidence, or whether any station segment mutates Pressure before closeout beyond the already implemented domain transactions. No new schema may be invented here.

## 7. Pressure Breach

### CANONICAL

When a system would rise above its current capacity, the canonical consequence is:

```text
create one matching active Hazard
→ create one matching lasting Void Scar proposal
→ reset that system’s Pressure to 0
```

After unresolved Hazard closeout consequences and resulting breaches are processed, remaining ordinary Pressure resets to zero at event closeout. A Pressure Breach creates both a Hazard and a Void Scar; other Hazard sources do not automatically create a Void Scar.

### OPEN DECISION

The authorities do not define whether Task 5 evaluates breaches after every station effect, once after aggregation, after Hazard closeout, or in another order; how multiple systems are ordered; how upgrade prevention interacts with the atomic operation; or the exact durable event/audit/receipt schema. The milestone map calls this operation missing and requires one atomic consequence operation. Those ordering and evidence decisions are blocking.

## 8. Hazard lifecycle

### CANONICAL

Hazards can come from Pressure Breach, authored round/event development, Focus Failure/Critical Failure, Risk Bid consequence, or another Hazard escalating. A Pressure Breach creates a matching Hazard and Void Scar. Hazards may be system or event category, have authored activation timings, ongoing effects, response actions, limits, escalation/replacement policies, and countdowns. A system normally supports one active system Hazard. Hazard response units are CS `2 success`, S `1 success`, F `1 failure`, CF `2 failure`.

At closeout:

```text
Resolved Hazard    → no additional effect
Unresolved Hazard  → apply authored closeout consequence → remove Hazard
```

### OPEN DECISION

The full Task 5 lifecycle integration is not authoritative: exact persisted state transitions, reveal/visibility binding, progression/countdown timing, replacement versus escalation ordering, prevention interaction, and the boundary between Task 4 Hazard operations and Task 5 end-round operations are missing. The milestone map explicitly lists Hazard definition, active state, response actions, limits, countdowns, and closeout as work to add.

## 9. Consequence source binding

### CANONICAL

Consequences may be authored by station outcome branches, Risk Bids, Focus outcomes, Hazards, Pressure Breaches, event/round definitions, or closeout definitions where the relevant authority explicitly authors them. Narrative does not alter mechanics. Arbitrary numeric consequences are not a canonical source.

### DERIVABLE

Task 5 must use server-derived, immutable event-definition and persisted-evidence references. It must not accept caller-authored consequence values or allow a GM request to invent an unbounded numerical effect.

### OPEN DECISION

No canonical Task 5 candidate-selection rule or complete source precedence exists for competing station, Hazard, Pressure Breach, and round-level consequences. It is also unresolved whether any bounded GM selection is required before mutation. These decisions must be made explicitly.

## 10. Benefit source binding

### CANONICAL

Normal action benefits, authored Risk Bid benefits, Focus effects, reactions, upgrades, and cross-station effects are resolved by their owning action/effect contracts. Temporary station benefits, unconsumed Risk Bid benefits, and temporary restrictions are event-local. Persistent outcomes are staged for GM review and application.

### DERIVABLE

Task 5 must consume the authoritative Task 4 result/effect evidence once and must not duplicate Task 4 benefit application. It must preserve historical receipts and retain only effects explicitly defined to survive the transition.

### OPEN DECISION

The authorities do not provide a complete next-round benefit reset matrix or exact source schema for round-level benefits. Whether a particular benefit is consumed at closeout, carried into the next planning round, or made historical only must be authored before implementation.

## 11. Atomic round closeout

### DERIVABLE

Existing M11 architecture requires one authoritative mutation with hostile-safe capture, fresh rereads, monotonic revision, append-only event/audit history, processed-request idempotency, and final reread verification. Therefore aggregation, result, Momentum, Pressure/Breach effects, Hazard closeout effects, reset plan, round history, and next-state selection cannot be independently written as partially visible session states.

### OPEN DECISION

The gameplay order between Pressure update, breach evaluation, Hazard closeout, resulting consequences, and next-round preparation is not fully specified. The eventual contract must define this order and the exact atomic evidence. This clarification does not choose it.

## 12. Persisted result shape

### DERIVABLE semantic requirements

Task 5 evidence must survive reload and replay and be cross-bound to the accepted Task 4 evidence. It must include, at minimum as an eventual canonical schema: request identity; completed round identity; trusted station aggregate source evidence; derived units/result; Momentum before/after; Pressure before/after; breach/Hazard evidence; consequence/benefit evidence; next state; audit before/after; and an isolated stored response.

Existing M11 conventions require exact key order, immutable session/definition identity, expected/result revision bindings, authority epoch, event/audit linkage, and no caller-authored candidate or derived result.

### OPEN DECISION

Exact field names, key order, event kinds, audit kinds/details, receipt names, checkpoint kinds, and cross-bindings for the above evidence are not defined. No implementation schema is selected here.

## 13. Replay and idempotency

### DERIVABLE

Existing M11 rules force these outcomes once a Task 5 command exists:

```text
same requestId + same canonical request → isolated stored response, zero writes
same requestId + different canonical request → exact request conflict, zero writes
stale expected revision or authority epoch → stale rejection, zero writes
concurrent closeout → one coordinator winner; loser cannot write outside it
```

The request must identify the completed round as well as the session so a round N closeout cannot replay against round N+1.

### OPEN DECISION

No canonical round identity is currently defined, so the exact fingerprint tuple and round-specific conflict binding cannot yet be fixed.

## 14. Round identity

### CANONICAL

M12 authored definitions contain `roundId`, `roundNumber`, and an authored `roundCount` of `3`. These identify authored round content.

### OPEN DECISION

It is not specified which of `roundId`, integer `roundNumber`, a session revision range, or a composite is the authoritative runtime identity for replay, history, and stale requests. Do not infer that authored `roundId` alone is sufficient.

## 15. Next-round versus event-end

### CANONICAL

The event definition has three authored rounds. The general rules say the runner proceeds through authored rounds, then determines the overall result and enters event closeout review. The overall threshold for a three-round event is at least two successful rounds.

### OPEN DECISION

The exact Task 5 decision predicate is missing: whether continuation is solely based on authored round count, whether a terminal result can end early, how round failure/critical failure interacts with continuation, and the exact transition into Task 6’s event-closeout review are not operationally defined.

## 16. Next-round reset matrix

| State/evidence | Classification | Current authority |
|---|---|---|
| `resolutionComplete` | RESET/OPEN | Must cease to represent the completed round; exact next value is unspecified. |
| current station | RESET | No current acting station after resolution; exact sentinel is not specified. |
| pending checks | RESET | Resolved history remains; next-round pending checks must be newly authored. |
| reaction windows | RESET/OPEN | Current windows end; next-round opportunities are not fully specified. |
| station selections | RESET | New round actions must be selected. |
| Action choice | RESET | Round-local. |
| Approach choice | RESET | Round-local. |
| Risk Bid selection | RESET/HISTORICAL | Active choice clears; receipt/history retention is canonical but cross-round reuse is open. |
| proposed order | RESET | New round planning order. |
| committed order | RESET/HISTORICAL | Completed order remains history; next committed order is not yet present. |
| Focus resource balance | OPEN DECISION | No automatic refund is authorized; exact cross-round resource rule is not supplied. |
| Focus opportunity/consumption state | OPEN DECISION | Must distinguish resource from reaction opportunities. |
| Risk Bid receipts | HISTORICAL | Preserve accepted evidence; consumption/carryover is open. |
| dependency receipts | HISTORICAL/OPEN | Preserve history; next-round applicability is not fully defined. |
| station result receipts | HISTORICAL | Preserve exact completed-round evidence. |
| temporary benefits | RESET/OPEN | Temporary effects expire only where their authoring says so. |
| durable benefits | PERSIST | Preserve only authored durable effects. |
| Momentum | PERSIST | Carry post-round value into next qualifying checks; reset at event closeout. |
| Pressure | PERSIST/OPEN | Current event pressure continues until authored effects/closeout reset it; exact transition is open. |
| Hazards | PERSIST/OPEN | Active unresolved Hazards may carry according to authored timing; exact reset is open. |
| consequences | HISTORICAL/PERSIST | Preserve history; persistence requires authored source and later GM application boundary. |
| participant/station assignments | PERSIST | Task 5 does not reassign operators. |
| `recoveryControl` | OPEN DECISION | Durable recovery history must remain; current takeover/reset semantics are unspecified. |
| `authorityEpoch` | PERSIST | M11 authority continuity must not be rewritten. |
| `processedRequests` | PERSIST/HISTORICAL | Append-only; never clear for a new round. |
| events | PERSIST/HISTORICAL | Append-only. |
| audits | PERSIST/HISTORICAL | Append-only. |
| round history | PERSIST/HISTORICAL | Append the completed round exactly once. |

## 17. Focus reset semantics

### CANONICAL

Unused Focus disappears at event closeout. Focus is a limited operator resource and is distinct from reaction windows/opportunities.

### OPEN DECISION

The authorities do not define whether remaining Focus carries between rounds, refreshes, or changes only through authored effects, nor whether reaction opportunities are cleared and recreated at the next round. No automatic refund may be assumed.

## 18. Risk Bid reset semantics

### CANONICAL

Risk Bid is a choice attached to a station action in a round. Its authored effect and receipt are resolved by the owning action contract.

### OPEN DECISION

Cross-round reselectability, active-state reset, and the exact point at which selected bids become historical-only are not specified. Task 5 must not duplicate Task 4 application.

## 19. Recovery history

### DERIVABLE

Task 5 must preserve accepted Slice I `remaining-order`, `operator-takeover`, `void-roll`, and `retry-roll-integration` evidence. It must append its own events/audits and never rewrite prior recovery control or roll history. Current temporary control state may only change through an authorized M11 transition.

### OPEN DECISION

The authorities do not define whether `recoveryControl` is reset, carried, or re-established at next-round planning. That is separate from preserving durable history and must be decided.

## 20. Player/GM projection

### CANONICAL

The interaction contract allows current Momentum, visible Pressure, and revealed Hazards in shared projections. GM views may include hidden stakes, administrative data, and hidden Hazard details; player/observer views are filtered.

### OPEN DECISION

Task 5-specific visibility of round result, Pressure changes, breach/Void Scar proposals, Hazard closeout consequences, benefits, and next-round state is not fully defined. Hidden and unrevealed Hazard data must not be exposed until visibility rules are authored.

## 21. GM UI boundary

### CANONICAL

The product is GM-authoritative and persistent consequences are presented for GM review before application.

### OPEN DECISION

It is not defined whether Task 5 is one GM “close round” action with all values server-derived or requires a bounded authored GM decision. No UI or request options should be invented until this is decided.

## 22. Player UI boundary

### CANONICAL

Task 4 ends at `AWAITING ROUND CLOSEOUT`. Both GM and player projections must reflect that state. Task 5 owns the next-round transition.

### OPEN DECISION

The exact player/GM lifecycle presentation after closeout—new Crew Planning versus another intermediate state—and its projection fields are not defined.

## 23. Task 6 ownership boundary

### CANONICAL

Task 6 owns M10 closeout review/reservation/continuation/commit and persistent application. Task 5 must not implement final ship persistence, M10 ledger mutation, rewards/Misfortunes application, or Task 6 closeout review.

### OPEN DECISION

The exact point at which Task 5 determines that authored rounds are complete and hands off to Task 6, including whether it records an event-closeout-review request or only transitions to that lifecycle, is not operationally specified.

## 24. Zero/zero decision

This is a dedicated blocker. The canonical rules require an explicit authored fallback for `successUnits === 0 && failureUnits === 0` and prohibit ratio classification. No fallback category, authored source, or persistence binding exists in the inspected authorities.

## 25. Pressure/Hazard atomicity decision

The following links are canonical in isolation:

```text
Pressure above capacity → matching Hazard + matching Void Scar proposal + Pressure reset
Unresolved Hazard at closeout → authored consequence + Hazard removal
remaining ordinary Pressure after closeout effects → reset to zero
```

The missing link is the authoritative Task 5 ordering and atomic evidence binding among Pressure updates, breach detection, Hazard creation/prevention/replacement, Void Scar proposals, Hazard closeout consequences, and next-round transition. The milestone map explicitly requires this as one atomic consequence operation. This remains OPEN DECISION.

## 26. Proposed future Task 5 contract skeleton

The following headings are intentionally unresolved placeholders for the eventual contract:

- PURPOSE
- ENTRY STATE
- AUTHORITY — OPEN DECISION for exact GM/active-GM and transport vocabulary
- COMMAND/API — OPEN DECISION
- REQUEST — OPEN DECISION
- SERVER-DERIVED INPUTS — must be derived from validated Task 4 evidence
- ROUND AGGREGATION — canonical unit table; effect precedence OPEN DECISION
- ROUND RESULT — canonical ladder; zero/zero OPEN DECISION
- MOMENTUM — formula canonical; evidence/atomic integration OPEN DECISION
- PRESSURE — five IDs canonical; typed Task 5 schema OPEN DECISION
- PRESSURE BREACH — consequence chain canonical; ordering/evidence OPEN DECISION
- HAZARDS — source and closeout principles canonical; lifecycle integration OPEN DECISION
- CONSEQUENCES — source binding and precedence OPEN DECISION
- BENEFITS — owning-contract source and carryover OPEN DECISION
- ATOMIC MUTATION — M11 atomicity derivable; gameplay ordering OPEN DECISION
- PERSISTED HISTORY — exact schema OPEN DECISION
- REPLAY / CONTENTION — M11 derivations apply; round identity OPEN DECISION
- NEXT-ROUND DECISION — OPEN DECISION
- NEXT-ROUND RESET — matrix above requires decisions
- PROJECTIONS — visibility OPEN DECISION
- TASK 6 BOUNDARY — ownership canonical; exact handoff predicate OPEN DECISION
- TEST ACCEPTANCE — exact witnesses depend on the decisions above

## 27. Task 5 required decisions

1. **T5-DEC-01 — Round identity:** What exact identity binds a closeout request and historical record: authored `roundId`, integer `roundNumber`, a revision range, or a specified composite?
2. **T5-DEC-02 — Command/API:** What exact command literal, request key order, authority rule, and transport exposure represent one round-closeout mutation?
3. **T5-DEC-03 — Entry predicates:** What exact persisted predicates prove all occupied stations, skipped stations, pending checks, reactions, retries, and recovery state are complete?
4. **T5-DEC-04 — Zero/zero fallback:** Which authored result applies when both unit pools are zero, and where is that fallback authored?
5. **T5-DEC-05 — Effect precedence:** Can Focus, reactions, Risk Bids, or source-to-target effects alter round units, and in what canonical order?
6. **T5-DEC-06 — Pressure schema:** What complete typed Pressure source/effect schema and capacity provenance does Task 5 consume and persist?
7. **T5-DEC-07 — Breach ordering:** When and in what order are Pressure updates, breaches, prevention, Hazard/Void Scar creation, and resets evaluated, including multiple breaches?
8. **T5-DEC-08 — Hazard lifecycle:** What exact states, timing, reveal rules, replacement/escalation rules, closeout effects, and persistence rules apply at end of round?
9. **T5-DEC-09 — Consequence selection:** Are consequences fully server-derived, or may GM select from a bounded authored set, and what precedence binds candidates?
10. **T5-DEC-10 — Benefit carryover:** Which benefits are consumed, reset, historical-only, or carried into the next round?
11. **T5-DEC-11 — Focus reset:** Does remaining Focus carry, refresh, or change only by authored effects, and how are reaction opportunities recreated?
12. **T5-DEC-12 — Next-round/event-end:** What exact predicate selects another authored round versus Task 6 event-closeout review, including early terminal outcomes?
13. **T5-DEC-13 — Evidence schema:** What exact event, audit, checkpoint, receipt, response, and cross-binding schemas are persisted for closeout and transition?
14. **T5-DEC-14 — Projection visibility:** Which round result, Pressure, Hazard, consequence, benefit, and next-state fields are public, GM-only, or hidden?
15. **T5-DEC-15 — Recovery control:** What temporary `recoveryControl` state resets at the next round while preserving all Slice I history?

No recommended answers are made here. These are the shortest decisions required to implement without inventing mechanics or weakening M11/M12 boundaries.

## Repository boundary and report

- Clarification document created: this file only.
- Production files changed: zero.
- Tests changed: zero.
- Branch: `codex/gameplay-v3-12-task5-round-closeout`.
- Expected base/HEAD: `7f736fa707855f9f2973188a62a172c27c9a4671`.
- `styles/arcflight.css` is unrelated pre-existing work and was not modified.
- Protected review artifacts were not modified.
- Nothing was staged, committed, pushed, or sent to GitHub.
- `git diff --check` and status must be run after this document is added; no production/test validation is applicable to this clarification-only pass.

M12 TASK 5 CANONICAL ROUND-CLOSEOUT CLARIFICATION COMPLETE — READY FOR DESIGN DECISIONS
