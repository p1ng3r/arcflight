# rooms

Phase 4 room framework data lives in `core-rooms.js`.

Rooms are Arcflight ship infrastructure stored on PF2E equipment items under `flags.arcflight.system` with `flags.arcflight.componentType = "room"`.

- Core Rooms are mandatory hull-provided infrastructure and do not consume expansion room slots.
- Expansion Rooms are installed ship infrastructure and consume expansion room slots.
- Rooms support downtime, crafting, recovery, narrative identity, lifestyle, and logistics.
- Rooms do not directly modify combat speed, AP, RAP, weapon damage, travel speed, or maneuverability.

## Tier / Refit Metadata

Core rooms now include safe tier/refit metadata. Core hull-provided rooms remain zero-pressure infrastructure, while installable expansion rooms contribute advisory pressure such as `infrastructurePressure`, `lifeveilPressure`, `crewCommandPressure`, `weaponPressure`, or `occultPressure` based on room role. Observatory and ritual-style rooms explicitly model occult/Lifeveil pressure for future validation. No room grants direct combat or travel automation.
