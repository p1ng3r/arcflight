const STATION_ICON_DEFINITIONS = Object.freeze({
  captain: Object.freeze({ file: "captain_icon.webp", displayName: "Captain", abbreviation: "CAP", themeClass: "station-theme--captain", accent: "#9b4b45" }),
  navigator: Object.freeze({ file: "navigator_icon.webp", displayName: "Navigator", abbreviation: "NAV", themeClass: "station-theme--navigator", accent: "#4d7da5" }),
  watchmaster: Object.freeze({ file: "watchmaster_icon.webp", displayName: "Watchmaster", abbreviation: "WATCH", themeClass: "station-theme--watchmaster", accent: "#5f8a62" }),
  veilwarden: Object.freeze({ file: "veilwarden_icon.webp", displayName: "Veilwarden", abbreviation: "VEIL", themeClass: "station-theme--veilwarden", accent: "#8966a6" }),
  engineer: Object.freeze({ file: "engineer_icon.webp", displayName: "Engineer", abbreviation: "ENG", themeClass: "station-theme--engineer", accent: "#b9783d" })
});

export const VOYAGE_STATION_ICON_REGISTRY = STATION_ICON_DEFINITIONS;

export function stationPresentation(stationId) {
  const definition = STATION_ICON_DEFINITIONS[stationId];
  if (!definition) {
    const fallback = typeof stationId === "string" && stationId.length > 0
      ? stationId.replace(/[-_]+/g, " ").replace(/(^|\s)(\w)/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
      : "Unknown Station";
    return {
      stationIconKey: stationId ?? null,
      stationIconPath: null,
      stationDisplayName: fallback,
      stationIconTitle: `${fallback} Station`,
      stationAbbreviation: fallback.slice(0, 4).toUpperCase(),
      stationThemeClass: "station-theme--unknown",
      stationAccent: "#8d6a3d",
      stationIconSize: 48,
      stationIconMajorSize: 56
    };
  }
  return {
    stationIconKey: stationId,
    stationIconPath: `modules/arcflight/assets/ui/stations/${definition.file}`,
    stationDisplayName: definition.displayName,
    stationIconTitle: `${definition.displayName} Station`,
    stationAbbreviation: definition.abbreviation,
    stationThemeClass: definition.themeClass,
    stationAccent: definition.accent,
    stationIconSize: 48,
    stationIconMajorSize: 56
  };
}
