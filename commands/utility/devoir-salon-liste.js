const {SlashCommandBuilder,EmbedBuilder,PermissionFlagsBits,ChannelType} = require('discord.js')
const fs = require('fs')
const path = require('path')

const CONFIG_FILE = path.join(__dirname, '../../data/devoirs-config.json')

function readConfig () {
  if (!fs.existsSync(CONFIG_FILE)) return {}
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    return typeof data === 'object' && data !== null ? data : {}
  } catch {
    return {}
  }
}

function writeConfig (cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8')
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('devoir-salon-liste')
    .setDescription(
      'Définit le salon du tableau quotidien des devoirs/examens/projets.'
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(['Guild'])
    .addChannelOption(option =>
      option
        .setName('salon')
        .setDescription('Salon où poster le tableau (laisser vide pour désactiver)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  emoji: '📊',

  async execute (interaction) {
    const guildId = interaction.guildId
    const channel = interaction.options.getChannel('salon')

    const cfg = readConfig()
    if (!cfg[guildId]) cfg[guildId] = { roleId: null, customTimings: [] }

    if (!channel) {
      cfg[guildId].boardChannelId = null
      cfg[guildId].boardMessageId = null
      cfg[guildId].boardLastUpdate = null
    } else {
      cfg[guildId].boardChannelId = channel.id
      cfg[guildId].boardMessageId = null
      cfg[guildId].boardLastUpdate = null
    }

    writeConfig(cfg)

    if (interaction.client.forceDevoirBoardUpdate && channel) {
      await interaction.client.forceDevoirBoardUpdate().catch(() => null)
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('Configuration du tableau')
      .setDescription(
        channel
          ? `✅ Tableau quotidien activé dans ${channel}.`
          : '✅ Tableau quotidien désactivé.'
      )
      .setTimestamp()

    return interaction.reply({ embeds: [embed], flags: 64 })
  }
}
