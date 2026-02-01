// commands/utility/ajouter-devoir.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')
const path = require('path')

const { addMany, cancelByDevoirId } = require('../../services/remindersStore')

const DATA_FILE = path.join(__dirname, '../../data/devoirs.json')
const CONFIG_FILE = path.join(__dirname, '../../data/devoirs-config.json')
const ARCHIVE_FILE = path.join(__dirname, '../../data/devoirs-archives.json')

// Lecture / écriture des devoirs
function readDevoirs () {
  if (!fs.existsSync(DATA_FILE)) return []
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    if (!Array.isArray(data)) return []
    return data.map(d => ({
      type: d.type || 'devoir',
      importance: d.importance || 'important',
      guildId: d.guildId || null,
      channelId: d.channelId || null,
      customTimings: Array.isArray(d.customTimings) ? d.customTimings : [],
      ...d
    }))
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

  console.log(`${toArchive.length} devoir(s) archivé(s).`)
}

// Config des rôles de mention + timings serveur
function readConfig () {
  if (!fs.existsSync(CONFIG_FILE)) return {}
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    return typeof data === 'object' && data !== null ? data : {}
  } catch (e) {
    console.error('Erreur lecture devoirs-config.json :', e)
    return {}
  }
}

function getGuildConfig (guildId) {
  const cfg = readConfig()
  const raw = cfg[guildId] || {}
  return {
    roleId: raw.roleId || null,
    reminderChannelId: raw.reminderChannelId || null,
    customTimings: Array.isArray(raw.customTimings) ? raw.customTimings : []
  }
}

// convertit "3j", "12h", "1h30", "45m" -> ms
function parseOffset (str) {
  if (!str) return null
  str = str.toLowerCase().replace(/\s+/g, '')

  let total = 0

  const days = str.match(/(\d+)j/)
  if (days) total += parseInt(days[1]) * 24 * 60 * 60 * 1000

  const hours = str.match(/(\d+)h/)
  if (hours) total += parseInt(hours[1]) * 60 * 60 * 1000

  const mins = str.match(/(\d+)m/)
  if (mins) total += parseInt(mins[1]) * 60 * 1000

  if (total <= 0) return null
  return total
}

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

// Génère les reminders pour un devoir, sous forme d’objets JSON persistants
function buildRemindersForDevoir (devoir) {
  const now = Date.now()
  const deadline = new Date(devoir.date)
  if (isNaN(deadline.getTime())) return []

  const deadlineMs = deadline.getTime()

  const guildCfg = getGuildConfig(devoir.guildId || '')
  const sourceChannelId = devoir.channelId
  if (!sourceChannelId) return []

  const reminders = []

  // J-7 à 08:00
  const d7 = new Date(deadline)
  d7.setDate(d7.getDate() - 7)
  d7.setHours(8, 0, 0, 0)
  if (d7.getTime() > now) {
    reminders.push({
      guildId: devoir.guildId,
      sourceChannelId,
      devoirId: devoir.id,
      kind: '7d',
      title: devoir.titre,
      type: devoir.type,
      importance: devoir.importance,
      date: devoir.date,
      description: devoir.description || '',
      remindAtISO: d7.toISOString()
    })
  }

  // J-1 à 08:00
  const d1 = new Date(deadline)
  d1.setDate(d1.getDate() - 1)
  d1.setHours(8, 0, 0, 0)
  if (d1.getTime() > now) {
    reminders.push({
      guildId: devoir.guildId,
      sourceChannelId,
      devoirId: devoir.id,
      kind: '1d-morning',
      title: devoir.titre,
      type: devoir.type,
      importance: devoir.importance,
      date: devoir.date,
      description: devoir.description || '',
      remindAtISO: d1.toISOString()
    })
  }

  // Timings custom (serveur + devoir)
  const timings = [
    ...(Array.isArray(guildCfg.customTimings) ? guildCfg.customTimings : []),
    ...(Array.isArray(devoir.customTimings) ? devoir.customTimings : [])
  ]

  for (const t of timings) {
    if (!t || typeof t.offsetMs !== 'number') continue
    const trigger = deadlineMs - t.offsetMs
    if (trigger <= now) continue

    reminders.push({
      guildId: devoir.guildId,
      sourceChannelId,
      devoirId: devoir.id,
      kind: `custom-${t.label || t.offsetMs.toString()}`,
      title: devoir.titre,
      type: devoir.type,
      importance: devoir.importance,
      date: devoir.date,
      description: devoir.description || '',
      remindAtISO: new Date(trigger).toISOString()
    })
  }

  return reminders
}

