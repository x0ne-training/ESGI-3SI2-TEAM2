// services/rssConfigStore.js
// Accès centralisé à la configuration RSS (data/rss-config.json), migrée
// depuis l'ancien rss-config.json à la racine du repo.
const fs = require('fs');
const path = require('path');
const { readJson, writeJson, resolveDataPath } = require('./dataStore');

const FILE_NAME = 'rss-config.json';
const LEGACY_ROOT_PATH = path.join(__dirname, '..', 'rss-config.json');

function loadLegacyRoot() {
  if (!fs.existsSync(LEGACY_ROOT_PATH)) return null;
  try {
    const raw = fs.readFileSync(LEGACY_ROOT_PATH, 'utf-8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.error('[rssConfigStore] Impossible de lire l\'ancien rss-config.json à la racine:', e.message);
    return null;
  }
}

function readRssConfig() {
  const alreadyMigrated = fs.existsSync(resolveDataPath(FILE_NAME));
  let data = readJson(FILE_NAME, {});
  if (!data || typeof data !== 'object') data = {};

  if (!alreadyMigrated) {
    const legacy = loadLegacyRoot();
    if (legacy) {
      data = { ...legacy, ...data };
      writeJson(FILE_NAME, data);
    }
  }

  return data;
}

function writeRssConfig(config) {
  writeJson(FILE_NAME, config);
}

module.exports = { readRssConfig, writeRssConfig, FILE_NAME };
