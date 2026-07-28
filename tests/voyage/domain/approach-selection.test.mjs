import assert from "node:assert/strict";
import test from "node:test";
import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES as STATES,
  VOYAGE_ROUND_PHASES,
} from "../../../scripts/voyage/domain/constants.js";
import {
  clonePlainData,
  createDraftVoyageEncounterDefaults,
} from "../../../scripts/voyage/domain/defaults.js";
import {
  applyVoyageEncounterStationApproachSelection,
  applyVoyageEncounterStationApproachSelectionChange,
  applyVoyageEncounterStationApproachSelectionClear,
} from "../../../scripts/voyage/domain/approach-selection.js";

function statisticApproach(
  approachId,
  statisticSlugOrAbilityId = approachId,
) {
  return { approachId, statisticSlugOrAbilityId };
}

function noRollApproach(approachId) {
  return { approachId, noRoll: true };
}

function action(actionId, approaches, authored = {}) {
  return {
    actionId,
    approaches,
    riskBidOptions: [],
    ...authored,
  };
}

function encounter() {
  return {
    ...createDraftVoyageEncounterDefaults(),
    encounterId: "approach-selection",
    definitionId: "glassback",
    lifecycleState: STATES.ACTIVE,
    revision: 11,
    primaryShip: { actorId: "Actor.ship" },
    currentStage: { stageId: "opening" },
    roundNumber: 2,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    availableStations: [
      {
        stationId: "captain",
        actions: [
          action(
            "rally-crew",
            [
              statisticApproach("diplomacy"),
              statisticApproach("commanding-presence", "cha"),
              noRollApproach("steady-the-deck"),
            ],
            { riskBidOptions: [{ riskBidId: "press" }] },
          ),
          action("coordinate-orders", [
            statisticApproach("warfare-lore"),
            noRollApproach("measured-orders"),
          ]),
        ],
      },
      {
        stationId: "engineer",
        actions: [
          action("stabilize-strain", [
            statisticApproach("crafting"),
            noRollApproach("automatic-shunt"),
          ]),
        ],
      },
      {
        stationId: "navigator",
        actions: [
          action("plot-course", [
            statisticApproach("survival"),
            statisticApproach("astronomy-lore"),
          ]),
        ],
      },
    ],
    stationAssignments: [
      {
        stationId: "captain",
        operator: { kind: "actor", uuid: "Actor.captain" },
      },
      {
        stationId: "engineer",
        operator: { kind: "crewAsset", uuid: "Item.engineer" },
      },
    ],
    selections: {
      captain: { stationId: "captain", actionId: "rally-crew" },
      engineer: { stationId: "engineer", actionId: "stabilize-strain" },
    },
    riskBids: {
      captain: {
        stationId: "captain",
        actionId: "rally-crew",
        riskBidId: "press",
      },
    },
    successConditions: [{ conditionId: "success" }],
    failureConditions: [{ conditionId: "failure" }],
    metadata: { retained: { value: true } },
  };
}

function committedEncounter(approach) {
  const source = encounter();
  source.selections.captain = {
    stationId: "captain",
    actionId: "rally-crew",
    ...approach,
  };
  return source;
}

function failure(result) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
}

function codes(result) {
  return result.errors.map(({ code }) => code);
}

test("selects a statistic approach with the exact committed shape and event", () => {
  const source = encounter();
  const request = { stationId: "captain", approachId: "diplomacy" };
  const before = clonePlainData(source);
  const requestBefore = clonePlainData(request);

  const result = applyVoyageEncounterStationApproachSelection(source, request);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  assert.deepEqual(result.events, [
    {
      type: "voyage.station-approach-selected",
      encounterId: "approach-selection",
      lifecycleState: STATES.ACTIVE,
      roundNumber: 2,
      phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
      stationId: "captain",
      actionId: "rally-crew",
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy",
      previousRevision: 11,
      revision: 12,
    },
  ]);
  assert.equal(result.nextState.revision, 12);
  assert.deepEqual(result.nextState.selections.engineer, source.selections.engineer);
  assert.deepEqual(result.nextState.riskBids, source.riskBids);
  assert.deepEqual(source, before);
  assert.deepEqual(request, requestBefore);
});

test("selects ability and explicit no-roll approaches with exact exclusive identities", () => {
  const ability = applyVoyageEncounterStationApproachSelection(encounter(), {
    stationId: "captain",
    approachId: "commanding-presence",
  });
  assert.deepEqual(ability.nextState.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "commanding-presence",
    statisticSlugOrAbilityId: "cha",
  });
  assert.equal(Object.hasOwn(ability.nextState.selections.captain, "noRoll"), false);

  const noRoll = applyVoyageEncounterStationApproachSelection(encounter(), {
    stationId: "captain",
    approachId: "steady-the-deck",
  });
  assert.deepEqual(noRoll.nextState.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "steady-the-deck",
    noRoll: true,
  });
  assert.equal(
    Object.hasOwn(
      noRoll.nextState.selections.captain,
      "statisticSlugOrAbilityId",
    ),
    false,
  );
  assert.deepEqual(noRoll.events[0], {
    type: "voyage.station-approach-selected",
    encounterId: "approach-selection",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 2,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "steady-the-deck",
    noRoll: true,
    previousRevision: 11,
    revision: 12,
  });
});

test("derives action and execution authority only from state and authored data", () => {
  const request = {
    stationId: "captain",
    approachId: "diplomacy",
    actionId: "coordinate-orders",
    statisticSlugOrAbilityId: "forged",
    abilityId: "forged",
    noRoll: true,
  };
  const result = applyVoyageEncounterStationApproachSelection(
    encounter(),
    request,
  );

  assert.equal(result.ok, true);
  assert.equal(result.nextState.selections.captain.actionId, "rally-crew");
  assert.equal(
    result.nextState.selections.captain.statisticSlugOrAbilityId,
    "diplomacy",
  );
  assert.equal(Object.hasOwn(result.nextState.selections.captain, "noRoll"), false);
  assert.equal(Object.hasOwn(result.nextState.selections.captain, "abilityId"), false);
});

