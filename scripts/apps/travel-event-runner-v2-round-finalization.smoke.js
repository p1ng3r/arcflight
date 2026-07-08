import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { setTravelEventRunnerStationResult } from "../helpers/travel-event-runner.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./travel-event-runner-v2-preview-consumer.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel event runner v2 round finalization smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel event runner v2 round finalization smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function snapshot(value) {
  return JSON.stringify(value);
}

function recordsFrom(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
}

function lockedStationActionsFixture({ unlockedStation = "", missingStation = "", invalidStation = "", supportTarget = "navigator" } = {}) {
  const stations = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
  const stationActions = {};
  const stationOrderCommitments = {};
  for (const stationKey of stations) {
    if (stationKey === missingStation) continue;
    stationActions[stationKey] = stationKey === "engineer"
      ? { actionKey: "support", type: "support", label: "Support", targetStationKey: supportTarget, gmText: "GM-only action text", auditRecord: { secret: true } }
      : { actionKey: "eventApproach", label: "Event Approach", gmOnly: "hidden" };
    stationOrderCommitments[stationKey] = { committed: stationKey !== unlockedStation };
  }
  if (invalidStation) {
    stationActions[invalidStation] = { actionKey: "eventApproach", label: "Hidden Action" };
    stationOrderCommitments[invalidStation] = { committed: true };
  }
  return { stationActions, stationOrderCommitments };
}

function createRunnerSessionFixture(overrides = {}) {
  const lockIn = lockedStationActionsFixture(overrides.lockInOptions);
  const cleanOverrides = { ...overrides };
  delete cleanOverrides.lockInOptions;
  return {
    key: "runner-finalization-fixture",
    status: "active",
    currentRoundIndex: 0,
    pressure: {
      [ARCFLIGHT_TRAVEL_RESOURCES.HULL]: { value: 0, crossed: [] },
      [ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES]: { value: 0, crossed: [] }
    },
    event: {
      rounds: [
        {
          number: 1,
          title: "Runner Round Finalization Test",
          primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
          secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
          pressureStation: "engineer",
          activeStations: ["captain", "navigator", "engineer", "veilwarden", "watchmaster"],
          stationPrompts: {
            captain: { stationName: "Captain" },
            navigator: { stationName: "Navigator" },
            engineer: { stationName: "Engineer" },
            veilwarden: { stationName: "Veilwarden" },
            watchmaster: { stationName: "Watchmaster" }
          },
          stationSummary: { engineer: { degree: "failure" } }
        }
      ]
    },
    roundResults: [
      {
        stationResults: { captain: "criticalFailure", navigator: "success", engineer: "failure", veilwarden: "failure", watchmaster: "criticalSuccess" },
        ...lockIn
      }
    ],
    ...cleanOverrides
  };
}

async function importRunnerModule() {
  const previousFoundry = globalThis.foundry;
  let renderCalls = 0;
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {
          async _prepareContext() { return {}; }
          render() { renderCalls += 1; return { rendered: true, renderCalls }; }
          _onRender() {}
        },
        HandlebarsApplicationMixin: (Base) => Base
      }
    }
  };
  try {
    const module = await import(`./travel-event-runner.js?roundFinalizationSmoke=${Date.now()}`);
    return { module, getRenderCalls: () => renderCalls };
  } finally {
    if (previousFoundry === undefined) delete globalThis.foundry;
    else globalThis.foundry = previousFoundry;
  }
}

