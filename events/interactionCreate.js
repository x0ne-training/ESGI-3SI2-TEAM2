// events/interactionCreate.js
const { Events } = require('discord.js');
const mini = require('../features/minijeux');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.client.commands.get(interaction.commandName);
      if (!cmd) return;
      try {
        await cmd.execute(interaction);
      } catch (e) {
        console.error(e);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: '❌ Erreur interne.',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: '❌ Erreur interne.',
            ephemeral: true,
          });
        }
      }
      return;
    }

    // Boutons (RPS)
    if (interaction.isButton()) {
      const [ns, move, uid] = interaction.customId.split(':');
      if (ns === 'rps') {
        return mini.handleRpsButton(interaction, move, uid);
      }
    }
  },
};