test("requires an action-only selection and rejects an existing committed approach", () => {
  const noAction = encounter();
  delete noAction.selections.captain;
  delete noAction.riskBids.captain;
  const missing = applyVoyageEncounterStationApproachSelection(noAction, {
    stationId: "captain",
    approachId: "diplomacy",
  });
  failure(missing);
  assert.deepEqual(codes(missing), ["station-action-selection-missing"]);
  assert.equal(missing.errors[0].path, "selections.captain");

  const committed = encounter();
  committed.selections.captain = {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  };
  const existing = applyVoyageEncounterStationApproachSelection(committed, {
    stationId: "captain",
    approachId: "steady-the-deck",
  });
  failure(existing);
  assert.deepEqual(codes(existing), [
    "station-approach-selection-already-exists",
  ]);
  assert.equal(existing.errors[0].path, "selections.captain");
});

test("requires an Active encounter in Crew Planning", () => {
  const paused = encounter();
  paused.lifecycleState = STATES.PAUSED;
  const pausedResult = applyVoyageEncounterStationApproachSelection(paused, {
    stationId: "captain",
    approachId: "diplomacy",
  });
  failure(pausedResult);
  assert.deepEqual(codes(pausedResult), [
    "approach-selection-requires-active-encounter",
  ]);
  assert.equal(pausedResult.errors[0].path, "lifecycleState");

  const resolving = encounter();
  resolving.phase = VOYAGE_ROUND_PHASES.RESOLUTION;
  const resolvingResult = applyVoyageEncounterStationApproachSelection(
    resolving,
    { stationId: "captain", approachId: "diplomacy" },
  );
  failure(resolvingResult);
  assert.deepEqual(codes(resolvingResult), [
    "approach-selection-requires-crew-planning",
  ]);
  assert.equal(resolvingResult.errors[0].path, "phase");
});

test("rejects unavailable and unoccupied stations before action lookup", () => {
  const unavailable = applyVoyageEncounterStationApproachSelection(encounter(), {
    stationId: "watchmaster",
    approachId: "diplomacy",
  });
  failure(unavailable);
  assert.deepEqual(codes(unavailable), [
    "approach-selection-station-not-available",
  ]);
  assert.equal(unavailable.errors[0].path, "approachRequest.stationId");

  const unoccupied = applyVoyageEncounterStationApproachSelection(encounter(), {
    stationId: "navigator",
    approachId: "survival",
  });
  failure(unoccupied);
  assert.deepEqual(codes(unoccupied), [
    "approach-selection-station-not-occupied",
  ]);
  assert.equal(unoccupied.errors[0].path, "approachRequest.stationId");
});

test("rejects a station that is not uniquely available", () => {
  const source = encounter();
  source.availableStations.push(clonePlainData(source.availableStations[0]));
  const before = clonePlainData(source);
  const result = applyVoyageEncounterStationApproachSelection(source, {
    stationId: "captain",
    approachId: "diplomacy",
  });

  failure(result);
  assert.ok(codes(result).includes("selected-station-is-ambiguous"));
  assert.deepEqual(source, before);
});

test("rejects blank and unsafe station IDs with deterministic request paths", () => {
  for (const stationId of ["", "   "]) {
    const result = applyVoyageEncounterStationApproachSelection(encounter(), {
      stationId,
      approachId: "diplomacy",
    });
    failure(result);
    assert.deepEqual(codes(result), ["invalid-approach-selection-station-id"]);
    assert.equal(result.errors[0].path, "approachRequest.stationId");
  }

  for (const stationId of ["__proto__", "constructor", "prototype"]) {
    const result = applyVoyageEncounterStationApproachSelection(encounter(), {
      stationId,
      approachId: "diplomacy",
    });
    failure(result);
    assert.deepEqual(codes(result), ["unsafe-approach-selection-station-key"]);
    assert.equal(result.errors[0].path, "approachRequest.stationId");
  }
});

test("rejects blank and unsafe approach IDs with deterministic request paths", () => {
  for (const approachId of ["", "   "]) {
    const result = applyVoyageEncounterStationApproachSelection(encounter(), {
      stationId: "captain",
      approachId,
    });
    failure(result);
    assert.deepEqual(codes(result), ["invalid-approach-id"]);
    assert.equal(result.errors[0].path, "approachRequest.approachId");
  }

  for (const approachId of ["__proto__", "constructor", "prototype"]) {
    const result = applyVoyageEncounterStationApproachSelection(encounter(), {
      stationId: "captain",
      approachId,
    });
    failure(result);
    assert.deepEqual(codes(result), ["unsafe-approach-id"]);
    assert.equal(result.errors[0].path, "approachRequest.approachId");
  }
});

test("matches approach IDs exactly and only on the current action", () => {
  for (const approachId of [
    "warfare-lore",
    "missing",
    " diplomacy",
    "diplomacy ",
  ]) {
    const result = applyVoyageEncounterStationApproachSelection(encounter(), {
      stationId: "captain",
      approachId,
    });
    failure(result);
    assert.deepEqual(codes(result), ["approach-not-available"]);
    assert.equal(result.errors[0].path, "approachRequest.approachId");
  }
});

test("rejects missing and ambiguous selected authored actions atomically", () => {
  const missing = encounter();
  missing.selections.captain.actionId = "missing";
  missing.riskBids = {};
  const missingBefore = clonePlainData(missing);
  const missingResult = applyVoyageEncounterStationApproachSelection(missing, {
    stationId: "captain",
    approachId: "diplomacy",
  });
  failure(missingResult);
  assert.ok(codes(missingResult).includes("selected-action-not-available"));
  assert.deepEqual(missing, missingBefore);

  const ambiguous = encounter();
  ambiguous.availableStations[0].actions.push(
    action("rally-crew", [statisticApproach("diplomacy")]),
  );
  const ambiguousBefore = clonePlainData(ambiguous);
  const ambiguousResult = applyVoyageEncounterStationApproachSelection(
    ambiguous,
    { stationId: "captain", approachId: "diplomacy" },
  );
  failure(ambiguousResult);
  assert.ok(codes(ambiguousResult).includes("selected-action-is-ambiguous"));
  assert.deepEqual(ambiguous, ambiguousBefore);
});

