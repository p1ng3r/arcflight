# Gameplay V3-003F: Ready-to-Active Activation Start Validation

## Purpose and result

`validateVoyageEncounterActivationStart(encounterState)` is a Foundry-free, pure read-only validator for whether a Ready Voyage Encounter can begin the specialized Ready-to-Active activation operation. It always returns `{ ready, errors, warnings }`, where `ready` is true exactly when `errors` is empty. It returns no candidate, next state, event, snapshot, projection, persistence request, or adapter request.

This validator is a prerequisite for, not an implementation of, Ready-to-Active application. It neither changes the supplied encounter nor increments its revision.

## Validation order

1. Validate the supplied state through `validateVoyageEncounterState`; invalid supplied states return those errors and warnings unchanged.
2. Require lifecycle state Ready. Other otherwise-valid lifecycle states return `activation-start-requires-ready` without building a candidate.
3. Validate Ready-to-Active through `validateVoyageLifecycleTransition` and preserve its issues.
4. Clone the encounter internally, set only the clone's lifecycle state to Active, round number to `1`, and phase to Situation, while retaining the supplied revision and existing current stage.
5. Validate the full internal Active candidate through `validateVoyageEncounterState`, then collect activation-start-specific requirements.

The candidate is never returned. Candidate validation therefore continues to enforce Active requirements such as a definition, primary ship, current stage, positive round, recognized phase, collections, tracks, consequences, snapshots, and recovery structure.

## Activation-start requirements

The existing current stage must be a plain object for Active validation, and when it is plain its `stageId` must be a non-blank string. At least one success condition, failure condition, and available station are required. The supplied Ready state must still use the inactive round value for both `roundNumber` and `phase`.

Pre-round planning state must be empty: `selections`, `targets`, and `riskBids` have no own keys; `assistance`, `reservations`, `pendingChecks`, `pendingThresholdQueue`, and `pendingConsequences` have no entries. A separate issue is collected for every non-empty planning field.

Empty tracks, optional participants, visible or GM information, temporary or permanent consequences, and valid existing snapshots are allowed. Existing processed request IDs, metadata, and valid recovery data are also allowed, and optional empty data produces no warnings.

## Immutability and deferred work

The validator never mutates the supplied state, including nested arrays and objects. Its supplied lifecycle, revision, inactive round number, and inactive phase remain unchanged regardless of the report.

This slice deliberately defers snapshot creation and identifiers, stage-entry effects, participant refresh, track work, thresholds, persistence, projections, authority, sockets, PF2e checks, rollback, recovery behavior, and the actual Ready-to-Active application.
