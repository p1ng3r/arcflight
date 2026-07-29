import assert from "node:assert/strict";
import test from "node:test";

import { clonePlainData } from "../../../scripts/voyage/domain/defaults.js";
import {
  analyzeVoyageEventDefinitionRoundActionAuthoring,
  validateVoyageEventDefinitionRoundActionAuthoring
} from "../../../scripts/voyage/domain/round-action-authoring.js";

function approach(
  approachId,
  statisticSlugOrAbilityId = approachId,
  overrides = {}
) {
  return {
    approachId,
    statisticSlugOrAbilityId,
    ...overrides
  };
}

function noRollApproach(approachId, overrides = {}) {
  return {
    approachId,
    noRoll: true,
    ...overrides
  };
}

function action(actionId, overrides = {}) {
  return {
    actionId,
    approaches: [approach(`${actionId}-approach`, `${actionId}-statistic`)],
    ...overrides
  };
}

function riskBidOption(riskBidId, dcAdjustment, outcomeOverrides = {}) {
  return {
    riskBidId,
    dcAdjustment,
    outcomes: {
      criticalSuccess: [],
      success: [],
      failure: [],
      criticalFailure: [],
      ...outcomeOverrides
    }
  };
}

function station(stationId = "captain", overrides = {}) {
  return {
    stationId,
    actions: [
      action(`${stationId}-action-1`),
      action(`${stationId}-action-2`),
      action(`${stationId}-action-3`)
    ],
    ...overrides
  };
}

function round(roundId, overrides = {}) {
  return {
    roundId,
    availableStations: [station()],
    ...overrides
  };
}

function definition(roundCount = 3) {
  return {
    title: "Plain metadata outside this pass",
    rounds: Array.from({ length: roundCount }, (_entry, index) => round(`round-${index + 1}`))
  };
}

function codes(report) {
  return report.errors.map(({ code }) => code);
}

test("valid 3, 5, 7, 9, and 11 round definitions normalize isolated envelopes", () => {
  for (const roundCount of [3, 5, 7, 9, 11]) {
    const source = definition(roundCount);
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);

    assert.equal(report.structurallyValid, true, String(roundCount));
    assert.equal(report.authoringValid, true, String(roundCount));
    assert.equal(report.roundCount, roundCount);
    assert.equal(report.rounds.length, roundCount);
    assert.deepEqual(report.rounds[0], {
      roundIndex: 0,
      roundId: "round-1",
      stationCount: 1,
      stations: [{
        stationIndex: 0,
        stationId: "captain",
        actionCount: 3,
        actions: [
          {
            actionIndex: 0,
            actionId: "captain-action-1",
            approachCount: 1,
            approaches: [{
              approachIndex: 0,
              approachId: "captain-action-1-approach",
              executionKind: "statistic-or-ability",
              statisticSlugOrAbilityId: "captain-action-1-statistic"
            }],
            thirdApproachException: null,
            riskBidOptions: []
          },
          {
            actionIndex: 1,
            actionId: "captain-action-2",
            approachCount: 1,
            approaches: [{
              approachIndex: 0,
              approachId: "captain-action-2-approach",
              executionKind: "statistic-or-ability",
              statisticSlugOrAbilityId: "captain-action-2-statistic"
            }],
            thirdApproachException: null,
            riskBidOptions: []
          },
          {
            actionIndex: 2,
            actionId: "captain-action-3",
            approachCount: 1,
            approaches: [{
              approachIndex: 0,
              approachId: "captain-action-3-approach",
              executionKind: "statistic-or-ability",
              statisticSlugOrAbilityId: "captain-action-3-statistic"
            }],
            thirdApproachException: null,
            riskBidOptions: []
          }
        ]
      }]
    });
    assert.notEqual(report.rounds[0], source.rounds[0]);
    assert.notEqual(report.rounds[0].stations, source.rounds[0].availableStations);
    assert.notEqual(report.rounds[0].stations[0], source.rounds[0].availableStations[0]);
    assert.notEqual(
      report.rounds[0].stations[0].actions,
      source.rounds[0].availableStations[0].actions
    );
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.warnings, []);
  }
});

test("one and two approaches normalize statistic/ability and no-roll identities", () => {
  const source = definition();
  source.rounds[0].availableStations[0].actions[0].approaches = [
    approach("crafting", "crafting"),
    noRollApproach("automatic")
  ];
  const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);

  assert.equal(report.authoringValid, true);
  assert.deepEqual(report.rounds[0].stations[0].actions[0], {
    actionIndex: 0,
    actionId: "captain-action-1",
    approachCount: 2,
    approaches: [
      {
        approachIndex: 0,
        approachId: "crafting",
        executionKind: "statistic-or-ability",
        statisticSlugOrAbilityId: "crafting"
      },
      {
        approachIndex: 1,
        approachId: "automatic",
        executionKind: "no-roll",
        statisticSlugOrAbilityId: null
      }
    ],
    thirdApproachException: null,
    riskBidOptions: []
  });
});

test("canonical Risk Bid tier subsets normalize inside each authored action", () => {
  const source = definition();
  const authored = [
    riskBidOption("overcharge", 8),
    riskBidOption("trim", 2),
    riskBidOption("press", 5)
  ];
  source.rounds[0].availableStations[0].actions[0].riskBidOptions = authored;

  const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
  const normalized = report.rounds[0].stations[0].actions[0].riskBidOptions;

  assert.equal(report.authoringValid, true);
  assert.deepEqual(normalized, authored);
  assert.notEqual(normalized, authored);
  assert.notEqual(normalized[0], authored[0]);
  assert.notEqual(normalized[0].outcomes, authored[0].outcomes);
  assert.notEqual(normalized[1].outcomes.success, authored[1].outcomes.success);
  normalized[1].outcomes.success.push("changed");
  assert.deepEqual(authored[1].outcomes.success, []);
});

test("invalid canonical Risk Bid authoring suppresses the normalized Event Definition", () => {
  const fixtures = [
    [
      [riskBidOption("first", 2), riskBidOption("second", 2)],
      "duplicate-risk-bid-dc-adjustment",
      "rounds[0].availableStations[0].actions[0].riskBidOptions[1].dcAdjustment"
    ],
    [
      [riskBidOption("bad-tier", 3)],
      "invalid-risk-bid-dc-adjustment",
      "rounds[0].availableStations[0].actions[0].riskBidOptions[0].dcAdjustment"
    ],
    [
      [{ riskBidId: "legacy", rewardEffectIds: [], dangerEffectIds: [] }],
      "unexpected-risk-bid-option-field",
      "rounds[0].availableStations[0].actions[0].riskBidOptions[0].rewardEffectIds"
    ]
  ];

  for (const [riskBidOptions, code, path] of fixtures) {
    const source = definition();
    source.rounds[0].availableStations[0].actions[0].riskBidOptions = riskBidOptions;
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.equal(report.authoringValid, false);
    assert.deepEqual(report.rounds, []);
    assert.ok(report.errors.some(
      (entry) => entry.code === code && entry.path === path
    ));
  }
});

