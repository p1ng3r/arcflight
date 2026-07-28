# Gameplay V3 Milestone 2A — Fixed Operator Assignments and Occupied Stations

**Codex mode:** Code
**Repository:** `p1ng3r/arcflight`
**Working branch:** `codex/gameplay-v3-2a-fixed-operators`

Copy everything below this line into Codex.

---

TASK ID: GAMEPLAY-V3-M2A
TITLE: Implement fixed operator assignments and occupied stations

Repository: p1ng3r/arcflight
Working branch: codex/gameplay-v3-2a-fixed-operators

Read first:
- AGENTS.md
- docs/codex/CURRENT-GAMEPLAY-V3.md
- docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md
- docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md
- docs/gameplay-v3/reconciliation-and-continuation-roadmap.md
- data/stations/core-stations.js
- scripts/documents/ships.js
- scripts/voyage/domain/constants.js
- scripts/voyage/domain/defaults.js
- scripts/voyage/domain/state.js
- scripts/voyage/domain/validation.js
- scripts/voyage/domain/activation-readiness.js
- scripts/voyage/domain/activation-start-readiness.js
- scripts/voyage/domain/boundary-snapshots.js
- scripts/voyage/domain/crew-planning-completeness.js
- scripts/voyage/domain/crew-planning-readiness.js
- scripts/voyage/domain/station-selection.js
- related Voyage domain tests

## Goal

Implement only Milestone 2A:

- canonical Event Runner station identifiers;
- canonical station-to-Pressure-system ownership metadata;
- one fixed operator reference for every occupied station;
- named PC, named NPC, and crew-asset operators supported through one plain-data contract;
- no operator assigned to more than one station;
- assignments fixed for the full event;
- unoccupied stations allowed;
- Crew Planning selections required only for occupied stations;
- selections prohibited for unoccupied stations.

Do not implement later Crew Planning milestones.

## Canonical Event Runner stations

The Event Runner uses exactly these five canonical station IDs:

- captain
- engineer
- navigator
- watchmaster
- veilwarden

Their canonical Pressure-system ownership is:

- captain -> crew-morale
- engineer -> arkengine
- navigator -> levstone-array
- watchmaster -> solar-sail-rig
- veilwarden -> lifeveil

Expose this as immutable pure-domain metadata.

Do not delete, rename, or repurpose the broader ship-framework stations:

- pilot
- gunnery
- quartermaster

Those remain valid outside the canonical Event Runner subset.


## Existing ship assignment framework

Arcflight already stores persistent ship station assignments under:

flags.arcflight.system.stations.assignments

The existing assignment records support actor and crew-asset references through fields such as:

- stationKey
- assigneeType
- actorId
- actorUuid
- crewAssetId
- crewAssetUuid
- name
- notes

Reuse compatible terminology and identity rules where practical.

Voyage Event assignment state is an event-session snapshot. It must not mutate:

- source crew-asset Items;
- PF2e Actor system data;
- persistent ship station assignments;
- compendium content.

Do not import Foundry documents into the pure Voyage domain.

## Event-session assignment contract

Replace the ambiguous temporary-assignment concept with a clearly named canonical fixed-assignment collection.

The canonical state field should be:

stationAssignments

Remove temporaryStationAssignments from new Voyage defaults, normalization, snapshots, validation expectations, and tests.

Each assignment must be serializable plain data and must contain:

- one canonical stationId;
- one plain operator reference;
- an operator kind;
- a stable operator identity;
- a display name when available.

A compatible actor example is:

{
  stationId: "engineer",
  operator: {
    kind: "actor",
    id: "actor-id",
    uuid: "Actor.actor-id",
    name: "Chief Engineer"
  }
}

A compatible crew-asset example is:

{
  stationId: "engineer",
  operator: {
    kind: "crewAsset",
    id: "crew-entry-id",
    uuid: "Item.item-id",
    name: "Veteran Chief Engineer"
  }
}

