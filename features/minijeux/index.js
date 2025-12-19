// features/minijeux/index.js
const state = require('./state');

// ----------- Devinette de nombre -----------
function startNombre(userId, max = 100) {
  const target = 1 + Math.floor(Math.random() * max);
  state.nombre.set(userId, { target, max, tries: 0 });
  return { target, max };
}

function guessNombre(userId, n) {
  const g = state.nombre.get(userId);
  if (!g) return { status: 'no-game' };
  g.tries++;
  if (n === g.target) {
    state.nombre.delete(userId);
    return { status: 'win', tries: g.tries };
  }
  return { status: n < g.target ? 'low' : 'high' };
}

// --------------- Pendu ---------------------
const WORDS = ['discord', 'javascript', 'esgi', 'minijeux', 'bot', 'module'];

function startPendu(userId) {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const revealed = '_'.repeat(word.length);
  const used = new Set();
  const lives = 6;
  state.pendu.set(userId, { word, revealed, used, lives });
  return { revealed, lives };
}

function guessPendu(userId, letter) {
  const g = state.pendu.get(userId);
  if (!g) return { status: 'no-game' };
  if (!/^[a-z]$/.test(letter)) return { status: 'bad-letter' };
  if (g.used.has(letter)) return { status: 'already' };
  g.used.add(letter);

  let arr = g.revealed.split('');
  let hit = false;
  for (let i = 0; i < g.word.length; i++) {
    if (g.word[i] === letter) {
      arr[i] = letter;
      hit = true;
    }
  }
  if (!hit) g.lives--;

  g.revealed = arr.join('');
  if (g.revealed === g.word) {
    state.pendu.delete(userId);
    return { status: 'win', word: g.word };
  }
  if (g.lives <= 0) {
    const w = g.word;
    state.pendu.delete(userId);
    return { status: 'lose', word: w };
  }
  return { status: 'progress', revealed: g.revealed, lives: g.lives, used: g.used };
}

// --------------- RPS -----------------------
const MOVES = ['rock', 'paper', 'scissors'];
function rpsResult(p, b) {
  if (p === b) return 'draw';
  if (
    (p === 'rock' && b === 'scissors') ||
    (p === 'paper' && b === 'rock') ||
    (p === 'scissors' && b === 'paper')
  )
    return 'win';
  return 'lose';
}

async function handleRpsButton(interaction, playerMove, expectedUserId) {
  if (interaction.user.id !== expectedUserId) {
    return interaction.reply({
      content: "Ce bouton n'est pas pour toi 😉",
      ephemeral: true,
    });
  }
  const botMove = MOVES[Math.floor(Math.random() * 3)];
  const res = rpsResult(playerMove, botMove);
  const msg =
    res === 'win'
      ? '🎉 Tu gagnes !'
      : res === 'lose'
      ? '💀 Tu perds !'
      : '🤝 Égalité.';
  return interaction.update({
    content: `Tu: **${playerMove}** | Bot: **${botMove}** → ${msg}`,
    components: [],
  });
}

module.exports = {
  // nombre
  startNombre,
  guessNombre,
  // pendu
  startPendu,
  guessPendu,
  // rps
  handleRpsButton,
};
