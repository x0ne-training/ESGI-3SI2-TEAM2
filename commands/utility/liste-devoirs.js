const {
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js')
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('liste-devoirs')
    .setDescription('Affiche la liste des devoirs à venir.'),
  emoji: '📚',

  async execute (interaction) {
    const all = readDevoirs()

    if (all.length === 0) {
      return interaction.reply({
        content: 'Aucun devoir enregistré pour l’instant.',
        ephemeral: true
      })
    }

    // On trie par date croissante des devoirs 
    const devoirs = [...all].sort((a, b) => {
      const da = new Date(a.date)
      const db = new Date(b.date)
      if (isNaN(da) || isNaN(db)) return 0
      return da - db
    })

    const max = 20
    const slice = devoirs.slice(0, max)

    const description = slice
      .map((d, i) => {
        return (
          `**${i + 1}. ${d.titre}**\n` +
          `📅 ${d.date}\n` +
          (d.description ? `📝 ${d.description}\n` : '') +
          `\u200b`
        )
      })
      .join('\n')

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('📚 Devoirs enregistrés')
      .setDescription(description)
      .setFooter({
        text:
          slice.length < devoirs.length
            ? `Affichage des ${slice.length} premiers devoirs (sur ${devoirs.length})`
            : 'Tous les devoirs sont affichés'
      })
      .setTimestamp()

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    })
  }
}
