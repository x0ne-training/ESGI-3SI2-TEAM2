// services/devoirsService.js
// Service métier partagé pour les devoirs/examens/projets : lecture/écriture
// centralisée (data/), validation, construction des rappels persistants.
// Utilisé à la fois par la commande /ajouter-devoir et par le panel
// d'administration, pour ne pas dupliquer la logique.
const { readJson, writeJson } = require('./dataStore');
const { parseDateYYYYMMDD } = require('./dateParser');
const { addMany, cancelByDevoirId } = require('./remindersStore');

const DEVOIRS_FILE = 'devoirs.json';
const CONFIG_FILE = 'devoirs-config.json';
const ARCHIVE_FILE = 'devoirs-archives.json';

const TYPE_LABELS = {
  devoir: 'Devoir',
  examen: 'Examen',
  projet: 'Projet',
};

const IMPORTANCE_LABELS = {
  faible: 'Peu important',
  important: 'Important',
  tres_important: 'Très important',
};

const VALID_TYPES = Object.keys(TYPE_LABELS);
const VALID_IMPORTANCES = Object.keys(IMPORTANCE_LABELS);

const TITRE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 1000;

// ---------------------------------------------------------------------------
// Lecture / écriture brute
// ---------------------------------------------------------------------------

function readDevoirs() {
  const data = readJson(DEVOIRS_FILE, []);
  if (!Array.isArray(data)) return [];
  return data.map(d => ({
    type: d.type || 'devoir',
    importance: d.importance || 'important',
    guildId: d.guildId || null,
    channelId: d.channelId || null,
    customTimings: Array.isArray(d.customTimings) ? d.customTimings : [],
    ...d,
  }));
}

function writeDevoirs(list) {
  return writeJson(DEVOIRS_FILE, list);
}

function readArchive() {
  const data = readJson(ARCHIVE_FILE, []);
  return Array.isArray(data) ? data : [];
}

function writeArchive(list) {
  return writeJson(ARCHIVE_FILE, list);
}

function readConfig() {
  const data = readJson(CONFIG_FILE, {});
  return data && typeof data === 'object' ? data : {};
}

function writeConfig(cfg) {
  return writeJson(CONFIG_FILE, cfg);
}

function getGuildConfig(guildId) {
  const cfg = readConfig();
  const raw = cfg[guildId] || {};
  return {
    roleId: raw.roleId || null,
    reminderChannelId: raw.reminderChannelId || null,
    boardChannelId: raw.boardChannelId || null,
    boardMessageId: raw.boardMessageId || null,
    boardLastUpdate: raw.boardLastUpdate || null,
    customTimings: Array.isArray(raw.customTimings) ? raw.customTimings : [],
  };
}

// ---------------------------------------------------------------------------
// Archivage
// ---------------------------------------------------------------------------

function movePastDevoirsToArchive() {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const current = readDevoirs();
  const archived = readArchive();
  const alreadyIds = new Set(archived.map(d => d && d.id).filter(id => id !== undefined && id !== null));

  const stillCurrent = [];
  const toArchive = [];

  for (const d of current) {
    const dDate = parseDateYYYYMMDD(d.date);
    if (!dDate) {
      stillCurrent.push(d);
      continue;
    }
    if (dDate.getTime() < todayMidnight) {
      if (!alreadyIds.has(d.id)) {
        toArchive.push(d);
        alreadyIds.add(d.id);
      }
    } else {
      stillCurrent.push(d);
    }
  }

  if (toArchive.length > 0) {
    writeDevoirs(stillCurrent);
    writeArchive([...archived, ...toArchive]);
  }

  return toArchive.length;
}

// ---------------------------------------------------------------------------
// Timings / rappels
// ---------------------------------------------------------------------------

// convertit "3j", "12h", "1h30", "45m" -> ms
function parseOffset(str) {
  if (!str) return null;
  const s = str.toLowerCase().replace(/\s+/g, '');

  let total = 0;
  const days = s.match(/(\d+)j/);
  if (days) total += parseInt(days[1], 10) * 24 * 60 * 60 * 1000;
  const hours = s.match(/(\d+)h/);
  if (hours) total += parseInt(hours[1], 10) * 60 * 60 * 1000;
  const mins = s.match(/(\d+)m/);
  if (mins) total += parseInt(mins[1], 10) * 60 * 1000;

  return total > 0 ? total : null;
}

function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—';

  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  const parts = [];
  if (days) parts.push(`${days}j`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.length === 0 ? '0s' : parts.join(' ');
}

function parseTimingsString(timingsStr) {
  const result = [];
  const trimmed = (timingsStr || '').trim();
  if (!trimmed) return { timings: result, error: null };

  const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
  for (const p of parts) {
    const off = parseOffset(p);
    if (!off) {
      return { timings: [], error: `Timing invalide : \`${p}\` (ex attendus : 3j, 12h, 45m, 1h30).` };
    }
    result.push({ label: p, offsetMs: off });
  }
  return { timings: result, error: null };
}