// remplace l’ancien scheduleReminders (setTimeout) par “rebuild reminders” (JSON)
function scheduleReminders (client) {
  movePastDevoirsToArchive()

  const devoirs = readDevoirs()
  let createdCount = 0

  for (const devoir of devoirs) {
    // on annule les pending existants de ce devoir, puis on recrée
    cancelByDevoirId(devoir.id)
    const reminders = buildRemindersForDevoir(devoir)
    if (reminders.length > 0) {
      addMany(reminders)
      createdCount += reminders.length
    }
  }

  console.log(
    `✅ Reminders JSON rebuild: ${createdCount} rappel(s) pending créé(s) pour ${devoirs.length} élément(s).`
  )
}

// Commande
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ajouter-devoir')
    .setDescription(
      'Ajoute un devoir, un examen ou un projet avec rappels J-7 et J-1.'
    )
    .addStringOption(option =>
      option
        .setName('titre')
        .setDescription('Titre')
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Date limite (format AAAA-MM-JJ)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type : devoir, examen ou projet')
        .setRequired(true)
        .addChoices(
          { name: 'devoir', value: 'devoir' },
          { name: 'examen', value: 'examen' },
          { name: 'projet', value: 'projet' }
        )
    )
    .addStringOption(option =>
      option
        .setName('importance')
        .setDescription(
          'Importance : peu important / important / très important'
        )
        .setRequired(false)
        .addChoices(
          { name: 'peu important', value: 'faible' },
          { name: 'important', value: 'important' },
          { name: 'très important', value: 'tres_important' }
        )
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Description')
        .setRequired(false)
        .setMaxLength(1000)
    )
    .addStringOption(option =>
      option
        .setName('timings')
        .setDescription("Timings custom pour CE devoir (ex: '3j,12h,45m')")
        .setRequired(false)
    ),
  emoji: '🧾',

  async execute (interaction) {
    const titre = interaction.options.getString('titre', true)
    const dateStr = interaction.options.getString('date', true)
    const type = interaction.options.getString('type', true)
    const importance =
      interaction.options.getString('importance') || 'important'
    const description = interaction.options.getString('description') || ''
    const timingsStr = interaction.options.getString('timings') || ''

    // Vérification de la date
    const deadline = new Date(dateStr)
    if (isNaN(deadline.getTime())) {
      return interaction.reply({
        content:
          '❌ Format de date invalide. Utilise le format **AAAA-MM-JJ**.',
        flags: 64
      })
    }

    movePastDevoirsToArchive()

    let perDevoirTimings = []
    if (timingsStr.trim().length > 0) {
      const parts = timingsStr
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
      for (const p of parts) {
        const off = parseOffset(p)
        if (!off) {
          return interaction.reply({
            content: `❌ Timing invalide : \`${p}\` (ex attendus : 3j, 12h, 45m, 1h30).`,
            flags: 64
          })
        }
        perDevoirTimings.push({ label: p, offsetMs: off })
      }
    }

    const devoirs = readDevoirs()
    const newDevoir = {
      id: Date.now(),
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      titre,
      date: dateStr,
      description,
      type,
      importance,
      customTimings: perDevoirTimings
    }
    devoirs.push(newDevoir)
    writeDevoirs(devoirs)

    // Création des rappels persistants (JSON), pas de setTimeout
    cancelByDevoirId(newDevoir.id)
    const remindersToCreate = buildRemindersForDevoir(newDevoir)
    if (remindersToCreate.length > 0) addMany(remindersToCreate)

    const typeLabel = TYPE_LABELS[type] || 'Devoir'
    const impLabel = IMPORTANCE_LABELS[importance] || 'Important'

    const embed = new EmbedBuilder()
      .setColor(
        type === 'examen' ? 0x9b59b6 : type === 'projet' ? 0x3498db : 0x2ecc71
      )
      .setTitle(`✅ ${typeLabel} ajouté`)
      .addFields(
        { name: '📘 Titre', value: titre },
        { name: '🗂️ Type', value: typeLabel, inline: true },
        { name: '📍 Importance', value: impLabel, inline: true },
        { name: '📅 Date limite', value: dateStr, inline: true },
        { name: '📝 Description', value: description || 'Aucune' },
        { name: '📢 Salon des rappels', value: `<#${interaction.channelId}>` }
      )
      .setTimestamp()
      .setFooter({
        text: 'Bot Discord 3SIB',
        iconURL: interaction.client.user.displayAvatarURL()
      })

    if (perDevoirTimings.length > 0) {
      embed.addFields({
        name: '⏱️ Timings personnalisés (pour ce devoir)',
        value: perDevoirTimings.map(t => `• ${t.label}`).join('\n')
      })
    }

    if (remindersToCreate.length > 0) {
      embed.addFields({
        name: '🔔 Rappels programmés (persistants)',
        value: remindersToCreate
          .map(
            r =>
              `• ${r.kind} → ${new Date(r.remindAtISO).toLocaleString('fr-FR')}`
          )
          .join('\n')
      })
    }

    await interaction.reply({
      embeds: [embed],
      flags: 64
    })
  },

  scheduleReminders
}
