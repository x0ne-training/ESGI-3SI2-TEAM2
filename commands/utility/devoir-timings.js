const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js')
const { readConfig, writeConfig, parseOffset, formatDuration } = require('../../services/devoirsService')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('devoir-timings')
    .setDescription(
      'Gère les timings de rappels personnalisés pour les devoirs.'
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('ajouter')
        .setDescription('Ajoute un timing personnalisé.')
        .addStringOption(o =>
          o
            .setName('label')
            .setDescription("Nom du timing (ex: '3 jours avant')")
            .setRequired(true)
        )
        .addStringOption(o =>
          o
            .setName('delai')
            .setDescription("Exemples : '3j', '12h', '1h30', '45m'")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('liste').setDescription('Affiche les timings actuels.')
    )
    .addSubcommand(sub =>
      sub
        .setName('supprimer')
        .setDescription('Supprime un timing personnalisé.')
        .addIntegerOption(o =>
          o
            .setName('index')
            .setDescription('Index du timing (visible dans la liste)')
            .setRequired(true)
        )
    )
    .setContexts(['Guild']),
  emoji: '⏱️',

  async execute (interaction) {
    const guildId = interaction.guildId
    const cfg = readConfig()

    if (!cfg[guildId]) {
      cfg[guildId] = { roleId: null, customTimings: [] }
    }

    if (!Array.isArray(cfg[guildId].customTimings)) {
      cfg[guildId].customTimings = []
    }
    const sub = interaction.options.getSubcommand()

    if (sub === 'ajouter') {
      const label = interaction.options.getString('label', true)
      const delai = interaction.options.getString('delai', true)
      const offset = parseOffset(delai)

      if (!offset) {
        return interaction.reply({
          content: '❌ Format de délai invalide.',
          flags: MessageFlags.Ephemeral
        })
      }

      cfg[guildId].customTimings.push({
        label,
        offsetMs: offset
      })

      writeConfig(cfg)

      return interaction.reply({
        content: `✅ Timing ajouté : **${label}** (${delai}).`,
        flags: MessageFlags.Ephemeral
      })
    }

    if (sub === 'liste') {
      const list = cfg[guildId].customTimings
      if (list.length === 0) {
        return interaction.reply({
          content: '📭 Aucun timing personnalisé.',
          flags: MessageFlags.Ephemeral
        })
      }

      const desc = list
        .map((t, i) => `**${i + 1}.** ${t.label} — ${formatDuration(t.offsetMs)}`)
        .join('\n')

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('⏱️ Timings personnalisés')
            .setDescription(desc)
        ],
        flags: MessageFlags.Ephemeral
      })
    }

    if (sub === 'supprimer') {
      const index = interaction.options.getInteger('index', true) - 1
      const list = cfg[guildId].customTimings

      if (!list[index]) {
        return interaction.reply({
          content: '❌ Index invalide.',
          flags: MessageFlags.Ephemeral
        })
      }

      const removed = list.splice(index, 1)
      writeConfig(cfg)

      return interaction.reply({
        content: `Timing supprimé : **${removed[0].label}**`,
        flags: MessageFlags.Ephemeral
      })
    }
  }
}
