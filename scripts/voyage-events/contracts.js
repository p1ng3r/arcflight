import { VOYAGE_EVENT_BID_BANDS, VOYAGE_EVENT_HAZARD_SEVERITIES, VOYAGE_EVENT_STATION_KEYS } from "./constants.js";
import { createVoyageEventBid, createVoyageEventPackage, createVoyageEventsContainer } from "./defaults.js";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

/**
 * @typedef {object} VoyageEventsContainer
 * @property {number} schemaVersion
 * @property {VoyageEventRuntime|null} active
 * @property {VoyageEventArchiveSummary[]} archive
 *
 * @typedef {object} VoyageEventRuntime
 * @property {string} runtimeId
 * @property {string} packageId
 * @property {string} packageVersion
 * @property {string} shipUuid
 * @property {string} phase
 * @property {number} revision
 * @property {boolean} paused
 * @property {number} roundIndex
 * @property {string[]} stationOrder
 * @property {Object<string, VoyageEventStationRuntime>} stations
 * @property {VoyageEventEffectInstance[]} incomingEffects
 * @property {object} pressure Event-local lanes: structure, engine, veil, crew, stores; never refit pressure.
 * @property {{minor: VoyageEventHazardInstance[], serious: VoyageEventHazardInstance[]}} hazards
 * @property {object} narrativeFlags
 * @property {object} tentativeChoices
 * @property {object} lockedChoices
 * @property {object} completedStationResults
 * @property {object[]} roundHistory
 * @property {{componentIds: string[], text: string, postedAt: number, postedByUserId: string}[]} postedVignettes
 * @property {number} eventScore
 * @property {object[]} stagedAftermath
 * @property {{type: string, userId: string, timestamp: number, detail: object}[]} auditHistory
 * @property {number} createdAt
 * @property {string} createdByUserId
 * @property {number} updatedAt
 * @property {string} updatedByUserId
 *
 * @typedef {object} VoyageEventStationRuntime
 * @property {string} stationKey
 * @property {string} operatorActorUuid
 * @property {number} focus
 * @property {string} status
 * @property {number|null} activatedAt
 * @property {number|null} resolvedAt
 *
 * @typedef {object} VoyageEventPackage Declarative imported package. It must contain no functions, macros, HTML handlers, or Foundry operations.
 * @property {number} schemaVersion
 * @property {string} mechanicsVersion
 * @property {string} packageVersion Distinct author/package release version referenced by active runtime.packageVersion.
 * @property {string} packageId
 * @property {string} title
 * @property {string} category
 * @property {string[]} tags
 * @property {number} minimumRounds
 * @property {number} maximumRounds
 * @property {object} objective
 * @property {string} visibleStakes
 * @property {string} hiddenGmSummary
 * @property {object} artworkRoles
 * @property {VoyageEventRoundDefinition[]} rounds
 * @property {VoyageEventNarrativeComponent[]} narrativeComponents Canonical package-local narrative component collection.
 * @property {object} finalOutcomeNarrative
 * @property {object[]} aftermathPackages
 * @property {string[]} validShipScarCategories
 * @property {object} earlyCompletion
 * @property {object} withdrawal
 * @property {object[]} transformations
 *
 * @typedef {object} VoyageEventRoundDefinition
 * @property {string} roundId
 * @property {number} roundNumber
 * @property {string} title
 * @property {string} immediateGoal
 * @property {string[]} openingNarrativeVariants Package-local narrative component IDs.
 * @property {string[]} visibleDangerIds
 * @property {string[]} hiddenDangerIds
 * @property {{captain: VoyageEventStationActionDefinition[], engineer: VoyageEventStationActionDefinition[], navigator: VoyageEventStationActionDefinition[], watchmaster: VoyageEventStationActionDefinition[], veilwarden: VoyageEventStationActionDefinition[]}} stationActions Exactly one or two actions for every active station; no additional station buckets.
 * @property {{criticalFailure: string, failure: string, successAtCost: string, success: string, criticalSuccess: string}} shipResultConclusions Package-local narrative component IDs keyed by ship result.
 * @property {string} preparedCriticalSuccessAdvantageId
 * @property {string[]} failureConsequenceIds
 * @property {string[]} criticalFailureConsequenceIds
 * @property {object} narrativeFlagChanges
 * @property {string[]} nextRoundTransitions Package-local narrative component IDs.
 *
 * @typedef {object} VoyageEventStationActionDefinition
 * @property {string} actionId
 * @property {string} stationKey
 * @property {string} title
 * @property {string} description Player-safe description.
 * @property {{key: string, label?: string, statisticKey?: string}[]} skills Exactly three PF2e skill references.
 * @property {object} baseDc
 * @property {Object<string, VoyageEventBidDefinition>} bids Includes none, plus2, plus5, plus8.
 * @property {string[]} matchingTags
 * @property {object} targetRestrictions
 * @property {string[]} narrativeComponentIds Package-local narrative component IDs.
 *
 * @typedef {object} VoyageEventBidDefinition
 * @property {string} band
 * @property {string} rewardId Stable reward catalog ID; empty for No Bid.
 * @property {string} dangerId Stable danger catalog ID; empty for No Bid.
 *
 * @typedef {object} VoyageEventCatalogEntry Shared shape for rewards, dangers, hazards, downstream effects, held effects/cards, advantages, and consequences.
 * @property {string} id
 * @property {string} type
 * @property {string} timing
 * @property {object} targets
 * @property {string} duration
 * @property {object} expiration
 * @property {string} stackingGroup
 * @property {string} stackingRule
 * @property {object} parameters
 * @property {string[]} narrativeTags
 * @property {object[]} invalidConditions
 * @property {object} [criticalSuccessEnhancement]
 *
 * @typedef {VoyageEventCatalogEntry & {bidBand: string, sourceStations: string[], targetStations: string[], actionTags: string[]}} VoyageEventRewardDefinition
 * @typedef {VoyageEventCatalogEntry & {severity?: string, sourceStations: string[], targetStations: string[]}} VoyageEventDangerDefinition
 * @typedef {VoyageEventCatalogEntry & {severity: "minor"|"serious", pressureLanes: string[]}} VoyageEventHazardDefinition
 * @typedef {VoyageEventCatalogEntry & {sourceStation: string, targetStation: string}} VoyageEventDownstreamEffectDefinition
 * @typedef {VoyageEventCatalogEntry & {cardId: string}} VoyageEventHeldEffectDefinition
 * @typedef {VoyageEventCatalogEntry & {roundId?: string}} VoyageEventPreparedRoundEffectDefinition
 *
 * @typedef {object} VoyageEventNarrativeComponent
 * @property {string} componentId
 * @property {string} type
 * @property {string} [sourceStation]
 * @property {string} [targetStation]
 * @property {string} [actionId]
 * @property {string} [rewardId]
 * @property {string} [dangerId]
 * @property {string} [hazardId]
 * @property {string} [degree]
 * @property {number} priority
 * @property {string} placement
 * @property {string[]} requiresFlags
 * @property {string[]} excludesFlags
 * @property {string} [replacesComponentId]
 * @property {string[]} compatibleWith
 * @property {string} text
 * @property {string} [artworkRole]
 */