test("rejects malformed current selections through source validation", () => {
  const source = encounter();
  source.selections.captain.approachId = "diplomacy";
  const before = clonePlainData(source);
  const result = applyVoyageEncounterStationApproachSelection(source, {
    stationId: "captain",
    approachId: "diplomacy",
  });

  failure(result);
  assert.deepEqual(codes(result), [
    "missing-selection-approach-execution-identity",
  ]);
  assert.equal(result.errors[0].path, "selections.captain");
  assert.deepEqual(source, before);
});

test("rejects duplicate authored approaches with deterministic issue ordering", () => {
  const source = encounter();
  source.availableStations[0].actions[0].approaches.push(
    statisticApproach("diplomacy"),
  );
  const before = clonePlainData(source);
  const result = applyVoyageEncounterStationApproachSelection(source, {
    stationId: "captain",
    approachId: "diplomacy",
  });

  failure(result);
  assert.deepEqual(codes(result), [
    "duplicate-authored-approach-id",
    "approach-is-ambiguous",
  ]);
  assert.deepEqual(
    result.errors.map(({ path }) => path),
    [
      "availableStations[0].actions[0].approaches[3].approachId",
      "approachRequest.approachId",
    ],
  );
  assert.deepEqual(source, before);
});

test("rejects sparse, inherited, non-plain, and unreadable authored entries", () => {
  const fixtures = [
    {
      prepare(approaches) {
        approaches.length = 4;
      },
      code: "sparse-authored-approaches",
      path: "availableStations[0].actions[0].approaches[3]",
    },
    {
      prepare(approaches) {
        approaches[0] = new Date(0);
      },
      code: "invalid-authored-approach",
      path: "availableStations[0].actions[0].approaches[0]",
    },
    {
      prepare(approaches) {
        Object.defineProperty(approaches, "0", {
          get() {
            throw new Error("must not execute");
          },
          enumerable: true,
          configurable: true,
        });
      },
      code: "station-selection-data-read-failed",
      path: "availableStations[0].actions[0].approaches[0]",
    },
  ];

  for (const fixture of fixtures) {
    const source = encounter();
    fixture.prepare(source.availableStations[0].actions[0].approaches);
    const result = applyVoyageEncounterStationApproachSelection(source, {
      stationId: "captain",
      approachId: "diplomacy",
    });
    failure(result);
    assert.ok(codes(result).includes(fixture.code), fixture.code);
    const entry = result.errors.find(({ code }) => code === fixture.code);
    assert.equal(entry.path, fixture.path);
  }

  const inherited = encounter();
  const approaches = inherited.availableStations[0].actions[0].approaches;
  approaches.length = 4;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, "3", {
    value: statisticApproach("inherited"),
    configurable: true,
  });
  Object.setPrototypeOf(approaches, prototype);
  try {
    const result = applyVoyageEncounterStationApproachSelection(inherited, {
      stationId: "captain",
      approachId: "inherited",
    });
    failure(result);
    assert.ok(codes(result).includes("sparse-authored-approaches"));
  } finally {
    Object.setPrototypeOf(approaches, Array.prototype);
  }
});

test("rejects malformed authored approach IDs and execution identities precisely", () => {
  const fixtures = [
    {
      approach: { statisticSlugOrAbilityId: "diplomacy" },
      code: "missing-authored-approach-id",
      suffix: ".approachId",
    },
    {
      approach: { approachId: "diplomacy" },
      code: "missing-authored-approach-execution-identity",
      suffix: "",
    },
    {
      approach: {
        approachId: "diplomacy",
        statisticSlugOrAbilityId: "diplomacy",
        noRoll: true,
      },
      code: "ambiguous-authored-approach-execution-identity",
      suffix: "",
    },
    {
      approach: { approachId: "diplomacy", noRoll: false },
      code: "invalid-authored-no-roll-identity",
      suffix: ".noRoll",
    },
    {
      approach: {
        approachId: "diplomacy",
        statisticSlugOrAbilityId: "   ",
      },
      code: "invalid-authored-statistic-or-ability-id",
      suffix: ".statisticSlugOrAbilityId",
    },
  ];

  for (const fixture of fixtures) {
    const source = encounter();
    source.availableStations[0].actions[0].approaches = [fixture.approach];
    const result = applyVoyageEncounterStationApproachSelection(source, {
      stationId: "captain",
      approachId: "diplomacy",
    });
    failure(result);
    const entry = result.errors.find(({ code }) => code === fixture.code);
    assert.ok(entry, fixture.code);
    assert.equal(
      entry.path,
      `availableStations[0].actions[0].approaches[0]${fixture.suffix}`,
    );
  }
});

