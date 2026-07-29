import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { prepareVoyageEncounterActionExecutionRequests, validateVoyageEncounterActionExecutionDefinitions } from "../../../scripts/voyage/domain/resolution-execution-requests.js";
function riskBidOption(riskBidId, dcAdjustment) { return { riskBidId, dcAdjustment, outcomes: { criticalSuccess: [], success: [], failure: [], criticalFailure: [] } }; }
function state() { const value = createVoyageEncounterState({ encounterId: "event", definitionId: "definition", primaryShip: { id: "ship" } }); value.lifecycleState = "active"; value.currentStage = { stageId: "stage" }; value.roundNumber = 1; value.phase = "resolution"; value.availableStations = [{ stationId: "captain", actions: [{ actionId: "automatic", resolutionPriority: 1, approaches: [{ approachId: "automatic", noRoll: true }] }, { actionId: "check", resolutionPriority: -1, approaches: [{ approachId: "sailing", statisticSlugOrAbilityId: " Sailing " }], check: { source: { kind: "character", nested: { id: "x" } }, statisticOptions: [" Sailing "], dcSource: { kind: "fixed", value: 20 }, secrecy: "secret", metadata: { hidden: true } } }] }]; value.stationAssignments = [{ stationId: "captain", operator: { kind: "actor", uuid: "Actor.captain" } }]; value.selections = { captain: { stationId: "captain", actionId: "check", approachId: "sailing", statisticSlugOrAbilityId: " Sailing " } }; value.targets = { captain: { id: "target" } }; value.committedStationOrder = ["captain"]; return value; }
function withCustomArrayPrototype(array, prototype, callback) { const previous = Object.getPrototypeOf(array); Object.setPrototypeOf(array, prototype); try { return callback(); } finally { Object.setPrototypeOf(array, previous); } }
test("validates authored checks and prepares isolated deterministic check requests", () => { const value = state(), before = structuredClone(value); assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, true); const report = prepareVoyageEncounterActionExecutionRequests(value); assert.equal(report.readyForExecution, true); assert.equal(report.checkCount, 1); assert.deepEqual(report.executionRequests[0], { sequence: 0, stationId: "captain", actionId: "check", resolutionPriority: -1, riskBidId: null, dcAdjustment: null, target: { id: "target" }, mode: "check", source: { kind: "character", nested: { id: "x" } }, approachId: "sailing", statisticSlugOrAbilityId: " Sailing ", baseDc: 20, actionDcAdjustment: 0, upgradeDcReduction: 0, riskBidDcAdjustment: 0, finalDc: 20, secrecy: "secret", metadata: { hidden: true } }); report.executionRequests[0].source.nested.id = "changed"; assert.equal(value.availableStations[0].actions[1].check.source.nested.id, "x"); assert.deepEqual(value, before); });

test("committed rolled approach identity overrides authored option ordering without fallback", () => {
  const value = state();
  const action = value.availableStations[0].actions[1];
  action.approaches = [
    { approachId: "first-authored", statisticSlugOrAbilityId: "athletics" },
    { approachId: "chosen", statisticSlugOrAbilityId: "voyaging-lore" },
    { approachId: "third-authored", statisticSlugOrAbilityId: "survival" }
  ];
  action.check.statisticOptions = ["athletics", "survival", "voyaging-lore"];
  value.selections.captain = {
    stationId: "captain",
    actionId: "check",
    approachId: "chosen",
    statisticSlugOrAbilityId: "voyaging-lore"
  };

  const first = prepareVoyageEncounterActionExecutionRequests(value);
  action.approaches.reverse();
  action.check.statisticOptions.reverse();
  const reordered = prepareVoyageEncounterActionExecutionRequests(value);

  for (const report of [first, reordered]) {
    assert.equal(report.readyForExecution, true);
    assert.equal(report.executionRequests[0].approachId, "chosen");
    assert.equal(
      report.executionRequests[0].statisticSlugOrAbilityId,
      "voyaging-lore"
    );
    assert.equal(Object.hasOwn(report.executionRequests[0], "statisticOptions"), false);
    assert.equal(Object.hasOwn(report.executionRequests[0], "dcSource"), false);
  }
});

