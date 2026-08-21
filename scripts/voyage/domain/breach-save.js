import { analyzeVoyageEncounterPressureBreachPlan } from "./pressure-breach.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const VALID_DEGREES = new Set(["critical-success", "success", "failure", "critical-failure"]);
const DEFAULT_BREACH_DC = 18;
const PENDING_KIND = "voyage-breach-save-pending";
const PENDING_FIELDS = Object.freeze([
  "kind", "saveId", "encounterId", "roundId", "roundNumber", "systemId",
  "currentPressure", "capacity", "incomingPressure", "breachSaveModifier",
  "breachDC", "originatingEffectId", "pressureBreachId", "pressureBreach", "status",
  "resolvedDegree"
]);

function issue(code, path, message) { return { code, path, message, severity: "error" }; }
function report(extra = {}) { return { ok: false, errors: [], warnings: [], ...extra }; }
function safeInteger(value) { return typeof value === "number" && Number.isSafeInteger(value); }
function positiveFinite(value) { return typeof value === "number" && Number.isFinite(value) && value > 0; }
function nonBlank(value) { return typeof value === "string" && value.trim().length > 0; }
function exactKeys(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((field, index) => keys[index] === field);
}
function capture(value, path = "$", ancestors = new Set()) {
  try {
    if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
    if (typeof value === "number") return Number.isFinite(value) ? { ok: true, value } : { ok: false, path };
    if (typeof value !== "object" || ancestors.has(value)) return { ok: false, path };
    const prototype = Object.getPrototypeOf(value);
    const array = Array.isArray(value);
    if (array ? prototype !== Array.prototype : (prototype !== Object.prototype && prototype !== null)) return { ok: false, path };
    const keys = Reflect.ownKeys(value);
    ancestors.add(value);
    try {
      if (array) {
        const length = Object.getOwnPropertyDescriptor(value, "length");
        if (!length || !Object.hasOwn(length, "value") || !safeInteger(length.value) || length.value < 0 || keys.length !== length.value + 1) return { ok: false, path };
        const result = [];
        for (let index = 0; index < length.value; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, path: path + "[" + index + "]" };
          const child = capture(descriptor.value, path + "[" + index + "]", ancestors);
          if (!child.ok) return child;
          result.push(child.value);
        }
        return { ok: true, value: result };
      }
      const result = {};
      for (const key of keys) {
        if (typeof key !== "string" || UNSAFE_KEYS.has(key)) return { ok: false, path: path + "." + String(key) };
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, path: path + "." + key };
        const child = capture(descriptor.value, path + "." + key, ancestors);
        if (!child.ok) return child;
        result[key] = child.value;
      }
      return { ok: true, value: result };
    } finally { ancestors.delete(value); }
  } catch { return { ok: false, path }; }
}
function clone(value) { const captured = capture(value); return captured.ok ? captured.value : null; }
function fail(code, path, message) { return report({ errors: [issue(code, path, message)] }); }

function authoredDcValues(definition) {
  const result = [];
  const rounds = Array.isArray(definition?.rounds) ? definition.rounds : [];
  for (const round of rounds) {
    for (const station of (Array.isArray(round?.availableStations) ? round.availableStations : [])) {
      for (const action of (Array.isArray(station?.actions) ? station.actions : [])) {
        const value = action?.check?.dcSource?.value;
        if (positiveFinite(value)) result.push(value);
      }
    }
  }
  return result;
}

export function validateVoyageBreachDc(value, { allowMissing = true } = {}) {
  if (value === undefined && allowMissing) return { valid: true, value: undefined, errors: [] };
  if (!positiveFinite(value)) return { valid: false, value: null, errors: [issue("invalid-breach-dc", "breachDC", "Event breachDC must be a positive finite number.")] };
  return { valid: true, value, errors: [] };
}

export function resolveVoyageEventBreachDc(eventDefinition = {}) {
  const captured = capture(eventDefinition);
  if (!captured.ok) return { ok: false, value: null, errors: [issue("event-definition-read-failed", "eventDefinition", "Event Definition data could not be read safely.")] };
  const authored = validateVoyageBreachDc(captured.value?.breachDC);
  if (!authored.valid) return { ok: false, value: null, errors: authored.errors };
  if (authored.value !== undefined) return { ok: true, value: authored.value, source: "authored", errors: [] };
  const values = authoredDcValues(captured.value);
  const fallback = values.length > 0 ? Math.min(...values) : DEFAULT_BREACH_DC;
  return { ok: true, value: fallback, source: values.length > 0 ? "authored-action-base-dc-fallback" : "deterministic-default", errors: [] };
}

