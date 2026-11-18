-- AutoBattler online matchmaking schema.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.

create table if not exists public.armies (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  player_id   uuid not null,
  name        text not null check (char_length(name) between 1 and 24),
  version     int  not null check (version between 1 and 1000),
  round       int  not null check (round between 1 and 40),
  wins        int  not null check (wins between 0 and 10),
  lives       int  not null check (lives between 0 and 7),
  army        jsonb not null check (
    jsonb_typeof(army -> 'squads') = 'array'
    and jsonb_array_length(army -> 'squads') between 1 and 5
    and jsonb_typeof(army -> 'modules') = 'object'
    and pg_column_size(army) < 4000
  )
);

create index if not exists armies_match_idx on public.armies (version, round, created_at desc);

-- Row level security: the public (anon) key may only INSERT.
-- Nobody can read, update or delete rows directly; reads go through find_opponent().
alter table public.armies enable row level security;

drop policy if exists "anyone can submit an army" on public.armies;
create policy "anyone can submit an army" on public.armies
  for insert to anon, authenticated
  with check (created_at > now() - interval '1 minute');

-- Matchmaking: a random army from the most recent 200 at this round and game version,
-- never your own. Returns only what the game needs (no player ids).
create or replace function public.find_opponent(p_version int, p_round int, p_player uuid)
returns table (name text, round int, wins int, lives int, army jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select r.name, r.round, r.wins, r.lives, r.army
  from (
    select a.name, a.round, a.wins, a.lives, a.army
    from public.armies a
    where a.version = p_version and a.round = p_round and a.player_id <> p_player
    order by a.created_at desc
    limit 200
  ) r
  order by random()
  limit 1;
$$;

revoke all on function public.find_opponent(int, int, uuid) from public;
grant execute on function public.find_opponent(int, int, uuid) to anon, authenticated;

-- Optional housekeeping: keep the table small (run occasionally, or schedule with pg_cron).
-- delete from public.armies where created_at < now() - interval '14 days';
