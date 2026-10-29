-- BWW Phase 8 - Verification-Upgrade (Quelle: 08_VERIFICATION.md, 02_DATABASE.md).
-- Idempotent: nur ADD COLUMN IF NOT EXISTS bei Luecke (Phase-2-Tabellen bleiben bestehen).
-- Neu: enabled/verification_channel_id/verification_role_id/log_channel_id/code_validity/rate-limit-Felder,
-- users: discord_user_id/verification_status/verification_code/verified_by/expires_at,
-- codes: code/used, attempts: user_agent, logs: result/reason. Nur bww_-Prefix, RLS, Datenschutz (ip_hash statt IP).

-- 1. bww_verification: exakte Phase-8-Felder
 alter table public.bww_verification add column if not exists enabled boolean default true;
 alter table public.bww_verification add column if not exists verification_channel_id text;
 alter table public.bww_verification add column if not exists verification_role_id text;
 alter table public.bww_verification add column if not exists log_channel_id text;
 alter table public.bww_verification add column if not exists code_validity_minutes integer default 10;
 alter table public.bww_verification add column if not exists max_attempts integer default 5;
 alter table public.bww_verification add column if not exists attempt_window_minutes integer default 10;
 alter table public.bww_verification add column if not exists updated_at timestamptz default now();
do $$ begin
  begin update public.bww_verification set verification_channel_id = channel_id where verification_channel_id is null and channel_id is not null; exception when others then null; end;
  begin update public.bww_verification set verification_role_id = verified_role_id where verification_role_id is null and verified_role_id is not null; exception when others then null; end;
  begin update public.bww_verification set verified_role_id = verification_role_id where verified_role_id is null and verification_role_id is not null; exception when others then null; end;
  begin update public.bww_verification set enabled = (status <> 'inactive' and status <> 'draft') where enabled is null; exception when others then null; end;
  begin update public.bww_verification set enabled = true where enabled is null; exception when others then null; end;
  begin update public.bww_verification set code_validity_minutes = 10 where code_validity_minutes is null; exception when others then null; end;
  begin update public.bww_verification set max_attempts = 5 where max_attempts is null; exception when others then null; end;
  begin update public.bww_verification set attempt_window_minutes = 10 where attempt_window_minutes is null; exception when others then null; end;
end $$;
-- Methode: button/code/captcha (+legacy oauth/manual lesbar)
do $$ begin
  begin alter table public.bww_verification drop constraint if exists bww_verification_method_check; exception when others then null; end;
  if not exists (select 1 from pg_constraint where conname = 'bww_verification_method_phase8_check') then
    alter table public.bww_verification add constraint bww_verification_method_phase8_check
      check (method in ('button','captcha','code','oauth','manual'));
  end if;
end $$;

-- 2. bww_verification_users: discord_user_id/verification_status/verification_code/verified_by/expires_at
 alter table public.bww_verification_users add column if not exists discord_user_id text;
 alter table public.bww_verification_users add column if not exists verification_status text;
 alter table public.bww_verification_users add column if not exists verification_code text;
 alter table public.bww_verification_users add column if not exists verified_by text;
 alter table public.bww_verification_users add column if not exists expires_at timestamptz;
do $$ begin
  begin update public.bww_verification_users set discord_user_id = user_id where discord_user_id is null and user_id is not null; exception when others then null; end;
  begin update public.bww_verification_users set verification_status = status where verification_status is null and status is not null; exception when others then null; end;
  begin update public.bww_verification_users set status = verification_status where status is null and verification_status is not null; exception when others then null; end;
end $$;
do $$ begin
  begin alter table public.bww_verification_users drop constraint if exists bww_verification_users_status_check; exception when others then null; end;
  if not exists (select 1 from pg_constraint where conname = 'bww_verification_users_status_phase8_check') then
    alter table public.bww_verification_users add constraint bww_verification_users_status_phase8_check
      check (status in ('pending','verified','failed','blocked','expired'));
  end if;
end $$;

-- 3. bww_verification_codes: code/used (+code_hash/used_at Bestand)
 alter table public.bww_verification_codes add column if not exists code text;
 alter table public.bww_verification_codes add column if not exists used boolean default false;
do $$ begin
  begin update public.bww_verification_codes set used = (used_at is not null) where used is null; exception when others then null; end;
  begin update public.bww_verification_codes set used = false where used is null; exception when others then null; end;
