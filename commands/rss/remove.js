const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Chemin vers le fichier de configuration RSS
const RSS_CONFIG_PATH = path.join(__dirname, '..', '..', 'rss-config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rss-remove')
        .setDescription('Supprime un flux RSS configuré')
        .addStringOption(option =>
            option
                .setName('nom')
                .setDescription('Nom du flux RSS à supprimer')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    emoji: '🗑️',

    async execute(interaction) {
        // Vérifier que l'utilisateur a les permissions d'administrateur
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: 'Vous devez être administrateur pour supprimer les flux RSS.',
                ephemeral: true
            });
        }

        const feedName = interaction.options.getString('nom');

        try {
            // Charger la configuration RSS
            if (!fs.existsSync(RSS_CONFIG_PATH)) {
                return await interaction.reply({
                    content: 'Aucun flux RSS n\'est configuré sur ce serveur.',
                    ephemeral: true
                });
            }

            const configData = fs.readFileSync(RSS_CONFIG_PATH, 'utf8');
            const rssConfig = JSON.parse(configData);

            // Vérifier s'il y a des flux pour ce serveur
            const guildFeeds = rssConfig[interaction.guildId];
            if (!guildFeeds || Object.keys(guildFeeds).length === 0) {
                return await interaction.reply({
                    content: 'Aucun flux RSS n\'est configuré sur ce serveur.',
                    ephemeral: true
                });
            }

            // Chercher le flux à supprimer
            let feedToRemove = null;
            let feedIdToRemove = null;

            for (const [feedId, config] of Object.entries(guildFeeds)) {
                if (config.customName === feedName || config.feedTitle === feedName) {
                    feedToRemove = config;
                    feedIdToRemove = feedId;
                    break;
                }
            }

            if (!feedToRemove) {
                return await interaction.reply({
                    content: `Aucun flux RSS trouvé avec le nom "${feedName}".\n\nUtilisez \`/rss-list\` pour voir tous les flux configurés.`,
                    ephemeral: true
                });
            }

            // Supprimer le flux
            delete rssConfig[interaction.guildId][feedIdToRemove];

            // Si plus aucun flux pour ce serveur, supprimer la clé du serveur
            if (Object.keys(rssConfig[interaction.guildId]).length === 0) {
                delete rssConfig[interaction.guildId];
            }

            // Sauvegarder la configuration
            fs.writeFileSync(RSS_CONFIG_PATH, JSON.stringify(rssConfig, null, 2));

            await interaction.reply({
                content: `**Flux RSS supprimé avec succès !**\n**Flux:** ${feedToRemove.customName}\n🔗 **URL:** ${feedToRemove.url}`
            });

            console.log(`RSS supprimé: ${feedToRemove.customName} par ${interaction.user.tag}`);

        } catch (error) {
            console.error('Erreur lors de la suppression RSS:', error);
            await interaction.reply({
                content: 'Une erreur s\'est produite lors de la suppression du flux RSS.',
                ephemeral: true
            });
        }
    },
};