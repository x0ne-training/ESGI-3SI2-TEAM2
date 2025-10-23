const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ban')
		.setDescription('Bannit un membre du serveur')
		.addUserOption(option =>
			option
				.setName('membre')
				.setDescription('Le membre à bannir')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('raison')
				.setDescription('La raison du bannissement')
				.setRequired(false))
		.addIntegerOption(option =>
			option
				.setName('duree_suppression')
				.setDescription('Nombre de jours de messages à supprimer (0-7)')
				.setMinValue(0)
				.setMaxValue(7)
				.setRequired(false))
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setDMPermission(false),
	async execute(interaction) {
		const membre = interaction.options.getMember('membre');
		const utilisateur = interaction.options.getUser('membre');
		const raison = interaction.options.getString('raison') || 'Aucune raison fournie';
		const dureeSuppression = interaction.options.getInteger('duree_suppression') || 0;

		// Vérifications de sécurité
		if (membre) {
			if (membre.id === interaction.user.id) {
				return interaction.reply({
					content: '❌ Vous ne pouvez pas vous bannir vous-même !',
					ephemeral: true
				});
			}

			if (membre.id === interaction.client.user.id) {
				return interaction.reply({
					content: '❌ Je ne peux pas me bannir moi-même !',
					ephemeral: true
				});
			}

			if (!membre.bannable) {
				return interaction.reply({
					content: '❌ Je ne peux pas bannir ce membre. Il a peut-être un rôle supérieur au mien.',
					ephemeral: true
				});
			}

			if (interaction.member.roles.highest.position <= membre.roles.highest.position) {
				return interaction.reply({
					content: '❌ Vous ne pouvez pas bannir ce membre car il a un rôle égal ou supérieur au vôtre.',
					ephemeral: true
				});
			}
		}

		try {
			// Tenter d'envoyer un message privé au membre avant de le bannir
			if (membre) {
				await membre.send(`Vous avez été banni de **${interaction.guild.name}** pour la raison suivante : ${raison}`).catch(() => {
					// Ignorer si l'envoi échoue (DM fermés)
				});
			}

			// Bannir le membre
			await interaction.guild.members.ban(utilisateur, {
				reason: raison,
				deleteMessageSeconds: dureeSuppression * 24 * 60 * 60
			});

			await interaction.reply({
				content: `✅ **${utilisateur.tag}** a été banni du serveur.\n**Raison :** ${raison}\n**Messages supprimés :** ${dureeSuppression} jour(s)`,
				ephemeral: false
			});
		} catch (error) {
			console.error('Erreur lors du bannissement :', error);
			await interaction.reply({
				content: '❌ Une erreur est survenue lors du bannissement du membre.',
				ephemeral: true
			});
		}
	},
};
