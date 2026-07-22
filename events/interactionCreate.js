const { Events, MessageFlags } = require('discord.js');
const { handleEventInteraction } = require('../utils/eventInteractions');
const adminPanelHandler = require('../interactions/adminPanelHandler');
const { debug } = require('../utils/logger');

async function replyError(interaction) {
    try {
        const errorMessage = {
            content: '❌ Une erreur s\'est produite lors de l\'exécution de cette commande !',
            flags: MessageFlags.Ephemeral
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

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {

        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;
            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(`❌ Erreur autocomplete /${interaction.commandName}:`, error.message);
            }
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
                debug(`📝 ${interaction.user.tag} a utilisé /${interaction.commandName}`);
                await command.execute(interaction);
            } catch (error) {
                console.error(`❌ Erreur lors de l'exécution de /${interaction.commandName}:`, error);
                await replyError(interaction);
            }
            return;
        }

        const customId = interaction.customId || '';
        const isAdminInteraction = customId.startsWith('admin:');

        // Gestion des boutons
        if (interaction.isButton()) {
            try {
                if (isAdminInteraction) {
                    await adminPanelHandler.route(interaction);
                } else if (customId.startsWith('event_')) {
                    await handleEventInteraction(interaction);
                }
                // Les autres customId (poll_*, events_prev/next, confirm/cancel_delete_*, ...)
                // sont gérés par leurs propres message component collectors.
            } catch (error) {
                console.error(`❌ Erreur bouton (${customId}):`, error);
                await replyError(interaction);
            }
            return;
        }

        // Gestion des menus déroulants
        if (interaction.isStringSelectMenu()) {
            try {
                if (isAdminInteraction) {
                    await adminPanelHandler.route(interaction);
                }
                // event_details_select est géré par son propre collector.
            } catch (error) {
                console.error(`❌ Erreur menu (${customId}):`, error);
                await replyError(interaction);
            }
            return;
        }

        // Gestion des soumissions de modals (panel d'administration)
        if (interaction.isModalSubmit()) {
            try {
                if (isAdminInteraction) {
                    await adminPanelHandler.route(interaction);
                }
            } catch (error) {
                console.error(`❌ Erreur modal (${customId}):`, error);
                await replyError(interaction);
            }
        }
    },
};
