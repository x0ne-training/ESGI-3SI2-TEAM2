const { Events } = require("discord.js");
const fs = require("fs");
const statsCommand = require("../commands/utility/stats");

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

    // --- Exécuter la commande de statistiques ---
    statsCommand.execute(message, stats);
  },
};