test("a mixed action produces the exact committed no-roll request shape", () => {
  const value = state();
  value.availableStations[0].actions[1].approaches.push({
    approachId: "hold-course",
    noRoll: true
  });
  value.selections.captain = {
    stationId: "captain",
    actionId: "check",
    approachId: "hold-course",
    noRoll: true
  };

  const report = prepareVoyageEncounterActionExecutionRequests(value);
  const request = report.executionRequests[0];

  assert.equal(report.readyForExecution, true);
  assert.equal(request.mode, "no-roll");
  assert.equal(request.approachId, "hold-course");
  assert.equal(request.noRoll, true);
  assert.equal(Object.hasOwn(request, "statisticSlugOrAbilityId"), false);
  assert.equal(Object.hasOwn(request, "statisticOptions"), false);
  assert.deepEqual(request.source, { kind: "no-roll" });
  assert.equal(Object.hasOwn(request, "dcSource"), false);
  assert.deepEqual(Object.keys(request), [
    "sequence",
    "stationId",
    "actionId",
    "resolutionPriority",
    "riskBidId",
    "dcAdjustment",
    "target",
    "mode",
    "source",
    "approachId",
    "noRoll",
    "secrecy",
    "metadata"
  ]);
  for (const field of [
    "statisticSlugOrAbilityId",
    "baseDc",
    "actionDcAdjustment",
    "upgradeDcReduction",
    "riskBidDcAdjustment",
    "finalDc"
  ]) {
    assert.equal(Object.hasOwn(request, field), false, field);
  }
});

test("missing, mismatched, unknown, and contradictory committed approaches fail atomically", () => {
  const fixtures = [
    {
      mutate(value) {
        value.selections.captain = {
          stationId: "captain",
          actionId: "check"
        };
      },
      code: "missing-execution-approach-selection-field"
    },
    {
      mutate(value) {
        value.selections.captain.actionId = "automatic";
      },
      code: "selected-approach-not-available"
    },
    {
      mutate(value) {
        value.selections.captain.approachId = "unknown";
      },
      code: "selected-approach-not-available"
    },
    {
      mutate(value) {
        value.selections.captain.statisticSlugOrAbilityId = "athletics";
      },
      code: "selection-statistic-or-ability-id-mismatch"
    },
    {
      mutate(value) {
        value.selections.captain = {
          stationId: "captain",
          actionId: "automatic",
          approachId: "automatic",
          statisticSlugOrAbilityId: "athletics"
        };
      },
      code: "selection-approach-execution-mismatch"
    },
    {
      mutate(value) {
        value.selections.captain = {
          stationId: "captain",
          actionId: "check",
          approachId: "sailing",
          noRoll: true
        };
      },
      code: "selection-approach-execution-mismatch"
    }
  ];

  for (const { mutate, code } of fixtures) {
    const value = state();
    mutate(value);
    const before = structuredClone(value);
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(report.readyForExecution, false);
    assert.deepEqual(report.executionRequests, []);
    assert.equal(report.actionCount, 0);
    assert.ok(report.errors.some((entry) => entry.code === code), code);
    assert.deepEqual(value, before);
  }
});

test("duplicate and station-mismatched committed selections fail without partial output", () => {
  const value = state();
  value.selections.duplicate = {
    stationId: "captain",
    actionId: "check",
    approachId: "sailing",
    statisticSlugOrAbilityId: " Sailing "
  };
  const before = structuredClone(value);

  const first = prepareVoyageEncounterActionExecutionRequests(value);
  const second = prepareVoyageEncounterActionExecutionRequests(value);

  assert.equal(first.readyForExecution, false);
  assert.deepEqual(first.executionRequests, []);
  assert.deepEqual(first.errors, second.errors);
  assert.ok(first.errors.some(
    (entry) => entry.code === "duplicate-execution-approach-selection"
  ));
  assert.ok(first.errors.some(
    (entry) => entry.code === "execution-approach-selection-station-mismatch"
  ));
  assert.deepEqual(value, before);
});

test("inherited and accessor-backed selection identities are rejected without getter execution", () => {
  for (const accessor of [false, true]) {
    const value = state();
    const selection = {
      stationId: "captain",
      actionId: "check",
      statisticSlugOrAbilityId: " Sailing "
    };
    let reads = 0;
    if (accessor) {
      Object.defineProperty(selection, "approachId", {
        enumerable: true,
        configurable: true,
        get() {
          reads += 1;
          throw new Error("hostile approach identity");
        }
      });
    } else {
      const prototype = {};
      Object.defineProperty(prototype, "approachId", {
        configurable: true,
        get() {
          reads += 1;
          throw new Error("inherited approach identity");
        }
      });
      Object.setPrototypeOf(selection, prototype);
    }
    value.selections.captain = selection;

    let report;
    assert.doesNotThrow(() => {
      report = prepareVoyageEncounterActionExecutionRequests(value);
    });
    assert.equal(report.readyForExecution, false);
    assert.deepEqual(report.executionRequests, []);
    assert.equal(reads, 0);
  }
});

