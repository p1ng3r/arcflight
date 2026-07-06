import {
  prepareTravelV2EventSetupStakesState,
  travelV2PlayerSafeSetupHasForbiddenKeys,
  TRAVEL_V2_EVENT_SETUP_STAKES_VERSION
} from "./travel-v2-event-setup-stakes.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 event setup stakes smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 event setup stakes smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function createSetupFixture() {
  return {
    event: {
      key: "silver-lantern-static",
      title: "The Silver Lantern Static",
      roundCount: 4,
      setup: {
        openingPremise: "A lantern burns inside silver static ahead.",
        openingVignette: "Familiar voices echo from the veil ahead."
      },
      stakes: {
        threatenedResources: ["lifeveil", "morale", "strain"],
        knownDangers: ["The static repeats shipboard orders.", "The lantern may be bait."],
        broadSuccessReward: "Rescue the true flame or claim a route clue.",
        broadFailureDanger: "The ship may carry an occult scar forward."
      },
      availableCoreStations: ["captain", "navigator", "engineer", "veilwarden", "watchmaster"],
      player: {
        gmText: "should not appear",
        secret: "should not appear"
      },
      gm: {
        notes: "The lantern is bait.",
        hiddenHazards: [{ name: "Voice Thief", unrevealedHazard: true }],
        futureTriggers: ["answered-voice"],
        internalScoring: { failures: 0 }
      }
    }
  };
}

export function runTravelV2EventSetupStakesSmokeChecks() {
  assertEqual(TRAVEL_V2_EVENT_SETUP_STAKES_VERSION, 2, "setup stakes version should be 2");

  const source = createSetupFixture();
  const before = JSON.stringify(source);
  const state = prepareTravelV2EventSetupStakesState(source);
  assertSmoke(state.ok, "normal setup projection should succeed");
  assertEqual(state.playerSafe.eventName, "The Silver Lantern Static", "player setup should include event name");
  assertEqual(state.playerSafe.openingPremise, "A lantern burns inside silver static ahead.", "player setup should include opening premise");
  assertEqual(state.playerSafe.roundCount, 4, "player setup should include round count");
  assertEqual(state.playerSafe.threatenedResources.length, 3, "player setup should include threatened resources");
  assertEqual(state.playerSafe.availableCoreStations.length, 5, "player setup should include core stations");
  assertEqual(state.gmFacing.hiddenHazards.length, 1, "GM setup should retain hidden hazards separately");
  assertSmoke(!JSON.stringify(state.playerSafe).includes("Voice Thief"), "player setup should redact hidden hazard details");
  assertSmoke(!travelV2PlayerSafeSetupHasForbiddenKeys(state.playerSafe), "player setup should avoid forbidden player-safe keys");

  const leakySource = createSetupFixture();
  leakySource.event.player.knownDangers = ["safe tell", "secret machinery", "unrevealedHazard detail", "Hidden Hazard detail", "FUTURE TRIGGER detail", "internal scoring clue", "debug report detail"];
  leakySource.event.player.broadFailureDanger = "GM-ONLY consequence tree";
  const redactedState = prepareTravelV2EventSetupStakesState(leakySource);
  assertSmoke(redactedState.ok, "forbidden player-safe terms should not invalidate otherwise playable setup");
  assertEqual(redactedState.playerSafe.knownDangers.length, 1, "forbidden player-safe tell entries should be removed");
  assertEqual(redactedState.playerSafe.broadFailureDanger, "", "forbidden player-safe strings should be redacted");
  assertSmoke(!travelV2PlayerSafeSetupHasForbiddenKeys(redactedState.playerSafe), "redacted player setup should avoid forbidden terms");
  assertEqual(JSON.stringify(source), before, "setup projection should not mutate source input");

  const missingOptional = prepareTravelV2EventSetupStakesState({
    event: {
      title: "Sparse Event",
      roundCount: 3,
      availableCoreStations: ["captain", "navigator", "arkengineer", "veilwarden", "watchmaster"]
    }
  });
  assertSmoke(missingOptional.ok, "missing optional fields should still produce playable setup");
  assertEqual(missingOptional.playerSafe.openingPremise, "", "missing optional premise should normalize to empty string");
  assertEqual(missingOptional.playerSafe.threatenedResources.length, 0, "missing optional resources should normalize to empty array");

  const tooShort = prepareTravelV2EventSetupStakesState({
    event: {
      title: "Too Short",
      roundCount: 2,
      availableCoreStations: ["captain", "navigator", "engineer", "veilwarden", "watchmaster"]
    }
  });
  assertSmoke(!tooShort.ok, "round count below alpha minimum should fail");
  assertSmoke(tooShort.errors.includes("round-count-below-alpha-minimum"), "too-short setup should report round count error");

  const tooLong = prepareTravelV2EventSetupStakesState({
    event: {
      title: "Too Long",
      roundCount: 13,
      availableCoreStations: ["captain", "navigator", "engineer", "veilwarden", "watchmaster"]
    }
  });
  assertSmoke(!tooLong.ok, "round count above alpha maximum should fail");
  assertSmoke(tooLong.errors.includes("round-count-above-alpha-maximum"), "too-long setup should report round count error");

  const missingStations = prepareTravelV2EventSetupStakesState({
    event: {
      title: "No Watch",
      roundCount: 3,
      availableCoreStations: ["captain", "navigator", "engineer", "veilwarden"]
    }
  });
  assertSmoke(!missingStations.ok, "missing core stations should fail");
  assertSmoke(missingStations.errors.includes("missing-core-station:watchmaster"), "missing watchmaster should be reported");

  return {
    ok: true,
    checked: [
      "setup-stakes-version",
      "normal-setup-projection",
      "missing-optional-fields",
      "player-safe-redaction",
      "hidden-hazard-redaction",
      "invalid-round-counts",
      "missing-core-stations",
      "source-input-read-only"
    ]
  };
}

export default runTravelV2EventSetupStakesSmokeChecks;
