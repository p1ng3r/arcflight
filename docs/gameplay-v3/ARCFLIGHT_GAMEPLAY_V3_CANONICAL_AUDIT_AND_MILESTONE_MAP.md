# Arcflight Gameplay V3 — Canonical Contract Audit and Implementation Milestone Map

**Audit date:** 2026-07-25
**Canonical design source:** [`ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`](ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md), Version 1
**Authoritative repository:** `p1ng3r/arcflight`
**Authoritative branch:** `rebuild/arcflight-gameplay-v3`
**Historical audit checkpoint:** base SHA `e6f59c91775d91f6732018fab6abf63bb8d27c4a`
**Historical draft checkpoint:** PR #566 at head `b8da71e761f53de5d1c38bdbbf90f9f2dd637cdf`
**Current accepted status:** PR #566 merged; Milestone 0 complete
**Accepted implementation head:** `2963763ee99566fb5736415dd5a9ca636c81f223`
**Merge commit:** `9799fdaa8c14d18ecafca8372bf97e936fabce1b`
**Current milestone:** Milestone 1A — canonical rules documentation PR

---

## 1. Executive conclusion

The Gameplay V3 rebuild is **not wasted and should not be restarted**. It has a strong pure-domain foundation for lifecycle, phase transitions, snapshots, planning mutations, PF2e execution, pending-check persistence, and consequence-intent contracts.

However, the newly locked canonical gameplay rules expose several important contract mismatches in the current planning layer:

1. the engine currently treats most available stations as required, while canonical play allows unoccupied stations;
2. station selections store only an action, not the operator and committed approach;
3. action order is derived from authored priority, while canonical play requires a player-committed order every round;
4. current Risk Bids are identifier-based reward/danger references, but canonical Risk Bids are `+2`, `+5`, or `+8` DC variants with four-degree authored branches;
5. exact three-actions-per-occupied-station and approach-count rules are not yet enforced;
6. Focus and reaction windows do not yet exist;
7. round scoring, Momentum, Pressure, Hazards, Void Scars, rewards, Misfortunes, and Catastrophic Breakdown are not yet implemented.

The correct strategy is:

```text
PR #566 merged and Milestone 0 completed
→ place the canonical rules in the repository
→ realign Crew Planning contracts
→ continue complete action/Risk Bid outcomes and round mechanics
→ add recoverable runtime/UI through one vertical slice
```

Do not build travel routes, ports, hex progress, supplies, or voyage-day simulation into Arcflight Core.

---

## 2. Audit scope

This is a **contract-level audit** of:

- the canonical Event Runner rules document;
- the accepted Gameplay V3 roadmap and current-task pointer;
- the primary pure-domain state, validation, phase, planning, Risk Bid, ordering, execution, pending-check, and consequence-rule modules;
- merged Gameplay V3 PR history through the current branch checkpoint;
- draft PR #566 and its blocking reviews;
- the separate Voyage Event alpha package validator as a possible salvage source.

It is not a line-by-line security review of every file in the repository.

---

## 3. Current implementation strengths

### 3.1 Pure-domain state foundation

The current engine already provides:

- a serializable encounter state;
- explicit lifecycle and round-phase enums;
- structural validation;
- revision tracking;
- snapshots and recovery storage;
- temporary and permanent consequence collections;
- generic tracks and thresholds;
- processed-request IDs for future idempotency.

This is a good base for the canonical Event Session.

### 3.2 Lifecycle and phase control

Implemented foundations include:

- Draft, Configuration, Ready, Active, Paused, Recovery, completion, abandonment, and discard states;
- validated lifecycle transitions;
- Configuration → Ready;
- Ready → Active;
- Situation → Crew Planning;
- Crew Planning → Lock Readiness;
- Lock Readiness → Resolution;
- Resolution → Consequences;
- phase-start and round-start boundary snapshots;
- atomic state operations with one revision increment.

These contracts should be preserved.

### 3.3 Crew Planning mutation patterns

The current planning layer already demonstrates useful patterns:

- action selections are encounter-local;
- changes and clears are atomic;
- Risk Bids are coupled to selected actions;
- readiness and locking are separate operations;
- unsafe map keys and duplicate authored IDs are rejected;
- outputs and events are deterministic.

