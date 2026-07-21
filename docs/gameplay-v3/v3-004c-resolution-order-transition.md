# V3-004C Resolution Ordering and Transition

Station actions may optionally author an own `resolutionPriority` safe integer. Omission (including inherited values) is priority `0`; lower values resolve first. The value controls sequence only, not PF2e initiative, costs, or outcomes.

The locked plan is derived, never persisted as a queue. Selected actions sort by priority, available-station index, action index, exact station ID, then exact action ID. The report includes only identifier references and the applicable Risk Bid ID (or `null`).

`prepareVoyageEncounterResolutionOrder(state)` is a Foundry-free read-only report restricted to Active Lock Readiness encounters. `applyVoyageEncounterResolutionTransition(state, { phaseStartSnapshotId })` atomically moves a valid empty-`pendingChecks` plan to Resolution, appends a `phase-start` snapshot, increments revision once, and emits `voyage.resolution-started` with an isolated ordered action list.

Both helpers are exposed through `game.arcflight`, `CONFIG.arcflight`, and `game.arcflight.devTools`. PF2e check construction, pending check generation, rolls, action execution, bids effects, and Resolution advancement remain deferred.
