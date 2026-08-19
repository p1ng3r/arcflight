# Arcflight Gameplay V3 â€” M12 Task 5 Round-Closeout Contract

Status: authoritative implementation contract for M12 Task 5. This document defines the approved round-closeout slice; it does not implement runtime behavior.

## 1. Purpose

Task 5 performs one authoritative completed-round aggregation and transition. It consumes accepted Task 4 station-resolution evidence, derives the round result and round effects, then either transitions the same Event Session to the next authored round or hands the final authored round to Task 6 through `event-closeout-review`.

Task 5 does not execute station checks, rerolls, PF2e resolution, Task 6 final Event closeout, M10 ship persistence, or persistent application.

## 2. Entry state

The only legal entry state is:

```text
resolutionComplete === true
sessionState === "station-resolution"
encounterState.lifecycleState === "active"
encounterState.phase === "resolution"
pendingThresholdQueue.length === 0
```

The session must remain active and its current authored `roundId` must match the active round definition. Every occupied station must have exactly one finalized canonical station result. Every unoccupied station must have canonical skip evidence. There must be no unresolved executable station check, pending retry check, unresolved retry integration, open required reaction window, unresolved recovery-required state, or nonempty `pendingThresholdQueue`. Expected revision and authority epoch must be valid at the final reread.

A nonempty threshold queue rejects before aggregation with the exact existing failure envelope and zero JournalEntry, Actor, Item, M10, or gameplay writes. Task 5 never consumes, clears, carries, repairs, or hands unresolved threshold entries to Task 6. `thresholdHistory` remains durable historical evidence.

Incomplete, malformed, stale, hostile, or repaired-on-load state fails closed with the existing exact M11 failure envelope and zero writes. `resolutionComplete` alone is insufficient.
## 3. Authority

`round-closeout` is GM/active-GM only. No player, crew, operator, observer, or Player RPC may invoke it. The implementation uses the existing M11 authenticated transport, active-GM checks, trusted connection witness, and exclusive cross-client mutation coordinator. A local mutex may remain defense-in-depth only.

## 4. Command

The exact command envelope uses the existing M11 command root key order:

```js
{
  kind: "voyage.m11-command",
  requestId,
  sessionId,
  expectedRevision,
  authorityEpoch,
  commandKind: "round-closeout",
  payload: { roundId }
}
```

The exact root key order is `kind`, `requestId`, `sessionId`, `expectedRevision`, `authorityEpoch`, `commandKind`, `payload`. The exact payload key order is `roundId`. `roundId` is the only client-supplied gameplay identity. The request contains no derived units, result, Momentum, Pressure, Breach, Hazard, consequence, benefit, PF2e degree, station result, next-state, role, authority, receipt, candidate, or fingerprint data.

Hostile-safe capture precedes semantic validation. Missing, extra, reordered, inherited, accessor-backed, proxy, cyclic, sparse, non-plain, nonfinite, or unsafe values fail with existing M11 request diagnostics and zero writes. `roundNumber` is not accepted in the payload and cannot override the authored binding.

## 5. Round identity and replay precedence

The authored immutable `roundId` is the canonical round identity. `roundNumber` is display/order metadata bound to that authored round definition. `sessionId`, M11 `revision`, and `authorityEpoch` provide runtime identity, replay, and concurrency binding.

The server resolves the immutable definition snapshot and safely validates enough command-envelope identity to locate the processed-request journal. Processed-request lookup by `requestId` occurs before active-round, entry-state, revision, or authority mutation validation.

If a processed record exists, the server compares the complete canonical request identity and payload, including `sessionId`, authenticated principal/role, command kind, `roundId`, expected revision, and authority epoch. An exact match returns the stored isolated response immediately, with no active-round equality requirement, no new mutation validation, and no new revision, event, audit, checkpoint, Momentum, Pressure, Breach, Hazard, consequence, benefit, or transition. A changed request under the same ID returns the existing replay/conflict diagnostic with zero writes.

Only an unprocessed request proceeds to new-mutation validation. It must match the active authored `roundId`, current revision, current authority epoch, GM authority, and all Task 5 entry predicates. A new request for old round A while the session has advanced to round B rejects with zero writes; it cannot mutate or replay against round B.
## 6. Station unit aggregation

