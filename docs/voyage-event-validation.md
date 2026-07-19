# Voyage Event Validation and Catalog Registries

## Round station actions

Every alpha round has exactly these five buckets, each holding one or two actions:

```js
stationActions: {
  captain: [/* 1 or 2 actions */], engineer: [/* 1 or 2 actions */],
  navigator: [/* 1 or 2 actions */], watchmaster: [/* 1 or 2 actions */],
  veilwarden: [/* 1 or 2 actions */]
}
```

Unknown buckets are invalid, and every action's `stationKey` must equal its bucket key.

## API and reports

`validateVoyageEventPackage(packageData, { catalogs } = {})` returns only serializable data:

```js
{ valid: false, errors: [{ severity: "error", code: "action.skills.invalid", path: "rounds[0].stationActions.navigator[0].skills", message: "Actions require exactly three unique non-empty skill keys." }], warnings: [] }
```

Issues always contain `severity`, stable machine `code`, `path`, and `message`; `referenceId` is included when relevant. Errors reject invalid package or catalog data. Warnings describe missing optional external lookup context, so structural validation remains available without catalogs.

Package validation checks JSON-compatible plain data, versions and metadata, 3–11 round limits, contiguous rounds, action IDs and required action fields, all bid bands, result conclusion IDs, narrative components, and catalog references. It never executes imported values. Functions, symbols, bigint values, non-finite numbers, class instances, and cycles report `data.json.incompatible`, `data.classInstance`, or `data.cyclic`.

## Package-local references

`package.narrativeComponents` is the canonical collection of narrative component objects. Components are never embedded in rounds or actions. The package-local ID collections are rounds, station actions, and narrative components; they are validated entirely within the package and never through external catalogs.

`openingNarrativeVariants`, every `shipResultConclusions` value, `nextRoundTransitions`, action `narrativeComponentIds`, `replacesComponentId`, and every `compatibleWith` value are package-local narrative component IDs. A component's optional `actionId` is a non-empty package action ID. Missing local IDs report `reference.local.missing` even when no external catalogs are supplied.

External catalog references are only rewards, dangers, Hazards, downstream effects, held effects/cards, prepared advantages, and consequences. Omitted catalogs create `reference.catalog.unavailable` warnings only for those external references. Optional external references may be omitted, but a present value must be a non-empty string.

## Catalogs

`createVoyageEventCatalogRegistry(source)` accepts array or object groups for `rewards`, `dangers`, `hazards`, `downstreamEffects`, `heldEffects`, `preparedAdvantages`, and `consequences`. It clones accepted entries, reports shared-contract failures and duplicate IDs, and returns `report`, `get(group, id)`, `getGroup(group)`, and `has(group, id)`. Missing groups and unknown IDs return safe `null`/`false` results. For duplicates within or across groups, the first valid entry is retained and every later conflict is reported; later entries never overwrite it.

Rewards may use only `plus2`, `plus5`, or `plus8` as `bidBand`; `none` is invalid because No Bid has no reward or danger catalog entry. Reward action tags and catalog narrative tags must be non-empty strings. Invalid conditions must be plain objects. Hazards require an array of unique Pressure lanes drawn from `structure`, `engine`, `veil`, `crew`, and `stores`; unknown or duplicate lanes produce `catalog.hazard.invalid`.

Representative invalid data: a fourth skill produces `action.skills.invalid`; `pilot` as a bucket produces `round.stationActions.unknown`; a No Bid reward produces `action.bid.references.invalid`; a duplicate catalog ID produces `catalog.id.duplicate.group`.
