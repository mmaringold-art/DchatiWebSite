-- ============================================================
-- Dchati — Supabase schema + Row-Level Security (RLS)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Security model:
--   * Passwords are handled entirely by Supabase Auth (auth.users),
--     hashed with bcrypt. We never store or see raw passwords.
--   * Every table below has RLS ENABLED. With RLS on and no permissive
--     policy, access is DENIED by default. We only grant the minimum:
--     a user can read THEIR OWN membership and the workspace(s) they
--     belong to — nothing else. No client can read another tenant's data.
--   * Writes (insert/update/delete) have NO policy => denied for normal
--     users. Manage workspaces/memberships from the dashboard or a
--     trusted server using the service_role key (which bypasses RLS).
-- ============================================================

-- ---------- tables ----------

create table if not exists public.workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  hue           int  not null default 245,
  dashboard_url text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role         text not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

create index if not exists memberships_user_idx on public.memberships(user_id);

-- ---------- enable RLS (deny-by-default) ----------

alter table public.workspaces  enable row level security;
alter table public.memberships enable row level security;

-- ---------- policies (read-only, scoped to the current user) ----------

-- A user can read a workspace only if they are a member of it.
drop policy if exists "members read their workspaces" on public.workspaces;
create policy "members read their workspaces"
  on public.workspaces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.workspace_id = workspaces.id
        and m.user_id = auth.uid()
    )
  );

-- A user can read only their own membership rows.
drop policy if exists "users read own memberships" on public.memberships;
create policy "users read own memberships"
  on public.memberships
  for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- Seed example (optional). Replace with your real data, then create
-- the matching auth users in Dashboard → Authentication → Users, and
-- link them with a membership row.
-- ============================================================
-- insert into public.workspaces (name, slug, hue, dashboard_url) values
--   ('Scopice', 'scopice', 245, 'https://app.dchati.com/scopice');
--
-- -- after creating the auth user, copy their UUID from the Auth panel:
-- insert into public.memberships (user_id, workspace_id, role)
-- select '<AUTH-USER-UUID>', id, 'owner' from public.workspaces where slug = 'scopice';
