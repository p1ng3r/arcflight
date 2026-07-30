import { resolveVoyagePf2ePendingCheckContext } from "./resolution-check-context.js";
import { captureVoyagePf2eResultIdentity } from "./result-identity.js";

const KEYS = [
  "resolveUuid",
  "getActorFromResolvedDocument",
  "getStatistic",
  "rollStatistic"
];

const PRESERVED_ROLL_ERROR_CODES = new Set([
  "voyage-pf2e-statistic-roll-unavailable",
  "voyage-pf2e-invalid-momentum-roll-bonus",
  "voyage-pf2e-momentum-modifier-unavailable",
  "voyage-pf2e-momentum-modifier-construction-failed"
]);

const err = (code, path, message) => ({
  code,
  path,
  message,
  severity: "error"
});

function capture(dependencies) {
  const errors = [];
  const functions = Object.create(null);

  try {
    if (
      !dependencies
      || (typeof dependencies !== "object" && typeof dependencies !== "function")
    ) {
      throw new Error("Invalid dependencies.");
    }

    for (const key of KEYS) {
      let own;
      let value;

      try {
        own = Object.hasOwn(dependencies, key);
      } catch {
        throw new Error("Dependency ownness could not be inspected.");
      }

      if (!own) {
        errors.push(err(
          "voyage-pf2e-invalid-execution-dependencies",
          `dependencies.${key}`,
          `${key} must be an own function.`
        ));
        continue;
      }

      try {
        value = dependencies[key];
      } catch {
        errors.push(err(
          "voyage-pf2e-invalid-execution-dependencies",
          `dependencies.${key}`,
          `${key} could not be read safely.`
        ));
        continue;
      }

      if (typeof value !== "function") {
        errors.push(err(
          "voyage-pf2e-invalid-execution-dependencies",
          `dependencies.${key}`,
          `${key} must be an own function.`
        ));
      } else {
        functions[key] = value;
      }
    }
  } catch {
    errors.push(err(
      "voyage-pf2e-invalid-execution-dependencies",
      "dependencies",
      "Execution dependencies could not be inspected safely."
    ));
  }

  return {
    valid: errors.length === 0,
    errors,
    functions
  };
}

export function validateVoyagePf2eExecutionDependencies(dependencies) {
  const captured = capture(dependencies);
  return {
    valid: captured.valid,
    errors: captured.errors.map((entry) => ({ ...entry })),
    warnings: []
  };
}

const blocked = (pendingCheck, errors) => ({
  ok: false,
  status: "blocked",
  ...captureVoyagePf2eResultIdentity(pendingCheck),
  errors,
  warnings: []
});

function rollFailureCode(cause) {
  try {
    const code = cause && typeof cause === "object" ? cause.code : null;
    return PRESERVED_ROLL_ERROR_CODES.has(code)
      ? code
      : "voyage-pf2e-roll-failed";
  } catch {
    return "voyage-pf2e-roll-failed";
  }
}

function rollFailureMessage(code) {
  switch (code) {
    case "voyage-pf2e-statistic-roll-unavailable":
      return "PF2e statistic roll is unavailable.";
    case "voyage-pf2e-invalid-momentum-roll-bonus":
      return "Arcflight Momentum roll bonus is invalid.";
    case "voyage-pf2e-momentum-modifier-unavailable":
      return "PF2e Momentum modifier support is unavailable.";
    case "voyage-pf2e-momentum-modifier-construction-failed":
      return "PF2e Momentum modifier construction failed.";
    default:
      return "PF2e statistic roll failed.";
  }
}

export async function executeVoyagePf2ePendingCheck(pendingCheck, dependencies) {
  const captured = capture(dependencies);
  if (!captured.valid) return blocked(pendingCheck, captured.errors);

  const trusted = Object.create(null);
  for (const key of KEYS.slice(0, 3)) {
    Object.defineProperty(trusted, key, {
      value: captured.functions[key],
      enumerable: true
    });
  }

  const resolved = await resolveVoyagePf2ePendingCheckContext(
    pendingCheck,
    trusted
  );
  if (!resolved.context) return resolved.result ?? resolved;

  const ready = resolved.result;
  const parameters = {
    dc: resolved.context.dc,
    messageMode: ready.rollMode,
    skipDialog: true,
    createMessage: true,
    identifier: ready.pendingCheckId
  };

  parameters.momentumRollBonus = resolved.context.momentumRollBonus;

  let roll;
  try {
    roll = await captured.functions.rollStatistic(
      resolved.context.statistic,
      parameters
    );
  } catch (cause) {
    const code = rollFailureCode(cause);
    return {
      ...ready,
      ok: false,
      status: "blocked",
      errors: [err(code, "statistic.roll", rollFailureMessage(code))],
      warnings: []
    };
  }

  if (roll == null) {
    return {
      ...ready,
      ok: false,
      status: "blocked",
      errors: [err(
        "voyage-pf2e-roll-cancelled",
        "statistic.roll",
        "PF2e statistic roll was cancelled."
      )],
      warnings: []
    };
  }

  let total;
  let degreeOfSuccess;

  try {
    if (typeof roll !== "object" && typeof roll !== "function") {
      throw new Error("Invalid roll.");
    }

    total = roll.total;
    degreeOfSuccess = roll.degreeOfSuccess;
  } catch {
    return {
      ...ready,
      ok: false,
      status: "blocked",
      errors: [err(
        "voyage-pf2e-invalid-roll-result",
        "roll",
        "PF2e roll result is invalid."
      )],
      warnings: []
    };
  }

  if (
    !Number.isFinite(total)
    || !Number.isSafeInteger(degreeOfSuccess)
    || degreeOfSuccess < 0
    || degreeOfSuccess > 3
  ) {
    return {
      ...ready,
      ok: false,
      status: "blocked",
      errors: [err(
        "voyage-pf2e-invalid-roll-result",
        "roll",
        "PF2e roll total or degree is invalid."
      )],
      warnings: []
    };
  }

  return {
    ...ready,
    ok: true,
    status: "rolled",
    result: {
      total,
      degreeOfSuccess,
      degreeOfSuccessSlug: [
        "critical-failure",
        "failure",
        "success",
        "critical-success"
      ][degreeOfSuccess]
    },
    errors: [],
    warnings: []
  };
}
