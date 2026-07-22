// services/dateParser.js
// Parseur de dates centralisé pour les devoirs/examens/projets.
// Évite le piège de `new Date("YYYY-MM-DD")` qui est interprété en UTC :
// on construit la date à partir de ses composants, en heure locale du
// process (cohérent avec le comportement déjà en place dans le projet).
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/**
 * Parse une date au format AAAA-MM-JJ en heure locale (minuit).
 * Retourne null si le format ou la date est invalide.
 */
function parseDateYYYYMMDD(dateStr) {
  if (typeof dateStr !== 'string') return null;
  const match = DATE_RE.exec(dateStr.trim());
  if (!match) return null;

  const [, yStr, mStr, dStr] = match;
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);

  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  // Rejette les débordements silencieux (ex: 2024-02-31 -> 2024-03-02)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;

  return dt;
}

/**
 * Parse une date + heure (AAAA-MM-JJ + HH:mm) en heure locale.
 */
function parseDateTimeLocal(dateStr, timeStr) {
  const datePart = parseDateYYYYMMDD(dateStr);
  if (!datePart) return null;
  if (typeof timeStr !== 'string') return null;

  const match = TIME_RE.exec(timeStr.trim());
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh > 23 || mm > 59) return null;

  datePart.setHours(hh, mm, 0, 0);
  return datePart;
}

function isValidDateString(dateStr) {
  return parseDateYYYYMMDD(dateStr) !== null;
}

module.exports = {
  parseDateYYYYMMDD,
  parseDateTimeLocal,
  isValidDateString,
};
