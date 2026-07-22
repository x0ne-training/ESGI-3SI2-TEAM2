const { Events } = require('discord.js');
const statsStore = require('../services/statsStore');
const feurEngine = require('../services/feurEngine');
const { isFeatureEnabled } = require('../services/guildConfig');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignorer les bots et les webhooks
    if (message.author.bot || message.webhookId) return;

    // --- Statistiques ---
    if (!message.guildId || isFeatureEnabled(message.guildId, 'stats')) {
      statsStore.incrementMessageCount(message.author.id);
    }

    // --- Réponses "feur" configurables (uniquement en serveur) ---
    if (!message.guildId) return;

    const response = feurEngine.evaluateMessage(message.guildId, message.author.id, message.content);
    if (!response) return;

    try {
      await message.reply({
        content: response,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la réponse feur :', error.message);
    }
  },
};
