const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js')

const { addReminder } = require('../../services/remindersStore')
const { readDevoirs } = require('../../services/devoirsService')
const { parseDateTimeLocal } = require('../../services/dateParser')
const { isFeatureEnabled } = require('../../services/guildConfig')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mp-rappel-devoir')
    .setDescription(
      'Planifie un rappel privé (DM) sur un devoir à une date et heure précises.'
    )
    .addStringOption(o =>
      o
        .setName('devoir')
        .setDescription('Nom du devoir (filtré automatiquement)')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('date').setDescription('Format AAAA-MM-JJ').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('heure').setDescription('Format HH:mm').setRequired(true)
    ),

  async execute (interaction) {
    if (interaction.guildId && !isFeatureEnabled(interaction.guildId, 'homework')) {
      return interaction.reply({
        content: '❌ Le système de devoirs est désactivé sur ce serveur.',
        flags: MessageFlags.Ephemeral
      })
    }

    const devoirId = Number(interaction.options.getString('devoir', true))
    const dateStr = interaction.options.getString('date', true)
    const heureStr = interaction.options.getString('heure', true)

    const devoir = readDevoirs().find(d => d.id === devoirId)
    if (!devoir) {
      return interaction.reply({ content: 'Aucun devoir trouvé.', flags: MessageFlags.Ephemeral })
    }

    const target = parseDateTimeLocal(dateStr, heureStr)
    if (!target) {
      return interaction.reply({
        content: 'Format de date/heure invalide.',
        flags: MessageFlags.Ephemeral
      })
    }

    const now = Date.now()
    const when = target.getTime()

    if (when <= now) {
      return interaction.reply({
        content: 'Le rappel doit être dans le futur.',
        flags: MessageFlags.Ephemeral
      })
    }

    // ✅ Plus de setTimeout: on persiste en JSON
    const reminder = addReminder({
      delivery: 'dm', // <-- le runner va regarder ça
      guildId: interaction.guildId, // utile pour logs / future config
      userId: interaction.user.id,

      devoirId: devoir.id,
      kind: 'dm-custom',
      title: devoir.titre,
      type: devoir.type || 'devoir',
      importance: devoir.importance || 'important',
      date: devoir.date,
      description: devoir.description || '',
      remindAtISO: new Date(when).toISOString()
    })

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('✅ Rappel privé programmé')
      .setDescription(`Je t’enverrai un DM pour **${devoir.titre}**.`)
      .addFields(
        { name: '📅 Quand', value: `${dateStr} à ${heureStr}` },
        { name: '🆔 ID rappel', value: reminder.id }
      )
      .setTimestamp()

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
  },

  async autocomplete (interaction) {
    const focused = interaction.options.getFocused().toLowerCase()
    const devoirs = readDevoirs()
      .filter(d => (d.titre || '').toLowerCase().includes(focused))
      .slice(0, 25)
      .map(d => ({
        name: `${d.titre} (${d.date})`,
        value: String(d.id)
      }))

    await interaction.respond(devoirs)
  }
}