// Génère les reminders persistants pour un devoir (J-7, J-1, timings custom)
function buildRemindersForDevoir(devoir) {
  const now = Date.now();
  const deadline = parseDateYYYYMMDD(devoir.date);
  if (!deadline) return [];

  const sourceChannelId = devoir.channelId;
  if (!sourceChannelId) return [];

  const deadlineMs = deadline.getTime();
  const guildCfg = getGuildConfig(devoir.guildId || '');
  const reminders = [];

  const push = (kind, when) => {
    if (when.getTime() <= now) return;
    reminders.push({
      guildId: devoir.guildId,
      sourceChannelId,
      devoirId: devoir.id,
      kind,
      title: devoir.titre,
      type: devoir.type,
      importance: devoir.importance,
      date: devoir.date,
      description: devoir.description || '',
      remindAtISO: when.toISOString(),
    });
  };

  const d7 = new Date(deadline);
  d7.setDate(d7.getDate() - 7);
  d7.setHours(8, 0, 0, 0);
  push('7d', d7);

  const d1 = new Date(deadline);
  d1.setDate(d1.getDate() - 1);
  d1.setHours(8, 0, 0, 0);
  push('1d-morning', d1);

  const timings = [
    ...(Array.isArray(guildCfg.customTimings) ? guildCfg.customTimings : []),
    ...(Array.isArray(devoir.customTimings) ? devoir.customTimings : []),
  ];

  for (const t of timings) {
    if (!t || typeof t.offsetMs !== 'number') continue;
    const trigger = deadlineMs - t.offsetMs;
    if (trigger <= now) continue;
    push(`custom-${t.label || t.offsetMs.toString()}`, new Date(trigger));
  }

  return reminders;
}

function rebuildRemindersFor(devoir) {
  cancelByDevoirId(devoir.id);
  const reminders = buildRemindersForDevoir(devoir);
  if (reminders.length > 0) addMany(reminders);
  return reminders;
}

