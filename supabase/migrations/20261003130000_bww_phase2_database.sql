-- BWW Phase 2 – vollstaendiges Datenmodell (Quelle: 02_DATABASE.md)
-- Idempotent: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Regeln: nur bww_-Tabellen, guild_id wo guild-bezogen, created_at immer,
-- updated_at bei veraenderlichen Daten, uuid PK default gen_random_uuid(),
-- RLS an, Service-Role-Bypass, keine Secrets.
--
-- Abdeckung (35 Tabellen):
-- Core (4): bww_guilds, bww_guild_settings, bww_guild_roles, bww_guild_channels
-- Tickets (7): bww_ticket_panels, bww_ticket_types, bww_tickets, bww_ticket_members,
--   bww_ticket_messages, bww_ticket_actions, bww_ticket_templates
-- Honeypot (3): bww_honeypots, bww_honeypot_triggers, bww_honeypot_exemptions
--   (Legacy bww_honeypot_events bleibt erhalten)
-- Embed V2 (5): bww_embeds, bww_embed_components, bww_embed_actions,
--   bww_embed_select_options, bww_embed_buttons
--   (Legacy bww_embed_templates bleibt erhalten)
-- Welcome (3): bww_welcome, bww_welcome_variables, bww_welcome_logs
-- Giveaways (5): bww_giveaways, bww_giveaway_entries, bww_giveaway_winners,
--   bww_giveaway_requirements, bww_giveaway_rerolls
-- Verification (5): bww_verification, bww_verification_users, bww_verification_attempts,
--   bww_verification_codes, bww_verification_logs
-- Global (3): bww_audit_logs, bww_system_logs, bww_notifications
-- Storage (Kap.8): Buckets bww-ticket-transcripts, bww-exports, bww-assets (siehe unten).
-- Keine Bot-Logik aus 03-08, nur DB.

create extension if not exists "pgcrypto";

-- ============================================================================
-- 0. Helper: updated_at Trigger + Guild-Autorisierung (Kap.5)
-- Prinzip: User -> berechtigte Guild -> passende guild_id -> erlaubte Zeilen.
-- Authentifizierung (authenticated Rolle) und Autorisierung (guild_id-Check)
-- werden getrennt geprueft. Service-Role umgeht RLS (Server-Layer: Bot/Dashboard).
-- ============================================================================
create or replace function public.bww_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Liefert true nur wenn JWT app_metadata.guild_id mit der Zeilen-guild_id matcht.
-- Keine Abhaengigkeit vom auth-Schema (portabel via current_setting).
create or replace function public.bww_can_access_guild(p_guild_id text)
returns boolean language plpgsql stable security definer as $$
declare v_guild text;
begin
  if p_guild_id is null or p_guild_id = '' then return false; end if;
  begin
    v_guild := nullif((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'guild_id'), '');
  exception when others then return false;
  end;
  if v_guild is null then return false; end if;
  return v_guild = p_guild_id;
end;
$$;

-- ============================================================================
-- 1. CORE (Kap.2 exakt)
-- ============================================================================
create table if not exists public.bww_guilds (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null unique,
  guild_name text not null default 'Unbekannt',
  name text,
  icon_url text,
  owner_id text,
  enabled boolean not null default true,
  member_count integer not null default 0 check (member_count >= 0),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bww_guilds_guild_id_len check (char_length(guild_id) between 1 and 32)
);

create table if not exists public.bww_guild_settings (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null unique,
  language text not null default 'de',
  timezone text not null default 'Europe/Berlin',
  prefix text not null default '!',
  dashboard_enabled boolean not null default true,
  logging_enabled boolean not null default true,
  maintenance_mode boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bww_guild_settings_object_check check (jsonb_typeof(settings) = 'object')
);

