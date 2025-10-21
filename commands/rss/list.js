const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Chemin vers le fichier de configuration RSS
const RSS_CONFIG_PATH = path.join(__dirname, '..', '..', 'rss-config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rss-list')
        .setDescription('Affiche la liste des flux RSS configurés sur ce serveur'),
    emoji: '📋',

    async execute(interaction) {
        try {
            // Charger la configuration RSS
            if (!fs.existsSync(RSS_CONFIG_PATH)) {
                return await interaction.reply({
                    content: 'Aucun flux RSS n\'est configuré sur ce serveur.\n\nUtilisez `/rss-setup` pour en configurer un.',
                    ephemeral: true
                });
            }

            const configData = fs.readFileSync(RSS_CONFIG_PATH, 'utf8');
            const rssConfig = JSON.parse(configData);

            // Vérifier s'il y a des flux pour ce serveur
            const guildFeeds = rssConfig[interaction.guildId];
            if (!guildFeeds || Object.keys(guildFeeds).length === 0) {
                return await interaction.reply({
                    content: 'Aucun flux RSS n\'est configuré sur ce serveur.\n\nUtilisez `/rss-setup` pour en configurer un.',
                    ephemeral: true
                });
            }

            // Créer un embed avec la liste des flux
            const embed = new EmbedBuilder()
                .setTitle('Flux RSS configurés')
                .setColor('#FF6B35')
                .setTimestamp();

            let description = '';
            let fieldCount = 0;

            for (const [feedId, config] of Object.entries(guildFeeds)) {
                const channel = interaction.guild.channels.cache.get(config.channelId);
                const channelName = channel ? `#${channel.name}` : 'Channel supprimé';
                
                if (fieldCount < 25) { // Limite Discord pour les fields
                    embed.addFields({
                        name: `${config.customName}`,
                        value: `**Channel:** ${channelName}\n**URL:** [${config.feedTitle}](${config.url})\n**Créé le:** ${new Date(config.createdAt).toLocaleDateString('fr-FR')}`,
                        inline: true
                    });
                    fieldCount++;
                }
            }

            const totalFeeds = Object.keys(guildFeeds).length;
            embed.setFooter({ text: `Total: ${totalFeeds} flux RSS configuré${totalFeeds > 1 ? 's' : ''}` });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de l\'affichage des flux RSS:', error);
            await interaction.reply({
                content: 'Une erreur s\'est produite lors de l\'affichage des flux RSS.',
                ephemeral: true
            });
        }
    },
};