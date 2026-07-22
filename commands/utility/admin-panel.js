const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { hasAdminAccess, buildMainPanel } = require('../../interactions/adminPanelHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-panel')
    .setDescription('Ouvre le panel d\'administration du bot pour ce serveur.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(['Guild']),
  emoji: '🛠️',

  async execute(interaction) {
    if (!hasAdminAccess(interaction)) {
      return interaction.reply({
        content: '❌ Tu dois avoir la permission **Gérer le serveur** (ou Administrateur) pour utiliser cette commande.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const payload = buildMainPanel(interaction.guild);
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  },
};
