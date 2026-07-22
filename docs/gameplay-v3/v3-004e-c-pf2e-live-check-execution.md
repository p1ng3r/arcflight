# V3-004E-C — Live PF2e Check Execution

Preflight and execution share `resolveVoyagePf2ePendingCheckContext`: one execution captures the caller dependencies once and resolves UUID, Actor, and the first authored Statistic exactly once. The live context never escapes. The execution contract is four own callable functions: `resolveUuid`, `getActorFromResolvedDocument`, `getStatistic`, and `rollStatistic`.

The Foundry wrapper captures `runtime.fromUuid` once and invokes that exact function once with the **original runtime object** as receiver. It captures `statistic.roll` once and calls it once with the Statistic receiver. PF2e receives exactly `{ dc, messageMode, skipDialog: true, createMessage: true, identifier }`; public is `publicroll`, secret is `blindroll`.

Success returns only `{ total, degreeOfSuccess, degreeOfSuccessSlug }`: degree 0–3 maps to `critical-failure`, `failure`, `success`, and `critical-success`. Errors are `voyage-pf2e-invalid-execution-dependencies`, `voyage-pf2e-statistic-roll-unavailable`, `voyage-pf2e-roll-failed`, `voyage-pf2e-roll-cancelled`, and `voyage-pf2e-invalid-roll-result`, alongside retained preflight/runtime codes.

One successful call creates one live PF2e chat roll. Chat creation is the only intended mutation: no Actor, Token, encounter, or pending-check mutation occurs. Duplicate prevention, result persistence, and Consequences transition remain deferred to V3-004F.

## Manual Foundry validation (not run in cloud)

```js
const api=game.arcflight; const actor=game.actors.contents[0]; const token=canvas.tokens.placeables[0]?.document;
const make=(uuid,secrecy,id)=>({pendingCheckId:id,sequence:0,status:"pending",result:null,mode:"check",source:{kind:"character",uuid},statisticOptions:["athletics","perception"],dcSource:{kind:"fixed",value:20},secrecy});
const actorBefore=actor.toObject(), tokenBefore=token?.toObject(), encounterBefore=game.combat?.toObject();
const publicCheck=make(actor.uuid,"public","manual-live-public"); const before=game.messages.size;
const publicResult=await api.executeVoyagePf2ePendingCheckInFoundry(publicCheck); console.assert(game.messages.size===before+1,publicResult);
const secretCheck=make(token.uuid,"secret","manual-live-secret"); const secretBefore=game.messages.size;
const secretResult=await api.executeVoyagePf2ePendingCheckInFoundry(secretCheck); console.assert(game.messages.size===secretBefore+1,secretResult);
console.assert(Number.isFinite(publicResult.result.total)&&publicResult.result.degreeOfSuccess>=0&&publicResult.result.degreeOfSuccess<=3);
console.assert(!Object.values(publicResult).some(x=>x===actor||x===token)); console.assert(JSON.stringify(actor.toObject())===JSON.stringify(actorBefore)); console.assert(JSON.stringify(token?.toObject())===JSON.stringify(tokenBefore)); console.assert(JSON.stringify(game.combat?.toObject())===JSON.stringify(encounterBefore)); console.assert(publicCheck.status==="pending"&&publicCheck.result===null);
const unknown=make(actor.uuid,"public","manual-live-unknown"); unknown.statisticOptions=["not-a-statistic"]; const noMessage=game.messages.size; console.assert((await api.executeVoyagePf2ePendingCheckInFoundry(unknown)).ok===false&&game.messages.size===noMessage);
```

Each successful invocation makes a real chat roll: run each case once.
