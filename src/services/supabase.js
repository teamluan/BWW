// BWW Phase 1 – zentraler Supabase-Service (Single Source of Truth).
// Dashboard (website/lib) und Bot-Commands nutzen dieselben bww_-Tabellen via Supabase.
// Keine Doppel-Configs, keine .env-Secrets im Repo – nur ENV (siehe .env.example).
// Wrapper um fetch (Node 22+ global). Bestehende Logik in src/utils/database.js bleibt kanonisch
// und wird hier schrittweise hin migriert (Phase 1: nur Verbindung + Low-Level-Request).

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
    ...(extra || {}),
  };
}

// Low-Level REST-Request gegen PostgREST. Gibt Response zurueck (Aufrufer parst JSON).
// Wirft bei HTTP-Fehler mit gekuerztem Body – Aufrufer entscheidet ueber Retry/Fallback.
async function supabaseRequest(path, options = {}) {
  if (!isConfigured()) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: serviceHeaders({ Prefer: 'return=minimal', ...(options.headers || {}) }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase HTTP ${response.status}: ${String(body).slice(0, 500)}`);
  }
  return response;
}

module.exports = { SUPABASE_URL, isConfigured, serviceHeaders, supabaseRequest };
