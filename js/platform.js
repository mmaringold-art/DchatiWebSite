/* ============================================================
   Dchati — Plataforma (login)
   1) Floating AI core (mouse-reactive particle sphere + neural rings)
   2) Entry point into the Keycloak OIDC flow (see js/auth.js)
   ============================================================ */

/* ------------------------------------------------------------
   AUTH
   Authentication is handled entirely by Keycloak at auth.dchati.com
   using Authorization Code + PKCE (S256). This page never sees a
   password, never holds a client secret, and never decides which
   workspace a user may open — that lives in the ID token Keycloak
   signs. See js/auth.js.
   ------------------------------------------------------------ */

/* ============================================================
   PART 1 — AI CORE
   ============================================================ */
(function aiCore() {
  const canvas = document.getElementById("core-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W, H, dpr, cx, cy, scale;
  let running = true;
  const t0 = performance.now();

  // pointer parallax (smoothed)
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let reveal = 0; // 0..1 entry animation

  function hue() {
    const base = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--accent-h")) || 195;
    return base;
  }

  /* --- build the point cloud --- */
  const SPHERE_N = window.innerWidth < 700 ? 260 : 440;
  const sphere = [];
  (function fibonacci() {
    const gold = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < SPHERE_N; i++) {
      const y = 1 - (i / (SPHERE_N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * gold;
      sphere.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, s: 0.6 + Math.random() * 0.4 });
    }
  })();

  // orbiting neural rings (each tilted differently)
  const rings = [];
  function makeRing(count, radius, tilt, yaw, speed) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      pts.push({ a, radius });
    }
    return { pts, tilt, yaw, speed, count };
  }
  rings.push(makeRing(46, 1.42, 1.15, 0.2, 0.5));
  rings.push(makeRing(40, 1.62, -0.55, 1.1, -0.34));
  rings.push(makeRing(34, 1.85, 0.35, 2.2, 0.22));

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W * 0.5; cy = H * 0.46;
    scale = Math.min(W, H) * 0.27;
  }

  // rotate a 3D point by pitch (X) then yaw (Y)
  function project(x, y, z, yaw, pitch) {
    // pitch
    let y1 = y * Math.cos(pitch) - z * Math.sin(pitch);
    let z1 = y * Math.sin(pitch) + z * Math.cos(pitch);
    // yaw
    let x2 = x * Math.cos(yaw) + z1 * Math.sin(yaw);
    let z2 = -x * Math.sin(yaw) + z1 * Math.cos(yaw);
    const FOV = 3.2;
    const persp = FOV / (FOV - z2);
    return { px: cx + x2 * scale * persp, py: cy - y1 * scale * persp, depth: z2, persp };
  }

  function frame(now) {
    if (!running) return;
    const time = (now - t0) / 1000;
    reveal += (1 - reveal) * 0.04;
    const rv = Math.min(1, reveal);

    // ease pointer
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;

    ctx.clearRect(0, 0, W, H);
    const h = hue();

    const yaw = time * 0.22 + mouse.x * 0.6;
    const pitch = -0.12 + mouse.y * 0.4;
    const grow = 0.5 + 0.5 * rv;

    // back glow
    const glow = ctx.createRadialGradient(cx + mouse.x * 30, cy + mouse.y * 24, 0, cx, cy, scale * 3.2);
    glow.addColorStop(0, `oklch(0.6 0.16 ${h} / ${0.22 * rv})`);
    glow.addColorStop(0.4, `oklch(0.45 0.12 ${h} / ${0.08 * rv})`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // --- rings (draw connective arcs + nodes) ---
    rings.forEach((ring, ri) => {
      const rYaw = yaw + ring.yaw + time * ring.speed;
      const projected = ring.pts.map((p) => {
        const x = Math.cos(p.a) * p.radius * grow;
        const z = Math.sin(p.a) * p.radius * grow;
        const y = 0;
        // apply ring tilt around X before global rotation
        const ty = y * Math.cos(ring.tilt) - z * Math.sin(ring.tilt);
        const tz = y * Math.sin(ring.tilt) + z * Math.cos(ring.tilt);
        return project(x, ty, tz, rYaw, pitch);
      });
      // arcs
      ctx.lineWidth = 1;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i], b = projected[(i + 1) % projected.length];
        const dep = (a.depth + 1.9) / 3.8;
        ctx.strokeStyle = `oklch(0.8 0.13 ${h} / ${(0.10 + dep * 0.22) * rv})`;
        ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
      }
      // node dots + a travelling pulse
      const pulseI = Math.floor((time * (8 + ri * 4)) % ring.count);
      projected.forEach((p, i) => {
        const dep = (p.depth + 1.9) / 3.8;
        const isPulse = i === pulseI;
        const r = (isPulse ? 2.6 : 1.1 + dep * 1.1) * rv;
        ctx.fillStyle = isPulse
          ? `oklch(0.95 0.16 ${h} / ${rv})`
          : `oklch(0.85 0.13 ${h} / ${(0.3 + dep * 0.5) * rv})`;
        ctx.beginPath(); ctx.arc(p.px, p.py, r, 0, Math.PI * 2); ctx.fill();
      });
    });

    // --- sphere core ---
    const proj = sphere.map((p) => {
      const pr = project(p.x * grow, p.y * grow, p.z * grow, yaw, pitch);
      pr.s = p.s; return pr;
    });
    // a subset of internal links for the "neural" look (nearest in screen space, front only)
    ctx.lineWidth = 1;
    for (let i = 0; i < proj.length; i += 3) {
      const a = proj[i];
      if (a.depth < -0.2) continue;
      // connect to next few that are close
      for (let j = i + 1; j < Math.min(i + 7, proj.length); j++) {
        const b = proj[j];
        const dx = a.px - b.px, dy = a.py - b.py;
        const d2 = dx * dx + dy * dy;
        if (d2 < (scale * 0.32) * (scale * 0.32)) {
          const dep = (a.depth + 1.6) / 3.2;
          ctx.strokeStyle = `oklch(0.8 0.13 ${h} / ${(0.05 + dep * 0.12) * rv})`;
          ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
        }
      }
    }
    // points (back to front)
    proj.sort((a, b) => a.depth - b.depth);
    proj.forEach((p) => {
      const dep = (p.depth + 1.6) / 3.2;
      const r = (0.7 + dep * 1.9 * p.s) * rv;
      ctx.fillStyle = `oklch(${0.7 + dep * 0.2} 0.14 ${h} / ${(0.25 + dep * 0.65) * rv})`;
      ctx.beginPath(); ctx.arc(p.px, p.py, r, 0, Math.PI * 2); ctx.fill();
    });

    // bright nucleus
    const nuc = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.5);
    nuc.addColorStop(0, `oklch(0.96 0.12 ${h} / ${0.5 * rv})`);
    nuc.addColorStop(0.5, `oklch(0.8 0.16 ${h} / ${0.14 * rv})`);
    nuc.addColorStop(1, "transparent");
    ctx.fillStyle = nuc;
    ctx.beginPath(); ctx.arc(cx, cy, scale * 0.5, 0, Math.PI * 2); ctx.fill();

    requestAnimationFrame(frame);
  }

  function staticFrame() {
    resize();
    reveal = 1;
    frame(performance.now());
    running = false;
  }

  // pointer reactivity across the whole page
  window.addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // gentle drift back to center when pointer leaves
  window.addEventListener("pointerleave", () => { mouse.tx = 0; mouse.ty = 0; });

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden && !reduced;
    if (running) requestAnimationFrame(frame);
  });

  window.addEventListener("resize", resize);

  resize();
  if (reduced) staticFrame();
  else requestAnimationFrame(frame);

  // expose hue setter for the success transition
  window.__setCoreHue = (hueVal) => {
    document.documentElement.style.setProperty("--accent-h", hueVal);
  };
})();

