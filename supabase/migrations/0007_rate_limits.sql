-- ASCEND rate limiting: cap how fast any one account can write, so a scripted client
-- (or a stranger who signed up just to abuse the public key) can't flood the database with
-- spam posts/messages/nudges, mass-friend-spam, or bloat storage with junk sessions.
--
-- Pure-Postgres, per-user, fixed-window counters enforced by BEFORE INSERT triggers. RLS
-- already proves *who* you are and *what* you may touch; this caps *how often*. Reads aren't
-- covered by triggers — Supabase's platform limits + the directory-view recommendation in
-- docs/SECURITY-CHECKS.md handle scraping.

create table if not exists public.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null default now(),
  count int not null default 0,
  primary key (user_id, action)
);
-- RLS on, zero policies: no client can read or write this table directly. Only the
-- SECURITY DEFINER function below (running as owner) touches it.
alter table public.rate_limits enable row level security;

-- Increment this user's counter for `action`; reset when the window has rolled over.
-- Raises (aborting the INSERT) once the cap is passed. Privileged callers (service role /
-- dashboard) are never limited, so edge functions and admin work are unaffected.
create or replace function public.rl_check(p_action text, p_max int, p_per_seconds int)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur int;
begin
  if not public.is_app_user() then return; end if;   -- service role / dashboard: no limit
  if uid is null then return; end if;                -- anon writes are blocked by RLS anyway

  insert into public.rate_limits as rl (user_id, action, window_start, count)
    values (uid, p_action, now(), 1)
  on conflict (user_id, action) do update
    set count = case when rl.window_start < now() - make_interval(secs => p_per_seconds)
                     then 1 else rl.count + 1 end,
        window_start = case when rl.window_start < now() - make_interval(secs => p_per_seconds)
                     then now() else rl.window_start end
  returning rl.count into cur;

  if cur > p_max then
    raise exception 'rate limit exceeded for %, try again later', p_action
      using errcode = 'check_violation', hint = 'rate_limited';
  end if;
end; $$;

-- One tiny trigger per protected table. Limits are generous for a real human, tight for a bot.
create or replace function public.rl_nudges()   returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.rl_check('nudge',      30,  3600); return new; end; $$;
create or replace function public.rl_messages() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.rl_check('message',   180, 3600); return new; end; $$;
create or replace function public.rl_posts()    returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.rl_check('post',       60,  3600); return new; end; $$;
create or replace function public.rl_likes()    returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.rl_check('like',       600, 3600); return new; end; $$;
create or replace function public.rl_friends()  returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.rl_check('friend_req', 60,  3600); return new; end; $$;
create or replace function public.rl_duels()    returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.rl_check('duel',       60,  3600); return new; end; $$;
create or replace function public.rl_subs()     returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.rl_check('push_sub',   20,  3600); return new; end; $$;
create or replace function public.rl_customex() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.rl_check('custom_ex',  60,  86400); return new; end; $$;
-- Sync tables: high ceilings (a returning device may bulk-upload), but still bounded to stop storage abuse.
create or replace function public.rl_sessions() returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.rl_check('session',    600, 3600); return new; end; $$;
create or replace function public.rl_meals()    returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.rl_check('meal',       800, 3600); return new; end; $$;

drop trigger if exists rl_nudges_t   on public.nudges;             create trigger rl_nudges_t   before insert on public.nudges             for each row execute function public.rl_nudges();
drop trigger if exists rl_messages_t on public.messages;           create trigger rl_messages_t before insert on public.messages           for each row execute function public.rl_messages();
drop trigger if exists rl_posts_t    on public.posts;              create trigger rl_posts_t    before insert on public.posts              for each row execute function public.rl_posts();
drop trigger if exists rl_likes_t    on public.likes;              create trigger rl_likes_t    before insert on public.likes              for each row execute function public.rl_likes();
drop trigger if exists rl_friends_t  on public.friendships;        create trigger rl_friends_t  before insert on public.friendships        for each row execute function public.rl_friends();
drop trigger if exists rl_duels_t    on public.duels;              create trigger rl_duels_t    before insert on public.duels              for each row execute function public.rl_duels();
drop trigger if exists rl_subs_t     on public.push_subscriptions; create trigger rl_subs_t     before insert on public.push_subscriptions for each row execute function public.rl_subs();
drop trigger if exists rl_customex_t on public.custom_exercises;   create trigger rl_customex_t before insert on public.custom_exercises    for each row execute function public.rl_customex();
drop trigger if exists rl_sessions_t on public.sessions;           create trigger rl_sessions_t before insert on public.sessions            for each row execute function public.rl_sessions();
drop trigger if exists rl_meals_t    on public.meals;              create trigger rl_meals_t    before insert on public.meals              for each row execute function public.rl_meals();
