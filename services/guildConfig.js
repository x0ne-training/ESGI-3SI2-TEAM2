// services/guildConfig.js
// Configuration persistante par serveur (data/guild-config.json).
// Fournit des valeurs par défaut sûres, normalise ce qui est chargé,
// et centralise la lecture/écriture pour éviter la duplication.
const { readJson, writeJson } = require('./dataStore');

const FILE_NAME = 'guild-config.json';

const DEFAULT_FEUR_RULE = () => ({
  id: 'default-quoi',
  trigger: 'quoi',
  response: 'Feur.',
});

const MIN_COOLDOWN_MINUTES = 0;
const MAX_COOLDOWN_MINUTES = 24 * 60; // 24h, borne raisonnable

function defaultGuildConfig() {
  return {
    features: {
      feur: true,
      homework: true,
      stats: true,
      rss: true,
      recurringEvents: true,
    },
    feur: {
      cooldownMinutes: 30,
      rules: [DEFAULT_FEUR_RULE()],
    },
  };
}

function makeRuleId() {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampCooldown(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 30;
  return Math.min(MAX_COOLDOWN_MINUTES, Math.max(MIN_COOLDOWN_MINUTES, Math.round(n)));
}

function normalizeRule(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const trigger = String(raw.trigger || '').slice(0, 100).trim();
  const response = String(raw.response || '').slice(0, 500);
  if (!trigger || !response) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeRuleId(),
    trigger,
    response,
  };
}

function normalizeGuildConfig(raw) {
  const defaults = defaultGuildConfig();
  if (!raw || typeof raw !== 'object') return defaults;

  const features = { ...defaults.features, ...(raw.features && typeof raw.features === 'object' ? raw.features : {}) };
  for (const key of Object.keys(features)) features[key] = Boolean(features[key]);

  const rawFeur = raw.feur && typeof raw.feur === 'object' ? raw.feur : {};
  const rules = Array.isArray(rawFeur.rules)
    ? rawFeur.rules.map(normalizeRule).filter(Boolean)
    : [];

  return {
    features,
    feur: {
      cooldownMinutes: clampCooldown(rawFeur.cooldownMinutes ?? defaults.feur.cooldownMinutes),
      rules: rules.length > 0 ? rules : [DEFAULT_FEUR_RULE()],
    },
  };
}

function readAll() {
  const data = readJson(FILE_NAME, { guilds: {} });
  if (!data || typeof data !== 'object' || !data.guilds || typeof data.guilds !== 'object') {
    return { guilds: {} };
  }
  return data;
}

function writeAll(data) {
  return writeJson(FILE_NAME, data);
}

/**
 * Retourne la config normalisée d'une guild. Ne persiste PAS automatiquement
 * (lecture pure) — utiliser ensureGuildConfig() si la persistance est requise.
 */
function getGuildConfig(guildId) {
  const all = readAll();
  return normalizeGuildConfig(all.guilds[guildId]);
}

/**
 * Comme getGuildConfig(), mais crée et persiste une configuration par défaut
 * si la guild n'en a pas encore.
 */
function ensureGuildConfig(guildId) {
  const all = readAll();
  if (!all.guilds[guildId]) {
    all.guilds[guildId] = defaultGuildConfig();
    writeAll(all);
    return all.guilds[guildId];
  }
  return normalizeGuildConfig(all.guilds[guildId]);
}

function updateGuildConfig(guildId, mutator) {
  const all = readAll();
  const current = normalizeGuildConfig(all.guilds[guildId]);
  const updated = mutator(current) || current;
  all.guilds[guildId] = normalizeGuildConfig(updated);
  writeAll(all);
  return all.guilds[guildId];
}

function isFeatureEnabled(guildId, feature) {
  const cfg = getGuildConfig(guildId);
  return cfg.features[feature] !== false;
}

module.exports = {
  FILE_NAME,
  defaultGuildConfig,
  DEFAULT_FEUR_RULE,
  MIN_COOLDOWN_MINUTES,
  MAX_COOLDOWN_MINUTES,
  clampCooldown,
  normalizeRule,
  getGuildConfig,
  ensureGuildConfig,
  updateGuildConfig,
  isFeatureEnabled,
};
