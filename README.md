# Dchati — Marketing Website

Premium marketing site for **Dchati**, an AI-powered customer-communication and business-management platform built around WhatsApp.

> **Entorno actual: DEV** — la web se sirve en `dev.dchati.com`, el CRM de
> Biomasa en `biomasa.dev.dchati.com` y la inmobiliaria en `app.dev.dchati.com`.
> El detalle de hosts y cómo cambiar de entorno está en
> [KEYCLOAK_SETUP.md](KEYCLOAK_SETUP.md#entornos).

Las secciones de despliegue de abajo todavía describen el montaje de **producción**
(`www.dchati.com` + apex, con Redirection Host). En DEV los Proxy Hosts ya existen
en Nginx Proxy Manager y no hace falta recrearlos.

---

## Tech stack

- **Static site** — hand-written HTML + plain CSS + vanilla JavaScript.
- **No framework, no build step, no Node runtime in production.**
- Served by **nginx** (`nginx:1.27-alpine`) in a Docker container.
- Only external runtime dependency: Google Fonts (CDN).

> The `shadcn` entry in `package.json` is a design-time CLI only. It is **not** required to build, run, or deploy the site.

---

## Project structure

```
.
├── Dchati Landing.html     # Home page (served as / via index.html in the image)
├── platform.html           # Login entry point (Keycloak SSO)
├── dashboard.html          # OIDC callback (served at /dashboard) + workspace routing
├── privacy.html            # Privacy policy (RGPD/LSSI template — see notes)
├── terms.html              # Terms & conditions (template — see notes)
├── css/
│   ├── styles.css          # Landing + shared tokens, nav, aurora, legal pages
│   ├── crm.css             # Embedded interactive CRM demo
│   └── platform.css        # Login + callback pages
├── js/
│   ├── main.js             # Tweaks, scroll effects, CTA wiring
│   ├── background.js       # Light-beam field + scroll-driven "DC" monogram
│   ├── chat.js             # Interactive WhatsApp chat demo
│   ├── crm.js              # Interactive CRM demo (dashboard, contacts, etc.)
│   ├── auth-config.js      # Keycloak public config (no secrets)
│   ├── auth.js             # OIDC client: Authorization Code + PKCE S256
│   ├── platform.js         # AI core animation + login entry point
│   └── dashboard.js        # Code exchange + workspace routing
├── Dockerfile              # nginx static image
├── docker-compose.yml      # Hostinger / NPM deployment
├── nginx.conf              # Server config (gzip, caching, /healthz)
├── .dockerignore
└── .gitignore
```

---

## Local development

No tooling required — open `Dchati Landing.html` directly in a browser, **or** serve the folder with any static server:

```bash
# Python
python -m http.server 8080
# then open http://localhost:8080/Dchati%20Landing.html
```

---

## Configuration (front-end)

A few values are baked into the static files and must be set before launch:

| What | Where | Notes |
|------|-------|-------|
| **WhatsApp number** | `whatsappNumber` in `js/config.js` | Country code + number, no `+`. Until set, "Hablar por WhatsApp" CTAs fall back to the `#contacto` anchor. |
| **Login (Keycloak SSO)** | `js/auth-config.js` | Authorization Code + PKCE (S256) against the `dchati` realm. Public client, no secret. Redirect targets are hardcoded — see [KEYCLOAK_SETUP.md](KEYCLOAK_SETUP.md). |
| **Legal entity details** | `privacy.html`, `terms.html` | Replace every `[PLACEHOLDER]` and have the documents reviewed by a professional before publishing. |

> ⚠️ Two items still block the end-to-end login — **workspace routing** and the
> **`www` vs apex domain** question. Both are written up in
> [KEYCLOAK_SETUP.md](KEYCLOAK_SETUP.md).

> ⚠️ The CRM section on the landing page uses **fictitious demo data** for illustration only.

---

## Deployment (Docker + Nginx Proxy Manager)

This site runs as a standalone static container behind an existing **Nginx Proxy Manager** (NPM) instance, joined to the shared `dchati_shared` Docker network.

### 1. Build & run

```bash
docker compose up -d --build
```

The container (`dchati-website`) listens on port **80 internally** and does **not** publish a host port — NPM reaches it by name over `dchati_shared`.

### 2. Network

`docker-compose.yml` references an external network:

```yaml
networks:
  proxy:
    external: true
    name: dchati_shared   # the network NPM is attached to
```

Confirm both containers share it:

```bash
docker network inspect dchati_shared --format '{{range .Containers}}{{.Name}} {{end}}'
# must list: dchati-website  npm
```

### 3. Reverse proxy (NPM UI)

Add a **Proxy Host**:

- Domains: `www.dchati.com`, `dchati.com`
- Scheme `http` → Forward Hostname `dchati-website` → Port `80`
- Block Common Exploits ✅
- **SSL:** request a Let's Encrypt certificate, Force SSL ✅

Add a **Redirection Host** `dchati.com` → `https://www.dchati.com` (301) for apex → www.

### 4. DNS

A records for `www` and `@` → your VPS IP.

### Health check

`GET /healthz` returns `200 ok` (used by the container HEALTHCHECK and available for uptime monitoring).

---

## Hostinger Docker Manager

Create a **dedicated project** named `website`, point it at this repository, and deploy. The compose attaches to the existing `dchati_shared` network automatically — no host ports, no env vars required at runtime.

---

## License

© 2026 Dchati. All rights reserved. 