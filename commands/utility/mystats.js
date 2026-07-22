const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const statsStore = require("../../services/statsStore");
const { isFeatureEnabled } = require("../../services/guildConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mystats")
    .setDescription("Affiche ton nombre total de messages"),
  async execute(interaction) {
    if (interaction.guildId && !isFeatureEnabled(interaction.guildId, "stats")) {
      return interaction.reply({
        content: "📊 La collecte des statistiques est désactivée sur ce serveur.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const count = statsStore.getMessageCount(interaction.user.id);
    await interaction.reply({ content: `📊 Tu as envoyé **${count}** messages.`, flags: MessageFlags.Ephemeral });
  }
};
