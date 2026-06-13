-- ASCEND Phase 4: social feed — posts + likes. A post's body lives in payload (JSON);
-- photos go to the private post-media bucket and are referenced by path.

-- Reusable: is the given user an accepted friend of the caller? (used by RLS)
create or replace function public.is_friend(other uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_a = auth.uid() and f.user_b = other)
        or (f.user_b = auth.uid() and f.user_a = other))
  );
$$;

create table public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('post','rankup','pr','workout')),
  payload jsonb not null default '{}',
  media_path text,
  created_at timestamptz default now()
);
create index posts_created_idx on public.posts (created_at desc);

create table public.likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table public.posts enable row level security;
alter table public.likes enable row level security;

-- posts: see your own + your accepted friends'; write/delete only your own.
create policy "posts read own+friends" on public.posts for select to authenticated
  using (user_id = auth.uid() or public.is_friend(user_id));
create policy "posts insert own" on public.posts for insert to authenticated
  with check (user_id = auth.uid());
create policy "posts delete own" on public.posts for delete to authenticated
  using (user_id = auth.uid());

-- likes: counts are not sensitive (and you only ever read likes on posts RLS already lets you see); write/remove only your own.
create policy "likes read" on public.likes for select to authenticated using (true);
create policy "likes insert own" on public.likes for insert to authenticated
  with check (user_id = auth.uid());
create policy "likes delete own" on public.likes for delete to authenticated
  using (user_id = auth.uid());

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.likes;

-- Private bucket for feed photos.
insert into storage.buckets (id, name, public) values ('post-media','post-media',false)
  on conflict (id) do nothing;

-- Any signed-in user can mint a signed URL for a post photo (paths only reach them via
-- posts they can already see); uploads/deletes are restricted to the user's own folder.
create policy "post-media read" on storage.objects for select to authenticated
  using (bucket_id = 'post-media');
create policy "post-media upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "post-media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
