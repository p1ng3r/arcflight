import { captureVoyageShipState, validateVoyageShipState } from "./ship-state.js";
import { captureVoyageVoidScarPlainData } from "./void-scar-schema.js";

const REQUEST_FIELDS = Object.freeze([
  "shipId",
  "expectedShipRevision",
  "voidScarId",
  "existingVoidScarIndex",
  "previousVoidScar",
  "repairMethod",
  "outcome",
  "facilityApproval",
  "fieldRepairResourceId",
  "fieldRepairResourceApproval"
]);

const FACILITY_APPROVAL_FIELDS = Object.freeze(["approved", "facilityId", "facilityTag"]);
const RESOURCE_APPROVAL_FIELDS = Object.freeze(["approved", "fieldRepairResourceId", "compatibilityTag"]);
const REPAIR_METHODS = new Set(["dock-repair", "field-repair-resource"]);
const DOCK_OUTCOMES = new Map([
  ["critical-success", { costPercent: 50, timePercent: 50 }],
  ["success", { costPercent: 75, timePercent: 75 }],
  ["failure", { costPercent: 125, timePercent: 125 }],
  ["critical-failure", { costPercent: 150, timePercent: 150 }]
]);
const REPAIR_EVENT_TYPE = "voyage.void-scar-repaired";

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function isNonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeRevision(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function exactKeys(value, fields, path, errors, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(issue(code, path, "Value must be a plain object."));
    return false;
  }
  const keys = Object.keys(value);
  const expected = new Set(fields);
  for (const key of keys) {
    if (!expected.has(key)) errors.push(issue(code, `${path}.${key}`, "Object contains an unexpected field."));
  }
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) errors.push(issue(code, `${path}.${field}`, "Object requires this field."));
  }
  if (keys.length === fields.length && keys.some((key, index) => key !== fields[index])) {
    errors.push(issue(code, path, "Object fields must use the canonical order."));
  }
  return errors.length === 0;
}

function captureRequest(request) {
  const captured = captureVoyageVoidScarPlainData(request, "request");
  const errors = [...captured.errors];
  if (errors.length === 0) exactKeys(captured.value, REQUEST_FIELDS, "request", errors, "invalid-void-scar-repair-request");
  if (errors.length > 0) return { ok: false, value: null, errors };

  const value = captured.value;
  if (!isNonBlankString(value.shipId)) errors.push(issue("invalid-void-scar-repair-ship-id", "request.shipId", "shipId must be a non-blank exact string."));
  if (!isSafeRevision(value.expectedShipRevision)) errors.push(issue("invalid-void-scar-repair-ship-revision", "request.expectedShipRevision", "expectedShipRevision must be a non-negative safe integer."));
  if (!isNonBlankString(value.voidScarId)) errors.push(issue("invalid-void-scar-repair-void-scar-id", "request.voidScarId", "voidScarId must be a non-blank exact string."));
  if (!Number.isSafeInteger(value.existingVoidScarIndex) || value.existingVoidScarIndex < 0) errors.push(issue("invalid-void-scar-repair-index", "request.existingVoidScarIndex", "existingVoidScarIndex must be a non-negative safe integer."));
  return { ok: errors.length === 0, value, errors };
}

function validateApproval(value, fields, path, code, errors) {
  const before = errors.length;
  if (!exactKeys(value, fields, path, errors, code)) return false;
  if (value.approved !== true) errors.push(issue(code, `${path}.approved`, "approved must be the literal boolean true."));
  if (!isNonBlankString(value.facilityId ?? value.fieldRepairResourceId)) {
    errors.push(issue(code, `${path}.${fields[1]}`, "Identifier must be a non-blank exact string."));
  }
  const tagField = fields[2];
  if (!isNonBlankString(value[tagField])) errors.push(issue(code, `${path}.${tagField}`, "Tag must be a non-blank exact string."));
  return errors.length === before;
}

function repairResult(values = {}) {
  return {
    readyForVoidScarRepair: values.readyForVoidScarRepair === true,
    shipId: values.shipId ?? null,
    voidScarId: values.voidScarId ?? null,
    repairMethod: values.repairMethod ?? null,
    outcome: values.outcome ?? null,
    costPercent: values.costPercent ?? null,
    timePercent: values.timePercent ?? null,
    removesScar: values.removesScar ?? null,
    errors: (values.errors ?? []).map((error) => ({ ...error })),
    warnings: (values.warnings ?? []).map((warning) => ({ ...warning }))
  };
}

function applicationFailure(errors = [], warnings = []) {
  return {
    ok: false,
    nextState: null,
    events: [],
    errors: errors.map((error) => ({ ...error })),
    warnings: warnings.map((warning) => ({ ...warning }))
  };
}

function mapShipErrors(errors) {
  return errors.map((error) => ({ ...error, path: `shipState${error.path === "$" ? "" : error.path.slice(1)}` }));
}

