import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVoyageEncounterStationActionSelection,
  applyVoyageEncounterStationActionSelectionChange,
  applyVoyageEncounterStationActionSelectionClear,
  validateVoyageEncounterStationSelections
} from "../../../scripts/voyage/domain/station-selection.js";
import { VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES, VOYAGE_ROUND_PHASES } from "../../../scripts/voyage/domain/constants.js";
import { clonePlainData, createDraftVoyageEncounterDefaults } from "../../../scripts/voyage/domain/defaults.js";
import { validateVoyageEncounterState } from "../../../scripts/voyage/domain/validation.js";

function statisticApproach(approachId, statisticSlugOrAbilityId = approachId) {
  return { approachId, statisticSlugOrAbilityId };
}

function noRollApproach(approachId) {
  return { approachId, noRoll: true };
}

function action(actionId, approaches, authored = {}) {
  return { actionId, approaches, ...authored };
}

function encounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "station-selection", definitionId: "glassback", lifecycleState: STATES.ACTIVE, revision: 7,
    primaryShip: { actorId: "ship", details: { hull: "glassback" } }, currentStage: { stageId: "opening", details: { tags: ["alpha"] } },
    currentSituation: { threat: { id: "debris" } }, objective: { id: "survive" }, roundNumber: 2, phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    participants: [{ participantId: "captain", details: { userId: "user" } }],
    availableStations: [
      {
        stationId: "captain",
        actions: [
          action("rally-crew", [
            statisticApproach("diplomacy", "diplomacy"),
            statisticApproach("commanding-presence", "cha"),
            noRollApproach("steady-the-deck")
          ], { authored: { skill: "diplomacy" } }),
          action("coordinate-orders", [
            statisticApproach("warfare-lore", "warfare-lore"),
            noRollApproach("measured-orders"),
            statisticApproach("crew-coordination", "society")
          ])
        ],
        authored: { title: "Captain" }
      },
      {
        stationId: "engineer",
        actions: [
          action("stabilize-strain", [
            statisticApproach("crafting", "crafting"),
            statisticApproach("arkengine-lore", "arkengine-lore"),
            noRollApproach("automatic-shunt")
          ]),
          action("hard-burn-prep", [
            statisticApproach("overcharge", "crafting"),
            noRollApproach("prepared-sequence")
          ])
        ],
        authored: { title: "Engineer" }
      },
      {
        stationId: "navigator",
        actions: [action("plot-course", [
          statisticApproach("piloting-lore", "piloting-lore"),
          statisticApproach("survival", "survival"),
          statisticApproach("astronomy-lore", "astronomy-lore")
        ])],
        authored: { title: "Navigator" }
      }
    ],
    stationAssignments: [
      { stationId: "captain", operator: { kind: "actor", uuid: "Actor.captain" } },
      { stationId: "engineer", operator: { kind: "crewAsset", uuid: "Item.engineer" } }
    ],
    successConditions: [{ conditionId: "success" }], failureConditions: [{ conditionId: "failure" }],
    snapshots: [{ snapshotId: "planning-start", boundaryType: "phase-start", lifecycleState: STATES.ACTIVE, stageId: "opening", roundNumber: 2, phase: VOYAGE_ROUND_PHASES.CREW_PLANNING, temporaryState: { currentStage: { stageId: "opening" } } }],
    recovery: { status: "none" }, metadata: { nested: { retained: true } }
  };
}

function encounterWithSelection(selection, stationKey = selection.stationId) {
  const source = encounter();
  source.selections[stationKey] = selection;
  return source;
}

function statisticSelection(overrides = {}) {
  return {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
    ...overrides
  };
}

function noRollSelection(overrides = {}) {
  return {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "steady-the-deck",
    noRoll: true,
    ...overrides
  };
}

function addRiskBid(source, stationId, actionId, riskBidId) {
  const station = source.availableStations.find((entry) => entry.stationId === stationId);
  const selectedAction = station.actions.find((entry) => entry.actionId === actionId);
  selectedAction.riskBidOptions = [
    ...(selectedAction.riskBidOptions ?? []),
    { riskBidId }
  ];
  source.riskBids[stationId] = { stationId, actionId, riskBidId };
}

function failure(result, codes) {
  assert.equal(result.ok, false); assert.equal(result.nextState, null); assert.deepEqual(result.events, []);
  assert.deepEqual(result.errors.map((entry) => entry.code), codes);
}

test("validates empty, one, and multiple exact stored selections without mutation", () => {
  const source = encounter();
  assert.deepEqual(validateVoyageEncounterStationSelections(source), { valid: true, errors: [], warnings: [] });
  source.selections.captain = { stationId: "captain", actionId: "rally-crew" };
  const oneBefore = clonePlainData(source); assert.equal(validateVoyageEncounterStationSelections(source).valid, true); assert.deepEqual(source, oneBefore);
  source.selections.engineer = { stationId: "engineer", actionId: "stabilize-strain" };
  const multipleBefore = clonePlainData(source); assert.equal(validateVoyageEncounterStationSelections(source).valid, true); assert.deepEqual(source, multipleBefore);
});

test("accepts exact statistic and explicit no-roll committed selections without mutation", () => {
  const statisticSource = encounterWithSelection(statisticSelection());
  const statisticBefore = clonePlainData(statisticSource);
  assert.deepEqual(
    validateVoyageEncounterStationSelections(statisticSource),
    { valid: true, errors: [], warnings: [] }
  );
  assert.deepEqual(statisticSource, statisticBefore);

  const noRollSource = encounterWithSelection({
    stationId: "engineer",
    actionId: "stabilize-strain",
    approachId: "automatic-shunt",
    noRoll: true
  });
  const noRollBefore = clonePlainData(noRollSource);
  assert.deepEqual(
    validateVoyageEncounterStationSelections(noRollSource),
    { valid: true, errors: [], warnings: [] }
  );
  assert.deepEqual(noRollSource, noRollBefore);
});

