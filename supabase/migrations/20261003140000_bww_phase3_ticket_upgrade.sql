-- BWW Phase 3 – Ticket-Upgrade auf 03_TICKETS.md (exakte Felder).
-- Idempotent: nur ADD COLUMN IF NOT EXISTS + Constraint-Upgrade + Indizes + RLS-Grants.
-- Phase 2 (20261003130000) hat 35 Tabellen angelegt, aber Feldnamen weichen
-- teilweise von Kap. Tabellen ab. Diese Migration gleicht an, ohne Datenverlust.
-- Status neu: open/claimed/pending/closed/deleted (+ locked/archived backward-compat).
-- Storage-Bucket: bww-ticket-transcripts (Transcripts -> Storage -> transcript_url).

-- ============================================================================
-- 1. bww_ticket_panels: Kap. Felder exakt
-- Soll: id, guild_id, channel_id, message_id, title, description,
--   button_label, button_emoji(button_emoji), button_style, category_id,
--   staff_role_id, enabled, created_at, updated_at
-- ============================================================================
alter table public.bww_ticket_panels add column if not exists channel_id text;
alter table public.bww_ticket_panels add column if not exists message_id text;
alter table public.bww_ticket_panels add column if not exists title text default 'Support';
alter table public.bww_ticket_panels add column if not exists description text;
alter table public.bww_ticket_panels add column if not exists button_label text default 'Ticket erstellen';
alter table public.bww_ticket_panels add column if not exists button_emoji text default '🎫';
alter table public.bww_ticket_panels add column if not exists button_style text default 'primary';
alter table public.bww_ticket_panels add column if not exists category_id text;
alter table public.bww_ticket_panels add column if not exists staff_role_id text;
alter table public.bww_ticket_panels add column if not exists enabled boolean default true;
alter table public.bww_ticket_panels add column if not exists updated_at timestamptz default now();
-- button_style Check (idempotent)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bww_ticket_panels_style_check') then
    alter table public.bww_ticket_panels add constraint bww_ticket_panels_style_check
      check (button_style in ('primary','secondary','success','danger'));
  end if;
end $$;

-- ============================================================================
-- 2. bww_ticket_types: eigene category_id + staff_role_id pro Typ, color
-- Soll: id, guild_id, name, description, emoji, category_id, staff_role_id,
--   color, enabled, created_at (+ panel_id/type_key/is_active bleiben compat)
-- ============================================================================
alter table public.bww_ticket_types add column if not exists name text;
alter table public.bww_ticket_types add column if not exists description text;
alter table public.bww_ticket_types add column if not exists emoji text default '🎫';
alter table public.bww_ticket_types add column if not exists category_id text;
alter table public.bww_ticket_types add column if not exists staff_role_id text;
alter table public.bww_ticket_types add column if not exists color text default '#5865F2';
alter table public.bww_ticket_types add column if not exists enabled boolean default true;
do $$ begin
  begin update public.bww_ticket_types set name = type_key where (name is null or name = '') and type_key is not null; exception when others then null; end;
  begin update public.bww_ticket_types set enabled = is_active where enabled is null and is_active is not null; exception when others then null; end;
  begin update public.bww_ticket_types set is_active = enabled where is_active is null and enabled is not null; exception when others then null; end;
end $$;

