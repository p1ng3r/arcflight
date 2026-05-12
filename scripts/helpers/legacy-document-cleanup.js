const ARCFLIGHT_LEGACY_TYPE_PREFIX = "arcflight.";
const ARCFLIGHT_VALID_PF2E_TYPES = Object.freeze(new Set(["vehicle", "equipment"]));
const ARCFLIGHT_LEGACY_DOCUMENTS = Object.freeze({
  Actor: Object.freeze({
    collectionName: "actors",
    label: "Actor"
  }),
  Item: Object.freeze({
    collectionName: "items",
    label: "Item"
  })
});

function isInvalidLegacyArcflightType(documentName, type) {
  if (typeof type !== "string") return false;
  if (!type.startsWith(ARCFLIGHT_LEGACY_TYPE_PREFIX)) return false;
  return documentName === "Actor" || documentName === "Item";
}

function getDocumentId(source) {
  return source?._id ?? source?.id ?? source?.documentId ?? source?.uuid?.split?.(".")?.pop?.() ?? "";
}

function getDocumentName(source) {
  return source?.name ?? source?._source?.name ?? source?.source?.name ?? source?.documentName ?? "";
}

function getDocumentType(source) {
  return source?.type ?? source?._source?.type ?? source?.source?.type ?? "";
}

function getRawSource(value) {
  if (!value) return null;
  if (value._source && typeof value._source === "object") return value._source;
  if (value.source && typeof value.source === "object") return value.source;
  if (value.toObject && typeof value.toObject === "function") {
    try {
      return value.toObject(false);
    } catch (error) {
      return null;
    }
  }
  if (typeof value === "object") return value;
  return null;
}

function pushWarning(report, message, detail = null) {
  report.warnings.push(detail ? `${message} ${detail}` : message);
}

function getWorldCollection(documentName) {
  const collectionName = ARCFLIGHT_LEGACY_DOCUMENTS[documentName].collectionName;
  return globalThis.game?.[collectionName] ?? globalThis.game?.collections?.get?.(documentName) ?? null;
}

function addCandidate(candidatesById, documentName, rawSource, discoveryMethod, options = {}) {
  const source = getRawSource(rawSource);
  const id = options.id ?? getDocumentId(source);
  if (!id) return;

  const type = getDocumentType(source) || options.type || "";
  const name = getDocumentName(source) || options.name || "";
  const typeVerified = isInvalidLegacyArcflightType(documentName, type);
  const userProvided = options.userProvided === true;
  const sourceReadable = source !== null && (Boolean(type) || Boolean(name) || getDocumentId(source) === id);

  if (!typeVerified && !userProvided) return;
  if (ARCFLIGHT_VALID_PF2E_TYPES.has(type)) return;

  const existing = candidatesById.get(id);
  const candidate = {
    documentName,
    collectionName: ARCFLIGHT_LEGACY_DOCUMENTS[documentName].collectionName,
    id,
    name: name || existing?.name || "",
    type: type || existing?.type || "unknown",
    invalidLegacyType: typeVerified || existing?.invalidLegacyType === true,
    userProvided: userProvided || existing?.userProvided === true,
    sourceReadable: sourceReadable || existing?.sourceReadable === true,
    unverified: (!sourceReadable && userProvided) || existing?.unverified === true,
    discoveryMethods: existing?.discoveryMethods ? [...existing.discoveryMethods] : []
  };

  if (!candidate.discoveryMethods.includes(discoveryMethod)) {
    candidate.discoveryMethods.push(discoveryMethod);
  }

  candidatesById.set(id, candidate);
}

function readInvalidDocuments(collection, documentName, candidatesById, report) {
  const invalidIds = collection?.invalidDocumentIds;
  if (!invalidIds || typeof collection?.getInvalid !== "function") return;

  for (const id of Array.from(invalidIds)) {
    try {
      const invalidDocument = collection.getInvalid(id);
      addCandidate(candidatesById, documentName, invalidDocument, "invalidDocumentIds/getInvalid", { id });
    } catch (error) {
      pushWarning(report, `Could not inspect invalid ${documentName} ${id} through getInvalid().`, error?.message ?? String(error));
    }
  }
}

