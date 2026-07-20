# V3-007 — Add Voyage Event Lifecycle Manager

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Starting branch:** `rebuild/arcflight-voyage-events-alpha`

Tell Codex:

`Read AGENTS.md and perform the task in docs/codex/V3-007-voyage-event-lifecycle-manager.md.`

---

TASK ID: V3-007  
TITLE: Add the GM-authoritative active Voyage Event lifecycle manager

Repository: p1ng3r/arcflight  
Starting branch: rebuild/arcflight-voyage-events-alpha

## READ FIRST

- `AGENTS.md`
- `docs/voyage-event-v3-decisions.md`
- `docs/voyage-event-data-contracts.md`
- `docs/voyage-event-validation.md`
- `docs/voyage-event-persistence.md`
- `scripts/voyage-events/constants.js`
- `scripts/voyage-events/defaults.js`
- `scripts/voyage-events/contracts.js`
- `scripts/voyage-events/validation.js`
- `scripts/voyage-events/persistence.js`

## GOAL

Create the focused state-management layer for one active Voyage Event runtime on an Arcflight ship.

This task adds:

- validated event start;
- pause and resume;
- strict legal phase transitions;
- the round-boundary reset when a new round begins;
- audited GM overrides;
- stable state-manager errors;
- exact manual Foundry inspection documentation.

All writes must use the accepted persistence helpers at `flags.arcflight.system.voyageEvents`. Do not duplicate the persistence boundary or write Actor flags directly.

This task does not implement station-choice rules, station order validation, PF2e rolls, scoring, bids, rewards, dangers, Pressure changes, Hazard execution, narrative composition, sockets, UI, archival, abort/withdrawal, aftermath application, catalogs, or bundled event content.

## REQUIRED DELIVERABLES

Create only the files needed for a focused active-runtime lifecycle layer, expected to include:

- `scripts/voyage-events/state-manager.js`
- `docs/voyage-event-state-manager.md`

Update an existing Voyage Event constant, default, contract, validation, or persistence file only when a small consistency correction or shared internal helper is strictly required. Do not register the new module anywhere in this task.

## A. REQUIRED PUBLIC API

Export these exact public names unless an existing repository conflict makes one impossible:

```js
VOYAGE_EVENT_STATE_ERROR_CODES
VOYAGE_EVENT_AUDIT_TYPES
VOYAGE_EVENT_PHASE_TRANSITIONS
getAllowedVoyageEventPhaseTransitions
canTransitionVoyageEventPhase
startVoyageEvent
pauseVoyageEvent
resumeVoyageEvent
transitionVoyageEventPhase
applyVoyageEventGmOverride
```

Document the final exports. Do not expose mutable internal maps or arrays.

## B. AUTHORITY, PERSISTENCE, AND REVISION RULES

Every state-changing function must:

- operate only on an eligible Arcflight-enabled PF2e vehicle ship;
- require an authorized GM;
- require an explicit exact `expectedRevision` option;
- use the existing persistence module rather than calling `Actor.update` directly;
- perform no more than one successful Actor update;
- preserve all sibling Arcflight flag data;
- return a fresh normalized copy of the successfully persisted active runtime;
- leave caller input objects unchanged;
- propagate persistence-layer errors without replacing their stable codes.

Resolve the responsible timestamp and user ID once per attempted successful transition, then use those same values for the audit entry and persistence metadata. Explicit values must follow the persistence contract. Do not create an audit entry in stored state when persistence fails.

## C. PHASE TRANSITION POLICY

Use the accepted phase constants. The normal active-runtime transition graph is exactly:

```text
setup -> opening
opening -> roundOpening
roundOpening -> crewPlanning
crewPlanning -> orderLock
orderLock -> stationResolution
stationResolution -> roundResolution
roundResolution -> endRoundVignette
endRoundVignette -> nextRoundPreparation
nextRoundPreparation -> roundOpening
nextRoundPreparation -> eventResolution
eventResolution -> aftermathReview
aftermathReview -> no normal transition in this task
archive -> no transition
```

Requirements:

- unknown phases have no allowed transitions;
- same-phase transitions are invalid;
- reverse transitions are invalid;
- skipped phases are invalid;
- `archive` is reserved and cannot be entered through this task;
- a paused event cannot make a normal phase transition;
- pure transition-inspection helpers never mutate input;
- `getAllowedVoyageEventPhaseTransitions` returns a fresh array;
- `canTransitionVoyageEventPhase` returns only a boolean;
- the exported transition map is deeply immutable or otherwise safe from caller mutation.

The manager does not infer whether a round is mechanically complete. The caller explicitly chooses one of the two legal transitions from `nextRoundPreparation`, and later tasks will enforce station-resolution and event-completion gates.

## D. STARTING AN EVENT

`startVoyageEvent(shipActor, packageData, options)` must:

