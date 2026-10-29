-- BWW Phase 2 Seed-Beispiele (zu 02_DATABASE.md)
-- Nur Dummy-Daten, keine Secrets, keine echten User-Daten.
-- Idempotent via ON CONFLICT DO NOTHING. Guild-ID 000... ist Test-Gilde.
-- Verwendung: supabase db reset / seed, oder manuell im SQL-Editor.

-- Core
insert into public.bww_guilds (guild_id, guild_name, owner_id, enabled)
values ('000000000000000000','BWW Beispiel-Gilde','111111111111111111',true)
on conflict (guild_id) do nothing;

insert into public.bww_guild_settings (guild_id, language, timezone, prefix, dashboard_enabled, logging_enabled, maintenance_mode)
values ('000000000000000000','de','Europe/Berlin','!?',true,true,false)
on conflict (guild_id) do nothing;

insert into public.bww_guild_roles (guild_id, role_id, role_name, role_type, enabled)
values ('000000000000000000','222222222222222222','BWW Admin','admin',true),
       ('000000000000000000','333333333333333333','BWW Mod','mod',true)
on conflict (guild_id, role_id) do nothing;

insert into public.bww_guild_channels (guild_id, channel_id, channel_type, channel_name, enabled)
values ('000000000000000000','444444444444444444','welcome','willkommen',true),
       ('000000000000000000','555555555555555555','log','bww-log',true)
on conflict (guild_id, channel_id) do nothing;

-- Tickets
insert into public.bww_ticket_panels (guild_id, panel_key, title, description, status)
values ('000000000000000000','default','Support','Klicke um ein Ticket zu oeffnen','active')
on conflict (guild_id, panel_key) do nothing;

insert into public.bww_ticket_types (guild_id, type_key, name, description)
values ('000000000000000000','support','Allgemeiner Support','Fragen und Hilfe'),
       ('000000000000000000','bug','Bug-Report','Fehler melden')
on conflict (guild_id, type_key) do nothing;

insert into public.bww_ticket_templates (guild_id, template_key, title, content)
values ('000000000000000000','begruessung','Begruessung','Hallo {user}, danke fuers Oeffnen!')
on conflict (guild_id, template_key) do nothing;

-- Honeypot
insert into public.bww_honeypots (guild_id, name, status, bait_text)
values ('000000000000000000','honeypot-main','active','Gratis Nitro! Klicke hier')
on conflict (guild_id, name) do nothing;

-- Embed V2
insert into public.bww_embeds (guild_id, embed_key, title, description, status)
values ('000000000000000000','welcome-embed','Willkommen','Willkommen bei {server}!','draft')
on conflict (guild_id, embed_key) do nothing;

-- Welcome
insert into public.bww_welcome (guild_id, title, message, enabled, status)
values ('000000000000000000','Willkommen','Willkommen {user} auf {server}!',true,'active')
on conflict (guild_id) do nothing;

insert into public.bww_welcome_variables (guild_id, variable_key, default_value, description)
values ('000000000000000000','{user}','@User','Erwaehnung des Users'),
       ('000000000000000000','{server}','Beispiel-Server','Server-Name')
on conflict (guild_id, variable_key) do nothing;

-- Verification
insert into public.bww_verification (guild_id, method, status)
values ('000000000000000000','button','active')
on conflict (guild_id) do nothing;

-- System/Notifications (Demo, guild-bezogen)
insert into public.bww_system_logs (guild_id, level, source, message, details)
values ('000000000000000000','info','seed','Phase2 Seed eingespielt','{"phase":2}'::jsonb);

insert into public.bww_notifications (guild_id, user_id, type, title, body)
values ('000000000000000000','111111111111111111','info','Willkommen','Phase-2 Datenmodell bereit');