/* ============================================================
   PART 2 — KEYCLOAK ENTRY POINT
   This page is a gate, not an authenticator. By default it hands the
   user to their CRM, which authenticates them itself (direct mode).
   With CFG.directSsoWorkspace null it runs the launcher flow instead:
   the code exchange and the workspace routing happen on /dashboard
   (js/dashboard.js).
   ============================================================ */
(function auth() {
  const alertBox = document.getElementById("form-alert");
  const signedOut = document.getElementById("view-signed-out");
  const signedIn = document.getElementById("view-signed-in");
  const loginBtn = document.getElementById("login-btn");
  const continueBtn = document.getElementById("continue-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userEl = document.getElementById("session-user");

  function showAlert(msg, tone) {
    alertBox.querySelector("span").textContent = msg;
    alertBox.classList.toggle("ok", tone === "ok");
    alertBox.classList.add("show");
  }
  function clearAlert() { alertBox.classList.remove("show"); }

  function busy(btn, on) {
    btn.classList.toggle("loading", on);
    btn.disabled = on;
  }

  function show(view) {
    signedOut.hidden = view !== "out";
    signedIn.hidden = view !== "in";
  }

  /* ---- entry point ----
     Direct mode (the default, see CFG.directSsoWorkspace): hand the user
     to their CRM and let it authenticate them. Launcher mode: run our own
     Authorization Code + PKCE flow, then route on /dashboard. */
  const direct = DchatiAuth.directWorkspace();

  function startLogin(btn) {
    clearAlert();
    busy(btn, true);

    if (direct) {
      window.location.assign(direct.url);
      return;
    }

    DchatiAuth.login().catch((err) => {
      busy(btn, false);
      showAlert(err.message || DchatiAuth.messages.generic);
    });
  }

  loginBtn.addEventListener("click", () => startLogin(loginBtn));

  /* Already signed in -> in launcher mode /dashboard decides where this
     user's workspace is; in direct mode we already know. */
  continueBtn.addEventListener("click", () => {
    busy(continueBtn, true);
    window.location.assign(direct ? direct.url : "dashboard.html");
  });

  logoutBtn.addEventListener("click", () => DchatiAuth.logout());

  show("out");

  if (direct) {
    /* A launcher session left over from before this mode was turned on
       will never be refreshed or used again, so drop it rather than leave
       a stale refresh token sitting in localStorage. This clears local
       state only — the Keycloak SSO cookie is untouched, which is why the
       CRM's own flow still completes without asking for a password. */
    DchatiAuth.clearSession();
  } else {
    /* ---- session restoration on load ----
       A refresh of an expired access token happens inside getSession(),
       so a returning user lands straight on the signed-in view. */
    DchatiAuth.getSession()
      .then((session) => {
        if (!session) return show("out");
        userEl.textContent = DchatiAuth.displayName(session);
        show("in");
      })
      .catch(() => show("out"));
  }

  /* Keycloak sends the user back here after logout; say so plainly. */
  if (new URLSearchParams(window.location.search).has("logout")) {
    showAlert("Cerraste sesión correctamente.", "ok");
  }
})();
