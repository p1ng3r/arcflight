import assert from "node:assert/strict";
import test from "node:test";

import {
  applyVoyageEncounterRiskBidChange,
  applyVoyageEncounterRiskBidClear,
  applyVoyageEncounterRiskBidSelection,
  analyzeAuthoredVoyageRiskBidOptions,
  validateVoyageEncounterRiskBids
} from "../../../scripts/voyage/domain/risk-bids.js";
import {
  applyVoyageEncounterStationActionSelectionChange,
  applyVoyageEncounterStationActionSelectionClear
} from "../../../scripts/voyage/domain/station-selection.js";
import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES,
  VOYAGE_ROUND_PHASES
} from "../../../scripts/voyage/domain/constants.js";
import {
  clonePlainData,
  createDraftVoyageEncounterDefaults
} from "../../../scripts/voyage/domain/defaults.js";

const OMITTED = Symbol("omitted");

function outcomes(overrides = {}) {
  return {
    criticalSuccess: [],
    success: [],
    failure: [],
    criticalFailure: [],
    ...overrides
  };
}

function option(riskBidId, dcAdjustment, outcomeOverrides = {}) {
  return {
    riskBidId,
    dcAdjustment,
    outcomes: outcomes(outcomeOverrides)
  };
}

function analyze(riskBidOptions, analyzerOptions = {}) {
  const action = {};
  if (riskBidOptions !== OMITTED) action.riskBidOptions = riskBidOptions;
  const errors = [];
  const analysis = analyzeAuthoredVoyageRiskBidOptions(
    action,
    "action.riskBidOptions",
    errors,
    analyzerOptions
  );
  return { action, analysis, errors };
}

function state() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "risk",
    definitionId: "definition",
    lifecycleState: STATES.ACTIVE,
    revision: 3,
    primaryShip: { actorId: "ship" },
    currentStage: { stageId: "stage" },
    roundNumber: 1,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    availableStations: [{
      stationId: "navigator",
      actions: [{
        actionId: "thread",
        approaches: [
          {
            approachId: "survival",
            statisticSlugOrAbilityId: "survival"
          },
          {
            approachId: "steady-course",
            noRoll: true
          }
        ],
        riskBidOptions: [
          option("close", 2),
          option("bold", 5)
        ]
      }, {
        actionId: "safe",
        approaches: [{
          approachId: "careful",
          statisticSlugOrAbilityId: "survival"
        }]
      }]
    }, {
      stationId: "captain",
      actions: [{
        actionId: "rally",
        approaches: [{
          approachId: "diplomacy",
          statisticSlugOrAbilityId: "diplomacy"
        }],
        riskBidOptions: [option("press", 8)]
      }]
    }],
    stationAssignments: [{
      stationId: "navigator",
      operator: { kind: "actor", uuid: "Actor.navigator" }
    }, {
      stationId: "captain",
      operator: { kind: "actor", uuid: "Actor.captain" }
    }],
    selections: {
      navigator: {
        stationId: "navigator",
        actionId: "thread",
        approachId: "survival",
        statisticSlugOrAbilityId: "survival"
      },
      captain: {
        stationId: "captain",
        actionId: "rally",
        approachId: "diplomacy",
        statisticSlugOrAbilityId: "diplomacy"
      }
    },
    successConditions: [{ conditionId: "ok" }],
    failureConditions: [{ conditionId: "no" }]
  };
}

const bid = (
  stationId = "navigator",
  actionId = "thread",
  riskBidId = "close",
  dcAdjustment = 2
) => ({ stationId, actionId, riskBidId, dcAdjustment });

function expectFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.equal(result.errors[0].code, code);
}

test("omitted and empty options normalize to exact empty envelopes", () => {
  for (const supplied of [OMITTED, []]) {
    const { analysis, errors } = analyze(supplied);
    assert.deepEqual(analysis, {
      options: [],
      optionRecords: [],
      referenceRecords: []
    });
    assert.deepEqual(errors, []);
  }
});

test("each canonical tier and every tier subset normalize without sorting", () => {
  const subsets = [
    [option("plus-two", 2)],
    [option("plus-five", 5)],
    [option("plus-eight", 8)],
    [option("five", 5), option("two", 2)],
    [option("eight", 8), option("two", 2)],
    [option("eight", 8), option("five", 5), option("two", 2)]
  ];

  for (const source of subsets) {
    const { analysis, errors } = analyze(source);
    assert.deepEqual(errors, []);
    assert.deepEqual(
      analysis.options.map(({ riskBidId, dcAdjustment }) => ({
        riskBidId,
        dcAdjustment
      })),
      source.map(({ riskBidId, dcAdjustment }) => ({
        riskBidId,
        dcAdjustment
      }))
    );
    for (const normalized of analysis.options) {
      assert.deepEqual(normalized.outcomes, outcomes());
    }
  }
});

