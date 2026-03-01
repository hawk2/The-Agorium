-- The Agorium - Supabase schema bootstrap
-- Run in Supabase SQL Editor for project: auboquhnqswseneeosyj

create table if not exists public.posts (
  id text primary key,
  type text not null check (type in ('debate', 'discussion', 'question')),
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  position text null check (position in ('for', 'against')),
  confidence integer null check (confidence between 0 and 100),
  whatwouldchangemymind text null,
  author text not null,
  createdat timestamptz not null default now(),
  argcount integer not null default 0,
  forcount integer not null default 0,
  againstcount integer not null default 0,
  mindchanges integer not null default 0
);

create table if not exists public.arguments (
  id text primary key,
  postid text not null references public.posts(id) on delete cascade,
  side text not null check (side in ('for', 'against')),
  body text not null,
  author text not null,
  createdat timestamptz not null default now(),
  steelmanned boolean not null default false,
  steelmancount integer not null default 0
);

create table if not exists public.votes (
  id text primary key,
  argid text not null unique references public.arguments(id) on delete cascade,
  up integer not null default 0,
  down integer not null default 0
);

create table if not exists public.tags (
  tag text primary key
);

create table if not exists public.mindchanges (
  id text primary key,
  postid text not null references public.posts(id) on delete cascade,
  text text not null,
  createdat timestamptz not null default now()
);

