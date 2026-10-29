-- BWW Phase 5 – Embed V2 Upgrade (Quelle: 05_EMBED_V2.md).
-- Idempotent: nur ADD COLUMN IF NOT EXISTS bei Luecke.
-- Phase-2-Tabellen bww_embeds/components/actions/select_options/buttons existieren bereits.
-- Legacy bww_embed_templates bleibt erhalten (kein DROP, kein Rename).
-- Regeln: nur bww_-Prefix, RLS an, Service-Role-Bypass, guild_id wo guild-bezogen.

-- 1) bww_embeds: Task-Felder name/description/enabled/created_by.
-- Phase 2 hat embed_key/title/color/status/channel_id/message_id/created_by/updated_by.
-- Wir ergaenzen name + enabled und fuellen aus Bestand (title/embed_key bzw. status).
alter table public.bww_embeds add column if not exists name text;
alter table public.bww_embeds add column if not exists enabled boolean not null default true;

do $$ begin
  begin
    update public.bww_embeds set name = coalesce(nullif(name, ''), title, embed_key, 'embed-' || left(id::text, 8))
    where name is null or name = '';
  exception when others then null; end;
  begin
    update public.bww_embeds set enabled = (status is distinct from 'archived')
    where enabled is null;
  exception when others then null; end;
end $$;

create index if not exists bww_embeds_guild_enabled_idx on public.bww_embeds (guild_id, enabled);
create index if not exists bww_embeds_guild_updated_idx on public.bww_embeds (guild_id, updated_at desc);

-- 2) bww_embed_components: Task-Felder embed_id/component_type/position/data.
-- Phase 2 hat zusaetzlich guild_id, aber kein updated_at; component_type-Check zu eng.
-- Plan-Komponenten: container/section/text/thumbnail/media gallery/separator/button/select/action row.
alter table public.bww_embed_components add column if not exists updated_at timestamptz not null default now();

do $$ begin
  begin
    if exists (select 1 from pg_constraint where conname = 'bww_embed_components_component_type_check') then
      alter table public.bww_embed_components drop constraint bww_embed_components_component_type_check;
    end if;
  exception when others then null; end;
  begin
    if not exists (select 1 from pg_constraint where conname = 'bww_embed_components_type_allowed') then
      alter table public.bww_embed_components add constraint bww_embed_components_type_allowed
        check (component_type in ('container','section','text','thumbnail','media','media_gallery','gallery','file','separator','button','select','action_row'));
    end if;
  exception when others then null; end;
end $$;

create index if not exists bww_embed_components_embed_pos_idx on public.bww_embed_components (embed_id, position);
create index if not exists bww_embed_components_guild_idx on public.bww_embed_components (guild_id);

drop trigger if exists bww_embed_components_touch on public.bww_embed_components;
create trigger bww_embed_components_touch before update on public.bww_embed_components
for each row execute function public.bww_touch_updated_at();

-- 3) bww_embed_actions: Task-Felder action_type/action_data an embed/component.
-- Phase 2 hat payload statt action_data und engen action_type-Check.
alter table public.bww_embed_actions add column if not exists action_data jsonb not null default '{}'::jsonb;

do $$ begin
  begin
    update public.bww_embed_actions set action_data = coalesce(nullif(action_data, '{}'::jsonb), payload, '{}'::jsonb)
    where (action_data is null or action_data = '{}'::jsonb) and payload is not null;
  exception when others then null; end;
  begin
    update public.bww_embed_actions set payload = coalesce(nullif(payload, '{}'::jsonb), action_data, '{}'::jsonb)
    where (payload is null or payload = '{}'::jsonb) and action_data is not null;
  exception when others then null; end;
end $$;

do $$ begin
  begin
    if exists (select 1 from pg_constraint where conname = 'bww_embed_actions_action_type_check') then
      alter table public.bww_embed_actions drop constraint bww_embed_actions_action_type_check;
    end if;
  exception when others then null; end;
  begin
    if not exists (select 1 from pg_constraint where conname = 'bww_embed_actions_type_allowed') then
      alter table public.bww_embed_actions add constraint bww_embed_actions_type_allowed
        check (action_type in ('send','send_message','send_embed','update','dm','role_assign','role_remove','role_add','role_toggle','role_action','ticket_create','open_url','modal_open','custom','none'));
    end if;
  exception when others then null; end;
