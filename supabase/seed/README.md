# Supabase Seed – Beispiele (Nr. 15 Final-Check)

> Verzeichnis per `15_FOLDER_STRUCTURE.md` (`supabase/seed/`). Stand Phase 1-14 auf main.

## Ist-Stand

- `bww_phase2_examples.sql` – Beispiel-Daten für lokale Entwicklung/Tests (alle Tabellen mit Prefix `bww_`).
- `README.md` – diese Doku (ehm. Platzhalter "folgt mit Phase 2" – seit Phase 2 vorhanden).

## Regeln

- Keine echten User-Daten/Secrets einchecken.
- Seed nur lokal/Test, nie Prod überschreiben; Migrationen bleiben Source of Truth (`supabase/migrations/` in chronologischer Reihenfolge ausführen).
