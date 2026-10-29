-- BWW Phase 13 – Security-Haertung (Quelle: 13_SECURITY.md, KEINE Feature-Logik, nur Schutz).
-- Idempotent: CREATE IF NOT EXISTS / DROP POLICY IF EXISTS / REVOKE+GRANT wiederholbar.
-- Stand: Phase 1-12 auf main. Diese Migration schliesst gezielte Luecken aus dem Vorher-Stand:
--  1) Oeffentliche Guild-Enumeration (Phase-1-Policy USING(true) auf bww_guilds) -> entfernen.
--  2) bww_dashboard_logins fehlte in RLS-Abdeckung (Login-Codes) -> Tabelle + RLS + REVOKE + service_role.
--  3) UPDATE-Policies: sicherstellen dass kein anon/authenticated UPDATE ohne USING+WITH CHECK existiert
--     (Phase-2-Stand ist Default-Deny; hier Guard: REVOKE + nur SELECT-Isolation fuer authenticated).
--  4) Views duerfen nicht ungeschuetzt sein (keine neuen Views; Guard-Kommentar + REVOKE-Muster).
--  5) Expires-Indizes + Cleanup-Funktion fuer Codes/Tokens (Verification + Dashboard).

-- ============================================================================
-- 1) Oeffentliche Guild-Enumeration schliessen (Vorher: anon konnte bww_guilds lesen)
-- Phase-1-Fundament hatte: CREATE POLICY "public can read bww guild directory" USING(true).
-- Phase-2 hat sie NICHT gedroppt (nur isolated_read hinzugefuegt) -> beide aktiv = Leak.
-- Fix: public Policy entfernen. Dashboard nutzt service_role (Server-Layer prueft Session+Guild).
-- bww_bot_status bleibt oeffentlich lesbar (Bot-Status участке, kein sensibles Datum).
-- ============================================================================
drop policy if exists "public can read bww guild directory" on public.bww_guilds;
drop policy if exists "public can read bww_guilds" on public.bww_guilds;
-- Guilds: kein direkter anon-Zugriff mehr (Default-Deny). Service-Role via Server-Layer.
revoke all on table public.bww_guilds from anon;
-- Authenticated liest nur via guild-isolierter Policy (Phase 2, bleibt bestehen).
-- Falls Policy fehlt (alte Staende), hier erneut sicherstellen:
drop policy if exists bww_guild_isolated_read on public.bww_guilds;
create policy bww_guild_isolated_read on public.bww_guilds for select to authenticated using (public.bww_can_access_guild(guild_id));
-- Bot-Status: public read bleibt (dokumentiert in docs/SECURITY.md), aber kein Write fuer anon/auth.
revoke insert, update, delete on table public.bww_bot_status from anon, authenticated;
grant select on table public.bww_bot_status to anon, authenticated;
grant select, insert, update, delete on table public.bww_bot_status to service_role;

