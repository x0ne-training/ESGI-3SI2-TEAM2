const { Events } = require('discord.js');
const { handleEventInteraction } = require('./eventInteractions');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {

        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;
            await command.autocomplete(interaction);
            return;
        }

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
        
        // Gestion des boutons (pour de futures fonctionnalités)
        else if (interaction.isButton()) {
            console.log(`🔘 ${interaction.user.tag} a cliqué sur le bouton: ${interaction.customId}`);
            
            // Gérer les interactions d'événements
            await handleEventInteraction(interaction);
        }
        
        // Gestion des menus déroulants (pour de futures fonctionnalités)
        else if (interaction.isStringSelectMenu()) {
            console.log(`📋 ${interaction.user.tag} a sélectionné: ${interaction.values}`);
            // Ajouter ici la logique pour les menus
        }
    },
};
