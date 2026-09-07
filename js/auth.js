/* ============================================================
   Dchati — OpenID Connect client (Keycloak)
   Authorization Code flow + PKCE S256, public client, no secret.
   Plain ES2017 in a browser <script> — no build step, no framework.
   ------------------------------------------------------------
   Flow implemented here:

     1. login()      generates a random code_verifier, derives the
                     S256 code_challenge with crypto.subtle, stores
                     the verifier + state + nonce in sessionStorage,
                     then navigates to Keycloak's /auth endpoint.
     2. Keycloak     authenticates the user and redirects back to the
                     fixed redirect_uri with ?code=...&state=...
     3. callback()   verifies state, POSTs the code + the ORIGINAL
                     code_verifier to /token, validates the ID token's
                     iss/aud/nonce/exp, and stores the session.
     4. session()    restores the session on later page loads and
                     silently refreshes an expired access token.
     5. logout()     clears local state and hits Keycloak's
                     /logout endpoint so the SSO session ends too.

   The whole flow above is bypassed when CFG.directSsoWorkspace is set:
   platform.html then hands the user straight to that CRM, which
   authenticates them with a flow of its own. See directWorkspace().

   WORKSPACE-MAPPING NOTE
   ----------------------
   Authentication (who is this?) and authorization (which workspace
   may they open?) are deliberately separate here. This client routes a
   user only on the `organization` claim Keycloak signs into the ID
   token, and it does not build the destination from that claim: it
   looks the alias up in a fixed registry (CFG.workspaces). It never
   accepts a workspace identifier from the URL, from storage written by
   another page, or from user input. An absent, ambiguous or unknown
   organization fails closed — see resolveWorkspace().
   ============================================================ */