test("requires plain requests with own data fields and never invokes accessors", () => {
  for (const request of [null, [], "captain"]) {
    const result = applyVoyageEncounterStationApproachSelection(
      encounter(),
      request,
    );
    failure(result);
    assert.deepEqual(codes(result), ["invalid-approach-selection-request"]);
    assert.equal(result.errors[0].path, "approachRequest");
  }

  const inherited = Object.create({
    stationId: "captain",
    approachId: "diplomacy",
  });
  const inheritedResult = applyVoyageEncounterStationApproachSelection(
    encounter(),
    inherited,
  );
  failure(inheritedResult);
  assert.deepEqual(codes(inheritedResult), [
    "invalid-approach-selection-request",
  ]);

  const missingOwnResult = applyVoyageEncounterStationApproachSelection(
    encounter(),
    {},
  );
  failure(missingOwnResult);
  assert.deepEqual(codes(missingOwnResult), [
    "invalid-approach-selection-station-id",
    "invalid-approach-id",
  ]);

  let reads = 0;
  const accessor = { stationId: "captain" };
  Object.defineProperty(accessor, "approachId", {
    get() {
      reads += 1;
      throw new Error("must not execute");
    },
    enumerable: true,
  });
  const accessorResult = applyVoyageEncounterStationApproachSelection(
    encounter(),
    accessor,
  );
  failure(accessorResult);
  assert.equal(reads, 0);
  assert.deepEqual(codes(accessorResult), [
    "approach-selection-data-read-failed",
  ]);
  assert.equal(accessorResult.errors[0].path, "approachRequest.approachId");
});

test("fails atomically when source or candidate validation fails", () => {
  const invalidSource = encounter();
  invalidSource.riskBids.captain.riskBidId = "missing";
  const invalidBefore = clonePlainData(invalidSource);
  const invalidResult = applyVoyageEncounterStationApproachSelection(
    invalidSource,
    { stationId: "captain", approachId: "diplomacy" },
  );
  failure(invalidResult);
  assert.ok(codes(invalidResult).includes("risk-bid-not-available"));
  assert.deepEqual(invalidSource, invalidBefore);
  assert.equal(invalidSource.revision, 11);

  const candidateFailure = encounter();
  const validMetadata = candidateFailure.metadata;
  let metadataReads = 0;
  Object.defineProperty(candidateFailure, "metadata", {
    get() {
      metadataReads += 1;
      return metadataReads < 3 ? validMetadata : null;
    },
    enumerable: true,
    configurable: true,
  });
  const result = applyVoyageEncounterStationApproachSelection(
    candidateFailure,
    { stationId: "captain", approachId: "diplomacy" },
  );
  failure(result);
  assert.ok(codes(result).includes("invalid-collection-type"));
  assert.equal(candidateFailure.revision, 11);
  assert.deepEqual(candidateFailure.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
  });
});

test("returns atomic structured failures for hostile reads and clone failures", () => {
  const hostile = encounter();
  hostile.availableStations[0].actions[0].approaches = new Proxy([], {
    getOwnPropertyDescriptor() {
      throw new Error("hostile");
    },
  });
  const hostileResult = applyVoyageEncounterStationApproachSelection(hostile, {
    stationId: "captain",
    approachId: "diplomacy",
  });
  failure(hostileResult);
  assert.ok(
    codes(hostileResult).some((code) =>
      [
        "station-selection-data-read-failed",
        "approach-selection-data-read-failed",
      ].includes(code),
    ),
  );

  const cloneFailure = encounter();
  let metadataReads = 0;
  const validMetadata = cloneFailure.metadata;
  Object.defineProperty(cloneFailure, "metadata", {
    get() {
      metadataReads += 1;
      if (metadataReads >= 3) throw new Error("clone failed");
      return validMetadata;
    },
    enumerable: true,
    configurable: true,
  });
  const cloneResult = applyVoyageEncounterStationApproachSelection(
    cloneFailure,
    { stationId: "captain", approachId: "diplomacy" },
  );
  failure(cloneResult);
  assert.deepEqual(codes(cloneResult), ["approach-selection-clone-failed"]);
  assert.equal(cloneFailure.revision, 11);
});

test("isolates next state and event data from source, request, and each other", () => {
  const source = encounter();
  const request = { stationId: "captain", approachId: "diplomacy" };
  const result = applyVoyageEncounterStationApproachSelection(source, request);

  assert.equal(result.ok, true);
  assert.notEqual(result.nextState, source);
  assert.notEqual(result.nextState.selections, source.selections);
  assert.notEqual(result.nextState.riskBids, source.riskBids);
  assert.notEqual(result.nextState.metadata, source.metadata);

  result.events[0].actionId = "changed-event";
  result.nextState.selections.captain.actionId = "changed-state";
  result.nextState.metadata.retained.value = false;
  result.nextState.riskBids.captain.riskBidId = "changed-bid";

  assert.equal(source.selections.captain.actionId, "rally-crew");
  assert.equal(source.metadata.retained.value, true);
  assert.equal(source.riskBids.captain.riskBidId, "press");
  assert.equal(request.approachId, "diplomacy");
  assert.equal(result.events[0].stationId, "captain");
});

test("changes a statistic approach with the exact replacement and event", () => {
  const source = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  const request = {
    stationId: "captain",
    approachId: "commanding-presence",
  };
  const before = clonePlainData(source);
  const requestBefore = clonePlainData(request);

  const result = applyVoyageEncounterStationApproachSelectionChange(
    source,
    request,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "commanding-presence",
    statisticSlugOrAbilityId: "cha",
  });
  assert.deepEqual(result.events, [
    {
      type: "voyage.station-approach-selection-changed",
      encounterId: "approach-selection",
      lifecycleState: STATES.ACTIVE,
      roundNumber: 2,
      phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
      stationId: "captain",
      actionId: "rally-crew",
      previousApproachId: "diplomacy",
      approachId: "commanding-presence",
      statisticSlugOrAbilityId: "cha",
      previousRevision: 11,
      revision: 12,
    },
  ]);
  assert.equal(result.nextState.revision, 12);
  assert.deepEqual(result.nextState.selections.engineer, source.selections.engineer);
  assert.deepEqual(result.nextState.riskBids, source.riskBids);
  assert.deepEqual(source, before);
  assert.deepEqual(request, requestBefore);
});

