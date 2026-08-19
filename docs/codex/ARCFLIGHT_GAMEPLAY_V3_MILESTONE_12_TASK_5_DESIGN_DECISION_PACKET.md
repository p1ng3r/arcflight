# Arcflight Gameplay V3 — M12 Task 5 Round-Closeout Design Decision Packet

Status: design decision packet only. Nothing in this document is approved authority or implementation.

This packet preserves the fifteen decision IDs and questions from the Task 5 clarification. Recommendations are explicitly non-authoritative and require user approval.

## T5-DEC-01 — Round identity

**QUESTION**  What exact identity binds a closeout request and historical record: authored `roundId`, integer `roundNumber`, a revision range, or a specified composite?

**CURRENT CANONICAL FACTS** M12 definitions contain `roundId`, `roundNumber`, and `roundCount`; M11 has session revisions. No single runtime round identity is chosen.

**WHY REQUIRED** Replay, stale requests, history, authored-definition lookup, and next-round separation need one unambiguous identity.

**OPTION A** Use authored `roundId` as the round identity; retain `roundNumber` only as display/order metadata and bind it to the authored definition.

**OPTION B** Use a composite `(roundId, roundNumber)` as the canonical identity.

**OPTION C** Use `(sessionId, roundNumber, completedRoundRevision)` as a runtime identity while retaining authored `roundId` only for lookup.

**ARCHITECTURAL CONSEQUENCES** A is smallest and aligns directly with immutable event content. B guards against malformed authored duplication. C adds runtime identity and more historical fields.

**GAMEPLAY CONSEQUENCES** A/B preserve authored round semantics. C makes revision part of gameplay evidence without changing results.

**PERSISTENCE / REPLAY CONSEQUENCES** A yields a compact fingerprint; B requires both fields in every record; C prevents replay across revisions most strongly but increases schema coupling.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** The authored immutable `roundId` already names the content, while M11 revision and session identity provide the concurrency binding.

## T5-DEC-02 — Command/API

**QUESTION**  What exact command literal, request key order, authority rule, and transport exposure represent one round-closeout mutation?

**CURRENT CANONICAL FACTS** Task 5 is GM-authoritative; no Task 5 command literal or request schema exists. M11 requires hostile capture, replay, stale checks, coordinator serialization, and one atomic mutation.

**WHY REQUIRED** A stable command and minimal request are needed for authorization, replay, transport, and persistence.

**OPTION A** One GM/active-GM-only `round-closeout` command with minimal identity/revision fields; all units, result, Momentum, Pressure, Hazards, and station degrees are server-derived.

**OPTION B** Separate `round-preview` and `round-commit` commands, with only the commit mutating the session.

**ARCHITECTURAL CONSEQUENCES** A matches one authoritative atomic mutation. B introduces a new durable preview boundary and a second replay surface.

**GAMEPLAY CONSEQUENCES** A prevents a stale client from submitting derived mechanics. B could expose a preview but requires preview freshness semantics.

**PERSISTENCE / REPLAY CONSEQUENCES** A needs one processed record/event/audit/checkpoint set. B needs preview identity, invalidation, and commit binding.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** It preserves least-authority requests and the accepted M11 mutation architecture without inventing a second gameplay phase.

## T5-DEC-03 — Entry predicates

**QUESTION**  What exact persisted predicates prove all occupied stations, skipped stations, pending checks, reactions, retries, and recovery state are complete?

**CURRENT CANONICAL FACTS** Task 4 ends at `resolutionComplete === true`, station-resolution/resolution. Unoccupied stations are skipped; unresolved checks and recovery are unsafe for closeout.

**WHY REQUIRED** Closeout must not aggregate partial or replay-pending station evidence.

**OPTION A** Require every occupied station to have exactly one finalized station result, every unoccupied station to have canonical skip evidence, no pending/retry check, no open reaction, and no recovery-required state.

**OPTION B** Require only `resolutionComplete === true` and trust Task 4 validation to imply all other predicates.

