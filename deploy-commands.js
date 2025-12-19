require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const COMMANDS_DIR = path.join(__dirname, 'commands');

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

const commands = [];
for (const file of listJsRec(COMMANDS_DIR)) {
  const cmd = require(file);
  if (cmd?.data?.toJSON) {
    console.log(`✅ Commande ajoutée pour le déploiement: ${cmd.data.name}`);
    commands.push(cmd.data.toJSON());
  }
}

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const { CLIENT_ID, GUILD_ID } = process.env;
if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ Env manquant: TOKEN/DISCORD_TOKEN, CLIENT_ID, GUILD_ID');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log(`🚀 Déploiement de ${commands.length} commande(s) sur ${GUILD_ID}`);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Déploiement terminé');
  } catch (err) {
    console.error('❌ Erreur déploiement:', err);
  }
})();