export async function runTravelEventRunnerV2RoundFinalizationSmokeChecks() {
  const { module, getRenderCalls } = await importRunnerModule();
  const {
    ArcflightTravelEventRunner,
    prepareTravelV2PressureApplicationRunnerUpdate,
    prepareTravelV2PressureCorrectionRunnerUpdate,
    prepareTravelV2RoundFinalizationRunnerUpdate
  } = module;

  assertSmoke(typeof prepareTravelV2RoundFinalizationRunnerUpdate === "function", "runner finalization update helper should be exported");

  let chatCalls = 0;
  let socketCalls = 0;
  let actorUpdateCalls = 0;
  let itemUpdateCalls = 0;
  const previousGame = globalThis.game;
  globalThis.game = {
    socket: { emit: () => { socketCalls += 1; } },
    actors: { values: () => [], get: () => ({ update: () => { actorUpdateCalls += 1; } }) },
    items: { values: () => [], get: () => ({ update: () => { itemUpdateCalls += 1; } }) },
    users: { filter: () => [] }
  };
  const previousChatMessage = globalThis.ChatMessage;
  globalThis.ChatMessage = { create: () => { chatCalls += 1; } };

  try {
    const missing = prepareTravelV2RoundFinalizationRunnerUpdate(null, { now: "2026-01-01T00:00:00.000Z" });
    assertSmoke(!missing.result.ok && !missing.result.finalized, "missing session should block without throwing");
    assertSmoke(!missing.shouldUpdateSession, "missing session should not request session replacement");

    const noPressure = createRunnerSessionFixture();
    const noPressureBefore = snapshot(noPressure);
    const blocked = prepareTravelV2RoundFinalizationRunnerUpdate(noPressure, { now: "2026-01-01T00:00:01.000Z" });
    assertSmoke(!blocked.result.ok && !blocked.result.finalized, "round without pressure application should block");
    assertSmoke(!blocked.shouldUpdateSession, "blocked round should not request session replacement");
    assertEqual(snapshot(noPressure), noPressureBefore, "blocked round should not mutate input session");

    const missingActionSession = createRunnerSessionFixture({ lockInOptions: { missingStation: "captain" } });
    const missingActionApplied = prepareTravelV2PressureApplicationRunnerUpdate(missingActionSession, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:01.100Z" });
    const missingActionBefore = snapshot(missingActionApplied.nextSession);
    const missingActionBlocked = prepareTravelV2RoundFinalizationRunnerUpdate(missingActionApplied.nextSession, { now: "2026-01-01T00:00:01.200Z" });
    assertSmoke(!missingActionBlocked.result.ok && !missingActionBlocked.result.finalized, "missing station action should block finalization");
    assertSmoke(!missingActionBlocked.result.stationActionSummary, "missing station action should block before station action summary generation");
    assertSmoke(!missingActionBlocked.result.stationActionSupportEffects && !missingActionBlocked.result.stationActionEventApproachEffects && !missingActionBlocked.result.stationActionEffects, "missing station action should block before station action effects are generated");
    assertSmoke(!missingActionBlocked.result.pendingStationActionBonuses, "missing station action should block before pending bonuses are generated");
    assertSmoke(!missingActionBlocked.result.stationActionEventApproachContributions && !missingActionBlocked.result.eventApproachContributions, "missing station action should block before Event Approach contributions are generated");
    assertSmoke(!missingActionBlocked.result.stationActionEventApproachContributionTally && !missingActionBlocked.result.eventApproachContributionTally, "missing station action should block before Event Approach tally is generated");
    assertSmoke(!missingActionBlocked.result.stationActionEventApproachTallyStatus && !missingActionBlocked.result.eventApproachTallyStatus, "missing station action should block before Event Approach tally status is generated");
    assertSmoke(missingActionBlocked.result.playerMessage.includes("selected and locked"), "blocked result should include safe player-facing lock-in message");
    assertSmoke(missingActionBlocked.result.gmMessage.includes("captain"), "blocked result should include readable GM-facing station reason");
    assertEqual(snapshot(missingActionApplied.nextSession), missingActionBefore, "missing action guard should not mutate input session");

    const unlockedSession = createRunnerSessionFixture({ lockInOptions: { unlockedStation: "navigator" } });
    const unlockedApplied = prepareTravelV2PressureApplicationRunnerUpdate(unlockedSession, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:01.300Z" });
    const unlockedBlocked = prepareTravelV2RoundFinalizationRunnerUpdate(unlockedApplied.nextSession, { now: "2026-01-01T00:00:01.400Z" });
    assertSmoke(!unlockedBlocked.result.ok && !unlockedBlocked.result.finalized, "unlocked station action should block finalization");
    assertSmoke(unlockedBlocked.result.gmMessage.includes("navigator"), "unlocked station block should identify station for GM");

    const invalidStationSession = createRunnerSessionFixture({ lockInOptions: { invalidStation: "secret" } });
    const invalidStationApplied = prepareTravelV2PressureApplicationRunnerUpdate(invalidStationSession, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:01.500Z" });
    const invalidStationBlocked = prepareTravelV2RoundFinalizationRunnerUpdate(invalidStationApplied.nextSession, { now: "2026-01-01T00:00:01.600Z" });
    assertSmoke(!invalidStationBlocked.result.ok && !invalidStationBlocked.result.finalized, "invalid station key should block finalization safely");
    const playerBlockJson = JSON.stringify({ message: invalidStationBlocked.result.playerMessage, reasons: invalidStationBlocked.result.playerBlockedReasons });
    assertSmoke(!playerBlockJson.includes("gmOnly") && !playerBlockJson.includes("auditRecord") && !playerBlockJson.includes("secret"), "player-facing lock-in block should not leak GM-only validation details or invalid raw station keys");

    const source = createRunnerSessionFixture();
    const sourceBefore = snapshot(source);
    const applied = prepareTravelV2PressureApplicationRunnerUpdate(source, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:02.000Z" });
    assertSmoke(applied.shouldUpdateSession, "fixture should support pressure application before finalization");
    const successful = prepareTravelV2RoundFinalizationRunnerUpdate(applied.nextSession, { now: "2026-01-01T00:00:03.000Z" });
    assertSmoke(successful.result.ok && successful.result.finalized, "effective pressure application should finalize");
    assertSmoke(successful.shouldUpdateSession, "successful finalization should request session replacement");
    assertSmoke(successful.shouldRerender, "successful finalization should request rerender");
    assertSmoke(successful.nextSession !== applied.nextSession, "successful finalization should return a cloned updated session");
    assertEqual(snapshot(source), sourceBefore, "finalization path should not mutate original input session");
    assertEqual(recordsFrom(successful.nextSession.travelV2RoundResolutions).length, 1, "successful finalization should append exactly one resolution record");
    const resolutionRecord = recordsFrom(successful.nextSession.travelV2RoundResolutions)[0];
    const stationActionSummary = successful.result.stationActionSummary;
    assertSmoke(stationActionSummary && resolutionRecord.stationActionSummary, "successful finalization should record station action summary on result and resolution record");
    assertEqual(stationActionSummary.stations.length, 5, "station action summary should include all Travel Five stations");
    assertSmoke(stationActionSummary.stations.every((row) => row.roundIndex === 0 && row.roundNumber === 1 && row.committed === true && row.locked === true), "station action summary rows should include round metadata and locked/committed state");
    const supportSummary = stationActionSummary.stations.find((row) => row.stationKey === "engineer");
    assertSmoke(supportSummary?.selectedActionKey === "support" && supportSummary?.selectedActionType === "support", "support station action summary should include safe action key and type");
    assertSmoke(supportSummary?.targetStationKey === "navigator" && supportSummary?.targetStationLabel === "Navigator", "support station action summary should include safe target station display");
    const summaryJson = JSON.stringify(stationActionSummary);
    for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
      assertSmoke(!summaryJson.includes(forbidden), `station action summary should not include forbidden player-safe term ${forbidden}`);
    }
    const supportEffects = successful.result.stationActionSupportEffects;
    assertSmoke(supportEffects?.hasEffects === true && supportEffects.effects.length === 1, "ready locked Support action should record one Support effect");
    const supportEffect = supportEffects.effects[0];
    assertSmoke(supportEffect.sourceStationKey === "engineer" && supportEffect.sourceStationLabel === "Engineer", "Support effect should include safe source station key and label");
    assertSmoke(supportEffect.targetStationKey === "navigator" && supportEffect.targetStationLabel === "Navigator", "Support effect should include safe target station key and label");
    assertSmoke(supportEffect.effectKey === "support" && supportEffect.effectType === "support" && supportEffect.playerSafe === true && supportEffect.readOnly === true, "Support effect should use safe read-only Support metadata");
    assertSmoke(successful.result.stationActionEffects.length === 5, "Support and Event Approach effects should be present on finalization result flat effects");
    assertSmoke(resolutionRecord.stationActionSupportEffects.effects.length === 1 && resolutionRecord.stationActionEffects.length === 5, "Support and Event Approach effects should be present on round resolution record");
    const eventApproachEffects = successful.result.stationActionEventApproachEffects;
    assertSmoke(eventApproachEffects?.hasEffects === true && eventApproachEffects.effects.length === 4, "ready locked Event Approach actions should record Event Approach effects");
    const navigatorEventApproach = eventApproachEffects.effects.find((effect) => effect.sourceStationKey === "navigator");
    assertSmoke(navigatorEventApproach?.sourceStationLabel === "Navigator", "Event Approach effect should include safe source station label");
    assertSmoke(navigatorEventApproach?.effectKey === "eventApproach" && navigatorEventApproach.effectType === "eventApproach" && navigatorEventApproach.effectLabel.includes("Event Approach"), "Event Approach effect should include safe readable action/effect label");
    assertSmoke(navigatorEventApproach?.stationOutcome === "success", "Event Approach effect should include safe station result when available");
    assertSmoke(navigatorEventApproach?.playerSafe === true && navigatorEventApproach.readOnly === true, "Event Approach effect should be player-safe and read-only");
    assertSmoke(resolutionRecord.stationActionEventApproachEffects.effects.some((effect) => effect.sourceStationKey === "navigator"), "Event Approach effect should be present on round resolution record");
    const eventApproachContributions = successful.result.stationActionEventApproachContributions;
    assertSmoke(eventApproachContributions?.hasRecords === true && eventApproachContributions.records.length === 4, "ready locked Event Approach actions should record Event Approach contributions");
    const navigatorContribution = eventApproachContributions.records.find((record) => record.sourceStationKey === "navigator");
    assertSmoke(navigatorContribution?.sourceStationLabel === "Navigator", "Event Approach contribution should include safe source station label");
    assertSmoke(navigatorContribution?.contributionKey === "eventApproach" && navigatorContribution.contributionType === "eventApproach", "Event Approach contribution should include safe contribution key and type");
    assertSmoke(navigatorContribution?.contributionLabel.includes("Event Approach") && navigatorContribution.contributionLabel.includes("+1"), "Event Approach contribution should include safe readable contribution label");
    assertSmoke(navigatorContribution?.stationOutcome === "success" && navigatorContribution.contributionValue === 1, "Event Approach success should create a +1 contribution");
    assertSmoke(navigatorContribution?.playerSafe === true && navigatorContribution.readOnly === true, "Event Approach contribution should be player-safe and read-only");
    assertSmoke(resolutionRecord.stationActionEventApproachContributions.records.some((record) => record.sourceStationKey === "navigator"), "Event Approach contribution should be present on round resolution record");
    assertSmoke(successful.result.eventApproachContributions.records.length === eventApproachContributions.records.length, "Event Approach contribution alias should be present on finalization result");
    const eventApproachContributionTally = successful.result.stationActionEventApproachContributionTally;
    assertSmoke(eventApproachContributionTally?.tallyKey === "eventApproach" && eventApproachContributionTally.tallyType === "eventApproach", "ready locked Event Approach contributions should record a safe Event Approach tally");
    assertSmoke(eventApproachContributionTally?.totalContributionValue === 2 && eventApproachContributionTally.contributionCount === 4, "Event Approach tally total should equal the sum of contribution values");
    assertSmoke(eventApproachContributionTally?.positiveContributionCount === 2 && eventApproachContributionTally.zeroContributionCount === 1 && eventApproachContributionTally.negativeContributionCount === 1, "Event Approach tally should include positive, zero, and negative contribution counts");
    assertSmoke(eventApproachContributionTally?.contributingStationLabels.includes("Navigator") && eventApproachContributionTally.contributingStationLabels.includes("Watchmaster"), "Event Approach tally should include safe contributing station labels");
    assertSmoke(eventApproachContributionTally?.tallyLabel.includes("Event Approach") && eventApproachContributionTally.tallyLabel.includes("+2"), "Event Approach tally should include a safe readable tally label");
    assertSmoke(eventApproachContributionTally?.playerSafe === true && eventApproachContributionTally.readOnly === true, "Event Approach tally should be player-safe and read-only");
    assertSmoke(resolutionRecord.stationActionEventApproachContributionTally?.totalContributionValue === eventApproachContributionTally.totalContributionValue, "Event Approach tally should be present on round resolution record");
    assertSmoke(successful.result.eventApproachContributionTally.totalContributionValue === eventApproachContributionTally.totalContributionValue, "Event Approach tally alias should be present on finalization result");
    const eventApproachTallyStatus = successful.result.stationActionEventApproachTallyStatus;
    assertSmoke(eventApproachTallyStatus?.statusKey === "partialProgress" && eventApproachTallyStatus.statusLabel === "Partial Progress", "Event Approach tally status should interpret +2 as Partial Progress");
    assertSmoke(eventApproachTallyStatus?.statusTone && eventApproachTallyStatus.totalContributionValue === 2 && eventApproachTallyStatus.valueLabel === "+2", "Event Approach tally status should include tone and total contribution value");
    assertSmoke(eventApproachTallyStatus?.previewLabel.includes("preview") && eventApproachTallyStatus.previewMessage.includes("read-only") && eventApproachTallyStatus.previewMessage.includes("not applied yet"), "Event Approach tally status should include safe readable not-applied preview text");
    assertSmoke(eventApproachTallyStatus?.roundIndex === 0 && eventApproachTallyStatus.roundNumber === 1 && eventApproachTallyStatus.playerSafe === true && eventApproachTallyStatus.readOnly === true, "Event Approach tally status should include round metadata and safe read-only markers");
    assertSmoke(resolutionRecord.stationActionEventApproachTallyStatus?.statusKey === eventApproachTallyStatus.statusKey, "Event Approach tally status should be present on round resolution record");
    assertSmoke(successful.result.eventApproachTallyStatus.statusKey === eventApproachTallyStatus.statusKey, "Event Approach tally status alias should be present on finalization result");
    const eventApproachContributionJson = JSON.stringify(eventApproachContributions);
    for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
      assertSmoke(!eventApproachContributionJson.includes(forbidden), `Event Approach contributions should not include forbidden player-safe term ${forbidden}`);
    }
    const eventApproachContributionTallyJson = JSON.stringify({ tally: eventApproachContributionTally, status: eventApproachTallyStatus });
    for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
      assertSmoke(!eventApproachContributionTallyJson.includes(forbidden), `Event Approach tally should not include forbidden player-safe term ${forbidden}`);
    }
    for (const [outcome, expected] of [["criticalSuccess", 2], ["failure", 0], ["criticalFailure", -1], ["mystery", 0]]) {
      const variant = createRunnerSessionFixture();
      variant.roundResults[0].stationResults.navigator = outcome;
      const variantApplied = prepareTravelV2PressureApplicationRunnerUpdate(variant, { selectedOutcomeKey: "failure", now: `2026-01-01T00:00:04.${Math.abs(expected)}00Z` });
      const variantFinalized = prepareTravelV2RoundFinalizationRunnerUpdate(variantApplied.nextSession, { now: `2026-01-01T00:00:05.${Math.abs(expected)}00Z` });
      const variantContribution = variantFinalized.result.stationActionEventApproachContributions.records.find((record) => record.sourceStationKey === "navigator");
      assertSmoke(variantContribution?.contributionValue === expected, `Event Approach ${outcome} should create contribution ${expected}`);
      if (outcome === "mystery") assertSmoke(variantContribution.stationOutcome === "unknown" && variantContribution.contributionLabel.includes("Unknown Result"), "unknown Event Approach outcome should create safe 0 contribution label");
    }

    for (const [label, stationResults, expectedKey, expectedLabel] of [
      ["strong", { captain: "success", navigator: "success", engineer: "failure", veilwarden: "success", watchmaster: "success" }, "strongProgress", "Strong Progress"],
      ["partial", { captain: "failure", navigator: "success", engineer: "failure", veilwarden: "failure", watchmaster: "failure" }, "partialProgress", "Partial Progress"],
      ["none", { captain: "failure", navigator: "failure", engineer: "failure", veilwarden: "failure", watchmaster: "failure" }, "noNetProgress", "No Net Progress"],
      ["setback", { captain: "criticalFailure", navigator: "criticalFailure", engineer: "failure", veilwarden: "criticalFailure", watchmaster: "criticalFailure" }, "setback", "Setback"]
    ]) {
      const bandSession = createRunnerSessionFixture();
      bandSession.roundResults[0].stationResults = stationResults;
      const beforeBand = snapshot(bandSession);
      const bandApplied = prepareTravelV2PressureApplicationRunnerUpdate(bandSession, { selectedOutcomeKey: "failure", now: `2026-01-01T00:00:08.${label.length}00Z` });
      const bandFinalized = prepareTravelV2RoundFinalizationRunnerUpdate(bandApplied.nextSession, { now: `2026-01-01T00:00:09.${label.length}00Z` });
      const bandStatus = bandFinalized.result.stationActionEventApproachTallyStatus;
      assertSmoke(bandStatus?.statusKey === expectedKey && bandStatus.statusLabel === expectedLabel, `Event Approach tally status should create ${expectedLabel}`);
      assertSmoke(bandStatus.previewLabel.includes(expectedLabel) && bandStatus.previewMessage.includes("not applied yet"), `${expectedLabel} status should include readable not-applied preview text`);
      assertSmoke(recordsFrom(bandFinalized.nextSession.travelV2RoundResolutions)[0].stationActionEventApproachTallyStatus.statusKey === expectedKey, `${expectedLabel} status should be stored on round resolution record`);
      assertEqual(snapshot(bandSession), beforeBand, `${expectedLabel} status generation should not mutate source session`);
    }

    const missingOutcome = createRunnerSessionFixture();
    delete missingOutcome.roundResults[0].stationResults.navigator;
    const missingOutcomeApplied = prepareTravelV2PressureApplicationRunnerUpdate(missingOutcome, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:06.000Z" });
    const missingOutcomeFinalized = prepareTravelV2RoundFinalizationRunnerUpdate(missingOutcomeApplied.nextSession, { now: "2026-01-01T00:00:07.000Z" });
    const missingOutcomeContribution = missingOutcomeFinalized.result.stationActionEventApproachContributions.records.find((record) => record.sourceStationKey === "navigator");
    assertSmoke(missingOutcomeContribution?.contributionValue === 0 && missingOutcomeContribution.stationOutcome === "unknown", "missing Event Approach outcome should create safe 0 contribution");
    const eventApproachJson = JSON.stringify(eventApproachEffects);
    for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
      assertSmoke(!eventApproachJson.includes(forbidden), `Event Approach effects should not include forbidden player-safe term ${forbidden}`);
    }
    const pendingBonuses = successful.result.pendingStationActionBonuses;
    assertSmoke(pendingBonuses?.hasRecords === true && pendingBonuses.records.length === 1, "valid Support effect should create one pending Support bonus");
    const pendingBonus = pendingBonuses.records[0];
    assertSmoke(pendingBonus.sourceStationKey === "engineer" && pendingBonus.sourceStationLabel === "Engineer", "pending Support bonus should include safe source station label");
    assertSmoke(pendingBonus.targetStationKey === "navigator" && pendingBonus.targetStationLabel === "Navigator", "pending Support bonus should include safe target station label");
    assertSmoke(pendingBonus.bonusKey === "support" && pendingBonus.bonusType === "circumstance" && pendingBonus.bonusValue === 1, "pending Support bonus should carry the narrow +1 circumstance support modifier metadata");
    assertSmoke(pendingBonus.consumed === false && pendingBonus.playerSafe === true && pendingBonus.readOnly === true, "pending Support bonus should be unconsumed player-safe read-only state");
    assertSmoke(pendingBonus.appliesToRoundIndex === 1 && pendingBonus.nextRoundIndex === 1, "pending Support bonus should point at the next round index");
    assertSmoke(resolutionRecord.pendingStationActionBonuses.records.length === 1, "pending Support bonus should be present on round resolution record");
    assertSmoke(recordsFrom(successful.nextSession.travelV2PendingStationActionBonuses).length === 1, "pending Support bonus should be stored on cloned finalized session");

    const stationCheckSource = JSON.parse(JSON.stringify(successful.nextSession));
    stationCheckSource.currentRoundIndex = 1;
    stationCheckSource.event.rounds.push({
      number: 2,
      title: "Support Consumption Round",
      activeStations: ["captain", "navigator", "engineer", "veilwarden", "watchmaster"],
      stationPrompts: { captain: { stationName: "Captain" }, navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, veilwarden: { stationName: "Veilwarden" }, watchmaster: { stationName: "Watchmaster" } },
      stationSummary: {}
    });
    stationCheckSource.roundResults.push({
      roundIndex: 1,
      roundNumber: 2,
      stationResults: { captain: null, navigator: null, engineer: null, veilwarden: null, watchmaster: null },
      stationActions: { captain: { type: "eventApproach" }, navigator: { type: "eventApproach" }, engineer: { type: "eventApproach" }, veilwarden: { type: "eventApproach" }, watchmaster: { type: "eventApproach" } },
      stationOrderCommitments: { captain: { committed: true }, navigator: { committed: true }, engineer: { committed: true }, veilwarden: { committed: true }, watchmaster: { committed: true } }
    });
    const stationCheckBefore = snapshot(stationCheckSource);
    const navigatorCheck = setTravelEventRunnerStationResult(stationCheckSource, 1, "navigator", "failure", { now: "2026-01-01T00:00:03.500Z", rawRollTotal: 19, dc: 20 });
    assertSmoke(navigatorCheck.ok, "matching target station check should resolve with pending Support bonus consumption when roll total/DC are provided");
    assertEqual(navigatorCheck.session.roundResults[1].stationResults.navigator, "success", "Support bonus should affect runner outcome when roll total/DC are provided");
    assertEqual(snapshot(stationCheckSource), stationCheckBefore, "Support bonus consumption should not mutate source session");
    const appliedBonuses = navigatorCheck.session.roundResults[1].stationCheckAppliedBonuses.navigator;
    assertSmoke(appliedBonuses.length === 1, "matching target station should apply one pending Support bonus");
    assertSmoke(appliedBonuses[0].sourceStationKey === "engineer" && appliedBonuses[0].sourceStationLabel === "Engineer" && appliedBonuses[0].targetStationKey === "navigator" && appliedBonuses[0].targetStationLabel === "Navigator", "applied Support bonus should include safe source and target labels");
    assertSmoke(appliedBonuses[0].bonusValue === 1 && appliedBonuses[0].bonusType === "circumstance" && appliedBonuses[0].playerSafe === true, "applied Support bonus should include the safe +1 circumstance metadata");
    assertSmoke(recordsFrom(navigatorCheck.session.travelV2PendingStationActionBonuses)[0].consumed === true, "consumed pending Support bonus should be marked consumed in cloned session");
    const repeatedCheck = setTravelEventRunnerStationResult(navigatorCheck.session, 1, "navigator", "criticalSuccess", { now: "2026-01-01T00:00:03.600Z", rawRollTotal: 30, dc: 20 });
    assertSmoke(repeatedCheck.ok && !repeatedCheck.session.roundResults[1].stationCheckAppliedBonuses?.navigator, "already consumed Support bonus should not apply again");
    const wrongStationSource = JSON.parse(stationCheckBefore);
    const wrongStationCheck = setTravelEventRunnerStationResult(wrongStationSource, 1, "captain", "success", { now: "2026-01-01T00:00:03.700Z" });
    assertSmoke(wrongStationCheck.ok && !wrongStationCheck.session.roundResults[1].stationCheckAppliedBonuses?.captain, "wrong target station should not consume pending Support bonus");
    assertSmoke(recordsFrom(wrongStationCheck.session.travelV2PendingStationActionBonuses)[0].consumed === false, "wrong target station should leave pending Support bonus unconsumed");
    const wrongRoundSource = JSON.parse(stationCheckBefore);
    wrongRoundSource.travelV2PendingStationActionBonuses.records[0].appliesToRoundIndex = 2;
    wrongRoundSource.travelV2PendingStationActionBonuses.records[0].nextRoundIndex = 2;
    const wrongRoundCheck = setTravelEventRunnerStationResult(wrongRoundSource, 1, "navigator", "success", { now: "2026-01-01T00:00:03.800Z" });
    assertSmoke(wrongRoundCheck.ok && !wrongRoundCheck.session.roundResults[1].stationCheckAppliedBonuses?.navigator, "wrong applicable round should not consume pending Support bonus");
    assertSmoke(recordsFrom(wrongRoundCheck.session.travelV2PendingStationActionBonuses)[0].consumed === false, "wrong applicable round should leave pending Support bonus unconsumed");
    const greaterStackSource = JSON.parse(stationCheckBefore);
    greaterStackSource.travelV2PendingStationActionBonuses.records.push({ id: "greater-opening-runner", bonusKey: "greaterOpeningBonus", bonusType: "circumstance", bonusValue: 3, sourceCardId: "greater-card", sourceCardLabel: "Greater Opening", targetStationKey: "navigator", previewRoundIndex: 1, consumed: false, playerSafe: true, readOnly: true });
    const greaterStackCheck = setTravelEventRunnerStationResult(greaterStackSource, 1, "navigator", "failure", { now: "2026-01-01T00:00:03.850Z", rawRollTotal: 19, dc: 20 });
    assertSmoke(greaterStackCheck.ok, "runner path should resolve stacked pending bonuses with roll total/DC");
    assertEqual(greaterStackCheck.session.roundResults[1].stationResults.navigator, "success", "Greater Opening should raise raw total 19 versus DC 20 to an effective success");
    assertEqual(greaterStackCheck.session.roundResults[1].stationSummary.navigator.appliedBonusTotal, 3, "runner path should apply only the highest same-roll circumstance bonus");
    assertSmoke(recordsFrom(greaterStackCheck.session.travelV2PendingStationActionBonuses).find((record) => record.id === "greater-opening-runner")?.consumed === true, "selected Greater Opening should be consumed in runner path");
    assertSmoke(recordsFrom(greaterStackCheck.session.travelV2PendingStationActionBonuses).find((record) => record.bonusKey === "support")?.suppressed === true, "lower Support bonus should be suppressed and consumed in runner path");

    const outcomeOnlySource = JSON.parse(stationCheckBefore);
    const outcomeOnlyCheck = setTravelEventRunnerStationResult(outcomeOnlySource, 1, "navigator", "success", { now: "2026-01-01T00:00:03.875Z" });
    assertSmoke(outcomeOnlyCheck.ok, "runner path should allow explicit outcome-only station result setting");
    assertEqual(outcomeOnlyCheck.session.roundResults[1].stationResults.navigator, "success", "outcome-only station result should keep the manually entered outcome");
    assertSmoke(outcomeOnlyCheck.session.roundResults[1].stationSummary.navigator.outcomeOnlyResolution === true && outcomeOnlyCheck.session.roundResults[1].stationSummary.navigator.bonusAffectsOutcome === false, "outcome-only station result should clearly mark that bonuses did not affect the outcome");
    assertSmoke(recordsFrom(outcomeOnlyCheck.session.travelV2PendingStationActionBonuses)[0].consumed === false, "outcome-only station result should not consume pending Support or Opening bonuses without roll total/DC");

    const outcomeOnlyFloorSource = JSON.parse(stationCheckBefore);
    outcomeOnlyFloorSource.travelV2PendingStationResultFloors = { records: [{ id: "runner-floor", resultFloor: "success", targetStationKey: "navigator", previewRoundIndex: 1, consumed: false, playerSafe: true, readOnly: true }] };
    const outcomeOnlyFloorCheck = setTravelEventRunnerStationResult(outcomeOnlyFloorSource, 1, "navigator", "failure", { now: "2026-01-01T00:00:03.890Z" });
    assertSmoke(outcomeOnlyFloorCheck.ok, "runner outcome-only path should still apply pending Legendary floors");
    assertEqual(outcomeOnlyFloorCheck.session.roundResults[1].stationResults.navigator, "success", "Legendary floor should upgrade outcome-only failure to success");
    assertSmoke(recordsFrom(outcomeOnlyFloorCheck.session.travelV2PendingStationResultFloors).find((record) => record.id === "runner-floor")?.consumed === true, "Legendary floor should be consumed in outcome-only runner path");
    const appliedBonusJson = JSON.stringify({ appliedBonuses, pendingBonuses: navigatorCheck.session.travelV2PendingStationActionBonuses });
    for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
      assertSmoke(!appliedBonusJson.includes(forbidden), `applied Support bonus state should not include forbidden player-safe term ${forbidden}`);
    }
    const pendingBonusJson = JSON.stringify(pendingBonuses);
    for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
      assertSmoke(!pendingBonusJson.includes(forbidden), `pending Support bonuses should not include forbidden player-safe term ${forbidden}`);
    }
    const supportEffectsJson = JSON.stringify(supportEffects);
    for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
      assertSmoke(!supportEffectsJson.includes(forbidden), `Support effects should not include forbidden player-safe term ${forbidden}`);
    }

    const invalidTargetSession = createRunnerSessionFixture({ lockInOptions: { supportTarget: "engineer" } });
    const invalidTargetApplied = prepareTravelV2PressureApplicationRunnerUpdate(invalidTargetSession, { selectedOutcomeKey: "failure", now: "2026-01-01T00:00:03.100Z" });
    const invalidTargetBefore = snapshot(invalidTargetApplied.nextSession);
    const invalidTargetFinalized = prepareTravelV2RoundFinalizationRunnerUpdate(invalidTargetApplied.nextSession, { now: "2026-01-01T00:00:03.200Z" });
    assertSmoke(invalidTargetFinalized.result.ok && invalidTargetFinalized.result.finalized, "self-targeted Support should not block finalization after guard passes");
    assertSmoke(invalidTargetFinalized.result.stationActionSupportEffects.effects.length === 0, "invalid Support target should not create an unsafe effect");
    assertSmoke(invalidTargetFinalized.result.pendingStationActionBonuses.records.length === 0, "invalid Support target should not create a pending bonus");
    assertSmoke(invalidTargetFinalized.result.stationActionSupportEffects.warnings.some((warning) => warning.includes("Engineer") && warning.includes("no valid target station")), "invalid Support target should record a safe warning");
    assertEqual(snapshot(invalidTargetApplied.nextSession), invalidTargetBefore, "invalid Support target finalization should not mutate pressure-applied source session");
    const invalidTargetJson = JSON.stringify(invalidTargetFinalized.result.stationActionSupportEffects);
    for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
      assertSmoke(!invalidTargetJson.includes(forbidden), `invalid Support target warning should not include forbidden player-safe term ${forbidden}`);
    }

    const duplicateBefore = snapshot(successful.nextSession);
    const duplicate = prepareTravelV2RoundFinalizationRunnerUpdate(successful.nextSession, { now: "2026-01-01T00:00:04.000Z" });
    assertSmoke(!duplicate.result.ok && !duplicate.result.finalized, "duplicate finalization should block");
    assertSmoke(!duplicate.shouldUpdateSession, "duplicate finalization should not replace session");
    assertEqual(recordsFrom(duplicate.nextSession.travelV2RoundResolutions).length, 1, "duplicate finalization should not append another record");
    assertEqual(snapshot(successful.nextSession), duplicateBefore, "duplicate finalization should not mutate finalized session");

    const completed = prepareTravelV2RoundFinalizationRunnerUpdate({ ...applied.nextSession, status: "completed" }, { now: "2026-01-01T00:00:05.000Z" });
    assertSmoke(!completed.result.ok && !completed.result.finalized, "completed session should block finalization");

    const corrected = prepareTravelV2PressureCorrectionRunnerUpdate(applied.nextSession, { correctedOutcomeKey: "mixed", now: "2026-01-01T00:00:06.000Z" });
    assertSmoke(corrected.shouldUpdateSession, "fixture should support pressure correction before finalization");
    const correctedFinalized = prepareTravelV2RoundFinalizationRunnerUpdate(corrected.nextSession, { now: "2026-01-01T00:00:07.000Z" });
    assertSmoke(correctedFinalized.shouldUpdateSession, "corrected pressure outcome should finalize");
    assertEqual(correctedFinalized.result.effectiveOutcomeKey, "mixed", "finalization should preserve corrected effective outcome");
    assertEqual(correctedFinalized.result.roundResolutionRecord.effectiveOutcomeKey, "mixed", "resolution record should preserve corrected effective outcome");

    const stateBefore = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: applied.nextSession });
    const renderApp = new ArcflightTravelEventRunner({ session: applied.nextSession });
    const renderSessionBefore = snapshot(renderApp.session);
    const context = await renderApp._prepareContext({});
    assertEqual(snapshot(renderApp.session), renderSessionBefore, "runner state preparation should not automatically finalize");
    assertEqual(recordsFrom(renderApp.session.travelV2RoundResolutions).length, 0, "render state should not append finalization records");
    assertSmoke(context.state, "runner state preparation should still return app state");
    assertSmoke(stateBefore, "preview consumer preparation should remain explicit and inert");

    const app = new ArcflightTravelEventRunner({ session: applied.nextSession });
    const appResult = await app.finalizeTravelV2Round({ now: "2026-01-01T00:00:08.000Z" });
    assertSmoke(appResult.rendered, "internal app finalization method should rerender on success");
    assertEqual(app.uiState.travelV2RoundFinalizationResult.finalized, true, "app should store successful finalization result in UI state");
    assertEqual(recordsFrom(app.session.travelV2RoundResolutions).length, 1, "app should replace session with finalized clone");
    const appStateAfterFinalize = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: app.session, travelV2RoundFinalizationResult: app.uiState.travelV2RoundFinalizationResult });
    assertSmoke(appStateAfterFinalize.travelV2PreviewPanel.travelV2StationActionResolutionSummary.hasStations, "runner render state should expose finalized station action summary");
    assertSmoke(appStateAfterFinalize.travelV2PreviewPanel.travelV2StationActionResolutionSummary.stations.some((row) => row.stationKey === "engineer" && row.targetStationLabel === "Navigator"), "runner render state should expose safe Support target display");
    assertSmoke(appStateAfterFinalize.travelV2PreviewPanel.travelV2StationActionSupportEffects.effects.some((row) => row.sourceStationLabel === "Engineer" && row.targetStationLabel === "Navigator"), "runner render state should expose safe Support effect display");
    assertSmoke(appStateAfterFinalize.travelV2PreviewPanel.travelV2PendingStationActionBonuses.records.some((row) => row.sourceStationLabel === "Engineer" && row.targetStationLabel === "Navigator" && row.bonusValue === 1), "runner render state should expose safe pending Support bonus display");
    const renderStateJson = JSON.stringify(appStateAfterFinalize.travelV2PreviewPanel);
    for (const forbidden of ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"]) {
      assertSmoke(!renderStateJson.includes(forbidden), `player-safe render state should not include forbidden internal term ${forbidden}`);
    }
    assertEqual(app.selectedSessionKey, "runner-finalization-fixture", "app should preserve selected session key from session");

    const blockedApp = new ArcflightTravelEventRunner({ session: noPressure });
    const blockedAppResult = await blockedApp.finalizeTravelV2Round({ now: "2026-01-01T00:00:09.000Z" });
    assertSmoke(blockedAppResult && !blockedAppResult.shouldUpdateSession, "blocked app finalization should return update details without rerender");
    assertSmoke(blockedApp.uiState.travelV2RoundFinalizationResult.ok === false, "app should store blocked finalization result in UI state");
    assertEqual(snapshot(blockedApp.session), noPressureBefore, "blocked app finalization should not mutate session");

    assertEqual(chatCalls, 0, "runner finalization path should not create chat messages");
    assertEqual(socketCalls, 0, "runner finalization path should not emit sockets");
    assertEqual(actorUpdateCalls, 0, "runner finalization path should not update actors");
    assertEqual(itemUpdateCalls, 0, "runner finalization path should not update items");

    const fs = await import("node:fs");
    const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
    assertSmoke(template.includes("data-arcflight-travel-v2-round-finalize"), "template should include visible round finalization control");
    assertSmoke(template.includes("travelV2StationActionResolutionSummary"), "template should render finalized station action summary when available");
    assertSmoke(template.includes("travelV2StationActionSupportEffects"), "template should render finalized station action Support effects when available");
    assertSmoke(template.includes("travelV2PendingStationActionBonuses"), "template should render pending Support bonuses when available");
    assertSmoke(template.includes("travelV2StationActionEventApproachContributions"), "template should render Event Approach contributions when available");
    assertSmoke(template.includes("travelV2StationActionEventApproachContributionTally"), "template should render Event Approach contribution tally when available");
    assertSmoke(template.includes("travelV2StationActionEventApproachTallyStatus"), "template should render Event Approach tally status when available");
    assertSmoke(template.includes("state.travelV2PreviewPanel.travelV2RoundFinalizationState"), "template should use prepared finalization state");
    assertSmoke(template.includes("finalizeDisabled"), "template should use prepared disabled state");
    assertSmoke(!template.includes("data-arcflight-runner-complete") || template.includes("data-arcflight-travel-v2-round-finalize"), "finalization control should not replace or add event completion behavior");
    const aggregate = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
    assertSmoke(aggregate.includes("runTravelEventRunnerV2RoundFinalizationSmokeChecks"), "aggregate Travel v2 smoke runner should include finalization suite");
    assertSmoke(getRenderCalls() >= 1, "successful app finalization should have requested at least one render");

    return {
      ok: true,
      checked: [
        "runner-helper-exported",
        "missing-session-blocked",
        "no-pressure-application-blocked",
        "missing-station-action-lock-in-blocked",
        "unlocked-station-action-lock-in-blocked",
        "invalid-station-key-lock-in-blocked",
        "player-safe-lock-in-block-redacted",
        "ready-locked-finalization-records-station-action-summary",
        "summary-includes-travel-five",
        "support-target-safe-summary",
        "support-effect-result-and-record",
        "support-pending-bonus-result-record-session",
        "event-approach-contribution-result-record",
        "event-approach-contribution-tally-result-record",
        "event-approach-contribution-outcome-values",
        "event-approach-contribution-player-safe-redacted",
        "support-effect-render-state",
        "support-pending-bonus-render-state",
        "invalid-support-target-safe-warning",
        "support-effect-player-safe-redacted",
        "station-action-summary-player-safe-redacted",
        "successful-finalization-replaces-session",
        "duplicate-finalization-non-destructive",
        "completed-session-blocked",
        "corrected-outcome-finalizes",
        "single-resolution-record-appended",
        "input-session-not-mutated",
        "no-chat-socket-actor-item-side-effects",
        "render-state-does-not-finalize",
        "visible-template-controls",
        "visible-template-event-approach-contributions",
        "visible-template-event-approach-contribution-tally",
        "aggregate-smoke-includes-suite",
        "app-internal-action-wiring"
      ]
    };
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
    if (previousChatMessage === undefined) delete globalThis.ChatMessage;
    else globalThis.ChatMessage = previousChatMessage;
  }
}

export default runTravelEventRunnerV2RoundFinalizationSmokeChecks;