Task 5 consumes final canonical station degrees already persisted by Task 4. It does not reroll, re-resolve, reinterpret PF2e results, or accept client totals.

```text
Critical Success â†’ 2 success units
Success          â†’ 1 success unit
Failure          â†’ 1 failure unit
Critical Failure â†’ 2 failure units
Skipped station  â†’ 0 units
```

Only occupied finalized station results contribute. Focus, reactions, Risk Bids, and source-to-target effects may influence their owning check or authored effects but do not independently modify round-unit totals. Task 5 does not create a second scoring engine.

The event evidence records the ordered source station result identities and the derived `successUnits` and `failureUnits`. These values are server-derived and cross-bound to the Task 4 records.

## 7. Round result

For nonzero unit pools, apply this exact ladder:

```text
Critical Round Success: successUnits >= 2 Ã— failureUnits
Round Success:          successUnits >= failureUnits, but not critical
Critical Round Failure: failureUnits >= 2 Ã— successUnits
Round Failure:          failureUnits > successUnits, but not critical
```

When both pools are zero, the result is exactly `round-neutral`. `round-neutral` is not success or failure, does not increment either successful-round or failed-round counters, changes Momentum by zero, and does not execute success-result or failure-result consequences. Independently valid Pressure, Breach, Hazard, authored station, or durable-benefit effects still resolve according to their own rules.

The persisted result is never null, missing, or silently normalized to another category.

## 8. Momentum

Momentum starts at `0`, has a normal range of `0..3`, and is applied atomically with closeout:

```text
Round Success or Critical Round Success â†’ +1, maximum 3
Round Failure or Critical Round Failure â†’ -1, minimum 0
round-neutral                          â†’ 0
```

The resulting value applies beginning with the next qualifying check. Task 5 preserves the post-round value when continuing. Momentum is reset to zero only by Task 6/Event closeout, not at the final-round Task 5 handoff. Exact replay returns the stored post-transition value without reapplying the step.

## 9. Pressure

Active Pressure state is exactly:

```js
{
  pressureSystemId,
  value,
  capacity
}
```

Allowed identifiers are `crew-morale`, `arkengine`, `levstone-array`, `solar-sail-rig`, and `lifeveil`. Default capacity is `2`; maximum capacity is `5`. Task 5 does not create a second definition registry, duplicate display metadata, or duplicate effect provenance. Pressure effect evidence remains in canonical event/audit/effect history.

The canonical Pressure effect identity is the existing `pressureEffectId`, bound with `sourceIntentId`, `sourceKind`, `timing`, `activationSource`, `sequence`, encounter/event identity, authored stage and round, pressure system, and effect value. No parallel Task 5 identity is permitted.

Task 4-applied Pressure is identified by its already persisted canonical Task 4 event/effect evidence and is summarized and cross-bound only; it is never re-applied at round closeout. An eligible Task 5 closeout effect must use the existing closeout source model: `sourceKind: "hazard-closeout"`, `timing: "gm-confirmed"`, `activationSource: "event-closeout"`, valid sequence, and the exact authored source identity. Each eligible `pressureEffectId` may be consumed exactly once. A duplicate, forged, wrong-round, wrong-system, wrong-source, or wrong-timing effect rejects persisted history and performs zero writes.

A replay returns its stored response and never consumes a source again. A later round cannot consume a prior round's source. Runtime evidence cannot reclassify a Task 4-applied source as a Task 5 closeout source.
## 10. Pressure Breaches

Within one closeout candidate, process the following exact order:

1. Collect trusted round Pressure effects.
2. Process them in canonical authored/effect sequence order.
3. Compute the affected systemâ€™s final closeout Pressure value.
4. Evaluate that system for Breach.
5. Resolve authored prevention or mitigation applicable to that Breach.
6. Derive the canonical Breach consequence.
7. Derive authored Hazard and Void Scar creation or activation.
8. Apply the canonical Pressure reset/change required by the Breach rule.
9. Continue with later effects or independently produced systems.
10. Persist one final atomic candidate.

A Breach creates one matching active Hazard, one matching lasting Void Scar proposal, and resets that systemâ€™s Pressure to zero unless the canonical authored prevention/mitigation changes the applicable result. Multiple Breaches are allowed only when independently produced by the ordered effect sequence. No arbitrary Pressure-system ordering may replace authored effect order.

