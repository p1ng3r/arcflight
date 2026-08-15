const RPC_NAME = "arcflightVoyagePlayerIntent";
const PLAYER_INTENT_KINDS = Object.freeze(["resolve-station", "focus-reaction-use", "focus-reaction-pass"]);
const REQUEST_ROOT_FIELDS = Object.freeze(["kind", "requestId", "sessionId", "expectedRevision", "authorityEpoch"]);
const COMMAND_ROOT_FIELDS = Object.freeze([...REQUEST_ROOT_FIELDS, "commandKind", "payload"]);
const ALLOWED_COMMANDS = new Set(["resolve-station", "focus-reaction-use", "focus-reaction-pass"]);
const RESPONSE_FIELDS = Object.freeze(["ok", "requestId", "sessionId", "status", "revision", "authorityEpoch", "projection", "events", "errors", "warnings"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function nonBlank(value) { return typeof value === "string" && value.trim().length > 0; }

function capture(value, seen = new WeakMap(), active = new WeakSet()) {
  try { return captureUnsafe(value, seen, active); } catch { return { ok: false, value: null }; }
}

function captureUnsafe(value, seen = new WeakMap(), active = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") return { ok: Number.isFinite(value), value };
  if (typeof value !== "object") return { ok: false, value: null };
  if (active.has(value)) return { ok: false, value: null };
  if (seen.has(value)) return { ok: true, value: seen.get(value) };
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array && prototype !== Array.prototype) return { ok: false, value: null };
  if (!array && prototype !== Object.prototype && prototype !== null) return { ok: false, value: null };
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || UNSAFE_KEYS.has(key))) return { ok: false, value: null };
  if (array && (!keys.includes("length") || keys.length !== value.length + 1)) return { ok: false, value: null };
  const output = array ? [] : {};
  seen.set(value, output); active.add(value);
  try {
    let arrayIndex = 0;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (array && key === "length") continue;
      if (array && key !== String(arrayIndex)) return { ok: false, value: null };
      arrayIndex += 1;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, value: null };
      const child = capture(descriptor.value, seen, active);
      if (!child.ok) return { ok: false, value: null };
      Object.defineProperty(output, key, { value: child.value, enumerable: true, writable: true, configurable: true });
    }
    return { ok: true, value: output };
  } catch { return { ok: false, value: null }; }
  finally { active.delete(value); }
}

function failure(code = "m11-command-payload-invalid", path = "transport.request", identities = {}) {
  const messages = {
    "m11-cross-client-coordinator-required": "A trusted cross-client mutation coordinator is required.",
    "m11-active-gm-unavailable": "No unique active GM is available.",
    "m11-authentication-required": "Authenticated transport user is required.",
    "m11-command-payload-invalid": "Command payload is invalid."
  };
  return Object.freeze({ ok: false, requestId: identities.requestId ?? null, sessionId: identities.sessionId ?? null, status: "failed", revision: null, authorityEpoch: null, projection: null, events: [], errors: [{ code, path, message: messages[code] ?? "Command payload is invalid.", severity: "error" }], warnings: [] });
}

function noActiveGmTransportError(error) {
  return error?.name === "SocketlibNoGMConnectedError";
}

function isolatedResult(result, identities = {}) {
  const captured = capture(result);
  if (!captured.ok || !captured.value || typeof captured.value !== "object" || !exactKeys(captured.value, RESPONSE_FIELDS)
    || captured.value.projection !== null || !Array.isArray(captured.value.events) || !Array.isArray(captured.value.errors) || !Array.isArray(captured.value.warnings)) {
    return failure("m11-cross-client-coordinator-required", "transport.coordinator", identities);
  }
  return captured.value;
}

function exactKeys(value, keys) {
  return value && Object.keys(value).length === keys.length && keys.every((key, index) => Object.keys(value)[index] === key);
}

export function validateVoyagePlayerIntent(request) {
  const captured = capture(request);
  if (!captured.ok || !captured.value || Array.isArray(captured.value)) return { ok: false, result: failure() };
  const value = captured.value;
  if (!nonBlank(value.requestId) || !nonBlank(value.sessionId) || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 || !Number.isSafeInteger(value.authorityEpoch) || value.authorityEpoch < 0) return { ok: false, result: failure() };
  if (value.kind === "voyage.m12-resolve-station") {
    if (!exactKeys(value, REQUEST_ROOT_FIELDS) || value.expectedRevision < 0 || value.authorityEpoch < 0) return { ok: false, result: failure() };
    return { ok: true, value, intentKind: "resolve-station" };
  }
  if (value.kind !== "voyage.m11-command" || !exactKeys(value, COMMAND_ROOT_FIELDS) || !ALLOWED_COMMANDS.has(value.commandKind) || !value.payload || typeof value.payload !== "object" || Array.isArray(value.payload)) return { ok: false, result: failure() };
  if (value.commandKind === "resolve-station" || Object.keys(value.payload).length !== 1 || Object.keys(value.payload)[0] !== "reactionId" || !nonBlank(value.payload.reactionId)) return { ok: false, result: failure() };
  return { ok: true, value, intentKind: value.commandKind };
}

let registeredSocket = null;
let registeredHandler = null;

export function registerVoyageGmCommandTransport({ socketlib = globalThis.socketlib, onIntent } = {}) {
  try {
    if (!socketlib || typeof socketlib.registerModule !== "function" || typeof onIntent !== "function") return false;
    const socket = socketlib.registerModule("arcflight");
    if (!socket || typeof socket.register !== "function") return false;
    const handler = async function arcflightVoyagePlayerIntent(request) {
      const senderId = this?.socketdata?.userId;
      if (!nonBlank(senderId)) return failure("m11-authentication-required", "transport.user");
      const validated = validateVoyagePlayerIntent(request);
      if (!validated.ok) return validated.result;
      const identities = { requestId: validated.value.requestId, sessionId: validated.value.sessionId };
      try { return isolatedResult(await onIntent(validated.value, { originatingUserId: senderId, transport: "socketlib" }), identities); }
      catch { return failure("m11-cross-client-coordinator-required", "transport.coordinator", identities); }
    };
    socket.register(RPC_NAME, handler);
    registeredSocket = socket; registeredHandler = handler;
    return true;
  } catch { return false; }
}

export async function executeVoyagePlayerIntent(request, socket = registeredSocket) {
  const validated = validateVoyagePlayerIntent(request);
  if (!validated.ok) return validated.result;
  if (!socket || typeof socket.executeAsGM !== "function") return failure("m11-cross-client-coordinator-required", "transport.coordinator");
  const identities = { requestId: validated.value.requestId, sessionId: validated.value.sessionId };
  try { return isolatedResult(await socket.executeAsGM(RPC_NAME, validated.value), identities); }
  catch (error) {
    return noActiveGmTransportError(error)
      ? failure("m11-active-gm-unavailable", "transport.activeGm", identities)
      : failure("m11-cross-client-coordinator-required", "transport.coordinator", identities);
  }
}

export function voyagePlayerIntentTransportState() {
  return { registered: registeredSocket !== null, handler: registeredHandler, rpcName: RPC_NAME, allowedCommands: [...PLAYER_INTENT_KINDS] };
}

export { RPC_NAME as VOYAGE_PLAYER_INTENT_RPC, PLAYER_INTENT_KINDS };
