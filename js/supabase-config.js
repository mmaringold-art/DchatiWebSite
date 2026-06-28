/* ============================================================
   Dchati — Supabase public config
   ------------------------------------------------------------
   The anon key is SAFE to expose in client code: by itself it can
   only do what your Row-Level Security (RLS) policies allow. Real
   data protection lives in RLS — see supabase/schema.sql.

   Fill these from: Supabase Dashboard → Project Settings → API
   ============================================================ */
window.DCHATI_SUPABASE = {
  url: "https://YOUR-PROJECT-REF.supabase.co",
  anonKey: "YOUR-PUBLIC-ANON-KEY",
};

/* Builds the client once, or reports "not configured" so the login
   page degrades gracefully instead of throwing. */
window.DCHATI_SB = (function () {
  const c = window.DCHATI_SUPABASE || {};
  const looksReal =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.url || "") &&
    (c.anonKey || "").length > 20 &&
    !/YOUR-/.test((c.url || "") + (c.anonKey || ""));

  if (!looksReal || !window.supabase) {
    return { configured: false, client: null };
  }
  return {
    configured: true,
    client: window.supabase.createClient(c.url, c.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    }),
  };
})();
