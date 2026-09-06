# Keycloak SSO — login de la plataforma

El sitio es estático: sin framework, sin build, sin runtime de Node. Trae un
cliente OIDC completo (**Authorization Code + PKCE S256**) para `platform.html`,
hoy en pausa: ver "Modo actual" abajo.

- Realm: `dchati` — `https://auth.dchati.com/realms/dchati`
- Cliente: `dchati-launcher` (**público**, sin client secret)
- Callback: `https://dchati.com/dashboard`

## Modo actual — hand-off directo al CRM

**El launcher está desactivado.** `platform.html` no inicia ningún flujo OIDC
propio: manda al usuario directo al CRM de su empresa, y el CRM lo autentica con
el flujo que ya tenía.

```
platform.html  ──▶  https://biomasa.dchati.com/b2b/camino_de_la_ribera/sso
                            │
                            └─▶ el CRM corre su propio OIDC contra auth.dchati.com
```

Lo controla **una línea** en `js/auth-config.js`:

```js
directSsoWorkspace: "camino_de_la_ribera",   // null => vuelve el launcher
```

Tiene que ser una clave de `workspaces`. Se **busca** en esa tabla, no se
concatena, así que no puede apuntar a un host que el registro no liste.

### Por qué

El round trip del launcher no autenticaba a nadie: cada CRM hace igual su propio
flujo OIDC y es **su** token el que da acceso, no el nuestro (ver "Límite honesto"
más abajo). El launcher solo leía el claim `organization` para **elegir destino**,
y hoy `workspaces` tiene exactamente un destino. Un selector de un elemento no
selecciona nada, y a cambio costaba: un segundo client de Keycloak, la dependencia
de un client scope Optional, y el problema `www` vs apex que estaba sin resolver.

Efecto secundario importante: en modo directo el navegador **nunca llama a
`/token` desde `dchati.com`**, que es donde ese problema de CORS esperaba.

### Cuándo volver al launcher

Cuando haya un **segundo tenant** en `workspaces` — elegir entre dos destinos es
el único trabajo que el claim `organization` hace de verdad. Poner
`directSsoWorkspace: null` y subir; no hay nada más que revertir. Antes de eso,
resolver el pendiente del dominio canónico.

---

## Cómo está armado (modo launcher)

Lo que sigue describe el flujo del launcher: el que corre con
`directSsoWorkspace: null`. Con el valor actual nada de esto se ejecuta, pero
el código está entero y funciona.


| Archivo | Rol |
|---------|-----|
| `js/auth-config.js` | Configuración pública: cliente, scopes, URLs de redirección **hardcodeadas** y el registro `workspaces`. Sin secretos. |
| `js/auth.js` | Cliente OIDC: PKCE, intercambio de código, refresh, logout, resolución de workspace. |
| `platform.html` + `js/platform.js` | Puerta de entrada. Restaura sesión o manda a Keycloak. |
| `dashboard.html` + `js/dashboard.js` | Callback: intercambia el código y decide el destino. |

Flujo:

```
platform.html  ──login()──▶  auth.dchati.com/.../auth?scope=openid+organization
                                                     &code_challenge_method=S256
                                        │
                                        ▼
                        dchati.com/dashboard?code=…&state=…
                                        │
                    POST /token  (code + code_verifier original)
                                        │
                                        ▼
                 ID token  ──claim organization──▶  CRM de la empresa
```

## Lo que NO hay que hacer

- **No** poner un client secret en el front. El cliente es público: un secreto en el navegador no es un secreto.
- **No** desactivar PKCE ni bajar a `plain`. El challenge se genera con `crypto.subtle` (S256).
- **No** usar implicit flow.
- **No** agregar comodines al `connect-src` del CSP.

## CSP

`nginx.conf` permite exactamente un tercero:

```
connect-src 'self' https://auth.dchati.com;
```

Es el `fetch()` del intercambio de código y del refresh. El login y el logout son
navegaciones de primer nivel, que ninguna directiva del CSP gobierna — por eso
`form-action` sigue en `'self'`.

---

## Ruteo al workspace (Keycloak Organizations)

Tras autenticar, la website decide a qué CRM mandar al usuario usando el claim
`organization` que Keycloak firma dentro del ID token.

### Configuración en Keycloak

- **Organizations** habilitado en el realm `dchati` (Keycloak 26).
- La organización de Biomasa existe con alias **`camino_de_la_ribera`**, y los
  usuarios correspondientes son miembros de ella.
- El cliente `dchati-launcher` tiene el client scope **`organization`** asignado
  como **Optional**, que aporta el mapper **Organization Membership**.

