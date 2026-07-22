const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits, MessageFlags } = require('discord.js')

const devoirsService = require('../../services/devoirsService')
const { parseDateYYYYMMDD } = require('../../services/dateParser')
const { isFeatureEnabled } = require('../../services/guildConfig')

const { TYPE_LABELS } = devoirsService

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modifier-date-devoir')
    .setDescription('Modifie la date limite d’un devoir, examen ou projet.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(['Guild'])
    .addStringOption(option =>
      option
        .setName('devoir')
        .setDescription('Choisis le devoir/examen/projet à modifier')
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
    if (!isFeatureEnabled(interaction.guildId, 'homework')) {
      return interaction.reply({
        content: '❌ Le système de devoirs est désactivé sur ce serveur.',
        flags: MessageFlags.Ephemeral
      })
    }

    const devoirIdStr = interaction.options.getString('devoir', true)
    const newDateStr = interaction.options.getString('date', true)

    const devoirId = Number(devoirIdStr)
    if (isNaN(devoirId)) {
      return interaction.reply({ content: '❌ Devoir invalide.', flags: MessageFlags.Ephemeral })
    }

    const result = devoirsService.updateDevoirDate(devoirId, newDateStr)
    if (!result.ok) {
      return interaction.reply({
        content: `❌ ${result.error}`,
        flags: MessageFlags.Ephemeral
      })
    }

    const { devoir: updatedDevoir, oldDate, reminders } = result
    const typeLabel = TYPE_LABELS[updatedDevoir.type] || 'Devoir'

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🗓️ Date modifiée')
      .setDescription(
        `La date du ${typeLabel.toLowerCase()} **${updatedDevoir.titre}** a été mise à jour.`
      )
      .addFields(
        { name: 'Ancienne date', value: oldDate || 'Inconnue', inline: true },
        { name: 'Nouvelle date', value: updatedDevoir.date, inline: true },
        {
          name: '🔔 Rappels persistants',
          value:
            reminders.length > 0
              ? `Recréés: ${reminders.length} rappel(s)`
              : 'Aucun (date trop proche ou passée, ou salon d’origine manquant)'
        }
      )
      .setTimestamp()
      .setFooter({
        text: 'Bot Discord 3SIB',
        iconURL: interaction.client.user.displayAvatarURL()
      })

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
  },

  // Autocomplete pour choisir le devoir
  async autocomplete (interaction) {
    const focused = interaction.options.getFocused().toLowerCase()
    const guildId = interaction.guildId

    const devoirs = devoirsService.readDevoirs()
      .filter(d => d.guildId === guildId)
      .sort((a, b) => {
        const da = parseDateYYYYMMDD(a.date)
        const db = parseDateYYYYMMDD(b.date)
        if (!da || !db) return 0
        return da - db
      })

    const choices = devoirs
      .filter(d => (d.titre || '').toLowerCase().includes(focused))
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