test("duplicate IDs, duplicate tiers, and noncanonical adjustments are rejected", () => {
  const duplicateId = analyze([
    option("same", 2),
    option("same", 5)
  ]);
  assert.ok(duplicateId.errors.some(
    (entry) => entry.code === "duplicate-risk-bid-id"
      && entry.path === "action.riskBidOptions[1].riskBidId"
  ));

  const duplicateTier = analyze([
    option("first", 5),
    option("second", 5)
  ]);
  assert.ok(duplicateTier.errors.some(
    (entry) => entry.code === "duplicate-risk-bid-dc-adjustment"
      && entry.path === "action.riskBidOptions[1].dcAdjustment"
  ));

  for (const adjustment of [0, 1, 3, "2", NaN, Infinity]) {
    const { analysis, errors } = analyze([option("bad", adjustment)]);
    assert.equal(analysis.options[0], undefined);
    assert.ok(errors.some(
      (entry) => entry.code === "invalid-risk-bid-dc-adjustment"
        && entry.path === "action.riskBidOptions[0].dcAdjustment"
    ), String(adjustment));
  }
});

test("all exact fields and four outcome branches are required", () => {
  for (const [mutate, code, path] of [
    [(value) => { delete value.riskBidId; }, "missing-risk-bid-id", ".riskBidId"],
    [(value) => { delete value.dcAdjustment; }, "missing-risk-bid-dc-adjustment", ".dcAdjustment"],
    [(value) => { delete value.outcomes; }, "missing-risk-bid-outcomes", ".outcomes"],
    [(value) => { delete value.outcomes.criticalSuccess; }, "missing-risk-bid-outcome-branch", ".outcomes.criticalSuccess"],
    [(value) => { delete value.outcomes.success; }, "missing-risk-bid-outcome-branch", ".outcomes.success"],
    [(value) => { delete value.outcomes.failure; }, "missing-risk-bid-outcome-branch", ".outcomes.failure"],
    [(value) => { delete value.outcomes.criticalFailure; }, "missing-risk-bid-outcome-branch", ".outcomes.criticalFailure"]
  ]) {
    const source = option("bid", 2);
    mutate(source);
    const { analysis, errors } = analyze([source]);
    assert.equal(analysis.options[0], undefined);
    assert.ok(errors.some(
      (entry) => entry.code === code
        && entry.path === `action.riskBidOptions[0]${path}`
    ), path);
  }
});

test("unexpected branches, non-array branches, and legacy fields are rejected", () => {
  const unexpected = option("bid", 2);
  unexpected.outcomes.noRoll = [];
  let result = analyze([unexpected]);
  assert.ok(result.errors.some(
    (entry) => entry.code === "unexpected-risk-bid-outcome-branch"
      && entry.path === "action.riskBidOptions[0].outcomes.noRoll"
  ));

  for (const field of ["criticalSuccess", "success", "failure", "criticalFailure"]) {
    const source = option("bid", 2);
    source.outcomes[field] = {};
    result = analyze([source]);
    assert.ok(result.errors.some(
      (entry) => entry.code === "invalid-risk-bid-outcome-branch"
        && entry.path === `action.riskBidOptions[0].outcomes.${field}`
    ));
  }

  for (const legacyField of ["rewardEffectIds", "dangerEffectIds"]) {
    const source = option("bid", 2);
    source[legacyField] = [];
    result = analyze([source]);
    assert.ok(result.errors.some(
      (entry) => entry.code === "unexpected-risk-bid-option-field"
        && entry.path === `action.riskBidOptions[0].${legacyField}`
    ));
  }
});

test("empty branches and cross-branch effect reuse are valid but same-branch duplicates are not", () => {
  const valid = analyze([option("bid", 2, {
    criticalSuccess: ["shared"],
    success: ["shared"],
    failure: [],
    criticalFailure: []
  })]);
  assert.deepEqual(valid.errors, []);
  assert.deepEqual(valid.analysis.referenceRecords, [
    {
      effectId: "shared",
      path: "action.riskBidOptions[0].outcomes.criticalSuccess[0]"
    },
    {
      effectId: "shared",
      path: "action.riskBidOptions[0].outcomes.success[0]"
    }
  ]);

  const duplicate = analyze([option("bid", 2, {
    failure: ["same", "same"]
  })]);
  assert.ok(duplicate.errors.some(
    (entry) => entry.code === "duplicate-effect-reference"
      && entry.path === "action.riskBidOptions[0].outcomes.failure[1]"
  ));
  assert.equal(duplicate.analysis.options[0], undefined);
});

test("option and branch arrays must be dense own-index arrays with no extra keys", () => {
  const sparseOptions = new Array(1);
  let result = analyze(sparseOptions);
  assert.ok(result.errors.some(
    (entry) => entry.code === "sparse-risk-bid-option"
      && entry.path === "action.riskBidOptions[0]"
  ));

  const sparseBranch = new Array(1);
  result = analyze([option("bid", 2, { success: sparseBranch })]);
  assert.ok(result.errors.some(
    (entry) => entry.code === "sparse-risk-bid-outcome-branch"
      && entry.path === "action.riskBidOptions[0].outcomes.success[0]"
  ));

  const optionsWithExtra = [option("bid", 2)];
  optionsWithExtra.extra = true;
  result = analyze(optionsWithExtra);
  assert.ok(result.errors.some(
    (entry) => entry.code === "unexpected-risk-bid-options-array-key"
  ));

  const branchWithSymbol = [];
  branchWithSymbol[Symbol("hidden")] = "effect";
  result = analyze([option("bid", 2, { failure: branchWithSymbol })]);
  assert.ok(result.errors.some(
    (entry) => entry.code === "unexpected-risk-bid-outcome-array-key"
  ));
});

