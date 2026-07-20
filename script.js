/* ============================================================
   LII — A LIVING GARDEN
   Vanilla JS / Canvas2D procedural garden.
   No libraries, no external assets. Everything is generated.
   ============================================================ */

(() => {
  'use strict';

  // ---------------------------------------------------------
  // SETUP
  // ---------------------------------------------------------
  const canvas = document.getElementById('garden');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loader = document.getElementById('loader');

  let DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0; // CSS pixel dimensions

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildScene();
  }

  // ---------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------
  const TAU = Math.PI * 2;
  const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
  const dist2 = (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2;

  // simple layered-sine noise, cheap substitute for perlin noise
  function noise1(t, seed = 0) {
    return (
      Math.sin(t * 0.9 + seed) * 0.5 +
      Math.sin(t * 2.13 + seed * 1.7) * 0.3 +
      Math.sin(t * 4.7 + seed * 3.1) * 0.2
    );
  }

  // ---------------------------------------------------------
  // GLOBAL TIME / WIND / CAMERA / MOUSE
  // ---------------------------------------------------------
  let clock = 0; // ms since start
  let lastT = performance.now();

  const wind = {
    angle: 0.15,
    strength: 0.55,
    targetStrength: 0.55,
    seed: rand(0, 1000),
  };

  const mouse = {
    x: 0, y: 0,
    nx: 0, ny: 0, // normalized -1..1
    active: false,
    vx: 0, vy: 0,
    lastX: 0, lastY: 0,
  };

  const camera = {
    x: 0, y: 0, zoom: 1,
  };

  window.addEventListener('mousemove', (e) => {
    mouse.lastX = mouse.x; mouse.lastY = mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = (e.clientX / W) * 2 - 1;
    mouse.ny = (e.clientY / H) * 2 - 1;
    mouse.vx = mouse.x - mouse.lastX;
    mouse.vy = mouse.y - mouse.lastY;
    mouse.active = true;
  });
  window.addEventListener('mouseleave', () => { mouse.active = false; });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!t) return;
    mouse.lastX = mouse.x; mouse.lastY = mouse.y;
    mouse.x = t.clientX; mouse.y = t.clientY;
    mouse.nx = (t.clientX / W) * 2 - 1;
    mouse.ny = (t.clientY / H) * 2 - 1;
    mouse.active = true;
  }, { passive: true });

  canvas.addEventListener('click', (e) => {
    plantFlower(e.clientX, e.clientY);
  });
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t) plantFlower(t.clientX, t.clientY);
  }, { passive: true });

  window.addEventListener('resize', resize);

  // ---------------------------------------------------------
  // SCENE DATA CONTAINERS
  // ---------------------------------------------------------
  let sky, clouds, hills, treeClusters, grassBlades;
  let flowersFar, flowersNear;
  let skyBlooms = [];
  let butterflies, bees, dragonflies, ladybugs;
  let petalsFloating, seedsFloating, birds;
  let nameTargets = [];
  let nameStrokes = [];
  let grassTop = 0; // y where grass field begins (css px)

  // ---------------------------------------------------------
  // COLOR PALETTES
  // ---------------------------------------------------------
  const GREENS = ['#4a6b3a', '#3f5f34', '#5c7a45', '#38512c', '#6b8752', '#2f4527'];
  const FLOWER_COLORS = {
    daisy:    [{ h: 40, s: 15, l: 96 }, { h: 340, s: 25, l: 92 }],
    tulip:    [{ h: 350, s: 55, l: 68 }, { h: 15, s: 60, l: 65 }, { h: 45, s: 55, l: 72 }],
    lavender: [{ h: 262, s: 35, l: 72 }, { h: 268, s: 30, l: 65 }],
    bluebell: [{ h: 208, s: 45, l: 85 }, { h: 220, s: 35, l: 80 }],
    poppy:    [{ h: 4, s: 68, l: 55 }, { h: 8, s: 60, l: 50 }],
    wild:     [{ h: 300, s: 25, l: 85 }, { h: 50, s: 55, l: 78 }, { h: 0, s: 0, l: 97 }, { h: 210, s: 30, l: 90 }],
  };

  // ---------------------------------------------------------
  // BUILD SCENE (called on resize)
  // ---------------------------------------------------------
  function buildScene() {
    grassTop = H * 0.52;

    buildSky();
    buildClouds();
    buildHills();
    buildTreeClusters();
    buildGrassBlades();
    buildFlowerField();
    buildCreatures();
    nameTargets = buildNameTargets();
  }

  function buildSky() {
    sky = {
      // dawn gradient stops
      top: '#a9c8dd',
      mid: '#cfe0d3',
      horizon: '#f3e6c9',
      sunX: W * 0.78,
      sunY: H * 0.22,
    };
  }

  function buildClouds() {
    clouds = [];
    const layers = [
      { y: 0.10, speed: 1.6, scale: 1.3, alpha: 0.55, n: 3 },
      { y: 0.17, speed: 2.6, scale: 1.0, alpha: 0.7, n: 4 },
      { y: 0.24, speed: 3.8, scale: 0.7, alpha: 0.85, n: 3 },
    ];
    layers.forEach((layer) => {
      for (let i = 0; i < layer.n; i++) {
        clouds.push({
          baseX: rand(-0.2, 1.2) * W,
          y: H * layer.y + rand(-20, 20),
          speed: layer.speed,
          scale: layer.scale * rand(0.8, 1.3),
          alpha: layer.alpha,
          seed: rand(0, 1000),
          puffs: buildCloudPuffs(),
        });
      }
    });
  }

  function buildCloudPuffs() {
    const n = randInt(4, 7);
    const puffs = [];
    let x = 0;
    for (let i = 0; i < n; i++) {
      puffs.push({
        dx: x,
        dy: -Math.sin((i / n) * Math.PI) * rand(14, 26),
        r: rand(22, 46),
      });
      x += rand(24, 40);
    }
    return puffs;
  }

  function buildHills() {
    hills = [];
    const layerDefs = [
      { yBase: 0.50, amp: 0.05, color: '#b9cbab', parallax: 0.015 },
      { yBase: 0.55, amp: 0.045, color: '#a3bd8f', parallax: 0.03 },
      { yBase: 0.60, amp: 0.04, color: '#87a86f', parallax: 0.05 },
    ];
    layerDefs.forEach((def) => {
      const pts = [];
      const segs = 8;
      for (let i = 0; i <= segs; i++) {
        pts.push({
          x: (i / segs) * W,
          y: H * def.yBase + Math.sin(i * 1.7 + def.yBase * 20) * H * def.amp + rand(-8, 8),
        });
      }
      hills.push({ pts, color: def.color, parallax: def.parallax, yBase: def.yBase });
    });
  }

  function buildTreeClusters() {
    treeClusters = [];
    const n = Math.max(5, Math.floor(W / 220));
    for (let i = 0; i < n; i++) {
      const y = H * rand(0.53, 0.58);
      treeClusters.push({
        x: rand(-0.05, 1.05) * W,
        y,
        scale: rand(0.6, 1.3),
        color: pick(['#4a6b3a', '#3f5f34', '#5c7a45', '#38512c']),
        seed: rand(0, 1000),
        parallax: 0.07,
      });
    }
  }

  function buildGrassBlades() {
    grassBlades = [];
    const bands = 5;
    for (let b = 0; b < bands; b++) {
      const t = b / (bands - 1);
      const y = lerp(grassTop, H * 1.02, t);
      const density = Math.floor(lerp(40, 130, t) * (W / 1200));
      for (let i = 0; i < density; i++) {
        grassBlades.push({
          x: rand(-0.05, 1.05) * W,
          y: y + rand(-10, 10),
          h: lerp(10, 34, t) * rand(0.7, 1.3),
          w: lerp(1.2, 2.6, t),
          tilt: rand(-0.15, 0.15),
          phase: rand(0, TAU),
          speed: rand(0.6, 1.1),
          color: pick(GREENS),
          depth: t,
        });
      }
    }
    grassBlades.sort((a, b) => a.y - b.y);
  }

  // ---------------------------------------------------------
  // FLOWER FIELD
  // ---------------------------------------------------------
  function buildFlowerField() {
    flowersFar = [];
    flowersNear = [];

    // far flowers: small, dense, simplified
    const farCount = Math.floor(W / 13);
    for (let i = 0; i < farCount; i++) {
      const t = rand(0, 1);
      const y = lerp(grassTop + 10, grassTop + H * 0.16, t);
      flowersFar.push(new Flower(rand(-0.05, 1.05) * W, y, { simplified: true, scale: rand(0.35, 0.6) }));
    }

    // near flowers: larger, more detailed
    const nearCount = Math.floor(W / 14);
    for (let i = 0; i < nearCount; i++) {
      const t = rand(0, 1);
      const y = lerp(grassTop + H * 0.14, H * 1.0, Math.pow(t, 0.7));
      flowersNear.push(new Flower(rand(-0.05, 1.05) * W, y, { simplified: false, scale: rand(0.7, 1.35) }));
    }

  }

  function plantFlower(px, py) {
    // convert screen coords to world coords roughly (accounting for camera offset)
    const wx = px - camera.x;
    const wy = py - camera.y;
    if (wy < grassTop - 10) return; // only plant within the garden field
    const f = new Flower(wx, wy, { simplified: false, scale: rand(0.9, 1.3), growth: 0 });
    f.userPlanted = true;
    flowersNear.push(f);
  }

  // ---------------------------------------------------------
  // FLOWER CLASS
  // ---------------------------------------------------------
  const SPECIES = ['daisy', 'tulip', 'lavender', 'bluebell', 'poppy', 'wild'];

  class Flower {
    constructor(x, y, opts = {}) {
      this.baseX = x;
      this.baseY = y;
      this.species = pick(SPECIES);
      this.scale = opts.scale ?? 1;
      this.simplified = !!opts.simplified;
      this.growth = opts.growth ?? 1; // 0..1
      this.growSpeed = rand(0.28, 0.4); // per second growth progress
      this.height = rand(46, 92) * this.scale;
      this.stemW = rand(1.6, 3.0) * this.scale;
      this.curveDir = rand(-1, 1);
      this.curveAmt = rand(0.35, 0.85);
      this.orient = rand(0, TAU);
      this.swayPhase = rand(0, TAU);
      this.swaySpeed = rand(0.5, 0.95);
      this.leafCount = randInt(1, 3);
      this.leafSeed = rand(0, 1000);
      this.hue = pick(FLOWER_COLORS[this.species]);
      this.hueJitter = rand(-6, 6);
      this.petalCount = this.simplified
        ? randInt(5, 7)
        : this.species === 'daisy' ? randInt(11, 16)
        : this.species === 'wild' ? randInt(5, 6)
        : this.species === 'poppy' ? 4
        : randInt(5, 7);
      this.petalLen = rand(0.85, 1.15);
      this.openness = rand(0.85, 1);
      this.zJitter = rand(-4, 4);
    }

    update(dt) {
      if (this.growth < 1) this.growth = clamp(this.growth + dt * this.growSpeed, 0, 1);
    }

    // world-space anchor point
    anchor() {
      return { x: this.baseX, y: this.baseY };
    }

    draw(ctx, wctx) {
      const g = this.growth;
      if (g <= 0.001) return;
      const a = this.anchor();
      const windLean = Math.sin(clock * 0.00035 * this.swaySpeed + this.swayPhase) * 0.12
        + noise1(clock * 0.0006 + this.leafSeed, this.leafSeed) * wctx.strength * 0.35;
      let bend = (wctx.angle + windLean) * wctx.strength * this.curveAmt * this.curveDir;

      if (mouse.active) {
        const mdx = a.x + camera.x - mouse.x;
        const mdy = (a.y - this.height) + camera.y - mouse.y;
        const d = Math.sqrt(mdx * mdx + mdy * mdy);
        const radius = 150;
        if (d < radius) {
          const f = (1 - d / radius);
          bend += (mdx / (d || 1)) * f * 0.9;
        }
      }

      const stemT = g < 0.12 ? 0 : clamp((g - 0.12) / 0.33, 0, 1);
      const leafT = clamp((g - 0.18) / 0.3, 0, 1);
      const budT = clamp((g - 0.45) / 0.23, 0, 1);
      const bloomT = clamp((g - 0.68) / 0.32, 0, 1);

      const h = this.height * smoothstep(stemT);
      if (h <= 0.5) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.fillStyle = '#5c7a45';
        ctx.beginPath();
        ctx.ellipse(0, -1, 2.2 * this.scale, 1.4 * this.scale, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        return;
      }

      const tipX = a.x + Math.sin(bend) * h * 0.55;
      const tipY = a.y - h;
      const midX = a.x + Math.sin(bend) * h * 0.22;
      const midY = a.y - h * 0.55;

      ctx.save();
      ctx.translate(a.x, a.y);

      ctx.strokeStyle = this.simplified ? '#5c7a45' : '#4a6b3a';
      ctx.lineWidth = this.stemW;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(midX - a.x, midY - a.y, tipX - a.x, tipY - a.y);
      ctx.stroke();

      if (leafT > 0 && !this.simplified) {
        for (let i = 0; i < this.leafCount; i++) {
          const lt = 0.3 + i * (0.5 / this.leafCount);
          const lx = lerp(0, tipX - a.x, lt);
          const ly = lerp(0, tipY - a.y, lt);
          const side = i % 2 === 0 ? 1 : -1;
          drawLeaf(ctx, lx, ly, this.height * 0.22 * this.scale * smoothstep(leafT), side, bend);
        }
      }

      if (budT > 0) {
        ctx.translate(tipX - a.x, tipY - a.y);
        ctx.rotate(bend * 0.4 + this.orient * 0.05);
        drawFlowerHead(ctx, this, budT, bloomT);
      }

      ctx.restore();
    }
  }

  function drawLeaf(ctx, x, y, len, side, bend) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bend * 0.5);
    ctx.fillStyle = '#547a3d';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * len * 0.9, -len * 0.15, side * len * 1.3, -len * 0.02);
    ctx.quadraticCurveTo(side * len * 0.5, len * 0.25, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawPetal(ctx, len, width, curl) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      -width * 0.5, -len * 0.35 + curl,
      -width * 0.4, -len * 0.85 + curl * 0.5,
      0, -len
    );
    ctx.bezierCurveTo(
      width * 0.4, -len * 0.85 + curl * 0.5,
      width * 0.5, -len * 0.35 + curl,
      0, 0
    );
    ctx.fill();
  }

  function flowerColor(f, jitter = 0) {
    const c = f.hue;
    const h = c.h + f.hueJitter + jitter;
    return `hsl(${h}, ${c.s}%, ${c.l}%)`;
  }

  function drawFlowerHead(ctx, f, budT, bloomT) {
    const budR = lerp(1.5, 5, budT) * f.scale;

    if (bloomT <= 0.02) {
      ctx.fillStyle = f.species === 'poppy' ? '#7a8c4a' : '#6d8c52';
      ctx.beginPath();
      ctx.ellipse(0, -budR * 0.6, budR * 0.55, budR, 0, 0, TAU);
      ctx.fill();
      return;
    }

    const open = smoothstep(bloomT) * f.openness;
    ctx.save();
    ctx.scale(open * 0.6 + 0.4, open * 0.6 + 0.4);

    switch (f.species) {
      case 'lavender': drawLavender(ctx, f, open); break;
      case 'tulip': drawTulip(ctx, f, open); break;
      case 'bluebell': drawBluebell(ctx, f, open); break;
      case 'poppy': drawPoppy(ctx, f, open); break;
      case 'daisy': drawDaisy(ctx, f, open); break;
      default: drawWildflower(ctx, f, open); break;
    }
    ctx.restore();
  }

  function drawDaisy(ctx, f, open) {
    const s = f.scale;
    const n = f.petalCount;
    const len = 9 * s * f.petalLen * open;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + f.orient;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = flowerColor(f, rand(-4, 4));
      drawPetal(ctx, len, 2.6 * s, rand(-1, 1));
      ctx.restore();
    }
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 3.6 * s);
    grad.addColorStop(0, '#fff3b0');
    grad.addColorStop(1, '#e8b23a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4 * s * open, 3.1 * s * open, 0, 0, TAU);
    ctx.fill();
  }

  function drawWildflower(ctx, f, open) {
    const s = f.scale;
    const n = f.petalCount;
    const len = 7 * s * f.petalLen * open;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + f.orient;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = flowerColor(f, rand(-6, 6));
      drawPetal(ctx, len, 3.4 * s, rand(-1.5, 1.5));
      ctx.restore();
    }
    ctx.fillStyle = '#e8c25a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2 * s * open, 1.9 * s * open, 0, 0, TAU);
    ctx.fill();
  }

  function drawPoppy(ctx, f, open) {
    const s = f.scale * 1.3;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + f.orient + 0.4;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = flowerColor(f, rand(-5, 5));
      ctx.globalAlpha = 0.95;
      drawPetal(ctx, 12 * s * open, 9 * s, rand(-3, 3));
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2b2313';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.6 * s * open, 2.2 * s * open, 0, 0, TAU);
    ctx.fill();
  }

  function drawTulip(ctx, f, open) {
    const s = f.scale;
    const len = 13 * s * open;
    const w = 5.5 * s;
    ctx.fillStyle = flowerColor(f, 0);
    for (let i = -1; i <= 1; i++) {
      ctx.save();
      ctx.rotate(i * 0.42);
      ctx.beginPath();
      ctx.moveTo(-w * 0.4, 0);
      ctx.bezierCurveTo(-w * 0.7, -len * 0.5, -w * 0.35, -len * 0.95, 0, -len);
      ctx.bezierCurveTo(w * 0.35, -len * 0.95, w * 0.7, -len * 0.5, w * 0.4, 0);
      ctx.closePath();
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawBluebell(ctx, f, open) {
    const s = f.scale;
    const bells = 3;
    for (let i = 0; i < bells; i++) {
      const t = i / (bells - 1 || 1);
      const bx = lerp(-6, 6, t) * s;
      const by = -Math.abs(lerp(-1, 1, t)) * 3 * s;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(lerp(-0.5, 0.5, t));
      ctx.fillStyle = flowerColor(f, rand(-4, 4));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-4 * s, 3 * s, -5 * s * open, 8 * s * open, 0, 9 * s * open);
      ctx.bezierCurveTo(5 * s * open, 8 * s * open, 4 * s, 3 * s, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawLavender(ctx, f, open) {
    const s = f.scale;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const y = -t * 14 * s * open;
      const spread = (1 - t) * 3 * s + 1;
      ctx.save();
      ctx.translate(0, y);
      ctx.fillStyle = flowerColor(f, rand(-8, 8));
      ctx.beginPath();
      ctx.ellipse(-spread * 0.5, 0, 1.6 * s, 1.1 * s, 0.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(spread * 0.5, 0, 1.6 * s, 1.1 * s, -0.3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------------------------------------------------------
  // CREATURES
  // ---------------------------------------------------------
  class Butterfly {
    constructor() {
      this.reset();
      this.x = rand(0, W);
      this.y = rand(H * 0.3, H * 0.75);
    }
    reset() {
      this.x = rand(-50, W + 50);
      this.y = rand(H * 0.35, H * 0.8);
      this.targetX = rand(0, W);
      this.targetY = rand(H * 0.3, H * 0.8);
      this.speed = rand(18, 34);
      this.flap = rand(0, TAU);
      this.flapSpeed = rand(9, 13);
      this.size = rand(6, 10);
      this.hue = pick([28, 340, 45, 205, 0]);
      this.wobble = rand(0, TAU);
      this.fleeing = false;
    }
    update(dt) {
      this.flap += dt * this.flapSpeed;
      this.wobble += dt * 1.4;
      if (this.fleeing) {
        this.targetX = this.x < W / 2 ? -100 : W + 100;
        this.targetY = -80;
      } else if (dist2(this.x, this.y, this.targetX, this.targetY) < 400) {
        this.targetX = rand(0, W);
        this.targetY = rand(H * 0.28, H * 0.8);
      }
      // gentle mouse avoidance
      let ax = this.targetX - this.x, ay = this.targetY - this.y;
      const dm = Math.sqrt(ax * ax + ay * ay) || 1;
      ax /= dm; ay /= dm;
      if (mouse.active) {
        const mdx = this.x - mouse.x, mdy = this.y - mouse.y;
        const d = Math.sqrt(mdx * mdx + mdy * mdy);
        if (d < 90) { ax += (mdx / d) * 2; ay += (mdy / d) * 2; }
      }
      const sp = this.fleeing ? this.speed * 3.2 : this.speed;
      this.x += ax * sp * dt + Math.sin(this.wobble) * 6 * dt;
      this.y += ay * sp * dt + Math.cos(this.wobble * 1.3) * 4 * dt;
      if (this.fleeing && (this.x < -120 || this.x > W + 120)) this.reset();
    }
    draw(ctx) {
      const flapAmt = Math.sin(this.flap) * 0.9;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.sin(this.wobble) * 0.15);
      ctx.fillStyle = `hsla(${this.hue}, 70%, 68%, 0.92)`;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.scale(s, 1);
        ctx.beginPath();
        ctx.ellipse(this.size * 0.5, 0, this.size * (0.55 + flapAmt * 0.3), this.size * 0.75, 0.5, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(40,30,20,0.8)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 1, this.size * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  class Bee {
    constructor() { this.reset(); }
    reset() {
      this.x = rand(0, W); this.y = rand(H * 0.5, H * 0.85);
      this.angle = rand(0, TAU);
      this.speed = rand(50, 90);
      this.turnSeed = rand(0, 1000);
      this.size = rand(3, 4.5);
    }
    update(dt) {
      this.angle += noise1(clock * 0.001, this.turnSeed) * dt * 2;
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt * 0.6;
      if (this.x < -20 || this.x > W + 20 || this.y < H * 0.4 || this.y > H) this.reset();
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = '#3a2c14';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size, this.size * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-this.size * 0.2, -this.size * 0.6, this.size * 0.9, this.size * 0.4, 0.3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  class Dragonfly {
    constructor() { this.reset(); }
    reset() {
      this.x = rand(0, W); this.y = rand(H * 0.35, H * 0.6);
      this.angle = rand(0, TAU);
      this.speed = rand(70, 130);
      this.turnSeed = rand(0, 1000);
    }
    update(dt) {
      this.angle += noise1(clock * 0.0012, this.turnSeed) * dt * 1.6;
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt * 0.4;
      if (this.x < -30 || this.x > W + 30 || this.y < H * 0.25 || this.y > H * 0.75) this.reset();
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.strokeStyle = 'rgba(120,180,150,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(4, -3, 6, 2, 0.2, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(4, 3, 6, 2, -0.2, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#3f6b52';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 1, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  class Ladybug {
    constructor() { this.reset(); }
    reset() {
      this.x = rand(0, W); this.y = rand(H * 0.6, H * 0.95);
      this.angle = rand(0, TAU);
      this.speed = rand(8, 18);
      this.turnSeed = rand(0, 1000);
    }
    update(dt) {
      this.angle += noise1(clock * 0.0008, this.turnSeed) * dt * 1.2;
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt * 0.3;
      if (this.x < -10 || this.x > W + 10) this.reset();
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = '#c23b2e';
      ctx.beginPath(); ctx.ellipse(0, 0, 3, 2.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#241a14';
      ctx.beginPath(); ctx.ellipse(-1.6, 0, 1, 2.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1c1410';
      [[-1, -0.6], [1, -0.6], [0.4, 0.7]].forEach(([dx, dy]) => {
        ctx.beginPath(); ctx.ellipse(dx, dy, 0.5, 0.5, 0, 0, TAU); ctx.fill();
      });
      ctx.restore();
    }
  }

  class FloatingBit {
    constructor(kind) {
      this.kind = kind; // 'petal' | 'seed'
      this.reset(true);
    }
    reset(initial = false) {
      this.x = rand(-0.1, 1.1) * W;
      this.y = initial ? rand(0, H) : rand(-20, -5);
      this.vy = rand(10, 22);
      this.swaySeed = rand(0, 1000);
      this.rot = rand(0, TAU);
      this.rotSpeed = rand(-1.5, 1.5);
      this.size = this.kind === 'petal' ? rand(3, 6) : rand(1.2, 2.2);
      this.hue = pick([340, 30, 0, 50, 280]);
      this.life = 0;
    }
    update(dt) {
      this.life += dt;
      this.y += this.vy * dt + wind.strength * 8 * dt;
      this.x += Math.sin(clock * 0.0007 + this.swaySeed) * 16 * dt + wind.strength * 14 * dt;
      this.rot += this.rotSpeed * dt;
      if (this.y > H + 20 || this.x > W + 40 || this.x < -40) this.reset();
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      if (this.kind === 'petal') {
        ctx.fillStyle = `hsla(${this.hue}, 60%, 82%, 0.85)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.55, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 3, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  class Bird {
    constructor() { this.reset(); }
    reset() {
      this.x = rand(-0.2, 1.2) * W;
      this.y = rand(H * 0.06, H * 0.2);
      this.speed = rand(10, 20);
      this.dir = pick([-1, 1]);
      this.flap = rand(0, TAU);
    }
    update(dt) {
      this.x += this.dir * this.speed * dt;
      this.flap += dt * 6;
      if (this.x < -40 || this.x > W + 40) this.reset();
    }
    draw(ctx) {
      const w = 4 + Math.sin(this.flap) * 2;
      ctx.strokeStyle = 'rgba(70,70,80,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x - w, this.y + 2);
      ctx.quadraticCurveTo(this.x, this.y - 2, this.x + w, this.y + 2);
      ctx.stroke();
    }
  }

  function buildCreatures() {
    butterflies = Array.from({ length: 7 }, () => new Butterfly());
    bees = Array.from({ length: 5 }, () => new Bee());
    dragonflies = Array.from({ length: 3 }, () => new Dragonfly());
    ladybugs = Array.from({ length: 4 }, () => new Ladybug());
    petalsFloating = Array.from({ length: 22 }, () => new FloatingBit('petal'));
    seedsFloating = Array.from({ length: 16 }, () => new FloatingBit('seed'));
    birds = Array.from({ length: 4 }, () => new Bird());
  }

  // ---------------------------------------------------------
  // "Lii" NAME TARGETS — built from geometric strokes, never text
  // ---------------------------------------------------------
  function segPoints(x1, y1, x2, y2, spacing) {
    const pts = [];
    const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const n = Math.max(1, Math.floor(d / spacing));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({ x: lerp(x1, x2, t), y: lerp(y1, y2, t) });
    }
    return pts;
  }

  function circlePoints(cx, cy, r, count) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    // a couple interior points for density
    pts.push({ x: cx, y: cy });
    return pts;
  }

  function buildNameTargets() {
    const scale = Math.min(W, H) * 0.32;
    const letterH = scale;
    const cx = W * 0.46;
    const cy = H * 0.26;
    const spacing = Math.max(7, scale * 0.026);

    // letter cell positions
    const lX = cx - scale * 0.95;
    const i1X = cx + scale * 0.05;
    const i2X = cx + scale * 0.45;
    const topY = cy - letterH * 0.5;
    const botY = cy + letterH * 0.5;

    let pts = [];
    nameStrokes = [];

    // L: vertical stroke + base
    const lVert = segPoints(lX, topY, lX, botY, spacing);
    const lBase = segPoints(lX, botY, lX + scale * 0.46, botY, spacing);
    nameStrokes.push(lVert, lBase);
    pts = pts.concat(lVert, lBase);

    // i (1): stem + dot
    const i1StemTop = cy - letterH * 0.10;
    const i1Stem = segPoints(i1X, i1StemTop, i1X, botY, spacing);
    nameStrokes.push(i1Stem);
    pts = pts.concat(i1Stem);
    pts = pts.concat(circlePoints(i1X, cy - letterH * 0.34, scale * 0.06, 10));

    // i (2): stem + dot
    const i2StemTop = cy - letterH * 0.10;
    const i2Stem = segPoints(i2X, i2StemTop, i2X, botY, spacing);
    nameStrokes.push(i2Stem);
    pts = pts.concat(i2Stem);
    pts = pts.concat(circlePoints(i2X, cy - letterH * 0.34, scale * 0.06, 10));

    return pts;
  }

  // ---------------------------------------------------------
  // SKY BLOOMS — small blossoms that rise from the garden into
  // the sky and arrange themselves into the shape of the name.
  // ---------------------------------------------------------
  class SkyBloom {
    constructor(target, index) {
      this.target = target;
      // origin: somewhere down in the flower field, biased toward
      // the horizontal position of its target so the rise feels
      // like it is drawn up out of the garden below it.
      this.originX = clamp(target.x + rand(-140, 140), 20, W - 20);
      this.originY = H * rand(0.72, 1.02);
      this.x = this.originX;
      this.y = this.originY;
      this.delay = rand(0, 0.4) + Math.abs(index % 17) * 0.012;
      this.rotation = rand(0, TAU);
      this.rotSpeed = rand(-0.6, 0.6);
      this.size = rand(9, 14);
      this.hue = pick([
        { h: 46, s: 65, l: 88 },
        { h: 38, s: 55, l: 92 },
        { h: 350, s: 45, l: 88 },
        { h: 40, s: 20, l: 97 },
      ]);
      this.wobbleSeed = rand(0, 1000);
      this.arcHeight = rand(60, 160);
      this.scatterAngle = rand(0, TAU);
      this.scatterDist = 0;
      this.alpha = 0;
    }

    updateRise(tRaw) {
      const t = clamp((tRaw - this.delay) / (1 - this.delay), 0, 1);
      const e = easeInOutCubic(t);
      const arc = Math.sin(t * Math.PI) * this.arcHeight;
      this.x = lerp(this.originX, this.target.x, e) + Math.sin(clock * 0.0012 + this.wobbleSeed) * 4 * (1 - t);
      this.y = lerp(this.originY, this.target.y, e) - arc;
      this.alpha = smoothstep(clamp(t / 0.25, 0, 1));
      this.rotation += this.rotSpeed * 0.016;
    }

    updateHold(dt) {
      this.x = this.target.x + Math.sin(clock * 0.0009 + this.wobbleSeed) * 2.2;
      this.y = this.target.y + Math.cos(clock * 0.0011 + this.wobbleSeed) * 2.2;
      this.rotation += this.rotSpeed * 0.15 * dt;
      this.alpha = 0.92 + Math.sin(clock * 0.003 + this.wobbleSeed) * 0.08;
    }

    updateScatter(tRaw) {
      const t = easeOutQuad(clamp(tRaw, 0, 1));
      this.scatterDist = t * rand(120, 260);
      this.x = this.target.x + Math.cos(this.scatterAngle) * this.scatterDist * t + wind.strength * 40 * t;
      this.y = this.target.y + Math.sin(this.scatterAngle) * this.scatterDist * t * 0.6 + t * 90;
      this.rotation += this.rotSpeed * 0.3 * 0.016;
      this.alpha = 1 - t;
    }

    draw(ctx) {
      if (this.alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = clamp(this.alpha, 0, 1);
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      const s = this.size;
      // tight, bright glow so the blossom reads clearly against the sky
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
      glow.addColorStop(0, `hsla(${this.hue.h}, ${this.hue.s}%, ${Math.min(this.hue.l + 8, 99)}%, 0.85)`);
      glow.addColorStop(0.55, `hsla(${this.hue.h}, ${this.hue.s}%, ${this.hue.l}%, 0.35)`);
      glow.addColorStop(1, `hsla(${this.hue.h}, ${this.hue.s}%, ${this.hue.l}%, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.5, 0, TAU);
      ctx.fill();
      // tiny blossom: a rosette of petals
      const petals = 5;
      for (let i = 0; i < petals; i++) {
        ctx.save();
        ctx.rotate((i / petals) * TAU);
        ctx.fillStyle = `hsla(${this.hue.h}, ${this.hue.s}%, ${Math.max(this.hue.l - 6, 60)}%, 1)`;
        drawPetal(ctx, s, s * 0.46, rand(-0.6, 0.6));
        ctx.restore();
      }
      ctx.fillStyle = 'hsla(48, 80%, 92%, 1)';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.36, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function spawnSkyBlooms() {
    skyBlooms = nameTargets.map((t, i) => new SkyBloom(t, i));
  }

  // ---------------------------------------------------------
  // SPECIAL MOMENT STATE MACHINE
  // ---------------------------------------------------------
  const special = {
    state: 'idle', // idle -> gathering -> holding -> releasing -> idle
    timer: 0,
    triggered: false,
    GATHER: 4200,
    HOLD: 3400,
    RELEASE: 4600,
  };

  function updateSpecial(dt) {
    if (!special.triggered && clock > 15000) {
      special.triggered = true;
      special.state = 'gathering';
      special.timer = 0;
      wind.targetStrength = 0.06;
      butterflies.forEach((b) => { b.fleeing = true; });
      spawnSkyBlooms();
    }

    if (special.state === 'idle') return;
    special.timer += dt * 1000;

    if (special.state === 'gathering') {
      const t = clamp(special.timer / special.GATHER, 0, 1);
      skyBlooms.forEach((b) => b.updateRise(t));
      if (special.timer >= special.GATHER) { special.state = 'holding'; special.timer = 0; }
    } else if (special.state === 'holding') {
      skyBlooms.forEach((b) => b.updateHold(dt));
      if (special.timer >= special.HOLD) { special.state = 'releasing'; special.timer = 0; }
    } else if (special.state === 'releasing') {
      const t = clamp(special.timer / special.RELEASE, 0, 1);
      skyBlooms.forEach((b) => b.updateScatter(t));
      if (special.timer >= special.RELEASE) {
        special.state = 'idle';
        skyBlooms = [];
        wind.targetStrength = rand(0.35, 0.65);
        butterflies.forEach((b) => { b.fleeing = false; });
      }
    }
  }

  // ---------------------------------------------------------
  // BACKGROUND DRAWING
  // ---------------------------------------------------------
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, grassTop + 40);
    const holdFactor = special.state === 'holding' || special.state === 'gathering' ? 0.12 : 0;
    g.addColorStop(0, sky.top);
    g.addColorStop(0.55, sky.mid);
    g.addColorStop(1, lerp255(sky.horizon, '#f7d9a8', holdFactor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, grassTop + 40);

    // sun glow
    const sunGlow = ctx.createRadialGradient(sky.sunX, sky.sunY, 0, sky.sunX, sky.sunY, W * 0.5);
    sunGlow.addColorStop(0, 'rgba(255,250,225,0.55)');
    sunGlow.addColorStop(0.3, 'rgba(255,240,200,0.18)');
    sunGlow.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, W, grassTop + 40);

    // soft god-rays
    ctx.save();
    ctx.globalAlpha = 0.06 + Math.sin(clock * 0.0002) * 0.015;
    ctx.translate(sky.sunX, sky.sunY);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + clock * 0.00004;
      ctx.save();
      ctx.rotate(a);
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(255,250,220,0.9)');
      grd.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.lineTo(60, H);
      ctx.lineTo(-60, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function lerp255(hexA, hexB, t) {
    if (t <= 0) return hexA;
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    const r = Math.round(lerp(a.r, b.r, t));
    const gg = Math.round(lerp(a.g, b.g, t));
    const bl = Math.round(lerp(a.b, b.b, t));
    return `rgb(${r},${gg},${bl})`;
  }
  function hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }

  function drawClouds(dt) {
    ctx.save();
    clouds.forEach((c) => {
      c.baseX += c.speed * dt;
      if (c.baseX - 200 * c.scale > W * 1.2) c.baseX = -200 * c.scale;
      const x = c.baseX + camera.x * 0.2;
      const y = c.y + camera.y * 0.2;
      ctx.fillStyle = `rgba(255,255,255,${c.alpha})`;
      c.puffs.forEach((p) => {
        ctx.beginPath();
        ctx.ellipse(x + p.dx * c.scale, y + p.dy * c.scale, p.r * c.scale, p.r * 0.62 * c.scale, 0, 0, TAU);
        ctx.fill();
      });
    });
    ctx.restore();
  }

  function drawHills() {
    hills.forEach((layer) => {
      ctx.save();
      ctx.translate(camera.x * layer.parallax, camera.y * layer.parallax);
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, H + 10);
      layer.pts.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(W, H + 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  function drawTreeClusters() {
    treeClusters.forEach((t) => {
      ctx.save();
      const x = t.x + camera.x * t.parallax;
      const y = t.y + camera.y * t.parallax;
      ctx.translate(x, y);
      ctx.scale(t.scale, t.scale);
      const sway = Math.sin(clock * 0.0003 + t.seed) * wind.strength * 0.03;
      ctx.rotate(sway);
      ctx.fillStyle = t.color;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 14, Math.sin(a) * 8 - 14, 20, 16, 0, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(0, -16, 24, 20, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawGrass() {
    ctx.save();
    ctx.translate(camera.x * 0.12, camera.y * 0.12);
    grassBlades.forEach((b) => {
      const sway = (Math.sin(clock * 0.0009 * b.speed + b.phase) * 0.28
        + noise1(clock * 0.0004, b.phase) * wind.strength * 0.5) * (0.4 + b.depth);
      const bend = b.tilt + sway * wind.strength;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(
        b.x + Math.sin(bend) * b.h * 0.4, b.y - b.h * 0.6,
        b.x + Math.sin(bend) * b.h, b.y - b.h
      );
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawFieldBase() {
    const g = ctx.createLinearGradient(0, grassTop, 0, H);
    g.addColorStop(0, '#7a9a5e');
    g.addColorStop(0.4, '#6b8f4f');
    g.addColorStop(1, '#4f7238');
    ctx.fillStyle = g;
    ctx.fillRect(0, grassTop, W, H - grassTop);

    // subtle mist band at horizon
    const mist = ctx.createLinearGradient(0, grassTop - 30, 0, grassTop + 60);
    mist.addColorStop(0, 'rgba(255,250,235,0.35)');
    mist.addColorStop(1, 'rgba(255,250,235,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, grassTop - 30, W, 90);
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,24,10,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function getFormationAlpha() {
    if (special.state === 'holding') return 1;
    if (special.state === 'gathering') return smoothstep(clamp(special.timer / special.GATHER, 0, 1));
    if (special.state === 'releasing') return 1 - smoothstep(clamp(special.timer / special.RELEASE, 0, 1));
    return 0;
  }

  function drawFormationAura() {
    if (!nameTargets.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nameTargets.forEach((p) => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const r = Math.max(maxX - minX, maxY - minY) * 0.85;
    const alpha = 0.3 * getFormationAlpha();
    if (alpha <= 0.005) return;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,250,235,${alpha})`);
    g.addColorStop(0.6, `rgba(255,244,214,${alpha * 0.5})`);
    g.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
  }

  function drawFormationStrokes() {
    if (!nameStrokes.length) return;
    // the connecting glow only reveals once the rise is mostly complete,
    // so it reads as the blossoms "settling" into a continuous shape.
    const base = getFormationAlpha();
    const t = smoothstep(clamp((base - 0.55) / 0.45, 0, 1));
    if (t <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = t * 0.8;
    ctx.strokeStyle = 'rgba(255, 250, 235, 0.95)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.shadowColor = 'rgba(255, 244, 210, 0.9)';
    ctx.shadowBlur = 22;
    nameStrokes.forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    });
    ctx.restore();
  }

  // ---------------------------------------------------------
  // CAMERA — subtle breathing / drift
  // ---------------------------------------------------------
  function updateCamera(dt) {
    const parallaxStrength = 14;
    const targetX = mouse.active ? -mouse.nx * parallaxStrength : 0;
    const targetY = mouse.active ? -mouse.ny * parallaxStrength * 0.6 : 0;
    camera.x += (targetX - camera.x) * dt * 1.4;
    camera.y += (targetY - camera.y) * dt * 1.4;

    const breatheX = Math.sin(clock * 0.00018) * 5;
    const breatheY = Math.cos(clock * 0.00013) * 3;
    camera.x += breatheX * dt * 0.6;
    camera.y += breatheY * dt * 0.6;

    let targetZoom = 1 + Math.sin(clock * 0.00011) * 0.006;
    if (special.state === 'gathering' || special.state === 'holding') targetZoom += 0.012;
    camera.zoom += (targetZoom - camera.zoom) * dt * 0.8;
  }

  // ---------------------------------------------------------
  // WIND UPDATE
  // ---------------------------------------------------------
  function updateWind(dt) {
    wind.angle = 0.15 + noise1(clock * 0.00018, wind.seed) * 0.55;
    if (special.state === 'idle' && Math.random() < 0.002) {
      wind.targetStrength = rand(0.25, 0.8);
    }
    wind.strength += (wind.targetStrength - wind.strength) * dt * 0.5;
  }

  // ---------------------------------------------------------
  // MAIN LOOP
  // ---------------------------------------------------------
  function frame(now) {
    const dt = Math.min(0.045, (now - lastT) / 1000);
    lastT = now;
    clock += dt * 1000;

    updateWind(dt);
    updateCamera(dt);
    updateSpecial(dt);

    // --- update creatures & particles ---
    butterflies.forEach((b) => b.update(dt));
    bees.forEach((b) => b.update(dt));
    dragonflies.forEach((d) => d.update(dt));
    ladybugs.forEach((l) => l.update(dt));
    petalsFloating.forEach((p) => p.update(dt));
    seedsFloating.forEach((s) => s.update(dt));
    birds.forEach((b) => b.update(dt));
    flowersFar.forEach((f) => f.update(dt));
    flowersNear.forEach((f) => f.update(dt));

    // --- render ---
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-W / 2, -H / 2);

    drawSky();
    drawClouds(dt);
    birds.forEach((b) => b.draw(ctx));
    drawHills();
    ctx.save();
    ctx.translate(camera.x * 0.07, camera.y * 0.07);
    drawTreeClusters();
    ctx.restore();

    drawFieldBase();

    ctx.save();
    ctx.translate(camera.x * 0.1, camera.y * 0.1);
    flowersFar.forEach((f) => f.draw(ctx, wind));
    ctx.restore();

    drawGrass();

    ctx.save();
    ctx.translate(camera.x * 0.16, camera.y * 0.16);
    flowersNear
      .slice()
      .sort((a, b) => a.baseY - b.baseY)
      .forEach((f) => f.draw(ctx, wind));
    dragonflies.forEach((d) => d.draw(ctx));
    ladybugs.forEach((l) => l.draw(ctx));
    bees.forEach((b) => b.draw(ctx));
    ctx.restore();

    petalsFloating.forEach((p) => p.draw(ctx));
    seedsFloating.forEach((s) => s.draw(ctx));
    butterflies.forEach((b) => b.draw(ctx));

    if (skyBlooms.length) {
      drawFormationAura();
      drawFormationStrokes();
      skyBlooms.forEach((b) => b.draw(ctx));
    }

    drawVignette();
    ctx.restore();

    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------
  // INIT
  // ---------------------------------------------------------
  function init() {
    resize();
    requestAnimationFrame((t) => { lastT = t; frame(t); });
    setTimeout(() => { loader.classList.add('hidden'); }, 900);
  }

  init();
})();
