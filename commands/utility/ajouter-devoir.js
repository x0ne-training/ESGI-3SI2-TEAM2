// commands/utility/ajouter-devoir.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js')

const devoirsService = require('../../services/devoirsService')
const { isFeatureEnabled } = require('../../services/guildConfig')

const { TYPE_LABELS, IMPORTANCE_LABELS } = devoirsService

// Commande
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ajouter-devoir')
    .setDescription(
      'Ajoute un devoir, un examen ou un projet avec rappels J-7 et J-1.'
    )
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
        .setDescription('Type : devoir, examen ou projet')
        .setRequired(true)
        .addChoices(
          { name: 'devoir', value: 'devoir' },
          { name: 'examen', value: 'examen' },
          { name: 'projet', value: 'projet' }
        )
    )
    .addStringOption(option =>
      option
        .setName('importance')
        .setDescription(
          'Importance : peu important / important / très important'
        )
        .setRequired(false)
        .addChoices(
          { name: 'peu important', value: 'faible' },
          { name: 'important', value: 'important' },
          { name: 'très important', value: 'tres_important' }
        )
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Description')
        .setRequired(false)
        .setMaxLength(1000)
    )
    .addStringOption(option =>
      option
        .setName('timings')
        .setDescription("Timings custom pour CE devoir (ex: '3j,12h,45m')")
        .setRequired(false)
    ),
  emoji: '🧾',

  async execute (interaction) {
    if (interaction.guildId && !isFeatureEnabled(interaction.guildId, 'homework')) {
      return interaction.reply({
        content: '❌ Le système de devoirs est désactivé sur ce serveur.',
        flags: MessageFlags.Ephemeral
      })
    }

    const titre = interaction.options.getString('titre', true)
    const dateStr = interaction.options.getString('date', true)
    const type = interaction.options.getString('type', true)
    const importance =
      interaction.options.getString('importance') || 'important'
    const description = interaction.options.getString('description') || ''
    const timingsStr = interaction.options.getString('timings') || ''

    const result = devoirsService.addDevoir({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      titre,
      date: dateStr,
      description,
      type,
      importance,
      timingsStr
    })

    if (!result.ok) {
      return interaction.reply({
        content: `❌ ${result.error}`,
        flags: MessageFlags.Ephemeral
      })
    }

    const { devoir, remindersCreated } = result
    const typeLabel = TYPE_LABELS[type] || 'Devoir'
    const impLabel = IMPORTANCE_LABELS[importance] || 'Important'

    const embed = new EmbedBuilder()
      .setColor(
        type === 'examen' ? 0x9b59b6 : type === 'projet' ? 0x3498db : 0x2ecc71
      )
      .setTitle(`✅ ${typeLabel} ajouté`)
      .addFields(
        { name: '📘 Titre', value: devoir.titre },
        { name: '🗂️ Type', value: typeLabel, inline: true },
        { name: '📍 Importance', value: impLabel, inline: true },
        { name: '📅 Date limite', value: devoir.date, inline: true },
        { name: '📝 Description', value: devoir.description || 'Aucune' },
        { name: '📢 Salon des rappels', value: `<#${interaction.channelId}>` }
      )
      .setTimestamp()
      .setFooter({
        text: 'Bot Discord 3SIB',
        iconURL: interaction.client.user.displayAvatarURL()
      })

    if (devoir.customTimings.length > 0) {
      embed.addFields({
        name: '⏱️ Timings personnalisés (pour ce devoir)',
        value: devoir.customTimings.map(t => `• ${t.label}`).join('\n')
      })
    }

    if (remindersCreated.length > 0) {
      embed.addFields({
        name: '🔔 Rappels programmés (persistants)',
        value: remindersCreated
          .map(
            r =>
              `• ${r.kind} → ${new Date(r.remindAtISO).toLocaleString('fr-FR')}`
          )
          .join('\n')
      })
    }

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral
    })
  }
}