test("malformed and hostile selection collections fail safely and deterministically", () => {
  const malformed = state();
  malformed.selections = [];
  malformed.selections.length = 0xffffffff;
  let malformedReport;
  assert.doesNotThrow(() => {
    malformedReport = prepareVoyageEncounterActionExecutionRequests(malformed);
  });
  assert.equal(malformedReport.readyForExecution, false);
  assert.deepEqual(malformedReport.executionRequests, []);

  const hostile = state();
  let reads = 0;
  Object.defineProperty(hostile.selections, "captain", {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      throw new Error("hostile selection entry");
    }
  });
  const first = prepareVoyageEncounterActionExecutionRequests(hostile);
  const second = prepareVoyageEncounterActionExecutionRequests(hostile);
  assert.equal(first.readyForExecution, false);
  assert.deepEqual(first.executionRequests, []);
  assert.deepEqual(first.errors, second.errors);
  assert.equal(reads, 0);
});

test("separate execution requests isolate selected identity and nested source data", () => {
  const value = state();
  const sharedSource = value.availableStations[0].actions[1].check.source;
  value.availableStations.push({
    stationId: "engineer",
    actions: [{
      actionId: "repair",
      approaches: [{
        approachId: "crafting",
        statisticSlugOrAbilityId: "crafting"
      }],
      check: {
        source: sharedSource,
        statisticOptions: ["crafting"],
        dcSource: { kind: "fixed", value: 18 },
        secrecy: "public",
        metadata: {}
      }
    }]
  });
  value.stationAssignments.push({
    stationId: "engineer",
    operator: { kind: "actor", uuid: "Actor.engineer" }
  });
  value.selections.engineer = {
    stationId: "engineer",
    actionId: "repair",
    approachId: "crafting",
    statisticSlugOrAbilityId: "crafting"
  };
  value.committedStationOrder = ["captain", "engineer"];

  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, true);
  assert.equal(report.executionRequests.length, 2);
  assert.notEqual(
    report.executionRequests[0].source,
    report.executionRequests[1].source
  );
  report.executionRequests[0].source.nested.id = "first-only";
  report.executionRequests[0].approachId = "first-only";
  assert.equal(report.executionRequests[1].source.nested.id, "x");
  assert.equal(report.executionRequests[1].approachId, "crafting");
  assert.equal(sharedSource.nested.id, "x");
});

test("approach selections cannot forge the authoritative execution source", () => {
  const forged = state();
  forged.selections.captain.source = {
    kind: "character",
    uuid: "Actor.forged"
  };
  const rejected = prepareVoyageEncounterActionExecutionRequests(forged);
  assert.equal(rejected.readyForExecution, false);
  assert.deepEqual(rejected.executionRequests, []);
  assert.ok(rejected.errors.some(
    (entry) => entry.code === "unexpected-execution-approach-selection-field"
  ));

  const accepted = prepareVoyageEncounterActionExecutionRequests(state());
  assert.deepEqual(accepted.executionRequests[0].source, {
    kind: "character",
    nested: { id: "x" }
  });
});

test("execution requests apply every canonical Risk Bid tier exactly once", () => {
  for (const dcAdjustment of [2, 5, 8]) {
    const value = state();
    const action = value.availableStations[0].actions[1];
    action.approaches = [{
      approachId: "sailing",
      statisticSlugOrAbilityId: "sailing"
    }];
    action.riskBidOptions = [
      riskBidOption(`bid-${dcAdjustment}`, dcAdjustment)
    ];
    value.selections.captain = {
      stationId: "captain",
      actionId: "check",
      approachId: "sailing",
      statisticSlugOrAbilityId: "sailing"
    };
    value.riskBids.captain = {
      stationId: "captain",
      actionId: "check",
      riskBidId: `bid-${dcAdjustment}`,
      dcAdjustment
    };
    const before = structuredClone(value);
    const first = prepareVoyageEncounterActionExecutionRequests(value);
    const second = prepareVoyageEncounterActionExecutionRequests(value);

    assert.equal(first.readyForExecution, true);
    assert.equal(first.executionRequests.length, 1);
    assert.equal(first.executionRequests[0].riskBidId, `bid-${dcAdjustment}`);
    assert.equal(first.executionRequests[0].dcAdjustment, dcAdjustment);
    assert.equal(Object.hasOwn(first.executionRequests[0], "dcSource"), false);
    assert.equal(Object.hasOwn(first.executionRequests[0], "statisticOptions"), false);
    assert.equal(first.executionRequests[0].baseDc, 20);
    assert.equal(first.executionRequests[0].actionDcAdjustment, 0);
    assert.equal(first.executionRequests[0].upgradeDcReduction, 0);
    assert.equal(first.executionRequests[0].riskBidDcAdjustment, dcAdjustment);
    assert.equal(first.executionRequests[0].finalDc, 20 + dcAdjustment);
    assert.equal(second.executionRequests[0].finalDc, 20 + dcAdjustment);
    assert.equal(Object.hasOwn(first.executionRequests[0], "outcomes"), false);
    first.executionRequests[0].riskBidId = "changed";
    assert.equal(second.executionRequests[0].riskBidId, `bid-${dcAdjustment}`);
    assert.deepEqual(value, before);
  }
});

