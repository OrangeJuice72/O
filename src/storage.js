(function() {
  function createDefaultStats() {
    return {
      lifetimeSteps: 0,
      highestCombo: 1,
      gamesPlayed: 0,
      totalWins: 0,
      perfectLaunches: 0,
      specialHits: 0,
      highScore: 0,
      bestSteps: 0,
      fastestSpeed: 0,
      furthestDistance: 0
    };
  }

  function loadProgressState() {
    const stats = JSON.parse(localStorage.getItem("stair_stats")) || createDefaultStats();
    stats.highScore = stats.highScore || 0;
    stats.bestSteps = stats.bestSteps || 0;
    stats.fastestSpeed = stats.fastestSpeed || 0;
    stats.furthestDistance = stats.furthestDistance || 0;
    const savedShards = localStorage.getItem("stair_shards");
    const legacyCoins = localStorage.getItem("stair_coins");
    const shards = savedShards !== null
      ? Math.max(0, Number.parseInt(savedShards, 10) || 0)
      : legacyCoins !== null
        ? Math.max(0, Number.parseInt(legacyCoins, 10) || 0)
        : 160;

    return {
      unlockedCubes: JSON.parse(localStorage.getItem("stair_cubes")) || ["alchemist"],
      unlockedStairs: JSON.parse(localStorage.getItem("stair_themes")) || ["aurora"],
      unlockedTrails: JSON.parse(localStorage.getItem("stair_trails")) || ["default", "rainbow"],
      unlockedEffects: JSON.parse(localStorage.getItem("stair_effects")) || ["default"],
      equippedCube: localStorage.getItem("stair_eq_cube") || "alchemist",
      equippedStair: localStorage.getItem("stair_eq_theme") || "aurora",
      equippedTrail: localStorage.getItem("stair_eq_trail") || "default",
      equippedEffect: localStorage.getItem("stair_eq_effect") || "default",
      purchasedUpgrades: JSON.parse(localStorage.getItem("stair_upgrades")) || [],
      shards,
      settings: {
        soundEnabled: localStorage.getItem("stair_sound") !== "off",
        reducedMotion: localStorage.getItem("stair_motion") === "reduced"
      },
      stats
    };
  }

  function persistProgressState(progress) {
    localStorage.setItem("stair_cubes", JSON.stringify(progress.unlockedCubes));
    localStorage.setItem("stair_themes", JSON.stringify(progress.unlockedStairs));
    localStorage.setItem("stair_trails", JSON.stringify(progress.unlockedTrails));
    localStorage.setItem("stair_effects", JSON.stringify(progress.unlockedEffects));
    localStorage.setItem("stair_eq_cube", progress.equippedCube);
    localStorage.setItem("stair_eq_theme", progress.equippedStair);
    localStorage.setItem("stair_eq_trail", progress.equippedTrail);
    localStorage.setItem("stair_eq_effect", progress.equippedEffect);
    localStorage.setItem("stair_upgrades", JSON.stringify(progress.purchasedUpgrades));
    localStorage.setItem("stair_shards", String(progress.shards));
    localStorage.setItem("stair_sound", progress.settings.soundEnabled ? "on" : "off");
    localStorage.setItem("stair_motion", progress.settings.reducedMotion ? "reduced" : "full");
    localStorage.setItem("stair_stats", JSON.stringify(progress.stats));
    localStorage.removeItem("stair_coins");
    localStorage.removeItem("stair_challenges");
  }

  window.STAIR_STORAGE = {
    createDefaultStats,
    loadProgressState,
    persistProgressState
  };
})();