end $$;

create index if not exists bww_embed_actions_embed_idx on public.bww_embed_actions (embed_id);
create index if not exists bww_embed_actions_comp_idx on public.bww_embed_actions (component_id);
create index if not exists bww_embed_actions_guild_idx on public.bww_embed_actions (guild_id);

-- 4) bww_embed_select_options: pro Option einzeln (label/description/value/emoji/response_*).
-- Phase 2 hat label/value/description/emoji/is_default/position, aber keine response-Spalten.
alter table public.bww_embed_select_options add column if not exists response_type text not null default 'message';
alter table public.bww_embed_select_options add column if not exists response_content text;
alter table public.bww_embed_select_options add column if not exists response_embed_id uuid;
alter table public.bww_embed_select_options add column if not exists updated_at timestamptz not null default now();

do $$ begin
  begin
    if not exists (select 1 from pg_constraint where conname = 'bww_select_options_response_allowed') then
      alter table public.bww_embed_select_options add constraint bww_select_options_response_allowed
        check (response_type in ('none','message','embed','ticket','modal','role_action'));
    end if;
  exception when others then null; end;
end $$;

create index if not exists bww_select_options_comp_idx on public.bww_embed_select_options (component_id);
create index if not exists bww_select_options_embed_idx on public.bww_embed_select_options (embed_id);

drop trigger if exists bww_select_options_touch on public.bww_embed_select_options;
create trigger bww_select_options_touch before update on public.bww_embed_select_options
for each row execute function public.bww_touch_updated_at();

-- 5) bww_embed_buttons: Task-Felder label/style/emoji/custom_id/action_type/action_data.
-- Phase 2 hat label/custom_id/style/url/disabled/position, aber kein emoji/action_*.
alter table public.bww_embed_buttons add column if not exists emoji text;
alter table public.bww_embed_buttons add column if not exists action_type text not null default 'send_message';
alter table public.bww_embed_buttons add column if not exists action_data jsonb not null default '{}'::jsonb;
alter table public.bww_embed_buttons add column if not exists updated_at timestamptz not null default now();

do $$ begin
  begin
    if not exists (select 1 from pg_constraint where conname = 'bww_embed_buttons_action_allowed') then
      alter table public.bww_embed_buttons add constraint bww_embed_buttons_action_allowed
        check (action_type in ('send_message','send_embed','modal_open','ticket_create','open_url','role_add','role_remove','role_toggle','role_action','custom','none'));
    end if;
  exception when others then null; end;
end $$;

create index if not exists bww_embed_buttons_comp_idx on public.bww_embed_buttons (component_id);
create index if not exists bww_embed_buttons_embed_idx on public.bww_embed_buttons (embed_id);

drop trigger if exists bww_embed_buttons_touch on public.bww_embed_buttons;
create trigger bww_embed_buttons_touch before update on public.bww_embed_buttons
for each row execute function public.bww_touch_updated_at();

drop trigger if exists bww_embeds_touch on public.bww_embeds;
create trigger bww_embeds_touch before update on public.bww_embeds
for each row execute function public.bww_touch_updated_at();

-- 6) RLS sicherstellen (Phase 2 bereits aktiv; idempotent, kein Policy-Wechsel).
-- Prinzip User -> berechtigte Guild -> passende guild_id -> erlaubte Zeilen.
alter table public.bww_embeds enable row level security;
alter table public.bww_embed_components enable row level security;
alter table public.bww_embed_actions enable row level security;
alter table public.bww_embed_select_options enable row level security;
alter table public.bww_embed_buttons enable row level security;

grant select, insert, update, delete on table public.bww_embeds to service_role;
grant select, insert, update, delete on table public.bww_embed_components to service_role;
grant select, insert, update, delete on table public.bww_embed_actions to service_role;
grant select, insert, update, delete on table public.bww_embed_select_options to service_role;
grant select, insert, update, delete on table public.bww_embed_buttons to service_role;
