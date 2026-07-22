# V3-004E-C — Live PF2e Check Execution

Execution shares `resolveVoyagePf2ePendingCheckContext` with preflight, so UUID, Actor, and authored Statistic resolution happen once. It captures the four own callable dependencies (`resolveUuid`, `getActorFromResolvedDocument`, `getStatistic`, `rollStatistic`) once. The Foundry wrapper reads `runtime.fromUuid` once and invokes the captured resolver with the original runtime receiver; it captures `Statistic.roll` once with the Statistic receiver.

PF2e receives exactly `{ dc, messageMode, skipDialog: true, createMessage: true, identifier }`. Public uses `publicroll`; secret uses `blindroll`. The isolated success result is `{ total, degreeOfSuccess, degreeOfSuccessSlug }`, mapping `0..3` to `critical-failure`, `failure`, `success`, and `critical-success`. Failures include `voyage-pf2e-invalid-execution-dependencies`, `voyage-pf2e-statistic-roll-unavailable`, `voyage-pf2e-roll-failed`, `voyage-pf2e-roll-cancelled`, and `voyage-pf2e-invalid-roll-result`.

**Every successful call creates a real PF2e chat roll. Invoke each case once only.** Chat creation is the sole intended mutation. No Actor, Token, encounter, or pending-check update occurs; duplicate prevention, persistence, result application, and Consequences transition are deferred to V3-004F.

## Manual Foundry validation (not run in cloud)

Paste this as one block in a PF2e v14 browser console. It throws clear errors when suitable documents are unavailable.

```js
const api = game.arcflight;
for (const key of ["executeVoyagePf2ePendingCheck", "validateVoyagePf2eExecutionDependencies", "createVoyagePf2eRuntimeExecutionDependencies", "executeVoyagePf2ePendingCheckInFoundry"]) {
  if (typeof api?.[key] !== "function" || typeof api?.devTools?.[key] !== "function") throw new Error(`Missing Arcflight helper: ${key}`);
}
const actor = game.actors.contents.find(a => ["character", "npc"].includes(a.type) && (a.getStatistic("athletics") || a.getStatistic("perception")));
if (!actor) throw new Error("No character or NPC Actor with Athletics or Perception is available.");
const token = canvas.tokens.placeables.map(t => t.document).find(d => d?.actor && (d.actor.getStatistic("athletics") || d.actor.getStatistic("perception")));
if (!token) throw new Error("No placed TokenDocument or synthetic Token Actor with Athletics or Perception is available.");
const make = (uuid, secrecy, id) => ({ pendingCheckId:id, sequence:0, status:"pending", result:null, mode:"check", source:{kind:"character",uuid}, statisticOptions:["athletics","perception"], dcSource:{kind:"fixed",value:20}, secrecy });
const degrees = ["critical-failure", "failure", "success", "critical-success"];
const noLive = value => { const seen = new Set(); const walk = v => { if (!v || typeof v !== "object" || seen.has(v)) return true; seen.add(v); if (v === actor || v === token || v?.documentName === "Actor" || v?.constructor?.name === "Roll" || "terms" in v || "dice" in v || "options" in v || v?.documentName === "ChatMessage") return false; return Object.values(v).every(walk); }; return walk(value); };
const actorBefore = actor.toObject(), tokenBefore = token.toObject(), encounterBefore = game.combat?.toObject();
const publicCheck = make(actor.uuid, "public", "manual-live-public"); const publicCount = game.messages.size;
const publicResult = await api.executeVoyagePf2ePendingCheckInFoundry(publicCheck);
if (game.messages.size !== publicCount + 1) throw new Error("Public check did not create exactly one message.");
const publicMessage = game.messages.contents.at(-1); if (publicMessage.blind) throw new Error("Public message is unexpectedly blind.");
const secretCheck = make(token.uuid, "secret", "manual-live-secret"); const secretCount = game.messages.size;
const secretResult = await api.executeVoyagePf2ePendingCheckInFoundry(secretCheck);
if (game.messages.size !== secretCount + 1) throw new Error("Secret check did not create exactly one message.");
const secretMessage = game.messages.contents.at(-1); if (!secretMessage.blind && !secretMessage.whisper?.length) throw new Error("Secret message is neither blind nor GM-only.");
for (const result of [publicResult, secretResult]) { if (!Number.isFinite(result.result?.total) || !Number.isSafeInteger(result.result?.degreeOfSuccess) || result.result.degreeOfSuccess < 0 || result.result.degreeOfSuccess > 3 || result.result.degreeOfSuccessSlug !== degrees[result.result.degreeOfSuccess] || !noLive(result)) throw new Error("Result is invalid or leaked a live object."); }
const unknown = make(actor.uuid,"public","manual-live-unknown"); unknown.statisticOptions=["not-a-statistic"]; const beforeUnknown=game.messages.size; if ((await api.executeVoyagePf2ePendingCheckInFoundry(unknown)).ok || game.messages.size!==beforeUnknown) throw new Error("Unknown statistic created a message.");
const beforeRuntime=game.messages.size; if ((await api.executeVoyagePf2ePendingCheckInFoundry(publicCheck,{})).ok || game.messages.size!==beforeRuntime) throw new Error("Invalid runtime created a message.");
if (JSON.stringify(actor.toObject())!==JSON.stringify(actorBefore) || JSON.stringify(token.toObject())!==JSON.stringify(tokenBefore) || JSON.stringify(game.combat?.toObject())!==JSON.stringify(encounterBefore) || publicCheck.status!=="pending" || publicCheck.result!==null || secretCheck.status!=="pending" || secretCheck.result!==null) throw new Error("Execution mutated protected state.");
console.log({publicResult,secretResult});
```
