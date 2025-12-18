const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const fs = require('fs')
const path = require('path')

const CONFIG_FILE = path.join(__dirname, '../../data/devoirs-config.json')

function readConfig () {
  if (!fs.existsSync(CONFIG_FILE)) return {}
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    return typeof data === 'object' && data !== null ? data : {}
  } catch (e) {
    console.error('Erreur lecture devoirs-config.json :', e)
    return {}
  }
}

function writeConfig (cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8')
  } catch (e) {
    console.error('Erreur écriture devoirs-config.json :', e)
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('devoir-salon-rappels')
    .setDescription('Définit le salon unique où tous les rappels seront envoyés.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(['Guild'])
    .addChannelOption(option =>
      option
        .setName('salon')
        .setDescription('Salon où envoyer tous les rappels (laisser vide pour revenir au comportement par défaut)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  emoji: '📣',

  async execute (interaction) {
    const guildId = interaction.guildId
    if (!guildId) {
      return interaction.reply({
        content: 'Cette commande doit être utilisée dans un serveur.',
        flags: 64
      })
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: "Tu n'as pas la permission (ManageGuild requis).",
        flags: 64
      })
    }

    const channel = interaction.options.getChannel('salon')
    const cfg = readConfig()
    if (!cfg[guildId]) cfg[guildId] = { roleId: null, customTimings: [] }

    cfg[guildId].reminderChannelId = channel ? channel.id : null
    writeConfig(cfg)

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('Configuration des rappels mise à jour')
      .setDescription(
        channel
          ? `✅ Tous les rappels seront désormais envoyés dans ${channel}.`
          : '✅ Les rappels utiliseront le salon de création (comportement par défaut).'
      )
      .setTimestamp()
      .setFooter({
        text: 'Bot Discord 3SIB',
        iconURL: interaction.client.user.displayAvatarURL()
      })

    return interaction.reply({ embeds: [embed], flags: 64 })
  }
}
