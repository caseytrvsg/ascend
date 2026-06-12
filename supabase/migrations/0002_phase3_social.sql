-- ASCEND Phase 3: friendships + nudges. One row per friend pair (user_a < user_b
-- keeps the pair canonical); requested_by says who asked. Realtime on nudges +
-- friendships so the other person sees requests/pokes live while the app is open.

create table public.friendships (
  id bigint generated always as identity primary key,
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create table public.nudges (
  id bigint generated always as identity primary key,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  msg text,
  seen boolean not null default false,
  created_at timestamptz default now()
);

alter table public.friendships enable row level security;
alter table public.nudges enable row level security;

-- friendships: you see rows you're part of; you create requests you send (as pending);
-- only the OTHER person can accept; either side can remove (decline/unfriend).
create policy "friendships read own" on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy "friendships request" on public.friendships for insert to authenticated
  with check (requested_by = auth.uid() and auth.uid() in (user_a, user_b) and status = 'pending');
create policy "friendships accept" on public.friendships for update to authenticated
  using (auth.uid() in (user_a, user_b) and auth.uid() <> requested_by)
  with check (status = 'accepted');
create policy "friendships remove" on public.friendships for delete to authenticated
  using (auth.uid() in (user_a, user_b));

-- nudges: only between accepted friends; sender writes, receiver marks seen.
create policy "nudges read own" on public.nudges for select to authenticated
  using (auth.uid() in (from_user, to_user));
create policy "nudges send to friends" on public.nudges for insert to authenticated
  with check (
    from_user = auth.uid() and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_a = from_user and f.user_b = to_user) or (f.user_a = to_user and f.user_b = from_user))
    )
  );
create policy "nudges mark seen" on public.nudges for update to authenticated
  using (to_user = auth.uid()) with check (to_user = auth.uid());

-- live delivery while the app is open
alter publication supabase_realtime add table public.nudges;
alter publication supabase_realtime add table public.friendships;