function sameSnapshot(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateDockApproval(approval, scar, errors) {
  if (!validateApproval(approval, FACILITY_APPROVAL_FIELDS, "request.facilityApproval", "invalid-repair-facility-approval", errors)) return;
  if (!scar.requiredFacilities.includes(approval.facilityTag)) {
    errors.push(issue("unsuitable-repair-facility", "request.facilityApproval.facilityTag", "facilityTag is not authored by the live Scar."));
  }
}

function validateResourceApproval(approval, resourceId, scar, errors) {
  if (!validateApproval(approval, RESOURCE_APPROVAL_FIELDS, "request.fieldRepairResourceApproval", "invalid-field-repair-resource-approval", errors)) return;
  if (approval.fieldRepairResourceId !== resourceId) {
    errors.push(issue("field-repair-resource-approval-mismatch", "request.fieldRepairResourceApproval.fieldRepairResourceId", "Approval resource ID must match the request resource ID."));
  }
  if (!scar.compatibleFieldRepairTags.includes(approval.compatibilityTag)) {
    errors.push(issue("incompatible-field-repair-resource", "request.fieldRepairResourceApproval.compatibilityTag", "compatibilityTag is not authored by the live Scar."));
  }
}

function captureRepairInputs(shipState, request) {
  return {
    shipCapture: captureVoyageShipState(shipState),
    parsedRequest: captureRequest(request)
  };
}

function analyzeCapturedRepair({ shipCapture, parsedRequest }) {
  if (!shipCapture.ok) return repairResult({ errors: mapShipErrors(shipCapture.errors), warnings: shipCapture.warnings });
  if (!parsedRequest.ok) return repairResult({ errors: parsedRequest.errors });

  const ship = shipCapture.state;
  const value = parsedRequest.value;
  const errors = [];

  if (value.shipId !== ship.shipId) errors.push(issue("stale-void-scar-repair-ship", "request.shipId", "Request shipId does not match the live ship."));
  if (value.expectedShipRevision !== ship.revision) errors.push(issue("stale-void-scar-repair-ship-revision", "request.expectedShipRevision", "Ship revision is stale."));
  if (errors.length > 0) return repairResult({ errors });

  const index = value.existingVoidScarIndex;
  if (index >= ship.voidScars.length) {
    errors.push(issue("stale-void-scar-repair-index", "request.existingVoidScarIndex", "existingVoidScarIndex does not identify a live Scar."));
    return repairResult({ errors });
  }

  const liveScar = ship.voidScars[index];
  if (liveScar.voidScarId !== value.voidScarId) {
    errors.push(issue("stale-void-scar-repair-void-scar-id", "request.voidScarId", "voidScarId does not match the live Scar at the requested index."));
    return repairResult({ errors });
  }
  if (!sameSnapshot(value.previousVoidScar, liveScar)) {
    errors.push(issue("stale-void-scar-repair-previous-void-scar", "request.previousVoidScar", "previousVoidScar does not match the live Scar snapshot."));
    return repairResult({ errors });
  }

  if (!REPAIR_METHODS.has(value.repairMethod)) {
    errors.push(issue("invalid-void-scar-repair-method", "request.repairMethod", "repairMethod must be dock-repair or field-repair-resource."));
    return repairResult({ errors });
  }

  if (value.repairMethod === "dock-repair") {
    if (value.fieldRepairResourceId !== null) errors.push(issue("unexpected-field-repair-resource-id", "request.fieldRepairResourceId", "Dock Repair requires fieldRepairResourceId to be null."));
    if (value.fieldRepairResourceApproval !== null) errors.push(issue("unexpected-field-repair-resource-approval", "request.fieldRepairResourceApproval", "Dock Repair requires fieldRepairResourceApproval to be null."));
    if (value.facilityApproval === null) errors.push(issue("missing-repair-facility-approval", "request.facilityApproval", "Dock Repair requires facilityApproval."));
    else validateDockApproval(value.facilityApproval, liveScar, errors);
    if (errors.length > 0) return repairResult({ errors });
    if (!DOCK_OUTCOMES.has(value.outcome)) {
      errors.push(issue("invalid-void-scar-repair-outcome", "request.outcome", "Dock Repair outcome is not canonical."));
      return repairResult({ errors });
    }
    if (!Number.isSafeInteger(ship.revision + 1)) {
      errors.push(issue("void-scar-repair-revision-overflow", "shipState.revision", "Ship revision cannot be incremented safely."));
      return repairResult({ errors });
    }
    const terms = DOCK_OUTCOMES.get(value.outcome);
    return repairResult({
      readyForVoidScarRepair: true,
      shipId: ship.shipId,
      voidScarId: liveScar.voidScarId,
      repairMethod: value.repairMethod,
      outcome: value.outcome,
      costPercent: terms.costPercent,
      timePercent: terms.timePercent,
      removesScar: true
    });
  }

  if (value.outcome !== null) errors.push(issue("invalid-void-scar-repair-outcome", "request.outcome", "Field Repair Resource requires outcome to be null."));
  if (value.facilityApproval !== null) errors.push(issue("unexpected-repair-facility-approval", "request.facilityApproval", "Field Repair Resource requires facilityApproval to be null."));
  if (value.fieldRepairResourceId === null) errors.push(issue("missing-field-repair-resource-id", "request.fieldRepairResourceId", "Field Repair Resource requires fieldRepairResourceId."));
  else if (!isNonBlankString(value.fieldRepairResourceId)) errors.push(issue("invalid-field-repair-resource-id", "request.fieldRepairResourceId", "fieldRepairResourceId must be a non-blank exact string."));
  if (value.fieldRepairResourceApproval === null) errors.push(issue("missing-field-repair-resource-approval", "request.fieldRepairResourceApproval", "Field Repair Resource requires fieldRepairResourceApproval."));
  else if (isNonBlankString(value.fieldRepairResourceId)) validateResourceApproval(value.fieldRepairResourceApproval, value.fieldRepairResourceId, liveScar, errors);
  if (errors.length > 0) return repairResult({ errors });
  if (!Number.isSafeInteger(ship.revision + 1)) {
    errors.push(issue("void-scar-repair-revision-overflow", "shipState.revision", "Ship revision cannot be incremented safely."));
    return repairResult({ errors });
  }

  return repairResult({
    readyForVoidScarRepair: true,
    shipId: ship.shipId,
    voidScarId: liveScar.voidScarId,
    repairMethod: value.repairMethod,
    outcome: null,
    costPercent: null,
    timePercent: null,
    removesScar: true
  });
}

export function analyzeVoyageVoidScarRepair(shipState, request) {
  return analyzeCapturedRepair(captureRepairInputs(shipState, request));
}

export function applyVoyageVoidScarRepair(shipState, request) {
  const inputs = captureRepairInputs(shipState, request);
  const analysis = analyzeCapturedRepair(inputs);
  if (!analysis.readyForVoidScarRepair || analysis.removesScar !== true) {
    return applicationFailure(analysis.errors, analysis.warnings);
  }

  const { shipCapture, parsedRequest } = inputs;
  if (!shipCapture.ok) return applicationFailure(shipCapture.errors, shipCapture.warnings);
  if (!parsedRequest.ok) return applicationFailure(parsedRequest.errors);

  const ship = shipCapture.state;
  const value = parsedRequest.value;
  const index = value.existingVoidScarIndex;
  if (index >= ship.voidScars.length) {
    return applicationFailure([issue("stale-void-scar-repair-index", "request.existingVoidScarIndex", "existingVoidScarIndex does not identify a live Scar.")], analysis.warnings);
  }
  const liveScar = ship.voidScars[index];
  if (liveScar.voidScarId !== value.voidScarId) {
    return applicationFailure([issue("stale-void-scar-repair-void-scar-id", "request.voidScarId", "voidScarId does not match the live Scar at the requested index.")], analysis.warnings);
  }
  if (!sameSnapshot(value.previousVoidScar, liveScar)) {
    return applicationFailure([issue("stale-void-scar-repair-previous-void-scar", "request.previousVoidScar", "previousVoidScar does not match the live Scar snapshot.")], analysis.warnings);
  }
  const previousVoidScar = structuredClone(liveScar);
  const nextStateCandidate = {
    shipId: ship.shipId,
    revision: ship.revision + 1,
    installed: { ...ship.installed },
    hull: { ...ship.hull },
    voidScars: ship.voidScars.slice(0, index).concat(ship.voidScars.slice(index + 1))
  };

  const finalValidation = validateVoyageShipState(nextStateCandidate);
  if (!finalValidation.valid) return applicationFailure(finalValidation.errors, analysis.warnings);
  const nextCapture = captureVoyageShipState(nextStateCandidate);
  if (!nextCapture.ok) return applicationFailure(nextCapture.errors, analysis.warnings);

  const event = {
    type: REPAIR_EVENT_TYPE,
    shipId: nextCapture.state.shipId,
    voidScarId: liveScar.voidScarId,
    pressureSystemId: liveScar.pressureSystemId,
    repairMethod: analysis.repairMethod,
    outcome: analysis.outcome,
    costPercent: analysis.costPercent,
    timePercent: analysis.timePercent,
    fieldRepairResourceId: analysis.repairMethod === "field-repair-resource" ? value.fieldRepairResourceId : null,
    previousShipRevision: ship.revision,
    revision: nextCapture.state.revision,
    previousVoidScar,
    previousVoidScarCount: ship.voidScars.length,
    voidScarCount: nextCapture.state.voidScars.length
  };
  const eventCapture = captureVoyageVoidScarPlainData(event, "events[0]");
  if (!eventCapture.ok) return applicationFailure(eventCapture.errors, analysis.warnings);

  return {
    ok: true,
    nextState: nextCapture.state,
    events: [eventCapture.value],
    errors: [],
    warnings: analysis.warnings.map((warning) => ({ ...warning }))
  };
}
