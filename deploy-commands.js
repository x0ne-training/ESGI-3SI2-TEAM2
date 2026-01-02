const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];

// Récupérer tous les fichiers de commandes
const foldersPath = path.join(__dirname, 'commands');
if (fs.existsSync(foldersPath)) {
    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`✅ Commande ajoutée pour le déploiement: ${command.data.name}`);
            } else {
                console.log(`⚠️ La commande ${filePath} manque une propriété "data" ou "execute" requise.`);
            }
        }
    }
}

// Construire et préparer une instance de l'API REST
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Déployer les commandes
(async () => {
    try {
        console.log(`🚀 Début du déploiement de ${commands.length} commande(s) slash.`);

        // Déployer les commandes sur le serveur spécifique (plus rapide pour le développement)
        if (process.env.GUILD_ID) {
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`✅ ${data.length} commande(s) slash déployée(s) sur le serveur de développement.`);
        } else {
            // Déployer globalement (prend jusqu'à 1 heure pour être visible)
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log(`✅ ${data.length} commande(s) slash déployée(s) globalement.`);
        }
    } catch (error) {
        console.error('❌ Erreur lors du déploiement des commandes:', error);
    }
})();
