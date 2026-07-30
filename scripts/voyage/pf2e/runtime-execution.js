/** Foundry runtime execution wiring. One successful call creates one PF2e chat roll. */

import {
  VOYAGE_MOMENTUM_MAX,
  VOYAGE_MOMENTUM_MIN
} from "../domain/constants.js";
import { createRuntimeDependenciesFromResolver } from "./runtime-preflight.js";
import { executeVoyagePf2ePendingCheck } from "./resolution-check-executor.js";
import { captureVoyagePf2eResultIdentity } from "./result-identity.js";

const safeRead = (object, key) => {
  try {
    return { ok: true, value: object?.[key] };
  } catch {
    return { ok: false, value: undefined };
  }
};

function blocked(value, code, path, message) {
  return {
    ok: false,
    status: "blocked",
    ...captureVoyagePf2eResultIdentity(value),
    errors: [{ code, path, message, severity: "error" }],
    warnings: []
  };
}

function runtimeFailure(code, message) {
  const failure = new Error(message);
  failure.code = code;
  return failure;
}

function createMomentumModifier(runtime, momentumRollBonus) {
  const gameRead = safeRead(runtime, "game");
  const pf2eRead = gameRead.ok
    ? safeRead(gameRead.value, "pf2e")
    : { ok: false, value: undefined };
  const modifierRead = pf2eRead.ok
    ? safeRead(pf2eRead.value, "Modifier")
    : { ok: false, value: undefined };

  if (!modifierRead.ok || typeof modifierRead.value !== "function") {
    throw runtimeFailure(
      "voyage-pf2e-momentum-modifier-unavailable",
      "PF2e Modifier constructor is unavailable."
    );
  }

  try {
    return new modifierRead.value({
      slug: "arcflight-momentum",
      label: "Arcflight Momentum",
      modifier: momentumRollBonus,
      type: "untyped"
    });
  } catch {
    throw runtimeFailure(
      "voyage-pf2e-momentum-modifier-construction-failed",
      "PF2e Momentum modifier could not be constructed."
    );
  }
}

function preparePf2eRollParameters(runtime, parameters) {
  let ownsMomentum;

  try {
    ownsMomentum = Object.hasOwn(parameters, "momentumRollBonus");
  } catch {
    throw runtimeFailure(
      "voyage-pf2e-invalid-momentum-roll-bonus",
      "Momentum roll bonus could not be inspected safely."
    );
  }

  if (!ownsMomentum) return parameters;

  const momentumRead = safeRead(parameters, "momentumRollBonus");
  const momentumRollBonus = momentumRead.value;

  if (
    !momentumRead.ok
    || !Number.isSafeInteger(momentumRollBonus)
    || momentumRollBonus < VOYAGE_MOMENTUM_MIN
    || momentumRollBonus > VOYAGE_MOMENTUM_MAX
  ) {
    throw runtimeFailure(
      "voyage-pf2e-invalid-momentum-roll-bonus",
      "Momentum roll bonus must be a safe integer from 0 through 3."
    );
  }

  const supplied = { ...parameters };
  delete supplied.momentumRollBonus;

  if (momentumRollBonus === 0) return supplied;

  const modifiersRead = safeRead(parameters, "modifiers");
  const existingModifiers = modifiersRead.ok
    ? modifiersRead.value
    : undefined;

  if (
    existingModifiers !== undefined
    && !Array.isArray(existingModifiers)
  ) {
    throw runtimeFailure(
      "voyage-pf2e-invalid-momentum-roll-bonus",
      "PF2e roll modifiers must be an array."
    );
  }

  supplied.modifiers = [
    ...(existingModifiers ?? []),
    createMomentumModifier(runtime, momentumRollBonus)
  ];

  return supplied;
}

function createRollStatistic(runtime) {
  return function rollStatistic(statistic, parameters) {
    const roll = safeRead(statistic, "roll");

    if (!roll.ok || typeof roll.value !== "function") {
      throw runtimeFailure(
        "voyage-pf2e-statistic-roll-unavailable",
        "Statistic roll is unavailable."
      );
    }

    const supplied = preparePf2eRollParameters(runtime, parameters);
    return roll.value.call(statistic, supplied);
  };
}

function validRuntime(pendingCheck, runtime) {
  if (
    !runtime
    || (typeof runtime !== "object" && typeof runtime !== "function")
  ) {
    return blocked(
      pendingCheck,
      "voyage-pf2e-runtime-unavailable",
      "runtime",
      "Foundry runtime is unavailable."
    );
  }

  const game = safeRead(runtime, "game");
  const system = game.ok
    ? safeRead(game.value, "system")
    : { ok: false, value: undefined };
  const id = system.ok
    ? safeRead(system.value, "id")
    : { ok: false, value: undefined };

  if (
    !game.ok
    || !game.value
    || !system.ok
    || !system.value
    || !id.ok
  ) {
    return blocked(
      pendingCheck,
      "voyage-pf2e-runtime-unavailable",
      "runtime.game",
      "Foundry game runtime is unavailable."
    );
  }

  if (id.value !== "pf2e") {
    return blocked(
      pendingCheck,
      "voyage-pf2e-system-mismatch",
      "runtime.game.system.id",
      "Voyage PF2e execution requires the pf2e game system."
    );
  }

  const resolver = safeRead(runtime, "fromUuid");
  if (!resolver.ok || typeof resolver.value !== "function") {
    return blocked(
      pendingCheck,
      "voyage-pf2e-uuid-resolver-unavailable",
      "runtime.fromUuid",
      "Foundry UUID resolver is unavailable."
    );
  }

  return resolver.value;
}

export function createVoyagePf2eRuntimeExecutionDependencies(
  runtime = globalThis
) {
  const resolver = safeRead(runtime, "fromUuid");
  const base = createRuntimeDependenciesFromResolver(
    runtime,
    resolver.ok && typeof resolver.value === "function"
      ? resolver.value
      : null
  );

  return {
    ...base,
    rollStatistic: createRollStatistic(runtime)
  };
}

export async function executeVoyagePf2ePendingCheckInFoundry(
  pendingCheck,
  runtime = globalThis
) {
  const resolver = validRuntime(pendingCheck, runtime);
  if (typeof resolver !== "function") return resolver;

  const base = createRuntimeDependenciesFromResolver(runtime, resolver);
  const dependencies = {
    ...base,
    rollStatistic: createRollStatistic(runtime)
  };

  return executeVoyagePf2ePendingCheck(pendingCheck, dependencies);
}
