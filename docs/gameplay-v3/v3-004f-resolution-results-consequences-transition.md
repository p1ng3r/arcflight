# V3-004F Resolution results and Consequences transition

## Scope
This slice persists a normalized successful PF2e execution result against its prepared pending check, reports Resolution completion, and separately moves a completed Resolution plan to Consequences. This slice persists normalized roll results but does not interpret or apply their gameplay consequences.

The accepted execution input is exactly `{ ok: true, status: "rolled", pendingCheckId, sequence, sourceKind: "character", sourceUuid, statisticSlug, dc, rollMode, result: { total, degreeOfSuccess, degreeOfSuccessSlug }, errors: [], warnings: [] }`. It is matched by pending ID, sequence, source, statistic, DC, and roll mode. The stored resolved result is exactly `{ total, degreeOfSuccess, degreeOfSuccessSlug, statisticSlug, dc, rollMode }`; pending records remain `{ status: "pending", result: null }`.

Completion requires every required prepared check to be resolved; a valid no-roll-only plan is ready without pending checks. The separate Consequences transition creates a `phase-start` snapshot of the Consequences candidate, preserves the Resolution selections, targets, Risk Bids, tracks, pending consequences, and pending-check results, and increments revision once.

Events are exactly `voyage.pending-check-resolved` and `voyage.consequences-started`, with only the contract fields. Both operations are atomic and expose `applyVoyageEncounterPendingCheckResult`, `prepareVoyageEncounterResolutionCompletion`, and `applyVoyageEncounterConsequencesTransition` through the station-selection API, CONFIG, game API, and dev tools.

This slice rejects applying a result to an already resolved pending check but does not prevent duplicate live chat rolls before persistence.

## Non-goals
PF2e rolling, chat, Foundry runtime, document persistence, consequence/track/threshold/Risk Bid interpretation, and Cleanup/Advance are deferred. Consequences are not applied or cleared by this transition.