test("execution analysis rejects contradictory no-roll and stale Risk Bid state", () => {
  const noRoll = state();
  noRoll.availableStations[0].actions[0].approaches = [{
    approachId: "automatic",
    noRoll: true
  }];
  noRoll.availableStations[0].actions[0].riskBidOptions = [
    riskBidOption("invalid-no-roll-bid", 2)
  ];
  noRoll.selections.captain = {
    stationId: "captain",
    actionId: "automatic",
    approachId: "automatic",
    noRoll: true
  };
  noRoll.riskBids.captain = {
    stationId: "captain",
    actionId: "automatic",
    riskBidId: "invalid-no-roll-bid",
    dcAdjustment: 2
  };
  let report = prepareVoyageEncounterActionExecutionRequests(noRoll);
  assert.equal(report.readyForExecution, false);
  assert.deepEqual(report.executionRequests, []);
  assert.ok(report.errors.some(
    (entry) => entry.code === "risk-bid-requires-rolled-approach"
  ));

  const stale = state();
  stale.availableStations[0].actions[1].approaches = [{
    approachId: "sailing",
    statisticSlugOrAbilityId: "sailing"
  }];
  stale.availableStations[0].actions[1].riskBidOptions = [
    riskBidOption("bid", 2)
  ];
  stale.selections.captain = {
    stationId: "captain",
    actionId: "check",
    approachId: "sailing",
    statisticSlugOrAbilityId: "sailing"
  };
  stale.riskBids.captain = {
    stationId: "captain",
    actionId: "check",
    riskBidId: "bid",
    dcAdjustment: 5
  };
  report = prepareVoyageEncounterActionExecutionRequests(stale);
  assert.equal(report.readyForExecution, false);
  assert.deepEqual(report.executionRequests, []);
  assert.ok(report.errors.some(
    (entry) => entry.code === "risk-bid-dc-adjustment-mismatch"
  ));
});

test("execution requests preserve committed order when authored priorities conflict", () => {
  const value = state();
  value.availableStations[0].actions[1].resolutionPriority = -100;
  value.availableStations.push({
    stationId: "engineer",
    actions: [{
      actionId: "repair",
      resolutionPriority: 100,
      approaches: [{ approachId: "automatic-repair", noRoll: true }]
    }]
  });
  value.stationAssignments.push({
    stationId: "engineer",
    operator: { kind: "actor", uuid: "Actor.engineer" }
  });
  value.selections.engineer = {
    stationId: "engineer",
    actionId: "repair",
    approachId: "automatic-repair",
    noRoll: true
  };
  value.committedStationOrder = ["engineer", "captain"];

  const report = prepareVoyageEncounterActionExecutionRequests(value);

  assert.equal(report.readyForExecution, true);
  assert.deepEqual(
    report.executionRequests.map(({ sequence, stationId }) => ({ sequence, stationId })),
    [
      { sequence: 0, stationId: "engineer" },
      { sequence: 1, stationId: "captain" }
    ]
  );
});
test("omitted check is valid no-roll while malformed own checks are rejected", () => { const value = state(); value.selections.captain = { stationId: "captain", actionId: "automatic", approachId: "automatic", noRoll: true }; const request = prepareVoyageEncounterActionExecutionRequests(value).executionRequests[0]; assert.equal(request.mode, "no-roll"); assert.equal(request.approachId, "automatic"); assert.equal(request.noRoll, true); assert.equal(Object.hasOwn(request, "statisticSlugOrAbilityId"), false); assert.equal(Object.hasOwn(request, "statisticOptions"), false); assert.equal(Object.hasOwn(request, "dcSource"), false); value.availableStations[0].actions[0].check = null; assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, false); });

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

