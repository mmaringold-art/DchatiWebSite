# Keycloak SSO — login de la plataforma

El login de `platform.html` usa **Keycloak** con **Authorization Code + PKCE (S256)**.
El sitio sigue siendo estático: sin framework, sin build, sin runtime de Node.

- Realm: `dchati` — `https://auth.dchati.com/realms/dchati`
- Cliente: `dchati-launcher` (**público**, sin client secret)
- Callback: `https://dchati.com/dashboard`

## Cómo está armado

| Archivo | Rol |
|---------|-----|
| `js/auth-config.js` | Configuración pública. URLs de redirección **hardcodeadas**. Sin secretos. |
| `js/auth.js` | Cliente OIDC: PKCE, intercambio de código, refresh, logout, resolución de workspace. |
| `platform.html` + `js/platform.js` | Puerta de entrada. Restaura sesión o manda a Keycloak. |
| `dashboard.html` + `js/dashboard.js` | Callback: intercambia el código y decide el destino. |

Flujo:

```
platform.html  ──login()──▶  auth.dchati.com/.../auth?code_challenge=…&code_challenge_method=S256
                                        │
                                        ▼
                        dchati.com/dashboard?code=…&state=…
                                        │
                    POST /token  (code + code_verifier original)
                                        │
                                        ▼
                     ID token  ──▶  destino del workspace
```

## Lo que NO hay que hacer

- **No** poner un client secret en el front. El cliente es público: un secreto en el navegador no es un secreto.
- **No** desactivar PKCE ni bajar a `plain`. El challenge se genera con `crypto.subtle` (S256).
- **No** usar implicit flow.
- **No** agregar comodines (`*`) al `connect-src` del CSP.

## CSP

`nginx.conf` permite exactamente un tercero:

```
connect-src 'self' https://auth.dchati.com;
```

Es el `fetch()` del intercambio de código y del refresh. El login y el logout son
navegaciones de primer nivel, que ninguna directiva del CSP gobierna — por eso
`form-action` sigue en `'self'`.

---

## ⚠️ Pendiente 1 — Ruteo al workspace (bloqueante para el redirect final)

Hoy, tras autenticarse, el usuario llega a `/dashboard` y ve **"tu cuenta no tiene
una empresa asignada"**. Eso es intencional: falla cerrado.

El modelo de workspaces vivía en Supabase (`supabase/schema.sql`). Al sacar
Supabase como proveedor de identidad, el front estático **ya no tiene ninguna
fuente confiable** para saber a qué empresa pertenece un usuario. Adivinarlo sería
exactamente el bug que expone el CRM de una empresa a otra.

Hay dos caminos. **Hay que elegir uno.**

### Opción A — Claim firmado en el ID token (sin backend nuevo)

Requiere **un cambio en Keycloak**: un protocol mapper que agregue el slug del
workspace al ID token.

1. Realm `dchati` → Clients → `dchati-launcher` → **Client scopes** →
   `dchati-launcher-dedicated` → **Add mapper** → **By configuration** →
   **User Attribute**.
2. Configurar:
   - Name: `dchati-workspace`
   - User Attribute: `workspace`
   - Token Claim Name: `dchati_workspace`
   - Claim JSON Type: `String`
   - **Add to ID token: ON**
   - Add to access token: ON (útil cuando el CRM valide el token)
   - Multivalued: OFF
3. En cada usuario (Users → Attributes) agregar `workspace = <slug>`
   (minúsculas, `^[a-z0-9][a-z0-9-]{0,62}$`, ej. `scopice`).

El front ya soporta esto: `js/auth.js` lee el claim, valida el slug y arma la URL
como `workspaceBaseUrl + slug`. **Nunca** acepta una URL completa desde un claim,
así que ningún valor puede redirigir fuera de `app.dchati.com`.

> El nombre del claim se cambia en `workspaceClaim` (`js/auth-config.js`).

**Límite honesto de esta opción:** el claim dice a dónde *mandar* al usuario, no
le da *permiso*. La autorización real la tiene que hacer `app.dchati.com`
validando el token contra Keycloak. Si el CRM no valida, el ruteo es solo
comodidad de UI, no una frontera de seguridad.

### Opción B — Endpoint de resolución en el backend

Un servicio propio expone `GET /api/me/workspace`, recibe el access token en
`Authorization: Bearer …`, lo valida contra el JWKS del realm y responde el
workspace desde la base. Es lo correcto si la relación usuario↔empresa vive en
una base y no en Keycloak.

Requiere: el servicio, su despliegue, y agregar su origen al `connect-src`.
Hoy **ese backend no existe en este repositorio**.

---

## ⚠️ Pendiente 2 — Verificar el dominio canónico (`www` vs apex)

Esto puede romper el login en producción y hay que confirmarlo.

- El cliente de Keycloak está registrado con **`https://dchati.com`** (redirect URI y Web origin).
- Pero `README.md` y la config de NPM describen el sitio servido en **`www.dchati.com`**,
  con `dchati.com` → `https://www.dchati.com` por **Redirection Host (301)**.

Si el usuario navega en `www.dchati.com`, el `fetch()` al endpoint `/token` sale
con `Origin: https://www.dchati.com`, que **no** está en los Web origins del
cliente → el navegador bloquea la respuesta por CORS y el login falla después de
que Keycloak ya autenticó. Además el 301 del apex al `www` en medio del callback
puede perder el `?code=`.

Elegir una:

1. **Servir el sitio en el apex** `https://dchati.com` (y redirigir `www` → apex).
   No requiere tocar Keycloak. Es lo que asume la config actual.
2. **Agregar `www` en Keycloak**: `https://www.dchati.com/*` en Valid redirect URIs
   y `https://www.dchati.com` en Web origins, y cambiar `redirectUri` /
   `postLogoutRedirectUri` en `js/auth-config.js` al host que realmente sirve.

No cambié nada de Keycloak: hasta saber cuál es el dominio canónico real,
cualquier elección sería una suposición.

---

## Nota sobre el almacenamiento de tokens

La sesión (incluido el refresh token) se guarda en `localStorage`, para que abrir
la plataforma más tarde restaure la sesión sin ida y vuelta. Es el compromiso
habitual de una SPA sin backend, y se apoya en el CSP estricto
(`script-src 'self'`, sin inline) para reducir el riesgo de XSS.

La alternativa más segura —tokens en cookie `HttpOnly` gestionados por un
backend-for-frontend— **exige un backend**, que hoy no existe. Si en algún
momento se agrega (ver Pendiente 1, Opción B), conviene mover la sesión ahí.

## Checklist

- [x] Authorization Code + PKCE S256, sin client secret, sin implicit.
- [x] `state` y `nonce` aleatorios; validación de `iss`/`aud`/`nonce`/`exp`.
- [x] Códigos caducados o reusados (`invalid_grant`) manejados en español.
- [x] Destinos de redirección hardcodeados; sin open redirect.
- [x] Logout contra el endpoint de Keycloak (termina la sesión SSO).
- [x] CSP sin comodines.
- [ ] **Elegir Opción A u B para el ruteo al workspace.**
- [ ] **Confirmar dominio canónico (`www` vs apex).**
- [ ] Que `app.dchati.com` valide el token de Keycloak (autorización real).
- [ ] Activar rate limiting / brute force detection en el realm.