test("changes between statistic and no-roll shapes without retaining old identities", () => {
  const statisticSource = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  const toNoRoll = applyVoyageEncounterStationApproachSelectionChange(
    statisticSource,
    { stationId: "captain", approachId: "steady-the-deck" },
  );
  assert.deepEqual(toNoRoll.nextState.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "steady-the-deck",
    noRoll: true,
  });
  assert.equal(
    Object.hasOwn(
      toNoRoll.nextState.selections.captain,
      "statisticSlugOrAbilityId",
    ),
    false,
  );
  assert.deepEqual(toNoRoll.events[0], {
    type: "voyage.station-approach-selection-changed",
    encounterId: "approach-selection",
    lifecycleState: STATES.ACTIVE,
    roundNumber: 2,
    phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
    stationId: "captain",
    actionId: "rally-crew",
    previousApproachId: "diplomacy",
    approachId: "steady-the-deck",
    noRoll: true,
    previousRevision: 11,
    revision: 12,
  });

  const noRollSource = committedEncounter({
    approachId: "steady-the-deck",
    noRoll: true,
  });
  const toStatistic = applyVoyageEncounterStationApproachSelectionChange(
    noRollSource,
    { stationId: "captain", approachId: "diplomacy" },
  );
  assert.deepEqual(toStatistic.nextState.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  assert.equal(
    Object.hasOwn(toStatistic.nextState.selections.captain, "noRoll"),
    false,
  );
});

test("changes between two authored no-roll approaches", () => {
  const source = committedEncounter({
    approachId: "steady-the-deck",
    noRoll: true,
  });
  source.availableStations[0].actions[0].approaches.push(
    noRollApproach("hold-the-line"),
  );

  const result = applyVoyageEncounterStationApproachSelectionChange(source, {
    stationId: "captain",
    approachId: "hold-the-line",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "hold-the-line",
    noRoll: true,
  });
  assert.equal(result.events[0].previousApproachId, "steady-the-deck");
  assert.equal(result.events[0].noRoll, true);
});

test("requires a committed approach and rejects an unchanged change request", () => {
  const noAction = encounter();
  delete noAction.selections.captain;
  delete noAction.riskBids.captain;
  const missingAction = applyVoyageEncounterStationApproachSelectionChange(
    noAction,
    { stationId: "captain", approachId: "diplomacy" },
  );
  failure(missingAction);
  assert.deepEqual(codes(missingAction), ["station-action-selection-missing"]);

  const actionOnly = encounter();
  const missingApproach = applyVoyageEncounterStationApproachSelectionChange(
    actionOnly,
    { stationId: "captain", approachId: "diplomacy" },
  );
  failure(missingApproach);
  assert.deepEqual(codes(missingApproach), [
    "station-approach-selection-does-not-exist",
  ]);
  assert.equal(missingApproach.errors[0].path, "selections.captain");

  const committed = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  const unchanged = applyVoyageEncounterStationApproachSelectionChange(
    committed,
    { stationId: "captain", approachId: "diplomacy" },
  );
  failure(unchanged);
  assert.deepEqual(codes(unchanged), [
    "station-approach-selection-unchanged",
  ]);
  assert.equal(unchanged.errors[0].path, "approachRequest.approachId");
  assert.equal(committed.revision, 11);
});

test("change rejects invalid station and approach request identities", () => {
  const source = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });

  for (const stationId of ["", "   "]) {
    const result = applyVoyageEncounterStationApproachSelectionChange(source, {
      stationId,
      approachId: "commanding-presence",
    });
    failure(result);
    assert.deepEqual(codes(result), ["invalid-approach-selection-station-id"]);
    assert.equal(result.errors[0].path, "approachRequest.stationId");
  }
  for (const stationId of ["__proto__", "constructor", "prototype"]) {
    const result = applyVoyageEncounterStationApproachSelectionChange(source, {
      stationId,
      approachId: "commanding-presence",
    });
    failure(result);
    assert.deepEqual(codes(result), ["unsafe-approach-selection-station-key"]);
  }
  for (const approachId of ["", "   "]) {
    const result = applyVoyageEncounterStationApproachSelectionChange(source, {
      stationId: "captain",
      approachId,
    });
    failure(result);
    assert.deepEqual(codes(result), ["invalid-approach-id"]);
    assert.equal(result.errors[0].path, "approachRequest.approachId");
  }
  for (const approachId of ["__proto__", "constructor", "prototype"]) {
    const result = applyVoyageEncounterStationApproachSelectionChange(source, {
      stationId: "captain",
      approachId,
    });
    failure(result);
    assert.deepEqual(codes(result), ["unsafe-approach-id"]);
  }

  const unavailable = applyVoyageEncounterStationApproachSelectionChange(
    source,
    { stationId: "watchmaster", approachId: "commanding-presence" },
  );
  failure(unavailable);
  assert.deepEqual(codes(unavailable), [
    "approach-selection-station-not-available",
  ]);

  const unoccupied = applyVoyageEncounterStationApproachSelectionChange(
    source,
    { stationId: "navigator", approachId: "survival" },
  );
  failure(unoccupied);
  assert.deepEqual(codes(unoccupied), [
    "approach-selection-station-not-occupied",
  ]);
});