test("hostile sparse lengths fail without length-sized allocation or iteration", () => {
  const hostileOptions = [];
  hostileOptions.length = 0xffffffff;
  let result = analyze(hostileOptions);
  assert.deepEqual(result.analysis.options, []);
  assert.ok(result.errors.some(
    (entry) => entry.code === "sparse-risk-bid-option"
      && entry.path === "action.riskBidOptions[0]"
  ));

  const hostileBranch = [];
  hostileBranch.length = 0xffffffff;
  result = analyze([option("bid", 2, { success: hostileBranch })]);
  assert.equal(result.analysis.options.length, 1);
  assert.equal(result.analysis.options[0], undefined);
  assert.ok(result.errors.some(
    (entry) => entry.code === "sparse-risk-bid-outcome-branch"
      && entry.path === "action.riskBidOptions[0].outcomes.success[0]"
  ));
});

test("inherited entries never satisfy dense arrays or execute inherited getters", () => {
  let reads = 0;
  const options = new Array(1);
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, "0", {
    configurable: true,
    get() {
      reads += 1;
      throw new Error("inherited");
    }
  });
  Object.setPrototypeOf(options, prototype);
  try {
    const result = analyze(options);
    assert.equal(reads, 0);
    assert.ok(result.errors.some(
      (entry) => entry.code === "sparse-risk-bid-option"
    ));
  } finally {
    Object.setPrototypeOf(options, Array.prototype);
  }
});

test("required-field and indexed accessors are rejected without invocation", () => {
  let reads = 0;
  const authored = option("bid", 2);
  Object.defineProperty(authored, "outcomes", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("outcomes");
    }
  });
  let result = analyze([authored]);
  assert.equal(reads, 0);
  assert.ok(result.errors.some(
    (entry) => entry.code === "outcome-data-read-failed"
      && entry.path === "action.riskBidOptions[0].outcomes"
  ));

  const optionArray = [];
  Object.defineProperty(optionArray, "0", {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      throw new Error("entry");
    }
  });
  result = analyze(optionArray);
  assert.equal(reads, 0);
  assert.ok(result.errors.some(
    (entry) => entry.code === "outcome-data-read-failed"
      && entry.path === "action.riskBidOptions[0]"
  ));
});

test("unsafe IDs and effect references are rejected without normalization", () => {
  for (const unsafe of ["__proto__", "constructor", "prototype"]) {
    let result = analyze([option(unsafe, 2)]);
    assert.ok(result.errors.some(
      (entry) => entry.code === "unsafe-risk-bid-key"
    ));
    assert.equal(result.analysis.options[0], undefined);

    result = analyze([option("bid", 2, { failure: [unsafe] })]);
    assert.ok(result.errors.some(
      (entry) => entry.code === "unsafe-effect-reference"
    ));
    assert.equal(result.analysis.options[0], undefined);
  }

  for (const invalid of ["", " ", 3, null]) {
    const result = analyze([option("bid", 2, { failure: [invalid] })]);
    assert.ok(result.errors.some(
      (entry) => entry.code === "invalid-effect-reference"
    ));
  }
});

test("normalized options, branches, records, and later analyses are recursively isolated", () => {
  const source = [option("bid", 8, {
    criticalSuccess: ["reward"],
    criticalFailure: ["danger"]
  })];
  const first = analyze(source);
  const second = analyze(source);
  assert.deepEqual(first.errors, []);
  assert.notEqual(first.analysis.options, source);
  assert.notEqual(first.analysis.options, second.analysis.options);
  assert.notEqual(first.analysis.options[0], source[0]);
  assert.notEqual(first.analysis.options[0].outcomes, source[0].outcomes);
  assert.notEqual(
    first.analysis.options[0].outcomes.criticalSuccess,
    source[0].outcomes.criticalSuccess
  );
  assert.notEqual(
    first.analysis.optionRecords[0].option,
    second.analysis.optionRecords[0].option
  );

  first.analysis.options[0].outcomes.criticalSuccess[0] = "changed";
  first.analysis.referenceRecords[0].path = "changed";
  assert.equal(source[0].outcomes.criticalSuccess[0], "reward");
  assert.equal(
    second.analysis.options[0].outcomes.criticalSuccess[0],
    "reward"
  );
  assert.deepEqual(second.analysis.referenceRecords, [
    {
      effectId: "reward",
      path: "action.riskBidOptions[0].outcomes.criticalSuccess[0]"
    },
    {
      effectId: "danger",
      path: "action.riskBidOptions[0].outcomes.criticalFailure[0]"
    }
  ]);
});

test("no-roll context rejects any non-empty Risk Bid option collection", () => {
  const result = analyze([option("bid", 2)], { noRoll: true });
  assert.deepEqual(result.analysis.options, []);
  assert.ok(result.errors.some(
    (entry) => entry.code === "no-roll-risk-bid-options"
      && entry.path === "action.riskBidOptions"
  ));
});