create table if not exists public.users (
  username_lc text primary key,
  username text not null,
  bio text not null default '',
  tagline text not null default '',
  occupation text not null default '',
  goals text not null default '',
  belief text not null default '',
  hobbies text not null default '',
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

create index if not exists idx_posts_createdat on public.posts (createdat desc);
create index if not exists idx_arguments_postid_createdat on public.arguments (postid, createdat asc);
create index if not exists idx_users_username on public.users (username);

alter table public.posts enable row level security;
alter table public.arguments enable row level security;
alter table public.votes enable row level security;
alter table public.tags enable row level security;
alter table public.mindchanges enable row level security;
alter table public.users enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.posts to anon, authenticated;
grant select, insert, update on public.arguments to anon, authenticated;
grant select, insert, update on public.votes to anon, authenticated;
grant select, insert, update on public.tags to anon, authenticated;
grant select, insert, update on public.mindchanges to anon, authenticated;
grant select, insert, update on public.users to anon, authenticated;

drop policy if exists "public read posts" on public.posts;
create policy "public read posts" on public.posts for select using (true);
drop policy if exists "public insert posts" on public.posts;
create policy "public insert posts"
on public.posts
for insert
to anon, authenticated
with check (
  auth.role() = 'authenticated'
  and length(trim(id)) >= 6
  and type in ('debate', 'discussion', 'question')
  and length(trim(title)) between 3 and 240
  and length(trim(body)) between 3 and 10000
  and length(trim(author)) between 2 and 60
  and (position is null or position in ('for', 'against'))
  and (confidence is null or confidence between 0 and 100)
  and argcount = 0
  and forcount = 0
  and againstcount = 0
  and mindchanges = 0
  and createdat between (now() - interval '1 day') and (now() + interval '10 minutes')
);
drop policy if exists "public update posts" on public.posts;
create policy "public update posts"
on public.posts
for update
to anon, authenticated
using (
  auth.role() = 'authenticated'
)
with check (
  auth.role() = 'authenticated'
  and length(trim(id)) >= 6
  and type in ('debate', 'discussion', 'question')
  and length(trim(title)) between 3 and 240
  and length(trim(body)) between 3 and 10000
  and length(trim(author)) between 2 and 60
  and (position is null or position in ('for', 'against'))
  and (confidence is null or confidence between 0 and 100)
  and argcount >= 0
  and forcount >= 0
  and againstcount >= 0
  and mindchanges >= 0
);

drop policy if exists "public read arguments" on public.arguments;
create policy "public read arguments" on public.arguments for select using (true);
drop policy if exists "public insert arguments" on public.arguments;
create policy "public insert arguments"
on public.arguments
for insert
to anon, authenticated
with check (
  auth.role() = 'authenticated'
  and length(trim(id)) >= 6
  and length(trim(postid)) >= 6
  and side in ('for', 'against')
  and length(trim(body)) between 3 and 5000
  and length(trim(author)) between 2 and 60
  and steelmanned = false
  and steelmancount = 0
  and createdat between (now() - interval '1 day') and (now() + interval '10 minutes')
);
drop policy if exists "public update arguments" on public.arguments;
create policy "public update arguments"
on public.arguments
for update
to anon, authenticated
using (
  auth.role() = 'authenticated'
)
with check (
  auth.role() = 'authenticated'
  and length(trim(id)) >= 6
  and length(trim(postid)) >= 6
  and side in ('for', 'against')
  and length(trim(body)) between 3 and 5000
  and length(trim(author)) between 2 and 60
  and steelmancount >= 0
);

drop policy if exists "public read votes" on public.votes;
create policy "public read votes" on public.votes for select using (true);
drop policy if exists "public insert votes" on public.votes;
create policy "public insert votes"
on public.votes
for insert
to anon, authenticated
with check (
  auth.role() = 'authenticated'
  and length(trim(id)) >= 6
  and id = argid
  and up >= 0
  and down >= 0
  and up <= 1000000
  and down <= 1000000
);
drop policy if exists "public update votes" on public.votes;
create policy "public update votes"
on public.votes
for update
to anon, authenticated
using (
  auth.role() = 'authenticated'
)
with check (
  auth.role() = 'authenticated'
  and length(trim(id)) >= 6
  and id = argid
  and up >= 0
  and down >= 0
  and up <= 1000000
  and down <= 1000000
);

drop policy if exists "public read tags" on public.tags;
create policy "public read tags" on public.tags for select using (true);
drop policy if exists "public insert tags" on public.tags;
create policy "public insert tags"
on public.tags
for insert
to anon, authenticated
with check (
  auth.role() = 'authenticated'
  and length(trim(tag)) between 2 and 40
  and tag = lower(tag)
  and tag ~ '^[a-z0-9][a-z0-9 _-]{1,39}$'
);
drop policy if exists "public update tags" on public.tags;
create policy "public update tags"
on public.tags
for update
to anon, authenticated
using (
  auth.role() = 'authenticated'
)
with check (
  auth.role() = 'authenticated'
  and length(trim(tag)) between 2 and 40
  and tag = lower(tag)
  and tag ~ '^[a-z0-9][a-z0-9 _-]{1,39}$'
);

drop policy if exists "public read mindchanges" on public.mindchanges;
create policy "public read mindchanges" on public.mindchanges for select using (true);
drop policy if exists "public insert mindchanges" on public.mindchanges;
create policy "public insert mindchanges"
on public.mindchanges
for insert
to anon, authenticated
with check (
  auth.role() = 'authenticated'
  and length(trim(id)) >= 6
  and length(trim(postid)) >= 6
  and length(trim(text)) between 3 and 4000
  and createdat between (now() - interval '1 day') and (now() + interval '10 minutes')
);
drop policy if exists "public update mindchanges" on public.mindchanges;
create policy "public update mindchanges"
on public.mindchanges
for update
to anon, authenticated
using (
  auth.role() = 'authenticated'
)
with check (
  auth.role() = 'authenticated'
  and length(trim(id)) >= 6
  and length(trim(postid)) >= 6
  and length(trim(text)) between 3 and 4000
);

drop policy if exists "public read users" on public.users;
create policy "public read users" on public.users for select using (true);
drop policy if exists "public insert users" on public.users;
create policy "public insert users"
on public.users
for insert
to anon, authenticated
with check (
  auth.role() = 'authenticated'
  and username_lc = lower(trim(username_lc))
  and username_lc = lower(trim(username))
  and username ~ '^[A-Za-z0-9_.-]{2,30}$'
  and length(bio) <= 1200
  and length(tagline) <= 120
  and length(occupation) <= 80
  and length(goals) <= 400
  and length(belief) <= 400
  and length(hobbies) <= 160
  and createdat between (now() - interval '1 day') and (now() + interval '10 minutes')
);
drop policy if exists "public update users" on public.users;
create policy "public update users"
on public.users
for update
to anon, authenticated
using (
  auth.role() = 'authenticated'
)
with check (
  auth.role() = 'authenticated'
  and username_lc = lower(trim(username_lc))
  and username_lc = lower(trim(username))
  and username ~ '^[A-Za-z0-9_.-]{2,30}$'
  and length(bio) <= 1200
  and length(tagline) <= 120
  and length(occupation) <= 80
  and length(goals) <= 400
  and length(belief) <= 400
  and length(hobbies) <= 160
);
