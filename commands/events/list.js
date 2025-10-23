const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Chemin vers le fichier de configuration des événements
const EVENTS_CONFIG_PATH = path.join(__dirname, '..', '..', 'events-config.json');

/**
 * ==========================================
 * COMMANDE EVENT-LIST - Liste des événements
 * ==========================================
 * 
 * Fonction : Affiche la liste des événements du serveur
 * 
 * Fonctionnalités :
 * - Liste paginée des événements
 * - Filtrage par statut (à venir, en cours, passés)
 * - Tri par date
 * - Informations détaillées sur chaque événement
 * - Navigation interactive avec boutons
 * 
 * Paramètres :
 * - statut : Filtre par statut (optionnel: tous, à-venir, passés)
 * - limite : Nombre d'événements par page (optionnel, défaut: 5)
 * 
 * Usage : /event-list [statut] [limite]
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('event-list')
        .setDescription('Affiche la liste des événements du serveur')
        .addStringOption(option =>
            option
                .setName('statut')
                .setDescription('Filtrer par statut des événements')
                .addChoices(
                    { name: 'Tous les événements', value: 'all' },
                    { name: 'À venir', value: 'upcoming' },
                    { name: 'Passés', value: 'past' }
                )
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName('limite')
                .setDescription('Nombre d\'événements par page (défaut: 5)')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false)
        ),
    emoji: '📋',

    async execute(interaction) {
        const statusFilter = interaction.options.getString('statut') || 'upcoming';
        const limit = interaction.options.getInteger('limite') || 5;

        await interaction.deferReply();

        try {
            // Charger la configuration des événements
            const eventsConfig = loadEventsConfig();
            const guildEvents = eventsConfig.events[interaction.guildId] || {};

            // Convertir en array et filtrer
            let events = Object.values(guildEvents);
            
            if (events.length === 0) {
                return await interaction.editReply({
                    embeds: [createNoEventsEmbed()]
                });
            }

            // Filtrer par statut
            const now = new Date();
            events = events.filter(event => {
                const eventDate = new Date(event.dateTime);
                
                switch (statusFilter) {
                    case 'upcoming':
                        return eventDate > now;
                    case 'past':
                        return eventDate <= now;
                    default:
                        return true;
                }
            });

            if (events.length === 0) {
                return await interaction.editReply({
                    embeds: [createNoEventsEmbed(statusFilter)]
                });
            }

            // Trier par date (les plus proches en premier pour "upcoming", les plus récents en premier pour "past")
            events.sort((a, b) => {
                const dateA = new Date(a.dateTime);
                const dateB = new Date(b.dateTime);
                
                if (statusFilter === 'past') {
                    return dateB - dateA; // Plus récents en premier
                } else {
                    return dateA - dateB; // Plus proches en premier
                }
            });

            // Pagination
            const totalPages = Math.ceil(events.length / limit);
            let currentPage = 0;

            // Créer l'embed initial
            const embed = createEventsListEmbed(events, currentPage, limit, statusFilter, totalPages);
            
            // Créer les boutons de navigation si nécessaire
            const components = [];
            if (totalPages > 1) {
                components.push(createNavigationButtons(currentPage, totalPages));
            }

            // Ajouter le menu de sélection pour voir les détails
            if (events.length > 0) {
                const currentPageEvents = events.slice(currentPage * limit, (currentPage + 1) * limit);
                components.push(createEventSelectMenu(currentPageEvents));
            }

            const message = await interaction.editReply({
                embeds: [embed],
                components: components
            });

            // Gérer les interactions avec les boutons et menus
            if (components.length > 0) {
                const collector = message.createMessageComponentCollector({ 
                    time: 300000 // 5 minutes
                });

                collector.on('collect', async (componentInteraction) => {
                    if (componentInteraction.user.id !== interaction.user.id) {
                        return componentInteraction.reply({
                            content: '❌ Seul l\'utilisateur qui a lancé la commande peut naviguer.',
                            ephemeral: true
                        });
                    }

                    if (componentInteraction.isButton()) {
                        // Navigation entre les pages
                        if (componentInteraction.customId === 'events_prev') {
                            currentPage = Math.max(0, currentPage - 1);
                        } else if (componentInteraction.customId === 'events_next') {
                            currentPage = Math.min(totalPages - 1, currentPage + 1);
                        }

                        const newEmbed = createEventsListEmbed(events, currentPage, limit, statusFilter, totalPages);
                        const newComponents = [];
                        
                        if (totalPages > 1) {
                            newComponents.push(createNavigationButtons(currentPage, totalPages));
                        }
                        
                        const currentPageEvents = events.slice(currentPage * limit, (currentPage + 1) * limit);
                        newComponents.push(createEventSelectMenu(currentPageEvents));

                        await componentInteraction.update({
                            embeds: [newEmbed],
                            components: newComponents
                        });
                    } else if (componentInteraction.isStringSelectMenu()) {
                        // Afficher les détails d'un événement
                        const eventId = componentInteraction.values[0];
                        const event = events.find(e => e.id === eventId);
                        
                        if (event) {
                            const detailEmbed = createEventDetailEmbed(event, interaction.client);
                            await componentInteraction.reply({
                                embeds: [detailEmbed],
                                ephemeral: true
                            });
                        }
                    }
                });

                collector.on('end', async () => {
                    try {
                        // Désactiver tous les composants
                        const disabledComponents = components.map(row => {
                            const newRow = ActionRowBuilder.from(row);
                            newRow.components.forEach(component => {
                                component.setDisabled(true);
                            });
                            return newRow;
                        });

                        await interaction.editReply({
                            components: disabledComponents
                        });
                    } catch (error) {
                        // Ignorer les erreurs si le message a été supprimé
                    }
                });
            }

        } catch (error) {
            console.error('Erreur lors de l\'affichage de la liste des événements:', error);
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors de l\'affichage des événements.'
            });
        }
    }
};

// Fonctions utilitaires

function loadEventsConfig() {
    try {
        if (fs.existsSync(EVENTS_CONFIG_PATH)) {
            const data = fs.readFileSync(EVENTS_CONFIG_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la config événements:', error);
    }
    
    return {
        events: {},
        reminders: {},
        settings: {
            defaultReminderTimes: [],
            maxEventsPerGuild: 50,
            maxParticipantsPerEvent: 100
        }
    };
}

function createNoEventsEmbed(statusFilter = null) {
    const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('📋 Liste des événements')
        .setDescription('Aucun événement trouvé.')
        .setTimestamp();

    if (statusFilter === 'upcoming') {
        embed.setDescription('Aucun événement à venir trouvé.');
    } else if (statusFilter === 'past') {
        embed.setDescription('Aucun événement passé trouvé.');
    }

    return embed;
}

function createEventsListEmbed(events, page, limit, statusFilter, totalPages) {
    const startIndex = page * limit;
    const endIndex = Math.min(startIndex + limit, events.length);
    const pageEvents = events.slice(startIndex, endIndex);

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 Liste des événements')
        .setTimestamp();

    let description = '';
    switch (statusFilter) {
        case 'upcoming':
            description = '📅 **Événements à venir**\n\n';
            break;
        case 'past':
            description = '📜 **Événements passés**\n\n';
            break;
        default:
            description = '📋 **Tous les événements**\n\n';
    }

    pageEvents.forEach((event, index) => {
        const eventDate = new Date(event.dateTime);
        const timestamp = Math.floor(eventDate.getTime() / 1000);
        const participantCount = event.participants.attending.length;
        const isUpcoming = eventDate > new Date();
        
        const statusIcon = isUpcoming ? '🟢' : '🔴';
        
        description += `${statusIcon} **${event.title}**\n`;
        description += `📅 <t:${timestamp}:F> (<t:${timestamp}:R>)\n`;
        description += `👥 ${participantCount}/${event.maxParticipants} participants\n`;
        description += `📝 ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}\n\n`;
    });

    embed.setDescription(description);

    if (totalPages > 1) {
        embed.setFooter({
            text: `Page ${page + 1}/${totalPages} • ${events.length} événement(s) total`
        });
    } else {
        embed.setFooter({
            text: `${events.length} événement(s) trouvé(s)`
        });
    }

    return embed;
}

function createNavigationButtons(currentPage, totalPages) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('events_prev')
                .setLabel('◀️ Précédent')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId('events_next')
                .setLabel('Suivant ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages - 1)
        );
}

function createEventSelectMenu(events) {
    const options = events.map(event => {
        const eventDate = new Date(event.dateTime);
        const isUpcoming = eventDate > new Date();
        
        return {
            label: event.title.substring(0, 100),
            description: `${isUpcoming ? '🟢' : '🔴'} ${eventDate.toLocaleDateString('fr-FR')} - ${event.participants.attending.length} participants`,
            value: event.id
        };
    });

    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('event_details_select')
                .setPlaceholder('Sélectionner un événement pour voir les détails...')
                .addOptions(options)
        );
}

function createEventDetailEmbed(event, client) {
    const eventDate = new Date(event.dateTime);
    const timestamp = Math.floor(eventDate.getTime() / 1000);
    const isUpcoming = eventDate > new Date();
    
    const embed = new EmbedBuilder()
        .setColor(isUpcoming ? 0x00ff00 : 0xff0000)
        .setTitle(`📅 ${event.title}`)
        .setDescription(event.description)
        .addFields(
            { 
                name: '📅 Date et heure', 
                value: `<t:${timestamp}:F>\n<t:${timestamp}:R>`, 
                inline: false 
            },
            { 
                name: '👥 Participants confirmés', 
                value: `${event.participants.attending.length}/${event.maxParticipants}`, 
                inline: true 
            },
            { 
                name: '❓ Peut-être', 
                value: `${event.participants.maybe.length}`, 
                inline: true 
            },
            { 
                name: '❌ Absents', 
                value: `${event.participants.notAttending.length}`, 
                inline: true 
            }
        )
        .setFooter({ 
            text: `ID: ${event.id} • Créé par ${client.users.cache.get(event.creatorId)?.tag || 'Utilisateur inconnu'}`,
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();

    // Afficher les participants si il y en a
    if (event.participants.attending.length > 0) {
        const attendingList = event.participants.attending
            .slice(0, 10) // Limiter à 10 pour éviter les embeds trop longs
            .map(userId => `<@${userId}>`)
            .join(', ');
        
        let attendingText = attendingList;
        if (event.participants.attending.length > 10) {
            attendingText += ` et ${event.participants.attending.length - 10} autre(s)...`;
        }
        
        embed.addFields({
            name: '✅ Liste des participants',
            value: attendingText,
            inline: false
        });
    }

    if (event.recurrence !== 'none') {
        embed.addFields({
            name: '🔄 Récurrence',
            value: getRecurrenceLabel(event.recurrence),
            inline: true
        });
    }

    return embed;
}

function getRecurrenceLabel(recurrence) {
    switch (recurrence) {
        case 'weekly': return '🔄 Hebdomadaire';
        case 'monthly': return '🔄 Mensuelle';
        default: return '➡️ Unique';
    }
}