test("non-array collections and non-plain or incomplete options are rejected", () => {
  for (const [value, code] of [
    [undefined, "invalid-risk-bid-options"],
    [null, "invalid-risk-bid-options"],
    [{}, "invalid-risk-bid-options"],
    ["options", "invalid-risk-bid-options"],
    [[null], "invalid-risk-bid-option"],
    [[{}], "missing-risk-bid-id"],
    [[{ riskBidId: " " }], "invalid-risk-bid-id"]
  ]) {
    const result = analyze(value);
    assert.ok(result.errors.some((entry) => entry.code === code), code);
  }

  const inherited = Object.create({
    riskBidId: "inherited",
    dcAdjustment: 2,
    outcomes: outcomes()
  });
  const result = analyze([inherited]);
  assert.ok(result.errors.some(
    (entry) => entry.code === "invalid-risk-bid-option"
  ));
});

test("persisted bid validation and selection mutations retain their accepted shape", () => {
  const source = state();
  const before = clonePlainData(source);
  assert.equal(validateVoyageEncounterRiskBids(source).valid, true);

  const request = { stationId: "navigator", riskBidId: "close" };
  const selected = applyVoyageEncounterRiskBidSelection(source, request);
  assert.deepEqual(selected.nextState.riskBids.navigator, bid());
  assert.deepEqual(selected.events, [{
    type: "voyage.risk-bid-selected",
    encounterId: "risk",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 1,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    stationId: "navigator",
    actionId: "thread",
    riskBidId: "close",
    dcAdjustment: 2,
    previousRevision: 3,
    revision: 4
  }]);
  assert.deepEqual(source, before);
  assert.deepEqual(request, { stationId: "navigator", riskBidId: "close" });

  const changed = applyVoyageEncounterRiskBidChange(
    selected.nextState,
    { stationId: "navigator", riskBidId: "bold" }
  );
  assert.equal(changed.events[0].previousRiskBidId, "close");
  assert.equal(changed.events[0].previousDcAdjustment, 2);
  assert.equal(changed.events[0].dcAdjustment, 5);
  assert.deepEqual(
    changed.nextState.riskBids.navigator,
    bid("navigator", "thread", "bold", 5)
  );
  assert.equal(changed.nextState.revision, 5);
  const cleared = applyVoyageEncounterRiskBidClear(
    changed.nextState,
    { stationId: "navigator" }
  );
  assert.equal(cleared.events[0].riskBidId, "bold");
  assert.equal(cleared.events[0].dcAdjustment, 5);
  assert.equal(cleared.nextState.revision, 6);
});

test("selects every canonical tier by copying authored adjustments into exact stored records", () => {
  for (const [stationId, riskBidId, dcAdjustment] of [
    ["navigator", "close", 2],
    ["navigator", "bold", 5],
    ["captain", "press", 8]
  ]) {
    const source = state();
    const result = applyVoyageEncounterRiskBidSelection(
      source,
      { stationId, riskBidId }
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.nextState.riskBids[stationId], {
      stationId,
      actionId: source.selections[stationId].actionId,
      riskBidId,
      dcAdjustment
    });
    assert.deepEqual(Object.keys(result.nextState.riskBids[stationId]), [
      "stationId",
      "actionId",
      "riskBidId",
      "dcAdjustment"
    ]);
    assert.equal(result.events[0].dcAdjustment, dcAdjustment);
    assert.equal(Object.hasOwn(result.nextState.riskBids[stationId], "outcomes"), false);
  }
});

test("selection requests cannot inject adjustments or any other caller authority", () => {
  const source = state();
  const forged = {
    stationId: "navigator",
    riskBidId: "close",
    dcAdjustment: 8
  };
  const forgedBefore = clonePlainData(forged);
  const forgedResult = applyVoyageEncounterRiskBidSelection(source, forged);
  expectFailure(forgedResult, "unexpected-risk-bid-request-field");
  assert.deepEqual(forged, forgedBefore);
  assert.deepEqual(source.riskBids, {});

  let reads = 0;
  const accessor = { stationId: "navigator" };
  Object.defineProperty(accessor, "riskBidId", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not execute");
    }
  });
  const accessorResult = applyVoyageEncounterRiskBidSelection(source, accessor);
  assert.equal(accessorResult.ok, false);
  assert.equal(reads, 0);
  assert.ok(accessorResult.errors.some(
    (entry) => entry.code === "outcome-data-read-failed"
      && entry.path === "bidRequest.riskBidId"
  ));

  const symbolRequest = {
    stationId: "navigator",
    riskBidId: "close"
  };
  symbolRequest[Symbol("hidden")] = 8;
  assert.ok(applyVoyageEncounterRiskBidSelection(source, symbolRequest).errors.some(
    (entry) => entry.code === "unexpected-risk-bid-request-field"
      && entry.path === "bidRequest.[symbol]"
  ));

  expectFailure(
    applyVoyageEncounterRiskBidSelection(
      source,
      { stationId: "navigator", riskBidId: "__proto__" }
    ),
    "unsafe-risk-bid-key"
  );
  expectFailure(
    applyVoyageEncounterRiskBidSelection(
      source,
      Object.create({ stationId: "navigator", riskBidId: "close" })
    ),
    "invalid-risk-bid-request"
  );
});

