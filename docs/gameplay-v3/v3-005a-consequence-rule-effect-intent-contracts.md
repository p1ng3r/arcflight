# Gameplay V3-005A: consequence rule and effect-intent contracts

This pure, Foundry-free slice extends the V3-004F Consequences checkpoint. It validates authored consequence rules but does not select a result branch, create effect intents, or mutate encounter state.

An action may own `outcomeDefinition: { effectRules, branches }`. A check action has exactly `critical-failure`, `failure`, `success`, and `critical-success` branches; a no-roll action has exactly `no-roll`. Omission normalizes to empty relevant branches. Rules are `{ effectId, intentType, timing, visibility, target, payload }`; IDs are exact nonblank safe strings and action-local references resolve to those IDs.

Intent types are `track-change`, `temporary-consequence`, `permanent-consequence-proposal`, `discovery`, `setback`, `temporary-modifier`, `stage-outcome`, and `encounter-outcome`. Timings are `consequences`, `gm-confirmed`, and `end-of-round`; visibility is `public` or `gm-secret`. Targets are `encounter`, `current-stage`, `primary-ship`, `source-station`, `selected-target`, `track`, `participant`, and `station`; the final three require `targetId`, while the others prohibit it.

Payloads are recursively captured plain finite acyclic data. Sparse arrays use own numeric values only; accessors, getters, unsafe values, cycles, and non-plain objects are rejected without invoking accessors. Output is isolated and deterministic in available-station/action order. Unreferenced valid rules warn with `unreferenced-effect-rule`.

`riskBidOptions` may include optional `rewardEffectIds` and `dangerEffectIds`; both are local validated references only, normalize to empty arrays, and are neither activated nor persisted. No-roll actions cannot supply nonempty result references.

`validateVoyageEncounterActionOutcomeDefinitions` returns `{ valid, errors, warnings }`. `analyzeVoyageEncounterActionOutcomeDefinitions` returns structural/definition/phase readiness, counts, normalized actions, errors, and warnings. Both are exposed as named exports and via `CONFIG.arcflight`, `game.arcflight`, and `game.arcflight.devTools`.

V3-005B will select and interpret results; V3-005C through V3-005G respectively handle tracks/thresholds, consequence staging, completion, cleanup/advance, and audited overrides. Do not copy the separate alpha branch's package or persistence contract wholesale.