function readSourceContainer(container, documentName, candidatesById, methodName) {
  if (!container) return;

  if (container instanceof Map || typeof container?.values === "function") {
    for (const source of Array.from(container.values())) {
      addCandidate(candidatesById, documentName, source, methodName);
    }
    return;
  }

  if (Array.isArray(container)) {
    for (const source of container) {
      addCandidate(candidatesById, documentName, source, methodName);
    }
    return;
  }

  if (typeof container === "object") {
    for (const [id, source] of Object.entries(container)) {
      addCandidate(candidatesById, documentName, source, methodName, { id });
    }
  }
}

function readCollectionSources(collection, documentName, candidatesById) {
  readSourceContainer(collection?._source, documentName, candidatesById, "collection._source");
  readSourceContainer(collection?.invalidDocuments, documentName, candidatesById, "collection.invalidDocuments");
  readSourceContainer(collection?.index, documentName, candidatesById, "collection.index");
  readSourceContainer(collection?._index, documentName, candidatesById, "collection._index");
}

function readInitializedDocuments(collection, documentName, candidatesById) {
  if (!collection || typeof collection.values !== "function") return;

  for (const document of Array.from(collection.values())) {
    addCandidate(candidatesById, documentName, document, "initialized world collection");
  }
}

function getSourceFromContainer(container, id) {
  if (!container) return null;
  if (typeof container.get === "function") return container.get(id) ?? null;
  if (Array.isArray(container)) {
    return container.find((source) => getDocumentId(getRawSource(source)) === id) ?? null;
  }
  if (typeof container === "object") return container[id] ?? null;
  return null;
}

function getRawCollectionSourceById(collection, id) {
  return getSourceFromContainer(collection?._source, id)
    ?? getSourceFromContainer(collection?.invalidDocuments, id)
    ?? getSourceFromContainer(collection?.index, id)
    ?? getSourceFromContainer(collection?._index, id)
    ?? null;
}

function addUserProvidedIds(ids, documentName, candidatesById, report) {
  for (const id of ids ?? []) {
    if (typeof id !== "string" || id.trim() === "") continue;
    const trimmedId = id.trim();
    const collection = getWorldCollection(documentName);
    const rawSource = getRawCollectionSourceById(collection, trimmedId);
    const initialized = collection?.get?.(trimmedId);
    const bestSource = rawSource ?? initialized;
    const detectedType = getDocumentType(bestSource);

    if (ARCFLIGHT_VALID_PF2E_TYPES.has(detectedType)) {
      pushWarning(report, `Skipped user-provided ${documentName} ${trimmedId} because it is a valid PF2E ${detectedType} document.`);
      continue;
    }

    if (detectedType && !isInvalidLegacyArcflightType(documentName, detectedType)) {
      pushWarning(report, `Skipped user-provided ${documentName} ${trimmedId} because its type is not an invalid legacy arcflight.* type: ${detectedType}.`);
      continue;
    }

    if (!bestSource) {
      pushWarning(report, `User-provided ${documentName} ${trimmedId} could not be verified from raw world collection sources; cleanup may attempt deletion only because the ID was explicitly provided.`);
    }

    addCandidate(candidatesById, documentName, bestSource, "user-provided id", {
      id: trimmedId,
      userProvided: true,
      type: detectedType || "unknown",
      name: getDocumentName(bestSource)
    });
  }
}

function normalizeCandidates(candidatesById) {
  return Array.from(candidatesById.values()).sort((left, right) => {
    const typeComparison = left.documentName.localeCompare(right.documentName);
    if (typeComparison !== 0) return typeComparison;
    return left.id.localeCompare(right.id);
  });
}

/**
 * Find invalid legacy Arcflight world Actor and Item documents without relying on
 * normal initialized PF2E document instances.
 *
 * @param {{ actorIds?: string[], itemIds?: string[] }} [options]
 * @returns {{ actors: Array, items: Array, documents: Array, warnings: string[] }}
 */
