export const TRAVEL_V2_HAZARD_DECK_VERSION = 1;

export const TRAVEL_V2_HAZARD_DECK = Object.freeze([
  Object.freeze({ id: "hazard-void-shear", name: "Void Shear", category: "navigation", pressureContext: "A sharp route correction or unstable lane edge strains the ship.", triggerContext: "Drawn when event pressure reaches a Travel v2 hazard threshold.", description: "Invisible lateral force tugs the vessel off its intended vector.", gmText: "Ask who notices the shear first and what they risk to keep the route stable. If applied later, choose a manual consequence appropriate to the scene.", playerText: "The route shivers sideways, and the ship groans as the helm fights an unseen pull." }),
  Object.freeze({ id: "hazard-arkengine-cough", name: "Arkengine Cough", category: "engineering", pressureContext: "Mounting pressure makes the arkengine run unevenly.", triggerContext: "Drawn when event pressure reaches a Travel v2 hazard threshold.", description: "The drive hiccups, throwing timing, heat, and rhythm out of alignment.", gmText: "Frame this as a temporary engineering problem. Do not change actor or item data unless the GM later applies a separate manual effect.", playerText: "A hard cough rolls through the engine room before the drive catches again." }),
  Object.freeze({ id: "hazard-fading-lifeveil", name: "Fading Lifeveil", category: "lifeveil", pressureContext: "The route or hazard field presses against the ship's protective envelope.", triggerContext: "Drawn when event pressure reaches a Travel v2 hazard threshold.", description: "The lifeveil thins in pulses, revealing the hostile void beyond the hull.", gmText: "Use this to spotlight Veilwarden decisions, eerie sensory details, or a manual follow-up. Do not automatically reduce resources.", playerText: "The lifeveil dims in slow pulses, and distant cold presses close to the glass." }),
  Object.freeze({ id: "hazard-low-stores-alarm", name: "Low Stores Alarm", category: "supplies", pressureContext: "Stress reveals spoilage, ration confusion, or cargo access trouble.", triggerContext: "Drawn when event pressure reaches a Travel v2 hazard threshold.", description: "A manifest discrepancy or physical blockage makes essential stores harder to reach.", gmText: "Present an operational choice or future manual consequence. This hazard is advisory until the GM applies something explicitly.", playerText: "A stores alarm sounds: something essential is harder to reach than it should be." }),
  Object.freeze({ id: "hazard-crew-on-edge", name: "Crew on Edge", category: "morale", pressureContext: "Repeated stress spreads through the crew before anyone admits it.", triggerContext: "Drawn when event pressure reaches a Travel v2 hazard threshold.", description: "Rumors, fatigue, or superstition make routine orders harder to land.", gmText: "Invite leadership or roleplay pressure. Keep any morale/resource change manual and explicit.", playerText: "The crew grows quiet, tense, and too quick to look toward the dark between stars." })
]);

export function getTravelV2HazardDeck() {
  return TRAVEL_V2_HAZARD_DECK.map((hazard) => ({ ...hazard }));
}

export function getTravelV2HazardById(id) {
  return getTravelV2HazardDeck().find((hazard) => hazard.id === id) ?? null;
}
