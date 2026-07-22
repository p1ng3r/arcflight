import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { prepareVoyageEncounterActionExecutionRequests, validateVoyageEncounterActionExecutionDefinitions } from "../../../scripts/voyage/domain/resolution-execution-requests.js";
function state() { const value = createVoyageEncounterState({ encounterId: "event", definitionId: "definition", primaryShip: { id: "ship" } }); value.lifecycleState = "active"; value.currentStage = { stageId: "stage" }; value.roundNumber = 1; value.phase = "resolution"; value.availableStations = [{ stationId: "captain", actions: [{ actionId: "automatic", resolutionPriority: 1 }, { actionId: "check", resolutionPriority: -1, check: { source: { kind: "character", nested: { id: "x" } }, statisticOptions: [" Sailing "], dcSource: { kind: "fixed", value: 20 }, secrecy: "secret", metadata: { hidden: true } } }] }]; value.selections = { captain: { stationId: "captain", actionId: "check" } }; value.targets = { captain: { id: "target" } }; return value; }
test("validates authored checks and prepares isolated deterministic check requests", () => { const value = state(), before = structuredClone(value); assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, true); const report = prepareVoyageEncounterActionExecutionRequests(value); assert.equal(report.readyForExecution, true); assert.equal(report.checkCount, 1); assert.deepEqual(report.executionRequests[0], { sequence: 0, stationId: "captain", actionId: "check", resolutionPriority: -1, riskBidId: null, target: { id: "target" }, mode: "check", source: { kind: "character", nested: { id: "x" } }, statisticOptions: [" Sailing "], dcSource: { kind: "fixed", value: 20 }, secrecy: "secret", metadata: { hidden: true } }); report.executionRequests[0].source.nested.id = "changed"; assert.equal(value.availableStations[0].actions[1].check.source.nested.id, "x"); assert.deepEqual(value, before); });
test("omitted check is valid no-roll while malformed own checks are rejected", () => { const value = state(); value.selections.captain.actionId = "automatic"; assert.equal(prepareVoyageEncounterActionExecutionRequests(value).executionRequests[0].mode, "no-roll"); value.availableStations[0].actions[0].check = null; assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, false); });

test("getter failures retain Resolution facts and return structured errors", () => {
  const value = state();
  Object.defineProperty(value.targets, "captain", { enumerable: true, get() { throw new Error("adversarial"); } });
  let report;
  assert.doesNotThrow(() => { report = prepareVoyageEncounterActionExecutionRequests(value); });
  assert.equal(report.structurallyValid, true); assert.equal(report.active, true); assert.equal(report.resolution, true);
  assert.equal(report.readyForExecution, false); assert.deepEqual(report.executionRequests, []);
  assert.ok(report.errors.some((entry) => entry.code === "execution-data-read-failed" && entry.path === "targets.captain"));
});

test("prototype-sensitive execution data is cloned as ordinary own data", () => {
  const value = state(); value.availableStations[0].actions[1].check.source = { kind: "character", __proto__: null };
  Object.defineProperty(value.availableStations[0].actions[1].check.source, "__proto__", { value: { nested: true }, enumerable: true });
  const source = prepareVoyageEncounterActionExecutionRequests(value).executionRequests[0].source;
  assert.ok(Object.hasOwn(source, "__proto__")); assert.equal(Object.getPrototypeOf(source), Object.prototype); assert.equal({}.nested, undefined);
});

test("rejects each malformed authored check shape", () => {
  for (const check of [undefined, null, [], "check", 1]) {
    const value = state(); value.availableStations[0].actions[1].check = check;
    assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, false);
  }
});

