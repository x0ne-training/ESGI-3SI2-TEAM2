const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js')
const devoirsService = require('../../services/devoirsService')
const { isFeatureEnabled } = require('../../services/guildConfig')

const { TYPE_LABELS, IMPORTANCE_LABELS } = devoirsService

module.exports = {
  data: new SlashCommandBuilder()
    .setName('liste-devoirs')
    .setDescription('Affiche la liste des devoirs / examens / projets numérotés.')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Filtrer par type')
        .setRequired(false)
        .addChoices(
          { name: 'devoir', value: 'devoir' },
          { name: 'examen', value: 'examen' },
          { name: 'projet', value: 'projet' }
        )
    ),
  emoji: '📚',

  async execute (interaction) {
    if (interaction.guildId && !isFeatureEnabled(interaction.guildId, 'homework')) {
      return interaction.reply({
        content: '❌ Le système de devoirs est désactivé sur ce serveur.',
        flags: MessageFlags.Ephemeral
      })
    }

    const filterType = interaction.options.getString('type') || null
    const devoirs = devoirsService.listDevoirs({ guildId: interaction.guildId, type: filterType })

    if (devoirs.length === 0) {
      return interaction.reply({
        content: '📭 Aucun élément correspondant n’a été trouvé.',
        flags: MessageFlags.Ephemeral
      })
    }

    const max = 20
    const slice = devoirs.slice(0, max)

    const desc = slice
      .map((d, i) => {
        const num = i + 1
        const typeLabel = TYPE_LABELS[d.type] || 'Devoir'
        const impLabel = IMPORTANCE_LABELS[d.importance || 'important'] || 'Important'

        return (
          `**${num}. ${d.titre}** (${typeLabel})\n` +
          `📅 ${d.date}\n` +
          `📍 ${impLabel}\n` +
          (d.description ? `📝 ${d.description}\n` : '') +
          `\u200b`
        )
      })
      .join('\n')

    const title = filterType
      ? `📚 ${TYPE_LABELS[filterType]}s`
      : '📚 Devoirs / Examens / Projets'

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
      flags: MessageFlags.Ephemeral
    })
  }
}
