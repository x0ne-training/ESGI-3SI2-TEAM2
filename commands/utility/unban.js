const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unban')
		.setDescription('Débannit un utilisateur du serveur')
		.addStringOption(option =>
			option
				.setName('user_id')
				.setDescription('L\'ID de l\'utilisateur à débannir (optionnel si vous utilisez les boutons)')
				.setRequired(false))
		.addStringOption(option =>
			option
				.setName('raison')
				.setDescription('La raison du débannissement')
				.setRequired(false))
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setDMPermission(false),
	async execute(interaction) {
		const userId = interaction.options.getString('user_id');
		const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

		// Si un ID est fourni, débannir directement
		if (userId) {
			// Vérifier si l'ID est valide (nombre)
			if (!/^\d+$/.test(userId)) {
				return interaction.reply({
					content: '❌ L\'ID fourni n\'est pas valide. Veuillez fournir un ID d\'utilisateur valide.',
					ephemeral: true
				});
			}

			try {
				// Récupérer la liste des bannissements
				const bans = await interaction.guild.bans.fetch();
				const bannedUser = bans.find(ban => ban.user.id === userId);

				if (!bannedUser) {
					return interaction.reply({
						content: '❌ Cet utilisateur n\'est pas banni sur ce serveur.',
						ephemeral: true
					});
				}

				// Débannir l'utilisateur
				await interaction.guild.members.unban(userId, raison);

				await interaction.reply({
					content: `✅ **${bannedUser.user.tag}** (${userId}) a été débanni du serveur.\n**Raison :** ${raison}`,
					ephemeral: false
				});
			} catch (error) {
				console.error('Erreur lors du débannissement :', error);
				
				if (error.code === 10026) {
					return interaction.reply({
						content: '❌ Utilisateur inconnu. Vérifiez l\'ID fourni.',
						ephemeral: true
					});
				}

				await interaction.reply({
					content: '❌ Une erreur est survenue lors du débannissement de l\'utilisateur.',
					ephemeral: true
				});
			}
		} else {
			// Afficher la liste des bannis avec des boutons
			try {
				const bans = await interaction.guild.bans.fetch();

				if (bans.size === 0) {
					return interaction.reply({
						content: '✅ Aucun utilisateur n\'est actuellement banni sur ce serveur.',
						ephemeral: true
					});
				}

				const embed = new EmbedBuilder()
					.setColor(0x00FF00)
					.setTitle('📋 Liste des utilisateurs bannis')
					.setDescription('Cliquez sur un bouton pour débannir un utilisateur.')
					.setFooter({ text: `Total: ${bans.size} utilisateur(s) banni(s)` });

				// Créer des boutons pour chaque utilisateur banni (maximum 5 par page)
				const bansArray = Array.from(bans.values()).slice(0, 25); // Discord limite à 25 boutons par message
				const rows = [];
				
				for (let i = 0; i < Math.min(bansArray.length, 25); i++) {
					const ban = bansArray[i];
					embed.addFields({
						name: `${i + 1}. ${ban.user.tag}`,
						value: `ID: \`${ban.user.id}\`\nRaison: ${ban.reason || 'Aucune raison'}`,
						inline: true
					});

					// Créer une ligne avec un bouton
					const row = new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId(`unban_${ban.user.id}`)
								.setLabel(`Débannir ${ban.user.username}`)
								.setStyle(ButtonStyle.Success)
						);
					rows.push(row);
				}

				if (bans.size > 25) {
					embed.setDescription(`Cliquez sur un bouton pour débannir un utilisateur.\n⚠️ Seulement les 25 premiers bannis sont affichés.`);
				}

				await interaction.reply({
					embeds: [embed],
					components: rows.slice(0, 5), // Discord limite à 5 ActionRows
					ephemeral: true
				});
			} catch (error) {
				console.error('Erreur lors de la récupération des bannis :', error);
				await interaction.reply({
					content: '❌ Une erreur est survenue lors de la récupération de la liste des bannis.',
					ephemeral: true
				});
			}
		}
	},
};
