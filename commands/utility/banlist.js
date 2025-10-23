const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('banlist')
		.setDescription('Affiche la liste des utilisateurs bannis du serveur')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setDMPermission(false),
	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true });

			const bans = await interaction.guild.bans.fetch();

			if (bans.size === 0) {
				return interaction.editReply({
					content: '✅ Aucun utilisateur n\'est actuellement banni sur ce serveur.'
				});
			}

			const embed = new EmbedBuilder()
				.setColor(0xFF0000)
				.setTitle('📋 Liste des utilisateurs bannis')
				.setDescription(`Il y a actuellement **${bans.size}** utilisateur(s) banni(s) sur ce serveur.`)
				.setTimestamp();

			// Créer une liste des utilisateurs bannis
			const banList = Array.from(bans.values());
			let description = '';

			for (let i = 0; i < Math.min(banList.length, 25); i++) {
				const ban = banList[i];
				const reason = ban.reason || 'Aucune raison fournie';
				
				embed.addFields({
					name: `${i + 1}. ${ban.user.tag}`,
					value: `**ID:** \`${ban.user.id}\`\n**Raison:** ${reason}`,
					inline: false
				});
			}

			if (bans.size > 25) {
				embed.setFooter({ 
					text: `Affichage de 25 sur ${bans.size} bannis. Utilisez /unban pour débannir un utilisateur.` 
				});
			} else {
				embed.setFooter({ 
					text: 'Utilisez /unban <user_id> pour débannir un utilisateur.' 
				});
			}

			await interaction.editReply({
				embeds: [embed]
			});
		} catch (error) {
			console.error('Erreur lors de la récupération de la liste des bannis :', error);
			await interaction.editReply({
				content: '❌ Une erreur est survenue lors de la récupération de la liste des bannis.'
			});
		}
	},
};