test("change resolves only the current action and rejects malformed authored data", () => {
  const committed = () =>
    committedEncounter({
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy",
    });

  for (const approachId of ["warfare-lore", "missing"]) {
    const result = applyVoyageEncounterStationApproachSelectionChange(
      committed(),
      { stationId: "captain", approachId },
    );
    failure(result);
    assert.deepEqual(codes(result), ["approach-not-available"]);
    assert.equal(result.errors[0].path, "approachRequest.approachId");
  }

  const duplicate = committed();
  duplicate.availableStations[0].actions[0].approaches.push(
    statisticApproach("commanding-presence", "cha"),
  );
  const duplicateResult = applyVoyageEncounterStationApproachSelectionChange(
    duplicate,
    { stationId: "captain", approachId: "commanding-presence" },
  );
  failure(duplicateResult);
  assert.ok(codes(duplicateResult).includes("duplicate-authored-approach-id"));
  assert.equal(
    duplicateResult.errors.find(
      ({ code }) => code === "duplicate-authored-approach-id",
    ).path,
    "availableStations[0].actions[0].approaches[3].approachId",
  );

  const malformed = committed();
  malformed.availableStations[0].actions[0].approaches[1] = {
    approachId: "commanding-presence",
  };
  const malformedResult = applyVoyageEncounterStationApproachSelectionChange(
    malformed,
    { stationId: "captain", approachId: "commanding-presence" },
  );
  failure(malformedResult);
  assert.ok(
    codes(malformedResult).includes(
      "missing-authored-approach-execution-identity",
    ),
  );
  assert.equal(
    malformedResult.errors.find(
      ({ code }) => code === "missing-authored-approach-execution-identity",
    ).path,
    "availableStations[0].actions[0].approaches[1]",
  );

  const nonPlain = committed();
  nonPlain.availableStations[0].actions[0].approaches[1] = new Date(0);
  const nonPlainResult = applyVoyageEncounterStationApproachSelectionChange(
    nonPlain,
    { stationId: "captain", approachId: "commanding-presence" },
  );
  failure(nonPlainResult);
  assert.ok(codes(nonPlainResult).includes("invalid-authored-approach"));
  assert.equal(
    nonPlainResult.errors.find(
      ({ code }) => code === "invalid-authored-approach",
    ).path,
    "availableStations[0].actions[0].approaches[1]",
  );

  const missingAction = committed();
  missingAction.selections.captain.actionId = "missing";
  missingAction.riskBids = {};
  const missingActionResult =
    applyVoyageEncounterStationApproachSelectionChange(missingAction, {
      stationId: "captain",
      approachId: "commanding-presence",
    });
  failure(missingActionResult);
  assert.ok(codes(missingActionResult).includes("selected-action-not-available"));

  const ambiguousAction = committed();
  ambiguousAction.availableStations[0].actions.push(
    action("rally-crew", [statisticApproach("commanding-presence", "cha")]),
  );
  const ambiguousActionResult =
    applyVoyageEncounterStationApproachSelectionChange(ambiguousAction, {
      stationId: "captain",
      approachId: "commanding-presence",
    });
  failure(ambiguousActionResult);
  assert.ok(
    codes(ambiguousActionResult).includes("selected-action-is-ambiguous"),
  );
});

test("change ignores caller action and execution authority", () => {
  const source = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  const request = {
    stationId: "captain",
    approachId: "commanding-presence",
    actionId: "coordinate-orders",
    statisticSlugOrAbilityId: "forged",
    noRoll: true,
  };
  const result = applyVoyageEncounterStationApproachSelectionChange(
    source,
    request,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
    approachId: "commanding-presence",
    statisticSlugOrAbilityId: "cha",
  });
  assert.equal(Object.hasOwn(result.nextState.selections.captain, "noRoll"), false);
});

test("change failures are atomic for malformed state, candidate validation, and hostile reads", () => {
  const malformed = committedEncounter({
    approachId: "diplomacy",
    noRoll: true,
  });
  const malformedBefore = clonePlainData(malformed);
  const malformedResult = applyVoyageEncounterStationApproachSelectionChange(
    malformed,
    { stationId: "captain", approachId: "commanding-presence" },
  );
  failure(malformedResult);
  assert.ok(codes(malformedResult).includes("selection-approach-execution-mismatch"));
  assert.deepEqual(malformed, malformedBefore);

  const candidateFailure = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  const validMetadata = candidateFailure.metadata;
  let metadataReads = 0;
  Object.defineProperty(candidateFailure, "metadata", {
    get() {
      metadataReads += 1;
      return metadataReads < 3 ? validMetadata : null;
    },
    enumerable: true,
    configurable: true,
  });
  const candidateResult = applyVoyageEncounterStationApproachSelectionChange(
    candidateFailure,
    { stationId: "captain", approachId: "commanding-presence" },
  );
  failure(candidateResult);
  assert.ok(codes(candidateResult).includes("invalid-collection-type"));
  assert.equal(candidateFailure.revision, 11);
  assert.equal(candidateFailure.selections.captain.approachId, "diplomacy");

  const hostile = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  hostile.availableStations[0].actions[0].approaches = new Proxy(
    hostile.availableStations[0].actions[0].approaches,
    {
      getOwnPropertyDescriptor() {
        throw new Error("hostile");
      },
    },
  );
  const hostileResult = applyVoyageEncounterStationApproachSelectionChange(
    hostile,
    { stationId: "captain", approachId: "commanding-presence" },
  );
  failure(hostileResult);
  assert.ok(
    codes(hostileResult).some((code) =>
      [
        "station-selection-data-read-failed",
        "approach-selection-data-read-failed",
      ].includes(code),
    ),
  );
});

test("change output and event are isolated from source, request, and each other", () => {
  const source = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  const request = {
    stationId: "captain",
    approachId: "commanding-presence",
  };
  const result = applyVoyageEncounterStationApproachSelectionChange(
    source,
    request,
  );

  assert.equal(result.ok, true);
  assert.notEqual(result.nextState, source);
  assert.notEqual(result.nextState.selections, source.selections);
  assert.notEqual(result.nextState.riskBids, source.riskBids);
  result.events[0].approachId = "changed-event";
  assert.equal(
    result.nextState.selections.captain.approachId,
    "commanding-presence",
  );
  result.nextState.selections.captain.approachId = "changed-state";
  result.nextState.riskBids.captain.riskBidId = "changed-bid";

  assert.equal(source.selections.captain.approachId, "diplomacy");
  assert.equal(source.riskBids.captain.riskBidId, "press");
  assert.equal(request.approachId, "commanding-presence");
  assert.equal(result.events[0].previousApproachId, "diplomacy");
});

