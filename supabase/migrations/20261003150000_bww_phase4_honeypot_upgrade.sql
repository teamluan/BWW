-- BWW Phase 4 – Honeypot Upgrade (Quelle: 04_HONEYPOT.md)
-- Idempotent: nur ADD COLUMN IF NOT EXISTS, keine Drops.
-- Phase-2-Tabellen (bww_honeypots/triggers/exemptions) bekommen exakt die
-- 04-Felder dazu. Legacy bww_honeypot_events bleibt unangetastet erhalten.
-- RLS bleibt an (Service-Role-Bypass, restriktive Guild-Policy).

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. bww_honeypots: 04-Felder
-- 04: id, guild_id, channel_id, name, description, action, delete_message,
--     timeout_enabled, timeout_duration, ban_enabled, log_channel_id,
--     enabled, created_at, updated_at
-- Bestand Phase 2: id, guild_id, name, channel_id, message_id, bait_text,
--     status, hit_count, created_at, updated_at (bleibt erhalten)
-- ============================================================================
alter table public.bww_honeypots add column if not exists description text;
alter table public.bww_honeypots add column if not exists action text default 'log_only';
alter table public.bww_honeypots add column if not exists delete_message boolean default true;
alter table public.bww_honeypots add column if not exists timeout_enabled boolean default false;
alter table public.bww_honeypots add column if not exists timeout_duration integer default 600;
alter table public.bww_honeypots add column if not exists ban_enabled boolean default false;
alter table public.bww_honeypots add column if not exists log_channel_id text;
alter table public.bww_honeypots add column if not exists enabled boolean default true;

do $$
begin
  -- enabled aus status ableiten (nur wo enabled noch NULL waere; Default true deckt Rest ab)
  begin
    update public.bww_honeypots set enabled = (status <> 'inactive' and status <> 'archived')
    where status in ('inactive', 'archived') and (enabled is distinct from false);
  exception when others then null;
  end;
  begin
    update public.bww_honeypots set enabled = true where enabled is null;
  exception when others then null;
  end;
  begin
    update public.bww_honeypots set action = 'log_only' where action is null or action = '';
  exception when others then null;
  end;
  begin
    update public.bww_honeypots set delete_message = true where delete_message is null;
  exception when others then null;
  end;
  begin
    update public.bww_honeypots set timeout_duration = 600 where timeout_duration is null or timeout_duration < 60;
  exception when others then null;
  end;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bww_honeypots_action_check') then
    alter table public.bww_honeypots add constraint bww_honeypots_action_check
      check (action in ('delete','warn','timeout','kick','ban','notify_staff','log_only'));
  end if;
end $$;

-- ============================================================================
-- 2. bww_honeypot_triggers: 04-Felder
-- 04: id, honeypot_id, guild_id, user_id, message_id, channel_id, content,
--     action, created_at
-- Bestand Phase 2: id, honeypot_id, guild_id, user_id, channel_id, message_id,
--     message_url, action_taken, created_at (bleibt erhalten)
-- ============================================================================
alter table public.bww_honeypot_triggers add column if not exists content text;
alter table public.bww_honeypot_triggers add column if not exists action text default 'log_only';
alter table public.bww_honeypot_triggers add column if not exists message_url text;
alter table public.bww_honeypot_triggers add column if not exists action_taken text default 'none';

do $$
begin
  begin
    update public.bww_honeypot_triggers set action = coalesce(nullif(action, ''), case action_taken
      when 'warn' then 'warn' when 'timeout' then 'timeout' when 'kick' then 'kick'
      when 'ban' then 'ban' when 'log' then 'notify_staff' else 'log_only' end, 'log_only')
    where action is null or action = '';
  exception when others then null;
  end;
  begin
    update public.bww_honeypot_triggers set action_taken = coalesce(nullif(action_taken, ''), case action
      when 'warn' then 'warn' when 'timeout' then 'timeout' when 'kick' then 'kick'
      when 'ban' then 'ban' when 'notify_staff' then 'log' else 'none' end, 'none')
    where action_taken is null or action_taken = '';
  exception when others then null;
  end;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bww_honeypot_triggers_action_check') then
    alter table public.bww_honeypot_triggers add constraint bww_honeypot_triggers_action_check
      check (action in ('delete','warn','timeout','kick','ban','notify_staff','log_only'));
  end if;