test("rejects partial and ambiguous persisted approach execution identities", () => {
  const fixtures = [
    {
      selection: { approachId: "diplomacy" },
      codes: ["missing-selection-approach-execution-identity"],
      paths: ["selections.captain"]
    },
    {
      selection: { statisticSlugOrAbilityId: "diplomacy" },
      codes: ["missing-selection-approach-id"],
      paths: ["selections.captain.approachId"]
    },
    {
      selection: { approachId: "diplomacy", statisticSlugOrAbilityId: "diplomacy", noRoll: true },
      codes: ["ambiguous-selection-approach-execution-identity"],
      paths: ["selections.captain"]
    }
  ];

  for (const fixture of fixtures) {
    const source = encounterWithSelection({
      stationId: "captain",
      actionId: "rally-crew",
      ...fixture.selection
    });
    const result = validateVoyageEncounterStationSelections(source);
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors.map(({ code }) => code), fixture.codes);
    assert.deepEqual(result.errors.map(({ path }) => path), fixture.paths);
  }
});

test("rejects blank, unsafe, missing, cross-action, and ambiguous approach IDs", () => {
  for (const [approachId, code] of [
    ["", "invalid-selection-approach-id"],
    ["   ", "invalid-selection-approach-id"],
    ["__proto__", "unsafe-selection-approach-id"],
    ["constructor", "unsafe-selection-approach-id"],
    ["prototype", "unsafe-selection-approach-id"]
  ]) {
    const source = encounterWithSelection(statisticSelection({ approachId }));
    assert.equal(validateVoyageEncounterStationSelections(source).errors[0].code, code);
  }

  for (const approachId of ["warfare-lore", "missing"]) {
    const source = encounterWithSelection(statisticSelection({
      approachId,
      statisticSlugOrAbilityId: approachId
    }));
    const result = validateVoyageEncounterStationSelections(source);
    assert.deepEqual(result.errors.map(({ code }) => code), ["selected-approach-not-available"]);
    assert.equal(result.errors[0].path, "selections.captain.approachId");
  }

  const duplicate = encounterWithSelection(statisticSelection());
  duplicate.availableStations[0].actions[0].approaches[1] = statisticApproach(
    "diplomacy",
    "diplomacy"
  );
  assert.deepEqual(
    validateVoyageEncounterStationSelections(duplicate).errors.map(({ code, path }) => ({
      code,
      path
    })),
    [
      {
        code: "duplicate-authored-approach-id",
        path: "availableStations[0].actions[0].approaches[1].approachId"
      },
      {
        code: "selected-approach-is-ambiguous",
        path: "selections.captain.approachId"
      }
    ]
  );
});

test("requires persisted statistic identities to be exact, non-empty, and safe", () => {
  for (const [statisticSlugOrAbilityId, code] of [
    ["", "invalid-selection-statistic-or-ability-id"],
    ["   ", "invalid-selection-statistic-or-ability-id"],
    ["__proto__", "unsafe-selection-statistic-or-ability-id"],
    ["constructor", "unsafe-selection-statistic-or-ability-id"],
    ["prototype", "unsafe-selection-statistic-or-ability-id"]
  ]) {
    const source = encounterWithSelection(statisticSelection({ statisticSlugOrAbilityId }));
    assert.equal(validateVoyageEncounterStationSelections(source).errors[0].code, code);
  }

  const mismatch = encounterWithSelection(statisticSelection({
    statisticSlugOrAbilityId: "society"
  }));
  const result = validateVoyageEncounterStationSelections(mismatch);
  assert.deepEqual(result.errors.map(({ code }) => code), [
    "selection-statistic-or-ability-id-mismatch"
  ]);
  assert.equal(
    result.errors[0].path,
    "selections.captain.statisticSlugOrAbilityId"
  );
});

test("requires noRoll to be exactly true and match the authored execution kind", () => {
  const noRollFalse = encounterWithSelection({
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "steady-the-deck",
    noRoll: false
  });
  assert.deepEqual(
    validateVoyageEncounterStationSelections(noRollFalse).errors.map(({ code, path }) => ({
      code,
      path
    })),
    [{
      code: "invalid-selection-no-roll-identity",
      path: "selections.captain.noRoll"
    }]
  );

  const statisticOnNoRoll = encounterWithSelection(statisticSelection({
    approachId: "steady-the-deck",
    statisticSlugOrAbilityId: "diplomacy"
  }));
  assert.equal(
    validateVoyageEncounterStationSelections(statisticOnNoRoll).errors[0].code,
    "selection-approach-execution-mismatch"
  );

  const noRollOnStatistic = encounterWithSelection({
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "diplomacy",
    noRoll: true
  });
  assert.equal(
    validateVoyageEncounterStationSelections(noRollOnStatistic).errors[0].code,
    "selection-approach-execution-mismatch"
  );
});

