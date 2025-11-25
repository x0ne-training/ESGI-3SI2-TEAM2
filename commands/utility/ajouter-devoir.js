const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(__dirname, '../../data/devoirs.json')

// Lecture / écriture des devoirs
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

const TYPE_LABELS = {
  devoir: 'Devoir',
  examen: 'Examen'
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ajouter-devoir')
    .setDescription('Ajoute un devoir ou un examen avec une date limite.')
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
      titre,
      date: dateStr,
      description,
      type
    }
    devoirs.push(newDevoir)
    writeDevoirs(devoirs)

    const label = TYPE_LABELS[type] || 'Devoir'

    const embed = new EmbedBuilder()
      .setColor(type === 'examen' ? 0x9b59b6 : 0x2ecc71)
      .setTitle(`✅ ${label} ajouté`)
      .addFields(
        { name: '📘 Titre', value: titre },
        { name: '🗂️ Type', value: label, inline: true },
        { name: '📅 Date limite', value: dateStr, inline: true },
        { name: '📝 Description', value: description || 'Aucune' }
      )
      .setFooter({
        text: 'Bot Discord 3SIB',
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTimestamp()

    await interaction.reply({
      embeds: [embed],
      flags: 64
    })
  }
}
