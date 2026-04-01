(function() {
  const config = {
    cubeSkins: [
      { id: "alchemist", name: "Alchemist", cost: 0, desc: "Arcane lab-grade plating.", texture: "assets/block/alchemist.png", accent: "#f4d35e", spriteScale: 1.22 },
      { id: "caution", name: "Caution Tape", cost: 140, desc: "Industrial hazard styling.", texture: "assets/block/caution.png", accent: "#ffd166", spriteScale: 1.22 },
      { id: "crystals", name: "Crystal Core", cost: 180, desc: "Faceted gem energy.", texture: "assets/block/crystals.png", accent: "#8fd3ff", spriteScale: 1.22 },
      { id: "gum", name: "Bubble Gum", cost: 130, desc: "Soft candy-coated finish.", texture: "assets/block/gum.png", accent: "#ff8cc6", spriteScale: 1.22 },
      { id: "wooden", name: "Wooden Crate", cost: 160, desc: "Old-school crate texture.", texture: "assets/block/wooden.png", accent: "#d6a36c", spriteScale: 1.22 }
    ],
    stairThemes: [
      { id: "aurora", name: "Aurora Deck", cost: 0, c1: "#8f86ff", c2: "#4d2ab8", stroke: "rgba(179, 241, 255, 0.82)", glow: "rgba(246, 156, 255, 0.32)", desc: "Glassy cosmic violet platforms." },
      { id: "ember", name: "Ember Steel", cost: 90, c1: "#ffb2cc", c2: "#7f41de", stroke: "rgba(255, 231, 205, 0.82)", glow: "rgba(255, 161, 215, 0.3)", desc: "Warm nebula glass with sunset edges." },
      { id: "glacier", name: "Glacier Run", cost: 180, c1: "#9bb1ff", c2: "#3148cc", stroke: "rgba(169, 246, 255, 0.86)", glow: "rgba(124, 234, 255, 0.34)", desc: "Cool astral glass with cyan shimmer." },
      { id: "acid_lab", name: "Acid Lab", cost: 220, c1: "#ff9dd8", c2: "#6426b8", stroke: "rgba(255, 224, 196, 0.84)", glow: "rgba(255, 196, 238, 0.32)", desc: "Hot pink cosmic plates with bright energy." }
    ],
    trailItems: [
      { id: "default", name: "Core Trail", cost: 0, color: "#8b6cff", desc: "Simple energy ribbon." },
      { id: "mint", name: "Mint Trace", cost: 70, color: "#2ee6c9", desc: "Bright fast-moving line." },
      { id: "gold", name: "Gold Arc", cost: 160, color: "#ffd166", desc: "Premium glowing tail." },
      { id: "rainbow", name: "Prism Trace", cost: 0, color: "rainbow", desc: "A shifting spectrum of light." }
    ],
    effectItems: [
      { id: "default", name: "Pulse Burst", cost: 0, color: "#ffffff", desc: "Simple impact burst." },
      { id: "spark", name: "Spark Burst", cost: 90, color: "#7fd7ff", desc: "Cool sharp particles." },
      { id: "nova", name: "Nova Bloom", cost: 210, color: "#ff8cff", desc: "Big flashy impact effect." }
    ],
    upgradeItems: [
      { id: "air_control", name: "Air Control", cost: 120, desc: "Stronger midair nudges." },
      { id: "impact_master", name: "Impact Mastery", cost: 190, desc: "Longer combo sustain window." }
    ],
    perkPool: [
      { id: "bump", name: "Bump", desc: "Gain 2 bump charges. Each one gives a quick 55% launch-strength shove.", badge: "Active" },
      { id: "slam", name: "Slam", desc: "Gain 3 slams. Tap/click while airborne to drive straight down.", badge: "Active" },
      { id: "stabilizer", name: "Stabilizer", desc: "Gain 2 stabilizer charges. While airborne, tap to straighten out and recover from wild launches.", badge: "Active" },
      { id: "recovery_warp", name: "Recovery Warp", desc: "Gain 1 warp charge. Teleport to the nearest special stair and drop back into the run.", badge: "Recovery" },
      { id: "anti_stick", name: "Anti-Stick", desc: "Sticky stairs no longer slow you down.", badge: "Safety" },
      { id: "relaunch", name: "Re-Launch", desc: "Gain 1 re-launch. Freeze in place and fire again from your current spot.", badge: "Active" }
    ]
  };

  window.STAIR_CONFIG = config;
})();
