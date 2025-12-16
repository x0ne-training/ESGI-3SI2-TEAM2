const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path"); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Affiche le top des membres les plus actifs"),
    async execute(interaction) {
        // On remonte de deux dossiers (de 'commands/utility' vers la racine)
        const statsPath = path.resolve(__dirname, "../../stats.json");
        
        const stats = fs.existsSync(statsPath) ? JSON.parse(fs.readFileSync(statsPath)) : {};
    const sorted = Object.entries(stats).sort((a,b) => b[1]-a[1]).slice(0,5);

    let reply = "🏆 Classement des membres les plus actifs :\n";
    // On prépare toutes les demandes de récupération (fetch) en même temps
    const memberPromises = sorted.map(([id]) => 
        interaction.guild.members.fetch(id).catch(() => null)
    );

    // On attend que TOUT soit fini d'un coup
    const members = await Promise.all(memberPromises);

    // Maintenant on fait la boucle d'affichage
    for (let i = 0; i < sorted.length; i++) {
        const [id, count] = sorted[i];
        const member = members[i];
        // Si le membre est trouvé (pas null), on prend son pseudo, sinon "Inconnu"
        const username = member ? member.user.username : "Utilisateur inconnu";
        // On ajoute la ligne au message de réponse
        reply += `${i + 1}. **${username}** : ${count} messages\n`;
    }
    await interaction.reply(reply);
  }
};