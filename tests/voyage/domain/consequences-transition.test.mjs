import assert from "node:assert/strict";
import test from "node:test";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { applyVoyageEncounterConsequencesTransition } from "../../../scripts/voyage/domain/consequences-transition.js";
import { state, rolled } from "./resolution-results.test-support.mjs";
test("transitions a completed Resolution exactly once with a phase snapshot", () => { const completed = applyVoyageEncounterPendingCheckResult(state(), rolled()).nextState; const result = applyVoyageEncounterConsequencesTransition(completed, { phaseStartSnapshotId: "consequences-start" }); assert.equal(result.ok, true); assert.equal(result.nextState.phase, "consequences"); assert.equal(result.nextState.snapshots.at(-1).snapshotId, "consequences-start"); assert.deepEqual(result.events.map(x => x.type), ["voyage.consequences-started"]); });