test("change and clear requests remain exact hostile-data-safe contracts", () => {
  const source = state();
  source.riskBids.navigator = bid();

  expectFailure(
    applyVoyageEncounterRiskBidChange(
      source,
      { stationId: "navigator", riskBidId: "bold", dcAdjustment: 5 }
    ),
    "unexpected-risk-bid-request-field"
  );
  expectFailure(
    applyVoyageEncounterRiskBidClear(
      source,
      { stationId: "navigator", riskBidId: "close" }
    ),
    "unexpected-risk-bid-request-field"
  );

  let reads = 0;
  const clear = { stationId: "navigator" };
  Object.defineProperty(clear, "unexpected", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not execute");
    }
  });
  const result = applyVoyageEncounterRiskBidClear(source, clear);
  assert.equal(result.ok, false);
  assert.equal(reads, 0);
  assert.ok(result.errors.some(
    (entry) => entry.code === "unexpected-risk-bid-request-field"
      && entry.path === "clearRequest.unexpected"
  ));
  assert.deepEqual(source.riskBids.navigator, bid());
});

test("stored records require exact fields, canonical adjustments, and authored agreement", () => {
  const fixtures = [
    [
      (source) => { delete source.riskBids.navigator.dcAdjustment; },
      "missing-risk-bid-dc-adjustment",
      "riskBids.navigator.dcAdjustment"
    ],
    [
      (source) => { source.riskBids.navigator.dcAdjustment = 0; },
      "invalid-risk-bid-dc-adjustment",
      "riskBids.navigator.dcAdjustment"
    ],
    [
      (source) => { source.riskBids.navigator.dcAdjustment = 5; },
      "risk-bid-dc-adjustment-mismatch",
      "riskBids.navigator.dcAdjustment"
    ],
    [
      (source) => { source.riskBids.navigator.unexpected = true; },
      "unexpected-risk-bid-field",
      "riskBids.navigator.unexpected"
    ]
  ];
  for (const [mutate, code, path] of fixtures) {
    const source = state();
    source.riskBids.navigator = bid();
    mutate(source);
    const report = validateVoyageEncounterRiskBids(source);
    assert.ok(report.errors.some(
      (entry) => entry.code === code && entry.path === path
    ), code);
  }
});

test("stored bids require a current action, a committed rolled approach, and a live authored option", () => {
  const missingSelection = state();
  missingSelection.riskBids.navigator = bid();
  delete missingSelection.selections.navigator;
  assert.ok(validateVoyageEncounterRiskBids(missingSelection).errors.some(
    (entry) => entry.code === "risk-bid-selection-missing"
  ));

  const incomplete = state();
  incomplete.riskBids.navigator = bid();
  incomplete.selections.navigator = {
    stationId: "navigator",
    actionId: "thread"
  };
  assert.ok(validateVoyageEncounterRiskBids(incomplete).errors.some(
    (entry) => entry.code === "risk-bid-requires-committed-approach"
  ));

  const noRoll = state();
  noRoll.riskBids.navigator = bid();
  noRoll.selections.navigator = {
    stationId: "navigator",
    actionId: "thread",
    approachId: "steady-course",
    noRoll: true
  };
  assert.ok(validateVoyageEncounterRiskBids(noRoll).errors.some(
    (entry) => entry.code === "risk-bid-requires-rolled-approach"
  ));

  const staleAction = state();
  staleAction.riskBids.navigator = bid("navigator", "safe");
  assert.ok(validateVoyageEncounterRiskBids(staleAction).errors.some(
    (entry) => entry.code === "risk-bid-action-mismatch"
  ));

  const missingOption = state();
  missingOption.riskBids.navigator = bid("navigator", "thread", "missing");
  assert.ok(validateVoyageEncounterRiskBids(missingOption).errors.some(
    (entry) => entry.code === "risk-bid-not-available"
  ));

  const duplicateOption = state();
  duplicateOption.riskBids.navigator = bid();
  duplicateOption.availableStations[0].actions[0].riskBidOptions.push(
    option("close", 8)
  );
  const duplicateReport = validateVoyageEncounterRiskBids(duplicateOption);
  assert.ok(duplicateReport.errors.some(
    (entry) => entry.code === "duplicate-risk-bid-id"
  ));
  assert.equal(duplicateReport.selectedRiskBidCount, 0);
  assert.deepEqual(duplicateReport.selectedRiskBidStationIds, []);
});

test("mixed rolled/no-roll actions accept bids only while a rolled approach is committed", () => {
  const rolled = state();
  assert.equal(
    applyVoyageEncounterRiskBidSelection(
      rolled,
      { stationId: "navigator", riskBidId: "close" }
    ).ok,
    true
  );

  const noRoll = state();
  noRoll.selections.navigator = {
    stationId: "navigator",
    actionId: "thread",
    approachId: "steady-course",
    noRoll: true
  };
  const result = applyVoyageEncounterRiskBidSelection(
    noRoll,
    { stationId: "navigator", riskBidId: "close" }
  );
  expectFailure(result, "risk-bid-requires-rolled-approach");
});

test("unselected bids on exclusively no-roll actions invalidate planning state", () => {
  const source = state();
  source.availableStations[0].actions[0].approaches = [{
    approachId: "steady-course",
    noRoll: true
  }];
  source.selections.navigator = {
    stationId: "navigator",
    actionId: "thread",
    approachId: "steady-course",
    noRoll: true
  };

  const report = validateVoyageEncounterRiskBids(source);
  assert.equal(report.valid, false);
  assert.equal(report.selectedRiskBidCount, 0);
  assert.deepEqual(report.selectedRiskBidStationIds, []);
  assert.ok(report.errors.some(
    (entry) => entry.code === "no-roll-risk-bid-options"
      && entry.path === "availableStations[0].actions[0].riskBidOptions"
  ));
});

