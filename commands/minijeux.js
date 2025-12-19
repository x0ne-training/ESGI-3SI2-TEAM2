// commands/minijeux.js
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const mini = require('../features/minijeux');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minijeux')
    .setDescription('Mini-jeux : RPS, devinette, pendu')
    .addSubcommand(s =>
      s.setName('rps').setDescription('Pierre-Feuille-Ciseaux'),
    )
    .addSubcommand(s =>
      s
        .setName('nombre')
        .setDescription('Devinette de nombre')
        .addStringOption(o =>
          o
            .setName('action')
            .setDescription('start ou guess')
            .setRequired(true)
            .addChoices(
              { name: 'start', value: 'start' },
              { name: 'guess', value: 'guess' },
            ),
        )
        .addIntegerOption(o =>
          o
            .setName('valeur')
            .setDescription('Ta proposition (pour guess)'),
        )
        .addIntegerOption(o =>
          o.setName('max').setDescription('Max (pour start)'),
        ),
    )
    .addSubcommand(s =>
      s
        .setName('pendu')
        .setDescription('Pendu')
        .addStringOption(o =>
          o
            .setName('action')
            .setDescription('start ou guess')
            .setRequired(true)
            .addChoices(
              { name: 'start', value: 'start' },
              { name: 'guess', value: 'guess' },
            ),
        )
        .addStringOption(o =>
          o.setName('lettre').setDescription('Lettre (pour guess)'),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // --- RPS ---
    if (sub === 'rps') {
      const uid = interaction.user.id;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`rps:rock:${uid}`)
          .setLabel('Pierre')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`rps:paper:${uid}`)
          .setLabel('Feuille')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`rps:scissors:${uid}`)
          .setLabel('Ciseaux')
          .setStyle(ButtonStyle.Primary),
      );
      return interaction.reply({
        content: 'Choisis ton coup :',
        components: [row],
      });
    }

    // --- NOMBRE ---
    if (sub === 'nombre') {
      const action = interaction.options.getString('action', true);

      if (action === 'start') {
        const max = interaction.options.getInteger('max') ?? 100;
        mini.startNombre(interaction.user.id, max);
        return interaction.reply({
          content: `J'ai choisi un nombre entre 1 et ${max}. Utilise **/minijeux nombre action:guess valeur:<n>**.`,
          ephemeral: true,
        });
      }

      if (action === 'guess') {
        const n = interaction.options.getInteger('valeur', true);
        const r = mini.guessNombre(interaction.user.id, n);
        if (r.status === 'no-game')
          return interaction.reply({
            content:
              'Pas de partie en cours. Lance **/minijeux nombre action:start**.',
            ephemeral: true,
          });
        if (r.status === 'win')
          return interaction.reply({
            content: `🎉 Gagné en ${r.tries} essai(s).`,
          });
        return interaction.reply({
          content: r.status === 'low' ? '🔼 Plus grand.' : '🔽 Plus petit.',
        });
      }
    }

    // --- PENDU ---
    if (sub === 'pendu') {
      const action = interaction.options.getString('action', true);

      if (action === 'start') {
        const { revealed, lives } = mini.startPendu(interaction.user.id);
        return interaction.reply({
          content: `Mot: \`${revealed}\` | Vies: ${lives}\nDevine avec **/minijeux pendu action:guess lettre:<a-z>**.`,
        });
      }

      if (action === 'guess') {
        const letterRaw = interaction.options.getString('lettre', true);
        const letter = (letterRaw || '').trim().toLowerCase();
        const r = mini.guessPendu(interaction.user.id, letter);

        if (r.status === 'no-game')
          return interaction.reply({
            content:
              'Pas de pendu en cours. Lance **/minijeux pendu action:start**.',
            ephemeral: true,
          });
        if (r.status === 'bad-letter')
          return interaction.reply({
            content: 'Lettre invalide. Utilise une seule lettre [a-z].',
            ephemeral: true,
          });
        if (r.status === 'already')
          return interaction.reply({
            content: 'Lettre déjà utilisée.',
            ephemeral: true,
          });
        if (r.status === 'win')
          return interaction.reply({ content: `🎉 Gagné ! Mot: \`${r.word}\`` });
        if (r.status === 'lose')
          return interaction.reply({
            content: `💀 Perdu. Mot: \`${r.word}\``,
          });

        return interaction.reply({
          content: `Mot: \`${r.revealed}\` | Vies: ${r.lives} | Utilisées: ${[
            ...r.used,
          ].join(', ')}`,
        });
      }
    }
  },
};