The data being selected must change, but the mutation architecture is reusable.

### 3.4 PF2e execution boundary

The PF2e work is one of the strongest parts of the current engine:

- pure preflight contracts;
- injected runtime dependencies;
- Foundry v14/PF2e adapter wiring;
- one live roll boundary;
- exact result normalization;
- public/blind roll handling;
- pending-check persistence;
- duplicate result rejection;
- no live Actor, Statistic, Roll, or Chat objects leaking into domain state.

This should be extended to consume the operator's committed approach and final modified DC, not replaced.

### 3.5 Consequence intent foundation

The current consequence contracts already provide:

- all four PF2e result branches plus no-roll;
- action-local effect rules;
- stable effect IDs;
- intent types, timing, visibility, and targets;
- recursively plain payload validation;
- deterministic intent IDs;
- atomic interpretation goals.

This is a strong substrate for Pressure, Hazards, rewards, Scars, and closeout proposals.

---

## 4. Canonical alignment matrix

| Canonical area | Current status | Decision |
|---|---|---|
| Arcflight Core as standalone event runner | Mostly aligned | Keep internal `voyage` names for now; do not add travel dependencies |
| Event Session plain-data state | Strong foundation | Extend rather than replace |
| Lifecycle, pause, snapshots, recovery shape | Strong foundation | Preserve |
| One operator per station | Missing as an enforced contract | Add operator assignment validation and state |
| Named NPCs may operate stations | Not explicitly modeled | Store an operator reference/UUID and operator kind without special-casing PF2e behavior |
| Fixed assignments for entire event | Partial `temporaryStationAssignments` field only | Replace ambiguity with canonical fixed assignment contract |
| Unoccupied stations contribute nothing | Conflicts with required-station completeness | Completeness must be based on occupied stations, not every available station |
| Exactly 3 actions per occupied station per round | Not enforced | Add event/round authoring validation |
| 1–2 approaches normally, exceptional third | Not enforced | Add authoring rule and validator |
| Operator commits one approach | Missing | Add approach selection to planning state and execution requests |
| Player-chosen station order each round | Conflicts with authored `resolutionPriority` sorting | Add committed round order and make it authoritative |
| Base DC or `+2/+5/+8` Risk Bid | Partial but incompatible contract | Redesign Risk Bid options to carry tier/DC adjustment and four outcome branches |
| Maximum 1 bid per station, 3 per round | Per-station coupling exists; round cap missing | Add lock-readiness validation |
| One roll resolves action and bid | Structurally possible | Preserve one pending check, but apply canonical bid DC and branches |
| Focus per occupied operator | Missing | Add after the committed planning model is stable |
| Reaction windows | Missing | Add in recoverable session controller and domain timing contracts |
| Round units and result ladder | Missing | Implement before Momentum and rewards |
| Momentum 0–3 | Missing | Dedicated round-closeout mechanic; do not overgeneralize |
| Five system Pressure tracks | Generic tracks only | Add typed canonical system Pressure rules |
| Pressure Breach → Hazard + Scar + reset | Missing | Implement as one atomic consequence operation |
| Hazard lifecycle | Missing | Add definition, active state, response actions, limits, countdowns, closeout |
| Void Scar capacity and repair | Missing | Add hull schema value, active ship Scars, repair contracts |
| Catastrophic Breakdown | Missing | Add after Scar capacity is implemented |
| Reward/negative step calculations | Missing | Add after round/event aggregation |
| GM closeout preview and controlled apply | Partial generic consequence concepts only | Build explicit preview/application boundary |
| Persistence, authority, filtered projections | Deferred | Implement after pure closeout contracts |
| Player/GM event applications | Missing | Deliver through a thin vertical slice |
| Upgrade hooks | Missing | Add incrementally after the core loop works |

---

## 5. Critical contract mismatches

### 5.1 Required stations versus occupied stations

Current Crew Planning completeness treats every available station as required unless the authored station explicitly sets `selectionRequired: false`.

Canonical rule:

```text
Only occupied stations require an action selection.
Unoccupied stations are skipped and contribute nothing.
```

