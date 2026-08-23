const ERROR_MESSAGES = Object.freeze({
  authentication: "An authenticated GM is required for Event Test tooling.",
  active: "The authenticated GM must be the current active GM.",
  connection: "A trusted connected GM context is required for Event Test tooling."
});

function error(code, path, message) {
  return { code, path, message, severity: "error" };
}

function valuesFromUsers(users) {
  try {
    if (Array.isArray(users)) return [...users];
    if (Array.isArray(users?.contents)) return [...users.contents];
    if (typeof users?.values === "function") return [...users.values()];
  } catch {
    return [];
  }
  return [];
}

/**
 * Event Test is intentionally a local GM tool.  This guard is shared by
 * every method and never becomes a player transport command.
 */
export function requireEventTestAuthority(context, gameValue = globalThis.game) {
  try {
    const game = gameValue;
    const user = game?.user;
    if (!user || typeof user.id !== "string" || user.id.length === 0 || user.isGM !== true) {
      return { ok: false, error: error("m11-active-gm-required", "eventTest", ERROR_MESSAGES.authentication) };
    }
    if (context?.trustedTransportContext !== true
      || typeof context.authenticatedConnectionId !== "string"
      || context.authenticatedConnectionId.trim().length === 0) {
      return { ok: false, error: error("m11-authentication-required", "transport.connection", ERROR_MESSAGES.connection) };
    }
    const users = valuesFromUsers(context?.users ?? game?.users);
    const current = users.find((entry) => entry?.id === user.id);
    const activeGms = users.filter((entry) => entry?.isGM === true && entry?.active === true);
    const activeGmUserId = context?.activeGmUserId ?? game?.users?.activeGM?.id ?? null;
    if (!current || current.isGM !== true || current.active !== true || activeGmUserId !== user.id
      || activeGms.length !== 1 || activeGms[0]?.id !== user.id
      || context?.authenticatedUserId !== user.id) {
      return { ok: false, error: error("m11-active-gm-required", "transport.activeGm", ERROR_MESSAGES.active) };
    }
    return { ok: true, userId: user.id, activeGmUserId: user.id };
  } catch {
    return { ok: false, error: error("m11-active-gm-required", "eventTest", ERROR_MESSAGES.authentication) };
  }
}

export function eventTestFailure(errorValue, identities = {}) {
  return {
    ok: false,
    requestId: identities.requestId ?? null,
    sessionId: identities.sessionId ?? null,
    status: "failed",
    revision: null,
    authorityEpoch: null,
    projection: null,
    events: [],
    errors: [errorValue],
    warnings: []
  };
}
