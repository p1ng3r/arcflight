const STATION_ICON_DEFINITIONS = Object.freeze({
  captain: Object.freeze({ file: "captain_icon.webp", displayName: "Captain", abbreviation: "CAP" }),
  navigator: Object.freeze({ file: "navigator_icon.webp", displayName: "Navigator", abbreviation: "NAV" }),
  watchmaster: Object.freeze({ file: "watchmaster_icon.webp", displayName: "Watchmaster", abbreviation: "WATCH" }),
  veilwarden: Object.freeze({ file: "veilwarden_icon.webp", displayName: "Veilwarden", abbreviation: "VEIL" }),
  engineer: Object.freeze({ file: "engineer_icon.webp", displayName: "Engineer", abbreviation: "ENG" })
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
    stationIconSize: 48,
    stationIconMajorSize: 56
  };
}