Pressure Breach, Hazard, and Void Scar are distinct dependent outcomes. Authored prevention may prevent or alter the Hazard only when its owning rule says so; it does not erase the Pressure Breach, the matching Void Scar proposal/effect, or the canonical Pressure reset/change unless that rule explicitly targets that specific outcome. Void Scar is not a Hazard lifecycle state and is never represented merely as `active`, `resolved`, or `removed` Hazard evidence.

No intermediate persistence may expose a breached Pressure value without its dependent Hazard, consequence, Scar proposal, and reset evidence.

## 11. Hazards

Task 5 uses only the minimum authored lifecycle concepts `active`, `resolved`, and `removed`. Existing visibility, reveal, activation, timing, source, and effect evidence remains authoritative. Task 5 does not introduce a generic hidden/revealed/escalating/consumed/expired state machine.

Task 5 applies only authored end-of-round Hazard behavior and does not duplicate Hazard effects already executed during Task 4 Action Segments. Resolved or removed Hazard evidence remains durable. An unresolved Hazard applies its authored closeout consequence and is removed; a resolved Hazard has no additional closeout effect.

Authored visibility is preserved. Hidden Hazard mechanics remain hidden until their authored reveal predicate is satisfied.

## 12. Consequences

Consequences are fully server-derived from validated immutable event, round, station, Risk Bid, Focus, Pressure, and Hazard evidence. The GM confirms the closeout operation but does not submit consequence IDs, damage, modifiers, conditions, numerical values, or Hazard effects.

If an explicitly authored definition supplies a bounded candidate choice, only its validated candidate ID may be used. There is no generic GM consequence editor. Deterministic authored/effect sequence order is the precedence source; the resulting consequence evidence is cross-bound to its source.

## 13. Benefits

At transition, clear active round-local benefits. Preserve receipts, history, consumed evidence, and source-to-target application evidence. Carryover is authoritative only from the owning authored effect definition, using the exact `persistence` field with allowed values `round-local`, `next-round`, and `event`; omission means `round-local`.

- `round-local`: clear at a continuing-round transition.
- `next-round`: carry through exactly one following authored round, then expire unless consumed sooner.
- `event`: carry across authored rounds until consumed or Task 6/Event closeout.
- consumed: never reactivate.

Mutable runtime state and clients cannot author persistence. A persisted `benefitTransition` whose `persistence` differs from the owning immutable effect definition, or whose source binding is wrong, is invalid. Task 5 never reapplies Task 4 benefits and exact replay never duplicates carryover.

The immutable Event definition is the only production source of `persistence`; the implementation must expose that authored field through its validated definition schema before a benefit can be carried. Omission is canonical `round-local`. An unconsumed benefit is not thereby durable: only an authored `next-round` or `event` value permits carryover, with the exact expiry rules above. Runtime state, a processed request, or a client cannot infer, upgrade, or substitute persistence.
## 14. Focus

Preserve remaining Focus resource balance across rounds. Do not refund, refresh, reset to maximum, or zero Focus automatically. Clear only completed-round reaction/opportunity state; the next roundâ€™s Task 4 flow creates new opportunities normally. Focus spend history remains durable. Focus balance may change only through existing canonical mechanics or explicit authored effects.

## 15. Risk Bid

Completed-round Risk Bid selections become historical evidence after closeout. Active next-round planning starts without the previous roundâ€™s active selection unless the next authored round independently offers and selects a new bid. Preserve prior receipts, source identity, tier, DC, and effect history. A previous-round Risk Bid cannot affect next-round checks.

## 16. Recovery

Preserve all Slice I recovery history, including takeover audits, recovery events, authority transitions, remaining-order corrections, void evidence, retry relationships, and recovery receipts. At a continuing next-round boundary only, reset temporary `recoveryControl` and emergency-takeover state. Do not carry temporary GM/operator takeover authority automatically. Station assignments do not change merely because `recoveryControl` resets. Fresh next-round operator authority uses normal canonical ownership and assignment rules.

At the final Task 6 handoff, do not apply this continuing-round reset merely because Task 5 completed. Preserve the recovery/control evidence needed for Task 6 review; historical recovery evidence always remains append-only.
## 17. Atomic mutation