- require `options.expectedRevision === null`;
- reject when an active event already exists;
- validate `packageData` with the accepted package validator;
- allow optional external catalogs to be passed to the validator without executing package data;
- reject an invalid package with a stable state-manager error containing a serializable validation report;
- require a non-empty trimmed runtime ID supplied through options;
- derive package ID and package version from the validated package;
- use the target ship Actor UUID as `shipUuid`;
- initialize phase as `setup`;
- initialize `paused` as `false`;
- initialize `roundIndex` as `0`;
- initialize exactly the five active station runtime records through the accepted defaults;
- initialize each station with Focus `1`, unresolved status, and no activation/resolution timestamps;
- initialize all other runtime fields through the accepted runtime default factory;
- append one authoritative `event.started` audit entry;
- persist once through `persistActiveVoyageEvent`.

Do not copy the full authored package into Actor flags. Runtime state stores stable package identity and gameplay state only.

Do not generate random IDs in this task. The caller supplies the runtime ID so manual inspection and later request handling can be deterministic.

## E. PAUSE AND RESUME

`pauseVoyageEvent` and `resumeVoyageEvent` must require an active runtime and exact expected revision.

Pause requirements:

- reject when already paused;
- preserve the current phase and all gameplay state;
- set only the authoritative paused state plus metadata/audit changes;
- append one `event.paused` audit entry;
- persist once.

Resume requirements:

- reject when not paused;
- preserve the current phase and all gameplay state;
- set only the authoritative paused state plus metadata/audit changes;
- append one `event.resumed` audit entry;
- persist once.

Do not treat pause or resume as phase changes.

## F. NORMAL PHASE TRANSITIONS

`transitionVoyageEventPhase(shipActor, nextPhase, options)` must:

- require an active, unpaused runtime;
- require `nextPhase` to be a known accepted phase;
- require the current-to-next edge to exist in the exact transition graph;
- append one `phase.transition` audit entry containing at least the prior phase, next phase, prior round index, and resulting round index;
- persist once through the active-runtime persistence helper.

For ordinary edges, preserve all runtime gameplay fields and change only the phase plus authoritative audit/metadata/revision fields.

### New-round boundary

For `nextRoundPreparation -> roundOpening` only:

- increment `roundIndex` exactly once;
- clear `stationOrder`;
- clear `tentativeChoices`;
- clear `lockedChoices`;
- clear `completedStationResults`;
- reset each active station status to `unresolved`;
- reset each active station `activatedAt` and `resolvedAt` to `null`;
- preserve each station's `operatorActorUuid` and remaining Focus;
- preserve event score, Pressure, Hazards, incoming effects, narrative flags, histories, posted vignettes, staged aftermath, identity, and creation metadata.

Do not automatically change Pressure, Hazards, Focus, score, effects, flags, or history at any other phase edge.

## G. AUDITED GM OVERRIDES

`applyVoyageEventGmOverride(shipActor, nextRuntime, options)` is the explicit escape hatch for correcting active runtime data before later specialized GM tools exist.

Requirements:

- require an active runtime and exact expected revision;
- require a non-empty trimmed `options.reason`;
- require `nextRuntime` to be safe plain serializable runtime data;
- require the current `runtimeId`, `packageId`, `packageVersion`, and `shipUuid` to remain unchanged;
- reject `archive` as the requested phase;
- ignore caller attempts to replace revision, creation metadata, update metadata, or audit history;
- begin from the accepted normalized candidate data;
- restore the authoritative identity and current audit history;
- append one `gm.override` audit entry containing the reason, prior phase, resulting phase, and optional safe serializable detail;
- let persistence assign the next revision and authoritative creation/update metadata;
- persist once.

This API accepts a complete declarative runtime candidate. It must not accept callbacks, executable patches, arbitrary Foundry operations, macros, or string paths that are executed dynamically.

An override may run while the event is paused because it is an explicit GM correction. It must still satisfy identity, safe-data, authority, and revision rules.

## H. AUDIT CONTRACT

Export frozen audit type values equivalent to:

```js
{
  EVENT_STARTED: "event.started",
  EVENT_PAUSED: "event.paused",
  EVENT_RESUMED: "event.resumed",
  PHASE_TRANSITION: "phase.transition",
  GM_OVERRIDE: "gm.override"
}
```

Every appended audit entry has the existing runtime contract:

```js
{
  type: string,
  userId: string,
  timestamp: number,
  detail: object
}
```

Requirements:

- user ID is non-empty;
- timestamp is finite and non-negative;
- detail is independent JSON-compatible plain data;
- existing audit history is preserved in order;
- caller-owned audit arrays and detail objects are never retained by reference;
- failed operations do not alter persisted audit history;
- GM override callers cannot erase, reorder, or forge prior audit entries.

## I. STABLE STATE-MANAGER ERRORS

Provide a stable serializable error shape and frozen code registry. At minimum support codes equivalent to:

- `voyage.state.active.required`
- `voyage.state.active.exists`
- `voyage.state.package.invalid`
- `voyage.state.runtimeId.required`
- `voyage.state.phase.invalid`
- `voyage.state.phase.transition.invalid`
- `voyage.state.paused`
- `voyage.state.pause.invalid`
- `voyage.state.resume.invalid`
- `voyage.state.override.reason.required`
- `voyage.state.override.identity.invalid`
- `voyage.state.override.data.invalid`

