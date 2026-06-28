/* Dchati landing — tweaks, scroll effects, micro-interactions */
(function () {
  // ---------- State (fixed from inline config) ----------
  const DEFAULTS = { accentHue: 245, particleDensity: 20, whatsappNumber: "" };
  const state = Object.assign({}, DEFAULTS, window.DCHATI_CONFIG || {});
  window.DCHATI_STATE = state;

  function applyHue() {
    document.documentElement.style.setProperty("--accent-h", state.accentHue);
  }

  function applyWhatsApp() {
    const num = (state.whatsappNumber || "").replace(/[^0-9]/g, "");
    document.querySelectorAll(".wa-link").forEach((a) => {
      a.href = num ? "https://wa.me/" + num : "#contacto";
    });
  }

  applyHue();
  applyWhatsApp();

  // Clear any stale tweak settings saved by earlier visits.
  try { localStorage.removeItem("dchati-tweaks"); } catch (e) {}

  // ---------- Mobile nav (no effect on desktop — toggle is hidden there) ----------
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.getElementById("nav-links");
  const navScrim = document.querySelector(".nav-scrim");
  if (navToggle && navLinks) {
    const setNav = (open) => {
      navLinks.classList.toggle("open", open);
      navToggle.classList.toggle("open", open);
      if (navScrim) navScrim.classList.toggle("open", open);
      document.body.classList.toggle("nav-open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    };
    navToggle.addEventListener("click", () => setNav(!navLinks.classList.contains("open")));
    if (navScrim) navScrim.addEventListener("click", () => setNav(false));
    navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setNav(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setNav(false); });
  }

  // ---------- Scroll: progress bar + compact nav ----------
  const progress = document.querySelector(".scroll-progress");
  const nav = document.querySelector(".nav");
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      nav.classList.toggle("scrolled", window.scrollY > 30);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- Scroll reveal (with stagger inside grids) ----------
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el, i) => {
    const siblings = el.parentElement ? Array.from(el.parentElement.children).filter((c) => c.classList.contains("reveal")) : [];
    const idx = siblings.indexOf(el);
    if (idx > 0) el.style.transitionDelay = Math.min(idx * 90, 360) + "ms";
    io.observe(el);
  });

  // ---------- Hero entrance: word-by-word headline ----------
  const h1 = document.querySelector(".hero h1");
  if (h1) {
    const frag = document.createDocumentFragment();
    let wordIdx = 0;
    for (const node of Array.from(h1.childNodes)) {
      const isEm = node.nodeType === 1 && node.tagName === "EM";
      const words = (node.textContent || "").split(/(\s+)/);
      for (const w of words) {
        if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(" ")); continue; }
        if (!w) continue;
        const span = document.createElement("span");
        span.className = "w" + (isEm ? " w-accent" : "");
        span.style.animationDelay = 0.12 + wordIdx * 0.07 + "s";
        span.textContent = w;
        frag.appendChild(span);
        wordIdx++;
      }
    }
    h1.textContent = "";
    h1.appendChild(frag);
    h1.classList.add("split");
  }

  // ---------- Card spotlight: glow follows the cursor ----------
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", e.clientX - r.left + "px");
      card.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });
})();
