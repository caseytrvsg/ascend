-- ASCEND security hardening: make the subscription (and competitive rank) un-bypassable.
--
-- The publishable key is public by design, so RLS is the real guard. But the existing
-- "profiles update own" policy lets a user write EVERY column of their own row — including
-- `pro`. That means anyone could run `update profiles set pro=true` with the public key and
-- self-grant the subscription. Postgres has no per-column RLS, so we use a BEFORE UPDATE
-- trigger that pins the protected columns to their previous values for ordinary app users.
-- Only privileged callers (service-role edge functions, or you in the dashboard) can change
-- them — e.g. the grant-pro function after a verified payment.

-- Subscription expiry (null = perpetual / not set). Set together with `pro` by grant-pro.
alter table public.profiles add column if not exists pro_until timestamptz;

-- True when the current statement is an ordinary client request (logged-in user or anon),
-- i.e. PostgREST has switched into the 'authenticated'/'anon' role. Service-role calls run as
-- 'service_role'; the SQL editor runs as 'postgres'/'supabase_admin' — those stay privileged.
create or replace function public.is_app_user() returns boolean
language sql stable as $$
  select current_user in ('authenticated', 'anon')
$$;

-- Pin entitlement + competitive columns on any app-user UPDATE. comp is decided by the
-- resolve-duel function (service role); pro/pro_until only by grant-pro. Settings, theme,
-- shards, owned, inv, sr, etc. remain freely writable by the owner (unchanged).
create or replace function public.guard_profile_cols() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_app_user() then
    new.pro       := old.pro;
    new.pro_until := old.pro_until;
    new.comp      := old.comp;
  end if;
  return new;
end; $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_cols();

-- NOTE (documented, intentionally NOT locked this pass): shards / owned / inv / sr are still
-- client-authoritative. Cheating them grants only cosmetics + leaderboard vanity, not the paid
-- subscription. Making them tamper-proof means moving the economy server-side (an RPC per
-- earn/spend) and computing sr from `sessions` on the server — see docs/SECURITY-CHECKS.md.