end $$;

-- 4. bww_verification_attempts: user_agent (ip_hash Bestand, KEINE Klartext-IP-Spalte!)
 alter table public.bww_verification_attempts add column if not exists user_agent text;
 alter table public.bww_verification_attempts add column if not exists user_id text;
-- Datenschutz: sicherstellen, dass KEINE ip-Spalte (Klartext) existiert -> falls legacy vorhanden, nicht nutzen (Service nutzt nur ip_hash).

-- 5. bww_verification_logs: result/reason (+details/actor Bestand)
 alter table public.bww_verification_logs add column if not exists result text;
 alter table public.bww_verification_logs add column if not exists reason text;
do $$ begin
  begin alter table public.bww_verification_logs drop constraint if exists bww_verification_logs_action_check; exception when others then null; end;
  if not exists (select 1 from pg_constraint where conname = 'bww_verification_logs_action_phase8_check') then
    alter table public.bww_verification_logs add constraint bww_verification_logs_action_phase8_check
      check (action in ('request','verify','fail','block','unblock','expire','join','assign','success','failed','reset','status','code_created','code_consumed','rate_limited','panel','button','modal'));
  end if;
end $$;

-- 6. RLS (Kap.5: Default-Deny anon/authenticated, service_role via Server-Layer, guild-isolierte Read-Policy)
 alter table public.bww_verification enable row level security;
 alter table public.bww_verification_users enable row level security;
 alter table public.bww_verification_attempts enable row level security;
 alter table public.bww_verification_codes enable row level security;
 alter table public.bww_verification_logs enable row level security;
 revoke all on table public.bww_verification from anon, authenticated;
 revoke all on table public.bww_verification_users from anon, authenticated;
 revoke all on table public.bww_verification_attempts from anon, authenticated;
 revoke all on table public.bww_verification_codes from anon, authenticated;
 revoke all on table public.bww_verification_logs from anon, authenticated;
 grant select, insert, update, delete on table public.bww_verification to service_role;
 grant select, insert, update, delete on table public.bww_verification_users to service_role;
 grant select, insert, update, delete on table public.bww_verification_attempts to service_role;
 grant select, insert, update, delete on table public.bww_verification_codes to service_role;
 grant select, insert, update, delete on table public.bww_verification_logs to service_role;
 drop policy if exists bww_guild_isolated_read on public.bww_verification;
 create policy bww_guild_isolated_read on public.bww_verification for select to authenticated using (public.bww_can_access_guild(guild_id));
 drop policy if exists bww_guild_isolated_read on public.bww_verification_users;
 create policy bww_guild_isolated_read on public.bww_verification_users for select to authenticated using (public.bww_can_access_guild(guild_id));
 drop policy if exists bww_guild_isolated_read on public.bww_verification_attempts;
 create policy bww_guild_isolated_read on public.bww_verification_attempts for select to authenticated using (public.bww_can_access_guild(guild_id));
 drop policy if exists bww_guild_isolated_read on public.bww_verification_codes;
 create policy bww_guild_isolated_read on public.bww_verification_codes for select to authenticated using (public.bww_can_access_guild(guild_id));
 drop policy if exists bww_guild_isolated_read on public.bww_verification_logs;
 create policy bww_guild_isolated_read on public.bww_verification_logs for select to authenticated using (public.bww_can_access_guild(guild_id));

-- 7. Indizes (Kap.6: guild_id/user_id/status/expires_at/created_at)
 create index if not exists bww_verification_phase8_guild_idx on public.bww_verification (guild_id);
 create index if not exists bww_verification_users_phase8_guild_user_idx on public.bww_verification_users (guild_id, user_id);
 create index if not exists bww_verification_users_phase8_status_idx on public.bww_verification_users (guild_id, status);
 create index if not exists bww_verification_codes_phase8_user_idx on public.bww_verification_codes (guild_id, user_id, created_at desc);
 create index if not exists bww_verification_codes_phase8_expiry_idx on public.bww_verification_codes (expires_at);
 create index if not exists bww_verification_attempts_phase8_user_idx on public.bww_verification_attempts (guild_id, user_id, created_at desc);
 create index if not exists bww_verification_logs_phase8_guild_idx on public.bww_verification_logs (guild_id, created_at desc);
