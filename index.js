// index.js
require('dotenv').config()

const { Client, Events, GatewayIntentBits, Collection } = require('discord.js')
const fs = require('fs')
const path = require('path')

const { scheduleReminders } = require('./commands/utility/ajouter-devoir.js')
const ReminderSystem = require('./services/reminderSystem.js')
const RecurringEventsManager = require('./services/recurringEvents.js')

// 1) Création du client avec les intents nécessaires
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
})

// stocker les commandes
client.commands = new Collection()

// 2) Charger automatiquement tous les events du dossier ./events
const eventsPath = path.join(__dirname, 'events')
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))

  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file))
    if (!event?.name || typeof event.execute !== 'function') {
      console.log(
        `⚠️ Event invalide: ${file} (doit exporter { name, execute, once? })`
      )
      continue
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args))
    } else {
      client.on(event.name, (...args) => event.execute(...args))
    }

    console.log(`✅ Événement chargé: ${event.name}`)
  }
}

// 3) Charger les commandes (slash) depuis ./commands/**
const foldersPath = path.join(__dirname, 'commands')
if (fs.existsSync(foldersPath)) {
  const commandFolders = fs.readdirSync(foldersPath)

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder)

    // sécurité si jamais il y a des fichiers au lieu d’un dossier
    if (!fs.lstatSync(commandsPath).isDirectory()) continue

    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter(file => file.endsWith('.js'))

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file)
      const command = require(filePath)

      if (command?.data?.name && typeof command.execute === 'function') {
        client.commands.set(command.data.name, command)
        console.log(`✅ Commande chargée: ${command.data.name}`)
      } else {
        console.log(
          `⚠️ La commande ${filePath} manque "data.name" ou "execute".`
        )
      }
    }
  }
}

// 4) Ready
client.once(Events.ClientReady, readyClient => {
  console.log(`✅ Bot connecté en tant que ${readyClient.user.tag}!`)
  console.log(`🚀 Bot actif sur ${readyClient.guilds.cache.size} serveur(s)`)

  client.user.setActivity('3SIB Server', { type: 3 }) // WATCHING

  // Init des systèmes
  const reminderSystem = new ReminderSystem(client)
  const recurringEventsManager = new RecurringEventsManager(client)

  client.reminderSystem = reminderSystem
  client.recurringEventsManager = recurringEventsManager

  // Reminders depuis la DB/data
  scheduleReminders(client)
})

// 5) Gestion des erreurs
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error)
})

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error)
  process.exit(1)
})

// 6) Connexion (UNE SEULE FOIS)
client.login(process.env.DISCORD_TOKEN)
