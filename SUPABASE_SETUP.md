# Supabase Auth setup (login de la plataforma)

El login de `platform.html` ya usa **Supabase Auth** con **Row-Level Security**. Para activarlo, hacé esto una sola vez:

## 1. Crear el proyecto
1. Entrá a [supabase.com](https://supabase.com) → **New project**.
2. Guardá la contraseña de la base (no va en el sitio).

## 2. Crear el esquema con RLS
1. Dashboard → **SQL Editor** → **New query**.
2. Pegá y ejecutá el contenido de [`supabase/schema.sql`](supabase/schema.sql).
   - Esto crea `workspaces` + `memberships` y **activa RLS** (deny-by-default).

## 3. Conectar el sitio
1. Dashboard → **Project Settings → API**. Copiá:
   - **Project URL** (ej. `https://abcd1234.supabase.co`)
   - **anon public key**
2. Pegalas en [`js/supabase-config.js`](js/supabase-config.js):
   ```js
   window.DCHATI_SUPABASE = {
     url: "https://TU-REF.supabase.co",
     anonKey: "TU-ANON-KEY",
   };
   ```
   > La `anon key` es **pública por diseño**. No es un secreto: lo que protege los datos es el RLS, no la key. **Nunca** pongas la `service_role` key en el sitio.

## 4. Crear usuarios y vincularlos
1. Dashboard → **Authentication → Users → Add user** (email + contraseña).
2. Copiá el **UUID** del usuario.
3. En SQL Editor, creá el workspace y la membresía (ver el ejemplo comentado al final de `schema.sql`).

## 5. Probar
- Entrá a `/platform.html`, iniciá sesión. Debería resolver el workspace y redirigir.
- Si las credenciales en `supabase-config.js` siguen con `YOUR-...`, el login muestra un mensaje amable ("acceso aún no disponible") en vez de romperse.

---

## ⚠️ Coexistencia con el CRM (NextAuth)
El CRM (`app.dchati.com`) hoy usa **NextAuth**, que es un sistema de sesión distinto. Por eso, tras iniciar sesión acá, la sesión **no se comparte** automáticamente con el CRM. Tenés 3 caminos:

1. **Unificar en Supabase (recomendado):** migrar el CRM a Supabase Auth. Una sola identidad para todo.
2. **Sesión compartida por cookie:** configurar Supabase para guardar la sesión en una cookie con dominio `.dchati.com` y que el CRM la lea.
3. **Login único en el CRM:** que el botón "Plataforma" del sitio simplemente enlace al login del CRM (cero superficie de auth en el sitio público).

Decidí cuál querés y lo ajusto.

## Seguridad — checklist
- [x] Contraseñas hasheadas por Supabase (bcrypt), nunca en el cliente.
- [x] RLS activado, deny-by-default; aislamiento entre empresas.
- [x] Sin `service_role` key en el front (solo `anon`).
- [ ] Activar **rate limiting / protección de fuerza bruta** en Supabase (Auth → Rate limits).
- [ ] Activar **confirmación de email** y/o **MFA** si aplica (Auth → Providers / MFA).
- [ ] Restringir **CORS / Site URL** en Auth → URL Configuration a tus dominios.