test("accepts every source kind and deterministically defers unresolved DC kinds", () => {
  for (const kind of ["character", "ship", "station", "crew", "custom"]) {
    const value = state(); value.availableStations[0].actions[1].check.source.kind = kind;
    assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, true);
  }
  for (const kind of ["level-based", "encounter", "stage", "hazard", "opposed", "track", "gm-entered"]) {
    const value = state(); value.availableStations[0].actions[1].check.dcSource = { kind };
    assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, true);
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(report.readyForExecution, false);
    assert.deepEqual(report.executionRequests, []);
    assert.ok(report.errors.some(
      (entry) => entry.code === "unresolved-execution-dc-source"
        && entry.path.endsWith(".check.dcSource.kind")
    ));
  }
  const value = state(); value.availableStations[0].actions[1].check.source.kind = "no-roll";
  assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, false);
});

test("statistic options retain exact valid strings and reject blanks and duplicates", () => {
  for (const option of ["", " ", "\t", "\n", 2]) { const value = state(); value.availableStations[0].actions[1].check.statisticOptions = [option]; assert.equal(validateVoyageEncounterActionExecutionDefinitions(value).valid, false); }
  const value = state(); value.availableStations[0].actions[1].check.statisticOptions = ["sailing", "Sailing", " sailing "];
  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.executionRequests[0].statisticSlugOrAbilityId, " Sailing ");
  assert.equal(Object.hasOwn(report.executionRequests[0], "statisticOptions"), false);
});

test("accepts statisticOptions arrays with custom prototypes", () => {
  const value = state();
  const options = [" Sailing "];
  withCustomArrayPrototype(options, Object.create(Array.prototype), () => {
    value.availableStations[0].actions[1].check.statisticOptions = options;
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(report.readyForExecution, true);
  });
});

test("ignores inherited statistic options without evaluating them", () => {
  const value = state();
  const options = [" Sailing "];
  options.length = 2;
  let readCount = 0;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, { configurable: true, get() { readCount += 1; throw new Error("inherited statistic option"); } });
  withCustomArrayPrototype(options, prototype, () => {
    value.availableStations[0].actions[1].check.statisticOptions = options;
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(report.readyForExecution, true);
    assert.equal(readCount, 0);
  });
});

test("authored statisticOptions never become the runtime selection contract", () => {
  const value = state();
  const options = [" Sailing "];
  options.length = 2;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, { configurable: true, value: "inherited", enumerable: true });
  withCustomArrayPrototype(options, prototype, () => {
    value.availableStations[0].actions[1].check.statisticOptions = options;
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(report.readyForExecution, true);
    assert.equal(report.executionRequests[0].statisticSlugOrAbilityId, " Sailing ");
    assert.equal(Object.hasOwn(report.executionRequests[0], "statisticOptions"), false);
    assert.equal(Object.hasOwn(report.executionRequests[0], "dcSource"), false);
  });
});

test("nested source arrays with custom prototypes capture only own entries", () => {
  const value = state();
  const nested = ["own"];
  nested.length = 2;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, { configurable: true, value: "inherited", enumerable: true });
  withCustomArrayPrototype(nested, prototype, () => {
    value.availableStations[0].actions[1].check.source.nested = nested;
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    const captured = report.executionRequests[0].source.nested;
    assert.equal(report.readyForExecution, true);
    assert.deepEqual(Object.keys(captured), ["0"]);
    assert.equal(captured[0], "own");
    assert.equal(Object.hasOwn(captured, 1), false);
  });
});

test("target arrays with custom prototypes capture only own entries", () => {
  const value = state();
  const target = [{ id: "own" }];
  target.length = 2;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, { configurable: true, value: { id: "inherited" }, enumerable: true });
  withCustomArrayPrototype(target, prototype, () => {
    value.targets.captain = target;
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    const captured = report.executionRequests[0].target;
    assert.equal(report.readyForExecution, true);
    assert.deepEqual(Object.keys(captured), ["0"]);
    assert.deepEqual(captured[0], { id: "own" });
    assert.equal(Object.hasOwn(captured, 1), false);
  });
});

test("throwing inherited numeric getters are never executed", () => {
  const value = state();
  const options = [" Sailing "]; options.length = 2;
  const sourceValues = ["own"]; sourceValues.length = 2;
  const target = [{ id: "own" }]; target.length = 2;
  let readCount = 0;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, { configurable: true, get() { readCount += 1; throw new Error("inherited numeric entry"); } });
  withCustomArrayPrototype(options, prototype, () => withCustomArrayPrototype(sourceValues, prototype, () => withCustomArrayPrototype(target, prototype, () => {
    value.availableStations[0].actions[1].check.statisticOptions = options;
    value.availableStations[0].actions[1].check.source.nested = sourceValues;
    value.targets.captain = target;
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(report.readyForExecution, true);
    assert.equal(readCount, 0);
  })));
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

test("check.dcSource accessor is rejected without execution", () => {
  const value = state();
  const check = value.availableStations[0].actions[1].check;
  const dcSource = check.dcSource;
  let readCount = 0;
  Object.defineProperty(check, "dcSource", { enumerable: true, configurable: true, get() { readCount += 1; return dcSource; } });
  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, false);
  assert.deepEqual(report.executionRequests, []);
  assert.equal(readCount, 0);
});

