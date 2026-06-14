-- ASCEND AI usage caps. AI features (paid vision calls) must never run past budget — not if
-- the key leaks, not if someone scripts the app. Two ceilings, enforced server-side inside the
-- AI edge functions: a PER-USER daily cap and a GLOBAL daily cap (your total spend limit).
-- When either is hit the function returns 429 and never calls (never pays) the AI provider.

create table if not exists public.ai_usage (
  scope text not null,          -- a user id (uuid as text) or the literal 'GLOBAL'
  day   date not null,
  kind  text not null,          -- which AI feature, e.g. 'scan_meal'
  count int  not null default 0,
  primary key (scope, day, kind)
);
-- RLS on, no policies: nothing client-side can read or write it. Only the SECURITY DEFINER
-- functions below (called by edge functions via the service role) touch it.
alter table public.ai_usage enable row level security;

-- Consume one AI call. Increments the global counter then the per-user counter; if either would
-- exceed its cap it RAISES, which rolls back both increments in this RPC's transaction — so the
-- stored counts settle exactly at the cap and a blocked attempt is never counted (or charged).
-- Returns the user's remaining allowance for the day. Service-role only (no grant to clients).
create or replace function public.ai_consume(p_kind text, p_user_max int, p_global_max int)
returns int language plpgsql security definer set search_path = public as $$
declare
  uid text := coalesce(auth.uid()::text, 'anon');
  d   date := (now() at time zone 'utc')::date;
  gcount int; ucount int;
begin
  insert into public.ai_usage as a (scope, day, kind, count) values ('GLOBAL', d, p_kind, 1)
    on conflict (scope, day, kind) do update set count = a.count + 1
    returning a.count into gcount;
  if gcount > p_global_max then
    raise exception 'AI daily budget reached' using errcode = 'check_violation', hint = 'ai_global_limit';
  end if;

  insert into public.ai_usage as a (scope, day, kind, count) values (uid, d, p_kind, 1)
    on conflict (scope, day, kind) do update set count = a.count + 1
    returning a.count into ucount;
  if ucount > p_user_max then
    raise exception 'AI daily limit reached' using errcode = 'check_violation', hint = 'ai_user_limit';
  end if;

  return greatest(0, p_user_max - ucount);
end; $$;

-- Read remaining allowance WITHOUT consuming — lets the client grey out the button proactively.
create or replace function public.ai_remaining(p_kind text, p_user_max int)
returns int language sql security definer set search_path = public as $$
  select greatest(0, p_user_max - coalesce(
    (select count from public.ai_usage
       where scope = coalesce(auth.uid()::text, 'anon')
         and day = (now() at time zone 'utc')::date
         and kind = p_kind), 0));
$$;
revoke all on function public.ai_consume(text,int,int) from public, anon, authenticated;  -- edge functions only
grant execute on function public.ai_remaining(text,int) to authenticated;
