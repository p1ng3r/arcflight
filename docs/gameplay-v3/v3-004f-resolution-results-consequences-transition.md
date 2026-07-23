# V3-004F — Resolution Results and Consequences Transition

PF2e execution remains separate from encounter mutation. A successful executor result is accepted only in its exact twelve-field normalized shape. Arcflight persists the exact six-field result `{ total, degreeOfSuccess, degreeOfSuccessSlug, statisticSlug, dc, rollMode }` on one pending check and emits `voyage.pending-check-resolved`; it does not change phase.

`prepareVoyageEncounterResolutionCompletion` reports action, check, prepared, resolved, and isolated unresolved counts. It treats no-roll-only plans as complete, rejects unprepared checks, and requires every prepared check to resolve.

`applyVoyageEncounterConsequencesTransition` accepts exactly `{ phaseStartSnapshotId }`, validates completion and the ordinary Resolution-to-Consequences edge, appends a `phase-start` boundary snapshot, increments revision once, preserves persisted results, and emits `voyage.consequences-started`.

This slice persists normalized roll results but does not interpret or apply their gameplay consequences.

This slice rejects applying a result to an already resolved pending check but does not prevent duplicate live chat rolls before persistence.
