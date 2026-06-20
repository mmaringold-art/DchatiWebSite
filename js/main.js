/* Dchati landing — tweaks, scroll effects, micro-interactions */
(function () {
  // ---------- State (defaults from inline config, overridden by localStorage) ----------
  const saved = JSON.parse(localStorage.getItem("dchati-tweaks") || "{}");
  const state = Object.assign({}, window.DCHATI_CONFIG, saved);
  window.DCHATI_STATE = state;

  function persist() {
    localStorage.setItem("dchati-tweaks", JSON.stringify({
      accentHue: state.accentHue,
      particleDensity: state.particleDensity,
      whatsappNumber: state.whatsappNumber,
    }));
  }

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

  // ---------- Tweaks panel ----------
  const toggle = document.querySelector(".tweaks-toggle");
  const panel = document.querySelector(".tweaks-panel");

  toggle.addEventListener("click", () => panel.classList.toggle("open"));

  const hueInput = document.getElementById("tw-hue");
  const densInput = document.getElementById("tw-density");
  const waInput = document.getElementById("tw-wa");

  hueInput.value = state.accentHue;
  densInput.value = state.particleDensity;
  waInput.value = state.whatsappNumber || "";

  hueInput.addEventListener("input", () => {
    state.accentHue = parseInt(hueInput.value, 10);
    applyHue();
    persist();
  });

  densInput.addEventListener("input", () => {
    state.particleDensity = parseInt(densInput.value, 10);
    window.dispatchEvent(new Event("dchati:density-changed"));
    persist();
  });

  waInput.addEventListener("change", () => {
    state.whatsappNumber = waInput.value.trim();
    applyWhatsApp();
    persist();
  });

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
