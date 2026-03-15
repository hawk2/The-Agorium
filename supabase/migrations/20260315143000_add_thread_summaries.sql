alter table public.posts add column if not exists threadsummary text null;
alter table public.posts add column if not exists threadsummaryargcount integer not null default 0;
alter table public.posts add column if not exists threadsummaryupdatedat timestamptz null;

update public.posts
set threadsummaryargcount = 0
where threadsummaryargcount is null;
