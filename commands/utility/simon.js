const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const activeGames = new Map();

const COLORS = [
    { id: 'red', emoji: 'R', style: ButtonStyle.Danger },
    { id: 'green', emoji: 'G', style: ButtonStyle.Success },
    { id: 'blue', emoji: 'B', style: ButtonStyle.Primary },
    { id: 'yellow', emoji: 'Y', style: ButtonStyle.Secondary },
];

function getRandomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function buildButtons(disabled = false) {
    const row = new ActionRowBuilder();
    for (const c of COLORS) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`simon_${c.id}`)
                .setLabel(c.emoji)
                .setStyle(c.style)
                .setDisabled(disabled)
        );
    }
    return [row];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simon')
        .setDescription('Jeu Simon — répète la suite'),

    async execute(interaction) {
        const userId = interaction.user.id;

        if (activeGames.has(userId)) {
            return interaction.reply({ content: 'Tu as déjà une partie en cours. Termine-la avant d\'en lancer une autre.', ephemeral: true });
        }

        activeGames.set(userId, true);

        let sequence = [getRandomColor().id];
        const maxRounds = 10;

        const initial = await interaction.reply({ content: `Simon : préparation`, components: buildButtons(true), fetchReply: true });

        let round = 1;
        let finished = false;

        while (!finished) {
            await initial.edit(`Séquence (niveau ${round})`);
            await sleep(500);

            for (const id of sequence) {
                const color = COLORS.find(c => c.id === id);
                await initial.edit(`${color.emoji}`);
                await sleep(700);
                await initial.edit('');
                await sleep(200);
            }

            await initial.edit({ content: `Clique les boutons pour reproduire la suite.`, components: buildButtons(false) });

            const collector = initial.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 30000,
            });

            let index = 0;
            let lost = false;

            collector.on('collect', async i => {
                if (i.user.id !== userId) {
                    return i.reply({ content: 'Ce n\'est pas ta partie.', ephemeral: true });
                }

                await i.deferUpdate();
                const pressed = i.customId.replace('simon_', '');

                if (pressed === sequence[index]) {
                    index += 1;

                    if (index === sequence.length) {
                        collector.stop('won-round');
                    }
                } else {
                    lost = true;
                    collector.stop('lost');
                }
            });

            const reason = await new Promise(resolve => collector.on('end', (_, r) => resolve(r)));

            if (reason === 'lost' || lost) {
                await initial.edit({ content: `Perdu. Niveau atteint: ${round}.`, components: buildButtons(true) });
                finished = true;
                break;
            }

            if (reason === 'time') {
                await initial.edit({ content: `Temps écoulé. Niveau atteint: ${round}.`, components: buildButtons(true) });
                finished = true;
                break;
            }

            if (round >= maxRounds) {
                await initial.edit({ content: `Terminé ! Tu as fini ${maxRounds} niveaux.`, components: buildButtons(true) });
                finished = true;
                break;
            }

            round += 1;
            sequence.push(getRandomColor().id);

            await initial.edit({ content: `Bien joué. Prépare niveau ${round}...`, components: buildButtons(true) });
            await sleep(1000);
        }

        activeGames.delete(userId);
    },
};
