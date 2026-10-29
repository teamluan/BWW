# BWW – Zentrale Services (Phase 1, 01_ARCHITECTURE Kap. 4)

Single Source of Truth: Dashboard (`website/lib`) und Discord-Commands (`src/commands`)
lesen/schreiben dieselben `bww_`-Tabellen in Supabase. Keine Doppel-Configs.

| Service | Datei | Zweck |
|---|---|---|
| supabase | `supabase.js` | Verbindung + `supabaseRequest()` (ENV-only, keine Secrets im Repo) |
| permissions | `permissions.js` | Rollen-Mapping aus `bww_guild_settings.settings.permissions` |
| logger | `logger.js` | `debug/info/warn/error`, Webhook-Forward (silent-fail) |
| audit | `audit.js` | Schreibt `bww_audit_logs`, fallback Logger, wirft nie |
| variables | `variables.js` | `{user} {server} {membercount} …` für alle Module |
| message builder | `messageBuilder.js` | Zentrale Embeds, Hülle um `src/utils/embeds.js` |
| cache | `cache.js` | Prozesslokaler TTL-Cache (Settings 5s) |
| scheduler | `scheduler.js` | Registry für Interval-Tasks (Status, Giveaway, Autoclose) |
| discord | `discord.js` | Guild/Member/Channel-Fetch mit Cache-Fallback |
| validation | `validation.js` | Snowflake-/Text-Normalisierung vor Supabase-Calls |

Bestand (`src/utils/database.js`, `src/logger.js`) bleibt vorerst kanonisch und wird
schrittweise auf diese Services migriert. Phase 1 bricht nichts Bestehendes.