**ARCHITECTURAL CONSEQUENCES** A adds explicit validation witnesses; B minimizes fields but makes the boundary implicit and harder to audit.

**GAMEPLAY CONSEQUENCES** A blocks incomplete resolution deterministically. B risks aggregating a state that only appears complete.

**PERSISTENCE / REPLAY CONSEQUENCES** A cross-binds aggregate evidence to station records; B relies on a single flag and weakens tamper detection.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** It is the smallest safe interpretation of “resolution complete” under hostile reload and recovery.

## T5-DEC-04 — Zero/zero fallback

**QUESTION**  Which authored result applies when both unit pools are zero, and where is that fallback authored?

**CURRENT CANONICAL FACTS** The ratio ladder must not classify `0 / 0`; an explicit authored fallback is required, but no fallback exists in authority.

**WHY REQUIRED** The result controls Momentum, consequences, history, and continuation.

**OPTION A** Authored `round-neutral` fallback that changes neither success/failure counters nor Momentum.

**OPTION B** Authored fallback maps to Round Failure and applies normal failure handling.

**OPTION C** Authored fallback maps to Round Success and applies normal success handling.

**ARCHITECTURAL CONSEQUENCES** Each option requires a canonical result literal and authored placement in the event definition/result ladder.

**GAMEPLAY CONSEQUENCES** A creates a distinct neutral outcome; B/C alter Momentum and continuation in opposite directions.

**PERSISTENCE / REPLAY CONSEQUENCES** The selected fallback must be stored and cross-bound like every other round result.

**USER APPROVED — OPTION A — ROUND NEUTRAL

**RECOMMENDATION BASIS** The documents explicitly leave this decision open and do not constrain a neutral, success, or failure interpretation.

## T5-DEC-05 — Effect precedence

**QUESTION**  Can Focus, reactions, Risk Bids, or source-to-target effects alter round units, and in what canonical order?

**CURRENT CANONICAL FACTS** A station degree supplies the normal unit contribution. Effects are authored and resolved by their owning contracts; no complete unit-modification precedence is defined.

**WHY REQUIRED** Double application or conflicting effects would change round results and Momentum.

**OPTION A** Only finalized station degrees contribute units; Focus/reactions/Risk Bids may affect checks and authored benefits but cannot alter units unless a future explicit rule says so.

**OPTION B** Permit authored effects to modify units in a fixed server order: station degree, action/bid effect, Focus/reaction effect, then aggregate.

**ARCHITECTURAL CONSEQUENCES** A keeps Task 5 aggregation simple; B requires typed unit-modifier evidence and precedence validation.

**GAMEPLAY CONSEQUENCES** A preserves the current one-degree scoring model. B allows more expressive authored mechanics.

**PERSISTENCE / REPLAY CONSEQUENCES** B must persist every modifier source and applied order; A persists station results plus owning effect receipts.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** It avoids inventing a second scoring engine and respects existing action-outcome ownership.

## T5-DEC-06 — Pressure schema

**QUESTION**  What complete typed Pressure source/effect schema and capacity provenance does Task 5 consume and persist?

**CURRENT CANONICAL FACTS** Five IDs are canonical; default capacity is 2 and maximum is 5. The milestone map says typed Pressure integration is missing.

**WHY REQUIRED** Breach evaluation needs trusted current value, capacity, system identity, and source evidence.

**OPTION A** Minimal state only: each system record is `{ pressureSystemId, value, capacity }`; Task 5 persists effect evidence separately using existing canonical effect records.

**OPTION B** Add a typed definition/current-state pair with authored capacity source, display metadata, and effect provenance in the Task 5 record.

**ARCHITECTURAL CONSEQUENCES** A reuses current validation and limits new schema; B adds a definition registry and more cross-bindings.

**GAMEPLAY CONSEQUENCES** A supports existing numeric mechanics; B enables authored capacity variation and richer content.

**PERSISTENCE / REPLAY CONSEQUENCES** A is compatible with current session fields; B requires immutable definition snapshots and historical capacity evidence.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** It supplies the minimum state required by current rules without inventing UI or metadata fields.

