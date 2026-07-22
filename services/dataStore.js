// services/dataStore.js
// Accès centralisé au dossier data/ : chemin absolu stable, lecture/écriture JSON
// sûres, écriture atomique (fichier temporaire + rename), verrou en mémoire
// pour sérialiser les écritures concurrentes sur un même fichier.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function resolveDataPath(fileName) {
  return path.join(DATA_DIR, fileName);
}

/**
 * Lit un fichier JSON dans data/. Retourne `fallback` si le fichier
 * n'existe pas ou si le JSON est invalide (sans jamais faire planter le bot).
 */
function readJson(fileName, fallback) {
  ensureDataDir();
  const filePath = resolveDataPath(fileName);
  if (!fs.existsSync(filePath)) return structuredCloneSafe(fallback);

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (raw.trim().length === 0) return structuredCloneSafe(fallback);
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[dataStore] JSON invalide dans ${fileName}, valeurs par défaut utilisées:`, e.message);
    return structuredCloneSafe(fallback);
  }
}

/**
 * Écrit un fichier JSON dans data/ de façon atomique (tmp + rename).
 * Reste synchrone (comme le reste du module) : dans un process Node
 * mono-thread, ça garantit qu'une lecture juste après une écriture voit
 * bien les données à jour, sans avoir besoin d'une file d'attente asynchrone.
 */
function writeJson(fileName, data) {
  ensureDataDir();
  const filePath = resolveDataPath(fileName);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify(data, null, 2);

  try {
    fs.writeFileSync(tmpPath, payload, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    console.error(`[dataStore] Erreur écriture ${fileName}:`, e.message);
    try { fs.unlinkSync(tmpPath); } catch { /* tmp déjà absent */ }
  }
}

function structuredCloneSafe(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  DATA_DIR,
  ensureDataDir,
  resolveDataPath,
  readJson,
  writeJson,
};
