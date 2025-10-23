require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const jokes = [
    "Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tombent dans le bateau !",
    "Qu’est-ce qu’une chauve-souris avec une perruque ? Une souris !",
    "Que dit une mère à son fils geek quand le dîner est prêt ? Alt Tab !",
    "Pourquoi les programmeurs détestent-ils la nature ? Trop de bugs !",
];

const quotes = [
    "Le succès n’est pas la clé du bonheur. – Albert Schweitzer",
    "Je ne perds jamais. Soit je gagne, soit j’apprends. – Nelson Mandela",
    "Fais de ta vie un rêve, et d’un rêve, une réalité. – Antoine de Saint-Exupéry",
    "Ceux qui ne font rien ne se trompent jamais. – Théodore de Banville",
];

client.on('messageCreate', message => {
    if (message.author.bot) return;

    if (message.content === '!joke') {
        message.reply(jokes[Math.floor(Math.random() * jokes.length)]);
    } else if (message.content === '!quote') {
        message.reply(quotes[Math.floor(Math.random() * quotes.length)]);
    }
});

client.once('ready', () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
