import assert from "node:assert/strict";
import test from "node:test";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { state, rolled } from "./resolution-results.test-support.mjs";
test("requires the exact successful execution-result contract", () => {
  for (const mutate of [value => delete value.rollMode, value => value.extra = true, value => value.errors = ["x"], value => value.result.total = Infinity]) {
    const value = rolled(); mutate(value);
    assert.equal(applyVoyageEncounterPendingCheckResult(state(), value).ok, false);
  }
});
