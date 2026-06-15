function collectionKeys(collection) {
  if (!collection) return [];
  if (collection instanceof Map) return Array.from(collection.keys());
  if (typeof collection.keys === "function") {
    try {
      return Array.from(collection.keys());
    } catch (_error) {
      // Fall through to object key discovery for Foundry/PF2E data wrappers.
    }
  }

  return Object.keys(collection);
}

function normalizeStatisticKey(statisticKey = "") {
  return String(statisticKey ?? "").trim().toLowerCase();
}

function findMatchingLoreSkillKeys(actor, baseKey = "") {
  if (!baseKey) return [];
  const normalizedBase = normalizeStatisticKey(baseKey).replace(/-lore$/, "");
  const keys = [
    ...collectionKeys(actor?.statistics),
    ...collectionKeys(actor?.skills),
    ...collectionKeys(actor?.system?.skills)
  ];

  return keys.filter((key) => {
    const slug = normalizeStatisticKey(key);
    return slug.endsWith("lore") && slug.includes(normalizedBase);
  });
}

function candidateStatisticKeys(statisticKey = "", actor = null) {
  const key = normalizeStatisticKey(statisticKey);
  const loreBaseKey = key.endsWith("-lore") ? key.replace(/-lore$/, "") : "";
  const candidates = [key];

  if (loreBaseKey) {
    candidates.push(loreBaseKey);
    candidates.push(...findMatchingLoreSkillKeys(actor, loreBaseKey));
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function getMapLikeValue(collection, key) {
  if (!collection || !key) return null;
  if (typeof collection.get === "function") return collection.get(key) ?? null;
  return collection[key] ?? null;
}

function resolveStatisticLabel(statistic, fallbackKey = "") {
  return statistic?.label
    ?? statistic?.name
    ?? statistic?.slug
    ?? statistic?.system?.label
    ?? statistic?.system?.name
    ?? fallbackKey
    ?? "";
}

function isRollableStatistic(statistic) {
  return typeof statistic?.roll === "function" || typeof statistic?.check?.roll === "function";
}

function createStatisticResolution({ statistic = null, statisticKey = "", source = "missing", label = "", ok = false, message = "" } = {}) {
  const resolvedLabel = label || resolveStatisticLabel(statistic, statisticKey);

  return {
    statistic,
    statisticKey,
    source,
    label: resolvedLabel,
    ok,
    message: message || (ok
      ? `Resolved ${resolvedLabel || statisticKey} from ${source}.`
      : `Could not resolve a rollable PF2E statistic for ${statisticKey}.`)
  };
}

function tryActorGetStatistic(actor, key) {
  if (typeof actor?.getStatistic !== "function") return null;

  try {
    return actor.getStatistic(key) ?? null;
  } catch (error) {
    console.warn("Arcflight | actor.getStatistic failed while resolving station action statistic.", { actor: actor?.name, key, error });
    return null;
  }
}

function resolveFromCandidates(actor, candidates, resolvers) {
  for (const resolve of resolvers) {
    for (const key of candidates) {
      const statistic = resolve.get(actor, key);
      if (statistic) return { statistic, statisticKey: key, source: resolve.source };
    }
  }

  return null;
}

function mergeRollOptions(extraRollOptions) {
  const options = Array.isArray(extraRollOptions) ? extraRollOptions : [];
  return Array.from(new Set(options.filter(Boolean)));
}

function getNumericRollTotal(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getRollTotal(rollResult) {
  return getNumericRollTotal(rollResult?.total)
    ?? getNumericRollTotal(rollResult?.roll?.total)
    ?? null;
}

function captureRollMetadata(target, roll, outcome, message) {
  if (!target || !roll) return;
  const total = getRollTotal(roll);
  if (Number.isFinite(total)) target.total = total;
  const degreeOfSuccess = roll?.degreeOfSuccess ?? roll?.degree ?? outcome?.degreeOfSuccess ?? outcome?.degree;
  if (degreeOfSuccess !== undefined && degreeOfSuccess !== null) {
    target.degreeOfSuccess = degreeOfSuccess;
    target.degree = degreeOfSuccess;
  }
  const outcomeValue = roll?.outcome ?? outcome?.outcome ?? outcome?.label ?? outcome?.value;
  if (outcomeValue !== undefined && outcomeValue !== null) target.outcome = outcomeValue;
  target.rollId = roll?.id ?? roll?.rollId ?? target.rollId ?? "";
  target.messageId = message?.id ?? message?._id ?? roll?.message?.id ?? roll?.messageId ?? target.messageId ?? "";
}

async function rollStatistic(_actor, statistic, rollArgsOrContext = {}, options = {}) {
  const callbackMetadata = {};
  const context = rollArgsOrContext ?? {};
  const rollArgs = {
    event: options.event ?? context.event,
    title: options.title ?? context.title,
    label: options.label ?? context.label,
    slug: options.slug ?? context.slug,
    action: options.action ?? context.action,
    dc: options.dc ?? context.dc,
    extraRollOptions: mergeRollOptions([
      ...(Array.isArray(context.extraRollOptions) ? context.extraRollOptions : []),
      ...(Array.isArray(options.extraRollOptions) ? options.extraRollOptions : [])
    ]),
    skipDialog: options.skipDialog ?? context.skipDialog ?? false,
    createMessage: options.createMessage ?? context.createMessage ?? true,
    callback: async (roll, outcome, message) => {
      captureRollMetadata(callbackMetadata, roll, outcome, message);
      if (typeof context.callback === "function") await context.callback(roll, outcome, message);
      if (typeof options.callback === "function") await options.callback(roll, outcome, message);
    }
  };

  const rollResult = typeof statistic?.roll === "function"
    ? await statistic.roll(rollArgs)
    : typeof statistic?.check?.roll === "function"
      ? await statistic.check.roll(rollArgs)
      : null;

  if (!rollResult && Object.keys(callbackMetadata).length === 0) return null;

  if (rollResult) captureRollMetadata(callbackMetadata, rollResult);
  return Object.keys(callbackMetadata).length > 0
    ? { ...callbackMetadata, roll: rollResult ?? null }
    : rollResult;
}

export function normalizePf2eStatisticKey(statisticKey) {
  return normalizeStatisticKey(statisticKey);
}

export function getPf2eStatisticCandidateKeys(actor, statisticKey) {
  return candidateStatisticKeys(statisticKey, actor);
}

export function isRollablePf2eStatistic(statistic) {
  return isRollableStatistic(statistic);
}

export function resolvePf2eActorStatistic(actor, statisticKey = "") {
  const requestedKey = normalizeStatisticKey(statisticKey);
  if (!actor) {
    return createStatisticResolution({
      statisticKey: requestedKey,
      ok: false,
      message: "No assigned actor was available for this station action roll."
    });
  }

  const candidates = candidateStatisticKeys(requestedKey, actor);
  const saveKeys = new Set(["fortitude", "reflex", "will"]);
  const resolved = resolveFromCandidates(actor, candidates, [
    { source: "actor.getStatistic", get: (candidateActor, key) => tryActorGetStatistic(candidateActor, key) },
    { source: "actor.skills", get: (candidateActor, key) => candidateActor?.skills?.[key] ?? null },
    { source: "actor.skills.get", get: (candidateActor, key) => candidateActor?.skills?.get?.(key) ?? null },
    { source: "actor.perception", get: (candidateActor, key) => key === "perception" ? candidateActor?.perception ?? null : null },
    { source: "actor.saves", get: (candidateActor, key) => saveKeys.has(key) ? candidateActor?.saves?.[key] ?? null : null },
    { source: "actor.saves.get", get: (candidateActor, key) => saveKeys.has(key) ? candidateActor?.saves?.get?.(key) ?? null : null }
  ]);

  if (resolved) {
    const ok = isRollableStatistic(resolved.statistic);
    return createStatisticResolution({
      ...resolved,
      label: resolveStatisticLabel(resolved.statistic, resolved.statisticKey),
      ok,
      message: ok
        ? `Resolved rollable PF2E statistic ${resolveStatisticLabel(resolved.statistic, resolved.statisticKey)} from ${resolved.source}.`
        : `Resolved ${resolveStatisticLabel(resolved.statistic, resolved.statisticKey)} from ${resolved.source}, but it does not expose statistic.roll or statistic.check.roll.`
    });
  }

  const systemSkill = resolveFromCandidates(actor, candidates, [
    { source: "actor.system.skills", get: (candidateActor, key) => getMapLikeValue(candidateActor?.system?.skills, key) }
  ]);

  if (systemSkill) {
    return createStatisticResolution({
      ...systemSkill,
      label: resolveStatisticLabel(systemSkill.statistic, systemSkill.statisticKey),
      ok: false,
      message: `Found read-only PF2E system skill metadata for ${systemSkill.statisticKey}, but no rollable Statistic object was available.`
    });
  }

  return createStatisticResolution({
    statisticKey: requestedKey,
    ok: false,
    message: `${actor.name ?? "Assigned actor"} does not expose a PF2E Statistic for ${requestedKey || "the selected roll option"}.`
  });
}

export function getPf2eRollTotal(rollResult) {
  return getRollTotal(rollResult);
}

export async function rollPf2eStatistic(actor, statistic, rollArgsOrContext, options = {}) {
  return rollStatistic(actor, statistic, rollArgsOrContext, options);
}