## T5-DEC-07 — Breach ordering

**QUESTION**  When and in what order are Pressure updates, breaches, prevention, Hazard/Void Scar creation, and resets evaluated, including multiple breaches?

**CURRENT CANONICAL FACTS** A pressure breach creates a matching Hazard, a lasting Void Scar proposal, and resets that system to zero. The exact Task 5 ordering and atomic schema are missing.

**WHY REQUIRED** Persisting a breach without its dependent Hazard/Scar would expose invalid authoritative state.

**OPTION A** Apply all trusted round Pressure effects in canonical sequence order, evaluate each system breach after its final round-closeout value, resolve authored prevention, create Hazard/Scar proposal, reset that system, then persist one final atomic candidate.

**OPTION B** Aggregate all Pressure changes first, evaluate all breaches in canonical pressure-system order, then resolve dependent effects and persist atomically.

**ARCHITECTURAL CONSEQUENCES** A preserves effect order; B makes multi-system handling deterministic by registry order but may change authored timing.

**GAMEPLAY CONSEQUENCES** A allows an authored sequence to influence intermediate capacity; B treats the round as one batch.

**PERSISTENCE / REPLAY CONSEQUENCES** Both require one write and complete breach/effect evidence; B requires an explicit system-order rule.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** It follows the existing sequence/effect architecture while still preventing intermediate persistence.

## T5-DEC-08 — Hazard lifecycle

**QUESTION**  What exact states, timing, reveal rules, replacement/escalation rules, closeout effects, and persistence rules apply at end of round?

**CURRENT CANONICAL FACTS** Hazards may be active system/event problems with authored timings, effects, responses, limits, escalation/replacement policies, and closeout consequences. A generic complete lifecycle is explicitly missing.

**WHY REQUIRED** Task 5 must know what carries, resolves, reveals, or is removed.

**OPTION A** Minimum authored lifecycle: `active`, `resolved`, and removed; retain existing visibility/activation data and apply only the authored end-of-round rule.

**OPTION B** Add an explicit larger lifecycle including hidden, revealed, active, escalating, resolved, consumed, and expired states.

**ARCHITECTURAL CONSEQUENCES** A extends existing records minimally; B requires new validators, transitions, projections, and migration rules.

**GAMEPLAY CONSEQUENCES** A keeps behavior authored per Hazard; B enables general countdown/state mechanics.

**PERSISTENCE / REPLAY CONSEQUENCES** A needs only authored transition evidence; B expands historical and privacy schemas substantially.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** Current authority does not justify a generic state machine; the minimum lifecycle avoids speculative mechanics.

## T5-DEC-09 — Consequence selection

**QUESTION**  Are consequences fully server-derived, or may GM select from a bounded authored set, and what precedence binds candidates?

**CURRENT CANONICAL FACTS** Consequences are authored by actions, Risk Bids, Focus, Hazards, Pressure Breaches, event/round definitions, or closeout definitions. Arbitrary numerical editing is not canonical.

**WHY REQUIRED** The mutation must know whether the request contains a choice and how that choice is validated.

**OPTION A** Fully server-derived: deterministic authored consequence selection from validated evidence; GM confirms only the operation, not derived values.

**OPTION B** GM selects one candidate from a bounded authored candidate list; the server validates candidate identity and applies its canonical effects.

**ARCHITECTURAL CONSEQUENCES** A minimizes request fields and replay surface. B requires candidate list identity, selection binding, and stale candidate handling.

**GAMEPLAY CONSEQUENCES** A is deterministic; B gives bounded GM control without freeform mechanics.

**PERSISTENCE / REPLAY CONSEQUENCES** A stores derived source identity; B stores candidate-list and selected-candidate evidence.

**RECOMMENDATION — REQUIRES APPROVAL** Option A unless an authored event explicitly requires a bounded GM choice.

**RECOMMENDATION BASIS** Least-authority requests and deterministic replay are already required by M11.

## T5-DEC-10 — Benefit carryover

**QUESTION**  Which benefits are consumed, reset, historical-only, or carried into the next round?

