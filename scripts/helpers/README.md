# helpers

Reserved for shared helper modules. Current Framework Foundation helper APIs are exposed from `game.arcflight` after module initialization. Install preview helpers are read-only, while supported controlled installs now use `shouldBlockInstall()` to enforce danger validation, slot overflow, duplicate protected installs, and unique crew conflicts without mutating source or compendium items.

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

## Install-state and validation helpers

Current install-state and validation helpers exposed from `game.arcflight` include:

- `game.arcflight.previewInstallValidation(shipActor, component)`
- `game.arcflight.previewComponentInstall(shipActor, component)`
- `game.arcflight.getInstallValidationWarnings(shipActor, component)`
- `game.arcflight.shouldBlockInstall(preview)`
- `game.arcflight.createInstallId(componentType)`
- `game.arcflight.getInstallState(shipActor)`
- `game.arcflight.getActiveInstallRecords(shipActor)`
- `game.arcflight.getInactiveInstallRecords(shipActor)`
- `game.arcflight.recordInstallState(shipActor, installRecord)`
- `game.arcflight.deactivateInstallRecord(shipActor, installId, options)`
- `game.arcflight.deactivateInstallRecordsByComponent(shipActor, componentMatcher, options)`
- `game.arcflight.findShipsMissingInstallState()`
- `game.arcflight.backfillInstallStateForShip(shipActor, options)`
- `game.arcflight.backfillInstallStateForAllShips(options)`

Matching aliases are also available under `game.arcflight.devTools` for console-driven validation and maintenance.
