const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js')
const devoirsService = require('../../services/devoirsService')
const { isFeatureEnabled } = require('../../services/guildConfig')

const { TYPE_LABELS, IMPORTANCE_LABELS } = devoirsService

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anciens-devoirs')
    .setDescription(
      'Affiche les devoirs / examens / projets dont la date est dépassée pour ce serveur.'
    )
    .setContexts(['Guild']),
  emoji: '📜',

  async execute (interaction) {
    if (!isFeatureEnabled(interaction.guildId, 'homework')) {
      return interaction.reply({
        content: '❌ Le système de devoirs est désactivé sur ce serveur.',
        flags: MessageFlags.Ephemeral
      })
    }

    const moved = devoirsService.movePastDevoirsToArchive()
    if (moved > 0) {
      console.log(`Archivage : ${moved} devoir(s) déplacé(s) vers l’archive.`)
    }

    const archived = devoirsService.listArchived(interaction.guildId)

    if (archived.length === 0) {
      return interaction.reply({
        content: '📭 Aucun ancien devoir/examen/projet archivé pour ce serveur.',
        flags: MessageFlags.Ephemeral
      })
    }

    const max = 20
    const slice = archived.slice(0, max)

    const desc = slice
      .map((d, i) => {
        const typeLabel = TYPE_LABELS[d.type] || 'Devoir'
        const impLabel = IMPORTANCE_LABELS[d.importance || 'important'] || 'Important'

        return (
          `**${i + 1}. ${d.titre}** (${typeLabel})\n` +
          `📅 ${d.date}\n` +
          `📍 ${impLabel}\n` +
          (d.description ? `📝 ${d.description}\n` : '') +
          `​`
        )
      })
      .join('\n')

    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle('📜 Anciens devoirs / examens / projets (archivés)')
      .setDescription(desc)
      .setFooter({
        text:
          slice.length < archived.length
            ? `Affichage des ${slice.length} premiers éléments (sur ${archived.length})`
            : 'Tous les éléments archivés sont affichés'
      })
      .setTimestamp()

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral
    })
  }
}
