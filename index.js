// index.js
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// --- Client + intents (active MessageContent/GuildMembers si autorisés dans le portal) ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // nécessite "Message Content Intent" activé
    GatewayIntentBits.GuildMembers    // nécessite "Server Members Intent" si utilisé
  ],
});

// --- Map des commandes ---
client.commands = new Collection();

// --- Helper: liste récursive des fichiers .js dans ./commands ---
function getCommandFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...getCommandFiles(full));
    else if (e.isFile() && e.name.endsWith('.js')) files.push(full);
  }
  return files;
}

// --- Chargement des commandes (fichiers .js à n'importe quel niveau) ---
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = getCommandFiles(commandsDir);

for (const file of commandFiles) {
  const command = require(file);
  if (command?.data?.name && typeof command.execute === 'function') {
    client.commands.set(command.data.name, command);
    console.log(`✅ Commande chargée: ${command.data.name}`);
  } else {
    console.warn(`⚠️  Ignoré: ${path.relative(commandsDir, file)} (export invalide: data/execute manquant)`);
  }
}

// --- Chargement des événements (fichiers .js dans ./events) ---
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event?.name && typeof event.execute === 'function') {
      if (event.once) client.once(event.name, (...args) => event.execute(...args));
      else client.on(event.name, (...args) => event.execute(...args));
      console.log(`✅ Événement chargé: ${event.name}`);
    } else {
      console.warn(`⚠️  Ignoré: events/${file} (export invalide: name/execute)`);
    }
  }
}

// --- Ready ---
client.once(Events.ClientReady, readyClient => {
  console.log(`✅ Bot connecté en tant que ${readyClient.user.tag}!`);
  console.log(`🌐 Connecté à ${readyClient.guilds.cache.size} serveur(s)`);
  client.user.setActivity('3SIB Server', { type: 3 }); // WATCHING
});

// --- Gestion erreurs globales ---
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// --- Connexion ---
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('❌ Aucun token trouvé. Ajoute TOKEN ou DISCORD_TOKEN dans ton .env à la racine.');
  process.exit(1);
}
client.login(TOKEN);