test("clears a statistic approach to the exact action-only shape and event", () => {
  const source = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  const request = { stationId: "captain" };
  const before = clonePlainData(source);
  const requestBefore = clonePlainData(request);

  const result = applyVoyageEncounterStationApproachSelectionClear(
    source,
    request,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
  });
  assert.deepEqual(result.events, [
    {
      type: "voyage.station-approach-selection-cleared",
      encounterId: "approach-selection",
      lifecycleState: STATES.ACTIVE,
      roundNumber: 2,
      phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
      stationId: "captain",
      actionId: "rally-crew",
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy",
      previousRevision: 11,
      revision: 12,
    },
  ]);
  assert.equal(result.nextState.revision, 12);
  assert.deepEqual(result.nextState.selections.engineer, source.selections.engineer);
  assert.deepEqual(result.nextState.riskBids, source.riskBids);
  assert.deepEqual(source, before);
  assert.deepEqual(request, requestBefore);
});

test("clears a no-roll approach with its exact prior execution identity", () => {
  const source = committedEncounter({
    approachId: "steady-the-deck",
    noRoll: true,
  });
  const result = applyVoyageEncounterStationApproachSelectionClear(source, {
    stationId: "captain",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: "rally-crew",
  });
  assert.equal(
    Object.hasOwn(result.nextState.selections.captain, "approachId"),
    false,
  );
  assert.equal(
    Object.hasOwn(
      result.nextState.selections.captain,
      "statisticSlugOrAbilityId",
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(result.nextState.selections.captain, "noRoll"),
    false,
  );
  assert.deepEqual(result.events, [
    {
      type: "voyage.station-approach-selection-cleared",
      encounterId: "approach-selection",
      lifecycleState: STATES.ACTIVE,
      roundNumber: 2,
      phase: VOYAGE_ROUND_PHASES.CREW_PLANNING,
      stationId: "captain",
      actionId: "rally-crew",
      approachId: "steady-the-deck",
      noRoll: true,
      previousRevision: 11,
      revision: 12,
    },
  ]);
});

test("clear retains the exact current action and ignores all caller approach authority", () => {
  const source = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  const exactActionId = " rally-crew ";
  source.selections.captain.actionId = exactActionId;
  source.availableStations[0].actions[0].actionId = exactActionId;
  source.riskBids.captain.actionId = exactActionId;
  let ignoredReads = 0;
  const request = {
    stationId: "captain",
    actionId: "coordinate-orders",
    statisticSlugOrAbilityId: "forged",
    noRoll: true,
  };
  Object.defineProperty(request, "approachId", {
    get() {
      ignoredReads += 1;
      throw new Error("clear must not read caller approach authority");
    },
    enumerable: true,
  });

  const result = applyVoyageEncounterStationApproachSelectionClear(
    source,
    request,
  );

  assert.equal(result.ok, true);
  assert.equal(ignoredReads, 0);
  assert.deepEqual(result.nextState.selections.captain, {
    stationId: "captain",
    actionId: exactActionId,
  });
  assert.equal(result.events[0].actionId, exactActionId);
  assert.equal(result.events[0].approachId, "diplomacy");
  assert.equal(
    result.events[0].statisticSlugOrAbilityId,
    "diplomacy",
  );
  assert.equal(Object.hasOwn(result.events[0], "noRoll"), false);
});

test("clear requires a selected action and a valid committed approach", () => {
  const noAction = encounter();
  delete noAction.selections.captain;
  delete noAction.riskBids.captain;
  const missingAction = applyVoyageEncounterStationApproachSelectionClear(
    noAction,
    { stationId: "captain" },
  );
  failure(missingAction);
  assert.deepEqual(codes(missingAction), ["station-action-selection-missing"]);

  const actionOnly = encounter();
  const missingApproach = applyVoyageEncounterStationApproachSelectionClear(
    actionOnly,
    { stationId: "captain" },
  );
  failure(missingApproach);
  assert.deepEqual(codes(missingApproach), [
    "station-approach-selection-does-not-exist",
  ]);
  assert.equal(missingApproach.errors[0].path, "selections.captain");

  const malformed = encounter();
  malformed.selections.captain.approachId = "diplomacy";
  const malformedBefore = clonePlainData(malformed);
  const malformedResult = applyVoyageEncounterStationApproachSelectionClear(
    malformed,
    { stationId: "captain" },
  );
  failure(malformedResult);
  assert.ok(
    codes(malformedResult).includes(
      "missing-selection-approach-execution-identity",
    ),
  );
  assert.deepEqual(malformed, malformedBefore);
});

test("clear rejects malformed requests and invalid station identities precisely", () => {
  const source = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });

  for (const request of [null, [], "captain"]) {
    const result = applyVoyageEncounterStationApproachSelectionClear(
      source,
      request,
    );
    failure(result);
    assert.deepEqual(codes(result), ["invalid-approach-selection-request"]);
    assert.equal(result.errors[0].path, "clearRequest");
  }
  for (const stationId of ["", "   "]) {
    const result = applyVoyageEncounterStationApproachSelectionClear(source, {
      stationId,
    });
    failure(result);
    assert.deepEqual(codes(result), ["invalid-approach-selection-station-id"]);
    assert.equal(result.errors[0].path, "clearRequest.stationId");
  }
  for (const stationId of ["__proto__", "constructor", "prototype"]) {
    const result = applyVoyageEncounterStationApproachSelectionClear(source, {
      stationId,
    });
    failure(result);
    assert.deepEqual(codes(result), ["unsafe-approach-selection-station-key"]);
    assert.equal(result.errors[0].path, "clearRequest.stationId");
  }

  const unavailable = applyVoyageEncounterStationApproachSelectionClear(
    source,
    { stationId: "watchmaster" },
  );
  failure(unavailable);
  assert.deepEqual(codes(unavailable), [
    "approach-selection-station-not-available",
  ]);
  assert.equal(unavailable.errors[0].path, "clearRequest.stationId");

  const unoccupied = applyVoyageEncounterStationApproachSelectionClear(
    source,
    { stationId: "navigator" },
  );
  failure(unoccupied);
  assert.deepEqual(codes(unoccupied), [
    "approach-selection-station-not-occupied",
  ]);
  assert.equal(unoccupied.errors[0].path, "clearRequest.stationId");

  const ambiguous = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  ambiguous.availableStations.push(
    clonePlainData(ambiguous.availableStations[0]),
  );
  const ambiguousResult = applyVoyageEncounterStationApproachSelectionClear(
    ambiguous,
    { stationId: "captain" },
  );
  failure(ambiguousResult);
  assert.ok(codes(ambiguousResult).includes("selected-station-is-ambiguous"));

  let reads = 0;
  const accessor = {};
  Object.defineProperty(accessor, "stationId", {
    get() {
      reads += 1;
      throw new Error("must not execute");
    },
    enumerable: true,
  });
  const accessorResult = applyVoyageEncounterStationApproachSelectionClear(
    source,
    accessor,
  );
  failure(accessorResult);
  assert.equal(reads, 0);
  assert.deepEqual(codes(accessorResult), [
    "approach-selection-data-read-failed",
  ]);
  assert.equal(accessorResult.errors[0].path, "clearRequest.stationId");
});

