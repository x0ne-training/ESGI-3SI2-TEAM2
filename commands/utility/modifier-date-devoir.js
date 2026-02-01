const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js')
const fs = require('fs')
const path = require('path')

const { cancelByDevoirId, addMany } = require('../../services/remindersStore')

const DATA_FILE = path.join(__dirname, '../../data/devoirs.json')
const CONFIG_FILE = path.join(__dirname, '../../data/devoirs-config.json')

// Lecture des devoirs
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

// Écriture
function writeDevoirs (list) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8')
  } catch (e) {
    console.error('Erreur écriture devoirs.json :', e)
  }
}

// Lecture config serveur
function readConfig () {
  if (!fs.existsSync(CONFIG_FILE)) return {}
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    return data && typeof data === 'object' ? data : {}
  } catch (e) {
    console.error('Erreur lecture devoirs-config.json :', e)
    return {}
  }
}

function getGuildConfig (guildId) {
  const cfg = readConfig()
  const g = cfg[guildId] || {}
  return {
    roleId: g.roleId || null,
    reminderChannelId: g.reminderChannelId || null,
    customTimings: Array.isArray(g.customTimings) ? g.customTimings : []
  }
}

// Parsing date fiable (évite pièges UTC de "YYYY-MM-DD")
function parseDateYYYYMMDD (dateStr) {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null
  const [y, m, d] = parts
  const dt = new Date(y, m - 1, d)
  return Number.isNaN(dt.getTime()) ? null : dt
}

// Génère les rappels persistants (Option A : config d’abord, fallback salon d’origine)
function buildRemindersForDevoir (devoir) {
  const now = Date.now()

  const deadline = parseDateYYYYMMDD(devoir.date)
  if (!deadline) return []

  // Le devoir garde le salon d’origine (fallback)
  const sourceChannelId = devoir.channelId
  if (!sourceChannelId) return []

  const deadlineMs = deadline.getTime()
  const guildCfg = getGuildConfig(devoir.guildId || '')

  // On NE fixe PAS le salon cible ici.
  // Le runner fera: cfg.reminderChannelId || sourceChannelId || (ancien channelId si existant)
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
      type: devoir.type || 'devoir',
      importance: devoir.importance || 'important',
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
      type: devoir.type || 'devoir',
      importance: devoir.importance || 'important',
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
      type: devoir.type || 'devoir',
      importance: devoir.importance || 'important',
      date: devoir.date,
      description: devoir.description || '',
      remindAtISO: new Date(trigger).toISOString()
    })
  }

  return reminders
}

const TYPE_LABELS = {
  devoir: 'Devoir',
  examen: 'Examen',
  projet: 'Projet'
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modifier-date-devoir')
    .setDescription('Modifie la date limite d’un devoir, examen ou projet.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(['Guild'])
    .addStringOption(option =>
      option
        .setName('devoir')
        .setDescription('Choisis le devoir/examen/projet à modifier')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Nouvelle date limite (format AAAA-MM-JJ)')
        .setRequired(true)
    ),
  emoji: '🗓️',

  async execute (interaction) {
    const devoirIdStr = interaction.options.getString('devoir', true)
    const newDateStr = interaction.options.getString('date', true)

    const devoirId = Number(devoirIdStr)
    if (isNaN(devoirId)) {
      return interaction.reply({ content: '❌ Devoir invalide.', flags: 64 })
    }

    const newDate = parseDateYYYYMMDD(newDateStr)
    if (!newDate) {
      return interaction.reply({
        content: '❌ Format de date invalide. Utilise **AAAA-MM-JJ**.',
        flags: 64
      })
    }

    const devoirs = readDevoirs()
    const index = devoirs.findIndex(d => d.id === devoirId)

    if (index === -1) {
      return interaction.reply({
        content: '❌ Aucun devoir/examen/projet trouvé avec cet identifiant.',
        flags: 64
      })
    }

    const old = { ...devoirs[index] }
    devoirs[index].date = newDateStr

    writeDevoirs(devoirs)

    // ✅ IMPORTANT : rebuild des rappels persistants pour CE devoir
    cancelByDevoirId(devoirId)
    const updatedDevoir = devoirs[index]
    const reminders = buildRemindersForDevoir(updatedDevoir)
    if (reminders.length > 0) addMany(reminders)

    const typeLabel = TYPE_LABELS[updatedDevoir.type] || 'Devoir'

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🗓️ Date modifiée')
      .setDescription(
        `La date du ${typeLabel.toLowerCase()} **${
          updatedDevoir.titre
        }** a été mise à jour.`
      )
      .addFields(
        { name: 'Ancienne date', value: old.date || 'Inconnue', inline: true },
        { name: 'Nouvelle date', value: newDateStr, inline: true },
        {
          name: '🔔 Rappels persistants',
          value:
            reminders.length > 0
              ? `Recréés: ${reminders.length} rappel(s)`
              : 'Aucun (date trop proche ou passée, ou salon d’origine manquant)'
        }
      )
      .setTimestamp()
      .setFooter({
        text: 'Bot Discord 3SIB',
        iconURL: interaction.client.user.displayAvatarURL()
      })

    await interaction.reply({ embeds: [embed], flags: 64 })
  },

  // Autocomplete pour choisir le devoir
  async autocomplete (interaction) {
    const focused = interaction.options.getFocused().toLowerCase()
    const guildId = interaction.guildId

    const devoirs = readDevoirs()
      .filter(d => d.guildId === guildId)
      .sort((a, b) => {
        const da = parseDateYYYYMMDD(a.date)
        const db = parseDateYYYYMMDD(b.date)
        if (!da || !db) return 0
        return da - db
      })

    const choices = devoirs
      .filter(d => (d.titre || '').toLowerCase().includes(focused))
      .slice(0, 25)
      .map((d, index) => {
        const typeLabel = TYPE_LABELS[d.type] || 'Devoir'
        return {
          name: `${index + 1}. [${typeLabel}] ${d.titre} – ${d.date}`,
          value: String(d.id)
        }
      })

    await interaction.respond(choices)
  }
}
