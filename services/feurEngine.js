// services/feurEngine.js
// Moteur de règles "quoi -> feur" configurables par serveur, avec cooldown
// par utilisateur en mémoire. Le déclencheur doit correspondre à la FIN du
// message (tolère espaces/ponctuation finale, insensible à la casse),
// sans jamais interpréter le texte admin comme une regex arbitraire.
const { getGuildConfig } = require('./guildConfig');

// guildId:userId -> timestamp (ms) du dernier déclenchement
const lastTriggerAt = new Map();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_ENTRY_AGE_MS = 24 * 60 * 60 * 1000; // borne large, couvre le cooldown max autorisé

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTriggerRegex(trigger) {
  const escaped = escapeRegExp(trigger.trim());
  if (!escaped) return null;
  // Le trigger doit être précédé du début de chaîne ou d'un caractère non-alphanumérique
  // (évite "pourquoi" de déclencher "quoi"), et suivi uniquement d'espaces/ponctuation
  // jusqu'à la fin (tolère "quoi ?", "quoi...", mais pas "quoique" ni "quoi ensuite").
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}[\\s\\p{P}]*$`, 'iu');
}

/**
 * Cherche la règle qui matche la fin du message pour cette guild.
 * En cas de plusieurs correspondances : trigger le plus long gagne,
 * puis l'ordre de création (le plus ancien en premier).
 */
function findMatchingRule(guildId, content) {
  if (typeof content !== 'string' || content.length === 0) return null;

  const cfg = getGuildConfig(guildId);
  if (!cfg.features.feur) return null;

  const trimmed = content.trim();
  if (!trimmed) return null;

  let best = null;
  for (const rule of cfg.feur.rules) {
    const regex = buildTriggerRegex(rule.trigger);
    if (!regex) continue;
    if (!regex.test(trimmed)) continue;

    if (!best || rule.trigger.length > best.trigger.length) {
      best = rule;
    }
  }

  return best;
}

function cooldownKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

/**
 * Retourne true si l'utilisateur est encore en cooldown pour cette guild.
 */
function isOnCooldown(guildId, userId, cooldownMinutes) {
  if (cooldownMinutes <= 0) return false;
  const last = lastTriggerAt.get(cooldownKey(guildId, userId));
  if (!last) return false;
  return Date.now() - last < cooldownMinutes * 60 * 1000;
}

function markTriggered(guildId, userId) {
  lastTriggerAt.set(cooldownKey(guildId, userId), Date.now());
}

/**
 * Point d'entrée principal : retourne la réponse à envoyer, ou null si
 * rien ne doit être envoyé (pas de règle, feature désactivée, cooldown actif).
 */
function evaluateMessage(guildId, userId, content) {
  const cfg = getGuildConfig(guildId);
  if (!cfg.features.feur) return null;

  const rule = findMatchingRule(guildId, content);
  if (!rule) return null;

  if (isOnCooldown(guildId, userId, cfg.feur.cooldownMinutes)) return null;

  markTriggered(guildId, userId);
  return rule.response;
}

function cleanupExpiredCooldowns() {
  const now = Date.now();
  for (const [key, ts] of lastTriggerAt) {
    if (now - ts > MAX_ENTRY_AGE_MS) lastTriggerAt.delete(key);
  }
}

let cleanupTimer = null;
function startCooldownCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanupExpiredCooldowns, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}

module.exports = {
  evaluateMessage,
  findMatchingRule,
  isOnCooldown,
  startCooldownCleanup,
  cleanupExpiredCooldowns,
  // exposé pour les tests unitaires ciblés
  buildTriggerRegex,
  escapeRegExp,
};