end $$;

-- ============================================================================
-- 3. bww_honeypot_exemptions: 04-Felder
-- 04: id, guild_id, user_id, role_id, reason, created_at
-- Bestand Phase 2: id, guild_id, exempt_type, exempt_id, reason, created_by,
--     created_at (bleibt erhalten)
-- ============================================================================
alter table public.bww_honeypot_exemptions add column if not exists user_id text;
alter table public.bww_honeypot_exemptions add column if not exists role_id text;

do $$
begin
  begin
    update public.bww_honeypot_exemptions set user_id = exempt_id
    where user_id is null and exempt_type = 'user' and exempt_id is not null;
  exception when others then null;
  end;
  begin
    update public.bww_honeypot_exemptions set role_id = exempt_id
    where role_id is null and exempt_type = 'role' and exempt_id is not null;
  exception when others then null;
  end;
end $$;

-- ============================================================================
-- 4. Indizes (02 Kap.6: guild_id, channel_id, message_id, user_id, created_at)
-- ============================================================================
create index if not exists bww_honeypots_guild_enabled_idx on public.bww_honeypots (guild_id, enabled);
create index if not exists bww_honeypots_channel_idx on public.bww_honeypots (guild_id, channel_id);
create index if not exists bww_honeypot_triggers_guild_created_idx on public.bww_honeypot_triggers (guild_id, created_at desc);
create index if not exists bww_honeypot_triggers_pot_idx on public.bww_honeypot_triggers (honeypot_id, created_at desc);
create index if not exists bww_honeypot_triggers_user_idx on public.bww_honeypot_triggers (guild_id, user_id);
create index if not exists bww_honeypot_exemptions_guild_idx on public.bww_honeypot_exemptions (guild_id);
create index if not exists bww_honeypot_exemptions_user_idx on public.bww_honeypot_exemptions (guild_id, user_id);
create index if not exists bww_honeypot_exemptions_role_idx on public.bww_honeypot_exemptions (guild_id, role_id);

-- ============================================================================
-- 5. RLS (02 Kap.5): ENABLE + Default-Deny + service_role + Guild-Read-Policy
-- (Phase 2 hat dies bereits; hier idempotent nachziehen fuer frische Stapel)
-- ============================================================================
alter table public.bww_honeypots enable row level security;
alter table public.bww_honeypot_triggers enable row level security;
alter table public.bww_honeypot_exemptions enable row level security;

revoke all on table public.bww_honeypots from anon, authenticated;
revoke all on table public.bww_honeypot_triggers from anon, authenticated;
revoke all on table public.bww_honeypot_exemptions from anon, authenticated;
grant select, insert, update, delete on table public.bww_honeypots to service_role;
grant select, insert, update, delete on table public.bww_honeypot_triggers to service_role;
grant select, insert, update, delete on table public.bww_honeypot_exemptions to service_role;

drop policy if exists bww_guild_isolated_read on public.bww_honeypots;
create policy bww_guild_isolated_read on public.bww_honeypots for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_honeypot_triggers;
create policy bww_guild_isolated_read on public.bww_honeypot_triggers for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_honeypot_exemptions;
create policy bww_guild_isolated_read on public.bww_honeypot_exemptions for select to authenticated using (public.bww_can_access_guild(guild_id));

-- ============================================================================
-- 6. updated_at Trigger (bww_touch_updated_at aus Phase 2, idempotent)
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'bww_honeypots_touch') then
    create trigger bww_honeypots_touch before update on public.bww_honeypots
      for each row execute function public.bww_touch_updated_at();
  end if;
end $$;

-- Legacy bww_honeypot_events wird bewusst NICHT angefasst (bleibt erhalten).
