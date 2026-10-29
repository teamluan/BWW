// BWW Phase 6 - /welcome-variables (Custom-Variablen, 06_WELCOME.md).
// Aktionen: list/add/update/remove in einem Command. Permissions: Administrator.

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const data = {
  name: 'welcome-variables',
  description: 'Verwaltet Welcome-Variablen (Standard + custom).',
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    {
      name: 'aktion', description: 'Aktion', type: 3, required: true,
      choices: [
        { name: 'Liste', value: 'list' },
        { name: 'Hinzufuegen', value: 'add' },
        { name: 'Entfernen', value: 'remove' },
      ],
    },
    { name: 'name', description: 'Variablen-Name (ohne Klammern, z.B. regeln)', type: 3, required: false },
    { name: 'wert', description: 'Wert/Ersetzungstext', type: 3, required: false },
  ],
};

async function execute(interaction, client) {
  const mod = require('../../modules/welcome/variableService');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Nur Administratoren.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const action = interaction.options.getString('aktion', true);
    if (action === 'list') {
      const customs = await mod.listCustomVariables(interaction.guildId).catch(() => []);
      const std = (mod.STANDARD_VARIABLES || []).join(' ');
      const customText = customs.length
        ? customs.map((c) => `{${c.name}} = ${String(c.value || '').slice(0, 80)}${c.enabled === false ? ' (aus)' : ''}`).join('\n')
        : 'Keine custom Variablen.';
      await interaction.followUp({
        content: `Standard: ${std}\n\nCustom:\n${customText}`.slice(0, 2000),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (action === 'add') {
      const name = interaction.options.getString('name');
      const wert = interaction.options.getString('wert');
      if (!name || wert == null) throw new Error('Name + Wert erforderlich.');
      const created = await mod.createVariable(interaction.guildId, { name, value: wert });
      await interaction.followUp({ content: `Variable {${created.name}} gespeichert.`, flags: MessageFlags.Ephemeral });
      return;
    }
    if (action === 'remove') {
      const name = interaction.options.getString('name');
      if (!name) throw new Error('Name erforderlich.');
      const customs = await mod.listCustomVariables(interaction.guildId).catch(() => []);
      const found = customs.find((c) => c.name.toLowerCase() === String(name).replace(/^\{|\}$/g, '').toLowerCase());
      if (!found) throw new Error('Variable nicht gefunden.');
      await mod.deleteVariable(found.id, interaction.guildId);
      await interaction.followUp({ content: `Variable {${found.name}} entfernt.`, flags: MessageFlags.Ephemeral });
      return;
    }
    throw new Error('Unbekannte Aktion.');
  } catch (err) {
    await interaction.followUp({ content: 'Variablen fehlgeschlagen: ' + err.message, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { data, execute, toJSON: () => data, name: data.name };