Al ser un scope **opcional**, hay que pedirlo explícitamente. La website solicita
`scope=openid organization` (`js/auth-config.js`). Sin eso Keycloak omite el claim
y **todos los usuarios parecen no tener empresa**, aunque sí sean miembros.

El ID token queda así:

```json
{
  "sub": "8bf3eb33-715f-424b-a88d-4d492eda9b77",
  "name": "Test User",
  "organization": ["camino_de_la_ribera"]
}
```

### Cómo lo usa la website

En `js/auth-config.js`:

- `organizationClaim: "organization"` — el claim que se lee.
- `workspaces` — **registro explícito** alias hacia URL de destino:

```js
workspaces: {
  camino_de_la_ribera: "https://biomasa.dchati.com/b2b/camino_de_la_ribera/sso",
},
```

`resolveWorkspace()` en `js/auth.js`:

1. Lee `claims.organization`. Acepta un **array de strings** (la forma real) o un
   string suelto, que trata como una sola organización.
2. Exige **exactamente una** organización. Cero da `null`. Más de una da `null`:
   elegir por el usuario es precisamente cómo un tenant termina dentro de otro.
3. Normaliza el alias (trim + minúsculas) y lo valida contra
   `^[a-z0-9][a-z0-9_-]{0,62}$` — admite guiones bajos.
4. **Busca** el alias en `workspaces`. No arma la URL concatenando nada. Un alias
   que no esté en la tabla no resuelve.

### Por qué un registro y no una plantilla

El alias **no determina el host**: `camino_de_la_ribera` vive en
`biomasa.dchati.com`. Una plantilla del tipo `https://{alias}.dchati.com/…` daría
`camino_de_la_ribera.dchati.com`, que no existe. Por eso el mapping es una tabla
de datos, no una regla inferida.

Dos consecuencias buscadas: una organización ausente de la tabla **falla cerrado**
—el usuario ve "todavía no tiene una empresa asignada" en vez de ir a un destino
equivocado—, y como el destino se **busca** en vez de concatenarse, ningún valor
del claim puede llevar a un host que no esté listado.

### Agregar una empresa nueva

1. Crear la Organization en Keycloak con su alias y sumar a los usuarios como miembros.
2. Agregar una línea a `workspaces` en `js/auth-config.js`: alias hacia URL del CRM.

No hace falta tocar nada más.

### Límite honesto

El claim dice a dónde **mandar** al usuario, no le da **permiso**. La autorización
real la hace cada CRM validando el token contra Keycloak — que es lo que ya hace
Biomasa (`[KEYCLOAK] ✓ Login autorizado`). Si un CRM no validara, el ruteo sería
solo comodidad de UI, no una frontera de seguridad.

---

## ⚠️ Pendiente — Verificar el dominio canónico (`www` vs apex)

**En modo directo esto ya no rompe el login:** `dchati.com` no hace ningún
`fetch()` a `/token`, así que no hay CORS que fallar ni `?code=` que perder. Pero
sigue sin resolverse, y **hay que resolverlo antes de volver a activar el
launcher**.

- El cliente de Keycloak está registrado con **`https://dchati.com`** (redirect URI y Web origin).
- Pero `README.md` y la config de NPM describen el sitio servido en **`www.dchati.com`**,
  con `dchati.com` hacia `https://www.dchati.com` por **Redirection Host (301)**.

Si el usuario navega en `www.dchati.com`, el `fetch()` al endpoint `/token` sale
con `Origin: https://www.dchati.com`, que **no** está en los Web origins del
cliente, así que el navegador bloquea la respuesta por CORS y el login falla
después de que Keycloak ya autenticó. Además el 301 del apex al `www` en medio
del callback puede perder el `?code=`.

Elegir una:

1. **Servir el sitio en el apex** `https://dchati.com` (y redirigir `www` al apex).
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
momento se agrega, conviene mover la sesión ahí.

## Checklist

- [x] Authorization Code + PKCE S256, sin client secret, sin implicit.
- [x] `state` y `nonce` aleatorios; validación de `iss`/`aud`/`nonce`/`exp`.
- [x] Códigos caducados o reusados (`invalid_grant`) manejados en español.
- [x] Destinos de redirección hardcodeados; sin open redirect.
- [x] Logout contra el endpoint de Keycloak (termina la sesión SSO).
- [x] CSP sin comodines.
- [x] Ruteo al workspace por claim `organization` + registro explícito, que falla cerrado.
- [x] Entrada por hand-off directo al CRM (`directSsoWorkspace`), sin doble flujo OIDC.
- [ ] **Confirmar dominio canónico (`www` vs apex)** — bloquea reactivar el launcher.
- [ ] Que cada CRM valide el token de Keycloak (autorización real). Biomasa ya lo hace.
- [ ] Activar rate limiting / brute force detection en el realm.
