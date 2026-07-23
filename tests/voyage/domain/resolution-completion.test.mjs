import assert from "node:assert/strict";
import test from "node:test";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { prepareVoyageEncounterResolutionCompletion } from "../../../scripts/voyage/domain/resolution-completion.js";
import { state, rolled } from "./resolution-results.test-support.mjs";
test("reports unresolved prepared checks and completed resolution", () => { const before = state(); assert.equal(prepareVoyageEncounterResolutionCompletion(before).readyForCompletion, false); const after = applyVoyageEncounterPendingCheckResult(before, rolled()).nextState; const report = prepareVoyageEncounterResolutionCompletion(after); assert.equal(report.readyForCompletion, true); assert.equal(report.unresolvedCheckCount, 0); assert.equal(report.resolvedCheckCount, 1); });