The exact internal field names may be refined only when necessary to match established repository conventions. The resulting contract must remain explicit, deterministic, serializable, and documented by tests.

Named PCs and named NPCs must use the same actor-reference behavior. Do not add PF2e behavioral branches based on PC versus NPC.

An operator reference must contain at least one stable non-empty identity value:

- UUID preferred;
- ID accepted when UUID is unavailable.

Operator uniqueness must use kind plus stable identity. The same operator may not occupy two stations.

## Occupied stations

An occupied station is derived from a valid entry in stationAssignments.

Do not add a second independently persisted occupiedStations collection that could drift out of sync.

Derived occupied station IDs must:

- be unique;
- contain only canonical Event Runner station IDs;
- preserve deterministic assignment order or canonical station order;
- be returned as fresh arrays from reports;
- never expose mutable references into encounter state.

Any canonical station may be unoccupied unless a later authored requirement explicitly says otherwise.

Do not add authored required-station rules in this task.

## Assignment lifecycle

Assignments are event-wide, not round-local.

Provide pure-domain validation for fixed assignments.

Provide one atomic assignment-setting operation only where configuration is permitted. It must:

- require the appropriate pre-activation lifecycle;
- replace the complete assignment set atomically;
- reject malformed assignments;
- reject duplicate station IDs;
- reject duplicate operators;
- reject noncanonical Event Runner station IDs;
- clone input and output plain data;
- increment revision exactly once on success;
- emit one deterministic domain event;
- leave source state unchanged on success and failure.

Do not provide an Active-phase operator reassignment operation.

Activation readiness and activation-start readiness must reject malformed fixed assignments.

After activation, assignments remain part of encounter state and snapshots but are not editable through a normal mutation helper.

Do not add GM override behavior in this task.

## Crew Planning alignment

Update Crew Planning completeness so that:

- selections are required only for occupied stations;
- unoccupied available stations do not require selections;
- selections for unoccupied stations are invalid;
- optionality is no longer determined by selectionRequired;
- an occupied station still requires one valid selected action;
- station and action validation remains deterministic and hostile-data safe.

Remove Crew Planning dependence on selectionRequired.

Do not remove an authored selectionRequired property from imported objects merely because it exists. It should simply no longer control canonical completeness.

Readiness reports must expose fresh arrays for:

- occupiedStationIds
- selectedStationIds
- missingOccupiedStationIds

Legacy result names such as requiredStationIds and missingRequiredStationIds should be removed or replaced consistently throughout the focused domain and tests. Do not leave two competing completeness contracts.

Station selection validation and mutation must reject a selection whose station is not occupied.

Changing or clearing an existing occupied station action remains allowed during Crew Planning under the existing rules.

## Validation and hostile-data requirements

Follow the current Voyage-domain safety conventions:

- plain objects only;
- own properties only;
- sparse arrays handled deliberately;
- inherited array entries ignored;
- unsafe keys rejected;
- duplicate IDs rejected;
- exact IDs preserved;
- no silent trimming or identifier repair;
- no source mutation;
- no partial mutation;
- deterministic issue ordering;
- one revision increment for successful atomic mutations;
- no revision increment on failure.

Do not use JSON serialization as the clone mechanism.

## Snapshot and lifecycle requirements

Update boundary snapshots so fixed stationAssignments are preserved and deeply cloned.

Do not clear fixed assignments during:

- Situation to Crew Planning;
- Crew Planning locking;
- Resolution;
- Consequences;
- round cleanup.

Only round-local planning state should clear between rounds.

Do not implement round cleanup changes beyond what is strictly required to preserve fixed assignments.

## Tests

Add focused tests for the new assignment contract.

At minimum cover:

