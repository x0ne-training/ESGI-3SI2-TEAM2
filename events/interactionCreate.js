const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Gestion des commandes slash
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`❌ Commande inconnue : ${interaction.commandName}`);
                return;
            }

            try {
                console.log(`📝 ${interaction.user.tag} a utilisé /${interaction.commandName}`);
                await command.execute(interaction);
            } catch (error) {
                console.error(`❌ Erreur lors de l'exécution de /${interaction.commandName}:`, error);
                
                // Vérifier si l'interaction est encore valide avant de répondre
                try {
                    const errorMessage = {
                        content: '❌ Une erreur s\'est produite lors de l\'exécution de cette commande !',
                        flags: [4096] // MessageFlags.Ephemeral
                    };

                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(errorMessage);
                    } else {
                        await interaction.reply(errorMessage);
                    }
                } catch (responseError) {
                    console.error('❌ Impossible de répondre à l\'interaction:', responseError.message);
                    // Si l'interaction a expiré ou a déjà été gérée, on ne peut plus rien faire
                }
            }
        }
        
        // Gestion des boutons
        else if (interaction.isButton()) {
            console.log(`🔘 ${interaction.user.tag} a cliqué sur le bouton: ${interaction.customId}`);
            
            // Gestion du bouton de débannissement
            if (interaction.customId.startsWith('unban_')) {
                const userId = interaction.customId.replace('unban_', '');
                
                try {
                    // Vérifier les permissions
                    if (!interaction.member.permissions.has('BanMembers')) {
                        return interaction.reply({
                            content: '❌ Vous n\'avez pas la permission de débannir des membres.',
                            ephemeral: true
                        });
                    }

                    // Récupérer les informations de l'utilisateur banni
                    const bans = await interaction.guild.bans.fetch();
                    const bannedUser = bans.find(ban => ban.user.id === userId);

                    if (!bannedUser) {
                        return interaction.reply({
                            content: '❌ Cet utilisateur n\'est plus banni.',
                            ephemeral: true
                        });
                    }

                    // Débannir l'utilisateur
                    await interaction.guild.members.unban(userId, `Débanni par ${interaction.user.tag}`);

                    await interaction.reply({
                        content: `✅ **${bannedUser.user.tag}** a été débanni du serveur avec succès !`,
                        ephemeral: false
                    });

                    // Désactiver le bouton après utilisation
                    await interaction.message.edit({
                        components: []
                    });
                } catch (error) {
                    console.error('Erreur lors du débannissement:', error);
                    await interaction.reply({
                        content: '❌ Une erreur est survenue lors du débannissement.',
                        ephemeral: true
                    });
                }
            }
        }
        
        // Gestion des menus déroulants (pour de futures fonctionnalités)
        else if (interaction.isStringSelectMenu()) {
            console.log(`📋 ${interaction.user.tag} a sélectionné: ${interaction.values}`);
            // Ajouter ici la logique pour les menus
        }
    },
};
