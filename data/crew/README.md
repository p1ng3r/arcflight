# crew

Core crew asset data for the lightweight Arcflight crew assignment framework.

Crew assets remain PF2E equipment items with `flags.arcflight.componentType = "crewAsset"` when created through `game.arcflight.createCoreCrewAsset(key)`. Runtime roster state belongs on the Arcflight-enabled ship actor under `flags.arcflight.system.crew.namedCrew`; source crew asset items are not mutated by roster helpers.
