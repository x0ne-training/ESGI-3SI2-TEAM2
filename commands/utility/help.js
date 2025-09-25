const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche la liste des commandes disponibles'),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Aide - 3SIB Bot')
            .setDescription('Voici la liste des commandes disponibles :')
            .addFields(
                { name: '/ping', value: 'Affiche la latence du bot', inline: true },
                { name: '/help', value: 'Affiche cette aide', inline: true },
                { name: '/simon', value: 'Jeu Simon — répète la suite', inline: true },
            )
            .setFooter({ 
                text: 'Bot Discord 3SIB', 
                iconURL: interaction.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