function validatePending(value) {
  if (!exactKeys(value, PENDING_FIELDS) || value.kind !== PENDING_KIND || !nonBlank(value.saveId) || !nonBlank(value.encounterId) || !nonBlank(value.roundId)
    || !safeInteger(value.roundNumber) || value.roundNumber < 0 || !nonBlank(value.systemId) || !safeInteger(value.currentPressure) || value.currentPressure < 0
    || !safeInteger(value.capacity) || value.capacity < 0 || value.currentPressure > value.capacity || !safeInteger(value.incomingPressure) || value.incomingPressure <= 0
    || !safeInteger(value.breachSaveModifier) || !positiveFinite(value.breachDC) || !nonBlank(value.pressureBreachId) || !nonBlank(value.originatingEffectId)
    || !["pending", "resolved"].includes(value.status) || (value.status === "pending" && value.resolvedDegree !== null)
    || (value.status === "resolved" && !VALID_DEGREES.has(value.resolvedDegree)) || !value.pressureBreach || typeof value.pressureBreach !== "object") return false;
  return value.pressureBreach.pressureBreachId === value.pressureBreachId && value.pressureBreach.pressureSystemId === value.systemId
    && value.pressureBreach.previousValue === value.currentPressure && value.pressureBreach.attemptedDelta === value.incomingPressure;
}

export function createVoyageBreachSavePending({ encounterId, roundId, roundNumber, breach, breachSaveModifier, breachDC, originatingEffectId = breach?.pressureEffectId ?? "" } = {}) {
  const breachCapture = capture(breach);
  if (!breachCapture.ok || !nonBlank(encounterId) || !nonBlank(roundId) || !safeInteger(roundNumber) || roundNumber < 0 || !safeInteger(breachSaveModifier)
    || !positiveFinite(breachDC) || !breachCapture.value || !nonBlank(breachCapture.value.pressureBreachId) || !nonBlank(breachCapture.value.pressureSystemId)
    || !safeInteger(breachCapture.value.previousValue) || !safeInteger(breachCapture.value.capacity) || !safeInteger(breachCapture.value.attemptedDelta) || breachCapture.value.attemptedDelta <= 0 || !nonBlank(originatingEffectId)) return null;
  const pending = {
    kind: PENDING_KIND,
    saveId: "arcflight-breach-save:" + JSON.stringify([encounterId, roundId, roundNumber, breachCapture.value.pressureBreachId]),
    encounterId,
    roundId,
    roundNumber,
    systemId: breachCapture.value.pressureSystemId,
    currentPressure: breachCapture.value.previousValue,
    capacity: breachCapture.value.capacity,
    incomingPressure: breachCapture.value.attemptedDelta,
    breachSaveModifier,
    breachDC,
    originatingEffectId,
    pressureBreachId: breachCapture.value.pressureBreachId,
    pressureBreach: breachCapture.value,
    status: "pending",
    resolvedDegree: null
  };
  return Object.freeze(pending);
}

export function validateVoyageBreachSavePending(value) { const captured = capture(value); return { valid: captured.ok && validatePending(captured.value), value: captured.ok ? captured.value : null, errors: captured.ok && validatePending(captured.value) ? [] : [issue("invalid-breach-save-pending", "pendingBreachSave", "Pending Breach Save evidence is invalid.")] }; }

