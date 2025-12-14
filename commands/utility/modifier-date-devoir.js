const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits} = require('discord.js')
const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(__dirname, '../../data/devoirs.json')

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

const TYPE_LABELS = {
  devoir: 'Devoir',
  examen: 'Examen'
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modifier-date-devoir')
    .setDescription('Modifie la date limite d’un devoir ou examen.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(['Guild'])
    .addStringOption(option =>
      option
        .setName('devoir')
        .setDescription('Choisis le devoir/examen à modifier')
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
      return interaction.reply({
        content: '❌ Devoir invalide.',
        flags: 64
      })
    }

    const newDate = new Date(newDateStr)
    if (isNaN(newDate.getTime())) {
      return interaction.reply({
        content:
          '❌ Format de date invalide. Utilise le format **AAAA-MM-JJ**.',
        flags: 64
      })
    }

    const devoirs = readDevoirs()
    const index = devoirs.findIndex(d => d.id === devoirId)

    if (index === -1) {
      return interaction.reply({
        content: '❌ Aucun devoir/examen trouvé avec cet identifiant.',
        flags: 64
      })
    }

    const old = { ...devoirs[index] }
    devoirs[index].date = newDateStr

    writeDevoirs(devoirs)

    const typeLabel = TYPE_LABELS[devoirs[index].type] || 'Devoir'

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🗓️ Date de devoir modifiée')
      .setDescription(
        `La date du ${typeLabel.toLowerCase()} **${
          devoirs[index].titre
        }** a été mise à jour.`
      )
      .addFields(
        {
          name: 'Ancienne date',
          value: old.date || 'Inconnue',
          inline: true
        },
        {
          name: 'Nouvelle date',
          value: newDateStr,
          inline: true
        }
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
  },

  // Autocomplete pour choisir le devoir
  async autocomplete (interaction) {
    const focused = interaction.options.getFocused().toLowerCase()
    const guildId = interaction.guildId

    const devoirs = readDevoirs()
      .filter(d => d.guildId === guildId)
      .sort((a, b) => {
        const da = new Date(a.date)
        const db = new Date(b.date)
        if (isNaN(da) || isNaN(db)) return 0
        return da - db
      })

    const choices = devoirs
      .filter(d => d.titre.toLowerCase().includes(focused))
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
