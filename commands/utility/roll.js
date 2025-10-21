const { SlashCommandBuilder } = require('discord.js')
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Lance des dés')
    .addIntegerOption(o =>
      o.setName('count')
       .setDescription('Nombre de dés')
       .setRequired(false)
    )
    .addIntegerOption(o =>
      o.setName('sides')
       .setDescription('Faces par dé')
       .setRequired(false)
    ),
  async execute(interaction) {
    const count = Math.min(Math.max(interaction.options.getInteger('count') || 1, 1), 20)
    const sides = Math.min(Math.max(interaction.options.getInteger('sides') || 6, 2), 100)
    const rolls = []
    for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1)
    const total = rolls.reduce((a, b) => a + b, 0)
    await interaction.reply(`Rolls: ${rolls.join(', ')}\nTotal: ${total}`)
  }
}
