# arkengine-mods

Arkengine Mods are engine-only tuning and specialization components. They are PF2E equipment items with `flags.arcflight.componentType = "arkengineMod"` and their schema data stored under `flags.arcflight.system`.

Starter locked entries live in `core-arkengine-mods.js`. They consume installed arkengine mod slots and can modify only supported arkengine-related actor-owned derived stats. They must not mutate source hull, arkengine, room, ship upgrade, or mod items.

This phase does not implement Hard Burn resolution, Overcharge resolution, travel gameplay, combat gameplay, AP/RAP spending, station actions, voyage events, damage automation, condition gameplay, GM generators, or drag-and-drop installation.

## Tier / Refit Metadata

Core arkengine mods now carry advisory tier/refit metadata. Utility and stability mods generally add low `enginePressure` or `lifeveilPressure`; risky burst-output or overburn mods add higher `enginePressure`; ritual/deep-void mods can also add `occultPressure`. These fields prepare future install validation but do not prevent installs or automate Hard Burn, Overcharge, travel, or combat.
