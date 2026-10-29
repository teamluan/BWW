# Commands `general/` - Doku (Bot-only, kein Dashboard)

 > Allgemeine Setup/Admin-Commands, kein eigenes Modul.

 ## Dateien (Ist)

 - `config.js` - Bot-Konfiguration
 - `settings.js` / `setup.js` - Guild-Setup (`/setup`, `/setup-*`)
 - `help.js` / `ping.js` - Hilfe + Latenz

 ## Prinzip

 - Schreibt zentrale `bww_guild_settings` in Supabase (einzige Quelle, kein Web-Dashboard).
 - Permissions via `src/services/permissions.js` (`setup-*` nur Staff/Owner).
 - Geteilte Services (Supabase/Permissions/Logger/Audit/Variables).