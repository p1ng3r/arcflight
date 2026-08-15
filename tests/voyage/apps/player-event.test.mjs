import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.foundry ??= { applications: { api: {
  HandlebarsApplicationMixin: (Base) => Base,
  ApplicationV2: class { render() { return this; } }
} } };

const { buildVoyagePlayerEventModel, PLAYER_TABS, VoyagePlayerEventApp, normalizePlayerTab, openVoyagePlayerEvent } = await import("../../../scripts/voyage/apps/player-event.js");
const template = readFileSync(new URL("../../../templates/voyage/player-event.hbs", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../../scripts/voyage/apps/player-event.js", import.meta.url), "utf8");
const arcflight = readFileSync(new URL("../../../scripts/arcflight.js", import.meta.url), "utf8");

function projection(role = "observer", ownedOperators = [], ownedPlanningOptions = []) {
  return {
    schemaVersion: 1,
    sessionId: "session-player",
    eventId: "m12-glassback-cinderwake",
    revision: 5,
    sessionState: "crew-planning",
    currentStage: "round-1",
    roundNumber: 1,
    phase: "crew-planning",
    stationAssignments: [
      { stationId: "captain", operator: { kind: "actor", id: "actor-captain", uuid: "Actor.captain", name: "Captain" } },
      { stationId: "watchmaster", operator: { kind: "actor", id: "actor-watch", uuid: "Actor.watch", name: "Watchmaster" } }
    ],
    committedStationOrder: ["captain", "watchmaster"],
    currentActingStationId: null,
    momentum: 0,
    pressureSystems: [],
    activeHazards: [],
    visibleEvents: [],
    closeoutStatus: "not-started",
    recoveryStatus: "none",
    projectionRole: role,
    ownedOperators,
    readOnlyStationIds: ["watchmaster"],
    ownedPlanningOptions
  };
}

test("Slice B exposes exactly the four read-only player tabs", () => {
  assert.deepEqual(PLAYER_TABS, ["round", "my-station", "crew-plan", "resolution"]);
  assert.equal(normalizePlayerTab("resolution"), "resolution");
  assert.equal(normalizePlayerTab("gm-controls"), "round");
  for (const tab of PLAYER_TABS) assert.match(template, new RegExp(`data-player-panel=\\"${tab}\\"`));
});

test("operator player model presents every owned station and projects controls only when options are authorized", () => {
  const model = buildVoyagePlayerEventModel(projection("operator", [
    { stationId: "captain", operatorId: "actor-captain", operatorUuid: "Actor.captain", operatorName: "Captain", canAct: false },
    { stationId: "watchmaster", operatorId: "actor-watch", operatorUuid: "Actor.watch", operatorName: "Watchmaster", canAct: false }
  ]));
  assert.equal(model.projectionRole, "operator");
  assert.deepEqual(model.ownedStations.map((entry) => entry.stationId), ["captain", "watchmaster"]);
  assert.equal(model.ownedStations.every((entry) => entry.readOnly), true);
  assert.equal(model.crewPlan.filter((entry) => entry.owned).length, 2);
  assert.doesNotMatch(template, /data-m12-(dispatch|roll|focus|action|risk-bid|station-selection)/);
});

test("owned planning options are rendered as isolated Action, Approach, and Risk Bid controls", () => {
  const options = [{
    stationId: "captain", selectedActionId: "helm", selectedApproachId: "helm-diplomacy", selectedRiskBidId: null, editable: true, ready: true,
    actions: [{ actionId: "helm", displayName: "Command the Opening", description: "Find the safe lane.", selected: true,
      approaches: [{ approachId: "helm-diplomacy", label: "Diplomacy", description: "Call the line.", selected: true }],
      riskBidCapable: true, riskBidOptions: [{ riskBidId: "helm-risk-2", label: "+2 Risk Bid", dcAdjustment: 2, intendedBenefit: "Open a lane.", outcome: { criticalSuccess: "Wide lane", success: "Clear lane", failure: "No payoff", criticalFailure: "Lane closes" }, selected: false }], targetRequired: false, eligibleTargets: [] }]
  }];
  const model = buildVoyagePlayerEventModel(projection("operator", [{ stationId: "captain" }], options));
  assert.equal(model.ownedStations[0].planning.editable, true);
  assert.equal(model.ownedStations[0].planning.selectedAction.displayName, "Command the Opening");
  assert.equal(model.ownedStations[0].planning.selectedAction.riskBidOptions[0].tierLabel, "+2 Risk Bid");
  assert.match(model.ownedStations[0].planning.selectedAction.riskBidOptions[0].label, /Open a lane\./);
  assert.match(template, /data-player-planning-field="action"/);
  assert.match(template, /data-player-planning-field="approach"/);
  assert.match(template, /data-player-planning-field="riskBid"/);
  assert.match(template, /data-player-planning-clear/);
  assert.match(runtime, /changedField === "action"/);
  assert.match(runtime, /riskBidId: changedField === "action" \? null/);
});

test("locked or non-owned player projections expose no planning controls", () => {
  const locked = projection("operator", [{ stationId: "captain" }], [{ stationId: "captain", editable: false, ready: true, actions: [] }]);
  const model = buildVoyagePlayerEventModel(locked);
  assert.equal(model.ownedStations[0].readOnly, true);
  const observer = buildVoyagePlayerEventModel(projection("observer", [], [{ stationId: "captain", editable: true, actions: [] }]));
  assert.equal(observer.ownedStations.length, 0);
});

test("crew and observer models never gain owned station state", () => {
  const crew = buildVoyagePlayerEventModel(projection("crew", [{ stationId: "unassigned", operatorId: "other", operatorUuid: "Actor.other" }]));
  const observer = buildVoyagePlayerEventModel(projection("observer", []));
  assert.equal(crew.ownedStations.length, 0);
  assert.equal(observer.ownedStations.length, 0);
  assert.equal(crew.hasOwnedStation, false);
  assert.equal(observer.hasOwnedStation, false);
});

test("player model filters raw session internals and remains isolated", () => {
  const source = projection("operator", [{ stationId: "captain", operatorId: "actor-captain", operatorUuid: "Actor.captain" }]);
  source.pressureSystems = [{ pressureSystemId: "crew-morale", value: 1, capacity: 2 }];
  source.activeHazards = [{ hazardId: "hazard-1", privateDetails: "do-not-copy" }];
  source.gmSecretInformation = { secret: "do-not-copy" };
  const model = buildVoyagePlayerEventModel(source);
  assert.equal("gmSecretInformation" in model, false);
  assert.equal("events" in model, false);
  assert.equal("auditHistory" in model, false);
  assert.equal("receipts" in model, false);
  model.ownedStations[0].operatorName = "mutated";
  model.round.pressureSystems[0].value = 99;
  model.round.activeHazards[0].hazardId = "mutated";
  assert.equal(source.stationAssignments[0].operator.name, "Captain");
  assert.equal(source.pressureSystems[0].value, 1);
  assert.equal(source.activeHazards[0].hazardId, "hazard-1");
  assert.equal(model.resolution.currentStation, null);
});

test("player model is projection-only and does not fabricate absent authored narrative", () => {
  const source = projection("observer");
  const model = buildVoyagePlayerEventModel(source);
  assert.equal(model.round.narrativeAvailable, false);
  assert.equal(model.round.vignette, null);
  assert.equal(model.round.situation, null);
  assert.equal(model.round.objective, null);
  assert.equal(model.round.knownStakes, null);
  const sourceWithNarrative = { ...source, roundTitle: "Projected Round", objective: "Projected objective" };
  const projected = buildVoyagePlayerEventModel(sourceWithNarrative);
  assert.equal(projected.round.narrativeAvailable, true);
  assert.equal(projected.round.objective, "Projected objective");
});

test("round, plan-lock, current-station, and completed resolution states are presentation-only", () => {
  const waiting = buildVoyagePlayerEventModel(projection("observer"));
  assert.equal(waiting.resolution.stateLabel, "WAITING FOR RESOLUTION");
  const lockedProjection = projection("observer"); lockedProjection.sessionState = "plan-locked"; lockedProjection.phase = "lock-readiness"; lockedProjection.planLocked = true;
  assert.equal(buildVoyagePlayerEventModel(lockedProjection).resolution.stateLabel, "PLAN LOCKED");
  const activeProjection = projection("operator", [{ stationId: "captain" }]); activeProjection.sessionState = "station-resolution"; activeProjection.phase = "resolution"; activeProjection.planLocked = true; activeProjection.currentActingStationId = "captain";
  const active = buildVoyagePlayerEventModel(activeProjection);
  assert.equal(active.resolution.currentStation.stationId, "captain");
  assert.equal(active.resolution.ownedCurrent, true);
  const complete = projection("observer"); complete.sessionState = "completed";
  assert.equal(buildVoyagePlayerEventModel(complete).resolution.stateLabel, "RESOLUTION COMPLETE");
});

test("Slice F presents the shared current station and owned-active indicator without roll controls", () => {
  const source = projection("operator", [{ stationId: "captain" }]);
  source.sessionState = "station-resolution";
  source.phase = "resolution";
  source.planLocked = true;
  source.currentActingStationId = "captain";
  source.resolutionStarted = true;
  source.resolutionOrder = ["captain", "watchmaster"];
  source.resolutionCurrentStationId = "captain";
  source.resolutionOrderPosition = 1;
  source.resolutionTotalStations = 2;
  source.resolutionStations = [
    { stationId: "captain", orderPosition: 1, status: "current", current: true, operator: { name: "Captain" } },
    { stationId: "watchmaster", orderPosition: 2, status: "waiting", current: false, operator: { name: "Watchmaster" } }
  ];
  const model = buildVoyagePlayerEventModel(source);
  assert.equal(model.resolution.stateLabel, "RESOLUTION IN PROGRESS");
  assert.equal(model.resolution.currentStation.stationId, "captain");
  assert.equal(model.resolution.ownedCurrent, true);
  assert.deepEqual(model.resolution.order, ["captain", "watchmaster"]);
  assert.equal(model.resolution.orderPosition, 1);
  assert.deepEqual(model.resolution.stations.map((entry) => [entry.stationDisplayName, entry.status]), [["Captain", "current"], ["Watchmaster", "waiting"]]);
  assert.doesNotMatch(template, /ROLL CHECK|data-player-roll|data-player-focus|data-player-reaction/);
  assert.match(template, /YOUR STATION IS ACTIVE/);
  const complete = buildVoyagePlayerEventModel({ ...source, resolutionComplete: true });
  assert.equal(complete.resolution.stateLabel, "RESOLUTION COMPLETE");
  assert.equal(complete.resolution.detail, "AWAITING ROUND CLOSEOUT");
});

test("Slice F player resolution exposes no functional Begin, planning, lock, roll, Focus, or reaction controls", () => {
  const source = projection("operator", [{ stationId: "captain" }]);
  source.sessionState = "station-resolution"; source.phase = "resolution"; source.planLocked = true;
  source.resolutionStarted = true; source.resolutionCurrentStationId = "captain"; source.currentActingStationId = "captain";
  source.resolutionOrder = ["captain", "watchmaster"]; source.resolutionOrderPosition = 1; source.resolutionTotalStations = 2;
  source.resolutionStations = [{ stationId: "captain", orderPosition: 1, status: "current", current: true, operator: { name: "Captain" } }, { stationId: "watchmaster", orderPosition: 2, status: "waiting", current: false, operator: { name: "Watchmaster" } }];
  const model = buildVoyagePlayerEventModel(source);
  assert.equal(model.ownedPlanningOptions.length, 0); assert.equal(model.canMutateSharedOrder, false); assert.equal(model.planLocked, true);
  assert.equal(model.resolution.started, true); assert.equal(model.resolution.ownedCurrent, true);
  assert.doesNotMatch(template, /BEGIN RESOLUTION|LOCK PLAN|UNLOCK PLAN|ROLL CHECK|FOCUS|REACTION/);
  assert.equal(model.crewPlan.some((entry) => entry.planning?.editable === true), false);
  assert.equal(model.ownedStations.some((entry) => entry.canMoveUp || entry.canMoveDown), false);
});

test("Slice F owned-active markers follow the authoritative current station matrix", () => {
  const make = (currentStationId) => {
    const source = projection("operator", [{ stationId: "captain" }, { stationId: "watchmaster" }]);
    source.stationAssignments = [
      { stationId: "captain", operator: { kind: "actor", id: "actor-captain", uuid: "Actor.captain", name: "Captain" } },
      { stationId: "watchmaster", operator: { kind: "actor", id: "actor-watch", uuid: "Actor.watch", name: "Watchmaster" } },
      { stationId: "navigator", operator: { kind: "actor", id: "actor-nav", uuid: "Actor.navigator", name: "Navigator" } }
    ];
    source.sessionState = "station-resolution"; source.phase = "resolution"; source.planLocked = true; source.resolutionStarted = true;
    source.resolutionCurrentStationId = currentStationId; source.currentActingStationId = currentStationId; source.resolutionOrder = ["captain", "watchmaster", "navigator"];
    source.resolutionOrderPosition = source.resolutionOrder.indexOf(currentStationId) + 1; source.resolutionTotalStations = 3;
    source.resolutionStations = source.resolutionOrder.map((stationId, index) => ({ stationId, orderPosition: index + 1, status: stationId === currentStationId ? "current" : "waiting", current: stationId === currentStationId, operator: { name: stationId === "captain" ? "Captain" : stationId === "watchmaster" ? "Watchmaster" : "Navigator" } }));
    return buildVoyagePlayerEventModel(source);
  };
  const captain = make("captain"); assert.equal(captain.resolution.currentStation.stationId, "captain"); assert.equal(captain.resolution.ownedCurrent, true);
  assert.equal(captain.resolution.stations.find((entry) => entry.stationId === "watchmaster").current, false); assert.equal(captain.resolution.stations.find((entry) => entry.stationId === "navigator").current, false);
  const watchmaster = make("watchmaster"); assert.equal(watchmaster.resolution.currentStation.stationId, "watchmaster"); assert.equal(watchmaster.resolution.ownedCurrent, true);
  assert.equal(watchmaster.resolution.stations.find((entry) => entry.stationId === "captain").current, false);
  const navigator = make("navigator"); assert.equal(navigator.resolution.currentStation.stationId, "navigator"); assert.equal(navigator.resolution.ownedCurrent, false);
  assert.equal(navigator.resolution.stations.find((entry) => entry.stationId === "captain").current, false); assert.equal(navigator.resolution.stations.find((entry) => entry.stationId === "watchmaster").current, false);
});

test("Slice F role models retain identical public resolution state and omit private evidence", () => {
  const base = projection("gm", [{ stationId: "captain" }]);
  base.sessionState = "station-resolution"; base.phase = "resolution"; base.planLocked = true; base.resolutionStarted = true;
  base.resolutionOrder = ["captain", "watchmaster"]; base.resolutionCurrentStationId = "watchmaster"; base.currentActingStationId = "watchmaster"; base.resolutionOrderPosition = 2; base.resolutionTotalStations = 2;
  base.resolutionStations = [{ stationId: "captain", orderPosition: 1, status: "resolved", current: false, operator: { name: "Captain" } }, { stationId: "watchmaster", orderPosition: 2, status: "current", current: true, operator: { name: "Watchmaster" } }];
  base.pendingChecks = [{ pendingCheckId: "private", result: { total: 99 } }]; base.auditHistory = [{ secret: true }]; base.processedRequests = [{ private: true }]; base.authorityEpoch = 4; base.coordinator = { secret: true };
  const models = ["gm", "operator", "crew", "observer"].map((role) => buildVoyagePlayerEventModel({ ...base, projectionRole: role, ownedOperators: role === "operator" ? [{ stationId: "watchmaster" }] : [] }));
  for (const model of models) {
    assert.equal(model.resolution.started, true); assert.deepEqual(model.resolution.order, ["captain", "watchmaster"]); assert.equal(model.resolution.currentStation.stationId, "watchmaster");
    assert.equal(model.resolution.orderPosition, 2); assert.deepEqual(model.resolution.stations.map((entry) => [entry.stationId, entry.status]), [["captain", "resolved"], ["watchmaster", "current"]]);
    for (const key of ["pendingChecks", "auditHistory", "processedRequests", "authorityEpoch", "coordinator", "rawEventSession"]) assert.equal(key in model, false, key);
  }
});

test("ApplicationV2 shell and public opening/discovery boundaries use the existing command path without direct document writes", () => {
  assert.match(runtime, /static PARTS = \{ body/);
  assert.match(runtime, /readVoyageEventSessionMultiplayerProjection/);
  assert.match(runtime, /game\.arcflight\?\.discoverVoyageEventSession/);
  assert.match(arcflight, /discoverVoyageEventSession:/);
  assert.match(arcflight, /openPlayerEvent: async \(\) =>/);
  assert.equal(openVoyagePlayerEvent.length, 0);
  assert.doesNotMatch(runtime, /M12_EVENT_PRESENTATION|event-definition/);
  assert.match(runtime, /dispatchVoyageEventSessionCommand/);
  assert.doesNotMatch(runtime, /JournalEntry\.create|\.update\(/);
  assert.doesNotMatch(template, /audit|recovery|receipt|GM Controls|Closeout|Rewards|Ship Administration/);
});

test("player template is one root and contains only the neutral absent-narrative path", () => {
  const staticMarkup = template.replace(/\{\{[\s\S]*?\}\}/g, "");
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const tags = /<\/?([a-z][\w:-]*)(?:\s[^<>]*?)?\/?\s*>/gi;
  let depth = 0; let roots = 0; let match;
  while ((match = tags.exec(staticMarkup))) {
    const token = match[0]; const name = match[1].toLowerCase();
    if (token.startsWith("</")) depth -= 1;
    else { if (depth === 0) roots += 1; if (!token.endsWith("/>") && !voidTags.has(name)) depth += 1; }
  }
  assert.equal(roots, 1);
  assert.equal(depth, 0);
  assert.match(template, /Round narrative is not yet revealed/);
  assert.doesNotMatch(template, /M12_EVENT_PRESENTATION|event-definition|gmSecretInformation|auditHistory|processedRequests|checkpoints/);
});

test("public opener has no caller-selected session authority", () => {
  assert.match(arcflight, /openPlayerEvent: async \(\) =>[\s\S]*?openVoyagePlayerEvent\(\)/);
  assert.doesNotMatch(arcflight, /openPlayerEvent: async \(sessionId/);
  assert.doesNotMatch(runtime, /options\.sessionId/);
});

test("player app uses trusted discovery for valid, missing, and ambiguous active sessions", () => {
  let reads = 0;
  globalThis.game = { arcflight: {
    discoverVoyageEventSession: () => ({ sessionId: "active-session", revision: 5 }),
    readVoyageEventSessionMultiplayerProjection: (request) => { reads += 1; assert.equal(request.sessionId, "active-session"); return { ok: true, projection: projection("crew") }; }
  } };
  const valid = new VoyagePlayerEventApp()._prepareContext();
  assert.equal(valid.sessionUnavailable, false);
  assert.equal(reads, 1);

  globalThis.game.arcflight.discoverVoyageEventSession = () => null;
  const unavailable = new VoyagePlayerEventApp()._prepareContext();
  assert.equal(unavailable.sessionUnavailable, true);
  assert.equal(unavailable.model, null);
  assert.equal(reads, 1);

  globalThis.game.arcflight.discoverVoyageEventSession = () => null;
  const ambiguous = new VoyagePlayerEventApp()._prepareContext();
  assert.equal(ambiguous.sessionUnavailable, true);
  assert.equal(ambiguous.model, null);
  assert.equal(reads, 1);
});

test("extra opener arguments cannot replace trusted discovery", () => {
  let requestedSession = null;
  globalThis.game = { arcflight: {
    discoverVoyageEventSession: () => ({ sessionId: "trusted-active", revision: 2 }),
    readVoyageEventSessionMultiplayerProjection: (request) => { requestedSession = request.sessionId; return { ok: true, projection: projection("observer") }; }
  } };
  const app = openVoyagePlayerEvent("historical-or-foreign");
  app._prepareContext();
  assert.equal(requestedSession, "trusted-active");
});

test("Slice D presents the authoritative shared order and operator-only move controls", () => {
  const source = projection("operator", [{ stationId: "captain" }]);
  source.sharedStationOrder = ["watchmaster", "captain"];
  source.planReady = true;
  source.planLocked = false;
  source.canMutateSharedOrder = true;
  const model = buildVoyagePlayerEventModel(source);
  assert.deepEqual(model.sharedStationOrder, ["watchmaster", "captain"]);
  assert.deepEqual(model.crewPlan.map((entry) => entry.stationId), ["watchmaster", "captain"]);
  assert.equal(model.crewPlan[0].canMoveDown, true);
  assert.equal(model.crewPlan[1].canMoveUp, true);
  assert.match(template, /data-player-order-move/);
  assert.match(template, /Shared Station Order/);
  const locked = buildVoyagePlayerEventModel({ ...source, planLocked: true, canMutateSharedOrder: true });
  assert.equal(locked.canMutateSharedOrder, false);
  assert.equal(locked.crewPlan.some((entry) => entry.canMoveUp || entry.canMoveDown), false);
  const observer = buildVoyagePlayerEventModel({ ...source, projectionRole: "observer", canMutateSharedOrder: false });
  assert.equal(observer.canMutateSharedOrder, false);
  assert.equal(observer.crewPlan.some((entry) => entry.canMoveUp || entry.canMoveDown), false);
});

test("Slice D Player Event consumes projected planLocked without re-inferring phase or order", () => {
  const paused = buildVoyagePlayerEventModel({ ...projection("observer"), sessionState: "paused", phase: "lock-readiness", committedStationOrder: ["captain", "watchmaster"], planLocked: false });
  assert.equal(paused.planLocked, false);
  assert.notEqual(paused.crewPlan.length, 0);
  const recovery = buildVoyagePlayerEventModel({ ...projection("observer"), sessionState: "recovery-required", phase: "lock-readiness", committedStationOrder: ["captain", "watchmaster"], planLocked: false });
  assert.equal(recovery.planLocked, false);
  const locked = buildVoyagePlayerEventModel({ ...projection("observer"), sessionState: "station-resolution", phase: "resolution", planLocked: true });
  assert.equal(locked.planLocked, true);
  assert.equal(locked.resolution.stateLabel, "PLAN LOCKED");
  const tampered = buildVoyagePlayerEventModel({ ...projection("observer"), sessionState: "crew-planning", phase: "lock-readiness", committedStationOrder: ["watchmaster", "captain"], planLocked: false });
  assert.equal(tampered.planLocked, false);
});
