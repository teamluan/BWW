-- BWW Phase 1 – Fundament (01_ARCHITECTURE + 14_IMPLEMENTATION Phase 1).
-- Idempotent: laeuft auf bestehenden Staenden ohne Datenverlust.
-- Regeln: nur bww_-Tabellen, RLS an, anon/authenticated nur lesen wo öffentlich.

-- Audit-Log (zentral, alle Module -> audit Service)
create table if not exists public.bww_audit_logs (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  actor_id text,
  action text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bww_audit_logs_guild_idx on public.bww_audit_logs (guild_id, created_at desc);
create index if not exists bww_audit_logs_action_idx on public.bww_audit_logs (action);

-- Guild-Verzeichnis + Settings sicherstellen (falls zentrale Migration fehlt)
create table if not exists public.bww_guilds (
  guild_id text primary key,
  name text not null default 'Unbekannt',
  member_count integer not null default 0 check (member_count >= 0),
  icon_url text,
  joined_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.bww_guild_settings (
  guild_id text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint bww_guild_settings_object_check check (jsonb_typeof(settings) = 'object')
);

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

insert into public.bww_bot_status (id, status) values ('primary', 'offline') on conflict (id) do nothing;

alter table public.bww_audit_logs enable row level security;
alter table public.bww_guild_settings enable row level security;
alter table public.bww_guilds enable row level security;
alter table public.bww_bot_status enable row level security;

-- Oeffentlich lesbar: Bot-Status + Guild-Verzeichnis (Dashboard ohne Login)
drop policy if exists "public can read bww bot status" on public.bww_bot_status;
create policy "public can read bww bot status" on public.bww_bot_status for select to anon, authenticated using (true);

drop policy if exists "public can read bww guild directory" on public.bww_guilds;
create policy "public can read bww guild directory" on public.bww_guilds for select to anon, authenticated using (true);

-- settings + audit: kein direkter anon/authenticated-Zugriff (nur service_role via Bot/Website-Server)
revoke all on table public.bww_guild_settings from anon, authenticated;
revoke all on table public.bww_audit_logs from anon, authenticated;
revoke insert, update, delete on table public.bww_bot_status from anon, authenticated;
revoke insert, update, delete on table public.bww_guilds from anon, authenticated;
grant select on table public.bww_bot_status to anon, authenticated;
grant select on table public.bww_guilds to anon, authenticated;
grant select, insert, update, delete on table public.bww_guild_settings to service_role;
grant select, insert, update, delete on table public.bww_guilds to service_role;
grant select, insert, update, delete on table public.bww_bot_status to service_role;
grant select, insert on table public.bww_audit_logs to service_role;
