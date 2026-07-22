// services/eventsConfigStore.js
// Accès centralisé à la configuration du système d'événements (/event-*),
// stockée dans data/events-config.json. Remplace les fs.readFileSync /
// writeFileSync dupliqués dans chaque commande event-* et service associé.
const fs = require('fs');
const path = require('path');
const { readJson, writeJson, resolveDataPath } = require('./dataStore');

const FILE_NAME = 'events-config.json';
// Ancien emplacement (racine du repo) utilisé avant la centralisation dans data/.
const LEGACY_ROOT_PATH = path.join(__dirname, '..', 'events-config.json');

function defaultConfig() {
  return {
    events: {},
    reminders: {},
    settings: {
      defaultReminderTimes: [
        { value: 24, unit: 'hours', label: '24h avant' },
        { value: 1, unit: 'hours', label: '1h avant' },
        { value: 15, unit: 'minutes', label: '15min avant' },
      ],
      maxEventsPerGuild: 50,
      maxParticipantsPerEvent: 100,
    },
  };
}

function loadLegacyRoot() {
  if (!fs.existsSync(LEGACY_ROOT_PATH)) return null;
  try {
    const raw = fs.readFileSync(LEGACY_ROOT_PATH, 'utf-8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.error('[eventsConfigStore] Impossible de lire l\'ancien events-config.json à la racine:', e.message);
    return null;
  }
}

function readEventsConfig() {
  const alreadyMigrated = fs.existsSync(resolveDataPath(FILE_NAME));
  const data = readJson(FILE_NAME, defaultConfig());

  const normalized = data && typeof data === 'object' ? data : defaultConfig();
  if (!normalized.events) normalized.events = {};
  if (!normalized.reminders) normalized.reminders = {};
  if (!normalized.settings) normalized.settings = defaultConfig().settings;

  if (!alreadyMigrated) {
    const legacy = loadLegacyRoot();
    if (legacy) {
      const merged = {
        events: { ...legacy.events, ...normalized.events },
        reminders: { ...legacy.reminders, ...normalized.reminders },
        settings: { ...defaultConfig().settings, ...legacy.settings, ...normalized.settings },
      };
      writeJson(FILE_NAME, merged);
      return merged;
    }
  }

  return normalized;
}

function writeEventsConfig(config) {
  writeJson(FILE_NAME, config);
}

module.exports = { readEventsConfig, writeEventsConfig, defaultConfig };
