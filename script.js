/* ==========================================================================
   21 de septiembre · Día de las Flores Amarillas
   script.js — toda la interacción, organizada por funciones
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     0. CONFIGURACIÓN — puedes ajustar estos valores libremente
     ------------------------------------------------------------------ */
  const CONFIG = {
    petalCount: 25,       // pétalos flotantes simultáneos (recomendado 15–35)
    animationSpeed: 1,    // 1 = normal. 0.7 = más lento, 1.3 = más rápido
    enableMusic: true,    // muestra el botón de música (necesita music.mp3)
    enableSounds: false,  // sonidos suaves activados por defecto
    flowerCount: 9,       // flores normales en el campo
    typeSpeed: 34,        // ms entre letras del efecto de escritura
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;

  let TXT = {};      // textos leídos de la zona editable del HTML
  let soundOn = CONFIG.enableSounds;
  let audioCtx = null;
  let specialFound = false;

  /* ------------------------------------------------------------------
     1. UTILIDADES
     ------------------------------------------------------------------ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function setStage(stage) {
    document.body.dataset.stage = stage;
  }

  /* ------------------------------------------------------------------
     2. LECTURA DE TEXTOS (zona editable del HTML)
     ------------------------------------------------------------------ */
  function readConfigZone() {
    const zone = $("#config-zone");
    if (!zone) return;

    const name = (zone.querySelector('[data-key="recipient"]')?.textContent || "ti").trim();

    zone.querySelectorAll("[data-key]").forEach((el) => {
      const key = el.dataset.key;
      TXT[key] = el.textContent.replace(/\{nombre\}/gi, name).trim();
    });

    TXT.flowerMessages = zone.querySelector('[data-list="flower-messages"]')
      ? $$('[data-list="flower-messages"] li', zone).map((li) => li.textContent.trim())
      : [];

    TXT.centerLines = zone.querySelector('[data-list="center-lines"]')
      ? $$('[data-list="center-lines"] li', zone).map((li) => ({
          text: li.textContent.trim(),
          cls: li.className || "",
        }))
      : [];

    TXT.letterParagraphs = zone.querySelector('[data-list="letter-paragraphs"]')
      ? $$('[data-list="letter-paragraphs"] p', zone).map((p) => ({
          text: p.textContent.replace(/\{nombre\}/gi, name).trim(),
          cls: p.className || "",
        }))
      : [];

    if (TXT.title) document.title = TXT.title;
  }

  function applyBindings() {
    $$("[data-bind]").forEach((el) => {
      const key = el.dataset.bind;
      if (TXT[key] != null) el.textContent = TXT[key];
    });
  }

  /* ------------------------------------------------------------------
     3. INICIO
     ------------------------------------------------------------------ */
  function init() {
    readConfigZone();
    applyBindings();
    buildIntroMark();
    setupIntro();
    setupFlowers();
    setupWind();
    setupLetter();
    setupMusic();
    setupSound();
    setupParallax();
    setupCursorTrail();
    setupSunEasterEgg();
    buildFinalFlower();
    setupReplay();
    startPetals();

    if (reduceMotion) CONFIG.petalCount = Math.min(CONFIG.petalCount, 10);
    document.documentElement.style.setProperty("--speed", String(CONFIG.animationSpeed));
  }

  function buildIntroMark() {
    const mark = $("#intro-mark");
    if (!mark) return;
    mark.innerHTML =
      '<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<g opacity="0.9">' +
      [0, 60, 120, 180, 240, 300]
        .map(
          (deg) =>
            `<ellipse cx="28" cy="14" rx="7.5" ry="11" fill="#F6C63C" opacity="0.85" transform="rotate(${deg} 28 28)"/>`
        )
        .join("") +
      '<circle cx="28" cy="28" r="6.5" fill="#C98A16"/>' +
      "</g></svg>";
  }

  /* ------------------------------------------------------------------
     4. PANTALLA DE INICIO
     ------------------------------------------------------------------ */
  function setupIntro() {
    const btn = $("#btn-start");
    if (!btn) return;
    btn.addEventListener("click", () => goToGarden());
  }

  function goToGarden() {
    const intro = $("#screen-intro");
    const garden = $("#screen-garden");
    intro.classList.remove("is-active");
    setStage("garden");
    garden.classList.add("is-active");
    playTone("open");

    // Tras un momento, mostrar la pista y luego el mensaje central
    setTimeout(() => {
      const hint = $("#hint");
      if (hint) hint.classList.add("is-shown");
    }, 1600);

    setTimeout(showCenterMessage, reduceMotion ? 3200 : 7200);
  }

  /* ------------------------------------------------------------------
     5. FLORES DEL CAMPO
     ------------------------------------------------------------------ */
  const flowerPalette = [
    { petal: "#FBE070", center: "#C9880F" },
    { petal: "#FFE9A1", center: "#B87A14" },
    { petal: "#F8D24A", center: "#A9700E" },
    { petal: "#FFD98A", center: "#C2790F" },
    { petal: "#FCE49B", center: "#AD7A12" },
    { petal: "#F6C34A", center: "#8F5E0C" },
    { petal: "#FFE3B0", center: "#B4790E" }, // variante crema-durazno, un toque distinto
  ];

  function flowerSVG({ w, colors, withHit = true, petals = 7, pointed = false }) {
    let petalShapes = "";
    for (let i = 0; i < petals; i++) {
      const deg = (360 / petals) * i;
      petalShapes += pointed
        ? `<path d="M50 42 C41 34 41 14 50 4 C59 14 59 34 50 42 Z" fill="${colors.petal}" transform="rotate(${deg} 50 42)"/>`
        : `<ellipse cx="50" cy="24" rx="13" ry="21" fill="${colors.petal}" transform="rotate(${deg} 50 42)"/>`;
    }
    return `
      <svg class="flower-svg" viewBox="0 0 100 208" width="100%" height="100%" overflow="visible"
           xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path class="part-stem" d="M50 208 C50 150 44 120 50 84" stroke="#7FAA6E" stroke-width="4"
              fill="none" stroke-linecap="round"/>
        <path class="leaf leaf-a" d="M50 168 C34 164 22 152 20 136 C38 138 50 150 50 168 Z" fill="#8FBB78"/>
        <path class="leaf leaf-b" d="M50 132 C66 126 76 112 76 96 C58 100 50 114 50 132 Z" fill="#7FAA6E"/>
        <g class="part-head">
          <g class="part-bloom">
            ${petalShapes}
            <circle cx="50" cy="42" r="12" fill="${colors.center}"/>
          </g>
        </g>
        ${withHit ? '<rect class="hit" x="0" y="0" width="100" height="208"/><rect class="focus-ring" x="4" y="4" width="92" height="200" rx="14"/>' : ""}
      </svg>`;
  }

  function setupFlowers() {
    buildRow($("#field-back"), Math.ceil(CONFIG.flowerCount * 0.7), { min: 64, max: 96 }, 0.55, { bottom: [4, 16] });
    buildRow($("#field-front"), CONFIG.flowerCount, { min: 98, max: 150 }, 1, { bottom: [-6, 10] });
    buildSpecialFlower();
  }

  function buildRow(container, count, sizeRange, opacity, bottomRange) {
    if (!container) return;
    const frag = document.createDocumentFragment();
    const step = 100 / (count + 1);

    for (let i = 0; i < count; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flower";
      btn.setAttribute("aria-label", "Flor amarilla");

      const w = Math.round(rand(sizeRange.min, sizeRange.max));
      const left = clamp(step * (i + 1) + rand(-step * 0.32, step * 0.32), 3, 97);
      const bottom = rand(bottomRange.bottom[0], bottomRange.bottom[1]);
      const swayDur = rand(4.5, 7.5) / CONFIG.animationSpeed;
      const swayDelay = rand(-4, 0);
      const tilt = rand(1.6, 3.4);
      const lean = rand(4, 9) * (Math.random() < 0.5 ? -1 : 1);
      const enter = rand(0.15, 1.1);

      btn.style.setProperty("--w", w + "px");
      btn.style.left = left + "%";
      btn.style.bottom = bottom + "%";
      btn.style.opacity = opacity;
      btn.style.setProperty("--sway-dur", swayDur + "s");
      btn.style.setProperty("--sway-delay", swayDelay + "s");
      btn.style.setProperty("--tilt", tilt);
      btn.style.setProperty("--lean", lean);
      btn.style.setProperty("--enter", enter + "s");
      btn.style.zIndex = String(Math.round(w));

      const colors = pick(flowerPalette);
      const petals = pick([6, 7, 7, 8]);
      const pointed = Math.random() < 0.35;
      btn.innerHTML =
        '<span class="flower-lean"><span class="flower-sway"><span class="flower-scale">' +
        flowerSVG({ w, colors, petals, pointed }) +
        "</span></span></span>";

      btn.addEventListener("click", () => onFlowerTap(btn));
      frag.appendChild(btn);
    }
    container.appendChild(frag);
  }

  function onFlowerTap(btn) {
    if (btn.classList.contains("is-pop")) return;
    btn.classList.add("is-pop");
    setTimeout(() => btn.classList.remove("is-pop"), 480);

    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height * 0.22;

    burstPetals(x, y, 8);
    showFloatingMessage(x, y);
    playTone("pop");

    const hint = $("#hint");
    if (hint && hint.dataset.step === "1") {
      hint.dataset.step = "2";
    }
  }

  function showFloatingMessage(x, y) {
    const layer = $("#float-layer");
    if (!layer || !TXT.flowerMessages || !TXT.flowerMessages.length) return;

    const bounds = layer.getBoundingClientRect();
    const msg = document.createElement("p");
    msg.className = "float-msg";
    msg.textContent = pick(TXT.flowerMessages);
    const halfWidth = Math.min(130, bounds.width / 2 - 12);
    msg.style.left = clamp(x - bounds.left, halfWidth, bounds.width - halfWidth) + "px";
    msg.style.top = y - bounds.top + "px";
    layer.appendChild(msg);

    msg.addEventListener("animationend", () => msg.remove());
    setTimeout(() => msg.remove(), 4500);
  }

  /* ---- Sol: un pequeño detalle escondido ---- */
  function setupSunEasterEgg() {
    const sun = $(".sun");
    if (!sun) return;
    sun.style.pointerEvents = "auto";
    sun.style.cursor = "pointer";
    sun.setAttribute("role", "button");
    sun.setAttribute("tabindex", "0");
    sun.setAttribute("aria-label", "El sol");

    const trigger = () => {
      const rect = sun.getBoundingClientRect();
      confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, reduceMotion ? 6 : 16);
      playTone("chosen");
      sun.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }],
        { duration: 700, easing: "ease-out" }
      );
    };

    sun.addEventListener("click", trigger);
    sun.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        trigger();
      }
    });
  }

  /* ---- Flor especial ---- */  function buildSpecialFlower() {
    const container = $("#field-special");
    if (!container) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flower flower-special";
    btn.setAttribute("aria-label", "Una flor distinta a las demás");
    btn.style.setProperty("--sway-dur", (rand(5.5, 6.6) / CONFIG.animationSpeed) + "s");
    btn.style.setProperty("--tilt", "2.4");

    const glow = document.createElement("span");
    glow.className = "flower-glow";
    btn.appendChild(glow);

    for (let i = 0; i < 5; i++) {
      const s = document.createElement("span");
      s.className = "sparkle";
      const angle = (360 / 5) * i + rand(-12, 12);
      const dist = rand(46, 66);
      s.style.left = `calc(50% + ${Math.cos((angle * Math.PI) / 180) * dist}px)`;
      s.style.top = `calc(21% + ${Math.sin((angle * Math.PI) / 180) * dist}px)`;
      s.style.setProperty("--sz", rand(4, 8) + "px");
      s.style.setProperty("--sd", rand(0, 3) + "s");
      btn.appendChild(s);
    }

    const wrap = document.createElement("span");
    wrap.className = "flower-lean";
    wrap.innerHTML =
      '<span class="flower-sway"><span class="flower-scale"><span class="flower-breathe">' +
      flowerSVG({ w: 190, colors: { petal: "#FFE9A1", center: "#C9880F" }, withHit: false }) +
      "</span></span></span>";
    btn.appendChild(wrap);

    const hit = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    hit.setAttribute("viewBox", "0 0 100 208");
    hit.setAttribute("class", "hit-overlay");
    hit.style.position = "absolute";
    hit.style.inset = "0";
    hit.style.width = "100%";
    hit.style.height = "100%";
    hit.innerHTML = '<rect class="hit" x="0" y="0" width="100" height="208"/>';
    btn.appendChild(hit);

    btn.addEventListener("click", () => onSpecialFlowerTap(btn));
    container.appendChild(btn);

    setTimeout(() => btn.classList.add("is-hinting"), 5000);
  }

  function onSpecialFlowerTap(btn) {
    if (specialFound) return;
    specialFound = true;
    btn.classList.add("is-chosen");
    document.body.classList.add("is-dimmed");
    burstPetals(window.innerWidth / 2, window.innerHeight * 0.45, 14);
    playTone("chosen");

    setTimeout(openLetter, 1400);
  }

  /* ------------------------------------------------------------------
     6. MENSAJE CENTRAL (progresivo)
     ------------------------------------------------------------------ */
  function showCenterMessage() {
    if (!TXT.centerLines || !TXT.centerLines.length) return;
    const wrap = $("#center-msg");
    const holder = $("#center-lines");
    if (!wrap || !holder) return;

    holder.innerHTML = "";
    TXT.centerLines.forEach((line) => {
      const p = document.createElement("p");
      p.className = "center-line " + line.cls;
      p.textContent = line.text;
      holder.appendChild(p);
    });

    wrap.classList.add("is-shown");
    const lines = $$(".center-line", holder);
    const gap = reduceMotion ? 700 : 1500;
    lines.forEach((line, i) => {
      setTimeout(() => line.classList.add("is-visible"), i * gap + 200);
    });
  }

  /* ------------------------------------------------------------------
     7. VIENTO
     ------------------------------------------------------------------ */
  function setupWind() {
    const btn = $("#btn-wind");
    if (!btn) return;
    let windTimer = null;

    btn.addEventListener("click", () => {
      const on = document.body.classList.toggle("is-windy");
      btn.setAttribute("aria-pressed", String(on));

      clearInterval(windTimer);
      if (on) {
        windTimer = setInterval(() => burstWindPetal(), reduceMotion ? 900 : 420);
      }
    });
  }

  function burstWindPetal() {
    const layer = $("#petal-layer");
    if (!layer) return;
    layer.appendChild(makePetal({ fast: true }));
  }

  /* ------------------------------------------------------------------
     8. PÉTALOS FLOTANTES
     ------------------------------------------------------------------ */
  function startPetals() {
    const layer = $("#petal-layer");
    if (!layer) return;
    const target = reduceMotion ? Math.min(CONFIG.petalCount, 12) : CONFIG.petalCount;

    for (let i = 0; i < target; i++) {
      setTimeout(() => spawnPetal(layer, true), i * 220);
    }

    // Mantiene un flujo constante, reemplazando los que terminan
    setInterval(() => {
      if (layer.childElementCount < target) spawnPetal(layer, false);
    }, 1400);
  }

  function spawnPetal(layer, initial) {
    const petal = makePetal({ initial });
    layer.appendChild(petal);
  }

  function makePetal({ initial = false, fast = false } = {}) {
    const outer = document.createElement("span");
    outer.className = "petal";
    outer.style.setProperty("--depth", rand(0.3, 1).toFixed(2));

    const fall = document.createElement("span");
    fall.className = "petal-fall";
    const size = rand(9, 17);
    const dur = (fast ? rand(3.5, 6) : rand(11, 22)) / CONFIG.animationSpeed;
    const drift = rand(-14, 20);
    const startLeft = rand(0, 100);
    const startDelay = initial ? rand(0, 6) : 0;

    fall.style.left = startLeft + "vw";
    fall.style.setProperty("--dur", dur + "s");
    fall.style.setProperty("--drift", drift + "vw");
    fall.style.setProperty("--op", rand(0.35, 0.8).toFixed(2));
    fall.style.animationDelay = (fast ? 0 : startDelay) + "s";

    const shape = document.createElement("span");
    shape.className = "petal-shape";
    shape.style.setProperty("--size", size + "px");
    shape.style.setProperty("--spin", rand(3.5, 6.5) + "s");
    shape.style.setProperty("--r0", rand(0, 360) + "deg");
    shape.style.setProperty("--c1", "#FFE58A");
    shape.style.setProperty("--c2", "#F2BE2E");

    fall.appendChild(shape);
    outer.appendChild(fall);

    const life = (dur + (fast ? 0 : startDelay)) * 1000 + 200;
    setTimeout(() => outer.remove(), life);

    return outer;
  }

  /* ------------------------------------------------------------------
     9. LA CARTA
     ------------------------------------------------------------------ */
  let typingDone = false;
  let typingTimer = null;
  let typingStartTimer = null;

  function setupLetter() {
    const skip = $("#letter-skip");
    const card = $("#letter-card");
    const next = $("#btn-last");

    if (skip) skip.addEventListener("click", finishTypingNow);
    if (card) card.addEventListener("click", (e) => {
      if (!typingDone && e.target === card) finishTypingNow();
    });
    if (next) next.addEventListener("click", goToFinal);
  }

  function openLetter() {
    const wrap = $("#letter");
    const card = $("#letter-card");
    if (!wrap || !card) return;

    buildLetterBody();
    wrap.hidden = false;
    requestAnimationFrame(() => {
      wrap.classList.add("is-open");
      card.focus({ preventScroll: true });
    });
    playTone("open");

    typingDone = false;
    typingStartTimer = setTimeout(startTyping, 700);
  }

  function buildLetterBody() {
    const body = $("#letter-body");
    if (!body || !TXT.letterParagraphs) return;
    body.innerHTML = "";
    body.dataset.pIndex = "0";

    TXT.letterParagraphs.forEach((para) => {
      const p = document.createElement("p");
      if (para.cls) p.className = para.cls;

      const done = document.createElement("span");
      done.className = "done";
      const rest = document.createElement("span");
      rest.className = "rest";
      rest.textContent = para.text;

      p.appendChild(done);
      p.appendChild(rest);
      body.appendChild(p);
    });
  }

  function startTyping() {
    if (typingDone) return; // ya se saltó la animación: no reiniciar el tipeo
    const body = $("#letter-body");
    if (!body) return;
    const paragraphs = $$("p", body);
    let pIndex = 0;
    let cIndex = 0;

    function step() {
      if (pIndex >= paragraphs.length) {
        finishLetter();
        return;
      }
      const p = paragraphs[pIndex];
      const done = p.querySelector(".done");
      const rest = p.querySelector(".rest");
      const full = rest.textContent;

      if (cIndex === 0) {
        const cursor = document.createElement("span");
        cursor.className = "cursor";
        cursor.textContent = "|";
        p.appendChild(cursor);
      }

      if (cIndex <= full.length) {
        done.textContent = full.slice(0, cIndex);
        rest.textContent = full.slice(cIndex);
        cIndex++;
        typingTimer = setTimeout(step, CONFIG.typeSpeed / CONFIG.animationSpeed);
      } else {
        const cursor = p.querySelector(".cursor");
        if (cursor) cursor.remove();
        pIndex++;
        cIndex = 0;
        typingTimer = setTimeout(step, 260);
      }
    }

    step();
  }

  function finishTypingNow() {
    if (typingDone) return;
    clearTimeout(typingTimer);
    clearTimeout(typingStartTimer);
    const body = $("#letter-body");
    if (!body) return;
    $$("p", body).forEach((p) => {
      const done = p.querySelector(".done");
      const rest = p.querySelector(".rest");
      const cursor = p.querySelector(".cursor");
      if (done && rest) {
        done.textContent = done.textContent + rest.textContent;
        rest.textContent = "";
      }
      if (cursor) cursor.remove();
    });
    finishLetter();
  }

  function finishLetter() {
    typingDone = true;
    const card = $("#letter-card");
    if (card) card.classList.add("is-done");
  }

  function goToFinal() {
    const wrap = $("#letter");
    if (!wrap) return;
    wrap.classList.add("is-leaving");

    setTimeout(() => {
      wrap.classList.remove("is-open", "is-leaving");
      wrap.hidden = true;

      $("#screen-garden").classList.remove("is-active");
      document.body.classList.remove("is-dimmed");
      setStage("final");
      $("#screen-final").classList.add("is-active");

      const title = $("#final-title");
      if (title) setTimeout(() => title.focus({ preventScroll: true }), 900);

      // Un pequeño confeti de bienvenida para la pantalla final.
      setTimeout(() => {
        confettiBurst(window.innerWidth / 2, window.innerHeight * 0.42, reduceMotion ? 6 : 18);
      }, 1600);
    }, 900);
  }

  /* ------------------------------------------------------------------
     10. FLOR FINAL
     ------------------------------------------------------------------ */
  function buildFinalFlower() {
    const holder = $("#final-flower");
    if (!holder) return;
    holder.innerHTML = flowerSVG({
      w: 100,
      colors: { petal: "#FFE38F", center: "#C9880F" },
      withHit: false,
    });
  }

  /* ------------------------------------------------------------------
     11. MÚSICA
     ------------------------------------------------------------------ */
  function setupMusic() {
    const btn = $("#btn-music");
    const audio = $("#bg-music");
    if (!btn || !audio) return;

    if (!CONFIG.enableMusic) {
      btn.hidden = true;
      return;
    }

    // Si el archivo music.mp3 no existe, ocultamos el botón sin mostrar errores.
    audio.addEventListener(
      "error",
      () => {
        btn.hidden = true;
      },
      { once: true }
    );

    btn.addEventListener("click", () => {
      if (audio.paused) {
        audio.volume = 0;
        audio
          .play()
          .then(() => fadeAudio(audio, 0, 0.55, 1200))
          .catch(() => {
            /* reproducción bloqueada u otro problema: no interrumpe la experiencia */
          });
        btn.classList.add("is-playing");
        btn.setAttribute("aria-pressed", "true");
      } else {
        fadeAudio(audio, audio.volume, 0, 500, () => audio.pause());
        btn.classList.remove("is-playing");
        btn.setAttribute("aria-pressed", "false");
      }
    });
  }

  function fadeAudio(audio, from, to, duration, done) {
    const start = performance.now();
    function step(now) {
      const t = clamp((now - start) / duration, 0, 1);
      audio.volume = from + (to - from) * t;
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------
     12. SONIDOS (Web Audio API, muy suaves)
     ------------------------------------------------------------------ */
  function setupSound() {
    const btn = $("#btn-sound");
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(soundOn));
    if (soundOn) btn.classList.add("is-on");

    btn.addEventListener("click", () => {
      soundOn = !soundOn;
      btn.setAttribute("aria-pressed", String(soundOn));
      if (soundOn) ensureAudioCtx();
    });
  }

  function ensureAudioCtx() {
    if (audioCtx) return audioCtx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    } catch (e) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function playTone(type) {
    if (!soundOn) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    const settings = {
      pop: { freq: 620, peak: 0.05, dur: 0.18 },
      open: { freq: 340, peak: 0.035, dur: 0.9 },
      chosen: { freq: 480, peak: 0.045, dur: 0.7 },
    }[type] || { freq: 440, peak: 0.03, dur: 0.3 };

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(settings.freq, now);
    osc.frequency.exponentialRampToValueAtTime(settings.freq * 0.72, now + settings.dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(settings.peak, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.dur);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + settings.dur + 0.05);
  }

  /* ------------------------------------------------------------------
     13. PARALLAX (mouse en PC, ligero giroscopio/touch en móvil)
     ------------------------------------------------------------------ */
  function setupParallax() {
    if (reduceMotion) return;
    const root = document.body;
    let raf = null;
    let px = 0;
    let py = 0;

    function apply() {
      root.style.setProperty("--px", px.toFixed(3));
      root.style.setProperty("--py", py.toFixed(3));
      raf = null;
    }

    if (!isTouch) {
      window.addEventListener(
        "pointermove",
        (e) => {
          px = (e.clientX / window.innerWidth - 0.5) * 2;
          py = (e.clientY / window.innerHeight - 0.5) * 2;
          if (!raf) raf = requestAnimationFrame(apply);
        },
        { passive: true }
      );
    } else {
      // Movimiento táctil muy ligero: solo al arrastrar, nunca marea.
      let lastX = null;
      let lastY = null;
      document.addEventListener(
        "touchmove",
        (e) => {
          const t = e.touches[0];
          if (!t) return;
          if (lastX == null) {
            lastX = t.clientX;
            lastY = t.clientY;
            return;
          }
          px = clamp(px + (t.clientX - lastX) / window.innerWidth, -0.4, 0.4);
          py = clamp(py + (t.clientY - lastY) / window.innerHeight, -0.4, 0.4);
          lastX = t.clientX;
          lastY = t.clientY;
          if (!raf) raf = requestAnimationFrame(apply);
        },
        { passive: true }
      );
      document.addEventListener("touchend", () => {
        lastX = null;
        lastY = null;
      });
    }
  }

  /* ------------------------------------------------------------------
     14. PARTÍCULAS DE ESTALLIDO + CURSOR (solo PC)
     ------------------------------------------------------------------ */
  function burstPetals(x, y, count, opts = {}) {
    const layer = $("#fx-layer");
    if (!layer) return;
    const n = reduceMotion ? Math.min(count, 5) : count;
    const palette = opts.colors || [["#FFE58A", "#F2BE2E"]];

    for (let i = 0; i < n; i++) {
      const p = document.createElement("span");
      p.className = "burst";
      const angle = rand(0, 360);
      const dist = rand(opts.minDist || 40, opts.maxDist || 110);
      const [c1, c2] = pick(palette);
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.setProperty("--bs", rand(7, 13) + "px");
      p.style.setProperty("--dx", Math.cos((angle * Math.PI) / 180) * dist + "px");
      p.style.setProperty("--dy", Math.sin((angle * Math.PI) / 180) * dist - 30 + "px");
      p.style.setProperty("--rot", rand(-140, 140) + "deg");
      p.style.setProperty("--bd", rand(0.8, 1.3) + "s");
      p.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
      layer.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  }

  // Pequeño confeti festivo de varios tonos, usado en la pantalla final.
  function confettiBurst(x, y, count) {
    burstPetals(x, y, count, {
      minDist: 60,
      maxDist: 160,
      colors: [
        ["#FFE58A", "#F2BE2E"],
        ["#FFD9A0", "#F0A93C"],
        ["#FFF0BE", "#F6CE55"],
        ["#FBE9CE", "#E7B96A"],
      ],
    });
  }

  function setupCursorTrail() {
    if (reduceMotion) return;
    const layer = $("#fx-layer");
    if (!layer) return;

    if (isTouch) {
      // En móvil: un pequeño toque de brillo al tocar la pantalla (no continuo).
      let lastTap = 0;
      document.addEventListener(
        "touchstart",
        (e) => {
          const now = performance.now();
          if (now - lastTap < 350) return;
          lastTap = now;
          const t = e.touches[0];
          if (!t) return;
          spawnTrailDot(layer, t.clientX, t.clientY);
        },
        { passive: true }
      );
      return;
    }

    let lastTime = 0;

    window.addEventListener(
      "pointermove",
      (e) => {
        const now = performance.now();
        if (now - lastTime < 55) return; // throttling
        lastTime = now;
        spawnTrailDot(layer, e.clientX, e.clientY);
      },
      { passive: true }
    );
  }

  function spawnTrailDot(layer, x, y) {
    const t = document.createElement("span");
    t.className = "trail";
    t.style.left = x + "px";
    t.style.top = y + "px";
    t.style.setProperty("--ts", rand(5, 9) + "px");
    t.style.setProperty("--dx", rand(-8, 8) + "px");
    layer.appendChild(t);
    setTimeout(() => t.remove(), 1000);
  }

  /* ------------------------------------------------------------------
     15. VOLVER A EMPEZAR
     ------------------------------------------------------------------ */
  function setupReplay() {
    const btn = $("#btn-replay");
    if (!btn) return;
    btn.addEventListener("click", () => window.location.reload());
  }

  /* ------------------------------------------------------------------
     Arranque
     ------------------------------------------------------------------ */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
