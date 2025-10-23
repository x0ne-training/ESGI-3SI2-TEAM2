const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('poll')
		.setDescription('Crée un sondage Oui/Non avec boutons')
		.addStringOption(option =>
			option
				.setName('question')
				.setDescription('La question du sondage')
				.setRequired(true)
		)
		.addIntegerOption(option =>
			option
				.setName('duree')
				.setDescription('Durée en secondes (par défaut 60)')
				.setMinValue(10)
				.setMaxValue(3600)
				.setRequired(false)
		),
	emoji: '📊',
	async execute(interaction) {
		const question = interaction.options.getString('question', true);
		const durationSeconds = interaction.options.getInteger('duree') || 60;

		const yesButton = new ButtonBuilder().setCustomId('poll_yes').setLabel('Oui').setStyle(ButtonStyle.Success);
		const noButton = new ButtonBuilder().setCustomId('poll_no').setLabel('Non').setStyle(ButtonStyle.Danger);
		const row = new ActionRowBuilder().addComponents(yesButton, noButton);

		const pollEmbed = new EmbedBuilder()
			.setColor(0x5865F2)
			.setTitle('📊 Sondage')
			.setDescription(question)
			.addFields(
				{ name: 'Oui', value: '0', inline: true },
				{ name: 'Non', value: '0', inline: true },
			)
			.setFooter({ text: `Fin dans ${durationSeconds}s` })
			.setTimestamp();

		const message = await interaction.reply({ embeds: [pollEmbed], components: [row], fetchReply: true });

		const voterIds = new Set();
		let yesCount = 0;
		let noCount = 0;

		const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: durationSeconds * 1000 });

		collector.on('collect', async (btnInteraction) => {
			if (btnInteraction.user.bot) return;
			if (voterIds.has(btnInteraction.user.id)) {
				return btnInteraction.reply({ content: 'Vous avez déjà voté.', flags: MessageFlags.Ephemeral });
			}
			voterIds.add(btnInteraction.user.id);
			if (btnInteraction.customId === 'poll_yes') {
				yesCount += 1;
			} else if (btnInteraction.customId === 'poll_no') {
				noCount += 1;
			}

			pollEmbed.spliceFields(0, 2, { name: 'Oui', value: String(yesCount), inline: true }, { name: 'Non', value: String(noCount), inline: true });
			await btnInteraction.update({ embeds: [pollEmbed] });
		});

		collector.on('end', async () => {
			const disabledRow = new ActionRowBuilder().addComponents(
				ButtonBuilder.from(yesButton).setDisabled(true),
				ButtonBuilder.from(noButton).setDisabled(true)
			);
			pollEmbed.setFooter({ text: `Terminé • ${yesCount} Oui / ${noCount} Non • ${voterIds.size} vote(s)` });
			await interaction.editReply({ embeds: [pollEmbed], components: [disabledRow] });
		});
	}
};


