// BWW Phase 9 – /ticket (konsolidiert: setup/panel/create/close/reopen/delete/claim/unclaim/add/remove/rename/priority/transcript/info +template).
// Duenne Wrapper um bestehende Modul-Services (keine Duplikat-Logik).
// Bestehende panel-create/type-add/ticket als Basis, Legacy-Aliase erhalten.
// Grundprinzip: 1 Guild, 2 BWW-Perm, 3 Discord-Perm, 4 Validation, 5 DB via Service, 6 ephemeral, 7 Audit/Log.
// Phase 11: Matrix-Gate fuer Admin-Aktionen (setup=settings, panel/info/template=manage,
// reopen/reopen, delete/delete, transcript/transcript). create/claim/unclaim/add/remove/rename/
// priority/close entscheidet der Service-Layer (Matrix-isStaff + Ersteller-Regeln wie
// allowUserClose) – keine Slash-Sonder-Checks mehr, kein Admin-Hardcheck.
const { MessageFlags } = require('discord.js');
const data = {
  name: 'ticket',
  description: 'Ticket verwalten (Setup, Panel, Create, Claim, Close, Transcript, Info).',
  options: [
    { name: 'setup', description: 'Ticket-System konfigurieren (Dashboard-paritaet).', type: 1, options: [
      { name: 'kategorie', description: 'Kategorie fuer Ticket-Kanaele', type: 7, required: true, channel_types: [4] },
      { name: 'rolle', description: 'Support-Rolle', type: 8, required: true },
      { name: 'log-channel', description: 'Log/Transcript-Channel', type: 7, required: false, channel_types: [0] },
      { name: 'transcript', description: 'Transcript beim Schliessen?', type: 5, required: false },
      { name: 'close-delete', description: 'Channel nach Schliessen loeschen?', type: 5, required: false },
      { name: 'user-close', description: 'Ersteller darf selbst schliessen?', type: 5, required: false },
      { name: 'max', description: 'Max offene Tickets pro User (1-5)', type: 4, required: false, min_value: 1, max_value: 5 },
    ]},
    { name: 'panel', description: 'Ticket-Panel erstellen+senden.', type: 1, options: [
      { name: 'titel', description: 'Panel-Titel', type: 3, required: true },
      { name: 'beschreibung', description: 'Panel-Beschreibung', type: 3, required: false },
      { name: 'channel', description: 'Ziel-Channel', type: 7, required: true, channel_types: [0] },
      { name: 'kategorie', description: 'Kategorie fuer Tickets', type: 7, required: false, channel_types: [4] },
      { name: 'staff-rolle', description: 'Staff-Rolle', type: 8, required: false },
    ]},
    { name: 'create', description: 'Ticket manuell erstellen.', type: 1, options: [
      { name: 'grund', description: 'Anliegen/Grund', type: 3, required: true },
      { name: 'beschreibung', description: 'Beschreibung', type: 3, required: false },
      { name: 'typ-id', description: 'Ticket-Typ-ID (optional, sonst Standard)', type: 3, required: false },
    ]},
    { name: 'claim', description: 'Ticket uebernehmen', type: 1, options: [{ name: 'id', description: 'Ticket-ID (leer = aktueller Channel)', type: 3, required: false }] },
    { name: 'unclaim', description: 'Ticket freigeben', type: 1, options: [{ name: 'id', description: 'Ticket-ID', type: 3, required: false }] },
    { name: 'add', description: 'Mitglied hinzufuegen', type: 1, options: [{ name: 'user', description: 'Benutzer', type: 6, required: true }, { name: 'id', description: 'Ticket-ID', type: 3, required: false }] },
    { name: 'remove', description: 'Mitglied entfernen', type: 1, options: [{ name: 'user', description: 'Benutzer', type: 6, required: true }, { name: 'id', description: 'Ticket-ID', type: 3, required: false }] },
    { name: 'rename', description: 'Ticket umbenennen', type: 1, options: [{ name: 'name', description: 'Neuer Name', type: 3, required: true }, { name: 'id', description: 'Ticket-ID', type: 3, required: false }] },
    { name: 'priority', description: 'Prioritaet setzen', type: 1, options: [{ name: 'stufe', description: 'Prioritaet', type: 3, required: true, choices: [{ name: 'Niedrig', value: 'low' }, { name: 'Normal', value: 'normal' }, { name: 'Hoch', value: 'high' }, { name: 'Dringend', value: 'urgent' }] }, { name: 'id', description: 'Ticket-ID', type: 3, required: false }] },
    { name: 'close', description: 'Ticket schliessen', type: 1, options: [{ name: 'grund', description: 'Grund', type: 3, required: false }, { name: 'id', description: 'Ticket-ID', type: 3, required: false }] },
    { name: 'reopen', description: 'Ticket wieder oeffnen', type: 1, options: [{ name: 'id', description: 'Ticket-ID', type: 3, required: false }] },
    { name: 'delete', description: 'Ticket loeschen', type: 1, options: [{ name: 'id', description: 'Ticket-ID', type: 3, required: false }] },
    { name: 'transcript', description: 'Transcript erstellen', type: 1, options: [{ name: 'id', description: 'Ticket-ID', type: 3, required: false }] },
    { name: 'info', description: 'Ticket-Details anzeigen.', type: 1, options: [{ name: 'id', description: 'Ticket-ID (leer = aktueller Channel)', type: 3, required: false }] },
    { name: 'template', description: 'Template-Antwort senden', type: 1, options: [{ name: 'name', description: 'Template-Name', type: 3, required: true }] },
  ],
};
async function resolveId(interaction) {
  const explicit = interaction.options.getString('id') || null;
  if (explicit) return explicit;
  const { getTicketByChannel } = require('../../modules/ticket/ticketService');
  const t = await getTicketByChannel(interaction.channelId, interaction.guildId).catch(() => null);
  if (!t) throw new Error('Kein Ticket angegeben und aktueller Channel ist kein Ticket.');
  return t.id;
}
async function execute(interaction, client) {
  if (!interaction.guildId || !interaction.guild) { await interaction.reply({ content: 'Nur auf Servern.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const { requireGuildId } = require('../../services/validation');
  try { requireGuildId(interaction.guildId); } catch { await interaction.reply({ content: 'Ungueltige Guild-ID.', flags: MessageFlags.Ephemeral }).catch(() => {}); return; }
  const sub = interaction.options.getSubcommand(true);
  // Phase 11: Matrix-Gate fuer Admin-Aktionen (setup/panel/reopen/delete/transcript/info/template).
  // create/claim/unclaim/add/remove/rename/priority/close entscheidet der Service-Layer
  // (Matrix-isStaff + Ersteller-Regeln wie allowUserClose) – keine Slash-Sonder-Checks mehr.
  const gated = { setup: 'ticket.settings', panel: 'ticket.manage', reopen: 'ticket.reopen', delete: 'ticket.delete', transcript: 'ticket.transcript', info: 'ticket.manage', template: 'ticket.manage' };
  if (gated[sub]) {
    try {
      const { requirePermission, loadGuildRoleMappings } = require('../../services/permissions');
      const { getGuildSettings } = require('../../utils/database');
      const settings = await getGuildSettings(interaction.guildId).catch(() => null);
      const guildRoles = await loadGuildRoleMappings(interaction.guildId).catch(() => []);
      await requirePermission(interaction.member, gated[sub], { guildId: interaction.guildId, guildRoles, settings });
    } catch {
      await interaction.reply({ content: 'Keine Berechtigung (' + gated[sub] + ').', flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }
  }
  const actions = require('../../modules/ticket/actionsService');
  const { logAudit } = require('../../services/audit');
  const { logger } = require('../../services/logger');
  try {
    if (sub === 'setup') {
      const { getGuildSettings, saveGuildSettings } = require('../../utils/database');
      const cfg = await getGuildSettings(interaction.guildId);
      const category = interaction.options.getChannel('kategorie', true);
      const role = interaction.options.getRole('rolle', true);
      const logChannel = interaction.options.getChannel('log-channel');
      cfg.ticket = {
        ...(cfg.ticket || {}),
        enabled: true,
        categoryId: category.id,
        roleId: role.id,
        logChannelId: logChannel?.id || cfg.ticket?.logChannelId || '',
        transcriptEnabled: interaction.options.getBoolean('transcript') ?? cfg.ticket?.transcriptEnabled ?? true,
        closeDelete: interaction.options.getBoolean('close-delete') ?? cfg.ticket?.closeDelete ?? true,
        allowUserClose: interaction.options.getBoolean('user-close') ?? cfg.ticket?.allowUserClose ?? true,
        maxOpenPerUser: Math.max(1, Math.min(5, interaction.options.getInteger('max') || cfg.ticket?.maxOpenPerUser || 1)),
      };
      await saveGuildSettings(interaction.guildId, cfg, interaction.user.id);
      await logAudit({ guildId: interaction.guildId, actorId: interaction.user.id, action: 'ticket.setup', details: { category: category.id } }).catch(() => {});
      await interaction.reply({ content: 'Ticket-System gespeichert (Dashboard-paritaet, bww_guild_settings). Kategorie: ' + category + ' - Support: ' + role, flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'panel') {
      const { createPanel, listTypes, sendPanelMessage } = require('../../modules/ticket/panelService');
      const channel = interaction.options.getChannel('channel', true);
      const panel = await createPanel(interaction.guildId, {
        title: interaction.options.getString('titel', true),
        description: interaction.options.getString('beschreibung') || 'Wahle dein Anliegen',
        channel_id: channel.id,
        category_id: interaction.options.getChannel('kategorie')?.id || null,
        staff_role_id: interaction.options.getRole('staff-rolle')?.id || null,
      }, interaction.user.id);
      const types = await listTypes(interaction.guildId, panel.id, true).catch(() => []);
      const sent = await sendPanelMessage(client, { ...panel, channel_id: channel.id }, types);
      await interaction.reply({ content: 'Panel erstellt (`' + panel.id + '`) und gesendet: ' + channel + ' ([Nachricht](' + sent.url + ')).', flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'create') {
      const { createTicket, getTicket } = require('../../modules/ticket/ticketService');
      const { listTypes, listPanels } = require('../../modules/ticket/panelService');
      const reason = interaction.options.getString('grund', true);
      const desc = interaction.options.getString('beschreibung') || '';
      const typeId = interaction.options.getString('typ-id');
      let useType = typeId || null;
      if (!useType) {
        const types = await listTypes(interaction.guildId, null, true).catch(() => []);
        if (types?.[0]) useType = types[0].id;
        else {
          const panels = await listPanels(interaction.guildId, true).catch(() => []);
          if (!panels?.[0]) throw new Error('Kein Panel/Typ konfiguriert. Erst /ticket panel + /ticket-type-add.');
          const t2 = await listTypes(interaction.guildId, panels[0].id, true).catch(() => []);
          if (t2?.[0]) useType = t2[0].id;
          else {
            const { createType } = require('../../modules/ticket/panelService');
            const nt = await createType(interaction.guildId, { name: 'Support', panel_id: panels[0].id }, interaction.user.id);
            useType = nt.id;
          }
        }
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
      const { ticket, channel } = await createTicket(interaction.guild, interaction.user, { typeId: useType, reason, description: desc });
      await logAudit({ guildId: interaction.guildId, actorId: interaction.user.id, action: 'ticket.create', targetId: ticket.id, details: { via: 'slash' } }).catch(() => {});
      await interaction.followUp({ content: 'Ticket erstellt: ' + channel + ' - ID: `' + ticket.id + '`', flags: MessageFlags.Ephemeral }).catch(async () => { await interaction.reply({ content: 'Ticket erstellt.', flags: MessageFlags.Ephemeral }).catch(() => {}); });
      return;
    }
    if (sub === 'info') {
      const id = await resolveId(interaction);
      const { getTicket } = require('../../modules/ticket/ticketService');
      const t = await getTicket(id, interaction.guildId);
      if (!t) throw new Error('Ticket nicht gefunden.');
      await logAudit({ guildId: interaction.guildId, actorId: interaction.user.id, action: 'ticket.info', targetId: id, details: {} }).catch(() => {});
      const line = '**' + (t.id || '?') + '** (#' + (t.ticket_number ?? '?') + ')\nStatus: ' + (t.status || '?') + ' - Prio: ' + (t.priority || 'normal') + '\nGrund: ' + (t.reason || '-') + '\nOwner: ' + (t.owner_id ? '<@' + t.owner_id + '>' : '-') + (t.claimed_by ? ('\nClaim: <@' + t.claimed_by + '>') : '') + (t.channel_id ? ('\nChannel: <#' + t.channel_id + '>') : '');
      await interaction.reply({ content: line.slice(0, 2000), flags: MessageFlags.Ephemeral });
      return;
    }
    if (sub === 'claim') {
      const id = await resolveId(interaction);
      await actions.claimTicket(client, id, interaction.member);
      await interaction.reply({ content: 'Ticket uebernommen.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'unclaim') {
      const id = await resolveId(interaction);
      await actions.unclaimTicket(client, id, interaction.member);
      await interaction.reply({ content: 'Ticket freigegeben.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'add') {
      const id = await resolveId(interaction);
      await actions.addMember(client, id, interaction.member, interaction.options.getUser('user', true).id);
      await interaction.reply({ content: 'Mitglied hinzugefuegt.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'remove') {
      const id = await resolveId(interaction);
      await actions.removeMember(client, id, interaction.member, interaction.options.getUser('user', true).id);
      await interaction.reply({ content: 'Mitglied entfernt.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'rename') {
      const id = await resolveId(interaction);
      const name = await actions.renameTicket(client, id, interaction.member, interaction.options.getString('name', true));
      await interaction.reply({ content: 'Umbenannt zu `' + name + '`.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'priority') {
      const id = await resolveId(interaction);
      await actions.setPriority(client, id, interaction.member, interaction.options.getString('stufe', true));
      await interaction.reply({ content: 'Prioritaet gesetzt.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'close') {
      const id = await resolveId(interaction);
      await actions.closeTicket(client, id, interaction.member, interaction.options.getString('grund') || 'Kein Grund angegeben');
      await interaction.reply({ content: 'Ticket geschlossen.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'reopen') {
      const id = await resolveId(interaction);
      await actions.reopenTicket(client, id, interaction.member);
      await interaction.reply({ content: 'Ticket wieder geoeffnet.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'delete') {
      const id = await resolveId(interaction);
      await actions.deleteTicket(client, id, interaction.member, { deleteChannel: true });
      await interaction.reply({ content: 'Ticket geloescht.', flags: MessageFlags.Ephemeral });
    } else if (sub === 'transcript') {
      const id = await resolveId(interaction);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { getTicket } = require('../../modules/ticket/ticketService');
      const { createTranscript } = require('../../modules/ticket/transcriptService');
      const t = await getTicket(id, interaction.guildId);
      const res = await createTranscript(client, t);
      await interaction.followUp({ content: 'Transcript (' + res.messages + ' Nachrichten): `' + res.url + '`', flags: MessageFlags.Ephemeral });
    } else if (sub === 'template') {
      const { listTemplates, renderTemplate } = require('../../modules/ticket/templateService');
      const name = interaction.options.getString('name', true);
      const all = await listTemplates(interaction.guildId, true);
      const tpl = all.find((t) => t.name === name);
      if (!tpl) throw new Error('Template "' + name + '" nicht gefunden.');
      await interaction.reply({ content: renderTemplate(tpl, { member: interaction.member, guild: interaction.guild }).slice(0, 2000) });
    } else {
      await interaction.reply({ content: 'Unbekannter Subcommand.', flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    logger.child('command:ticket').warn('failed', interaction.guildId, err.message);
    const msg = '' + err.message;
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: msg.slice(0, 2000), flags: MessageFlags.Ephemeral }).catch(() => {});
    else await interaction.reply({ content: msg.slice(0, 2000), flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}
module.exports = { data, execute, toJSON: () => data, name: data.name };