test("accepts every source and DC kind while rejecting authored no-roll", () => {
  for (const kind of ["character", "ship", "station", "crew", "custom"]) {
    const value = state(); value.availableStations[0].actions[1].check.source.kind = kind;
    assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, true);
  }
  for (const kind of ["level-based", "encounter", "stage", "hazard", "opposed", "track", "gm-entered"]) {
    const value = state(); value.availableStations[0].actions[1].check.dcSource = { kind };
    assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, true);
  }
  const value = state(); value.availableStations[0].actions[1].check.source.kind = "no-roll";
  assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, false);
});

test("statistic options retain exact valid strings and reject blanks and duplicates", () => {
  for (const option of ["", " ", "\t", "\n", 2]) { const value = state(); value.availableStations[0].actions[1].check.statisticOptions = [option]; assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, false); }
  const value = state(); value.availableStations[0].actions[1].check.statisticOptions = ["sailing", "Sailing", " sailing "];
  const report = prepareVoyageEncounterActionExecutionRequests(value); assert.deepEqual(report.executionRequests[0].statisticOptions, ["sailing", "Sailing", " sailing "]);
});

test("fixed DC and secrecy contracts reject invalid values", () => {
  for (const dc of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "20"]) { const value = state(); value.availableStations[0].actions[1].check.dcSource.value = dc; assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, false); }
  for (const secrecy of [true, "Public", "hidden"]) { const value = state(); value.availableStations[0].actions[1].check.secrecy = secrecy; assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, false); }
});

function assertReadyWithOneRead(value, readCount) {
  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, true);
  assert.equal(report.executionRequests.length, 1);
  assert.equal(readCount(), 1);
  return report;
}

