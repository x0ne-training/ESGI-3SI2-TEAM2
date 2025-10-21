const fs = require("fs");

module.exports = {
  name: "stats",
  description: "Affiche les statistiques d'activité des membres",

  execute(message, stats) {
    if (message.author.bot) return;

    const userId = message.author.id;
    stats[userId] = (stats[userId] || 0) + 1;

    // Sauvegarde dans stats.json
    fs.writeFileSync("stats.json", JSON.stringify(stats, null, 2));

    // Commande !mystats
    if (message.content === "!mystats") {
      const count = stats[userId] || 0;
      message.reply(`📊 Tu as envoyé **${count}** messages.`);
      return;
    }

    // Commande !stats
    if (message.content === "!stats") {
      const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, 5);
      let reply = "🏆 Classement des membres les plus actifs :\n";

      for (let i = 0; i < top.length; i++) {
        const [id, count] = top[i];
        const user = message.guild.members.cache.get(id);
        reply += `**${i + 1}. ${user ? user.user.username : "Inconnu"}** → ${count} messages\n`;
      }

      message.channel.send(reply);
    }
  }
};