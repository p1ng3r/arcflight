# V3-004 — Define Voyage Event Data Contracts

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Working branch:** `rebuild/arcflight-voyage-events-alpha`

Tell Codex:

`Read AGENTS.md and perform the task in docs/codex/V3-004-voyage-event-data-contracts.md.`

---

TASK ID: V3-004
TITLE: Define Voyage Event data contracts

Repository: p1ng3r/arcflight
Working branch: rebuild/arcflight-voyage-events-alpha

Read first:
- AGENTS.md
- docs/voyage-event-v3-decisions.md
- data/stations/core-stations.js
- data/station-actions/core-station-actions.js
- scripts/documents/ships.js
- scripts/helpers/install-state.js
- scripts/config/constants.js

GOAL

Create the plain-data contracts and default factories required by the Voyage Event alpha. This task establishes vocabulary and serializable shapes only. It must not implement gameplay execution, UI, sockets, PF2e rolls, persistence writes, catalog content, or bundled events.

ARCHITECTURAL DECISIONS

1. The active Voyage Event runtime belongs to an Arcflight-enabled PF2e vehicle actor under:
   `flags.arcflight.system.voyageEvents`
2. The container must support:
   - one active event runtime;
   - archived event summaries/history references;
   - schema versioning.
3. Imported event packages are declarative plain data and contain no executable mechanics.
4. Reward, danger, and Hazard entries are referenced by stable IDs.
5. The five active Voyage Event stations are:
   - captain
   - engineer
   - navigator
   - watchmaster
   - veilwarden
6. Do not remove or modify the broader shared station registry.
7. Voyage Event Pressure is event-local and must not reuse or overwrite refit-pressure data.

REQUIRED DELIVERABLES

Create a small, coherent folder foundation similar to:

- `scripts/voyage-events/constants.js`
- `scripts/voyage-events/defaults.js`
- `scripts/voyage-events/contracts.js`
- `docs/voyage-event-data-contracts.md`

Exact filenames may vary only when an existing convention clearly requires it. Do not create more files than needed.

The implementation must define and document these contracts:

A. Voyage Event container
- schema version;
- active event or null;
- archive summaries;
- safe defaults for older ships with no Voyage Event data.

B. Active event runtime
- runtime ID;
- event package ID and version;
- active ship UUID;
- phase;
- revision;
- paused state;
- current round index;
- station order;
- five station runtime records;
- Focus state;
- incoming downstream effects;
- event-local Pressure lanes;
- active minor and serious Hazards;
- narrative flags;
- tentative choices;
- locked choices;
- completed station results;
- round history;
- exact posted vignettes and component IDs;
- event score;
- staged aftermath;
- audit/override history;
- timestamps and responsible user IDs where applicable.

C. Event package
- schema version;
- mechanics version;
- stable package ID;
- title, category, and tags;
- minimum and maximum rounds;
- overall objective;
- visible stakes;
- hidden GM summary;
- artwork-role references;
- rounds;
- final outcome narrative;
- aftermath packages;
- valid Ship Scar categories;
- early completion, withdrawal, and transformation declarations.

D. Round definition
- stable round ID;
- round number;
- title;
- immediate goal;
- opening narrative variants;
- visible and hidden danger references;
- station actions by station key;
- ship-level result conclusions;
- prepared Critical Success advantage reference;
- Failure and Critical Failure consequence references;
- narrative-flag changes;
- next-round transitions.

E. Station action definition
- stable action ID;
- station key;
- title and player-safe description;
- exactly three PF2e skill references;
- base DC data;
- No Bid plus `+2`, `+5`, and `+8` choices;
- stable reward and danger IDs for each bid;
- action/reward matching tags;
- target restrictions;
- narrative component references.

F. Catalog entry contracts
Define structural contracts for:
- reward definitions;
- danger definitions;
- minor and serious Hazard definitions;
- downstream effects;
- held effects/cards;
- prepared round advantages and consequences.

Each contract must represent timing, targets, duration, expiration, stacking group, stacking rule, parameters, narrative tags, invalid conditions, and optional Critical Success enhancement where relevant.

G. Narrative component contract
- stable component ID;
- type;
- source and target station where applicable;
- action/reward/danger/Hazard references;
- degree of success where applicable;
- priority;
- placement;
- requires/excludes flags;
- replacement and compatibility metadata;
- text;
- optional artwork role.

H. Constants
Define stable constants for:
- Voyage Event phases;
- five active station keys;
- station degree values;
- round and event result identifiers;
- five Pressure lanes;
- Pressure state thresholds;
- bid bands;
- narrative component types;
- Hazard severities;
- initial stacking limits.

DEFAULT AND NORMALIZATION REQUIREMENTS

- Provide pure default factory functions that return new mutable plain objects.
- Do not expose shared mutable default objects.
- Missing or malformed optional values must fall back safely.
- Do not write to Foundry Documents in this task.
- Do not import or use browser-only Foundry globals in the contracts/default modules.
- Keep the contracts usable by later import validation and runtime persistence.
- Use JSDoc or equivalent in-code documentation; do not introduce TypeScript or a build step.

OUT OF SCOPE

- no event manager UI;
- no ApplicationV2 classes;
- no Handlebars templates;
- no CSS;
- no localization additions unless required solely for a contract identifier;
- no socket handling;
- no persistence writes;
- no state-machine transitions;
- no PF2e roll execution;
- no reward/danger/Hazard effect execution;
- no actual 20/20/20 catalogs;
- no bundled events;
- no narrative composition;
- no changes to module.json;
- no changes to scripts/arcflight.js;
- no version bump;
- no branch operations;
- no pull request;
- do not run tests or Foundry.

ACCEPTANCE CRITERIA

1. All required contracts are represented as plain serializable data shapes.
2. The five Voyage Event stations are an active subset without modifying the shared registry.
3. Voyage Event Pressure is clearly namespaced apart from refit pressure.
4. Every action contract requires exactly three skill references.
5. No Bid and all three bid bands are represented.
6. Reward, danger, and Hazard references use stable IDs.
7. Narrative components can represent isolated station beats and source-to-target cascade bridges.
8. Default factories produce independent objects and do not mutate arguments.
9. Existing Arcflight behavior is not wired to or changed by these files.
10. The documentation shows representative data examples but does not include executable event-specific code.

FINAL RESPONSE

Return:
- concise summary;
- complete changed-file list;
- the chosen final folder/file layout;
- the exact `flags.arcflight.system.voyageEvents` shape;
- assumptions;
- manual inspection steps for the user;
- known limitations;
- confirmation that no runtime registration, persistence mutation, UI, rolls, sockets, or event content were added.
