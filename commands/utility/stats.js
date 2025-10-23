const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Affiche le top des membres les plus actifs"),
  async execute(interaction) {
    const path = "stats.json";
    const stats = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {};
    const sorted = Object.entries(stats).sort((a,b) => b[1]-a[1]).slice(0,5);

    let reply = "🏆 Classement des membres les plus actifs :\n";
    for (let i = 0; i < sorted.length; i++) {
      const [id, count] = sorted[i];
      const member = await interaction.guild.members.fetch(id).catch(() => null);
      reply += `${i+1}. **${member ? member.user.username : "Inconnu"}** → ${count} messages\n`;
    }
    await interaction.reply(reply);
  }
};