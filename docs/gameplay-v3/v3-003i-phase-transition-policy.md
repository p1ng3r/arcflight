# Gameplay V3-003I — Voyage Round Phase Transition Policy

## Purpose

This slice provides a Foundry-free, immutable policy for inspecting and
validating ordinary forward progression through a Voyage Round. It is read-only:
it does not require or mutate an encounter.

## Standard phase graph

The six standard phases, in order, are Situation, Crew Planning, Lock and
Readiness, Resolution, Consequences, and Cleanup and Advance. The exact legal
ordinary edges are:

- Situation → Crew Planning
- Crew Planning → Lock and Readiness
- Lock and Readiness → Resolution
- Resolution → Consequences
- Consequences → Cleanup and Advance

Cleanup and Advance has no ordinary outgoing edge. In particular, Cleanup and
Advance → Situation is deferred to a specialized round-advancement operation:
that operation must atomically clear round state, increment the round, and
create the appropriate snapshots.

## Public helpers

`scripts/voyage/domain/phase.js` exports and Arcflight registers these helpers:

- `getAllowedVoyagePhaseTransitions(phase)` returns a new array of legal target
  phases, or a new empty array for an unrecognized or terminal phase.
- `isLegalVoyagePhaseTransition(fromPhase, toPhase)` returns `true` only for an
  explicit forward edge between distinct recognized phases.
- `validateVoyagePhaseTransition(fromPhase, toPhase)` returns exactly
  `{ valid, errors, warnings }`, with a fresh warnings array.
- `getVoyagePhaseTransitionPolicy()` returns a new plain object containing all
  six phases in standard order and new arrays for each value.

Validation recognizes the stable errors `invalid-source-voyage-phase`,
`invalid-target-voyage-phase`, `same-voyage-phase`, and
`illegal-voyage-phase-transition`. Each issue includes `code`, `path`,
`message`, and `severity: "error"`.

## Isolation and boundary

The private policy object, all of its transition arrays, and the recognized
phase collection are frozen. Public inspection helpers return copies, so
mutating any returned object or array cannot affect later results or legality.
Prototype-like input keys including `__proto__`, `constructor`, and `prototype`
are unrecognized values; policy access occurs only after recognition.

The module does not access Foundry globals or PF2e classes, persistence,
sockets, authority, projections, or UI. It also defers phase application,
snapshots, revision changes, events, round advancement, gameplay resolution,
planning, locking, readiness, consequences, cleanup, stage or lifecycle work.
