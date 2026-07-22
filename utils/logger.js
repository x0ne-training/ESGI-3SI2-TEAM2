// utils/logger.js
// Logger minimal : les logs "debug" (verbeux, par message/interaction) ne
// s'affichent que si LOG_LEVEL=debug. Les logs normaux (démarrage, erreurs)
// passent par console.log/console.error directement ailleurs dans le code.
const isDebug = () => process.env.LOG_LEVEL === 'debug';

function debug(...args) {
  if (isDebug()) console.log(...args);
}

module.exports = { debug, isDebug };
