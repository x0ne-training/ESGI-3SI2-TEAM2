require("dotenv").config();
const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Charger les stats depuis le fichier
let stats = {};
if (fs.existsSync("stats.json")) {
  stats = JSON.parse(fs.readFileSync("stats.json"));
}

// Quand le bot est prêt
client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// Écouter les messages
client.on("messageCreate", message => {
  if (message.author.bot) return; // Ignorer les bots

  // Incrémenter le compteur de l'auteur
  const userId = message.author.id;
  stats[userId] = (stats[userId] || 0) + 1;

  // Sauvegarder dans le fichier
  fs.writeFileSync("stats.json", JSON.stringify(stats, null, 2));

  // Commande !mystats
  if (message.content === "!mystats") {
    const count = stats[userId] || 0;
    message.reply(`📊 Tu as envoyé **${count}** messages.`);
  }

  // Commande !stats
  if (message.content === "!stats") {
    // Transformer l'objet en tableau [id, count]
    const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);

    // Top 5
    const top = sorted.slice(0, 5);

    // Générer le classement
    let reply = "🏆 Classement des membres les plus actifs :\n";
    for (let i = 0; i < top.length; i++) {
      const [id, count] = top[i];
      const user = message.guild.members.cache.get(id);
      reply += `**${i + 1}. ${user ? user.user.username : "Inconnu"}** → ${count} messages\n`;
    }

    message.channel.send(reply);
  }
});

// Connexion avec le token
client.login(process.env.DISCORD_TOKEN);