1. canonical station constants and Pressure ownership are immutable;
2. empty assignment collection is valid;
3. one actor operator assignment is valid;
4. one crew-asset operator assignment is valid;
5. actor and NPC references follow the same actor contract;
6. duplicate station assignments are rejected;
7. one operator assigned to two stations is rejected;
8. malformed operator references are rejected;
9. unsupported station IDs are rejected;
10. unsafe IDs or keys are rejected where applicable;
11. inherited and sparse array entries do not become assignments;
12. assignment mutation is atomic;
13. assignment mutation increments revision exactly once;
14. assignment mutation does not mutate source state or request data;
15. assignment changes are rejected after activation;
16. activation readiness rejects malformed assignments;
17. occupied stations require selections;
18. unoccupied stations do not require selections;
19. selections for unoccupied stations are rejected;
20. selectionRequired no longer controls completeness;
21. completeness and readiness arrays are fresh and isolated;
22. boundary snapshots deeply clone fixed assignments;
23. existing station-selection change and clear behavior remains valid for occupied stations;
24. related existing Voyage domain regressions continue to pass.

Use focused Node tests through direct commands, matching the repository convention.

Run:

node --test tests/voyage/domain/*.test.mjs

Also run syntax checks for every changed JavaScript file using:

node --check CHANGED_FILE

Report the exact test totals and exact commands actually run.

Do not claim Foundry runtime validation.

## Likely files

Expected changes may include:

- scripts/voyage/domain/constants.js
- scripts/voyage/domain/defaults.js
- scripts/voyage/domain/state.js
- scripts/voyage/domain/validation.js
- scripts/voyage/domain/boundary-snapshots.js
- scripts/voyage/domain/activation-readiness.js
- scripts/voyage/domain/activation-start-readiness.js
- scripts/voyage/domain/crew-planning-completeness.js
- scripts/voyage/domain/crew-planning-readiness.js
- scripts/voyage/domain/station-selection.js
- tests/voyage/domain/*

A new focused pure-domain module is allowed when it keeps responsibilities clear:

scripts/voyage/domain/station-assignments.js

Do not modify scripts/documents/ships.js unless a narrowly necessary compatibility correction is discovered and explicitly explained.

## Out of scope

Do not implement:

- action approach authoring or selection;
- exactly-three-actions validation;
- round-specific action generation;
- committed station order;
- canonical Risk Bid tiers;
- Risk Bid outcome interpretation;
- Focus;
- reactions;
- Pressure accumulation or Pressure Breaches;
- Hazards;
- Void Scars;
- round scoring;
- Momentum;
- event rewards;
- Misfortunes;
- Catastrophic Breakdown;
- PF2e roll-adapter changes;
- player UI;
- GM UI;
- sockets or multiplayer request transport;
- persistent ship assignment editing;
- public Foundry API exposure;
- module version changes;
- localization;
- imported event content;
- branch operations;
- commits;
- pushes;
- pull requests;
- Foundry launch or browser automation.

## Acceptance criteria

The task is complete only when:

- the canonical five station IDs and ownership metadata exist as immutable pure-domain constants;
- event state uses a fixed stationAssignments contract;
- temporaryStationAssignments is removed from new state and snapshots;
- occupied stations are derived solely from valid fixed assignments;
- each occupied station has exactly one operator;
- the same operator cannot occupy multiple stations;
- actors and crew assets are supported;
- PCs and NPCs share actor-reference behavior;
- assignments cannot normally change after activation;
- Crew Planning requires selections only for occupied stations;
- selections for unoccupied stations are invalid;
- selectionRequired no longer controls completeness;
- fixed assignments survive lifecycle and snapshot boundaries;
- source inputs remain unchanged;
- focused tests pass;
- the complete Voyage domain suite passes;
- no out-of-scope systems are added.

## Return

Return:

1. concise implementation summary;
2. complete changed-file list;
3. final assignment data shape;
4. exported constants and helpers;
5. lifecycle rules enforced;
6. Crew Planning behavior changed;
7. exact commands run;
8. exact test totals;
9. assumptions;
10. exact manual Foundry validation steps, clearly stating runtime validation was not performed;
11. known limitations;
12. anything not completed.

Do not commit, push, merge, rebase, reset, delete branches, or open a pull request.
