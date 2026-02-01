const { EmbedBuilder } = require('discord.js')
const fs = require('fs')
const path = require('path')

const CONFIG_FILE = path.join(__dirname, '../data/devoirs-config.json')
const DATA_FILE = path.join(__dirname, '../data/devoirs.json')
const ARCHIVE_FILE = path.join(__dirname, '../data/devoirs-archives.json')

const TYPE_LABELS = {
  devoir: '📘 Devoirs',
  examen: '🧪 Examens',
  projet: '🛠️ Projets'
}

const IMPORTANCE_LABELS = {
  faible: 'Peu important',
  important: 'Important',
  tres_important: 'Très important'
}

function readJson (file, fallback) {
  if (!fs.existsSync(file)) return fallback
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return data ?? fallback
  } catch {
    return fallback
  }
}

function writeJson (file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.error('Erreur écriture JSON:', file, e)
  }
}

function todayKey () {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateSafe (yyyyMMdd) {
  const d = new Date(yyyyMMdd)
  return isNaN(d.getTime()) ? null : d
}

// Lectures/écritures des devoirs
function readDevoirs () {
  if (!fs.existsSync(DATA_FILE)) return []
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.error('Erreur lecture devoirs.json :', e)
    return []
  }
}

function writeDevoirs (list) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8')
  } catch (e) {
    console.error('Erreur écriture devoirs.json :', e)
  }
}

// Lectures/écritures des archives
function readArchive () {
  if (!fs.existsSync(ARCHIVE_FILE)) return []
  try {
    const data = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8'))
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.error('Erreur lecture devoirs-archives.json :', e)
    return []
  }
}

function writeArchive (list) {
  try {
    fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(list, null, 2), 'utf-8')
  } catch (e) {
    console.error('Erreur écriture devoirs-archives.json :', e)
  }
}

// Déplace les devoirs passés vers les archives
function movePastDevoirsToArchive () {
  const now = new Date()
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime()

  const current = readDevoirs()
  const archived = readArchive()

  const alreadyIds = new Set(archived.map(d => d && d.id).filter(Boolean))

  const stillCurrent = []
  const toArchive = []

  for (const d of current) {
    const dDate = new Date(d.date)

    if (isNaN(dDate.getTime())) {
      stillCurrent.push(d)
      continue
    }

    if (dDate.getTime() < todayMidnight) {
      if (d && d.id && !alreadyIds.has(d.id)) {
        toArchive.push(d)
        alreadyIds.add(d.id)
      }
    } else {
      stillCurrent.push(d)
    }
  }

  if (toArchive.length > 0) {
    writeDevoirs(stillCurrent)
    writeArchive([...archived, ...toArchive])
  }

  return toArchive.length
}

// Crée l'embed Discord du tableau
function buildBoardEmbed (items) {
  const byType = { devoir: [], examen: [], projet: [] }

  for (const d of items) {
    const t = d.type || 'devoir'
    if (!byType[t]) byType[t] = []
    byType[t].push(d)
  }
  for (const t of Object.keys(byType)) {
    byType[t].sort((a, b) => new Date(a.date) - new Date(b.date))
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('📚 Tableau des devoirs')
    .setDescription('Mise à jour automatique quotidienne.')
    .setTimestamp()

  const makeSection = typeKey => {
    const list = byType[typeKey] || []
    if (list.length === 0) return '📭 Rien à afficher.'

    return list
      .slice(0, 25)
      .map(d => {
        const imp =
          IMPORTANCE_LABELS[d.importance || 'important'] || 'Important'
        const desc = d.description ? ` — ${d.description}` : ''
        return `• **${d.titre}** — 📅 ${d.date} — 📍 ${imp}${desc}`
      })
      .join('\n')
  }

  embed.addFields(
    { name: TYPE_LABELS.devoir, value: makeSection('devoir') },
    { name: TYPE_LABELS.examen, value: makeSection('examen') },
    { name: TYPE_LABELS.projet, value: makeSection('projet') }
  )

  return embed
}

// Met à jour le tableau pour une guilde
async function updateGuildBoard (client, guildId, cfg) {
  const gcfg = cfg[guildId]
  if (!gcfg?.boardChannelId) return

  const channel = await client.channels
    .fetch(gcfg.boardChannelId)
    .catch(() => null)
  if (!channel) return

  const moved = movePastDevoirsToArchive()
  if (moved > 0) {
    console.log(
      `[DevoirBoard] ${moved} élément(s) archivé(s) avant la mise à jour du tableau.`
    )
  }

  const devoirs = readDevoirs()

  const today0 = new Date()
  today0.setHours(0, 0, 0, 0)
  const todayMs = today0.getTime()

  // Filtre les devoirs d'aujourd'hui et après
  const items = devoirs
    .filter(d => d && d.guildId === guildId)
    .map(d => ({ ...d, _date: parseDateSafe(d.date) }))
    .filter(d => d._date && d._date.getTime() >= todayMs)

  // Supprime l'ancien message si existe
  if (gcfg.boardMessageId) {
    await channel.messages
      .fetch(gcfg.boardMessageId)
      .then(msg => msg.delete().catch(() => null))
      .catch(() => null)
  }

  // Envoie le nouveau message
  const embed = buildBoardEmbed(items)
  const sent = await channel.send({ embeds: [embed] })

  // Sauvegarde l'ID du nouveau message
  cfg[guildId].boardMessageId = sent.id
  cfg[guildId].boardLastUpdate = todayKey()
  writeJson(CONFIG_FILE, cfg)
}

// Met à jour les tableaux de toutes les guildes
async function updateAllBoards (client, force = false) {
  const cfg = readJson(CONFIG_FILE, {})
  const key = todayKey()

  for (const guildId of Object.keys(cfg)) {
    const gcfg = cfg[guildId]
    if (!gcfg?.boardChannelId) continue

    // Skip si déjà mis à jour aujourd'hui (sauf si force=true)
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
  setInterval(() => {
    updateAllBoards(client, false).catch(() => null)
  }, 60 * 60 * 1000)

  // Expose une fonction pour forcer la mise à jour
  client.forceDevoirBoardUpdate = () => updateAllBoards(client, true)
}

module.exports = { initDevoirBoard }
