import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';

// Petit dictionnaire pour le pendu
const WORDS = [
  'ordinateur', 'javascript', 'serveur', 'module', 'fonction',
  'variable', 'promesse', 'asynchrone', 'package', 'database'
];

function maskWord(word, revealed) {
  return word.split('').map((ch, i) => (revealed[i] ? ch : '·')).join('');
}

function drawPendu(lives) {
  const stages = [
    '💀', '😵', '😨', '😟', '😕', '🙂', '😄' // 0..6
  ];
  return stages[Math.max(0, Math.min(6, lives))];
}

export default async function registerMinijeux(client, interaction) {
  // Gestion des boutons de RPS
  if (interaction.isButton()) {
    const [tag, choice, userId] = interaction.customId.split(':'); // rps:rock:123
    if (tag !== 'rps') return;

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "Ce bouton n'est pas pour toi.", ephemeral: true });
    }

    const botChoices = ['rock', 'paper', 'scissors'];
    const bot = botChoices[Math.floor(Math.random() * 3)];

    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    let result;
    if (choice === bot) result = 'Égalité';
    else if (beats[choice] === bot) result = 'Tu gagnes';
    else result = 'Tu perds';

    const mapToEmoji = { rock: '🪨', paper: '📄', scissors: '✂️' };
    return interaction.update({
      content: `Ton choix: ${mapToEmoji[choice]} | Bot: ${mapToEmoji[bot]} → ${result}.`,
      components: []
    });
  }

  // Slash command /minijeux
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'minijeux') return;

  const sub = interaction.options.getSubcommand();

  // 1) RPS
  if (sub === 'rps') {
    const uid = interaction.user.id;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rps:rock:${uid}`).setLabel('Pierre').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rps:paper:${uid}`).setLabel('Feuille').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rps:scissors:${uid}`).setLabel('Ciseaux').setStyle(ButtonStyle.Primary)
    );
    return interaction.reply({ content: 'Choisis ton coup :', components: [row] });
  }

  // 2) Nombre
  if (sub === 'nombre') {
    const action = interaction.options.getString('action', true);
    const uid = interaction.user.id;

    if (action === 'start') {
      const max = interaction.options.getInteger('max') ?? 100;
      const target = Math.floor(Math.random() * max) + 1;
      client.games.nombre.set(uid, { target, max, tries: 0, startAt: Date.now() });
      return interaction.reply({
        content: `J'ai choisi un nombre entre 1 et ${max}. Utilise /minijeux nombre action:guess valeur:<n>`,
        ephemeral: true
      });
    }

    if (action === 'guess') {
      const val = interaction.options.getInteger('valeur');
      if (!val) {
        return interaction.reply({ content: 'Donne une valeur entière.', ephemeral: true });
      }
      const game = client.games.nombre.get(uid);
      if (!game) {
        return interaction.reply({ content: 'Pas de partie en cours. Lance /minijeux nombre action:start', ephemeral: true });
      }
      game.tries++;
      if (val === game.target) {
        client.games.nombre.delete(uid);
        return interaction.reply(`Bravo, trouvé en ${game.tries} essai(s).`);
      }
      if (val < game.target) return interaction.reply('Plus grand.');
      return interaction.reply('Plus petit.');
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
      const lives = 6; // 6 erreurs autorisées
      client.games.pendu.set(uid, { word, revealed, used, lives });

      return interaction.reply(
        `Pendu lancé. Mot: ${maskWord(word, revealed)}  | Vies: ${lives} ${drawPendu(lives)}\n` +
        `Devine avec /minijeux pendu action:guess lettre:<a-z>`
      );
    }

    if (action === 'guess') {
      const game = client.games.pendu.get(uid);
      if (!game) {
        return interaction.reply({ content: 'Pas de pendu en cours. Lance /minijeux pendu action:start', ephemeral: true });
      }
      if (!letter || !/^[a-zàâçéèêëîïôûùüÿñ-]$/i.test(letter)) {
        return interaction.reply({ content: 'Lettre invalide.', ephemeral: true });
      }
      if (game.used.has(letter)) {
        return interaction.reply({ content: 'Lettre déjà utilisée.', ephemeral: true });
      }

      game.used.add(letter);
      let hit = false;
      for (let i = 0; i < game.word.length; i++) {
        if (game.word[i].toLowerCase() === letter) {
          game.revealed[i] = true;
          hit = true;
        }
      }
      if (!hit) game.lives--;

      const current = maskWord(game.word, game.revealed);

      if (game.revealed.every(Boolean)) {
        client.games.pendu.delete(uid);
        return interaction.reply(`Gagné. Mot: **${game.word}**`);
      }
      if (game.lives <= 0) {
        client.games.pendu.delete(uid);
        return interaction.reply(`Perdu. Le mot était **${game.word}**`);
      }

      return interaction.reply(
        `Mot: ${current} | Vies: ${game.lives} ${drawPendu(game.lives)} | Lettres: ${[...game.used].join(', ')}`
      );
    }
  }
}