-- ============================================================================
-- 2) bww_dashboard_logins absichern (Login-Codes: Hash + Ablauf + Einmal-Use)
-- Vorher: Tabelle ohne RLS-Abdeckung in Phase-2-Liste (nur via dashboard.js genutzt).
-- Fix: Tabelle sicherstellen + RLS + Default-Deny + service_role. Codes nie im Klartext loggen.
-- ============================================================================
create table if not exists public.bww_dashboard_logins (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.bww_dashboard_logins enable row level security;
revoke all on table public.bww_dashboard_logins from anon, authenticated;
grant select, insert, update, delete on table public.bww_dashboard_logins to service_role;
-- Kein authenticated-Direktzugriff (nur service_role via Server-Layer: find/consume mit Hash + Ablauf-Filter).
-- Falls alte permissive Policy existiert, entfernen:
drop policy if exists bww_guild_isolated_read on public.bww_dashboard_logins;
drop policy if exists "public can read bww dashboard logins" on public.bww_dashboard_logins;
create index if not exists bww_dashboard_logins_hash_idx on public.bww_dashboard_logins (code_hash);
create index if not exists bww_dashboard_logins_expiry_idx on public.bww_dashboard_logins (expires_at);
create index if not exists bww_dashboard_logins_guild_idx on public.bww_dashboard_logins (guild_id);

-- bww_dashboard_actions ebenfalls absichern (Bot-Queue, nur service_role):
-- Tabelle existiert aus 20261001131442; hier nur RLS-Guard (No-Op falls bereits korrekt).
do $$ begin
  begin
    alter table public.bww_dashboard_actions enable row level security;
  exception when others then null;
  end;
  begin
    revoke all on table public.bww_dashboard_actions from anon, authenticated;
  exception when others then null;
  end;
  begin
    grant select, insert, update, delete on table public.bww_dashboard_actions to service_role;
  exception when others then null;
  end;
end $$;

-- ============================================================================
-- 3) UPDATE-Guard: USING + WITH CHECK (13_SECURITY Vorgabe)
-- Phase-2-Stand: KEINE Update/Delete/Insert-Policies fuer anon/authenticated (Default-Deny).
-- Das ist sicher. Falls je eine UPDATE-Policy fuer authenticated hinzugefuegt wird, MUSS sie
-- USING + WITH CHECK mit bww_can_access_guild(guild_id) enthalten, sonst Guild-Escape.
-- Guard: alle Schreibrechte fuer anon/authenticated auf bww_*-Tabellen entziehen (idempotent).
-- Schreiben nur via service_role (Bot/Dashboard-Server-Layer prueft Guild + Matrix).
-- ============================================================================
revoke insert, update, delete, truncate on table public.bww_guilds from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_guild_settings from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_guild_roles from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_guild_channels from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_tickets from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_ticket_panels from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_ticket_types from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_ticket_members from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_ticket_messages from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_ticket_actions from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_ticket_templates from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_honeypots from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_honeypot_triggers from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_honeypot_exemptions from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_embeds from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_embed_components from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_embed_actions from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_embed_select_options from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_embed_buttons from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_welcome from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_welcome_variables from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_welcome_logs from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_giveaways from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_giveaway_entries from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_giveaway_winners from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_giveaway_requirements from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_giveaway_rerolls from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_verification from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_verification_users from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_verification_attempts from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_verification_codes from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_verification_logs from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_audit_logs from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_system_logs from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_notifications from anon, authenticated;
revoke insert, update, delete, truncate on table public.bww_dashboard_logins from anon, authenticated;

-- ============================================================================
-- 4) Views: nicht ungeschuetzt veroeffentlichen (13_SECURITY Vorgabe)
-- Stand: keine Views im Repo (nur Tabellen). Guard: Falls je ein View auf bww_*-Tabellen
-- erstellt wird, MUSS er WITH (security_invoker = true) + RLS der Basis-Tabellen erben
-- und darf NICHT an anon/authenticated gegrantet werden. Hier dokumentiert als Kommentar
-- (kein DDL noetig, solange keine Views existieren). Beispiel bei Bedarf:
--   create or replace view public.bww_guild_overview with (security_invoker = true) as ...;
--   revoke all on table public.bww_guild_overview from anon, authenticated;
-- ============================================================================
-- (Keine View-Aenderung in dieser Migration – nur Guard-Kommentar, keine Feature-Logik.)

-- ============================================================================
-- 5) Ablauf + Cleanup: Expires-Indizes sicherstellen + Cleanup-Funktion (idempotent)
-- Verification-Codes + Dashboard-Codes laufen ab (expires_at) und werden per
-- Scheduler/Cleanup geloescht/deaktiviert (website/lib/verification.js + dashboard.js).
-- ============================================================================
create index if not exists bww_verification_codes_expiry_idx on public.bww_verification_codes (expires_at);
create index if not exists bww_verification_users_expires_idx on public.bww_verification_users (expires_at);

create or replace function public.bww_purge_expired_codes()
returns integer language plpgsql security definer as $$
declare v_deleted integer := 0; v_n integer := 0;
begin
  delete from public.bww_verification_codes where used_at is null and used is not true and expires_at < now();
  get diagnostics v_n = row_count; v_deleted := v_deleted + coalesce(v_n, 0);
  delete from public.bww_dashboard_logins where used_at is null and expires_at < now();
  get diagnostics v_n = row_count; v_deleted := v_deleted + coalesce(v_n, 0);
  return v_deleted;
exception when others then return v_deleted;
end;
$$;
-- Nur service_role darf die Cleanup-Funktion ausfuehren (kein anon/auth-Direktaufruf).
revoke all on function public.bww_purge_expired_codes() from anon, authenticated;
grant execute on function public.bww_purge_expired_codes() to service_role;
revoke all on function public.bww_can_access_guild(text) from anon, authenticated;
grant execute on function public.bww_can_access_guild(text) to authenticated, service_role;