// Recalcule tous les rappels persistants depuis devoirs.json (démarrage du bot)
function rebuildAllReminders() {
  movePastDevoirsToArchive();
  const devoirs = readDevoirs();
  let createdCount = 0;
  for (const devoir of devoirs) {
    const reminders = rebuildRemindersFor(devoir);
    createdCount += reminders.length;
  }
  return { devoirsCount: devoirs.length, createdCount };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateTitre(titre) {
  const t = String(titre || '').trim();
  if (!t) return { ok: false, error: 'Le titre est requis.' };
  if (t.length > TITRE_MAX_LENGTH) return { ok: false, error: `Le titre dépasse ${TITRE_MAX_LENGTH} caractères.` };
  return { ok: true, value: t };
}

function validateDescription(description) {
  const d = String(description || '').trim();
  if (d.length > DESCRIPTION_MAX_LENGTH) return { ok: false, error: `La description dépasse ${DESCRIPTION_MAX_LENGTH} caractères.` };
  return { ok: true, value: d };
}

function validateType(type) {
  if (!VALID_TYPES.includes(type)) return { ok: false, error: `Type invalide (attendu : ${VALID_TYPES.join(', ')}).` };
  return { ok: true, value: type };
}

function validateImportance(importance) {
  const v = importance || 'important';
  if (!VALID_IMPORTANCES.includes(v)) return { ok: false, error: `Importance invalide (attendu : ${VALID_IMPORTANCES.join(', ')}).` };
  return { ok: true, value: v };
}

function validateDate(dateStr) {
  const d = parseDateYYYYMMDD(dateStr);
  if (!d) return { ok: false, error: 'Format de date invalide. Utilise le format **AAAA-MM-JJ**.' };
  return { ok: true, value: d };
}

// ---------------------------------------------------------------------------
// Opérations de haut niveau (réutilisées par la commande slash et le panel)
// ---------------------------------------------------------------------------

/**
 * Ajoute un devoir après validation complète. Retourne { ok, error } ou
 * { ok: true, devoir, remindersCreated }.
 */
function addDevoir({ guildId, channelId, titre, date, description, type, importance, timingsStr }) {
  const titreCheck = validateTitre(titre);
  if (!titreCheck.ok) return { ok: false, error: titreCheck.error };

  const dateCheck = validateDate(date);
  if (!dateCheck.ok) return { ok: false, error: dateCheck.error };

  const typeCheck = validateType(type);
  if (!typeCheck.ok) return { ok: false, error: typeCheck.error };

  const importanceCheck = validateImportance(importance);
  if (!importanceCheck.ok) return { ok: false, error: importanceCheck.error };

  const descCheck = validateDescription(description);
  if (!descCheck.ok) return { ok: false, error: descCheck.error };

  const { timings, error: timingsError } = parseTimingsString(timingsStr);
  if (timingsError) return { ok: false, error: timingsError };

  movePastDevoirsToArchive();

  const devoirs = readDevoirs();
  const newDevoir = {
    id: Date.now(),
    guildId,
    channelId,
    titre: titreCheck.value,
    date: date.trim(),
    description: descCheck.value,
    type: typeCheck.value,
    importance: importanceCheck.value,
    customTimings: timings,
  };
  devoirs.push(newDevoir);
  writeDevoirs(devoirs);

  const remindersCreated = rebuildRemindersFor(newDevoir);

  return { ok: true, devoir: newDevoir, remindersCreated };
}

function deleteDevoir(id) {
  const devoirs = readDevoirs();
  const target = devoirs.find(d => d.id === id);
  if (!target) return { ok: false, error: 'Devoir introuvable.' };

  writeDevoirs(devoirs.filter(d => d.id !== id));
  const cancelledCount = cancelByDevoirId(id);

  return { ok: true, devoir: target, cancelledCount };
}

function updateDevoirDate(id, newDateStr) {
  const dateCheck = validateDate(newDateStr);
  if (!dateCheck.ok) return { ok: false, error: dateCheck.error };

  const devoirs = readDevoirs();
  const index = devoirs.findIndex(d => d.id === id);
  if (index === -1) return { ok: false, error: 'Devoir introuvable.' };

  const oldDate = devoirs[index].date;
  devoirs[index].date = newDateStr.trim();
  writeDevoirs(devoirs);

  const reminders = rebuildRemindersFor(devoirs[index]);

  return { ok: true, devoir: devoirs[index], oldDate, reminders };
}

function addCustomTiming(devoirId, label, delaiStr) {
  const off = parseOffset(delaiStr);
  if (!off) return { ok: false, error: `Délai invalide : \`${delaiStr}\` (ex attendus : 3j, 12h, 45m, 1h30).` };

  const cleanLabel = String(label || '').trim().slice(0, 50);
  if (!cleanLabel) return { ok: false, error: 'Le libellé du timing est requis.' };

  const devoirs = readDevoirs();
  const index = devoirs.findIndex(d => d.id === devoirId);
  if (index === -1) return { ok: false, error: 'Devoir introuvable.' };

  if (!Array.isArray(devoirs[index].customTimings)) devoirs[index].customTimings = [];
  devoirs[index].customTimings.push({ label: cleanLabel, offsetMs: off });
  writeDevoirs(devoirs);

  const reminders = rebuildRemindersFor(devoirs[index]);
  return { ok: true, devoir: devoirs[index], reminders };
}

function removeCustomTiming(devoirId, timingIndex) {
  const devoirs = readDevoirs();
  const index = devoirs.findIndex(d => d.id === devoirId);
  if (index === -1) return { ok: false, error: 'Devoir introuvable.' };

  const timings = Array.isArray(devoirs[index].customTimings) ? devoirs[index].customTimings : [];
  if (!timings[timingIndex]) return { ok: false, error: 'Timing introuvable.' };

  const [removed] = timings.splice(timingIndex, 1);
  devoirs[index].customTimings = timings;
  writeDevoirs(devoirs);

  const reminders = rebuildRemindersFor(devoirs[index]);
  return { ok: true, devoir: devoirs[index], removed, reminders };
}

function importanceScore(imp) {
  if (imp === 'tres_important') return 2;
  if (imp === 'important') return 1;
  return 0;
}

function listDevoirs({ guildId, type } = {}) {
  let devoirs = readDevoirs();
  if (guildId) devoirs = devoirs.filter(d => d.guildId === guildId);
  if (type) devoirs = devoirs.filter(d => d.type === type);

  devoirs.sort((a, b) => {
    const ia = importanceScore(a.importance);
    const ib = importanceScore(b.importance);
    if (ia !== ib) return ib - ia;
    const da = parseDateYYYYMMDD(a.date);
    const db = parseDateYYYYMMDD(b.date);
    if (!da || !db) return 0;
    return da - db;
  });

  return devoirs;
}

function listArchived(guildId) {
  const archived = readArchive().filter(d => !guildId || d.guildId === guildId);
  archived.sort((a, b) => {
    const da = parseDateYYYYMMDD(a.date);
    const db = parseDateYYYYMMDD(b.date);
    if (!da || !db) return 0;
    return db - da;
  });
  return archived;
}

module.exports = {
  TYPE_LABELS,
  IMPORTANCE_LABELS,
  VALID_TYPES,
  VALID_IMPORTANCES,
  readDevoirs,
  writeDevoirs,
  readArchive,
  writeArchive,
  readConfig,
  writeConfig,
  getGuildConfig,
  movePastDevoirsToArchive,
  parseOffset,
  formatDuration,
  parseTimingsString,
  buildRemindersForDevoir,
  rebuildRemindersFor,
  rebuildAllReminders,
  validateTitre,
  validateDescription,
  validateType,
  validateImportance,
  validateDate,
  addDevoir,
  deleteDevoir,
  updateDevoirDate,
  addCustomTiming,
  removeCustomTiming,
  listDevoirs,
  listArchived,
};