Required correction:

- distinguish `availableStations` from `occupiedStations`;
- validate one operator per occupied station;
- require selections only for occupied stations;
- prohibit selections and ordering entries for unoccupied stations;
- allow any subset of the five stations to be occupied unless the event explicitly requires a station.

### 5.2 Action selection does not include the approach

Current persisted station selection is effectively:

```js
{ stationId, actionId }
```

Execution requests carry the entire authored `statisticOptions` list. The selected skill is therefore not a committed part of the locked Crew Plan.

Canonical selection must include:

```js
{
  stationId,
  actionId,
  approachId,
  statisticSlugOrAbilityId
}
```

The exact final shape may differ, but the selected approach must be:

- validated against the chosen action;
- stored before plan lock;
- immutable after lock except by explicit correction;
- copied into the execution request;
- persisted into the pending check;
- used by the PF2e adapter without fallback selection among multiple authored choices.

### 5.3 Authored resolution priority conflicts with player order

Current order is derived by sorting:

```text
resolutionPriority
→ station index
→ action index
→ station ID
→ action ID
```

Canonical rule:

```text
The crew chooses and locks station resolution order every round.
```

Required correction:

- add a round-local committed station order;
- validate it as an exact permutation of occupied station IDs;
- use that order as the authoritative sequence;
- retain authored priority only as an optional constraint or recommendation, not as the normal ordering source;
- allow upgrades, Hazards, or reactions to change unresolved order only through explicit rules.

### 5.4 Current Risk Bid contract is not canonical

Current Risk Bid options normalize mainly as:

```js
{
  riskBidId,
  rewardEffectIds,
  dangerEffectIds
}
```

Canonical Risk Bid needs:

```js
{
  riskBidId,
  dcAdjustment: 2 | 5 | 8,
  outcomes: {
    criticalSuccess: [...],
    success: [...],
    failure: [...],
    criticalFailure: [...]
  }
}
```

The exact schema may continue using effect references, but it must support:

- exact `+2`, `+5`, or `+8` tier;
- one roll against the increased DC;
- degree-specific bid benefits and consequences;
- no second generic normal-action punishment on Failure or Critical Failure;
- maximum three selected bids across the round;
- targeting and timing appropriate to cross-station benefits;
- effects such as DC reduction, degree shifts, roll twice, Focus restoration, Pressure, Hazard prevention/removal, and system repair.

The current planned “reward versus danger reference activation” is too narrow to become canonical without this contract adjustment.

### 5.5 Existing alpha package validator conflicts with canonical authoring

The separate alpha validator is useful reference code, but its rules conflict with the canonical contract:

- it allows only one or two station actions, while canonical requires exactly three for each occupied station;
- it requires exactly three skills per action, while canonical normally allows one or two and only exceptionally three;
- it requires every bid band on every action, while canonical actions may offer no bid or only selected tiers;
- it allows flexible round limits rather than enforcing an authored odd count of 3, 5, 7, 9, or 11.

Reusable pieces:

- recursively safe declarative-data inspection;
- stable ID and reference validation;
- package-local narrative component references;
- external catalog registry ideas;
- nonexecuting imported content boundary.

Do not copy the alpha validator wholesale.

---

## 6. Accepted outcome of PR #566

PR #566 remained limited to:

```text
scripts/voyage/domain/action-outcome-interpretation.js
tests/voyage/domain/action-outcome-interpretation.test.mjs
```

The previously identified blockers were resolved before merge. The accepted implementation now:

1. enforces Active lifecycle, Consequences phase, and complete-resolution gates;
2. emits atomic empty action and intent output whenever interpretation gates fail;
3. preserves precise upstream diagnostics while adding interpreter-owned gate diagnostics;
4. detects ambiguous execution requests, definitions, pending checks, and branch references;
5. rejects invalid result slugs and missing effect rules atomically;
6. preserves own `__proto__` data keys through getter-safe plain-data cloning;
7. contains hostile reads through an outer safe-failure boundary;
8. emits only from validated preflight records;
9. covers exact result branches, deterministic IDs, sparse and inherited references, isolation, roll-detail exclusion, and hostile own keys.

