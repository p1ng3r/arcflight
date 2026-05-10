# helpers

Reserved for shared helper modules. Phase 1 helper APIs are exposed from `game.arcflight` after module initialization.

## Ship reset / clear helpers

The following developer/GM helpers safely clear installed Arcflight ship-build data from an Arcflight-enabled PF2E vehicle actor without deleting actor items, source items, or compendium content:

- `game.arcflight.clearShipBuild(shipActor, options)`
- `game.arcflight.clearInstalledRooms(shipActor)`
- `game.arcflight.clearInstalledShipUpgrades(shipActor)`
- `game.arcflight.clearInstalledArkengineMods(shipActor)`
- `game.arcflight.clearCrewRoster(shipActor, options)`
- `game.arcflight.clearStationAssignments(shipActor)`
- `game.arcflight.clearComponentPatterns(shipActor)`
- `game.arcflight.applyCleanExampleShipBuild(shipActor, buildKey)`

`clearShipBuild` defaults to a full clean reset. Pass `{ preserveCurrentResources: true }`, `{ preserveCrew: true }`, or `{ preserveStations: true }` only when a test needs those runtime values preserved.