test("stored bids remain valid after Crew Planning, while paused, and in historical state", () => {
  const source = state();
  source.riskBids.navigator = bid();
  for (const phase of [
    VOYAGE_ROUND_PHASES.LOCK_READINESS,
    VOYAGE_ROUND_PHASES.RESOLUTION,
    VOYAGE_ROUND_PHASES.CONSEQUENCES
  ]) {
    source.phase = phase;
    assert.equal(validateVoyageEncounterRiskBids(source).valid, true, phase);
  }
  expectFailure(
    applyVoyageEncounterRiskBidClear(
      source,
      { stationId: "navigator" }
    ),
    "risk-bid-requires-crew-planning"
  );

  for (const phase of [
    VOYAGE_ROUND_PHASES.LOCK_READINESS,
    VOYAGE_ROUND_PHASES.RESOLUTION,
    VOYAGE_ROUND_PHASES.CONSEQUENCES
  ]) {
    const paused = clonePlainData(source);
    paused.lifecycleState = STATES.PAUSED;
    paused.phase = phase;
    assert.equal(validateVoyageEncounterRiskBids(paused).valid, true, `paused:${phase}`);
    expectFailure(
      applyVoyageEncounterRiskBidClear(
        paused,
        { stationId: "navigator" }
      ),
      "risk-bid-requires-active"
    );
  }

  for (const lifecycleState of [
    STATES.COMPLETED_SUCCESS,
    STATES.COMPLETED_FAILURE,
    STATES.ABANDONED
  ]) {
    const historical = clonePlainData(source);
    historical.lifecycleState = lifecycleState;
    assert.equal(
      validateVoyageEncounterRiskBids(historical).valid,
      true,
      lifecycleState
    );
    expectFailure(
      applyVoyageEncounterRiskBidClear(
        historical,
        { stationId: "navigator" }
      ),
      "risk-bid-requires-active"
    );
  }
});

test("stored map and record accessors, symbols, and inherited bids stay contained", () => {
  const inherited = state();
  const inheritedBid = bid();
  const prior = Object.getOwnPropertyDescriptor(Object.prototype, "ghostBid");
  try {
    Object.defineProperty(Object.prototype, "ghostBid", {
      value: inheritedBid,
      configurable: true
    });
    assert.equal(validateVoyageEncounterRiskBids(inherited).valid, true);
  } finally {
    if (prior) Object.defineProperty(Object.prototype, "ghostBid", prior);
    else delete Object.prototype.ghostBid;
  }

  const symbolMap = state();
  symbolMap.riskBids[Symbol("hidden")] = bid();
  assert.ok(validateVoyageEncounterRiskBids(symbolMap).errors.some(
    (entry) => entry.code === "unexpected-risk-bid-map-key"
  ));

  const accessor = state();
  let reads = 0;
  const record = bid();
  Object.defineProperty(record, "dcAdjustment", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not execute");
    }
  });
  accessor.riskBids.navigator = record;
  const report = validateVoyageEncounterRiskBids(accessor);
  assert.equal(reads, 0);
  assert.ok(report.errors.some(
    (entry) => entry.code === "outcome-data-read-failed"
      && entry.path === "riskBids.navigator.dcAdjustment"
  ));
});

test("the validator reports the round-wide three-bid cap without invalidating canonical records", () => {
  const source = state();
  source.availableStations = [];
  source.stationAssignments = [];
  source.selections = {};
  source.riskBids = {};
  for (const [index, stationId] of [
    "captain",
    "engineer",
    "navigator",
    "watchmaster"
  ].entries()) {
    const actionId = `action-${stationId}`;
    const approachId = `approach-${stationId}`;
    const riskBidId = `bid-${stationId}`;
    const dcAdjustment = [2, 5, 8, 2][index];
    source.availableStations.push({
      stationId,
      actions: [{
        actionId,
        approaches: [{
          approachId,
          statisticSlugOrAbilityId: approachId
        }],
        riskBidOptions: [option(riskBidId, dcAdjustment)]
      }]
    });
    source.stationAssignments.push({
      stationId,
      operator: {
        kind: "actor",
        uuid: `Actor.${stationId}`
      }
    });
    source.selections[stationId] = {
      stationId,
      actionId,
      approachId,
      statisticSlugOrAbilityId: approachId
    };
    source.riskBids[stationId] = {
      stationId,
      actionId,
      riskBidId,
      dcAdjustment
    };
  }
  const report = validateVoyageEncounterRiskBids(source);
  assert.equal(report.valid, true);
  assert.equal(report.selectedRiskBidCount, 4);
  assert.deepEqual(report.selectedRiskBidStationIds, [
    "captain",
    "engineer",
    "navigator",
    "watchmaster"
  ]);
  assert.deepEqual(report.baseActionStationIds, []);
  assert.equal(report.riskBidLimit, 3);
  assert.equal(report.overRiskBidLimit, true);
  assert.equal(Object.keys(source.riskBids).length, 4);

  const threeSelected = clonePlainData(source);
  delete threeSelected.riskBids.watchmaster;
  const fourthSelection = applyVoyageEncounterRiskBidSelection(
    threeSelected,
    { stationId: "watchmaster", riskBidId: "bid-watchmaster" }
  );
  assert.equal(fourthSelection.ok, true);
  const fourthReport = validateVoyageEncounterRiskBids(
    fourthSelection.nextState
  );
  assert.equal(fourthReport.valid, true);
  assert.equal(fourthReport.selectedRiskBidCount, 4);
  assert.equal(fourthReport.overRiskBidLimit, true);
});