test("inherited persisted approach fields neither commit nor satisfy a committed shape", () => {
  const prior = Object.fromEntries(
    ["approachId", "statisticSlugOrAbilityId", "noRoll"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(Object.prototype, key)
    ])
  );
  try {
    Object.defineProperty(Object.prototype, "approachId", {
      value: "diplomacy",
      configurable: true
    });
    Object.defineProperty(Object.prototype, "statisticSlugOrAbilityId", {
      value: "diplomacy",
      configurable: true
    });
    Object.defineProperty(Object.prototype, "noRoll", {
      value: true,
      configurable: true
    });

    const actionOnly = encounter();
    actionOnly.selections.captain = {
      stationId: "captain",
      actionId: "rally-crew"
    };
    assert.equal(validateVoyageEncounterStationSelections(actionOnly).valid, true);

    const inheritedApproach = encounter();
    inheritedApproach.selections.captain = {
      stationId: "captain",
      actionId: "rally-crew",
      statisticSlugOrAbilityId: "diplomacy"
    };
    assert.deepEqual(
      validateVoyageEncounterStationSelections(inheritedApproach).errors.map(({ code }) => code),
      ["missing-selection-approach-id"]
    );

    const inheritedIdentity = encounter();
    inheritedIdentity.selections.captain = {
      stationId: "captain",
      actionId: "rally-crew",
      approachId: "diplomacy"
    };
    assert.deepEqual(
      validateVoyageEncounterStationSelections(inheritedIdentity).errors.map(({ code }) => code),
      ["missing-selection-approach-execution-identity"]
    );
  } finally {
    for (const [key, descriptor] of Object.entries(prior)) {
      if (descriptor) Object.defineProperty(Object.prototype, key, descriptor);
      else delete Object.prototype[key];
    }
  }
});

test("rejects missing, non-array, sparse, and inherited authored approach collections", () => {
  for (const [mutate, code, path] of [
    [
      (source) => {
        delete source.availableStations[0].actions[0].approaches;
      },
      "missing-authored-approaches",
      "availableStations[0].actions[0].approaches"
    ],
    [
      (source) => {
        source.availableStations[0].actions[0].approaches = {};
      },
      "invalid-authored-approaches",
      "availableStations[0].actions[0].approaches"
    ]
  ]) {
    const source = encounterWithSelection(statisticSelection());
    mutate(source);
    const result = validateVoyageEncounterStationSelections(source);
    assert.equal(result.errors[0].code, code);
    assert.equal(result.errors[0].path, path);
  }

  const sparse = encounterWithSelection(statisticSelection());
  const approaches = new Array(3);
  approaches[0] = statisticApproach("diplomacy", "diplomacy");
  approaches[2] = noRollApproach("steady-the-deck");
  const inheritedPrototype = Object.create(Array.prototype);
  Object.defineProperty(inheritedPrototype, "1", {
    value: statisticApproach("inherited", "society"),
    configurable: true
  });
  Object.setPrototypeOf(approaches, inheritedPrototype);
  sparse.availableStations[0].actions[0].approaches = approaches;
  try {
    const result = validateVoyageEncounterStationSelections(sparse);
    assert.ok(result.errors.some(({ code }) => code === "sparse-authored-approaches"));
    assert.equal(
      result.errors.find(({ code }) => code === "sparse-authored-approaches").path,
      "availableStations[0].actions[0].approaches[1]"
    );
  } finally {
    Object.setPrototypeOf(approaches, Array.prototype);
  }
});

test("rejects malformed authored approach records and identifiers at precise paths", () => {
  for (const [approach, code, child = ""] of [
    [null, "invalid-authored-approach"],
    [[], "invalid-authored-approach"],
    [{ statisticSlugOrAbilityId: "diplomacy" }, "missing-authored-approach-id", ".approachId"],
    [statisticApproach("", "diplomacy"), "invalid-authored-approach-id", ".approachId"],
    [statisticApproach("   ", "diplomacy"), "invalid-authored-approach-id", ".approachId"],
    [statisticApproach("__proto__", "diplomacy"), "unsafe-authored-approach-id", ".approachId"]
  ]) {
    const source = encounterWithSelection(statisticSelection());
    source.availableStations[0].actions[0].approaches[2] = approach;
    const result = validateVoyageEncounterStationSelections(source);
    const matchingIssue = result.errors.find((entry) => entry.code === code);
    assert.ok(matchingIssue, code);
    assert.equal(
      matchingIssue.path,
      `availableStations[0].actions[0].approaches[2]${child}`
    );
  }
});

test("rejects malformed authored execution identities", () => {
  const fixtures = [
    [
      { approachId: "diplomacy" },
      "missing-authored-approach-execution-identity",
      "availableStations[0].actions[0].approaches[0]"
    ],
    [
      { approachId: "diplomacy", statisticSlugOrAbilityId: "diplomacy", noRoll: true },
      "ambiguous-authored-approach-execution-identity",
      "availableStations[0].actions[0].approaches[0]"
    ],
    [
      statisticApproach("diplomacy", " "),
      "invalid-authored-statistic-or-ability-id",
      "availableStations[0].actions[0].approaches[0].statisticSlugOrAbilityId"
    ],
    [
      statisticApproach("diplomacy", "prototype"),
      "unsafe-authored-statistic-or-ability-id",
      "availableStations[0].actions[0].approaches[0].statisticSlugOrAbilityId"
    ],
    [
      { approachId: "diplomacy", noRoll: false },
      "invalid-authored-no-roll-identity",
      "availableStations[0].actions[0].approaches[0].noRoll"
    ]
  ];

  for (const [approach, code, path] of fixtures) {
    const source = encounterWithSelection(statisticSelection());
    source.availableStations[0].actions[0].approaches[0] = approach;
    const result = validateVoyageEncounterStationSelections(source);
    assert.ok(result.errors.some((entry) => entry.code === code), code);
    assert.equal(result.errors.find((entry) => entry.code === code).path, path);
  }
});