test("dcSource.kind accessor is rejected without execution", () => {
  const value = state();
  const dcSource = value.availableStations[0].actions[1].check.dcSource;
  let readCount = 0;
  Object.defineProperty(dcSource, "kind", { enumerable: true, configurable: true, get() { readCount += 1; return "fixed"; } });
  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, false);
  assert.deepEqual(report.executionRequests, []);
  assert.equal(readCount, 0);
});

test("fixed dcSource.value accessor is rejected without execution", () => {
  const value = state();
  const dcSource = value.availableStations[0].actions[1].check.dcSource;
  let readCount = 0;
  Object.defineProperty(dcSource, "value", { enumerable: true, configurable: true, get() { readCount += 1; return 20; } });
  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, false);
  assert.deepEqual(report.executionRequests, []);
  assert.equal(readCount, 0);
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
  withCustomArrayPrototype(value.availableStations, { get 1() { throw new Error("inherited station"); } }, () => {
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(report.readyForExecution, true);
    assert.equal(report.executionRequests.length, 1);
  });
});

test("inherited action holes are ignored", () => {
  const value = state();
  value.availableStations[0].actions.length = 3;
  withCustomArrayPrototype(value.availableStations[0].actions, { get 2() { throw new Error("inherited action"); } }, () => {
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(report.readyForExecution, true);
    assert.equal(report.executionRequests.length, 1);
  });
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

function configureFinalDc(value, {
  actionDcAdjustment = 0,
  upgradeDcReduction = 0,
  riskBidDcAdjustment = 0
} = {}) {
  const action = value.availableStations[0].actions[1];
  action.check.actionDcAdjustment = actionDcAdjustment;
  action.check.upgradeDcReduction = upgradeDcReduction;
  if (riskBidDcAdjustment !== 0) {
    const riskBidId = `bid-${riskBidDcAdjustment}`;
    action.riskBidOptions = [
      riskBidOption(riskBidId, riskBidDcAdjustment)
    ];
    value.riskBids.captain = {
      stationId: "captain",
      actionId: "check",
      riskBidId,
      dcAdjustment: riskBidDcAdjustment
    };
  }
  return value;
}

test("constructs canonical final DC components with the reduction cap before the bid", () => {
  const cases = [
    {
      actionDcAdjustment: -2,
      upgradeDcReduction: 2,
      riskBidDcAdjustment: 0,
      finalDc: 16
    },
    {
      actionDcAdjustment: -3,
      upgradeDcReduction: 4,
      riskBidDcAdjustment: 0,
      finalDc: 15
    },
    {
      actionDcAdjustment: -3,
      upgradeDcReduction: 4,
      riskBidDcAdjustment: 5,
      finalDc: 20
    },
    {
      actionDcAdjustment: 2,
      upgradeDcReduction: 0,
      riskBidDcAdjustment: 2,
      finalDc: 24
    }
  ];

  for (const expected of cases) {
    const value = configureFinalDc(state(), expected);
    const before = structuredClone(value);
    const first = prepareVoyageEncounterActionExecutionRequests(value);
    const second = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(first.readyForExecution, true);
    assert.deepEqual(first.executionRequests, second.executionRequests);
    assert.deepEqual(
      {
        baseDc: first.executionRequests[0].baseDc,
        actionDcAdjustment: first.executionRequests[0].actionDcAdjustment,
        upgradeDcReduction: first.executionRequests[0].upgradeDcReduction,
        riskBidDcAdjustment: first.executionRequests[0].riskBidDcAdjustment,
        finalDc: first.executionRequests[0].finalDc
      },
      { baseDc: 20, ...expected }
    );
    assert.deepEqual(value, before);
  }
});

test("the cap limits reductions without erasing positive action increases", () => {
  for (const fixture of [
    { actionDcAdjustment: -5, upgradeDcReduction: 0, finalDc: 15 },
    { actionDcAdjustment: -6, upgradeDcReduction: 0, finalDc: 15 },
    { actionDcAdjustment: 3, upgradeDcReduction: 2, finalDc: 21 },
    { actionDcAdjustment: 5, upgradeDcReduction: 0, finalDc: 25 }
  ]) {
    const report = prepareVoyageEncounterActionExecutionRequests(
      configureFinalDc(state(), fixture)
    );
    assert.equal(report.readyForExecution, true);
    assert.equal(report.executionRequests[0].finalDc, fixture.finalDc);
  }
});

test("component carriers are exact integers and malformed input fails atomically", () => {
  const malformedActionAdjustments = [
    NaN,
    Infinity,
    -Infinity,
    1.5,
    "2",
    new Number(2),
    Number.MAX_SAFE_INTEGER + 1
  ];
  for (const actionDcAdjustment of malformedActionAdjustments) {
    const value = state();
    value.availableStations[0].actions[1].check.actionDcAdjustment = actionDcAdjustment;
    const beforeDc = value.availableStations[0].actions[1].check.dcSource.value;
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(report.readyForExecution, false);
    assert.deepEqual(report.executionRequests, []);
    assert.equal(value.availableStations[0].actions[1].check.dcSource.value, beforeDc);
    assert.ok(report.errors.some(
      (entry) => entry.code === "invalid-action-dc-adjustment"
    ));
  }

  for (const upgradeDcReduction of [
    -1,
    NaN,
    Infinity,
    1.5,
    "2",
    new Number(2),
    Number.MAX_SAFE_INTEGER + 1
  ]) {
    const value = state();
    value.availableStations[0].actions[1].check.upgradeDcReduction = upgradeDcReduction;
    const report = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(report.readyForExecution, false);
    assert.deepEqual(report.executionRequests, []);
    assert.ok(report.errors.some(
      (entry) => entry.code === "invalid-upgrade-dc-reduction"
    ));
  }
});

test("unsafe intermediate and final arithmetic is rejected", () => {
  const intermediate = state();
  intermediate.availableStations[0].actions[1].check.dcSource.value = Number.MAX_SAFE_INTEGER;
  intermediate.availableStations[0].actions[1].check.actionDcAdjustment = 1;
  let report = prepareVoyageEncounterActionExecutionRequests(intermediate);
  assert.equal(report.readyForExecution, false);
  assert.deepEqual(report.executionRequests, []);
  assert.ok(report.errors.some(
    (entry) => entry.code === "unsafe-final-dc-arithmetic"
  ));

  const final = configureFinalDc(state(), { riskBidDcAdjustment: 8 });
  final.availableStations[0].actions[1].check.dcSource.value = Number.MAX_SAFE_INTEGER;
  report = prepareVoyageEncounterActionExecutionRequests(final);
  assert.equal(report.readyForExecution, false);
  assert.deepEqual(report.executionRequests, []);
  assert.ok(report.errors.some(
    (entry) => entry.code === "unsafe-final-dc-arithmetic"
  ));
});

test("negative constructed final DC is rejected at the request boundary", () => {
  const value = configureFinalDc(state(), { actionDcAdjustment: -1 });
  value.availableStations[0].actions[1].check.dcSource.value = 0;
  const before = structuredClone(value);
  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, false);
  assert.deepEqual(report.executionRequests, []);
  assert.ok(report.errors.some(
    (entry) => entry.code === "invalid-final-dc"
  ));
  assert.deepEqual(value, before);
});

test("accessor-backed and inherited numeric carriers are rejected without reads", () => {
  for (const field of [
    "actionDcAdjustment",
    "upgradeDcReduction"
  ]) {
    const accessor = state();
    const check = accessor.availableStations[0].actions[1].check;
    let reads = 0;
    Object.defineProperty(check, field, {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        throw new Error("hostile numeric carrier");
      }
    });
    const report = prepareVoyageEncounterActionExecutionRequests(accessor);
    assert.equal(report.readyForExecution, false);
    assert.deepEqual(report.executionRequests, []);
    assert.equal(reads, 0);

    const inherited = state();
    const inheritedCheck = inherited.availableStations[0].actions[1].check;
    const prototype = {};
    Object.defineProperty(prototype, field, {
      configurable: true,
      get() {
        reads += 1;
        throw new Error("inherited numeric carrier");
      }
    });
    Object.setPrototypeOf(inheritedCheck, prototype);
    const inheritedReport = prepareVoyageEncounterActionExecutionRequests(inherited);
    assert.equal(inheritedReport.readyForExecution, false);
    assert.deepEqual(inheritedReport.executionRequests, []);
    assert.equal(reads, 0);
  }
});

