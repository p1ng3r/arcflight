# crew

Core crew asset data for the lightweight Arcflight crew assignment framework.

Crew assets remain PF2E equipment items with `flags.arcflight.componentType = "crewAsset"` when created through `game.arcflight.createCoreCrewAsset(key)`. Runtime roster state belongs on the Arcflight-enabled ship actor under `flags.arcflight.system.crew.namedCrew`; source crew asset items are not mutated by roster helpers.

The core crew asset registry currently contains 15 lightweight named specialists: the original five starter crew assets plus Grizzled Bosun, Voidscarred Helmsman, Junior Engine Apprentice, Occult Veil Adept, Old Star Cartographer, Powdermaster Gunner, Quiet Smuggler Contact, Shipboard Surgeon, Morale Cook, and Hull Patcher. These entries provide station assignment metadata, traits, and placeholder capability hooks only; they do not add passive modifier spam, morale gameplay, wages, injury automation, station actions, travel, or combat systems.

## Tier / Refit Metadata

Core crew assets now include light advisory tier/refit metadata. Most named specialists remain low or zero pressure, while veteran gunners, engineers, command crew, and occult veil specialists can add small pressure totals to represent crew/command complexity. Roster helpers still only copy data onto ship-owned crew state and do not automate morale, wages, injury, station actions, travel, or combat.
