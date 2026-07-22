// services/statsStore.js
// Source unique de vérité pour stats.json (compteur de messages par utilisateur).
// Incrémente en mémoire, sauvegarde différée (debounce) pour éviter d'écrire
// à chaque message, et flush garanti sur SIGTERM/SIGINT (arrêt Docker).
const fs = require('fs');
const path = require('path');
const { readJson, writeJson, resolveDataPath } = require('./dataStore');

const FILE_NAME = 'stats.json';
// Ancien emplacement (racine du repo) utilisé avant la centralisation dans data/.
const LEGACY_ROOT_STATS_PATH = path.join(__dirname, '..', 'stats.json');
const FLUSH_DEBOUNCE_MS = 5_000;

let stats = null;
let dirty = false;
let flushTimer = null;

function loadLegacyRootStats() {
  if (!fs.existsSync(LEGACY_ROOT_STATS_PATH)) return null;
  try {
    const raw = fs.readFileSync(LEGACY_ROOT_STATS_PATH, 'utf-8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.error('[statsStore] Impossible de lire l\'ancien stats.json à la racine:', e.message);
    return null;
  }
}

function load() {
  if (stats === null) {
    const hasMigrated = fs.existsSync(resolveDataPath(FILE_NAME));
    stats = readJson(FILE_NAME, {});
    if (!stats || typeof stats !== 'object') stats = {};

    // Migration transparente : si data/stats.json n'existe pas encore mais
    // que l'ancien stats.json à la racine oui, on reprend ses données.
    if (!hasMigrated) {
      const legacy = loadLegacyRootStats();
      if (legacy) {
        stats = { ...legacy, ...stats };
        scheduleFlush();
      }
    }
  }
  return stats;
}

function scheduleFlush() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DEBOUNCE_MS);
  flushTimer.unref?.();
}

function flush() {
  if (!dirty || stats === null) return;
  dirty = false;
  writeJson(FILE_NAME, stats);
}

function incrementMessageCount(userId) {
  const data = load();
  data[userId] = (data[userId] || 0) + 1;
  scheduleFlush();
  return data[userId];
}

function getMessageCount(userId) {
  const data = load();
  return data[userId] || 0;
}

function getTopUsers(limit = 5) {
  const data = load();
  return Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function forceFlush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flush();
}

module.exports = {
  FILE_NAME,
  incrementMessageCount,
  getMessageCount,
  getTopUsers,
  forceFlush,
};
