-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text    not null check (char_length(name) between 1 and 16),
  score      integer not null check (score between 0 and 100000),
  won        boolean not null default false,
  title      text    check (title is null or char_length(title) <= 40),
  created_at timestamptz not null default now()
);

create index if not exists scores_rank_idx on public.scores (score desc, created_at asc);

alter table public.scores enable row level security;

-- Visitors can read the board and add a score. There is deliberately no update or delete policy,
-- so nobody can edit or remove rows from the browser. Moderate from the Supabase dashboard.
drop policy if exists "anyone can read scores" on public.scores;
create policy "anyone can read scores" on public.scores for select to anon using (true);

drop policy if exists "anyone can add a score" on public.scores;
create policy "anyone can add a score" on public.scores for insert to anon with check (true);

grant select, insert on public.scores to anon;
