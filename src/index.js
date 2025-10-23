// src/index.js
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import registerMinijeux from './commands/minijeux.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

// Garde: s'assure que le token est bien chargé depuis .env
if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN manquant. Vérifie le fichier .env à la racine.');
  process.exit(1);
}

// Instanciation du client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel]
});

// État des jeux stocké en mémoire et accessible depuis minijeux.js
client.games = {
  nombre: new Map(), // userId -> { target, max, tries, startAt }
  pendu: new Map()   // userId -> { word, revealed, used, lives }
};

// Ready (nouveau nom d'événement: ClientReady)
client.once(Events.ClientReady, async (c) => {
  console.log(`Connecté en tant que ${c.user.tag}`);

  // Affiche l'Application ID réel du bot et compare avec CLIENT_ID du .env
  console.log('Application ID (client.application.id) =', c.application.id);
  if (CLIENT_ID && CLIENT_ID !== c.application.id) {
    console.warn(`Attention: CLIENT_ID (.env) = ${CLIENT_ID} ≠ application.id = ${c.application.id}`);
  } else if (!CLIENT_ID) {
    console.warn('CLIENT_ID absent du .env (Application ID non vérifié).');
  }

  // Liste les commandes visibles sur la guilde GUILD_ID (si fourni)
  if (GUILD_ID) {
    try {
      const cmds = await c.application.commands.fetch({ guildId: GUILD_ID });
      const names = [...cmds.values()].map(x => x.name);
      console.log('Commandes guild visibles :', names.length ? names.join(', ') : '(aucune)');
    } catch (e) {
      console.warn('Impossible de lister les commandes guild. Vérifie GUILD_ID et le scope applications.commands.', e?.message || e);
    }
  } else {
    console.warn('GUILD_ID absent du .env : liste des commandes guild non effectuée.');
  }
});

// Gestion des interactions (slash commands + boutons)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  try {
    await registerMinijeux(client, interaction);
  } catch (e) {
    console.error(e);
    // Tente de répondre même en cas d'erreur, sans casser le flux
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'Erreur interne.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Erreur interne.', ephemeral: true });
      }
    } catch {
      // on ignore les erreurs de réponse déjà envoyée
    }
  }
});

// Robustesse: logs globaux
process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});

// Connexion
client.login(DISCORD_TOKEN);
