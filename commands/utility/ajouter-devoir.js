const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')
const path = require('path')

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
    fs.writeFileSync(
      ARCHIVE_FILE,
      JSON.stringify(list, null, 2),
      'utf-8'
    )
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

function writeConfig (cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8')
  } catch (e) {
    console.error('Erreur écriture devoirs-config.json :', e)
  }
}

function getGuildConfig (guildId) {
  const cfg = readConfig()
  const raw = cfg[guildId] || {}
  return {
    roleId: raw.roleId || null,
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
  examen: 'Examen'
}

const IMPORTANCE_LABELS = {
  faible: 'Peu important',
  important: 'Important',
  tres_important: 'Très important'
}

const IMPORTANCE_EMOJIS = {
  faible: '🟢',
  important: '🟠',
  tres_important: '🔴'
}

function getReminderColor (importance, kind) {
  const imp = importance || 'important'
  let color =
    imp === 'tres_important'
      ? 0xe74c3c
      : imp === 'faible'
        ? 0x95a5a6
        : 0xf39c12

  if (kind === '7d' && imp !== 'tres_important') {
    color = 0xf1c40f
  }
  return color
}

// Rappels
async function sendReminder (client, devoir, kind) {
  try {
    if (!devoir.channelId || !devoir.guildId) return

    const channel = await client.channels
      .fetch(devoir.channelId)
      .catch(() => null)
    if (!channel) return

    const typeLabel = TYPE_LABELS[devoir.type] || 'Devoir'

    const impKey = devoir.importance || 'important'
    const impLabel = IMPORTANCE_LABELS[impKey] || 'Important'
    const impEmoji = IMPORTANCE_EMOJIS[impKey] || '🟠'

    let description
    if (kind === '7d') {
      description = `Le ${typeLabel.toLowerCase()} **${
        devoir.titre
      }** est à rendre dans **7 jours** (le ${devoir.date}).`
    } else if (kind === '1d-morning' || kind === '1d-evening') {
      description = `Le ${typeLabel.toLowerCase()} **${
        devoir.titre
      }** est à rendre **demain** (${devoir.date}).`
    } else {
      description = `Rappel pour le ${typeLabel.toLowerCase()} **${
        devoir.titre
      }** (échéance le ${devoir.date}).`
    }

    const embed = new EmbedBuilder()
      .setColor(getReminderColor(impKey, kind))
      .setTitle(`${impEmoji} 📢 Rappel ${typeLabel}`)
      .setDescription(description)
      .addFields(
        { name: '📘 Titre', value: devoir.titre },
        { name: '📅 Date limite', value: devoir.date },
        { name: '📍 Importance', value: impLabel, inline: true },
        { name: '📝 Description', value: devoir.description || 'Aucune' }
      )
      .setTimestamp()

    const guildCfg = getGuildConfig(devoir.guildId)
    let content = '@everyone'
    let allowedMentions = { parse: ['everyone'] }

    if (guildCfg.roleId) {
      content = `<@&${guildCfg.roleId}>`
      allowedMentions = { roles: [guildCfg.roleId] }
    }

    await channel.send({
      content,
      embeds: [embed],
      allowedMentions
    })

    console.log(
      `Rappel (${kind}) envoyé pour ${devoir.titre} dans #${channel.id}`
    )
  } catch (err) {
    console.error('Erreur lors de l’envoi d’un rappel :', err)
  }
}

// juste la fonction qui gère tous les rappels au démarrage
function scheduleReminders (client) {
  movePastDevoirsToArchive()

  const devoirs = readDevoirs()
  const now = Date.now()

  for (const devoir of devoirs) {
    const deadline = new Date(devoir.date)
    if (isNaN(deadline)) continue

    const deadlineMs = deadline.getTime()

    const d7 = new Date(deadline)
    d7.setDate(d7.getDate() - 7)
    d7.setHours(8, 0, 0, 0)
    const r7 = d7.getTime()

    const d1 = new Date(deadline)
    d1.setDate(d1.getDate() - 1)
    d1.setHours(8, 0, 0, 0)
    const r1 = d1.getTime()

    if (r7 > now) {
      setTimeout(() => sendReminder(client, devoir, '7d'), r7 - now)
    }
    if (r1 > now) {
      setTimeout(() => sendReminder(client, devoir, '1d-morning'), r1 - now)
    }

    const guildCfg = getGuildConfig(devoir.guildId || '')
    const timings = [
      ...(Array.isArray(guildCfg.customTimings) ? guildCfg.customTimings : []),
      ...(Array.isArray(devoir.customTimings) ? devoir.customTimings : [])
    ]

    if (Array.isArray(timings)) {
      for (const t of timings) {
        if (!t || typeof t.offsetMs !== 'number') continue
        const trigger = deadlineMs - t.offsetMs
        if (trigger > now) {
          setTimeout(
            () =>
              sendReminder(
                client,
                devoir,
                `custom-${t.label || t.offsetMs.toString()}`
              ),
            trigger - now
          )
        }
      }
    }
  }

  console.log(
    `Programmation des rappels terminée pour ${devoirs.length} éléments.`
  )
}

// Commande

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ajouter-devoir')
    .setDescription('Ajoute un devoir ou un examen avec rappels J-7 et J-1.')
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
        .setDescription('Type : devoir ou examen')
        .setRequired(true)
        .addChoices(
          { name: 'devoir', value: 'devoir' },
          { name: 'examen', value: 'examen' }
        )
    )
    .addStringOption(option =>
      option
        .setName('importance')
        .setDescription('Priorité : peu important / important / très important')
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
    const importance = interaction.options.getString('importance') || 'important'
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
        perDevoirTimings.push({
          label: p,
          offsetMs: off
        })
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

    const typeLabel = TYPE_LABELS[type] || 'Devoir'
    const impLabel = IMPORTANCE_LABELS[importance] || 'Important'
    const impEmoji = IMPORTANCE_EMOJIS[importance] || '🟠'

    const embed = new EmbedBuilder()
      .setColor(type === 'examen' ? 0x9b59b6 : 0x2ecc71)
      .setTitle(`✅ ${typeLabel} ajouté`)
      .addFields(
        { name: '📘 Titre', value: titre },
        { name: '🗂️ Type', value: typeLabel, inline: true },
        { name: '📍 Importance', value: `${impEmoji} ${impLabel}`, inline: true },
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

    await interaction.reply({
      embeds: [embed],
      flags: 64
    })

    // Programmation des rappels pour CE devoir uniquement (j'en ai marre de cette fonctionnalité 😭)
    const now = Date.now()
    const deadlineMs = deadline.getTime()

    const d7 = new Date(deadline)
    d7.setDate(d7.getDate() - 7)
    d7.setHours(8, 0, 0, 0)
    const r7 = d7.getTime()

    const d1 = new Date(deadline)
    d1.setDate(d1.getDate() - 1)
    d1.setHours(8, 0, 0, 0)
    const r1 = d1.getTime()

    if (r7 > now) {
      setTimeout(
        () => sendReminder(interaction.client, newDevoir, '7d'),
        r7 - now
      )
    }
    if (r1 > now) {
      setTimeout(
        () => sendReminder(interaction.client, newDevoir, '1d-morning'),
        r1 - now
      )
    }

    const guildCfg = getGuildConfig(newDevoir.guildId || '')
    const timings = [
      ...(Array.isArray(guildCfg.customTimings) ? guildCfg.customTimings : []),
      ...perDevoirTimings
    ]

    if (Array.isArray(timings)) {
      for (const t of timings) {
        if (!t || typeof t.offsetMs !== 'number') continue
        const trigger = deadlineMs - t.offsetMs
        if (trigger > now) {
          setTimeout(
            () =>
              sendReminder(
                interaction.client,
                newDevoir,
                `custom-${t.label || t.offsetMs.toString()}`
              ),
            trigger - now
          )
        }
      }
    }
  },

  scheduleReminders
}
