import { LANTERN_IN_THE_STATIC_SAMPLE_DRAFT_ID, LANTERN_IN_THE_STATIC_SAMPLE_EVENT } from "../../data/travel-events/sample-travel-v2-events.js";
import { validateTravelEventDefinition } from "../helpers/travel-events.js";
import {
  prepareTravelV2EventSetupStakesState,
  travelV2PlayerSafeSetupHasForbiddenKeys
} from "../helpers/travel-v2-event-setup-stakes.js";
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

  const setupStakes = prepareTravelV2EventSetupStakesState({ event: sample });
  assertSmoke(setupStakes.ok, `Lantern setup/stakes projection should validate: ${setupStakes.errors.join("; ")}`);
  assertSmoke(setupStakes.playerSafe.eventName === "The Lantern in the Static", "Lantern setup should expose player-safe event name");
  assertSmoke(setupStakes.playerSafe.openingPremise.includes("lantern burns inside silver static"), "Lantern setup should expose player-safe premise");
  assertSmoke(setupStakes.playerSafe.openingVignette.includes("Silver static"), "Lantern setup should expose player-safe vignette");
  assertSmoke(setupStakes.playerSafe.roundCount === 3, "Lantern setup should expose valid round count");
  assertSmoke(["lifeveil", "morale", "strain"].every((resource) => setupStakes.playerSafe.threatenedResources.includes(resource)), "Lantern setup should expose threatened alpha resources");
  assertSmoke(setupStakes.playerSafe.knownDangers.some((danger) => danger.includes("familiar voices")), "Lantern setup should expose familiar-voice tell");
  assertSmoke(setupStakes.playerSafe.knownDangers.some((danger) => danger.includes("true flame")), "Lantern setup should expose true-flame possibility");
  assertSmoke(setupStakes.playerSafe.knownDangers.some((danger) => danger.includes("bait")), "Lantern setup should expose bait suspicion");
  assertSmoke(setupStakes.playerSafe.broadSuccessReward.includes("route clue"), "Lantern setup should expose broad success reward");
  assertSmoke(setupStakes.playerSafe.broadFailureDanger.includes("ship scar candidates"), "Lantern setup should expose broad failure danger");
  assertSmoke(["captain", "navigator", "engineer", "veilwarden", "watchmaster"].every((station) => setupStakes.playerSafe.availableCoreStations.includes(station)), "Lantern setup should expose all alpha core stations");
  assertSmoke(setupStakes.gmFacing.hiddenHazards.length === 2, "Lantern setup should keep hidden hazards in GM-facing data");
  const playerSafeJson = JSON.stringify(setupStakes.playerSafe);
  assertSmoke(!playerSafeJson.includes("Voice-hunting static"), "Lantern player-safe setup should not include hidden hazard names");
  assertSmoke(!playerSafeJson.includes("Lantern parasite"), "Lantern player-safe setup should not include hidden hazard details");
  assertSmoke(!playerSafeJson.includes("answered-familiar-order"), "Lantern player-safe setup should not include future trigger data");
  assertSmoke(!travelV2PlayerSafeSetupHasForbiddenKeys(setupStakes.playerSafe), "Lantern player-safe setup should avoid forbidden player-safe terms");
  checked.push("Sample setup/stakes projection is player-safe and valid");

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

  const criticalSuccessOutcome = published.event.finalOutcomes?.criticalSuccess ?? {};
  const mixedOutcome = published.event.finalOutcomes?.mixed ?? {};
  const failureOutcome = published.event.finalOutcomes?.failure ?? {};
  assertSmoke(Array.isArray(criticalSuccessOutcome.rewards) && criticalSuccessOutcome.rewards.length >= 2, "critical success final outcome should expose reward candidates through legacy rewards");
  assertSmoke(Array.isArray(mixedOutcome.rewardCandidates) && mixedOutcome.rewardCandidates.some((candidate) => candidate.name === "Rescued Lantern Flame"), "mixed final outcome should expose a visible reward candidate");
  assertSmoke(Array.isArray(mixedOutcome.fortuneCandidates) && mixedOutcome.fortuneCandidates.some((candidate) => candidate.name === "True Bearing Remembered"), "mixed final outcome should expose a visible fortune candidate");
  assertSmoke(Array.isArray(mixedOutcome.consequenceCandidates) && mixedOutcome.consequenceCandidates.some((candidate) => candidate.name === "Static Fingerprints"), "mixed final outcome should expose a visible consequence candidate");
  assertSmoke(Array.isArray(failureOutcome.shipScarCandidates) && failureOutcome.shipScarCandidates.some((candidate) => candidate.name === "Echoes in the Rigging"), "failure final outcome should expose a visible ship scar candidate");
  checked.push("Sample final outcomes expose visible follow-up candidates");

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