test("fixed DC records require exact own data and reject hostile records", () => {
  for (const mutate of [
    (dcSource) => { delete dcSource.value; },
    (dcSource) => { dcSource.value = 1.5; },
    (dcSource) => { dcSource.value = Infinity; },
    (dcSource) => { dcSource.value = "20"; },
    (dcSource) => { dcSource.extra = true; },
    (dcSource) => { dcSource[Symbol("dc")] = 20; }
  ]) {
    const value = state();
    mutate(value.availableStations[0].actions[1].check.dcSource);
    const first = prepareVoyageEncounterActionExecutionRequests(value);
    const second = prepareVoyageEncounterActionExecutionRequests(value);
    assert.equal(first.readyForExecution, false);
    assert.deepEqual(first.executionRequests, []);
    assert.deepEqual(first.errors, second.errors);
  }

  const inherited = state();
  const dcSource = inherited.availableStations[0].actions[1].check.dcSource;
  delete dcSource.value;
  Object.setPrototypeOf(dcSource, { value: 20 });
  const report = prepareVoyageEncounterActionExecutionRequests(inherited);
  assert.equal(report.readyForExecution, false);
  assert.deepEqual(report.executionRequests, []);
});

test("a committed no-roll approach skips otherwise unresolved DC construction", () => {
  const value = state();
  const action = value.availableStations[0].actions[1];
  action.approaches.push({ approachId: "automatic-check", noRoll: true });
  action.check.dcSource = { kind: "encounter" };
  value.selections.captain = {
    stationId: "captain",
    actionId: "check",
    approachId: "automatic-check",
    noRoll: true
  };

  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, true);
  assert.equal(report.executionRequests[0].noRoll, true);
  assert.equal(
    report.errors.some((entry) => entry.code === "unresolved-execution-dc-source"),
    false
  );
  for (const field of [
    "baseDc",
    "actionDcAdjustment",
    "upgradeDcReduction",
    "riskBidDcAdjustment",
    "finalDc"
  ]) {
    assert.equal(Object.hasOwn(report.executionRequests[0], field), false);
  }
});

