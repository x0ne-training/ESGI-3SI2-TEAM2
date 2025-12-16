const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('supprimer-devoir')
    .setDescription('Supprime un devoir ou un examen via une liste.')
    .addStringOption(option =>
      option
        .setName('devoir')
        .setDescription('Choisis le devoir/examen à supprimer')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  emoji: '❌',

  async execute (interaction) {
    const value = interaction.options.getString('devoir', true)
    const id = Number(value)

    if (isNaN(id)) {
      return interaction.reply({
        content: '❌ Devoir invalide.',
        flags: 64
      })
    }

    const devoirs = readDevoirs()
    const target = devoirs.find(d => d.id === id)

    if (!target) {
      return interaction.reply({
        content: '❌ Aucun devoir/examen trouvé avec cette valeur.',
        flags: 64
      })
    }

    const updated = devoirs.filter(d => d.id !== id)
    writeDevoirs(updated)

    const type = target.type || 'devoir'

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🗑️ Suppression effectuée')
      .setDescription(
        `L'élément suivant a été supprimé :\n\n` +
          `**${target.titre}**\n` +
          `📅 ${target.date}\n` +
          `🗂️ ${type}`
      )
      .setTimestamp()
      .setFooter({
        text: 'Bot Discord 3SIB',
        iconURL: interaction.client.user.displayAvatarURL()
      })

    await interaction.reply({
      embeds: [embed],
      flags : 64
    })
  },

  async autocomplete (interaction) {
    const focused = interaction.options.getFocused()
    const devoirs = readDevoirs()

    devoirs.sort((a, b) => {
      const da = new Date(a.date)
      const db = new Date(b.date)
      if (isNaN(da) || isNaN(db)) return 0
      return da - db
    })

    const filtered = devoirs.filter((d, index) => {
      const txt = `${index + 1} ${d.titre} ${d.date}`.toLowerCase()
      return txt.includes(focused.toLowerCase())
    })

    const choices = filtered.slice(0, 25).map((d, index) => {
      const labelIndex = index + 1
      const typeLabel = d.type === 'examen' ? 'Examen' : 'Devoir'
      return {
        name: `${labelIndex}. [${typeLabel}] ${d.titre} – ${d.date}`,
        value: String(d.id)
      }
    })

    await interaction.respond(choices)
  }
}