create table if not exists public.bww_guild_roles (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  role_id text not null,
  role_name text,
  role_type text not null default 'custom'
    check (role_type in ('admin','mod','member','bot','custom','verification','ticket','giveaway','honeypot')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint bww_guild_roles_guild_role_unique unique (guild_id, role_id)
);

create table if not exists public.bww_guild_channels (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text not null,
  channel_type text not null default 'custom'
    check (channel_type in ('custom','welcome','log','ticket','honeypot','giveaway','verification','announcement','transcript')),
  channel_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint bww_guild_channels_guild_channel_unique unique (guild_id, channel_id)
);

-- ============================================================================
-- 2. TICKETS (7)
-- bww_tickets existiert bereits (Text-IDs = Discord-Snowflakes) und wird
-- NICHT neu definiert (nur Upgrade via ADD COLUMN unten).
-- ============================================================================
create table if not exists public.bww_ticket_panels (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  panel_key text not null default 'default',
  channel_id text,
  message_id text,
  title text not null default 'Support',
  description text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bww_ticket_panels_guild_key_unique unique (guild_id, panel_key)
);

create table if not exists public.bww_ticket_types (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  panel_id uuid,
  type_key text not null,
  name text not null,
  description text,
  emoji text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bww_ticket_types_guild_key_unique unique (guild_id, type_key)
);

-- Falls frische DB ohne Legacy-Migration: Minimal-Definition kompatibel zu
-- 20261003090048_bww_tickets.sql (id text PK). Bestehende DB: No-Op.
create table if not exists public.bww_tickets (
  id text primary key,
  guild_id text not null,
  panel_id uuid,
  type_id uuid,
  channel_id text,
  owner_id text not null,
  user_id text,
  message_id text,
  reason text not null default 'Kein Grund angegeben',
  description text,
  status text not null default 'open' check (status in ('open','locked','closed','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  claimed_by text,
  participant_ids jsonb not null default '[]'::jsonb,
  transcript_url text,
  transcript_message_id text,
  log_message_id text,
  panel_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text,
  close_reason text,
  reopened_at timestamptz
);

create table if not exists public.bww_ticket_members (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null,
  guild_id text not null,
  user_id text not null,
  role text not null default 'member' check (role in ('owner','member','staff')),
  created_at timestamptz not null default now(),
  constraint bww_ticket_members_ticket_user_unique unique (ticket_id, user_id)
);

create table if not exists public.bww_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null,
  guild_id text not null,
  user_id text,
  message_id text,
  content text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bww_ticket_actions (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null,
  guild_id text not null,
  action text not null
    check (action in ('create','claim','assign','close','reopen','lock','unlock','transcript','note','priority','rename')),
  actor_id text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bww_ticket_templates (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  template_key text not null,
  title text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bww_ticket_templates_guild_key_unique unique (guild_id, template_key)
);

-- ============================================================================
-- 3. HONEYPOT (3) – bww_honeypot_events (Legacy) bleibt erhalten
-- ============================================================================
create table if not exists public.bww_honeypots (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  name text not null default 'honeypot',
  channel_id text,
  message_id text,
  bait_text text,
  status text not null default 'active' check (status in ('active','inactive','triggered','archived')),
  hit_count integer not null default 0 check (hit_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bww_honeypots_guild_name_unique unique (guild_id, name)
);

create table if not exists public.bww_honeypot_triggers (
  id uuid primary key default gen_random_uuid(),
  honeypot_id uuid,
  guild_id text not null,
  user_id text not null,
  channel_id text,
  message_id text,
  message_url text,
  action_taken text not null default 'none'
    check (action_taken in ('none','warn','timeout','kick','ban','log')),
  created_at timestamptz not null default now()
);

create table if not exists public.bww_honeypot_exemptions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  exempt_type text not null check (exempt_type in ('user','role','channel')),
  exempt_id text not null,
  reason text,
  created_by text,
  created_at timestamptz not null default now(),
  constraint bww_honeypot_exempt_unique unique (guild_id, exempt_type, exempt_id)
);

-- ============================================================================
-- 4. EMBED V2 (5) – bww_embed_templates (Legacy) bleibt erhalten
-- ============================================================================
create table if not exists public.bww_embeds (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  embed_key text not null,
  title text,
  description text,
  color text not null default '#5865F2',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  channel_id text,
  message_id text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bww_embeds_guild_key_unique unique (guild_id, embed_key)
);

create table if not exists public.bww_embed_components (
  id uuid primary key default gen_random_uuid(),
  embed_id uuid,
  guild_id text not null,
  component_type text not null
    check (component_type in ('button','select','container','section','text','media','action_row')),
  position integer not null default 0 check (position >= 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bww_embed_actions (
  id uuid primary key default gen_random_uuid(),
  embed_id uuid,
  component_id uuid,
  guild_id text not null,
  action_type text not null
    check (action_type in ('send','update','dm','role_assign','role_remove','ticket_create','open_url','custom')),
  payload jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.bww_embed_select_options (
  id uuid primary key default gen_random_uuid(),
  component_id uuid,
  embed_id uuid,
  guild_id text not null,
  label text not null,
  value text not null,
  description text,
  emoji text,
  is_default boolean not null default false,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.bww_embed_buttons (
  id uuid primary key default gen_random_uuid(),
  component_id uuid,
  embed_id uuid,
  guild_id text not null,
  label text not null,
  custom_id text not null,
  style text not null default 'primary'
    check (style in ('primary','secondary','success','danger','link')),
  url text,
  disabled boolean not null default false,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  constraint bww_embed_buttons_guild_custom_unique unique (guild_id, custom_id)
);

-- ============================================================================
-- 5. WELCOME (3)
-- ============================================================================
create table if not exists public.bww_welcome (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null unique,
  channel_id text,
  title text,
  message text,
  embed_id uuid,
  banner_url text,
  enabled boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive','draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bww_welcome_variables (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  variable_key text not null,
  default_value text,
  description text,
  created_at timestamptz not null default now(),
  constraint bww_welcome_vars_guild_key_unique unique (guild_id, variable_key)
);

create table if not exists public.bww_welcome_logs (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  channel_id text,
  message_id text,
  sent_success boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 6. GIVEAWAYS – 3 existieren (Text-IDs), 2 neu
-- ============================================================================
create table if not exists public.bww_giveaways (
  id text primary key,
  guild_id text not null,
  channel_id text not null,
  message_id text,
  prize text not null,
  winner_count integer not null default 1 check (winner_count between 1 and 100),
  end_at timestamptz not null default (now() + interval '7 days'),
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active','ended','cancelled')),
  created_by text,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  current_winners jsonb not null default '[]'::jsonb,
  winner_history jsonb not null default '[]'::jsonb,
  required_role_id text,
  bonus_role_id text,
  min_account_age_days integer not null default 0 check (min_account_age_days between 0 and 3650),
  min_server_age_days integer not null default 0 check (min_server_age_days between 0 and 3650),
  bonus_entries integer not null default 0 check (bonus_entries between 0 and 20),
  entry_count integer not null default 0 check (entry_count >= 0),
  constraint bww_giveaways_time_valid check (ended_at is null or ended_at >= created_at)
);

create table if not exists public.bww_giveaway_entries (
  giveaway_id text not null,
  user_id text not null,
  entered_at timestamptz not null default now(),
  entry_count integer not null default 1 check (entry_count between 1 and 21),
  primary key (giveaway_id, user_id)
);

create table if not exists public.bww_giveaway_winners (
  id bigint generated by default as identity primary key,
  giveaway_id text not null,
  user_id text not null,
  draw_type text not null check (draw_type in ('initial','reroll')),
  draw_number integer not null default 1 check (draw_number >= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.bww_giveaway_requirements (
  id uuid primary key default gen_random_uuid(),
  giveaway_id text not null,
  guild_id text not null,
  requirement_type text not null
    check (requirement_type in ('role','min_account_age_days','min_server_age_days','invite_count','message_count','bonus')),
  requirement_value text not null,
  created_at timestamptz not null default now(),
  constraint bww_giveaway_req_unique unique (giveaway_id, requirement_type, requirement_value)
);

create table if not exists public.bww_giveaway_rerolls (
  id uuid primary key default gen_random_uuid(),
  giveaway_id text not null,
  guild_id text not null,
  rerolled_by text,
  old_winner_id text,
  new_winner_id text,
  reason text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 7. VERIFICATION (5)
-- ============================================================================
create table if not exists public.bww_verification (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null unique,
  channel_id text,
  verified_role_id text,
  unverified_role_id text,
  method text not null default 'button'
    check (method in ('button','captcha','code','oauth','manual')),
  status text not null default 'active' check (status in ('active','inactive','draft')),
  welcome_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bww_verification_users (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  status text not null default 'pending'
    check (status in ('pending','verified','failed','blocked','expired')),
  verified_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bww_verification_users_guild_user_unique unique (guild_id, user_id)
);

create table if not exists public.bww_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  method text,
  success boolean not null default false,
  ip_hash text,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.bww_verification_codes (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  constraint bww_verification_codes_time_valid check (expires_at > created_at)
);

create table if not exists public.bww_verification_logs (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text,
  action text not null
    check (action in ('request','verify','fail','block','unblock','expire')),
  details jsonb not null default '{}'::jsonb,
  actor_id text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 8. GLOBAL (3) – bww_audit_logs existiert aus Phase 1 (No-Op falls vorhanden)
-- ============================================================================
create table if not exists public.bww_audit_logs (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  actor_id text,
  action text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bww_system_logs (
  id uuid primary key default gen_random_uuid(),
  guild_id text,
  level text not null default 'info'
    check (level in ('debug','info','warn','error','fatal')),
  source text not null default 'bot',
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bww_notifications (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  type text not null default 'info'
    check (type in ('info','warning','error','success','ticket','giveaway','verification','system')),
  title text,
  body text,
  link text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 9. UPGRADE bestehender Tabellen (Phase1/Legacy -> Kap.2 exakt, ohne Datenverlust)
-- ============================================================================
alter table public.bww_guilds add column if not exists id uuid default gen_random_uuid();
alter table public.bww_guilds add column if not exists guild_name text default 'Unbekannt';
alter table public.bww_guilds add column if not exists name text;
alter table public.bww_guilds add column if not exists owner_id text;
alter table public.bww_guilds add column if not exists enabled boolean default true;
alter table public.bww_guilds add column if not exists member_count integer default 0;
alter table public.bww_guilds add column if not exists joined_at timestamptz;
alter table public.bww_guilds add column if not exists created_at timestamptz default now();
alter table public.bww_guilds add column if not exists updated_at timestamptz default now();
alter table public.bww_guilds add column if not exists icon_url text;
do $$
begin
  begin
    update public.bww_guilds set guild_name = name
    where (guild_name is null or guild_name = 'Unbekannt') and name is not null;
  exception when others then null;
  end;
  begin
    update public.bww_guilds set name = guild_name
    where name is null and guild_name is not null;
  exception when others then null;
  end;
  begin
    update public.bww_guilds set enabled = true where enabled is null;
  exception when others then null;
  end;
  begin
    update public.bww_guilds set created_at = now() where created_at is null;
  exception when others then null;
  end;
  begin
    update public.bww_guilds set updated_at = now() where updated_at is null;
  exception when others then null;
  end;
end $$;
create unique index if not exists bww_guilds_id_uidx on public.bww_guilds (id);
create unique index if not exists bww_guilds_guild_id_uidx on public.bww_guilds (guild_id);

alter table public.bww_guild_settings add column if not exists id uuid default gen_random_uuid();
alter table public.bww_guild_settings add column if not exists language text default 'de';
alter table public.bww_guild_settings add column if not exists timezone text default 'Europe/Berlin';
alter table public.bww_guild_settings add column if not exists prefix text default '!';
alter table public.bww_guild_settings add column if not exists dashboard_enabled boolean default true;
alter table public.bww_guild_settings add column if not exists logging_enabled boolean default true;
alter table public.bww_guild_settings add column if not exists maintenance_mode boolean default false;
alter table public.bww_guild_settings add column if not exists settings jsonb default '{}'::jsonb;
alter table public.bww_guild_settings add column if not exists updated_by text;
alter table public.bww_guild_settings add column if not exists created_at timestamptz default now();
alter table public.bww_guild_settings add column if not exists updated_at timestamptz default now();
create unique index if not exists bww_guild_settings_id_uidx on public.bww_guild_settings (id);

alter table public.bww_tickets add column if not exists panel_id uuid;
alter table public.bww_tickets add column if not exists type_id uuid;
alter table public.bww_tickets add column if not exists user_id text;
alter table public.bww_tickets add column if not exists message_id text;
alter table public.bww_tickets add column if not exists transcript_url text;
alter table public.bww_tickets add column if not exists description text;
alter table public.bww_tickets add column if not exists panel_message_id text;
alter table public.bww_tickets add column if not exists reopened_at timestamptz;
do $$
begin
  begin
    update public.bww_tickets set user_id = owner_id where user_id is null and owner_id is not null;
  exception when others then null;
  end;
end $$;

alter table public.bww_giveaways add column if not exists ends_at timestamptz;
alter table public.bww_giveaways add column if not exists end_at timestamptz default (now() + interval '7 days');
alter table public.bww_giveaways add column if not exists bonus_role_id text;
do $$
begin
  begin
    update public.bww_giveaways set ends_at = end_at where ends_at is null and end_at is not null;
  exception when others then null;
  end;
  begin
    update public.bww_giveaways set end_at = ends_at where end_at is null and ends_at is not null;
  exception when others then null;
  end;
end $$;

alter table public.bww_audit_logs add column if not exists guild_id text;
alter table public.bww_audit_logs add column if not exists actor_id text;
alter table public.bww_audit_logs add column if not exists action text;
alter table public.bww_audit_logs add column if not exists target_id text;
alter table public.bww_audit_logs add column if not exists details jsonb default '{}'::jsonb;
alter table public.bww_audit_logs add column if not exists created_at timestamptz default now();

alter table public.bww_giveaway_entries add column if not exists guild_id text;
alter table public.bww_giveaway_winners add column if not exists guild_id text;
do $$
begin
  begin
    update public.bww_giveaway_entries e set guild_id = g.guild_id
    from public.bww_giveaways g where g.id = e.giveaway_id and e.guild_id is null;
  exception when others then null;
  end;
  begin
    update public.bww_giveaway_winners w set guild_id = g.guild_id
    from public.bww_giveaways g where g.id = w.giveaway_id and w.guild_id is null;
  exception when others then null;
  end;
end $$;

-- ============================================================================
-- 10. FOREIGN KEYS (sinnvoll, ohne harte Abhaengigkeit zu brechen)
-- Guild-Logik bleibt bewusst ohne FK auf bww_guilds (Guild kann vor DB-Eintrag
-- existieren). Nur Modul-interne FKs, per DO idempotent.
-- ============================================================================
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_ticket_types_panel_fk') then
    alter table public.bww_ticket_types add constraint bww_ticket_types_panel_fk
      foreign key (panel_id) references public.bww_ticket_panels(id) on delete set null;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_tickets_panel_fk') then
    alter table public.bww_tickets add constraint bww_tickets_panel_fk
      foreign key (panel_id) references public.bww_ticket_panels(id) on delete set null;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_tickets_type_fk') then
    alter table public.bww_tickets add constraint bww_tickets_type_fk
      foreign key (type_id) references public.bww_ticket_types(id) on delete set null;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_ticket_members_ticket_fk') then
    alter table public.bww_ticket_members add constraint bww_ticket_members_ticket_fk
      foreign key (ticket_id) references public.bww_tickets(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_ticket_messages_ticket_fk') then
    alter table public.bww_ticket_messages add constraint bww_ticket_messages_ticket_fk
      foreign key (ticket_id) references public.bww_tickets(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_ticket_actions_ticket_fk') then
    alter table public.bww_ticket_actions add constraint bww_ticket_actions_ticket_fk
      foreign key (ticket_id) references public.bww_tickets(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_honeypot_triggers_pot_fk') then
    alter table public.bww_honeypot_triggers add constraint bww_honeypot_triggers_pot_fk
      foreign key (honeypot_id) references public.bww_honeypots(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_embed_components_embed_fk') then
    alter table public.bww_embed_components add constraint bww_embed_components_embed_fk
      foreign key (embed_id) references public.bww_embeds(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_embed_actions_embed_fk') then
    alter table public.bww_embed_actions add constraint bww_embed_actions_embed_fk
      foreign key (embed_id) references public.bww_embeds(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_embed_actions_comp_fk') then
    alter table public.bww_embed_actions add constraint bww_embed_actions_comp_fk
      foreign key (component_id) references public.bww_embed_components(id) on delete set null;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_select_options_comp_fk') then
    alter table public.bww_embed_select_options add constraint bww_select_options_comp_fk
      foreign key (component_id) references public.bww_embed_components(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_select_options_embed_fk') then
    alter table public.bww_embed_select_options add constraint bww_select_options_embed_fk
      foreign key (embed_id) references public.bww_embeds(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_buttons_comp_fk') then
    alter table public.bww_embed_buttons add constraint bww_buttons_comp_fk
      foreign key (component_id) references public.bww_embed_components(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_buttons_embed_fk') then
    alter table public.bww_embed_buttons add constraint bww_buttons_embed_fk
      foreign key (embed_id) references public.bww_embeds(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_welcome_embed_fk') then
    alter table public.bww_welcome add constraint bww_welcome_embed_fk
      foreign key (embed_id) references public.bww_embeds(id) on delete set null;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_giveaway_entries_giveaway_fk') then
    alter table public.bww_giveaway_entries add constraint bww_giveaway_entries_giveaway_fk
      foreign key (giveaway_id) references public.bww_giveaways(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_giveaway_winners_giveaway_fk') then
    alter table public.bww_giveaway_winners add constraint bww_giveaway_winners_giveaway_fk
      foreign key (giveaway_id) references public.bww_giveaways(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_giveaway_req_giveaway_fk') then
    alter table public.bww_giveaway_requirements add constraint bww_giveaway_req_giveaway_fk
      foreign key (giveaway_id) references public.bww_giveaways(id) on delete cascade;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_giveaway_rerolls_giveaway_fk') then
    alter table public.bww_giveaway_rerolls add constraint bww_giveaway_rerolls_giveaway_fk
      foreign key (giveaway_id) references public.bww_giveaways(id) on delete cascade;
  end if;
end $$;

-- ============================================================================
-- 11. RLS (Kap.5): ENABLE + REVOKE anon/authenticated + GRANT service_role +
-- restriktive Guild-Policy (nicht nur TO authenticated).
-- Service-Role umgeht RLS (Bypass) – Bot/Dashboard-Server-Layer prueft
-- Guild-Berechtigung und nutzt Service-Key. Direktzugriff via anon/auth ist deny.
-- ============================================================================
alter table public.bww_guilds enable row level security;
alter table public.bww_guild_settings enable row level security;
alter table public.bww_guild_roles enable row level security;
alter table public.bww_guild_channels enable row level security;
alter table public.bww_ticket_panels enable row level security;
alter table public.bww_ticket_types enable row level security;
alter table public.bww_tickets enable row level security;
alter table public.bww_ticket_members enable row level security;
alter table public.bww_ticket_messages enable row level security;
alter table public.bww_ticket_actions enable row level security;
alter table public.bww_ticket_templates enable row level security;
alter table public.bww_honeypots enable row level security;
alter table public.bww_honeypot_triggers enable row level security;
alter table public.bww_honeypot_exemptions enable row level security;
alter table public.bww_embeds enable row level security;
alter table public.bww_embed_components enable row level security;
alter table public.bww_embed_actions enable row level security;
alter table public.bww_embed_select_options enable row level security;
alter table public.bww_embed_buttons enable row level security;
alter table public.bww_welcome enable row level security;
alter table public.bww_welcome_variables enable row level security;
alter table public.bww_welcome_logs enable row level security;
alter table public.bww_giveaways enable row level security;
alter table public.bww_giveaway_entries enable row level security;
alter table public.bww_giveaway_winners enable row level security;
alter table public.bww_giveaway_requirements enable row level security;
alter table public.bww_giveaway_rerolls enable row level security;
alter table public.bww_verification enable row level security;
alter table public.bww_verification_users enable row level security;
alter table public.bww_verification_attempts enable row level security;
alter table public.bww_verification_codes enable row level security;
alter table public.bww_verification_logs enable row level security;
alter table public.bww_audit_logs enable row level security;
alter table public.bww_system_logs enable row level security;
alter table public.bww_notifications enable row level security;

-- Direkter anon/authenticated-Zugriff entziehen (Default-Deny). Nur service_role.
revoke all on table public.bww_guild_roles from anon, authenticated;
revoke all on table public.bww_guild_channels from anon, authenticated;
revoke all on table public.bww_ticket_panels from anon, authenticated;
revoke all on table public.bww_ticket_types from anon, authenticated;
revoke all on table public.bww_tickets from anon, authenticated;
revoke all on table public.bww_ticket_members from anon, authenticated;
revoke all on table public.bww_ticket_messages from anon, authenticated;
revoke all on table public.bww_ticket_actions from anon, authenticated;
revoke all on table public.bww_ticket_templates from anon, authenticated;
revoke all on table public.bww_honeypots from anon, authenticated;
revoke all on table public.bww_honeypot_triggers from anon, authenticated;
revoke all on table public.bww_honeypot_exemptions from anon, authenticated;
revoke all on table public.bww_embeds from anon, authenticated;
revoke all on table public.bww_embed_components from anon, authenticated;
revoke all on table public.bww_embed_actions from anon, authenticated;
revoke all on table public.bww_embed_select_options from anon, authenticated;
revoke all on table public.bww_embed_buttons from anon, authenticated;
revoke all on table public.bww_welcome from anon, authenticated;
revoke all on table public.bww_welcome_variables from anon, authenticated;
revoke all on table public.bww_welcome_logs from anon, authenticated;
revoke all on table public.bww_giveaways from anon, authenticated;
revoke all on table public.bww_giveaway_entries from anon, authenticated;
revoke all on table public.bww_giveaway_winners from anon, authenticated;
revoke all on table public.bww_giveaway_requirements from anon, authenticated;
revoke all on table public.bww_giveaway_rerolls from anon, authenticated;
revoke all on table public.bww_verification from anon, authenticated;
revoke all on table public.bww_verification_users from anon, authenticated;
revoke all on table public.bww_verification_attempts from anon, authenticated;
revoke all on table public.bww_verification_codes from anon, authenticated;
revoke all on table public.bww_verification_logs from anon, authenticated;
revoke all on table public.bww_audit_logs from anon, authenticated;
revoke all on table public.bww_system_logs from anon, authenticated;
revoke all on table public.bww_notifications from anon, authenticated;
revoke all on table public.bww_guilds from anon, authenticated;
revoke all on table public.bww_guild_settings from anon, authenticated;

grant select, insert, update, delete on table public.bww_guilds to service_role;
grant select, insert, update, delete on table public.bww_guild_settings to service_role;
grant select, insert, update, delete on table public.bww_guild_roles to service_role;
grant select, insert, update, delete on table public.bww_guild_channels to service_role;
grant select, insert, update, delete on table public.bww_ticket_panels to service_role;
grant select, insert, update, delete on table public.bww_ticket_types to service_role;
grant select, insert, update, delete on table public.bww_tickets to service_role;
grant select, insert, update, delete on table public.bww_ticket_members to service_role;
grant select, insert, update, delete on table public.bww_ticket_messages to service_role;
grant select, insert, update, delete on table public.bww_ticket_actions to service_role;
grant select, insert, update, delete on table public.bww_ticket_templates to service_role;
grant select, insert, update, delete on table public.bww_honeypots to service_role;
grant select, insert, update, delete on table public.bww_honeypot_triggers to service_role;
grant select, insert, update, delete on table public.bww_honeypot_exemptions to service_role;
grant select, insert, update, delete on table public.bww_embeds to service_role;
grant select, insert, update, delete on table public.bww_embed_components to service_role;
grant select, insert, update, delete on table public.bww_embed_actions to service_role;
grant select, insert, update, delete on table public.bww_embed_select_options to service_role;
grant select, insert, update, delete on table public.bww_embed_buttons to service_role;
grant select, insert, update, delete on table public.bww_welcome to service_role;
grant select, insert, update, delete on table public.bww_welcome_variables to service_role;
grant select, insert, update, delete on table public.bww_welcome_logs to service_role;
grant select, insert, update, delete on table public.bww_giveaways to service_role;
grant select, insert, update, delete on table public.bww_giveaway_entries to service_role;
grant select, insert, update, delete on table public.bww_giveaway_winners to service_role;
grant select, insert, update, delete on table public.bww_giveaway_requirements to service_role;
grant select, insert, update, delete on table public.bww_giveaway_rerolls to service_role;
grant select, insert, update, delete on table public.bww_verification to service_role;
grant select, insert, update, delete on table public.bww_verification_users to service_role;
grant select, insert, update, delete on table public.bww_verification_attempts to service_role;
grant select, insert, update, delete on table public.bww_verification_codes to service_role;
grant select, insert, update, delete on table public.bww_verification_logs to service_role;
grant select, insert on table public.bww_audit_logs to service_role;
grant select, insert, update, delete on table public.bww_system_logs to service_role;
grant select, insert, update, delete on table public.bww_notifications to service_role;
grant usage, select on sequence public.bww_giveaway_winners_id_seq to service_role;

-- Restriktive Guild-Policies: authenticated darf nur lesen wenn JWT-guild_id matcht.
-- KEIN "TO authenticated USING (true)". Schreiben nur via service_role.
drop policy if exists bww_guild_isolated_read on public.bww_guilds;
create policy bww_guild_isolated_read on public.bww_guilds for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_guild_settings;
create policy bww_guild_isolated_read on public.bww_guild_settings for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_guild_roles;
create policy bww_guild_isolated_read on public.bww_guild_roles for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_guild_channels;
create policy bww_guild_isolated_read on public.bww_guild_channels for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_ticket_panels;
create policy bww_guild_isolated_read on public.bww_ticket_panels for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_ticket_types;
create policy bww_guild_isolated_read on public.bww_ticket_types for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_tickets;
create policy bww_guild_isolated_read on public.bww_tickets for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_ticket_members;
create policy bww_guild_isolated_read on public.bww_ticket_members for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_ticket_messages;
create policy bww_guild_isolated_read on public.bww_ticket_messages for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_ticket_actions;
create policy bww_guild_isolated_read on public.bww_ticket_actions for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_ticket_templates;
create policy bww_guild_isolated_read on public.bww_ticket_templates for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_honeypots;
create policy bww_guild_isolated_read on public.bww_honeypots for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_honeypot_triggers;
create policy bww_guild_isolated_read on public.bww_honeypot_triggers for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_honeypot_exemptions;
create policy bww_guild_isolated_read on public.bww_honeypot_exemptions for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_embeds;
create policy bww_guild_isolated_read on public.bww_embeds for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_embed_components;
create policy bww_guild_isolated_read on public.bww_embed_components for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_embed_actions;
create policy bww_guild_isolated_read on public.bww_embed_actions for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_embed_select_options;
create policy bww_guild_isolated_read on public.bww_embed_select_options for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_embed_buttons;
create policy bww_guild_isolated_read on public.bww_embed_buttons for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_welcome;
create policy bww_guild_isolated_read on public.bww_welcome for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_welcome_variables;
create policy bww_guild_isolated_read on public.bww_welcome_variables for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_welcome_logs;
create policy bww_guild_isolated_read on public.bww_welcome_logs for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_giveaways;
create policy bww_guild_isolated_read on public.bww_giveaways for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_giveaway_entries;
create policy bww_guild_isolated_read on public.bww_giveaway_entries for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_giveaway_winners;
create policy bww_guild_isolated_read on public.bww_giveaway_winners for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_giveaway_requirements;
create policy bww_guild_isolated_read on public.bww_giveaway_requirements for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_giveaway_rerolls;
create policy bww_guild_isolated_read on public.bww_giveaway_rerolls for select to authenticated using (public.bww_can_access_guild(guild_id));
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
drop policy if exists bww_guild_isolated_read on public.bww_audit_logs;
create policy bww_guild_isolated_read on public.bww_audit_logs for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_system_logs;
create policy bww_guild_isolated_read on public.bww_system_logs for select to authenticated using (public.bww_can_access_guild(guild_id));
drop policy if exists bww_guild_isolated_read on public.bww_notifications;
create policy bww_guild_isolated_read on public.bww_notifications for select to authenticated using (public.bww_can_access_guild(guild_id));

-- ============================================================================
-- 12. INDIZES (Kap.6) auf guild_id, channel_id, message_id, user_id,
-- ticket_id, giveaway_id, created_at, status, ends_at/expires_at
-- ============================================================================
create index if not exists bww_guilds_enabled_idx on public.bww_guilds (enabled);
create index if not exists bww_guild_settings_guild_idx on public.bww_guild_settings (guild_id);
create index if not exists bww_guild_roles_guild_idx on public.bww_guild_roles (guild_id);
create index if not exists bww_guild_roles_role_idx on public.bww_guild_roles (guild_id, role_id);
create index if not exists bww_guild_channels_guild_idx on public.bww_guild_channels (guild_id);
create index if not exists bww_guild_channels_channel_idx on public.bww_guild_channels (channel_id);
create index if not exists bww_ticket_panels_guild_idx on public.bww_ticket_panels (guild_id);
create index if not exists bww_ticket_panels_msg_idx on public.bww_ticket_panels (message_id);
create index if not exists bww_ticket_types_guild_idx on public.bww_ticket_types (guild_id);
create index if not exists bww_ticket_types_panel_idx on public.bww_ticket_types (panel_id);
create index if not exists bww_tickets_guild_status_idx2 on public.bww_tickets (guild_id, status, updated_at desc);
create index if not exists bww_tickets_channel_idx on public.bww_tickets (channel_id);
create index if not exists bww_tickets_message_idx on public.bww_tickets (message_id);
create index if not exists bww_tickets_user_idx on public.bww_tickets (guild_id, user_id);
create index if not exists bww_tickets_created_idx on public.bww_tickets (created_at desc);
create index if not exists bww_ticket_members_ticket_idx on public.bww_ticket_members (ticket_id);
create index if not exists bww_ticket_members_guild_user_idx on public.bww_ticket_members (guild_id, user_id);
create index if not exists bww_ticket_messages_ticket_idx on public.bww_ticket_messages (ticket_id, created_at desc);
create index if not exists bww_ticket_messages_msg_idx on public.bww_ticket_messages (message_id);
create index if not exists bww_ticket_messages_user_idx on public.bww_ticket_messages (guild_id, user_id);
create index if not exists bww_ticket_actions_ticket_idx on public.bww_ticket_actions (ticket_id, created_at desc);
create index if not exists bww_ticket_actions_guild_idx on public.bww_ticket_actions (guild_id, created_at desc);
create index if not exists bww_ticket_templates_guild_idx on public.bww_ticket_templates (guild_id);
create index if not exists bww_honeypots_guild_status_idx on public.bww_honeypots (guild_id, status);
create index if not exists bww_honeypots_channel_idx on public.bww_honeypots (channel_id);
create index if not exists bww_honeypot_triggers_guild_idx on public.bww_honeypot_triggers (guild_id, created_at desc);
create index if not exists bww_honeypot_triggers_user_idx on public.bww_honeypot_triggers (guild_id, user_id);
create index if not exists bww_honeypot_triggers_msg_idx on public.bww_honeypot_triggers (message_id);
create index if not exists bww_honeypot_exempt_guild_idx on public.bww_honeypot_exemptions (guild_id);
create index if not exists bww_embeds_guild_status_idx on public.bww_embeds (guild_id, status);
create index if not exists bww_embeds_msg_idx on public.bww_embeds (message_id);
create index if not exists bww_embeds_channel_idx on public.bww_embeds (channel_id);
create index if not exists bww_embed_comp_embed_idx on public.bww_embed_components (embed_id);
create index if not exists bww_embed_comp_guild_idx on public.bww_embed_components (guild_id);
create index if not exists bww_embed_actions_embed_idx on public.bww_embed_actions (embed_id);
create index if not exists bww_embed_actions_guild_idx on public.bww_embed_actions (guild_id, created_at desc);
create index if not exists bww_select_options_comp_idx on public.bww_embed_select_options (component_id);
create index if not exists bww_buttons_comp_idx on public.bww_embed_buttons (component_id);
create index if not exists bww_welcome_guild_idx on public.bww_welcome (guild_id);
create index if not exists bww_welcome_channel_idx on public.bww_welcome (channel_id);
create index if not exists bww_welcome_vars_guild_idx on public.bww_welcome_variables (guild_id);
create index if not exists bww_welcome_logs_guild_idx on public.bww_welcome_logs (guild_id, created_at desc);
create index if not exists bww_welcome_logs_user_idx on public.bww_welcome_logs (guild_id, user_id);
create index if not exists bww_giveaways_guild_status_idx2 on public.bww_giveaways (guild_id, status, ends_at);
create index if not exists bww_giveaways_ends_idx on public.bww_giveaways (status, ends_at) where status = 'active';
create index if not exists bww_giveaways_channel_idx on public.bww_giveaways (channel_id);
create index if not exists bww_giveaways_msg_idx on public.bww_giveaways (message_id);
create index if not exists bww_giveaway_entries_giveaway_idx on public.bww_giveaway_entries (giveaway_id);
create index if not exists bww_giveaway_entries_user_idx2 on public.bww_giveaway_entries (user_id);
create index if not exists bww_giveaway_entries_guild_idx on public.bww_giveaway_entries (guild_id);
create index if not exists bww_giveaway_winners_giveaway_idx2 on public.bww_giveaway_winners (giveaway_id, created_at desc);
create index if not exists bww_giveaway_req_giveaway_idx on public.bww_giveaway_requirements (giveaway_id);
create index if not exists bww_giveaway_rerolls_giveaway_idx on public.bww_giveaway_rerolls (giveaway_id, created_at desc);
create index if not exists bww_verification_guild_idx on public.bww_verification (guild_id);
create index if not exists bww_verification_users_guild_idx on public.bww_verification_users (guild_id, status);
create index if not exists bww_verification_users_user_idx on public.bww_verification_users (guild_id, user_id);
create index if not exists bww_verification_attempts_user_idx on public.bww_verification_attempts (guild_id, user_id, created_at desc);
create index if not exists bww_verification_codes_user_idx on public.bww_verification_codes (guild_id, user_id);
create index if not exists bww_verification_codes_expires_idx on public.bww_verification_codes (expires_at) where used_at is null;
create index if not exists bww_verification_logs_guild_idx on public.bww_verification_logs (guild_id, created_at desc);
create index if not exists bww_audit_logs_guild_idx2 on public.bww_audit_logs (guild_id, created_at desc);
create index if not exists bww_system_logs_guild_idx on public.bww_system_logs (guild_id, created_at desc);
create index if not exists bww_system_logs_level_idx on public.bww_system_logs (level, created_at desc);
create index if not exists bww_notifications_guild_user_idx on public.bww_notifications (guild_id, user_id, created_at desc);
create index if not exists bww_notifications_unread_idx on public.bww_notifications (guild_id, user_id) where is_read = false;

-- UNIQUE (guild_id + modulspezifischer Schluessel) als Index absichern (Kap.7)
create unique index if not exists bww_ticket_panels_guild_msg_uidx on public.bww_ticket_panels (guild_id, message_id) where message_id is not null;
create unique index if not exists bww_honeypots_guild_channel_uidx on public.bww_honeypots (guild_id, channel_id) where channel_id is not null;
create unique index if not exists bww_embeds_guild_msg_uidx on public.bww_embeds (guild_id, message_id) where message_id is not null;

-- ============================================================================
-- 13. updated_at Trigger (veraenderliche Daten)
-- ============================================================================
drop trigger if exists trg_bww_guilds_updated on public.bww_guilds;
create trigger trg_bww_guilds_updated before update on public.bww_guilds
  for each row execute function public.bww_touch_updated_at();
drop trigger if exists trg_bww_guild_settings_updated on public.bww_guild_settings;
create trigger trg_bww_guild_settings_updated before update on public.bww_guild_settings
  for each row execute function public.bww_touch_updated_at();
drop trigger if exists trg_bww_ticket_panels_updated on public.bww_ticket_panels;
create trigger trg_bww_ticket_panels_updated before update on public.bww_ticket_panels
  for each row execute function public.bww_touch_updated_at();
drop trigger if exists trg_bww_ticket_types_updated on public.bww_ticket_types;
create trigger trg_bww_ticket_types_updated before update on public.bww_ticket_types
  for each row execute function public.bww_touch_updated_at();
drop trigger if exists trg_bww_tickets_updated on public.bww_tickets;
create trigger trg_bww_tickets_updated before update on public.bww_tickets
  for each row execute function public.bww_touch_updated_at();
drop trigger if exists trg_bww_ticket_templates_updated on public.bww_ticket_templates;
create trigger trg_bww_ticket_templates_updated before update on public.bww_ticket_templates
  for each row execute function public.bww_touch_updated_at();
drop trigger if exists trg_bww_honeypots_updated on public.bww_honeypots;
create trigger trg_bww_honeypots_updated before update on public.bww_honeypots
  for each row execute function public.bww_touch_updated_at();
drop trigger if exists trg_bww_embeds_updated on public.bww_embeds;
create trigger trg_bww_embeds_updated before update on public.bww_embeds
  for each row execute function public.bww_touch_updated_at();
drop trigger if exists trg_bww_welcome_updated on public.bww_welcome;
create trigger trg_bww_welcome_updated before update on public.bww_welcome
  for each row execute function public.bww_touch_updated_at();
drop trigger if exists trg_bww_verification_updated on public.bww_verification;
create trigger trg_bww_verification_updated before update on public.bww_verification
  for each row execute function public.bww_touch_updated_at();
drop trigger if exists trg_bww_verification_users_updated on public.bww_verification_users;
create trigger trg_bww_verification_users_updated before update on public.bww_verification_users
  for each row execute function public.bww_touch_updated_at();

-- ============================================================================
-- 14. STORAGE (Kap.8): Buckets bww-ticket-transcripts, bww-exports, bww-assets
-- Transcripts/Exports privat (nur service_role), Assets public-read.
-- In DB werden nur Metadaten/Storage-Pfade abgelegt (01_ARCHITECTURE Kap.7).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('bww-ticket-transcripts','bww-ticket-transcripts',false),
       ('bww-exports','bww-exports',false),
       ('bww-assets','bww-assets',true)
on conflict (id) do nothing;

drop policy if exists "bww assets public read" on storage.objects;
create policy "bww assets public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'bww-assets');

drop policy if exists "bww service write assets" on storage.objects;
create policy "bww service write assets" on storage.objects
  for all to service_role using (true) with check (true);

-- Doku-Kommentare
comment on table public.bww_guilds is 'BWW Core: Guild-Verzeichnis (Single Source of Truth, 02_DATABASE Kap.2)';
comment on table public.bww_guild_settings is 'BWW Core: typisierte Guild-Einstellungen + legacy settings jsonb (Dashboard und Commands teilen sich diese Tabelle)';
comment on table public.bww_tickets is 'BWW Tickets: Text-IDs = Discord-Snowflakes (kompatibel zu Legacy-Migration). transcript_url zeigt auf storage bucket bww-ticket-transcripts.';
comment on table public.bww_giveaways is 'BWW Giveaways: ends_at kanonisch (Kap.6/7), end_at legacy-Spalte bleibt. winner_count 1..100.';
