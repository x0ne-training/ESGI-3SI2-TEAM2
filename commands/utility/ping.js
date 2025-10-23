const { SlashCommandBuilder } = require('discord.js');

/**
 * =================================
 * COMMANDE PING - Test de latence
 * =================================
 * 
 * Fonction : Teste la latence du bot Discord
 * 
 * Fonctionnement :
 * 1. Envoie un premier message "Pong! 🏓"
 * 2. Calcule la latence entre l'interaction et la réponse
 * 3. Récupère la latence de l'API Discord (WebSocket)
 * 4. Met à jour le message avec les deux latences
 * 
 * Utilité :
 * - Vérifier que le bot répond
 * - Diagnostiquer les problèmes de connexion
 * - Monitorer les performances du bot
 * 
 * Usage : /ping (aucun paramètre requis)
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Affiche la latence du bot'),
    // Métadonnées pour la commande help

    emoji: '🏓',
    async execute(interaction) {
        const sent = await interaction.reply({ 
            content: 'Pong! 🏓', 
            fetchReply: true 
        });
        
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);
        
        await interaction.editReply(`🏓 Pong!\n📡 Latence: ${latency}ms\n💓 API: ${apiLatency}ms`);
    },
};
