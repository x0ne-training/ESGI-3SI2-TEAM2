const { EmbedBuilder } = require('discord.js')
const devoirsService = require('./devoirsService')
const { parseDateYYYYMMDD } = require('./dateParser')
const { isFeatureEnabled } = require('./guildConfig')

const { TYPE_LABELS, IMPORTANCE_LABELS } = devoirsService

const CATEGORY_ORDER = ['devoir', 'examen', 'projet']
const CATEGORY_COLORS = { devoir: 0x2ecc71, examen: 0x9b59b6, projet: 0x3498db }
const DESCRIPTION_MAX = 4096

function todayKey () {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function importanceScore (imp) {
  if (imp === 'tres_important') return 2
  if (imp === 'important') return 1
  return 0
}

// Trie du plus proche au plus éloigné, puis par importance décroissante,
// puis par titre pour un ordre stable en cas d'égalité totale.
function sortItems (items) {
  return items.slice().sort((a, b) => {
    const dateDiff = a._date.getTime() - b._date.getTime()
    if (dateDiff !== 0) return dateDiff
    const impDiff = importanceScore(b.importance) - importanceScore(a.importance)
    if (impDiff !== 0) return impDiff
    return (a.titre || '').localeCompare(b.titre || '')
  })
}

function formatLine (d) {
  const timestamp = Math.floor(d._date.getTime() / 1000)
  const impLabel = IMPORTANCE_LABELS[d.importance || 'important'] || 'Important'
  const desc = d.description ? ` — ${d.description}` : ''
  return `• **${d.titre}** — <t:${timestamp}:D> (<t:${timestamp}:R>) — 📍 ${impLabel}${desc}`
}

// Construit une description bornée à la limite Discord, sans tronquer
// silencieusement : si tout ne tient pas, on l'indique explicitement.
function buildBoundedDescription (lines) {
  let description = ''
  let shown = 0
  for (const line of lines) {
    const candidate = description ? `${description}\n${line}` : line
    if (candidate.length > DESCRIPTION_MAX - 60) break
    description = candidate
    shown++
  }
  if (shown < lines.length) {
    description += `\n\n*… et ${lines.length - shown} élément(s) supplémentaire(s) non affiché(s).*`
  }
  return description
}

function buildBoardEmbeds (items) {
  if (items.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('📚 Tableau des devoirs')
        .setDescription('📭 Aucun devoir, examen ou projet à venir pour le moment.')
        .setTimestamp(),
    ]
  }

  const byType = { devoir: [], examen: [], projet: [] }
  for (const d of items) {
    const t = byType[d.type] ? d.type : 'devoir'
    byType[t].push(d)
  }

  const embeds = []
  for (const type of CATEGORY_ORDER) {
    const list = byType[type]
    if (!list || list.length === 0) continue

    const sorted = sortItems(list)
    const lines = sorted.map(formatLine)

    embeds.push(
      new EmbedBuilder()
        .setColor(CATEGORY_COLORS[type])
        .setTitle(TYPE_LABELS[type])
        .setDescription(buildBoundedDescription(lines))
        .setFooter({ text: `${list.length} élément(s) — mise à jour automatique` })
        .setTimestamp()
    )
  }

  return embeds
}

// Met à jour le tableau pour une guilde
async function updateGuildBoard (client, guildId, cfg) {
  const gcfg = cfg[guildId]
  if (!gcfg?.boardChannelId) return
  if (!isFeatureEnabled(guildId, 'homework')) return

  const channel = await client.channels
    .fetch(gcfg.boardChannelId)
    .catch(() => null)
  if (!channel) return

  const moved = devoirsService.movePastDevoirsToArchive()
  if (moved > 0) {
    console.log(`[DevoirBoard] ${moved} élément(s) archivé(s) avant la mise à jour du tableau.`)
  }

  const devoirs = devoirsService.readDevoirs()

  const today0 = new Date()
  today0.setHours(0, 0, 0, 0)
  const todayMs = today0.getTime()

  const items = devoirs
    .filter(d => d && d.guildId === guildId)
    .map(d => ({ ...d, _date: parseDateYYYYMMDD(d.date) }))
    .filter(d => d._date && d._date.getTime() >= todayMs)

  if (gcfg.boardMessageId) {
    await channel.messages
      .fetch(gcfg.boardMessageId)
      .then(msg => msg.delete().catch(() => null))
      .catch(() => null)
  }

  const embeds = buildBoardEmbeds(items)
  const sent = await channel.send({ embeds })

  cfg[guildId].boardMessageId = sent.id
  cfg[guildId].boardLastUpdate = todayKey()
  devoirsService.writeConfig(cfg)
}

// Met à jour les tableaux de toutes les guildes
async function updateAllBoards (client, force = false) {
  const cfg = devoirsService.readConfig()
  const key = todayKey()

  for (const guildId of Object.keys(cfg)) {
    const gcfg = cfg[guildId]
    if (!gcfg?.boardChannelId) continue
    if (!force && gcfg.boardLastUpdate === key) continue

    await updateGuildBoard(client, guildId, cfg).catch(e => {
      console.error('Erreur update board guild', guildId, e)
    })
  }
}

// Initialise le système du tableau des devoirs
function initDevoirBoard (client) {
  updateAllBoards(client, false).catch(() => null)

  // Mise à jour toutes les heures
  const timer = setInterval(() => {
    updateAllBoards(client, false).catch(() => null)
  }, 60 * 60 * 1000)
  timer.unref?.()

  // Expose une fonction pour forcer la mise à jour (panel, commandes de config)
  client.forceDevoirBoardUpdate = () => updateAllBoards(client, true)
}

module.exports = { initDevoirBoard, buildBoardEmbeds, updateGuildBoard, updateAllBoards }
