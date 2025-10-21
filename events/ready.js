const { Events } = require("discord.js");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`✅ ${client.user.tag} est maintenant en ligne !`);
    console.log(`🌐 Connecté à ${client.guilds.cache.size} serveur(s)`);
    console.log(`👥 ${client.users.cache.size} utilisateur(s) visibles`);

    // Définir l'activité du bot
    client.user.setPresence({
      activities: [
        {
          name: "le serveur 3SIB",
          type: 3, // Type 3 = "Watching"
        },
      ],
      status: "online",
    });
  },
};