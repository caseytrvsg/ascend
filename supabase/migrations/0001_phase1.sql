-- ASCEND Phase 1: profiles + training data. RLS everywhere.
-- profiles: 1 row per account. Settings/derived fields = last-write-wins via updated_at.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  bw numeric, units text default 'lb', height_cm numeric, height_unit text default 'cm',
  age int, sex text, activity text default 'moderate', goal text, calories int, body_fat numeric,
  pro boolean default false, shards int default 120,
  owned jsonb default '["th_mid","bd_none","bn_none"]', inv jsonb default '{}',
  theme text default 'th_mid', border text default 'bd_none', banner text default 'bn_none',
  boost jsonb, streak jsonb, comp jsonb default '{"tier":0,"div":0,"sr":0,"wins":0,"losses":0,"streak":0}',
  sr int default 0,
  updated_at bigint default 0          -- epoch ms, client-stamped, last-write-wins
);

create table public.sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at bigint not null, ended_at bigint, exercises jsonb not null default '[]',
  unique (user_id, started_at)
);

create table public.routines (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rid bigint not null, name text, items jsonb not null default '[]',
  unique (user_id, rid)
);

create table public.meals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ts bigint not null, day text not null, entry jsonb not null,
  unique (user_id, ts)
);

create table public.custom_exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ex_id text not null, name text not null, grp text not null, equipment text,
  unique (user_id, ex_id)
);

-- Auto-create profile on signup (username arrives via auth metadata).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'lifter_' || substr(new.id::text,1,8)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.routines enable row level security;
alter table public.meals enable row level security;
alter table public.custom_exercises enable row level security;

-- profiles: any signed-in user may read (leaderboards later); only you write yours.
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- training data: owner-only, all operations.
create policy "own sessions" on public.sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own routines" on public.routines for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own meals" on public.meals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own custom_exercises" on public.custom_exercises for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
