// events/interactionCreate.js
const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  /**
   * @param {import('discord.js').Interaction} interaction
   */
  async execute(interaction) {
    const client = interaction.client;

    // 1) Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`❌ Commande inconnue : ${interaction.commandName}`);
        return;
      }

      try {
        console.log(`📝 ${interaction.user.tag} a utilisé /${interaction.commandName}`);
        // Passe aussi le client (utile pour /minijeux)
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`❌ Erreur lors de /${interaction.commandName}:`, error);

        const errorMessage = {
          content: '❌ Une erreur s’est produite lors de l’exécution de cette commande.',
          flags: [4096], // MessageFlags.Ephemeral
        };
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        } catch (responseError) {
          console.error('❌ Impossible de répondre à l’interaction:', responseError.message);
        }
      }
      return;
    }

    // 2) Boutons (inclut RPS)
    if (interaction.isButton()) {
      console.log(`🔘 ${interaction.user.tag} a cliqué: ${interaction.customId}`);

      // Support RPS: customId = "rps:<choice>:<userId>"
      const [tag, choice, ownerId] = String(interaction.customId).split(':');
      if (tag === 'rps') {
        // Empêche les autres de jouer sur tes boutons
        if (interaction.user.id !== ownerId) {
          return interaction.reply({ content: "Ce bouton n'est pas pour toi.", flags: [4096] });
        }

        const choices = ['rock', 'paper', 'scissors'];
        const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
        const em = { rock: '🪨', paper: '📄', scissors: '✂️' };

        const bot = choices[Math.floor(Math.random() * 3)];
        const res = (choice === bot) ? 'Égalité' : (beats[choice] === bot ? 'Tu gagnes' : 'Tu perds');

        return interaction.update({
          content: `Ton choix: ${em[choice]} | Bot: ${em[bot]} → **${res}**.`,
          components: []
        });
      }

      // autres futurs boutons…
      return;
    }

    // 3) Menus déroulants
    if (interaction.isStringSelectMenu?.()) {
      console.log(`📋 ${interaction.user.tag} a sélectionné: ${interaction.values}`);
      // logique spécifique ici si besoin
      return;
    }
  },
};
