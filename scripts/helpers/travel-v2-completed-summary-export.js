function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function text(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function summaryFromSession(session) {
  if (isPlainObject(session?.travelV2CompletionSummary)) return session.travelV2CompletionSummary;
  if (isPlainObject(session?.travelV2EventCompletion?.summary)) return session.travelV2EventCompletion.summary;
  return null;
}

function completedBy(session, includeGmSummary) {
  if (!includeGmSummary) return "";
  return text(session?.completedByUserName) || text(session?.travelV2EventCompletion?.completedByUserName);
}

function publicFollowups(followups = [], includeGmSummary = false) {
  return (Array.isArray(followups) ? followups : []).map((followup) => ({
    id: text(followup?.id),
    title: text(followup?.title, "Follow-up"),
    status: text(followup?.status, "pending"),
    publicSummary: text(followup?.publicSummary),
    ...(includeGmSummary ? { gmSummary: text(followup?.gmSummary), privateText: text(followup?.text) } : {})
  }));
}

function publicRounds(rounds = []) {
  return (Array.isArray(rounds) ? rounds : []).map((round) => ({
    roundIndex: Number.isFinite(Number(round?.roundIndex)) ? Number(round.roundIndex) : null,
    roundNumber: Number.isFinite(Number(round?.roundNumber)) ? Number(round.roundNumber) : null,
    title: text(round?.title, `Round ${round?.roundNumber ?? ""}`.trim()),
    status: text(round?.status),
    stationResults: (Array.isArray(round?.stationResults) ? round.stationResults : []).map((result) => ({
      stationKey: text(result?.stationKey),
      stationName: text(result?.stationName, text(result?.stationKey, "Station")),
      approachLabel: text(result?.approachLabel),
      resultLabel: text(result?.resultLabel, "Unrecorded"),
      degreeOfSuccess: text(result?.degreeOfSuccess),
      total: Number.isFinite(Number(result?.total)) ? Number(result.total) : null,
      dc: Number.isFinite(Number(result?.dc)) ? Number(result.dc) : null,
      actorName: text(result?.actorName),
      playerName: text(result?.playerName),
      focusUsed: result?.focusUsed === true,
      rerollUsed: result?.rerollUsed === true,
      publicSummary: text(result?.publicSummary)
    })),
    consequenceCounts: {
      generated: Array.isArray(round?.consequencesGenerated) ? round.consequencesGenerated.length : 0,
      handled: Array.isArray(round?.consequencesHandled) ? round.consequencesHandled.length : 0
    }
  }));
}

export function buildTravelV2CompletedSummaryExportState(session, options = {}) {
  const includeGmSummary = options.includeGmSummary === true;
  const summary = summaryFromSession(session);
  if (!isPlainObject(summary)) return { ok: false, available: false, reason: "No completed Travel v2 summary available.", includeGmSummary, playerSafe: !includeGmSummary, summary: null };
  const state = {
    ok: true,
    available: true,
    includeGmSummary,
    playerSafe: !includeGmSummary,
    generatedKindLabel: includeGmSummary ? "GM export generated" : "Player-safe export generated",
    eventTitle: text(summary.eventTitle, "Travel Event"),
    shipName: text(summary.actorName || summary.shipName || session?.actorName || session?.shipName),
    completedAt: text(summary.completedAt || session?.completedAt),
    completedBy: completedBy(session, includeGmSummary),
    finalOutcomeLabel: text(summary.finalOutcomeLabel, "Travel complete"),
    publicSummary: {
      title: text(summary.publicSummary?.title, text(summary.finalOutcomeLabel, "Travel complete")),
      paragraphs: (Array.isArray(summary.publicSummary?.paragraphs) ? summary.publicSummary.paragraphs : []).map((p) => text(p)).filter(Boolean),
      chips: (Array.isArray(summary.publicSummary?.chips) ? summary.publicSummary.chips : []).map((p) => text(p)).filter(Boolean)
    },
    rounds: publicRounds(summary.rounds),
    totals: {
      consequencesApplied: Number(summary.totals?.consequencesApplied) || 0,
      consequencesDismissed: Number(summary.totals?.consequencesDismissed) || 0,
      consequencesPending: Number(summary.totals?.consequencesPending) || 0,
      resourceDeltas: cloneData(isPlainObject(summary.totals?.resourceDeltas) ? summary.totals.resourceDeltas : {})
    },
    followups: publicFollowups(summary.followups, includeGmSummary)
  };
  if (includeGmSummary) state.gmSummary = { paragraphs: (summary.gmSummary?.paragraphs ?? []).map((p) => text(p)).filter(Boolean), nextSteps: (summary.gmSummary?.nextSteps ?? []).map((p) => text(p)).filter(Boolean), warnings: (summary.gmSummary?.warnings ?? []).map((p) => text(p)).filter(Boolean) };
  return state;
}

function listLines(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None recorded.";
}

export function buildTravelV2CompletedSummaryMarkdown(session, options = {}) {
  const state = buildTravelV2CompletedSummaryExportState(session, options);
  if (!state.available) return { ...state, markdown: "" };
  const lines = [`# Travel v2 Summary — ${state.eventTitle}`, "", `- **Ship:** ${state.shipName || "Unrecorded"}`, `- **Completed At:** ${state.completedAt || "Unrecorded"}`];
  if (state.completedBy) lines.push(`- **Completed By:** ${state.completedBy}`);
  lines.push(`- **Final Outcome:** ${state.finalOutcomeLabel}`, "", "## Public Summary", ...(state.publicSummary.paragraphs.length ? state.publicSummary.paragraphs : [state.publicSummary.title]));
  lines.push("", "## Rounds");
  for (const round of state.rounds) {
    lines.push("", `### Round ${round.roundNumber ?? "?"}: ${round.title}`);
    for (const result of round.stationResults) lines.push(`- **${result.stationName}:** ${result.resultLabel}${result.publicSummary ? ` — ${result.publicSummary}` : ""}`);
    lines.push(`- Consequences generated: ${round.consequenceCounts.generated}; handled: ${round.consequenceCounts.handled}`);
  }
  lines.push("", "## Resource Deltas");
  lines.push(...Object.entries(state.totals.resourceDeltas).map(([key, value]) => `- **${key}:** ${value}`));
  lines.push("", "## Consequence Counts", `- Applied: ${state.totals.consequencesApplied}`, `- Dismissed: ${state.totals.consequencesDismissed}`, `- Pending: ${state.totals.consequencesPending}`, "", "## Follow-ups");
  lines.push(...(state.followups.length ? state.followups.map((f) => `- **${f.title}** (${f.status}): ${f.publicSummary || "No public summary."}`) : ["- None recorded."]));
  if (state.includeGmSummary) lines.push("", "## GM Summary", listLines(state.gmSummary.paragraphs), "", "### GM Next Steps", listLines(state.gmSummary.nextSteps), "", "### GM Warnings", listLines(state.gmSummary.warnings));
  return { ...state, markdown: lines.join("\n") };
}

export function buildTravelV2CompletedSummaryHtml(session, options = {}) {
  const state = buildTravelV2CompletedSummaryExportState(session, options);
  if (!state.available) return { ...state, html: "" };
  const paragraphs = state.publicSummary.paragraphs.length ? state.publicSummary.paragraphs : [state.publicSummary.title];
  const rounds = state.rounds.map((round) => `<h3>Round ${escapeHtml(round.roundNumber ?? "?")}: ${escapeHtml(round.title)}</h3><ul>${round.stationResults.map((r) => `<li><strong>${escapeHtml(r.stationName)}:</strong> ${escapeHtml(r.resultLabel)}${r.publicSummary ? ` — ${escapeHtml(r.publicSummary)}` : ""}</li>`).join("")}<li>Consequences generated: ${escapeHtml(round.consequenceCounts.generated)}; handled: ${escapeHtml(round.consequenceCounts.handled)}</li></ul>`).join("");
  const deltas = Object.entries(state.totals.resourceDeltas).map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</li>`).join("") || "<li>None recorded.</li>";
  const followups = state.followups.map((f) => `<li><strong>${escapeHtml(f.title)}</strong> (${escapeHtml(f.status)}): ${escapeHtml(f.publicSummary || "No public summary.")}</li>`).join("") || "<li>None recorded.</li>";
  const gm = state.includeGmSummary ? `<h2>GM Summary</h2><ul>${state.gmSummary.paragraphs.map((p) => `<li>${escapeHtml(p)}</li>`).join("") || "<li>None recorded.</li>"}</ul><h3>GM Next Steps</h3><ul>${state.gmSummary.nextSteps.map((p) => `<li>${escapeHtml(p)}</li>`).join("") || "<li>None recorded.</li>"}</ul>` : "";
  const html = `<section class="arcflight-travel-v2-summary-export"><h1>Travel v2 Summary — ${escapeHtml(state.eventTitle)}</h1><ul><li><strong>Ship:</strong> ${escapeHtml(state.shipName || "Unrecorded")}</li><li><strong>Completed At:</strong> ${escapeHtml(state.completedAt || "Unrecorded")}</li>${state.completedBy ? `<li><strong>Completed By:</strong> ${escapeHtml(state.completedBy)}</li>` : ""}<li><strong>Final Outcome:</strong> ${escapeHtml(state.finalOutcomeLabel)}</li></ul><h2>Public Summary</h2>${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}<h2>Rounds</h2>${rounds}<h2>Resource Deltas</h2><ul>${deltas}</ul><h2>Consequence Counts</h2><ul><li>Applied: ${escapeHtml(state.totals.consequencesApplied)}</li><li>Dismissed: ${escapeHtml(state.totals.consequencesDismissed)}</li><li>Pending: ${escapeHtml(state.totals.consequencesPending)}</li></ul><h2>Follow-ups</h2><ul>${followups}</ul>${gm}</section>`;
  return { ...state, html };
}

async function copyText(textValue, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) return { copied: false, fallbackText: textValue, reason: "Clipboard unavailable." };
  try {
    await clipboard.writeText(textValue);
    return { copied: true, fallbackText: "", reason: "Copied to clipboard." };
  } catch (error) {
    return { copied: false, fallbackText: textValue, reason: "Clipboard unavailable." };
  }
}

export async function copyTravelV2CompletedSummaryMarkdown(session, options = {}) {
  const built = buildTravelV2CompletedSummaryMarkdown(session, options);
  if (!built.available || !built.markdown) return { ...built, copied: false, fallbackText: "" };
  return { ...built, ...(await copyText(built.markdown, options.clipboard)) };
}

export async function copyTravelV2CompletedSummaryHtml(session, options = {}) {
  const built = buildTravelV2CompletedSummaryHtml(session, options);
  if (!built.available || !built.html) return { ...built, copied: false, fallbackText: "" };
  return { ...built, ...(await copyText(built.html, options.clipboard)) };
}