test("unknown canonical Risk Bid identity fails atomically", () => {
  const value = state();
  value.availableStations[0].actions[1].riskBidOptions = [
    riskBidOption("offered", 2)
  ];
  value.riskBids.captain = {
    stationId: "captain",
    actionId: "check",
    riskBidId: "unknown",
    dcAdjustment: 2
  };
  const before = structuredClone(value);
  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, false);
  assert.deepEqual(report.executionRequests, []);
  assert.deepEqual(value, before);
  assert.ok(report.errors.some(
    (entry) => entry.code === "risk-bid-not-available"
  ));
});

test("approach ordering and selection payload cannot influence DC arithmetic", () => {
  const value = configureFinalDc(state(), {
    actionDcAdjustment: -2,
    upgradeDcReduction: 1,
    riskBidDcAdjustment: 2
  });
  const first = prepareVoyageEncounterActionExecutionRequests(value);
  value.availableStations[0].actions[1].approaches.reverse();
  value.availableStations[0].actions[1].check.statisticOptions.reverse();
  const reordered = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(first.executionRequests[0].finalDc, 19);
  assert.equal(reordered.executionRequests[0].finalDc, 19);

  value.selections.captain.actionDcAdjustment = 100;
  const forged = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(forged.readyForExecution, false);
  assert.deepEqual(forged.executionRequests, []);
  assert.ok(forged.errors.some(
    (entry) => entry.code === "unexpected-execution-approach-selection-field"
  ));
});

test("authored DC sources do not survive into sibling runtime requests", () => {
  const value = state();
  const sharedDcSource = value.availableStations[0].actions[1].check.dcSource;
  value.availableStations.push({
    stationId: "engineer",
    actions: [{
      actionId: "repair",
      approaches: [{
        approachId: "crafting",
        statisticSlugOrAbilityId: "crafting"
      }],
      check: {
        source: { kind: "character" },
        statisticOptions: ["crafting"],
        dcSource: sharedDcSource,
        secrecy: "public"
      }
    }]
  });
  value.stationAssignments.push({
    stationId: "engineer",
    operator: { kind: "actor", uuid: "Actor.engineer" }
  });
  value.selections.engineer = {
    stationId: "engineer",
    actionId: "repair",
    approachId: "crafting",
    statisticSlugOrAbilityId: "crafting"
  };
  value.committedStationOrder = ["captain", "engineer"];

  const report = prepareVoyageEncounterActionExecutionRequests(value);
  assert.equal(report.readyForExecution, true);
  assert.equal(Object.hasOwn(report.executionRequests[0], "dcSource"), false);
  assert.equal(Object.hasOwn(report.executionRequests[1], "dcSource"), false);
  assert.equal(report.executionRequests[0].finalDc, 20);
  assert.equal(report.executionRequests[1].finalDc, 20);
  assert.equal(sharedDcSource.value, 20);
});
