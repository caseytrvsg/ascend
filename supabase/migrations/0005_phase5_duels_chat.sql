-- ASCEND Phase 5: 1v1 duels + direct messages.

-- A duel: challenger vs opponent on one exercise. Each submits weight + proof photo;
-- when both are in, the resolve-duel edge function (service role) sets winner + SR deltas
-- on both profiles.comp — clients can't cross-write each other's competitive rank.
create table public.duels (
  id bigint generated always as identity primary key,
  challenger uuid not null references public.profiles(id) on delete cascade,
  opponent   uuid not null references public.profiles(id) on delete cascade,
  ex_id text not null,
  status text not null default 'pending' check (status in ('pending','active','done','declined')),
  c_weight numeric, c_photo text, c_at timestamptz,
  o_weight numeric, o_photo text, o_at timestamptz,
  winner uuid, c_delta int, o_delta int,
  created_at timestamptz default now()
);
create index duels_party_idx on public.duels (challenger, opponent);

create table public.messages (
  id bigint generated always as identity primary key,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user   uuid not null references public.profiles(id) on delete cascade,
  text text,
  routine jsonb,
  created_at timestamptz default now()
);
create index messages_pair_idx on public.messages (from_user, to_user, created_at);

alter table public.duels enable row level security;
alter table public.messages enable row level security;

-- duels: both parties read; challenger opens it; either party updates their own progress
-- (accept / decline / submit). Honor system per spec — resolution is server-side.
create policy "duels read" on public.duels for select to authenticated
  using (auth.uid() in (challenger, opponent));
create policy "duels create" on public.duels for insert to authenticated
  with check (challenger = auth.uid() and status = 'pending' and public.is_friend(opponent));
create policy "duels update party" on public.duels for update to authenticated
  using (auth.uid() in (challenger, opponent));
create policy "duels delete party" on public.duels for delete to authenticated
  using (auth.uid() in (challenger, opponent));

-- messages: only the two participants; you may only send as yourself, and only to a friend.
create policy "messages read own" on public.messages for select to authenticated
  using (auth.uid() in (from_user, to_user));
create policy "messages send" on public.messages for insert to authenticated
  with check (from_user = auth.uid() and public.is_friend(to_user));

alter publication supabase_realtime add table public.duels;
alter publication supabase_realtime add table public.messages;
