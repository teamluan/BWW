-- BWW Phase 14 – Plattformfunktionen (Quelle: 14_IMPLEMENTATION.md Phase 8).
-- Idempotent: CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / INSERT ON CONFLICT DO NOTHING.
-- Stand: Phase 1-13 auf main. Diese Migration schliesst gezielte Phase-8-Luecken:
--  1) bww_notifications echt (statt nur derived-Fallback): Tabelle sicherstellen.
--  2) bww_system_logs Resolve/Mark: resolved/resolved_at/resolved_by Spalten.
--  3) bww-exports Bucket fuer CSV/JSON-Exporte (Tickets/Logs/Transcripts/Giveaway-Teilnehmer).
--  4) RLS-Guards: Default-Deny fuer anon/authenticated, Schreiben nur via service_role.
-- Keine Business-Logik-Aenderung, nur Plattform-Tabellen + Bucket + RLS.

-- ============================================================================
-- 1) bww_notifications (Phase 8: Notification Center echt verdrahten)
-- Typen: ticket_closed, honeypot_triggered, giveaway_ended, verification, system
-- Dashboard liest via service_role (website/lib/notifications.js), Bot schreibt
-- best-effort via src/services/notifications.js (nie werfend).
-- ============================================================================
create table if not exists public.bww_notifications (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  type text not null,
  title text not null default '',
  message text not null default '',
  link text,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.bww_notifications enable row level security;
revoke all on table public.bww_notifications from anon, authenticated;
grant select, insert, update, delete on table public.bww_notifications to service_role;
-- Alte permissive Policies entfernen (falls je angelegt):
drop policy if exists bww_guild_isolated_read on public.bww_notifications;
drop policy if exists "public can read bww_notifications" on public.bww_notifications;
create index if not exists bww_notifications_guild_created_idx on public.bww_notifications (guild_id, created_at desc);
create index if not exists bww_notifications_guild_read_idx on public.bww_notifications (guild_id, read);
create index if not exists bww_notifications_type_idx on public.bww_notifications (type);

-- ============================================================================
-- 2) bww_system_logs Resolve/Mark (Phase 8: Error Center)
-- Bestehende Tabelle aus Phase 2 + Phase 13 RLS bleibt; hier nur Resolve-Spalten.
-- Dashboard: Filter level/module (level/source), Resolve via API mit system.manage.
-- Anzeige nutzt Sanitizer (website/lib/sanitize.js) – keine Secrets.
-- ============================================================================
do $$ begin
  begin alter table public.bww_system_logs add column if not exists level text not null default 'info'; exception when others then null; end;
  begin alter table public.bww_system_logs add column if not exists source text not null default 'system'; exception when others then null; end;
  begin alter table public.bww_system_logs add column if not exists module text; exception when others then null; end;
  begin alter table public.bww_system_logs add column if not exists resolved boolean not null default false; exception when others then null; end;
  begin alter table public.bww_system_logs add column if not exists resolved_at timestamptz; exception when others then null; end;
  begin alter table public.bww_system_logs add column if not exists resolved_by text; exception when others then null; end;
end $$;
create index if not exists bww_system_logs_guild_level_idx on public.bww_system_logs (guild_id, level);
create index if not exists bww_system_logs_guild_source_idx on public.bww_system_logs (guild_id, source);
create index if not exists bww_system_logs_resolved_idx on public.bww_system_logs (guild_id, resolved);
-- RLS-Guard wiederholen (idempotent, wie Phase 13):
revoke insert, update, delete, truncate on table public.bww_system_logs from anon, authenticated;
grant select, insert, update, delete on table public.bww_system_logs to service_role;

-- ============================================================================
-- 3) bww-exports Bucket (Phase 8: Exporte CSV/JSON)
-- Typen: tickets, logs, transcripts, giveaway-teilnehmer. Download via
-- /api/dashboard/exports (Permission logs.view/audit.view + Audit-Log).
-- Bucket privat (public=false); Zugriff nur via service_role (Server-Layer).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('bww-exports', 'bww-exports', false)
on conflict (id) do nothing;
-- Storage-Objekte: nur service_role (Default-Deny fuer anon/auth bleibt).
-- Hinweis: Storage-RLS-Policies werden via Dashboard verwaltet; hier kein
-- anon/auth Grant (API generiert Downloads on-the-fly + Audit-Log).

-- ============================================================================
-- 4) RLS-Guard Wiederholung (Phase 13 Muster, idempotent)
-- ============================================================================
revoke insert, update, delete, truncate on table public.bww_notifications from anon, authenticated;
grant select on table public.bww_notifications to authenticated;
revoke all on table public.bww_notifications from anon;