**Accepted head:** `2963763ee99566fb5736415dd5a9ca636c81f223`
**Merge commit:** `9799fdaa8c14d18ecafca8372bf97e936fabce1b`
**Status:** merged through PR #566; Milestone 0 complete.

---

## 7. What should be preserved

Do not rewrite or discard these foundations:

- plain-data domain boundaries;
- lifecycle and phase policies;
- atomic operations and revision increments;
- boundary snapshots;
- pause/resume foundation;
- selection mutation patterns;
- structured issue objects;
- unsafe-key and hostile-data defenses;
- PF2e preflight and one-roll execution boundary;
- pending-check identity and persistence;
- consequence effect-rule and intent concepts;
- public API extension pattern;
- separation between pure domain logic and Foundry adapters.

These are compatible with the canonical Event Runner after targeted contract changes.

---

## 8. Revised milestone map

Exact final issue numbers should be accepted one slice at a time. The sequence below is the recommended dependency order.

### Milestone 0 — Complete: normal-branch interpreter

#### 0A. Gameplay V3-005B-1 correction

Completed through merged PR #566:

- Active, Consequences, and complete-resolution gates enforced;
- hostile-data safety and atomicity completed;
- focused regression coverage completed;
- Risk Bid activation, targets, and visibility remained deferred as intended.

**Output:** deterministic normal action branch intents.
**Accepted head:** `2963763ee99566fb5736415dd5a9ca636c81f223`
**Merge commit:** `9799fdaa8c14d18ecafca8372bf97e936fabce1b`
**Status:** complete.

---

### Milestone 1 — Put the canonical authority in the repository

#### 1A. Canonical rules documentation PR

Add the canonical rules and canonical audit/milestone-map documents under `docs/gameplay-v3/` and update:

```text
docs/codex/CURRENT-GAMEPLAY-V3.md
docs/gameplay-v3/reconciliation-and-continuation-roadmap.md
```

The update should state that the new Event Runner contract supersedes conflicting gameplay rules while preserving the accepted pure-domain implementation foundation.

**Scope:** documentation only.

---

### Milestone 2 — Canonical Crew Planning alignment

These must be separate small PRs.

#### 2A. Fixed operator assignments and occupied stations

- canonical five station IDs and pressure-system ownership;
- one operator reference per occupied station;
- named PC/NPC operators supported uniformly;
- no operator assigned to two stations;
- assignments locked for the event;
- unoccupied stations allowed;
- selections required only for occupied stations.

#### 2B. Round action authoring validation

- exactly three actions for every station made available in that round;
- actions are round-specific;
- each action has one or two approaches normally;
- optional third approach only with explicit distinct metadata;
- odd authored round count of 3, 5, 7, 9, or 11;
- imported content remains declarative and nonexecuting.

#### 2C. Approach selection and editing

- select/change/clear committed approach;
- validate against selected action;
- couple approach clearing to action changes;
- expose through the existing API pattern;
- readiness requires a valid action and approach for every occupied station.

#### 2D. Player-committed station order

- store proposed and committed order for the current round;
- exact permutation of occupied station IDs;
- Captain/GM authority is an adapter/UI concern, not hidden domain mutation;
- resolution order consumes committed order;
- authored restrictions can validate or transform only through explicit effects.

#### 2E. Canonical Risk Bid contract

- exact tiers `+2`, `+5`, `+8`;
- action may offer any subset or no bid;
- one bid per station;
- maximum three bids in the round;
- four-degree bid branches;
- selected tier modifies the same action check DC;
- action change clears incompatible bid.

#### 2F. Execution-request alignment

- execution request contains selected approach, not merely all options;
- final DC calculation includes action adjustment, upgrades already resolved at planning/preflight, and selected Risk Bid;
- pending check records the selected statistic/ability and final DC;
- PF2e adapter resolves exactly that selected statistic.

**Output of Milestone 2:** a locked round plan that exactly matches canonical table decisions.

---

### Milestone 3 — Complete outcome interpretation

#### 3A. Risk Bid outcome interpretation

