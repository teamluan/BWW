-- BWW centralized guild configuration
-- Settings are stored in bww_ tables and edited through Discord commands or the website.
-- The legacy bw_ dashboard tables remain for compatibility; the application uses bww_ tables.

create table if not exists public.bww_guild_settings (
  guild_id text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint bww_guild_settings_object_check
    check (jsonb_typeof(settings) = 'object')
);

create table if not exists public.bww_dashboard_logins (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists bww_dashboard_logins_guild_idx
  on public.bww_dashboard_logins (guild_id);

create index if not exists bww_dashboard_logins_expires_idx
  on public.bww_dashboard_logins (expires_at);

-- Canonical public dashboard tables.
create table if not exists public.bww_bot_status (
  id text primary key default 'primary',
  bot_user_id text,
  bot_tag text,
  guild_count integer not null default 0 check (guild_count >= 0),
  member_count bigint not null default 0 check (member_count >= 0),
  ping_ms integer,
  uptime_seconds bigint not null default 0 check (uptime_seconds >= 0),
  status text not null default 'offline'
    check (status in ('online', 'offline', 'maintenance')),
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

-- Carry existing dashboard rows forward when the bww_ tables are new.
insert into public.bww_bot_status (
  id, bot_user_id, bot_tag, guild_count, member_count, ping_ms,
  uptime_seconds, status, updated_at
)
select
  id, bot_user_id, bot_tag, guild_count, member_count, ping_ms,
  uptime_seconds, status, updated_at
from public.bw_bot_status
on conflict (id) do nothing;

insert into public.bww_guilds (
  guild_id, name, member_count, icon_url, joined_at, updated_at
)
select
  guild_id, name, member_count, icon_url, joined_at, updated_at
from public.bw_guilds
on conflict (guild_id) do nothing;

alter table public.bww_guild_settings enable row level security;
alter table public.bww_dashboard_logins enable row level security;
alter table public.bww_bot_status enable row level security;
alter table public.bww_guilds enable row level security;

drop policy if exists "public can read bww bot status" on public.bww_bot_status;
create policy "public can read bww bot status"
  on public.bww_bot_status
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public can read bww guild directory" on public.bww_guilds;
create policy "public can read bww guild directory"
  on public.bww_guilds
  for select
  to anon, authenticated
  using (true);

revoke all on table public.bww_guild_settings from anon, authenticated;
revoke all on table public.bww_dashboard_logins from anon, authenticated;
revoke insert, update, delete on table public.bww_bot_status from anon, authenticated;
revoke insert, update, delete on table public.bww_guilds from anon, authenticated;

grant select on table public.bww_bot_status to anon, authenticated;
grant select on table public.bww_guilds to anon, authenticated;
grant select, insert, update, delete on table public.bww_guild_settings to service_role;
grant select, insert, update, delete on table public.bww_dashboard_logins to service_role;

insert into public.bww_bot_status (id, status)
values ('primary', 'offline')
on conflict (id) do nothing;
