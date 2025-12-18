const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(__dirname, '../../data/devoirs.json')
const ARCHIVE_FILE = path.join(__dirname, '../../data/devoirs-archives.json')

const TYPE_LABELS = {
  devoir: 'Devoir',
  examen: 'Examen',
  projet: 'Projet'
}

const IMPORTANCE_LABELS = {
  faible: 'Peu important',
  important: 'Important',
  tres_important: 'Très important'
}

// Lecture / écriture devoirs actuels
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

// Lecture / écriture archive
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

// Déplace tous les devoirs passés dans l’archive
function movePastDevoirsToArchive () {
  const now = new Date()
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime()

  const current = readDevoirs()
  const archived = readArchive()

  const alreadyIds = new Set(archived.map(d => d.id))

  const stillCurrent = []
  const toArchive = []

  for (const d of current) {
    const dDate = new Date(d.date)
    if (isNaN(dDate.getTime())) {
      stillCurrent.push(d)
      continue
    }

    if (dDate.getTime() < todayMidnight) {
      if (!alreadyIds.has(d.id)) {
        toArchive.push(d)
      }
    } else {
      stillCurrent.push(d)
    }
  }

  if (toArchive.length > 0) {
    writeDevoirs(stillCurrent)
    writeArchive([...archived, ...toArchive])
  }

  return { moved: toArchive.length }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anciens-devoirs')
    .setDescription(
      'Affiche les devoirs / examens / projets dont la date est dépassée pour ce serveur.'
    )
    .setContexts(['Guild']),
  emoji: '📜',

  async execute (interaction) {
    const { moved } = movePastDevoirsToArchive()
    if (moved > 0) {
      console.log(`Archivage : ${moved} devoir(s) déplacé(s) vers l’archive.`)
    }

    const guildId = interaction.guildId
    const archived = readArchive().filter(d => d.guildId === guildId)

    if (archived.length === 0) {
      return interaction.reply({
        content: '📭 Aucun ancien devoir/examen/projet archivé pour ce serveur.',
        flags: 64
      })
    }

    archived.sort((a, b) => {
      const da = new Date(a.date)
      const db = new Date(b.date)
      if (isNaN(da) || isNaN(db)) return 0
      return db - da
    })

    const max = 20
    const slice = archived.slice(0, max)

    const desc = slice
      .map((d, i) => {
        const typeLabel = TYPE_LABELS[d.type] || 'Devoir'
        const impLabel = IMPORTANCE_LABELS[d.importance || 'important'] || 'Important'

        return (
          `**${i + 1}. ${d.titre}** (${typeLabel})\n` +
          `📅 ${d.date}\n` +
          `📍 ${impLabel}\n` +
          (d.description ? `📝 ${d.description}\n` : '') +
          `\u200b`
        )
      })
      .join('\n')

    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle('📜 Anciens devoirs / examens / projets (archivés)')
      .setDescription(desc)
      .setFooter({
        text:
          slice.length < archived.length
            ? `Affichage des ${slice.length} premiers éléments (sur ${archived.length})`
            : 'Tous les éléments archivés sont affichés'
      })
      .setTimestamp()

    await interaction.reply({
      embeds: [embed],
      flags: 64
    })
  }
}
