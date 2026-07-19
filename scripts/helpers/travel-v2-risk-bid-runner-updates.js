import { clearTravelV2RiskBidSelectionForRunnerSession, selectTravelV2RiskBidForRunnerSession } from "./travel-v2-risk-bids.js";

function selectionFromState(riskBids = {}, tier = null) {
  return {
    roundIndex: Number.isInteger(riskBids?.roundIndex) ? riskBids.roundIndex : riskBids?.selectedRecord?.roundIndex ?? null,
    roundNumber: Number.isInteger(riskBids?.roundNumber) ? riskBids.roundNumber : riskBids?.selectedRecord?.roundNumber ?? null,
    stationKey: typeof riskBids?.stationKey === "string" ? riskBids.stationKey : "",
    actionId: typeof riskBids?.actionId === "string" ? riskBids.actionId : "",
    ...(tier == null ? {} : { tier })
  };
}

function updateResult(currentSession, result) {
  const shouldUpdateSession = result?.ok === true && result?.session !== undefined;
  return { result, nextSession: shouldUpdateSession ? result.session : currentSession, shouldUpdateSession, shouldRerender: shouldUpdateSession };
}

export function prepareTravelV2RiskBidSelectRunnerUpdate(currentSession, riskBids = {}, tier, options = {}) {
  return updateResult(currentSession, selectTravelV2RiskBidForRunnerSession(currentSession, selectionFromState(riskBids, tier), options));
}

export function prepareTravelV2RiskBidClearRunnerUpdate(currentSession, riskBids = {}, options = {}) {
  return updateResult(currentSession, clearTravelV2RiskBidSelectionForRunnerSession(currentSession, selectionFromState(riskBids), options));
}