- activate the selected bid's branch from the same degree of success;
- emit normal action benefits and bid benefits/consequences correctly;
- normal Failure/Critical Failure adds no second authored action penalty;
- support exact cross-station/system/Hazard targets;
- enforce visibility filtering in later projections, not by deleting GM data from domain state.

#### 3B. Controlled modifier intent vocabulary

Add or formalize intents needed for:

- DC change;
- roll modifier;
- result-degree shift;
- reroll;
- roll twice and keep better;
- Focus restoration;
- Pressure change;
- Hazard create/remove/prevent/suppress;
- station-order change;
- system repair/protection.

**Output:** complete action and Risk Bid intent plan for one round.

---

### Milestone 4 — Round scoring and Momentum

#### 4A. Individual unit aggregation

```text
Critical Success = 2 success units
Success = 1 success unit
Failure = 1 failure unit
Critical Failure = 2 failure units
```

#### 4B. Round result ladder

- Critical Round Success;
- Round Success;
- Round Failure;
- Critical Round Failure;
- explicit zero-contribution fallback;
- Critical degrees still count as one won/lost round for event victory.

#### 4C. Momentum

- event starts at 0;
- successful round +1, maximum +3;
- failed round -1, minimum 0;
- applies to qualifying checks in the following action segments/round;
- disappears at closeout;
- authored exceptions may create temporary penalties but not normal negative Momentum.

**Output:** canonical round result and next-round ship bonus.

---

### Milestone 5 — Pressure and Pressure Breaches

#### 5A. Typed station-system Pressure

```text
Captain      → Crew Morale
Engineer     → Arkengine
Navigator    → Levstone Array
Watchmaster  → Solar Sail Rig
Veilwarden   → Lifeveil
```

- default capacity 2;
- upgrade maximum 5;
- Failure +1;
- Critical Failure +2;
- remaining Pressure resets after event closeout.

#### 5B. Pressure Breach operation

When Pressure exceeds capacity:

```text
create matching Hazard
→ propose matching Void Scar
→ reset that system's Pressure to 0
```

The operation must be atomic and create only one breach per pressure-gaining effect unless explicitly authored otherwise.

---

### Milestone 6 — Hazard engine

#### 6A. Hazard definition and active state

- system versus event category;
- visible effect, timing, response, ignored consequence;
- one active system Hazard per pressure system;
- escalation/replacement/add-Pressure policies;
- countdown and closeout behavior.

#### 6B. Address Hazard action

- normally replaces the station's regular action;
- all four outcomes;
- success/failure unit contribution;
- Failure +1 Pressure;
- Critical Failure +2 Pressure;
- Focus, upgrades, or Risk Bids may remove a Hazard without consuming the action only when authored.

---

### Milestone 7 — Void Scars, hull capacity, and repair

#### 7A. Hull schema

Add explicit `voidScarCapacity` to every hull definition:

| Hull | Capacity |
|---|---:|
| Void Skiff | 2 |
| Sloop | 3 |
| Cutter | 4 |
| Brigantine | 5 |
| Frigate | 6 |
| Galleon | 7 |
| Hammerhead | 7 |
| Arkcruiser | 9 |
| Dread Caravel | 9 |
| Cathedral Ship | 10 |
| Leviathan-Class Platform | 12 |

#### 7B. Active Scar records

- store on the ship, not the hull item;
- hull supplies base capacity;
- upgrades may modify effective capacity when explicitly authored;
- Scar effects integrate through the extensible event hook system.

#### 7C. Repair contracts

- normal repair requires suitable dock, money, time, and one Very Hard authored check;
- Critical Success 50% cost/time;
- Success 75%;
- Failure 125%;
- Critical Failure 150%;
- Field Repair Resources remove compatible Scars without docking, normal gold cost, or the normal repair check.

---

### Milestone 8 — Event result, rewards, and Misfortunes

#### 8A. Overall event result

- odd rounds prevent ties;
- successful rounds versus failed rounds determines victory;
- all authored rounds normally play.

#### 8B. Reward Steps

- successful event grants one base Reward Step;
- Round Success = 1 reward point;
- Critical Round Success = 2 reward points;
- one additional step for each full two points above the winning threshold;
- maximum three steps/items;
- one reward may be enhanced at most twice;
- Void Fortune only when authored;
- Momentum never converts to reward.