test("an action whose approaches are all no-roll cannot author Risk Bids", () => {
  const source = definition();
  source.rounds[0].availableStations[0].actions[0] = action("automatic", {
    approaches: [noRollApproach("automatic")],
    riskBidOptions: [riskBidOption("impossible", 2)]
  });

  const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);

  assert.equal(report.authoringValid, false);
  assert.deepEqual(report.rounds, []);
  assert.ok(report.errors.some(
    (entry) => entry.code === "no-roll-risk-bid-options"
      && entry.path === "rounds[0].availableStations[0].actions[0].riskBidOptions"
  ));
});

test("all noncanonical round counts are rejected", () => {
  for (const roundCount of [0, 1, 2, 4, 6, 8, 10, 12]) {
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(definition(roundCount));
    assert.equal(report.authoringValid, false, String(roundCount));
    assert.equal(report.roundCount, roundCount);
    assert.deepEqual(report.rounds, []);
    assert.ok(codes(report).includes("invalid-event-definition-round-count"), String(roundCount));
  }
});

test("malformed Event Definitions are rejected at the plain-object boundary", () => {
  class EventDefinition {}

  for (const source of [null, undefined, "event", [], new Date(), new EventDefinition()]) {
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.equal(report.structurallyValid, false);
    assert.equal(report.authoringValid, false);
    assert.deepEqual(report.rounds, []);
    assert.equal(report.errors[0].code, "invalid-voyage-event-definition");
    assert.equal(report.errors[0].path, "$");
  }
});

test("rounds must be an own array field", () => {
  const missing = analyzeVoyageEventDefinitionRoundActionAuthoring({});
  assert.deepEqual(codes(missing), ["missing-event-definition-rounds"]);

  const nonArray = analyzeVoyageEventDefinitionRoundActionAuthoring({ rounds: {} });
  assert.deepEqual(codes(nonArray), ["invalid-event-definition-rounds"]);
  assert.equal(nonArray.roundCount, 0);

  const prior = Object.getOwnPropertyDescriptor(Object.prototype, "rounds");
  try {
    Object.defineProperty(Object.prototype, "rounds", {
      value: definition().rounds,
      configurable: true
    });
    const inherited = analyzeVoyageEventDefinitionRoundActionAuthoring({});
    assert.deepEqual(codes(inherited), ["missing-event-definition-rounds"]);
  } finally {
    if (prior) Object.defineProperty(Object.prototype, "rounds", prior);
    else delete Object.prototype.rounds;
  }
});

test("round arrays must be dense and inherited entries never become authored rounds", () => {
  const prior = Object.getOwnPropertyDescriptor(Array.prototype, "1");
  try {
    Object.defineProperty(Array.prototype, "1", {
      value: round("inherited-round"),
      configurable: true,
      writable: true
    });
    const rounds = new Array(3);
    rounds[0] = round("round-1");
    rounds[2] = round("round-3");

    const report = analyzeVoyageEventDefinitionRoundActionAuthoring({ rounds });
    assert.equal(report.roundCount, 2);
    assert.deepEqual(report.rounds, []);
    assert.deepEqual(codes(report), ["sparse-event-definition-rounds"]);
    assert.equal(report.errors[0].path, "rounds[1]");
  } finally {
    if (prior) Object.defineProperty(Array.prototype, "1", prior);
    else delete Array.prototype[1];
  }
});

test("every own round entry must be a plain record with an own roundId", () => {
  for (const malformed of [null, "round", 1, []]) {
    const source = definition();
    source.rounds[1] = malformed;
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes("invalid-event-definition-round"));
    assert.equal(report.errors.find(({ code }) => code === "invalid-event-definition-round").path, "rounds[1]");
  }

  const prior = Object.getOwnPropertyDescriptor(Object.prototype, "roundId");
  try {
    Object.defineProperty(Object.prototype, "roundId", {
      value: "inherited-round",
      configurable: true
    });
    const source = definition();
    source.rounds[1] = {};
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes("missing-event-definition-round-id"));
    assert.equal(
      report.errors.find(({ code }) => code === "missing-event-definition-round-id").path,
      "rounds[1].roundId"
    );
  } finally {
    if (prior) Object.defineProperty(Object.prototype, "roundId", prior);
    else delete Object.prototype.roundId;
  }
});

test("blank, unsafe, and non-string round IDs are rejected without repair", () => {
  for (const [roundId, expectedCode] of [
    ["", "invalid-event-definition-round-id"],
    ["   ", "invalid-event-definition-round-id"],
    [null, "invalid-event-definition-round-id"],
    [7, "invalid-event-definition-round-id"],
    ["__proto__", "unsafe-event-definition-round-id"],
    ["constructor", "unsafe-event-definition-round-id"],
    ["prototype", "unsafe-event-definition-round-id"]
  ]) {
    const source = definition();
    source.rounds[1].roundId = roundId;
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes(expectedCode), String(roundId));
    assert.deepEqual(report.rounds, []);
  }
});

test("round IDs are exact, case-sensitive, and unique across the definition", () => {
  const duplicate = definition();
  duplicate.rounds[2].roundId = duplicate.rounds[0].roundId;
  const duplicateReport = analyzeVoyageEventDefinitionRoundActionAuthoring(duplicate);
  assert.deepEqual(codes(duplicateReport), ["duplicate-event-definition-round-id"]);
  assert.equal(duplicateReport.errors[0].path, "rounds[2].roundId");

  const exact = {
    rounds: [
      round(" Round One "),
      round("round one"),
      round("ROUND ONE")
    ]
  };
  const exactReport = analyzeVoyageEventDefinitionRoundActionAuthoring(exact);
  assert.equal(exactReport.authoringValid, true);
  assert.deepEqual(
    exactReport.rounds.map(({ roundId }) => roundId),
    [" Round One ", "round one", "ROUND ONE"]
  );
});

test("availableStations must be an own non-empty array", () => {
  const missing = definition();
  delete missing.rounds[1].availableStations;
  const missingReport = analyzeVoyageEventDefinitionRoundActionAuthoring(missing);
  assert.ok(codes(missingReport).includes("missing-event-definition-available-stations"));
  assert.equal(
    missingReport.errors.find(
      ({ code }) => code === "missing-event-definition-available-stations"
    ).path,
    "rounds[1].availableStations"
  );

  const nonArray = definition();
  nonArray.rounds[1].availableStations = {};
  assert.ok(
    codes(analyzeVoyageEventDefinitionRoundActionAuthoring(nonArray))
      .includes("invalid-event-definition-available-stations")
  );

  const empty = definition();
  empty.rounds[1].availableStations = [];
  assert.ok(
    codes(analyzeVoyageEventDefinitionRoundActionAuthoring(empty))
      .includes("empty-event-definition-available-stations")
  );

  const prior = Object.getOwnPropertyDescriptor(Object.prototype, "availableStations");
  try {
    Object.defineProperty(Object.prototype, "availableStations", {
      value: [station()],
      configurable: true
    });
    const inherited = definition();
    delete inherited.rounds[1].availableStations;
    assert.ok(
      codes(analyzeVoyageEventDefinitionRoundActionAuthoring(inherited))
        .includes("missing-event-definition-available-stations")
    );
  } finally {
    if (prior) Object.defineProperty(Object.prototype, "availableStations", prior);
    else delete Object.prototype.availableStations;
  }
});

