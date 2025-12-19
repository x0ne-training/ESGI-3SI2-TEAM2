// features/minijeux/state.js
// État en mémoire par utilisateur
module.exports = {
  nombre: new Map(), // userId -> { target, max, tries }
  pendu: new Map(),  // userId -> { word, revealed, used:Set, lives }
};
