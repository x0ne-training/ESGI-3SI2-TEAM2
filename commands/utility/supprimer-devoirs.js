const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits, MessageFlags } = require('discord.js')

const devoirsService = require('../../services/devoirsService')
const { isFeatureEnabled } = require('../../services/guildConfig')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('supprimer-devoir')
    .setDescription('Supprime un devoir, examen ou projet via une liste.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(['Guild'])
    .addStringOption(option =>
      option
        .setName('devoir')
        .setDescription('Choisis le devoir/examen/projet à supprimer')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  emoji: '❌',

  async execute (interaction) {
    if (!isFeatureEnabled(interaction.guildId, 'homework')) {
      return interaction.reply({
        content: '❌ Le système de devoirs est désactivé sur ce serveur.',
        flags: MessageFlags.Ephemeral
      })
    }

    const value = interaction.options.getString('devoir', true)
    const id = Number(value)

    if (isNaN(id)) {
      return interaction.reply({ content: '❌ Devoir invalide.', flags: MessageFlags.Ephemeral })
    }

    const result = devoirsService.deleteDevoir(id)
    if (!result.ok) {
      return interaction.reply({
        content: `❌ ${result.error}`,
        flags: MessageFlags.Ephemeral
      })
    }

    const { devoir: target, cancelledCount } = result
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
      .addFields({
        name: '🔕 Rappels persistants',
        value: `${cancelledCount} rappel(s) annulé(s)`
      })
      .setTimestamp()
      .setFooter({
        text: 'Bot Discord 3SIB',
        iconURL: interaction.client.user.displayAvatarURL()
      })

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
  },

  async autocomplete (interaction) {
    const focused = interaction.options.getFocused().toLowerCase()
    const devoirs = devoirsService.readDevoirs()

    devoirs.sort((a, b) => {
      const da = new Date(a.date)
      const db = new Date(b.date)
      if (isNaN(da) || isNaN(db)) return 0
      return da - db
    })

    const filtered = devoirs.filter((d, index) => {
      const txt = `${index + 1} ${d.titre} ${d.date}`.toLowerCase()
      return txt.includes(focused)
    })

    const choices = filtered.slice(0, 25).map((d, index) => {
      const labelIndex = index + 1
      const typeLabel =
        d.type === 'examen'
          ? 'Examen'
          : d.type === 'projet'
          ? 'Projet'
          : 'Devoir'
      return {
        name: `${labelIndex}. [${typeLabel}] ${d.titre} – ${d.date}`,
        value: String(d.id)
      }
    })

    await interaction.respond(choices)
  }
}
