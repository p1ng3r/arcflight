import { LANTERN_IN_THE_STATIC_SAMPLE_DRAFT_ID, LANTERN_IN_THE_STATIC_SAMPLE_EVENT } from "../../data/travel-events/sample-travel-v2-events.js";
import { validateTravelEventDefinition } from "../helpers/travel-events.js";
import {
  createLanternInTheStaticSampleDraft,
  loadLanternInTheStaticSampleDraftIntoBuilderLibrary,
  publishTravelEventDraftToLibrary
} from "../helpers/travel-event-builder.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 sample event smoke failed: ${message}`);
}

function words(value) {
  return String(value ?? "").trim().split(/\s+/).filter(Boolean).length;
}

const ROBOTIC_PATTERNS = [/Navigator Navigator/, /undefined/, /\[object Object\]/, /resolves "/, /turns "/, /station problem/i];
const ROUND_BRANCH_KEYS = ["dominantSuccess", "mixed", "dominantFailure", "catastrophicFailure"];
const ROLL_KEYS = ["criticalSuccess", "success", "failure", "criticalFailure"];

export default async function runTravelV2SampleEventSmokeChecks() {
  const checked = [];
  const sample = LANTERN_IN_THE_STATIC_SAMPLE_EVENT;
  assertSmoke(sample?.key === "lantern-in-the-static", "sample event should exist with stable key");
  checked.push("Sample event exists");

  const validation = validateTravelEventDefinition(sample, { strictAuthoring: true });
  assertSmoke(validation.ok, `sample event should validate with strict authoring: ${validation.errors.join("; ")}`);
  checked.push("Sample event validates with strict authoring");

  assertSmoke(sample.roundCount === 3 && sample.rounds.length === 3, "sample event should have exactly 3 rounds");
  checked.push("Sample has exactly 3 rounds");

  for (const round of sample.rounds) {
    assertSmoke(words(round.openingVignette) >= 20, `round ${round.round} should have readable opening vignette`);
    const narrationText = [
      ...Object.values(round.roundEndNarration ?? {}),
      ...ROUND_BRANCH_KEYS.map((key) => round.outcomeBranches?.[key]?.vignette)
    ].join("\n");
    assertSmoke(words(narrationText) >= 80, `round ${round.round} should have readable transition/result vignettes`);
    for (const pattern of ROBOTIC_PATTERNS) assertSmoke(!pattern.test(narrationText), `round ${round.round} transition text should not contain ${pattern}`);
    for (const card of round.stationCards ?? []) {
      assertSmoke(words(card.problem) >= 8, `round ${round.round} ${card.stationKey} should have player-facing problem text`);
      assertSmoke(Array.isArray(card.skillApproaches) && card.skillApproaches.length >= 2 && card.skillApproaches.length <= 3, `round ${round.round} ${card.stationKey} should have 2-3 skill approaches`);
      for (const approach of card.skillApproaches) {
        assertSmoke(words(approach.helpText) >= 8, `round ${round.round} ${card.stationKey} ${approach.skill} should have help text`);
        for (const key of ROLL_KEYS) {
          assertSmoke(words(approach.boardResultFeedback?.[key]) >= 6, `round ${round.round} ${card.stationKey} ${approach.skill} should have board ${key} feedback`);
          assertSmoke(words(approach.gmNarrationFeedback?.[key]) >= 6, `round ${round.round} ${card.stationKey} ${approach.skill} should have GM ${key} narration`);
        }
      }
    }
  }
  checked.push("Rounds have readable openings, transition vignettes, and station card narration");

  const draft = createLanternInTheStaticSampleDraft({ now: "2026-06-20T00:00:00.000Z" });
  assertSmoke(draft.builder?.source === "builder", "sample draft should use Event Builder draft metadata");
  checked.push("Sample can be created as an Event Builder draft");

  const seeded = await loadLanternInTheStaticSampleDraftIntoBuilderLibrary({ dryRun: true, now: "2026-06-20T00:00:00.000Z" });
  assertSmoke(seeded.ok && seeded.entry?.id === LANTERN_IN_THE_STATIC_SAMPLE_DRAFT_ID, `sample should seed into builder draft library: ${seeded.errors.join("; ")}`);
  checked.push("Sample can be loaded into Event Builder draft library");

  const published = await publishTravelEventDraftToLibrary(seeded.draft, { dryRun: true, sourceDraftId: seeded.entry.id, now: "2026-06-20T00:00:00.000Z" });
  assertSmoke(published.ok && published.event?.key === sample.key, `sample should pass builder publish validation path: ${published.errors.join("; ")}`);
  assertSmoke(published.entry?.sourceDraftId === LANTERN_IN_THE_STATIC_SAMPLE_DRAFT_ID, "publish result should remember builder source draft id");
  checked.push("Sample passes existing builder publish validation path");

  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2SampleEventSmokeChecks();
    console.log("Travel v2 sample event smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