export function findInvalidLegacyArcflightDocuments(options = {}) {
  const report = {
    actors: [],
    items: [],
    documents: [],
    warnings: []
  };

  const actorCandidates = new Map();
  const itemCandidates = new Map();
  const work = [
    ["Actor", actorCandidates],
    ["Item", itemCandidates]
  ];

  for (const [documentName, candidatesById] of work) {
    const collection = getWorldCollection(documentName);
    if (!collection) {
      pushWarning(report, `Could not find the world ${documentName} collection.`);
      continue;
    }

    readInvalidDocuments(collection, documentName, candidatesById, report);
    readCollectionSources(collection, documentName, candidatesById);
    readInitializedDocuments(collection, documentName, candidatesById);
  }

  addUserProvidedIds(options.actorIds, "Actor", actorCandidates, report);
  addUserProvidedIds(options.itemIds, "Item", itemCandidates, report);

  report.actors = normalizeCandidates(actorCandidates);
  report.items = normalizeCandidates(itemCandidates);
  report.documents = [...report.actors, ...report.items];

  if (report.documents.length === 0) {
    pushWarning(report, "No invalid legacy arcflight.* world Actor or Item documents were found. If PF2E startup logs list IDs that discovery could not read, pass them as { actorIds: [...], itemIds: [...] } to the cleanup helper.");
  }

  return report;
}

function getDocumentClass(documentName) {
  return globalThis.CONFIG?.[documentName]?.documentClass ?? globalThis[documentName] ?? null;
}

