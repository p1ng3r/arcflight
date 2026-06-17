# weapons

Data-only Arcflight weapon component foundation.

Weapons remain PF2E `equipment` Items with `flags.arcflight.enabled = true`, `flags.arcflight.componentType = "weapon"`, and Arcflight source data stored under `flags.arcflight.system`.

`core-weapons.js` provides starter source entries plus `getCoreWeapon(key)` and `getCoreWeaponKeys()`. The runtime creation helpers are exposed from `scripts/documents/creation.js` as `createCoreWeapon(key)` and `createWeapon(key)`.

This folder intentionally does not implement weapon install/removal helpers, weapon UI, combat firing, attack rolls, damage rolls, ammo tracking, AP/RAP, or station actions.
