-- BWW database migration
-- Only tables whose name starts with "bw_" are removed.
-- No other tables are touched.

do $$
declare
  table_name text;
begin
  for table_name in
    select tablename
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename like 'bw\\_%' escape '\\'
  loop
    execute format('drop table if exists public.%I cascade', table_name);
  end loop;
end
$$;

create table public.bw_bot_status (
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

create table public.bw_guilds (
  guild_id text primary key,
  name text not null,
  member_count integer not null default 0 check (member_count >= 0),
  icon_url text,
  joined_at timestamptz,
  updated_at timestamptz not null default now()
);

create index bw_guilds_updated_at_idx
  on public.bw_guilds (updated_at desc);

alter table public.bw_bot_status enable row level security;
alter table public.bw_guilds enable row level security;

create policy "public can read bot status"
  on public.bw_bot_status
  for select
  to anon, authenticated
  using (true);

create policy "public can read guild directory"
  on public.bw_guilds
  for select
  to anon, authenticated
  using (true);

-- Writes are intentionally not exposed to the public Data API.
-- The bot uses the server-side SUPABASE_SECRET_KEY to upsert status/guild data.
revoke insert, update, delete on public.bw_bot_status from anon, authenticated;
revoke insert, update, delete on public.bw_guilds from anon, authenticated;
grant select on public.bw_bot_status to anon, authenticated;
grant select on public.bw_guilds to anon, authenticated;

insert into public.bw_bot_status (id, status)
values ('primary', 'offline')
on conflict (id) do nothing;
