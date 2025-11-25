const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(__dirname, '../../data/devoirs.json')

// Lecture des devoirs + type par défaut pour les anciens 🧑‍🦳
function readDevoirs () {
  if (!fs.existsSync(DATA_FILE)) return []
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    if (!Array.isArray(data)) return []
    return data.map(d => ({
      type: 'devoir',
      ...d,
      type: d.type || 'devoir' // anciens enregistrements -> "devoir"
    }))
  } catch (e) {
    console.error('Erreur lecture devoirs.json :', e)
    return []
  }
}

const TYPE_LABELS = {
  devoir: 'Devoir',
  examen: 'Examen'
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('liste-devoirs')
    .setDescription('Affiche la liste des devoirs / examens.')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Filtrer par type')
        .setRequired(false)
        .addChoices(
          { name: 'devoir', value: 'devoir' },
          { name: 'examen', value: 'examen' }
        )
    ),
  emoji: '📚',

  async execute (interaction) {
    const filterType = interaction.options.getString('type') || null
    let devoirs = readDevoirs()

    if (filterType) {
      devoirs = devoirs.filter(d => d.type === filterType)
    }

    if (devoirs.length === 0) {
      return interaction.reply({
        content: '📭 Aucun élément correspondant n’a été trouvé.',
        ephemeral: true
      })
    }

    // Tri par date
    devoirs.sort((a, b) => {
      const da = new Date(a.date)
      const db = new Date(b.date)
      if (isNaN(da) || isNaN(db)) return 0
      return da - db
    })

    const max = 20
    const slice = devoirs.slice(0, max)

    const desc = slice
      .map((d, i) => {
        const label = TYPE_LABELS[d.type] || 'Devoir'
        return (
          `**${i + 1}. ${d.titre}** (${label})\n` +
          `📅 ${d.date}\n` +
          (d.description ? `📝 ${d.description}\n` : '') +
          `\u200b`
        )
      })
      .join('\n')

    const title =
      filterType && TYPE_LABELS[filterType]
        ? `📚 ${TYPE_LABELS[filterType]}s`
        : '📚 Devoirs / Examens'

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(title)
      .setDescription(desc)
      .setFooter({
        text:
          slice.length < devoirs.length
            ? `Affichage des ${slice.length} premiers éléments (sur ${devoirs.length})`
            : 'Tous les éléments sont affichés'
      })
      .setTimestamp()

    await interaction.reply({
      embeds: [embed],
      flags : 64 // j'adore le fait que j'ai corrigé l'autre programme en remplaçant embed par flags mais que j'ai fait la même erreur sans m'en rendre compte juste après 💀
    })
  }
}