**CURRENT CANONICAL FACTS** Task 4 owns action/Risk Bid/Focus effect application. Temporary station benefits and unconsumed Risk Bid benefits are event-local; persistent outcomes are staged for later GM application.

**WHY REQUIRED** Resetting a benefit incorrectly can duplicate or erase gameplay effects.

**OPTION A** Clear all round-local active benefits at transition, preserve receipts/history, and carry only benefits explicitly marked durable by their owning definition.

**OPTION B** Carry every unconsumed benefit into the next round until explicitly consumed or event closeout.

**ARCHITECTURAL CONSEQUENCES** A needs a durable marker already supplied by the owning definition. B requires active benefit identity, expiry, and stacking rules.

**GAMEPLAY CONSEQUENCES** A prevents accidental indefinite carryover. B increases cross-round interaction and balance surface.

**PERSISTENCE / REPLAY CONSEQUENCES** A preserves history without replaying effects; B requires active carryover records and consumption idempotency.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** It follows the temporary-versus-persistent distinction in the canonical rules.

## T5-DEC-11 — Focus reset

**QUESTION**  Does remaining Focus carry, refresh, or change only by authored effects, and how are reaction opportunities recreated?

**CURRENT CANONICAL FACTS** Focus resource and reaction opportunities are distinct. Unused Focus disappears at event closeout; no automatic refund is authorized. Cross-round semantics are not defined.

**WHY REQUIRED** Treating resource and opportunity as one state would duplicate or erase reactions.

**OPTION A** Preserve remaining Focus balance across rounds; clear round-local reaction opportunities and let next-round Task 4 author new opportunities.

**OPTION B** Refresh Focus at each round boundary and clear opportunities.

**OPTION C** Preserve Focus only through authored persistent/temporary effects; otherwise clear it at every round boundary.

**ARCHITECTURAL CONSEQUENCES** A reuses durable resource state and separates opportunity reset. B adds a refresh rule; C requires explicit effect provenance for all carryover.

**GAMEPLAY CONSEQUENCES** A rewards resource conservation; B increases available Focus; C makes authored effects decisive.

**PERSISTENCE / REPLAY CONSEQUENCES** A stores balance before/after and clears opportunity records; B records a refresh; C stores carryover authority.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** It preserves the distinction mandated by the packet and avoids an automatic refund.

## T5-DEC-12 — Next-round/event-end

**QUESTION**  What exact predicate selects another authored round versus Task 6 event-closeout review, including early terminal outcomes?

**CURRENT CANONICAL FACTS** M12 has three authored rounds; the general rules proceed through authored rounds, then overall result and event closeout review. Task 6 owns final closeout/application.

**WHY REQUIRED** The transition determines lifecycle, reset scope, projections, and Task 6 handoff.

**OPTION A** Continue while another authored round remains; after the final authored round, transition to `event-closeout-review`/Task 6 handoff without performing Task 6.

**OPTION B** Permit authored terminal round outcomes to end the event early; otherwise continue while rounds remain.

**ARCHITECTURAL CONSEQUENCES** A has a simple round-count predicate. B requires terminal-outcome vocabulary and early-closeout evidence.

**GAMEPLAY CONSEQUENCES** A always plays all authored rounds; B permits content-authored early endings.

**PERSISTENCE / REPLAY CONSEQUENCES** A binds next state to round count. B stores the terminal reason and authored source.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** The current event definition and roadmap describe a fixed authored round sequence and defer final closeout to Task 6.

## T5-DEC-13 — Evidence schema

**QUESTION**  What exact event, audit, checkpoint, receipt, response, and cross-binding schemas are persisted for closeout and transition?

**CURRENT CANONICAL FACTS** M11 requires exact key order, append-only history, revision/authority binding, replay records, checkpoints, and final reread verification. Task 5-specific schemas do not exist.

**WHY REQUIRED** Reload, replay, recovery, and tamper rejection cannot be implemented without exact shapes.

**OPTION A** Add one canonical round-closeout runtime event, one audit, one transition checkpoint, and one processed request record containing server-derived aggregate/effect evidence and the isolated response.