test("availableStations must be dense and inherited numeric entries do not count", () => {
  const prior = Object.getOwnPropertyDescriptor(Array.prototype, "1");
  try {
    Object.defineProperty(Array.prototype, "1", {
      value: station("engineer"),
      configurable: true,
      writable: true
    });
    const availableStations = new Array(3);
    availableStations[0] = station("captain");
    availableStations[2] = station("navigator");
    const source = definition();
    source.rounds[1].availableStations = availableStations;

    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.equal(report.authoringValid, false);
    assert.deepEqual(report.rounds, []);
    assert.ok(codes(report).includes("sparse-event-definition-available-stations"));
    assert.equal(
      report.errors.find(
        ({ code }) => code === "sparse-event-definition-available-stations"
      ).path,
      "rounds[1].availableStations[1]"
    );
  } finally {
    if (prior) Object.defineProperty(Array.prototype, "1", prior);
    else delete Array.prototype[1];
  }
});

test("available station entries must be plain records", () => {
  for (const malformed of [null, "captain", 1, []]) {
    const source = definition();
    source.rounds[1].availableStations[0] = malformed;
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes("invalid-event-definition-station"));
    assert.equal(
      report.errors.find(({ code }) => code === "invalid-event-definition-station").path,
      "rounds[1].availableStations[0]"
    );
  }
});

test("canonical partial station subsets may differ by round", () => {
  const source = definition();
  source.rounds[0].availableStations = [station("captain")];
  source.rounds[1].availableStations = [station("engineer"), station("navigator")];
  source.rounds[2].availableStations = [
    station("captain"),
    station("engineer"),
    station("navigator"),
    station("watchmaster"),
    station("veilwarden")
  ];

  const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
  assert.equal(report.authoringValid, true);
  assert.deepEqual(
    report.rounds.map(({ stations }) => stations.map(({ stationId }) => stationId)),
    [
      ["captain"],
      ["engineer", "navigator"],
      ["captain", "engineer", "navigator", "watchmaster", "veilwarden"]
    ]
  );
  assert.deepEqual(report.rounds.map(({ stationCount }) => stationCount), [1, 2, 5]);
});

test("station IDs must be own, exact, safe, canonical, and round-local unique", () => {
  const fixtures = [
    {
      stationValue: { actions: station().actions },
      code: "missing-event-definition-station-id"
    },
    {
      stationValue: station(""),
      code: "invalid-event-definition-station-id"
    },
    {
      stationValue: station("__proto__"),
      code: "unsafe-event-definition-station-id"
    },
    {
      stationValue: station("pilot"),
      code: "unsupported-event-definition-station-id"
    },
    {
      stationValue: station(" captain "),
      code: "unsupported-event-definition-station-id"
    }
  ];

  for (const fixture of fixtures) {
    const source = definition();
    source.rounds[1].availableStations = [fixture.stationValue];
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes(fixture.code), fixture.code);
    assert.deepEqual(report.rounds, []);
  }

  const duplicate = definition();
  duplicate.rounds[1].availableStations = [station("engineer"), station("engineer")];
  const duplicateReport = analyzeVoyageEventDefinitionRoundActionAuthoring(duplicate);
  assert.ok(codes(duplicateReport).includes("duplicate-event-definition-station-id"));
  assert.equal(
    duplicateReport.errors.find(
      ({ code }) => code === "duplicate-event-definition-station-id"
    ).path,
    "rounds[1].availableStations[1].stationId"
  );
});

test("actions must be an own array on every available station", () => {
  const missing = definition();
  delete missing.rounds[1].availableStations[0].actions;
  assert.ok(
    codes(analyzeVoyageEventDefinitionRoundActionAuthoring(missing))
      .includes("missing-event-definition-actions")
  );

  const nonArray = definition();
  nonArray.rounds[1].availableStations[0].actions = {};
  assert.ok(
    codes(analyzeVoyageEventDefinitionRoundActionAuthoring(nonArray))
      .includes("invalid-event-definition-actions")
  );

  const prior = Object.getOwnPropertyDescriptor(Object.prototype, "actions");
  try {
    Object.defineProperty(Object.prototype, "actions", {
      value: station().actions,
      configurable: true
    });
    const inherited = definition();
    delete inherited.rounds[1].availableStations[0].actions;
    assert.ok(
      codes(analyzeVoyageEventDefinitionRoundActionAuthoring(inherited))
        .includes("missing-event-definition-actions")
    );
  } finally {
    if (prior) Object.defineProperty(Object.prototype, "actions", prior);
    else delete Object.prototype.actions;
  }
});

test("every available station must own exactly three dense action entries", () => {
  for (const actionCount of [0, 1, 2, 4]) {
    const source = definition();
    source.rounds[1].availableStations[0].actions = Array.from(
      { length: actionCount },
      (_entry, index) => action(`action-${index + 1}`)
    );
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes("invalid-event-definition-action-count"));
    assert.deepEqual(report.rounds, []);
  }

  const prior = Object.getOwnPropertyDescriptor(Array.prototype, "1");
  try {
    Object.defineProperty(Array.prototype, "1", {
      value: action("inherited-action"),
      configurable: true,
      writable: true
    });
    const actions = new Array(3);
    actions[0] = action("action-1");
    actions[2] = action("action-3");
    const source = definition();
    source.rounds[1].availableStations[0].actions = actions;
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes("invalid-event-definition-action-count"));
    assert.ok(codes(report).includes("sparse-event-definition-actions"));
    assert.equal(
      report.errors.find(({ code }) => code === "sparse-event-definition-actions").path,
      "rounds[1].availableStations[0].actions[1]"
    );
  } finally {
    if (prior) Object.defineProperty(Array.prototype, "1", prior);
    else delete Array.prototype[1];
  }
});

