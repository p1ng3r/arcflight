# Gameplay V3-003J: Situation-to-Crew-Planning Application

## Purpose

`applyVoyageEncounterCrewPlanningTransition(encounterState, transitionRequest)` is a Foundry-free, non-persisting domain operation that atomically enters the first ordinary Active Voyage Round planning phase. It reuses structural encounter validation and the ordinary Voyage phase-transition policy, so only an Active encounter at `Situation` may enter `Crew Planning`.

## Contract and prerequisites

Success returns `{ ok: true, nextState, events, errors: [], warnings }`. Every failure returns `{ ok: false, nextState: null, events: [], errors, warnings }`; no partially built candidate or snapshot is exposed.

The request must be a plain object containing a caller-supplied, non-blank string `phaseStartSnapshotId`. The value is retained exactly as supplied (including surrounding whitespace). An exact, case-sensitive collision with an existing snapshot ID is rejected. Unknown request fields are ignored and neither input is mutated.

The encounter must pass `validateVoyageEncounterState`, have lifecycle `Active`, and pass the existing `Situation` to `Crew Planning` phase edge policy. The operation rejects a non-Active lifecycle before inspecting the request or phase edge.

## Clean planning boundary

Crew Planning begins only when `selections`, `targets`, and `riskBids` are empty plain objects and `assistance`, `reservations`, and `pendingChecks` are empty arrays. Stale planning input is rejected rather than cleared. Existing `pendingThresholdQueue`, `pendingConsequences`, `temporaryConsequences`, `thresholdHistory`, and `temporaryStationAssignments` remain valid context and are preserved.

## Candidate, snapshot, and event

The operation recursively clones the encounter and changes only its phase to `Crew Planning` before snapshot construction; lifecycle, current stage, round number, revision, existing snapshots, and all other state are unchanged at that point. It calls `createVoyageEncounterBoundarySnapshot` once for a `phase-start` snapshot, appends that snapshot after every existing snapshot, then increments revision once and validates the complete candidate.

The successful event is exactly:

```js
{
  type: "voyage.phase-transitioned",
  encounterId: nextState.encounterId,
  lifecycleState: "active",
  roundNumber: nextState.roundNumber,
  fromPhase: "situation",
  toPhase: "crew-planning",
  previousRevision: encounterState.revision,
  revision: nextState.revision,
  phaseStartSnapshotId: transitionRequest.phaseStartSnapshotId
}
```

The recursively cloned next state and snapshot temporary state are isolated from each other and from both inputs. Clone and unexpected snapshot-construction exceptions are converted into atomic domain errors; ordinary helper failure reports are propagated unchanged.

## Deferred behavior

This boundary does not implement station selections, Risk Bids, assistance, reservations, locking, readiness, PF2e checks, persistence, authority, sockets, projections, or UI.
