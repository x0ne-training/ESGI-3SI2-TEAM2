const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(__dirname, '../../data/devoirs.json')
const CONFIG_FILE = path.join(__dirname, '../../data/devoirs-config.json')

// Lecture / écriture des devoirs
function readDevoirs () {
  if (!fs.existsSync(DATA_FILE)) return []
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    if (!Array.isArray(data)) return []
    return data.map(d => ({
      type: d.type || 'devoir',
      guildId: d.guildId || null,
      channelId: d.channelId || null,
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

// Config des rôles de mention
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

function getGuildMentionConfig (guildId) {
  const cfg = readConfig()
  return cfg[guildId] || { roleId: null }
}

const TYPE_LABELS = {
  devoir: 'Devoir',
  examen: 'Examen'
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

    const is7d = kind === '7d'

    const embed = new EmbedBuilder()
      .setColor(is7d ? 0xf1c40f : 0xe74c3c)
      .setTitle(`📢 Rappel ${typeLabel}`)
      .setDescription(
        is7d
          ? `Le ${typeLabel.toLowerCase()} **${
              devoir.titre
            }** est à rendre dans **7 jours** (le ${devoir.date}).`
          : `Le ${typeLabel.toLowerCase()} **${
              devoir.titre
            }** est à rendre **demain** (${devoir.date}).`
      )
      .addFields(
        { name: '📘 Titre', value: devoir.titre },
        { name: '📅 Date limite', value: devoir.date },
        { name: '📝 Description', value: devoir.description || 'Aucune' }
      )
      .setTimestamp()

    const mentionCfg = getGuildMentionConfig(devoir.guildId)
    let content = '@everyone'
    let allowedMentions = { parse: ['everyone'] }

    if (mentionCfg.roleId) {
      content = `<@&${mentionCfg.roleId}>`
      allowedMentions = { roles: [mentionCfg.roleId] }
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
  const devoirs = readDevoirs()
  const now = Date.now()

  for (const devoir of devoirs) {
    const deadline = new Date(devoir.date)
    if (isNaN(deadline)) continue

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
      setTimeout(() => sendReminder(client, devoir, '1d'), r1 - now)
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
        .setName('description')
        .setDescription('Description')
        .setRequired(false)
        .setMaxLength(1000)
    ),
  emoji: '🧾',

  async execute (interaction) {
    const titre = interaction.options.getString('titre', true)
    const dateStr = interaction.options.getString('date', true)
    const type = interaction.options.getString('type', true)
    const description = interaction.options.getString('description') || ''

    // Vérification de la date
    const deadline = new Date(dateStr)
    if (isNaN(deadline.getTime())) {
      return interaction.reply({
        content:
          '❌ Format de date invalide. Utilise le format **AAAA-MM-JJ**.',
        flags: 64
      })
    }

    const devoirs = readDevoirs()
    const newDevoir = {
      id: Date.now(),
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      titre,
      date: dateStr,
      description,
      type
    }
    devoirs.push(newDevoir)
    writeDevoirs(devoirs)

    const typeLabel = TYPE_LABELS[type] || 'Devoir'

    const embed = new EmbedBuilder()
      .setColor(type === 'examen' ? 0x9b59b6 : 0x2ecc71)
      .setTitle(`✅ ${typeLabel} ajouté`)
      .addFields(
        { name: '📘 Titre', value: titre },
        { name: '🗂️ Type', value: typeLabel, inline: true },
        { name: '📅 Date limite', value: dateStr, inline: true },
        { name: '📝 Description', value: description || 'Aucune' },
        { name: '📢 Salon des rappels', value: `<#${interaction.channelId}>` }
      )
      .setTimestamp()
      .setFooter({
        text: 'Bot Discord 3SIB',
        iconURL: interaction.client.user.displayAvatarURL()
      })

    await interaction.reply({
      embeds: [embed],
      flags: 64
    })

    // Programmation des rappels pour CE devoir uniquement (j'en ai marre de cette fonctionnalité 😭)
    const now = Date.now()

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
        () => sendReminder(interaction.client, newDevoir, '1d'),
        r1 - now
      )
    }
  },

  scheduleReminders
}