export function analyzeVoyageEncounterBreachSavePlan(state, { eventDefinition = {}, roundId = "", roundNumber = state?.roundNumber, breachSaveModifier = state?.breachSaveModifier, originatingEffectId } = {}) {
  try {
    const pressurePlan = analyzeVoyageEncounterPressureBreachPlan(state);
    if (!pressurePlan.readyForPressureBreachPlanning) return { ok: false, ready: false, requiresBreachSave: false, pending: null, pressureBreachPlan: null, errors: pressurePlan.errors, warnings: pressurePlan.warnings };
    if (!pressurePlan.breachRequired || !pressurePlan.breach) return { ok: true, ready: true, requiresBreachSave: false, pending: null, pressureBreachPlan: pressurePlan, errors: [], warnings: pressurePlan.warnings };
    const dc = resolveVoyageEventBreachDc(eventDefinition);
    if (!dc.ok) return { ok: false, ready: false, requiresBreachSave: false, pending: null, pressureBreachPlan: pressurePlan, errors: dc.errors, warnings: pressurePlan.warnings };
    const pending = createVoyageBreachSavePending({ encounterId: state?.encounterId, roundId: nonBlank(roundId) ? roundId : "round-" + String(roundNumber), roundNumber, breach: pressurePlan.breach, breachSaveModifier, breachDC: dc.value, originatingEffectId });
    if (!pending) return { ok: false, ready: false, requiresBreachSave: false, pending: null, pressureBreachPlan: pressurePlan, errors: [issue("invalid-breach-save-pending", "pendingBreachSave", "Threatened Breach could not be represented safely.")], warnings: pressurePlan.warnings };
    return { ok: true, ready: true, requiresBreachSave: true, pending, pressureBreachPlan: pressurePlan, errors: [], warnings: pressurePlan.warnings };
  } catch { return { ok: false, ready: false, requiresBreachSave: false, pending: null, pressureBreachPlan: null, errors: [issue("breach-save-plan-failed", "state", "Breach Save planning failed safely.")], warnings: [] }; }
}

export function resolveVoyageBreachSave(pending, degree, { expectedSystemId, expectedRoundId, pressureBreachResult = null } = {}) {
  const validation = validateVoyageBreachSavePending(pending);
  if (!validation.valid) return fail("invalid-breach-save-pending", "pendingBreachSave", "Pending Breach Save evidence is invalid.");
  const value = validation.value;
  if (!VALID_DEGREES.has(degree)) return fail("invalid-breach-save-degree", "degree", "Breach Save degree is not recognized.");
  if (expectedSystemId !== undefined && expectedSystemId !== value.systemId) return fail("breach-save-system-mismatch", "systemId", "Breach Save system identity does not match.");
  if (expectedRoundId !== undefined && expectedRoundId !== value.roundId) return fail("breach-save-round-mismatch", "roundId", "Breach Save round identity does not match.");
  if (value.status !== "pending") return fail("breach-save-already-resolved", "pendingBreachSave.status", "Breach Save has already been resolved.");
  const nextPending = { ...value, status: "resolved", resolvedDegree: degree };
  if (degree === "critical-success" || degree === "success") {
    return { ok: true, outcome: degree === "critical-success" ? "prevented-reduced" : "prevented-held", pressureValue: degree === "critical-success" ? Math.max(0, value.currentPressure - 1) : value.currentPressure, hazard: null, voidScarProposal: null, breach: null, requiresExistingPressureBreach: false, pendingBreachSave: nextPending, errors: [], warnings: [] };
  }
  if (pressureBreachResult !== null) {
    const captured = capture(pressureBreachResult);
    if (!captured.ok || captured.value?.ok !== true || captured.value?.breach?.pressureBreachId !== value.pressureBreachId) return fail("breach-save-breach-mismatch", "pressureBreachResult", "Existing Pressure Breach result does not match the pending save.");
    return { ok: true, outcome: "breach", pressureValue: null, hazard: clone(captured.value.hazard), voidScarProposal: clone(captured.value.ordinaryScarProposal), breach: clone(captured.value.breach), requiresExistingPressureBreach: false, pressureBreachResult: captured.value, pendingBreachSave: nextPending, errors: [], warnings: [] };
  }
  return { ok: true, outcome: "breach", pressureValue: null, hazard: null, voidScarProposal: null, breach: clone(value.pressureBreach), requiresExistingPressureBreach: true, pendingBreachSave: nextPending, errors: [], warnings: [] };
}

/** Classify a real d20 Breach Save using PF2e degree and natural-face rules. */
export function classifyVoyageBreachSaveRoll({ d20, total, dc } = {}) {
  if (!safeInteger(d20) || d20 < 1 || d20 > 20 || !Number.isFinite(total) || !positiveFinite(dc)) return null;
  let degree = total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1;
  if (d20 === 20) degree = Math.min(3, degree + 1);
  if (d20 === 1) degree = Math.max(0, degree - 1);
  return { degreeOfSuccess: degree, degreeOfSuccessSlug: ["critical-failure", "failure", "success", "critical-success"][degree], d20, total, dc };
}

export { DEFAULT_BREACH_DC, PENDING_KIND as VOYAGE_BREACH_SAVE_PENDING_KIND, PENDING_FIELDS as VOYAGE_BREACH_SAVE_PENDING_FIELDS };
