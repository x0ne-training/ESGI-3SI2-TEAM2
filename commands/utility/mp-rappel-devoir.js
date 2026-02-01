const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')
const fs = require('fs')
const path = require('path')

const { addReminder } = require('../../services/remindersStore')

const DATA_FILE = path.join(__dirname, '../../data/devoirs.json')

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

function parseDateTime (dateStr, heureStr) {
  // date AAAA-MM-JJ, heure HH:mm
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null
  const [y, m, d] = parts

  const hm = heureStr.split(':').map(Number)
  if (hm.length !== 2 || hm.some(n => Number.isNaN(n))) return null
  const [hh, mm] = hm

  const dt = new Date(y, m - 1, d, hh, mm, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}

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
    const devoirId = Number(interaction.options.getString('devoir', true))
    const dateStr = interaction.options.getString('date', true)
    const heureStr = interaction.options.getString('heure', true)

    const devoir = readDevoirs().find(d => d.id === devoirId)
    if (!devoir) {
      return interaction.reply({ content: 'Aucun devoir trouvé.', flags: 64 })
    }

    const target = parseDateTime(dateStr, heureStr)
    if (!target) {
      return interaction.reply({
        content: 'Format de date/heure invalide.',
        flags: 64
      })
    }

    const now = Date.now()
    const when = target.getTime()

    if (when <= now) {
      return interaction.reply({
        content: 'Le rappel doit être dans le futur.',
        flags: 64
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

    return interaction.reply({ embeds: [embed], flags: 64 })
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
