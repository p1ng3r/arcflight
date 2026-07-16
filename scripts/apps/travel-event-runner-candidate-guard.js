import { ArcflightTravelEventRunner } from "./travel-event-runner.js";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";

export const TRAVEL_EVENT_RUNNER_CANDIDATE_GUARD_VERSION = 1;

const PATCH_MARKER = Symbol.for("arcflight.travelV2RoundActionOrderCandidateGuard.v1");
const STALE_CANDIDATE_REASON = "Round action-order candidate belongs to a different runner session or round and was cleared.";

function integerRoundIndex(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

export function prepareTravelV2RoundActionOrderCandidateContext(session = null, options = {}) {
  return {
    sessionKey: session?.key ?? options.selectedSessionKey ?? "",
    roundIndex: integerRoundIndex(session?.currentRoundIndex)
  };
}

export function inspectTravelV2RoundActionOrderCandidateContext(app = null) {
  const uiState = app?.uiState ?? {};
  const hasCandidate = uiState.travelV2RoundActionOrderReorderRequested === true
    || (Array.isArray(uiState.travelV2ProposedRoundActionOrder) && uiState.travelV2ProposedRoundActionOrder.length > 0);
  const currentContext = prepareTravelV2RoundActionOrderCandidateContext(app?.session, { selectedSessionKey: app?.selectedSessionKey });
  const candidateContext = uiState.travelV2RoundActionOrderCandidateContext;
  const matches = !hasCandidate || Boolean(
    candidateContext
    && candidateContext.sessionKey === currentContext.sessionKey
    && Number(candidateContext.roundIndex) === currentContext.roundIndex
  );
  return {
    hasCandidate,
    matches,
    stale: hasCandidate && !matches,
    currentContext,
    candidateContext: candidateContext ?? null,
    reason: hasCandidate && !matches ? STALE_CANDIDATE_REASON : ""
  };
}

export function sanitizeTravelV2RoundActionOrderCandidateContext(app = null) {
  const inspection = inspectTravelV2RoundActionOrderCandidateContext(app);
  if (inspection.stale) clearTravelV2RoundActionOrderCandidateUiState(app);
  return inspection;
}

export function clearTravelV2RoundActionOrderCandidateUiState(app = null) {
  if (!app?.uiState) return false;
  app.uiState.travelV2RoundActionOrderReorderRequested = false;
  app.uiState.travelV2ProposedRoundActionOrder = [];
  app.uiState.travelV2RoundActionOrderCandidateContext = null;
  return true;
}

function blockedCommitUpdate(app, reason, options = {}) {
  const user = options.user ?? globalThis.game?.user;
  const isGm = options.isGM ?? user?.isGM === true;
  clearTravelV2RoundActionOrderCandidateUiState(app);
  const result = {
    ok: false,
    committed: false,
    duplicate: false,
    blocked: true,
    playerSafe: !isGm,
    reason,
    blockedReasons: [reason]
  };
  app.uiState.travelV2RoundActionOrderCommitResult = result;
  app.statusMessage = reason;
  globalThis.ui?.notifications?.warn?.(reason);
  app.render?.(true);
  return {
    result,
    nextSession: app.session,
    shouldUpdateSession: false,
    shouldRerender: true
  };
}

export function installTravelV2RoundActionOrderCandidateGuard() {
  const prototype = ArcflightTravelEventRunner?.prototype;
  if (!prototype || prototype[PATCH_MARKER] === true) return false;

  const prepareContext = prototype._prepareContext;
  const commitOrder = prototype.commitTravelV2RoundActionOrder;

  Object.defineProperty(prototype, PATCH_MARKER, { value: true, configurable: false, enumerable: false, writable: false });

  prototype._prepareContext = async function guardedPrepareContext(options) {
    const inspection = sanitizeTravelV2RoundActionOrderCandidateContext(this);
    if (inspection.stale) this.statusMessage = inspection.reason;
    return prepareContext.call(this, options);
  };

  prototype.commitTravelV2RoundActionOrder = async function guardedCommitTravelV2RoundActionOrder(options = {}) {
    const inspection = inspectTravelV2RoundActionOrderCandidateContext(this);
    if (inspection.stale) return blockedCommitUpdate(this, inspection.reason, options);

    if (inspection.hasCandidate) {
      const user = options.user ?? globalThis.game?.user;
      const isGm = options.isGM ?? user?.isGM === true;
      const state = prepareTravelV2RoundActionOrderState(this.session, {
        user,
        isGM: isGm,
        proposedOrder: this.uiState.travelV2ProposedRoundActionOrder,
        travelV2RoundActionOrderReorderRequested: this.uiState.travelV2RoundActionOrderReorderRequested === true
      });
      const canReorder = state.reorderInteraction?.canReorder === true && state.reorderInteraction?.keyboardEnabled === true;
      const ready = state.reorderRequest?.ready === true;
      if (!canReorder || !ready) {
        const reason = state.reorderInteraction?.blockedReason
          || state.reorderRequest?.blockedReasons?.[0]
          || state.reorderRequest?.feedbackText
          || "Round action-order candidate cannot be committed in the current runner state.";
        return blockedCommitUpdate(this, reason, options);
      }
    }

    return commitOrder.call(this, options);
  };

  return true;
}

installTravelV2RoundActionOrderCandidateGuard();

export default installTravelV2RoundActionOrderCandidateGuard;
