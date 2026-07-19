# Voyage Event Data Contracts

This document defines the plain serializable data vocabulary for the Voyage Event alpha. It does not register runtime code, write Foundry Documents, or provide event content.

## Persistence location

An Arcflight-enabled PF2e vehicle actor stores this exact container at `flags.arcflight.system.voyageEvents`:

```js
{
  schemaVersion: 1,
  active: null, // or a VoyageEventRuntime
  archive: [] // VoyageEventArchiveSummary records or history references
}
```

`active` has the shape produced by `createVoyageEventRuntime`: identifiers (`runtimeId`, `packageId`, `packageVersion`, `shipUuid`); phase, revision, pause, and round state; the five station records; incoming effects; event-local `pressure`; Hazards; flags; tentative and locked choices; completed results; histories; posted vignette text and component IDs; score; staged aftermath; audit entries; and timestamps/user IDs. Focus has one canonical location: `active.stations.<stationKey>.focus`; there is no top-level runtime Focus object.

The `pressure` object is explicitly event-local and only uses `structure`, `engine`, `veil`, `crew`, and `stores`. It never aliases or updates `refitPressure`.

All default factories recursively clone JSON-compatible plain data. Normalized results contain no mutable nested object or array references shared with their source input.

## Package example

Packages are declarative data. Stable IDs link actions, bids, catalog entries, and narrative components; they never embed executable mechanics. `packageVersion` is the authored package release version; it is distinct from the package schema version and the mechanics compatibility version, and `active.packageVersion` records it.

```js
{
  schemaVersion: 1,
  mechanicsVersion: "1",
  packageVersion: "1.0.0",
  packageId: "example-package",
  title: "Example Voyage",
  category: "navigation",
  tags: ["void"],
  minimumRounds: 3,
  maximumRounds: 5,
  objective: { id: "reach-safety" },
  visibleStakes: "Reach safety before the route closes.",
  hiddenGmSummary: "A GM-only premise.",
  artworkRoles: { cover: "event-cover" },
  rounds: [],
  narrativeComponents: [],
  finalOutcomeNarrative: {},
  aftermathPackages: [],
  validShipScarCategories: ["structure"],
  earlyCompletion: {}, withdrawal: {}, transformations: []
}
```

A package owns one canonical `narrativeComponents` collection containing all narrative component objects; rounds and actions only store their stable component IDs and never embed duplicate component objects. A round has a stable ID/number, goals, `openingNarrativeVariants` component ID arrays, visible/hidden danger IDs, station actions keyed by station, five `shipResultConclusions` component IDs, a prepared Critical Success advantage ID, Failure consequence IDs, flag changes, and `nextRoundTransitions` component ID arrays. Each action's `narrativeComponentIds` is likewise an array of package-local component IDs. A narrative component's optional `actionId` references a package-local action ID.

Rewards, dangers, Hazards, prepared advantages, and consequences remain external catalog references. They are not package-local narrative components.

## Action and catalog example

Every action has exactly three PF2e skill references and the four bid bands. No Bid has no reward or danger ID.

```js
{
  actionId: "example-action", stationKey: "navigator", title: "Plot a Course",
  description: "Find a safe route.",
  skills: [{ key: "survival" }, { key: "society" }, { key: "sailing-lore" }],
  baseDc: { value: 20 },
  bids: {
    none: { band: "none", rewardId: "", dangerId: "" },
    plus2: { band: "plus2", rewardId: "reward-clear-route", dangerId: "danger-delay" },
    plus5: { band: "plus5", rewardId: "reward-shortcut", dangerId: "danger-exposure" },
    plus8: { band: "plus8", rewardId: "reward-perfect-line", dangerId: "danger-rift" }
  },
  matchingTags: ["navigation"], targetRestrictions: {}, narrativeComponentIds: ["beat-course"]
}
```

Rewards, dangers, minor/serious Hazards, downstream effects, held effects/cards, prepared advantages, and consequences share the catalog fields: stable `id`, `type`, `timing`, `targets`, `duration`, `expiration`, `stackingGroup`, `stackingRule`, `parameters`, `narrativeTags`, `invalidConditions`, and optional `criticalSuccessEnhancement`.

Narrative components use stable IDs and include type, source/target stations where relevant, action/reward/danger/Hazard IDs, degree, priority, placement, required/excluded flags, replacement/compatibility metadata, text, and optional artwork role. This supports both isolated station beats and source-to-target cascade bridges.