One `round-closeout` request executes this single exclusive mutation sequence:

```text
hostile capture and root validation
→ authenticated active-GM/connection validation
→ exact session resolution and complete reload validation
→ safe processed-request lookup by requestId
→ exact replay return or replay/conflict rejection, if a record exists
→ for an unprocessed request: active-round/entry-state/revision/authority validation
→ aggregate canonical station units
→ derive round result
→ derive Momentum transition
→ process ordered Pressure effects
→ evaluate and derive Breaches
→ derive Hazard/Scar effects
→ derive server-authored consequences
→ clear/carry benefits from authored persistence
→ preserve Focus and clear reaction state
→ clear active Risk Bid selection
→ reset temporary recoveryControl only if continuing
→ derive next-round or Task 6 handoff state
→ append one runtime event, one audit, one checkpoint, and one processed record
→ perform one JournalEntry update
→ reread and verify the complete candidate
```

All candidate data is isolated before the sole write. A nonempty threshold queue, failed replay check, stale, hostile, malformed, rejected, thrown, or uncertain operation returns the exact existing diagnostic, performs zero speculative second writes, and never exposes a partial candidate.
## 18. Replay and contention

Use existing M11 semantics with this required precedence:

1. Validate only enough hostile-safe envelope identity to identify the session and request ID.
2. Authenticate the trusted active GM/connection required to read the processed-request journal.
3. Locate the processed record by `requestId` before active-round, entry-state, current-revision, or authority mutation validation.
4. If found, compare the full canonical request identity and payload. Exact match returns the isolated stored response with zero writes; mismatch returns the canonical replay/conflict diagnostic with zero writes.
5. Only if no record exists, validate active authored `roundId`, current revision, authority epoch, GM authority, and Task 5 entry predicates, then derive and mutate state.

Exact replay remains valid after round A has transitioned to round B. It does not require active-round equality and does not create a second transition, revision, event, audit, checkpoint, Momentum update, Pressure application, Breach, Hazard, consequence, or benefit carry. A new request ID for old round A while round B is active rejects with zero writes. A changed request under the old request ID conflicts even if it would otherwise be stale or target a current round.

The canonical fingerprint binds session identity, authenticated principal, projection role, authority epoch, expected revision, command kind, and payload `{ roundId }`. Reused IDs with changed round ID, session ID, revision, epoch, principal, role, command kind, or any allowed request field conflict. Stale new requests reject with the existing stale diagnostics. Concurrent closeout has one coordinator winner; the loser cannot write outside the coordinator.
## 19. Complete reset and handoff matrix

The following classifications use the existing encounter-state meanings and apply separately to the continuing path and final Task 6 handoff.

| Field | Continuing next round | Final Task 6 handoff |
|---|---|---|
| `currentStage` | Preserve the existing authoritative stage exactly; do not derive, clear, or replace it from `roundId`, `roundNumber`, or other round metadata. | Preserve the final authoritative stage exactly for Task 6 inspection; do not initialize a new stage. |
| `currentSituation` | Reinitialize from the next authored round. | Preserve final situation evidence. |
| `objective` | Reinitialize from the next authored round. | Preserve final objective evidence. |
| `availableStations` | Reinitialize from the next authored round definition. | Preserve final-round authored station evidence. |
| `targets` | Reset active planning/target bindings; next round derives new targets. | Preserve final target evidence needed for review; no new targets. |
| `riskBids` | Clear active selections; preserve receipts/history. | Preserve final selected bid evidence; no new selection. |
| `assistance` | Reset active planning assistance; preserve completed evidence. | Preserve final assistance evidence required by review. |
| `reservations` | Reset active planning reservations; preserve completed evidence. | Preserve final reservation evidence required by review. |
| `pendingConsequences` | Clear only completed-round executable pending state after all entry predicates pass. | Preserve any final-round review evidence; do not silently clear unresolved work. |
| `tracks` | Preserve the complete authoritative `tracks` array exactly; do not reset, delete, reconstruct, or invent round-ownership metadata. | Preserve the complete authoritative `tracks` array and values for Task 6 review. |
| `thresholdHistory` | Persist as historical evidence; never clear. | Persist as historical evidence; never clear. |
| `pendingThresholdQueue` | Must already be empty; Task 5 does not consume, clear, or carry it. | Must already be empty; final handoff is illegal otherwise. |
| `resolutionComplete` | Reset for the next round. | Preserve completed final-round evidence; no new planning state. |
| current acting station | Clear. | Preserve final evidence only; no active station. |
| pending checks/retry state | Clear executable state after completion. | Preserve final evidence needed for review; no retry mutation. |
| reaction windows/opportunities | Clear; next round creates new opportunities. | Preserve final evidence; do not create new windows. |
| active Action/Approach | Clear. | Preserve final selections as historical evidence. |
| active Risk Bid | Clear; receipt/history remains. | Preserve final selection evidence. |
| proposed/committed order | Clear for next planning; completed order remains history. | Preserve final order evidence; do not create a new order. |
| round-local benefits | Clear. | Preserve final evidence; Task 6 owns final cleanup. |
| `recoveryControl`/emergency takeover | Reset only here. | Preserve Task 6-required control evidence; do not auto-reset. |
| Focus balance | Persist. | Preserve. |
| Momentum | Persist post-round value. | Preserve; Task 6 resets at Event closeout. |
| Pressure/effect history | Persist according to canonical effects. | Preserve final evidence. |
| active Hazards | Apply only authored continuing behavior; preserve durable history. | Preserve final Hazard evidence and authored closeout state. |
| station-result/Risk Bid/dependency/Focus receipts | Preserve historical evidence. | Preserve for Task 6 review. |