test("action entries must be plain records with own exact safe IDs", () => {
  for (const [malformed, expectedCode] of [
    [null, "invalid-event-definition-action"],
    ["action", "invalid-event-definition-action"],
    [[], "invalid-event-definition-action"],
    [{ approaches: [] }, "missing-event-definition-action-id"],
    [action(""), "invalid-event-definition-action-id"],
    [action("   "), "invalid-event-definition-action-id"],
    [action("__proto__"), "unsafe-event-definition-action-id"]
  ]) {
    const source = definition();
    source.rounds[1].availableStations[0].actions[1] = malformed;
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes(expectedCode), expectedCode);
    assert.deepEqual(report.rounds, []);
  }

  const exact = definition();
  exact.rounds[1].availableStations[0].actions = [
    action(" Exact Action "),
    action("exact action"),
    action("EXACT ACTION")
  ];
  const exactReport = analyzeVoyageEventDefinitionRoundActionAuthoring(exact);
  assert.equal(exactReport.authoringValid, true);
  assert.deepEqual(
    exactReport.rounds[1].stations[0].actions.map(({ actionId }) => actionId),
    [" Exact Action ", "exact action", "EXACT ACTION"]
  );
});

test("action IDs are unique within one station and may repeat elsewhere", () => {
  const duplicate = definition();
  duplicate.rounds[1].availableStations[0].actions = [
    action("shared"),
    action("other"),
    action("shared")
  ];
  const duplicateReport = analyzeVoyageEventDefinitionRoundActionAuthoring(duplicate);
  assert.ok(codes(duplicateReport).includes("duplicate-event-definition-action-id"));
  assert.equal(
    duplicateReport.errors.find(
      ({ code }) => code === "duplicate-event-definition-action-id"
    ).path,
    "rounds[1].availableStations[0].actions[2].actionId"
  );

  const repeatedElsewhere = definition();
  repeatedElsewhere.rounds[0].availableStations = [
    station("captain", {
      actions: [action("shared"), action("captain-2"), action("captain-3")]
    }),
    station("engineer", {
      actions: [action("shared"), action("engineer-2"), action("engineer-3")]
    })
  ];
  repeatedElsewhere.rounds[1].availableStations[0].actions[0].actionId = "shared";
  const repeatedReport = analyzeVoyageEventDefinitionRoundActionAuthoring(repeatedElsewhere);
  assert.equal(repeatedReport.authoringValid, true);
});

test("approaches must be an own array on every action", () => {
  const missing = definition();
  delete missing.rounds[1].availableStations[0].actions[1].approaches;
  assert.ok(
    codes(analyzeVoyageEventDefinitionRoundActionAuthoring(missing))
      .includes("missing-event-definition-approaches")
  );

  const nonArray = definition();
  nonArray.rounds[1].availableStations[0].actions[1].approaches = {};
  assert.ok(
    codes(analyzeVoyageEventDefinitionRoundActionAuthoring(nonArray))
      .includes("invalid-event-definition-approaches")
  );

  const prior = Object.getOwnPropertyDescriptor(Object.prototype, "approaches");
  try {
    Object.defineProperty(Object.prototype, "approaches", {
      value: [approach("inherited", "inherited")],
      configurable: true
    });
    const inherited = definition();
    delete inherited.rounds[1].availableStations[0].actions[1].approaches;
    assert.ok(
      codes(analyzeVoyageEventDefinitionRoundActionAuthoring(inherited))
        .includes("missing-event-definition-approaches")
    );
  } finally {
    if (prior) Object.defineProperty(Object.prototype, "approaches", prior);
    else delete Object.prototype.approaches;
  }
});

test("actions require one to three dense own approach entries", () => {
  for (const approachCount of [0, 4]) {
    const source = definition();
    source.rounds[1].availableStations[0].actions[1].approaches = Array.from(
      { length: approachCount },
      (_entry, index) => approach(`approach-${index + 1}`)
    );
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes("invalid-event-definition-approach-count"));
    assert.deepEqual(report.rounds, []);
  }

  const prior = Object.getOwnPropertyDescriptor(Array.prototype, "1");
  try {
    Object.defineProperty(Array.prototype, "1", {
      value: approach("inherited-approach"),
      configurable: true,
      writable: true
    });
    const approaches = new Array(3);
    approaches[0] = approach("first");
    approaches[2] = approach("third");
    const source = definition();
    source.rounds[1].availableStations[0].actions[1].approaches = approaches;
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes("sparse-event-definition-approaches"));
    assert.equal(
      report.errors.find(({ code }) => code === "sparse-event-definition-approaches").path,
      "rounds[1].availableStations[0].actions[1].approaches[1]"
    );
  } finally {
    if (prior) Object.defineProperty(Array.prototype, "1", prior);
    else delete Array.prototype[1];
  }
});

test("approach records require own exact safe locally unique IDs", () => {
  for (const [malformed, expectedCode] of [
    [null, "invalid-event-definition-approach"],
    ["approach", "invalid-event-definition-approach"],
    [[], "invalid-event-definition-approach"],
    [{ statisticSlugOrAbilityId: "crafting" }, "missing-event-definition-approach-id"],
    [approach(""), "invalid-event-definition-approach-id"],
    [approach("   "), "invalid-event-definition-approach-id"],
    [approach("__proto__"), "unsafe-event-definition-approach-id"]
  ]) {
    const source = definition();
    source.rounds[1].availableStations[0].actions[1].approaches = [malformed];
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes(expectedCode), expectedCode);
    assert.deepEqual(report.rounds, []);
  }

  const duplicate = definition();
  duplicate.rounds[1].availableStations[0].actions[1].approaches = [
    approach("shared"),
    approach("shared")
  ];
  const duplicateReport = analyzeVoyageEventDefinitionRoundActionAuthoring(duplicate);
  assert.ok(codes(duplicateReport).includes("duplicate-event-definition-approach-id"));

  const repeatedElsewhere = definition();
  repeatedElsewhere.rounds[0].availableStations[0].actions[0].approaches = [
    approach("shared")
  ];
  repeatedElsewhere.rounds[0].availableStations[0].actions[1].approaches = [
    approach("shared")
  ];
  repeatedElsewhere.rounds[1].availableStations[0].actions[0].approaches = [
    approach("shared")
  ];
  assert.equal(
    analyzeVoyageEventDefinitionRoundActionAuthoring(repeatedElsewhere).authoringValid,
    true
  );
});

test("approaches require exactly one valid execution identity", () => {
  const fixtures = [
    {
      value: { approachId: "missing" },
      code: "missing-event-definition-approach-execution-identity"
    },
    {
      value: approach("blank", "   "),
      code: "invalid-event-definition-statistic-or-ability-id"
    },
    {
      value: approach("unsafe-proto", "__proto__"),
      code: "unsafe-event-definition-statistic-or-ability-id"
    },
    {
      value: approach("unsafe-constructor", "constructor"),
      code: "unsafe-event-definition-statistic-or-ability-id"
    },
    {
      value: approach("unsafe-prototype", "prototype"),
      code: "unsafe-event-definition-statistic-or-ability-id"
    },
    {
      value: { approachId: "dual", statisticSlugOrAbilityId: "crafting", noRoll: true },
      code: "ambiguous-event-definition-approach-execution-identity"
    },
    {
      value: { approachId: "false", noRoll: false },
      code: "invalid-event-definition-no-roll-identity"
    },
    {
      value: { approachId: "string", noRoll: "true" },
      code: "invalid-event-definition-no-roll-identity"
    }
  ];

  for (const fixture of fixtures) {
    const source = definition();
    source.rounds[1].availableStations[0].actions[1].approaches = [fixture.value];
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes(fixture.code), fixture.code);
    assert.deepEqual(report.rounds, []);
  }

  const exact = definition();
  exact.rounds[1].availableStations[0].actions[1].approaches = [
    approach(" Exact Approach ", " Exact Statistic ")
  ];
  const exactReport = analyzeVoyageEventDefinitionRoundActionAuthoring(exact);
  assert.equal(exactReport.authoringValid, true);
  assert.deepEqual(
    exactReport.rounds[1].stations[0].actions[1].approaches[0],
    {
      approachIndex: 0,
      approachId: " Exact Approach ",
      executionKind: "statistic-or-ability",
      statisticSlugOrAbilityId: " Exact Statistic "
    }
  );
});

