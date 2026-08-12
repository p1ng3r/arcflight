const SOCKET_CHANNEL = "module.arcflight";
const CLAIM_KIND = "arcflight.session-mutation-claim";
const RELEASE_KIND = "arcflight.session-mutation-release";
const CLAIM_WINDOW_MS = 60;
const CLAIM_TTL_MS = 5000;
const installedSockets = new WeakSet();
const coordinators = new WeakMap();

function nonBlank(value) { return typeof value === "string" && value.trim().length > 0; }
function connectionId(game) { return game?.socket?.id; }
function claimId(game) { return globalThis.crypto?.randomUUID?.() ?? game?.foundry?.utils?.randomID?.() ?? globalThis.foundry?.utils?.randomID?.() ?? null; }
function serverTimestamp(game) {
  const serverTime = game?.time?.serverTime;
  if (!Number.isFinite(serverTime)) return null;
  try { return new Date(serverTime).toISOString(); } catch { return null; }
}
function validDescriptor(descriptor) {
  return descriptor && typeof descriptor === "object" && !Array.isArray(descriptor)
    && Object.keys(descriptor).length === 7
    && Object.keys(descriptor).every((key, index) => key === ["sessionId", "sessionDocumentId", "expectedRevision", "expectedAuthorityEpoch", "authenticatedUserId", "connectionId", "activeGmUserId"][index])
    && nonBlank(descriptor.sessionId) && nonBlank(descriptor.sessionDocumentId)
    && Number.isSafeInteger(descriptor.expectedRevision) && descriptor.expectedRevision >= 0
    && Number.isSafeInteger(descriptor.expectedAuthorityEpoch) && descriptor.expectedAuthorityEpoch >= 0
    && nonBlank(descriptor.authenticatedUserId) && nonBlank(descriptor.connectionId) && nonBlank(descriptor.activeGmUserId);
}
function uniqueActiveGm(game, userId) {
  try {
    const users = game?.users;
    const entries = Array.isArray(users) ? users : users?.contents ?? Array.from(users ?? []);
    const active = entries.filter((user) => user?.isGM === true && user?.active === true);
    return active.length === 1 && active[0].id === userId && game?.user?.id === userId && game.user.isGM === true && game.user.active === true;
  } catch { return false; }
}
function installSocket(game, state) {
  const socket = game?.socket;
  if (!socket || typeof socket.on !== "function" || typeof socket.emit !== "function") return false;
  if (installedSockets.has(socket)) return true;
  try {
    socket.on(SOCKET_CHANNEL, (message) => {
      try {
        if (!message || typeof message !== "object" || message.sessionId === undefined || typeof message.connectionId !== "string" || typeof message.claimId !== "string") return;
        if (message.kind === CLAIM_KIND) {
          const claims = state.claims.get(message.sessionId) ?? new Map();
          const claim = { connectionId: message.connectionId, claimId: message.claimId, descriptor: message.descriptor };
          claims.set(message.connectionId, claim);
          state.claims.set(message.sessionId, claims);
          const timer = setTimeout(() => { if (claims.get(message.connectionId)?.claimId === message.claimId) claims.delete(message.connectionId); }, CLAIM_TTL_MS);
          timer.unref?.();
        } else if (message.kind === RELEASE_KIND) {
          if (state.claims.get(message.sessionId)?.get(message.connectionId)?.claimId === message.claimId) state.claims.get(message.sessionId)?.delete(message.connectionId);
          if (state.claims.get(message.sessionId)?.size === 0) state.claims.delete(message.sessionId);
        }
      } catch { /* hostile socket payloads are ignored */ }
    });
    installedSockets.add(socket);
    return true;
  } catch { return false; }
}
function stateFor(game) {
  let state = coordinators.get(game);
  if (!state) {
    state = { claims: new Map(), localLocks: new Set() };
    coordinators.set(game, state);
  }
  return state;
}
function waitForClaims() { return new Promise((resolve) => setTimeout(resolve, CLAIM_WINDOW_MS)); }

export function getFoundrySessionMutationCoordinator(game = globalThis.game) {
  if (!game || (typeof game !== "object" && typeof game !== "function")) return null;
  const state = stateFor(game);
  if (!installSocket(game, state)) return null;
  return async function runExclusiveFoundrySessionMutation(descriptor, callback) {
    const id = connectionId(game);
    const currentClaimId = claimId(game);
    if (!validDescriptor(descriptor) || typeof callback !== "function" || !nonBlank(id) || !nonBlank(currentClaimId) || descriptor.connectionId !== id || !uniqueActiveGm(game, descriptor.authenticatedUserId)) return null;
    if (state.localLocks.has(descriptor.sessionId)) return null;
    const claims = state.claims.get(descriptor.sessionId) ?? new Map();
    const ownClaim = { connectionId: id, claimId: currentClaimId, descriptor: structuredClone(descriptor) };
    claims.set(id, ownClaim);
    state.claims.set(descriptor.sessionId, claims);
    const timer = setTimeout(() => { if (claims.get(id) === ownClaim) claims.delete(id); }, CLAIM_TTL_MS);
    timer.unref?.();
    try {
      game.socket.emit(SOCKET_CHANNEL, { kind: CLAIM_KIND, sessionId: descriptor.sessionId, connectionId: id, claimId: currentClaimId, descriptor: structuredClone(descriptor) });
      await waitForClaims();
      const contenders = [...(state.claims.get(descriptor.sessionId)?.values() ?? [])].filter((claim) => claim?.descriptor?.sessionId === descriptor.sessionId);
      const winner = contenders.map((claim) => claim.connectionId).filter(nonBlank).sort()[0];
      if (winner !== id || state.localLocks.has(descriptor.sessionId)) return null;
      state.localLocks.add(descriptor.sessionId);
      const occurredAt = serverTimestamp(game);
      if (!occurredAt) return await callback(Object.freeze({ connectionId: id, occurredAt: null }));
      return await callback(Object.freeze({ connectionId: id, occurredAt }));
    } finally {
      state.localLocks.delete(descriptor.sessionId);
      if (state.claims.get(descriptor.sessionId)?.get(id)?.claimId === currentClaimId) state.claims.get(descriptor.sessionId)?.delete(id);
      if (state.claims.get(descriptor.sessionId)?.size === 0) state.claims.delete(descriptor.sessionId);
      try { game.socket.emit(SOCKET_CHANNEL, { kind: RELEASE_KIND, sessionId: descriptor.sessionId, connectionId: id, claimId: currentClaimId }); } catch { /* release is best effort */ }
    }
  };
}

export const FOUNDRY_SESSION_COORDINATOR_CHANNEL = SOCKET_CHANNEL;