test("contains hostile authored descriptor reads without invoking accessors", () => {
  const committedSelection = statisticSelection();
  let reads = 0;
  const approachesAccessor = encounterWithSelection(committedSelection);
  Object.defineProperty(approachesAccessor.availableStations[0].actions[0], "approaches", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const approachesResult = validateVoyageEncounterStationSelections(approachesAccessor);
  assert.equal(reads, 0);
  assert.equal(approachesResult.errors[0].code, "station-selection-data-read-failed");
  assert.equal(
    approachesResult.errors[0].path,
    "availableStations[0].actions[0].approaches"
  );

  const approachIdAccessor = encounterWithSelection(committedSelection);
  Object.defineProperty(
    approachIdAccessor.availableStations[0].actions[0].approaches[0],
    "approachId",
    {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("must not run");
      }
    }
  );
  const approachIdResult = validateVoyageEncounterStationSelections(approachIdAccessor);
  assert.equal(reads, 0);
  assert.equal(approachIdResult.errors[0].code, "station-selection-data-read-failed");
  assert.equal(
    approachIdResult.errors[0].path,
    "availableStations[0].actions[0].approaches[0].approachId"
  );

  const statisticAccessor = encounterWithSelection(committedSelection);
  Object.defineProperty(
    statisticAccessor.availableStations[0].actions[0].approaches[0],
    "statisticSlugOrAbilityId",
    {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("must not run");
      }
    }
  );
  const statisticResult = validateVoyageEncounterStationSelections(statisticAccessor);
  assert.equal(reads, 0);
  assert.equal(statisticResult.errors[0].code, "station-selection-data-read-failed");
  assert.equal(
    statisticResult.errors[0].path,
    "availableStations[0].actions[0].approaches[0].statisticSlugOrAbilityId"
  );

  const proxiedArray = encounterWithSelection(committedSelection);
  proxiedArray.availableStations[0].actions[0].approaches = new Proxy(
    proxiedArray.availableStations[0].actions[0].approaches,
    {
      getOwnPropertyDescriptor() {
        throw new Error("hostile descriptor");
      }
    }
  );
  const proxyResult = validateVoyageEncounterStationSelections(proxiedArray);
  assert.equal(proxyResult.valid, false);
  assert.equal(proxyResult.errors[0].code, "station-selection-data-read-failed");
  assert.equal(
    proxyResult.errors[0].path,
    "availableStations[0].actions[0].approaches.length"
  );
});

test("reports committed approach issues deterministically in authored source order", () => {
  const source = encounterWithSelection(statisticSelection({
    actionId: "coordinate-orders",
    approachId: "crew-coordination",
    statisticSlugOrAbilityId: "society"
  }));
  source.availableStations[0].actions[1].approaches = [
    { approachId: "warfare-lore" },
    { approachId: "measured-orders", noRoll: false },
    { approachId: "crew-coordination", statisticSlugOrAbilityId: "" }
  ];
  const before = clonePlainData(source);
  const first = validateVoyageEncounterStationSelections(source);
  const second = validateVoyageEncounterStationSelections(source);

  assert.deepEqual(first.errors, second.errors);
  assert.deepEqual(
    first.errors.map(({ code, path }) => ({ code, path })),
    [
      {
        code: "missing-authored-approach-execution-identity",
        path: "availableStations[0].actions[1].approaches[0]"
      },
      {
        code: "invalid-authored-no-roll-identity",
        path: "availableStations[0].actions[1].approaches[1].noRoll"
      },
      {
        code: "invalid-authored-statistic-or-ability-id",
        path: "availableStations[0].actions[1].approaches[2].statisticSlugOrAbilityId"
      }
    ]
  );
  assert.deepEqual(source, before);
});

test("propagates structural state errors and returns a fresh warnings array", () => {
  const source = encounter(); source.schemaVersion = 99; source.selections = null;
  const structural = validateVoyageEncounterState(source); const result = validateVoyageEncounterStationSelections(source);
  assert.deepEqual(result.errors, structural.errors); assert.notEqual(result.warnings, structural.warnings);
});

test("rejects stored selection shape, IDs, unsafe keys, relations, and exact-case mismatches", () => {
  const cases = [
    ["captain", null, "invalid-station-selection"], ["captain", { actionId: "rally-crew" }, "invalid-selection-station-id"],
    ["captain", { stationId: " ", actionId: "rally-crew" }, "invalid-selection-station-id"], ["captain", { stationId: "engineer", actionId: "rally-crew" }, "selection-station-key-mismatch"],
    ["captain", { stationId: "captain" }, "invalid-selection-action-id"], ["captain", { stationId: "captain", actionId: " " }, "invalid-selection-action-id"],
    ["captain", { stationId: "Captain", actionId: "rally-crew" }, "selection-station-key-mismatch"], ["captain", { stationId: "captain", actionId: "RALLY-CREW" }, "selected-action-not-available"]
  ];
  for (const [key, value, code] of cases) { const source = encounter(); source.selections[key] = value; assert.equal(validateVoyageEncounterStationSelections(source).errors[0].code, code); }
  for (const key of ["__proto__", "constructor", "prototype"]) { const source = encounter(); Object.defineProperty(source.selections, key, { value: {}, enumerable: true }); assert.equal(validateVoyageEncounterStationSelections(source).errors[0].code, "unsafe-station-selection-key"); }
  for (const [stations, code] of [
    [[], "selected-station-not-available"], [[{ stationId: "captain", actions: [] }, { stationId: "captain", actions: [] }], "selected-station-is-ambiguous"],
    [[{ stationId: "captain", actions: {} }], "invalid-available-station-actions"], [[{ stationId: "captain", actions: [] }], "selected-action-not-available"],
    [[{ stationId: "captain", actions: [{ actionId: "rally-crew" }, { actionId: "rally-crew" }] }], "selected-action-is-ambiguous"]
  ]) { const source = encounter(); source.availableStations = stations; source.selections.captain = { stationId: "captain", actionId: "rally-crew" }; assert.equal(validateVoyageEncounterStationSelections(source).errors.at(-1).code, code); }
});

