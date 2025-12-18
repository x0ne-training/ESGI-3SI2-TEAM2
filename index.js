// index.js
require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { scheduleReminders } = require("./commands/utility/ajouter-devoir.js");
const fs = require('node:fs');
const path = require('node:path');
const ReminderSystem = require('./events/reminderSystem');
const RecurringEventsManager = require('./events/recurringEvents');
require('dotenv').config();

// 1) Création du client avec les intents nécessaires
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// (optionnel) un espace si vous chargez aussi des commandes slash plus tard
client.commands = new Collection();

// 2) Charger automatiquement tous les events du dossier ./events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  // event doit exporter { name, execute } et éventuellement { once: true }
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Chargement des commandes (slash) depuis ./commands/**
// Initialiser les systèmes d'événements
let reminderSystem;
let recurringEventsManager;

// Charger les commandes
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
                client.commands.set(command.data.name, command);
                console.log(`✅ Commande chargée: ${command.data.name}`);
            } else {
                console.log(`⚠️ La commande ${filePath} manque une propriété "data" ou "execute" requise.`);
            }
        }
    }
}

// 3) Connexion
client.login(process.env.DISCORD_TOKEN);

// Charger les événements
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        console.log(`✅ Événement chargé: ${event.name}`);
    }
}

// Note: Interaction handling is now done in events/interactionCreate.js

// Événement quand le bot est prêt
client.once(Events.ClientReady, readyClient => {
    console.log(`✅ Bot connecté en tant que ${readyClient.user.tag}!`);
    console.log(`🚀 Bot actif sur ${readyClient.guilds.cache.size} serveur(s)`);
    
    // Définir le statut du bot
    client.user.setActivity('3SIB Server', { type: 3 }); // 3 = WATCHING
    
    // Initialiser les systèmes d'événements après la connexion
    reminderSystem = new ReminderSystem(client);
    recurringEventsManager = new RecurringEventsManager(client);
    
    // Rendre les systèmes accessibles globalement
    client.reminderSystem = reminderSystem;
    client.recurringEventsManager = recurringEventsManager;

    scheduleReminders(client);
});

// Gestion des erreurs
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Connexion du bot
client.login(process.env.DISCORD_TOKEN);
