/* ============================================================
   Dchati — light-beam field + scroll-driven "DC" monogram.

   Soft white beams wander the screen. As the brand-moment section
   scrolls through center, a portion of them flow into the shape of
   a "DC" monogram — staggered, so the logo is discovered rather
   than switched on. The rest keep wandering. Scrolling away lets
   the logo dissolve back into the field.
   ============================================================ */
(function () {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W, H, dpr;
  let beams = [];        // wandering-only beams
  let logo = [];         // beams that can flow into the monogram
  let running = true;
  let last = performance.now();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  const MAX_LOGO = 300;

  /* ---- soft glow sprite, reused for every beam ---- */
  const SP = 96;
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = SP;
  (function () {
    const s = sprite.getContext("2d");
    const g = s.createRadialGradient(SP / 2, SP / 2, 0, SP / 2, SP / 2, SP / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.16, "rgba(255,255,255,0.9)");
    g.addColorStop(0.42, "rgba(255,252,244,0.35)");
    g.addColorStop(1, "rgba(255,252,244,0)");
    s.fillStyle = g;
    s.fillRect(0, 0, SP, SP);
  })();

  const rand = (a, b) => a + Math.random() * (b - a);
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

  function density() {
    return window.DCHATI_STATE ? window.DCHATI_STATE.particleDensity : 70;
  }

  function wandererCount() {
    return Math.round(density() * (W * H) / (1280 * 800) * 0.55);
  }

  /* a beam's free wandering state (shared by both groups) */
  function makeWander() {
    const z = Math.pow(Math.random(), 1.3);
    const big = Math.random() < 0.12;
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      z,
      r: (big ? rand(6, 11) : rand(3, 6.5)) * (0.55 + z * 0.6),
      vx: rand(0.04, 0.12) * (0.4 + z),
      vy: rand(-0.05, -0.12) * (0.4 + z),
      sway: rand(0, Math.PI * 2),
      swaySpeed: rand(0.002, 0.006),
      swayAmp: rand(0.10, 0.26),
      tw: rand(0, Math.PI * 2),
      twSpeed: rand(0.004, 0.013),
      baseAlpha: (big ? 0.5 : 0.32) * (0.35 + z * 0.65),
    };
  }

  function stepWander(p, dt) {
    p.sway += p.swaySpeed * dt;
    p.x += (p.vx + Math.cos(p.sway) * p.swayAmp * 0.12) * dt;
    p.y += (p.vy + Math.sin(p.sway) * p.swayAmp * 0.12) * dt;
    p.tw += p.twSpeed * dt;
    const m = 60;
    if (p.x < -m) p.x = W + m; else if (p.x > W + m) p.x = -m;
    if (p.y < -m) p.y = H + m; else if (p.y > H + m) p.y = -m;
  }

  /* ---- sample the "DC" glyph shape into target points ---- */
  function buildTargets() {
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const oc = off.getContext("2d");
    const fontSize = Math.min(W * 0.5, H * 0.46);
    oc.clearRect(0, 0, W, H);
    oc.fillStyle = "#fff";
    oc.textAlign = "center";
    oc.textBaseline = "middle";
    oc.font = `700 ${fontSize}px "Space Grotesk", system-ui, sans-serif`;
    oc.fillText("DC", W / 2, H * 0.44);

    const data = oc.getImageData(0, 0, W, H).data;
    const step = Math.max(5, Math.round(fontSize / 52));
    const pts = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 130) {
          pts.push({ x: x + rand(-step / 2, step / 2), y: y + rand(-step / 2, step / 2) });
        }
      }
    }
    // shuffle so the cap samples evenly across the shape
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    pts.length = Math.min(pts.length, MAX_LOGO);
    return pts;
  }

  function seed() {
    // wanderers
    beams = [];
    const n = wandererCount();
    for (let i = 0; i < n; i++) beams.push(makeWander());

    // logo beams: one per sampled target, each with its own wander state + stagger
    const targets = buildTargets();
    logo = targets.map((t) => {
      const w = makeWander();
      w.target = t;
      w.delay = Math.random() * 0.42;            // staggered arrival → "discovery"
      w.jitter = rand(0, Math.PI * 2);
      w.jitterSpeed = rand(0.01, 0.03);
      w.formR = rand(2.4, 4.2);                  // crisp size once in formation
      return w;
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  /* ---- formation factor from the brand-moment section position ---- */
  const section = document.getElementById("brand-moment");
  let formed = 0;          // smoothed 0..1
  let wasFormed = false;

  function targetFormation() {
    if (!section) return 0;
    const r = section.getBoundingClientRect();
    const secCenter = r.top + r.height / 2;
    const vpCenter = window.innerHeight / 2;
    const offset = Math.abs(secCenter - vpCenter);
    // Hold the logo fully formed across a band (plateau), then fade out.
    // Wider band + longer falloff = the DC lingers instead of flashing by.
    const plateau = window.innerHeight * 0.34;   // fully-formed zone (each side)
    const falloff = window.innerHeight * 0.85;   // fade distance beyond the band
    const d = Math.max(0, offset - plateau) / falloff;
    return smooth(1 - Math.min(1, d));
  }

  function draw(dt) {
    ctx.clearRect(0, 0, W, H);

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    // ease formation toward its scroll-driven target
    const tf = targetFormation();
    formed += (tf - formed) * 0.08;
    const f = formed < 0.001 ? 0 : formed;

    // toggle caption when the logo is substantially present
    const nowFormed = f > 0.55;
    if (nowFormed !== wasFormed && section) {
      section.classList.toggle("formed", nowFormed);
      wasFormed = nowFormed;
    }

    ctx.globalCompositeOperation = "lighter";

    // --- pure wanderers ---
    for (const p of beams) {
      stepWander(p, dt);
      const alpha = p.baseAlpha * (0.72 + 0.28 * Math.sin(p.tw));
      if (alpha <= 0.01) continue;
      const ox = pointer.x * 24 * p.z, oy = pointer.y * 24 * p.z;
      const size = p.r * 4.2;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(sprite, p.x + ox - size / 2, p.y + oy - size / 2, size, size);
    }

    // --- logo beams: blend between wandering and target ---
    for (const p of logo) {
      stepWander(p, dt);

      // per-beam staggered local formation
      const lf = smooth(p.delay >= 1 ? 0 : (f - p.delay) / (1 - p.delay));

      let x, y, size, alpha;
      if (lf <= 0) {
        const ox = pointer.x * 24 * p.z, oy = pointer.y * 24 * p.z;
        x = p.x + ox; y = p.y + oy;
        size = p.r * 4.2;
        alpha = p.baseAlpha * (0.72 + 0.28 * Math.sin(p.tw));
      } else {
        p.jitter += p.jitterSpeed * dt;
        // subtle life even when formed (not flashy): ~1px shimmer
        const jx = Math.cos(p.jitter) * 1.1 * (1 - 0.5 * lf);
        const jy = Math.sin(p.jitter * 1.3) * 1.1 * (1 - 0.5 * lf);
        const wx = p.x + pointer.x * 24 * p.z;
        const wy = p.y + pointer.y * 24 * p.z;
        x = wx + (p.target.x + jx - wx) * lf;
        y = wy + (p.target.y + jy - wy) * lf;
        const wsize = p.r * 4.2;
        const fsize = p.formR * 4.2;
        size = wsize + (fsize - wsize) * lf;
        const wAlpha = p.baseAlpha * (0.72 + 0.28 * Math.sin(p.tw));
        const fAlpha = 0.78;                       // steady + bright in formation
        alpha = wAlpha + (fAlpha - wAlpha) * lf;
      }

      if (alpha <= 0.01) continue;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function frame(now) {
    if (!running) return;
    let dt = (now - last) / 16.667;
    last = now;
    if (dt > 3) dt = 3;
    if (reduced) dt = 0;     // hold motion; scroll still drives formation via targetFormation easing
    draw(dt);
    requestAnimationFrame(frame);
  }

  window.addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  window.addEventListener("pointerleave", () => { pointer.tx = 0; pointer.ty = 0; });

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    last = performance.now();
    if (running) requestAnimationFrame(frame);
  });

  window.addEventListener("resize", resize);
  window.addEventListener("dchati:density-changed", seed);

  // build once, then rebuild with the real font for an accurate glyph
  resize();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => seed());
  }
})();
