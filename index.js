const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // Active seulement si nécessaire ET activé dans le Developer Portal :
    // GatewayIntentBits.MessageContent,
    // GatewayIntentBits.GuildMembers,
  ],
});

// Map des commandes
client.commands = new Collection();

function listJsRec(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...listJsRec(full));
    else if (e.isFile() && e.name.endsWith('.js')) files.push(full);
  }
  return files;
}

// Charger commandes
for (const f of listJsRec(path.join(__dirname, 'commands'))) {
  const c = require(f);
  if (c?.data?.name && typeof c.execute === 'function') {
    client.commands.set(c.data.name, c);
    console.log(`✅ Commande chargée: ${c.data.name}`);
  }
}

// Charger événements
const eventsDir = path.join(__dirname, 'events');
if (fs.existsSync(eventsDir)) {
  for (const file of fs.readdirSync(eventsDir).filter(n => n.endsWith('.js'))) {
    const ev = require(path.join(eventsDir, file));
    if (ev?.name && typeof ev.execute === 'function') {
      ev.once ? client.once(ev.name, (...a) => ev.execute(...a))
              : client.on(ev.name, (...a) => ev.execute(...a));
      console.log(`✅ Événement chargé: ${ev.name}`);
    }
  }
}

// Ready
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot connecté en tant que ${c.user.tag}`);
});

// Login
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('❌ TOKEN/DISCORD_TOKEN manquant dans .env');
  process.exit(1);
}
client.login(TOKEN);
