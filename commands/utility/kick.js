const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('kick')
		.setDescription('Expulse un membre du serveur')
		.addUserOption(option =>
			option
				.setName('membre')
				.setDescription('Le membre à expulser')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('raison')
				.setDescription('La raison de l\'expulsion')
				.setRequired(false))
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDMPermission(false),
	async execute(interaction) {
		const membre = interaction.options.getMember('membre');
		const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

		// Vérifications de sécurité
		if (!membre) {
			return interaction.reply({
				content: '❌ Le membre spécifié n\'est pas sur ce serveur.',
				ephemeral: true
			});
		}

		if (membre.id === interaction.user.id) {
			return interaction.reply({
				content: '❌ Vous ne pouvez pas vous expulser vous-même !',
				ephemeral: true
			});
		}

		if (membre.id === interaction.client.user.id) {
			return interaction.reply({
				content: '❌ Je ne peux pas m\'expulser moi-même !',
				ephemeral: true
			});
		}

		if (!membre.kickable) {
			return interaction.reply({
				content: '❌ Je ne peux pas expulser ce membre. Il a peut-être un rôle supérieur au mien.',
				ephemeral: true
			});
		}

		if (interaction.member.roles.highest.position <= membre.roles.highest.position) {
			return interaction.reply({
				content: '❌ Vous ne pouvez pas expulser ce membre car il a un rôle égal ou supérieur au vôtre.',
				ephemeral: true
			});
		}

		try {
			// Tenter d'envoyer un message privé au membre avant de l'expulser
			await membre.send(`Vous avez été expulsé de **${interaction.guild.name}** pour la raison suivante : ${raison}`).catch(() => {
				// Ignorer si l'envoi échoue (DM fermés)
			});

			// Expulser le membre
			await membre.kick(raison);

			await interaction.reply({
				content: `✅ **${membre.user.tag}** a été expulsé du serveur.\n**Raison :** ${raison}`,
				ephemeral: false
			});
		} catch (error) {
			console.error('Erreur lors de l\'expulsion :', error);
			await interaction.reply({
				content: '❌ Une erreur est survenue lors de l\'expulsion du membre.',
				ephemeral: true
			});
		}
	},
};
