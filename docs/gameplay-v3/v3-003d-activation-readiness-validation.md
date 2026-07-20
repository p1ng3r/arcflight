# Gameplay V3-003D: Voyage Encounter Activation Readiness Validation

## Purpose

`validateVoyageEncounterActivationReadiness(encounterState)` is a pure, read-only domain validator for determining whether a Voyage Encounter in Configuration has the minimum plain-data state needed to proceed to Ready. It returns only `{ ready, errors, warnings }`; `ready` is true only when `errors` is empty.

## Validation sequence

1. Validate the supplied encounter using `validateVoyageEncounterState` and return its errors and warnings unchanged when it is invalid.
2. Require the otherwise-valid encounter to be in Configuration.
3. Recursively clone the plain data, change only the internal clone's lifecycle state to Ready, and validate that candidate with the existing state validator. The clone is not returned and its revision is not changed.
4. Collect readiness-specific errors alongside Ready-candidate errors.

The Ready candidate therefore applies existing Ready requirements, including a definition ID or reference, primary ship reference, supported schema, and valid domain collections and recovery structures.

## Readiness requirements

Configuration readiness requires a plain-object `currentStage` with a non-empty `stageId`, at least one success condition, at least one failure condition, and at least one available station. `roundNumber` and `phase` must both equal the inactive round value. Round-planning state must be empty: `selections`, `targets`, and `riskBids` must be empty plain objects; `assistance`, `reservations`, `pendingChecks`, `pendingThresholdQueue`, and `pendingConsequences` must be empty arrays.

Tracks, optional participants, visible or GM information, temporary or permanent consequences, snapshots, processed request IDs, metadata, and recovery data remain optional or may retain valid configured/history data. The validator does not add warnings merely because optional data is empty.

## Immutability and boundaries

The validator never changes the supplied encounter, including nested objects and arrays, lifecycle state, or revision. It is Foundry-free and does not access documents, globals, permissions, sockets, persistence, projections, UI, or PF2e checks.

Reference resolution, ship existence and permissions, operator compatibility, authored action compatibility, stage and threshold semantics, track starting values, hidden-data projection analysis, GM authority, persistence, sockets, and PF2e roll behavior remain adapter-dependent or specialized future work.

A future Configuration-to-Ready application operation will consume this validation report to make the lifecycle transition; this validator itself does not activate an encounter, create events, start rounds, capture snapshots, or persist anything.
