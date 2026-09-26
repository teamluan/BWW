create table if not exists public.bww_bot_status (
  id text primary key default 'primary',
  bot_user_id text,
  bot_tag text,
  guild_count integer not null default 0 check (guild_count >= 0),
  member_count bigint not null default 0 check (member_count >= 0),
  ping_ms integer,
  uptime_seconds bigint not null default 0 check (uptime_seconds >= 0),
  status text not null default 'offline' check (status in ('online', 'offline', 'maintenance')),
  updated_at timestamptz not null default now()
);

create table if not exists public.bww_guilds (
  guild_id text primary key,
  name text not null,
  member_count integer not null default 0 check (member_count >= 0),
  icon_url text,
  joined_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists bww_guilds_updated_at_idx on public.bww_guilds (updated_at desc);

alter table public.bww_bot_status enable row level security;
alter table public.bww_guilds enable row level security;

drop policy if exists "public can read bot status" on public.bww_bot_status;
create policy "public can read bot status"
  on public.bww_bot_status
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public can read guild directory" on public.bww_guilds;
create policy "public can read guild directory"
  on public.bww_guilds
  for select
  to anon, authenticated
  using (true);

-- Writes are intentionally not exposed to the public Data API.
-- The bot uses the server-side SUPABASE_SECRET_KEY to upsert status/guild data.

revoke insert, update, delete on public.bww_bot_status from anon, authenticated;
revoke insert, update, delete on public.bww_guilds from anon, authenticated;
grant select on public.bww_bot_status to anon, authenticated;
grant select on public.bww_guilds to anon, authenticated;

insert into public.bww_bot_status (id, status)
values ('primary', 'offline')
on conflict (id) do nothing;
