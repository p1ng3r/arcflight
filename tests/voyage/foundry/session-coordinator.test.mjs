import test from "node:test";
import assert from "node:assert/strict";
import { getFoundrySessionMutationCoordinator, FOUNDRY_SESSION_COORDINATOR_CHANNEL } from "../../../scripts/voyage/foundry/session-coordinator.js";

function fixture({ serverTime = 1770000000000 } = {}) {
  const listeners = [];
  const user = { id: "gm-1", isGM: true, active: true };
  const socket = { id: "connection-gm-1", on(channel, callback) { assert.equal(channel, FOUNDRY_SESSION_COORDINATOR_CHANNEL); listeners.push(callback); }, emit(channel, message) { assert.equal(channel, FOUNDRY_SESSION_COORDINATOR_CHANNEL); for (const listener of listeners) listener(structuredClone(message)); } };
  const game = { socket, time: { serverTime }, user, users: { activeGM: user, contents: [user] } };
  return { game, socket };
}
function descriptor(overrides = {}) { return { sessionId: "session-1", sessionDocumentId: "Journal.session-1", expectedRevision: 0, expectedAuthorityEpoch: 0, authenticatedUserId: "gm-1", connectionId: "connection-gm-1", activeGmUserId: "gm-1", ...overrides }; }

test("Foundry coordinator uses module socket claims and a trusted server-time witness", async () => {
  const fx = fixture(); const coordinator = getFoundrySessionMutationCoordinator(fx.game); let calls = 0; let witness = null;
  const result = await coordinator(descriptor(), async (value) => { calls += 1; witness = value; return { ok: true }; });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 1);
  assert.deepEqual(witness, { connectionId: "connection-gm-1", occurredAt: new Date(1770000000000).toISOString() });
});

test("Foundry coordinator elects one same-session winner and releases after exceptions", async () => {
  const fx = fixture(); const coordinator = getFoundrySessionMutationCoordinator(fx.game); let entered = 0;
  const contenders = await Promise.all([
    coordinator(descriptor(), async () => { entered += 1; await new Promise((resolve) => setTimeout(resolve, 20)); return { winner: true }; }),
    coordinator(descriptor(), async () => { entered += 1; return { winner: false }; })
  ]);
  assert.equal(contenders.filter(Boolean).length, 1);
  assert.equal(entered, 1);
  await assert.rejects(() => coordinator(descriptor({ sessionId: "session-throw" }), async () => { throw new Error("failed"); }));
  const retry = await coordinator(descriptor({ sessionId: "session-throw" }), async () => ({ retry: true }));
  assert.deepEqual(retry, { retry: true });
});

test("Foundry coordinator fails closed without a socket or trusted server time", async () => {
  assert.equal(getFoundrySessionMutationCoordinator({}), null);
  const fx = fixture({ serverTime: NaN }); const coordinator = getFoundrySessionMutationCoordinator(fx.game);
  await assert.rejects(() => coordinator(descriptor(), async (witness) => { assert.equal(witness.occurredAt, null); throw new Error("invalid witness"); }));
});
