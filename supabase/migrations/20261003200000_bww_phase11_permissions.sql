-- BWW Phase 11 – Permissions-Matrix: bww_guild_roles.role_type angleichen (11_PERMISSIONS.md).
-- Idempotent: laeuft mehrfach ohne Fehler. Aendert KEINE Modul-Business-Logik, nur Rechtesystem.
--
-- Vorher (Phase 2): role_type in ('admin','mod','member','bot','custom','verification','ticket','giveaway','honeypot')
-- Nachher: Phase-11-Werte ('owner','administrator','manager','moderator','support',
--   'giveaway_manager','verification_staff','viewer') + Legacy-Werte (Rueckwaertskompatibilitaet).
-- Bestehende Legacy-Zeilen werden auf Phase-11-Werte normalisiert (admin->administrator, ...).
-- RLS bleibt wie in Phase 2 (ENABLE + REVOKE anon/authenticated + GRANT service_role +
-- Guild-Isolation-Policy fuer authenticated-Reads). Service-Role umgeht RLS (Bot/Dashboard-Server-Layer
-- prueft Guild-Berechtigung + Matrix, siehe src/services/permissions.js + website/lib/guards.js).

-- 1) Alten Inline-Check entfernen (Name ist versionsabhaengig -> beide Varianten versuchen).
do $$ begin
  begin
    alter table public.bww_guild_roles drop constraint if exists bww_guild_roles_role_type_check;
  exception when others then null;
  end;
  begin
    alter table public.bww_guild_roles drop constraint if exists bww_guild_roles_role_type_phase11_check;
  exception when others then null;
  end;
end $$;

-- 2) Legacy-Zeilen auf Phase-11-Werte normalisieren (idempotent, nur exakte Treffer).
update public.bww_guild_roles set role_type = 'administrator' where role_type = 'admin';
update public.bww_guild_roles set role_type = 'moderator' where role_type in ('mod', 'honeypot');
update public.bww_guild_roles set role_type = 'viewer' where role_type = 'member';
update public.bww_guild_roles set role_type = 'support' where role_type = 'ticket';
update public.bww_guild_roles set role_type = 'giveaway_manager' where role_type = 'giveaway';
update public.bww_guild_roles set role_type = 'verification_staff' where role_type = 'verification';

-- 3) Neuer Check: Phase-11-Werte + Legacy-Werte (Legacy bleibt lesbar, wird lazy normalisiert).
do $$ begin
  begin
    alter table public.bww_guild_roles add constraint bww_guild_roles_role_type_phase11_check
      check (role_type in (
        'owner','administrator','manager','moderator','support',
        'giveaway_manager','verification_staff','viewer',
        'custom','bot',
        'admin','mod','member','verification','ticket','giveaway','honeypot'
      ));
  exception when duplicate_object then null;
  end;
end $$;

-- 4) updated_at-Spalte (fuer CRUD aus dem Dashboard), falls fehlend.
alter table public.bww_guild_roles add column if not exists role_name text;
alter table public.bww_guild_roles add column if not exists enabled boolean not null default true;
alter table public.bww_guild_roles add column if not exists updated_at timestamptz not null default now();

drop trigger if exists bww_guild_roles_touch on public.bww_guild_roles;
create trigger bww_guild_roles_touch
  before update on public.bww_guild_roles
  for each row execute function public.bww_touch_updated_at();

-- 5) RLS beibehalten/bestaetigen (Phase-2-Stand, idempotent).
alter table public.bww_guild_roles enable row level security;
revoke all on table public.bww_guild_roles from anon, authenticated;
grant select, insert, update, delete on table public.bww_guild_roles to service_role;
drop policy if exists bww_guild_isolated_read on public.bww_guild_roles;
create policy bww_guild_isolated_read on public.bww_guild_roles for select to authenticated using (public.bww_can_access_guild(guild_id));

create index if not exists bww_guild_roles_guild_type_idx on public.bww_guild_roles (guild_id, role_type);
