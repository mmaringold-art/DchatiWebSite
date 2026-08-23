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

  /* `organization` is an OPTIONAL client scope on dchati-launcher, so it
     has to be requested explicitly — without it Keycloak omits the claim
     and every user looks like they belong to no company.

     `profile` and `email` stay implicit: Keycloak applies them as
     default client scopes, which is where name/email come from. */
  scope: "openid organization",

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

  /* ---- Tenant routing — Keycloak 26 Organizations ----
     With the `organization` client scope and the Organization Membership
     mapper, the ID token carries the user's organization aliases:

         "organization": ["camino_de_la_ribera"]

     Keycloak signs the claim and it reaches us over TLS from the /token
     endpoint, so it is trustworthy — a value typed by the browser is not.
     See resolveWorkspace() in js/auth.js. */
  organizationClaim: "organization",

  /* Explicit alias -> destination registry.

     There is deliberately NO derived rule here. The alias does not
     determine the host: `camino_de_la_ribera` lives on biomasa.dchati.com,
     and a template like https://{alias}.dchati.com/... would resolve to a
     host that does not exist. So this is a data table, not a rule.

     Two consequences, both wanted: an organization missing from this table
     does not resolve (fails closed), and because the destination is looked
     up rather than concatenated, no claim value can send a user to a host
     that is not listed here. Adding a tenant is one line. */
  workspaces: {
    camino_de_la_ribera: "https://biomasa.dchati.com/b2b/camino_de_la_ribera/sso",
  },

  /* ---- Storage keys ---- */
  txKey: "dchati.oidc.tx",
  sessionKey: "dchati.oidc.session",
};
