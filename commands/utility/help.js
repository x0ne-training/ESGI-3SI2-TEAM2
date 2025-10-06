const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * ===============================================
 * COMMANDE HELP - Système d'aide automatique
 * ===============================================
 * 
 * Fonction : Génère automatiquement la liste de toutes les commandes disponibles
 * 
 * Fonctionnement :
 * 1. Récupère toutes les commandes depuis client.commands (Collection Discord.js)
 * 2. Parcourt chaque commande pour extraire ses métadonnées
 * 3. Utilise l'emoji personnalisé ou un emoji par défaut (🔧)
 * 4. Récupère la description depuis command.data.description
 * 5. Trie les commandes par ordre alphabétique
 * 6. Génère un embed avec toutes les informations
 * 
 * Avantages du système :
 * - 100% automatique : aucune maintenance manuelle requise
 * - Scalable : nouvelles commandes apparaissent automatiquement
 * - Cohérent : utilise les vraies descriptions des commandes
 * - Organisé : tri alphabétique et compteur de commandes
 * 
 * Structure requise pour les commandes :
 * - command.data.name : nom de la commande
 * - command.data.description : description officielle
 * - command.emoji (optionnel) : emoji d'affichage
 * 
 * Usage : /help (aucun paramètre requis)
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche la liste des commandes disponibles'),
    // Métadonnées pour la commande help
    emoji: '❓',
    async execute(interaction) {
        // Récupérer toutes les commandes disponibles
        const commands = interaction.client.commands;
        const commandFields = [];

        // Parcourir toutes les commandes et créer les champs
        commands.forEach(command => {
            const emoji = command.emoji || '🔧'; // Emoji par défaut si non défini
            const description = command.data.description;
            
            commandFields.push({
                name: `${emoji} /${command.data.name}`,
                value: description,
                inline: true
            });
        });

        // Trier les commandes par nom pour un affichage ordonné
        commandFields.sort((a, b) => a.name.localeCompare(b.name));

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Aide - 3SIB Bot')
            .setDescription(`Voici la liste des **${commandFields.length}** commandes disponibles :`)
            .addFields(commandFields)
            .setFooter({ 
                text: 'Bot Discord 3SIB', 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
