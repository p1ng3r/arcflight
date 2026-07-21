# Gameplay V3-003H: Ready-to-Active Voyage Encounter Application

## Purpose

`applyVoyageEncounterActivation(encounterState, activationRequest)` is the Foundry-free, pure-JavaScript operation that atomically begins a Ready Voyage Encounter. It applies only the accepted Ready-to-Active lifecycle transition and establishes the initial Active round context; it neither persists state nor executes gameplay.

## Result and request contracts

Success returns `{ ok: true, nextState, events, errors: [], warnings }`. Every failure returns `{ ok: false, nextState: null, events: [], errors, warnings }` and exposes no partial candidate or snapshot.

The request must be a plain object containing caller-supplied `roundStartSnapshotId` and `phaseStartSnapshotId`. IDs are only trimmed to determine whether they are blank; their exact supplied values are used in snapshots and the event. Unknown request fields are never copied. Both valid IDs must differ exactly and neither may collide with an existing encounter snapshot ID.

## Validation and application order

The operation first reuses `validateVoyageEncounterActivationStart`; failures are returned before the request is read. It then reuses `validateVoyageLifecycleTransition` for the Ready-to-Active policy edge. Only then are the request, distinct-ID rule, and existing-snapshot collisions validated.

After validation, it recursively clones the encounter and changes the internal candidate only to `lifecycleState: Active`, `roundNumber: 1`, and `phase: Situation`. The supplied Ready state remains unchanged, including its inactive round context and snapshots.

## Snapshots, revision, and event

The existing boundary-snapshot helper is called exactly twice against that Active candidate: first for the caller's `round-start` ID, then for the caller's `phase-start` ID. Existing snapshots retain their order; the new round-start snapshot and then phase-start snapshot are appended deterministically. Both represent the same initial Active round-1 Situation state.

Only after both snapshots are appended does the operation increment revision exactly once and validate the completed candidate. Success emits one `voyage.lifecycle-transitioned` event with encounter ID, Ready and Active lifecycle states, previous and new revisions, round number, phase, and both caller-supplied snapshot IDs.

## Immutability and boundaries

All successful plain-data output is recursively isolated from the encounter and request. Snapshot temporary state is independently cloned, including from the other newly created snapshot. Failures are atomic and never append to supplied snapshots or expose partial state. Warning arrays are assembled in validator and snapshot-construction order.

This slice deliberately defers initial-stage effects, track recalculation, participant refresh, station options, Situation presentation, projections, persistence, authority, sockets, PF2e checks, chat, UI, recovery, phase advancement, planning, locks, resolution, and consequences.
