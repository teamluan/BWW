-- BWW Phase 6 – Welcome Upgrade (Quelle: 06_WELCOME.md).
-- Idempotent: nur ADD COLUMN IF NOT EXISTS bei Luecke.
-- Phase-2-Tabellen bww_welcome/variables/logs existieren bereits.
-- Legacy-Spalten (title/banner_url/status, variable_key/default_value, sent_success/error) bleiben erhalten.
-- Regeln: nur bww_-Prefix, RLS an, Service-Role-Bypass, guild_id wo guild-bezogen.

-- 1) bww_welcome: Task-Felder exakt
-- enabled/channel_id/message/embed_id/dm_enabled/dm_message/auto_role_enabled/auto_role_id/delete_after.
-- Phase 2 hat guild_id/channel_id/title/message/embed_id/banner_url/enabled/status.
-- Wir ergaenzen dm_*, auto_role_*, delete_after.
alter table public.bww_welcome add column if not exists dm_enabled boolean not null default false;
alter table public.bww_welcome add column if not exists dm_message text;
alter table public.bww_welcome add column if not exists auto_role_enabled boolean not null default false;
alter table public.bww_welcome add column if not exists auto_role_id text;
alter table public.bww_welcome add column if not exists delete_after integer not null default 0;

do $$ begin
  begin
    update public.bww_welcome set delete_after = 0 where delete_after is null;
  exception when others then null; end;
  begin
    update public.bww_welcome set dm_enabled = false where dm_enabled is null;
  exception when others then null; end;
  begin
    update public.bww_welcome set auto_role_enabled = false where auto_role_enabled is null;
  exception when others then null; end;
end $$;

create index if not exists bww_welcome_guild_idx on public.bww_welcome (guild_id);
create index if not exists bww_welcome_guild_enabled_idx on public.bww_welcome (guild_id, enabled);

-- 2) bww_welcome_variables: Task-Felder name/value/enabled (+updated_at).
-- Phase 2 hat guild_id/variable_key/default_value/description.
-- Wir ergaenzen name/value/enabled und fuellen aus Bestand (variable_key/default_value).
alter table public.bww_welcome_variables add column if not exists name text;
alter table public.bww_welcome_variables add column if not exists value text;
alter table public.bww_welcome_variables add column if not exists enabled boolean not null default true;
alter table public.bww_welcome_variables add column if not exists updated_at timestamptz not null default now();

do $$ begin
  begin
    update public.bww_welcome_variables set name = coalesce(nullif(name, ''), variable_key, 'var-' || left(id::text, 8))
    where name is null or name = '';
  exception when others then null; end;
  begin
    update public.bww_welcome_variables set value = coalesce(value, default_value, '')
    where value is null;
  exception when others then null; end;
end $$;

create index if not exists bww_welcome_vars_guild_idx on public.bww_welcome_variables (guild_id);
create index if not exists bww_welcome_vars_guild_enabled_idx on public.bww_welcome_variables (guild_id, enabled);
-- Eindeutigkeit pro Guild + Name (idempotent, nur wenn Spalte befuellt).
create unique index if not exists bww_welcome_vars_guild_name_uidx on public.bww_welcome_variables (guild_id, name);

drop trigger if exists bww_welcome_vars_touch on public.bww_welcome_variables;
create trigger bww_welcome_vars_touch before update on public.bww_welcome_variables
for each row execute function public.bww_touch_updated_at();

drop trigger if exists bww_welcome_touch on public.bww_welcome;
create trigger bww_welcome_touch before update on public.bww_welcome
for each row execute function public.bww_touch_updated_at();

-- 3) bww_welcome_logs: Task-Felder guild/user/channel/message_id.
-- Phase 2 hat bereits guild_id/user_id/channel_id/message_id + sent_success/error.
-- Nur Indizes sicherstellen, keine Spaltenaenderung.
create index if not exists bww_welcome_logs_guild_created_idx on public.bww_welcome_logs (guild_id, created_at desc);
create index if not exists bww_welcome_logs_user_idx on public.bww_welcome_logs (guild_id, user_id);
create index if not exists bww_welcome_logs_channel_idx on public.bww_welcome_logs (channel_id);
create index if not exists bww_welcome_logs_message_idx on public.bww_welcome_logs (message_id);

-- 4) RLS sicherstellen (Phase 2 bereits aktiv; idempotent, kein Policy-Wechsel).
-- Prinzip User -> berechtigte Guild -> passende guild_id -> erlaubte Zeilen.
alter table public.bww_welcome enable row level security;
alter table public.bww_welcome_variables enable row level security;
alter table public.bww_welcome_logs enable row level security;

grant select, insert, update, delete on table public.bww_welcome to service_role;
grant select, insert, update, delete on table public.bww_welcome_variables to service_role;
grant select, insert, update, delete on table public.bww_welcome_logs to service_role;
