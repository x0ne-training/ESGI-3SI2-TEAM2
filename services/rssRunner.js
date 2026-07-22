// services/rssRunner.js
// Runner RSS automatique : lit data/rss-config.json (flux configurés via
// /rss-setup), vérifie périodiquement les nouveaux articles et les publie
// dans le salon configuré. Mémorise les éléments déjà vus dans
// data/rss-state.json pour ne jamais republier l'historique ni faire de
// doublons après un redémarrage.
const Parser = require('rss-parser');
const { readJson, writeJson } = require('./dataStore');
const { readRssConfig } = require('./rssConfigStore');
const { isFeatureEnabled } = require('./guildConfig');

const STATE_FILE = 'rss-state.json';
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FEED_TIMEOUT_MS = 10_000;
const MAX_SEEN_IDS_PER_FEED = 300;
const ERROR_LOG_SUPPRESS_MS = 60 * 60 * 1000; // ne relogger une même erreur qu'une fois par heure

const parser = new Parser();

let running = false;
let started = false;
const lastErrorLoggedAt = new Map(); // feedId -> timestamp

function readState() {
  const data = readJson(STATE_FILE, { feeds: {} });
  if (!data || typeof data !== 'object' || !data.feeds) return { feeds: {} };
  return data;
}

function writeState(state) {
  writeJson(STATE_FILE, state);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout réseau')), ms)),
  ]);
}

function itemKey(item) {
  return item.guid || item.id || item.link || `${item.title || ''}|${item.pubDate || item.isoDate || ''}`;
}

function shouldLogError(feedId) {
  const last = lastErrorLoggedAt.get(feedId);
  const now = Date.now();
  if (!last || now - last > ERROR_LOG_SUPPRESS_MS) {
    lastErrorLoggedAt.set(feedId, now);
    return true;
  }
  return false;
}

async function checkFeed(client, guildId, feedId, feedCfg, state) {
  let feed;
  try {
    feed = await withTimeout(parser.parseURL(feedCfg.url), FEED_TIMEOUT_MS);
  } catch (error) {
    if (shouldLogError(feedId)) {
      console.error(`[rssRunner] Flux inaccessible (${feedCfg.customName || feedCfg.url}):`, error.message);
    }
    return;
  }

  const items = Array.isArray(feed.items) ? feed.items : [];
  const feedState = state.feeds[feedId] || { initialized: false, seenIds: [] };
  const seenSet = new Set(feedState.seenIds || []);

  if (!feedState.initialized) {
    // Premier passage : on mémorise l'existant sans rien publier (pas de backlog).
    feedState.seenIds = items.slice(0, MAX_SEEN_IDS_PER_FEED).map(itemKey);
    feedState.initialized = true;
    feedState.lastCheck = new Date().toISOString();
    state.feeds[feedId] = feedState;
    return;
  }

  const newItems = items.filter(item => !seenSet.has(itemKey(item)));
  feedState.lastCheck = new Date().toISOString();

  if (newItems.length === 0) {
    state.feeds[feedId] = feedState;
    return;
  }

  const channel = await client.channels.fetch(feedCfg.channelId).catch(() => null);
  const canSend = channel && channel.permissionsFor
    ? channel.permissionsFor(client.user.id)?.has('SendMessages')
    : Boolean(channel);

  if (!channel || !canSend) {
    console.warn(`[rssRunner] Salon indisponible ou permissions manquantes pour le flux ${feedCfg.customName || feedId}.`);
    // On marque quand même comme vu pour ne pas re-tenter en boucle sur les mêmes articles.
    feedState.seenIds = mergeSeenIds(feedState.seenIds, items.map(itemKey));
    state.feeds[feedId] = feedState;
    return;
  }

  // Publie du plus ancien au plus récent
  const toPublish = newItems.slice().reverse().slice(-10); // borne raisonnable par cycle
  for (const item of toPublish) {
    const title = item.title || 'Nouvel article';
    const link = item.link || '';
    try {
      await channel.send({
        content: `📰 **${feedCfg.customName || feed.title || 'Flux RSS'}** — ${title}${link ? `\n${link}` : ''}`,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error(`[rssRunner] Échec d'envoi pour le flux ${feedCfg.customName || feedId}:`, error.message);
    }
  }

  feedState.seenIds = mergeSeenIds(feedState.seenIds, items.map(itemKey));
  state.feeds[feedId] = feedState;
}

function mergeSeenIds(existing, incoming) {
  const merged = new Set([...(existing || []), ...incoming]);
  const arr = Array.from(merged);
  return arr.slice(Math.max(0, arr.length - MAX_SEEN_IDS_PER_FEED));
}

async function runCycle(client) {
  if (running) return; // évite les cycles qui se chevauchent si un flux est lent
  running = true;
  try {
    const rssConfig = readRssConfig();
    const state = readState();
    let dirty = false;

    for (const guildId of Object.keys(rssConfig)) {
      if (!isFeatureEnabled(guildId, 'rss')) continue;

      const guildFeeds = rssConfig[guildId] || {};
      for (const [feedId, feedCfg] of Object.entries(guildFeeds)) {
        await checkFeed(client, guildId, feedId, feedCfg, state);
        dirty = true;
      }
    }

    if (dirty) writeState(state);
  } catch (error) {
    console.error('[rssRunner] Erreur pendant le cycle RSS:', error.message);
  } finally {
    running = false;
  }
}

/**
 * Démarre le runner RSS une seule fois (protège contre les doubles démarrages
 * en cas de reconnect Discord).
 */
function startRssRunner(client, { intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (started) return;
  started = true;

  console.log(`📰 RssRunner démarré (interval ${intervalMs}ms)`);
  runCycle(client);
  const timer = setInterval(() => runCycle(client), intervalMs);
  timer.unref?.();
}

module.exports = { startRssRunner };