test("action.check getter is read once", () => {
  const value = state();
  const action = value.availableStations[0].actions[1];
  const check = action.check;
  let readCount = 0;
  Object.defineProperty(action, "check", { enumerable: true, configurable: true, get() { readCount += 1; return check; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("check.source getter is read once", () => {
  const value = state();
  const check = value.availableStations[0].actions[1].check;
  const source = check.source;
  let readCount = 0;
  Object.defineProperty(check, "source", { enumerable: true, configurable: true, get() { readCount += 1; return source; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("source.kind getter is read once", () => {
  const value = state();
  const source = value.availableStations[0].actions[1].check.source;
  let readCount = 0;
  Object.defineProperty(source, "kind", { enumerable: true, configurable: true, get() { readCount += 1; return "character"; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("check.statisticOptions getter is read once", () => {
  const value = state();
  const check = value.availableStations[0].actions[1].check;
  const options = check.statisticOptions;
  let readCount = 0;
  Object.defineProperty(check, "statisticOptions", { enumerable: true, configurable: true, get() { readCount += 1; return options; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("own statistic-option getter is read once", () => {
  const value = state();
  const options = value.availableStations[0].actions[1].check.statisticOptions;
  let readCount = 0;
  Object.defineProperty(options, 0, { enumerable: true, configurable: true, get() { readCount += 1; return " Sailing "; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("check.dcSource getter is read once", () => {
  const value = state();
  const check = value.availableStations[0].actions[1].check;
  const dcSource = check.dcSource;
  let readCount = 0;
  Object.defineProperty(check, "dcSource", { enumerable: true, configurable: true, get() { readCount += 1; return dcSource; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("dcSource.kind getter is read once", () => {
  const value = state();
  const dcSource = value.availableStations[0].actions[1].check.dcSource;
  let readCount = 0;
  Object.defineProperty(dcSource, "kind", { enumerable: true, configurable: true, get() { readCount += 1; return "fixed"; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("fixed dcSource.value getter is read once", () => {
  const value = state();
  const dcSource = value.availableStations[0].actions[1].check.dcSource;
  let readCount = 0;
  Object.defineProperty(dcSource, "value", { enumerable: true, configurable: true, get() { readCount += 1; return 20; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("check.secrecy getter is read once", () => {
  const value = state();
  const check = value.availableStations[0].actions[1].check;
  let readCount = 0;
  Object.defineProperty(check, "secrecy", { enumerable: true, configurable: true, get() { readCount += 1; return "secret"; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("check.metadata getter is read once", () => {
  const value = state();
  const check = value.availableStations[0].actions[1].check;
  const metadata = check.metadata;
  let readCount = 0;
  Object.defineProperty(check, "metadata", { enumerable: true, configurable: true, get() { readCount += 1; return metadata; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("nested source getter is read once", () => {
  const value = state();
  const source = value.availableStations[0].actions[1].check.source;
  let readCount = 0;
  Object.defineProperty(source, "nested", { enumerable: true, configurable: true, get() { readCount += 1; return { id: "nested" }; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("target getter is read once", () => {
  const value = state();
  let readCount = 0;
  const target = { id: "target" };
  Object.defineProperty(value.targets, "captain", { enumerable: true, configurable: true, get() { readCount += 1; return target; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("nested target getter is read once", () => {
  const value = state();
  let readCount = 0;
  const target = {};
  Object.defineProperty(target, "nested", { enumerable: true, configurable: true, get() { readCount += 1; return { id: "nested" }; } });
  value.targets.captain = target;
  assertReadyWithOneRead(value, () => readCount);
});

test("secrecy is captured on its first read", () => {
  const value = state();
  const check = value.availableStations[0].actions[1].check;
  let readCount = 0;
  Object.defineProperty(check, "secrecy", { enumerable: true, configurable: true, get() { readCount += 1; return readCount === 1 ? "secret" : "public"; } });
  const report = assertReadyWithOneRead(value, () => readCount);
  assert.equal(report.executionRequests[0].secrecy, "secret");
});

test("a getter that would throw on a second read succeeds after one read", () => {
  const value = state();
  const action = value.availableStations[0].actions[1];
  const check = action.check;
  let readCount = 0;
  Object.defineProperty(action, "check", { enumerable: true, configurable: true, get() { readCount += 1; if (readCount > 1) throw new Error("second read"); return check; } });
  assertReadyWithOneRead(value, () => readCount);
});

test("a first-read getter failure is reported without throwing", () => {
  const value = state();
  const action = value.availableStations[0].actions[1];
  Object.defineProperty(action, "check", { enumerable: true, configurable: true, get() { throw new Error("first read"); } });
  let report;
  assert.doesNotThrow(() => { report = prepareVoyageEncounterActionExecutionRequests(value); });
  assert.equal(report.readyForExecution, false);
  assert.ok(report.errors.some((entry) => entry.code === "execution-data-read-failed"));
});

test("inherited station holes are ignored", () => {
  const value = state();
  value.availableStations.length = 2;
  Object.setPrototypeOf(value.availableStations, { get 1() { throw new Error("inherited station"); } });
  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, true);
  assert.equal(report.executionRequests.length, 1);
});

test("inherited action holes are ignored", () => {
  const value = state();
  value.availableStations[0].actions.length = 3;
  Object.setPrototypeOf(value.availableStations[0].actions, { get 2() { throw new Error("inherited action"); } });
  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, true);
  assert.equal(report.executionRequests.length, 1);
});

test("constructor, prototype, and __proto__ keys remain own data without pollution", () => {
  const value = state();
  const source = Object.create(null);
  for (const key of ["__proto__", "constructor", "prototype"]) Object.defineProperty(source, key, { value: { key }, enumerable: true, writable: true, configurable: true });
  Object.defineProperty(source, "kind", { value: "character", enumerable: true, writable: true, configurable: true });
  value.availableStations[0].actions[1].check.source = source;
  const report = prepareVoyageEncounterActionExecutionRequests(value);
  const captured = report.executionRequests[0].source;
  assert.equal(report.readyForExecution, true);
  for (const key of ["__proto__", "constructor", "prototype"]) assert.ok(Object.hasOwn(captured, key));
  assert.equal(Object.getPrototypeOf(captured), Object.prototype);
  assert.equal(Object.prototype.key, undefined);
});