#### 8C. Negative Steps

- no reward, salvage, clue, discovery, or Void Thread on failure;
- mirrored failure-point calculation;
- base Misfortune on normal failure;
- enhanced negative package and possible Void Scar on critical overall failure;
- failure must still lead to an authored next situation, not a retry loop.

---

### Milestone 9 — Catastrophic Breakdown and Emergency Response

- trigger when a ship at maximum Scar capacity would gain another Scar;
- do not add another Scar;
- disable the affected system;
- create a mandatory Catastrophic Hazard;
- pause normal action resolution after the current segment;
- run authored Emergency Response;
- success stabilizes but does not repair;
- failure ends the event and strands/diverts/disables through authored consequences;
- ordinary event travel remains out of Core scope.

---

### Milestone 10 — Closeout preview and controlled application

#### 10A. Pure closeout calculation

- final round result;
- overall result;
- rewards or negative package;
- unresolved Hazard closeout;
- Pressure Breaches;
- proposed Scars/Breakdown;
- exact temporary-state reset plan.

#### 10B. GM closeout review

- complete mechanical preview;
- reward allocation within calculated steps;
- persistent proposal list;
- no durable ship write yet.

#### 10C. Foundry persistence adapter

- active-GM authority;
- expected revision;
- idempotency markers;
- apply persistent ship changes only after GM confirmation;
- preserve PF2e-owned data and sibling Arcflight flags;
- retry/reconciliation support.

---

### Milestone 11 — Recoverable Event Session runtime

- command/request envelopes;
- active-GM authority;
- unique request IDs;
- stale and duplicate rejection;
- session persistence and reload recovery;
- safe checkpoints before plan lock, action segments, reactions, round closeout, Emergency Response, and persistent application;
- player, crew, observer, and GM projections;
- disconnection control transfer without station reassignment;
- audited GM correction and abort paths.

---

### Milestone 12 — First complete vertical slice

Build one handcrafted three-round event with:

- event selection and ship selection;
- fixed operators;
- exactly three new actions per occupied station per round;
- approach and Risk Bid selection;
- committed station order;
- PF2e checks;
- at least one Focus reaction;
- Momentum;
- Pressure and one possible Breach;
- one Hazard response;
- reward/Misfortune closeout;
- GM preview/apply;
- pause, reload, resume, reset, and audit history.

This milestone is the proof that the domain engine produces the intended table experience.

---

### Milestone 13 — Upgrade hooks and broader ship integration

Add incrementally after the vertical slice:

- passive DC reductions;
- permanent station roll bonuses `+1` to `+3`;
- Pressure Capacity increases;
- once-per-event rolled reactions;
- first-Hazard prevention;
- action/approach/Risk Bid unlocks;
- order changes;
- Focus effects;
- Hazard and Scar protection;
- repair and reward hooks;
- other future authored hook types.

The hook system must remain extensible rather than limited to the initial examples.

---

## 9. Immediate execution order

The next checkpoints are:

```text
1. Review the exact four-file documentation diff.
2. Commit and push the documentation-only branch.
3. Open and review the canonical documentation PR.
4. Merge only after explicit user authorization.
5. Begin Milestone 2A: fixed operator assignments and occupied stations.
6. Do not start Pressure, Hazards, Scars, rewards, or UI before canonical Crew Planning alignment.
```

---

## 10. Final architectural judgment

Arcflight's hidden engine is already taking the correct general form:

```text
validated session state
→ locked cooperative plan
→ deterministic action order
→ PF2e resolution
→ isolated outcome intents
→ round mechanics
→ proposed persistent consequences
→ GM-confirmed application
```

The main correction is not a rewrite. It is to ensure the **locked plan actually represents the gameplay the players will perform**:

```text
fixed operator
+ occupied station
+ one of three round actions
+ committed approach
+ optional canonical Risk Bid tier
+ player-chosen station order
```

Once that planning contract is correct, the existing PF2e and consequence foundations can carry the canonical Momentum, Pressure, Hazard, Void Scar, reward, and closeout systems without abandoning the work already completed.