If an existing field does not map to a row above, the operation fails closed rather than inventing parallel state.
## 20. Next round

If another authored round exists, the same Event Session transitions to the next authored `roundId` and canonical start-of-round/Crew Planning state. No second Event Session is created. The continuing reset matrix applies, including reset of temporary `recoveryControl`, and the new authored title, situation, objective, and stations are loaded from the immutable definition. The existing authoritative `currentStage` and complete `tracks` state are preserved exactly; Task 5 does not invent a stage source or track lifecycle. Old round pending checks and actions become unexecutable; old requests with new IDs reject by round identity, revision, and lifecycle binding.
## 21. Final round and Task 6 handoff

If no authored next round exists, Task 5 persists the completed final-round closeout and transitions the same Event Session to `event-closeout-review` with active encounter lifecycle and `phase: "cleanup-advance"`, using the existing lifecycle mapping. It does not initialize a new round or apply continuing-round cleanup.

The final handoff preserves final station results and aggregate, round result, Momentum, Pressure, Breaches, Hazards, consequences, benefits, Focus/resource state, Risk Bid and dependency evidence, recovery history, audit/event/checkpoint history, and all evidence required by Task 6 review. `pendingThresholdQueue` must be empty before either path.

Task 6 owns final Event/voyage closeout, M10 closeout review/reservation/continuation/commit, persistent ship state, final Event result processing, and Event Session retirement. Task 5 does not finalize M10, delete or retire the session, write final voyage completion, reset Momentum for Event closeout, or perform Task 6 application.
## 22. Projections

Authored visibility always wins when the owning Event, Hazard, consequence, or benefit definition provides an explicit visibility rule. Otherwise, server-side filtered projections use these defaults.

### Public/shared

- round result;
- Momentum;
- public Pressure values and effects;
- revealed or known Hazards;
- public consequences;
- public benefits;
- next lifecycle;
- next authored round identity and display information needed for Crew Planning.

### GM-only/hidden

- unrevealed Hazards and hidden Hazard mechanics;
- private consequences;
- private benefit details;
- GM-only authored candidate data;
- raw audits;
- raw receipts;
- `processedRequests`;
- trusted authority metadata;
- internal replay/history validation structures.

Conditionally revealed authored data becomes public only when its authored visibility/reveal predicate is satisfied. Projection filtering is server-side; CSS and Handlebars are not security boundaries.

## 23. GM UI

The semantic UI requirement is one legal GM round-closeout action when the entry state is complete. The UI does not accept manual result, Momentum, Pressure, Hazard, consequence, or benefit fields. It does not make gameplay authority decisions client-side.

## 24. Player UI

Before Task 5, projections present `AWAITING ROUND CLOSEOUT`. After continuation, projections present the new-round Crew Planning state. After the final authored round, projections present the Event awaiting Task 6 review. No new Player tab is required by this contract.