/** Safely normalizes a persisted container without document access or mutation. */
export function normalizeVoyageEventsContainer(value) { return createVoyageEventsContainer(value); }
/** Safely normalizes imported declarative package metadata without executing it. */
export function normalizeVoyageEventPackage(value) { return createVoyageEventPackage(value); }

/** Returns whether an action has the required station key, exactly three skill references, and all bid bands. */
export function isVoyageEventStationActionDefinition(value) {
  if (!isObject(value) || !nonEmptyString(value.actionId) || !VOYAGE_EVENT_STATION_KEYS.includes(value.stationKey)) return false;
  if (!Array.isArray(value.skills) || value.skills.length !== 3 || !value.skills.every((skill) => isObject(skill) && nonEmptyString(skill.key))) return false;
  if (!isObject(value.bids)) return false;
  return Object.values(VOYAGE_EVENT_BID_BANDS).every((band) => isObject(value.bids[band]));
}

/** Returns a normalized bid object only when its selected band is a stable alpha band. */
export function normalizeVoyageEventBid(value) { return createVoyageEventBid(value); }

/** Verifies a catalog entry has the common serializable timing and stacking vocabulary. */
export function isVoyageEventCatalogEntry(value) {
  return isObject(value) && nonEmptyString(value.id) && nonEmptyString(value.type) && nonEmptyString(value.timing)
    && isObject(value.targets) && nonEmptyString(value.duration) && isObject(value.expiration)
    && nonEmptyString(value.stackingGroup) && nonEmptyString(value.stackingRule) && isObject(value.parameters)
    && Array.isArray(value.narrativeTags) && Array.isArray(value.invalidConditions);
}

/** Verifies the declared Hazard severity is one of the two alpha severities. */
export function isVoyageEventHazardDefinition(value) {
  return isVoyageEventCatalogEntry(value) && Object.values(VOYAGE_EVENT_HAZARD_SEVERITIES).includes(value.severity);
}