-- ============================================================================
-- 3. bww_tickets: ticket_number fortlaufend pro guild, creator_id, transcript
-- Soll: id, guild_id, ticket_number, channel_id, creator_id, type_id, status,
--   priority, claimed_by, closed_by, closed_at, created_at, updated_at
-- (+ panel_id/owner_id/user_id/reason/description/transcript_url/... compat)
-- ============================================================================
alter table public.bww_tickets add column if not exists ticket_number integer;
alter table public.bww_tickets add column if not exists creator_id text;
alter table public.bww_tickets add column if not exists type_id uuid;
alter table public.bww_tickets add column if not exists claimed_by text;
alter table public.bww_tickets add column if not exists closed_by text;
alter table public.bww_tickets add column if not exists closed_at timestamptz;
alter table public.bww_tickets add column if not exists transcript_url text;
alter table public.bww_tickets add column if not exists description text;
-- Backfill creator_id aus owner_id/user_id
do $$ begin
  begin update public.bww_tickets set creator_id = owner_id where creator_id is null and owner_id is not null; exception when others then null; end;
  begin update public.bww_tickets set creator_id = user_id where (creator_id is null or creator_id = '') and user_id is not null; exception when others then null; end;
  begin update public.bww_tickets set user_id = creator_id where (user_id is null or user_id = '') and creator_id is not null; exception when others then null; end;
end $$;
-- ticket_number vergeben wo null (pro guild fortlaufend, global fallback)
do $$ begin
  begin
    update public.bww_tickets t set ticket_number = sub.rn
    from (select id, row_number() over (partition by guild_id order by created_at, id) as rn from public.bww_tickets where ticket_number is null) sub
    where t.id = sub.id;
  exception when others then null; end;
end $$;
create unique index if not exists bww_tickets_guild_number_uidx on public.bww_tickets (guild_id, ticket_number);
-- Status-Constraint auf 03-Werte erweitern (inkl. locked/archived compat für Legacy-UI)
do $$ begin
  begin alter table public.bww_tickets drop constraint if exists bww_tickets_status_check; exception when others then null; end;
  begin alter table public.bww_tickets drop constraint if exists bww_tickets_status_check1; exception when others then null; end;
  if not exists (select 1 from pg_constraint where conname = 'bww_tickets_phase3_status_check') then
    alter table public.bww_tickets add constraint bww_tickets_phase3_status_check
      check (status in ('open','claimed','pending','closed','deleted','locked','archived'));
  end if;
end $$;

-- ============================================================================
-- 4. bww_ticket_members: added_by (Kap. exakt: id, ticket_id, user_id, added_by)
-- ============================================================================
alter table public.bww_ticket_members add column if not exists added_by text;
create index if not exists bww_ticket_members_ticket_idx2 on public.bww_ticket_members (ticket_id);

-- ============================================================================
-- 5. bww_ticket_messages: discord_message_id/author/content/attachments
-- Soll: id, ticket_id, discord_message_id, author_id, content, attachments
-- ============================================================================
alter table public.bww_ticket_messages add column if not exists discord_message_id text;
alter table public.bww_ticket_messages add column if not exists author_id text;
alter table public.bww_ticket_messages add column if not exists content text;
alter table public.bww_ticket_messages add column if not exists attachments jsonb default '[]'::jsonb;
do $$ begin
  begin update public.bww_ticket_messages set discord_message_id = message_id where discord_message_id is null and message_id is not null; exception when others then null; end;
  begin update public.bww_ticket_messages set author_id = user_id where author_id is null and user_id is not null; exception when others then null; end;
  begin update public.bww_ticket_messages set user_id = author_id where (user_id is null or user_id = '') and author_id is not null; exception when others then null; end;
  begin update public.bww_ticket_messages set message_id = discord_message_id where (message_id is null or message_id = '') and discord_message_id is not null; exception when others then null; end;
end $$;
create index if not exists bww_ticket_messages_discord_idx on public.bww_ticket_messages (discord_message_id);