test("atomically creates one isolated initial selection, revision, and event", () => {
  const source = encounter(); source.selections.engineer = { stationId: "engineer", actionId: "stabilize-strain" };
  const request = { stationId: "captain", actionId: "rally-crew", ignored: { mutable: true } }; const before = clonePlainData(source); const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterStationActionSelection(source, request);
  assert.equal(result.ok, true); assert.deepEqual(result.errors, []); assert.equal(result.events.length, 1); assert.ok(Array.isArray(result.warnings));
  assert.deepEqual(result.nextState.selections, { engineer: { stationId: "engineer", actionId: "stabilize-strain" }, captain: { stationId: "captain", actionId: "rally-crew" } });
  assert.deepEqual(Object.keys(result.nextState.selections.captain), ["stationId", "actionId"]); assert.equal(result.nextState.lifecycleState, STATES.ACTIVE); assert.equal(result.nextState.phase, VOYAGE_ROUND_PHASES.CREW_PLANNING); assert.equal(result.nextState.roundNumber, before.roundNumber); assert.deepEqual(result.nextState.currentStage, before.currentStage); assert.deepEqual(result.nextState.snapshots, before.snapshots); assert.equal(result.nextState.snapshots.length, before.snapshots.length); assert.equal(result.nextState.revision, 8);
  assert.deepEqual(result.events[0], { type: "voyage.station-action-selected", encounterId: "station-selection", lifecycleState: STATES.ACTIVE, roundNumber: 2, phase: VOYAGE_ROUND_PHASES.CREW_PLANNING, stationId: "captain", actionId: "rally-crew", previousRevision: 7, revision: 8 });
  assert.equal(validateVoyageEncounterStationSelections(result.nextState).valid, true); assert.deepEqual(source, before); assert.deepEqual(request, requestBefore);
  for (const key of ["selections", "currentStage", "participants", "availableStations", "metadata", "snapshots"]) assert.notEqual(result.nextState[key], source[key]);
  result.nextState.currentStage.details.tags.push("next"); result.nextState.availableStations[0].actions[0].authored.skill = "next"; result.nextState.selections.captain.actionId = "next";
  assert.equal(source.currentStage.details.tags.includes("next"), false); assert.equal(source.availableStations[0].actions[0].authored.skill, "diplomacy"); assert.equal(source.selections.captain, undefined);
  source.metadata.nested.retained = false; assert.equal(result.nextState.metadata.nested.retained, true);
});

test("preserves successful exact action IDs with surrounding whitespace", () => {
  const source = encounter(); const stationId = "captain"; const actionId = " rally-crew ";
  source.availableStations[0].actions[0].actionId = actionId;
  const result = applyVoyageEncounterStationActionSelection(source, { stationId, actionId });
  assert.equal(result.ok, true); assert.equal(Object.hasOwn(result.nextState.selections, stationId), true); assert.equal(result.nextState.selections[stationId].stationId, stationId); assert.equal(result.nextState.selections[stationId].actionId, actionId); assert.equal(result.events[0].stationId, stationId); assert.equal(result.events[0].actionId, actionId);
});

test("rejects persisted and requested selections for an unoccupied available station", () => {
  const persisted = encounter();
  persisted.selections.navigator = { stationId: "navigator", actionId: "plot-course" };
  assert.ok(
    validateVoyageEncounterStationSelections(persisted).errors
      .some((entry) => entry.code === "selected-station-not-occupied")
  );

  const source = encounter();
  const before = clonePlainData(source);
  failure(
    applyVoyageEncounterStationActionSelection(
      source,
      { stationId: "navigator", actionId: "plot-course" }
    ),
    ["station-not-occupied"]
  );
  assert.deepEqual(source, before);
});

test("rejects malformed state before request, lifecycle and phase before request, and request errors in order", () => {
  const malformed = encounter(); malformed.schemaVersion = 99; assert.deepEqual(applyVoyageEncounterStationActionSelection(malformed, null).errors, validateVoyageEncounterStationSelections(malformed).errors);
  for (const [lifecycle, phase, code] of [[STATES.READY, VOYAGE_ROUND_PHASES.CREW_PLANNING, "station-selection-requires-active"], [STATES.PAUSED, VOYAGE_ROUND_PHASES.CREW_PLANNING, "station-selection-requires-active"], [STATES.ACTIVE, VOYAGE_ROUND_PHASES.SITUATION, "station-selection-requires-crew-planning"], [STATES.ACTIVE, VOYAGE_ROUND_PHASES.LOCK_READINESS, "station-selection-requires-crew-planning"]]) { const source = encounter(); source.lifecycleState = lifecycle; source.phase = phase; if (lifecycle === STATES.READY) { source.roundNumber = null; source.currentStage = null; } assert.equal(applyVoyageEncounterStationActionSelection(source, null).errors[0].code, code); }
  failure(applyVoyageEncounterStationActionSelection(encounter(), null), ["invalid-station-selection-request"]);
  for (const [request, code] of [[{}, "invalid-station-id"], [{ stationId: " ", actionId: "rally-crew" }, "invalid-station-id"], [{ stationId: "captain" }, "invalid-action-id"], [{ stationId: "captain", actionId: " " }, "invalid-action-id"], [{ stationId: "Captain", actionId: "rally-crew" }, "station-not-available"], [{ stationId: "captain", actionId: "RALLY-CREW" }, "station-action-not-available"]]) assert.equal(applyVoyageEncounterStationActionSelection(encounter(), request).errors[0].code, code);
  for (const stationId of ["__proto__", "constructor", "prototype"]) assert.equal(applyVoyageEncounterStationActionSelection(encounter(), { stationId, actionId: "x" }).errors[0].code, "unsafe-station-selection-key");
});

