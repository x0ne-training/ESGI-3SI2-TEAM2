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
  execute(message) {
    // Ignorer les messages des bots
    if (message.author.bot) return;

    // Exécuter la commande de statistiques
    statsCommand.execute(message, stats);
  }
};