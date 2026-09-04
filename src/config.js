(function() {
  const config = {
    cubeSkins: [
      { id: "alchemist", name: "Astral Alchemist", cost: 0, desc: "Indigo glass wrapped around a living mint core.", texture: "assets/block/alchemist_v3.png", accent: "#76ffe2", spriteScale: 1.16 },
      { id: "caution", name: "Solar Hazard", cost: 140, desc: "Obsidian armor crossed with molten amber energy.", texture: "assets/block/caution_v3.png", ballTexture: "assets/block/caution_ball_v2.png", accent: "#ffb43b", spriteScale: 1.16 },
      { id: "crystals", name: "Celestial Prism", cost: 180, desc: "Faceted lavender crystal holding a tiny star.", texture: "assets/block/crystals_v3.png", accent: "#9af5ff", spriteScale: 1.16 },
      { id: "gum", name: "Nebula Candy", cost: 130, desc: "Rose quartz filled with swirling cosmic gel.", texture: "assets/block/gum_v3.png", accent: "#ff77c8", spriteScale: 1.16 },
      { id: "wooden", name: "Ancient Starwood", cost: 160, desc: "Carved cosmic timber joined by cyan starlight.", texture: "assets/block/wooden_v3.png", accent: "#48edff", spriteScale: 1.16 }
    ],
    stairThemes: [
      { id: "aurora", name: "Astral Glass", cost: 0, c1: "#8678ff", c2: "#322176", stroke: "rgba(134, 241, 255, 0.92)", glow: "rgba(118, 222, 255, 0.38)", desc: "Deep violet crystal with a cyan-lit edge." },
      { id: "ember", name: "Sunset Alloy", cost: 90, c1: "#ff927e", c2: "#7d2b91", stroke: "rgba(255, 220, 154, 0.94)", glow: "rgba(255, 135, 168, 0.4)", desc: "Apricot glass framed in warm starlight." },
      { id: "glacier", name: "Aether Ice", cost: 180, c1: "#5eeaff", c2: "#263aa7", stroke: "rgba(210, 253, 255, 0.96)", glow: "rgba(83, 231, 255, 0.42)", desc: "Cool celestial ice with a white-hot rim." },
      { id: "acid_lab", name: "Nova Bloom", cost: 220, c1: "#ff64c6", c2: "#5621a6", stroke: "rgba(255, 203, 238, 0.94)", glow: "rgba(255, 90, 212, 0.42)", desc: "Magenta nebula glass charged with violet light." }
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
      { id: "slopes", name: "Slopes", desc: "Gain 1 slopes charge. Activate it to tilt all stairs 17 degrees downward to the right for 10 seconds.", badge: "World" },
      { id: "anti_stick", name: "Anti-Stick", desc: "Sticky stairs no longer slow you down.", badge: "Safety" },
      { id: "relaunch", name: "Re-Launch", desc: "Gain 1 re-launch. Freeze in place and fire again from your current spot.", badge: "Active" }
    ]
  };

  window.STAIR_CONFIG = config;
})();