test("persisted bid maps retain empty, one, and multiple selection behavior", () => {
  const source = state();
  const before = clonePlainData(source);
  assert.equal(validateVoyageEncounterRiskBids(source).valid, true);

  source.riskBids.navigator = bid();
  assert.equal(validateVoyageEncounterRiskBids(source).valid, true);
  source.selections.captain = {
    stationId: "captain",
    actionId: "rally",
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy"
  };
  source.riskBids.captain = bid("captain", "rally", "press", 8);
  const first = validateVoyageEncounterRiskBids(source);
  const second = validateVoyageEncounterRiskBids(source);
  assert.equal(first.valid, true);
  assert.notEqual(first.errors, second.errors);
  assert.notEqual(first.warnings, second.warnings);
  assert.deepEqual(source, {
    ...before,
    selections: source.selections,
    riskBids: source.riskBids
  });
});

test("validation reports optional base actions and valid bids in occupied order", () => {
  const empty = state();
  const emptyReport = validateVoyageEncounterRiskBids(empty);
  assert.equal(emptyReport.valid, true);
  assert.equal(emptyReport.selectedRiskBidCount, 0);
  assert.deepEqual(emptyReport.selectedRiskBidStationIds, []);
  assert.deepEqual(emptyReport.baseActionStationIds, [
    "navigator",
    "captain"
  ]);
  assert.equal(emptyReport.riskBidLimit, 3);
  assert.equal(emptyReport.overRiskBidLimit, false);

  const selected = state();
  selected.riskBids = {
    captain: bid("captain", "rally", "press", 8),
    navigator: bid()
  };
  const selectedReport = validateVoyageEncounterRiskBids(selected);
  assert.equal(selectedReport.valid, true);
  assert.equal(selectedReport.selectedRiskBidCount, 2);
  assert.deepEqual(selectedReport.selectedRiskBidStationIds, [
    "navigator",
    "captain"
  ]);
  assert.deepEqual(selectedReport.baseActionStationIds, []);
});

test("malformed records do not count and analysis arrays remain isolated", () => {
  const source = state();
  source.riskBids.navigator = bid();
  source.riskBids.navigator.dcAdjustment = 8;
  source.riskBids.captain = bid("captain", "rally", "press", 8);
  const before = clonePlainData(source);

  const first = validateVoyageEncounterRiskBids(source);
  const second = validateVoyageEncounterRiskBids(source);
  assert.equal(first.valid, false);
  assert.equal(first.selectedRiskBidCount, 1);
  assert.deepEqual(first.selectedRiskBidStationIds, ["captain"]);
  assert.deepEqual(first.baseActionStationIds, []);
  assert.equal(first.overRiskBidLimit, false);
  assert.notEqual(
    first.selectedRiskBidStationIds,
    second.selectedRiskBidStationIds
  );
  assert.notEqual(first.baseActionStationIds, second.baseActionStationIds);

  first.selectedRiskBidStationIds.push("changed");
  first.baseActionStationIds.push("changed");
  first.errors.push({ code: "changed" });
  assert.deepEqual(second.selectedRiskBidStationIds, ["captain"]);
  assert.deepEqual(second.baseActionStationIds, []);
  assert.equal(second.errors.some((entry) => entry.code === "changed"), false);
  assert.deepEqual(source, before);
});

test("successful mutation keeps input, next-state, and event data isolated", () => {
  const source = state();
  const request = { stationId: "navigator", riskBidId: "close" };
  const sourceBefore = clonePlainData(source);
  const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterRiskBidSelection(source, request);

  assert.equal(result.ok, true);
  assert.notEqual(result.nextState, source);
  assert.notEqual(result.nextState.riskBids, source.riskBids);
  assert.deepEqual(source, sourceBefore);
  assert.deepEqual(request, requestBefore);

  result.events[0].riskBidId = "event-only";
  assert.equal(result.nextState.riskBids.navigator.riskBidId, "close");
  result.nextState.riskBids.navigator.riskBidId = "state-only";
  assert.deepEqual(source.riskBids, {});
  assert.deepEqual(request, requestBefore);
});

