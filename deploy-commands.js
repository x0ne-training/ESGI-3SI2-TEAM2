// deploy-commands.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const COMMANDS_DIR = path.join(__dirname, 'commands');

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

const commandFiles = getCommandFiles(COMMANDS_DIR);

const commands = [];
for (const file of commandFiles) {
  const cmd = require(file);
  if (cmd?.data?.toJSON) {
    console.log(`✅ Commande ajoutée pour le déploiement: ${cmd.data.name}`);
    commands.push(cmd.data.toJSON());
  } else {
    console.warn(`⚠️  Ignoré: ${path.relative(COMMANDS_DIR, file)} (pas de data.toJSON)`);
  }
}

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const { CLIENT_ID, GUILD_ID } = process.env;
if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ Env manquant: TOKEN/DISCORD_TOKEN, CLIENT_ID, ou GUILD_ID');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log(`🚀 Début du déploiement de ${commands.length} commande(s) slash.`);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log(`✅ ${commands.length} commande(s) déployée(s) sur la guilde ${GUILD_ID}.`);
  } catch (err) {
    console.error('❌ Erreur lors du déploiement des commandes:', err);
  }
})();