(function (global) {
  "use strict";

  var CFG = global.DCHATI_AUTH_CONFIG;
  if (!CFG) throw new Error("DCHATI_AUTH_CONFIG must load before auth.js");

  var ENDPOINTS = {
    authorize: CFG.issuer + "/protocol/openid-connect/auth",
    token: CFG.issuer + "/protocol/openid-connect/token",
    logout: CFG.issuer + "/protocol/openid-connect/logout",
  };

  /* ---- how long a half-finished login may sit before we discard it ---- */
  var TX_MAX_AGE_MS = 10 * 60 * 1000;
  /* refresh the access token this long before it actually expires */
  var EXPIRY_SKEW_MS = 30 * 1000;

  /* Host of a configured URL, for user-facing text that has to name a
     server. Derived, never written twice: a message that hardcodes a
     domain is a message that goes stale the next time the environment
     changes, which is exactly how this file ended up naming production
     hosts while the site ran on dev. */
  function hostOf(url) {
    try {
      return new URL(url).host;
    } catch (e) {
      return "";
    }
  }

  /* ============================================================
     Errors — every message is user-facing Spanish.
     ============================================================ */
  var MESSAGES = {
    insecure:
      "El acceso seguro necesita HTTPS. Abrí el sitio en " + CFG.siteOrigin + " e intentá de nuevo.",
    network:
      "No pudimos contactar al servidor de identidad. Revisá tu conexión e intentá de nuevo.",
    expired_code:
      "El enlace de acceso caducó o ya se había usado. Iniciá sesión otra vez.",
    bad_state:
      "La sesión de acceso no coincide. Puede haber caducado o haberse abierto en otra pestaña. Iniciá sesión otra vez.",
    access_denied:
      "No completaste el acceso o tu cuenta no tiene permiso para esta aplicación.",
    no_workspace:
      "Tu cuenta se verificó correctamente, pero todavía no tiene una empresa asignada. Escribinos y te damos de alta.",
    generic:
      "No pudimos completar el acceso. Intentá de nuevo en unos segundos.",
  };

  function AuthError(code, detail) {
    var e = new Error(MESSAGES[code] || MESSAGES.generic);
    e.code = code;
    e.detail = detail || null;
    return e;
  }

  /* ============================================================
     Small crypto / encoding helpers
     ============================================================ */

  function bytesToBase64Url(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /* Cryptographically random, base64url, 43 chars — inside the
     43..128 range RFC 7636 requires for a code_verifier. */
  function randomUrlSafe(byteLength) {
    var bytes = new Uint8Array(byteLength || 32);
    global.crypto.getRandomValues(bytes);
    return bytesToBase64Url(bytes);
  }

  /* code_challenge = BASE64URL(SHA256(ASCII(code_verifier))) */
  function s256Challenge(verifier) {
    var data = new TextEncoder().encode(verifier);
    return global.crypto.subtle.digest("SHA-256", data).then(function (digest) {
      return bytesToBase64Url(new Uint8Array(digest));
    });
  }

  function canDoPkce() {
    return !!(
      global.isSecureContext &&
      global.crypto &&
      global.crypto.subtle &&
      global.crypto.getRandomValues
    );
  }

  /* Read a JWT payload. NOTE: the signature is deliberately not verified
     in the browser. Per OIDC Core 3.1.3.7, ID token signature validation
     may be skipped when the token was received directly from the token
     endpoint over TLS — which is exactly this flow. The token never
     arrives via the URL, so it cannot be swapped by the front channel. */
  function decodeJwtPayload(jwt) {
    var part = String(jwt).split(".")[1];
    if (!part) throw AuthError("generic", "malformed JWT");
    var b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    var padded = b64 + "===".slice((b64.length + 3) % 4);
    var bin = atob(padded);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  /* ============================================================
     Storage
     - the in-flight PKCE transaction lives in sessionStorage: it is
       per-tab and dies with the tab, which is what we want.
     - the session lives in localStorage so that opening the platform
       page later restores it without a round trip.
     ============================================================ */

  function readJson(store, key) {
    try {
      var raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeJson(store, key, value) {
    try {
      store.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* private mode / quota — the flow still works, just not persisted */
    }
  }

  function drop(store, key) {
    try {
      store.removeItem(key);
    } catch (e) {}
  }

  function readTx() {
    return readJson(global.sessionStorage, CFG.txKey);
  }
  function clearTx() {
    drop(global.sessionStorage, CFG.txKey);
  }
  function readSession() {
    return readJson(global.localStorage, CFG.sessionKey);
  }
  function clearSession() {
    drop(global.localStorage, CFG.sessionKey);
  }

  /* ============================================================
     1 — Start the login (Authorization Code + PKCE S256)
     ============================================================ */
  function login() {
    if (!canDoPkce()) return Promise.reject(AuthError("insecure"));

    var verifier = randomUrlSafe(32);
    var state = randomUrlSafe(16);
    var nonce = randomUrlSafe(16);

    return s256Challenge(verifier).then(function (challenge) {
      writeJson(global.sessionStorage, CFG.txKey, {
        verifier: verifier,
        state: state,
        nonce: nonce,
        createdAt: Date.now(),
      });

      var params = new URLSearchParams({
        client_id: CFG.clientId,
        response_type: "code",
        scope: CFG.scope,
        redirect_uri: CFG.redirectUri,
        state: state,
        nonce: nonce,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });

      global.location.assign(ENDPOINTS.authorize + "?" + params.toString());
    });
  }

  /* ============================================================
     2 — Handle the redirect back from Keycloak
     ============================================================ */

  function isCallback() {
    var q = new URLSearchParams(global.location.search);
    return q.has("code") || q.has("error");
  }

  /* Drop code/state/iss/error from the address bar once consumed, so a
     reload or a shared URL cannot replay them. */
  function scrubUrl() {
    var url = new URL(global.location.href);
    ["code", "state", "session_state", "iss", "error", "error_description"].forEach(
      function (k) {
        url.searchParams.delete(k);
      }
    );
    global.history.replaceState(global.history.state, "", url.pathname + url.search + url.hash);
  }

  function postForm(url, bodyObject) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(bodyObject).toString(),
      credentials: "omit",
      cache: "no-store",
    }).then(
      function (res) {
        return res.json().then(
          function (json) {
            return { ok: res.ok, status: res.status, body: json };
          },
          function () {
            return { ok: false, status: res.status, body: {} };
          }
        );
      },
      function (netErr) {
        throw AuthError("network", String(netErr));
      }
    );
  }

  function storeTokenResponse(tokens, expectedNonce) {
    var claims = decodeJwtPayload(tokens.id_token);

    /* ---- ID token checks ---- */
    if (claims.iss !== CFG.issuer) throw AuthError("generic", "issuer mismatch");

    var aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (aud.indexOf(CFG.clientId) === -1) throw AuthError("generic", "audience mismatch");

    if (expectedNonce && claims.nonce !== expectedNonce)
      throw AuthError("bad_state", "nonce mismatch");

    if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now())
      throw AuthError("expired_code", "id_token already expired");

    var session = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      idToken: tokens.id_token,
      expiresAt: Date.now() + (Number(tokens.expires_in) || 60) * 1000,
      claims: claims,
    };
    writeJson(global.localStorage, CFG.sessionKey, session);
    return session;
  }

  function completeCallback() {
    return Promise.resolve().then(function () {
      var q = new URLSearchParams(global.location.search);

      /* Keycloak reported a problem before we ever got a code. */
      var kcError = q.get("error");
      if (kcError) {
        scrubUrl();
        clearTx();
        throw AuthError(
          kcError === "access_denied" || kcError === "login_required"
            ? "access_denied"
            : "generic",
          q.get("error_description") || kcError
        );
      }

      var code = q.get("code");
      if (!code) throw AuthError("bad_state", "no authorization code present");

      var tx = readTx();
      if (!tx || !tx.verifier || !tx.state) {
        scrubUrl();
        throw AuthError("bad_state", "no PKCE transaction in this tab");
      }
      if (Date.now() - tx.createdAt > TX_MAX_AGE_MS) {
        clearTx();
        scrubUrl();
        throw AuthError("expired_code", "PKCE transaction too old");
      }
      /* CSRF / mix-up protection */
      if (q.get("state") !== tx.state) {
        clearTx();
        scrubUrl();
        throw AuthError("bad_state", "state mismatch");
      }
      /* RFC 9207 — Keycloak echoes the issuer; verify it when present. */
      var iss = q.get("iss");
      if (iss && iss !== CFG.issuer) {
        clearTx();
        scrubUrl();
        throw AuthError("bad_state", "issuer mismatch on callback");
      }

      return postForm(ENDPOINTS.token, {
        grant_type: "authorization_code",
        code: code,
        /* must be byte-identical to the one sent to /auth */
        redirect_uri: CFG.redirectUri,
        client_id: CFG.clientId,
        code_verifier: tx.verifier,
      }).then(function (res) {
        var nonce = tx.nonce;
        clearTx();
        scrubUrl();

        if (!res.ok || !res.body.id_token) {
          /* Keycloak returns invalid_grant for an expired, already-used
             or PKCE-mismatched authorization code. */
          if (res.body.error === "invalid_grant") throw AuthError("expired_code", res.body.error_description);
          throw AuthError("generic", res.body.error_description || res.body.error || ("HTTP " + res.status));
        }
        return storeTokenResponse(res.body, nonce);
      });
    });
  }

  /* ============================================================
     3 — Session restoration + silent refresh
     ============================================================ */

  function refresh(session) {
    if (!session.refreshToken) {
      clearSession();
      return Promise.resolve(null);
    }
    return postForm(ENDPOINTS.token, {
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: CFG.clientId,
    }).then(function (res) {
      if (!res.ok || !res.body.id_token) {
        /* refresh token expired or revoked — treat as signed out */
        clearSession();
        return null;
      }
      try {
        return storeTokenResponse(res.body, null);
      } catch (e) {
        clearSession();
        return null;
      }
    });
  }

  /* Resolves to a session object, or null when signed out.
     Never rejects for "not signed in" — only for network trouble. */
  function getSession() {
    return Promise.resolve().then(function () {
      var session = readSession();
      if (!session || !session.idToken) return null;
      if (session.expiresAt - EXPIRY_SKEW_MS > Date.now()) return session;
      return refresh(session);
    });
  }

  /* ============================================================
     4 — Logout (local state + Keycloak SSO session)
     ============================================================ */
  function logout() {
    var session = readSession();
    clearSession();
    clearTx();

    var params = new URLSearchParams({
      client_id: CFG.clientId,
      post_logout_redirect_uri: CFG.postLogoutRedirectUri,
    });
    if (session && session.idToken) params.set("id_token_hint", session.idToken);

    global.location.assign(ENDPOINTS.logout + "?" + params.toString());
  }

  /* ============================================================
     5 — Workspace resolution (fails closed by design)
     ------------------------------------------------------------
     Returns { slug, url } only when Keycloak itself asserted the
     workspace in the ID token. Anything else returns null and the
     caller must show the "no workspace" state — it must NOT guess a
     destination, because guessing is how one tenant ends up looking
     at another tenant's CRM.

     Reads the `organization` claim (Keycloak 26 Organizations plus the
     Organization Membership mapper), whose real shape is an array of
     aliases:  "organization": ["camino_de_la_ribera"]

     The destination is NOT assembled from the alias — it is looked up in
     CFG.workspaces, a fixed table. An unknown alias resolves to nothing,
     so no claim value can reach a host that is not listed there.
     ============================================================ */
  var ALIAS_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;

  /* Alias -> { slug, url }, or null. The single validated path into the
     registry: both the alias Keycloak signed into a token and the one
     named in the config go through these same guards, so neither can
     reach a host the registry does not list. */
  function lookupWorkspace(alias) {
    if (typeof alias !== "string") return null;
    alias = alias.trim().toLowerCase();
    if (!ALIAS_RE.test(alias)) return null;

    /* hasOwnProperty so an alias like "__proto__" or "constructor" cannot
       resolve against the prototype chain instead of the registry. */
    var registry = CFG.workspaces || {};
    if (!Object.prototype.hasOwnProperty.call(registry, alias)) return null;

    var url = registry[alias];
    if (typeof url !== "string" || url.indexOf("https://") !== 0) return null;

    return { slug: alias, url: url };
  }

  function resolveWorkspace(claims) {
    if (!claims) return null;

    var raw = claims[CFG.organizationClaim];

    /* Keycloak emits an array today. A bare string is accepted as the
       same thing — one organization — so a shape change does not silently
       lock everyone out. */
    if (typeof raw === "string") raw = [raw];
    if (!Array.isArray(raw)) return null;

    /* Exactly one organization. Zero means the user belongs to none; more
       than one means we do not know which CRM they meant, and picking for
       them is precisely how one tenant ends up inside another's. Both are
       a UI decision, not a guess this code may make. */
    if (raw.length !== 1) return null;

    return lookupWorkspace(raw[0]);
  }

  /* ============================================================
     6 — Direct hand-off to a CRM (no launcher login)
     ------------------------------------------------------------
     Returns the workspace platform.html should hand the user to
     without running the flow above, or null when the launcher is in
     charge. Driven by CFG.directSsoWorkspace — see the note beside it
     in js/auth-config.js for why this is the default today.
     ============================================================ */
  function directWorkspace() {
    return CFG.directSsoWorkspace ? lookupWorkspace(CFG.directSsoWorkspace) : null;
  }

  function displayName(session) {
    var c = (session && session.claims) || {};
    return c.name || c.preferred_username || c.email || "tu cuenta";
  }

  /* ============================================================ */
  global.DchatiAuth = {
    config: CFG,
    endpoints: ENDPOINTS,
    authHost: hostOf(CFG.issuer),
    messages: MESSAGES,
    canDoPkce: canDoPkce,
    isCallback: isCallback,
    login: login,
    completeCallback: completeCallback,
    getSession: getSession,
    logout: logout,
    clearSession: clearSession,
    resolveWorkspace: resolveWorkspace,
    directWorkspace: directWorkspace,
    displayName: displayName,
  };
})(window);
