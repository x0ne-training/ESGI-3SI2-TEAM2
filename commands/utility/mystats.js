const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mystats")
    .setDescription("Affiche ton nombre total de messages"),
  async execute(interaction) {
    const path = "stats.json";
    const stats = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {};
    const count = stats[interaction.user.id] || 0;
    await interaction.reply({ content: `📊 Tu as envoyé **${count}** messages.`, ephemeral: true });
  }
};