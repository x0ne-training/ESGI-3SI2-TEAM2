const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js')
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
    .setName('devoir-mention-role-config')
    .setDescription(
      'Définit le rôle mentionné dans les rappels de devoirs/examens (ou @everyone par défaut).'
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(['Guild'])
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription(
          'Rôle à mentionner dans les rappels (laisser vide pour revenir à @everyone)'
        )
        .setRequired(false)
    ),
  emoji: '🔔',

  async execute (interaction) {
    // Vérif au cas où
    if (
      !interaction.memberPermissions ||
      !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)
    ) {
      return interaction.reply({
        content:
          'Tu n’as pas la permission de configurer le rôle des rappels (ManageGuild requis).',
        flags: 64
      })
    }

    const guildId = interaction.guildId
    if (!guildId) {
      return interaction.reply({
        content: 'Cette commande doit être utilisée dans un serveur.',
        flags: 64
      })
    }

    const role = interaction.options.getRole('role')
    const cfg = readConfig()

    if (!cfg[guildId]) cfg[guildId] = { roleId: null }

    if (!role) {
      // reset -> @everyone
      cfg[guildId].roleId = null
    } else {
      cfg[guildId].roleId = role.id
    }

    writeConfig(cfg)

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('Configuration des rappels mise à jour')
      .setDescription(
        role
          ? `Les rappels de devoirs/examens mentionneront désormais le rôle ${role}.`
          : 'Les rappels de devoirs/examens mentionneront désormais **@everyone**.'
      )
      .setTimestamp()
      .setFooter({
        text: 'Bot Discord 3SIB', // je vais vraiment finir par mettre un easter egg à cet endroit (et à automatiser ça)
        iconURL: interaction.client.user.displayAvatarURL()
      })

    await interaction.reply({
      embeds: [embed],
      flags: 64
    })
  }
}
