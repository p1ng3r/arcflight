import { prepareTravelV2EventOutcomePackage } from "./travel-v2-event-outcome-package.js";

export const TRAVEL_V2_SESSION_EVENT_OUTCOME_APPLICATION_VERSION = 1;
function cloneData(value) { if (value === null || value === undefined) return value; return JSON.parse(JSON.stringify(value)); }
function timestampFromOptions(options = {}) { const value = options.appliedAt ?? options.now; if (typeof value === "string" && value.trim()) return value.trim(); if (value instanceof Date) return value.toISOString(); if (typeof value === "function") { const produced = value(); if (typeof produced === "string" && produced.trim()) return produced.trim(); if (produced instanceof Date) return produced.toISOString(); } return new Date().toISOString(); }
export function applyTravelV2EventOutcomePackageToRunnerSession(session, options = {}) {
  const outcomePackage = prepareTravelV2EventOutcomePackage(session, options);
  if (outcomePackage.canPreparePackage !== true) return { ok: false, applied: false, session, outcomePackage, blockedReasons: cloneData(outcomePackage.blockedReasons), error: outcomePackage.blockedReasons[0] ?? "Travel v2 event outcome package cannot be prepared." };
  if (outcomePackage.alreadyApplied) return { ok: false, applied: false, session, outcomePackage, blockedReasons: ["Travel v2 event outcome package is already applied."], error: "Travel v2 event outcome package is already applied." };
  const applicationRecord = { version: TRAVEL_V2_SESSION_EVENT_OUTCOME_APPLICATION_VERSION, applied: true, appliedAt: timestampFromOptions(options), helperVersion: TRAVEL_V2_SESSION_EVENT_OUTCOME_APPLICATION_VERSION, packageVersion: outcomePackage.version, eventOutcomeKey: outcomePackage.eventOutcomeKey, eventOutcomeLabel: outcomePackage.eventOutcomeLabel, pressureSummary: cloneData(outcomePackage.pressureSummary), hazardSummary: cloneData(outcomePackage.hazardSummary), shipScarCandidates: cloneData(outcomePackage.shipScarCandidates), fortuneCandidates: cloneData(outcomePackage.fortuneCandidates), rewardCandidates: cloneData(outcomePackage.rewardCandidates), consequenceCandidates: cloneData(outcomePackage.consequenceCandidates), summaryText: outcomePackage.summaryText, nextStepText: outcomePackage.nextStepText };
  return { ok: true, applied: true, session: { ...cloneData(session), travelV2EventOutcomeApplication: applicationRecord }, originalSession: session, outcomePackage, applicationRecord, blockedReasons: [] };
}
export default applyTravelV2EventOutcomePackageToRunnerSession;
