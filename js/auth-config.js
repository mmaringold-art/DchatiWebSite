/* ============================================================
   Dchati — Keycloak OIDC public configuration
   ------------------------------------------------------------
   Nothing here is a secret. `dchati-launcher` is a PUBLIC client:
   it has no client secret, and it must never be given one — a
   secret shipped to the browser is not a secret. Security comes
   from Authorization Code + PKCE (S256) plus the exact-match
   redirect URIs registered in Keycloak.

   Everything that could be used as a redirect target is a fixed
   constant in this file. Nothing here is ever read from the URL,
   from user input, or from a token claim without validation —
   see js/auth.js.
   ============================================================ */
window.DCHATI_AUTH_CONFIG = {
  /* ---- Keycloak ---- */
  issuer: "https://auth.dchati.com/realms/dchati",
  clientId: "dchati-launcher",

  /* Only "openid" is requested. Keycloak applies the `profile` and
     `email` default client scopes on top of it, so the ID token still
     carries name/email for display. */
  scope: "openid",

  /* ---- Fixed redirect targets (open-redirect protection) ----
     These must match, byte for byte, the "Valid redirect URIs" and
     "Valid post logout redirect URIs" registered on the client.
     They are hardcoded on purpose: the browser can never influence
     where Keycloak sends the user back to. */
  redirectUri: "https://dchati.com/dashboard",
  postLogoutRedirectUri: "https://dchati.com/platform.html?logout=1",

  /* The site is only ever served from this origin. If window.location
     does not match, we still use the constants above, so a copy of the
     page hosted elsewhere cannot harvest a code. */
  siteOrigin: "https://dchati.com",

  /* ---- Tenant routing (see WORKSPACE-MAPPING note in js/auth.js) ----
     Name of the ID-token claim that carries the user's workspace slug.
     The claim is produced by Keycloak and delivered over TLS from the
     token endpoint, so it is trustworthy; a value typed by the browser
     is not. Until a protocol mapper populates this claim, workspace
     routing stays disabled and the dashboard fails closed. */
  workspaceClaim: "dchati_workspace",

  /* Workspace URLs are BUILT from this base + a strictly validated
     slug. A full URL is never accepted from a claim, so there is no
     shape of claim value that can redirect a user off-domain. */
  workspaceBaseUrl: "https://app.dchati.com/",

  /* ---- Storage keys ---- */
  txKey: "dchati.oidc.tx",
  sessionKey: "dchati.oidc.session",
};
