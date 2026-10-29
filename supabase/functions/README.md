# Supabase Edge Functions – reserviert (Nr. 15 Final-Check)

> Verzeichnis reserviert per `15_FOLDER_STRUCTURE.md` (`supabase/functions/`). Stand Phase 1-14 auf main.

## Ist-Stand

- Keine eigenen Edge Functions nötig: Bot (`src/`) + Next.js API-Routen (`website/app/api/*`) decken Realtime/Notifications/Exporte/System ab.
- Verzeichnis bewusst als Platzhalter erhalten – keine Lücke, kein Dead Code.

## Regeln (falls künftig Functions nötig, z. B. Cron/Cleanup)

- Nur `bww_`-Tabellen lesen/schreiben (vgl. `docs/STRUCTURE.md`).
- Secrets nur via Supabase-Vault/ENV, kein Service-Key ins Repo.
- Dashboard und Bot bleiben Single Source of Truth (keine Doppel-Configs).