**OPTION B** Persist separate records for aggregation, Momentum, Pressure/Breaches, Hazard closeout, and transition, all under one atomic revision.

**ARCHITECTURAL CONSEQUENCES** A minimizes event vocabulary and validation. B increases evidence granularity and cross-binding burden.

**GAMEPLAY CONSEQUENCES** A presents one coherent transition. B makes sub-effects individually inspectable.

**PERSISTENCE / REPLAY CONSEQUENCES** A is simpler to replay and recover. B requires exact ordering and duplicate prevention for every sub-record.

**RECOMMENDATION — REQUIRES APPROVAL** Option A.

**RECOMMENDATION BASIS** One atomic authoritative mutation is already derivable and avoids exposing partially applied closeout stages.

## T5-DEC-14 — Projection visibility

**QUESTION**  Which round result, Pressure, Hazard, consequence, benefit, and next-state fields are public, GM-only, or hidden?

**CURRENT CANONICAL FACTS** Shared projections may expose current Momentum, visible Pressure, revealed Hazards, and public round information. Hidden stakes and hidden Hazard details remain GM-only/filtered.

**WHY REQUIRED** Closeout evidence may contain secrets, unrevealed Hazards, and private consequence details.

**OPTION A** Publicly expose round result, Momentum, public Pressure values/effects, revealed Hazards, and next lifecycle; keep hidden Hazard, private consequence, and GM candidate details GM-only.

**OPTION B** Keep all new closeout details GM-only until Task 6 review, exposing only lifecycle and already-public values.

**OPTION C** Reveal each field according to its authored visibility, including conditional Hazard/consequence disclosure.

**ARCHITECTURAL CONSEQUENCES** A extends existing projection fields; B minimizes exposure; C requires per-field visibility metadata and projection tests.

**GAMEPLAY CONSEQUENCES** A gives players meaningful round feedback. B limits information. C follows authored secrecy most precisely.

**PERSISTENCE / REPLAY CONSEQUENCES** A/B can use filtered projections; C requires visibility evidence bound to each effect.

**RECOMMENDATION — REQUIRES APPROVAL** Option C where authored visibility exists; otherwise Option A for already-public values.

**RECOMMENDATION BASIS** It preserves hidden Hazard information and avoids turning private evidence into public state.

## T5-DEC-15 — Recovery control

**QUESTION**  What temporary `recoveryControl` state resets at the next round while preserving all Slice I history?

**CURRENT CANONICAL FACTS** Slice I recovery history is durable and append-only. Temporary operator takeover/control state is distinct from historical audit evidence; exact round-boundary reset is unspecified.

**WHY REQUIRED** A disconnected operator must not lose durable history, while stale temporary control must not grant unintended next-round authority.

**OPTION A** Preserve the current takeover until explicitly released or replaced by an authorized control-transfer command.

**OPTION B** Reset temporary takeover/control at the round boundary; require fresh canonical operator resolution for the next round.

**OPTION C** Preserve takeover only through a bounded recovery lease with an authored expiry at the next round.

**ARCHITECTURAL CONSEQUENCES** A minimizes transitions; B adds a clean authority boundary; C adds lease timestamps and expiry validation.

**GAMEPLAY CONSEQUENCES** A preserves continuity for disconnected operators. B may require reconnection/reassignment. C balances continuity and expiry but adds a new mechanic.

**PERSISTENCE / REPLAY CONSEQUENCES** All options preserve historical audits; B/C require a new transition or expiry evidence and replay rules.

**RECOMMENDATION — REQUIRES APPROVAL** Option B.

**RECOMMENDATION BASIS** A round boundary is a clear safety point for temporary authority while preserving the accepted durable takeover history.

## Decision dependencies

Recommended dependency order:

1. T5-DEC-01 (round identity) and T5-DEC-02 (command/API).
2. T5-DEC-03 (entry predicates) and T5-DEC-04 (zero/zero fallback).
3. T5-DEC-05 (effect precedence), then T5-DEC-06 (Pressure schema).
4. T5-DEC-07 (Breach ordering), then T5-DEC-08 (Hazard lifecycle).
5. T5-DEC-09 (consequence selection) and T5-DEC-10 (benefit carryover).
6. T5-DEC-11 (Focus reset), then T5-DEC-12 (next-round/event-end).
7. T5-DEC-13 (evidence schema), T5-DEC-14 (visibility), and T5-DEC-15 (recovery control).

T5-DEC-01 constrains fingerprints and T5-DEC-13. T5-DEC-04 and T5-DEC-05 constrain Momentum and T5-DEC-12. T5-DEC-06 through T5-DEC-10 constrain the evidence and atomicity in T5-DEC-13. T5-DEC-12 and T5-DEC-15 constrain reset and projection behavior.

## Recommended approval order

### FOUNDATION

T5-DEC-01, T5-DEC-02, T5-DEC-03.

### ROUND MECHANICS

T5-DEC-04, T5-DEC-05.

### PRESSURE / HAZARDS

T5-DEC-06, T5-DEC-07, T5-DEC-08, T5-DEC-09, T5-DEC-10.

### ROUND TRANSITION

T5-DEC-11, T5-DEC-12, T5-DEC-15.

### VISIBILITY / PERSISTENCE

T5-DEC-13, T5-DEC-14.

## Recommendation summary

- Recommendations for Option A: 12 (T5-DEC-01, 02, 03, 05, 06, 07, 08, 09, 10, 11, 12, 13).
- Recommendations for Option B: 1 (T5-DEC-15).
- Recommendations for Option C: 0 as a sole recommendation.
- User approval: T5-DEC-04 is Option A (round-neutral); T5-DEC-14 is Option C with Option A fallback.
All fifteen decisions are user-approved; no decision remains pending.

## Final approval table

| Decision ID | Short question | Options | Recommended option | Status |
|---|---|---|---|---|
| T5-DEC-01 | Round identity | A/B/C | USER APPROVED — A | APPROVED |
| T5-DEC-02 | Command/API | A/B | USER APPROVED — A | APPROVED |
| T5-DEC-03 | Entry predicates | A/B | USER APPROVED — A | APPROVED |
| T5-DEC-04 | Zero/zero result | A/B/C | USER APPROVED — A — ROUND NEUTRAL | APPROVED |
| T5-DEC-05 | Effect precedence | A/B | USER APPROVED — A | APPROVED |
| T5-DEC-06 | Pressure schema | A/B | USER APPROVED — A | APPROVED |
| T5-DEC-07 | Breach ordering | A/B | USER APPROVED — A | APPROVED |
| T5-DEC-08 | Hazard lifecycle | A/B | USER APPROVED — A | APPROVED |
| T5-DEC-09 | Consequence selection | A/B | USER APPROVED — A | APPROVED |
| T5-DEC-10 | Benefit carryover | A/B | USER APPROVED — A | APPROVED |
| T5-DEC-11 | Focus reset | A/B/C | USER APPROVED — A | APPROVED |
| T5-DEC-12 | Next round/event end | A/B | USER APPROVED — A | APPROVED |
| T5-DEC-13 | Evidence schema | A/B | USER APPROVED — A | APPROVED |
| T5-DEC-14 | Projection visibility | A/B/C | USER APPROVED — C WITH OPTION A FALLBACK | APPROVED |
| T5-DEC-15 | Recovery control | A/B/C | USER APPROVED — B | APPROVED |

## Repository boundary

- Expected new file: this document only.
- Production files changed: zero.
- Tests changed: zero.
- Clarification document was not modified.
- Branch: `codex/gameplay-v3-12-task5-round-closeout`.
- Base/current HEAD: `7f736fa707855f9f2973188a62a172c27c9a4671`.
- `styles/arcflight.css` and all protected artifacts remain untouched.
- Nothing is staged, committed, pushed, merged, or sent to GitHub.

M12 TASK 5 DESIGN DECISION PACKET COMPLETE — READY FOR USER APPROVAL
