import test from "node:test";
import assert from "node:assert/strict";
import { createVoyageEventTestNamespace } from "../../../scripts/voyage/testing/event-test-engine.js";
import { getM12EventDefinition, M12_DEFINITION_SNAPSHOT_ID, M12_EVENT_ID } from "../../../scripts/voyage/m12/event-definition.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE } from "../../../scripts/documents/ships.js";

function fixture() {
  const actors = [{ id: "ship", uuid: "Actor.ship", name: "Cinderwake", type: "vehicle", getFlag: (_m, key) => key === "enabled" ? true : ARCFLIGHT_SHIP_ACTOR_TYPE }];
  const users = [{ id: "gm-1", name: "GM", isGM: true, active: true }];
  const context = { journalEntries: [], authenticatedUserId: "gm-1", authenticatedConnectionId: "conn", trustedTransportContext: true, activeGmUserId: "gm-1", users, actors, resolveEventDefinitionSnapshot: () => getM12EventDefinition() };
  return { context, game: { user: users[0], users }, writes: 0 };
}
function api(fx) { return createVoyageEventTestNamespace({ getContext: () => fx.context, getGame: () => fx.game }); }

test("eventTest requires an authenticated active GM and performs no writes", async () => {
  const fx = fixture();
  fx.game.user = { id: "player", isGM: false };
  const result = await api(fx).listEvents();
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-active-gm-required");
  assert.equal(fx.writes, 0);
});

test("listEvents uses the registered immutable definition and remains concise", async () => {
  const result = await api(fixture()).listEvents();
  assert.equal(result.ok, true);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].eventId, M12_EVENT_ID);
  assert.equal(result.events[0].definitionSnapshotId, M12_DEFINITION_SNAPSHOT_ID);
  assert.equal(result.events[0].rounds.length, 3);
  assert.deepEqual(Object.keys(result.events[0]).sort(), ["breachDC", "definitionSnapshotId", "eventId", "rounds", "title"]);
});

test("findActionsByConsequence reports authored effects only", async () => {
  const fx = fixture();
  const apiValue = api(fx);
  const pressure = await apiValue.findActionsByConsequence({ roundId: "m12-round-1", stationId: "navigator", branch: "failure", pressureSystemId: "hull-integrity" });
  assert.equal(pressure.ok, true);
  assert.deepEqual(pressure.matches, []);
  const actions = await apiValue.findActionsByConsequence({ roundId: "m12-round-1", stationId: "navigator" });
  assert.equal(actions.ok, true);
  assert.equal(actions.matches.length, 3);
  assert.ok(actions.matches.every((entry) => entry.actionId && entry.name));
});
test("inspect uses the canonical object-shaped request", async () => {
  const fx = fixture();
  const result = await api(fx).inspect({ sessionId: "missing-session", verbose: false });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-session-document-not-found");
  assert.equal(fx.writes, 0);
});

test("inspect rejects positional session IDs", async () => {
  const fx = fixture();
  const result = await api(fx).inspect("missing-session");
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-invalid-request-shape");
  assert.equal(fx.writes, 0);
});

test("inspect rejects missing sessionId without writes", async () => {
  const fx = fixture();
  const result = await api(fx).inspect({});
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-invalid-request-shape");
  assert.equal(fx.writes, 0);
});

test("inspect rejects a non-boolean verbose option", async () => {
  const fx = fixture();
  const result = await api(fx).inspect({ sessionId: "missing-session", verbose: "true" });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-invalid-request-shape");
  assert.equal(fx.writes, 0);
});

test("inspect remains protected by active-GM authority", async () => {
  const fx = fixture();
  fx.game.user = { id: "player", isGM: false };
  const result = await api(fx).inspect({ sessionId: "missing-session" });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-active-gm-required");
  assert.equal(fx.writes, 0);
});