/* ============================================================
   Dchati — Plataforma (login)
   1) Floating AI core (mouse-reactive particle sphere + neural rings)
   2) Auth flow that resolves email/organization -> company CRM
   ============================================================ */

/* ------------------------------------------------------------
   AUTH CONFIG
   Real authentication via Supabase Auth (see js/supabase-config.js).
   Passwords are verified server-side by Supabase (hashed with bcrypt).
   The user's workspace is read from the database under Row-Level
   Security: the client cannot see workspaces it doesn't belong to.
   No credentials or workspace directory live in this file.
   ------------------------------------------------------------ */
const CONFIG = {
  performRedirect: true,    // real auth -> navigate to the resolved CRM
  redirectDelayMs: 2600,
};

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
   PART 2 — AUTH + ROUTING
   ============================================================ */
(function auth() {
  const form = document.getElementById("login-form");
  const email = document.getElementById("email");
  const pw = document.getElementById("password");
  const emailErr = document.getElementById("email-error");
  const pwErr = document.getElementById("password-error");
  const alert = document.getElementById("form-alert");
  const submit = document.getElementById("submit-btn");
  const toggle = document.querySelector(".toggle-pw");

  // show/hide password
  toggle.addEventListener("click", () => {
    const showing = pw.type === "text";
    pw.type = showing ? "password" : "text";
    toggle.setAttribute("aria-label", showing ? "Mostrar contraseña" : "Ocultar contraseña");
    toggle.setAttribute("aria-pressed", String(!showing));
    toggle.innerHTML = showing ? EYE : EYE_OFF;
    pw.focus();
  });

  function setError(input, errEl, msg) {
    if (msg) {
      input.setAttribute("aria-invalid", "true");
      errEl.textContent = msg;
      errEl.classList.add("show");
    } else {
      input.removeAttribute("aria-invalid");
      errEl.classList.remove("show");
    }
  }

  function showAlert(msg) {
    alert.querySelector("span").textContent = msg;
    alert.classList.add("show");
  }
  function clearAlert() { alert.classList.remove("show"); }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // clear errors as the user fixes them
  email.addEventListener("input", () => setError(email, emailErr, ""));
  pw.addEventListener("input", () => setError(pw, pwErr, ""));

  /* ---- the authentication step (Supabase Auth + RLS workspace lookup) ----
     1) Supabase verifies the password server-side (bcrypt).
     2) We read the user's workspace. Row-Level Security guarantees the
        query can only return a workspace the user is a member of — the
        client never chooses or sees another company's data. */
  async function authenticate(addr, secret) {
    const sb = window.DCHATI_SB;
    if (!sb || !sb.configured) throw { code: "not-configured" };

    const { error: authErr } = await sb.client.auth.signInWithPassword({
      email: addr,
      password: secret,
    });
    if (authErr) throw { code: "bad-credentials" };

    const { data, error } = await sb.client
      .from("workspaces")
      .select("name, slug, hue, dashboard_url")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      await sb.client.auth.signOut();
      throw { code: "no-org" };
    }
    return { name: data.name, slug: data.slug, hue: data.hue, dashboard: data.dashboard_url };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlert();

    const addr = email.value.trim();
    const secret = pw.value;
    let ok = true;

    if (!emailRe.test(addr)) { setError(email, emailErr, "Introduce un correo válido."); ok = false; }
    if (secret.length < 6) { setError(pw, pwErr, "La contraseña debe tener al menos 6 caracteres."); ok = false; }
    if (!ok) { (addr && !emailRe.test(addr) ? email : pw).focus(); return; }

    submit.classList.add("loading");
    submit.disabled = true;

    try {
      const ws = await authenticate(addr, secret);
      launchWorkspace(ws);
    } catch (err) {
      submit.classList.remove("loading");
      submit.disabled = false;
      if (err.code === "not-configured") {
        showAlert("El acceso aún no está disponible. Escríbenos por WhatsApp y te damos de alta.");
      } else if (err.code === "no-org") {
        showAlert("No encontramos una empresa asociada a esta cuenta.");
        setError(email, emailErr, "");
        email.focus();
      } else {
        showAlert("Correo o contraseña incorrectos. Inténtalo de nuevo.");
        pw.focus();
        pw.select();
      }
    }
  });

  /* ---- success: recolor the core to the company hue, show overlay,
          then route to that company's CRM ---- */
  function launchWorkspace(ws) {
    if (window.__setCoreHue && typeof ws.hue === "number") {
      window.__setCoreHue(ws.hue);
      document.querySelector(".pane-right").style.setProperty("--hue-shift", (ws.hue - 250) + "deg");
    }

    const overlay = document.getElementById("success");
    const badge = document.getElementById("success-badge");
    const nameEl = document.getElementById("success-name");
    const destEl = document.getElementById("success-dest");
    const bar = document.getElementById("success-bar");
    const enterBtn = document.getElementById("enter-btn");

    badge.textContent = ws.name.charAt(0).toUpperCase();
    badge.style.background = `oklch(0.78 0.15 ${ws.hue})`;
    badge.style.color = "oklch(0.14 0.03 250)";
    nameEl.textContent = ws.name;
    const url = ws.dashboard || ("https://app.dchati.com/" + ws.slug);
    destEl.textContent = url.replace(/^https?:\/\//, "");
    enterBtn.href = url;

    overlay.classList.add("show");
    enterBtn.focus();

    // progress bar -> redirect
    const dur = CONFIG.redirectDelayMs;
    const start = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      bar.style.width = (p * 100) + "%";
      if (p < 1) requestAnimationFrame(tick);
      else if (CONFIG.performRedirect) window.location.href = url;
    })(start);
  }

  // icons
  const EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13 13 0 0 1-2.16 2.92M6.1 6.1A13 13 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 4.06-.94M1 1l22 22"/><path d="M9.5 9.5a3 3 0 0 0 4.2 4.2"/></svg>';
  toggle.innerHTML = EYE;

  /* ---- inert links (e.g. "forgot password") never navigate ---- */
  document.querySelectorAll("[data-noop]").forEach((el) => {
    el.addEventListener("click", (e) => e.preventDefault());
  });
})();
