# M12 Task 5 Supplemental Canonical Design Decisions

Status: supplemental decisions approved for incorporation into the Task 5 contract.

## T5-DEC-16 - Benefit Durability Source

### Question

What canonical authored field/source marks a benefit as permitted to remain active beyond the completed round?

### Current facts

The existing authored effect envelope contains `effectId`, `intentType`, `timing`, `visibility`, `target`, and `payload`. M12 Risk Bid effects additionally carry activation and consumption timing and source-before-target ordering. No existing authored durability marker previously existed.

### Approved decision

**APPROVED - OPTION A**

The owning authored effect definition uses the exact field `persistence` with allowed values `round-local`, `next-round`, and `event`. Omission means `round-local`. The authored definition is authoritative; runtime state and clients cannot declare or override persistence.

- `round-local` clears at a continuing-round transition; receipt/history remains durable.
- `next-round` remains active through exactly one following authored round, then expires unless consumed earlier; it is not implicitly event-durable.
- `event` remains active across authored rounds until consumed or Task 6/Event closeout.
- A consumed benefit never becomes active again.
- Contradictory persisted evidence or wrong owning-effect binding is invalid.
- Exact replay returns the stored response and never duplicates activation/carry.

Future implementation witnesses must cover omitted/default behavior, every value, one-round expiry, event carry, consumption, forged claims, wrong source binding, and exact replay.

### Status

T5-DEC-16 - APPROVED - OPTION A

## T5-DEC-17 - Pending Threshold Transition

### Question

What must Task 5 do when `pendingThresholdQueue` is nonempty at round closeout, for both continuing rounds and final Task 6 handoff?

### Existing repository facts

`pendingThresholdQueue` is initialized in `scripts/voyage/domain/defaults.js`; readiness checks require it to be empty, and boundary snapshots preserve it. No canonical producer, consumer, resolver, threshold consequence processor, stable pending-entry identity, or Task 5 queue transition exists.

### Approved decision

**APPROVED - OPTION A**

`pendingThresholdQueue.length === 0` is a Task 5 entry predicate for both continuing-round closeout and final Task 6 handoff.

A nonempty queue rejects with zero writes. Task 5 does not consume, clear, carry, synthesize, duplicate, or hand unresolved entries to Task 6. `thresholdHistory` remains durable historical evidence and is not cleared by this predicate. Any future queue feature must define stable identity, producer, consumer, duplicate prevention, history binding, lifecycle timing, and resolve all entries before Task 5 becomes legal.

### Status

T5-DEC-17 - APPROVED - OPTION A

## Dependency

T5-DEC-16 and T5-DEC-17 are independent. They interact only if a future threshold effect creates or alters a benefit; that effect must then bind to the approved authored `persistence` value.

## Final approval table

| Decision ID | Short question | Option A | Option B | Option C | Recommended option | Status |
|---|---|---|---|---|---|---|
| T5-DEC-16 | What authored source marks benefit durability? | Explicit `persistence` enum on effect | Typed duration inside benefit payload | Source-type derivation (not supported by current types) | A | APPROVED - OPTION A |
| T5-DEC-17 | What happens to a nonempty pending threshold queue? | Require empty before Task 5 | Task 5 resolves atomically | Carry/preserve across boundary | A | APPROVED - OPTION A |

Production changes: zero.
Test changes: zero.