## 25. Hostile input and zero-write behavior

The request and all persisted candidates reject caller-supplied or forged:

```text
successUnits, failureUnits, roundResult, Momentum, Pressure,
Breach, Hazard, consequence, benefit, roundNumber override,
station degree/result, PF2e total, next-state override,
role/GM claims, receipts, candidates, events, audits, checkpoints,
response, fingerprint, revision, authority, or transport/coordinator data.
```

Getters, setters, proxies, cycles, unsafe keys, inherited fields, symbols, functions, BigInts, undefined, nonfinite numbers, Dates, Maps, Sets, sparse arrays, malformed roots, and deep hostile values fail closed. Caller inputs, candidates, stored evidence, and returned responses are isolated. Every failure path performs zero JournalEntry, Actor, Item, M10, socket, UI, or gameplay writes.

## 26. History validation

Reload validation cross-binds the accepted Task 4 station evidence, closeout request, authored `roundId`, `roundNumber` definition binding, runtime event, audit, `before-round-closeout` checkpoint, stored response, aggregate/result, Momentum transition, Pressure effects/Breaches, Hazard effects, consequences, benefits, and next lifecycle.

The canonical stored record uses the existing M11 processed-request key order:

```text
requestId, principalUserId, projectionKind, fingerprint,
commandKind, resultKind, resultRevision, response
```

The canonical round-closeout record has `commandKind: "round-closeout"`, `resultKind: "round-closeout-completed"`, and a response whose status equals the persisted next session state. The fingerprint is the existing M11 canonical tuple over session identity, authenticated principal, GM projection role, authority epoch, expected revision, command kind, and payload `{ roundId }`.

The runtime event type is `voyage.m12-round-closeout`. Its exact key order is:

```text
type, sessionId, eventId, definitionSnapshotId, shipId,
roundId, roundNumber, previousRevision, revision,
previousAuthorityEpoch, authorityEpoch,
previousSessionState, nextSessionState, previousPhase, nextPhase,
stationResultIds, successUnits, failureUnits, roundResult,
momentumBefore, momentumAfter, pressureBefore, pressureAfter,
pressureEffects, breaches, hazardEffects, consequenceEffects,
benefitTransition, focusTransition, riskBidTransition,
recoveryControlTransition, nextRoundId
```

`nextRoundId` is the next authored identity when continuing and `null` at final handoff. All nested arrays and records are dense, exact-key-order, canonical captured data. `previousRevision + 1 === revision`; the event revision equals the processed record result revision and audit revision.

The event `stationResultIds`, `successUnits`, and `failureUnits` form one exact source-bound unit tuple: IDs are dense, unique, authored-order references to the finalized Task 4 station-result records for this `roundId`; each referenced station-result record is validated by the existing canonical Task 4 station-result validator and exact key order, and the set is bounded by the canonical station roster for the round; the two unit counts are nonnegative safe integers derived only from those records and must equal the canonical degree mapping. `momentumBefore`/`momentumAfter` are nonnegative safe integers in `0..3`, with their delta bound exactly to `roundResult`; they are the complete Momentum transition evidence and are not client-authored. `nextRoundId`, `nextSessionState`, and `nextPhase` are bound to either the resolved immutable next-round definition or the exact final `event-closeout-review` handoff; no other next-state is accepted. `recoveryControlTransition` reuses the existing canonical M12/M11 recovery-control evidence validator and binds its before/after values to the continuing-only reset rule; it is absent or preserved exactly at final handoff. Any mismatch, duplicate source identity, cross-round reference, impossible count, numeric type error, or inconsistent before/after value invalidates the stored history.

The audit kind is `round-closeout` and uses the existing exact audit key order:

```text
auditId, kind, sessionId, requestId, actorUserId, authorityEpoch,
previousRevision, revision, occurredAt, details
```

Its exact `details` key order is:

```text
roundId, roundNumber, runtimeEventType, checkpointId,
stationResultIds, successUnits, failureUnits, roundResult,
momentumBefore, momentumAfter, pressureEffectIds, breachIds,
hazardEffectIds, consequenceEffectIds, benefitTransition,
focusTransition, riskBidTransition, recoveryControlTransition,
previousSessionState, nextSessionState, nextRoundId
```

