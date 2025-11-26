const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(__dirname, '../../data/devoirs.json')

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

const TYPE_LABELS = {
  devoir: 'Devoir',
  examen: 'Examen'
}

// Rappels
async function sendReminder (client, devoir, kind) {
  try {
    if (!devoir.channelId) return
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

    await channel.send({
      content: '@everyone',
      embeds: [embed],
      allowedMentions: { parse: ['everyone'] }
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

    const deadlineMs = deadline.getTime()

    // J-7 à la même heure que la date
    const r7 = deadlineMs - 7 * 24 * 60 * 60 * 1000

    // J-1 à la même heure que la date
    const r1 = deadlineMs - 24 * 60 * 60 * 1000

    // J-1 à 18h45
    const test = new Date(deadline)
    test.setDate(test.getDate() - 1)
    test.setHours(18, 45, 0, 0)
    const rtest = test.getTime()

    if (r7 > now) {
      setTimeout(() => sendReminder(client, devoir, '7d'), r7 - now)
    }
    if (r1 > now) {
      setTimeout(() => sendReminder(client, devoir, '1d'), r1 - now)
    }
    if (rtest > now) {
      setTimeout(() => sendReminder(client, devoir, '1d-test'), rtest - now)
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
    .setDescription(
      'Ajoute un devoir ou un examen avec rappels J-7, J-1.' // ouais ça va ping à minuit si mes calculs sont bons et alors ?
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
    const deadlineMs = deadline.getTime()

    const r7 = deadlineMs - 7 * 24 * 60 * 60 * 1000
    const r1 = deadlineMs - 24 * 60 * 60 * 1000

    const test = new Date(deadline)
    test.setDate(test.getDate() - 1)
    test.setHours(21, 30, 0, 0)
    const rtest = test.getTime()

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
    // if (rtest > now) {
    //   setTimeout(
    //     () => sendReminder(interaction.client, newDevoir, '1d-test'),
    //     rtest - now
    //   )
    // }
  },

  scheduleReminders
}
