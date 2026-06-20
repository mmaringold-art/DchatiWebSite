/* Dchati — interactive chat demo.
   The visitor plays the customer: they type (or tap quick replies, in the
   style of WhatsApp Flows) and a scripted assistant routes intents through
   a small state machine: booking flow, features, pricing, human handoff. */
(function () {
  const body = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const hint = document.querySelector(".chat-hint");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = null;          // null | await_time | await_custom_date
  let booking = {};          // { date, time }
  let busy = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

  function waHref() {
    const num = ((window.DCHATI_STATE && window.DCHATI_STATE.whatsappNumber) || "").replace(/[^0-9]/g, "");
    return num ? "https://wa.me/" + num : "#contacto";
  }

  function scrollDown() {
    body.scrollTop = body.scrollHeight;
  }

  function addUser(text) {
    const el = document.createElement("div");
    el.className = "msg msg-user shown";
    el.textContent = text;
    body.appendChild(el);
    scrollDown();
  }

  function addBot(text, { note } = {}) {
    const el = document.createElement("div");
    el.className = "msg msg-bot shown" + (note ? " msg-note" : "");
    if (!note) {
      const tag = document.createElement("span");
      tag.className = "msg-tag";
      tag.textContent = "IA";
      el.appendChild(tag);
    }
    el.appendChild(document.createTextNode(text));
    body.appendChild(el);
    scrollDown();
  }

  /* WhatsApp Flows-style quick replies */
  function addReplies(options) {
    const wrap = document.createElement("div");
    wrap.className = "flow-replies shown";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flow-btn";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        if (busy || wrap.classList.contains("used")) return;
        wrap.classList.add("used");
        btn.classList.add("chosen");
        addUser(opt.label);
        handle(opt.intent || opt.label);
      });
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    scrollDown();
  }

  function addWaButton(label) {
    const wrap = document.createElement("div");
    wrap.className = "flow-replies shown";
    const a = document.createElement("a");
    a.className = "flow-btn flow-btn-solid";
    a.textContent = label;
    a.href = waHref();
    a.target = "_blank";
    a.rel = "noopener";
    wrap.appendChild(a);
    body.appendChild(wrap);
    scrollDown();
  }

  let typingEl = null;
  function showTyping() {
    typingEl = document.createElement("div");
    typingEl.className = "typing shown";
    typingEl.innerHTML = "<i></i><i></i><i></i>";
    body.appendChild(typingEl);
    scrollDown();
  }
  function hideTyping() {
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  async function botSay(text, opts) {
    showTyping();
    await sleep(Math.min(450 + text.length * 14, 1700));
    hideTyping();
    addBot(text, opts);
  }

  function setBusy(b) {
    busy = b;
    sendBtn.disabled = b;
  }

  const MENU = [
    { label: "Agendar una cita", intent: "#booking" },
    { label: "¿Qué hace Dchati?", intent: "#features" },
    { label: "Precios", intent: "#pricing" },
  ];

  /* ---------- intent routing ---------- */
  function detectIntent(text) {
    const t = text.toLowerCase();
    if (t.startsWith("#")) return t;
    if (/\b(cita|turno|agendar|reserva|reservar|visita|hora)\b/.test(t)) return "#booking";
    if (/\b(precio|precios|costo|costos|plan|planes|tarifa|cuánto|cuanto)\b/.test(t)) return "#pricing";
    if (/\b(funci|servici|hace|hacen|info|cómo|como|crm|qué es|que es)\b/.test(t)) return "#features";
    if (/\b(humano|persona|asesor|agente|equipo|hablar con)\b/.test(t)) return "#human";
    if (/\b(hola|buenas|buenos|hey|saludos)\b/.test(t)) return "#greet";
    if (/\b(gracias|perfecto|genial|ok|listo)\b/.test(t)) return "#thanks";
    return "#fallback";
  }

  async function handle(raw) {
    setBusy(true);

    /* mid-flow states take the raw text */
    if (state === "await_custom_date") {
      booking.date = raw.replace(/^#/, "");
      state = "await_time";
      await botSay(`Perfecto, ${booking.date}. ¿A qué hora te queda mejor?`);
      addReplies([
        { label: "10:30", intent: "#t-10:30" },
        { label: "13:00", intent: "#t-13:00" },
        { label: "16:00", intent: "#t-16:00" },
      ]);
      setBusy(false);
      return;
    }

    if (state === "await_time") {
      let time = null;
      if (/^#t-/.test(raw)) {
        time = raw.slice(3);
      } else {
        const m = raw.match(/\d{1,2}([:.h]\d{2})?/);
        if (m) time = m[0].replace(/[.h]/, ":");
      }
      if (!time) {
        await botSay("No reconocí esa hora — elige una opción o escribe algo como «16:00».");
        setBusy(false);
        return;
      }
      booking.time = time;
      state = null;
      await botSay(`Listo ✓ Tu cita quedó agendada para ${booking.date} a las ${booking.time}. Te enviaré un recordatorio una hora antes.`);
      await botSay("En producción, esta reserva se crea en tu CRM y la confirmación llega por WhatsApp real.", { note: true });
      addReplies([
        { label: "Agendar otra cita", intent: "#booking" },
        { label: "¿Qué más hace Dchati?", intent: "#features" },
      ]);
      setBusy(false);
      return;
    }

    const intent = detectIntent(raw);

    switch (intent) {
      case "#booking":
        booking = {};
        await botSay("¡Claro! ¿Para qué día quieres la cita?");
        addReplies([
          { label: "Hoy", intent: "#d-hoy" },
          { label: "Mañana", intent: "#d-mañana" },
          { label: "Otro día", intent: "#d-otro" },
        ]);
        break;

      case "#d-hoy":
      case "#d-mañana":
        booking.date = intent === "#d-hoy" ? "hoy" : "mañana";
        state = "await_time";
        await botSay(`Genial, ${booking.date}. Tengo estos horarios disponibles:`);
        addReplies([
          { label: "10:30", intent: "#t-10:30" },
          { label: "13:00", intent: "#t-13:00" },
          { label: "16:00", intent: "#t-16:00" },
        ]);
        break;

      case "#d-otro":
        state = "await_custom_date";
        await botSay("Sin problema — escríbeme el día que prefieras.");
        break;

      case "#features":
        await botSay("Respondo a tus clientes 24/7, califico leads, agendo citas y envío seguimientos. Todo queda registrado en un CRM con contactos, historial, reservas y campañas.");
        await botSay("Esta conversación es un ejemplo: estás chateando con el mismo tipo de asistente que Dchati configura para tu negocio.");
        addReplies([
          { label: "Agendar una cita", intent: "#booking" },
          { label: "Precios", intent: "#pricing" },
          { label: "Hablar con un humano", intent: "#human" },
        ]);
        break;

      case "#pricing":
        await botSay("Los planes dependen del tamaño de tu equipo y el volumen de conversaciones. Cuéntanos de tu negocio y armamos uno a tu medida.");
        addWaButton("Hablar por WhatsApp");
        break;

      case "#human":
        await botSay("Perfecto — te dejo el contacto directo del equipo. Un humano te responde por WhatsApp:");
        addWaButton("Escribir al equipo");
        break;

      case "#greet":
        await botSay("¡Hola! ¿En qué te ayudo hoy?");
        addReplies(MENU);
        break;

      case "#thanks":
        await botSay("¡A ti! Si quieres ver esto funcionando en tu propio número, escríbenos.");
        addWaButton("Hablar por WhatsApp");
        break;

      default:
        await botSay("Puedo ayudarte a agendar una cita o contarte qué hace Dchati. También entiendo «precios» o «humano».");
        addReplies(MENU);
    }
    setBusy(false);
  }

  /* ---------- input ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    if (hint) hint.classList.add("hidden");
    addUser(text);
    handle(text);
  });

  input.addEventListener("focus", () => {
    if (hint) hint.classList.add("hidden");
  });

  /* ---------- opening sequence ---------- */
  (async () => {
    await sleep(900);
    setBusy(true);
    await botSay("¡Hola! Soy el asistente IA de Dchati. Pruébame: escríbeme algo o elige una opción.");
    addReplies(MENU);
    setBusy(false);
  })();
})();
