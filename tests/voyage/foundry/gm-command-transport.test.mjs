import test from "node:test";
import assert from "node:assert/strict";
import {
  executeVoyagePlayerIntent,
  registerVoyageGmCommandTransport,
  validateVoyagePlayerIntent,
  voyagePlayerIntentTransportState
} from "../../../scripts/voyage/foundry/gm-command-transport.js";

const stationRequest = () => ({ kind: "voyage.m12-resolve-station", requestId: "station-1", sessionId: "session-1", expectedRevision: 5, authorityEpoch: 0 });
const focusRequest = () => ({ kind: "voyage.m11-command", requestId: "focus-1", sessionId: "session-1", expectedRevision: 5, authorityEpoch: 0, commandKind: "focus-reaction-use", payload: { reactionId: "reaction-1" } });

test("player intent transport accepts only the bounded station and reaction envelopes", () => {
  assert.equal(validateVoyagePlayerIntent(stationRequest()).ok, true);
  assert.equal(validateVoyagePlayerIntent(focusRequest()).ok, true);
  for (const field of ["userId", "principalId", "operatorId", "participantId", "role", "isGM", "ownership", "senderId"]) {
    const forged = { ...focusRequest(), [field]: "other-user" };
    assert.equal(validateVoyagePlayerIntent(forged).ok, false, field);
  }
  for (const commandKind of ["plan-lock", "plan-unlock", "resolution-start", "closeout", "arbitrary-command"]) {
    const forged = { ...focusRequest(), commandKind, payload: {} };
    assert.equal(validateVoyagePlayerIntent(forged).ok, false, commandKind);
  }
});

test("GM RPC handler uses socketlib sender identity and returns an isolated result", async () => {
  let registeredName = null;
  let registeredHandler = null;
  const socket = {
    register(name, handler) { registeredName = name; registeredHandler = handler; },
    async executeAsGM(_name, request) { return registeredHandler.call({ socketdata: { userId: "player-a" } }, request); }
  };
  const seen = [];
  assert.equal(registerVoyageGmCommandTransport({ socketlib: { registerModule: () => socket }, onIntent: async (request, origin) => {
    seen.push({ request, origin });
    return { ok: true, requestId: request.requestId, sessionId: request.sessionId, status: "station-resolution", revision: 6, authorityEpoch: 0, projection: null, events: [], errors: [], warnings: [] };
  } }), true);
  assert.equal(registeredName, "arcflightVoyagePlayerIntent");
  const result = await executeVoyagePlayerIntent(stationRequest(), socket);
  assert.equal(result.ok, true);
  assert.equal(seen[0].origin.originatingUserId, "player-a");
  assert.equal(seen[0].request.requestId, "station-1");
  assert.equal(voyagePlayerIntentTransportState().registered, true);
  result.events.push({ forged: true });
  const replay = await executeVoyagePlayerIntent(stationRequest(), socket);
  assert.deepEqual(replay.events, []);
});

test("transport rejects hostile values and has no local fallback when no GM transport exists", async () => {
  const hostile = stationRequest(); Object.defineProperty(hostile, "requestId", { enumerable: true, get() { throw new Error("getter"); } });
  assert.equal(validateVoyagePlayerIntent(hostile).ok, false);
  const revoked = Proxy.revocable(stationRequest(), {}); revoked.revoke();
  assert.equal(validateVoyagePlayerIntent(revoked.proxy).ok, false);
  const cyclic = focusRequest(); cyclic.payload.self = cyclic.payload;
  assert.equal(validateVoyagePlayerIntent(cyclic).ok, false);
  const rejected = await executeVoyagePlayerIntent(focusRequest(), null);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].code, "m11-cross-client-coordinator-required");
});

test("transport maps only socketlib no-GM failures to the canonical active-GM diagnostic", async () => {
  const noGm = await executeVoyagePlayerIntent(focusRequest(), { executeAsGM: async () => {
    const error = new Error("no GM"); error.name = "SocketlibNoGMConnectedError"; throw error;
  } });
  assert.equal(noGm.ok, false);
  assert.deepEqual(noGm.errors[0], {
    code: "m11-active-gm-unavailable",
    path: "transport.activeGm",
    message: "No unique active GM is available.",
    severity: "error"
  });
  const remoteFailure = await executeVoyagePlayerIntent(focusRequest(), { executeAsGM: async () => { throw new Error("handler failed"); } });
  assert.equal(remoteFailure.ok, false);
  assert.equal(remoteFailure.errors[0].code, "m11-cross-client-coordinator-required");
  assert.equal(remoteFailure.errors[0].path, "transport.coordinator");
});

test("transport rejects a GM RPC result containing live or internal session data", async () => {
  let handler;
  const socket = {
    register(_name, callback) { handler = callback; },
    async executeAsGM(_name, request) {
      return handler.call({ socketdata: { userId: "player-a" } }, request);
    }
  };
  assert.equal(registerVoyageGmCommandTransport({
    socketlib: { registerModule: () => socket },
    onIntent: async () => ({
      ok: true, requestId: "focus-1", sessionId: "session-1", status: "station-resolution", revision: 6,
      authorityEpoch: 0, projection: null, events: [], errors: [], warnings: [],
      journal: { id: "Journal.live" }, processedRequests: [], auditHistory: [], encounterState: {}
    })
  }), true);
  const result = await executeVoyagePlayerIntent(focusRequest(), socket);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "m11-cross-client-coordinator-required");
  assert.equal(result.projection, null);
  assert.deepEqual(result.events, []);
});