test("persisted bid coupling and mutation failures remain atomic", () => {
  for (const [mutate, code] of [
    [(source) => {
      source.riskBids.navigator = bid();
      delete source.selections.navigator;
    }, "risk-bid-selection-missing"],
    [(source) => {
      source.riskBids.navigator = bid("captain");
    }, "risk-bid-station-key-mismatch"],
    [(source) => {
      source.riskBids.navigator = bid("navigator", "safe");
    }, "risk-bid-action-mismatch"],
    [(source) => {
      source.riskBids.navigator = bid("navigator", "missing");
      source.selections.navigator.actionId = "missing";
    }, "selected-action-not-available"],
    [(source) => {
      source.riskBids.navigator = bid("navigator", "safe");
      source.selections.navigator.actionId = "safe";
    }, "risk-bid-not-available"],
    [(source) => {
      source.riskBids.navigator = bid("navigator", "thread", "unknown");
    }, "risk-bid-not-available"]
  ]) {
    const source = state();
    mutate(source);
    assert.ok(validateVoyageEncounterRiskBids(source).errors.some(
      (entry) => entry.code === code
    ), code);
  }

  const source = state();
  for (const [request, code] of [
    [null, "invalid-risk-bid-request"],
    [{ stationId: "__proto__", riskBidId: "close" }, "unsafe-risk-bid-station-key"],
    [{ stationId: "navigator", riskBidId: "unknown" }, "risk-bid-not-available"]
  ]) {
    expectFailure(applyVoyageEncounterRiskBidSelection(source, request), code);
  }
  assert.deepEqual(source.riskBids, {});
  assert.equal(source.revision, 3);

  const selected = applyVoyageEncounterRiskBidSelection(
    source,
    { stationId: "navigator", riskBidId: "close" }
  );
  expectFailure(
    applyVoyageEncounterRiskBidSelection(
      selected.nextState,
      { stationId: "navigator", riskBidId: "bold" }
    ),
    "risk-bid-already-exists"
  );
  expectFailure(
    applyVoyageEncounterRiskBidChange(
      selected.nextState,
      { stationId: "navigator", riskBidId: "close" }
    ),
    "risk-bid-unchanged"
  );
  expectFailure(
    applyVoyageEncounterRiskBidClear(source, { stationId: "navigator" }),
    "risk-bid-does-not-exist"
  );
});

test("persisted validation preserves exact IDs and rejects unsafe map keys", () => {
  const unsafe = state();
  Object.defineProperty(unsafe.riskBids, "constructor", {
    value: bid(),
    enumerable: true
  });
  assert.equal(
    validateVoyageEncounterRiskBids(unsafe).errors[0].code,
    "unsafe-risk-bid-station-key"
  );

  const exact = state();
  exact.selections = {
    navigator: {
      stationId: "navigator",
      actionId: " thread ",
      approachId: "survival",
      statisticSlugOrAbilityId: "survival"
    }
  };
  exact.availableStations[0].actions[0].actionId = " thread ";
  exact.availableStations[0].actions[0].riskBidOptions = [
    option(" close ", 2)
  ];
  exact.riskBids = {
    navigator: bid("navigator", " thread ", " close ")
  };
  assert.deepEqual(validateVoyageEncounterRiskBids(exact).errors, []);
});

test("action edits still clear a selected bid only on successful primary events", () => {
  const source = state();
  source.riskBids.navigator = bid();
  const changed = applyVoyageEncounterStationActionSelectionChange(
    source,
    { stationId: "navigator", actionId: "safe" }
  );
  assert.equal(changed.events.length, 1);
  assert.equal(changed.events[0].clearedRiskBidId, "close");
  assert.equal(changed.events[0].clearedRiskBidDcAdjustment, 2);
  assert.equal(changed.nextState.revision, 4);

  const cleared = applyVoyageEncounterStationActionSelectionClear(
    source,
    { stationId: "navigator" }
  );
  assert.equal(cleared.events[0].clearedRiskBidId, "close");
  assert.equal(cleared.events[0].clearedRiskBidDcAdjustment, 2);
  const failed = applyVoyageEncounterStationActionSelectionChange(
    source,
    { stationId: "navigator", actionId: "thread" }
  );
  expectFailure(failed, "station-selection-unchanged");
  assert.deepEqual(source.riskBids.navigator, bid());
});

test("malformed unselected authored options still block planning consumers", async () => {
  const { applyVoyageEncounterStationActionSelection } = await import(
    "../../../scripts/voyage/domain/station-selection.js"
  );
  const { prepareVoyageEncounterCrewPlanningReadiness } = await import(
    "../../../scripts/voyage/domain/crew-planning-readiness.js"
  );
  const { applyVoyageEncounterCrewPlanningLock } = await import(
    "../../../scripts/voyage/domain/crew-planning-lock.js"
  );
  const source = state();
  source.availableStations[0].actions[0].riskBidOptions = undefined;
  const before = clonePlainData(source);

  expectFailure(
    applyVoyageEncounterStationActionSelection(
      source,
      { stationId: "captain", actionId: "rally" }
    ),
    "invalid-risk-bid-options"
  );
  const readiness = prepareVoyageEncounterCrewPlanningReadiness(source);
  assert.equal(readiness.readyToLock, false);
  assert.ok(readiness.errors.some(
    (entry) => entry.code === "invalid-risk-bid-options"
  ));
  expectFailure(
    applyVoyageEncounterCrewPlanningLock(
      source,
      { phaseStartSnapshotId: "blocked" }
    ),
    "invalid-risk-bid-options"
  );
  assert.deepEqual(source, before);
});

test("the module preserves its exact public exports without Foundry globals", async () => {
  const module = await import(
    `../../../scripts/voyage/domain/risk-bids.js?pure=${Date.now()}`
  );
  assert.deepEqual(Object.keys(module).sort(), [
    "analyzeAuthoredVoyageRiskBidOptions",
    "applyVoyageEncounterRiskBidChange",
    "applyVoyageEncounterRiskBidClear",
    "applyVoyageEncounterRiskBidSelection",
    "validateVoyageEncounterRiskBids"
  ]);
});