test("clear rejects malformed authored data and selected-action resolution", () => {
  const committed = () =>
    committedEncounter({
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy",
    });

  const malformedApproach = committed();
  malformedApproach.availableStations[0].actions[0].approaches[1] =
    new Date(0);
  const malformedApproachResult =
    applyVoyageEncounterStationApproachSelectionClear(malformedApproach, {
      stationId: "captain",
    });
  failure(malformedApproachResult);
  assert.ok(
    codes(malformedApproachResult).includes("invalid-authored-approach"),
  );

  const malformedExecution = committed();
  malformedExecution.availableStations[0].actions[0].approaches[0] = {
    approachId: "diplomacy",
  };
  const malformedExecutionResult =
    applyVoyageEncounterStationApproachSelectionClear(malformedExecution, {
      stationId: "captain",
    });
  failure(malformedExecutionResult);
  assert.ok(
    codes(malformedExecutionResult).includes(
      "missing-authored-approach-execution-identity",
    ),
  );

  const missingAction = committed();
  missingAction.selections.captain.actionId = "missing";
  missingAction.riskBids = {};
  const missingActionResult =
    applyVoyageEncounterStationApproachSelectionClear(missingAction, {
      stationId: "captain",
    });
  failure(missingActionResult);
  assert.ok(codes(missingActionResult).includes("selected-action-not-available"));

  const ambiguousAction = committed();
  ambiguousAction.availableStations[0].actions.push(
    action("rally-crew", [statisticApproach("diplomacy")]),
  );
  const ambiguousActionResult =
    applyVoyageEncounterStationApproachSelectionClear(ambiguousAction, {
      stationId: "captain",
    });
  failure(ambiguousActionResult);
  assert.ok(
    codes(ambiguousActionResult).includes("selected-action-is-ambiguous"),
  );
});

test("clear candidate and hostile-read failures are atomic", () => {
  const candidateFailure = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  const validMetadata = candidateFailure.metadata;
  let metadataReads = 0;
  Object.defineProperty(candidateFailure, "metadata", {
    get() {
      metadataReads += 1;
      return metadataReads < 3 ? validMetadata : null;
    },
    enumerable: true,
    configurable: true,
  });
  const candidateResult = applyVoyageEncounterStationApproachSelectionClear(
    candidateFailure,
    { stationId: "captain" },
  );
  failure(candidateResult);
  assert.ok(codes(candidateResult).includes("invalid-collection-type"));
  assert.equal(candidateFailure.revision, 11);
  assert.equal(candidateFailure.selections.captain.approachId, "diplomacy");

  const hostile = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  hostile.availableStations[0].actions[0].approaches = new Proxy(
    hostile.availableStations[0].actions[0].approaches,
    {
      getOwnPropertyDescriptor() {
        throw new Error("hostile");
      },
    },
  );
  const hostileResult = applyVoyageEncounterStationApproachSelectionClear(
    hostile,
    { stationId: "captain" },
  );
  failure(hostileResult);
  assert.ok(
    codes(hostileResult).some((code) =>
      [
        "station-selection-data-read-failed",
        "approach-selection-data-read-failed",
      ].includes(code),
    ),
  );
});

test("clear output and event are isolated from source, request, and each other", () => {
  const source = committedEncounter({
    approachId: "diplomacy",
    statisticSlugOrAbilityId: "diplomacy",
  });
  const request = { stationId: "captain" };
  const result = applyVoyageEncounterStationApproachSelectionClear(
    source,
    request,
  );

  assert.equal(result.ok, true);
  assert.notEqual(result.nextState, source);
  assert.notEqual(result.nextState.selections, source.selections);
  assert.notEqual(result.nextState.riskBids, source.riskBids);
  result.events[0].actionId = "changed-event";
  assert.equal(result.nextState.selections.captain.actionId, "rally-crew");
  result.nextState.selections.captain.actionId = "changed-state";
  result.nextState.riskBids.captain.riskBidId = "changed-bid";

  assert.equal(source.selections.captain.actionId, "rally-crew");
  assert.equal(source.selections.captain.approachId, "diplomacy");
  assert.equal(source.riskBids.captain.riskBidId, "press");
  assert.equal(request.stationId, "captain");
  assert.equal(result.events[0].approachId, "diplomacy");
});

test("imports and operates without Foundry globals", () => {
  assert.equal(
    typeof applyVoyageEncounterStationApproachSelection,
    "function",
  );
  assert.equal(
    typeof applyVoyageEncounterStationApproachSelectionChange,
    "function",
  );
  assert.equal(
    typeof applyVoyageEncounterStationApproachSelectionClear,
    "function",
  );
  assert.equal(globalThis.game, undefined);
  assert.equal(
    applyVoyageEncounterStationApproachSelection(encounter(), {
      stationId: "captain",
      approachId: "diplomacy",
    }).ok,
    true,
  );
});