test("rejects ambiguous or unavailable options", () => {
  for (const [mutate, code] of [
    [(source) => { source.availableStations = []; }, "station-not-available"], [(source) => { source.availableStations.push(clonePlainData(source.availableStations[0])); }, "available-station-is-ambiguous"],
    [(source) => { source.availableStations[0].actions = {}; }, "invalid-available-station-actions"], [(source) => { source.availableStations[0].actions = []; }, "station-action-not-available"],
    [(source) => { source.availableStations[0].actions.push({ actionId: "rally-crew" }); }, "station-action-is-ambiguous"]
  ]) { const source = encounter(); mutate(source); failure(applyVoyageEncounterStationActionSelection(source, { stationId: "captain", actionId: "rally-crew" }), [code]); }
});

test("does not treat inherited selections as existing own selections", () => {
  const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, "captain"); const source = encounter(); const request = { stationId: "captain", actionId: "rally-crew" };
  try {
    Object.defineProperty(Object.prototype, "captain", { value: { stationId: "captain", actionId: "rally-crew" }, configurable: true });
    assert.equal(Object.hasOwn(source.selections, "captain"), false);
    assert.equal(applyVoyageEncounterStationActionSelection(source, request).ok, true);
  } finally {
    if (descriptor) Object.defineProperty(Object.prototype, "captain", descriptor);
    else delete Object.prototype.captain;
  }
  assert.deepEqual(Object.getOwnPropertyDescriptor(Object.prototype, "captain"), descriptor);
});

test("rejects existing own selections atomically without replacement", () => {
  const source = encounter(); const request = { stationId: "captain", actionId: "coordinate-orders" };
  source.selections.captain = { stationId: "captain", actionId: "rally-crew" };
  const before = clonePlainData(source); const requestBefore = clonePlainData(request);
  const result = applyVoyageEncounterStationActionSelection(source, request);
  failure(result, ["station-selection-already-exists"]); assert.deepEqual(source.selections.captain, before.selections.captain); assert.equal(source.revision, before.revision); assert.deepEqual(source, before); assert.deepEqual(request, requestBefore);
});

test("clone construction failures and final validation failures are atomic", () => {
  const source = encounter(); const request = { stationId: "captain", actionId: "rally-crew" }; const requestBefore = clonePlainData(request); const metadata = source.metadata; let reads = 0;
  Object.defineProperty(source, "metadata", { enumerable: true, configurable: true, get() { reads += 1; if (reads >= 3) throw new Error("clone failure"); return metadata; } });
  failure(applyVoyageEncounterStationActionSelection(source, request), ["station-selection-candidate-construction-failed"]); assert.equal(source.revision, 7); assert.deepEqual(source.selections, {}); assert.deepEqual(request, requestBefore);
  const candidateFailure = encounter(); const candidateMetadata = candidateFailure.metadata; let candidateReads = 0;
  Object.defineProperty(candidateFailure, "metadata", { enumerable: true, configurable: true, get() { candidateReads += 1; return candidateReads === 1 ? candidateMetadata : null; } });
  failure(applyVoyageEncounterStationActionSelection(candidateFailure, request), ["invalid-collection-type"]); assert.equal(candidateFailure.revision, 7); assert.deepEqual(candidateFailure.selections, {});
});

test("initial action selection never auto-selects a sole statistic or no-roll approach", () => {
  for (const soleApproach of [
    statisticApproach("obvious-statistic", "diplomacy"),
    noRollApproach("automatic-resolution")
  ]) {
    const source = encounter();
    source.availableStations[0].actions[0].approaches = [soleApproach];
    const request = { stationId: "captain", actionId: "rally-crew" };
    const before = clonePlainData(source);
    const requestBefore = clonePlainData(request);

    const result = applyVoyageEncounterStationActionSelection(source, request);

    assert.equal(result.ok, true);
    assert.deepEqual(result.nextState.selections.captain, {
      stationId: "captain",
      actionId: "rally-crew"
    });
    assert.deepEqual(Object.keys(result.nextState.selections.captain), [
      "stationId",
      "actionId"
    ]);
    assert.deepEqual(source, before);
    assert.deepEqual(request, requestBefore);
  }
});

test("action change from action-only preserves the accepted event contract", () => {
  const source = encounterWithSelection({
    stationId: "captain",
    actionId: "rally-crew"
  });
  const result = applyVoyageEncounterStationActionSelectionChange(source, {
    stationId: "captain",
    actionId: "coordinate-orders"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: "coordinate-orders"
  });
  assert.deepEqual(result.events, [{
    type: "voyage.station-action-selection-changed",
    encounterId: "station-selection",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 2,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    stationId: "captain",
    previousActionId: "rally-crew",
    actionId: "coordinate-orders",
    previousRevision: 7,
    revision: 8
  }]);
  assert.equal(Object.hasOwn(result.events[0], "clearedApproachId"), false);
});

