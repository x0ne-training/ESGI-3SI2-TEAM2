// services/remindersStore.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'reminders.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify({ version: 1, reminders: [] }, null, 2), 'utf-8');
  }
}

function readAll() {
  ensureFile();
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return { version: 1, reminders: [] };
    if (!Array.isArray(data.reminders)) data.reminders = [];
    if (!data.version) data.version = 1;
    return data;
  } catch (e) {
    console.error('Erreur lecture reminders.json :', e);
    return { version: 1, reminders: [] };
  }
}

function writeAll(data) {
  ensureFile();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Erreur écriture reminders.json :', e);
  }
}

function makeId() {
  return `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * reminder:
 * {
 *   id, status, createdAt, sentAt,
 *   guildId, channelId,
 *   devoirId, kind, title, type, importance, date, description,
 *   remindAtISO
 * }
 */
function addReminder(reminder) {
  const data = readAll();
  const item = {
    id: makeId(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    sentAt: null,
    ...reminder,
  };
  data.reminders.push(item);
  writeAll(data);
  return item;
}

function addMany(reminders) {
  const data = readAll();
  const created = [];
  for (const r of reminders) {
    const item = {
      id: makeId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      sentAt: null,
      ...r,
    };
    data.reminders.push(item);
    created.push(item);
  }
  writeAll(data);
  return created;
}

function markSent(id) {
  const data = readAll();
  const r = data.reminders.find(x => x.id === id);
  if (!r) return false;
  r.status = 'sent';
  r.sentAt = new Date().toISOString();
  writeAll(data);
  return true;
}

function cancelByDevoirId(devoirId) {
  const data = readAll();
  let changed = 0;
  for (const r of data.reminders) {
    if (r.devoirId === devoirId && r.status === 'pending') {
      r.status = 'cancelled';
      r.sentAt = new Date().toISOString();
      changed++;
    }
  }
  if (changed > 0) writeAll(data);
  return changed;
}

function cleanupOldSent(days = 30) {
  const data = readAll();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const before = data.reminders.length;
  data.reminders = data.reminders.filter(r => {
    if (r.status !== 'sent' && r.status !== 'cancelled') return true;
    const t = new Date(r.sentAt || r.createdAt || 0).getTime();
    return isNaN(t) ? true : t >= cutoff;
  });
  if (data.reminders.length !== before) writeAll(data);
}

function getPendingDue(nowMs = Date.now()) {
  const data = readAll();
  return data.reminders.filter(r => {
    if (r.status !== 'pending') return false;
    const t = new Date(r.remindAtISO).getTime();
    if (isNaN(t)) return false;
    return t <= nowMs;
  });
}

module.exports = {
  readAll,
  writeAll,
  addReminder,
  addMany,
  markSent,
  cancelByDevoirId,
  cleanupOldSent,
  getPendingDue,
};
