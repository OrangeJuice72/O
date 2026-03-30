    const { cubeSkins, stairThemes, trailItems, effectItems, upgradeItems, perkPool } = window.STAIR_CONFIG;
    const { loadProgressState, persistProgressState } = window.STAIR_STORAGE;
    const BASE_CUBE_CLASS = {
      restitution: 0.5,
      frictionAir: 0.004,
      density: 0.05,
      launchPower: 0.33,
      control: 0.36
    };
    const WORLD_UNITS_PER_FOOT = 32;
    const SPEED_MPH_SCALE = 2.35;
    const AIR_SPARK_SPEED_THRESHOLD = 40;
    const TRAIL_SPEED_THRESHOLD = 20;
    const ASSET_CACHE_BUSTER = `v=${Date.now()}`;

    const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Constraint = Matter.Constraint,
      Events = Matter.Events,
      Vector = Matter.Vector,
      Body = Matter.Body,
      Bounds = Matter.Bounds;

    const progress = loadProgressState();
    let coins = progress.coins;
    let unlockedCubes = progress.unlockedCubes;
    let unlockedStairs = progress.unlockedStairs;
    let unlockedTrails = progress.unlockedTrails;
    let unlockedEffects = progress.unlockedEffects;
    let equippedCube = progress.equippedCube;
    let equippedStair = progress.equippedStair;
    let equippedTrail = progress.equippedTrail;
    let equippedEffect = progress.equippedEffect;
    let purchasedUpgrades = progress.purchasedUpgrades;
    let shopTab = "skins";

    const validCubeIds = new Set(cubeSkins.map(item => item.id));
    unlockedCubes = unlockedCubes.filter(id => validCubeIds.has(id));
    if (!unlockedCubes.length) unlockedCubes = ["alchemist"];
    if (!validCubeIds.has(equippedCube)) equippedCube = "alchemist";
    if (!unlockedCubes.includes(equippedCube)) unlockedCubes.unshift(equippedCube);

    let stats = progress.stats;
    stats.totalWins = stats.totalWins || 0;

    let claimedChallenges = progress.claimedChallenges;

    const challenges = [
      { id: "steps25", name: "Reach 25 steps in a run", check: () => runStats.steps >= 25 },
      { id: "steps50", name: "Reach 50 steps in a run", check: () => runStats.steps >= 50 },
      { id: "steps100", name: "Reach 100 steps in a run", check: () => runStats.steps >= 100 },
      { id: "steps200", name: "Reach 200 steps in a run", check: () => runStats.steps >= 200 },
      { id: "steps500", name: "Reach 500 steps in a run", check: () => runStats.steps >= 500 },
      { id: "combo5", name: "Hit a x5 combo", check: () => runStats.bestCombo >= 5 },
      { id: "combo10", name: "Hit a x10 combo", check: () => runStats.bestCombo >= 10 },
      { id: "perfect3", name: "Land 3 perfect launches total", check: () => stats.perfectLaunches >= 3 },
      { id: "special20", name: "Touch 20 special stairs total", check: () => stats.specialHits >= 20 },
      { id: "jump50", name: "Jump over 50 steps in one launch", check: () => runStats.maxStepSkip >= 50 },
      { id: "special_run", name: "Hit 8 special stairs in one run", check: () => runStats.specialHits >= 8 }
    ];

    function saveGame() {
      persistProgressState({
        coins: 0,
        unlockedCubes,
        unlockedStairs,
        unlockedTrails,
        unlockedEffects,
        equippedCube,
        equippedStair,
        equippedTrail,
        equippedEffect,
        purchasedUpgrades,
        stats,
        claimedChallenges
      });
      updateRecordDisplays();
    }

    let saveTimer = null;
    function queueSave(delay = 250) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveGame, delay);
    }

    function updateCoinDisplays() {
    }

    function updateRecordDisplays() {
      document.getElementById("menu-best-steps").innerText = stats.bestSteps;
      document.getElementById("menu-fastest-speed").innerText = Math.round(stats.fastestSpeed || 0);
      document.getElementById("menu-furthest-distance").innerText = Math.round(stats.furthestDistance || 0);
      const hudBest = document.getElementById("hud-best-steps");
      if (hudBest) hudBest.innerText = stats.bestSteps;
      document.getElementById("game-over-best-steps").innerText = stats.bestSteps;
    }

    const cubeSpriteCache = {};
    const trailTextureCache = {};
    const CLOUD_ASSETS = [
      { texture: "assets/bg/clouds-01.png", width: 300, height: 262, opacity: [0.34, 0.5], blur: [0, 0.4], speed: [10, 15], y: [0.08, 0.3] },
      { texture: "assets/bg/clouds-02.png", width: 370, height: 144, opacity: [0.28, 0.42], blur: [0.2, 0.8], speed: [15, 20], y: [0.14, 0.5] },
      { texture: "assets/bg/clouds-03.png", width: 390, height: 152, opacity: [0.24, 0.36], blur: [0.6, 1.4], speed: [17, 25], y: [0.22, 0.62] },
      { texture: "assets/bg/clouds-04.png", width: 360, height: 159, opacity: [0.2, 0.32], blur: [0.9, 1.8], speed: [8, 14], y: [0.3, 0.72] }
    ];
    const MAX_ACTIVE_CLOUDS = 5;
    const EMPTY_SPRITE = {
      texture: "",
      xScale: 1,
      yScale: 1,
      xOffset: 0,
      yOffset: 0
    };
    const cubeTextureReady = {};
    const gameBackground = document.getElementById("game-background");
    let activeClouds = [];
    let nextCloudSpawnAt = 0;
    let cloudClock = 0;
    let lastCloudFrameTime = performance.now();
    const CLOUD_MIN_HORIZONTAL_GAP = 180;
    const CLOUD_MIN_VERTICAL_GAP = 90;

    function randomRange(min, max) {
      return min + Math.random() * (max - min);
    }

    function scheduleNextCloudSpawn(now = performance.now(), fast = false) {
      nextCloudSpawnAt = now + (fast ? randomRange(180, 520) : randomRange(900, 2400));
    }

    function clearClouds() {
      activeClouds.forEach(cloud => cloud.el.remove());
      activeClouds = [];
    }

    function getCloudScale() {
      if (deviceProfile.tier === "mobile") return 0.72;
      if (deviceProfile.tier === "tablet") return 0.88;
      return 1;
    }

    function spawnCloud(now = performance.now()) {
      if (!gameBackground || document.body.dataset.screen !== "game" || activeClouds.length >= MAX_ACTIVE_CLOUDS) return false;

      let cloudData = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const preset = CLOUD_ASSETS[Math.floor(Math.random() * CLOUD_ASSETS.length)];
        const scale = getCloudScale() * randomRange(1, 2);
        const widthPx = preset.width * scale;
        const heightPx = preset.height * scale;
        const y = height * randomRange(preset.y[0], preset.y[1]);
        const x = width + randomRange(40, Math.max(180, width * 0.28));
        const tooClose = activeClouds.some(cloud => {
          const horizontalGap = Math.abs(x - cloud.x);
          const verticalGap = Math.abs(y - cloud.y);
          const requiredHorizontalGap = Math.max(CLOUD_MIN_HORIZONTAL_GAP, Math.min(widthPx, cloud.width) * 0.55);
          return horizontalGap < requiredHorizontalGap && verticalGap < CLOUD_MIN_VERTICAL_GAP;
        });
        if (tooClose) continue;

        cloudData = {
          preset,
          widthPx,
          heightPx,
          x,
          y,
          speed: randomRange(preset.speed[0], preset.speed[1]),
          drift: randomRange(-3, 3),
          opacity: randomRange(preset.opacity[0], preset.opacity[1]),
          blur: randomRange(preset.blur[0], preset.blur[1]),
          phase: randomRange(0, Math.PI * 2),
          amplitude: randomRange(3, 10)
        };
        break;
      }

      if (!cloudData) {
        scheduleNextCloudSpawn(now, true);
        return false;
      }

      const el = document.createElement("div");
      el.className = "game-cloud";
      el.style.width = `${cloudData.widthPx}px`;
      el.style.height = `${cloudData.heightPx}px`;
      el.style.backgroundImage = `url("${cloudData.preset.texture}")`;
      el.style.opacity = `${cloudData.opacity}`;
      el.style.filter = `blur(${cloudData.blur}px)`;
      gameBackground.appendChild(el);

      activeClouds.push({
        el,
        x: cloudData.x,
        y: cloudData.y,
        width: cloudData.widthPx,
        speed: cloudData.speed,
        drift: cloudData.drift,
        phase: cloudData.phase,
        amplitude: cloudData.amplitude
      });

      scheduleNextCloudSpawn(now, activeClouds.length < 2);
      return true;
    }

    function updateCloudField(now = performance.now()) {
      const deltaMs = Math.min(64, now - lastCloudFrameTime);
      lastCloudFrameTime = now;
      const dt = Math.max(0.001, deltaMs / 1000);
      cloudClock += dt;

      if (document.body.dataset.screen !== "game") {
        if (activeClouds.length) clearClouds();
        scheduleNextCloudSpawn(now, true);
        return;
      }

      if (!activeClouds.length && now >= nextCloudSpawnAt) {
        spawnCloud(now);
      }

      while (activeClouds.length < Math.min(2, MAX_ACTIVE_CLOUDS) && now >= nextCloudSpawnAt) {
        spawnCloud(now);
      }

      if (activeClouds.length < MAX_ACTIVE_CLOUDS && now >= nextCloudSpawnAt) {
        spawnCloud(now);
      }

      for (let i = activeClouds.length - 1; i >= 0; i--) {
        const cloud = activeClouds[i];
        cloud.x -= cloud.speed * dt;
        cloud.phase += dt * 0.22;
        const yOffset = Math.sin(cloud.phase) * cloud.amplitude + cloud.drift;
        cloud.el.style.transform = `translate3d(${cloud.x}px, ${cloud.y + yOffset}px, 0)`;

        if (cloud.x + cloud.width < -40) {
          cloud.el.remove();
          activeClouds.splice(i, 1);
          if (activeClouds.length < MAX_ACTIVE_CLOUDS) {
            scheduleNextCloudSpawn(now, true);
          }
        }
      }
    }

    function startCloudLoop() {
      function frame(now) {
        updateCloudField(now);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    function getCubeSkin(id = equippedCube) {
      return cubeSkins.find(item => item.id === id) || cubeSkins[0];
    }

    function isRainbowCubeSkin(skin) {
      return skin && skin.id === "rainbow";
    }

    function isSpriteCubeSkin(skin) {
      return skin && !!skin.texture;
    }

    function getCubeAccentColor(id = equippedCube) {
      const skin = getCubeSkin(id);
      if (!skin) return "#8b6cff";
      if (isRainbowCubeSkin(skin)) return `hsl(${(gameTick * 3) % 360}, 100%, 65%)`;
      if (isSpriteCubeSkin(skin)) return skin.accent || "#dfe9ff";
      return skin.id;
    }

    function getVersionedAssetUrl(path) {
      if (!path) return path;
      return path.includes("?") ? `${path}&${ASSET_CACHE_BUSTER}` : `${path}?${ASSET_CACHE_BUSTER}`;
    }

    function getCubePreviewMarkup(item) {
      if (isSpriteCubeSkin(item)) {
        return `<div class="card-preview" style="background-image:url('${getVersionedAssetUrl(item.texture)}'); background-color:rgba(255,255,255,0.06);"></div>`;
      }

      const previewStyles = isRainbowCubeSkin(item)
        ? "background: linear-gradient(135deg, #ff5a7a, #ffd166, #79e38d, #2ee6c9, #7c5cff);"
        : `background:${item.id};`;

      return `<div class="card-preview" style="${previewStyles}"></div>`;
    }

    function getCubeSpriteImage(texture) {
      if (!texture) return null;
      if (!cubeSpriteCache[texture]) {
        const img = new Image();
        cubeTextureReady[texture] = false;
        img.addEventListener("load", () => {
          cubeTextureReady[texture] = true;
          if (!cube) return;
          const activeSkin = getCubeSkin();
          if (!activeSkin || activeSkin.texture !== texture) return;
          const spriteConfig = getCubeSpriteRenderConfig(activeSkin);
          if (!spriteConfig) return;
          cube.render.sprite = spriteConfig;
        });
        img.addEventListener("error", () => {
          cubeTextureReady[texture] = false;
        });
        img.src = getVersionedAssetUrl(texture);
        cubeSpriteCache[texture] = img;
      }
      return cubeSpriteCache[texture];
    }

    function isCubeTextureReady(texture) {
      if (!texture) return false;
      if (!(texture in cubeTextureReady)) getCubeSpriteImage(texture);
      return !!cubeTextureReady[texture];
    }

    function getCubeSpriteRenderConfig(skin) {
      if (!isSpriteCubeSkin(skin)) return null;
      const sprite = getCubeSpriteImage(skin.texture);
      if (!sprite) return null;
      if (!sprite.complete || !(sprite.naturalWidth || sprite.width)) return null;
      const spriteScale = skin.spriteScale || 1;
      const targetSize = 30 * spriteScale;
      return {
        texture: getVersionedAssetUrl(skin.texture),
        xScale: targetSize / (sprite.naturalWidth || sprite.width || 150),
        yScale: targetSize / (sprite.naturalHeight || sprite.height || 150),
        xOffset: 0.5,
        yOffset: 0.5
      };
    }

    function applyCubeSkinToBody(body, skin = getCubeSkin()) {
      if (!body || !skin) return;

      if (isSpriteCubeSkin(skin)) {
        body.render.fillStyle = "rgba(0,0,0,0)";
        body.render.strokeStyle = "rgba(0,0,0,0)";
        body.render.lineWidth = 0;
        body.render.sprite = getCubeSpriteRenderConfig(skin) || { ...EMPTY_SPRITE };
      } else if (isRainbowCubeSkin(skin)) {
        body.render.fillStyle = `hsl(${(gameTick * 3) % 360}, 100%, 65%)`;
        body.render.strokeStyle = "rgba(255,255,255,0.9)";
        body.render.lineWidth = 2.2;
        body.render.sprite = { ...EMPTY_SPRITE };
      } else {
        body.render.fillStyle = skin.id;
        body.render.strokeStyle = "rgba(255,255,255,0.9)";
        body.render.lineWidth = 2.2;
        body.render.sprite = { ...EMPTY_SPRITE };
      }
    }

    function createCubeBody(position, classCfg = BASE_CUBE_CLASS) {
      const activeCubeSkin = getCubeSkin();
      let initialColor = isRainbowCubeSkin(activeCubeSkin) ? `hsl(0, 100%, 65%)` : activeCubeSkin.id;
      if (isSpriteCubeSkin(activeCubeSkin)) {
        getCubeSpriteImage(activeCubeSkin.texture);
        initialColor = "rgba(0,0,0,0)";
      }

      const body = Bodies.rectangle(position.x, position.y, 30, 30, {
        label: "cube",
        restitution: classCfg.restitution,
        friction: 0.01,
        frictionAir: classCfg.frictionAir,
        density: classCfg.density,
        chamfer: isSpriteCubeSkin(activeCubeSkin) ? undefined : { radius: 7 },
        render: {
          fillStyle: initialColor,
          strokeStyle: isSpriteCubeSkin(activeCubeSkin) ? "rgba(0,0,0,0)" : "rgba(255,255,255,0.9)",
          lineWidth: isSpriteCubeSkin(activeCubeSkin) ? 0 : 2.2,
          sprite: isSpriteCubeSkin(activeCubeSkin) ? (getCubeSpriteRenderConfig(activeCubeSkin) || { ...EMPTY_SPRITE }) : { ...EMPTY_SPRITE }
        }
      });

      applyCubeSkinToBody(body, activeCubeSkin);
      return body;
    }

    function drawCubeOverlay(ctx, skin = getCubeSkin()) {
      if (!cube || !skin) return;
      const isSprite = isSpriteCubeSkin(skin);
      const size = 30 * (isSprite ? (skin.spriteScale || 1) : 1);
      const radius = isSprite ? 4 : 7;
      const fill = isRainbowCubeSkin(skin) ? `hsl(${(gameTick * 3) % 360}, 100%, 65%)` : (isSprite ? (skin.accent || "#cfd8ff") : skin.id);
      const stroke = isSprite ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.9)";
      const sprite = isSprite ? getCubeSpriteImage(skin.texture) : null;
      const textureReady = isSprite ? isCubeTextureReady(skin.texture) : false;

      ctx.save();
      ctx.translate(cube.position.x, cube.position.y);
      ctx.rotate(cube.angle);
      if (!isSprite || !textureReady) {
        ctx.beginPath();
        ctx.roundRect(-size / 2, -size / 2, size, size, radius);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = isSprite ? 1.6 : 2.2;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
      ctx.restore();
    }

    function focusCameraOnCube() {
      if (!cube) return;
      const cameraOffset = getCameraOffset();
      Render.lookAt(render, {
        min: { x: cube.position.x - width / 2 + cameraOffset.x, y: cube.position.y - height / 2 + cameraOffset.y },
        max: { x: cube.position.x + width / 2 + cameraOffset.x, y: cube.position.y + height / 2 + cameraOffset.y }
      });
    }

    function getCameraOffset() {
      if (deviceProfile.tier === "mobile") {
        return { x: 0, y: 50 };
      }
      if (deviceProfile.tier === "tablet") {
        return { x: 40, y: 90 };
      }
      return { x: 100, y: 150 };
    }

    function getStageStartConfig(isPlayable) {
      if (deviceProfile.tier === "mobile") {
        return {
          x: Math.max(24, width * 0.08),
          y: isPlayable ? Math.max(120, height * 0.16) : 80,
          startIndex: 3
        };
      }

      return {
        x: 0,
        y: isPlayable ? INITIAL_STAGE_OFFSET_Y : 80,
        startIndex: 10
      };
    }

    const engine = Engine.create();
    engine.positionIterations = 8;
    engine.velocityIterations = 8;

    const world = engine.world;
    function getViewportSize() {
      const viewport = window.visualViewport;
      return {
        width: Math.round(viewport?.width || window.innerWidth),
        height: Math.round(viewport?.height || window.innerHeight)
      };
    }

    let { width, height } = getViewportSize();
    let deviceProfile = detectDeviceProfile();

    const render = Render.create({
      element: document.body,
      engine: engine,
      options: {
        width,
        height,
        wireframes: false,
        background: "transparent",
        hasBounds: true,
        pixelRatio: deviceProfile.maxPixelRatio
      }
    });

    let runner = Runner.create();

    let cube, elastic;
    let stairsArr = [];
    let movingStairs = [];
    let stairGenX = 0;
    let stairGenY = 0;
    let stairGenIndex = 0;
    let lastCleanupIndex = 0;
    let particles = [];
    let popups = [];
    let heroMoments = [];
    let touchedStairs = new Set();
    let specialTouchedStairs = new Set();
    let brokenStairs = new Set();
    let perkSelectionsTaken = new Set();
    let activePerks = [];
    let pendingPerkStep = null;
    let perkCharges = { bump: 0, slam: 0, relaunch: 0 };
    let startPos = { x: 0, y: 0 };
    let launchOrigin = { x: 0, y: 0 };
    let recentStairContact = { id: null, time: 0 };
    let slamLockUntil = 0;
    let relaunchPrimed = false;
    let relaunchReadyAt = 0;
    let launchContext = "normal";

    let isLaunched = false;
    let gameOver = false;
    let hasWon = false;
    let isPaused = false;
    let perkPaused = false;

    let currentSteps = 0;
    let stationaryFrames = 0;
    let trail = [];
    let bestComboThisRun = 1;

    let cameraShake = 0;
    let gameTick = 0;
    let trailSampleTick = 0;

    const MAX_PULL = 220;
    const MAX_CUBE_SPEED = 58;
    const INITIAL_STAGE_OFFSET_Y = 170;
    const LAUNCH_DEADZONE = 0.03;
    const LAUNCH_POWER_CURVE = 1.4;
    const LAUNCH_VELOCITY_CURVE = 1.65;
    const LAUNCH_VELOCITY_BOOST = 1.95;
    const RELAUNCH_POWER_SCALE = 0.72;
    const OPENING_LAUNCH_SCALE = 1.12;
    const PERFECT_CHARGE_MIN = 0.68;
    const PERFECT_CHARGE_MAX = 0.84;

    let isDragging = false;
    let dragPointerId = null;
    let aimPoint = null;

    let combo = 1;
    let comboStreak = 0;
    let lastHitTime = 0;
    let launchCharge = 0;
    let launchWasPerfect = false;
    let airStartY = 0;
    let airStartTime = 0;
    let lastLaunchVector = { x: 0, y: -1 };
    let speedTrackingActive = false;

    let runStats = {
      steps: 0,
      bestCombo: 1,
      specialHits: 0,
      perfectLaunch: false,
      perkChoices: 0,
      lastStepIndex: null,
      maxStepSkip: 0,
      fastestSpeed: 0,
      furthestDistance: 0
    };

    function setCanvasInput(enabled) {
      render.canvas.style.pointerEvents = enabled ? "auto" : "none";
    }

    function updateLegendVisibility() {
      const legend = document.getElementById("legend");
      const hudVisible = document.getElementById("hud").style.display === "block";
      legend.style.display = hudVisible && deviceProfile.tier === "desktop" ? "block" : "none";
    }

    function normalizeUiCopy() {
      const topButtons = document.querySelectorAll("#top-controls .mini-btn");
      if (topButtons[0]) topButtons[0].textContent = "Pause";
      if (topButtons[1]) topButtons[1].textContent = "Goals";

      const challengeTitle = document.querySelector("#challenge-panel .shop-title");
      if (challengeTitle) challengeTitle.textContent = "Achievements";

      const challengeButton = document.querySelector("#main-menu .menu-actions .secondary-btn");
      if (challengeButton) challengeButton.textContent = "Achievements";

      const subtitle = document.querySelector("#main-menu .subtitle");
      if (subtitle) subtitle.textContent = "Infinite stairs. How far can you go?";

    }

    function setStatus(text, state = "idle") {
      const pill = document.getElementById("status-pill");
      pill.innerText = text;

      if (state === "live") {
        pill.style.background = "rgba(46, 230, 201, 0.10)";
        pill.style.borderColor = "rgba(46, 230, 201, 0.18)";
        pill.style.color = "#a8fff0";
      } else if (state === "danger") {
        pill.style.background = "rgba(255, 90, 122, 0.10)";
        pill.style.borderColor = "rgba(255, 90, 122, 0.18)";
        pill.style.color = "#ffc0cd";
      } else {
        pill.style.background = "rgba(124, 92, 255, 0.10)";
        pill.style.borderColor = "rgba(124, 92, 255, 0.18)";
        pill.style.color = "#ddd3ff";
      }
    }

    function updateHud() {
      document.getElementById("steps-display").innerText = currentSteps;
      const speedDisplay = document.getElementById("speed-display");
      const distanceDisplay = document.getElementById("distance-display");
      const currentSpeed = cube ? cube.speed * SPEED_MPH_SCALE : 0;
      const liveSpeed = cube && speedTrackingActive ? currentSpeed : 0;
      const distanceFeet = cube ? Math.max(0, (cube.position.x - startPos.x) / WORLD_UNITS_PER_FOOT) : 0;
      runStats.fastestSpeed = Math.max(runStats.fastestSpeed || 0, liveSpeed);
      runStats.furthestDistance = Math.max(runStats.furthestDistance || 0, distanceFeet);
      if (speedDisplay) speedDisplay.innerText = Math.round(liveSpeed);
      if (distanceDisplay) distanceDisplay.innerText = Math.round(runStats.furthestDistance || 0);
      updateRecordDisplays();
    }

    function refreshInRunControls() {
      const hudVisible = document.getElementById("hud").style.display === "block";
      const modalOpen =
        document.getElementById("shop-menu").style.display === "block" ||
        document.getElementById("challenge-panel").style.display === "block" ||
        document.getElementById("settings-panel").style.display === "block" ||
        document.getElementById("perk-panel").style.display === "block" ||
        document.getElementById("pause-panel").style.display === "block" ||
        document.getElementById("game-over").style.display === "block";

      document.getElementById("top-controls").style.display = hudVisible && !modalOpen ? "flex" : "none";
      const perkWrap = document.getElementById("perk-actions");
      if (!perkWrap) return;
      if (modalOpen || !hudVisible) {
        perkWrap.style.display = "none";
      } else {
        perkWrap.style.display = perkWrap.innerHTML.trim() ? "flex" : "none";
      }
    }

    function getTrailColor() {
      const t = getTrailItem();
      if (!t) return "#8b6cff";
      return t.color;
    }

    function detectDeviceProfile() {
      const viewport = getViewportSize();
      const shortestSide = Math.min(viewport.width, viewport.height);
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      const memory = navigator.deviceMemory || 4;
      const cores = navigator.hardwareConcurrency || 4;
      const tier = shortestSide <= 520 ? "mobile" : shortestSide <= 900 ? "tablet" : "desktop";
      const quality = memory <= 4 || cores <= 4 || shortestSide <= 520 ? "low" : memory <= 8 || cores <= 8 ? "medium" : "high";
      const maxPixelRatio = quality === "low" ? 1 : quality === "medium" ? 1.15 : 1.35;

      return {
        tier,
        quality,
        isTouch,
        maxPixelRatio
      };
    }

    function applyDeviceProfile() {
      document.body.dataset.device = deviceProfile.tier;
      document.body.dataset.quality = deviceProfile.quality;
      document.documentElement.style.setProperty("--viewport-width", `${width}px`);
      document.documentElement.style.setProperty("--viewport-height", `${height}px`);
    }

    function setScreenState(screen) {
      document.body.dataset.screen = screen;
      if (screen !== "game") {
        document.documentElement.style.setProperty("--bg-shift", "0px");
      }
      if (screen !== "game") {
        clearClouds();
        scheduleNextCloudSpawn(performance.now(), true);
      }
    }

    function updateGameBackgroundPan() {
      if (document.body.dataset.screen !== "game" || !cube) {
        document.documentElement.style.setProperty("--bg-shift", "0px");
        return;
      }

      const verticalDelta = cube.position.y - startPos.y;
      const maxShift = Math.min(height * 0.22, 180);
      const shift = Math.max(-maxShift, Math.min(maxShift, verticalDelta * 0.08));
      document.documentElement.style.setProperty("--bg-shift", `${shift.toFixed(1)}px`);
    }

    function getRenderPixelRatio() {
      return Math.min(window.devicePixelRatio || 1, deviceProfile.maxPixelRatio);
    }

    function isWorldPointVisible(x, y, padding = 120) {
      return x >= render.bounds.min.x - padding &&
        x <= render.bounds.max.x + padding &&
        y >= render.bounds.min.y - padding &&
        y <= render.bounds.max.y + padding;
    }

    function getTrailItem(id = equippedTrail) {
      return trailItems.find(item => item.id === id) || trailItems[0];
    }

    function isTextureTrail(item) {
      return item && !!item.texture;
    }

    function getTrailPreviewMarkup(item) {
      if (isTextureTrail(item)) {
        const shapeClass = item.previewShape === "square" ? "" : " round";
        const animatedClass = item.animated ? " animated-trail-preview" : "";
        const frameData = getTrailFrameData(item, 0);
        const previewWidth = frameData ? Math.round(frameData.sw) : 512;
        const previewHeight = frameData ? Math.round(frameData.sh) : 512;
        const previewScale = item.previewScale || 1;
        return `<div class="card-preview${shapeClass}${animatedClass}" style="background-image:url('${item.texture}'); background-size:${previewWidth * (item.frameCols || 1)}px ${previewHeight * (item.frameRows || 1)}px; background-position:0 0; background-color:rgba(255,255,255,0.06); transform:scale(${previewScale});"></div>`;
      }

      const previewStyles = item.id === "rainbow"
        ? "background: linear-gradient(135deg, #ff5a7a, #ffd166, #79e38d, #2ee6c9, #7c5cff);"
        : `background:${item.color};`;

      return `<div class="card-preview round" style="${previewStyles}"></div>`;
    }

    function getTrailTextureImage(texture) {
      if (!texture) return null;
      if (!trailTextureCache[texture]) {
        const img = new Image();
        img.src = texture;
        trailTextureCache[texture] = img;
      }
      return trailTextureCache[texture];
    }

    function getTrailFrameData(item, frameIndex = 0) {
      if (!isTextureTrail(item)) return null;
      const image = getTrailTextureImage(item.texture);
      if (!image) return null;

      const cols = item.frameCols || 1;
      const rows = item.frameRows || 1;
      const count = item.frameCount || cols * rows;
      const safeIndex = ((frameIndex % count) + count) % count;
      const frameWidth = (image.naturalWidth || image.width || 1) / cols;
      const frameHeight = (image.naturalHeight || image.height || 1) / rows;
      const col = safeIndex % cols;
      const row = Math.floor(safeIndex / cols);

      return {
        image,
        sx: col * frameWidth,
        sy: row * frameHeight,
        sw: frameWidth,
        sh: frameHeight
      };
    }

    function getAnimatedTrailFrameIndex(item, seed = 0) {
      const frameCount = item.frameCount || 1;
      const frameRate = item.frameRate || 0.2;
      return Math.floor((gameTick * frameRate) + seed) % frameCount;
    }

    function drawTrail(ctx) {
      const activeTrail = getTrailItem();
      let baseTrailColor = getTrailColor();
      if (baseTrailColor === "rainbow") {
        baseTrailColor = `hsl(${(gameTick * 3) % 360}, 100%, 65%)`;
      }

      if (trail.length > 2 && isTextureTrail(activeTrail)) {
        const trailTexture = getTrailTextureImage(activeTrail.texture);
        if (trailTexture && trailTexture.complete) {
          for (let i = 0; i < trail.length - 1; i++) {
            const p1 = trail[i];
            const p2 = trail[i + 1];
            if (!isWorldPointVisible(p1.x, p1.y, 60) && !isWorldPointVisible(p2.x, p2.y, 60)) continue;
            const progress = 1 - (i / trail.length);
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const pulse = 0.88 + Math.sin(gameTick * 0.18 + i * 0.55) * 0.12;
            const baseStampSize = activeTrail.stampSize || 22;
            const stampGrowth = activeTrail.stampGrowth || 10;
            const width = (baseStampSize + progress * stampGrowth) * pulse;
            const frameData = getTrailFrameData(activeTrail, getAnimatedTrailFrameIndex(activeTrail, i * 0.35));
            if (!frameData) continue;
            const height = width * (frameData.sh / frameData.sw);
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(angle);
            ctx.globalAlpha = 0.12 + progress * 0.38;
            ctx.drawImage(
              frameData.image,
              frameData.sx,
              frameData.sy,
              frameData.sw,
              frameData.sh,
              -width * 0.62,
              -height / 2,
              width,
              height
            );
            ctx.restore();
          }
        }
      } else if (trail.length > 2) {
        for (let i = 0; i < trail.length - 1; i++) {
          const p1 = trail[i];
          const p2 = trail[i + 1];
          if (!isWorldPointVisible(p1.x, p1.y, 60) && !isWorldPointVisible(p2.x, p2.y, 60)) continue;
          const progress = 1 - (i / trail.length);
          let maxLineWidth = (equippedTrail === "gold" || equippedTrail === "rainbow") ? 22 : 18;
          let currentWidth = maxLineWidth * Math.pow(progress, 0.65);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = baseTrailColor;
          ctx.globalAlpha = 0.12 * progress;
          ctx.lineWidth = currentWidth;
          ctx.shadowColor = baseTrailColor;
          ctx.shadowBlur = currentWidth * 0.45;
          ctx.stroke();

          ctx.strokeStyle = "#ffffff";
          ctx.globalAlpha = 0.22 * progress;
          ctx.lineWidth = currentWidth * 0.22;
          ctx.shadowBlur = 0;
          ctx.stroke();
        }
      }
    }

    function getEffectColor() {
      const e = effectItems.find(x => x.id === equippedEffect);
      return e ? e.color : "#ffffff";
    }

    function showPopup(text, x, y, color = "#ffffff") {
      popups.push({ text, x, y, color, life: 60, vy: -1.15 });
    }

    function showHeroMoment(text, color = "#ffffff", accent = "rgba(255,255,255,0.16)") {
      heroMoments.push({ text, color, accent, life: 50 });
      if (heroMoments.length > 2) heroMoments.shift();
    }

    function spawnBurst(x, y, color, count = 12, speed = 4, options = {}) {
      const effectBoost = equippedEffect === "nova" ? 1.4 : equippedEffect === "spark" ? 1.15 : 1;
      const qualityScale = deviceProfile.quality === "low" ? 0.55 : deviceProfile.quality === "medium" ? 0.8 : 1;
      const actualCount = Math.max(4, Math.floor(count * effectBoost * qualityScale));
      const minSize = options.minSize ?? 2;
      const maxSize = options.maxSize ?? 6;
      const minLife = options.minLife ?? 26;
      const lifeRange = options.lifeRange ?? 18;
      const speedJitterMin = options.speedJitterMin ?? 0.4;
      const speedJitterMax = options.speedJitterMax ?? 1.4;
      const glow = options.glow ?? 0;
      const streak = options.streak ?? 0;
      for (let i = 0; i < actualCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * randomRange(speedJitterMin, speedJitterMax);
        particles.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: minLife + Math.random() * lifeRange,
          size: randomRange(minSize, maxSize),
          color,
          glow,
          streak
        });
      }
    }

    function shake(amount) {
      cameraShake = Math.min(cameraShake + amount, 22);
    }

    function getPerkValue(id) {
      return activePerks.includes(id);
    }

    function getPerfectChargeWindow() {
      return { min: PERFECT_CHARGE_MIN, max: PERFECT_CHARGE_MAX };
    }

    function updatePerkActionButtons() {
      const wrap = document.getElementById("perk-actions");
      if (!wrap) return;

      const actions = [];
      if (perkCharges.bump > 0) {
        actions.push(`<button class="mini-btn perk-action" onclick="usePerkAction('bump')">Bump ${perkCharges.bump}</button>`);
      }
      if (perkCharges.slam > 0) {
        actions.push(`<button class="mini-btn perk-action" onclick="usePerkAction('slam')">Slam ${perkCharges.slam}</button>`);
      }
      if (perkCharges.relaunch > 0) {
        actions.push(`<button class="mini-btn perk-action" onclick="usePerkAction('relaunch')">Re-Launch ${perkCharges.relaunch}</button>`);
      }

      wrap.innerHTML = actions.join("");
      refreshInRunControls();
    }

    function consumePerkCharge(id) {
      if (!perkCharges[id]) return false;
      perkCharges[id]--;
      updatePerkActionButtons();
      return true;
    }

    function usePerkAction(id) {
      if (!cube || !isLaunched || gameOver || hasWon || isPaused || perkPaused) return false;

      if (id === "bump" && perkCharges.bump > 0) {
        const baseStrength = MAX_PULL * 0.3 * BASE_CUBE_CLASS.launchPower;
        const currentDirection = cube.speed > 0.3
          ? Vector.normalise(cube.velocity)
          : lastLaunchVector;
        Body.setVelocity(cube, {
          x: cube.velocity.x + currentDirection.x * baseStrength,
          y: cube.velocity.y + currentDirection.y * baseStrength
        });
        consumePerkCharge("bump");
        showPopup("BUMP", cube.position.x, cube.position.y - 34, "#8fffe0");
        setStatus("Bump Fired", "live");
        shake(5);
        return true;
      }

      if (id === "slam" && perkCharges.slam > 0) {
        Body.setVelocity(cube, {
          x: cube.velocity.x * 0.18,
          y: Math.max(28, Math.abs(cube.velocity.y) + 18)
        });
        slamLockUntil = performance.now() + 450;
        consumePerkCharge("slam");
        showPopup("SLAM", cube.position.x, cube.position.y - 34, "#ffd166");
        setStatus("Slam Attack", "danger");
        shake(7);
        return true;
      }

      if (id === "relaunch" && perkCharges.relaunch > 0) {
        const currentDirection = cube.speed > 0.3
          ? Vector.normalise(cube.velocity)
          : lastLaunchVector;
        const relaunchDirection = Vector.normalise({
          x: currentDirection.x || lastLaunchVector.x || 0,
          y: Math.min(currentDirection.y || lastLaunchVector.y || -1, -0.7)
        });
        const relaunchStrength = MAX_PULL * 0.6 * BASE_CUBE_CLASS.launchPower;
        const relaunchVelocity = Vector.mult(relaunchDirection, relaunchStrength);
        Body.setStatic(cube, false);
        Body.setVelocity(cube, relaunchVelocity);
        Body.setAngularVelocity(cube, 0);
        launchOrigin = { x: cube.position.x, y: cube.position.y };
        aimPoint = null;
        isDragging = false;
        dragPointerId = null;
        launchCharge = 0;
        relaunchPrimed = false;
        relaunchReadyAt = 0;
        launchContext = "normal";
        isLaunched = true;
        speedTrackingActive = false;
        airStartY = cube.position.y;
        airStartTime = performance.now();
        lastLaunchVector = relaunchDirection;
        trail = [];
        cameraShake = 0;
        recentStairContact = { id: null, time: 0 };
        consumePerkCharge("relaunch");
        showPopup("RE-LAUNCH", cube.position.x, cube.position.y - 34, "#c7b6ff");
        setStatus("Re-Launch Fired", "live");
        shake(6);
        updateHud();
        return true;
      }

      return false;
    }
    function openChallenges() {
      document.getElementById("challenge-panel").style.display = "block";
      document.getElementById("main-menu").style.display = "none";
      setCanvasInput(false);
      refreshInRunControls();
      renderChallenges();
    }

    function closeChallenges() {
      document.getElementById("challenge-panel").style.display = "none";
      if (document.getElementById("hud").style.display !== "block") {
        document.getElementById("main-menu").style.display = "block";
      }
      setCanvasInput(document.getElementById("hud").style.display === "block" && !perkPaused);
      refreshInRunControls();
    }

    function openSettings() {
      document.getElementById("settings-panel").style.display = "block";
      document.getElementById("main-menu").style.display = "none";
      setCanvasInput(false);
      refreshInRunControls();
    }

    function closeSettings() {
      document.getElementById("settings-panel").style.display = "none";
      if (document.getElementById("hud").style.display !== "block") {
        document.getElementById("main-menu").style.display = "block";
      }
      setCanvasInput(document.getElementById("hud").style.display === "block" && !perkPaused);
      refreshInRunControls();
    }

    function resetHighStats() {
      const shouldReset = window.confirm("Reset your saved high stats?");
      if (!shouldReset) return;

      stats.bestSteps = 0;
      stats.fastestSpeed = 0;
      stats.furthestDistance = 0;
      stats.highestCombo = 1;
      stats.highScore = 0;

      saveGame();
      updateHud();
      renderChallenges();
      setStatus("High Stats Reset", "idle");
    }

    function renderChallenges() {
      const wrap = document.getElementById("challenge-list");
      wrap.innerHTML = "";

      challenges.forEach(ch => {
        const done = ch.check();
        const claimed = claimedChallenges.includes(ch.id);
        let btn = "";
        if (claimed) {
          btn = `<button class="shop-btn equipped-btn" disabled>Done</button>`;
        } else if (done) {
          btn = `<button class="shop-btn equip-btn" onclick="claimChallenge('${ch.id}')">Complete</button>`;
        } else {
          btn = `<button class="shop-btn" disabled>In Progress</button>`;
        }

        wrap.innerHTML += `
          <div class="info-card">
            <h4>${ch.name}</h4>
            <div style="margin-top:10px;">${btn}</div>
          </div>
        `;
      });

      wrap.innerHTML += `
        <div class="info-card">
          <h4>Lifetime Stats</h4>
          <p>Games: ${stats.gamesPlayed} • Steps: ${stats.lifetimeSteps} • Best Combo: x${stats.highestCombo} • Perfect Launches: ${stats.perfectLaunches} • Special Hits: ${stats.specialHits} • Best Steps: ${stats.bestSteps}</p>
        </div>
      `;
    }

    function claimChallenge(id) {
      if (claimedChallenges.includes(id)) return;
      const ch = challenges.find(c => c.id === id);
      if (!ch || !ch.check()) return;
      claimedChallenges.push(id);
      saveGame();
      renderChallenges();
    }

    function openShop() {
      document.getElementById("main-menu").style.display = "none";
      document.getElementById("shop-menu").style.display = "block";
      setCanvasInput(false);
      refreshInRunControls();
      renderShop();
    }

    function closeShop() {
      document.getElementById("shop-menu").style.display = "none";
      document.getElementById("main-menu").style.display = "block";
      setCanvasInput(false);
      refreshInRunControls();
    }

    function switchShopTab(tab) {
      const allowedTabs = ["skins", "trails"];
      shopTab = allowedTabs.includes(tab) ? tab : "skins";
      document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
      const activeBtn = document.getElementById(`tab-${shopTab}`);
      if (activeBtn) activeBtn.classList.add("active");
      renderShopContent();
    }

    function renderShop() {
      switchShopTab(shopTab);
    }

    function renderShopContent() {
      const title = document.getElementById("shop-section-title");
      const content = document.getElementById("shop-content");
      content.innerHTML = "";

      if (shopTab === "skins") {
        title.innerText = "Cube Skins";
        cubeSkins.forEach(item => {
          content.innerHTML += createShopCard({
            name: item.name,
            desc: item.desc,
            owned: unlockedCubes.includes(item.id),
            equipped: equippedCube === item.id,
            preview: getCubePreviewMarkup(item),
            buyAction: `buyCube('${item.id}')`,
            equipAction: `equipCube('${item.id}')`
          });
        });
      }

      if (shopTab === "trails") {
        title.innerText = "Trails";
        trailItems.forEach(item => {
          content.innerHTML += createShopCard({
            name: item.name,
            desc: item.desc,
            owned: unlockedTrails.includes(item.id),
            equipped: equippedTrail === item.id,
            preview: getTrailPreviewMarkup(item),
            buyAction: `buyTrail('${item.id}')`,
            equipAction: `equipTrail('${item.id}')`
          });
        });
      }

    }

    function createShopCard({ name, desc, owned, equipped, preview, buyAction, equipAction, ownedLabel }) {
      let button = "";
      if (equipped) {
        button = `<button class="shop-btn equipped-btn" disabled>${ownedLabel || "Equipped"}</button>`;
      } else if (owned) {
        button = `<button class="shop-btn equip-btn" onclick="${equipAction}">Equip</button>`;
      } else {
        button = `<button class="shop-btn" onclick="${buyAction}">Get</button>`;
      }

      return `
        <div class="shop-card">
          <div class="shop-card-top">
            ${preview}
            <div class="card-info">
              <div class="card-title">${name}</div>
              <div class="card-subtitle">${desc}</div>
            </div>
          </div>
          <div class="card-footer">
            ${button}
          </div>
        </div>
      `;
    }

    function buyCube(id) {
      if (!unlockedCubes.includes(id)) {
        unlockedCubes.push(id);
        equippedCube = id;
        if (cube) applyCubeSkinToBody(cube, getCubeSkin(id));
        saveGame();
        renderShopContent();
      }
    }

    function equipCube(id) {
      equippedCube = id;
      if (cube) applyCubeSkinToBody(cube, getCubeSkin(id));
      saveGame();
      renderShopContent();
    }

    function buyStair(id) {
      if (!unlockedStairs.includes(id)) {
        unlockedStairs.push(id);
        equippedStair = id;
        saveGame();
        renderShopContent();
      }
    }

    function equipStair(id) {
      equippedStair = id;
      saveGame();
      renderShopContent();
    }

    function buyTrail(id) {
      if (!unlockedTrails.includes(id)) {
        unlockedTrails.push(id);
        equippedTrail = id;
        saveGame();
        renderShopContent();
      }
    }

    function equipTrail(id) {
      equippedTrail = id;
      saveGame();
      renderShopContent();
    }

    function buyEffect(id) {
      if (!unlockedEffects.includes(id)) {
        unlockedEffects.push(id);
        equippedEffect = id;
        saveGame();
        renderShopContent();
      }
    }

    function equipEffect(id) {
      equippedEffect = id;
      saveGame();
      renderShopContent();
    }

    function buyUpgrade(id) {
      if (!purchasedUpgrades.includes(id)) {
        purchasedUpgrades.push(id);
        saveGame();
        renderShopContent();
      }
    }

    function getPerkChoices() {
      const remaining = perkPool.filter(p => !perkSelectionsTaken.has(p.id));
      const pool = [...remaining];
      const picks = [];
      while (pool.length && picks.length < 2) {
        const idx = Math.floor(Math.random() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
      }
      return picks;
    }

    function maybeOpenPerkChoice() {
      if (perkPaused || gameOver || hasWon) return;
      const milestones = [15, 30, 50];
      for (const step of milestones) {
        if (currentSteps >= step && !perkSelectionsTaken.has(`milestone_${step}`)) {
          perkSelectionsTaken.add(`milestone_${step}`);
          pendingPerkStep = step;
          openPerkPanel();
          break;
        }
      }
    }

    function openPerkPanel() {
      if (perkPaused) return;
      const list = document.getElementById("perk-list");
      const picks = getPerkChoices();
      if (!picks.length) return;
      perkPaused = true;
      engine.timing.timeScale = 0;
      setCanvasInput(false);
      document.getElementById("perk-panel").style.display = "block";
      refreshInRunControls();
      setStatus("Choose Perk", "idle");
      list.innerHTML = picks.map(p => `
        <div class="perk-card">
          <div class="perk-badge">${p.badge}</div>
          <h4>${p.name}</h4>
          <p>${p.desc}</p>
          <div style="margin-top:12px;">
            <button class="perk-btn" onclick="choosePerk('${p.id}')">Take Perk</button>
          </div>
        </div>
      `).join("");
    }

    function choosePerk(id) {
      if (activePerks.includes(id)) return;
      activePerks.push(id);
      perkSelectionsTaken.add(id);
      if (id === "bump") perkCharges.bump += 2;
      if (id === "slam") perkCharges.slam += 3;
      if (id === "relaunch") perkCharges.relaunch += 1;
      runStats.perkChoices++;
      document.getElementById("perk-panel").style.display = "none";
      perkPaused = false;
      pendingPerkStep = null;
      engine.timing.timeScale = isPaused ? 0 : 1;
      setCanvasInput(true);
      updatePerkActionButtons();
      refreshInRunControls();
      showPopup("PERK +", cube.position.x, cube.position.y - 40, "#c7b6ff");
      setStatus("Perk Applied", "live");
    }

    function showMainMenu() {
      setScreenState("menu");
      isPaused = false;
      perkPaused = false;
      engine.timing.timeScale = 1;
      document.getElementById("game-over").style.display = "none";
      document.getElementById("shop-menu").style.display = "none";
      document.getElementById("challenge-panel").style.display = "none";
      document.getElementById("settings-panel").style.display = "none";
      document.getElementById("perk-panel").style.display = "none";
      document.getElementById("pause-panel").style.display = "none";
      document.getElementById("hud").style.display = "none";
      document.getElementById("top-controls").style.display = "none";
      updateLegendVisibility();
      document.getElementById("main-menu").style.display = "block";
      setCanvasInput(false);
      refreshInRunControls();
      updateHud();
      setStatus("Ready", "idle");
      generateLevel(false);
    }

    function startGame() {
      setScreenState("game");
      isPaused = false;
      perkPaused = false;
      engine.timing.timeScale = 1;
      document.getElementById("main-menu").style.display = "none";
      document.getElementById("shop-menu").style.display = "none";
      document.getElementById("challenge-panel").style.display = "none";
      document.getElementById("settings-panel").style.display = "none";
      document.getElementById("perk-panel").style.display = "none";
      document.getElementById("pause-panel").style.display = "none";
      document.getElementById("game-over").style.display = "none";
      document.getElementById("hud").style.display = "block";
      updateLegendVisibility();
      setCanvasInput(true);
      refreshInRunControls();

      currentSteps = 0;
      combo = 1;
      comboStreak = 0;
      bestComboThisRun = 1;
      launchWasPerfect = false;
      activePerks = [];
      perkCharges = { bump: 0, slam: 0, relaunch: 0 };
      perkSelectionsTaken = new Set();
      pendingPerkStep = null;
      runStats = {
        steps: 0,
        bestCombo: 1,
        specialHits: 0,
        perfectLaunch: false,
        perkChoices: 0,
        lastStepIndex: null,
        maxStepSkip: 0,
        fastestSpeed: 0,
        furthestDistance: 0
      };
      speedTrackingActive = false;

      stats.gamesPlayed++;
      queueSave();
      updateHud();
      updatePerkActionButtons();
      setStatus("Aiming", "idle");
      generateLevel(true);
    }

    function togglePause() {
      if (gameOver || document.getElementById("hud").style.display !== "block" || perkPaused) return;
      isPaused = !isPaused;
      engine.timing.timeScale = isPaused ? 0 : 1;
      document.getElementById("pause-panel").style.display = isPaused ? "block" : "none";
      setCanvasInput(!isPaused);
      refreshInRunControls();
      setStatus(isPaused ? "Paused" : "In Motion", isPaused ? "danger" : "live");
    }

    function generateStair(index, currentX, currentY, isPlayable, startIndex, activeTheme) {
      const stepHeight = 40;
      let stepWidth = 65 + Math.random() * 85;
      let x = currentX + stepWidth / 2;
      let y = currentY + stepHeight / 2;

      let stairColor = index % 2 === 0 ? activeTheme.c1 : activeTheme.c2;
      let effectLabel = "normal";
      let stroke = activeTheme.stroke || "rgba(255,255,255,0.16)";
      let meta = { moving: false, breakable: false, portalTarget: null, gravityMode: null, flash: 0, telegraph: 0, glow: activeTheme.glow || "rgba(255,255,255,0.14)" };

      if (isPlayable && index > startIndex + 3) {
        let specialChance = 0.24;
        if (index > 200) specialChance += 0.06;

        if (Math.random() < specialChance) {
          const randType = Math.random();

          if (randType < 0.16) {
            stairColor = "#56d7ff"; effectLabel = "dash"; stroke = "rgba(86, 215, 255, 0.65)";
          } else if (randType < 0.25) {
            stairColor = "#ff61ee"; effectLabel = "chaos"; stroke = "rgba(255, 97, 238, 0.65)";
          } else if (randType < 0.38) {
            stairColor = "#79e38d"; effectLabel = "bouncy"; stroke = "rgba(121, 227, 141, 0.65)";
          } else if (randType < 0.49) {
            stairColor = "#ffb35c"; effectLabel = "sticky"; stroke = "rgba(255, 179, 92, 0.65)";
          } else if (randType < 0.60) {
            stairColor = "#dff9ff"; effectLabel = "ice"; stroke = "rgba(223, 249, 255, 0.8)";
          } else if (randType < 0.74) {
            effectLabel = "gravity";
            meta.gravityMode = Math.random() < 0.5 ? "push" : "pull";
            if (meta.gravityMode === "push") {
              stairColor = "#79e8ff";
              stroke = "rgba(134, 241, 255, 0.86)";
            } else {
              stairColor = "#b184ff";
              stroke = "rgba(255, 160, 229, 0.84)";
            }
          } else if (randType < 0.85) {
            stairColor = "#94a3ff"; effectLabel = "portal"; stroke = "rgba(148, 163, 255, 0.8)";
          } else if (randType < 0.94) {
            stairColor = "#d7ecff"; effectLabel = "glass"; stroke = "rgba(215, 236, 255, 0.92)"; meta.breakable = true;
          } else {
            stairColor = "#c27dff"; effectLabel = "roulette"; stroke = "rgba(194, 125, 255, 0.85)";
          }
        }
      }

      if (effectLabel === "normal") {
        stairColor = "rgba(214, 236, 255, 0.12)";
        stroke = "rgba(212, 245, 255, 0.42)";
        meta.glow = "rgba(170, 232, 255, 0.18)";
      }

      let stair = Bodies.rectangle(x, y, stepWidth, stepHeight, {
        isStatic: true,
        label: `stair_${effectLabel}_${index}`,
        chamfer: { radius: 8 },
        render: {
          fillStyle: stairColor,
          strokeStyle: stroke,
          lineWidth: effectLabel === "normal" ? 2.1 : 2.4
        }
      });

      stair.plugin = {
        originalColor: stairColor,
        originalStroke: stroke,
        homeX: x,
        homeY: y,
        index: index,
        phase: Math.random() * Math.PI * 2,
        range: 18 + Math.random() * 25,
        effect: effectLabel,
        ...meta
      };

      return { stair, stepWidth };
    }

    function generateMoreStairs(count, isPlayable) {
      const activeTheme = stairThemes.find(t => t.id === equippedStair) || stairThemes[0];
      const stageStart = getStageStartConfig(isPlayable);
      const startIndex = stageStart.startIndex;
      const stepHeight = 40;
      const newStairs = [];

      for (let i = 0; i < count; i++) {
        const { stair, stepWidth } = generateStair(stairGenIndex, stairGenX, stairGenY, isPlayable, startIndex, activeTheme);
        stairsArr.push(stair);
        newStairs.push(stair);

        if (stairGenIndex === startIndex) {
          startPos = { x: stair.position.x, y: stair.position.y - stepHeight - 10 };
          launchOrigin = { ...startPos };
        }

        stairGenX += stepWidth;
        stairGenY += stepHeight;
        stairGenIndex++;
      }

      if (newStairs.length) {
        Composite.add(world, newStairs);
        linkNewPortals(newStairs);
      }

      return newStairs;
    }

    function linkNewPortals(newStairs) {
      const portals = stairsArr.filter(s => s.label.includes("portal") && Composite.get(world, s.id, "body"));
      for (let i = 0; i < portals.length; i++) {
        const next = portals[(i + 1) % portals.length];
        portals[i].plugin.portalTarget = next;
      }
    }

    function cleanupOldStairs() {
      if (!cube) return;
      const cubeX = cube.position.x;
      const buffer = width * 3;
      for (let i = stairsArr.length - 1; i >= 0; i--) {
        const s = stairsArr[i];
        if (s.position.x < cubeX - buffer) {
          if (Composite.get(world, s.id, "body")) Composite.remove(world, s);
          touchedStairs.delete(s.id);
          specialTouchedStairs.delete(s.id);
          brokenStairs.delete(s.id);
          stairsArr.splice(i, 1);
        }
      }
      movingStairs = movingStairs.filter(s => Composite.get(world, s.id, "body"));
    }

    function ensureStairsAhead() {
      if (!cube) return;
      const cubeX = cube.position.x;
      const lookAhead = width * 4;
      const farthestStair = stairsArr.length ? stairsArr[stairsArr.length - 1].position.x : 0;
      if (farthestStair < cubeX + lookAhead) {
        generateMoreStairs(30, true);
      }
    }

    function generateLevel(isPlayable) {
      Composite.clear(world);
      Engine.clear(engine);

      stairsArr = [];
      movingStairs = [];
      touchedStairs.clear();
      specialTouchedStairs.clear();
      brokenStairs.clear();
      trail = [];
      particles = [];
      popups = [];
      heroMoments = [];
      isLaunched = false;
      gameOver = false;
      hasWon = false;
      isPaused = false;
      perkPaused = false;
      stationaryFrames = 0;
      isDragging = false;
      dragPointerId = null;
      aimPoint = null;
      elastic = null;
      cameraShake = 0;
      gameTick = 0;
      trailSampleTick = 0;
      launchCharge = 0;
      launchOrigin = { x: 0, y: 0 };
      recentStairContact = { id: null, time: 0 };
      slamLockUntil = 0;
      relaunchPrimed = false;
      launchContext = "normal";

      const stageStart = getStageStartConfig(isPlayable);
      stairGenX = stageStart.x;
      stairGenY = stageStart.y;
      stairGenIndex = 0;
      lastCleanupIndex = 0;

      const initialCount = isPlayable ? 80 : 60;
      generateMoreStairs(initialCount, isPlayable);

      cube = createCubeBody(startPos, BASE_CUBE_CLASS);
      Composite.add(world, cube);

      if (isPlayable) {
        elastic = Constraint.create({
          pointA: { x: startPos.x, y: startPos.y },
          bodyB: cube,
          stiffness: 0.04,
          damping: 0.01,
          render: {
            strokeStyle: "rgba(180, 220, 255, 0.55)",
            lineWidth: 4,
            type: "line"
          }
        });

        Composite.add(world, elastic);
      } else {
        focusCameraOnCube();
      }

      focusCameraOnCube();
    }

    function getWorldPointFromClient(clientX, clientY) {
      const rect = render.canvas.getBoundingClientRect();
      const boundsWidth = render.bounds.max.x - render.bounds.min.x;
      const boundsHeight = render.bounds.max.y - render.bounds.min.y;

      const scaleX = boundsWidth / rect.width;
      const scaleY = boundsHeight / rect.height;

      return {
        x: render.bounds.min.x + (clientX - rect.left) * scaleX,
        y: render.bounds.min.y + (clientY - rect.top) * scaleY
      };
    }

    function pointInCube(worldPoint) {
      return cube && Bounds.contains(cube.bounds, worldPoint);
    }

    function getLaunchChargeFromPullDistance(dist) {
      const raw = Math.max(0, Math.min(1, dist / MAX_PULL));
      if (raw <= LAUNCH_DEADZONE) return 0;
      const normalized = (raw - LAUNCH_DEADZONE) / (1 - LAUNCH_DEADZONE);
      return Math.max(0, Math.min(1, Math.pow(normalized, LAUNCH_POWER_CURVE)));
    }

    function getPullDistanceFromLaunchCharge(charge) {
      const clamped = Math.max(0, Math.min(1, charge));
      if (clamped <= 0) return MAX_PULL * LAUNCH_DEADZONE;
      const normalized = Math.pow(clamped, 1 / LAUNCH_POWER_CURVE);
      return MAX_PULL * (LAUNCH_DEADZONE + normalized * (1 - LAUNCH_DEADZONE));
    }

    function getLaunchVectorFromPosition(position) {
      const pullVector = Vector.sub(launchOrigin, position);
      const rawDistance = Vector.magnitude(Vector.sub(position, launchOrigin));
      const charge = getLaunchChargeFromPullDistance(rawDistance);
      const direction = Vector.magnitude(pullVector) > 0.0001 ? Vector.normalise(pullVector) : { x: 0, y: 0 };
      const contextScale = launchContext === "relaunch" ? RELAUNCH_POWER_SCALE : OPENING_LAUNCH_SCALE;
      const scaledMagnitude = MAX_PULL * Math.pow(charge, LAUNCH_VELOCITY_CURVE) * LAUNCH_VELOCITY_BOOST * contextScale;
      return {
        charge,
        velocity: Vector.mult(direction, scaledMagnitude * BASE_CUBE_CLASS.launchPower)
      };
    }

    function getCurrentAimPoint() {
      return aimPoint || launchOrigin;
    }

    function getClampedDragPosition(worldPoint) {
      const delta = Vector.sub(worldPoint, launchOrigin);
      const dist = Vector.magnitude(delta);
      if (dist <= MAX_PULL) return worldPoint;
      const dir = Vector.normalise(delta);
      return Vector.add(launchOrigin, Vector.mult(dir, MAX_PULL));
    }

    function beginDrag(worldPoint, pointerId = "mouse") {
      if (!cube || isLaunched || gameOver || isPaused || perkPaused) return;
      if (!pointInCube(worldPoint)) return;

      isDragging = true;
      relaunchPrimed = false;
      relaunchReadyAt = 0;
      launchContext = "normal";
      dragPointerId = pointerId;
      Body.setStatic(cube, true);
      launchOrigin = { x: cube.position.x, y: cube.position.y };
      Body.setPosition(cube, launchOrigin);
      Body.setVelocity(cube, { x: 0, y: 0 });
      Body.setAngularVelocity(cube, 0);
      Body.setAngle(cube, 0);
      aimPoint = { ...launchOrigin };
      launchCharge = 0;
      setStatus("Aiming", "idle");
    }

    function updateDrag(worldPoint) {
      if (!isDragging || !cube) return;

      const clampedPos = getClampedDragPosition(worldPoint);
      aimPoint = clampedPos;
      Body.setPosition(cube, launchOrigin);
      Body.setVelocity(cube, { x: 0, y: 0 });
      Body.setAngularVelocity(cube, 0);

      const pullDist = Vector.magnitude(Vector.sub(aimPoint, launchOrigin));
      launchCharge = getLaunchChargeFromPullDistance(pullDist);
    }

    function endDrag() {
      if (!isDragging || !cube || isLaunched) return;

      isDragging = false;
      dragPointerId = null;

      const launchData = getLaunchVectorFromPosition(getCurrentAimPoint());
      const pullStrength = launchData.charge;
      const launchVelocity = launchData.velocity;

      const perfectWindow = getPerfectChargeWindow();
      launchWasPerfect = pullStrength >= perfectWindow.min && pullStrength <= perfectWindow.max;
      airStartY = cube.position.y;
      airStartTime = performance.now();
      lastLaunchVector = Vector.magnitude(launchVelocity) > 0.0001 ? Vector.normalise(launchVelocity) : { x: 0, y: -1 };

      Body.setStatic(cube, false);
      Body.setPosition(cube, launchOrigin);
      Body.setVelocity(cube, launchVelocity);

      isLaunched = true;
      speedTrackingActive = false;
      setStatus(launchWasPerfect ? "Perfect Launch" : "In Motion", launchWasPerfect ? "idle" : "live");

      if (launchWasPerfect) {
        runStats.perfectLaunch = true;
        stats.perfectLaunches++;
        showPopup("PERFECT", cube.position.x, cube.position.y - 30, "#8effff");
        spawnBurst(cube.position.x, cube.position.y, "#8effff", 14, 5);
        queueSave();
      }

      setTimeout(() => {
        if (elastic) {
          Composite.remove(world, elastic);
          elastic = null;
        }
      }, 20);

      launchContext = "normal";
      aimPoint = null;
      updateHud();
    }

    function cancelDrag() {
      if (!cube) return;

      isDragging = false;
      relaunchPrimed = false;
      relaunchReadyAt = 0;
      dragPointerId = null;
      Body.setStatic(cube, false);
      Body.setPosition(cube, launchOrigin);
      Body.setVelocity(cube, { x: 0, y: 0 });
      Body.setAngularVelocity(cube, 0);
      Body.setAngle(cube, 0);
      launchCharge = 0;
      launchContext = "normal";
      aimPoint = null;
    }

    render.canvas.addEventListener("mousedown", (e) => {
      if (isLaunched && usePerkAction("slam")) return;
      beginDrag(getWorldPointFromClient(e.clientX, e.clientY), "mouse");
    });

    window.addEventListener("mousemove", (e) => {
      if (dragPointerId !== "mouse") return;
      updateDrag(getWorldPointFromClient(e.clientX, e.clientY));
    });

    window.addEventListener("mouseup", () => {
      if (dragPointerId === "mouse") endDrag();
    });

    render.canvas.addEventListener("touchstart", (e) => {
      for (const touch of e.changedTouches) {
        if (isLaunched && usePerkAction("slam")) return;
        if (!isDragging) beginDrag(getWorldPointFromClient(touch.clientX, touch.clientY), touch.identifier);
      }
    }, { passive: false });

    window.addEventListener("touchmove", (e) => {
      const shopOpen = document.getElementById("shop-menu").style.display === "block";
      const menuOpen = document.getElementById("main-menu").style.display === "block";
      const gameOverOpen = document.getElementById("game-over").style.display === "block";
      const challengeOpen = document.getElementById("challenge-panel").style.display === "block";
      const settingsOpen = document.getElementById("settings-panel").style.display === "block";
      const perkOpen = document.getElementById("perk-panel").style.display === "block";
      const pauseOpen = document.getElementById("pause-panel").style.display === "block";

      if (!isDragging) {
        if (!(shopOpen || menuOpen || gameOverOpen || challengeOpen || settingsOpen || perkOpen || pauseOpen)) {
          e.preventDefault();
        }
        return;
      }

      for (const touch of e.changedTouches) {
        if (touch.identifier === dragPointerId) {
          updateDrag(getWorldPointFromClient(touch.clientX, touch.clientY));
          break;
        }
      }

      e.preventDefault();
    }, { passive: false });

    window.addEventListener("touchend", (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === dragPointerId) {
          endDrag();
          break;
        }
      }
    });

    window.addEventListener("touchcancel", () => {
      if (isDragging) cancelDrag();
    });

    const keys = {};
    window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
    window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

    function getComboWindow() {
      let base = purchasedUpgrades.includes("impact_master") ? 1200 : 900;
      return base;
    }

    function addComboHit(baseScore = 1, isSpecial = false, x = 0, y = 0) {
      const now = performance.now();

      if (now - lastHitTime < getComboWindow()) comboStreak++;
      else comboStreak = 1;

      lastHitTime = now;
      combo = Math.min(1 + Math.floor(comboStreak / 2), 12);
      bestComboThisRun = Math.max(bestComboThisRun, combo);
      runStats.bestCombo = Math.max(runStats.bestCombo, combo);
      stats.highestCombo = Math.max(stats.highestCombo, combo);

      if (combo >= 3) {
        const comboText = combo >= 10 ? `UNREAL x${combo}` : combo >= 7 ? `WOW x${combo}` : combo >= 5 ? `SICK x${combo}` : `COMBO x${combo}`;
        const comboColor = combo >= 7 ? "#ffd166" : "#8fbeff";
        showHeroMoment(comboText, comboColor, combo >= 7 ? "rgba(255,209,102,0.18)" : "rgba(143,190,255,0.18)");
      }

      updateHud();
    }

    function checkAirBonus() {
      const airTime = (performance.now() - airStartTime) / 1000;
      const rise = Math.max(0, airStartY - cube.position.y);
      const currentSpeed = cube ? cube.speed * SPEED_MPH_SCALE : 0;

      if ((airTime > 0.65 || rise > 120) && currentSpeed > AIR_SPARK_SPEED_THRESHOLD) {
        spawnBurst(cube.position.x, cube.position.y - 10, "#ffd76c", 4, 2.5, {
          minSize: 1.2,
          maxSize: 2.2,
          minLife: 16,
          lifeRange: 12,
          speedJitterMin: 0.55,
          speedJitterMax: 1.05,
          glow: 16,
          streak: 6
        });
        spawnBurst(cube.position.x, cube.position.y - 10, "#6fe8ff", 6, 3.1, {
          minSize: 0.9,
          maxSize: 1.8,
          minLife: 14,
          lifeRange: 10,
          speedJitterMin: 0.65,
          speedJitterMax: 1.15,
          glow: 18,
          streak: 10
        });
      }
    }

    function applySpecialEffect(stair, effect, sourceEffect = effect) {
      if (effect === "dash") {
        Body.setVelocity(cube, { x: 22, y: -4 });
        setStatus(sourceEffect === "roulette" ? "Roulette Dash" : "Dash Boost", "live");
        shake(5);
        return;
      }

      if (effect === "chaos") {
        let randX = (Math.random() - 0.5) * 40;
        let randY = -15 - Math.random() * 15;
        Body.setVelocity(cube, { x: randX, y: randY });
        setStatus(sourceEffect === "roulette" ? "Roulette Chaos" : "Chaos Kick", "danger");
        shake(6);
        return;
      }

      if (effect === "bouncy") {
        if (performance.now() < slamLockUntil) {
          Body.setVelocity(cube, {
            x: cube.velocity.x * 0.3,
            y: Math.min(cube.velocity.y, 6)
          });
          setStatus("Slam Impact", "danger");
        } else {
          Body.setVelocity(cube, { x: cube.velocity.x * 1.18, y: -18 });
          setStatus(sourceEffect === "roulette" ? "Roulette Bounce" : "Bounce Boost", "live");
          shake(7);
        }
        return;
      }

      if (effect === "sticky") {
        if (getPerkValue("anti_stick")) {
          Body.setVelocity(cube, { x: cube.velocity.x * 1.02, y: cube.velocity.y * 0.98 });
          showPopup("NO STICK", stair.position.x, stair.position.y - 32, "#b8ffb7");
          setStatus("Slipstream", "live");
        } else {
          const stickyScale = 0.15;
          Body.setVelocity(cube, { x: cube.velocity.x * stickyScale, y: cube.velocity.y * stickyScale });
          setStatus("Sticky Drag", "danger");
        }
        return;
      }

      if (effect === "ice") {
        Body.setVelocity(cube, { x: cube.velocity.x + 1.5, y: cube.velocity.y });
        setStatus("Ice Slide", "idle");
        return;
      }

      if (effect === "coin") {
        return;
      }

      if (effect === "portal") {
        if (stair.plugin.portalTarget) {
          const t = stair.plugin.portalTarget;
          const exitDir = Math.sign(cube.velocity.x || lastLaunchVector.x || 1) || 1;
          Body.setPosition(cube, { x: t.position.x + exitDir * 14, y: t.position.y - 82 });
          Body.setVelocity(cube, { x: exitDir * 10, y: -14 });
          showPopup("PORTAL", t.position.x, t.position.y - 36, "#b4beff");
          setStatus(sourceEffect === "roulette" ? "Roulette Warp" : "Warp Jump", "live");
          shake(8);
        }
        return;
      }

      if (effect === "gravity") {
        const gravityMode = stair.plugin?.gravityMode || (Math.random() < 0.5 ? "push" : "pull");
        if (gravityMode === "push") {
          const launchDir = Math.sign(cube.velocity.x || lastLaunchVector.x || 1) || 1;
          Body.setVelocity(cube, {
            x: launchDir * Math.max(12, Math.abs(cube.velocity.x) * 1.15),
            y: -22
          });
          showPopup("PUSH", stair.position.x, stair.position.y - 34, "#86f1ff");
          setStatus(sourceEffect === "roulette" ? "Roulette Push" : "Gravity Push", "live");
        } else {
          Body.setVelocity(cube, {
            x: cube.velocity.x * 0.6,
            y: Math.max(26, cube.velocity.y + 18)
          });
          showPopup("PULL", stair.position.x, stair.position.y - 34, "#ff9be6");
          setStatus(sourceEffect === "roulette" ? "Roulette Pull" : "Gravity Pull", "danger");
        }
        shake(8);
        return;
      }

      if (effect === "glass") {
        if (!brokenStairs.has(stair.id)) {
          brokenStairs.add(stair.id);
          stair.plugin.breakTimer = 1;
          Body.setVelocity(cube, { x: cube.velocity.x * 0.82, y: Math.max(-2, cube.velocity.y * 0.2) });
          showPopup("SHATTER", stair.position.x, stair.position.y - 34, "#e7f7ff");
          setStatus("Glass Step", "danger");
        }
        return;
      }

      if (effect === "roulette") {
        const options = ["dash", "chaos", "bouncy", "sticky", "ice", "portal", "gravity", "glass"];
        const chosen = options[Math.floor(Math.random() * options.length)];
        showPopup(`? ${chosen.toUpperCase()}`, stair.position.x, stair.position.y - 48, "#e0b3ff");
        applySpecialEffect(stair, chosen, "roulette");
        return;
      }

      if (effect === "moving") {
        setStatus("Moving Platform", "idle");
      }
    }

    function hitSpecial(stair, effect) {
      if (!specialTouchedStairs.has(stair.id)) {
        specialTouchedStairs.add(stair.id);
        stats.specialHits++;
        runStats.specialHits++;
        queueSave();
      }
      applySpecialEffect(stair, effect);
    }

    function triggerGameOver() {
      setScreenState("game");
      gameOver = true;
      isDragging = false;
      setCanvasInput(false);

      document.getElementById("hud").style.display = "none";
      document.getElementById("top-controls").style.display = "none";
      updateLegendVisibility();
      document.getElementById("perk-panel").style.display = "none";
      document.getElementById("game-over").style.display = "block";
      refreshInRunControls();

      const title = document.getElementById("game-over-title");
      title.innerText = "RUN OVER";
      title.style.color = "#ffcfb2";

      document.getElementById("final-steps").innerText = currentSteps;
      document.getElementById("best-combo-run").innerText = "x" + bestComboThisRun;

      stats.lifetimeSteps += currentSteps;
      stats.bestSteps = Math.max(stats.bestSteps, currentSteps);
      stats.fastestSpeed = Math.max(stats.fastestSpeed || 0, runStats.fastestSpeed || 0);
      stats.furthestDistance = Math.max(stats.furthestDistance || 0, runStats.furthestDistance || 0);

      const breakdown = document.getElementById("run-breakdown");
      breakdown.innerHTML = `
        <div>Special Stairs: ${runStats.specialHits} | Perks Chosen: ${runStats.perkChoices}</div>
        <div>Fastest Speed: ${Math.round(runStats.fastestSpeed || 0)} | Furthest Distance: ${Math.round(runStats.furthestDistance || 0)}</div>
      `;

      saveGame();
      renderChallenges();
      updateHud();
    }

    Events.on(engine, "beforeUpdate", function() {
      if (isPaused || perkPaused) return;
      gameTick++;

      if (isRainbowCubeSkin(getCubeSkin()) && cube) {
        cube.render.fillStyle = `hsl(${(gameTick * 3) % 360}, 100%, 65%)`;
      }

      if (movingStairs.length) {
        movingStairs.forEach(stair => {
          const x = stair.plugin.homeX + Math.sin(gameTick * 0.035 + stair.plugin.phase) * stair.plugin.range;
          Body.setPosition(stair, { x, y: stair.plugin.homeY });
        });
      }

      stairsArr.forEach(stair => {
        if (!stair.plugin) return;
        const fx = stair.plugin.effect;
        stair.plugin.telegraph += 0.06;
        if (stair.plugin.flash > 0) stair.plugin.flash -= 0.08;
        if (stair.plugin.breakTimer != null) {
          stair.plugin.breakTimer -= 1;
          if (stair.plugin.breakTimer <= 0) {
            if (Composite.get(world, stair.id, "body")) Composite.remove(world, stair);
            stair.plugin.breakTimer = null;
          }
        }
        const flashMix = Math.max(0, stair.plugin.flash || 0);
        const baseWidth = fx === "normal" ? 2.2 : 2.4;
        stair.render.lineWidth = baseWidth + flashMix * 1.8;
        stair.render.strokeStyle = stair.plugin.originalStroke;
      });

      if (cube && !gameOver && document.getElementById("hud").style.display === "block") {
        if (isLaunched && gameTick % 10 === 0) {
          ensureStairsAhead();
          cleanupOldStairs();
        }

        if (isDragging) {
          Body.setVelocity(cube, { x: 0, y: 0 });
          Body.setAngularVelocity(cube, 0);
        }

        if (!isDragging && cube.speed > MAX_CUBE_SPEED) {
          const ratio = MAX_CUBE_SPEED / cube.speed;
          Body.setVelocity(cube, {
            x: cube.velocity.x * ratio,
            y: cube.velocity.y * ratio
          });
        }

        if (isLaunched) {
          const controlBoost = purchasedUpgrades.includes("air_control") ? 0.12 : 0;
          const airControl = BASE_CUBE_CLASS.control + controlBoost;
          if (keys["arrowleft"] || keys["a"]) Body.applyForce(cube, cube.position, { x: -0.0008 * airControl, y: 0 });
          if (keys["arrowright"] || keys["d"]) Body.applyForce(cube, cube.position, { x: 0.0008 * airControl, y: 0 });
        }

        const shakeX = (Math.random() - 0.5) * cameraShake;
        const shakeY = (Math.random() - 0.5) * cameraShake;

        const cameraOffset = getCameraOffset();
        Render.lookAt(render, {
          min: { x: cube.position.x - width / 2 + cameraOffset.x + shakeX, y: cube.position.y - height / 2 + cameraOffset.y + shakeY },
          max: { x: cube.position.x + width / 2 + cameraOffset.x + shakeX, y: cube.position.y + height / 2 + cameraOffset.y + shakeY }
        });

        cameraShake *= 0.86;
        if (cameraShake < 0.1) cameraShake = 0;

        if (isLaunched && !hasWon) {
          const activeTrail = getTrailItem();
          const currentSpeed = cube.speed * SPEED_MPH_SCALE;
          if (currentSpeed > TRAIL_SPEED_THRESHOLD) {
            trailSampleTick++;
            const shouldCapture = !isTextureTrail(activeTrail) || trailSampleTick % 2 === 0;
            if (shouldCapture) {
              trail.unshift({ x: cube.position.x, y: cube.position.y });
              const maxTrailLength = isTextureTrail(activeTrail)
                ? (deviceProfile.tier === "desktop" ? 18 : 12)
                : (deviceProfile.tier === "desktop" ? 40 : 24);
              if (trail.length > maxTrailLength) trail.pop();
            }
          } else if (trail.length) {
            trail = [];
            trailSampleTick = 0;
          }
        }
      }

      updateGameBackgroundPan();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
      }

      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) popups.splice(i, 1);
      }

      for (let i = heroMoments.length - 1; i >= 0; i--) {
        heroMoments[i].life--;
        if (heroMoments[i].life <= 0) heroMoments.splice(i, 1);
      }

      updateHud();
    });

    function drawTrajectoryGuide(ctx) {
      if (!cube || !isDragging) return;
      const launchData = getLaunchVectorFromPosition(getCurrentAimPoint());
      const velocity = launchData.velocity;
      let px = launchOrigin.x;
      let py = launchOrigin.y;
      let vx = velocity.x;
      let vy = velocity.y;
      const gravityY = engine.gravity.y * engine.gravity.scale * 60 * 60;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 8]);
      for (let i = 0; i < 24; i++) {
        px += vx * 0.55;
        py += vy * 0.55;
        vy += gravityY * 0.00026;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.34)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    function drawStairTelegraphs(ctx) {
      stairsArr.forEach(stair => {
        if (!stair.plugin || !stair.plugin.effect || stair.plugin.effect === "normal") return;
        if (!isWorldPointVisible(stair.position.x, stair.position.y, 80)) return;
        const effect = stair.plugin.effect;
        const pulse = 0.5 + Math.sin(stair.plugin.telegraph) * 0.5;
        ctx.save();
        ctx.translate(stair.position.x, stair.position.y);
        ctx.globalAlpha = 0.22 + pulse * 0.18 + Math.max(0, stair.plugin.flash || 0) * 0.4;
        ctx.strokeStyle = stair.plugin.originalStroke;
        ctx.fillStyle = stair.plugin.originalStroke;
        ctx.lineWidth = 2;

        if (effect === "dash") {
          ctx.beginPath();
          ctx.moveTo(-16, -6); ctx.lineTo(-2, -6); ctx.lineTo(-2, -12); ctx.lineTo(16, 0); ctx.lineTo(-2, 12); ctx.lineTo(-2, 6); ctx.lineTo(-16, 6); ctx.closePath();
          ctx.stroke();
        } else if (effect === "chaos") {
          ctx.beginPath();
          ctx.moveTo(-10, -12); ctx.lineTo(-2, -2); ctx.lineTo(-6, -2); ctx.lineTo(8, 12); ctx.lineTo(2, 1); ctx.lineTo(6, 1); ctx.closePath();
          ctx.stroke();
        } else if (effect === "sticky") {
          ctx.beginPath();
          ctx.arc(0, 0, 10 + pulse * 2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (effect === "portal") {
          ctx.beginPath();
          ctx.arc(0, 0, 8 + pulse * 3, 0, Math.PI * 2);
          ctx.stroke();
        } else if (effect === "coin") {
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.stroke();
        } else if (effect === "ice") {
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i;
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
          }
          ctx.stroke();
        } else if (effect === "bouncy") {
          ctx.beginPath();
          ctx.moveTo(-10, 6);
          ctx.quadraticCurveTo(-4, -10, 0, 6);
          ctx.quadraticCurveTo(4, -10, 10, 6);
          ctx.stroke();
        } else if (effect === "gravity") {
          ctx.beginPath();
          ctx.moveTo(0, -12); ctx.lineTo(0, 8);
          ctx.moveTo(-5, 2); ctx.lineTo(0, 8); ctx.lineTo(5, 2);
          ctx.stroke();
        } else if (effect === "glass") {
          ctx.beginPath();
          ctx.moveTo(-10, -10); ctx.lineTo(-2, -1); ctx.lineTo(-8, 10);
          ctx.moveTo(10, -10); ctx.lineTo(2, -1); ctx.lineTo(8, 10);
          ctx.moveTo(-2, -1); ctx.lineTo(2, -1);
          ctx.stroke();
        } else if (effect === "roulette") {
          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = "900 14px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", 0, 1);
        } else if (effect === "moving") {
          ctx.beginPath();
          ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
          ctx.moveTo(8, -4); ctx.lineTo(12, 0); ctx.lineTo(8, 4);
          ctx.moveTo(-8, -4); ctx.lineTo(-12, 0); ctx.lineTo(-8, 4);
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    function drawRoundedRectPath(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
    }

    function drawStairGlassOverlays(ctx) {
      stairsArr.forEach(stair => {
        if (!stair.plugin) return;
        if (!isWorldPointVisible(stair.position.x, stair.position.y, 120)) return;

        const width = stair.bounds.max.x - stair.bounds.min.x;
        const height = stair.bounds.max.y - stair.bounds.min.y;
        const glow = stair.plugin.glow || "rgba(255,255,255,0.14)";
        const baseFill = stair.plugin.originalColor || "#5b4de0";
        const edgeTint = stair.plugin.originalStroke || "rgba(255,255,255,0.5)";
        const isNormalStair = stair.plugin.effect === "normal";
        const shellAlpha = isNormalStair ? 0.84 : 0.98;
        const coreAlpha = isNormalStair ? 0.5 : 0.46;
        const glowAlpha = isNormalStair ? 0.26 : 0.4;
        const glossAlpha = isNormalStair ? 0.66 : 0.54;
        const accentAlpha = isNormalStair ? 0.74 : 0.34;
        const crystalAlpha = isNormalStair ? 0.46 : 0.42;

        ctx.save();
        ctx.translate(stair.position.x, stair.position.y);

        const shellGradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
        if (isNormalStair) {
          shellGradient.addColorStop(0, "rgba(255, 255, 255, 0.26)");
          shellGradient.addColorStop(0.2, "rgba(225, 244, 255, 0.16)");
          shellGradient.addColorStop(0.44, "rgba(185, 224, 255, 0.08)");
          shellGradient.addColorStop(0.78, "rgba(124, 173, 255, 0.08)");
          shellGradient.addColorStop(1, "rgba(84, 112, 214, 0.12)");
        } else {
          shellGradient.addColorStop(0, "rgba(246, 252, 255, 0.6)");
          shellGradient.addColorStop(0.14, baseFill);
          shellGradient.addColorStop(0.62, baseFill);
          shellGradient.addColorStop(0.86, "rgba(38, 16, 92, 0.82)");
          shellGradient.addColorStop(1, "rgba(18, 10, 52, 0.9)");
        }

        drawRoundedRectPath(ctx, -width / 2, -height / 2, width, height, 10);
        ctx.fillStyle = shellGradient;
        ctx.globalAlpha = shellAlpha;
        ctx.fill();

        const coreGradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
        coreGradient.addColorStop(0, isNormalStair ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.24)");
        coreGradient.addColorStop(0.22, isNormalStair ? "rgba(180, 242, 255, 0.12)" : "rgba(255,255,255,0.08)");
        coreGradient.addColorStop(0.65, isNormalStair ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.02)");
        coreGradient.addColorStop(1, "rgba(255,255,255,0)");
        drawRoundedRectPath(ctx, -width / 2 + 3, -height / 2 + 3, width - 6, height - 6, 8);
        ctx.fillStyle = coreGradient;
        ctx.globalAlpha = coreAlpha;
        ctx.fill();

        drawRoundedRectPath(ctx, -width / 2, -height / 2, width, height, 10);
        ctx.strokeStyle = glow;
        ctx.lineWidth = 9;
        ctx.globalAlpha = glowAlpha;
        ctx.stroke();

        const glossGradient = ctx.createLinearGradient(0, -height / 2, 0, 0);
        glossGradient.addColorStop(0, "rgba(240, 250, 255, 0.52)");
        glossGradient.addColorStop(0.5, "rgba(200, 244, 255, 0.16)");
        glossGradient.addColorStop(1, "rgba(255,255,255,0.01)");
        drawRoundedRectPath(ctx, -width / 2 + 4, -height / 2 + 4, width - 8, Math.max(10, height * 0.42), 8);
        ctx.fillStyle = glossGradient;
        ctx.globalAlpha = glossAlpha;
        ctx.fill();

        if (isNormalStair) {
          const hitFlash = Math.max(0, stair.plugin.flash || 0);
          if (hitFlash > 0.02) {
            const topHitGlow = ctx.createLinearGradient(0, -height / 2 + 4, 0, -height / 2 + height * 0.38);
            topHitGlow.addColorStop(0, "rgba(244, 253, 255, 1)");
            topHitGlow.addColorStop(0.32, "rgba(208, 245, 255, 0.82)");
            topHitGlow.addColorStop(0.62, "rgba(182, 232, 255, 0.42)");
            topHitGlow.addColorStop(1, "rgba(255,255,255,0)");
            drawRoundedRectPath(ctx, -width / 2 + 4, -height / 2 + 4, width - 8, Math.max(16, height * 0.56), 8);
            ctx.fillStyle = topHitGlow;
            ctx.globalAlpha = Math.min(1, hitFlash * 0.94);
            ctx.shadowColor = "rgba(170, 238, 255, 1)";
            ctx.shadowBlur = 22;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.beginPath();
            ctx.moveTo(-width / 2 + 9, -height / 2 + 8);
            ctx.lineTo(width / 2 - 9, -height / 2 + 8);
            ctx.strokeStyle = "rgba(236, 252, 255, 0.95)";
            ctx.lineWidth = 3.2;
            ctx.globalAlpha = Math.min(1, hitFlash * 0.98);
            ctx.shadowColor = "rgba(188, 244, 255, 1)";
            ctx.shadowBlur = 16;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }

        ctx.beginPath();
        ctx.moveTo(-width / 2 + 10, -height / 2 + 8);
        ctx.lineTo(width / 2 - 10, -height / 2 + 8);
        ctx.strokeStyle = isNormalStair ? "rgba(222, 245, 255, 0.64)" : edgeTint;
        ctx.lineWidth = isNormalStair ? 2.2 : 2.8;
        ctx.globalAlpha = isNormalStair ? 0.78 : 0.96;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-width / 2 + 16, height * 0.08);
        ctx.lineTo(width / 2 - 22, height * 0.08);
        ctx.strokeStyle = isNormalStair ? "rgba(255, 183, 245, 0.44)" : edgeTint;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = accentAlpha;
        ctx.stroke();

        const crystalGlow = ctx.createRadialGradient(0, -height * 0.12, 0, 0, -height * 0.12, Math.max(width * 0.55, height));
        crystalGlow.addColorStop(0, "rgba(255,255,255,0.34)");
        crystalGlow.addColorStop(0.4, "rgba(162, 232, 255, 0.16)");
        crystalGlow.addColorStop(1, "rgba(255,255,255,0)");
        drawRoundedRectPath(ctx, -width / 2 + 4, -height / 2 + 4, width - 8, height - 8, 8);
        ctx.fillStyle = crystalGlow;
        ctx.globalAlpha = crystalAlpha;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-width * 0.18, -height / 2 + 7);
        ctx.lineTo(-width * 0.03, height / 2 - 8);
        ctx.lineTo(width * 0.1, -height / 2 + 7);
        ctx.strokeStyle = isNormalStair ? "rgba(210, 244, 255, 0.26)" : "rgba(255, 255, 255, 0.18)";
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = isNormalStair ? 0.72 : 0.48;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(width * 0.22, -height * 0.16, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.56)";
        ctx.globalAlpha = isNormalStair ? 0.76 : 0.52;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(-width * 0.08, -height * 0.02, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(142, 230, 255, 0.48)";
        ctx.globalAlpha = isNormalStair ? 0.62 : 0.44;
        ctx.fill();

        ctx.restore();
      });
    }

    function drawAchievementMarkers(ctx) {
      stairsArr.forEach(stair => {
        if (!stair.plugin?.goldenTarget) return;
        if (!isWorldPointVisible(stair.position.x, stair.position.y, 100)) return;

        ctx.save();
        ctx.translate(stair.position.x, stair.position.y - 2);
        ctx.fillStyle = "#1b1607";
        ctx.font = "bold 16px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("67", 0, 5);
        ctx.strokeStyle = "rgba(255, 248, 204, 0.9)";
        ctx.lineWidth = 3;
        ctx.strokeText("67", 0, 5);
        ctx.restore();
      });
    }

    function getStairMarker(effect) {
      const markers = {
        dash: "D",
        chaos: "C",
        bouncy: "B",
        sticky: "S",
        ice: "I",
        coin: "$",
        portal: "P",
        gravity: "G",
        glass: "GL",
        roulette: "?",
        moving: "M"
      };
      return markers[effect] || "";
    }

    function drawStepIdentifiers(ctx) {
      return;
    }

    Events.on(render, "afterRender", function() {
      const ctx = render.context;

      ctx.save();

      const boundsWidth = render.bounds.max.x - render.bounds.min.x;
      const boundsHeight = render.bounds.max.y - render.bounds.min.y;
      ctx.scale(render.options.width / boundsWidth, render.options.height / boundsHeight);
      ctx.translate(-render.bounds.min.x, -render.bounds.min.y);
      ctx.globalCompositeOperation = "destination-over";
      drawTrail(ctx);
      ctx.globalCompositeOperation = "source-over";

      drawAchievementMarkers(ctx);
      drawStairGlassOverlays(ctx);
      drawStairTelegraphs(ctx);
      drawStepIdentifiers(ctx);

      particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / 40);
        if (p.glow) {
          ctx.shadowBlur = p.glow;
          ctx.shadowColor = p.color;
        }
        if (p.streak) {
          const angle = Math.atan2(p.vy, p.vx);
          ctx.translate(p.x, p.y);
          ctx.rotate(angle);
          const streakLength = p.streak * Math.max(0.35, p.life / 30);
          const sparkGradient = ctx.createLinearGradient(-streakLength, 0, streakLength * 0.15, 0);
          sparkGradient.addColorStop(0, "rgba(255,255,255,0)");
          sparkGradient.addColorStop(0.45, p.color);
          sparkGradient.addColorStop(1, "rgba(255,255,255,0.92)");
          ctx.strokeStyle = sparkGradient;
          ctx.lineWidth = Math.max(0.9, p.size * 0.95);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(-streakLength, 0);
          ctx.lineTo(streakLength * 0.2, 0);
          ctx.stroke();
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      });

      popups.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / 60);
        ctx.fillStyle = p.color;
        ctx.font = "bold 16px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      });

      if (!gameOver && !isLaunched && cube) {
        ctx.save();

        const launchOrbGlow = ctx.createRadialGradient(launchOrigin.x, launchOrigin.y, 0, launchOrigin.x, launchOrigin.y, 24);
        launchOrbGlow.addColorStop(0, "rgba(210, 245, 255, 0.26)");
        launchOrbGlow.addColorStop(0.45, "rgba(180, 215, 255, 0.14)");
        launchOrbGlow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.arc(launchOrigin.x, launchOrigin.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = launchOrbGlow;
        ctx.fill();

        const launchOrbFill = ctx.createLinearGradient(launchOrigin.x, launchOrigin.y - 12, launchOrigin.x, launchOrigin.y + 12);
        launchOrbFill.addColorStop(0, "rgba(255,255,255,0.26)");
        launchOrbFill.addColorStop(0.55, "rgba(190, 228, 255, 0.12)");
        launchOrbFill.addColorStop(1, "rgba(170, 200, 255, 0.06)");
        ctx.beginPath();
        ctx.arc(launchOrigin.x, launchOrigin.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = launchOrbFill;
        ctx.fill();
        ctx.strokeStyle = "rgba(214, 247, 255, 0.55)";
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(launchOrigin.x - 3, launchOrigin.y - 3.5, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.32)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(launchOrigin.x, launchOrigin.y, MAX_PULL, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 10]);
        ctx.stroke();

        const perfectWindow = getPerfectChargeWindow();
        const perfectStart = getPullDistanceFromLaunchCharge(perfectWindow.min);
        const perfectEnd = getPullDistanceFromLaunchCharge(perfectWindow.max);
        ctx.beginPath();
        ctx.arc(launchOrigin.x, launchOrigin.y, (perfectStart + perfectEnd) / 2, Math.PI * 0.8, Math.PI * 1.2);
        ctx.strokeStyle = "rgba(46,230,201,0.6)";
        ctx.lineWidth = perfectEnd - perfectStart;
        ctx.setLineDash([]);
        ctx.stroke();

        if (isDragging) {
          const currentAim = getCurrentAimPoint();
          const dx = launchOrigin.x - currentAim.x;
          const dy = launchOrigin.y - currentAim.y;

          ctx.beginPath();
          ctx.moveTo(launchOrigin.x, launchOrigin.y);
          ctx.lineTo(currentAim.x, currentAim.y);
          ctx.strokeStyle = "rgba(180, 220, 255, 0.65)";
          ctx.lineWidth = 4;
          ctx.shadowColor = "rgba(180, 220, 255, 0.35)";
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;

          const aimAngle = Math.atan2(dy, dx);
          const arrowLength = Math.max(14, Math.min(28, Math.hypot(dx, dy) * 0.18));
          ctx.beginPath();
          ctx.moveTo(launchOrigin.x, launchOrigin.y);
          ctx.lineTo(launchOrigin.x - Math.cos(aimAngle - 0.32) * arrowLength, launchOrigin.y - Math.sin(aimAngle - 0.32) * arrowLength);
          ctx.moveTo(launchOrigin.x, launchOrigin.y);
          ctx.lineTo(launchOrigin.x - Math.cos(aimAngle + 0.32) * arrowLength, launchOrigin.y - Math.sin(aimAngle + 0.32) * arrowLength);
          ctx.stroke();

          drawTrajectoryGuide(ctx);

          const inPerfectWindow = launchCharge >= perfectWindow.min && launchCharge <= perfectWindow.max;
          ctx.fillStyle = launchWasPerfect ? "rgba(46,230,201,0.9)" : inPerfectWindow ? "rgba(46,230,201,0.9)" : "rgba(124,92,255,0.85)";
          ctx.fillRect(launchOrigin.x - 60, launchOrigin.y + 165, 120 * launchCharge, 10);
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.strokeRect(launchOrigin.x - 60, launchOrigin.y + 165, 120, 10);
          ctx.fillStyle = "rgba(46,230,201,0.18)";
          ctx.fillRect(launchOrigin.x - 60 + 120 * perfectWindow.min, launchOrigin.y + 165, 120 * (perfectWindow.max - perfectWindow.min), 10);
          ctx.fillStyle = "#dfe9ff";
          ctx.font = "bold 12px Inter, sans-serif";
          ctx.textAlign = "center";
          const launchPercent = Math.round(launchCharge * 100);
          const launchText = inPerfectWindow ? `Perfect power · ${launchPercent}%` : launchCharge > perfectWindow.max ? `Too much power · ${launchPercent}%` : `Power ${launchPercent}%`;
          ctx.fillText(launchText, launchOrigin.x, launchOrigin.y + 155);
        }

        ctx.restore();
      }

      if (cube) {
        const activeCubeSkin = getCubeSkin();
        drawCubeOverlay(ctx, activeCubeSkin);
        if (!isSpriteCubeSkin(activeCubeSkin)) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cube.position.x, cube.position.y, 26, 0, Math.PI * 2);
          ctx.strokeStyle = getCubeAccentColor();
          ctx.globalAlpha = 0.12;
          ctx.lineWidth = 10;
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.restore();

      if (heroMoments.length) {
        const hero = heroMoments[heroMoments.length - 1];
        const alpha = Math.max(0, hero.life / 50);
        const rise = (1 - alpha) * 22;
        const screenX = render.options.width / 2;
        const screenY = render.options.height * 0.28 - rise;

        ctx.save();
        ctx.textAlign = "center";
        ctx.globalAlpha = alpha;
        ctx.fillStyle = hero.accent;
        ctx.beginPath();
        ctx.roundRect(screenX - 140, screenY - 28, 280, 56, 18);
        ctx.fill();
        ctx.strokeStyle = hero.color;
        ctx.globalAlpha = alpha * 0.4;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.font = "900 30px Inter, sans-serif";
        ctx.fillStyle = hero.color;
        ctx.fillText(hero.text, screenX, screenY + 10);
        ctx.restore();
      }
    });

    Events.on(engine, "collisionStart", function(event) {
      if (gameOver || !isLaunched || isPaused || perkPaused) return;

      const pairs = event.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;

        if (bodyA.label === "cube" || bodyB.label === "cube") {
          const otherBody = bodyA.label === "cube" ? bodyB : bodyA;

          if (otherBody.label.startsWith("stair_")) {
            const effect = otherBody.label.split("_")[1];
            const hitX = otherBody.position.x;
            const hitY = otherBody.position.y;

            const now = performance.now();
            if (recentStairContact.id === otherBody.id && now - recentStairContact.time < 220) {
              continue;
            }
            recentStairContact = { id: otherBody.id, time: now };

            checkAirBonus();

            if (!touchedStairs.has(otherBody.id)) {
              speedTrackingActive = true;
              touchedStairs.add(otherBody.id);
              const stepIndex = otherBody.plugin?.index ?? 0;
              if (runStats.lastStepIndex != null) {
                runStats.maxStepSkip = Math.max(runStats.maxStepSkip, Math.max(0, stepIndex - runStats.lastStepIndex - 1));
              }
              runStats.lastStepIndex = stepIndex;
              currentSteps += 1;
              runStats.steps = currentSteps;
              addComboHit(1, effect !== "normal", hitX, hitY);
              maybeOpenPerkChoice();
            }

            otherBody.plugin.flash = 1;
            spawnBurst(hitX, hitY, getEffectColor(), 10, 3.5);
            shake(Math.min(8, 1.5 + Math.abs(cube.velocity.y) * 0.18));

            if (effect !== "normal") hitSpecial(otherBody, effect);
            else setStatus("In Motion", "live");

            updateHud();
          }
        }
      }
    });

    Events.on(engine, "afterUpdate", function() {
      if (gameOver || hasWon || !isLaunched || isPaused || perkPaused) return;

      if (Math.abs(cube.velocity.x) < 0.1 && Math.abs(cube.velocity.y) < 0.1) stationaryFrames++;
      else stationaryFrames = 0;

      const lastStair = stairsArr.length ? stairsArr[stairsArr.length - 1] : null;
      const deathY = lastStair ? lastStair.position.y + Math.max(500, height * 0.7) : cube.position.y + 9999;
      if (stationaryFrames > 120 || cube.position.y > deathY) {
        setStatus("Run Failed", "danger");
        triggerGameOver();
      }
    });

    Runner.run(runner, engine);
    Render.run(render);
    applyDeviceProfile();
    normalizeUiCopy();
    setCanvasInput(false);
    updateRecordDisplays();
    updateHud();
    updatePerkActionButtons();
    showMainMenu();
    startCloudLoop();

    function handleResize() {
      const viewport = getViewportSize();
      width = viewport.width;
      height = viewport.height;
      deviceProfile = detectDeviceProfile();
      applyDeviceProfile();
      const pixelRatio = getRenderPixelRatio();
      render.canvas.width = width * pixelRatio;
      render.canvas.height = height * pixelRatio;
      render.canvas.style.width = width + 'px';
      render.canvas.style.height = height + 'px';
      render.options.width = width;
      render.options.height = height;
      render.options.pixelRatio = pixelRatio;
      clearClouds();
      scheduleNextCloudSpawn(performance.now(), true);
      updateGameBackgroundPan();
      if (cube) {
        focusCameraOnCube();
      }
      updateLegendVisibility();
    }

    window.addEventListener("resize", handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    }
  

    Object.assign(window, {
      switchShopTab,
      openChallenges,
      closeChallenges,
      openSettings,
      closeSettings,
      resetHighStats,
      openShop,
      closeShop,
      claimChallenge,
      buyCube,
      equipCube,
      buyStair,
      equipStair,
      buyTrail,
      equipTrail,
      buyEffect,
      equipEffect,
      buyUpgrade,
      choosePerk,
      usePerkAction,
      startGame,
      showMainMenu,
      togglePause
    });