test("action change atomically clears a statistic approach and Risk Bid without inheriting a matching approach", () => {
  const source = encounterWithSelection(statisticSelection());
  source.availableStations[0].actions[1].approaches.push(
    statisticApproach("diplomacy", "diplomacy")
  );
  source.selections.engineer = {
    stationId: "engineer",
    actionId: "stabilize-strain",
    approachId: "automatic-shunt",
    noRoll: true
  };
  addRiskBid(source, "captain", "rally-crew", "press");
  addRiskBid(source, "engineer", "stabilize-strain", "hold");
  const request = { stationId: "captain", actionId: "coordinate-orders" };
  const before = clonePlainData(source);
  const requestBefore = clonePlainData(request);

  const result = applyVoyageEncounterStationActionSelectionChange(source, request);

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: "coordinate-orders"
  });
  assert.deepEqual(Object.keys(result.nextState.selections.captain), [
    "stationId",
    "actionId"
  ]);
  assert.equal(Object.hasOwn(result.nextState.riskBids, "captain"), false);
  assert.deepEqual(result.nextState.selections.engineer, before.selections.engineer);
  assert.deepEqual(result.nextState.riskBids.engineer, before.riskBids.engineer);
  assert.deepEqual(result.nextState.metadata, before.metadata);
  assert.equal(result.nextState.revision, 8);
  assert.deepEqual(result.events, [{
    type: "voyage.station-action-selection-changed",
    encounterId: "station-selection",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 2,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    stationId: "captain",
    previousActionId: "rally-crew",
    actionId: "coordinate-orders",
    clearedApproachId: "diplomacy",
    clearedRiskBidId: "press",
    previousRevision: 7,
    revision: 8
  }]);
  assert.deepEqual(source, before);
  assert.deepEqual(request, requestBefore);

  result.events[0].actionId = "event-only";
  assert.equal(result.nextState.selections.captain.actionId, "coordinate-orders");
  result.nextState.metadata.nested.retained = false;
  assert.equal(source.metadata.nested.retained, true);
});

test("action change clears a no-roll approach and its obsolete identity", () => {
  const source = encounterWithSelection(noRollSelection());
  const result = applyVoyageEncounterStationActionSelectionChange(source, {
    stationId: "captain",
    actionId: "coordinate-orders"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: "coordinate-orders"
  });
  assert.equal(Object.hasOwn(result.nextState.selections.captain, "noRoll"), false);
  assert.equal(
    Object.hasOwn(result.nextState.selections.captain, "statisticSlugOrAbilityId"),
    false
  );
  assert.equal(result.events[0].clearedApproachId, "steady-the-deck");
  assert.equal(Object.hasOwn(result.events[0], "clearedRiskBidId"), false);
});

test("action clear deletes committed statistic and no-roll selections with exact audit metadata", () => {
  for (const [selection, expectedApproachId] of [
    [statisticSelection(), "diplomacy"],
    [noRollSelection(), "steady-the-deck"]
  ]) {
    const source = encounterWithSelection(selection);
    const request = { stationId: "captain" };
    const before = clonePlainData(source);
    const requestBefore = clonePlainData(request);

    const result = applyVoyageEncounterStationActionSelectionClear(source, request);

    assert.equal(result.ok, true);
    assert.equal(Object.hasOwn(result.nextState.selections, "captain"), false);
    assert.equal(result.nextState.revision, 8);
    assert.deepEqual(result.events, [{
      type: "voyage.station-action-selection-cleared",
      encounterId: "station-selection",
      lifecycleState: STATES.ACTIVE,
      roundNumber: 2,
      phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
      stationId: "captain",
      actionId: "rally-crew",
      clearedApproachId: expectedApproachId,
      previousRevision: 7,
      revision: 8
    }]);
    assert.deepEqual(source, before);
    assert.deepEqual(request, requestBefore);
  }
});

test("action clear atomically removes an approach and Risk Bid while preserving unrelated station data", () => {
  const source = encounterWithSelection(statisticSelection());
  source.selections.engineer = {
    stationId: "engineer",
    actionId: "stabilize-strain"
  };
  addRiskBid(source, "captain", "rally-crew", "press");
  addRiskBid(source, "engineer", "stabilize-strain", "hold");
  const before = clonePlainData(source);

  const result = applyVoyageEncounterStationActionSelectionClear(source, {
    stationId: "captain"
  });

  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.nextState.selections, "captain"), false);
  assert.equal(Object.hasOwn(result.nextState.riskBids, "captain"), false);
  assert.deepEqual(result.nextState.selections.engineer, before.selections.engineer);
  assert.deepEqual(result.nextState.riskBids.engineer, before.riskBids.engineer);
  assert.deepEqual(result.nextState.metadata, before.metadata);
  assert.deepEqual(result.events[0], {
    type: "voyage.station-action-selection-cleared",
    encounterId: "station-selection",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 2,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    stationId: "captain",
    actionId: "rally-crew",
    clearedApproachId: "diplomacy",
    clearedRiskBidId: "press",
    previousRevision: 7,
    revision: 8
  });
  result.events[0].actionId = "event-only";
  assert.deepEqual(source, before);
});

test("action clear omits approach metadata for an action-only selection", () => {
  const source = encounterWithSelection({
    stationId: "captain",
    actionId: "rally-crew"
  });
  const result = applyVoyageEncounterStationActionSelectionClear(source, {
    stationId: "captain"
  });

  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.nextState.selections, "captain"), false);
  assert.equal(Object.hasOwn(result.events[0], "clearedApproachId"), false);
});

