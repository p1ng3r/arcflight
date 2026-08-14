const RESOURCE_ICON_DEFINITIONS = Object.freeze({
  focus: Object.freeze({ file: "focus_icon.webp", title: "Focus", size: 40 }),
  riskBid: Object.freeze({ file: "risk_bid_icon.webp", title: "Risk Bid Available", size: 40 }),
  riskBid2: Object.freeze({ file: "risk_bid_icon_+2.webp", title: "Risk Bid +2", size: 64 }),
  riskBid5: Object.freeze({ file: "risk_bid_icon_+5.webp", title: "Risk Bid +5", size: 64 }),
  riskBid8: Object.freeze({ file: "risk_bid_icon_+8.webp", title: "Risk Bid +8", size: 64 })
});

export const VOYAGE_RESOURCE_ICON_REGISTRY = RESOURCE_ICON_DEFINITIONS;

export function resourcePresentation(resourceKey, tier = null) {
  const key = resourceKey === "riskBid" && [2, 5, 8].includes(Number(tier))
    ? `riskBid${Number(tier)}`
    : resourceKey;
  const definition = RESOURCE_ICON_DEFINITIONS[key];
  if (!definition) {
    const fallback = typeof resourceKey === "string" && resourceKey.length > 0 ? resourceKey : "resource";
    return {
      resourceIconKey: key ?? null,
      resourceIconPath: null,
      resourceIconTitle: fallback,
      resourceIconSize: 40,
      resourceIconLargeSize: 64
    };
  }
  return {
    resourceIconKey: key,
    resourceIconPath: `modules/arcflight/assets/ui/resources/${definition.file}`,
    resourceIconTitle: definition.title,
    resourceIconSize: definition.size,
    resourceIconLargeSize: 64
  };
}