The checkpoint kind is the existing `before-round-closeout` kind at the pre-mutation revision and uses the existing exact checkpoint key order:

```text
checkpointId, kind, sessionId, revision, encounterRevision,
eventCount, sessionState, encounterState, closeout, authorityEpoch, invalidated
```

Its session and encounter snapshots bind the exact accepted entry state and event prefix. The processed response uses the existing exact response key order `ok, requestId, sessionId, status, revision, authorityEpoch, projection, events, errors, warnings`; `projection` is `null` for the GM mutation response and the response event delta contains exactly the one `voyage.m12-round-closeout` event.

Any forged, reordered, duplicate, skipped, mismatched, or tampered historical evidence returns `m11-invalid-session-document` at the Event Session path with null/empty sentinels and zero writes. No repair-on-load is permitted.

## 27. Nested evidence schemas and cross-bindings

Nested evidence is hostile-safely captured, dense, exact-key-order data. Existing canonical validators are authoritative; Task 5 does not create parallel Pressure, Hazard, consequence, or Risk Bid schemas.

### `pressureEffects`

A dense array of existing canonical Pressure effect records using this exact key order:

```text
pressureEffectId, encounterId, stageId, roundNumber, sequence,
stationId, actionId, pressureSystemId, delta, timing, sourceKind,
sourceIntentId, activationSource, branch, visibility
```

`pressureEffectId` is unique in the array. The record binds to the Event Session/event, authored stage and `roundId`, canonical sequence, system, and authored value. Task 4-applied records bind to their existing Task 4 event and are history-only. Eligible Task 5 records require the existing closeout source tuple (`sourceKind: "hazard-closeout"`, `timing: "gm-confirmed"`, `activationSource: "event-closeout"`) and are consumed once.

### `breaches`

Each entry is the canonical `voyage.pressure-breach-applied.breach` record validated by the existing Pressure/Void Scar validators, with exact key order:

```text
pressureBreachId, encounterId, stageId, roundNumber, effectIndex, sequence,
stationId, actionId, pressureSystemId, pressureEffectId, sourceKind,
sourceIntentId, activationSource, branch, timing, visibility, previousValue,
capacity, remainingCapacity, attemptedDelta, overflowDelta
```

`pressureBreachId` and `sequence` are unique and ordered by source-effect sequence. The entry binds to the exact source `pressureEffectId`, round, system, before-value, capacity, canonical overflow, matching Hazard, matching Void Scar proposal, and reset event.

### `hazardEffects`

Each entry is an existing canonical Hazard snapshot validated by `validateVoyageHazardRecord` with exact `HAZARD_FIELDS` order:

```text
hazardId, encounterId, category, status, name, currentEffect,
activationTiming, removalMethod, ignoredConsequence, visibility, sourceKind,
createdStageId, createdRoundNumber, createdSequence, escalation,
collisionPolicy, duration, failurePressureSystemId, resolvedStageId,
resolvedRoundNumber, terminalReason, replacedByHazardId, metadata,
pressureSystemId, eventAreaId, pressureBreachId, stationId, actionId,
pressureEffectId, sourceIntentId, activationSource, branch, sourceTiming,
sourceVisibility
```

The Hazard binds to its authored source, source Breach/effect, round, prior state when present, visibility, effect identity, and resulting `active`, `resolved`, or `removed` state. Duplicate `hazardId` or wrong source invalidates history.

### `consequenceEffects`

Task 5 reuses the existing authored action/effect-rule schema and validator. Each entry has exact key order:

```text
effectId, intentType, timing, visibility, target, payload
```

The entry is bound to the originating station/result, Risk Bid, Focus, Hazard, Breach, or authored round source and deterministic sequence. It cannot contain arbitrary GM values. Duplicate effect IDs, missing authored references, wrong round, or inconsistent before/after evidence invalidate history.

### `benefitTransition`

This is the one new Task 5 nested schema required by approved T5-DEC-16. It is a dense array with exact key order:

```text
effectId, sourceStationId, sourceActionId, riskBidId, sourceRevision,
sourceEncounterRevision, sourceResult, targetStationId, targetPendingCheckId,
effectKind, effectValue, activationTiming, consumptionTiming, roundNumber,
requiresSourceBeforeTarget, previousStatus, persistence, status,
consumedAtRevision
```

