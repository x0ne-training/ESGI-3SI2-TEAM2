// services/guildStore.js
// Couche centrale de stockage multi-serveur.
//
// Organisation physique du dossier data/ (schéma v2) :
//
//   data/
//   ├── schema.json                    { "version": 2 }
//   ├── guilds/
//   │   └── <guildId>/                 (guildId = snowflake Discord, 17-20 chiffres)
//   │       ├── config.json            config devoirs + features + feur
//   │       ├── devoirs.json
//   │       ├── devoirs-archives.json
//   │       ├── reminders.json
//   │       ├── categories.json
//   │       ├── stats.json
//   │       ├── rss-config.json
//   │       ├── rss-state.json
//   │       └── events.json
//   └── global/                        données réellement globales au bot
//       ├── events-settings.json       réglages partagés du système d'événements
//       └── reminders-orphans.json     rappels sans guild rattachable
//
// AUCUN autre module ne doit construire de chemin `data/guilds/<id>/...`
// à la main : tout passe par readGuildJson / writeGuildJson.
const fs = require('fs');
const path = require('path');

const {
  DATA_DIR,
  ensureDir,
  readJsonAt,
  writeJsonAt,
  structuredCloneSafe,
} = require('./dataStore');

const GUILDS_DIR = path.join(DATA_DIR, 'guilds');
const GLOBAL_DIR = path.join(DATA_DIR, 'global');
const SCHEMA_PATH = path.join(DATA_DIR, 'schema.json');

const SCHEMA_VERSION = 2;

/** Noms de fichiers par serveur. Source unique de vérité. */
const FILES = {
  CONFIG: 'config.json',
  DEVOIRS: 'devoirs.json',
  ARCHIVES: 'devoirs-archives.json',
  REMINDERS: 'reminders.json',
  CATEGORIES: 'categories.json',
  STATS: 'stats.json',
  RSS_CONFIG: 'rss-config.json',
  RSS_STATE: 'rss-state.json',
  EVENTS: 'events.json',
};

/** Noms de fichiers réellement globaux au bot. */
const GLOBAL_FILES = {
  EVENTS_SETTINGS: 'events-settings.json',
  ORPHAN_REMINDERS: 'reminders-orphans.json',
};

// Un ID Discord (snowflake) est un entier décimal de 17 à 20 chiffres.
// Cette validation est la seule barrière entre une valeur venant d'une
// interaction utilisateur et le système de fichiers : elle interdit
// mécaniquement "..", "/", "~" et tout chemin arbitraire.
const GUILD_ID_RE = /^\d{17,20}$/;

function isValidGuildId(guildId) {
  return typeof guildId === 'string' && GUILD_ID_RE.test(guildId);
}

/**
 * Normalise puis valide un guildId. Retourne null (avec un log) si invalide,
 * pour que les appelants dégradent proprement au lieu de faire planter le bot.
 */
function normalizeGuildId(guildId) {
  const id = guildId === null || guildId === undefined ? '' : String(guildId);
  if (!isValidGuildId(id)) return null;
  return id;
}

/** Chemin absolu du dossier d'un serveur. Retourne null si guildId invalide. */
function getGuildDataPath(guildId, fileName) {
  const id = normalizeGuildId(guildId);
  if (!id) return null;
  const dir = path.join(GUILDS_DIR, id);
  return fileName ? path.join(dir, fileName) : dir;
}

/** Crée le dossier du serveur s'il n'existe pas. Retourne le chemin ou null. */
function ensureGuildDir(guildId) {
  const dir = getGuildDataPath(guildId);
  if (!dir) return null;
  ensureDir(dir);
  return dir;
}

/**
 * Lit un fichier JSON d'un serveur. Si le fichier n'existe pas, retourne les
 * valeurs par défaut fournies (sans écrire sur le disque : la création
 * effective n'a lieu qu'au premier write, pour ne pas semer des fichiers
 * vides à chaque lecture).
 */
function readGuildJson(guildId, fileName, fallback) {
  const filePath = getGuildDataPath(guildId, fileName);
  if (!filePath) {
    console.error(`[guildStore] Lecture refusée : guildId invalide (${guildId}) pour ${fileName}.`);
    return structuredCloneSafe(fallback);
  }
  return readJsonAt(filePath, fallback);
}

/** Écrit un fichier JSON d'un serveur (atomique). Retourne true/false. */
function writeGuildJson(guildId, fileName, data) {
  const filePath = getGuildDataPath(guildId, fileName);
  if (!filePath) {
    console.error(`[guildStore] Écriture refusée : guildId invalide (${guildId}) pour ${fileName}.`);
    return false;
  }
  return writeJsonAt(filePath, data);
}

/** Existence d'un fichier de serveur. */
function guildFileExists(guildId, fileName) {
  const filePath = getGuildDataPath(guildId, fileName);
  return Boolean(filePath) && fs.existsSync(filePath);
}

/** Le serveur a-t-il déjà un dossier de données ? */
function guildExists(guildId) {
  const dir = getGuildDataPath(guildId);
  return Boolean(dir) && fs.existsSync(dir);
}

/**
 * Liste les IDs de tous les serveurs ayant des données sur le disque.
 * Filtre tout nom de dossier qui n'est pas un snowflake valide.
 */
function listGuildIds() {
  if (!fs.existsSync(GUILDS_DIR)) return [];
  try {
    return fs
      .readdirSync(GUILDS_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && isValidGuildId(entry.name))
      .map(entry => entry.name);
  } catch (e) {
    console.error('[guildStore] Impossible de lister les serveurs:', e.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Données globales
// ---------------------------------------------------------------------------

function readGlobalJson(fileName, fallback) {
  return readJsonAt(path.join(GLOBAL_DIR, fileName), fallback);
}

function writeGlobalJson(fileName, data) {
  return writeJsonAt(path.join(GLOBAL_DIR, fileName), data);
}

// ---------------------------------------------------------------------------
// Version du schéma
// ---------------------------------------------------------------------------

function readSchema() {
  const data = readJsonAt(SCHEMA_PATH, { version: 1 });
  const version = Number(data?.version);
  return { version: Number.isFinite(version) ? version : 1 };
}

function getSchemaVersion() {
  return readSchema().version;
}

function writeSchemaVersion(version) {
  return writeJsonAt(SCHEMA_PATH, { version, updatedAt: new Date().toISOString() });
}

/**
 * Marque le stockage comme étant au schéma courant. Utilisé par la migration
 * et par l'initialisation d'une installation vierge.
 */
function ensureSchemaVersion() {
  if (getSchemaVersion() < SCHEMA_VERSION) writeSchemaVersion(SCHEMA_VERSION);
  return SCHEMA_VERSION;
}

module.exports = {
  DATA_DIR,
  GUILDS_DIR,
  GLOBAL_DIR,
  SCHEMA_PATH,
  SCHEMA_VERSION,
  FILES,
  GLOBAL_FILES,
  isValidGuildId,
  normalizeGuildId,
  getGuildDataPath,
  ensureGuildDir,
  readGuildJson,
  writeGuildJson,
  guildFileExists,
  guildExists,
  listGuildIds,
  readGlobalJson,
  writeGlobalJson,
  readSchema,
  getSchemaVersion,
  writeSchemaVersion,
  ensureSchemaVersion,
};
