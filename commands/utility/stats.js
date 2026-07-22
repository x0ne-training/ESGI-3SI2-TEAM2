const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const statsStore = require("../../services/statsStore");
const { isFeatureEnabled } = require("../../services/guildConfig");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Affiche le top des membres les plus actifs"),
    async execute(interaction) {
        if (interaction.guildId && !isFeatureEnabled(interaction.guildId, "stats")) {
            return interaction.reply({
                content: "📊 La collecte des statistiques est désactivée sur ce serveur.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const sorted = statsStore.getTopUsers(5);

        if (sorted.length === 0) {
            return interaction.reply({
                content: "📭 Aucune statistique disponible pour le moment.",
                flags: MessageFlags.Ephemeral,
            });
        }

        let reply = "🏆 Classement des membres les plus actifs :\n";
        const memberPromises = sorted.map(([id]) =>
            interaction.guild.members.fetch(id).catch(() => null)
        );

        const members = await Promise.all(memberPromises);

        for (let i = 0; i < sorted.length; i++) {
            const [id, count] = sorted[i];
            const member = members[i];
            const username = member ? member.user.username : "Utilisateur inconnu";
            reply += `${i + 1}. **${username}** : ${count} messages\n`;
        }
        await interaction.reply(reply);
  }
};
