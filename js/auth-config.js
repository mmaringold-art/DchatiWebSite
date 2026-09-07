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

/* ============================================================
   ENVIRONMENT — DEV
   ------------------------------------------------------------
   Every host below belongs to the dev stack. Switching environments
   means editing this file and nothing else: the constants here plus
   the `workspaces` table are the only places a host is written down,
   and every user-facing string that names a host derives from them at
   runtime (see js/auth.js and js/platform.js) rather than repeating it.

   The single host outside this file is the CSP `connect-src` in
   nginx.conf, which must name the same origin as `issuer`.

       DEV                       PROD
       dev.dchati.com            dchati.com
       auth.dev.dchati.com       auth.dchati.com
       biomasa.dev.dchati.com    biomasa.dchati.com
       app.dev.dchati.com        app.dchati.com

   The PROD values are recorded in KEYCLOAK_SETUP.md, not here, so this
   file always describes exactly one environment.
   ============================================================ */
window.DCHATI_AUTH_CONFIG = {
  /* ---- Keycloak ---- */
  issuer: "https://auth.dev.dchati.com/realms/dchati",
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
  redirectUri: "https://dev.dchati.com/dashboard",
  postLogoutRedirectUri: "https://dev.dchati.com/platform.html?logout=1",

  /* The origin this site is served from. Named in the "you need HTTPS"
     message so it points at the right environment; the redirect targets
     above are what actually keep a copy of this page hosted elsewhere
     from harvesting a code, since Keycloak matches them exactly. */
  siteOrigin: "https://dev.dchati.com",

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
     determine the host: `camino_de_la_ribera` lives on biomasa.dev.dchati.com,
     and a template like https://{alias}.dev.dchati.com/... would resolve to a
     host that does not exist. So this is a data table, not a rule.

     Two consequences, both wanted: an organization missing from this table
     does not resolve (fails closed), and because the destination is looked
     up rather than concatenated, no claim value can send a user to a host
     that is not listed here. Adding a tenant is one line. */
  workspaces: {
    camino_de_la_ribera: "https://biomasa.dev.dchati.com/b2b/camino_de_la_ribera/sso",
  },

  /* ---- Entry mode: hand off to the CRM instead of logging in here ----
     The website does not need a login of its own. Every CRM already runs a
     full OIDC flow against this same realm — that is exactly what
     /b2b/<alias>/sso is — and it is the CRM's token, not ours, that grants
     access. The launcher's round trip authenticates nobody a second time;
     it only reads the `organization` claim to choose a destination, and
     today the registry above holds exactly one destination to choose.

     So platform.html hands the user straight to this workspace and lets
     the CRM authenticate them. It also means the browser never calls
     /token from this origin, which is where the www-vs-apex CORS problem
     in KEYCLOAK_SETUP.md was waiting to bite.

     Nothing in the launcher is deleted. Set this to null and js/auth.js
     takes over again — which is what a second entry in `workspaces` would
     call for, since choosing between two destinations is the one job the
     claim actually does.

     Must be a key of `workspaces`: it is looked up, never concatenated,
     so it cannot point anywhere the registry does not already list. */
  directSsoWorkspace: "camino_de_la_ribera",

  /* ---- Storage keys ---- */
  txKey: "dchati.oidc.tx",
  sessionKey: "dchati.oidc.session",
};