test("exactly three approaches require a matching third-approach exception", () => {
  const missing = definition();
  missing.rounds[1].availableStations[0].actions[1].approaches = [
    approach("first"),
    approach("second"),
    approach("third")
  ];
  const missingReport = analyzeVoyageEventDefinitionRoundActionAuthoring(missing);
  assert.ok(codes(missingReport).includes("missing-third-approach-exception"));

  const valid = definition();
  valid.rounds[1].availableStations[0].actions[1] = action("three-approaches", {
    approaches: [
      approach("first"),
      noRollApproach("second"),
      approach("risky-lore", "lore")
    ],
    thirdApproachException: {
      approachId: "risky-lore",
      distinctions: ["failure-risk"]
    }
  });
  const validReport = analyzeVoyageEventDefinitionRoundActionAuthoring(valid);
  assert.equal(validReport.authoringValid, true);
  assert.deepEqual(
    validReport.rounds[1].stations[0].actions[1].thirdApproachException,
    {
      approachId: "risky-lore",
      distinctions: ["failure-risk"]
    }
  );
});

test("every canonical third-approach distinction is accepted and isolated", () => {
  const distinctions = [
    "result-narration",
    "critical-success-benefit",
    "failure-risk",
    "upgrade-interaction",
    "risk-bid-availability",
    "target",
    "affected-system"
  ];
  const source = definition();
  source.rounds[1].availableStations[0].actions[1] = action("distinctions", {
    approaches: [approach("first"), approach("second"), approach("third")],
    thirdApproachException: {
      approachId: "third",
      distinctions
    }
  });

  const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
  const normalized = report.rounds[1].stations[0].actions[1].thirdApproachException;
  assert.equal(report.authoringValid, true);
  assert.deepEqual(normalized.distinctions, distinctions);
  assert.notEqual(normalized.distinctions, distinctions);
});

test("third-approach exception references must be exact, safe, and unambiguous", () => {
  const fixtures = [
    {
      exception: null,
      code: "invalid-third-approach-exception"
    },
    {
      exception: {},
      code: "missing-third-approach-exception-id"
    },
    {
      exception: { approachId: "", distinctions: ["failure-risk"] },
      code: "invalid-third-approach-exception-id"
    },
    {
      exception: { approachId: "__proto__", distinctions: ["failure-risk"] },
      code: "unsafe-third-approach-exception-id"
    },
    {
      exception: { approachId: "missing", distinctions: ["failure-risk"] },
      code: "unmatched-third-approach-exception-id"
    }
  ];

  for (const fixture of fixtures) {
    const source = definition();
    source.rounds[1].availableStations[0].actions[1] = action("exception", {
      approaches: [approach("first"), approach("second"), approach("third")],
      thirdApproachException: fixture.exception
    });
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes(fixture.code), fixture.code);
    assert.deepEqual(report.rounds, []);
  }

  const ambiguous = definition();
  ambiguous.rounds[1].availableStations[0].actions[1] = action("ambiguous", {
    approaches: [approach("shared"), approach("shared"), approach("third")],
    thirdApproachException: {
      approachId: "shared",
      distinctions: ["failure-risk"]
    }
  });
  const ambiguousReport = analyzeVoyageEventDefinitionRoundActionAuthoring(ambiguous);
  assert.ok(codes(ambiguousReport).includes("duplicate-event-definition-approach-id"));
  assert.ok(codes(ambiguousReport).includes("ambiguous-third-approach-exception-id"));
});

test("third-approach distinctions must be own, non-empty, dense, unique, and canonical", () => {
  const makeSource = (distinctions, exceptionOverrides = {}) => {
    const source = definition();
    source.rounds[1].availableStations[0].actions[1] = action("exception", {
      approaches: [approach("first"), approach("second"), approach("third")],
      thirdApproachException: {
        approachId: "third",
        distinctions,
        ...exceptionOverrides
      }
    });
    return source;
  };

  for (const [source, expectedCode] of [
    [makeSource(undefined, { distinctions: undefined }), "invalid-event-definition-plain-data"],
    [makeSource({}), "invalid-third-approach-distinctions"],
    [makeSource([]), "empty-third-approach-distinctions"],
    [makeSource([""]), "invalid-third-approach-distinction"],
    [makeSource(["not-canonical"]), "unsupported-third-approach-distinction"],
    [makeSource(["target", "target"]), "duplicate-third-approach-distinction"]
  ]) {
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes(expectedCode), expectedCode);
    assert.deepEqual(report.rounds, []);
  }

  const missing = makeSource(["target"]);
  delete missing.rounds[1].availableStations[0]
    .actions[1].thirdApproachException.distinctions;
  assert.ok(
    codes(analyzeVoyageEventDefinitionRoundActionAuthoring(missing))
      .includes("missing-third-approach-distinctions")
  );

  const prior = Object.getOwnPropertyDescriptor(Array.prototype, "1");
  try {
    Object.defineProperty(Array.prototype, "1", {
      value: "target",
      configurable: true,
      writable: true
    });
    const distinctions = new Array(2);
    distinctions[0] = "failure-risk";
    const sparse = makeSource(distinctions);
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(sparse);
    assert.ok(codes(report).includes("sparse-third-approach-distinctions"));
    assert.equal(
      report.errors.find(({ code }) => code === "sparse-third-approach-distinctions").path,
      "rounds[1].availableStations[0].actions[1].thirdApproachException.distinctions[1]"
    );
  } finally {
    if (prior) Object.defineProperty(Array.prototype, "1", prior);
    else delete Array.prototype[1];
  }
});

test("third-approach exception metadata is rejected for one or two approaches", () => {
  for (const approaches of [
    [approach("one")],
    [approach("one"), approach("two")]
  ]) {
    const source = definition();
    source.rounds[1].availableStations[0].actions[1] = action("unexpected-exception", {
      approaches,
      thirdApproachException: {
        approachId: approaches.at(-1).approachId,
        distinctions: ["failure-risk"]
      }
    });
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.ok(codes(report).includes("unexpected-third-approach-exception"));
    assert.deepEqual(report.rounds, []);
  }
});

