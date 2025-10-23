import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Manque DISCORD_TOKEN ou CLIENT_ID ou GUILD_ID dans .env');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('minijeux')
    .setDescription('Mini-jeux fun')
    .addSubcommand(sc => sc.setName('rps').setDescription('Pierre-Feuille-Ciseaux'))
    .addSubcommand(sc =>
      sc.setName('nombre').setDescription('Devinette de nombre')
        .addStringOption(o => o.setName('action').setDescription('start ou guess').setRequired(true)
          .addChoices({ name: 'start', value: 'start' }, { name: 'guess', value: 'guess' }))
        .addIntegerOption(o => o.setName('valeur').setDescription('Ta proposition si action=guess'))
        .addIntegerOption(o => o.setName('max').setDescription('Borne max si action=start (défaut 100)'))
    )
    .addSubcommand(sc =>
      sc.setName('pendu').setDescription('Jeu du pendu')
        .addStringOption(o => o.setName('action').setDescription('start ou guess').setRequired(true)
          .addChoices({ name: 'start', value: 'start' }, { name: 'guess', value: 'guess' }))
        .addStringOption(o => o.setName('lettre').setDescription('Lettre si action=guess (a-z)'))
    )
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('[1/3] Listing AVANT :');
    const before = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
    for (const c of before) console.log('-', c.name, '#'+c.id);

    console.log('[2/3] Déploiement des commandes…');
    const created = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log(`OK. ${created.length} commande(s) déployée(s).`);

    console.log('[3/3] Listing APRES :');
    const after = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
    for (const c of after) console.log('-', c.name, '#'+c.id);
  } catch (e) {
    console.error('Erreur de déploiement:', e);
  }
})();
