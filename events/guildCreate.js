// events/guildCreate.js
// Le bot rejoint un serveur : on prépare immédiatement son dossier de données
// (configuration + catégories par défaut).
const { Events } = require('discord.js');
const { ensureGuildInitialized } = require('../services/guildLifecycle');

module.exports = {
  name: Events.GuildCreate,
  execute(guild) {
    ensureGuildInitialized(guild.id);
    console.log(`➕ Bot ajouté au serveur ${guild.name} (${guild.id}).`);
  },
};
