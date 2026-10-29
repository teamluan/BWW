// BWW Phase 5 – Embed-Konstanten (Quelle: 05_EMBED_V2.md).
// Single Source of Truth: Supabase (bww_embeds/components/actions/select_options/buttons).
// Legacy bww_embed_templates bleibt erhalten (nur Lesen/Klonen, kein Schreiben neuer Logik dort).

const COMPONENT_TYPES = Object.freeze([
  'container', 'section', 'text', 'thumbnail', 'media', 'media_gallery', 'gallery', 'file', 'separator', 'button', 'select', 'action_row',
]);

// Kanonische Builder-Typen (05: [+Container][+Text][+Section][+Button][+Select][+Gallery][+Separator])
const BUILDER_TYPES = Object.freeze(['container', 'text', 'section', 'button', 'select', 'media_gallery', 'separator']);

const BUTTON_STYLES = Object.freeze(['primary', 'secondary', 'success', 'danger', 'link']);

// Button Actions (05): Nachricht senden, Embed senden, Modal oeffnen, Ticket erstellen, Link oeffnen, Rolle-Aktion, Custom
const BUTTON_ACTIONS = Object.freeze([
  'send_message', 'send_embed', 'modal_open', 'ticket_create', 'open_url', 'role_add', 'role_remove', 'role_toggle', 'role_action', 'custom', 'none',
]);

const SELECT_RESPONSE_TYPES = Object.freeze(['none', 'message', 'embed', 'ticket', 'modal', 'role_action']);

// Embed-/Component-Actions (actionService): validiert + permission-geprueft
const EMBED_ACTION_TYPES = Object.freeze([
  'send', 'send_message', 'send_embed', 'update', 'dm', 'role_assign', 'role_remove', 'role_add', 'role_toggle', 'role_action', 'ticket_create', 'open_url', 'modal_open', 'custom', 'none',
]);

function assertComponentType(value) {
  const v = String(value || '').toLowerCase();
  const mapped = v === 'media gallery' ? 'media_gallery' : v === 'select menu' ? 'select' : v === 'action row' ? 'action_row' : v;
  if (!COMPONENT_TYPES.includes(mapped)) throw new Error(`Ungueltige Komponente: ${value}. Erlaubt: ${COMPONENT_TYPES.join(', ')}`);
  return mapped;
}

function assertButtonStyle(value) {
  const v = String(value || 'secondary').toLowerCase();
  if (!BUTTON_STYLES.includes(v)) throw new Error(`Ungueltiger Button-Style: ${value}. Erlaubt: ${BUTTON_STYLES.join(', ')}`);
  return v;
}

function assertButtonAction(value) {
  const v = String(value || 'send_message').toLowerCase();
  if (!BUTTON_ACTIONS.includes(v)) throw new Error(`Ungueltige Button-Action: ${value}. Erlaubt: ${BUTTON_ACTIONS.join(', ')}`);
  return v;
}

function assertSelectResponse(value) {
  const v = String(value || 'message').toLowerCase();
  if (!SELECT_RESPONSE_TYPES.includes(v)) throw new Error(`Ungueltiger Response-Typ: ${value}. Erlaubt: ${SELECT_RESPONSE_TYPES.join(', ')}`);
  return v;
}

function assertEmbedAction(value) {
  const v = String(value || 'send_message').toLowerCase();
  if (!EMBED_ACTION_TYPES.includes(v)) throw new Error(`Ungueltige Embed-Action: ${value}. Erlaubt: ${EMBED_ACTION_TYPES.join(', ')}`);
  return v;
}

module.exports = {
  COMPONENT_TYPES, BUILDER_TYPES, BUTTON_STYLES, BUTTON_ACTIONS, SELECT_RESPONSE_TYPES, EMBED_ACTION_TYPES,
  assertComponentType, assertButtonStyle, assertButtonAction, assertSelectResponse, assertEmbedAction,
};
