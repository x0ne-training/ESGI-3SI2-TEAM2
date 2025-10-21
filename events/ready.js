const { Events, EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

// Chemin vers le fichier de configuration RSS
const RSS_CONFIG_PATH = path.join(__dirname, '..', 'rss-config.json');
const parser = new Parser();

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`✅ ${client.user.tag} est maintenant en ligne !`);
        console.log(`🌐 Connecté à ${client.guilds.cache.size} serveur(s)`);
        console.log(`👥 ${client.users.cache.size} utilisateur(s) visibles`);
        
        // Définir l'activité du bot
        client.user.setPresence({
            activities: [{ 
                name: 'le serveur 3SIB', 
                type: 3 // Type 3 = "Watching"
            }],
            status: 'online',
        });

        // Démarrer le système de vérification RSS
        startRSSChecker(client);
    },
};

function startRSSChecker(client) {
    console.log('Démarrage du système de vérification RSS...');
    
    // Vérifier les flux RSS toutes les 5 minutes
    setInterval(() => {
        checkRSSFeeds(client);
    }, 5 * 60 * 1000); // 5 minutes

    // Première vérification après 30 secondes
    setTimeout(() => {
        checkRSSFeeds(client);
    }, 30000);
}

async function checkRSSFeeds(client) {
    try {
        if (!fs.existsSync(RSS_CONFIG_PATH)) {
            return;
        }

        const configData = fs.readFileSync(RSS_CONFIG_PATH, 'utf8');
        const rssConfig = JSON.parse(configData);

        for (const [guildId, guildFeeds] of Object.entries(rssConfig)) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;

            for (const [feedId, config] of Object.entries(guildFeeds)) {
                await checkSingleFeed(guild, feedId, config, rssConfig);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la vérification RSS:', error);
    }
}

async function checkSingleFeed(guild, feedId, config, rssConfig) {
    try {
        const channel = guild.channels.cache.get(config.channelId);
        if (!channel) {
            console.log(`Channel ${config.channelId} introuvable pour le flux ${config.customName}`);
            return;
        }

        const feed = await parser.parseURL(config.url);
        if (!feed.items || feed.items.length === 0) {
            return;
        }

        // Récupérer le dernier article publié
        const latestItem = feed.items[0];
        const itemDate = new Date(latestItem.pubDate || latestItem.isoDate);

        // Si c'est la première vérification, sauvegarder la date sans publier
        if (!config.lastCheck) {
            config.lastCheck = itemDate.toISOString();
            rssConfig[guild.id][feedId] = config;
            fs.writeFileSync(RSS_CONFIG_PATH, JSON.stringify(rssConfig, null, 2));
            console.log(`Flux RSS initialisé: ${config.customName} (${feed.items.length} articles)`);
            return;
        }

        const lastCheckDate = new Date(config.lastCheck);
        
        // Vérifier s'il y a de nouveaux articles
        const newItems = feed.items.filter(item => {
            const date = new Date(item.pubDate || item.isoDate);
            return date > lastCheckDate;
        });

        if (newItems.length > 0) {
            console.log(`${newItems.length} nouveau(x) article(s) trouvé(s) pour ${config.customName}`);

            // Publier les nouveaux articles (limiter à 3 pour éviter le spam)
            const itemsToPublish = newItems.slice(0, 3).reverse();

            for (const item of itemsToPublish) {
                const embed = new EmbedBuilder()
                    .setTitle(item.title || 'Article sans titre')
                    .setURL(item.link)
                    .setDescription(item.contentSnippet ? 
                        item.contentSnippet.substring(0, 300) + (item.contentSnippet.length > 300 ? '...' : '') 
                        : 'Aucune description disponible')
                    .setColor('#FF6B35')
                    .setTimestamp(new Date(item.pubDate || item.isoDate))
                    .setFooter({ text: `📡 ${config.customName}` });

                if (item.creator) {
                    embed.setAuthor({ name: item.creator });
                }

                try {
                    await channel.send({ embeds: [embed] });
                } catch (error) {
                    console.error(`Erreur envoi article dans #${channel.name}:`, error);
                }
            }

            // Mettre à jour la date de dernière vérification
            config.lastCheck = new Date(newItems[0].pubDate || newItems[0].isoDate).toISOString();
            rssConfig[guild.id][feedId] = config;
            fs.writeFileSync(RSS_CONFIG_PATH, JSON.stringify(rssConfig, null, 2));
        }

    } catch (error) {
        console.error(`Erreur vérification flux ${config.customName}:`, error);
    }
}
