const { Events } = require("discord.js");
const fs = require("fs");


// Charger les statistiques depuis le fichier JSON
let stats = {};
if (fs.existsSync("stats.json")) {
  stats = JSON.parse(fs.readFileSync("stats.json"));
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignorer les messages du bot
    if (message.author.bot) return;

    // Incrémenter le compteur
    const userId = message.author.id;
    stats[userId] = (stats[userId] || 0) + 1;

    // Sauvegarder
    try {
      fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
    } catch (e) {
      console.error("Erreur d'écriture de stats.json :", e);
    }

    // --- Fonctionnalité "quoi → feur" ---
    const messageContent = message.content.toLowerCase().trim();
    if (/\bquoi\b$/i.test(messageContent)) {
      try {
        await message.reply("FEUR !");
        console.log(`💬 ${message.author.tag} a dit "${message.content}" → Réponse: FEUR`);
      } catch (error) {
        console.error("Erreur lors de la réponse FEUR :", error);
      }
    }
  },
};