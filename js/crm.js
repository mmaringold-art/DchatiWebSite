/* ============================================================
   Dchati — embedded interactive CRM demo (no backend).
   Sidebar navigation swaps content panels with smooth transitions.
   Contacts, conversations and the AI assistant are clickable.
   ============================================================ */
(function () {
  const navEl = document.getElementById("crm-nav");
  const panelsEl = document.getElementById("crm-panels");
  const titleEl = document.getElementById("crm-title");
  const searchLabel = document.getElementById("crm-search-label");
  if (!navEl || !panelsEl) return;

  /* ---------- icons ---------- */
  const ICON = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    contactos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 8.5a3 3 0 0 1 0 0M17 5a3 3 0 0 1 0 6M20.5 20a4.8 4.8 0 0 0-3.2-4.5"/></svg>',
    conversaciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z"/></svg>',
    campanas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 18-7v16l-18-7v-2Z"/><path d="M7 13v4a2 2 0 0 0 4 0"/></svg>',
    ia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="7" width="14" height="11" rx="3"/><path d="M12 7V4M9 13v1M15 13v1M2 12v2M22 12v2"/></svg>',
    analiticas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6"/></svg>',
  };

  const NAV = [
    { id: "dashboard", label: "Panel", title: "Panel", search: "Buscar en Dchati…" },
    { id: "contactos", label: "Contactos", title: "Contactos", search: "Buscar contactos…", badge: "1.2k" },
    { id: "conversaciones", label: "Conversaciones", title: "Conversaciones", search: "Buscar conversaciones…", badge: "8" },
    { id: "campanas", label: "Campañas", title: "Campañas", search: "Buscar campañas…" },
    { id: "ia", label: "Asistente IA", title: "Asistente IA", search: "Buscar automatizaciones…" },
    { id: "analiticas", label: "Analíticas", title: "Analíticas", search: "Buscar métricas…" },
  ];

  /* ---------- demo data ---------- */
  const HUES = [85, 150, 195, 322, 265, 30];
  const av = (i) => `oklch(0.78 0.14 ${HUES[i % HUES.length]})`;

  const CONTACTS = [
    { init: "MF", name: "María Fernández", company: "Inmobiliaria Sur", channel: "WhatsApp", when: "hace 5 min", status: "lead",
      phone: "+34 612 84 33 21", email: "maria.f@inmosur.es", agent: "Asistente IA", lifecycle: "Lead calificado",
      tags: ["Compra", "Zona centro", "Alta prioridad"], note: "Interesada en pisos de 2 habitaciones. Pidió visita para el sábado." },
    { init: "CO", name: "Carlos Ortega", company: "—", channel: "WhatsApp", when: "hace 22 min", status: "cliente",
      phone: "+34 655 19 02 88", email: "c.ortega@gmail.com", agent: "Laura G.", lifecycle: "Cliente activo",
      tags: ["Recurrente", "Postventa"], note: "Cliente desde 2024. Renovó contrato de servicio el mes pasado." },
    { init: "LM", name: "Lucía Méndez", company: "Clínica Dental Vita", channel: "WhatsApp", when: "hace 1 h", status: "activo",
      phone: "+34 699 47 56 10", email: "lucia@clinicavita.es", agent: "Asistente IA", lifecycle: "En conversación",
      tags: ["Cita", "Ortodoncia"], note: "Solicitó presupuesto de ortodoncia. La IA envió el formulario." },
    { init: "JR", name: "Javier Ríos", company: "—", channel: "WhatsApp", when: "hace 2 h", status: "lead",
      phone: "+34 677 33 21 09", email: "javier.rios@outlook.com", agent: "Sin asignar", lifecycle: "Lead nuevo",
      tags: ["Información", "Frío"], note: "Llegó por campaña de primavera. Aún sin respuesta a la oferta." },
    { init: "AB", name: "Ana Beltrán", company: "Salón Aura", channel: "WhatsApp", when: "ayer", status: "cliente",
      phone: "+34 644 88 77 12", email: "ana@salonaura.com", agent: "Laura G.", lifecycle: "Cliente activo",
      tags: ["VIP", "Mensual"], note: "Reserva cita cada mes. Prefiere los viernes por la tarde." },
    { init: "DS", name: "Diego Salas", company: "—", channel: "WhatsApp", when: "ayer", status: "activo",
      phone: "+34 622 10 45 67", email: "diego.salas@gmail.com", agent: "Asistente IA", lifecycle: "En seguimiento",
      tags: ["Presupuesto", "Negociación"], note: "Pidió descuento por volumen. Pendiente de aprobación del equipo." },
  ];

  const CONVOS = [
    { init: "MF", name: "María Fernández", preview: "¿La cita de mañana sigue en pie?", when: "10:24", unread: 2,
      msgs: [
        { f: "them", t: "Hola, vi el piso del centro que publicaron" },
        { f: "me", ai: true, t: "¡Hola María! Sí, sigue disponible. ¿Quieres agendar una visita?" },
        { f: "them", t: "Sí, ¿mañana por la tarde?" },
        { f: "me", ai: true, t: "Perfecto, tengo las 17:00 o 18:30 libres. ¿Cuál prefieres?" },
        { f: "them", t: "¿La cita de mañana sigue en pie?" },
      ], suggest: "Confirmar visita y enviar ubicación del inmueble" },
    { init: "LM", name: "Lucía Méndez", preview: "Gracias, ¿cuánto costaría?", when: "09:58", unread: 0,
      msgs: [
        { f: "them", t: "Quería información sobre ortodoncia invisible" },
        { f: "me", ai: true, t: "Claro, te envío el formulario para una valoración gratuita." },
        { f: "them", t: "Gracias, ¿cuánto costaría?" },
      ], suggest: "Compartir rango de precios y ofrecer cita de valoración" },
    { init: "DS", name: "Diego Salas", preview: "¿Tienen descuento por volumen?", when: "ayer", unread: 0,
      msgs: [
        { f: "them", t: "Necesito 20 unidades del plan" },
        { f: "me", ai: true, t: "Genial. Para 20+ aplicamos tarifa especial. Te paso la propuesta." },
        { f: "them", t: "¿Tienen descuento por volumen?" },
      ], suggest: "Escalar al equipo comercial para aprobar descuento" },
    { init: "JR", name: "Javier Ríos", preview: "Lo voy a pensar, gracias", when: "ayer", unread: 0,
      msgs: [
        { f: "me", ai: true, t: "Hola Javier, vimos tu interés en la promo de primavera 🌱" },
        { f: "them", t: "Lo voy a pensar, gracias" },
      ], suggest: "Programar seguimiento automático en 3 días" },
  ];

  const CAMPAIGNS = [
    { name: "Reactivación de clientes", status: "activa", audience: "1.240 contactos", sent: 100, opened: 68, replied: 31 },
    { name: "Promo Primavera", status: "programada", audience: "860 contactos", sent: 0, opened: 0, replied: 0 },
    { name: "Seguimiento post-visita", status: "activa", audience: "315 contactos", sent: 100, opened: 74, replied: 42 },
    { name: "Encuesta de satisfacción", status: "finalizada", audience: "2.050 contactos", sent: 100, opened: 81, replied: 56 },
  ];

  const AI_CAPS = [
    { b: "Responder preguntas frecuentes", s: "Horarios, precios, ubicación y dudas comunes.", on: true },
    { b: "Calificar leads automáticamente", s: "Detecta intención de compra y prioriza.", on: true },
    { b: "Agendar citas", s: "Propone horarios y confirma en el chat.", on: true },
    { b: "Seguimientos automáticos", s: "Retoma conversaciones frías por su cuenta.", on: false },
  ];

  /* ---------- renderers ---------- */
  function elFrom(html) {
    const d = document.createElement("div");
    d.className = "crm-panel";
    d.innerHTML = html;
    return d;
  }

  function renderDashboard() {
    const days = ["L", "M", "X", "J", "V", "S", "D"];
    const vals = [62, 78, 70, 95, 88, 54, 40];
    const max = Math.max(...vals);
    const bars = vals.map((v, i) =>
      `<div class="bar" data-h="${Math.round((v / max) * 100)}" style="height:0"><span>${v}</span></div>`).join("");
    const feed = [
      ["Nuevo lead calificado", "María Fernández · Inmobiliaria Sur", "5 min"],
      ["Cita agendada", "Lucía Méndez · mañana 17:00", "18 min"],
      ["Campaña enviada", "Reactivación de clientes · 1.240 envíos", "1 h"],
      ["Conversación asignada", "Diego Salas → Laura G.", "2 h"],
      ["Seguimiento automático", "Javier Ríos · programado en 3 días", "ayer"],
    ].map(([t, m, w]) => `<div class="feed-item"><div class="feed-dot"></div><div><div class="ft">${t}</div><div class="fm">${m}</div></div><div class="fwhen">${w}</div></div>`).join("");

    return elFrom(`
      <div class="kpi-grid">
        <div class="kpi"><div class="l">Conversaciones hoy</div><div class="v" data-count="248">0</div><div class="d up">▲ 12% vs ayer</div></div>
        <div class="kpi"><div class="l">Leads nuevos</div><div class="v" data-count="37">0</div><div class="d up">▲ 8% vs ayer</div></div>
        <div class="kpi"><div class="l">Citas agendadas</div><div class="v" data-count="19">0</div><div class="d up">▲ 5 esta semana</div></div>
        <div class="kpi"><div class="l">Tasa de respuesta</div><div class="v" data-count="94" data-suffix="%">0</div><div class="d up">▲ 2 pts</div></div>
      </div>
      <div class="dash-cols">
        <div class="crm-card">
          <div class="crm-h">Conversaciones · últimos 7 días</div>
          <div class="bars">${bars}</div>
          <div class="bars-x">${days.map((d) => `<span>${d}</span>`).join("")}</div>
        </div>
        <div class="crm-card">
          <div class="crm-h">Actividad reciente</div>
          <div class="feed">${feed}</div>
        </div>
      </div>`);
  }

  function contactRow(c, i, sel) {
    return `<div class="crow ${sel ? "sel" : ""}" data-ci="${i}">
      <div class="cavatar" style="background:${av(i)}">${c.init}</div>
      <div><div class="cn">${c.name}</div><div class="cmeta">${c.company !== "—" ? c.company + " · " : ""}${c.channel}</div></div>
      <div><div class="cwhen">${c.when}</div><span class="pill ${c.status}">${c.status[0].toUpperCase() + c.status.slice(1)}</span></div>
    </div>`;
  }

  function contactDetail(i) {
    const c = CONTACTS[i];
    return `<div class="cdetail crm-card">
      <div class="cd-head">
        <div class="cd-avatar" style="background:${av(i)}">${c.init}</div>
        <div><h4>${c.name}</h4><div class="cmeta" style="color:var(--ink-dim);font-size:13px">${c.lifecycle}</div></div>
      </div>
      <div class="cd-row"><span>Teléfono</span><span>${c.phone}</span></div>
      <div class="cd-row"><span>Email</span><span>${c.email}</span></div>
      <div class="cd-row"><span>Empresa</span><span>${c.company}</span></div>
      <div class="cd-row"><span>Canal</span><span>${c.channel}</span></div>
      <div class="cd-row"><span>Responsable</span><span>${c.agent}</span></div>
      <div class="cd-tags">${c.tags.map((t) => `<span class="pill activo">${t}</span>`).join("")}</div>
      <div class="cd-note">📝 ${c.note}</div>
    </div>`;
  }

  function renderContacts() {
    const rows = CONTACTS.map((c, i) => contactRow(c, i, i === 0)).join("");
    const panel = elFrom(`<div class="contacts-layout">
      <div class="ctable">${rows}</div>
      <div class="cdetail-wrap">${contactDetail(0)}</div>
    </div>`);
    panel.addEventListener("click", (e) => {
      const row = e.target.closest(".crow");
      if (!row) return;
      panel.querySelectorAll(".crow").forEach((r) => r.classList.remove("sel"));
      row.classList.add("sel");
      panel.querySelector(".cdetail-wrap").innerHTML = contactDetail(+row.dataset.ci);
    });
    return panel;
  }

  function convThread(i) {
    const c = CONVOS[i];
    const body = c.msgs.map((m) =>
      `<div class="cmsg ${m.f}">${m.ai ? '<span class="tag">IA</span>' : ""}${m.t}</div>`).join("");
    return `<div class="conv-thead">
        <div class="cavatar" style="width:34px;height:34px;font-size:13px;background:${av(i)}">${c.init}</div>
        <div><div class="cn">${c.name}</div><div class="st">● en línea con IA</div></div>
      </div>
      <div class="conv-body">${body}</div>
      <div class="conv-suggest">💡 <b>La IA sugiere:</b> ${c.suggest}</div>`;
  }

  function renderConversations() {
    const list = CONVOS.map((c, i) =>
      `<div class="conv-item ${i === 0 ? "sel" : ""}" data-vi="${i}">
        <div class="cavatar" style="width:36px;height:36px;font-size:13px;background:${av(i)}">${c.init}</div>
        <div><div class="cn">${c.name}</div><div class="cp">${c.preview}</div></div>
        <div style="text-align:right"><div class="cw">${c.when}</div>${c.unread ? `<span class="conv-unread">${c.unread}</span>` : ""}</div>
      </div>`).join("");
    const panel = elFrom(`<div class="conv-layout">
      <div class="conv-list">${list}</div>
      <div class="conv-thread" id="conv-thread">${convThread(0)}</div>
    </div>`);
    panel.addEventListener("click", (e) => {
      const item = e.target.closest(".conv-item");
      if (!item) return;
      panel.querySelectorAll(".conv-item").forEach((r) => r.classList.remove("sel"));
      item.classList.add("sel");
      const unread = item.querySelector(".conv-unread");
      if (unread) unread.remove();
      const thread = panel.querySelector("#conv-thread");
      thread.style.opacity = 0;
      setTimeout(() => { thread.innerHTML = convThread(+item.dataset.vi); thread.style.opacity = 1; }, 160);
    });
    return panel;
  }

  function renderCampaigns() {
    const cards = CAMPAIGNS.map((c) => `<div class="crm-card camp-card">
      <div class="camp-top">
        <div><h4>${c.name}</h4><div class="aud">${c.audience}</div></div>
        <span class="pill ${c.status}">${c.status[0].toUpperCase() + c.status.slice(1)}</span>
      </div>
      <div class="camp-stats">
        <div class="camp-stat"><div class="row"><span>Enviados</span><span>${c.sent}%</span></div><div class="track"><i data-w="${c.sent}"></i></div></div>
        <div class="camp-stat"><div class="row"><span>Abiertos</span><span>${c.opened}%</span></div><div class="track"><i data-w="${c.opened}"></i></div></div>
        <div class="camp-stat"><div class="row"><span>Respondidos</span><span>${c.replied}%</span></div><div class="track"><i data-w="${c.replied}"></i></div></div>
      </div>
    </div>`).join("");
    return elFrom(`<div class="camp-grid">${cards}</div>`);
  }

  function renderAI() {
    const caps = AI_CAPS.map((c, i) =>
      `<div class="ai-cap"><div class="txt"><b>${c.b}</b><span>${c.s}</span></div><button class="switch ${c.on ? "on" : ""}" data-cap="${i}" role="switch" aria-checked="${c.on}" aria-label="${c.b}"></button></div>`).join("");
    const panel = elFrom(`<div class="ai-layout">
      <div class="crm-card">
        <div class="crm-h">Capacidades del asistente</div>
        ${caps}
      </div>
      <div>
        <div class="crm-card" style="margin-bottom:14px">
          <div class="crm-h">Comportamiento</div>
          <p style="font-size:13.5px;color:var(--ink-dim);line-height:1.55">Tono cercano y profesional. Responde en segundos, agenda citas y deriva a una persona cuando detecta una negociación o una queja.</p>
        </div>
        <div class="ai-preview">
          <div class="ai-bubble"><div class="q">Cliente:</div><div class="a">¿Atienden los sábados?</div></div>
          <div class="ai-bubble"><div class="q"><b style="color:var(--accent)">IA · respuesta automática</b></div><div class="a">¡Sí! Abrimos sábados de <b>10:00 a 14:00</b>. ¿Quieres que te reserve una cita?</div></div>
        </div>
      </div>
    </div>`);
    panel.addEventListener("click", (e) => {
      const sw = e.target.closest(".switch");
      if (!sw) return;
      const on = sw.classList.toggle("on");
      sw.setAttribute("aria-checked", String(on));
    });
    return panel;
  }

  function renderAnalytics() {
    const weeks = [40, 55, 48, 70, 62, 85, 78, 96];
    const max = Math.max(...weeks);
    const bars = weeks.map((v) => `<div class="bar" data-h="${Math.round((v / max) * 100)}" style="height:0"></div>`).join("");
    const breakdown = [
      ["Agendar cita", 42], ["Información de producto", 28], ["Soporte", 18], ["Otros", 12],
    ].map(([l, v]) => `<div class="breakdown-row"><div class="row"><span>${l}</span><span>${v}%</span></div><div class="track"><i data-w="${v}"></i></div></div>`).join("");
    return elFrom(`
      <div class="metric-grid">
        <div class="metric"><div class="l">Conversaciones (mes)</div><div class="v" data-count="6240">0</div></div>
        <div class="metric"><div class="l">Tiempo medio resp.</div><div class="v">8s</div></div>
        <div class="metric"><div class="l">Tasa de conversión</div><div class="v" data-count="31" data-suffix="%">0</div></div>
        <div class="metric"><div class="l">Citas agendadas</div><div class="v" data-count="412">0</div></div>
      </div>
      <div class="ana-cols">
        <div class="crm-card">
          <div class="crm-h">Conversaciones por semana</div>
          <div class="bars">${bars}</div>
        </div>
        <div class="crm-card">
          <div class="crm-h">Intención de los mensajes</div>
          ${breakdown}
        </div>
      </div>`);
  }

  const RENDERERS = {
    dashboard: renderDashboard,
    contactos: renderContacts,
    conversaciones: renderConversations,
    campanas: renderCampaigns,
    ia: renderAI,
    analiticas: renderAnalytics,
  };

  /* ---------- build nav + panels ---------- */
  const panels = {};
  NAV.forEach((n) => {
    const btn = document.createElement("button");
    btn.className = "crm-navitem" + (n.id === "dashboard" ? " active" : "");
    btn.dataset.go = n.id;
    if (n.id === "dashboard") btn.setAttribute("aria-current", "page");
    btn.innerHTML = `${ICON[n.id]}<span class="label-hide">${n.label}</span>${n.badge ? `<span class="badge">${n.badge}</span>` : ""}`;
    navEl.appendChild(btn);

    const panel = RENDERERS[n.id]();
    if (n.id === "dashboard") panel.classList.add("active");
    panels[n.id] = panel;
    panelsEl.appendChild(panel);
  });

  /* ---------- animations triggered on panel show ---------- */
  function animateValue(el) {
    const to = +el.dataset.count;
    const suffix = el.dataset.suffix || "";
    const dur = 900;
    const start = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(to * eased);
      el.textContent = val.toLocaleString("es-ES") + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  function playPanelAnims(panel) {
    panel.querySelectorAll("[data-count]").forEach(animateValue);
    panel.querySelectorAll(".bar[data-h]").forEach((b, i) => {
      b.style.height = "0";
      setTimeout(() => { b.style.height = b.dataset.h + "%"; }, 60 + i * 45);
    });
    panel.querySelectorAll(".track i[data-w]").forEach((t, i) => {
      t.style.width = "0";
      setTimeout(() => { t.style.width = t.dataset.w + "%"; }, 120 + i * 80);
    });
  }

  /* ---------- navigation ---------- */
  let current = "dashboard";
  function go(id) {
    if (id === current) return;
    panels[current].classList.remove("active");
    panels[id].classList.add("active");
    navEl.querySelectorAll(".crm-navitem").forEach((b) => {
      const on = b.dataset.go === id;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    const meta = NAV.find((n) => n.id === id);
    titleEl.textContent = meta.title;
    if (searchLabel) searchLabel.textContent = meta.search;
    current = id;
    playPanelAnims(panels[id]);
  }

  navEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".crm-navitem");
    if (btn) go(btn.dataset.go);
  });

  /* ---------- play dashboard anims when the section first scrolls in ---------- */
  let started = false;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting && !started) {
        started = true;
        playPanelAnims(panels.dashboard);
        obs.disconnect();
      }
    });
  }, { threshold: 0.25 });
  obs.observe(document.getElementById("crm"));
})();
