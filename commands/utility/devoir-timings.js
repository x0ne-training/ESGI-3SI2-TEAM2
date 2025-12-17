const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js')
const fs = require('fs')
const path = require('path')

const CONFIG_FILE = path.join(__dirname, '../../data/devoirs-config.json')

function readConfig () {
  if (!fs.existsSync(CONFIG_FILE)) return {}
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function writeConfig (cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8')
}

function parseOffset (str) {
  str = str.toLowerCase().replace(/\s+/g, '')

  let total = 0

  const days = str.match(/(\d+)j/)
  if (days) total += parseInt(days[1]) * 24 * 60 * 60 * 1000

  const hours = str.match(/(\d+)h/)
  if (hours) total += parseInt(hours[1]) * 60 * 60 * 1000

  const mins = str.match(/(\d+)m/)
  if (mins) total += parseInt(mins[1]) * 60 * 1000

  return total > 0 ? total : null
}

// Affiche un délai lisible (mieux que les ms 💀)
function formatDuration (ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—'

  const totalSeconds = Math.floor(ms / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const totalHours = Math.floor(totalMinutes / 60)
  const hours = totalHours % 24
  const days = Math.floor(totalHours / 24)

  const parts = []
  if (days) parts.push(`${days}j`)
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  if (seconds) parts.push(`${seconds}s`)
  if (parts.length === 0) return '0s'
  return parts.join(' ')
}

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
          flags: 64
        })
      }

      cfg[guildId].customTimings.push({
        label,
        offsetMs: offset
      })

      writeConfig(cfg)

      return interaction.reply({
        content: `✅ Timing ajouté : **${label}** (${delai}).`,
        flags: 64
      })
    }

    if (sub === 'liste') {
      const list = cfg[guildId].customTimings
      if (list.length === 0) {
        return interaction.reply({
          content: '📭 Aucun timing personnalisé.',
          flags: 64
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
        flags: 64
      })
    }

    if (sub === 'supprimer') {
      const index = interaction.options.getInteger('index', true) - 1
      const list = cfg[guildId].customTimings

      if (!list[index]) {
        return interaction.reply({
          content: '❌ Index invalide.',
          flags: 64
        })
      }

      const removed = list.splice(index, 1)
      writeConfig(cfg)

      return interaction.reply({
        content: `Timing supprimé : **${removed[0].label}**`,
        flags: 64
      })
    }
  }
}
