# Ship Upgrades Data

Phase 4.5 defines Ship Upgrades as permanent installed ship improvements stored on PF2E equipment items with `flags.arcflight.componentType = "shipUpgrade"`.

Ship Upgrades are not rooms, arkengines, arkengine mods, or runtime effects. They may describe structural retrofits, operational enhancements, tactical infrastructure, command systems, military refits, exposed hardware, or vessel-wide enhancement packages.

The Standard core upgrade library currently contains 28 entries, including persistent structural, Lifeveil, detection, support, mobility, deep-void, occult, command, logistics, and strain platform improvements.

Only Standard core upgrades are implemented in this phase. Placeholder interactions are stored as data for later combat, travel, station, and event systems; they are not resolved by Phase 4.5 automation.

## Tier / Refit Metadata

Core ship upgrades now include advisory tier/refit metadata. Small utility upgrades are low pressure, structural refits such as Reinforced Structural Ribbing contribute `infrastructurePressure`, command networks contribute `crewCommandPressure`, Lifeveil upgrades contribute `lifeveilPressure`, occult hardware contributes `occultPressure`, and military/propulsion systems contribute weapon or engine pressure. The metadata is data-only and does not block installation.