test("failed action change and malformed action clear preserve approach, Risk Bid, requests, and revision", () => {
  const changeSource = encounterWithSelection(statisticSelection());
  addRiskBid(changeSource, "captain", "rally-crew", "press");
  const changeRequest = { stationId: "captain", actionId: "missing" };
  const changeBefore = clonePlainData(changeSource);
  const changeRequestBefore = clonePlainData(changeRequest);
  const changeResult = applyVoyageEncounterStationActionSelectionChange(
    changeSource,
    changeRequest
  );
  failure(changeResult, ["station-action-not-available"]);
  assert.deepEqual(changeSource, changeBefore);
  assert.deepEqual(changeRequest, changeRequestBefore);

  const clearSource = encounterWithSelection({
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "diplomacy"
  });
  addRiskBid(clearSource, "captain", "rally-crew", "press");
  const clearRequest = { stationId: "captain" };
  const clearBefore = clonePlainData(clearSource);
  const clearRequestBefore = clonePlainData(clearRequest);
  const clearResult = applyVoyageEncounterStationActionSelectionClear(
    clearSource,
    clearRequest
  );
  failure(clearResult, ["missing-selection-approach-execution-identity"]);
  assert.deepEqual(clearSource, clearBefore);
  assert.deepEqual(clearRequest, clearRequestBefore);
});

test("the station selection domain module imports without Foundry globals", async () => {
  const previous = Object.fromEntries(
    ["foundry", "CONFIG", "game"].map((key) => [
      key,
      { exists: Object.hasOwn(globalThis, key), value: globalThis[key] }
    ])
  );
  try {
    delete globalThis.foundry;
    delete globalThis.CONFIG;
    delete globalThis.game;
    const module = await import(
      `../../../scripts/voyage/domain/station-selection.js?foundry-free=${Date.now()}`
    );
    assert.equal(typeof module.validateVoyageEncounterStationSelections, "function");
    assert.equal(typeof module.applyVoyageEncounterStationActionSelection, "function");
  } finally {
    for (const [key, entry] of Object.entries(previous)) {
      if (entry.exists) globalThis[key] = entry.value;
      else delete globalThis[key];
    }
  }
});

test("Arcflight registers station selection functions and devTools aliases", async () => {
  const previous = Object.fromEntries(["foundry", "Hooks", "CONFIG", "game"].map((key) => [key, { exists: Object.hasOwn(globalThis, key), value: globalThis[key] }])); let init;
  class TestActorSheetV2 {}
  try {
    globalThis.foundry = { applications: { api: { HandlebarsApplicationMixin: (Base) => Base }, sheets: { ActorSheetV2: TestActorSheetV2 }, apps: {} }, documents: {}, utils: {} };
    globalThis.Hooks = { once: (_event, callback) => { init = callback; } }; globalThis.CONFIG = {}; globalThis.game = {};
    const arcflight = await import(`../../../scripts/arcflight.js?station-selection=${Date.now()}`); init();
    assert.equal(typeof arcflight.validateVoyageEncounterStationSelections, "function"); assert.equal(typeof arcflight.applyVoyageEncounterStationActionSelection, "function"); assert.equal(typeof game.arcflight.validateVoyageEncounterStationSelections, "function"); assert.equal(typeof game.arcflight.applyVoyageEncounterStationActionSelection, "function"); assert.equal(typeof game.arcflight.devTools.validateVoyageEncounterStationSelections, "function"); assert.equal(typeof game.arcflight.devTools.applyVoyageEncounterStationActionSelection, "function");
  } finally { for (const [key, value] of Object.entries(previous)) { if (value.exists) globalThis[key] = value.value; else delete globalThis[key]; } }
});

test("initial selection rejects invalid persisted Risk Bids atomically and validates accepted candidates", async () => {
  const { validateVoyageEncounterRiskBids } = await import("../../../scripts/voyage/domain/risk-bids.js");
  const source = encounter();
  source.riskBids.navigator = { stationId: "navigator", actionId: "thread", riskBidId: "close" };
  const before = clonePlainData(source);
  const result = applyVoyageEncounterStationActionSelection(source, { stationId: "captain", actionId: "rally-crew" });
  failure(result, ["risk-bid-selection-missing"]);
  assert.equal(source.revision, before.revision); assert.deepEqual(source, before);
  const mismatch = encounter(); mismatch.selections.engineer = { stationId: "engineer", actionId: "stabilize-strain" };
  mismatch.availableStations[1].actions[0].riskBidOptions = [{ riskBidId: "close" }];
  mismatch.riskBids.engineer = { stationId: "engineer", actionId: "hard-burn-prep", riskBidId: "close" };
  assert.equal(applyVoyageEncounterStationActionSelection(mismatch, { stationId: "captain", actionId: "rally-crew" }).ok, false);
  const valid = encounter(); const accepted = applyVoyageEncounterStationActionSelection(valid, { stationId: "captain", actionId: "rally-crew" });
  assert.equal(accepted.ok, true); assert.equal(validateVoyageEncounterStationSelections(accepted.nextState).valid, true); assert.equal(validateVoyageEncounterRiskBids(accepted.nextState).valid, true);
});

test("ignores inherited stations and actions in real sparse array holes", () => {
  const source = encounter();
  const stations = new Array(1); const stationPrototype = Object.create(Array.prototype);
  Object.defineProperty(stationPrototype, "0", { value: { stationId: "inherited", actions: [{ actionId: "ghost" }] }, configurable: true }); Object.setPrototypeOf(stations, stationPrototype);
  source.availableStations = stations; source.selections = { inherited: { stationId: "inherited", actionId: "ghost" } };
  try { assert.ok(validateVoyageEncounterStationSelections(source).errors.some((entry) => entry.code === "selected-station-not-available")); } finally { Object.setPrototypeOf(stations, Array.prototype); }
});
