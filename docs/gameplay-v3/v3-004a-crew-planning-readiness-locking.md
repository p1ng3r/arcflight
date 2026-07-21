# V3-004A Crew Planning Readiness and Locking

Crew Planning readiness is derived, Foundry-free data. `prepareVoyageEncounterCrewPlanningReadiness` reuses the completeness report and structural validation to report the Active/Crew Planning context, required and selected station IDs, missing selections, issues, and `readyToLock`. It does not persist a readiness flag.

`applyVoyageEncounterCrewPlanningLock` is the single atomic lock operation. A complete Active Crew Plan transitions from `crew-planning` to `lock-readiness`; that phase is the sole lock representation. The mutation clones the encounter, increments its revision once, creates the existing `phase-start` boundary snapshot for `lock-readiness`, validates the candidate, and emits one small `voyage.crew-planning-locked` event containing encounter, lifecycle, round, prior/current phase, revision, and snapshot ID.

Station selection, change, and clear helpers already require Crew Planning, so they reject locked plans without duplicate lock flags or checks. The public frozen Arcflight API and its frozen `devTools` expose completeness, readiness, and locking via the existing station-selection API extension. Risk Bids, target selection, assistance, ordering, PF2e rolls, resolution, persistence, authority, and UI remain deferred.
