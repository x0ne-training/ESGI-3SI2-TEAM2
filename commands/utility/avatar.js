const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * ========================================
 * COMMANDE AVATAR - Affichage d'avatars
 * ========================================
 * 
 * Fonction : Affiche l'avatar d'un utilisateur Discord avec des informations détaillées
 * 
 * Fonctionnement :
 * 1. Récupère l'utilisateur cible (ou l'utilisateur qui exécute la commande par défaut)
 * 2. Crée un embed avec l'avatar en haute résolution (512x512)
 * 3. Affiche les informations de l'utilisateur (nom, ID, date de création)
 * 4. Fournit des liens de téléchargement en différentes résolutions
 * 
 * Paramètres :
 * - utilisateur (optionnel) : L'utilisateur dont afficher l'avatar
 * 
 * Fonctionnalités :
 * - Avatar en haute qualité et dynamique (GIF si animé)
 * - Informations utilisateur complètes
 * - Liens de téléchargement multiples tailles (64px à 1024px)
 * - Design moderne avec embed Discord
 * 
 * Usage : /avatar [utilisateur]
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Affiche l\'avatar d\'un utilisateur')
        .addUserOption(option =>
            option
                .setName('utilisateur')
                .setDescription('L\'utilisateur dont vous voulez voir l\'avatar')
                .setRequired(false)
        ),
    // Métadonnées pour la commande help
    emoji: '🖼️',
    async execute(interaction) {
        // Si aucun utilisateur n'est spécifié, utiliser l'utilisateur qui a exécuté la commande
        const user = interaction.options.getUser('utilisateur') || interaction.user;
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🖼️ Avatar de ${user.displayName}`)
            .setDescription(`Voici l'avatar de **${user.tag}**`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: '📱 Nom d\'utilisateur', value: user.tag, inline: true },
                { name: '🆔 ID', value: user.id, inline: true },
                { name: '📅 Compte créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false }
            )
            .setFooter({ 
                text: 'Bot Discord 3SIB', 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Ajouter des boutons pour télécharger l'avatar en différentes tailles
        const avatarLinks = [
            `[64x64](${user.displayAvatarURL({ dynamic: true, size: 64 })})`,
            `[128x128](${user.displayAvatarURL({ dynamic: true, size: 128 })})`,
            `[256x256](${user.displayAvatarURL({ dynamic: true, size: 256 })})`,
            `[512x512](${user.displayAvatarURL({ dynamic: true, size: 512 })})`,
            `[1024x1024](${user.displayAvatarURL({ dynamic: true, size: 1024 })})`
        ];

        embed.addFields({
            name: '📥 Télécharger',
            value: avatarLinks.join(' • '),
            inline: false
        });

        await interaction.reply({ embeds: [embed] });
    },
};