Error details must be independent JSON-compatible plain data. Do not include Actor documents, functions, class instances, cycles, or mutable references.

Persistence errors retain their original persistence codes.

## J. DOCUMENTATION

Document:

- exact public API names;
- the phase transition graph;
- start initialization behavior;
- pause/resume behavior;
- the new-round reset boundary;
- audited GM override behavior;
- audit types and shapes;
- state-manager error codes;
- persistence error propagation;
- that this layer performs one authoritative persisted mutation per successful operation;
- that archive, abort, gameplay gates, rolls, effects, sockets, UI, registration, and content remain out of scope.

Include a complete copy-paste Foundry console inspection workflow. It may include a compact valid three-round package fixture solely inside documentation for manual testing; do not add a bundled event or executable test fixture to module runtime code.

## K. MANUAL FOUNDRY INSPECTION REQUIREMENTS

The documented workflow must verify at least:

1. Importing the state manager and persistence modules succeeds.
2. Pure transition helpers return fresh data and cannot be mutated to change internal policy.
3. Starting a valid three-round package with `expectedRevision: null` creates revision `1`, phase `setup`, round index `0`, five unresolved stations with Focus `1`, and one `event.started` audit entry.
4. Starting a second event while one is active fails without writing.
5. `setup -> opening` succeeds and increments revision exactly once.
6. A skipped transition such as `opening -> crewPlanning` fails without writing.
7. Pause succeeds once; a phase transition while paused fails without writing; resume succeeds once.
8. Repeating pause while paused and resume while unpaused each fail without writing.
9. Walking the legal path to `nextRoundPreparation -> roundOpening` increments the round index exactly once and resets only the required round-scoped fields while preserving Focus, Pressure, Hazards, score, identity, and histories.
10. `nextRoundPreparation -> eventResolution -> aftermathReview` is legal, while transition to `archive` is rejected in this task.
11. A stale expected revision fails without changing runtime or audit history.
12. A GM override with a reason persists the corrected runtime, preserves immutable identity and prior audit history, and appends exactly one `gm.override` entry.
13. A blank override reason, changed runtime identity, unsafe detail, or unsafe runtime candidate fails without writing.
14. Caller package/runtime/detail objects remain unchanged.
15. Sibling `flags.arcflight.system` data remains unchanged.
16. Cleanup clears the active runtime through the persistence helper using the exact current revision; no archive entry is invented.

Do not run these steps in Codex.

## OUT OF SCOPE

- no archive summary creation or movement into `container.archive`;
- no abort, withdrawal, transformation, or early-completion workflow;
- no enforcement that station order is complete or legal;
- no enforcement that tentative/locked choices are complete;
- no station activation or result recording;
- no duplicate-roll prevention beyond revision conflicts;
- no PF2e Actor/statistic resolution or rolls;
- no bid, reward, danger, effect, Pressure, Hazard, Focus-spend, score, or aftermath mechanics;
- no narrative selection, composition, preview, posting, or chat messages;
- no sockets or player-to-GM requests;
- no UI, ApplicationV2 classes, templates, CSS, localization, or artwork;
- no catalogs or bundled event packages;
- no hooks or module registration;
- no changes to `module.json`;
- no changes to `scripts/arcflight.js`;
- no version bump;
- no package manager, bundler, framework, or build pipeline;
- no automated tests;
- no branch operations;
- no pull request;
- do not run Foundry.

## ACCEPTANCE CRITERIA

1. The exact normal phase graph is centralized and immutable.
2. Pure phase helpers do not mutate input or expose mutable policy state.
3. Start validates declarative package data and initializes one normalized active runtime.
4. Start requires no current active runtime and exact `expectedRevision: null`.
5. Every successful manager mutation performs exactly one persistence-layer Actor update.
6. Pause/resume are guarded, audited, and do not change phase.
7. Normal transitions reject paused, skipped, reversed, same, unknown, and archive transitions.
8. The new-round edge increments `roundIndex` exactly once and resets only the specified round-scoped fields.
9. Normal transitions preserve unrelated runtime gameplay state.
10. Every successful operation appends exactly one authoritative audit entry of the correct type.
11. Failed operations do not write or append persisted audit entries.
12. GM overrides require a reason, preserve immutable identity and prior audit history, and cannot spoof revision or metadata.
13. Persistence error codes propagate unchanged.
14. Inputs and Actor source flag data are not mutated.
15. Sibling Arcflight flag data remains unchanged.
16. No archive, abort, gameplay mechanics, rolls, sockets, UI, registration, content, tests, branch operations, or pull request are added.
17. `git diff --check` passes.

## FINAL RESPONSE

Return:

- concise summary;
- complete changed-file list;
- final public API names;
- exact phase transition graph;
- start initialization behavior;
- pause/resume behavior;
- new-round reset behavior;
- GM override and audit behavior;
- stable state-manager error codes;
- persistence errors that are intentionally propagated;
- assumptions;
- exact manual Foundry inspection steps;
- known limitations;
- `git diff --check` result;
- confirmation that no archive, abort, gameplay mechanics, rolls, sockets, UI, registration, content, tests, branch operations, or pull request were added.