function getDatabaseCandidates(documentName) {
  const collection = getWorldCollection(documentName);
  const documentClass = getDocumentClass(documentName);
  const fallbackDatabase = globalThis.foundry?.abstract?.Document?.implementation?.database;
  const gameDatabase = globalThis.game?.data?.db ?? globalThis.game?.database ?? null;
  const collectionName = ARCFLIGHT_LEGACY_DOCUMENTS[documentName].collectionName;
  const candidates = [
    {
      method: "collection.database.delete(documentClass, ids)",
      database: collection?.database,
      target: documentClass,
      requiresDocumentClass: true
    },
    {
      method: "documentClass.database.delete(documentClass, ids)",
      database: documentClass?.database,
      target: documentClass,
      requiresDocumentClass: true
    },
    {
      method: "foundry.abstract.Document.implementation.database.delete(documentClass, ids)",
      database: fallbackDatabase,
      target: documentClass,
      requiresDocumentClass: true
    },
    {
      method: "game.database.delete(documentClass, ids)",
      database: gameDatabase,
      target: documentClass,
      requiresDocumentClass: true
    },
    {
      method: "game.database.delete(collectionName, ids)",
      database: gameDatabase,
      target: collectionName,
      requiresDocumentClass: false
    }
  ];

  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate.database || typeof candidate.database.delete !== "function") return false;
    if (candidate.requiresDocumentClass && !candidate.target) return false;
    const key = `${candidate.method}:${candidate.target?.documentName ?? candidate.target?.name ?? candidate.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function tryDatabaseDelete(candidate, ids, documentName, deletionAttempts) {
  const userId = globalThis.game?.user?.id;
  const options = { pack: null, parent: null };
  const callShapes = [
    { suffix: " with user", args: () => [candidate.target, [...ids], userId] },
    { suffix: " with options and user", args: () => [candidate.target, [...ids], options, userId] },
    { suffix: " ids only", args: () => [candidate.target, [...ids]] }
  ];

  for (const callShape of callShapes) {
    const operation = [...ids];
    const attempt = {
      documentName,
      method: `${candidate.method}${callShape.suffix}`,
      ids: operation,
      operationShape: "array<string>",
      status: "pending"
    };
    deletionAttempts.push(attempt);

    try {
      const result = await candidate.database.delete(...callShape.args());
      attempt.status = "success";
      attempt.result = result;
      return { method: attempt.method, result };
    } catch (error) {
      attempt.status = "failed";
      attempt.error = error?.message ?? String(error);
    }
  }

  return null;
}

async function rawDeleteDocuments(documentName, ids, deletionAttempts) {
  const candidates = getDatabaseCandidates(documentName);
  if (candidates.length === 0) {
    deletionAttempts.push({
      documentName,
      ids: [...ids],
      operationShape: "array<string>",
      status: "unavailable",
      method: "no raw world database delete backend found"
    });
    return null;
  }

  for (const candidate of candidates) {
    const deletion = await tryDatabaseDelete(candidate, ids, documentName, deletionAttempts);
    if (deletion) return deletion;
  }

  return null;
}

function groupByDocumentName(documents) {
  return documents.reduce((groups, document) => {
    if (!groups[document.documentName]) groups[document.documentName] = [];
    groups[document.documentName].push(document);
    return groups;
  }, {});
}

function safetyCheckDocument(document, report) {
  const collection = getWorldCollection(document.documentName);
  const rawSource = getRawCollectionSourceById(collection, document.id);
  const rawType = getDocumentType(rawSource);

  if (ARCFLIGHT_VALID_PF2E_TYPES.has(rawType)) {
    return { ...document, status: "skipped-valid-pf2e-type", type: rawType };
  }

  if (rawType && !isInvalidLegacyArcflightType(document.documentName, rawType)) {
    return { ...document, status: "skipped-non-arcflight-type", type: rawType };
  }

  if (!rawSource && document.userProvided && !document.invalidLegacyType) {
    pushWarning(report, `Allowing unverified user-provided ${document.documentName} ${document.id} because no raw source was readable; confirm this is a top-level world ${document.documentName} with type starting "arcflight." before running outside dry-run.`);
    return { ...document, unverified: true };
  }

  if (!rawSource && !document.invalidLegacyType) {
    return { ...document, status: "skipped-unverified" };
  }

  if (rawType && rawType !== document.type) {
    return { ...document, type: rawType, invalidLegacyType: true, sourceReadable: true, unverified: false };
  }

  return { ...document, sourceReadable: document.sourceReadable || Boolean(rawSource) };
}

/**
 * Dry-run by default. Pass { dryRun: false } to raw-delete only invalid legacy
 * Arcflight world Actor/Item documents with arcflight.* types.
 *
 * @param {{ dryRun?: boolean, actorIds?: string[], itemIds?: string[] }} [options]
 * @returns {Promise<{dryRun: boolean, actors: Array, items: Array, documents: Array, deleted: Array, skipped: Array, warnings: string[], deletionAttempts: Array}>}
 */
export async function cleanupInvalidLegacyArcflightDocuments(options = {}) {
  const dryRun = options.dryRun !== false;
  const found = findInvalidLegacyArcflightDocuments(options);
  const report = {
    dryRun,
    actors: found.actors,
    items: found.items,
    documents: found.documents,
    deleted: [],
    skipped: [],
    warnings: [...found.warnings],
    deletionAttempts: []
  };

  const deletable = [];
  for (const document of found.documents) {
    const checked = safetyCheckDocument(document, report);
    if (checked.status?.startsWith?.("skipped-")) {
      report.skipped.push(checked);
    } else {
      deletable.push(checked);
    }
  }

  report.actors = deletable.filter((document) => document.documentName === "Actor");
  report.items = deletable.filter((document) => document.documentName === "Item");
  report.documents = [...report.actors, ...report.items];

  if (dryRun) {
    console.warn("Arcflight | DRY RUN ONLY: invalid legacy arcflight.* cleanup found these world documents. Pass { dryRun: false } to delete them.", deletable);
    return report;
  }

  if (deletable.length === 0) {
    pushWarning(report, "No invalid legacy arcflight.* world Actor or Item documents passed safety checks for deletion.");
    return report;
  }

  console.warn("Arcflight | DELETING invalid legacy arcflight.* world documents. This bypasses normal Actor/Item initialization and only targets top-level world Actor/Item records listed in this report.", deletable);

  const groups = groupByDocumentName(deletable);
  for (const [documentName, documents] of Object.entries(groups)) {
    const ids = documents.map((document) => document.id);
    const deletion = await rawDeleteDocuments(documentName, ids, report.deletionAttempts);
    if (!deletion) {
      for (const document of documents) {
        report.skipped.push({ ...document, status: "delete-api-unavailable" });
      }
      pushWarning(report, `Raw deletion API was unavailable or failed for ${documentName}. Manual world database cleanup is required for IDs: ${ids.join(", ")}. Delete only top-level world ${documentName} records whose type starts with "arcflight."; do not delete valid PF2E vehicle/equipment documents, compendium content, or actor embedded items.`);
      continue;
    }

    for (const document of documents) {
      report.deleted.push({ ...document, status: "deleted", deletionMethod: deletion.method });
    }
  }

  if (report.deleted.length > 0) {
    console.warn("Arcflight | Deleted invalid legacy arcflight.* world documents. Reload Foundry to confirm PF2E startup/load errors are gone.", report.deleted);
  }
  if (report.skipped.length > 0) {
    console.warn("Arcflight | Some invalid legacy arcflight.* world documents were not deleted.", report.skipped, report.warnings);
  }

  return report;
}