-- ============================================================================
-- 6. bww_ticket_actions: actor/action/old/new (Kap. exakt)
-- Soll: id, ticket_id, guild_id, actor_id, action, old_value, new_value
-- ============================================================================
alter table public.bww_ticket_actions add column if not exists actor_id text;
alter table public.bww_ticket_actions add column if not exists old_value text;
alter table public.bww_ticket_actions add column if not exists new_value text;
alter table public.bww_ticket_actions add column if not exists details jsonb default '{}'::jsonb;
-- Action-Check erweitern (claim/unclaim/add/remove/delete/autoclose/warn/...)
do $$ begin
  begin alter table public.bww_ticket_actions drop constraint if exists bww_ticket_actions_action_check; exception when others then null; end;
  if not exists (select 1 from pg_constraint where conname = 'bww_ticket_actions_phase3_check') then
    alter table public.bww_ticket_actions add constraint bww_ticket_actions_phase3_check
      check (action in ('create','claim','unclaim','assign','add','remove','rename','priority','close','reopen','delete','lock','unlock','pending','transcript','note','autoclose','warn'));
  end if;
end $$;
create index if not exists bww_ticket_actions_ticket_idx2 on public.bww_ticket_actions (ticket_id, created_at desc);
create index if not exists bww_ticket_actions_guild_idx2 on public.bww_ticket_actions (guild_id, created_at desc);

-- ============================================================================
-- 7. bww_ticket_templates: name/content/enabled (Kap. exakt)
-- Soll: id, guild_id, name, content, enabled, created_at, updated_at
-- ============================================================================
alter table public.bww_ticket_templates add column if not exists name text;
alter table public.bww_ticket_templates add column if not exists content text default '';
alter table public.bww_ticket_templates add column if not exists enabled boolean default true;
do $$ begin
  begin update public.bww_ticket_templates set name = coalesce(nullif(template_key,''), nullif(title,''), 'default') where (name is null or name = ''); exception when others then null; end;
  begin update public.bww_ticket_templates set template_key = name where (template_key is null or template_key = '') and name is not null; exception when others then null; end;
end $$;
create unique index if not exists bww_ticket_templates_guild_name_uidx on public.bww_ticket_templates (guild_id, name);

-- ============================================================================
-- 8. updated_at Trigger (falls Phase2-Trigger fehlen)
-- ============================================================================
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'bww_ticket_panels_touch') then
    create trigger bww_ticket_panels_touch before update on public.bww_ticket_panels for each row execute function public.bww_touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'bww_ticket_types_touch') then
    create trigger bww_ticket_types_touch before update on public.bww_ticket_types for each row execute function public.bww_touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'bww_tickets_touch') then
    create trigger bww_tickets_touch before update on public.bww_tickets for each row execute function public.bww_touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'bww_ticket_templates_touch') then
    create trigger bww_ticket_templates_touch before update on public.bww_ticket_templates for each row execute function public.bww_touch_updated_at();
  end if;
end $$;

-- ============================================================================
-- 9. RLS re-assert (Kap.5: Default-Deny, nur service_role schreibt)
-- ============================================================================
alter table public.bww_ticket_panels enable row level security;
alter table public.bww_ticket_types enable row level security;
alter table public.bww_tickets enable row level security;
alter table public.bww_ticket_members enable row level security;
alter table public.bww_ticket_messages enable row level security;
alter table public.bww_ticket_actions enable row level security;
alter table public.bww_ticket_templates enable row level security;
grant select, insert, update, delete on table public.bww_ticket_panels to service_role;
grant select, insert, update, delete on table public.bww_ticket_types to service_role;
grant select, insert, update, delete on table public.bww_tickets to service_role;
grant select, insert, update, delete on table public.bww_ticket_members to service_role;
grant select, insert, update, delete on table public.bww_ticket_messages to service_role;
grant select, insert, update, delete on table public.bww_ticket_actions to service_role;
grant select, insert, update, delete on table public.bww_ticket_templates to service_role;

-- ============================================================================
-- 10. Storage-Bucket bww-ticket-transcripts (Kap.8)
-- Transcripts -> Storage -> transcript_url/metadaten in DB.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('bww-ticket-transcripts', 'bww-ticket-transcripts', false)
on conflict (id) do nothing;
-- Bucket-Policies (service_role umgeht RLS; anon/auth deny default)
-- Keine public-Reads: Transcripts nur via Bot/Dashboard (service_role).
