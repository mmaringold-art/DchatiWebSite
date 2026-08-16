/* ============================================================
   Dchati — /dashboard : OIDC callback + workspace routing
   ------------------------------------------------------------
   Three jobs, in order:
     1. If Keycloak just redirected here with ?code=..., exchange it
        for tokens using the PKCE verifier this tab stored.
     2. If there is no code, restore the stored session; if there is
        none, send the user to Keycloak (this page is protected).
     3. Decide where an authenticated user goes next.

   On (3), read the WORKSPACE-MAPPING note in js/auth.js: this page
   routes only on a workspace slug that Keycloak signed into the ID
   token, and it fails closed when that claim is absent. It does not
   invent a destination, because a wrong guess here means showing one
   company another company's CRM.
   ============================================================ */
(function () {
  "use strict";

  var REDIRECT_DELAY_MS = 2200;
  var LOOP_GUARD_KEY = "dchati.oidc.autologin";
  var LOOP_GUARD_WINDOW_MS = 30 * 1000;

  var el = {
    badge: document.getElementById("badge"),
    status: document.getElementById("status-line"),
    title: document.getElementById("title"),
    message: document.getElementById("message"),
    dest: document.getElementById("dest"),
    progress: document.getElementById("progress"),
    bar: document.getElementById("bar"),
    enter: document.getElementById("enter-btn"),
    retry: document.getElementById("retry-link"),
    logout: document.getElementById("logout-btn"),
  };

  function render(state) {
    el.badge.textContent = state.badge || "D";
    el.badge.classList.toggle("is-error", !!state.error);
    el.status.textContent = state.status;
    el.title.textContent = state.title;
    el.message.textContent = state.message;

    el.dest.hidden = !state.dest;
    if (state.dest) el.dest.textContent = state.dest;

    el.progress.hidden = !state.progress;
    el.enter.hidden = !state.enterHref;
    if (state.enterHref) el.enter.href = state.enterHref;

    el.retry.hidden = !state.retry;
    el.logout.hidden = !state.logout;
  }

  function showError(err) {
    render({
      badge: "!",
      error: true,
      status: "Acceso no completado",
      title: "No pudimos abrir tu sesión",
      message: (err && err.message) || DchatiAuth.messages.generic,
      retry: true,
    });
  }

  el.logout.addEventListener("click", function () {
    DchatiAuth.logout();
  });

  /* ---- authenticated: decide where this user actually goes ---- */
  function route(session) {
    var who = DchatiAuth.displayName(session);
    var ws = DchatiAuth.resolveWorkspace(session.claims);

    if (!ws) {
      /* Authenticated, but Keycloak did not assert a workspace. We stop
         here on purpose — see the note at the top of this file. */
      render({
        badge: who.charAt(0).toUpperCase(),
        status: "Identidad verificada",
        title: "Hola, " + who,
        message: DchatiAuth.messages.no_workspace,
        logout: true,
        retry: true,
      });
      return;
    }

    render({
      badge: ws.slug.charAt(0).toUpperCase(),
      status: "Acceso concedido",
      title: "Bienvenido a " + ws.slug,
      message: "Estamos abriendo el CRM de tu empresa…",
      dest: ws.url.replace(/^https?:\/\//, ""),
      progress: true,
      enterHref: ws.url,
      logout: true,
    });
    el.enter.focus();

    var start = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - start) / REDIRECT_DELAY_MS);
      el.bar.style.width = p * 100 + "%";
      if (p < 1) requestAnimationFrame(tick);
      else window.location.assign(ws.url);
    })(start);
  }

  /* ---- unauthenticated: bounce to Keycloak, but never in a loop ---- */
  function requireLogin() {
    var last = 0;
    try {
      last = Number(sessionStorage.getItem(LOOP_GUARD_KEY)) || 0;
    } catch (e) {}

    if (Date.now() - last < LOOP_GUARD_WINDOW_MS) {
      /* We just came back from Keycloak without a usable session —
         redirecting again would spin forever. */
      try { sessionStorage.removeItem(LOOP_GUARD_KEY); } catch (e) {}
      showError(new Error(DchatiAuth.messages.bad_state));
      return;
    }

    try { sessionStorage.setItem(LOOP_GUARD_KEY, String(Date.now())); } catch (e) {}

    render({
      status: "Acceso requerido",
      title: "Iniciando sesión…",
      message: "Te llevamos a auth.dchati.com para verificar tu identidad.",
    });
    DchatiAuth.login().catch(showError);
  }

  /* ---- entry ---- */
  if (DchatiAuth.isCallback()) {
    DchatiAuth.completeCallback()
      .then(function (session) {
        try { sessionStorage.removeItem(LOOP_GUARD_KEY); } catch (e) {}
        route(session);
      })
      .catch(showError);
  } else {
    DchatiAuth.getSession()
      .then(function (session) {
        if (session) {
          try { sessionStorage.removeItem(LOOP_GUARD_KEY); } catch (e) {}
          return route(session);
        }
        requireLogin();
      })
      .catch(showError);
  }
})();