The record reuses the canonical durable Risk Bid effect identity and fields, adds `previousStatus` and authored `persistence`, and requires `persistence` to equal the immutable owning effect definition. `effectId` is unique; source/target order, source and target pending checks, round, source revisions, status transition, and consumed revision are cross-bound. `status` is `active`, `consumed`, or `blocked`; a consumed record requires `consumedAtRevision`, and a blocked record cannot claim consumption. Runtime persistence claims are never authoritative.

`focusTransition`, `riskBidTransition`, and `recoveryControlTransition` are references to their existing canonical M12/M11 evidence validators and exact records; no parallel nested schema or client-authored fields are introduced. All nested arrays use authored/source sequence order. Reordering, duplicate identity, forged source, wrong round, wrong system, wrong authored definition, inconsistent before/after, and response/evidence mismatch fail reload with `m11-invalid-session-document` and zero writes.

## 28. Implementation acceptance

The implementation must directly test these acceptance groups:

1. legal GM active-GM closeout;
2. exact entry predicates, including `pendingThresholdQueue.length === 0`;
3. nonempty threshold queue rejection with zero writes;
4. incomplete/early closeout rejection;
5. unauthorized player/crew/observer rejection;
6. hostile request capture and forbidden-key rejection;
7. server-derived station units;
8. all nonzero round-result ladder cases;
9. zero/zero -> `round-neutral`;
10. Momentum +1;
11. Momentum -1;
12. Momentum clamp at 0 and 3;
13. neutral Momentum unchanged;
14. typed Pressure state and preserved IDs/capacity;
15. Task 4-applied Pressure is not reapplied;
16. one eligible closeout Pressure effect applies once;
17. duplicate, forged, wrong-round, wrong-timing, and wrong-source Pressure rejection;
18. ordered Pressure effects;
19. Breach creation/reset/prevention;
20. Hazard prevention does not erase Breach/Void Scar/reset unless explicitly authored;
21. multiple independently ordered Breaches;
22. Hazard closeout and durable removed/resolved history;
23. server-derived consequence binding;
24. benefit omitted persistence defaults round-local;
25. round-local clears at continuing transition;
26. next-round carries exactly one round;
27. event persistence carries until consumed or closeout;
28. consumed benefit never reactivates;
29. forged persistence and wrong authored source rejection;
30. Focus preservation and reaction reset;
31. Risk Bid active reset with history preserved;
32. recoveryControl resets only on continuing transition;
33. complete continuing reset matrix;
34. complete final-handoff preservation matrix;
35. next authored round transition in the same session;
36. exact round-A replay after active round becomes B;
37. new request for old round A rejection;
38. changed-payload same-request conflict;
39. final-round Task 6 handoff without new planning state;
40. contention/coordinator loser;
41. stale revision;
42. stale authority epoch;
43. nested duplicate identity rejection;
44. nested forged source rejection;
45. nested wrong-round/system/authored binding rejection;
46. nested inconsistent before/after rejection;
47. response/nested evidence mismatch rejection;
48. reload and tampered-history rejection;
49. projection privacy and Task 4/Task 6 boundary regression;
50. exact replay produces no duplicate transition, effect, carry, or write.



## Approved decision reconciliation

This contract incorporates approved T5-DEC-01 through T5-DEC-19: authored `roundId`; one GM-only `round-closeout`; complete entry witnesses including an empty pending-threshold queue; explicit `round-neutral`; station-degree-only units; existing typed Pressure identity and exactly-once source consumption; ordered atomic Breach processing with distinct Hazard and Void Scar outcomes; minimum Hazard lifecycle; server-derived consequences; authored `persistence` benefit carryover; Focus preservation with reaction reset; same-session next-round transition or final Task 6 handoff; one coherent nested evidence set; authored visibility with public fallback; continuing-only `recoveryControl` reset; preservation of the authoritative `currentStage` across continuing and final handoff; and preservation of the complete authoritative `tracks` state across continuing and final handoff.

Unresolved Task 5 decision count: **0**.

M12 TASK 5 FINAL ROUND-CLOSEOUT CONTRACT COMPLETE - READY FOR FINAL NARROW CONFIRMATION