test("hostile getters are contained without invocation", () => {
  let reads = 0;
  const roundsAccessor = {};
  Object.defineProperty(roundsAccessor, "rounds", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const roundsReport = analyzeVoyageEventDefinitionRoundActionAuthoring(roundsAccessor);
  assert.equal(reads, 0);
  assert.deepEqual(codes(roundsReport), ["event-definition-data-read-failed"]);
  assert.equal(roundsReport.errors[0].path, "rounds");

  const idAccessor = definition();
  Object.defineProperty(idAccessor.rounds[1], "roundId", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const idReport = analyzeVoyageEventDefinitionRoundActionAuthoring(idAccessor);
  assert.equal(reads, 0);
  assert.deepEqual(codes(idReport), ["event-definition-data-read-failed"]);
  assert.equal(idReport.errors[0].path, "rounds[1].roundId");

  const stationsAccessor = definition();
  Object.defineProperty(stationsAccessor.rounds[1], "availableStations", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const stationsReport = analyzeVoyageEventDefinitionRoundActionAuthoring(stationsAccessor);
  assert.equal(reads, 0);
  assert.deepEqual(codes(stationsReport), ["event-definition-data-read-failed"]);
  assert.equal(stationsReport.errors[0].path, "rounds[1].availableStations");

  const actionsAccessor = definition();
  Object.defineProperty(actionsAccessor.rounds[1].availableStations[0], "actions", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const actionsReport = analyzeVoyageEventDefinitionRoundActionAuthoring(actionsAccessor);
  assert.equal(reads, 0);
  assert.deepEqual(codes(actionsReport), ["event-definition-data-read-failed"]);
  assert.equal(
    actionsReport.errors[0].path,
    "rounds[1].availableStations[0].actions"
  );

  const actionIdAccessor = definition();
  Object.defineProperty(
    actionIdAccessor.rounds[1].availableStations[0].actions[1],
    "actionId",
    {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("must not run");
      }
    }
  );
  const actionIdReport = analyzeVoyageEventDefinitionRoundActionAuthoring(actionIdAccessor);
  assert.equal(reads, 0);
  assert.deepEqual(codes(actionIdReport), ["event-definition-data-read-failed"]);
  assert.equal(
    actionIdReport.errors[0].path,
    "rounds[1].availableStations[0].actions[1].actionId"
  );

  const approachesAccessor = definition();
  Object.defineProperty(
    approachesAccessor.rounds[1].availableStations[0].actions[1],
    "approaches",
    {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("must not run");
      }
    }
  );
  const approachesReport = analyzeVoyageEventDefinitionRoundActionAuthoring(
    approachesAccessor
  );
  assert.equal(reads, 0);
  assert.deepEqual(codes(approachesReport), ["event-definition-data-read-failed"]);
  assert.equal(
    approachesReport.errors[0].path,
    "rounds[1].availableStations[0].actions[1].approaches"
  );

  const identityAccessor = definition();
  Object.defineProperty(
    identityAccessor.rounds[1].availableStations[0].actions[1].approaches[0],
    "statisticSlugOrAbilityId",
    {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("must not run");
      }
    }
  );
  const identityReport = analyzeVoyageEventDefinitionRoundActionAuthoring(
    identityAccessor
  );
  assert.equal(reads, 0);
  assert.deepEqual(codes(identityReport), ["event-definition-data-read-failed"]);
  assert.equal(
    identityReport.errors[0].path,
    "rounds[1].availableStations[0].actions[1].approaches[0].statisticSlugOrAbilityId"
  );

  const exceptionAccessor = definition();
  const exceptionAction = exceptionAccessor.rounds[1].availableStations[0].actions[1];
  exceptionAction.approaches = [
    approach("first"),
    approach("second"),
    approach("third")
  ];
  Object.defineProperty(exceptionAction, "thirdApproachException", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const exceptionReport = analyzeVoyageEventDefinitionRoundActionAuthoring(
    exceptionAccessor
  );
  assert.equal(reads, 0);
  assert.deepEqual(codes(exceptionReport), ["event-definition-data-read-failed"]);
  assert.equal(
    exceptionReport.errors[0].path,
    "rounds[1].availableStations[0].actions[1].thirdApproachException"
  );

  const distinctionsAccessor = definition();
  distinctionsAccessor.rounds[1].availableStations[0].actions[1] = action(
    "distinctions-accessor",
    {
      approaches: [approach("first"), approach("second"), approach("third")],
      thirdApproachException: { approachId: "third" }
    }
  );
  Object.defineProperty(
    distinctionsAccessor.rounds[1].availableStations[0]
      .actions[1].thirdApproachException,
    "distinctions",
    {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("must not run");
      }
    }
  );
  const distinctionsReport = analyzeVoyageEventDefinitionRoundActionAuthoring(
    distinctionsAccessor
  );
  assert.equal(reads, 0);
  assert.deepEqual(codes(distinctionsReport), ["event-definition-data-read-failed"]);
  assert.equal(
    distinctionsReport.errors[0].path,
    "rounds[1].availableStations[0].actions[1].thirdApproachException.distinctions"
  );
});

test("array-entry accessors at every authored level are rejected without invocation", () => {
  let reads = 0;
  const accessor = () => ({
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const fixtures = [
    {
      source: definition(),
      install(source) {
        Object.defineProperty(source.rounds, "1", accessor());
      },
      path: "rounds[1]"
    },
    {
      source: definition(),
      install(source) {
        Object.defineProperty(
          source.rounds[1].availableStations,
          "0",
          accessor()
        );
      },
      path: "rounds[1].availableStations[0]"
    },
    {
      source: definition(),
      install(source) {
        Object.defineProperty(
          source.rounds[1].availableStations[0].actions,
          "1",
          accessor()
        );
      },
      path: "rounds[1].availableStations[0].actions[1]"
    },
    {
      source: definition(),
      install(source) {
        Object.defineProperty(
          source.rounds[1].availableStations[0].actions[1].approaches,
          "0",
          accessor()
        );
      },
      path: "rounds[1].availableStations[0].actions[1].approaches[0]"
    },
    {
      source: definition(),
      install(source) {
        source.rounds[1].availableStations[0].actions[1] = action(
          "distinction-entry-accessor",
          {
            approaches: [approach("first"), approach("second"), approach("third")],
            thirdApproachException: {
              approachId: "third",
              distinctions: ["failure-risk"]
            }
          }
        );
        Object.defineProperty(
          source.rounds[1].availableStations[0]
            .actions[1].thirdApproachException.distinctions,
          "0",
          accessor()
        );
      },
      path: "rounds[1].availableStations[0].actions[1]"
        + ".thirdApproachException.distinctions[0]"
    }
  ];

  for (const fixture of fixtures) {
    fixture.install(fixture.source);
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(fixture.source);
    assert.equal(reads, 0, fixture.path);
    assert.deepEqual(codes(report), ["event-definition-data-read-failed"]);
    assert.equal(report.errors[0].path, fixture.path);
    assert.deepEqual(report.rounds, []);
  }
});

test("null-prototype definition, round, station, action, approach, and exception records are valid", () => {
  const record = (entries) => Object.assign(Object.create(null), entries);
  const nullPrototypeAction = record({
    actionId: "null-prototype-action",
    approaches: [
      record({ approachId: "first", statisticSlugOrAbilityId: "crafting" }),
      record({ approachId: "second", noRoll: true }),
      record({ approachId: "third", statisticSlugOrAbilityId: "lore" })
    ],
    thirdApproachException: record({
      approachId: "third",
      distinctions: ["failure-risk"]
    })
  });
  const nullPrototypeStation = record({
    stationId: "captain",
    actions: [
      nullPrototypeAction,
      record({
        actionId: "second-action",
        approaches: [record({ approachId: "automatic", noRoll: true })]
      }),
      record({
        actionId: "third-action",
        approaches: [
          record({
            approachId: "diplomacy",
            statisticSlugOrAbilityId: "diplomacy"
          })
        ]
      })
    ]
  });
  const source = record({
    rounds: [
      record({ roundId: "round-1", availableStations: [nullPrototypeStation] }),
      round("round-2"),
      round("round-3")
    ]
  });

  const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
  assert.equal(report.authoringValid, true);
  assert.deepEqual(
    report.rounds[0].stations[0].actions[0].thirdApproachException,
    { approachId: "third", distinctions: ["failure-risk"] }
  );
  assert.deepEqual(report.errors, []);
});

test("the complete definition boundary rejects cycles and executable or non-plain data", () => {
  class CustomClass {}
  class FoundryLikeDocument {}

  const fixtures = [
    {
      mutate(source) {
        source.metadata = {};
        source.metadata.self = source.metadata;
      },
      code: "cyclic-event-definition-data",
      path: "metadata.self"
    },
    {
      mutate(source) {
        source.callback = () => {};
      },
      code: "invalid-event-definition-plain-data",
      path: "callback"
    },
    {
      mutate(source) {
        source.metadata = Symbol("metadata");
      },
      code: "invalid-event-definition-plain-data",
      path: "metadata"
    },
    {
      mutate(source) {
        source.metadata = 1n;
      },
      code: "invalid-event-definition-plain-data",
      path: "metadata"
    },
    {
      mutate(source) {
        source.metadata = new CustomClass();
      },
      code: "invalid-event-definition-plain-data",
      path: "metadata"
    },
    {
      mutate(source) {
        source.metadata = new FoundryLikeDocument();
      },
      code: "invalid-event-definition-plain-data",
      path: "metadata"
    },
    {
      mutate(source) {
        source.metadata = new Date("2026-07-28T00:00:00.000Z");
      },
      code: "invalid-event-definition-plain-data",
      path: "metadata"
    },
    {
      mutate(source) {
        source.metadata = new Map([["key", "value"]]);
      },
      code: "invalid-event-definition-plain-data",
      path: "metadata"
    },
    {
      mutate(source) {
        source.metadata = new Set(["value"]);
      },
      code: "invalid-event-definition-plain-data",
      path: "metadata"
    },
    {
      mutate(source) {
        source.metadata = /unsafe/u;
      },
      code: "invalid-event-definition-plain-data",
      path: "metadata"
    },
    {
      mutate(source) {
        source.metadata = Number.POSITIVE_INFINITY;
      },
      code: "invalid-event-definition-plain-data",
      path: "metadata"
    }
  ];

  for (const fixture of fixtures) {
    const source = definition();
    fixture.mutate(source);
    const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
    assert.equal(report.authoringValid, false, fixture.path);
    assert.deepEqual(report.rounds, []);
    assert.equal(report.errors[0].code, fixture.code);
    assert.equal(report.errors[0].path, fixture.path);
  }
});

test("unsafe object keys, symbol keys, and non-index array keys are rejected", () => {
  const unsafe = definition();
  Object.defineProperty(unsafe.metadata = {}, "__proto__", {
    value: "hostile",
    enumerable: true
  });
  const unsafeReport = analyzeVoyageEventDefinitionRoundActionAuthoring(unsafe);
  assert.deepEqual(codes(unsafeReport), ["unsafe-event-definition-key"]);
  assert.equal(unsafeReport.errors[0].path, "metadata.__proto__");

  const symbolKey = definition();
  symbolKey[Symbol("hostile")] = true;
  assert.deepEqual(
    codes(analyzeVoyageEventDefinitionRoundActionAuthoring(symbolKey)),
    ["invalid-event-definition-plain-data"]
  );

  const extraArrayKey = definition();
  extraArrayKey.rounds.extra = round("extra");
  const extraReport = analyzeVoyageEventDefinitionRoundActionAuthoring(extraArrayKey);
  assert.deepEqual(codes(extraReport), ["unexpected-event-definition-array-key"]);
  assert.equal(extraReport.errors[0].path, "rounds.extra");
});

test("analysis does not mutate source data and returns fresh isolated output", () => {
  const source = definition();
  source.rounds[0].availableStations[0].actions[0] = action("isolated", {
    approaches: [
      approach("first", "crafting"),
      noRollApproach("second"),
      approach("third", "lore")
    ],
    thirdApproachException: {
      approachId: "third",
      distinctions: ["failure-risk"]
    }
  });
  const before = clonePlainData(source);
  const first = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
  const second = analyzeVoyageEventDefinitionRoundActionAuthoring(source);

  first.rounds[0].roundId = "changed";
  first.rounds[0].stations[0].stationId = "engineer";
  first.rounds[0].stations[0].actions[0].actionId = "changed";
  first.rounds[0].stations[0].actions[0]
    .approaches[0].statisticSlugOrAbilityId = "changed";
  first.rounds[0].stations[0].actions[0]
    .thirdApproachException.approachId = "changed";
  first.rounds[0].stations[0].actions[0]
    .thirdApproachException.distinctions.push("target");
  first.rounds[0].stations.push({ stationId: "navigator" });
  first.rounds.push({ roundIndex: 99 });
  first.errors.push({ code: "changed" });
  first.warnings.push({ code: "changed" });

  assert.deepEqual(source, before);
  assert.deepEqual(second, analyzeVoyageEventDefinitionRoundActionAuthoring(source));
  assert.notEqual(second.rounds, first.rounds);
  assert.notEqual(second.rounds[0].stations, first.rounds[0].stations);
  assert.notEqual(
    second.rounds[0].stations[0].actions,
    first.rounds[0].stations[0].actions
  );
  assert.notEqual(
    second.rounds[0].stations[0].actions[0].approaches[0],
    first.rounds[0].stations[0].actions[0].approaches[0]
  );
  assert.notEqual(
    second.rounds[0].stations[0].actions[0].thirdApproachException,
    first.rounds[0].stations[0].actions[0].thirdApproachException
  );
  assert.notEqual(
    second.rounds[0].stations[0].actions[0].thirdApproachException.distinctions,
    first.rounds[0].stations[0].actions[0].thirdApproachException.distinctions
  );
  assert.deepEqual(second.errors, []);
  assert.deepEqual(second.warnings, []);
});

test("mutating source data after analysis does not affect the existing report", () => {
  const source = definition();
  source.rounds[0].availableStations[0].actions[0] = action("isolated-source", {
    approaches: [approach("first"), approach("second"), approach("third")],
    thirdApproachException: {
      approachId: "third",
      distinctions: ["failure-risk"]
    }
  });
  const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
  const beforeMutation = structuredClone(report);

  source.rounds[0].roundId = "changed-round";
  source.rounds[0].availableStations[0].stationId = "engineer";
  source.rounds[0].availableStations[0].actions[0].actionId = "changed-action";
  source.rounds[0].availableStations[0]
    .actions[0].approaches[0].approachId = "changed-approach";
  source.rounds[0].availableStations[0]
    .actions[0].thirdApproachException.approachId = "changed-exception";
  source.rounds[0].availableStations[0]
    .actions[0].thirdApproachException.distinctions.push("target");

  assert.deepEqual(report, beforeMutation);
});

test("every invalid report suppresses partially normalized rounds", () => {
  const source = definition();
  source.rounds[2].roundId = source.rounds[0].roundId;
  const report = analyzeVoyageEventDefinitionRoundActionAuthoring(source);

  assert.equal(report.structurallyValid, true);
  assert.equal(report.authoringValid, false);
  assert.equal(report.roundCount, 3);
  assert.deepEqual(report.rounds, []);
});

test("issues are deterministic, source ordered, and precisely pathed", () => {
  const source = {
    rounds: [
      round("shared"),
      {},
      round("shared"),
      null
    ]
  };
  const first = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
  const second = analyzeVoyageEventDefinitionRoundActionAuthoring(source);

  assert.deepEqual(first.errors, second.errors);
  assert.deepEqual(
    first.errors.map(({ code, path }) => ({ code, path })),
    [
      { code: "invalid-event-definition-round-count", path: "rounds" },
      { code: "missing-event-definition-round-id", path: "rounds[1].roundId" },
      { code: "duplicate-event-definition-round-id", path: "rounds[2].roundId" },
      { code: "invalid-event-definition-round", path: "rounds[3]" }
    ]
  );
});

test("station and action issues remain deterministic in nested source order", () => {
  const source = definition();
  source.rounds[0].availableStations = [
    station("captain", {
      actions: [action("shared"), null, action("shared")]
    }),
    station("pilot")
  ];
  const first = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
  const second = analyzeVoyageEventDefinitionRoundActionAuthoring(source);

  assert.deepEqual(first.errors, second.errors);
  assert.deepEqual(
    first.errors.map(({ code, path }) => ({ code, path })),
    [
      {
        code: "invalid-event-definition-action",
        path: "rounds[0].availableStations[0].actions[1]"
      },
      {
        code: "duplicate-event-definition-action-id",
        path: "rounds[0].availableStations[0].actions[2].actionId"
      },
      {
        code: "unsupported-event-definition-station-id",
        path: "rounds[0].availableStations[1].stationId"
      }
    ]
  );
  assert.deepEqual(first.rounds, []);
});

test("approach issues remain deterministic in nested source order", () => {
  const source = definition();
  source.rounds[0].availableStations[0].actions[0] = {
    actionId: "invalid-approaches",
    approaches: [
      { approachId: "shared" },
      { approachId: "shared", noRoll: false },
      null
    ]
  };
  const first = analyzeVoyageEventDefinitionRoundActionAuthoring(source);
  const second = analyzeVoyageEventDefinitionRoundActionAuthoring(source);

  assert.deepEqual(first.errors, second.errors);
  assert.deepEqual(
    first.errors.map(({ code, path }) => ({ code, path })),
    [
      {
        code: "missing-event-definition-approach-execution-identity",
        path: "rounds[0].availableStations[0].actions[0].approaches[0]"
      },
      {
        code: "duplicate-event-definition-approach-id",
        path: "rounds[0].availableStations[0].actions[0].approaches[1].approachId"
      },
      {
        code: "invalid-event-definition-no-roll-identity",
        path: "rounds[0].availableStations[0].actions[0].approaches[1].noRoll"
      },
      {
        code: "invalid-event-definition-approach",
        path: "rounds[0].availableStations[0].actions[0].approaches[2]"
      },
      {
        code: "missing-third-approach-exception",
        path: "rounds[0].availableStations[0].actions[0].thirdApproachException"
      }
    ]
  );
  assert.deepEqual(first.rounds, []);
});

test("the validator delegates to analyzer results and returns isolated issue arrays", () => {
  const validSource = definition();
  const validAnalysis = analyzeVoyageEventDefinitionRoundActionAuthoring(validSource);
  const validValidation = validateVoyageEventDefinitionRoundActionAuthoring(validSource);
  assert.deepEqual(validValidation, {
    valid: validAnalysis.structurallyValid && validAnalysis.authoringValid,
    errors: validAnalysis.errors,
    warnings: validAnalysis.warnings
  });

  const invalidSource = definition(4);
  const invalidAnalysis = analyzeVoyageEventDefinitionRoundActionAuthoring(invalidSource);
  const invalidValidation = validateVoyageEventDefinitionRoundActionAuthoring(invalidSource);
  assert.deepEqual(invalidValidation, {
    valid: invalidAnalysis.structurallyValid && invalidAnalysis.authoringValid,
    errors: invalidAnalysis.errors,
    warnings: invalidAnalysis.warnings
  });
  assert.notEqual(invalidValidation.errors, invalidAnalysis.errors);
  invalidValidation.errors[0].code = "changed";
  assert.equal(invalidAnalysis.errors[0].code, "invalid-event-definition-round-count");
});

test("the pure-domain module imports without Foundry or PF2e globals", async () => {
  const previousGame = globalThis.game;
  const previousFoundry = globalThis.foundry;
  const previousConfig = globalThis.CONFIG;
  try {
    delete globalThis.game;
    delete globalThis.foundry;
    delete globalThis.CONFIG;
    const module = await import(
      `../../../scripts/voyage/domain/round-action-authoring.js?foundry-free=${Date.now()}`
    );
    assert.equal(typeof module.analyzeVoyageEventDefinitionRoundActionAuthoring, "function");
    assert.equal(typeof module.validateVoyageEventDefinitionRoundActionAuthoring, "function");
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
    if (previousFoundry === undefined) delete globalThis.foundry;
    else globalThis.foundry = previousFoundry;
    if (previousConfig === undefined) delete globalThis.CONFIG;
    else globalThis.CONFIG = previousConfig;
  }
});
