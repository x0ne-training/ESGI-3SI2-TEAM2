const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js')
module.exports = {
  data: new SlashCommandBuilder().setName('f1-race').setDescription('Parier sur une écurie et regarder la course')
    .addIntegerOption(o => o.setName('bet').setDescription('Mise en points').setRequired(false)),
  async execute(interaction) {
    const bet = Math.max(0, interaction.options.getInteger('bet') || 0)
    const teams = [
      { id: 'mercedes', name: 'Mercedes', power: 95 },
      { id: 'ferrari', name: 'Ferrari', power: 92 },
      { id: 'redbull', name: 'Red Bull', power: 97 },
      { id: 'mclaren', name: 'McLaren', power: 88 },
      { id: 'aston', name: 'Aston Martin', power: 85 },
      { id: 'alpine', name: 'Alpine', power: 83 }
    ]
    const options = teams.map(t => ({ label: t.name, value: t.id }))
    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_team').setPlaceholder('Choisis ton écurie').addOptions(options))
    await interaction.reply({ content: `Tu paries ${bet} points. Choisis une écurie:`, components: [row] })
    const msg = await interaction.fetchReply()
    const filter = i => i.user.id === interaction.user.id && i.customId === 'select_team'
    const collector = msg.createMessageComponentCollector({ filter, time: 60000, max: 1 })
    collector.on('collect', async i => {
      await i.deferUpdate()
      const choice = i.values[0]
      const chosen = teams.find(t => t.id === choice)
      const progress = teams.map(t => ({ name: t.name, pos: 0 }))
      const totalSteps = 10
      for (let step = 0; step <= totalSteps; step++) {
        for (const t of teams) {
          const advance = Math.random() * (t.power / 100)
          const p = progress.find(p => p.name === t.name)
          p.pos += advance
        }
        const ranking = progress.slice().sort((a, b) => b.pos - a.pos).map((p, idx) => `${idx+1}. ${p.name}`).join('\n')
        await interaction.editReply({ content: `Course en cours...\n\nÉtape ${step}/${totalSteps}\n\n${ranking}` })
        await new Promise(r => setTimeout(r, 800))
      }
      const final = progress.slice().sort((a, b) => b.pos - a.pos)
      const winner = final[0].name
      const won = winner === chosen.name
      await interaction.editReply({ content: `La course est terminée !\nGagnant: ${winner}\nTon choix: ${chosen.name}\nTu ${won ? 'gagnes' : 'perds'} ${won ? bet : bet}` })
    })
    collector.on('end', collected => {
      if (collected.size === 0) interaction.editReply({ content: 'Temps écoulé, course annulée.', components: [] }).catch(()=>{})
    })
  }
}
