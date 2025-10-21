// commands/minijeux.js (CommonJS)
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// petit dico pour le pendu
const WORDS = [
  'ordinateur', 'javascript', 'serveur', 'module', 'fonction',
  'variable', 'promesse', 'asynchrone', 'package', 'database'
];

function maskWord(word, revealed) {
  return word.split('').map((ch, i) => (revealed[i] ? ch : '·')).join('');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minijeux')
    .setDescription('Mini-jeux fun')
    .addSubcommand(sc => sc.setName('rps').setDescription('Pierre-Feuille-Ciseaux'))
    .addSubcommand(sc =>
      sc.setName('nombre').setDescription('Devinette de nombre')
        .addStringOption(o => o.setName('action').setDescription('start ou guess').setRequired(true)
          .addChoices({ name: 'start', value: 'start' }, { name: 'guess', value: 'guess' }))
        .addIntegerOption(o => o.setName('valeur').setDescription('Proposition si action=guess'))
        .addIntegerOption(o => o.setName('max').setDescription('Borne max si action=start (défaut 100)'))
    )
    .addSubcommand(sc =>
      sc.setName('pendu').setDescription('Jeu du pendu')
        .addStringOption(o => o.setName('action').setDescription('start ou guess').setRequired(true)
          .addChoices({ name: 'start', value: 'start' }, { name: 'guess', value: 'guess' }))
        .addStringOption(o => o.setName('lettre').setDescription('Lettre si action=guess (a-z)'))
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    // init stockage en mémoire si absent
    client.games ??= { nombre: new Map(), pendu: new Map() };

    const sub = interaction.options.getSubcommand();

    // 1) RPS (boutons)
    if (sub === 'rps') {
      const uid = interaction.user.id;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rps:rock:${uid}`).setLabel('Pierre').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rps:paper:${uid}`).setLabel('Feuille').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rps:scissors:${uid}`).setLabel('Ciseaux').setStyle(ButtonStyle.Primary),
      );
      return interaction.reply({ content: 'Choisis ton coup :', components: [row] });
    }

    // 2) Devinette de nombre
    if (sub === 'nombre') {
      const action = interaction.options.getString('action', true);
      const uid = interaction.user.id;

      if (action === 'start') {
        const max = interaction.options.getInteger('max') ?? 100;
        const target = Math.floor(Math.random() * max) + 1;
        client.games.nombre.set(uid, { target, max, tries: 0, startAt: Date.now() });
        return interaction.reply({ content: `J'ai choisi un nombre entre 1 et ${max}. Utilise /minijeux nombre action:guess valeur:<n>`, ephemeral: true });
      }

      if (action === 'guess') {
        const val = interaction.options.getInteger('valeur');
        const game = client.games.nombre.get(uid);
        if (!game) return interaction.reply({ content: 'Pas de partie en cours. Lance /minijeux nombre action:start', ephemeral: true });
        if (val == null) return interaction.reply({ content: 'Donne une valeur entière.', ephemeral: true });

        game.tries++;
        if (val === game.target) {
          client.games.nombre.delete(uid);
          return interaction.reply(`Bravo, trouvé en ${game.tries} essai(s).`);
        }
        return interaction.reply(val < game.target ? 'Plus grand.' : 'Plus petit.');
      }
    }

    // 3) Pendu
    if (sub === 'pendu') {
      const action = interaction.options.getString('action', true);
      const letter = interaction.options.getString('lettre')?.toLowerCase();
      const uid = interaction.user.id;

      if (action === 'start') {
        const word = WORDS[Math.floor(Math.random() * WORDS.length)];
        const revealed = Array(word.length).fill(false);
        const used = new Set();
        const lives = 6;
        client.games.pendu.set(uid, { word, revealed, used, lives });
        return interaction.reply(
          `Pendu lancé. Mot: ${maskWord(word, revealed)} | Vies: ${lives}\n` +
          `Devine avec /minijeux pendu action:guess lettre:<a-z>`
        );
      }

      if (action === 'guess') {
        const game = client.games.pendu.get(uid);
        if (!game) return interaction.reply({ content: 'Pas de pendu en cours. Lance /minijeux pendu action:start', ephemeral: true });
        if (!letter || !/^[a-zàâçéèêëîïôûùüÿñ-]$/i.test(letter)) return interaction.reply({ content: 'Lettre invalide.', ephemeral: true });
        if (game.used.has(letter)) return interaction.reply({ content: 'Lettre déjà utilisée.', ephemeral: true });

        game.used.add(letter);
        let hit = false;
        for (let i = 0; i < game.word.length; i++) {
          if (game.word[i].toLowerCase() === letter) { game.revealed[i] = true; hit = true; }
        }
        if (!hit) game.lives--;

        const current = maskWord(game.word, game.revealed);
        if (game.revealed.every(Boolean)) { client.games.pendu.delete(uid); return interaction.reply(`Gagné. Mot: **${game.word}**`); }
        if (game.lives <= 0) { client.games.pendu.delete(uid); return interaction.reply(`Perdu. Le mot était **${game.word}**`); }

        return interaction.reply(`Mot: ${current} | Vies: ${game.lives} | Lettres: ${[...game.used].join(', ')}`);
      }
    }
  },
};
